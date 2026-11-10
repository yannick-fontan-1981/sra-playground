#!/usr/bin/env python3
"""Cold original proposals for exactly the eleven previously admitted public views.

No game executes. Only an equal archived next command permits replay acquisition.
The immutable original modules supply every proposal, guard, event and restoration.
"""
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import copy
import gzip
import hashlib
import importlib.util
import json

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
INPUT = BASE / 'retained-public-admission.json'
OUTPUT = BASE / 'retained-public-command-comparison.json'
PUBLIC_FIELDS = ('frame_rows', 'level', 'levels_completed', 'state', 'step_index',
                 'available_action_refs', 'frame_hash')
EXCLUDED = {'CWSE', 'SK48', 'FOGW', 'VOIS'}


def fingerprint(path):
    value = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(value),
            'sha256': hashlib.sha256(value).hexdigest()}


def json_roundtrip(value):
    return json.loads(json.dumps(value, separators=(',', ':')))


def main():
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)
    started = datetime.now(timezone.utc).isoformat()
    admission_fingerprint = fingerprint(INPUT)
    admission = json.loads(INPUT.read_text())
    assert admission['admittedViews'] == len(admission['admissions']) == 11
    assert set(admission['admittedGames']) == {'LF52', 'RSWP', 'TR87'}
    spec = importlib.util.spec_from_file_location('framed_original_oracle', ROOT / 'scripts/export-v6-framed-window-reference.py')
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    before_count = original.verify_source()
    traces = {}
    input_fingerprints = []
    cases = []
    calls = Counter()
    per_game = {}
    original.observe_calls = 0

    def observe_public(packet):
        # No frame_packet animation, historical plan, learned state or game id is
        # passed into the observer or any component below.
        public = SimpleNamespace(**{key: copy.deepcopy(packet[key]) for key in PUBLIC_FIELDS})
        value, _ = original.observe(public, public.step_index, 'retained-public:framed-window-diagnostic')
        calls['publicObservation'] += 1
        return original.plain(value)

    def describe_packet(packet):
        rows = packet['frame_rows']
        return {**{key: packet[key] for key in PUBLIC_FIELDS if key != 'frame_rows'},
                'rowsSha256': original.sha(json.dumps(rows, separators=(',', ':')).encode())}

    def own_only(proposal):
        return proposal if proposal and 'framed_window_plan' in proposal else None

    def first_command(proposal):
        return proposal['actions'][0] if proposal and proposal.get('actions') else None

    def memory_propose(memory, obs, rows, inputs):
        calls['ownProposal'] += 1
        value, clock_calls = original.clocked(lambda: memory.propose([], obs, rows, inputs, 1,
            {**copy.deepcopy(original.POLICY), 'level_deadline': original.DEADLINE_MS / 1000}))
        return {'proposal': original.plain(value), 'sourceClockCalls': clock_calls}

    def common_propose(wrapper, obs, rows, inputs):
        calls['commonProposal'] += 1
        wrapper.level_deadline = original.DEADLINE_MS / 1000
        value, clock_calls = original.clocked(lambda: wrapper.window_propose(obs, rows, inputs, 1, copy.deepcopy(original.POLICY)))
        return {'proposal': original.plain(value), 'sourceClockCalls': clock_calls}

    for admitted in admission['admissions']:
        game, trace_path, index = admitted['game'], admitted['trace'], admitted['packetIndex']
        # Apply exclusions before opening trace bytes or invoking source code.
        assert game not in EXCLUDED
        assert game in {'LF52', 'RSWP', 'TR87'}
        if trace_path not in traces:
            path = ROOT / trace_path
            measured_input = next(item['input'] for item in admission['traces'] if item['input']['path'] == trace_path)
            frozen = fingerprint(path)
            assert frozen == measured_input
            data = json.loads(gzip.decompress(path.read_bytes()))
            assert data['game'] == game and data['game'] not in EXCLUDED
            traces[trace_path] = data
            input_fingerprints.append(frozen)
        trace = traces[trace_path]
        packet = {key: trace['packets'][index]['packet'][key] for key in PUBLIC_FIELDS}
        rows = packet['frame_rows']
        packet_summary = describe_packet(packet)
        assert packet_summary['rowsSha256'] == admitted['rowsSha256']
        assert packet_summary['frame_hash'] == admitted['frameHash']
        obs = observe_public(packet)
        inputs = original.plain(original.original_window.input_candidates(rows, obs['available_action_refs']))
        calls['inputCandidates'] += 1
        memory = original.FramedWindowAccess()
        wrapper = original.FramedWindowConstraint()
        case = {'game': game, 'trace': trace_path, 'packetIndex': index, 'before': packet_summary,
                'observation': obs, 'inputs': inputs, 'initialState': original.state(memory),
                'initialCommonState': original.state(wrapper.memory), 'nextPacketIndex': index + 1,
                'acquired': False}
        counts = per_game.setdefault(game, Counter())
        counts['admissions'] += 1
        try:
            case['own'] = memory_propose(memory, obs, rows, inputs)
            case['common'] = common_propose(wrapper, obs, rows, inputs)
            case['ownStateAfterProposal'] = original.state(memory)
            case['commonStateAfterProposal'] = original.state(wrapper.memory)
            own = own_only(case['own']['proposal'])
            common = own_only(case['common']['proposal'])
            case['ownCommand'] = first_command(own)
            case['commonCommand'] = first_command(common)
            case['ownCommonCommandsAgree'] = case['ownCommand'] == case['commonCommand']
            assert case['ownCommonCommandsAgree']
            assert case['ownStateAfterProposal'] == case['initialState']
            assert case['commonStateAfterProposal'] == case['initialCommonState']
            counts['ownProposals'] += own is not None
            counts['commonProposals'] += common is not None
            if index + 1 >= len(trace['packets']):
                case['classification'] = 'last_packet'
                counts['lastPacket'] += 1
                cases.append(case)
                continue
            next_record = trace['packets'][index + 1]
            archived_command = copy.deepcopy(next_record['command'])
            case['archivedNextCommand'] = archived_command
            if own is None or common is None:
                case['classification'] = 'no_framed_window_proposal'
                case['nonProposalReason'] = ('point_action_unavailable' if 'ACTION6' not in obs['available_action_refs']
                    else 'original_component_or_common_wrapper_declined')
                counts['noProposal'] += 1
            elif case['commonCommand'] != archived_command:
                case['classification'] = 'different_command'
                counts['differentCommand'] += 1
            else:
                case['classification'] = 'same_command'
                counts['sameCommand'] += 1
                # The actual next public image is consumed only after equality.
                after_packet = {key: next_record['packet'][key] for key in PUBLIC_FIELDS}
                later = after_packet['frame_rows']
                after = observe_public(after_packet)
                after_inputs = original.plain(original.original_window.input_candidates(later, after['available_action_refs']))
                calls['inputCandidates'] += 1
                case['after'] = describe_packet(after_packet)
                case['afterObservation'] = after
                case['afterInputs'] = after_inputs
                meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'],
                        'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs']}
                case['beforeGuard'] = original.plain(wrapper.memory.before(common, 0, rows, **meta))
                calls['beforeGuard'] += 1
                assert case['beforeGuard']['admitted'] is True
                wrapper.bind(common, SimpleNamespace(bindings={(obs['level_epoch'], obs['frame_hash'])}))
                case['boundCommonProposal'] = original.plain(common)
                calls['pointBind'] += 1
                case['afterGuard'] = original.plain(wrapper.memory.after(common, 0, rows, later,
                    epoch=after['level_epoch'], score=after['levels_completed']))
                calls['afterGuard'] += 1
                events = wrapper.memory.record(obs, archived_command, after, rows, later, common, 0)
                calls['acquisition'] += 1
                case['acquired'] = True
                case['events'] = original.plain(events)
                case['ownEvents'] = [event for event in case['events'] if event['kind'] == 'framed_window_response']
                assert len(case['ownEvents']) == 1
                case['acquiredState'] = original.state(wrapper.memory)
                snapshot = json_roundtrip({'events': original.plain(events), 'digest': wrapper.memory.retained_digest()})
                case['snapshot'] = snapshot
                restored = original.FramedWindowConstraint()
                restored.restore(copy.deepcopy(snapshot))
                calls['restoration'] += 1
                case['restoredState'] = original.state(restored.memory)
                assert case['restoredState'] == case['acquiredState']
                case['nextContinuousOwn'] = memory_propose(wrapper.memory, after, later, after_inputs)
                case['nextRestoredOwn'] = memory_propose(restored.memory, after, later, after_inputs)
                case['nextEmptyOwn'] = memory_propose(original.FramedWindowAccess(), after, later, after_inputs)
                case['nextContinuousCommon'] = common_propose(wrapper, after, later, after_inputs)
                case['nextRestoredCommon'] = common_propose(restored, after, later, after_inputs)
                case['nextEmptyCommon'] = common_propose(original.FramedWindowConstraint(), after, later, after_inputs)
                case['restoredOwnMatchesContinuous'] = case['nextContinuousOwn'] == case['nextRestoredOwn']
                case['restoredCommonMatchesContinuous'] = case['nextContinuousCommon'] == case['nextRestoredCommon']
                assert case['restoredOwnMatchesContinuous'] and case['restoredCommonMatchesContinuous']
                case['retainedOwnDiffersFromEmpty'] = own_only(case['nextRestoredOwn']['proposal']) != own_only(case['nextEmptyOwn']['proposal'])
                case['retainedCommonDiffersFromEmpty'] = case['nextRestoredCommon']['proposal'] != case['nextEmptyCommon']['proposal']
                counts['acquisitions'] += 1
                counts['officialProgressReturns'] += case['ownEvents'][0]['official_progress']
                counts['nextOwnDiffersFromEmpty'] += case['retainedOwnDiffersFromEmpty']
                counts['nextCommonDiffersFromEmpty'] += case['retainedCommonDiffersFromEmpty']
        except Exception as error:
            case['sourceError'] = original.error_value(error)
            case.setdefault('classification', 'source_error')
            counts['sourceErrors'] += 1
        cases.append(case)
        print(json.dumps({'game': game, 'packetIndex': index, 'classification': case['classification'],
            'ownCommand': case.get('ownCommand'), 'archivedNextCommand': case.get('archivedNextCommand'),
            'acquired': case['acquired'], 'sourceError': case.get('sourceError')}), flush=True)

    assert len(cases) == 11
    for item in input_fingerprints:
        assert fingerprint(ROOT / item['path']) == item
    assert fingerprint(INPUT) == admission_fingerprint
    after_count = original.verify_source()
    count_fields = ('admissions', 'ownProposals', 'commonProposals', 'sameCommand', 'lastPacket',
                    'differentCommand', 'noProposal', 'sourceErrors', 'acquisitions',
                    'officialProgressReturns', 'nextOwnDiffersFromEmpty', 'nextCommonDiffersFromEmpty')
    summaries = [{'game': game, **{key: per_game[game][key] for key in count_fields}} for game in sorted(per_game)]
    report = {'schema': 'logos-engine.framed-window-retained-command-comparison.v1',
        'status': 'completed_bounded_cold_component_diagnosis', 'startedAt': started,
        'finishedAt': datetime.now(timezone.utc).isoformat(), 'generator': fingerprint(Path(__file__)),
        'admissionInput': admission_fingerprint, 'traceInputs': input_fingerprints,
        'sourceCommit': original.COMMIT, 'originalFilesVerifiedBefore': before_count,
        'originalFilesVerifiedAfter': after_count, 'inputsUnchanged': True,
        'excludedGames': sorted(EXCLUDED), 'caseCount': len(cases), 'perGame': summaries,
        'counts': {key: sum(item[key] for item in summaries) for key in count_fields},
        'sourceCalls': dict(calls), 'cases': cases,
        'contractContext': {'configuration': original.POLICY, 'remaining': 1, 'maxPrefix': 1,
            'nowMs': original.NOW_MS, 'deadlineMs': original.DEADLINE_MS,
            'observationScope': 'retained-public:framed-window-diagnostic',
            'revision': 'archived public step_index',
            'clockQualification': 'The fixture clock supplies a reproducible 1000 ms calculation allowance. This is not an archived historical deadline, measured duration, game-case clock or reset of a cumulative game budget.'},
        'executionScope': {'gameHostsLoaded': 0, 'gameExecutions': 0, 'dispatchedActions': 0,
            'levelJumps': 0, 'nativeAgentProposals': 0, 'runtimeStateInjections': 0,
            'historicalPlansConsumed': 0, 'animationInputsToSource': 0, 'privateStatesRead': 0,
            'newAdmissionSearches': 0},
        'qualification': 'Only the eleven previous structural admissions are examined, each from a new empty original memory. Public metadata and canonical frame_rows determine neutral observations; proposals use the unchanged framed-window policy and a declared one-action diagnostic budget. A cold component proposal is not a claim that the historical full controller chose this component. Only exact equality with the next archived command authorizes source record on that archived public return. Different commands and unavailable point actions never acquire. Restored and empty-memory proposals are compared on the actual next public image only. This diagnosis executes no game, selects no new game case, supplies no game solution, and establishes no new level success or production wall-cost result.'}
    with OUTPUT.open('x') as stream:
        stream.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'output': OUTPUT.relative_to(ROOT).as_posix(), 'perGame': summaries,
        'counts': report['counts'], 'originalFilesVerifiedBefore': before_count,
        'originalFilesVerifiedAfter': after_count}))


if __name__ == '__main__':
    main()
