from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from custom_games.registry import CustomGameInfo

FRAME = 64
LIMIT = 30
MAX_BUDGET = 35
PALETTE_HEX = [
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#921231', '#4FCC30', '#A356D6'
]
CHROMATIC = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'combina' / 'levels'

ACTION_CLICK = 6
ACTION_RESET = 7


def _clone(x):
    return json.loads(json.dumps(x))


def _assert(cond: bool, msg: str):
    if not cond:
        raise ValueError(msg)


@dataclass
class Level:
    version: int
    level_id: str
    title: str
    description: str
    max_actions: int
    buttons: list[dict[str, Any]]


def total(level: Level) -> int:
    n = 1
    for b in level.buttons:
        n *= len(b['colors'])
    return n


def validate_level(raw: dict[str, Any]) -> Level:
    _assert(isinstance(raw, dict), 'Un niveau doit être un objet.')
    buttons = raw.get('buttons')
    _assert(isinstance(buttons, list) and 2 <= len(buttons) <= 4, 'Utiliser deux à quatre boutons.')
    max_actions = int(raw.get('maxActions', LIMIT))
    _assert(3 <= max_actions <= MAX_BUDGET, 'Le budget doit être entre 3 et 35.')
    ids: set[str] = set()
    out_buttons = []
    for i, b in enumerate(buttons):
        _assert(isinstance(b, dict), f'Bouton {i+1} invalide.')
        bid = str(b.get('id', f'B{i+1}'))
        _assert(0 < len(bid) <= 24 and bid not in ids, 'Chaque bouton doit avoir un identifiant unique.')
        ids.add(bid)
        colors = list(b.get('colors', []))
        _assert(2 <= len(colors) <= 3, 'Chaque bouton possède deux ou trois états.')
        _assert(colors[0] == 4, 'Le premier état doit être 4.')
        _assert(all(isinstance(c, int) and c in CHROMATIC for c in colors[1:]), 'Couleurs invalides.')
        _assert(len(set(colors)) == len(colors), 'Les couleurs d’un cycle doivent être distinctes.')
        initial = int(b.get('initial', 0))
        _assert(0 <= initial < len(colors), 'État initial hors du cycle.')
        out_buttons.append({'id': bid, 'colors': colors, 'initial': initial})
    lvl = Level(
        version=int(raw.get('version', 1)),
        level_id=str(raw.get('id', 'custom'))[:40],
        title=str(raw.get('title', 'Toutes les combinaisons'))[:90],
        description=str(raw.get('description', 'Visiter chaque combinaison des voyants.'))[:500],
        max_actions=max_actions,
        buttons=out_buttons,
    )
    _assert(total(lvl) - 1 >= 3, 'Un niveau doit demander au moins trois pressions pour tout explorer.')
    _assert(total(lvl) - 1 <= LIMIT, 'Trop de combinaisons : plus de 30 pressions minimales.')
    _assert(total(lvl) - 1 <= max_actions, 'Le budget est insuffisant pour visiter toutes les combinaisons.')
    return lvl


def load_levels() -> list[Level]:
    paths = sorted(LEVELS_DIR.glob('L*.json'))
    _assert(bool(paths), f'Aucun niveau trouvé dans {LEVELS_DIR}')
    return [validate_level(json.loads(p.read_text(encoding='utf-8'))) for p in paths]


def code(level: Level, values: list[int]) -> int:
    n = 0
    w = 1
    for i, b in enumerate(level.buttons):
        n += values[i] * w
        w *= len(b['colors'])
    return n


def decode(level: Level, n: int) -> list[int]:
    _assert(0 <= n < total(level), 'Indice de combinaison invalide.')
    out = []
    for b in level.buttons:
        m = len(b['colors'])
        out.append(n % m)
        n //= m
    return out


def create_state(level: Level) -> dict[str, Any]:
    values = [b['initial'] for b in level.buttons]
    c = code(level, values)
    visited = [False] * total(level)
    visited[c] = True
    return {
        'values': values,
        'visited': visited,
        'moves': 0,
        'duplicates': 0,
        'history': [{'code': c, 'button': None, 'fresh': True}],
        'status': 'PLAYING',
        'lastEvent': 'READY',
        'lastButton': None,
    }


def coverage(state: dict[str, Any]) -> int:
    return sum(1 for v in state['visited'] if v)


def transition(level: Level, state: dict[str, Any], action: dict[str, Any]) -> dict[str, Any]:
    if not action or not isinstance(action, dict):
        return state
    if action.get('type') == 'reset':
        return create_state(level)
    if action.get('type') != 'press' or state['status'] != 'PLAYING':
        return state
    idx = action.get('index')
    if not isinstance(idx, int) or not (0 <= idx < len(level.buttons)):
        return state
    new = _clone(state)
    new['values'][idx] = (new['values'][idx] + 1) % len(level.buttons[idx]['colors'])
    new['moves'] += 1
    new['lastButton'] = idx
    c = code(level, new['values'])
    fresh = not new['visited'][c]
    new['visited'][c] = True
    if not fresh:
        new['duplicates'] += 1
    new['history'].append({'code': c, 'button': idx, 'fresh': fresh})
    new['lastEvent'] = 'NEW_COMBINATION' if fresh else 'REPEATED_COMBINATION'
    if coverage(new) == total(level):
        new['status'] = 'SOLVED'
        new['lastEvent'] = 'LEVEL_COMPLETE'
    elif new['moves'] >= level.max_actions:
        new['status'] = 'EXHAUSTED'
        new['lastEvent'] = 'BUDGET_EXHAUSTED'
    return new


def button_rects(level: Level) -> list[dict[str, int]]:
    count = len(level.buttons)
    w = 11
    gap = 3
    left = (64 - (count * w + (count - 1) * gap)) // 2
    return [{'x': left + i * (w + gap), 'y': 15, 'w': w, 'h': w} for i in range(count)]


def hit(level: Level, x: int, y: int) -> dict[str, Any] | None:
    if not isinstance(x, int) or not isinstance(y, int):
        return None
    for i, b in enumerate(button_rects(level)):
        if b['x'] <= x < b['x'] + b['w'] and b['y'] <= y < b['y'] + b['h']:
            return {'type': 'press', 'index': i}
    return None


def sweep(level: Level) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    for i in range(len(level.buttons)):
        lower = list(actions)
        actions = []
        for k in range(len(level.buttons[i]['colors'])):
            if k > 0:
                actions.append({'type': 'press', 'index': i})
            actions.extend([dict(a) for a in lower])
    return actions


def audit(level: Level) -> dict[str, Any]:
    state = create_state(level)
    seen = {code(level, state['values'])}
    for a in sweep(level):
        _assert(state['status'] == 'PLAYING', 'Parcours terminé trop tôt.')
        state = transition(level, state, a)
        c = code(level, state['values'])
        _assert(c not in seen, 'La démonstration répète une combinaison.')
        seen.add(c)
    _assert(state['status'] == 'SOLVED', 'Parcours exhaustif invalide.')
    _assert(len(seen) == total(level), 'Toutes les combinaisons ne sont pas visitées.')
    _assert(state['moves'] == total(level) - 1, 'Le minimum exact est N-1.')
    _assert(state['moves'] <= level.max_actions, 'Le budget ne suffit pas.')
    return {
        'id': level.level_id,
        'buttons': len(level.buttons),
        'states': [len(b['colors']) for b in level.buttons],
        'combinations': total(level),
        'minimumActions': total(level) - 1,
        'verifiedActions': state['moves'],
        'repetitions': state['duplicates'],
        'maxActions': level.max_actions,
        'spareActions': level.max_actions - state['moves'],
    }


def render(level: Level, state: dict[str, Any], progress_completed: list[int], total_levels: int, outline: int | None = None) -> list[list[int]]:
    f = [[5 for _ in range(FRAME)] for _ in range(FRAME)]

    def fill(x: int, y: int, w: int, h: int, c: int):
        for yy in range(y, y + h):
            if 0 <= yy < FRAME:
                row = f[yy]
                for xx in range(x, x + w):
                    if 0 <= xx < FRAME:
                        row[xx] = c

    def rect(x: int, y: int, w: int, h: int, c: int):
        fill(x, y, w, 1, c)
        fill(x, y + h - 1, w, 1, c)
        fill(x, y, 1, h, c)
        fill(x + w - 1, y, 1, h, c)

    # budget ticks
    tick_top = 1 if level.max_actions > 30 else 4
    for i in range(level.max_actions):
        fill(2 + 2 * (i % 30), tick_top + 3 * (i // 30), 1, 2, 4 if i < state['moves'] else 11)

    border = outline if outline is not None else (14 if state['status'] == 'SOLVED' else 8 if state['status'] == 'EXHAUSTED' else 3)
    rect(1, 9, 62, 49, border)

    for i, r in enumerate(button_rects(level)):
        b = level.buttons[i]
        v = state['values'][i]
        color = b['colors'][v]
        rect(r['x'], r['y'], r['w'], r['h'], 2)
        fill(r['x'] + 1, r['y'] + 1, r['w'] - 2, r['h'] - 2, 4)
        fill(r['x'] + 2, r['y'] + 2, r['w'] - 4, r['h'] - 4, color)
        width = len(b['colors']) * 3 + (len(b['colors']) - 1)
        left = r['x'] + (r['w'] - width) // 2
        for k, c in enumerate(b['colors']):
            fill(left + k * 4, 29, 3, 3, c)
            if k == v:
                fill(left + k * 4, 33, 3, 1, 0)

    fill(3, 35, 58, 1, 3)
    count = total(level)
    cols = min(count, 6)
    rows = (count + cols - 1) // cols
    x0 = (64 - (cols * 9 + (cols - 1))) // 2
    y0 = 38 + (19 - (rows * 3 + rows - 1)) // 2
    current = code(level, state['values'])
    for n in range(count):
        x = x0 + (n % cols) * 10
        y = y0 + (n // cols) * 4
        rect(x, y, 9, 3, 0 if n == current else 14 if state['visited'][n] else 4)
        values = decode(level, n)
        left = x + (9 - (len(level.buttons) * 2 - 1)) // 2
        for i, v in enumerate(values):
            fill(left + 2 * i, y + 1, 1, 1, level.buttons[i]['colors'][v])

    done = set(progress_completed)
    n = max(1, min(6, total_levels))
    for i in range(n):
        fill(2 + i * 6, 61, 5, 2, 14 if i in done else 3)
    return f


class CombinaEngine:
    def __init__(self, info: CustomGameInfo, animate: bool = True):
        self.info = info
        self.animate = animate
        self.levels = load_levels()
        self.win_levels = min(int(info.levels), len(self.levels))
        self.level_index = 0
        self.level_state = create_state(self.levels[0])
        self.step_index = 0
        self.state = 'NOT_FINISHED'
        self.last_action = 'RESET'
        self.last_event = 'READY'

    def reset(self) -> dict[str, Any]:
        self.level_index = 0
        self.level_state = create_state(self.levels[0])
        self.step_index = 0
        self.state = 'NOT_FINISHED'
        self.last_action = 'RESET'
        self.last_event = 'READY'
        return self.public_state()

    def level_reset(self) -> dict[str, Any]:
        self.level_state = create_state(self.levels[self.level_index])
        self.last_action = 'ACTION7'
        self.last_event = 'LEVEL_RESET'
        self.state = 'NOT_FINISHED'
        return self.public_state()

    def action(self, action_id: int, data: dict[str, Any] | None = None) -> dict[str, Any]:
        data = data or {}
        raw_action_id = getattr(action_id, 'value', action_id)
        if isinstance(raw_action_id, bool) or not isinstance(raw_action_id, int):
            return self.public_state()
        aid = raw_action_id
        if aid not in (1, 2, 3, 4, ACTION_CLICK, ACTION_RESET):
            return self.public_state()
        if self.state != 'NOT_FINISHED' and aid != ACTION_RESET:
            return self.public_state()
        if aid == ACTION_RESET:
            return self.level_reset()
        level = self.levels[self.level_index]
        before = self.level_state
        if 1 <= aid <= 4 and aid - 1 < len(level.buttons):
            self.level_state = transition(level, self.level_state, {'type': 'press', 'index': aid - 1})
        elif aid == ACTION_CLICK:
            x = data.get('x', -999)
            y = data.get('y', -999)
            a = hit(level, x, y)
            if a:
                self.level_state = transition(level, self.level_state, a)
        # ACTION5 unused
        if self.level_state is before:
            return self.public_state()
        self.last_action = f'ACTION{aid}'
        self.step_index += 1
        self.last_event = self.level_state['lastEvent']
        if self.level_state['status'] == 'SOLVED':
            return self._complete_level()
        if self.level_state['status'] == 'EXHAUSTED':
            self.state = 'GAME_OVER'
        else:
            self.state = 'NOT_FINISHED'
        return self.public_state()

    def _complete_level(self) -> dict[str, Any]:
        current_level = self.levels[self.level_index]
        solved_state = _clone(self.level_state)
        solved_progress = list(range(self.level_index + 1))
        frames = []
        if self.animate:
            base = render(current_level, solved_state, solved_progress, self.win_levels, outline=14)
            for color in [14, 3, 14, 3, 14, 3, 14]:
                frames.append(render(current_level, solved_state, solved_progress, self.win_levels, outline=color))
        self.level_index += 1
        if self.level_index >= self.win_levels:
            self.level_index = self.win_levels - 1
            self.level_state = solved_state
            self.state = 'WIN'
            self.last_event = 'GAME_WON'
            result = self.public_state()
        else:
            self.level_state = create_state(self.levels[self.level_index])
            self.state = 'NOT_FINISHED'
            self.last_event = 'LEVEL_COMPLETE'
            result = self.public_state()
        if self.animate:
            result['frames'] = frames + [result['frame']]
            result['frame_count'] = len(result['frames'])
            result['transition_frame_interval_ms'] = 140
        return result

    def public_state(self) -> dict[str, Any]:
        level = self.levels[self.level_index]
        frame = render(level, self.level_state, list(range(self.level_index if self.state != 'WIN' else self.win_levels)), self.win_levels)
        seen = coverage(self.level_state)
        total_states = total(level)
        ids = [1, 2, 3, 4, 6, 7] if self.state == 'NOT_FINISHED' else [7]
        return {
            'backend': 'custom',
            'selected': True,
            'game_id': self.info.game_id,
            'title': self.info.title,
            'frame': frame,
            'frames': [frame],
            'frame_count': 1,
            'default_fps': self.info.default_fps,
            'state': self.state,
            'level': self.level_index + 1,
            'levels_completed': self.win_levels if self.state == 'WIN' else self.level_index,
            'win_levels': self.win_levels,
            'step_index': self.step_index,
            'available_actions': [f'ACTION{i}' for i in ids],
            'available_action_ids': ids,
            'last_action': self.last_action,
            'score': self.level_index if self.state != 'WIN' else self.win_levels,
            'full_reset': False,
            'source_path': str(LEVELS_DIR),
            'custom_family': getattr(self.info, 'family', 'custom'),
            'level_name': level.title,
            'level_description': level.description,
            'level_status': self.level_state['status'],
            'coverage': seen,
            'total_combinations': total_states,
            'remaining_actions': max(0, level.max_actions - self.level_state['moves']),
            'moves': self.level_state['moves'],
            'duplicates': self.level_state['duplicates'],
            'max_actions': level.max_actions,
            'button_count': len(level.buttons),
            'last_event': self.last_event,
            'button_values': list(self.level_state['values']),
            'history': _clone(self.level_state['history']),
            'palette': list(PALETTE_HEX),
        }
