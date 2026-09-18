"""Unit tests for credit ledger and canvas-edit provider contract."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import pytest

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.credits import CreditLedger, InsufficientCreditsError
from app.services.providers.base import decode_optional_image


def test_credits_disabled_allows_unlimited():
    os.environ.pop("CREDITS_ENABLED", None)
    ledger = CreditLedger()
    assert ledger.enabled() is False
    ledger.assert_can_spend("local-demo")
    assert ledger.spend("local-demo") == -1


def test_credits_spend_after_success_and_block_at_zero(monkeypatch):
    monkeypatch.setenv("CREDITS_ENABLED", "true")
    monkeypatch.setenv("CREDITS_DEFAULT_BALANCE", "2")
    ledger = CreditLedger()
    assert ledger.balance("acct") == 2
    assert ledger.spend("acct") == 1
    assert ledger.spend("acct") == 0
    with pytest.raises(InsufficientCreditsError):
        ledger.assert_can_spend("acct")
    with pytest.raises(InsufficientCreditsError):
        ledger.spend("acct")


def test_failed_generate_does_not_spend(monkeypatch):
    """Spend happens only after provider success in ImageService; ledger alone stays put."""
    monkeypatch.setenv("CREDITS_ENABLED", "true")
    monkeypatch.setenv("CREDITS_DEFAULT_BALANCE", "3")
    ledger = CreditLedger()
    ledger.assert_can_spend("a")
    assert ledger.balance("a") == 3


class _FakeCanvasProvider:
    def __init__(self) -> None:
        self.last_request: ImageGenerationRequest | None = None

    async def generate(self, request: ImageGenerationRequest) -> ImageGenerationResponse:
        self.last_request = request
        if request.type == "edit" and not request.image_data:
            raise AssertionError("edit requires image_data")
        if request.type == "edit":
            assert decode_optional_image(request.image_data) is not None
        return ImageGenerationResponse(image_data="aGVsbG8=", text_response="fake")


def test_edit_contract_requires_image_data():
    provider = _FakeCanvasProvider()
    req = ImageGenerationRequest(
        prompt="add arrow",
        project_id="local-demo",
        type="edit",
        image_data=None,
    )
    with pytest.raises(AssertionError, match="image_data"):
        asyncio.run(provider.generate(req))


def test_edit_contract_accepts_png_base64():
    # 1x1 PNG
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    provider = _FakeCanvasProvider()
    req = ImageGenerationRequest(
        prompt="add arrow",
        project_id="local-demo",
        type="edit",
        image_data=png_b64,
    )
    out = asyncio.run(provider.generate(req))
    assert out.image_data == "aGVsbG8="
    assert provider.last_request is not None
    assert provider.last_request.image_data == png_b64
