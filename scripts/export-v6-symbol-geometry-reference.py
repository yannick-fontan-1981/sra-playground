#!/usr/bin/env python3
"""Execute unchanged pinned Python on generated public symbol rasters.

No native module supplies expected geometry, identities, facts or errors. The
fixture is an offline, bounded geometry contract; it does not assert a live
game result, family decision parity or a universal interpretation of a glyph.
Run only outside coordinated measurement windows. Importing this file exposes
the raster builders without importing or executing the reference agent.
"""
from __future__ import annotations

import argparse
from collections import Counter
from collections.abc import Mapping
from copy import deepcopy
from dataclasses import asdict, is_dataclass
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
OWNED = [
    'agents/yf_arc3_v5/capabilities/concentric_frames.py',
    'agents/yf_arc3_v5/capabilities/symbolic_diagrams.py',
    'agents/yf_arc3_v6/morphology_policy/symbol_transactions/geometry.py',
]


def blank(width=60, height=36, value=9):
    return [[value] * width for _ in range(height)]


def fill(rows, x, y, width, height, value):
    for row in range(y, y + height):
        for col in range(x, x + width):
            rows[row][col] = value


def perimeter(rows, x, y, width, height, value):
    for row in range(y, y + height):
        for col in range(x, x + width):
            if row in (y, y + height - 1) or col in (x, x + width - 1):
                rows[row][col] = value


def branch(rows, x, y, width, height, value):
    fill(rows, x + width - 1, y, 1, height, value)
    fill(rows, x, y + height // 2, width, 1, value)


def diagram(rows, x=2, y=2, left=(3, 4), right=(6,), size=3, branch_value=7,
            border_value=8, touch_first=False):
    step = size + 2
    branch_x = x + 3 + len(left) * step + 1
    right_x = branch_x + size + 3
    width = right_x - x + len(right) * step + 5
    perimeter(rows, x, y, width, size + 6, border_value)
    for index, value in enumerate(left):
        px = x + 1 if index == 0 and touch_first else x + 3 + index * step
        fill(rows, px, y + 3, size, size, value)
    branch(rows, branch_x, y + 3, size, size, branch_value)
    for index, value in enumerate(right):
        fill(rows, right_x + index * step, y + 3, size, size, value)
    return {'bbox': [x, y, x + width - 1, y + size + 5], 'branch': [branch_x, y + 3]}


def framed_square(rows, x, y, inner, outer=0, size=5, glyph_size=3):
    perimeter(rows, x, y, size, size, outer)
    padding = (size - glyph_size) // 2
    fill(rows, x + padding, y + padding, glyph_size, glyph_size, inner)


def guide_raster(dx=0, dy=0):
    rows = blank(60 + dx, 36 + dy)
    diagram(rows, 2 + dx, 2 + dy)
    framed_square(rows, 40 + dx, 18 + dy, 5, size=9, glyph_size=3)
    return rows


def compact_diagram(rows, x, y):
    perimeter(rows, x, y, 12, 5, 8)
    fill(rows, x + 1, y + 1, 3, 3, 3)
    branch(rows, x + 5, y + 1, 2, 3, 7)
    fill(rows, x + 8, y + 1, 3, 3, 6)


def build_scenes():
    scenes = {'guide_asymmetric': guide_raster(), 'guide_translated': guide_raster(3, 2)}
    recolor = {9: 12, 8: 13, 3: 6, 4: 7, 6: 2, 7: 3, 5: 11, 0: 0}
    scenes['guide_recolored'] = [[recolor[v] for v in row] for row in guide_raster()]
    rows = guide_raster(); framed_square(rows, 40, 2, 4, size=9, glyph_size=3)
    scenes['guide_two_white'] = rows
    rows = blank(); diagram(rows, left=(8, 4), touch_first=True)
    scenes['diagram_touching_perimeter'] = rows
    rows = blank(); perimeter(rows, 0, 0, 35, 13, 11); diagram(rows)
    scenes['diagram_nested_perimeter'] = rows
    rows = blank(64, 42); diagram(rows, left=(3, 3), right=(6, 6)); diagram(rows, 2, 15, left=(3, 3), right=(6, 6))
    scenes['diagram_duplicate_rows'] = rows
    rows = blank(64, 40); diagram(rows); diagram(rows, 2, 15, left=(6,), right=(4,), size=5)
    fill(rows, 44, 4, 3, 3, 3); perimeter(rows, 43, 17, 5, 5, 3); perimeter(rows, 51, 18, 3, 3, 3)
    framed_square(rows, 43, 28, 3); framed_square(rows, 53, 28, 6)
    scenes['diagram_mixed_extents'] = rows
    rows = blank(32, 16); framed_square(rows, 3, 4, 3, 6); framed_square(rows, 14, 4, 4, 6)
    scenes['tight_pair'] = rows
    rows = deepcopy(rows); framed_square(rows, 23, 4, 5, 6); scenes['tight_three_ambiguous'] = rows
    rows = blank(18, 15); framed_square(rows, 4, 3, 3, size=5, glyph_size=1)
    scenes['singleton_does_not_establish_spacing'] = rows
    rows = blank(18, 15); perimeter(rows, 3, 2, 9, 9, 0); fill(rows, 5, 5, 3, 3, 3)
    scenes['unequal_inner_gaps'] = rows
    rows = blank(32, 18); framed_square(rows, 11, 4, 3)
    fill(rows, 2, 6, 3, 1, 4); fill(rows, 22, 6, 7, 1, 6); fill(rows, 9, 9, 9, 1, 7)
    scenes['added_tight_peer_spans'] = rows
    for count in (32, 33):
        rows = blank(38, 38)
        for index in range(count):
            framed_square(rows, 1 + index % 6 * 6, 1 + index // 6 * 6, 3 + index % 3, 8, 4, 2)
        scenes['concentric_' + str(count)] = rows
    scenes['area_over_bound'] = blank(65, 65)
    scenes['components_over_bound'] = [[(x + y) % 2 + 3 for x in range(24)] for y in range(24)]
    for count in (16, 17):
        rows = blank(44, 44)
        for index in range(count):
            compact_diagram(rows, 1 + index % 3 * 14, 1 + index // 3 * 7)
        scenes['diagram_rows_' + str(count)] = rows
    for count in (4, 5):
        rows = blank(); diagram(rows, left=tuple(3 + index % 2 for index in range(count)))
        scenes['diagram_group_' + str(count)] = rows
    rows = blank(64, 42); diagram(rows, left=(3, 3), right=(6, 6))
    framed_square(rows, 5, 28, 3, 2); framed_square(rows, 16, 28, 3, 2)
    scenes['transition_before'] = rows
    for count in (0, 1, 2):
        after = deepcopy(rows); fill(after, 6, 29, 3, 3, 5); fill(after, 17, 29, 3, 3, 5)
        for index in range(count):
            fill(after, 29 + index * 7, 29, 3, 3, 6)
        scenes['transition_outputs_' + str(count)] = after
    after = deepcopy(rows); fill(after, 6, 29, 3, 3, 6); fill(after, 17, 29, 3, 3, 6)
    scenes['transition_inside_pair_only'] = after
    duplicated = deepcopy(rows); diagram(duplicated, 2, 15, left=(3, 3), right=(6, 6))
    scenes['transition_duplicate_before'] = duplicated
    after = deepcopy(duplicated); fill(after, 6, 29, 3, 3, 5); fill(after, 17, 29, 3, 3, 5)
    fill(after, 29, 29, 3, 3, 6); fill(after, 36, 29, 3, 3, 6)
    scenes['transition_duplicate_after'] = after
    before = blank(60, 36); diagram(before); framed_square(before, 5, 24, 4, 2); framed_square(before, 16, 24, 3, 2)
    after = deepcopy(before); fill(after, 6, 25, 3, 3, 5); fill(after, 17, 25, 3, 3, 5); fill(after, 29, 25, 3, 3, 6)
    scenes['transition_reversed_before'], scenes['transition_reversed_after'] = before, after
    scenes['blank'] = blank(12, 10)
    return scenes


def sha(data):
    return hashlib.sha256(data).hexdigest()


def proof(path):
    target = ROOT / path
    data = target.read_bytes()
    return {'path': path, 'bytes': len(data), 'sha256': sha(data)}


def plain(value):
    if value is None or type(value) in (bool, int, float, str):
        return value
    if is_dataclass(value):
        result = plain(asdict(value))
        if value.__class__.__name__ == 'ConcentricFrame':
            result.update(center=plain(value.center), identity=plain(value.identity))
        return result
    if hasattr(value, 'model_dump'):
        return plain(value.model_dump())
    if isinstance(value, Mapping):
        result = {str(key): plain(child) for key, child in value.items()}
        if set(result) == {'top', 'left', 'bottom', 'right'}:
            result.update(height=result['bottom'] - result['top'] + 1, width=result['right'] - result['left'] + 1)
        return result
    if isinstance(value, (tuple, list)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    raise TypeError('No reference projection for ' + str(type(value)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='tests/fixtures/v6-symbol-geometry-reference.json.gz')
    parser.add_argument('--replace', action='store_true')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / 'tests/fixtures') or not output.name.startswith('v6-symbol-geometry-reference'):
        raise ValueError('Only the owned symbol geometry fixture may be written')
    if output.exists() and not args.replace:
        raise FileExistsError(output)
    sys.dont_write_bytecode = True
    bytecode_lookup = tempfile.TemporaryDirectory(prefix='symbol-geometry-source-bytecode-')
    sys.pycache_prefix = bytecode_lookup.name
    manifest_path = 'reference/v6/' + COMMIT + '/manifest.json'
    manifest_record = proof(manifest_path)
    entries = json.loads((ROOT / manifest_path).read_text())['files']

    def verify_source():
        result = {}
        for relative, record in sorted(entries.items()):
            actual = sha((SOURCE / relative).read_bytes())
            if actual != record['sha256']:
                raise ValueError('Reference source differs: ' + relative)
            result[relative] = actual
        return result

    before = verify_source()
    opened, executed, code_keys = set(), Counter(), {}
    audit_active = True

    def audit(event, arguments):
        if audit_active and event == 'open' and arguments and isinstance(arguments[0], str):
            path = Path(arguments[0])
            if path.is_absolute() and path.is_relative_to(SOURCE) and path.is_file():
                opened.add(path.relative_to(SOURCE).as_posix())

    prefix = str(SOURCE) + '/'

    def profile(call, event, arg):
        if event != 'call':
            return
        code = call.f_code
        key = code_keys.get(code)
        if key is None:
            key = (code.co_filename[len(prefix):], code.co_firstlineno, code.co_qualname) if code.co_filename.startswith(prefix) else False
            code_keys[code] = key
        if key is not False:
            executed[key] += 1

    sys.addaudithook(audit)
    sys.path[:0] = [str(SOURCE / 'agents/yf_arc3_v6/laya_proto'), str(SOURCE)]
    concentric = importlib.import_module('agents.yf_arc3_v5.capabilities.concentric_frames')
    diagrams = importlib.import_module('agents.yf_arc3_v5.capabilities.symbolic_diagrams')
    geometry = importlib.import_module('agents.yf_arc3_v6.morphology_policy.symbol_transactions.geometry')
    observer = importlib.import_module('neutral_observer')
    config_path = SOURCE / 'agents/yf_arc3_v6/morphology_policy/symbol_transactions/transactions.drm'
    config = json.loads(config_path.read_text())['declarations'][0]['configuration']
    scenes = {key: {'rows': rows} for key, rows in build_scenes().items()}
    cases, outside_domain = [], []
    sys.setprofile(profile)

    def observe(name):
        value = scenes[name]
        if 'observation' not in value:
            rows = value['rows']
            public = SimpleNamespace(frame_rows=rows, frame_packet=[rows],
                frame_hash=sha(json.dumps(rows, separators=(',', ':')).encode())[:16],
                level=1, levels_completed=0, state='NOT_FINISHED', step_index=0,
                available_action_refs=('ACTION6',))
            value['observation'] = plain(observer.measure(public, 1, 'symbol-geometry-reference')[0])
        return deepcopy(value['observation'])

    def execute(operation, arguments):
        rows = scenes[arguments['scene']]['rows'] if 'scene' in arguments else None
        current = geometry.frame(rows) if rows is not None else None
        point = arguments.get('point')
        candidate = SimpleNamespace(point=tuple(point) if point is not None else None)
        if operation == 'frame':
            return current
        if operation == 'components':
            return diagrams._components(current)
        if operation == 'shape_predicates':
            return [{'component_ref': c.component_id, 'rectangular_perimeter': diagrams._rectangular_perimeter(c),
                     'solid_square': diagrams._solid_square(c), 'three_branch_to_left': diagrams._three_branch_to_left(c)}
                    for c in diagrams._components(current)]
        if operation == 'concentric_frames':
            return concentric.measure_concentric_frames(current)
        if operation in ('concentric_context', 'concentric_candidate'):
            frames = concentric.measure_concentric_frames(current)
            additions = tuple(tuple(item) for item in arguments.get('additions', []))
            raster = current if arguments.get('with_frame', True) else None
            if operation == 'concentric_context':
                return concentric.measure_concentric_context(frames, additions, arguments.get('white_value', 0), raster)
            return concentric.measure_concentric_candidate(frames, candidate, additions, arguments.get('white_value', 0), raster)
        if operation == 'diagram_rows':
            return diagrams.measure_diagram_rows(current)
        if operation == 'equal_row_pairs':
            return diagrams.measure_equal_row_pairs(current)
        if operation == 'diagram_context':
            return diagrams.measure_diagram_context(current, arguments.get('transition_count', 0))
        if operation == 'diagram_candidate':
            return diagrams.measure_diagram_candidate(current, candidate, arguments.get('white_value', 0))
        if operation == 'diagram_transition':
            return diagrams.measure_diagram_transition(geometry.frame(scenes[arguments['before']]['rows']),
                                                       geometry.frame(scenes[arguments['after']]['rows']))
        observation = deepcopy(arguments.get('observation', observe(arguments['scene'])))
        if operation == 'perimeter_entities':
            return geometry.perimeter_entities(observation, arguments.get('white_value', 0))
        if operation == 'project':
            return geometry.project(observation, rows, arguments['inputs'], config, arguments.get('transition_count', 0))
        raise ValueError('Unknown operation: ' + operation)

    def record(name, operation, arguments, expect_error=None):
        arguments = plain(arguments)
        old_arguments = deepcopy(arguments)
        case = {'id': name, 'operation': operation, 'arguments': arguments}
        try:
            value = execute(operation, arguments)
        except Exception as error:
            case['error'] = {'name': type(error).__name__, 'message': str(error)}
            if expect_error is None or case['error']['name'] != expect_error:
                raise
        else:
            if expect_error is not None:
                raise AssertionError(name + ': expected source rejection was not exercised')
            case['expected'] = plain(value)
        case['argumentsUnchanged'] = arguments == old_arguments
        assert case['argumentsUnchanged'], name
        cases.append(case)
        return case.get('expected')

    for name in ('guide_asymmetric', 'guide_translated', 'guide_recolored', 'guide_two_white', 'diagram_touching_perimeter',
                 'diagram_nested_perimeter', 'diagram_duplicate_rows', 'diagram_mixed_extents', 'tight_pair',
                 'tight_three_ambiguous', 'singleton_does_not_establish_spacing', 'unequal_inner_gaps', 'blank'):
        for operation in ('concentric_frames', 'diagram_rows', 'equal_row_pairs', 'diagram_context', 'shape_predicates'):
            record(name + '/' + operation, operation, {'scene': name, 'transition_count': 7})
    record('frame_contract', 'frame', {'scene': 'guide_asymmetric'})
    record('components_identity', 'components', {'scene': 'diagram_mixed_extents'})
    for name, point in [('guide_asymmetric', [22, 44]), ('guide_translated', [24, 47]),
                        ('guide_asymmetric', [44, 22]), ('diagram_mixed_extents', [5, 45]),
                        ('diagram_mixed_extents', [19, 45]), ('diagram_mixed_extents', None),
                        ('tight_pair', [6, 5]), ('tight_three_ambiguous', [6, 5])]:
        label = name + '/' + str(point)
        record(label + '/diagram_candidate', 'diagram_candidate', {'scene': name, 'point': point})
        record(label + '/concentric_candidate', 'concentric_candidate', {'scene': name, 'point': point})
    mixed = record('hollows_keep_sizes_and_global_tight_count', 'diagram_candidate', {'scene': 'diagram_mixed_extents', 'point': [5, 45]})
    assert mixed['diagram_point_full_matches_hollow_count'] == 2
    assert mixed['diagram_tight_white_center_count'] == 2
    assert len(record('two_equal_frames', 'equal_row_pairs', {'scene': 'tight_pair'})) == 1
    assert record('three_equal_frames_are_not_a_pair', 'equal_row_pairs', {'scene': 'tight_three_ambiguous'}) == []
    for count in (32, 33):
        measured = record('frame_bound_' + str(count), 'concentric_frames', {'scene': 'concentric_' + str(count)})
        assert len(measured) == (32 if count == 32 else 0)
    for name in ('area_over_bound', 'components_over_bound'):
        record(name + '/concentric', 'concentric_frames', {'scene': name}, 'ConcentricGeometryBoundExceeded')
        record(name + '/diagram', 'diagram_rows', {'scene': name}, 'ValueError')
    assert len(record('sixteen_rows_retained', 'diagram_rows', {'scene': 'diagram_rows_16'})) == 16
    record('seventeenth_row_rejected', 'diagram_rows', {'scene': 'diagram_rows_17'}, 'ValueError')
    record('four_group_items_retained', 'diagram_rows', {'scene': 'diagram_group_4'})
    record('fifth_group_item_rejected', 'diagram_rows', {'scene': 'diagram_group_5'}, 'ValueError')
    current = geometry.frame(scenes['added_tight_peer_spans']['rows'])
    added = [f.identity for f in concentric.measure_concentric_frames(current) if f.outer_value == 0 and f.maximum_equal_padding == 1]
    assert len(added) == 1
    for with_frame in (False, True):
        record('added_tight_context/' + str(with_frame), 'concentric_context',
               {'scene': 'added_tight_peer_spans', 'additions': added, 'with_frame': with_frame})
    for point in ([6, 3], [6, 24], [6, 13], None, [30, 2]):
        record('added_tight_candidate/' + str(point), 'concentric_candidate',
               {'scene': 'added_tight_peer_spans', 'additions': added, 'point': point})
    for count in (0, 1, 2):
        matched = record('output_multiplicity_' + str(count), 'diagram_transition',
                         {'before': 'transition_before', 'after': 'transition_outputs_' + str(count)})
        assert matched == (1 if count == 2 else 0)
    assert record('outputs_inside_operand_frames_excluded', 'diagram_transition',
                  {'before': 'transition_before', 'after': 'transition_inside_pair_only'}) == 0
    assert record('duplicate_displayed_rows_count_twice', 'diagram_transition',
                  {'before': 'transition_duplicate_before', 'after': 'transition_duplicate_after'}) == 2
    assert record('operand_order_not_a_multiset', 'diagram_transition',
                  {'before': 'transition_reversed_before', 'after': 'transition_reversed_after'}) == 0
    record('unchanged_return', 'diagram_transition', {'before': 'transition_before', 'after': 'transition_before'})
    for name, xy in [('guide_asymmetric', [44, 22]), ('guide_translated', [47, 24]), ('guide_recolored', [44, 22])]:
        observation = observe(name)
        inputs = [{'action_ref': 'ACTION6', 'data': {'x': xy[0], 'y': xy[1]}}]
        record(name + '/perimeter', 'perimeter_entities', {'scene': name, 'observation': observation})
        projected = record(name + '/project', 'project', {'scene': name, 'observation': observation, 'inputs': inputs, 'transition_count': 3})
        assert projected['context']['three_branch_pair_left_row_count'] == 1
        assert projected['context']['spaced_rect_palette_white_count'] == 1
        assert len(projected['options']) == 1
        assert projected['options'][0]['entities'][0]['id'] != projected['options'][0]['point_entity']['id']
    observation = observe('guide_asymmetric')
    valid = {'action_ref': 'ACTION6', 'data': {'x': 44, 'y': 22}}
    inputs = [valid, {'action_ref': 'ACTION6', 'data': {'x': 22, 'y': 44}},
              {'action_ref': 'ACTION6', 'data': {'x': True, 'y': 22}},
              {'action_ref': 'ACTION6', 'data': {'x': 44.5, 'y': 22}},
              {'action_ref': 'ACTION6', 'data': {'x': 44, 'y': 22, 'extra': 0}},
              {'action_ref': 'ACTION6'}, deepcopy(valid)]
    assert len(record('input_filter_and_duplicate_order', 'project',
                      {'scene': 'guide_asymmetric', 'observation': observation, 'inputs': inputs})['options']) == 2
    # These cases document the excluded Python nominal/malformed-input domain.
    # They are never placed among the cross-language parity cases above.
    for name, data, explanation in [
        ('none_data', None, 'Python set(None) raises; native declines a missing/non-map point payload.'),
        ('integer_data', 0, 'Python set(0) raises; native declines a non-map point payload.'),
        ('list_data_with_point_names', ['x', 'y'], 'Python indexes the list with a string after set(data); native declines arrays.'),
        ('string_data_with_point_names', 'xy', 'Python indexes the string with a string after set(data); native declines strings.'),
        ('nominal_integral_float', {'x': 44.0, 'y': 22}, 'Python rejects nominal float44.0; JSON parsing in JavaScript cannot distinguish it from integer44.'),
    ]:
        raw = {'scene': 'guide_asymmetric', 'observation': deepcopy(observation),
               'inputs': [{'action_ref': 'ACTION6', 'data': data}]}
        captured = {'id': name, 'arguments': plain(raw), 'qualification': explanation,
                    'sourceDataType': type(data).__name__,
                    'sourceCoordinateTypes': {key: type(value).__name__ for key, value in data.items()} if isinstance(data, dict) else None}
        try:
            captured['sourceResult'] = plain(execute('project', raw))
        except Exception as error:
            captured['sourceError'] = {'name': type(error).__name__, 'message': str(error)}
        outside_domain.append(captured)
    at_point = [e for e in observation['entities'] if [44 - e['position'][0], 22 - e['position'][1]] in e['mask']]
    assert len(at_point) == 1
    ambiguous = deepcopy(observation); ambiguous['entities'].append(deepcopy(at_point[0]))
    assert record('ambiguous_point_entity_rejected', 'project',
                  {'scene': 'guide_asymmetric', 'observation': ambiguous, 'inputs': [valid]})['options'] == []
    absent = deepcopy(observation); absent['entities'] = [e for e in absent['entities'] if e['id'] != at_point[0]['id']]
    assert record('absent_point_entity_rejected', 'project',
                  {'scene': 'guide_asymmetric', 'observation': absent, 'inputs': [valid]})['options'] == []
    record('two_spaced_white_are_retained_for_DRM', 'project', {'scene': 'guide_two_white',
           'inputs': [valid, {'action_ref': 'ACTION6', 'data': {'x': 44, 'y': 6}}]})
    assert record('no_perimeter_returns_none', 'project', {'scene': 'blank', 'inputs': [valid]}) is None
    sys.setprofile(None)
    imported = {}
    for module in tuple(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if filename:
            path = Path(filename).resolve()
            if path.is_relative_to(SOURCE) and path.is_file():
                relative = path.relative_to(SOURCE).as_posix()
                imported[relative] = sha(path.read_bytes())
    audit_active = False
    assert set(opened) <= set(before)
    assert all(before[name] == digest for name, digest in imported.items())
    after = verify_source()
    assert before == after
    assert proof(manifest_path) == manifest_record
    assert all(any(path == owned and calls > 0 for (path, line, name), calls in executed.items()) for owned in OWNED)
    result = {
        'schema': 'logos-engine.v6.symbol-geometry-reference.v1', 'referenceCommit': COMMIT,
        'generator': proof('scripts/export-v6-symbol-geometry-reference.py'), 'sourceManifest': manifest_record,
        'verifiedSourceFilesBefore': len(before), 'verifiedSourceFilesAfter': len(after), 'sourceHashes': before,
        'ownedSourceModules': OWNED,
        'ownedSourceBytes': {name: {'bytes': (SOURCE / name).stat().st_size, 'sha256': before[name]} for name in OWNED},
        'sourceFootprint': {'importedSourceFiles': dict(sorted(imported.items())),
            'accessedSourceFiles': {name: before[name] for name in sorted(opened)},
            'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': calls}
                for (path, line, name), calls in sorted(executed.items())],
            'qualification': 'Imports, opened files and executed functions are distinct; imported modules are not thereby claimed fully translated.'},
        'config': config, 'scenes': scenes, 'cases': cases, 'outsidePortableInputDomain': outside_domain,
        'portableInputDomain': 'Validated public integer palette rasters and action JSON maps whose coordinate fields originate as integers. Boolean and non-integral numeric coordinates are rejected by both implementations; Python numeric nominal types and malformed non-map data are documented separately, without parity claims.',
        'operationCounts': dict(sorted(Counter(case['operation'] for case in cases).items())),
        'qualification': 'Generated public palette rasters; expected measurements and errors execute unchanged pinned Python only. Components, frame/model digests, coordinate order, multiplicities and all projected facts are retained. BoundingBox dimensions and ConcentricFrame center/identity are explicit projections of computed source properties. Native public integer palette and JSON record domain; no claim of arbitrary Python coercions, live game success, complete owner parity or timing.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    mode = 'wb' if args.replace else 'xb'
    with output.open(mode) as stream:
        with gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0) as compressed:
            compressed.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode())
    print(json.dumps({'schema': result['schema'], 'cases': len(cases), 'scenes': len(scenes),
                      'sourceFiles': len(before), 'output': output.relative_to(ROOT).as_posix()}))
    bytecode_lookup.cleanup()


if __name__ == '__main__':
    main()
