#!/usr/bin/env python3
"""Cold own-layer source replay of an explicitly supplied retained public journal.

No default game, host, engine, specification, solution or new action is loaded.
The unchanged original starts empty. Captured native plan.state is comparison
data only; proposals and acquired states are produced by this source replay.
"""
from __future__ import annotations
import argparse
import copy
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from reference_population_access import ReferencePopulationAccess, scene
from reception_service_access import ReceptionServiceAccess
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity
from src_bridge import plain

MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['observed_composition_services']
OWN_KIND = 'observed_reference_population'
STEP_ENVELOPE = ('expected_before', 'point_support', 'point_binding')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def read_json(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def path_label(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def compare(source, native, path=''):
    source, native = plain(source), plain(native)
    if source == native:
        return []
    if isinstance(source, dict) and isinstance(native, dict):
        result = []
        for key in sorted(set(source) | set(native)):
            if key not in source or key not in native:
                result.append({'path': path + '.' + key, 'sourcePresent': key in source, 'nativePresent': key in native})
            else:
                result.extend(compare(source[key], native[key], path + '.' + key))
        return result
    if isinstance(source, list) and isinstance(native, list) and len(source) == len(native):
        return [item for i, (left, right) in enumerate(zip(source, native))
                for item in compare(left, right, path + f'[{i}]')]
    return [{'path': path, 'source': source, 'native': native}]


def own_projection(memory):
    return plain({'population_events': memory.population_events,
                  'population_controls': memory.population_controls,
                  'population_state': memory.population_state})


def state_receipt(memory):
    current = own_projection(memory)
    return {'acquiredState': {key: current[key] for key in ('population_controls', 'population_state')},
            'eventsDigest': identity(current['population_events']),
            'controlsDigest': identity(current['population_controls']),
            'stateDigest': identity(current['population_state']),
            'projectionDigest': identity(current), 'eventCount': len(current['population_events']),
            'parentDigest': ReceptionServiceAccess.retained_digest(memory), 'digest': memory.retained_digest()}


def restoration_receipt(memory):
    current = own_projection(memory)
    restored = ReferencePopulationAccess()
    for event in current['population_events']:
        restored.apply_event(copy.deepcopy(event))
    recovered = own_projection(restored)
    assert recovered == current, 'Original own journal failed its own replay'
    parent = ReceptionServiceAccess.retained_digest(memory)
    suffix = identity([parent, recovered['population_events'], recovered['population_controls'], recovered['population_state']])
    assert suffix == memory.retained_digest(), 'Own suffix changed on reconstruction'
    return restored, {'ownProjectionEqual': True, 'projectionDigest': identity(recovered),
                      'eventCount': len(recovered['population_events']), 'opaqueOriginalParentDigest': parent,
                      'restoredSuffixOnOriginalParent': suffix,
                      'freshParentDigest': ReceptionServiceAccess.retained_digest(restored),
                      'freshParentOwnDigest': restored.retained_digest(),
                      'qualification': 'Only the own journal is restored. The live original parent remains opaque; its complete inherited state is not claimed restored.'}


def error_receipt(error):
    result = {'type': type(error).__name__, 'message': str(error)}
    if hasattr(error, 'errors'):
        result['errors'] = [{'type': item['type'], 'loc': list(item['loc'])} for item in error.errors()]
    if hasattr(error, 'cause'):
        result['cause'] = error.cause
    return result


def public_command(value):
    return {'action_ref': value['action_ref'], 'data': value.get('data', {})}


def find_observations(value, found):
    if isinstance(value, dict):
        if all(key in value for key in ('observation_ref', 'revision', 'level_epoch', 'available_action_refs', 'entities')):
            reference = value['observation_ref']
            assert reference not in found or found[reference] == value, ('Inconsistent captured observation', reference)
            found[reference] = value
        else:
            for child in value.values():
                find_observations(child, found)
    elif isinstance(value, list):
        for child in value:
            find_observations(child, found)


def sealed_transitions(prefix):
    keys = [key for key in ('inventoryAcquisition', 'reactionAcquisition', 'reactiveAcquisition', 'recolorAcquisition')
            if isinstance(prefix.get(key, {}).get('transitions'), list)]
    assert keys, 'A selected prefix needs independently captured sealed transitions'
    transitions = prefix[keys[0]]['transitions']
    for key in keys[1:]:
        assert prefix[key]['transitions'] == transitions, ('Sealed transition copies differ', key)
    assert len(transitions) == prefix['acquiredActions']
    return transitions, keys


def captured_own_proposal(captured, source):
    # Only the documented common envelope is removed. All own fields, including
    # plan.state, are compared after the source has produced its own proposal.
    result = {key: copy.deepcopy(captured[key]) for key in source if key in captured}
    removed = []
    for index, step in enumerate(result.get('steps', [])):
        for key in STEP_ENVELOPE:
            if key in step:
                removed.append({'step': index, 'field': key})
                step.pop(key)
    return result, removed


def replay(report, journal):
    assert journal and journal[0]['command'] is None
    assert len(journal) == len(report['actions']) + 1
    assert sum(p['acquiredActions'] for p in report['prefixes']) == len(report['actions'])
    for i, entry in enumerate(journal):
        packet = entry['packet']
        assert packet['step_index'] == i
        assert identity(packet['frame_rows'])[:16] == packet['frame_hash'], ('Public raster hash', i)
        if i:
            assert entry['command'] == report['actions'][i - 1]['command'], ('Captured action', i)
    captured_observations, measured_cache, observation_receipts = {}, {}, []
    find_observations(report['inventorySourceCalls'], captured_observations)

    def observation(packet, reference):
        match = re.fullmatch(r'(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)', reference)
        assert match, ('Unrecognized observed identity', reference)
        assert int(match[2]) == packet['level'] and match[4] == packet['frame_hash']
        if reference in measured_cache:
            old = measured_cache[reference]
            assert old['rasterDigest'] == identity(packet['frame_rows'])
            return old['value']
        value, _ = measure(SimpleNamespace(**packet), int(match[3]), match[1])
        value = plain(value)
        assert value['observation_ref'] == reference
        captured = captured_observations.get(reference)
        if captured is not None:
            assert value == captured, ('Full original observation differs from captured Inventory input', reference)
        measured_cache[reference] = {'value': value, 'rasterDigest': identity(packet['frame_rows'])}
        observation_receipts.append({'observationRef': reference, 'revision': value['revision'],
                                     'rasterDigest': identity(packet['frame_rows']), 'observationDigest': identity(value),
                                     'capturedInventoryObservationMatched': captured is not None})
        return value

    def context(packet, reference, position):
        value = observation(packet, reference)
        cap_index = packet['levels_completed']
        assert 0 <= cap_index < len(report['budget']['levelActionCaps']), ('No declared level cap', cap_index)
        cap = report['budget']['levelActionCaps'][cap_index]
        spent = sum(action['levelBefore'] == packet['level'] for action in report['actions'][:position])
        remaining = cap - spent
        assert remaining > 0, 'Common positive remaining-action gate must precede a selected own proposal'
        inputs = [candidate for candidate in ObservedInputDomain(256).candidates(value) if not candidate.get('data')]
        # All inherited additions are point candidates. The own branch consumes
        # only this nonpoint set and computes selection points from its scene.
        config = {**copy.deepcopy(POLICY), 'remaining_level_actions': remaining}
        return value, inputs, min(16, remaining), config, remaining

    memory = ReferencePopulationAccess()
    result = {'mode': 'unchanged_original', 'coldStart': True, 'primedFromCapturedProposalMemory': False,
              'initialState': state_receipt(memory), 'prefixes': [], 'steps': [], 'restorations': [],
              'foreignPrefixes': [], 'differences': [], 'stop': None, 'terminalRecomputation': None}
    cursor = 0
    captured_count = 0
    last_own_reference = None
    last_own_position = None

    def stop_exception(error, phase, prefix_index, index=None):
        result['stop'] = {'kind': 'original_exception', 'phase': phase, 'prefixIndex': prefix_index,
                          'index': index, 'error': error_receipt(error), 'sourceStateAtStop': state_receipt(memory)}

    for prefix_index, prefix in enumerate(report['prefixes']):
        captured = prefix.get('observedReferencePopulation')
        series = prefix['sharedSeries']
        events = series.get('referencePopulationAcquiredEvents', [])
        assert isinstance(events, list)
        captured_count += len(events)
        assert series.get('referencePopulationEventCount', 0) == captured_count
        if captured is None:
            assert not events, 'A foreign selected proposal cannot acquire own Population evidence'
            result['foreignPrefixes'].append({'index': prefix_index, 'family': prefix['family'],
                                               'firstSequence': cursor + 1, 'acquiredActions': prefix['acquiredActions']})
            cursor += prefix['acquiredActions']
            continue
        packet = journal[cursor]['packet']
        captured_proposal = captured['proposal']
        reference = captured_proposal['reference_population_plan']['observation_ref']
        current, inputs, limit, config, remaining = context(packet, reference, cursor)
        assert current['revision'] == prefix['decisionRevision']
        before_state = state_receipt(memory)
        try:
            proposal = plain(memory.propose_graph(copy.deepcopy(current), copy.deepcopy(packet['frame_rows']),
                                                 copy.deepcopy(inputs), limit, copy.deepcopy(config)))
        except Exception as error:
            stop_exception(error, 'proposal', prefix_index)
            break
        assert state_receipt(memory) == before_state, 'Proposal changed acquired source memory'
        if proposal.get('status') != 'proposed' or 'reference_population_plan' not in proposal:
            result['stop'] = {'kind': 'own_proposal_not_produced', 'prefixIndex': prefix_index, 'source': proposal}
            break
        native_own, removed = captured_own_proposal(captured_proposal, proposal)
        differences = compare(proposal, native_own, f'prefixes[{prefix_index}]')
        result['differences'].extend(differences)
        result['prefixes'].append({'index': prefix_index, 'id': prefix.get('id'), 'position': cursor,
                                  'revision': current['revision'], 'observationRef': reference,
                                  'remainingActions': remaining, 'prefixLimit': limit, 'nonpointInputs': inputs,
                                  'sourceProposal': proposal, 'proposalDifferences': differences,
                                  'nativeAdditionalEnvelopeKeys': sorted(set(captured_proposal) - set(proposal)),
                                  'excludedCommonStepFields': removed, 'sourceStateBefore': before_state})
        if differences:
            result['stop'] = {'kind': 'proposal_difference', 'prefixIndex': prefix_index}
            break
        restored, restoration = restoration_receipt(memory)
        restored_proposal = plain(restored.propose_graph(copy.deepcopy(current), copy.deepcopy(packet['frame_rows']),
                                                        copy.deepcopy(inputs), limit, copy.deepcopy(config)))
        assert restored_proposal == proposal, 'Own restore changed the next original proposal'
        restoration.update({'prefixIndex': prefix_index, 'phase': 'before_prefix', 'nextProposalEqual': True})
        result['restorations'].append(restoration)
        transitions, transition_sources = sealed_transitions(prefix)
        event_cursor = 0
        previous_after = None
        for index, transition in enumerate(transitions):
            position = cursor + index
            first_packet, later_packet = journal[position]['packet'], journal[position + 1]['packet']
            assert transition['before'] == (reference if index == 0 else previous_after)
            before = observation(first_packet, transition['before'])
            after = observation(later_packet, transition['after'])
            previous_after = after['observation_ref']
            command = proposal['actions'][index]
            assert transition['command'] == command
            assert public_command(command) == public_command(journal[position + 1]['command'])
            first, later = first_packet['frame_rows'], later_packet['frame_rows']
            before_meta = {'epoch': before['level_epoch'], 'score': before['levels_completed'],
                           'observation_ref': before['observation_ref'], 'available': before['available_action_refs']}
            after_meta = {'epoch': after['level_epoch'], 'score': after['levels_completed']}
            try:
                before_guard = plain(memory.before(proposal, index, first, **before_meta))
                after_guard = plain(memory.after(proposal, index, first, later, **after_meta))
            except Exception as error:
                stop_exception(error, 'guard', prefix_index, index)
                break
            assert before_guard['admitted'], 'A captured released action fails the original own guard'
            if index + 1 < len(transitions):
                assert not after_guard['seal_prefix'], 'An actual continuation follows a sealed source outcome'
            guard_differences = compare(after_guard, transition['outcome'], f'outcomes[{position}]')
            prior = state_receipt(memory)
            try:
                emitted = memory.record(copy.deepcopy(before), copy.deepcopy(command), copy.deepcopy(after),
                                        copy.deepcopy(first), copy.deepcopy(later), copy.deepcopy(proposal), index)
            except Exception as error:
                stop_exception(error, 'acquisition', prefix_index, index)
                break
            own = [plain(event) for event in emitted if event.get('kind') == OWN_KIND]
            assert len(own) <= 1
            expected_events = events[event_cursor:event_cursor + len(own)]
            event_differences = compare(own, expected_events, f'events[{position}]')
            event_cursor += len(own)
            if not own:
                assert state_receipt(memory)['projectionDigest'] == prior['projectionDigest']
            result['differences'].extend(guard_differences + event_differences)
            result['steps'].append({'sequence': position + 1, 'prefixIndex': prefix_index, 'index': index,
                                    'beforeRevision': before['revision'], 'afterRevision': after['revision'],
                                    'beforeObservationRef': before['observation_ref'], 'afterObservationRef': after['observation_ref'],
                                    'command': command, 'beforeMeta': before_meta, 'afterMeta': after_meta,
                                    'beforeGuard': before_guard, 'afterGuard': after_guard,
                                    'capturedOutcome': transition['outcome'], 'guardDifferences': guard_differences,
                                    'sourceProjectionBefore': plain(scene(first, proposal['reference_population_plan']['scene'])),
                                    'sourceOwnEvents': own, 'capturedOwnEventStart': event_cursor - len(own),
                                    'eventDifferences': event_differences,
                                    'sourceEmittedKinds': [event.get('kind') for event in emitted],
                                    'sourceStateBefore': prior, 'sourceStateAfter': state_receipt(memory),
                                    'sealedTransitionSources': transition_sources,
                                    'boundary': before['level_epoch'] != after['level_epoch']})
            last_own_reference, last_own_position = after['observation_ref'], position + 1
            if guard_differences or event_differences:
                result['stop'] = {'kind': 'return_difference', 'prefixIndex': prefix_index, 'sequence': position + 1}
                break
        if result['stop']:
            break
        assert event_cursor == len(events), 'Captured own events do not all belong to returned selected actions'
        assert len(memory.population_events) == captured_count
        cursor += prefix['acquiredActions']
    result['finalState'] = state_receipt(memory)
    _, restored_final = restoration_receipt(memory)
    restored_final.update({'phase': 'final'})
    result['restorations'].append(restored_final)
    result['restorationOwnLayerEqual'] = restored_final['ownProjectionEqual']
    # This is labelled a recomputation, not an extra captured controller call.
    # No terminal invocation is made after an official completion or exhausted
    # common budget, and no native wall-time decision is asserted source-equal.
    if (result['stop'] is None and report['final'].get('reason') == 'frontier_unknown'
            and last_own_reference is not None and last_own_position == len(journal) - 1):
        packet = journal[-1]['packet']
        try:
            current, inputs, limit, config, remaining = context(packet, last_own_reference, len(journal) - 1)
            terminal = plain(memory.propose_graph(copy.deepcopy(current), copy.deepcopy(packet['frame_rows']),
                                                 copy.deepcopy(inputs), limit, copy.deepcopy(config)))
            result['terminalRecomputation'] = {'observationRef': last_own_reference, 'position': len(journal) - 1,
                                               'remainingActions': remaining, 'prefixLimit': limit,
                                               'nonpointInputs': inputs, 'sourceProposal': terminal,
                                               'capturedControllerCall': False, 'newGameActions': 0}
        except Exception as error:
            result['terminalRecomputation'] = {'exception': error_receipt(error), 'capturedControllerCall': False, 'newGameActions': 0}
        assert state_receipt(memory) == result['finalState']
    return result, observation_receipts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session', type=Path, help='Explicit completed public capture directory; no game is opened')
    parser.add_argument('--output', type=Path, help='Optional deterministic .json.gz output')
    args = parser.parse_args()
    session = args.session.resolve()
    report_paths = sorted(session.glob('*-campaign.json.gz'))
    assert len(report_paths) == 1, report_paths
    report_path = report_paths[0]
    report = read_json(report_path)
    game = report['game']
    assert re.fullmatch(r'[A-Z0-9]{4}', game), game
    slug = game.lower()
    journal_path = session / (slug + '-actual-public-journal.jsonl.gz')
    trace_path = session / (slug + '-public-trace.json.gz')
    execution_path = session / ('execution-' + slug + '.json')
    native_manifest_path = session / 'source-manifest.json'
    journal = [json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).splitlines() if line]
    trace = read_json(trace_path)
    execution = read_json(execution_path)
    native_manifest = read_json(native_manifest_path)
    assert trace['packets'] == journal
    assert report['sourceUnchangedDuringRun'] is True and report['pythonAgentModules'] == []
    assert execution['nativeSourceUnchanged'] is True and execution['executionCodeUnchanged'] is True
    assert report['source']['digest'] == native_manifest['digest'] == execution['nativeSourceManifestDigest']
    for name, expected in native_manifest['files'].items():
        assert sha((ROOT / name).read_bytes()) == expected, ('Frozen native source changed', name)
    verified = verify_source()
    try:
        exact, observations = replay(report, journal)
    finally:
        verified_after = verify_source()
    selected = [p for p in report['prefixes'] if 'observedReferencePopulation' in p]
    selected_actions = sum(p['acquiredActions'] for p in selected)
    selected_events = sum(len(p['sharedSeries']['referencePopulationAcquiredEvents']) for p in selected)
    complete = (exact['stop'] is None and not exact['differences']
                and len(exact['prefixes']) == len(selected) and len(exact['steps']) == selected_actions)
    status = 'passed' if complete and selected else 'no_selected_reference_population_prefix' if not selected else 'failed'
    input_paths = [report_path, journal_path, trace_path, execution_path, native_manifest_path,
                   SOURCE / POLICY_PATH, SOURCE.parent / 'manifest.json', Path(__file__)]
    output = {'schema': 'logos-engine.lot3f.reference-population-public-source-replay.v1',
              'status': status, 'game': game, 'sourceCommit': COMMIT, 'sessionPath': path_label(session),
              'inputs': {path_label(p): sha(p.read_bytes()) for p in input_paths},
              'originalFilesVerifiedBefore': verified, 'originalFilesVerifiedAfter': verified_after,
              'nativeSourceDigest': native_manifest['digest'], 'nativeFilesVerified': len(native_manifest['files']),
              'capturedGameActions': len(journal) - 1, 'capturedSelectedPopulationActions': selected_actions,
              'capturedSelectedPopulationEvents': selected_events, 'newGameActions': 0, 'levelJumps': 0,
              'originalObservationReceipts': observations, 'exactOriginal': exact,
              'capturedCommonTerminal': report['final'],
              'qualification': 'The unchanged own ReferencePopulation source starts empty and progresses only by original acquisitions over actual retained public commands and returns. Captured native plan.state never initializes source state. No-action and empty-event returns remain explicit. Selected own proposals, guards, events, states and restored own digests are compared; the original parent digest is an opaque boundary, not complete inherited-caller parity. Only the consumed nonpoint input subset is needed by this own branch. Physical deadlines and native search interruption are excluded from deterministic replay of completed work and remain separately qualified native contracts. No game engine, specification, solution, new game action, cost result or inferred success is claimed.'}
    target = args.output.resolve() if args.output else HERE / (slug + '-public-source-replay.json.gz')
    data = gzip.compress(json.dumps(output, separators=(',', ':'), sort_keys=True).encode(), mtime=0)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + '.tmp')
    temporary.write_bytes(data)
    temporary.replace(target)
    print(json.dumps({'path': path_label(target), 'status': status, 'bytes': len(data), 'sha256': sha(data),
                      'prefixes': len(exact['prefixes']), 'returns': len(exact['steps']),
                      'ownEvents': exact['finalState']['eventCount'], 'sourceRestorations': len(exact['restorations']),
                      'stop': exact['stop'], 'differences': len(exact['differences']),
                      'originalFilesVerifiedBefore': verified, 'originalFilesVerifiedAfter': verified_after}))
    if status != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
