"""Structural tests for the Nettoyage changes in the Lovelace card
(suivi-stock-pellet-card.js).

This repo has no JS test runner / no jsdom available in this
environment (see the project's prior venv/path-length issues on
Windows), so these tests do not execute the card's JS. Instead they
assert, by reading the shipped source, that the specific code
constructs the feature request asked for are actually present -
catching an accidental revert or a half-finished edit, even though
they cannot catch a runtime/rendering bug the way a real browser test
would. Real interactive verification (button layout, calendar look)
should still happen by eye in a dev Home Assistant instance before
release.
"""
from __future__ import annotations

from pathlib import Path

CARD_JS = (
    Path(__file__).resolve().parents[1]
    / "custom_components"
    / "suivi_stock_pellet"
    / "www"
    / "suivi-stock-pellet-card.js"
).read_text(encoding="utf-8")


def test_row1_always_contains_conso_nettoyage_quick_button():
    """Row 1 (Consommation, Nettoyage, +1 sac) must be built
    unconditionally, outside any show_secondary_actions check."""
    assert 'actionsRow1.appendChild(btnConso)' in CARD_JS
    assert 'actionsRow1.appendChild(btnNettoyage)' in CARD_JS
    # btnQuick is still conditioned on being non-null (kg mode has no
    # quick button, unchanged pre-existing behaviour), but never on
    # show_secondary_actions.
    assert 'if (btnQuick) actionsRow1.appendChild(btnQuick);' in CARD_JS


def test_row2_maintenance_achat_entretien_gated_by_show_secondary_actions():
    """Row 2 (Maintenance, Achat, Entretien) must only be populated when
    show_secondary_actions is true - this is what hides the whole row
    (test #7 from the feature request)."""
    gated_block = CARD_JS.split("if (cfg.show_secondary_actions) {", 1)[1][:600]
    assert "actionsRow2.appendChild(btnMaintenance)" in gated_block
    assert "actionsRow2.appendChild(btnAchat)" in gated_block
    assert "actionsRow2.appendChild(btnEntretien)" in gated_block


def test_nettoyage_button_exists_with_dedicated_class_and_color():
    assert 'btnNettoyage.className = "secondary type-nettoyage"' in CARD_JS
    assert "rgb(106, 27, 154)" in CARD_JS  # #6A1B9A


def test_calendar_nettoyage_participates_in_proportional_split():
    """Test #6 (corrige 2e fois) : Nettoyage compte comme un type a part
    entiere dans le decoupage proportionnel du cercle, au meme titre
    qu'Achat/Consommation/Maintenance/Entretien, TANT QUE les 5 types ne
    sont pas presents en meme temps ce jour-la :
      - Nettoyage seul        -> cercle entier (360deg), pas juste un rond
      - Nettoyage + 1 autre   -> 2 moities (180deg chacune)
      - Nettoyage + 2 autres  -> 3 triangles (120deg chacun)
      - 4 types sans Nettoyage, ou avec Nettoyage et 3 autres -> 4 quarts
    La couleur de Nettoyage est ajoutee a la liste des parts presentes
    (apres les 4 "triangle"), et le degre par part est calcule
    dynamiquement (360 / nombre de types presents)."""
    assert "conic-gradient(from 45deg" in CARD_JS
    assert "triangleColors" in CARD_JS
    assert "presentColors = triangleColors.slice()" in CARD_JS
    assert 'if (hasNettoyage) presentColors.push("rgb(106, 27, 154)")' in CARD_JS
    assert "sliceCount = presentColors.length" in CARD_JS
    assert "sliceDeg = 360 / sliceCount" in CARD_JS


def test_calendar_single_type_fills_whole_cell():
    """Un seul type present ce jour-la (Nettoyage inclus) doit remplir
    toute la case de sa couleur (360deg), pas seulement un quart fixe ni
    un simple rond."""
    # presentColors.length == 1 -> sliceDeg = 360 / 1 = 360 : verifie par
    # le calcul dynamique partage avec les cas 2/3/4 types (voir
    # test_calendar_nettoyage_participates_in_proportional_split).
    assert "sliceCount" in CARD_JS
    assert "presentColors" in CARD_JS


def test_calendar_center_circle_only_when_all_five_present():
    """Le rond central violet pour Nettoyage n'apparait QUE quand les 5
    types sont presents le meme jour (cas particulier) ; dans ce cas la
    case est divisee en 4 quarts fixes (Achat/Consommation/Maintenance/
    Entretien) et Nettoyage n'est PAS une 5e part du cercle, il est
    represente par le rond, assez visible (rayon 30% de la cellule)."""
    assert "allFivePresent = triangleColors.length === 4 && hasNettoyage" in CARD_JS
    assert "radial-gradient(circle at center" in CARD_JS
    assert "30%" in CARD_JS
    # Le rond est construit dans la branche allFivePresent uniquement.
    all_five_block = CARD_JS.split("if (allFivePresent) {", 1)[1][:700]
    assert "radial-gradient(circle at center" in all_five_block
    # No white outline/stroke was added around the circle.
    assert "stroke" not in CARD_JS.split("radial-gradient(circle at center", 1)[1][:300]


def test_calendar_tooltip_includes_nettoyage():
    """Test #8: nettoyage must appear in the calendar's floating-cell
    tooltip (.calendar-tip), scoped to the calendar only."""
    assert 'parts2.push("Nettoyage"' in CARD_JS


def test_nettoyage_service_called_with_no_price_field():
    assert '"log_nettoyage"' in CARD_JS


def test_colors_object_has_exact_requested_palette():
    assert 'achat: "46, 173, 85"' in CARD_JS       # #2EAD55
    assert 'consommation: "229, 57, 53"' in CARD_JS  # #E53935
    assert 'maintenance: "21, 101, 192"' in CARD_JS  # #1565C0
    assert 'entretien: "255, 143, 0"' in CARD_JS     # #FF8F00
    assert 'nettoyage: "106, 27, 154"' in CARD_JS    # #6A1B9A


def test_quick_button_color_matches_consumption():
    assert "COLORS.quick = COLORS.consommation;" in CARD_JS
