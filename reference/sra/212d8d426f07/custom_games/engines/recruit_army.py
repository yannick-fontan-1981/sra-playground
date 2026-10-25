"""RECR — Recruit Army, faithful Python port of the accepted web v1.1.

Python 3.10+, standard library only. No browser, Tk, random generator, timer,
network or solver is used by this module. The optional Tk player is play.py.

ACTION5 resolves the entire current battle. ACTION6 clicks a recruitment button
or the native fight button. ACTION7 resets the level; RESET / 0 resets the
campaign. The final room has no prison and wins immediately with a survivor.

Frames are 64x64 palette-index lists (0..15), including ordered intermediate
images and their durations. Runtime state is JSON-compatible. Test oracles and
JavaScript references are never imported by the engine.
"""
from __future__ import annotations

from collections.abc import Mapping
from copy import deepcopy
import json
import math
from pathlib import Path
from typing import Any

SIZE = FRAME = 64
FPS = 25
GAME_ID, FAMILY, WAVE, REVISION = 'recr-c3000001', 'recruit_army', 'custom_3', 'v1.1'
PALETTE = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
           '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
           '#FF851B', '#921231', '#4FCC30', '#A356D6']
# Role order: helicopter > tank > infantry > helicopter.
# Button order is H / I / T, matching the accepted web version.
ALLY, ENEMY = [10, 15, 9], [11, 8, 12]
NAMES = ['hélicoptère', 'char', 'infanterie']
ROLE_BUTTONS = [{'role': 0, 'x': 12, 'y': 50, 'w': 8, 'h': 10},
                {'role': 2, 'x': 22, 'y': 50, 'w': 8, 'h': 10},
                {'role': 1, 'x': 32, 'y': 50, 'w': 8, 'h': 10}]
FIGHT_BUTTON = {'x': 2, 'y': 44, 'w': 8, 'h': 15}
QUEUE_PATH = [[0,0], [1,0], [2,0], [3,0], [3,1], [3,2], [3,3], [2,3],
              [1,3], [0,3], [0,2], [0,1], [1,1], [2,1], [2,2], [1,2]]
LEVELS = [{'id': 'L01',
  'title': 'Le premier renfort',
  'army': [0, 0],
  'rooms': [{'enemy': [1], 'prisoners': 1}, {'enemy': [2, 2], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'},
 {'id': 'L02',
  'title': 'Choisir le bon renfort',
  'army': [2, 1, 2],
  'rooms': [{'enemy': [0, 0, 2], 'prisoners': 2},
            {'enemy': [0, 0, 1, 2, 2], 'prisoners': 1},
            {'enemy': [2, 2], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'},
 {'id': 'L03',
  'title': 'L’ordre des recrues',
  'army': [2, 2, 0],
  'rooms': [{'enemy': [2, 2], 'prisoners': 2},
            {'enemy': [1, 2], 'prisoners': 1},
            {'enemy': [1, 0, 0], 'prisoners': 1},
            {'enemy': [2, 0], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'},
 {'id': 'L04',
  'title': 'Conserver le spécialiste',
  'army': [0, 1, 1, 0],
  'rooms': [{'enemy': [1, 1, 0], 'prisoners': 2},
            {'enemy': [2, 1, 0, 1], 'prisoners': 2},
            {'enemy': [0, 2, 2, 0, 0], 'prisoners': 1},
            {'enemy': [0, 0, 0, 2, 2, 2, 2], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'},
 {'id': 'L05',
  'title': 'Préparer la salle suivante',
  'army': [0, 1, 2, 0],
  'rooms': [{'enemy': [2, 2], 'prisoners': 2},
            {'enemy': [2, 0], 'prisoners': 2},
            {'enemy': [2, 0, 2, 1, 2, 2], 'prisoners': 1},
            {'enemy': [2, 2, 2, 0, 0, 2], 'prisoners': 2},
            {'enemy': [1, 1], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'},
 {'id': 'L06',
  'title': 'La chaîne des libérations',
  'army': [2, 0, 1, 0],
  'rooms': [{'enemy': [0, 2], 'prisoners': 2},
            {'enemy': [2, 0, 0], 'prisoners': 2},
            {'enemy': [0, 0], 'prisoners': 2},
            {'enemy': [2, 0, 1, 1], 'prisoners': 1},
            {'enemy': [1, 1, 2, 2, 1, 2], 'prisoners': 2},
            {'enemy': [0, 0, 0, 2], 'prisoners': 0}],
  'version': 2,
  'revision': 'v1.1'}]
DEFAULT_LEVELS = LEVELS
LEVEL_COUNT = len(LEVELS)
Raster = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]


def integer(value: Any) -> bool:
    """Number.isSafeInteger semantics for JSON input; booleans are not numbers."""
    return (type(value) in (int, float) and abs(value) <= 9007199254740991
            and (type(value) is int or (math.isfinite(value) and value.is_integer())))


def _require(condition: Any, message: str) -> None:
    if not condition:
        raise ValueError(message)


def valid_role(value: Any) -> bool:
    return integer(value) and 0 <= value < 3


def beats(a: int, b: int) -> bool:
    return (a + 1) % 3 == b


def inside(rect: Mapping[str, int], x: int, y: int) -> bool:
    return rect['x'] <= x < rect['x']+rect['w'] and rect['y'] <= y < rect['y']+rect['h']


def validate_level(raw: Any) -> Level:
    _require(isinstance(raw, Mapping), 'Niveau invalide.')
    l = deepcopy(dict(raw))
    _require(isinstance(l.get('id'), str) and isinstance(l.get('title'), str),
             'Identité de niveau absente.')
    _require(isinstance(l.get('army'), list) and 1 <= len(l['army']) <= 8
             and all(valid_role(v) for v in l['army']), 'Armée de départ invalide.')
    _require(isinstance(l.get('rooms'), list) and 2 <= len(l['rooms']) <= 6,
             'Deux à six salles requises.')
    bound = len(l['army'])
    l['army'] = [int(v) for v in l['army']]
    for i, r in enumerate(l['rooms']):
        _require(isinstance(r, dict) and isinstance(r.get('enemy'), list)
                 and 1 <= len(r['enemy']) <= 16 and all(valid_role(v) for v in r['enemy']),
                 'Escouade ennemie invalide.')
        p = r.get('prisoners')
        _require(integer(p) and (p == 0 if i == len(l['rooms'])-1 else 1 <= p <= 3),
                 'Une à trois recrues par prison ; aucune prison dans la dernière salle.')
        r['prisoners'] = int(p)
        r['enemy'] = [int(v) for v in r['enemy']]
        bound += p
    _require(bound <= 16, 'La réserve théorique dépasse les seize emplacements visibles.')
    return l


def load_levels(path: str | Path) -> list[Level]:
    """Read explicitly requested level data; no implicit external dependency."""
    root = Path(path)
    if root.is_file():
        data = json.loads(root.read_text(encoding='utf-8'))
        _require(isinstance(data, list), 'Le fichier doit contenir une liste de niveaux.')
    else:
        paths = sorted(root.glob('L*.json'))
        if not paths:
            raise FileNotFoundError(f'Aucun niveau L*.json dans {root}')
        data = [json.loads(p.read_text(encoding='utf-8')) for p in paths]
    _require(1 <= len(data) <= 6, 'Un à six niveaux requis.')
    return [validate_level(l) for l in data]


def initial(l: Level) -> State:
    return {'room': 0, 'army': l['army'][:], 'phase': 'combat', 'pending': 0,
            'cleared': [False]*len(l['rooms']), 'roles': [[] for _ in l['rooms']],
            'battles': 0, 'recruits': 0}


def duel(a: int, b: int) -> str:
    return 'mutual' if a == b else 'ally' if beats(a, b) else 'enemy'


def battle(army: list[int], enemies: list[int]) -> dict:
    """Resolve ordered front-to-front duels. Input lists are never mutated."""
    a, e, trace = army[:], enemies[:], []
    while a and e:
        before_army, before_enemy = a[:], e[:]
        winner = duel(a[0], e[0])
        if winner != 'ally':
            a.pop(0)
        if winner != 'enemy':
            e.pop(0)
        trace.append({'beforeArmy': before_army, 'beforeEnemy': before_enemy,
                      'winner': winner, 'army': a[:], 'enemy': e[:]})
    return {'army': a, 'enemy': e, 'trace': trace, 'won': bool(a) and not e}


def transition(l: Level, s: State, cmd: Mapping | None) -> dict:
    """Pure single-command transition; campaign handling lives in the controller."""
    n = deepcopy(s)
    if not isinstance(cmd, Mapping) or cmd.get('kind') not in ('fight', 'recruit'):
        return {'state': n, 'event': 'ignored', 'cost': 0}
    if cmd['kind'] == 'fight':
        if s['phase'] != 'combat':
            return {'state': n, 'event': 'assign_first', 'cost': 0}
        result = battle(s['army'], l['rooms'][s['room']]['enemy'])
        n['battles'] += 1
        n['army'] = result['army']
        if not result['won']:
            return {'state': n, 'event': 'defeat', 'cost': 1, 'result': result}
        n['cleared'][s['room']] = True
        if s['room'] == len(l['rooms'])-1:
            n['phase'], n['pending'] = 'complete', 0
            return {'state': n, 'event': 'success', 'cost': 1, 'result': result}
        n['phase'], n['pending'] = 'recruit', l['rooms'][s['room']]['prisoners']
        return {'state': n, 'event': 'liberated', 'cost': 1, 'result': result}
    if s['phase'] != 'recruit' or s['pending'] <= 0 or not valid_role(cmd.get('role')):
        return {'state': n, 'event': 'ignored', 'cost': 0}
    role = int(cmd['role'])
    n['army'].append(role)
    n['roles'][s['room']].append(role)
    n['pending'] -= 1
    n['recruits'] += 1
    if n['pending']:
        return {'state': n, 'event': 'recruited', 'cost': 1, 'role': role}
    n['room'] += 1
    n['phase'] = 'combat'
    return {'state': n, 'event': 'advance', 'cost': 1, 'role': role}


def room_rects(l: Level) -> list[dict[str, int]]:
    count = len(l['rooms'])
    cols = count if count <= 3 else 2 if count == 4 else 3
    rows = (count+cols-1)//cols
    start, top = (64-(cols*19+(cols-1)*2))//2, 12 if rows == 1 else 2
    rects = []
    for i in range(count):
        row = i//cols
        col = cols-1-i%cols if row%2 else i%cols
        rects.append({'x': start+21*col, 'y': top+20*row, 'w': 19, 'h': 18})
    return rects


def unit_point(rect: Mapping[str, int], index: int, side: str) -> list[int]:
    _require(integer(index) and 0 <= index < len(QUEUE_PATH), 'Emplacement d’unité hors de la file.')
    col, row = QUEUE_PATH[int(index)]
    return [rect['x']+(7-2*col if side == 'ally' else 10+2*col), rect['y']+3+2*row]


def prisoner_point(rect: Mapping[str, int], index: int) -> list[int]:
    return [rect['x']+4+4*index, rect['y']+14]


def hit(l: Level, s: State, x: int, y: int) -> dict | None:
    if inside(FIGHT_BUTTON, x, y):
        return {'kind': 'fight'}
    for b in ROLE_BUTTONS:
        if inside(b, x, y):
            return {'kind': 'recruit', 'role': b['role']}
    return None


def render(l: Level, s: State, completed: list[bool] | None = None,
           o: dict | None = None) -> Raster:
    """Pixel-exact port of the v1.1 raster, including all animation options."""
    completed = [False]*6 if completed is None else completed
    o = {} if o is None else o
    f = [[5]*64 for _ in range(64)]

    def fill(x: int, y: int, w: int, h: int, ink: int) -> None:
        for yy in range(max(0, y), min(64, y+h)):
            for xx in range(max(0, x), min(64, x+w)):
                f[yy][xx] = ink

    def box(x: int, y: int, w: int, h: int, ink: int) -> None:
        fill(x,y,w,1,ink); fill(x,y+h-1,w,1,ink)
        fill(x,y,1,h,ink); fill(x+w-1,y,1,h,ink)

    def glyph(rows: list[str], x: int, y: int, ink: int) -> None:
        for j, row in enumerate(rows):
            for i, v in enumerate(row):
                if v == '#':
                    fill(x+i,y+j,1,1,ink)

    rr = room_rects(l)
    view_room = o.get('room', s['room'])
    for i in range(len(rr)-1):
        a, b = rr[i], rr[i+1]
        ink = 14 if i < s['room'] else 3
        if a['y'] == b['y']:
            right = b['x'] > a['x']
            x = a['x']+19 if right else a['x']-2
            glyph(['#.','.#','#.'] if right else ['.#','#.','.#'],x,a['y']+7,ink)
        else:
            fill(a['x']+8,a['y']+18,3,1,ink)
            fill(a['x']+9,a['y']+19,1,1,ink)

    def squad(rect: dict, units: list[int], side: str, front: bool,
              hide_front: bool = False) -> None:
        for i in range(16):
            x, y = unit_point(rect, i, side)
            fill(x,y,2,2,5); fill(x+1,y+1,1,1,4)
        for i, role in enumerate(units):
            x, y = unit_point(rect, i, side)
            if not (hide_front and i == 0):
                fill(x,y,1,1,(ALLY if side == 'ally' else ENEMY)[role])
        if front and units and not hide_front:
            x, y = unit_point(rect, 0, side)
            fill(x+1,y+1,1,1,0)

    for i, r in enumerate(rr):
        current, cleared = i == view_room, s['cleared'][i]
        box(r['x'],r['y'],r['w'],r['h'],0 if current else 2 if cleared else 3)
        if cleared:
            fill(r['x']+1,r['y']+1,2,1,14)
        # JS arrays, including [], are truthy: an empty override must stay empty.
        enemies = o['enemy'] if current and o.get('enemy') is not None else [] if cleared else l['rooms'][i]['enemy']
        army = (o['army'] if o.get('army') is not None else s['army']) if current else []
        squad(r,army,'ally',current,bool(current and o.get('hideFront')))
        squad(r,enemies,'enemy',bool(enemies),bool(current and o.get('hideFront')))
        if i < len(l['rooms'])-1:
            prison_open = cleared and not (o.get('closedPrison') and current)
            px, py = r['x']+2, r['y']+12
            box(px,py,15,5,0 if prison_open and current else 3)
            if not prison_open:
                fill(px+5,py+1,1,3,3); fill(px+9,py+1,1,3,3)
            else:
                fill(px+6,py,3,1,5)
            assigned = len(s['roles'][i])
            for k in range(l['rooms'][i]['prisoners']):
                if not prison_open or k >= assigned:
                    x, y = prisoner_point(r,k)
                    fill(x,y,2,2,4); fill(x,y,1,1,0 if current and prison_open else 1)
            if current and o.get('prisonPulse'):
                box(px,py,15,5,0)
    if o.get('duel'):
        r, d = rr[view_room], o['duel']
        ax, ex, y = r['x']+7+min(1,d['step']), r['x']+10-min(1,d['step']), r['y']+3
        fill(ax,y,1,1,1 if d.get('flash') and d['winner'] != 'ally' else ALLY[d['a']])
        fill(ex,y,1,1,1 if d.get('flash') and d['winner'] != 'enemy' else ENEMY[d['e']])
        if d.get('flash'):
            fill(r['x']+8,y+1,2,1,0)
    if o.get('flying'):
        p = o['flying']
        fill(p['x'],p['y'],1,1,ALLY[p['role']])
    fill(1,41,62,1,4)
    ready, recruit = s['phase'] == 'combat', s['phase'] == 'recruit'
    b = FIGHT_BUTTON
    box(b['x'],b['y'],b['w'],b['h'],0 if ready else 3)
    glyph(['#...','##..','###.','####','###.','##..','#...'],4,48,0 if ready else 4)
    box(12,44,28,4,0 if recruit else 3)
    for i in range(3):
        fill(15+i*7,45,4,2,0 if i < s['pending'] else 4)
    for b in ROLE_BUTTONS:
        box(b['x'],b['y'],b['w'],b['h'],0 if recruit else 3)
        fill(b['x']+2,b['y']+3,4,4,ALLY[b['role']])
        if o.get('chosen') == b['role']:
            box(b['x']+1,b['y']+1,b['w']-2,b['h']-2,0)
    box(43,43,20,17,3)
    for row, (a,b) in enumerate(((0,1),(1,2),(2,0))):
        y = 44+5*row
        fill(45,y+1,3,3,ALLY[a]); fill(49,y+1,3,3,ENEMY[a])
        glyph(['#.','.#','#.'],53,y+1,0)
        fill(56,y+1,2,2,ALLY[b]); fill(59,y+1,2,2,ENEMY[b])
    for i in range(6):
        fill(2+i*6,63,5,1,14 if completed[i] else 4)
    if 'border' in o:
        box(0,0,64,62,o['border'])
    return f


SNAP_KEYS = ('completed', 'index', 'local', 'state', 'total_actions', 'step_index',
             'restarts', 'test_mode', 'last_event')


class RecruitArmyEngine:
    """Synchronous custom ARC3-style controller; six embedded levels by default.

    ``info`` can provide game_id/title overrides for a custom host. This is not
    a subclass of the official ARC SDK, and makes no dependency on that SDK.
    """

    def __init__(self, info: Any = None, *, levels: list[Level] | None = None,
                 levels_dir: str | Path | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Utiliser levels ou levels_dir, pas les deux.')
        raw = load_levels(levels_dir) if levels_dir is not None else LEVELS if levels is None else levels
        _require(isinstance(raw, list) and 1 <= len(raw) <= 6, 'Un à six niveaux requis.')
        self.levels = [validate_level(l) for l in raw]
        self.animate = bool(animate)
        self.game_id = getattr(info, 'game_id', GAME_ID) if info is not None else GAME_ID
        self.title = getattr(info, 'title', 'Recruit Army') if info is not None else 'Recruit Army'
        self.reset()

    def setup(self, index: int) -> None:
        self.index, self.local, self.state = index, initial(self.levels[index]), 'NOT_FINISHED'

    def observe(self) -> dict:
        l = self.levels[self.index]
        frame = render(l, self.local, self.completed)
        ids = [5,6,7] if self.state == 'NOT_FINISHED' else [7]
        return {'game_id': self.game_id, 'title': self.title, 'custom_family': FAMILY,
                'wave': WAVE, 'revision': REVISION, 'state': self.state,
                'level': self.index+1, 'levels_completed': sum(self.completed),
                'win_levels': len(self.levels), 'score': sum(self.completed),
                'frame': frame, 'frames': [frame], 'frame_count': 1,
                'frame_durations_ms': [0], 'palette': PALETTE[:], 'default_fps': FPS,
                'available_action_ids': ids, 'available_actions': [f'ACTION{i}' for i in ids],
                'total_actions': self.total_actions, 'step_index': self.step_index,
                'level_actions': self.local['battles']+self.local['recruits'],
                'restarts': self.restarts, 'test_mode': self.test_mode, 'last_event': self.last_event}

    def packet(self, event: str, frames: list[Raster] | None = None,
               ds: list[int] | None = None, extra: dict | None = None) -> dict:
        self.last_event = event
        out = dict(self.observe(), event=event, **(extra or {}))
        if frames:
            out.update(frame=frames[-1], frames=frames, frame_count=len(frames), frame_durations_ms=ds)
        return out

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
        return {k: deepcopy(getattr(self,k)) for k in SNAP_KEYS}

    def restore(self, snapshot: Mapping) -> None:
        """Reader-only snapshot created by the same engine/levels; not a player undo."""
        values = {k: deepcopy(snapshot[k]) for k in SNAP_KEYS}
        for k, v in values.items():
            setattr(self,k,v)

    def action(self, aid: Any, data: Mapping | None = None) -> dict:
        if isinstance(aid, Mapping):
            data = aid.get('data')
            aid = next((aid[k] for k in ('id','action_ref','action') if aid.get(k) is not None), None)
        if aid == 'RESET' or (integer(aid) and aid == 0):
            return self.reset()
        if aid in ('ACTION5','ACTION6','ACTION7'):
            aid = int(aid[-1])
        if integer(aid) and aid == 7:
            return self.level_reset()
        if self.state != 'NOT_FINISHED':
            return self.packet('ignored')
        l = self.levels[self.index]
        cmd = None
        if integer(aid) and aid == 5:
            cmd = {'kind': 'fight'}
        elif (integer(aid) and aid == 6 and isinstance(data, Mapping)
              and integer(data.get('x')) and integer(data.get('y'))
              and 0 <= data['x'] < 64 and 0 <= data['y'] < 64):
            cmd = hit(l,self.local,int(data['x']),int(data['y']))
        if cmd is None:
            return self.packet('ignored')
        before = deepcopy(self.local)
        r = transition(l,before,cmd)
        frames, ds = [], []
        if not r['cost']:
            if r['event'] == 'assign_first' and self.animate:
                frames.append(render(l,before,self.completed,{'prisonPulse':True})); ds.append(160)
            frames.append(self.observe()['frame']); ds.append(0)
            return self.packet(r['event'],frames,ds,{'cost':0})
        self.total_actions += 1
        self.step_index += 1
        self.local = r['state']
        if self.animate and cmd['kind'] == 'fight':
            for t in r['result']['trace']:
                for k in range(2):
                    frames.append(render(l,before,self.completed,{
                        'army':t['beforeArmy'], 'enemy':t['beforeEnemy'], 'hideFront':True,
                        'duel':{'a':t['beforeArmy'][0], 'e':t['beforeEnemy'][0],
                                'step':k, 'winner':t['winner'], 'flash':k==1}}))
                    ds.append(100 if k else 65)
                frames.append(render(l,before,self.completed,{'army':t['army'],'enemy':t['enemy']}))
                ds.append(95)
            frames.append(render(l,self.local,self.completed,{'enemy':r['result']['enemy']})); ds.append(160)
        if self.animate and cmd['kind'] == 'recruit':
            rect = room_rects(l)[before['room']]
            start = prisoner_point(rect,len(before['roles'][before['room']]))
            end = unit_point(rect,len(before['army']),'ally')
            transit = deepcopy(before)
            transit['roles'][before['room']].append(cmd['role'])
            transit['pending'] -= 1
            for k in range(1,7):
                # JS Math.round: floor(x + .5), not Python's ties-to-even round.
                x = math.floor(start[0]+(end[0]-start[0])*k/6+0.5)
                y = math.floor(start[1]+(end[1]-start[1])*k/6+0.5)
                frames.append(render(l,transit,self.completed,{'chosen':cmd['role'],
                              'flying':{'x':x,'y':y,'role':cmd['role']}})); ds.append(40)
            transit['army'].append(cmd['role'])
            frames.append(render(l,transit,self.completed,{'chosen':cmd['role']})); ds.append(100)
        event = r['event']
        extra = {'cost':1, 'played_level':self.index+1, 'played_room':before['room']+1,
                 'auto_reset':event=='defeat'}
        if event == 'defeat':
            if self.animate:
                for _ in range(3):
                    frames.append(render(l,self.local,self.completed,{'enemy':r['result']['enemy'],'border':8})); ds.append(170)
                    frames.append(render(l,self.local,self.completed,{'enemy':r['result']['enemy']})); ds.append(110)
            self.restarts += 1
            self.setup(self.index)
        elif event == 'success':
            if self.animate:
                for _ in range(3):
                    frames.append(render(l,self.local,self.completed,{'border':14})); ds.append(170)
                    frames.append(render(l,self.local,self.completed)); ds.append(110)
            self.completed[self.index] = True
            if self.test_mode:
                self.state = 'LEVEL_COMPLETE'
            elif self.index+1 == len(self.levels):
                self.state = 'WIN'
            else:
                self.setup(self.index+1)
            event = 'win' if self.state == 'WIN' else 'success'
        frames.append(self.observe()['frame']); ds.append(0)
        return self.packet(event,frames,ds,extra)

    step = action
    public_state = observe
    levelReset = level_reset
    jumpToLevel = jump_to_level


# JavaScript-name aliases for replay tools; never a second rule implementation.
Engine = RecruitArmyEngine
validateLevel = validate_level
validRole = valid_role
roomRects = room_rects
unitPoint = unit_point
prisonerPoint = prisoner_point

if __name__ == '__main__':
    print(json.dumps(RecruitArmyEngine().observe(),ensure_ascii=False))
