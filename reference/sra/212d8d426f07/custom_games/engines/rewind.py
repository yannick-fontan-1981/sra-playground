"""REWIND: Python port of web v3, with single-cycle/one-action playback.

Only the standard library is used. Frames are 64x64 palette-index lists.
The pure functions mirror the web engine; RewindEngine adds campaign progression
and synchronous, multi-frame observations for custom ARC3-style backends.
"""
from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

FRAME = 64
BG, GRAY, WHITE, BROWN, BLUE, RED, GREEN = 5, 3, 0, 13, 9, 8, 14
PALETTE = [
    '#FFFFFF', '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#E53AA3', '#FF7BCC', '#F93C31', '#1E93FF', '#88D8F1', '#FFDC00',
    '#FF851B', '#895D3B', '#4FCC30', '#A356D6',
]
# Web v3 intentionally uses brown at index 13, rather than the default maroon.
PALETTE_OVERRIDES = {13: '#895D3B'}
PHOTO = {'x': 2, 'y': 2, 'w': 60, 'h': 40}
FRAGMENT = {'x': 54, 'y': 54, 'w': 8, 'h': 8}
MAX_PHOTOS = 15
ARROWS = [
    {'delta': -1, 'x': 2, 'y': 54, 'w': 9, 'h': 6},
    {'delta': 1, 'x': 14, 'y': 54, 'w': 9, 'h': 6},
]
PLAY_BUTTON = {'x': 26, 'y': 54, 'w': 9, 'h': 6}
FAILURE_MS = 180
SUCCESS_MS = 130
FRAME_DURATION_MS = 240
CHARS = '0123456789ABCDEF'
LEVELS_DIR = Path(__file__).resolve().parents[1] / 'games' / 'rewind' / 'levels'
AVAILABLE_ACTION_IDS = [3, 4, 5, 6, 7]
Frame = list[list[int]]
Level = dict[str, Any]
State = dict[str, Any]


def _int(value: Any) -> bool:
    # bool is an int subclass in Python, but not an integer input in the web game.
    return type(value) is int and abs(value) <= 2**53 - 1


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def inside(r: Mapping[str, int], x: Any, y: Any) -> bool:
    return (_int(x) and _int(y) and r['x'] <= x < r['x'] + r['w']
            and r['y'] <= y < r['y'] + r['h'])


def blank() -> Frame:
    return [[BG] * FRAME for _ in range(FRAME)]


def put(f: Frame, x: int, y: int, color: int) -> None:
    if _int(x) and _int(y) and 0 <= x < FRAME and 0 <= y < FRAME:
        f[y][x] = color


def fill(f: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(f, xx, yy, color)


def rect(f: Frame, x: int, y: int, w: int, h: int, color: int) -> None:
    fill(f, x, y, w, 1, color)
    fill(f, x, y + h - 1, w, 1, color)
    fill(f, x, y, 1, h, color)
    fill(f, x + w - 1, y, 1, h, color)


def decode(rows: Any, w: int, h: int, label: str = 'Image') -> Frame:
    _require(isinstance(rows, (list, tuple)) and len(rows) == h and all(
        isinstance(row, str) and len(row) == w and all(ch in CHARS for ch in row)
        for row in rows), f'{label} : {h} lignes de {w} pixels (0–9, A–F) attendues.')
    return [[CHARS.index(ch) for ch in row] for row in rows]


def encode(frame: Frame) -> list[str]:
    _require(isinstance(frame, (list, tuple)) and all(
        isinstance(row, (list, tuple, bytes)) and all(_int(c) and 0 <= c < 16 for c in row)
        for row in frame), 'Pixels invalides.')
    return [''.join(CHARS[c] for c in row) for row in frame]


def search(photos: Any, fragment: Any) -> list[dict[str, int]]:
    """Exact matches in photo/y/x order. No rotation, zoom or colour tolerance."""
    h, w = len(fragment), len(fragment[0])
    pattern = [bytes(row) for row in fragment]
    found = []
    for photo, frame in enumerate(photos):
        rows = [bytes(row) for row in frame]
        for y in range(PHOTO['h'] - h + 1):
            x = rows[y].find(pattern[0])
            while 0 <= x <= PHOTO['w'] - w:
                if all(rows[y + yy][x:x + w] == pattern[yy] for yy in range(1, h)):
                    found.append({'photo': photo, 'x': x, 'y': y, 'w': w, 'h': h})
                x = rows[y].find(pattern[0], x + 1)
    return found


@dataclass(frozen=True)
class _Compiled:
    photos: tuple[tuple[bytes, ...], ...]
    fragment: tuple[bytes, ...]
    answer: tuple[int, int, int, int, int]

    def answer_dict(self) -> dict[str, int]:
        return dict(zip(('photo', 'x', 'y', 'w', 'h'), self.answer))


@lru_cache(maxsize=24)
def _compile_rows(photos: tuple[tuple[str, ...], ...], fragment: tuple[str, ...]) -> _Compiled:
    frames = tuple(tuple(bytes(row) for row in decode(rows, 60, 40, f'Photo {i+1}'))
                   for i, rows in enumerate(photos))
    patch = tuple(bytes(row) for row in decode(fragment, 8, 8, 'Extrait'))
    found = search(frames, patch)
    _require(len(found) == 1, f'Cet extrait apparaît {len(found)} fois sur la pellicule. '
             'Il doit apparaître une seule fois.')
    a = found[0]
    return _Compiled(frames, patch, tuple(a[k] for k in ('photo', 'x', 'y', 'w', 'h')))


def compile_level(level: Mapping[str, Any]) -> _Compiled:
    """A bounded, content-keyed cache also stays correct after an imported edit."""
    _require(isinstance(level, Mapping), 'Un objet niveau est attendu.')
    photos, fragment = level.get('photos'), level.get('fragment')
    _require(isinstance(photos, list) and 2 <= len(photos) <= MAX_PHOTOS,
             'La pellicule doit contenir de 2 à 15 photos.')
    _require(all(isinstance(rows, list) and all(isinstance(r, str) for r in rows)
                 for rows in photos), 'Photos invalides.')
    _require(isinstance(fragment, list) and all(isinstance(r, str) for r in fragment),
             'Extrait invalide.')
    return _compile_rows(tuple(tuple(p) for p in photos), tuple(fragment))


def validate_level(raw: Any) -> Level:
    c = compile_level(raw)
    initial = raw.get('initialPhoto')
    if initial is None:
        initial = len(raw['photos']) - 1
    _require(_int(initial) and 0 <= initial < len(raw['photos']), 'Photo de départ invalide.')
    a = c.answer_dict()
    level = {
        'version': 1, 'id': str(raw.get('id') or 'custom')[:40],
        'title': str(raw.get('title') or 'Pellicule')[:100],
        'description': str(raw.get('description') or 'Retrouver l’extrait exact.')[:600],
        'initialPhoto': initial, 'photos': [list(p) for p in raw['photos']],
        'fragment': list(raw['fragment']),
        'capture': {k: a[k] for k in ('photo', 'x', 'y')},
    }
    for key in ('scene', 'generationAudit'):
        if isinstance(raw.get(key), (dict, list)):
            level[key] = deepcopy(raw[key])
    return level


def validate_pack(raw: Any) -> list[Level]:
    ls = raw if isinstance(raw, list) else raw.get('levels', [raw]) if isinstance(raw, dict) else None
    _require(isinstance(ls, list) and 1 <= len(ls) <= 6, 'Un à six niveaux sont attendus.')
    return [validate_level(level) for level in ls]


def load_levels(path: str | Path | None = None) -> list[Level]:
    location = Path(path) if path is not None else LEVELS_DIR
    if location.is_file():
        if location.stat().st_size > 2_097_152:
            raise ValueError('Fichier trop grand : 2 Mo maximum.')
        return validate_pack(json.loads(location.read_text(encoding='utf-8-sig')))
    paths = sorted(location.glob('L*.json'))
    if not paths:
        raise FileNotFoundError(f'Aucun niveau dans {location}')
    return validate_pack([json.loads(p.read_text(encoding='utf-8-sig')) for p in paths])


def create_state(level: Level) -> State:
    return {'photo': level['initialPhoto'], 'steps': 0, 'attempts': 0, 'mistakes': 0,
            'actions': 0, 'playbacks': 0, 'playback': None, 'status': 'READY',
            'lastEvent': 'READY', 'lastClick': None, 'assisted': False}


def playback_sequence(level: Level, start_photo: int) -> list[int]:
    _require(_int(start_photo) and 0 <= start_photo < len(level['photos']),
             'Photo de départ invalide.')
    n = len(level['photos'])
    return [(start_photo + i + 1) % n for i in range(n)]


def finish_playback(state: State, event: str = 'PLAYBACK_FINISHED') -> State:
    if state['status'] != 'PLAYING' or not state.get('playback'):
        return state
    return {**state, 'photo': state['playback']['originPhoto'], 'playback': None,
            'status': 'READY', 'lastEvent': event}


def animation_step(level: Level, state: State) -> State:
    """Internal frame step: never increases actions, attempts or navigation steps."""
    if state['status'] != 'PLAYING' or not state.get('playback'):
        return state
    p = state['playback']
    cursor = p['cursor'] + 1
    if cursor >= len(p['photos']):
        return finish_playback(state)
    return {**state, 'photo': p['photos'][cursor], 'playback': {**p, 'cursor': cursor},
            'lastEvent': 'PLAYBACK_FRAME'}


def snapshot_state(level: Level, state: State) -> State:
    stable = deepcopy(finish_playback(state))
    stable['status'] = 'WIN' if stable['status'] == 'WIN' else 'READY'
    return stable


def strip_rects(level: Level) -> list[dict[str, int]]:
    n = len(level['photos'])
    left = (FRAME - (n * 3 + n - 1)) // 2
    return [{'x': left + i * 4, 'y': 47, 'w': 3, 'h': 3, 'photo': i} for i in range(n)]


def hit(level: Level, x: Any, y: Any) -> dict[str, Any] | None:
    if not _int(x) or not _int(y):
        return None
    if inside(PHOTO, x, y):
        return {'kind': 'photo', 'x': x - PHOTO['x'], 'y': y - PHOTO['y']}
    for slot in strip_rects(level):
        if inside(slot, x, y):
            return {'kind': 'slot', 'photo': slot['photo']}
    for arrow in ARROWS:
        if inside(arrow, x, y):
            return {'kind': 'arrow', 'delta': arrow['delta']}
    if inside(PLAY_BUTTON, x, y):
        return {'kind': 'play'}
    return None


def correct_click(level: Level, state: State, x: Any, y: Any) -> bool:
    a = compile_level(level).answer_dict()
    return state['photo'] == a['photo'] and inside(a, x, y)


def transition(level: Level, state: State, event: Any) -> State:
    """Pure state transition. Only action() is responsible for command accounting."""
    if not isinstance(event, dict):
        return state
    kind = event.get('type')
    if kind == 'reset':
        return create_state(level)
    if kind == 'clearFeedback':
        return ({**state, 'status': 'READY', 'lastEvent': 'RETRY', 'lastClick': None}
                if state['status'] == 'ERROR' else state)
    if kind == 'animationStep':
        return animation_step(level, state)
    if kind == 'stopPlayback':
        return finish_playback(state, 'PLAYBACK_STOPPED')
    if state['status'] == 'PLAYING':
        return state
    if kind == 'assist':
        return {**state, 'assisted': True}
    if state['status'] in ('WIN', 'ERROR'):
        return state
    if kind == 'play':
        photos = playback_sequence(level, state['photo'])
        return {**state, 'photo': photos[0], 'status': 'PLAYING',
                'lastEvent': 'PLAYBACK_STARTED', 'lastClick': None,
                'playbacks': state.get('playbacks', 0) + 1,
                'playback': {'originPhoto': state['photo'], 'photos': photos, 'cursor': 0}}
    if kind == 'move':
        delta = event.get('delta')
        if not _int(delta) or delta not in (-1, 1):
            return state
        photo = max(0, min(len(level['photos']) - 1, state['photo'] + delta))
        return (state if photo == state['photo'] else
                {**state, 'photo': photo, 'steps': state['steps'] + 1,
                 'lastEvent': 'MOVED', 'lastClick': None})
    if kind == 'seek':
        photo = event.get('photo')
        if not _int(photo) or not 0 <= photo < len(level['photos']) or photo == state['photo']:
            return state
        return {**state, 'photo': photo, 'steps': state['steps'] + abs(photo - state['photo']),
                'lastEvent': 'MOVED', 'lastClick': None}
    if kind == 'click':
        h = hit(level, event.get('x'), event.get('y'))
        if h is None:
            return state
        if h['kind'] == 'slot':
            return transition(level, state, {'type': 'seek', 'photo': h['photo']})
        if h['kind'] == 'arrow':
            return transition(level, state, {'type': 'move', 'delta': h['delta']})
        if h['kind'] == 'play':
            return transition(level, state, {'type': 'play'})
        win = correct_click(level, state, h['x'], h['y'])
        return {**state, 'attempts': state['attempts'] + 1,
                'mistakes': state['mistakes'] + (0 if win else 1),
                'status': 'WIN' if win else 'ERROR',
                'lastEvent': 'FOUND' if win else 'WRONG_REGION',
                'lastClick': {'x': h['x'], 'y': h['y']}}
    return state


def action(level: Level, state: State, aid: int, data: Mapping[str, Any] | None = None) -> State:
    if not _int(aid):
        return state
    data = data if isinstance(data, Mapping) else {}
    if aid == 7:
        return create_state(level)
    nxt = state
    if aid in (3, 4):
        nxt = transition(level, state, {'type': 'move', 'delta': -1 if aid == 3 else 1})
    elif aid == 5:
        nxt = transition(level, state, {'type': 'play'})
    elif aid == 6:
        nxt = transition(level, state, {'type': 'click', 'x': data.get('x'), 'y': data.get('y')})
    return state if nxt is state else {**nxt, 'actions': state.get('actions', 0) + 1}


def render(level: Level, state: State, progress: Any = (), options: Mapping[str, Any] | None = None) -> Frame:
    options = options or {}
    f, c = blank(), compile_level(level)
    photo = c.photos[state['photo']]
    for y in range(PHOTO['h']):
        f[PHOTO['y'] + y][PHOTO['x']:PHOTO['x'] + PHOTO['w']] = photo[y]
    default = GREEN if state['status'] == 'WIN' else RED if state['status'] == 'ERROR' else GRAY
    outline = options.get('outline')
    rect(f, 1, 1, 62, 42, default if outline is None else outline)
    fill(f, 1, 45, 62, 7, 4)
    fill(f, 1, 45, 62, 1, BROWN)
    fill(f, 1, 51, 62, 1, BROWN)
    for x in range(3, 62, 4):
        put(f, x, 45, BG)
        put(f, x, 51, BG)
    for r in strip_rects(level):
        fill(f, r['x'], r['y'], r['w'], r['h'], BLUE if r['photo'] == state['photo'] else BROWN)
    for a in ARROWS:
        disabled = (state['status'] == 'PLAYING' or
                    (state['photo'] == 0 if a['delta'] < 0 else state['photo'] == len(level['photos']) - 1))
        col, cx, cy = (4 if disabled else 2), a['x'] + 4, a['y'] + 2
        for dy in range(-2, 3):
            for k in range(3 - abs(dy)):
                put(f, cx + (-k if a['delta'] < 0 else k), cy + dy, col)
    pb, playing = PLAY_BUTTON, state['status'] == 'PLAYING'
    disabled = bool(options.get('transportDisabled')) or (not playing and state['status'] != 'READY')
    rect(f, pb['x'], pb['y'], pb['w'], pb['h'], WHITE if playing else 4 if disabled else GRAY)
    for i, w in enumerate((1, 3, 3, 1)):
        fill(f, pb['x'] + 3, pb['y'] + 1 + i, w, 1, WHITE if playing else 4 if disabled else GREEN)
    rect(f, 53, 53, 10, 10, GRAY)
    for y in range(8):
        f[54 + y][54:62] = c.fragment[y]
    done = set(progress)
    for i in range(6):
        fill(f, 2 + i * 6, 61, 5, 2, GREEN if i in done else GRAY)
    if state['status'] == 'ERROR' and state.get('lastClick'):
        p = state['lastClick']
        for i in range(-1, 2):
            x, y, y2 = p['x'] + i, p['y'] + i, p['y'] - i
            if 0 <= x < 60 and 0 <= y < 40:
                put(f, PHOTO['x'] + x, PHOTO['y'] + y, RED)
            if 0 <= x < 60 and 0 <= y2 < 40:
                put(f, PHOTO['x'] + x, PHOTO['y'] + y2, RED)
    a = c.answer_dict()
    if state['status'] == 'WIN':
        rect(f, PHOTO['x'] + a['x'] - 1, PHOTO['y'] + a['y'] - 1, 10, 10, GREEN)
    p = options.get('capture')
    if p:
        rect(f, PHOTO['x'] + p['x'] - 1, PHOTO['y'] + p['y'] - 1, 10, 10, WHITE)
    if options.get('reveal') and state['photo'] == a['photo']:
        rect(f, PHOTO['x'] + a['x'] - 1, PHOTO['y'] + a['y'] - 1, 10, 10, WHITE)
    return f


def run_action(level: Level, state: State, aid: int, data: Mapping[str, Any] | None = None,
               options: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """One synchronous command returns a whole cycle and restores its origin.

    Same contract as web v3 runAction. ERROR/WIN feedback is added by the adapter
    or viewer, not this core function. A duration of zero means hold the frame.
    """
    options = options or {}
    ms = options.get('frameDurationMs', FRAME_DURATION_MS)
    _require(_int(ms) and 1 <= ms <= 10_000, 'Durée de photo invalide.')
    current = action(level, state, aid, data)
    accepted = current is not state
    frames, durations, photo_order = [], [], []
    progress, render_options = options.get('progress', ()), options.get('renderOptions', {})
    while current['status'] == 'PLAYING' and accepted:
        photo_order.append(current['photo'])
        if options.get('animate', True):
            frames.append(render(level, current, progress, render_options))
            durations.append(ms)
        current = animation_step(level, current)
    frame = render(level, current, progress, render_options)
    frames.append(frame)
    durations.append(0)
    return {'state': current, 'frame': frame, 'frames': frames, 'frame_count': len(frames),
            'frame_durations_ms': durations, 'photo_order': photo_order,
            'action_cost': 0 if aid == 7 else int(accepted),
            'step_index': current.get('actions', 0), 'accepted': accepted}


def extract(level: Level, photo: int, x: int, y: int) -> Frame:
    _require(_int(photo) and 0 <= photo < len(level['photos']), 'Photo invalide.')
    _require(_int(x) and _int(y) and 0 <= x <= 52 and 0 <= y <= 32,
             'L’extrait doit tenir dans la photo.')
    return [list(row[x:x + 8]) for row in compile_level(level).photos[photo][y:y + 8]]


def with_capture(level: Level, photo: int, x: int, y: int) -> Level:
    return validate_level({**level, 'fragment': encode(extract(level, photo, x, y)),
                           'capture': {'photo': photo, 'x': x, 'y': y}})


def validate_state(level: Level, raw: Any) -> State:
    _require(isinstance(raw, dict), 'Parcours invalide.')
    photo = raw.get('photo')
    _require(_int(photo) and 0 <= photo < len(level['photos']), 'Photo invalide dans le parcours.')
    for key in ('steps', 'attempts', 'mistakes'):
        _require(_int(raw.get(key)) and raw[key] >= 0, f'Compteur {key} invalide.')
    _require(raw['mistakes'] <= raw['attempts'], 'Compteurs incohérents.')
    for key in ('actions', 'playbacks'):
        if key in raw:
            _require(_int(raw[key]) and raw[key] >= 0, f'Compteur {key} invalide.')
    s = {**create_state(level), 'photo': photo, 'steps': raw['steps'], 'attempts': raw['attempts'],
         'mistakes': raw['mistakes'], 'actions': raw.get('actions', raw['steps'] + raw['attempts']),
         'playbacks': raw.get('playbacks', 0), 'assisted': bool(raw.get('assisted', False))}
    if raw.get('status') == 'PLAYING':
        p = raw.get('playback')
        origin = p.get('originPhoto') if isinstance(p, dict) else None
        _require(_int(origin) and 0 <= origin < len(level['photos']), 'Animation sauvegardée invalide.')
        s['photo'] = origin
    if raw.get('status') == 'WIN':
        p = raw.get('lastClick')
        _require(isinstance(p, dict) and correct_click(level, s, p.get('x'), p.get('y'))
                 and s['attempts'] > s['mistakes'], 'Réussite sauvegardée invalide.')
        s.update(status='WIN', lastEvent='FOUND', lastClick={'x': p['x'], 'y': p['y']})
    return s


def validate_session(raw: Any) -> dict[str, Any]:
    _require(isinstance(raw, dict) and raw.get('game') == 'rewind-session'
             and raw.get('version') == 1, 'Un parcours REWIND est attendu.')
    levels = validate_pack(raw.get('levels'))
    index, states = raw.get('index'), raw.get('states')
    _require(isinstance(states, list) and len(states) == len(levels) and _int(index)
             and 0 <= index < len(levels), 'Parcours incompatible.')
    return {
        'levels': levels,
        'states': [validate_state(level, state) for level, state in zip(levels, states)],
        'index': index,
    }


def solution(level: Level, state: State) -> dict[str, Any]:
    a = compile_level(level).answer_dict()
    count = a['photo'] - state['photo']
    actions = [{'aid': 3 if count < 0 else 4} for _ in range(abs(count))]
    actions.append({'aid': 6, 'data': {'x': PHOTO['x'] + a['x'] + 4, 'y': PHOTO['y'] + a['y'] + 4}})
    return {'answer': a, 'actions': actions}


def audit(level: Level) -> dict[str, Any]:
    c = compile_level(level)
    a = c.answer_dict()
    return {'id': level['id'], 'photos': len(level['photos']), 'fragmentWidth': 8,
            'fragmentHeight': 8, 'occurrences': len(search(c.photos, c.fragment)), 'answer': a,
            'minimumSteps': abs(level['initialPhoto'] - a['photo']), 'minimumClicks': 1}


@dataclass(frozen=True)
class GameInfo:
    """Standalone defaults; an existing CustomGameInfo is accepted unchanged."""
    game_id: str = 'rewind'
    title: str = 'REWIND'
    family: str = 'rewind'
    levels: int = 6
    default_fps: int = 8


class RewindEngine:
    """Custom-backend adapter: reset()/action()/public_state(), no event loop.

    ACTION5 and a click on PLAY_BUTTON each count as exactly one accepted action.
    Playback frames are observations, never synthetic movement commands.
    """
    def __init__(self, info: Any = None, animate: bool = True, *,
                 levels: Any = None, levels_dir: str | Path | None = None,
                 auto_advance: bool = True, frame_duration_ms: int = FRAME_DURATION_MS):
        self.levels = load_levels(levels_dir) if levels is None else validate_pack(levels)
        self.info = info if info is not None else GameInfo(levels=len(self.levels))
        self.win_levels = self._info('levels', len(self.levels))
        _require(_int(self.win_levels) and 1 <= self.win_levels <= len(self.levels),
                 'Nombre de niveaux incompatible avec le pack.')
        _require(_int(frame_duration_ms) and 1 <= frame_duration_ms <= 10_000,
                 'Durée de photo invalide.')
        self.frame_duration_ms = frame_duration_ms
        self.animate, self.auto_advance = bool(animate), bool(auto_advance)
        self.source_path = str(Path(levels_dir) if levels_dir else LEVELS_DIR)
        self.level_index = self.levels_completed = self.step_index = 0
        self.last_action, self.last_event, self.state = 'RESET', 'READY', 'NOT_FINISHED'
        self._local = create_state(self.levels[0])

    def _info(self, name: str, default: Any) -> Any:
        return self.info.get(name, default) if isinstance(self.info, Mapping) else getattr(self.info, name, default)

    @property
    def level(self) -> Level:
        return self.levels[self.level_index]

    @property
    def local_state(self) -> State:
        return deepcopy(self._local)

    def reset(self) -> dict[str, Any]:
        self.level_index = self.levels_completed = self.step_index = 0
        self.last_action, self.last_event, self.state = 'RESET', 'READY', 'NOT_FINISHED'
        self._local = create_state(self.level)
        return self.public_state(full_reset=True)

    def level_reset(self) -> dict[str, Any]:
        # Retrying the final level after WIN must actually make it playable.
        self.levels_completed = min(self.levels_completed, self.level_index)
        self._local = create_state(self.level)
        self.state, self.last_action, self.last_event = 'NOT_FINISHED', 'ACTION7', 'LEVEL_RESET'
        return self.public_state(accepted=True)

    def next_level(self) -> dict[str, Any]:
        """Host control for auto_advance=False; does not consume a game action."""
        if self._local['status'] == 'WIN' and self.level_index + 1 < self.win_levels:
            self.level_index += 1
            self._local = create_state(self.level)
            self.last_event = 'LEVEL_COMPLETE'
        return self.public_state()

    def action(self, action_id: int, data: Mapping[str, Any] | None = None) -> dict[str, Any]:
        if action_id == 7 and _int(action_id):
            return self.level_reset()
        if self.state == 'WIN' or action_id not in AVAILABLE_ACTION_IDS or not _int(action_id):
            return self.public_state()
        self.last_action = f'ACTION{action_id}'
        result = run_action(self.level, self._local, action_id, data, {
            'animate': self.animate, 'frameDurationMs': self.frame_duration_ms,
            'progress': list(range(self.levels_completed)),
        })
        self._local = result['state']
        self.step_index += result['action_cost']
        self.last_event = self._local['lastEvent']
        frames, durations = result['frames'], result['frame_durations_ms']
        if result['accepted'] and self._local['status'] == 'ERROR':
            error_frame = result['frame']
            self._local = transition(self.level, self._local, {'type': 'clearFeedback'})
            self.last_event = 'WRONG_REGION'
            final = render(self.level, self._local, range(self.levels_completed))
            frames = [error_frame, final] if self.animate else [final]
            durations = [FAILURE_MS, 0] if self.animate else [0]
        elif result['accepted'] and self._local['status'] == 'WIN':
            self.levels_completed = max(self.levels_completed, self.level_index + 1)
            frames, durations = [], []
            if self.animate:
                for color in (GREEN, GRAY, GREEN, GRAY, GREEN, GRAY, GREEN):
                    frames.append(render(self.level, self._local, range(self.levels_completed),
                                         {'outline': color}))
                    durations.append(SUCCESS_MS)
            if self.levels_completed == self.win_levels:
                self.state, self.last_event = 'WIN', 'GAME_WON'
            elif self.auto_advance:
                self.level_index += 1
                self._local = create_state(self.level)
                self.last_event = 'LEVEL_COMPLETE'
            frames.append(render(self.level, self._local, range(self.levels_completed)))
            durations.append(0)
        observation = self.public_state(accepted=result['accepted'], action_cost=result['action_cost'])
        observation.update(frames=frames, frame=frames[-1], frame_count=len(frames),
                           frame_durations_ms=durations, photo_order=result['photo_order'])
        return observation

    def public_state(self, *, full_reset: bool = False, accepted: bool = False,
                     action_cost: int = 0) -> dict[str, Any]:
        f = render(self.level, self._local, range(self.levels_completed))
        ids = [7] if self.state == 'WIN' else list(AVAILABLE_ACTION_IDS)
        return {
            'backend': 'custom', 'selected': True, 'game_id': self._info('game_id', 'rewind'),
            'title': self._info('title', 'REWIND'), 'custom_family': self._info('family', 'rewind'),
            'default_fps': self._info('default_fps', 8), 'frame': f, 'frames': [f],
            'frame_count': 1, 'frame_durations_ms': [0],
            'transition_frame_interval_ms': self.frame_duration_ms,
            'palette': list(PALETTE), 'palette_overrides': dict(PALETTE_OVERRIDES),
            'state': self.state, 'level': self.level_index + 1,
            'levels_completed': self.levels_completed, 'win_levels': self.win_levels,
            'step_index': self.step_index, 'level_steps': self._local['actions'],
            'level_actions': self._local['actions'], 'actions': self._local['actions'],
            'photo': self._local['photo'], 'photo_number': self._local['photo'] + 1,
            'photo_count': len(self.level['photos']), 'photo_order': [],
            'navigation_steps': self._local['steps'], 'attempts': self._local['attempts'],
            'mistakes': self._local['mistakes'], 'playbacks': self._local['playbacks'],
            'level_status': self._local['status'], 'last_action': self.last_action,
            'last_event': self.last_event, 'score': self.levels_completed,
            'available_actions': [f'ACTION{i}' for i in ids], 'available_action_ids': ids,
            'full_reset': full_reset, 'source_path': self.source_path,
            'level_name': self.level['title'], 'level_description': self.level['description'],
            'accepted': accepted, 'action_cost': action_cost,
        }
