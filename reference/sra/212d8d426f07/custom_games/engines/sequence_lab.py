"""SERIES / Sequence Lab: pure-Python port of the approved web v2.

64x64 integer-palette rendering. No digits or question marks in the game frame.
The pure functions preserve the JavaScript state keys for regression comparison.
SequenceLabEngine is the custom ARC3 backend adapter; it does not expose answers.
Runtime dependencies: Python 3.10+ standard library only.
"""
from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Protocol

FRAME, TILE, BG = 64, 7, 5
PALETTE = ["#FFFFFF", "#CCCCCC", "#999999", "#666666", "#333333", "#000000",
           "#E53AA3", "#FF7BCC", "#F93C31", "#1E93FF", "#88D8F1", "#FFDC00",
           "#FF851B", "#921231", "#4FCC30", "#A356D6"]
INKS = [8, 9, 11, 14, 12, 15, 10, 6, 13, 0, 1, 2, 3, 4]
ROW_Y, OPTION_Y = [1, 12, 23, 34], 50
LEVELS_DIR = Path(__file__).resolve().parents[1] / "games" / "sequence_lab" / "levels"
Image = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]
MAX_JSON_BYTES = 3_000_000


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and abs(value) <= 2**53-1


def blank() -> Image:
    return [[BG] * TILE for _ in range(TILE)]


def image_key(image: Image) -> tuple[tuple[int, ...], ...]:
    return tuple(tuple(row) for row in image)


def ink_count(image: Image) -> int:
    return sum(v != BG for row in image for v in row)


def rotate(image: Image, turns: int = 1) -> Image:
    out = deepcopy(image)
    for _ in range(turns % 4):
        out = [list(row) for row in zip(*out[::-1])]
    return out


def mirror(image: Image) -> Image:
    return [row[::-1] for row in image]


def recolor(image: Image, color: int) -> Image:
    return [[color if v != BG and v >= 6 else v for v in row] for row in image]


def xor(a: Image, b: Image, color: int = 10) -> Image:
    return [[color if (v != BG) != (b[y][x] != BG) else BG
             for x, v in enumerate(row)] for y, row in enumerate(a)]


STENCILS = {
    "square": ["11111"] * 5,
    "squareOpen": ["11111", "10001", "10001", "10001", "11111"],
    "circle": ["01110", "11111", "11111", "11111", "01110"],
    "circleOpen": ["01110", "10001", "10001", "10001", "01110"],
    "diamond": ["00100", "01110", "11111", "01110", "00100"],
    "diamondOpen": ["00100", "01010", "10001", "01010", "00100"],
    "triangle": ["00100", "01110", "01110", "11111", "11111"],
    "triangleOpen": ["00100", "01010", "01010", "10001", "11111"],
    "arrow": ["00100", "01110", "11111", "00100", "00100"],
    "L": ["10000", "10000", "10000", "10000", "11111"],
    "T": ["11111", "00100", "00100", "00100", "00100"],
    "cross": ["00100", "00100", "11111", "00100", "00100"],
}


def paint_pattern(rows: list[str], color: int) -> Image:
    image = blank()
    x0, y0 = (7-len(rows[0]))//2, (7-len(rows))//2
    for y, row in enumerate(rows):
        for x, v in enumerate(row):
            if v not in "0.":
                image[y+y0][x+x0] = color
    return image


def glyph(shape: str = "square", color: int = 9, turn: int = 0,
          filled: bool = True) -> Image:
    name = shape+"Open" if not filled and shape+"Open" in STENCILS else shape
    _require(name in STENCILS, f"Unknown glyph: {shape}")
    return rotate(paint_pattern(STENCILS[name], color), turn)


def dots(count: int, color: int = 9) -> Image:
    _require(integer(count) and 0 <= count <= 9, "Dot count must be between 0 and 9.")
    im = blank()
    for i in range(count):
        im[1+2*(i//3)][1+2*(i%3)] = color
    return im


def size_square(radius: int, color: int) -> Image:
    im = blank()
    for y in range(3-radius, 4+radius):
        for x in range(3-radius, 4+radius):
            im[y][x] = color
    return im


RING = [(3, 0), (6, 0), (6, 3), (6, 6), (3, 6), (0, 6), (0, 3), (0, 0)]


def orbit(markers: list[dict[str, int]]) -> Image:
    im = blank()
    im[3][3] = 3
    for x, y in RING:
        im[y][x] = 4
    for marker in markers:
        x, y = RING[marker["pos"] % 8]
        im[y][x] = 15 if im[y][x] >= 6 else marker["color"]
    return im


def pair(a: dict[str, Any], b: dict[str, Any]) -> Image:
    im = blank()
    stencils = {"arrow": ["010", "011", "010"], "L": ["100", "100", "111"]}
    for i, item in enumerate([a, b]):
        tiny = rotate([[int(v) for v in row] for row in stencils[item.get("shape", "arrow")]], item["turn"])
        for y, row in enumerate(tiny):
            for x, v in enumerate(row):
                if v:
                    im[y+2][x+i*4] = item["color"]
    return im


def binary(n: int, color: int) -> Image:
    im = blank()
    for i in range(3):
        col = color if (n >> (2-i)) & 1 else 3
        for y in range(2, 5):
            im[y][1+i*2] = col
    return im


def transferred_dots(step: int, colors: list[int]) -> Image:
    im = blank()
    for y in range(7):
        im[y][3] = 4
    for i in range(6-step):
        im[1+2*(i//2)][2*(i%2)] = colors[0]
    for i in range(step):
        im[1+2*(i//2)][4+2*(i%2)] = colors[1]
    return im


def turning_dots(turn: int, count: int, colors: list[int]) -> Image:
    im, arrow = blank(), glyph("arrow", colors[0], turn)
    for y in range(5):
        im[y] = list(arrow[y+1])
    for i in range(count):
        im[6][1+2*i] = colors[1]
    return im


def track_pair(top: int, bottom: int, colors: list[int]) -> Image:
    im = blank()
    for y in (1, 5):
        for i in range(4):
            im[y][2*i] = 3
    for dy in (-1, 0, 1):
        im[1+dy][2*top] = colors[0]
        im[5+dy][2*bottom] = colors[1]
    return im


PRESETS = [{'id': 'alternateColor',
  'name': 'Two-colour alternation',
  'hint': 'Look at what repeats every other slot.',
  'explanation': 'The shape stays the same. The two colours alternate A, B, A, B, A, B.'},
 {'id': 'alternateShape',
  'name': 'Two-shape alternation',
  'hint': 'Ignore the colour. Compare the silhouettes.',
  'explanation': 'Circle and triangle alternate. The colour does not change.'},
 {'id': 'count',
  'name': 'Add one dot',
  'hint': 'Count the small dots in each slot.',
  'explanation': 'Each slot contains one more dot: 1, 2, 3, 4, 5, 6.'},
 {'id': 'rotate',
  'name': 'Quarter-turn rotation',
  'hint': 'Follow the direction of the arrow.',
  'explanation': 'The arrow turns 90° clockwise at every step: up, right, down, left, up, right.'},
 {'id': 'colorCycle',
  'name': 'Three-colour cycle',
  'hint': 'Find the shortest repeating group of colours.',
  'explanation': 'Three colours repeat in the same order. Slots 1–3 are repeated in slots 4–6.'},
 {'id': 'shapeCycle',
  'name': 'Three-shape cycle',
  'hint': 'A group of three different shapes returns.',
  'explanation': 'Square, circle and diamond repeat in that order.'},
 {'id': 'fill',
  'name': 'Solid / hollow alternation',
  'hint': 'Pay attention to the inside of each shape.',
  'explanation': 'The diamond alternates between solid and hollow. Its colour and size stay fixed.'},
 {'id': 'orbit',
  'name': 'Moving marker',
  'hint': 'Use the centre point as a reference. Follow the coloured marker.',
  'explanation': 'The coloured marker advances a quarter-turn clockwise around the centre: top, right, '
                 'bottom, left, top, right.'},
 {'id': 'rotateColor',
  'name': 'Rotation + alternation',
  'hint': 'Track direction and colour separately.',
  'explanation': 'Two rules act together: a clockwise quarter-turn each step, and alternating colours.'},
 {'id': 'countColor',
  'name': 'Counting + colour cycle',
  'hint': 'Count the dots first, then check their colour.',
  'explanation': 'The dot count increases from 1 to 6. Independently, three colours repeat in order.'},
 {'id': 'shapeFill',
  'name': 'Shape cycle + fill',
  'hint': 'Shape and fill have different repeat lengths.',
  'explanation': 'The shape cycles square → circle → diamond, while solid and hollow alternate every step.'},
 {'id': 'bounce',
  'name': 'Growing and shrinking',
  'hint': 'The shape grows, reaches a maximum, then shrinks.',
  'explanation': 'The centred square widths are 1, 3, 5, 3, 1, 3 pixels. The size bounces between its '
                 'smallest and largest state.'},
 {'id': 'interleaveCount',
  'name': 'Two interleaved counts',
  'hint': 'Read slots 1, 3, 5 separately from slots 2, 4, 6.',
  'explanation': 'Odd-numbered slots contain 1, 2, 3 dots in one colour. Even-numbered slots contain 3, 4, 5 '
                 'dots in the other colour.'},
 {'id': 'interleaveRotation',
  'name': 'Two interleaved rotations',
  'hint': 'The two colours identify two different arrow sequences.',
  'explanation': 'Odd slots turn clockwise: up, right, down. Even slots turn counter-clockwise: right, up, '
                 'left.'},
 {'id': 'counterRotation',
  'name': 'Two opposing rotations',
  'hint': 'Follow the small left glyph and right glyph independently.',
  'explanation': 'The left glyph turns clockwise by 90° each step. The right L turns counter-clockwise by '
                 '90°. They keep their colours and their side.'},
 {'id': 'acceleratingOrbit',
  'name': 'Increasing angular steps',
  'hint': 'Count the number of marked positions crossed, not just the destination.',
  'explanation': 'Around the eight marked positions, the clockwise jumps grow: +1, +2, +3, +4, then +5. The '
                 'positions are 0, 1, 3, 6, 2, 7.'},
 {'id': 'xor',
  'name': 'Exclusive overlay',
  'hint': 'Compare two consecutive glyphs: what would remain if their shared pixels disappeared?',
  'explanation': 'Each glyph is the exclusive overlay (XOR) of the previous two: pixels present in only one '
                 'remain, while shared pixels disappear. This produces A, B, A XOR B, A, B, A XOR B.'},
 {'id': 'conveyor',
  'name': 'Colour shift + marker',
  'hint': 'Separate the moving colours from the small top/bottom marker.',
  'explanation': 'The three coloured bars shift one place right, wrapping to the left. Independently, the '
                 'small neutral marker alternates above and below them.'},
 {'id': 'alternatingSteps',
  'name': 'Alternating rotation steps',
  'hint': 'The amount of rotation alternates; the colour follows its own cycle.',
  'explanation': 'The arrow alternates clockwise turns of +90°, +180°, +90°, +180°, +90°. Independently, the '
                 'three colours cycle.'},
 {'id': 'binary',
  'name': 'Three-position counter',
  'hint': 'The right mark changes each time; the middle changes every two steps; the left every four.',
  'explanation': 'The three marks encode 1, 2, 3, 4, 5, 6 in binary. Bright means on; grey means off. The '
                 'three positions have weights 4, 2, 1 from left to right.'},
 {'id': 'rotateXor',
  'name': 'Rotating exclusive overlay',
  'hint': 'Try combining the previous two glyphs, after turning the most recent one.',
  'explanation': 'To obtain each new glyph, turn the most recent glyph 90° clockwise, then XOR it with the '
                 'one before it. Keep pixels belonging to exactly one of these two images.'},
 {'id': 'twoOrbits',
  'name': 'Two markers and a collision',
  'hint': 'Follow each marker through the purple overlap.',
  'explanation': 'The red and blue markers move one position each step in opposite directions around the '
                 'eight-position ring. When they meet, the two markers are shown as one purple pixel; they '
                 'then continue past each other.'},
 {'id': 'triple',
  'name': 'Three simultaneous cycles',
  'hint': 'Track the orientation, colour and fill as three separate clocks.',
  'explanation': 'The triangle rotates 90° clockwise each step, its colour follows a three-colour cycle, and '
                 'solid/hollow alternates. The missing slot must satisfy all three rules.'},
 {'id': 'rotatingBinary',
  'name': 'Rotating counter',
  'hint': 'Mentally undo the quarter-turns, then read the three on/off marks.',
  'explanation': 'The underlying three-bit counter increases 1, 2, 3, 4, 5, 6. The whole pattern turns 90° '
                 'clockwise at every step and the bright colour alternates. Follow the positional weights '
                 'through the rotation.'},
 {'id': 'pairedTurns',
  'name': 'Quarter-turns in pairs',
  'hint': 'Compare consecutive pairs of arrows. Within a pair, only the colour changes.',
  'explanation': 'Each direction is shown twice: up, up, right, right, down, down. Between pairs, the arrows '
                 'turn a quarter-turn clockwise. The two colours alternate throughout.'},
 {'id': 'transferDots',
  'name': 'Transfer one dot',
  'hint': 'Compare the dots on each side of the vertical divider. Look at the total as well.',
  'explanation': 'At every step, the left group loses one dot and the right group gains one. There are '
                 'always six coloured dots in total. Their positions fill the same order within each group; '
                 'no numeral system is involved.'},
 {'id': 'turnAndDots',
  'name': 'A turn and a dot cycle',
  'hint': 'Follow the arrow first. Then compare only the dots along the bottom.',
  'explanation': 'The arrow turns a quarter-turn clockwise at every step. Independently, the bottom dots '
                 'repeat a cycle of one, two, three. The missing image must continue both simple patterns.'},
 {'id': 'bouncingTracks',
  'name': 'Two mirrored tracks',
  'hint': 'Follow the top marker across the four marked positions. What happens at the end of its track?',
  'explanation': 'The upper marker advances one marked position to the right, reaches the end, then reverses '
                 'direction. The lower marker always occupies the mirrored position on its own track. The '
                 'visible return after the endpoint establishes the bounce before the missing image.'}]
PRESET_MAP = {p["id"]: p for p in PRESETS}


def build_terms(spec: Mapping[str, Any]) -> list[Image]:
    _require(isinstance(spec, Mapping) and spec.get("family") in PRESET_MAP, "Unknown rule family.")
    family, c = spec["family"], spec.get("colors", [8, 9, 14])
    _require(isinstance(c, list) and len(c) == 3 and all(integer(v) and 6 <= v <= 15 for v in c)
             and len(set(c)) == 3, "Three distinct chromatic palette indices are required.")
    seq = []
    for t in range(6):
        if family == "alternateColor": im = glyph("square", c[t%2])
        elif family == "alternateShape": im = glyph("triangle" if t%2 else "circle", c[0])
        elif family == "count": im = dots(t+1, c[0])
        elif family == "rotate": im = glyph("arrow", c[0], t)
        elif family == "colorCycle": im = glyph("square", c[t%3])
        elif family == "shapeCycle": im = glyph(["square", "circle", "diamond"][t%3], c[0])
        elif family == "fill": im = glyph("diamond", c[0], 0, t%2 == 0)
        elif family == "orbit": im = orbit([{"pos": t*2, "color": c[0]}])
        elif family == "rotateColor": im = glyph("arrow", c[t%2], t)
        elif family == "countColor": im = dots(t+1, c[t%3])
        elif family == "shapeFill": im = glyph(["square", "circle", "diamond"][t%3], c[0], 0, t%2 == 0)
        elif family == "bounce": im = size_square([0, 1, 2, 1, 0, 1][t], c[0])
        elif family == "interleaveCount": im = dots(t//2+(3 if t%2 else 1), c[t%2])
        elif family == "interleaveRotation": im = glyph("arrow", c[t%2], 1-t//2 if t%2 else t//2)
        elif family == "counterRotation": im = pair({"color": c[0], "turn": t}, {"color": c[1], "turn": -t, "shape": "L"})
        elif family == "acceleratingOrbit": im = orbit([{"pos": t*(t+1)//2, "color": c[0]}])
        elif family in ("xor", "rotateXor"):
            if t == 0: im = glyph("L", c[0])
            elif t == 1: im = glyph("arrow", c[0], 1)
            else: im = xor(rotate(seq[t-1]) if family == "rotateXor" else seq[t-1], seq[t-2], c[0])
        elif family == "conveyor":
            im = blank()
            for i in range(3):
                for y in range(2, 5): im[y][1+2*((i+t)%3)] = c[i]
            im[6 if t%2 else 0][3] = 2
        elif family == "alternatingSteps": im = glyph("arrow", c[t%3], [0, 1, 3, 0, 2, 3][t])
        elif family == "binary": im = binary(t+1, c[0])
        elif family == "twoOrbits": im = orbit([{"pos": t, "color": 8}, {"pos": 4-t, "color": 9}])
        elif family == "triple": im = glyph("triangle", c[t%3], t, t%2 == 0)
        elif family == "rotatingBinary": im = rotate(binary(t+1, c[t%2]), t)
        elif family == "pairedTurns": im = glyph("arrow", c[t%2], t//2)
        elif family == "transferDots": im = transferred_dots(t, c)
        elif family == "turnAndDots": im = turning_dots(t, 1+t%3, c)
        elif family == "bouncingTracks":
            pos = [0, 1, 2, 3, 2, 1][t]
            im = track_pair(pos, 3-pos, c)
        else: raise ValueError(f"Unsupported rule: {family}")
        seq.append(im)
    return seq


def _rng(seed: int):
    """Mulberry32, preserving JavaScript unsigned 32-bit arithmetic."""
    x = seed & 0xFFFFFFFF
    while True:
        x = (x+0x6D2B79F5) & 0xFFFFFFFF
        t = ((x ^ (x >> 15)) * (x | 1)) & 0xFFFFFFFF
        t ^= (t+(((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        yield ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def make_question(family: str, seed: int = 1, count: int = 4, missing: int = 5,
                  colors: list[int] | None = None) -> dict[str, Any]:
    _require(integer(count) and 3 <= count <= 6, "Use three to six choices.")
    _require(integer(missing) and 0 <= missing < 6, "Missing index must be 0–5.")
    _require(integer(seed), "Seed must be an integer.")
    colors = list(colors) if colors is not None else [8, 9, 14]
    spec = {"family": family, "colors": colors}
    terms = build_terms(spec)
    target, pool, seen = terms[missing], [], {image_key(terms[missing])}
    def add(im: Image) -> None:
        k = image_key(im)
        if ink_count(im) and k not in seen:
            seen.add(k); pool.append(im)
    if family == "bouncingTracks":
        for i in range(4): add(track_pair(i, 3-i, colors))
        for a, b in [(1, 1), (2, 2), (0, 0), (3, 3)]: add(track_pair(a, b, colors))
    for d in range(1, 6): add(terms[(missing-d)%6])
    for t in range(1, 4): add(rotate(target, t))
    add(mirror(target))
    for c in [8, 9, 14, 11, 15, 12, 10]: add(recolor(target, c))
    for sh in ["square", "circle", "diamond", "triangle"]: add(glyph(sh, colors[0]))
    for y in range(7):
        for x in range(7):
            im = deepcopy(target); im[y][x] = colors[0] if im[y][x] == BG else BG; add(im)
    options, random = [deepcopy(target), *pool[:count-1]], _rng(seed)
    for i in range(len(options)-1, 0, -1):
        j = math.floor(next(random)*(i+1))
        options[i], options[j] = options[j], options[i]
    preset = PRESET_MAP[family]
    return validate_question({"id": family, "title": "Find the missing card", "terms": terms,
        "missing": missing, "options": options, "answer": options.index(target),
        "hint": preset["hint"], "explanation": preset["explanation"], "rule": spec})


def validate_image(im: Any, label: str = "Card") -> Image:
    _require(isinstance(im, list) and len(im) == 7 and all(isinstance(r, list) and len(r) == 7
             and all(integer(v) and 0 <= v < 16 for v in r) for r in im),
             f"{label}: expected a 7 × 7 raster with palette indices 0–15.")
    return deepcopy(im)


def _text(raw: Mapping[str, Any], key: str, default: str, limit: int) -> str:
    value = raw.get(key)
    return str(default if value is None else value)[:limit]


def validate_question(raw: Any) -> dict[str, Any]:
    _require(isinstance(raw, dict), "A sequence must be an object.")
    _require(isinstance(raw.get("terms"), list) and len(raw["terms"]) == 6, "Exactly six cards are required.")
    terms = [validate_image(im, f"Card {i+1}") for i, im in enumerate(raw["terms"])]
    m = raw.get("missing")
    _require(integer(m) and 0 <= m < 6, "Missing card index must be 0–5.")
    _require(isinstance(raw.get("options"), list) and 3 <= len(raw["options"]) <= 6, "Use three to six choices.")
    options = [validate_image(im, f"Option {i+1}") for i, im in enumerate(raw["options"])]
    _require(len({image_key(im) for im in options}) == len(options), "Two answer choices look identical.")
    a = raw.get("answer")
    _require(integer(a) and 0 <= a < len(options), "Answer index is outside the options.")
    _require(options[a] == terms[m], "The answer must exactly match the missing card.")
    rule = raw.get("rule")
    if rule is not None:
        _require(isinstance(rule, dict), "A declared rule must be an object.")
        _require(build_terms(rule) == terms, "The cards do not follow the declared rule. Use rule=null for a manual sequence.")
    return {"id": _text(raw, "id", "custom", 50), "title": _text(raw, "title", "Find the missing card", 100),
            "terms": terms, "missing": m, "options": options, "answer": a,
            "hint": _text(raw, "hint", "Compare shape, colour, count and position separately.", 600),
            "explanation": _text(raw, "explanation", "Custom sequence: the author specifies the intended continuation.", 1200),
            "rule": deepcopy(rule)}


def validate_level(raw: Any) -> Level:
    _require(isinstance(raw, dict), "A level must be an object.")
    _require(isinstance(raw.get("questions"), list) and 1 <= len(raw["questions"]) <= 4,
             "A level contains one to four sequences.")
    return {"id": _text(raw, "id", "custom", 40), "title": _text(raw, "title", "Custom study", 80),
            "description": _text(raw, "description", "Complete every sequence to unlock the next level.", 500),
            "questions": [validate_question(q) for q in raw["questions"]]}


def validate_pack(raw: Any) -> list[Level]:
    levels = raw if isinstance(raw, list) else raw.get("levels", [raw]) if isinstance(raw, dict) else []
    _require(isinstance(levels, list) and 1 <= len(levels) <= 6, "Import one to six levels.")
    return [validate_level(l) for l in levels]


def read_json(path: str | Path) -> Any:
    p = Path(path)
    if p.stat().st_size > MAX_JSON_BYTES:
        raise ValueError("Maximum JSON file size: 3 MB.")
    return json.loads(p.read_text(encoding="utf-8-sig"))


def load_levels(path: str | Path | None = None) -> list[Level]:
    location = Path(path) if path is not None else LEVELS_DIR
    if location.is_file():
        return validate_pack(read_json(location))
    paths = sorted(location.glob("L*.json"))
    if not paths:
        raise FileNotFoundError(f"No L*.json level files in {location}")
    return validate_pack([read_json(p) for p in paths])


def create_state(level: Level) -> State:
    n = len(level["questions"])
    return {"solved": [False]*n, "answers": [None]*n, "attempts": [0]*n, "assisted": [False]*n,
            "active": 0, "focus": 0, "mistakes": 0, "lastEvent": "READY", "wrong": None}


def is_complete(state: State) -> bool:
    return all(state["solved"])


def transition(level: Level, state: State, a: Any) -> State:
    """Pure transition. Does not automatically switch rows; the adapter does."""
    if not isinstance(a, dict): return state
    kind = a.get("type")
    if kind == "reset": return create_state(level)
    if kind == "row":
        i = a.get("index")
        if not integer(i) or not 0 <= i < len(level["questions"]): return state
        return {**state, "active": i, "focus": 0, "lastEvent": "ROW_SELECTED", "wrong": None}
    if kind == "focus":
        i = a.get("index")
        if not integer(i) or not 0 <= i < len(level["questions"][state["active"]]["options"]): return state
        return {**state, "focus": i, "lastEvent": "FOCUSED", "wrong": None}
    if kind == "advanceRow":
        n = len(level["questions"])
        for j in range(1, n+1):
            k = (state["active"]+j)%n
            if not state["solved"][k]:
                return {**state, "active": k, "focus": 0, "wrong": None, "lastEvent": "ROW_SELECTED"}
        return state
    if kind == "assist":
        n = deepcopy(state); n["assisted"][state["active"]] = True; n["lastEvent"] = "ASSISTED"; return n
    if kind != "answer" or state["solved"][state["active"]]: return state
    q, i = level["questions"][state["active"]], a.get("index")
    if not integer(i) or not 0 <= i < len(q["options"]): return state
    n = deepcopy(state)
    n["attempts"][state["active"]] += 1; n["focus"] = i
    if i == q["answer"]:
        n["solved"][state["active"]] = True
        n["answers"][state["active"]] = i; n["wrong"] = None
        n["lastEvent"] = "LEVEL_COMPLETE" if is_complete(n) else "CORRECT"
    else:
        n["mistakes"] += 1
        n["wrong"] = {"row": state["active"], "option": i}; n["lastEvent"] = "INCORRECT"
    return n


def option_rects(count: int) -> list[dict[str, int]]:
    left = (64-(count*10-1))//2
    return [{"x": left+10*i, "y": OPTION_Y, "w": 9, "h": 9} for i in range(count)]


def hit(level: Level, state: State, x: Any, y: Any) -> dict[str, Any] | None:
    if not integer(x) or not integer(y) or not (0 <= x < 64 and 0 <= y < 64): return None
    for i in range(len(level["questions"])):
        if ROW_Y[i] <= y < ROW_Y[i]+9 and 1 <= x <= 62: return {"type": "row", "index": i}
    for i, r in enumerate(option_rects(len(level["questions"][state["active"]]["options"]))):
        if r["x"] <= x < r["x"]+r["w"] and r["y"] <= y < r["y"]+r["h"]:
            return {"type": "answer", "index": i}
    return None


def decode_action(level: Level, state: State, aid: int, data: Mapping[str, Any] | None = None) -> dict | None:
    if not integer(aid): return None
    if aid == 7: return {"type": "reset"}
    if aid in (1, 2): return {"type": "row", "index": (state["active"]+(-1 if aid == 1 else 1)) % len(level["questions"])}
    if aid in (3, 4): return {"type": "focus", "index": (state["focus"]+(-1 if aid == 3 else 1)) % len(level["questions"][state["active"]]["options"])}
    if aid == 5: return {"type": "answer", "index": state["focus"]}
    if aid == 6:
        data = data if isinstance(data, Mapping) else {}
        return hit(level, state, data.get("x"), data.get("y"))
    return None


def action(level: Level, state: State, aid: int, data: Mapping[str, Any] | None = None) -> State:
    return transition(level, state, decode_action(level, state, aid, data))


def render(level: Level, state: State, progress: Mapping[str, int] | None = None,
           fx: Mapping[str, Any] | None = None) -> Image:
    progress = progress if progress is not None else {"completed": 0, "total": 6}
    fx = fx or {}
    f = [[BG]*64 for _ in range(64)]
    def pixel(x: int, y: int, c: int) -> None:
        if 0 <= x < 64 and 0 <= y < 64: f[y][x] = c
    def rect(x: int, y: int, w: int, h: int, c: int) -> None:
        for yy in range(y, y+h):
            for xx in range(x, x+w):
                if yy in (y, y+h-1) or xx in (x, x+w-1): pixel(xx, yy, c)
    for row, q in enumerate(level["questions"]):
        y, solved, active = ROW_Y[row], state["solved"][row], row == state["active"]
        for k in range(6):
            x, missing = 3+k*10, k == q["missing"]
            border = 14 if solved else (0 if missing else 2) if active else 4
            rect(x, y, 9, 9, border)
            # Empty placeholder: no numbers, glyphs or question marks added.
            if not missing or solved:
                for yy in range(7):
                    for xx in range(7): pixel(x+1+xx, y+1+yy, q["terms"][k][yy][xx])
        for yy in range(y+2, y+7): pixel(1, yy, 14 if solved else 0 if active else 4)
    for x in range(2, 62): pixel(x, 46, 3)
    q, solved = level["questions"][state["active"]], state["solved"][state["active"]]
    for i, r in enumerate(option_rects(len(q["options"]))):
        border = 14 if solved and i == q["answer"] else 0 if i == state["focus"] else 3
        if fx.get("wrong") and state["wrong"] == {"row": state["active"], "option": i}: border = 8
        rect(r["x"], r["y"], 9, 9, border)
        for y in range(7):
            for x in range(7): pixel(r["x"]+1+x, r["y"]+1+y, q["options"][i][y][x])
    total = max(1, min(6, progress.get("total") or 6))
    done = max(0, min(total, progress.get("completed") or 0))
    for i in range(total):
        for y in range(61, 63):
            for x in range(2+i*6, 7+i*6): pixel(x, y, 14 if i < done else 3)
    if fx.get("outline") is not None: rect(0, 0, 64, 60, fx["outline"])
    return f


def audit(levels: list[Level]) -> dict[str, Any]:
    results = []
    for level in levels:
        for q in level["questions"]:
            validate_question(q)
            results.append({"level": level["id"], "question": q["id"], "options": len(q["options"]),
                            "uniqueImages": len({image_key(im) for im in q["options"]}),
                            "matchingOptions": sum(im == q["terms"][q["missing"]] for im in q["options"]),
                            "declaredRuleChecked": q["rule"] is not None,
                            "nonemptyCards": all(ink_count(im) > 0 for im in q["terms"])})
    return {"levels": len(levels), "sequences": len(results), "results": results}


def feedback_frames(level: Level, state: State, progress: Mapping[str, int],
                    event: str) -> tuple[list[Image], list[int]]:
    """Finite animations only; never sleep or mutate the authoritative state."""
    if event == "INCORRECT":
        return ([render(level, state, progress, {"wrong": v}) for v in [True, False, True, False]], [130]*4)
    if event == "CORRECT": return [render(level, state, progress)], [650]
    if event == "LEVEL_COMPLETE":
        return ([render(level, state, progress, {"outline": c}) for c in [14, 3, 14, 3, 14, 3, 14]], [165]*7)
    return [], []


def validate_session(raw: Any) -> dict[str, Any]:
    """Validate the same JSON progress format as the web v2. Never trust a WIN flag."""
    _require(isinstance(raw, dict) and raw.get("game") == "series-session" and raw.get("version") == 1,
             "This is not a SERIES progress file.")
    pack = validate_pack(raw.get("levels"))
    states = raw.get("states")
    _require(isinstance(states, list) and len(states) == len(pack), "Progress and levels do not match.")
    loaded = []
    for level, s in zip(pack, states):
        n = len(level["questions"])
        _require(isinstance(s, dict) and all(isinstance(s.get(k), list) and len(s[k]) == n
                 for k in ("solved", "answers", "attempts", "assisted")), "Invalid row progress.")
        _require(all(type(v) is bool for v in s["solved"]+s["assisted"]) and
                 all(integer(v) and v >= 0 for v in s["attempts"]), "Invalid counters.")
        _require(integer(s.get("active")) and 0 <= s["active"] < n, "Invalid active row.")
        _require(integer(s.get("focus")) and 0 <= s["focus"] < len(level["questions"][s["active"]]["options"]), "Invalid answer focus.")
        _require(integer(s.get("mistakes")) and s["mistakes"] >= 0, "Invalid mistake count.")
        for j, q in enumerate(level["questions"]):
            good = integer(s["answers"][j]) and s["answers"][j] == q["answer"] and s["attempts"][j] >= 1
            _require(good if s["solved"][j] else s["answers"][j] is None, "Completed rows require the correct answer.")
        _require(sum(s["attempts"]) == s["mistakes"]+sum(s["solved"]), "Attempt counts are inconsistent.")
        clean = {k: deepcopy(s[k]) for k in ("solved", "answers", "attempts", "assisted", "active", "focus", "mistakes")}
        loaded.append({**clean, "lastEvent": "RESTORED", "wrong": None})
    unlocked = next((i for i, s in enumerate(loaded) if not is_complete(s)), len(loaded)-1)
    idx = raw.get("index")
    _require(integer(idx) and 0 <= idx <= unlocked, "Progress points to a locked level.")
    for s in loaded[unlocked+1:]:
        _require(not any(s["attempts"]) and not any(s["solved"]), "A locked level contains answers.")
    return {"pack": pack, "loaded": loaded, "index": idx}


class Campaign:
    """Local campaign with locked progression and JSON-compatible saved progress."""
    def __init__(self, levels: list[Level]):
        self.levels = validate_pack(levels)
        self.states = [create_state(l) for l in self.levels]
        self.index = 0

    @property
    def level(self) -> Level: return self.levels[self.index]

    @property
    def current(self) -> State: return self.states[self.index]

    @property
    def completed(self) -> int: return sum(is_complete(s) for s in self.states)

    @property
    def unlocked(self) -> int:
        return next((i for i, s in enumerate(self.states) if not is_complete(s)), len(self.levels)-1)

    def load(self, index: int) -> bool:
        if not integer(index) or not 0 <= index < len(self.levels) or index > self.unlocked: return False
        self.index = index; return True

    def next(self) -> bool:
        return is_complete(self.current) and self.load(self.index+1)

    def restart(self) -> None:
        for i in range(self.index, len(self.states)): self.states[i] = create_state(self.levels[i])

    def apply(self, a: dict) -> State:
        self.states[self.index] = transition(self.level, self.current, a)
        return self.current

    def to_json(self) -> dict:
        return {"game": "series-session", "version": 1, "levels": deepcopy(self.levels),
                "states": deepcopy(self.states), "index": self.index}

    @classmethod
    def from_json(cls, raw: Any) -> Campaign:
        v = validate_session(raw)
        obj = cls(v["pack"]); obj.states = v["loaded"]; obj.index = v["index"]
        return obj


class GameInfoLike(Protocol):
    game_id: str
    title: str
    family: str
    levels: int
    default_fps: float


@dataclass(frozen=True)
class GameInfo:
    game_id: str = "sequence_lab"
    title: str = "SERIES"
    family: str = "sequence_lab"
    levels: int = 6
    default_fps: float = 8.0


class SequenceLabEngine:
    """ARC3 custom backend. All four rows must be correct before level advancement.

    ACTION1/2: choose row. ACTION3/4: choose answer. ACTION5: submit.
    ACTION6: click (native 64x64 pixel coordinates). ACTION7: reset current level.
    Default animation preserves web v2 feedback. animate=False skips frame creation,
    never changes scoring. auto_advance=False leaves completed levels for next_level().
    """
    def __init__(self, info: GameInfoLike | None = None, *, levels_dir: str | Path | None = None,
                 levels: Any = None, animate: bool = True, auto_advance: bool = True):
        pack = validate_pack(levels) if levels is not None else load_levels(levels_dir)
        self.info = info if info is not None else GameInfo(levels=len(pack))
        _require(integer(self.info.levels) and 1 <= self.info.levels <= len(pack), "info.levels exceeds available levels.")
        _require(isinstance(self.info.default_fps, (int, float)) and not isinstance(self.info.default_fps, bool)
                 and math.isfinite(self.info.default_fps) and self.info.default_fps > 0, "default_fps must be positive.")
        self.win_levels = self.info.levels
        self._templates = deepcopy(pack[:self.win_levels])
        self.animate, self.auto_advance = bool(animate), bool(auto_advance)
        self.source_path = str(levels_dir or LEVELS_DIR)
        self.campaign = Campaign(self._templates)
        self.step_index = self.level_steps = 0
        self.last_action, self.last_event = "RESET", "READY"

    @property
    def state(self) -> str:
        return "WIN" if self.campaign.completed == self.win_levels else "NOT_FINISHED"

    @property
    def levels_completed(self) -> int: return self.campaign.completed

    def reset(self) -> dict[str, Any]:
        self.campaign = Campaign(self._templates)
        self.step_index = self.level_steps = 0
        self.last_action, self.last_event = "RESET", "READY"
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.campaign.restart(); self.level_steps = 0
        self.last_action, self.last_event = "ACTION7", "LEVEL_RESET"
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        if self.campaign.next():
            self.level_steps = 0; self.last_event = "NEXT_LEVEL"
        return self.public_state()

    def action(self, action_id: int, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if not integer(action_id) or not 1 <= action_id <= 7: return self.public_state()
        if action_id == 7:
            self.step_index += 1
            return self.level_reset()
        if self.state == "WIN": return self.public_state()
        self.last_action = f"ACTION{action_id}"
        self.step_index += 1; self.level_steps += 1
        level, before = self.campaign.level, self.campaign.current
        a = decode_action(level, before, action_id, data)
        after = transition(level, before, a)
        self.campaign.states[self.campaign.index] = after
        changed = after is not before
        event = after["lastEvent"] if changed else "NO_CHANGE"
        self.last_event = event
        frames, durations = [], []
        progress = {"completed": self.levels_completed, "total": self.win_levels}
        if self.animate and changed and a and a.get("type") == "answer":
            frames, durations = feedback_frames(level, after, progress, event)
        if changed and event == "CORRECT":
            self.campaign.apply({"type": "advanceRow"})
        elif changed and event == "LEVEL_COMPLETE":
            if self.state == "WIN": self.last_event = "GAME_WON"
            elif self.auto_advance:
                self.campaign.next(); self.level_steps = 0
        result = self.public_state()
        if frames:
            frames.append(result["frame"]); durations.append(max(1, round(1000/self.info.default_fps)))
            result["frames"], result["frame_count"] = frames, len(frames)
            result["frame_durations_ms"] = durations
            # Existing custom viewers may only implement a constant interval.
            result["transition_frame_interval_ms"] = durations[0]
        return result

    def public_state(self) -> dict[str, Any]:
        c, s = self.campaign, self.campaign.current
        frame = render(c.level, s, {"completed": c.completed, "total": self.win_levels})
        ids = [7] if self.state == "WIN" else list(range(1, 8))
        return {"backend": "custom", "selected": True, "game_id": self.info.game_id,
                "title": self.info.title, "frame": frame, "frames": [frame], "frame_count": 1,
                "frame_durations_ms": [max(1, round(1000/self.info.default_fps))],
                "default_fps": self.info.default_fps, "state": self.state, "level": c.index+1,
                "levels_completed": c.completed, "win_levels": self.win_levels, "step_index": self.step_index,
                "available_actions": [f"ACTION{i}" for i in ids], "available_action_ids": ids,
                "last_action": self.last_action, "last_event": self.last_event, "score": c.completed,
                "full_reset": False, "source_path": self.source_path, "custom_family": self.info.family,
                "level_name": c.level["title"], "level_steps": self.level_steps,
                "active_row": s["active"], "focused_option": s["focus"],
                "solved_rows": list(s["solved"]), "questions_completed": sum(s["solved"]),
                "questions_total": len(s["solved"]), "attempts": sum(s["attempts"]), "mistakes": s["mistakes"],
                "level_complete": is_complete(s), "palette": list(PALETTE)}


# Alternative class name for registries using the displayed game title.
SeriesEngine = SequenceLabEngine
