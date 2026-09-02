"""Config flow for Suivi Stock Pellet."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback

from .const import (
    CONF_BAG_PRICE,
    CONF_BAG_WEIGHT_KG,
    CONF_CALORIFIC_VALUE,
    CONF_SEASON_START_MONTH,
    DEFAULT_BAG_PRICE,
    DEFAULT_BAG_WEIGHT_KG,
    DEFAULT_CALORIFIC_VALUE,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
)

USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_BAG_WEIGHT_KG, default=DEFAULT_BAG_WEIGHT_KG): vol.Coerce(float),
        vol.Required(CONF_BAG_PRICE, default=DEFAULT_BAG_PRICE): vol.Coerce(float),
        vol.Required(
            CONF_CALORIFIC_VALUE, default=DEFAULT_CALORIFIC_VALUE
        ): vol.Coerce(float),
        vol.Required(
            CONF_SEASON_START_MONTH, default=DEFAULT_SEASON_START_MONTH
        ): vol.All(vol.Coerce(int), vol.Range(min=1, max=12)),
    }
)


class SuiviStockPelletConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Suivi Stock Pellet."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(
                title="Granulés", data={}, options=user_input
            )

        return self.async_show_form(step_id="user", data_schema=USER_SCHEMA)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return SuiviStockPelletOptionsFlow()


class SuiviStockPelletOptionsFlow(config_entries.OptionsFlow):
    """Handle options for Suivi Stock Pellet."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self.config_entry.options
        schema = vol.Schema(
            {
                vol.Required(
                    CONF_BAG_WEIGHT_KG,
                    default=current.get(CONF_BAG_WEIGHT_KG, DEFAULT_BAG_WEIGHT_KG),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_BAG_PRICE,
                    default=current.get(CONF_BAG_PRICE, DEFAULT_BAG_PRICE),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_CALORIFIC_VALUE,
                    default=current.get(CONF_CALORIFIC_VALUE, DEFAULT_CALORIFIC_VALUE),
                ): vol.Coerce(float),
                vol.Required(
                    CONF_SEASON_START_MONTH,
                    default=current.get(
                        CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH
                    ),
                ): vol.All(vol.Coerce(int), vol.Range(min=1, max=12)),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
