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

from .const import CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH, DOMAIN
from .journal import previous_season_key, season_for_date, season_start_date


@websocket_api.websocket_command(
    {
        vol.Required("type"): "suivi_stock_pellet/journal",
        vol.Optional("season"): str,
    }
)
@websocket_api.async_response
async def _ws_get_journal(hass: HomeAssistant, connection, msg) -> None:
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


@websocket_api.websocket_command({vol.Required("type"): "suivi_stock_pellet/seasons_summary"})
@websocket_api.async_response
async def _ws_get_seasons_summary(hass: HomeAssistant, connection, msg) -> None:
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
    current_season = season_for_date(date_cls.today(), start_month)

    summary = []
    for season in journal.seasons():
        totals = journal.totals(season)
        purchased = totals["purchased_bags"]
        avg_price = round(totals["spent_eur"] / purchased, 2) if purchased else None
        summary.append(
            {
                "season": season,
                "avg_price_eur": avg_price,
                "current": season == current_season,
                **totals,
            }
        )

    connection.send_result(msg["id"], {"seasons": summary})


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
        "current_spent_eur": current_totals["spent_eur"],
        "previous_season": previous_season,
        "previous_consumed_bags": None,
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
        previous_spent = previous_totals["spent_eur"]
        result["previous_consumed_bags"] = previous_consumed
        result["previous_spent_eur"] = previous_spent
        result["as_of_previous"] = as_of_previous.isoformat()
        result["eur_diff"] = round(current_totals["spent_eur"] - previous_spent, 2)
        if previous_consumed:
            result["pct_diff"] = round(
                (current_totals["consumed_bags"] - previous_consumed)
                / previous_consumed
                * 100,
                1,
            )

    connection.send_result(msg["id"], result)

def async_register_ws_api(hass: HomeAssistant) -> None:
    """Register the websocket commands, once per HA run."""
    flag = f"{DOMAIN}_ws_registered"
    if hass.data.get(flag):
        return
    hass.data[flag] = True
    websocket_api.async_register_command(hass, _ws_get_journal)
    websocket_api.async_register_command(hass, _ws_get_seasons_summary)
    websocket_api.async_register_command(hass, _ws_get_season_comparison)
