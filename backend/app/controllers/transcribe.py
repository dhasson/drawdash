"""Local faster-whisper transcription (no Chrome cloud, no Gemini)."""

from __future__ import annotations

import base64
import logging
import os
import tempfile
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter()

MIME_TO_SUFFIX = {
    "audio/webm": ".webm",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".mp4",
    "audio/m4a": ".m4a",
    "audio/ogg": ".ogg",
}


class TranscribeRequest(BaseModel):
    audio_data: str = Field(description="Base64-encoded audio (no data: URL prefix required).")
    mime_type: str = Field(
        default="audio/webm",
        description="Browser MediaRecorder mime type, e.g. audio/webm or audio/mp4.",
    )


class TranscribeResponse(BaseModel):
    transcript: str


@lru_cache(maxsize=1)
def get_whisper_model():
    from faster_whisper import WhisperModel

    model_size = os.environ.get("WHISPER_MODEL", "base").strip() or "base"
    device = os.environ.get("WHISPER_DEVICE", "cpu").strip() or "cpu"
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8").strip() or "int8"
    log.info(
        "Loading faster-whisper model=%s device=%s compute_type=%s",
        model_size,
        device,
        compute_type,
    )
    return WhisperModel(model_size, device=device, compute_type=compute_type)


@router.post("", response_model=TranscribeResponse)
async def transcribe(request: TranscribeRequest) -> TranscribeResponse:
    raw = request.audio_data
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]

    try:
        audio_bytes = base64.b64decode(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio_data: {e}") from e

    if len(audio_bytes) < 100:
        raise HTTPException(status_code=400, detail="Audio clip is empty or too short")

    mime = (request.mime_type or "audio/webm").split(";")[0].strip().lower()
    suffix = MIME_TO_SUFFIX.get(mime, ".webm")
    log.info("Transcribing %s bytes as %s with faster-whisper", len(audio_bytes), mime)

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        model = get_whisper_model()
        segments, _info = model.transcribe(
            tmp_path,
            beam_size=1,
            vad_filter=True,
        )
        transcript = " ".join(seg.text.strip() for seg in segments if seg.text).strip()
    except Exception as e:
        log.error("faster-whisper transcription failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {e}",
        ) from e
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    return TranscribeResponse(transcript=transcript)
