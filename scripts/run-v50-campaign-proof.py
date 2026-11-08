#!/usr/bin/env python3
"""Run one cold native campaign and retain its exact execution provenance."""
from __future__ import annotations
import argparse
import datetime
import gzip
import hashlib
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def native_source():
    files = {p.relative_to(ROOT).as_posix(): sha(p)
             for folder in ['src/logos-engine', 'src/runtime']
             for p in sorted((ROOT / folder).rglob('*'))
             if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    ordered = dict(sorted(files.items()))
    digest = hashlib.sha256(json.dumps(ordered, separators=(',', ':')).encode()).hexdigest()
    return {'fileCount': len(ordered), 'digest': digest, 'files': ordered}

def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game'); parser.add_argument('levels', type=int)
    parser.add_argument('report'); parser.add_argument('trace')
    parser.add_argument('receipt'); parser.add_argument('log')
    args = parser.parse_args()
    report, trace, receipt, log = [ROOT / p for p in [args.report, args.trace, args.receipt, args.log]]
    for path in [report, trace, receipt, log]:
        if path.exists(): raise FileExistsError(path)
        path.parent.mkdir(parents=True, exist_ok=True)
    before = native_source()
    declared = ROOT / 'docs/migration/native-campaigns-v50/source-manifest.json'
    if not declared.is_file() or before != json.loads(declared.read_text()):
        raise ValueError('Current native source differs from the declared v50 freeze')
    command = ['node', 'scripts/run-v44-campaign.mjs', args.game, str(args.levels), str(report), str(trace)]
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(); clock = time.monotonic()
    live_log = ROOT.parent / f'v50-{args.game.lower()}-live.log'
    with live_log.open('wb') as stream:
        completed = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    finished = datetime.datetime.now(datetime.timezone.utc).isoformat()
    log.write_bytes(gzip.compress(live_log.read_bytes()))
    after = native_source(); unchanged = before == after
    result = json.loads(report.read_text()) if report.exists() else None
    value = {'schema': 'logos-engine.v50.actual-campaign-execution.v1', 'command': command,
             'exitCode': completed.returncode, 'startedAt': started, 'finishedAt': finished,
             'elapsedSeconds': time.monotonic() - clock,
             'nativeSource': before, 'nativeSourceManifestDigest': before['digest'],
             'nativeSourceAfter': after, 'nativeSourceUnchanged': unchanged,
             'generator': evidence(pathlib.Path(__file__)), 'output': evidence(log)}
    if report.exists(): value['report'] = evidence(report)
    if trace.exists(): value['trace'] = evidence(trace)
    receipt.write_text(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'exitCode': completed.returncode, 'sourceUnchanged': unchanged,
                      'status': result['status'] if result else None,
                      'final': result['final'] if result else None,
                      'receipt': str(receipt.relative_to(ROOT))}))
    if completed.returncode or not unchanged: raise SystemExit(completed.returncode or 1)

if __name__ == '__main__': main()
