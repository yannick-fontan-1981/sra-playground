"""MEMO — identity match across time (circle recall).

Controls:
  ACTION6 click — tap a symbol on the ring
  ACTION7       — soft reset current level

Loop:
  - Stage 0 shows 1 symbol. Click it to start.
  - Then several symbols appear in a circle (up to 7 on L06 finale);
    click one that was present on the previous step.
  - Success → next stage; fail → previous stage (exact snapshot restore).
  - Need 10 successful stage advances; 15 click budget.
  - Soft-fail if clicks run out before stage 10.

Visual axes (per level JSON):
  color_mode: stable | mono | shuffle
  random_rotation: bool
  allow_zoom: bool
  pool_size / ring_max: density
"""

from __future__ import annotations

import json
import math
import random
from copy import deepcopy
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

C_BG = C_BLACK
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_RING = C_DGREY

ACTION_CLICK, ACTION_RESET = 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
STAGES_TO_WIN = 10
DEFAULT_CLICK_BUDGET = 15
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "memo_recall" / "levels"
# MEMO uses a private, fixed stream per level/progress position.  It is not
# seeded from time, process entropy, or a caller-provided episode seed.
DETERMINISTIC_LEVEL_SEED_BASE = 1000
DETERMINISTIC_LEVEL_SEED_STRIDE = 17

ColorMode = Literal["stable", "mono", "shuffle"]

# 5×5 glyphs: S = sino-like, E = electronic-like (large alphabet → fewer dual matches)
# fmt: off
_GLYPHS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("s01", "sino", ("..#..", ".###.", "#.#.#", ".###.", "..#..")),
    ("s02", "sino", ("#####", "#...#", "#.###", "#...#", "#####")),
    ("s03", "sino", ("#.#.#", ".###.", "##.##", ".###.", "#.#.#")),
    ("s04", "sino", ("..#..", "..#..", "#####", "..#..", "..#..")),
    ("s05", "sino", ("####.", "#..#.", "####.", "#..#.", "#..##")),
    ("s06", "sino", (".###.", "#...#", ".###.", "#...#", ".###.")),
    ("s07", "sino", ("#...#", "##.##", "#.#.#", "##.##", "#...#")),
    ("s08", "sino", ("#####", "..#..", "..#..", "..#..", "..#..")),
    ("s09", "sino", (".#.#.", "##.##", ".#.#.", "##.##", ".#.#.")),
    ("s10", "sino", ("#####", "....#", "..###", "....#", "#####")),
    ("s11", "sino", ("#....", "##...", "###..", "####.", "#####")),
    ("s12", "sino", ("#####", ".###.", "..#..", ".###.", "#####")),
    ("s13", "sino", ("#.#.#", "#.#.#", "#####", "#.#.#", "#.#.#")),
    ("s14", "sino", ("..###", ".##.#", "##..#", "#...#", "#####")),
    ("s15", "sino", ("##.##", "#.#.#", "..#..", "#.#.#", "##.##")),
    ("s16", "sino", ("#####", "#....", "###..", "#....", "#####")),
    ("s17", "sino", (".#.#.", ".###.", "##.##", ".###.", ".#.#.")),
    ("s18", "sino", ("#..#.", ".##..", "##.##", "..##.", ".#..#")),
    ("s19", "sino", ("###..", "#.#..", "###..", "#.#..", "#..##")),
    ("s20", "sino", ("..#..", ".#.#.", "#...#", ".#.#.", "..#..")),
    ("s21", "sino", ("#####", "#.#.#", "#...#", "#.#.#", "#####")),
    ("s22", "sino", ("#.###", "##.##", "###.#", "##.##", "#.###")),
    ("s23", "sino", ("....#", "...##", "..#.#", ".#..#", "#####")),
    ("s24", "sino", ("##...", "#.#..", "#..#.", ".#.#.", "..##.")),
    ("e01", "elec", ("#.#.#", ".#.#.", "#.#.#", ".#.#.", "#.#.#")),
    ("e02", "elec", ("..#..", ".###.", "##.##", ".###.", "..#..")),
    ("e03", "elec", ("#....", "#.###", "#.#.#", "#.###", "#....")),
    ("e04", "elec", (".###.", "#.#.#", "#####", "#.#.#", ".###.")),
    ("e05", "elec", ("##.##", "#.#.#", ".###.", "#.#.#", "##.##")),
    ("e06", "elec", ("#####", "#.#.#", "#####", "#.#.#", "#####")),
    ("e07", "elec", ("..#..", ".#.#.", "#...#", ".#.#.", "..#..")),
    ("e08", "elec", ("#.###", "#.#.#", "#.###", "#....", "#....")),
    ("e09", "elec", ("##...", "#.#..", "#..#.", "#...#", "#####")),
    ("e10", "elec", (".#.#.", "#.###", ".#.#.", "###.#", ".#.#.")),
    ("e11", "elec", ("#####", "...#.", "..#..", ".#...", "#####")),
    ("e12", "elec", ("#...#", ".#.#.", "..#..", ".#.#.", "#...#")),
    ("e13", "elec", ("###.#", "#.#.#", "###.#", "..#.#", "..###")),
    ("e14", "elec", (".#.#.", "##.##", "#.#.#", "##.##", ".#.#.")),
    ("e15", "elec", ("##.##", "##.##", "..#..", "##.##", "##.##")),
    ("e16", "elec", ("#.###", "#.#.#", "#####", "#.#.#", "###.#")),
    ("e17", "elec", ("..###", ".#.#.", "#.#..", ".#.#.", "###..")),
    ("e18", "elec", ("#####", "#...#", ".###.", "#...#", "#####")),
    ("e19", "elec", ("#.#..", "#.#..", "#####", "..#.#", "..#.#")),
    ("e20", "elec", (".###.", "..#..", "#####", "..#..", ".###.")),
    ("e21", "elec", ("##..#", "#.#.#", "#..##", "#.#.#", "#..##")),
    ("e22", "elec", ("#....", "#####", "#.#.#", "#####", "....#")),
    ("e23", "elec", (".#.#.", "#...#", ".###.", "#...#", ".#.#.")),
    ("e24", "elec", ("###..", "..#..", "..###", "..#..", "..###")),
)
# fmt: on

GLYPH_BY_ID = {gid: (kind, pat) for gid, kind, pat in _GLYPHS}
STABLE_COLORS = (C_RED, C_GREEN, C_BLUE, C_YELLOW, C_ORANGE, C_MAGENTA, C_CYAN, C_PINK)


def _rotate_pattern(pat: tuple[str, ...], rot: int) -> tuple[str, ...]:
    """Rotate 5×5 pattern by rot*90° clockwise."""
    grid = [list(row) for row in pat]
    n = len(grid)
    for _ in range(rot % 4):
        grid = [[grid[n - 1 - r][c] for r in range(n)] for c in range(n)]
    return tuple("".join(row) for row in grid)


@dataclass
class RingItem:
    symbol_id: str
    color: int
    rotation: int  # 0..3
    zoom: bool
    angle_deg: float
    # hitbox center after layout
    cx: int = 0
    cy: int = 0
    radius: int = 4


@dataclass
class StageSnapshot:
    """Exact display + recall state for one stage (used on soft regress)."""

    stage: int
    items: list[RingItem]
    prev_ids: set[str]
    last_target_id: str | None
    hint_target_id: str | None
    prev_angles: dict[str, float]


@dataclass
class LevelConfig:
    name: str
    color_mode: ColorMode
    random_rotation: bool
    allow_zoom: bool
    pool_size: int
    ring_max: int
    click_budget: int
    mono_color: int
    hint_didactic: bool


@dataclass
class LevelState:
    cfg: LevelConfig
    pool: list[str]
    stage: int = 0
    clicks_left: int = 15
    prev_ids: set[str] = field(default_factory=set)
    # Exact prior stage displays for multi-step regress restore.
    stage_history: list[StageSnapshot] = field(default_factory=list)
    items: list[RingItem] = field(default_factory=list)
    # stable color map symbol_id -> color
    stable_map: dict[str, int] = field(default_factory=dict)
    # shuffle: colors already used per symbol
    used_colors: dict[str, set[int]] = field(default_factory=dict)
    hint_target_id: str | None = None  # didactic white outline
    last_target_id: str | None = None  # last successfully chosen symbol
    # previous ring angles per symbol_id (degrees) to avoid same seat
    prev_angles: dict[str, float] = field(default_factory=dict)
    rng: random.Random = field(default_factory=random.Random)


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    mode = str(data.get("color_mode", "stable"))
    if mode not in ("stable", "mono", "shuffle"):
        raise ValueError(f"bad color_mode in {path}")
    mono = str(data.get("mono_color", "cyan")).lower()
    mono_idx = {
        "white": C_WHITE,
        "cyan": C_CYAN,
        "grey": C_LGREY,
        "yellow": C_YELLOW,
    }.get(mono, C_CYAN)
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        color_mode=mode,  # type: ignore[arg-type]
        random_rotation=bool(data.get("random_rotation", False)),
        allow_zoom=bool(data.get("allow_zoom", False)),
        pool_size=int(data.get("pool_size", 6)),
        ring_max=min(7, max(1, int(data.get("ring_max", 3)))),
        click_budget=int(data.get("click_budget", DEFAULT_CLICK_BUDGET)),
        mono_color=mono_idx,
        hint_didactic=bool(data.get("hint_didactic", False)),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _pick_color(lv: LevelState, symbol_id: str) -> int:
    cfg = lv.cfg
    if cfg.color_mode == "mono":
        return cfg.mono_color
    if cfg.color_mode == "stable":
        if symbol_id not in lv.stable_map:
            # assign next unused stable color cyclically by pool order
            idx = lv.pool.index(symbol_id) if symbol_id in lv.pool else 0
            lv.stable_map[symbol_id] = STABLE_COLORS[idx % len(STABLE_COLORS)]
        return lv.stable_map[symbol_id]
    # shuffle: never reuse a colour for the same symbol
    used = lv.used_colors.setdefault(symbol_id, set())
    choices = [c for c in STABLE_COLORS if c not in used]
    if not choices:
        used.clear()
        choices = list(STABLE_COLORS)
    col = lv.rng.choice(choices)
    used.add(col)
    return col


def _snapshot_stage(lv: LevelState) -> StageSnapshot:
    return StageSnapshot(
        stage=lv.stage,
        items=deepcopy(lv.items),
        prev_ids=set(lv.prev_ids),
        last_target_id=lv.last_target_id,
        hint_target_id=lv.hint_target_id,
        prev_angles=dict(lv.prev_angles),
    )


def _restore_stage(lv: LevelState, snap: StageSnapshot) -> None:
    lv.stage = snap.stage
    lv.items = deepcopy(snap.items)
    lv.prev_ids = set(snap.prev_ids)
    lv.last_target_id = snap.last_target_id
    lv.hint_target_id = snap.hint_target_id
    lv.prev_angles = dict(snap.prev_angles)


class MemoRecallEngine:
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
        level_seed = (
            DETERMINISTIC_LEVEL_SEED_BASE
            + level_index * DETERMINISTIC_LEVEL_SEED_STRIDE
            + self.levels_completed
        )
        rng = random.Random(level_seed)
        pool_ids = [g[0] for g in _GLYPHS[: max(2, min(cfg.pool_size, len(_GLYPHS)))]]
        lv = LevelState(
            cfg=cfg,
            pool=pool_ids,
            stage=0,
            clicks_left=cfg.click_budget,
            rng=rng,
        )
        self._spawn_stage(lv, first=True)
        return lv

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
        if aid != ACTION_CLICK:
            return self.public_state()
        self.step_index += 1
        frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _ring_center(self) -> tuple[int, int]:
        return FRAME // 2, (PLAY_H // 2) + 1

    def _layout_items(self, lv: LevelState) -> None:
        """Place ring items; avoid seating a returning symbol on the same angle."""
        cx, cy = self._ring_center()
        n = len(lv.items)
        if n == 0:
            return
        # Slightly wider ring when packed (6–7 symbols).
        if n <= 1:
            radius = 0
        elif n >= 6:
            radius = 21
        else:
            radius = 18
        if n == 1:
            lv.items[0].cx, lv.items[0].cy = cx, cy
            lv.items[0].angle_deg = -90.0
            lv.items[0].radius = 7 if lv.items[0].zoom else 4
            lv.prev_angles = {lv.items[0].symbol_id: -90.0}
            return

        # Candidate angles come from the fixed stream for this level/progress.
        start = lv.rng.uniform(0, 360)
        angles = [(start + i * (360 / n)) % 360 for i in range(n)]
        # Assign angles so returning symbols are not near their previous seat.
        remaining = list(angles)
        new_angles: dict[str, float] = {}
        ordered = list(lv.items)
        lv.rng.shuffle(ordered)
        for item in ordered:
            prev = lv.prev_angles.get(item.symbol_id)
            if prev is None or not remaining:
                ang = remaining.pop(0) if remaining else start
            else:
                # pick the remaining angle farthest from previous
                ang = max(
                    remaining,
                    key=lambda a: min((a - prev) % 360, (prev - a) % 360),
                )
                remaining.remove(ang)
            item.angle_deg = ang
            rad = math.radians(ang - 90)  # 0° at top
            item.cx = int(round(cx + radius * math.cos(rad)))
            item.cy = int(round(cy + radius * math.sin(rad)))
            item.radius = 7 if item.zoom else 4
            new_angles[item.symbol_id] = ang
        lv.prev_angles = new_angles

    def _make_item(self, lv: LevelState, symbol_id: str) -> RingItem:
        rot = lv.rng.randint(0, 3) if lv.cfg.random_rotation else 0
        zoom = bool(lv.cfg.allow_zoom and lv.rng.random() < 0.35)
        return RingItem(
            symbol_id=symbol_id,
            color=_pick_color(lv, symbol_id),
            rotation=rot,
            zoom=zoom,
            angle_deg=0.0,
        )

    def _spawn_stage(self, lv: LevelState, *, first: bool = False) -> None:
        cfg = lv.cfg
        if first or lv.stage == 0:
            sid = lv.rng.choice(lv.pool)
            lv.items = [self._make_item(lv, sid)]
            lv.prev_ids = set()
            # Didactic help only on stages 0–5 (disappears from stage 6 onward).
            lv.hint_target_id = sid if (cfg.hint_didactic and lv.stage < 6) else None
            self._layout_items(lv)
            return

        # Count grows with stage; clamp to [2, ring_max].
        # Last three stages of a dense level (ring_max ≥ 7) force the full ring.
        base = 2
        grow = min(cfg.ring_max, base + (lv.stage // 2))
        count = max(2, min(cfg.ring_max, grow))
        if cfg.ring_max >= 7 and lv.stage >= STAGES_TO_WIN - 3:
            count = cfg.ring_max
        # Must include ≥1 from prev_ids, but never re-ask the same target
        # except on stage 1 (second frame), where prev is the single stage-0 symbol.
        # The seeded RNG is the level's reproducibility authority.  Normalize
        # the unordered identity set before sampling so Python's per-process
        # hash randomization cannot silently select a different level trace.
        must = sorted(lv.prev_ids)
        if not must:
            must = [lv.rng.choice(lv.pool)]
        if lv.stage >= 2 and lv.last_target_id is not None:
            alt = [s for s in must if s != lv.last_target_id]
            if alt:
                must = alt
        keep = lv.rng.choice(must)
        # Exactly one valid recall target: ban every other previous-stage symbol,
        # plus last_target from stage 2 onward (never re-ask the same click).
        banned = set(lv.prev_ids) - {keep}
        if lv.stage >= 2 and lv.last_target_id is not None:
            banned.add(lv.last_target_id)
        others_pool = [s for s in lv.pool if s != keep and s not in banned]
        lv.rng.shuffle(others_pool)
        chosen = [keep] + others_pool[: count - 1]
        while len(chosen) < count:
            filler = [s for s in lv.pool if s not in chosen and s not in banned]
            if not filler:
                # Last resort: allow non-keep pool symbols, still prefer not prev.
                filler = [s for s in lv.pool if s not in chosen and s != keep]
            if not filler:
                break
            chosen.append(lv.rng.choice(filler))
        lv.rng.shuffle(chosen)
        lv.items = [self._make_item(lv, s) for s in chosen]
        lv.hint_target_id = keep if (cfg.hint_didactic and lv.stage < 6) else None
        self._layout_items(lv)

    def _hit_item(self, x: int, y: int) -> RingItem | None:
        # Prefer closest within radius
        best: RingItem | None = None
        best_d = 10**9
        for item in self._level.items:
            d = (item.cx - x) ** 2 + (item.cy - y) ** 2
            if d <= item.radius ** 2 and d < best_d:
                best = item
                best_d = d
        return best

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        lv = self._level
        item = self._hit_item(x, y)
        if item is None:
            return None

        lv.clicks_left -= 1
        frames: list[list[list[int]]] = []

        # Stage 0: any click on the only symbol succeeds.
        # Stage 1+: must be in prev_ids; from stage 2+, also ≠ last_target_id
        # (last target is not even shown, but guard anyway).
        if lv.stage == 0:
            ok = True
        elif item.symbol_id not in lv.prev_ids:
            ok = False
        elif lv.stage >= 2 and item.symbol_id == lv.last_target_id:
            ok = False
        else:
            ok = True

        # Snapshot needs the on-screen hint; flash/regress clears it for the click feedback.
        hint_before = lv.hint_target_id
        lv.hint_target_id = None

        if ok:
            frames.append(self._render_frame(flash_id=item.symbol_id, flash_color=C_GREEN))
            # Exact restore later: push the display the player just solved.
            snap = _snapshot_stage(lv)
            snap.hint_target_id = hint_before
            lv.stage_history.append(snap)
            lv.last_target_id = item.symbol_id
            lv.prev_ids = {it.symbol_id for it in lv.items}
            lv.stage += 1
            frames.append(self._render_frame(progress_flash="on"))
            if lv.stage >= STAGES_TO_WIN:
                frames.extend(self._win_frames())
                self.levels_completed += 1
                if self.levels_completed >= self.win_levels:
                    self.state = "WIN"
                else:
                    self._level = self._new_level_state(self.levels_completed)
                    self.state = "NOT_FINISHED"
                    frames.append(self._render_frame())
                return frames
            self._spawn_stage(lv)
            frames.append(self._render_frame())
        else:
            frames.append(self._render_frame(flash_id=item.symbol_id, flash_color=C_FLASH))
            # Soft regress: restore the exact previous stage display (no respawn).
            if lv.stage_history:
                _restore_stage(lv, lv.stage_history.pop())
            elif lv.stage > 0:
                lv.stage = 0
                lv.prev_ids = set()
                lv.last_target_id = None
                self._spawn_stage(lv, first=True)
            # Blink the 10 tokens red (regression signal), then show dimmed progress
            frames.append(self._render_frame(progress_flash="regress"))
            frames.append(self._render_frame(progress_flash="regress"))
            frames.append(self._render_frame(progress_flash="off"))
            frames.append(self._render_frame())

        if lv.clicks_left <= 0 and lv.stage < STAGES_TO_WIN and self.state != "WIN":
            frames.extend(self._soft_fail_frames(prefix=frames))
        return frames

    def _soft_fail_frames(
        self, prefix: list[list[list[int]]] | None = None
    ) -> list[list[list[int]]]:
        frames = list(prefix or [])
        pre = self._render_frame()
        for i in range(4):
            if i % 2 == 0:
                frames.append(self._recolor_play(pre, C_FLASH))
            else:
                frames.append([row[:] for row in pre])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = self._new_level_state(idx)
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())
        return frames

    def _win_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_play(base, C_WHITE))
            frames.append([row[:] for row in base])
            frames.append([row[:] for row in base])
        return frames

    @staticmethod
    def _recolor_play(frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(PLAY_H):
            for x in range(FRAME):
                if out[y][x] != C_BG:
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
        available = ["ACTION6", "ACTION7"]
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
                self.info.default_fps, 8 if len(frames) > 1 else self.info.default_fps
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
            "stage": lv.stage,
            "stages_to_win": STAGES_TO_WIN,
            "clicks_left": lv.clicks_left,
            "click_budget": lv.cfg.click_budget,
            "color_mode": lv.cfg.color_mode,
            "items": [
                {
                    "symbol_id": it.symbol_id,
                    "cx": it.cx,
                    "cy": it.cy,
                    "zoom": it.zoom,
                    "rotation": it.rotation,
                    "color": it.color,
                    "angle_deg": it.angle_deg,
                }
                for it in lv.items
            ],
        }

    def _render_frame(
        self,
        *,
        flash_id: str | None = None,
        flash_color: int = C_FLASH,
        progress_flash: str | None = None,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level

        def set_px(y: int, x: int, c: int) -> None:
            if 0 <= y < FRAME and 0 <= x < FRAME:
                frame[y][x] = c

        def stroke_circle_1px(cx: int, cy: int, radius: int, color: int = C_WHITE) -> None:
            """Simple hollow circle, exactly 1px thick."""
            for a in range(0, 360, 6):
                ang = math.radians(a)
                set_px(
                    int(round(cy + radius * math.sin(ang))),
                    int(round(cx + radius * math.cos(ang))),
                    color,
                )

        def paint_glyph(item: RingItem) -> None:
            kind_pat = GLYPH_BY_ID.get(item.symbol_id)
            if not kind_pat:
                return
            _kind, pat = kind_pat
            pat = _rotate_pattern(pat, item.rotation)
            scale = 2 if item.zoom else 1
            n = len(pat)
            ink = flash_color if flash_id == item.symbol_id else item.color
            ox = item.cx - (n * scale) // 2
            oy = item.cy - (n * scale) // 2
            for r, row in enumerate(pat):
                for c, ch in enumerate(row):
                    if ch != "#":
                        continue
                    for dy in range(scale):
                        for dx in range(scale):
                            set_px(oy + r * scale + dy, ox + c * scale + dx, ink)
            # Thin white circle help — only while didactic and stage < 6
            if lv.hint_target_id == item.symbol_id and lv.stage < 6:
                glyph_half = (n * scale) // 2
                # Small gap outside the glyph, 1px ring only.
                ring_r = glyph_half + 2
                stroke_circle_1px(item.cx, item.cy, ring_r, C_WHITE)

        # Big 10 stage tokens at the top (clear progress / regress)
        self._draw_stage_tokens(frame, progress_flash=progress_flash)

        # faint guide circle
        cx, cy = self._ring_center()
        if len(lv.items) > 1:
            guide_r = 21 if len(lv.items) >= 6 else 18
            for a in range(0, 360, 12):
                ang = math.radians(a)
                set_px(
                    int(round(cy + guide_r * math.sin(ang))),
                    int(round(cx + guide_r * math.cos(ang))),
                    C_RING,
                )

        for item in lv.items:
            paint_glyph(item)

        self._draw_hud(frame)
        return frame

    def _draw_stage_tokens(
        self, frame: list[list[int]], *, progress_flash: str | None = None
    ) -> None:
        """10 large tokens: lit = progress; regress blinks red then dims one."""
        lv = self._level
        tok_w, tok_h, gap = 5, 4, 1
        total = STAGES_TO_WIN * tok_w + (STAGES_TO_WIN - 1) * gap
        x0 = max(1, (FRAME - total) // 2)
        y0 = 1
        lit = lv.stage
        if progress_flash == "on":
            # briefly brighten the newly lit token
            pass
        for i in range(STAGES_TO_WIN):
            xx = x0 + i * (tok_w + gap)
            if progress_flash == "regress":
                col = C_FLASH
            elif i < lit:
                col = C_GREEN if progress_flash != "off" else C_GREEN
            else:
                col = C_DGREY
            if progress_flash == "on" and i == lit - 1 and lit > 0:
                col = C_WHITE
            for dy in range(tok_h):
                for dx in range(tok_w):
                    y, x = y0 + dy, xx + dx
                    if 0 <= y < PLAY_H and 0 <= x < FRAME:
                        frame[y][x] = col
            # 1px black separator feel via gap already

    def _draw_hud(self, frame: list[list[int]]) -> None:
        lv = self._level
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD

        # Level counter pips (center)
        n = self.win_levels
        gap = 2
        pip_w = 3
        total = n * pip_w + (n - 1) * gap
        x_mid = max(1, (FRAME - total) // 2)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            xx = x_mid + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col

        # Click resource (15) — full-width-ish left strip under level pips left side
        budget = lv.cfg.click_budget
        for i in range(budget):
            x = 1 + i
            if x >= FRAME:
                break
            if lv.clicks_left <= 0:
                col = C_FLASH
            elif i < lv.clicks_left:
                col = C_LGREY
            else:
                col = C_MGREY
            for h in range(1, HUD_H - 1):
                frame[y0 + h][x] = col
