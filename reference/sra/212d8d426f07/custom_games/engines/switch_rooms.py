"""SWCH — multi-piece rooms with wall-mounted push switches, doors, battery.

Controls: ACTION1–4 only. ACTION7 level reset.
  - Move into a switch cell → toggle (player does not enter the cell).
  - Floor: dark grey when lit, black when unlit (always walkable for that piece).
  - Walls: piece color when lit, black when unlit; never walkable; rendered ≥4px.
  - Doors: exactly one cell; A+grey+B when closed & lit side; open = walkable dark grey.
  - Battery pips yellow when free; entire battery red when fully used.
  - Magenta action gauge: limited moves; optional magenta refills on the floor.
  - Switch art: always 1 socle + exactly 3 identity bands perpendicular to socle
    (OFF: SSSSS/PYP../PYP../PYP.. · ON: SSSSS/..PYP/..PYP/..PYP) at any cell size.
  - Action pool empty → red flash frames then soft level reset (not permanent game over).
  - No shared walls between pieces (void gap).
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

# ARC-AGI-3 UI palette
C_BG = 5  # pure black outside all pieces
C_FLOOR_LIT = 4  # traversable floor when light ON (dark grey)
C_BLACK = 5
C_GREY = 3
C_WHITE = 0
C_RED = 8
C_YELLOW = 11
C_MAGENTA = 6  # action resource + refills
C_HUD = 4
C_HUD_DONE = 14
C_HUD_SLOT = 3

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_RESET = 7

FRAME = 64
# Switch pattern: 5 parallel slots (SSSSS / PYP.. / ..PYP) × 4 depth bands.
MIN_CELL = 5
SWITCH_PARALLEL_SLOTS = 5  # SSSSS width; OFF=PYP.. ON=..PYP
SWITCH_DEPTH_BANDS = 4  # 1 socle + 3 identity lines
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "switch_rooms" / "levels"
REFILL_GLYPH = "m"

# Walls: only green / blue / pink / cyan / purple (no black, red, yellow, grey).
DEFAULT_PIECE_COLORS = {
    "G": 14,  # green
    "B": 9,   # blue
    "P": 7,   # pink
    "C": 10,  # cyan
    "V": 15,  # purple
}
FORBIDDEN_WALL_COLORS = {0, 1, 2, 3, 4, 5, 8, 11}  # white, greys, black, red, yellow

# facing = direction from switch cell toward attached wall
DIRS = {
    "N": (-1, 0),
    "S": (1, 0),
    "W": (0, -1),
    "E": (0, 1),
}
OPP = {"N": "S", "S": "N", "W": "E", "E": "W"}


@dataclass
class LightSwitch:
    pos: tuple[int, int]
    piece_id: str
    facing: str  # toward wall


@dataclass
class Door:
    door_id: str
    cell: tuple[int, int]  # exactly one cell
    piece_a: str
    piece_b: str
    open: bool = False


@dataclass
class DoorSwitch:
    pos: tuple[int, int]
    door_id: str
    facing: str


@dataclass
class LevelState:
    name: str
    width: int
    height: int
    max_steps: int  # initial magenta action budget
    battery_max: int
    player: tuple[int, int]
    player_color: int
    exit_pos: tuple[int, int]
    floor: dict[tuple[int, int], str]
    walls: dict[tuple[int, int], str]
    piece_colors: dict[str, int]
    lights_on: dict[str, bool]
    light_switches: list[LightSwitch]
    doors: dict[str, Door]
    door_switches: list[DoorSwitch]
    refills: dict[tuple[int, int], int] = field(default_factory=dict)
    refill_amount_default: int = 8
    action_pool_cap: int = 0  # max_steps + all refills (HUD scale)


def _infer_facing(pos: tuple[int, int], walls: dict[tuple[int, int], str]) -> str:
    r, c = pos
    for name, (dr, dc) in DIRS.items():
        if (r + dr, c + dc) in walls:
            return name
    return "N"


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    width = int(data["width"])
    height = int(data["height"])
    grid = data["grid"]
    if len(grid) != height or any(len(row) != width for row in grid):
        raise ValueError(f"grid size mismatch in {path}")
    # Keep whole board on the 64×64 frame at MIN_CELL (HUD 5px).
    max_w = FRAME // MIN_CELL
    max_h = (FRAME - 5) // MIN_CELL
    if width > max_w or height > max_h:
        raise ValueError(
            f"level {path.name} is {width}x{height} but max on-screen at "
            f"MIN_CELL={MIN_CELL} is {max_w}x{max_h}"
        )

    piece_colors = dict(DEFAULT_PIECE_COLORS)
    piece_colors.update({k: int(v) for k, v in data.get("piece_colors", {}).items()})
    for pid, col in piece_colors.items():
        if int(col) in FORBIDDEN_WALL_COLORS:
            raise ValueError(
                f"piece {pid} wall color {col} forbidden "
                f"(allowed: green/blue/pink/cyan/purple)"
            )

    lights_on = {pid: False for pid in piece_colors}
    for pid, on in data.get("lights_on", {}).items():
        lights_on[str(pid)] = bool(on)

    floor: dict[tuple[int, int], str] = {}
    walls: dict[tuple[int, int], str] = {}
    player: tuple[int, int] | None = None
    exit_pos: tuple[int, int] | None = None
    light_map: dict[str, str] = {str(k): str(v) for k, v in data.get("light_map", {}).items()}
    door_sw_map: dict[str, str] = {
        str(k): str(v) for k, v in data.get("door_switch_map", {}).items()
    }
    # Switch glyphs must not reuse a floor letter of a piece declared in this level.
    level_piece_ids = set(data.get("piece_colors", {}).keys()) or set(DEFAULT_PIECE_COLORS)
    floor_letters = {pid.lower() for pid in level_piece_ids}
    for label, mapping in (("light_map", light_map), ("door_switch_map", door_sw_map)):
        for key in mapping:
            if key in floor_letters:
                raise ValueError(
                    f"{label} key {key!r} collides with piece floor letter "
                    f"in {path} (level pieces: {sorted(level_piece_ids)})"
                )
    door_defs: dict[str, dict[str, Any]] = {
        str(k): v for k, v in data.get("doors", {}).items()
    }
    door_cells: dict[str, list[tuple[int, int]]] = {did: [] for did in door_defs}
    light_pos: list[tuple[tuple[int, int], str]] = []
    door_sw_pos: list[tuple[tuple[int, int], str]] = []
    refill_pending: list[tuple[int, int]] = []
    refill_amount_default = int(data.get("refill_amount", 8))
    if REFILL_GLYPH in floor_letters or REFILL_GLYPH in light_map or REFILL_GLYPH in door_sw_map:
        raise ValueError(f"refill glyph {REFILL_GLYPH!r} collides with level glyphs in {path}")

    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            pos = (r, c)
            if ch == "@":
                player = pos
            elif ch == "E":
                # Only the last E is the true exit; earlier E cells become floor of exit_piece later.
                # Mark as floor immediately so enclosure is valid (piece from surrounding context).
                exit_pos = pos
            elif ch == REFILL_GLYPH:
                refill_pending.append(pos)
            elif ch in piece_colors and ch.isupper():
                walls[pos] = ch
            elif ch.islower() and ch.upper() in piece_colors and ch not in light_map and ch not in door_sw_map:
                floor[pos] = ch.upper()
            elif ch in light_map:
                light_pos.append((pos, light_map[ch]))
            elif ch in door_sw_map:
                door_sw_pos.append((pos, door_sw_map[ch]))
            elif ch in door_defs:
                door_cells[ch].append(pos)
            elif ch in (".", " ", "-"):
                pass
            else:
                raise ValueError(f"bad cell {ch!r} in {path} at {r},{c}")

    start_piece = str(data.get("start_piece", "R"))
    if player is None:
        raise ValueError(f"no player in {path}")
    if exit_pos is None:
        raise ValueError(f"no exit in {path}")
    if player not in floor:
        floor[player] = start_piece
    exit_piece = str(data.get("exit_piece", start_piece))
    if exit_pos not in floor:
        floor[exit_pos] = exit_piece

    def _host_piece_near(pos: tuple[int, int]) -> str:
        r, c = pos
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = (r + dr, c + dc)
            if nb in floor:
                return floor[nb]
            if nb in walls:
                return walls[nb]
        return start_piece

    refills: dict[tuple[int, int], int] = {}
    for pos in refill_pending:
        floor[pos] = _host_piece_near(pos)
        refills[pos] = refill_amount_default

    # Switches are non-walkable; facing toward wall (explicit or inferred)
    facing_override = data.get("switch_facing", {})
    light_switches: list[LightSwitch] = []
    for pos, pid in light_pos:
        key = f"{pos[0]},{pos[1]}"
        facing = str(facing_override.get(key) or _infer_facing(pos, walls))
        light_switches.append(LightSwitch(pos=pos, piece_id=pid, facing=facing))

    door_switches: list[DoorSwitch] = []
    for pos, did in door_sw_pos:
        key = f"{pos[0]},{pos[1]}"
        facing = str(facing_override.get(key) or _infer_facing(pos, walls))
        door_switches.append(DoorSwitch(pos=pos, door_id=did, facing=facing))

    doors: dict[str, Door] = {}
    for did, meta in door_defs.items():
        cells = door_cells.get(did, [])
        if not cells:
            cells = [tuple(x) for x in meta.get("cells", [])]
        if len(cells) != 1:
            raise ValueError(f"door {did} must be exactly 1 cell, got {cells} in {path}")
        doors[did] = Door(
            door_id=did,
            cell=cells[0],
            piece_a=str(meta["piece_a"]),
            piece_b=str(meta["piece_b"]),
            open=bool(meta.get("open", False)),
        )

    # Restrict piece_colors / lights to pieces that appear
    used = set(floor.values()) | set(walls.values())
    for d in doors.values():
        used.add(d.piece_a)
        used.add(d.piece_b)
    piece_colors = {k: v for k, v in piece_colors.items() if k in used}
    lights_on = {k: lights_on.get(k, False) for k in piece_colors}

    # Every switch must be glued to a wall on its facing side (not free-floating in floor).
    def _assert_wall_mount(pos: tuple[int, int], facing: str, label: str) -> None:
        dr, dc = DIRS[facing]
        wp = (pos[0] + dr, pos[1] + dc)
        if wp not in walls:
            raise ValueError(
                f"{label} at {pos} facing {facing} is not stuck to a wall "
                f"(neighbour {wp} is not a wall) in {path}"
            )

    for ls in light_switches:
        _assert_wall_mount(ls.pos, ls.facing, f"light switch {ls.piece_id}")
    for ds in door_switches:
        _assert_wall_mount(ds.pos, ds.facing, f"door switch {ds.door_id}")

    # Each piece must be fully wall-enclosed: floor never touches exterior void.
    sealed: set[tuple[int, int]] = set(floor) | set(walls)
    sealed.update(d.cell for d in doors.values())
    sealed.update(ls.pos for ls in light_switches)
    sealed.update(ds.pos for ds in door_switches)
    for pos, pid in floor.items():
        r, c = pos
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nb = (r + dr, c + dc)
            if nb not in sealed:
                raise ValueError(
                    f"piece {pid} floor {pos} touches exterior {nb} "
                    f"(room must be fully enclosed by walls) in {path}"
                )

    return LevelState(
        name=str(data.get("name") or path.stem),
        width=width,
        height=height,
        max_steps=int(data.get("max_steps", 30)),
        battery_max=int(data["battery"]),
        player=player,
        player_color=int(data.get("player_color", 10)),
        exit_pos=exit_pos,
        floor=floor,
        walls=walls,
        piece_colors=piece_colors,
        lights_on=lights_on,
        light_switches=light_switches,
        doors=doors,
        door_switches=door_switches,
        refills=refills,
        refill_amount_default=refill_amount_default,
        action_pool_cap=int(data.get("max_steps", 30)) + sum(refills.values()),
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


class SwitchRoomsEngine:
    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_all_levels()
        if len(self._templates) < info.levels:
            raise ValueError(f"expected {info.levels} levels, found {len(self._templates)}")
        self.win_levels = int(info.levels)
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.actions_left = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = deepcopy(self._templates[0])
        self._begin_level_resources()

    def _begin_level_resources(self) -> None:
        """Magenta action pool restarts with each level load/reset."""
        self.actions_left = int(self._level.max_steps)
        self.level_steps = 0

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = deepcopy(self._templates[0])
        self._begin_level_resources()
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self._begin_level_resources()
        self.last_action = "ACTION7"
        self._pending_frames = None
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def _soft_reset_level_state(self) -> None:
        """Restore current level to its initial template (position, lights, doors, refills)."""
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self._begin_level_resources()
        if self.state != "WIN":
            self.state = "NOT_FINISHED"

    def _red_flash_then_reset_frames(self) -> list[list[list[int]]]:
        """Build red flash animation frames, then restore level and append reset frame."""
        pre = self._render_frame()
        frames: list[list[list[int]]] = []
        # Alternate full-playfield red wash / original (3 flashes)
        for i in range(6):
            if i % 2 == 0:
                flash = [row[:] for row in pre]
                for y in range(FRAME - 5):
                    for x in range(FRAME):
                        flash[y][x] = C_RED
                frames.append(flash)
            else:
                frames.append([row[:] for row in pre])
        self._soft_reset_level_state()
        frames.append(self._render_frame())
        return frames

    def _battery_used(self) -> int:
        # Only lights consume battery permanently. Door toggles require free > 0
        # but do not hold a charge (optional flash is visual-only / instantaneous).
        return sum(1 for on in self._level.lights_on.values() if on)

    def _battery_free(self) -> int:
        return max(0, self._level.battery_max - self._battery_used())

    def _switch_at(self, pos: tuple[int, int]) -> tuple[str, Any] | None:
        for ls in self._level.light_switches:
            if ls.pos == pos:
                return ("light", ls)
        for ds in self._level.door_switches:
            if ds.pos == pos:
                return ("door", ds)
        return None

    def _blocked_move(self, pos: tuple[int, int]) -> bool:
        """True if player cannot enter this cell (walls, closed door, void, switches)."""
        if self._switch_at(pos) is not None:
            return True  # non-traversable; handled as push separately
        if pos in self._level.walls:
            return True
        for door in self._level.doors.values():
            if pos == door.cell:
                return not door.open
        if pos in self._level.floor:
            return False
        return True

    def _toggle_light(self, ls: LightSwitch) -> None:
        on = self._level.lights_on.get(ls.piece_id, False)
        if on:
            self._level.lights_on[ls.piece_id] = False
        elif self._battery_free() >= 1:
            self._level.lights_on[ls.piece_id] = True

    def _toggle_door(self, ds: DoorSwitch) -> None:
        """Open or close requires free battery > 0; does not consume a charge."""
        door = self._level.doors.get(ds.door_id)
        if door is None:
            return
        if self._battery_free() < 1:
            return
        door.open = not door.open

    def _can_energize_light(self, ls: LightSwitch) -> bool:
        if self._level.lights_on.get(ls.piece_id, False):
            return True  # currently using energy
        return self._battery_free() >= 1

    def _can_energize_door(self, ds: DoorSwitch) -> bool:
        """Socle white only if free battery available (needed for open AND close)."""
        return self._battery_free() >= 1

    def _collect_refill_if_any(self) -> None:
        pos = self._level.player
        amt = self._level.refills.pop(pos, 0)
        if amt:
            # Never exceed the level's declared max action pool (bar capacity).
            cap = max(
                int(self._level.action_pool_cap or self._level.max_steps),
                int(self._level.max_steps),
            )
            self.actions_left = min(cap, self.actions_left + int(amt))

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        if aid not in (ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT):
            return self.public_state()
        if self.actions_left <= 0:
            # Safety: empty pool → flash + soft reset (never permanent game-over)
            self._pending_frames = self._red_flash_then_reset_frames()
            self.last_action = f"ACTION{aid}"
            return self.public_state()

        self.last_action = f"ACTION{aid}"
        self.step_index += 1
        self.level_steps += 1
        self.actions_left -= 1

        dr, dc = {
            ACTION_UP: (-1, 0),
            ACTION_DOWN: (1, 0),
            ACTION_LEFT: (0, -1),
            ACTION_RIGHT: (0, 1),
        }[aid]
        pr, pc = self._level.player
        nxt = (pr + dr, pc + dc)

        if 0 <= nxt[0] < self._level.height and 0 <= nxt[1] < self._level.width:
            sw = self._switch_at(nxt)
            if sw is not None:
                # Push switch: toggle, do not move
                kind, obj = sw
                if kind == "light":
                    self._toggle_light(obj)
                else:
                    self._toggle_door(obj)
            elif not self._blocked_move(nxt):
                self._level.player = nxt
                self._collect_refill_if_any()

        if self._level.player == self._level.exit_pos:
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = deepcopy(self._templates[self.levels_completed])
                self._begin_level_resources()
                self.state = "NOT_FINISHED"
        elif self.actions_left <= 0:
            # Exhausted magenta actions: red flash animation then full level soft-reset
            self._pending_frames = self._red_flash_then_reset_frames()

        return self.public_state()

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
            frame = frames[-1]
        else:
            frame = self._render_frame()
            frames = [frame]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        # Slightly higher fps when multi-frame flash is returned
        fps = self.info.default_fps
        if len(frames) > 1:
            fps = max(fps, 8)
        return {
            "backend": "custom",
            "selected": True,
            "game_id": self.info.game_id,
            "title": self.info.title,
            "frame": frame,
            "frames": frames,
            "frame_count": len(frames),
            "default_fps": fps,
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
            "actions_left": self.actions_left,
            "actions_max": self._level.max_steps,
            "actions_pool_cap": self._level.action_pool_cap,
            "battery": self._battery_free(),
            "battery_max": self._level.battery_max,
            "battery_used": self._battery_used(),
            "lights_on": dict(self._level.lights_on),
            "doors_open": {d: door.open for d, door in self._level.doors.items()},
            "refills_left": len(self._level.refills),
        }

    def _piece_lit(self, piece_id: str) -> bool:
        return bool(self._level.lights_on.get(piece_id, False))

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        hud_h = 5
        play_h = FRAME - hud_h
        # Never below MIN_CELL (switch art needs ≥5 px for SSSSS / PYP..). Prefer fit.
        fit = min(play_h // max(1, lv.height), FRAME // max(1, lv.width))
        cell = max(MIN_CELL, fit) if fit >= MIN_CELL else MIN_CELL
        board_w = cell * lv.width
        board_h = cell * lv.height
        r0 = max(0, (play_h - board_h) // 2)
        c0 = max(0, (FRAME - board_w) // 2)

        def cell_rect(gr: int, gc: int) -> tuple[int, int, int, int]:
            y0 = r0 + gr * cell
            x0 = c0 + gc * cell
            y1 = min(FRAME - hud_h, y0 + cell)
            x1 = min(FRAME, x0 + cell)
            return y0, x0, y1, x1

        def fill_cell(gr: int, gc: int, color: int) -> None:
            y0, x0, y1, x1 = cell_rect(gr, gc)
            for y in range(y0, y1):
                for x in range(x0, x1):
                    frame[y][x] = color

        def fill_cell_stripes(
            gr: int, gc: int, colors: list[int], *, horizontal: bool = False
        ) -> None:
            """A|grey|B stripes. horizontal=True → bands top→bottom (door crossed N/S)."""
            y0, x0, y1, x1 = cell_rect(gr, gc)
            n = max(1, len(colors))
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if horizontal:
                        band = min(n - 1, (y - y0) * n // max(1, y1 - y0))
                    else:
                        band = min(n - 1, (x - x0) * n // max(1, x1 - x0))
                    frame[y][x] = colors[band]

        def door_is_vertical_passage(door: Door) -> bool:
            """True if the door is crossed up/down (needs 90° / horizontal stripe display)."""
            r, c = door.cell
            ns = 0
            ew = 0
            for dr, dc, is_ns in (
                (-1, 0, True),
                (1, 0, True),
                (0, -1, False),
                (0, 1, False),
            ):
                nb = (r + dr, c + dc)
                if nb in lv.floor or nb in lv.walls or any(
                    d.cell == nb for d in lv.doors.values()
                ):
                    if is_ns:
                        ns += 1
                    else:
                        ew += 1
            # Prefer axis with more solid neighbours; tie → N/S if either side is floor
            n_floor = (r - 1, c) in lv.floor
            s_floor = (r + 1, c) in lv.floor
            if n_floor or s_floor:
                return True
            w_floor = (r, c - 1) in lv.floor
            e_floor = (r, c + 1) in lv.floor
            if w_floor or e_floor:
                return False
            return ns >= ew

        def set_px(y: int, x: int, color: int) -> None:
            if 0 <= y < FRAME - hud_h and 0 <= x < FRAME:
                frame[y][x] = color

        # Floors: dark grey if lit, black if unlit
        for (r, c), pid in lv.floor.items():
            fill_cell(r, c, C_FLOOR_LIT if self._piece_lit(pid) else C_BLACK)

        # Magenta action refills (walkable pickups)
        for (r, c) in lv.refills:
            y0, x0, y1, x1 = cell_rect(r, c)
            for y in range(y0, y1):
                for x in range(x0, x1):
                    # solid magenta gem inset
                    if y0 + 1 <= y < y1 - 1 and x0 + 1 <= x < x1 - 1:
                        frame[y][x] = C_MAGENTA

        # Open doors: walkable dark grey (lit corridor) or black if both sides dark
        for door in lv.doors.values():
            if door.open:
                r, c = door.cell
                if self._piece_lit(door.piece_a) or self._piece_lit(door.piece_b):
                    fill_cell(r, c, C_FLOOR_LIT)
                else:
                    fill_cell(r, c, C_BLACK)

        # Walls: piece colour when lit; black when that piece's light is off.
        for (r, c), pid in lv.walls.items():
            col = lv.piece_colors[pid] if self._piece_lit(pid) else C_BLACK
            fill_cell(r, c, col)

        # Closed doors: A+grey+B (mid always grey).
        # Vertical passage (N/S) → horizontal bands (90°); horizontal passage → vertical bands.
        for door in lv.doors.values():
            if not door.open:
                r, c = door.cell
                ca = lv.piece_colors[door.piece_a]
                cb = lv.piece_colors[door.piece_b]
                ca_d = ca if self._piece_lit(door.piece_a) else C_BLACK
                cb_d = cb if self._piece_lit(door.piece_b) else C_BLACK
                # piece_a toward N/W side, piece_b toward S/E for consistent orientation
                horiz = door_is_vertical_passage(door)
                if horiz:
                    # Top = piece above door if known, else piece_a
                    above = lv.floor.get((r - 1, c)) or lv.walls.get((r - 1, c))
                    if above == door.piece_b:
                        top, bot = cb_d, ca_d
                    else:
                        top, bot = ca_d, cb_d
                    fill_cell_stripes(r, c, [top, C_GREY, bot], horizontal=True)
                else:
                    left_p = lv.floor.get((r, c - 1)) or lv.walls.get((r, c - 1))
                    if left_p == door.piece_b:
                        left, right = cb_d, ca_d
                    else:
                        left, right = ca_d, cb_d
                    fill_cell_stripes(r, c, [left, C_GREY, right], horizontal=False)

        # Switches: OFF = stripes left + transparent right; ON = transparent left + stripes right.
        # Light: piece-yellow-piece. Door: A-grey-B (mid always grey).
        for ls in lv.light_switches:
            r, c = ls.pos
            pc = lv.piece_colors.get(ls.piece_id, C_YELLOW)
            on = self._piece_lit(ls.piece_id)
            socle_ok = self._can_energize_light(ls)
            floor_col = self._switch_host_floor_color(r, c)
            self._draw_switch(
                frame,
                r0,
                c0,
                cell,
                r,
                c,
                ls.facing,
                socle_ok,
                identity_colors=[pc, C_YELLOW, pc],
                floor_color=floor_col,
                active=on,
            )

        for ds in lv.door_switches:
            r, c = ds.pos
            door = lv.doors[ds.door_id]
            ca = lv.piece_colors.get(door.piece_a, C_GREY)
            cb = lv.piece_colors.get(door.piece_b, C_GREY)
            on = door.open
            socle_ok = self._can_energize_door(ds)
            floor_col = self._switch_host_floor_color(r, c)
            self._draw_switch(
                frame,
                r0,
                c0,
                cell,
                r,
                c,
                ds.facing,
                socle_ok,
                identity_colors=[ca, C_GREY, cb],
                floor_color=floor_col,
                active=on,
            )

        # Exit hollow outline (player color)
        er, ec = lv.exit_pos
        y0, x0, y1, x1 = cell_rect(er, ec)
        for y in range(y0, y1):
            for x in range(x0, x1):
                if y == y0 or x == x0 or y == y1 - 1 or x == x1 - 1:
                    frame[y][x] = lv.player_color

        # Player
        pr, pc = lv.player
        y0, x0, y1, x1 = cell_rect(pr, pc)
        for y in range(y0, y1):
            for x in range(x0, x1):
                frame[y][x] = lv.player_color
        cy = (y0 + y1) // 2
        cx = (x0 + x1) // 2
        set_px(cy, cx, C_BLACK)

        # HUD: levels | magenta action gauge (1px per action) | yellow battery
        for i in range(FRAME):
            for h in range(hud_h):
                frame[FRAME - hud_h + h][i] = C_HUD
        # Level progress (compact left)
        slot_w = max(2, 14 // self.win_levels)
        for i in range(self.win_levels):
            x0 = 1 + i * slot_w
            filled = i < self.levels_completed
            for x in range(x0, min(15, x0 + slot_w - 1)):
                for h in range(1, hud_h - 1):
                    frame[FRAME - hud_h + h][x] = C_HUD_DONE if filled else C_HUD_SLOT

        # Magenta action bar: quantum is always exactly 1 pixel per action unit.
        # Track length = full pool (start + all refills); fill = actions remaining.
        act_cap = max(1, int(lv.action_pool_cap or lv.max_steps))
        act_left = max(0, int(self.actions_left))
        bat_reserve = 2 + max(2, lv.battery_max) * 3  # room for battery pips on the right
        bar_x0 = 16
        bar_max_x = max(bar_x0, FRAME - bat_reserve)
        for i in range(act_cap):
            x = bar_x0 + i  # 1 action ↔ 1 horizontal pixel
            if x >= bar_max_x:
                break
            col = C_MAGENTA if i < act_left else C_GREY
            for h in range(1, hud_h - 1):
                frame[FRAME - hud_h + h][x] = col

        # Battery pips (right of action bar)
        free = self._battery_free()
        total = lv.battery_max
        fully_used = free == 0 and total > 0
        pip_w = 3
        base_x = min(FRAME - 1 - max(1, total) * pip_w, bar_x0 + min(act_cap, bar_max_x - bar_x0) + 2)
        base_x = max(base_x, bar_max_x)
        for i in range(total):
            x0 = base_x + i * pip_w
            if fully_used:
                col = C_RED
            elif i < free:
                col = C_YELLOW
            else:
                col = C_GREY
            for x in range(x0, min(FRAME - 1, x0 + pip_w - 1)):
                for h in range(1, hud_h - 1):
                    frame[FRAME - hud_h + h][x] = col
        return frame

    def _switch_host_floor_color(self, r: int, c: int) -> int:
        """Floor colour under transparent switch pixels (host room light)."""
        lv = self._level
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            pid = lv.floor.get((r + dr, c + dc))
            if pid is not None:
                return C_FLOOR_LIT if self._piece_lit(pid) else C_BLACK
        # fall back: wall neighbour's piece
        for dr, dc in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            pid = lv.walls.get((r + dr, c + dc))
            if pid is not None:
                return C_FLOOR_LIT if self._piece_lit(pid) else C_BLACK
        return C_BLACK

    def _draw_switch(
        self,
        frame: list[list[int]],
        r0: int,
        c0: int,
        cell: int,
        gr: int,
        gc: int,
        facing: str,
        socle_ok: bool,
        identity_colors: list[int],
        floor_color: int,
        active: bool,
    ) -> None:
        """Wall switch: always 1 socle band + exactly 3 identity bands.

        Grand format (scales with cell; slot counts never change):
          OFF:  SSSSS
                PYP..
                PYP..
                PYP..
          ON:   SSSSS
                ..PYP
                ..PYP
                ..PYP

        Light: P=piece, Y=yellow, P=piece. Door: A-grey-B (same 3+2 layout).
        '.' = host floor colour. facing = toward wall.
        Depth (⊥ socle) = 4 bands. Parallel (// socle) = 5 slots.
        """
        y0 = r0 + gr * cell
        x0 = c0 + gc * cell
        y1 = min(FRAME - 5, y0 + cell)
        x1 = min(FRAME, x0 + cell)
        w = max(1, x1 - x0)
        h = max(1, y1 - y0)
        socle_col = C_WHITE if socle_ok else C_RED
        ids = list(identity_colors) if identity_colors else [C_GREY]
        while len(ids) < 3:
            ids.append(ids[-1])
        ids = ids[:3]
        n_par = SWITCH_PARALLEL_SLOTS  # 5
        n_dep = SWITCH_DEPTH_BANDS  # 4

        def px(y: int, x: int, col: int) -> None:
            if 0 <= y < FRAME - 5 and 0 <= x < FRAME:
                frame[y][x] = col

        def parallel_color(i: int, n: int) -> int:
            """Along socle: OFF=P Y P . .  |  ON=. . P Y P (always 5 slots)."""
            if n <= 0:
                return floor_color
            slot = min(n_par - 1, (i * n_par) // n)
            if active:
                # ..PYP → slots 0,1 floor; 2,3,4 = ids
                if slot < 2:
                    return floor_color
                return ids[slot - 2]
            # PYP.. → slots 0,1,2 = ids; 3,4 floor
            if slot >= 3:
                return floor_color
            return ids[slot]

        # Fill host floor first
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                px(y, x, floor_color)

        # Depth axis = perpendicular to socle → exactly 4 bands (socle + 3 lines).
        # Parallel axis = along socle → 5-slot identity/transparent pattern.
        if facing in ("N", "S"):
            depth, parallel = h, w
        else:
            depth, parallel = w, h

        for d in range(depth):
            band = min(n_dep - 1, (d * n_dep) // max(1, depth))  # 0=socle, 1..3=lines
            for p in range(parallel):
                if band == 0:
                    col = socle_col
                else:
                    col = parallel_color(p, parallel)
                if facing == "N":
                    px(y0 + d, x0 + p, col)
                elif facing == "S":
                    px(y0 + h - 1 - d, x0 + p, col)
                elif facing == "W":
                    px(y0 + p, x0 + d, col)
                else:  # E
                    px(y0 + p, x0 + w - 1 - d, col)
