"""Integration lifecycle tests for Suivi Stock Pellet."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.core import CoreState

from custom_components.suivi_stock_pellet import (
    DOMAIN,
    SERVICE_DELETE_ENTRY,
    SERVICE_DELETE_SEASON,
    SERVICE_EDIT_ENTRY,
    SERVICE_LOG_CONSUMPTION,
    SERVICE_LOG_ENTRETIEN,
    SERVICE_LOG_MAINTENANCE,
    SERVICE_LOG_PURCHASE,
    SERVICE_SET_STOCK_INITIAL,
    SERVICE_UNDO_LAST_ENTRY,
    async_setup_entry,
    async_unload_entry,
)


class FakeServices:
    def __init__(self):
        self.registered = {}
        self.removed = []

    def async_register(self, domain, service, handler, schema=None):
        self.registered[(domain, service)] = (handler, schema)

    def has_service(self, domain, service):
        return (domain, service) in self.registered

    def async_remove(self, domain, service):
        self.registered.pop((domain, service), None)
        self.removed.append((domain, service))


@pytest.mark.asyncio
async def test_setup_registers_all_services_and_unload_removes_them():
    services = FakeServices()
    hass = SimpleNamespace(
        data={},
        state=CoreState.running,
        services=services,
        config_entries=SimpleNamespace(
            async_forward_entry_setups=AsyncMock(),
            async_unload_platforms=AsyncMock(return_value=True),
            async_reload=AsyncMock(),
        ),
        http=MagicMock(),
    )
    unload_callbacks = []
    entry = SimpleNamespace(
        entry_id="test-entry",
        title="Granulés",
        options={},
        add_update_listener=MagicMock(return_value=lambda: None),
        async_on_unload=lambda callback: unload_callbacks.append(callback),
    )

    journal = MagicMock()
    journal.async_load = AsyncMock()
    journal.async_prune_empty_seasons = AsyncMock()

    with (
        patch("custom_components.suivi_stock_pellet.PelletJournal", return_value=journal),
        patch("custom_components.suivi_stock_pellet.async_register_ws_api"),
        patch("custom_components.suivi_stock_pellet._async_register_card", new=AsyncMock()),
    ):
        assert await async_setup_entry(hass, entry) is True

    expected = {
        SERVICE_LOG_CONSUMPTION,
        SERVICE_LOG_PURCHASE,
        SERVICE_UNDO_LAST_ENTRY,
        SERVICE_EDIT_ENTRY,
        SERVICE_DELETE_ENTRY,
        SERVICE_SET_STOCK_INITIAL,
        SERVICE_DELETE_SEASON,
        SERVICE_LOG_MAINTENANCE,
        SERVICE_LOG_ENTRETIEN,
    }
    assert {service for domain, service in services.registered if domain == DOMAIN} == expected
    assert hass.config_entries.async_forward_entry_setups.await_count == 1

    # Config-entry unload normally executes async_on_unload callbacks.
    for callback in unload_callbacks:
        callback()
    assert services.registered == {}

    assert await async_unload_entry(hass, entry) is True
    assert len(services.removed) == 9
    assert hass.data[DOMAIN] == {}
    assert unload_callbacks
