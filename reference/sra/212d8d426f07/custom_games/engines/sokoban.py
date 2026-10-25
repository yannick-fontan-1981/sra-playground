"""Push-only Sokoban engine rendered as a 64x64 ARC frame."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

# ---------------------------------------------------------------------------
# Official ARC-AGI-3 UI palette (client/app/reasoning/page.js ARC_COLORS):
#
#   0  #FFFFFF white
#   1  #CCCCCC light grey
#   2  #999999 medium grey
#   3  #666666 dark grey
#   4  #333333 very dark grey
#   5  #000000 black
#   6  #E53AA3 magenta
#   7  #FF7BCC pink
#   8  #F93C31 red
#   9  #1E93FF blue
#  10  #88D8F1 light blue
#  11  #FFDC00 yellow
#  12  #FF851B orange
#  13  #921231 dark red
#  14  #4FCC30 green
#  15  #A356D6 purple
#
# Frame cells are palette *indices*; the UI maps them via ARC_COLORS[i].
# ---------------------------------------------------------------------------
C_BG = 5            # black void outside the board
C_WALL_A = 8        # red brick
C_WALL_B = 12       # orange brick
C_WALL_MORTAR = 4   # very dark grey mortar
C_FLOOR_A = 4       # very dark grey floor
C_FLOOR_B = 5       # black floor (checker with A)
C_TARGET = 1        # light grey ring (readable on dark floor); not a filled disc
C_BOX = 12          # orange crate body
C_BOX_EDGE = 11     # yellow border (clear outline on dark floor)
C_BOX_OK = 14       # green crate when on goal
C_PLAYER = 9        # blue agent
C_PLAYER_EDGE = 10  # light blue rim
C_PLAYER_EYE = 5    # black eyes
C_HUD = 4
C_HUD_DONE = 14
C_HUD_SLOT = 3

# Official ACTION ids (arcengine GameAction)
ACTION_UP = 1
ACTION_DOWN = 2
ACTION_LEFT = 3
ACTION_RIGHT = 4
ACTION_RESET = 7

FRAME = 64
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "sokoban" / "levels"


@dataclass
class LevelState:
    width: int
    height: int
    walls: set[tuple[int, int]]
    targets: set[tuple[int, int]]
    boxes: set[tuple[int, int]]
    player: tuple[int, int]
    max_steps: int
    name: str


def _parse_level(path: Path) -> LevelState:
    raw = path.read_text(encoding="utf-8")
    # Support simple text levels: optional header max_steps=N
    lines = [ln.rstrip("\n") for ln in raw.splitlines() if ln.strip() != ""]
    max_steps = 250
    body: list[str] = []
    for ln in lines:
        if ln.startswith("max_steps="):
            max_steps = int(ln.split("=", 1)[1])
            continue
        if ln.startswith("#") and not set(ln) <= set("#@$*+. \t"):
            # comment only if not a wall row (wall rows are pure grid chars)
            if any(ch.isalpha() for ch in ln):
                continue
        body.append(ln.rstrip())
    if not body:
        raise ValueError(f"empty level: {path}")
    width = max(len(row) for row in body)
    body = [row.ljust(width) for row in body]
    height = len(body)
    walls: set[tuple[int, int]] = set()
    targets: set[tuple[int, int]] = set()
    boxes: set[tuple[int, int]] = set()
    player: tuple[int, int] | None = None
    for r, row in enumerate(body):
        for c, ch in enumerate(row):
            if ch == "#":
                walls.add((r, c))
            elif ch == ".":
                targets.add((r, c))
            elif ch == "$":
                boxes.add((r, c))
            elif ch == "*":
                boxes.add((r, c))
                targets.add((r, c))
            elif ch == "@":
                player = (r, c)
            elif ch == "+":
                player = (r, c)
                targets.add((r, c))
            elif ch in (" ", "-"):
                pass
            else:
                raise ValueError(f"bad cell {ch!r} in {path} at {r},{c}")
    if player is None:
        raise ValueError(f"no player in {path}")
    if not boxes or not targets or len(boxes) != len(targets):
        raise ValueError(f"box/target mismatch in {path}")
    return LevelState(
        width=width,
        height=height,
        walls=walls,
        targets=targets,
        boxes=boxes,
        player=player,
        max_steps=max_steps,
        name=path.stem,
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.txt"))
    if len(paths) < 1:
        raise FileNotFoundError(f"no levels under {LEVELS_DIR}")
    return [_parse_level(p) for p in paths]


class SokobanEngine:
    """Session engine exposing public_state compatible with official_arcade_server."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        if len(self._templates) < info.levels:
            raise ValueError(
                f"expected {info.levels} levels, found {len(self._templates)}"
            )
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])

    def reset(self) -> dict[str, Any]:
        """Full game reset to level 1."""
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._level = deepcopy(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        """Reset current level only (ACTION7)."""
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self.last_action = "ACTION7"
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        del data
        if self.state == "WIN":
            return self.public_state()
        if action_id == ACTION_RESET:
            return self.level_reset()
        delta = {
            ACTION_UP: (-1, 0),
            ACTION_DOWN: (1, 0),
            ACTION_LEFT: (0, -1),
            ACTION_RIGHT: (0, 1),
        }.get(int(action_id))
        self.last_action = f"ACTION{int(action_id)}"
        if delta is None:
            # ignore unknown / unused actions (SPACE/CLICK)
            return self.public_state()
        self.step_index += 1
        self.level_steps += 1
        self._try_move(delta[0], delta[1])
        if self._level_complete():
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = deepcopy(self._templates[self.levels_completed])
                self.level_steps = 0
                self.state = "NOT_FINISHED"
        elif self.level_steps >= self._level.max_steps:
            self.state = "GAME_OVER"
        return self.public_state()

    def _try_move(self, dr: int, dc: int) -> None:
        level = self._level
        pr, pc = level.player
        nr, nc = pr + dr, pc + dc
        if (nr, nc) in level.walls:
            return
        if (nr, nc) in level.boxes:
            br, bc = nr + dr, nc + dc
            if (br, bc) in level.walls or (br, bc) in level.boxes:
                return
            level.boxes.remove((nr, nc))
            level.boxes.add((br, bc))
            level.player = (nr, nc)
            return
        level.player = (nr, nc)

    def _level_complete(self) -> bool:
        return self._level.boxes == self._level.targets

    def public_state(self) -> dict[str, Any]:
        frame = self._render_frame()
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": [frame],
            "frame_count": 1,
            "default_fps": self.info.default_fps,
            "state": self.state,
            "level": level_num,
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "step_index": self.step_index,
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "last_action": self.last_action,
            "score": self.levels_completed,
            "full_reset": False,
            "source_path": str(LEVELS_DIR),
            "custom_family": self.info.family,
            "level_name": self._level.name,
            "level_steps": self.level_steps,
        }

    def _render_frame(self) -> list[list[int]]:
        """Paint emblematic tiles (brick walls, crates, goal plates, agent)."""

        level = self._level
        kind = [["floor" for _ in range(level.width)] for _ in range(level.height)]
        for r, c in level.walls:
            kind[r][c] = "wall"
        for r, c in level.targets:
            if kind[r][c] == "floor":
                kind[r][c] = "target"
        for r, c in level.boxes:
            kind[r][c] = "box_ok" if (r, c) in level.targets else "box"
        pr, pc = level.player
        kind[pr][pc] = "player_ok" if (pr, pc) in level.targets else "player"

        hud_h = 5
        play_h = FRAME - hud_h
        scale = max(4, min(play_h // level.height, FRAME // level.width))
        used_w = level.width * scale
        used_h = level.height * scale
        off_c = max(0, (FRAME - used_w) // 2)
        off_r = max(0, (play_h - used_h) // 2)

        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        for r in range(level.height):
            for c in range(level.width):
                tile = kind[r][c]
                for dr in range(scale):
                    for dc in range(scale):
                        rr = off_r + r * scale + dr
                        cc = off_c + c * scale + dc
                        if 0 <= rr < play_h and 0 <= cc < FRAME:
                            frame[rr][cc] = _paint_tile(tile, dr, dc, scale, r, c)

        # HUD level progress (six slots)
        for i in range(FRAME):
            for h in range(hud_h):
                frame[play_h + h][i] = C_HUD
        slot_w = max(6, (FRAME - 8) // self.win_levels)
        for i in range(self.win_levels):
            x0 = 4 + i * slot_w
            filled = i < self.levels_completed
            for x in range(x0, min(FRAME - 2, x0 + slot_w - 2)):
                for h in range(1, hud_h - 1):
                    if filled:
                        frame[play_h + h][x] = C_HUD_DONE
                    elif h in (1, hud_h - 2) or x in (x0, min(FRAME - 3, x0 + slot_w - 3)):
                        frame[play_h + h][x] = C_HUD_SLOT
                    else:
                        frame[play_h + h][x] = C_BG
        return frame


def _floor_color(cell_r: int, cell_c: int) -> int:
    """Dark-grey / black checker (ARC indices 4 and 5)."""

    return C_FLOOR_A if ((cell_r + cell_c) % 2 == 0) else C_FLOOR_B


def _paint_tile(tile: str, dr: int, dc: int, scale: int, cell_r: int, cell_c: int) -> int:
    """Per-pixel tile painter for a single cell of size scale×scale."""

    mid = scale // 2
    floor = _floor_color(cell_r, cell_c)

    if tile == "wall":
        # Red–orange bricks, staggered courses (quinconce) + dark mortar.
        brick_h = max(2, scale // 3)
        brick_w = max(3, scale // 2)
        course = dr // brick_h
        offset = (course % 2) * (brick_w // 2)
        local_c = (dc + offset) % brick_w
        local_r = dr % brick_h
        mortar = max(1, scale // 10)
        if local_r < mortar or local_c < mortar:
            return C_WALL_MORTAR
        return C_WALL_A if ((course + (dc + offset) // brick_w) % 2 == 0) else C_WALL_B

    if tile == "floor":
        return floor

    if tile == "target":
        # Goal = circle *ring* only (not a filled disc). Interior = floor (transparent).
        rr = dr - mid + 0.5
        cc = dc - mid + 0.5
        rad2 = rr * rr + cc * cc
        r_outer = (scale * 0.40) ** 2
        r_inner = (scale * 0.28) ** 2
        if r_inner <= rad2 <= r_outer:
            return C_TARGET
        return floor

    if tile in ("box", "box_ok"):
        body = C_BOX_OK if tile == "box_ok" else C_BOX
        margin = max(1, scale // 6)
        # Transparent margin: floor shows around the crate.
        if dr < margin or dc < margin or dr >= scale - margin or dc >= scale - margin:
            return floor
        inner_dr = dr - margin
        inner_dc = dc - margin
        inner = scale - 2 * margin
        border = max(2, inner // 5)
        # Explicit border frame
        if (
            inner_dr < border
            or inner_dc < border
            or inner_dr >= inner - border
            or inner_dc >= inner - border
        ):
            return C_BOX_EDGE
        return body

    if tile in ("player", "player_ok"):
        # Transparent outside the circle; optional goal ring underfoot on targets.
        base = floor
        if tile == "player_ok":
            rr0 = dr - mid + 0.5
            cc0 = dc - mid + 0.5
            rad0 = rr0 * rr0 + cc0 * cc0
            r_outer = (scale * 0.40) ** 2
            r_inner = (scale * 0.28) ** 2
            if r_inner <= rad0 <= r_outer:
                base = C_TARGET
        rr = dr - mid + 0.5
        cc = dc - mid + 0.5
        rad2 = rr * rr + cc * cc
        r_out = (scale * 0.42) ** 2
        r_in = (scale * 0.28) ** 2
        if rad2 <= r_in:
            eye_y = mid - max(1, scale // 6)
            if dr == eye_y and dc in (mid - max(1, scale // 5), mid + max(1, scale // 5)):
                return C_PLAYER_EYE
            return C_PLAYER
        if rad2 <= r_out:
            return C_PLAYER_EDGE
        return base

    return floor
