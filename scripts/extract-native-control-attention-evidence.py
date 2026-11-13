#!/usr/bin/env python3
"""Index control/attention attribution in a completed public campaign capture.

Reads only captured report/trace/execution/journal/manifests. It imports no agent
or game, executes no action and infers no unobserved completion or causal proof.
Report JSON pointers keep every compact projection auditable in the full logs.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ('acquireControlForTarget', 'attentionParentReturnOffer', 'currentInformationOffer')
GROUPS = ('morphology', 'attention_parent_return', 'information_goal', 'acquire_control_for_target')
EXPERIMENTS = ('replicate_translation', 'sample_unused_control', 'replicate_after_contextual_block')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def packet_digest(packet):
    # The passive campaign recorder uses this fixed public field order.
    ordered = {key: packet[key] for key in ('frame_rows', 'frame_packet', 'level', 'levels_completed',
        'state', 'step_index', 'available_action_refs', 'frame_hash')}
    return hashlib.sha256(json.dumps(ordered, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def bytes_for(path):
    if path.is_file():
        return path.read_bytes()
    parts_path = Path(str(path) + '.parts.json')
    if not parts_path.is_file():
        raise FileNotFoundError(f'Completed campaign evidence is not available: {path}')
    description = json.loads(parts_path.read_text())
    chunks = []
    for part in description['parts']:
        part_path = ROOT / part['path'] if 'path' in part else path.parent / part['file']
        if not part_path.is_file():
            part_path = path.parent / Path(part.get('path', part.get('file', ''))).name
        data = part_path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == part['sha256'], part_path
        chunks.append(data)
    data = b''.join(chunks)
    expected = description.get('sha256') or description.get('original', {}).get('sha256')
    if expected:
        assert hashlib.sha256(data).hexdigest() == expected, path
    return data


def proof(path, data=None):
    data = bytes_for(path) if data is None else data
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def load(path):
    data = bytes_for(path)
    text = gzip.decompress(data) if path.name.endswith('.gz') else data
    return json.loads(text), proof(path, data)


def pick(value, keys):
    return {key: value[key] for key in keys if key in value} if isinstance(value, dict) else None


def increment(table, key, prefixes=0, actions=0):
    key = key if isinstance(key, str) else '(not captured)'
    row = table.setdefault(key, {'sealedPrefixes': 0, 'actionsInSealedPrefixes': 0})
    row['sealedPrefixes'] += prefixes
    row['actionsInSealedPrefixes'] += actions


def morphology_summary(value):
    if not isinstance(value, dict):
        return None
    answer = pick(value, ['status', 'reason', 'route_key', 'composition', 'access_phase', 'contact_in_prefix'])
    facts = value.get('measured_facts') or {}
    answer['measured'] = pick(facts, ['observation_ref', 'level_epoch', 'pair_ref', 'control_attested',
        'framed_pair', 'homologous', 'asymmetric', 'alignment_refuted'])
    answer['measuredRoutes'] = list((facts.get('routes') or {}).keys())
    return answer


def attention_summary(value):
    return pick(value, ['id', 'status', 'parent', 'pair_ref', 'level_epoch', 'opened_at', 'returned_at',
        'action_ref', 'experiment', 'result', 'reason', 'release_authority'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game', help='Public campaign identifier; used only to locate its files')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--examples', type=int, default=8, help='Maximum first attribution chains; counts always cover the full capture')
    args = parser.parse_args()
    assert 1 <= args.examples <= 30
    directory = args.directory.resolve()
    stem = args.game.lower()
    destination = args.output.resolve() if args.output else directory / f'{stem}-control-attention-attribution.json'
    if destination.exists():
        raise FileExistsError(destination)
    paths = {key: directory / name for key, name in [
        ('report', f'{stem}-campaign.json.gz'), ('trace', f'{stem}-public-trace.json.gz'),
        ('execution', f'execution-{stem}.json'), ('manifest', 'source-manifest.json')]}
    loaded = {key: load(path) for key, path in paths.items()}
    report, trace, execution, manifest = (loaded[key][0] for key in paths)
    evidence = {key: value[1] for key, value in loaded.items()}
    assert report['status'] in ('passed', 'failed'), 'A running capture cannot establish final attribution'
    assert report['game'] == trace['game'] == args.game
    assert trace['status'] == report['status']
    assert report['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    assert report['source'] == execution['nativeSource'] == execution['nativeSourceAfter'] == manifest
    assert manifest['digest'] == digest(manifest['files']) and manifest['fileCount'] == len(manifest['files'])
    assert trace['sourceDigest'] == execution['nativeSourceManifestDigest'] == manifest['digest']
    assert execution['executionInputs'] == execution['executionInputsAfter']
    assert execution['report'] == evidence['report'] and execution['trace'] == evidence['trace']
    assert report['pythonAgentModules'] == [], 'This receipt is for a native-only decision campaign'

    if execution.get('publicJournal'):
        journal_path = ROOT / execution['publicJournal']['path']
        journal_data = bytes_for(journal_path)
        evidence['journal'] = proof(journal_path, journal_data)
        assert execution['publicJournal'] == evidence['journal']
        journal = [json.loads(line) for line in gzip.decompress(journal_data).splitlines() if line]
        assert journal == trace['packets'], 'The trace must equal the actual append-only public journal'
        del journal, journal_data
    archive_path = directory / 'source-archive.json'
    if archive_path.is_file():
        archive, evidence['archiveManifest'] = load(archive_path)
        assert archive['nativeSourceManifestDigest'] == manifest['digest']
        for item in execution['executionInputs'].values():
            if item['path'] in archive['files']:
                assert archive['files'][item['path']] == item['sha256']

    actions, prefixes, packets = report['actions'], report['prefixes'], trace['packets']
    assert 'controlAttentionSourceCalls' in report and 'morphologySourceCalls' in report, 'Required passive instrumentation is absent'
    assert all('controlAttention' in prefix and 'selectionGroup' in prefix for prefix in prefixes), 'Missing prefix instrumentation is not evidence of zero usage'
    assert report['final']['actions'] == len(actions) == len(packets) - 1
    assert packets[0]['command'] is None
    for ordinal, (action, entry) in enumerate(zip(actions, packets[1:]), 1):
        packet = entry['packet']
        assert action['sequence'] == ordinal == packet['step_index']
        assert action['command'] == entry['command']
        assert action['publicPacketSha256'] == packet_digest(packet)
        assert action['frameHash'] == packet['frame_hash']
        assert (action['levelAfter'], action['completedAfter'], action['state']) == (packet['level'], packet['levels_completed'], packet['state'])
    final_packet = packets[-1]['packet']
    assert (report['final']['level'], report['final']['levelsCompleted'], report['final']['state']) == (
        final_packet['level'], final_packet['levels_completed'], final_packet['state'])

    by_decision = defaultdict(list)
    for action_index, action in enumerate(actions):
        by_decision[action['decisionRevision']].append((action_index, action))
    group_counts, family_counts, mode_counts, groups_by_level = {}, {}, {}, {}
    morphology_selected_status = Counter()
    deferrals = Counter()
    attention_states, opened, consumed, acquisition_results = {}, {}, {}, {}
    chain_candidates = []
    public_boundaries = []
    level_counts = {}
    for index, action in enumerate(actions):
        level = str(action['levelBefore'])
        level_counts.setdefault(level, {'actions': 0, 'firstAction': action['sequence'], 'lastAction': action['sequence']})
        level_counts[level]['actions'] += 1
        level_counts[level]['lastAction'] = action['sequence']
        if action['completedAfter'] > action['completedBefore']:
            public_boundaries.append({'action': action['sequence'], 'levelBefore': action['levelBefore'], 'levelAfter': action['levelAfter'],
                'completedBefore': action['completedBefore'], 'completedAfter': action['completedAfter'], 'state': action['state'],
                'evidence': {'report': f'/actions/{index}', 'trace': f'/packets/{index + 1}'}})

    def retain_attention(item, pointer):
        if not item:
            return
        value = attention_summary(item)
        key = digest(value)
        if key not in attention_states:
            attention_states[key] = {'item': value, 'evidence': [pointer]}
        elif len(attention_states[key]['evidence']) < 3 and pointer not in attention_states[key]['evidence']:
            attention_states[key]['evidence'].append(pointer)

    calls = report.get('controlAttentionSourceCalls', [])
    call_counts = {method: {'calls': 0, 'nonNullResults': 0, 'errors': 0, 'inspectionCalls': 0, 'inspectionNonNullResults': 0} for method in METHODS}
    inspected_modes, proposed_modes = Counter(), Counter()
    calls_by_observation = defaultdict(list)
    for array_index, event in enumerate(calls):
        method = event['method']
        if method not in call_counts:
            continue
        pointer = f'/controlAttentionSourceCalls/{array_index}'
        args_ = event['arguments']
        current = event.get('current') or args_[0]['observation_ref']
        calls_by_observation[current].append((array_index, event))
        count = call_counts[method]
        count['calls'] += 1
        count['errors'] += int('error' in event)
        positive = event.get('result') is not None
        count['nonNullResults'] += int(positive)
        inspection = method == 'acquireControlForTarget' and len(args_) > 4 and bool(args_[4].get('inspectOnly'))
        if inspection:
            count['inspectionCalls'] += 1
            count['inspectionNonNullResults'] += int(positive)
            if positive:
                inspected_modes[event['result'].get('experiment', '(missing)')] += 1
        elif method == 'acquireControlForTarget' and positive:
            acquisition = (event['result'].get('question') or {}).get('control_acquisition')
            if acquisition:
                proposed_modes[acquisition.get('experiment', '(missing)')] += 1
        before = (event.get('attentionBefore') or {}).get('item')
        after = (event.get('attentionAfter') or {}).get('item')
        retain_attention(before, pointer + '/attentionBefore/item')
        retain_attention(after, pointer + '/attentionAfter/item')
        if after and after['status'] == 'pending' and (not before or before['id'] != after['id'] or before['status'] != 'pending'):
            opened.setdefault(after['id'], {'attention': attention_summary(after), 'evidence': pointer + '/attentionAfter/item', 'method': method})

    morph_calls, morph_decisions, morph_reasons, morph_by_observation = Counter(), Counter(), Counter(), defaultdict(list)
    for index, event in enumerate(report.get('morphologySourceCalls', [])):
        morph_calls[event['method']] += 1
        if event['method'] != 'propose':
            continue
        current = event.get('current') or event['arguments'][0]['observation_ref']
        morph_by_observation[current].append((index, event))
        decision = event.get('currentDecision')
        morph_decisions[(decision or {}).get('status', '(no current decision captured)')] += 1
        morph_reasons[(decision or {}).get('reason', '(no current decision captured)')] += 1

    acquired_total = 0
    for index, prefix in enumerate(prefixes):
        pointer = f'/prefixes/{index}'
        acquired = prefix['acquiredActions']
        acquired_total += acquired
        increment(group_counts, prefix.get('selectionGroup'), 1, acquired)
        increment(family_counts, prefix.get('family'), 1, acquired)
        source_actions = by_decision[prefix['decisionRevision']]
        assert len(source_actions) >= acquired, 'A sealed prefix cannot acquire more actions than were dispatched'
        source_actions = source_actions[:acquired]
        for level, count in Counter(str(action['levelBefore']) for _, action in source_actions).items():
            increment(groups_by_level.setdefault(level, {}), prefix.get('selectionGroup'), 1, count)
        control = prefix.get('controlAttention') or {}
        current_decision = control.get('morphology')
        if current_decision:
            morphology_selected_status[current_decision.get('status', '(missing)')] += 1
        for refusal in control.get('deferredCuriosity') or []:
            deferrals[refusal.get('reason', '(missing)')] += 1
        direct, shared = control.get('controlAcquisition'), control.get('sharedControl')
        question = direct or shared
        if question:
            key = question.get('experiment', '(missing)')
            increment(mode_counts, key, 1, acquired)
            mode_counts[key].setdefault('directPrefixes', 0)
            mode_counts[key].setdefault('sharedInformationPrefixes', 0)
            mode_counts[key]['directPrefixes'] += int(direct is not None)
            mode_counts[key]['sharedInformationPrefixes'] += int(shared is not None)
        item = (control.get('acquiredAttention') or {}).get('item')
        retain_attention(item, pointer + '/controlAttention/acquiredAttention/item')
        returned = control.get('returnedAttention')
        if returned:
            consumed.setdefault(digest(returned), {'attention': attention_summary(returned), 'selectedGroup': prefix.get('selectionGroup'),
                'prefix': prefix['id'], 'evidence': pointer + '/controlAttention/returnedAttention'})

        transitions = (prefix.get('inventoryAcquisition') or {}).get('transitions')
        if transitions is None:
            transitions = (prefix.get('recolorAcquisition') or {}).get('transitions')
        if transitions is None:
            transitions = (prefix.get('compositionAttention') or {}).get('transitions')
        transitions = transitions or []
        assert not transitions or len(transitions) == acquired
        for offset, transition in enumerate(transitions):
            action_index, action = source_actions[offset]
            command = transition.get('command')
            if command:
                assert {'action_ref': command['action_ref'], 'data': command.get('data', {})} == action['command']
            if item and item.get('returned_at') == transition['after'] and item.get('status') in ('matched', 'contradicted', 'unobserved', 'boundary', 'superseded'):
                acquisition_results.setdefault(digest(attention_summary(item)), {
                    'attention': attention_summary(item), 'transitionBefore': transition['before'], 'transitionAfter': transition['after'],
                    'action': action['sequence'], 'evidence': pointer + '/controlAttention/acquiredAttention/item'})

        categories = []
        if question:
            categories.append(('shared_information:' if shared and not direct else 'control:') + question.get('experiment', '(missing)'))
            if question.get('attention_ref'):
                categories.append('focused_control:' + question.get('experiment', '(missing)'))
            if question.get('recalled_method'):
                categories.append('recalled_control:' + question.get('experiment', '(missing)'))
        if control.get('deferredCuriosity'):
            categories.extend('information_deferred:' + refusal.get('reason', '(missing)') for refusal in control['deferredCuriosity'])
        if returned:
            categories.append('parent_return:' + returned.get('status', '(missing)'))
        if prefix.get('selectionGroup') == 'morphology':
            categories.append('selected_morphology')
        if not categories:
            continue
        before_ref = (question or {}).get('observation_ref') or ((current_decision or {}).get('measured_facts') or {}).get('observation_ref')
        before_ref = before_ref or (transitions[0].get('before') if transitions else None)
        after_ref = transitions[-1].get('after') if transitions else None
        evaluated = morph_by_observation.get(before_ref, [])
        consumer_calls = calls_by_observation.get(before_ref, [])
        next_prefix = prefixes[index + 1] if index + 1 < len(prefixes) else None
        chain = {'categories': categories, 'prefix': prefix['id'], 'decisionRevision': prefix['decisionRevision'],
            'selectionGroup': prefix.get('selectionGroup'), 'family': prefix.get('family'),
            'firstAction': source_actions[0][1]['sequence'] if source_actions else None,
            'lastAction': source_actions[-1][1]['sequence'] if source_actions else None,
            'decision': morphology_summary(current_decision), 'question': question,
            'questionKind': 'shared_information' if shared and not direct else 'direct_control' if direct else None,
            'deferredCuriosity': control.get('deferredCuriosity') or [], 'parentReturn': attention_summary(returned),
            'acquisition': {'count': acquired, 'before': before_ref, 'after': after_ref,
                'publicScoreBefore': source_actions[0][1]['completedBefore'] if source_actions else None,
                'publicScoreAfter': source_actions[-1][1]['completedAfter'] if source_actions else None,
                'attentionAtSealedCheckpoint': attention_summary(item)},
            'continuation': {'nextSealedPrefix': next_prefix['id'] if next_prefix else None,
                'selectedGroup': next_prefix.get('selectionGroup') if next_prefix else None,
                'controlQuestion': ((next_prefix.get('controlAttention') or {}).get('controlAcquisition')
                    or (next_prefix.get('controlAttention') or {}).get('sharedControl')) if next_prefix else None,
                'returnedAttention': attention_summary((next_prefix.get('controlAttention') or {}).get('returnedAttention')) if next_prefix else None,
                'nextCurrentMorphology': morphology_summary(morph_by_observation[after_ref][0][1].get('currentDecision')) if morph_by_observation.get(after_ref) else None},
            'evidence': {'reportPrefix': pointer, 'morphologyEvaluations': [f'/morphologySourceCalls/{n}' for n, _ in evaluated],
                'consumerCalls': [{'path': f'/controlAttentionSourceCalls/{n}', 'method': event['method'], 'entryIndex': event['index'],
                    'nonNullResult': event.get('result') is not None} for n, event in sorted(consumer_calls, key=lambda row: row[1]['index'])],
                'actions': [f'/actions/{n}' for n, _ in source_actions],
                'publicReturns': [f'/packets/{action["sequence"]}' for _, action in source_actions]}}
        chain_candidates.append(chain)

    selected_chains, represented = [], set()
    for chain in chain_candidates:
        if len(selected_chains) >= args.examples:
            break
        fresh = set(chain['categories']) - represented
        if fresh:
            selected_chains.append(chain)
            represented.update(chain['categories'])
    for group in GROUPS:
        group_counts.setdefault(group, {'sealedPrefixes': 0, 'actionsInSealedPrefixes': 0})
    for experiment in EXPERIMENTS:
        mode_counts.setdefault(experiment, {'sealedPrefixes': 0, 'actionsInSealedPrefixes': 0, 'directPrefixes': 0, 'sharedInformationPrefixes': 0})
    state_rows = list(attention_states.values())
    output = {'schema': 'logos-engine.native-control-attention-attribution.v1', 'generatedAt': datetime.now(timezone.utc).isoformat(),
        'game': args.game, 'evidence': evidence,
        'extractor': proof(Path(__file__)),
        'source': {'referenceCommit': report['referenceCommit'], 'nativeManifestDigest': manifest['digest'], 'nativeFileCount': manifest['fileCount'],
            'unchangedDuringRun': True, 'executionInputsUnchanged': True, 'executionInputs': execution['executionInputs'], 'pythonAgentModules': []},
        'outcome': {'campaignStatus': report['status'], 'failure': report.get('failure'), 'targetLevels': report['targetLevels'],
            'levelsCompleted': report['final']['levelsCompleted'], 'targetCompleted': report['final']['levelsCompleted'] >= report['targetLevels'],
            'fullGameWinObserved': final_packet['state'] == 'WIN', 'finalState': final_packet['state'], 'actions': len(actions),
            'sealedPrefixes': len(prefixes), 'acquiredActionsInCapturedPrefixes': acquired_total,
            'unattributedDispatchedActions': len(actions) - acquired_total,
            'prefixCaptureMatchesRuntimeCount': len(prefixes) == report['final']['prefixes'],
            'elapsedSeconds': execution['elapsedSeconds'], 'activeSeconds': report['final'].get('activeSeconds'),
            'startedAt': execution['startedAt'], 'finishedAt': execution['finishedAt']},
        'publicProgression': {'perSourceLevel': level_counts, 'scoreIncreases': public_boundaries},
        'selectedProviders': {'groups': group_counts, 'families': family_counts, 'groupsBySourceLevel': groups_by_level,
            'zeroSelectionAmongRelevantGroups': [group for group in GROUPS if group_counts[group]['sealedPrefixes'] == 0]},
        'morphology': {'sourceMethodCalls': dict(morph_calls), 'currentDecisionStatusesDuringEvaluation': dict(morph_decisions),
            'currentDecisionReasonsDuringEvaluation': dict(morph_reasons), 'decisionStatusesAttachedToSelectedPrefixes': dict(morphology_selected_status)},
        'control': {'methodCalls': call_counts, 'inspectionResultExperiments': dict(inspected_modes),
            'proposedResultExperiments': dict(proposed_modes), 'selectedQuestionExperiments': mode_counts,
            'deferralReasonsOnSelectedPrefixes': dict(deferrals)},
        'attention': {'observedOpenings': list(opened.values()), 'uniqueItemStates': len(state_rows),
            'uniqueItemStateStatusCounts': dict(Counter(row['item']['status'] for row in state_rows)),
            'acquiredReturnStatusCounts': dict(Counter(row['attention']['status'] for row in acquisition_results.values())),
            'acquiredReturnWitnesses': list(acquisition_results.values()),
            'consumedReturnStatusCounts': dict(Counter(row['attention']['status'] for row in consumed.values())),
            'consumedReturns': list(consumed.values()),
            'consumedReturnsSelectedByParentProvider': sum(row['selectedGroup'] == 'attention_parent_return' for row in consumed.values()),
            'firstObservedStates': state_rows[:12]},
        'firstAttributionChains': selected_chains,
        'qualifications': [
            'Counts describe the complete captured run; first chains and first states are bounded examples with JSON pointers into the hashed report.',
            'A method call, a non-null offer, a selected sealed prefix and its acquired actions are separate counts. Inspection can return a control question without selecting or dispatching it.',
            'Nested calls are recorded independently. Their append order can differ from call-entry order; entryIndex is retained for ordering within the instrumented caller.',
            'ActionsInSealedPrefixes attributes the prefix, not one separately confirmed control experiment per action.',
            'Attention item states are deduplicated across observations of the same persisted state. Acquired-return witnesses additionally require returned_at to match an acquired transition after-reference.',
            'The motion attention item is separate from the composition attention owner; composition attention is not counted as a control return.',
            'A zero selected-provider count means no selected sealed prefix in this capture. Method-call counts separately show evaluation; no failure of the provider is inferred.',
            'Official progress comes only from public score/state returns. Participation of a provider does not establish that it alone caused completion; no ablation or hypothetical success is inferred.',
            'No solver, game implementation, private state, native source mutation or action execution is used by this extractor.',
        ]}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': proof(destination), 'outcome': output['outcome'], 'groups': group_counts,
        'controlExperiments': mode_counts, 'attentionAcquiredReturns': output['attention']['acquiredReturnStatusCounts'],
        'attentionConsumedReturns': output['attention']['consumedReturnStatusCounts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
