"""Config flow for Suivi Stock Pellet."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import SelectSelector, SelectSelectorConfig

from .const import (
    CONF_BAG_PRICE,
    CONF_BAG_WEIGHT_KG,
    CONF_CALORIFIC_VALUE,
    CONF_DISPLAY_UNIT,
    CONF_PRICE_PER_KG,
    CONF_SEASON_START_MONTH,
    DEFAULT_BAG_PRICE,
    DEFAULT_BAG_WEIGHT_KG,
    DEFAULT_CALORIFIC_VALUE,
    DEFAULT_DISPLAY_UNIT,
    DEFAULT_PRICE_PER_KG,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
)


DISPLAY_UNIT_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=["bag", "kg"],
        translation_key="display_unit",
        mode="list",
    )
)


def _unit_schema(default: str) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(
                CONF_DISPLAY_UNIT, default=default
            ): DISPLAY_UNIT_SELECTOR,
        }
    )


def _details_schema(
    *,
    display_unit: str,
    bag_price: float,
    price_per_kg: float,
    calorific_value: float,
    season_start_month: int,
) -> vol.Schema:
    price_key = CONF_BAG_PRICE if display_unit == "bag" else CONF_PRICE_PER_KG
    price_default = bag_price if display_unit == "bag" else price_per_kg
    return vol.Schema(
        {
            vol.Required(
                price_key, default=price_default
            ): vol.All(vol.Coerce(float), vol.Range(min=0)),
            vol.Required(
                CONF_CALORIFIC_VALUE, default=calorific_value
            ): vol.All(vol.Coerce(float), vol.Range(min=0.1)),
            vol.Required(
                CONF_SEASON_START_MONTH, default=season_start_month
            ): vol.All(vol.Coerce(int), vol.Range(min=1, max=12)),
        }
    )


def _season_end_month(start_month: int) -> int:
    """Return the month immediately preceding the configured season start."""
    return 12 if start_month == 1 else start_month - 1


def _month_name(month: int) -> str:
    names = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ]
    return names[month - 1]


class SuiviStockPelletConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Suivi Stock Pellet."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            self._display_unit = user_input[CONF_DISPLAY_UNIT]
            return await self.async_step_details()

        return self.async_show_form(
            step_id="user",
            data_schema=_unit_schema(DEFAULT_DISPLAY_UNIT),
        )

    async def async_step_details(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            options = dict(user_input)
            options[CONF_BAG_WEIGHT_KG] = DEFAULT_BAG_WEIGHT_KG
            options[CONF_DISPLAY_UNIT] = self._display_unit
            if self._display_unit == "kg":
                options.setdefault(
                    CONF_BAG_PRICE,
                    DEFAULT_PRICE_PER_KG * options[CONF_BAG_WEIGHT_KG],
                )
            return self.async_create_entry(
                title="Granulés", data={}, options=options
            )

        return self.async_show_form(
            step_id="details",
            data_schema=_details_schema(
                display_unit=self._display_unit,
                bag_price=DEFAULT_BAG_PRICE,
                price_per_kg=DEFAULT_PRICE_PER_KG,
                calorific_value=DEFAULT_CALORIFIC_VALUE,
                season_start_month=DEFAULT_SEASON_START_MONTH,
            ),
            description_placeholders={
                "start_month": _month_name(DEFAULT_SEASON_START_MONTH),
                "end_month": _month_name(_season_end_month(DEFAULT_SEASON_START_MONTH)),
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        return SuiviStockPelletOptionsFlow()


class SuiviStockPelletOptionsFlow(config_entries.OptionsFlow):
    """Handle options for Suivi Stock Pellet."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        current = self.config_entry.options

        if user_input is not None:
            self._display_unit = user_input[CONF_DISPLAY_UNIT]
            return await self.async_step_details()

        return self.async_show_form(
            step_id="init",
            data_schema=_unit_schema(
                current.get(CONF_DISPLAY_UNIT, DEFAULT_DISPLAY_UNIT)
            ),
        )

    async def async_step_details(self, user_input: dict[str, Any] | None = None):
        current = self.config_entry.options
        errors: dict[str, str] = {}

        if user_input is not None:
            old_start_month = current.get(
                CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH
            )
            if (
                user_input.get(CONF_SEASON_START_MONTH) != old_start_month
                and self._journal_has_data()
            ):
                errors["base"] = "season_start_month_locked"
            else:
                options = dict(current)
                options.update(user_input)
                options[CONF_BAG_WEIGHT_KG] = DEFAULT_BAG_WEIGHT_KG
                options[CONF_DISPLAY_UNIT] = self._display_unit
                if self._display_unit == "kg":
                    options.setdefault(
                        CONF_PRICE_PER_KG,
                        current.get(
                            CONF_PRICE_PER_KG,
                            current.get(
                                CONF_BAG_PRICE, DEFAULT_BAG_PRICE
                            ) / options[CONF_BAG_WEIGHT_KG],
                        ),
                    )
                return self.async_create_entry(title="", data=options)

        old_bag_price = current.get(CONF_BAG_PRICE, DEFAULT_BAG_PRICE)
        old_price_per_kg = current.get(
            CONF_PRICE_PER_KG,
            old_bag_price / DEFAULT_BAG_WEIGHT_KG,
        )
        return self.async_show_form(
            step_id="details",
            data_schema=_details_schema(
                display_unit=self._display_unit,
                bag_price=old_bag_price,
                price_per_kg=old_price_per_kg,
                calorific_value=current.get(
                    CONF_CALORIFIC_VALUE, DEFAULT_CALORIFIC_VALUE
                ),
                season_start_month=current.get(
                    CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH
                ),
            ),
            description_placeholders={
                "start_month": _month_name(current.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH)),
                "end_month": _month_name(_season_end_month(current.get(CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH))),
            },
            errors=errors,
        )

    def _journal_has_data(self) -> bool:
        """Whether this entry's journal already has any season with logged entries."""
        journal = self.hass.data.get(DOMAIN, {}).get(self.config_entry.entry_id)
        return bool(journal.seasons()) if journal is not None else False
