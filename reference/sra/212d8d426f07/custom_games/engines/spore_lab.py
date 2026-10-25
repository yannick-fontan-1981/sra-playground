"""SPOR — Spore Lab, custom_3 v1.6.2. Python 3.10+, standard library only.

One action = one biological tick. No real-time spoilage, no automatic solver.
ACTION6 clicks a workshop; ACTION5 waits; ACTION7 resets the current level.
The six-level campaign returns ordered 64x64 palette-index frames. Source
recipes, durations and initial inventories are original simplified puzzle rules,
not a port of Factorio's quantities or production timings.

Stable inputs: s[0:2], s[18:23]. Perishable injector contents: s[2:6].
Stable spare nutrient doses: s[6]. Jobs: s[7:13]. Stable source stock: s[13:17].
Delivered doses: s[17]. Waiting never changes the sealed inputs or spare stock.
The controller returns ordered frames; animation never advances extra ticks.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any
import json

SIZE = FRAME = 64
FPS = 40
GAME_ID, FAMILY, WAVE, REVISION = 'spor-c3000001', 'spore_lab', 'custom_3', 'v1.6.2'
PALETTE = ['#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000', '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00', '#FF851B', '#921231', '#4FCC30', '#A356D6']
LIFE = [6, 8, 10, 7, 4, 6]
OPS = ['pulp', 'jelly', 'flux', 'nutrient', 'egg', 'vial', 'deliver', 'wait', 'compost']
COLORS = [12, 6, 10, 11, 9, 14]
RECTS = [[1, 17, 13, 14], [1, 32, 13, 14], [15, 19, 14, 20], [15, 43, 14, 16], [33, 43, 14, 16], [49, 19, 14, 20], [49, 43, 14, 16], [1, 1, 14, 14]]
SPRITES = [['...#...', '..###..', '.#####.', '#######', '#######', '.#####.', '..###..'], ['...#...', '..###..', '..###..', '.#####.', '#######', '#######', '.#####.'], ['..###..', '.#####.', '#######', '###.###', '#######', '.#####.', '..###..'], ['.......', '.##.##.', '.##.##.', '.......', '..##...', '..##...', '.......'], ['..###..', '.#####.', '.#####.', '#######', '#######', '.#####.', '..###..'], ['..###..', '..#.#..', '..#.#..', '.#####.', '#.....#', '#.....#', '.#####.']]
LEVELS = [{'id': 'L01', 'number': 1, 'title': 'Première injection', 'goal': 1, 'budget': 8, 'stocks': [0, 0, 0], 'waste': 0, 'initial_ttl': [0, 0, 0, 0, 4, 0], 'initial_n': 0, 'feeds': [0, 0, 0, 0, 1, 1, 0], 'min_fresh': 1, 'version': 2, 'revision': 'v1.6'}, {'id': 'L02', 'number': 2, 'title': 'Alimenter puis produire', 'goal': 1, 'budget': 14, 'stocks': [1, 1, 1], 'waste': 0, 'initial_ttl': [0, 0, 0, 0, 0, 0], 'initial_n': 0, 'feeds': [0, 0, 1, 0, 0, 0, 0], 'min_fresh': 1, 'version': 2, 'revision': 'v1.6'}, {'id': 'L03', 'number': 3, 'title': 'Deux lots, entrées stables', 'goal': 2, 'budget': 18, 'stocks': [1, 1, 1], 'waste': 1, 'initial_ttl': [0, 0, 0, 0, 0, 0], 'initial_n': 0, 'feeds': [0, 0, 0, 0, 1, 1, 1], 'min_fresh': 1, 'version': 2, 'revision': 'v1.6'}, {'id': 'L04', 'number': 4, 'title': 'Sauver la dose prête', 'goal': 3, 'budget': 22, 'stocks': [1, 1, 1], 'waste': 1, 'initial_ttl': [0, 0, 0, 0, 0, 3], 'initial_n': 0, 'feeds': [0, 0, 0, 0, 1, 1, 1], 'min_fresh': 3, 'version': 2, 'revision': 'v1.6'}, {'id': 'L05', 'number': 5, 'title': 'Une réserve pour apprendre', 'goal': 2, 'budget': 30, 'stocks': [2, 2, 2], 'waste': 2, 'initial_ttl': [0, 0, 0, 0, 0, 0], 'initial_n': 0, 'feeds': [1, 1, 1, 0, 0, 0, 0], 'min_fresh': 1, 'version': 2, 'revision': 'v1.6'}, {'id': 'L06', 'number': 6, 'title': 'Le flux tendu', 'goal': 3, 'budget': 30, 'stocks': [2, 2, 2], 'waste': 2, 'initial_ttl': [0, 0, 0, 0, 0, 0], 'initial_n': 0, 'feeds': [0, 0, 0, 0, 1, 1, 1], 'min_fresh': 4, 'version': 2, 'revision': 'v1.6'}]
DEFAULT_LEVELS = LEVELS


def integer(v: Any) -> bool:
    return type(v) is int and abs(v) <= 9007199254740991


def initial(level: dict) -> list[int]:
    """Separate stable feed doses from perishable output chambers (23 integers)."""
    s = [0] * 23
    s[2:6] = level['initial_ttl'][2:6]
    s[6] = level['initial_n']  # sealed spare nutrients, not the exposed dose
    s[13:16] = level['stocks'][:]
    s[16] = level['waste']
    for idx, value in zip((0, 1, 18, 19, 20, 21, 22), level['feeds']):
        s[idx] = value
    return s


FEED_INDEX = {2: [0, 1], 3: [18], 4: [19], 5: [20, 21, 22]}
PERISHABLE_OUTPUTS = (2, 3, 4, 5)
JOB_INDEX = {2: 7, 4: 9, 5: 11}


def accepts(s: list[int], target: int, feed: int) -> bool:
    """An independent sealed input accepts one dose and then closes its plug."""
    return s[FEED_INDEX[target][feed]] == 0


def can(s: list[int], op: int) -> bool:
    if op == 0: return s[13] > 0 and accepts(s, 2, 0)
    if op == 1: return s[14] > 0 and accepts(s, 2, 1)
    if op == 8: return s[16] > 0 and accepts(s, 3, 0)
    if op == 7: return True
    if op == 6: return s[5] > 0  # compatibility alias: click the green injector
    if op not in (2, 3, 4, 5): return False
    ji = JOB_INDEX.get(op)
    if ji is not None and s[ji] > 0: return False
    if s[op] > 0:
        if op == 2: return accepts(s, 5, 0)
        if op == 3: return accepts(s, 4, 0) or accepts(s, 5, 1)
        if op == 4: return accepts(s, 5, 2)
        return True
    if op == 3 and s[6] > 0: return True  # explicitly load a stable spare
    return all(s[i] > 0 for i in FEED_INDEX[op]) and (op != 4 or s[15] > 0)


def useful_actions(s: list[int], min_fresh: int=1) -> list[int]:
    """Waiting/working clicks and reset do not count as useful factory actions."""
    return [op for op in (0, 1, 2, 3, 4, 5, 8) if can(s, op)
            and not (op==5 and 0<s[5]<min_fresh)]


def inherited(a: int, ma: int, b: int, mb: int, life: int) -> int:
    # Kept for callers of earlier revisions; sealed inputs no longer age.
    return (life * (a * mb + b * ma) + 2 * ma * mb - 1) // (2 * ma * mb)


def transition(level: dict, state: list[int], op: int) -> dict:
    """Apply an operation, one common tick, then completed output doses.

    Only exposed C/N/blue/green injector contents age. Stable input chambers,
    source magazines and the sealed nutrient spare NEVER lose material on wait.
    One injection can supply both yellow destinations, using one dose for each.
    """
    s = state[:]
    if not integer(op) or not 0 <= op <= 8:
        return {'state': s, 'event': 'ignored', 'spoiled': [], 'made': [],
                'operation_state': s[:], 'peak_state': s[:], 'completed': []}
    born, spoiled, completed = [], [], []
    spare_born = 0
    event = OPS[op]
    if not can(s, op):
        ji = JOB_INDEX.get(op)
        event = 'working' if ji is not None and s[ji] > 0 else 'blocked'
        op = 7
    if op == 0:
        s[13] -= 1; s[0] = 1; event = 'inject_pulp'
    elif op == 1:
        s[14] -= 1; s[1] = 1; event = 'inject_jelly'
    elif op == 8:
        s[16] -= 1; s[18] = 1; event = 'inject_compost'
    elif op == 2:
        if s[2]:
            s[2] = 0; s[20] = 1; event = 'inject_flux'
        else:
            s[0] = s[1] = 0; s[7:9] = [2, LIFE[2]]
    elif op == 3:
        if s[3]:
            available = 1 + s[6]
            used = 0
            for idx in (19, 21):
                if not s[idx] and used < available:
                    s[idx] = 1; used += 1
            s[3] = 0; s[6] -= max(0, used - 1); event = 'inject_nutrient'
        elif s[6]:
            s[6] -= 1; born.append((3, LIFE[3])); event = 'reload_nutrient'
        else:
            s[18] = 0; born.append((3, LIFE[3])); spare_born = 1
            completed.append(3)
    elif op == 4:
        if s[4]:
            s[4] = 0; s[22] = 1; event = 'inject_egg'
        else:
            s[19] = 0; s[15] -= 1; s[9:11] = [3, LIFE[4]]
    elif op in (5, 6):
        if s[5]:
            if s[5] >= level['min_fresh']:
                s[17] += 1; event = 'inject_vial'
            else:
                s[16] += 1; event = 'stale'
            s[5] = 0
        else:
            s[20] = s[21] = s[22] = 0; s[11:13] = [2, LIFE[5]]
    operation_state = s[:]
    for i in PERISHABLE_OUTPUTS:
        if s[i] > 0:
            s[i] -= 1
            if s[i] == 0:
                spoiled.append(i)
                if i == 4:
                    return {'state': s, 'event': 'hatched', 'spoiled': spoiled,
                            'made': [], 'operation_state': operation_state,
                            'peak_state': s[:], 'completed': []}
                s[16] += 1  # exactly the exposed dose; NEVER the sealed spare
    for slot, idx in JOB_INDEX.items():
        if s[idx] > 0:
            s[idx] -= 1
            if not s[idx]:
                born.append((slot, s[idx+1])); s[idx+1] = 0
                completed.append(slot)
    peak_state = s[:]
    for i, life in born: s[i] = life
    s[6] += spare_born
    return {'state': s, 'event': event, 'spoiled': spoiled,
            'made': [i for i, _ in born], 'operation_state': operation_state,
            'peak_state': peak_state, 'completed': completed}


def validate_level(raw: dict) -> dict:
    if not isinstance(raw, dict): raise ValueError('A level must be an object.')
    l = deepcopy(raw)
    if not isinstance(l.get('title'), str) or not isinstance(l.get('id'), str):
        raise ValueError('A level must have an id and title.')
    for k, lo, hi in (('budget',1,30), ('goal',1,3), ('min_fresh',1,6),
                      ('waste',0,10), ('initial_n',0,2)):
        if not integer(l.get(k)) or not lo <= l[k] <= hi: raise ValueError('Invalid '+k)
    if not isinstance(l.get('stocks'), list) or len(l['stocks']) != 3 or any(not integer(x) or not 0 <= x <= 6 for x in l['stocks']):
        raise ValueError('Invalid source stocks.')
    if not isinstance(l.get('initial_ttl'), list) or len(l['initial_ttl']) != 6 or any(not integer(x) or not 0 <= x <= LIFE[i] for i, x in enumerate(l['initial_ttl'])):
        raise ValueError('Invalid initial freshness.')
    if l['initial_ttl'][:2] != [0, 0]: raise ValueError('Raw inputs are stable in v1.6; use feeds.')
    if not isinstance(l.get('feeds'), list) or len(l['feeds']) != 7 or any(type(x) is not int or x not in (0, 1) for x in l['feeds']):
        raise ValueError('Expected seven stable input flags (v1.6).')
    return l


def click_op(s: list[int], x: int, y: int) -> int|None:
    # Brown is now an actual injector, like the orange and magenta sources.
    if 2 <= x < 15 and 47 <= y < 59: return 8
    for i, (a,b,w,h) in enumerate(RECTS):
        if a <= x < a+w and b <= y < b+h:
            return None if i == 6 else i  # the recipient is passive
    return None  # a gutter is not a biological wait action


# Rendering-only model, in fixed-point amounts. No extra biological ticks.
ANIM_SCALE = 120
FRAME_MS = 25
DURATION = [1, 1, 2, 1, 3, 2]
JOB_INDEX = {2: 7, 4: 9, 5: 11}
COMPARTMENTS = {0: ['output'], 1: ['output'], 2: ['feed', 'process', 'output'],
                3: ['feed', 'process', 'output'], 4: ['feed', 'process', 'output'],
                5: ['feed', 'process', 'output'], 6: ['final'], 8: ['stock']}
# All coordinates are native pixels. Needle/wires do not pass through barrels.
SIMPLE_BODIES = {0: [5, 19, 6, 10], 1: [5, 34, 6, 10],
                 6: [54, 44, 7, 14], 8: [7, 48, 6, 10]}
FEED_PORTS = {2: [24, 34], 3: [51], 4: [49, 55], 5: [24, 29, 34]}
WIRE_LAYOUT = [{'source': 0, 'target': 2, 'feed': 0, 'color': 12, 'points': [[10, 24], [16, 24]]}, {'source': 1, 'target': 2, 'feed': 1, 'color': 6, 'points': [[10, 39], [13, 39], [13, 34], [16, 34]]}, {'source': 8, 'target': 3, 'feed': 0, 'color': 13, 'points': [[12, 53], [14, 53], [14, 51], [16, 51]]}, {'source': 2, 'target': 5, 'feed': 0, 'color': 10, 'points': [[28, 29], [40, 29], [40, 24], [50, 24]]}, {'source': 3, 'target': 4, 'feed': 0, 'color': 11, 'points': [[28, 51], [30, 51], [30, 49], [34, 49]]}, {'source': 3, 'target': 5, 'feed': 1, 'color': 11, 'points': [[28, 51], [30, 51], [30, 40], [46, 40], [46, 29], [50, 29]]}, {'source': 4, 'target': 5, 'feed': 2, 'color': 9, 'points': [[46, 51], [48, 51], [48, 34], [50, 34]]}, {'source': 5, 'target': 6, 'feed': 0, 'color': 14, 'points': [[62, 29], [63, 29], [63, 41], [57, 41], [57, 44]]}]


def compost_refill_view(s: list[int]) -> dict:
    # Stable stock is simply available/empty. No predicted, floating recharge.
    return {'refill_gap': 0, 'refill_pending': 0}


def visual_state(s: list[int]) -> dict:
    q = ANIM_SCALE
    feeds = [[0, 0, 0] for _ in range(7)]
    for op, slots in FEED_INDEX.items():
        for j, idx in enumerate(slots): feeds[op][j] = s[idx]*q
    feeds[4][1] = q if s[15] else 0  # one sealed blue seed ready to load
    processes = [0]*6
    for op, idx in JOB_INDEX.items():
        if s[idx]: processes[op] = (DURATION[op]-s[idx])*q//DURATION[op]
    products = [0, 0] + [v*q for v in s[2:6]]
    return {'products': products, 'processes': processes, 'feeds': feeds,
            'compost': s[16]*q, 'delivered': s[17]*q, 'quantity': s[6]*q,
            'stocks': [v*q for v in s[13:16]],
            'source_ready': [q if s[13] else 0, q if s[14] else 0],
            'inject_ready': [0,0,0,0,0,q if s[5] else 0],
            **compost_refill_view(s)}


def blend_view(a, b, step: int, count: int):
    if isinstance(a, dict): return {k: blend_view(a[k], b[k], step, count) for k in a}
    if isinstance(a, list): return [blend_view(x, y, step, count) for x, y in zip(a, b)]
    return (a*(count-step)+b*step+count//2)//count


def action_visuals(l: dict, before: list[int], after: list[int], op: int, result: dict) -> list[dict]:
    """One paid tick: operation, aging, visible recycling, process-to-output.

    Only actually expired output doses recolor brown and feed the compost stock.
    Sealed feeds/spares never participate. No extra simulation tick is applied.
    """
    q = ANIM_SCALE
    start = visual_state(before)
    operated = visual_state(result['operation_state'])
    peak = visual_state(result['peak_state'])
    end = visual_state(after)
    for slot in result['completed']: peak['processes'][slot] = q
    if op in (0, 1) and result['event'].startswith('inject_'):
        operated['source_ready'][op] = 0
        peak['source_ready'][op] = 0
    running = [i for i, idx in JOB_INDEX.items()
               if before[idx] or result['operation_state'][idx]]
    if 3 in result['completed']: running.append(3)
    recycled = [i for i in result['spoiled'] if i in (2, 3, 5)]
    if result['event'] == 'stale': recycled.append(5)
    stages = [(start, operated, 12, [])]
    if recycled:
        # Hold the newly recovered stock until the brown liquid visibly drains.
        old_compost = peak['compost'] - len(recycled)*q
        operated['compost'] = old_compost
        if result['event'] == 'stale':
            operated['products'][5] = before[5]*q
        held = deepcopy(peak)
        held['compost'] = old_compost
        for slot in recycled:
            held['products'][slot] = operated['products'][slot]
        stages.append((operated, held, 8, recycled))
        stages.append((held, peak, 16, recycled))
    else:
        stages.append((operated, peak, 8, []))
    if peak != end: stages.append((peak, end, 16, []))
    steps = []
    for stage, (a, b, n, recycling) in enumerate(stages):
        for j in range(1, n+1):
            steps.append({'visual': blend_view(a,b,j,n), 'running': running,
                          'used_phase': min(20, len(steps)+1), 'stage': stage,
                          'recycling': recycling[:]})
    return steps


def green_threshold_rect(l: dict) -> list[int]:
    """Permanent white acceptance line across the green injector barrel."""
    x,y,w,h = RECTS[5]
    height = h-4
    mark_y = y+h-2-(height*l['min_fresh']+LIFE[5]//2)//LIFE[5]
    return [x+10, mark_y, 4, 1]


def render(l: dict, s: list, used: int=0, completed: list|None=None,
           active: int=-1, border: int|None=None, spin: int|None=None,
           running: list|None=None, warn_op: int|None=None,
           visual: dict|None=None, used_fp: int|None=None,
           recycling: list[int]|None=None) -> list:
    """Native raster only. Draw live cartridges and retract wires along their path.

    All liquid interpolation is rendering-only; no extra action or aging tick.
    White outlines identify loaded injectors / the active production compartment.
    """
    q = ANIM_SCALE
    completed = [False]*6 if completed is None else completed
    running = [] if running is None else running
    v = visual_state(s) if visual is None else visual
    recycling = [] if recycling is None else recycling
    phase = (used*2 if spin is None else spin) % 8
    budget_used = used*q if used_fp is None else used_fp
    f = [[5]*64 for _ in range(64)]

    def fill(x, y, w, h, color):
        for yy in range(max(0, y), min(64, y+h)):
            for xx in range(max(0, x), min(64, x+w)): f[yy][xx] = color

    def box(x, y, w, h, color):
        fill(x,y,w,1,color); fill(x,y+h-1,w,1,color)
        fill(x,y,1,h,color); fill(x+w-1,y,1,h,color)

    def segment(x0, y0, x1, y1, color):
        dx=abs(x1-x0); sx=1 if x0<x1 else -1
        dy=-abs(y1-y0); sy=1 if y0<y1 else -1; err=dx+dy
        while True:
            fill(x0,y0,1,1,color)
            if x0==x1 and y0==y1: break
            e2=2*err
            if e2>=dy: err+=dy; x0+=sx
            if e2<=dx: err+=dx; y0+=sy

    def barrel(rect, amount, total, color, outline=3, plunger=False, vertical=True):
        x,y,w,h = rect
        box(x,y,w,h,outline); fill(x+1,y+1,w-2,h-2,5)
        extent = (h-2) if vertical else (w-2)
        n = 0 if total<=0 else min(extent,max(0,(extent*amount+total//2)//total))
        if n:
            if vertical: fill(x+1,y+h-1-n,w-2,n,color)
            else: fill(x+1,y+1,n,h-2,color)
        if plunger:
            fill(x,y-2,w,1,outline); fill(x+w//2,y-1,1,1,outline)

    def wheel(cx, cy, r, color):
        for dy in range(-r,r+1):
            for dx in range(-r,r+1):
                if r*r-r<=dx*dx+dy*dy<=r*r+r: fill(cx+dx,cy+dy,1,1,3)
        k=1 if r==2 else 3
        ends=[(0,-r),(k,-k),(r,0),(k,k),(0,r),(-k,k),(-r,0),(-k,-k)]
        for j in range(4):
            dx,dy=ends[(phase+2*j)%8]
            segment(cx,cy,cx+dx,cy+dy,color if j==0 else 2)
        fill(cx,cy,1,1,color)

    def attached_cartridge(rect, quantity, capacity, color, vertical=True):
        # Quantity is live fixed-point stock, never the initial stock value.
        x,y,w,h=rect
        barrel(rect,quantity,max(1,capacity)*q,color,3,False,vertical)

    wait_needed = not useful_actions(s,l['min_fresh']) and s[17] < l['goal']
    wheel(8,8,5,0 if wait_needed else 3)
    if wait_needed:
        for dy in range(-5,6):
            for dx in range(-5,6):
                if 20 <= dx*dx+dy*dy <= 30: fill(8+dx,8+dy,1,1,0)
        # All four spokes, not only the selected ray, become white.
        for j in range(4):
            ends=[(0,-5),(3,-3),(5,0),(3,3),(0,5),(-3,3),(-5,0),(-3,-3)]
            dx,dy=ends[(phase+2*j)%8]; segment(8,8,8+dx,8+dy,0)
    barrel([19,5,42,5],max(0,l['budget']*q-budget_used),l['budget']*q,11,3,False,False)
    fill(17,5,1,5,0 if active==7 else 2); fill(18,7,1,1,2); fill(61,7,2,1,2)

    # Sample each orthogonal wire once. Trim its tail across bends rather than
    # reversing a too-short last segment. Full port: two black pixels before it.
    for wire in WIRE_LAYOUT:
        path=[]
        for (ax,ay),(bx,by) in zip(wire['points'],wire['points'][1:]):
            dx=(bx>ax)-(bx<ax); dy=(by>ay)-(by<ay)
            for j in range(abs(bx-ax)+abs(by-ay)+1):
                p=(ax+j*dx,ay+j*dy)
                if not path or p!=path[-1]: path.append(p)
        target=wire['target']
        full=v['delivered']>=l['goal']*q if target==6 else v['feeds'][target][wire['feed']]>=q
        color = wire['color']
        for px,py in (path[:-3] if full else path): fill(px,py,1,1,color)

    for op,stock_idx in ((0,0),(1,1)):
        rect=SIMPLE_BODIES[op]; x,y,w,h=rect
        ink=8 if warn_op==op else (0 if v['source_ready'][op]>0 else 3)
        barrel(rect,v['source_ready'][op],q,COLORS[op],ink,True)
        # Attached on the left, so the magazine cannot cover the output wire.
        if l['stocks'][stock_idx]>0:
            segment(x-1,y+h-2,x,y+h-2,3)
            attached_cartridge([x-4,y+1,3,h-1],max(0,v['stocks'][stock_idx]-q),max(1,l['stocks'][stock_idx]-1),COLORS[op])

    # The first brown dose loads the injector; additional recovered doses
    # fill a fixed-scale enclosed magazine (one pixel per dose).
    x,y,w,h=SIMPLE_BODIES[8]
    offset = 0
    offset = max(0,min(6,offset))
    cx=x-offset
    connected=offset==0 and v['compost']>0
    ink=8 if warn_op==8 else (0 if connected else 3)
    amount=min(q,v['compost'])
    barrel([cx,y,w,h],amount,q,13,ink,False)
    # The brown wire is drawn by WIRE_LAYOUT only, with the same retracting
    # two-pixel gap as the other wires; no white socket or overpainted connector.
    # Extra stock, not the next dose, is shown in the attached magazine.
    if offset==0:
        extra=max(0,v['compost']-q)
        if l['waste']>1 or extra>0:
            segment(x-1,y+h-2,x,y+h-2,3)
            attached_cartridge([x-4,y+1,3,h-1],extra,max(h-3,l['waste']-1),13)

    feed_colors={2:[12,6],3:[13],4:[11,9],5:[10,11,9]}
    for op in (2,3,4,5):
        x,y,w,h=RECTS[op]
        output_loaded=v['products'][op]>0
        producing=v['processes'][op]>0 or op in running
        for j,port_y in enumerate(FEED_PORTS[op]):
            full=v['feeds'][op][j]>=q
            barrel([x+1,port_y-1,4,3],v['feeds'][op][j],q,feed_colors[op][j],0 if full else 3)
        process_ink=8 if warn_op==op else (0 if producing or (can(s,op) and not output_loaded and not (op==3 and s[6]>0)) else 3)
        barrel([x+5,y+5,4,h-6],v['processes'][op],q,0,process_ink)
        if producing:
            wheel(x+6,y+2,2,0)
        else:
            fill(x+5,y+1,4,1,process_ink); fill(x+6,y+2,1,2,process_ink)
        barrel([x+10,y+1,4,h-2],v['products'][op],LIFE[op]*q,13 if op in recycling else COLORS[op],0 if output_loaded else 3)
        fill(x+9,y+h-3,1,1,COLORS[op] if output_loaded else 4)
        if op==3:
            attached_cartridge([x+10,y+h-1,4,3],v['quantity'],max(1,l['initial_n']),11,False)
            if s[6]>0 and not output_loaded:box(x+10,y+h-1,4,3,0)
        if op==4 and l['stocks'][2]>0:
            # Enclosed seed magazine stays above the progress bars (y<=60).
            fill(x+2,y+h-2,1,1,3)
            attached_cartridge([x+1,y+h-1,max(3,l['stocks'][2]+2),3],v['stocks'][2],l['stocks'][2],9,False)
        if warn_op==op:box(x-1,y-1,w+2,h+2,8)

    # Recipient is passive. Dividers run all the way across the interior.
    rect=SIMPLE_BODIES[6]
    barrel(rect,v['delivered'],l['goal']*q,14,3)
    x,y,w,h=rect
    for j in range(1,l['goal']):
        mark=y+h-1-((h-2)*j//l['goal'])
        fill(x+1,mark,w-2,1,0)
    for i in range(6):fill(2+i*6,63,5,1,14 if completed[i] else 4)
    if border is not None:box(0,14,64,46,border)
    # Draw last, so fluid animation and feedback never erase the threshold.
    fill(*green_threshold_rect(l),0)
    return f


@dataclass(frozen=True)
class SporeLabInfo:
    game_id: str = GAME_ID
    title: str = 'Spore Lab'
    family: str = FAMILY
    levels: int = 6
    default_fps: int = FPS


class SporeLabEngine:
    """Custom-backend adapter. This does not register a game in the official SDK."""
    def __init__(self, info: Any=None, *, levels: list|None=None, levels_dir: str|Path|None=None, animate: bool=True):
        if levels is not None and levels_dir is not None:raise ValueError('Use levels OR levels_dir.')
        if levels_dir is not None:
            paths=sorted(Path(levels_dir).glob('L[0-9][0-9].json'))
            if not paths:raise FileNotFoundError('No Lxx.json levels found.')
            levels=[json.loads(p.read_text(encoding='utf-8-sig')) for p in paths]
        bank=DEFAULT_LEVELS if levels is None else levels
        if not isinstance(bank,list) or not 1<=len(bank)<=6:raise ValueError('One to six levels required.')
        self.info=info or SporeLabInfo(levels=len(bank));self.levels=[validate_level(l) for l in bank]
        self.animate=bool(animate);self.reset()
    def _setup(self,index):
        self.index=index;self.local=initial(self.levels[index]);self.used=0;self.state='NOT_FINISHED'
    def observe(self):
        l=self.levels[self.index];s=self.local;f=render(l,s,self.used,self.completed)
        ids=[5,6,7] if self.state=='NOT_FINISHED' else [7]
        return dict(game_id=self.info.game_id,title=self.info.title,custom_family=FAMILY,wave=WAVE,revision=REVISION,
            state=self.state,level=self.index+1,levels_completed=sum(self.completed),win_levels=len(self.levels),score=sum(self.completed),
            frame=f,frames=[f],frame_count=1,frame_durations_ms=[0],palette=PALETTE[:],default_fps=FPS,
            available_action_ids=ids,available_actions=['ACTION'+str(i) for i in ids],step_index=self.step_index,
            total_actions=self.total_actions,level_actions=self.used,action_limit=l['budget'],actions_remaining=l['budget']-self.used,
            delivered=s[17],target=l['goal'],min_fresh=l['min_fresh'],restarts=self.restarts,test_mode=self.test_mode,last_event=self.last_event,
            wait_needed=self.state=='NOT_FINISHED' and not useful_actions(s,l['min_fresh']))
    public_state=observe
    def view(self):
        out=self.observe();out.pop('frames');out.pop('frame')
        out.update(title=self.levels[self.index]['title'],life=self.local[:6],nutrients=self.local[6],jobs=self.local[7:13],
                   stocks=self.local[13:16],compost=self.local[16],completed=self.completed[:],ready=[can(self.local,i) for i in range(9)],
                   stable_feeds={op:[self.local[j] for j in slots] for op,slots in FEED_INDEX.items()},
                   wait_needed=not useful_actions(self.local,self.levels[self.index]['min_fresh']))
        return out
    def _packet(self,event,frames=None,durations=None,**extra):
        self.last_event=event;out=self.observe();out.update(event=event,**extra)
        if frames:out.update(frame=frames[-1],frames=frames,frame_count=len(frames),frame_durations_ms=durations)
        return out
    def reset(self):
        self.completed=[False]*6;self.test_mode=False;self.step_index=self.total_actions=self.restarts=0
        self.last_event='reset';self._setup(0);return self._packet('reset')
    def level_reset(self):
        self.completed[self.index]=False;self.restarts+=1;self._setup(self.index);return self._packet('reset_level')
    def jump_to_level(self,n):
        if not integer(n) or not 1<=n<=len(self.levels):raise ValueError('Invalid level.')
        self.reset();self.test_mode=True;self._setup(n-1);return self._packet('preview')
    def action(self,action_id:Any,data:dict|None=None):
        if isinstance(action_id,dict):
            p=action_id;data=p.get('data');action_id=p.get('id',p.get('action_ref',p.get('action')))
        action_id=getattr(action_id,'value',action_id)
        if action_id=='RESET' or (integer(action_id) and action_id==0):return self.reset()
        if isinstance(action_id,str) and action_id in ('ACTION5','ACTION6','ACTION7'):action_id=int(action_id[-1])
        if not integer(action_id) or action_id not in (5,6,7):return self._packet('ignored')
        if action_id==7:return self.level_reset()
        if self.state!='NOT_FINISHED':return self._packet('finished')
        if action_id==6 and (not isinstance(data,dict) or not all(integer(data.get(k)) and 0<=data[k]<64 for k in ('x','y'))):return self._packet('ignored')
        op=7 if action_id==5 else click_op(self.local, data['x'], data['y'])
        if op is None:return self._packet('ignored')
        l=self.levels[self.index];before=self.local[:];r=transition(l,self.local,op);self.local=r['state'];self.used+=1
        self.step_index+=1;self.total_actions+=1;s=self.local;event=r['event'];frames=[];ds=[]
        extra=dict(played_level=self.index+1,operation=OPS[op],spoiled=r['spoiled'],made=r['made'])
        fail=event=='hatched';win=not fail and s[17]>=l['goal']
        if not win and not fail and self.used>=l['budget']:fail=True;event='exhausted'
        if self.animate:
            views=action_visuals(l,before,s,op,r)
            for i,item in enumerate(views):
                frames.append(render(l,s,self.used,self.completed,op,
                    spin=2*(self.used-1)+10*i//max(1,len(views)-1),running=item['running'],
                    visual=item['visual'],used_fp=(self.used-1)*ANIM_SCALE+item['used_phase']*ANIM_SCALE//20,
                    recycling=item['recycling']))
                ds.append(FRAME_MS)
            if (r['event']=='blocked' and op!=7) or r['event']=='stale':
                for _ in range(3):
                    frames.append(render(l,s,self.used,self.completed,warn_op=op));ds.append(120)
                    frames.append(render(l,s,self.used,self.completed));ds.append(90)
        if win or fail:
            if self.animate:
                for _ in range(3):
                    frames.append(render(l,s,self.used,self.completed,border=14 if win else 8));ds.append(240)
                    frames.append(render(l,s,self.used,self.completed));ds.append(170)
            extra.update(completed_actions=self.used if win else None,auto_reset=fail)
            if fail:self.restarts+=1;self._setup(self.index)
            else:
                self.completed[self.index]=True
                if self.test_mode:self.state='LEVEL_COMPLETE'
                elif self.index+1==len(self.levels):self.state='WIN'
                else:self._setup(self.index+1)
                event='win' if self.state=='WIN' else 'success'
        frames.append(self.observe()['frame']);ds.append(0)
        return self._packet(event,frames,ds,**extra)
    step=action
    levelReset=level_reset
    jumpToLevel=jump_to_level

if __name__=='__main__':
    print(json.dumps(SporeLabEngine().observe(),ensure_ascii=False))
