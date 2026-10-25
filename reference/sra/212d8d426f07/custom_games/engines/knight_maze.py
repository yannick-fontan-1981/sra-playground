"""CAVA — Cavalier, faithful Python port of the approved web v1.1.

Python 3.10+, standard library only. No JavaScript, GUI, network or solver at
runtime. ACTION6 clicks a cyan destination in native 64x64 pixel coordinates;
ACTION7 resets the current level; RESET / action(0) resets the campaign.
State names and ordered animation frames deliberately match the web engine.
Default levels are embedded; optional JSON files have identical level data.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json
import math

SIZE = FRAME = 64
CELL = 7
FPS = 25
GAME_ID = 'cava-c3000001'
FAMILY = 'knight_maze'
WAVE = 'custom_3'
REVISION = WEB_REVISION = 'v1.1'
PALETTE = ['#FFFFFF','#CCCCCC','#999999','#666666','#333333','#000000',
           '#E53AA3','#FF7BCC','#F93C31','#1E93FF','#88D8F1','#FFDC00',
           '#FF851B','#921231','#4FCC30','#A356D6']
DELTAS = [[1,-2],[2,-1],[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2]]
HORSE = ['.###.','##.##','..###','..##.','#####']
LEVELS_DIR = Path(__file__).resolve().parent / 'levels'
Raster = list[list[int]]
Level = dict[str, Any]
State = dict[str, int]

DEFAULT_LEVELS = json.loads('[{"id":"L01","width":6,"height":6,"floor":[1,2,3,4,5,7,9,10,11,12,13,14,17,19,20,21,23,26,30,31,32,33,34],"start":30,"goal":11,"gems":[],"gates":[[],[]],"switches":[],"portals":[],"fragile":[],"phase":0,"title":"Les détours invisibles","budget":11,"version":1},{"id":"L02","width":7,"height":7,"floor":[3,4,7,8,9,14,15,16,18,21,25,27,28,29,30,31,32,34,35,37,38,39,40,41,42,43,45,46,47,48],"start":32,"goal":48,"gems":[31,4],"gates":[[],[]],"switches":[],"portals":[],"fragile":[],"phase":0,"title":"Les deux sceaux","budget":16,"version":1},{"id":"L03","width":8,"height":8,"floor":[3,5,7,8,10,12,13,14,15,17,19,20,21,23,25,27,28,29,30,32,34,35,37,38,39,42,44,46,48,50,52,56,59,60,62],"start":14,"goal":59,"gems":[7],"gates":[[44,52,25],[15,23,13]],"switches":[56,42],"portals":[],"fragile":[],"phase":0,"title":"La forteresse à bascule","budget":21,"version":1},{"id":"L04","width":8,"height":8,"floor":[0,1,8,9,10,12,13,16,18,21,23,24,27,29,32,33,37,42,43,45,46,47,49,50,53,54,55,56,58,61,62],"start":37,"goal":56,"gems":[12,9],"gates":[[],[]],"switches":[],"portals":[[0,24]],"fragile":[],"phase":0,"title":"Le passage plié","budget":16,"version":1},{"id":"L05","width":8,"height":8,"floor":[1,2,3,5,9,10,11,13,17,18,19,21,23,24,25,31,32,33,37,38,39,41,42,46,47,49,50,53,54,58,61,62,63],"start":46,"goal":50,"gems":[9,58],"gates":[[],[]],"switches":[],"portals":[],"fragile":[39,61,18,10,23],"phase":0,"title":"Les ponts du retour","budget":19,"version":1},{"id":"L06","width":8,"height":8,"floor":[1,2,3,4,5,6,10,12,13,14,15,16,17,18,21,23,24,30,32,38,39,42,43,44,47,48,50,51,52,54,58,60,61],"start":21,"goal":3,"gems":[58,47,18],"gates":[[43,30,51],[13,2,52]],"switches":[16,32],"portals":[[48,61]],"fragile":[14,44,54],"phase":0,"title":"Le dernier échiquier","budget":34,"version":1}]')
LEVELS = DEFAULT_LEVELS

def integer(value: Any) -> bool:
    """Reject bool and match safe integral JSON numbers accepted by JavaScript."""
    return (type(value) in (int, float) and abs(value) <= 9007199254740991
            and math.isfinite(value) and value == math.floor(value))


def _require(condition: Any, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate_level(raw: Any) -> Level:
    """Validate the same constraints as web v1.1; do not infer extra rules."""
    _require(isinstance(raw, dict), 'Level must be an object.')
    l = deepcopy(raw)
    _require(isinstance(l.get('id'), str) and isinstance(l.get('title'), str),
             'Level id/title missing.')
    _require(integer(l.get('width')) and integer(l.get('height'))
             and 5 <= l['width'] <= 8 and 5 <= l['height'] <= 8,
             'Board must be 5–8 cells per side.')
    _require(integer(l.get('budget')) and 1 <= l['budget'] <= 34,
             'Budget must be 1–34 jumps.')
    _require(integer(l.get('phase')) and l['phase'] in (0, 1), 'Bad gate phase.')

    def cells(a: Any) -> bool:
        return (isinstance(a, list) and all(integer(p) and 0 <= p < l['width']*l['height']
                                          for p in a) and len(set(a)) == len(a))

    _require(cells(l.get('floor')), 'Bad floor cells.')
    floor = set(l['floor'])
    _require(integer(l.get('start')) and integer(l.get('goal'))
             and l['start'] in floor and l['goal'] in floor and l['start'] != l['goal'],
             'Bad start or goal.')
    _require(cells(l.get('gems')) and len(l['gems']) <= 3 and cells(l.get('switches'))
             and cells(l.get('fragile')) and len(l['fragile']) <= 8, 'Bad features.')
    _require(isinstance(l.get('gates'), list) and len(l['gates']) == 2
             and all(cells(g) for g in l['gates']), 'Bad gates.')
    _require(isinstance(l.get('portals'), list) and len(l['portals']) <= 2
             and all(cells(p) and len(p) == 2 for p in l['portals']), 'Bad portals.')
    placed = [l['start'], l['goal'], *l['gems'], *l['switches'], *l['fragile'],
              *(p for group in l['gates'] for p in group),
              *(p for group in l['portals'] for p in group)]
    _require(all(p in floor for p in placed) and len(set(placed)) == len(placed),
             'Features overlap or sit in walls.')
    # 3 and 3.0 represent the same number in JavaScript; normalize for indexing.
    for key in ('width', 'height', 'budget', 'phase', 'start', 'goal'):
        l[key] = int(l[key])
    for key in ('floor', 'gems', 'switches', 'fragile'):
        l[key] = [int(p) for p in l[key]]
    for key in ('gates', 'portals'):
        l[key] = [[int(p) for p in group] for group in l[key]]
    return l


def load_levels(directory: str | Path) -> list[Level]:
    paths = sorted(Path(directory).glob('L[0-9][0-9].json'))
    if not paths:
        raise FileNotFoundError(f'No Lxx.json levels in {directory}')
    return [validate_level(json.loads(p.read_text(encoding='utf-8-sig'))) for p in paths]


def compile_level(l: Level) -> dict[str, Any]:
    floor = set(l['floor'])
    gates = {p: i for i, group in enumerate(l['gates']) for p in group}
    gems = {p: i for i, p in enumerate(l['gems'])}
    fragile = {p: i for i, p in enumerate(l['fragile'])}
    portals = {}
    for a, b in l['portals']:
        portals[a], portals[b] = b, a
    adj = {}
    for p in l['floor']:
        adj[p] = []
        for dx, dy in DELTAS:
            x, y = p % l['width'] + dx, p // l['width'] + dy
            t = x + y*l['width']
            if 0 <= x < l['width'] and 0 <= y < l['height'] and t in floor:
                adj[p].append(t)
    return dict(floor=floor, gates=gates, gems=gems, fragile=fragile,
                portals=portals, switches=set(l['switches']), adj=adj,
                allGems=(1 << len(l['gems'])) - 1)


def initial(l: Level) -> State:
    return dict(pos=l['start'], collected=0, phase=l['phase'], collapsed=0, moves=0)


def legal(l: Level, s: State, c: dict | None = None) -> list[int]:
    c = compile_level(l) if c is None else c
    return [t for t in c['adj'][s['pos']]
            if not (t == l['goal'] and s['collected'] != c['allGems'])
            and not (t in c['fragile'] and s['collapsed'] & (1 << c['fragile'][t]))
            and not (t in c['gates'] and c['gates'][t] != s['phase'])]


def transition(l: Level, s: State, target: int, c: dict | None = None) -> dict:
    """One knight jump. Walls between endpoints never enter legality checks."""
    c = compile_level(l) if c is None else c
    if target not in legal(l, s, c):
        return dict(state=deepcopy(s), event='invalid', effects=[], landing=target)
    n, effects = deepcopy(s), []
    if s['pos'] in c['fragile']:
        n['collapsed'] |= 1 << c['fragile'][s['pos']]
        effects.append('collapse')
    n['pos'] = target
    n['moves'] += 1
    if target in c['gems'] and not n['collected'] & (1 << c['gems'][target]):
        n['collected'] |= 1 << c['gems'][target]
        effects.append('collect')
    if target in c['switches']:
        n['phase'] ^= 1
        effects.append('switch')
    if target in c['portals']:
        n['pos'] = c['portals'][target]
        effects.append('portal')
    event = 'move'
    if n['pos'] == l['goal'] and n['collected'] == c['allGems']:
        event = 'success'
    elif n['moves'] >= l['budget']:
        event = 'exhausted'
    elif not legal(l, n, c):
        event = 'trapped'
    return dict(state=n, event=event, effects=effects, landing=target)


def origin(l: Level) -> list[int]:
    return [(64 - l['width']*CELL)//2, 5 + (56 - l['height']*CELL)//2]


def center(l: Level, p: int) -> list[int]:
    x, y = origin(l)
    return [x + (p % l['width'])*CELL + 3, y + (p // l['width'])*CELL + 3]


def cell_at(l: Level, x: int, y: int) -> int | None:
    ox, oy = origin(l)
    col, row = (x - ox)//CELL, (y - oy)//CELL
    return col + row*l['width'] if 0 <= col < l['width'] and 0 <= row < l['height'] else None


def render(l: Level, s: State, completed: list[bool] | None = None,
           options: dict | None = None, c: dict | None = None) -> Raster:
    """Exact 64x64 palette-index image, including all source animation layers."""
    completed = [False]*6 if completed is None else completed
    options = {} if options is None else options
    c = compile_level(l) if c is None else c
    f = [[5]*64 for _ in range(64)]

    def fill(x: int, y: int, w: int, h: int, k: int) -> None:
        for yy in range(max(0, y), min(64, y+h)):
            for xx in range(max(0, x), min(64, x+w)):
                f[yy][xx] = k

    def box(x: int, y: int, w: int, h: int, k: int) -> None:
        fill(x,y,w,1,k); fill(x,y+h-1,w,1,k)
        fill(x,y,1,h,k); fill(x+w-1,y,1,h,k)

    def glyph(rows: list[str], x: int, y: int, col: int) -> None:
        for yy, row in enumerate(rows):
            for xx, v in enumerate(row):
                if v == '#':
                    fill(x+xx, y+yy, 1, 1, col)

    ox, oy = origin(l)
    destinations = set([] if options.get('highlights') is False else legal(l, s, c))
    for y in range(l['height']):
        for x in range(l['width']):
            p, px, py = x+y*l['width'], ox+x*CELL, oy+y*CELL
            if p not in c['floor']:
                fill(px,py,CELL,CELL,3); fill(px+1,py+1,5,1,2); fill(px+1,py+2,1,4,2)
                continue
            broken = p in c['fragile'] and bool(s['collapsed'] & (1 << c['fragile'][p]))
            if broken:
                for dx, dy in ((1,1),(5,1),(1,5),(5,5)):
                    fill(px+dx,py+dy,1,1,4)
                continue
            lit = p in destinations
            fill(px,py,6,6,10 if lit else 4)
            if p in c['gates']:
                color, opened = (12 if c['gates'][p] == 0 else 15), c['gates'][p] == s['phase']
                if opened:
                    fill(px+1,py+1,1,4,color); fill(px+4,py+1,1,4,color)
                    fill(px+2,py+1,2,1,5); fill(px+2,py+4,2,1,5)
                else:
                    fill(px,py,6,6,5); box(px,py,6,6,color); fill(px+2,py+1,2,4,color)
            if p in c['fragile']:
                fill(px+1,py+1,4,4,13); fill(px+2,py+1,1,2,5); fill(px+3,py+3,1,2,5)
            if p in c['switches']:
                fill(px+1,py+1,4,4,5); fill(px+1,py+1,2,3,12); fill(px+3,py+2,2,3,15)
                fill(px+(1 if s['phase'] == 0 else 4),py+(1 if s['phase'] == 0 else 4),1,1,0)
            if p in c['portals']:
                fill(px+1,py+1,4,4,5); fill(px+2,py+1,2,1,6); fill(px+2,py+4,2,1,6)
                fill(px+1,py+2,1,2,6); fill(px+4,py+2,1,2,6)
            if p in c['gems'] and not s['collected'] & (1 << c['gems'][p]):
                fill(px+1,py+1,5,5,5)
                glyph(['..#..','.###.','#####','.###.','..#..'],px+1,py+1,11)
            if p == l['goal']:
                box(px+1,py+1,4,4,0)
                fill(px+2,py+2,2,2,5 if s['collected'] == c['allGems'] else 11)
    if options.get('route'):
        a, b = options['route']
        sx, sy = center(l, a); tx, ty = center(l, b)
        horizontal = abs(tx-sx) > abs(ty-sy)
        mx, my = (tx, sy) if horizontal else (sx, ty)

        def dots(x1: int, y1: int, x2: int, y2: int) -> None:
            n = abs(x2-x1) + abs(y2-y1)
            dx, dy = _sign(x2-x1), _sign(y2-y1)
            for i in range(1, n, 3):
                fill(x1+i*dx,y1+i*dy,1,1,9)

        dots(sx,sy,mx,my); dots(mx,my,tx,ty)
    if 'portalGlow' in options:
        for p in (options['portalGlow'], c['portals'][options['portalGlow']]):
            cx, cy = center(l, p)
            box(cx-3,cy-3,6,6,6)
    if options.get('piece') is not False:
        cx, cy = options.get('piece') or center(l, s['pos'])
        glyph(HORSE,cx-2,cy-2,0)
    box(3,0,43,4,3); fill(4,1,41,2,4)
    # Integer ceiling of the source expression; no banker's rounding.
    n = (41*max(0, l['budget'] - s['moves']) + l['budget'] - 1)//l['budget']
    fill(4,1,n,2,11)
    for i in range(len(l['gems'])):
        x = 49+i*5
        box(x,0,4,4,11); fill(x+1,1,2,2,11 if s['collected'] & (1 << i) else 5)
    for i in range(6):
        fill(2+i*6,63,5,1,14 if i < len(completed) and completed[i] else 4)
    if options.get('invalid') is not None:
        cx, cy = center(l, options['invalid'])
        box(cx-3,cy-3,6,6,8)
    if 'border' in options:
        box(0,4,64,58,options['border'])
    return f


def _sign(x: int | float) -> int:
    return (x > 0) - (x < 0)


@dataclass(frozen=True)
class KnightMazeInfo:
    game_id: str = GAME_ID
    title: str = 'Cavalier'
    family: str = FAMILY
    levels: int = 6
    default_fps: int = FPS


class KnightMazeEngine:
    """Synchronous custom-backend adapter; does not register with the official SDK."""

    def __init__(self, info: Any = None, *, levels: list[Level] | None = None,
                 levels_dir: str | Path | None = None, animate: bool = True) -> None:
        if levels is not None and levels_dir is not None:
            raise ValueError('Use levels OR levels_dir.')
        bank = load_levels(levels_dir) if levels_dir is not None else (DEFAULT_LEVELS if levels is None else levels)
        _require(isinstance(bank, list) and 1 <= len(bank) <= 6, 'Supply one to six levels.')
        self.levels = [validate_level(l) for l in bank]
        self.maps = [compile_level(l) for l in self.levels]
        self.info = info or KnightMazeInfo(levels=len(self.levels))
        self.animate = bool(animate)
        self.reset()

    def _setup(self, i: int) -> None:
        self.index, self.local, self.state = i, initial(self.levels[i]), 'NOT_FINISHED'

    def observe(self) -> dict:
        l = self.levels[self.index]
        f = render(l, self.local, self.completed, {}, self.maps[self.index])
        ids = [6,7] if self.state == 'NOT_FINISHED' else [7]
        return dict(game_id=getattr(self.info, 'game_id', GAME_ID), title='Cavalier',
                    custom_family=FAMILY, wave=WAVE, revision=REVISION, state=self.state,
                    level=self.index+1, levels_completed=sum(self.completed),
                    win_levels=len(self.levels), score=sum(self.completed),
                    frame=f, frames=[f], frame_count=1, frame_durations_ms=[0],
                    palette=PALETTE[:], default_fps=FPS, available_action_ids=ids,
                    available_actions=['ACTION'+str(i) for i in ids], total_actions=self.total_actions,
                    step_index=self.step_index, level_actions=self.local['moves'],
                    action_limit=l['budget'], actions_remaining=l['budget']-self.local['moves'],
                    restarts=self.restarts, test_mode=self.test_mode, last_event=self.last_event)

    def _packet(self, event: str, frames: list[Raster] | None = None,
                durations: list[int] | None = None, **extra: Any) -> dict:
        self.last_event = event
        out = dict(self.observe(), event=event, **extra)
        if frames:
            out.update(frame=frames[-1], frames=frames, frame_count=len(frames),
                       frame_durations_ms=durations)
        return out

    def reset(self) -> dict:
        self.completed = [False]*6
        self.test_mode = False
        self.total_actions = self.step_index = self.restarts = 0
        self.last_event = 'reset'
        self._setup(0)
        return self._packet('reset')

    def level_reset(self) -> dict:
        self.completed[self.index] = False
        self.restarts += 1
        self._setup(self.index)
        return self._packet('reset_level')

    def jump_to_level(self, n: int) -> dict:
        _require(integer(n) and 1 <= n <= len(self.levels), 'Invalid level.')
        self.reset()
        self.test_mode = True
        self._setup(int(n)-1)
        return self._packet('preview')

    def action(self, aid: Any, data: dict | None = None) -> dict:
        if isinstance(aid, dict):
            p = aid
            data = p.get('data')
            aid = next((p.get(k) for k in ('id','action_ref','action') if p.get(k) is not None), None)
        aid = getattr(aid, 'value', aid)
        if aid == 'RESET' or integer(aid) and aid == 0:
            return self.reset()
        if aid in ('ACTION6', 'ACTION7'):
            aid = int(aid[-1])
        if integer(aid) and aid == 7:
            return self.level_reset()
        if not integer(aid) or aid != 6 or self.state != 'NOT_FINISHED':
            return self._packet('ignored')
        if not isinstance(data, dict) or not all(integer(data.get(k)) and 0 <= data[k] < 64 for k in ('x','y')):
            return self._packet('ignored')
        l, c = self.levels[self.index], self.maps[self.index]
        t = cell_at(l, int(data['x']), int(data['y']))
        if t is None:
            return self._packet('ignored')
        self.total_actions += 1
        self.step_index += 1
        before = deepcopy(self.local)
        r = transition(l, before, t, c)
        frames, ds = [], []
        if r['event'] == 'invalid':
            if self.animate:
                frames.append(render(l,before,self.completed,{'invalid':t},c)); ds.append(110)
            frames.append(self.observe()['frame']); ds.append(0)
            return self._packet('invalid', frames, ds, cost=0)
        self.local = r['state']
        if self.animate:
            sx, sy = center(l,before['pos']); tx, ty = center(l,t)
            horizontal = abs(tx-sx) > abs(ty-sy)
            travel = deepcopy(before)
            travel['collapsed'] = self.local['collapsed']
            for i in range(1,7):
                distance = i*21/6
                first, second = min(14,distance), max(0,distance-14)
                x = math.floor(sx+_sign(tx-sx)*(first if horizontal else second)+0.5)
                y = math.floor(sy+_sign(ty-sy)*(second if horizontal else first)+0.5)
                frames.append(render(l,travel,self.completed,
                                     {'piece':[x,y], 'route':[before['pos'],t], 'highlights':False},c))
                ds.append(35)
            if 'portal' in r['effects']:
                frames.append(render(l,self.local,self.completed,
                                     {'piece':False,'portalGlow':t,'highlights':False},c)); ds.append(70)
                frames.append(render(l,self.local,self.completed,
                                     {'portalGlow':t,'highlights':False},c)); ds.append(70)
            frames.append(render(l,self.local,self.completed,{},c))
            ds.append(170 if 'switch' in r['effects'] else 65)
        win = r['event'] == 'success'
        fail = r['event'] in ('exhausted','trapped')
        extra = dict(cost=1, played_level=self.index+1, effects=r['effects'])
        event = r['event']
        if win or fail:
            if self.animate:
                for _ in range(3):
                    frames.append(render(l,self.local,self.completed,{'border':14 if win else 8},c)); ds.append(180)
                    frames.append(render(l,self.local,self.completed,{},c)); ds.append(120)
            extra.update(completed_actions=self.local['moves'] if win else None, auto_reset=fail)
            if fail:
                self.restarts += 1
                self._setup(self.index)
            else:
                self.completed[self.index] = True
                if self.test_mode:
                    self.state = 'LEVEL_COMPLETE'
                elif self.index == len(self.levels)-1:
                    self.state = 'WIN'
                else:
                    self._setup(self.index+1)
                event = 'win' if self.state == 'WIN' else 'success'
        frames.append(self.observe()['frame']); ds.append(0)
        return self._packet(event,frames,ds,**extra)

    def snapshot(self) -> dict:
        """Developer/player cancellation only; never included in observations."""
        return deepcopy({k: getattr(self,k) for k in (
            'completed','test_mode','total_actions','step_index','restarts',
            'last_event','index','local','state')})

    def restore(self, snapshot: dict) -> None:
        for k in ('completed','test_mode','total_actions','step_index','restarts',
                  'last_event','index','local','state'):
            setattr(self,k,deepcopy(snapshot[k]))

    public_state = observe
    step = action
    levelReset = level_reset
    jumpToLevel = jump_to_level
    setup = _setup


# Source-compatible and French aliases, no extra implementations.
CavalierEngine = Engine = KnightMazeEngine
CavalierInfo = KnightMazeInfo
validateLevel = validate_level
cellAt = cell_at
compile = compile_level

if __name__ == '__main__':
    print(json.dumps(KnightMazeEngine().observe(), ensure_ascii=False))
