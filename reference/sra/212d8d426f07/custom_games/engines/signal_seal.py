"""SIGN — authenticate true beacons among decoys (RF12).

Controls:
  ACTION1-4  move
  ACTION5    SPACE — seal underfoot / calibrate(+) / toggle switch(W)
  ACTION7    soft reset
  (no click)

Loop:
  - Identical-looking beacons; step-on glow is not official.
  - SPACE on true → seal + gauge; on false → brown.
  - Optional + calibrator: proximity gauge blind until SPACE on +.
  - Optional W switch: mode A/B each reveals different true beacons.
  - Optional patrol trues: cyclic path with a 1-turn pause; multi-SPACE
    seals must be landed on the pause cell.
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
HUD_H = 11
PLAY_H = FRAME - HUD_H

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE = 5
ACTION_RESET = 7

BeaconKind = Literal["true", "false"]
BeaconStatus = Literal["hidden", "sealed", "brown"]
SwitchMode = Literal["A", "B"]

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "signal_seal" / "levels"


@dataclass
class MoverSpec:
    id: str
    kind: BeaconKind
    path: list[tuple[int, int]]
    modes: tuple[SwitchMode, ...] = ("A", "B")
    pause_index: int = 0
    seal_delay: int | None = None


@dataclass
class LevelSpec:
    name: str
    max_steps: int
    grid: list[str]
    require_calibration: bool = False
    hud_inverted_until_calibrated: bool = False
    seal_delay_steps: int = 0
    didactic_space_pulse: bool = False
    wall_color: int = C_DGREY
    floor_color: int = C_VDGREY
    beacon_idle_color: int = C_BLUE
    glow_color: int = C_YELLOW
    movers: tuple[MoverSpec, ...] = ()


@dataclass
class Beacon:
    id: str
    pos: tuple[int, int]
    kind: BeaconKind
    status: BeaconStatus = "hidden"
    modes: tuple[SwitchMode, ...] = ("A", "B")
    path: list[tuple[int, int]] | None = None
    pause_index: int | None = None
    seal_delay: int | None = None
    timeline: list[tuple[int, int]] = field(default_factory=list)


@dataclass
class LevelState:
    spec: LevelSpec
    width: int
    height: int
    floor: set[tuple[int, int]]
    walls: set[tuple[int, int]]
    player: tuple[int, int]
    beacons: dict[str, Beacon]
    calibrate_cells: set[tuple[int, int]] = field(default_factory=set)
    switch_pos: tuple[int, int] | None = None
    switch_mode: SwitchMode = "A"
    calibrated: bool = False
    dwell: int = 0
    dwell_beacon_id: str | None = None
    true_total: int = 0
    true_sealed: int = 0
    cycle_tick: int = 0


def _expand_timeline(
    path: list[tuple[int, int]], pause_index: int
) -> list[tuple[int, int]]:
    """Each path step occupies one tick; pause_index stays one extra tick."""
    out: list[tuple[int, int]] = []
    for i, pos in enumerate(path):
        out.append(pos)
        if i == pause_index:
            out.append(pos)
    return out or list(path)


def _parse_modes(raw: Any, default: tuple[SwitchMode, ...] = ("A", "B")) -> tuple[SwitchMode, ...]:
    if raw is None:
        return default
    if isinstance(raw, str):
        raw = [raw]
    modes = tuple(str(m).upper() for m in raw)
    for m in modes:
        if m not in ("A", "B"):
            raise ValueError(f"bad mode {m}")
    return modes  # type: ignore[return-value]


def _parse_grid(spec: LevelSpec) -> LevelState:
    rows = spec.grid
    height = len(rows)
    width = max(len(r) for r in rows)
    floor: set[tuple[int, int]] = set()
    walls: set[tuple[int, int]] = set()
    player: tuple[int, int] | None = None
    beacons: dict[str, Beacon] = {}
    calibrate_cells: set[tuple[int, int]] = set()
    switch_pos: tuple[int, int] | None = None
    n_static = 0

    for r, row in enumerate(rows):
        for c, ch in enumerate(row.ljust(width, "#")):
            pos = (r, c)
            if ch == "#":
                walls.add(pos)
                continue
            floor.add(pos)
            if ch == "@":
                player = pos
            elif ch == "T":
                bid = f"T{n_static}"
                n_static += 1
                beacons[bid] = Beacon(id=bid, pos=pos, kind="true", modes=("A", "B"))
            elif ch == "A":
                bid = f"A{n_static}"
                n_static += 1
                beacons[bid] = Beacon(id=bid, pos=pos, kind="true", modes=("A",))
            elif ch == "B":
                bid = f"B{n_static}"
                n_static += 1
                beacons[bid] = Beacon(id=bid, pos=pos, kind="true", modes=("B",))
            elif ch == "F":
                bid = f"F{n_static}"
                n_static += 1
                beacons[bid] = Beacon(id=bid, pos=pos, kind="false", modes=("A", "B"))
            elif ch == "C":
                calibrate_cells.add(pos)
            elif ch == "W":
                switch_pos = pos
            elif ch not in (".", " "):
                raise ValueError(f"unknown grid char {ch!r} in {spec.name}")

    if player is None:
        raise ValueError(f"{spec.name}: missing player @")
    if spec.require_calibration and not calibrate_cells:
        raise ValueError(f"{spec.name}: calibration required but no C")

    for mv in spec.movers:
        for pos in mv.path:
            if pos not in floor:
                floor.add(pos)
        timeline = _expand_timeline(mv.path, mv.pause_index)
        beacons[mv.id] = Beacon(
            id=mv.id,
            pos=timeline[0],
            kind=mv.kind,
            modes=mv.modes,
            path=list(mv.path),
            pause_index=mv.pause_index,
            seal_delay=mv.seal_delay,
            timeline=timeline,
        )

    true_total = sum(1 for b in beacons.values() if b.kind == "true")
    if true_total < 1:
        raise ValueError(f"{spec.name}: need at least one true beacon")

    return LevelState(
        spec=spec,
        width=width,
        height=height,
        floor=floor,
        walls=walls,
        player=player,
        beacons=beacons,
        calibrate_cells=calibrate_cells,
        switch_pos=switch_pos,
        switch_mode="A",
        calibrated=not spec.require_calibration,
        dwell=0,
        dwell_beacon_id=None,
        true_total=true_total,
        true_sealed=0,
        cycle_tick=0,
    )


def _load_level(path: Path) -> LevelSpec:
    data = json.loads(path.read_text(encoding="utf-8"))
    movers: list[MoverSpec] = []
    for raw in data.get("movers", []) or []:
        path_cells = [tuple(p) for p in raw["path"]]
        movers.append(
            MoverSpec(
                id=str(raw["id"]),
                kind=str(raw.get("kind", "true")),  # type: ignore[arg-type]
                path=path_cells,  # type: ignore[arg-type]
                modes=_parse_modes(raw.get("modes"), ("A", "B")),
                pause_index=int(raw.get("pause_index", 0)),
                seal_delay=(
                    int(raw["seal_delay"]) if raw.get("seal_delay") is not None else None
                ),
            )
        )
    return LevelSpec(
        name=str(data["name"]),
        max_steps=int(data.get("max_steps", 80)),
        grid=list(data["grid"]),
        require_calibration=bool(data.get("require_calibration", False)),
        hud_inverted_until_calibrated=bool(
            data.get("hud_inverted_until_calibrated", False)
        ),
        seal_delay_steps=int(data.get("seal_delay_steps", 0)),
        didactic_space_pulse=bool(data.get("didactic_space_pulse", False)),
        wall_color=int(data.get("wall_color", C_DGREY)),
        floor_color=int(data.get("floor_color", C_VDGREY)),
        beacon_idle_color=int(data.get("beacon_idle_color", C_BLUE)),
        glow_color=int(data.get("glow_color", C_YELLOW)),
        movers=tuple(movers),
    )


def _load_levels() -> list[LevelSpec]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class SignalSealEngine:
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
        self._episode_seal_is_authority = False
        self._space_hint_flash = 0

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._episode_seal_is_authority = False
        self._space_hint_flash = 0
        self._level = _parse_grid(deepcopy(self._templates[0]))
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_grid(deepcopy(self._templates[idx]))
        self.level_steps = 0
        self.last_action = "ACTION7"
        self._space_hint_flash = 0
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
            frames = self._move(aid)
        elif aid == ACTION_SPACE:
            frames = self._space()
        else:
            return self.public_state()

        self._advance_movers()
        self.step_index += 1
        self.level_steps += 1
        if self._space_hint_flash > 0:
            self._space_hint_flash -= 1
        if self.level_steps > self._level.spec.max_steps and self.state != "WIN":
            before = frames[-1] if frames else self._render_frame()
            self._soft_fail(frames, before)
        if frames:
            frames[-1] = self._render_frame()
        self._pending_frames = frames or [self._render_frame()]
        return self.public_state()

    # ------------------------------------------------------------------ visibility / lookup

    def _visible(self, b: Beacon) -> bool:
        return self._level.switch_mode in b.modes

    def _visible_beacons(self) -> list[Beacon]:
        return [b for b in self._level.beacons.values() if self._visible(b)]

    def _beacon_at(self, pos: tuple[int, int] | None = None) -> Beacon | None:
        pos = pos or self._level.player
        for b in self._visible_beacons():
            if b.pos == pos and b.status == "hidden":
                return b
            if b.pos == pos and b.status in ("sealed", "brown"):
                return b
        return None

    def _seal_need(self, b: Beacon | None = None) -> int:
        b = b or self._beacon_at()
        if b is not None and b.seal_delay is not None:
            return int(b.seal_delay)
        return int(self._level.spec.seal_delay_steps)

    def _on_unresolved_beacon(self) -> bool:
        b = self._beacon_at()
        return b is not None and b.status == "hidden"

    def _visual_success_supposition(self) -> bool:
        return self._on_unresolved_beacon()

    def _truth_ready(self) -> bool:
        b = self._beacon_at()
        if b is None or b.status != "hidden" or b.kind != "true":
            return False
        if self._level.spec.require_calibration and not self._level.calibrated:
            return False
        if self._level.dwell < self._seal_need(b):
            return False
        return True

    def _displayed_ready(self) -> bool:
        if self._level.spec.require_calibration and not self._level.calibrated:
            honest = self._on_unresolved_beacon()
        else:
            honest = self._truth_ready()
        if (
            self._level.spec.hud_inverted_until_calibrated
            and not self._level.calibrated
        ):
            return not honest
        return honest

    def _bump_dwell(self) -> None:
        b = self._beacon_at()
        if b is not None and b.kind == "true" and b.status == "hidden":
            if self._level.dwell_beacon_id != b.id:
                self._level.dwell = 0
                self._level.dwell_beacon_id = b.id
            self._level.dwell += 1
        else:
            self._level.dwell = 0
            self._level.dwell_beacon_id = None

    def _advance_movers(self) -> None:
        self._level.cycle_tick += 1
        tick = self._level.cycle_tick
        for b in self._level.beacons.values():
            if not b.timeline or b.status != "hidden":
                continue
            b.pos = b.timeline[tick % len(b.timeline)]
        # If the dwell target moved away from the player, reset dwell.
        b = self._beacon_at()
        if self._level.dwell_beacon_id is not None:
            cur = self._level.beacons.get(self._level.dwell_beacon_id)
            if cur is None or cur.pos != self._level.player or cur.status != "hidden":
                self._level.dwell = 0
                self._level.dwell_beacon_id = None

    # ------------------------------------------------------------------ actions

    def _move(self, aid: int) -> list[list[list[int]]]:
        dr, dc = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}[aid]
        r, c = self._level.player
        nxt = (r + dr, c + dc)
        frames: list[list[list[int]]] = []
        if nxt not in self._level.floor:
            before = self._render_frame()
            flash = deepcopy(before)
            self._paint_player(flash, C_RED)
            frames = [before, flash, before]
            return frames

        self._level.player = nxt
        # Dwell counts SPACE presses only (needed for pause-window multi-seal).
        self._level.dwell = 0
        self._level.dwell_beacon_id = None
        b = self._beacon_at()
        if b is not None and b.status == "hidden":
            self._space_hint_flash = 6 if self._level.spec.didactic_space_pulse else 3
            base = self._render_frame()
            glow = deepcopy(base)
            self._paint_beacon(glow, b, force_glow=True, pulse=True)
            frames = [base, glow, self._render_frame()]
        else:
            frames = [self._render_frame()]
        return frames

    def _space(self) -> list[list[list[int]]]:
        # Mode switch
        if (
            self._level.switch_pos is not None
            and self._level.player == self._level.switch_pos
        ):
            before = self._render_frame()
            self._level.switch_mode = "B" if self._level.switch_mode == "A" else "A"
            self._level.dwell = 0
            self._level.dwell_beacon_id = None
            mid = self._tint(before, C_MAGENTA, C_CYAN)
            return [before, mid, self._render_frame(), mid, self._render_frame()]

        # Calibrator +
        if self._level.player in self._level.calibrate_cells and not self._level.calibrated:
            self._level.calibrated = True
            before = self._render_frame()
            mid = self._tint(before, C_YELLOW, C_CYAN)
            return [before, mid, self._render_frame(), mid, self._render_frame()]

        b = self._beacon_at()
        if b is None or b.status != "hidden":
            before = self._render_frame()
            pulse = self._tint(before, C_MGREY, C_LGREY)
            return [before, pulse, self._render_frame()]

        if b.kind == "false":
            return self._reveal_false(b)
        if not self._level.calibrated and self._level.spec.require_calibration:
            return self._reject_seal()
        # Each SPACE on a true counts toward seal_delay; seal when threshold reached.
        need = max(1, self._seal_need(b))
        self._bump_dwell()
        if self._level.dwell < need:
            return self._reject_seal()
        return self._seal_true(b)

    def _reveal_false(self, b: Beacon) -> list[list[list[int]]]:
        before = self._render_frame()
        b.status = "brown"
        self._level.dwell = 0
        self._level.dwell_beacon_id = None
        mid = deepcopy(before)
        self._paint_beacon(mid, b, force_status="brown", pulse=True)
        after = self._render_frame()
        return [before, mid, after, mid, after]

    def _seal_true(self, b: Beacon) -> list[list[list[int]]]:
        before = self._render_frame()
        b.status = "sealed"
        self._level.true_sealed += 1
        self._level.dwell = 0
        self._level.dwell_beacon_id = None
        self._episode_seal_is_authority = True
        self._space_hint_flash = 0
        flash = deepcopy(before)
        self._paint_beacon(flash, b, force_status="sealed", pulse=True)
        whiteout = self._tint(before, self._level.spec.beacon_idle_color, C_WHITE)
        frames = [before, flash, whiteout, self._render_frame()]
        if self._level.true_sealed >= self._level.true_total:
            frames.extend(self._level_clear_frames())
            self._advance_level(frames)
        return frames

    def _reject_seal(self) -> list[list[list[int]]]:
        before = self._render_frame()
        bad = self._tint(before, C_YELLOW, C_RED)
        if self._visual_success_supposition():
            bad = self._tint(before, C_GREEN, C_RED)
        return [before, bad, self._render_frame()]

    def _level_clear_frames(self) -> list[list[list[int]]]:
        pre = self._render_frame()
        frames: list[list[list[int]]] = []
        for _ in range(3):
            frames.append(self._tint(pre, C_MGREY, C_GREEN))
            frames.append(pre)
        return frames

    def _advance_level(self, frames: list[list[list[int]]]) -> None:
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            frames.append(self._render_frame())
            return
        self._level = _parse_grid(deepcopy(self._templates[self.levels_completed]))
        self.level_steps = 0
        self._space_hint_flash = 0
        self.state = "NOT_FINISHED"
        frames.append(self._render_frame())

    def _soft_fail(self, frames: list[list[list[int]]], before: list[list[int]]) -> None:
        frames.extend(
            [
                self._tint(before, C_MGREY, C_RED),
                before,
                self._tint(before, C_MGREY, C_RED),
            ]
        )
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = _parse_grid(deepcopy(self._templates[idx]))
        self.level_steps = 0
        frames.append(self._render_frame())

    # ------------------------------------------------------------------ paint

    def _layout(self) -> tuple[int, int, int]:
        cell = min(
            5,
            max(3, (PLAY_H - 2) // max(1, self._level.height)),
            max(3, (FRAME - 2) // max(1, self._level.width)),
        )
        top = max(0, (PLAY_H - self._level.height * cell) // 2)
        left = max(0, (FRAME - self._level.width * cell) // 2)
        return cell, top, left

    def _cell_rect(self, pos: tuple[int, int]) -> tuple[int, int, int, int]:
        cell, top, left = self._layout()
        y0 = top + pos[0] * cell
        x0 = left + pos[1] * cell
        return y0, x0, y0 + cell, x0 + cell

    def _fill_rect(
        self, frame: list[list[int]], y0: int, x0: int, y1: int, x1: int, color: int
    ) -> None:
        for y in range(max(0, y0), min(FRAME, y1)):
            row = frame[y]
            for x in range(max(0, x0), min(FRAME, x1)):
                row[x] = color

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

    def _paint_player(self, frame: list[list[int]], color: int) -> None:
        y0, x0, y1, x1 = self._cell_rect(self._level.player)
        inset = 2 if (y1 - y0) >= 5 else 1
        self._fill_rect(frame, y0 + inset, x0 + inset, y1 - inset, x1 - inset, color)

    def _paint_beacon(
        self,
        frame: list[list[int]],
        b: Beacon,
        *,
        force_glow: bool = False,
        force_status: BeaconStatus | None = None,
        pulse: bool = False,
    ) -> None:
        if not self._visible(b) and force_status is None:
            return
        y0, x0, y1, x1 = self._cell_rect(b.pos)
        status = force_status or b.status
        occupied = self._level.player == b.pos

        if status == "brown":
            self._fill_rect(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, C_BROWN)
            self._draw_outline(frame, y0, x0, y1, x1, C_DGREY)
            if y1 - y0 >= 4 and x1 - x0 >= 4:
                frame[y0 + 2][x0 + 2] = C_DGREY
                frame[y1 - 3][x1 - 3] = C_DGREY
                frame[y0 + 2][x1 - 3] = C_DGREY
                frame[y1 - 3][x0 + 2] = C_DGREY
            return

        if status == "sealed":
            self._fill_rect(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, C_GREEN)
            self._draw_outline(frame, y0, x0, y1, x1, C_WHITE)
            cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if abs(dy) + abs(dx) <= 1:
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < FRAME and 0 <= xx < FRAME:
                            frame[yy][xx] = C_WHITE
            return

        self._fill_rect(
            frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, self._level.spec.beacon_idle_color
        )
        # Patrol marker: tiny magenta tick when moving
        if b.timeline and len(b.timeline) > 1:
            frame[y0 + 1][x0 + 1] = C_MAGENTA
        if occupied or force_glow:
            ring = self._level.spec.glow_color if not pulse else C_GREEN
            self._draw_outline(frame, y0, x0, y1, x1, ring)
            self._draw_outline(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, C_YELLOW)

    def _draw_calibrator(self, frame: list[list[int]], pos: tuple[int, int]) -> None:
        y0, x0, y1, x1 = self._cell_rect(pos)
        color = C_CYAN if self._level.calibrated else C_YELLOW
        self._fill_rect(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, color)
        cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
        for d in range(-1, 2):
            if 0 <= cy < FRAME and 0 <= cx + d < FRAME:
                frame[cy][cx + d] = C_WHITE
            if 0 <= cy + d < FRAME and 0 <= cx < FRAME:
                frame[cy + d][cx] = C_WHITE

    def _draw_switch(self, frame: list[list[int]]) -> None:
        if self._level.switch_pos is None:
            return
        y0, x0, y1, x1 = self._cell_rect(self._level.switch_pos)
        # Magenta body; mode shown as left(A)/right(B) white notch
        self._fill_rect(frame, y0 + 1, x0 + 1, y1 - 1, x1 - 1, C_MAGENTA)
        cy = (y0 + y1) // 2
        if self._level.switch_mode == "A":
            self._fill_rect(frame, cy - 1, x0 + 1, cy + 2, x0 + 3, C_WHITE)
        else:
            self._fill_rect(frame, cy - 1, x1 - 3, cy + 2, x1 - 1, C_WHITE)

    def _draw_signal_lamp(self, frame: list[list[int]]) -> None:
        """Simple readiness lamp: green = ready, red = not (may be inverted pre-calib)."""
        ready = self._displayed_ready()
        y0 = PLAY_H + 2
        color = C_GREEN if ready else C_RED
        self._fill_rect(frame, y0, 2, y0 + 5, 8, color)

    def _draw_found_gauge(self, frame: list[list[int]]) -> None:
        total = self._level.true_total
        sealed = self._level.true_sealed
        y0 = PLAY_H + 2
        # Compact found strip
        x0, x1 = 10, 33
        self._fill_rect(frame, y0, x0, y0 + 5, x1, C_BLACK)
        self._draw_outline(frame, y0, x0, y0 + 5, x1, C_MGREY)
        for i in range(total):
            x = x0 + 2 + i * 3
            if x + 2 >= x1:
                break
            fill = C_GREEN if i < sealed else C_DGREY
            self._fill_rect(frame, y0 + 1, x, y0 + 4, x + 2, fill)
            if i < sealed:
                frame[y0 + 2][x] = C_WHITE

    def _nearest_true_distance(self) -> int | None:
        best: int | None = None
        pr, pc = self._level.player
        for b in self._visible_beacons():
            if b.kind != "true" or b.status != "hidden":
                continue
            dist = abs(b.pos[0] - pr) + abs(b.pos[1] - pc)
            if best is None or dist < best:
                best = dist
        return best

    def _proximity_active(self) -> bool:
        if self._level.spec.require_calibration and not self._level.calibrated:
            return False
        return self._nearest_true_distance() is not None

    def _proximity_ratio(self) -> float:
        if not self._proximity_active():
            return 0.0
        dist = self._nearest_true_distance()
        if dist is None:
            return 0.0
        if dist <= 0:
            return 1.0
        span = max(1, self._level.width + self._level.height - 2)
        return max(0.0, min(1.0, 1.0 - (dist / float(span))))

    def _effective_dwell_need(self) -> int:
        b = self._beacon_at()
        if b is not None and b.kind == "true" and b.status == "hidden":
            return self._seal_need(b)
        # Show level default when standing nowhere special but delay exists.
        return int(self._level.spec.seal_delay_steps)

    def _draw_hud_dwell_and_proximity(self, frame: list[list[int]]) -> None:
        """Harmonious right HUD: cyan dwell blocks then proximity gauge."""
        y0 = PLAY_H + 2
        # Proximity gauge anchored at right.
        prox_x0 = 48
        prox_w = 14
        # Cyan blocks immediately to the left of proximity.
        need = self._effective_dwell_need()
        size, gap = 4, 1
        dwell_w = 0
        if need > 0:
            dwell_w = need * size + max(0, need - 1) * gap
        dwell_x0 = prox_x0 - 2 - dwell_w if need > 0 else prox_x0

        if need > 0:
            for i in range(need):
                x = dwell_x0 + i * (size + gap)
                filled = i < self._level.dwell and self._on_unresolved_beacon()
                # Also show progress after early SPACE bumps while still on beacon.
                if self._level.dwell_beacon_id is not None:
                    filled = i < self._level.dwell
                col = C_CYAN if filled else C_DGREY
                border = C_WHITE if filled else C_MGREY
                self._fill_rect(frame, y0, x, y0 + size, x + size, col)
                self._draw_outline(frame, y0, x, y0 + size, x + size, border)

        # Proximity distance gauge
        active = self._proximity_active()
        ratio = self._proximity_ratio()
        self._fill_rect(frame, y0, prox_x0, y0 + 5, prox_x0 + prox_w, C_BLACK)
        self._draw_outline(
            frame, y0, prox_x0, y0 + 5, prox_x0 + prox_w, C_MGREY if active else C_DGREY
        )
        track_x0, track_x1 = prox_x0 + 1, prox_x0 + 9
        self._fill_rect(frame, y0 + 1, track_x0, y0 + 4, track_x1 + 1, C_DGREY)
        if active and ratio > 0:
            fill_w = max(1, int(round(ratio * (track_x1 - track_x0 + 1))))
            col = C_CYAN if ratio < 1.0 else C_WHITE
            self._fill_rect(frame, y0 + 1, track_x0, y0 + 4, track_x0 + fill_w, col)
        if active:
            self._fill_rect(frame, y0 + 1, prox_x0 + 11, y0 + 4, prox_x0 + 14, C_GREEN)
            frame[y0 + 2][prox_x0 + 12] = C_WHITE
        else:
            self._fill_rect(frame, y0 + 1, prox_x0 + 11, y0 + 4, prox_x0 + 14, C_DGREY)

    def _draw_mode_pip(self, frame: list[list[int]]) -> None:
        if self._level.switch_pos is None:
            return
        # Tiny A/B indicator left of level pips
        y = FRAME - 3
        col = C_WHITE if self._level.switch_mode == "A" else C_MAGENTA
        frame[y][FRAME - 4] = col
        frame[y][FRAME - 3] = col

    def _draw_level_pips(self, frame: list[list[int]]) -> None:
        y = FRAME - 2
        for i in range(self.win_levels):
            x = 2 + i * 3
            if i < self.levels_completed:
                col = C_GREEN
            elif i == self.levels_completed and self.state != "WIN":
                col = C_CYAN
            else:
                col = C_MGREY
            frame[y][x] = col

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BLACK] * FRAME for _ in range(FRAME)]
        spec = self._level.spec
        for r in range(self._level.height):
            for c in range(self._level.width):
                pos = (r, c)
                y0, x0, y1, x1 = self._cell_rect(pos)
                if pos in self._level.walls:
                    self._fill_rect(frame, y0, x0, y1, x1, spec.wall_color)
                elif pos in self._level.floor:
                    self._fill_rect(frame, y0, x0, y1, x1, spec.floor_color)

        for pos in self._level.calibrate_cells:
            self._draw_calibrator(frame, pos)
        self._draw_switch(frame)
        for b in self._level.beacons.values():
            if b.status == "sealed" or b.status == "brown" or self._visible(b):
                self._paint_beacon(frame, b)
        self._paint_player(frame, C_ORANGE)

        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        # Harmonious single HUD row: lamp | found | cyan+proximity
        self._draw_signal_lamp(frame)
        self._draw_found_gauge(frame)
        self._draw_hud_dwell_and_proximity(frame)
        self._draw_mode_pip(frame)
        self._draw_level_pips(frame)
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
        available = [
            "ACTION1",
            "ACTION2",
            "ACTION3",
            "ACTION4",
            "ACTION5",
            "ACTION7",
        ]
        if self.state == "WIN":
            available = ["ACTION7"]
        lv = self._level
        b = self._beacon_at()
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frames[-1],
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": max(
                self.info.default_fps, 10 if len(frames) > 1 else self.info.default_fps
            ),
            "state": self.state,
            "level": min(self.levels_completed + 1, self.win_levels),
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
            "level_name": lv.spec.name,
            "level_steps": self.level_steps,
            "max_steps": lv.spec.max_steps,
            "calibrated": lv.calibrated,
            "require_calibration": lv.spec.require_calibration,
            "switch_mode": lv.switch_mode if lv.switch_pos else None,
            "seal_delay_steps": lv.spec.seal_delay_steps,
            "dwell": lv.dwell,
            "true_total": lv.true_total,
            "true_sealed": lv.true_sealed,
            "beacon_underfoot": None
            if b is None
            else {
                "id": b.id,
                "kind": b.kind,
                "status": b.status,
                "pos": list(b.pos),
            },
            "visual_success_supposition": self._visual_success_supposition(),
            "truth_ready": self._truth_ready(),
            "displayed_ready": self._displayed_ready(),
            "proximity_active": self._proximity_active(),
            "nearest_true_distance": self._nearest_true_distance(),
            "proximity_ratio": self._proximity_ratio(),
            "episode_seal_is_authority": self._episode_seal_is_authority,
        }
