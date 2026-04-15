# Project Guidelines

## Scope
- This repository is a Python game prototype with shared business rules across CLI, Flask Web, and packaged static frontend.
- Keep instructions minimal and always-on; use linked docs for deep design details.

## Build And Test
- Python requirement: 3.11+ (see `pyproject.toml`).
- Preferred local commands:
  - Run CLI game: `python -m farmgame`
  - Run design audit: `python -m farmgame --audit`
  - Run tests: `python -m unittest discover -s tests`
  - Run web app: `python run_web.py`
- Windows helper script:
  - `start_web.bat` starts web flow and can bootstrap `.venv` dependencies.
  - `start_web.bat --check` only validates environment.
- Frontend packaging:
  - `build_dist.bat`

## Architecture
- Rule ownership is centralized in `farmgame/engine.py`. Do not duplicate or fork business rules into UI layers.
- `farmgame/app.py` and `farmgame/webapp.py` are interface layers over the same engine contracts.
- `farmgame/models.py`, `farmgame/balance.py`, `farmgame/content.py`, and `farmgame/validators.py` are core domain modules.
- Frontend package inputs are `farmgame/templates/viz_index.html` and `farmgame/static/viz/`.

## Conventions
- Treat root docs as canonical authoring source.
- Keep save-path semantics intact:
  - CLI save: `saves/savegame.json`
  - Web save: `saves/web_save.json`
  - Web slots: `saves/web_slots/`
  - Frontend package saves: browser `localStorage`
- Preserve route and redirect behavior covered by tests in `tests/test_engine.py`.
- Follow existing CSS modularization in `farmgame/static/css/` and avoid one-off style overrides when a module file exists.

## Docs (Link, Do Not Embed)
- Project runbook and release flow: `README.md`
- Module boundaries: `docs/module-design.md`
- Logic and balancing audit: `docs/logic-review.md`
- Company gameplay core: `docs/company-core-points.md`
- Narrative mapping: `docs/avg-line-mapping.md`
- Style modularization: `docs/style-modularization.md`
- Viz QA checklist: `docs/viz_smoke_checklist_2026-03-28.md`
- Viz subsystem docs: `farmgame/static/viz/README.md`
- Design authorities:
  - `《躺平农场主：共同富裕计划》新版本设计文档.md`
  - `# 《躺平农场主：共同富裕计划》新版农场电商公司经营玩法.md`
  - `# 《躺平农场主：共同富裕计划》新版剧情看板设计文档.md`

## Pitfalls
- Test config includes pytest metadata, but the active test suite is unittest-style.
- Web port resolution priority is env var -> config JSON -> default 5000.
