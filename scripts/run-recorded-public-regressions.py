#!/usr/bin/env python3
"""Run a declared set of cold native replays against immutable public returns.

The case manifest supplies only baseline and public-trace paths to the replay
host. Expected commands and state never initialize a native decision. The
unchanged historical comparator supplies the same 17 bounded checks.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
COMPARATOR_PATH = ROOT / 'scripts/compare-v54-regressions.py'
SPEC = importlib.util.spec_from_file_location('recorded_public_comparator', COMPARATOR_PATH)
COMPARATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(COMPARATOR)
PROOF = COMPARATOR.PROOF
READ = COMPARATOR.read
WRITE = COMPARATOR.write_new
UTC = COMPARATOR.utc
REPLAY = 'scripts/replay-v53-public-regression.mjs'
MANIFEST_SCHEMA = 'logos-engine.recorded-public-regression-cases.v1'
QUALIFICATION = (
    'Cold native common-caller replays use unchanged archived public returns. '
    'Every current command is computed before the host supplies its expected '
    'return. The unchanged historical comparator supplies the same 17 checks '
    'and check labels: commands, complete public-packet hashes, animation '
    'lengths, primitive boundaries, selected family/group/proposal kind/subquestion, '
    'named coordination entry/guard fields, prefix lengths, epoch anchors, '
    'source-series event counts, common-caller counters, natural level boundaries '
    'and final public result. Only fresh observation-session prefixes are '
    'normalized in the selected fields. Timings, implementation labels and '
    'migration-status labels are excluded. Complete provider payloads, derived '
    'identities, graph chains/revisions, full original-caller parity and equality '
    'of newly added family state are not asserted. Original payloads remain in '
    'the complete reports. These are recorded-return regressions, not new live '
    'game successes or a speed comparison. Legacy v53/v54 labels in the reused '
    'comparator identify its provenance; the case manifest and frozen source '
    'identify the actual baselines and current execution.'
)


def local_path(value):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError('Expected a nonempty repository-relative path')
    result = (ROOT / value).resolve()
    result.relative_to(ROOT)
    return result


def pinned_file(item):
    if not isinstance(item, dict) or set(item) != {'path', 'sha256'}:
        raise ValueError('A case input needs exactly path and sha256')
    path = local_path(item['path'])
    if PROOF.sha(path) != item['sha256']:
        raise ValueError('Pinned case input differs: ' + item['path'])
    return path


def prepare(manifest_path):
    manifest = READ(manifest_path)
    if manifest.get('schema') != MANIFEST_SCHEMA or not isinstance(manifest.get('cases'), list) or not manifest['cases']:
        raise ValueError('Expected a nonempty recorded-public case manifest')
    requirements = manifest.get('passiveOwnerRequirements', [])
    if not isinstance(requirements, list):
        raise ValueError('Passive owner requirements must be a list')
    owner_properties = set()
    for requirement in requirements:
        if not isinstance(requirement, dict) or set(requirement) != {'prefixProperty', 'stateNode', 'sourceStateKeys', 'checkpointFormat'}:
            raise ValueError('Each passive owner requirement needs property, node, fields and format')
        if any(not isinstance(requirement[key], str) or not requirement[key]
               for key in ['prefixProperty', 'stateNode', 'checkpointFormat']):
            raise ValueError('Passive owner property, node and format must be nonempty strings')
        fields = requirement['sourceStateKeys']
        if not isinstance(fields, list) or not fields or any(not isinstance(key, str) or not key for key in fields) or len(set(fields)) != len(fields):
            raise ValueError('Passive source fields must be unique nonempty strings')
        if requirement['prefixProperty'] in owner_properties:
            raise ValueError('Passive owner requirements must have unique properties')
        owner_properties.add(requirement['prefixProperty'])
    cases, ids = [], set()
    totals = {key: 0 for key in ['commands', 'completePublicPackets', 'animationFrames',
                               'prefixes', 'requests', 'naturalLevelBoundaries']}
    for item in manifest['cases']:
        name, game = item.get('id'), item.get('game')
        if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', name) or name in ids:
            raise ValueError('Case ids must be unique safe lowercase filenames')
        if not isinstance(game, str) or not game:
            raise ValueError('A case requires its exact declared game')
        ids.add(name)
        baseline, trace_path = pinned_file(item['baseline']), pinned_file(item['trace'])
        before, trace = READ(baseline), READ(trace_path)
        if before['status'] != 'passed' or trace['status'] != 'passed' or before['game'] != game or trace['game'] != game:
            raise ValueError('Expected matching successful baseline and public trace: ' + name)
        if [None] + [row['command'] for row in before['actions']] != [row['command'] for row in trace['packets']]:
            raise ValueError('Baseline/trace command mismatch: ' + name)
        expected = [before['initial']['publicPacketSha256']] + [row['publicPacketSha256'] for row in before['actions']]
        if expected != [COMPARATOR.packet_sha(row['packet']) for row in trace['packets']]:
            raise ValueError('Baseline/trace complete packet mismatch: ' + name)
        counts = {'commands': len(before['actions']), 'completePublicPackets': len(trace['packets']),
                  'animationFrames': sum(len(row['packet']['frame_packet']) for row in trace['packets']),
                  'prefixes': len(before['prefixes']), 'requests': len(before['requests']),
                  'naturalLevelBoundaries': len(before['boundaries'])}
        for key in totals:
            totals[key] += counts[key]
        cases.append({'id': name, 'game': game, 'baseline': baseline, 'trace': trace_path,
                      'counts': counts, 'targetLevels': before['targetLevels']})
    return cases, totals, requirements


def passive_owner_presence(actual, requirements, report_path, manifest_path):
    """Inspect retained current-run evidence without comparing it to old state."""
    owners = []
    for requirement in requirements:
        prefixes = []
        for index, prefix in enumerate(actual['prefixes']):
            owner = prefix.get(requirement['prefixProperty'])
            present = isinstance(owner, dict)
            state = owner.get('sourceState') if present else None
            checkpoint = owner.get('nativeCheckpoint') if present else None
            transitions = owner.get('transitions') if present else None
            acquired = prefix.get('acquiredActions')
            checks = {
                'ownerPresent': present,
                'stateNode': present and owner.get('stateNode') == requirement['stateNode'],
                'exactSourceFields': isinstance(state, dict) and set(state) == set(requirement['sourceStateKeys']),
                'checkpointShape': isinstance(checkpoint, dict) and set(checkpoint) == {'format', 'source_state'},
                'checkpointFormat': present and owner.get('checkpointFormat') == requirement['checkpointFormat']
                    and isinstance(checkpoint, dict) and checkpoint.get('format') == requirement['checkpointFormat'],
                'checkpointMatchesRetainedState': isinstance(state, dict) and isinstance(checkpoint, dict)
                    and checkpoint.get('source_state') == state,
                'transitionCountEqualsAcquiredActions': isinstance(transitions, list)
                    and isinstance(acquired, int) and not isinstance(acquired, bool) and acquired >= 0
                    and len(transitions) == acquired,
            }
            prefixes.append({'index': index, 'prefixId': prefix.get('id'),
                             'acquiredActions': acquired,
                             'retainedTransitionCount': len(transitions) if isinstance(transitions, list) else None,
                             'checks': checks, 'passed': all(checks.values())})
        owners.append({'requirement': requirement, 'prefixesChecked': len(prefixes),
                       'prefixesPassed': sum(prefix['passed'] for prefix in prefixes),
                       'transitionsRetained': sum(prefix['retainedTransitionCount'] or 0 for prefix in prefixes),
                       'passed': bool(prefixes) and all(prefix['passed'] for prefix in prefixes),
                       'prefixes': prefixes})
    return {'schema': 'logos-engine.passive-owner-evidence-presence.v1',
            'report': PROOF.evidence(report_path), 'caseManifest': PROOF.evidence(manifest_path),
            'owners': owners, 'passed': all(owner['passed'] for owner in owners),
            'qualification': 'Post-run evidence-presence checks on every completed current replay prefix. '
                'The manifest declares retained owner identity, exact source-field names and checkpoint format. '
                'Each retained checkpoint is checked against its own current source projection, and its '
                'transition count against that prefix acquiredActions. These checks neither initialize '
                'native state nor assert equality with an older baseline, complete caller parity or a live game success. '
                'They are separate from the 17 historical regression comparisons.'}


def execution_inputs(manifest_path, source_manifest_path):
    paths = [Path(__file__), COMPARATOR_PATH, ROOT / REPLAY,
             ROOT / 'scripts/run-v53-campaign-proof.py',
             ROOT / 'tests/helpers/v6-live-game-campaign.ts', manifest_path, source_manifest_path]
    return {path.relative_to(ROOT).as_posix(): PROOF.sha(path) for path in paths}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', help='Repository-relative case manifest with pinned input hashes')
    parser.add_argument('directory', nargs='?', help='Frozen campaign directory containing source-manifest.json')
    parser.add_argument('--preflight', action='store_true', help='Validate archived inputs only; execute no replay and write no file')
    parser.add_argument('--workers', type=int, choices=[1, 2], default=2)
    parser.add_argument('--timeout-seconds', type=int, default=2400)
    args = parser.parse_args()
    if not 1 <= args.timeout_seconds <= 2400:
        parser.error('Replay timeouts must be between 1 and 2400 seconds')
    manifest_path = local_path(args.manifest)
    cases, totals, requirements = prepare(manifest_path)
    if args.preflight:
        print(json.dumps({'mode': 'read-only-preflight', 'status': 'passed',
                          'manifest': PROOF.evidence(manifest_path), 'cases': len(cases),
                          'totals': totals, 'passiveOwnerRequirements': requirements, 'replaysExecuted': 0}), flush=True)
        return
    if not args.directory:
        parser.error('A frozen campaign directory is required for execution')
    base = local_path(args.directory)
    source_manifest_path = base / 'source-manifest.json'
    frozen = READ(source_manifest_path)
    if frozen != PROOF.native_source():
        raise ValueError('Current native source differs from the declared freeze')
    out = base / 'regressions'
    summary_path = out / 'regression-summary.json'
    if summary_path.exists():
        raise FileExistsError(summary_path)
    out.mkdir(parents=True, exist_ok=True)
    for item in cases:
        for suffix in ['replay.json.gz', 'comparison.json', 'passive-owner-presence.json', 'output.log.gz', 'execution.json']:
            path = out / f"{item['id']}-{suffix}"
            if path.exists():
                raise FileExistsError(path)
    inputs_before = execution_inputs(manifest_path, source_manifest_path)
    memory_before = COMPARATOR.memory()

    def run(item):
        name, game, baseline, trace_path = item['id'], item['game'], item['baseline'], item['trace']
        report_path, comparison_path = out / f'{name}-replay.json.gz', out / f'{name}-comparison.json'
        presence_path = out / f'{name}-passive-owner-presence.json'
        log_path, execution_path = out / f'{name}-output.log.gz', out / f'{name}-execution.json'
        before, trace = READ(baseline), READ(trace_path)
        immutable_inputs = {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        source_before = PROOF.native_source()
        if source_before != frozen:
            raise ValueError('Native source changed before replay: ' + name)
        command = ['node', REPLAY, baseline.relative_to(ROOT).as_posix(),
                   trace_path.relative_to(ROOT).as_posix(), report_path.relative_to(ROOT).as_posix()]
        started, clock = UTC(), time.monotonic()
        print(json.dumps({'case': name, 'game': game, 'phase': 'started',
                          'expectedActions': item['counts']['commands'],
                          'maximumConcurrentReplays': args.workers}), flush=True)
        timed_out = False
        with tempfile.TemporaryFile() as output:
            try:
                completed = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                           timeout=args.timeout_seconds)
                exit_code = completed.returncode
            except subprocess.TimeoutExpired:
                timed_out, exit_code = True, 124
            output.seek(0)
            with log_path.open('xb') as destination:
                with gzip.GzipFile(filename='', mode='wb', fileobj=destination, mtime=0) as compressed:
                    for chunk in iter(lambda: output.read(1024 * 1024), b''):
                        compressed.write(chunk)
        row = {'case': name, 'game': game, 'mode': 'recorded-public-replay', 'command': command,
               'startedAt': started, 'finishedAt': UTC(), 'elapsedSeconds': time.monotonic() - clock,
               'exitCode': exit_code, 'timeoutSeconds': args.timeout_seconds, 'timedOut': timed_out,
               **immutable_inputs, 'output': PROOF.evidence(log_path), 'passed': False}
        if report_path.exists():
            try:
                actual = READ(report_path)
                row.update(report=PROOF.evidence(report_path), status=actual['status'],
                           actions=len(actual['actions']), prefixes=len(actual['prefixes']), final=actual['final'])
                presence = passive_owner_presence(actual, requirements, report_path, manifest_path)
                WRITE(presence_path, presence)
                row.update(passiveOwnerPresence=PROOF.evidence(presence_path),
                           passiveOwnerPresencePassed=presence['passed'],
                           passiveOwnerPrefixesChecked=sum(owner['prefixesChecked'] for owner in presence['owners']),
                           passiveOwnerPrefixesPassed=sum(owner['prefixesPassed'] for owner in presence['owners']),
                           passiveOwnerTransitionsRetained=sum(owner['transitionsRetained'] for owner in presence['owners']))
                comparison = COMPARATOR.compare(before, actual, trace, frozen, baseline, report_path, trace_path)
                comparison['legacyComparatorMetadata'] = {
                    'implementation': PROOF.evidence(COMPARATOR_PATH),
                    'schema': comparison['schema'], 'qualification': comparison['qualification'],
                    'checkLabelsPreserved': True,
                }
                comparison['schema'] = 'logos-engine.scoped-public-regression-comparison.v1'
                comparison['qualification'] = QUALIFICATION
                if len(comparison['checks']) != 17:
                    raise ValueError('The retained comparator check count changed')
                WRITE(comparison_path, comparison)
                row.update(comparison=PROOF.evidence(comparison_path), comparisonPassed=comparison['passed'],
                           comparisonChecks=len(comparison['checks']),
                           failedChecks=[check['name'] for check in comparison['checks'] if not check['passed']])
                row['passed'] = exit_code == 0 and comparison['passed'] and presence['passed']
            except Exception as error:
                row['comparisonError'] = f'{type(error).__name__}: {error}'
        source_after = PROOF.native_source()
        row['nativeSourceBeforeDigest'] = source_before['digest']
        row['nativeSourceAfterDigest'] = source_after['digest']
        row['nativeSourceUnchanged'] = source_before == source_after == frozen
        row['immutableInputsUnchanged'] = immutable_inputs == {
            'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        row['passed'] = row['passed'] and row['nativeSourceUnchanged'] and row['immutableInputsUnchanged']
        WRITE(execution_path, row)
        row['execution'] = PROOF.evidence(execution_path)
        print(json.dumps({'case': name, 'game': game, 'phase': 'completed', 'passed': row['passed'],
                          'actions': row.get('actions'),
                          'levelsCompleted': row.get('final', {}).get('levelsCompleted'),
                          'passiveOwnerPresencePassed': row.get('passiveOwnerPresencePassed'),
                          'failedChecks': row.get('failedChecks')}), flush=True)
        return row

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(run, cases))
    source_after = PROOF.native_source()
    inputs_after = execution_inputs(manifest_path, source_manifest_path)
    unchanged = source_after == frozen and inputs_before == inputs_after
    passed = unchanged and all(row['passed'] for row in results)
    value = {'schema': 'logos-engine.recorded-public-regressions.v1',
             'status': 'passed' if passed else 'failed', 'caseManifest': PROOF.evidence(manifest_path),
             'nativeSource': frozen, 'nativeSourceAfter': source_after,
             'executionInputs': inputs_before, 'executionInputsAfter': inputs_after,
             'executionInputsUnchanged': unchanged, 'maximumConcurrentReplays': args.workers,
             'memoryBefore': memory_before, 'memoryAfter': COMPARATOR.memory(),
             'prevalidatedTotals': totals, 'results': results,
             'passed': sum(row['passed'] for row in results), 'total': len(results),
             'comparisonChecksPassed': sum(row.get('comparisonChecks', 0) - len(row.get('failedChecks', []))
                                           for row in results if 'comparisonChecks' in row),
             'comparisonChecksExpected': 17 * len(cases),
             'passiveOwnerRequirements': requirements,
             'passiveOwnerPrefixesChecked': sum(row.get('passiveOwnerPrefixesChecked', 0) for row in results),
             'passiveOwnerPrefixesPassed': sum(row.get('passiveOwnerPrefixesPassed', 0) for row in results),
             'passiveOwnerTransitionsRetained': sum(row.get('passiveOwnerTransitionsRetained', 0) for row in results),
             'qualification': QUALIFICATION}
    WRITE(summary_path, value)
    print(json.dumps({'status': value['status'], 'passed': value['passed'], 'total': value['total'],
                      'comparisonChecksPassed': value['comparisonChecksPassed']}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
