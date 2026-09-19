"""Board suggestion request/response models."""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator


class AddGeoOp(BaseModel):
    kind: Literal["add_geo"]
    x: float
    y: float
    w: float
    h: float
    label: str
    color: Optional[str] = None


class AddNoteOp(BaseModel):
    kind: Literal["add_note"]
    x: float
    y: float
    w: float
    h: float
    label: str
    color: Optional[str] = None


class UpdateLabelOp(BaseModel):
    kind: Literal["update_label"]
    shapeId: str
    label: str


class DeleteShapeOp(BaseModel):
    kind: Literal["delete_shape"]
    shapeId: str


ShapeOp = Union[AddGeoOp, AddNoteOp, UpdateLabelOp, DeleteShapeOp]


class BoardSuggestion(BaseModel):
    id: str = Field(..., min_length=1)
    ops: list[ShapeOp]


class BoardSuggestRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    project_id: str = "local-demo"
    board_summary: Optional[list[dict[str, Any]]] = None

    @field_validator("prompt")
    @classmethod
    def strip_prompt(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("prompt must not be empty")
        return cleaned


class BoardSuggestResponse(BaseModel):
    suggestion: BoardSuggestion
    provider: str
    credits_remaining: Optional[int] = None
