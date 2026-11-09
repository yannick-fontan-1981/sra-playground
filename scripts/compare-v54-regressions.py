#!/usr/bin/env python3
"""Bounded cold common-caller replays with an explicitly limited v53 comparison.

The archived expected commands are read only by the existing replay host.  Each
current command is computed before that host releases its recorded public return.
This script does not initialize a provider, import an agent or modify a policy.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('v53_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
PROOF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROOF)
BASE = ROOT / 'docs/migration/native-campaigns-v53/attempt7'
TRACES = {
    'STCK': 'v39/stck-public-trace.json.gz',
    'CATL': 'v45/catl-public-trace.json.gz',
    'SELE': 'v47/sele-public-trace.json.gz',
    'COLM': 'v48/colm-public-trace.json.gz',
    'ZIPP': 'v48/zipp-public-trace.json.gz',
    'GRIL': 'v49/gril-public-trace.json.gz',
    'LIFE': 'v50/life-public-trace-final.json.gz',
    'VALV': 'v51/valv-public-trace.json.gz',
    'GARE': 'v52/attempt9/gare-public-trace.json.gz',
    'CN04': 'v53/attempt7/cn04-public-trace.json.gz',
}
HARNESS = [
    'scripts/compare-v54-regressions.py',
    'scripts/replay-v53-public-regression.mjs',
    'scripts/run-v53-campaign-proof.py',
    'tests/helpers/v6-live-game-campaign.ts',
]
PREFIX_KEYS = [
    'id', 'decisionRevision', 'acquiredActions', 'family', 'operations',
    'proposalKind', 'fieldSubquestion', 'materialSubquestion', 'selectionGroup',
    'programControlProbeMode', 'programRelationMode', 'rootedQuotaPhase',
    'productPanelFactors', 'productPanelEstimated', 'productPanelObservedSteps',
    'labeledSequenceLabel', 'labeledSequenceQuery', 'labeledSequenceTrainingReused',
    'labeledSequenceCompatiblePredicates', 'labeledSequenceAgreement',
    'labeledSequenceGrammarSize', 'supportMode', 'callerAcquiredTransitions',
]
COORDINATION_KEYS = [
    'rule', 'observation_ref', 'guard_reason', 'scope', 'deferred_family',
    'preferred_family', 'physical_action_authorized', 'source_trigger_group',
    'source_trigger_entry', 'selected_group', 'selected_entry', 'selected_subquestion',
]
CALLER_KEYS = [
    'enabled', 'acquiredTransitions', 'boundaryReplays', 'goalEvents',
    'frontierDeltas', 'components',
]
BOUNDARY_KEYS = [
    'completedLevel', 'nativeLevel', 'levelsCompleted', 'levelActions',
    'totalActions', 'prefixCount', 'phase', 'sessionRetained',
]
PACKET_KEYS = [
    'frame_rows', 'frame_packet', 'level', 'levels_completed', 'state',
    'step_index', 'available_action_refs', 'frame_hash',
]
QUALIFICATION = (
    'Ten cold native common-caller replays use unchanged archived public returns; '
    'every current command is computed before the host supplies its expected return. '
    'The comparison covers every command, complete public-packet SHA-256, animation '
    'length, primitive boundary, selected family/group/proposal kind/subquestion, '
    'retained coordination entry/guard fields, acquired prefix lengths, epoch '
    'anchors, source-series event counts, common-caller counters, natural level '
    'boundaries and final public result. Only the fresh observation-session prefix '
    'is normalized in the selected fields. Timings, implementation labels and '
    'migration-status labels are excluded. Complete provider payloads, derived '
    'identities, graph chains/revisions, full original-caller parity and equality '
    'of the newly added ReactiveContact state are not asserted. Existing LIFE '
    'material recipe identities and GARE nonempty FieldService payloads remain '
    'retained in the raw reports, outside this declared comparison. The prior '
    'v53 comparison records are unchanged. These are regressions, not ten new '
    'live games and not a speed comparison.'
)


def utc():
    return datetime.now(timezone.utc).isoformat()


def read(path):
    data = Path(path).read_bytes()
    return json.loads(gzip.decompress(data) if str(path).endswith('.gz') else data)


def write_new(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def pick(value, keys):
    return {key: value[key] for key in keys if key in value}


def omit(value, keys):
    return {key: item for key, item in value.items() if key not in keys}


def scope(value):
    if isinstance(value, str):
        return re.sub(r'^sra-v6-[^:]+(?=:epoch:)', 'campaign-scope', value)
    if isinstance(value, list):
        return [scope(item) for item in value]
    if isinstance(value, dict):
        return {key: scope(item) for key, item in value.items()}
    return value


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def packet_sha(packet):
    # The retained public-packet contract consists only of integer raster/index
    # values and ASCII action/state/hash strings, in this exact native field order.
    return hashlib.sha256(json.dumps(pick(packet, PACKET_KEYS), ensure_ascii=False,
                                     separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def first_difference(left, right, path='$'):
    if type(left) is not type(right):
        return {'path': path, 'baselineType': type(left).__name__, 'currentType': type(right).__name__}
    if isinstance(left, dict):
        if left.keys() != right.keys():
            return {'path': path, 'baselineOnly': sorted(left.keys() - right.keys()),
                    'currentOnly': sorted(right.keys() - left.keys())}
        for key in left:
            if left[key] != right[key]:
                return first_difference(left[key], right[key], f'{path}.{key}')
    elif isinstance(left, list):
        if len(left) != len(right):
            return {'path': path, 'baselineLength': len(left), 'currentLength': len(right)}
        for index, (a, b) in enumerate(zip(left, right)):
            if a != b:
                return first_difference(a, b, f'{path}[{index}]')
    elif left != right:
        return {'path': path, 'baseline': left, 'current': right}
    return None


def caller(value):
    return pick(value, CALLER_KEYS) if isinstance(value, dict) else value


def request(value):
    return {**omit(value, ['activeSeconds', 'elapsedMs', 'caller']), 'caller': caller(value['caller'])}


def final(value):
    return {**omit(value, ['activeSeconds', 'nativeImplementation', 'caller']), 'caller': caller(value['caller'])}


def series_counts(prefix):
    value = prefix['sharedSeries']
    return {key: item for key, item in value.items() if key.endswith('Count')}


def compare(before, after, trace, frozen, baseline_path, current_path, trace_path):
    checks = []

    def same(name, left, right):
        passed = left == right
        check = {'name': name, 'passed': passed,
                 'baselineProjectionSha256': canonical_sha(left),
                 'currentProjectionSha256': canonical_sha(right)}
        if not passed:
            check['firstDifference'] = first_difference(left, right)
        checks.append(check)

    same('both runs passed with the same declared game and target',
         [before['status'], after['status'], before['game'], before['targetLevels']],
         ['passed', 'passed', after['game'], after['targetLevels']])
    same('same production budgets, source reference and opaque game asset provenance',
         pick(before, ['budget', 'referenceCommit', 'gameAssets']),
         pick(after, ['budget', 'referenceCommit', 'gameAssets']))
    same('same complete initial public packet hash and public state', before['initial'], after['initial'])
    expected = [before['initial']['publicPacketSha256']] + [a['publicPacketSha256'] for a in before['actions']]
    same('every archived public packet independently hashes to the v53 baseline',
         expected, [packet_sha(item['packet']) for item in trace['packets']])
    same('every archived host-only command equals its prior baseline command',
         [None] + [a['command'] for a in before['actions']], [item['command'] for item in trace['packets']])
    same('same commands, complete returned packet hashes, animation lengths and primitive boundaries',
         [omit(a, ['executionMs']) for a in before['actions']], [omit(a, ['executionMs']) for a in after['actions']])
    same('same selected family/group/kind/subquestion, acquired prefix lengths and retained solver scalars',
         [scope(pick(p, PREFIX_KEYS)) for p in before['prefixes']],
         [scope(pick(p, PREFIX_KEYS)) for p in after['prefixes']])
    same('same retained coordination source/preferred entries and current guard scope',
         [[scope(pick(c, COORDINATION_KEYS)) for c in p.get('nativeCoordination', [])] for p in before['prefixes']],
         [[scope(pick(c, COORDINATION_KEYS)) for c in p.get('nativeCoordination', [])] for p in after['prefixes']])
    same('same historical epoch anchors with session namespace normalized',
         [scope(p['sharedSeries']['epochAnchors']) for p in before['prefixes']],
         [scope(p['sharedSeries']['epochAnchors']) for p in after['prefixes']])
    same('same inherited source-series event counts on every sealed prefix',
         [series_counts(p) for p in before['prefixes']], [series_counts(p) for p in after['prefixes']])
    same('same common request outcomes and retained caller acquisition counters',
         [request(r) for r in before['requests']], [request(r) for r in after['requests']])
    same('same natural level boundaries and retained-session caller counters',
         [{**pick(b, BOUNDARY_KEYS), 'caller': caller(b['caller'])} for b in before['boundaries']],
         [{**pick(b, BOUNDARY_KEYS), 'caller': caller(b['caller'])} for b in after['boundaries']])
    same('same final public result and retained-session operation counts', final(before['final']), final(after['final']))
    same('same retained mechanical-domain assessments', before['domainAssessments'], after['domainAssessments'])
    same('both source runs remained unchanged and imported no Python agent module',
         [before['sourceUnchangedDuringRun'], after['sourceUnchangedDuringRun'],
          before['pythonAgentModules'], after['pythonAgentModules']], [True, True, [], []])
    same('current replay used the declared complete frozen native source', frozen, after['source'])
    same('current replay identifies the exact host-only baseline and public trace',
         {'baseline': pick(PROOF.evidence(baseline_path), ['path', 'sha256']),
          'trace': pick(PROOF.evidence(trace_path), ['path', 'sha256'])},
         pick(after.get('recordedPublicReplay', {}), ['baseline', 'trace']))
    return {
        'schema': 'logos-engine.v54.scoped-public-regression-comparison.v1',
        'game': before['game'], 'passed': all(c['passed'] for c in checks), 'checks': checks,
        'before': {**PROOF.evidence(baseline_path), 'sourceDigest': before['source']['digest']},
        'after': {**PROOF.evidence(current_path), 'sourceDigest': after['source']['digest']},
        'trace': PROOF.evidence(trace_path),
        'compared': {'commands': len(before['actions']), 'completePublicPackets': len(trace['packets']),
                     'prefixes': len(before['prefixes']), 'requests': len(before['requests']),
                     'naturalLevelBoundaries': len(before['boundaries']),
                     'animationFrames': sum(len(x['packet']['frame_packet']) for x in trace['packets'])},
        'scope': {'prefixKeys': PREFIX_KEYS, 'coordinationKeys': COORDINATION_KEYS,
                  'callerKeys': CALLER_KEYS, 'boundaryKeys': BOUNDARY_KEYS},
        'qualification': QUALIFICATION,
    }


def memory():
    result = {}
    for name in ['memory.current', 'memory.max', 'memory.peak', 'memory.events']:
        path = Path('/sys/fs/cgroup') / name
        if path.exists():
            result[name] = path.read_text().strip()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', help='Already-frozen campaign directory containing source-manifest.json')
    args = parser.parse_args()
    out = ROOT / args.directory / 'regressions'
    summary_path = out / 'regression-summary.json'
    if summary_path.exists():
        raise FileExistsError(summary_path)
    frozen = read(out.parent / 'source-manifest.json')
    if frozen != PROOF.native_source():
        raise ValueError('Current native source differs from the declared freeze')
    harness_before = {name: PROOF.sha(ROOT / name) for name in HARNESS}
    out.mkdir(parents=True, exist_ok=True)
    memory_before = memory()

    def run(item):
        game, trace_suffix = item
        stem = game.lower()
        baseline = BASE / ('cn04-campaign.json.gz' if game == 'CN04' else f'regressions/{stem}-replay.json.gz')
        trace_path = ROOT / ('docs/migration/native-campaigns-' + trace_suffix)
        report_path = out / f'{stem}-replay.json.gz'
        comparison_path = out / f'{stem}-comparison.json'
        log_path = out / f'{stem}-output.log.gz'
        execution_path = out / f'{stem}-execution.json'
        for path in [report_path, comparison_path, log_path, execution_path]:
            if path.exists():
                raise FileExistsError(path)
        before = read(baseline)
        trace = read(trace_path)
        assert before['status'] == trace['status'] == 'passed'
        assert before['game'] == trace['game'] == game
        inputs = {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        command = ['node', 'scripts/replay-v53-public-regression.mjs',
                   baseline.relative_to(ROOT).as_posix(), trace_path.relative_to(ROOT).as_posix(),
                   report_path.relative_to(ROOT).as_posix()]
        started, clock = utc(), time.monotonic()
        print(json.dumps({'game': game, 'phase': 'started', 'expectedActions': len(before['actions']),
                          'maximumConcurrentReplays': 2, 'memory': memory()}), flush=True)
        timed_out = False
        with tempfile.TemporaryFile() as output:
            try:
                process = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                         timeout=2400)
                exit_code = process.returncode
            except subprocess.TimeoutExpired:
                timed_out, exit_code = True, 124
            output.seek(0)
            with log_path.open('xb') as destination:
                with gzip.GzipFile(filename='', mode='wb', fileobj=destination, mtime=0) as compressed:
                    for chunk in iter(lambda: output.read(1024 * 1024), b''):
                        compressed.write(chunk)
        row = {'game': game, 'mode': 'recorded-public-replay', 'command': command,
               'startedAt': started, 'finishedAt': utc(), 'elapsedSeconds': time.monotonic() - clock,
               'exitCode': exit_code, 'timeoutSeconds': 2400, 'timedOut': timed_out,
               **inputs, 'output': PROOF.evidence(log_path), 'passed': False, 'memory': memory()}
        if report_path.exists():
            actual = read(report_path)
            row.update(report=PROOF.evidence(report_path), status=actual['status'],
                       actions=len(actual['actions']), prefixes=len(actual['prefixes']), final=actual['final'])
            try:
                comparison = compare(before, actual, trace, frozen, baseline, report_path, trace_path)
                write_new(comparison_path, comparison)
                row.update(comparison=PROOF.evidence(comparison_path), comparisonPassed=comparison['passed'],
                           comparisonChecks=len(comparison['checks']),
                           failedChecks=[c['name'] for c in comparison['checks'] if not c['passed']])
                row['passed'] = exit_code == 0 and comparison['passed']
            except Exception as error:
                row['comparisonError'] = f'{type(error).__name__}: {error}'
        row['immutableInputsUnchanged'] = inputs == {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        row['passed'] = row['passed'] and row['immutableInputsUnchanged']
        write_new(execution_path, row)
        row['execution'] = PROOF.evidence(execution_path)
        print(json.dumps({'game': game, 'phase': 'completed', 'passed': row['passed'],
                          'actions': row.get('actions'), 'levelsCompleted': row.get('final', {}).get('levelsCompleted'),
                          'failedChecks': row.get('failedChecks'), 'memory': row['memory']}), flush=True)
        return row

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, TRACES.items()))
    source_after = PROOF.native_source()
    harness_after = {name: PROOF.sha(ROOT / name) for name in HARNESS}
    unchanged = source_after == frozen and harness_before == harness_after
    passed = unchanged and all(row['passed'] for row in results)
    value = {'schema': 'logos-engine.v54.recorded-public-regressions.v1',
             'status': 'passed' if passed else 'failed', 'nativeSource': frozen,
             'nativeSourceAfter': source_after, 'executionInputs': harness_before,
             'executionInputsAfter': harness_after, 'executionInputsUnchanged': unchanged,
             'maximumConcurrentReplays': 2, 'memoryBefore': memory_before, 'memoryAfter': memory(),
             'results': results, 'passed': sum(row['passed'] for row in results), 'total': len(results),
             'qualification': QUALIFICATION}
    write_new(summary_path, value)
    print(json.dumps({'status': value['status'], 'passed': value['passed'], 'total': value['total']}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
