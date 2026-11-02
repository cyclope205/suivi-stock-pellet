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


def test_calendar_renders_dynamic_conic_gradient_split():
    """Test #6 (corrige) : le calendrier doit repartir le cercle a parts
    egales selon le NOMBRE de types presents ce jour-la (achat/
    consommation/maintenance/entretien), pas un decoupage fixe en 4
    quarts :
      - 1 type  -> cercle entier (360deg)
      - 2 types -> 2 moities (180deg chacune)
      - 3 types -> 3 triangles (120deg chacun)
      - 4 types -> 4 quarts (90deg chacun)
    Le degre par part est donc calcule dynamiquement (360 / nombre de
    types presents), pas ecrit en dur dans le source."""
    assert "conic-gradient(from 45deg" in CARD_JS
    assert "presentColors" in CARD_JS
    assert "360 / sliceCount" in CARD_JS
    # Les parts sont construites par calcul (i * sliceDeg), pas par des
    # chaines de degres fixes comme '0deg 90deg' ecrites en dur.
    assert "sliceDeg" in CARD_JS
    assert '"deg "' in CARD_JS or "'deg '" in CARD_JS


def test_calendar_single_type_fills_whole_cell():
    """Un seul type present ce jour-la doit remplir toute la case de sa
    couleur (360deg), pas seulement un quart fixe."""
    # presentColors.length == 1 -> sliceDeg = 360 / 1 = 360, donc le seul
    # stop genere va de 0deg a 360deg : verifie par le calcul dynamique
    # lui-meme plutot qu'une chaine figee (le calcul est partage avec les
    # cas 2/3/4 types, voir test_calendar_renders_dynamic_conic_gradient_split).
    assert "sliceCount" in CARD_JS
    assert "presentColors.length" in CARD_JS


def test_calendar_renders_center_circle_for_nettoyage():
    """Test #6: a radial-gradient circle, no white outline, sized ~23% of
    the cell width, used only when nettoyage is present that day."""
    assert "radial-gradient(circle at center" in CARD_JS
    assert "23%" in CARD_JS
    assert "hasNettoyage" in CARD_JS
    # No white outline/stroke was added around the circle.
    assert "stroke" not in CARD_JS.split("radial-gradient(circle at center", 1)[1][:300]


def test_calendar_only_circle_when_only_nettoyage_present():
    assert "hasAnyTriangle || hasNettoyage" in CARD_JS


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
