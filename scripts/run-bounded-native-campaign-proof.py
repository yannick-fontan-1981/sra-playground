#!/usr/bin/env python3
"""Retain one bounded cold reference and immutable, losslessly compressed evidence.

The ordinary production harness owns every decision and dispatch. This outer
process fingerprints execution inputs and archives its passive public journal.
It does not import a Python agent or inspect the game implementation.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def evidence(path):
    path = Path(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def native_source():
    files = {p.relative_to(ROOT).as_posix(): sha(p)
             for folder in ['src/logos-engine', 'src/runtime']
             for p in sorted((ROOT / folder).rglob('*'))
             if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    ordered = dict(sorted(files.items()))
    digest = hashlib.sha256(json.dumps(ordered, separators=(',', ':')).encode()).hexdigest()
    return {'fileCount': len(ordered), 'digest': digest, 'files': ordered}


def archive(source, destination):
    with Path(source).open('rb') as incoming, Path(destination).open('xb') as outgoing:
        with gzip.GzipFile(filename='', mode='wb', fileobj=outgoing, mtime=0) as compressed:
            for chunk in iter(lambda: incoming.read(1024 * 1024), b''):
                compressed.write(chunk)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game')
    parser.add_argument('levels', type=int)
    parser.add_argument('maximum_actions', type=int)
    parser.add_argument('directory')
    args = parser.parse_args()
    out = ROOT / args.directory
    before = native_source()
    manifest_path = out / 'source-manifest.json'
    if before != json.loads(manifest_path.read_text()):
        raise ValueError('Current native source differs from the declared freeze')
    stem = args.game.lower()
    report = out / f'{stem}-campaign.json.gz'
    trace = out / f'{stem}-public-trace.json.gz'
    receipt = out / f'execution-{stem}.json'
    output = out / f'{stem}-output.log.gz'
    journal_archive = out / f'{stem}-actual-public-journal.jsonl.gz'
    live_stem = f'v53-{out.name}-{stem}'
    journal = ROOT.parent / f'{live_stem}-actual-public-journal.jsonl'
    live_log = ROOT.parent / f'{live_stem}-live.log'
    for path in [report, trace, receipt, output, journal_archive, journal, live_log]:
        if path.exists():
            raise FileExistsError(path)
        path.parent.mkdir(parents=True, exist_ok=True)
    runner = ROOT / 'scripts/run-bounded-native-campaign.mjs'
    harness = ROOT / 'tests/helpers/v6-live-game-campaign.ts'
    inputs_before = {'runner': evidence(runner), 'harness': evidence(harness), 'generator': evidence(Path(__file__))}
    command = ['node', str(runner), args.game, str(args.levels), str(args.maximum_actions), str(report), str(trace), str(journal)]
    started = datetime.now(timezone.utc).isoformat()
    clock = time.monotonic()
    with live_log.open('xb') as stream:
        completed = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    archive(live_log, output)
    if journal.exists():
        archive(journal, journal_archive)
    after = native_source()
    inputs_after = {'runner': evidence(runner), 'harness': evidence(harness), 'generator': evidence(Path(__file__))}
    unchanged = before == after and inputs_before == inputs_after
    result = json.loads(gzip.decompress(report.read_bytes())) if report.exists() else None
    value = {
        'schema': 'logos-engine.v53.actual-journaled-campaign-execution.v1',
        'command': command, 'exitCode': completed.returncode, 'maximumAcquiredActions': args.maximum_actions, 'startedAt': started,
        'finishedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - clock,
        'nativeSource': before, 'nativeSourceManifestDigest': before['digest'],
        'nativeSourceAfter': after, 'nativeSourceUnchanged': before == after,
        'executionInputs': inputs_before, 'executionInputsAfter': inputs_after,
        'executionCodeUnchanged': unchanged, 'output': evidence(output),
        'qualification': 'One bounded cold native common reference with the opaque public game host; an outer action cap is not a complete-game verdict. '
                         'A passive observer journals the actual commands and all returned public packets. '
                         'No expected action, learned state, route, Python agent or level jump is supplied.',
    }
    for key, path in [('report', report), ('trace', trace), ('publicJournal', journal_archive)]:
        if path.exists():
            value[key] = evidence(path)
    with receipt.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'exitCode': completed.returncode, 'sourceUnchanged': unchanged,
                      'status': result['status'] if result else None, 'outerReferenceLimit': result.get('outerReferenceLimit') if result else None,
                      'final': result['final'] if result else None,
                      'receipt': receipt.relative_to(ROOT).as_posix()}), flush=True)
    if completed.returncode or not unchanged:
        raise SystemExit(completed.returncode or 1)


if __name__ == '__main__':
    main()
