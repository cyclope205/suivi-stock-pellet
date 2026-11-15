"""Tests for the optional multi-poele tagging feature (shared stock,
per-poele consumption/maintenance/entretien filtering).

See [[project_suivi_stock_pellet_dual_poele_feature]] for the design:
stock/purchases always stay a single global figure, only consumption and
maintenance/entretien entries can optionally be tagged with a poele.
"""
from __future__ import annotations

import asyncio

from unittest.mock import AsyncMock, MagicMock

from custom_components.suivi_stock_pellet.config_flow import parse_poeles
from custom_components.suivi_stock_pellet.journal import PelletJournal


def run(coro):
    return asyncio.run(coro)


def _make_journal() -> PelletJournal:
    hass = MagicMock()
    journal = PelletJournal(hass, "test_entry")
    journal._async_save = AsyncMock()
    return journal


# --- parse_poeles (config_flow.py) --------------------------------------


def test_parse_poeles_empty_or_none_returns_empty_list():
    assert parse_poeles(None) == []
    assert parse_poeles("") == []
    assert parse_poeles("   ") == []


def test_parse_poeles_splits_and_strips():
    assert parse_poeles("Poêle salon, Poêle chambre") == ["Poêle salon", "Poêle chambre"]


def test_parse_poeles_drops_blank_entries():
    assert parse_poeles("Salon,, Chambre,") == ["Salon", "Chambre"]


def test_parse_poeles_dedupes_case_insensitively_keeping_first_spelling():
    assert parse_poeles("Salon, salon, SALON, Chambre") == ["Salon", "Chambre"]


# --- async_add_entry: poele tagging ---------------------------------------


def test_add_consumption_entry_with_poele_is_tagged():
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "consumption", 2, "2025-10-01", poele="Salon",
    ))
    entry = journal.entries("2025-2026")[0]
    assert entry["poele"] == "Salon"


def test_add_consumption_entry_without_poele_has_no_poele_key():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01"))
    entry = journal.entries("2025-2026")[0]
    assert "poele" not in entry


def test_add_purchase_entry_never_tagged_even_if_poele_passed():
    # Design invariant: stock stays a single shared quantity across every
    # poele - a purchase must never carry a poele tag, even if one is
    # accidentally passed through.
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0, poele="Salon",
    ))
    entry = journal.entries("2025-2026")[0]
    assert "poele" not in entry


def test_add_maintenance_entry_with_poele_is_tagged():
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "maintenance", None, "2025-10-01", price_eur=50.0, poele="Chambre",
    ))
    entry = journal.entries("2025-2026")[0]
    assert entry["poele"] == "Chambre"


def test_add_entretien_entry_with_poele_is_tagged():
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "entretien", None, "2025-10-01", price_eur=30.0, poele="Chambre",
    ))
    entry = journal.entries("2025-2026")[0]
    assert entry["poele"] == "Chambre"


# --- totals(): must stay global/unaffected by poele tags ------------------


def test_totals_unaffected_by_poele_tags():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01", poele="Salon"))
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-05", poele="Chambre"))
    totals = journal.totals("2025-2026")
    assert totals["purchased_bags"] == 10
    assert totals["consumed_bags"] == 5
    assert totals["stock_bags"] == 5


# --- totals_by_device: filtered consumption/maintenance only --------------


def test_totals_by_device_filters_to_matching_poele_only():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01", poele="Salon"))
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-05", poele="Chambre"))
    run(journal.async_add_entry("2025-2026", "consumption", 1, "2025-10-06"))  # untagged

    salon = journal.totals_by_device("2025-2026", "Salon")
    assert salon["consumed_bags"] == 3
    chambre = journal.totals_by_device("2025-2026", "Chambre")
    assert chambre["consumed_bags"] == 2


def test_totals_by_device_excludes_untagged_entries():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 1, "2025-10-01"))  # untagged
    totals = journal.totals_by_device("2025-2026", "Salon")
    assert totals["consumed_bags"] == 0


def test_totals_by_device_never_includes_purchase_or_stock_figures():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01", poele="Salon"))
    totals = journal.totals_by_device("2025-2026", "Salon")
    assert "purchased_bags" not in totals
    assert "stock_bags" not in totals


def test_totals_by_device_includes_maintenance_and_entretien_costs():
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "maintenance", None, "2025-10-01", price_eur=50.0, poele="Salon",
    ))
    run(journal.async_add_entry(
        "2025-2026", "entretien", None, "2025-10-02", price_eur=30.0, poele="Salon",
    ))
    totals = journal.totals_by_device("2025-2026", "Salon")
    assert totals["maintenance_eur"] == 50.0
    assert totals["entretien_eur"] == 30.0


# --- async_edit_entry: retroactive poele set / change / clear -------------


def test_edit_entry_can_set_poele_on_untagged_consumption():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01"))
    edited = run(journal.async_edit_entry("2025-2026", 0, poele="Salon"))
    assert edited["poele"] == "Salon"


def test_edit_entry_can_change_existing_poele():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01", poele="Salon"))
    edited = run(journal.async_edit_entry("2025-2026", 0, poele="Chambre"))
    assert edited["poele"] == "Chambre"


def test_edit_entry_clear_poele_removes_tag():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "consumption", 2, "2025-10-01", poele="Salon"))
    edited = run(journal.async_edit_entry("2025-2026", 0, clear_poele=True))
    assert "poele" not in edited


def test_edit_entry_never_sets_poele_on_purchase_even_if_passed():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    edited = run(journal.async_edit_entry("2025-2026", 0, poele="Salon"))
    assert "poele" not in edited


def test_edit_entry_can_set_poele_on_maintenance_entry():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "maintenance", None, "2025-10-01", price_eur=50.0))
    edited = run(journal.async_edit_entry("2025-2026", 0, poele="Chambre"))
    assert edited["poele"] == "Chambre"
