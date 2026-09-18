# Frontend

## Free local mode

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000/demo

Requires the backend on http://localhost:8080 (`NEXT_PUBLIC_API_URL`).

Agent Mode records the mic and posts audio to `/api/transcribe` (faster-whisper on the backend). Ask Mode works without a mic.

## Full project UI

`/projects` needs Supabase configured on the backend. Use `/demo` without it.
