"""Regression test: real multi-season CSV import reported by a user (Scooby82).

Imports the literal "journal d'événements" CSV a user sent to the project,
byte-for-byte as they sent it, through the real parse_csv_history() +
PelletJournal.async_import_entries() pipeline - not a hand-built/shortened
fixture. This complements the synthetic carry-over tests added in commit
6b74a3f (test_import_entries_multi_season_event_log_carries_over_across_seasons
and friends in test_journal.py) with an end-to-end check against an actual
reported CSV, run through the real parser as well as the real journal.

Expected figures below were computed by hand from the CSV's own "Stock
Restant (sacs)" column (a continuous running balance that never resets at
season boundaries) and cross-checked against purchased/consumed totals per
season (season_start_month defaults to 9, i.e. seasons run Sept->Aug):

- Season 2019-2020 (first season in the history, no prior season to carry
  from): purchases 195+65+130=390, consumption 222 -> ends at 0+390-222=168.
- Season 2020-2021: starts at stock_initial=168 (carried over from
  2019-2020's ending stock). Purchases 130+198=328, consumption 250 ->
  ends at 168+328-250=246. The running balance dips to exactly 45 bags on
  2021-01-31 before the next purchase on 2021-02-12 - the lowest point of
  that season - matching what Scooby82 verified by hand ("never below
  ~45").

No pytest-homeassistant-custom-component fixture is used, matching the
rest of the test suite: hass is a bare unittest.mock.MagicMock and async
methods are driven through asyncio.run() rather than pytest-asyncio.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.suivi_stock_pellet.csv_import import parse_csv_history
from custom_components.suivi_stock_pellet.journal import PelletJournal


def run(coro):
    return asyncio.run(coro)


def _make_journal() -> PelletJournal:
    hass = MagicMock()
    journal = PelletJournal(hass, "test_entry")
    # Store does real file I/O in async_load/async_save - never call those
    # against a bare MagicMock hass. Stub the save so this test never
    # touches the filesystem, matching test_journal.py's convention.
    journal._async_save = AsyncMock()
    return journal


# The literal CSV as sent by the reporting user (Scooby82), unmodified.
SCOOBY82_CSV = """Date;Type d'événement;Type de sac;Quantité (sacs);Poids (kg);Stock Restant (sacs);Prix Total (€);Prix Unitaire (€/sac);Fournisseur / Notes
2019-09-18;Achat;15 kg;195;2 925;195;1 016,93 €;5,22 €;Houdayer
2019-09-30;Consommation;15 kg;8;120;187;;;
2019-10-31;Consommation;15 kg;12;180;175;;;
2019-11-30;Consommation;15 kg;28;420;147;;;
2019-12-31;Consommation;15 kg;36;540;111;;;
2020-01-31;Consommation;15 kg;24;360;87;;;
2020-02-29;Consommation;15 kg;24;360;63;;;
2020-03-23;Achat;15 kg;65;975;128;349,05 €;5,37 €;Houdayer
2020-03-31;Consommation;15 kg;52;780;76;;;
2020-04-30;Consommation;15 kg;8;120;68;;;
2020-05-31;Consommation;15 kg;5;75;63;;;
2020-06-30;Consommation;15 kg;10;150;53;;;
2020-08-24;Achat;15 kg;130;1 950;183;677,95 €;5,22 €;Houdayer
2020-08-31;Consommation;15 kg;15;225;168;;;
2020-09-30;Consommation;15 kg;5;75;163;;;
2020-10-31;Consommation;15 kg;11;165;152;;;
2020-11-30;Consommation;15 kg;19;285;133;;;
2020-12-31;Consommation;15 kg;30;450;103;;;
2021-01-31;Consommation;15 kg;58;870;45;;;
2021-02-12;Achat;15 kg;130;1 950;175;677,95 €;5,22 €;Houdayer
2021-02-28;Consommation;15 kg;39;585;136;;;
2021-03-31;Consommation;15 kg;31;465;105;;;
2021-04-30;Consommation;15 kg;32;480;73;;;
2021-05-31;Consommation;15 kg;11;165;62;;;
2021-06-30;Consommation;15 kg;6;90;56;;;
2021-08-18;Achat;15 kg;198;2 970;254;950,40 €;4,80 €;La Bûche Forestière
2021-08-31;Consommation;15 kg;8;120;246;;;
2021-09-30;Consommation;15 kg;10;150;236;;;
2021-10-31;Consommation;15 kg;10;150;226;;;
2021-11-30;Consommation;15 kg;33;495;193;;;
2021-12-31;Consommation;15 kg;34;510;159;;;
2022-01-31;Consommation;15 kg;51;765;108;;;
2022-02-28;Consommation;15 kg;30;450;78;;;
2022-03-31;Consommation;15 kg;30;450;48;;;
2022-04-30;Consommation;15 kg;20;300;28;;;
2022-05-31;Consommation;15 kg;5;75;23;;;
2022-06-30;Consommation;15 kg;2;30;21;;;
2022-07-22;Achat;15 kg;130;1 950;151;1 116,00 €;8,58 €;Houdayer
2022-07-31;Consommation;15 kg;11;165;140;;;
2022-09-30;Consommation;15 kg;10;150;130;;;
2022-11-30;Consommation;15 kg;28;420;102;;;
2022-12-31;Consommation;15 kg;30;450;72;;;
2023-01-31;Consommation;15 kg;48;720;24;;;
2023-02-13;Achat;15 kg;65;975;89;644,00 €;9,91 €;Houdayer
2023-02-28;Consommation;15 kg;29;435;60;;;
2023-03-31;Consommation;15 kg;34;510;26;;;
2023-04-29;Achat;15 kg;20;300;46;150,00 €;7,50 €;Leroy Merlin
2023-04-30;Consommation;15 kg;20;300;26;;;
2023-05-31;Consommation;15 kg;6;90;20;;;
2023-06-30;Consommation;15 kg;8;120;12;;;
2023-07-12;Achat;15 kg;144;2 160;156;864,00 €;6,00 €;Piveteau
2023-07-31;Consommation;15 kg;12;180;144;;;
2023-09-30;Consommation;15 kg;10;150;134;;;
2023-10-31;Consommation;15 kg;6;90;128;;;
2023-11-01;Consommation;15 kg;24;360;104;;;
2023-12-31;Consommation;15 kg;32;480;72;;;
2024-01-25;Achat;15 kg;72;1 080;144;416,30 €;5,78 €;Leroy Merlin
2024-01-31;Consommation;15 kg;42;630;102;;;
2024-02-29;Consommation;15 kg;30;450;72;;;
2024-03-31;Consommation;15 kg;30;450;42;;;
2024-04-30;Consommation;15 kg;20;300;22;;;
2024-05-31;Consommation;15 kg;7;105;15;;;
2024-06-30;Consommation;15 kg;15;225;0;;;
2024-08-23;Achat;15 kg;144;2 160;144;840,80 €;5,84 €;Houdayer
2024-09-30;Consommation;15 kg;12;180;132;;;
2024-10-31;Consommation;15 kg;12;180;120;;;
2024-11-30;Consommation;15 kg;27;405;93;;;
2024-12-31;Consommation;15 kg;39;585;54;;;
2025-01-31;Consommation;15 kg;48;720;6;;;
2025-02-08;Achat;15 kg;12;180;18;52,65 €;4,39 €;Brico Dépôt
2025-02-15;Achat;15 kg;5;75;23;24,50 €;4,90 €;LaMaison.fr
2025-02-18;Achat;15 kg;72;1 080;95;459,00 €;6,38 €;Houdayer
2025-02-28;Consommation;15 kg;35;525;60;;;
2025-03-31;Consommation;15 kg;30;450;30;;;
2025-04-30;Consommation;15 kg;18;270;12;;;
2025-05-31;Consommation;15 kg;6;90;6;;;
2025-06-30;Consommation;15 kg;6;90;0;;;
2025-07-14;Achat;15 kg;5;75;5;29,95 €;5,99 €;LaMaison.fr
2025-07-24;Achat;15 kg;216;3 240;221;1 212,90 €;5,62 €;Houdayer
2025-07-31;Consommation;15 kg;5;75;216;;;
2025-08-31;Consommation;15 kg;6;90;210;;;
2025-09-30;Consommation;15 kg;6;90;204;;;
2025-10-31;Consommation;15 kg;18;270;186;;;
2025-11-30;Consommation;15 kg;21;315;165;;;
2025-12-31;Consommation;15 kg;31;465;134;;;
2026-01-04;Consommation;15 kg;22;330;112;;;
2026-01-11;Consommation;15 kg;10;150;102;;;
2026-01-18;Consommation;15 kg;6;90;96;;;
2026-01-25;Consommation;15 kg;6;90;90;;;
2026-01-31;Consommation;15 kg;6;90;84;;;
2026-02-01;Consommation;15 kg;6;90;78;;;
2026-02-08;Consommation;15 kg;6;90;72;;;
2026-02-15;Consommation;15 kg;6;90;66;;;
2026-02-22;Consommation;15 kg;9;135;57;;;
2026-03-03;Consommation;15 kg;6;90;51;;;
2026-03-13;Consommation;15 kg;6;90;45;;;
2026-03-22;Consommation;15 kg;4;60;41;;;
2026-03-23;Consommation;15 kg;6;90;35;;;
2026-04-01;Consommation;15 kg;5;75;30;;;
2026-04-11;Consommation;15 kg;12;180;18;;;
2026-05-10;Consommation;15 kg;6;90;12;;;
2026-06-06;Consommation;15 kg;6;90;6;;;
2026-07-04;Consommation;15 kg;6;90;0;;;
2026-07-21;Achat;15 kg;216;3 240;216;1 197,00 €;5,54 €;
2026-07-21;Consommation;15 kg;2;30;214;;;
2026-07-24;Consommation;15 kg;3;45;211;;;
2026-09-20;Consommation;15 kg;6;90;205;;;
TOTAUX;Achat;;1 819;27 285;;10 679,38 €;;
;Consommation;;1 614;24 210;;;;
"""


def test_scooby82_multi_season_import_is_accepted():
    """The real bug: this exact import used to raise ValueError
    ("le stock de la saison 2020-2021 passerait sous 0 à un moment de
    l'historique") before the fix in commit 8d52cda. It must now succeed
    without raising anything.
    """
    parsed = parse_csv_history(SCOOBY82_CSV)
    journal = _make_journal()

    # Must not raise.
    run(journal.async_import_entries(parsed["entries"]))


def test_scooby82_season_2019_2020_ends_at_168_bags():
    parsed = parse_csv_history(SCOOBY82_CSV)
    journal = _make_journal()
    run(journal.async_import_entries(parsed["entries"]))

    totals = journal.totals("2019-2020")
    # First season in the history: nothing to carry over from.
    assert totals["stock_initial_bags"] == 0.0
    assert totals["stock_bags"] == 168


def test_scooby82_season_2020_2021_carries_over_168_and_ends_at_246():
    parsed = parse_csv_history(SCOOBY82_CSV)
    journal = _make_journal()
    run(journal.async_import_entries(parsed["entries"]))

    totals = journal.totals("2020-2021")
    # Carried over from 2019-2020's ending stock.
    assert totals["stock_initial_bags"] == 168
    assert totals["stock_bags"] == 246


def test_scooby82_season_2020_2021_never_drops_below_45_bags():
    parsed = parse_csv_history(SCOOBY82_CSV)
    journal = _make_journal()
    run(journal.async_import_entries(parsed["entries"]))

    entries_2020_2021 = journal.entries("2020-2021")
    minimum = journal._minimum_chronological_stock("2020-2021", entries_2020_2021)
    # The real low point, reached right before the 2021-02-12 purchase.
    assert minimum == pytest.approx(45)
    assert minimum >= 45 - 1e-6
