---
name: drawdash-add-provider
description: Checklist for adding a new IMAGE_PROVIDER to DrawDash.
---

# Add an IMAGE_PROVIDER

1. Create `backend/app/services/providers/<name>.py` with a class exposing `async def generate(self, request: ImageGenerationRequest) -> ImageGenerationResponse`.
2. For `request.type == "edit"`, decode `request.image_data` via `decode_optional_image`. If you cannot edit, raise with a clear message.
3. Return PNG via `image_to_base64_png`.
4. Register in `PROVIDERS` inside `providers/__init__.py`.
5. Add env knobs and a commented example to `backend/.env.example`.
6. Add a contract test that fails when edit is called without `image_data` (or documents text_only refusal).
7. Run `.cursor/skills/drawdash-smoke/SKILL.md`.
