from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / "release_src"
DIST_DIR = ROOT / "dist"
ZIP_PATH = ROOT / "dist-static-upload.zip"

REQUIRED_RELATIVE_FILES = (
    Path("index.html"),
    Path("assets") / "styles.css",
    Path("assets") / "app.js",
)

MAX_SINGLE_FILE = 10 * 1024 * 1024  # 10MB
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB


def _iter_files(base_dir: Path):
    for path in base_dir.rglob("*"):
        if path.is_file():
            yield path


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build static dist package and zip for upload."
    )
    parser.add_argument(
        "--from-current-dist",
        action="store_true",
        help="先将 dist 当前内容回写到 release_src，再执行构建与打包。",
    )
    parser.add_argument(
        "--sync-from-project",
        action="store_true",
        help="执行项目同步钩子，将动态工程内容同步到 release_src 后再构建。",
    )
    return parser.parse_args()


def _ensure_required_files(base_dir: Path, label: str) -> None:
    required = [base_dir / rel for rel in REQUIRED_RELATIVE_FILES]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f"{label} 缺少必要文件: " + ", ".join(missing))


def _ensure_source_ready() -> None:
    _ensure_required_files(SOURCE_DIR, "release_src")


def _rebuild_dist() -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    shutil.copytree(SOURCE_DIR, DIST_DIR)


def _ensure_dist_ready() -> None:
    _ensure_required_files(DIST_DIR, "dist")


def _sync_dist_to_source() -> None:
    _ensure_dist_ready()
    if SOURCE_DIR.exists():
        shutil.rmtree(SOURCE_DIR)
    shutil.copytree(DIST_DIR, SOURCE_DIR)
    print(f"Synced dist -> release_src: {SOURCE_DIR}")


def _run_project_sync_hook() -> None:
    hook = ROOT / "sync_to_release.py"
    if not hook.exists():
        print("[WARN] --sync-from-project 已启用，但未找到 sync_to_release.py，已跳过。")
        return

    cmd = [
        sys.executable,
        str(hook),
        "--project-root",
        str(ROOT),
        "--release-src",
        str(SOURCE_DIR),
    ]
    print(f"Running sync hook: {hook}")
    subprocess.run(cmd, check=True)


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
    args = _parse_args()
    if args.from_current_dist:
        _sync_dist_to_source()

    if args.sync_from_project:
        _run_project_sync_hook()

    _ensure_source_ready()
    _rebuild_dist()
    total, files = _collect_sizes()
    _create_zip()
    _print_report(total, files)


if __name__ == "__main__":
    main()
