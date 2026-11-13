#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "public" / "python" / "custom-games.zip"

_tmp = tempfile.TemporaryDirectory(prefix="lot9b-native-")
with zipfile.ZipFile(ARCHIVE) as zf:
    zf.extractall(_tmp.name)

sys.path.insert(0, _tmp.name)

from custom_games.registry import CUSTOM_GAMES, build_seeded_engine  # type: ignore

BY_CODE = {item.game_id.split("-", 1)[0].upper(): item for item in CUSTOM_GAMES}
engine = None
active_code = None


def frame64(value):
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)) or len(value) != 64:
        raise ValueError("invalid frame height")
    rows = []
    for row in value:
        if not isinstance(row, (list, tuple)) or len(row) != 64:
            raise ValueError("invalid frame width")
        vals = [int(v) for v in row]
        if any(v < 0 or v > 15 for v in vals):
            raise ValueError("invalid palette index")
        rows.append(vals)
    return rows


def normalize(raw):
    frame = frame64(raw["frame"])
    ids = raw.get("available_action_ids")
    if ids is None:
        ids = [int(str(a).removeprefix("ACTION")) for a in raw.get("available_actions", [])]
    return {
        "code": active_code,
        "gameId": str(raw.get("game_id") or ""),
        "frame": frame,
        "state": str(raw.get("state") or "NOT_FINISHED"),
        "level": int(raw.get("level", 1)),
        "levelsCompleted": int(raw.get("levels_completed", 0)),
        "availableActionIds": sorted({int(v) for v in ids if 1 <= int(v) <= 7}),
        "backend": "python-native-archive",
    }


def handle(req):
    global engine, active_code
    kind = req.get("type")
    if kind == "load":
        code = str(req.get("code", "")).strip().upper()
        if code not in BY_CODE:
            raise ValueError(f"unknown game code {code}")
        info = BY_CODE[code]
        engine = build_seeded_engine(info.game_id, instance_seed=0)
        active_code = code
        return normalize(engine.public_state())
    if kind == "action":
        if engine is None:
            raise ValueError("load a game first")
        action_id = int(req["actionId"])
        data = req.get("data")
        return normalize(engine.action(action_id, data))
    raise ValueError(f"unknown request type {kind}")


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        response = {"ok": True, "result": handle(json.loads(line))}
    except Exception as exc:
        response = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()
