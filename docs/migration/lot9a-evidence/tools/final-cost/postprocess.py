#!/usr/bin/env python3
"""Execute only retained read-only comparators after an official window closes.

Usage: python -B postprocess.py CONTRACT
No native import, measurement or lock. Logs, real exits and fingerprints are
retained; no retry, overwrite, synthesized strict refusal or suppressed output.
"""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]


def now():
    return datetime.now(timezone.utc).isoformat()


def require(ok, message):
    if not ok:
        raise ValueError(message)


def fp(name):
    path = (ROOT / name).resolve(strict=True)
    require(path.is_relative_to(ROOT) and path.is_file(), 'Comparator input must be inside this checkout')
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('contract', type=Path)
    args = parser.parse_args()
    contract = json.loads((ROOT / args.contract).read_bytes())
    require(contract['schema'] == 'logos-engine.lot9a-final-cost-contract.v1', 'Invalid contract')
    perf = contract['performanceDirectory']
    directory = (ROOT / perf).resolve(strict=True)
    require(directory.is_relative_to(ROOT / 'docs/migration/lot9a-evidence'), 'Invalid output directory')
    require(fp(Path(__file__)) in contract['inputFingerprints'], 'Postprocessor was not prospectively pinned')
    window = json.loads((directory / 'window.json').read_bytes())
    require(window['status'] == 'passed' and window['finalIntegrity'] == 'passed', 'Complete window required')
    plans = []
    for n in (1, 2):
        plans.append((f'pair{n}', ['node', 'scripts/compare-native-loop-costs.mjs', perf + '/comparison-policy.json',
            *[f'{perf}/cohort{n}/{name}' for name in ('baseline.json', 'after.json', 'comparison.json')]]))
    plans.append(('strict', ['node', 'scripts/compare-native-cost-cohorts.mjs', perf + '/comparison-policy.json',
        *[f'{perf}/cohort{n}/{name}' for n in (1, 2) for name in ('baseline.json', 'after.json', 'comparison.json')],
        perf + '/combined-comparison.json']))
    for label, command in plans:
        for path in [directory / (label + '.execution.json'), directory / (label + '.log.gz'), ROOT / command[-1]]:
            require(not path.exists(), 'Existing output refused: ' + str(path))
    for label, command in plans:
        inputs = [fp(name) for name in command[1:-1]]
        tool = next(r for r in contract['historicalTools'] if r['path'] == command[1])
        require(inputs[0] == tool, 'Historical comparator changed')
        receipt = {'schema': 'logos-engine.retained-tool-failure.v1' if label == 'strict' else 'logos-engine.retained-tool-execution.v1',
            'startedAt': now(), 'command': command, 'inputs': inputs, 'timeoutSeconds': 120,
            'globalLockAcquired': False, 'nativeExecutionPerformed': False, 'measurementPerformed': False}
        destination = directory / (label + '.execution.json')
        with destination.open('x') as stream:
            json.dump({**receipt, 'status': 'running'}, stream, indent=2)
            stream.write('\n')
        child, raw, error, timed_out, started = None, b'', None, False, time.monotonic()
        try:
            child = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                     stderr=subprocess.STDOUT, start_new_session=True)
            raw, _ = child.communicate(timeout=120)
        except BaseException as exc:
            error = type(exc).__name__
            timed_out = isinstance(exc, subprocess.TimeoutExpired)
            if child is not None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    raw, _ = child.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    raw, _ = child.communicate(timeout=5)
        finally:
            log = directory / (label + '.log.gz')
            with log.open('xb') as stream:
                stream.write(gzip.compress(raw, mtime=0))
            receipt.update(finishedAt=now(), elapsedSeconds=time.monotonic() - started,
                exitCode=child.returncode if child else None, error=error, timedOut=timed_out,
                inputsUnchanged=inputs == [fp(name) for name in command[1:-1]],
                outputExists=(ROOT / command[-1]).exists(), log=fp(log))
            receipt['status'] = 'execution_recorded'
            if receipt['outputExists']:
                receipt['output'] = fp(command[-1])
            destination.write_text(json.dumps(receipt, indent=2) + '\n')
        require(error is None and receipt['inputsUnchanged'], 'Comparator failed or inputs changed; actual evidence retained')
        if label == 'strict':
            require(receipt['exitCode'] == 1 and not receipt['outputExists']
                    and b'Within-cohort work metadata changed' in raw and b'AssertionError' in raw,
                    'Strict result is not the predeclared work-identity refusal; inspect actual evidence')
        else:
            require(receipt['exitCode'] == 0 and receipt['outputExists'], 'Original pair comparison incomplete')
        print(json.dumps({'phase': label, 'exitCode': receipt['exitCode'], 'receipt': fp(destination)}), flush=True)


if __name__ == '__main__':
    main()
