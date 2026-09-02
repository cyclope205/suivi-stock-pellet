"""The Suivi Stock Pellet integration."""
from __future__ import annotations

from datetime import date as date_cls
import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import (
    ATTR_DATE,
    ATTR_PRICE_EUR,
    ATTR_QTY_BAGS,
    CONF_SEASON_START_MONTH,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
    ENTRY_TYPE_CONSUMPTION,
    ENTRY_TYPE_PURCHASE,
    SERVICE_LOG_CONSUMPTION,
    SERVICE_LOG_PURCHASE,
    SERVICE_UNDO_LAST_ENTRY,
)
from .journal import PelletJournal, season_for_date
from .ws_api import async_register_ws_api

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

CARD_URL_PATH = "/suivi_stock_pellet/suivi-stock-pellet-card.js"
CARD_VERSION = "1.3.0"

LOG_CONSUMPTION_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_QTY_BAGS): vol.Coerce(float),
        vol.Optional(ATTR_DATE): cv.date,
    }
)

LOG_PURCHASE_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_QTY_BAGS): vol.Coerce(float),
        vol.Optional(ATTR_PRICE_EUR): vol.Coerce(float),
        vol.Optional(ATTR_DATE): cv.date,
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Suivi Stock Pellet from a config entry."""
    journal = PelletJournal(hass, entry.entry_id)
    await journal.async_load()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = journal

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    def _start_month() -> int:
        return entry.options.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)

    def _notify() -> None:
        async_dispatcher_send(hass, f"suivi_stock_pellet_update_{entry.entry_id}")

    async def _handle_log_consumption(call: ServiceCall) -> None:
        qty = call.data[ATTR_QTY_BAGS]
        entry_date = call.data.get(ATTR_DATE, date_cls.today())
        season = season_for_date(entry_date, _start_month())
        await journal.async_add_entry(
            season, ENTRY_TYPE_CONSUMPTION, qty, entry_date.isoformat()
        )
        _notify()

    async def _handle_log_purchase(call: ServiceCall) -> None:
        qty = call.data[ATTR_QTY_BAGS]
        price = call.data.get(ATTR_PRICE_EUR)
        entry_date = call.data.get(ATTR_DATE, date_cls.today())
        season = season_for_date(entry_date, _start_month())
        await journal.async_add_entry(
            season, ENTRY_TYPE_PURCHASE, qty, entry_date.isoformat(), price_eur=price
        )
        _notify()

    async def _handle_undo_last_entry(call: ServiceCall) -> None:
        season = season_for_date(date_cls.today(), _start_month())
        removed = await journal.async_undo_last(season)
        if removed is None:
            raise HomeAssistantError(
                f"Aucune saisie a annuler pour la saison {season}"
            )
        _notify()

    hass.services.async_register(
        DOMAIN,
        SERVICE_LOG_CONSUMPTION,
        _handle_log_consumption,
        schema=LOG_CONSUMPTION_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_LOG_PURCHASE, _handle_log_purchase, schema=LOG_PURCHASE_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UNDO_LAST_ENTRY, _handle_undo_last_entry
    )

    async_register_ws_api(hass)
    await _async_register_card(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the Lovelace card as a static resource, once per HA run."""
    flag = f"{DOMAIN}_card_registered"
    if hass.data.get(flag):
        return
    hass.data[flag] = True
    card_path = Path(__file__).parent / "www" / "suivi-stock-pellet-card.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL_PATH, str(card_path), cache_headers=False)]
    )
    add_extra_js_url(hass, f"{CARD_URL_PATH}?v={CARD_VERSION}")


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the config entry when its options are changed."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok
