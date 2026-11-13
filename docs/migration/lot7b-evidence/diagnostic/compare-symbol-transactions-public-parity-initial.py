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
            'rules': plan.get('rule_refs'), 'methodRef': offer.get('method_ref'),
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
    args = parser.parse_args(); started = time.monotonic()
    report_path, out_dir = ROOT / args.report, ROOT / args.out_dir
    report = json.loads(gzip.decompress(report_path.read_bytes()) if report_path.suffix == '.gz' else report_path.read_bytes())
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    def verify():
        for name, record in manifest.items(): assert sha(SOURCE / name) == record['sha256'], name
    verify()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions
    owner = SymbolTransactions(); cold = plain(owner.state())
    assert cold['epoch'] is None and cold['interface_state']['methods'] == []
    selected_prefixes = [p for p in report['prefixes'] if p['family'] == 'public_symbol_transaction']
    selected_revisions = {p['decisionRevision'] for p in selected_prefixes}
    selected_actions = [action for action in report['actions'] if action['family'] == 'public_symbol_transaction']
    calls = report['symbolSourceCalls']; comparisons = []; selected = []; ablations = []
    records = Counter(); transitions = Counter(); persistence_roundtrips = 0
    layers = ['rejected', 'transition_count', 'interface.samples', 'interface.contrasts', 'interface.methods',
              'interface.refutations', 'interface.bound', 'all_interface_knowledge']
    for index, call in enumerate(calls):
        assert call['index'] == index
        before = plain(owner.state()); arguments = copy.deepcopy(call['arguments'])
        method = {'proposeSource': 'propose', 'recordSource': 'record', 'before': 'before', 'after': 'after'}[call['method']]
        if method == 'before': arguments[2] = SimpleNamespace(**arguments[2])
        value = plain(getattr(owner, method)(*arguments)); after = plain(owner.state())
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
            # The original common caller exports/restores this selected source
            # fact after its other acquisitions. Only this owner's own state
            # is round-tripped, never a captured native checkpoint.
            owner.restore(copy.deepcopy(after)); persistence_roundtrips += 1
        if method != 'propose' or value is None or arguments[0]['revision'] not in selected_revisions: continue
        selected.append({'callIndex': index, 'revision': arguments[0]['revision'], 'epoch': arguments[0]['level_epoch'],
                         'decision': decision(value), 'proposalSha256': digest(value), 'sourceStateSha256': digest(before),
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
                                  'decision': decision(alternative), 'proposalSha256': digest(alternative)})
            except Exception as error:
                ablations.append({'callIndex': index, 'removedLayer': layer, 'classification': 'counterfactual_exception',
                                  'error': {'type': type(error).__name__, 'message': str(error)}})
    verify()
    source_hashes = {name: record['sha256'] for name, record in manifest.items() if '/symbol_transactions/' in name
                    or name.endswith('/concentric_frames.py') or name.endswith('/symbolic_diagrams.py')
                    or name.endswith('/guarded_binding/geometry.py')}
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
    coverage = {'positiveSourceCallsPresent': len(calls) > 0,
                'positiveSelectedPrefixesPresent': len(selected_prefixes) > 0,
                'positiveSelectedActionsPresent': len(selected_actions) > 0,
                'selectedProposalsCoverEverySelectedPrefix': {row['revision'] for row in selected} == selected_revisions,
                'recordsExactlyCoverSelectedActualActions': canonical(actual_returns) == canonical(expected_returns),
                'everySelectedActionHasAnActualAdmittedBeforeGuard': expected_sequences <= before_guard_revisions,
                'everySelectedActionHasAnActualAfterGuard': expected_sequences <= after_guard_revisions,
                'allSelectedActionsBelongToSealedPrefixes': sum(p['acquiredActions'] for p in selected_prefixes) == len(selected_actions),
                'noForeignRecord': records['foreign'] == 0, 'noDuplicateRecord': not duplicates}
    contribution = {'schema': 'logos-engine.v6.symbol-transactions-public-contribution.v1', 'referenceCommit': COMMIT,
        'campaign': campaign, 'trajectoryStateOrigin': 'One cold original Python SymbolTransactions; native captured states are comparison targets only.',
        'records': dict(records), 'selectedRecordOnly': records['foreign'] == 0, 'captureCoverage': coverage,
        'feedbackUniqueness': {'physicalActions': len(report['actions']), 'recordCalls': sum(records.values()),
                              'distinctObservedTransitions': len(transitions), 'duplicates': duplicates},
        'selectedSymbolCount': len(selected), 'selectedSymbolProposals': selected,
        'ablationScope': 'Independent original-owner counterfactuals on each selected public situation. No altered game execution or solved-level causal claim.',
        'ablationCounts': {layer: dict(Counter(r['classification'] for r in ablations if r['removedLayer'] == layer)) for layer in layers},
        'ablations': ablations, 'finalSourceState': plain(owner.state())}
    contribution_receipt = write(out_dir / (args.label + '-contribution.json.gz'), contribution)
    passed = all(row['matched'] for row in comparisons) and all(coverage.values())
    parity = {'schema': 'logos-engine.v6.symbol-transactions-public-parity.v1', 'referenceCommit': COMMIT,
        'status': 'passed' if passed else 'failed', 'campaign': campaign, 'sourceFilesVerifiedBeforeAndAfter': len(manifest),
        'sourceModified': False, 'sourceHashes': source_hashes, 'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(__file__)},
        'nativeSourceStatesInjected': 0, 'originalSelfStateRoundTrips': persistence_roundtrips,
        'initialOwner': 'fresh SymbolTransactions()', 'callCount': len(comparisons),
        'callKinds': dict(Counter(row['method'] for row in comparisons)), 'matchedCalls': sum(row['matched'] for row in comparisons),
        'failedCalls': sum(not row['matched'] for row in comparisons), 'exactChecks': sum(sum(row['checks'].values()) for row in comparisons),
        'totalChecks': len(comparisons) * 3, 'calls': comparisons, 'selectedSymbolCount': len(selected), 'captureCoverage': coverage,
        'contributionReceipt': contribution_receipt, 'elapsedSeconds': time.monotonic() - started,
        'qualification': 'Exact component replay of the calls actually reached by the native common runtime. This is not full original common-caller selection parity.'}
    receipt = write(out_dir / (args.label + '-public-parity.json'), parity)
    print(json.dumps({'parity': receipt, 'contribution': contribution_receipt, 'status': parity['status'], 'calls': len(comparisons),
                      'matched': parity['matchedCalls'], 'failed': parity['failedCalls'], 'selected': len(selected),
                      'records': dict(records), 'ablations': contribution['ablationCounts'], 'elapsedSeconds': parity['elapsedSeconds']}))
    if not passed: raise SystemExit(1)
if __name__ == '__main__': main()
