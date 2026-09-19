"""HTTP API for shape-first board suggestions."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.models.board_suggestion import BoardSuggestRequest, BoardSuggestResponse
from app.services.board_suggestion import get_board_suggest_provider
from app.services.credits import InsufficientCreditsError, get_credit_ledger

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=BoardSuggestResponse)
async def suggest_board(request: BoardSuggestRequest) -> BoardSuggestResponse:
    ledger = get_credit_ledger()
    account = request.project_id or "local-demo"
    try:
        ledger.assert_can_spend(account)
    except InsufficientCreditsError as exc:
        raise HTTPException(status_code=402, detail=str(exc)) from exc

    try:
        provider = get_board_suggest_provider()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        suggestion = await provider.suggest(request)
        # Re-validate so bad provider output never reaches the canvas.
        suggestion = type(suggestion).model_validate(suggestion.model_dump())
    except ValidationError as exc:
        log.exception("Board suggestion failed schema validation")
        raise HTTPException(
            status_code=400, detail=f"Invalid board suggestion: {exc}"
        ) from exc
    except Exception as exc:
        log.exception("Board suggestion provider failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    remaining = ledger.spend(account)
    log.info(
        "board suggest ok provider=%s ops=%s credits_remaining=%s",
        provider.name,
        len(suggestion.ops),
        remaining,
    )
    return BoardSuggestResponse(
        suggestion=suggestion,
        provider=provider.name,
        credits_remaining=remaining if ledger.enabled() else None,
    )
