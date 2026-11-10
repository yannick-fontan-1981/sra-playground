#!/usr/bin/env python3
"""Cold Repeated/Supported Python replay of a retained public campaign.

No game is loaded. Every actual return and public frame packet is acquired,
including foreign selections. Captured native memory never seeds this replay.
The actual descendant dispatch is qualified; own selected envelopes must carry
no additional higher-priority plan. Source limits/refusals remain evidence.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from common_repeated_lines import RepeatedLinePatterns, fields
from common_supported_lines import SupportedLineAccess, SupportedLineConstraint, line_windows
from neutral_observer import measure
from terminal_composition import identity
from src_bridge import plain

OWN = {'repeated_line_trial', 'repeated_line_scored', 'supported_insertion_observation',
       'supported_insertion_order', 'supported_line_refutation'}
PLAN_KEYS = {'line_plan', 'supported_line_plan'}
CONFIG = {'prepare_supported_lines': True, 'supported_line_reply_plies': 6}
MAX_NODES = 250_000
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
LOCAL = timezone(timedelta(hours=-3))


def sha(data): return hashlib.sha256(data).hexdigest()
def label(path):
    try: return path.relative_to(ROOT).as_posix()
    except ValueError: return str(path)
def file_record(path):
    data = path.read_bytes()
    return {'path': label(path), 'bytes': len(data), 'sha256': sha(data)}
def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)
def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)
def error_value(error): return {'type': type(error).__name__, 'message': str(error)}
def public_command(value): return {'action_ref': value['action_ref'], 'data': value.get('data', {})}


def differences(left, right, path=''):
    left, right = plain(left), plain(right)
    if left == right: return []
    if isinstance(left, dict) and isinstance(right, dict):
        result = []
        for key in sorted(set(left) | set(right)):
            if key not in left or key not in right:
                result.append({'path': path + '.' + key, 'sourcePresent': key in left, 'nativePresent': key in right})
            else: result.extend(differences(left[key], right[key], path + '.' + key))
        return result
    if isinstance(left, list) and isinstance(right, list) and len(left) == len(right):
        return [item for i, (a, b) in enumerate(zip(left, right)) for item in differences(a, b, path + f'[{i}]')]
    return [{'path': path, 'source': left, 'native': right}]


def compare_complete_source(source, native):
    extras = []
    def project(value, captured, path=''):
        if isinstance(value, dict) and isinstance(captured, dict):
            for key in sorted(set(captured) - set(value)):
                extras.append({'path': path + '.' + key, 'value': plain(captured[key])})
            return {key: project(child, captured[key], path + '.' + key) for key, child in value.items() if key in captured}
        if isinstance(value, list) and isinstance(captured, list) and len(value) == len(captured):
            return [project(a, b, path + f'[{i}]') for i, (a, b) in enumerate(zip(value, captured))]
        return captured
    diff = differences(source, project(source, native))
    for key in ['line_plan', 'supported_line_plan', 'actions', 'bundle_template']:
        if key in source: diff.extend(differences(source[key], native.get(key), '.strict.' + key))
    foreign_plans = [key for key, value in native.items() if key.endswith('_plan') and key not in PLAN_KEYS and value]
    if foreign_plans:
        diff.append({'path': '.inheritedGuardScope', 'higherPriorityPlanKeys': foreign_plans,
                     'reason': 'Own-component replay cannot silently substitute for a mixed descendant guard.'})
    return diff, extras


def projection(memory):
    return plain({'line_trials': memory.line_trials, 'line_goals': memory.line_goals,
        'insert_samples': memory.insert_samples, 'insert_orders': memory.insert_orders,
        'insert_rejections': sorted(memory.insert_rejections), 'insert_refuted_epochs': sorted(memory.insert_refuted_epochs)})
def state(adapter):
    p = projection(adapter.memory)
    return {'acquiredState': p, 'projectionDigest': identity(p), 'eventsDigest': identity(adapter.events),
        'eventCount': len(adapter.events), 'repeatedDigest': RepeatedLinePatterns.retained_digest(adapter.memory),
        'digest': adapter.memory.retained_digest()}
def restore(events):
    adapter = SupportedLineConstraint()
    for event in copy.deepcopy(events): adapter.memory.apply_event(event)
    adapter.events = copy.deepcopy(events)
    return adapter
def restore_check(adapter):
    rebuilt = SupportedLineConstraint()
    rebuilt.restore(copy.deepcopy(adapter.state()))
    assert state(rebuilt) == state(adapter)
    return rebuilt, {'ownProjectionEqual': True, 'eventCount': len(adapter.events),
                     'projectionDigest': identity(projection(rebuilt.memory)), 'digest': rebuilt.memory.retained_digest()}


def find_observations(value, found):
    if isinstance(value, dict):
        if all(k in value for k in ['observation_ref', 'revision', 'level_epoch', 'available_action_refs', 'entities']):
            ref = value['observation_ref']
            assert ref not in found or found[ref] == value
            found[ref] = value
        else:
            for child in value.values(): find_observations(child, found)
    elif isinstance(value, list):
        for child in value: find_observations(child, found)
def transitions(prefix):
    names = [key for key in ['inventoryAcquisition', 'reactionAcquisition', 'reactiveAcquisition', 'recolorAcquisition']
             if isinstance(prefix.get(key, {}).get('transitions'), list)]
    assert names, 'Missing independently sealed public transitions'
    values = prefix[names[0]]['transitions']
    for key in names[1:]: assert prefix[key]['transitions'] == values
    assert len(values) == prefix['acquiredActions']
    return values, names


def decision(proposal):
    p = proposal or {}
    plan = p.get('line_plan') or p.get('supported_line_plan') or {}
    return {'status': p.get('status'), 'reason': p.get('reason'), 'kind': p.get('kind'),
        'actions': p.get('actions', []), 'target': plan.get('target'),
        'candidateLength': plan.get('candidate_length', plan.get('goal_length')),
        'supportFields': plan.get('support_fields'), 'supportAxis': plan.get('support_axis'),
        'supportSign': plan.get('support_sign'), 'selected': plan.get('selected')}
def action_projection(proposal):
    d = decision(proposal)
    return {key: d[key] for key in ['status', 'reason', 'actions']}
def omit(events, intervention, last_batch_size):
    if intervention == 'remove_line_trials': return [e for e in events if e['kind'] != 'repeated_line_trial']
    if intervention == 'remove_scored_witnesses': return [e for e in events if e['kind'] != 'repeated_line_scored']
    if intervention == 'remove_insertion_samples': return [e for e in events if e['kind'] != 'supported_insertion_observation']
    if intervention == 'remove_public_order': return [e for e in events if e['kind'] != 'supported_insertion_order']
    if intervention == 'remove_refutations':
        return [e for e in events if e['kind'] != 'supported_line_refutation'
                and not (e['kind'] == 'repeated_line_trial' and e.get('result') == 'refuted')]
    assert intervention == 'remove_last_acquired_return'
    return events[:-last_batch_size] if last_batch_size else events[:]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session', type=Path)
    parser.add_argument('--selection', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    session, selection_path = args.session.resolve(), args.selection.resolve()
    selection = read(selection_path)
    deadline = datetime.fromisoformat(selection['resumeDeadline'])
    def clock_check():
        if datetime.now(timezone.utc) >= deadline:
            raise TimeoutError('Retained cumulative game-case deadline reached; no further case analysis authorized')
    clock_check()
    started = datetime.now(LOCAL).isoformat()
    paths = sorted(session.glob('*-campaign.json.gz'))
    assert len(paths) == 1
    report_path = paths[0]
    report = read(report_path)
    game, slug = report['game'], report['game'].lower()
    assert game == selection['game'] and re.fullmatch('[A-Z0-9]{4}', game)
    journal_path = session / (slug + '-actual-public-journal.jsonl.gz')
    trace_path, execution_path = session / (slug + '-public-trace.json.gz'), session / ('execution-' + slug + '.json')
    manifest_path = session / 'source-manifest.json'
    journal = [json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).splitlines() if line]
    trace, execution, manifest = read(trace_path), read(execution_path), read(manifest_path)
    assert trace['packets'] == journal and journal[0]['command'] is None
    assert report['sourceUnchangedDuringRun'] and report['pythonAgentModules'] == []
    assert execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    selected_manifest_path = ROOT / selection['nativeCandidate']['path']
    assert file_record(selected_manifest_path) == selection['nativeCandidate']
    selected_manifest = read(selected_manifest_path)
    assert report['source']['digest'] == manifest['digest'] == execution['nativeSourceManifestDigest'] == selected_manifest['digest']
    for name, digest in manifest['files'].items(): assert sha((ROOT / name).read_bytes()) == digest, name
    originals_before = verify_source()
    input_paths = [report_path, journal_path, trace_path, execution_path, manifest_path, selection_path,
                   selected_manifest_path, Path(__file__), SOURCE.parent / 'manifest.json']
    input_receipts = [file_record(p) for p in input_paths]
    assert len(journal) == len(report['actions']) + 1
    assert sum(p['acquiredActions'] for p in report['prefixes']) == len(report['actions'])
    for i, entry in enumerate(journal):
        packet = entry['packet']
        assert packet['step_index'] == i and identity(packet['frame_rows'])[:16] == packet['frame_hash']
        assert isinstance(packet['frame_packet'], list)
        if i: assert entry['command'] == report['actions'][i - 1]['command']
    captured_observations = {}
    find_observations(report.get('inventorySourceCalls', []), captured_observations)
    observation_cache, observation_receipts = {}, []
    def observation(packet, reference):
        if reference in observation_cache:
            old = observation_cache[reference]
            assert old['rasterDigest'] == identity(packet['frame_rows'])
            return old['value']
        match = re.fullmatch(r'(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)', reference)
        assert match and int(match[2]) == packet['level'] and match[4] == packet['frame_hash']
        value, _ = measure(SimpleNamespace(**packet), int(match[3]), match[1])
        value = plain(value)
        assert value['observation_ref'] == reference
        captured = captured_observations.get(reference)
        if captured is not None: assert value == captured, ('Full public observation mismatch', reference)
        observation_cache[reference] = {'value': value, 'rasterDigest': identity(packet['frame_rows'])}
        observation_receipts.append({'observationRef': reference, 'revision': value['revision'],
            'rasterDigest': identity(packet['frame_rows']), 'observationDigest': identity(value),
            'capturedInventoryObservationMatched': captured is not None})
        return value
    def bounded_source_domain(adapter, rows):
        clock_check()
        fs = fields(rows)
        result = {'fieldCount': len(fs), 'maxNodes': MAX_NODES, 'withinReplayDomain': True,
                  'scope': 'Conservative source-only upper bound before finite search; no captured ranking or node count is an expectation.'}
        if len(fs) != 1 or not adapter.memory.line_goals: return result
        f, depth = fs[0], CONFIG['supported_line_reply_plies']
        length = adapter.memory.line_goals[-1]['candidate_length']
        branches = max(f['shape'])
        node_bound = sum(branches ** d for d in range(1, depth + 1))
        windows = len(line_windows(f['grid'], length))
        terminal = (windows + 1) * (4 ** length) * 100
        numeric_exact = terminal * 2 + depth + f['shape'][0] * f['shape'][1] <= 2 ** 53 - 1
        result.update(maxBranching=branches, replyPlies=depth, nodeUpperBound=node_bound,
            windows=windows, goalLength=length, nativeIntegerDomain=numeric_exact,
            withinReplayDomain=node_bound <= MAX_NODES and numeric_exact)
        return result
    def common_proposal(adapter, value, rows, inputs, remaining):
        domain = bounded_source_domain(adapter, rows)
        if not domain['withinReplayDomain']:
            raise RuntimeError('Original finite replay exceeds its declared conservative completed domain: ' + str(domain))
        p = adapter.propose(copy.deepcopy(value), copy.deepcopy(rows), copy.deepcopy(inputs), remaining, CONFIG)
        if p: adapter.bind(p, SimpleNamespace(bindings={(value['level_epoch'], value['frame_hash'])}))
        return plain(p), domain

    adapter = SupportedLineConstraint()
    result = {'coldStart': True, 'primedFromCapturedProposalMemory': False, 'initialState': state(adapter),
              'prefixes': [], 'steps': [], 'restorations': [], 'differences': [], 'stop': None}
    ablations, batches = [], []
    cursor = captured_count = 0
    for pi, prefix in enumerate(report['prefixes']):
        clock_check()
        captured = prefix.get('observedRecurrentSeries')
        series = prefix.get('sharedSeries', {})
        own_events = series.get('recurrentSeriesAcquiredEvents', [])
        assert isinstance(own_events, list) and all(e['kind'] in OWN for e in own_events)
        captured_count += len(own_events)
        assert series.get('recurrentSeriesEventCount', 0) == captured_count
        sealed, names = transitions(prefix)
        assert sealed
        packet = journal[cursor]['packet']
        value = observation(packet, sealed[0]['before'])
        before_state = state(adapter)
        selected = captured is not None
        inputs = [{'action_ref': a} for a in packet['available_action_refs'] if a != 'ACTION6']
        cap = report['budget']['levelActionCaps'][packet['levels_completed']]
        remaining = cap - sum(a['levelBefore'] == packet['level'] for a in report['actions'][:cursor])
        entry = {'index': pi, 'id': prefix.get('id'), 'position': cursor, 'selectedOwn': selected,
            'family': prefix['family'], 'proposalKind': prefix.get('proposalKind'), 'observationRef': value['observation_ref'],
            'observation': value, 'inputs': inputs, 'remainingActions': remaining, 'sourceStateBefore': before_state}
        p = {}
        if selected:
            native = captured['proposal']
            native_plan = native.get('line_plan') or native['supported_line_plan']
            assert native_plan['observation_ref'] == value['observation_ref'] and remaining > 0
            try:
                p, domain = common_proposal(adapter, value, packet['frame_rows'], inputs, remaining)
            except Exception as error:
                result['stop'] = {'kind': 'source_exception_or_replay_bound', 'phase': 'propose', 'prefixIndex': pi, 'error': error_value(error)}
                break
            assert state(adapter) == before_state
            if not p or p.get('status') != 'proposed':
                result['stop'] = {'kind': 'source_own_proposal_missing', 'prefixIndex': pi, 'source': p}
                break
            diff, extras = compare_complete_source(p, native)
            entry.update(sourceProposal=p, replayDomain=domain, proposalDifferences=diff, nativeAdditionalEnvelopeFields=extras)
            result['differences'].extend(diff)
            if diff:
                result['prefixes'].append(entry)
                result['stop'] = {'kind': 'proposal_difference', 'prefixIndex': pi}
                break
            rebuilt, proof = restore_check(adapter)
            following, _ = common_proposal(rebuilt, value, packet['frame_rows'], inputs, remaining)
            assert following == p
            result['restorations'].append({**proof, 'prefixIndex': pi, 'phase': 'before_selected', 'nextProposalEqual': True})
            for intervention in ['remove_line_trials', 'remove_scored_witnesses', 'remove_insertion_samples',
                                 'remove_public_order', 'remove_refutations', 'remove_last_acquired_return']:
                clock_check()
                history = plain(adapter.events)
                last_size = len(batches[-1]) if batches else 0
                modified = omit(history, intervention, last_size)
                altered = restore(modified)
                item = {'prefixIndex': pi, 'intervention': intervention, 'earlierAcquiredEvents': len(history),
                    'retainedEvents': len(modified), 'removedEvents': len(history) - len(modified), 'lastReturnEventCount': last_size,
                    'actualProjectionDigest': identity(projection(adapter.memory)),
                    'counterfactualProjectionDigest': identity(projection(altered.memory)),
                    'knowledgeChanged': projection(adapter.memory) != projection(altered.memory), 'actual': decision(p),
                    'scope': 'Own component before an actual selected decision; only earlier acquired events omitted, no future evidence, no new action, no full-caller ablation.'}
                try:
                    alternative, domain = common_proposal(altered, value, packet['frame_rows'], inputs, remaining)
                    item.update(executed=True, replayDomain=domain, counterfactual=decision(alternative),
                        actionOrRefusalChanged=action_projection(alternative) != action_projection(p),
                        decisionChanged=decision(alternative) != decision(p), strictProposalChanged=alternative != p)
                except Exception as error:
                    item.update(executed=False, error=error_value(error), actionOrRefusalChanged=None,
                                decisionChanged=None, strictProposalChanged=None)
                ablations.append(item)
        else:
            entry.update(sourceProposal=None, passiveOnly=True,
                qualification='No Repeated/Supported plan selected. Own record consumes no foreign plan fields; actual public return and packet still acquired.')
        # RootedQuota explicitly cuts off older record methods, but not the
        # separately called packet chain. The report identifies that selection.
        cutoff = 'rootedQuotaPhase' in prefix or prefix.get('proposalKind') == 'rooted_quota_experiment'
        entry['ancestralRecordCutoff'] = cutoff
        if selected and cutoff:
            result['stop'] = {'kind': 'mixed_higher_guard_outside_own_scope', 'prefixIndex': pi}
            break
        result['prefixes'].append(entry)
        event_cursor, previous_after = 0, None
        if selected: assert len(sealed) == 1, 'Both recurrent source plans seal one action'
        for index, transition in enumerate(sealed):
            clock_check()
            position = cursor + index
            first, later_packet = journal[position]['packet'], journal[position + 1]['packet']
            if previous_after is not None: assert transition['before'] == previous_after
            before, after = observation(first, transition['before']), observation(later_packet, transition['after'])
            previous_after = after['observation_ref']
            cmd = transition['command']
            assert public_command(cmd) == public_command(journal[position + 1]['command'])
            if selected: assert cmd == p['actions'][index]
            rows, later, frames = first['frame_rows'], later_packet['frame_rows'], later_packet['frame_packet']
            before_meta = {'epoch': before['level_epoch'], 'score': before['levels_completed'],
                           'observation_ref': before['observation_ref'], 'available': before['available_action_refs']}
            after_meta = {'epoch': after['level_epoch'], 'score': after['levels_completed'], 'state': after['state']}
            prior, before_guard, after_guard, outcome_diff = state(adapter), None, None, []
            try:
                if selected:
                    before_guard = plain(adapter.memory.before(p, index, rows, **before_meta))
                    after_guard = plain(adapter.memory.after(p, index, rows, later, **after_meta))
                    assert before_guard['admitted'] and after_guard['seal_prefix']
                    outcome_diff = differences(after_guard, transition['outcome'], f'outcomes[{position}]')
                emitted = [] if cutoff else adapter.memory.record(copy.deepcopy(before), copy.deepcopy(cmd), copy.deepcopy(after),
                    copy.deepcopy(rows), copy.deepcopy(later), copy.deepcopy(p), index)
                packet_events = adapter.memory.record_packet(copy.deepcopy(before), copy.deepcopy(cmd), copy.deepcopy(after),
                    copy.deepcopy(rows), copy.deepcopy(frames), [])
                emitted += packet_events
                assert all(e['kind'] in OWN for e in emitted)
                adapter.events.extend(emitted)
            except Exception as error:
                result['stop'] = {'kind': 'source_exception', 'phase': 'return', 'prefixIndex': pi,
                                  'sequence': position + 1, 'error': error_value(error)}
                break
            emitted = plain(emitted)
            event_diff = differences(emitted, own_events[event_cursor:event_cursor + len(emitted)], f'events[{position}]')
            event_cursor += len(emitted)
            result['differences'].extend(outcome_diff + event_diff)
            batches.append(copy.deepcopy(emitted))
            _, proof = restore_check(adapter)
            result['restorations'].append({**proof, 'prefixIndex': pi, 'phase': 'after_return', 'sequence': position + 1})
            result['steps'].append({'sequence': position + 1, 'prefixIndex': pi, 'index': index, 'selectedOwn': selected,
                'ancestralRecordCutoff': cutoff, 'command': cmd, 'before': before, 'after': after,
                'beforeMeta': before_meta, 'afterMeta': after_meta, 'beforeGuard': before_guard, 'afterGuard': after_guard,
                'capturedOutcome': transition['outcome'], 'guardDifferences': outcome_diff,
                'sourceOwnEvents': emitted, 'packetEventCount': len(packet_events), 'packetFrameCount': len(frames),
                'packetDigest': identity(frames), 'eventDifferences': event_diff,
                'sourceStateBefore': prior, 'sourceStateAfter': state(adapter), 'sealedTransitionSources': names,
                'boundary': before['level_epoch'] != after['level_epoch']})
            if outcome_diff or event_diff:
                result['stop'] = {'kind': 'return_difference', 'prefixIndex': pi, 'sequence': position + 1}
                break
        if result['stop']: break
        if event_cursor != len(own_events):
            result['stop'] = {'kind': 'captured_event_count_difference', 'prefixIndex': pi,
                              'source': event_cursor, 'native': len(own_events)}
            break
        assert len(adapter.events) == captured_count
        cursor += prefix['acquiredActions']
    result['finalState'] = state(adapter)
    _, proof = restore_check(adapter)
    result['restorations'].append({**proof, 'phase': 'final'})
    selected = [p for p in report['prefixes'] if 'observedRecurrentSeries' in p]
    selected_actions = sum(p['acquiredActions'] for p in selected)
    total_events = sum(len(p['sharedSeries'].get('recurrentSeriesAcquiredEvents', [])) for p in report['prefixes'])
    complete = result['stop'] is None and not result['differences'] and len(result['prefixes']) == len(report['prefixes']) and len(result['steps']) == len(report['actions'])
    originals_after = verify_source()
    for item in input_receipts: assert file_record(ROOT / item['path']) == item
    clock_check()
    status = 'passed' if complete and selected else 'no_selected_recurrent_series' if complete else 'failed'
    output = {'schema': 'logos-engine.lot3i.recurrent-series-public-source-parity.v1', 'status': status,
        'startedAt': started, 'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        'game': game, 'sourceCommit': COMMIT, 'sessionPath': label(session), 'inputs': input_receipts,
        'nativeSourceDigest': manifest['digest'], 'nativeFilesVerified': len(manifest['files']),
        'caseSelection': file_record(selection_path), 'caseDeadline': selection['resumeDeadline'], 'config': CONFIG,
        'originalFilesVerifiedBefore': originals_before, 'originalFilesVerifiedAfter': originals_after,
        'capturedGameActions': len(journal) - 1, 'capturedSelectedRecurrentActions': selected_actions,
        'capturedSelectedRecurrentPrefixes': len(selected), 'capturedAllRecurrentEvents': total_events,
        'newGameActions': 0, 'levelJumps': 0, 'fullInheritedCallerParity': False,
        'completeSelectedOwnTrajectoryParity': complete and bool(selected), 'completeAllReturnAcquisitionParity': complete,
        'originalObservationReceipts': observation_receipts, 'exactOriginal': result, 'capturedCommonTerminal': report['final'],
        'ablation': {'scope': 'unchanged_original_component_before_actual_selected_decisions', 'interventions': len(ablations),
            'executed': sum(a['executed'] for a in ablations), 'unexecuted': sum(not a['executed'] for a in ablations),
            'knowledgeChanges': sum(a['knowledgeChanged'] for a in ablations),
            'actionOrRefusalChanges': sum(a.get('actionOrRefusalChanged') is True for a in ablations),
            'decisionChanges': sum(a.get('decisionChanged') is True for a in ablations),
            'strictOnlyChanges': sum(a.get('strictProposalChanged') is True and not a.get('decisionChanged') for a in ablations),
            'negativeOrUnchanged': sum(a['executed'] and not a.get('actionOrRefusalChanged') for a in ablations), 'cases': ablations},
        'qualification': 'Repeated/Supported memory starts cold. Every selected source proposal property is compared, own plans/actions/bundle strictly. All public returns and frame packets, including foreign selections, drive own acquisition. RootedQuota older-record cutoff remains explicit. Mixed higher plans are refused rather than silently assigned an own guard. Parent event families, global scheduler, full caller ablation and live timing are not claimed. Source search uses a conservative source-only finite upper bound and exact-integer domain; incomplete or refused cases remain evidence. Counterfactuals omit only earlier own events and retain negatives. Captured official outcome stays separate; no game, engine, specification, solution or native module is executed.'}
    target = args.output.resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    data = gzip.compress(json.dumps(output, separators=(',', ':'), ensure_ascii=False).encode(), mtime=0)
    with target.open('xb') as stream: stream.write(data)
    print(json.dumps({'status': status, 'output': label(target), 'bytes': len(data), 'sha256': sha(data),
        'prefixes': len(result['prefixes']), 'selectedPrefixes': len(selected), 'returns': len(result['steps']),
        'events': result['finalState']['eventCount'], 'differences': len(result['differences']), 'stop': result['stop'],
        'ablations': len(ablations), 'actionOrRefusalChanges': output['ablation']['actionOrRefusalChanges']}))
    if status != 'passed': raise SystemExit(1)


if __name__ == '__main__': main()
