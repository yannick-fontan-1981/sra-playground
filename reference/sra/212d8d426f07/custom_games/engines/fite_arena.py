"""FITE — turn-based arena survival with colour kits.

Controls:
  ACTION1–4  move (up to kit move range); power fires automatically after the
             last step (no SPACE). Bumping an adjacent entity fires the power;
             walls and edges remain ineffective.
  ACTION7    soft reset

Enemies never die — they shove / freeze / magnet / electrocute each other and
always aggro the nearest living entity (bait them).

Win by surviving the level's turn clock. Player starts red.
Taking damage copies the attacker's kit. White outline = player.

Transitions: entities slide pixel-by-pixel; hits flash magenta.
"""

from __future__ import annotations

import json
import random
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
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_GREEN = 14
C_VIOLET = 15

C_FLOOR = C_BLACK
C_WALL = C_DGREY
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_HIT = C_MAGENTA
C_MINE = C_MAGENTA
C_FREEZE = C_CYAN  # freeze telegraph + frozen entity markers
C_NO_RETURN = C_LGREY  # X mark on player's previous cell
C_OUTLINE = C_WHITE
C_HEART = C_RED
C_TURN = C_CYAN
C_TURN_DONE = C_GREEN

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_RESET = 5, 7
FRAME = 64
HUD_H = 7
PLAY_H = FRAME - HUD_H
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "fite_arena" / "levels"
HIT_FLASH_FRAMES = 3
PUSH_FLASH_FRAMES = 2
ANIM_FPS = 16

DIR_DELTA = {
    ACTION_UP: (0, -1),
    ACTION_DOWN: (0, 1),
    ACTION_LEFT: (-1, 0),
    ACTION_RIGHT: (1, 0),
}
FACING_DELTA = {
    "u": (0, -1),
    "d": (0, 1),
    "l": (-1, 0),
    "r": (1, 0),
}
ACTION_TO_FACING = {
    ACTION_UP: "u",
    ACTION_DOWN: "d",
    ACTION_LEFT: "l",
    ACTION_RIGHT: "r",
}

ColorName = Literal["red", "orange", "green", "blue", "yellow", "purple"]

KIT_COLOR: dict[ColorName, int] = {
    "red": C_RED,
    "orange": C_ORANGE,
    "green": C_GREEN,
    "blue": C_BLUE,
    "yellow": C_YELLOW,
    "purple": C_VIOLET,
}
COLOR_FROM_ARC = {v: k for k, v in KIT_COLOR.items()}


@dataclass(frozen=True)
class Kit:
    name: ColorName
    move: int
    # power fields interpreted per name
    damage: int = 0
    push: int = 0
    magnet: int = 0
    freeze: int = 0
    electrocute: int = 0
    mine: int = 0


KITS: dict[ColorName, Kit] = {
    "red": Kit("red", move=1, damage=2, push=1),
    "orange": Kit("orange", move=3, damage=1, push=3),
    "green": Kit("green", move=2, magnet=2),
    "blue": Kit("blue", move=1, freeze=1),
    "yellow": Kit("yellow", move=1, electrocute=1),
    "purple": Kit("purple", move=2, mine=1),
}


@dataclass
class Entity:
    eid: int
    x: int
    y: int
    kit: ColorName
    is_player: bool = False
    facing: str = "r"
    frozen: int = 0
    hp: int = 1


@dataclass
class LevelConfig:
    name: str
    grid_n: int
    cell_px: int
    hearts: int
    walls: list[tuple[int, int]]
    player: tuple[int, int]
    enemies: list[tuple[int, int, ColorName]]
    seed: int
    # Unavoidable opening damage (L04/L05=1, L06=2).
    forced_opening_hits: int = 0
    forced_opening_kit: ColorName = "orange"
    turns_to_win: int | None = None


@dataclass
class LevelState:
    cfg: LevelConfig
    level_index: int
    turns_to_win: int
    hearts: int
    turns_done: int
    entities: list[Entity]
    mines: set[tuple[int, int]]
    walls: set[tuple[int, int]]
    initiative: list[int]  # entity ids in order
    turn_i: int  # index into initiative
    steps_left: int
    can_power: bool
    hits_taken: int = 0
    # Cells currently showing freeze telegraph (cyan), cleared after render bursts.
    freeze_flash: set[tuple[int, int]] = field(default_factory=set)
    # Player cannot dash onto these cells (shown with X). Grows with every
    # vacated cell of a multi-step dash (orange x3 marks all stepped-from cells).
    no_return_cells: set[tuple[int, int]] = field(default_factory=set)
    rng: random.Random = field(default_factory=random.Random)


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    walls = [(int(a), int(b)) for a, b in data.get("walls", [])]
    enemies: list[tuple[int, int, ColorName]] = []
    for e in data.get("enemies", []):
        enemies.append((int(e["x"]), int(e["y"]), str(e["kit"])))  # type: ignore[arg-type]
    px, py = data["player"]
    fok = str(data.get("forced_opening_kit", "orange"))
    if fok not in KITS:
        fok = "orange"
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        grid_n=int(data["grid_n"]),
        cell_px=int(data.get("cell_px", 4)),
        hearts=int(data.get("hearts", 3)),
        walls=walls,
        player=(int(px), int(py)),
        enemies=enemies,
        seed=int(data.get("seed", 0)),
        forced_opening_hits=int(data.get("forced_opening_hits", 0)),
        forced_opening_kit=fok,  # type: ignore[arg-type]
        turns_to_win=(
            int(data["turns_to_win"]) if data.get("turns_to_win") is not None else None
        ),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _manhattan(ax: int, ay: int, bx: int, by: int) -> int:
    return abs(ax - bx) + abs(ay - by)


class FiteArenaEngine:
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
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = self._new_level_state(0)

    def _turns_needed(self, level_index: int) -> int:
        # Shorter clocks: 5+level (L01=6 … L06=11) — less safe stalling.
        return 5 + (level_index + 1)

    def _new_level_state(self, level_index: int) -> LevelState:
        cfg = self._templates[level_index]
        rng = random.Random(cfg.seed + level_index * 17)
        walls = set(cfg.walls)
        entities: list[Entity] = []
        eid = 0
        entities.append(
            Entity(
                eid=eid,
                x=cfg.player[0],
                y=cfg.player[1],
                kit="red",
                is_player=True,
                facing="r",
                hp=1,
            )
        )
        eid += 1
        for x, y, kit in cfg.enemies:
            entities.append(
                Entity(eid=eid, x=x, y=y, kit=kit, is_player=False, facing="l", hp=1)
            )
            eid += 1
        lv = LevelState(
            cfg=cfg,
            level_index=level_index,
            turns_to_win=cfg.turns_to_win or self._turns_needed(level_index),
            hearts=cfg.hearts,
            turns_done=0,
            entities=entities,
            mines=set(),
            walls=walls,
            initiative=[],
            turn_i=0,
            steps_left=0,
            can_power=True,
            hits_taken=0,
            no_return_cells=set(),
            rng=rng,
        )
        self._rebuild_initiative(lv)
        self._start_actor_turn(lv)
        return lv

    def _player(self, lv: LevelState) -> Entity:
        for e in lv.entities:
            if e.is_player:
                return e
        raise RuntimeError("no player")

    def _alive(self, lv: LevelState) -> list[Entity]:
        return [e for e in lv.entities if e.hp > 0]

    def _rebuild_initiative(self, lv: LevelState) -> None:
        alive = self._alive(lv)
        players = [e for e in alive if e.is_player]
        enemies = [e for e in alive if not e.is_player]
        enemies.sort(key=lambda e: (-KITS[e.kit].move, e.eid))
        # Player is ALWAYS first in initiative.
        lv.initiative = [e.eid for e in players] + [e.eid for e in enemies]
        lv.turn_i = 0

    def _entity_by_id(self, lv: LevelState, eid: int) -> Entity | None:
        for e in lv.entities:
            if e.eid == eid and e.hp > 0:
                return e
        return None

    def _current(self, lv: LevelState) -> Entity | None:
        if not lv.initiative:
            return None
        if lv.turn_i >= len(lv.initiative):
            lv.turn_i = 0
        return self._entity_by_id(lv, lv.initiative[lv.turn_i])

    def _start_actor_turn(self, lv: LevelState) -> None:
        # Skip dead / missing
        for _ in range(len(lv.initiative) + 1):
            cur = self._current(lv)
            if cur is None:
                self._rebuild_initiative(lv)
                cur = self._current(lv)
            if cur is None:
                return
            if cur.frozen > 0:
                cur.frozen -= 1
                self._advance_turn_index(lv)
                continue
            lv.steps_left = KITS[cur.kit].move if cur.is_player else 0
            lv.can_power = True
            return

    def _advance_turn_index(self, lv: LevelState) -> None:
        lv.turn_i += 1
        if lv.turn_i >= len(lv.initiative):
            lv.turn_i = 0
            lv.turns_done += 1
            self._rebuild_initiative(lv)

    def _end_current_turn(self, lv: LevelState) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        self._advance_turn_index(lv)
        if lv.turns_done >= lv.turns_to_win and lv.hearts > 0:
            frames.extend(self._win_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = self._new_level_state(self.levels_completed)
                frames.append(self._render_frame())
            return frames
        self._start_actor_turn(lv)
        frames.extend(self._resolve_enemy_streak())
        return frames

    def _occupied(self, lv: LevelState, x: int, y: int, ignore: int | None = None) -> bool:
        if (x, y) in lv.walls:
            return True
        if not (0 <= x < lv.cfg.grid_n and 0 <= y < lv.cfg.grid_n):
            return True
        for e in lv.entities:
            if e.hp <= 0 or e.eid == ignore:
                continue
            if e.x == x and e.y == y:
                return True
        return False

    def _entity_at(self, lv: LevelState, x: int, y: int) -> Entity | None:
        for e in lv.entities:
            if e.hp > 0 and e.x == x and e.y == y:
                return e
        return None

    def _set_facing(self, ent: Entity, dx: int, dy: int) -> None:
        if dx == 1:
            ent.facing = "r"
        elif dx == -1:
            ent.facing = "l"
        elif dy == 1:
            ent.facing = "d"
        elif dy == -1:
            ent.facing = "u"

    def _try_move(self, lv: LevelState, ent: Entity, dx: int, dy: int) -> bool:
        nx, ny = ent.x + dx, ent.y + dy
        if self._occupied(lv, nx, ny, ignore=ent.eid):
            return False
        ent.x, ent.y = nx, ny
        self._set_facing(ent, dx, dy)
        self._step_on_mine(lv, ent)
        return True

    def _anim_slide(
        self,
        ent: Entity,
        dx: int,
        dy: int,
        frames: list[list[list[int]]],
        *,
        player_cursor_color: int | None = None,
    ) -> bool:
        """Slide one cell pixel-by-pixel. Returns False if the destination is blocked."""
        lv = self._level
        self._set_facing(ent, dx, dy)
        nx, ny = ent.x + dx, ent.y + dy
        if self._occupied(lv, nx, ny, ignore=ent.eid):
            return False
        cell, ox, oy = self._geom()
        x0 = ox + ent.x * cell
        y0 = oy + ent.y * cell
        nframes = max(1, cell)
        for i in range(1, nframes + 1):
            px = float(x0 + dx * i)
            py = float(y0 + dy * i)
            frames.append(
                self._render_frame(
                    pixel_pos={ent.eid: (px, py)},
                    player_cursor_color=(
                        player_cursor_color if ent.is_player else None
                    ),
                )
            )
        ent.x, ent.y = nx, ny
        mine_here = (ent.x, ent.y) in lv.mines
        self._step_on_mine(lv, ent)
        if mine_here:
            self._flash_cells([(nx, ny)], frames, n=HIT_FLASH_FRAMES)
            frames.append(self._render_frame())
        return True

    def _step_on_mine(self, lv: LevelState, ent: Entity) -> None:
        key = (ent.x, ent.y)
        if key not in lv.mines:
            return
        lv.mines.discard(key)
        self._apply_damage(lv, ent, amount=1, from_kit="purple")

    def _apply_damage(
        self, lv: LevelState, target: Entity, amount: int, from_kit: ColorName
    ) -> None:
        if target.is_player:
            lv.hearts = max(0, lv.hearts - amount)
            lv.hits_taken += amount
            # Affinity steal: copy attacker kit.
            target.kit = from_kit
            return
        # Enemies are immortal: hits still apply kit side-effects (push/freeze
        # elsewhere) but never remove them from the arena.
        _ = amount
        _ = from_kit

    def _push_entity(
        self, lv: LevelState, target: Entity, dx: int, dy: int, dist: int
    ) -> None:
        for _ in range(dist):
            nx, ny = target.x + dx, target.y + dy
            if self._occupied(lv, nx, ny, ignore=target.eid):
                break
            target.x, target.y = nx, ny
            self._step_on_mine(lv, target)

    def _flash_cells(
        self,
        cells: list[tuple[int, int]],
        frames: list[list[list[int]]],
        n: int = HIT_FLASH_FRAMES,
        *,
        origin: tuple[int, int] | None = None,
    ) -> None:
        """Magenta strike telegraph — flashes empty cells too (whiff visible)."""
        ngrid = self._level.cfg.grid_n
        clipped = [(x, y) for x, y in cells if 0 <= x < ngrid and 0 <= y < ngrid]
        if not clipped and origin is not None:
            # Facing out of arena: flash the origin cell so the strike is still readable.
            clipped = [origin]
        if not clipped:
            return
        for _ in range(max(1, n)):
            frames.append(self._render_frame(flashes=clipped))

    def _power_cells(self, lv: LevelState, ent: Entity) -> list[tuple[int, int]]:
        kit = KITS[ent.kit]
        if kit.electrocute:
            cells = []
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    cells.append((ent.x + dx, ent.y + dy))
            return cells
        # Blue: AoE freeze on self + all 8 neighbours.
        if kit.freeze and kit.damage == 0 and kit.push == 0:
            return [
                (ent.x + dx, ent.y + dy)
                for dy in (-1, 0, 1)
                for dx in (-1, 0, 1)
            ]
        if kit.magnet:
            cells = []
            for other in self._alive(lv):
                if other.eid == ent.eid:
                    continue
                # Ortho only — never pull pure diagonals.
                if other.x != ent.x and other.y != ent.y:
                    continue
                if 1 <= _manhattan(ent.x, ent.y, other.x, other.y) <= kit.magnet:
                    cells.append((other.x, other.y))
            return cells
        if kit.mine:
            return [(ent.x, ent.y)]
        fdx, fdy = FACING_DELTA[ent.facing]
        return [(ent.x + fdx, ent.y + fdy)]

    def _anim_push(
        self,
        target: Entity,
        dx: int,
        dy: int,
        dist: int,
        frames: list[list[list[int]]],
    ) -> None:
        self._flash_cells([(target.x, target.y)], frames, n=PUSH_FLASH_FRAMES)
        for _ in range(dist):
            if not self._anim_slide(target, dx, dy, frames):
                break

    def _flash_freeze_cells(
        self, cells: list[tuple[int, int]], frames: list[list[list[int]]]
    ) -> None:
        """Cyan freeze telegraph on affected cells (including empty)."""
        ngrid = self._level.cfg.grid_n
        clipped = [(x, y) for x, y in cells if 0 <= x < ngrid and 0 <= y < ngrid]
        if not clipped:
            return
        for _ in range(HIT_FLASH_FRAMES):
            frames.append(self._render_frame(freeze_flash=clipped))

    def _anim_power(self, ent: Entity, frames: list[list[list[int]]]) -> None:
        lv = self._level
        kit = KITS[ent.kit]
        cells = self._power_cells(lv, ent)
        # Blue AoE freeze: self + all 8 neighbours, cyan markers.
        if kit.freeze and kit.damage == 0 and kit.push == 0:
            self._flash_freeze_cells(cells, frames)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        ent.frozen = max(ent.frozen, kit.freeze)
                        continue
                    other = self._entity_at(lv, ent.x + dx, ent.y + dy)
                    if other is not None:
                        other.frozen = max(other.frozen, kit.freeze)
                        if other.is_player:
                            other.kit = ent.kit
            frames.append(self._render_frame())
            return
        self._flash_cells(
            cells, frames, n=HIT_FLASH_FRAMES, origin=(ent.x, ent.y)
        )
        if kit.electrocute:
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    other = self._entity_at(lv, ent.x + dx, ent.y + dy)
                    if other and other.eid != ent.eid:
                        self._apply_damage(lv, other, kit.electrocute, ent.kit)
            frames.append(self._render_frame())
            return
        if kit.magnet:
            pulled = [
                other
                for other in list(self._alive(lv))
                if other.eid != ent.eid
                and (other.x == ent.x or other.y == ent.y)
                and 1 <= _manhattan(ent.x, ent.y, other.x, other.y) <= kit.magnet
            ]
            for other in pulled:
                if other.is_player:
                    other.kit = ent.kit
                sx = 0 if other.x == ent.x else (-1 if other.x > ent.x else 1)
                sy = 0 if other.y == ent.y else (-1 if other.y > ent.y else 1)
                self._anim_slide(
                    other,
                    sx,
                    sy,
                    frames,
                    player_cursor_color=C_GREEN if other.is_player else None,
                )
            return
        if kit.mine:
            lv.mines.add((ent.x, ent.y))
            frames.append(self._render_frame())
            return
        fdx, fdy = FACING_DELTA[ent.facing]
        tx, ty = ent.x + fdx, ent.y + fdy
        other = self._entity_at(lv, tx, ty)
        if other is None:
            frames.append(self._render_frame())
            return
        if kit.damage:
            self._apply_damage(lv, other, kit.damage, ent.kit)
        if kit.push and other.hp > 0:
            # Push only along the dash/facing direction (never re-aim).
            self._anim_push(other, fdx, fdy, kit.push, frames)
        else:
            frames.append(self._render_frame())

    def _use_power(self, lv: LevelState, ent: Entity) -> None:
        _ = lv
        self._anim_power(ent, [])

    def _approach_goals(
        self, lv: LevelState, ent: Entity, target: Entity
    ) -> list[tuple[int, int]]:
        """Walkable ortho cells adjacent to target (stand here to strike)."""
        goals: list[tuple[int, int]] = []
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = target.x + dx, target.y + dy
            if not (0 <= nx < lv.cfg.grid_n and 0 <= ny < lv.cfg.grid_n):
                continue
            if (nx, ny) in lv.walls:
                continue
            if (nx, ny) == (ent.x, ent.y):
                goals.append((nx, ny))
                continue
            if self._occupied(lv, nx, ny, ignore=ent.eid):
                continue
            goals.append((nx, ny))
        return goals

    def _bfs_next_step(
        self,
        lv: LevelState,
        ent: Entity,
        target: Entity,
    ) -> tuple[int, int] | None:
        """First step (dx,dy) on a shortest path to stand ortho-adjacent to target."""
        from collections import deque

        start = (ent.x, ent.y)
        goals = set(self._approach_goals(lv, ent, target))
        if start in goals:
            return None
        if not goals:
            return None
        blocked: set[tuple[int, int]] = set(lv.walls)
        for other in self._alive(lv):
            if other.eid != ent.eid:
                blocked.add((other.x, other.y))
        # Goals themselves must stay walkable destinations.
        blocked -= goals
        q = deque([start])
        came: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
        found: tuple[int, int] | None = None
        while q:
            cx, cy = q.popleft()
            if (cx, cy) in goals:
                found = (cx, cy)
                break
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if not (0 <= nx < lv.cfg.grid_n and 0 <= ny < lv.cfg.grid_n):
                    continue
                if (nx, ny) in blocked or (nx, ny) in came:
                    continue
                came[(nx, ny)] = (cx, cy)
                q.append((nx, ny))
        if found is None:
            return None
        cur = found
        while came[cur] is not None and came[cur] != start:
            cur = came[cur]  # type: ignore[assignment]
        if came.get(cur) != start:
            return None
        return (cur[0] - start[0], cur[1] - start[1])

    def _path_distance_to_adjacent(
        self, lv: LevelState, ent: Entity, target: Entity
    ) -> int | None:
        """Steps to reach any ortho-adjacent free cell to target."""
        from collections import deque

        start = (ent.x, ent.y)
        if _manhattan(ent.x, ent.y, target.x, target.y) == 1:
            return 0
        goals = set(self._approach_goals(lv, ent, target))
        if not goals:
            return None
        blocked: set[tuple[int, int]] = set(lv.walls)
        for other in self._alive(lv):
            if other.eid != ent.eid:
                blocked.add((other.x, other.y))
        blocked -= goals
        q = deque([(start, 0)])
        seen = {start}
        while q:
            (cx, cy), dist = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = cx + dx, cy + dy
                if not (0 <= nx < lv.cfg.grid_n and 0 <= ny < lv.cfg.grid_n):
                    continue
                if (nx, ny) in blocked or (nx, ny) in seen:
                    continue
                if (nx, ny) in goals:
                    return dist + 1
                seen.add((nx, ny))
                q.append(((nx, ny), dist + 1))
        return None

    def _closest_foe(self, lv: LevelState, ent: Entity) -> Entity | None:
        """Nearest living entity; prefer the player when nearest targets tie."""
        best: Entity | None = None
        best_key = (10**9, 1, 10**9)
        for other in self._alive(lv):
            if other.eid == ent.eid:
                continue
            pd = self._path_distance_to_adjacent(lv, ent, other)
            d = (
                pd
                if pd is not None
                else 10**6 + _manhattan(ent.x, ent.y, other.x, other.y)
            )
            # Distance remains authoritative. At the same distance, attacking
            # the player is explicit rather than an accidental low-eid tie-break.
            key = (d, 0 if other.is_player else 1, other.eid)
            if key < best_key:
                best_key = key
                best = other
        return best

    def _face_toward(self, ent: Entity, tx: int, ty: int) -> None:
        dx, dy = tx - ent.x, ty - ent.y
        if abs(dx) >= abs(dy):
            ent.facing = "r" if dx > 0 else ("l" if dx < 0 else ent.facing)
        else:
            ent.facing = "d" if dy > 0 else ("u" if dy < 0 else ent.facing)

    def _enemy_ready_to_power(self, lv: LevelState, ent: Entity, target: Entity) -> bool:
        kit = KITS[ent.kit]
        if kit.electrocute or (kit.freeze and kit.damage == 0 and kit.push == 0):
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    other = self._entity_at(lv, ent.x + dx, ent.y + dy)
                    if other is not None and other.eid != ent.eid:
                        return True
            return False
        if kit.magnet:
            for other in self._alive(lv):
                if other.eid == ent.eid:
                    continue
                if other.x != ent.x and other.y != ent.y:
                    continue
                if 1 <= _manhattan(ent.x, ent.y, other.x, other.y) <= kit.magnet:
                    return True
            return False
        # Facing kits + mine: act when ortho-adjacent to current closest foe.
        return _manhattan(ent.x, ent.y, target.x, target.y) == 1

    def _dash_direction_toward(
        self, lv: LevelState, ent: Entity, target: Entity
    ) -> tuple[int, int] | None:
        """Pick ONE cardinal direction for a straight dash (no mid-burst turns).

        Prefer the first step of a BFS path when available; otherwise the dominant
        axis toward the target. That direction is locked for the whole move budget.
        """
        step = self._bfs_next_step(lv, ent, target)
        if step is not None:
            return step
        dx = target.x - ent.x
        dy = target.y - ent.y
        if dx == 0 and dy == 0:
            return None
        if abs(dx) >= abs(dy):
            return (1 if dx > 0 else -1, 0)
        return (0, 1 if dy > 0 else -1)

    def _enemy_act(
        self,
        lv: LevelState,
        ent: Entity,
        frames: list[list[list[int]]] | None = None,
    ) -> None:
        # Hostile to whoever is closest by path — including other enemies.
        if frames is None:
            frames = []
        target = self._closest_foe(lv, ent)
        if target is None:
            return
        kit = KITS[ent.kit]
        ready_before_move = self._enemy_ready_to_power(lv, ent, target)
        if (
            ready_before_move
            and (kit.damage or kit.push)
            and _manhattan(ent.x, ent.y, target.x, target.y) == 1
        ):
            # When no dash establishes a facing, explicitly aim the directional
            # strike at the chosen adjacent target (the player wins distance ties).
            self._face_toward(ent, target.x, target.y)
        # Straight dash: lock ONE direction for the full move budget (orange x3
        # never zig-zags), then ALWAYS strike (magenta whiff into empty ok).
        if not ready_before_move:
            locked = self._dash_direction_toward(lv, ent, target)
            if locked is not None:
                dx, dy = locked
                if dx == 1:
                    ent.facing = "r"
                elif dx == -1:
                    ent.facing = "l"
                elif dy == 1:
                    ent.facing = "d"
                elif dy == -1:
                    ent.facing = "u"
                for _ in range(KITS[ent.kit].move):
                    if self._enemy_ready_to_power(lv, ent, target):
                        break
                    if not self._anim_slide(ent, dx, dy, frames):
                        frames.append(self._render_frame())
                        break
                    target = self._closest_foe(lv, ent) or target
        # Strike in the dash facing — do NOT re-aim toward another foe
        # (orange push/hit must stay on the movement axis).
        self._anim_power(ent, frames)

    def _resolve_enemy_streak(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        lv = self._level
        guard = 0
        while guard < 32 and self.state != "WIN":
            guard += 1
            if lv.hearts <= 0:
                frames.extend(self._fail_frames())
                self._level = self._new_level_state(self.levels_completed)
                frames.append(self._render_frame())
                return frames
            if lv.turns_done >= lv.turns_to_win:
                frames.extend(self._win_frames())
                self.levels_completed += 1
                if self.levels_completed >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._level = self._new_level_state(self.levels_completed)
                    frames.append(self._render_frame())
                return frames
            cur = self._current(lv)
            if cur is None:
                self._rebuild_initiative(lv)
                self._start_actor_turn(lv)
                cur = self._current(lv)
            if cur is None:
                break
            if cur.is_player:
                frames.append(self._render_frame())
                break
            if cur.frozen > 0:
                cur.frozen -= 1
                self._advance_turn_index(lv)
                self._start_actor_turn(lv)
                continue
            self._enemy_act(lv, cur, frames)
            if lv.hearts <= 0:
                frames.extend(self._fail_frames())
                self._level = self._new_level_state(self.levels_completed)
                frames.append(self._render_frame())
                return frames
            self._advance_turn_index(lv)
            if lv.turns_done >= lv.turns_to_win and lv.hearts > 0:
                frames.extend(self._win_frames())
                self.levels_completed += 1
                if self.levels_completed >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._level = self._new_level_state(self.levels_completed)
                    frames.append(self._render_frame())
                return frames
            self._start_actor_turn(lv)
        return frames

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

    def _fail_if_dead(self, frames: list[list[list[int]]]) -> bool:
        lv = self._level
        if lv.hearts > 0:
            return False
        frames.extend(self._fail_frames())
        self._level = self._new_level_state(self.levels_completed)
        frames.append(self._render_frame())
        return True

    def _finish_player_move_phase(
        self, lv: LevelState, cur: Entity
    ) -> list[list[list[int]]]:
        """Auto power after movement budget is spent, then end turn."""
        frames: list[list[list[int]]] = []
        if lv.can_power:
            self._anim_power(cur, frames)
            lv.can_power = False
            if self._fail_if_dead(frames):
                return frames
        frames.extend(self._end_current_turn(lv))
        return frames

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        lv = self._level
        cur = self._current(lv)
        if cur is None or not cur.is_player:
            frames = self._resolve_enemy_streak()
            if frames:
                self._pending_frames = frames
            return self.public_state()

        if aid not in DIR_DELTA:
            return self.public_state()
        if lv.steps_left <= 0:
            return self.public_state()

        dx, dy = DIR_DELTA[aid]
        nx, ny = cur.x + dx, cur.y + dy
        # Forbid any dash whose first step lands on a no-return (X) cell.
        if (nx, ny) in lv.no_return_cells:
            return self.public_state()
        adjacent = self._entity_at(lv, nx, ny)
        if adjacent is not None and adjacent.eid != cur.eid:
            # A body in the first cell is a valid close-range attack, not a wall.
            # This is how orange can push a directly adjacent entity without
            # first occupying its cell.
            frames: list[list[list[int]]] = []
            self.step_index += 1
            self._set_facing(cur, dx, dy)
            lv.steps_left = 0
            frames.extend(self._finish_player_move_phase(lv, cur))
            if frames:
                self._pending_frames = frames
            return self.public_state()

        # Wall / edge bump with zero travel: ineffective — does not spend the
        # turn, power, or étapes.
        if self._occupied(lv, nx, ny, ignore=cur.eid):
            return self.public_state()

        # One press = full dash in that direction (up to move range / until blocked),
        # then power in continuity (orange move-3 is one continuous burst).
        frames: list[list[list[int]]] = []
        self.step_index += 1
        if dx == 1:
            cur.facing = "r"
        elif dx == -1:
            cur.facing = "l"
        elif dy == 1:
            cur.facing = "d"
        elif dy == -1:
            cur.facing = "u"
        vacated: list[tuple[int, int]] = []
        while lv.steps_left > 0:
            step_cell = (cur.x + dx, cur.y + dy)
            if step_cell in lv.no_return_cells:
                frames.append(self._render_frame())
                break
            prev = (cur.x, cur.y)
            if not self._anim_slide(cur, dx, dy, frames):
                frames.append(self._render_frame())
                break
            vacated.append(prev)
            lv.steps_left -= 1
            if self._fail_if_dead(frames):
                self._pending_frames = frames
                return self.public_state()
        if not vacated:
            # No cell gained (shouldn't happen after pre-check) — do not advance turn.
            return self.public_state()
        lv.no_return_cells.update(vacated)
        lv.steps_left = 0
        frames.extend(self._finish_player_move_phase(lv, cur))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _geom(self) -> tuple[int, int, int]:
        lv = self._level
        n = lv.cfg.grid_n
        cell = lv.cfg.cell_px
        while n * cell > min(FRAME - 2, PLAY_H - 2) and cell > 2:
            cell -= 1
        bw = n * cell
        ox = max(1, (FRAME - bw) // 2)
        oy = max(1, (PLAY_H - 2 - bw) // 2)
        return cell, ox, oy

    def _draw_freeze_dot(
        self, frame: list[list[int]], px: float, py: float, cell: int
    ) -> None:
        """Small cyan point on a frozen entity (center of the square)."""
        size = 3 if cell >= 5 else 2
        x = int(round(px)) + max(0, (cell - size) // 2)
        y = int(round(py)) + max(0, (cell - size) // 2)
        for yy in range(y, y + size):
            for xx in range(x, x + size):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = C_FREEZE

    def _draw_no_return_cross(
        self,
        frame: list[list[int]],
        ox: int,
        oy: int,
        cell: int,
        gx: int,
        gy: int,
    ) -> None:
        """Draw an X on the player's previous cell (no-return marker)."""
        x0 = ox + gx * cell
        y0 = oy + gy * cell
        for i in range(cell):
            for xx, yy in (
                (x0 + i, y0 + i),
                (x0 + (cell - 1 - i), y0 + i),
            ):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = C_NO_RETURN

    def _render_frame(
        self,
        pixel_pos: dict[int, tuple[float, float]] | None = None,
        flashes: list[tuple[int, int]] | None = None,
        freeze_flash: list[tuple[int, int]] | None = None,
        player_cursor_color: int | None = None,
    ) -> list[list[int]]:
        lv = self._level
        frame = [[C_FLOOR for _ in range(FRAME)] for _ in range(FRAME)]
        cell, ox, oy = self._geom()
        n = lv.cfg.grid_n
        for y in range(n):
            for x in range(n):
                col = C_WALL if (x, y) in lv.walls else C_FLOOR
                self._fill_cell(frame, ox, oy, cell, x, y, col, inset=0)
        for mx, my in lv.mines:
            self._fill_cell(frame, ox, oy, cell, mx, my, C_MINE, inset=1)
        for lx, ly in lv.no_return_cells:
            if 0 <= lx < n and 0 <= ly < n:
                self._draw_no_return_cross(frame, ox, oy, cell, lx, ly)
        for e in self._alive(lv):
            col = KIT_COLOR[e.kit]
            if pixel_pos and e.eid in pixel_pos:
                px, py = pixel_pos[e.eid]
            else:
                px = float(ox + e.x * cell)
                py = float(oy + e.y * cell)
            outline = None
            if e.is_player:
                outline = (
                    player_cursor_color
                    if player_cursor_color is not None
                    else (C_BLUE if e.frozen > 0 else C_OUTLINE)
                )
            self._blit_square(frame, px, py, cell, col, outline=outline)
            if e.frozen > 0:
                self._draw_freeze_dot(frame, px, py, cell)
        if flashes:
            for gx, gy in flashes:
                if 0 <= gx < n and 0 <= gy < n:
                    self._fill_cell(frame, ox, oy, cell, gx, gy, C_HIT, inset=0)
        if freeze_flash:
            for gx, gy in freeze_flash:
                if 0 <= gx < n and 0 <= gy < n:
                    # Cyan points on freeze AoE cells (center of each cell).
                    cx = float(ox + gx * cell)
                    cy = float(oy + gy * cell)
                    self._draw_freeze_dot(frame, cx, cy, cell)
        self._draw_hud(frame, player_cursor_color=player_cursor_color)
        return frame

    def _fill_cell(
        self,
        frame: list[list[int]],
        ox: int,
        oy: int,
        cell: int,
        gx: int,
        gy: int,
        color: int,
        inset: int,
    ) -> None:
        for py in range(oy + gy * cell + inset, oy + (gy + 1) * cell - inset):
            for px in range(ox + gx * cell + inset, ox + (gx + 1) * cell - inset):
                if 0 <= px < FRAME and 0 <= py < PLAY_H:
                    frame[py][px] = color

    def _blit_square(
        self,
        frame: list[list[int]],
        px: float,
        py: float,
        cell: int,
        color: int,
        outline: int | None = None,
    ) -> None:
        x0 = int(round(px))
        y0 = int(round(py))
        x1 = x0 + cell - 1
        y1 = y0 + cell - 1
        for yy in range(y0, y0 + cell):
            for xx in range(x0, x0 + cell):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = color
        if outline is None:
            return
        for xx in range(x0, x1 + 1):
            for yy in (y0, y1):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = outline
        for yy in range(y0, y1 + 1):
            for xx in (x0, x1):
                if 0 <= xx < FRAME and 0 <= yy < PLAY_H:
                    frame[yy][xx] = outline

    def _outline_cell(
        self,
        frame: list[list[int]],
        ox: int,
        oy: int,
        cell: int,
        gx: int,
        gy: int,
        color: int,
    ) -> None:
        self._blit_square(
            frame, float(ox + gx * cell), float(oy + gy * cell), cell, color, outline=color
        )

    def _draw_hud(
        self, frame: list[list[int]], *, player_cursor_color: int | None = None
    ) -> None:
        lv = self._level
        player = self._player(lv)
        player_marker_color = (
            player_cursor_color
            if player_cursor_color is not None
            else (C_BLUE if player.frozen > 0 else C_OUTLINE)
        )
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        # Hearts
        for i in range(lv.hearts):
            x = 2 + i * 3
            if x + 1 < FRAME:
                frame[PLAY_H + 1][x] = C_HEART
                frame[PLAY_H + 1][x + 1] = C_HEART
                frame[PLAY_H + 2][x] = C_HEART
        # All turn slots stay visible: completed light green, remaining cyan.
        for i in range(lv.turns_to_win):
            x = 2 + i * 2
            if x >= FRAME - 2:
                break
            frame[PLAY_H + 4][x] = C_TURN_DONE if i < lv.turns_done else C_TURN
        # Initiative strip
        active_eid = (
            lv.initiative[lv.turn_i]
            if 0 <= lv.turn_i < len(lv.initiative)
            else None
        )
        ix = FRAME - 2
        for eid in reversed(lv.initiative):
            ent = self._entity_by_id(lv, eid)
            if ent is None:
                continue
            col = KIT_COLOR[ent.kit]
            if 0 <= ix < FRAME:
                frame[PLAY_H + 1][ix] = col
                frame[PLAY_H + 2][ix] = player_marker_color if ent.is_player else col
                if eid == active_eid:
                    # Yellow cursor brackets the exact actor throughout every
                    # movement, power and hit frame rendered during its turn.
                    active_color = (
                        player_marker_color
                        if ent.is_player and player_marker_color != C_OUTLINE
                        else C_HUD_CUR
                    )
                    frame[PLAY_H][ix] = active_color
                    frame[PLAY_H + 3][ix] = active_color
            ix -= 2
            if ix < FRAME // 2:
                break
        # Level slots
        done = self.levels_completed
        for i in range(self.win_levels):
            x = FRAME - 2 - (self.win_levels - 1 - i) * 2
            col = (
                C_HUD_DONE
                if i < done
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            frame[PLAY_H + 5][x] = col

    def _fail_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_nonbg(base, C_FLASH))
            frames.append([row[:] for row in base])
        return frames

    def _win_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_nonbg(base, C_WHITE))
            frames.append([row[:] for row in base])
        return frames

    def _recolor_nonbg(self, frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
            for x in range(FRAME):
                if out[y][x] != C_FLOOR:
                    out[y][x] = color
        return out

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
        lv = self._level
        cur = self._current(lv)
        fps = int(self.info.default_fps)
        if len(frames) > 1:
            fps = max(fps, ANIM_FPS)
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
            "level_name": lv.cfg.name,
            "hearts": lv.hearts,
            "turns_done": lv.turns_done,
            "turns_to_win": lv.turns_to_win,
            "player_kit": self._player(lv).kit,
            "steps_left": lv.steps_left,
            "can_power": lv.can_power,
            "current_is_player": bool(cur and cur.is_player),
            "initiative": [
                {"eid": eid, "kit": (self._entity_by_id(lv, eid) or self._player(lv)).kit}
                for eid in lv.initiative
                if self._entity_by_id(lv, eid) is not None
            ],
        }
