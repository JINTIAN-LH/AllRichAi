from __future__ import annotations

import json
from pathlib import Path

from farmgame.models import GameState

SAVE_DIR = Path("saves")
SAVE_FILE = SAVE_DIR / "savegame.json"


def save_game(state: GameState, save_path: Path = SAVE_FILE) -> Path:
    save_path.parent.mkdir(parents=True, exist_ok=True)
    save_path.write_text(
        json.dumps(state.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return save_path


def load_game(save_path: Path = SAVE_FILE) -> GameState | None:
    if not save_path.exists():
        return None
    raw = json.loads(save_path.read_text(encoding="utf-8"))
    return GameState.from_dict(raw)
