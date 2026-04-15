---
name: selfcheck-package-build-commit-push
description: "Use when user asks to run full local release workflow: self-check, packaging/build, update commit.md, commit and push. Keywords: 自检, 打包, 构建, 提交, 推送"
---

# Selfcheck Package Build Commit Push

## Purpose
Run a full local release workflow for this repository on Windows.

## Preconditions
- Run from repository root.
- Python 3.11+ is available.
- Git remote is configured.
- Keep existing uncommitted user changes unless user asks otherwise.

## Workflow
1. Self-check
- python -m unittest discover -s tests
- python -m farmgame --audit

2. Package and build
- build_dist.bat

3. Commit log update
- Add a new standardized section to commit.md with:
  - 日期
  - 作者
  - 类型
  - 工作内容
  - 关键改动
  - 验证结果

4. Git commit and push
- git add .
- git commit -m "Commit #N: <summary>"
- git push

## Repository-specific Notes
- Business rules authority stays in farmgame/engine.py.
- build_dist.bat is the canonical packaging path.
- Tests are unittest style.

## Fallback
If tests fail due to missing dependency, install requirements first:
- python -m pip install -r requirements.txt
