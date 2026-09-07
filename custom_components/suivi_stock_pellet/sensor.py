"""Sensor platform for Suivi Stock Pellet."""
from __future__ import annotations

from datetime import date as date_cls, datetime
import logging

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import (
    CONF_BAG_WEIGHT_KG,
    CONF_CALORIFIC_VALUE,
    CONF_SEASON_START_MONTH,
    DEFAULT_BAG_WEIGHT_KG,
    DEFAULT_CALORIFIC_VALUE,
    DEFAULT_SEASON_START_MONTH,
    DOMAIN,
)
from .journal import PelletJournal, season_for_date

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    journal: PelletJournal = hass.data[DOMAIN][entry.entry_id]

    async_add_entities(
        [
            PelletStockSensor(entry, journal),
            PelletConsumedKgSensor(entry, journal),
            PelletConsumedEnergySensor(entry, journal),
            PelletPurchasedSensor(entry, journal),
            PelletSpentSensor(entry, journal),
            PelletDaysUsedSensor(entry, journal),
        ]
    )


class _BasePelletSensor(SensorEntity):
    """Common behaviour: recompute on journal change, no polling."""

    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(
        self, entry: ConfigEntry, journal: PelletJournal, key: str, name: str
    ) -> None:
        self._entry = entry
        self._journal = journal
        self._key = key
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_name = name
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title or "Suivi Stock Pellet",
            manufacturer="cyclope205",
            model="Suivi Stock Pellet",
        )

    @property
    def _season(self) -> str:
        start_month = self._entry.options.get(
            CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH
        )
        return season_for_date(date_cls.today(), start_month)

    @property
    def _season_start(self) -> datetime:
        """Start of the current season, as a tz-aware local midnight.

        Used as `last_reset` by the TOTAL-class accumulator sensors, so
        Home Assistant's long-term statistics correctly zero out at each
        season boundary instead of guessing from value decreases (which
        can also happen mid-season from a historical entry correction,
        not just a real season reset).
        """
        start_month = self._entry.options.get(
            CONF_SEASON_START_MONTH, DEFAULT_SEASON_START_MONTH
        )
        year_start = int(self._season.split("-")[0])
        return dt_util.start_of_local_day(date_cls(year_start, start_month, 1))

    @property
    def _bag_weight(self) -> float:
        return self._entry.options.get(CONF_BAG_WEIGHT_KG, DEFAULT_BAG_WEIGHT_KG)

    @property
    def _calorific_value(self) -> float:
        return self._entry.options.get(CONF_CALORIFIC_VALUE, DEFAULT_CALORIFIC_VALUE)

    async def async_added_to_hass(self) -> None:
        signal = f"suivi_stock_pellet_update_{self._entry.entry_id}"
        self.async_on_remove(
            async_dispatcher_connect(self.hass, signal, self._handle_update)
        )

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()

    def _base_attrs(self) -> dict:
        # Stable marker the Lovelace card uses to find this entity, immune to
        # entity_id changes caused by renaming the friendly name / slugification.
        return {"suivi_stock_pellet_key": self._key}


class PelletStockSensor(_BasePelletSensor):
    _attr_icon = "mdi:silo"
    _attr_native_unit_of_measurement = "kg"
    _attr_suggested_display_precision = 1

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "stock", "Stock")

    @property
    def native_value(self) -> float:
        totals = self._journal.totals(
            self._season, default_bag_weight_kg=self._bag_weight
        )
        return round(totals["stock_kg"], 1)

    @property
    def extra_state_attributes(self) -> dict:
        totals = self._journal.totals(self._season)
        last = self._journal.last_entry(self._season)
        attrs = self._base_attrs()
        attrs.update(
            {
                "stock_sacs": totals["stock_bags"],
                "saison": self._season,
                "poids_sac_kg": self._bag_weight,
                "derniere_saisie": _summarize_entry(last),
            }
        )
        return attrs


class PelletConsumedKgSensor(_BasePelletSensor):
    _attr_icon = "mdi:fire"
    _attr_native_unit_of_measurement = "kg"
    _attr_state_class = SensorStateClass.TOTAL
    _attr_suggested_display_precision = 1

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "consomme_kg", "Consommé")

    @property
    def last_reset(self) -> datetime:
        return self._season_start

    @property
    def native_value(self) -> float:
        totals = self._journal.totals(
            self._season,
            default_bag_weight_kg=self._bag_weight,
            default_calorific_value=self._calorific_value,
        )
        return round(totals["consumed_kg"], 1)

    @property
    def extra_state_attributes(self) -> dict:
        totals = self._journal.totals(self._season)
        attrs = self._base_attrs()
        attrs.update({"consomme_sacs": totals["consumed_bags"], "saison": self._season})
        return attrs


class PelletConsumedEnergySensor(_BasePelletSensor):
    _attr_icon = "mdi:lightning-bolt"
    _attr_native_unit_of_measurement = "kWh"
    _attr_device_class = SensorDeviceClass.ENERGY
    _attr_state_class = SensorStateClass.TOTAL
    _attr_suggested_display_precision = 1

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "consomme_kwh", "Énergie consommée")

    @property
    def last_reset(self) -> datetime:
        return self._season_start

    @property
    def native_value(self) -> float:
        totals = self._journal.totals(
            self._season,
            default_bag_weight_kg=self._bag_weight,
            default_calorific_value=self._calorific_value,
        )
        return round(totals["consumed_kwh"], 1)

    @property
    def extra_state_attributes(self) -> dict:
        attrs = self._base_attrs()
        attrs.update(
            {
                "saison": self._season,
                "pouvoir_calorifique_kwh_par_kg": self._calorific_value,
            }
        )
        return attrs


class PelletPurchasedSensor(_BasePelletSensor):
    _attr_icon = "mdi:truck-delivery"
    _attr_native_unit_of_measurement = "kg"
    _attr_state_class = SensorStateClass.TOTAL
    _attr_suggested_display_precision = 1

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "achete_kg", "Acheté")

    @property
    def last_reset(self) -> datetime:
        return self._season_start

    @property
    def native_value(self) -> float:
        totals = self._journal.totals(
            self._season, default_bag_weight_kg=self._bag_weight
        )
        return round(totals["purchased_kg"], 1)

    @property
    def extra_state_attributes(self) -> dict:
        totals = self._journal.totals(self._season)
        attrs = self._base_attrs()
        attrs.update({"achete_sacs": totals["purchased_bags"], "saison": self._season})
        return attrs


class PelletSpentSensor(_BasePelletSensor):
    _attr_icon = "mdi:currency-eur"
    _attr_native_unit_of_measurement = "EUR"
    _attr_suggested_display_precision = 2

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "depense", "Dépensé")

    @property
    def native_value(self) -> float:
        return self._journal.totals(self._season)["spent_eur"]

    @property
    def extra_state_attributes(self) -> dict:
        attrs = self._base_attrs()
        attrs.update({"saison": self._season})
        return attrs


class PelletDaysUsedSensor(_BasePelletSensor):
    _attr_icon = "mdi:calendar-check"
    _attr_native_unit_of_measurement = "j"

    def __init__(self, entry: ConfigEntry, journal: PelletJournal) -> None:
        super().__init__(entry, journal, "jours_utilisation", "Jours d'utilisation")

    @property
    def native_value(self) -> int:
        return self._journal.totals(self._season)["days_logged"]

    @property
    def extra_state_attributes(self) -> dict:
        attrs = self._base_attrs()
        attrs.update({"saison": self._season})
        return attrs


def _summarize_entry(entry: dict | None) -> str | None:
    if not entry:
        return None
    label = "Consommation" if entry["type"] == "consumption" else "Achat"
    return f"{label} : {entry['qty_bags']} sac(s) le {entry['date']}"
