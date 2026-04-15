# Render + funloom.ai Deployment Guide

## Goal
- Backend API/runtime on Render.
- Frontend static package from `dist/` on funloom.ai.

## 1) Backend On Render

Use [render.yaml](../render.yaml) as the baseline.

Required Render settings:
- Repo: this repository
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --workers=2 --threads=4 --timeout=120 --bind=0.0.0.0:$PORT run_web:app`

Environment variables (recommended):
- `LLM_API_KEY` (if remote LLM is enabled)
- `ALLRICHAI_LLM_ENDPOINT` (optional)
- `ALLRICHAI_LLM_TIMEOUT` (optional)
- `ALLRICHAI_WEB_HOST=0.0.0.0` (already set in `render.yaml`)
- `ALLRICHAI_ALLOWED_ORIGINS=https://your-app.funloom.com` (comma-separated for multiple origins)
- `ALLRICHAI_SAVE_ROOT=/var/data/allrichai/saves` (configure persistent volume path)
- `ALLRICHAI_RATE_LIMIT_ENABLED=1`

Notes:
- `run_web.py` supports platform `PORT` directly, so Render runtime port is auto-consumed.
- Keep secrets in Render dashboard, not in `config/llm_api.json` committed values.
- API routes now include CORS + rate limiting middleware, so ensure the funloom origin is explicitly configured.

## 2) Frontend On funloom.ai

Build static package locally:

```bash
build_dist.bat --sync-from-project
```

Then:
1. Upload `dist/` to funloom.ai as static site root.
2. Open frontend settings and configure `后端 API 基地址（Render）` to your Render backend URL.
3. Verify main flows: home, story-panel, save/load, open-mode API calls.

## 3) Minimal Publish Checklist
- Backend `/` health check passes on Render.
- Frontend pages load from funloom.ai.
- Frontend can call backend endpoint (no CORS/proxy mismatch).
- Save/load still uses browser localStorage for static mode.

## 4) Structure Slimming Strategy (Non-breaking)

Keep current runtime intact, but enforce a strict ownership boundary:
- Source of truth (game rules + web backend): `farmgame/`
- Source of truth (static publish): `release_src/`
- Build output only (rebuildable): `dist/`, `dist-static-upload.zip`
- Mirror docs only (do not hand-edit): `release_src/docs/`

Recommended long-term clean-up:
1. Add `deploy/` folder and move deployment-only docs/scripts there.
2. Keep only one canonical README for deployment flow, then link from others.
3. Add a CI check that blocks direct edits to mirror-only paths unless explicitly intended.
