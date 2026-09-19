"""Image generation providers selected via IMAGE_PROVIDER."""

from __future__ import annotations

import logging
import os

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.providers.deapi_edit import DeapiEditProvider
from app.services.providers.gemini_image import GeminiImageProvider
from app.services.providers.local_diagram import LocalDiagramProvider
from app.services.providers.pollinations import PollinationsProvider
from app.services.providers.svg_llm import SvgLlmProvider

log = logging.getLogger(__name__)

PROVIDERS = {
    "local-diagram": LocalDiagramProvider,
    "svg-llm": SvgLlmProvider,
    "pollinations": PollinationsProvider,
    "gemini-image": GeminiImageProvider,
    "deapi-edit": DeapiEditProvider,
}


def resolve_provider_name() -> str:
    name = (
        os.environ.get("IMAGE_PROVIDER", "local-diagram").strip().lower()
        or "local-diagram"
    )
    has_google = bool(os.environ.get("GOOGLE_API_KEY", "").strip())
    has_deapi = bool(os.environ.get("DEAPI_API_KEY", "").strip())

    if name == "svg-llm" and not has_google:
        log.warning(
            "IMAGE_PROVIDER=svg-llm but GOOGLE_API_KEY is empty; using local-diagram"
        )
        return "local-diagram"

    if name == "gemini-image" and not has_google:
        log.warning(
            "IMAGE_PROVIDER=gemini-image but GOOGLE_API_KEY is empty; using local-diagram"
        )
        return "local-diagram"

    if name == "deapi-edit" and not has_deapi:
        log.warning(
            "IMAGE_PROVIDER=deapi-edit but DEAPI_API_KEY is empty; using local-diagram"
        )
        return "local-diagram"

    return name


def get_image_provider():
    name = resolve_provider_name()
    if name not in PROVIDERS:
        raise ValueError(
            f"Unknown IMAGE_PROVIDER '{name}'. "
            f"Choose one of: {', '.join(sorted(PROVIDERS))}"
        )
    return PROVIDERS[name]()


async def generate_with_provider(
    request: ImageGenerationRequest,
) -> ImageGenerationResponse:
    provider = get_image_provider()
    return await provider.generate(request)
