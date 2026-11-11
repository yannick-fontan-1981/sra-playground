#!/usr/bin/env python3
"""Independent cold ObservedBinding contracts from immutable original Python.

Recovery reconstruction: no previous fixture, result, game implementation or
native output supplies an expectation. Public scenes below are synthetic data.
Journal mode reads public inputs only and computes selected proposals locally.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys
import traceback
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
PROTO = SOURCE / 'agents/yf_arc3_v6/laya_proto'
PREFIX = 'agents.yf_arc3_v6.morphology_policy.guarded_binding.'
DIRECT_MODULES = tuple(PREFIX + name for name in ('family', 'tracker', 'geometry', 'identity', 'reception', 'planning'))
FIELDS = ('epoch', 'core', 'moves', 'tried', 'blocked', 'held', 'interaction', 'methods', 'events', 'failed',
          'goal_evidence', 'correspondence_context', 'context_refutations', 'pending_reception', 'reception_receipts', 'observed_frames')
CHAINS, HELPERS = [], []
JOURNAL_SCHEMA = 'logos-engine.v6.observed-binding-public-operations.v1'
CALLER_STATE_RETENTION = 'core_or_methods_memory_roundtrip'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    # Insertion order is observable in moves, frames and other source mappings.
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()


def plain(value):
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise TypeError('Unexpected non-string source mapping key')
        return {key: plain(item) for key, item in value.items()}
    if isinstance(value, set):
        return [plain(item) for item in sorted(value)]
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if hasattr(value, 'tolist'):
        return plain(value.tolist())
    if hasattr(value, 'item'):
        return plain(value.item())
    raise TypeError('Unserialized original value: ' + type(value).__name__)


def fingerprint(path):
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError('Evidence path must remain in the checkout')
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha(data)}


def verify_sources(manifest):
    result = {}
    for name, expected in manifest.items():
        actual = sha((SOURCE / name).read_bytes())
        if actual != expected['sha256']:
            raise AssertionError('Immutable original changed: ' + name)
        result[name] = actual
    return result


def imported_modules():
    result = {}
    for name, module in sorted(sys.modules.items()):
        filename = getattr(module, '__file__', None)
        if not filename:
            continue
        path = Path(filename).resolve()
        if path.is_relative_to(SOURCE):
            if not path.is_relative_to(SOURCE / 'agents'):
                raise AssertionError('Original import outside agents: ' + str(path))
            result[name] = fingerprint(path)
    return result


class PutMemory:
    """Declared get/put recorder; source AttentionMemory executes unmodified.

    get matches Memory's missing-key and detached JSON value contract. This
    component oracle does not substitute a fake AttentionMemory implementation.
    """
    def __init__(self):
        self.facts, self.puts = {}, []

    def get(self, episode, key):
        return copy.deepcopy(self.facts[(episode, key)])

    def put(self, episode, key, value, evidence='fixture', revision=1):
        item = {'value': plain(value), 'evidence': evidence, 'revision': revision}
        self.facts[(episode, key)] = copy.deepcopy(item)
        self.puts.append(copy.deepcopy({'episode': episode, 'key': key, **item}))


def attention_state(owner):
    return plain({'item': owner.item, 'composition': owner.composition})


def observation(rows, identity, revision, epoch=1, completed=0, available=('ACTION3', 'ACTION4', 'ACTION5'), state='NOT_FINISHED'):
    packet = SimpleNamespace(frame_rows=copy.deepcopy(rows), level=epoch, levels_completed=completed,
                             available_action_refs=list(available), state=state, frame_hash=sha(encoded(rows))[:16])
    return NEUTRAL.measure(packet, revision, identity)[0]


def public(rows, obs):
    return {'frame_rows': copy.deepcopy(rows), 'frame_packet': [copy.deepcopy(rows)], 'level': obs['level_epoch'],
            'levels_completed': obs['levels_completed'], 'available_action_refs': list(obs['available_action_refs']),
            'state': obs['state'], 'frame_hash': obs['frame_hash'], 'step_index': obs['revision'] - 1}


class Chain:
    def __init__(self, identity, *, episode='common-observation-frontier', qualification=None, native_checkpoint=True):
        self.owner, self.memory = FAMILY.ObservedBinding(), PutMemory()
        self.shared = AttentionMemory(self.memory, episode)
        self.latest = None
        self.case = {'id': identity, 'episode': episode, 'nativeCheckpointEligible': native_checkpoint,
                     'qualification': qualification or 'Cold original owner; only declared public observations and commands acquire knowledge.',
                     'initialState': plain(self.owner.state()), 'initialAttention': attention_state(self.shared),
                     'initialMemoryPuts': [], 'initialAttentionBoundShared': self.owner.attention is self.shared,
                     'operations': []}
        CHAINS.append(self.case)

    def call(self, method, *, selected=False, **given):
        args = copy.deepcopy(given)
        if selected:
            if self.latest is None:
                raise AssertionError('Selected call has no preceding original offer')
            args['proposal'] = copy.deepcopy(self.latest)
        row = {'method': method, 'input': plain(args), 'useLatestSourceProposal': selected}
        try:
            if method == 'propose':
                result = self.owner.propose(**args, attention=self.shared)
                self.latest = copy.deepcopy(result)
            elif method == 'before':
                args['public'] = SimpleNamespace(**args['public'])
                result = self.owner.before(**args)
            elif method == 'bind':
                result = self.owner.bind(args['proposal'], None)
                row['proposalAfterBind'] = plain(args['proposal'])
                if selected:
                    self.latest = copy.deepcopy(args['proposal'])
            elif method.startswith('attention.'):
                result = getattr(self.shared, method.split('.', 1)[1])(**args)
            elif method.startswith('tracker.'):
                result = getattr(self.owner.tracker, method.split('.', 1)[1])(**args)
            else:
                result = getattr(self.owner, method)(**args)
            row['result'] = plain(result)
        except Exception as error:
            result = None
            row['exception'] = {'type': type(error).__name__, 'message': str(error)}
        row.update(state=plain(self.owner.state()), attention=attention_state(self.shared),
                   ownerAttention=attention_state(self.owner.attention), memoryPuts=plain(self.memory.puts),
                   attentionBoundShared=self.owner.attention is self.shared)
        self.case['operations'].append(row)
        return result

    def finish(self):
        self.case.update(finalState=plain(self.owner.state()), finalAttention=attention_state(self.shared),
                         finalMemoryPuts=plain(self.memory.puts))
        return self.case

    def retain_caller_state(self, memory, observation, operation_count):
        """Execute the original caller's conditional state/put/get/restore.

        Memory is the immutable original SQLite implementation, using an
        in-memory database. Its pack(sort_keys=True) boundary matters to the
        consumed order of moves and frame maps. No native state is supplied.
        The record operation's annotation remains its pre-retention result.
        """
        before = self.owner.state()
        retained = bool(self.owner.tracker.core or self.owner.tracker.methods)
        receipt = {'afterOperationCount': operation_count, 'retained': retained,
                   'beforeState': plain(before), 'storedFact': None}
        if retained:
            memory.put(self.case['episode'], 'observed_object_binding_state', before,
                       evidence=observation['observation_ref'], revision=observation['revision'])
            stored = memory.get(self.case['episode'], 'observed_object_binding_state')
            receipt['storedFact'] = plain(stored)
            self.owner.restore(stored['value'])
        receipt['afterState'] = plain(self.owner.state())
        self.case['sourceStateRetentions'].append(receipt)


def rect(rows, box, color):
    l, t, r, b = box
    for y in range(t, b + 1):
        for x in range(l, r + 1):
            rows[y][x] = color


def frame(rows, box, color):
    l, t, r, b = box
    for x in range(l + 1, r):
        rows[t][x] = rows[b][x] = color
    for y in range(t + 1, b):
        rows[y][l] = rows[y][r] = color


def scene(body_x=3, objects=((10, 10),), *, body_size=2, dx=0, dy=0, colors=None):
    rows = [[0] * 40 for _ in range(36)]
    frame(rows, (22, 7, 30, 15), 4); frame(rows, (27, 24, 33, 30), 6)
    for x, y in objects:
        rect(rows, (x, y, x + 3, y + 3), 4)
    rect(rows, (4, 25, 6, 27), 6)
    rect(rows, (body_x, 10, body_x + body_size - 1, 9 + body_size), 9)
    colors = colors or {}
    result = [[colors.get(0, 0)] * (40 + dx) for _ in range(36 + dy)]
    for y, row in enumerate(rows):
        for x, value in enumerate(row):
            result[y + dy][x + dx] = colors.get(value, value)
    return result


def public_table(mode, *, dx=0, dy=0, colors=None):
    """Declared raster/command table; no owner/proposal/expectation argument."""
    stages = []
    def add(action, x, objects, available=('ACTION3', 'ACTION4', 'ACTION5'), epoch=1, completed=0):
        stages.append({'command': {'action_ref': action}, 'rows': scene(x, objects, dx=dx, dy=dy, colors=colors),
                       'available': list(available), 'epoch': epoch, 'completed': completed})
    add('ACTION4', 4, ((10, 10),), ('ACTION3',))
    add('ACTION3', 3, ((10, 10),))
    for x in range(4, 10):
        add('ACTION4', x, ((10, 10),))
    add('ACTION5', 9, ((4, 10), (12, 10)) if mode == 'ambiguity' else ((4, 10),))
    if mode == 'ambiguity':
        return stages
    for x in range(10, 23):
        add('ACTION4', x, ((x - 5, 10),))
    if mode == 'boundary':
        add('ACTION5', 3, ((10, 10),), ('ACTION4',), epoch=2, completed=1)
    else:
        add('ACTION5', 22, ((25, 9),))
        add('ACTION3', 21, ((24 if mode == 'refutation' else 25, 9),))
    return stages


def run_table(identity, mode='positive', *, dx=0, dy=0, colors=None, limit=None, foreign_parent=False):
    chain = Chain(identity)
    rows = scene(dx=dx, dy=dy, colors=colors)
    obs = observation(rows, identity, 1, available=('ACTION4',))
    if foreign_parent:
        chain.call('attention.retain_composition', owner='foreign_declared_component', target_ref='foreign:visible-target',
                   question='Retain a separate public parent', evidence=[obs['observation_ref']], obs=obs,
                   binding={'source': 'explicit external attention contract, not learned owner knowledge'})
    table = public_table(mode, dx=dx, dy=dy, colors=colors)
    if limit is not None:
        table = table[:limit]
    cursor = 0
    while cursor < len(table):
        chain.call('attention.revalidate', obs=obs)
        chain.call('attention.take_parent_return', obs=obs)
        proposal = chain.call('propose', obs=obs, rows=rows, inputs=[], remaining=len(table) - cursor + 16)
        selected = proposal is not None
        if selected:
            chain.call('bind', selected=True)
            actions = copy.deepcopy(proposal['actions'])
        else:
            if cursor != 0:
                raise AssertionError(identity + ': source abstained before the declared public contrast at return ' + str(cursor + 1))
            actions = [table[cursor]['command']]
        for index, command in enumerate(actions):
            if cursor == len(table):
                break
            row = table[cursor]
            if command != row['command']:
                raise AssertionError(identity + ': independently chosen source command differs from declared table at ' + str(cursor))
            before, first = obs, rows
            after = observation(row['rows'], identity, cursor + 2, row['epoch'], row['completed'], row['available'])
            if selected:
                guard = chain.call('before', selected=True, index=index, public=public(first, before), obs=before)
                if not guard or not guard['admitted']:
                    raise AssertionError(identity + ': source guard did not admit its selected command')
                chain.call('after', selected=True, index=index, before=before, after=after, first=first, second=row['rows'])
            chain.call('attention.observe', before=before, after=after, command=command, focus_id=None)
            chain.call('record', selected=selected, before=before, after=after, command=command, first=first,
                       second=row['rows'], index=index)
            cursor += 1; obs, rows = after, row['rows']
    chain.call('propose', obs=obs, rows=rows, inputs=[], remaining=16)
    return chain, rows, obs


def helper(identity, method, *args, kwargs=None, float_paths=None, acquired_from=None):
    domain, name = method.split('.', 1)
    modules = {'geometry': GEOMETRY, 'identity': IDENTITY, 'reception': RECEPTION, 'planning': PLANNING,
               'tracker': TRACKER, 'family': FAMILY}
    actual_args = copy.deepcopy(args)
    if domain == 'planning' and name in ('offers', 'separation_offers'):
        tracker = TRACKER.BindingTracker(); tracker.restore(actual_args[0]); actual_args = (tracker, *actual_args[1:])
    record = {'id': identity, 'method': method, 'args': plain(args), 'kwargs': plain(kwargs or {})}
    if float_paths is not None:
        record['floatPaths'] = float_paths
    if acquired_from:
        record['acquiredFrom'] = acquired_from
    try:
        record['result'] = plain(getattr(modules[domain], name)(*actual_args, **(kwargs or {})))
    except Exception as error:
        record['exception'] = {'type': type(error).__name__, 'message': str(error)}
    HELPERS.append(record)
    return record.get('result')


def generate():
    positive, rows, obs = run_table('cold-positive')
    negative, _, _ = run_table('cold-refutation', 'refutation')
    ambiguity, _, _ = run_table('cold-ambiguity', 'ambiguity')
    boundary, _, _ = run_table('cold-official-boundary', 'boundary')
    shifted, _, _ = run_table('cold-translated-recoloured', dx=2, dy=1, colors={9: 8, 4: 3, 6: 7})
    foreign, _, _ = run_table('cold-foreign-attention-parent', foreign_parent=True)
    for chain in (positive, negative, ambiguity, boundary, shifted, foreign):
        chain.finish()

    # Context tests acquire their own complete cold prefix, then supply a
    # different current public image. They do not inject an acquired tracker.
    for variant in ('changed-corner', 'missing-frame', 'out-of-view'):
        chain, current, before = run_table('cold-context-' + variant, limit=9)
        changed = copy.deepcopy(current)
        if variant == 'changed-corner':
            changed[7][22] = 1
        elif variant == 'missing-frame':
            for y in range(7, 16):
                for x in range(22, 31):
                    if x in (22, 30) or y in (7, 15):
                        changed[y][x] = 0
        else:
            changed = [row[:22] for row in changed]
        after = observation(changed, chain.case['id'], before['revision'] + 1)
        chain.call('propose', obs=after, rows=changed, inputs=[{'action_ref': 'IGNORED_INPUT'}], remaining=16)
        chain.finish()

    for variant in ('blocked-motion', 'changed-local-delta', 'body-missing', 'body-three-by-three'):
        chain = Chain('cold-' + variant)
        size = 3 if variant == 'body-three-by-three' else 2
        first = scene(body_size=size); before = observation(first, chain.case['id'], 1)
        second = scene(4, body_size=size); after = observation(second, chain.case['id'], 2)
        chain.call('propose', obs=before, rows=first, inputs=[], remaining=16)
        chain.call('record', before=before, after=after, command={'action_ref': 'ACTION4'}, first=first, second=second, index=0)
        third = scene(4 if variant == 'blocked-motion' else 7, body_size=size)
        if variant == 'body-missing':
            third = [[0 if value == 9 else value for value in row] for row in third]
        last = observation(third, chain.case['id'], 3)
        chain.call('record', before=after, after=last, command={'action_ref': 'ACTION4'}, first=second, second=third, index=0)
        chain.call('propose', obs=last, rows=third, inputs=[], remaining=3)
        chain.finish()

    limited, current, current_obs = run_table('cold-guard-and-budget', limit=2)
    proposal = limited.latest
    if proposal:
        limited.call('bind', selected=True)
        stale = public(current, current_obs); stale['available_action_refs'] = []
        limited.call('before', selected=True, index=0, public=stale, obs=current_obs)
        wrong_obs = copy.deepcopy(current_obs); wrong_obs['observation_ref'] += ':other'
        limited.call('before', selected=True, index=0, public=public(current, current_obs), obs=wrong_obs)
        bad = copy.deepcopy(proposal); bad['actions'] = []
        limited.call('bind', proposal=bad)
        bad = copy.deepcopy(proposal); del bad['steps'][0]['expected_after']
        limited.call('bind', proposal=bad)
    limited.call('propose', obs=current_obs, rows=current, inputs=[], remaining=0)
    limited.finish()

    restore = Chain('isolated-source-restore-merge', native_checkpoint=False,
                    qualification='Explicit Python restore contract: partial __dict__.update and additional keys; not cold acquired knowledge or a native checkpoint contract.')
    restore.call('restore', state={'epoch': 3, 'extra_source_key': {'declared': True}})
    restore.call('restore', state={'moves': {}})
    restore.call('tracker.reset', epoch=4)
    restore.finish()

    helper('digest-integers', 'geometry.digest', {'z': [1, 2, None], 'a': True})
    helper('digest-unicode', 'geometry.digest', {'é': '雪😀', 'a': '\n'})
    helper('digest-python-integral-centres', 'geometry.digest', [1, [4.0, 12.0]], float_paths=[[1, 0], [1, 1]])
    helper('digest-python-half-centres', 'geometry.digest', [1, [3.5, 10.5]], float_paths=[[1, 0], [1, 1]])
    for label, box in (('integer', [2, 3, 6, 7]), ('half', [2, 3, 5, 6])):
        helper('center-' + label, 'geometry.center', box)
    for label, a, b in (('contained', [0, 0, 5, 5], [2, 2, 4, 4]),
                        ('overlap', [0, 0, 2, 2], [2, 2, 4, 4]),
                        ('adjacent', [0, 0, 1, 1], [2, 0, 3, 1]),
                        ('separate', [0, 0, 1, 1], [3, 3, 4, 4])):
        for method in ('contains', 'intersects', 'near'):
            helper(method + '-' + label, 'geometry.' + method, a, b)
    for name, variant in (('base', {}), ('shifted', {'dx': 2, 'dy': 1}),
                          ('recoloured', {'colors': {9: 8, 4: 3, 6: 7}}), ('odd-body', {'body_size': 3})):
        first, second = scene(**variant), scene(4, **variant)
        before = observation(first, 'helper-' + name, 1); after = observation(second, 'helper-' + name, 2)
        helper('unique-' + name, 'geometry.unique', before)
        frames = helper('empty-frames-' + name, 'geometry.empty_frames', before, first)
        helper('correspondence-' + name, 'geometry.correspondence', before, first)
        core = helper('moved-core-' + name, 'geometry.moved_core', before, after)
        helper('preferred-core-' + name, 'geometry.moved_core', before, after, kwargs={'minimum_area': 4, 'preferred_minimum_area': 9})
        if core:
            body = GEOMETRY.find_body(after, core['signature'])
            helper('find-body-' + name, 'geometry.find_body', after, core['signature'])
            helper('enclosing-contours-' + name, 'geometry.enclosing_contours', after, body)
            # BindingTracker.record creates core.offsets as lists of lists.
            # The observer mask instead contains tuples: converting those only
            # after calling locate changes the meaning of its equality test.
            # Call the original with the exact consumed JSON-compatible shape.
            offsets = [list(point) for point in body['mask']]
            helper('locate-' + name, 'family.locate', second, {**core, 'offsets': offsets})
        if frames:
            target = frames[0]
            helper('revalidate-frame-' + name, 'geometry.revalidate_frame', target, first)
            changed = copy.deepcopy(first); x, y = target['bbox'][:2]; changed[y][x] = 1
            helper('contradicted-frame-' + name, 'geometry.revalidate_frame', target, changed)
            helper('corner-contradiction-' + name, 'tracker.corner_contradiction', target, changed, [], [])
            helper('occluded-corner-' + name, 'tracker.corner_contradiction', target, changed, [[x, y, x, y]], [])

    # Rich inputs below come from actual prior original calls, labelled as
    # component helpers with that acquired provenance (never injected chains).
    for chain in (positive, negative):
        for index, op in enumerate(chain.case['operations']):
            if op['method'] != 'record' or 'exception' in op:
                continue
            state, i = op['state'], op['input']
            origin = {'chain': chain.case['id'], 'operation': index}
            if state['pending_reception']:
                body = GEOMETRY.find_body(i['after'], state['core']['signature'])
                helper(chain.case['id'] + '-pending-offers', 'planning.offers', state, i['after'], i['second'], 16,
                       plain(chain.owner.config), acquired_from=origin)
                helper(chain.case['id'] + '-separation-offers', 'planning.separation_offers', state, i['after'], i['second'], 16,
                       plain(chain.owner.config), body, acquired_from=origin)
            if isinstance(op.get('result'), dict) and op['result'].get('status') == 'local_attachment_hypothesis':
                held = state['held']; source = next(e for e in i['before']['entities'] if e['bbox'] == held['original_bbox'])
                candidate = next(e for e in i['after']['entities'] if e['bbox'] == held['bbox'])
                a = GEOMETRY.find_body(i['before'], state['core']['signature']); b = GEOMETRY.find_body(i['after'], state['core']['signature'])
                helper(chain.case['id'] + '-shape-compatible', 'identity.compatible', source, candidate, i['first'], i['second'], i['before'], i['after'], a, b, acquired_from=origin)
                helper(chain.case['id'] + '-unchanged', 'identity.unchanged', source, i['after'], acquired_from=origin)
            if state['pending_reception']:
                following = next(row for row in chain.case['operations'][index + 1:] if row['method'] == 'record')
                next_i = following['input']; body = GEOMETRY.find_body(next_i['after'], state['core']['signature'])
                evidence = [next_i['before']['observation_ref'], next_i['after']['observation_ref']]
                helper(chain.case['id'] + '-separation', 'reception.separation', state['pending_reception'], next_i['second'], next_i['after'], body,
                       [-1.0, 0.0], [-1.0, 0.0], evidence, acquired_from=origin)
                helper(chain.case['id'] + '-unvalidated-separation', 'reception.separation', state['pending_reception'], next_i['second'], next_i['after'], body,
                       [-1.0, 0.0], [1.0, 0.0], evidence, acquired_from=origin)
    helper('coloured-clipped-box', 'reception.coloured', [[0, 4, 4], [4, 0, 4]], [-1, -1, 5, 5], 4)
    helper('point-in-box', 'reception.in_box', [2, 3], [2, 3, 4, 5])
    helper('distance', 'planning.distance', [1.5, 4.0], [5.0, 2.0])
    helper('shift', 'planning.shift', [2, 3, 4, 5], [-1, 2])
    ids = [row['id'] for row in HELPERS]
    if len(set(ids)) != len(ids):
        raise AssertionError('Helper IDs must be unique')


ATTENTION_METHODS = {
    'open': ({'question', 'obs'}, set()), 'matches': ({'question', 'obs'}, set()), 'revalidate': ({'obs'}, set()),
    'observe': ({'before', 'after', 'command', 'focus_id'}, set()), 'take_parent_return': ({'obs'}, set()),
    'close_pending': ({'obs', 'reason'}, set()), 'composition_for': ({'owner', 'obs'}, set()),
    'retain_composition': ({'owner', 'target_ref', 'question', 'evidence', 'obs'}, {'binding'}),
    'return_composition': ({'owner', 'target_ref', 'status', 'evidence', 'obs'}, set()),
}
JOURNAL_METHODS = {
    'proposeSource': ('propose', {'obs', 'rows', 'inputs', 'remaining'}, set()),
    'recordSource': ('record', {'before', 'after', 'command', 'first', 'second'}, {'index'}),
    'bind': ('bind', set(), set()), 'before': ('before', {'index', 'public', 'obs'}, set()),
    'after': ('after', {'index', 'before', 'after', 'first', 'second'}, set()),
    **{'attention.' + name: ('attention.' + name, required, optional) for name, (required, optional) in ATTENTION_METHODS.items()},
}


def replay_journal(path):
    data = json.loads(path.read_bytes())
    if data.get('schema') != JOURNAL_SCHEMA or not isinstance(data.get('operations'), list):
        raise ValueError('Invalid public-operation journal schema')
    if any(key in data for key in ('setup', 'initialState', 'expected', 'restore', 'sourceState')):
        raise ValueError('An original journal begins cold, without injected learned state')
    chain = Chain(data['id'], episode=data.get('episode', 'common-observation-frontier'))
    bound = {**fingerprint(path), 'nativeResultsConsulted': False}
    chain.case['inputJournal'] = bound
    retention = data.get('sourceStateRetention')
    if retention not in (None, CALLER_STATE_RETENTION):
        raise ValueError('Unknown original caller state-retention contract')
    memory = SourceMemory(':memory:') if retention else None
    if retention:
        chain.case.update(sourceStateRetention=retention, sourceStateRetentions=[])
    try:
        for index, operation in enumerate(data['operations']):
            if not isinstance(operation, dict) or set(operation) - {'method', 'input', 'useLatestSourceProposal', 'native'}:
                raise ValueError('Unexpected captured operation field at ' + str(index))
            method, required, optional = JOURNAL_METHODS[operation['method']]
            args = operation['input']
            if not isinstance(args, dict) or not required <= set(args) or set(args) - required - optional:
                raise ValueError('Invalid public inputs; native proposals or states are never replay inputs')
            selected = operation.get('useLatestSourceProposal', False)
            if type(selected) is not bool or selected and method not in ('record', 'bind', 'before', 'after'):
                raise ValueError('Invalid original proposal selection flag')
            if method in ('bind', 'before', 'after') and not selected:
                raise ValueError('A source binder or guard requires the locally recomputed proposal')
            chain.call(method, selected=selected, **args)
            row = chain.case['operations'][-1]
            row.update(journalOperation=index, capturedMethod=operation['method'])
            if memory is not None and method == 'record' and 'exception' not in row:
                chain.retain_caller_state(memory, args['after'], index + 1)
        chain.finish()
    finally:
        if memory is not None:
            memory.close()
    return bound


def exclusive_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2); stream.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, default=ROOT / 'tests/fixtures/v6-observed-binding-reference.json.gz')
    parser.add_argument('--receipt', type=Path, default=ROOT / 'docs/migration/lot5c-evidence/recovery/source-oracle/export-01.json')
    parser.add_argument('--journal', type=Path, action='append', default=[])
    args = parser.parse_args()
    fixture, receipt_path = args.fixture.resolve(), args.receipt.resolve()
    if any(not path.is_relative_to(ROOT) or path.exists() for path in (fixture, receipt_path)):
        raise ValueError('Choose new exclusive outputs inside this checkout')
    journals = [path.resolve() for path in args.journal]
    if len(set(journals)) != len(journals) or any(not path.is_relative_to(ROOT / 'docs/migration/lot5c-evidence') for path in journals):
        raise ValueError('Distinct retained journals must belong to lot5c-evidence')
    manifest_path = SOURCE.parent / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())['files']
    started = datetime.now(timezone.utc).isoformat()
    before = verify_sources(manifest)
    exporter_before = fingerprint(Path(__file__))
    journal_before = [fingerprint(path) for path in journals]
    try:
        sys.path[:0] = [str(SOURCE), str(PROTO)]
        global FAMILY, TRACKER, GEOMETRY, IDENTITY, RECEPTION, PLANNING, NEUTRAL, AttentionMemory, SourceMemory
        FAMILY, TRACKER, GEOMETRY, IDENTITY, RECEPTION, PLANNING = [importlib.import_module(name) for name in DIRECT_MODULES]
        AttentionMemory = importlib.import_module('attention_memory').AttentionMemory
        SourceMemory = importlib.import_module('memory').Memory
        NEUTRAL = importlib.import_module('neutral_observer')
        input_journals = [replay_journal(path) for path in journals]
        if not journals:
            generate()
        imports = imported_modules()
        after = verify_sources(manifest)
        if before != after or fingerprint(Path(__file__)) != exporter_before or [fingerprint(path) for path in journals] != journal_before:
            raise AssertionError('An original source, exporter or journal changed during export')
    except Exception as error:
        try:
            after = verify_sources(manifest); integrity_error = None
        except Exception as changed:
            after = {}; integrity_error = {'type': type(changed).__name__, 'message': str(changed)}
        failed = {'schema': 'logos-engine.independent-python-oracle-failure.v1', 'status': 'failed', 'startedAt': started,
                  'recordedAt': datetime.now(timezone.utc).isoformat(), 'referenceCommit': COMMIT,
                  'sourceFilesVerifiedBefore': len(before), 'sourceFilesVerifiedAfter': len(after),
                  'sourceInventoryUnchanged': before == after, 'integrityError': integrity_error,
                  'importedOriginalModules': imported_modules(), 'exporter': exporter_before,
                  'error': {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()},
                  'helpers': HELPERS, 'chains': CHAINS}
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        for index in range(1, 10000):
            path = receipt_path.with_name(receipt_path.stem + '-failure-' + str(index).zfill(3) + '.json.gz')
            try:
                with path.open('xb') as stream:
                    stream.write(gzip.compress(encoded(failed), mtime=0))
                break
            except FileExistsError:
                continue
        print(json.dumps({'status': 'failed', 'failureEvidence': path.relative_to(ROOT).as_posix()}), flush=True)
        raise
    exceptions = [{'group': 'chain', 'case': chain['id'], 'operation': index, **op['exception']}
                  for chain in CHAINS for index, op in enumerate(chain['operations']) if 'exception' in op]
    exceptions += [{'group': 'helper', 'case': item['id'], **item['exception']} for item in HELPERS if 'exception' in item]
    qualifications = [
        'Recovery reconstruction: counts and outcomes are newly computed; missing former evidence is not reused.',
        'Only immutable original Python generates expectations. Native annotations are ignored in journal replay.',
        'Synthetic rasters are public fixture data, not a game implementation, solution or campaign.',
        'Every acquired owner chain starts cold. The isolated source restore contract is separately labelled.',
        'Selected journal calls consume the last locally computed original proposal, never a captured native proposal.',
        'AttentionMemory executes unmodified; a declared get/put recorder preserves its actual cumulative memory writes.',
        'Source state is the full tracker mapping. Native checkpoints and attention restoration are separate native extensions.',
        'JSON preserves insertion order; tuples become arrays and sets become sorted arrays. Python float type paths are explicit only at digest helper boundaries.',
        'Component and public-call parity do not establish the entire StrategyRouter, game completion, performance or publication.',
    ]
    if any(chain.get('sourceStateRetention') == CALLER_STATE_RETENTION for chain in CHAINS):
        qualifications.append('The explicitly declared common caller state-retention branch executes immutable original Memory.put/get and owner.restore using only the locally calculated Python state. Its SQLite JSON key ordering is retained; native checkpoint inputs are never oracle inputs.')
    data = {'schema': 'logos-engine.v6.observed-binding-reference.v1', 'referenceCommit': COMMIT,
            'mode': 'captured-public-journals' if journals else 'declared-synthetic-public-returns',
            'sourceModules': list(DIRECT_MODULES), 'helpers': HELPERS, 'chains': CHAINS,
            'exceptions': exceptions, 'inputJournals': input_journals, 'qualifications': qualifications}
    content = encoded(data); fixture.parent.mkdir(parents=True, exist_ok=True)
    with fixture.open('xb') as stream:
        stream.write(gzip.compress(content, compresslevel=9, mtime=0))
    receipt = {'schema': 'logos-engine.independent-python-oracle-export.v1', 'status': 'passed',
               'startedAt': started, 'recordedAt': datetime.now(timezone.utc).isoformat(), 'referenceCommit': COMMIT,
               'mode': data['mode'], 'sourceManifest': fingerprint(manifest_path),
               'sourceFilesVerifiedBefore': len(before), 'sourceFilesVerifiedAfter': len(after), 'sourceInventoryUnchanged': before == after,
               'sourceInventorySha256Before': sha(encoded(dict(sorted(before.items())))),
               'sourceInventorySha256After': sha(encoded(dict(sorted(after.items())))),
               'directModules': list(DIRECT_MODULES), 'importedOriginalModules': imports, 'exporter': exporter_before,
               'fixture': {**fingerprint(fixture), 'uncompressedBytes': len(content)}, 'inputJournals': input_journals,
               'counts': {'helpers': len(HELPERS), 'coldChains': sum(c['nativeCheckpointEligible'] for c in CHAINS),
                          'isolatedSourceRestoreContracts': sum(not c['nativeCheckpointEligible'] for c in CHAINS),
                          'chains': len(CHAINS), 'chainOperations': sum(len(c['operations']) for c in CHAINS),
                          'sourceExceptions': len(exceptions), 'attentionMemoryPuts': sum(len(c['finalMemoryPuts']) for c in CHAINS)},
               'qualifications': qualifications}
    if journals:
        retention_rows = [row for chain in CHAINS for row in chain.get('sourceStateRetentions', [])]
        receipt['counts'].update(sourceStateRetentionChecks=len(retention_rows),
                                 sourceStateRetentions=sum(row['retained'] for row in retention_rows))
    exclusive_json(receipt_path, receipt)
    print(json.dumps({'status': 'passed', 'counts': receipt['counts'], 'fixture': receipt['fixture']}), flush=True)


if __name__ == '__main__':
    main()
