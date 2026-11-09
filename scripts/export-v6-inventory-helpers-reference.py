#!/usr/bin/env python3
"""Independent pinned-Python contracts for seven ObservedInventory helpers.

All scenes are synthetic public rasters and records. Expected values and mutated
records come only from unchanged original Python. No native module or game
implementation supplies an expected value, action, route or retained state.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy as clone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('verified_inventory_helpers_source', ROOT / 'scripts/probe-v6-outline-service-original.py')
verified = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verified)
sys.path.insert(0, str(verified.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from agents.yf_arc3_v6.morphology_policy.observed_inventory import (
    routing, dependencies, endpoints, boundary, continuation, local_contact,
    context_intervention, project,
)
from agents.yf_arc3_v5.capabilities.contracts import InteractionProbeInput, FrameGrid, ComponentExtractionInput
from agents.yf_arc3_v5.capabilities.components import detect_components

MODULES = {module.__name__.rsplit('.', 1)[-1]: module for module in (
    routing, dependencies, endpoints, boundary, continuation, local_contact,
    context_intervention,
)}
SOURCE_BASE = 'agents/yf_arc3_v6/morphology_policy/observed_inventory/'
CONFIG = json.loads((verified.SOURCE / (SOURCE_BASE + 'inventory.drm')).read_text())['declarations'][0]['configuration']
PRIOR = CONFIG['interface_prior']
DIRECTIONS = PRIOR['directions']
CASES = []


def plain(value):
    return verified.plain(value)


def execute(operation, arguments):
    args = clone(arguments)
    call = dict(args)
    if 'available' in call:
        call['available'] = set(call['available'])
    for name in ('visited', 'underlays'):
        if name in call and call[name] is not None:
            call[name] = {tuple(key): value for key, value in call[name]}
    if operation == 'dependencies.recalled_gain_targets' and call['collection'] is not None:
        class Collection:
            def evidence_for(self, signature):
                return clone(args['collection'].get(signature, {'confirmed': [], 'counterexamples': []}))
        call['collection'] = Collection()
    if operation == 'endpoints.endpoint_measurements' and call['probe'] is not None:
        call['probe'] = InteractionProbeInput.model_validate(call['probe'])
    if operation == 'local_contact.equivalent_current_contact_offers':
        call['digest'] = context_intervention.digest
    module, name = operation.split('.')
    result = getattr(MODULES[module], name)(**call)
    return {'value': plain(result), 'after': plain(args)}


def record(name, operation, arguments, positive=False):
    result = execute(operation, arguments)
    if positive:
        assert result['value'], (name, 'positive fixture did not exercise a result')
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), **result})
    return result


def box(cell):
    return [cell['bbox'][key] for key in ('left', 'top', 'right', 'bottom')]


def patch(rows, bbox):
    return boundary.patch(rows, bbox)


def put(rows, bbox, value):
    l, t, r, b = bbox
    for y in range(t, b + 1):
        for x in range(l, r + 1):
            rows[y][x] = value


def world(dx=0, dy=0, palette=None, grid_rows=3, grid_columns=4):
    palette = palette or list(range(16))
    rows = [[palette[0]] * (24 + dx) for _ in range(18 + dy)]
    cells = []
    for r in range(grid_rows):
        for c in range(grid_columns):
            left, top = 2 + dx + c * 4, 2 + dy + r * 4
            cells.append({'row': r, 'col': c, 'bbox': {'left': left, 'top': top, 'right': left + 2, 'bottom': top + 2}})
    body = [3 + dx, 3 + dy, 3 + dx, 3 + dy]
    rows[body[1]][body[0]] = palette[9]
    core = {'signature': 'synthetic:body', 'palette_value': palette[9], 'area': 1, 'offsets': [[0, 0]]}
    entity = {'signature': core['signature'], 'palette_value': core['palette_value'], 'area': 1, 'bbox': body, 'mask': [[0, 0]], 'identity_ambiguous': False}
    obs = {'observation_ref': 'obs:before', 'level_epoch': 1, 'levels_completed': 0, 'entities': [entity], 'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION7']}
    grid = {'cell_width': 3, 'cell_height': 3, 'row_pitch': 4, 'col_pitch': 4, 'cells': cells}
    controls = {'ACTION4': {'delta': [4, 0], 'evidence': [['obs:prior', 'obs:before']], 'contradictions': []}}
    scene = {'status': 'measured', 'observation_ref': obs['observation_ref'], 'level_epoch': 1, 'body_signature': core['signature'], 'body': body, 'controls': controls, 'grids': [grid]}
    return rows, obs, scene, core, palette


def display(rows, dx=0, dy=0, palette=None):
    palette = palette or list(range(16))
    bbox = [19 + dx, 2 + dy, 20 + dx, 3 + dy]
    shape = [[0, 0], [1, 0], [0, 1]]
    for x, y in shape:
        rows[bbox[1] + y][bbox[0] + x] = palette[6]
    return {'display_bbox': bbox, 'source_mask': shape, 'source_value': palette[6], 'display_component_ref': 'component:held', 'evidence': ['obs:transfer-before', 'obs:transfer-after'], 'action': {'action_ref': 'ACTION5'}}


def proposal(scene, core, target, kind, before_box, after_box, action='ACTION4'):
    return {'inventory_plan': {'offer': {'kind': kind, 'scene': clone(scene), 'core': clone(core), 'target': clone(target), 'route': {'target_cell': clone(target['source_cell'])}}},
            'steps': [{'body_before': clone(before_box), 'to_cell': clone(target['source_cell']), 'expected_after': {'body_bbox': clone(after_box)} if after_box else None, 'action': {'action_ref': action}}],
            'actions': [{'action_ref': action}], 'binding': {'observation_ref': 'obs:before'},
            'bundle_template': {'composition_ref': 'composition:synthetic', 'objective_ref': 'goal:synthetic'},
            'compositions': [{'id': 'composition:synthetic', 'properties': {}, 'relations': []}], 'question': {'reason': 'synthetic observed question'}}


def change(name, operation, base, mutate, positive=False):
    args = clone(base)
    mutate(args)
    return record(name, operation, args, positive)


def routing_cases():
    for dx, dy, colors in [(0, 0, list(range(16))), (2, 1, list(range(16))), (0, 0, [(i + 7) % 16 for i in range(16)])]:
        rows, obs, scene, core, palette = world(dx, dy, colors)
        label = f'{dx}:{dy}:{palette[0]}'
        base = {'facts': scene, 'rows': rows, 'target_cells': [[0, 3]], 'interface_hypotheses': DIRECTIONS, 'available': obs['available_action_refs'], 'maximum': 16, 'conditional_cells': []}
        record('routes:observed:' + label, 'routing.measured_paths', base, True)
        change('routes:recalled:' + label, 'routing.measured_paths', base, lambda a: a['facts']['controls']['ACTION4'].update(recalled_hypothesis=True), True)
        change('routes:interface:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(controls={}), True)
        change('routes:no-inputs:' + label, 'routing.measured_paths', base, lambda a: a.update(available=[]))
        change('routes:zero-prefix-budget:' + label, 'routing.measured_paths', base, lambda a: a.update(maximum=0), True)
        change('routes:one-prefix-budget:' + label, 'routing.measured_paths', base, lambda a: a.update(maximum=1), True)
        change('routes:current-target:' + label, 'routing.measured_paths', base, lambda a: a.update(target_cells=[[0, 0]]), True)
        cell = scene['grids'][0]['cells'][0]
        exterior = [[x, y, palette[0]] for y in range(3) for x in range(3) if (x, y) != (1, 1)]
        departure = {'level_epoch': 1, 'body_bbox': scene['body'], 'cell_bbox': box(cell), 'current_exterior': exterior, 'prior_exterior': exterior, 'evidence': ['obs:entered', 'obs:arrival']}
        change('routes:departure:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(conditional_departure_support=departure), True)
        change('routes:overlay:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(underlay_evidence={'material_overlay': departure}), True)
        change('routes:stale-departure:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(conditional_departure_support={**departure, 'level_epoch': 0}), True)
        layer = {'cell_bbox': box(scene['grids'][0]['cells'][1]), 'substrate_patch': [[palette[0]] * 3 for _ in range(3)], 'evidence': ['obs:material'], 'qualification': 'synthetic retained material', 'visible_pixels': [[0, 0]], 'hidden_pixels': [[1, 1]]}
        change('routes:material:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(retained_material_surfaces=[layer]), True)
        change('routes:ambiguous-material:' + label, 'routing.measured_paths', base, lambda a: a['facts'].update(retained_material_surfaces=[layer, clone(layer)]), True)
    rows, obs, scene, core, palette = world(grid_rows=1)
    blocked = box(scene['grids'][0]['cells'][1]); put(rows, blocked, 4)
    base = {'facts': scene, 'rows': rows, 'target_cells': [[0, 3]], 'interface_hypotheses': DIRECTIONS, 'available': obs['available_action_refs']}
    record('routes:blocked-partition', 'routing.measured_paths', base)
    change('routes:conditional-partition', 'routing.measured_paths', base, lambda a: a.update(conditional_cells=[[0, 1]]), True)
    change('routes:missing-grid', 'routing.measured_paths', base, lambda a: a['facts'].update(grids=[]))
    change('routes:ambiguous-grid', 'routing.measured_paths', base, lambda a: a['facts']['grids'].append(clone(a['facts']['grids'][0])))
    change('routes:no-contained-body', 'routing.measured_paths', base, lambda a: a['facts'].update(body=[0, 0, 0, 0]))
    change('routes:no-exterior', 'routing.measured_paths', base, lambda a: a['facts'].update(body=box(a['facts']['grids'][0]['cells'][0])))
    change('routes:unknown-destination', 'routing.measured_paths', base, lambda a: a.update(target_cells=[[99, 99]]))
    return rows, obs, scene, core


def dependency_cases(blocked):
    rows, obs, scene, core = blocked
    pair = {'source_cell': [0, 0], 'target_cell': [0, 1], 'source_value': 6, 'level_epoch': 1}
    base = {'scene': scene, 'rows': rows, 'world_pairs': [pair], 'display_pairs': [{'target_row': 0, 'target_col': 3}], 'interfaces': DIRECTIONS, 'available': obs['available_action_refs']}
    dep = record('dependency:unique-necessary-partition', 'dependencies.measured_dependencies', base, True)['value'][0]
    change('dependency:ambiguous-supplier', 'dependencies.measured_dependencies', base, lambda a: a['world_pairs'].append(clone(a['world_pairs'][0])))
    change('dependency:ambiguous-display', 'dependencies.measured_dependencies', base, lambda a: a['display_pairs'].append(clone(a['display_pairs'][0])))
    change('dependency:unreachable-supplier', 'dependencies.measured_dependencies', base, lambda a: a['world_pairs'][0].update(source_cell=[0, 2]))
    change('dependency:direct-access', 'dependencies.measured_dependencies', base, lambda a: put(a['rows'], box(a['scene']['grids'][0]['cells'][1]), 0))
    held = {'action': {'action_ref': 'ACTION5'}, 'evidence': ['obs:held']}
    target = {'scene': scene, 'dependency': dep, 'held': held}
    record('dependency:current-frontier', 'dependencies.frontier_target', target, True)
    change('dependency:remote-frontier', 'dependencies.frontier_target', target, lambda a: a['dependency'].update(frontier_cell=[0, 2]), True)
    change('dependency:missing-frontier', 'dependencies.frontier_target', target, lambda a: a['dependency'].update(frontier_cell=[8, 8]))
    marker = {'signature': 'appearance:gain', 'palette_value': 6, 'area': 2, 'bbox': [11, 3, 12, 3], 'identity_ambiguous': False}
    gain = {'scene': scene, 'obs': {**obs, 'entities': obs['entities'] + [marker]}, 'collection': {'appearance:gain': {'confirmed': ['obs:gain'], 'counterexamples': []}}, 'dependency': dep}
    record('dependency:recalled-gain', 'dependencies.recalled_gain_targets', gain, True)
    change('dependency:gain-refuted', 'dependencies.recalled_gain_targets', gain, lambda a: a['collection']['appearance:gain'].update(counterexamples=['obs:refuted']))
    change('dependency:gain-ambiguous', 'dependencies.recalled_gain_targets', gain, lambda a: a['obs']['entities'][-1].update(identity_ambiguous=True))
    change('dependency:no-collection', 'dependencies.recalled_gain_targets', gain, lambda a: a.update(collection=None))


def boundary_cases():
    for dx, dy, palette in [(0, 0, list(range(16))), (2, 1, [(i + 3) % 16 for i in range(16)])]:
        rows, obs, scene, core, palette = world(dx, dy, palette)
        held = display(rows, dx, dy, palette)
        after = {**clone(obs), 'observation_ref': 'obs:new-scope', 'level_epoch': 2, 'levels_completed': 1}
        blank = [[palette[0]] * 2 for _ in range(2)]
        returns = [{'level_epoch': 1, 'display_bbox': held['display_bbox'], 'cleared_display_pattern': blank, 'evidence': ['obs:clear-before', 'obs:clear-after']}]
        second = clone(rows);put(second, held['display_bbox'], palette[4])
        args = {'before': obs, 'after': after, 'first': rows, 'second': second, 'held': held, 'returns': returns, 'core': core['signature']}
        label = f'{dx}:{dy}:{palette[0]}'
        memory = record('boundary:capture:' + label, 'boundary.capture', args, True)['value']
        change('boundary:no-absence-witness:' + label, 'boundary.capture', args, lambda a: a.update(returns=[]))
        change('boundary:same-scope:' + label, 'boundary.capture', args, lambda a: a['after'].update(level_epoch=1))
        change('boundary:no-official-progress:' + label, 'boundary.capture', args, lambda a: a['after'].update(levels_completed=0))
        reval = {'memory': memory, 'obs': after, 'rows': second, 'methods': []}
        record('boundary:opaque-hypothesis:' + label, 'boundary.revalidate', reval, True)
        change('boundary:visible-reappearance:' + label, 'boundary.revalidate', reval, lambda a: a.update(rows=rows), True)
        change('boundary:absent:' + label, 'boundary.revalidate', reval, lambda a: put(a['rows'], held['display_bbox'], palette[0]), True)
        change('boundary:inactive:' + label, 'boundary.revalidate', reval, lambda a: a['memory'].update(active=False), True)
        change('boundary:scope-changed:' + label, 'boundary.revalidate', reval, lambda a: a['obs'].update(level_epoch=3), True)
        change('boundary:no-body:' + label, 'boundary.revalidate', reval, lambda a: a['obs'].update(entities=[]), True)
        change('boundary:ambiguous-body:' + label, 'boundary.revalidate', reval, lambda a: a['obs']['entities'].append(clone(a['obs']['entities'][0])), True)
        change('boundary:nonrectangular-rewrite:' + label, 'boundary.revalidate', reval, lambda a: a['rows'][held['display_bbox'][3]].__setitem__(held['display_bbox'][2], palette[0]), True)
        different = {**clone(held), 'source_mask': [[0, 0]], 'source_value': palette[5]}
        a = clone(reval);put(a['rows'], held['display_bbox'], palette[0]);a['rows'][held['display_bbox'][1]][held['display_bbox'][0]] = palette[5];a['methods'] = [different]
        record('boundary:observed-other-signature:' + label, 'boundary.revalidate', a, True)
        change('boundary:unbound-window:' + label, 'boundary.revalidate', reval, lambda a: a['memory']['source_receipt'].update(display_bbox=[200, 200, 201, 201]), True)
        complement_rows = clone(rows);target_box = box(scene['grids'][0]['cells'][1]);put(complement_rows, target_box, palette[6])
        for x, y in held['source_mask']:complement_rows[target_box[1] + y][target_box[0] + x] = palette[0]
        complement = {'scene': scene, 'rows': complement_rows, 'held': held}
        record('boundary:remembered-complement:' + label, 'boundary.complements', complement, True)
        change('boundary:empty-signature:' + label, 'boundary.complements', complement, lambda a: a['held'].update(source_mask=[]))
        change('boundary:full-signature:' + label, 'boundary.complements', complement, lambda a: a['held'].update(source_mask=[[x, y] for y in range(3) for x in range(3)]))
        goal_rows = clone(rows);old = [palette[2], palette[2], palette[2], palette[2], palette[4], palette[2], palette[2], palette[2], palette[2]]
        for i, value in enumerate(old):goal_rows[target_box[1] + i // 3][target_box[0] + i % 3] = value
        models = [{'role': core['signature'], 'boundary_before': 'obs:goal-before', 'boundary_after': 'obs:goal-after', 'scoring_pattern': old}]
        goal = {'scene': scene, 'rows': goal_rows, 'models': models}
        record('boundary:exact-goal-witness:' + label, 'boundary.current_goal_witnesses', goal, True)
        change('boundary:contour-residual:' + label, 'boundary.current_goal_witnesses', goal, lambda a: a['rows'][target_box[1] + 1].__setitem__(target_box[0] + 1, palette[5]), True)
        change('boundary:wrong-contour:' + label, 'boundary.current_goal_witnesses', goal, lambda a: a['rows'][target_box[1]].__setitem__(target_box[0], palette[5]))
        change('boundary:wrong-role:' + label, 'boundary.current_goal_witnesses', goal, lambda a: a['models'][0].update(role='other'))
    record('boundary:patch-valid', 'boundary.patch', {'rows': [[1, 2], [3, 4]], 'box': [0, 0, 1, 1]}, True)
    record('boundary:patch-outside', 'boundary.patch', {'rows': [[1, 2], [3, 4]], 'box': [-1, 0, 1, 1]})


def access_and_retained_cases():
    rows, obs, scene, core, palette = world()
    held = display(rows);scene['displayed_candidate'] = held
    target_box = box(scene['grids'][0]['cells'][1]);target = {'source_cell': [0, 1], 'source_bbox': target_box}
    moved_box = [7, 3, 7, 3]
    p = proposal(scene, core, target, 'access_probe_candidate', scene['body'], moved_box)
    second = clone(rows);put(second, scene['body'], 0);put(second, moved_box, 9);second[2][6] = 4;put(second, held['display_bbox'], 0)
    after = {**clone(obs), 'observation_ref': 'obs:after', 'entities': [{**clone(obs['entities'][0]), 'bbox': moved_box}]}
    args = {'proposal': p, 'index': 0, 'before': obs, 'after': after, 'first': rows, 'second': second}
    returned = record('access:actual-return', 'continuation.access_measurements', args, True)['value']
    change('access:scope-boundary', 'continuation.access_measurements', args, lambda a: a['after'].update(level_epoch=2))
    change('access:official-boundary', 'continuation.access_measurements', args, lambda a: a['after'].update(levels_completed=1))
    change('access:stale-binding', 'continuation.access_measurements', args, lambda a: a['proposal']['binding'].update(observation_ref='obs:stale'))
    change('access:wrong-position', 'continuation.access_measurements', args, lambda a: put(a['second'], moved_box, 0))
    retained_indicator = clone(args)
    for y in range(held['display_bbox'][1], held['display_bbox'][3] + 1):
        for x in range(held['display_bbox'][0], held['display_bbox'][2] + 1):
            retained_indicator['second'][y][x] = rows[y][x]
    record('access:display-retained', 'continuation.access_measurements', retained_indicator, True)
    a = clone(args);a['proposal']['inventory_plan']['offer']['scene']['displayed_candidate'].update(visibility='opaque_rewrite_hypothesis', current_observation_ref='obs:before', current_level_epoch=1, current_indicator_pattern=patch(rows, held['display_bbox']), absence_pattern=[[0, 0], [0, 0]])
    record('access:recalled-indicator', 'continuation.access_measurements', a, True)
    change('access:stale-recalled-indicator', 'continuation.access_measurements', a, lambda a: a['proposal']['inventory_plan']['offer']['scene']['displayed_candidate'].update(current_observation_ref='obs:old'))
    mark = {'bbox': [11, 3, 11, 3], 'palette_value': 6, 'area': 1, 'signature': 'mark:meter', 'identity_ambiguous': False}
    gauge_obs = {**clone(obs), 'entities': obs['entities'] + [mark]}
    forecast = {'observation_ref': obs['observation_ref'], 'level_epoch': 1, 'measured_strip': ['x', 0, 6, 0, 3], 'steps_before_empty': 5}
    capacity = {'scene': scene, 'obs': gauge_obs, 'forecast': forecast, 'returned': returned}
    record('capacity:current-related-mark', 'continuation.capacity_targets', capacity, True)
    change('capacity:old-return', 'continuation.capacity_targets', capacity, lambda a: a['returned'].update(level_epoch=0))
    change('capacity:old-forecast', 'continuation.capacity_targets', capacity, lambda a: a['forecast'].update(observation_ref='obs:old'))
    change('capacity:on-strip', 'continuation.capacity_targets', capacity, lambda a: a['forecast'].update(measured_strip=['x', 3, 6, 0, 3]))
    source_box = box(scene['grids'][0]['cells'][0]);scene.pop('displayed_candidate');scene['underlay_evidence'] = {'cell_bbox': source_box}
    retained_rows = clone(rows);put(retained_rows, held['display_bbox'], 0)
    entity = {'signature': 'appearance:supplier', 'area': 2, 'bbox': [2, 2, 3, 2]}
    memory = {'source_cell': [0, 0], 'source_bbox': source_box, 'source_entity': entity, 'source_entities': [entity], 'cell_pixels': patch(rows, source_box), 'level_epoch': 1}
    method = {**clone(held), 'status': 'observed_correspondence_possession_hypothesis'}
    retained = {'scene': scene, 'obs': obs, 'rows': retained_rows, 'memories': [memory], 'methods': [method], 'returned': returned}
    record('retained:peripheral-clear-current-source', 'endpoints.retained_method_targets', retained, True)
    change('retained:ambiguous-method', 'endpoints.retained_method_targets', retained, lambda a: a['methods'].append({**clone(method), 'action': {'action_ref': 'ACTION7'}}))
    change('retained:scope-mismatch', 'endpoints.retained_method_targets', retained, lambda a: a['memories'][0].update(level_epoch=0))
    change('retained:peripheral-changed', 'endpoints.retained_method_targets', retained, lambda a: a['rows'][2].__setitem__(19, 6))
    change('retained:local-context-changed', 'endpoints.retained_method_targets', retained, lambda a: a['rows'][2].__setitem__(2, 4))
    change('retained:underlay-unbound', 'endpoints.retained_method_targets', retained, lambda a: a['scene'].update(underlay_evidence={}))


def local_cases():
    rows, obs, scene, core, palette = world()
    target_box = box(scene['grids'][0]['cells'][1]);rows[3][7] = 6
    target = {'source_cell': [0, 1], 'source_bbox': target_box, 'cell_pixels': patch(rows, target_box), 'level_epoch': 1, 'endpoint_role': 'unknown', 'observed_at': 'obs:endpoint', 'source_entity': {'signature': 'appearance:one'}, 'source_entities': [{'signature': 'appearance:one'}]}
    body = [7, 3, 7, 3];p = proposal(scene, core, target, 'endpoint_approach_candidate', scene['body'], body)
    second = clone(rows);put(second, scene['body'], 0);put(second, body, 9)
    after = {**clone(obs), 'observation_ref': 'obs:after', 'entities': [{**clone(obs['entities'][0]), 'bbox': body}]}
    source_box = box(scene['grids'][0]['cells'][0]);under = {'epoch': 1, 'cell_bbox': source_box, 'patch': [[0] * 3 for _ in range(3)], 'evidence': ['obs:entry-before', 'obs:entry-after']}
    args = {'memories': [target], 'methods': [], 'proposal': p, 'index': 0, 'before': obs, 'after': after, 'first': rows, 'second': second, 'outcome': {'matched': True, 'body_position_matched': True, 'preservation_matched': None}, 'underlays': [[scene['body'], under]]}
    arrived = record('contact:distinct-unchanged-arrival-with-entered-support', 'local_contact.reconcile', args, True)['after']['memories']
    changed = clone(args);changed['second'][2][6] = 4;changed['outcome'].update(matched=False, remote_effects={'unexplained': 1})
    record('contact:changed-arrival-keeps-discrepancy', 'local_contact.reconcile', changed, True)
    change('contact:position-not-matched', 'local_contact.reconcile', args, lambda a: a['outcome'].update(body_position_matched=False))
    change('contact:scope-boundary', 'local_contact.reconcile', args, lambda a: a['after'].update(level_epoch=2))
    change('contact:stale-underlay', 'local_contact.reconcile', args, lambda a: a['underlays'][0][1].update(epoch=0), True)
    scene_at = {**clone(scene), 'body': body, 'observation_ref': after['observation_ref']}
    targets = {'scene': scene_at, 'obs': after, 'rows': second, 'memories': arrived, 'methods': [], 'prior': PRIOR}
    offered = record('contact:current-local-probe', 'local_contact.targets', targets, True)['value']
    known = {'status': 'observed_local_operator_change', 'action': {'action_ref': 'ACTION7'}, 'evidence': ['obs:known-local']}
    change('contact:recalled-local-operator', 'local_contact.targets', targets, lambda a: a.update(methods=[known]), True)
    change('contact:ambiguous-operator', 'local_contact.targets', targets, lambda a: a.update(methods=[known, {**known, 'action': {'action_ref': 'ACTION5'}}]))
    change('contact:already-attempted', 'local_contact.targets', targets, lambda a: a['memories'][0].update(contact_attempted={'after': 'obs:prior-attempt'}))
    change('contact:current-pixels-differ', 'local_contact.targets', targets, lambda a: a['rows'][2].__setitem__(6, 4))
    change('contact:pending-context', 'local_contact.targets', targets, lambda a: a['memories'][0]['arrival'].update(context_question_pending={'context_key': 'pending'}))
    local_p = proposal(scene_at, core, offered[0][2], 'local_contact_probe_candidate', body, None, 'ACTION5')
    local_first = clone(second);local_second = clone(second);local_second[2][6] = 5
    operator = {'memories': arrived, 'methods': [], 'proposal': local_p, 'index': 0, 'before': after, 'after': {**clone(after), 'observation_ref': 'obs:operator'}, 'first': local_first, 'second': local_second, 'outcome': {'preservation_matched': True}, 'underlays': []}
    record('contact:operator-change-acquired', 'local_contact.reconcile', operator, True)
    change('contact:operator-unsupported', 'local_contact.reconcile', operator, lambda a: a['outcome'].update(preservation_matched=False), True)
    change('contact:operator-no-visible-effect', 'local_contact.reconcile', operator, lambda a: a.update(second=a['first']), True)
    change('contact:operator-remote-effect', 'local_contact.reconcile', operator, lambda a: a['second'][10].__setitem__(10, 7), True)
    change('contact:bounded-method-history', 'local_contact.reconcile', operator, lambda a: a.update(methods=[{'old': i} for i in range(20)]), True)
    departure = {'scene': scene_at, 'obs': after, 'rows': second, 'memories': arrived, 'equivalence': None}
    record('departure:current-entered-support', 'local_contact.departure_support', departure, True)
    change('departure:two-competing-witnesses', 'local_contact.departure_support', departure, lambda a: a['memories'].append(clone(a['memories'][0])))
    a = clone(departure);other = clone(arrived[0]);other.update(source_entity={'signature': 'appearance:other'}, source_entities=[{'signature': 'appearance:other'}], observed_at='obs:alternative');a['memories'].append(other);a['equivalence'] = CONFIG['equivalent_departure_witnesses']
    record('departure:equivalent-description-witnesses', 'local_contact.departure_support', a, True)
    change('departure:non-equivalent-role', 'local_contact.departure_support', a, lambda a: a['memories'][1].update(endpoint_role='different'))
    change('departure:stale-source-patch', 'local_contact.departure_support', departure, lambda a: a['rows'][2].__setitem__(2, 3))
    change('departure:refuted-contact', 'local_contact.departure_support', departure, lambda a: a['memories'][0].update(contact_attempted={'other_compositions_preserved': False}))
    option = {'kind': 'local_contact_probe_candidate', 'target': offered[0][2], 'scene': scene_at, 'steps': local_p['steps'], 'financing': {'status': 'unmeasured'}, 'core': core}
    opt2 = clone(option);opt2['target'].update(source_entity={'signature': 'appearance:other'}, source_entities=[{'signature': 'appearance:other'}], observed_at='obs:other-description')
    equivalent = {'options': [option, opt2], 'declaration': CONFIG['equivalent_contact_offers']}
    record('contact-equivalence:descriptions-preserved', 'local_contact.equivalent_current_contact_offers', equivalent, True)
    change('contact-equivalence:resource-differs', 'local_contact.equivalent_current_contact_offers', equivalent, lambda a: a['options'][1]['financing'].update(status='different'), True)
    change('contact-equivalence:stale-arrival', 'local_contact.equivalent_current_contact_offers', equivalent, lambda a: a['options'][1]['target']['arrival'].update(evidence=['obs:old']), True)
    return rows, obs, scene, core


def context_cases():
    rows, obs, scene, core, palette = world()
    site = box(scene['grids'][0]['cells'][0]);remote_boxes = [box(scene['grids'][0]['cells'][i]) for i in (1, 2)]
    for i, bbox in enumerate(remote_boxes):rows[bbox[1] + 1][bbox[0] + 1] = 5 + i
    scene['support_effect_scope'] = {'bbox': [2, 2, 16, 12]}
    target = {'source_cell': [0, 0], 'source_bbox': site, 'level_epoch': 1}
    p = proposal(scene, core, target, 'local_contact_probe_candidate', scene['body'], None, 'ACTION5')
    second = clone(rows)
    for bbox in remote_boxes:put(second, bbox, 4)
    after = {**clone(obs), 'observation_ref': 'obs:context-after'}
    args = {'methods': [], 'proposal': p, 'index': 0, 'before': obs, 'after': after, 'first': rows, 'second': second, 'maximum_regions': 16}
    captured = record('context:multi-region-association', 'context_intervention.record', args, True)
    methods = captured['after']['methods'];association = methods[0]
    change('context:duplicate-association', 'context_intervention.record', args, lambda a: a.update(methods=methods))
    change('context:region-limit', 'context_intervention.record', args, lambda a: a.update(maximum_regions=1))
    one_region = clone(args)
    l, t, r, b = remote_boxes[1]
    for y in range(t, b + 1):
        for x in range(l, r + 1):one_region['second'][y][x] = rows[y][x]
    record('context:only-one-region', 'context_intervention.record', one_region)
    change('context:site-anchor-changed', 'context_intervention.record', args, lambda a: a['second'][2].__setitem__(2, 5))
    change('context:control-moved', 'context_intervention.record', args, lambda a: put(a['second'], scene['body'], 0))
    change('context:scope-changed', 'context_intervention.record', args, lambda a: a['after'].update(level_epoch=2))
    change('context:no-domain', 'context_intervention.record', args, lambda a: a['proposal']['inventory_plan']['offer']['scene'].pop('support_effect_scope'))
    change('context:bounded-association-history', 'context_intervention.record', args, lambda a: a.update(methods=[{'id': f'old:{i}'} for i in range(20)]), True)
    memories = [{'source_bbox': b, 'cell_pixels': patch(rows, b), 'level_epoch': 1} for b in remote_boxes]
    current_scene = {**clone(scene), 'observation_ref': after['observation_ref']}
    targets = {'scene': current_scene, 'obs': after, 'rows': second, 'memories': memories, 'methods': methods, 'ordinary_targets': []}
    candidates = record('context:current-unexamined-question', 'context_intervention.targets', targets, True)['value']
    change('context:ordinary-contribution-exists', 'context_intervention.targets', targets, lambda a: a.update(ordinary_targets=[{'current': True}]))
    change('context:already-examined-regions', 'context_intervention.targets', targets, lambda a: [m.update(contact_attempted={'after': 'obs:examined'}) for m in a['memories']])
    change('context:other-scope', 'context_intervention.targets', targets, lambda a: a['obs'].update(level_epoch=2))
    change('context:operator-unavailable', 'context_intervention.targets', targets, lambda a: a['obs'].update(available_action_refs=['ACTION1']))
    question = candidates[0][2]['context_question']
    change('context:same-context-already-tried', 'context_intervention.targets', targets, lambda a: a['methods'][0].update(attempts=[{'context_key': question['context_key']}] ))
    change('context:unchanged-visible-overlap-already-tried', 'context_intervention.targets', targets, lambda a: a['methods'][0].update(attempts=[{'context_key': 'older-key', 'context_visible_samples': [[6, 2, 4], [10, 2, 4]]}]))
    qproposal = proposal(current_scene, core, candidates[0][2], 'context_reconfiguration_candidate', scene['body'], None, 'ACTION5')
    probe = {'methods': methods, 'proposal': qproposal, 'index': 0, 'before': after, 'after': {**clone(after), 'observation_ref': 'obs:context-return'}, 'first': second, 'second': rows, 'maximum_regions': 16}
    returned = record('context:actual-question-return', 'context_intervention.record', probe, True)
    change('context:unchanged-question-return', 'context_intervention.record', probe, lambda a: a.update(second=a['first']), True)
    change('context:bounded-attempt-history', 'context_intervention.record', probe, lambda a: a['methods'][0].update(attempts=[{'old': i} for i in range(20)]), True)
    change('context:missing-association', 'context_intervention.record', probe, lambda a: a.update(methods=[]))
    record('context:decorate-local-question', 'context_intervention.decorate', {'proposal': qproposal, 'obs': after})
    change('context:decorate-approach-only', 'context_intervention.decorate', {'proposal': qproposal, 'obs': after}, lambda a: a['proposal']['steps'][0].update(expected_after={'body_bbox': scene['body']}))
    change('context:decorate-without-question', 'context_intervention.decorate', {'proposal': qproposal, 'obs': after}, lambda a: a['proposal']['inventory_plan']['offer']['target'].pop('context_question'))
    samples = {'attempt': {'context_visible_samples': [[3, 3, 0], [6, 2, 4]]}, 'rows': second, 'body': scene['body']}
    record('context:visible-overlap-excludes-moving-body', 'context_intervention.unchanged_visible_context', samples, True)
    change('context:no-visible-sample', 'context_intervention.unchanged_visible_context', samples, lambda a: a['attempt'].update(context_visible_samples=[[3, 3, 0]]))
    change('context:visible-context-changed', 'context_intervention.unchanged_visible_context', samples, lambda a: a['rows'][2].__setitem__(6, 5))
    arrival_memory = {'source_cell': [0, 0], 'source_bbox': site, 'level_epoch': 1, 'arrival': {'current_pixels': patch(second, site), 'evidence': ['obs:entered', 'obs:context-after'], 'entered_support': {'evidence': ['obs:old-entry']}, 'context_question_pending': question}}
    local_return = {'memories': [arrival_memory], 'methods': methods, 'proposal': qproposal, 'index': 0, 'before': after, 'after': probe['after'], 'first': second, 'second': rows, 'outcome': {'preservation_matched': True}, 'underlays': []}
    record('contact:context-return-retains-original-arrival', 'local_contact.reconcile', local_return)
    change('contact:unmatched-context-return', 'local_contact.reconcile', local_return, lambda a: a['memories'][0]['arrival']['context_question_pending'].update(context_key='other'))
    change('contact:changed-context-contact-site', 'local_contact.reconcile', local_return, lambda a: a['second'][2].__setitem__(2, 5))


def endpoint_cases():
    # Real original component extraction, lattice projection and V5 BFS produce
    # the endpoint routes. The small synthetic image contains a hollow control,
    # a peripheral L-shaped signature and a complementary cell. No route or
    # endpoint expected value is authored or mocked.
    for dx, dy, palette in [(0, 0, list(range(16))), (2, 1, list(range(16))), (0, 0, [(i + 7) % 16 for i in range(16)])]:
        rows = [[palette[0]] * (20 + dx) for _ in range(20 + dy)]
        for y in range(4):
            for x in range(20):rows[y + dy][x + dx] = palette[8]
        for x, y in [(1, 1), (2, 1), (1, 2)]:rows[y + dy][x + dx] = palette[4]
        for y in range(5):
            for x in range(5):
                if (x, y) not in [(1, 1), (2, 1), (1, 2)]:rows[10 + y + dy][10 + x + dx] = palette[4]
        for y in range(6, 9):
            for x in range(6, 9):
                if x in (6, 8) or y in (6, 8):rows[y + dy][x + dx] = palette[9]
        entities = []
        measured_components = detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows), connectivity=4))
        for component in measured_components.components:
            entities.append({'signature': 'synthetic:' + component.component_id, 'palette_value': component.value,
                'bbox': [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom],
                'area': component.area, 'mask': [[x, y] for y, x in component.relative_pixels], 'identity_ambiguous': False})
        body = next(e for e in entities if e['palette_value'] == palette[9])
        obs = {'observation_ref': 'obs:endpoint-current', 'level_epoch': 1, 'levels_completed': 0,
               'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'], 'entities': entities}
        tracker = project.CellProjection();tracker.epoch = 1;tracker.core = body['signature']
        tracker.controls = {a: {'delta': delta, 'evidence': [['obs:prior', obs['observation_ref']]], 'contradictions': []}
                            for a, delta in [('ACTION4', [5, 0]), ('ACTION2', [0, 5])]}
        tracker.last_motion = {'after': obs['observation_ref'], 'command': 'ACTION4', 'delta': [5, 0]}
        tracker.underlays = {tuple(body['bbox']): {'values': [palette[0]], 'epoch': 1, 'evidence': ['obs:entry'],
            'cell_bbox': [5 + dx, 5 + dy, 9 + dx, 9 + dy], 'patch': [[palette[0]] * 5 for _ in range(5)]}}
        scene, probe = tracker.measure_with_input(obs, rows)
        assert probe is not None and len(scene['grids']) == 1
        args = {'scene': scene, 'probe': plain(probe), 'obs': obs, 'rows': rows, 'forecast': None, 'returned': None, 'visited': [], 'interfaces': DIRECTIONS}
        label = f'{dx}:{dy}:{palette[0]}'
        record('endpoint:original-measured-probe:' + label, 'endpoints.endpoint_measurements', args, True)
        change('endpoint:missing-probe:' + label, 'endpoints.endpoint_measurements', args, lambda a: a.update(probe=None))
        change('endpoint:returned-scope-mismatch:' + label, 'endpoints.endpoint_measurements', args, lambda a: a.update(returned={'level_epoch': 0}))
        change('endpoint:no-grid:' + label, 'endpoints.endpoint_measurements', args, lambda a: a['scene'].update(grids=[]))
        change('endpoint:uncontained-control:' + label, 'endpoints.endpoint_measurements', args, lambda a: a['scene'].update(body=[-2, -2, -1, -1]))
        change('endpoint:forecast-and-visited:' + label, 'endpoints.endpoint_measurements', args,
            lambda a: a.update(forecast={'level_epoch': 1, 'observation_ref': obs['observation_ref'], 'steps_before_empty': 8}, visited=[[body['bbox'], {}]]), True)
        change('endpoint:resource-budget-one:' + label, 'endpoints.endpoint_measurements', args,
            lambda a: a.update(forecast={'level_epoch': 1, 'observation_ref': obs['observation_ref'], 'steps_before_empty': 1}), True)
        change('endpoint:stale-forecast:' + label, 'endpoints.endpoint_measurements', args,
            lambda a: a.update(forecast={'level_epoch': 1, 'observation_ref': 'obs:old', 'steps_before_empty': 1}), True)
        change('endpoint:unique-entity-correspondence:' + label, 'endpoints.endpoint_measurements', args,
            lambda a: [e.update(identity_ambiguous=True) for e in a['obs']['entities'] if e['palette_value'] == palette[0]], True)
        change('endpoint:no-current-directional-input:' + label, 'endpoints.endpoint_measurements', args, lambda a: a['probe'].update(available_action_refs=['ACTION5']))


def main():
    sys.setprofile(verified.source_profile)
    blocked = routing_cases()
    dependency_cases(blocked)
    boundary_cases()
    access_and_retained_cases()
    local_cases()
    context_cases()
    endpoint_cases()
    sys.setprofile(None)
    # Manifest verification is a separate byte-integrity inventory, not a
    # claim that all verified source modules were consumed by these helpers.
    verified.AUDIT_ACTIVE = False
    try:
        verified_after = verified.verify_source_manifest()
    finally:
        verified.AUDIT_ACTIVE = True
    assert verified_after == verified.VERIFIED_SOURCE
    owned = [SOURCE_BASE + name + '.py' for name in MODULES]
    fixture = {'schema': 'logos-engine.v6.inventory-helpers-reference.v1', 'referenceCommit': verified.COMMIT,
               'sourceHashes': verified.VERIFIED_SOURCE, 'verifiedSourceFilesBefore': len(verified.VERIFIED_SOURCE), 'verifiedSourceFilesAfter': len(verified_after),
               'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
               'ownedSourceModules': owned,
               'ownedSourceBytes': {name: {'bytes': (verified.SOURCE / name).stat().st_size, 'sha256': verified.VERIFIED_SOURCE[name]} for name in owned},
               'scope': 'Seven consumed ObservedInventory helpers on synthetic JSON raster/record domains, including returned values and complete argument mutation snapshots; original V5 endpoint measurement is called directly, never mocked. No game efficacy, full caller parity or Python coercion/nominal identity is asserted.',
               'sourceFootprint': verified.source_footprint(), 'operationCounts': dict(Counter(row['operation'] for row in CASES)), 'cases': CASES}
    out = ROOT / 'tests/fixtures/v6-inventory-helpers-reference.json.gz'
    out.write_bytes(gzip.compress((json.dumps(fixture, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'cases': len(CASES), 'operationCounts': fixture['operationCounts'], 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'sourceFilesVerified': len(verified_after)}, indent=2))


if __name__ == '__main__':
    main()
