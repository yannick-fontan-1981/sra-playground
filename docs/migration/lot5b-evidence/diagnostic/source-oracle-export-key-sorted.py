#!/usr/bin/env python3
"""Independent addressed-material contracts from pinned, unmodified Python.

All images below are declared synthetic public returns. No game engine, game
specification, solution or native TypeScript output supplies an expectation.
Run only after the shared execution window has explicitly been released.
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
DIRECT_MODULES = ('common_addressed_material', 'common_addressed_field', 'common_field_stock', 'common_linked_preparation')
AVAILABLE = ['ACTION6']
CHAINS, HELPERS, STARTED_CHAINS = [], [], []
DEFAULT_STOCK_BODIES = [(2, 4, 10, 2), (2, 8, 10, 2), (2, 4, 20, 2),
                        (2, 8, 20, 2), (2, 22, 10, 2), (2, 26, 10, 2)]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_sources(manifest):
    hashes = {}
    for name, metadata in manifest.items():
        value = sha((SOURCE / name).read_bytes())
        if value != metadata['sha256']:
            raise AssertionError('Pinned original changed: ' + name)
        hashes[name] = value
    return hashes


def plain(value, *, state=False):
    """Public JSON transport and stricter source-state projections are distinct."""
    if hasattr(value, 'tolist'):
        return plain(value.tolist(), state=state)
    if hasattr(value, 'item') and not isinstance(value, (dict, list, tuple, set)):
        return plain(value.item(), state=state)
    if isinstance(value, dict):
        if state and not all(isinstance(key, str) for key in value):
            return [[plain(key, state=True), plain(item, state=True)] for key, item in value.items()]
        if not all(isinstance(key, (str, int)) and not isinstance(key, bool) for key in value):
            raise TypeError('Public JSON cannot encode this mapping key')
        return {str(key): plain(item, state=state) for key, item in value.items()}
    if isinstance(value, set):
        return [plain(item, state=state) for item in sorted(value)]
    if isinstance(value, (list, tuple)):
        return [plain(item, state=state) for item in value]
    if isinstance(value, bytes):
        return list(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError('Unserialized source value: ' + type(value).__name__)


def prior_state(prior):
    if prior is None:
        return None
    result = plain(prior, state=True)
    if 'observed_rules' in prior:
        result['observed_rules'] = [[plain(key, state=True), plain(value, state=True)]
                                    for key, value in prior['observed_rules'].items()]
    return result


def stock_state(stock):
    if stock is None:
        return None
    mappings = {'demands', 'rules', 'lineages', 'minimums'}
    return {key: [[plain(k, state=True), plain(v, state=True)] for k, v in value.items()] if key in mappings
            else prior_state(value) if key == 'prior' else plain(value, state=True)
            for key, value in vars(stock).items()}


def source_state(owner):
    # Do not insert current_observation: the original creates it only on guards.
    return {key: stock_state(value) if key == 'stock' else prior_state(value) if key == 'prior' else plain(value, state=True)
            for key, value in vars(owner).items()}


def rect(rows, x, y, width, height, color):
    for yy in range(y, y + height):
        for xx in range(x, x + width):
            rows[yy][xx] = color


def rim(rows, x, y, side, color):
    for yy in range(y, y + side):
        for xx in range(x, x + side):
            if xx in (x, x + side - 1) or yy in (y, y + side - 1):
                rows[yy][xx] = color


def transform(rows, shift=(0, 0), colors=None):
    colors = colors or {}
    dx, dy = shift
    moved = [[colors.get(0, 0)] * (len(rows[0]) + dx) for _ in range(len(rows) + dy)]
    for y, row in enumerate(rows):
        for x, value in enumerate(row):
            moved[y + dy][x + dx] = colors.get(value, value)
    return moved


def field_scene(position=(2, 8), *, shift=(0, 0), colors=None, exemplar=True,
                second_goal=False, extra_mobile=None, initial_locus=True):
    rows = [[0] * 28 for _ in range(24)]
    if exemplar:
        rect(rows, 2, 2, 2, 2, 2)
    # A thick enclosure leaves exactly the homologous shadow as its interior.
    # A thin rim with an intervening background ring would itself expose a
    # second centered enclosure and correctly leave the original unresolved.
    rect(rows, 15, 2, 6, 6, 6)
    rect(rows, 17, 4, 2, 2, 5)
    if second_goal:
        rect(rows, 19, 14, 6, 6, 6)
        rect(rows, 21, 16, 2, 2, 5)
    if initial_locus:
        rows[9][6] = 8  # An actual public pixel, with no role supplied to the agent.
    if extra_mobile is not None:
        rect(rows, *extra_mobile, 2, 2, 2)
    rect(rows, *position, 2, 2, 2)
    return transform(rows, shift, colors)


def stock_scene(bodies=None, *, shift=(0, 0), colors=None, order=(2, 4, 8),
                requests=(4, 4), zones=True):
    rows = [[0] * 36 for _ in range(30)]
    for color, x in zip(order, (12, 16, 20)):
        rect(rows, x, 1, 2, 2, color)
    for color, x in zip(requests, (2, 6)):
        rect(rows, x, 1, 3, 3, color)
    if zones:
        rim(rows, 20, 18, 6, 6)
        rim(rows, 28, 22, 6, 6)
    if bodies is None:
        bodies = DEFAULT_STOCK_BODIES
    for color, x, y, side in bodies:
        rect(rows, x, y, side, side, color)
    return transform(rows, shift, colors)


def observation(rows, identity, revision, epoch=1, completed=0, state='NOT_FINISHED', available=None):
    sparse = {'revision': revision, 'level_epoch': epoch, 'levels_completed': completed, 'state': state,
              'frame_hash': sha(bytes(value for row in rows for value in row))[:16],
              'available_action_refs': list(AVAILABLE if available is None else available),
              'observation_ref': f'synthetic:addressed:{identity}:epoch:{epoch}:revision:{revision}'}
    return LinkedPreparation.full_observation(sparse, rows)


def protocol(observation):
    return {key: copy.deepcopy(value) for key, value in observation.items() if key != 'entities'}


def public(rows, obs):
    return {'frame_rows': copy.deepcopy(rows), 'level': obs['level_epoch'],
            'levels_completed': obs['levels_completed'], 'state': obs['state'],
            'frame_hash': obs['frame_hash'], 'available_action_refs': list(obs['available_action_refs'])}


class Chain:
    def __init__(self, identity, shift=(0, 0), colors=None):
        self.owner = AddressedMaterial()
        self.case = {'id': identity, 'qualification': 'Cold original owner; all state is acquired from declared synthetic public returns.',
                     'operations': [], 'initialState': source_state(self.owner)}
        STARTED_CHAINS.append(self.case)
        self.identity, self.shift, self.colors = identity, shift, colors or {}
        self.revision, self.epoch, self.completed = 1, 1, 0
        self.rows = field_scene(shift=shift, colors=colors)
        self.obs = observation(self.rows, identity, self.revision)

    def call(self, method, **given):
        args = copy.deepcopy(given)
        row = {'method': method, 'input': plain(args)}
        try:
            if method == 'before':
                args['public'] = SimpleNamespace(**args['public'])
            if method == 'bind':
                domain = ObservedInputDomain(4096)
                result = self.owner.bind(args['proposal'], domain)
                self.last_bound_proposal = copy.deepcopy(args['proposal'])
                row['proposalAfterBind'] = plain(args['proposal'])
            elif method.startswith('stock.'):
                if self.owner.stock is None:
                    raise AssertionError('Cold chain did not acquire its stock')
                result = getattr(self.owner.stock, method.split('.', 1)[1])(**args)
            else:
                result = getattr(self.owner, method)(**args)
            row['result'] = plain(result)
        except Exception as error:
            result = None
            row['exception'] = {'type': type(error).__name__, 'message': str(error)}
        row['state'] = source_state(self.owner)
        self.case['operations'].append(row)
        return result

    def point(self, x, y):
        return {'x': x + self.shift[0], 'y': y + self.shift[1]}

    def propose(self, remaining=16):
        return self.call('propose', observation=self.obs, rows=self.rows, inputs=[], remaining=remaining)

    def obligations(self):
        return self.call('preservation_obligations', observation=self.obs, rows=self.rows)

    def transition(self, second, command, *, proposal=None, index=None, frames=None,
                   epoch=None, completed=None, sparse_guards=False):
        epoch = self.epoch if epoch is None else epoch
        completed = self.completed if completed is None else completed
        after = observation(second, self.identity, self.revision + 1, epoch, completed)
        if proposal is not None:
            self.call('before', proposal=proposal, index=index, public=public(self.rows, self.obs),
                      observation=protocol(self.obs) if sparse_guards else self.obs)
            self.call('after', proposal=proposal, index=index,
                      before=protocol(self.obs) if sparse_guards else self.obs,
                      after=protocol(after) if sparse_guards else after, first=self.rows, second=second)
        result = self.call('record', before=self.obs, after=after, command=command,
                           first=self.rows, second=second, proposal=proposal, index=index, frames=frames)
        self.rows, self.obs = copy.deepcopy(second), after
        self.revision, self.epoch, self.completed = self.revision + 1, epoch, completed
        return result

    def fork(self, identity):
        other = copy.deepcopy(self)
        other.case['id'] = identity
        other.case['qualification'] += ' Full acquired prefix is repeated before this branch; no state is injected.'
        other.case['forkedFrom'] = self.case['id']
        STARTED_CHAINS.append(other.case)
        return other

    def finish(self):
        CHAINS.append(self.case)
        return self


def required_offer(chain, expected=None):
    proposal = chain.propose()
    if not proposal or not proposal.get('actions'):
        raise AssertionError('Synthetic chain needs a source proposal: ' + chain.case['id'])
    if expected is not None and proposal.get('field_plan', {}).get('experiment') != expected:
        raise AssertionError('Original calibration phase differs: ' + chain.case['id'])
    chain.call('bind', proposal=proposal)
    return chain.last_bound_proposal


def calibration(identity, *, indicator=True, shift=(0, 0), colors=None):
    chain = Chain(identity, shift, colors)
    # This first non-addressed command is a valid public input. Its unchanged
    # return exposes ACTION6, so the complete prefix can also be used by an
    # ordinary common caller without omitting or forcing an unavailable action.
    chain.obs = observation(chain.rows, identity, chain.revision, available=['ACTION1'])
    chain.propose()
    chain.transition(chain.rows, {'action_ref': 'ACTION1'})
    second = field_scene((5, 8), shift=shift, colors=colors)
    frames = None
    if indicator:
        transient = copy.deepcopy(second)
        point = chain.point(6, 9)
        rim(transient, point['x'] - 4, point['y'] - 4, 9, (colors or {}).get(7, 7))
        frames = [transient, copy.deepcopy(second)]
    chain.transition(second, {'action_ref': 'ACTION6', 'data': chain.point(6, 9)}, frames=frames)
    contrast = required_offer(chain, 'different_offset')
    chain.transition(field_scene((5, 4), shift=shift, colors=colors), contrast['actions'][0],
                     proposal=contrast, index=0, sparse_guards=True)
    if indicator:
        outside = required_offer(chain, 'outside_indicator')
        chain.transition(chain.rows, outside['actions'][0], proposal=outside, index=0)
        edge = required_offer(chain, 'indicator_edge')
        chain.transition(field_scene((9, 4), shift=shift, colors=colors), edge['actions'][0], proposal=edge, index=0)
    if chain.owner.calibration != 'navigation':
        raise AssertionError('Original did not reach navigation from acquired responses')
    return chain


def enter_stock(chain, *, bodies=None, order=(2, 4, 8)):
    proposal = required_offer(chain, 'navigation')
    # A public official boundary is authoritative; no unexecuted predicted
    # positions are counted as observations in the next level.
    second = stock_scene(bodies, shift=chain.shift, colors=chain.colors, order=order)
    chain.transition(second, proposal['actions'][0], proposal=proposal, index=0,
                     epoch=chain.epoch + 1, completed=chain.completed + 1)
    chain.obligations()
    if chain.owner.stock is None:
        raise AssertionError('Original did not create the next-epoch stock from its acquired prior')
    return chain


def synthetic_stock_return(bodies, command):
    """Declared public fixture world, depending only on bodies and command.

    This is not an agent prediction or a game engine. The body list is fixture
    raster data. No proposal, owner, expected_after, template or source state is
    consulted: the same public frame and point always receive the same return.
    Influence is a square-support distance <= 4**2; one selected square moves to
    its declared anchor, two equal types produce a one-pixel next type. The
    production engine never receives these fixture-only rules.
    """
    if command.get('action_ref') != 'ACTION6' or set(command.get('data', {})) != {'x', 'y'}:
        return list(bodies), 'unchanged'
    x, y = command['data']['x'], command['data']['y']
    affected = []
    for index, (_, left, top, side) in enumerate(bodies):
        dx, dy = max(left - x, 0, x - (left + side - 1)), max(top - y, 0, y - (top + side - 1))
        if dx * dx + dy * dy <= 16:
            affected.append(index)
    if len(affected) == 1:
        color, _, _, side = bodies[affected[0]]
        offset = 1 if side == 2 else 0
        product, effect = (color, x - offset, y - offset, side), 'relocated'
    elif len(affected) == 2 and bodies[affected[0]][0] == bodies[affected[1]][0] and bodies[affected[0]][0] in (2, 4):
        color = {2: 4, 4: 8}[bodies[affected[0]][0]]
        product, effect = (color, x, y, 1), 'rewritten'
    else:
        return list(bodies), 'unchanged'
    _, left, top, side = product
    if not (0 <= left <= 36 - side and 0 <= top <= 30 - side):
        return list(bodies), 'unchanged'
    result = [body for index, body in enumerate(bodies) if index not in affected] + [product]
    return result, effect


def selected_stock_chain(calibrated):
    chain = enter_stock(calibrated.fork('cold-stock-source-selected'))
    chain.case['qualification'] += (' After the official boundary every executed command comes from the current original proposal; '
                                    'the declared public return depends only on the current fixture bodies and command, never on owner identity or prediction.')
    bodies, used, rewrites, relocations = list(DEFAULT_STOCK_BODIES), 0, 0, 0
    public_returns = []
    while used < 48:
        proposal = chain.propose(48 - used)
        if not proposal or not proposal.get('actions'):
            break
        chain.call('bind', proposal=proposal)
        proposal = chain.last_bound_proposal
        for index, command in enumerate(proposal['actions']):
            next_bodies, effect = synthetic_stock_return(bodies, command)
            second = stock_scene(next_bodies)
            operation = len(chain.case['operations'])
            result = chain.transition(second, command, proposal=proposal, index=index, sparse_guards=True)
            before_guard, after_guard = chain.case['operations'][operation:operation + 2]
            if before_guard.get('result', {}).get('admitted') is not True:
                raise AssertionError('Original selected-stock guard refused its actual public prefix')
            if result is None:
                raise AssertionError('Original selected-stock acquisition raised an exception')
            kinds = [event.get('kind') for event in result.get('events', [])]
            rewrites += kinds.count('observed_joint_material_rewrite')
            relocations += kinds.count('typed_material_relocated_to_address')
            public_returns.append({'recordOperation': operation + 2, 'command': plain(command), 'declaredEffect': effect})
            bodies, used = next_bodies, used + 1
            chain.obligations()
            if after_guard.get('result', {}).get('seal_prefix') is not False or used == 48:
                break
    if rewrites < 2 or relocations < 1:
        raise AssertionError('Cold selected-stock fixture must acquire two rewrites and a relocation within its fixed action bound')
    chain.case['publicResponseQualification'] = {
        'schema': 'logos-engine.synthetic-addressed-stock-responses.v1',
        'sourceSelectedCommands': used, 'actionBound': 48, 'observedRewrites': rewrites,
        'observedRelocations': relocations, 'rowsAreDeclaredFixtureData': True,
        'consultedOwnerOrPredictionForReturns': False, 'returns': public_returns,
    }
    chain.finish()


def helper(identity, method, given, invoke):
    row = {'id': identity, 'method': method, 'input': plain(given)}
    try:
        row['result'] = plain(invoke())
    except Exception as error:
        row['exception'] = {'type': type(error).__name__, 'message': str(error)}
    HELPERS.append(row)


def generate():
    base = calibration('field-calibrated-positive')
    offer = required_offer(base, 'navigation')
    for index, step in enumerate(offer['steps']):
        point = step['action']['data']
        second = field_scene((point['x'] - 1, point['y'] - 1))
        base.transition(second, step['action'], proposal=offer, index=index)
    base.propose(0)
    base.finish()

    no_indicator = calibration('field-without-transient-indicator', indicator=False)
    no_indicator.propose()
    no_indicator.transition(stock_scene(), {'action_ref': 'ACTION6', 'data': {'x': 18, 'y': 5}}, epoch=2, completed=1)
    no_indicator.obligations()
    no_indicator.propose()
    no_indicator.finish()

    calibrated = calibration('field-guard-source-prefix')
    guards = calibrated.fork('field-guards-full-and-protocol-observations')
    proposal = required_offer(guards, 'navigation')
    original_public = public(guards.rows, guards.obs)
    guards.call('before', proposal=proposal, index=0, public=original_public, observation=guards.obs)
    guards.call('before', proposal=proposal, index=0, public=original_public, observation=protocol(guards.obs))
    for label in ('observation_ref', 'epoch', 'score', 'available', 'exemplar', 'shadow', 'body'):
        changed_public, changed_obs = copy.deepcopy(original_public), copy.deepcopy(guards.obs)
        if label == 'observation_ref': changed_obs['observation_ref'] += ':stale'
        elif label == 'epoch': changed_public['level'] += 1
        elif label == 'score': changed_public['levels_completed'] += 1
        elif label == 'available': changed_public['available_action_refs'] = []
        else:
            x, y = {'exemplar': (2, 2), 'shadow': (17, 4), 'body': (9, 4)}[label]
            changed_public['frame_rows'][y][x] = 0
        guards.call('before', proposal=proposal, index=0, public=changed_public, observation=changed_obs)
    stale = observation(field_scene((10, 4)), guards.identity, guards.revision + 1)
    guards.call('propose', observation=stale, rows=field_scene((10, 4)), inputs=[], remaining=16)
    guards.finish()

    for identity, point, position in [('field-counterexample-misaligned', (12, 5), (12, 4)),
                                      ('field-counterexample-stationary-inside-known-bound', (10, 5), (9, 4))]:
        branch = calibrated.fork(identity)
        branch.transition(field_scene(position), {'action_ref': 'ACTION6', 'data': {'x': point[0], 'y': point[1]}})
        branch.propose()
        branch.finish()

    unaddressed = calibrated.fork('field-strict-address-payload')
    for command in [{'action_ref': 'ACTION6'}, {'action_ref': 'ACTION6', 'data': {'x': 14, 'y': 5, 'extra': 1}},
                    {'action_ref': 'ACTION1', 'data': {'x': 14, 'y': 5}}]:
        unaddressed.transition(unaddressed.rows, command)
    unaddressed.propose()
    unaddressed.finish()

    for identity, options in [('field-ambiguous-residual', {'extra_mobile': (2, 14)}),
                              ('field-two-goal-candidates', {'second_goal': True}),
                              ('field-no-stationary-exemplar', {'exemplar': False})]:
        chain = Chain(identity)
        chain.rows = field_scene(**options)
        chain.obs = observation(chain.rows, identity, 1)
        after_options = dict(options)
        if 'extra_mobile' in after_options: after_options['extra_mobile'] = (5, 14)
        chain.transition(field_scene((5, 8), **after_options), {'action_ref': 'ACTION6', 'data': {'x': 6, 'y': 9}})
        chain.propose()
        chain.finish()

    translated = calibration('field-translated-and-palette-permuted', shift=(2, 3),
                              colors={0: 1, 2: 9, 4: 3, 5: 10, 6: 12, 7: 11, 8: 2})
    translated.propose()
    enter_stock(translated)
    translated.propose()
    translated.finish()

    stock = enter_stock(calibrated.fork('stock-cold-boundary-base'))
    stock.propose()
    stock_bodies = stock.call('stock.bodies', rows=stock.rows)
    stock.call('stock.allocations', bodies=stock_bodies)
    stock.finish()
    selected_stock_chain(calibrated)
    bodies0 = list(DEFAULT_STOCK_BODIES)
    learned = stock.fork('stock-independent-rewrite-witnesses')
    bodies1 = bodies0[2:] + [(4, 6, 11, 1)]
    learned.transition(stock_scene(bodies1), {'action_ref': 'ACTION6', 'data': {'x': 6, 'y': 11}})
    learned.obligations()
    bodies2 = bodies0[4:] + [(4, 6, 11, 1), (4, 6, 21, 1)]
    learned.transition(stock_scene(bodies2), {'action_ref': 'ACTION6', 'data': {'x': 6, 'y': 21}})
    learned.obligations()
    learned.propose()
    learned.call('stock.retained', boundary='synthetic:addressed:retained-hypotheses:next-boundary')
    learned.finish()

    contradiction = learned.fork('stock-confirmed-rewrite-counterexample')
    bodies3 = [(4, 6, 11, 1), (4, 6, 21, 1), (8, 24, 11, 1)]
    contradiction.transition(stock_scene(bodies3), {'action_ref': 'ACTION6', 'data': {'x': 24, 'y': 11}})
    contradiction.propose()
    contradiction.finish()

    move = learned.fork('stock-selected-relocation-and-guarded-continuation')
    offer = required_offer(move)
    step = offer['steps'][0]
    if step['offer']['kind'] != 'move':
        raise AssertionError('Expected source to prepare a requested product relocation')
    selected = step['offer']['selected'][0]
    old = step['before_bodies'][selected]
    point = step['action']['data']
    moved = []
    for index, body in enumerate(step['before_bodies']):
        x, y = body['bbox'][:2]
        if index == selected:
            x, y = point['x'] - body['offset'][0], point['y'] - body['offset'][1]
        moved.append((body['palette'], x, y, body['bbox'][2] - body['bbox'][0] + 1))
    move.transition(stock_scene(moved), step['action'], proposal=offer, index=0, sparse_guards=True)
    move.obligations()
    continuation = move.propose()
    if continuation and continuation.get('actions'):
        move.call('before', proposal=continuation, index=0, public=public(move.rows, move.obs), observation=move.obs)
    move.finish()

    preservation = learned.fork('stock-unselected-preservation-refuted')
    offer = required_offer(preservation)
    step = offer['steps'][0]
    selected = set(step['offer']['selected'])
    removed = next(index for index in range(len(step['before_bodies'])) if index not in selected)
    altered = [(body['palette'], body['bbox'][0], body['bbox'][1], body['bbox'][2] - body['bbox'][0] + 1)
               for index, body in enumerate(step['before_bodies']) if index != removed]
    preservation.transition(stock_scene(altered), step['action'], proposal=offer, index=0)
    preservation.propose()
    preservation.finish()

    no_effect = stock.fork('stock-exact-fusion-no-effect')
    offer = required_offer(no_effect)
    if offer['steps'][0]['offer']['kind'] != 'fuse':
        raise AssertionError('Synthetic stock does not expose its intended direct fusion experiment')
    no_effect.transition(no_effect.rows, offer['actions'][0], proposal=offer, index=0)
    no_effect.propose()
    no_effect.finish()

    for identity, order in [('stock-recalled-rule-requires-fresh-witness', (2, 4, 8)),
                             ('stock-type-order-change-drops-recalled-rules', (8, 4, 2))]:
        recalled = learned.fork(identity)
        recalled.transition(stock_scene(order=order), {'action_ref': 'ACTION6', 'data': {'x': 24, 'y': 11}}, epoch=3, completed=2)
        recalled.obligations()
        recalled.propose()
        if order == (2, 4, 8):
            changed = bodies0[2:] + [(8, 6, 11, 1)]
            recalled.transition(stock_scene(changed), {'action_ref': 'ACTION6', 'data': {'x': 6, 'y': 11}})
            recalled.propose()
        recalled.finish()

    image = field_scene()
    obs = observation(image, 'helpers', 1)
    mobile = next(entity for entity in obs['entities'] if list(entity['bbox']) == [2, 8, 3, 9])
    helper('center-half-integral', 'center', {'box': [2, 8, 3, 9]}, lambda: FIELD.center([2, 8, 3, 9]))
    helper('support-exact-mask', 'support', {'entity': mobile}, lambda: FIELD.support(mobile))
    helper('distance-minimum-support', 'distance_squared', {'point': [6, 9], 'pixels': sorted(FIELD.support(mobile))},
           lambda: FIELD.distance_squared((6, 9), FIELD.support(mobile)))
    helper('target-centered-homologue', 'target_candidates', {'observation': obs, 'mobile': mobile, 'rows': image},
           lambda: FIELD.target_candidates(obs, mobile, image))
    helper('full-observation-from-protocol', 'full_observation', {'observation': protocol(obs), 'rows': image},
           lambda: LinkedPreparation.full_observation(protocol(obs), image))
    helper('full-observation-already-measured', 'full_observation', {'observation': obs, 'rows': image},
           lambda: LinkedPreparation.full_observation(obs, image))
    transient = copy.deepcopy(image)
    rim(transient, 2, 5, 9, 7)
    for identity, frames, point in [('indicator-contracting', [transient, image], (6, 9)),
                                    ('indicator-persistent-not-transient', [transient, transient], (6, 9)),
                                    ('indicator-wrong-center', [transient, image], (7, 9)),
                                    ('indicator-no-frames', [], (6, 9))]:
        helper(identity, 'transient_contour', {'first': image, 'frames': frames, 'point': point},
               lambda frames=frames, point=point: FIELD.transient_contour(image, frames, point))
    for identity, prior, scene in [('stock-no-prior-envelope', {}, stock_scene()),
                                   ('stock-no-rejected-distance', no_indicator.owner.prior, stock_scene()),
                                   ('stock-no-enclosure', stock.owner.prior, stock_scene(zones=False)),
                                   ('stock-valid-prior-rebind', stock.owner.prior, stock_scene())]:
        measured = observation(scene, identity, 1, 2, 1)
        helper(identity, 'stock_create', {'prior': prior, 'observation': measured, 'rows': scene},
               lambda prior=prior, measured=measured, scene=scene: stock_state(FieldStock.create(copy.deepcopy(prior), measured, scene)))


JOURNAL_SCHEMA = 'logos-engine.addressed-material-public-operations.v1'
JOURNAL_METHODS = {
    'propose': ('propose', {'observation', 'rows', 'inputs', 'remaining'}, set()),
    'bind': ('bind', set(), set()),
    'before': ('before', {'index', 'public', 'observation'}, set()),
    'after': ('after', {'index', 'before', 'after', 'first', 'second'}, set()),
    'record': ('record', {'before', 'after', 'command', 'first', 'second'}, {'index', 'frames'}),
    'recordSource': ('record', {'before', 'after', 'command', 'first', 'second'}, {'index', 'frames'}),
    'preservation_obligations': ('preservation_obligations', {'observation', 'rows'}, set()),
    'preservationObligations': ('preservation_obligations', {'observation', 'rows'}, set()),
}


def replay_journal(path):
    """Evaluate actual public calls with a cold, independent original owner.

    `native` may preserve observations of the implementation under review. It is
    never read to derive a Python result, proposal or state. In particular, no
    captured native proposal may be passed back into the original: the latest
    proposal is computed by the original itself from the preceding public calls.
    """
    data = json.loads(path.read_bytes())
    if data.get('schema') != JOURNAL_SCHEMA or not isinstance(data.get('operations'), list):
        raise ValueError('Invalid public-operation journal schema')
    if any(key in data for key in ('setup', 'initialState', 'expected', 'restore', 'sourceState')):
        raise ValueError('An original public journal must begin cold, without injected state or expectations')
    identity = data.get('id') or (str(data['chainId']) + ':' + str(data.get('mode', 'public-replay')) if 'chainId' in data else path.stem)
    if not isinstance(identity, str) or not identity:
        raise ValueError('A public journal requires a nonempty identity')
    chain = Chain(identity)
    chain.case['qualification'] = ('Cold original replay of captured public method inputs. Native results are ignored when deriving '
                                   'every original result and state; selected calls use only the latest locally computed source proposal.')
    chain.case['inputJournal'] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes()),
                                'nativeResultsConsulted': False}
    latest, proposed = None, False
    for index, operation in enumerate(data['operations']):
        if not isinstance(operation, dict) or set(operation) - {'method', 'input', 'useLatestSourceProposal', 'native'}:
            raise ValueError(f'Unrecognized public journal operation fields at {index}')
        captured = operation.get('method')
        if captured not in JOURNAL_METHODS:
            raise ValueError(f'Unrecognized original public method at {index}: {captured}')
        method, required, optional = JOURNAL_METHODS[captured]
        inputs = operation.get('input')
        if not isinstance(inputs, dict) or not required <= set(inputs) or set(inputs) - required - optional:
            raise ValueError(f'Invalid public inputs for {captured} at {index}; proposals and state cannot be injected')
        selected = operation.get('useLatestSourceProposal', False)
        if not isinstance(selected, bool):
            raise ValueError(f'Proposal selection flag must be boolean at {index}')
        if selected and (method not in ('bind', 'before', 'after', 'record') or not proposed):
            raise ValueError(f'No prior source proposal may be used for {captured} at {index}')
        if method in ('bind', 'before', 'after') and not selected:
            raise ValueError(f'{captured} requires the locally computed source proposal at {index}')
        given = copy.deepcopy(inputs)
        if selected:
            given['proposal'] = copy.deepcopy(latest)
        elif method == 'record':
            given['proposal'] = None
        result = chain.call(method, **given)
        row = chain.case['operations'][-1]
        row['journalOperation'] = index
        row['capturedMethod'] = captured
        row['useLatestSourceProposal'] = selected
        if method == 'propose':
            latest, proposed = copy.deepcopy(result), True
        elif method == 'bind' and 'exception' not in row:
            latest = copy.deepcopy(chain.last_bound_proposal)
    chain.finish()
    return chain.case['inputJournal']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, default=ROOT / 'tests/fixtures/v6-addressed-material-reference.json.gz')
    parser.add_argument('--receipt', type=Path, default=ROOT / 'docs/migration/lot5b-evidence/diagnostic/source-oracle-export.json')
    parser.add_argument('--journal', type=Path, action='append', default=[],
                        help='Replay a captured public-operation journal instead of generating the declared synthetic fixture (repeatable).')
    args = parser.parse_args()
    fixture, receipt_path = args.fixture.resolve(), args.receipt.resolve()
    if fixture.exists() or receipt_path.exists():
        raise ValueError('Retain existing oracle outputs and choose new explicit paths before another export')
    if not fixture.is_relative_to(ROOT) or not receipt_path.is_relative_to(ROOT):
        raise ValueError('Oracle outputs must remain inside this checkout')
    journals = [path.resolve() for path in args.journal]
    if any(not path.is_relative_to(ROOT / 'docs/migration/lot5b-evidence') or not path.is_file() for path in journals):
        raise ValueError('Public journals must be preserved inside docs/migration/lot5b-evidence')
    if len(set(journals)) != len(journals):
        raise ValueError('A public input journal must not be replayed twice in the same export')
    manifest_path = SOURCE.parent / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())['files']
    before = verify_sources(manifest)
    sys.path[:0] = [str(SOURCE), str(PROTO)]
    modules = {name: importlib.import_module(name) for name in DIRECT_MODULES}
    global AddressedMaterial, FIELD, FieldStock, LinkedPreparation, ObservedInputDomain
    AddressedMaterial = modules['common_addressed_material'].AddressedMaterial
    FIELD = modules['common_addressed_field']
    FieldStock = modules['common_field_stock'].FieldStock
    LinkedPreparation = modules['common_linked_preparation'].LinkedPreparation
    ObservedInputDomain = importlib.import_module('observed_input_domain').ObservedInputDomain
    try:
        input_journals = [replay_journal(path) for path in journals] if journals else []
        if not journals:
            generate()
    except Exception as error:
        failed_after = verify_sources(manifest)
        failure = {'schema': 'logos-engine.independent-python-oracle-failure.v1', 'status': 'failed',
                   'recordedAt': datetime.now(timezone.utc).isoformat(), 'referenceCommit': COMMIT,
                   'sourceFilesVerifiedBefore': len(before), 'sourceFilesVerifiedAfter': len(failed_after),
                   'sourceInventoryUnchanged': before == failed_after,
                   'failure': {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()},
                   'exporterSha256': sha(Path(__file__).read_bytes()), 'helpers': HELPERS, 'chains': STARTED_CHAINS}
        receipt_path.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(1, 10000):
            failure_path = receipt_path.with_name(receipt_path.stem + f'-failure-{attempt:03d}.json.gz')
            try:
                with failure_path.open('xb') as stream:
                    stream.write(gzip.compress(json.dumps(failure, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
                break
            except FileExistsError:
                continue
        else:
            raise RuntimeError('No exclusive failure evidence path remains') from error
        print(json.dumps({'status': 'failed', 'failureEvidence': failure_path.relative_to(ROOT).as_posix()}))
        raise
    after = verify_sources(manifest)
    if before != after:
        raise AssertionError('Original source inventory changed during export')
    exceptions = [{'group': 'chain', 'case': case['id'], 'operation': index, 'method': row['method'], **row['exception']}
                  for case in CHAINS for index, row in enumerate(case['operations']) if 'exception' in row]
    exceptions += [{'group': 'helper', 'case': row['id'], 'method': row['method'], **row['exception']}
                   for row in HELPERS if 'exception' in row]
    qualifications = [
        'All rasters and returned transitions are synthetic public observations, not game solutions or live success.',
        'Every owner chain begins cold; forked branches include their entire acquired prefix in the exported operations.',
        'Method inputs/results use JSON transport key semantics; sourceState separately preserves non-string-key mappings as ordered entries.',
        'Source current_observation absence is preserved until the wrapper actually creates the attribute.',
        'Native repeated restoration is an extension contract; Python does not define a checkpoint API here.',
        'Original exceptions and state after exceptions remain explicit; no TypeScript expectation supplies an original output.',
        'Component helpers are separate from common-caller selection and independent game contribution.',
        'Journal mode ignores all captured native results and never imports a native proposal as the original proposal.',
    ]
    data = {'schema': 'logos-engine.v6.addressed-material-reference.v1', 'referenceCommit': COMMIT,
            'sourceModules': list(DIRECT_MODULES), 'helpers': HELPERS, 'chains': CHAINS,
            'exceptions': exceptions, 'qualifications': qualifications,
            'mode': 'captured-public-journals' if journals else 'declared-synthetic-public-returns',
            'inputJournals': input_journals}
    encoded = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
    fixture.parent.mkdir(parents=True, exist_ok=True)
    with fixture.open('xb') as stream:
        stream.write(gzip.compress(encoded, compresslevel=9, mtime=0))
    imports = {}
    for name, module in sorted(sys.modules.items()):
        filename = getattr(module, '__file__', None)
        if filename:
            path = Path(filename).resolve()
            if path.is_relative_to(SOURCE):
                imports[name] = {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes())}
    receipt = {'schema': 'logos-engine.independent-python-oracle-export.v1', 'status': 'passed',
               'recordedAt': datetime.now(timezone.utc).isoformat(), 'referenceCommit': COMMIT,
               'sourceFilesVerifiedBefore': len(before), 'sourceFilesVerifiedAfter': len(after),
               'sourceInventoryUnchanged': True, 'directModules': list(DIRECT_MODULES), 'importedOriginalModules': imports,
               'sourceManifest': {'path': manifest_path.relative_to(ROOT).as_posix(), 'sha256': sha(manifest_path.read_bytes())},
               'sourceInventorySha256Before': sha(json.dumps(before, sort_keys=True, separators=(',', ':')).encode()),
               'sourceInventorySha256After': sha(json.dumps(after, sort_keys=True, separators=(',', ':')).encode()),
               'directSourceBeforeAfter': {name: {'path': (PROTO / (name + '.py')).relative_to(ROOT).as_posix(),
                   'sha256Before': before[(PROTO / (name + '.py')).relative_to(SOURCE).as_posix()],
                   'sha256After': after[(PROTO / (name + '.py')).relative_to(SOURCE).as_posix()]} for name in DIRECT_MODULES},
               'fixture': {'path': fixture.relative_to(ROOT).as_posix(), 'bytes': fixture.stat().st_size,
                           'sha256': sha(fixture.read_bytes()), 'uncompressedBytes': len(encoded)},
               'exporter': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'bytes': Path(__file__).stat().st_size,
                            'sha256': sha(Path(__file__).read_bytes())},
               'counts': {'helpers': len(HELPERS), 'coldChains': len(CHAINS),
                          'chainOperations': sum(len(case['operations']) for case in CHAINS), 'sourceExceptions': len(exceptions)},
               'qualifications': qualifications}
    receipt['mode'] = data['mode']
    receipt['inputJournals'] = input_journals
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    with receipt_path.open('x') as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'status': 'passed', 'counts': receipt['counts'], 'fixture': receipt['fixture']}))


if __name__ == '__main__':
    main()
