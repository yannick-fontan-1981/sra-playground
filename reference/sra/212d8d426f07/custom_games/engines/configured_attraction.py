"""CATR — Configured Attraction, faithful native port of web v1.1.

Python 3.10+, standard library only. No Tk, JavaScript, network, timer or solver
is required by this engine. The optional play.py provides a Tk raster viewer.
The six authored levels are embedded; levels/ is an identical external copy.

ACTION6: click a control wall in native 64x64 coordinates.
ACTION7: restart the current level. RESET / 0: restart the whole campaign.
One click toggles a symmetric attraction/repulsion relation. All chambers
settle together. A target is checked only at the final resting position.
The miniature 2x2 cubes retain the v1.1 (+1,+1) drawing correction.

Public packets preserve web keys, ordered frames, frame durations and counters.
Pure functions and snapshot/restore are developer helpers, not an agent solver.
This is a custom-backend adapter, not an official SDK registration.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Sequence
import json
import math

SIZE = FRAME = 64
PITCH, MINI = 12, 8
GAME_ID, FAMILY, WAVE, REVISION = 'catr-c3000001', 'configured_attraction', 'custom_3', 'v1.1'
FPS = 30
PALETTE = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
           '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
           '#FF851B', '#921231', '#4FCC30', '#A356D6']
SIDES = [[0, 1], [2, 3], [0, 2], [1, 3]]
INKS = [6, 9, 11, 12, 14, 15]
ACTION_CLICK, ACTION_RESET = 6, 7
Level = dict[str, Any]
State = dict[str, Any]
Raster = list[list[int]]

LEVELS = [{'id': 'L01', 'title': 'Les quatre chambres', 'width': 2, 'height': 2, 'rooms': [12, 11, 9, 6], 'panels': [[9, 12, 6, 11]], 'initial': [1, 0, 1, 1], 'targets': [{'room': 0, 'position': [2, 2]}, {'room': 1, 'position': [0, 2]}, {'room': 3, 'position': [0, 0]}], 'version': 1, 'revision': 'v1.0'}, {'id': 'L02', 'title': 'Une règle, plusieurs voisins', 'width': 4, 'height': 2, 'rooms': [12, 11, 15, 14, 9, 6, 11, 9], 'panels': [[9, 12, 6, 11], [9, 14, 11, 15]], 'initial': [0, 0, 1, 1, 0, 1, 0, 0], 'targets': [{'room': 1, 'position': [0, 0]}, {'room': 3, 'position': [0, 2]}, {'room': 4, 'position': [2, 0]}, {'room': 5, 'position': [0, 2]}, {'room': 7, 'position': [2, 0]}], 'version': 1, 'revision': 'v1.0'}, {'id': 'L03', 'title': 'Trouver le milieu', 'width': 3, 'height': 3, 'rooms': [9, 12, 11, 14, 9, 6, 15, 11, 9], 'panels': [[9, 12, 6, 11], [9, 14, 11, 15]], 'initial': [1, 0, 1, 0, 0, 0, 1, 0], 'targets': [{'room': 0, 'position': [2, 0]}, {'room': 1, 'position': [1, 2]}, {'room': 2, 'position': [0, 0]}, {'room': 4, 'position': [2, 0]}, {'room': 6, 'position': [2, 2]}], 'version': 1, 'revision': 'v1.0'}, {'id': 'L04', 'title': 'Défaire pour rétablir', 'width': 4, 'height': 3, 'rooms': [11, 9, 6, 14, 6, 14, 15, 12, 14, 12, 11, 9], 'panels': [[9, 12, 6, 11], [9, 14, 11, 15], [12, 14, 15, 6]], 'initial': [0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0], 'targets': [{'room': 1, 'position': [1, 0]}, {'room': 4, 'position': [0, 0]}, {'room': 5, 'position': [2, 2]}, {'room': 6, 'position': [0, 0]}, {'room': 7, 'position': [2, 0]}, {'room': 9, 'position': [1, 0]}, {'room': 10, 'position': [1, 2]}], 'version': 1, 'revision': 'v1.0'}, {'id': 'L05', 'title': 'Les équilibres croisés', 'width': 4, 'height': 3, 'rooms': [11, 9, 14, 15, 15, 6, 9, 12, 12, 11, 6, 14], 'panels': [[9, 12, 6, 11], [9, 14, 11, 15], [12, 14, 15, 6]], 'initial': [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 0], 'targets': [{'room': 1, 'position': [0, 0]}, {'room': 2, 'position': [1, 0]}, {'room': 4, 'position': [2, 1]}, {'room': 5, 'position': [0, 2]}, {'room': 7, 'position': [2, 1]}, {'room': 9, 'position': [2, 0]}, {'room': 11, 'position': [2, 0]}], 'version': 1, 'revision': 'v1.0'}, {'id': 'L06', 'title': 'Accord général', 'width': 5, 'height': 3, 'rooms': [11, 6, 15, 12, 11, 15, 14, 6, 9, 12, 14, 9, 11, 6, 14], 'panels': [[9, 12, 6, 11], [9, 14, 11, 15], [12, 14, 15, 6]], 'initial': [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], 'targets': [{'room': 0, 'position': [0, 0]}, {'room': 3, 'position': [1, 2]}, {'room': 6, 'position': [1, 1]}, {'room': 7, 'position': [2, 1]}, {'room': 9, 'position': [0, 2]}, {'room': 11, 'position': [2, 2]}, {'room': 13, 'position': [1, 0]}, {'room': 14, 'position': [2, 0]}], 'version': 1, 'revision': 'v1.0'}]
DEFAULT_LEVELS = LEVELS


def integer(value: Any) -> bool:
    """JavaScript-safe integral JSON numbers; booleans are not numbers here."""
    return (type(value) in (int, float) and abs(value) <= 9007199254740991
            and math.isfinite(value) and int(value) == value)


def _require(condition: Any, message: str) -> None:
    if not condition:
        raise ValueError(message)


def pair(a: int, b: int) -> str:
    return f'{min(a, b)}:{max(a, b)}'


def validate_level(raw: Level) -> Level:
    """Copy and validate an authored level; never mutate the caller's data."""
    _require(isinstance(raw, dict), 'Niveau invalide.')
    l = deepcopy(raw)
    _require(isinstance(l.get('id'), str) and isinstance(l.get('title'), str),
             'Identité de niveau absente.')
    _require(integer(l.get('width')) and 2 <= l['width'] <= 5
             and integer(l.get('height')) and 2 <= l['height'] <= 3,
             'Grille : 2–5 colonnes et 2–3 rangées.')
    l['width'], l['height'] = int(l['width']), int(l['height'])
    _require(isinstance(l.get('rooms'), list) and len(l['rooms']) == l['width']*l['height']
             and all(integer(v) and v in INKS for v in l['rooms']),
             'Une couleur de cube par salle.')
    l['rooms'] = [int(v) for v in l['rooms']]
    _require(isinstance(l.get('panels'), list) and 1 <= len(l['panels']) <= 3,
             'Un à trois blocs de réglage.')
    seen = set()
    for p in l['panels']:
        _require(isinstance(p, list) and len(p) == 4
                 and all(integer(v) and v in INKS for v in p) and len(set(p)) == 4,
                 'Chaque bloc a quatre couleurs distinctes.')
        p[:] = [int(v) for v in p]
        for a, b in SIDES:
            key = pair(p[a], p[b])
            _require(key not in seen, 'Paire de couleurs dupliquée dans les réglages.')
            seen.add(key)
    _require(isinstance(l.get('initial'), list) and len(l['initial']) == len(l['panels'])*4
             and all(integer(v) and v in (0, 1) for v in l['initial']),
             'Réglages binaires manquants.')
    l['initial'] = [int(v) for v in l['initial']]
    used = set()
    for r in range(len(l['rooms'])):
        for d, yes in ((1, r % l['width'] < l['width']-1),
                       (l['width'], r // l['width'] < l['height']-1)):
            if yes:
                key = pair(l['rooms'][r], l['rooms'][r+d])
                _require(l['rooms'][r] != l['rooms'][r+d] and key in seen,
                         'Voisinage sans commande de couleur.')
                used.add(key)
    _require(used == seen, 'Un réglage ne commande aucune paroi du plateau.')
    _require(isinstance(l.get('targets'), list) and len(l['targets']) >= 2,
             'Au moins deux cibles, une au maximum par salle.')
    rooms = set()
    for t in l['targets']:
        _require(isinstance(t, dict) and integer(t.get('room'))
                 and 0 <= t['room'] < len(l['rooms'])
                 and isinstance(t.get('position'), list) and len(t['position']) == 2
                 and all(integer(v) and 0 <= v <= 2 for v in t['position']),
                 'Cible hors des neuf positions.')
        _require(t['room'] not in rooms, 'Deux cibles dans la même salle.')
        rooms.add(t['room'])
        t['room'] = int(t['room'])
        t['position'] = [int(v) for v in t['position']]
    return l


def load_levels(path: str | Path) -> list[Level]:
    """Explicit external loading; default runtime uses only embedded levels."""
    p = Path(path)
    if p.is_dir():
        paths = sorted(p.glob('L*.json'))
        if not paths:
            raise FileNotFoundError(f'Aucun fichier L*.json dans {p}')
        raw = [json.loads(f.read_text(encoding='utf-8')) for f in paths]
    else:
        raw = json.loads(p.read_text(encoding='utf-8'))
    _require(isinstance(raw, list) and 1 <= len(raw) <= 6, 'Un à six niveaux requis.')
    return [validate_level(l) for l in raw]


def compile(l: Level) -> dict:
    """Build the symmetric relation index and shared-wall adjacency map."""
    rules, index = [], {}
    for block, p in enumerate(l['panels']):
        for side, (a, b) in enumerate(SIDES):
            index[pair(p[a], p[b])] = len(rules)
            rules.append({'a': p[a], 'b': p[b], 'block': block, 'side': side})
    edges = []
    incident = [[] for _ in l['rooms']]
    for y in range(l['height']):
        for x in range(l['width']):
            for dx, dy in ((1, 0), (0, 1)):
                if x+dx < l['width'] and y+dy < l['height']:
                    a = x+y*l['width']
                    b = a+dx+dy*l['width']
                    e = {'a': a, 'b': b, 'dx': dx, 'dy': dy,
                         'rule': index[pair(l['rooms'][a], l['rooms'][b])]}
                    edges.append(e)
                    incident[a].append(e)
                    incident[b].append(e)
    return {'rules': rules, 'index': index, 'edges': edges, 'incident': incident}


def positions(l: Level, settings: Sequence[int], c: dict | None = None) -> list[list[int]]:
    c = compile(l) if c is None else c
    forces = [[0, 0] for _ in l['rooms']]
    for e in c['edges']:
        force = 1 if settings[e['rule']] == 0 else -1
        for axis, delta in enumerate((e['dx'], e['dy'])):
            forces[e['a']][axis] += force*delta
            forces[e['b']][axis] -= force*delta
    return [[1+(x > 0)-(x < 0), 1+(y > 0)-(y < 0)] for x, y in forces]


def panel_positions(l: Level, settings: Sequence[int]) -> list[list[list[int]]]:
    result = []
    for block, p in enumerate(l['panels']):
        forces = [[0, 0] for _ in p]
        for j, (a, z) in enumerate(SIDES):
            dx, dy = z % 2-a % 2, z // 2-a // 2
            force = 1 if settings[block*4+j] == 0 else -1
            forces[a][0] += dx*force
            forces[a][1] += dy*force
            forces[z][0] -= dx*force
            forces[z][1] -= dy*force
        result.append([[int(x > 0), int(y > 0)] for x, y in forces])
    return result


def matched(l: Level, settings: Sequence[int], c: dict | None = None) -> list[bool]:
    ps = positions(l, settings, c)
    return [ps[t['room']] == t['position'] for t in l['targets']]


def solved(l: Level, settings: Sequence[int], c: dict | None = None) -> bool:
    return all(matched(l, settings, c))


def initial(l: Level) -> State:
    return {'settings': l['initial'][:], 'moves': 0, 'last': -1}


def transition(l: Level, s: State, rule: int, c: dict | None = None) -> dict:
    if not integer(rule) or not 0 <= rule < len(s['settings']):
        return {'state': deepcopy(s), 'event': 'ignored'}
    rule = int(rule)
    n = deepcopy(s)
    n['settings'][rule] ^= 1
    n['moves'] += 1
    n['last'] = rule
    return {'state': n, 'event': 'success' if solved(l, n['settings'], c) else 'configure',
            'rule': rule}


def origin(l: Level) -> list[int]:
    return [(64-(l['width']*PITCH+1))//2, 2+(37-(l['height']*PITCH+1))//2]


def room_center(l: Level, room: int, pos: Sequence[int]) -> list[int]:
    ox, oy = origin(l)
    return [ox+(room % l['width'])*PITCH+3+3*pos[0],
            oy+(room // l['width'])*PITCH+3+3*pos[1]]


def panel_origins(l: Level) -> list[list[int]]:
    count = len(l['panels'])
    start = (64-(count*17+(count-1)*4))//2
    return [[start+i*21, 43] for i in range(count)]


def control_points(l: Level) -> list[list[int]]:
    return [point for x, y in panel_origins(l)
            for point in ([x+8, y+4], [x+8, y+12], [x+4, y+8], [x+12, y+8])]


def hit(l: Level, x: int, y: int) -> int | None:
    for k, (cx, cy) in enumerate(control_points(l)):
        if k % 4 < 2:
            inside = abs(x-cx) <= 1 and abs(y-cy) <= 2
        else:
            inside = abs(x-cx) <= 2 and abs(y-cy) <= 1
        if inside:
            return k
    return None


def mini_coordinates(l: Level, settings: Sequence[int]) -> list[list[list[int]]]:
    origins = panel_origins(l)
    return [[[origins[b][0]+(r % 2)*8+2+3*u,
              origins[b][1]+(r // 2)*8+2+3*v] for r, (u, v) in enumerate(p)]
            for b, p in enumerate(panel_positions(l, settings))]


def render(l: Level, s: State, completed: list[bool] | None = None,
           o: dict | None = None, c: dict | None = None) -> Raster:
    """Exact web v1.1 raster; integer pixels, no text or anti-aliasing."""
    completed = [False]*6 if completed is None else completed
    o = {} if o is None else o
    c = compile(l) if c is None else c
    f = [[5]*64 for _ in range(64)]

    def fill(x: int, y: int, w: int, h: int, ink: int) -> None:
        for yy in range(max(0, y), min(64, y+h)):
            for xx in range(max(0, x), min(64, x+w)):
                f[yy][xx] = ink

    def box(x: int, y: int, w: int, h: int, ink: int) -> None:
        fill(x, y, w, 1, ink)
        fill(x, y+h-1, w, 1, ink)
        fill(x, y, 1, h, ink)
        fill(x+w-1, y, 1, h, ink)

    ox, oy = origin(l)
    ps = positions(l, s['settings'], c)
    coords = o.get('main')
    if coords is None:
        coords = [room_center(l, i, p) for i, p in enumerate(ps)]
    for y in range(l['height']+1):
        fill(ox, oy+y*PITCH, l['width']*PITCH+1, 1, 3)
    for x in range(l['width']+1):
        fill(ox+x*PITCH, oy, 1, l['height']*PITCH+1, 3)
    for r in range(len(l['rooms'])):
        for y in range(3):
            for x in range(3):
                cx, cy = room_center(l, r, [x, y])
                fill(cx, cy, 1, 1, 4)
    for t in l['targets']:
        cx, cy = room_center(l, t['room'], t['position'])
        at = not o.get('moving', False) and ps[t['room']] == t['position']
        box(cx-2, cy-2, 5, 5, 14 if at else 0)
    for r, ink in enumerate(l['rooms']):
        cx, cy = coords[r]
        fill(cx-1, cy-1, 3, 3, ink)
    if 'pulse' in o:
        for e in c['edges']:
            if e['rule'] == o['pulse']:
                x, y = ox+(e['a'] % l['width'])*PITCH, oy+(e['a'] // l['width'])*PITCH
                if e['dx']:
                    fill(x+PITCH, y+5, 1, 3, 0)
                else:
                    fill(x+5, y+PITCH, 3, 1, 0)
    fill(2, 41, 60, 1, 4)
    mini = panel_positions(l, s['settings'])
    for b, (x, y) in enumerate(panel_origins(l)):
        for k in range(3):
            fill(x+k*MINI, y, 1, 17, 3)
            fill(x, y+k*MINI, 17, 1, 3)
        for r in range(4):
            for iy in range(2):
                for ix in range(2):
                    fill(x+(r % 2)*8+2+3*ix, y+(r // 2)*8+2+3*iy, 1, 1, 4)
        for j in range(4):
            k = b*4+j
            cx = x+(8 if j < 2 else 4 if j == 2 else 12)
            cy = y+((4 if j == 0 else 12) if j < 2 else 8)
            ink = 10 if s['settings'][k] == 0 else 12
            if j < 2:
                fill(cx, cy-2, 1, 5, ink)
            else:
                fill(cx-2, cy, 5, 1, ink)
            if s['last'] == k:
                if j < 2:
                    fill(cx, cy-3, 1, 1, 0)
                    fill(cx, cy+3, 1, 1, 0)
                else:
                    fill(cx-3, cy, 1, 1, 0)
                    fill(cx+3, cy, 1, 1, 0)
        for r in range(4):
            px = x+(r % 2)*8+2+3*mini[b][r][0]
            py = y+(r // 2)*8+2+3*mini[b][r][1]
            p = o['mini'][b][r] if o.get('mini') is not None else [px, py]
            # v1.1: use the top-left coordinate directly, not p - (1,1).
            fill(p[0], p[1], 2, 2, l['panels'][b][r])
    for i in range(6):
        fill(2+i*6, 63, 5, 1, 14 if completed[i] else 4)
    if 'border' in o:
        box(0, 0, 64, 62, o['border'])
    return f


SNAP_KEYS = ('completed', 'index', 'local', 'state', 'total_actions', 'step_index',
             'restarts', 'test_mode', 'last_event')


class ConfiguredAttractionEngine:
    """Synchronous custom ARC3-style controller. Default: six embedded levels."""

    def __init__(self, info: Any = None, *, levels: list[Level] | None = None,
                 levels_dir: str | Path | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Utiliser levels ou levels_dir, pas les deux.')
        raw = load_levels(levels_dir) if levels_dir is not None else (LEVELS if levels is None else levels)
        _require(isinstance(raw, list) and 1 <= len(raw) <= 6, 'Un à six niveaux requis.')
        self.levels = [validate_level(l) for l in raw]
        self.maps = [compile(l) for l in self.levels]
        self.animate = bool(animate)
        self.game_id = getattr(info, 'game_id', GAME_ID) if info is not None else GAME_ID
        self.title = getattr(info, 'title', 'Configured Attraction') if info is not None else 'Configured Attraction'
        self.reset()

    def setup(self, index: int) -> None:
        self.index = index
        self.local = initial(self.levels[index])
        self.state = 'NOT_FINISHED'

    def observe(self) -> dict:
        l = self.levels[self.index]
        frame = render(l, self.local, self.completed, {}, self.maps[self.index])
        ids = [6, 7] if self.state == 'NOT_FINISHED' else [7]
        count = sum(self.completed)
        return {
            'game_id': self.game_id, 'title': self.title, 'custom_family': FAMILY,
            'wave': WAVE, 'revision': REVISION, 'state': self.state,
            'level': self.index+1, 'levels_completed': count, 'win_levels': len(self.levels),
            'score': count, 'frame': frame, 'frames': [frame], 'frame_count': 1,
            'frame_durations_ms': [0], 'palette': PALETTE[:], 'default_fps': FPS,
            'available_action_ids': ids, 'available_actions': [f'ACTION{i}' for i in ids],
            'total_actions': self.total_actions, 'step_index': self.step_index,
            'level_actions': self.local['moves'], 'restarts': self.restarts,
            'test_mode': self.test_mode, 'last_event': self.last_event,
        }

    def packet(self, event: str, frames: list[Raster] | None = None,
               ds: list[int] | None = None, extra: dict | None = None) -> dict:
        self.last_event = event
        r = dict(self.observe(), event=event, **(extra or {}))
        if frames:
            r.update(frame=frames[-1], frames=frames, frame_count=len(frames),
                     frame_durations_ms=ds)
        return r

    def reset(self) -> dict:
        self.completed = [False]*6
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
        _require(integer(number) and 1 <= number <= len(self.levels), 'Niveau invalide.')
        self.reset()
        self.test_mode = True
        self.setup(int(number)-1)
        return self.packet('preview')

    def snapshot(self) -> dict:
        return {k: deepcopy(getattr(self, k)) for k in SNAP_KEYS}

    def restore(self, snapshot: Mapping[str, Any]) -> None:
        # A reader-only snapshot, produced by this engine with the same levels.
        values = {k: deepcopy(snapshot[k]) for k in SNAP_KEYS}
        for k, v in values.items():
            setattr(self, k, v)

    def action(self, aid: Any, data: Mapping[str, Any] | None = None) -> dict:
        if isinstance(aid, Mapping):
            data = aid.get('data')
            aid = next((aid[k] for k in ('id', 'action_ref', 'action') if aid.get(k) is not None), None)
        if aid == 'RESET' or (integer(aid) and aid == 0):
            return self.reset()
        if aid == 'ACTION6':
            aid = 6
        elif aid == 'ACTION7':
            aid = 7
        if integer(aid) and aid == 7:
            return self.level_reset()
        if (not integer(aid) or aid != 6 or self.state != 'NOT_FINISHED'
                or not isinstance(data, Mapping) or not integer(data.get('x'))
                or not integer(data.get('y')) or not 0 <= data['x'] < 64
                or not 0 <= data['y'] < 64):
            return self.packet('ignored')
        l, c = self.levels[self.index], self.maps[self.index]
        rule = hit(l, int(data['x']), int(data['y']))
        if rule is None:
            return self.packet('ignored')
        self.total_actions += 1
        self.step_index += 1
        before = deepcopy(self.local)
        r = transition(l, before, rule, c)
        self.local = r['state']
        frames, ds = [], []
        if self.animate:
            a = [room_center(l, i, p) for i, p in enumerate(positions(l, before['settings'], c))]
            b = [room_center(l, i, p) for i, p in enumerate(positions(l, self.local['settings'], c))]
            ma, mb = mini_coordinates(l, before['settings']), mini_coordinates(l, self.local['settings'])
            steps = max(3, max(abs(b[i][j]-a[i][j]) for i in range(len(a)) for j in (0, 1)))

            def blend(u: list[int], v: list[int], k: int) -> list[int]:
                # Match JS Math.round, including a decreasing coordinate at .5.
                return [math.floor(n+(v[i]-n)*k/steps+0.5) for i, n in enumerate(u)]

            for k in range(1, steps+1):
                main = [blend(v, b[i], k) for i, v in enumerate(a)]
                mini = [[blend(v, mb[j][i], k) for i, v in enumerate(p)] for j, p in enumerate(ma)]
                options = {'main': main, 'mini': mini, 'moving': k < steps}
                if k <= 2:
                    options['pulse'] = rule
                frames.append(render(l, self.local, self.completed, options, c))
                ds.append(40)
            frames.append(render(l, self.local, self.completed, {}, c))
            ds.append(80)
        extra = {'cost': 1, 'played_level': self.index+1, 'rule': rule}
        event = r['event']
        if event == 'success':
            if self.animate:
                for _ in range(3):
                    frames.append(render(l, self.local, self.completed, {'border': 14}, c))
                    ds.append(170)
                    frames.append(render(l, self.local, self.completed, {}, c))
                    ds.append(110)
            self.completed[self.index] = True
            if self.test_mode:
                self.state = 'LEVEL_COMPLETE'
            elif self.index+1 == len(self.levels):
                self.state = 'WIN'
            else:
                self.setup(self.index+1)
            event = 'win' if self.state == 'WIN' else 'success'
        frames.append(self.observe()['frame'])
        ds.append(0)
        return self.packet(event, frames, ds, extra)

    step = action
    public_state = observe
    levelReset = level_reset
    jumpToLevel = jump_to_level


# Aliases retained for direct comparison with the web source.
Engine = AttractionEngine = ConfiguredAttractionEngine
validateLevel = validate_level
panelPositions = panel_positions
roomCenter = room_center
panelOrigins = panel_origins
controlPoints = control_points
miniCoordinates = mini_coordinates

if __name__ == '__main__':
    print(json.dumps(ConfiguredAttractionEngine().observe(), ensure_ascii=False))
