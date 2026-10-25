"""ISO SKETCH — faithful Python port of the approved web v11.

The same shared-vertex mesh determines the board, depth buffer, visible edges,
hit testing and half-size borderless legend. No sprite spacing or antialiasing.
Only the standard library is required. The ARC3 custom-backend adapter is below;
all geometry and single-level functions can also be used without that adapter.
"""
from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Mapping

FRAME, BG, WIRE, RED, BLUE, GREEN = 64, 5, 3, 8, 9, 14
PALETTE = [
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#921231', '#4FCC30', '#A356D6',
]
HALF_X, STEP_Y, BOARD_W, BOARD_H = 6, 3, 13, 13
GRID_PITCH, GRID_ROW_STEP = 2 * HALF_X, 3 * STEP_Y
ORIGIN = {'x': 4, 'y': 2}
AXES = {'B': [0, 0, 1], 'R': [1, 0, 0], 'G': [0, 1, 0]}
FACE_SHIFT = {'B': [0, -6], 'R': [-6, 3], 'G': [6, 3]}
TOOL_BUTTONS = [
    {'mode': 'create', 'x': 2, 'y': 45, 'w': 17, 'h': 15},
    {'mode': 'erase', 'x': 21, 'y': 45, 'w': 17, 'h': 15},
]
FACE_VERTICES = {
    'B': [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]],
    'R': [[1, 0, 1], [1, 1, 1], [1, 1, 0], [1, 0, 0]],
    'G': [[0, 1, 1], [0, 1, 0], [1, 1, 0], [1, 1, 1]],
}
FACE_COLORS = {'B': BLUE, 'R': RED, 'G': GREEN}
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'iso_sketch' / 'levels'
EPS = 1e-9
FLASH_COLORS = [GREEN, WIRE, GREEN, WIRE, GREEN, WIRE, GREEN]
FLASH_INTERVAL_MS = 145
Voxel = dict[str, int]
Level = dict[str, Any]
State = dict[str, Any]
Frame = list[list[int]]


def _int(value: Any) -> bool:
    """JavaScript Number.isSafeInteger semantics, excluding Python booleans."""
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return abs(value) <= 9007199254740991
    return (isinstance(value, float) and math.isfinite(value)
            and value.is_integer() and abs(value) <= 9007199254740991)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def make_frame() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def project(p: Mapping[str, int]) -> dict[str, int]:
    return {'x': ORIGIN['x'] + HALF_X * (p['v'] - p['u']),
            'y': ORIGIN['y'] + STEP_Y * (p['u'] + p['v'] - 2 * p['z'])}


def voxel(u: int, v: int, z: int) -> Voxel:
    _require(all(_int(a) for a in (u, v, z)), 'Coordonnées entières requises.')
    p = {'u': int(u), 'v': int(v), 'z': int(z)}
    return {**p, **project(p)}


def voxel_key(p: Mapping[str, int]) -> str:
    return f"{int(p['u'])},{int(p['v'])},{int(p['z'])}"


def is_voxel(p: Any) -> bool:
    return (isinstance(p, Mapping) and all(_int(p.get(k)) for k in ('u', 'v', 'z'))
            and p['z'] >= 0)


def in_board(p: Any) -> bool:
    return (isinstance(p, Mapping) and _int(p.get('x')) and _int(p.get('y'))
            and p['x'] >= 1 and p['y'] >= 1
            and p['x'] + BOARD_W <= 63 and p['y'] + BOARD_H <= 43)


def aligned(p: Any) -> bool:
    return is_voxel(p) and p.get('x') == project(p)['x'] and p.get('y') == project(p)['y']


def base_cells() -> list[Voxel]:
    out = []
    for row in range(4):
        for col in range(4):
            s, d = 3 * row, 2 * col + row % 2
            p = {**voxel((s - d) // 2, (s + d) // 2, 0), 'row': row, 'col': col}
            if in_board(p):
                out.append(p)
    return out


BASE = base_cells()


def depth(p: Mapping[str, int]) -> int:
    return p['u'] + p['v'] + p['z']


def ordered(cubes: list[Voxel]) -> list[dict[str, Any]]:
    return sorted(({'cube': p, 'index': i} for i, p in enumerate(cubes)),
                  key=lambda item: (depth(item['cube']), item['cube']['z'],
                                    item['cube']['v'], item['cube']['u']))


def projected_vertex(p: Voxel, scale: float = 1,
                     tx: float = ORIGIN['x'] + HALF_X,
                     ty: float = ORIGIN['y'] + 2 * STEP_Y) -> dict[str, Any]:
    return {'x': tx + scale * HALF_X * (p['v'] - p['u']),
            'y': ty + scale * STEP_Y * (p['u'] + p['v'] - 2 * p['z']),
            'd': depth(p), 'world': p}


def mesh(cubes: list[Voxel], *, scale: float = 1,
         tx: float = ORIGIN['x'] + HALF_X,
         ty: float = ORIGIN['y'] + 2 * STEP_Y,
         kind: str = 'cube', cull: bool = True) -> list[dict[str, Any]]:
    """Project exposed faces. Adjacent cubes reference identical world vertices."""
    occupied = {voxel_key(p) for p in cubes}
    faces = []
    for item in ordered(cubes):
        cube, index = item['cube'], item['index']
        for face in ('G', 'R', 'B'):
            a = AXES[face]
            neighbor = {'u': cube['u'] + a[0], 'v': cube['v'] + a[1], 'z': cube['z'] + a[2]}
            if cull and voxel_key(neighbor) in occupied:
                continue
            vertices = [projected_vertex({'u': cube['u'] + o[0], 'v': cube['v'] + o[1],
                                          'z': cube['z'] + o[2]}, scale, tx, ty)
                        for o in FACE_VERTICES[face]]
            p, q, r = vertices[:3]
            det = (q['x'] - p['x']) * (r['y'] - p['y']) - (r['x'] - p['x']) * (q['y'] - p['y'])
            A = ((q['d'] - p['d']) * (r['y'] - p['y']) - (r['d'] - p['d']) * (q['y'] - p['y'])) / det
            B = ((q['x'] - p['x']) * (r['d'] - p['d']) - (r['x'] - p['x']) * (q['d'] - p['d'])) / det
            faces.append({'id': f'{kind}:{voxel_key(cube)}:{face}',
                          'owner': {'kind': kind, 'index': index, 'face': face},
                          'face': face, 'vertices': vertices,
                          'plane': {'A': A, 'B': B, 'C': p['d'] - A * p['x'] - B * p['y']}})
    return faces


def inside(x: float, y: float, points: list[dict[str, Any]]) -> bool:
    positive = negative = False
    for i, a in enumerate(points):
        b = points[(i + 1) % len(points)]
        c = (b['x'] - a['x']) * (y - a['y']) - (b['y'] - a['y']) * (x - a['x'])
        positive = positive or c > EPS
        negative = negative or c < -EPS
        if positive and negative:
            return False
    return True


def line_pixels(a: Mapping[str, Any], b: Mapping[str, Any]) -> list[dict[str, int]]:
    """Canonical Bresenham path: reversing an edge cannot move any pixel."""
    p, q = (a['x'], a['y']), (b['x'], b['y'])
    if p > q:
        p, q = q, p
    _require(all(_int(v) for v in (*p, *q)), 'Les sommets du contour doivent être entiers.')
    x, y, qx, qy = map(int, (*p, *q))
    dx, dy = abs(qx - x), -abs(qy - y)
    sx, sy = (1 if x < qx else -1), (1 if y < qy else -1)
    err, out = dx + dy, []
    while True:
        out.append({'x': x, 'y': y})
        if x == qx and y == qy:
            break
        e = 2 * err
        if e >= dy:
            err += dy
            x += sx
        if e <= dx:
            err += dx
            y += sy
    return out


def edge_records(faces: list[dict[str, Any]]) -> list[dict[str, Any]]:
    edges: dict[str, Any] = {}
    for f in faces:
        for i in range(4):
            a, b = f['vertices'][i], f['vertices'][(i + 1) % 4]
            key = '|'.join(sorted([voxel_key(a['world']), voxel_key(b['world'])]))
            if key not in edges:
                edges[key] = {'a': a, 'b': b, 'faces': set()}
            edges[key]['faces'].add(f['id'])
    return list(edges.values())


def raster_faces(faces: list[dict[str, Any]], *, width: int = 64, height: int = 64,
                 offset: float = 0, borders: bool = True, wire: bool = False) -> dict[str, Any]:
    """Depth-tested palette raster. No antialiasing, supersampling or image library."""
    frame = [[BG] * width for _ in range(height)]
    hit_map = [[None] * width for _ in range(height)]
    face_map = [[None] * width for _ in range(height)]
    depth_map = [[-math.inf] * width for _ in range(height)]
    opaque = [[False] * width for _ in range(height)]
    for f in faces:
        v, plane = f['vertices'], f['plane']
        x0 = max(0, math.ceil(min(p['x'] for p in v) - offset))
        x1 = min(width - 1, math.floor(max(p['x'] for p in v) - offset))
        y0 = max(0, math.ceil(min(p['y'] for p in v) - offset))
        y1 = min(height - 1, math.floor(max(p['y'] for p in v) - offset))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                sx, sy = x + offset, y + offset
                if not inside(sx, sy, v):
                    continue
                d = plane['A'] * sx + plane['B'] * sy + plane['C']
                if d < depth_map[y][x] - EPS:
                    continue
                if abs(d - depth_map[y][x]) <= EPS and face_map[y][x] and f['id'] < face_map[y][x]:
                    continue
                depth_map[y][x] = d
                face_map[y][x] = f['id']
                frame[y][x] = BG if wire else FACE_COLORS[f['face']]
                opaque[y][x] = True
                hit_map[y][x] = dict(f['owner'])
    edge_mask = [[False] * width for _ in range(height)]
    if borders:
        for e in edge_records(faces):
            a, b = e['a'], e['b']
            dx, dy = b['x'] - a['x'], b['y'] - a['y']
            length2 = dx * dx + dy * dy
            for p in line_pixels(a, b):
                x, y = p['x'], p['y']
                if not (0 <= x < width and 0 <= y < height):
                    continue
                t = max(0, min(1, ((x - a['x']) * dx + (y - a['y']) * dy) / length2))
                d = a['d'] + t * (b['d'] - a['d'])
                if wire or face_map[y][x] in e['faces'] or d >= depth_map[y][x] - EPS:
                    edge_mask[y][x] = True
                    opaque[y][x] = True
        # UNION of visible edge pixels, never a double contour between two cells.
        for y in range(height):
            for x in range(width):
                if edge_mask[y][x]:
                    frame[y][x] = WIRE
                    hit_map[y][x] = None
    return {'frame': frame, 'hitMap': hit_map, 'opaque': opaque,
            'edgeMask': edge_mask, 'faceMap': face_map, 'depthMap': depth_map}


def _coords(cubes: Iterable[Voxel]) -> tuple[tuple[int, int, int], ...]:
    return tuple((p['u'], p['v'], p['z']) for p in cubes)


@lru_cache(maxsize=96)
def _painted(coords: tuple[tuple[int, int, int], ...]) -> dict[str, Any]:
    return raster_faces(mesh([voxel(*p) for p in coords]))


_GRID = raster_faces(mesh(BASE, kind='base', cull=False), wire=True)


def scene(cubes: list[Voxel], grid: bool = True) -> dict[str, Any]:
    painted = _painted(_coords(cubes))
    if not grid:
        return deepcopy(painted)
    frame = [r[:] for r in _GRID['frame']]
    hit_map = [[dict(h) if h else None for h in r] for r in _GRID['hitMap']]
    for y in range(FRAME):
        for x in range(FRAME):
            if painted['opaque'][y][x]:
                frame[y][x] = painted['frame'][y][x]
                h = painted['hitMap'][y][x]
                hit_map[y][x] = dict(h) if h else None
    return {'frame': frame, 'hitMap': hit_map, 'opaque': [r[:] for r in painted['opaque']],
            'edgeMask': [r[:] for r in painted['edgeMask']]}


def crop_visible(frame: Frame) -> Frame:
    x0, y0, x1, y1 = len(frame[0]) if frame else 0, len(frame), -1, -1
    for y, row in enumerate(frame):
        for x, color in enumerate(row):
            if color != BG:
                x0, y0, x1, y1 = min(x0, x), min(y0, y), max(x1, x), max(y1, y)
    return [] if x1 < 0 else [r[x0:x1 + 1] for r in frame[y0:y1 + 1]]


def signature(cubes: list[Voxel]) -> Frame:
    return crop_visible(_painted(_coords(cubes))['frame'])


def matches(level: Level, cubes: list[Voxel]) -> bool:
    return bool(cubes) and signature(cubes) == signature(level['target'])


def create_state() -> State:
    return {'cubes': [], 'moves': 0, 'solved': False, 'lastEvent': 'READY', 'mode': 'create'}


def tool_hit(x: int, y: int) -> dict[str, Any] | None:
    if not _int(x) or not _int(y):
        return None
    for b in TOOL_BUTTONS:
        if b['x'] <= x < b['x'] + b['w'] and b['y'] <= y < b['y'] + b['h']:
            return {'kind': 'tool', 'mode': b['mode']}
    return None


def hit(state: State, x: int, y: int) -> dict[str, Any] | None:
    tool = tool_hit(x, y)
    if tool:
        return tool
    if not _int(x) or not _int(y) or not (1 <= x < 63 and 1 <= y < 43):
        return None
    x, y = int(x), int(y)
    painted = _painted(_coords(state['cubes']))
    h = painted['hitMap'][y][x] if painted['opaque'][y][x] else _GRID['hitMap'][y][x]
    return dict(h) if h else None


def dest(state: State, h: dict[str, Any] | None) -> Voxel | None:
    if not h:
        return None
    if h['kind'] == 'base':
        p = BASE[h['index']]
        return voxel(p['u'], p['v'], p['z'])
    if h['kind'] != 'cube':
        return None
    p, a = state['cubes'][h['index']], AXES[h['face']]
    return voxel(p['u'] + a[0], p['v'] + a[1], p['z'] + a[2])


def transition(level: Level, state: State, a: dict[str, Any] | None) -> State:
    """Immutable single-level rules. Identity is preserved for true no-ops."""
    if not isinstance(a, dict):
        return state
    if a.get('type') == 'reset':
        return create_state()
    h = hit(state, a.get('x'), a.get('y')) if a.get('type') == 'click' else None
    requested = a.get('mode') if a.get('type') == 'tool' else h.get('mode') if h and h['kind'] == 'tool' else None
    if requested:
        if requested not in ('create', 'erase') or state['mode'] == requested:
            return state
        return {**state, 'mode': requested, 'lastEvent': 'TOOL_SELECTED'}
    if state['solved'] or a.get('type') != 'click':
        return state
    if state['mode'] == 'erase':
        if not h or h['kind'] != 'cube':
            return state
        n = {**state, 'cubes': [p for i, p in enumerate(state['cubes']) if i != h['index']],
             'moves': state['moves'] + 1, 'lastEvent': 'ERASED'}
    else:
        p = dest(state, h)
        if not p:
            return state
        if not in_board(p):
            return {**state, 'lastEvent': 'EDGE'}
        if any(voxel_key(c) == voxel_key(p) for c in state['cubes']):
            return {**state, 'lastEvent': 'OCCUPIED'}
        event = 'PLACED' if h['kind'] == 'base' else 'STACKED' if h['face'] == 'B' else 'EXTENDED'
        n = {**state, 'cubes': [*state['cubes'], p], 'moves': state['moves'] + 1, 'lastEvent': event}
    n['solved'] = matches(level, n['cubes'])
    if n['solved']:
        n['lastEvent'] = 'SOLVED'
    return n


def action(level: Level, state: State, aid: int, data: dict[str, Any] | None = None) -> State:
    if not _int(aid):
        return state
    if aid == 7:
        return create_state()
    d = data if isinstance(data, Mapping) else {}
    return transition(level, state, {'type': 'click', 'x': d.get('x'), 'y': d.get('y')}) if aid == 6 else state


def bounds(cubes: list[Voxel]) -> dict[str, int]:
    return {'x0': min(p['x'] for p in cubes), 'y0': min(p['y'] for p in cubes),
            'x1': max(p['x'] + BOARD_W - 1 for p in cubes),
            'y1': max(p['y'] + BOARD_H - 1 for p in cubes)}


def rect(frame: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if (yy in (y, y + h - 1) or xx in (x, x + w - 1)) and 0 <= yy < len(frame) and 0 <= xx < len(frame[yy]):
                frame[yy][xx] = color


@lru_cache(maxsize=96)
def _legend(coords: tuple[tuple[int, int, int], ...]) -> dict[str, Any]:
    cubes = [voxel(*p) for p in coords]
    faces = mesh(cubes, scale=0.5, tx=0, ty=0)
    vertices = [p for f in faces for p in f['vertices']]
    x0, y0 = min(p['x'] for p in vertices), min(p['y'] for p in vertices)
    x1, y1 = max(p['x'] for p in vertices), max(p['y'] for p in vertices)
    w, h = math.ceil(x1 - x0), math.ceil(y1 - y0)
    mini_faces = mesh(cubes, scale=0.5, tx=-x0, ty=-y0)
    r = raster_faces(mini_faces, width=w, height=h, offset=0.5, borders=False)
    return {'w': w, 'h': h, 'frame': r['frame'], 'faces': mini_faces}


def legend_layout(cubes: list[Voxel]) -> dict[str, Any]:
    """Whole exposed mesh at half scale; no independent cube rounding or outlines."""
    return deepcopy(_legend(_coords(cubes)))


_ICON_FACES = mesh([voxel(0, 0, 0)], tx=6, ty=6)
_MINI_CUBE = raster_faces(_ICON_FACES, width=13, height=13)['frame']
_ICON_WIRE = raster_faces(_ICON_FACES, width=13, height=13, wire=True)['frame']


def draw_tools(frame: Frame, mode: str) -> None:
    for b in TOOL_BUTTONS:
        rect(frame, b['x'], b['y'], b['w'], b['h'], 0 if mode == b['mode'] else WIRE)
        im = _MINI_CUBE if b['mode'] == 'create' else _ICON_WIRE
        for y in range(13):
            for x in range(13):
                frame[b['y'] + 1 + y][b['x'] + 2 + x] = im[y][x]


def render(level: Level, state: State, progress: Iterable[int] = (),
           options: dict[str, Any] | None = None) -> Frame:
    options = options or {}
    f = scene(state['cubes'], True)['frame']
    outline = options.get('outline')
    rect(f, 0, 0, 64, 44, outline if outline is not None else GREEN if state['solved'] else WIRE)
    if options.get('legend', True) is not False:
        l = _legend(_coords(level['target']))
        ox, oy = 39 + (23 - l['w']) // 2, 46 + (16 - l['h']) // 2
        for y in range(l['h']):
            for x in range(l['w']):
                f[oy + y][ox + x] = l['frame'][y][x]
    draw_tools(f, state['mode'])
    done = set(progress)
    for i in range(6):
        for y in range(61, 63):
            for x in range(2 + i * 6, 7 + i * 6):
                f[y][x] = GREEN if i in done else WIRE
    return f


def validate_level(raw: Any) -> Level:
    _require(isinstance(raw, dict) and isinstance(raw.get('target'), list)
             and 1 <= len(raw['target']) <= 128, 'Un niveau doit avoir entre un et 128 cubes cibles.')
    target = []
    for p in raw['target']:
        _require(is_voxel(p), 'Coordonnées logiques de cube invalides.')
        c = voxel(p['u'], p['v'], p['z'])
        _require(in_board(c), 'Cube cible hors du terrain.')
        if 'x' in p or 'y' in p:
            _require(aligned(p), 'Coordonnées visuelles et logiques incompatibles.')
        target.append(c)
    _require(len({voxel_key(p) for p in target}) == len(target), 'Deux cubes occupent la même case logique.')
    l = _legend(_coords(target))
    _require(l['w'] <= 23 and l['h'] <= 16, 'Le dessin dépasse la zone de légende.')
    return {'version': 11, 'id': str(raw.get('id', 'custom')), 'title': str(raw.get('title', 'Construction')),
            'description': str(raw.get('description', '')), 'target': target}


def validate_pack(raw: Any) -> list[Level]:
    a = raw if isinstance(raw, list) else raw.get('levels') if isinstance(raw, dict) and 'levels' in raw else [raw]
    _require(isinstance(a, list) and 1 <= len(a) <= 6, 'Charger entre un et six niveaux.')
    return [validate_level(l) for l in a]


def load_levels(path: str | Path | None = None) -> list[Level]:
    p = Path(path) if path is not None else LEVELS_DIR
    if p.is_dir():
        paths = sorted(p.glob('L*.json'))
        if not paths:
            raise FileNotFoundError(f'Aucun niveau L*.json dans {p}')
        return validate_pack([json.loads(f.read_text(encoding='utf-8')) for f in paths])
    _require(p.stat().st_size <= 1_500_000, 'Fichier JSON trop volumineux (1,5 Mo maximum).')
    return validate_pack(json.loads(p.read_text(encoding='utf-8')))


def find_click(state: State, target: Voxel, requirement: dict[str, Any] | None = None) -> dict[str, Any] | None:
    m = scene(state['cubes'], True)['hitMap']
    best, best_score = None, -1
    for y in range(1, 43):
        for x in range(1, 63):
            h = m[y][x]
            if not h:
                continue
            if requirement and (h['kind'] != requirement['kind'] or h['index'] != requirement['index']
                                or (requirement.get('face') and h.get('face') != requirement['face'])):
                continue
            p = dest(state, h)
            if not p or voxel_key(p) != voxel_key(target):
                continue
            score = sum(m[y + dy][x + dx] == h for dy in (-1, 0, 1) for dx in (-1, 0, 1))
            if score > best_score:
                best_score, best = score, {'x': x, 'y': y, 'hit': dict(h)}
    return best


def solution_from_start(level: Level) -> list[dict[str, int]]:
    """Replay the authored target order via actual visible faces, not state injection.

    The supplied v11 levels support this order. A custom target can be valid as
    an image without supplying a reachable build order; such a case raises an
    explicit error rather than claiming the puzzle is impossible.
    """
    s, clicks = create_state(), []
    for p in level['target']:
        if s['solved']:
            break
        h = find_click(s, p)
        if not h:
            raise ValueError('Pas de démonstration dans cet ordre pour ce niveau personnalisé.')
        n = action(level, s, 6, h)
        if n['moves'] != s['moves'] + 1:
            raise ValueError('La démonstration ne peut pas construire ce cube par une face visible.')
        s = n
        clicks.append({'x': h['x'], 'y': h['y']})
    _require(s['solved'], 'Cette démonstration ne termine pas la cible.')
    return clicks


@dataclass(frozen=True)
class GameInfo:
    """Standalone default; your registry's existing info object also works."""
    game_id: str = 'iso_sketch'
    title: str = 'ISO SKETCH'
    family: str = 'iso_sketch'
    levels: int = 6
    default_fps: int = 8


class IsoSketchEngine:
    """Custom backend: reset(), level_reset(), action(6/7, data), public_state().

    Campaign levels advance automatically. ACTION6 is the only game input;
    switching create/erase is itself a click on an in-frame tool button.
    There is no action budget in the approved v11. `level_steps` counts submitted
    ACTION6 calls, including tool clicks and misses; `moves` counts actual edits.
    """
    def __init__(self, info: Any = None, *, animate: bool = True,
                 levels: list[Level] | None = None, levels_dir: str | Path | None = None) -> None:
        _require(not (levels is not None and levels_dir is not None), 'Choisir levels ou levels_dir, pas les deux.')
        self.levels = validate_pack(levels) if levels is not None else load_levels(levels_dir)
        self.info = info if info is not None else GameInfo(levels=len(self.levels))
        n = getattr(self.info, 'levels', len(self.levels))
        _require(_int(n) and 1 <= n <= len(self.levels), 'Nombre de niveaux demandé indisponible.')
        self.win_levels = int(n)
        self.animate = bool(animate)
        self.source_path = str(levels_dir or LEVELS_DIR) if levels is None else '<provided levels>'
        self.level_index = 0
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.level_state = create_state()
        self.state = 'NOT_FINISHED'
        self.last_action = 'RESET'
        self.last_event = 'READY'

    def reset(self) -> dict[str, Any]:
        self.level_index = self.levels_completed = self.step_index = self.level_steps = 0
        self.level_state = create_state()
        self.state, self.last_action, self.last_event = 'NOT_FINISHED', 'RESET', 'READY'
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        # A reset after WIN reopens the final level and unlights only its bar.
        self.levels_completed = self.level_index
        self.level_steps = 0
        self.level_state = create_state()
        self.state, self.last_action, self.last_event = 'NOT_FINISHED', 'ACTION7', 'LEVEL_RESET'
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if not _int(action_id):
            return self.public_state()
        if action_id == 7:
            return self.level_reset()
        if action_id != 6 or self.state == 'WIN':
            return self.public_state()
        self.last_action = 'ACTION6'
        self.step_index += 1
        self.level_steps += 1
        before = self.level_state
        self.level_state = action(self.levels[self.level_index], before, 6, data)
        self.last_event = self.level_state['lastEvent']
        if self.level_state['solved'] and not before['solved']:
            return self._complete_level()
        return self.public_state()

    def _complete_level(self) -> dict[str, Any]:
        finished_index = self.level_index
        finished_level = self.levels[finished_index]
        finished = deepcopy(self.level_state)
        previous_steps = self.level_steps
        self.levels_completed = finished_index + 1
        frames = []
        if self.animate:
            frames = [render(finished_level, finished, range(self.levels_completed), {'outline': c})
                      for c in FLASH_COLORS]
        if self.levels_completed == self.win_levels:
            self.state, self.last_event = 'WIN', 'GAME_WON'
        else:
            self.level_index += 1
            self.level_state, self.level_steps = create_state(), 0
            self.last_event = 'LEVEL_COMPLETE'
        result = self.public_state()
        result['completed_level'] = finished_index + 1
        result['completed_level_steps'] = previous_steps
        result['completed_level_moves'] = finished['moves']
        if self.animate:
            result['frames'] = frames + [result['frame']]
            result['frame_count'] = len(result['frames'])
            result['frame_durations_ms'] = [FLASH_INTERVAL_MS] * len(result['frames'])
            result['transition_frame_interval_ms'] = FLASH_INTERVAL_MS
        return result

    def public_state(self) -> dict[str, Any]:
        l = self.levels[self.level_index]
        frame = render(l, self.level_state, range(self.levels_completed))
        ids = [7] if self.state == 'WIN' else [6, 7]
        return {
            'backend': 'custom', 'selected': True,
            'game_id': getattr(self.info, 'game_id', 'iso_sketch'),
            'title': getattr(self.info, 'title', 'ISO SKETCH'),
            'frame': frame, 'frames': [frame], 'frame_count': 1,
            'frame_durations_ms': [FLASH_INTERVAL_MS],
            'default_fps': getattr(self.info, 'default_fps', 8),
            'state': self.state, 'level': self.level_index + 1,
            'levels_completed': self.levels_completed, 'win_levels': self.win_levels,
            'step_index': self.step_index, 'available_actions': [f'ACTION{i}' for i in ids],
            'available_action_ids': ids, 'last_action': self.last_action,
            'score': self.levels_completed, 'full_reset': False, 'source_path': self.source_path,
            'custom_family': getattr(self.info, 'family', 'iso_sketch'),
            'level_name': l['title'], 'level_steps': self.level_steps,
            'moves': self.level_state['moves'], 'cube_count': len(self.level_state['cubes']),
            'mode': self.level_state['mode'], 'last_event': self.last_event,
            'palette': list(PALETTE),
        }


# Alias for registries which capitalize ISO as an acronym.
ISOSketchEngine = IsoSketchEngine
