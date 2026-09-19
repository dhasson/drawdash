# DrawDash (free-stack fork)

## Product thesis (locked)

Primary ICP is facilitators and consultants (agencies as 2b). `/demo` is a workshop board with a two-step Ask loop: (1) shape suggestions with Tab keep / Esc drop, (2) Render leave-behind via canvas-aware image edit, then Tab to place the PNG. Export PNG/PDF remains a fast snapshot. Not K-12 teaching. Not architecture repo-sync until a later wedge.

## Local loop

1. Backend on `8080` with `backend/.env`
2. Frontend on `3000` → `http://localhost:3000/demo`
3. Ask Mode Generate calls `POST /api/suggest-board`. Prefer `BOARD_SUGGEST_PROVIDER=shape_llm` with `GOOGLE_API_KEY` (Gemini → ShapeOp JSON). `mock` is a keyword stub for offline tests. Agent Mode may still call `IMAGE_PROVIDER` (prefer `deapi-edit` with `DEAPI_API_KEY`)
4. Optional `CREDITS_ENABLED=true` meters AI edits and board suggestions per `project_id`

## Image providers

New providers must honor `type=edit` with `image_data` (canvas pixels) or refuse loudly. Text-only providers must not silently ignore the canvas. Register in `backend/app/services/providers/__init__.py`.

## Skills

- `.cursor/skills/drawdash-smoke/SKILL.md` — mock generate smoke
- `.cursor/skills/drawdash-add-provider/SKILL.md` — add a provider checklist
