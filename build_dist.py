from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCAL_TEMPLATE = ROOT / "farmgame" / "templates" / "viz_index.html"
LOCAL_STATIC_VIZ_DIR = ROOT / "farmgame" / "static" / "viz"
BUILD_SRC_DIR = ROOT / ".build_frontend_src"
DIST_DIR = ROOT / "dist"
ZIP_PATH = ROOT / "dist-static-upload.zip"

REQUIRED_RELATIVE_FILES = (
    Path("index.html"),
    Path("viz.html"),
    Path("assets") / "viz" / "css" / "base.css",
    Path("assets") / "viz" / "js" / "engineBridge.js",
)

MAX_SINGLE_FILE = 10 * 1024 * 1024  # 10MB
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB


def _iter_files(base_dir: Path):
    for path in base_dir.rglob("*"):
        if path.is_file():
            yield path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build frontend dist package and zip directly from local project source."
    )
    parser.add_argument(
        "--api-base",
        default=os.environ.get("FARMGAME_API_BASE", ""),
        help="Backend API base URL for static package (env fallback: FARMGAME_API_BASE).",
    )
    return parser.parse_args()


def _ensure_required_files(base_dir: Path, label: str) -> None:
    required = [base_dir / rel for rel in REQUIRED_RELATIVE_FILES]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"{label} 缺少必要文件: " + ", ".join(missing))


def _reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _inject_api_base_global(html_text: str, api_base: str) -> str:
    script_tag = f'<script id="farmgame-api-base">window.__FARMGAME_API_BASE__={json.dumps(api_base)};</script>'
    # Remove existing injected script to keep output deterministic across rebuilds.
    cleaned = re.sub(
        r'<script\b(?=[^>]*\bid\s*=\s*["\']farmgame-api-base["\'])[^>]*>.*?</script>\s*',
        '',
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if "</head>" in cleaned:
        return cleaned.replace("</head>", f"{script_tag}\n</head>", 1)
    return f"{script_tag}\n{cleaned}"


def _rewrite_viz_template_to_static(template_text: str, api_base: str = "") -> str:
    # Keep page logic unchanged; remap static resources and replace server-side template placeholders
    # so the standalone package can run directly from static hosting.
    rewritten = template_text.replace('/static/viz/', './assets/viz/')

    # Replace Jinja url_for links with static-safe targets to prevent 404 on literal template strings.
    rewritten = rewritten.replace("{{ url_for('index') }}", './index.html')
    rewritten = rewritten.replace("{{ url_for('story_panel') }}", './index.html#story')
    rewritten = rewritten.replace("{{ url_for('viz_index') }}", './viz.html')
    rewritten = rewritten.replace("{{ url_for('balance_page') }}", './index.html#profile')

    # Replace status placeholders with deterministic defaults for first paint in static mode.
    default_tokens = {
        '{{ money }}': '加载中',
        '{{ particles }}': '加载中',
        '{{ land }}': '加载中',
        '{{ turn }}': '加载中',
        '{{ season }}': '加载中',
        '{{ weather }}': '加载中',
    }
    for token, default_value in default_tokens.items():
        rewritten = rewritten.replace(token, default_value)

    # Remove any remaining Jinja template tokens that cannot be resolved in static hosting.
    rewritten = re.sub(r"\{\{\s*[^{}]+\s*\}\}", '', rewritten)

    if api_base:
        rewritten = _inject_api_base_global(rewritten, api_base)

    return rewritten


def _build_static_landing_page(api_base: str = "") -> str:
        safe_api_base = json.dumps(api_base)
        return f"""<!doctype html>
<html lang=\"zh-CN\">
    <head>
        <meta charset=\"utf-8\">
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
        <title>躺平农场主：共同富裕计划</title>
        <style>
            :root {{
                --bg: #f4efe5;
                --surface: rgba(255, 255, 255, 0.9);
                --text: #2c241b;
                --muted: #5c5144;
                --primary: #1f6f43;
                --primary-strong: #165436;
                --border: rgba(44, 36, 27, 0.12);
            }}
            * {{ box-sizing: border-box; }}
            body {{
                margin: 0;
                min-height: 100vh;
                color: var(--text);
                background:
                    radial-gradient(circle at 15% 20%, rgba(248, 214, 144, 0.35), transparent 38%),
                    radial-gradient(circle at 85% 10%, rgba(58, 117, 87, 0.25), transparent 36%),
                    radial-gradient(circle at 50% 88%, rgba(255, 255, 255, 0.6), transparent 40%),
                    var(--bg);
                font-family: \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei\", sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
            }}
            .shell {{
                width: min(900px, 100%);
                border: 1px solid var(--border);
                border-radius: 20px;
                background: var(--surface);
                backdrop-filter: blur(4px);
                box-shadow: 0 24px 50px rgba(44, 36, 27, 0.16);
                padding: clamp(20px, 3vw, 32px);
            }}
            h1 {{ margin: 0 0 8px; font-size: clamp(28px, 5vw, 40px); }}
            .subtitle {{ margin: 0 0 22px; color: var(--muted); line-height: 1.6; }}
            .actions {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 12px;
            }}
            .action {{
                display: block;
                border: 1px solid var(--border);
                border-radius: 14px;
                padding: 14px 16px;
                background: #fff;
                color: var(--text);
                text-decoration: none;
                transition: transform .18s ease, box-shadow .18s ease;
            }}
            .action:hover {{
                transform: translateY(-2px);
                box-shadow: 0 12px 26px rgba(44, 36, 27, 0.15);
            }}
            .action strong {{ display: block; font-size: 16px; margin-bottom: 6px; }}
            .action span {{ color: var(--muted); font-size: 14px; line-height: 1.5; }}
            .primary {{
                border-color: rgba(31, 111, 67, 0.28);
                background: linear-gradient(135deg, #1f6f43, #2f8a59);
                color: #f7fff8;
            }}
            .primary span {{ color: rgba(247, 255, 248, 0.9); }}
            .footnote {{ margin-top: 18px; color: var(--muted); font-size: 13px; line-height: 1.6; }}
            .hidden {{ display: none !important; }}
        </style>
        <script id=\"farmgame-api-base\">window.__FARMGAME_API_BASE__={safe_api_base};</script>
    </head>
    <body>
        <main class=\"shell\">
            <h1>躺平农场主：共同富裕计划</h1>
            <p class=\"subtitle\">线上包默认进入这个导航页，避免在后端接口未就绪时直接触发可视化轮询刷屏。</p>
            <section class=\"actions\">
                <a class=\"action primary\" href=\"./viz.html\">
                    <strong>进入可视化玩法</strong>
                    <span>静态包内置页面，适合手机端快速体验。</span>
                </a>
                <a class=\"action\" id=\"backend-home\" href=\"#\">
                    <strong>进入后端首页（与本地开发一致）</strong>
                    <span id=\"backend-home-tip\">检测到 API 地址后，将跳转到后端主页。</span>
                </a>
            </section>
            <p class=\"footnote\">如果后端接口地址配置错误，请在可视化页面的连接提示框中修正 API 基地址后再重试。</p>
        </main>
        <script>
            (function () {{
                var configured = '';
                try {{
                    configured = String(window.__FARMGAME_API_BASE__ || '').trim();
                }} catch (e) {{}}

                var normalized = configured.replace(/\\/+$/, '');
                if (normalized.endsWith('/api/viz')) {{
                    normalized = normalized.slice(0, -'/api/viz'.length);
                }} else if (normalized.endsWith('/api')) {{
                    normalized = normalized.slice(0, -'/api'.length);
                }}

                var link = document.getElementById('backend-home');
                var tip = document.getElementById('backend-home-tip');
                if (!link || !tip) {{
                    return;
                }}
                if (normalized) {{
                    link.href = normalized + '/';
                    tip.textContent = '当前将跳转到：' + normalized + '/';
                }} else {{
                    link.classList.add('hidden');
                }}
            }})();
        </script>
    </body>
</html>
"""


def _prepare_local_frontend_source(api_base: str = "") -> None:
    if not LOCAL_TEMPLATE.exists():
        raise FileNotFoundError(f"Local frontend template missing: {LOCAL_TEMPLATE}")
    if not LOCAL_STATIC_VIZ_DIR.exists():
        raise FileNotFoundError(f"Local viz static directory missing: {LOCAL_STATIC_VIZ_DIR}")

    _reset_dir(BUILD_SRC_DIR)
    (BUILD_SRC_DIR / "assets").mkdir(parents=True, exist_ok=True)

    template_text = LOCAL_TEMPLATE.read_text(encoding="utf-8")
    static_viz_html = _rewrite_viz_template_to_static(template_text, api_base)
    (BUILD_SRC_DIR / "viz.html").write_text(static_viz_html, encoding="utf-8")

    static_index_html = _build_static_landing_page(api_base)
    (BUILD_SRC_DIR / "index.html").write_text(static_index_html, encoding="utf-8")

    shutil.copytree(LOCAL_STATIC_VIZ_DIR, BUILD_SRC_DIR / "assets" / "viz")


def _rebuild_dist_from_local_source() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    shutil.copytree(BUILD_SRC_DIR, DIST_DIR)


def _collect_sizes() -> tuple[int, list[tuple[str, int]]]:
    files: list[tuple[str, int]] = []
    total = 0
    for p in _iter_files(DIST_DIR):
        size = p.stat().st_size
        rel = str(p.relative_to(DIST_DIR)).replace("\\", "/")
        files.append((rel, size))
        total += size
    files.sort(key=lambda x: x[0])
    return total, files


def _create_zip() -> None:
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for p in _iter_files(DIST_DIR):
            zf.write(p, arcname=str(p.relative_to(DIST_DIR)).replace("\\", "/"))


def _print_report(total: int, files: list[tuple[str, int]], api_base: str = "") -> None:
    print("Build complete")
    print(f"- dist: {DIST_DIR}")
    print(f"- zip : {ZIP_PATH}")
    if api_base:
        print(f"- api_base: {api_base}")
    print("\nFiles:")
    for rel, size in files:
        mark = ""
        if size > MAX_SINGLE_FILE:
            mark = "  [WARN: >10MB]"
        print(f"  - {rel}: {size} bytes{mark}")

    print(f"\nTotal size: {total} bytes")
    if total > MAX_TOTAL_SIZE:
        print("[WARN] 总体积超过 50MB 建议上限")

    index_path = DIST_DIR / "index.html"
    if not index_path.exists():
        print("[WARN] dist 缺少入口 index.html")


def main() -> None:
    args = _parse_args()

    _prepare_local_frontend_source(args.api_base)
    _ensure_required_files(BUILD_SRC_DIR, "local frontend source")
    _rebuild_dist_from_local_source()
    total, files = _collect_sizes()
    _create_zip()
    _print_report(total, files, args.api_base)

    if BUILD_SRC_DIR.exists():
        shutil.rmtree(BUILD_SRC_DIR)


if __name__ == "__main__":
    main()
