"""GLOB — Globe track navigation with recorded direction playback.

Controls:
  ACTION6 click — choose a destination slot on the globe
  ACTION5 SPACE — play the recorded path one step at a time (or start playback)
  ACTION7       — soft reset level

Base frame is the exact ASCII art in games/globe_track/base_frame.txt.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

# ARC palette
C_WHITE = 0
C_LGREY = 1
C_MGREY = 2
C_DGREY = 3
C_VDGREY = 4
C_BLACK = 5
C_MAGENTA = 6
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_BROWN = 13
C_GREEN = 14
C_PURPLE = 15  # violet — spawn blocker only

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
FRAME = 64
RING_SIZES = (1, 4, 7, 10, 7, 4, 1)
MAX_PATH = 12
ANIM_SUBFRAMES = 4  # frames per arrow / move for smooth travel

ROOT = Path(__file__).resolve().parents[1] / "games" / "globe_track"
BASE_ASCII = ROOT / "base_frame.txt"
LEVELS_DIR = ROOT / "levels"

Dir = Literal["U", "D", "L", "R"]
Special = Literal["lava", "cyclone", "cyan", "goal", "violet", "none"]

DIR_DELTA = {"U": (-1, 0), "D": (1, 0), "L": (0, -1), "R": (0, 1)}
DIR_OPPOSITE: dict[Dir, Dir] = {"U": "D", "D": "U", "L": "R", "R": "L"}
DIR_FROM_ACTION = {
    ACTION_UP: "U",
    ACTION_DOWN: "D",
    ACTION_LEFT: "L",
    ACTION_RIGHT: "R",
}


@dataclass(frozen=True)
class Slot:
    ring: int
    index: int
    y: int  # top of 4x4 diamond
    x: int  # left of 4x4 diamond
    cy: float
    cx: float


@dataclass
class LevelConfig:
    name: str
    goal: tuple[int, int]
    moves: list[Dir]  # fixed record, length 4..12
    lava: list[tuple[int, int]]
    cyclone: list[tuple[int, int]]
    cyan: list[tuple[int, int]]
    violet: list[tuple[int, int]]  # spawn-blocked only, no runtime effect
    max_actions: int


@dataclass
class LevelState:
    cfg: LevelConfig
    pos: tuple[int, int] | None = None  # magenta; absent until click
    path_index: int = 0
    armed: bool = False  # magenta placed; arrows turn green
    playing: bool = False
    last_dir: Dir | None = None
    dead: bool = False
    won: bool = False
    # Pixel-space magenta during smooth travel (cx, cy); None = snap to slot
    anim_xy: tuple[float, float] | None = None


def _load_base_ascii() -> list[str]:
    lines = BASE_ASCII.read_text(encoding="utf-8").splitlines()
    if len(lines) != FRAME or any(len(l) != FRAME for l in lines):
        raise ValueError("base_frame.txt must be exactly 64x64")
    return lines


def _discover_slots(lines: list[str]) -> list[Slot]:
    """Find 4×4 diamonds; interior may be '..' or a repeated letter (P/E/H/L/S)."""
    found: list[tuple[float, float, int, int]] = []
    for y in range(FRAME - 3):
        for x in range(FRAME - 3):
            a = lines[y][x : x + 4]
            b = lines[y + 1][x : x + 4]
            c = lines[y + 2][x : x + 4]
            d = lines[y + 3][x : x + 4]
            if not (a[1:3] == "##" and d[1:3] == "##"):
                continue
            if not (b[0] == "#" and b[3] == "#" and c[0] == "#" and c[3] == "#"):
                continue
            if b[1] == b[2] == c[1] == c[2]:
                found.append((y + 1.5, x + 1.5, y, x))
    found.sort(key=lambda t: (t[0], t[1]))
    if len(found) != sum(RING_SIZES):
        raise ValueError(f"expected {sum(RING_SIZES)} slots, found {len(found)}")
    slots: list[Slot] = []
    idx = 0
    for ring, sz in enumerate(RING_SIZES):
        band = found[idx : idx + sz]
        band.sort(key=lambda t: t[1])
        for i, (cy, cx, y, x) in enumerate(band):
            slots.append(Slot(ring=ring, index=i, y=y, x=x, cy=cy, cx=cx))
        idx += sz
    return slots


def _discover_dir_boxes(lines: list[str]) -> list[tuple[int, int]]:
    boxes: list[tuple[int, int]] = []
    for y in range(FRAME - 9):
        for x in range(FRAME - 9):
            if lines[y][x : x + 9] == "0" * 9 and lines[y + 8][x : x + 9] == "0" * 9:
                boxes.append((y, x))
    if len(boxes) != MAX_PATH:
        raise ValueError(f"expected {MAX_PATH} direction boxes, found {len(boxes)}")
    return boxes


def _ascii_to_frame(lines: list[str]) -> list[list[int]]:
    """Map ASCII legend to ARC colors for the static base."""
    # . black, 0 light, o weak, m brown transversal, # structure, g glyph
    # Letter fills in diamonds (level markers) → black; JSON paints specials.
    mp = {
        ".": C_BLACK,
        "0": C_LGREY,
        "o": C_MGREY,
        "m": C_BROWN,
        "#": C_DGREY,
        "g": C_DGREY,
        "P": C_BLACK,
        "E": C_BLACK,
        "H": C_BLACK,
        "L": C_BLACK,
        "S": C_BLACK,
    }
    return [[mp.get(ch, C_BLACK) for ch in row] for row in lines]


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))

    def pairs(key: str) -> list[tuple[int, int]]:
        return [(int(a), int(b)) for a, b in data.get(key, [])]

    raw_moves = data.get("moves") or data.get("path")
    if not raw_moves:
        raise ValueError(f"{path.name}: missing moves")
    moves: list[Dir] = []
    for m in raw_moves:
        d = str(m).upper()
        if d not in ("U", "D", "L", "R"):
            raise ValueError(f"{path.name}: bad move {m!r}")
        moves.append(d)  # type: ignore[arg-type]
    if not (4 <= len(moves) <= MAX_PATH):
        raise ValueError(f"{path.name}: need 4..{MAX_PATH} moves, got {len(moves)}")
    goal = data["goal"]
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        goal=(int(goal[0]), int(goal[1])),
        moves=moves,
        lava=pairs("lava"),
        cyclone=pairs("cyclone"),
        cyan=pairs("cyan"),
        violet=pairs("violet") or pairs("block"),
        max_actions=int(data.get("max_actions", 80)),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class GlobeTrackEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._ascii = _load_base_ascii()
        self._base_frame = _ascii_to_frame(self._ascii)
        self._slots = _discover_slots(self._ascii)
        self._by_ri = {(s.ring, s.index): s for s in self._slots}
        self._dir_boxes = _discover_dir_boxes(self._ascii)
        self._neighbors = self._build_neighbors()
        self._templates = _load_all_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = self._new_level_state(0)

    # --- graph -----------------------------------------------------------------

    def _build_neighbors(self) -> dict[tuple[int, int], dict[Dir, tuple[int, int]]]:
        """L/R wrap on ring; U/D follow ASCII 0/o tracks (hard map from flood).

        Derived by shortest 0/o path between diamond edges on adjacent rings.
        Pole N/S strong 000 is the rightmost of the 4-slot ring.
        """
        # (ring, index) -> U and/or D target. None = no move that way.
        ud: dict[tuple[int, int], dict[str, tuple[int, int] | None]] = {
            (0, 0): {"U": None, "D": (1, 3)},
            (1, 0): {"U": (0, 0), "D": (2, 0)},
            (1, 1): {"U": (0, 0), "D": (2, 2)},
            (1, 2): {"U": (0, 0), "D": (2, 4)},
            (1, 3): {"U": (0, 0), "D": (2, 6)},
            (2, 0): {"U": (1, 0), "D": (3, 0)},
            (2, 1): {"U": (1, 0), "D": (3, 2)},
            (2, 2): {"U": (1, 1), "D": (3, 3)},
            (2, 3): {"U": (1, 1), "D": (3, 4)},
            (2, 4): {"U": (1, 2), "D": (3, 6)},
            (2, 5): {"U": (1, 3), "D": (3, 7)},
            (2, 6): {"U": (1, 3), "D": (3, 9)},
            (3, 0): {"U": (2, 0), "D": (4, 0)},
            (3, 1): {"U": (2, 0), "D": (4, 0)},
            (3, 2): {"U": (2, 1), "D": (4, 1)},
            (3, 3): {"U": (2, 2), "D": (4, 2)},
            (3, 4): {"U": (2, 3), "D": (4, 3)},
            (3, 5): {"U": (2, 3), "D": (4, 3)},
            (3, 6): {"U": (2, 4), "D": (4, 4)},
            (3, 7): {"U": (2, 5), "D": (4, 5)},
            (3, 8): {"U": (2, 6), "D": (4, 6)},
            (3, 9): {"U": (2, 6), "D": (4, 6)},
            (4, 0): {"U": (3, 0), "D": (5, 0)},
            (4, 1): {"U": (3, 2), "D": (5, 0)},
            (4, 2): {"U": (3, 3), "D": (5, 1)},
            (4, 3): {"U": (3, 4), "D": (5, 1)},
            (4, 4): {"U": (3, 6), "D": (5, 2)},
            (4, 5): {"U": (3, 7), "D": (5, 3)},
            (4, 6): {"U": (3, 9), "D": (5, 3)},
            (5, 0): {"U": (4, 0), "D": (6, 0)},
            (5, 1): {"U": (4, 2), "D": (6, 0)},
            (5, 2): {"U": (4, 4), "D": (6, 0)},
            (5, 3): {"U": (4, 6), "D": (6, 0)},
            (6, 0): {"U": (5, 3), "D": None},
        }
        neigh: dict[tuple[int, int], dict[Dir, tuple[int, int]]] = {}
        for s in self._slots:
            n = RING_SIZES[s.ring]
            d: dict[Dir, tuple[int, int]] = {
                "L": (s.ring, (s.index - 1) % n),
                "R": (s.ring, (s.index + 1) % n),
            }
            entry = ud[(s.ring, s.index)]
            if entry["U"] is not None:
                d["U"] = entry["U"]
            if entry["D"] is not None:
                d["D"] = entry["D"]
            neigh[(s.ring, s.index)] = d
        return neigh

    def _special_at(self, pos: tuple[int, int]) -> Special:
        cfg = self._level.cfg
        if pos == cfg.goal:
            return "goal"
        if pos in cfg.lava:
            return "lava"
        if pos in cfg.cyclone:
            return "cyclone"
        if pos in cfg.cyan:
            return "cyan"
        if pos in cfg.violet:
            return "violet"
        return "none"

    def _spawn_forbidden(self, pos: tuple[int, int]) -> bool:
        """Magenta cannot be placed on green/cyan/yellow/orange/violet."""
        return self._special_at(pos) in (
            "goal",
            "cyan",
            "cyclone",
            "lava",
            "violet",
        )

    # --- lifecycle -------------------------------------------------------------

    def _new_level_state(self, level_index: int) -> LevelState:
        cfg = self._templates[level_index]
        return LevelState(cfg=cfg, pos=None)

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = self._new_level_state(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = self._new_level_state(idx)
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        data = dict(data or {})
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        frames: list[list[list[int]]] | None = None
        if aid == ACTION_CLICK:
            self.step_index += 1
            frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        elif aid == ACTION_SPACE:
            self.step_index += 1
            frames = self._space()
        if frames:
            self._pending_frames = frames
        return self.public_state()

    # --- interaction -----------------------------------------------------------

    def _hit_slot(self, x: int, y: int) -> tuple[int, int] | None:
        for s in self._slots:
            if s.x <= x < s.x + 4 and s.y <= y < s.y + 4:
                return (s.ring, s.index)
        return None

    def _hit_active_arrow_box(self, x: int, y: int) -> bool:
        """True if (x,y) is inside the white-outlined (active) direction box."""
        lv = self._level
        if not lv.armed or lv.playing:
            return False
        n = len(lv.cfg.moves)
        i = lv.path_index
        if not (0 <= i < n):
            return False
        by, bx = self._dir_boxes[i]
        return bx <= x < bx + 9 and by <= y < by + 9

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        """Place magenta on a free slot, or click white arrow box = SPACE."""
        lv = self._level
        if lv.playing or lv.dead or lv.won:
            return None
        # White rectangle (active arrow) → same as SPACE
        if self._hit_active_arrow_box(x, y):
            return self._space()
        hit = self._hit_slot(x, y)
        if hit is None:
            return None
        if self._spawn_forbidden(hit):
            return None
        lv.pos = hit
        lv.path_index = 0
        lv.armed = True
        lv.playing = False
        return [self._render_frame()]

    def _space(self) -> list[list[list[int]]] | None:
        """Play the fixed arrow record: ANIM_SUBFRAMES smooth frames per arrow."""
        lv = self._level
        if lv.dead or lv.won:
            return None
        if not lv.armed or lv.pos is None:
            return None
        moves = lv.cfg.moves
        frames: list[list[list[int]]] = []
        lv.playing = True
        for i, d in enumerate(moves):
            lv.path_index = i
            ok = self._animate_move(d, frames)
            if not ok:
                lv.anim_xy = None
                frames.extend(self._fail_frames())
                return frames
        lv.anim_xy = None
        # Win only if magenta ends on green after the full record.
        if lv.pos == lv.cfg.goal:
            lv.won = True
            frames.extend(self._win_frames())
            self._advance_level(frames)
            return frames
        frames.extend(self._fail_frames())
        return frames

    def _slot_center(self, pos: tuple[int, int]) -> tuple[float, float]:
        s = self._by_ri[pos]
        return (s.cx, s.cy)

    def _append_travel(
        self,
        frames: list[list[list[int]]],
        xy0: tuple[float, float],
        xy1: tuple[float, float],
    ) -> None:
        """Append ANIM_SUBFRAMES frames lerping magenta from xy0 to xy1."""
        lv = self._level
        for k in range(1, ANIM_SUBFRAMES + 1):
            t = k / ANIM_SUBFRAMES
            # smoothstep for ease-in/out
            tt = t * t * (3.0 - 2.0 * t)
            lv.anim_xy = (
                xy0[0] + (xy1[0] - xy0[0]) * tt,
                xy0[1] + (xy1[1] - xy0[1]) * tt,
            )
            frames.append(self._render_frame())

    def _die_on_lava(self) -> bool:
        """If magenta is on lava, mark dead and return True."""
        lv = self._level
        if lv.pos is not None and self._special_at(lv.pos) == "lava":
            lv.dead = True
            return True
        return False

    def _resolve_effects(
        self,
        frames: list[list[list[int]]] | None = None,
    ) -> bool:
        """Chain cyan + cyclone effects until stable. False if lava death.

        Next track arrow runs only after this returns (no pending effect).
        """
        lv = self._level
        if lv.pos is None:
            return True
        if self._die_on_lava():
            return False
        seen: set[tuple[int, int]] = set()
        while lv.pos not in seen:
            seen.add(lv.pos)
            # Cyan first: repeat last move once from this pad
            if self._special_at(lv.pos) == "cyan" and lv.last_dir is not None:
                extra = self._neighbors[lv.pos].get(lv.last_dir)
                if extra is not None and self._special_at(extra) != "cyclone":
                    if frames is not None:
                        self._append_travel(
                            frames,
                            self._slot_center(lv.pos),
                            self._slot_center(extra),
                        )
                    lv.pos = extra
                    if frames is not None:
                        lv.anim_xy = None
                    if self._die_on_lava():
                        return False
                    continue
            # Cyclone: push opposite to the cyclone's bearing
            hit: Dir | None = None
            for d_to_cyc, nb in self._neighbors[lv.pos].items():
                if self._special_at(nb) == "cyclone":
                    hit = d_to_cyc
                    break
            if hit is None:
                break
            push = DIR_OPPOSITE[hit]
            dest = self._neighbors[lv.pos].get(push)
            if dest is None or self._special_at(dest) == "cyclone" or dest in seen:
                break
            if frames is not None:
                self._append_travel(
                    frames, self._slot_center(lv.pos), self._slot_center(dest)
                )
            lv.pos = dest
            if frames is not None:
                lv.anim_xy = None
            if self._die_on_lava():
                return False
            continue
        return True

    def _animate_move(self, d: Dir, frames: list[list[list[int]]]) -> bool:
        """One track action, then chain all triggered effects before returning."""
        lv = self._level
        if lv.pos is None:
            return True
        start = lv.pos
        xy0 = self._slot_center(start)
        nxt = self._neighbors[start].get(d)
        if nxt is None:
            self._append_travel(frames, xy0, xy0)
            return True

        # Cannot enter a cyclone cell — cancel the step in place
        if self._special_at(nxt) == "cyclone":
            lv.last_dir = d
            self._append_travel(frames, xy0, xy0)
            return True

        # Primary travel start → nxt (including onto lava — then die)
        self._append_travel(frames, xy0, self._slot_center(nxt))
        lv.pos = nxt
        lv.last_dir = d
        lv.anim_xy = None
        if self._die_on_lava():
            return False

        if not self._resolve_effects(frames):
            return False
        return True

    def _apply_move(self, d: Dir) -> bool:
        """Instant move (tests / spawn checks). Return False if mortal."""
        lv = self._level
        if lv.pos is None:
            return True
        nxt = self._neighbors[lv.pos].get(d)
        if nxt is None:
            return True
        if self._special_at(nxt) == "cyclone":
            lv.last_dir = d
            return True
        lv.pos = nxt
        lv.last_dir = d
        if self._die_on_lava():
            return False
        return self._resolve_effects(None)

    def _advance_level(self, frames: list[list[list[int]]]) -> None:
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
        else:
            self._level = self._new_level_state(self.levels_completed)
            self.state = "NOT_FINISHED"
            frames.append(self._render_frame())

    def _fail_frames(self) -> list[list[list[int]]]:
        """Orange death flash, then soft-reset level (clear magenta / re-arm)."""
        frames: list[list[list[int]]] = []
        # Hold final pose briefly, then flash orange
        base = self._render_frame()
        frames.append([row[:] for row in base])
        for i in range(4 * ANIM_SUBFRAMES):
            if (i // ANIM_SUBFRAMES) % 2 == 0:
                flash = [row[:] for row in base]
                for y in range(FRAME):
                    for x in range(FRAME):
                        if flash[y][x] != C_BLACK:
                            flash[y][x] = C_ORANGE
                frames.append(flash)
            else:
                frames.append([row[:] for row in base])
        # Reset movement / placement
        self._level = self._new_level_state(
            min(self.levels_completed, self.win_levels - 1)
        )
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())
        return frames

    def _win_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3 * ANIM_SUBFRAMES):
            lit = [row[:] for row in base]
            for y in range(FRAME):
                for x in range(FRAME):
                    if lit[y][x] != C_BLACK:
                        lit[y][x] = C_GREEN
            frames.append(lit)
            frames.append([row[:] for row in base])
        return frames

    # --- public ----------------------------------------------------------------

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
            frame = frames[-1]
        else:
            frame = self._render_frame()
            frames = [frame]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION5", "ACTION6", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        lv = self._level
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 45 if len(frames) > 1 else None,
            "default_fps": max(self.info.default_fps, 16),
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
            "level_name": lv.cfg.name,
            "pos": list(lv.pos) if lv.pos is not None else None,
            "moves": list(lv.cfg.moves),
            "moves_len": len(lv.cfg.moves),
            "armed": lv.armed,
        }

    # --- render ----------------------------------------------------------------

    def _paint_diamond(
        self, frame: list[list[int]], slot: Slot, fill: int, outline: int | None = None
    ) -> None:
        self._paint_diamond_at(frame, slot.cx, slot.cy, fill, outline)

    def _paint_diamond_at(
        self,
        frame: list[list[int]],
        cx: float,
        cy: float,
        fill: int,
        outline: int | None = None,
    ) -> None:
        """Paint a 4×4 diamond centered on (cx, cy) — used for smooth travel."""
        x = int(round(cx - 1.5))
        y = int(round(cy - 1.5))
        # interior 2x2
        for dy in (1, 2):
            for dx in (1, 2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < FRAME and 0 <= yy < FRAME:
                    frame[yy][xx] = fill
        if outline is not None:
            for dx in (1, 2):
                for yy, xx in ((y, x + dx), (y + 3, x + dx)):
                    if 0 <= xx < FRAME and 0 <= yy < FRAME:
                        frame[yy][xx] = outline
            for dy in (1, 2):
                for yy, xx in ((y + dy, x), (y + dy, x + 3)):
                    if 0 <= xx < FRAME and 0 <= yy < FRAME:
                        frame[yy][xx] = outline

    def _clear_box_interior(self, frame: list[list[int]], box: tuple[int, int]) -> None:
        by, bx = box
        for dy in range(1, 8):
            for dx in range(1, 8):
                frame[by + dy][bx + dx] = C_BLACK

    def _draw_dir_arrow(
        self, frame: list[list[int]], box: tuple[int, int], d: Dir, color: int
    ) -> None:
        """Draw U/D/L/R triangle inside a 9×9 direction box."""
        by, bx = box
        self._clear_box_interior(frame, box)
        # local coords inside interior (1..7)
        cx, cy = bx + 4, by + 4
        if d == "U":
            for row in range(5):
                half = row
                y = by + 2 + row
                for x in range(cx - half, cx + half + 1):
                    if bx < x < bx + 8:
                        frame[y][x] = color
        elif d == "D":
            for row in range(5):
                half = 4 - row
                y = by + 2 + row
                for x in range(cx - half, cx + half + 1):
                    if bx < x < bx + 8:
                        frame[y][x] = color
        elif d == "L":
            # Point on the left side of the box
            for col in range(5):
                half = col
                x = bx + 2 + col
                for y in range(cy - half, cy + half + 1):
                    if by < y < by + 8:
                        frame[y][x] = color
        else:  # R
            # Point on the right side of the box
            for col in range(5):
                half = 4 - col
                x = bx + 2 + col
                for y in range(cy - half, cy + half + 1):
                    if by < y < by + 8:
                        frame[y][x] = color

    def _outline_box(
        self, frame: list[list[int]], box: tuple[int, int], color: int
    ) -> None:
        by, bx = box
        for i in range(9):
            frame[by][bx + i] = color
            frame[by + 8][bx + i] = color
            frame[by + i][bx] = color
            frame[by + i][bx + 8] = color

    def _render_frame(self) -> list[list[int]]:
        frame = [row[:] for row in self._base_frame]
        lv = self._level
        cfg = lv.cfg

        # specials (goal last so green wins over overlaps)
        for pos, color in (
            *[(p, C_PURPLE) for p in cfg.violet],
            *[(p, C_ORANGE) for p in cfg.lava],
            *[(p, C_YELLOW) for p in cfg.cyclone],
            *[(p, C_CYAN) for p in cfg.cyan],
            (cfg.goal, C_GREEN),
        ):
            if pos in self._by_ri:
                self._paint_diamond(frame, self._by_ri[pos], color)

        # Magenta appears only after the player clicks a slot (smooth mid-travel via anim_xy)
        if lv.anim_xy is not None:
            self._paint_diamond_at(frame, lv.anim_xy[0], lv.anim_xy[1], C_MAGENTA)
        elif lv.pos is not None:
            self._paint_diamond(frame, self._by_ri[lv.pos], C_MAGENTA)

        # Fixed direction record for this level — show only N arrows (hide the rest)
        moves = lv.cfg.moves
        n = len(moves)
        arrow_color = C_GREEN if lv.armed else C_DGREY
        for i, box in enumerate(self._dir_boxes):
            if i < n:
                self._draw_dir_arrow(frame, box, moves[i], arrow_color)
                # Dark-grey outline by default so the active white outline stands out
                if lv.armed and i == lv.path_index:
                    self._outline_box(frame, box, C_WHITE)
                else:
                    self._outline_box(frame, box, C_VDGREY)
            else:
                # Fully hide unused boxes (including the 0 border)
                by, bx = box
                for dy in range(9):
                    for dx in range(9):
                        frame[by + dy][bx + dx] = C_BLACK

        # HUD level pips
        for i in range(self.win_levels):
            x0 = 2 + i * 4
            color = C_GREEN if i < self.levels_completed else C_DGREY
            if i == self.levels_completed and self.state != "WIN":
                color = C_YELLOW
            for dx in range(3):
                xx = x0 + dx
                if 0 <= xx < FRAME:
                    frame[61][xx] = color

        return frame
