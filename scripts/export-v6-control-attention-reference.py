#!/usr/bin/env python3
"""Unmodified V6 StrategyRouter.choose at explicit dependency boundaries.

This is a strategy-consumer unit reference, not a measurement or game oracle.
All observations are synthetic public rasters. Non-target families decline;
the morphology boundary supplies a current decision and the frontier boundary
records proposed questions. The original choose closures, SRC order, attention,
information election, recalled directions and contextual translation execute
unchanged. No Python AST extraction, branch patch or gameplay import is used.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'


def hashed(data):
    return hashlib.sha256(data).hexdigest()


def verify_source():
    hashes = {}
    for path, item in json.loads(MANIFEST.read_text())['files'].items():
        actual = hashed((SOURCE / path).read_bytes())
        assert actual == item['sha256'], path
        hashes[path] = actual
    return hashes


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE / 'agents/yf_arc3_v6/laya_proto'), str(SOURCE)]
from terminal_composition import Snapshot, GoalAccessMemory
from neutral_observer import measure
from attention_memory import AttentionMemory
from agents.yf_arc3_v6.morphology_policy.strategy import StrategyRouter

SCENES = {}
SNAPSHOTS = {}
CASES = []
EXECUTED = Counter()
ROUTER = None


def plain(value):
    if hasattr(value, '__dataclass_fields__'):
        return {key: plain(getattr(value, key)) for key in value.__dataclass_fields__}
    if isinstance(value, dict):
        return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    return value


def profile(frame, event, _argument):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


def scene(name, position, *, epoch=1, anchors=True, walls=(), score=0, peer=None):
    rows = [[0] * 14 for _ in range(10)]
    if anchors:
        for x, y, color in ((1, 1, 5), (12, 1, 6), (1, 8, 7)):
            rows[y][x] = color
    for x, y in walls:
        rows[y][x] = 1
    rows[position[1]][position[0]] = 9
    if peer is not None:
        rows[peer[1]][peer[0]] = 10
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=score,
        frame_hash=hashed(json.dumps(rows).encode())[:16],
        available_action_refs=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6'], state='NOT_FINISHED')
    obs, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-control-attention')
    SCENES[name] = {'observation': obs, 'rows': rows}
    SNAPSHOTS[name] = Snapshot.from_public(obs, rows)
    return name


def observation(name):
    return SCENES[name]['observation']


def mover(name):
    return next(e['signature'] for e in observation(name)['entities'] if e['palette_value'] == 9)


def decision(name, **changes):
    return dict(status='retained', reason='control_not_currently_attested', route_key=None,
        composition='alignment_of_homologous_patterns', target_extension=None,
        measured_facts=dict(pair_ref='synthetic:pair', observation_ref=observation(name)['observation_ref'],
            level_epoch=observation(name)['level_epoch'], framed_pair=True, homologous=True,
            asymmetric=True, alignment_refuted=False), **changes)


def offer(name, command, *, return_steps=None, data=None):
    action = {'action_ref': command}
    if data is not None:
        action['data'] = data
    obs = observation(name)
    return dict(source='coupled_displays', action=action, predictions={'changed': True, 'stable': False},
        relations=[['synthetic:display', 'state', 'change']], evidence=[obs['observation_ref']],
        risks=[], return_steps=return_steps, question='Synthetic public contrast',
        observation_ref=obs['observation_ref'], level_epoch=obs['level_epoch'])


class DecliningFamily:
    """Explicit out-of-scope dependency: every proposal is absent."""
    pending = recipe = source81_plan = prepared_source81 = last_layout = None

    def __init__(self):
        self.memory = self
        self.acquired_compositions = defaultdict(lambda: self)

    def __getattr__(self, _name):
        return lambda *args, **kwargs: None


class GoalBoundary(DecliningFamily):
    def __init__(self, history, prior=None):
        super().__init__()
        self.memory = GoalAccessMemory()
        self.memory.episode = [(SNAPSHOTS[a], command, SNAPSHOTS[b]) for a, command, b in history]
        self.prior = prior

    def propose(self, *args):
        return deepcopy(self.prior) if self.prior is not None else {'status': 'unknown', 'reason': 'contract_goal_declined'}

    def propose_effect(self, *args):
        return {'status': 'unknown'}


class MorphologyBoundary:
    def __init__(self, current, proposal=None):
        self.current = current
        self.result = proposal
        self.last = {'status': 'retained', 'reason': 'stale_fixture_must_be_reset'}
        self.meter = SimpleNamespace(forecast=lambda: None)
        self.collection = None
        self.resets_observed = []

    def propose(self, *args):
        self.resets_observed.append(self.last is None)
        self.last = deepcopy(self.current)
        return deepcopy(self.result)


class OfferBoundary:
    def __init__(self, offers):
        self.values = offers

    def offers(self, *args):
        return deepcopy(self.values)

    def offer(self, *args):
        return None


class FrontierBoundary:
    def __init__(self, config):
        self.config = config
        self.calls = []

    def bind_current_candidate_context(self, obs, registry):
        self.calls.append(dict(kind='bind', observation_ref=obs['observation_ref'], registry=deepcopy(registry)))

    def can_probe_here(self, obs, command):
        result = command['action_ref'] not in self.config.get('unprobeable', [])
        self.calls.append(dict(kind='can_probe_here', observation_ref=obs['observation_ref'], command=deepcopy(command), result=result))
        return result

    def propose(self, obs, inputs, **options):
        projected = deepcopy(options)
        if 'return_episode' in projected:
            projected['return_episode'] = [[a.ref, command, b.ref] for a, command, b in options['return_episode']]
        self.calls.append(dict(kind='propose', observation_ref=obs['observation_ref'], inputs=deepcopy(inputs), options=plain(projected)))
        if 'return_episode' in options:
            return None
        if options.get('control_acquisition'):
            value = options['control_acquisition']
            if value['action_ref'] in self.config.get('decline_control', []):
                return None
            return dict(status='proposed', actions=[{'action_ref': value['action_ref']}],
                question={'control_acquisition': deepcopy(value)}, contract_boundary='frontier')
        if options.get('curiosity'):
            value = options['curiosity']
            if value['action']['action_ref'] in self.config.get('decline_curiosity', []):
                return None
            return dict(status='proposed', actions=[deepcopy(value['action'])],
                question={'curiosity': deepcopy(value)}, contract_boundary='frontier')
        return dict(status='unknown_contract_frontier', actions=[], contract_boundary='frontier')


FAMILY_FIELDS = ('windows lines orbits containment surface codes bands slots words ports constellations '
    'preparations fields supports reduction branches motifs symmetry feedback visual_sequences arrangements '
    'facets network cargo object_binding workshop symbols inventory outline_service framed_transfer recolor '
    'chart regions channels endpoints temporal_selection axial settlement selected_rigid window_question '
    'preview_packing recruitment reactive reaction').split()


def capture(name, current, history=(), *, inputs=None, current_decision=None, offers=(),
            attention_setup=(), target_method=None, frontier=None, repeat=1, prior=None,
            morphology_proposal=None):
    obs = observation(current)
    args = dict(current=current, history=deepcopy(history),
        inputs=deepcopy(inputs if inputs is not None else [{'action_ref': 'ACTION1'}, {'action_ref': 'ACTION2'}]),
        decision=deepcopy(current_decision if current_decision is not None else decision(current)),
        offers=deepcopy(offers), attention_setup=deepcopy(attention_setup), target_method=deepcopy(target_method),
        frontier=deepcopy(frontier or {}), repeat=repeat, remaining=20,
        prior=deepcopy(prior), morphology_proposal=deepcopy(morphology_proposal))
    # The heavy catalogues are immutable dependencies and are immediately
    # replaced by declining boundaries. Reuse the source router/program while
    # resetting every mutable dependency used by the tested closures.
    global ROUTER
    if ROUTER is None:
        previous = sys.getprofile()
        sys.setprofile(None)
        ROUTER = StrategyRouter()
        sys.setprofile(previous)
    router = ROUTER
    router.attention = AttentionMemory()
    for field in FAMILY_FIELDS:
        setattr(router, field, DecliningFamily())
    router.morph = MorphologyBoundary(args['decision'], morphology_proposal)
    router.displays = OfferBoundary(offers)
    router.target_method = deepcopy(target_method)
    goal = GoalBoundary(history, prior)
    points = OfferBoundary([])
    controls = OfferBoundary([])
    transport = FrontierBoundary(args['frontier'])
    setup_results = []
    for operation in attention_setup:
        actual = deepcopy(operation['args'])
        if operation.get('expected_motion_order'):
            # JSON object-key order is not our transport of this input. The
            # explicit list preserves the source caller's traversal contract.
            motion = actual[0]['expected_motion']
            actual[0]['expected_motion'] = {key: motion[key] for key in operation['expected_motion_order']}
        if operation.get('focus'):
            actual[-1] = router.attention.item['id']
        value = getattr(router.attention, operation['method'])(*actual)
        setup_results.append(plain(value))
    initial_attention = plain({'item': router.attention.item, 'composition': router.attention.composition})
    steps = []
    for _ in range(repeat):
        transport.calls = []
        result, selected_goal, reason = router.choose(goal, transport, points, controls, obs,
            SCENES[current]['rows'], args['inputs'], [], args['remaining'], None)
        receipt = result.pop('strategy_receipt')
        morphology = result.pop('morphology')
        steps.append(dict(proposal=plain(result), selected=receipt['selected'], visited=receipt['visited'],
            deferred_curiosity=receipt['deferred_curiosity'], morphology=morphology,
            attention_return=receipt.get('attention_return'), attention=plain({'item': router.attention.item, 'composition': router.attention.composition}),
            frontier_calls=plain(transport.calls), goal_reason=reason, selected_goal=selected_goal,
            morphology_reset_observed=deepcopy(router.morph.resets_observed)))
    CASES.append(dict(id=name, args=plain(args), setup_results=setup_results,
        initial_attention=initial_attention, expected=plain(steps)))
    return CASES[-1]


def question(current, action='ACTION2', *, experiment='replicate_translation', pair='synthetic:pair', delta=(1, 0)):
    return dict(observation_ref=observation(current)['observation_ref'], pair_ref=pair, action_ref=action,
        experiment=experiment, objective='Identify a controllable participant for this composition through a changed-origin replication or an unused public input.',
        expected_motion={mover(current): list(delta)}, evidence=['synthetic:earlier', observation(current)['observation_ref']])


def populate():
    start = scene('start', (3, 3))
    moved = scene('moved', (4, 3))
    current = scene('current', (5, 3))
    original = scene('returned_original_origin', (3, 3))
    unregistered = scene('unregistered', (5, 3), anchors=False)
    historical_start = scene('historical_start', (3, 3), epoch=0)
    historical_end = scene('historical_end', (4, 3), epoch=0)
    history = [[start, 'ACTION2', moved]]
    capture('unused_lexical_control', current, inputs=[{'action_ref': 'ACTION2'}, {'action_ref': 'ACTION1'}])
    capture('point_input_excluded', current, inputs=[{'action_ref': 'ACTION1', 'data': {'x': 3, 'y': 3}}, {'action_ref': 'ACTION2'}])
    capture('empty_data_remains_plain_input', current, inputs=[{'action_ref': 'ACTION1', 'data': {}}, {'action_ref': 'ACTION2'}])
    capture('previous_epoch_does_not_count_as_current_trial', current, [[historical_start, 'ACTION1', historical_end]])
    bad = decision(current); bad['status'] = 'proposed'
    capture('non_retained_status_declines', current, current_decision=bad)
    bad = decision(current); bad['reason'] = 'no_unique_pair'
    capture('different_reason_declines', current, current_decision=bad)
    capture('replication_precedes_unused_command', current, history)
    capture('replication_requires_changed_origin', original, history)
    capture('replication_requires_registration_to_current', unregistered, history)
    capture('replication_requires_exactly_one_trial', current, history + history)
    capture('frontier_refusal_continues_to_unused', current, history, frontier={'decline_control': ['ACTION2']})
    capture('all_control_frontier_refusals_fall_through', current, history, frontier={'decline_control': ['ACTION1', 'ACTION2']})

    method = dict(source_scope=0, composition='alignment_of_homologous_patterns', role_refs=[mover(current)],
        motion_examples={'ACTION1': [1, 0], 'ACTION2': [0, 1], 'ACTION3': [-1, 0]}, scoring_observation='synthetic:score')
    axes = [[start, 'ACTION1', moved], [start, 'ACTION1', moved]]
    capture('recalled_unmeasured_axis_precedes_parallel', current, axes,
        inputs=[{'action_ref': x} for x in ['ACTION3', 'ACTION2', 'ACTION1']], target_method=method)
    same_epoch = deepcopy(method); same_epoch['source_scope'] = 1
    capture('same_epoch_method_is_not_recalled', current, axes,
        inputs=[{'action_ref': x} for x in ['ACTION3', 'ACTION2', 'ACTION1']], target_method=same_epoch)
    bad = decision(current); bad['measured_facts']['alignment_refuted'] = True
    capture('refuted_pair_does_not_recall_directions', current, axes, target_method=method, current_decision=bad)

    duplicate = history + [[start, 'ACTION3', moved]]
    focus = question(current, 'ACTION3')
    capture('pending_focus_changes_stable_control_priority', current, duplicate,
        inputs=[{'action_ref': x} for x in ['ACTION1', 'ACTION2', 'ACTION3']],
        attention_setup=[dict(method='open', args=[focus, observation(current)])])
    wrong = question(current, 'ACTION3', pair='other:pair')
    capture('different_pair_focus_does_not_reorder', current, duplicate,
        inputs=[{'action_ref': x} for x in ['ACTION1', 'ACTION2', 'ACTION3']],
        attention_setup=[dict(method='open', args=[wrong, observation(current)])])
    stale = question(moved, 'ACTION2')
    capture('prior_observation_focus_expires', current, history,
        attention_setup=[dict(method='open', args=[stale, observation(moved)])])

    unrelated = [offer(current, 'ACTION1')]
    capture('unused_parent_defers_unbound_other_question', current, inputs=[{'action_ref': 'ACTION2'}], offers=unrelated)
    capture('replication_defers_question_and_opens_attention', current, history, offers=unrelated)
    capture('same_action_information_tests_control', current, history, offers=[offer(current, 'ACTION2')])
    capture('same_action_information_shares_existing_attention', current, history, offers=[offer(current, 'ACTION2')],
        attention_setup=[dict(method='open', args=[question(current), observation(current)])])
    capture('same_reference_with_data_is_different_action', current, history, offers=[offer(current, 'ACTION2', data={})])
    capture('bound_return_allows_other_information', current, history, offers=[offer(current, 'ACTION1', return_steps=1)])
    capture('unprobeable_current_acquisition_does_not_bind_information', current, history, offers=unrelated,
        frontier={'unprobeable': ['ACTION1', 'ACTION2']})
    capture('refused_information_continues_then_protects_witness', current, history,
        offers=[offer(current, 'ACTION2'), offer(current, 'ACTION3')], frontier={'decline_curiosity': ['ACTION2']})
    capture('no_offers_does_not_inspect_control', current, history)

    success_before = scene('exposure_success_before', (3, 5), walls=((5, 5),))
    success_after = scene('exposure_success_after', (4, 5), walls=((5, 5),))
    blocked = scene('exposure_blocked', (4, 5), walls=((5, 5),))
    exposure_current = scene('exposure_current', (7, 5), walls=((5, 5),))
    exposure_history = [[success_before, 'ACTION2', success_after], [success_after, 'ACTION2', blocked]]
    capture('contextual_block_replication', exposure_current, exposure_history, inputs=[{'action_ref': 'ACTION2'}])
    capture('contextual_block_preserves_current_exposure', exposure_current, exposure_history,
        inputs=[{'action_ref': 'ACTION2'}], offers=[offer(exposure_current, 'ACTION1')])

    for outcome, position, anchors in [('matched', (6, 3), True), ('contradicted', (7, 3), True), ('unobserved', (6, 3), False)]:
        after = scene('return_' + outcome, position, anchors=anchors)
        setup = [dict(method='open', args=[question(current), observation(current)]),
            dict(method='observe', args=[observation(current), observation(after), {'action_ref': 'ACTION2'}, None], focus=True)]
        capture('parent_return_' + outcome, after, history + [[current, 'ACTION2', after]], attention_setup=setup, repeat=2)
        if outcome == 'matched':
            mismatch = decision(after); mismatch['measured_facts']['pair_ref'] = 'other:pair'
            capture('returned_pair_mismatch_falls_through', after, history + [[current, 'ACTION2', after]],
                current_decision=mismatch, attention_setup=setup)
            capture('return_for_previous_observation_expires', moved, history, attention_setup=setup)

    mixed_source = scene('mixed_return_source', (4, 3), peer=(8, 6))
    mixed_before = scene('mixed_return_before', (5, 3), peer=(9, 6))
    mixed_after = scene('mixed_return_after', (7, 3))
    missing = next(e['signature'] for e in observation(mixed_before)['entities'] if e['palette_value'] == 10)
    contrary = mover(mixed_before)
    mixed_history = [[mixed_source, 'ACTION2', mixed_before], [mixed_before, 'ACTION2', mixed_after]]
    for label, ordered in [('missing_first', [missing, contrary]), ('contradiction_first', [contrary, missing])]:
        focus = question(mixed_before)
        focus['expected_motion'] = {signature: [1, 0] for signature in ordered}
        setup = [dict(method='open', args=[focus, observation(mixed_before)], expected_motion_order=ordered),
            dict(method='observe', args=[observation(mixed_before), observation(mixed_after), {'action_ref': 'ACTION2'}, None], focus=True)]
        capture('parent_return_mixed_' + label, mixed_after, mixed_history, attention_setup=setup, repeat=2)

    capture('prior_family_resets_last_before_morphology', current, history,
        prior={'status': 'proposed', 'actions': [{'action_ref': 'ACTION1'}], 'contract_boundary': 'goal'}, repeat=2)
    capture('morphology_selected_keeps_current_decision', current, history,
        morphology_proposal={'status': 'proposed', 'actions': [{'action_ref': 'ACTION2'}], 'contract_boundary': 'morphology'})


def main():
    sys.setprofile(profile)
    try:
        populate()
    finally:
        sys.setprofile(None)
    assert verify_source() == VERIFIED
    configuration = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']
    source_hashes = {path: VERIFIED[path] for path, _, _ in EXECUTED}
    for path in ['agents/yf_arc3_v6/morphology_policy/strategy.src', 'agents/yf_arc3_v6/morphology_policy/strategy.drm']:
        source_hashes[path] = VERIFIED[path]
    output = dict(schema='v6-original-control-attention-strategy-reference.v1', commit=COMMIT,
        method=dict(sourceModified=False, astTransformed=False,
            scope='strategy consumer unit with explicit morphology/family/frontier dependency boundaries; not a game or measurement proof',
            sourceChecks=len(VERIFIED), before=True, after=True,
            boundaryInputs=['synthetic public rasters', 'current morphology decision', 'family offers', 'frontier acceptance'],
            projection=['executor-specific strategy receipt omitted; semantic selected/visited/deferrals retained',
                'frontier history logged as before/action/after refs',
                'mixed attention traversal order is an explicit expected_motion_order input; JSON object keys may be sorted']),
        sourceHashes=source_hashes, executed=[dict(path=p, line=n, function=f, calls=count) for (p, n, f), count in sorted(EXECUTED.items())],
        configuration=configuration, scenes=SCENES, cases=CASES)
    destination = ROOT / 'tests/fixtures/v6-control-attention-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(output, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps(dict(cases=len(CASES), decisions=sum(len(c['expected']) for c in CASES), scenes=len(SCENES),
        destination=str(destination), sha256=hashed(destination.read_bytes()))))


if __name__ == '__main__':
    main()
