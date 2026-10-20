"""Regression test: real multi-season CSV import reported by a user (Scooby82).

Imports the literal "journal d'événements" CSV a user sent to the project,
byte-for-byte as they sent it, through the real parse_csv_history() +
PelletJournal.async_import_entries() pipeline - not a hand-built/shortened
fixture.

This file originally asserted that this exact CSV was accepted and that
stock correctly carried over from season 2019-2020 into season 2020-2021
(168 bags carried, ending at 246, never dropping below 45) - a fix for a
real bug this same user reported, where the import used to be rejected
with "le stock ... passerait sous 0" because each new season created
during the import started at stock_initial=0 instead of continuing the
previous season's ending stock.

That carry-over-during-import feature has since been removed entirely
(see PelletJournal._import_carry_over_values): a season created by an
import must always start at 0, so that importing a given season produces
the same result whether it is imported alone or combined with others in
one file - see the suite in test_journal.py around
test_import_entries_*_starts_each_season_at_zero. A direct, mechanical
consequence is that THIS exact CSV (which spans several seasons and
never resets its physical stock to 0 between them) can no longer be
imported as one combined file at all: parse_csv_history now refuses any
"journal d'événements" file containing more than one season, upfront,
with a clear message - rather than importing the first season fine and
failing confusingly on the second with a "stock sous 0" error (or, worse,
silently starting the second season's stock_initial at 0 and treating the
very first withdrawal of the heating season as draining from nothing).

This file keeps the real reported CSV as a regression fixture, but now
asserts the opposite of what it used to: that the multi-season combined
file is rejected, with a message naming every season it contains, so a
user splitting it into one file per season gets clear guidance instead of
a dead end.

No pytest-homeassistant-custom-component fixture is used, matching the
rest of the test suite: hass is a bare unittest.mock.MagicMock and async
methods are driven through asyncio.run() rather than pytest-asyncio.
"""
from __future__ import annotations

import re

import pytest

from custom_components.suivi_stock_pellet.csv_import import CsvImportError, parse_csv_history


# The literal CSV as sent by the reporting user (Scooby82), unmodified.
# It spans seasons 2019-2020 through 2026-2027 (season_start_month=9).
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


def test_scooby82_multi_season_import_is_now_rejected_upfront():
    """This exact file is a genuine multi-season "journal d'événements"
    export (seasons 2019-2020 through 2026-2027): since a combined
    multi-season import is no longer supported at all (each imported
    season must start at a stock of 0, and this history's physical stock
    never resets to 0 between seasons), parse_csv_history must now refuse
    it outright, rather than accept it (the old behaviour) or fail deep
    into the import with a confusing "stock sous 0" error.
    """
    with pytest.raises(CsvImportError, match="plusieurs saisons"):
        parse_csv_history(SCOOBY82_CSV)


def test_scooby82_rejection_message_names_every_season_found():
    with pytest.raises(CsvImportError) as excinfo:
        parse_csv_history(SCOOBY82_CSV)
    message = str(excinfo.value)
    # Every season this history spans must be named, so the user knows
    # exactly how many separate files to split it into.
    for season in (
        "2019-2020", "2020-2021", "2021-2022", "2022-2023",
        "2023-2024", "2024-2025", "2025-2026", "2026-2027",
    ):
        assert season in message


def test_scooby82_single_season_slice_imports_fine_once_split_out():
    # Splitting the combined export into one file per season (what the
    # rejection message asks the user to do) must work normally: a
    # single season's own rows import cleanly and start at stock 0, same
    # as any other single-season import.
    season_2019_2020_rows = "\n".join(
        line
        for line in SCOOBY82_CSV.splitlines()
        if re.match(r"^201[9]-", line) or re.match(r"^2020-0[1-6]-", line)
    )
    header = SCOOBY82_CSV.splitlines()[0]
    csv_text = header + "\n" + season_2019_2020_rows + "\n"

    result = parse_csv_history(csv_text)
    assert result["seasons"] == ["2019-2020"]
    assert result["purchase_bags"] == 195 + 65
    assert result["consumption_bags"] == 8 + 12 + 28 + 36 + 24 + 24 + 52 + 8 + 5 + 10
