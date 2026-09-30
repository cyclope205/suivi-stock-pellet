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
        "\ufeff;septembre;octobre;Saison 2024-2025\n"
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
