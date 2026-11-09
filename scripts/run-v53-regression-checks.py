#!/usr/bin/env python3
"""Nine bounded common-caller replays, without new live-game claims.

The retained v52 comparison checks are reused unchanged. Uncompressed inputs
for that existing reader are temporary ignored files; deliverables stay gzip.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v53_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
BASE = ROOT / 'docs/migration/native-campaigns-v52/attempt9'
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
}
HARNESS = ['scripts/run-v53-regression-checks.py', 'scripts/replay-v53-public-regression.mjs',
           'scripts/run-v53-campaign-proof.py', 'scripts/compare-v52-regressions.mjs',
           'scripts/compare-v52-material-projection.mjs', 'tests/helpers/v6-live-game-campaign.ts']


def utc():
    return datetime.now(timezone.utc).isoformat()


def read(path):
    data = path.read_bytes()
    return gzip.decompress(data) if path.name.endswith('.gz') else data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    args = parser.parse_args()
    out = ROOT / args.directory
    summary_path = out / 'regression-summary.json'
    if summary_path.exists():
        raise FileExistsError(summary_path)
    frozen = json.loads((out / 'source-manifest.json').read_text())
    assert frozen == proof.native_source()
    harness_before = {name: proof.sha(ROOT / name) for name in HARNESS}
    (out / 'regressions').mkdir(parents=True, exist_ok=True)
    temporary_root = ROOT / 'artifacts'
    temporary_root.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='v53-regressions-', dir=temporary_root) as temp:
        temporary = Path(temp)

        def run(item):
            game, trace_suffix = item
            stem = game.lower()
            baseline = BASE / ('gare-three-levels.json' if game == 'GARE' else f'{stem}-recorded-public-replay.json')
            if baseline.with_suffix(baseline.suffix + '.gz').exists():
                baseline = baseline.with_suffix(baseline.suffix + '.gz')
            trace = ROOT / ('docs/migration/native-campaigns-' + trace_suffix)
            report = out / f'regressions/{stem}-replay.json.gz'
            comparison = out / f'regressions/{stem}-comparison.json'
            log = out / f'regressions/{stem}-output.log.gz'
            for path in [report, comparison, log]:
                if path.exists():
                    raise FileExistsError(path)
            command = ['node', 'scripts/replay-v53-public-regression.mjs',
                       baseline.relative_to(ROOT).as_posix(), trace.relative_to(ROOT).as_posix(), report.relative_to(ROOT).as_posix()]
            start, clock = utc(), time.monotonic()
            result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            log.write_bytes(gzip.compress(result.stdout, mtime=0))
            row = {'game': game, 'mode': 'recorded-public-replay', 'command': command,
                   'startedAt': start, 'finishedAt': utc(), 'elapsedSeconds': time.monotonic() - clock,
                   'exitCode': result.returncode, 'baseline': proof.evidence(baseline),
                   'trace': proof.evidence(trace), 'output': proof.evidence(log), 'passed': False}
            if report.exists():
                actual_bytes = read(report)
                actual = json.loads(actual_bytes)
                row.update(report=proof.evidence(report), status=actual['status'], actions=len(actual['actions']),
                           prefixes=len(actual['prefixes']), final=actual['final'])
                if result.returncode == 0:
                    before_raw, after_raw = temporary / f'{stem}-baseline.json', temporary / f'{stem}-current.json'
                    before_raw.write_bytes(read(baseline)); after_raw.write_bytes(actual_bytes)
                    comparison_command = ['node', 'scripts/compare-v52-regressions.mjs',
                                          str(before_raw), str(after_raw), str(comparison)]
                    compared = subprocess.run(comparison_command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                    comparison_log = out / f'regressions/{stem}-comparison-output.log.gz'
                    comparison_log.write_bytes(gzip.compress(compared.stdout, mtime=0))
                    row.update(comparisonCommand=comparison_command, comparisonExitCode=compared.returncode,
                               comparisonOutput=proof.evidence(comparison_log))
                    if comparison.exists():
                        row['comparison'] = proof.evidence(comparison)
                    row['passed'] = compared.returncode == 0 and actual['source'] == frozen and actual['sourceUnchangedDuringRun']
            print(json.dumps({'game': game, 'passed': row['passed'], 'actions': row.get('actions'),
                              'levelsCompleted': row.get('final', {}).get('levelsCompleted')}), flush=True)
            return row

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(run, TRACES.items()))
    unchanged = proof.native_source() == frozen and harness_before == {name: proof.sha(ROOT / name) for name in HARNESS}
    passed = unchanged and all(row['passed'] for row in results)
    value = {'schema': 'logos-engine.v53.recorded-public-regressions.v1', 'status': 'passed' if passed else 'failed',
             'nativeSource': frozen, 'executionInputs': harness_before, 'executionInputsUnchanged': unchanged,
             'maximumConcurrentReplays': 2, 'results': results,
             'qualification': 'Nine cold native common-caller replays independently choose commands before consuming complete archived public returns. '
                              'The existing retained comparison checks are reused unchanged. This is no new live game, no Python-agent execution and no speed comparison.'}
    summary_path.write_text(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'passed': sum(row['passed'] for row in results), 'total': len(results)}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
