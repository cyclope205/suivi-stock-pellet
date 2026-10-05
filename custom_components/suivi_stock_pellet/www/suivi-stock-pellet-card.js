/* Carte Lovelace "Suivi Stock Pellet" - stock, consommation et achats de
 * granulés de bois. Servie automatiquement par l'intégration Home Assistant
 * du même nom : aucune ressource Lovelace à ajouter manuellement.
 *
 * Utilisation minimale dans un tableau de bord :
 *   type: custom:suivi-stock-pellet-card
 *
 * Options de configuration (toutes optionnelles, tout est affiché par défaut) :
 *   show_stats: true|false          Tuiles consommé / énergie / dépensé / jours
 *   show_cost_stats: true|false     Tuiles coût/jour, coût/mois, coût du sac
 *   show_actions: true|false        Boutons + formulaires de saisie
 *   show_monthly_chart: true|false  Graphique "Évolution de la consommation"
 *   show_price_chart: true|false    Graphique "Prix moyen du sac par saison"
 *   show_history: true|false        Historique complet des saisies
 *   show_comparison:  true|false        Bloc comparaison a la saison precedente, a date egale
 *
 * Un sélecteur de saison est affiché dans l'en-tête (à droite du titre) :
 * il permet de consulter les tuiles, l'historique, le graphique mensuel et
 * le bloc de comparaison d'une saison passée (comparée à la saison encore
 * précédente, à date équivalente). Les boutons de saisie (achat/consommation) restent
 * visibles et actifs même sur ces saisons : ils s'appliquent toujours à la
 * date du jour (donc à la saison en cours), jamais à la saison affichée.
 *
 * Le graphique "Évolution de la consommation" superpose deux courbes
 * (sacs consommés / coût en €) : deux boutons sous le graphique
 * permettent d'afficher les deux, ou une seule à la fois.
 */
(function () {
  "use strict";

  var STYLE = [
    "ha-card { padding: 18px 18px 14px; border-radius: 18px; overflow: hidden; position: relative; }",
    ".header { font-size: 1.15em; font-weight: 700; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }",
    ".header-title { display: flex; align-items: center; gap: 8px; }",
    ".header-title ha-icon { color: var(--pellet-amber); }",
    ".season { font-size: 0.68em; font-weight: 600; opacity: 0.85; background: var(--secondary-background-color, rgba(127,127,127,0.15)); padding: 4px 10px; border-radius: 999px; border: none; color: inherit; -webkit-appearance: none; appearance: none; cursor: pointer; font-family: inherit; }",
    ".season option { color: initial; }",
    ".season-note { font-size: 0.72em; opacity: 0.7; text-align: right; margin: -8px 0 12px; }",
    ".hidden { display: none !important; }",
    ".hero { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,167,38,0.16), rgba(255,167,38,0.03)); }",
    ".hero-icon { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,167,38,0.22); }",
    ".hero-icon ha-icon { color: var(--pellet-amber); --mdc-icon-size: 28px; }",
    ".hero-text { flex: 1; min-width: 0; }",
    ".stock { font-size: 1.9em; font-weight: 700; line-height: 1.1; }",
    ".stock-sub { font-size: 0.82em; opacity: 0.7; margin-top: 2px; }",
    ".stock-alert { margin-top: 8px; padding: 6px 10px; border-radius: 8px; background: rgba(248,81,73,0.15); color: #f85149; font-size: 0.78em; font-weight: 600; }",
    ".stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }",
    ".stat { display: flex; align-items: center; gap: 10px; background: var(--secondary-background-color, rgba(127,127,127,0.1)); border-radius: 12px; padding: 10px 12px; }",
    ".stat-icon { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }",
    ".stat-icon ha-icon { --mdc-icon-size: 18px; }",
    ".stat-text { min-width: 0; }",
    ".stat-label { font-size: 0.68em; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.02em; }",
    ".stat-value { font-size: 1.05em; font-weight: 700; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".actions { display: flex; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }",
    ".actions button { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 12px; padding: 11px 12px; font-size: 0.92em; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, var(--pellet-amber), #ff8f00); color: #1c1c1c; transition: filter 0.15s ease, transform 0.05s ease; }",
    ".actions button ha-icon { --mdc-icon-size: 18px; }",
    ".actions button:hover { filter: brightness(1.06); }",
    ".actions button:active { transform: scale(0.98); }",
    ".actions button.secondary { background: var(--secondary-background-color, rgba(127,127,127,0.15)); color: var(--primary-text-color, inherit); }",
    ".actions button.type-conso:not(.secondary) { background: linear-gradient(135deg, #ff8a80, rgb(239, 83, 80)); color: #fff; }",
    ".actions button.type-conso.secondary { background: rgba(239, 83, 80, 0.12); color: rgb(239, 83, 80); border: 1px solid rgba(239, 83, 80, 0.35); }",
    ".actions button.type-achat:not(.secondary) { background: linear-gradient(135deg, #81c784, rgb(102, 187, 106)); color: #fff; }",
    ".actions button.type-achat.secondary { background: rgba(102, 187, 106, 0.12); color: rgb(102, 187, 106); border: 1px solid rgba(102, 187, 106, 0.35); }",
    "@keyframes pellet-quick-flash { 0% { box-shadow: 0 0 0 0 rgba(239, 83, 80, 0.9); } 100% { box-shadow: 0 0 0 14px rgba(239, 83, 80, 0); } }",
    ".actions button.flash { animation: pellet-quick-flash 0.45s ease-out; }",
    ".calendar-tip { background: rgba(15,15,15,0.98); color: #fff; font-size: 0.75em; padding: 6px 10px; border-radius: 6px; white-space: nowrap; z-index: 9999; pointer-events: none; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 4px 14px rgba(0,0,0,0.65); }",
".form { display: none; flex-direction: column; gap: 10px; margin-top: 6px; padding: 14px; border-radius: 14px; background: var(--secondary-background-color, rgba(127,127,127,0.1)); border: 1px solid var(--divider-color, rgba(127,127,127,0.2)); }",
    ".form.visible { display: flex; }",
    ".form label { font-size: 0.75em; opacity: 0.75; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }",
    ".form input { width: 100%; box-sizing: border-box; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: var(--card-background-color, transparent); color: inherit; font-size: 1em; margin-top: 4px; }",
    ".form input:focus { outline: none; border-color: var(--pellet-amber); box-shadow: 0 0 0 2px rgba(255,167,38,0.25); }",
    ".form-row { display: flex; gap: 8px; }",
    ".form-row > div { flex: 1; }",
    ".form-actions { display: flex; gap: 8px; margin-top: 2px; }",
    ".form-actions button { flex: 1; border: none; border-radius: 10px; padding: 10px; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, var(--pellet-amber), #ff8f00); color: #1c1c1c; }",
    ".undo-row { text-align: right; margin-top: 6px; }",
    ".undo-row button { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--secondary-text-color, #999); font-size: 0.78em; cursor: pointer; padding: 4px; }",
    ".undo-row button ha-icon { --mdc-icon-size: 14px; }",
    ".undo-row button:hover { color: var(--primary-text-color, inherit); }",
    ".chart-section { margin-top: 14px; }",
    ".chart-title { display: flex; align-items: center; gap: 6px; font-weight: 700; opacity: 0.85; margin-bottom: 10px; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.03em; }",
    ".chart-title ha-icon { --mdc-icon-size: 15px; color: var(--pellet-amber); }",
    ".chart { display: flex; align-items: flex-end; gap: 4px; height: 90px; padding: 0 2px 8px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.2)); }",
    ".chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; }",
    ".chart-bar-wrap { flex: 1; display: flex; align-items: flex-end; width: 100%; justify-content: center; }",
    ".chart-bar { width: 55%; min-width: 4px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, rgb(239, 83, 80), rgba(239, 83, 80, 0.55)); transition: height 0.2s ease; }",
    ".chart-bar.empty { background: var(--divider-color, rgba(127,127,127,0.25)); }",
    ".chart-label { font-size: 0.62em; opacity: 0.65; }",
    ".chart-label.current { opacity: 1; font-weight: 700; color: var(--pellet-amber); }",
    ".chart-legend { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 8px; font-size: 0.72em; }",
    ".chart-legend-item { display: inline-flex; align-items: center; gap: 6px; border: none; background: none; cursor: pointer; padding: 3px 8px; border-radius: 999px; color: inherit; font-family: inherit; font-size: 1em; opacity: 0.9; }",
    ".chart-legend-item.inactive { opacity: 0.3; }",
    ".chart-legend-dot { width: 9px; height: 9px; border-radius: 2px; background: rgb(239, 83, 80); }",
    ".chart-legend-dot.amber { border-radius: 50%; background: rgb(102, 187, 106); }",
    ".chart-svg-wrap { height: 100px; }",
    ".chart-svg-wrap svg { width: 100%; height: 100%; overflow: visible; }",
    ".chart-empty-note { opacity: 0.6; font-style: italic; font-size: 0.78em; padding: 16px 0; text-align: center; }",
    ".price-chart { position: relative; height: 110px; }",
    ".price-chart svg { width: 100%; height: 100%; overflow: visible; }",
    ".price-chart-empty { opacity: 0.6; font-style: italic; font-size: 0.82em; padding: 10px 0; }",
    ".history { margin-top: 12px; font-size: 0.85em; }",
    ".history-title { font-weight: 700; opacity: 0.85; margin-bottom: 6px; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.03em; }",
    ".history-list { max-height: 260px; overflow-y: auto; }",
    ".history-row { display: flex; align-items: center; gap: 10px; padding: 6px 2px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.15)); }",
    ".history-row:last-child { border-bottom: none; }",
    ".history-dot { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }",
    ".history-dot ha-icon { --mdc-icon-size: 13px; }",
    ".history-label { flex: 1; opacity: 0.85; }",
    ".history-value { font-weight: 600; }",
    ".history-empty { opacity: 0.6; font-style: italic; }",
    ".history-edit-btn { flex: 0 0 auto; background: none; border: none; opacity: 0.4; cursor: pointer; padding: 4px; color: inherit; }",
    ".history-edit-btn ha-icon { --mdc-icon-size: 15px; }",
    ".history-edit-btn:hover { opacity: 1; }",
    ".history-row.editing { flex-wrap: wrap; }",
    ".history-edit-form { display: flex; flex-direction: column; gap: 6px; width: 100%; padding: 4px 0 2px; }",
    ".history-edit-form-row { display: flex; gap: 6px; }",
    ".history-edit-form-row input, .history-edit-form-row select { flex: 1; min-width: 0; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: var(--card-background-color, transparent); color: inherit; font-size: 0.85em; }",
    ".history-edit-form-actions { display: flex; gap: 6px; justify-content: flex-end; }",
    ".history-edit-form-actions button { border: none; border-radius: 8px; padding: 6px 10px; cursor: pointer; background: var(--secondary-background-color, rgba(127,127,127,0.15)); color: inherit; }",
    ".history-edit-form-actions button:first-child { background: linear-gradient(135deg, var(--pellet-amber), #ff8f00); color: #1c1c1c; }",
    ".history-edit-form-actions button ha-icon { --mdc-icon-size: 16px; display: block; }",
    ".history-delete-btn { background: rgba(239, 83, 80, 0.15) !important; color: rgb(239, 83, 80) !important; }",
    ".history-delete-btn.confirm { background: rgb(239, 83, 80) !important; color: #fff !important; }",
    ".actions button:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }",
    ".comparison { display: flex; align-items: center; gap: 12px; margin: -4px 0 16px; padding: 10px 12px; border-radius: 12px; background: var(--secondary-background-color, rgba(127,127,127,0.1)); }",
    ".comparison-icon { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(66,165,245,0.18); }",
    ".comparison-icon ha-icon { --mdc-icon-size: 16px; color: rgb(66,165,245); }",
    ".comparison-text { flex: 1; min-width: 0; }",
    ".comparison-main { font-size: 0.88em; font-weight: 700; }",
    ".comparison-sub { font-size: 0.72em; opacity: 0.7; margin-top: 1px; }",
    ".comparison-badge { flex: 0 0 auto; font-size: 0.85em; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--divider-color, rgba(127,127,127,0.2)); }",
    ".comparison-badge.up { background: rgba(239, 83, 80, 0.18); color: rgb(239, 83, 80); }",
    ".comparison-badge.down { background: rgba(102, 187, 106, 0.18); color: rgb(102, 187, 106); }",
    ".comparison-euro { font-size: 0.72em; opacity: 0.8; margin-top: 2px; font-weight: 600; }",
    ".comparison-euro.up { color: rgb(239, 83, 80); }",
    ".comparison-euro.down { color: rgb(102, 187, 106); }",
    ".calendar-nav { display: flex; align-items: center; justify-content: space-between; max-width: 320px; margin: 0 auto 6px auto; }",
    ".calendar-nav-btn { background: var(--secondary-background-color, rgba(127,127,127,0.15)); border: none; color: inherit; border-radius: 6px; width: 20px; height: 20px; font-size: 0.8em; cursor: pointer; }",
    ".calendar-label { font-size: 0.85em; font-weight: 700; }",
    ".calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; max-width: 320px; margin: 0 auto; }",
    ".calendar-dow { text-align: center; font-size: 0.85em; opacity: 0.6; padding-bottom: 1px; }",
    ".calendar-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 0.85em; background: var(--secondary-background-color, rgba(127,127,127,0.08)); }",
    ".calendar-cell.purchase { background: rgba(102, 187, 106, 0.75); color: #fff; font-weight: 700; }",
    ".calendar-cell.consumption { background: rgba(239, 83, 80, 0.85); color: #fff; }",
    ".calendar-cell.purchase.consumption { background: linear-gradient(135deg, rgba(102,187,106,0.85) 50%, rgba(239,83,80,0.85) 50%); color: #fff; font-weight:700; }",
    ".calendar-legend { display: flex; gap: 14px; justify-content: center; max-width: 320px; margin: 6px auto 0 auto; font-size: 0.85em; opacity: 0.85; }",
    ".calendar-legend-item { display: inline-flex; align-items: center; gap: 5px; }",
    ".calendar-dot { width: 7px; height: 7px; border-radius: 50%; }",
    ".calendar-dot.purchase { background: rgb(102, 187, 106); }",
    ".calendar-dot.consumption { background: rgb(239, 83, 80); }",
    ".calendar-cell.maintenance { background: rgba(38, 166, 154, 0.85); color: #fff; }",
    ".calendar-cell.entretien { background: rgba(236, 64, 122, 0.85); color: #fff; }",
    ".calendar-dot.maintenance { background: rgb(38, 166, 154); }",
    ".calendar-dot.entretien { background: rgb(236, 64, 122); }",
    ".actions button.type-maintenance:not(.secondary) { background: linear-gradient(135deg, #4db6ac, rgb(38, 166, 154)); color: #fff; }",
    ".actions button.type-maintenance.secondary { background: rgba(38, 166, 154, 0.12); color: rgb(38, 166, 154); border: 1px solid rgba(38, 166, 154, 0.35); }",
    ".actions button.type-entretien:not(.secondary) { background: linear-gradient(135deg, #f06292, rgb(236, 64, 122)); color: #fff; }",
    ".actions button.type-entretien.secondary { background: rgba(236, 64, 122, 0.12); color: rgb(236, 64, 122); border: 1px solid rgba(236, 64, 122, 0.35); }",
    ".season-delete-btn { background: none; border: none; color: inherit; opacity: 0.55; cursor: pointer; padding: 4px; display: inline-flex; align-items: center; margin-left: 2px; }",
    ".season-delete-btn:hover { opacity: 1; color: rgb(239, 83, 80); }",
    ".season-delete-btn ha-icon { --mdc-icon-size: 16px; }",
    ".header-season-wrap { display: flex; align-items: center; gap: 2px; }"
  ].join("\n");

  var EDITOR_STYLE = [
    ":host { display: block; }",
    ".row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.2)); }",
    ".row:last-child { border-bottom: none; }",
    ".row-label { font-size: 0.95em; }",
    ".row-sub { font-size: 0.78em; opacity: 0.65; margin-top: 2px; }",
    ".unit-label { font-size: 0.95em; margin: 10px 0 6px; }",
    ".unit-row { display: flex; gap: 8px; margin-bottom: 12px; }",
    ".unit-button { flex: 1; min-height: 42px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: var(--secondary-background-color, rgba(127,127,127,0.15)); color: inherit; font: inherit; font-weight: 600; cursor: pointer; }",
    ".unit-button.selected { background: rgba(255,167,38,0.22); border-color: var(--pellet-amber); }",
    ".unit-button:focus-visible { outline: 2px solid var(--pellet-amber); outline-offset: 2px; }"
  ].join("\n");

  var ROOT_VARS = "--pellet-amber: #ffa726;";

  var MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  var MONTHS_FULL_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  var KEYS = {
    stock: "stock",
    consomme_kg: "consomme_kg",
    consomme_kwh: "consomme_kwh",
    achete_kg: "achete_kg",
    depense: "depense",
    jours: "jours_utilisation"
  };

  var COLORS = {
    amber: "255, 167, 38",
    red: "239, 83, 80",
    blue: "66, 165, 245",
    green: "102, 187, 106",
    purple: "171, 71, 188",
    teal: "38, 166, 154",
    pink: "236, 64, 122"
  };

  var DEFAULT_CONFIG = {
    show_stats: true,
    show_cost_stats: true,
    show_actions: true,
    show_comparison: true,
    show_monthly_chart: true,
    show_price_chart: true,
    show_history: true,
    show_calendar: true,
    show_maintenance_chart: true,
    show_entretien_chart: true,
  };

  var TOGGLE_FIELDS = [
    { key: "show_stats", label: "Tuiles consommé / énergie / dépensé / jours" },
    { key: "show_cost_stats", label: "Tuiles coût / mois, coût du sac" },
    { key: "show_actions", label: "Boutons et formulaires de saisie" },
    { key: "show_comparison", label: "Comparaison saison précédente à date égale" },
    { key: "show_monthly_chart", label: "Graphique évolution de la consommation" },
    { key: "show_price_chart", label: "Graphique prix moyen par unité par saison" },
    { key: "show_history", label: "Historique complet des saisies" },
    { key: "show_calendar", label: "Calendrier des ajouts avec navigation mensuelle" },
    { key: "show_maintenance_chart", label: "Graphique coût maintenance par saison" },
    { key: "show_entretien_chart", label: "Graphique coût entretien par saison" }
  ];

  function findEntity(hass, key) {
    var ids = Object.keys(hass.states);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var state = hass.states[id];
      if (
        id.indexOf("sensor.") === 0 &&
        state.attributes &&
        state.attributes.suivi_stock_pellet_key === key
      ) {
        return id;
      }
    }
    return null;
  }

  function fmt(value, decimals) {
    if (value === null || value === undefined || isNaN(value)) return "--";
    return Number(value).toFixed(decimals === undefined ? 1 : decimals);
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function icon(name) {
    var el = document.createElement("ha-icon");
    el.setAttribute("icon", name);
    return el;
  }

  function badge(name, color, size) {
    var wrap = document.createElement("div");
    wrap.className = size === "hero" ? "hero-icon" : "stat-icon";
    wrap.style.background = "rgba(" + color + ", 0.18)";
    var ic = icon(name);
    ic.style.color = "rgb(" + color + ")";
    wrap.appendChild(ic);
    return wrap;
  }

  function mergeConfig(config) {
    var merged = {};
    for (var key in DEFAULT_CONFIG) {
      merged[key] = DEFAULT_CONFIG[key];
    }
    if (config) {
      for (var k in config) {
        merged[k] = config[k];
      }

      // Migration de compatibilité : l'ancien éditeur visuel pouvait
      // enregistrer simultanément ces deux options à false. Dans ce cas,
      // on rétablit les sections afin qu'une ancienne configuration ne
      // fasse pas disparaître le graphique et le calendrier.
      if (config.show_monthly_chart === false && config.show_calendar === false) {
        merged.show_monthly_chart = true;
        merged.show_calendar = true;
      }
    }
    return merged;
  }

  function entryUnit(entry) {
    return entry && entry.unit === "kg" ? "kg" : "bag";
  }

  function entryQtyKg(entry, bagWeight) {
    var weight = Number(bagWeight) > 0 ? Number(bagWeight) : 15;
    if (entryUnit(entry) === "kg") {
      return Number(entry.qty_kg) || 0;
    }
    return (Number(entry.qty_bags) || 0) * weight;
  }

  function entryQtyBags(entry, bagWeight) {
    var weight = Number(bagWeight) > 0 ? Number(bagWeight) : 15;
    if (entryUnit(entry) === "kg") {
      return (Number(entry.qty_kg) || 0) / weight;
    }
    return Number(entry.qty_bags) || 0;
  }

  function entryQtyDisplay(entry, unit, bagWeight) {
    return unit === "kg" ? entryQtyKg(entry, bagWeight) : entryQtyBags(entry, bagWeight);
  }

  class SuiviStockPelletCard extends HTMLElement {
    static getConfigForm() {
      return {
        schema: [
          ...TOGGLE_FIELDS.map(function (field) {
            return {
              name: field.key,
              default: DEFAULT_CONFIG[field.key],
              selector: { boolean: {} }
            };
          })
        ],
        computeLabel: function (schema) {
          var field = TOGGLE_FIELDS.find(function (item) { return item.key === schema.name; });
          return field ? field.label : schema.name;
        }
      };
    }

    static getStubConfig() {
      return mergeConfig({});
    }

    setConfig(config) {
      this._config = mergeConfig(config);
      this._entryUnit = "bag";
      this._entryId = null;
      this._built = false;
      if (this._hass) {
        this._ensureDom();
        this._render();
      }
    }

    set hass(hass) {
      this._hass = hass;
      // Read the configured season-start month synchronously from the
      // stock sensor's attributes (mois_debut_saison) before the DOM/
      // forms are built. Without this, the very first render used to
      // fall back to _startMonth's hardcoded default (9 = septembre)
      // until the async "journal" websocket call resolved and set the
      // real value - if the user's actual start month differs (e.g.
      // janvier) and they submit an Achat/Consommation form before that
      // round-trip completes (typical when backfilling several entries
      // right after adding the integration), the entry could be filed
      // under the wrong season key, corrupting the stock carry-over
      // between seasons.
      var stockId = findEntity(hass, KEYS.stock);
      if (stockId && hass.states[stockId] && hass.states[stockId].attributes) {
        var attrs = hass.states[stockId].attributes;
        var sm = attrs.mois_debut_saison;
        if (sm) this._startMonth = sm;
        var configuredUnit = attrs.unite_affichage;
        if (configuredUnit === "kg" || configuredUnit === "bag") {
          this._entryUnit = configuredUnit;
        }
        this._entryId = attrs.entry_id || null;
      }
      this._ensureDom();
      this._render();
    }

    getCardSize() {
      return 6;
    }

    _ensureDom() {
      if (this._built) return;
      this._built = true;
      this.innerHTML = "";
      this.style.cssText = ROOT_VARS;

      var cfg = this._config || DEFAULT_CONFIG;

      var style = document.createElement("style");
      style.textContent = STYLE;
      this.appendChild(style);

      var card = document.createElement("ha-card");
      this.appendChild(card);

      var self = this;

      var header = document.createElement("div");
      header.className = "header";
      var titleWrap = document.createElement("div");
      titleWrap.className = "header-title";
      titleWrap.appendChild(icon("mdi:pine-tree"));
      var title = document.createElement("span");
      title.textContent = "Granulés";
      titleWrap.appendChild(title);
      var season = document.createElement("select");
      season.className = "season";
      season.addEventListener("change", function (ev) {
        self._season = ev.target.value;
        self._seasonDataFetchedFor = null;
        self._refreshSelectedSeason();
        self._comparisonFetchedAt = 0;
        self._refreshComparison();
      });
      var seasonWrapHeader = document.createElement("div");
      seasonWrapHeader.className = "header-season-wrap";
      var seasonDeleteBtn = document.createElement("button");
      seasonDeleteBtn.type = "button";
      seasonDeleteBtn.className = "season-delete-btn";
      seasonDeleteBtn.title = "Supprimer la saison affichée";
      seasonDeleteBtn.appendChild(icon("mdi:trash-can-outline"));
      seasonDeleteBtn.addEventListener("click", function () {
        if (!self._season || !self._hass) return;
        var known = (self._knownSeasons || []).slice().sort();
        var idx = known.indexOf(self._season);
        var hasSuccessor = idx !== -1 && idx < known.length - 1;
        var msg = "Supprimer définitivement la saison " + self._season + " et toutes ses saisies ? Cette action est irréversible.";
        if (hasSuccessor) {
          msg += "\n\nAttention : une saison suivante existe déjà et a peut-être hérité du stock de report de celle-ci. Sa supprimer ne recalculera pas automatiquement ce report.";
        }
        if (!window.confirm(msg)) return;
        seasonDeleteBtn.disabled = true;
        self._hass.callService("suivi_stock_pellet", "delete_season", { season: self._season })
          .then(function () {
            self._season = self._currentSeason;
            self._seasonDataFetchedFor = null;
            self._seasonDataFetchedAt = 0;
            self._seasonDataDirty = true;
            self._seasonsFetchedAt = 0;
            self._seasonsDirty = true;
            self._refreshSelectedSeason();
            if (self._refreshSeasonsSummary) self._refreshSeasonsSummary();
            self._comparisonFetchedAt = 0;
            self._refreshComparison();
          })
          .catch(function (err) {
            alert("Impossible de supprimer cette saison : " + ((err && err.message) || String(err)));
          })
          .finally(function () {
            seasonDeleteBtn.disabled = false;
          });
      });
      seasonWrapHeader.appendChild(season);
      seasonWrapHeader.appendChild(seasonDeleteBtn);
      header.appendChild(titleWrap);
      header.appendChild(seasonWrapHeader);
      card.appendChild(header);

      var seasonNote = document.createElement("div");
      seasonNote.className = "season-note";
      card.appendChild(seasonNote);

      var hero = document.createElement("div");
      hero.className = "hero";
      hero.appendChild(badge("mdi:package-variant-closed", COLORS.amber, "hero"));
      var heroText = document.createElement("div");
      heroText.className = "hero-text";
      var stock = document.createElement("div");
      stock.className = "stock";
      var stockSub = document.createElement("div");
      stockSub.className = "stock-sub";
      var stockAlert = document.createElement("div");
      stockAlert.className = "stock-alert";
      stockAlert.style.display = "none";
      heroText.appendChild(stock);
      heroText.appendChild(stockSub);
      heroText.appendChild(stockAlert);
      hero.appendChild(heroText);
      card.appendChild(hero);

      var els = {
        season: season,
        seasonNote: seasonNote,
        stock: stock,
        stockSub: stockSub,
        stockAlert: stockAlert
      };

      if (cfg.show_comparison) {
        var comparison = document.createElement("div");
        comparison.className = "comparison";
        var comparisonIconWrap = document.createElement("div");
        comparisonIconWrap.className = "comparison-icon";
        comparisonIconWrap.appendChild(icon("mdi:swap-vertical-bold"));
        var comparisonText = document.createElement("div");
        comparisonText.className = "comparison-text";
        var comparisonMain = document.createElement("div");
        comparisonMain.className = "comparison-main";
        var comparisonSub = document.createElement("div");
        comparisonSub.className = "comparison-sub";
        comparisonText.appendChild(comparisonMain);
        comparisonText.appendChild(comparisonSub);
        var comparisonEuro = document.createElement("div");
        comparisonEuro.className = "comparison-euro";
        comparisonText.appendChild(comparisonEuro);
        var comparisonBadge = document.createElement("div");
        comparisonBadge.className = "comparison-badge";
        comparison.appendChild(comparisonIconWrap);
        comparison.appendChild(comparisonText);
        comparison.appendChild(comparisonBadge);
        card.appendChild(comparison);
        els.comparison = comparison;
        els.comparisonMain = comparisonMain;
        els.comparisonSub = comparisonSub;
        els.comparisonEuro = comparisonEuro;
        els.comparisonBadge = comparisonBadge;
      }

      function addStat(container, label, iconName, color) {
        var stat = document.createElement("div");
        stat.className = "stat";
        stat.appendChild(badge(iconName, color));
        var text = document.createElement("div");
        text.className = "stat-text";
        var lab = document.createElement("div");
        lab.className = "stat-label";
        lab.textContent = label;
        var val = document.createElement("div");
        val.className = "stat-value";
        text.appendChild(lab);
        text.appendChild(val);
        stat.appendChild(text);
        container.appendChild(stat);
        return val;
      }

      if (cfg.show_stats) {
        var stats = document.createElement("div");
        stats.className = "stats";
        els.statConsomme = addStat(stats, "Consommé", "mdi:fire", COLORS.red);
        els.statEnergie = addStat(stats, "Énergie", "mdi:lightning-bolt", COLORS.purple);
        els.statDepense = addStat(stats, "Dépense pellet", "mdi:currency-eur", COLORS.green);
        els.statJours = addStat(stats, "Jours chauffés", "mdi:calendar-range", COLORS.blue);
        card.appendChild(stats);
      }

      if (cfg.show_cost_stats) {
        var costStats = document.createElement("div");
        costStats.className = "stats";
        els.statCoutJour = addStat(costStats, "Coût / jour", "mdi:cash-clock", COLORS.green);
        els.statCoutMois = addStat(costStats, "Coût / mois", "mdi:calendar-month", COLORS.blue);
        els.statCoutSac = addStat(costStats, self._entryUnit === "kg" ? "Coût moyen / kg" : "Coût moyen / sac", self._entryUnit === "kg" ? "mdi:weight-kilogram" : "mdi:sack", COLORS.amber);
        els.statCoutAnnee = addStat(costStats, "Coût consommé", "mdi:cash-multiple", COLORS.purple);
        els.statCoutMaintenance = addStat(costStats, "Coût maintenance", "mdi:wrench", COLORS.teal);
        els.statCoutEntretien = addStat(costStats, "Coût entretien", "mdi:broom", COLORS.pink);
        card.appendChild(costStats);
      }

      if (cfg.show_actions) {
        var actionsWrap = document.createElement("div");
        els.actionsWrap = actionsWrap;
        card.appendChild(actionsWrap);

        var actions = document.createElement("div");
        actions.className = "actions";
        var btnConso = document.createElement("button");
        btnConso.type = "button";
        btnConso.className = "type-conso";
        btnConso.appendChild(icon("mdi:fire"));
        btnConso.appendChild(document.createTextNode("Consommation"));
        var btnAchat = document.createElement("button");
        btnAchat.type = "button";
        btnAchat.className = "secondary type-achat";
        btnAchat.appendChild(icon("mdi:cart-plus"));
        btnAchat.appendChild(document.createTextNode("Achat"));
        var btnQuick = null;
        if (self._entryUnit !== "kg") {
          btnQuick = document.createElement("button");
          btnQuick.type = "button";
          btnQuick.className = "type-conso";
          btnQuick.title = "Enregistrer 1 sac consommé aujourd'hui";
          btnQuick.appendChild(icon("mdi:fire-alert"));
          btnQuick.appendChild(document.createTextNode("+1 sac aujourd'hui"));
          btnQuick.addEventListener("click", function () {
            if (!self._hass) return;
            btnQuick.classList.remove("flash");
            void btnQuick.offsetWidth;
            btnQuick.classList.add("flash");
            setTimeout(function () { btnQuick.classList.remove("flash"); }, 450);
            btnQuick.disabled = true;
            var todayIsoStr = todayIso();
            var season = self._seasonForDate(todayIsoStr);
            self._applyOptimisticConsumption(1, season, self._entryUnit);
            self._hass
              .callService("suivi_stock_pellet", "log_consumption", {
                qty_bags: 1,
                unit: "bag",
                season: season,
              })
              .then(function () {
                self._seasonDataFetchedAt = 0;
                self._seasonDataDirty = true;
                self._seasonsFetchedAt = 0;
                self._seasonsDirty = true;
                self._refreshSelectedSeason();
              })
              .catch(function (err) {
                alert("Impossible d'enregistrer : " + (err && err.message ? err.message : err));
                self._seasonDataFetchedAt = 0;
                self._seasonDataDirty = true;
                self._refreshSelectedSeason();
              })
              .then(function () {
                btnQuick.disabled = false;
              });
          });
        }
        var btnMaintenance = document.createElement("button");
        btnMaintenance.type = "button";
        btnMaintenance.className = "secondary type-maintenance";
        btnMaintenance.appendChild(icon("mdi:wrench"));
        btnMaintenance.appendChild(document.createTextNode("Maintenance"));
        var btnEntretien = document.createElement("button");
        btnEntretien.type = "button";
        btnEntretien.className = "secondary type-entretien";
        btnEntretien.appendChild(icon("mdi:broom"));
        btnEntretien.appendChild(document.createTextNode("Entretien"));

        actions.appendChild(btnConso);
        els.btnConso = btnConso;
        actions.appendChild(btnAchat);
        actions.appendChild(btnMaintenance);
        els.btnMaintenance = btnMaintenance;
        actions.appendChild(btnEntretien);
        els.btnEntretien = btnEntretien;
        if (btnQuick) actions.appendChild(btnQuick);
        els.btnQuick = btnQuick;
        actionsWrap.appendChild(actions);

        var formConso = this._buildForm("consumption");
        var formAchat = this._buildForm("purchase");
        var formMaintenance = this._buildCostForm("maintenance");
        var formEntretien = this._buildCostForm("entretien");
        actionsWrap.appendChild(formConso.el);
        actionsWrap.appendChild(formAchat.el);
        actionsWrap.appendChild(formMaintenance.el);
        actionsWrap.appendChild(formEntretien.el);
        els.consoSeasonSelect = formConso.seasonSelect;
        els.achatSeasonSelect = formAchat.seasonSelect;
        els.maintenanceSeasonSelect = formMaintenance.seasonSelect;
        els.entretienSeasonSelect = formEntretien.seasonSelect;

        // Historical CSV import: visible only to admins, with backend admin enforcement.
        var importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.className = "secondary";
        importBtn.appendChild(icon("mdi:file-import"));
        importBtn.appendChild(document.createTextNode("Importer un CSV"));
        var importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = ".csv,text/csv";
        importInput.style.display = "none";
        actionsWrap.appendChild(importInput);
        actions.appendChild(importBtn);
        els.importBtn = importBtn;
        els.importInput = importInput;

        importBtn.addEventListener("click", function () {
          if (!self._hass || !self._hass.user || !self._hass.user.is_admin) {
            alert("L'import CSV est réservé aux administrateurs Home Assistant.");
            return;
          }
          importInput.value = "";
          importInput.click();
        });

        importInput.addEventListener("change", function () {
          var file = importInput.files && importInput.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            var bytes = reader.result;
            var utf8 = new TextDecoder("utf-8").decode(bytes);
            var content = (utf8.match(/\uFFFD/g) || []).length
              ? new TextDecoder("windows-1252").decode(bytes)
              : utf8;
            self._hass.connection.sendMessagePromise({
              type: "suivi_stock_pellet/csv_import_preview",
              content: content
            }).then(function (preview) {
              var ok = window.confirm(
                "Saison : " + preview.season +
                "\nConsommation : " + preview.consumption_bags + " sac(s)" +
                "\nAchats : " + preview.purchase_bags + " sac(s)" +
                "\n\nImporter ces données ?"
              );
              if (!ok) return null;
              return self._hass.connection.sendMessagePromise({
                type: "suivi_stock_pellet/csv_import_commit",
                content: content
              });
            }).then(function (result) {
              if (!result) return;
              self._seasonDataFetchedAt = 0;
              self._seasonDataDirty = true;
              self._seasonsFetchedAt = 0;
              self._seasonsDirty = true;
              self._refreshSelectedSeason();
              if (self._refreshSeasonsSummary) self._refreshSeasonsSummary();
              alert("Import terminé : " + result.imported + " saisie(s).");
            }).catch(function (err) {
              alert("Import CSV refusé : " + ((err && err.message) || String(err)));
            });
          };
          reader.readAsArrayBuffer(file);
        });

        var actionPairs = [
          { btn: btnConso, form: formConso },
          { btn: btnAchat, form: formAchat },
          { btn: btnMaintenance, form: formMaintenance },
          { btn: btnEntretien, form: formEntretien }
        ];
        function updateActionButtons() {
          actionPairs.forEach(function (pair) {
            if (pair.form.el.classList.contains("visible")) {
              pair.btn.classList.remove("secondary");
            } else {
              pair.btn.classList.add("secondary");
            }
          });
        }
        actionPairs.forEach(function (pair) {
          pair.btn.addEventListener("click", function () {
            var wasVisible = pair.form.el.classList.contains("visible");
            actionPairs.forEach(function (p) {
              if (p !== pair) p.form.el.classList.remove("visible");
            });
            pair.form.el.classList.toggle("visible", !wasVisible);
            updateActionButtons();
          });
        });

      }

      if (cfg.show_monthly_chart) {
        var chartSection = document.createElement("div");
        chartSection.className = "chart-section";
        var chartTitle = document.createElement("div");
        chartTitle.className = "chart-title";
        chartTitle.appendChild(icon("mdi:chart-line"));
        chartTitle.appendChild(document.createTextNode("Évolution de la consommation"));
        var chart = document.createElement("div");
        chart.className = "chart-svg-wrap";
        var chartLegend = document.createElement("div");
        chartLegend.className = "chart-legend";

        var qtyBtn = document.createElement("button");
        qtyBtn.type = "button";
        qtyBtn.className = "chart-legend-item";
        var qtyDot = document.createElement("span");
        qtyDot.className = "chart-legend-dot";
        qtyBtn.appendChild(qtyDot);
        qtyBtn.appendChild(document.createTextNode(self._entryUnit === "kg" ? "Kg consommés" : "Sacs consommés"));

        var costBtn = document.createElement("button");
        costBtn.type = "button";
        costBtn.className = "chart-legend-item";
        var costDot = document.createElement("span");
        costDot.className = "chart-legend-dot amber";
        costBtn.appendChild(costDot);
        costBtn.appendChild(document.createTextNode(self._entryUnit === "kg" ? "Coût (€ / kg)" : "Coût (€)"));

        chartLegend.appendChild(qtyBtn);
        chartLegend.appendChild(costBtn);

        chartSection.appendChild(chartTitle);
        chartSection.appendChild(chart);
        chartSection.appendChild(chartLegend);
        card.appendChild(chartSection);
        els.chart = chart;

        this._chartVisible = { qty: true, cost: true };

        var toggleSeries = function (key, btn) {
          self._chartVisible[key] = !self._chartVisible[key];
          btn.classList.toggle("inactive", !self._chartVisible[key]);
          if (self._lastChartData) {
            self._renderChart(
              self._lastChartData.entries,
              self._lastChartData.startMonth,
              self._lastChartData.avgPricePerBag
            );
          }
        };
        qtyBtn.addEventListener("click", function () {
          toggleSeries("qty", qtyBtn);
        });
        costBtn.addEventListener("click", function () {
          toggleSeries("cost", costBtn);
        });
      }

      if (cfg.show_price_chart) {
        var priceSection = document.createElement("div");
        priceSection.className = "chart-section";
        var priceTitle = document.createElement("div");
        priceTitle.className = "chart-title";
        priceTitle.appendChild(icon("mdi:cash-multiple"));
        priceTitle.appendChild(document.createTextNode("Prix moyen par saison"));
        var priceChart = document.createElement("div");
        priceChart.className = "price-chart";
        priceSection.appendChild(priceTitle);
        priceSection.appendChild(priceChart);
        card.appendChild(priceSection);
        els.priceChart = priceChart;
        els.priceTitle = priceTitle;
      }

      if (cfg.show_maintenance_chart) {
        var maintenanceSection = document.createElement("div");
        maintenanceSection.className = "chart-section";
        var maintenanceTitle = document.createElement("div");
        maintenanceTitle.className = "chart-title";
        maintenanceTitle.appendChild(icon("mdi:wrench"));
        maintenanceTitle.appendChild(document.createTextNode("Coût maintenance par saison"));
        var maintenanceChart = document.createElement("div");
        maintenanceChart.className = "price-chart";
        maintenanceSection.appendChild(maintenanceTitle);
        maintenanceSection.appendChild(maintenanceChart);
        card.appendChild(maintenanceSection);
        els.maintenanceChart = maintenanceChart;
      }

      if (cfg.show_entretien_chart) {
        var entretienSection = document.createElement("div");
        entretienSection.className = "chart-section";
        var entretienTitle = document.createElement("div");
        entretienTitle.className = "chart-title";
        entretienTitle.appendChild(icon("mdi:broom"));
        entretienTitle.appendChild(document.createTextNode("Coût entretien par saison"));
        var entretienChart = document.createElement("div");
        entretienChart.className = "price-chart";
        entretienSection.appendChild(entretienTitle);
        entretienSection.appendChild(entretienChart);
        card.appendChild(entretienSection);
        els.entretienChart = entretienChart;
      }

      if (cfg.show_history) {
        var history = document.createElement("div");
        history.className = "history";
        var historyTitle = document.createElement("div");
        historyTitle.className = "history-title";
        historyTitle.textContent = "Dernières saisies";
        var historyList = document.createElement("div");
        historyList.className = "history-list";
        history.appendChild(historyTitle);
        history.appendChild(historyList);
        card.appendChild(history);
        els.historyList = historyList;
      }

      if (cfg.show_calendar) {
        var calSection = document.createElement("div");
        calSection.className = "chart-section";
        var calTitle = document.createElement("div");
        calTitle.className = "chart-title";
        calTitle.appendChild(icon("mdi:calendar-month-outline"));
        calTitle.appendChild(document.createTextNode("Calendrier des ajouts"));
        calSection.appendChild(calTitle);

        var calNav = document.createElement("div");
        calNav.className = "calendar-nav";
        var calPrevBtn = document.createElement("button");
        calPrevBtn.type = "button";
        calPrevBtn.className = "calendar-nav-btn";
        calPrevBtn.textContent = "\u2039";
        var calLabel = document.createElement("div");
        calLabel.className = "calendar-label";
        var calNextBtn = document.createElement("button");
        calNextBtn.type = "button";
        calNextBtn.className = "calendar-nav-btn";
        calNextBtn.textContent = "\u203a";
        calNav.appendChild(calPrevBtn);
        calNav.appendChild(calLabel);
        calNav.appendChild(calNextBtn);
        calSection.appendChild(calNav);

        var calGrid = document.createElement("div");
        calGrid.className = "calendar-grid";
        calSection.appendChild(calGrid);

        var calLegend = document.createElement("div");
        calLegend.className = "calendar-legend";
        var calLegendPurchase = document.createElement("span");
        calLegendPurchase.className = "calendar-legend-item";
        var calDotPurchase = document.createElement("span");
        calDotPurchase.className = "calendar-dot purchase";
        calLegendPurchase.appendChild(calDotPurchase);
        calLegendPurchase.appendChild(document.createTextNode("Achat"));
        var calLegendConso = document.createElement("span");
        calLegendConso.className = "calendar-legend-item";
        var calDotConso = document.createElement("span");
        calDotConso.className = "calendar-dot consumption";
        calLegendConso.appendChild(calDotConso);
        calLegendConso.appendChild(document.createTextNode("Consommation"));
        var calLegendMaintenance = document.createElement("span");
        calLegendMaintenance.className = "calendar-legend-item";
        var calDotMaintenance = document.createElement("span");
        calDotMaintenance.className = "calendar-dot maintenance";
        calLegendMaintenance.appendChild(calDotMaintenance);
        calLegendMaintenance.appendChild(document.createTextNode("Maintenance"));
        var calLegendEntretien = document.createElement("span");
        calLegendEntretien.className = "calendar-legend-item";
        var calDotEntretien = document.createElement("span");
        calDotEntretien.className = "calendar-dot entretien";
        calLegendEntretien.appendChild(calDotEntretien);
        calLegendEntretien.appendChild(document.createTextNode("Entretien"));

        calLegend.appendChild(calLegendPurchase);
        calLegend.appendChild(calLegendConso);
        calLegend.appendChild(calLegendMaintenance);
        calLegend.appendChild(calLegendEntretien);
        calSection.appendChild(calLegend);

        card.appendChild(calSection);
        els.calLabel = calLabel;
        els.calGrid = calGrid;

        calPrevBtn.addEventListener("click", function () {
          self._calendarMonth--;
          if (self._calendarMonth < 1) {
            self._calendarMonth = 12;
            self._calendarYear--;
          }
          self._renderCalendar();
        });
        calNextBtn.addEventListener("click", function () {
          self._calendarMonth++;
          if (self._calendarMonth > 12) {
            self._calendarMonth = 1;
            self._calendarYear++;
          }
          self._renderCalendar();
        });
      }

      this._els = els;
    }

    _buildForm(kind) {
      var self = this;
      var el = document.createElement("div");
      el.className = "form";

      var row1 = document.createElement("div");
      row1.className = "form-row";

      var unitConfigNote = document.createElement("div");
      unitConfigNote.className = "unit-config-note";
      unitConfigNote.textContent = "Choix kg ou sacs à configurer dans l'éditeur de carte";
      el.appendChild(unitConfigNote);

      var qtyWrap = document.createElement("div");
      var qtyLabel = document.createElement("label");
      qtyLabel.textContent = self._entryUnit === "kg" ? "Quantité (kg)" : "Nombre de sacs";
      var qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.step = "0.1";
      qtyInput.min = "0.1";
      qtyInput.value = "1";
      qtyWrap.appendChild(qtyLabel);
      qtyWrap.appendChild(qtyInput);
      row1.appendChild(qtyWrap);

      var dateWrap = document.createElement("div");
      var dateLabel = document.createElement("label");
      dateLabel.textContent = "Date";
      var dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = todayIso();
      dateWrap.appendChild(dateLabel);
      dateWrap.appendChild(dateInput);
      row1.appendChild(dateWrap);

      el.appendChild(row1);

      var priceInput = null;
      var totalPriceInput = null;
      if (kind === "purchase") {
        var priceWrap = document.createElement("div");
        var priceLabel = document.createElement("label");
        priceLabel.textContent = self._entryUnit === "kg" ? "Prix par kg (€, vide = prix moyen actuel)" : "Prix par sac (€, vide = prix moyen actuel)";
        priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.step = "0.01";
        priceInput.min = "0";
        priceWrap.appendChild(priceLabel);
        priceWrap.appendChild(priceInput);
        el.appendChild(priceWrap);

        var totalPriceWrap = document.createElement("div");
        var totalPriceLabel = document.createElement("label");
        totalPriceLabel.textContent = "OU prix total du bon de livraison (€, remplace le prix par sac)";
        totalPriceInput = document.createElement("input");
        totalPriceInput.type = "number";
        totalPriceInput.step = "0.01";
        totalPriceInput.min = "0";
        totalPriceWrap.appendChild(totalPriceLabel);
        totalPriceWrap.appendChild(totalPriceInput);
        el.appendChild(totalPriceWrap);
      }

      var seasonWrap = document.createElement("div");
      var seasonLabel = document.createElement("label");
      seasonLabel.textContent =
        kind === "purchase"
          ? "Saison à incrémenter (achat compté sur cette saison)"
          : "Saison à décrémenter (consommation comptée sur cette saison)";
      var seasonInput = document.createElement("select");
      seasonWrap.appendChild(seasonLabel);
      seasonWrap.appendChild(seasonInput);
      el.appendChild(seasonWrap);
      self._populateFormSeasonSelect(seasonInput, dateInput.value);
      dateInput.addEventListener("change", function () {
        self._populateFormSeasonSelect(seasonInput, dateInput.value);
      });

      var formActions = document.createElement("div");
      formActions.className = "form-actions";
      var submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.textContent =
        kind === "purchase" ? "Enregistrer l'achat" : "Enregistrer la consommation";
      formActions.appendChild(submitBtn);
      el.appendChild(formActions);

      submitBtn.addEventListener("click", function () {
        var qty = parseFloat(qtyInput.value);
        if (!qty || qty < 0) return;
        var formSeason = seasonInput.value;
        if (!formSeason) {
          alert("Choisis d'abord la saison a laquelle cet achat/cette consommation doit etre rattache(e).");
          return;
        }
        var seasonMatchesDisplayed = formSeason === self._season;
        if (
          kind !== "purchase" &&
          seasonMatchesDisplayed &&
          self._currentStockBags !== undefined &&
          self._currentStockBags <= 0
        ) {
          alert("Stock à 0 : impossible d'enregistrer une consommation.");
          return;
        }
        var data = { date: dateInput.value, season: formSeason || self._seasonForDate(dateInput.value), unit: self._entryUnit };
        if (self._entryUnit === "kg") data.qty_kg = qty; else data.qty_bags = qty;
        if (kind === "purchase") {
          if (totalPriceInput && totalPriceInput.value) {
            data.price_eur = parseFloat(totalPriceInput.value);
          } else if (priceInput.value) {
            data.price_eur = parseFloat(priceInput.value) * qty;
          } else if (seasonMatchesDisplayed && self._currentAvgPricePerBag) {
            data.price_eur = self._entryUnit === "kg"
              ? (self._currentAvgPricePerBag / (self._bagWeight || 15)) * qty
              : self._currentAvgPricePerBag * qty;
          }
        }
        var service = kind === "purchase" ? "log_purchase" : "log_consumption";
        // The service call is async and can be rejected by the backend
        // (stock insuffisant, saison invalide, etc.) - it used to be
        // fired without waiting for the result, so the form closed and
        // reset itself unconditionally a moment later regardless of
        // whether the write actually succeeded. A failed submission
        // then looked exactly like a successful one from the user's
        // side, with no indication anything went wrong.
        submitBtn.disabled = true;
        self._hass
          .callService("suivi_stock_pellet", service, data)
          .then(function () {
            self._seasonDataFetchedAt = 0;
            self._seasonDataDirty = true;
            self._seasonsFetchedAt = 0;
            self._seasonsDirty = true;
            el.classList.remove("visible");
            qtyInput.value = "1";
            dateInput.value = todayIso();
            if (priceInput) priceInput.value = "";
            if (totalPriceInput) totalPriceInput.value = "";
            self._populateFormSeasonSelect(seasonInput, dateInput.value);
          })
          .catch(function (err) {
            alert(
              "Échec de l'enregistrement : " +
                ((err && err.message) || String(err))
            );
          })
          .finally(function () {
            submitBtn.disabled = false;
          });
      });

      return { el: el, seasonSelect: seasonInput };
    }

    _buildCostForm(kind) {
      // kind: "maintenance" ou "entretien". Formulaire jumeau de
      // _buildForm mais sans quantite/unite : ces saisies ne portent
      // qu un cout, une date et une note libre, et n interviennent
      // jamais dans le calcul du stock de granules.
      var self = this;
      var el = document.createElement("div");
      el.className = "form";

      var row1 = document.createElement("div");
      row1.className = "form-row";

      var priceWrap = document.createElement("div");
      var priceLabel = document.createElement("label");
      priceLabel.textContent = "Coût (€)";
      var priceInput = document.createElement("input");
      priceInput.type = "number";
      priceInput.step = "0.01";
      priceInput.min = "0";
      priceWrap.appendChild(priceLabel);
      priceWrap.appendChild(priceInput);
      row1.appendChild(priceWrap);

      var dateWrap = document.createElement("div");
      var dateLabel = document.createElement("label");
      dateLabel.textContent = "Date";
      var dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = todayIso();
      dateWrap.appendChild(dateLabel);
      dateWrap.appendChild(dateInput);
      row1.appendChild(dateWrap);

      el.appendChild(row1);

      var noteWrap = document.createElement("div");
      var noteLabel = document.createElement("label");
      noteLabel.textContent = "Note (facultatif, ex. : ramonage, remplacement joint...)";
      var noteInput = document.createElement("input");
      noteInput.type = "text";
      noteWrap.appendChild(noteLabel);
      noteWrap.appendChild(noteInput);
      el.appendChild(noteWrap);

      var seasonWrap = document.createElement("div");
      var seasonLabel = document.createElement("label");
      seasonLabel.textContent = "Saison à incrémenter";
      var seasonInput = document.createElement("select");
      seasonWrap.appendChild(seasonLabel);
      seasonWrap.appendChild(seasonInput);
      el.appendChild(seasonWrap);
      self._populateFormSeasonSelect(seasonInput, dateInput.value);
      dateInput.addEventListener("change", function () {
        self._populateFormSeasonSelect(seasonInput, dateInput.value);
      });

      var formActions = document.createElement("div");
      formActions.className = "form-actions";
      var submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.textContent = kind === "maintenance" ? "Enregistrer la maintenance" : "Enregistrer l entretien";
      formActions.appendChild(submitBtn);
      el.appendChild(formActions);

      submitBtn.addEventListener("click", function () {
        var price = parseFloat(priceInput.value);
        if (isNaN(price) || price < 0) {
          alert("Indique un coût valide (0 ou plus).");
          return;
        }
        var formSeason = seasonInput.value;
        if (!formSeason) {
          alert("Choisis d abord la saison a laquelle cette saisie doit etre rattachee.");
          return;
        }
        var data = { price_eur: price, date: dateInput.value, season: formSeason };
        if (noteInput.value) data.note = noteInput.value;
        var service = kind === "maintenance" ? "log_maintenance" : "log_entretien";
        submitBtn.disabled = true;
        self._hass
          .callService("suivi_stock_pellet", service, data)
          .then(function () {
            self._seasonDataFetchedAt = 0;
            self._seasonDataDirty = true;
            self._seasonsFetchedAt = 0;
            self._seasonsDirty = true;
            el.classList.remove("visible");
            priceInput.value = "";
            noteInput.value = "";
            dateInput.value = todayIso();
            self._populateFormSeasonSelect(seasonInput, dateInput.value);
            self._refreshSelectedSeason();
            if (self._refreshSeasonsSummary) self._refreshSeasonsSummary();
          })
          .catch(function (err) {
            alert("Échec de l enregistrement : " + ((err && err.message) || String(err)));
          })
          .finally(function () {
            submitBtn.disabled = false;
          });
      });

      return { el: el, seasonSelect: seasonInput };
    }

    _render() {
      if (!this._els) return;
      var hass = this._hass;
      var els = this._els;
      var cfg = this._config || DEFAULT_CONFIG;

      var stockId = findEntity(hass, KEYS.stock);
      var energieId = findEntity(hass, KEYS.consomme_kwh);

      if (!stockId) {
        els.stock.textContent = "Intégration non configurée";
        return;
      }

      var stockAttrs = hass.states[stockId].attributes || {};
      this._currentSeason = stockAttrs.saison || "";
      this._bagWeight = stockAttrs.poids_sac_kg || 15;
      this._calorificValue =
        (energieId &&
          hass.states[energieId].attributes &&
          hass.states[energieId].attributes.pouvoir_calorifique_kwh_par_kg) ||
        4.8;

      if (!this._season) {
        this._season = this._currentSeason;
      }

      this._refreshSelectedSeason();
      if (cfg.show_price_chart || cfg.show_maintenance_chart || cfg.show_entretien_chart) {
        this._refreshSeasonsSummary();
      }
      if (cfg.show_comparison) {
        this._refreshComparison();
      }
    }

    _seasonForDate(dateStr) {
      // Mirrors journal.py's season_for_date(): the season a given
      // calendar date belongs to, independent of whichever season is
      // currently displayed in the selector. Used so achat/consommation
      // defaults (price fallback, stock guard) are only applied when the
      // form's own date actually falls in the displayed season - never
      // borrowed from a different, currently-viewed season.
      var parts = String(dateStr || "").split("-");
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10);
      var startMonth = this._startMonth || 9;
      if (!year || !month) return this._season;
      return month >= startMonth ? year + "-" + (year + 1) : (year - 1) + "-" + year;
    }

    _applyOptimisticConsumption(qty, season, unit) {
      // Fait avancer immediatement l'affichage local (tuiles + stock)
      // pendant que le callService est en vol, pour que le bouton
      // "+1 sac aujourd'hui" paraisse instantane. _applySeasonData (issue
      // de la vraie reponse websocket) ecrase de toute facon ces valeurs
      // juste apres avec les chiffres definitifs, donc la seule
      // consequence d'un echec du service est un bref retour en arriere
      // visuel une fois l'erreur remontee (voir le .catch ci-dessus qui
      // force un refresh).
      var els = this._els;
      var cfg = this._config || DEFAULT_CONFIG;
      if (!els || season !== this._season) return;
      var bagWeight = this._bagWeight || 15;
      var calorificValue = this._calorificValue || 4.8;
      var qtyBags = unit === "kg" ? qty / bagWeight : qty;

      if (typeof this._currentStockBags === "number") {
        this._currentStockBags = Math.max(0, this._currentStockBags - qtyBags);
        if (els.stock) els.stock.textContent = this._entryUnit === "kg" ? fmt(this._currentStockBags * bagWeight, 1) + " kg" : fmt(this._currentStockBags, 1) + " sac(s)";
        if (els.stockSub) els.stockSub.textContent = this._entryUnit === "kg" ? "" : fmt(this._currentStockBags * bagWeight, 0) + " kg restant(s)";
        if (els.btnConso) els.btnConso.disabled = this._currentStockBags <= 0;
      }

            if (typeof this._currentConsumedBags === "number") { this._currentConsumedBags += qtyBags; } var newConsumed = this._currentConsumedBags; if (cfg.show_stats && els.statConsomme && typeof newConsumed === "number") { els.statConsomme.textContent = this._entryUnit === "kg" ? fmt(newConsumed * bagWeight, 1) + " kg" : fmt(newConsumed, 1) + " sac(s)"; if (els.statEnergie) { els.statEnergie.textContent = fmt(newConsumed * bagWeight * calorificValue, 1) + " kWh"; } }  if (this._lastChartData && this._lastChartData.entries && typeof this._renderChart === "function") { var todayISO = todayIso(); var newChartEntries = this._lastChartData.entries.slice(); newChartEntries.push({
          type: "consumption",
          date: todayISO,
          unit: unit,
          qty_kg: unit === "kg" ? qty : undefined,
          qty_bags: unit === "bag" ? qtyBags : undefined
        }); this._renderChart(newChartEntries, this._lastChartData.startMonth, this._lastChartData.avgPricePerBag); } if (els.historyList && !this._openEditRow) { this._renderHistory(newChartEntries); }
      if (els.calGrid) {
        this._calendarEntries = newChartEntries;
        this._renderCalendar();
      }
    }

    _populateFormSeasonSelect(select, dateStr) {
      var startMonth = this._startMonth || 9;
      var inferred = this._seasonForDate(dateStr);
      var known = this._knownSeasons || [];
      var years = [];
      var now = new Date();
      var currentYear = now.getFullYear();
      var currentMonth = now.getMonth() + 1;
      var currentSeasonStartYear =
        currentMonth >= startMonth ? currentYear : currentYear - 1;
      [-1, 0, 1].forEach(function (offset) {
        var y = currentSeasonStartYear + offset;
        years.push(y + "-" + (y + 1));
      });
      if (inferred && years.indexOf(inferred) === -1) {
        years.push(inferred);
      }
      known.forEach(function (s) {
        if (years.indexOf(s) === -1) years.push(s);
      });
      years.sort();
      var previousValue = select.value;
      select.innerHTML = "";
      var placeholderOpt = document.createElement("option");
      placeholderOpt.value = "";
      placeholderOpt.textContent = "Choisir saison";
      placeholderOpt.disabled = true;
      select.appendChild(placeholderOpt);
      years.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        select.appendChild(opt);
      });
      // "Choisir saison" est un placeholder desactive une fois
      // quitte : impossible de revenir dessus par erreur. Contrairement
      // a l'ancienne option "Auto", il ne selectionne jamais une saison
      // implicitement - la saisie reste bloquee (voir le controle au
      // clic sur le bouton "Enregistrer") tant que l'utilisateur n'a
      // pas choisi une vraie saison lui-meme (cas reel : achat le
      // 16/07 laisse sur "Auto", classe silencieusement dans
      // l'ancienne saison au lieu de la suivante).
      select.value =
        previousValue && years.indexOf(previousValue) !== -1 ? previousValue : "";
    }

    _refreshSelectedSeason() {
      var self = this;
      if (!this._hass || !this._hass.connection || !this._season) return;
      var season = this._season;
      var now = Date.now();
      if (this._seasonDataPending) {
        this._seasonDataDirty = true;
        return;
      }
      if (
        !this._seasonDataDirty &&
        this._seasonDataFetchedFor === season &&
        this._seasonDataFetchedAt &&
        now - this._seasonDataFetchedAt < 15000
      ) {
        return;
      }
      this._seasonDataDirty = false;
      this._seasonDataPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/journal", season: season })
        .then(function (result) {
          self._seasonDataPending = false;
          self._seasonDataFetchedFor = season;
          self._seasonDataFetchedAt = Date.now();
          self._applySeasonData(result);
          if (self._seasonDataDirty) {
            self._seasonDataDirty = false;
            self._refreshSelectedSeason();
          }
        })
        .catch(function () {
          self._seasonDataPending = false;
        });
    }

    _applySeasonData(result) {
      var els = this._els;
      var cfg = this._config || DEFAULT_CONFIG;
      var entryUnit = this._entryUnit === "kg" ? "kg" : "bag";
      var totals = result.totals || {};
      var entries = result.entries || [];
      var startMonth = result.start_month || 9;
      this._startMonth = startMonth;
      var isCurrentSeason = this._season === this._currentSeason;
      var bagWeight = this._bagWeight || 15;
      var calorificValue = this._calorificValue || 4.8;

      var seasons = (result.seasons || []).slice();
      if (this._currentSeason && seasons.indexOf(this._currentSeason) === -1) {
        seasons.push(this._currentSeason);
      }
      this._populateSeasonSelect(seasons);
      this._knownSeasons = seasons;
      if (els.consoSeasonSelect) {
        this._populateFormSeasonSelect(els.consoSeasonSelect, todayIso());
      }
      if (els.achatSeasonSelect) {
        this._populateFormSeasonSelect(els.achatSeasonSelect, todayIso());
      }
      if (els.maintenanceSeasonSelect) {
        this._populateFormSeasonSelect(els.maintenanceSeasonSelect, todayIso());
      }
      if (els.entretienSeasonSelect) {
        this._populateFormSeasonSelect(els.entretienSeasonSelect, todayIso());
      }

      var stockBags = Number(totals.stock_bags) || 0;
      this._currentStockBags = stockBags;
      var stockBagsRaw = totals.stock_bags_raw;
      if (els.stockAlert) {
        if (typeof stockBagsRaw === "number" && stockBagsRaw < 0) {
          els.stockAlert.textContent = entryUnit === "kg" ? "⚠ Stock incohérent : " + fmt(stockKg, 1) + " kg réel(s) pour cette saison (négatif). Vérifiez vos saisies (achats/consommations)." : "⚠ Stock incohérent : " + fmt(stockBagsRaw, 1) + " sac(s) réel(s) pour cette saison (négatif). Vérifiez vos saisies (achats/consommations).";
          els.stockAlert.style.display = "block";
        } else {
          els.stockAlert.style.display = "none";
        }
      }
      if (els.btnConso) {
        els.btnConso.disabled = isCurrentSeason && stockBags <= 0;
      }
      var consumedBags = totals.consumed_bags || 0;
      this._currentConsumedBags = consumedBags;
      var purchasedBags = Number(totals.purchased_bags) || 0;
      var purchasedKg = Number(totals.purchased_kg);
      if (!Number.isFinite(purchasedKg)) purchasedKg = purchasedBags * bagWeight;
      var spentEur = Number(totals.spent_eur) || 0;
      var daysLogged = Number(totals.days_logged) || 0;

      var stockKg = Number(totals.stock_kg);
      if (!Number.isFinite(stockKg)) stockKg = stockBags * bagWeight;
      var consumedKg = Number(totals.consumed_kg);
      if (!Number.isFinite(consumedKg)) consumedKg = consumedBags * bagWeight;
      var consommeKwh = Number(totals.consumed_kwh);
      if (!Number.isFinite(consommeKwh)) consommeKwh = consumedKg * calorificValue;

      els.stock.textContent = entryUnit === "kg" ? fmt(stockKg, 0) + " kg" : fmt(stockBags, 1) + " sac(s)";
      els.stockSub.textContent = entryUnit === "kg" ? "" : fmt(stockKg, 0) + " kg restant(s)";

      // Prix moyen ponderé par kg : vient du backend (totals.avg_price_per_kg),
            // pas recalculé ici à partir des seuls achats de la saison. Le backend
            // le pondère avec le stock reporté de la saison précédente (méthode
            // PEPS) ; spentEur / purchasedKg ignorait ce stock reporté et donnait
            // un prix erroné dès qu'un achat de cette saison a un prix différent
            // du stock déjà en réserve.
            var avgPricePerKg = Number(totals.avg_price_per_kg) || 0;
      var avgPricePerBag = avgPricePerKg > 0 ? avgPricePerKg * bagWeight : 0;
      this._currentAvgPricePerBag = avgPricePerBag;
      this._currentAvgPricePerKg = avgPricePerKg;

      if (cfg.show_stats) {
        els.statConsomme.textContent = entryUnit === "kg" ? fmt(consumedKg, 0) + " kg" : fmt(consumedBags, 1) + " sac(s)";
        els.statEnergie.textContent = fmt(consommeKwh, 1) + " kWh";
        els.statDepense.textContent = fmt(spentEur, 2) + " €";
        els.statJours.textContent = String(daysLogged);
      }

      if (cfg.show_cost_stats) {
        var pricePerKg = Number(totals.avg_price_per_kg) || 0;
        var pricePerUnit = entryUnit === "kg"
          ? pricePerKg
          : (pricePerKg ? pricePerKg * bagWeight : 0);
        var costToDate = pricePerKg ? consumedKg * pricePerKg : 0;
        var costPerDay = daysLogged > 0 ? costToDate / daysLogged : 0;
        var costPerMonth = costPerDay * 30.44;

        els.statCoutJour.textContent = fmt(costPerDay, 2) + " €";
        els.statCoutMois.textContent = fmt(costPerMonth, 2) + " €";
        els.statCoutSac.textContent = pricePerUnit ? fmt(pricePerUnit, 2) + " €" : "--";
        els.statCoutAnnee.textContent = fmt(costToDate, 2) + " €";
        if (els.statCoutMaintenance) els.statCoutMaintenance.textContent = fmt(Number(totals.maintenance_eur) || 0, 2) + " €";
        if (els.statCoutEntretien) els.statCoutEntretien.textContent = fmt(Number(totals.entretien_eur) || 0, 2) + " €";
      }

      if (els.historyList && !this._openEditRow) {
        this._renderHistory(entries);
      }
      if (els.chart) {
        this._renderChart(entries, startMonth, avgPricePerBag);
      }
      if (els.calGrid) {
        this._calendarEntries = entries;

        // Repositionne automatiquement le calendrier sur un mois qui
        // contient des données lorsque l'utilisateur change de saison.
        // Cela évite d'afficher par défaut septembre 2026 pour une saison
        // historique (ex. 2024-2025), ce qui donnait un calendrier vide
        // alors que les saisies existaient bien dans la saison consultée.
        if (this._calendarSeason !== this._season) {
          this._calendarSeason = this._season;

          if (entries.length) {
            var latestDate = entries.reduce(function (latest, entry) {
              return !latest || entry.date > latest ? entry.date : latest;
            }, null);
            var latestParts = String(latestDate).split("-");
            this._calendarYear = parseInt(latestParts[0], 10);
            this._calendarMonth = parseInt(latestParts[1], 10);
          } else {
            var today = new Date();
            this._calendarYear = today.getFullYear();
            this._calendarMonth = today.getMonth() + 1;
          }
        } else if (this._calendarYear === undefined || this._calendarMonth === undefined) {
          var today2 = new Date();
          this._calendarYear = today2.getFullYear();
          this._calendarMonth = today2.getMonth() + 1;
        }

        this._renderCalendar();
      }

      var isCurrent = this._season === this._currentSeason;
    if (els.btnQuick) {
      els.btnQuick.classList.toggle("hidden", !isCurrent);
    }
      if (els.actionsWrap) {
        els.actionsWrap.classList.remove("hidden");
      }
      if (els.seasonNote) {
        els.seasonNote.textContent = isCurrent
          ? ""
          : "Vous consultez une saison passée : la date choisie dans le formulaire détermine la saison de la saisie.";
      }
    }

    _populateSeasonSelect(seasons) {
      var select = this._els.season;
      if (!select) return;
      var self = this;
      var ordered = seasons.slice().sort().reverse();
      if (this._season && ordered.indexOf(this._season) === -1) {
        // The season currently being browsed has no entries yet (e.g. a
        // past season with nothing logged, or a submission that just
        // failed) and is therefore absent from the backend's seasons
        // list. Without a matching <option>, "select.value = this._season"
        // below silently no-ops and the browser falls back to showing the
        // first option (the current season) - which looks like the
        // selector jumped away from the season the user is on, even
        // though _season itself never changed. Add a synthetic option so
        // the visible selector always matches what is actually browsed.
        ordered.push(this._season);
        ordered.sort().reverse();
      }
      select.innerHTML = "";
      ordered.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s === self._currentSeason ? s + " (actuelle)" : s;
        select.appendChild(opt);
      });
      select.value = this._season;
    }

    _refreshSeasonsSummary() {
      var self = this;
      if (this._seasonsPending) {
        this._seasonsDirty = true;
        return;
      }
      var now = Date.now();
      if (!this._seasonsDirty && this._seasonsFetchedAt && now - this._seasonsFetchedAt < 15000) return;
      if (!this._hass || !this._hass.connection || (!this._els.priceChart && !this._els.maintenanceChart && !this._els.entretienChart)) return;
      this._seasonsDirty = false;
      this._seasonsPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/seasons_summary", entry_id: self._entryId })
        .then(function (result) {
          self._seasonsPending = false;
          self._seasonsFetchedAt = Date.now();
          if (result.display_unit === "kg" || result.display_unit === "bag") {
            self._entryUnit = result.display_unit;
            self._seasonsDisplayUnit = result.display_unit;
          }
          self._renderPriceChart(result.seasons || []);
          if (self._els.maintenanceChart) {
            self._renderCostChart(result.seasons || [], "maintenance_eur", COLORS.teal, self._els.maintenanceChart, "Coût maintenance (€)");
          }
          if (self._els.entretienChart) {
            self._renderCostChart(result.seasons || [], "entretien_eur", COLORS.pink, self._els.entretienChart, "Coût entretien (€)");
          }
          if (self._seasonsDirty) {
            self._seasonsDirty = false;
            self._refreshSeasonsSummary();
          }
        })
        .catch(function () {
          self._seasonsPending = false;
        });
    }

    _refreshComparison() {
      var self = this;
      if (this._comparisonPending) {
        this._comparisonDirty = true;
        return;
      }
      var now = Date.now();
      if (!this._comparisonDirty && this._comparisonFetchedAt && now - this._comparisonFetchedAt < 15000) return;
      if (!this._hass || !this._hass.connection || !this._els.comparison || !this._season) return;
      this._comparisonDirty = false;
      this._comparisonPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/season_comparison", season: this._season })
        .then(function (result) {
          self._comparisonPending = false;
          self._comparisonFetchedAt = Date.now();
          self._renderComparison(result);
          if (self._comparisonDirty) {
            self._comparisonDirty = false;
            self._refreshComparison();
          }
        })
        .catch(function () {
          self._comparisonPending = false;
        });
    }

    _renderComparison(result) {
      var self = this;
      var entryUnit = this._entryUnit === "kg" ? "kg" : "bag";
      var els = this._els;
      if (!els.comparison) return;
      var current = result.current_consumed_bags;
      var previous = result.previous_consumed_bags;
      var currentQty = entryUnit === "kg" ? result.current_consumed_kg : current;
      var previousQty = entryUnit === "kg" ? result.previous_consumed_kg : previous;
      var unitLabel = entryUnit === "kg" ? " kg" : " sac(s)";
      var pct = result.pct_diff;

      if (previous === null || previous === undefined) {
        els.comparisonMain.textContent = fmt(currentQty, entryUnit === "kg" ? 0 : 1) + unitLabel + " consommé" + (entryUnit === "kg" ? "" : "(s)");
        els.comparisonSub.textContent = "Pas de saison précédente pour comparer à date égale.";
        els.comparisonBadge.textContent = "";
        els.comparisonBadge.className = "comparison-badge";
        els.comparisonEuro.textContent = "";
        return;
      }

      els.comparisonMain.textContent = fmt(currentQty, 1) + unitLabel + " vs " + fmt(previousQty, 1) + unitLabel + " l'an dernier";
      els.comparisonSub.textContent = "à la même date (saison " + result.previous_season + ")";

      var currentEur = result.current_spent_eur;
      var previousEur = result.previous_spent_eur;
      if (previousEur === null || previousEur === undefined) {
        els.comparisonEuro.textContent = "";
      } else {
        var eurDiff = result.eur_diff;
        var eurSign = eurDiff > 0 ? "+" : "";
        els.comparisonEuro.textContent =
          fmt(currentEur, 2) + " € vs " + fmt(previousEur, 2) + " € l'an dernier (" + eurSign + fmt(eurDiff, 2) + " €)";
        els.comparisonEuro.className =
          "comparison-euro " + (eurDiff > 0 ? "up" : eurDiff < 0 ? "down" : "");
      }

      if (pct === null || pct === undefined) {
        els.comparisonBadge.textContent = "";
        els.comparisonBadge.className = "comparison-badge";
      } else {
        var sign = pct > 0 ? "+" : "";
        els.comparisonBadge.textContent = sign + fmt(pct, 1) + " %";
        els.comparisonBadge.className = "comparison-badge " + (pct > 0 ? "up" : pct < 0 ? "down" : "");
      }
    }

    _renderHistory(entries) {
      var self = this;
      var list = this._els.historyList;
      list.innerHTML = "";
      if (!entries.length) {
        var empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Aucune saisie pour cette saison.";
        list.appendChild(empty);
        return;
      }
      var indexed = entries.map(function (entry, idx) {
        return { entry: entry, index: idx };
      });
      var recent = indexed.slice().reverse();
      recent.forEach(function (item) {
        var entry = item.entry;
        var entryIndex = item.index;
        var row = document.createElement("div");
        row.className = "history-row";
        var isConso = entry.type === "consumption";
        var isMaintenance = entry.type === "maintenance";
        var isEntretien = entry.type === "entretien";
        var isCostEntry = isMaintenance || isEntretien;

        var dot = document.createElement("div");
        dot.className = "history-dot";
        var dotColor = isCostEntry
          ? (isMaintenance ? COLORS.teal : COLORS.pink)
          : (isConso ? COLORS.red : COLORS.green);
        dot.style.background = "rgba(" + dotColor + ", 0.2)";
        var dotIconName = isMaintenance ? "mdi:wrench" : isEntretien ? "mdi:broom" : isConso ? "mdi:fire" : "mdi:cart";
        var dotIcon = icon(dotIconName);
        dotIcon.style.color = "rgb(" + dotColor + ")";
        dot.appendChild(dotIcon);

        var label = document.createElement("span");
        label.className = "history-label";
        var typeLabel = isMaintenance ? "Maintenance" : isEntretien ? "Entretien" : isConso ? "Consommation" : "Achat";
        label.textContent = typeLabel + " · " + entry.date + (isCostEntry && entry.note ? " · " + entry.note : "");

        var value = document.createElement("span");
        value.className = "history-value";
        if (isCostEntry) {
          value.textContent = fmt(entry.price_eur, 2) + " €";
        } else {
          var histUnit = entryUnit(entry);
          var histQty = entryQtyDisplay(entry, histUnit, self._bagWeight || 15);
          value.textContent =
            fmt(histQty, histUnit === "kg" ? 1 : 1) + (histUnit === "kg" ? " kg" : " sac(s)") +
            (entry.price_eur ? " · " + fmt(entry.price_eur, 2) + " €" : "");
        }

        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "history-edit-btn";
        editBtn.appendChild(icon("mdi:pencil"));

        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(value);
        row.appendChild(editBtn);
        list.appendChild(row);

        editBtn.addEventListener("click", function () {
          self._toggleEditEntry(row, entry, entryIndex);
        });
      });
    }

    _toggleEditEntry(row, entry, index) {
      var self = this;
      if (row.dataset.editing === "1") {
        if (row._restoreRow) row._restoreRow();
        row.dataset.editing = "";
        row.classList.remove("editing");
        this._openEditRow = null;
        return;
      }
      if (this._openEditRow && this._openEditRow._restoreRow) {
        this._openEditRow._restoreRow();
        this._openEditRow.dataset.editing = "";
        this._openEditRow.classList.remove("editing");
      }
      row.dataset.editing = "1";
      row.classList.add("editing");
      this._openEditRow = row;

      var isPurchase = entry.type === "purchase";
      var isCostEntry = entry.type === "maintenance" || entry.type === "entretien";
      var editUnit = entryUnit(entry);
      var qtyNow = entryQtyDisplay(entry, editUnit, self._bagWeight || 15);
      var pricePerUnitNow = isPurchase && entry.price_eur && qtyNow ? entry.price_eur / qtyNow : "";

      var toHide = [].slice.call(row.children);
      toHide.forEach(function (el) {
        el.style.display = "none";
      });

      var form = document.createElement("div");
      form.className = "history-edit-form";

      var row1 = document.createElement("div");
      row1.className = "history-edit-form-row";

      var qtyInput = null;
      var costPriceInput = null;
      var noteInput = null;
      if (isCostEntry) {
        costPriceInput = document.createElement("input");
        costPriceInput.type = "number";
        costPriceInput.step = "0.01";
        costPriceInput.min = "0";
        costPriceInput.placeholder = "Coût (€)";
        costPriceInput.value = entry.price_eur != null ? entry.price_eur : "";
        row1.appendChild(costPriceInput);
      } else {
        qtyInput = document.createElement("input");
        qtyInput.type = "number";
        qtyInput.step = "0.1";
        qtyInput.min = "0.1";
        qtyInput.value = qtyNow;
        row1.appendChild(qtyInput);
      }

      var dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = entry.date;
      row1.appendChild(dateInput);

      var priceInput = null;
      if (isPurchase) {
        priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.step = "0.01";
        priceInput.min = "0";
        priceInput.placeholder = editUnit === "kg" ? "Prix/kg" : "Prix/sac";
        priceInput.value = pricePerUnitNow ? Number(pricePerUnitNow).toFixed(2) : "";
        row1.appendChild(priceInput);
      }
      if (isCostEntry) {
        noteInput = document.createElement("input");
        noteInput.type = "text";
        noteInput.placeholder = "Note";
        noteInput.value = entry.note || "";
        row1.appendChild(noteInput);
      }

      var seasonSelect = document.createElement("select");
      seasonSelect.title = "Saison de cette saisie";
      row1.appendChild(seasonSelect);
      self._populateFormSeasonSelect(seasonSelect, entry.date);
      if ([].slice.call(seasonSelect.options).every(function (o) { return o.value !== self._season; })) {
        var currentOpt = document.createElement("option");
        currentOpt.value = self._season;
        currentOpt.textContent = self._season;
        seasonSelect.appendChild(currentOpt);
      }
      seasonSelect.value = self._season;

      form.appendChild(row1);

      var row2 = document.createElement("div");
      row2.className = "history-edit-form-actions";
      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.appendChild(icon("mdi:check"));
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.appendChild(icon("mdi:close"));
      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "history-delete-btn";
      deleteBtn.appendChild(icon("mdi:trash-can-outline"));
      row2.appendChild(saveBtn);
      row2.appendChild(deleteBtn);
      row2.appendChild(cancelBtn);
      form.appendChild(row2);

      row.appendChild(form);

      row._restoreRow = function () {
        toHide.forEach(function (el) {
          el.style.display = "";
        });
        if (form.parentNode) form.parentNode.removeChild(form);
      };

      cancelBtn.addEventListener("click", function () {
        row._restoreRow();
        row.dataset.editing = "";
        row.classList.remove("editing");
        self._openEditRow = null;
      });

      saveBtn.addEventListener("click", function () {
        var data;
        if (isCostEntry) {
          var price = parseFloat(costPriceInput.value);
          if (isNaN(price) || price < 0) return;
          data = { season: self._season, index: index, date: dateInput.value, price_eur: price, note: noteInput.value || "" };
        } else {
          var qty = parseFloat(qtyInput.value);
          if (!qty || qty <= 0) return;
          data = { season: self._season, index: index, date: dateInput.value, unit: editUnit };
          if (editUnit === "kg") data.qty_kg = qty;
          else data.qty_bags = qty;
          if (isPurchase && priceInput.value) {
            data.price_eur = parseFloat(priceInput.value) * qty;
          }
        }
        if (seasonSelect.value && seasonSelect.value !== self._season) {
          data.new_season = seasonSelect.value;
        }
        self._hass.callService("suivi_stock_pellet", "edit_entry", data)
          .then(function () {
            self._seasonDataFetchedAt = 0;
            self._seasonDataDirty = true;
            self._seasonsFetchedAt = 0;
            self._seasonsDirty = true;
            row.dataset.editing = "";
            row.classList.remove("editing");
            self._openEditRow = null;
          })
          .catch(function (err) {
            window.alert(err && err.message ? err.message : "Impossible de modifier cette saisie.");
          });
      });

      deleteBtn.addEventListener("click", function () {
        if (!window.confirm("Supprimer cette saisie ?")) return;
          self._hass.callService("suivi_stock_pellet", "delete_entry", {
            season: self._season,
            index: index
          })
            .then(function () {
              self._seasonDataFetchedAt = 0;
              self._seasonDataDirty = true;
              self._seasonsFetchedAt = 0;
              self._seasonsDirty = true;
              row.dataset.editing = "";
              row.classList.remove("editing");
              self._openEditRow = null;
            })
            .catch(function (err) {
              window.alert(err && err.message ? err.message : "Impossible de supprimer cette saisie.");
            });
        });
    }

    _renderCalendar() {
      var self = this;
      var els = this._els;
      if (!els || !els.calGrid) return;
      var entries = this._calendarEntries || [];
      var year = this._calendarYear;
      var month = this._calendarMonth;

      els.calLabel.textContent = MONTHS_FULL_FR[month] + " " + year;

      var byDay = {};
      entries.forEach(function (entry) {
        var parts = entry.date.split("-");
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);
        var d = parseInt(parts[2], 10);
        if (y !== year || m !== month) return;
        if (!byDay[d]) byDay[d] = { purchase: 0, consumption: 0, maintenance: 0, entretien: 0 };
        if (entry.type === "purchase") {
          byDay[d].purchase += entryQtyDisplay(entry, self._entryUnit, self._bagWeight || 15);
        } else if (entry.type === "consumption") {
          byDay[d].consumption += entryQtyDisplay(entry, self._entryUnit, self._bagWeight || 15);
        } else if (entry.type === "maintenance") {
          byDay[d].maintenance += Number(entry.price_eur) || 0;
        } else if (entry.type === "entretien") {
          byDay[d].entretien += Number(entry.price_eur) || 0;
        }
      });

      var grid = els.calGrid;
      grid.innerHTML = "";
      var DOW = ["L", "M", "M", "J", "V", "S", "D"];
      DOW.forEach(function (d) {
        var dowCell = document.createElement("div");
        dowCell.className = "calendar-dow";
        dowCell.textContent = d;
        grid.appendChild(dowCell);
      });

      var firstDow = new Date(year, month - 1, 1).getDay();
      firstDow = firstDow === 0 ? 6 : firstDow - 1;
      var daysInMonth = new Date(year, month, 0).getDate();

      for (var i = 0; i < firstDow; i++) {
        grid.appendChild(document.createElement("div"));
      }

      for (let day = 1; day <= daysInMonth; day++) {
        let cell = document.createElement("div");
        cell.className = "calendar-cell";
        var info = byDay[day];
        if (info && info.purchase > 0) {
          cell.classList.add("purchase");
        }
        if (info && info.consumption > 0) {
          cell.classList.add("consumption");
        }
        if (info && info.maintenance > 0) {
          cell.classList.add("maintenance");
        }
        if (info && info.entretien > 0) {
          cell.classList.add("entretien");
        }
        cell.textContent = String(day);
        if (info) {
          var parts2 = [];
          if (info.purchase > 0) parts2.push("Achat : " + fmt(info.purchase, 1) + (self._entryUnit === "kg" ? " kg" : " sac(s)"));
          if (info.consumption > 0) parts2.push("Consommation : " + fmt(info.consumption, 1) + (self._entryUnit === "kg" ? " kg" : " sac(s)"));
          if (info.maintenance > 0) parts2.push("Maintenance : " + fmt(info.maintenance, 2) + " €");
          if (info.entretien > 0) parts2.push("Entretien : " + fmt(info.entretien, 2) + " €");
          cell.title = parts2.join(" \u00b7 ");
          cell.addEventListener("touchstart", function (e) {
                  cell.__tsX = e.touches[0].clientX;
                  cell.__tsY = e.touches[0].clientY;
                }, { passive: true });
                cell.addEventListener("touchend", function (e) {
                  var dx = Math.abs((e.changedTouches[0].clientX) - (cell.__tsX || 0));
                  var dy = Math.abs((e.changedTouches[0].clientY) - (cell.__tsY || 0));
                  if (dx < 10 && dy < 10) {
                    e.preventDefault();
                    cell.click();
                  }
                });
                cell.addEventListener("click", function () {
            var oldRoot = cell.getRootNode();
            var old = (oldRoot === document ? document : oldRoot).querySelector(".calendar-tip");
            if (old) old.remove();
            var r = cell.getBoundingClientRect();
            var tip = document.createElement("div");
            tip.className = "calendar-tip";
            tip.textContent = cell.title;
            tip.style.position = "fixed";
            tip.style.left = (r.left + r.width / 2) + "px";
            tip.style.top = (r.top - 10) + "px";
            tip.style.transform = "translate(-50%, -100%)";
            var tipRoot = cell.getRootNode();
            (tipRoot === document ? document.body : tipRoot).appendChild(tip);
            setTimeout(function () {
              if (tip.parentNode) tip.parentNode.removeChild(tip);
            }, 2000);
          });
        }
        grid.appendChild(cell);
      }
    }

    _renderChart(entries, startMonth, avgPricePerBag) {
      var self = this;
      var container = this._els.chart;
      if (!container) return;
      this._lastChartData = {
        entries: entries,
        startMonth: startMonth,
        avgPricePerBag: avgPricePerBag
      };
      container.innerHTML = "";

      container.style.position = "relative";
      var tapTip = document.createElement("div");
      tapTip.className = "chart-tap-tip";
      tapTip.style.cssText = "display:none;position:absolute;top:2px;transform:translateX(-50%);background:rgba(28,28,28,0.92);color:#fff;font-size:11px;padding:3px 6px;border-radius:4px;white-space:nowrap;pointer-events:none;z-index:2;";
      container.appendChild(tapTip);
      var showTapTip = function (evt, text) {
        var box = container.getBoundingClientRect();
        var px = (evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX) - box.left;
        tapTip.textContent = text;
        tapTip.style.left = Math.max(20, Math.min(px, box.width - 20)) + "px";
        tapTip.style.display = "block";
        clearTimeout(tapTip._hideTimer);
        tapTip._hideTimer = setTimeout(function () { tapTip.style.display = "none"; }, 2200);
      };

      var visible = this._chartVisible || { qty: true, cost: true };
      // Quand une seule des deux courbes est affichee (l'autre a ete
      // desactivee via les boutons de legende), on ajoute les valeurs en
      // clair directement sur le graphique (au-dessus de chaque barre /
      // point), en plus du survol/tap qui reste inchange - cf demande de
      // Frederic : "afficher les sacs/mois et le cout/mois directement
      // sur la courbe quand une seule des deux est affichee, en gardant
      // le survol".
      var singleSeries = visible.qty !== visible.cost;

      var months = [];
      for (var i = 0; i < 12; i++) {
        months.push(((startMonth - 1 + i) % 12) + 1);
      }

      var qtyBuckets = months.map(function () {
        return 0;
      });
      entries.forEach(function (entry) {
        if (entry.type !== "consumption") return;
        var m = parseInt(entry.date.split("-")[1], 10);
        var idx = months.indexOf(m);
        if (idx !== -1) qtyBuckets[idx] += entryQtyDisplay(entry, self._entryUnit, self._bagWeight || 15);
      });
      var unitPricePerKg = Number(this._currentAvgPricePerKg || 0);
      if (!unitPricePerKg && avgPricePerBag) unitPricePerKg = Number(avgPricePerBag) / (self._bagWeight || 15);
      var unitPrice = self._entryUnit === "kg" ? unitPricePerKg : unitPricePerKg * (self._bagWeight || 15);
      var costBuckets = qtyBuckets.map(function (q) {
        return unitPrice ? q * unitPrice : 0;
      });

      if (!visible.qty && !visible.cost) {
        var note = document.createElement("div");
        note.className = "chart-empty-note";
        note.textContent = "Sélectionnez au moins une courbe.";
        container.appendChild(note);
        return;
      }

      var width = 300;
      var height = 78;
      var padX = 12;
      var padTop = singleSeries ? 16 : 10;
      var padBottom = 20;
      var plotHeight = height - padTop;
      var n = months.length;
      var slotW = (width - padX * 2) / n;

      function xCenter(idx) {
        return padX + slotW * (idx + 0.5);
      }

      var qtyMax = Math.max.apply(null, qtyBuckets.concat([0.0001]));
      var costMax = Math.max.apply(null, costBuckets.concat([0.0001]));
      var minBarPx = 3;
      var currentMonth = new Date().getMonth() + 1;

      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 " + width + " " + (height + padBottom));
      svg.setAttribute("preserveAspectRatio", "none");

      if (visible.qty) {
        var barW = slotW * 0.5;
        months.forEach(function (m, idx) {
          var v = qtyBuckets[idx];
          var h = qtyMax > 0 ? Math.max(minBarPx, (v / qtyMax) * plotHeight) : minBarPx;
          var x = xCenter(idx) - barW / 2;
          var y = padTop + (plotHeight - h);
          var rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", x);
          rect.setAttribute("y", y);
          rect.setAttribute("width", barW);
          rect.setAttribute("height", h);
          rect.setAttribute("rx", 2);
          rect.setAttribute("fill", v === 0 ? "rgba(127,127,127,0.3)" : "rgb(239, 83, 80)");
          var t = document.createElementNS(svgNS, "title");
          t.textContent = MONTHS_FR[m] + " : " + fmt(v, 1) + (self._entryUnit === "kg" ? " kg" : " sac(s)");
          rect.appendChild(t);
          rect.addEventListener("pointerdown", function (evt) {
            showTapTip(evt, MONTHS_FR[m] + " : " + fmt(v, 1) + (self._entryUnit === "kg" ? " kg" : " sac(s)"));
          });
          svg.appendChild(rect);
          if (singleSeries) {
            var qtyLabel = document.createElementNS(svgNS, "text");
            qtyLabel.setAttribute("x", xCenter(idx));
            qtyLabel.setAttribute("y", Math.max(8, y - 4));
            qtyLabel.setAttribute("text-anchor", "middle");
            qtyLabel.setAttribute("font-size", "8");
            qtyLabel.setAttribute("font-weight", "700");
            qtyLabel.setAttribute("fill", "currentColor");
            qtyLabel.setAttribute("opacity", "0.85");
            qtyLabel.textContent = fmt(v, 1);
            svg.appendChild(qtyLabel);
          }
        });
      }

      if (visible.cost) {
        var yForCost = function (v) {
          return padTop + (costMax > 0 ? (1 - v / costMax) * plotHeight : plotHeight);
        };
        var pathD = months
          .map(function (m, idx) {
            return (idx === 0 ? "M" : "L") + xCenter(idx) + " " + yForCost(costBuckets[idx]);
          })
          .join(" ");
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathD);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "rgb(102, 187, 106)");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);

        months.forEach(function (m, idx) {
          var cy = yForCost(costBuckets[idx]);
          var dot = document.createElementNS(svgNS, "circle");
          dot.setAttribute("cx", xCenter(idx));
          dot.setAttribute("cy", cy);
          dot.setAttribute("r", "2.6");
          dot.setAttribute("fill", "rgb(102, 187, 106)");
          var t = document.createElementNS(svgNS, "title");
          t.textContent = MONTHS_FR[m] + " : " + fmt(costBuckets[idx], 2) + " €";
          dot.appendChild(t);
          dot.addEventListener("pointerdown", function (evt) {
            showTapTip(evt, MONTHS_FR[m] + " : " + fmt(costBuckets[idx], 2) + " €");
          });
          svg.appendChild(dot);
          if (singleSeries) {
            var costLabel = document.createElementNS(svgNS, "text");
            costLabel.setAttribute("x", xCenter(idx));
            costLabel.setAttribute("y", Math.max(8, cy - 6));
            costLabel.setAttribute("text-anchor", "middle");
            costLabel.setAttribute("font-size", "8");
            costLabel.setAttribute("font-weight", "700");
            costLabel.setAttribute("fill", "rgb(102, 187, 106)");
            costLabel.textContent = fmt(costBuckets[idx], 2) + " €";
            svg.appendChild(costLabel);
          }
        });
      }

      months.forEach(function (m, idx) {
        var label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", xCenter(idx));
        label.setAttribute("y", height + padBottom - 4);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "8");
        label.setAttribute("fill", m === currentMonth ? "rgb(102, 187, 106)" : "currentColor");
        label.setAttribute("opacity", m === currentMonth ? "1" : "0.65");
        label.setAttribute("font-weight", m === currentMonth ? "700" : "400");
        label.textContent = MONTHS_FR[m];
        svg.appendChild(label);
      });

      container.appendChild(svg);
    }

    _renderPriceChart(seasons) {
      var self = this;
      var container = this._els.priceChart;
      if (!container) return;
      container.innerHTML = "";

      var displayUnit = self._entryUnit === "kg" ? "kg" : "bag";
      if (this._seasonsDisplayUnit === "kg" || this._seasonsDisplayUnit === "bag") displayUnit = this._seasonsDisplayUnit;
      if (this._els.priceTitle) this._els.priceTitle.textContent = displayUnit === "kg" ? "Prix moyen du kg par saison" : "Prix moyen du sac par saison";

      var points = seasons.filter(function (s) {
        return s.avg_price_display !== null && s.avg_price_display !== undefined;
      }).map(function (s) {
        var point = Object.assign({}, s);
        point.avg_price_eur = Number(s.avg_price_display);
        return point;
      });

      if (points.length === 0) {
        var empty = document.createElement("div");
        empty.className = "price-chart-empty";
        empty.textContent = "Pas encore assez de données (au moins un achat avec prix par saison).";
        container.appendChild(empty);
        return;
      }

      var width = 300;
      var height = 90;
      var padX = 24;
      var padTop = 22;
      var padBottom = 20;
      var plotHeight = height - padTop - padBottom;
      var values = points.map(function (p) {
        return p.avg_price_eur;
      });
      var minV = Math.min.apply(null, values);
      var maxV = Math.max.apply(null, values);
      if (minV === maxV) {
        minV = minV - 1;
        maxV = maxV + 1;
      }

      var stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;

      function xFor(idx) {
        return padX + idx * stepX;
      }
      function yFor(v) {
        return padTop + (1 - (v - minV) / (maxV - minV)) * plotHeight;
      }

      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 " + width + " " + (height + padBottom));
      svg.setAttribute("preserveAspectRatio", "none");

      if (points.length > 1) {
        var pathD = points
          .map(function (p, idx) {
            return (idx === 0 ? "M" : "L") + xFor(idx) + " " + yFor(p.avg_price_eur);
          })
          .join(" ");
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathD);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "rgb(102, 187, 106)");
        path.setAttribute("stroke-width", "2.5");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
      }

      points.forEach(function (p, idx) {
        var cx = points.length > 1 ? xFor(idx) : width / 2;
        var cy = yFor(p.avg_price_eur);

        var label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", cx);
        label.setAttribute("y", cy - 10);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "9");
        label.setAttribute("font-weight", "700");
        label.setAttribute("fill", "rgb(102, 187, 106)");
        label.textContent = fmt(p.avg_price_eur, 2) + (self._entryUnit === "kg" ? " €/kg" : " €/sac");
        svg.appendChild(label);

        var dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", p.current ? "4.5" : "3.5");
        dot.setAttribute("fill", "rgb(102, 187, 106)");
        if (p.current) {
          dot.setAttribute("stroke", "rgba(255,167,38,0.35)");
          dot.setAttribute("stroke-width", "5");
        }
        svg.appendChild(dot);

        var seasonLabel = document.createElementNS(svgNS, "text");
        seasonLabel.setAttribute("x", cx);
        seasonLabel.setAttribute("y", height + padBottom - 4);
        seasonLabel.setAttribute("text-anchor", "middle");
        seasonLabel.setAttribute("font-size", "8");
        seasonLabel.setAttribute("fill", p.current ? "rgb(102, 187, 106)" : "currentColor");
        seasonLabel.setAttribute("opacity", p.current ? "1" : "0.6");
        seasonLabel.setAttribute("font-weight", p.current ? "700" : "400");
        seasonLabel.textContent = p.season;
        svg.appendChild(seasonLabel);
      });

      container.appendChild(svg);
    }

    _renderCostChart(seasons, field, color, container, emptyUnit) {
      // Courbe generique "cout par saison", calquee sur _renderPriceChart
      // mais pour une somme absolue (maintenance_eur / entretien_eur)
      // plutot qu un prix moyen pondere - toutes les saisons connues sont
      // affichees, y compris celles a 0 EUR, contrairement au graphique
      // de prix qui exclut les saisons sans aucun achat.
      var self = this;
      if (!container) return;
      container.innerHTML = "";

      var points = (seasons || []).slice().map(function (s) {
        return { season: s.season, current: s.current, value: Number(s[field]) || 0 };
      });

      if (points.length === 0) {
        var empty = document.createElement("div");
        empty.className = "price-chart-empty";
        empty.textContent = "Pas encore de données pour cette saison.";
        container.appendChild(empty);
        return;
      }

      var width = 300;
      var height = 90;
      var padX = 24;
      var padTop = 22;
      var padBottom = 20;
      var plotHeight = height - padTop - padBottom;
      var values = points.map(function (p) { return p.value; });
      var minV = Math.min.apply(null, values.concat([0]));
      var maxV = Math.max.apply(null, values.concat([0.0001]));
      if (minV === maxV) {
        minV = minV - 1;
        maxV = maxV + 1;
      }

      var stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
      function xFor(idx) { return padX + idx * stepX; }
      function yFor(v) { return padTop + (1 - (v - minV) / (maxV - minV)) * plotHeight; }

      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 " + width + " " + (height + padBottom));
      svg.setAttribute("preserveAspectRatio", "none");

      if (points.length > 1) {
        var pathD = points.map(function (p, idx) {
          return (idx === 0 ? "M" : "L") + xFor(idx) + " " + yFor(p.value);
        }).join(" ");
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", pathD);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "rgb(" + color + ")");
        path.setAttribute("stroke-width", "2.5");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
      }

      points.forEach(function (p, idx) {
        var cx = points.length > 1 ? xFor(idx) : width / 2;
        var cy = yFor(p.value);

        var label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", cx);
        label.setAttribute("y", cy - 10);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "9");
        label.setAttribute("font-weight", "700");
        label.setAttribute("fill", "rgb(" + color + ")");
        label.textContent = fmt(p.value, 2) + " €";
        svg.appendChild(label);

        var dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", p.current ? "4.5" : "3.5");
        dot.setAttribute("fill", "rgb(" + color + ")");
        if (p.current) {
          dot.setAttribute("stroke", "rgba(255,167,38,0.35)");
          dot.setAttribute("stroke-width", "5");
        }
        svg.appendChild(dot);

        var seasonLabel2 = document.createElementNS(svgNS, "text");
        seasonLabel2.setAttribute("x", cx);
        seasonLabel2.setAttribute("y", height + padBottom - 4);
        seasonLabel2.setAttribute("text-anchor", "middle");
        seasonLabel2.setAttribute("font-size", "8");
        seasonLabel2.setAttribute("fill", p.current ? "rgb(" + color + ")" : "currentColor");
        seasonLabel2.setAttribute("opacity", p.current ? "1" : "0.6");
        seasonLabel2.setAttribute("font-weight", p.current ? "700" : "400");
        seasonLabel2.textContent = p.season;
        svg.appendChild(seasonLabel2);
      });

      container.appendChild(svg);
    }
  }

  class SuiviStockPelletCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = mergeConfig(config);
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
    }

    _render() {
      this._config = mergeConfig(this._config || {});
      this._switches = this._switches || {};
      this._unitButtons = this._unitButtons || {};
      if (this._built) {
        this._syncSwitches();
        this._syncUnitButtons();
        return;
      }
      this._built = true;
      this.innerHTML = "";
      this.style.cssText = ROOT_VARS;

      var style = document.createElement("style");
      style.textContent = EDITOR_STYLE;
      this.appendChild(style);

      var self = this;
      this._switches = {};
      this._unitButtons = {};

      var unitLabel = document.createElement("div");
      unitLabel.className = "unit-label";
      unitLabel.textContent = "Mode de saisie des quantités";
      this.appendChild(unitLabel);

      var unitRow = document.createElement("div");
      unitRow.className = "unit-row";
      [{ key: "bag", label: "🛍️ Sacs" }, { key: "kg", label: "⚖️ Vrac" }].forEach(function (opt) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        btn.className = "unit-button";
        btn.setAttribute("aria-label", "Mode " + (opt.key === "kg" ? "vrac" : "sacs"));
        btn.setAttribute("aria-pressed", "false");
        btn.addEventListener("click", function () {
          self._config.entry_unit = opt.key;
          self._syncUnitButtons();
          self._emitConfigChanged();
        });
        unitRow.appendChild(btn);
        self._unitButtons[opt.key] = btn;
      });
      this.appendChild(unitRow);
      this._syncUnitButtons();

      TOGGLE_FIELDS.forEach(function (field) {
        var row = document.createElement("div");
        row.className = "row";

        var labelWrap = document.createElement("div");
        var label = document.createElement("div");
        label.className = "row-label";
        label.textContent = field.label;
        labelWrap.appendChild(label);

        var toggle = document.createElement("ha-switch");
        toggle.checked = !!self._config[field.key];
        toggle.addEventListener("change", function (ev) {
          self._config[field.key] = ev.target.checked;
          self._emitConfigChanged();
        });

        row.appendChild(labelWrap);
        row.appendChild(toggle);
        self.appendChild(row);
        self._switches[field.key] = toggle;
      });
    }

    _syncUnitButtons() {
      var unit = this._config.entry_unit === "kg" ? "kg" : "bag";
      Object.keys(this._unitButtons || {}).forEach(function (key) {
        var btn = this._unitButtons[key];
        if (!btn) return;
        btn.classList.toggle("selected", key === unit);
        btn.setAttribute("aria-pressed", key === unit ? "true" : "false");
      });
    }

    _syncSwitches() {
      var self = this;
      TOGGLE_FIELDS.forEach(function (field) {
        var sw = self._switches && self._switches[field.key];
        if (sw) sw.checked = !!self._config[field.key];
      });
    }

    _emitConfigChanged() {
      var event = new CustomEvent("config-changed", {
        detail: { config: Object.assign({}, this._config) },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }
  }

  if (!customElements.get("suivi-stock-pellet-card")) {
    customElements.define("suivi-stock-pellet-card", SuiviStockPelletCard);
  }
  if (!customElements.get("suivi-stock-pellet-card-editor-v1750")) {
    customElements.define("suivi-stock-pellet-card-editor-v1750", SuiviStockPelletCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "suivi-stock-pellet-card",
    name: "Suivi Stock Pellet",
    description: "Suivi du stock, de la consommation et des achats de granulés de bois."
  });
})();
