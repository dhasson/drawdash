"""deAPI image edit (Qwen Image Edit Plus) — canvas + prompt."""

from __future__ import annotations

import asyncio
import logging
import os
import random
from io import BytesIO

import httpx
from PIL import Image

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.providers.base import decode_optional_image, image_to_base64_png

log = logging.getLogger(__name__)

DEAPI_BASE = "https://api.deapi.ai"
DEFAULT_MODEL = "QwenImageEdit_Plus_NF4"
POLL_INTERVAL_S = 2.0
POLL_TIMEOUT_S = 300.0
MIN_IMAGE_BYTES = 1024


def _png_at_least_1kb(image: Image.Image) -> bytes:
    """deAPI returns 422 if the image field is under 1KB."""
    rgb = image.convert("RGB")
    buf = BytesIO()
    rgb.save(buf, format="PNG")
    data = buf.getvalue()
    if len(data) >= MIN_IMAGE_BYTES:
        return data

    # Pad with near-white noise so tiny whiteboard captures still pass the gate
    w = max(rgb.width, 512)
    h = max(rgb.height, 384)
    padded = Image.new("RGB", (w, h), "white")
    padded.paste(rgb, (0, 0))
    out = BytesIO()
    padded.save(out, format="PNG")
    return out.getvalue()


class DeapiEditProvider:
    async def generate(
        self, request: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        api_key = os.environ.get("DEAPI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("DEAPI_API_KEY is not set")

        model = (
            os.environ.get("DEAPI_EDIT_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
        )
        steps_raw = os.environ.get("DEAPI_EDIT_STEPS", "20").strip() or "20"
        try:
            steps = int(steps_raw)
        except ValueError:
            steps = 20

        reference = decode_optional_image(request.image_data)
        if reference is None:
            reference = Image.new("RGB", (1024, 768), "white")
            log.info("deAPI edit: no canvas image; using blank white frame")

        png_bytes = _png_at_least_1kb(reference)

        seed = random.randint(1, 2_147_483_647)
        prompt = request.prompt.strip()
        if request.type == "edit":
            prompt = (
                "Edit the provided whiteboard/canvas image. "
                "Preserve the existing scene unless the instruction says otherwise. "
                f"Instruction: {prompt}"
            )
        else:
            prompt = (
                "Create a clear visual based on this canvas and instruction. "
                f"Instruction: {prompt}"
            )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }

        log.info(
            "Using IMAGE_PROVIDER=deapi-edit model=%s type=%s steps=%s png_bytes=%s",
            model,
            request.type,
            steps,
            len(png_bytes),
        )

        # verify=False: same Windows CA issue as Pollinations/Gemini on this machine
        timeout = httpx.Timeout(30.0, read=180.0)
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            files = {"image": ("canvas.png", png_bytes, "image/png")}
            data = {
                "prompt": prompt,
                "model": model,
                "seed": str(seed),
                "steps": str(steps),
            }
            submit = await client.post(
                f"{DEAPI_BASE}/api/v2/images/edits",
                headers=headers,
                data=data,
                files=files,
            )
            if submit.status_code == 429:
                raise RuntimeError(
                    "deAPI rate limit hit (Basic is ~1 edit/min, 15/day). Wait and retry."
                )
            if submit.status_code >= 400:
                detail = submit.text[:500]
                raise RuntimeError(
                    f"deAPI edit submit failed ({submit.status_code}): {detail}"
                )

            payload = submit.json()
            request_id = (payload.get("data") or {}).get("request_id")
            if not request_id:
                raise RuntimeError(f"deAPI edit missing request_id: {payload}")

            log.info("deAPI job submitted request_id=%s", request_id)
            result_url = await self._poll_result(client, headers, request_id)
            image_resp = await client.get(result_url, follow_redirects=True)
            image_resp.raise_for_status()
            image = Image.open(BytesIO(image_resp.content)).convert("RGB")

        return ImageGenerationResponse(
            image_data=image_to_base64_png(image),
            text_response=f"Edited via deAPI ({model})",
        )

    async def _poll_result(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        request_id: str,
    ) -> str:
        elapsed = 0.0
        while elapsed < POLL_TIMEOUT_S:
            status_resp = await client.get(
                f"{DEAPI_BASE}/api/v2/jobs/{request_id}",
                headers=headers,
            )
            status_resp.raise_for_status()
            body = status_resp.json()
            data = body.get("data") or {}
            status = data.get("status")
            if status == "done":
                result_url = data.get("result_url")
                if not result_url:
                    raise RuntimeError(f"deAPI job done without result_url: {data}")
                log.info(
                    "deAPI job done request_id=%s after %.0fs", request_id, elapsed
                )
                return result_url
            if status == "error":
                reason = data.get("error_reason") or data.get("error_code") or "unknown"
                raise RuntimeError(f"deAPI edit job failed: {reason}")

            await asyncio.sleep(POLL_INTERVAL_S)
            elapsed += POLL_INTERVAL_S

        raise RuntimeError(
            f"deAPI edit timed out after {POLL_TIMEOUT_S:.0f}s (job {request_id})"
        )
