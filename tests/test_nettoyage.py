"""Tests for the "Nettoyage" entry type (5th event type alongside
achat/consommation/maintenance/entretien).

Nettoyage is a pure dated event (date + optional note) that must NEVER
carry a cost or a pellet quantity, and must NEVER influence stock,
consumption or any cost total/chart - unlike maintenance/entretien,
which always require a cost. These tests cover the 9 scenarios asked
for in the feature request:

  1. recording a nettoyage (service + storage)
  2. restoration after restart (reload of the Store)
  3. no impact on stock
  4. no impact on consumption/cost calculations
  5. multiple event types the same day
  6. 4 triangles + center circle calendar rendering (structural, no JS
     runtime available in this test suite - see test_card_js_nettoyage.py)
  7. show_secondary_actions hides row 2 only (structural)
  8. nettoyage shown in the calendar's floating cells (structural)
  9. compatibility with old data / old CSV files (no "nettoyage" type)

Mirrors the existing patterns in test_journal.py (manual asyncio.run(),
Store I/O stubbed) and test_import_maintenance_entretien.py.
"""
from __future__ import annotations

import asyncio
from copy import deepcopy
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.suivi_stock_pellet.csv_import import parse_csv_history
from custom_components.suivi_stock_pellet.journal import PelletJournal


def run(coro):
    return asyncio.run(coro)


def _make_journal() -> PelletJournal:
    hass = MagicMock()
    journal = PelletJournal(hass, "test_entry")
    journal._async_save = AsyncMock()
    return journal


# --- 1. Recording a nettoyage (journal level) --------------------------


def test_add_nettoyage_entry_requires_no_price():
    journal = _make_journal()
    # Unlike maintenance/entretien, omitting price_eur must NOT raise.
    run(journal.async_add_entry(
        "2025-2026", "nettoyage", None, "2025-10-05", note="Vidage cendrier"
    ))
    entries = journal.entries("2025-2026")
    assert len(entries) == 1
    assert entries[0]["type"] == "nettoyage"
    assert entries[0]["date"] == "2025-10-05"
    assert entries[0]["note"] == "Vidage cendrier"
    # No cost field at all - not even a null placeholder - and no quantity.
    assert "price_eur" not in entries[0]
    assert "qty_bags" not in entries[0]
    assert "qty_kg" not in entries[0]


def test_add_nettoyage_entry_note_is_optional():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "nettoyage", None, "2025-10-05"))
    entries = journal.entries("2025-2026")
    assert entries[0]["note"] is None


@pytest.mark.asyncio
async def test_log_nettoyage_service_handler_stores_entry():
    """End-to-end through the registered service handler, same pattern as
    test_service_handlers.py."""
    from types import SimpleNamespace
    from unittest.mock import patch
    from homeassistant.core import CoreState

    from custom_components.suivi_stock_pellet import (
        DOMAIN,
        SERVICE_LOG_NETTOYAGE,
        async_setup_entry,
    )

    class FakeServices:
        def __init__(self):
            self.registered = {}

        def async_register(self, domain, service, handler, schema=None, supports_response=None):
            self.registered[(domain, service)] = handler

        def has_service(self, domain, service):
            return (domain, service) in self.registered

        def async_remove(self, domain, service):
            self.registered.pop((domain, service), None)

    services = FakeServices()
    hass = SimpleNamespace(
        data={},
        state=CoreState.running,
        services=services,
        config=SimpleNamespace(config_dir="/tmp"),
        config_entries=SimpleNamespace(
            async_forward_entry_setups=AsyncMock(),
            async_unload_platforms=AsyncMock(return_value=True),
            async_reload=AsyncMock(),
        ),
        http=MagicMock(),
    )
    entry = SimpleNamespace(
        entry_id="test-entry",
        title="Granules",
        options={},
        add_update_listener=MagicMock(return_value=lambda: None),
        async_on_unload=lambda callback: None,
    )
    patch("custom_components.suivi_stock_pellet.async_dispatcher_send").start()
    journal = PelletJournal(hass, entry.entry_id)
    journal.async_load = AsyncMock()
    journal.async_prune_empty_seasons = AsyncMock()
    journal._async_save = AsyncMock()

    with (
        patch("custom_components.suivi_stock_pellet.PelletJournal", return_value=journal),
        patch("custom_components.suivi_stock_pellet.async_register_ws_api"),
        patch("custom_components.suivi_stock_pellet._async_register_card", new=AsyncMock()),
    ):
        await async_setup_entry(hass, entry)

    handler = services.registered[(DOMAIN, SERVICE_LOG_NETTOYAGE)]
    call = MagicMock()
    call.data = {"season": "2025-2026", "note": "Dépoussiérage"}
    await handler(call)

    entries = journal.entries("2025-2026")
    assert len(entries) == 1
    assert entries[0]["type"] == "nettoyage"
    assert entries[0]["note"] == "Dépoussiérage"


# --- 2. Restoration after restart ---------------------------------------


def test_nettoyage_survives_simulated_restart():
    """Simulate a HA restart: the journal's _data dict is exactly what the
    HA Store persists to disk as JSON, so reloading a fresh PelletJournal
    with a deep copy of that dict is equivalent to async_load() reading it
    back - Store I/O itself is intentionally not exercised here (see
    test_journal.py's module docstring: CI only has plain pytest, no real
    HA storage fixture available)."""
    journal = _make_journal()
    run(journal.async_add_entry(
        "2025-2026", "nettoyage", None, "2025-11-02", note="Ramonage conduit"
    ))

    # Simulate the restart: a brand new journal instance "loads" the same
    # serialized state the first one would have written to disk.
    restarted = PelletJournal(MagicMock(), "test_entry")
    restarted._data = deepcopy(journal._data)

    entries = restarted.entries("2025-2026")
    assert len(entries) == 1
    assert entries[0]["type"] == "nettoyage"
    assert entries[0]["note"] == "Ramonage conduit"
    assert entries[0]["date"] == "2025-11-02"


# --- 3. No impact on stock -----------------------------------------------


def test_nettoyage_never_affects_stock():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "consumption", 3, "2025-10-01"))

    totals_before = journal.totals("2025-2026")

    run(journal.async_add_entry("2025-2026", "nettoyage", None, "2025-10-05", note="Vidage"))
    run(journal.async_add_entry("2025-2026", "nettoyage", None, "2025-11-05", note="Dépoussiérage"))

    totals_after = journal.totals("2025-2026")

    assert totals_after["stock_bags"] == totals_before["stock_bags"]
    assert totals_after["stock_kg"] == totals_before["stock_kg"]
    assert totals_after["purchased_bags"] == totals_before["purchased_bags"]
    assert totals_after["consumed_bags"] == totals_before["consumed_bags"]


def test_nettoyage_does_not_block_consumption_against_stock():
    """A season whose only entries are nettoyage events has zero stock -
    logging a nettoyage must never count as "stock available", so a
    subsequent consumption is still validated purely against purchases."""
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "nettoyage", None, "2025-09-10"))
    totals = journal.totals("2025-2026")
    assert totals["stock_bags"] == 0
    assert totals["stock_kg"] == 0


# --- 4. No impact on consumption/cost calculations ------------------------


def test_nettoyage_never_affects_cost_totals():
    journal = _make_journal()
    run(journal.async_add_entry("2025-2026", "purchase", 10, "2025-09-05", price_eur=65.0))
    run(journal.async_add_entry("2025-2026", "maintenance", None, "2025-10-01", price_eur=50.0))
    run(journal.async_add_entry("2025-2026", "entretien", None, "2025-10-02", price_eur=30.0))

    totals_before = journal.totals("2025-2026")

    run(journal.async_add_entry("2025-2026", "nettoyage", None, "2025-10-05", note="Vidage"))

    totals_after = journal.totals("2025-2026")

    assert totals_after["spent_eur"] == totals_before["spent_eur"]
    assert totals_after["maintenance_eur"] == totals_before["maintenance_eur"]
    assert totals_after["entretien_eur"] == totals_before["entretien_eur"]
    assert totals_after["avg_price_per_bag"] == totals_before["avg_price_per_bag"]
    assert totals_after["avg_price_per_kg"] == totals_before["avg_price_per_kg"]
    # totals() has no "nettoyage_eur" key at all: nettoyage is not a cost
    # category, unlike maintenance_eur/entretien_eur.
    assert "nettoyage_eur" not in totals_after


# --- 5. Multiple event types the same day ---------------------------------


def test_multiple_event_types_same_day_all_recorded_independently():
    journal = _make_journal()
    same_day = "2025-11-15"
    run(journal.async_add_entry("2025-2026", "purchase", 5, same_day, price_eur=32.5))
    run(journal.async_add_entry("2025-2026", "consumption", 1, same_day))
    run(journal.async_add_entry("2025-2026", "maintenance", None, same_day, price_eur=40.0))
    run(journal.async_add_entry("2025-2026", "entretien", None, same_day, price_eur=20.0))
    run(journal.async_add_entry("2025-2026", "nettoyage", None, same_day, note="Grand nettoyage"))

    entries = journal.entries("2025-2026")
    assert len(entries) == 5
    types_this_day = sorted(e["type"] for e in entries if e["date"] == same_day)
    assert types_this_day == [
        "consumption", "entretien", "maintenance", "nettoyage", "purchase"
    ]
    totals = journal.totals("2025-2026")
    assert totals["purchased_bags"] == 5
    assert totals["consumed_bags"] == 1
    assert totals["maintenance_eur"] == pytest.approx(40.0)
    assert totals["entretien_eur"] == pytest.approx(20.0)


# --- 7. CSV import: nettoyage recognised, no cost required -----------------


def test_csv_event_log_parses_nettoyage_without_cost_column():
    csv_text = (
        "Date;Type d'événement;Quantité;Prix total;Note\n"
        "2025-10-05;Nettoyage;;;Vidage cendrier\n"
        "2025-10-20;Achat;10;65,00 €;\n"
    )
    result = parse_csv_history(csv_text)
    nettoyage_entries = [e for e in result["entries"] if e["type"] == "nettoyage"]
    assert len(nettoyage_entries) == 1
    assert nettoyage_entries[0]["date"] == "2025-10-05"
    assert nettoyage_entries[0]["note"] == "Vidage cendrier"
    assert "price_eur" not in nettoyage_entries[0]
    assert result.get("nettoyage_count") == 1


def test_journal_import_accepts_nettoyage_entries():
    journal = _make_journal()
    run(
        journal.async_import_entries(
            [
                {
                    "season": "2024-2025",
                    "type": "nettoyage",
                    "date": "2024-10-05",
                    "note": "Vidage cendrier",
                },
            ]
        )
    )
    entries = journal.entries("2024-2025")
    assert len(entries) == 1
    assert entries[0]["type"] == "nettoyage"
    assert "price_eur" not in entries[0]
    totals = journal.totals("2024-2025")
    assert totals["purchased_bags"] == 0
    assert totals["consumed_bags"] == 0


# --- 9. Compatibility with old data / old CSV files -----------------------


def test_old_csv_without_nettoyage_section_imports_identically():
    """A pre-existing CSV with no "nettoyage" anywhere must behave exactly
    as before this feature: same counts, no nettoyage entries conjured up."""
    csv_text = """;septembre;octobre;novembre;décembre;janvier;février;mars;avril;mai;juin;Saison 2024-2025
1;1;0;0;0;0;0;0;0;0;0;0
2;2;0;0;0;0;0;0;0;0;0;0
3;0;1;0;0;0;0;0;0;0;0;0

Total sacs;3;1;0;0;0;0;0;0;0;0
Achats granules
Qté;Date;Prix;Coût du sac
33;23/03/2024;152,72 €;4,627878788
"""
    result = parse_csv_history(csv_text)
    assert result["season"] == "2024-2025"
    assert all(e["type"] != "nettoyage" for e in result["entries"])
    assert result.get("nettoyage_count", 0) == 0


def test_old_stored_entries_without_nettoyage_field_are_unaffected():
    """A journal that predates this feature has no "nettoyage" entries in
    storage at all - totals() must compute exactly as before for such a
    season (regression guard, not a nettoyage-specific assertion)."""
    journal = _make_journal()
    journal._data = {
        "seasons": {
            "2023-2024": {
                "entries": [
                    {"type": "purchase", "unit": "bag", "qty_bags": 20.0, "date": "2023-09-10", "price_eur": 130.0, "bag_weight_kg": None, "calorific_value": None},
                    {"type": "consumption", "unit": "bag", "qty_bags": 5.0, "date": "2023-10-01", "price_eur": None, "bag_weight_kg": None, "calorific_value": None},
                ],
                "stock_initial": 0.0,
                "stock_initial_value_eur": 0.0,
            }
        }
    }
    totals = journal.totals("2023-2024")
    assert totals["purchased_bags"] == 20.0
    assert totals["consumed_bags"] == 5.0
    assert totals["stock_bags"] == 15.0
