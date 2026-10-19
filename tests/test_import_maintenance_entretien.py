"""Regression tests for importing maintenance/entretien entries.

async_import_entries() used to only accept purchase/consumption items
(anything else raised "Type de saisie invalide"), because the CSV import
format it was built for never produced maintenance/entretien rows. The
grid-format parser (csv_import.py) now extracts those rows from the
workbook's "Maintenance" and "Entretien" sections, so the journal must
accept them too - with no quantity, just a date, a cost and an optional
note, mirroring async_add_entry's equivalent branch.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.suivi_stock_pellet.journal import PelletJournal


def run(coro):
    return asyncio.run(coro)


def _make_journal() -> PelletJournal:
    hass = MagicMock()
    journal = PelletJournal(hass, "test_entry")
    journal._async_save = AsyncMock()
    return journal


def test_import_accepts_maintenance_and_entretien_entries():
    journal = _make_journal()
    run(
        journal.async_import_entries(
            [
                {
                    "season": "2024-2025",
                    "type": "maintenance",
                    "date": "2025-01-10",
                    "price_eur": 45.0,
                    "note": "Remplacement joint",
                },
                {
                    "season": "2024-2025",
                    "type": "entretien",
                    "date": "2024-03-19",
                    "price_eur": 276.0,
                    "note": "Ramonage n°38934",
                },
            ]
        )
    )

    entries = journal.entries("2024-2025")
    assert len(entries) == 2

    maintenance = next(e for e in entries if e["type"] == "maintenance")
    assert maintenance["price_eur"] == pytest.approx(45.0)
    assert maintenance["note"] == "Remplacement joint"
    assert "qty_bags" not in maintenance
    assert "qty_kg" not in maintenance

    entretien = next(e for e in entries if e["type"] == "entretien")
    assert entretien["price_eur"] == pytest.approx(276.0)
    assert entretien["note"] == "Ramonage n°38934"

    totals = journal.totals("2024-2025")
    assert totals["maintenance_eur"] == pytest.approx(45.0)
    assert totals["entretien_eur"] == pytest.approx(276.0)
    # Maintenance/entretien never participate in the pellet stock math.
    assert totals["purchased_bags"] == 0
    assert totals["consumed_bags"] == 0


def test_import_rejects_negative_maintenance_cost_and_rolls_back():
    journal = _make_journal()
    with pytest.raises(ValueError):
        run(
            journal.async_import_entries(
                [
                    {
                        "season": "2024-2025",
                        "type": "entretien",
                        "date": "2024-03-19",
                        "price_eur": 276.0,
                        "note": "Ramonage n°38934",
                    },
                    {
                        "season": "2024-2025",
                        "type": "maintenance",
                        "date": "2025-01-10",
                        "price_eur": -45.0,
                        "note": None,
                    },
                ]
            )
        )

    # The whole batch is atomic: the valid entretien row from the same
    # import must not have been kept despite the later row failing.
    assert journal.entries("2024-2025") == []


def test_import_maintenance_alongside_purchase_and_consumption():
    journal = _make_journal()
    run(
        journal.async_import_entries(
            [
                {
                    "season": "2024-2025",
                    "type": "purchase",
                    "unit": "bag",
                    "qty_bags": 66,
                    "date": "2023-02-16",
                    "price_eur": 640.20,
                    "bag_weight_kg": None,
                    "calorific_value": None,
                },
                {
                    "season": "2024-2025",
                    "type": "consumption",
                    "unit": "bag",
                    "qty_bags": 10,
                    "date": "2023-03-01",
                    "price_eur": None,
                    "bag_weight_kg": None,
                    "calorific_value": None,
                },
                {
                    "season": "2024-2025",
                    "type": "entretien",
                    "date": "2024-03-19",
                    "price_eur": 276.0,
                    "note": "Ramonage n°38934",
                },
            ]
        )
    )

    totals = journal.totals("2024-2025")
    assert totals["purchased_bags"] == 66
    assert totals["consumed_bags"] == 10
    assert totals["entretien_eur"] == pytest.approx(276.0)
