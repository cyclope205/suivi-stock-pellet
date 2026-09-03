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

from .const import ENTRY_TYPE_CONSUMPTION, ENTRY_TYPE_PURCHASE, STORAGE_VERSION


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
        return self._data["seasons"].setdefault(season, {"entries": []})["entries"]

    async def async_add_entry(
        self,
        season: str,
        entry_type: str,
        qty_bags: float,
        entry_date: str,
        price_eur: float | None = None,
    ) -> None:
        entries = self._season_entries(season)
        entries.append(
            {
                "type": entry_type,
                "qty_bags": qty_bags,
                "date": entry_date,
                "price_eur": price_eur,
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
        await self._async_save()
        return entry

    def totals(self, season: str) -> dict[str, float]:
        entries = self._data.get("seasons", {}).get(season, {}).get("entries", [])
        purchased = sum(e["qty_bags"] for e in entries if e["type"] == ENTRY_TYPE_PURCHASE)
        consumed = sum(e["qty_bags"] for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION)
        spent = sum(
            (e.get("price_eur") or 0) for e in entries if e["type"] == ENTRY_TYPE_PURCHASE
        )
        days = _heating_days(entries)
        return {
            "purchased_bags": purchased,
            "consumed_bags": consumed,
            "stock_bags": max(purchased - consumed, 0),
            "spent_eur": round(spent, 2),
            "days_logged": days,
        }

    def last_entry(self, season: str) -> dict[str, Any] | None:
        entries = self._data.get("seasons", {}).get(season, {}).get("entries", [])
        return entries[-1] if entries else None

    def entries(self, season: str) -> list[dict[str, Any]]:
        return list(self._data.get("seasons", {}).get(season, {}).get("entries", []))

    def seasons(self) -> list[str]:
        return sorted(self._data.get("seasons", {}).keys())
