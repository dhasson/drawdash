<p align="center">
  <img src="assets/cover.png" width="600" />
</p>

<h1 align="center">DrawDash (free-stack fork)</h1>

<p align="center">
  <b>Workshop board for facilitators — local free-stack fork</b>
</p>

<p align="center">
  Fork of <a href="https://github.com/SuveenE/drawdash">SuveenE/drawdash</a> (MIT).
  Facilitate on a canvas, get AI suggestions, accept with <b>Tab</b>.
</p>

<p align="center">
  <a href="https://arxiv.org/abs/2512.01234v2">Paper</a> ·
  <a href="https://x.com/SuveenE/status/1979942916572561527">Upstream demo</a> ·
  <a href="NOTICE">NOTICE</a>
</p>

---

## Free local mode vs full upstream mode

| | Free local (default) | Full upstream |
|---|---|---|
| Entry | `/demo` | `/projects` + Supabase |
| STT | Local mic → faster-whisper | Same |
| Diagrams | `IMAGE_PROVIDER=local-diagram` (Pillow, no key) | `gemini-image` (Nano Banana, paid) |
| Icons / saves | Off when Supabase unset | fal + Supabase |

Nano Banana (`gemini-2.5-flash-image`) has **no free API tier**. This fork defaults to `local-diagram` so the listen → suggest → Tab loop works with zero keys.

### Providers (`IMAGE_PROVIDER`)

- `local-diagram` (default) — Pillow boxes from the prompt, no API key
- `svg-llm` — free Google AI Studio key + `gemini-2.5-flash` → SVG → PNG
- `pollinations` — free anonymous/optional key text-to-image
- `gemini-image` — paid Nano Banana (upstream quality)

## Quick start (Windows)

```powershell
git clone <your-fork-or-this-path>
cd drawdash
```

### Backend

```powershell
cd backend
Copy-Item .env.example .env
# Leave GOOGLE_API_KEY empty for local-diagram (default)

# Poetry:
# poetry install
# .venv\Scripts\Activate.ps1
# poetry run uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8080 --env-file .env

# Or pip:
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.api.main:app --reload --host 0.0.0.0 --port 8080 --env-file .env
```

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open **http://localhost:3000/demo** (Chrome/Edge recommended for mic).

1. Sketch inside the Drawing Area frame (workshop board)  
2. Agent Mode → start mic → speak → **stop mic** (or wait ~25s) → local Whisper transcribes  
3. **Tab** accept · **Esc** reject  

Built for facilitators and consultants first. Teachers and architecture sync are out of scope for this wedge.

## Setup (components)

| Component | Instructions |
|-----------|-------------|
| **Backend** | [backend/README.md](backend/README.md) |
| **Frontend** | [frontend/README.md](frontend/README.md) |

## Citation (upstream)

```bibtex
@misc{ellawela2025drawdash,
      title={Proactive Agentic Whiteboards: Enhancing Diagrammatic Learning},
      author={Suveen Ellawela and Sashenka Gamage and Dinithi Dissanayake},
      year={2025},
      eprint={2512.01234},
      archivePrefix={arXiv},
      primaryClass={cs.HC},
      url={https://arxiv.org/abs/2512.01234v2},
}
```

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Upstream copyright (c) 2025 Suveen Ellawela.
