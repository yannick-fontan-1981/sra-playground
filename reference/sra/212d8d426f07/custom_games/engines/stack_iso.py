"""STCK — isometric diamond-grid card-stack combat.

Controls:
  ACTION6 click — at shop: add color button / remove stack card
  ACTION5 SPACE — execute player program (bottom→top), then each living enemy
  ACTION7       — soft reset current level

Cards (bottom executes first; damage removes from the TOP):
  cyan   → walk left
  blue   → walk up
  green  → walk right
  yellow → walk down
  red    → attack 8 neighbours (−1 top card each enemy hit)
  pink   → push stacks on the 8 neighbouring cells 1 step away

Shop palette and max stack length are per-level. Brown is removed.
Holes use an orange/grey diamond pattern (death on enter).

Layout 64×64: left stack viewer · isometric board · bottom shop buttons · HUD.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from custom_games.registry import CustomGameInfo

# ARC-AGI-3 UI palette indices
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
C_BROWN = 13  # kept only for palette completeness; not a shop card
C_GREEN = 14
C_PURPLE = 15

C_BG = C_BLACK
C_FLOOR = C_BLACK
C_FLOOR_EDGE = C_DGREY
C_HOLE = C_ORANGE
C_HOLE_GREY = C_DGREY
C_HOLE_DARK = C_VDGREY
C_SHOP = C_MAGENTA
C_HUD = C_VDGREY
C_HUD_DONE = C_GREEN
C_HUD_SLOT = C_DGREY
C_PLAYER_RING = C_WHITE
C_ENEMY_RING = C_PURPLE  # violet base for enemy stacks
C_BTN_OFF = C_VDGREY

# Exact hole glyph (O=orange, G=dark grey, g=very dark grey, space=transparent).
#     G
#   GOgOG
# GOOOOOOOG
#   GOOOG
#     G
HOLE_GLYPH = (
    "    G    ",
    "  GOgOG  ",
    "GOOOOOOOG",
    "  GOOOG  ",
    "    G    ",
)
assert all(len(row) == 9 for row in HOLE_GLYPH)
_HOLE_CHAR_COLOR = {
    "O": C_ORANGE,
    "G": C_DGREY,
    "g": C_VDGREY,
}

# Empty stack bases (3×3 diamond).
# Player empty:  W / WWW / W
# Enemy empty:   P / PPP / P  (P = purple)
EMPTY_BASE_PLAYER = (
    (None, C_WHITE, None),
    (C_WHITE, C_WHITE, C_WHITE),
    (None, C_WHITE, None),
)
EMPTY_BASE_ENEMY = (
    (None, C_PURPLE, None),
    (C_PURPLE, C_PURPLE, C_PURPLE),
    (None, C_PURPLE, None),
)

ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_SPACE, ACTION_CLICK, ACTION_RESET = 5, 6, 7

FRAME = 64
LEFT_W = 11
BTN_H = 5  # exact fixed button-bar height (user glyph is 5 rows × 64)
HUD_H = 5
PLAY_H = FRAME - BTN_H - HUD_H  # 54
BOARD_X0 = LEFT_W
BOARD_W = FRAME - LEFT_W  # 53
MAX_STACK_HARD = 12
DEFAULT_MAX_STACK = 6

# Isometric diamond half-extents (width 8, height 4 → classic 2:1)
ISO_HW = 4
ISO_HH = 2

LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "stack_iso" / "levels"

CARD_CYAN = "cyan"
CARD_BLUE = "blue"
CARD_GREEN = "green"
CARD_YELLOW = "yellow"
CARD_RED = "red"
CARD_PINK = "pink"

# Shop / button order (brown removed).
CARD_ORDER = (
    CARD_CYAN,
    CARD_BLUE,
    CARD_GREEN,
    CARD_YELLOW,
    CARD_RED,
    CARD_PINK,
)
CARD_COLOR = {
    CARD_CYAN: C_CYAN,
    CARD_BLUE: C_BLUE,
    CARD_GREEN: C_GREEN,
    CARD_YELLOW: C_YELLOW,
    CARD_RED: C_RED,
    CARD_PINK: C_PINK,
}
CARD_DELTA = {
    CARD_CYAN: (0, -1),   # left
    CARD_BLUE: (-1, 0),   # up
    CARD_GREEN: (0, 1),   # right
    CARD_YELLOW: (1, 0),  # down
}
CARD_ALIASES = {
    "c": CARD_CYAN,
    "cyan": CARD_CYAN,
    "u": CARD_BLUE,
    "b": CARD_BLUE,
    "blue": CARD_BLUE,
    "g": CARD_GREEN,
    "green": CARD_GREEN,
    "y": CARD_YELLOW,
    "yellow": CARD_YELLOW,
    "r": CARD_RED,
    "red": CARD_RED,
    "p": CARD_PINK,
    "pink": CARD_PINK,
    # legacy brown → red (enemies use attack instead of noop)
    "n": CARD_RED,
    "brown": CARD_RED,
    "noop": CARD_RED,
    "w": CARD_RED,
}

# Fixed full-width shop bar (exactly 64×5). No layout shift when a slot is locked.
# Legend: B=black, b=blue, C=cyan, G=dark grey, g=green, Y=yellow, R=red, W=white, P=pink.
BUTTON_BAR = (
    "BBCCCCGCCCCBbbbbGbbbbBggggGggggBYYYYGYYYYBRRRRWRRRRBPPPPWPPPPBBB",
    "BBCCWCCCGCCBbbGbbbWbbBggGgggGggBYYGYYYGYYBRRWRRRWRRBPPWPGPWPPBBB",
    "BBGCCCCCCCGBGbbbbbbbGBGgggggggGBGYYYYYYYGBWRRRRRRRWBWGPGPGPGWBBB",
    "BBCCGCCCGCCBbbGbbbGbbBggGgggWggBYYWYYYGYYBRRWRRRWRRBPPWPGPWPPBBB",
    "BBCCCCGCCCCBbbbbGbbbbBggggGggggBYYYYGYYYYBRRRRWRRRRBPPPPWPPPPBBB",
)
assert all(len(row) == FRAME for row in BUTTON_BAR)
assert len(BUTTON_BAR) == BTN_H

# Inclusive-exclusive x ranges of each fixed shop slot (9px faces, black separators).
BUTTON_SLOT_X: dict[str, tuple[int, int]] = {
    CARD_CYAN: (2, 11),
    CARD_BLUE: (12, 21),
    CARD_GREEN: (22, 31),
    CARD_YELLOW: (32, 41),
    CARD_RED: (42, 51),
    CARD_PINK: (52, 61),
}

_BUTTON_CHAR_COLOR = {
    "B": C_BLACK,
    "b": C_BLUE,
    "C": C_CYAN,
    "G": C_DGREY,
    "g": C_GREEN,
    "Y": C_YELLOW,
    "R": C_RED,
    "W": C_WHITE,
    "P": C_PINK,
}


def normalize_card(raw: str) -> str:
    key = str(raw).strip().lower()
    if key not in CARD_ALIASES:
        raise ValueError(f"unknown card {raw!r}")
    return CARD_ALIASES[key]


@dataclass
class StackActor:
    actor_id: str
    row: int
    col: int
    cards: list[str]  # index 0 = bottom (executes first); last = top (damage first)
    is_player: bool = False
    alive: bool = True


@dataclass
class LevelState:
    name: str
    width: int
    height: int
    max_steps: int
    max_stack: int
    shop_cards: tuple[str, ...]
    floors: set[tuple[int, int]]
    holes: set[tuple[int, int]]
    shops: set[tuple[int, int]]
    player: StackActor
    enemies: list[StackActor]
    # Didactic outlines (e.g. L01): white ring on a stack card / shop button.
    hint_outline_stack_card: str | None = None
    hint_outline_shop_card: str | None = None
    fx_flash_cells: dict[tuple[int, int], int] = field(default_factory=dict)
    fx_highlight_card: str | None = None
    fx_banner: str | None = None


def _parse_cards(raw: Iterable[Any] | None, *, limit: int = MAX_STACK_HARD) -> list[str]:
    if not raw:
        return []
    out = [normalize_card(str(c)) for c in raw]
    if len(out) > limit:
        raise ValueError(f"stack longer than max_stack={limit}")
    return out


def _load_level(path: Path) -> LevelState:
    data = json.loads(path.read_text(encoding="utf-8"))
    width = int(data["width"])
    height = int(data["height"])
    grid = data["grid"]
    if len(grid) != height or any(len(row) != width for row in grid):
        raise ValueError(f"grid size mismatch in {path}")

    max_stack = int(data.get("max_stack", DEFAULT_MAX_STACK))
    if max_stack < 1 or max_stack > MAX_STACK_HARD:
        raise ValueError(f"max_stack out of range in {path}")

    raw_shop = data.get("shop_cards")
    if raw_shop is None:
        shop_cards = tuple(CARD_ORDER)
    else:
        shop_cards = tuple(normalize_card(str(c)) for c in raw_shop)
        for c in shop_cards:
            if c not in CARD_ORDER:
                raise ValueError(f"shop card {c!r} not sellable in {path}")
        if not shop_cards:
            raise ValueError(f"shop_cards empty in {path}")
        # stable display order = CARD_ORDER filtered by availability
        shop_set = set(shop_cards)
        shop_cards = tuple(c for c in CARD_ORDER if c in shop_set)

    floors: set[tuple[int, int]] = set()
    holes: set[tuple[int, int]] = set()
    shops: set[tuple[int, int]] = set()
    player_pos: tuple[int, int] | None = None
    enemy_marks: list[tuple[int, int]] = []

    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            pos = (r, c)
            if ch in (".", " ", "-"):
                floors.add(pos)
            elif ch in ("#", "X"):
                pass
            elif ch in ("H", "O"):
                holes.add(pos)
            elif ch == "S":
                shops.add(pos)
                floors.add(pos)
            elif ch == "P":
                player_pos = pos
                floors.add(pos)
            elif ch == "E":
                enemy_marks.append(pos)
                floors.add(pos)
            elif ch == "s":
                shops.add(pos)
                floors.add(pos)
                player_pos = pos
            else:
                raise ValueError(f"bad cell {ch!r} in {path} at {r},{c}")

    if player_pos is None:
        pr = data.get("player")
        if not pr:
            raise ValueError(f"no player in {path}")
        player_pos = (int(pr["row"]), int(pr["col"]))
        floors.add(player_pos)

    player_cards = _parse_cards(
        data.get("player_stack") or data.get("player_cards"), limit=max_stack
    )
    player = StackActor(
        actor_id="player",
        row=player_pos[0],
        col=player_pos[1],
        cards=list(player_cards),
        is_player=True,
        alive=True,
    )

    enemies: list[StackActor] = []
    for i, ed in enumerate(data.get("enemies") or []):
        er, ec = int(ed["row"]), int(ed["col"])
        floors.add((er, ec))
        enemies.append(
            StackActor(
                actor_id=str(ed.get("id") or f"e{i+1}"),
                row=er,
                col=ec,
                cards=_parse_cards(ed.get("stack") or ed.get("cards")),
                is_player=False,
                alive=True,
            )
        )
    used = {(e.row, e.col) for e in enemies}
    for j, (er, ec) in enumerate(enemy_marks):
        if (er, ec) in used:
            continue
        enemies.append(
            StackActor(
                actor_id=f"e_mark{j+1}",
                row=er,
                col=ec,
                cards=[CARD_RED],
                is_player=False,
                alive=True,
            )
        )

    if not enemies:
        raise ValueError(f"level {path} needs at least one enemy")

    hint_stack = data.get("hint_outline_stack_card")
    hint_shop = data.get("hint_outline_shop_card")
    return LevelState(
        name=str(data.get("name") or path.stem),
        width=width,
        height=height,
        max_steps=int(data.get("max_steps", 80)),
        max_stack=max_stack,
        shop_cards=shop_cards,
        floors=floors,
        holes=holes,
        shops=shops,
        player=player,
        enemies=enemies,
        hint_outline_stack_card=(
            normalize_card(str(hint_stack)) if hint_stack else None
        ),
        hint_outline_shop_card=(
            normalize_card(str(hint_shop)) if hint_shop else None
        ),
    )


def _load_all_levels() -> list[LevelState]:
    paths = sorted(LEVELS_DIR.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"no levels in {LEVELS_DIR}")
    return [_load_level(p) for p in paths]


def _push_step(src: tuple[int, int], dst: tuple[int, int]) -> tuple[int, int]:
    """Unit step that pushes dst further away from src.

    Orthogonal neighbours move 1 step on that axis; diagonal neighbours keep
    the diagonal (non-orthogonal) step — both components of ±1.
    """
    dr = dst[0] - src[0]
    dc = dst[1] - src[1]
    if dr == 0 and dc == 0:
        return (0, 0)
    sr = 0 if dr == 0 else (1 if dr > 0 else -1)
    sc = 0 if dc == 0 else (1 if dc > 0 else -1)
    return (sr, sc)


def _neighbours8(r: int, c: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            out.append((r + dr, c + dc))
    return out


class StackIsoEngine:
    """Session engine compatible with official_arcade_server custom backend."""

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
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames: list[list[list[int]]] | None = None
        self._level = deepcopy(self._templates[0])
        self._iso_cache: dict[str, Any] = {}

    def reset(self) -> dict[str, Any]:
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = "RESET"
        self.state = "NOT_FINISHED"
        self._pending_frames = None
        self._level = deepcopy(self._templates[0])
        self._iso_cache.clear()
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self.last_action = "ACTION7"
        self._pending_frames = None
        self._iso_cache.clear()
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        return self.public_state()

    def _living(self) -> list[StackActor]:
        lv = self._level
        out: list[StackActor] = []
        if lv.player.alive:
            out.append(lv.player)
        out.extend(e for e in lv.enemies if e.alive)
        return out

    def _actor_at(self, pos: tuple[int, int]) -> StackActor | None:
        for a in self._living():
            if (a.row, a.col) == pos:
                return a
        return None

    def _at_shop(self) -> bool:
        p = self._level.player
        return p.alive and (p.row, p.col) in self._level.shops

    def _walkable(self, pos: tuple[int, int]) -> bool:
        return pos in self._level.floors or pos in self._level.holes or pos in self._level.shops

    def _is_hole(self, pos: tuple[int, int]) -> bool:
        return pos in self._level.holes

    def _shop_palette(self) -> tuple[str, ...]:
        return self._level.shop_cards

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        data = dict(data or {})
        if self.state == "WIN":
            return self.public_state()
        aid = int(action_id)
        if aid == ACTION_RESET:
            return self.level_reset()

        self.last_action = f"ACTION{aid}"

        if aid == ACTION_CLICK:
            self.step_index += 1
            self._click(int(data.get("x", -1)), int(data.get("y", -1)))
            return self.public_state()

        if aid == ACTION_SPACE:
            self.step_index += 1
            self.level_steps += 1
            frames = self._execute_round_animated()
            self._pending_frames = frames
            if self.level_steps >= self._level.max_steps and self.state == "NOT_FINISHED":
                self._pending_frames = self._death_then_reset_frames(prefix=frames)
            return self.public_state()

        return self.public_state()

    def _click(self, x: int, y: int) -> None:
        if not self._level.player.alive:
            return
        btn = self._hit_shop_button(x, y)
        if btn is not None:
            if self._at_shop():
                if btn == self._level.hint_outline_shop_card:
                    # Didactic white ring disappears after the encouraged click.
                    self._level.hint_outline_shop_card = None
                self._add_card(btn)
            return
        idx = self._hit_stack_card(x, y)
        if idx is not None and self._at_shop():
            cards = self._level.player.cards
            if 0 <= idx < len(cards):
                hint = self._level.hint_outline_stack_card
                if hint is not None:
                    # Dismiss when the outlined (bottom-most matching) card is clicked.
                    outline_i = next(
                        (i for i, c in enumerate(cards) if c == hint), None
                    )
                    if outline_i is not None and idx == outline_i:
                        self._level.hint_outline_stack_card = None
                del cards[idx]
            return

    def _add_card(self, card: str) -> None:
        if card not in self._level.shop_cards:
            return
        cards = self._level.player.cards
        if len(cards) >= self._level.max_stack:
            return
        cards.append(card)

    def _damage(self, actor: StackActor) -> None:
        if not actor.alive:
            return
        if actor.cards:
            actor.cards.pop()
        if not actor.cards:
            actor.alive = False

    def _execute_round_animated(self) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = []
        lv = self._level

        def snap(
            banner: str | None = None,
            flash: dict | None = None,
            card: str | None = None,
        ) -> None:
            lv.fx_banner = banner
            lv.fx_flash_cells = dict(flash or {})
            lv.fx_highlight_card = card
            frames.append(self._render_frame())
            lv.fx_banner = None
            lv.fx_flash_cells = {}
            lv.fx_highlight_card = None

        snap()

        if not lv.player.alive:
            return self._death_then_reset_frames(prefix=frames)
        if not lv.player.cards:
            snap(banner="noop")
            return frames

        for card in list(lv.player.cards):
            if not lv.player.alive:
                break
            self._apply_card_animated(lv.player, card, snap)
            if self._check_player_dead_reset(frames):
                return frames

        for enemy in list(lv.enemies):
            if not enemy.alive or not enemy.cards:
                continue
            for card in list(enemy.cards):
                if not enemy.alive:
                    break
                self._apply_card_animated(enemy, card, snap)
                if self._check_player_dead_reset(frames):
                    return frames

        if all(not e.alive for e in lv.enemies) and lv.player.alive:
            for _ in range(3):
                snap(banner="win", flash={(lv.player.row, lv.player.col): C_GREEN})
                snap()
            self.levels_completed += 1
            if self.levels_completed >= self.win_levels:
                self.state = "WIN"
                snap(banner="win")
            else:
                self._level = deepcopy(self._templates[self.levels_completed])
                self.level_steps = 0
                self._iso_cache.clear()
                snap(banner="win")
            return frames

        snap()
        return frames

    def _check_player_dead_reset(self, frames: list[list[list[int]]]) -> bool:
        if self._level.player.alive:
            return False
        death = self._death_then_reset_frames()
        frames.extend(death)
        return True

    def _apply_card_animated(self, actor: StackActor, card: str, snap) -> None:
        # Movement already emits its own 3-frame transition inside _try_step.
        # Red/pink keep a pre-highlight frame like before.
        if card not in CARD_DELTA:
            if actor.is_player:
                snap(banner=card, card=card)
            else:
                snap(banner=card, card=card)

        if card in CARD_DELTA:
            dr, dc = CARD_DELTA[card]
            self._try_step(actor, dr, dc, snap)
        elif card == CARD_RED:
            self._do_attack(actor, snap)
        elif card == CARD_PINK:
            self._do_push(actor, snap)
        else:
            snap()

    def _try_step(self, actor: StackActor, dr: int, dc: int, snap) -> None:
        """Walk one cell as a 3-frame transition (wind-up → arrive → settle)."""
        origin = (actor.row, actor.col)
        nr, nc = actor.row + dr, actor.col + dc
        nxt = (nr, nc)
        move_card = (
            CARD_CYAN
            if dc < 0
            else CARD_GREEN
            if dc > 0
            else CARD_BLUE
            if dr < 0
            else CARD_YELLOW
        )
        color = CARD_COLOR[move_card]
        if not self._walkable(nxt):
            # 3-frame bump against wall / void
            snap(banner="move", flash={origin: C_MGREY}, card=move_card)
            snap(banner="move", flash={origin: C_MGREY}, card=move_card)
            snap(banner="move", card=move_card)
            return
        other = self._actor_at(nxt)
        if other is not None and other.actor_id != actor.actor_id:
            # 3-frame bump against occupied cell
            snap(banner="move", flash={nxt: C_RED}, card=move_card)
            snap(banner="move", flash={nxt: C_RED}, card=move_card)
            snap(banner="move", card=move_card)
            return

        # Frame 1: wind-up — flash origin while still there
        snap(banner="move", flash={origin: color}, card=move_card)
        # Frame 2: arrive — actor moves, flash destination
        actor.row, actor.col = nr, nc
        snap(banner="move", flash={nxt: color}, card=move_card)
        # Frame 3: settle
        snap(banner="move", card=move_card)

        if self._is_hole(nxt):
            actor.alive = False
            actor.cards.clear()
            snap(banner="die", flash={nxt: C_ORANGE})
            snap(banner="die", flash={nxt: C_RED})

    def _do_attack(self, actor: StackActor, snap) -> None:
        r, c = actor.row, actor.col
        flash: dict[tuple[int, int], int] = {}
        victims: list[StackActor] = []
        for pos in _neighbours8(r, c):
            flash[pos] = C_RED
            other = self._actor_at(pos)
            if other is not None and other.actor_id != actor.actor_id:
                victims.append(other)
        snap(banner="attack", flash=flash, card=CARD_RED)
        for v in victims:
            self._damage(v)
            if not v.alive:
                flash[(v.row, v.col)] = C_ORANGE
        snap(banner="attack", flash=flash, card=CARD_RED)
        snap(card=CARD_RED)

    def _do_push(self, actor: StackActor, snap) -> None:
        """Push stacks on the 8 neighbouring cells; flash all 8 like red attack."""
        flash: dict[tuple[int, int], int] = {}
        moves: list[tuple[StackActor, int, int]] = []
        for pos in _neighbours8(actor.row, actor.col):
            # Light every surrounding cell (same coverage as red), even if empty.
            flash[pos] = C_PINK
            other = self._actor_at(pos)
            if other is None or other.actor_id == actor.actor_id:
                continue
            dr, dc = _push_step((actor.row, actor.col), (other.row, other.col))
            if dr == 0 and dc == 0:
                continue
            moves.append((other, dr, dc))
        snap(banner="push", flash=flash, card=CARD_PINK)

        for other, dr, dc in moves:
            if not other.alive:
                continue
            nr, nc = other.row + dr, other.col + dc
            nxt = (nr, nc)
            if not self._walkable(nxt):
                continue
            blocker = self._actor_at(nxt)
            if blocker is not None and blocker.actor_id != other.actor_id:
                continue
            other.row, other.col = nr, nc
            flash[nxt] = C_PINK
            if self._is_hole(nxt):
                other.alive = False
                other.cards.clear()
                flash[nxt] = C_ORANGE
        snap(banner="push", flash=flash, card=CARD_PINK)
        snap(card=CARD_PINK)

    def _death_then_reset_frames(
        self, prefix: list[list[list[int]]] | None = None
    ) -> list[list[list[int]]]:
        frames: list[list[list[int]]] = list(prefix or [])
        pre = self._render_frame()
        for i in range(6):
            if i % 2 == 0:
                flash = [row[:] for row in pre]
                for y in range(PLAY_H):
                    for x in range(FRAME):
                        if flash[y][x] != C_BG:
                            flash[y][x] = C_RED
                frames.append(flash)
            else:
                frames.append([row[:] for row in pre])
        idx = min(self.levels_completed, self.win_levels - 1)
        self._level = deepcopy(self._templates[idx])
        self.level_steps = 0
        self._iso_cache.clear()
        if self.state != "WIN":
            self.state = "NOT_FINISHED"
        frames.append(self._render_frame())
        return frames

    def _stack_layout(self) -> tuple[int, int, int, int]:
        """Return (body_h, gap_px, bottom_y, max_stack).

        Each card is a solid block with exactly 1px gap between blocks.
        """
        n = max(1, len(self._level.player.cards))
        gap = 1
        avail = PLAY_H - 4
        # n bodies + (n-1) gaps, but size against max_stack capacity too
        slots = max(n, 1)
        body = max(2, min(5, (avail - gap * max(0, slots - 1)) // slots))
        return body, gap, PLAY_H - 2, self._level.max_stack

    def _hit_stack_card(self, x: int, y: int) -> int | None:
        if x < 1 or x >= LEFT_W - 1 or y < 0 or y >= PLAY_H:
            return None
        cards = self._level.player.cards
        if not cards:
            return None
        body, gap, bottom, _ = self._stack_layout()
        stride = body + gap
        for i, _ in enumerate(cards):
            y1 = bottom - i * stride
            y0 = y1 - body + 1
            if y0 <= y <= y1:
                return i
        return None

    def _hit_shop_button(self, x: int, y: int) -> str | None:
        y0 = PLAY_H
        y1 = PLAY_H + BTN_H
        if not (y0 <= y < y1):
            return None
        available = set(self._shop_palette())
        for card, (x0, x1) in BUTTON_SLOT_X.items():
            if x0 <= x < x1 and card in available:
                return card
        return None

    def public_state(self) -> dict[str, Any]:
        if self._pending_frames:
            frames = self._pending_frames
            self._pending_frames = None
            frame = frames[-1]
        else:
            frame = self._render_frame()
            frames = [frame]
        level_num = min(self.levels_completed + 1, self.win_levels)
        available = ["ACTION5", "ACTION6", "ACTION7"]
        if self.state == "WIN":
            available = ["ACTION7"]
        fps = self.info.default_fps
        if len(frames) > 1:
            fps = max(fps, 10)
        p = self._level.player
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
            "at_shop": self._at_shop(),
            "player_stack": list(p.cards),
            "player_pos": [p.row, p.col],
            "max_stack": self._level.max_stack,
            "shop_cards": list(self._level.shop_cards),
            "enemies_alive": sum(1 for e in self._level.enemies if e.alive),
            "enemies": [
                {
                    "id": e.actor_id,
                    "row": e.row,
                    "col": e.col,
                    "alive": e.alive,
                    "stack": list(e.cards),
                }
                for e in self._level.enemies
            ],
        }

    def _iso_origin(self) -> tuple[int, int, int, int]:
        key = f"{self._level.width}x{self._level.height}"
        if key in self._iso_cache:
            return self._iso_cache[key]  # type: ignore[return-value]
        w, h = self._level.width, self._level.height
        step_x = ISO_HW
        step_y = ISO_HH
        min_x = min((c - r) * step_x for r in range(h) for c in range(w)) - ISO_HW
        max_x = max((c - r) * step_x for r in range(h) for c in range(w)) + ISO_HW
        min_y = min((c + r) * step_y for r in range(h) for c in range(w)) - ISO_HH
        max_y = max((c + r) * step_y for r in range(h) for c in range(w)) + ISO_HH
        bw = max_x - min_x + 1
        bh = max_y - min_y + 1
        ox = BOARD_X0 + max(0, (BOARD_W - bw) // 2) - min_x
        oy = max(0, (PLAY_H - bh) // 2) - min_y
        self._iso_cache[key] = (ox, oy, step_x, step_y)
        return ox, oy, step_x, step_y

    def _cell_center(self, r: int, c: int) -> tuple[int, int]:
        ox, oy, sx, sy = self._iso_origin()
        return ox + (c - r) * sx, oy + (c + r) * sy

    def _render_frame(self) -> list[list[int]]:
        frame = [[C_BG for _ in range(FRAME)] for _ in range(FRAME)]
        lv = self._level

        def set_px(y: int, x: int, col: int) -> None:
            if 0 <= y < PLAY_H and 0 <= x < FRAME:
                frame[y][x] = col

        def fill_diamond(cx: int, cy: int, fill: int, edge: int | None = None) -> None:
            hh, hw = ISO_HH, ISO_HW
            for dy in range(-hh, hh + 1):
                span = hw - abs(dy) * hw // max(1, hh) if hh else hw
                span = max(0, span)
                for dx in range(-span, span + 1):
                    on_edge = edge is not None and (abs(dx) == span or abs(dy) == hh)
                    set_px(cy + dy, cx + dx, edge if on_edge else fill)

        def paint_hole(cx: int, cy: int) -> None:
            """Exact orange/grey hole glyph (9×5 centered on the diamond)."""
            for row_i, pattern in enumerate(HOLE_GLYPH):
                dy = row_i - 2  # glyph row 2 is the diamond center
                for col_i, ch in enumerate(pattern):
                    if ch == " ":
                        continue
                    dx = col_i - 4
                    col = _HOLE_CHAR_COLOR.get(ch)
                    if col is not None:
                        set_px(cy + dy, cx + dx, col)

        cells = sorted(
            lv.floors | lv.holes | lv.shops,
            key=lambda rc: (rc[0] + rc[1], rc[0]),
        )
        for r, c in cells:
            cx, cy = self._cell_center(r, c)
            pos = (r, c)
            if pos in lv.holes:
                paint_hole(cx, cy)
            elif pos in lv.shops:
                fill_diamond(cx, cy, C_SHOP, C_LGREY)
            else:
                fill_diamond(cx, cy, C_FLOOR, C_FLOOR_EDGE)

            if pos in lv.fx_flash_cells:
                fill_diamond(cx, cy, lv.fx_flash_cells[pos], C_WHITE)

        # Living actors only — dead enemies (purple bases) disappear immediately.
        actors = list(self._living())
        actors.sort(key=lambda a: (a.row + a.col, a.row))
        for a in actors:
            self._draw_actor(frame, a)

        self._draw_stack_panel(frame)
        self._draw_buttons(frame)
        self._draw_hud(frame)
        # Shop hint ring expands 1px into the HUD row — paint after HUD so it stays.
        self._draw_shop_hint_outline(frame)
        if lv.fx_banner:
            self._draw_banner(frame, lv.fx_banner)
        return frame

    def _draw_actor(self, frame: list[list[int]], actor: StackActor) -> None:
        """Draw a vertical tower stack on the cell.

        Empty player base::
             W
            WWW
             W

        Empty enemy base (purple / violet)::
             P
            PPP
             P

        Stacked example (player, blue→green→red bottom→top)::
             R
            RRR
            gRg
            bgb
            WbW
             W
        """
        cx, cy = self._cell_center(actor.row, actor.col)
        rim = C_PLAYER_RING if actor.is_player else C_ENEMY_RING
        cards = list(actor.cards) if actor.alive else []
        # Full stack height on the map (no visual cap).
        colors = [CARD_COLOR.get(c, C_RED) for c in cards]

        # rows bottom→top, each 3-wide (None = transparent)
        rows: list[tuple[int | None, int | None, int | None]]
        if not colors:
            base = EMPTY_BASE_PLAYER if actor.is_player else EMPTY_BASE_ENEMY
            rows = list(base)
        else:
            bottom = colors[0]
            top = colors[-1]
            built: list[tuple[int | None, int | None, int | None]] = [
                (None, rim, None),
                (rim, bottom, rim),
            ]
            # One layer per card step so every card is visible (unlimited height).
            for i in range(len(colors) - 1):
                lower, upper = colors[i], colors[i + 1]
                built.append((lower, upper, lower))
            built.append((top, top, top))
            built.append((None, top, None))
            rows = built

        for i, pattern in enumerate(rows):
            yy = cy + 1 - i  # i=0 is the bottom tip
            for dx, col in zip((-1, 0, 1), pattern):
                if col is None:
                    continue
                y, x = yy, cx + dx
                if 0 <= y < PLAY_H and 0 <= x < FRAME:
                    frame[y][x] = col

    def _draw_stack_panel(self, frame: list[list[int]]) -> None:
        for y in range(PLAY_H):
            for x in range(LEFT_W):
                frame[y][x] = C_VDGREY if x < LEFT_W - 1 else C_DGREY
        cards = self._level.player.cards
        body, gap, bottom, max_stack = self._stack_layout()
        stride = body + gap
        # Capacity pips on left edge
        for i in range(max_stack):
            y = bottom - i * max(2, stride // 2)
            if 0 <= y < PLAY_H:
                frame[y][0] = C_YELLOW if i < len(cards) else C_DGREY
        if not cards:
            for y in range(PLAY_H // 2 - 1, PLAY_H // 2 + 2):
                for x in range(2, LEFT_W - 3):
                    frame[y][x] = C_DGREY
            return
        # Outline at most one didactic stack card (bottom-most match).
        outline_i: int | None = None
        hint = self._level.hint_outline_stack_card
        if hint:
            for i, card in enumerate(cards):
                if card == hint:
                    outline_i = i
                    break
        for i, card in enumerate(cards):
            y1 = bottom - i * stride
            y0 = y1 - body + 1
            col = CARD_COLOR.get(card, C_RED)
            for y in range(max(0, y0), min(PLAY_H, y1 + 1)):
                for x in range(1, LEFT_W - 2):
                    frame[y][x] = col
            # Exactly 1px gap above this block (panel bg already VDGREY; force black line)
            if i + 1 < len(cards) and gap >= 1:
                gap_y = y0 - 1
                if 0 <= gap_y < PLAY_H:
                    for x in range(1, LEFT_W - 2):
                        frame[gap_y][x] = C_BLACK
            if self._level.fx_highlight_card == card:
                for y in range(max(0, y0), min(PLAY_H, y1 + 1)):
                    frame[y][1] = C_WHITE
                    frame[y][LEFT_W - 3] = C_WHITE
            if outline_i == i:
                # 1px OUTSIDE the card face (expand in all 4 directions).
                self._stroke_rect(
                    frame,
                    y0 - 1,
                    y1 + 1,
                    0,
                    LEFT_W - 2,
                    C_WHITE,
                )

    def _draw_buttons(self, frame: list[list[int]]) -> None:
        """Paint the fixed 64×5 shop bar. Locked slots are solid black; layout never shifts."""
        y0 = PLAY_H
        available = set(self._shop_palette()) if self._at_shop() else set()
        for row_i, pattern in enumerate(BUTTON_BAR):
            yy = y0 + row_i
            for xx, ch in enumerate(pattern):
                # Which fixed slot owns this column?
                owner: str | None = None
                for card, (sx0, sx1) in BUTTON_SLOT_X.items():
                    if sx0 <= xx < sx1:
                        owner = card
                        break
                if owner is not None and owner not in available:
                    frame[yy][xx] = C_BLACK
                else:
                    frame[yy][xx] = _BUTTON_CHAR_COLOR.get(ch, C_BLACK)

    def _draw_shop_hint_outline(self, frame: list[list[int]]) -> None:
        """White ring 1px OUTSIDE the hinted shop button (dismissed on click)."""
        hint = self._level.hint_outline_shop_card
        if not hint or hint not in BUTTON_SLOT_X:
            return
        if not (self._at_shop() and hint in set(self._shop_palette())):
            return
        y0 = PLAY_H
        sx0, sx1 = BUTTON_SLOT_X[hint]
        # Face is [sx0, sx1) × [y0, y0+BTN_H); expand 1px outside on every side.
        self._stroke_rect(
            frame,
            y0 - 1,
            y0 + BTN_H,
            sx0 - 1,
            sx1,
            C_WHITE,
        )

    @staticmethod
    def _stroke_rect(
        frame: list[list[int]],
        y0: int,
        y1: int,
        x0: int,
        x1: int,
        color: int,
    ) -> None:
        """1px rectangle outline inclusive of (y0,x0)-(y1,x1)."""
        h = len(frame)
        w = len(frame[0]) if h else 0
        for x in range(x0, x1 + 1):
            if 0 <= y0 < h and 0 <= x < w:
                frame[y0][x] = color
            if 0 <= y1 < h and 0 <= x < w:
                frame[y1][x] = color
        for y in range(y0, y1 + 1):
            if 0 <= y < h and 0 <= x0 < w:
                frame[y][x0] = color
            if 0 <= y < h and 0 <= x1 < w:
                frame[y][x1] = color

    def _draw_hud(self, frame: list[list[int]]) -> None:
        y0 = FRAME - HUD_H
        for y in range(y0, FRAME):
            for x in range(FRAME):
                frame[y][x] = C_HUD
        n = self.win_levels
        gap = 2
        pip_w = 4
        total = n * pip_w + (n - 1) * gap
        x0 = max(0, (FRAME - total) // 2)
        done = self.levels_completed
        for i in range(n):
            col = (
                C_HUD_DONE
                if i < done or self.state == "WIN"
                else (C_YELLOW if i == done else C_HUD_SLOT)
            )
            xx = x0 + i * (pip_w + gap)
            for y in range(y0 + 1, FRAME - 1):
                for x in range(xx, xx + pip_w):
                    if 0 <= x < FRAME:
                        frame[y][x] = col

    def _draw_banner(self, frame: list[list[int]], kind: str) -> None:
        color = {
            "attack": C_RED,
            "push": C_PINK,
            "move": C_CYAN,
            "noop": C_DGREY,
            "die": C_ORANGE,
            "win": C_GREEN,
            CARD_RED: C_RED,
            CARD_PINK: C_PINK,
            CARD_CYAN: C_CYAN,
            CARD_BLUE: C_BLUE,
            CARD_GREEN: C_GREEN,
            CARD_YELLOW: C_YELLOW,
        }.get(kind, C_WHITE)
        for y in range(1, 4):
            for x in range(FRAME - 5, FRAME - 1):
                if y < PLAY_H:
                    frame[y][x] = color
