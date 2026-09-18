import logging
import os

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.providers import generate_with_provider

log = logging.getLogger(__name__)


class ImageService:
    async def generate_image(
        self, input: ImageGenerationRequest
    ) -> ImageGenerationResponse:
        provider = os.environ.get("IMAGE_PROVIDER", "local-diagram")
        log.info(
            "Generating image with provider=%s type=%s prompt=%s",
            provider,
            input.type,
            input.prompt[:120],
        )
        return await generate_with_provider(input)
