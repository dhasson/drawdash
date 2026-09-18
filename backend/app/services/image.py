import logging
import os

from app.models.image import ImageGenerationRequest, ImageGenerationResponse
from app.services.credits import get_credit_ledger
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
        ledger = get_credit_ledger()
        account_id = input.project_id or "local-demo"
        ledger.assert_can_spend(account_id, 1)

        response = await generate_with_provider(input)

        remaining = ledger.spend(account_id, 1)
        return ImageGenerationResponse(
            image_data=response.image_data,
            text_response=response.text_response,
            credits_remaining=remaining if ledger.enabled() else None,
        )
