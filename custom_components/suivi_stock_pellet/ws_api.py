"""WebSocket API exposing the pellet journal to the Lovelace card."""
from __future__ import annotations

from datetime import date as date_cls

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant

from .const import CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH, DOMAIN
from .journal import season_for_date


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
        },
    )


def async_register_ws_api(hass: HomeAssistant) -> None:
    """Register the websocket commands, once per HA run."""
    flag = f"{DOMAIN}_ws_registered"
    if hass.data.get(flag):
        return
    hass.data[flag] = True
    websocket_api.async_register_command(hass, _ws_get_journal)
