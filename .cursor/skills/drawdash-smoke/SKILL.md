---
name: drawdash-smoke
description: Smoke-test DrawDash /demo generate path with a mocked or local provider.
---

# DrawDash smoke

## When to use

After changing image providers, credits, or the `/demo` generate loop.

## Steps

1. Start backend (`uvicorn` on 8080 with `--env-file .env`).
2. Start frontend (`npm run dev` on 3000).
3. Open `/demo`. Confirm title is workshop-facing.
4. Apply a workshop template (optional).
5. Ask mode. Prompt "add a red arrow". Generate.
6. Expect preview PNG. Tab accept. Esc reject on a second run.
7. If `CREDITS_ENABLED=true`, confirm balance decrements and blocks at zero.

## Mock generate (no deAPI)

Set `IMAGE_PROVIDER=local-diagram` for a fast Pillow response. This proves the loop, not canvas fidelity.

## Live canvas edit

Set `IMAGE_PROVIDER=deapi-edit` and `DEAPI_API_KEY`. Expect 2 to 3 minutes. Respect rate limits.
