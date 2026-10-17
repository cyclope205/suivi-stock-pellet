"""Constants for the Suivi Stock Pellet integration."""

DOMAIN = "suivi_stock_pellet"

CONF_BAG_WEIGHT_KG = "bag_weight_kg"
CONF_DEFAULT_BAG_QTY = "default_bag_qty"
CONF_BAG_PRICE = "bag_price"
CONF_PRICE_PER_KG = "price_per_kg"
CONF_CALORIFIC_VALUE = "calorific_value_kwh_per_kg"
CONF_SEASON_START_MONTH = "season_start_month"
CONF_DISPLAY_UNIT = "display_unit"

DEFAULT_BAG_WEIGHT_KG = 15.0
DEFAULT_BAG_QTY = 1
DEFAULT_BAG_PRICE = 6.5
DEFAULT_PRICE_PER_KG = DEFAULT_BAG_PRICE / DEFAULT_BAG_WEIGHT_KG
DEFAULT_CALORIFIC_VALUE = 4.8
DEFAULT_SEASON_START_MONTH = 9
DEFAULT_DISPLAY_UNIT = "bag"

STORAGE_VERSION = 1

UNIT_BAG = "bag"
UNIT_KG = "kg"

SERVICE_LOG_CONSUMPTION = "log_consumption"
SERVICE_LOG_PURCHASE = "log_purchase"
SERVICE_UNDO_LAST_ENTRY = "undo_last_entry"
SERVICE_EDIT_ENTRY = "edit_entry"
SERVICE_DELETE_ENTRY = "delete_entry"
SERVICE_SET_STOCK_INITIAL = "set_stock_initial"
SERVICE_DELETE_SEASON = "delete_season"
SERVICE_LOG_MAINTENANCE = "log_maintenance"
SERVICE_LOG_ENTRETIEN = "log_entretien"
SERVICE_EXPORT_CSV = "export_csv"

ATTR_QTY_BAGS = "qty_bags"
ATTR_QTY_KG = "qty_kg"
ATTR_UNIT = "unit"
ATTR_PRICE_EUR = "price_eur"
ATTR_DATE = "date"
ATTR_INDEX = "index"
ATTR_STOCK_INITIAL_BAGS = "stock_initial_bags"
ATTR_STOCK_INITIAL_KG = "stock_initial_kg"
ATTR_NOTE = "note"
ATTR_DATE_FROM = "date_from"
ATTR_DATE_TO = "date_to"
ATTR_TYPES = "types"

ENTRY_TYPE_CONSUMPTION = "consumption"
ENTRY_TYPE_PURCHASE = "purchase"
ENTRY_TYPE_MAINTENANCE = "maintenance"
ENTRY_TYPE_ENTRETIEN = "entretien"
