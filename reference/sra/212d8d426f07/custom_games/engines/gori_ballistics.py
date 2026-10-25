"""GORI — ballistic aim (Gorillas-inspired), passive target.

Controls:
  ACTION3 left  — decrease power gauge (5% steps)
  ACTION4 right — increase power gauge (5% steps)
  ACTION6 click — fire toward click point (direction × current power)
  ACTION7       — soft reset level

Miss → −1 life, same terrain, power gauge unchanged.
Lives exhausted → fail blink + full terrain reconfiguration + lives refilled + gauge → 50%.
Level change / ACTION7 also resets gauge to 50%.
Hit target → win level. Target never shoots back.

Portals are elongated ovals (H or V) so orientation is readable:
  L04: 1 pair, same orientation both ends, velocity preserved
  L05: 2 pairs, same orientation within each pair, velocity preserved
  L06: 2 pairs, ends perpendicular (H↔V), +90° velocity rotation on transit

Portal / late levels force a tall mid wall so a direct arc cannot reach the target.
"""

from __future__ import annotations

import json
import math
import random
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
C_PINK = 7
C_RED = 8
C_BLUE = 9
C_CYAN = 10
C_YELLOW = 11
C_ORANGE = 12
C_GREEN = 14
C_VIOLET = 15

C_BG = C_BLACK
C_BUILDING = C_DGREY
C_BUILDING_TOP = C_MGREY
C_FLOOR = C_VDGREY
C_SHOOTER = C_ORANGE
C_TARGET = C_RED
C_PROJ = C_YELLOW
C_CLICK_MARK = C_DGREY  # remembered aim clicks (dark grey)
C_TUTORIAL_AIM = C_WHITE
SHOOTER_R = 4  # same visual size as target
TARGET_R = 4  # 2× previous body size
PROJ_R = 2  # banana hit radius (drawn thicker as spinning C)
CLICK_MARK_R = 1
BANANA_SPIN_PER_TICK = 0.95  # rad/tick — tumbles fast on itself
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_GAUGE = C_CYAN
C_GAUGE_MARK = C_WHITE
C_PORTAL_A = C_CYAN
C_PORTAL_B = C_VIOLET

ACTION_LEFT, ACTION_RIGHT, ACTION_CLICK, ACTION_RESET = 3, 4, 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
FLOOR_Y = PLAY_H - 1
GAUGE_STEP = 5
GAUGE_START = 50
MAX_FLIGHT_TICKS = 180
PORTAL_COOLDOWN = 5
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "gori_ballistics" / "levels"

PORTAL_COLORS = (C_PORTAL_A, C_PORTAL_B)
Orient = Literal["h", "v"]

# Oval radii (elongated so H vs V is obvious).
OVAL_H = (5, 2)  # rx, ry
OVAL_V = (2, 5)


@dataclass
class LevelConfig:
    name: str
    attempts: int
    building_count: int
    min_height: int
    max_height: int
    target_radius: int
    portal_pairs: int
    portal_rotate_deg: int
    block_direct: bool
    right_portal_inset: int
    seed: int
    tutorial_aim_cross: tuple[int, int] | None = None


@dataclass
class PortalPair:
    ax: int
    ay: int
    bx: int
    by: int
    color: int
    orient_a: Orient
    orient_b: Orient
    rotate_deg: int = 0


@dataclass
class Terrain:
    solid: list[list[bool]]
    buildings: list[tuple[int, int, int]]
    shooter: tuple[float, float]
    target: tuple[float, float]
    portals: list[PortalPair]


@dataclass
class LevelState:
    cfg: LevelConfig
    attempts_left: int
    power: int
    terrain: Terrain
    layout_serial: int = 0
    click_marks: list[tuple[int, int]] = field(default_factory=list)
    tutorial_aim_cross_consumed: bool = False
    rng: random.Random = field(default_factory=random.Random)


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    tutorial_cross = data.get("tutorial_aim_cross")
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        attempts=int(data["attempts"]),
        building_count=int(data.get("building_count", 6)),
        min_height=int(data.get("min_height", 8)),
        max_height=int(data.get("max_height", 28)),
        target_radius=int(data.get("target_radius", 2)),
        portal_pairs=int(data.get("portal_pairs", 0)),
        portal_rotate_deg=int(data.get("portal_rotate_deg", 0)),
        block_direct=bool(data.get("block_direct", False)),
        right_portal_inset=int(data.get("right_portal_inset", 0)),
        seed=int(data.get("seed", 0)),
        tutorial_aim_cross=(
            (int(tutorial_cross[0]), int(tutorial_cross[1]))
            if tutorial_cross is not None
            else None
        ),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _empty_solid() -> list[list[bool]]:
    return [[False for _ in range(FRAME)] for _ in range(PLAY_H)]


def _paint_building(solid: list[list[bool]], x0: int, width: int, height: int) -> None:
    for x in range(x0, min(FRAME, x0 + width)):
        for h in range(height):
            y = FLOOR_Y - 1 - h
            if 0 <= y < PLAY_H:
                solid[y][x] = True


def _roof_point(x0: int, width: int, height: int) -> tuple[float, float]:
    cx = x0 + width / 2.0
    cy = float(FLOOR_Y - 1 - height)
    return cx, max(1.0, cy - 1.0)


def _oval_radii(orient: Orient) -> tuple[int, int]:
    return OVAL_H if orient == "h" else OVAL_V


def _in_oval(x: float, y: float, cx: int, cy: int, orient: Orient) -> bool:
    rx, ry = _oval_radii(orient)
    return ((x - cx) / max(1, rx)) ** 2 + ((y - cy) / max(1, ry)) ** 2 <= 1.05


def _oval_clear(solid: list[list[bool]], cx: int, cy: int, orient: Orient) -> bool:
    rx, ry = _oval_radii(orient)
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            if x < 1 or x >= FRAME - 1 or y < 1 or y >= FLOOR_Y:
                return False
            if solid[y][x]:
                return False
    return True


def _place_portals(
    solid: list[list[bool]],
    rng: random.Random,
    n_pairs: int,
    rotate_deg: int,
    forbid: list[tuple[float, float]],
    shooter: tuple[float, float],
    target: tuple[float, float],
    right_inset: int = 0,
) -> list[PortalPair]:
    if n_pairs <= 0:
        return []
    sx, _sy = shooter
    tx, _ty = target
    mid_x = (sx + tx) / 2.0
    right_max = FRAME - 4 - max(0, right_inset)

    candidates: list[tuple[int, int]] = []
    for y in range(6, FLOOR_Y - 8):
        for x in range(4, FRAME - 4):
            # Need room for either oval orientation.
            if not (_oval_clear(solid, x, y, "h") or _oval_clear(solid, x, y, "v")):
                continue
            ok = True
            for fx, fy in forbid:
                if (x - fx) ** 2 + (y - fy) ** 2 < 36:
                    ok = False
                    break
            if ok:
                candidates.append((x, y))
    rng.shuffle(candidates)

    left_cands = [c for c in candidates if c[0] < mid_x - 2]
    # Pull right-side portals leftward when inset > 0 (L05).
    right_cands = [
        c for c in candidates if mid_x + 2 < c[0] <= right_max
    ]
    rng.shuffle(left_cands)
    rng.shuffle(right_cands)

    portals: list[PortalPair] = []
    used: set[tuple[int, int]] = set()

    for i in range(n_pairs):
        a = next((c for c in left_cands if c not in used), None)
        b = next((c for c in right_cands if c not in used), None)
        if a is None or b is None:
            rest = [c for c in candidates if c not in used]
            if len(rest) < 2:
                break
            a, b = rest[0], rest[1]
            if abs(a[0] - b[0]) < 10:
                # try farther
                for cb in rest[1:]:
                    if abs(a[0] - cb[0]) + abs(a[1] - cb[1]) >= 14:
                        b = cb
                        break

        used.add(a)
        used.add(b)

        if rotate_deg:
            # Perpendicular ovals: force readable velocity change H↔V.
            orient_a: Orient = "h" if rng.random() < 0.5 else "v"
            orient_b: Orient = "v" if orient_a == "h" else "h"
        else:
            # Same orientation both ends (pair looks linked, no spin).
            orient_a = "h" if rng.random() < 0.5 else "v"
            orient_b = orient_a

        # Prefer orientations that fit clearance; fall back.
        if not _oval_clear(solid, a[0], a[1], orient_a):
            orient_a = "v" if orient_a == "h" else "h"
        if not _oval_clear(solid, b[0], b[1], orient_b):
            if rotate_deg:
                # keep perpendicular if possible
                alt = "v" if orient_a == "h" else "h"
                if _oval_clear(solid, b[0], b[1], alt):
                    orient_b = alt
            else:
                orient_b = orient_a

        portals.append(
            PortalPair(
                ax=a[0],
                ay=a[1],
                bx=b[0],
                by=b[1],
                color=PORTAL_COLORS[i % len(PORTAL_COLORS)],
                orient_a=orient_a,
                orient_b=orient_b,
                rotate_deg=rotate_deg,
            )
        )
    return portals


def _generate_terrain(cfg: LevelConfig, rng: random.Random) -> Terrain:
    solid = _empty_solid()
    for x in range(FRAME):
        solid[FLOOR_Y][x] = True

    n = max(4, cfg.building_count)
    gap = 1
    usable = FRAME - 2 - gap * (n - 1)
    base_w = max(3, usable // n)
    buildings: list[tuple[int, int, int]] = []
    x = 1
    heights = [rng.randint(cfg.min_height, cfg.max_height) for _ in range(n)]

    # End platforms: usable roofs, not sky-scrapers.
    heights[0] = rng.randint(cfg.min_height, max(cfg.min_height, cfg.max_height - 8))
    heights[-1] = rng.randint(cfg.min_height, max(cfg.min_height, cfg.max_height - 8))

    if cfg.block_direct and n >= 3:
        # Tall mid wall(s) nearly to the top — blocks direct arcs.
        mid = n // 2
        wall_h = min(FLOOR_Y - 6, cfg.max_height + 6)
        heights[mid] = wall_h
        if n >= 5:
            heights[mid - 1] = max(heights[mid - 1], wall_h - 4)
            heights[mid + 1] = max(heights[mid + 1], wall_h - 4)

    for i in range(n):
        w = base_w if i < n - 1 else max(3, FRAME - 1 - x)
        w = min(w, FRAME - 1 - x)
        if w < 3:
            break
        h = heights[i]
        _paint_building(solid, x, w, h)
        buildings.append((x, w, h))
        x += w + gap

    if len(buildings) < 2:
        solid = _empty_solid()
        for xx in range(FRAME):
            solid[FLOOR_Y][xx] = True
        _paint_building(solid, 2, 7, 14)
        _paint_building(solid, 28, 8, FLOOR_Y - 7)
        _paint_building(solid, FRAME - 9, 7, 14)
        buildings = [(2, 7, 14), (28, 8, FLOOR_Y - 7), (FRAME - 9, 7, 14)]

    left_i = 0
    right_i = len(buildings) - 1
    sx, sy = _roof_point(*buildings[left_i])
    tx, ty = _roof_point(*buildings[right_i])
    for cx, cy in ((int(sx), int(sy)), (int(tx), int(ty))):
        for dy in range(0, 3):
            for dx in (-1, 0, 1):
                xx, yy = cx + dx, cy - dy
                if 0 <= xx < FRAME and 0 <= yy < FLOOR_Y:
                    solid[yy][xx] = False

    portals = _place_portals(
        solid,
        rng,
        cfg.portal_pairs,
        cfg.portal_rotate_deg,
        forbid=[(sx, sy), (tx, ty)],
        shooter=(sx, sy),
        target=(tx, ty),
        right_inset=cfg.right_portal_inset,
    )
    return Terrain(
        solid=solid,
        buildings=buildings,
        shooter=(sx, sy),
        target=(tx, ty),
        portals=portals,
    )


def _rotate90_ccw(vx: float, vy: float) -> tuple[float, float]:
    return (-vy, vx)


def _speed_from_power(power: int) -> float:
    p = max(0, min(100, power)) / 100.0
    return 1.0 + p * 4.0  # ~1.0 .. 5.0 px/tick


class GoriBallisticsEngine:
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

    def _new_level_state(self, level_index: int) -> LevelState:
        cfg = self._templates[level_index]
        rng = random.Random(cfg.seed + level_index * 41 + self.levels_completed * 17)
        # Retry a few times until portal count matches (clearance can fail).
        terrain = _generate_terrain(cfg, rng)
        for k in range(12):
            if cfg.portal_pairs == 0 or len(terrain.portals) >= cfg.portal_pairs:
                break
            rng = random.Random(cfg.seed + level_index * 41 + k * 99 + 7)
            terrain = _generate_terrain(cfg, rng)
        return LevelState(
            cfg=cfg,
            attempts_left=cfg.attempts,
            power=GAUGE_START,
            terrain=terrain,
            layout_serial=0,
            click_marks=[],  # cleared on level change / reconfiguration
            tutorial_aim_cross_consumed=False,
            rng=rng,
        )

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
        if aid == ACTION_LEFT:
            self.step_index += 1
            self._level.power = max(0, self._level.power - GAUGE_STEP)
            return self.public_state()
        if aid == ACTION_RIGHT:
            self.step_index += 1
            self._level.power = min(100, self._level.power + GAUGE_STEP)
            return self.public_state()
        if aid != ACTION_CLICK:
            return self.public_state()
        self.step_index += 1
        frames = self._fire(int(data.get("x", -1)), int(data.get("y", -1)))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _body_radius(self) -> int:
        return max(TARGET_R, self._level.cfg.target_radius)

    def _hit_target(self, x: float, y: float) -> bool:
        tx, ty = self._level.terrain.target
        r = self._body_radius() + PROJ_R
        return (x - tx) ** 2 + (y - ty) ** 2 <= r * r

    def _in_building(self, x: float, y: float) -> bool:
        ix, iy = int(round(x)), int(round(y))
        if iy < 0 or iy >= PLAY_H or ix < 0 or ix >= FRAME:
            return True
        return self._level.terrain.solid[iy][ix]

    def _segment_outcome(
        self, x0: float, y0: float, x1: float, y1: float
    ) -> Literal["hit", "wall", "ok"]:
        """Subsample the flight segment so fast bananas cannot tunnel through the target."""
        dist = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(math.ceil(dist * 2.0)))
        for s in range(1, steps + 1):
            t = s / steps
            qx = x0 + (x1 - x0) * t
            qy = y0 + (y1 - y0) * t
            if self._hit_target(qx, qy):
                return "hit"
            if self._in_building(qx, qy):
                return "wall"
        return "ok"

    def _portal_hit(self, x: float, y: float) -> tuple[PortalPair, str] | None:
        for p in self._level.terrain.portals:
            if _in_oval(x, y, p.ax, p.ay, p.orient_a):
                return p, "a"
            if _in_oval(x, y, p.bx, p.by, p.orient_b):
                return p, "b"
        return None

    def _exit_nudge(
        self, pair: PortalPair, end: str, vx: float, vy: float
    ) -> tuple[float, float]:
        """Place exit slightly outside the oval along outgoing velocity."""
        if end == "a":
            # entered A → exit at B
            cx, cy, orient = pair.bx, pair.by, pair.orient_b
        else:
            cx, cy, orient = pair.ax, pair.ay, pair.orient_a
        rx, ry = _oval_radii(orient)
        speed = math.hypot(vx, vy) or 1.0
        ux, uy = vx / speed, vy / speed
        # Push just past the oval rim.
        push = max(rx, ry) + 1.5
        return cx + ux * push, cy + uy * push

    def _fire(self, x: int, y: int) -> list[list[list[int]]] | None:
        if y >= PLAY_H or x < 0 or x >= FRAME or y < 0:
            return None
        lv = self._level
        if (
            lv.cfg.tutorial_aim_cross is not None
            and (x, y) in self._tutorial_cross_pixels(lv.cfg.tutorial_aim_cross)
        ):
            lv.tutorial_aim_cross_consumed = True
        sx, sy = lv.terrain.shooter
        dx = float(x) - sx
        dy = float(y) - sy
        dist = math.hypot(dx, dy)
        if dist < 1.0:
            return None
        # Remember every aim click as a grey mark (cleared only on reconfig / new level).
        lv.click_marks.append((int(x), int(y)))
        speed = _speed_from_power(lv.power)
        vx = dx / dist * speed
        vy = dy / dist * speed
        if abs(vy) < 0.15 and dy >= 0:
            vy = -0.35 * speed

        # Spawn just outside the orange shooter so the thick C is never eaten by it.
        launch_n = math.hypot(vx, vy) or 1.0
        launch_push = float(self._body_radius() + 4)
        px = sx + (vx / launch_n) * launch_push
        py = sy + (vy / launch_n) * launch_push
        gravity = 0.26
        frames: list[list[list[int]]] = []
        cooldown = 0
        hit = False
        for tick in range(MAX_FLIGHT_TICKS):
            spin = tick * BANANA_SPIN_PER_TICK
            frames.append(self._render_frame(proj=(px, py, vx, vy, spin)))
            if self._hit_target(px, py):
                hit = True
                break
            nx, ny = px + vx, py + vy
            outcome = self._segment_outcome(px, py, nx, ny)
            px, py = nx, ny
            vy += gravity
            if outcome == "hit":
                hit = True
                frames.append(
                    self._render_frame(proj=(px, py, vx, vy, spin + BANANA_SPIN_PER_TICK))
                )
                break
            if outcome == "wall":
                break
            if cooldown > 0:
                cooldown -= 1
            else:
                ph = self._portal_hit(px, py)
                if ph is not None:
                    pair, end = ph
                    if pair.rotate_deg:
                        turns = max(1, int(pair.rotate_deg) // 90)
                        for _t in range(turns):
                            vx, vy = _rotate90_ccw(vx, vy)
                    px, py = self._exit_nudge(pair, end, vx, vy)
                    cooldown = PORTAL_COOLDOWN
                    frames.append(
                        self._render_frame(
                            proj=(px, py, vx, vy, spin + BANANA_SPIN_PER_TICK)
                        )
                    )
                    if self._hit_target(px, py):
                        hit = True
                        break
                    continue
            if px < -2 or px > FRAME + 1 or py > FLOOR_Y + 2 or py < -4:
                break

        if hit:
            frames.extend(self._win_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                frames.append(self._render_frame())
            else:
                self._level = self._new_level_state(self.levels_completed)
                self.state = "NOT_FINISHED"
                # Hold the next-level board so transport/UI settle on it even if
                # the last raster is peeled off as the published terminal frame.
                nxt = self._render_frame()
                frames.extend([nxt, nxt, nxt])
            return frames

        # Miss: keep terrain + power; reconfigure only when lives are exhausted.
        lv.attempts_left -= 1
        frames.append(
            self._render_frame(proj=(px, py, vx, vy, MAX_FLIGHT_TICKS * BANANA_SPIN_PER_TICK))
        )
        if lv.attempts_left <= 0:
            frames.extend(self._fail_frames())
            # New full layout only now (gauge resets inside _new_level_state).
            nxt = self._new_level_state(
                min(self.levels_completed, self.win_levels - 1)
            )
            nxt.layout_serial = lv.layout_serial + 1
            self._level = nxt
            frames.append(self._render_frame())
        else:
            frames.append(self._render_frame())
        return frames

    @staticmethod
    def _tutorial_cross_pixels(center: tuple[int, int]) -> tuple[tuple[int, int], ...]:
        x, y = center
        return ((x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))

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
            frames.append([row[:] for row in base])
        return frames

    def _recolor_nonbg(self, frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
            for x in range(FRAME):
                if out[y][x] != C_BG:
                    out[y][x] = color
        return out

    def _draw_disk(
        self, frame: list[list[int]], cx: float, cy: float, radius: int, color: int
    ) -> None:
        r2 = radius * radius
        for y in range(int(cy) - radius, int(cy) + radius + 1):
            for x in range(int(cx) - radius, int(cx) + radius + 1):
                if 0 <= x < FRAME and 0 <= y < FRAME:
                    if (x - cx) ** 2 + (y - cy) ** 2 <= r2 + 0.2:
                        frame[y][x] = color

    def _draw_banana(
        self,
        frame: list[list[int]],
        cx: float,
        cy: float,
        vx: float,
        vy: float,
        spin: float,
        color: int,
    ) -> None:
        """Thick yellow C-crescent; spins fast on itself while following flight heading."""
        ang = math.atan2(vy, vx) if (abs(vx) + abs(vy)) > 1e-6 else 0.0
        # Base opening trails behind travel, plus tumble spin.
        open_ang = ang + math.pi + spin
        r_in, r_out = 0.7, 3.6  # thicker banana
        half_gap = 0.75
        # Transparent: only paint yellow crescent pixels; leave gaps untouched.
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                dist = math.hypot(dx, dy)
                if dist < r_in or dist > r_out:
                    continue
                a = math.atan2(dy, dx)
                da = (a - open_ang + math.pi) % (2 * math.pi) - math.pi
                if abs(da) < half_gap:
                    continue
                xx, yy = int(round(cx + dx)), int(round(cy + dy))
                if 0 <= xx < FRAME and 0 <= yy < FRAME:
                    frame[yy][xx] = color

    def _draw_oval(
        self,
        frame: list[list[int]],
        cx: int,
        cy: int,
        orient: Orient,
        color: int,
        *,
        core: int = C_WHITE,
    ) -> None:
        rx, ry = _oval_radii(orient)
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if 0 <= x < FRAME and 0 <= y < FRAME:
                    if ((x - cx) / max(1, rx)) ** 2 + ((y - cy) / max(1, ry)) ** 2 <= 1.0:
                        frame[y][x] = color
        if 0 <= cx < FRAME and 0 <= cy < FRAME:
            frame[cy][cx] = core

    def _render_frame(
        self, proj: tuple[float, float, float, float, float] | None = None
    ) -> list[list[int]]:
        lv = self._level
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        for y in range(PLAY_H):
            for x in range(FRAME):
                if lv.terrain.solid[y][x]:
                    frame[y][x] = C_FLOOR if y == FLOOR_Y else C_BUILDING
        for x0, w, h in lv.terrain.buildings:
            top_y = FLOOR_Y - 1 - h
            if 0 <= top_y < PLAY_H:
                for x in range(x0, min(FRAME, x0 + w)):
                    frame[top_y][x] = C_BUILDING_TOP
        for p in lv.terrain.portals:
            core_b = C_YELLOW if p.rotate_deg else C_WHITE
            self._draw_oval(frame, p.ax, p.ay, p.orient_a, p.color, core=C_WHITE)
            self._draw_oval(frame, p.bx, p.by, p.orient_b, p.color, core=core_b)
        # Aim history (dark grey dots) under actors so bodies stay readable.
        for mx, my in lv.click_marks:
            if 0 <= my < PLAY_H:
                self._draw_disk(frame, float(mx), float(my), CLICK_MARK_R, C_CLICK_MARK)
        if lv.cfg.tutorial_aim_cross is not None and not lv.tutorial_aim_cross_consumed:
            for cx, cy in self._tutorial_cross_pixels(lv.cfg.tutorial_aim_cross):
                if 0 <= cx < FRAME and 0 <= cy < PLAY_H:
                    frame[cy][cx] = C_TUTORIAL_AIM
        sx, sy = lv.terrain.shooter
        tx, ty = lv.terrain.target
        body_r = self._body_radius()
        self._draw_disk(frame, sx, sy, body_r, C_SHOOTER)
        self._draw_disk(frame, tx, ty, body_r, C_TARGET)
        if proj is not None:
            self._draw_banana(
                frame, proj[0], proj[1], proj[2], proj[3], proj[4], C_PROJ
            )
        self._draw_hud(frame)
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        lv = self._level
        for y in range(PLAY_H, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        gy = PLAY_H + 1
        gx0, gx1 = 2, FRAME - 12
        span = gx1 - gx0
        fill = int(round((lv.power / 100.0) * span))
        for x in range(gx0, gx1):
            frame[gy][x] = C_DGREY
        for x in range(gx0, gx0 + fill):
            frame[gy][x] = C_GAUGE
        mid = gx0 + span // 2
        if 0 <= mid < FRAME:
            frame[gy][mid] = C_GAUGE_MARK
            if gy + 1 < FRAME:
                frame[gy + 1][mid] = C_GAUGE_MARK
        done = self.levels_completed
        for i in range(self.win_levels):
            x = FRAME - 2 - (self.win_levels - 1 - i) * 2
            if x < 0:
                continue
            col = (
                C_HUD_DONE
                if i < done
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            frame[PLAY_H + 1][x] = col
            frame[PLAY_H + 2][x] = col
        ay = PLAY_H + 3
        for i in range(min(lv.attempts_left, 20)):
            x = 2 + i * 2
            if x >= FRAME - 14:
                break
            frame[ay][x] = C_ORANGE

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
            frame = frames[-1]
        else:
            frame = self._render_frame()
            frames = [frame]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION3", "ACTION4", "ACTION6", "ACTION7"]
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
            "default_fps": max(
                self.info.default_fps, 12 if len(frames) > 1 else self.info.default_fps
            ),
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
            "power": lv.power,
            "attempts_left": lv.attempts_left,
            "attempts_max": lv.cfg.attempts,
            "portal_pairs": lv.cfg.portal_pairs,
            "portal_rotate_deg": lv.cfg.portal_rotate_deg,
            "block_direct": lv.cfg.block_direct,
            "layout_serial": lv.layout_serial,
            "shooter": [lv.terrain.shooter[0], lv.terrain.shooter[1]],
            "target": [lv.terrain.target[0], lv.terrain.target[1]],
        }
