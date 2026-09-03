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
 *   show_history: true|false        Liste "Dernières saisies"
 *
 * Un sélecteur de saison est affiché dans l'en-tête (à droite du titre) :
 * il permet de consulter les tuiles, l'historique et le graphique mensuel
 * d'une saison passée. Les boutons de saisie (achat/consommation) restent
 * désactivés sur ces saisons car ils s'appliquent toujours à la date du
 * jour, donc à la saison en cours.
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
    ".chart-bar { width: 55%; min-width: 4px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, rgb(66,165,245), rgba(66,165,245,0.55)); transition: height 0.2s ease; }",
    ".chart-bar.empty { background: var(--divider-color, rgba(127,127,127,0.25)); }",
    ".chart-label { font-size: 0.62em; opacity: 0.65; }",
    ".chart-label.current { opacity: 1; font-weight: 700; color: var(--pellet-amber); }",
    ".chart-legend { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 8px; font-size: 0.72em; }",
    ".chart-legend-item { display: inline-flex; align-items: center; gap: 6px; border: none; background: none; cursor: pointer; padding: 3px 8px; border-radius: 999px; color: inherit; font-family: inherit; font-size: 1em; opacity: 0.9; }",
    ".chart-legend-item.inactive { opacity: 0.3; }",
    ".chart-legend-dot { width: 9px; height: 9px; border-radius: 2px; background: rgb(66,165,245); }",
    ".chart-legend-dot.amber { border-radius: 50%; background: var(--pellet-amber); }",
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
    ".history-empty { opacity: 0.6; font-style: italic; }"
  ].join("\n");

  var EDITOR_STYLE = [
    ":host { display: block; }",
    ".row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.2)); }",
    ".row:last-child { border-bottom: none; }",
    ".row-label { font-size: 0.95em; }",
    ".row-sub { font-size: 0.78em; opacity: 0.65; margin-top: 2px; }"
  ].join("\n");

  var ROOT_VARS = "--pellet-amber: #ffa726;";

  var MONTHS_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

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
    purple: "171, 71, 188"
  };

  var DEFAULT_CONFIG = {
    show_stats: true,
    show_cost_stats: true,
    show_actions: true,
    show_monthly_chart: true,
    show_price_chart: true,
    show_history: true
  };

  var TOGGLE_FIELDS = [
    { key: "show_stats", label: "Tuiles consommé / énergie / dépensé / jours" },
    { key: "show_cost_stats", label: "Tuiles coût / jour, coût / mois, coût du sac" },
    { key: "show_actions", label: "Boutons et formulaires de saisie" },
    { key: "show_monthly_chart", label: "Graphique évolution de la consommation" },
    { key: "show_price_chart", label: "Graphique prix moyen du sac par saison" },
    { key: "show_history", label: "Liste des dernières saisies" }
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
    }
    return merged;
  }

  class SuiviStockPelletCard extends HTMLElement {
    setConfig(config) {
      this._config = mergeConfig(config);
      this._built = false;
      if (this._hass) {
        this._ensureDom();
        this._render();
      }
    }

    set hass(hass) {
      this._hass = hass;
      this._ensureDom();
      this._render();
    }

    getCardSize() {
      return 6;
    }

    static getConfigElement() {
      return document.createElement("suivi-stock-pellet-card-editor");
    }

    static getStubConfig() {
      return {};
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
      });
      header.appendChild(titleWrap);
      header.appendChild(season);
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
      heroText.appendChild(stock);
      heroText.appendChild(stockSub);
      hero.appendChild(heroText);
      card.appendChild(hero);

      var els = {
        season: season,
        seasonNote: seasonNote,
        stock: stock,
        stockSub: stockSub
      };

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
        els.statDepense = addStat(stats, "Dépensé", "mdi:currency-eur", COLORS.green);
        els.statJours = addStat(stats, "Jours chauffés", "mdi:calendar-range", COLORS.blue);
        card.appendChild(stats);
      }

      if (cfg.show_cost_stats) {
        var costStats = document.createElement("div");
        costStats.className = "stats";
        els.statCoutJour = addStat(costStats, "Coût / jour", "mdi:cash-clock", COLORS.green);
        els.statCoutMois = addStat(costStats, "Coût / mois", "mdi:calendar-month", COLORS.blue);
        els.statCoutSac = addStat(costStats, "Coût du sac", "mdi:sack", COLORS.amber);
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
        btnConso.appendChild(icon("mdi:fire"));
        btnConso.appendChild(document.createTextNode("Consommation"));
        var btnAchat = document.createElement("button");
        btnAchat.type = "button";
        btnAchat.className = "secondary";
        btnAchat.appendChild(icon("mdi:cart-plus"));
        btnAchat.appendChild(document.createTextNode("Achat"));
        actions.appendChild(btnConso);
        actions.appendChild(btnAchat);
        actionsWrap.appendChild(actions);

        var formConso = this._buildForm("consumption");
        var formAchat = this._buildForm("purchase");
        actionsWrap.appendChild(formConso.el);
        actionsWrap.appendChild(formAchat.el);

        btnConso.addEventListener("click", function () {
          formAchat.el.classList.remove("visible");
          formConso.el.classList.toggle("visible");
        });
        btnAchat.addEventListener("click", function () {
          formConso.el.classList.remove("visible");
          formAchat.el.classList.toggle("visible");
        });

        var undoRow = document.createElement("div");
        undoRow.className = "undo-row";
        var undoBtn = document.createElement("button");
        undoBtn.type = "button";
        undoBtn.appendChild(icon("mdi:undo"));
        var undoLabel = document.createElement("span");
        undoLabel.textContent = "Annuler la dernière saisie";
        undoBtn.appendChild(undoLabel);
        undoRow.appendChild(undoBtn);
        actionsWrap.appendChild(undoRow);
        undoBtn.addEventListener("click", function () {
          if (undoBtn.dataset.confirm === "1") {
            self._hass.callService("suivi_stock_pellet", "undo_last_entry", {});
              self._seasonDataFetchedAt = 0;
              self._seasonsFetchedAt = 0;
            undoBtn.dataset.confirm = "";
            undoLabel.textContent = "Annuler la dernière saisie";
          } else {
            undoBtn.dataset.confirm = "1";
            undoLabel.textContent = "Sûr ? Cliquer à nouveau pour confirmer";
            setTimeout(function () {
              undoBtn.dataset.confirm = "";
              undoLabel.textContent = "Annuler la dernière saisie";
            }, 4000);
          }
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
        qtyBtn.appendChild(document.createTextNode("Sacs consommés"));

        var costBtn = document.createElement("button");
        costBtn.type = "button";
        costBtn.className = "chart-legend-item";
        var costDot = document.createElement("span");
        costDot.className = "chart-legend-dot amber";
        costBtn.appendChild(costDot);
        costBtn.appendChild(document.createTextNode("Coût (€)"));

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
        priceTitle.appendChild(document.createTextNode("Prix moyen du sac par saison"));
        var priceChart = document.createElement("div");
        priceChart.className = "price-chart";
        priceSection.appendChild(priceTitle);
        priceSection.appendChild(priceChart);
        card.appendChild(priceSection);
        els.priceChart = priceChart;
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

      this._els = els;
    }

    _buildForm(kind) {
      var self = this;
      var el = document.createElement("div");
      el.className = "form";

      var row1 = document.createElement("div");
      row1.className = "form-row";

      var qtyWrap = document.createElement("div");
      var qtyLabel = document.createElement("label");
      qtyLabel.textContent = "Nombre de sacs";
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
      if (kind === "purchase") {
        var priceWrap = document.createElement("div");
        var priceLabel = document.createElement("label");
        priceLabel.textContent = "Prix par sac (€, facultatif)";
        priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.step = "0.01";
        priceInput.min = "0";
        priceWrap.appendChild(priceLabel);
        priceWrap.appendChild(priceInput);
        el.appendChild(priceWrap);
      }

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
        if (!qty || qty <= 0) return;
        var data = { qty_bags: qty, date: dateInput.value };
        if (kind === "purchase") {
          if (priceInput.value) {
            data.price_eur = parseFloat(priceInput.value) * qty;
          }
          self._hass.callService("suivi_stock_pellet", "log_purchase", data);
        } else {
          self._hass.callService("suivi_stock_pellet", "log_consumption", data);
        }
        self._seasonDataFetchedAt = 0;
        self._seasonsFetchedAt = 0;
        el.classList.remove("visible");
        qtyInput.value = "1";
        dateInput.value = todayIso();
        if (priceInput) priceInput.value = "";
      });

      return { el: el };
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
      if (cfg.show_price_chart) {
        this._refreshSeasonsSummary();
      }
    }

    _refreshSelectedSeason() {
      var self = this;
      if (!this._hass || !this._hass.connection || !this._season) return;
      var season = this._season;
      var now = Date.now();
      if (this._seasonDataPending) return;
      if (
        this._seasonDataFetchedFor === season &&
        this._seasonDataFetchedAt &&
        now - this._seasonDataFetchedAt < 15000
      ) {
        return;
      }
      this._seasonDataPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/journal", season: season })
        .then(function (result) {
          self._seasonDataPending = false;
          self._seasonDataFetchedFor = season;
          self._seasonDataFetchedAt = Date.now();
          self._applySeasonData(result);
        })
        .catch(function () {
          self._seasonDataPending = false;
        });
    }

    _applySeasonData(result) {
      var els = this._els;
      var cfg = this._config || DEFAULT_CONFIG;
      var totals = result.totals || {};
      var entries = result.entries || [];
      var startMonth = result.start_month || 9;
      var bagWeight = this._bagWeight || 15;
      var calorificValue = this._calorificValue || 4.8;

      var seasons = (result.seasons || []).slice();
      if (this._currentSeason && seasons.indexOf(this._currentSeason) === -1) {
        seasons.push(this._currentSeason);
      }
      this._populateSeasonSelect(seasons);

      var stockBags = totals.stock_bags || 0;
      var consumedBags = totals.consumed_bags || 0;
      var purchasedBags = totals.purchased_bags || 0;
      var spentEur = totals.spent_eur || 0;
      var daysLogged = totals.days_logged || 0;

      var stockKg = stockBags * bagWeight;
      var consommeKg = consumedBags * bagWeight;
      var consommeKwh = consommeKg * calorificValue;

      els.stock.textContent = fmt(stockKg, 1) + " kg";
      els.stockSub.textContent = fmt(stockBags, 1) + " sac(s) restant(s)";

      var avgPricePerBag = purchasedBags > 0 ? spentEur / purchasedBags : 0;

      if (cfg.show_stats) {
        els.statConsomme.textContent = fmt(consommeKg, 1) + " kg";
        els.statEnergie.textContent = fmt(consommeKwh, 1) + " kWh";
        els.statDepense.textContent = fmt(spentEur, 2) + " €";
        els.statJours.textContent = String(daysLogged);
      }

      if (cfg.show_cost_stats) {
        var costToDate = avgPricePerBag ? consumedBags * avgPricePerBag : 0;
        var costPerDay = daysLogged > 0 ? costToDate / daysLogged : 0;
        var costPerMonth = costPerDay * 30.44;

        els.statCoutJour.textContent = fmt(costPerDay, 2) + " €";
        els.statCoutMois.textContent = fmt(costPerMonth, 2) + " €";
        els.statCoutSac.textContent = avgPricePerBag ? fmt(avgPricePerBag, 2) + " €" : "--";
      }

      if (els.historyList) {
        this._renderHistory(entries);
      }
      if (els.chart) {
        this._renderChart(entries, startMonth, avgPricePerBag);
      }

      var isCurrent = this._season === this._currentSeason;
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
      if (this._seasonsPending) return;
      var now = Date.now();
      if (this._seasonsFetchedAt && now - this._seasonsFetchedAt < 15000) return;
      if (!this._hass || !this._hass.connection || !this._els.priceChart) return;
      this._seasonsPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/seasons_summary" })
        .then(function (result) {
          self._seasonsPending = false;
          self._seasonsFetchedAt = Date.now();
          self._renderPriceChart(result.seasons || []);
        })
        .catch(function () {
          self._seasonsPending = false;
        });
    }

    _renderHistory(entries) {
      var list = this._els.historyList;
      list.innerHTML = "";
      if (!entries.length) {
        var empty = document.createElement("div");
        empty.className = "history-empty";
        empty.textContent = "Aucune saisie pour cette saison.";
        list.appendChild(empty);
        return;
      }
      var recent = entries.slice().reverse();
      recent.forEach(function (entry) {
        var row = document.createElement("div");
        row.className = "history-row";
        var isConso = entry.type === "consumption";

        var dot = document.createElement("div");
        dot.className = "history-dot";
        dot.style.background = isConso
          ? "rgba(" + COLORS.red + ", 0.2)"
          : "rgba(" + COLORS.green + ", 0.2)";
        var dotIcon = icon(isConso ? "mdi:fire" : "mdi:cart");
        dotIcon.style.color = isConso ? "rgb(" + COLORS.red + ")" : "rgb(" + COLORS.green + ")";
        dot.appendChild(dotIcon);

        var label = document.createElement("span");
        label.className = "history-label";
        label.textContent = (isConso ? "Consommation" : "Achat") + " · " + entry.date;

        var value = document.createElement("span");
        value.className = "history-value";
        value.textContent =
          entry.qty_bags + " sac(s)" + (entry.price_eur ? " · " + entry.price_eur + " €" : "");

        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(value);
        list.appendChild(row);
      });
    }

    _renderChart(entries, startMonth, avgPricePerBag) {
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

      var months = [];
      for (var i = 0; i < 10; i++) {
        months.push(((startMonth - 1 + i) % 12) + 1);
      }

      var qtyBuckets = months.map(function () {
        return 0;
      });
      entries.forEach(function (entry) {
        if (entry.type !== "consumption") return;
        var m = parseInt(entry.date.split("-")[1], 10);
        var idx = months.indexOf(m);
        if (idx !== -1) qtyBuckets[idx] += entry.qty_bags;
      });
      var costBuckets = qtyBuckets.map(function (q) {
        return avgPricePerBag ? q * avgPricePerBag : 0;
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
      var padTop = 10;
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
          rect.setAttribute("fill", v === 0 ? "rgba(127,127,127,0.3)" : "rgb(66,165,245)");
          var t = document.createElementNS(svgNS, "title");
          t.textContent = MONTHS_FR[m] + " : " + fmt(v, 1) + " sac(s)";
          rect.appendChild(t);
          rect.addEventListener("pointerdown", function (evt) {
            showTapTip(evt, MONTHS_FR[m] + " : " + fmt(v, 1) + " sac(s)");
          });
          svg.appendChild(rect);
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
        path.setAttribute("stroke", "#ffa726");
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
          dot.setAttribute("fill", "#ffa726");
          var t = document.createElementNS(svgNS, "title");
          t.textContent = MONTHS_FR[m] + " : " + fmt(costBuckets[idx], 2) + " €";
          dot.appendChild(t);
          dot.addEventListener("pointerdown", function (evt) {
            showTapTip(evt, MONTHS_FR[m] + " : " + fmt(costBuckets[idx], 2) + " €");
          });
          svg.appendChild(dot);
        });
      }

      months.forEach(function (m, idx) {
        var label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", xCenter(idx));
        label.setAttribute("y", height + padBottom - 4);
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("font-size", "8");
        label.setAttribute("fill", m === currentMonth ? "#ffa726" : "currentColor");
        label.setAttribute("opacity", m === currentMonth ? "1" : "0.65");
        label.setAttribute("font-weight", m === currentMonth ? "700" : "400");
        label.textContent = MONTHS_FR[m];
        svg.appendChild(label);
      });

      container.appendChild(svg);
    }

    _renderPriceChart(seasons) {
      var container = this._els.priceChart;
      if (!container) return;
      container.innerHTML = "";

      var points = seasons.filter(function (s) {
        return s.avg_price_eur !== null && s.avg_price_eur !== undefined;
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
        path.setAttribute("stroke", "#ffa726");
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
        label.setAttribute("fill", "#ffa726");
        label.textContent = fmt(p.avg_price_eur, 2) + "€";
        svg.appendChild(label);

        var dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", p.current ? "4.5" : "3.5");
        dot.setAttribute("fill", "#ffa726");
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
        seasonLabel.setAttribute("fill", p.current ? "#ffa726" : "currentColor");
        seasonLabel.setAttribute("opacity", p.current ? "1" : "0.6");
        seasonLabel.setAttribute("font-weight", p.current ? "700" : "400");
        seasonLabel.textContent = p.season;
        svg.appendChild(seasonLabel);
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
      if (this._built) {
        this._syncSwitches();
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

    _syncSwitches() {
      var self = this;
      TOGGLE_FIELDS.forEach(function (field) {
        var sw = self._switches && self._switches[field.key];
        if (sw) sw.checked = !!self._config[field.key];
      });
    }

    _emitConfigChanged() {
      var event = new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }
  }

  if (!customElements.get("suivi-stock-pellet-card")) {
    customElements.define("suivi-stock-pellet-card", SuiviStockPelletCard);
  }
  if (!customElements.get("suivi-stock-pellet-card-editor")) {
    customElements.define("suivi-stock-pellet-card-editor", SuiviStockPelletCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "suivi-stock-pellet-card",
    name: "Suivi Stock Pellet",
    description: "Suivi du stock, de la consommation et des achats de granulés de bois."
  });
})();
