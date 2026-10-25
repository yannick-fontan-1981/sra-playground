"""DAME — Dames / Dernière couleur: native Python port of web v1.4.

Python 3.10+, standard library only. No browser, Tk, Node, network or solver
is used by this engine. The six accepted v1.4 levels are embedded unchanged.

ACTION6 selects a piece or captures on a cyan destination; ACTION7 resets the
current level; RESET / action(0) restarts the campaign. Selection and invalid
clicks cost no captures. Capturing a queen never transfers her crown.

Frames contain 64x64 integer palette indices. Each response includes ordered
frames and frame_durations_ms; the final image already reflects a level change
or automatic reset. Additional animation frames are not extra game actions.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any

SIZE = FRAME = 64
CELL = 7
FPS = ANIM_FPS = 25
LEVEL_COUNT = 6
GAME_ID = 'dame-c3000001'
FAMILY = 'checkers_solitaire'
WAVE = 'custom_3'
REVISION = WEB_REVISION = 'v1.4'
ACTION_CLICK, ACTION_RESET = 6, 7
PALETTE = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
           '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
           '#FF851B', '#921231', '#4FCC30', '#A356D6']
PIECE_COLOR = {1: 0, 2: 9, 3: 12}
DIRECTIONS = ((1, 1), (1, -1), (-1, 1), (-1, -1))
Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]

# Embedded JSON below is extracted from the accepted standalone HTML.
LEVELS: list[Level] = json.loads(r'''[
  {
    "id": "L01",
    "title": "Les premières bifurcations",
    "width": 5,
    "height": 5,
    "floor": [
      0,
      2,
      4,
      6,
      8,
      10,
      12,
      14,
      16,
      18,
      20,
      22,
      24
    ],
    "pieces": [
      [
        2,
        1
      ],
      [
        6,
        1
      ],
      [
        8,
        1
      ],
      [
        12,
        1
      ],
      [
        16,
        1
      ]
    ],
    "goal": {
      "mode": "single",
      "color": 0
    },
    "dyes": [],
    "portals": [],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  },
  {
    "id": "L02",
    "title": "Préserver les bleus",
    "width": 6,
    "height": 6,
    "floor": [
      0,
      2,
      4,
      7,
      9,
      11,
      12,
      14,
      16,
      19,
      21,
      23,
      24,
      26,
      28,
      31,
      33,
      35
    ],
    "pieces": [
      [
        2,
        3
      ],
      [
        7,
        2
      ],
      [
        16,
        3
      ],
      [
        19,
        3
      ],
      [
        28,
        3
      ],
      [
        33,
        2
      ],
      [
        35,
        2
      ]
    ],
    "goal": {
      "mode": "color",
      "color": 2
    },
    "dyes": [],
    "portals": [],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  },
  {
    "id": "L03",
    "title": "La première couronne",
    "width": 6,
    "height": 6,
    "floor": [
      0,
      2,
      4,
      7,
      9,
      11,
      12,
      14,
      16,
      19,
      21,
      23,
      24,
      26,
      28,
      31,
      33,
      35
    ],
    "pieces": [
      [
        0,
        1
      ],
      [
        4,
        5
      ],
      [
        7,
        1
      ],
      [
        23,
        1
      ],
      [
        26,
        1
      ],
      [
        28,
        1
      ],
      [
        35,
        1
      ]
    ],
    "goal": {
      "mode": "single",
      "color": 0
    },
    "dyes": [],
    "portals": [],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  },
  {
    "id": "L04",
    "title": "Le bain bleu",
    "width": 6,
    "height": 6,
    "floor": [
      0,
      2,
      4,
      7,
      9,
      11,
      12,
      14,
      16,
      19,
      21,
      23,
      24,
      26,
      28,
      31,
      33,
      35
    ],
    "pieces": [
      [
        2,
        3
      ],
      [
        4,
        3
      ],
      [
        7,
        3
      ],
      [
        9,
        3
      ],
      [
        19,
        3
      ],
      [
        24,
        3
      ],
      [
        28,
        3
      ],
      [
        33,
        3
      ]
    ],
    "goal": {
      "mode": "color",
      "color": 2
    },
    "dyes": [
      [
        14,
        2
      ]
    ],
    "portals": [],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  },
  {
    "id": "L05",
    "title": "Le petit passage",
    "width": 6,
    "height": 6,
    "floor": [
      0,
      2,
      4,
      7,
      9,
      11,
      12,
      14,
      16,
      19,
      21,
      23,
      24,
      26,
      28,
      31,
      33,
      35
    ],
    "pieces": [
      [
        4,
        1
      ],
      [
        7,
        1
      ],
      [
        16,
        1
      ],
      [
        23,
        1
      ],
      [
        26,
        1
      ],
      [
        28,
        1
      ],
      [
        31,
        1
      ],
      [
        33,
        1
      ]
    ],
    "goal": {
      "mode": "single",
      "color": 0
    },
    "dyes": [],
    "portals": [
      [
        21,
        12
      ]
    ],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  },
  {
    "id": "L06",
    "title": "Le dernier passage bleu",
    "width": 6,
    "height": 6,
    "floor": [
      0,
      2,
      4,
      7,
      9,
      11,
      12,
      14,
      16,
      19,
      21,
      23,
      24,
      26,
      28,
      31,
      33,
      35
    ],
    "pieces": [
      [
        2,
        3
      ],
      [
        4,
        3
      ],
      [
        7,
        3
      ],
      [
        9,
        3
      ],
      [
        16,
        3
      ],
      [
        21,
        3
      ],
      [
        26,
        3
      ],
      [
        33,
        3
      ],
      [
        35,
        3
      ]
    ],
    "goal": {
      "mode": "single",
      "color": 2
    },
    "portals": [
      [
        14,
        28
      ]
    ],
    "dyes": [
      [
        11,
        2
      ]
    ],
    "fragile": [],
    "version": 5,
    "revision": "v1.4"
  }
]
''')
DEFAULT_LEVELS = LEVELS

def integer(value: Any) -> bool:
    """Number.isSafeInteger semantics for JSON numbers (booleans excluded)."""
    return (type(value) in (int, float) and abs(value) <= 9007199254740991
            and math.isfinite(value) and int(value) == value)


def demand(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def color(value: int) -> int:
    return value % 4


def validate_level(raw: Any) -> Level:
    """Validate and copy an authored level; never solve or modify its puzzle."""
    demand(isinstance(raw, dict), 'Le niveau doit être un objet.')
    l = deepcopy(raw)
    demand(isinstance(l.get('id'), str) and isinstance(l.get('title'), str),
           'Identité de niveau manquante.')
    demand(integer(l.get('width')) and integer(l.get('height'))
           and 5 <= l['width'] <= 8 and 5 <= l['height'] <= 8,
           'Grille : 5 à 8 cases par côté.')
    l['width'], l['height'] = int(l['width']), int(l['height'])
    area = l['width'] * l['height']

    def positions(a: Any) -> bool:
        return (isinstance(a, list)
                and all(integer(p) and 0 <= p < area for p in a)
                and len(set(a)) == len(a))

    demand(positions(l.get('floor')) and bool(l['floor']), 'Sol incorrect.')
    floor = set(l['floor'])
    demand(all((p % l['width'] + p // l['width']) % 2 == 0 for p in floor),
           'Les cases jouables sont les diagonales du damier.')
    pieces = l.get('pieces')
    demand(isinstance(pieces, list) and 2 <= len(pieces) <= 20,
           'Deux à vingt pions requis.')
    demand(all(isinstance(p, list) and len(p) == 2 and integer(p[0])
               and p[0] in floor and integer(p[1]) and p[1] in (1, 2, 3, 5, 6, 7)
               for p in pieces)
           and len({p[0] for p in pieces}) == len(pieces),
           'Pions invalides ou superposés.')
    goal = l.get('goal')
    demand(isinstance(goal, dict) and goal.get('mode') in ('single', 'color')
           and integer(goal.get('color')) and goal['color'] in (0, 1, 2, 3),
           'Objectif incorrect.')
    demand(goal['mode'] != 'color' or goal['color'] > 0,
           'Le mode couleur demande une couleur.')
    for key in ('portals', 'dyes', 'fragile'):
        if l.get(key) is None:
            l[key] = []
    demand(isinstance(l['portals'], list) and len(l['portals']) <= 2
           and all(positions(a) and len(a) == 2 for a in l['portals']),
           'Portails invalides.')
    demand(isinstance(l['dyes'], list)
           and all(isinstance(a, list) and len(a) == 2 and integer(a[0])
                   and a[0] in floor and integer(a[1]) and a[1] in (2, 3)
                   for a in l['dyes']), 'Teintures invalides.')
    demand(positions(l['fragile']) and len(l['fragile']) <= 12,
           'Dalles fragiles invalides.')
    features = [p for pair in l['portals'] for p in pair]
    features += [a[0] for a in l['dyes']] + l['fragile']
    demand(all(p in floor for p in features) and len(set(features)) == len(features),
           'Mécanismes superposés ou hors sol.')
    # JSON writes 1 and 1.0 as the same number in JavaScript. Normalize indices.
    l['floor'] = [int(p) for p in l['floor']]
    l['pieces'] = [[int(p), int(v)] for p, v in pieces]
    l['portals'] = [[int(a), int(b)] for a, b in l['portals']]
    l['dyes'] = [[int(p), int(v)] for p, v in l['dyes']]
    l['fragile'] = [int(p) for p in l['fragile']]
    l['goal']['color'] = int(l['goal']['color'])
    return l


def load_levels(directory: str | Path) -> list[Level]:
    files = sorted(Path(directory).glob('L[0-9][0-9].json'))
    if not files:
        raise FileNotFoundError(f'Aucun fichier Lxx.json dans {directory}')
    return [validate_level(json.loads(p.read_text(encoding='utf-8-sig'))) for p in files]


def compile_level(l: Level) -> dict[str, Any]:
    portals: dict[int, int] = {}
    for a, b in l['portals']:
        portals[a], portals[b] = b, a
    return {'floor': set(l['floor']), 'portals': portals,
            'dyes': dict(l['dyes']), 'fragile': {p: i for i, p in enumerate(l['fragile'])}}


def initial(l: Level) -> State:
    board = [0] * (l['width'] * l['height'])
    for p, v in l['pieces']:
        board[p] = v
    return {'board': board, 'collapsed': 0, 'selected': None, 'moves': 0}


def solved(l: Level, s: State) -> bool:
    live = [v for v in s['board'] if v]
    return (bool(live) and (l['goal']['mode'] == 'color' or len(live) == 1)
            and (not l['goal']['color']
                 or all(color(v) == l['goal']['color'] for v in live)))


def legal(l: Level, s: State, c: dict | None = None,
          only: int | None = None) -> list[dict[str, int]]:
    """Return legal captures in the same deterministic order as web v1.4.

    A man must jump over an adjacent piece. A queen may cross empty cells,
    one victim, then land on any free diagonal cell beyond that victim.
    Teleport exit occupancy is evaluated after source/victim removal.
    """
    c = compile_level(l) if c is None else c
    w, h, board = l['width'], l['height'], s['board']
    found: list[dict[str, int]] = []

    def open_cell(p: int) -> bool:
        return (p in c['floor'] and not (p in c['fragile']
                and s['collapsed'] & (1 << c['fragile'][p])))

    for p, val in enumerate(board):
        if not val or (only is not None and p != only):
            continue
        x, y = p % w, p // w
        for dx, dy in DIRECTIONS:
            victim, distance = None, 0
            xx, yy = x + dx, y + dy
            while 0 <= xx < w and 0 <= yy < h:
                q = xx + w * yy
                distance += 1
                if not open_cell(q):
                    break
                if board[q]:
                    if victim is not None:
                        break
                    victim = q
                    if val < 4 and distance != 1:
                        break
                elif victim is not None:
                    if val < 4 and distance != 2:
                        break
                    arrival = c['portals'].get(q, q)
                    if (open_cell(arrival) and (not board[arrival] or arrival in (p, victim))
                            and not (arrival == p and p in c['fragile'])):
                        found.append({'source': p, 'victim': victim,
                                      'landing': q, 'arrival': arrival})
                    if val < 4:
                        break
                elif val < 4:
                    break
                xx += dx
                yy += dy
    return found


def transition(l: Level, s: State, source: int, landing: int,
               c: dict | None = None) -> dict:
    c = compile_level(l) if c is None else c
    m = next((m for m in legal(l, s, c, source) if m['landing'] == landing), None)
    if m is None:
        return {'state': deepcopy(s), 'event': 'invalid', 'effects': [], 'move': None}
    n, effects = deepcopy(s), []
    value = n['board'][source]
    if source in c['fragile']:
        n['collapsed'] |= 1 << c['fragile'][source]
        effects.append('collapse')
    crowned = value >= 4  # Never inherit the captured piece's crown.
    n['board'][source] = n['board'][m['victim']] = 0
    col = color(value)
    if m['arrival'] in c['dyes'] and col != c['dyes'][m['arrival']]:
        col = c['dyes'][m['arrival']]
        effects.append('dye')
    n['board'][m['arrival']] = col + (4 if crowned else 0)
    n['selected'] = m['arrival']
    n['moves'] += 1
    if m['arrival'] != m['landing']:
        effects.append('portal')
    if abs(source % l['width'] - m['landing'] % l['width']) > 2:
        effects.append('long')
    event = 'success' if solved(l, n) else 'stranded' if not legal(l, n, c) else 'capture'
    return {'state': n, 'event': event, 'effects': effects, 'move': m}


def origin(l: Level) -> list[int]:
    return [(64 - l['width'] * CELL) // 2, 6 + (56 - l['height'] * CELL) // 2]


def center(l: Level, p: int) -> list[int]:
    x, y = origin(l)
    return [x + p % l['width'] * CELL + 3, y + p // l['width'] * CELL + 3]


def cell_at(l: Level, x: int, y: int) -> int | None:
    ox, oy = origin(l)
    cx, cy = (x - ox) // CELL, (y - oy) // CELL
    return cx + cy * l['width'] if 0 <= cx < l['width'] and 0 <= cy < l['height'] else None


def render(l: Level, s: State, completed: list[bool] | None = None,
           o: dict | None = None, c: dict | None = None) -> Frame:
    """Pixel-exact web raster, with optional creator-only animation overlays."""
    completed = [False] * 6 if completed is None else completed
    o = {} if o is None else o
    c = compile_level(l) if c is None else c
    f = [[5] * SIZE for _ in range(SIZE)]

    def fill(x: int, y: int, w: int, h: int, ink: int) -> None:
        for yy in range(max(0, y), min(SIZE, y + h)):
            for xx in range(max(0, x), min(SIZE, x + w)):
                f[yy][xx] = ink

    def box(x: int, y: int, w: int, h: int, ink: int) -> None:
        fill(x, y, w, 1, ink)
        fill(x, y + h - 1, w, 1, ink)
        fill(x, y, 1, h, ink)
        fill(x + w - 1, y, 1, h, ink)

    def glyph(rows: list[str], x: int, y: int, ink: int) -> None:
        for yy, row in enumerate(rows):
            for xx, v in enumerate(row):
                if v == '#':
                    fill(x + xx, y + yy, 1, 1, ink)

    def disc(cx: int, cy: int, v: int) -> None:
        glyph(['.###.', '#####', '#####', '#####', '.###.'], cx-2, cy-2, PIECE_COLOR[color(v)])
        fill(cx, cy, 1, 1, 5)
        if v >= 4:
            glyph(['#.#.#', '#####', '.###.'], cx-2, cy-2, 11)
            fill(cx, cy+1, 1, 1, PIECE_COLOR[color(v)])

    ox, oy = origin(l)
    all_moves = legal(l, s, c)
    movable = {m['source'] for m in all_moves}
    highlights = o.get('highlights') is not False
    choices = [m for m in all_moves if m['source'] == s['selected']] if highlights else []
    destinations = {m['landing'] for m in choices}
    for y in range(l['height']):
        for x in range(l['width']):
            p, px, py = x + y * l['width'], ox + x * CELL, oy + y * CELL
            if (x + y) % 2:
                fill(px, py, 7, 7, 4)
                continue
            broken = p in c['fragile'] and bool(s['collapsed'] & (1 << c['fragile'][p]))
            if p not in c['floor'] or broken:
                fill(px+1, py+1, 1, 1, 3)
                fill(px+5, py+5, 1, 1, 3)
                continue
            fill(px, py, 6, 6, 10 if p in destinations else 3)
            if p in c['dyes']:
                glyph(['#...#', '#...#', '#.#.#', '#...#', '#####'], px+1, py+1,
                      PIECE_COLOR[c['dyes'][p]])
            if p in c['portals']:
                glyph(['.###.', '#...#', '#.#.#', '#...#', '.###.'], px+1, py+1, 6)
                fill(px+3, py+3, 1, 1, 5)
            if p in c['fragile']:
                fill(px+1, py+1, 4, 4, 13)
                fill(px+2, py+1, 1, 2, 5)
                fill(px+3, py+3, 1, 2, 5)
            if s['board'][p] and p != o.get('hide') and p != o.get('hideVictim'):
                disc(px+3, py+3, s['board'][p])
                if highlights and p in movable and s['selected'] != p:
                    fill(px, py, 1, 1, 10)
                    fill(px+5, py+5, 1, 1, 10)
    if s['selected'] is not None and highlights:
        cx, cy = center(l, s['selected'])
        box(cx-3, cy-3, 7, 7, 0)
    if o.get('piece'):
        piece = o['piece']
        disc(piece['x'], piece['y'], piece['value'])
    if 'portalGlow' in o:
        for p in (o['portalGlow'], c['portals'][o['portalGlow']]):
            cx, cy = center(l, p)
            box(cx-3, cy-3, 7, 7, 6)
    if 'effectGlow' in o:
        cx, cy = center(l, o['effectGlow'])
        box(cx-3, cy-3, 7, 7, 11 if o.get('effectInk') is None else o['effectInk'])
    box(2, 0, 20, 5, 2)
    ink = PIECE_COLOR[l['goal']['color']] if l['goal']['color'] else 0
    if l['goal']['mode'] == 'color':
        fill(3, 1, 18, 3, ink)
    else:
        fill(4, 1, 1, 3, ink)
    live = [v for v in s['board'] if v]
    for i, v in enumerate(live):
        fill(25+i*2, 1, 1, 3, PIECE_COLOR[color(v)])
    for i in range(6):
        fill(2+i*6, 63, 5, 1, 14 if i < len(completed) and completed[i] else 4)
    if 'border' in o:
        box(0, 5, 64, 58, o['border'])
    return f


@dataclass(frozen=True)
class CheckersSolitaireInfo:
    game_id: str = GAME_ID
    title: str = 'Dames'
    family: str = FAMILY
    levels: int = LEVEL_COUNT
    default_fps: int = FPS


class CheckersSolitaireEngine:
    """Synchronous custom-backend adapter; not an official SDK registration.

    Copy only this module to use the six built-in levels. Pass levels or
    levels_dir to replace them explicitly. No file is read on import.
    """

    _SNAPSHOT_KEYS = ('completed', 'total_actions', 'step_index', 'restarts',
                      'test_mode', 'last_event', 'index', 'local', 'state')

    def __init__(self, info: Any = None, *, levels: list[Level] | None = None,
                 levels_dir: str | Path | None = None, animate: bool = True):
        if levels is not None and levels_dir is not None:
            raise ValueError('Utiliser levels OU levels_dir, pas les deux.')
        bank = load_levels(levels_dir) if levels_dir is not None else (LEVELS if levels is None else levels)
        demand(isinstance(bank, list) and 1 <= len(bank) <= 6, 'Un à six niveaux requis.')
        self.levels = [validate_level(l) for l in bank]
        self.maps = [compile_level(l) for l in self.levels]
        self.info = info if info is not None else CheckersSolitaireInfo(levels=len(self.levels))
        self.animate = bool(animate)
        self.reset()

    def setup(self, index: int) -> None:
        self.index = index
        self.local = initial(self.levels[index])
        self.state = 'NOT_FINISHED'

    def observe(self) -> dict:
        f = render(self.levels[self.index], self.local, self.completed, {}, self.maps[self.index])
        ids = [6, 7] if self.state == 'NOT_FINISHED' else [7]
        return {'game_id': getattr(self.info, 'game_id', GAME_ID),
                'title': getattr(self.info, 'title', 'Dames'),
                'custom_family': FAMILY, 'wave': WAVE, 'revision': REVISION,
                'state': self.state, 'level': self.index+1,
                'levels_completed': sum(self.completed), 'win_levels': len(self.levels),
                'score': sum(self.completed), 'frame': f, 'frames': [f], 'frame_count': 1,
                'frame_durations_ms': [0], 'palette': PALETTE[:], 'default_fps': FPS,
                'available_action_ids': ids, 'available_actions': ['ACTION'+str(i) for i in ids],
                'total_actions': self.total_actions, 'step_index': self.step_index,
                'level_actions': self.local['moves'],
                'remaining_pieces': sum(bool(v) for v in self.local['board']),
                'restarts': self.restarts, 'test_mode': self.test_mode, 'last_event': self.last_event}

    public_state = observe

    def packet(self, event: str, frames: list[Frame] | None = None,
               durations: list[int] | None = None, extra: dict | None = None) -> dict:
        self.last_event = event
        out = self.observe()
        out['event'] = event
        if extra:
            out.update(extra)
        if frames:
            out.update(frame=frames[-1], frames=frames, frame_count=len(frames),
                       frame_durations_ms=durations)
        return out

    def reset(self) -> dict:
        self.completed = [False] * 6
        self.total_actions = self.step_index = self.restarts = 0
        self.test_mode = False
        self.last_event = 'reset'
        self.setup(0)
        return self.packet('reset')

    def level_reset(self) -> dict:
        self.restarts += 1
        self.completed[self.index] = False
        self.setup(self.index)
        return self.packet('reset_level')

    def jump_to_level(self, number: int) -> dict:
        demand(integer(number) and 1 <= number <= len(self.levels), 'Niveau invalide.')
        self.reset()
        self.test_mode = True
        self.setup(int(number)-1)
        return self.packet('preview')

    def snapshot(self) -> dict:
        """Creator/viewer helper. Not a game action or a public observation."""
        return {key: deepcopy(getattr(self, key)) for key in self._SNAPSHOT_KEYS}

    def restore(self, snapshot: dict) -> None:
        for key in self._SNAPSHOT_KEYS:
            setattr(self, key, deepcopy(snapshot[key]))

    def action(self, action_id: Any, data: dict | None = None) -> dict:
        if isinstance(action_id, dict):
            envelope = action_id
            data = envelope.get('data')
            action_id = next((envelope[k] for k in ('id', 'action_ref', 'action')
                              if envelope.get(k) is not None), None)
        action_id = getattr(action_id, 'value', action_id)
        if action_id == 'RESET' or (integer(action_id) and action_id == 0):
            return self.reset()
        if isinstance(action_id, str) and action_id in ('ACTION6', 'ACTION7'):
            action_id = int(action_id[-1])
        if integer(action_id) and action_id == 7:
            return self.level_reset()
        if not integer(action_id) or action_id != 6 or self.state != 'NOT_FINISHED':
            return self.packet('ignored')
        if (not isinstance(data, dict) or not all(integer(data.get(k))
                and 0 <= data[k] < 64 for k in ('x', 'y'))):
            return self.packet('ignored')
        l, c = self.levels[self.index], self.maps[self.index]
        t = cell_at(l, int(data['x']), int(data['y']))
        if t is None or t not in c['floor']:
            return self.packet('ignored')
        self.total_actions += 1
        self.step_index += 1
        if self.local['board'][t]:
            self.local['selected'] = None if t == self.local['selected'] else t
            return self.packet('deselect' if self.local['selected'] is None else 'select',
                               extra={'cost': 0})
        if self.local['selected'] is None:
            return self.packet('ignored', extra={'cost': 0})
        before = deepcopy(self.local)
        r = transition(l, before, before['selected'], t, c)
        if r['event'] == 'invalid':
            return self.packet('invalid', extra={'cost': 0})
        self.local = r['state']
        frames: list[Frame] = []
        durations: list[int] = []

        def append_frame(state: State, options: dict, duration: int) -> None:
            frames.append(render(l, state, self.completed, options, c))
            durations.append(duration)

        if self.animate:
            sx, sy = center(l, r['move']['source'])
            tx, ty = center(l, r['move']['landing'])
            for i in range(1, 7):
                options = {'hide': r['move']['source'], 'highlights': False,
                           'piece': {'x': math.floor(sx+(tx-sx)*i/6+0.5),
                                     'y': math.floor(sy+(ty-sy)*i/6+0.5),
                                     'value': before['board'][r['move']['source']]}}
                if i >= 4:
                    options['hideVictim'] = r['move']['victim']
                append_frame(before, options, 35)
            if 'portal' in r['effects']:
                append_frame(self.local, {'hide': r['move']['arrival'],
                             'portalGlow': r['move']['landing'], 'highlights': False}, 80)
                append_frame(self.local, {'portalGlow': r['move']['landing'], 'highlights': False}, 80)
            if 'dye' in r['effects']:
                append_frame(self.local, {'effectGlow': r['move']['arrival'],
                             'effectInk': PIECE_COLOR[color(self.local['board'][r['move']['arrival']])],
                             'highlights': False}, 120)
            append_frame(self.local, {}, 70)
        win, fail = r['event'] == 'success', r['event'] == 'stranded'
        event = r['event']
        extra = {'cost': 1, 'played_level': self.index+1, 'captures': self.local['moves'],
                 'effects': r['effects'], 'move': r['move'], 'auto_reset': fail}
        if win or fail:
            if self.animate:
                if fail:
                    append_frame(self.local, {'highlights': False}, 350)
                for _ in range(3):
                    append_frame(self.local, {'border': 14 if win else 8, 'highlights': False}, 170)
                    append_frame(self.local, {'highlights': False}, 110)
            if fail:
                self.restarts += 1
                self.setup(self.index)
            else:
                self.completed[self.index] = True
                if self.test_mode:
                    self.state = 'LEVEL_COMPLETE'
                elif self.index+1 == len(self.levels):
                    self.state = 'WIN'
                else:
                    self.setup(self.index+1)
                event = 'win' if self.state == 'WIN' else 'success'
        frames.append(self.observe()['frame'])
        durations.append(0)
        return self.packet(event, frames, durations, extra)

    step = action
    levelReset = level_reset
    jumpToLevel = jump_to_level


# Aliases support the naming used in the web reference and other custom ports.
DamesEngine = Engine = CheckersSolitaireEngine
compile = compile_level
validateLevel = validate_level
cellAt = cell_at

if __name__ == '__main__':
    print(json.dumps(CheckersSolitaireEngine().observe(), ensure_ascii=False))
