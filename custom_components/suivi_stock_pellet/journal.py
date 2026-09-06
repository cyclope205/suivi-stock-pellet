"""Journal storage and computed totals for Suivi Stock Pellet.

Only raw journal entries (one per logged consumption or purchase) are
persisted. Stock, spend, and day counts are always recomputed from the
journal on read, so there is nothing that can drift out of sync.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date
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

    def _season_entries(self, season: str) -> list[dict[str, Any]]:
        return self._get_season(season)["entries"]

    def _get_season(self, season: str) -> dict[str, Any]:
        seasons = self._data["seasons"]
        if season not in seasons:
            seasons[season] = {
                "entries": [],
                "stock_initial": self._carry_over_stock(season),
            }
        return seasons[season]

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
            year_start, year_end = (int(part) for part in season.split("-"))
        except ValueError:
            return 0.0
        previous_season = f"{year_start - 1}-{year_end - 1}"
        if previous_season not in self._data["seasons"]:
            return 0.0
        return self.totals(previous_season)["stock_bags"]

    async def async_add_entry(
        self,
        season: str,
        entry_type: str,
        qty_bags: float,
        entry_date: str,
        price_eur: float | None = None,
        bag_weight_kg: float | None = None,
        calorific_value: float | None = None,
    ) -> None:
        entries = self._season_entries(season)
        entries.append(
            {
                "type": entry_type,
                "qty_bags": qty_bags,
                "date": entry_date,
                "price_eur": price_eur,
                "bag_weight_kg": bag_weight_kg,
                "calorific_value": calorific_value,
            }
        )
        await self._async_save()

    async def async_undo_last(self, season: str) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if not entries:
            return None
        removed = entries.pop()
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
    ) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if index < 0 or index >= len(entries):
            return None
        entry = entries[index]
        if qty_bags is not None:
            entry["qty_bags"] = qty_bags
        if entry_date is not None:
            entry["date"] = entry_date
        if entry["type"] == ENTRY_TYPE_PURCHASE and price_eur is not None:
            entry["price_eur"] = price_eur
        if new_season is not None and new_season != season:
            entries.pop(index)
            self._season_entries(new_season).append(entry)
        await self._async_save()
        return entry

    async def async_delete_entry(
        self, season: str, index: int
    ) -> dict[str, Any] | None:
        entries = self._season_entries(season)
        if index < 0 or index >= len(entries):
            return None
        removed = entries.pop(index)
        await self._async_save()
        return removed

    async def async_set_stock_initial(self, season: str, value: float) -> None:
        """Manually (re)set a season's starting stock.

        Used to backfill a season that already existed before the
        stock-carry-over feature shipped, or to correct the
        auto-carried value (e.g. a manual physical stock count).
        """
        self._get_season(season)["stock_initial"] = value
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
        stock_initial = season_data.get("stock_initial", 0.0)
        purchased = sum(e["qty_bags"] for e in entries if e["type"] == ENTRY_TYPE_PURCHASE)
        consumed = sum(e["qty_bags"] for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION)
        spent = sum(
            (e.get("price_eur") or 0) for e in entries if e["type"] == ENTRY_TYPE_PURCHASE
        )
        consumed_kg = sum(
            e["qty_bags"] * (e.get("bag_weight_kg") or default_bag_weight_kg)
            for e in entries
            if e["type"] == ENTRY_TYPE_CONSUMPTION
        )
        consumed_kwh = sum(
            e["qty_bags"]
            * (e.get("bag_weight_kg") or default_bag_weight_kg)
            * (e.get("calorific_value") or default_calorific_value)
            for e in entries
            if e["type"] == ENTRY_TYPE_CONSUMPTION
        )
        days = _heating_days(entries)
        return {
            "purchased_bags": purchased,
            "consumed_bags": consumed,
            "stock_bags": max(stock_initial + purchased - consumed, 0),
            "stock_initial_bags": stock_initial,
            "spent_eur": round(spent, 2),
            "days_logged": days,
            "consumed_kg": round(consumed_kg, 2),
            "consumed_kwh": round(consumed_kwh, 2),
        }

    def last_entry(self, season: str) -> dict[str, Any] | None:
        entries = self._data.get("seasons", {}).get(season, {}).get("entries", [])
        return entries[-1] if entries else None

    def entries(self, season: str) -> list[dict[str, Any]]:
        return list(self._data.get("seasons", {}).get(season, {}).get("entries", []))

    def seasons(self) -> list[str]:
        return sorted(self._data.get("seasons", {}).keys())
