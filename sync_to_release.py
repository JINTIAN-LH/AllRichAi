from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync dynamic project files into release_src before static build."
    )
    parser.add_argument("--project-root", required=True)
    parser.add_argument("--release-src", required=True)
    return parser.parse_args()


def copy_file(src: Path, dst: Path) -> None:
    if not src.exists():
        print(f"[WARN] source missing: {src}")
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"[COPY] {src} -> {dst}")


def copy_dir(src: Path, dst: Path) -> None:
    if not src.exists():
        print(f"[WARN] source dir missing: {src}")
        return
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"[COPY-DIR] {src} -> {dst}")


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_files_with_globs(
    src_root: Path,
    patterns: Iterable[str],
    dst_root: Path,
) -> list[Path]:
    copied: list[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        for src in src_root.glob(pattern):
            if not src.is_file():
                continue
            rel = src.relative_to(src_root)
            if rel in seen:
                continue
            seen.add(rel)
            copy_file(src, dst_root / rel)
            copied.append(dst_root / rel)
    return copied


def write_manifest(path: Path, entries: dict[str, list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[WRITE] {path}")


def main() -> None:
    args = parse_args()
    project_root = Path(args.project_root).resolve()
    release_src = Path(args.release_src).resolve()

    # 只同步静态可发布材料，避免把 Flask/Jinja 页面直接覆盖到静态入口。
    docs_target = release_src / "docs"
    exports_target = release_src / "data" / "exports"
    static_target = release_src / "assets" / "source-static"
    viz_target = release_src / "assets" / "viz"

    reset_dir(docs_target)
    reset_dir(exports_target)

    copied_docs: list[Path] = []
    copied_exports: list[Path] = []

    copied_docs.extend(
        copy_files_with_globs(
            project_root / "docs",
            ["*.md"],
            docs_target,
        )
    )

    copied_docs.extend(
        copy_files_with_globs(
            project_root,
            ["*.md"],
            docs_target / "root",
        )
    )

    copied_exports.extend(
        copy_files_with_globs(
            project_root / "saves",
            ["*.json", "web_slots/*.json"],
            exports_target,
        )
    )

    copy_dir(project_root / "farmgame" / "static", static_target)
    copy_dir(project_root / "farmgame" / "static" / "viz", viz_target)

    manifest_path = release_src / "data" / "sync-manifest.json"
    write_manifest(
        manifest_path,
        {
            "docs": [str(p.relative_to(release_src)).replace("\\\\", "/") for p in copied_docs],
            "exports": [
                str(p.relative_to(release_src)).replace("\\\\", "/")
                for p in copied_exports
            ],
            "static": [str(static_target.relative_to(release_src)).replace("\\\\", "/")],
            "viz": [str(viz_target.relative_to(release_src)).replace("\\\\", "/")],
        },
    )

    print("sync_to_release.py finished with active rules.")


if __name__ == "__main__":
    main()
