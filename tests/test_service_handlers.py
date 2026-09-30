"""Direct tests for the service handlers registered in __init__.py.

Until now these handlers were only exercised indirectly, through
journal.totals() checks in test_journal.py, or via FakeServices in
test_integration.py which only checks registration/removal, never
calls the handlers. This drives them directly (same
services.registered capture pattern as test_integration.py) against a
real PelletJournal whose Store I/O is stubbed out, to exercise the
validation and error paths a user actually hits (stock insuffisant,
saisie introuvable, edition qui viderait le stock...).
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.core import CoreState
from homeassistant.exceptions import ServiceValidationError

from custom_components.suivi_stock_pellet import (
    DOMAIN,
    SERVICE_DELETE_ENTRY,
    SERVICE_EDIT_ENTRY,
    SERVICE_LOG_CONSUMPTION,
    SERVICE_LOG_PURCHASE,
    SERVICE_SET_STOCK_INITIAL,
    SERVICE_UNDO_LAST_ENTRY,
    async_setup_entry,
)
from custom_components.suivi_stock_pellet.const import (
    ATTR_INDEX,
    ATTR_PRICE_EUR,
    ATTR_QTY_BAGS,
    ATTR_STOCK_INITIAL_BAGS,
    ATTR_UNIT,
    CONF_BAG_PRICE,
)
from custom_components.suivi_stock_pellet.journal import PelletJournal


class FakeServices:
    def __init__(self):
        self.registered = {}

    def async_register(self, domain, service, handler, schema=None):
        self.registered[(domain, service)] = handler

    def has_service(self, domain, service):
        return (domain, service) in self.registered

    def async_remove(self, domain, service):
        self.registered.pop((domain, service), None)

async def _setup(options=None):
    """Register the real service handlers against a real PelletJournal
    (Store I/O stubbed) and return them keyed by service name."""
    services = FakeServices()
    hass = SimpleNamespace(
        data={},
        state=CoreState.running,
        services=services,
        config=SimpleNamespace(config_dir="/tmp"),
        config_entries=SimpleNamespace(
            async_forward_entry_setups=AsyncMock(),
            async_unload_platforms=AsyncMock(return_value=True),
            async_reload=AsyncMock(),
        ),
        http=MagicMock(),
    )
    entry = SimpleNamespace(
        entry_id="test-entry",
        title="Granules",
        options=options or {},
        add_update_listener=MagicMock(return_value=lambda: None),
        async_on_unload=lambda callback: None,
    )
    patch("custom_components.suivi_stock_pellet.async_dispatcher_send").start()
    journal = PelletJournal(hass, entry.entry_id)
    journal.async_load = AsyncMock()
    journal.async_prune_empty_seasons = AsyncMock()
    journal._async_save = AsyncMock()

    with (
        patch("custom_components.suivi_stock_pellet.PelletJournal", return_value=journal),
        patch("custom_components.suivi_stock_pellet.async_register_ws_api"),
        patch("custom_components.suivi_stock_pellet._async_register_card", new=AsyncMock()),
):
        await async_setup_entry(hass, entry)

    handlers = {
        service: handler
        for (domain, service), handler in services.registered.items()
        if domain == DOMAIN
    }
    return handlers, journal

def _call(data):
    call = MagicMock()
    call.data = data
    return call

@pytest.mark.asyncio
async def test_log_purchase_uses_configured_default_price_when_missing():
    handlers, journal = await _setup(options={CONF_BAG_PRICE: 7.0})
    await handlers[SERVICE_LOG_PURCHASE](
        _call({ATTR_QTY_BAGS: 10.0, ATTR_UNIT: "bag", "season": "2025-2026"})
    )
    totals = journal.totals("2025-2026")
    assert totals["purchased_bags"] == 10.0
    assert totals["spent_eur"] == 70.0

@pytest.mark.asyncio
async def test_log_consumption_nominal_reduces_stock():
    handlers, journal = await _setup()
    await handlers[SERVICE_LOG_PURCHASE](
        _call(
            {
                ATTR_QTY_BAGS: 10.0,
                ATTR_UNIT: "bag",
                ATTR_PRICE_EUR: 65.0,
                "season": "2025-2026",
            }
        )
    )
    await handlers[SERVICE_LOG_CONSUMPTION](
        _call({ATTR_QTY_BAGS: 3.0, ATTR_UNIT: "bag", "season": "2025-2026"})
    )
    assert journal.totals("2025-2026")["stock_bags"] == 7.0

@pytest.mark.asyncio
async def test_log_consumption_raises_when_stock_insufficient():
    handlers, journal = await _setup()
    call = _call({ATTR_QTY_BAGS: 5.0, ATTR_UNIT: "bag", "season": "2025-2026"})
    with pytest.raises(ServiceValidationError):
        await handlers[SERVICE_LOG_CONSUMPTION](call)
    assert journal.totals("2025-2026")["stock_bags"] == 0.0

@pytest.mark.asyncio
async def test_log_consumption_raises_when_quantity_missing_for_unit():
    handlers, journal = await _setup()
    call = _call({ATTR_UNIT: "kg", "season": "2025-2026"})
    with pytest.raises(ServiceValidationError):
        await handlers[SERVICE_LOG_CONSUMPTION](call)

@pytest.mark.asyncio
async def test_undo_last_entry_raises_when_nothing_to_undo():
    handlers, journal = await _setup()
    call = _call({"season": "2025-2026"})
    with pytest.raises(ServiceValidationError):
        await handlers[SERVICE_UNDO_LAST_ENTRY](call)

@pytest.mark.asyncio
async def test_undo_last_entry_removes_most_recent_entry():
    handlers, journal = await _setup()
    await handlers[SERVICE_LOG_PURCHASE](
        _call(
            {
                ATTR_QTY_BAGS: 10.0,
                ATTR_UNIT: "bag",
                ATTR_PRICE_EUR: 65.0,
                "season": "2025-2026",
            }
        )
    )
    await handlers[SERVICE_UNDO_LAST_ENTRY](_call({"season": "2025-2026"}))
    assert journal.totals("2025-2026")["purchased_bags"] == 0.0

@pytest.mark.asyncio
async def test_delete_entry_raises_when_index_not_found():
    handlers, journal = await _setup()
    call = _call({"season": "2025-2026", ATTR_INDEX: 0})
    with pytest.raises(ServiceValidationError):
        await handlers[SERVICE_DELETE_ENTRY](call)

@pytest.mark.asyncio
async def test_edit_entry_raises_when_it_would_push_stock_negative():
    handlers, journal = await _setup()
    await handlers[SERVICE_LOG_PURCHASE](
        _call(
            {
                ATTR_QTY_BAGS: 5.0,
                ATTR_UNIT: "bag",
                ATTR_PRICE_EUR: 32.5,
                "season": "2025-2026",
            }
        )
    )
    await handlers[SERVICE_LOG_CONSUMPTION](
        _call({ATTR_QTY_BAGS: 5.0, ATTR_UNIT: "bag", "season": "2025-2026"})
    )
    call = _call(
        {
            "season": "2025-2026",
            ATTR_INDEX: 0,
            ATTR_QTY_BAGS: 2.0,
            ATTR_UNIT: "bag",
        }
    )
    with pytest.raises(ServiceValidationError):
        await handlers[SERVICE_EDIT_ENTRY](call)

@pytest.mark.asyncio
async def test_set_stock_initial_updates_totals():
    handlers, journal = await _setup()
    await handlers[SERVICE_SET_STOCK_INITIAL](
        _call({"season": "2025-2026", ATTR_STOCK_INITIAL_BAGS: 12.0})
    )
    assert journal.totals("2025-2026")["stock_initial_bags"] == 12.0
