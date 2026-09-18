"""Free Pollinations text-to-image provider."""

from __future__ import annotations

import logging
import os
from io import BytesIO
from urllib.parse import quote

import httpx
from PIL import Image

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.providers.base import image_to_base64_png

log = logging.getLogger(__name__)


class PollinationsProvider:
    async def generate(
        self, request: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        log.info("Using IMAGE_PROVIDER=pollinations")
        prompt = (
            "Clean educational diagram on white background, minimal line art, "
            "labeled boxes and arrows. "
            f"{request.prompt}"
        )
        encoded = quote(prompt)
        url = (
            f"https://gen.pollinations.ai/image/{encoded}"
            f"?model=flux&width=1024&height=768&nologo=true"
        )

        headers = {}
        api_key = os.environ.get("POLLINATIONS_API_KEY", "").strip()
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(url, headers=headers, follow_redirects=True)
                response.raise_for_status()
                image = Image.open(BytesIO(response.content)).convert("RGB")
        except Exception as e:
            log.error("Pollinations request failed: %s", e)
            raise RuntimeError(f"Failed to generate image via Pollinations: {e}") from e

        return ImageGenerationResponse(
            image_data=image_to_base64_png(image),
            text_response="Generated via Pollinations (free)",
        )
