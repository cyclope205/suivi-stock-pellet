"""Constants for the Suivi Stock Pellet integration."""

DOMAIN = "suivi_stock_pellet"

CONF_BAG_WEIGHT_KG = "bag_weight_kg"
CONF_BAG_PRICE = "bag_price"
CONF_CALORIFIC_VALUE = "calorific_value_kwh_per_kg"
CONF_SEASON_START_MONTH = "season_start_month"

DEFAULT_BAG_WEIGHT_KG = 15.0
DEFAULT_BAG_PRICE = 6.5
DEFAULT_CALORIFIC_VALUE = 4.8
DEFAULT_SEASON_START_MONTH = 9

STORAGE_VERSION = 1

SERVICE_LOG_CONSUMPTION = "log_consumption"
SERVICE_LOG_PURCHASE = "log_purchase"
SERVICE_UNDO_LAST_ENTRY = "undo_last_entry"
SERVICE_EDIT_ENTRY = "edit_entry"

ATTR_QTY_BAGS = "qty_bags"
ATTR_PRICE_EUR = "price_eur"
ATTR_DATE = "date"
ATTR_INDEX = "index"

ENTRY_TYPE_CONSUMPTION = "consumption"
ENTRY_TYPE_PURCHASE = "purchase"
