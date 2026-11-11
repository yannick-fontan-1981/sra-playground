#!/usr/bin/env python3
"""V2 durable driver for one declared WEAV replay with released host inputs.

Derived from scripts/run-released-public-regressions-streamlog.py. The replay
path is explicit below; no imported runner constant is replaced. Child
prevalidation and the unchanged seventeen-check comparator stay in the
original released-baseline driver, outside the lifetime of the Node replay.

Node writes directly to a persistent raw file, never to an anonymous temporary
file or a pipe connected to this tool session. An immutable started receipt is
written before Popen, current status is replaced atomically, and exit metadata
is finalized even on catchable interruption. SIGKILL cannot run finally; the
started receipt, last status and raw journal then remain as incomplete evidence.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
HISTORICAL_PINS = {
    'scripts/run-released-public-regressions-streamlog.py': 'b05b0e113c93696be45408e4c10549f2a379c22330efbddfcaa0f09cd51309b9',
    'scripts/run-released-public-regressions.py': '7988863afd2b171f31987434bb1176370be2e3afd49dead1edcdc59770d81909',
    'scripts/replay-public-regression-released-baseline.mjs': '2ce2a0e1b8f969510373ae161156b2b163d208b4e426cb1f26218f9952b3b164',
    'scripts/run-recorded-public-regressions.py': 'df19dc88ff29e78a1cb5935d445644e96cc9fb1ef90b73d802cf51868d2b2c40',
    'scripts/compare-v54-regressions.py': 'f13fee083fda44ff4bd71ac46bc01cdce99eaccf9d6c691a2df7040e698b36c0',
    'docs/migration/lot8a-evidence/tools/write-streamed-evidence-gzip.mjs': 'bd07e39ee109fd3c714a755fa68799012f25187ee441f72f5fc4544c1742da12',
    'docs/migration/lot10b-evidence/stream-evidence-json.mjs': '96ac2ddbaac8cc62126f6674301b2362301895f44ce90e5dbd1dec9fb6fc87ca',
}
for pinned, expected_sha256 in HISTORICAL_PINS.items():
    if hashlib.sha256((ROOT / pinned).read_bytes()).hexdigest() != expected_sha256:
        raise ValueError('Pinned recovery dependency changed: ' + pinned)
PREVIOUS_DRIVER = ROOT / 'scripts/run-released-public-regressions.py'
SPEC = importlib.util.spec_from_file_location('released_replay_driver', PREVIOUS_DRIVER)
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
RUNNER, PROOF, READ, WRITE, UTC = BASE.RUNNER, BASE.PROOF, BASE.READ, BASE.WRITE, BASE.UTC
COMPARATOR = BASE.COMPARATOR
REPLAY = 'docs/migration/lot8a-evidence/tools/replay-recorded-public-released-streaming-v2.mjs'
QUALIFICATION = BASE.QUALIFICATION + (
    ' The durable driver preserves raw Node output from process start, before '
    'any compression or comparison. A lost tool connection is not classified '
    'as out-of-memory without a retained exit signal or fatal diagnostic. '
    'V2 keeps the1536MiB heap cap and archives the complete report through the '
    'declared lossless streaming writer. Only one separately declared WEAV '
    'case is admitted in this recovery; no production runtime state is pruned.'
)
FORWARD_ENABLED = True


def emit(value):
    global FORWARD_ENABLED
    if FORWARD_ENABLED:
        try:
            print(json.dumps(value), flush=True)
        except (BrokenPipeError, OSError):
            # A lost display pipe must not discard the on-disk Node journal.
            FORWARD_ENABLED = False


def atomic_json(path, value):
    temporary = path.with_name(path.name + f'.tmp-{os.getpid()}')
    with temporary.open('w') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, path)


def process_memory(pid):
    result = {'pid': pid}
    try:
        for line in Path(f'/proc/{pid}/status').read_text().splitlines():
            key, _, value = line.partition(':')
            if key in {'VmRSS', 'VmHWM', 'VmSize', 'Threads'}:
                result[key] = value.strip()
    except (FileNotFoundError, ProcessLookupError):
        result['processPresent'] = False
    return result


class DriverInterrupted(BaseException):
    pass


def interrupted(signum, _frame):
    raise DriverInterrupted(f'Catchable process signal {signum}')


def run_node(command, paths, initial, timeout):
    row = {**initial, 'phase': 'started', 'finishedAt': None, 'exitCode': None,
           'timedOut': False, 'passed': False, 'nodeExitObserved': False,
           'rawOutputPath': paths['raw'].relative_to(ROOT).as_posix(),
           'driverPid': os.getpid(), 'nodePid': None, 'memorySamples': []}
    # Both receipts are durable before the child can emit its first byte.
    WRITE(paths['started'], row)
    atomic_json(paths['execution'], row)
    child, clock, last_emit, last_status = None, time.monotonic(), 0.0, 0.0
    last_event, pending = None, b''
    old_handlers = {sig: signal.signal(sig, interrupted) for sig in [signal.SIGINT, signal.SIGTERM, signal.SIGHUP]}
    try:
        with paths['raw'].open('xb', buffering=0) as raw:
            child = subprocess.Popen(command, cwd=ROOT, stdout=raw, stderr=subprocess.STDOUT)
            row.update(phase='node_running', nodePid=child.pid)
            atomic_json(paths['execution'], row)
            with paths['raw'].open('rb') as reader:
                while True:
                    now = time.monotonic()
                    chunk = reader.read(1024 * 1024)
                    if chunk:
                        pending += chunk
                        lines = pending.split(b'\n'); pending = lines.pop()
                        # The raw file is complete; the display parser is bounded.
                        if len(pending) > 1024 * 1024:
                            pending = pending[-65536:]
                        for line in lines:
                            try:
                                event = json.loads(line)
                            except (ValueError, UnicodeDecodeError):
                                if line.strip():
                                    row['lastDiagnosticLine'] = line.decode('utf8', errors='replace')[-1000:]
                                continue
                            if isinstance(event, dict):
                                last_event = {key: event[key] for key in ['phase', 'operation', 'sequence', 'kind',
                                    'actions', 'cycles', 'level', 'levelsCompleted', 'family', 'reason', 'status', 'failure'] if key in event}
                                if event.get('phase') in {'failure', 'completed-level', 'baseline-released'}:
                                    emit({'case': row['case'], 'nodeProgress': last_event})
                    if now - last_status >= 5 or child.poll() is not None:
                        memory = process_memory(child.pid)
                        row['memorySamples'].append({'elapsedSeconds': now - clock, **memory})
                        row.update(lastObservedAt=UTC(), elapsedSeconds=now - clock,
                                   lastProgress=last_event, rawOutputBytes=paths['raw'].stat().st_size)
                        os.fsync(raw.fileno())
                        atomic_json(paths['execution'], row)
                        last_status = now
                    if now - last_emit >= 15:
                        emit({'case': row['case'], 'phase': 'node_running', 'elapsedSeconds': round(now - clock, 2),
                              'lastProgress': last_event, 'nodeMemory': process_memory(child.pid)})
                        last_emit = now
                    if child.poll() is not None:
                        # Drain bytes written between the previous read and exit.
                        remainder = reader.read()
                        if remainder:
                            row['lastOutputTail'] = (pending + remainder).decode('utf8', errors='replace')[-2000:]
                        break
                    if now - clock >= timeout:
                        row['timedOut'] = True
                        raise TimeoutError(f'Node exceeded declared {timeout}s timeout')
                    time.sleep(0.25)
    except BaseException as error:
        row['driverInterruption'] = f'{type(error).__name__}: {error}'
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
        if child is not None:
            if child.poll() is None:
                try:
                    child.terminate(); child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill(); child.wait(timeout=5)
                except ProcessLookupError:
                    pass
            row['exitCode'] = child.poll()
            row['nodeExitObserved'] = child.poll() is not None
        row.update(phase='node_finished', finishedAt=UTC(), elapsedSeconds=time.monotonic() - clock)
        if paths['raw'].exists():
            row['outputRaw'] = PROOF.evidence(paths['raw'])
            with paths['raw'].open('rb') as source, paths['log'].open('xb') as destination:
                with gzip.GzipFile(filename='', mode='wb', fileobj=destination, mtime=0) as compressed:
                    for chunk in iter(lambda: source.read(1024 * 1024), b''):
                        compressed.write(chunk)
            row['output'] = PROOF.evidence(paths['log'])
        row['startedReceipt'] = PROOF.evidence(paths['started'])
        atomic_json(paths['execution'], row)
    return row


def inputs(manifest_path, source_manifest_path):
    result = {**BASE.execution_inputs(manifest_path, source_manifest_path),
              Path(__file__).relative_to(ROOT).as_posix(): PROOF.sha(Path(__file__))}
    for relative in [*HISTORICAL_PINS, REPLAY]:
        result[relative] = PROOF.sha(ROOT / relative)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest'); parser.add_argument('directory')
    parser.add_argument('--source-manifest', required=True)
    parser.add_argument('--node-old-space-mib', type=int, choices=[1536], default=1536)
    parser.add_argument('--timeout-seconds', type=int, default=2400)
    args = parser.parse_args()
    if not 1 <= args.timeout_seconds <= 2400:
        parser.error('Replay timeout must be between1 and2400seconds')
    manifest_path = RUNNER.local_path(args.manifest)
    base, frozen_path = RUNNER.local_path(args.directory), RUNNER.local_path(args.source_manifest)
    out, summary_path, preflight_path = base / 'regressions', base / 'regressions/regression-summary.json', base / 'preflight.json'
    for path in [summary_path, preflight_path]:
        if path.exists(): raise FileExistsError(path)
    frozen = READ(frozen_path)
    if PROOF.native_source() != frozen: raise ValueError('Current native source differs from the declared freeze')
    inputs_before, memory_before = inputs(manifest_path, frozen_path), COMPARATOR.memory()
    preflight = BASE.child('--prepare-manifest', args.manifest)
    if len(preflight['cases']) != 1 or preflight['cases'][0]['game'] != 'WEAV':
        raise ValueError('This recovery requires exactly one declared WEAV case')
    preflight.update(prevalidationProcessExitedBeforeAnyReplay=True, nativeSourceDigest=frozen['digest'])
    out.mkdir(parents=True, exist_ok=True); WRITE(preflight_path, preflight)
    requirements, results = preflight['passiveOwnerRequirements'], []
    for item in preflight['cases']:
        name, game = item['id'], item['game']
        baseline, trace_path = RUNNER.local_path(item['baseline']), RUNNER.local_path(item['trace'])
        paths = {key: out / f'{name}-{suffix}' for key, suffix in {
            'report': 'replay.json.gz', 'comparison': 'comparison.json', 'presence': 'passive-owner-presence.json',
            'raw': 'output.raw.log', 'log': 'output.log.gz', 'execution': 'execution.json',
            'started': 'execution-started.json', 'preparation': 'host-preparation.json'}.items()}
        for path in paths.values():
            if path.exists(): raise FileExistsError(path)
        immutable = {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        source_before = PROOF.native_source()
        if source_before != frozen: raise ValueError('Native source changed before replay: ' + name)
        command = ['node', '--expose-gc', f'--max-old-space-size={args.node_old_space_mib}', REPLAY,
                   item['baseline'], item['trace'], paths['report'].relative_to(ROOT).as_posix(),
                   paths['preparation'].relative_to(ROOT).as_posix()]
        row = run_node(command, paths, {'case': name, 'game': game, 'mode': 'recorded-public-replay',
            'command': command, 'startedAt': UTC(), 'timeoutSeconds': args.timeout_seconds, **immutable,
            'expectedActions': item['counts']['commands'], 'nodeOldSpaceMiB': args.node_old_space_mib,
            'preflight': PROOF.evidence(preflight_path), 'historicalReportProcessExitedBeforeNode': True,
            'nativeSourceBeforeDigest': source_before['digest'], 'executionInputsBefore': inputs_before}, args.timeout_seconds)
        try:
            row['nodeExitedBeforeComparison'] = row['nodeExitObserved']
            if paths['preparation'].exists():
                preparation = READ(paths['preparation']); row['hostPreparation'] = PROOF.evidence(paths['preparation'])
                row['hostPreparationPassed'] = (preparation['status'] == 'passed'
                    and preparation['baselineRootCollectedBeforeHarnessImport'] is True
                    and preparation.get('hostOnlyRootsCollectedBeforeHarnessImport') == {
                        'baselineCompressedBuffer': True, 'baselineDecodedBuffer': True,
                        'traceCompressedBuffer': True, 'traceDecodedBuffer': True,
                        'traceRoot': True, 'copiedExpectationRoot': True}
                    and preparation['expectedActions'] == item['counts']['commands']
                    and preparation['completePublicPackets'] == item['counts']['completePublicPackets']
                    and preparation['baseline'] == immutable['baseline'] and preparation['trace'] == immutable['trace'])
            if row['nodeExitObserved'] and paths['report'].exists():
                row['phase'] = 'comparison_running'; atomic_json(paths['execution'], row)
                emit({'case': name, 'phase': 'comparison_running', 'nodeExitCode': row['exitCode']})
                data = {'baseline': item['baseline'], 'trace': item['trace'], 'sourceManifest': args.source_manifest,
                        'caseManifest': args.manifest, 'requirements': requirements,
                        **{key: paths[key].relative_to(ROOT).as_posix() for key in ['report', 'comparison', 'presence']}}
                row.update(BASE.child('--compare-case', json.dumps(data), args.timeout_seconds))
                row['passed'] = (row['exitCode'] == 0 and row['comparisonPassed'] and row['passiveOwnerPresencePassed']
                                 and row.get('hostPreparationPassed', False) and not row.get('driverInterruption'))
        except BaseException as error:
            row['postprocessingError'] = f'{type(error).__name__}: {error}'; row['passed'] = False
        finally:
            source_after = PROOF.native_source()
            row['nativeSourceAfterDigest'] = source_after['digest']
            row['nativeSourceUnchanged'] = source_before == source_after == frozen
            row['immutableInputsUnchanged'] = immutable == {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
            row['passed'] = row['passed'] and row['nativeSourceUnchanged'] and row['immutableInputsUnchanged']
            row['phase'] = 'completed'; row['postprocessingFinishedAt'] = UTC(); atomic_json(paths['execution'], row)
        row['execution'] = PROOF.evidence(paths['execution']); results.append(row)
        emit({'case': name, 'phase': 'completed', 'passed': row['passed'], 'actions': row.get('actions'),
              'comparisonChecks': row.get('comparisonChecks'), 'failedChecks': row.get('failedChecks')})
    source_after, inputs_after = PROOF.native_source(), inputs(manifest_path, frozen_path)
    unchanged = source_after == frozen and inputs_after == inputs_before
    passed = unchanged and all(row['passed'] for row in results)
    value = {'schema': 'logos-engine.recorded-public-regressions.v1', 'status': 'passed' if passed else 'failed',
        'caseManifest': PROOF.evidence(manifest_path), 'nativeSource': frozen, 'nativeSourceAfter': source_after,
        'executionInputs': inputs_before, 'executionInputsAfter': inputs_after, 'executionInputsUnchanged': unchanged,
        'maximumConcurrentReplays': 1, 'nodeOldSpaceMiB': args.node_old_space_mib,
        'memoryBefore': memory_before, 'memoryAfter': COMPARATOR.memory(), 'preflight': PROOF.evidence(preflight_path),
        'prevalidatedTotals': preflight['totals'], 'results': results, 'passed': sum(row['passed'] for row in results),
        'total': len(results), 'comparisonChecksPassed': sum(row.get('comparisonChecks', 0) - len(row.get('failedChecks', []))
            for row in results if 'comparisonChecks' in row), 'comparisonChecksExpected': 17 * len(results),
        'passiveOwnerRequirements': requirements,
        'passiveOwnerPrefixesChecked': sum(row.get('passiveOwnerPrefixesChecked', 0) for row in results),
        'passiveOwnerPrefixesPassed': sum(row.get('passiveOwnerPrefixesPassed', 0) for row in results),
        'passiveOwnerTransitionsRetained': sum(row.get('passiveOwnerTransitionsRetained', 0) for row in results),
        'qualification': QUALIFICATION}
    WRITE(summary_path, value)
    emit({'status': value['status'], 'passed': value['passed'], 'total': value['total'],
          'comparisonChecksPassed': value['comparisonChecksPassed']})
    if not passed: raise SystemExit(1)


if __name__ == '__main__':
    main()
