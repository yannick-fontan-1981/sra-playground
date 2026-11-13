#!/usr/bin/env python3
"""Compare retained public trajectories and inspect visual witnesses; no game execution."""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'docs/migration/native-campaigns-v46'
OUT = ROOT / 'docs/migration/native-campaigns-v47'
PUBLIC_FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(left, right): return packed(left) == packed(right)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def verify_proof(item): assert exact(item, proof(ROOT / item['path'])), item['path']
def packet_hash(packet):
    return hashlib.sha256(json.dumps({key: packet[key] for key in PUBLIC_FIELDS}, separators=(',', ':')).encode()).hexdigest()
def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)


def verify_inputs():
    paths = {'baselineCampaign': OLD / 'zipp-four-levels.json', 'baselineTrace': OLD / 'zipp-public-trace.json.gz',
        'baselineComparison': OLD / 'zipp-original-component-comparison.json', 'baselineManifest': OLD / 'source-manifest.json',
        'nativeCampaign': OUT / 'zipp-six-levels.json', 'nativeTrace': OUT / 'zipp-public-trace.json.gz',
        'nativeExecution': OUT / 'logs/execution-zipp.json', 'nativeManifest': OUT / 'source-manifest.json'}
    values = {key: load(path) for key, path in paths.items()}
    baseline, old_trace, old_comparison, old_source = [values[key] for key in ['baselineCampaign', 'baselineTrace', 'baselineComparison', 'baselineManifest']]
    assert old_comparison['status'] == baseline['status'] == old_trace['status'] == 'passed'
    for item in old_comparison['inputs'].values(): verify_proof(item)
    verify_proof(old_comparison['generator'])
    assert old_source['digest'] == baseline['source']['digest'] == old_trace['sourceDigest'] == old_comparison['nativeSourceDigest']
    assert old_source['digest'] == '793a6b2e57ffbab74e148b1170879cd720387cbe93a2af9977c6303e05c2e731'
    assert old_source['fileCount'] == 152 and digest(old_source['files']) == old_source['digest']
    assert baseline['final']['levelsCompleted'] == 4 and baseline['final']['actions'] == 53
    assert len(baseline['prefixes']) == 12 and len(old_trace['packets']) == 54
    campaign, trace, execution, source = [values[key] for key in ['nativeCampaign', 'nativeTrace', 'nativeExecution', 'nativeManifest']]
    assert campaign['game'] == trace['game'] == 'ZIPP' and campaign['targetLevels'] == 6
    assert campaign['status'] == trace['status'] and campaign['status'] in ('passed', 'failed')
    assert source['digest'] == digest(source['files']) and source['fileCount'] == len(source['files'])
    current = {p.relative_to(ROOT).as_posix(): sha(p)
        for directory in ['src/logos-engine', 'src/runtime'] for p in (ROOT / directory).rglob('*')
        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')}
    assert exact(source['files'], current), 'The complete current source must equal the frozen campaign source'
    assert exact(campaign['source'], source) and trace['sourceDigest'] == source['digest']
    assert campaign['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged']
    assert exact(execution['nativeSource'], source) and exact(execution['nativeSourceAfter'], source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['exitCode'] == (0 if campaign['status'] == 'passed' else 1)
    assert execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'ZIPP', '6', str(paths['nativeCampaign']), str(paths['nativeTrace'])]
    for key in ('report', 'trace', 'generator', 'output'): verify_proof(execution[key])
    assert execution['report']['path'] == paths['nativeCampaign'].relative_to(ROOT).as_posix()
    assert execution['trace']['path'] == paths['nativeTrace'].relative_to(ROOT).as_posix()
    log = gzip.decompress((ROOT / execution['output']['path']).read_bytes()).decode().splitlines()
    final_log = json.loads(log[-1])
    assert final_log['status'] == campaign['status'] and final_log['sourceDigest'] == source['digest']
    assert exact(final_log['final'], campaign['final']) and exact(final_log['boundaries'], campaign['boundaries'])
    assert final_log['failure'] == campaign['failure']
    assert exact(campaign['gameAssets'], baseline['gameAssets'])
    for name, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == expected
    assert not campaign['pythonAgentModules'] and campaign['final']['sessions'] == 1
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.17.0'
    assert campaign['final']['fullV6Parity'] is False
    assert campaign['budget']['levelActionCaps'] == [600] * 6 and campaign['budget']['activeSecondsPerLevel'] == 360
    assert len(trace['packets']) == len(campaign['actions']) + 1 == campaign['final']['actions'] + 1
    assert trace['packets'][0]['command'] is None
    assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
    for index, item in enumerate(trace['packets']):
        assert set(item['packet']) == set(PUBLIC_FIELDS)
        if not index: continue
        action, previous = campaign['actions'][index - 1], trace['packets'][index - 1]['packet']
        assert action['sequence'] == index and exact(item['command'], action['command'])
        assert packet_hash(item['packet']) == action['publicPacketSha256']
        assert action['levelBefore'] == previous['level'] and action['completedBefore'] == previous['levels_completed']
        assert action['levelAfter'] == item['packet']['level'] and action['completedAfter'] == item['packet']['levels_completed']
        assert action['state'] == item['packet']['state'] and action['frameHash'] == item['packet']['frame_hash']
        assert action['animationFrames'] == len(item['packet']['frame_packet'])
    assert trace['packets'][-1]['packet']['levels_completed'] == campaign['final']['levelsCompleted']
    assert trace['packets'][-1]['packet']['state'] == campaign['final']['state']
    assert sum(p['acquiredActions'] for p in campaign['prefixes']) == campaign['final']['actions']
    assert campaign['final']['caller']['acquiredTransitions'] == campaign['final']['actions']
    assert campaign['final']['operationCounts']['advance'] == campaign['final']['actions']
    return values, {key: proof(path) for key, path in paths.items()}


def compare_prefix(baseline, old_trace, campaign, trace):
    checks = []
    for index, left in enumerate(old_trace['packets']):
        right = trace['packets'][index]
        assert exact(left, right), f'Unnormalized public command or packet changed at index {index}'
        checks.append({'packetIndex': index, 'rawExact': True, 'packetSha256': digest(right['packet']),
                       'animationFrames': len(right['packet']['frame_packet'])})
    assert [b['totalActions'] for b in campaign['boundaries'][:4]] == [b['totalActions'] for b in baseline['boundaries']] == [8, 23, 38, 53]
    old_prefixes, new_prefixes = baseline['prefixes'], campaign['prefixes'][:12]
    old_session = OBSERVATION_REF.fullmatch(old_prefixes[0]['traceField']['plan']['observation_ref'])[1]
    new_session = OBSERVATION_REF.fullmatch(new_prefixes[0]['traceField']['plan']['observation_ref'])[1]
    assert old_session != new_session
    old_strings, new_strings = set(strings(old_prefixes)), set(strings(new_prefixes))
    mapping, normalizations = {}, []
    for index, entry in enumerate(old_trace['packets']):
        packet = entry['packet']; suffix = f":epoch:{packet['level']}:revision:{index + 1}:frame:{packet['frame_hash']}"
        left, right = old_session + suffix, new_session + suffix
        assert left in old_strings and right in new_strings
        mapping[left] = right
        normalizations.append({'kind': 'actual_observation_session_namespace', 'packetIndex': index, 'source': left, 'native': right})
    for index, (left, right) in enumerate(zip(old_prefixes, new_prefixes)):
        a, b = left['traceField']['plan'], right['traceField']['plan']
        assert exact(a['scene'], b['scene']) and 'native_support_discrimination' not in b['scene']
        old_request, new_request = ['trace:' + digest([plan['observation_ref'], plan['scene']]) for plan in (a, b)]
        for plan, request in [(a, old_request), (b, new_request)]:
            assert plan['estimate']['receipt']['scope']['request_ref'] == request
            assert plan['estimate']['receipt']['descriptive_facts']['request_ref'] == request
        mapping[old_request] = new_request
        normalizations.append({'kind': 'mechanical_request_digest_recomputed_from_exact_scene_and_observation',
                               'prefixIndex': index, 'source': old_request, 'native': new_request})
    def normalized(value):
        if isinstance(value, str):
            if value.startswith(old_session + ':'): assert value in mapping, value
            return mapping.get(value, value)
        if isinstance(value, dict): return {key: normalized(child) for key, child in value.items()}
        if isinstance(value, list): return [normalized(child) for child in value]
        return value
    prefix_checks, old_evidence, new_evidence = [], {}, {}
    for index, (left, right) in enumerate(zip(old_prefixes, new_prefixes)):
        assert left['decisionRevision'] == right['decisionRevision']
        for key in ['acquiredActions', 'family', 'operations', 'proposalKind', 'fieldSubquestion', 'callerAcquiredTransitions']:
            assert exact(left[key], right[key]), (index, key)
        assert exact(normalized(left['traceField']), right['traceField']), f'Complete trace plan {index}'
        old_event, new_event = [p['sharedSeries']['traceFieldLatestExtension'] for p in (left, right)]
        assert exact(normalized(old_event), new_event), f'Latest actual Kernel event {index}'
        assert left['sharedSeries']['traceFieldExtensionCount'] == right['sharedSeries']['traceFieldExtensionCount']
        for event, evidence in [(normalized(old_event), old_evidence), (new_event, new_evidence)]:
            for item in [*event['state']['successes'], *event['state']['failures'], event['transition']]:
                if item['after_ref'] in evidence: assert exact(evidence[item['after_ref']], item)
                evidence[item['after_ref']] = item
        prefix_checks.append({'prefixIndex': index, 'firstAction': right['decisionRevision'],
            'acquiredActions': right['acquiredActions'], 'scopeNormalizedCompletePlanExact': True,
            'scopeNormalizedLatestKernelEventExact': True, 'planSha256': digest(right['traceField']['plan']),
            'latestKernelEventSha256': digest(new_event)})
    assert len(old_evidence) == len(new_evidence) == 53 and exact(old_evidence, new_evidence)
    return {'rawExactCommands': 53, 'rawExactPackets': 54, 'animationFramesIncludingInitial': sum(x['animationFrames'] for x in checks),
        'scopeNormalizedCompletePlans': 12, 'scopeNormalizedLatestKernelEvents': 12, 'scopeNormalizedRetainedTransitions': 53,
        'publicNormalizations': [], 'publicChecks': checks, 'internalNormalizations': normalizations, 'prefixChecks': prefix_checks,
        'notCompared': ['complete graph identity', 'hashed proposal/composition IDs', 'full inherited family digest', 'elapsed time or speed',
                        'original full common caller parity', 'complete Kernel event at every intermediate action']}


def components(rows):
    height, width = len(rows), len(rows[0]); assert all(len(row) == width for row in rows)
    unseen = {(x, y) for y in range(height) for x in range(width)}; result = []
    while unseen:
        first = min(unseen, key=lambda p: (p[1], p[0])); color = rows[first[1]][first[0]]
        pending, pixels = [first], []; unseen.remove(first)
        while pending:
            x, y = pending.pop(); pixels.append((x, y))
            for neighbor in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]:
                if neighbor in unseen and rows[neighbor[1]][neighbor[0]] == color:
                    unseen.remove(neighbor); pending.append(neighbor)
        result.append({'bbox': [min(x for x, _ in pixels), min(y for _, y in pixels), max(x for x, _ in pixels), max(y for _, y in pixels)],
                       'area': len(pixels), 'color': color})
    return result


def center(g, cell): return [g['bbox'][0] + g['pitch'] * cell[0] + g['pitch'] // 2, g['bbox'][1] + g['pitch'] * cell[1] + g['pitch'] // 2]
def cell_box(g, cell):
    left, top = g['bbox'][0] + g['pitch'] * cell[0] + 1, g['bbox'][1] + g['pitch'] * cell[1] + 1
    return [left, top, left + g['size'] - 1, top + g['size'] - 1]
def perimeter(rows, box, color):
    l, t, r, b = box
    return all(rows[y][x] == color for y in range(t, b + 1) for x in range(l, r + 1) if x in (l, r) or y in (t, b))


def visual(rows, g):
    assert perimeter(rows, g['bbox'], g['outer_value'])
    parts, marks, full = components(rows), [], []
    centers = {tuple(center(g, [x, y])): [x, y] for y in range(g['shape'][1]) for x in range(g['shape'][0])}
    for part in parts:
        l, t, r, b = part['bbox']; width = r - l + 1; point = ((l + r) // 2, (t + b) // 2)
        if width == b - t + 1 and 3 <= width < g['pitch'] and part['area'] == 4 * (width - 1) and point in centers and perimeter(rows, part['bbox'], part['color']):
            marks.append({'cell': centers[point], 'bbox': part['bbox'], 'palette': part['color'], 'center_value': rows[point[1]][point[0]], 'width': width})
    for y in range(g['shape'][1]):
        for x in range(g['shape'][0]):
            box = cell_box(g, [x, y])
            matches = [p for p in parts if p['bbox'] == box and p['color'] == g['floor_value'] and p['area'] == g['size'] ** 2]
            if len(matches) == 1: full.append({'cell': [x, y], 'bbox': box, 'palette': g['floor_value'], 'area': matches[0]['area']})
    heads, receivers = [m for m in marks if m['center_value'] != g['floor_value']], [m for m in marks if m['center_value'] == g['floor_value']]
    pairs = [[a, b] for a in heads for b in receivers if a['width'] == b['width']]
    return {'marks': marks, 'pairs': pairs, 'full': full}


def verify_support_witness(rows, scene, witness):
    g = scene['geometry']; measured = visual(rows, g)
    assert witness['schema'] == 'logos-engine.native.trace-cell-support.v1'
    assert witness['rule'] == 'full_cell_material_ring_around_unique_inset_mark'
    assert witness['status'] == 'current_visual_support_hypothesis'
    assert witness['frame_digest'] == digest(rows) and witness['geometry_ref'] == scene['geometry_ref'] == digest(g)
    for key in ('path_search_used', 'primitive_release_authorized', 'terminal_role_acquired'): assert witness[key] is False
    assert g['pitch'] == g['size'] + 1 and g['pitch'] % 2 == 0
    assert exact(witness['current_full_cell_homologues'], measured['full'])
    assert len(measured['full']) >= 3 and min(len({f['cell'][axis] for f in measured['full']}) for axis in (0, 1)) >= 2
    selected = [scene['head'], scene['receiver_hypothesis']]
    assert exact(witness['selected_marks'], selected) and selected in measured['pairs']
    assert witness['original_pair_count'] == len(measured['pairs']) > 1 and witness['retained_pair_count'] == 1
    excluded = witness['excluded_cell_material_rings']; assert len(excluded) == 2
    for item, mark in zip(excluded, selected):
        outer, inset = item['mark'], item['inset']; assert inset == mark and outer in measured['marks']
        assert outer['palette'] == g['floor_value'] and outer['width'] == g['size'] and outer['bbox'] == cell_box(g, outer['cell'])
        assert outer['cell'] == inset['cell'] and outer['width'] > inset['width'] and inset['palette'] != g['floor_value']
        candidates = [m for m in measured['marks'] if m['palette'] != g['floor_value'] and m['cell'] == outer['cell']
                      and all(m['bbox'][axis] > outer['bbox'][axis] for axis in (0, 1))
                      and all(m['bbox'][axis] < outer['bbox'][axis] for axis in (2, 3))]
        assert candidates == [inset]
    alternatives = [pair for pair in measured['pairs'] if pair != selected]
    assert alternatives == [[item['mark'] for item in excluded]]
    return measured


def source_projection(rows, g):
    measured = visual(rows, g)
    if len(measured['pairs']) != 1: return None
    head, receiver = measured['pairs'][0]; trace_value = head['center_value']; edges, traced = [], []
    for y in range(g['shape'][1]):
        for x in range(g['shape'][0]):
            for dx, dy in ((1, 0), (0, 1)):
                if x + dx >= g['shape'][0] or y + dy >= g['shape'][1]: continue
                a, b = [x, y], [x + dx, y + dy]; p, q = center(g, a), center(g, b)
                mx, my = (p[0] + q[0]) // 2, (p[1] + q[1]) // 2; value = rows[my][mx]
                width = None if value == trace_value else 1
                if width is None: traced.append([a, b])
                else:
                    for sign in (-1, 1):
                        k = 1
                        while k < g['pitch'] // 2 and rows[my + sign * k * dy][mx + sign * k * dx] == value: width += 1; k += 1
                edges.append({'cells': [a, b], 'width': width})
    widths = [edge['width'] for edge in edges if edge['width'] is not None]; minimum = min(widths) if widths else None
    adjacent = {}
    for a, b in traced: adjacent.setdefault(tuple(a), []).append(b); adjacent.setdefault(tuple(b), []).append(a)
    if any(len(v) > 2 for v in adjacent.values()): return None
    path, previous = [head['cell']], None
    while True:
        following = [p for p in adjacent.get(tuple(path[-1]), []) if p != previous]
        if not following: break
        if len(following) != 1 or following[0] in path: return None
        previous = path[-1]; path.append(following[0])
    if len(path) > 1 and len(path) != len(adjacent): return None
    return {'head': head, 'receiver': receiver, 'prefix': list(reversed(path)),
            'allowedEdges': [e['cells'] for e in edges if e['width'] is None or e['width'] == minimum]}


def bounded_cover(projection, g, bound=100000):
    nodes = {(x, y) for y in range(g['shape'][1]) for x in range(g['shape'][0])}
    adjacent = {node: set() for node in nodes}
    for a, b in projection['allowedEdges']: adjacent[tuple(a)].add(tuple(b)); adjacent[tuple(b)].add(tuple(a))
    end = tuple(projection['receiver']['cell']); examined, interrupted = 0, False
    def search(path):
        nonlocal examined, interrupted
        examined += 1
        if examined > bound: interrupted = True; return None
        unseen, head = nodes - set(path), path[-1]
        if not unseen: return path if head == end else None
        if head == end: return None
        residual, seen, pending = unseen | {head}, {head}, [head]
        while pending:
            for neighbor in adjacent[pending.pop()] & residual - seen: seen.add(neighbor); pending.append(neighbor)
        if seen != residual: return None
        if any(len(adjacent[v] & residual) < (1 if v in (head, end) else 2) for v in residual): return None
        for nxt in sorted(adjacent[head] & unseen, key=lambda v: (len(adjacent[v] & unseen), v)):
            found = search(path + [nxt])
            if found or interrupted: return found
        return None
    path = search([tuple(p) for p in projection['prefix']])
    return {'status': 'witness_found' if path else 'interrupted' if interrupted else 'exhausted_no_cover_in_supplied_graph',
            'examinedNodes': examined, 'nodeBound': bound, 'path': [list(p) for p in path] if path else None,
            'qualification': 'Independent offline search in the observed thin-separator hypothesis only. No command was dispatched and no game terminal law was acquired.'}


def inspect_extension(campaign, trace):
    witnessed, transitions, extension_prefixes, other_prefixes = [], {}, [], []
    for prefix in campaign['prefixes']:
        if 'traceField' not in prefix:
            if prefix['decisionRevision'] > 53: other_prefixes.append({'firstAction': prefix['decisionRevision'], 'acquiredActions': prefix['acquiredActions'],
                'family': prefix['family'], 'proposalKind': prefix['proposalKind']})
            continue
        plan, first = prefix['traceField']['plan'], prefix['decisionRevision']
        latest = prefix['sharedSeries']['traceFieldLatestExtension']
        for item in [*latest['state']['successes'], *latest['state']['failures'], latest['transition']]:
            if item['after_ref'] in transitions: assert exact(transitions[item['after_ref']], item)
            transitions[item['after_ref']] = item
        if first <= 53: continue
        packet = trace['packets'][first - 1]['packet']; scene, g = plan['scene'], plan['scene']['geometry']
        assert plan['frame_digest'] == digest(packet['frame_rows']) and plan['epoch'] == packet['level'] and plan['score'] == packet['levels_completed']
        assert OBSERVATION_REF.fullmatch(plan['observation_ref']).groups()[1:] == (str(packet['level']), str(first), packet['frame_hash'])
        assert plan['estimate']['receipt']['descriptive_facts']['primitive_release_authorized'] is False
        for index in range(prefix['acquiredActions']):
            action = campaign['actions'][first + index - 1]
            assert action['family'] == prefix['family'] and exact(action['command'], plan['commands'][index])
        native_witness = scene.get('native_support_discrimination')
        extension_prefixes.append({'firstAction': first, 'acquiredActions': prefix['acquiredActions'],
            'nativeSupportInterpretation': bool(native_witness), 'latestOutcome': latest['transition']['outcome']})
        if not native_witness: continue
        measured = verify_support_witness(packet['frame_rows'], scene, native_witness)
        assert plan['native_support_ref'] == digest(native_witness)
        assert prefix['acquiredActions'] == len(plan['commands']) == 1 and prefix['traceField']['observedSteps'] == [False]
        event_witness = latest['native_support_discrimination']
        assert event_witness['witness_ref'] == plan['native_support_ref'] and exact(event_witness['witness'], native_witness)
        assert event_witness['actual_response'] == latest['transition']['outcome']
        assert event_witness['local_control_effect_observed'] == (latest['transition']['outcome'] == 'local_extension_observed')
        assert event_witness['terminal_role_acquired'] is False and event_witness['primitive_release_authorized'] is False
        assert event_witness['before_ref'] == latest['transition']['before_ref'] == plan['observation_ref']
        assert event_witness['after_ref'] == latest['transition']['after_ref']
        later = trace['packets'][first]['packet']; projected = source_projection(later['frame_rows'], g)
        assert projected and projected['receiver'] == scene['receiver_hypothesis']
        target = plan['estimate']['path'][len(scene['prefix'])]
        assert projected['head']['cell'] == target and projected['prefix'] == scene['prefix'] + [target]
        assert projected['head']['palette'] == scene['head']['palette'] and projected['head']['width'] == scene['head']['width']
        stable_center = projected['head']['center_value'] == scene['head']['center_value']
        if not stable_center:
            assert latest['transition']['outcome'] == 'ordered_trace_projection_refuted'
            assert not event_witness['local_control_effect_observed']
        witnessed.append({'firstAction': first, 'level': packet['level'], 'currentFullCellHomologues': len(measured['full']),
            'originalPairCount': len(measured['pairs']), 'visualWitnessVerifiedFromPixels': True,
            'witnessRef': plan['native_support_ref'], 'actualKernelOutcome': latest['transition']['outcome'],
            'localControlEffectAcquired': event_witness['local_control_effect_observed'], 'afterSourcePairUnique': True,
            'afterOrderedPrefixMatches': True, 'afterHeadAndReceiverShapeMatch': True, 'headCenterMaterialStable': stable_center,
            'headCenterMaterialBefore': scene['head']['center_value'], 'headCenterMaterialAfter': projected['head']['center_value'],
            'terminalRoleAcquired': False, 'primitiveReleaseAuthorizedByWitness': False})
    boundary_actions = [b['totalActions'] for b in campaign['boundaries']]
    extra_boundaries = [b for b in campaign['boundaries'] if b['completedLevel'] > 4]
    for boundary in extra_boundaries:
        assert trace['packets'][boundary['totalActions']]['packet']['levels_completed'] == boundary['completedLevel']
    diagnostic = None
    if other_prefixes and campaign['final']['state'] != 'WIN':
        first = other_prefixes[-1]['firstAction']; previous = trace['packets'][first - 1]['packet']; later = trace['packets'][first]['packet']
        g = next(p['traceField']['plan']['scene']['geometry'] for p in reversed(campaign['prefixes']) if 'traceField' in p)
        before_measurement, after_measurement = source_projection(previous['frame_rows'], g), source_projection(later['frame_rows'], g)
        if before_measurement and after_measurement:
            assert len(visual(previous['frame_rows'], g)['full']) >= 3 and len(visual(later['frame_rows'], g)['full']) >= 3
            diagnostic = {'action': first, 'family': other_prefixes[-1]['family'], 'level': previous['level'],
                'beforeSourcePairUnique': True, 'afterSourcePairUnique': True,
                'beforeVisiblePrefix': before_measurement['prefix'], 'afterVisiblePrefix': after_measurement['prefix'],
                'headCenterMaterialBefore': before_measurement['head']['center_value'], 'headCenterMaterialAfter': after_measurement['head']['center_value'],
                'beforeConditionalCover': bounded_cover(before_measurement, g), 'afterConditionalCover': bounded_cover(after_measurement, g),
                'qualification': 'This is an offline public-pixel diagnosis, not another live trial. A conditional visual graph does not prove the game rule; the recorded common caller selected another family.'}
    return {'campaignStatus': campaign['status'], 'executionFailureRetained': campaign['failure'],
        'targetLevels': campaign['targetLevels'], 'targetReached': campaign['final']['levelsCompleted'] >= campaign['targetLevels'],
        'officialState': campaign['final']['state'], 'stopReason': campaign['final']['reason'], 'officialBoundaries': boundary_actions,
        'additionalOfficialBoundaries': extra_boundaries, 'tracePrefixesBeyondBaseline': extension_prefixes,
        'retainedVisualWitnesses': witnessed, 'traceTransitionCount': len(transitions),
        'traceOutcomes': dict(Counter(t['outcome'] for t in transitions.values())),
        'otherFamilyPrefixesBeyondBaseline': other_prefixes, 'lastPublicDiagnostic': diagnostic,
        'qualification': 'Official progress, proposed visual interpretation and acquired local effect are distinct. A conservative refusal remains a refusal even when a subsequent fresh source interpretation permits progress.'}


def compare():
    historical_before = {str(p): sha(p) for p in OLD.rglob('*') if p.is_file()}
    values, inputs = verify_inputs()
    baseline, old_trace, campaign, trace = [values[key] for key in ['baselineCampaign', 'baselineTrace', 'nativeCampaign', 'nativeTrace']]
    prefix = compare_prefix(baseline, old_trace, campaign, trace); extension = inspect_extension(campaign, trace)
    assert historical_before == {str(p): sha(p) for p in OLD.rglob('*') if p.is_file()}, 'Historical v46 evidence changed'
    last_boundary = campaign['boundaries'][-1]['totalActions'] if campaign['boundaries'] else 0
    return {'schema': 'logos-engine.v47.trace-extension-comparison.v1', 'status': 'passed', 'inputs': inputs,
        'generator': proof(Path(__file__)), 'nativeSourceDigest': values['nativeManifest']['digest'],
        'summary': {'baselineLevels': 4, 'baselineCommands': 53, 'baselinePackets': 54, 'rawExactBaselineCommands': 53,
            'rawExactBaselinePackets': 54, 'scopeNormalizedBaselinePlans': 12, 'scopeNormalizedBaselineLatestKernelEvents': 12,
            'scopeNormalizedBaselineRetainedTransitions': 53, 'levelsCompleted': campaign['final']['levelsCompleted'],
            'totalActions': campaign['final']['actions'], 'actionsThroughLastBoundary': last_boundary,
            'additionalOfficialLevels': campaign['final']['levelsCompleted'] - 4, 'additionalActions': campaign['final']['actions'] - 53,
            'nativeVisualWitnessPrefixes': len(extension['retainedVisualWitnesses']), 'traceTransitionCount': extension['traceTransitionCount'],
            'otherFamilyActionsBeyondBaseline': sum(p['acquiredActions'] for p in extension['otherFamilyPrefixesBeyondBaseline']),
            'campaignTargetReached': extension['targetReached'], 'officialWin': extension['officialState'] == 'WIN'},
        'baselineComparison': prefix, 'extension': extension,
        'nativeVerification': {'sourceUnchanged': True, 'completeCurrentInventoryExact': True, 'reportTraceExecutionHashesVerified': True,
            'sourceFileCount': values['nativeManifest']['fileCount'], 'executionExitCode': values['nativeExecution']['exitCode'],
            'allHistoricalV46FilesUnchanged': True, 'pythonAgentModules': [], 'sessionCount': 1},
        'qualification': 'Passed means this evidence comparison verified. The campaign status and target result remain explicit, including a retained failed target-six attempt. Baseline public pixels/commands are never normalized; only observation session references and their independently recomputed mechanical request digests are mapped for the first twelve internal plans. No source game code, oracle, private state or unreported live action is used.'}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    destination = OUT / 'zipp-trace-extension-comparison.json'; result = compare()
    if args.verify: assert exact(load(destination), result), 'Stored comparison differs from recomputed evidence'
    else:
        if destination.exists(): raise FileExistsError(destination)
        destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'output': destination.relative_to(ROOT).as_posix(),
                      'summary': result['summary'], 'campaignStatus': result['extension']['campaignStatus']}))


if __name__ == '__main__': main()
