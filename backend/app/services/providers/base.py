"""Shared helpers for image providers."""

from __future__ import annotations

import base64
import re
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont


def decode_optional_image(image_data: str | None) -> Image.Image | None:
    if not image_data:
        return None
    raw = image_data
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]
    return Image.open(BytesIO(base64.b64decode(raw)))


def image_to_base64_png(image: Image.Image) -> str:
    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def extract_svg(text: str) -> str:
    match = re.search(r"<svg[\s\S]*?</svg>", text, re.IGNORECASE)
    if not match:
        raise ValueError("Model response did not contain an <svg> element")
    return match.group(0)


def rasterize_svg(svg: str, width: int = 1024, height: int = 768) -> Image.Image:
    """Rasterize SVG to PNG.

    Prefers cairosvg when installed; otherwise draws a readable Pillow fallback
    that still returns a valid PNG for the Tab-accept UX.
    """
    try:
        import cairosvg

        png_bytes = cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            output_width=width,
            output_height=height,
        )
        return Image.open(BytesIO(png_bytes)).convert("RGB")
    except Exception:
        return _pillow_svg_fallback(svg, width=width, height=height)


def _pillow_svg_fallback(svg: str, width: int, height: int) -> Image.Image:
    """Best-effort diagram when cairosvg is unavailable (common on Windows)."""
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
        title_font = ImageFont.truetype("arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
        title_font = font

    labels: list[str] = []
    for match in re.finditer(
        r">([^<>]{1,80})</(?:text|title|tspan)>", svg, re.IGNORECASE
    ):
        label = " ".join(match.group(1).split())
        if label and label not in labels:
            labels.append(label)

    draw.rectangle([24, 24, width - 24, height - 24], outline="#111111", width=2)
    draw.text((40, 40), "Suggested diagram (SVG fallback render)", fill="#111111", font=title_font)

    y = 90
    if not labels:
        labels = ["(no text labels found in SVG — install cairosvg for full render)"]
    for label in labels[:18]:
        draw.rounded_rectangle([40, y, width - 40, y + 36], radius=8, outline="#2563eb", width=2)
        draw.text((56, y + 8), label[:70], fill="#111111", font=font)
        y += 48
        if y > height - 60:
            break

    return image
