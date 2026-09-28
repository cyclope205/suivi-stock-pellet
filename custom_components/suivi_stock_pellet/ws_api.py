"""WebSocket API exposing the pellet journal to the Lovelace card.

These are read-only queries (journal contents, per-season summaries,
season-over-season comparison) - no require_admin gate, unlike the
write-side services (edit_entry, delete_entry, set_stock_initial),
so a non-admin household member can still see the card's history,
charts and comparison, matching what a Lovelace dashboard viewer
normally expects to be able to see.
"""
from __future__ import annotations

from datetime import date as date_cls, timedelta

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    CONF_BAG_WEIGHT_KG, CONF_CALORIFIC_VALUE, CONF_SEASON_START_MONTH,
    DEFAULT_BAG_WEIGHT_KG, DEFAULT_CALORIFIC_VALUE, DEFAULT_SEASON_START_MONTH, DOMAIN,
)
from .csv_import import CsvImportError, parse_csv_history
from .journal import previous_season_key, season_for_date, season_start_date


@websocket_api.websocket_command(
    {
        vol.Required("type"): "suivi_stock_pellet/journal",
        vol.Optional("season"): str,
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def _ws_get_journal(hass: HomeAssistant, connection, msg) -> None:
    stored = list(hass.data.get(DOMAIN, {}).items())
    if not stored:
        connection.send_error(msg["id"], "not_found", "Integration not set up")
        return

    requested_entry_id = msg.get("entry_id")
    if requested_entry_id:
        match = [(eid, j) for eid, j in stored if eid == requested_entry_id]
        if not match:
            connection.send_error(msg["id"], "not_found", "Integration entry not found")
            return
        entry_id, journal = match[0]
    else:
        entry_id, journal = stored[0]
    config_entry = hass.config_entries.async_get_entry(entry_id)
    start_month = (
        config_entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)
        if config_entry
        else DEFAULT_SEASON_START_MONTH
    )
    season = msg.get("season") or season_for_date(date_cls.today(), start_month)

    connection.send_result(
        msg["id"],
        {
            "season": season,
            "seasons": journal.seasons(),
            "entries": journal.entries(season),
            "totals": journal.totals(season),
            "start_month": start_month,
        },
    )


@websocket_api.websocket_command({vol.Required("type"): "suivi_stock_pellet/seasons_summary",
        vol.Optional("entry_id"): str,
    })
@websocket_api.async_response
async def _ws_get_seasons_summary(hass: HomeAssistant, connection, msg) -> None:
    stored = list(hass.data.get(DOMAIN, {}).items())
    if not stored:
        connection.send_error(msg["id"], "not_found", "Integration not set up")
        return

    requested_entry_id = msg.get("entry_id")
    if requested_entry_id:
        match = [(eid, j) for eid, j in stored if eid == requested_entry_id]
        if not match:
            connection.send_error(msg["id"], "not_found", "Integration entry not found")
            return
        entry_id, journal = match[0]
    else:
        entry_id, journal = stored[0]

    config_entry = hass.config_entries.async_get_entry(entry_id)
    start_month = (
        config_entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)
        if config_entry
        else DEFAULT_SEASON_START_MONTH
    )
    current_season = season_for_date(date_cls.today(), start_month)

    summary = []
    display_unit = (
        config_entry.options.get("display_unit", "bag")
        if config_entry
        else "bag"
    )
    for season in journal.seasons():
        totals = journal.totals(season)
        # Use the weighted-average price (blends carried-over stock
        # value with this seasons own purchases) instead of a plain
        # spent/purchased ratio, so this chart matches the rest of the
        # card and journal.totals().
        avg_price = totals["avg_price_per_kg"] or None
        summary.append(
            {
                "season": season,
                "avg_price_eur": (
                    totals["avg_price_per_kg"]
                    if display_unit == "kg"
                    else totals["avg_price_per_bag"]
                ) or None,
                "avg_price_per_kg": totals["avg_price_per_kg"],
                "avg_price_per_bag": totals["avg_price_per_bag"],
                "avg_price_display": (
                    totals["avg_price_per_kg"] if display_unit == "kg"
                    else totals["avg_price_per_bag"]
                ) or None,
                "current": season == current_season,
                **totals,
            }
        )

    connection.send_result(msg["id"], {"display_unit": display_unit, "seasons": summary})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "suivi_stock_pellet/season_comparison",
        vol.Optional("season"): str,
    }
)
@websocket_api.async_response
async def _ws_get_season_comparison(hass: HomeAssistant, connection, msg) -> None:
    stored = list(hass.data.get(DOMAIN, {}).items())
    if not stored:
        connection.send_error(msg["id"], "not_found", "Integration not set up")
        return

    entry_id, journal = stored[0]
    config_entry = hass.config_entries.async_get_entry(entry_id)
    start_month = (
        config_entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)
        if config_entry
        else DEFAULT_SEASON_START_MONTH
    )
    today = date_cls.today()
    real_current_season = season_for_date(today, start_month)
    season = msg.get("season") or real_current_season
    previous_season = previous_season_key(season)

    if season == real_current_season:
        as_of_current = today
    else:
        entry_dates = [e["date"] for e in journal.entries(season)]
        as_of_current = (
            date_cls.fromisoformat(max(entry_dates))
            if entry_dates
            else season_start_date(season, start_month)
        )

    current_totals = journal.totals(season, as_of_date=as_of_current.isoformat())
    result = {
        "current_season": season,
        "current_consumed_bags": current_totals["consumed_bags"],
        "current_consumed_kg": current_totals["consumed_kg"],
        "current_spent_eur": current_totals["spent_eur"],
        "previous_season": previous_season,
        "previous_consumed_bags": None,
        "previous_consumed_kg": None,
        "previous_spent_eur": None,
        "as_of_current": as_of_current.isoformat(),
        "as_of_previous": None,
        "pct_diff": None,
        "eur_diff": None,
    }

    if previous_season in journal.seasons():
        days_elapsed = (as_of_current - season_start_date(season, start_month)).days
        as_of_previous = season_start_date(previous_season, start_month) + timedelta(
            days=days_elapsed
        )
        previous_totals = journal.totals(
            previous_season, as_of_date=as_of_previous.isoformat()
        )
        previous_consumed = previous_totals["consumed_bags"]
        previous_consumed_kg = previous_totals["consumed_kg"]
        previous_spent = previous_totals["spent_eur"]
        result["previous_consumed_bags"] = previous_consumed
        result["previous_consumed_kg"] = previous_consumed_kg
        result["previous_spent_eur"] = previous_spent
        result["as_of_previous"] = as_of_previous.isoformat()
        result["eur_diff"] = round(current_totals["spent_eur"] - previous_spent, 2)
        if previous_consumed_kg:
            result["pct_diff"] = round(
                (current_totals["consumed_kg"] - previous_consumed_kg)
                / previous_consumed_kg
                * 100,
                1,
            )

    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): "suivi_stock_pellet/csv_import_preview",
     vol.Required("content"): vol.All(str, vol.Length(min=1, max=2_000_000)),
     vol.Optional("default_season"): str}
)
@websocket_api.async_response
async def _ws_csv_import_preview(hass: HomeAssistant, connection, msg) -> None:
    stored = list(hass.data.get(DOMAIN, {}).items())
    if not stored:
        connection.send_error(msg["id"], "not_found", "Integration not set up")
        return
    entry_id, _journal = stored[0]
    config_entry = hass.config_entries.async_get_entry(entry_id)
    try:
        start_month = (
            config_entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)
            if config_entry
            else DEFAULT_SEASON_START_MONTH
        )
        parsed = parse_csv_history(
            msg["content"],
            default_season=msg.get("default_season"),
            season_start_month=start_month,
        )
    except (CsvImportError, ValueError) as err:
        connection.send_error(msg["id"], "invalid_csv", str(err))
        return
    connection.send_result(msg["id"], {
        "season": parsed["season"],
        "consumption_count": parsed["consumption_count"],
        "purchase_count": parsed["purchase_count"],
        "consumption_bags": parsed["consumption_bags"],
        "purchase_bags": parsed["purchase_bags"],
        "entries_preview": parsed["entries"][:20],
    })

@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "suivi_stock_pellet/csv_import_commit",
     vol.Required("content"): vol.All(str, vol.Length(min=1, max=2_000_000)),
     vol.Optional("default_season"): str,
     vol.Optional("skip_duplicates", default=False): bool}
)
@websocket_api.async_response
async def _ws_csv_import_commit(hass: HomeAssistant, connection, msg) -> None:
    stored = list(hass.data.get(DOMAIN, {}).items())
    if not stored:
        connection.send_error(msg["id"], "not_found", "Integration not set up")
        return
    entry_id, journal = stored[0]
    config_entry = hass.config_entries.async_get_entry(entry_id)
    bag_weight = DEFAULT_BAG_WEIGHT_KG
    calorific = config_entry.options.get(CONF_CALORIFIC_VALUE, DEFAULT_CALORIFIC_VALUE) if config_entry else DEFAULT_CALORIFIC_VALUE
    try:
        start_month = (
            config_entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)
            if config_entry
            else DEFAULT_SEASON_START_MONTH
        )
        parsed = parse_csv_history(
            msg["content"],
            default_season=msg.get("default_season"),
            season_start_month=start_month,
        )
        duplicates = []
        for item in parsed["entries"]:
            if any(
                current.get("type") == item["type"]
                and current.get("date") == item["date"]
                and float(current.get("qty_bags", 0)) == float(item["qty_bags"])
                and current.get("price_eur") == item.get("price_eur")
                for current in journal.entries(item["season"])
            ):
                duplicates.append(item)
        if duplicates and not msg.get("skip_duplicates", False):
            connection.send_error(msg["id"], "duplicates", f"{len(duplicates)} saisie(s) identique(s) déjà présente(s).")
            return
        entries = [item for item in parsed["entries"] if item not in duplicates]
        for item in entries:
            item["bag_weight_kg"] = bag_weight
            if item["type"] == "consumption":
                item["calorific_value"] = calorific
        await journal.async_import_entries(entries)
        async_dispatcher_send(hass, f"suivi_stock_pellet_update_{entry_id}")
    except (CsvImportError, ValueError) as err:
        connection.send_error(msg["id"], "import_failed", str(err))
        return
    connection.send_result(msg["id"], {
        "season": parsed["season"],
        "imported": len(entries),
        "skipped_duplicates": len(duplicates),
        "consumption_bags": sum(e["qty_bags"] for e in entries if e["type"] == "consumption"),
        "purchase_bags": sum(e["qty_bags"] for e in entries if e["type"] == "purchase"),
    })

def async_register_ws_api(hass: HomeAssistant) -> None:
    """Register the websocket commands, once per HA run."""
    flag = f"{DOMAIN}_ws_registered"
    if hass.data.get(flag):
        return
    hass.data[flag] = True
    websocket_api.async_register_command(hass, _ws_get_journal)
    websocket_api.async_register_command(hass, _ws_get_seasons_summary)
    websocket_api.async_register_command(hass, _ws_get_season_comparison)
    websocket_api.async_register_command(hass, _ws_csv_import_preview)
    websocket_api.async_register_command(hass, _ws_csv_import_commit)
