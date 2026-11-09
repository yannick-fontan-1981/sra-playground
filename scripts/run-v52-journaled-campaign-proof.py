#!/usr/bin/env python3
"""Retain one ordinary cold native campaign and its actual streamed public journal."""
from __future__ import annotations
import argparse
import datetime
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('old_proof', ROOT / 'scripts/run-v52-campaign-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game'); parser.add_argument('levels', type=int)
    parser.add_argument('directory')
    args = parser.parse_args()
    out = ROOT / args.directory
    manifest_path = out / 'source-manifest.json'
    before = proof.native_source()
    if before != json.loads(manifest_path.read_text()):
        raise ValueError('Current native source differs from the declared freeze')
    stem = args.game.lower()
    report, trace = out / f'{stem}-three-levels.json', out / f'{stem}-public-trace.json.gz'
    receipt, output = out / f'execution-{stem}.json', out / f'{stem}-output.log.gz'
    journal_archive = out / f'{stem}-actual-public-journal.jsonl.gz'
    live_stem = f'v52-{out.name}-{stem}'
    journal, live_log = ROOT.parent / f'{live_stem}-actual-public-journal.jsonl', ROOT.parent / f'{live_stem}-live.log'
    for path in [report, trace, receipt, output, journal_archive, journal, live_log]:
        if path.exists(): raise FileExistsError(path)
        path.parent.mkdir(parents=True, exist_ok=True)
    runner = ROOT / 'scripts/run-v52-journaled-campaign.mjs'
    harness = ROOT / 'tests/helpers/v6-live-game-campaign.ts'
    runner_before, harness_before = proof.evidence(runner), proof.evidence(harness)
    command = ['node', str(runner), args.game, str(args.levels), str(report), str(trace), str(journal)]
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(); clock = time.monotonic()
    with live_log.open('wb') as stream:
        completed = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    output.write_bytes(gzip.compress(live_log.read_bytes()))
    if journal.exists(): journal_archive.write_bytes(gzip.compress(journal.read_bytes()))
    after = proof.native_source()
    runner_after, harness_after = proof.evidence(runner), proof.evidence(harness)
    unchanged = before == after and runner_before == runner_after and harness_before == harness_after
    result = json.loads(report.read_text()) if report.exists() else None
    value = {
        'schema': 'logos-engine.v52.actual-journaled-campaign-execution.v1', 'command': command,
        'exitCode': completed.returncode, 'startedAt': started,
        'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'elapsedSeconds': time.monotonic() - clock,
        'nativeSource': before, 'nativeSourceManifestDigest': before['digest'],
        'nativeSourceAfter': after, 'nativeSourceUnchanged': before == after,
        'runner': runner_before, 'runnerAfter': runner_after, 'harness': harness_before, 'harnessAfter': harness_after,
        'executionCodeUnchanged': unchanged,
        'generator': proof.evidence(Path(__file__)), 'output': proof.evidence(output),
        'qualification': 'The same unmodified cold native campaign helper and opaque host run as before. A passive observer flushes every actual public packet and command to a journal; it supplies no proposal, state, action or decision to the agent.',
    }
    for key, path in [('report', report), ('trace', trace), ('publicJournal', journal_archive)]:
        if path.exists(): value[key] = proof.evidence(path)
    receipt.write_text(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'exitCode': completed.returncode, 'sourceUnchanged': unchanged,
                     'status': result['status'] if result else None,
                     'final': result['final'] if result else None,
                     'receipt': str(receipt.relative_to(ROOT))}), flush=True)
    if completed.returncode or not unchanged: raise SystemExit(completed.returncode or 1)


if __name__ == '__main__':
    main()
