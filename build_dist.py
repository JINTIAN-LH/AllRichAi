from __future__ import annotations

import argparse
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


def _rewrite_viz_template_to_static(template_text: str) -> str:
    # Keep page logic unchanged; remap static resources and replace server-side template placeholders
    # so the standalone package can run directly from static hosting.
    rewritten = template_text.replace('/static/viz/', './assets/viz/')

    # Replace Jinja url_for links with static-safe targets to prevent 404 on literal template strings.
    rewritten = rewritten.replace("{{ url_for('index') }}", './index.html')
    rewritten = rewritten.replace("{{ url_for('story_panel') }}", './index.html#story')
    rewritten = rewritten.replace("{{ url_for('viz_index') }}", './index.html')
    rewritten = rewritten.replace("{{ url_for('balance_page') }}", './index.html#profile')

    # Replace status placeholders with deterministic defaults for first paint in static mode.
    default_tokens = {
        '{{ money }}': '0',
        '{{ particles }}': '0',
        '{{ land }}': '0',
        '{{ turn }}': '1',
        '{{ season }}': '春季',
        '{{ weather }}': '晴朗',
    }
    for token, default_value in default_tokens.items():
        rewritten = rewritten.replace(token, default_value)

    # Remove any remaining Jinja template tokens that cannot be resolved in static hosting.
    rewritten = re.sub(r"\{\{\s*[^{}]+\s*\}\}", '', rewritten)

    return rewritten


def _prepare_local_frontend_source() -> None:
    if not LOCAL_TEMPLATE.exists():
        raise FileNotFoundError(f"Local frontend template missing: {LOCAL_TEMPLATE}")
    if not LOCAL_STATIC_VIZ_DIR.exists():
        raise FileNotFoundError(f"Local viz static directory missing: {LOCAL_STATIC_VIZ_DIR}")

    _reset_dir(BUILD_SRC_DIR)
    (BUILD_SRC_DIR / "assets").mkdir(parents=True, exist_ok=True)

    template_text = LOCAL_TEMPLATE.read_text(encoding="utf-8")
    static_html = _rewrite_viz_template_to_static(template_text)
    (BUILD_SRC_DIR / "index.html").write_text(static_html, encoding="utf-8")

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


def _print_report(total: int, files: list[tuple[str, int]]) -> None:
    print("Build complete")
    print(f"- dist: {DIST_DIR}")
    print(f"- zip : {ZIP_PATH}")
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
    _parse_args()

    _prepare_local_frontend_source()
    _ensure_required_files(BUILD_SRC_DIR, "local frontend source")
    _rebuild_dist_from_local_source()
    total, files = _collect_sizes()
    _create_zip()
    _print_report(total, files)

    if BUILD_SRC_DIR.exists():
        shutil.rmtree(BUILD_SRC_DIR)


if __name__ == "__main__":
    main()
