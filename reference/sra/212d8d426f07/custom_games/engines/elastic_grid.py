"""ELASTIC: faithful Python port of the approved web v3 puzzle.

Runtime: Python 3.10+, standard library only. No GUI is imported here.
ACTION1..4 move up/down/left/right; 5 cycles visible tiles; 6 selects at
64x64 frame coordinates; 7 restarts the current level. Completion returns
three green/grey outline pulses before the next level's frame.

The pure functions mirror the web engine. The adapter at the end adds the
custom ARC3 backend contract; it is not an arc_agi package subclass.
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

FRAME = 64
PALETTE = (
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#921231', '#4FCC30', '#A356D6',
)
COLORS = (8, 9, 11, 14, 12, 15, 10, 6, 13)
NAMES = {8: 'red', 9: 'blue', 11: 'yellow', 14: 'green', 12: 'orange',
         15: 'purple', 10: 'cyan', 6: 'magenta', 13: 'maroon'}
SCALES = (2, 3, 4)
ACTION_DELTAS = {1: (-1, 0), 2: (1, 0), 3: (0, -1), 4: (0, 1)}
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'elastic_grid' / 'levels'
Level = dict[str, Any]
State = dict[str, Any]
Frame = list[list[int]]


def _is_int(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return abs(value) <= 9007199254740991
    return (isinstance(value, float) and math.isfinite(value)
            and value.is_integer() and abs(value) <= 9007199254740991)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def prefix(values: list[int]) -> list[int]:
    result = [0]
    for value in values:
        result.append(result[-1] + value)
    return result


def trim_raster(image: Frame) -> dict[str, Any]:
    h, w = len(image), len(image[0]) if image else 0
    left, top, right, bottom = w, h, -1, -1
    for y, row in enumerate(image):
        for x, color in enumerate(row):
            if color != 5:
                left, top = min(left, x), min(top, y)
                right, bottom = max(right, x), max(bottom, y)
    if right < 0:
        return dict(pixels=[], x=0, y=0, width=0, height=0)
    return dict(pixels=[row[left:right + 1] for row in image[top:bottom + 1]],
                x=left, y=top, width=right - left + 1, height=bottom - top + 1)


def validate_level(raw: Any) -> Level:
    _require(isinstance(raw, dict), 'A level must be an object.')
    for key in ('columns', 'rows'):
        values = raw.get(key)
        _require(isinstance(values, list) and 2 <= len(values) <= 12,
                 f'{key}: use 2–12 cell sizes.')
        _require(all(_is_int(n) and 3 <= n <= 30 for n in values),
                 f'{key}: each size must be an integer from 3 to 30 pixels.')
    _require(sum(raw['columns']) <= 60, 'Column widths must total at most 60 pixels.')
    _require(sum(raw['rows']) <= 46, 'Row heights must total at most 46 pixels.')
    legend = raw.get('legend')
    _require(isinstance(legend, list) and 1 <= len(legend) <= 14,
             'Legend height must be 1–14 pixels.')
    _require(isinstance(legend[0], list) and 1 <= len(legend[0]) <= 20,
             'Legend width must be 1–20 pixels.')
    width = len(legend[0])
    _require(all(isinstance(row, list) and len(row) == width and
                 all(_is_int(c) and (c == 5 or c in COLORS) for c in row)
                 for row in legend),
             'Legend rows must have equal width; use black (5) or a supported piece colour.')
    _require(trim_raster(legend)['width'] > 0, 'The legend needs at least one coloured pixel.')
    values = raw.get('pieces')
    _require(isinstance(values, list) and 1 <= len(values) <= 64, 'Use 1–64 pieces.')
    ids: set[str] = set()
    pieces = []
    for i, p in enumerate(values):
        _require(isinstance(p, dict), f'Piece {i + 1} is invalid.')
        pid = str(p['id']) if p.get('id') is not None else f'P{i + 1}'
        _require(re.fullmatch(r'[A-Za-z0-9_-]{1,32}', pid) is not None and pid not in ids,
                 'Piece IDs must be unique, 1–32 letters, numbers, _ or -.')
        ids.add(pid)
        _require(_is_int(p.get('color')) and p['color'] in COLORS,
                 f'{pid}: unsupported piece colour.')
        _require(_is_int(p.get('row')) and _is_int(p.get('col')) and
                 0 <= p['row'] < len(raw['rows']) and 0 <= p['col'] < len(raw['columns']),
                 f'{pid}: outside the grid.')
        pieces.append(dict(id=pid, color=int(p['color']), row=int(p['row']), col=int(p['col'])))
    def text(key: str, fallback: str, limit: int) -> str:
        return str(raw[key] if raw.get(key) is not None else fallback)[:limit]
    return dict(version=1, id=text('id', 'custom', 40), title=text('title', 'Untitled study', 80),
                description=text('description', 'Reproduce the legend.', 300),
                columns=[int(x) for x in raw['columns']], rows=[int(x) for x in raw['rows']],
                legend=[[int(x) for x in row] for row in legend], pieces=pieces)


def validate_pack(raw: Any) -> list[Level]:
    values = (raw if isinstance(raw, list) else raw['levels']
              if isinstance(raw, dict) and isinstance(raw.get('levels'), list) else [raw])
    _require(1 <= len(values) <= 30, 'Import between 1 and 30 levels.')
    return [validate_level(value) for value in values]


def load_levels(path: str | Path = LEVELS_DIR) -> list[Level]:
    """Read a web-compatible single level/pack JSON or directory of L*.json."""
    path = Path(path)
    if path.is_file():
        return validate_pack(json.loads(path.read_text(encoding='utf-8-sig')))
    paths = sorted(path.glob('L*.json'))
    if not paths:
        raise FileNotFoundError(f'No L*.json level files in {path}')
    return validate_pack([json.loads(p.read_text(encoding='utf-8-sig')) for p in paths])


def geometry(level: Level) -> dict[str, Any]:
    width, height = sum(level['columns']), sum(level['rows'])
    return dict(x=(FRAME - width) // 2, y=1, width=width, height=height,
                xs=prefix(level['columns']), ys=prefix(level['rows']),
                cols=len(level['columns']), rows=len(level['rows']))


def cell_bounds(level: Level, row: int, col: int) -> dict[str, int] | None:
    if not (_is_int(row) and _is_int(col) and 0 <= row < len(level['rows'])
            and 0 <= col < len(level['columns'])):
        return None
    row, col = int(row), int(col)
    g = geometry(level)
    return dict(x=g['x'] + g['xs'][col], y=g['y'] + g['ys'][row],
                w=level['columns'][col], h=level['rows'][row])


def hit_cell(level: Level, x: Any, y: Any) -> dict[str, int] | None:
    if any(not isinstance(v, (int, float)) or isinstance(v, bool)
           or (isinstance(v, float) and not math.isfinite(v))
           for v in (x, y)):
        return None
    g = geometry(level)
    xx, yy = x - g['x'], y - g['y']
    if not (0 <= xx < g['width'] and 0 <= yy < g['height']):
        return None
    row = next(i for i in range(g['rows']) if g['ys'][i] <= yy < g['ys'][i + 1])
    col = next(i for i in range(g['cols']) if g['xs'][i] <= xx < g['xs'][i + 1])
    return dict(row=row, col=col)


def index(level: Level, row: int, col: int) -> int:
    return row * len(level['columns']) + col


def cell(level: Level, i: int) -> dict[str, int]:
    return dict(row=i // len(level['columns']), col=i % len(level['columns']))


def color_map(level: Level) -> dict[str, int]:
    return {p['id']: p['color'] for p in level['pieces']}


def create_state(level: Level) -> State:
    stacks: list[list[str]] = [[] for _ in range(len(level['rows']) * len(level['columns']))]
    for piece in level['pieces']:
        stacks[index(level, piece['row'], piece['col'])].append(piece['id'])
    state = dict(stacks=stacks, selected=None, moves=0, solved=False,
                 matchScale=None, lastEvent='READY')
    m = match(level, state)
    if m['solved']:
        state.update(solved=True, matchScale=m['scale'])
    return state


def copy_state(state: State) -> State:
    return {**state, 'stacks': [list(stack) for stack in state['stacks']]}


def top_at(level: Level, state: State, row: int, col: int) -> str | None:
    if not (0 <= row < len(level['rows']) and 0 <= col < len(level['columns'])):
        return None
    stack = state['stacks'][index(level, row, col)]
    return stack[-1] if stack else None


def locate(state: State, pid: str | None) -> dict[str, Any] | None:
    for i, stack in enumerate(state['stacks']):
        if pid in stack:
            depth = stack.index(pid)
            return dict(i=i, depth=depth, top=depth == len(stack) - 1)
    return None


def visible_ids(state: State) -> list[str]:
    return [stack[-1] for stack in state['stacks'] if stack]


def raster(level: Level, state: State) -> Frame:
    """Scoring image. No checkerboard, HUD, reference or selection outline."""
    g, colors = geometry(level), color_map(level)
    image = [[5] * g['width'] for _ in range(g['height'])]
    for i, stack in enumerate(state['stacks']):
        if not stack:
            continue
        r, c = divmod(i, g['cols'])
        stripe = [colors[stack[-1]]] * level['columns'][c]
        for y in range(g['ys'][r], g['ys'][r + 1]):
            image[y][g['xs'][c]:g['xs'][c + 1]] = stripe
    return image


def match(level: Level, state: State) -> dict[str, Any]:
    a, b = trim_raster(raster(level, state)), trim_raster(level['legend'])
    if not a['width'] or not b['width']:
        return dict(solved=False)
    for scale in SCALES:
        if a['width'] != b['width'] * scale or a['height'] != b['height'] * scale:
            continue
        if all(a['pixels'][y][x] == b['pixels'][y // scale][x // scale]
               for y in range(a['height']) for x in range(a['width'])):
            return dict(solved=True, scale=scale, x=a['x'], y=a['y'],
                        width=a['width'], height=a['height'])
    return dict(solved=False)


def transition(level: Level, state: State, move: Any) -> State:
    """Pure transition; never mutates its level, state or action input."""
    if not isinstance(move, dict):
        return state
    kind = move.get('type')
    if kind == 'reset':
        return create_state(level)
    if state['solved']:
        return state
    if kind == 'select':
        r, c = move.get('row'), move.get('col')
        if not (_is_int(r) and _is_int(c) and 0 <= r < len(level['rows'])
                and 0 <= c < len(level['columns'])):
            return state
        selected = top_at(level, state, int(r), int(c))
        return {**state, 'selected': selected, 'lastEvent': 'SELECTED' if selected else 'DESELECTED'}
    if kind == 'deselect':
        return {**state, 'selected': None, 'lastEvent': 'DESELECTED'}
    if kind == 'cycle':
        ids = visible_ids(state)
        at = ids.index(state['selected']) if state['selected'] in ids else -1
        return {**state, 'selected': ids[(at + 1) % len(ids)] if ids else None, 'lastEvent': 'SELECTED'}
    if kind == 'move':
        dr, dc = move.get('dr'), move.get('dc')
        if not (_is_int(dr) and _is_int(dc) and abs(dr) + abs(dc) == 1):
            return state
        pos = locate(state, state['selected'])
        if not pos or not pos['top']:
            return {**state, 'lastEvent': 'NO_SELECTION'}
        old = cell(level, pos['i'])
        r, c = old['row'] + int(dr), old['col'] + int(dc)
        if not (0 <= r < len(level['rows']) and 0 <= c < len(level['columns'])):
            return {**state, 'lastEvent': 'EDGE'}
        result = copy_state(state)
        result['stacks'][pos['i']].pop()
        result['stacks'][index(level, r, c)].append(state['selected'])
        result['moves'] += 1
        result['lastEvent'] = 'STACKED' if len(result['stacks'][index(level, r, c)]) > 1 else 'MOVED'
        m = match(level, result)
        result.update(solved=m['solved'], matchScale=m.get('scale'))
        if m['solved']:
            result['lastEvent'] = 'SOLVED'
        return result
    return state


def action(level: Level, state: State, action_id: int, data: Mapping[str, Any] | None = None) -> State:
    if not _is_int(action_id):
        return state
    action_id = int(action_id)
    if action_id in ACTION_DELTAS:
        dr, dc = ACTION_DELTAS[action_id]
        return transition(level, state, dict(type='move', dr=dr, dc=dc))
    if action_id == 5:
        return transition(level, state, dict(type='cycle'))
    if action_id == 6:
        data = data if isinstance(data, Mapping) else {}
        hit = hit_cell(level, data.get('x'), data.get('y'))
        return transition(level, state, dict(type='select', **hit)) if hit else state
    if action_id == 7:
        return create_state(level)
    return state


def snapshot_level(level: Level, state: State) -> Level:
    colors = color_map(level)
    pieces = [dict(id=pid, color=colors[pid], **cell(level, i))
              for i, stack in enumerate(state['stacks']) for pid in stack]
    return validate_level({**level, 'pieces': pieces})


def draw_level_counter(frame: Frame, progress: dict[str, int] | None, solved: bool = False) -> None:
    if (not progress or not _is_int(progress.get('current')) or not _is_int(progress.get('total'))
            or not 1 <= progress['current'] <= progress['total'] <= 30):
        return
    total, current = int(progress['total']), int(progress['current'])
    done = current - 1 + int(solved)
    columns = min(total, 10)
    rows = math.ceil(total / columns)
    width = min(5, (39 - (columns - 1)) // columns)
    y0 = 63 - (rows * 2 + rows - 1)
    for i in range(total):
        left, top = 2 + (i % columns) * (width + 1), y0 + (i // columns) * 3
        for y in range(top, top + 2):
            frame[y][left:left + width] = [14 if i < done else 3] * width


def outline_cells(level: Level) -> set[tuple[int, int]]:
    """(row, column) pixels of the outer grid border, excluding HUD/legend."""
    g = geometry(level)
    return ({(y, x) for y in (0, g['height'] + 1)
             for x in range(g['x'] - 1, g['x'] + g['width'] + 1)} |
            {(y, x) for y in range(g['height'] + 2)
             for x in (g['x'] - 1, g['x'] + g['width'])})


def render(level: Level, state: State, progress: dict[str, int] | None = None,
           *, outline_color: int | None = None) -> Frame:
    frame = [[5] * FRAME for _ in range(FRAME)]
    colors = color_map(level)
    border = (14 if state['solved'] else 3) if outline_color is None else outline_color
    for y, x in outline_cells(level):
        frame[y][x] = border
    for r in range(len(level['rows'])):
        for c in range(len(level['columns'])):
            b = cell_bounds(level, r, c)
            top = top_at(level, state, r, c)
            color = colors[top] if top else (4 if (r + c) % 2 else 5)
            for y in range(b['y'], b['y'] + b['h']):
                frame[y][b['x']:b['x'] + b['w']] = [color] * b['w']
            if top and top == state['selected'] and not state['solved']:
                for x in range(b['x'], b['x'] + b['w']):
                    frame[b['y']][x] = frame[b['y'] + b['h'] - 1][x] = 0
                for y in range(b['y'], b['y'] + b['h']):
                    frame[y][b['x']] = frame[y][b['x'] + b['w'] - 1] = 0
    lx, ly = 63 - len(level['legend'][0]), 63 - len(level['legend'])
    for y, row in enumerate(level['legend']):
        frame[ly + y][lx:lx + len(row)] = row
    draw_level_counter(frame, progress, state['solved'])
    return frame


def completion_frames(level: Level, state: State, progress: dict[str, int],
                      fps: float = 8, blinks: int = 3) -> list[Frame]:
    """Three 2 Hz green/grey pulses and a final green hold; independent frames.

    The solved image, legend and completed bars remain unchanged throughout.
    No sleeps or wall-clock dependence: the caller schedules these frames.
    """
    _require(math.isfinite(fps) and fps > 0, 'fps must be positive and finite.')
    _require(_is_int(blinks) and 1 <= blinks <= 10, 'Use 1–10 blinks.')
    phase = max(1, math.ceil(fps / 4))
    colors = [color for _ in range(int(blinks)) for color in (14, 3)] + [14]
    return [render(level, state, progress, outline_color=color)
            for color in colors for _ in range(phase)]


def analyze(level: Level) -> dict[str, Any]:
    """Exact geometric feasibility and colour inventory (inspection only)."""
    g, leg = geometry(level), trim_raster(level['legend'])
    inventory = dict(Counter(p['color'] for p in level['pieces']))
    candidates, geometric = [], []
    for scale in SCALES:
        width, height = leg['width'] * scale, leg['height'] * scale
        for x in g['xs'][:-1]:
            for y in g['ys'][:-1]:
                if x + width not in g['xs'] or y + height not in g['ys']:
                    continue
                desired, need, ok = [5] * (g['rows'] * g['cols']), {}, True
                def at(xx: int, yy: int) -> int:
                    return (leg['pixels'][(yy - y) // scale][(xx - x) // scale]
                            if x <= xx < x + width and y <= yy < y + height else 5)
                for r in range(g['rows']):
                    for c in range(g['cols']):
                        expected = at(g['xs'][c], g['ys'][r])
                        if any(at(xx, yy) != expected
                               for yy in range(g['ys'][r], g['ys'][r + 1])
                               for xx in range(g['xs'][c], g['xs'][c + 1])):
                            ok = False
                            break
                        desired[index(level, r, c)] = expected
                        if expected != 5:
                            need[expected] = need.get(expected, 0) + 1
                    if not ok:
                        break
                if not ok:
                    continue
                shortages = [str(k) for k in sorted(need) if inventory.get(k, 0) < need[k]]
                candidate = dict(scale=scale, x=x, y=y, desired=desired, need=need,
                                 shortages=shortages, visibleCount=sum(need.values()),
                                 emptyCount=desired.count(5))
                geometric.append(candidate)
                if not shortages:
                    candidates.append(candidate)
    return dict(candidates=candidates, geometric=geometric,
                possibleScales=list(dict.fromkeys(c['scale'] for c in candidates)), inventory=inventory)


def _distance(level: Level, a: int, b: int) -> int:
    p, q = cell(level, a), cell(level, b)
    return abs(p['row'] - q['row']) + abs(p['col'] - q['col'])


def _rank_candidate(level: Level, state: State, candidate: dict[str, Any]) -> int:
    colors, score = color_map(level), 0
    for i, expected in enumerate(candidate['desired']):
        stack = state['stacks'][i]
        color = colors[stack[-1]] if stack else 5
        if color != expected:
            score += 3
        if expected != 5 and color != expected:
            score += min((_distance(level, i, j) for j, a in enumerate(state['stacks'])
                          if any(colors[pid] == expected for pid in a)), default=1000)
    return score


def plan(level: Level, start: State) -> dict[str, Any]:
    """Port of the constructive web planner. Legal, not minimum-length paths.

    Dense custom targets without two empty buffer cells report 'unsupported',
    not 'impossible'. Called only by explicit testing/hint tools, never gameplay.
    """
    m = match(level, start)
    if m['solved']:
        return dict(status='solved', actions=[], scale=m['scale'])
    analysis = analyze(level)
    if not analysis['candidates']:
        return dict(status='impossible', actions=[], reason=(
            'Not enough pieces of a required colour.' if analysis['geometric'] else
            'No exact ×2, ×3 or ×4 image fits the cell geometry.'))
    ranked = sorted(analysis['candidates'], key=lambda c: _rank_candidate(level, start, c))
    best = None
    for candidate in ranked[:24]:
        empties = [i for i, v in enumerate(candidate['desired']) if v == 5]
        if len(empties) < 2:
            continue
        s, actions = copy_state(start), []
        colors = color_map(level)
        def record(a: dict[str, Any]) -> None:
            nonlocal s
            if s['solved']:
                return
            n = transition(level, s, a)
            if n is s:
                return
            actions.append(a)
            s = n
        def route(pid: str, dest: int) -> None:
            if s['solved']:
                return
            p = locate(s, pid)
            _require(bool(p and p['top']), 'Planner tried to move a buried piece.')
            q, t = cell(level, p['i']), cell(level, dest)
            if p['i'] == dest:
                return
            if s['selected'] != pid:
                record(dict(type='select', **q))
            while q['col'] != t['col'] and not s['solved']:
                dc = 1 if t['col'] > q['col'] else -1
                record(dict(type='move', dr=0, dc=dc))
                q['col'] += dc
            while q['row'] != t['row'] and not s['solved']:
                dr = 1 if t['row'] > q['row'] else -1
                record(dict(type='move', dr=dr, dc=0))
                q['row'] += dr
        goals = [i for i, v in enumerate(candidate['desired']) if v != 5]
        seen = set()
        for _ in range(len(level['pieces']) * 6):
            if s['solved']:
                break
            key = tuple(tuple(a) for a in s['stacks'])
            if key in seen:
                break
            seen.add(key)
            wrong = [i for i in goals if (colors[s['stacks'][i][-1]] if s['stacks'][i] else None)
                     != candidate['desired'][i]]
            if not wrong:
                outside = next((i for i in empties if s['stacks'][i]), None)
                if outside is None:
                    break
                anchor = goals[0]
                cap, extra = s['stacks'][anchor][-1], s['stacks'][outside][-1]
                scratch = next((i for i in empties if i != outside and not s['stacks'][i]), None)
                if scratch is None:
                    scratch = next(i for i in empties if i != outside)
                route(cap, scratch)
                route(extra, anchor)
                route(cap, anchor)
                continue
            pick = None
            for dest in wrong:
                for p in level['pieces']:
                    if p['color'] != candidate['desired'][dest]:
                        continue
                    pos = locate(s, p['id'])
                    if pos is None or (pos['top'] and candidate['desired'][pos['i']] == p['color']):
                        continue
                    cost = ((len(s['stacks'][pos['i']]) - pos['depth'] - 1) * 12
                            + _distance(level, pos['i'], dest))
                    if pick is None or cost < pick['cost']:
                        pick = dict(id=p['id'], source=pos['i'], dest=dest, cost=cost)
            if pick is None:
                break
            buffer = min((i for i in empties if i not in (pick['source'], pick['dest'])),
                         key=lambda i: _distance(level, pick['source'], i))
            while not locate(s, pick['id'])['top'] and not s['solved']:
                route(s['stacks'][pick['source']][-1], buffer)
            route(pick['id'], pick['dest'])
        if not s['solved']:
            # Universal two-buffer fallback, identical order to the web version.
            s, actions = copy_state(start), []
            depot = min(empties, key=lambda a: sum(len(stack) * _distance(level, a, i)
                                                  for i, stack in enumerate(s['stacks'])))
            scratch = next(i for i in empties if i != depot)
            for i in range(len(s['stacks'])):
                if i != depot:
                    while s['stacks'][i] and not s['solved']:
                        route(s['stacks'][i][-1], depot)
            if not s['solved']:
                anchor = min(goals, key=lambda i: _distance(level, i, depot))
                remaining, cap = [i for i in goals if i != anchor], None
                while s['stacks'][depot] and not s['solved']:
                    pid = s['stacks'][depot][-1]
                    color = colors[pid]
                    dest = next((i for i in remaining if candidate['desired'][i] == color), None)
                    if dest is not None:
                        remaining.remove(dest)
                        route(pid, dest)
                    elif color == candidate['desired'][anchor] and cap is None:
                        cap = pid
                        route(pid, scratch)
                    else:
                        route(pid, anchor)
                if not s['solved']:
                    _require(cap is not None and not remaining, 'Invalid constructive allocation.')
                    route(cap, anchor)
        _require(match(level, s)['solved'], 'Planner replay did not solve the exact image.')
        result = dict(status='ok', actions=actions, scale=s['matchScale'], rotations=0,
                      moves=sum(a['type'] == 'move' for a in actions))
        if best is None or result['moves'] < best['moves']:
            best = result
    return best or dict(status='unsupported', actions=[], reason=(
        'A geometric solution exists, but automatic replay needs two non-target buffer cells. '
        'Manual play remains available.'))


def capture_legend(level: Level, state: State, scale: int) -> Frame:
    _require(_is_int(scale) and scale in SCALES, 'Capture scale must be 2, 3 or 4.')
    scale = int(scale)
    image = trim_raster(raster(level, state))
    _require(bool(image['width']) and image['width'] % scale == 0 and image['height'] % scale == 0,
             'The visible image dimensions do not divide evenly by this scale.')
    result = []
    for y in range(0, image['height'], scale):
        row = []
        for x in range(0, image['width'], scale):
            color = image['pixels'][y][x]
            _require(all(image['pixels'][y + dy][x + dx] == color
                         for dy in range(scale) for dx in range(scale)),
                     'This image contains a colour boundary inside a reduced pixel.')
            row.append(color)
        result.append(row)
    _require(len(result) <= 14 and len(result[0]) <= 20, 'Captured legend exceeds 20 × 14 pixels.')
    return result


def to_backend_action(level: Level, command: dict[str, Any]) -> tuple[int, dict[str, int]]:
    """Convert a planner command to a regular backend action (no teleport)."""
    kind = command.get('type')
    if kind == 'select':
        b = cell_bounds(level, command['row'], command['col'])
        _require(b is not None, 'Selection outside board.')
        return 6, dict(x=b['x'] + b['w'] // 2, y=b['y'] + b['h'] // 2)
    if kind == 'move':
        delta = (command['dr'], command['dc'])
        for aid, value in ACTION_DELTAS.items():
            if value == delta:
                return aid, {}
    if kind == 'cycle':
        return 5, {}
    if kind == 'reset':
        return 7, {}
    raise ValueError(f'Unsupported planner command: {command!r}')


@dataclass(frozen=True)
class GameInfo:
    """Standalone defaults. Your registry's info object can be passed instead."""
    game_id: str = 'elastic_grid'
    title: str = 'ELASTIC'
    family: str = 'elastic_grid'
    levels: int = 6
    default_fps: float = 8


class ElasticGridEngine:
    """Custom ARC3-style backend, with automatic progression by default.

    animate=False omits only the green-outline animation, never game rules.
    auto_advance=False keeps the solved level visible until next_level().
    This option is used by the native viewer, not by agent evaluation.
    """
    def __init__(self, info: Any = None, *, levels_dir: str | Path | None = None,
                 levels: Any = None, animate: bool = True, auto_advance: bool = True,
                 start_level: int = 1, completion_blinks: int = 3) -> None:
        _require(levels_dir is None or levels is None, 'Pass levels or levels_dir, not both.')
        templates = validate_pack(levels) if levels is not None else load_levels(levels_dir or LEVELS_DIR)
        self.info = info if info is not None else GameInfo(levels=len(templates))
        count = getattr(self.info, 'levels', len(templates))
        _require(_is_int(count) and 1 <= count <= len(templates), 'info.levels exceeds the loaded levels.')
        fps = getattr(self.info, 'default_fps', 8)
        _require(isinstance(fps, (int, float)) and not isinstance(fps, bool)
                 and 0 < fps <= 120 and math.isfinite(fps), 'default_fps must be in (0, 120].')
        _require(_is_int(completion_blinks) and 1 <= completion_blinks <= 10, 'Use 1–10 completion blinks.')
        self._templates = templates[:int(count)]
        self.win_levels = int(count)
        self.default_fps = float(fps)
        self.animate, self.auto_advance = bool(animate), bool(auto_advance)
        self.completion_blinks = int(completion_blinks)
        self.source_path = str(levels_dir or LEVELS_DIR) if levels is None else '<in-memory levels>'
        self.step_index = self.level_steps = self.levels_completed = 0
        self.level_index = 0
        self.last_action = 'RESET'
        self._board = create_state(self._templates[0])
        self.state = 'NOT_FINISHED'
        self.load_level(start_level)

    @property
    def level(self) -> Level:
        """Detached level definition, safe for testing tools to inspect."""
        return deepcopy(self._templates[self.level_index])

    @property
    def board(self) -> State:
        return copy_state(self._board)

    def _sync_status(self) -> None:
        self.levels_completed = self.level_index + int(self._board['solved'])
        self.state = 'WIN' if self.levels_completed == self.win_levels else 'NOT_FINISHED'

    def reset(self) -> dict[str, Any]:
        self.step_index = 0
        return self.load_level(1)

    def load_level(self, number: int) -> dict[str, Any]:
        """Testing/viewer convenience. Normal episodes use reset()/action()."""
        _require(_is_int(number) and 1 <= number <= self.win_levels, 'Invalid level number.')
        self.level_index = int(number) - 1
        self._board = create_state(self._templates[self.level_index])
        self.level_steps = 0
        self.last_action = 'RESET'
        self._sync_status()
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self._board = create_state(self._templates[self.level_index])
        self.level_steps = 0
        self.last_action = 'ACTION7'
        self._sync_status()
        return self.public_state()

    def next_level(self) -> dict[str, Any]:
        if self._board['solved'] and self.level_index + 1 < self.win_levels:
            return self.load_level(self.level_index + 2)
        return self.public_state()

    def action(self, action_id: int, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if not _is_int(action_id) or action_id not in range(1, 8):
            return self.public_state()
        aid = int(action_id)
        if aid == 7:
            self.step_index += 1
            return self.level_reset()
        if self._board['solved']:
            return self.public_state()
        self.last_action = f'ACTION{aid}'
        self.step_index += 1
        self.level_steps += 1
        level = self._templates[self.level_index]
        self._board = action(level, self._board, aid, data)
        if not self._board['solved']:
            return self.public_state()
        self._sync_status()
        completed_number = self.level_index + 1
        frames = completion_frames(level, self._board,
                                   dict(current=completed_number, total=self.win_levels),
                                   self.default_fps, self.completion_blinks) if self.animate else []
        if self.auto_advance and self.level_index + 1 < self.win_levels:
            self.level_index += 1
            self._board = create_state(self._templates[self.level_index])
            self.level_steps = 0
            self._sync_status()
        result = self.public_state()
        result['last_event'] = 'GAME_WON' if self.state == 'WIN' else 'LEVEL_COMPLETE'
        result['completed_level'] = completed_number
        if frames:
            result['frames'] = frames + [result['frame']]
            result['frame_count'] = len(result['frames'])
            result['transition_frame_interval_ms'] = 1000 / self.default_fps
        return result

    def public_state(self) -> dict[str, Any]:
        frame = render(self._templates[self.level_index], self._board,
                       dict(current=self.level_index + 1, total=self.win_levels))
        ids = [7] if self._board['solved'] else list(range(1, 8))
        return dict(backend='custom', selected=True,
                    game_id=getattr(self.info, 'game_id', 'elastic_grid'),
                    title=getattr(self.info, 'title', 'ELASTIC'),
                    frame=frame, frames=[frame], frame_count=1,
                    default_fps=self.default_fps, state=self.state,
                    level=self.level_index + 1, levels_completed=self.levels_completed,
                    win_levels=self.win_levels, step_index=self.step_index,
                    available_actions=[f'ACTION{i}' for i in ids], available_action_ids=ids,
                    last_action=self.last_action, score=self.levels_completed, full_reset=False,
                    source_path=self.source_path, custom_family=getattr(self.info, 'family', 'elastic_grid'),
                    level_name=self._templates[self.level_index]['id'],
                    level_steps=self.level_steps, moves=self._board['moves'],
                    selected_piece=self._board['selected'], last_event=self._board['lastEvent'],
                    level_solved=self._board['solved'], palette=list(PALETTE))

    def snapshot(self) -> dict[str, Any]:
        """Viewer undo snapshot; not needed for the public observation contract."""
        return dict(level_index=self.level_index, board=copy_state(self._board),
                    step_index=self.step_index, level_steps=self.level_steps, last_action=self.last_action)

    def restore(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        """Restore an undo snapshot after checking piece conservation and bounds."""
        idx = snapshot.get('level_index')
        _require(_is_int(idx) and 0 <= idx < self.win_levels, 'Invalid snapshot level.')
        level, board = self._templates[int(idx)], snapshot.get('board')
        _require(isinstance(board, dict) and isinstance(board.get('stacks'), list), 'Invalid snapshot.')
        stacks = board['stacks']
        _require(len(stacks) == len(level['columns']) * len(level['rows'])
                 and all(isinstance(a, list) and all(isinstance(pid, str) for pid in a) for a in stacks),
                 'Invalid snapshot stacks.')
        _require(Counter(pid for a in stacks for pid in a) == Counter(p['id'] for p in level['pieces']),
                 'Snapshot must contain every piece exactly once.')
        _require(board.get('selected') is None or board['selected'] in visible_ids(board),
                 'Only a visible piece can be selected.')
        _require(_is_int(board.get('moves')) and board['moves'] >= 0, 'Invalid snapshot move count.')
        for key in ('step_index', 'level_steps'):
            _require(_is_int(snapshot.get(key)) and snapshot[key] >= 0, 'Invalid snapshot action count.')
        self.level_index, self._board = int(idx), copy_state(board)
        m = match(level, self._board)
        self._board.update(solved=m['solved'], matchScale=m.get('scale'))
        self.step_index, self.level_steps = int(snapshot['step_index']), int(snapshot['level_steps'])
        self.last_action = str(snapshot.get('last_action', 'RESET'))
        self._sync_status()
        return self.public_state()
