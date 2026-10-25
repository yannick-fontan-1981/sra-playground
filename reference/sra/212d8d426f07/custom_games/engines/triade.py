"""TRIADE — Python port of the approved web v3 (cell units, fixed grey guides).

Runtime: Python 3.10+, standard library only. No Tk/JS/NumPy dependency here.
Core state keys deliberately retain the web spelling for replay interoperability.
The single-level core is pure; TriadeEngine is the multi-level custom ARC3 adapter.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from itertools import permutations, product
from pathlib import Path
from typing import Any, Callable, Mapping
import json
import math
import re

FRAME = 64
WEIGHTS = (1, 3, 9)
MULTIPLIERS = {9: 1, 15: 2, 8: 3}
COLORS = (9, 15, 8)
PALETTE = (
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#921231', '#4FCC30', '#A356D6',
)
NAMES = {9: 'bleu', 15: 'violet', 8: 'rouge'}
PAD_X, PAD_Y, PAD_SIZE = (2, 16, 30), 48, 11
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'triade' / 'levels'
ACTION_UP, ACTION_DOWN, ACTION_LEFT, ACTION_RIGHT = 1, 2, 3, 4
ACTION_CYCLE, ACTION_CLICK, ACTION_RESET = 5, 6, 7
Level = dict[str, Any]
State = dict[str, Any]
Frame = list[list[int]]
Cancel = Callable[[], bool] | None


class SearchCancelled(RuntimeError):
    """Cooperative cancellation requested by a local UI (never changes game state)."""


def _cancelled(cancel: Cancel) -> None:
    if cancel is not None and cancel():
        raise SearchCancelled('Recherche annulée.')


def _require(condition: Any, message: str) -> None:
    if not condition:
        raise ValueError(message)


def _integer(value: Any) -> bool:
    # JSON numbers such as 1.0 are integers in JavaScript; booleans are not.
    return (type(value) in (int, float) and abs(value) <= 9007199254740991
            and math.isfinite(value) and int(value) == value)


def _vector(value: Any) -> bool:
    return (isinstance(value, (list, tuple)) and len(value) == 2
            and all(_integer(v) and abs(v) <= 1 for v in value))


def trim(image: Frame) -> Frame:
    occupied = [(x, y) for y, row in enumerate(image)
                for x, color in enumerate(row) if color != 5]
    if not occupied:
        return []
    x0, x1 = min(x for x, _ in occupied), max(x for x, _ in occupied)
    y0, y1 = min(y for _, y in occupied), max(y for _, y in occupied)
    return [row[x0:x1 + 1] for row in image[y0:y1 + 1]]


def has_legend_contact(image: Frame) -> bool:
    cells = {(x, y) for y, row in enumerate(image)
             for x, color in enumerate(row) if color in COLORS}
    return any((x + dx, y + dy) in cells for x, y in cells
               for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)


def validate_level(raw: Any) -> Level:
    """Validate web v2 cell-schema JSON. Web v3 retained schema version 2."""
    _require(isinstance(raw, dict), 'Un niveau doit être un objet JSON.')
    _require(raw.get('version') != 1 and raw.get('units') in (None, '', 'cells'),
             'Ancien format en pixels (v1) : utiliser des coordonnées en cellules.')
    width, height, size = (raw.get(k, d) for k, d in
                           (('width', 19), ('height', 14), ('size', 3)))
    _require(_integer(width) and 2 <= width <= 30, 'Largeur : 2 à 30 cellules.')
    _require(_integer(height) and 2 <= height <= 21, 'Hauteur : 2 à 21 cellules.')
    _require(_integer(size) and 2 <= size <= 5, 'Affichage : 2 à 5 pixels par cellule.')
    width, height, size = int(width), int(height), int(size)
    _require(width * size <= 60 and height * size <= 43,
             'Le terrain doit tenir dans 60 × 43 pixels.')
    image = raw.get('legend')
    _require(isinstance(image, list) and 1 <= len(image) <= 10,
             'Légende : 1 à 10 lignes.')
    _require(isinstance(image[0], list) and 1 <= len(image[0]) <= 18,
             'Légende : 1 à 18 colonnes.')
    lw = len(image[0])
    _require(all(isinstance(row, list) and len(row) == lw and
                 all(_integer(c) and c in (5, *COLORS) for c in row) for row in image),
             'Légende rectangulaire : noir, bleu, violet ou rouge uniquement.')
    legend = trim([[int(c) for c in row] for row in image])
    _require(legend, 'La légende doit contenir des cubes.')
    _require(len(legend) <= height and len(legend[0]) <= width,
             'La légende ne rentre pas dans la grille.')
    _require(has_legend_contact(legend),
             'Au moins deux cellules colorées doivent se toucher par un côté ou un coin.')
    inputs = raw.get('pieces')
    _require(isinstance(inputs, list) and 2 <= len(inputs) <= 12,
             'Utiliser entre 2 et 12 cubes.')
    ids: set[str] = set()
    pieces = []
    for i, p in enumerate(inputs):
        _require(isinstance(p, dict), f'Cube {i + 1} invalide.')
        pid = p.get('id', f'C{i + 1}')
        _require(isinstance(pid, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,24}', pid)
                 and pid not in ids, 'Identifiants de cubes invalides ou dupliqués.')
        ids.add(pid)
        color, x, y = p.get('color'), p.get('x'), p.get('y')
        _require(_integer(color) and color in COLORS, f'{pid} : couleur invalide.')
        _require(_integer(x) and _integer(y) and 0 <= x < width and 0 <= y < height,
                 f'{pid} : position hors terrain.')
        enabled = p.get('enabled', [True, True, True])
        sticks = p.get('sticks', [[0, 0], [0, 0], [0, 0]])
        _require(isinstance(enabled, list) and len(enabled) == 3 and
                 all(type(v) is bool for v in enabled) and any(enabled),
                 f'{pid} : trois booléens et au moins un joystick disponible.')
        _require(isinstance(sticks, list) and len(sticks) == 3 and all(map(_vector, sticks)),
                 f'{pid} : trois positions [x,y] entre −1 et +1 attendues.')
        _require(all(on or list(v) == [0, 0] for on, v in zip(enabled, sticks)),
                 f'{pid} : un joystick absent doit être au centre.')
        pieces.append(dict(id=pid, color=int(color), x=int(x), y=int(y),
                           enabled=enabled[:], sticks=[[int(v) for v in a] for a in sticks]))
    counts = Counter(p['color'] for p in pieces)
    need = Counter(c for row in legend for c in row if c != 5)
    _require(counts == need, 'La légende et le terrain doivent contenir les mêmes cubes de chaque couleur.')
    return dict(version=2, units='cells', id=str(raw.get('id', 'custom'))[:40],
                title=str(raw.get('title', 'Nouvelle étude'))[:80],
                description=str(raw.get('description', 'Reproduire la légende.'))[:400],
                width=width, height=height, size=size, legend=legend, pieces=pieces)


def validate_pack(raw: Any) -> list[Level]:
    values = raw if isinstance(raw, list) else raw.get('levels', [raw]) if isinstance(raw, dict) else [raw]
    _require(isinstance(values, list) and 1 <= len(values) <= 30, 'Importer 1 à 30 niveaux.')
    return [validate_level(v) for v in values]


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    """Read a directory of L*.json, a web pack, or a single web level."""
    path = Path(path)
    if path.is_dir():
        files = sorted(path.glob('L*.json'))
        if not files:
            raise FileNotFoundError(f'Aucun niveau L*.json dans {path}')
        return validate_pack([json.loads(p.read_text(encoding='utf-8-sig')) for p in files])
    if path.stat().st_size > 1_500_000:
        raise ValueError('JSON trop volumineux : maximum 1,5 Mo.')
    return validate_pack(json.loads(path.read_text(encoding='utf-8-sig')))


def geometry(level: Level) -> dict[str, int]:
    width, height = level['width'] * level['size'], level['height'] * level['size']
    return dict(x=(64 - width) // 2, y=1, width=width, height=height,
                columns=level['width'], rows=level['height'], cellSize=level['size'])


def hit_cell(level: Level, x: Any, y: Any) -> dict[str, int] | None:
    if type(x) not in (int, float) or type(y) not in (int, float):
        return None
    if not math.isfinite(x) or not math.isfinite(y):
        return None
    g = geometry(level)
    xx, yy = x - g['x'], y - g['y']
    if not (0 <= xx < g['width'] and 0 <= yy < g['height']):
        return None
    return dict(x=int(xx // level['size']), y=int(yy // level['size']))


def cell_center(level: Level, x: int, y: int) -> dict[str, int]:
    g, size = geometry(level), level['size']
    return dict(x=g['x'] + x * size + size // 2, y=g['y'] + y * size + size // 2)


def pad_center(pad: int, x: int, y: int) -> dict[str, int]:
    _require(_integer(pad) and 0 <= pad < 3 and _vector([x, y]), 'Position de joystick invalide.')
    return dict(x=PAD_X[int(pad)] + (x + 1) * 4 + 1, y=PAD_Y + (y + 1) * 4 + 1)


def position(level: Level, state: State, i: int) -> dict[str, int]:
    p = level['pieces'][i]
    m, x, y = MULTIPLIERS[p['color']], p['x'], p['y']
    for j, weight in enumerate(WEIGHTS):
        x += m * weight * (state['sticks'][i][j][0] - p['sticks'][j][0])
        y += m * weight * (state['sticks'][i][j][1] - p['sticks'][j][1])
    return dict(x=x % level['width'], y=y % level['height'])


def positions(level: Level, state: State) -> list[dict[str, Any]]:
    return [dict(**position(level, state, i), id=p['id'], color=p['color'])
            for i, p in enumerate(level['pieces'])]


def goals(level: Level, ox: int, oy: int) -> list[dict[str, int]]:
    return [dict(x=ox + x, y=oy + y, color=c) for y, row in enumerate(level['legend'])
            for x, c in enumerate(row) if c != 5]


def match(level: Level, state: State) -> dict[str, Any]:
    ps = positions(level, state)
    x, y = min(p['x'] for p in ps), min(p['y'] for p in ps)
    if x + len(level['legend'][0]) > level['width'] or y + len(level['legend']) > level['height']:
        return dict(solved=False)
    cells = {(p['x'], p['y']): p['color'] for p in goals(level, x, y)}
    if len(cells) != len(ps):
        return dict(solved=False)
    for p in ps:
        if cells.pop((p['x'], p['y']), None) != p['color']:
            return dict(solved=False)
    return dict(solved=False) if cells else dict(solved=True, x=x, y=y)


def create_state(level: Level) -> State:
    state = dict(sticks=[deepcopy(p['sticks']) for p in level['pieces']], selected=None,
                 active=0, order=list(range(len(level['pieces']))), moves=0, wraps=0,
                 solved=False, lastEvent='READY', lastMotion=None)
    state['solved'] = match(level, state)['solved']
    return state


def copy_state(state: State) -> State:
    return deepcopy(state)


def overlaps(level: Level, state: State) -> list[str]:
    occ: dict[tuple[int, int], list[int]] = {}
    pairs = []
    for i in range(len(level['pieces'])):
        p = position(level, state, i)
        others = occ.setdefault((p['x'], p['y']), [])
        pairs.extend(f'{j}:{i}' for j in others)
        others.append(i)
    return pairs


def _selected_index(level: Level, state: State) -> int:
    return next((i for i, p in enumerate(level['pieces']) if p['id'] == state['selected']), -1)


def select(level: Level, state: State, pid: str) -> State:
    i = next((i for i, p in enumerate(level['pieces']) if p['id'] == pid), -1)
    if i < 0 or state['solved']:
        return state
    enabled = level['pieces'][i]['enabled']
    return dict(state, selected=pid,
                active=state['active'] if enabled[state['active']] else enabled.index(True),
                lastEvent='SELECTED', lastMotion=None)


def transition(level: Level, state: State, command: Any) -> State:
    """Apply one semantic command, without mutating the source level or state."""
    if not isinstance(command, dict):
        return state
    kind = command.get('type')
    if kind == 'reset':
        return create_state(level)
    if state['solved']:
        return state
    if kind == 'select':
        return select(level, state, command.get('id'))
    if kind == 'deselect':
        return dict(state, selected=None, lastEvent='DESELECTED', lastMotion=None)
    if kind == 'cycle':
        i = _selected_index(level, state)
        return select(level, state, level['pieces'][(i + 1) % len(level['pieces'])]['id'])
    i = _selected_index(level, state)
    if kind == 'active':
        j = command.get('pad')
        if not _integer(j) or not 0 <= j < 3:
            return state
        j = int(j)
        return dict(state, active=j,
                    lastEvent='ABSENT' if i >= 0 and not level['pieces'][i]['enabled'][j] else 'ACTIVE',
                    lastMotion=None)
    if kind not in ('set', 'nudge'):
        return state
    if i < 0:
        return dict(state, lastEvent='NO_SELECTION', lastMotion=None)
    j = command.get('pad', state['active'])
    if j is None:
        j = state['active']
    if not _integer(j) or not 0 <= j < 3:
        return state
    j = int(j)
    if not level['pieces'][i]['enabled'][j]:
        return dict(state, lastEvent='ABSENT', lastMotion=None)
    old = state['sticks'][i][j]
    if kind == 'set':
        v = [command.get('x'), command.get('y')]
    else:
        dx, dy = command.get('dx'), command.get('dy')
        if not _integer(dx) or not _integer(dy):
            return dict(state, lastEvent='PAD_EDGE', lastMotion=None)
        v = [old[0] + dx, old[1] + dy]
    if not _vector(v):
        return dict(state, lastEvent='PAD_EDGE', lastMotion=None)
    v = list(map(int, v))
    if v == old:
        return dict(state, active=j, lastEvent='UNCHANGED', lastMotion=None)
    new = copy_state(state)
    p, step = position(level, state, i), MULTIPLIERS[level['pieces'][i]['color']] * WEIGHTS[j]
    dx, dy = (v[0] - old[0]) * step, (v[1] - old[1]) * step
    new['sticks'][i][j] = v
    new['active'] = j
    new['moves'] += 1
    new['order'] = [k for k in new['order'] if k != i] + [i]
    crossings = abs((p['x'] + dx) // level['width']) + abs((p['y'] + dy) // level['height'])
    new['wraps'] += crossings
    new['lastMotion'] = dict(id=level['pieces'][i]['id'], index=i, pad=j,
                             **{'from': p, 'to': position(level, new, i)},
                             dx=dx, dy=dy, crossings=crossings)
    new['solved'] = match(level, new)['solved']
    new['lastEvent'] = 'SOLVED' if new['solved'] else 'WRAPPED' if crossings else 'MOVED'
    return new


def hit_piece(level: Level, state: State, x: Any, y: Any) -> str | None:
    hit = hit_cell(level, x, y)
    if hit is None:
        return None
    hits = [i for i in reversed(state['order']) if position(level, state, i) == hit]
    if not hits:
        return None
    selected = _selected_index(level, state)
    at = hits.index(selected) if selected in hits else -1
    return level['pieces'][hits[(at + 1) % len(hits)]]['id']


def hit_pad(x: Any, y: Any) -> dict[str, int] | None:
    if not _integer(x) or not _integer(y):
        return None
    for j, left in enumerate(PAD_X):
        xx, yy = int(x) - left, int(y) - PAD_Y
        if 0 <= xx < 11 and 0 <= yy < 11 and xx % 4 < 3 and yy % 4 < 3:
            return dict(pad=j, x=xx // 4 - 1, y=yy // 4 - 1)
    return None


def action(level: Level, state: State, action_id: int, data: Mapping[str, Any] | None = None) -> State:
    """Single-level ARC actions. ACTION6 coordinates are 64×64 FRAME pixels."""
    if not _integer(action_id):
        return state
    aid = int(action_id)
    if aid == 7:
        return create_state(level)
    if aid == 5:
        return transition(level, state, dict(type='cycle'))
    if 1 <= aid <= 4:
        dx, dy = ((0, -1), (0, 1), (-1, 0), (1, 0))[aid - 1]
        return transition(level, state, dict(type='nudge', dx=dx, dy=dy))
    if aid == 6:
        data = data if isinstance(data, Mapping) else {}
        x, y = data.get('x'), data.get('y')
        if not _integer(x) or not _integer(y):
            return state
        pad = hit_pad(x, y)
        if pad:
            return transition(level, state, dict(type='set', **pad))
        pid = hit_piece(level, state, x, y)
        return select(level, state, pid) if pid is not None else state
    return state


def raster(level: Level, state: State, visual: dict[str, Any] | None = None) -> Frame:
    image = [[5] * level['width'] for _ in range(level['height'])]
    for i in state['order']:
        p = visual['position'] if visual is not None and visual.get('index') == i else position(level, state, i)
        image[p['y'] % level['height']][p['x'] % level['width']] = level['pieces'][i]['color']
    return image


def render(level: Level, state: State, progress: dict[str, int] | None = None,
           options: dict[str, Any] | None = None) -> Frame:
    """Exact web v3 64×64 palette-index raster, including optional fixed guides."""
    if progress is None:
        progress = dict(current=1, total=6)
    options = options or {}
    frame, g = [[5] * 64 for _ in range(64)], geometry(level)
    outline = options.get('outline')
    if outline is None:
        outline = 14 if state['solved'] else 3
    for x in range(g['x'] - 1, g['x'] + g['width'] + 1):
        frame[0][x] = frame[g['height'] + 1][x] = outline
    for y in range(g['height'] + 2):
        frame[y][g['x'] - 1] = frame[y][g['x'] + g['width']] = outline
    image = raster(level, state, options.get('visual'))
    guide = options.get('guide') or {}
    targets = guide.get('targets', [])
    target_cells = {(t['x'], t['y']) for t in targets}
    focused = next((t for t in targets if t['id'] == state['selected']), None)
    size = level['size']
    for y in range(level['height']):
        for x in range(level['width']):
            if focused and focused['x'] == x and focused['y'] == y:
                background = 1
            elif (x, y) in target_cells:
                background = 2 if (x + y) % 2 else 3
            else:
                background = 4 if (x + y) % 2 else 5
            color = image[y][x] if image[y][x] != 5 else background
            left, top = g['x'] + x * size, g['y'] + y * size
            for dy in range(size):
                frame[top + dy][left:left + size] = [color] * size
    si = _selected_index(level, state)
    if focused and not state['solved'] and image[focused['y']][focused['x']] != 5:
        at = position(level, state, si) if si >= 0 else None
        if at and (at['x'], at['y']) != (focused['x'], focused['y']):
            left, top = g['x'] + focused['x'] * size, g['y'] + focused['y'] * size
            for dy in (0, size - 1):
                for dx in (0, size - 1):
                    frame[top + dy][left + dx] = 1
    if si >= 0 and not state['solved']:
        visual = options.get('visual')
        p = visual['position'] if visual is not None and visual.get('index') == si else position(level, state, si)
        c = cell_center(level, p['x'] % level['width'], p['y'] % level['height'])
        frame[c['y']][c['x']] = 0
    for j in range(3):
        if si >= 0 and not level['pieces'][si]['enabled'][j]:
            continue
        v = state['sticks'][si][j] if si >= 0 else None
        for py in (-1, 0, 1):
            for px in (-1, 0, 1):
                current = si >= 0 and [px, py] == v
                color = level['pieces'][si]['color'] if current else 4
                left, top = PAD_X[j] + (px + 1) * 4, PAD_Y + (py + 1) * 4
                for dy in range(3):
                    frame[top + dy][left:left + 3] = [color] * 3
                if current:
                    frame[top + 1][left + 1] = 0
        if si >= 0 and state['active'] == j:
            frame[PAD_Y - 1][PAD_X[j]:PAD_X[j] + 11] = [2] * 11
    lh, lw = len(level['legend']), len(level['legend'][0])
    lx, ly = 63 - lw, 63 - lh
    for y in range(ly - 1, 64):
        for x in range(lx - 1, 64):
            if y in (ly - 1, 63) or x in (lx - 1, 63):
                frame[y][x] = 3
    for y, row in enumerate(level['legend']):
        frame[ly + y][lx:lx + lw] = row[:]
    if progress and _integer(progress.get('current')) and _integer(progress.get('total')) and 1 <= progress['total'] <= 30:
        count = int(progress['total'])
        columns = min(count, 10)
        rows = math.ceil(count / columns)
        w = min(5, (39 - columns + 1) // columns)
        h = 2 if rows == 1 else 1
        y0 = 61 if rows == 1 else 64 - (rows * (h + 1) - 1)
        done = progress.get('completed', progress['current'] - 1 + int(state['solved']))
        for i in range(count):
            for dy in range(h):
                left, top = 2 + (i % columns) * (w + 1), y0 + (i // columns) * (h + 1)
                frame[top + dy][left:left + w] = [14 if i < done else 3] * w
    return frame


# ---- Exact finite-state planning (optional; never used to decide a win) ----

def reachable(level: Level, state: State, i: int, cancel: Cancel = None) -> dict[int, Any]:
    """Enumerate at most 9³ settings. Costs count changed pads, not selections."""
    p, at = level['pieces'][i], position(level, state, i)
    m = MULTIPLIERS[p['color']]
    vectors = [[k % 3 - 1, k // 3 - 1] for k in range(9)]
    choices = [vectors if on else [[0, 0]] for on in p['enabled']]
    out: dict[int, Any] = {}
    for n, sticks in enumerate(product(*choices)):
        if n % 81 == 0:
            _cancelled(cancel)
        dx = dy = cost = 0
        for j in range(3):
            dx += m * WEIGHTS[j] * (sticks[j][0] - state['sticks'][i][j][0])
            dy += m * WEIGHTS[j] * (sticks[j][1] - state['sticks'][i][j][1])
            cost += sticks[j] != state['sticks'][i][j]
        raw_x, raw_y = at['x'] + dx, at['y'] + dy
        x, y = raw_x % level['width'], raw_y % level['height']
        wrap = not (0 <= raw_x < level['width'] and 0 <= raw_y < level['height'])
        key = y * level['width'] + x
        choice = dict(x=x, y=y, sticks=[v[:] for v in sticks], cost=cost, wrap=wrap, dx=dx, dy=dy)
        previous = out.get(key)
        if previous is None:
            out[key] = dict(best=choice, noWrap=None if wrap else choice)
        else:
            best = previous['best']
            if cost < best['cost'] or (cost == best['cost'] and int(wrap) < int(best['wrap'])):
                previous['best'] = choice
            if not wrap and (previous['noWrap'] is None or cost < previous['noWrap']['cost']):
                previous['noWrap'] = choice
    return out


def assignment(matrix: list[list[int]]) -> dict[str, Any] | None:
    """Deterministic Hungarian assignment with the web implementation's tie order."""
    n = len(matrix)
    if not n:
        return dict(cost=0, indices=[])
    _require(all(len(row) == n for row in matrix), 'Matrice d’affectation non carrée.')
    inf = 100_000_000
    u, v, p, way = ([0] * (n + 1) for _ in range(4))
    for i in range(1, n + 1):
        p[0], j0 = i, 0
        minv, used = [inf] * (n + 1), [False] * (n + 1)
        while True:
            used[j0] = True
            i0, delta, j1 = p[j0], inf, 0
            for j in range(1, n + 1):
                if used[j]:
                    continue
                cur = matrix[i0 - 1][j - 1] - u[i0] - v[j]
                if cur < minv[j]:
                    minv[j], way[j] = cur, j0
                if minv[j] < delta:
                    delta, j1 = minv[j], j
            if delta >= inf // 2:
                return None
            for j in range(n + 1):
                if used[j]:
                    u[p[j]] += delta
                    v[j] -= delta
                else:
                    minv[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            j1 = way[j0]
            p[j0] = p[j1]
            j0 = j1
            if j0 == 0:
                break
    indices = [0] * n
    for j in range(1, n + 1):
        indices[p[j] - 1] = j - 1
    if any(matrix[i][j] >= inf // 2 for i, j in enumerate(indices)):
        return None
    return dict(cost=sum(matrix[i][j] for i, j in enumerate(indices)), indices=indices)


def analyze(level: Level, state: State | None = None, prefer_local: bool = False,
            cancel: Cancel = None) -> dict[str, Any]:
    if state is None:
        state = create_state(level)
    maps = [reachable(level, state, i, cancel) for i in range(len(level['pieces']))]
    slots = goals(level, 0, 0)
    groups = [(color, [i for i, p in enumerate(level['pieces']) if p['color'] == color],
               [p for p in slots if p['color'] == color]) for color in COLORS]
    best, candidates, minimum_forced = None, 0, math.inf
    for y in range(level['height'] - len(level['legend']) + 1):
        _cancelled(cancel)
        for x in range(level['width'] - len(level['legend'][0]) + 1):
            feasible, cost, forced, plans = True, 0, 0, []
            for color, pieces, cells in groups:
                if not pieces:
                    continue
                options = [[maps[i].get((t['y'] + y) * level['width'] + t['x'] + x)
                            for t in cells] for i in pieces]
                a = assignment([[o['best']['cost'] if o else 100_000_000 for o in row]
                                for row in options])
                if a is None:
                    feasible = False
                    break
                w = assignment([[(0 if o['noWrap'] is not None else 1) if o else 100_000_000
                                 for o in row] for row in options])
                cost += a['cost']
                forced += w['cost']
                for k, i in enumerate(pieces):
                    plans.append(dict(index=i, **options[k][a['indices'][k]]['best']))
            if not feasible:
                continue
            candidates += 1
            minimum_forced = min(minimum_forced, forced)
            actual_forced = sum(bool(p['wrap']) for p in plans)
            span = sum(abs(p['dx']) + abs(p['dy']) for p in plans)
            previous_span = sum(abs(p['dx']) + abs(p['dy']) for p in best['plans']) if best else None
            if (best is None or cost < best['cost'] or
                (cost == best['cost'] and (actual_forced < best['wraps'] or
                 (prefer_local and actual_forced == best['wraps'] and span < previous_span)))):
                best = dict(x=x, y=y, cost=cost, wraps=actual_forced, plans=plans)
    return dict(status='ok' if best else 'impossible', candidates=candidates,
                minimumSettings=best['cost'] if best else None,
                minimumForcedWrappedPieces=int(minimum_forced) if best else None, best=best)


def make_guide(level: Level, cancel: Cancel = None) -> dict[str, Any] | None:
    """Compute once from the starting layout, not after each move."""
    a = analyze(level, create_state(level), prefer_local=True, cancel=cancel)
    if a['best'] is None:
        return None
    best = a['best']
    return dict(x=best['x'], y=best['y'], initialSettings=best['cost'],
                targets=[dict(id=level['pieces'][p['index']]['id'], index=p['index'],
                              color=level['pieces'][p['index']]['color'], x=p['x'], y=p['y'])
                         for p in best['plans']])


def analyze_guide(level: Level, state: State, guide: dict[str, Any],
                  cancel: Cancel = None) -> dict[str, Any]:
    _require(isinstance(guide, dict) and isinstance(guide.get('targets'), list)
             and len(guide['targets']) == len(level['pieces']), 'Guide de destination invalide.')
    _require(_integer(guide.get('x')) and _integer(guide.get('y')), 'Origine du guide invalide.')
    slots = {(p['x'], p['y']): p['color'] for p in goals(level, guide['x'], guide['y'])}
    seen, plans = set(), []
    cost = forced = 0
    for t in guide['targets']:
        _cancelled(cancel)
        i = next((i for i, p in enumerate(level['pieces']) if p['id'] == t.get('id')), -1)
        x, y = t.get('x'), t.get('y')
        _require(i >= 0 and i not in seen and _integer(x) and _integer(y)
                 and 0 <= x < level['width'] and 0 <= y < level['height']
                 and slots.get((x, y)) == level['pieces'][i]['color'],
                 'Le guide ne correspond plus à ce niveau.')
        seen.add(i)
        slots.pop((x, y))
        option = reachable(level, state, i, cancel).get(y * level['width'] + x)
        if option is None:
            return dict(status='impossible', candidates=0, minimumSettings=None,
                        minimumForcedWrappedPieces=None, best=None)
        plans.append(dict(index=i, **option['best']))
        cost += option['best']['cost']
        forced += option['noWrap'] is None
    _require(not slots, 'Guide incomplet.')
    return dict(status='ok', candidates=1, minimumSettings=cost, minimumForcedWrappedPieces=forced,
                best=dict(x=guide['x'], y=guide['y'], cost=cost,
                          wraps=sum(bool(p['wrap']) for p in plans), plans=plans))


def plan(level: Level, state: State, guide: dict[str, Any] | None = None,
         cancel: Cancel = None) -> dict[str, Any]:
    analysis = analyze_guide(level, state, guide, cancel) if guide is not None else analyze(level, state, cancel=cancel)
    if state['solved']:
        return dict(status='solved', actions=[], moves=0, wraps=0, analysis=analysis)
    if analysis['best'] is None:
        return dict(status='impossible', actions=[],
                    reason='Aucune combinaison des joysticks ne permet de reproduire la légende.', analysis=analysis)
    current, actions = copy_state(state), []
    for dest in analysis['best']['plans']:
        _cancelled(cancel)
        if current['solved']:
            break
        i = dest['index']
        change = [j for j in range(3) if current['sticks'][i][j] != dest['sticks'][j]]
        if not change:
            continue
        best = None
        for order in permutations(change):
            simulated = select(level, current, level['pieces'][i]['id'])
            trial, wraps = [], simulated['wraps']
            for pad in order:
                cmd = dict(type='set', pad=pad, x=dest['sticks'][pad][0], y=dest['sticks'][pad][1])
                trial.append(cmd)
                simulated = transition(level, simulated, cmd)
                if simulated['solved']:
                    break
            if best is None or simulated['wraps'] - wraps < best['wraps']:
                best = dict(actions=trial, wraps=simulated['wraps'] - wraps)
        if current['selected'] != level['pieces'][i]['id']:
            cmd = dict(type='select', id=level['pieces'][i]['id'])
            actions.append(cmd)
            current = transition(level, current, cmd)
        for cmd in best['actions']:
            actions.append(cmd)
            current = transition(level, current, cmd)
            if current['solved']:
                break
    _require(current['solved'], 'Le plan calculé ne reproduit pas la légende.')
    return dict(status='ok', actions=actions, moves=current['moves'] - state['moves'],
                wraps=current['wraps'] - state['wraps'], analysis=analysis)


def snapshot_level(level: Level, state: State) -> Level:
    """Export this current position as a new start, retaining each cube's pad settings."""
    return validate_level(dict(level, pieces=[dict(p, **position(level, state, i),
                                                    sticks=deepcopy(state['sticks'][i]))
                                              for i, p in enumerate(level['pieces'])]))


def capture_legend(level: Level, state: State) -> Frame:
    ps = positions(level, state)
    _require(not overlaps(level, state), 'Séparer les cubes superposés avant de capturer.')
    x0, x1 = min(p['x'] for p in ps), max(p['x'] for p in ps)
    y0, y1 = min(p['y'] for p in ps), max(p['y'] for p in ps)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    _require(w <= 18 and h <= 10, 'Le motif dépasse 18 × 10 cellules.')
    image = [[5] * w for _ in range(h)]
    for p in ps:
        image[p['y'] - y0][p['x'] - x0] = p['color']
    _require(has_legend_contact(image), 'Rapprocher au moins deux cubes par un côté ou un coin.')
    return image


def animation_frames(level: Level, before: State, after: State,
                     progress: dict[str, int], guide: dict[str, Any] | None = None,
                     movement: bool = True, flash: bool = True) -> tuple[list[Frame], list[float]]:
    """Render the web's discrete-cell motion, then three green/grey success pulses.

    JS Math.round is floor(x+0.5), not Python's ties-to-even round. Input is already
    committed: these frames are visual only, including intermediate wrap positions.
    """
    frames, durations = [], []
    motion = after.get('lastMotion') if after['moves'] != before['moves'] else None
    if movement and motion is not None:
        count = max(1, min(60, max(abs(motion['dx']), abs(motion['dy']))))
        duration = max(110, min(460, count * 16))
        for i in range(1, count + 1):
            t = i / count
            visual = dict(index=motion['index'], position=dict(
                x=(motion['from']['x'] + math.floor(motion['dx'] * t + 0.5)) % level['width'],
                y=(motion['from']['y'] + math.floor(motion['dy'] * t + 0.5)) % level['height']))
            frames.append(render(level, after, progress, dict(guide=guide, visual=visual)))
            durations.append(duration / count)
    if flash and after['solved'] and not before['solved']:
        for color in (14, 3, 14, 3, 14, 3, 14):
            frames.append(render(level, after, progress, dict(guide=guide, outline=color)))
            durations.append(145.0)
        # First six phases last 145 ms, final green hold lasts 100 ms.
        durations[-7:] = [145.0] * 6 + [100.0]
    if not frames:
        frames.append(render(level, after, progress, dict(guide=guide)))
        durations.append(0.0)
    return frames, durations


@dataclass(frozen=True)
class GameInfo:
    game_id: str = 'triade'
    title: str = 'TRIADE'
    family: str = 'triade'
    levels: int = 6
    default_fps: int = 8


class TriadeEngine:
    """Custom-backend adapter: reset, level_reset, action, public_state.

    Accepts your existing CustomGameInfo by structural compatibility. No import of
    your project registry is needed. Guides are on by default, as in web v3.
    `auto_advance=False` is intended for the local viewer; ARC episodes default True.
    """

    def __init__(self, info: Any = None, *, levels_dir: str | Path | None = None,
                 levels: list[Level] | None = None, animate: bool = True,
                 show_destinations: bool = True, auto_advance: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Utiliser levels ou levels_dir, pas les deux.')
        templates = validate_pack(levels) if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else GameInfo(levels=len(templates))
        count = getattr(self.info, 'levels', len(templates))
        _require(_integer(count) and 1 <= count <= len(templates), 'Nombre de niveaux info.levels invalide.')
        fps = getattr(self.info, 'default_fps', 8)
        _require(type(fps) in (int, float) and math.isfinite(fps) and fps > 0, 'default_fps doit être positif.')
        self.win_levels, self.default_fps = int(count), fps
        self._templates = templates[:self.win_levels]
        self.levels_dir = Path(levels_dir or LEVELS_DIR)
        self.animate, self.show_destinations, self.auto_advance = animate, show_destinations, auto_advance
        self._guides: dict[int, dict[str, Any] | None] = {}
        self._completed: set[int] = set()
        self._index = 0
        self._game = create_state(self._templates[0])
        self.step_index = self.level_steps = 0
        self.last_action = 'RESET'
        self.state = 'NOT_FINISHED'

    @property
    def levels_completed(self) -> int:
        return len(self._completed)

    @property
    def level(self) -> Level:
        return deepcopy(self._templates[self._index])

    @property
    def game_state(self) -> State:
        return copy_state(self._game)

    @property
    def level_number(self) -> int:
        return self._index + 1

    @property
    def guide(self) -> dict[str, Any] | None:
        if self._index not in self._guides:
            self._guides[self._index] = make_guide(self._templates[self._index])
        return deepcopy(self._guides[self._index])

    def _progress(self) -> dict[str, int]:
        return dict(current=self.level_number, total=self.win_levels, completed=self.levels_completed)

    def reset(self) -> dict[str, Any]:
        self._completed.clear()
        self._index = 0
        self.step_index = self.level_steps = 0
        self.last_action = 'RESET'
        self._game = create_state(self._templates[0])
        self.state = 'NOT_FINISHED'
        self._acknowledge_initial_solution()
        return self.public_state()

    def _acknowledge_initial_solution(self) -> None:
        # Imported solved layouts are allowed by web validation. Do not silently
        # skip them or count them repeatedly. next_level/reset handles continuation.
        if self._game['solved']:
            self._completed.add(self._index)
            self.state = 'WIN' if self._index == self.win_levels - 1 else 'LEVEL_COMPLETE'

    def level_reset(self) -> dict[str, Any]:
        self._completed.discard(self._index)
        self.level_steps = 0
        self._game = create_state(self._templates[self._index])
        self.last_action, self.state = 'ACTION7', 'NOT_FINISHED'
        self._acknowledge_initial_solution()
        return self.public_state()

    def load_level(self, number: int) -> dict[str, Any]:
        """Local testing: seek a level; does not mark skipped levels as completed."""
        _require(_integer(number) and 1 <= number <= self.win_levels, 'Niveau hors limites.')
        self._index = int(number) - 1
        self.level_steps = 0
        self._game = create_state(self._templates[self._index])
        self.last_action, self.state = 'LOAD_LEVEL', 'NOT_FINISHED'
        self._acknowledge_initial_solution()
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        if self._game['solved'] and self._index < self.win_levels - 1:
            return self.load_level(self._index + 2)
        return self.public_state()

    def set_show_destinations(self, enabled: bool) -> dict[str, Any]:
        _require(type(enabled) is bool, 'show_destinations attend un booléen.')
        self.show_destinations = enabled
        return self.public_state()

    def _commit(self, new: State, last_action: str) -> dict[str, Any]:
        before, current_level = self._game, self._templates[self._index]
        self._game, self.last_action = new, last_action
        self.step_index += 1
        self.level_steps += 1
        solved_now = new['solved'] and not before['solved']
        if solved_now:
            self._completed.add(self._index)
        guide = self.guide if self.show_destinations else None
        frames, durations = animation_frames(current_level, before, new, self._progress(), guide,
                                              movement=self.animate, flash=self.animate)
        if solved_now:
            if self._index == self.win_levels - 1:
                self.state = 'WIN'
            elif self.auto_advance:
                self._index += 1
                self._game = create_state(self._templates[self._index])
                self.level_steps = 0
                self._acknowledge_initial_solution()
            else:
                self.state = 'LEVEL_COMPLETE'
        result = self.public_state()
        if solved_now and self.auto_advance and self.state != 'WIN':
            frames.append(result['frame'])
            durations.append(0.0)
        elif frames[-1] != result['frame']:
            frames.append(result['frame'])
            durations.append(0.0)
        if not self.animate:
            frames, durations = [result['frame']], [0.0]
        result['frames'], result['frame_count'] = frames, len(frames)
        result['frame_durations_ms'] = durations
        # Legacy clients only support one interval; per-frame durations are preferred.
        result['transition_frame_interval_ms'] = 1000 / self.default_fps
        if solved_now:
            result['last_event'] = 'GAME_WON' if self.state == 'WIN' else 'LEVEL_COMPLETE'
        return result

    @staticmethod
    def _action_id(value: Any) -> int | None:
        value = getattr(value, 'value', value)
        if isinstance(value, str):
            value = value.removeprefix('ACTION')
            if not value.isdigit():
                return None
            value = int(value)
        return int(value) if _integer(value) and 1 <= value <= 7 else None

    def action(self, action_id: Any, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        aid = self._action_id(action_id)
        if aid is None:
            return self.public_state()
        if aid == 7:
            return self.level_reset()
        if self.state != 'NOT_FINISHED':
            return self.public_state()
        return self._commit(action(self._templates[self._index], self._game, aid, data), f'ACTION{aid}')

    def control(self, command: dict[str, Any]) -> dict[str, Any]:
        """Local UI semantic controls; agents normally use action(1..7)."""
        if not isinstance(command, dict):
            return self.public_state()
        if command.get('type') == 'reset':
            return self.level_reset()
        if self.state != 'NOT_FINISHED':
            return self.public_state()
        return self._commit(transition(self._templates[self._index], self._game, command),
                            f"CONTROL:{command.get('type', 'unknown')}")

    def restore_state(self, saved: State) -> dict[str, Any]:
        """Local undo only. Validate saved settings; no arbitrary positions are accepted."""
        level, n = self._templates[self._index], len(self._templates[self._index]['pieces'])
        _require(isinstance(saved, dict) and isinstance(saved.get('sticks'), list)
                 and len(saved['sticks']) == n, 'État incompatible avec ce niveau.')
        for i, sticks in enumerate(saved['sticks']):
            _require(isinstance(sticks, list) and len(sticks) == 3 and all(map(_vector, sticks)),
                     'Positions de joysticks invalides.')
            _require(all(on or v == [0, 0] for on, v in zip(level['pieces'][i]['enabled'], sticks)),
                     'Joystick absent modifié.')
        _require(isinstance(saved.get('order'), list) and sorted(saved['order']) == list(range(n)),
                 'Ordre des cubes invalide.')
        _require(_integer(saved.get('active')) and 0 <= saved['active'] < 3, 'Joystick actif invalide.')
        _require(saved.get('selected') is None or saved['selected'] in {p['id'] for p in level['pieces']},
                 'Sélection invalide.')
        _require(all(_integer(saved.get(k)) and saved[k] >= 0 for k in ('moves', 'wraps')), 'Compteurs invalides.')
        self._game = copy_state(saved)
        self._game['solved'] = match(level, self._game)['solved']
        self._completed.discard(self._index)
        self.state, self.last_action = 'NOT_FINISHED', 'UNDO'
        self._acknowledge_initial_solution()
        return self.public_state()

    def get_plan(self, guided: bool | None = None, cancel: Cancel = None) -> dict[str, Any]:
        use_guide = self.show_destinations if guided is None else guided
        return plan(self._templates[self._index], self._game, self.guide if use_guide else None, cancel)

    def public_state(self) -> dict[str, Any]:
        frame = render(self._templates[self._index], self._game, self._progress(),
                       dict(guide=self.guide if self.show_destinations else None))
        ids = list(range(1, 8)) if self.state == 'NOT_FINISHED' else [7]
        return dict(backend='custom', selected=True,
                    game_id=getattr(self.info, 'game_id', 'triade'),
                    title=getattr(self.info, 'title', 'TRIADE'),
                    frame=frame, frames=[frame], frame_count=1, frame_durations_ms=[0.0],
                    default_fps=self.default_fps, state=self.state, level=self.level_number,
                    levels_completed=self.levels_completed, win_levels=self.win_levels,
                    step_index=self.step_index, available_actions=[f'ACTION{i}' for i in ids],
                    available_action_ids=ids, last_action=self.last_action, score=self.levels_completed,
                    full_reset=False, source_path=str(self.levels_dir),
                    custom_family=getattr(self.info, 'family', 'triade'),
                    level_name=self._templates[self._index]['title'], level_steps=self.level_steps,
                    max_steps=None, selected_piece=self._game['selected'],
                    active_joystick=self._game['active'], moves=self._game['moves'], wraps=self._game['wraps'],
                    last_event=self._game['lastEvent'], show_destinations=self.show_destinations,
                    palette=list(PALETTE), units='cells')
