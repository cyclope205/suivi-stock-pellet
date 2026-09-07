"""Tests for PelletJournal's business logic (journal.py).

No pytest-homeassistant-custom-component fixture is used here: CI only
installs plain homeassistant + pytest, so hass and its storage layer are
replaced with lightweight unittest.mock stand-ins, and async methods are
driven through a plain asyncio.run() wrapper rather than pytest-asyncio.
"""
from __future__ import annotations

import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.suivi_stock_pellet.journal import (
    PelletJournal,
    previous_season_key,
    season_for_date,
    season_start_date,
)


def run(coro):
    return asyncio.run(coro)


def _make_journal() -> PelletJournal:
    hass = MagicMock()
    journal = PelletJournal(hass, "test_entry")
    # Store does real file I/O in async_load/async_save - never call those
    # against a bare MagicMock hass. Seed _data directly instead and stub
    # the save so tests never touch the filesystem.
    journal._async_save = AsyncMock()
    return journal


# --- season_for_date --------------------------------------------------


def test_season_for_date_at_season_start_month():
    assert season_for_date(date(2025, 9, 1), 9) == "2025-2026"


def test_season_for_date_before_season_start_month():
    assert season_for_date(date(2025, 8, 31), 9) == "2024-2025"


def test_season_for_date_month_after_start():
    assert season_for_date(date(2026, 1, 15), 9) == "2025-2026"


def test_season_for_date_custom_start_month():
    assert season_for_date(date(2025, 3, 1), 3) == "2025-2026"
    assert season_for_date(date(2025, 2, 28), 3) == "2024-2025"


# --- totals: purchase / consumption / stock computation ---------------


def test_totals_empty_season_returns_zeros():
    journal = _make_journal()
    totals = journal.totals("2025-2026")
    assert totals["purchased_bags"] == 0
    assert totals["consumed_bags"] == 0
    assert totals["stock_bags"] == 0
    assert totals["stock_initial_bags"] == 0.0
    assert totals["spent_eur"] == 0
    assert totals["days_logged"] == 0
    assert totals["consumed_kg"] == 0
    assert totals["consumed_kwh"] == 0


def test_totals_computes_purchased_and_consumed():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01"))
    totals = journal.totals("2025-2026")
    assert totals["purchased_bags"] == 10
    assert totals["consumed_bags"] == 3
    assert totals["stock_bags"] == 7
    assert totals["spent_eur"] == 65.0


def test_totals_stock_bags_floors_at_zero_when_over_consumed():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 5, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 12, "2025-10-01"))
    totals = journal.totals("2025-2026")
    assert totals["stock_bags"] == 0


# --- snapshotted bag_weight_kg / calorific_value -----------------------


def test_totals_uses_snapshotted_bag_weight_and_calorific_value():
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "consumption", 2, "2025-10-01",
        bag_weight_kg=20.0, calorific_value=5.0,
    ))
    totals = journal.totals(
        "2025-2026", default_bag_weight_kg=15.0, default_calorific_value=4.8
    )
    assert totals["consumed_kg"] == 40.0
    assert totals["consumed_kwh"] == 200.0


def test_totals_falls_back_to_current_defaults_when_snapshot_missing():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01"))
    totals = journal.totals(
        "2025-2026", default_bag_weight_kg=15.0, default_calorific_value=4.8
    )
    assert totals["consumed_kg"] == 30.0
    assert totals["consumed_kwh"] == pytest.approx(144.0)


# --- stock carry-over between seasons (new behaviour) ------------------


def test_stock_initial_defaults_to_zero_when_never_set():
    journal = _make_journal()
    totals = journal.totals("2025-2026")
    assert totals["stock_initial_bags"] == 0.0


def test_stock_carries_over_between_seasons():
    journal = _make_journal()
    # Leave 6 bags at the end of 2025-2026 ...
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 4, "2026-01-10"))
    assert journal.totals("2025-2026")["stock_bags"] == 6

    # ... touching the next season for the first time should carry those
    # 6 bags over as its starting stock.
    run(journal.async_add_entry("2026-2027", "purchase", 8, "2026-09-10"))
    totals = journal.totals("2026-2027")
    assert totals["stock_initial_bags"] == 6
    assert totals["stock_bags"] == 14  # 6 carried + 8 purchased


def test_stock_carry_over_only_applies_once_on_first_touch():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    # First touch of 2026-2027 carries over 10.
    run(journal.async_add_entry("2026-2027", "purchase", 1, "2026-09-10"))
    assert journal.totals("2026-2027")["stock_initial_bags"] == 10

    # Adding more to 2025-2026 afterwards must not retroactively change
    # 2026-2027's already-carried stock_initial.
    run(journal.async_add_entry("2025-2026", "purchase", 100, "2025-09-06"))
    assert journal.totals("2026-2027")["stock_initial_bags"] == 10


def test_pre_existing_season_without_stock_initial_key_defaults_to_zero():
    # Simulates data stored before the carry-over feature shipped: a
    # season dict with entries but no "stock_initial" key at all. Since
    # _get_season only computes stock_initial the first time a season key
    # is created, an already-existing season must never be retroactively
    # backfilled just by being read/written again.
    journal = _make_journal()
    journal._data["seasons"]["2026-2027"] = {
        "entries": [
            {
                "type": "purchase",
                "qty_bags": 5,
                "date": "2026-09-10",
                "price_eur": None,
                "bag_weight_kg": None,
                "calorific_value": None,
            }
        ],
    }
    run(journal.async_add_entry("2025-2026", "purchase", 20, "2025-09-05"))
    totals = journal.totals("2026-2027")
    assert totals["stock_initial_bags"] == 0.0
    assert totals["stock_bags"] == 5


def test_stock_initial_plus_purchases_minus_consumption():
    journal = _make_journal()
    journal._data["seasons"]["2025-2026"] = {"entries": [], "stock_initial": 5.0}
    run(journal.async_add_entry("2025-2026", "purchase", 3, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01"))
    totals = journal.totals("2025-2026")
    assert totals["stock_initial_bags"] == 5.0
    assert totals["stock_bags"] == 6  # 5 + 3 - 2


def test_async_set_stock_initial_sets_value_and_saves():
    journal = _make_journal()
    run(journal.async_set_stock_initial("2025-2026", 12.5))
    assert journal.totals("2025-2026")["stock_initial_bags"] == 12.5
    journal._async_save.assert_awaited()


def test_carry_over_ignores_malformed_season_key():
    # _carry_over_stock must not raise on a non-standard season key - it
    # should just treat it as having nothing to carry over.
    journal = _make_journal()
    run(journal.async_add_entry("not-a-season", "purchase", 1, "2025-09-05"))
    assert journal.totals("not-a-season")["stock_initial_bags"] == 0.0


def test_totals_previews_carry_over_for_season_not_yet_created():
    # A season that has never been touched yet must still show what it
    # WOULD carry over from the previous season when read via totals() -
    # otherwise a stock-sufficiency check on its very first entry always
    # sees 0 before that season is actually created.
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    totals = journal.totals("2026-2027")
    assert totals["stock_initial_bags"] == 10
    assert totals["stock_bags"] == 10
    # Reading it must not have created/persisted the season as a side effect.
    assert "2026-2027" not in journal.seasons()


def test_totals_preview_uses_full_previous_season_not_as_of_date():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 4, "2026-06-01"))
    totals = journal.totals("2026-2027")
    assert totals["stock_initial_bags"] == 6


def test_consumption_stock_check_sees_carried_stock_before_season_exists():
    # Regression test for a real reported bug: logging the very first
    # consumption of a brand new season (before any purchase has been
    # logged in that season) was rejected as "stock insufficient" even
    # though pellets carried over from the previous season were
    # available, because the stock check read totals() for a season
    # that didn't exist in storage yet and saw stock_initial default to 0.
    journal = _make_journal()
    run(journal.async_add_entry("2022-2023", "purchase", 122, "2022-09-01", price_eur=658.80))
    available = journal.totals("2023-2024", as_of_date="2023-10-15")["stock_bags"]
    assert available == 122


# --- as_of_date chronological filter (new behaviour) -------------------


def test_totals_as_of_date_excludes_later_entries():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01"))
    run(journal.async_add_entry("2025-2026", "consumption", 4, "2025-11-01"))

    # As of just after the first consumption, the second one (later date)
    # must not count yet - this is the fix for antedated-consumption
    # stock checks using totals computed from the whole season.
    totals = journal.totals("2025-2026", as_of_date="2025-10-15")
    assert totals["consumed_bags"] == 3
    assert totals["stock_bags"] == 7


def test_totals_as_of_date_includes_entries_on_exact_date():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01"))
    totals = journal.totals("2025-2026", as_of_date="2025-10-01")
    assert totals["consumed_bags"] == 3


def test_totals_without_as_of_date_includes_all_entries():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2099-01-01"))
    totals = journal.totals("2025-2026")
    assert totals["consumed_bags"] == 3


# --- async_edit_entry ---------------------------------------------------


def test_async_edit_entry_updates_qty_and_price():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    edited = run(journal.async_edit_entry("2025-2026", 0, qty_bags=12, price_eur=70.0))
    assert edited["qty_bags"] == 12
    assert edited["price_eur"] == 70.0


def test_async_edit_entry_ignores_price_for_consumption_entries():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01"))
    edited = run(journal.async_edit_entry("2025-2026", 0, price_eur=99.0))
    assert edited.get("price_eur") is None


def test_async_edit_entry_updates_date():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    edited = run(journal.async_edit_entry("2025-2026", 0, entry_date="2025-09-10"))
    assert edited["date"] == "2025-09-10"


def test_async_edit_entry_moves_entry_to_new_season():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_edit_entry(
        "2025-2026", 0, entry_date="2026-09-10", new_season="2026-2027"
    ))
    assert journal.entries("2025-2026") == []
    moved = journal.entries("2026-2027")
    assert len(moved) == 1
    assert moved[0]["date"] == "2026-09-10"


def test_async_edit_entry_out_of_range_index_returns_none():
    journal = _make_journal()
    result = run(journal.async_edit_entry("2025-2026", 5, qty_bags=1))
    assert result is None


def test_async_edit_entry_negative_index_returns_none():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    result = run(journal.async_edit_entry("2025-2026", -1, qty_bags=1))
    assert result is None


# --- async_delete_entry --------------------------------------------------


def test_async_delete_entry_removes_and_returns_entry():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    removed = run(journal.async_delete_entry("2025-2026", 0))
    assert removed["qty_bags"] == 10
    assert journal.entries("2025-2026") == []


def test_async_delete_entry_out_of_range_returns_none():
    journal = _make_journal()
    result = run(journal.async_delete_entry("2025-2026", 0))
    assert result is None


# --- async_undo_last -------------------------------------------------------


def test_async_undo_last_removes_most_recent_entry():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "purchase", 5, "2025-09-06"))
    removed = run(journal.async_undo_last("2025-2026"))
    assert removed["qty_bags"] == 5
    remaining = journal.entries("2025-2026")
    assert len(remaining) == 1
    assert remaining[0]["qty_bags"] == 10


def test_async_undo_last_on_empty_season_returns_none():
    journal = _make_journal()
    result = run(journal.async_undo_last("2025-2026"))
    assert result is None


# --- misc accessors ---------------------------------------------------------


def test_last_entry_returns_most_recent():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05"))
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01"))
    last = journal.last_entry("2025-2026")
    assert last["type"] == "consumption"


def test_last_entry_none_for_empty_season():
    journal = _make_journal()
    assert journal.last_entry("2025-2026") is None


def test_seasons_returns_sorted_season_keys():
    journal = _make_journal()
    run(journal.async_add_entry("2026-2027", "purchase", 1, "2026-09-05"))
    run(journal.async_add_entry("2024-2025", "purchase", 1, "2024-09-05"))
    assert journal.seasons() == ["2024-2025", "2026-2027"]


# --- previous_season_key / season_start_date ---------------------------


def test_previous_season_key_basic():
    assert previous_season_key("2025-2026") == "2024-2025"


def test_previous_season_key_year_boundary():
    assert previous_season_key("2026-2027") == "2025-2026"


def test_season_start_date_default_month():
    assert season_start_date("2025-2026", 9) == date(2025, 9, 1)


def test_season_start_date_custom_month():
    assert season_start_date("2025-2026", 3) == date(2025, 3, 1)


def test_stock_initial_unfreezes_when_season_emptied_back_out():
    # A season that was touched (an entry added, freezing its carried-over
    # stock_initial) and then had that entry fully removed again must NOT
    # keep serving the stale frozen value forever - once it is back to
    # zero entries (and was never manually corrected), it should re-derive
    # its carry-over live from whatever the previous season looks like now.
    journal = _make_journal()
    run(journal.async_add_entry("2021-2022", "purchase", 122, "2022-06-07"))
    run(journal.async_add_entry("2022-2023", "consumption", 1, "2022-10-01"))
    assert journal.totals("2022-2023")["stock_initial_bags"] == 122
    run(journal.async_delete_entry("2022-2023", 0))
    run(journal.async_delete_entry("2021-2022", 0))
    assert journal.totals("2021-2022")["stock_bags"] == 0
    assert journal.totals("2022-2023")["stock_initial_bags"] == 0


def test_stock_initial_manual_override_survives_even_when_emptied():
    journal = _make_journal()
    run(journal.async_add_entry("2021-2022", "purchase", 122, "2022-06-07"))
    run(journal.async_add_entry("2022-2023", "consumption", 1, "2022-10-01"))
    run(journal.async_delete_entry("2022-2023", 0))
    run(journal.async_set_stock_initial("2022-2023", 50))
    run(journal.async_delete_entry("2021-2022", 0))
    # Manual override must stick even though the season has zero entries
    # and the previous season's stock later changed.
    assert journal.totals("2022-2023")["stock_initial_bags"] == 50
