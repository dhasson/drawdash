"""Gemini Flash → BoardSuggestion ShapeOp JSON."""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from typing import Any

import httpx
from google import genai
from pydantic import ValidationError

from app.models.board_suggestion import BoardSuggestion, BoardSuggestRequest

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a workshop whiteboard layout engine for facilitators.
Return ONLY valid JSON (no markdown fences) with this shape:
{"id":"sug-1","ops":[...]}

Each op is one of:
- {"kind":"add_geo","x":n,"y":n,"w":n,"h":n,"label":"short text","color":"blue"|"black"|"green"|"orange"|"violet"|"red"|"yellow"}
- {"kind":"add_note","x":n,"y":n,"w":n,"h":n,"label":"short text","color":"yellow"}

Rules:
- Drawing Area is roughly x=24..760, y=24..560. Keep shapes inside.
- Prefer add_geo rectangles for process steps. Use add_note for phase headers only.
- Short labels (2-6 words). No paragraphs.
- For multi-actor journeys, use horizontal rows (swimlanes): one row per actor, steps left-to-right.
- Typical step size w=120..150, h=56..72, gap ~12.
- Emit 8..24 ops for a detailed journey. Do not emit empty lane shells only.
- Do not invent kinds other than add_geo and add_note.
- Ignore requests for photos or raster art. Only shapes.
"""


def _extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fence:
        cleaned = fence.group(1).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("Model response contained no JSON object")
    return json.loads(cleaned[start : end + 1])


def _gemini_client(api_key: str) -> genai.Client:
    insecure = os.environ.get("DRAWDASH_INSECURE_SSL", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    if not insecure and sys.platform == "win32":
        insecure = True
        log.warning(
            "shape_llm using unverified httpx on Windows "
            "(set DRAWDASH_INSECURE_SSL=false to force cert checks)"
        )
    if insecure:
        return genai.Client(
            api_key=api_key,
            http_options={
                "httpx_client": httpx.Client(verify=False, timeout=180.0),
            },
        )
    return genai.Client(api_key=api_key)


class ShapeLlmBoardSuggestProvider:
    name = "shape_llm"

    def __init__(self) -> None:
        api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is required for BOARD_SUGGEST_PROVIDER=shape_llm")
        self.client = _gemini_client(api_key)
        self.model = (
            os.environ.get("BOARD_SUGGEST_MODEL", "gemini-3.1-flash-lite").strip()
            or "gemini-3.1-flash-lite"
        )

    async def suggest(self, request: BoardSuggestRequest) -> BoardSuggestion:
        summary = request.board_summary or []
        user = (
            f"Facilitator prompt:\n{request.prompt}\n\n"
            f"Existing board shapes (may be empty): {json.dumps(summary)[:2000]}\n\n"
            "Produce ShapeOp JSON for the next pending suggestion."
        )
        log.info(
            "Using BOARD_SUGGEST_PROVIDER=shape_llm model=%s prompt_chars=%s",
            self.model,
            len(request.prompt),
        )
        text = ""
        last_exc: Exception | None = None
        for attempt in range(1, 4):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[SYSTEM_PROMPT, user],
                )
                if not response.candidates:
                    raise ValueError("shape_llm returned no candidates")
                text = ""
                for part in response.candidates[0].content.parts:
                    if part.text is not None:
                        text += part.text
                if not text.strip():
                    raise ValueError("shape_llm returned empty text")
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                message = str(exc).lower()
                retryable = "503" in message or "unavailable" in message or "high demand" in message
                log.warning(
                    "shape_llm attempt %s failed retryable=%s: %s",
                    attempt,
                    retryable,
                    exc,
                )
                if not retryable or attempt == 3:
                    break
                time.sleep(1.5 * attempt)
        if last_exc is not None:
            log.error("shape_llm Gemini call failed: %s", last_exc)
            raise RuntimeError(f"shape_llm failed: {last_exc}") from last_exc

        try:
            raw = _extract_json_object(text)
            if not isinstance(raw.get("id"), str) or not raw["id"]:
                raw["id"] = f"sug-{int(time.time() * 1000)}"
            suggestion = BoardSuggestion.model_validate(raw)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            log.error("shape_llm invalid JSON: %s text=%s", exc, text[:500])
            raise ValueError(f"shape_llm returned invalid BoardSuggestion: {exc}") from exc

        if not suggestion.ops:
            raise ValueError("shape_llm returned zero ops")
        if len(suggestion.ops) > 40:
            suggestion = BoardSuggestion(id=suggestion.id, ops=suggestion.ops[:40])
            log.warning("shape_llm truncated ops to 40")

        log.info("shape_llm ok ops=%s", len(suggestion.ops))
        return suggestion
