"""Fully local diagram renderer — no Google, no Pollinations."""

from __future__ import annotations

import logging
import re
import textwrap

from PIL import Image, ImageDraw, ImageFont

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.providers.base import image_to_base64_png

log = logging.getLogger(__name__)

WIDTH = 1024
HEIGHT = 768


def _font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        try:
            return ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", size)
        except OSError:
            return ImageFont.load_default()


def _split_nodes(prompt: str) -> list[str]:
    cleaned = " ".join(prompt.split())
    if not cleaned:
        return ["(empty prompt)"]

    # Prefer clause/arrow/comma splits for teaching explanations
    parts = re.split(r"(?:\s*(?:→|->|;|\.| then | and then |,)\s*)+", cleaned, flags=re.I)
    nodes = [p.strip(" .:;-") for p in parts if p and len(p.strip(" .:;-")) > 1]

    if len(nodes) <= 1:
        # Fall back to wrapping long text into boxes
        wrapped = textwrap.wrap(cleaned, width=42) or [cleaned]
        return wrapped[:8]

    return nodes[:10]


class LocalDiagramProvider:
    async def generate(
        self, request: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        log.info("Using IMAGE_PROVIDER=local-diagram (no API key)")
        nodes = _split_nodes(request.prompt)

        image = Image.new("RGB", (WIDTH, HEIGHT), "white")
        draw = ImageDraw.Draw(image)
        title_font = _font(22)
        body_font = _font(18)

        draw.rectangle([20, 20, WIDTH - 20, HEIGHT - 20], outline="#111111", width=2)
        draw.text(
            (40, 36),
            "Local diagram (set GOOGLE_API_KEY for smarter SVG)",
            fill="#555555",
            font=title_font,
        )

        box_h = 56
        gap = 28
        top = 90
        usable = HEIGHT - top - 40
        max_boxes = max(1, usable // (box_h + gap))
        nodes = nodes[:max_boxes]

        left = 80
        right = WIDTH - 80
        centers: list[tuple[int, int]] = []

        for i, label in enumerate(nodes):
            y = top + i * (box_h + gap)
            draw.rounded_rectangle(
                [left, y, right, y + box_h],
                radius=10,
                outline="#2563eb",
                width=3,
                fill="#eff6ff",
            )
            text = label[:70]
            draw.text((left + 20, y + 16), text, fill="#111111", font=body_font)
            centers.append(((left + right) // 2, y + box_h))

        for i in range(len(centers) - 1):
            x0, y0 = centers[i]
            x1, y1 = centers[i + 1][0], centers[i + 1][1] - box_h
            draw.line([(x0, y0), (x1, y1)], fill="#111111", width=3)
            # Arrow head
            draw.polygon([(x1, y1), (x1 - 8, y1 - 14), (x1 + 8, y1 - 14)], fill="#111111")

        return ImageGenerationResponse(
            image_data=image_to_base64_png(image),
            text_response="Rendered locally without an API key",
        )
