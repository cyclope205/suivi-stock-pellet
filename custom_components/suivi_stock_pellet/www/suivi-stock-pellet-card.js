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
    "ha-card { padding: 16px; }",
    ".header { font-size: 1.2em; font-weight: 600; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }",
    ".season { font-size: 0.75em; font-weight: 400; opacity: 0.7; }",
    ".stock { font-size: 2.4em; font-weight: 700; margin: 8px 0 4px; }",
    ".stock-sub { font-size: 0.85em; opacity: 0.7; margin-bottom: 16px; }",
    ".stats { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }",
    ".stat { flex: 1 1 100px; background: var(--secondary-background-color, #2a2a2a); border-radius: 8px; padding: 8px 10px; }",
    ".stat-label { font-size: 0.72em; opacity: 0.75; text-transform: uppercase; }",
    ".stat-value { font-size: 1.15em; font-weight: 600; margin-top: 2px; }",
    ".actions { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }",
    ".actions button { flex: 1 1 auto; border: none; border-radius: 8px; padding: 10px 12px; font-size: 0.95em; font-weight: 600; cursor: pointer; background: var(--primary-color, #03a9f4); color: #fff; }",
    ".actions button.secondary { background: var(--secondary-background-color, #2a2a2a); color: var(--primary-text-color, #fff); }",
    ".form { display: none; flex-direction: column; gap: 8px; margin-top: 8px; padding: 12px; border-radius: 8px; background: var(--secondary-background-color, #2a2a2a); }",
    ".form.visible { display: flex; }",
    ".form label { font-size: 0.8em; opacity: 0.8; }",
    ".form input { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color, #444); background: var(--card-background-color, #1c1c1c); color: inherit; font-size: 1em; }",
    ".form-row { display: flex; gap: 8px; }",
    ".form-row > div { flex: 1; }",
    ".form-actions { display: flex; gap: 8px; margin-top: 4px; }",
    ".form-actions button { flex: 1; }",
    ".history { margin-top: 8px; font-size: 0.85em; }",
    ".history-title { font-weight: 600; opacity: 0.8; margin-bottom: 4px; }",
    ".history-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid var(--divider-color, #333); }",
    ".history-empty { opacity: 0.6; font-style: italic; }",
    ".undo-row { text-align: right; margin-top: 4px; }",
    ".undo-row button { background: none; border: none; color: var(--secondary-text-color, #999); font-size: 0.8em; cursor: pointer; text-decoration: underline; padding: 4px; }"
  ].join("\n");

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

      var style = document.createElement("style");
      style.textContent = STYLE;
      this.appendChild(style);

      var card = document.createElement("ha-card");
      this.appendChild(card);

      var self = this;

      var header = document.createElement("div");
      header.className = "header";
      var title = document.createElement("span");
      title.textContent = "Granulés";
      var season = document.createElement("span");
      season.className = "season";
      header.appendChild(title);
      header.appendChild(season);
      card.appendChild(header);

      var stock = document.createElement("div");
      stock.className = "stock";
      card.appendChild(stock);

      var stockSub = document.createElement("div");
      stockSub.className = "stock-sub";
      card.appendChild(stockSub);

      var stats = document.createElement("div");
      stats.className = "stats";
      card.appendChild(stats);

      function addStat(label) {
        var stat = document.createElement("div");
        stat.className = "stat";
        var lab = document.createElement("div");
        lab.className = "stat-label";
        lab.textContent = label;
        var val = document.createElement("div");
        val.className = "stat-value";
        stat.appendChild(lab);
        stat.appendChild(val);
        stats.appendChild(stat);
        return val;
      }

      var statConsomme = addStat("Consommé");
      var statEnergie = addStat("Énergie");
      var statDepense = addStat("Dépensé");
      var statJours = addStat("Jours");

      var actions = document.createElement("div");
      actions.className = "actions";
      var btnConso = document.createElement("button");
      btnConso.type = "button";
      btnConso.textContent = "+ Consommation";
      var btnAchat = document.createElement("button");
      btnAchat.type = "button";
      btnAchat.className = "secondary";
      btnAchat.textContent = "+ Achat";
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
      undoBtn.textContent = "Annuler la dernière saisie";
      undoRow.appendChild(undoBtn);
      card.appendChild(undoRow);
      undoBtn.addEventListener("click", function () {
        if (undoBtn.dataset.confirm === "1") {
          self._hass.callService("suivi_stock_pellet", "undo_last_entry", {});
          undoBtn.dataset.confirm = "";
          undoBtn.textContent = "Annuler la dernière saisie";
        } else {
          undoBtn.dataset.confirm = "1";
          undoBtn.textContent = "Sûr ? Cliquer à nouveau pour confirmer";
          setTimeout(function () {
            undoBtn.dataset.confirm = "";
            undoBtn.textContent = "Annuler la dernière saisie";
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
        var label = document.createElement("span");
        var isConso = entry.type === "consumption";
        label.textContent = (isConso ? "Conso" : "Achat") + " · " + entry.date;
        var value = document.createElement("span");
        value.textContent =
          entry.qty_bags + " sac(s)" + (entry.price_eur ? " · " + entry.price_eur + " €" : "");
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
