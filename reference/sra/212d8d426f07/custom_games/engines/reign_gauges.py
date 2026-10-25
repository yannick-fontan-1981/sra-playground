"""REGN — multi-gauge RGB equilibrium (pixel layout from reference ASCII).

Controls:
  ACTION3 LEFT  — take the bottom-left trio
  ACTION4 RIGHT — take the bottom-right trio
  ACTION7       — soft reset current level

Layout (64×64, black bg) matches docs reference / REGN.txt:
  - Left/right choice columns (13px) with 3×3 glyphs `.AAA.BBB.CCC.`
  - Bottom choice row white-outlined
  - Center: R/G/B gauge wells (5px) + slot columns for placed tokens
  - Step pips near top; dotted white limit marks on wells

Rules:
  - Consumables +/- fire once then vanish
  - Recurring up/down triangles fire every turn and stay
  - Transfers: right-triangle + bar-after only (triangle loses Δ, bar gains Δ), permanent
  - Steps to win: 10 on L01, +1 each level
  - Optional delta_px (1 or 2) and start_tokens for difficulty
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
C_VIOLET = 15  # ARC #A356D6 (unused for limits now)

C_BG = C_BLACK
C_STRUCT = C_DGREY  # 'g' in ASCII
C_LIMIT = C_WHITE  # dotted limit marks (white / gauge colour)
C_FLASH = C_RED

ACTION_LEFT, ACTION_RIGHT, ACTION_RESET = 3, 4, 7
FRAME = 64
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "reign_gauges" / "levels"

GaugeColor = Literal["red", "green", "blue"]
# xfer = right triangle + bar after only (no bar-before variant).
TokenKind = Literal["plus", "minus", "up", "down", "xfer"]

GAUGE_COLORS: tuple[GaugeColor, ...] = ("red", "green", "blue")
COLOR_TO_IDX: dict[GaugeColor, int] = {
    "red": C_RED,
    "green": C_GREEN,
    "blue": C_BLUE,
}
OTHER_COLORS: dict[GaugeColor, tuple[GaugeColor, GaugeColor]] = {
    "red": ("green", "blue"),
    "green": ("red", "blue"),
    "blue": ("red", "green"),
}

# Pixel geometry from reference ASCII
LEFT_X0, LEFT_W = 0, 13
RIGHT_X0, RIGHT_W = 51, 13
# gauge wells x ranges (inclusive)
GAUGE_X = {"red": (14, 18), "green": (26, 30), "blue": (38, 42)}
# token slots to the right of each gauge
SLOT_X = {"red": (20, 24), "green": (32, 36), "blue": (44, 49)}
STRUCT_COLS = (13, 19, 25, 31, 37, 43, 50)
WELL_TOP = 5
WELL_BOTTOM = 63
STEP_Y0, STEP_Y1 = 1, 2
SEP_Y = 4
ACTIVE_GLYPH_Y0 = 60  # inside white frame
ACTIVE_FRAME_Y0, ACTIVE_FRAME_Y1 = 59, 63


@dataclass
class Token:
    color: GaugeColor
    kind: TokenKind
    bar_color: GaugeColor | None = None


@dataclass
class ChoiceRow:
    left: list[Token]
    right: list[Token]


@dataclass
class LevelConfig:
    name: str
    steps_to_win: int
    limit_low: int
    limit_high: int
    start_fill: int
    visible_rows: int
    consumable_weight: float
    recurring_weight: float
    transfer_weight: float
    valid_path_count: int
    forbid_constant_direction: bool
    seed: int
    delta_px: int
    start_tokens: list[Token]


@dataclass
class GaugeState:
    fill: int
    consumables: list[Token] = field(default_factory=list)
    recurrings: list[Token] = field(default_factory=list)
    transfers: list[Token] = field(default_factory=list)


@dataclass
class LevelState:
    cfg: LevelConfig
    gauges: dict[GaugeColor, GaugeState]
    queue: list[ChoiceRow] = field(default_factory=list)
    steps_done: int = 0
    rng: random.Random = field(default_factory=random.Random)
    secret_path: list[str] = field(default_factory=list)
    valid_paths: list[str] = field(default_factory=list)


def _parse_token(data: dict[str, Any]) -> Token:
    color = str(data["color"]).lower()
    kind = str(data["kind"]).lower()
    if color not in COLOR_TO_IDX:
        raise ValueError(f"bad token color {color}")
    # Legacy aliases from early REGN drafts.
    if kind in ("xfer_out", "xfer_in"):
        kind = "xfer"
    if kind not in ("plus", "minus", "up", "down", "xfer"):
        raise ValueError(f"bad token kind {kind}")
    bar = data.get("bar_color")
    bar_c = str(bar).lower() if bar is not None else None
    if kind == "xfer":
        if bar_c not in COLOR_TO_IDX or bar_c == color:
            raise ValueError(f"xfer needs other bar_color, got {bar_c}")
    return Token(color=color, kind=kind, bar_color=bar_c)  # type: ignore[arg-type]


def _load_level(path: Path) -> LevelConfig:
    data = json.loads(path.read_text(encoding="utf-8"))
    low = int(data.get("limit_low", 8))
    high = int(data.get("limit_high", 40))
    start = int(data.get("start_fill", (low + high) // 2))
    delta = max(1, int(data.get("delta_px", 1)))
    starts = [_parse_token(t) for t in data.get("start_tokens", [])]
    # Legacy unique_path → valid_path_count=1
    if "valid_path_count" in data:
        vpc = max(1, int(data["valid_path_count"]))
    elif bool(data.get("unique_path", False)):
        vpc = 1
    else:
        vpc = max(1, int(data.get("valid_path_count", 8)))
    return LevelConfig(
        name=str(data.get("name") or path.stem),
        steps_to_win=int(data.get("steps_to_win", 10)),
        limit_low=low,
        limit_high=high,
        start_fill=start,
        visible_rows=max(1, min(16, int(data.get("visible_rows", 12)))),
        consumable_weight=float(data.get("consumable_weight", 0.7)),
        recurring_weight=float(data.get("recurring_weight", 0.2)),
        transfer_weight=float(data.get("transfer_weight", 0.1)),
        valid_path_count=vpc,
        forbid_constant_direction=bool(data.get("forbid_constant_direction", False)),
        seed=int(data.get("seed", 1)),
        delta_px=delta,
        start_tokens=starts,
    )


def _load_all_levels() -> list[LevelConfig]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _clone_gauges(gauges: dict[GaugeColor, GaugeState]) -> dict[GaugeColor, GaugeState]:
    return deepcopy(gauges)


def _place_token(gauges: dict[GaugeColor, GaugeState], tok: Token) -> None:
    g = gauges[tok.color]
    if tok.kind in ("plus", "minus"):
        g.consumables.append(tok)
    elif tok.kind in ("up", "down"):
        g.recurrings.append(tok)
    elif tok.kind == "xfer":
        g.transfers.append(tok)


def _apply_delta(
    gauges: dict[GaugeColor, GaugeState], color: GaugeColor, delta: int
) -> None:
    gauges[color].fill += delta


def _resolve_effects(
    gauges: dict[GaugeColor, GaugeState], delta_px: int
) -> list[tuple[str, GaugeColor, int]]:
    events: list[tuple[str, GaugeColor, int]] = []
    d = delta_px

    for color in GAUGE_COLORS:
        g = gauges[color]
        for tok in list(g.consumables):
            signed = d if tok.kind == "plus" else -d
            _apply_delta(gauges, color, signed)
            events.append((tok.kind, color, signed))
        g.consumables.clear()

    for color in GAUGE_COLORS:
        for tok in gauges[color].recurrings:
            signed = d if tok.kind == "up" else -d
            _apply_delta(gauges, color, signed)
            events.append((tok.kind, color, signed))

    for color in GAUGE_COLORS:
        for tok in gauges[color].transfers:
            bar = tok.bar_color
            if bar is None or bar == color:
                continue
            # Triangle colour loses Δ, bar colour gains Δ (permanent).
            _apply_delta(gauges, color, -d)
            _apply_delta(gauges, bar, d)
            events.append(("xfer", color, -d))
    return events


def _in_bounds(gauges: dict[GaugeColor, GaugeState], cfg: LevelConfig) -> bool:
    for g in gauges.values():
        if g.fill < cfg.limit_low or g.fill > cfg.limit_high:
            return False
    return True


def _simulate_choice(
    gauges: dict[GaugeColor, GaugeState],
    cfg: LevelConfig,
    trio: list[Token],
) -> dict[GaugeColor, GaugeState]:
    sim = _clone_gauges(gauges)
    for tok in trio:
        _place_token(sim, tok)
    _resolve_effects(sim, cfg.delta_px)
    return sim


def _fill_to_y(fill: int) -> int:
    """Topmost painted y for a fill count (fill=1 → WELL_BOTTOM)."""
    return WELL_BOTTOM - fill + 1


def _y_to_limit_fill(y: int) -> int:
    return WELL_BOTTOM - y + 1


class ReignGaugesEngine:
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
        rng = random.Random(cfg.seed + level_index * 97 + self.levels_completed * 13)
        gauges = {c: GaugeState(fill=cfg.start_fill) for c in GAUGE_COLORS}
        for tok in cfg.start_tokens:
            _place_token(gauges, tok)
        lv = LevelState(cfg=cfg, gauges=gauges, rng=rng)
        self._build_queue(lv)
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
        _ = data
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        self.last_action = f"ACTION{aid}"
        if aid not in (ACTION_LEFT, ACTION_RIGHT):
            return self.public_state()
        self.step_index += 1
        frames = self._choose("L" if aid == ACTION_LEFT else "R")
        if frames:
            self._pending_frames = frames
        return self.public_state()

    # --- generation --------------------------------------------------------------

    def _random_token(self, lv: LevelState, color: GaugeColor) -> Token:
        cfg = lv.cfg
        w_c, w_r, w_t = cfg.consumable_weight, cfg.recurring_weight, cfg.transfer_weight
        total = max(1e-6, w_c + w_r + w_t)
        r = lv.rng.random() * total
        if r < w_c:
            return Token(color=color, kind="plus" if lv.rng.random() < 0.5 else "minus")
        if r < w_c + w_r:
            return Token(color=color, kind="up" if lv.rng.random() < 0.5 else "down")
        bar = lv.rng.choice(OTHER_COLORS[color])
        return Token(color=color, kind="xfer", bar_color=bar)

    def _random_trio(self, lv: LevelState) -> list[Token]:
        colors = list(GAUGE_COLORS)
        lv.rng.shuffle(colors)
        return [self._random_token(lv, c) for c in colors]

    def _fatal_trio(self, lv: LevelState, gauges: dict[GaugeColor, GaugeState]) -> list[Token]:
        cfg = lv.cfg
        for _ in range(40):
            trio = self._random_trio(lv)
            if not _in_bounds(_simulate_choice(gauges, cfg, trio), cfg):
                return trio
        fills = sorted((gauges[c].fill, c) for c in GAUGE_COLORS)
        low_c, high_c = fills[0][1], fills[-1][1]
        if cfg.limit_high - gauges[high_c].fill <= gauges[low_c].fill - cfg.limit_low:
            return [
                Token(color=high_c, kind="plus"),
                Token(color=high_c, kind="plus"),
                Token(color=high_c, kind="up"),
            ]
        return [
            Token(color=low_c, kind="minus"),
            Token(color=low_c, kind="minus"),
            Token(color=low_c, kind="down"),
        ]

    def _safe_trio(self, lv: LevelState, gauges: dict[GaugeColor, GaugeState]) -> list[Token]:
        cfg = lv.cfg
        for _ in range(80):
            trio = self._random_trio(lv)
            if _in_bounds(_simulate_choice(gauges, cfg, trio), cfg):
                return trio
        # Brute-force all +/- consumable combinations (one per colour).
        for mask in range(8):
            trio = [
                Token(
                    color=c,
                    kind="plus" if (mask >> i) & 1 else "minus",
                )
                for i, c in enumerate(GAUGE_COLORS)
            ]
            if _in_bounds(_simulate_choice(gauges, cfg, trio), cfg):
                return trio
        # Emergency: stack correction on the worst gauge.
        mid = (cfg.limit_low + cfg.limit_high) // 2
        worst = max(
            GAUGE_COLORS,
            key=lambda c: abs(gauges[c].fill - mid),
        )
        kind: TokenKind = "plus" if gauges[worst].fill <= mid else "minus"
        return [Token(color=worst, kind=kind) for _ in range(3)]

    def _enumerate_valid_paths(
        self, start: dict[GaugeColor, GaugeState], cfg: LevelConfig, rows: list[ChoiceRow]
    ) -> list[str]:
        n = len(rows)
        valid: list[str] = []
        for mask in range(1 << n):
            sides = [("L" if ((mask >> i) & 1) == 0 else "R") for i in range(n)]
            sim = _clone_gauges(start)
            ok = True
            for i, side in enumerate(sides):
                trio = rows[i].left if side == "L" else rows[i].right
                sim = _simulate_choice(sim, cfg, trio)
                if not _in_bounds(sim, cfg):
                    ok = False
                    break
            if ok:
                valid.append("".join(sides))
        return valid

    def _constant_paths(self, n: int) -> set[str]:
        return {"L" * n, "R" * n}

    def _pick_spine(self, lv: LevelState, n: int) -> list[str]:
        """Winning spine; avoid constant L/R when forbidden."""
        for _ in range(40):
            path = [lv.rng.choice(("L", "R")) for _ in range(n)]
            key = "".join(path)
            if lv.cfg.forbid_constant_direction and key in self._constant_paths(n):
                continue
            return path
        # Fallback alternating
        return [("L" if i % 2 == 0 else "R") for i in range(n)]

    def _row_along_spine(
        self,
        lv: LevelState,
        gauges: dict[GaugeColor, GaugeState],
        prefer: str,
        *,
        soft_alt: bool,
    ) -> ChoiceRow:
        safe = self._safe_trio(lv, gauges)
        if soft_alt and lv.rng.random() < 0.55:
            alt = self._safe_trio(lv, gauges)
        else:
            alt = self._fatal_trio(lv, gauges)
        if prefer == "L":
            return ChoiceRow(left=safe, right=alt)
        return ChoiceRow(left=alt, right=safe)

    def _build_rows_for_spine(
        self, lv: LevelState, spine: list[str], *, soft_alt: bool
    ) -> list[ChoiceRow] | None:
        cfg = lv.cfg
        sim = _clone_gauges(lv.gauges)
        rows: list[ChoiceRow] = []
        for prefer in spine:
            row = self._row_along_spine(lv, sim, prefer, soft_alt=soft_alt)
            trio = row.left if prefer == "L" else row.right
            nxt = _simulate_choice(sim, cfg, trio)
            if not _in_bounds(nxt, cfg):
                # Force a safe repair on the preferred side.
                forced = self._safe_trio(lv, sim)
                fatal = self._fatal_trio(lv, sim)
                row = (
                    ChoiceRow(left=forced, right=fatal)
                    if prefer == "L"
                    else ChoiceRow(left=fatal, right=forced)
                )
                trio = row.left if prefer == "L" else row.right
                nxt = _simulate_choice(sim, cfg, trio)
                if not _in_bounds(nxt, cfg):
                    return None
            rows.append(row)
            sim = nxt
        return rows

    def _paths_ok(self, lv: LevelState, valid: list[str]) -> bool:
        cfg = lv.cfg
        if len(valid) != cfg.valid_path_count:
            return False
        if cfg.forbid_constant_direction:
            banned = self._constant_paths(cfg.steps_to_win)
            if any(p in banned for p in valid):
                return False
        return True

    def _build_queue(self, lv: LevelState) -> None:
        """Build exactly steps_to_win rows with precisely valid_path_count survivors."""
        cfg = lv.cfg
        n = cfg.steps_to_win
        base_rng_state = lv.rng.getstate()
        best_rows: list[ChoiceRow] | None = None
        best_valid: list[str] = []
        best_dist = 10**9

        for attempt in range(700):
            lv.rng.setstate(base_rng_state)
            for _ in range(attempt):
                lv.rng.random()
            spine = self._pick_spine(lv, n)
            # Early attempts: hard alt ( favors unique). Later: softer alts (more paths).
            soft = attempt > 80 or cfg.valid_path_count > 1
            rows = self._build_rows_for_spine(lv, spine, soft_alt=soft)
            if rows is None:
                continue
            # Optional mutations to grow/shrink valid set toward target K.
            valid = self._enumerate_valid_paths(lv.gauges, cfg, rows)
            if cfg.forbid_constant_direction:
                banned = self._constant_paths(n)
                # If a constant slipped through, harden a random row against it.
                if any(p in banned for p in valid):
                    ri = lv.rng.randrange(n)
                    sim = _clone_gauges(lv.gauges)
                    for j in range(ri):
                        # follow spine to reach row state (approx via spine)
                        side = spine[j]
                        trio = rows[j].left if side == "L" else rows[j].right
                        sim = _simulate_choice(sim, cfg, trio)
                    fatal = self._fatal_trio(lv, sim)
                    safe = self._safe_trio(lv, sim)
                    prefer = spine[ri]
                    rows[ri] = (
                        ChoiceRow(left=safe, right=fatal)
                        if prefer == "L"
                        else ChoiceRow(left=fatal, right=safe)
                    )
                    valid = self._enumerate_valid_paths(lv.gauges, cfg, rows)

            # If too few paths, randomly soften one fatal side.
            for _ in range(12):
                if len(valid) >= cfg.valid_path_count:
                    break
                ri = lv.rng.randrange(n)
                # Recompute state along spine to ri
                sim = _clone_gauges(lv.gauges)
                ok_prefix = True
                for j in range(ri):
                    side = spine[j]
                    trio = rows[j].left if side == "L" else rows[j].right
                    sim = _simulate_choice(sim, cfg, trio)
                    if not _in_bounds(sim, cfg):
                        ok_prefix = False
                        break
                if not ok_prefix:
                    continue
                soft_trio = self._safe_trio(lv, sim)
                prefer = spine[ri]
                if prefer == "L":
                    rows[ri] = ChoiceRow(left=rows[ri].left, right=soft_trio)
                else:
                    rows[ri] = ChoiceRow(left=soft_trio, right=rows[ri].right)
                valid = self._enumerate_valid_paths(lv.gauges, cfg, rows)

            # If too many paths, randomly harden one non-spine side.
            for _ in range(12):
                if len(valid) <= cfg.valid_path_count:
                    break
                ri = lv.rng.randrange(n)
                sim = _clone_gauges(lv.gauges)
                ok_prefix = True
                for j in range(ri):
                    side = spine[j]
                    trio = rows[j].left if side == "L" else rows[j].right
                    sim = _simulate_choice(sim, cfg, trio)
                    if not _in_bounds(sim, cfg):
                        ok_prefix = False
                        break
                if not ok_prefix:
                    continue
                fatal = self._fatal_trio(lv, sim)
                prefer = spine[ri]
                if prefer == "L":
                    rows[ri] = ChoiceRow(left=rows[ri].left, right=fatal)
                else:
                    rows[ri] = ChoiceRow(left=fatal, right=rows[ri].right)
                valid = self._enumerate_valid_paths(lv.gauges, cfg, rows)

            if cfg.forbid_constant_direction:
                banned = self._constant_paths(n)
                valid = [p for p in valid if p not in banned]
                # Filtering display only — if constants still physically valid,
                # reject this candidate unless we hardened them away.
                raw = self._enumerate_valid_paths(lv.gauges, cfg, rows)
                if any(p in banned for p in raw):
                    continue
                valid = [p for p in raw if p not in banned]

            dist = abs(len(valid) - cfg.valid_path_count)
            if dist < best_dist and valid:
                best_dist = dist
                best_rows = rows
                best_valid = list(valid)

            if self._paths_ok(lv, valid):
                lv.queue = rows
                lv.valid_paths = valid
                lv.secret_path = list(valid[0])
                return

        # Fallback: best effort closest to target.
        if best_rows is None:
            spine = self._pick_spine(lv, n)
            best_rows = self._build_rows_for_spine(lv, spine, soft_alt=False) or [
                ChoiceRow(left=self._safe_trio(lv, lv.gauges), right=self._fatal_trio(lv, lv.gauges))
                for _ in range(n)
            ]
            best_valid = self._enumerate_valid_paths(lv.gauges, cfg, best_rows)
        lv.queue = best_rows
        lv.valid_paths = best_valid
        lv.secret_path = list(best_valid[0]) if best_valid else self._pick_spine(lv, n)

    def _ensure_queue(self, lv: LevelState) -> None:
        """No-op: rows are fixed at level start (one per step)."""
        _ = lv

    # --- turn --------------------------------------------------------------------

    def _blink_token(
        self, frames: list[list[list[int]]], tok: Token, *, chosen_side: str
    ) -> None:
        """White blink on one token, then restore colour."""
        frames.append(self._render_frame(flash_tok=tok, highlight_side=chosen_side))
        frames.append(self._render_frame(flash_tok=tok, highlight_side=chosen_side))
        frames.append(self._render_frame(highlight_side=chosen_side))

    def _remove_one_consumable(self, color: GaugeColor, kind: TokenKind) -> None:
        bag = self._level.gauges[color].consumables
        for i in range(len(bag) - 1, -1, -1):
            if bag[i].kind == kind and bag[i].color == color:
                bag.pop(i)
                return

    def _choose(self, side: str) -> list[list[list[int]]]:
        lv = self._level
        self._ensure_queue(lv)
        if not lv.queue:
            return [self._render_frame()]

        row = lv.queue[0]
        trio = row.left if side == "L" else row.right
        # Keep only the chosen side framed for the whole intermediate animation.
        frames: list[list[list[int]]] = [self._render_frame(highlight_side=side)]
        d = lv.cfg.delta_px

        # Horizontal trio: place + resolve each element one-by-one with white blink.
        for tok in trio:
            _place_token(lv.gauges, tok)
            self._blink_token(frames, tok, chosen_side=side)
            if tok.kind in ("plus", "minus"):
                signed = d if tok.kind == "plus" else -d
                _apply_delta(lv.gauges, tok.color, signed)
                self._remove_one_consumable(tok.color, tok.kind)
                frames.append(
                    self._render_frame(pulse_colors={tok.color}, highlight_side=side)
                )
                frames.append(self._render_frame(highlight_side=side))

        # Recurrings already on boards: one-by-one
        for color in GAUGE_COLORS:
            for tok in list(lv.gauges[color].recurrings):
                self._blink_token(frames, tok, chosen_side=side)
                signed = d if tok.kind == "up" else -d
                _apply_delta(lv.gauges, color, signed)
                frames.append(
                    self._render_frame(pulse_colors={color}, highlight_side=side)
                )
                frames.append(self._render_frame(highlight_side=side))

        # Transfers (triangle→ + bar): one-by-one, permanent
        for color in GAUGE_COLORS:
            for tok in list(lv.gauges[color].transfers):
                bar = tok.bar_color
                if bar is None or bar == color:
                    continue
                self._blink_token(frames, tok, chosen_side=side)
                _apply_delta(lv.gauges, color, -d)
                _apply_delta(lv.gauges, bar, d)
                frames.append(
                    self._render_frame(pulse_colors={color, bar}, highlight_side=side)
                )
                frames.append(self._render_frame(highlight_side=side))

        frames.append(self._render_frame(highlight_side=side))

        if not _in_bounds(lv.gauges, lv.cfg):
            frames.extend(self._fail_frames())
            return frames

        lv.queue.pop(0)
        lv.steps_done += 1
        frames.append(self._render_frame())

        if lv.steps_done >= lv.cfg.steps_to_win:
            frames.extend(self._win_frames())
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
            else:
                self._level = self._new_level_state(self.levels_completed)
                self.state = "NOT_FINISHED"
                frames.append(self._render_frame())
        return frames

    def _fail_frames(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        base = self._render_frame()
        for i in range(4):
            if i % 2 == 0:
                frames.append(self._recolor_nonbg(base, C_FLASH))
            else:
                frames.append([row[:] for row in base])
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
        available = ["ACTION3", "ACTION4", "ACTION7"]
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
            "steps_done": lv.steps_done,
            "steps_to_win": lv.cfg.steps_to_win,
            "delta_px": lv.cfg.delta_px,
            "gauges": {
                c: {
                    "fill": lv.gauges[c].fill,
                    "limit_low": lv.cfg.limit_low,
                    "limit_high": lv.cfg.limit_high,
                    "consumables": len(lv.gauges[c].consumables),
                    "recurrings": len(lv.gauges[c].recurrings),
                    "transfers": len(lv.gauges[c].transfers),
                }
                for c in GAUGE_COLORS
            },
        }

    # --- rendering (pixel-exact) -------------------------------------------------

    def _render_frame(
        self,
        *,
        highlight_side: str | None = None,
        pulse_colors: set[GaugeColor] | None = None,
        flash_tok: Token | None = None,
    ) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]

        self._draw_structure(frame)
        self._draw_steps(frame)
        self._draw_gauges(frame, pulse_colors=pulse_colors or set())
        self._draw_slots(frame, flash_tok=flash_tok)
        self._draw_choice_columns(frame, highlight_side=highlight_side)
        return frame

    def _draw_structure(self, frame: list[list[int]]) -> None:
        # vertical struct columns — skip the step band so pips stay on pure black
        for x in STRUCT_COLS:
            for y in range(FRAME):
                if y in (STEP_Y0, STEP_Y1) or y == 0 or y == 3:
                    continue
                frame[y][x] = C_STRUCT
        # horizontal separator under progress
        for x in range(13, 51):
            frame[SEP_Y][x] = C_STRUCT

    def _draw_steps(self, frame: list[list[int]]) -> None:
        """Step pips on a clean black band (no grey parasites between/around)."""
        lv = self._level
        n = lv.cfg.steps_to_win
        # Clear the whole step band to black first (kills struct leftovers).
        for y in (0, STEP_Y0, STEP_Y1, 3):
            for x in range(14, 50):
                frame[y][x] = C_BG
        x = 17
        for i in range(n):
            if x >= 49:
                break
            lit = i < lv.steps_done
            col = C_GREEN if lit else C_DGREY
            for yy in (STEP_Y0, STEP_Y1):
                frame[yy][x] = col
            # guarantee black neighbours (left/right gaps)
            if x - 1 >= 14:
                frame[STEP_Y0][x - 1] = C_BG
                frame[STEP_Y1][x - 1] = C_BG
            if x + 1 < 50:
                frame[STEP_Y0][x + 1] = C_BG
                frame[STEP_Y1][x + 1] = C_BG
            x += 2

    def _draw_gauges(
        self, frame: list[list[int]], *, pulse_colors: set[GaugeColor]
    ) -> None:
        lv = self._level
        cfg = lv.cfg
        high_y = _fill_to_y(cfg.limit_high)
        low_y = _fill_to_y(cfg.limit_low)

        for color in GAUGE_COLORS:
            x0, x1 = GAUGE_X[color]
            ink = COLOR_TO_IDX[color]
            fill = max(0, min(WELL_BOTTOM - WELL_TOP + 1, lv.gauges[color].fill))
            # fill from bottom
            for i in range(fill):
                y = WELL_BOTTOM - i
                if y < WELL_TOP:
                    break
                # limit marks override fill color
                if y in (high_y, low_y):
                    continue
                top_flash = color in pulse_colors and i == fill - 1
                c = C_WHITE if top_flash else ink
                for x in range(x0, x1 + 1):
                    frame[y][x] = c
            # white dotted limit marks: white dots on "transparent" gaps —
            # black if fill has not reached this row yet, else gauge colour.
            for y in (high_y, low_y):
                if WELL_TOP <= y <= WELL_BOTTOM:
                    covers = fill >= (WELL_BOTTOM - y + 1)
                    gap = ink if covers else C_BG
                    for x in range(x0, x1 + 1):
                        frame[y][x] = C_LIMIT if (x - x0) % 2 == 0 else gap

    def _draw_slots(
        self, frame: list[list[int]], *, flash_tok: Token | None = None
    ) -> None:
        """Stack placed tokens in the column to the right of each gauge."""
        lv = self._level
        for color in GAUGE_COLORS:
            x0, _x1 = SLOT_X[color]
            g = lv.gauges[color]
            tokens = list(g.consumables) + list(g.recurrings) + list(g.transfers)
            # stack from top of well downward, 4px per token (3 glyph + 1 gap)
            y = WELL_TOP + 1
            for tok in tokens[:12]:
                # Identity match so only the active animated token blinks.
                flash = flash_tok is not None and tok is flash_tok
                self._blit_token(frame, y, x0 + 1, tok, flash=flash)
                y += 4
                if y > WELL_BOTTOM - 3:
                    break

    def _draw_choice_columns(
        self, frame: list[list[int]], *, highlight_side: str | None
    ) -> None:
        lv = self._level
        self._ensure_queue(lv)
        vis = min(lv.cfg.visible_rows, len(lv.queue))

        for i in range(vis):
            row = lv.queue[i]
            if i == 0:
                # Idle: both sides outlined. After a choice, only the chosen side
                # keeps the white frame during the intermediate animation.
                if highlight_side is None:
                    self._stroke_active_frame(frame, side="L")
                    self._stroke_active_frame(frame, side="R")
                elif highlight_side == "L":
                    self._stroke_active_frame(frame, side="L")
                else:
                    self._stroke_active_frame(frame, side="R")
                self._blit_trio(frame, ACTIVE_GLYPH_Y0, LEFT_X0, row.left, framed=True)
                self._blit_trio(frame, ACTIVE_GLYPH_Y0, RIGHT_X0, row.right, framed=True)
                if highlight_side == "L":
                    self._fill_choice_bg(frame, "L", ACTIVE_GLYPH_Y0, lit=True)
                    self._blit_trio(
                        frame, ACTIVE_GLYPH_Y0, LEFT_X0, row.left, framed=True
                    )
                elif highlight_side == "R":
                    self._fill_choice_bg(frame, "R", ACTIVE_GLYPH_Y0, lit=True)
                    self._blit_trio(
                        frame, ACTIVE_GLYPH_Y0, RIGHT_X0, row.right, framed=True
                    )
            else:
                y0 = 60 - i * 4
                if y0 < 0:
                    break
                self._blit_trio(frame, y0, LEFT_X0, row.left, framed=False)
                self._blit_trio(frame, y0, RIGHT_X0, row.right, framed=False)

    def _stroke_active_frame(self, frame: list[list[int]], *, side: str) -> None:
        x0 = LEFT_X0 if side == "L" else RIGHT_X0
        w = LEFT_W if side == "L" else RIGHT_W
        for x in range(x0, x0 + w):
            frame[ACTIVE_FRAME_Y0][x] = C_WHITE
            frame[ACTIVE_FRAME_Y1][x] = C_WHITE
        for y in range(ACTIVE_FRAME_Y0, ACTIVE_FRAME_Y1 + 1):
            frame[y][x0] = C_WHITE
            frame[y][x0 + w - 1] = C_WHITE

    def _fill_choice_bg(
        self, frame: list[list[int]], side: str, y0: int, *, lit: bool
    ) -> None:
        x0 = LEFT_X0 if side == "L" else RIGHT_X0
        w = LEFT_W if side == "L" else RIGHT_W
        col = C_VDGREY if lit else C_BG
        for yy in range(y0, y0 + 3):
            for xx in range(x0 + 1, x0 + w - 1):
                if frame[yy][xx] == C_BG:
                    frame[yy][xx] = col

    def _blit_trio(
        self,
        frame: list[list[int]],
        y0: int,
        col_x0: int,
        trio: list[Token],
        *,
        framed: bool,
    ) -> None:
        # Pattern `.AAA.BBB.CCC.` → tokens at x offsets 1, 5, 9
        for t_i, tok in enumerate(trio[:3]):
            tx = col_x0 + 1 + t_i * 4
            self._blit_token(frame, y0, tx, tok)

    def _blit_token(
        self,
        frame: list[list[int]],
        y: int,
        x: int,
        tok: Token,
        *,
        flash: bool = False,
    ) -> None:
        ink = C_WHITE if flash else COLOR_TO_IDX[tok.color]
        bar = (
            C_WHITE
            if flash
            else (COLOR_TO_IDX[tok.bar_color] if tok.bar_color else ink)
        )

        def px(dy: int, dx: int, c: int) -> None:
            yy, xx = y + dy, x + dx
            if 0 <= yy < FRAME and 0 <= xx < FRAME:
                frame[yy][xx] = c

        if tok.kind == "plus":
            # Consumable +: thin cross (distinct from recurring up).
            px(0, 1, ink)
            px(1, 0, ink)
            px(1, 1, ink)
            px(1, 2, ink)
            px(2, 1, ink)
        elif tok.kind == "minus":
            px(1, 0, ink)
            px(1, 1, ink)
            px(1, 2, ink)
        elif tok.kind == "up":
            # Recurring △ up: tip + solid base (stays ≠ plus).
            px(0, 1, ink)
            px(1, 0, ink)
            px(1, 1, ink)
            px(1, 2, ink)
            px(2, 0, ink)
            px(2, 1, ink)
            px(2, 2, ink)
        elif tok.kind == "down":
            # Recurring ▽ down: solid top + tip.
            px(0, 0, ink)
            px(0, 1, ink)
            px(0, 2, ink)
            px(1, 0, ink)
            px(1, 1, ink)
            px(1, 2, ink)
            px(2, 1, ink)
        else:  # xfer: right triangle (ink) + bar after (bar colour)
            # S.B
            # SSB
            # S.B
            px(0, 0, ink)
            px(0, 2, bar)
            px(1, 0, ink)
            px(1, 1, ink)
            px(1, 2, bar)
            px(2, 0, ink)
            px(2, 2, bar)
