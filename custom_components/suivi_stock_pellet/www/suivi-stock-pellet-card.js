/* Carte Lovelace "Suivi Stock Pellet" - stock, consommation et achats de
 * granulés de bois. Servie automatiquement par l'intégration Home Assistant
 * du même nom : aucune ressource Lovelace à ajouter manuellement.
 *
 * Utilisation minimale dans un tableau de bord :
 *   type: custom:suivi-stock-pellet-card
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
    ".history { margin-top: 12px; font-size: 0.85em; }",
    ".history-title { font-weight: 700; opacity: 0.85; margin-bottom: 6px; font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.03em; }",
    ".history-row { display: flex; align-items: center; gap: 10px; padding: 6px 2px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,0.15)); }",
    ".history-row:last-child { border-bottom: none; }",
    ".history-dot { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }",
    ".history-dot ha-icon { --mdc-icon-size: 13px; }",
    ".history-label { flex: 1; opacity: 0.85; }",
    ".history-value { font-weight: 600; }",
    ".history-empty { opacity: 0.6; font-style: italic; }",
    ".undo-row { text-align: right; margin-top: 6px; }",
    ".undo-row button { display: inline-flex; align-items: center; gap: 4px; background: none; border: none; color: var(--secondary-text-color, #999); font-size: 0.78em; cursor: pointer; padding: 4px; }",
    ".undo-row button ha-icon { --mdc-icon-size: 14px; }",
    ".undo-row button:hover { color: var(--primary-text-color, inherit); }"
  ].join("\n");

  var ROOT_VARS = "--pellet-amber: #ffa726;";

  var SUFFIXES = {
    stock: "_stock",
    consomme_kg: "_consomme_kg",
    consomme_kwh: "_consomme_kwh",
    achete_kg: "_achete_kg",
    depense: "_depense",
    jours: "_jours_utilisation"
  };

  function findEntity(hass, suffix) {
    var ids = Object.keys(hass.states);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (id.indexOf("sensor.") === 0 && id.indexOf(suffix, id.length - suffix.length) !== -1) {
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

  var COLORS = {
    amber: "255, 167, 38",
    red: "239, 83, 80",
    blue: "66, 165, 245",
    green: "102, 187, 106",
    purple: "171, 71, 188"
  };

  class SuiviStockPelletCard extends HTMLElement {
    setConfig(config) {
      this._config = config || {};
    }

    set hass(hass) {
      this._hass = hass;
      this._ensureDom();
      this._render();
    }

    getCardSize() {
      return 4;
    }

    _ensureDom() {
      if (this._built) return;
      this._built = true;
      this.innerHTML = "";
      this.style.cssText = ROOT_VARS;

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

      var stats = document.createElement("div");
      stats.className = "stats";
      card.appendChild(stats);

      function addStat(label, iconName, color) {
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
        stats.appendChild(stat);
        return val;
      }

      var statConsomme = addStat("Consommé", "mdi:fire", COLORS.red);
      var statEnergie = addStat("Énergie", "mdi:lightning-bolt", COLORS.purple);
      var statDepense = addStat("Dépensé", "mdi:currency-eur", COLORS.green);
      var statJours = addStat("Jours chauffés", "mdi:calendar-range", COLORS.blue);

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

      var history = document.createElement("div");
      history.className = "history";
      var historyTitle = document.createElement("div");
      historyTitle.className = "history-title";
      historyTitle.textContent = "Dernières saisies";
      var historyList = document.createElement("div");
      history.appendChild(historyTitle);
      history.appendChild(historyList);
      card.appendChild(history);

      this._els = {
        season: season,
        stock: stock,
        stockSub: stockSub,
        statConsomme: statConsomme,
        statEnergie: statEnergie,
        statDepense: statDepense,
        statJours: statJours,
        historyList: historyList
      };
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

      var stockId = findEntity(hass, SUFFIXES.stock);
      var consommeId = findEntity(hass, SUFFIXES.consomme_kg);
      var energieId = findEntity(hass, SUFFIXES.consomme_kwh);
      var depenseId = findEntity(hass, SUFFIXES.depense);
      var joursId = findEntity(hass, SUFFIXES.jours);

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

      this._refreshHistory();
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
          self._renderHistory(result.entries || []);
        })
        .catch(function () {
          self._historyPending = false;
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

    static getStubConfig() {
      return {};
    }
  }

  if (!customElements.get("suivi-stock-pellet-card")) {
    customElements.define("suivi-stock-pellet-card", SuiviStockPelletCard);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "suivi-stock-pellet-card",
    name: "Suivi Stock Pellet",
    description: "Suivi du stock, de la consommation et des achats de granulés de bois."
  });
})();
