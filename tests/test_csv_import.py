import pytest

from custom_components.suivi_stock_pellet.csv_import import CsvImportError, parse_csv_history


def test_parse_excel_style_french_history():
    csv_text = """;septembre;octobre;novembre;décembre;janvier;février;mars;avril;mai;juin;Saison 2024-2025
1;1;0;0;0;0;0;0;0;0;0;0
2;2;0;0;0;0;0;0;0;0;0;0
3;0;1;0;0;0;0;0;0;0;0;0
31;0;0;0;0;1;0;0;0;0;0;0

Total sacs;3;1;0;0;1;0;0;0;0;0
Achats granules
Qté;Date;Prix;Coût du sac
33;23/03/2024;152,72 €;4,627878788
122;13/05/2024;620,00 €;5,081967213
"""
    result = parse_csv_history(csv_text)

    assert result["season"] == "2024-2025"
    assert result["consumption_bags"] == 5
    assert result["purchase_bags"] == 155
    assert result["purchase_count"] == 2
    assert len(result["entries"]) == 6

    purchases = [e for e in result["entries"] if e["type"] == "purchase"]
    assert purchases[0]["date"] == "2024-03-23"
    assert purchases[0]["price_eur"] == pytest.approx(152.72)
    assert all(e["season"] == "2024-2025" for e in result["entries"])


def test_legacy_monthly_history_uses_configured_season_start_month():
    csv_text = """;mars;avril;février;Saison 2024-2025
1;1;2;3;0
"""
    result = parse_csv_history(csv_text, season_start_month=3)

    dates = {entry["date"] for entry in result["entries"]}
    assert dates == {"2024-03-01", "2024-04-01", "2025-02-01"}


def test_parse_accepts_utf8_bom():
    result = parse_csv_history(
        "﻿;septembre;octobre;Saison 2024-2025\n"
        "1;1;2;0\n"
    )
    assert result["season"] == "2024-2025"
    assert result["consumption_bags"] == 3


def test_invalid_csv_has_no_silent_empty_import():
    with pytest.raises(CsvImportError):
        parse_csv_history("ceci n'est pas un historique de granulés")


def test_event_log_accepts_generic_quantity_column():
    csv_text = """Date;Type d'événement;Quantité;Prix total
2024-10-15;Consommation;2;
2024-10-20;Achat;10;65,00 €
"""
    result = parse_csv_history(csv_text)

    assert result["consumption_bags"] == 2
    assert result["purchase_bags"] == 10
    assert result["purchase_count"] == 1
    assert result["entries"][1]["price_eur"] == pytest.approx(65.0)


def test_csv_rejects_non_finite_quantity():
    with pytest.raises(CsvImportError):
        parse_csv_history(";septembre;octobre;Saison 2024-2025\n1;nan;0;0\n")


def test_csv_rejects_negative_purchase_price():
    csv_text = """Date;Type d'événement;Quantité;Prix total
2024-10-20;Achat;10;-65,00 €
"""
    with pytest.raises(CsvImportError):
        parse_csv_history(csv_text)


def test_legacy_achat_skips_non_positive_quantity():
    csv_text = """;septembre;octobre;Saison 2024-2025
1;1;0;0
Achats granules
Qté;Date;Prix;Coût du sac
0;23/03/2024;152,72 €;4,627878788
10;24/03/2024;50,00 €;5,00
"""
    result = parse_csv_history(csv_text)

    assert result["purchase_count"] == 1
    assert result["purchase_bags"] == 10


def test_legacy_achat_rejects_negative_price():
    csv_text = """;septembre;octobre;Saison 2024-2025
1;1;0;0
Achats granules
Qté;Date;Prix;Coût du sac
33;23/03/2024;-152,72 €;4,627878788
"""
    with pytest.raises(CsvImportError):
        parse_csv_history(csv_text)


def test_event_log_accepts_bare_type_column():
    csv_text = """Date;Type;Quantité;Prix total
2024-10-15;Consommation;2;
2024-10-20;Achat;10;65,00 €
"""
    result = parse_csv_history(csv_text)

    assert result["consumption_bags"] == 2
    assert result["purchase_bags"] == 10
    assert result["purchase_count"] == 1


def test_event_log_rejects_unrelated_type_column_content():
    csv_text = """Date;Type;Quantité;Produit
2024-10-15;Granulés;20;Pellets
"""
    with pytest.raises(CsvImportError):
        parse_csv_history(csv_text)

def test_event_log_accepts_french_text_dates_mixed_with_iso():
    csv_text = """Date;Type d'événement;Quantité;Prix total
2024-10-15;Consommation;2;
18 septembre 2024;Consommation;3;
20 sept 2024;Achat;10;65,00 €
5 déc. 2024;Consommation;1;
"""
    result = parse_csv_history(csv_text)
    assert result["consumption_count"] == 3
    assert result["purchase_count"] == 1
    assert len(result["entries"]) == 4
    dates = {e["date"] for e in result["entries"]}
    assert dates == {"2024-10-15", "2024-09-18", "2024-09-20", "2024-12-05"}


def test_consumption_grid_continues_after_purchase_label_on_same_day_row():
    # The workbook places "Achats granules" in a right-hand cell on day 13.
    # Later daily rows must still be imported, not cut off at that label.
    csv_text = (
        "\tseptembre\t octobre\tSaison 2024-2025\n"
        "1\t1\t0\t\n"
        "13\t2\t0\t\t\t\t\t\t\t\tAchats granules\n"
        "14\t0\t3\t\n"
        "31\t0\t4\t\n"
        "\n"
        "Qté\tDate\tPrix\tCoût du sac\n"
        "33\t23/03/2024\t152,72 €\t4,627878788\n"
        "122\t13/05/2024\t620,00 €\t5,081967213\n"
    )
    result = parse_csv_history(csv_text)

    assert result["consumption_bags"] == 10
    assert result["purchase_bags"] == 155
    assert result["purchase_count"] == 2


def test_parses_maintenance_and_entretien_blocks():
    # Mirrors the real workbook layout: two standalone sections below the
    # monthly grid, each with its own "Type / Description | Date | Coût |
    # Note" header, holding cost entries that carry no pellet quantity.
    csv_text = (
        "\tseptembre\toctobre\tSaison 2024-2025\n"
        "1\t1\t0\t\n"
        "\n"
        "Maintenance\n"
        "Type / Description\tDate\tCoût\tNote\n"
        "Pieces\t10/01/2025\t45,00€\tRemplacement joint\n"
        "\n"
        "Entretien\n"
        "Type / Description\tDate\tCoût\tNote\n"
        "Entretien\t19/03/2024\t276,00€\tRamonage n°38934\n"
    )
    result = parse_csv_history(csv_text)

    maintenance = [e for e in result["entries"] if e["type"] == "maintenance"]
    entretien = [e for e in result["entries"] if e["type"] == "entretien"]

    assert len(maintenance) == 1
    assert maintenance[0]["date"] == "2025-01-10"
    assert maintenance[0]["price_eur"] == pytest.approx(45.0)
    assert maintenance[0]["note"] == "Remplacement joint"
    assert maintenance[0]["season"] == "2024-2025"

    assert len(entretien) == 1
    assert entretien[0]["date"] == "2024-03-19"
    assert entretien[0]["price_eur"] == pytest.approx(276.0)
    assert entretien[0]["note"] == "Ramonage n°38934"


def test_empty_maintenance_block_does_not_leak_into_entretien():
    # A "Maintenance" section with just its header and no data rows,
    # immediately followed by a populated "Entretien" section, must not
    # swallow the next section's header/title rows as bogus data (which
    # would otherwise crash trying to parse the literal word "Date" as a
    # date).
    csv_text = (
        "\tseptembre\toctobre\tSaison 2024-2025\n"
        "1\t1\t0\t\n"
        "\n"
        "Maintenance\n"
        "Type / Description\tDate\tCoût\tNote\n"
        "\n"
        "Entretien\n"
        "Type / Description\tDate\tCoût\tNote\n"
        "Entretien\t19/03/2024\t276,00€\tRamonage n°38934\n"
    )
    result = parse_csv_history(csv_text)

    assert not [e for e in result["entries"] if e["type"] == "maintenance"]
    entretien = [e for e in result["entries"] if e["type"] == "entretien"]
    assert len(entretien) == 1
    assert entretien[0]["note"] == "Ramonage n°38934"


def test_maintenance_block_rejects_negative_cost():
    csv_text = (
        "\tseptembre\toctobre\tSaison 2024-2025\n"
        "1\t1\t0\t\n"
        "\n"
        "Maintenance\n"
        "Type / Description\tDate\tCoût\tNote\n"
        "Pieces\t10/01/2025\t-45,00€\t\n"
    )
    with pytest.raises(CsvImportError):
        parse_csv_history(csv_text)


# --- rejection of multi-season "journal d'événements" files -------------
#
# A season created by an import always starts at stock_initial=0 (see
# PelletJournal._import_carry_over_values): no stock is ever carried over
# from one imported season into the next. That guarantees a given season
# imports identically whether it is alone in its own file or combined
# with other seasons in one export - but it also means a combined file
# can no longer be processed as a whole, since there would be nothing
# left to make a continuous, never-emptied stock history add up across
# the season boundary. Rather than let that surface deep into the import
# as a confusing "stock sous 0" rejection (or, worse, silently treat every
# season past the first as starting from nothing), parse_csv_history
# refuses any event-log file spanning more than one season upfront.


def test_event_log_rejects_file_spanning_multiple_seasons():
    csv_text = """Date;Type d'événement;Quantité;Prix total
2024-10-15;Achat;10;65,00 €
2025-10-20;Consommation;2;
"""
    with pytest.raises(CsvImportError, match="plusieurs saisons"):
        parse_csv_history(csv_text)


def test_event_log_multi_season_error_names_every_season_found():
    csv_text = """Date;Type d'événement;Quantité;Prix total
2024-10-15;Achat;10;65,00 €
2025-10-20;Consommation;2;
2026-10-05;Achat;5;32,50 €
"""
    with pytest.raises(CsvImportError) as excinfo:
        parse_csv_history(csv_text)
    message = str(excinfo.value)
    assert "2024-2025" in message
    assert "2025-2026" in message
    assert "2026-2027" in message


def test_event_log_single_season_still_accepted_even_with_advance_purchase():
    # A purchase dated outside the season it belongs to (an advance buy
    # for next winter, tagged via the Saison column) must not be mistaken
    # for a second season - this is the same single-season file the
    # Saison-trust fix already covers, just re-asserted against the new
    # multi-season guard to make sure it doesn't false-positive here.
    csv_text = """Saison;Date;Type;Quantite;Prix total
2024-2025;2024-10-15;Achat;10;65,00 €
2024-2025;2025-06-20;Achat;5;32,50 €
2024-2025;2025-01-05;Consommation;3;
"""
    result = parse_csv_history(csv_text)
    assert result["seasons"] == ["2024-2025"]
