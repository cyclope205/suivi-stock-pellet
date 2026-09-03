"""The Suivi Stock Pellet integration."""
from __future__ import annotations

from datetime import date as date_cls
import json
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
    ATTR_INDEX,
    ATTR_PRICE_EUR,
    ATTR_QTY_BAGS,
    CONF_SEASON_START_MONTH,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
    ENTRY_TYPE_CONSUMPTION,
    ENTRY_TYPE_PURCHASE,
    SERVICE_DELETE_ENTRY,
    SERVICE_EDIT_ENTRY,
    SERVICE_LOG_CONSUMPTION,
    SERVICE_LOG_PURCHASE,
    SERVICE_UNDO_LAST_ENTRY,
)
from .journal import PelletJournal, season_for_date
from .ws_api import async_register_ws_api

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

CARD_URL_PATH = "/suivi_stock_pellet/suivi-stock-pellet-card.js"
_MANIFEST_PATH = Path(__file__).parent / "manifest.json"
CARD_VERSION = json.loads(_MANIFEST_PATH.read_text())["version"]

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

UNDO_LAST_ENTRY_SCHEMA = vol.Schema(
    {
        # Optional so calling with no data keeps undoing whichever season
        # "today" falls into (unchanged default behaviour) - passing an
        # explicit season lets this correct a historical season's journal
        # instead (e.g. fixing a backfill mistake).
        vol.Optional("season"): str,
    }
)

EDIT_ENTRY_SCHEMA = vol.Schema(
    {
        vol.Required("season"): str,
        vol.Required(ATTR_INDEX): vol.Coerce(int),
        vol.Optional(ATTR_QTY_BAGS): vol.Coerce(float),
        vol.Optional(ATTR_PRICE_EUR): vol.Coerce(float),
        vol.Optional(ATTR_DATE): cv.date,
    }
)

DELETE_ENTRY_SCHEMA = vol.Schema(
    {
        vol.Required("season"): str,
        vol.Required(ATTR_INDEX): vol.Coerce(int),
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
        season = call.data.get("season") or season_for_date(
            date_cls.today(), _start_month()
        )
        removed = await journal.async_undo_last(season)
        if removed is None:
            raise HomeAssistantError(
                f"Aucune saisie a annuler pour la saison {season}"
            )
        _notify()

    async def _handle_edit_entry(call: ServiceCall) -> None:
        season = call.data["season"]
        index = call.data[ATTR_INDEX]
        qty = call.data.get(ATTR_QTY_BAGS)
        price = call.data.get(ATTR_PRICE_EUR)
        entry_date = call.data.get(ATTR_DATE)
        updated = await journal.async_edit_entry(
            season,
            index,
            qty_bags=qty,
            price_eur=price,
            entry_date=entry_date.isoformat() if entry_date else None,
        )
        if updated is None:
            raise HomeAssistantError(
                f"Entree introuvable (saison {season}, index {index})"
            )
        _notify()

    async def _handle_delete_entry(call: ServiceCall) -> None:
        season = call.data["season"]
        index = call.data[ATTR_INDEX]
        removed = await journal.async_delete_entry(season, index)
        if removed is None:
            raise HomeAssistantError(
                f"Entree introuvable (saison {season}, index {index})"
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
        DOMAIN,
        SERVICE_UNDO_LAST_ENTRY,
        _handle_undo_last_entry,
        schema=UNDO_LAST_ENTRY_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_EDIT_ENTRY,
        _handle_edit_entry,
        schema=EDIT_ENTRY_SCHEMA,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_DELETE_ENTRY,
        _handle_delete_entry,
        schema=DELETE_ENTRY_SCHEMA,
    )

    async_register_ws_api(hass)
    await _async_register_card(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the Lovelace card from this integration and auto-register it.

    This avoids asking the user to manually add a Lovelace resource: the
    card is served locally by Home Assistant and injected on every
    dashboard load, the same way built-in frontend assets are.
    """
    flag = f"{DOMAIN}_card_registered"
    if not hass.data.get(flag):
        hass.data[flag] = True
        card_path = Path(__file__).parent / "www" / "suivi-stock-pellet-card.js"
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL_PATH, str(card_path), cache_headers=False)]
        )
        add_extra_js_url(hass, f"{CARD_URL_PATH}?v={CARD_VERSION}")

    await _async_sync_lovelace_resource(hass)


async def _async_sync_lovelace_resource(hass: HomeAssistant) -> None:
    """Additionally register the card as a real Lovelace resource.

    add_extra_js_url only injects a <script type="module"> tag into the
    frontend's index.html, which the browser only re-evaluates on a
    genuine full page reload. If the custom element registration loses
    the race against Lovelace's own view construction (more likely on
    slower devices or dashboards with many other custom resources), the
    browser is stuck showing "Custom element doesn't exist" until the
    user manually hard-refreshes - some users have reported needing to
    add the resource by hand for it to work at all.

    A real Lovelace resource (type: module) is loaded by the frontend's
    own resource loader every time a dashboard/view connects within the
    running session, giving it another chance to register without a
    full reload. This is purely additive on top of add_extra_js_url
    (kept for the very first load) and best-effort: any failure here is
    logged and does not affect the rest of setup, since it only touches
    storage-mode Lovelace resources (a fresh install with no dashboards
    configured yet, or YAML-mode resources, are silently skipped).
    """
    lovelace_data = hass.data.get("lovelace")
    resources = getattr(lovelace_data, "resources", None)
    if resources is None or not hasattr(resources, "async_create_item"):
        return

    target_url = f"{CARD_URL_PATH}?v={CARD_VERSION}"
    try:
        if not getattr(resources, "loaded", False):
            await resources.async_load()

        existing = next(
            (
                item
                for item in resources.async_items()
                if str(item.get("url", "")).split("?", 1)[0] == CARD_URL_PATH
            ),
            None,
        )
        if existing is None:
            await resources.async_create_item(
                {"res_type": "module", "url": target_url}
            )
        elif existing.get("url") != target_url:
            await resources.async_update_item(existing["id"], {"url": target_url})
    except Exception:  # noqa: BLE001
        _LOGGER.debug(
            "Could not auto-register the Lovelace resource for the card; "
            "add_extra_js_url is still active as a fallback.",
            exc_info=True,
        )


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the config entry when its options are changed."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
    return unload_ok
