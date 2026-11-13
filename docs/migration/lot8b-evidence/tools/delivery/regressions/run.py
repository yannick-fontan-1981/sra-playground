#!/usr/bin/env python3
"""Prospective 8B recorded regressions using immutable 8A replay tools.

No archive is restored here. The root declares and saves the plan, materializes
only its eleven named baselines, then supplies the canonical native manifest.
Every child has its own process group and durable stdout/stderr. Prevalidation,
Node replay and the unchanged seventeen-check comparator never overlap.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import traceback

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[6]
SELF = Path(__file__).resolve()
CHILD = 'scripts/run-released-public-regressions.py'
EXPECTED_GAMES = ['CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV', 'TRIA', 'CRAF', 'ISOS', 'KATA']
LIMITS = {'maximumConcurrentProcessGroups': 1, 'nodeOldSpaceMiB': 1536,
          'prevalidationSeconds': 300, 'replaySeconds': 600, 'comparisonSeconds': 180,
          'campaignSeconds': 2400, 'terminationGraceSeconds': 5, 'retentionSeconds': 60,
          'automaticRetry': False}
NATIVE_ID = {'fileCount': 331, 'digest': '3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be'}
REPLAY_SELECTION = {
    'default': 'docs/migration/lot8a-evidence/tools/replay-recorded-public-streaming.mjs',
    'WEAV': 'docs/migration/lot8a-evidence/tools/replay-recorded-public-released-streaming-v2.mjs',
}
STOP_SIGNAL = None
FORWARD = True


def utc():
    return datetime.now(timezone.utc).isoformat()


def stop(signum, _frame):
    global STOP_SIGNAL
    STOP_SIGNAL = signum


def emit(value):
    global FORWARD
    if FORWARD:
        try:
            print(json.dumps(value), flush=True)
        except (BrokenPipeError, OSError):
            FORWARD = False


def local(value):
    if not isinstance(value, str) or not value or Path(value).is_absolute() or '..' in Path(value).parts:
        raise ValueError('Expected a repository-relative path')
    path = ROOT / value
    for ancestor in [path, *path.parents]:
        if ancestor.is_symlink():
            raise ValueError('Symlink inputs or outputs are not supported')
        if ancestor == ROOT:
            break
    path.resolve().relative_to(ROOT)
    return path


def relative(path):
    return Path(path).relative_to(ROOT).as_posix()


def read(path):
    with Path(path).open() as stream:
        return json.load(stream)


def write_new(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())


def atomic(path, value):
    temporary = path.with_name(path.name + '.tmp')
    with temporary.open('w') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, path)


def fingerprint(path, deadline=None):
    digest = hashlib.sha256()
    size = 0
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            if deadline is not None and time.monotonic() >= deadline:
                raise TimeoutError('Input inventory exceeded its declared time budget')
            size += len(chunk); digest.update(chunk)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def native_source(deadline):
    # Same complete-relative-path ordering as the immutable campaign harness.
    files = {relative(path): fingerprint(path, deadline)['sha256']
             for folder in ['src/logos-engine', 'src/runtime']
             for path in (ROOT / folder).rglob('*')
             if path.is_file() and path.suffix in {'.ts', '.json', '.drm'}}
    ordered = dict(sorted(files.items()))
    digest = hashlib.sha256(json.dumps(ordered, separators=(',', ':')).encode()).hexdigest()
    return {'fileCount': len(ordered), 'digest': digest, 'files': ordered}


def group_alive(pid):
    try:
        os.killpg(pid, 0)
        return True
    except ProcessLookupError:
        return False


def terminate_group(child):
    if not group_alive(child.pid):
        child.poll()
        return {'termSent': False, 'killSent': False, 'groupStopped': True}
    result = {'termSent': True, 'killSent': False, 'groupStopped': False}
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        child.poll()
        result['groupStopped'] = True
        return result
    deadline = time.monotonic() + LIMITS['terminationGraceSeconds']
    while time.monotonic() < deadline:
        child.poll()
        if not group_alive(child.pid):
            result['groupStopped'] = True
            return result
        time.sleep(0.1)
    if group_alive(child.pid):
        result['killSent'] = True
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + LIMITS['terminationGraceSeconds']
    while time.monotonic() < deadline:
        child.poll()
        if not group_alive(child.pid):
            result['groupStopped'] = True
            return result
        time.sleep(0.1)
    child.poll()
    result['groupStopped'] = not group_alive(child.pid)
    return result


def run_phase(directory, name, command, maximum_seconds, campaign_deadline, environment):
    started = time.monotonic()
    allowed = min(maximum_seconds, max(0.0, campaign_deadline - started))
    row = {'schema': 'logos-engine.lot8b.recorded-process.v1', 'name': name,
           'command': command, 'cwd': str(ROOT), 'startedAt': utc(),
           'phaseTimeoutSeconds': maximum_seconds, 'effectiveTimeoutSeconds': allowed,
           'environment': {key: environment[key] for key in ['NODE_OPTIONS', 'PYTHONDONTWRITEBYTECODE', 'PYTHONHASHSEED']},
           'status': 'started', 'pid': None, 'processGroup': None, 'exitCode': None,
           'timedOut': False, 'interrupted': False, 'automaticRetry': False}
    started_path = directory / f'{name}.started.json'
    receipt_path = directory / f'{name}.receipt.json'
    stdout_path = directory / f'{name}.stdout.log'
    stderr_path = directory / f'{name}.stderr.log'
    write_new(started_path, row)
    child = None
    try:
        with stdout_path.open('xb', buffering=0) as stdout, stderr_path.open('xb', buffering=0) as stderr:
            if allowed <= 0 or STOP_SIGNAL is not None:
                row['status'] = 'not_executed'
                row['reason'] = 'campaign_budget_exhausted' if allowed <= 0 else 'interrupted_before_launch'
            else:
                child = subprocess.Popen(command, cwd=ROOT, env=environment,
                                         stdout=stdout, stderr=stderr, start_new_session=True)
                row.update(status='running', pid=child.pid, processGroup=child.pid)
                atomic(receipt_path, row)
                last_status = started
                while child.poll() is None:
                    now = time.monotonic()
                    if STOP_SIGNAL is not None or now - started >= allowed:
                        row['interrupted'] = STOP_SIGNAL is not None
                        row['timedOut'] = not row['interrupted']
                        row['reason'] = ('signal_' + str(STOP_SIGNAL)) if row['interrupted'] else (
                            'campaign_budget_exhausted' if now >= campaign_deadline else 'phase_timeout')
                        row['termination'] = terminate_group(child)
                        if not row['termination']['groupStopped']:
                            raise RuntimeError('Process group did not stop within the termination grace')
                        break
                    if now - last_status >= 15:
                        row.update(elapsedSeconds=now - started, lastObservedAt=utc(),
                                   stdoutBytes=stdout_path.stat().st_size, stderrBytes=stderr_path.stat().st_size)
                        atomic(receipt_path, row)
                        emit({'phase': name, 'status': 'running', 'elapsedSeconds': round(now - started, 2)})
                        last_status = now
                    time.sleep(0.2)
                row['exitCode'] = child.wait(timeout=LIMITS['terminationGraceSeconds'])
                if group_alive(child.pid):
                    row['remainingGroupCleanup'] = terminate_group(child)
                row['status'] = 'passed' if row['exitCode'] == 0 and not row['timedOut'] and not row['interrupted'] else 'failed'
            os.fsync(stdout.fileno()); os.fsync(stderr.fileno())
    except BaseException as error:
        row.update(status='failed', error=f'{type(error).__name__}: {error}', traceback=traceback.format_exc())
    finally:
        row['processGroupStopped'] = child is None
        if child is not None:
            try:
                # A failed earlier cleanup is not retried: record it and stop
                # the campaign rather than starting a concurrent process group.
                prior_cleanup = row.get('remainingGroupCleanup', row.get('termination'))
                if (child.poll() is None or group_alive(child.pid)) and prior_cleanup is None:
                    row['finalGroupCleanup'] = terminate_group(child)
                row['exitCode'] = child.poll()
                row['processGroupStopped'] = row['exitCode'] is not None and not group_alive(child.pid)
            except BaseException as error:
                row['cleanupError'] = f'{type(error).__name__}: {error}'
            if not row['processGroupStopped']:
                row['status'] = 'failed'
                row['reason'] = 'process_group_did_not_stop'
        row.update(finishedAt=utc(), elapsedSeconds=time.monotonic() - started)
        for key, path in [('stdout', stdout_path), ('stderr', stderr_path)]:
            if path.exists():
                row[key] = {'path': relative(path), **fingerprint(path)}
        atomic(receipt_path, row)
        emit({'phase': name, 'status': row['status'], 'elapsedSeconds': round(row['elapsedSeconds'], 2), 'exitCode': row['exitCode']})
    if not row['processGroupStopped']:
        raise RuntimeError('Process group remains active; no further child will launch. Receipt: ' + relative(receipt_path))
    return row


def inventory(paths, deadline):
    return {relative(path): fingerprint(path, deadline) for path in sorted(set(paths))}


def check_manifest(manifest, manifest_path, source_path, deadline):
    if manifest['schema'] != 'logos-engine.recorded-public-regression-cases.v1' or manifest['limits'] != LIMITS:
        raise ValueError('Manifest schema or declared limits changed')
    inherited = manifest['inheritedCaseManifest']
    historical_path = local(inherited['path'])
    if fingerprint(historical_path, deadline)['sha256'] != inherited['sha256']:
        raise ValueError('Historical case manifest changed')
    historical = read(historical_path)
    if manifest['cases'] != historical['cases'] or [item['game'] for item in manifest['cases']] != EXPECTED_GAMES:
        raise ValueError('The exact eleven historical cases and order are required; LKEY is excluded')
    if manifest['passiveOwnerRequirements'] != [] or manifest['strictComparator'] != historical['strictComparator']:
        raise ValueError('Historical comparator or owner requirements changed')
    if manifest['strictComparisonCheckNames'] != historical['strictComparisonCheckNames'] or manifest['expectedComparisonChecks'] != 187:
        raise ValueError('Exactly seventeen original projections per case are required')
    if manifest['replaySelection'] != REPLAY_SELECTION or not all(path in manifest['tools'] for path in REPLAY_SELECTION.values()):
        raise ValueError('Only the pinned immutable 8A replay hosts are allowed')
    if {key: manifest['frozenNativeSource'][key] for key in NATIVE_ID} != NATIVE_ID:
        raise ValueError('The canonical 331-file candidate identity is required')
    if source_path != local(manifest['frozenNativeSource']['path']):
        raise ValueError('Source manifest path differs from the declared candidate')
    paths = [SELF, manifest_path, source_path, historical_path]
    for name, expected in manifest['tools'].items():
        path = local(name)
        if fingerprint(path, deadline)['sha256'] != expected:
            raise ValueError('Pinned regression dependency changed: ' + name)
        paths.append(path)
    for case in manifest['cases']:
        for role in ['baseline', 'trace']:
            item = case[role]; path = local(item['path'])
            if fingerprint(path, deadline)['sha256'] != item['sha256']:
                raise ValueError('Pinned archive differs: ' + item['path'])
            paths.append(path)
    frozen = read(source_path)
    if {key: frozen[key] for key in NATIVE_ID} != NATIVE_ID or native_source(deadline) != frozen:
        raise ValueError('Current native files differ from the canonical frozen candidate')
    return paths, frozen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', default=relative(SELF.with_name('cases.json')))
    parser.add_argument('--source-manifest', required=True)
    parser.add_argument('--output', required=True, help='New evidence directory; existing directories are never reused')
    args = parser.parse_args()
    manifest_path, source_path, output = local(args.manifest), local(args.source_manifest), local(args.output)
    output.relative_to(ROOT / 'docs/migration/lot8b-evidence/delivery-qualification-01')
    output.mkdir(parents=True, exist_ok=False)
    started = time.monotonic(); deadline = started + LIMITS['campaignSeconds']
    row = {'schema': 'logos-engine.lot8b.recorded-regressions.v1', 'status': 'started',
           'startedAt': utc(), 'manifest': relative(manifest_path), 'sourceManifest': relative(source_path),
           'limits': LIMITS, 'results': [], 'total': 11, 'passed': 0,
           'comparisonChecksExpected': 187, 'comparisonChecksPassed': 0,
           'globalLockAcquired': False, 'officialPerformanceMeasurement': False,
           'liveGameExecution': False, 'LKEY': 'Permanently closed and excluded',
           'memoryQualification': '1536 MiB bounds the Node old-space heap only. Python comparison memory and aggregate RSS are not bounded by that flag. Child process lifetimes do not overlap.'}
    write_new(output / 'run.started.json', row)
    paths = []; inputs_before = None; frozen = None; manifest = None
    environment = os.environ.copy()
    environment.update(NODE_OPTIONS='--max-old-space-size=1536', PYTHONDONTWRITEBYTECODE='1', PYTHONHASHSEED='0')
    try:
        manifest = read(manifest_path)
        paths, frozen = check_manifest(manifest, manifest_path, source_path, deadline)
        node = shutil.which('node')
        if node is None:
            raise FileNotFoundError('Node executable is unavailable')
        row['executables'] = {name: {'path': path, **fingerprint(path, deadline)}
                              for name, path in [('node', node), ('python', sys.executable)]}
        inputs_before = inventory(paths, deadline)
        write_new(output / 'inputs-before.json', inputs_before)
        write_new(output / 'native-before.json', frozen)
        preflight = run_phase(output, 'prevalidation', [sys.executable, '-B', CHILD, '--prepare-manifest', relative(manifest_path)],
                              LIMITS['prevalidationSeconds'], deadline, environment)
        row['prevalidation'] = preflight
        if preflight['status'] != 'passed':
            raise RuntimeError('Archived-return prevalidation failed; no replay launched')
        prepared = read(local(preflight['stdout']['path']))
        if prepared['totals'] != manifest['expectedTotals'] or [item['id'] for item in prepared['cases']] != [item['id'] for item in manifest['cases']]:
            raise ValueError('Historical case population or complete public-return totals changed')
        row['prevalidatedTotals'] = prepared['totals']
        for case in manifest['cases']:
            if STOP_SIGNAL is not None or time.monotonic() >= deadline:
                break
            if inventory(paths, deadline) != inputs_before or native_source(deadline) != frozen:
                raise ValueError('Declared inputs changed before case ' + case['id'])
            case_output = output / case['id']; case_output.mkdir()
            report = case_output / 'replay.json.gz'
            preparation = case_output / 'host-preparation.json'
            result = {'case': case['id'], 'game': case['game'], 'passed': False,
                      'baseline': case['baseline'], 'trace': case['trace']}
            row['results'].append(result)
            script = manifest['replaySelection']['WEAV' if case['game'] == 'WEAV' else 'default']
            command = [node]
            if case['game'] == 'WEAV':
                command += ['--expose-gc', '--max-old-space-size=1536']
            command += [script, case['baseline']['path'], case['trace']['path'], relative(report)]
            if case['game'] == 'WEAV':
                command.append(relative(preparation))
            result['replay'] = run_phase(case_output, 'replay', command, LIMITS['replaySeconds'], deadline, environment)
            result['hostPreparationPassed'] = case['game'] != 'WEAV'
            if case['game'] == 'WEAV' and preparation.exists():
                prepared_host = read(preparation)
                roots = prepared_host.get('hostOnlyRootsCollectedBeforeHarnessImport', {})
                result['hostPreparationPassed'] = (prepared_host.get('status') == 'passed'
                    and prepared_host.get('baselineRootCollectedBeforeHarnessImport') is True
                    and set(roots) == {'baselineCompressedBuffer', 'baselineDecodedBuffer', 'traceCompressedBuffer',
                                      'traceDecodedBuffer', 'traceRoot', 'copiedExpectationRoot'}
                    and all(value is True for value in roots.values()))
                result['hostPreparation'] = {'path': relative(preparation), **fingerprint(preparation)}
            # The pinned 8A writer installs this final pathname atomically only
            # after complete JSON/gzip output. In-progress paths are never read.
            if report.exists() and STOP_SIGNAL is None and time.monotonic() < deadline:
                data = {'baseline': case['baseline']['path'], 'trace': case['trace']['path'], 'report': relative(report),
                        'sourceManifest': relative(source_path), 'caseManifest': relative(manifest_path),
                        'comparison': relative(case_output / 'comparison.json'),
                        'presence': relative(case_output / 'passive-owner-presence.json'), 'requirements': []}
                comparison = run_phase(case_output, 'comparison', [sys.executable, '-B', CHILD, '--compare-case', json.dumps(data, separators=(',', ':'))],
                                       LIMITS['comparisonSeconds'], deadline, environment)
                result['comparisonProcess'] = comparison
                if comparison['status'] == 'passed':
                    checked = read(local(comparison['stdout']['path']))
                    result['comparisonResult'] = checked
                    checks = read(local(checked['comparison']['path']))['checks']
                    result['originalCheckNamesPreserved'] = [item['name'] for item in checks] == manifest['strictComparisonCheckNames']
                    result['passed'] = (result['replay']['status'] == 'passed' and result['hostPreparationPassed']
                        and result['originalCheckNamesPreserved'] and checked['status'] == 'passed'
                        and checked['comparisonPassed'] and checked['comparisonChecks'] == 17
                        and checked['failedChecks'] == [] and checked['passiveOwnerPresencePassed'])
            else:
                result['comparisonNotExecuted'] = 'No complete final report, interrupted campaign, or exhausted time budget'
            result['inputsUnchanged'] = inventory(paths, deadline) == inputs_before and native_source(deadline) == frozen
            result['passed'] = result['passed'] and result['inputsUnchanged']
            write_new(case_output / 'result.json', result)
            emit({'case': case['id'], 'passed': result['passed'], 'comparisonChecks': result.get('comparisonResult', {}).get('comparisonChecks', 0)})
            if not result['inputsUnchanged']:
                raise ValueError('Declared inputs changed during case ' + case['id'])
    except BaseException as error:
        row.update(error=f'{type(error).__name__}: {error}', traceback=traceback.format_exc())
    finally:
        retention_start = time.monotonic()
        try:
            if inputs_before is not None:
                inputs_after = inventory(paths, retention_start + LIMITS['retentionSeconds'])
                native_after = native_source(retention_start + LIMITS['retentionSeconds'])
                write_new(output / 'inputs-after.json', inputs_after)
                write_new(output / 'native-after.json', native_after)
                row['inputsUnchanged'] = inputs_after == inputs_before and native_after == frozen
        except BaseException as error:
            row['retentionError'] = f'{type(error).__name__}: {error}'
            row['inputsUnchanged'] = False
        done = {item['case'] for item in row['results']}
        row['notExecuted'] = [item['id'] for item in (manifest or {}).get('cases', []) if item['id'] not in done]
        row['passed'] = sum(bool(item.get('passed')) for item in row['results'])
        row['comparisonChecksPassed'] = sum(item.get('comparisonResult', {}).get('comparisonChecks', 0)
            - len(item.get('comparisonResult', {}).get('failedChecks', [])) for item in row['results'])
        row['status'] = 'passed' if row['passed'] == 11 and row['comparisonChecksPassed'] == 187 and row.get('inputsUnchanged') and not row.get('error') and STOP_SIGNAL is None else 'failed'
        row.update(finishedAt=utc(), elapsedSeconds=time.monotonic() - started,
                   retentionSeconds=time.monotonic() - retention_start, interruptedBySignal=STOP_SIGNAL)
        row['qualification'] = 'Exactly eleven historical recorded-return cases and seventeen unchanged projections each. No live game, LKEY, full caller parity, newly added owner-state equality, official cost or publication claim.'
        write_new(output / 'regression-summary.json', row)
        emit({'status': row['status'], 'passed': row['passed'], 'total': 11, 'comparisonChecksPassed': row['comparisonChecksPassed'],
              'summary': relative(output / 'regression-summary.json')})
    return 0 if row['status'] == 'passed' else 1


if __name__ == '__main__':
    for stop_signal in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP]:
        signal.signal(stop_signal, stop)
    raise SystemExit(main())
