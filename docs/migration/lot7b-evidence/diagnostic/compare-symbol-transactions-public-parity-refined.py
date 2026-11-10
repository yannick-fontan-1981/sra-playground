#!/usr/bin/env python3
"""Replay actual captured Symbols calls with one cold original Python owner.

Propose, actual before/after guards and selected records are all replayed in
captured order. Native states are comparison targets only. Causal ablations
branch from independently acquired original state and never alter the replay.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CALLER_PROPOSAL_FIELDS = frozenset({
    'material_access_subquestion', 'strategy_receipt', 'morphology', 'composition_target_tree',
})
sys.dont_write_bytecode = True
BYTECODE = tempfile.TemporaryDirectory(prefix='symbols-public-parity-')
sys.pycache_prefix = BYTECODE.name

def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value
def canonical(value): return json.dumps(plain(value), sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
def digest(value): return hashlib.sha256(canonical(value).encode()).hexdigest()
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def differences(expected, actual, path='$', limit=24):
    expected, actual = plain(expected), plain(actual)
    if canonical(expected) == canonical(actual): return []
    if isinstance(expected, dict) and isinstance(actual, dict):
        out = []
        for key in sorted(expected.keys() | actual.keys()):
            if key not in expected or key not in actual:
                out.append({'path': path + '.' + key, 'expected': expected.get(key, '<absent>'), 'actual': actual.get(key, '<absent>')})
            else: out += differences(expected[key], actual[key], path + '.' + key, limit - len(out))
            if len(out) >= limit: break
        return out
    if isinstance(expected, list) and isinstance(actual, list):
        out = []
        if len(expected) != len(actual): out.append({'path': path + '.length', 'expected': len(expected), 'actual': len(actual)})
        for index, (a, b) in enumerate(zip(expected, actual)):
            out += differences(a, b, path + '[' + str(index) + ']', limit - len(out))
            if len(out) >= limit: break
        return out
    return [{'path': path, 'expected': expected, 'actual': actual}]
def decision(value):
    if value is None: return None
    plan = value.get('symbol_transaction_plan', {}); offer = plan.get('interface_offer') or {}
    return {'kind': value.get('kind'), 'actions': value.get('actions'), 'mode': plan.get('mode'),
            'methodRef': offer.get('method_ref'),
            'offerKind': (plan.get('measured_facts') or {}).get('offer_kind'),
            'goal': (plan.get('conclusions') or {}).get('active_goal_ref')}
def write(path, value):
    if path.exists(): raise FileExistsError(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(value, indent=None if path.suffix == '.gz' else 2, ensure_ascii=False,
                      separators=(',', ':') if path.suffix == '.gz' else None, allow_nan=False) + '\n').encode()
    path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == '.gz' else raw)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', required=True)
    parser.add_argument('--out-dir', required=True)
    parser.add_argument('--label', default='symbols')
    parser.add_argument('--require-checkpoints', action='store_true',
                        help='Require every selected prefix to retain its actual graph checkpoint, source fact and event.')
    args = parser.parse_args(); started = time.monotonic()
    report_path, out_dir = ROOT / args.report, ROOT / args.out_dir
    report = json.loads(gzip.decompress(report_path.read_bytes()) if report_path.suffix == '.gz' else report_path.read_bytes())
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    def verify():
        for name, record in manifest.items(): assert sha(SOURCE / name) == record['sha256'], name
    verify()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions
    from observed_input_domain import ObservedInputDomain
    common_policy = json.loads((SOURCE / 'agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json').read_bytes())
    point_limit = common_policy['input_domain']['max_point_occurrences']
    owner = SymbolTransactions(); cold = plain(owner.state())
    assert cold['epoch'] is None and cold['interface_state']['methods'] == []
    selected_prefixes = [p for p in report['prefixes'] if p['family'] == 'public_symbol_transaction']
    selected_revisions = {p['decisionRevision'] for p in selected_prefixes}
    selected_actions = [action for action in report['actions'] if action['family'] == 'public_symbol_transaction']
    calls = report['symbolSourceCalls']; comparisons = []; selected = []; ablations = []
    records = Counter(); transitions = Counter(); persistence_roundtrips = 0
    source_records = {}; states_after_calls = {}; bound_source_proposals = {}; binding_projection_errors = {}
    layers = ['rejected', 'transition_count', 'interface.samples', 'interface.contrasts', 'interface.methods',
              'interface.refutations', 'interface.bound', 'all_interface_knowledge']
    for index, call in enumerate(calls):
        assert call['index'] == index
        before = plain(owner.state()); arguments = copy.deepcopy(call['arguments'])
        method = {'proposeSource': 'propose', 'recordSource': 'record', 'before': 'before', 'after': 'after'}[call['method']]
        if method == 'before': arguments[2] = SimpleNamespace(**arguments[2])
        value = plain(getattr(owner, method)(*arguments)); after = plain(owner.state())
        states_after_calls[index + 1] = copy.deepcopy(after)
        checks = {'beforeState': canonical(before) == canonical(call['sourceBefore']),
                  'returnValue': canonical(value) == canonical(call['result']),
                  'afterState': canonical(after) == canonical(call['sourceAfter'])}
        comparisons.append({'index': index, 'method': call['method'], 'checks': checks, 'matched': all(checks.values()),
            'beforeSha256': digest(before), 'resultSha256': digest(value), 'afterSha256': digest(after),
            'differences': {key: differences(expected, actual) for key, expected, actual in [
                ('beforeState', call['sourceBefore'], before), ('returnValue', call['result'], value),
                ('afterState', call['sourceAfter'], after)] if canonical(expected) != canonical(actual)}})
        if method == 'record':
            active = len(arguments) > 5 and arguments[5] is not None and 'symbol_transaction_plan' in arguments[5]
            records['active' if active else 'foreign'] += 1
            transitions[(arguments[0]['observation_ref'], arguments[1]['observation_ref'])] += 1
            source_records[arguments[0]['revision']] = {'before': arguments[0], 'after': arguments[1],
                'command': arguments[2], 'proposal': copy.deepcopy(arguments[5]) if len(arguments) > 5 else None,
                'actionIndex': arguments[6] if len(arguments) > 6 else 0,
                'event': value, 'state': after, 'callIndex': index}
            # The original common caller exports/restores this selected source
            # fact after its other acquisitions. Only this owner's own state
            # is round-tripped, never a captured native checkpoint.
            owner.restore(copy.deepcopy(after)); persistence_roundtrips += 1
        if method != 'propose' or value is None or arguments[0]['revision'] not in selected_revisions: continue
        # Reproduce only the real, pure point-binding adaptation with the
        # unchanged original input domain. All source proposal fields outside
        # that adaptation remain exact; no native binding is an expected value.
        try:
            domain = ObservedInputDomain(point_limit)
            domain.candidates(copy.deepcopy(arguments[0]))
            bound = copy.deepcopy(value)
            domain.bind_proposal(bound)
            bound_source_proposals[index] = plain(bound)
        except Exception as error:
            binding_projection_errors[index] = {'type': type(error).__name__, 'message': str(error)}
        selected.append({'callIndex': index, 'revision': arguments[0]['revision'], 'epoch': arguments[0]['level_epoch'],
                         'decision': decision(value), 'proposalSha256': digest(value), 'sourceStateSha256': digest(before),
                         'ruleRefs': value['symbol_transaction_plan']['rule_refs'],
                         'knowledgeBefore': {'rejected': len(before['rejected']), 'transition_count': before['transition_count'],
                             **{key: len(before['interface_state'][key]) for key in ['samples', 'contrasts', 'methods', 'refutations']}}})
        for layer in layers:
            counterfactual = SymbolTransactions(); state = copy.deepcopy(before)
            if layer == 'rejected': state['rejected'] = []
            elif layer == 'transition_count': state['transition_count'] = 0
            elif layer == 'all_interface_knowledge':
                for key in ['samples', 'contrasts', 'methods', 'refutations']: state['interface_state'][key] = []
                state['interface_state']['bound'] = None
            else:
                key = layer.split('.')[1]; state['interface_state'][key] = None if key == 'bound' else []
            counterfactual.restore(state)
            try:
                alternative = plain(counterfactual.propose(*copy.deepcopy(arguments)))
                classification = 'unchanged' if alternative == value else 'proposal_removed' if alternative is None else (
                    'decision_changed' if decision(alternative) != decision(value) else 'same_decision_different_evidence')
                ablations.append({'callIndex': index, 'removedLayer': layer, 'classification': classification,
                                  'decision': decision(alternative), 'proposalSha256': digest(alternative),
                                  'proposalRemoved': alternative is None,
                                  'physicalActionChanged': alternative is not None and canonical(alternative['actions']) != canonical(value['actions']),
                                  'ruleRefs': alternative['symbol_transaction_plan']['rule_refs'] if alternative else None})
            except Exception as error:
                ablations.append({'callIndex': index, 'removedLayer': layer, 'classification': 'counterfactual_exception',
                                  'error': {'type': type(error).__name__, 'message': str(error)}})
    verify()
    source_hashes = {name: record['sha256'] for name, record in manifest.items() if '/symbol_transactions/' in name
                    or name.endswith('/concentric_frames.py') or name.endswith('/symbolic_diagrams.py')
                    or name.endswith('/guarded_binding/geometry.py')
                    or name.endswith('/laya_proto/observed_input_domain.py')
                    or name.endswith('/laya_proto/common_frontier_policy.drm.json')}
    campaign = {'path': report_path.relative_to(ROOT).as_posix(), 'sha256': sha(report_path),
                'sourceDigest': report['source']['digest'], 'sourceUnchangedDuringRun': report['sourceUnchangedDuringRun'],
                'game': report['game'], 'actions': len(report['actions']), 'levelsCompleted': report['final']['levelsCompleted'],
                'status': report['status'], 'reason': report['final']['reason'], 'elapsedSeconds': report['elapsedSeconds']}
    duplicates = [{'before': a, 'after': b, 'count': n} for (a, b), n in transitions.items() if n != 1]
    def public_command(command):
        assert set(command) <= {'action_ref', 'data'}
        return {'action_ref': command['action_ref'], 'data': copy.deepcopy(command.get('data', {}))}
    expected_returns = [{'sequence': action['sequence'], 'actionIndex': action['actionIndex'],
                         'decisionRevision': action['decisionRevision'], 'command': action['command'],
                         'levelBefore': action['levelBefore'], 'levelAfter': action['levelAfter'],
                         'afterFrameHash': action['frameHash']} for action in selected_actions]
    actual_returns = []
    before_guard_revisions, after_guard_revisions = set(), set()
    for call in calls:
        arguments = call['arguments']
        if call['method'] == 'before' and call['result'].get('admitted') is True:
            before_guard_revisions.add(arguments[3]['revision'])
        if call['method'] == 'after': after_guard_revisions.add(arguments[2]['revision'])
        if call['method'] != 'recordSource': continue
        before, after, command, _, _, proposal = arguments[:6]
        index = arguments[6] if len(arguments) > 6 else 0
        assert after['revision'] == before['revision'] + 1
        actual_returns.append({'sequence': before['revision'], 'actionIndex': index,
                               'decisionRevision': before['revision'] - index, 'command': public_command(command),
                               'levelBefore': before['level_epoch'], 'levelAfter': after['level_epoch'],
                               'afterFrameHash': after['frame_hash']})
    expected_sequences = {action['sequence'] for action in selected_actions}
    def source_proposal_link(proposed, committed):
        proof = {'proposeCallIndex': proposed['index'], 'matched': False,
                 'projection': 'original_observed_input_domain_binding_and_explicit_caller_annotations'}
        if 'preservation' in committed or 'preservation_rejected_candidates' in committed:
            proof['reason'] = 'caller_preservation_projection_not_covered'
            return proof
        expected = bound_source_proposals.get(proposed['index'])
        if expected is None:
            proof['reason'] = 'original_point_binding_failed'
            proof['error'] = binding_projection_errors.get(proposed['index'])
            return proof
        extra = set(committed) - set(expected)
        proof['callerAnnotationFields'] = sorted(extra)
        if set(expected) - set(committed) or extra - CALLER_PROPOSAL_FIELDS:
            proof['reason'] = 'source_fields_missing_or_unknown_caller_fields'
            return proof
        if committed.get('material_access_subquestion') != 'observed_symbol_transaction':
            proof['reason'] = 'wrong_symbol_source_entry'
            return proof
        projected = {key: value for key, value in committed.items() if key not in extra}
        proof['matched'] = canonical(projected) == canonical(expected)
        proof['reason'] = 'exact_original_bound_source_proposal' if proof['matched'] else 'bound_source_proposal_changed'
        proof['expectedSha256'], proof['actualSha256'] = digest(expected), digest(projected)
        return proof
    ordered_guard_rows = []
    for action in selected_actions:
        sequence, index = action['sequence'], action['actionIndex']
        selected_records = [call for call in calls if call['method'] == 'recordSource'
            and call['arguments'][0]['revision'] == sequence
            and (call['arguments'][6] if len(call['arguments']) > 6 else 0) == index
            and canonical(public_command(call['arguments'][2])) == canonical(action['command'])]
        matched = False; witnesses = None; projection_attempts = []
        if len(selected_records) == 1:
            recorded = selected_records[0]; recorded_args = recorded['arguments']; proposal = recorded_args[5]
            def same_selected_proposal(value):
                return canonical(value) == canonical(proposal) and canonical(public_command(value['actions'][index])) == canonical(action['command'])
            before_calls = [call for call in calls if call['method'] == 'before' and call['result'].get('admitted') is True
                and call['arguments'][1] == index and canonical(call['arguments'][3]) == canonical(recorded_args[0])
                and same_selected_proposal(call['arguments'][0])]
            after_calls = [call for call in calls if call['method'] == 'after' and call['arguments'][1] == index
                and canonical(call['arguments'][2]) == canonical(recorded_args[0]) and canonical(call['arguments'][3]) == canonical(recorded_args[1])
                and same_selected_proposal(call['arguments'][0])]
            proposed_calls = []
            for call in calls:
                if call['method'] != 'proposeSource' or call.get('result') is None \
                        or call['arguments'][0]['revision'] != action['decisionRevision']:
                    continue
                link = source_proposal_link(call, proposal)
                projection_attempts.append(link)
                if link['matched']: proposed_calls.append(call)
            for proposed in proposed_calls:
                for guarded in before_calls:
                    for returned in after_calls:
                        if proposed['index'] < guarded['index'] < returned['index'] < recorded['index']:
                            matched = True
                            witnesses = {'propose': proposed['index'], 'before': guarded['index'], 'after': returned['index'], 'record': recorded['index']}
                            break
                    if matched: break
                if matched: break
        ordered_guard_rows.append({'sequence': sequence, 'decisionRevision': action['decisionRevision'],
            'actionIndex': index, 'matched': matched, 'captureIndices': witnesses,
            'sourceProposalProjection': projection_attempts})
    prefix_revisions = [prefix['decisionRevision'] for prefix in selected_prefixes]
    exact_selected_prefixes = (
        len(prefix_revisions) == len(set(prefix_revisions))
        and all(type(prefix['decisionRevision']) is int and type(prefix['acquiredActions']) is int
                and prefix['acquiredActions'] == 1 for prefix in selected_prefixes)
        and all(type(action['actionIndex']) is int and action['actionIndex'] == 0
                and action['sequence'] == action['decisionRevision'] for action in selected_actions)
        and prefix_revisions == [action['decisionRevision'] for action in selected_actions])
    coverage = {'positiveSourceCallsPresent': len(calls) > 0,
                'positiveSelectedPrefixesPresent': len(selected_prefixes) > 0,
                'positiveSelectedActionsPresent': len(selected_actions) > 0,
                'selectedProposalsCoverEverySelectedPrefix': {row['revision'] for row in selected} == selected_revisions,
                'recordsExactlyCoverSelectedActualActions': canonical(actual_returns) == canonical(expected_returns),
                'everySelectedActionHasAnActualAdmittedBeforeGuard': expected_sequences <= before_guard_revisions,
                'everySelectedActionHasAnActualAfterGuard': expected_sequences <= after_guard_revisions,
                'everySelectedActionHasItsExactOrderedProposalGuardsAndRecord': all(row['matched'] for row in ordered_guard_rows),
                'allSelectedActionsBelongToSealedPrefixes': exact_selected_prefixes,
                'noForeignRecord': records['foreign'] == 0, 'noDuplicateRecord': not duplicates}
    checkpoint_rows = []
    for prefix in selected_prefixes:
        evidence = prefix.get('symbolAcquisition')
        if evidence is None: continue
        revision = prefix['decisionRevision']; source = source_records.get(revision)
        checkpoint = evidence.get('nativeCheckpoint') or {}; fact = evidence.get('retainedSourceFact') or {}
        acquired = evidence.get('acquired') or []; through = evidence.get('sourceCallsThrough')
        expected_event = [] if source is None else [{'key': 'symbol_transaction_event:' + str(revision),
            'evidence': source['after']['observation_ref'], 'revision': source['after']['revision'], 'result': source['event']}]
        witnesses = [row for row in ordered_guard_rows if row['decisionRevision'] == revision and row['matched']]
        expected_transitions = None
        if source is not None and len(witnesses) == 1:
            actual_after = calls[witnesses[0]['captureIndices']['after']]
            expected_transitions = [{'command': source['command'], 'before': source['before']['observation_ref'],
                'after': source['after']['observation_ref'], 'outcome': actual_after['result']}]
        checks = {'onePrimitiveSourceRecord': exact_selected_prefixes and prefix['acquiredActions'] == 1
                and source is not None and source['actionIndex'] == 0 and len(witnesses) == 1,
            'ownerAndFormat': evidence.get('stateNode') == 'family_state:public_symbol_transaction'
                and evidence.get('checkpointFormat') == 'native.public_symbol_transaction.v1'
                and checkpoint.get('format') == 'native.public_symbol_transaction.v1',
            'exactNativeEnvelope': source is not None and canonical(checkpoint) == canonical({
                'format': 'native.public_symbol_transaction.v1', 'source_state': source['state']}),
            'exactSourceProjection': source is not None and canonical(evidence.get('sourceState')) == canonical(source['state'])
                and canonical(evidence.get('selectedProposal')) == canonical(source['proposal']),
            'exactSelectedEvent': expected_transitions is not None and canonical(acquired) == canonical(expected_event)
                and canonical(evidence.get('transitions')) == canonical(expected_transitions),
            'exactRetainedSourceFact': source is not None and fact.get('key') == 'observed_symbol_transactions_state'
                and canonical(fact.get('value')) == canonical(source['state'])
                and fact.get('revision') == source['after']['revision'] and fact.get('evidence') == source['after']['observation_ref'],
            'captureEndsAtAcquiredState': source is not None and type(through) is int and through == source['callIndex'] + 1
                and through in states_after_calls
                and canonical(states_after_calls[through]) == canonical(evidence.get('sourceState'))}
        checkpoint_rows.append({'decisionRevision': revision, 'checks': checks, 'matched': all(checks.values()),
                                'sourceStateSha256': digest(source['state']) if source else None,
                                'checkpointSha256': digest(checkpoint)})
    checkpoint_proof = {'required': args.require_checkpoints, 'selectedPrefixes': len(selected_prefixes),
        'capturedPrefixes': len(checkpoint_rows), 'matchedPrefixes': sum(row['matched'] for row in checkpoint_rows),
        'exactChecks': sum(sum(row['checks'].values()) for row in checkpoint_rows), 'totalChecks': len(checkpoint_rows) * 7,
        'complete': len(checkpoint_rows) == len(selected_prefixes) and all(row['matched'] for row in checkpoint_rows),
        'prefixes': checkpoint_rows,
        'qualification': 'Seven independent comparisons bind the cold original owner state, exact complete selected proposal, acquired event, retained source fact, exact command/observation/outcome transition, and capture cursor immediately after each selected record. Only selected Symbols prefixes are covered; foreign-prefix checkpoint conservation is not asserted. Missing legacy captures are not counted as a checkpoint proof.'}
    contribution = {'schema': 'logos-engine.v6.symbol-transactions-public-contribution.v1', 'referenceCommit': COMMIT,
        'campaign': campaign, 'trajectoryStateOrigin': 'One cold original Python SymbolTransactions; native captured states are comparison targets only.',
        'records': dict(records), 'selectedRecordOnly': records['foreign'] == 0, 'captureCoverage': coverage,
        'orderedGuardWitnesses': ordered_guard_rows,
        'proposalBindingProjection': {
            'originalFunctions': ['ObservedInputDomain.candidates', 'ObservedInputDomain.bind_proposal'],
            'inputDomainLimit': point_limit, 'callerAnnotationFields': sorted(CALLER_PROPOSAL_FIELDS),
            'unsupportedCallerFields': ['preservation', 'preservation_rejected_candidates'],
            'qualification': 'All original proposal fields match exactly after the unchanged original point-domain binding. Only the four named caller annotations are excluded from source equality; their full values must remain identical across actual guards, record and retained selectedProposal. A preservation rewrite fails explicitly because this component proof does not replay the acquisition of caller obligations. No complete original caller selection or annotation-value parity is asserted.'},
        'feedbackUniqueness': {'physicalActions': len(report['actions']), 'recordCalls': sum(records.values()),
                              'distinctObservedTransitions': len(transitions), 'duplicates': duplicates},
        'selectedSymbolCount': len(selected), 'selectedSymbolProposals': selected,
        'ablationScope': 'Independent original-owner counterfactuals on each selected public situation. No altered game execution or solved-level causal claim.',
        'ablationChoiceFields': 'kind, complete action, guide/interface mode, method reference, offer kind and active goal; a change only to rule references or supporting facts is same_decision_different_evidence.',
        'ablationCounts': {layer: dict(Counter(r['classification'] for r in ablations if r['removedLayer'] == layer)) for layer in layers},
        'ablations': ablations, 'finalSourceState': plain(owner.state())}
    contribution_receipt = write(out_dir / (args.label + '-contribution.json.gz'), contribution)
    passed = all(row['matched'] for row in comparisons) and all(coverage.values())
    passed = passed and all(row['matched'] for row in checkpoint_rows) and (not args.require_checkpoints or checkpoint_proof['complete'])
    parity = {'schema': 'logos-engine.v6.symbol-transactions-public-parity.v1', 'referenceCommit': COMMIT,
        'status': 'passed' if passed else 'failed', 'campaign': campaign, 'sourceFilesVerifiedBeforeAndAfter': len(manifest),
        'sourceModified': False, 'sourceHashes': source_hashes, 'generator': {
            'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(__file__), 'bytes': Path(__file__).stat().st_size},
        'nativeSourceStatesInjected': 0, 'originalSelfStateRoundTrips': persistence_roundtrips,
        'initialOwner': 'fresh SymbolTransactions()', 'callCount': len(comparisons),
        'callKinds': dict(Counter(row['method'] for row in comparisons)), 'matchedCalls': sum(row['matched'] for row in comparisons),
        'failedCalls': sum(not row['matched'] for row in comparisons), 'exactChecks': sum(sum(row['checks'].values()) for row in comparisons),
        'totalChecks': len(comparisons) * 3, 'calls': comparisons, 'selectedSymbolCount': len(selected), 'captureCoverage': coverage,
        'checkpointProof': checkpoint_proof, 'orderedGuardWitnesses': ordered_guard_rows,
        'contributionReceipt': contribution_receipt, 'elapsedSeconds': time.monotonic() - started,
        'qualification': 'Exact component replay of the calls actually reached by the native common runtime. This is not full original common-caller selection parity.'}
    receipt = write(out_dir / (args.label + '-public-parity.json'), parity)
    print(json.dumps({'parity': receipt, 'contribution': contribution_receipt, 'status': parity['status'], 'calls': len(comparisons),
                      'matched': parity['matchedCalls'], 'failed': parity['failedCalls'], 'selected': len(selected),
                      'records': dict(records), 'ablations': contribution['ablationCounts'], 'elapsedSeconds': parity['elapsedSeconds']}))
    if not passed: raise SystemExit(1)
if __name__ == '__main__': main()
