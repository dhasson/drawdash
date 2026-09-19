# DrawDash (free-stack fork)

## Product thesis (locked)

Primary ICP is facilitators and consultants (agencies as 2b). `/demo` is a workshop board with canvas-aware AI edit and Tab accept. Not K-12 teaching. Not architecture repo-sync until a later wedge.

## Local loop

1. Backend on `8080` with `backend/.env`
2. Frontend on `3000` → `http://localhost:3000/demo`
3. Prefer `IMAGE_PROVIDER=deapi-edit` with `DEAPI_API_KEY` for canvas-aware edits
4. Optional `CREDITS_ENABLED=true` meters AI edits per `project_id`

## Image providers

New providers must honor `type=edit` with `image_data` (canvas pixels) or refuse loudly. Text-only providers must not silently ignore the canvas. Register in `backend/app/services/providers/__init__.py`.

## Skills

- `.cursor/skills/drawdash-smoke/SKILL.md` — mock generate smoke
- `.cursor/skills/drawdash-add-provider/SKILL.md` — add a provider checklist
