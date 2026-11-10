#!/usr/bin/env python3
"""Synthetic public contracts from the pinned, unmodified V6 temporal sources.

No native TypeScript, game engine, specification or solution supplies expected
values. Complete source exceptions and state changes remain in the fixture.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
PROTO = SOURCE / 'agents/yf_arc3_v6/laya_proto'
FIXTURE = ROOT / 'tests/fixtures/v6-linked-preparation-reference.json.gz'
RECEIPT = ROOT / 'docs/migration/lot5a-evidence/diagnostic/source-oracle-export.json'
DIRECT_MODULES = ('common_linked_preparation', 'common_linked_contact', 'common_phase_relations', 'common_phase_transfer')
AVAILABLE = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']
INPUTS = [{'action_ref': action} for action in ['ACTION1', 'ACTION2', 'ACTION5']]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_sources():
    hashes = {}
    for name, metadata in MANIFEST.items():
        value = sha((SOURCE / name).read_bytes())
        if value != metadata['sha256']:
            raise AssertionError('Pinned original changed: ' + name)
        hashes[name] = value
    return hashes


BEFORE_HASHES = verify_sources()
sys.path[:0] = [str(SOURCE), str(PROTO)]
MODULES = {name: importlib.import_module(name) for name in DIRECT_MODULES}
LinkedPreparation = MODULES['common_linked_preparation'].LinkedPreparation
PhaseRelations = MODULES['common_phase_relations'].PhaseRelations
PhaseTransfer = MODULES['common_phase_transfer'].PhaseTransfer
CONTACT = MODULES['common_linked_contact']
np = CONTACT.np


def plain(value):
    if isinstance(value, np.ndarray):
        return plain(value.tolist())
    if isinstance(value, np.generic):
        return plain(value.item())
    if isinstance(value, bytes):
        return list(value)
    if isinstance(value, dict):
        if all(isinstance(key, str) for key in value):
            return {key: plain(item) for key, item in value.items()}
        return [[plain(key), plain(item)] for key, item in value.items()]
    if isinstance(value, set):
        return [plain(item) for item in sorted(value)]
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError('Unserialized source value: ' + type(value).__name__)


def entries(value):
    return [[plain(key), plain(item)] for key, item in value.items()]


def source_state(owner):
    p = owner.phase
    phase = {key: plain(value) for key, value in vars(p).items() if key not in ('linked_contact', 'portable', 'attempts')}
    phase['attempts'] = entries(p.attempts)
    contact = {key: plain(value) for key, value in vars(p.linked_contact).items() if key != 'vectors'}
    contact['vectors'] = entries(p.linked_contact.vectors)
    phase['linked_contact'] = contact
    portable = None
    if p.portable is not None:
        keyed = {'samples', 'pending', 'mode_edges', 'failures', 'attempted', 'site_trials', 'visited', 'local_vectors'}
        portable = {key: entries(value) if key in keyed else plain(value) for key, value in vars(p.portable).items()}
    phase['portable'] = portable
    return {'phase': phase, 'events': plain(owner.events), 'passed': plain(owner.passed),
            'current_observation': plain(owner.current_observation)}


def public(rows, observation):
    return {'frame_rows': copy.deepcopy(rows), 'level': observation['level_epoch'],
            'levels_completed': observation['levels_completed'], 'state': observation['state'],
            'frame_hash': observation['frame_hash'], 'available_action_refs': observation['available_action_refs']}


def observation(rows, name, revision, epoch=1, score=0, state='NOT_FINISHED'):
    sparse = {'level_epoch': epoch, 'levels_completed': score, 'state': state,
              'frame_hash': sha(json.dumps(rows, separators=(',', ':')).encode())[:16],
              'available_action_refs': list(AVAILABLE), 'revision': revision,
              'observation_ref': f'synthetic:linked:{name}:epoch:{epoch}:observation:{revision}'}
    return plain(LinkedPreparation.full_observation(sparse, rows))


def rect(rows, x, y, width, height, color):
    for yy in range(y, y + height):
        for xx in range(x, x + width):
            rows[yy][xx] = color


def contact_scene(position=(2, 6), remote=3, active=0, secondary=None, *, translate=(0, 0), colors=None):
    rows = [[0] * 28 for _ in range(24)]
    # Three measured compact marker slots, one open rim in the receiver material.
    for index, x in enumerate((2, 6, 10)):
        rect(rows, x, 1, 2, 2, 2 if index == active else 5)
        if index == active:
            rows[2][x + 1] = 0
    # A smaller dense support linked to a larger support by a thin component.
    rect(rows, 10, 6, 2, 2, 3)
    for y in range(8, 16):
        rows[y][11] = 3
    for x in range(12, 15):
        rows[15][x] = 3
    rect(rows, 14, 14, 3, 3, remote)
    # A three-sided open rim whose cavity is on the measured receiver lattice.
    for y in range(5, 10):
        rows[y][17] = rows[y][21] = 2
    for x in range(17, 22):
        rows[9][x] = 2
    if secondary is not None:
        rect(rows, *secondary, 3, 3, 6)
    rect(rows, *position, 3, 3, 2)
    if colors:
        rows = [[colors.get(value, value) for value in row] for row in rows]
    dx, dy = translate
    if dx or dy:
        moved = [[colors.get(0, 0) if colors else 0] * (28 + dx) for _ in range(24 + dy)]
        for y, row in enumerate(rows):
            moved[y + dy][dx:dx + len(row)] = row
        rows = moved
    return rows


def phase_scene(primary, marker=0, secondary=None, remote=8, *, new_epoch=False):
    rows = [[0] * 34 for _ in range(24)]
    rect(rows, 1 + marker * 4, 1, 2, 2, 7)
    locus = (6, 6) if new_epoch else (6, 14)
    rect(rows, *locus, 2, 2, 3)
    rect(rows, 18, 14, 3, 3, 9)
    rows[10][25] = rows[10][26] = remote
    if secondary is not None:
        rect(rows, *secondary, 3, 3, 6)
    rect(rows, *primary, 3, 3, 2)
    return rows


class Chain:
    def __init__(self, identity, qualification='Cold source wrapper; every state is acquired from declared synthetic public returns.'):
        self.owner = LinkedPreparation()
        self.case = {'id': identity, 'qualification': qualification, 'operations': []}
        self.last_proposal = None

    def call(self, method, **given):
        inputs = copy.deepcopy(given)
        item = {'method': method, 'input': plain(inputs)}
        try:
            args = copy.deepcopy(inputs)
            if method == 'record':
                result = self.owner.record(**args)
            elif method == 'propose':
                result = self.owner.propose(**args)
                self.last_proposal = copy.deepcopy(result)
            elif method == 'before':
                args['public'] = SimpleNamespace(**args['public'])
                result = self.owner.before(**args)
            elif method == 'after':
                result = self.owner.after(**args)
            elif method == 'preservation_obligations':
                result = self.owner.preservation_obligations(**args)
            else:
                raise ValueError('Unknown fixture method: ' + method)
            item['result'] = plain(result)
        except Exception as error:
            result = None
            item['exception'] = {'type': type(error).__name__, 'message': str(error)}
        item['state'] = source_state(self.owner)
        self.case['operations'].append(item)
        return result

    def record(self, first, second, before, after, action, data=None):
        command = {'action_ref': action}
        if data is not None:
            command['data'] = data
        return self.call('record', before=before, after=after, command=command, first=first, second=second)

    def propose(self, rows, obs, remaining=16, inputs=None):
        return self.call('propose', observation=obs, rows=rows, inputs=INPUTS if inputs is None else inputs, remaining=remaining)


CHAINS = []
HELPERS = []
COMPONENTS = []


def helper(identity, method, inputs, invoke):
    item = {'id': identity, 'method': method, 'input': plain(inputs)}
    try:
        item['result'] = plain(invoke())
    except Exception as error:
        item['exception'] = {'type': type(error).__name__, 'message': str(error)}
    HELPERS.append(item)


def contact_chain(identity, persistent=False, translated=False):
    chain = Chain(identity)
    kwargs = {'translate': (3, 2), 'colors': {0: 8, 2: 11, 3: 4, 4: 9, 5: 1, 6: 12}} if translated else {}
    rows = [contact_scene((2, 6), **kwargs), contact_scene((6, 6), **kwargs),
            contact_scene((10, 6), remote=4, **kwargs),
            contact_scene((6, 6), remote=4 if persistent else 3, **kwargs),
            contact_scene((10, 6), remote=4, **kwargs)]
    observations = [observation(value, identity, index + 1) for index, value in enumerate(rows)]
    chain.propose(rows[0], observations[0])
    chain.record(rows[0], rows[1], observations[0], observations[1], 'ACTION1')
    fitted = chain.propose(rows[1], observations[1])
    if fitted is None:
        raise AssertionError(identity + ': synthetic cold fit failed')
    chain.call('before', proposal=fitted, index=0, public=public(rows[1], observations[1]), observation=observations[1])
    for label, change in [('stale-observation', {'observation_ref': 'synthetic:stale'}),
                          ('wrong-score', {'levels_completed': 1}), ('wrong-epoch', {'level_epoch': 2}),
                          ('missing-input', {'available_action_refs': []}), ('stale-frame', {'frame_hash': 'stale'})]:
        altered = {**observations[1], **change}
        chain.call('before', proposal=fitted, index=0, public=public(rows[1], altered), observation=altered)
    chain.call('after', proposal=fitted, index=0, before=observations[1], after=observations[1], first=rows[1], second=rows[1])
    for change in [{'level_epoch': 2}, {'levels_completed': 1}, {'state': 'WIN'}]:
        chain.call('after', proposal=fitted, index=0, before=observations[1], after={**observations[2], **change}, first=rows[1], second=rows[2])
    chain.call('after', proposal=fitted, index=0, before=observations[1], after=observations[2], first=rows[1], second=rows[2])
    chain.record(rows[1], rows[2], observations[1], observations[2], 'ACTION1')
    chain.propose(rows[2], observations[2])
    chain.record(rows[2], rows[3], observations[2], observations[3], 'ACTION2')
    chain.propose(rows[3], observations[3])
    chain.call('preservation_obligations', observation=observations[3], rows=rows[3])
    if not persistent:
        chain.record(rows[3], rows[4], observations[3], observations[4], 'ACTION1')
        phase_proposal = chain.propose(rows[4], observations[4])
        if phase_proposal is None or phase_proposal['phase_plan']['mode'] != 'phase':
            raise AssertionError(identity + ': reversible source phase trial not reached')
        chain.call('preservation_obligations', observation=observations[4], rows=rows[4])
    CHAINS.append(chain.case)
    return chain, rows, observations


reversible, contact_rows, contact_obs = contact_chain('reversible-contact-and-phase')
persistent, _, _ = contact_chain('persistent-departure', persistent=True)
contact_chain('translated-palette-permuted-contact', translated=True)

# All control vectors are acquired from cold public returns. The changing public
# availability is part of this declared synthetic input sequence, not a hidden
# priority or state injection. The fourth return permits a two-action path.
for label, remote in [('learned-multi-action-access', 4), ('learned-path-no-remote-effect', 3)]:
    chain = Chain(label)
    calibration = [(2, 6), (6, 6), (6, 10), (2, 10), (2, 6)]
    commands = ['ACTION1', 'ACTION3', 'ACTION2', 'ACTION4']
    scenes = [contact_scene(position) for position in calibration]
    views = [observation(scene, label, index + 1) for index, scene in enumerate(scenes)]
    for index in range(4):
        views[index]['available_action_refs'] = [commands[index]]
    views[4]['available_action_refs'] = AVAILABLE[:-1]
    chain.propose(scenes[0], views[0], inputs=[{'action_ref': commands[0]}])
    for index, action in enumerate(commands):
        chain.record(scenes[index], scenes[index + 1], views[index], views[index + 1], action)
        proposal = chain.propose(scenes[index + 1], views[index + 1],
            inputs=[{'action_ref': ref} for ref in views[index + 1]['available_action_refs']])
    if proposal is None or len(proposal['actions']) != 2:
        raise AssertionError(label + ': learned two-action source path unavailable')
    last_rows, last_obs = scenes[-1], views[-1]
    for index, position in enumerate([(6, 6), (10, 6)]):
        next_rows = contact_scene(position, remote=remote if index == 1 else 3)
        next_obs = observation(next_rows, label, index + 6)
        next_obs['available_action_refs'] = AVAILABLE[:-1]
        chain.call('before', proposal=proposal, index=index, public=public(last_rows, last_obs), observation=last_obs)
        chain.call('after', proposal=proposal, index=index, before=last_obs, after=next_obs, first=last_rows, second=next_rows)
        chain.record(last_rows, next_rows, last_obs, next_obs, 'ACTION1')
        last_rows, last_obs = next_rows, next_obs
    chain.propose(last_rows, last_obs, inputs=[{'action_ref': ref} for ref in AVAILABLE[:-1]])
    chain.call('preservation_obligations', observation=last_obs, rows=last_rows)
    CHAINS.append(chain.case)

# Continue the actual reversible acquisition through phase response and replay.
last_rows, last_obs = contact_rows[-1], contact_obs[-1]
for index, (position, copy_position, action) in enumerate([
    ((2, 6), (10, 6), 'ACTION5'),
    ((2, 10), (6, 6), 'ACTION3'),
    ((2, 10), (6, 6), 'ACTION3'),
    ((6, 10), (10, 6), 'ACTION1'),
    ((10, 10), (6, 6), 'ACTION1'),
    ((14, 10), (10, 6), 'ACTION1'),
]):
    rows = contact_scene(position, remote=4, active=1, secondary=copy_position)
    obs = observation(rows, 'reversible-contact-and-phase', index + 6)
    reversible.record(last_rows, rows, last_obs, obs, action)
    reversible.propose(rows, obs, inputs=[{'action_ref': a} for a in AVAILABLE[:-1]])
    reversible.call('preservation_obligations', observation=obs, rows=rows)
    last_rows, last_obs = rows, obs

# Preserve a real divergence after the preceding valid replay evidence.
rows = contact_scene((18, 10), remote=4, active=1, secondary=(22, 18))
obs = observation(rows, 'reversible-contact-and-phase', 12)
reversible.record(last_rows, rows, last_obs, obs, 'ACTION1')
reversible.propose(rows, obs)
reversible.call('preservation_obligations', observation=obs, rows=rows)

# Full source-measured observations and compact/patched helper branches.
helper_body = persistent.owner.phase.linked_contact.body
helper_obs = persistent.case['operations'][2]['input']['observation']
for method, function in [('open_enclosures', CONTACT.open_enclosures), ('linked_nodes', CONTACT.linked_nodes)]:
    for label, view in [('positive', helper_obs), ('empty', {**helper_obs, 'entities': []})]:
        helper(method + '-' + label, method, {'observation': view, 'body': helper_body, 'quantum': helper_body['quantum']},
               lambda f=function, v=view: f(v, helper_body, helper_body['quantum']))
for details in [False, True]:
    helper('phase-slots-' + str(details).lower(), 'phase_slots', {'observation': helper_obs, 'body': helper_body, 'details': details},
           lambda d=details: CONTACT.phase_slots(helper_obs, helper_body, details=d))
sparse = {key: value for key, value in contact_obs[0].items() if key != 'entities'}
helper('full-observation-measures-public-raster', 'full_observation', {'observation': sparse, 'rows': contact_rows[0]},
       lambda: LinkedPreparation.full_observation(sparse, contact_rows[0]))
helper('full-observation-preserves-existing-measurements', 'full_observation', {'observation': contact_obs[0], 'rows': contact_rows[0]},
       lambda: LinkedPreparation.full_observation(contact_obs[0], contact_rows[0]))
for label, view in [('absent', {**helper_obs, 'entities': []}),
                    ('two-competing-rows', {**helper_obs, 'entities': helper_obs['entities'] + [
                        {**entity, 'position': [entity['position'][0], entity['position'][1] + 19],
                         'bbox': [entity['bbox'][0], entity['bbox'][1] + 19, entity['bbox'][2], entity['bbox'][3] + 19]}
                        for entity in helper_obs['entities'] if entity['bbox'][1] == 1]})]:
    helper('phase-slots-' + label, 'phase_slots', {'observation': view, 'body': helper_body, 'details': False},
           lambda v=view: CONTACT.phase_slots(v, helper_body))
helper('compressed-visible-path', 'compressed', {'values': [[1, 2], [1, 2], None, [5, 2], [5, 2], [1, 2]]},
       lambda: MODULES['common_phase_relations'].compressed([[1, 2], [1, 2], None, [5, 2], [5, 2], [1, 2]]))
for label, position in [('inside', (2, 6)), ('negative', (-1, 6)), ('past-edge', (33, 23))]:
    helper('portable-patch-' + label, 'portable_patch', {'rows': contact_rows[0], 'position': position, 'size': (3, 3)},
           lambda p=position: MODULES['common_phase_transfer'].patch(np.asarray(contact_rows[0], dtype=np.uint8), p, (3, 3)))

# Real acquisition of a repeated path, a reversible remote region and a changed
# endpoint. This uses public measurement only, not a manufactured fitted model.
portable = Chain('phase-relation-and-two-scored-boundaries')
sequence = [
    ((2, 6), 0, None, 8, None),
    ((6, 6), 0, None, 8, 'ACTION1'),
    ((10, 6), 0, None, 8, 'ACTION1'),
    ((2, 14), 1, (2, 6), 8, 'ACTION5'),
    ((6, 14), 1, (6, 6), 4, 'ACTION1'),
    ((6, 14), 1, (10, 6), 4, 'ACTION4'),
    ((10, 14), 1, (10, 6), 8, 'ACTION1'),
    ((2, 6), 0, None, 8, 'ACTION5'),
    ((6, 6), 0, None, 8, 'ACTION1'),
    ((10, 6), 0, None, 8, 'ACTION1'),
    ((14, 6), 0, None, 8, 'ACTION1'),
    ((2, 14), 1, (2, 6), 8, 'ACTION5'),
    ((6, 14), 1, (6, 6), 4, 'ACTION1'),
    ((10, 14), 1, (10, 6), 8, 'ACTION1'),
    ((10, 14), 1, (14, 6), 8, 'ACTION4'),
    ((14, 14), 1, (14, 6), 8, 'ACTION1'),
    ((10, 14), 1, (14, 6), 8, 'ACTION2'),
    ((14, 14), 1, (14, 6), 8, 'ACTION1'),
]
last_rows = last_obs = None
for index, (position, marker, secondary, remote, action) in enumerate(sequence):
    rows = phase_scene(position, marker, secondary, remote)
    obs = observation(rows, 'phase-relation-and-two-scored-boundaries', index + 1)
    if action is not None:
        portable.record(last_rows, rows, last_obs, obs, action)
    last_rows, last_obs = rows, obs
if not (portable.owner.phase.model and portable.owner.phase.supported and portable.owner.phase.remote):
    raise AssertionError('Synthetic public phase chain did not acquire model/support/remote')
learned_phase = copy.deepcopy(portable.owner)
learned_rows, learned_obs = copy.deepcopy(last_rows), copy.deepcopy(last_obs)

rows = phase_scene((2, 6), new_epoch=True)
obs = observation(rows, 'phase-relation-and-two-scored-boundaries', 19, epoch=2, score=1)
portable.record(last_rows, rows, last_obs, obs, 'ACTION1')
if portable.owner.phase.portable is None:
    raise AssertionError('Scored boundary failed to retain the source portable hypothesis')
portable.propose(rows, obs)
last_rows, last_obs = rows, obs
for index, (position, marker, remote, action) in enumerate([
    ((6, 6), 0, 4, 'ACTION1'), ((2, 6), 0, 8, 'ACTION2'),
    ((6, 6), 0, 4, 'ACTION1'), ((2, 6), 1, 4, 'ACTION5'),
    ((6, 6), 1, 4, 'ACTION1'), ((10, 6), 1, 4, 'ACTION1'),
]):
    rows = phase_scene(position, marker, remote=remote, new_epoch=True)
    obs = observation(rows, 'phase-relation-and-two-scored-boundaries', 20 + index, epoch=2, score=1)
    portable.record(last_rows, rows, last_obs, obs, action)
    portable.propose(rows, obs)
    last_rows, last_obs = rows, obs
rows = phase_scene((2, 6), new_epoch=True)
obs = observation(rows, 'phase-relation-and-two-scored-boundaries', 26, epoch=3, score=2)
portable.record(last_rows, rows, last_obs, obs, 'ACTION1')
portable.call('preservation_obligations', observation=obs, rows=rows)
CHAINS.append(portable.case)
portable_rows, portable_obs = copy.deepcopy(rows), copy.deepcopy(obs)

# These component requests start from an explicitly exported acquired state.
# They qualify delegation behavior separately from the wrapper's production
# proposal path, which calls LinkedContact directly.
def component(identity, owner, method, inputs, invoke):
    item = {'id': identity, 'method': method, 'setup': source_state(owner), 'input': plain(inputs),
            'qualification': 'Direct source component request from explicitly retained synthetic acquisition; not wrapper proposal selection.'}
    try:
        item['result'] = plain(invoke())
    except Exception as error:
        item['exception'] = {'type': type(error).__name__, 'message': str(error)}
    item['state'] = source_state(owner)
    COMPONENTS.append(item)


for label, rows in [('visible-original', learned_rows), ('visible-changed', copy.deepcopy(learned_rows))]:
    owner = copy.deepcopy(learned_phase)
    if label == 'visible-changed':
        for x, y, old, new in owner.phase.remote['pixels']:
            rows[y][x] = new
    state = owner.phase.snapshot(learned_obs, rows)
    component('condition-' + label, owner, 'phase.condition_measure', {'state': plain(state)},
              lambda o=owner, s=state: o.phase.condition_measure(s))

for label, position in [('fully-occluded', (25, 10)), ('partly-occluded', (26, 10))]:
    owner = copy.deepcopy(learned_phase)
    rows = phase_scene(position, marker=1, secondary=(14, 6), remote=4)
    view = observation(rows, label, 40)
    state = {'rows': np.asarray(rows, dtype=np.uint8), 'poses': {
        entity['signature']: tuple(entity['position']) for entity in view['entities'] if not entity['identity_ambiguous']}}
    component('condition-' + label, owner, 'phase.condition_measure', {'state': plain(state)},
              lambda o=owner, s=state: o.phase.condition_measure(s))

owner = copy.deepcopy(learned_phase)
component('portable-from-scored-boundary', owner, 'PhaseTransfer.from_boundary',
          {'before': learned_obs, 'command': {'action_ref': 'ACTION1'}, 'rows': learned_rows, 'after': portable.case['operations'][17]['input']['after']},
          lambda: vars(PhaseTransfer.from_boundary(owner.phase, learned_obs, {'action_ref': 'ACTION1'}, learned_rows,
              portable.case['operations'][17]['input']['after']))['prior'])

# The ordinary wrapper cannot manufacture these advanced proposals. The legacy
# component creates one only to exercise the still-consumed guard delegation.
guard_seed = copy.deepcopy(portable.owner)
producer = copy.deepcopy(guard_seed)
portable_proposal = producer.phase.portable.propose(producer.phase, portable_obs, 16)
if portable_proposal is None:
    raise AssertionError('Synthetic portable guard proposal unavailable')
for label, changes in [('valid', {}), ('stale', {'observation_ref': 'synthetic:stale'}),
                        ('unavailable', {'available_action_refs': []}), ('wrong-score', {'levels_completed': 3})]:
    owner = copy.deepcopy(guard_seed)
    view = {**portable_obs, **changes}
    given = {'proposal': portable_proposal, 'index': 0, 'public': public(portable_rows, view), 'observation': view}
    component('portable-before-' + label, owner, 'before', given,
              lambda o=owner, a=given: o.before(a['proposal'], a['index'], SimpleNamespace(**a['public']), a['observation']))
for label, next_rows, changes in [
    ('matched', phase_scene((6, 6), new_epoch=True), {}),
    ('diverged', phase_scene((2, 6), new_epoch=True), {}),
    ('score-boundary', phase_scene((6, 6), new_epoch=True), {'score': 3}),
    ('epoch-boundary', phase_scene((6, 6), new_epoch=True), {'epoch': 4}),
]:
    owner = copy.deepcopy(guard_seed)
    view = observation(next_rows, 'portable-guard-' + label, 50, epoch=changes.get('epoch', 3), score=changes.get('score', 2))
    given = {'proposal': portable_proposal, 'index': 0, 'before': portable_obs, 'after': view, 'first': portable_rows, 'second': next_rows}
    component('portable-after-' + label, owner, 'after', given, lambda o=owner, a=given: o.after(**a))

# Explicit refusal and source-exception cases stay visible, including mutation
# performed by the source before it rejects a non-contiguous record.
refusals = Chain('refusals-and-source-exceptions')
refusals.propose(contact_rows[0], contact_obs[0], remaining=0)
refusals.record(contact_rows[0], contact_rows[1], contact_obs[0], contact_obs[1], 'ACTION1')
refusals.propose(contact_rows[1], contact_obs[1], remaining=0)
refusals.propose(contact_rows[1], contact_obs[1], remaining=-1)
refusals.propose(contact_rows[1], contact_obs[1], inputs=[])
refusals.propose(contact_rows[1], contact_obs[1], inputs=[{'action_ref': 'ACTION1', 'data': {'x': 1, 'y': 1}}])
refusals.record(contact_rows[0], contact_rows[2], contact_obs[0], contact_obs[2], 'ACTION1')
missing = {key: value for key, value in contact_obs[1].items() if key != 'entities'}
refusals.record(contact_rows[1], contact_rows[2], missing, contact_obs[2], 'ACTION1')
CHAINS.append(refusals.case)

bad_input = Chain('source-malformed-public-observation-exception',
    'Outside the admitted observation contract; preserve the original exception and its partial mutation explicitly.')
bad_after = {key: value for key, value in contact_obs[1].items() if key != 'entities'}
bad_input.record(contact_rows[0], contact_rows[1], contact_obs[0], bad_after, 'ACTION1')
CHAINS.append(bad_input.case)

reset = Chain('nonprogress-epoch-reset-and-scored-passed-list')
reset.record(contact_rows[0], contact_rows[1], contact_obs[0], contact_obs[1], 'ACTION1')
next_obs = observation(contact_rows[0], 'reset', 3, epoch=2)
reset.record(contact_rows[1], contact_rows[0], contact_obs[1], next_obs, 'ACTION5')
reset.propose(contact_rows[0], next_obs)
scored = observation(contact_rows[0], 'reset', 4, epoch=3, score=1)
reset.record(contact_rows[0], contact_rows[0], next_obs, scored, 'ACTION5')
terminal = observation(contact_rows[0], 'reset', 5, epoch=3, score=1, state='GAME_OVER')
reset.record(contact_rows[0], contact_rows[0], scored, terminal, 'ACTION5')
CHAINS.append(reset.case)

data = {'schema': 'logos-engine.v6.linked-preparation-reference.v1', 'referenceCommit': COMMIT,
        'sourceModules': list(DIRECT_MODULES), 'helpers': HELPERS, 'chains': CHAINS, 'components': COMPONENTS,
        'qualifications': [
            'All rasters and returned transitions are synthetic public observations, not game solutions.',
            'Wrapper propose delegates directly to LinkedContact, even when PhaseRelations retains a portable hypothesis.',
            'Direct component calls are separated from cold wrapper acquisition and production selection.',
            'Source exceptions and mutation before exceptions remain explicit; they are not normalized to null.',
            'No TypeScript output supplies source expectations; all original files are verified before and after import/execution.',
            'Source state is an explicit representation of Python arrays, tuples, sets, maps and bytes; it is not a source-defined checkpoint API.',
        ]}
exceptions = [{'group': 'chain', 'case': case['id'], 'operation': index, 'method': row['method'], **row['exception']}
              for case in CHAINS for index, row in enumerate(case['operations']) if 'exception' in row]
exceptions += [{'group': group, 'case': row['id'], 'method': row['method'], **row['exception']}
               for group, rows in [('helper', HELPERS), ('component', COMPONENTS)] for row in rows if 'exception' in row]
data['exceptions'] = exceptions
after_hashes = verify_sources()
if after_hashes != BEFORE_HASHES:
    raise AssertionError('Original source inventory changed during export')
FIXTURE.parent.mkdir(parents=True, exist_ok=True)
encoded = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
FIXTURE.write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
imports = {}
for name, module in sorted(sys.modules.items()):
    filename = getattr(module, '__file__', None)
    if filename:
        path = Path(filename).resolve()
        if path.is_relative_to(SOURCE):
            imports[name] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes())}
receipt = {'schema': 'logos-engine.independent-python-oracle-export.v1', 'status': 'passed',
           'recordedAt': datetime.now(timezone(timedelta(hours=-3))).isoformat(), 'referenceCommit': COMMIT,
           'sourceFilesVerifiedBefore': len(BEFORE_HASHES), 'sourceFilesVerifiedAfter': len(after_hashes),
           'sourceInventoryUnchanged': True, 'directModules': list(DIRECT_MODULES), 'importedOriginalModules': imports,
           'sourceManifest': {'path': (SOURCE.parent / 'manifest.json').relative_to(ROOT).as_posix(),
                              'sha256': sha((SOURCE.parent / 'manifest.json').read_bytes())},
           'sourceInventorySha256Before': sha(json.dumps(BEFORE_HASHES, sort_keys=True, separators=(',', ':')).encode()),
           'sourceInventorySha256After': sha(json.dumps(after_hashes, sort_keys=True, separators=(',', ':')).encode()),
           'directSourceBeforeAfter': {name: {
               'path': (PROTO / (name + '.py')).relative_to(ROOT).as_posix(),
               'sha256Before': BEFORE_HASHES[(PROTO / (name + '.py')).relative_to(SOURCE).as_posix()],
               'sha256After': after_hashes[(PROTO / (name + '.py')).relative_to(SOURCE).as_posix()]}
               for name in DIRECT_MODULES},
           'fixture': {'path': FIXTURE.relative_to(ROOT).as_posix(), 'bytes': FIXTURE.stat().st_size,
                       'sha256': sha(FIXTURE.read_bytes()), 'uncompressedBytes': len(encoded)},
           'exporter': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(Path(__file__).read_bytes()),
                        'bytes': Path(__file__).stat().st_size},
           'counts': {'helpers': len(HELPERS), 'coldChains': len(CHAINS),
                      'chainOperations': sum(len(case['operations']) for case in CHAINS),
                      'directComponents': len(COMPONENTS), 'sourceExceptions': len(exceptions)},
           'acquiredPhaseChain': {'model': bool(learned_phase.phase.model), 'remote': bool(learned_phase.phase.remote),
                                 'supportedChangedEndpoint': bool(learned_phase.phase.supported),
                                 'portableRetainedAfterTwoScoredBoundaries': portable.owner.phase.portable is not None},
           'qualifications': data['qualifications']}
RECEIPT.parent.mkdir(parents=True, exist_ok=True)
RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'passed', 'counts': receipt['counts'], 'fixture': receipt['fixture'],
                  'acquiredPhaseChain': receipt['acquiredPhaseChain']}))
