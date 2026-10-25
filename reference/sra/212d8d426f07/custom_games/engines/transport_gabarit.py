"""GABA — Transport sous gabarit (Moving Out / footprint clearance).

Controls:
  ACTION1-4  — move carrier if full composite footprint is free
  ACTION5    — attach adjacent cargo; detach when fully on matching pads;
               if carrying and standing on rotate pad R → rotate 90° CW
  ACTION7    — soft reset level

Pads:
  D (green)  — drop for yellow cargos (C/B/L)
  Q (brown)  — drop for magenta cargos (P/S/E)
  R (purple) — rotate station
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7

FRAME = 64
HUD_H = 4
PLAY_H = FRAME - HUD_H
GRID = 12
CELL = 5
MAP = GRID * CELL
MAP_X0 = (FRAME - MAP) // 2
MAP_Y0 = 1

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "transport_gabarit" / "levels"

CargoKind = Literal["compact", "bar", "ell"]
PadKey = Literal["D", "Q"]
Cell = tuple[int, int]

# Glyph families → (kind, pad)
# Yellow family → green D ; magenta family → brown Q
GLYPH_FAMILY = {
    "C": ("compact", "D"),
    "B": ("bar", "D"),
    "L": ("ell", "D"),
    "P": ("compact", "Q"),
    "S": ("bar", "Q"),
    "E": ("ell", "Q"),
}


def _absolute(origin: Cell, offsets: list[Cell]) -> list[Cell]:
    or_, oc = origin
    return [(or_ + dr, oc + dc) for dr, dc in offsets]


def _connected_components(cells: set[Cell]) -> list[list[Cell]]:
    remaining = set(cells)
    comps: list[list[Cell]] = []
    while remaining:
        start = remaining.pop()
        stack = [start]
        comp = [start]
        while stack:
            r, c = stack.pop()
            for nr, nc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                if (nr, nc) in remaining:
                    remaining.remove((nr, nc))
                    stack.append((nr, nc))
                    comp.append((nr, nc))
        comps.append(sorted(comp))
    return comps


@dataclass
class Cargo:
    kind: CargoKind
    pad: PadKey
    # Free: absolute cells. Attached: offsets from player.
    cells: list[Cell]
    attached: bool = False
    delivered: bool = False


@dataclass
class LevelState:
    name: str
    walls: set[Cell] = field(default_factory=set)
    drop_d: set[Cell] = field(default_factory=set)  # green
    drop_q: set[Cell] = field(default_factory=set)  # brown targets
    rotate_pads: set[Cell] = field(default_factory=set)
    player: Cell = (1, 1)
    cargos: list[Cargo] = field(default_factory=list)
    attached_idx: int | None = None


def _load_levels() -> list[dict[str, Any]]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


def _parse_level(raw: dict[str, Any]) -> LevelState:
    rows = list(raw["ascii"])
    if len(rows) != GRID:
        raise ValueError(f"expected {GRID} rows, got {len(rows)}")
    walls: set[Cell] = set()
    drop_d: set[Cell] = set()
    drop_q: set[Cell] = set()
    rotate_pads: set[Cell] = set()
    player: Cell | None = None
    by_glyph: dict[str, set[Cell]] = {g: set() for g in GLYPH_FAMILY}

    for r, line in enumerate(rows):
        if len(line) != GRID:
            raise ValueError(f"row {r} len {len(line)} != {GRID}: {line!r}")
        for c, ch in enumerate(line):
            if ch == "#":
                walls.add((r, c))
            elif ch == "@":
                player = (r, c)
            elif ch == "D":
                drop_d.add((r, c))
            elif ch == "Q":
                drop_q.add((r, c))
            elif ch == "R":
                rotate_pads.add((r, c))
            elif ch in GLYPH_FAMILY:
                by_glyph[ch].add((r, c))
            elif ch in ". ":
                pass
            else:
                raise ValueError(f"unknown glyph {ch!r} at {(r, c)}")

    if player is None:
        raise ValueError("missing @")

    cargos: list[Cargo] = []
    for glyph, cells in by_glyph.items():
        if not cells:
            continue
        kind, pad = GLYPH_FAMILY[glyph]  # type: ignore[misc]
        for comp in _connected_components(cells):
            cargos.append(Cargo(kind=kind, pad=pad, cells=comp, attached=False, delivered=False))  # type: ignore[arg-type]

    if not cargos:
        raise ValueError("missing cargo")

    return LevelState(
        name=str(raw.get("name", "level")),
        walls=walls,
        drop_d=drop_d,
        drop_q=drop_q,
        rotate_pads=rotate_pads,
        player=player,
        cargos=cargos,
        attached_idx=None,
    )


class TransportGabaritEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels, found {len(self._templates)}")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = _parse_level(self._templates[0])

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = _parse_level(self._templates[0])
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_level(self._templates[idx])
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        frames: list[list[list[int]]] = []

        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            delta = {
                ACTION_UP: (-1, 0),
                ACTION_DOWN: (1, 0),
                ACTION_LEFT: (0, -1),
                ACTION_RIGHT: (0, 1),
            }[aid]
            self._try_move(delta[0], delta[1])
            frames.append(self._render_frame())
        elif aid == ACTION_SPACE:
            self._try_space()
            frames.append(self._render_frame())
        else:
            return self.public_state()

        if self._level_complete():
            frames.append(self._flash(C_GREEN))
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                frames.append(self._render_frame())
            else:
                self._level = _parse_level(self._templates[self.levels_completed])
                frames.append(self._render_frame())

        self._pending_frames = frames
        return self.public_state()

    def _pads_for(self, pad: PadKey) -> set[Cell]:
        return self._level.drop_d if pad == "D" else self._level.drop_q

    def _cargo_absolute(self, cargo: Cargo) -> list[Cell]:
        if cargo.attached:
            return _absolute(self._level.player, cargo.cells)
        return list(cargo.cells)

    def _all_blocking_cells(self, ignore_attached: bool = True) -> set[Cell]:
        """Occupied by free / delivered cargos (and walls handled separately)."""
        blocked: set[Cell] = set()
        for i, cargo in enumerate(self._level.cargos):
            if cargo.delivered:
                blocked.update(cargo.cells)
                continue
            if cargo.attached and ignore_attached:
                continue
            blocked.update(self._cargo_absolute(cargo))
        return blocked

    def _free(self, cells: set[Cell], *, extra_block: set[Cell] | None = None) -> bool:
        blocked = self._all_blocking_cells(ignore_attached=True)
        if extra_block:
            blocked |= extra_block
        for r, c in cells:
            if not (0 <= r < GRID and 0 <= c < GRID):
                return False
            if (r, c) in self._level.walls:
                return False
            if (r, c) in blocked:
                return False
        return True

    def _try_move(self, dr: int, dc: int) -> None:
        lv = self._level
        pr, pc = lv.player
        nr, nc = pr + dr, pc + dc
        if lv.attached_idx is not None:
            cargo = lv.cargos[lv.attached_idx]
            new_cargo = [(r + dr, c + dc) for r, c in self._cargo_absolute(cargo)]
            trial = {(nr, nc), *new_cargo}
        else:
            if (nr, nc) in self._all_blocking_cells():
                return
            trial = {(nr, nc)}
        if not self._free(trial):
            return
        lv.player = (nr, nc)

    def _try_space(self) -> None:
        lv = self._level
        if lv.attached_idx is not None:
            cargo = lv.cargos[lv.attached_idx]
            abs_cells = self._cargo_absolute(cargo)
            pads = self._pads_for(cargo.pad)
            if all(cell in pads for cell in abs_cells):
                cargo.cells = sorted(abs_cells)
                cargo.attached = False
                cargo.delivered = True
                lv.attached_idx = None
                return
            if lv.player in lv.rotate_pads:
                self._try_rotate()
            return

        # Attach nearest adjacent undelivered free cargo.
        pr, pc = lv.player
        adj = {(pr - 1, pc), (pr + 1, pc), (pr, pc - 1), (pr, pc + 1)}
        for i, cargo in enumerate(lv.cargos):
            if cargo.delivered or cargo.attached:
                continue
            if adj & set(cargo.cells):
                cargo.cells = sorted((r - pr, c - pc) for r, c in cargo.cells)
                cargo.attached = True
                lv.attached_idx = i
                return

    def _try_rotate(self) -> None:
        lv = self._level
        if lv.attached_idx is None:
            return
        cargo = lv.cargos[lv.attached_idx]
        new_off = sorted((dc, -dr) for dr, dc in cargo.cells)
        trial = {lv.player, *_absolute(lv.player, new_off)}
        if not self._free(trial):
            return
        cargo.cells = new_off

    def _level_complete(self) -> bool:
        lv = self._level
        if lv.attached_idx is not None:
            return False
        return all(c.delivered for c in lv.cargos)

    # --- render ---------------------------------------------------------------

    def _blit(self, frame: list[list[int]], row: int, col: int, color: int, inset: int = 0) -> None:
        y0 = MAP_Y0 + row * CELL + inset
        x0 = MAP_X0 + col * CELL + inset
        size = CELL - 2 * inset
        for dy in range(size):
            for dx in range(size):
                yy, xx = y0 + dy, x0 + dx
                if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                    frame[yy][xx] = color

    def _cargo_colors(self, cargo: Cargo) -> tuple[int, int]:
        """Fill + highlight."""
        if cargo.pad == "D":
            return (C_ORANGE if cargo.attached else C_YELLOW, C_WHITE)
        return (C_MAGENTA if cargo.attached else C_PINK, C_WHITE)

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level

        for r in range(GRID):
            for c in range(GRID):
                pos = (r, c)
                if pos in lv.walls:
                    self._blit(frame, r, c, C_DGREY)
                elif pos in lv.drop_d:
                    self._blit(frame, r, c, C_VDGREY)
                    self._blit(frame, r, c, C_GREEN, inset=1)
                elif pos in lv.drop_q:
                    self._blit(frame, r, c, C_VDGREY)
                    self._blit(frame, r, c, C_BROWN, inset=1)
                elif pos in lv.rotate_pads:
                    self._blit(frame, r, c, C_VDGREY)
                    self._blit(frame, r, c, C_PURPLE, inset=1)
                else:
                    self._blit(frame, r, c, C_BLACK)
                    self._blit(frame, r, c, C_VDGREY, inset=2)

        for cargo in lv.cargos:
            fill, hi = self._cargo_colors(cargo)
            for r, c in self._cargo_absolute(cargo):
                self._blit(frame, r, c, fill, inset=0)
                self._blit(frame, r, c, hi, inset=2)

        pr, pc = lv.player
        self._blit(frame, pr, pc, C_CYAN, inset=0)
        self._blit(frame, pr, pc, C_WHITE, inset=2)

        self._draw_hud(frame)
        return frame

    def _flash(self, color: int) -> list[list[int]]:
        frame = self._render_frame()
        for y in range(MAP_Y0, min(MAP_Y0 + MAP, PLAY_H)):
            for x in (MAP_X0, MAP_X0 + MAP - 1):
                if 0 <= x < FRAME:
                    frame[y][x] = color
        for x in range(MAP_X0, MAP_X0 + MAP):
            for y in (MAP_Y0, min(MAP_Y0 + MAP - 1, PLAY_H - 1)):
                frame[y][x] = color
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        pip_y = FRAME - 3
        total = self.win_levels
        width = total * 3 + (total - 1)
        x0 = max(1, (FRAME - width) // 2)
        for i in range(total):
            fill = C_DGREY
            if i < self.levels_completed or self.state == "WIN":
                fill = C_GREEN
            elif i == self.levels_completed:
                fill = C_CYAN
            x = x0 + i * 4
            for dx in range(3):
                for dy in range(2):
                    yy, xx = pip_y + dy, x + dx
                    if 0 <= yy < FRAME and 0 <= xx < FRAME:
                        frame[yy][xx] = fill

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = (
            ["ACTION7"]
            if self.state == "WIN"
            else ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION7"]
        )
        multi = len(frames) > 1
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 80 if multi else None,
            "default_fps": max(self.info.default_fps, 10),
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
            "attached": self._level.attached_idx is not None,
            "cargo_count": len(self._level.cargos),
            "delivered": sum(1 for c in self._level.cargos if c.delivered),
            "grid": GRID,
            "cell": CELL,
        }

    def move(self, action_id: int) -> dict[str, Any]:
        return self.action(action_id)

    def space(self) -> dict[str, Any]:
        return self.action(ACTION_SPACE)
