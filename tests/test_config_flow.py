"""Tests for the Suivi Pellet config flow."""

from types import SimpleNamespace

import pytest
from homeassistant.data_entry_flow import FlowResultType

from custom_components.suivi_stock_pellet.config_flow import (
    SuiviStockPelletConfigFlow,
    SuiviStockPelletOptionsFlow,
)
from custom_components.suivi_stock_pellet.const import (
    CONF_BAG_PRICE,
    CONF_BAG_WEIGHT_KG,
    CONF_CALORIFIC_VALUE,
    CONF_DISPLAY_UNIT,
    CONF_PRICE_PER_KG,
    CONF_SEASON_START_MONTH,
    DEFAULT_BAG_PRICE,
    DEFAULT_BAG_WEIGHT_KG,
    DEFAULT_CALORIFIC_VALUE,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
)


@pytest.mark.asyncio
async def test_config_flow_bag_path():
    hass = type("Hass", (), {"data": {}})()
    flow = SuiviStockPelletConfigFlow()
    flow.hass = hass

    result = await flow.async_step_user({CONF_DISPLAY_UNIT: "bag"})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "details"

    result = await flow.async_step_details(
        {
            CONF_BAG_PRICE: 7.5,
            CONF_CALORIFIC_VALUE: 4.9,
            CONF_SEASON_START_MONTH: 10,
        }
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {}
    assert result["options"][CONF_DISPLAY_UNIT] == "bag"
    assert result["options"][CONF_BAG_PRICE] == 7.5
    assert result["options"][CONF_BAG_WEIGHT_KG] == DEFAULT_BAG_WEIGHT_KG
    assert result["options"][CONF_CALORIFIC_VALUE] == 4.9
    assert result["options"][CONF_SEASON_START_MONTH] == 10


@pytest.mark.asyncio
async def test_config_flow_kg_path_derives_bag_price():
    hass = type("Hass", (), {"data": {}})()
    flow = SuiviStockPelletConfigFlow()
    flow.hass = hass

    await flow.async_step_user({CONF_DISPLAY_UNIT: "kg"})
    result = await flow.async_step_details(
        {
            CONF_PRICE_PER_KG: 0.42,
            CONF_CALORIFIC_VALUE: DEFAULT_CALORIFIC_VALUE,
            CONF_SEASON_START_MONTH: DEFAULT_SEASON_START_MONTH,
        }
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["options"][CONF_DISPLAY_UNIT] == "kg"
    assert result["options"][CONF_PRICE_PER_KG] == 0.42
    assert result["options"][CONF_BAG_PRICE] == DEFAULT_BAG_PRICE


def _make_options_flow(entry_id: str, seasons: set[str]):
    hass = type("Hass", (), {"data": {}})()
    hass.data.setdefault(DOMAIN, {})[entry_id] = type(
        "Journal",
        (),
        {"seasons": lambda self: seasons},
    )()

    entry = SimpleNamespace(
        entry_id=entry_id,
        options={
            CONF_DISPLAY_UNIT: "bag",
            CONF_BAG_PRICE: 6.5,
            CONF_BAG_WEIGHT_KG: DEFAULT_BAG_WEIGHT_KG,
            CONF_CALORIFIC_VALUE: DEFAULT_CALORIFIC_VALUE,
            CONF_SEASON_START_MONTH: 9,
        },
    )

    hass.config_entries = SimpleNamespace(
        async_get_known_entry=lambda requested_id: entry
        if requested_id == entry_id
        else None
    )

    class TestOptionsFlow(SuiviStockPelletOptionsFlow):
        @property
        def config_entry(self):
            return entry

    flow = TestOptionsFlow()
    flow.hass = hass
    return flow


@pytest.mark.asyncio
async def test_options_flow_locks_season_start_after_data():
    flow = _make_options_flow("test-entry", {"2025-2026"})
    await flow.async_step_init({CONF_DISPLAY_UNIT: "bag"})

    result = await flow.async_step_details(
        {
            CONF_BAG_PRICE: 6.5,
            CONF_CALORIFIC_VALUE: DEFAULT_CALORIFIC_VALUE,
            CONF_SEASON_START_MONTH: 10,
        }
    )

    assert result["type"] is FlowResultType.FORM
    assert result["errors"]["base"] == "season_start_month_locked"


@pytest.mark.asyncio
async def test_options_flow_allows_season_start_without_data():
    flow = _make_options_flow("test-entry-empty", set())
    await flow.async_step_init({CONF_DISPLAY_UNIT: "bag"})

    result = await flow.async_step_details(
        {
            CONF_BAG_PRICE: 7.0,
            CONF_CALORIFIC_VALUE: DEFAULT_CALORIFIC_VALUE,
            CONF_SEASON_START_MONTH: 10,
        }
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"][CONF_SEASON_START_MONTH] == 10
