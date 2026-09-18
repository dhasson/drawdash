# Backend

## Free local mode (default)

```powershell
# Option A — Poetry
poetry install

# Option B — pip (if Poetry is not installed)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Copy-Item .env.example .env
# Leave GOOGLE_API_KEY, SUPABASE_*, and FAL_KEY empty for free local mode
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8080 --env-file .env
```

`IMAGE_PROVIDER` options:

| Value | Cost | Notes |
|-------|------|-------|
| `local-diagram` | Free | Pillow boxes from the prompt (default, no API key) |
| `svg-llm` | Free* | Gemini Flash → SVG → PNG (*needs GOOGLE_API_KEY) |
| `pollinations` | Free | Text-to-image via Pollinations |
| `gemini-image` | Paid | Upstream Nano Banana |

Speech uses **local faster-whisper** (`WHISPER_MODEL=base` by default).

## Full upstream mode

Also set `SUPABASE_URL`, `SUPABASE_KEY`, and optionally `FAL_KEY` for project icons.

## Set up Poetry

See the official [installation guide](https://python-poetry.org/docs/#installation).

```bash
poetry install
```

```bash
# Mac/Linux
eval "$(poetry env activate)"

# Windows
.venv\Scripts\Activate.ps1
```

## API

### Health

`GET /status` → `{ "status": "ok" }`

### Diagram generation

`POST /api/generate-image`

```json
{
  "prompt": "binary search tree with root 50",
  "image_data": null,
  "project_id": "local-demo",
  "type": "generate"
}
```

Returns `{ "image_data": "<base64 png>", "text_response": "..." }`.

## Debugging Tips

1. If VSCode does not recognise libraries: `poetry env info`, then **Python: Select Interpreter** and paste the Virtualenv Executable path.
