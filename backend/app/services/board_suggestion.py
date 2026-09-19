"""Board suggestion providers (mock first; LLM optional)."""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Protocol

from app.models.board_suggestion import (
    AddGeoOp,
    AddNoteOp,
    BoardSuggestion,
    BoardSuggestRequest,
)
from app.services.shape_llm_suggest import ShapeLlmBoardSuggestProvider

log = logging.getLogger(__name__)


class BoardSuggestProvider(Protocol):
    name: str

    async def suggest(self, request: BoardSuggestRequest) -> BoardSuggestion: ...


class MockBoardSuggestProvider:
    name = "mock"

    async def suggest(self, request: BoardSuggestRequest) -> BoardSuggestion:
        suggestion_id = f"sug-{int(time.time() * 1000)}"
        lower = request.prompt.lower()
        if re.search(r"lane|passenger|aircraft|suitcase|baggage|swim", lower):
            labels = ["Passenger", "Aircraft", "Suitcase"]
            pad = 24.0
            lane_h = 36.0
            lane_w = 560.0
            start_y = 280.0
            ops = [
                AddGeoOp(
                    kind="add_geo",
                    x=pad,
                    y=start_y + i * (lane_h + 8),
                    w=lane_w,
                    h=lane_h,
                    label=f"{label} swimlane",
                    color="blue",
                )
                for i, label in enumerate(labels)
            ]
            return BoardSuggestion(id=suggestion_id, ops=ops)

        return BoardSuggestion(
            id=suggestion_id,
            ops=[
                AddNoteOp(
                    kind="add_note",
                    x=40,
                    y=260,
                    w=160,
                    h=72,
                    label=request.prompt[:80],
                    color="yellow",
                )
            ],
        )


def get_board_suggest_provider() -> BoardSuggestProvider:
    key = (os.environ.get("BOARD_SUGGEST_PROVIDER") or "mock").strip().lower() or "mock"
    if key == "mock":
        return MockBoardSuggestProvider()
    if key in {"shape_llm", "shape-llm", "gemini"}:
        return ShapeLlmBoardSuggestProvider()
    raise ValueError(
        f"Unknown BOARD_SUGGEST_PROVIDER={key!r}. Use mock or shape_llm."
    )
