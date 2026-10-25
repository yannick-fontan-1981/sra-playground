"""CASC — domino routing with block / continue cursors (RF10).

Controls:
  ACTION1-4  move the selected cursor (onto a domino / O / gap)
  ACTION5    fire a burst of up to burst_size falls (per-level; HUD shows it)
  ACTION6    cycle cursor (when several)
  ACTION7    soft reset

Rules:
  - Primed dominos (yellow) fall on SPACE bursts, pushing in their tip direction.
  - Blocker (brown, cyan/orange outline): smothers fall + push on its cell.
  - Continuator (magenta, cyan/orange outline): bridges one empty gap; on O force-opens.
  - Pink O: single hit = one-shot pass then brown spent; dual hit = durable opened.
  - Each tile is a fixed 3x3 square with 1px gap; direction = one white dot.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

C_WHITE = 0
C_LGREY = 1
C_MGREY = 2
C_DGREY = 3
C_VDGREY = 4
C_BLACK = 5
C_MAGENTA = 6
C_PINK = 7
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_BROWN = 13
C_GREEN = 14

FRAME = 64
HUD_H = 10
PLAY_H = FRAME - HUD_H

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE = 5
ACTION_CYCLE = 6
ACTION_RESET = 7

DEFAULT_BURST_SIZE = 2
CELL = 3  # solid 3x3 square body (never miniature)
GAP = 1  # exactly one black pixel between neighbouring tiles
STRIDE = CELL + GAP  # 4: body + gap

DIR_CHARS = {
    ">": (0, 1),
    "<": (0, -1),
    "v": (1, 0),
    "^": (-1, 0),
    "e": (0, 1),
    "w": (0, -1),
    "s": (1, 0),
    "n": (-1, 0),
}

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "cascade_quiesce" / "levels"


CursorKind = Literal["block", "continue"]


@dataclass
class LevelSpec:
    name: str
    max_steps: int
    grid: list[str]
    primes: list[tuple[int, int]] = field(default_factory=list)
    cursors: list[tuple[tuple[int, int], CursorKind]] = field(default_factory=list)
    burst_size: int = DEFAULT_BURST_SIZE
    wall_color: int = C_DGREY
    floor_color: int = C_VDGREY


@dataclass
class Domino:
    pos: tuple[int, int]
    direction: tuple[int, int]
    fallen: bool = False
    is_target: bool = False


@dataclass
class Circle:
    pos: tuple[int, int]
    outs: tuple[tuple[int, int], ...] = ((0, 1), (0, -1), (1, 0), (-1, 0))
    # fresh → first single hit = one-shot pass then spent; dual hit = opened (durable)
    status: Literal["fresh", "opened", "spent"] = "fresh"


@dataclass
class Cursor:
    pos: tuple[int, int]
    kind: CursorKind = "block"


@dataclass
class LevelState:
    spec: LevelSpec
    width: int
    height: int
    floor: set[tuple[int, int]]
    walls: set[tuple[int, int]]
    dominos: dict[tuple[int, int], Domino]
    circles: dict[tuple[int, int], Circle]
    cursors: list[Cursor]
    selected: int = 0
    primed: set[tuple[int, int]] = field(default_factory=set)
    # Pink O hits are deferred one step so resolving an O costs a fall tick.
    pending_circles: dict[tuple[int, int], set[tuple[int, int]]] = field(
        default_factory=dict
    )
    targets_total: int = 0
    targets_fallen: int = 0


def _cell(raw: object) -> tuple[int, int]:
    """Coerce a JSON [r,c] (or tuple) into strict int coordinates."""
    if not isinstance(raw, (list, tuple)) or len(raw) != 2:
        raise ValueError(f"bad cell {raw!r}")
    return (int(raw[0]), int(raw[1]))


def _load_levels() -> list[LevelSpec]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    out: list[LevelSpec] = []
    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        cursors: list[tuple[tuple[int, int], CursorKind]] = []
        for raw in data.get("cursors", []) or []:
            if isinstance(raw, dict):
                pos = _cell(raw["pos"])
                kind = str(raw.get("kind", "block"))
            else:
                pos = _cell(raw)
                kind = "block"
            if kind not in ("block", "continue"):
                raise ValueError(f"bad cursor kind {kind}")
            cursors.append((pos, kind))  # type: ignore[arg-type]
        out.append(
            LevelSpec(
                name=str(data["name"]),
                max_steps=int(data.get("max_steps", 200)),
                grid=list(data["grid"]),
                primes=[_cell(p) for p in data.get("primes", [])],
                cursors=cursors,
                burst_size=int(data.get("burst_size", DEFAULT_BURST_SIZE)),
                wall_color=int(data.get("wall_color", C_DGREY)),
                floor_color=int(data.get("floor_color", C_VDGREY)),
            )
        )
    return out


def _parse_grid(spec: LevelSpec) -> LevelState:
    rows = spec.grid
    height = len(rows)
    width = max(len(r) for r in rows)
    floor: set[tuple[int, int]] = set()
    walls: set[tuple[int, int]] = set()
    dominos: dict[tuple[int, int], Domino] = {}
    circles: dict[tuple[int, int], Circle] = {}

    for r, row in enumerate(rows):
        for c, ch in enumerate(row.ljust(width, "#")):
            pos = (r, c)
            if ch == "#":
                walls.add(pos)
                continue
            floor.add(pos)
            if ch in DIR_CHARS:
                dominos[pos] = Domino(
                    pos=pos, direction=DIR_CHARS[ch], is_target=ch in "ewsn"
                )
            elif ch == "O":
                circles[pos] = Circle(pos=pos)
            elif ch not in (".", " ", "@", "B"):
                raise ValueError(f"unknown char {ch!r} in {spec.name}")

    cursor_objs: list[Cursor] = []
    if not spec.cursors:
        for pos in sorted(floor):
            if pos not in dominos and pos not in circles:
                cursor_objs = [Cursor(pos=pos, kind="block")]
                break
    else:
        for pos, kind in spec.cursors:
            if pos not in floor:
                floor.add(pos)
            cursor_objs.append(Cursor(pos=pos, kind=kind))

    primes = set(spec.primes)
    if not primes and dominos:
        primes = {sorted(dominos.keys())[0]}
    for p in primes:
        if p not in dominos:
            raise ValueError(f"{spec.name}: prime {p} missing")

    targets_total = sum(1 for d in dominos.values() if d.is_target)
    if targets_total < 1:
        raise ValueError(f"{spec.name}: need a target e/w/n/s")

    return LevelState(
        spec=spec,
        width=width,
        height=height,
        floor=floor,
        walls=walls,
        dominos=dominos,
        circles=circles,
        cursors=cursor_objs,
        selected=0,
        primed=set(primes),
        targets_total=targets_total,
        targets_fallen=0,
    )


class CascadeQuiesceEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
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
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = _parse_grid(deepcopy(self._templates[0]))

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = _parse_grid(deepcopy(self._templates[0]))
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_grid(deepcopy(self._templates[idx]))
        self.level_steps = 0
        self.last_action = "ACTION7"
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        self._pending_frames = [self._render_frame()]
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()

        self.last_action = f"ACTION{aid}"
        frames: list[list[list[int]]] = []

        if aid in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            frames = self._move_cursor(aid)
        elif aid == ACTION_CYCLE:
            frames = self._cycle_cursor()
        elif aid == ACTION_SPACE:
            frames = self._run_burst()
        else:
            return self.public_state()

        self.step_index += 1
        self.level_steps += 1
        if self.level_steps > self._level.spec.max_steps and self.state != "WIN":
            before = frames[-1] if frames else self._render_frame()
            self._soft_fail(frames, before)
        self._pending_frames = frames or [self._render_frame()]
        return self.public_state()

    def _blocker_set(self) -> set[tuple[int, int]]:
        return {c.pos for c in self._level.cursors if c.kind == "block"}

    def _continue_set(self) -> set[tuple[int, int]]:
        return {c.pos for c in self._level.cursors if c.kind == "continue"}

    def _cursor_positions(self) -> set[tuple[int, int]]:
        return {c.pos for c in self._level.cursors}

    def _blocked(self, pos: tuple[int, int]) -> bool:
        return pos in self._level.walls or pos in self._blocker_set()

    def _cycle_cursor(self) -> list[list[list[int]]]:
        lv = self._level
        if len(lv.cursors) <= 1:
            return [self._render_frame()]
        lv.selected = (lv.selected + 1) % len(lv.cursors)
        return [self._render_frame()]

    def _move_cursor(self, aid: int) -> list[list[list[int]]]:
        lv = self._level
        if not lv.cursors:
            return self._reject()
        dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[aid]
        r, c = lv.cursors[lv.selected].pos
        nxt = (r + dr, c + dc)
        if nxt not in lv.floor or nxt in lv.walls:
            return self._reject()
        # May sit on dominos or pink circles; bumping another cursor selects it
        for i, other in enumerate(lv.cursors):
            if i != lv.selected and other.pos == nxt:
                lv.selected = i
                return [self._render_frame()]
        lv.cursors[lv.selected].pos = nxt
        return [self._render_frame()]

    def _run_burst(self) -> list[list[list[int]]]:
        lv = self._level
        self._scrub_dead_pending_circles()
        live0 = {p for p in lv.primed if p not in self._blocker_set()}
        # SPACE must also fire when only a pending pink O remains (it costs a tick).
        if not live0 and not lv.pending_circles:
            return self._reject()
        burst_n = max(1, int(lv.spec.burst_size))
        frames: list[list[list[int]]] = [self._render_frame()]
        any_fell = False
        ticks = 0
        # Past burst_n we may only flush pending O (armed during the burst) so a
        # left→right pass does not appear stuck on the pink junction mid-SPACE.
        while ticks < burst_n + 8:
            live = {p for p in lv.primed if p not in self._blocker_set()}
            pending = bool(lv.pending_circles)
            if not live and not pending:
                break
            if ticks >= burst_n and (live or not pending):
                break
            step_frames, _step_stall, fell = self._burst_one_step()
            frames.extend(step_frames)
            any_fell = any_fell or fell
            ticks += 1
            if not fell:
                break
        # After each SPACE burst, switch active cursor
        if len(lv.cursors) > 1:
            lv.selected = (lv.selected + 1) % len(lv.cursors)
        frames.append(self._render_frame())
        if lv.targets_fallen >= lv.targets_total:
            frames.extend(self._complete_level())
            return frames
        self._scrub_dead_pending_circles()
        # Soft-reset when the reaction has fully stopped: no free yellow left,
        # no pending pink O, but green target(s) still standing.
        live_primed = {p for p in lv.primed if p not in self._blocker_set()}
        greens_left = lv.targets_fallen < lv.targets_total
        if (
            any_fell
            and not live_primed
            and not lv.pending_circles
            and greens_left
        ):
            before = frames[-1]
            frames.extend(self._invalid_cascade(before))
        return frames

    def _scrub_dead_pending_circles(self) -> None:
        """Drop pending hits that can never resolve (spent O without force-open)."""
        lv = self._level
        continues = self._continue_set()
        blockers = self._blocker_set()
        cleaned: dict[tuple[int, int], set[tuple[int, int]]] = {}
        for cpos, dirs in lv.pending_circles.items():
            circ = lv.circles.get(cpos)
            if circ is None:
                continue
            if cpos in blockers:
                cleaned[cpos] = set(dirs)
                continue
            if circ.status == "spent" and cpos not in continues:
                continue
            cleaned[cpos] = set(dirs)
        lv.pending_circles = cleaned

    def _can_prime(self, pos: tuple[int, int]) -> bool:
        """A domino can be primed unless smothered by a blocker cursor."""
        return (
            pos in self._level.dominos
            and not self._level.dominos[pos].fallen
            and pos not in self._blocker_set()
            and not self._blocked(pos)
        )

    def _propagate_through(
        self,
        pos: tuple[int, int],
        direction: tuple[int, int],
        circle_hits: dict[tuple[int, int], set[tuple[int, int]]] | None = None,
    ) -> None:
        """Continue a push: into domino, circle, or continuator bridge on empty."""
        lv = self._level
        if self._blocked(pos):
            return
        if pos in lv.dominos and not lv.dominos[pos].fallen:
            if pos not in self._blocker_set():
                lv.primed.add(pos)
            return
        if pos in lv.circles:
            if circle_hits is not None:
                circle_hits.setdefault(pos, set()).add(direction)
            return
        if pos in self._continue_set() and pos in lv.floor:
            # Continuator on empty floor = bridge one cell in the same direction
            nxt = (pos[0] + direction[0], pos[1] + direction[1])
            if self._blocked(nxt):
                return
            if nxt in lv.circles:
                if circle_hits is not None:
                    circle_hits.setdefault(nxt, set()).add(direction)
                return
            if nxt in lv.dominos and not lv.dominos[nxt].fallen:
                if nxt not in self._blocker_set():
                    lv.primed.add(nxt)

    def _push_is_stall(self, push: tuple[int, int], direction: tuple[int, int]) -> bool:
        """True when a push cannot continue the cascade (hole without bridge / blocker)."""
        _ = direction
        lv = self._level
        if push in lv.walls or push in self._blocker_set():
            return True
        if push in lv.dominos:
            # Already-fallen neighbour absorbs the push with no new prime.
            return bool(lv.dominos[push].fallen)
        if push in lv.circles:
            # Spent junction with no continuator force-open absorbs the push.
            circ = lv.circles[push]
            if circ.status == "spent" and push not in self._continue_set():
                return True
            return False
        if push in self._continue_set() and push in lv.floor:
            return False
        # Empty floor (hole) with no continuator bridge.
        return push in lv.floor

    def _resolve_circle(
        self,
        cpos: tuple[int, int],
        dirs_in: set[tuple[int, int]],
        new_circle_hits: dict[tuple[int, int], set[tuple[int, int]]],
    ) -> bool:
        """Resolve one pending pink O. Returns True if the push stalled."""
        lv = self._level
        circ = lv.circles[cpos]
        force_open = cpos in self._continue_set()
        if circ.status == "spent" and not force_open:
            return True
        stalled = False
        if force_open or len(dirs_in) >= 2:
            circ.status = "opened"
            outs = set(dirs_in) | set(circ.outs)
            for out in outs:
                npos = (cpos[0] + out[0], cpos[1] + out[1])
                if self._push_is_stall(npos, out):
                    stalled = True
                self._propagate_through(npos, out, new_circle_hits)
        elif circ.status == "opened":
            for din in dirs_in:
                npos = (cpos[0] + din[0], cpos[1] + din[1])
                if self._push_is_stall(npos, din):
                    stalled = True
                self._propagate_through(npos, din, new_circle_hits)
        else:
            circ.status = "spent"
            din = next(iter(dirs_in))
            npos = (cpos[0] + din[0], cpos[1] + din[1])
            if self._push_is_stall(npos, din):
                stalled = True
            self._propagate_through(npos, din, new_circle_hits)
        return stalled

    def _burst_one_step(self) -> tuple[list[list[list[int]]], bool, bool]:
        lv = self._level
        before = self._render_frame()
        blockers = self._blocker_set()

        # O's hit on a *previous* tick resolve this tick (1 fall cost).
        # Important: do NOT merge same-tick domino hits into that resolve.
        # Otherwise a vertical spur that armed the O one tick earlier would
        # dual-open with a later horizontal hit and fail to block it (L01).
        to_resolve = {
            p: set(dirs)
            for p, dirs in lv.pending_circles.items()
            if p in lv.circles and p not in blockers
        }
        for cpos in to_resolve:
            lv.pending_circles.pop(cpos, None)

        falling = [
            lv.dominos[p]
            for p in list(lv.primed)
            if p in lv.dominos and not lv.dominos[p].fallen and p not in blockers
        ]
        # Keep smothered primes so a blocker sitting on a primed cell does not wipe it.
        lv.primed = {
            p
            for p in lv.primed
            if p in lv.dominos and not lv.dominos[p].fallen and p in blockers
        }
        if not falling and not to_resolve:
            return [before], False, False

        stalled = False
        step_circle_hits: dict[tuple[int, int], set[tuple[int, int]]] = {}
        primed_before = set(lv.primed)

        for d in falling:
            d.fallen = True
            if d.is_target:
                lv.targets_fallen += 1
            push = (d.pos[0] + d.direction[0], d.pos[1] + d.direction[1])
            if self._push_is_stall(push, d.direction):
                stalled = True
            if self._blocked(push):
                continue
            self._propagate_through(push, d.direction, step_circle_hits)

        # Resolve O's armed on prior ticks (snapshot dirs only).
        follow_hits: dict[tuple[int, int], set[tuple[int, int]]] = {}
        for cpos, dirs_in in to_resolve.items():
            if self._resolve_circle(cpos, dirs_in, follow_hits):
                stalled = True

        # Defer brand-new O hits (and follow-on hits) to the next tick.
        for bucket in (step_circle_hits, follow_hits):
            for cpos, dirs in bucket.items():
                if cpos in blockers:
                    continue
                circ = lv.circles.get(cpos)
                if circ is None:
                    continue
                if circ.status == "spent" and cpos not in self._continue_set():
                    continue
                lv.pending_circles.setdefault(cpos, set()).update(dirs)

        # Real fall animation: hold → flash → settle (dominos + resolving O).
        flash = deepcopy(before)
        for d in falling:
            self._paint_domino(flash, d, preview=False, flash=True)
        for cpos in to_resolve:
            y0, x0, y1, x1 = self._cell_rect(cpos)
            self._fill_rect(flash, y0, x0, y1, x1, C_ORANGE)
        white = deepcopy(flash)
        for d in falling:
            y0, x0, y1, x1 = self._cell_rect(d.pos)
            self._draw_outline(white, y0, x0, y1, x1, C_WHITE)
        for cpos in to_resolve:
            y0, x0, y1, x1 = self._cell_rect(cpos)
            self._draw_outline(white, y0, x0, y1, x1, C_WHITE)
        settled = self._render_frame()
        # Stall only counts if this step did not enqueue new work.
        if lv.primed - primed_before or lv.pending_circles:
            stalled = False
        return [before, flash, white, settled], stalled, True

    def _invalid_cascade(self, before: list[list[int]]) -> list[list[list[int]]]:
        """Red INVALID pulse then soft-reset the level (ACTION7 / reset button)."""
        frames = [
            self._tint(before, C_MGREY, C_RED),
            self._tint(before, C_DGREY, C_RED),
            self._tint(before, C_MGREY, C_ORANGE),
            before,
        ]
        self.state = "NOT_FINISHED"
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_grid(deepcopy(self._templates[idx]))
        self.level_steps = 0
        frames.append(self._render_frame())
        return frames

    def _complete_level(self) -> list[list[list[int]]]:
        pre = self._render_frame()
        frames = [
            self._tint(pre, C_MGREY, C_GREEN),
            pre,
            self._tint(pre, C_DGREY, C_CYAN),
        ]
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            frames.append(self._render_frame())
            return frames
        self._level = _parse_grid(deepcopy(self._templates[self.levels_completed]))
        self.level_steps = 0
        frames.append(self._render_frame())
        return frames

    def _reject(self) -> list[list[list[int]]]:
        before = self._render_frame()
        return [before, self._tint(before, C_MGREY, C_RED), before]

    def _soft_fail(self, frames: list[list[list[int]]], before: list[list[int]]) -> None:
        frames.extend([self._tint(before, C_MGREY, C_RED), before])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_grid(deepcopy(self._templates[idx]))
        self.level_steps = 0
        frames.append(self._render_frame())

    # ------------------------------------------------------------------ paint

    def _layout(self) -> tuple[int, int, int]:
        # Fixed 3x3 bodies + 1px gap (STRIDE). Fill playfield; never scale miniatures.
        top = max(0, (PLAY_H - self._level.height * STRIDE) // 2)
        left = max(0, (FRAME - self._level.width * STRIDE) // 2)
        return CELL, top, left

    def _cell_rect(self, pos: tuple[int, int]) -> tuple[int, int, int, int]:
        _cell, top, left = self._layout()
        y0 = top + pos[0] * STRIDE
        x0 = left + pos[1] * STRIDE
        return y0, x0, y0 + CELL, x0 + CELL

    def _fill_rect(
        self, frame: list[list[int]], y0: int, x0: int, y1: int, x1: int, color: int
    ) -> None:
        for y in range(max(0, y0), min(FRAME, y1)):
            for x in range(max(0, x0), min(FRAME, x1)):
                frame[y][x] = color

    def _draw_outline(
        self, frame: list[list[int]], y0: int, x0: int, y1: int, x1: int, color: int
    ) -> None:
        for x in range(max(0, x0), min(FRAME, x1)):
            if 0 <= y0 < FRAME:
                frame[y0][x] = color
            if 0 <= y1 - 1 < FRAME:
                frame[y1 - 1][x] = color
        for y in range(max(0, y0), min(FRAME, y1)):
            if 0 <= x0 < FRAME:
                frame[y][x0] = color
            if 0 <= x1 - 1 < FRAME:
                frame[y][x1 - 1] = color

    def _paint_domino(
        self, frame: list[list[int]], d: Domino, *, preview: bool, flash: bool = False
    ) -> None:
        y0, x0, y1, x1 = self._cell_rect(d.pos)
        # Always a full 3x3 square (never an inset miniature).
        if d.fallen:
            self._fill_rect(
                frame, y0, x0, y1, x1, C_ORANGE if flash else C_BROWN
            )
            return
        smothered = d.pos in self._blocker_set()
        if preview and not smothered:
            col = C_YELLOW
        elif d.is_target:
            col = C_GREEN
        else:
            col = C_BLUE
        self._fill_rect(frame, y0, x0, y1, x1, col)
        # Single white direction dot (offset toward tip inside the 3x3).
        dr, dc = d.direction
        cy = y0 + 1 + (-1 if dr < 0 else 1 if dr > 0 else 0)
        cx = x0 + 1 + (-1 if dc < 0 else 1 if dc > 0 else 0)
        if 0 <= cy < FRAME and 0 <= cx < FRAME:
            frame[cy][cx] = C_WHITE

    def _paint_circle(self, frame: list[list[int]], c: Circle) -> None:
        y0, x0, y1, x1 = self._cell_rect(c.pos)
        # Multi-direction piece: pink while usable, yellow when pending fall,
        # brown once spent.
        pending = c.pos in self._level.pending_circles
        if c.status == "spent":
            col = C_BROWN
        elif pending:
            col = C_YELLOW
        else:
            col = C_PINK
        self._fill_rect(frame, y0, x0, y1, x1, col)
        if c.status != "spent":
            cy, cx = y0 + 1, x0 + 1
            if 0 <= cy < FRAME and 0 <= cx < FRAME:
                frame[cy][cx] = C_WHITE
            for d in (-1, 1):
                if 0 <= cx + d < FRAME:
                    frame[cy][cx + d] = C_WHITE
                if 0 <= cy + d < FRAME:
                    frame[cy + d][cx] = C_WHITE

    def _paint_cursor(self, frame: list[list[int]], cur: Cursor, selected: bool) -> None:
        y0, x0, y1, x1 = self._cell_rect(cur.pos)
        # Blocker = brown body; continuator = magenta body.
        # Selected outline = cyan; unselected = orange.
        fill = C_BROWN if cur.kind == "block" else C_MAGENTA
        border = C_CYAN if selected else C_ORANGE
        self._fill_rect(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, fill)
        self._draw_outline(frame, y0, x0, y1, x1, border)

    def _draw_hud(self, frame: list[list[int]]) -> None:
        lv = self._level
        y0 = PLAY_H + 2
        # Primed lamp
        self._fill_rect(frame, y0, 2, y0 + 5, 8, C_YELLOW if lv.primed else C_MGREY)
        # Target gauge
        self._fill_rect(frame, y0, 10, y0 + 5, 28, C_BLACK)
        self._draw_outline(frame, y0, 10, y0 + 5, 28, C_MGREY)
        for i in range(lv.targets_total):
            x = 12 + i * 4
            if x + 3 >= 28:
                break
            fill = C_GREEN if i < lv.targets_fallen else C_DGREY
            self._fill_rect(frame, y0 + 1, x, y0 + 4, x + 3, fill)
        # Burst size indicator: N cyan pips = dominos per SPACE
        burst_n = max(1, int(lv.spec.burst_size))
        bx0 = 30
        self._fill_rect(frame, y0, bx0, y0 + 5, bx0 + burst_n * 2 + 2, C_BLACK)
        self._draw_outline(frame, y0, bx0, y0 + 5, bx0 + burst_n * 2 + 2, C_LGREY)
        for i in range(burst_n):
            x = bx0 + 1 + i * 2
            self._fill_rect(frame, y0 + 1, x, y0 + 4, x + 1, C_CYAN)
        # Cursor index pips (kind color; selected gets cyan rim via neighbor)
        for i, cur in enumerate(lv.cursors):
            x = 48 + i * 3
            if x + 2 >= FRAME:
                break
            body = C_BROWN if cur.kind == "block" else C_MAGENTA
            self._fill_rect(frame, y0 + 1, x, y0 + 4, x + 2, body)
            if i == lv.selected:
                frame[y0][x] = C_CYAN
                frame[y0][x + 1] = C_CYAN

        y = FRAME - 2
        for i in range(self.win_levels):
            x = 2 + i * 3
            col = (
                C_GREEN
                if i < self.levels_completed
                else C_CYAN
                if i == self.levels_completed and self.state != "WIN"
                else C_MGREY
            )
            frame[y][x] = col

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        lv = self._level
        for r in range(lv.height):
            for c in range(lv.width):
                pos = (r, c)
                y0, x0, y1, x1 = self._cell_rect(pos)
                if pos in lv.walls:
                    self._fill_rect(frame, y0, x0, y1, x1, lv.spec.wall_color)
                elif pos in lv.floor:
                    self._fill_rect(frame, y0, x0, y1, x1, lv.spec.floor_color)

        for circ in lv.circles.values():
            self._paint_circle(frame, circ)
        for d in lv.dominos.values():
            self._paint_domino(
                frame, d, preview=(d.pos in lv.primed and not d.fallen)
            )
        for i, cur in enumerate(lv.cursors):
            self._paint_cursor(frame, cur, selected=(i == lv.selected))

        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        self._draw_hud(frame)
        return frame

    @staticmethod
    def _tint(frame: list[list[int]], replace: int, color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
            for x in range(FRAME):
                if out[y][x] == replace:
                    out[y][x] = color
        return out

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        lv = self._level
        available = [
            "ACTION1",
            "ACTION2",
            "ACTION3",
            "ACTION4",
            "ACTION5",
            "ACTION6",
            "ACTION7",
        ]
        if self.state == "WIN":
            available = ["ACTION7"]
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": max(
                int(self.info.default_fps),
                16 if len(frames) > 1 else int(self.info.default_fps),
            ),
            "state": self.state,
            "level": min(int(self.levels_completed) + 1, int(self.win_levels)),
            "levels_completed": int(self.levels_completed),
            "win_levels": int(self.win_levels),
            "step_index": int(self.step_index),
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "last_action": str(self.last_action),
            "score": int(self.levels_completed),
            "full_reset": False,
            "source_path": str(LEVELS_DIR),
            "custom_family": str(self.info.family),
            "level_name": str(lv.spec.name),
            "level_steps": int(self.level_steps),
            "max_steps": int(lv.spec.max_steps),
            "primed": [[int(p[0]), int(p[1])] for p in sorted(lv.primed)],
            "targets_total": int(lv.targets_total),
            "targets_fallen": int(lv.targets_fallen),
            "cursors": [
                {"pos": [int(c.pos[0]), int(c.pos[1])], "kind": str(c.kind)}
                for c in lv.cursors
            ],
            "selected_cursor": int(lv.selected),
            "burst_size": int(lv.spec.burst_size),
        }
