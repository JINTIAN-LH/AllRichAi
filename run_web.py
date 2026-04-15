import os
import sys
import json
from pathlib import Path

from farmgame.webapp import app


DEFAULT_PORT = 5000
DEFAULT_LOCAL_HOST = "127.0.0.1"
DEFAULT_PLATFORM_HOST = "0.0.0.0"
DEFAULT_CONFIG_PATH = "config/llm_api.json"


def _is_dev_mode() -> bool:
    return "--dev" in sys.argv or os.getenv("ALLRICHAI_DEV", "0") == "1"


def _read_port_from_config(path: Path) -> int:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return DEFAULT_PORT
    if not isinstance(payload, dict):
        return DEFAULT_PORT
    return _safe_port(payload.get("PORT", DEFAULT_PORT))


def _load_web_port() -> int:
    explicit_port = os.getenv("ALLRICHAI_WEB_PORT", "").strip()
    if explicit_port:
        return _safe_port(explicit_port)

    # Render and similar PaaS expose runtime port via PORT.
    platform_port = os.getenv("PORT", "").strip()
    if platform_port:
        return _safe_port(platform_port)

    config_path = Path(os.getenv("ALLRICHAI_LLM_CONFIG", DEFAULT_CONFIG_PATH))
    if config_path.exists():
        return _read_port_from_config(config_path)
    return DEFAULT_PORT


def _load_web_host() -> str:
    default_host = DEFAULT_PLATFORM_HOST if os.getenv("PORT", "").strip() else DEFAULT_LOCAL_HOST
    host = os.getenv("ALLRICHAI_WEB_HOST", default_host).strip()
    return host or DEFAULT_LOCAL_HOST


def _safe_port(value: object) -> int:
    try:
        port = int(value)
    except (TypeError, ValueError):
        return DEFAULT_PORT
    if 1 <= port <= 65535:
        return port
    return DEFAULT_PORT


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
