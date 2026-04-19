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

### Render-Only Fast Recovery (No Custom Domain)

If you only deploy backend on Render and do not use any CDN/custom domain, use the Render default hostname directly:

1. Open Render dashboard and copy service URL, for example:
	- `https://<your-service>.onrender.com`
2. Verify backend directly (must all be 200):
	- `https://<your-service>.onrender.com/`
	- `https://<your-service>.onrender.com/viz`
	- `https://<your-service>.onrender.com/api/viz/state`
3. Set frontend API base to this Render URL (not your custom domain).
4. Keep `ALLRICHAI_ALLOWED_ORIGINS` including your static frontend origin.

If Render direct URL works but custom domain returns 404, the problem is domain DNS/routing, not app code.

### Critical: Fix Cloudflare 404 On `api.kurangames.com`

If online requests return `404 Not Found` with response header `server: cloudflare`, traffic is not reaching your Render app.

Skip this section entirely if you are not using Cloudflare/custom domain.

Apply this exact order:

1. In Render service settings, add custom domain `api.kurangames.com` and wait until Render shows it as verified/issued TLS.
2. In Cloudflare DNS, create (or update) CNAME:
	- Name: `api`
	- Target: your Render service host, e.g. `allrichai-farmgame-backend.onrender.com`
	- Proxy status: first set to DNS only (gray cloud) for initial validation.
3. Verify from browser or terminal:
	- `https://api.kurangames.com/`
	- `https://api.kurangames.com/viz`
	- `https://api.kurangames.com/api/viz/state`
	All should no longer be Cloudflare plain-text 404.
4. Switch Cloudflare proxy back to Proxied (orange cloud) only after step 3 is green.
5. If proxied mode fails:
	- Cloudflare SSL/TLS mode should be `Full` (or `Full (strict)` after cert is valid).
	- Disable/adjust WAF or Bot rules that block `/api/*` (errors like 1010/403).
	- Ensure no Transform/Redirect rule rewrites `/api/viz/*`.

Expected healthy signature:
- `GET /api/viz/state` returns JSON with `ok=true` and `state` object.
- Response headers include app-origin behavior (not Cloudflare empty plain-text 404).

## 2) Frontend On funloom.ai

Build static package locally with explicit backend API base:

```cmd
build_dist.bat --api-base https://allrichai-farmgame-backend.onrender.com
```

PowerShell example (environment variable):

```powershell
$env:FARMGAME_API_BASE="https://allrichai-farmgame-backend.onrender.com"
.\build_dist.bat
```

Custom-domain example (optional):

```cmd
build_dist.bat --api-base https://api.kurangames.com
```

Then:
1. Upload `dist/` to funloom.ai as static site root.
2. Static package entry is `index.html`, which now auto-redirects to backend home (`/`) for default gameplay; visualization page remains `viz.html`.
3. Open frontend settings and configure `后端 API 基地址（Render）` to your Render backend URL (if you did not pass `--api-base` while building).
4. Verify main flows: home, story-panel, save/load, open-mode API calls.

Consistency note:
- Keep local build `--api-base` and funloom runtime API base aligned to the same Render endpoint to reduce first-screen and API-behavior drift between local and packaged experiences.

## 3) Minimal Publish Checklist
- Backend `/` health check passes on Render.
- Frontend pages load from funloom.ai.
- Frontend can call backend endpoint (no CORS/proxy mismatch).
- Save/load still uses browser localStorage for static mode.

### Quick Production Verification

Run once after each deployment:

```bash
python tools/verify_online_endpoints.py --base-url https://allrichai-farmgame-backend.onrender.com --origin https://your-app.funloom.com
```

Custom-domain example:

```bash
python tools/verify_online_endpoints.py --base-url https://api.kurangames.com --origin https://your-app.funloom.com
```

Pass condition:
- `/`, `/viz`, `/story-panel`, `/balance`, `/api/viz/state` all return `200`.
- CORS preflight for `/api/viz/state` returns `Access-Control-Allow-Origin` matching your frontend origin.

## 4) Structure Slimming Strategy (Non-breaking)

Keep current runtime intact, with clear ownership:
- Source of truth (game rules + web backend): `farmgame/`
- Source of truth (frontend package input): `farmgame/templates/viz_index.html` and `farmgame/static/viz/`
- Build output only (rebuildable): `dist/`, `dist-static-upload.zip`

Recommended long-term clean-up:
1. Add `deploy/` folder and move deployment-only docs/scripts there.
2. Keep only one canonical README for deployment flow, then link from others.
3. Add a CI check to ensure `dist/` is treated as build artifact, not source.
