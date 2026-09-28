"""Journal storage and computed totals for Suivi Stock Pellet.

Only raw journal entries (one per logged consumption or purchase) are
persisted. Stock, spend, and day counts are always recomputed from the
journal on read, so there is nothing that can drift out of sync.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date
import logging
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DEFAULT_BAG_WEIGHT_KG,
    DEFAULT_CALORIFIC_VALUE,
    ENTRY_TYPE_CONSUMPTION,
    ENTRY_TYPE_PURCHASE,
    STORAGE_VERSION,
)


_LOGGER = logging.getLogger(__name__)


def _heating_days(entries: list[dict[str, Any]]) -> int:
    """Calendar days spanning the full months of logged consumption.

    Mirrors the spreadsheet method this integration replaces: every month
    that has at least one consumption entry counts in full (all its
    calendar days), from the month of the first consumption entry through
    the month of the last one. This avoids the wild early-season swings of
    counting raw log-entry occurrences (e.g. a single first entry giving
    "1 day" and an absurd extrapolated monthly cost).
    """
    conso_dates = sorted(
        e["date"] for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION
    )
    if not conso_dates:
        return 0
    first = date.fromisoformat(conso_dates[0])
    last = date.fromisoformat(conso_dates[-1])
    total = 0
    y, m = first.year, first.month
    while (y, m) <= (last.year, last.month):
        total += monthrange(y, m)[1]
        m += 1
        if m > 12:
            m = 1
            y += 1
    return total


def season_for_date(d: date, season_start_month: int) -> str:
    """Return the season key (e.g. '2025-2026') a given date belongs to."""
    if d.month >= season_start_month:
        return f"{d.year}-{d.year + 1}"
    return f"{d.year - 1}-{d.year}"


def previous_season_key(season: str) -> str:
    """Return the season key immediately preceding the given one (e.g. '2024-2025' -> '2023-2024')."""
    year_start, year_end = (int(part) for part in season.split("-"))
    return f"{year_start - 1}-{year_end - 1}"


def season_start_date(season: str, season_start_month: int) -> date:
    """Return the calendar date a season key starts on."""
    year_start = int(season.split("-")[0])
    return date(year_start, season_start_month, 1)


def _entry_unit(entry: dict[str, Any]) -> str:
    """Return the persisted unit, defaulting legacy entries to bags."""
    return entry.get("unit", "bag")


def _entry_qty_kg(entry: dict[str, Any], default_bag_weight_kg: float) -> float:
    """Return an entry quantity in kg without changing its stored unit."""
    if _entry_unit(entry) == "kg":
        return float(entry.get("qty_kg", 0.0))
    return float(entry.get("qty_bags", 0.0)) * (
        entry.get("bag_weight_kg") or default_bag_weight_kg
    )

class PelletJournal:
    """Owns the persisted journal and exposes computed season totals."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store: Store = Store(
            hass, STORAGE_VERSION, f"suivi_stock_pellet_{entry_id}"
        )
        self._data: dict[str, Any] = {"seasons": {}}

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if stored:
            self._data = stored
            self._data.setdefault("seasons", {})

    async def _async_save(self) -> None:
        await self._store.async_save(self._data)

    def _season_entries(self, season: str, carry_over: bool = True) -> list[dict[str, Any]]:
        return self._get_season(season, carry_over=carry_over)["entries"]

    def _get_season(self, season: str, carry_over: bool = True) -> dict[str, Any]:
        seasons = self._data["seasons"]
        if season not in seasons:
            if carry_over:
                stock_initial = self._effective_stock_initial(season)
                stock_initial_value = self._effective_stock_initial_value(season)
            else:
                # Bulk historical backfill (CSV import): the season being
                # created is expected to stand on its own, matching an
                # externally-kept record of that season's own purchases/
                # consumption - it must never silently inherit a carry-over
                # from whatever the previous season happens to look like at
                # import time.
                stock_initial = 0.0
                stock_initial_value = 0.0
            seasons[season] = {
                "entries": [],
                "stock_initial": stock_initial,
                "stock_initial_value_eur": stock_initial_value,
            }
        return seasons[season]

    def _effective_stock_initial(self, season: str) -> float:
        """Stock a season starts with, including a preview for seasons
        that don't exist in storage yet.

        A season's stock_initial is only computed and persisted the
        first time it's touched (via _get_season). But a stock-
        sufficiency check for the very first entry about to be logged in
        a brand new season needs to see that value BEFORE the season is
        created - otherwise it always sees 0 and incorrectly rejects a
        legitimate consumption that should inherit stock carried over
        from the previous season (a real reported bug: backfilling
        history season-by-season hit this on the first consumption of a
        season that hadn't had a purchase logged in it yet). This mirrors
        _carry_over_stock's read-only preview without persisting or
        creating anything.
        """
        seasons = self._data.get("seasons", {})
        data = seasons.get(season)
        if data is not None and (data.get("entries") or data.get("stock_initial_manual")):
            return data.get("stock_initial", 0.0)
        return self._carry_over_stock(season)

    def _effective_stock_initial_value(self, season: str) -> float:
        """Euro value carried into a season's starting stock, mirroring
        _effective_stock_initial but for the stock's monetary value
        instead of its bag count. Used to compute a weighted-average
        cost per bag that blends carried-over stock with the season's
        own purchases.

        Seasons created before this value-carryover feature shipped
        have no stored "stock_initial_value_eur" at all. For those,
        backfill a computed value on read (never persisted here, mirrors
        the read-only preview pattern) - but only when the season's own
        bag-side stock_initial is itself a genuine inherited amount
        (nonzero, with a previous season on record to source it from).
        A pre-existing season whose stock_initial is the legacy default
        of 0 must keep a value of 0 too, or bags=0/value>0 would be
        incoherent (implying an infinite price per bag).
        """
        seasons = self._data.get("seasons", {})
        data = seasons.get(season)
        if data is not None and "stock_initial_value_eur" in data:
            return data["stock_initial_value_eur"]
        if data is not None and (data.get("entries") or data.get("stock_initial_manual")):
            stock_initial_bags = data.get("stock_initial", 0.0)
            if not stock_initial_bags:
                return 0.0
            try:
                previous_season = previous_season_key(season)
            except ValueError:
                return 0.0
            if previous_season not in seasons:
                return 0.0
            return self.totals(previous_season)["stock_value_eur"]
        return self._carry_over_stock_value(season)

    def _carry_over_stock(self, season: str) -> float:
        """Auto-carry the previous season's leftover stock into a brand
        new season's starting stock, the first time that season is
        touched (a purchase or consumption is logged in it).

        Only applies when the previous season already exists in storage
        - a season that already existed before this feature shipped
        keeps whatever stock_initial it already has (0, unless set
        explicitly via async_set_stock_initial), since retroactively
        rewriting an already-active season's starting stock could
        silently change numbers the user has already seen and trusted.
        """
        try:
            previous_season = previous_season_key(season)
        except ValueError:
            return 0.0
        if previous_season not in self._data["seasons"]:
            return 0.0
        return self.totals(previous_season)["stock_bags"]

    def _carry_over_stock_value(self, season: str) -> float:
        """Auto-carry the previous season's leftover stock VALUE (euros)
        into a brand new season, mirroring _carry_over_stock. Combined
        with the carried bag count, this lets totals() compute a
        weighted-average price per bag across season boundaries instead
        of only ever looking at the current season's own purchases.
        """
        try:
            previous_season = previous_season_key(season)
        except ValueError:
            return 0.0
        if previous_season not in self._data["seasons"]:
            return 0.0
        return self.totals(previous_season)["stock_value_eur"]

    async def async_add_entry(
        self,
        season: str,
        entry_type: str,
        qty_bags: float | None,
        entry_date: str,
        price_eur: float | None = None,
        bag_weight_kg: float | None = None,
        calorific_value: float | None = None,
        unit: str = "bag",
        qty_kg: float | None = None,
    ) -> None:
        if unit == "kg":
            if qty_kg is None or qty_kg <= 0:
                raise ValueError("La quantité en kg doit être strictement positive")
            stored = {
                "type": entry_type,
                "unit": "kg",
                "qty_kg": float(qty_kg),
                "date": entry_date,
                "price_eur": price_eur,
                "calorific_value": calorific_value,
            }
        else:
            if qty_bags is None or qty_bags <= 0:
                raise ValueError("La quantité en sacs doit être strictement positive")
            stored = {
                "type": entry_type,
                "unit": "bag",
                "qty_bags": float(qty_bags),
                "date": entry_date,
                "price_eur": price_eur,
                "bag_weight_kg": bag_weight_kg,
                "calorific_value": calorific_value,
            }
        self._season_entries(season).append(stored)
        await self._async_save()

    async def async_import_entries(self, imported: list[dict[str, Any]]) -> None:
        """Atomically append a validated batch of historical entries."""
        from copy import deepcopy

        snapshot = deepcopy(self._data)
        try:
            for item in imported:
                season = item["season"]
                entry_type = item["type"]
                unit = item.get("unit", "bag")
                entry_date = str(item["date"])
                if entry_type not in (ENTRY_TYPE_PURCHASE, ENTRY_TYPE_CONSUMPTION):
                    raise ValueError(f"Type de saisie invalide: {entry_type}")
                date.fromisoformat(entry_date)
                if unit == "kg":
                    qty = float(item["qty_kg"])
                    if qty <= 0:
                        raise ValueError("La quantité doit être strictement positive")
                    self._season_entries(season, carry_over=False).append({
                        "type": entry_type,
                        "unit": "kg",
                        "qty_kg": qty,
                        "date": entry_date,
                        "price_eur": item.get("price_eur"),
                        "calorific_value": item.get("calorific_value"),
                    })
                else:
                    qty = float(item["qty_bags"])
                    if qty <= 0:
                        raise ValueError("La quantité doit être strictement positive")
                    self._season_entries(season, carry_over=False).append({
                        "type": entry_type,
                        "unit": "bag",
                        "qty_bags": qty,
                        "date": entry_date,
                        "price_eur": item.get("price_eur"),
                        "bag_weight_kg": item.get("bag_weight_kg"),
                        "calorific_value": item.get("calorific_value"),
                    })

            affected = sorted({item["season"] for item in imported})
            for season in affected:
                entries = self._data.get("seasons", {}).get(season, {}).get(
                    "entries", []
                )
                if self._minimum_chronological_stock(season, entries) < -1e-9:
                    raise ValueError(
                        f"Import refusé : le stock de la saison {season} "
                        "passerait sous 0 à un moment de l'historique."
                    )
            await self._async_save()
        except Exception:
            self._data = snapshot
            await self._async_save()
            raise

    async def async_undo_last(self, season: str) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if not entries:
            # Merely reading _season_entries() above may have auto-
            # vivified an empty season dict in storage (see _get_season)
            # even though nothing was actually removed - prune it back
            # out so a no-op undo can never leave a stray empty season
            # behind.
            self._prune_if_empty(season)
            await self._async_save()
            return None
        removed = entries.pop()
        self._prune_if_empty(season)
        await self._async_save()
        return removed

    async def async_edit_entry(
        self,
        season: str,
        index: int,
        qty_bags: float | None = None,
        price_eur: float | None = None,
        entry_date: str | None = None,
        new_season: str | None = None,
        unit: str | None = None,
        qty_kg: float | None = None,
    ) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if index < 0 or index >= len(entries):
            # Same auto-vivification concern as async_undo_last/
            # async_delete_entry: an out-of-range edit must not leave a
            # stray empty season behind.
            self._prune_if_empty(season)
            await self._async_save()
            return None
        entry = entries[index]
        updated = dict(entry)

        effective_unit = unit if unit is not None else _entry_unit(entry)
        if effective_unit not in ("bag", "kg"):
            raise ValueError("Unité invalide")

        if effective_unit == "kg":
            effective_qty_kg = qty_kg
            if effective_qty_kg is None:
                if unit == "kg":
                    raise ValueError("La quantité en kg est requise")
                effective_qty_kg = _entry_qty_kg(entry, DEFAULT_BAG_WEIGHT_KG)
            if effective_qty_kg <= 0:
                raise ValueError("La quantité en kg doit être strictement positive")
            updated["unit"] = "kg"
            updated["qty_kg"] = float(effective_qty_kg)
            updated.pop("qty_bags", None)
            updated.pop("bag_weight_kg", None)
        else:
            effective_qty_bags = qty_bags
            if effective_qty_bags is None:
                if unit == "bag":
                    effective_qty_bags = (
                        float(entry.get("qty_kg", 0.0)) / DEFAULT_BAG_WEIGHT_KG
                        if _entry_unit(entry) == "kg"
                        else entry.get("qty_bags")
                    )
                else:
                    effective_qty_bags = entry.get("qty_bags")
            if effective_qty_bags is None or effective_qty_bags <= 0:
                raise ValueError("La quantité en sacs doit être strictement positive")
            updated["unit"] = "bag"
            updated["qty_bags"] = float(effective_qty_bags)
            if "bag_weight_kg" not in updated:
                updated["bag_weight_kg"] = DEFAULT_BAG_WEIGHT_KG
            updated.pop("qty_kg", None)

        if entry_date is not None:
            date.fromisoformat(entry_date)
            updated["date"] = entry_date
        if updated["type"] == ENTRY_TYPE_PURCHASE and price_eur is not None:
            updated["price_eur"] = price_eur
        target_season = (
            new_season
            if (new_season is not None and new_season != season)
            else season
        )
        self._assert_edit_keeps_stock_nonnegative(
            season, index, updated, target_season
        )
        entry.clear()
        entry.update(updated)
        if target_season != season:
            entries.pop(index)
            self._season_entries(target_season).append(entry)
            self._prune_if_empty(season)
        await self._async_save()
        return entry

    def _stock_for_entries(
        self, season: str, entries: list[dict[str, Any]]
    ) -> float:
        """Return the final real stock for an exact entries list."""
        purchased_kg = sum(
            _entry_qty_kg(e, DEFAULT_BAG_WEIGHT_KG)
            for e in entries
            if e["type"] == ENTRY_TYPE_PURCHASE
        )
        consumed_kg = sum(
            _entry_qty_kg(e, DEFAULT_BAG_WEIGHT_KG)
            for e in entries
            if e["type"] == ENTRY_TYPE_CONSUMPTION
        )
        return self._effective_stock_initial(season) + (
            purchased_kg - consumed_kg
        ) / DEFAULT_BAG_WEIGHT_KG

    def _minimum_chronological_stock(
        self, season: str, entries: list[dict[str, Any]]
    ) -> float:
        """Return the lowest stock reached when entries are applied by date.

        Purchases on a day are applied before consumptions on that same day,
        matching the service stock check, which evaluates the complete day's
        journal before accepting a consumption.
        """
        stock = self._effective_stock_initial(season)
        minimum = stock
        for entry in sorted(
            entries,
            key=lambda item: (
                item["date"],
                0 if item["type"] == ENTRY_TYPE_PURCHASE else 1,
            ),
        ):
            qty_kg = _entry_qty_kg(entry, DEFAULT_BAG_WEIGHT_KG)
            if entry["type"] == ENTRY_TYPE_PURCHASE:
                stock += qty_kg / DEFAULT_BAG_WEIGHT_KG
            elif entry["type"] == ENTRY_TYPE_CONSUMPTION:
                stock -= qty_kg / DEFAULT_BAG_WEIGHT_KG
                minimum = min(minimum, stock)
        return minimum

    def _reference_stock_unit_value(self, season: str) -> float:
        """Return the best available €/bag cost for a manual stock count."""
        data = self._data.get("seasons", {}).get(season, {})
        entries = data.get("entries", [])
        purchased_bags = sum(
            _entry_qty_kg(e, DEFAULT_BAG_WEIGHT_KG) / DEFAULT_BAG_WEIGHT_KG
            for e in entries
            if e["type"] == ENTRY_TYPE_PURCHASE
        )
        spent = sum(
            float(e.get("price_eur") or 0)
            for e in entries
            if e["type"] == ENTRY_TYPE_PURCHASE
        )
        if purchased_bags > 0 and spent >= 0:
            return spent / purchased_bags
        try:
            previous = previous_season_key(season)
        except ValueError:
            return 0.0
        previous_totals = self.totals(previous)
        previous_stock = previous_totals["stock_bags"]
        if previous_stock > 0:
            return previous_totals["stock_value_eur"] / previous_stock
        return 0.0

    def _assert_edit_keeps_stock_nonnegative(
        self,
        source_season: str,
        source_index: int,
        updated_entry: dict[str, Any],
        target_season: str,
    ) -> None:
        """Raise ValueError if replacing entries[source_index] in
        source_season with updated_entry (optionally moved to
        target_season) would newly push, or push further, an affected
        season's real stock below 0 (more consumed than ever
        purchased/started with).

        Only blocks edits that make an affected season's stock strictly
        worse than it already is - an edit on a season whose stock is
        already inconsistent (e.g. legacy data predating this check)
        can still be corrected freely, as long as it doesn't dig the
        hole deeper. Only a brand new log_consumption call was ever
        validated against available stock before this; edit/delete had
        no equivalent check at all.
        """
        seasons = self._data.get("seasons", {})
        source_entries = list(seasons.get(source_season, {}).get("entries", []))
        before_source = self._stock_for_entries(source_season, source_entries)
        del source_entries[source_index]
        if target_season == source_season:
            source_entries.append(updated_entry)
        to_check = {source_season: (before_source, source_entries)}
        if target_season != source_season:
            target_entries = list(
                seasons.get(target_season, {}).get("entries", [])
            )
            before_target = self._stock_for_entries(target_season, target_entries)
            target_entries.append(updated_entry)
            to_check[target_season] = (before_target, target_entries)

        for season_key, (before, entries) in to_check.items():
            after = self._stock_for_entries(season_key, entries)
            before_min = self._minimum_chronological_stock(
                season_key,
                seasons.get(season_key, {}).get("entries", []),
            )
            after_min = self._minimum_chronological_stock(season_key, entries)
            if (
                (after < -1e-9 and after < before - 1e-9)
                or (
                    after_min < -1e-9
                    and after_min < before_min - 1e-9
                )
            ):
                raise ValueError(
                    f"Cette modification ferait passer le stock de la saison "
                    f"{season_key} sous 0 (plus consommé qu'acheté)."
                )

    async def async_delete_entry(
        self, season: str, index: int
    ) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if index < 0 or index >= len(entries):
            # Merely reading _season_entries() above may have auto-
            # vivified an empty season dict in storage (see _get_season)
            # even though nothing was actually deleted - prune it back
            # out so a stale/duplicate delete call (e.g. a UI that
            # retried after the entry was already removed) can never
            # leave a stray empty season behind.
            self._prune_if_empty(season)
            await self._async_save()
            return None
        self._assert_delete_keeps_stock_nonnegative(season, index)
        removed = entries.pop(index)
        self._prune_if_empty(season)
        await self._async_save()
        return removed

    def _assert_delete_keeps_stock_nonnegative(
        self, season: str, index: int
    ) -> None:
        """Raise ValueError if removing entries[index] would newly push,
        or push further, this season's real stock below 0."""
        entries = list(self._data.get("seasons", {}).get(season, {}).get("entries", []))
        before = self._stock_for_entries(season, entries)
        before_min = self._minimum_chronological_stock(season, entries)
        del entries[index]
        after = self._stock_for_entries(season, entries)
        after_min = self._minimum_chronological_stock(season, entries)
        if (
            (after < -1e-9 and after < before - 1e-9)
            or (after_min < -1e-9 and after_min < before_min - 1e-9)
        ):
            raise ValueError(
                f"Suppression impossible : le stock de la saison {season} "
                "passerait sous 0 (plus consommé qu'acheté sans cette entrée)."
            )

    def _prune_if_empty(self, season: str) -> None:
        """Remove a season's storage entry entirely once it has no
        entries left and no meaningful manual correction either - an
        empty season with no entries and no non-zero manually-set
        stock_initial is indistinguishable from one that never existed,
        so there is no reason to keep cluttering the season list with
        it. A manual correction to a non-zero value (e.g. a physical
        stock count for a season that hasn't started logging entries
        yet) is intentional and kept even with zero entries; a manual
        correction back to exactly 0 (e.g. undoing an earlier bad
        carry-over) carries no more information than never having
        touched the season at all, so it does not block pruning.
        """
        seasons = self._data.get("seasons", {})
        data = seasons.get(season)
        if data is not None and not data.get("entries") and not (
            data.get("stock_initial_manual") and data.get("stock_initial", 0.0) != 0
        ):
            del seasons[season]

    async def async_prune_empty_seasons(self) -> None:
        """One-shot sweep for already-empty, uncorrected seasons left
        over in storage (e.g. from a season that was emptied out before
        this auto-prune behavior existed). Safe to call on every
        startup: a season that fails the prune condition is left
        untouched.
        """
        seasons = self._data.get("seasons", {})
        to_remove = [
            s
            for s, data in seasons.items()
            if not data.get("entries")
            and not (data.get("stock_initial_manual") and data.get("stock_initial", 0.0) != 0)
        ]
        if not to_remove:
            return
        for s in to_remove:
            del seasons[s]
        await self._async_save()

    async def async_set_stock_initial(self, season: str, value: float) -> None:
        """Manually (re)set a season's starting stock.

        Used to backfill a season that already existed before the
        stock-carry-over feature shipped, or to correct the
        auto-carried value (e.g. a manual physical stock count).

        Keep the monetary value of the corrected stock consistent with
        the season's current weighted-average cost per bag.
        """
        season_data = self._get_season(season)
        old_stock = season_data.get("stock_initial", 0.0)
        old_value = season_data.get(
            "stock_initial_value_eur",
            self._effective_stock_initial_value(season),
        )
        old_unit_value = (
            old_value / old_stock
            if old_stock > 0
            else self._reference_stock_unit_value(season)
        )
        season_data["stock_initial"] = value
        season_data["stock_initial_value_eur"] = round(
            value * old_unit_value, 2
        )
        season_data["stock_initial_manual"] = True
        await self._async_save()

    def totals(
        self,
        season: str,
        as_of_date: str | None = None,
        default_bag_weight_kg: float = DEFAULT_BAG_WEIGHT_KG,
        default_calorific_value: float = DEFAULT_CALORIFIC_VALUE,
    ) -> dict[str, float]:
        season_data = self._data.get("seasons", {}).get(season, {})
        entries = season_data.get("entries", [])
        if as_of_date is not None:
            entries = [e for e in entries if e["date"] <= as_of_date]
        stock_initial = self._effective_stock_initial(season)
        purchased_kg = sum(_entry_qty_kg(e, default_bag_weight_kg) for e in entries if e["type"] == ENTRY_TYPE_PURCHASE)
        consumed_kg = sum(_entry_qty_kg(e, default_bag_weight_kg) for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION)
        purchased = purchased_kg / default_bag_weight_kg
        consumed = consumed_kg / default_bag_weight_kg
        spent = sum((e.get("price_eur") or 0) for e in entries if e["type"] == ENTRY_TYPE_PURCHASE)
        consumed_kwh = sum(_entry_qty_kg(e, default_bag_weight_kg) * (e.get("calorific_value") or default_calorific_value) for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION)
        days = _heating_days(entries)
        stock_initial_value = self._effective_stock_initial_value(season)
        avg_price_per_bag = spent / purchased if purchased > 0 else 0.0
        avg_price_per_kg = spent / purchased_kg if purchased_kg > 0 else 0.0
        stock_bags_raw = stock_initial + purchased - consumed
        stock_kg = max(stock_initial * default_bag_weight_kg + purchased_kg - consumed_kg, 0)
        if stock_bags_raw < 0:
            _LOGGER.warning(
                "Stock incoherent pour la saison %s : %.2f sac(s) manquant(s)",
                season, -stock_bags_raw,
            )
        return {
            "purchased_bags": purchased,
            "consumed_bags": consumed,
            "stock_bags": max(stock_bags_raw, 0),
            "stock_bags_raw": round(stock_bags_raw, 2),
            "stock_initial_bags": stock_initial,
            "stock_initial_value_eur": round(stock_initial_value, 2),
            "avg_price_per_bag": round(avg_price_per_bag, 4),
            "avg_price_per_kg": round(avg_price_per_kg, 6),
            "stock_value_eur": round(max(stock_bags_raw, 0) * avg_price_per_bag, 2),
            "spent_eur": round(spent, 2),
            "days_logged": days,
            "consumed_kg": round(consumed_kg, 2),
            "purchased_kg": round(purchased_kg, 2),
            "stock_kg": round(stock_kg, 2),
            "consumed_kwh": round(consumed_kwh, 2),
        }

    def last_entry(self, season: str) -> dict[str, Any] | None:
        entries = self._data.get("seasons", {}).get(season, {}).get("entries", [])
        return entries[-1] if entries else None

    def entries(self, season: str) -> list[dict[str, Any]]:
        return list(self._data.get("seasons", {}).get(season, {}).get("entries", []))

    def seasons(self) -> list[str]:
        return sorted(self._data.get("seasons", {}).keys())
