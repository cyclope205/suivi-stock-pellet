"""Journal storage and computed totals for Suivi Stock Pellet.

Only raw journal entries (one per logged consumption or purchase) are
persisted. Stock, spend, and day counts are always recomputed from the
journal on read, so there is nothing that can drift out of sync.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import ENTRY_TYPE_CONSUMPTION, ENTRY_TYPE_PURCHASE, STORAGE_VERSION


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
        days = sum(1 for e in entries if e["type"] == ENTRY_TYPE_CONSUMPTION)
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
