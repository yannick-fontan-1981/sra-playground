"""SYME — repair hidden-axis symmetry (ARC-2 style), DNOI-like UX.

Controls:
  ACTION6 click — toggle cell broken ↔ correct (also breaks initially-good cells)
  ACTION7       — soft reset to initial broken grid

No symmetry axis is drawn; the player must infer H / V / HV / diagonal / rot180.
"""

from __future__ import annotations

import json
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
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "symmetry_fix" / "levels"

Grid = list[list[int]]
SymMode = Literal["h", "v", "hv", "diag", "adiag", "rot180", "h_or_v"]


def _mirror_sources(n: int, r: int, c: int, mode: SymMode) -> list[tuple[int, int]]:
    """Return reflection / rotation partner cells for (r,c)."""
    srcs: list[tuple[int, int]] = []
    if mode in ("h", "hv"):
        srcs.append((r, n - 1 - c))
    if mode in ("v", "hv"):
        srcs.append((n - 1 - r, c))
    if mode == "diag":
        srcs.append((c, r))
    if mode == "adiag":
        srcs.append((n - 1 - c, n - 1 - r))
    if mode == "rot180":
        srcs.append((n - 1 - r, n - 1 - c))
    return srcs


def _enforce_symmetry(grid: Grid, mode: SymMode) -> Grid:
    """Make grid exactly symmetric by copying into the 'upper' half then mirroring."""
    n = len(grid)
    out = [row[:] for row in grid]
    if mode == "h":
        for r in range(n):
            for c in range((n + 1) // 2):
                out[r][n - 1 - c] = out[r][c]
    elif mode == "v":
        for r in range((n + 1) // 2):
            for c in range(n):
                out[n - 1 - r][c] = out[r][c]
    elif mode == "hv":
        out = _enforce_symmetry(out, "h")
        out = _enforce_symmetry(out, "v")
    elif mode == "diag":
        for r in range(n):
            for c in range(r + 1, n):
                out[c][r] = out[r][c]
    elif mode == "adiag":
        for r in range(n):
            for c in range(n):
                rr, cc = n - 1 - c, n - 1 - r
                if (r, c) < (rr, cc):
                    out[rr][cc] = out[r][c]
    elif mode == "rot180":
        for r in range(n):
            for c in range(n):
                rr, cc = n - 1 - r, n - 1 - c
                if (r, c) <= (rr, cc):
                    out[rr][cc] = out[r][c]
    return out


def _is_symmetric(grid: Grid, mode: SymMode) -> bool:
    n = len(grid)
    for r in range(n):
        for c in range(n):
            for rr, cc in _mirror_sources(n, r, c, mode):
                if grid[r][c] != grid[rr][cc]:
                    return False
    return True


def _apply_symmetry_fill(grid: Grid, mode: SymMode, holes: list[tuple[int, int]]) -> Grid:
    """Fill holes from mirror partners (constelize-style, multi-source fallback)."""
    n = len(grid)
    new = [row[:] for row in grid]
    hole_set = set(holes)
    for i, j in holes:
        filled = False
        for src in _mirror_sources(n, i, j, mode):
            if src not in hole_set and 0 <= src[0] < n and 0 <= src[1] < n:
                new[i][j] = grid[src[0]][src[1]]
                filled = True
                break
        if not filled:
            for src in _mirror_sources(n, i, j, mode):
                if 0 <= src[0] < n and 0 <= src[1] < n:
                    new[i][j] = grid[src[0]][src[1]]
                    break
    return new


def _collect_holes(grid: Grid, mode: SymMode) -> list[tuple[int, int]]:
    n = len(grid)
    holes: list[tuple[int, int]] = []
    seen: set[tuple[int, int]] = set()
    for r in range(n):
        for c in range(n):
            for rr, cc in _mirror_sources(n, r, c, mode):
                if grid[r][c] != grid[rr][cc]:
                    for p in ((r, c), (rr, cc)):
                        if p not in seen:
                            holes.append(p)
                            seen.add(p)
    return holes


@dataclass
class LevelConfig:
    name: str
    grid_n: int
    symmetry: SymMode
    figure_colors: list[int]
    hole_mode: Literal["foreign", "camouflage"]
    hole_colors: list[int]
    hole_count: int
    seed: int
    cell_px: int


@dataclass
class LevelState:
    cfg: LevelConfig
    symmetry: SymMode
    initial: Grid
    target: Grid
    current: Grid
    rng: random.Random = field(default_factory=random.Random)


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    n = max(9, int(data.get("grid_n", 9)))
    sym = str(data.get("symmetry", "h"))
    if sym not in ("h", "v", "hv", "diag", "adiag", "rot180", "h_or_v"):
        raise ValueError(f"bad symmetry {sym}")
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        grid_n=n,
        symmetry=sym,  # type: ignore[arg-type]
        figure_colors=[int(c) for c in data["figure_colors"]],
        hole_mode=str(data.get("hole_mode", "foreign")),  # type: ignore[arg-type]
        hole_colors=[int(c) for c in data.get("hole_colors", [])],
        hole_count=int(data.get("hole_count", 4)),
        seed=int(data.get("seed", 1)),
        cell_px=max(3, int(data.get("cell_px", 5))),
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _paint_figure(n: int, colors: list[int], rng: random.Random) -> Grid:
    """Random mixed blocks on a free canvas (before symmetry enforcement)."""
    grid: Grid = [[-1 for _ in range(n)] for _ in range(n)]

    def span(remain: int) -> int:
        choices = [s for s in (1, 2, 3, 4) if s <= remain]
        return rng.choice(choices) if choices else remain

    guard = n * n * 5
    while any(grid[r][c] < 0 for r in range(n) for c in range(n)) and guard > 0:
        guard -= 1
        empties = [(r, c) for r in range(n) for c in range(n) if grid[r][c] < 0]
        if not empties:
            break
        r0, c0 = rng.choice(empties)
        bw, bh = span(n - c0), span(n - r0)
        col = rng.choice(colors)
        for r in range(r0, min(n, r0 + bh)):
            for c in range(c0, min(n, c0 + bw)):
                if grid[r][c] < 0:
                    grid[r][c] = col
    for r in range(n):
        for c in range(n):
            if grid[r][c] < 0:
                grid[r][c] = rng.choice(colors)
    return grid


def _orbit(n: int, r: int, c: int, mode: SymMode) -> set[tuple[int, int]]:
    """Closure of (r,c) under the symmetry generators of `mode`."""
    pts: set[tuple[int, int]] = {(r, c)}
    changed = True
    while changed:
        changed = False
        for p in list(pts):
            for q in _mirror_sources(n, p[0], p[1], mode):
                if q not in pts:
                    pts.add(q)
                    changed = True
    return pts


def _inject_holes(
    clean: Grid,
    mode: SymMode,
    *,
    hole_colors: list[int],
    count: int,
    rng: random.Random,
    require_triple_consensus: bool = False,
) -> Grid:
    """Break symmetry on `count` cells — at most one break per orbit.

    For camouflage + double axes (HV), orbits have 4 cells: keep 3 intact so the
    wrong pixel is forced by triple agreement (no unique foreign colour needed).
    """
    n = len(clean)
    noisy = [row[:] for row in clean]
    positions = [(r, c) for r in range(n) for c in range(n)]
    rng.shuffle(positions)
    placed = 0
    used_orbits: set[frozenset[tuple[int, int]]] = set()
    for r, c in positions:
        if placed >= count:
            break
        orb = _orbit(n, r, c, mode)
        if len(orb) < 2:
            continue  # fixed point
        # Camouflage under HV needs a full 4-orbit (3 copies force the 4th).
        if require_triple_consensus and len(orb) < 4:
            continue
        key = frozenset(orb)
        if key in used_orbits:
            continue
        choices = [col for col in hole_colors if col != clean[r][c]]
        if not choices:
            continue
        # Break exactly one cell; leave the rest of the orbit as the consensus.
        noisy[r][c] = rng.choice(choices)
        used_orbits.add(key)
        placed += 1
    return noisy


def _resolve_mode(cfg: LevelConfig, rng: random.Random) -> SymMode:
    if cfg.symmetry == "h_or_v":
        return rng.choice(("h", "v"))
    return cfg.symmetry


def _generate_puzzle(cfg: LevelConfig, rng: random.Random) -> tuple[SymMode, Grid, Grid]:
    """Return (mode, noisy, clean_symmetric)."""
    n = cfg.grid_n
    mode = _resolve_mode(cfg, rng)
    if cfg.hole_mode == "foreign":
        holes_cols = [c for c in cfg.hole_colors if c not in cfg.figure_colors]
        if not holes_cols:
            holes_cols = list(cfg.hole_colors)
    else:
        holes_cols = list(cfg.figure_colors)

    for count in (
        cfg.hole_count,
        max(1, cfg.hole_count * 2 // 3),
        max(1, cfg.hole_count // 2),
        1,
    ):
        for _ in range(50):
            raw = _paint_figure(n, cfg.figure_colors, rng)
            clean = _enforce_symmetry(raw, mode)
            if not _is_symmetric(clean, mode):
                continue
            need_triple = cfg.hole_mode == "camouflage" and mode == "hv"
            noisy = _inject_holes(
                clean,
                mode,
                hole_colors=holes_cols,
                count=count,
                rng=rng,
                require_triple_consensus=need_triple,
            )
            if noisy == clean:
                continue
            # Each broken cell must keep ≥1 intact partner showing the correct colour
            # (so the player can infer the fix). Do not use collect_holes+fill here:
            # that marks both sides of a mismatch as holes and rejects dense puzzles.
            ok = True
            broken_n = 0
            for r in range(n):
                for c in range(n):
                    if noisy[r][c] == clean[r][c]:
                        continue
                    broken_n += 1
                    partners = _mirror_sources(n, r, c, mode)
                    if not any(
                        noisy[pr][pc] == clean[r][c] for pr, pc in partners
                    ):
                        ok = False
                        break
                if not ok:
                    break
            if ok and broken_n > 0:
                return mode, noisy, clean

    clean = _enforce_symmetry(_paint_figure(n, cfg.figure_colors, rng), mode)
    need_triple = cfg.hole_mode == "camouflage" and mode == "hv"
    noisy = _inject_holes(
        clean,
        mode,
        hole_colors=holes_cols,
        count=max(1, cfg.hole_count),
        rng=rng,
        require_triple_consensus=need_triple,
    )
    return mode, noisy, clean


class SymmetryFixEngine:
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
        rng = random.Random(cfg.seed + level_index * 41 + self.levels_completed * 9)
        mode, initial, target = _generate_puzzle(cfg, rng)
        return LevelState(
            cfg=cfg,
            symmetry=mode,
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

        Prefers the puzzle's initial hole colour. If the cell started correct
        (initial == target), pick a stable alternate from the level palette so
        the player can still break it and toggle back.
        """
        lv = self._level
        good = lv.target[r][c]
        init = lv.initial[r][c]
        if init != good:
            return init
        pool = list(lv.cfg.hole_colors) + list(lv.cfg.figure_colors)
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
        frames = [self._render_frame(pulse=(r, c)), self._render_frame()]
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
            "symmetry": lv.symmetry,
            "hole_mode": lv.cfg.hole_mode,
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
                if pulse == (r, c) and cell >= 2:
                    for dx in range(cell):
                        for yy, xx in ((y0, x0 + dx), (y0 + cell - 1, x0 + dx)):
                            if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                                frame[yy][xx] = C_WHITE
                    for dy in range(cell):
                        for yy, xx in ((y0 + dy, x0), (y0 + dy, x0 + cell - 1)):
                            if 0 <= yy < PLAY_H and 0 <= xx < FRAME:
                                frame[yy][xx] = C_WHITE
        for i in range(1, n):
            xx = ox + i * (cell + gap) - gap
            for yy in range(oy, min(PLAY_H, oy + n * (cell + gap))):
                if gap > 0 and 0 <= xx < FRAME:
                    frame[yy][xx] = C_GRID
            yy = oy + i * (cell + gap) - gap
            for xx in range(ox, min(FRAME, ox + n * (cell + gap))):
                if gap > 0 and 0 <= yy < PLAY_H:
                    frame[yy][xx] = C_GRID
        # No symmetry axis drawn — must be inferred.
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
        err = min(20, self._remaining_errors())
        for i in range(err):
            x = 1 + i
            if x >= x0_levels - 2:
                break
            for y in range(y0 + 1, FRAME - 1):
                frame[y][x] = C_FLASH
