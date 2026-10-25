"""SÉLÈNE: native Python port of the approved web v10 (MIT).

Pure rules and 64x64 integer-palette rendering, plus a custom ARC3 adapter.
No JavaScript, browser, external package or network is used at runtime.
Dictionary keys follow the web format so JSON levels/sessions remain compatible.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import json
import math
from pathlib import Path
import re
from typing import Any, Iterable, Mapping

Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]
FRAME = 64
BG, WIRE, GREEN, RED, BLUE, WHITE = 5, 4, 14, 8, 9, 0
PALETTE = [
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#921231', '#4FCC30', '#A356D6',
]
FIELD = {'x0': 1, 'y0': 1, 'x1': 62, 'y1': 42}
RADIUS, PHASES, PAUSE, TAIL = 2.2, 16, 4, 5
ANIMATION_STRIDE = 4
FAILURE_FLASH_MS = 240
BEAM_FRAME_MS = 22
SUCCESS_FRAME_MS = 140
SUCCESS_COLORS = (GREEN, 3, GREEN, 3, GREEN, 3, GREEN)
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'selene' / 'levels'
MOON_W, MOON_H, MOON_SIZE, MOON_CENTER = 8, 7, 9, 4
# Constants below are copied from the approved web engine (not recomputed sprites).
DIRECTIONS = [{'x': 1, 'y': 0},
 {'x': 0.9238795325112867, 'y': 0.3826834323650898},
 {'x': 0.7071067811865476, 'y': 0.7071067811865475},
 {'x': 0.38268343236508984, 'y': 0.9238795325112867},
 {'x': 0, 'y': 1},
 {'x': -0.3826834323650897, 'y': 0.9238795325112867},
 {'x': -0.7071067811865475, 'y': 0.7071067811865476},
 {'x': -0.9238795325112867, 'y': 0.3826834323650899},
 {'x': -1, 'y': 0},
 {'x': -0.9238795325112868, 'y': -0.38268343236508967},
 {'x': -0.7071067811865477, 'y': -0.7071067811865475},
 {'x': -0.38268343236509034, 'y': -0.9238795325112865},
 {'x': 0, 'y': -1},
 {'x': 0.38268343236509, 'y': -0.9238795325112866},
 {'x': 0.7071067811865474, 'y': -0.7071067811865477},
 {'x': 0.9238795325112865, 'y': -0.3826834323650904}]
MOON_PHASES = [['..0000..', '.000000.', '00000000', '00000000', '00000000', '.000000.', '..0000..'],
 ['..1000..', '.100000.', '10000000', '10000000', '10000000', '.100000.', '..1000..'],
 ['..1000..', '.110000.', '11000000', '11000000', '11000000', '.110000.', '..1000..'],
 ['..1100..', '.110000.', '11100000', '11100000', '11100000', '.110000.', '..1100..'],
 ['..1100..', '.111000.', '11110000', '#1110000', '11110000', '.111000.', '..1100..'],
 ['..1100..', '.111100.', '11111000', '##111000', '11111000', '.111100.', '..1100..'],
 ['..1110..', '.111100.', '11111100', '1##11100', '11111100', '.111100.', '..1110..'],
 ['..1110..', '.111110.', '11111110', '11##1110', '11111110', '.111110.', '..1110..'],
 ['..1111..', '.111111.', '11111111', '111##111', '11111111', '.111111.', '..1111..'],
 ['..0111..', '.011111.', '01111111', '0111##11', '01111111', '.011111.', '..0111..'],
 ['..0111..', '.001111.', '00111111', '00111##1', '00111111', '.001111.', '..0111..'],
 ['..0011..', '.001111.', '00011111', '000111##', '00011111', '.001111.', '..0011..'],
 ['..0011..', '.000111.', '00001111', '0000111#', '00001111', '.000111.', '..0011..'],
 ['..0011..', '.000011.', '00000111', '00000111', '00000111', '.000011.', '..0011..'],
 ['..0001..', '.000011.', '00000011', '00000011', '00000011', '.000011.', '..0001..'],
 ['..0001..', '.000001.', '00000001', '00000001', '00000001', '.000001.', '..0001..']]

def _check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def integer(value: Any) -> bool:
    """JSON/ARC coordinates must be actual integers, never booleans."""
    return type(value) is int and abs(value) <= 9_007_199_254_740_991


def js_round(value: float) -> int:
    """Match Math.round, including negative half-ties, for identical beam pixels."""
    return math.floor(value + 0.5)


def _point(raw: Any, label: str, limits: tuple[int, int, int, int]) -> dict[str, int]:
    _check(isinstance(raw, dict) and integer(raw.get('x')) and integer(raw.get('y')),
           f'{label} : coordonnées entières attendues.')
    x, y = raw['x'], raw['y']
    _check(limits[0] <= x <= limits[1] and limits[2] <= y <= limits[3],
           f'{label} : position hors de sa zone.')
    return {'x': x, 'y': y}


def validate_level(raw: Any) -> Level:
    _check(isinstance(raw, dict), 'Le niveau doit être un objet.')
    _check(isinstance(raw.get('spheres'), list) and 1 <= len(raw['spheres']) <= 6,
           'Prévoir entre une et six sphères.')
    source = _point(raw.get('source'), 'Source', (3, 60, 4, 39))
    direction = raw['source'].get('dir')
    _check(integer(direction) and 0 <= direction < 16, 'Orientation de source : entier de 0 à 15.')
    source['dir'] = direction
    target = _point(raw.get('target'), 'Cible', (4, 59, 4, 39))
    ids: set[str] = set()
    spheres = []
    for i, obj in enumerate(raw['spheres']):
        _check(isinstance(obj, dict), 'Sphère invalide.')
        sid = obj.get('id', f'S{i+1}')
        _check(isinstance(sid, str) and re.fullmatch(r'[a-zA-Z0-9_-]{1,24}', sid) is not None
               and sid not in ids, 'Identifiants de sphères distincts attendus.')
        ids.add(sid)
        point = _point(obj, f'Sphère {sid}', (4, 59, 4, 39))
        control = _point(obj.get('control'), f'Lune {sid}', (5, 58, 49, 54))
        initial = obj.get('initial')
        _check(integer(initial) and 0 <= initial < 16, 'Orientation initiale entre 0 et 15.')
        spheres.append({'id': sid, **point, 'initial': initial, 'control': control})
    objects = [source, *spheres, target]
    for i, p in enumerate(objects):
        for q in objects[i + 1:]:
            _check(math.hypot(p['x']-q['x'], p['y']-q['y']) >= 7,
                   'Source, sphères et cible : sept pixels de séparation minimum.')
    for i, s in enumerate(spheres):
        for t in spheres[i + 1:]:
            p, q = s['control'], t['control']
            _check(math.hypot(p['x']-q['x'], p['y']-q['y']) >= 10,
                   'Deux lunes se chevauchent : dix pixels minimum entre leurs centres.')
    return {'version': 1, 'id': str(raw.get('id') or 'custom')[:40],
            'title': str(raw.get('title', 'Relais lunaire'))[:90],
            'description': str(raw.get('description', 'Acheminer le tir vert jusqu’à la cible.'))[:600],
            'source': source, 'target': target, 'spheres': spheres}


def validate_pack(raw: Any) -> list[Level]:
    items = raw if isinstance(raw, list) else raw.get('levels', [raw]) if isinstance(raw, dict) else [raw]
    _check(isinstance(items, list) and 1 <= len(items) <= 6, 'Importer de un à six niveaux.')
    return [validate_level(item) for item in items]


def load_levels(path: str | Path | None = None) -> list[Level]:
    """Read the bundled levels, a directory of L*.json, or a web JSON export."""
    p = Path(path) if path is not None else LEVELS_DIR
    if p.is_dir():
        files = sorted(p.glob('L*.json'))
        _check(bool(files), f'Aucun niveau L*.json dans {p}.')
        return validate_pack([json.loads(f.read_text(encoding='utf-8-sig')) for f in files])
    return validate_pack(json.loads(p.read_text(encoding='utf-8-sig')))


def create_state(level: Level) -> State:
    return {'angles': [s['initial'] for s in level['spheres']], 'selected': -1,
            'rotations': 0, 'launches': 0, 'status': 'READY', 'lastEvent': 'READY',
            'trace': None, 'tick': 0}


def _boundary_distance(p: Mapping[str, float], d: Mapping[str, float]) -> float:
    distance = math.inf
    if d['x'] > 0:
        distance = min(distance, (FIELD['x1']-p['x'])/d['x'])
    if d['x'] < 0:
        distance = min(distance, (FIELD['x0']-p['x'])/d['x'])
    if d['y'] > 0:
        distance = min(distance, (FIELD['y1']-p['y'])/d['y'])
    if d['y'] < 0:
        distance = min(distance, (FIELD['y0']-p['y'])/d['y'])
    return max(0.0, distance)


def cast_ray(level: Level, origin: Mapping[str, float], angle: int, ignore: int = -1) -> dict[str, Any]:
    _check(integer(angle) and 0 <= angle < 16, 'Orientation hors des seize positions.')
    d = DIRECTIONS[angle]
    distance = _boundary_distance(origin, d)
    hit = {'kind': 'edge', 'index': -1}
    receivers = [dict(p, kind='sphere', index=i) for i, p in enumerate(level['spheres'])]
    receivers.append(dict(level['target'], kind='target', index=-1))
    for p in receivers:
        if p['kind'] == 'sphere' and p['index'] == ignore:
            continue
        dx, dy = p['x']-origin['x'], p['y']-origin['y']
        along = dx*d['x']+dy*d['y']
        if along <= 0:
            continue
        sideways2 = dx*dx+dy*dy-along*along
        if sideways2 > RADIUS*RADIUS+1e-9:
            continue
        t = along-math.sqrt(max(0.0, RADIUS*RADIUS-sideways2))
        if t > 1e-7 and t < distance-1e-9:
            distance, hit = t, {'kind': p['kind'], 'index': p['index']}
    return {'origin': {'x': origin['x'], 'y': origin['y']},
            'end': {'x': origin['x']+d['x']*distance, 'y': origin['y']+d['y']*distance},
            'angle': angle, 'distance': distance, 'hit': hit}


def line_pixels(a: Mapping[str, float], b: Mapping[str, float]) -> list[dict[str, int]]:
    x, y, x1, y1 = js_round(a['x']), js_round(a['y']), js_round(b['x']), js_round(b['y'])
    dx, dy = abs(x1-x), -abs(y1-y)
    sx, sy = (1 if x < x1 else -1), (1 if y < y1 else -1)
    err = dx+dy
    result = []
    while True:
        result.append({'x': x, 'y': y})
        if x == x1 and y == y1:
            return result
        e = 2*err
        if e >= dy:
            err += dy
            x += sx
        if e <= dx:
            err += dx
            y += sy


def trace_shot(level: Level, angles: list[int]) -> dict[str, Any]:
    _check(isinstance(angles, list) and len(angles) == len(level['spheres'])
           and all(integer(a) and 0 <= a < 16 for a in angles), 'Réglages invalides.')
    segments: list[dict[str, Any]] = []
    visited: list[int] = []
    order: list[int] = []
    emitter, origin, angle, time, outcome = -1, level['source'], level['source']['dir'], 0, 'MISS'
    for _ in range(len(level['spheres'])+1):
        segment = dict(cast_ray(level, origin, angle, emitter), emitter=emitter)
        segment['pixels'] = line_pixels(segment['origin'], segment['end'])
        segment['start'] = time
        segment['duration'] = max(1, len(segment['pixels'])-1)
        segment['arrival'] = time+segment['duration']
        segments.append(segment)
        time = segment['arrival']
        kind = segment['hit']['kind']
        if kind == 'target':
            outcome = 'WIN'
            break
        if kind == 'edge':
            break
        i = segment['hit']['index']
        order.append(i)
        if i in visited:
            outcome = 'LOOP'
            break
        visited.append(i)
        emitter, origin, angle = i, level['spheres'][i], angles[i]
        time += PAUSE
    return {'segments': segments, 'outcome': outcome, 'order': order,
            'activated': visited, 'totalTicks': time+TAIL}


def status_at(trace: dict[str, Any] | None, tick: int) -> dict[str, Any]:
    activated = []
    for seg in (trace or {}).get('segments', []):
        if tick >= seg['arrival'] and seg['hit']['kind'] == 'sphere' and seg['hit']['index'] not in activated:
            activated.append(seg['hit']['index'])
    return {'activated': activated, 'complete': trace is not None and tick >= trace['totalTicks']}


def control_hit(level: Level, x: Any, y: Any) -> int:
    if not integer(x) or not integer(y):
        return -1
    return next((i for i, s in enumerate(level['spheres'])
                 if (s['control']['x']-x)**2+(s['control']['y']-y)**2 <= 25), -1)


def source_hit(level: Level, x: Any, y: Any) -> bool:
    return integer(x) and integer(y) and abs(x-level['source']['x']) <= 2 and abs(y-level['source']['y']) <= 2


def reset_after_shot(level: Level, state: State, last_event: str = 'FAILED_RESET') -> State:
    return dict(state, angles=[s['initial'] for s in level['spheres']], trace=None,
                tick=0, status='READY', lastEvent=last_event)


def snapshot_state(level: Level, state: State) -> State:
    stable = reset_after_shot(level, state) if state['status'] in ('FIRING', 'FAILING', 'MISS', 'LOOP') else state
    return {'angles': list(stable['angles']), 'selected': stable['selected'],
            'rotations': stable['rotations'], 'launches': stable['launches'],
            'status': 'WIN' if stable['status'] == 'WIN' else 'READY'}


def validate_state(level: Level, raw: Any) -> State:
    _check(isinstance(raw, dict), 'État invalide.')
    angles = raw.get('angles')
    _check(isinstance(angles, list) and len(angles) == len(level['spheres']) and
           all(integer(a) and 0 <= a < 16 for a in angles), 'Réglages invalides.')
    _check(integer(raw.get('selected')) and -1 <= raw['selected'] < len(angles), 'Sélection invalide.')
    for name in ('rotations', 'launches'):
        _check(integer(raw.get(name)) and raw[name] >= 0, 'Compteur invalide.')
    s = dict(create_state(level), angles=list(angles), selected=raw['selected'],
             rotations=raw['rotations'], launches=raw['launches'])
    if raw.get('status') == 'WIN':
        trace = trace_shot(level, angles)
        _check(trace['outcome'] == 'WIN', 'Le parcours sauvegardé ne touche pas la cible.')
        s.update(trace=trace, tick=trace['totalTicks'], status='WIN', lastEvent='RESTORED')
    if raw.get('status') in ('FIRING', 'FAILING', 'MISS', 'LOOP'):
        return reset_after_shot(level, s)
    return s


def validate_session(raw: Any) -> dict[str, Any]:
    _check(isinstance(raw, dict) and raw.get('game') == 'selene-session' and raw.get('version') == 1,
           'Fichier de parcours SÉLÈNE attendu.')
    levels = validate_pack(raw.get('levels'))
    states = raw.get('states')
    _check(isinstance(states, list) and len(states) == len(levels), 'Progression et niveaux incompatibles.')
    index = raw.get('index')
    _check(integer(index) and 0 <= index < len(levels), 'Niveau invalide.')
    return {'levels': levels, 'states': [validate_state(l, s) for l, s in zip(levels, states)], 'index': index}


def transition(level: Level, state: State, event: Any) -> State:
    """Pure transition: invalid/no-op inputs return the same object; no in-place edits."""
    if not isinstance(event, dict):
        return state
    kind = event.get('type')
    if kind == 'reset':
        return create_state(level)
    if kind == 'tick':
        if state['status'] == 'FAILING':
            return reset_after_shot(level, state)
        if state['status'] != 'FIRING':
            return state
        count = event.get('count', 1)
        count = min(count, 10000) if integer(count) and count > 0 else 1
        tick = min(state['trace']['totalTicks'], state['tick']+count)
        if tick < state['trace']['totalTicks']:
            return dict(state, tick=tick, lastEvent='PROPAGATING')
        win = state['trace']['outcome'] == 'WIN'
        return dict(state, tick=tick, status='WIN' if win else 'FAILING',
                    lastEvent='WIN' if win else state['trace']['outcome'])
    if kind == 'stop':
        if state['status'] == 'FAILING':
            return reset_after_shot(level, state)
        if state['status'] == 'FIRING':
            return reset_after_shot(level, state, 'SHOT_STOPPED_RESET')
        return state
    if state['status'] in ('FIRING', 'FAILING', 'WIN'):
        return state
    if kind == 'select':
        i = event.get('index')
        return dict(state, selected=i, lastEvent='SELECTED') if integer(i) and 0 <= i < len(level['spheres']) else state
    if kind == 'rotate':
        delta = event.get('delta')
        if state['selected'] < 0 or not integer(delta) or delta not in (-1, 1):
            return state
        angles = list(state['angles'])
        angles[state['selected']] = (angles[state['selected']]+delta) % 16
        return dict(state, angles=angles, rotations=state['rotations']+1, trace=None,
                    tick=0, status='READY', lastEvent='ROTATED')
    if kind == 'fire':
        return dict(state, launches=state['launches']+1, status='FIRING',
                    trace=trace_shot(level, state['angles']), tick=0, lastEvent='SOURCE_FIRED')
    if kind == 'click':
        x, y = event.get('x'), event.get('y')
        i = control_hit(level, x, y)
        if i >= 0:
            return transition(level, state, {'type': 'select', 'index': i})
        if source_hit(level, x, y):
            return transition(level, state, {'type': 'fire'})
    return state


def action(level: Level, state: State, aid: int, data: dict[str, Any] | None = None) -> State:
    data = data or {}
    if not integer(aid):
        return state
    if aid == 7:
        return create_state(level)
    if aid in (3, 4):
        return transition(level, state, {'type': 'rotate', 'delta': -1 if aid == 3 else 1})
    if aid == 5:
        return transition(level, state, {'type': 'fire'})
    if aid == 6:
        return transition(level, state, {'type': 'click', 'x': data.get('x'), 'y': data.get('y')})
    return state


def animation_step(level: Level, state: State) -> State:
    return transition(level, state, {'type': 'tick', 'count': ANIMATION_STRIDE})


def animation_frame_count(trace: dict[str, Any]) -> int:
    _check(isinstance(trace, dict) and integer(trace.get('totalTicks')) and trace['totalTicks'] >= 0, 'Trace invalide.')
    return 1+(trace['totalTicks']+ANIMATION_STRIDE-1)//ANIMATION_STRIDE


def rotations_between(a: int, b: int) -> dict[str, int]:
    delta = (b-a) % 16
    return {'steps': delta, 'delta': 1} if delta <= 8 else {'steps': 16-delta, 'delta': -1}


def solve(level: Level, angles: list[int] | None = None) -> dict[str, Any]:
    """Search all simple optical routes; minimize turns without changing any angle."""
    if angles is None:
        angles = [s['initial'] for s in level['spheres']]
    first = cast_ray(level, level['source'], level['source']['dir'])['hit']
    if first['kind'] == 'edge':
        return {'solvable': False, 'reason': 'La source ne touche aucune sphère.'}
    if first['kind'] == 'target':
        return {'solvable': True, 'cost': 0, 'route': [], 'adjustments': [], 'direct': True}
    graph = [[dict(cast_ray(level, p, k, i)['hit'], dir=k) for k in range(16)]
             for i, p in enumerate(level['spheres'])]
    best: dict[str, Any] | None = None
    paths, min_relays, max_relays = 0, math.inf, 0

    def dfs(i: int, used: set[int], route: list[dict[str, Any]], cost: int) -> None:
        nonlocal best, paths, min_relays, max_relays
        for edge in graph[i]:
            if edge['kind'] == 'edge' or (edge['kind'] == 'sphere' and edge['index'] in used):
                continue
            turn = rotations_between(angles[i], edge['dir'])
            r = [*route, {'index': i, 'dir': edge['dir'],
                         'to': 'target' if edge['kind'] == 'target' else edge['index']}]
            nc = cost+turn['steps']
            if edge['kind'] == 'target':
                paths += 1
                min_relays, max_relays = min(min_relays, len(r)), max(max_relays, len(r))
                if best is None or nc < best['cost'] or (nc == best['cost'] and len(r) > len(best['route'])):
                    best = {'cost': nc, 'route': r}
            else:
                dfs(edge['index'], used | {edge['index']}, r, nc)
    dfs(first['index'], {first['index']}, [], 0)
    if best is None:
        return {'solvable': False, 'reason': 'Aucune chaîne de tirs parmi les seize directions n’atteint la cible.'}
    adjustments = [dict(e, **rotations_between(angles[e['index']], e['dir'])) for e in best['route']]
    return {'solvable': True, **best, 'adjustments': adjustments,
            'paths': paths, 'minRelays': min_relays, 'maxRelays': max_relays}


def solution_actions(level: Level, state: State) -> dict[str, Any]:
    answer = solve(level, state['angles'])
    if not answer['solvable']:
        return answer
    actions = []
    selected = state['selected']
    for adj in answer['adjustments']:
        if adj['steps'] == 0:
            continue
        if selected != adj['index']:
            actions.append({'aid': 6, 'data': dict(level['spheres'][adj['index']]['control'])})
            selected = adj['index']
        actions.extend({'aid': 3 if adj['delta'] < 0 else 4} for _ in range(adj['steps']))
    actions.append({'aid': 5})
    return dict(answer, actions=actions)


def blank(color: int = BG) -> Frame:
    return [[color]*FRAME for _ in range(FRAME)]


def _put(frame: Frame, x: int, y: int, color: int) -> None:
    if integer(x) and integer(y) and 0 <= x < FRAME and 0 <= y < FRAME:
        frame[y][x] = color


def _line(frame: Frame, a: Mapping[str, float], b: Mapping[str, float], color: int) -> None:
    for p in line_pixels(a, b):
        _put(frame, p['x'], p['y'], color)


def _rect(frame: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    for xx in range(x, x+w):
        _put(frame, xx, y, color)
        _put(frame, xx, y+h-1, color)
    for yy in range(y, y+h):
        _put(frame, x, yy, color)
        _put(frame, x+w-1, yy, color)


def moon_pixels(phase: int) -> dict[str, Frame]:
    _check(integer(phase) and 0 <= phase < PHASES, 'Phase lunaire invalide.')
    frame = [[BG]*MOON_SIZE for _ in range(MOON_SIZE)]
    colors = {'0': BLUE, '1': RED, '#': GREEN, '.': BG}
    for y, row in enumerate(MOON_PHASES[phase]):
        for x, c in enumerate(row):
            frame[y+1][x] = colors[c]
    return {'frame': frame}


MOONS = [moon_pixels(i) for i in range(PHASES)]


def moon_phase_index(angle: int) -> int:
    # Up = all blue; down = all red; right = red half on the right.
    return (12-angle) % PHASES


def draw_moon(frame: Frame, center: Mapping[str, int], angle: int, selected: bool) -> None:
    image = MOONS[moon_phase_index(angle)]['frame']
    if selected:
        for y, row in enumerate(image):
            for x, color in enumerate(row):
                if color == BG:
                    continue
                for dx, dy in ((-1,0), (1,0), (0,-1), (0,1), (-1,-1), (1,-1), (-1,1), (1,1)):
                    xx, yy = x+dx, y+dy
                    if not (0 <= yy < MOON_SIZE and 0 <= xx < MOON_SIZE) or image[yy][xx] == BG:
                        _put(frame, center['x']+x-4+dx, center['y']+y-4+dy, WHITE)
    for y, row in enumerate(image):
        for x, color in enumerate(row):
            if color != BG:
                _put(frame, center['x']+x-4, center['y']+y-4, color)


def draw_sphere(frame: Frame, p: Mapping[str, int], on: bool, selected: bool) -> None:
    for y in range(-2, 3):
        for x in range(-2, 3):
            if x*x+y*y <= 5:
                _put(frame, p['x']+x, p['y']+y, GREEN if on else 2)
    if selected:
        _put(frame, p['x'], p['y'], WHITE)


def render(level: Level, state: State, progress: Iterable[int] = (),
           options: dict[str, Any] | None = None) -> Frame:
    """Exact web-v10 palette frame, including the full-red failure state."""
    if state['status'] == 'FAILING':
        return blank(RED)
    options = options or {}
    f = blank()
    trace, tick, selected = state['trace'], state['tick'], state['selected']
    activated = status_at(trace, tick)['activated']
    indexes = [i for i in range(len(level['spheres'])) if i != selected]
    if selected >= 0:
        indexes.append(selected)
    for i in indexes:
        sphere = level['spheres'][i]
        _line(f, sphere, sphere['control'], 2 if i == selected else WIRE)
    if options.get('aim') and selected >= 0:
        s = level['spheres'][selected]
        ray = cast_ray(level, s, state['angles'][selected], selected)
        for i, p in enumerate(line_pixels(s, ray['end'])):
            if i % 3 == 0:
                _put(f, p['x'], p['y'], 3)
    for seg in (trace or {}).get('segments', []):
        if tick < seg['start']:
            break
        n = min(len(seg['pixels']), max(1, tick-seg['start']+1))
        for p in seg['pixels'][:n]:
            if 1 <= p['x'] <= 62 and 1 <= p['y'] <= 42:
                _put(f, p['x'], p['y'], GREEN)
    s = level['source']
    d = DIRECTIONS[s['dir']]
    _rect(f, s['x']-2, s['y']-2, 5, 5, 3)
    for yy in range(-1, 2):
        for xx in range(-1, 2):
            _put(f, s['x']+xx, s['y']+yy, GREEN)
    _put(f, s['x']+js_round(2*d['x']), s['y']+js_round(2*d['y']), WHITE)
    target_hit = any(seg['hit']['kind'] == 'target' and tick >= seg['arrival']
                     for seg in (trace or {}).get('segments', []))
    t = level['target']
    for y in range(-3, 4):
        for x in range(-3, 4):
            if abs(x)+abs(y) == 3:
                _put(f, t['x']+x, t['y']+y, GREEN if target_hit else 11)
    _put(f, t['x'], t['y'], GREEN if target_hit else 2)
    for i, p in enumerate(level['spheres']):
        draw_sphere(f, p, i in activated, i == selected)
    if trace and state['status'] in ('MISS', 'LOOP'):
        end = trace['segments'][-1]['end']
        _put(f, js_round(end['x']), js_round(end['y']), RED)
    outline = options.get('outline')
    _rect(f, 0, 0, 64, 44, outline if outline is not None else GREEN if state['status'] == 'WIN' else 3)
    for i, s in enumerate(level['spheres']):
        draw_moon(f, s['control'], state['angles'][i], i == selected)
    done = set(progress)
    for i in range(6):
        for y in (61, 62):
            for x in range(2+6*i, 7+6*i):
                _put(f, x, y, GREEN if i in done else 3)
    return f


def audit(level: Level) -> dict[str, Any]:
    answer = solve(level)
    _check(answer['solvable'], f"{level['id']} : aucun trajet vers la cible.")
    state = create_state(level)
    for adj in answer['adjustments']:
        state['angles'][adj['index']] = adj['dir']
    trace = trace_shot(level, state['angles'])
    _check(trace['outcome'] == 'WIN', 'Le solveur et le laser ne sont pas d’accord.')
    return {'id': level['id'], 'spheres': len(level['spheres']), 'minimumRotations': answer['cost'],
            'routeLength': len(answer['route']), 'minimumRelays': answer.get('minRelays', 0),
            'paths': answer.get('paths', 1), 'angles': [e['dir'] for e in answer['route']],
            'intermediateAngles': sum(e['dir'] % 2 for e in answer['route']),
            'frames': trace['totalTicks']+1, 'animationFrames': animation_frame_count(trace),
            'initialShot': trace_shot(level, [s['initial'] for s in level['spheres']])['outcome']}


@dataclass(frozen=True)
class GameInfo:
    game_id: str = 'selene'
    title: str = 'SÉLÈNE'
    family: str = 'custom'
    levels: int = 6
    default_fps: int = 8


class SeleneEngine:
    """Synchronous custom-backend adapter; one fire action resolves the entire shot.

    Intermediate frames are returned, not charged as extra agent actions. Failures
    reset the current puzzle, not the campaign. The local player uses the pure
    transition/animation_step functions instead, to animate without blocking Tk.
    """
    def __init__(self, info: Any = None, animate: bool = True, *,
                 levels: Any = None, levels_path: str | Path | None = None,
                 auto_advance: bool = True, frame_interval_ms: int = BEAM_FRAME_MS):
        self.levels = load_levels(levels_path) if levels is None else validate_pack(levels)
        self.info = info if info is not None else GameInfo(levels=len(self.levels))
        requested = getattr(self.info, 'levels', len(self.levels))
        _check(integer(requested) and 1 <= requested <= len(self.levels),
               f'Nombre de niveaux demandé invalide : {requested}; {len(self.levels)} disponibles.')
        _check(integer(frame_interval_ms) and frame_interval_ms > 0, 'Durée de frame positive attendue.')
        self.win_levels = requested
        self.animate = bool(animate)
        self.auto_advance = bool(auto_advance)
        self.frame_interval_ms = frame_interval_ms
        self.level_index = 0
        self.levels_completed = 0
        self.step_index = 0
        self.level_steps = 0
        self.last_action = 'RESET'
        self.last_event = 'READY'
        self.state = 'NOT_FINISHED'
        self.level_state = create_state(self.levels[0])

    def reset(self) -> dict[str, Any]:
        self.level_index = self.levels_completed = self.step_index = self.level_steps = 0
        self.level_state = create_state(self.levels[0])
        self.last_action, self.last_event, self.state = 'RESET', 'READY', 'NOT_FINISHED'
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.level_state = create_state(self.levels[self.level_index])
        self.levels_completed = min(self.levels_completed, self.level_index)
        self.level_steps = 0
        self.last_action, self.last_event, self.state = 'ACTION7', 'LEVEL_RESET', 'NOT_FINISHED'
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        if self.level_state['status'] == 'WIN' and self.level_index+1 < self.win_levels:
            self.level_index += 1
            self.level_steps = 0
            self.level_state = create_state(self.levels[self.level_index])
            self.last_event = 'LEVEL_STARTED'
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        if not integer(action_id):
            raise ValueError('action_id doit être un entier.')
        if data is not None and not isinstance(data, dict):
            raise ValueError('data doit être un dictionnaire.')
        if action_id == 7:
            return self.level_reset()
        if self.state == 'WIN' or action_id not in (3, 4, 5, 6):
            return self.public_state()
        self.last_action = f'ACTION{action_id}'
        self.step_index += 1
        self.level_steps += 1
        level = self.levels[self.level_index]
        self.level_state = action(level, self.level_state, action_id, data)
        self.last_event = self.level_state['lastEvent']
        if self.level_state['status'] != 'FIRING':
            return self.public_state()

        trace = self.level_state['trace']
        shot_outcome = trace['outcome']
        frames: list[Frame] = []
        durations: list[int] = []
        beam_count = 0
        if self.animate:
            frames.append(render(level, self.level_state, range(self.levels_completed)))
            durations.append(self.frame_interval_ms)
            while self.level_state['status'] == 'FIRING':
                self.level_state = animation_step(level, self.level_state)
                done = self.levels_completed + (1 if self.level_state['status'] == 'WIN' else 0)
                frames.append(render(level, self.level_state, range(done)))
                durations.append(self.frame_interval_ms)
            beam_count = len(frames)
        else:
            self.level_state = transition(level, self.level_state, {'type': 'tick', 'count': trace['totalTicks']})
        if self.level_state['status'] == 'FAILING':
            if self.animate:
                durations[-1] = FAILURE_FLASH_MS
            self.level_state = animation_step(level, self.level_state)
            self.last_event = self.level_state['lastEvent']
        elif self.level_state['status'] == 'WIN':
            self.levels_completed = self.level_index+1
            if self.animate:
                # The final beam image is already green: use it as the first pulse.
                durations[-1] = SUCCESS_FRAME_MS
                for color in SUCCESS_COLORS[1:]:
                    frames.append(render(level, self.level_state, range(self.levels_completed), {'outline': color}))
                    durations.append(SUCCESS_FRAME_MS)
            self.last_event = 'LEVEL_COMPLETE'
            if self.levels_completed == self.win_levels:
                self.state, self.last_event = 'WIN', 'GAME_WON'
            elif self.auto_advance:
                self.level_index += 1
                self.level_steps = 0
                self.level_state = create_state(self.levels[self.level_index])
        result = self.public_state()
        result.update(last_shot_outcome=shot_outcome, shot_frame_count=beam_count,
                      shot_animation_frames=animation_frame_count(trace),
                      shot_simulation_ticks=trace['totalTicks'])
        if self.animate:
            if not frames or frames[-1] != result['frame']:
                frames.append(result['frame'])
                durations.append(self.frame_interval_ms)
            result.update(frames=frames, frame_count=len(frames), frame_durations_ms=durations,
                          transition_frame_interval_ms=self.frame_interval_ms)
        return result

    def public_state(self) -> dict[str, Any]:
        level, s = self.levels[self.level_index], self.level_state
        frame = render(level, s, range(self.levels_completed))
        available = [7] if self.state == 'WIN' else [3, 4, 5, 6, 7]
        return {
            'backend': 'custom', 'selected': True,
            'game_id': getattr(self.info, 'game_id', 'selene'), 'title': getattr(self.info, 'title', 'SÉLÈNE'),
            'frame': frame, 'frames': [frame], 'frame_count': 1,
            'frame_durations_ms': [self.frame_interval_ms], 'transition_frame_interval_ms': self.frame_interval_ms,
            'default_fps': getattr(self.info, 'default_fps', 8),
            'state': self.state, 'level': self.level_index+1, 'levels_completed': self.levels_completed,
            'win_levels': self.win_levels, 'step_index': self.step_index, 'level_steps': self.level_steps,
            'available_actions': [f'ACTION{i}' for i in available], 'available_action_ids': available,
            'last_action': self.last_action, 'last_event': self.last_event,
            'score': self.levels_completed, 'full_reset': False, 'source_path': str(LEVELS_DIR),
            'custom_family': getattr(self.info, 'family', 'custom'), 'level_name': level['title'],
            'level_status': s['status'], 'selected_moon': s['selected'],
            'rotations': s['rotations'], 'launches': s['launches'],
            'activated_relays': len(status_at(s['trace'], s['tick'])['activated']),
            'animation_stride': ANIMATION_STRIDE, 'palette': list(PALETTE),
        }
