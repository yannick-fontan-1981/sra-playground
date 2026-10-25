"""GARE — Gare cadencée: click rail buttons, animate trains, auto-transfer boxes.

Controls:
  ACTION6 click — rail button under the click (stable states only)
  ACTION7       — soft reset to the level's healthy checkpoint

Grid is 12×12 logical cells rendered as 5×5 tiles (60×60) inside the 64×64 frame.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from custom_games.registry import CustomGameInfo

# ARC-AGI-3 UI palette
C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

ACTION_CLICK, ACTION_RESET = 6, 7
FRAME = 64
HUD_H = 4
PLAY_H = FRAME - HUD_H
GRID = 12
CELL = 5
MAP = GRID * CELL  # 60
MAP_X0 = (FRAME - MAP) // 2  # 2
MAP_Y0 = 1

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "gare_cadence" / "levels"

BoxId = Literal["C", "L", "T"]
SlotId = Literal["C", "L", "T"]
ArmKind = Literal["A", "V"]

# Tile alphabet → UI palette indices.
# w=white rail; d=dark grey empty slots; p=purple loco; y/u = A yellow / V blue;
# s=grey links; r=mismatch; g=boxes.
_PIX = {
    "0": C_BLACK,
    "w": C_WHITE,
    "d": C_DGREY,
    "p": C_PURPLE,
    "r": C_RED,
    "g": C_GREEN,
    "y": C_YELLOW,
    "u": C_BLUE,
    "s": C_MGREY,
    "b": C_BROWN,
}


def _tile(rows: list[str]) -> tuple[tuple[int, ...], ...]:
    out: list[tuple[int, ...]] = []
    for row in rows:
        assert len(row) == CELL, row
        out.append(tuple(_PIX[ch] for ch in row))
    assert len(out) == CELL
    return tuple(out)


TILE_EMPTY = _tile(["00000", "00000", "00000", "00000", "00000"])
# White '=' bars with two grey pixels that visually stitch adjacent rail cells.
TILE_RAIL = _tile(["00000", "wwwww", "0s0s0", "wwwww", "00000"])
# Active destination: purple '#' (not a red plus).
TILE_RAIL_ACTIVE = _tile(["0p0p0", "ppppp", "0p0p0", "ppppp", "0p0p0"])
# Purple locomotive noses (rounded tip) + grey coupler onto the flat bay.
TILE_TRAIN_REAR = _tile(["00pp0", "0ppp0", "pppps", "0ppp0", "00pp0"])
TILE_TRAIN_FRONT = _tile(["0pp00", "0ppp0", "spppp", "0ppp0", "0pp00"])
# Empty generic bay: dark grey.
TILE_BAY = _tile(["ddddd", "d000d", "d000d", "d000d", "ddddd"])

TILE_BOX: dict[str, tuple[tuple[int, ...], ...]] = {
    "C": _tile(["ggggg", "g000g", "g0ggg", "g000g", "ggggg"]),
    "L": _tile(["ggggg", "g0ggg", "g0ggg", "g000g", "ggggg"]),
    "T": _tile(["ggggg", "g000g", "gg0gg", "gg0gg", "ggggg"]),
}
TILE_BOX_RED: dict[str, tuple[tuple[int, ...], ...]] = {
    "C": _tile(["rrrrr", "r000r", "r0rrr", "r000r", "rrrrr"]),
    "L": _tile(["rrrrr", "r0rrr", "r0rrr", "r000r", "rrrrr"]),
    "T": _tile(["rrrrr", "r000r", "rr0rr", "rr0rr", "rrrrr"]),
}
# Empty typed slots c/l/t: dark grey frame, green letter (identity cue).
TILE_SLOT: dict[str, tuple[tuple[int, ...], ...]] = {
    "C": _tile(["ddddd", "dgggd", "dgddd", "dgggd", "ddddd"]),
    "L": _tile(["ddddd", "dgddd", "dgddd", "dgggd", "ddddd"]),
    "T": _tile(["ddddd", "dgggd", "ddgdd", "ddgdd", "ddddd"]),
}
# Descending A = yellow; ascending V = blue (including return poses).
TILE_ARM_A = _tile(["00y00", "00y00", "yyyyy", "0y0y0", "y000y"])
TILE_ARM_V = _tile(["u000u", "0u0u0", "uuuuu", "00u00", "00u00"])
TILE_ARM_A_RET1 = _tile(["00y00", "00y00", "00y00", "0y0y0", "y000y"])
TILE_ARM_A_RET2 = _tile(["00y00", "00y00", "0yyy0", "0y0y0", "00000"])
TILE_ARM_V_RET1 = _tile(["u000u", "0u0u0", "00u00", "00u00", "00u00"])
TILE_ARM_V_RET2 = _tile(["00000", "0u0u0", "0uuu0", "00u00", "00u00"])


@dataclass
class Bay:
    slot: SlotId | None  # None = generic o
    box: BoxId | None = None

    @property
    def empty(self) -> bool:
        return self.box is None

    @property
    def mismatched(self) -> bool:
        return self.box is not None and self.slot is not None and self.box != self.slot


@dataclass
class Train:
    row: int
    rear: int
    bays: list[Bay]

    @property
    def length(self) -> int:
        return len(self.bays) + 2

    @property
    def front(self) -> int:
        return self.rear + self.length - 1

    def cols(self) -> range:
        return range(self.rear, self.front + 1)

    def bay_col(self, index: int) -> int:
        return self.rear + 1 + index

    def bay_index_at(self, col: int) -> int | None:
        if self.rear < col < self.front:
            return col - self.rear - 1
        return None


@dataclass
class Arm:
    row: int
    col: int
    kind: ArmKind


@dataclass
class FreeBox:
    row: int
    col: int
    kind: BoxId


@dataclass
class LevelState:
    rails: set[tuple[int, int]]
    trains: list[Train]
    arms: list[Arm]
    free_boxes: list[FreeBox]
    active_button: tuple[int, int] | None = None
    arm_holding: dict[tuple[int, int], BoxId] = field(default_factory=dict)
    arm_return: dict[tuple[int, int], int] = field(default_factory=dict)  # 1 or 2
    name: str = ""


def _load_levels() -> list[dict[str, Any]]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if len(paths) != 6:
        raise ValueError(f"GARE requires exactly six levels, found {len(paths)}")
    return [json.loads(p.read_text(encoding="utf-8")) for p in paths]


def _parse_ascii(
    ascii_rows: list[str],
    *,
    bay_overrides: dict[str, dict[str, Any]] | None = None,
) -> LevelState:
    rows = [str(r).ljust(GRID)[:GRID] for r in ascii_rows]
    while len(rows) < GRID:
        rows.append(" " * GRID)
    overrides = bay_overrides or {}
    rails: set[tuple[int, int]] = set()
    arms: list[Arm] = []
    free_boxes: list[FreeBox] = []
    trains: list[Train] = []
    active_button: tuple[int, int] | None = None
    arm_holding: dict[tuple[int, int], BoxId] = {}

    occupied_by_train: set[tuple[int, int]] = set()

    for r, line in enumerate(rows):
        c = 0
        while c < GRID:
            ch = line[c]
            if ch == "[":
                end = line.find("]", c + 1)
                if end < 0:
                    raise ValueError(f"unclosed train at row {r} col {c}")
                bays: list[Bay] = []
                for bc in range(c + 1, end):
                    key = f"{r},{bc}"
                    glyph = line[bc]
                    ov = overrides.get(key, {})
                    slot: SlotId | None
                    box: BoxId | None
                    # Glyph defaults first; explicit overrides win.
                    if glyph in ("c", "l", "t"):
                        slot = glyph.upper()  # type: ignore[assignment]
                        box = None
                    elif glyph == "o":
                        slot = None
                        box = None
                    elif glyph in ("C", "L", "T"):
                        slot = None
                        box = glyph  # type: ignore[assignment]
                    else:
                        slot = None
                        box = None
                    if "slot" in ov:
                        raw_slot = ov["slot"]
                        slot = None if raw_slot in (None, "", "o") else str(raw_slot)  # type: ignore[assignment]
                    if "box" in ov:
                        raw_box = ov["box"]
                        box = None if raw_box in (None, "") else str(raw_box)  # type: ignore[assignment]
                    bays.append(Bay(slot=slot, box=box))
                train = Train(row=r, rear=c, bays=bays)
                trains.append(train)
                for cc in train.cols():
                    occupied_by_train.add((r, cc))
                    rails.add((r, cc))  # rail persists under trains
                c = end + 1
                continue
            c += 1

    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            if ch in ("=", "#"):
                rails.add((r, c))
                if ch == "#":
                    active_button = (r, c)
            elif ch in ("A", "V"):
                arms.append(Arm(row=r, col=c, kind=ch))  # type: ignore[arg-type]
            elif ch in ("C", "L", "T") and (r, c) not in occupied_by_train:
                # Box on an arm cell → held by arm; otherwise free source.
                if any(a.row == r and a.col == c for a in arms):
                    arm_holding[(r, c)] = ch  # type: ignore[assignment]
                else:
                    # May still be an arm glyph replaced by box in trap frames:
                    # detect arm underneath via separate arm list only.
                    free_boxes.append(FreeBox(row=r, col=c, kind=ch))  # type: ignore[arg-type]

    # Trap frames put the held box glyph on the arm cell without an A/V letter.
    # Level JSON may declare arm_holding explicitly; also infer from overrides.
    return LevelState(
        rails=rails,
        trains=trains,
        arms=arms,
        free_boxes=free_boxes,
        active_button=active_button,
        arm_holding=arm_holding,
        name="",
    )


def _support_segments(rails: set[tuple[int, int]], row: int) -> list[tuple[int, int]]:
    cols = sorted(c for r, c in rails if r == row)
    if not cols:
        return []
    segs: list[tuple[int, int]] = []
    start = prev = cols[0]
    for c in cols[1:]:
        if c == prev + 1:
            prev = c
            continue
        segs.append((start, prev))
        start = prev = c
    segs.append((start, prev))
    return segs


def _segment_for(rails: set[tuple[int, int]], row: int, col: int) -> tuple[int, int] | None:
    for lo, hi in _support_segments(rails, row):
        if lo <= col <= hi:
            return lo, hi
    return None


class GareCadenceEngine:
    """Click rail buttons; animate trains; snapshot A/V transfers."""

    # Optional playtest start (1-based). Keep 1 for normal campaign start.
    _TEMP_START_LEVEL_1BASED = 1

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level_index = 0
        self._level: LevelState | None = None
        self._healthy: LevelState | None = None
        self._trap_active = False
        self._trap_doom_spec: dict[str, Any] | None = None
        start = self._temp_start_index()
        self.levels_completed = start
        self._begin_level(start, entry_trap=True)

    def _temp_start_index(self) -> int:
        raw = int(self._TEMP_START_LEVEL_1BASED)
        return max(0, min(raw, self.win_levels) - 1)

    # --- session ---------------------------------------------------------------

    def reset(self) -> dict[str, Any]:
        start = self._temp_start_index()
        self.levels_completed = start
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._begin_level(start, entry_trap=True)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        # Soft reset always restores the healthy checkpoint (L5 skips trap).
        self._begin_level(min(self.levels_completed, self.win_levels - 1), entry_trap=False)
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        data = dict(data or {})
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        # Inherited L5 trap: any non-reset action lets the doomed package finish.
        if self._trap_active:
            self.step_index += 1
            self._pending_frames = self._complete_trap_doom()
            return self.public_state()
        if aid != ACTION_CLICK:
            return self.public_state()
        self.step_index += 1
        frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    # --- level load ------------------------------------------------------------

    def _begin_level(self, index: int, *, entry_trap: bool) -> None:
        raw = self._templates[index]
        self._level_index = index
        self._level_name = str(raw.get("name", f"L{index+1:02d}"))
        overrides = {str(k): dict(v) for k, v in dict(raw.get("bay_overrides", {})).items()}
        healthy_ascii = list(raw.get("checkpoint_ascii") or raw["ascii"])
        healthy = _parse_ascii(healthy_ascii, bay_overrides=overrides)
        healthy.name = self._level_name
        # Explicit arm list for checkpoint when trap ascii hid A under a box.
        if raw.get("arms"):
            healthy.arms = [
                Arm(row=int(a["row"]), col=int(a["col"]), kind=str(a["kind"]))  # type: ignore[arg-type]
                for a in raw["arms"]
            ]
        self._healthy = deepcopy(healthy)

        self._trap_active = False
        self._trap_doom_spec = None
        trap_ascii = raw.get("trap_ascii")
        if entry_trap and trap_ascii:
            trap_over = {
                str(k): dict(v)
                for k, v in dict(raw.get("trap_bay_overrides", overrides)).items()
            }
            level = _parse_ascii(list(trap_ascii), bay_overrides=trap_over)
            level.name = self._level_name
            if raw.get("trap_arms") or raw.get("arms"):
                level.arms = [
                    Arm(row=int(a["row"]), col=int(a["col"]), kind=str(a["kind"]))  # type: ignore[arg-type]
                    for a in (raw.get("trap_arms") or raw["arms"])
                ]
            for item in raw.get("trap_arm_holding", []):
                level.arm_holding[(int(item["row"]), int(item["col"]))] = str(item["box"])  # type: ignore[assignment]
                # Remove mistaken free-box at the arm cell.
                level.free_boxes = [
                    b
                    for b in level.free_boxes
                    if not (b.row == int(item["row"]) and b.col == int(item["col"]))
                ]
            if raw.get("trap_active_button"):
                level.active_button = (
                    int(raw["trap_active_button"][0]),
                    int(raw["trap_active_button"][1]),
                )
            self._level = level
            self._trap_active = True
            self._trap_doom_spec = dict(raw.get("trap_doom") or {})
            # First observation is the frozen mid-package trap frame.
            self._pending_frames = [self._render_frame()]
        else:
            self._level = deepcopy(healthy)

    def _complete_trap_doom(self) -> list[list[list[int]]]:
        """Finish the inherited L5 package into the doomed stable configuration."""
        assert self._level is not None
        frames = [self._render_frame()]
        doom = self._trap_doom_spec or {}
        active_arms: set[tuple[int, int]] = set()
        if doom.get("drops"):
            for drop in doom["drops"]:
                box = str(drop["box"])
                ar, ac = int(drop["arm"][0]), int(drop["arm"][1])
                self._level.arm_holding.pop((ar, ac), None)
                dest = drop.get("dest")
                if dest:
                    self._place_box(int(dest[0]), int(dest[1]), box)  # type: ignore[arg-type]
                active_arms.add((ar, ac))
        else:
            active_arms = set(self._level.arm_holding)
            self._apply_held_drops()
            self._level.arm_holding.clear()
        self._level.active_button = None
        self._level.arm_holding.clear()
        frames.append(self._render_frame())
        frames.extend(self._arm_return_sequence(active_arms))
        frames.append(self._render_frame())
        self._trap_active = False
        self._trap_doom_spec = None
        return frames

    def _apply_held_drops(self) -> None:
        assert self._level is not None
        holding = dict(self._level.arm_holding)
        for (r, c), box in holding.items():
            arm = next((a for a in self._level.arms if a.row == r and a.col == c), None)
            if arm is None or arm.kind != "A":
                continue
            self._place_box(r + 1, c, box)

    def _place_box(self, row: int, col: int, box: BoxId) -> None:
        assert self._level is not None
        for train in self._level.trains:
            if train.row != row:
                continue
            idx = train.bay_index_at(col)
            if idx is None:
                continue
            if train.bays[idx].empty:
                train.bays[idx].box = box
            return
        self._level.free_boxes.append(FreeBox(row=row, col=col, kind=box))

    # --- click / animation -----------------------------------------------------

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        assert self._level is not None
        cell = self._cell_at(x, y)
        if cell is None:
            return None
        r, c = cell
        # Covered by a visible train tile → invalid (train, not the rail under it).
        if self._train_at(r, c) is not None:
            return None
        if (r, c) not in self._level.rails:
            return None
        target = self._select_train(r, c)
        if target is None:
            return None
        train, dest_rear = target
        if dest_rear == train.rear:
            return None
        return self._animate_move(train, dest_rear, button=(r, c))

    def _cell_at(self, x: int, y: int) -> tuple[int, int] | None:
        if not (MAP_X0 <= x < MAP_X0 + MAP and MAP_Y0 <= y < MAP_Y0 + MAP):
            return None
        return (y - MAP_Y0) // CELL, (x - MAP_X0) // CELL

    def _train_at(self, row: int, col: int) -> Train | None:
        assert self._level is not None
        for train in self._level.trains:
            if train.row == row and col in train.cols():
                return train
        return None

    def _select_train(self, row: int, col: int) -> tuple[Train, int] | None:
        """Return (train, destination rear col) or None for noop."""
        assert self._level is not None
        seg = _segment_for(self._level.rails, row, col)
        if seg is None:
            return None
        lo, hi = seg
        candidates: list[tuple[int, Train, int]] = []
        for train in self._level.trains:
            if train.row != row:
                continue
            if col in train.cols():
                continue  # button under body not clickable (already filtered) / ineligible
            # Destination rear such that left-click aligns rear on button,
            # right-click aligns front on button.
            if col < train.rear:
                dest_rear = col
            elif col > train.front:
                dest_rear = col - (train.length - 1)
            else:
                continue
            if dest_rear < lo or dest_rear + train.length - 1 > hi:
                continue
            # Collision with other trains on the path / destination.
            path_cols = set(range(min(train.rear, dest_rear), max(train.front, dest_rear + train.length - 1) + 1))
            blocked = False
            for other in self._level.trains:
                if other is train or other.row != row:
                    continue
                other_cols = set(other.cols())
                # May not traverse or overlap another train at destination.
                dest_cols = set(range(dest_rear, dest_rear + train.length))
                if dest_cols & other_cols:
                    blocked = True
                    break
                # Path between must not jump over another train: any other train
                # strictly between current and destination blocks.
                if other_cols & path_cols and not (other_cols <= set(train.cols())):
                    # Allow cells we currently occupy; block if other intersects path.
                    if other_cols & (path_cols - set(train.cols())):
                        blocked = True
                        break
            if blocked:
                continue
            dist = min(abs(col - train.rear), abs(col - train.front))
            candidates.append((dist, train, dest_rear))
        if not candidates:
            return None
        best = min(c[0] for c in candidates)
        tops = [c for c in candidates if c[0] == best]
        if len(tops) != 1:
            return None
        _, train, dest_rear = tops[0]
        return train, dest_rear

    def _animate_move(
        self, train: Train, dest_rear: int, *, button: tuple[int, int]
    ) -> list[list[list[int]]]:
        assert self._level is not None
        frames: list[list[list[int]]] = []
        self._level.active_button = button
        step = 1 if dest_rear > train.rear else -1
        while train.rear != dest_rear:
            train.rear += step
            frames.append(self._render_frame())
        # Aligned: clear active button, run transfer cycle.
        self._level.active_button = None
        frames.append(self._render_frame())  # FRAME aligned pre-transfer
        frames.extend(self._transfer_cycle())
        if self._is_solved():
            self._complete_level(frames)
        return frames

    def _plan_transfers(
        self,
    ) -> list[tuple[Arm, BoxId, tuple[int, int], tuple[int, int]]]:
        """One simultaneous snapshot: each box/arm/dest used at most once."""
        assert self._level is not None
        planned: list[tuple[Arm, BoxId, tuple[int, int], tuple[int, int]]] = []
        occupied_dest: set[tuple[str, int, int]] = set()
        taken_src: set[tuple[str, int, int]] = set()
        for arm in self._level.arms:
            src = self._arm_source_cell(arm)
            dst = self._arm_dest_cell(arm)
            if src is None or dst is None:
                continue
            box = self._box_at_snapshot(src)
            if box is None or not self._dest_is_empty_slot(dst):
                continue
            src_key = self._loc_key(src)
            dst_key = self._loc_key(dst)
            if src_key in taken_src or dst_key in occupied_dest:
                continue
            planned.append((arm, box, src, dst))
            taken_src.add(src_key)
            occupied_dest.add(dst_key)
        return planned

    def _transfer_cycle(self) -> list[list[list[int]]]:
        """Run transfer waves until no arm is newly eligible (animated chain).

        Within one wave, all eligible arms still share one snapshot. After that
        wave settles (deposit + arm return), a new snapshot may unlock the next
        hop — e.g. A loads a bay that a lower A can then empty.
        """
        assert self._level is not None
        frames: list[list[list[int]]] = []
        # Bound: one hop per arm per wave, and at most one wave per grid cell.
        max_waves = max(1, len(self._level.arms) * GRID)
        for _ in range(max_waves):
            planned = self._plan_transfers()
            if not planned:
                break
            for arm, box, src, _dst in planned:
                self._remove_box_at(src)
                self._level.arm_holding[(arm.row, arm.col)] = box
            frames.append(self._render_frame())
            for arm, box, _src, dst in planned:
                self._level.arm_holding.pop((arm.row, arm.col), None)
                self._deposit_box(dst, box)
            active = {(arm.row, arm.col) for arm, *_ in planned}
            frames.extend(self._arm_return_sequence(active))
            frames.append(self._render_frame())
        return frames

    def _arm_return_sequence(self, active: set[tuple[int, int]]) -> list[list[list[int]]]:
        assert self._level is not None
        frames: list[list[list[int]]] = []
        self._level.arm_return = {pos: 1 for pos in active}
        frames.append(self._render_frame())
        self._level.arm_return = {pos: 2 for pos in active}
        frames.append(self._render_frame())
        self._level.arm_return.clear()
        return frames

    def _arm_source_cell(self, arm: Arm) -> tuple[int, int] | None:
        if arm.kind == "A":
            return arm.row - 1, arm.col
        return arm.row + 1, arm.col

    def _arm_dest_cell(self, arm: Arm) -> tuple[int, int] | None:
        if arm.kind == "A":
            return arm.row + 1, arm.col
        return arm.row - 1, arm.col

    def _loc_key(self, cell: tuple[int, int]) -> tuple[str, int, int]:
        r, c = cell
        train = self._train_at(r, c)
        if train is not None:
            return ("bay", train.row, c)
        return ("free", r, c)

    def _box_at_snapshot(self, cell: tuple[int, int]) -> BoxId | None:
        assert self._level is not None
        r, c = cell
        train = self._train_at(r, c)
        if train is not None:
            idx = train.bay_index_at(c)
            if idx is None:
                return None
            return train.bays[idx].box
        for fb in self._level.free_boxes:
            if fb.row == r and fb.col == c:
                return fb.kind
        return None

    def _dest_is_empty_slot(self, cell: tuple[int, int]) -> bool:
        assert self._level is not None
        r, c = cell
        train = self._train_at(r, c)
        if train is None:
            return False
        idx = train.bay_index_at(c)
        if idx is None:
            return False
        return train.bays[idx].empty

    def _remove_box_at(self, cell: tuple[int, int]) -> None:
        assert self._level is not None
        r, c = cell
        train = self._train_at(r, c)
        if train is not None:
            idx = train.bay_index_at(c)
            if idx is not None:
                train.bays[idx].box = None
            return
        self._level.free_boxes = [
            b for b in self._level.free_boxes if not (b.row == r and b.col == c)
        ]

    def _deposit_box(self, cell: tuple[int, int], box: BoxId) -> None:
        assert self._level is not None
        r, c = cell
        train = self._train_at(r, c)
        if train is None:
            return
        idx = train.bay_index_at(c)
        if idx is None:
            return
        train.bays[idx].box = box

    # --- win -------------------------------------------------------------------

    def _is_solved(self) -> bool:
        assert self._level is not None
        typed = [bay for train in self._level.trains for bay in train.bays if bay.slot]
        if not typed:
            return False
        return all(bay.box == bay.slot for bay in typed)

    def _complete_level(self, frames: list[list[list[int]]]) -> None:
        base = self._render_frame()
        for _ in range(2):
            frames.append(self._tint(base, C_GREEN))
            frames.append([row[:] for row in base])
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            frames.append(self._render_frame())
            return
        self._begin_level(self.levels_completed, entry_trap=True)
        if self._pending_frames:
            frames.extend(self._pending_frames)
            self._pending_frames = None
        else:
            frames.append(self._render_frame())

    @staticmethod
    def _tint(frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(PLAY_H):
            for x in range(FRAME):
                if out[y][x] not in (C_BLACK, C_VDGREY):
                    out[y][x] = color
        return out

    # --- render ----------------------------------------------------------------

    def _render_frame(self) -> list[list[int]]:
        assert self._level is not None
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level

        # Rails first.
        for r, c in lv.rails:
            tile = TILE_RAIL_ACTIVE if lv.active_button == (r, c) else TILE_RAIL
            # Active button still drawn even under where train will leave.
            if self._train_at(r, c) is None or lv.active_button == (r, c):
                if self._train_at(r, c) is None:
                    self._blit(frame, r, c, tile)
                elif lv.active_button == (r, c):
                    # Should not happen: active is outside body. Keep safe.
                    self._blit(frame, r, c, tile)

        # Free boxes (sources).
        held_cells = set(lv.arm_holding)
        for fb in lv.free_boxes:
            if (fb.row, fb.col) in held_cells:
                continue
            self._blit(frame, fb.row, fb.col, TILE_BOX[fb.kind])

        # Arms (may be overwritten by holding / return sprites).
        for arm in lv.arms:
            pos = (arm.row, arm.col)
            if pos in lv.arm_holding:
                self._blit(frame, arm.row, arm.col, TILE_BOX[lv.arm_holding[pos]])
                continue
            ret = lv.arm_return.get(pos)
            if ret == 1:
                tile = TILE_ARM_A_RET1 if arm.kind == "A" else TILE_ARM_V_RET1
            elif ret == 2:
                tile = TILE_ARM_A_RET2 if arm.kind == "A" else TILE_ARM_V_RET2
            else:
                tile = TILE_ARM_A if arm.kind == "A" else TILE_ARM_V
            self._blit(frame, arm.row, arm.col, tile)

        # Trains on top of rails.
        for train in lv.trains:
            self._blit(frame, train.row, train.rear, TILE_TRAIN_REAR)
            self._blit(frame, train.row, train.front, TILE_TRAIN_FRONT)
            for i, bay in enumerate(train.bays):
                col = train.bay_col(i)
                if bay.box is None:
                    if bay.slot is None:
                        self._blit(frame, train.row, col, TILE_BAY)
                    else:
                        self._blit(frame, train.row, col, TILE_SLOT[bay.slot])
                elif bay.mismatched:
                    self._blit(frame, train.row, col, TILE_BOX_RED[bay.box])
                else:
                    self._blit(frame, train.row, col, TILE_BOX[bay.box])

        # Active button above everything except we already skipped under trains.
        if lv.active_button is not None:
            br, bc = lv.active_button
            if self._train_at(br, bc) is None:
                self._blit(frame, br, bc, TILE_RAIL_ACTIVE)

        self._draw_hud(frame)
        return frame

    def _blit(self, frame: list[list[int]], row: int, col: int, tile: tuple[tuple[int, ...], ...]) -> None:
        y0 = MAP_Y0 + row * CELL
        x0 = MAP_X0 + col * CELL
        for dy, line in enumerate(tile):
            yy = y0 + dy
            if yy < 0 or yy >= PLAY_H:
                continue
            for dx, color in enumerate(line):
                xx = x0 + dx
                if 0 <= xx < FRAME:
                    frame[yy][xx] = color

    def _draw_hud(self, frame: list[list[int]]) -> None:
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_VDGREY
        # Level pips
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

    # --- public ----------------------------------------------------------------

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        frame = frames[-1]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION6", "ACTION7"]
        if self._trap_active:
            # RESET is the only productive action; other inputs finish the doom package.
            available = ["ACTION6", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        multi = len(frames) > 1
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "transition_frame_interval_ms": 80 if multi else None,
            "default_fps": max(self.info.default_fps, 12 if multi else self.info.default_fps),
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
            "level_name": getattr(self, "_level_name", ""),
            "grid": GRID,
            "cell": CELL,
        }

    # Test helpers --------------------------------------------------------------

    def click_cell(self, row: int, col: int) -> dict[str, Any]:
        x = MAP_X0 + col * CELL + CELL // 2
        y = MAP_Y0 + row * CELL + CELL // 2
        return self.action(ACTION_CLICK, {"x": x, "y": y})

    def ascii_snapshot(self) -> list[str]:
        assert self._level is not None
        grid = [[" " for _ in range(GRID)] for _ in range(GRID)]
        for r, c in self._level.rails:
            grid[r][c] = "="
        if self._level.active_button is not None:
            br, bc = self._level.active_button
            grid[br][bc] = "#"
        for fb in self._level.free_boxes:
            grid[fb.row][fb.col] = fb.kind
        for arm in self._level.arms:
            pos = (arm.row, arm.col)
            if pos in self._level.arm_holding:
                grid[arm.row][arm.col] = self._level.arm_holding[pos]
            else:
                grid[arm.row][arm.col] = arm.kind
        for train in self._level.trains:
            grid[train.row][train.rear] = "["
            grid[train.row][train.front] = "]"
            for i, bay in enumerate(train.bays):
                col = train.bay_col(i)
                if bay.box:
                    grid[train.row][col] = bay.box
                elif bay.slot:
                    grid[train.row][col] = bay.slot.lower()
                else:
                    grid[train.row][col] = "o"
        return ["".join(row) for row in grid]
