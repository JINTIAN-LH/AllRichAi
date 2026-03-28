import os
import sys
import json
from pathlib import Path

from farmgame.webapp import app


def _is_dev_mode() -> bool:
    if "--dev" in sys.argv:
        return True
    return os.getenv("ALLRICHAI_DEV", "0") == "1"


def _load_web_port() -> int:
    explicit_port = os.getenv("ALLRICHAI_WEB_PORT", "").strip()
    if explicit_port:
        return _safe_port(explicit_port)

    config_path = Path(os.getenv("ALLRICHAI_LLM_CONFIG", "config/llm_api.json"))
    try:
        if config_path.exists():
            payload = json.loads(config_path.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                return _safe_port(payload.get("PORT", 5000))
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return 5000


def _load_web_host() -> str:
    host = os.getenv("ALLRICHAI_WEB_HOST", "127.0.0.1").strip()
    return host or "127.0.0.1"


def _safe_port(value: object) -> int:
    try:
        port = int(value)
    except (TypeError, ValueError):
        return 5000
    if 1 <= port <= 65535:
        return port
    return 5000


if __name__ == "__main__":
    port = _load_web_port()
    host = _load_web_host()
    if "--print-port" in sys.argv:
        print(port)
        raise SystemExit(0)

    dev_mode = _is_dev_mode()
    if dev_mode:
        app.config["TEMPLATES_AUTO_RELOAD"] = True
        app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
        app.jinja_env.auto_reload = True
    app.run(debug=dev_mode, use_reloader=dev_mode, host=host, port=port)
