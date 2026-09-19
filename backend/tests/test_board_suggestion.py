"""Board suggestion schema + credits spend-after-success."""

from __future__ import annotations

import asyncio
import os

import pytest
from pydantic import ValidationError

from app.models.board_suggestion import BoardSuggestion, BoardSuggestRequest
from app.services.board_suggestion import MockBoardSuggestProvider, get_board_suggest_provider
from app.services.credits import CreditLedger, InsufficientCreditsError


def test_mock_provider_returns_swimlanes():
    provider = MockBoardSuggestProvider()
    suggestion = asyncio.run(
        provider.suggest(
            BoardSuggestRequest(
                prompt="aircraft passenger suitcase as swimlanes",
                project_id="local-demo",
            )
        )
    )
    assert len(suggestion.ops) == 3
    assert all(op.kind == "add_geo" for op in suggestion.ops)


def test_invalid_suggestion_ops_rejected():
    with pytest.raises(ValidationError):
        BoardSuggestion.model_validate(
            {"id": "x", "ops": [{"kind": "warp_drive", "x": 1}]}
        )


def test_unknown_provider_fails_loud(monkeypatch):
    monkeypatch.setenv("BOARD_SUGGEST_PROVIDER", "not-a-provider")
    with pytest.raises(ValueError, match="Unknown BOARD_SUGGEST_PROVIDER"):
        get_board_suggest_provider()


def test_suggest_credits_spend_after_success(monkeypatch):
    monkeypatch.setenv("CREDITS_ENABLED", "true")
    monkeypatch.setenv("CREDITS_DEFAULT_BALANCE", "2")
    ledger = CreditLedger()
    ledger.assert_can_spend("board-demo")
    remaining = ledger.spend("board-demo")
    assert remaining == 1
    remaining = ledger.spend("board-demo")
    assert remaining == 0
    with pytest.raises(InsufficientCreditsError):
        ledger.assert_can_spend("board-demo")


def test_default_provider_is_mock(monkeypatch):
    monkeypatch.delenv("BOARD_SUGGEST_PROVIDER", raising=False)
    assert get_board_suggest_provider().name == "mock"
