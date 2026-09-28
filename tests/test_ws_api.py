"""Regression tests for the journal WebSocket API schemas."""

import pytest
import voluptuous as vol

from custom_components.suivi_stock_pellet.ws_api import (
    _ws_csv_import_commit,
    _ws_csv_import_preview,
    _ws_get_journal,
    _ws_get_season_comparison,
    _ws_get_seasons_summary,
)


COMMANDS = (
    (_ws_get_journal, "suivi_stock_pellet/journal"),
    (_ws_get_seasons_summary, "suivi_stock_pellet/seasons_summary"),
    (_ws_get_season_comparison, "suivi_stock_pellet/season_comparison"),
    (_ws_csv_import_preview, "suivi_stock_pellet/csv_import_preview"),
    (_ws_csv_import_commit, "suivi_stock_pellet/csv_import_commit"),
)


@pytest.mark.parametrize(("handler", "command_type"), COMMANDS)
def test_websocket_schema_accepts_required_message(handler, command_type):
    message = {"id": 1, "type": command_type}
    if "csv_import" in command_type:
        message["content"] = "Date,Type,Quantité\\n2025-09-01,Achat,10"
    assert handler._ws_schema(message)["type"] == command_type


def test_journal_websocket_schema_accepts_entry_id():
    schema = _ws_get_journal._ws_schema
    result = schema(
        {"id": 1, "type": "suivi_stock_pellet/journal", "entry_id": "abc"}
    )
    assert result["entry_id"] == "abc"


def test_seasons_summary_schema_accepts_entry_id():
    schema = _ws_get_seasons_summary._ws_schema
    result = schema(
        {
            "id": 1,
            "type": "suivi_stock_pellet/seasons_summary",
            "entry_id": "abc",
        }
    )
    assert result["entry_id"] == "abc"


def test_journal_schema_rejects_non_string_entry_id():
    schema = _ws_get_journal._ws_schema
    with pytest.raises(vol.Invalid):
        schema(
            {
                "id": 1,
                "type": "suivi_stock_pellet/journal",
                "entry_id": 123,
            }
        )


def test_csv_preview_schema_enforces_non_empty_content():
    schema = _ws_csv_import_preview._ws_schema
    with pytest.raises(vol.Invalid):
        schema(
            {
                "id": 1,
                "type": "suivi_stock_pellet/csv_import_preview",
                "content": "",
            }
        )


def test_csv_commit_schema_rejects_invalid_skip_duplicates():
    schema = _ws_csv_import_commit._ws_schema
    with pytest.raises(vol.Invalid):
        schema(
            {
                "id": 1,
                "type": "suivi_stock_pellet/csv_import_commit",
                "content": "x",
                "skip_duplicates": "yes",
            }
        )


def test_csv_commit_schema_defaults_skip_duplicates_to_false():
    schema = _ws_csv_import_commit._ws_schema
    result = schema(
        {
            "id": 1,
            "type": "suivi_stock_pellet/csv_import_commit",
            "content": "x",
        }
    )
    assert result["skip_duplicates"] is False
