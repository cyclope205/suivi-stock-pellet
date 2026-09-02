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
 */
(function () {
  "use strict";

  var STYLE = [
    "ha-card { padding: 18px 18px 14px; border-radius: 18px; overflow: hidden; position: relative; }",
    ".header { font-size: 1.15em; font-weight: 700; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }",
    ".header-title { display: flex; align-items: center; gap: 8px; }",
    ".header-title ha-icon { color: var(--pellet-amber); }",
    ".season { font-size: 0.68em; font-weight: 600; opacity: 0.85; background: var(--secondary-background-color, rgba(127,127,127,0.15)); padding: 4px 10px; border-radius: 999px; }",
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
    ".chart-legend { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; font-size: 0.72em; opacity: 0.75; }",
    ".chart-legend-dot { width: 9px; height: 9px; border-radius: 2px; background: rgb(66,165,245); }",
    ".chart-legend-dot.amber { border-radius: 50%; background: var(--pellet-amber); }",
    ".price-chart { position: relative; height: 110px; }",
    ".price-chart svg { width: 100%; height: 100%; overflow: visible; }",
    ".price-chart-empty { opacity: 0.6; font-style: italic; font-size: 0.82em; padding: 10px 0; }",
    ".history { margin-top: 12px; font-size: 0.85em; }",
    ".history-title { font-weight: 700; opacity: 0.85; margin-bottom: 6px; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.03em; }",
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
      var season = document.createElement("span");
      season.className = "season";
      header.appendChild(titleWrap);
      header.appendChild(season);
      card.appendChild(header);

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
        card.appendChild(actions);

        var formConso = this._buildForm("consumption");
        var formAchat = this._buildForm("purchase");
        card.appendChild(formConso.el);
        card.appendChild(formAchat.el);

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
        card.appendChild(undoRow);
        undoBtn.addEventListener("click", function () {
          if (undoBtn.dataset.confirm === "1") {
            self._hass.callService("suivi_stock_pellet", "undo_last_entry", {});
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
        chart.className = "chart";
        var chartLegend = document.createElement("div");
        chartLegend.className = "chart-legend";
        var chartLegendDot = document.createElement("span");
        chartLegendDot.className = "chart-legend-dot";
        var chartLegendLabel = document.createElement("span");
        chartLegendLabel.textContent = "Sacs consommés";
        chartLegend.appendChild(chartLegendDot);
        chartLegend.appendChild(chartLegendLabel);
        chartSection.appendChild(chartTitle);
        chartSection.appendChild(chart);
        chartSection.appendChild(chartLegend);
        card.appendChild(chartSection);
        els.chart = chart;
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
        priceLabel.textContent = "Prix total (€, facultatif)";
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
            data.price_eur = parseFloat(priceInput.value);
          }
          self._hass.callService("suivi_stock_pellet", "log_purchase", data);
        } else {
          self._hass.callService("suivi_stock_pellet", "log_consumption", data);
        }
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
      var consommeId = findEntity(hass, KEYS.consomme_kg);
      var energieId = findEntity(hass, KEYS.consomme_kwh);
      var acheteId = findEntity(hass, KEYS.achete_kg);
      var depenseId = findEntity(hass, KEYS.depense);
      var joursId = findEntity(hass, KEYS.jours);

      if (!stockId) {
        els.stock.textContent = "Intégration non configurée";
        return;
      }

      var stockState = hass.states[stockId];
      var attrs = stockState.attributes || {};
      var stockKg = parseFloat(stockState.state);
      var bagWeight = attrs.poids_sac_kg || 15;
      var stockBags =
        attrs.stock_sacs !== undefined ? attrs.stock_sacs : stockKg / bagWeight;

      els.season.textContent = attrs.saison || "";
      els.stock.textContent = fmt(stockKg, 1) + " kg";
      els.stockSub.textContent = fmt(stockBags, 1) + " sac(s) restant(s)";

      if (cfg.show_stats) {
        if (consommeId) {
          els.statConsomme.textContent = fmt(hass.states[consommeId].state, 1) + " kg";
        }
        if (energieId) {
          els.statEnergie.textContent = fmt(hass.states[energieId].state, 1) + " kWh";
        }
        if (depenseId) {
          els.statDepense.textContent = fmt(hass.states[depenseId].state, 2) + " €";
        }
        if (joursId) {
          els.statJours.textContent = hass.states[joursId].state;
        }
      }

      if (cfg.show_cost_stats) {
        var acheteSacs =
          acheteId && hass.states[acheteId].attributes.achete_sacs !== undefined
            ? hass.states[acheteId].attributes.achete_sacs
            : null;
        var consommeSacs =
          consommeId && hass.states[consommeId].attributes.consomme_sacs !== undefined
            ? hass.states[consommeId].attributes.consomme_sacs
            : null;
        var depenseTotal = depenseId ? parseFloat(hass.states[depenseId].state) : 0;
        var joursLogged = joursId ? parseFloat(hass.states[joursId].state) : 0;

        var avgPricePerBag =
          acheteSacs && acheteSacs > 0 ? depenseTotal / acheteSacs : 0;
        var costToDate =
          consommeSacs && avgPricePerBag ? consommeSacs * avgPricePerBag : 0;
        var costPerDay = joursLogged > 0 ? costToDate / joursLogged : 0;
        var costPerMonth = costPerDay * 30.44;

        els.statCoutJour.textContent = fmt(costPerDay, 2) + " €";
        els.statCoutMois.textContent = fmt(costPerMonth, 2) + " €";
        els.statCoutSac.textContent = avgPricePerBag ? fmt(avgPricePerBag, 2) + " €" : "--";
      }

      this._refreshHistory();
      if (cfg.show_price_chart) {
        this._refreshSeasonsSummary();
      }
    }

    _refreshHistory() {
      var self = this;
      if (this._historyPending) return;
      var now = Date.now();
      if (this._historyFetchedAt && now - this._historyFetchedAt < 15000) return;
      if (!this._hass || !this._hass.connection) return;
      this._historyPending = true;
      this._hass.connection
        .sendMessagePromise({ type: "suivi_stock_pellet/journal" })
        .then(function (result) {
          self._historyPending = false;
          self._historyFetchedAt = Date.now();
          if (self._els.historyList) {
            self._renderHistory(result.entries || []);
          }
          if (self._els.chart) {
            self._renderChart(result.entries || [], result.start_month || 9);
          }
        })
        .catch(function () {
          self._historyPending = false;
        });
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
      var recent = entries.slice(-5).reverse();
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

    _renderChart(entries, startMonth) {
      var chart = this._els.chart;
      if (!chart) return;
      chart.innerHTML = "";

      var months = [];
      for (var i = 0; i < 10; i++) {
        months.push(((startMonth - 1 + i) % 12) + 1);
      }

      var buckets = months.map(function () {
        return 0;
      });
      entries.forEach(function (entry) {
        if (entry.type !== "consumption") return;
        var m = parseInt(entry.date.split("-")[1], 10);
        var idx = months.indexOf(m);
        if (idx !== -1) buckets[idx] += entry.qty_bags;
      });

      var maxValue = Math.max.apply(null, buckets.concat([0]));
      var currentMonth = new Date().getMonth() + 1;
      var maxBarHeight = 74;
      var minBarHeight = 4;

      months.forEach(function (m, idx) {
        var value = buckets[idx];
        var height =
          maxValue > 0
            ? Math.max(minBarHeight, Math.round((value / maxValue) * maxBarHeight))
            : minBarHeight;

        var col = document.createElement("div");
        col.className = "chart-col";
        col.title = MONTHS_FR[m] + " : " + value + " sac(s)";

        var barWrap = document.createElement("div");
        barWrap.className = "chart-bar-wrap";
        var bar = document.createElement("div");
        bar.className = "chart-bar" + (value === 0 ? " empty" : "");
        bar.style.height = height + "px";
        barWrap.appendChild(bar);

        var label = document.createElement("div");
        label.className = "chart-label" + (m === currentMonth ? " current" : "");
        label.textContent = MONTHS_FR[m];

        col.appendChild(barWrap);
        col.appendChild(label);
        chart.appendChild(col);
      });
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
