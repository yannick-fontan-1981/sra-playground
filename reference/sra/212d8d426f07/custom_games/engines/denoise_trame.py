"""DNOI — repair noisy pixels via ARC-2 consensus denoise prior.

Controls:
  ACTION6 click — toggle cell broken ↔ correct (also breaks initially-good cells)
  ACTION7       — soft reset level

Spec (from ARC-2 constelize pattern_detection):
  group_similar(lines, min_group_size=3, similarity_threshold=0.7)
  detect_noise via row/column group modes; denoise rewrites outliers.
  Grids are always >= 9×9 so the denoise guard passes.
"""

from __future__ import annotations

import json
import random
from collections import defaultdict
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
C_VIOLET = 15

C_BG = C_BLACK
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_HUD_CUR = C_YELLOW
C_FLASH = C_RED
C_GRID = C_DGREY

ACTION_CLICK, ACTION_RESET = 6, 7
FRAME = 64
HUD_H = 5
PLAY_H = FRAME - HUD_H
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "denoise_trame" / "levels"

Grid = list[list[int]]


# --- ARC-2 denoise (constelize-compatible) ------------------------------------

def group_similar(
    lines: list[list[int]] | list[tuple[int, ...]],
    min_group_size: int = 3,
    similarity_threshold: float = 0.7,
) -> list[list[int]]:
    groups: list[list[int]] = []
    n = len(lines)
    visited: set[int] = set()
    for i in range(n):
        if i in visited:
            continue
        current = [i]
        for j in range(i + 1, n):
            if j in visited:
                continue
            matches = sum(1 for a, b in zip(lines[i], lines[j]) if a == b)
            similarity = matches / max(1, len(lines[i]))
            if similarity >= similarity_threshold:
                current.append(j)
                visited.add(j)
        if len(current) >= min_group_size:
            groups.append(current)
            visited.update(current)
    return groups


def detect_noise(grid: Grid) -> dict[tuple[int, int], int]:
    if len(grid) < 9 or not grid or len(grid[0]) < 9:
        return {}
    rows = grid
    cols = list(zip(*grid))
    noise_map: dict[tuple[int, int], int] = {}

    for group in group_similar(rows):
        for col_idx in range(len(rows[0])):
            values = [rows[row_idx][col_idx] for row_idx in group]
            freq: dict[int, int] = defaultdict(int)
            for v in values:
                freq[v] += 1
            max_freq = max(freq.values(), default=0)
            candidates = [k for k, v in freq.items() if v == max_freq]
            if not candidates:
                continue
            correct = min(candidates)
            for row_idx in group:
                if rows[row_idx][col_idx] != correct:
                    noise_map[(row_idx, col_idx)] = correct

    for group in group_similar(cols):
        for row_idx in range(len(cols[0])):
            values = [cols[col_idx][row_idx] for col_idx in group]
            freq = defaultdict(int)
            for v in values:
                freq[v] += 1
            max_freq = max(freq.values(), default=0)
            candidates = [k for k, v in freq.items() if v == max_freq]
            if not candidates:
                continue
            correct = min(candidates)
            for col_idx in group:
                if cols[col_idx][row_idx] != correct:
                    noise_map[(row_idx, col_idx)] = correct

    return noise_map


def denoise_grid(grid: Grid, noise_map: dict[tuple[int, int], int]) -> Grid:
    out = [row[:] for row in grid]
    for (i, j), color in noise_map.items():
        out[i][j] = color
    return out


def denoise(grid: Grid) -> Grid:
    return denoise_grid(grid, detect_noise(grid))


# --- level generation ---------------------------------------------------------

@dataclass
class LevelConfig:
    name: str
    grid_n: int
    trame_colors: list[int]
    noise_mode: Literal["foreign", "camouflage"]
    noise_colors: list[int]
    noise_count: int
    group_size: int
    seed: int
    cell_px: int
    # Motif period (tiled in X and Y). Random blocks of mixed sizes inside.
    tile_w: int
    tile_h: int


@dataclass
class LevelState:
    cfg: LevelConfig
    initial: Grid
    target: Grid
    current: Grid
    rng: random.Random = field(default_factory=random.Random)


def _fit_period(n: int, preferred: int) -> int:
    """Largest divisor of n that is >=2 and <=preferred (fallback: smallest >=2)."""
    preferred = max(2, min(n, preferred))
    for p in range(preferred, 1, -1):
        if n % p == 0:
            return p
    for p in range(2, n + 1):
        if n % p == 0:
            return p
    return n


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    n = max(9, int(data.get("grid_n", 9)))
    # Period must divide n so tiling is exact in both axes.
    tw = _fit_period(n, int(data.get("tile_w", 3)))
    th = _fit_period(n, int(data.get("tile_h", tw)))
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        grid_n=n,
        trame_colors=[int(c) for c in data["trame_colors"]],
        noise_mode=str(data.get("noise_mode", "foreign")),  # type: ignore[arg-type]
        noise_colors=[int(c) for c in data.get("noise_colors", [])],
        noise_count=int(data.get("noise_count", 4)),
        group_size=max(3, int(data.get("group_size", 3))),
        seed=int(data.get("seed", 1)),
        cell_px=max(3, int(data.get("cell_px", 5))),
        tile_w=tw,
        tile_h=th,
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _paint_mixed_blocks(
    tw: int, th: int, colors: list[int], rng: random.Random
) -> Grid:
    """Fill a motif with random axis-aligned blocks of mixed widths/heights."""
    if len(colors) < 2:
        colors = list(colors) + list(colors)
    motif: Grid = [[-1 for _ in range(tw)] for _ in range(th)]

    def rand_span(remain: int) -> int:
        choices = [s for s in (1, 2, 3) if s <= remain]
        return rng.choice(choices) if choices else remain

    guard = tw * th * 6
    while any(motif[r][c] < 0 for r in range(th) for c in range(tw)) and guard > 0:
        guard -= 1
        empties = [(r, c) for r in range(th) for c in range(tw) if motif[r][c] < 0]
        if not empties:
            break
        r0, c0 = rng.choice(empties)
        bw = rand_span(tw - c0)
        bh = rand_span(th - r0)
        col = rng.choice(colors)
        for r in range(r0, min(th, r0 + bh)):
            for c in range(c0, min(tw, c0 + bw)):
                if motif[r][c] < 0:
                    motif[r][c] = col
    for r in range(th):
        for c in range(tw):
            if motif[r][c] < 0:
                motif[r][c] = rng.choice(colors)
    # Ensure the motif actually uses ≥2 colours (otherwise trame is flat / illisible).
    used = {motif[r][c] for r in range(th) for c in range(tw)}
    if len(used) < 2 and len(colors) >= 2:
        motif[rng.randrange(th)][rng.randrange(tw)] = next(
            c for c in colors if c not in used
        )
    return motif


def _make_trame(
    n: int,
    colors: list[int],
    tile_w: int,
    tile_h: int,
    rng: random.Random,
) -> Grid:
    """Random mixed-size motif, then tile it exactly in X and Y (periods | n)."""
    tw = _fit_period(n, tile_w)
    th = _fit_period(n, tile_h)
    motif = _paint_mixed_blocks(tw, th, colors, rng)
    return [[motif[r % th][c % tw] for c in range(n)] for r in range(n)]


def _is_periodic(grid: Grid, tw: int, th: int) -> bool:
    n = len(grid)
    if tw <= 0 or th <= 0 or n % tw != 0 or n % th != 0:
        return False
    for r in range(n - th):
        if grid[r] != grid[r + th]:
            return False
    for r in range(n):
        for c in range(n - tw):
            if grid[r][c] != grid[r][c + tw]:
                return False
    return True


def _inject_noise(
    clean: Grid,
    *,
    noise_colors: list[int],
    count: int,
    rng: random.Random,
) -> Grid:
    n = len(clean)
    noisy = [row[:] for row in clean]
    # Candidates: cells where we can place a colour different from clean.
    positions = [(r, c) for r in range(n) for c in range(n)]
    rng.shuffle(positions)
    placed = 0
    for r, c in positions:
        if placed >= count:
            break
        choices = [col for col in noise_colors if col != clean[r][c]]
        if not choices:
            continue
        noisy[r][c] = rng.choice(choices)
        placed += 1
    return noisy


def _generate_puzzle(cfg: LevelConfig, rng: random.Random) -> tuple[Grid, Grid]:
    """Return (noisy_initial, target_clean).

    Hard rule: target is always the tiled trame, and denoise(noisy) must equal it.
    Never accept a denoise 'recovery' that invents a non-periodic / illogical grid.
    """
    n = cfg.grid_n
    if cfg.noise_mode == "foreign":
        noise_cols = [c for c in cfg.noise_colors if c not in cfg.trame_colors]
        if not noise_cols:
            noise_cols = list(cfg.noise_colors)
    else:
        noise_cols = list(cfg.trame_colors)

    tw = _fit_period(n, cfg.tile_w)
    th = _fit_period(n, cfg.tile_h)

    # Try full noise_count, then progressively fewer so consensus stays ≥0.7.
    for count in [cfg.noise_count, max(1, cfg.noise_count * 2 // 3), max(1, cfg.noise_count // 2), max(1, cfg.noise_count // 3)]:
        for _ in range(60):
            clean = _make_trame(n, cfg.trame_colors, tw, th, rng)
            if not _is_periodic(clean, tw, th):
                continue
            noisy = _inject_noise(
                clean, noise_colors=noise_cols, count=count, rng=rng
            )
            if noisy == clean:
                continue
            if denoise(noisy) == clean:
                return noisy, clean

    # Guaranteed fallback: tiny foreign/camouflage noise that denoise must catch.
    clean = _make_trame(n, cfg.trame_colors, tw, th, rng)
    noisy = [row[:] for row in clean]
    # Flip one cell in a way that keeps row/col groups intact.
    r = th  # second period row (same as row 0)
    c = tw
    alt = [x for x in noise_cols if x != clean[r][c]] or noise_cols
    noisy[r][c] = rng.choice(alt)
    if denoise(noisy) != clean:
        # Last-ditch: use clean as both (unsolvable noise) — still periodic/logical.
        return clean, clean
    return noisy, clean


# --- engine -------------------------------------------------------------------

class DenoiseTrameEngine:
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
        rng = random.Random(cfg.seed + level_index * 31 + self.levels_completed * 7)
        initial, target = _generate_puzzle(cfg, rng)
        return LevelState(
            cfg=cfg,
            initial=deepcopy(initial),
            target=deepcopy(target),
            current=deepcopy(initial),
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
        # Keep same puzzle instance by regenerating from fixed seed path
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
            # Soft reset restores initial noise of current level instance
            lv = self._level
            lv.current = deepcopy(lv.initial)
            self.last_action = "ACTION7"
            self._pending_frames = None
            if self.state != "WIN":
                self.state = "NOT_FINISHED"
            return self.public_state()
        self.last_action = f"ACTION{aid}"
        if aid != ACTION_CLICK:
            return self.public_state()
        self.step_index += 1
        frames = self._click(int(data.get("x", -1)), int(data.get("y", -1)))
        if frames:
            self._pending_frames = frames
        return self.public_state()

    def _geom(self) -> tuple[int, int, int, int]:
        lv = self._level
        n = lv.cfg.grid_n
        cell = lv.cfg.cell_px
        gap = 1
        bw = n * cell + (n - 1) * gap
        bh = n * cell + (n - 1) * gap
        # Shrink cell if needed to fit play area
        while (bw > FRAME - 2 or bh > PLAY_H - 4) and cell > 2:
            cell -= 1
            bw = n * cell + (n - 1) * gap
            bh = n * cell + (n - 1) * gap
        ox = max(1, (FRAME - bw) // 2)
        oy = max(2, (PLAY_H - bh) // 2)
        return cell, gap, ox, oy

    def _cell_at(self, x: int, y: int) -> tuple[int, int] | None:
        lv = self._level
        n = lv.cfg.grid_n
        cell, gap, ox, oy = self._geom()
        step = cell + gap
        if not (ox <= x < ox + n * step and oy <= y < oy + n * step):
            return None
        c = (x - ox) // step
        r = (y - oy) // step
        if r < 0 or c < 0 or r >= n or c >= n:
            return None
        return int(r), int(c)

    def _palette(self) -> list[int]:
        present = {col for row in self._level.current for col in row}
        return sorted(present)

    def _remaining_errors(self) -> int:
        lv = self._level
        n = lv.cfg.grid_n
        return sum(
            1
            for r in range(n)
            for c in range(n)
            if lv.current[r][c] != lv.target[r][c]
        )

    def _broken_color(self, r: int, c: int) -> int:
        """Colour used as the broken side of the binary toggle for cell (r,c).

        Prefers the puzzle's initial noise colour. If the cell started correct
        (initial == target), pick a stable alternate from the level palette so
        the player can still break it and toggle back.
        """
        lv = self._level
        good = lv.target[r][c]
        init = lv.initial[r][c]
        if init != good:
            return init
        pool = list(lv.cfg.noise_colors) + list(lv.cfg.trame_colors)
        alts = [col for col in pool if col != good]
        if not alts:
            alts = [col for col in range(16) if col not in (good, C_BG)]
        return min(alts)

    def _click(self, x: int, y: int) -> list[list[list[int]]] | None:
        pos = self._cell_at(x, y)
        if pos is None:
            return None
        r, c = pos
        lv = self._level
        good = lv.target[r][c]
        broken = self._broken_color(r, c)
        cur = lv.current[r][c]
        # Binary toggle: broken ↔ good (works on initially-correct cells too).
        lv.current[r][c] = good if cur != good else broken
        frames = [self._render_frame(pulse=(r, c))]
        frames.append(self._render_frame())
        if self._remaining_errors() == 0:
            frames.extend(self._win_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = self._new_level_state(self.levels_completed)
                self.state = "NOT_FINISHED"
                frames.append(self._render_frame())
        return frames

    def _win_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for _ in range(3):
            frames.append(self._recolor_nonbg(base, C_WHITE))
            frames.append([row[:] for row in base])
            frames.append([row[:] for row in base])
        return frames

    @staticmethod
    def _recolor_nonbg(frame: list[list[int]], color: int) -> list[list[int]]:
        out = [row[:] for row in frame]
        for y in range(FRAME):
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
            "grid_n": lv.cfg.grid_n,
            "noise_mode": lv.cfg.noise_mode,
            "errors_remaining": self._remaining_errors(),
            "palette": self._palette(),
        }

    def _render_frame(self, *, pulse: tuple[int, int] | None = None) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level
        n = lv.cfg.grid_n
        cell, gap, ox, oy = self._geom()
        for r in range(n):
            for c in range(n):
                x0 = ox + c * (cell + gap)
                y0 = oy + r * (cell + gap)
                ink = lv.current[r][c]
                for dy in range(cell):
                    for dx in range(cell):
                        xx, yy = x0 + dx, y0 + dy
                        if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                            frame[yy][xx] = ink
                # Pulse = white outline only (keep fill colour).
                if pulse == (r, c) and cell >= 2:
                    for dx in range(cell):
                        for yy, xx in (
                            (y0, x0 + dx),
                            (y0 + cell - 1, x0 + dx),
                        ):
                            if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                                frame[yy][xx] = C_WHITE
                    for dy in range(cell):
                        for yy, xx in (
                            (y0 + dy, x0),
                            (y0 + dy, x0 + cell - 1),
                        ):
                            if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                                frame[yy][xx] = C_WHITE
        # faint separators
        for i in range(1, n):
            xx = ox + i * (cell + gap) - gap
            yy0 = oy
            yy1 = oy + n * (cell + gap)
            for yy in range(yy0, min(PLAY_H, yy1)):
                if 0 <= xx < FRAME and gap > 0:
                    frame[yy][xx] = C_GRID
            yy = oy + i * (cell + gap) - gap
            for xx in range(ox, min(FRAME, ox + n * (cell + gap))):
                if 0 <= yy < PLAY_H and gap > 0:
                    frame[yy][xx] = C_GRID
        self._draw_hud(frame)
        return frame

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        n = self.win_levels
        gap, pip_w = 2, 3
        total = n * pip_w + (n - 1) * gap
        # Level counter flush-right (leave 1px margin).
        x0_levels = max(1, FRAME - 1 - total)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_HUD_CUR if i == done else C_HUD_SLOT)
            )
            xx = x0_levels + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, min(FRAME, xx + pip_w)):
                    frame[y][x] = col
        # error pips (remaining mistakes) on the left — capped display
        err = min(20, self._remaining_errors())
        for i in range(err):
            x = 1 + i
            if x >= x0_levels - 2:
                break
            for y in range(y0 + 1, FRAME - 1):
                frame[y][x] = C_FLASH
