#!/usr/bin/env python3
"""Execute the pinned WindowQuestion Python on synthetic public observations.

No game is opened or dispatched. Source files are verified before and after.
Geometry/family/policy/consumed V5 model expectations come from their original
functions. Named native adaptations remain separate from exact source cases.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.dont_write_bytecode = True


def encoded(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(',', ':')).encode()


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


def verify_sources():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())
    assert manifest['commit'] == COMMIT and len(manifest['files']) == 1786
    for name, record in manifest['files'].items():
        raw = (SOURCE / name).read_bytes()
        assert len(raw) == record['bytes'] and hashlib.sha256(raw).hexdigest() == record['sha256'], name
    return manifest


def capture(call):
    try: return {'value': plain(call())}
    except Exception as error:
        return {'error': {'name': type(error).__name__, 'message': str(error),
            **({'cause': error.cause} if hasattr(error, 'cause') else {}),
            **({'frontier': plain(error.frontier)} if hasattr(error, 'frontier') else {})}}


def rect(rows, left, top, right, bottom, value, ring=False):
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if not ring or x in (left, right) or y in (top, bottom): rows[y][x] = value


def raster(capacities=(1, 1), colors=(2, 2, 3, 3), unit=2, word_unit=3, slots=(2, 2),
           fixed=(False, False), configurable_filters=False, filters=(2, 3), outputs=(None, None), wildcard=False):
    height, width, top = 3 * unit + 2, 6 * unit + 5, 12
    rows = [[0] * max(2 * (width + 5) + 2, len(colors) * (word_unit + 2) + 4) for _ in range(top + height + 3)]
    for index, color in enumerate(colors):
        x = 3 + index * (word_unit + 2)
        rect(rows, x, 2, x + word_unit - 1, 2 + word_unit - 1, color)
    for index in range(2):
        left, right, bottom = 2 + index * (width + 5), 2 + index * (width + 5) + width - 1, top + height - 1
        rect(rows, left, top, right, bottom, 1)
        rect(rows, left + 1, top + 1, right - 1, bottom - 1, 8)
        start, field_width = bottom - unit, 2 * unit + 1
        for slot in range(slots[index]):
            x = left + 2 + slot * (unit + 1)
            rect(rows, x, start, x + unit - 1, bottom - 1, 7 if slot < capacities[index] or fixed[index] else 6)
            if fixed[index]: rect(rows, x, start, x + unit - 2, bottom - 2, 8)
        def field(x, color, domain=None):
            if domain is None:
                rect(rows, x, top + 1, x + field_width - 1, start - 1, color)
            else:
                rect(rows, x + unit, top + 1, x + field_width - 1, start - 1, color)
                for y in range(top + 1, start): rows[y][x] = domain[(y - top - 1) % len(domain)]
        if wildcard and index == 0:
            for y in range(top + 1, start):
                for x in range(left + 1, left + field_width + 1): rows[y][x] = (2, 3, 4)[(x + y) % 3]
        else: field(left + 1, filters[index], [2, 3] if configurable_filters else None)
        if outputs[index] is not None:
            output = outputs[index]
            field(right - field_width, output['value'], output.get('domain'))
    return rows


def build():
    manifest = verify_sources()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure as observe
    from agents.yf_arc3_v6.morphology_policy.window_question.family import WindowQuestion
    from agents.yf_arc3_v6.morphology_policy.window_question.policy import WindowPolicy
    from agents.yf_arc3_v6.morphology_policy.window_question import geometry
    from agents.yf_arc3_v5.capabilities import window_processing_d as window
    from agents.yf_arc3_v5.capabilities import mechanical_family_contracts_d as mechanical
    groups = {key: [] for key in ('geometryCases', 'cases', 'policyCases', 'kernelCases', 'constructorCases', 'nativeAdaptationCases')}
    executed, prefix = Counter(), str(SOURCE) + '/'
    def profile(frame, event, arg):
        if event == 'call' and frame.f_code.co_filename.startswith(prefix):
            executed[(frame.f_code.co_filename[len(prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
    def observation(rows, revision=1, epoch=1, actions=None):
        packet = SimpleNamespace(frame_rows=rows,
            frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
            level=epoch, levels_completed=epoch - 1, state='NOT_FINISHED',
            available_action_refs=tuple(['ACTION1', 'ACTION5', 'ACTION6'] if actions is None else actions))
        return plain(observe(packet, revision, 'window:synthetic')[0])
    def family_case(name, operation, arguments, seed=None, duplicate_offers=False):
        owner = WindowQuestion()
        if seed is not None: owner.restore(deepcopy(seed))
        before = plain(owner.state())
        args = deepcopy(arguments)
        if operation == 'beforeSource': args[2] = SimpleNamespace(**args[2])
        if duplicate_offers:
            original = owner.offers
            def duplicated(*values):
                offers, measurement = original(*values)
                return offers + deepcopy(offers), measurement
            owner.offers = duplicated
        method = {'proposeSource': 'propose', 'beforeSource': 'before', 'recordSource': 'record', 'sourceState': 'state'}.get(operation, operation)
        row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': before,
            'beforeState': before, **capture(lambda: getattr(owner, method)(*args)), 'afterState': plain(owner.state())}
        if duplicate_offers: row['controlledDependency'] = 'duplicate_exact_current_offers'
        groups['cases'].append(row)
        return row
    def geom(name, operation, arguments):
        row = {'id': name, 'operation': operation, 'arguments': plain(arguments),
            **capture(lambda: getattr(geometry, operation)(*deepcopy(arguments)))}
        groups['geometryCases'].append(row)
        return row
    constructors = {'normalizeTrainRank': window.TrainRankD, 'normalizeWindowReceiver': window.WindowReceiverD,
        'normalizeBeatPulse': window.BeatPulseD, 'normalizeWindowBeatState': window.WindowBeatStateD}
    def constructor(name, operation, value):
        row = {'id': name, 'operation': operation, 'argument': deepcopy(value),
            **capture(lambda: constructors[operation].model_validate(deepcopy(value)))}
        groups['constructorCases'].append(row)
        return row
    def train(colors=('red', 'red', 'blue', 'blue'), ranks=None, captured=()):
        ranks = list(range(len(colors))) if ranks is None else ranks
        return [{'unit_ref': f'unit:{i}', 'rank': rank, 'current_color_ref': color, 'captured': rank in captured}
            for i, (color, rank) in enumerate(zip(colors, ranks))]
    def receiver(name='r0', first=0, size=2, color='red', action='CAPTURE', **changes):
        return {'receiver_ref': name, 'first_rank_at_beat_zero': first, 'window_size': size,
            'admitted_color_refs': None if color is None else [color], 'maximal_group_required': False,
            'required_parent_events': [], 'action': action, 'paint_color_ref': 'blue' if action == 'PAINT' else None,
            'event_ref': 'event:' + name, 'one_use_for_run': True, **changes}
    def state(units=None, receivers=None, **changes):
        receivers = [receiver()] if receivers is None else receivers
        return {'train': train() if units is None else units, 'receivers': receivers,
            'receiver_order': [r['receiver_ref'] for r in receivers], 'spent_for_run_refs': [], 'current_pulses': [],
            'beat': 0, 'rank_shift_per_beat': 0, 'visitation_policy': 'single_ordered_pass',
            'revisit_receiver_refs': [], 'firing_bounds': [], 'revisit_termination_evidence_ref': None, **changes}
    def kernel(name, operation, value, receiver_index=0, depth=1, budget=None, clock=(0,)):
        request = {'node_bound': 4096, 'time_bound_ms': 1000, 'domain_bound': 4096, **(budget or {})}
        times, cursor = list(clock), 0
        def now():
            nonlocal cursor
            value = times[min(cursor, len(times) - 1)]; cursor += 1
            return value / 1000
        bound = window.WindowBeatStateD.model_validate(deepcopy(value))
        with patch.object(mechanical, 'monotonic', now):
            work = mechanical.DWorkBudget(SimpleNamespace(**request))
            call = (lambda: window._window_eligibility(bound, bound.receivers[receiver_index], bound.train,
                set(bound.spent_for_run_refs), bound.current_pulses, work)) if operation == 'windowEligibility' \
                else (lambda: window._process_one_beat(bound, work, depth))
            result = capture(call)
        row = {'id': name, 'operation': operation, 'state': plain(bound), 'receiverIndex': receiver_index,
            'depthBound': depth, 'budget': request, 'clockMilliseconds': times, 'clockCalls': cursor,
            'examined': work.examined, **result}
        groups['kernelCases'].append(row)
        return row
    sys.setprofile(profile)
    try:
        with patch.object(mechanical, 'monotonic', lambda: 0):
            policy = WindowPolicy(); model = deepcopy(policy.config['model'])
            initial, edited, ready = raster(), raster((2, 1)), raster((2, 2))
            obs0, obs1, obs2 = observation(initial, actions=['ACTION1']), observation(edited, 2), observation(ready, 3)
            measurement = geom('two_fixed_filters_configurable_capacities', 'measure', [initial])['value']
            assert measurement is not None and measurement['colors'] == [2, 2, 3, 3]
            assert [b['capacity'] for b in measurement['boxes']] == [1, 1]
            prepared = geom('prepared_current_capacities', 'measure', [ready])['value']
            for name, rows in [('empty', []), ('empty_row', [[]]), ('no_boxes', [[0] * 12 for _ in range(8)]),
                ('horizontal_mirror', [list(reversed(row)) for row in initial]), ('vertical_mirror', list(reversed(initial))),
                ('palette_bijection', [[(5 * v + 3) % 16 for v in row] for row in initial]),
                ('translated', [[0] * (len(initial[0]) + 4) for _ in range(2)] + [[0, 0] + row + [0, 0] for row in initial]),
                ('fixed_capacity_rims', raster(fixed=(True, True))), ('configurable_filter_domains', raster(configurable_filters=True)),
                ('wildcard_patch', raster(wildcard=True)), ('second_transform_field', raster(outputs=({'value': 3}, None))),
                ('single_word_color_rejected', raster(colors=(2, 2, 2, 2), filters=(2, 2))),
                ('filter_absent_from_word', raster(filters=(2, 4)))]: geom(name, 'measure', [rows])
            for unit in (3, 4): geom(f'box_quantum_{unit}', 'measure', [raster(unit=unit)])
            for size in (2, 4, 6): geom(f'word_quantum_{size}', 'measure', [raster(word_unit=size)])
            broken = deepcopy(initial); broken[12][2] = 0
            geom('broken_box_ring', 'measure', [broken])
            duplicate_word = deepcopy(initial)
            for index, color in enumerate((2, 2, 3, 3)): rect(duplicate_word, 3 + index * 5, 7, 5 + index * 5, 9, color)
            geom('two_regular_word_candidates', 'measure', [duplicate_word])
            overlay = deepcopy(initial); overlay[14][5] = 9; overlay[15][5] = 4
            geom('narrow_fixed_field_overlay', 'measure', [overlay])
            nonprefix = raster((1, 1), slots=(3, 3)); rect(nonprefix, 10, 17, 11, 18, 7)
            geom('capacity_active_slots_not_prefix', 'measure', [nonprefix])
            geom('canonical_nested_digest', 'digest', [{'z': [3, 2, 1], 'a': {'q': False, 'p': None}}])
            geom('fixed_filter_plan_product_order', 'plans', [measurement, model])
            geom('current_prepared_plan_cost_one', 'plans', [prepared, model])
            geom('complete_capture_no_rank_compaction', 'coverage', [measurement, [[2, 2, None], [2, 3, None]], model])
            geom('partial_capture_is_not_complete', 'coverage', [measurement, [[1, 2, None], [2, 3, None]], model])
            geom('settings_zip_ignores_extra', 'coverage', [measurement, [[2, 2, None], [2, 3, None], [1, 9, None]], model])
            geom('settings_zip_missing_box', 'coverage', [measurement, [[2, 2, None]], model])
            geom('window_larger_than_word', 'coverage', [measurement, [[5, 2, None], [2, 3, None]], model])
            for key, wrong in [('one_use_for_run', False), ('receiver_order_hypothesis', 'actual_rail_order')]:
                geom('refuse_unbound_model_' + key, 'coverage', [measurement, [[2, 2, None], [2, 3, None]], {**model, key: wrong}])
            geom('maximal_group_requires_full_run', 'coverage', [measurement, [[1, 2, None], [2, 3, None]], {**model, 'maximal_group_required': True}])
            geom('configuration_domain_refused', 'plans', [measurement, {**model, 'configuration_bound': 3}])
            geom('configuration_domain_exact_bound', 'plans', [measurement, {**model, 'configuration_bound': 4}])
            empty_domain = deepcopy(measurement); empty_domain['boxes'][0]['capacity_domain'] = []
            geom('empty_inner_domain', 'plans', [empty_domain, model])
            geom('empty_product_and_empty_train', 'plans', [{'colors': [], 'boxes': []}, model])
            invalid_cycle = deepcopy(measurement); invalid_cycle['boxes'][0]['capacity'] = 99
            geom('current_value_outside_cycle_raises', 'plans', [invalid_cycle, model])
            paint_m = {'colors': [2, 2], 'boxes': [{'second_field': {'domain': [3]}}, {'second_field': None}]}
            geom('paint_then_downstream_capture', 'coverage', [paint_m, [[2, 2, 3], [2, 3, None]], model])
            geom('paint_without_capture_never_completes', 'coverage', [paint_m, [[2, 2, 3]], model])
            long_m = {'colors': [2] * 200, 'boxes': [{'second_field': None} for _ in range(100)]}
            geom('source_projection_node_bound_propagates', 'coverage', [long_m, [[1, 2, None]] * 100, model])
            cooperative_rows = raster(slots=(4, 4), configurable_filters=True)
            cooperative_m = geom('cooperative_many_configurations', 'measure', [cooperative_rows])['value']
            assert cooperative_m is not None
            cooperative_plans = geom('cooperative_source_complete_product', 'plans', [cooperative_m, model])
            huge = {'colors': [2, 3], 'boxes': [{'capacity_domain': [1, 2, 3], 'filter_domain': [2], 'second_field': None} for _ in range(34)]}
            huge_value = geometry.plans(huge, model)
            assert huge_value == ([], {'truncated': True, 'domain': 3 ** 34})
            groups['nativeAdaptationCases'].append({'id': 'unsafe_truncated_domain_exact_decimal', 'operation': 'plans',
                'arguments': [huge, model], 'sourceExactDomainDecimal': str(huge_value[1]['domain']),
                'sourceTruncated': True, 'sourcePlans': [], 'nativeExpected': [[], {'truncated': True,
                    'domain': str(huge_value[1]['domain']), 'native_domain_format': 'exact_decimal_integer'}],
                'qualification': 'Named exact integer transport adaptation on an already truncated branch; no plan or release authority.'})

            foreign = {'action_ref': 'ACTION1'}
            family_case('cold_geometry_without_method_abstains', 'proposeSource', [obs0, initial, [], 9])
            family_case('zero_remaining_still_scopes', 'proposeSource', [obs0, initial, [], 0])
            passive = family_case('cold_foreign_capacity_change', 'recordSource', [obs0, obs1, foreign, initial, edited, None, 0, [edited]])
            acquired = passive['afterState']; assert len(acquired['edits']) == 1
            proposal_row = family_case('acquired_method_real_src_proposal', 'proposeSource', [obs1, edited, [], 8], acquired)
            proposal = proposal_row['value']; assert proposal['kind'] == 'public_window_question'
            assert proposal['actions'][0]['action_ref'] == 'ACTION6'
            family_case('all_current_offers', 'offers', [obs1, edited, 8], acquired)
            family_case('exact_binding', 'bind', [proposal, None], acquired)
            family_case('exact_before', 'beforeSource', [proposal, 0, {'frame_rows': edited}, obs1], acquired)
            family_case('duplicate_full_current_offers_refuse', 'beforeSource', [proposal, 0, {'frame_rows': edited}, obs1], acquired, True)
            family_case('after_never_predicts_effect', 'after', [proposal, 0, obs1, obs2, edited, ready], acquired)
            for key, replacement in [('observation_ref', 'foreign'), ('level_epoch', 2), ('frame_hash', 'foreign')]:
                family_case('guard_stale_' + key, 'beforeSource', [proposal, 0, {'frame_rows': edited}, {**obs1, key: replacement}], acquired)
            family_case('guard_index_nonzero', 'beforeSource', [proposal, 1, {'frame_rows': edited}, obs1], acquired)
            family_case('guard_score_only_not_direct_scope_check', 'beforeSource', [proposal, 0, {'frame_rows': edited}, {**obs1, 'levels_completed': 1}], acquired)
            family_case('guard_absent_public_action', 'beforeSource', [proposal, 0, {'frame_rows': edited}, {**obs1, 'available_action_refs': ['ACTION1']}], acquired)
            family_case('guard_current_rows_changed', 'beforeSource', [proposal, 0, {'frame_rows': ready}, obs1], acquired)
            for name, altered in [('steps', {**deepcopy(proposal), 'steps': []}), ('actions', {**deepcopy(proposal), 'actions': []})]:
                family_case('binding_changed_' + name, 'bind', [altered, None], acquired)
            altered = deepcopy(proposal); altered['window_question_plan']['offer']['action'] = foreign
            family_case('binding_offer_payload_changed', 'bind', [altered, None], acquired)
            altered = deepcopy(proposal); altered['window_question_plan']['offer']['cost'] += 1
            family_case('guard_full_offer_digest_changed', 'beforeSource', [altered, 0, {'frame_rows': edited}, obs1], acquired)
            more_methods = deepcopy(acquired); more_methods['edits'].append(deepcopy(more_methods['edits'][0]))
            family_case('guard_new_method_evidence_changes_offer', 'beforeSource', [proposal, 0, {'frame_rows': edited}, obs1], more_methods)
            family_case('caller_inputs_do_not_override_public_domain', 'proposeSource', [{**obs1, 'available_action_refs': ['ACTION1']}, edited, proposal['actions'], 8], acquired)
            family_case('remaining_below_plan_cost', 'proposeSource', [obs1, edited, [], 1], acquired)
            active = family_case('actual_own_setting_return', 'recordSource', [obs1, obs2, proposal['actions'][0], edited, ready, proposal, 0, [ready]], acquired)
            launch = family_case('prepared_geometry_launch_next', 'proposeSource', [obs2, ready, [], 7], active['afterState'])
            assert launch['value']['actions'] == [{'action_ref': 'ACTION5'}]
            no_effect_obs = observation(edited, 3)
            no_effect = family_case('actual_no_effect_setting_attempt', 'recordSource', [obs1, no_effect_obs, proposal['actions'][0], edited, edited, proposal, 0, [edited]], acquired)
            no_effect_next = family_case('attempt_excludes_same_context', 'proposeSource', [no_effect_obs, edited, [], 7], no_effect['afterState'])
            assert no_effect_next['value'] is None
            without_attempts = family_case('attempt_ablation_restores_question', 'proposeSource', [no_effect_obs, edited, [], 7], {**no_effect['afterState'], 'attempts': {}})
            assert without_attempts['value'] is not None
            without_methods = family_case('method_ablation_same_current_raster', 'proposeSource', [obs2, ready, [], 7], {**active['afterState'], 'edits': [], 'portable': []})
            assert without_methods['value'] is None
            new_rows, new_obs = raster(), observation(raster(), 4, 2)
            boundary = family_case('official_boundary_transports_methods_and_packet', 'recordSource',
                [obs2, new_obs, launch['value']['actions'][0], ready, new_rows, launch['value'], 0, [ready, new_rows]], active['afterState'])
            restored = family_case('portable_method_revalidated_in_new_epoch', 'proposeSource', [new_obs, new_rows, [], 9], boundary['afterState'])
            assert len(boundary['afterState']['portable']) == 1 and restored['value'] is not None
            family_case('old_proposal_has_no_boundary_authority', 'beforeSource', [launch['value'], 0, {'frame_rows': new_rows}, new_obs], boundary['afterState'])
            family_case('boundary_does_not_infer_new_field_change', 'recordSource', [obs0, {**obs1, 'level_epoch': 2}, foreign, initial, edited], acquired)
            family_case('unmeasurable_before_returns_before_after_scope', 'recordSource', [obs1, new_obs, foreign, [], new_rows], acquired)
            family_case('launches_only_not_method', 'recordSource', [obs0, observation(initial, 2), foreign, initial, initial, None, 0, [initial, initial]])
            family_case('two_simultaneous_field_changes_not_a_method', 'recordSource', [obs0, obs2, foreign, initial, ready])
            family_case('unmeasurable_return_no_field_change', 'recordSource', [obs0, {**obs1, 'frame_hash': 'empty'}, foreign, initial, []])
            changed_word = raster((2, 1), colors=(2, 3, 2, 3))
            family_case('changed_word_not_same_field_experiment', 'recordSource', [obs0, observation(changed_word, 2), foreign, initial, changed_word])
            family_case('unpointed_foreign_command_can_witness_field', 'recordSource', [obs0, obs1, {'action_ref': 'ACTION3'}, initial, edited])
            family_case('restore_partial_known_fields', 'restore', [{'last': {'retained': True}, 'attempts': {}}], acquired)
            family_case('state_detaches_all_six_fields', 'sourceState', [], active['afterState'])

            facts = {condition['field']: True for condition in policy.config['conditions']}
            def offer(kind='setting_question', cost=2, fields=None): return {'kind': kind, 'cost': cost, 'facts': deepcopy(facts if fields is None else fields)}
            policy_inputs = [('empty', []), ('one_setting', [offer()]), ('kind_priority_before_cost', [offer(cost=1), offer('traversal_question', 9)]),
                ('cost_before_index', [offer(cost=3), offer(cost=2)]), ('source_index_final_tie', [offer(), offer()]),
                ('unknown_kind_ignored', [offer('other'), offer()]), ('unknown_only_abstains', [offer('other')])]
            for key in facts:
                missing = deepcopy(facts); del missing[key]
                policy_inputs.extend([(key + '_missing', [offer(fields=missing)]), (key + '_false', [offer(fields={**facts, key: False})])])
            for name, offers in policy_inputs:
                groups['policyCases'].append({'id': name, 'offers': offers, 'select': plain(policy.select(offers)), 'choose': plain(policy.choose(offers))})

            base = state()
            kernel('homogeneous_exact_window', 'windowEligibility', base)
            kernel('capture_retains_ranks_and_holes', 'processOneBeat', base)
            kernel('heterogeneous_window', 'windowEligibility', state(train(('red', 'blue'))))
            kernel('filter_mismatch', 'windowEligibility', state(receivers=[receiver(color='green')]))
            kernel('wildcard_admission', 'windowEligibility', state(receivers=[receiver(color=None)]))
            kernel('fixed_rank_gap', 'windowEligibility', state(train(ranks=(0, 2, 3, 4))))
            kernel('captured_rank_hole', 'windowEligibility', state(train(captured=(0,))))
            kernel('maximal_group_right_neighbor', 'windowEligibility', state(train(('red', 'red', 'red')), [receiver(maximal_group_required=True)]))
            kernel('captured_neighbor_not_maximal_extension', 'windowEligibility', state(train(('red', 'red', 'red'), captured=(2,)), [receiver(maximal_group_required=True)]))
            kernel('negative_rank_and_shift', 'windowEligibility', state(train(('red', 'red'), ranks=(-2, -1)), [receiver(first=0)], beat=2, rank_shift_per_beat=-1))
            kernel('spent_opportunity', 'windowEligibility', state(spent_for_run_refs=['r0']))
            parents = [receiver('parent', action='PULSE'), receiver('child', required_parent_events=[['parent', 'event:parent']])]
            kernel('same_beat_parent_missing', 'windowEligibility', state(receivers=parents), 1)
            kernel('same_beat_parent_present', 'windowEligibility', state(receivers=parents,
                current_pulses=[{'receiver_ref': 'parent', 'event_ref': 'event:parent', 'beat': 0}]), 1)
            kernel('old_parent_pulse_does_not_authorize', 'windowEligibility', state(receivers=parents, beat=1,
                current_pulses=[{'receiver_ref': 'parent', 'event_ref': 'event:parent', 'beat': 0}]), 1)
            kernel('ordered_rejection_causes', 'windowEligibility', state(train(captured=(0,)), parents, spent_for_run_refs=['child']), 1)
            kernel('pulse_enables_same_beat_capture', 'processOneBeat', state(receivers=parents))
            kernel('paint_enables_downstream_capture', 'processOneBeat', state(train(('red', 'red')),
                [receiver('z', action='PAINT'), receiver('a', color='blue')]))
            kernel('fixed_rank_second_receiver_no_compaction', 'processOneBeat', state(receivers=[receiver('z'), receiver('a', first=2, color='blue')]))
            kernel('old_pulses_filtered_by_beat', 'processOneBeat', state(beat=1,
                current_pulses=[{'receiver_ref': 'r0', 'event_ref': 'old', 'beat': 0}]))
            revisit = state(train(('red', 'red')), [receiver(action='PULSE', one_use_for_run=False)],
                visitation_policy='revisit_to_quiescence', revisit_receiver_refs=['r0'], firing_bounds=[['r0', 2]], revisit_termination_evidence_ref='termination:bound')
            kernel('revisit_until_bounded_quiescence', 'processOneBeat', revisit, depth=3)
            kernel('depth_exhaustion_returns_no_partial_state', 'processOneBeat', revisit, depth=2)
            kernel('missing_revisit_termination_evidence', 'processOneBeat', {**revisit, 'revisit_termination_evidence_ref': None}, depth=3)
            kernel('missing_revisit_right_bound', 'processOneBeat', {**revisit, 'firing_bounds': []}, depth=3)
            kernel('empty_revisit_still_requires_termination', 'processOneBeat', {**revisit, 'revisit_receiver_refs': [], 'revisit_termination_evidence_ref': None}, depth=3)
            kernel('zero_depth', 'processOneBeat', base, depth=0)
            kernel('node_bound_first', 'windowEligibility', base, budget={'node_bound': 0}, clock=(0, 1000))
            kernel('time_bound_before_visit', 'windowEligibility', base, clock=(0, 1000))
            kernel('second_receiver_node_exhaustion', 'processOneBeat', state(receivers=parents), budget={'node_bound': 1})
            kernel('private_kernel_does_not_apply_request_domain_wrapper', 'windowEligibility', base, budget={'domain_bound': 1})
            constructor('train_identity', 'normalizeTrainRank', train()[0])
            constructor('receiver_defaults', 'normalizeWindowReceiver', {k: v for k, v in receiver().items() if k != 'required_parent_events'})
            constructor('pulse', 'normalizeBeatPulse', {'receiver_ref': 'r0', 'event_ref': 'e', 'beat': 0})
            constructor('state_defaults', 'normalizeWindowBeatState', {k: v for k, v in base.items() if k not in
                ('train', 'spent_for_run_refs', 'current_pulses', 'revisit_receiver_refs', 'firing_bounds')})
            invalid_states = [('duplicate_rank', {**base, 'train': [train()[0], {**train()[1], 'rank': 0}]}),
                ('duplicate_unit', {**base, 'train': [train()[0], {**train()[1], 'unit_ref': 'unit:0'}]}),
                ('duplicate_receiver', {**base, 'receivers': [receiver(), receiver()]}),
                ('missing_order_member', {**base, 'receiver_order': ['other']}),
                ('duplicate_order_member', {**base, 'receiver_order': ['r0', 'r0']}),
                ('spent_unknown_receiver', {**base, 'spent_for_run_refs': ['other']}),
                ('reentry_unknown_receiver', {**base, 'revisit_receiver_refs': ['other']}),
                ('paint_without_actual_color', state(receivers=[receiver(action='PAINT', paint_color_ref=None)])),
                ('unknown_parent', state(receivers=[receiver(required_parent_events=[['other', 'e']])])),
                ('parent_not_prior', state(receivers=[receiver(required_parent_events=[['r0', 'e']])])),
                ('duplicate_firing_bound', {**base, 'firing_bounds': [['r0', 1], ['r0', 2]]}),
                ('nonpositive_firing_bound', {**base, 'firing_bounds': [['r0', 0]]}),
                ('negative_beat', {**base, 'beat': -1}), ('null_default_list', {**base, 'current_pulses': None}),
                ('unknown_visitation', {**base, 'visitation_policy': 'guessed'})]
            for name, value in invalid_states: constructor(name, 'normalizeWindowBeatState', value)
            for name, change in [('zero_size', {'window_size': 0}), ('oversized_window', {'window_size': 4097}),
                ('unknown_action', {'action': 'GUESS'}), ('unknown_field', {'invented': 1}), ('empty_identity', {'receiver_ref': ''})]:
                constructor(name, 'normalizeWindowReceiver', {**receiver(), **change})
            for name, change in [('numeric_string_rank', {'rank': '2'}), ('boolean_capture_coercion', {'captured': 1})]:
                constructor(name, 'normalizeTrainRank', {**train()[0], **change})
            for name, change in [('unsafe_integer_rank', {'rank': 2 ** 53})]:
                raw = {**train()[0], **change}
                groups['nativeAdaptationCases'].append({'id': name, 'operation': 'normalizeTrainRank', 'argument': raw,
                    'sourceResult': capture(lambda: window.TrainRankD.model_validate(raw)), 'nativeExpectedError': 'TypeError',
                    'qualification': 'Named exact portable-integer native boundary; Python unbounded integer acceptance is not claimed.'})
    finally: sys.setprofile(None)
    after_manifest = verify_sources()
    assert manifest == after_manifest
    imported = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)
        and Path(module.__file__).resolve().is_relative_to(SOURCE)}
    imported.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/window_question').glob('*.drm'))
    imported.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/window_question').glob('*.src'))
    return {'schema': 'logos-engine.v6.window-question-reference.v1', 'referenceCommit': COMMIT,
        'sourceModified': False, 'fullCallerParity': False,
        'sourceFilesVerifiedBefore': len(manifest['files']), 'sourceFilesVerifiedAfter': len(after_manifest['files']),
        'sourceFilesVerifiedBeforeAndAfter': len(manifest['files']),
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        'qualification': 'Unchanged original Python on synthetic public rasters and controlled returns. No game dispatch or solved-level claim. '
            'Only the V5 models and private helpers actually consumed by this V6 component are compared; complete V5 request dispatch is not claimed.',
        'clockQualification': 'Source projection monotonic is externally fixed for deterministic finite-work comparison; explicit budget cases supply recorded clocks.',
        'sourceHashes': {path.relative_to(SOURCE).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(imported)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': calls} for (path, line, name), calls in sorted(executed.items())],
        'groupCounts': {name: len(rows) for name, rows in groups.items()}, **groups,
        'cooperative': {'rows': cooperative_rows, 'measurement': cooperative_m, 'model': model, 'sourcePlans': cooperative_plans['value']},
        'kernelCold': {'qualification': 'Cold full-runtime synthetic public sequence; observations only, no injected learned state.',
            'initialRows': initial, 'editedRows': edited, 'readyRows': ready, 'initialObservation': obs0, 'editedObservation': obs1,
            'readyObservation': obs2, 'foreignCommand': foreign, 'stageRemaining': {'initial': 9, 'proposal': 8, 'launch': 7, 'noEffectNext': 7, 'portable': 9},
            'passive': passive, 'proposal': proposal_row, 'active': active, 'launch': launch, 'noEffect': no_effect,
            'noEffectNext': no_effect_next, 'withoutAttempts': without_attempts, 'withoutMethods': without_methods},
        'kernelPortable': {'newRows': new_rows, 'newObservation': new_obs, 'boundary': boundary, 'restoredProposal': restored}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'tests/fixtures/v6-window-question-reference.json.gz')
    parser.add_argument('--coordination-lock', type=Path, default=Path('/workspace/shared/sra-coordination/performance.lock'))
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() or not output.is_relative_to(ROOT) or output.is_relative_to(SOURCE.parent) or not output.name.endswith('.json.gz'):
        parser.error('Supply a new .json.gz path in this checkout, outside pinned originals')
    with args.coordination_lock.open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='window-original-reference-') as cache:
            sys.pycache_prefix = cache
            value = build()
            value['bytecodeIsolation'] = {'dontWriteBytecode': True, 'freshPrefixEmptyAfter': not any(Path(cache).rglob('*'))}
            assert value['bytecodeIsolation']['freshPrefixEmptyAfter']
        raw = gzip.compress(encoded(value) + b'\n', mtime=0)
        assert len(raw) < 32 * 1024 * 1024, 'Reference exceeds delivery object bound'
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('xb') as stream: stream.write(raw)
        if len(raw) > 900_000:
            parts = []
            for index, start in enumerate(range(0, len(raw), 900_000)):
                block, name = raw[start:start + 900_000], output.name + f'.part{index:03d}'
                with output.with_name(name).open('xb') as stream: stream.write(block)
                parts.append({'file': name, 'bytes': len(block), 'sha256': hashlib.sha256(block).hexdigest()})
            manifest = {'schema': 'logos-engine.evidence-byte-parts.v1',
                'original': {'file': output.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}, 'parts': parts}
            with output.with_name(output.name + '.parts.json').open('x') as stream: json.dump(manifest, stream, indent=2)
        print(json.dumps({'path': output.relative_to(ROOT).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'groupCounts': value['groupCounts'], 'sourceFilesVerifiedBeforeAndAfter': value['sourceFilesVerifiedBeforeAndAfter']}))


if __name__ == '__main__':
    main()
