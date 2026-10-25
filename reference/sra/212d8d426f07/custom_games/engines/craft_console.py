"""CRAF: bag + recipe legend + 2 craft slots + break slot + multi-chest (RF11)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

C_WHITE, C_LGREY, C_MGREY, C_DGREY, C_VDGREY, C_BLACK = 0, 1, 2, 3, 4, 5
C_MAGENTA, C_PINK, C_RED, C_BLUE, C_CYAN = 6, 7, 8, 9, 10
C_YELLOW, C_ORANGE, C_BROWN, C_GREEN, C_PURPLE = 11, 12, 13, 14, 15

FRAME, PLAY_H = 64, 57
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "craft_console" / "levels"

DEFAULT_TYPES: dict[str, int] = {
    "A": C_YELLOW,
    "B": C_BLUE,
    "C": C_GREEN,
    "D": C_MAGENTA,
    "E": C_PINK,
    "X": C_BROWN,  # was cyan — brown in recipes/traps
    "Y": C_CYAN,   # cyan cubes in bag / chest
}

# All resources are solid 3×3 squares.
TILE = 3
SLOT = 5  # craft/break cell frame (holds a 3×3 with 1px pad)
TILE_GAP = 2
EDGE = 2


def _fill(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
    for yy in range(max(0, y), min(FRAME, y + h)):
        row = frame[yy]
        for xx in range(max(0, x), min(FRAME, x + w)):
            row[xx] = color


def _border(frame: list[list[int]], y: int, x: int, h: int, w: int, color: int) -> None:
    for xx in range(x, x + w):
        if 0 <= y < FRAME and 0 <= xx < FRAME:
            frame[y][xx] = color
        if 0 <= y + h - 1 < FRAME and 0 <= xx < FRAME:
            frame[y + h - 1][xx] = color
    for yy in range(y, y + h):
        if 0 <= yy < FRAME and 0 <= x < FRAME:
            frame[yy][x] = color
        if 0 <= yy < FRAME and 0 <= x + w - 1 < FRAME:
            frame[yy][x + w - 1] = color


def _in_rect(px: int, py: int, y: int, x: int, h: int, w: int) -> bool:
    return x <= px < x + w and y <= py < y + h


def _tile(
    frame: list[list[int]],
    y: int,
    x: int,
    color: int,
    *,
    size: int = TILE,
    mode: str = "full",
    ring: int | None = None,
    tight_ring: bool = False,
) -> None:
    """Draw a resource square. Default size is 3×3 solid colour."""
    s = size
    if ring is not None and not tight_ring:
        # Tutorial halo: 2px outside.
        _border(frame, y - 2, x - 2, s + 4, s + 4, ring)
    if mode == "empty":
        _border(frame, y, x, s, s, C_DGREY)
        return
    if mode == "ghost":
        _border(frame, y, x, s, s, color)
        return
    _fill(frame, y, x, s, s, color)
    if ring is not None and tight_ring:
        # Selection: 1px outside only.
        _border(frame, y - 1, x - 1, s + 2, s + 2, ring)


def _count_pips(frame: list[list[int]], y: int, x: int, count: int) -> None:
    for i in range(min(5, max(0, count))):
        px = x + i * 2
        if 0 <= y < FRAME and 0 <= px < FRAME:
            frame[y][px] = C_PURPLE


def _norm_outputs(recipe: dict[str, Any]) -> list[str]:
    if "outputs" in recipe:
        return [str(t) for t in recipe["outputs"]]
    out = recipe.get("output")
    if isinstance(out, list):
        return [str(t) for t in out]
    return [str(out)]


def _load_levels() -> list[dict[str, Any]]:
    levels = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(LEVELS_DIR.glob("L*.json"))]
    if len(levels) != 6:
        raise ValueError(f"CRAF requires exactly six levels, found {len(levels)}")
    for level in levels:
        stock = {str(k): int(v) for k, v in level.get("stock", {}).items()}
        if any(v < 0 for v in stock.values()):
            raise ValueError("CRAF stock cannot be negative")
        recipes = level.get("recipes") or []
        if not recipes:
            raise ValueError("CRAF level needs at least one recipe")
        for recipe in recipes:
            inputs = [str(t) for t in recipe["inputs"]]
            if len(inputs) != 2:
                raise ValueError("CRAF recipes require exactly 2 inputs")
            outs = _norm_outputs(recipe)
            if not (1 <= len(outs) <= 2):
                raise ValueError("CRAF recipes produce 1 or 2 outputs")
        breaks = level.get("breaks") or {}
        for src, parts in breaks.items():
            if len(parts) != 2:
                raise ValueError(f"CRAF break {src} must split into exactly 2 colours")
        order = level.get("order") or {}
        slots = order.get("slots")
        if not slots or not isinstance(slots, list):
            raise ValueError("CRAF order.slots required")
        if int(level.get("energy", 0)) < 0 or int(level.get("craft_cost", 1)) < 0:
            raise ValueError("CRAF energy/craft_cost invalid")
    return levels


class CraftConsoleEngine:
    """Bag + recipe legend + 2 craft slots + break slot + chest targets."""

    def __init__(self, info: CustomGameInfo) -> None:
        self.info = info
        self._templates = _load_levels()
        self.win_levels = int(info.levels)
        self._episode_profile = 0
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._flash: str | None = None
        self._begin_level(0)

    def reset(self) -> dict[str, Any]:
        self._episode_profile = (self._episode_profile + 1) % 2
        self.levels_completed = self.step_index = self.level_steps = 0
        self.last_action, self.state = "RESET", "NOT_FINISHED"
        self._pending_frames = None
        self._begin_level(0)
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._begin_level(min(self.levels_completed, self.win_levels - 1))
        self.last_action, self._pending_frames = "ACTION7", None
        return self.public_state()

    def _begin_level(self, index: int) -> None:
        self._level = self._templates[index]
        self.level_steps = 0
        self._stock = {str(k): int(v) for k, v in self._level.get("stock", {}).items()}
        self._recipes = [
            {
                "id": str(r.get("id", f"r{i}")),
                "inputs": [str(t) for t in r["inputs"]],
                "outputs": _norm_outputs(r),
            }
            for i, r in enumerate(self._level["recipes"])
        ]
        self._breaks = {
            str(src): [str(a), str(b)]
            for src, (a, b) in (self._level.get("breaks") or {}).items()
        }
        self._slots: list[str | None] = [None, None]
        self._break_slot: str | None = None
        self._hand: str | None = None
        self._energy = int(self._level.get("energy", 8))
        self._craft_cost = int(self._level.get("craft_cost", 1))
        self._break_cost = int(self._level.get("break_cost", 1))
        self._order_slots: list[str] = [str(t) for t in self._level["order"]["slots"]]
        self._chest_fill: list[str | None] = [None] * len(self._order_slots)
        self._exchange = [str(a) for a in (self._level.get("exchange") or [])]
        if len(self._exchange) not in (0, 2):
            raise ValueError("CRAF exchange must be absent or a pair")
        morph = self._level.get("morphology") or {}
        self._type_color: dict[str, int] = dict(DEFAULT_TYPES)
        for type_id, spec in morph.items():
            if "color" in spec:
                self._type_color[str(type_id)] = int(spec["color"])
        self._flash = None
        self._tutorial = index == 0
        self._tut_step = 0
        self._ensure_stock_keys()

    def _ensure_stock_keys(self) -> None:
        for recipe in self._recipes:
            for t in recipe["inputs"]:
                self._stock.setdefault(t, 0)
            for t in recipe["outputs"]:
                self._stock.setdefault(t, 0)
        for src, parts in self._breaks.items():
            self._stock.setdefault(src, 0)
            for t in parts:
                self._stock.setdefault(t, 0)
        for t in self._order_slots:
            self._stock.setdefault(t, 0)
        for t in self._exchange:
            self._stock.setdefault(t, 0)

    def _color(self, type_id: str) -> int:
        return int(self._type_color.get(type_id, C_LGREY))

    def _order_complete(self) -> bool:
        return all(f is not None and f == n for f, n in zip(self._chest_fill, self._order_slots))

    def _order_have_count(self) -> int:
        return sum(1 for f, n in zip(self._chest_fill, self._order_slots) if f is not None and f == n)

    def _matching_recipe(self, slots: list[str | None] | None = None) -> dict[str, Any] | None:
        use = slots if slots is not None else self._slots
        if any(s is None for s in use):
            return None
        key = sorted(t for t in use if t is not None)
        for recipe in self._recipes:
            if sorted(recipe["inputs"]) == key:
                return recipe
        return None

    def _relevant_types(self) -> set[str]:
        relevant: set[str] = set(self._order_slots) | set(self._exchange) | set(self._breaks)
        for recipe in self._recipes:
            relevant.update(recipe["inputs"])
            relevant.update(recipe["outputs"])
        for parts in self._breaks.values():
            relevant.update(parts)
        for t, n in self._stock.items():
            if n > 0:
                relevant.add(t)
        if self._hand is not None:
            relevant.add(self._hand)
        for t in self._chest_fill:
            if t is not None:
                relevant.add(t)
        if self._break_slot is not None:
            relevant.add(self._break_slot)
        return relevant

    def _visible_types(self) -> list[str]:
        """Stable bag order (A…Y). Never promote selection to the top."""
        relevant = self._relevant_types()
        primary: list[str] = []
        for t in ("A", "B", "C", "D", "E", "X", "Y"):
            if t not in self._stock or t not in relevant:
                continue
            # Keep letter order; include if useful now (stock, held, exchange, breakable).
            if (
                self._stock.get(t, 0) > 0
                or self._hand == t
                or t in self._exchange
                or t in self._breaks
            ):
                primary.append(t)
        # Pad with other relevant ghosts only if there is free room (still letter order).
        for t in ("A", "B", "C", "D", "E", "X", "Y"):
            if len(primary) >= 6:
                break
            if t in primary or t not in self._stock or t not in relevant:
                continue
            primary.append(t)
        return primary[:6]

    def _bag_display_count(self, type_id: str, stock: dict[str, int]) -> int:
        """While selected, still count as present in the bag visually."""
        n = stock.get(type_id, 0)
        if self._hand == type_id:
            return n + 1
        return n

    # --- Geometry ---

    def _bag_body(self) -> tuple[int, int, int, int]:
        return (6, 1, 47, 14)

    def _table_body(self) -> tuple[int, int, int, int]:
        # Wide craft table above the chest (+6px height for middle buttons).
        return (7, 38, 28, 25)

    def _chest_body(self) -> tuple[int, int, int, int]:
        # Compact chest tucked directly under the taller table (+3px height downward).
        return (36, 38, 20, 25)

    def _bin_rects(self) -> list[tuple[str, int, int, int, int]]:
        types = self._visible_types()
        rects: list[tuple[str, int, int, int, int]] = []
        y0, x0 = 10, 3
        step = TILE + TILE_GAP  # 5
        for i, t in enumerate(types[:6]):
            rects.append((t, y0 + i * step, x0, TILE, TILE))
        return rects

    def _legend_entries(self) -> list[tuple[str, Any]]:
        """Craft recipes then recycle/break recipes — all displayed = all usable."""
        entries: list[tuple[str, Any]] = [("craft", r) for r in self._recipes]
        for src in sorted(self._breaks.keys()):
            entries.append(("break", {"src": src, "outputs": list(self._breaks[src])}))
        return entries

    def _recipe_button_rects(self) -> list[tuple[int, int, int, int, int]]:
        """Vertical legend (craft + recycle); +5px wider to the right."""
        n = len(self._legend_entries())
        bw = 20  # was 15
        bh = 7 if n >= 5 else 8
        gap = 0 if n >= 6 else 1
        x0, y0 = 16, 6
        return [(i, y0 + i * (bh + gap), x0, bh, bw) for i in range(n)]

    def _slot_rects(self) -> list[tuple[int, int, int, int, int]]:
        # Craft slots centered in the widened table.
        ty, tx, th, tw = self._table_body()
        y = ty + 5
        pair_w = SLOT * 2 + 3
        x0 = tx + (tw - pair_w) // 2
        return [(0, y, x0, SLOT, SLOT), (1, y, x0 + SLOT + 3, SLOT, SLOT)]

    def _break_rect(self) -> tuple[int, int, int, int]:
        ty, tx, th, tw = self._table_body()
        return (ty + th - SLOT - 3, tx + (tw - SLOT) // 2, SLOT, SLOT)

    def _action_btn_rects(self) -> dict[str, tuple[int, int, int, int]]:
        """Small craft (white) + demolish (orange) buttons above the break seat."""
        by, bx, _bh, bw = self._break_rect()
        btn_h, btn_w, gap = 3, 3, 1
        y = by - btn_h - 1 - 3  # 3px higher toward the craft slots
        total = btn_w * 2 + gap
        x0 = bx + (bw - total) // 2
        return {
            "craft": (y, x0, btn_h, btn_w),
            "demolish": (y, x0 + btn_w + gap, btn_h, btn_w),
        }

    def _chest_slot_rects(self) -> list[tuple[int, int, int, int, int]]:
        cy, cx, ch, cw = self._chest_body()
        n = len(self._order_slots)
        size, gap = TILE, 3
        cols = 2 if n > 2 else 1
        # Compact grid centered in chest body (3px gaps).
        rows = (n + cols - 1) // cols
        grid_w = cols * size + (cols - 1) * gap
        grid_h = rows * size + (rows - 1) * gap
        x0 = cx + (cw - grid_w) // 2
        y0 = cy + 5 + max(0, (ch - 7 - grid_h) // 2)
        rects: list[tuple[int, int, int, int, int]] = []
        for i in range(n):
            col, row = i % cols, i // cols
            rects.append((i, y0 + row * (size + gap), x0 + col * (size + gap), size, size))
        return rects

    def _exchange_rect(self) -> tuple[int, int, int, int] | None:
        if not self._exchange:
            return None
        ty, tx, th, tw = self._table_body()
        return (ty + 2, tx + tw - TILE * 2 - 3, TILE, TILE * 2 + TILE_GAP)

    def _bin_anchor(self, type_id: str) -> tuple[int, int]:
        for t, y, x, _h, _w in self._bin_rects():
            if t == type_id:
                return y, x
        return 8, 4

    def _slot_anchor(self, slot_i: int) -> tuple[int, int]:
        for i, y, x, _h, _w in self._slot_rects():
            if i == slot_i:
                return y + 1, x + 1  # 3×3 centered in 5×5 frame
        return 21, 23

    def _break_anchor(self) -> tuple[int, int]:
        y, x, _, _ = self._break_rect()
        return y + 1, x + 1

    def _chest_slot_anchor(self, slot_i: int) -> tuple[int, int]:
        for i, y, x, _h, _w in self._chest_slot_rects():
            if i == slot_i:
                return y, x
        cy, cx, _, _ = self._chest_body()
        return cy + 7, cx + 3

    # --- Tutorial ---

    def _guide_target(self) -> tuple[str, Any] | None:
        if not self._tutorial:
            return None
        s = self._tut_step
        if s == 0:
            return ("bin", "A")
        if s == 1:
            return ("slot", 0)
        if s == 2:
            return ("bin", "B")
        if s == 3:
            return ("slot", 1)
        if s == 4:
            return ("craft_btn", None)
        if s == 5:
            for need, filled in zip(self._order_slots, self._chest_fill):
                if filled is None:
                    return ("bin", need)
            return None
        if s == 6:
            for i, filled in enumerate(self._chest_fill):
                if filled is None:
                    return ("chest", i)
            return None
        return None

    def _advance_tutorial(self, event: str, detail: Any = None) -> None:
        if not self._tutorial:
            return
        s = self._tut_step
        if s == 0 and event == "pick" and detail == "A":
            self._tut_step = 1
        elif s == 1 and event == "place" and detail == 0:
            self._tut_step = 2
        elif s == 2 and event == "pick" and detail == "B":
            self._tut_step = 3
        elif s == 3 and event == "place" and detail == 1:
            self._tut_step = 4
        elif s == 4 and event == "craft":
            self._tut_step = 5
        elif s == 5 and event == "pick" and detail in self._order_slots:
            self._tut_step = 6
        elif s == 6 and event == "chest":
            self._tut_step = 7 if self._order_complete() else 5

    # --- Actions ---

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()
        if self.state == "WIN":
            return self.public_state()
        self._flash = None
        # SPACE disabled — craft/demolish only via the table buttons.
        if aid == ACTION_SPACE:
            return self.public_state()
        if aid != ACTION_CLICK:
            return self.public_state()
        payload = data or {}
        return self._click(int(payload.get("x", -99)), int(payload.get("y", -99)))

    def _click(self, x: int, y: int) -> dict[str, Any]:
        before = self._render_frame()
        self.last_action = f"ACTION{ACTION_CLICK}"
        self.step_index += 1
        self.level_steps += 1

        # Recipe legend — click does nothing (info only).
        for _idx, ty, tx, th, tw in self._recipe_button_rects():
            if _in_rect(x, y, ty, tx, th, tw):
                self._pending_frames = [before, self._render_frame()]
                return self.public_state()

        # Explicit craft / demolish buttons above the orange seat.
        btns = self._action_btn_rects()
        cy, cx, ch, cw = btns["craft"]
        if _in_rect(x, y, cy, cx, ch, cw):
            recipe = self._matching_recipe()
            if recipe is None:
                self._flash = "bad"
                frames = [before, self._render_frame()]
                self._flash = None
                frames.append(self._render_frame())
                self._pending_frames = frames
                return self.public_state()
            return self._do_craft(before, recipe)
        dy, dx, dh, dw = btns["demolish"]
        if _in_rect(x, y, dy, dx, dh, dw):
            if self._break_slot is None or self._break_slot not in self._breaks:
                self._flash = "bad"
                frames = [before, self._render_frame()]
                self._flash = None
                frames.append(self._render_frame())
                self._pending_frames = frames
                return self.public_state()
            return self._do_break(before)

        for type_id, by, bx, bh, bw in self._bin_rects():
            if _in_rect(x, y, by, bx, bh, bw):
                self._pending_frames = self._click_bin(before, type_id)
                return self.public_state()

        for slot_i, sy, sx, sh, sw in self._slot_rects():
            if _in_rect(x, y, sy, sx, sh, sw):
                self._pending_frames = self._place_on_craft(before, slot_i)
                return self.public_state()

        by, bx, bh, bw = self._break_rect()
        if _in_rect(x, y, by, bx, bh, bw):
            self._pending_frames = self._place_on_break(before)
            return self.public_state()

        for slot_i, sy, sx, sh, sw in self._chest_slot_rects():
            if _in_rect(x, y, sy, sx, sh, sw):
                self._pending_frames = self._click_chest_slot(before, slot_i)
                return self.public_state()

        ex = self._exchange_rect()
        if ex is not None:
            ey, exx, eh, ew = ex
            if _in_rect(x, y, ey, exx, eh, ew):
                ok = self._do_exchange()
                self._flash = "ok" if ok else "bad"
                frames = [before, self._render_frame()]
                self._flash = None
                frames.append(self._render_frame())
                self._pending_frames = frames
                return self.public_state()

        self._pending_frames = [before, self._render_frame()]
        return self.public_state()

    def _click_bin(self, before: list[list[int]], type_id: str) -> list[list[list[int]]]:
        # Toggle off selection back into bag.
        if self._hand == type_id:
            self._stock[type_id] = self._stock.get(type_id, 0) + 1
            self._hand = None
            return [before, self._render_frame()]
        if self._hand is not None:
            self._stock[self._hand] = self._stock.get(self._hand, 0) + 1
            self._hand = None
        if self._stock.get(type_id, 0) <= 0:
            self._flash = "bad"
            frames = [before, self._render_frame()]
            self._flash = None
            frames.append(self._render_frame())
            return frames
        # Select in place — no upward motion.
        self._stock[type_id] -= 1
        self._hand = type_id
        self._advance_tutorial("pick", type_id)
        return [before, self._render_frame()]

    def _place_on_craft(self, before: list[list[int]], slot_i: int) -> list[list[list[int]]]:
        current = self._slots[slot_i]
        if self._hand is None:
            if current is None:
                self._flash = "bad"
                frames = [before, self._render_frame()]
                self._flash = None
                frames.append(self._render_frame())
                return frames
            self._slots[slot_i] = None
            self._hand = current
            return [before, self._render_frame()]

        held = self._hand
        start = self._bin_anchor(held)
        end = self._slot_anchor(slot_i)
        displaced = current
        self._hand = None
        self._slots[slot_i] = held
        if displaced is not None:
            self._hand = displaced
        self._advance_tutorial("place", slot_i)

        frames: list[list[list[int]]] = [before]
        for t in (0.35, 0.7):
            fy = int(round(start[0] + (end[0] - start[0]) * t))
            fx = int(round(start[1] + (end[1] - start[1]) * t))
            force_slots = list(self._slots)
            force_slots[slot_i] = displaced
            frames.append(
                self._render_frame(
                    force_slots=force_slots,
                    force_hand=displaced,
                    float_tile=(held, fy, fx),
                )
            )
        frames.append(self._render_frame())
        return frames

    def _place_on_break(self, before: list[list[int]]) -> list[list[list[int]]]:
        if self._hand is None:
            if self._break_slot is None:
                self._flash = "bad"
                frames = [before, self._render_frame()]
                self._flash = None
                frames.append(self._render_frame())
                return frames
            self._hand = self._break_slot
            self._break_slot = None
            return [before, self._render_frame()]

        held = self._hand
        if held not in self._breaks and self._break_slot is None:
            # Allow placing only breakables into empty break seat.
            self._flash = "bad"
            frames = [before, self._render_frame()]
            self._flash = None
            frames.append(self._render_frame())
            return frames

        start = self._bin_anchor(held)
        end = self._break_anchor()
        displaced = self._break_slot
        self._hand = None
        self._break_slot = held
        if displaced is not None:
            self._hand = displaced

        frames: list[list[list[int]]] = [before]
        for t in (0.35, 0.7):
            fy = int(round(start[0] + (end[0] - start[0]) * t))
            fx = int(round(start[1] + (end[1] - start[1]) * t))
            frames.append(
                self._render_frame(
                    force_break=displaced,
                    force_hand=displaced,
                    float_tile=(held, fy, fx),
                )
            )
        frames.append(self._render_frame())
        return frames

    def _click_chest_slot(self, before: list[list[int]], slot_i: int) -> list[list[list[int]]]:
        need = self._order_slots[slot_i]
        if self._hand is None:
            if self._chest_fill[slot_i] is not None:
                self._hand = self._chest_fill[slot_i]
                self._chest_fill[slot_i] = None
                return [before, self._render_frame()]
            self._flash = "bad_chest"
            frames = [before, self._render_frame()]
            self._flash = None
            frames.append(self._render_frame())
            return frames

        held = self._hand
        if held != need or self._chest_fill[slot_i] is not None:
            self._flash = "bad_chest"
            frames = [before, self._render_frame()]
            self._flash = None
            frames.append(self._render_frame())
            return frames

        start = self._bin_anchor(held)
        end = self._chest_slot_anchor(slot_i)
        before_fill = list(self._chest_fill)
        self._hand = None
        self._chest_fill[slot_i] = held
        self._advance_tutorial("chest", slot_i)

        frames: list[list[list[int]]] = [before]
        for t in (0.3, 0.6, 0.85):
            fy = int(round(start[0] + (end[0] - start[0]) * t))
            fx = int(round(start[1] + (end[1] - start[1]) * t))
            frames.append(
                self._render_frame(
                    force_chest=before_fill,
                    force_hand=None,
                    float_tile=(held, fy, fx),
                )
            )
        frames.append(self._render_frame(order_pulse=True))
        frames.append(self._render_frame())
        return self._maybe_complete(frames)

    def _do_craft(self, before: list[list[int]], recipe: dict[str, Any]) -> dict[str, Any]:
        old_slots = list(self._slots)
        before_stock = dict(self._stock)
        outs = list(recipe["outputs"])
        anchors = [self._slot_anchor(0), self._slot_anchor(1)]
        mid = ((anchors[0][0] + anchors[1][0]) // 2, (anchors[0][1] + anchors[1][1]) // 2)

        self._slots = [None, None]
        self._advance_tutorial("craft")

        frames: list[list[list[int]]] = [before]
        frames.append(self._render_frame(force_slots=old_slots, force_stock=before_stock, slot_pulse=True))
        for t in (0.4, 0.75):
            floats = []
            for i, typ in enumerate(old_slots):
                if typ is None:
                    continue
                ay, ax = anchors[i]
                floats.append(
                    (
                        typ,
                        int(round(ay + (mid[0] - ay) * t)),
                        int(round(ax + (mid[1] - ax) * t)),
                    )
                )
            frames.append(
                self._render_frame(force_slots=[None, None], force_stock=before_stock, float_tiles=floats)
            )
        frames.append(
            self._render_frame(
                force_slots=[None, None],
                force_stock=before_stock,
                float_tile=(outs[0], mid[0], mid[1]),
                merge_flash=True,
            )
        )
        for out in outs:
            dest = self._bin_anchor(out)
            for t in (0.4, 0.8):
                fy = int(round(mid[0] + (dest[0] - mid[0]) * t))
                fx = int(round(mid[1] + (dest[1] - mid[1]) * t))
                frames.append(
                    self._render_frame(
                        force_slots=[None, None],
                        force_stock=before_stock,
                        float_tile=(out, fy, fx),
                    )
                )
            self._stock[out] = self._stock.get(out, 0) + 1
            before_stock = dict(self._stock)
            frames.append(self._render_frame(highlight_bin=out, force_stock=before_stock))
        frames.append(self._render_frame())
        self._pending_frames = self._maybe_complete(frames)
        return self.public_state()

    def _do_break(self, before: list[list[int]]) -> dict[str, Any]:
        src = self._break_slot
        assert src is not None
        parts = self._breaks[src]
        before_stock = dict(self._stock)
        origin = self._break_anchor()

        self._break_slot = None

        frames: list[list[list[int]]] = [before]
        frames.append(self._render_frame(force_break=src, force_stock=before_stock, slot_pulse=True))
        # Split into two colours flying apart then to bag.
        left = (origin[0], origin[1] - 4)
        right = (origin[0], origin[1] + 4)
        frames.append(
            self._render_frame(
                force_break=None,
                force_stock=before_stock,
                float_tiles=[(parts[0], left[0], left[1]), (parts[1], right[0], right[1])],
                merge_flash=True,
            )
        )
        for part, side in ((parts[0], left), (parts[1], right)):
            dest = self._bin_anchor(part)
            for t in (0.45, 0.85):
                fy = int(round(side[0] + (dest[0] - side[0]) * t))
                fx = int(round(side[1] + (dest[1] - side[1]) * t))
                frames.append(
                    self._render_frame(
                        force_break=None,
                        force_stock=before_stock,
                        float_tile=(part, fy, fx),
                    )
                )
            self._stock[part] = self._stock.get(part, 0) + 1
            before_stock = dict(self._stock)
        frames.append(self._render_frame())
        self._pending_frames = frames
        return self.public_state()

    def _do_exchange(self) -> bool:
        if len(self._exchange) != 2 or self._hand is None:
            return False
        a, b = self._exchange
        if self._hand == a:
            self._hand = b
            return True
        if self._hand == b:
            self._hand = a
            return True
        return False

    def _maybe_complete(self, frames: list[list[list[int]]]) -> list[list[list[int]]]:
        if not self._order_complete():
            return frames
        self.levels_completed += 1
        if self.levels_completed >= self.win_levels:
            self.state = "WIN"
            return frames + [self._render_frame(win=True), self._render_frame(win=True)]
        self._begin_level(self.levels_completed)
        return frames + [self._render_frame()]

    # --- Draw ---

    def _draw_bag(self, frame: list[list[int]]) -> None:
        y, x, h, w = self._bag_body()
        _fill(frame, y + 2, x, h - 2, w, C_VDGREY)
        _border(frame, y + 2, x, h - 2, w, C_BROWN)
        _fill(frame, y, x + 1, 3, w - 2, C_BROWN)
        _border(frame, y, x + 1, 3, w - 2, C_MGREY)

    def _draw_table(self, frame: list[list[int]]) -> None:
        y, x, h, w = self._table_body()
        _fill(frame, y, x, 2, w, C_BROWN)
        _border(frame, y, x, 2, w, C_MGREY)
        _fill(frame, y + 2, x + 1, h - 2, 2, C_DGREY)
        _fill(frame, y + 2, x + w - 3, h - 2, 2, C_DGREY)
        _fill(frame, y + 3, x + 3, h - 5, w - 6, C_VDGREY)
        _border(frame, y + 3, x + 3, h - 5, w - 6, C_DGREY)

    def _draw_chest(self, frame: list[list[int]], *, pulse: bool = False) -> None:
        y, x, h, w = self._chest_body()
        rim = C_GREEN if pulse else C_BROWN
        _fill(frame, y + 4, x, h - 4, w, C_VDGREY)
        _border(frame, y + 4, x, h - 4, w, rim)
        _fill(frame, y, x, 5, w, C_BROWN)
        _border(frame, y, x, 5, w, C_GREEN if pulse else C_MGREY)
        _fill(frame, y + 2, x + w // 2 - 1, 2, 3, C_YELLOW)

    def _draw_craft_legend(
        self,
        frame: list[list[int]],
        y: int,
        x: int,
        h: int,
        w: int,
        recipe: dict[str, Any],
        *,
        matched: bool,
    ) -> None:
        """Craft recipe: [in0][in1] > [out0][/out1]."""
        _fill(frame, y, x, h, w, C_VDGREY)
        _border(frame, y, x, h, w, C_PURPLE if matched else C_MGREY)
        inputs, outs = recipe["inputs"], recipe["outputs"]
        _tile(frame, y + 1, x + 1, self._color(inputs[0]), mode="full")
        _tile(frame, y + 1, x + 5, self._color(inputs[1]), mode="full")
        if 0 <= y + 2 < FRAME:
            for ax in (x + 9, x + 10):
                if 0 <= ax < FRAME:
                    frame[y + 2][ax] = C_PURPLE
            if 0 <= x + 10 < FRAME:
                frame[y + 1][x + 10] = C_PURPLE
                frame[y + 3][x + 10] = C_PURPLE
        _tile(frame, y + 1, x + 12, self._color(outs[0]), mode="full")
        if len(outs) > 1:
            # Second output to the right of the first (e.g. vert | magenta).
            _tile(frame, y + 1, x + 16, self._color(outs[1]), mode="full")

    def _draw_break_legend(
        self,
        frame: list[list[int]],
        y: int,
        x: int,
        h: int,
        w: int,
        src: str,
        outs: list[str],
    ) -> None:
        """Recycle recipe: [src] > [out0][out1] with orange frame."""
        _fill(frame, y, x, h, w, C_VDGREY)
        _border(frame, y, x, h, w, C_ORANGE)
        _tile(frame, y + 1, x + 1, self._color(src), mode="full")
        if 0 <= y + 2 < FRAME:
            for ax in (x + 5, x + 6):
                if 0 <= ax < FRAME:
                    frame[y + 2][ax] = C_ORANGE
            if 0 <= x + 6 < FRAME:
                frame[y + 1][x + 6] = C_ORANGE
                frame[y + 3][x + 6] = C_ORANGE
        _tile(frame, y + 1, x + 8, self._color(outs[0]), mode="full")
        if len(outs) > 1:
            _tile(frame, y + 1, x + 12, self._color(outs[1]), mode="full")

    def _render_frame(
        self,
        *,
        win: bool = False,
        force_slots: list[str | None] | None = None,
        force_stock: dict[str, int] | None = None,
        force_hand: str | None | bool = False,
        force_chest: list[str | None] | None = None,
        force_break: str | None | bool = False,
        float_tile: tuple[str, int, int] | None = None,
        float_tiles: list[tuple[str, int, int]] | None = None,
        highlight_bin: str | None = None,
        order_pulse: bool = False,
        slot_pulse: bool = False,
        merge_flash: bool = False,
    ) -> list[list[int]]:
        frame = [[C_BLACK for _ in range(FRAME)] for _ in range(FRAME)]
        _border(frame, 0, 0, PLAY_H, FRAME, C_CYAN)
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else (C_CYAN if i == self.levels_completed else C_DGREY)
            _fill(frame, 2, EDGE + i * 4, 2, 2, color)

        slots_draw = force_slots if force_slots is not None else self._slots
        stock_draw = force_stock if force_stock is not None else self._stock
        hand_draw: str | None = self._hand if force_hand is False else force_hand  # type: ignore[assignment]
        chest_draw = self._chest_fill if force_chest is None else force_chest
        if force_break is False:
            break_draw = self._break_slot
        else:
            break_draw = force_break  # type: ignore[assignment]

        matched = self._matching_recipe(slots_draw)

        self._draw_bag(frame)
        self._draw_table(frame)
        self._draw_chest(frame, pulse=order_pulse)

        for idx, ty, tx, th, tw in self._recipe_button_rects():
            kind, payload = self._legend_entries()[idx]
            if kind == "craft":
                is_match = matched is not None and matched["id"] == payload["id"]
                self._draw_craft_legend(frame, ty, tx, th, tw, payload, matched=is_match)
            else:
                self._draw_break_legend(
                    frame, ty, tx, th, tw, payload["src"], payload["outputs"]
                )

        saved = self._stock
        # Include hand in visibility while selected.
        self._stock = dict(stock_draw)
        if hand_draw is not None:
            self._stock[str(hand_draw)] = self._stock.get(str(hand_draw), 0)
        try:
            # Temporarily set hand for ranking/display helpers
            real_hand = self._hand
            self._hand = hand_draw
            bin_rects = self._bin_rects()
            self._hand = real_hand
        finally:
            self._stock = saved

        guide = self._guide_target()

        for type_id, by, bx, bh, bw in bin_rects:
            disp = self._bag_display_count(type_id, stock_draw)
            # Selected: keep colour (not ghost) even if remaining stock is 0.
            selected = hand_draw == type_id
            mode = "full" if disp > 0 else "ghost"
            ring = None
            tight = False
            if guide == ("bin", type_id):
                ring = C_WHITE
                tight = False
            elif selected:
                ring = C_WHITE
                tight = True
            if highlight_bin == type_id:
                ring = C_GREEN
                tight = False
            _tile(frame, by, bx, self._color(type_id), mode=mode, ring=ring, tight_ring=tight)
            _count_pips(frame, by + 1, bx + TILE + 2, stock_draw.get(type_id, 0))

        can_craft = matched is not None
        can_break = break_draw is not None and break_draw in self._breaks
        for slot_i, sy, sx, sh, sw in self._slot_rects():
            filled = slots_draw[slot_i] if slot_i < len(slots_draw) else None
            ring = C_GREEN if (can_craft or slot_pulse or merge_flash) else None
            if guide == ("slot", slot_i):
                ring = C_WHITE
            _fill(frame, sy, sx, sh, sw, C_BLACK)
            _border(frame, sy, sx, sh, sw, C_MGREY)
            if ring is not None:
                _border(frame, sy - 1, sx - 1, sh + 2, sw + 2, ring)
            if filled is not None:
                _tile(frame, sy + 1, sx + 1, self._color(filled), mode="full")

        # Craft / demolish buttons above orange seat.
        btns = self._action_btn_rects()
        ay, ax, ah, aw = btns["craft"]
        _fill(frame, ay, ax, ah, aw, C_PURPLE if can_craft else C_VDGREY)
        _border(frame, ay, ax, ah, aw, C_PURPLE if can_craft else C_DGREY)
        dy, dx, dh, dw = btns["demolish"]
        _fill(frame, dy, dx, dh, dw, C_ORANGE if can_break else C_VDGREY)
        _border(frame, dy, dx, dh, dw, C_ORANGE if can_break else C_DGREY)

        # Break seat (orange frame).
        by, bx, bh, bw = self._break_rect()
        _fill(frame, by, bx, bh, bw, C_BLACK)
        _border(frame, by, bx, bh, bw, C_ORANGE)
        if break_draw is None:
            if 0 <= by + 2 < FRAME and 0 <= bx + 2 < FRAME:
                frame[by + 2][bx + 2] = C_ORANGE
        else:
            _tile(frame, by + 1, bx + 1, self._color(break_draw), mode="full")
            if break_draw in self._breaks:
                a, bcol = self._breaks[break_draw]
                # Preview outputs to the left of the seat (stay inside table).
                _tile(frame, by + 1, bx - 8, self._color(a), mode="full")
                _tile(frame, by + 1, bx - 4, self._color(bcol), mode="full")

        if guide == ("craft_btn", None):
            ay, ax, ah, aw = btns["craft"]
            _border(frame, ay - 2, ax - 2, ah + 4, aw + 4, C_WHITE)

        for slot_i, sy, sx, sh, sw in self._chest_slot_rects():
            need = self._order_slots[slot_i]
            filled = chest_draw[slot_i] if slot_i < len(chest_draw) else None
            ring = C_WHITE if guide == ("chest", slot_i) else None
            if filled is None:
                _tile(frame, sy, sx, self._color(need), mode="ghost", ring=ring)
            else:
                _tile(frame, sy, sx, self._color(filled), mode="full", ring=C_GREEN if ring is None else ring)

        if self._exchange:
            ey, exx, _, _ = self._exchange_rect()  # type: ignore[misc]
            a, b = self._exchange
            _tile(frame, ey, exx, self._color(a), mode="ghost")
            _tile(frame, ey, exx + TILE + TILE_GAP, self._color(b), mode="ghost")

        if float_tiles:
            for ft, fy, fx in float_tiles:
                _tile(frame, fy, fx, self._color(ft), mode="full", ring=C_WHITE, tight_ring=True)
        if float_tile is not None:
            ft, fy, fx = float_tile
            _tile(frame, fy, fx, self._color(ft), mode="full", ring=C_WHITE, tight_ring=True)

        if self._flash == "bad":
            ty, tx, th, tw = self._table_body()
            _border(frame, ty, tx, th, tw, C_RED)
        elif self._flash == "bad_chest":
            cy, cx, ch, cw = self._chest_body()
            _border(frame, cy, cx, ch, cw, C_RED)
        elif self._flash == "ok":
            ty, tx, th, tw = self._table_body()
            _border(frame, ty, tx, th, tw, C_GREEN)

        if win:
            _border(frame, 0, 0, FRAME, FRAME, C_GREEN)

        _fill(frame, PLAY_H, 0, FRAME - PLAY_H, FRAME, C_BLACK)
        for i in range(self.win_levels):
            color = C_GREEN if i < self.levels_completed else (C_CYAN if i == self.levels_completed else C_DGREY)
            _fill(frame, 59, EDGE + i * 4, 2, 2, color)
        return frame

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
        else:
            frames = [self._render_frame()]
        available = ["ACTION6", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        matched = self._matching_recipe()
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
                14 if len(frames) > 4 else (10 if len(frames) > 1 else int(self.info.default_fps)),
            ),
            "state": self.state,
            "available_actions": available,
            "available_action_ids": [int(a.removeprefix("ACTION")) for a in available],
            "levels_completed": self.levels_completed,
            "win_levels": self.win_levels,
            "level_index": min(self.levels_completed, self.win_levels - 1),
            "level_name": str(self._level.get("name", "")),
            "step_index": self.step_index,
            "level_steps": self.level_steps,
            "last_action": self.last_action,
            "actions_remaining": None,
            "guid": f"{self.info.game_id}:L{self.levels_completed + 1}:{self.step_index}",
            "stock": dict(self._stock),
            "hand": self._hand,
            "energy": self._energy,
            "break_slot": self._break_slot,
            "order_slots": list(self._order_slots),
            "chest_fill": list(self._chest_fill),
            "order_have": self._order_have_count(),
            "order_need": len(self._order_slots),
            "matched_recipe": None if matched is None else matched["id"],
            "tutorial_step": self._tut_step if self._tutorial else None,
            "episode_profile": self._episode_profile,
        }
