#!/usr/bin/env python3
"""Diagnostic replay through unchanged original V6; never synthesize an outcome.

Only commands exactly matching the next already witnessed public command receive
its recorded public packet. A mismatch ends the diagnostic without returning any
packet. This is not a live episode, a success claim, or a runtime oracle.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
import time

SITE = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = SITE / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
EXPORTER = Path(__file__).with_name('export-v6-caller-reference.py')
BOUNDARY = Path(__file__).with_name('v6-caller-host-boundary.py')


def packed(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def packet(raw):
    return {
        'frame': raw['frame_rows'], 'frames': raw['frame_packet'],
        'availableActionIds': [int(value.removeprefix('ACTION')) for value in raw['available_action_refs']],
        'state': raw['state'], 'level': raw['level'],
        'levelsCompleted': raw['levels_completed'], 'stepIndex': raw['step_index'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trace', required=True, type=Path)
    parser.add_argument('--work-root', required=True, type=Path)
    parser.add_argument('--output-prefix', required=True, type=Path)
    parser.add_argument('--timeout', type=float, default=360)
    options = parser.parse_args()
    raw = options.trace.read_bytes()
    trace = json.loads(gzip.decompress(raw) if options.trace.suffix == '.gz' else raw)
    assert trace['schema'] == 'logos-engine.native-public-game-trace.v1'
    packets = trace['packets']
    assert packets and packets[0]['command'] is None
    work = options.work_root.resolve()
    work.mkdir(parents=True, exist_ok=False)
    output_prefix = options.output_prefix.resolve()
    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text())
    config = {
        'sourceRoot': str(SOURCE), 'hostBoundary': str(BOUNDARY), 'sourceManifest': manifest,
        'runRoot': str(work), 'sessionId': 'public-replay', 'observation': packet(packets[0]['packet']),
        'budgets': {'targetLevels': 3, 'levelActionCaps': [160, 160, 160]},
        'stopAfterPrefixes': len(packets) + 1, 'oracle': str(work / 'oracle.json'),
    }
    config_path = work / 'public-config.json'
    config_path.write_text(packed(config) + '\n')
    environment = dict(os.environ, PYTHONHASHSEED='0', PYTHONDONTWRITEBYTECODE='1', PYTHONNOUSERSITE='1')
    environment.pop('PYTHONPATH', None)
    started = time.monotonic()
    matched = 0
    observations = []
    stop = None
    with (work / 'solver.stderr.log').open('w') as errors:
        process = subprocess.Popen(
            [sys.executable, '-u', str(EXPORTER), '--child', str(config_path)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
            text=True, bufsize=1, cwd=SITE, env=environment,
        )
        assert process.stdin is not None and process.stdout is not None
        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)
        try:
            while True:
                allowance = options.timeout - (time.monotonic() - started)
                if allowance <= 0:
                    stop = {'kind': 'diagnostic_timeout', 'returnedOutcome': False}
                    break
                if not selector.select(min(allowance, 30)):
                    print(packed({'phase': 'waiting_original_caller', 'matchedActions': matched}), flush=True)
                    continue
                line = process.stdout.readline()
                if not line:
                    stop = {'kind': 'child_closed', 'returnedOutcome': False}
                    break
                message = json.loads(line)
                observations.append(message)
                if message['kind'] != 'action':
                    stop = message
                    break
                if matched + 1 >= len(packets):
                    stop = {'kind': 'recorded_trace_exhausted', 'proposedCommand': message['command'], 'returnedOutcome': False}
                    break
                item = packets[matched + 1]
                expected = {'actionRef': item['command']['action_ref'], 'data': item['command'].get('data', {})}
                if message['command'] != expected:
                    stop = {'kind': 'command_diverged', 'proposedCommand': message['command'], 'recordedCommand': expected, 'returnedOutcome': False}
                    break
                process.stdin.write(packed({'observation': packet(item['packet']), 'executionMs': 0}) + '\n')
                process.stdin.flush()
                matched += 1
                print(packed({'phase': 'matched_public_command', 'matchedActions': matched, 'command': expected}), flush=True)
            if stop and stop['kind'] == 'stopped':
                process.stdin.close()
                process.wait(timeout=10)
        finally:
            selector.close()
            if process.poll() is None:
                process.kill()
                process.wait(timeout=10)
            process.stdout.close()
            if not process.stdin.closed:
                process.stdin.close()
    run = work / 'public-replay' / 'run'
    report = json.loads((run / 'report.json').read_text()) if (run / 'report.json').exists() else None
    proposals = []
    for path in sorted(run.glob('proposal-*.json'), key=lambda value: int(value.stem.split('-')[-1])):
        value = json.loads(path.read_text())
        proposals.append({
            'revision': int(path.stem.split('-')[-1]), 'kind': value.get('kind'),
            'supportPlan': value.get('support_plan'), 'actions': value.get('actions'),
            'question': value.get('question'), 'strategyReceipt': value.get('strategy_receipt'),
        })
    evidence = {}
    for name, path in [('oracle', work / 'oracle.json'), ('report', run / 'report.json')]:
        if not path.exists():
            continue
        original = path.read_bytes()
        compressed = gzip.compress(original, mtime=0)
        target = Path(str(output_prefix) + '-' + name + '.json.gz')
        target.write_bytes(compressed)
        evidence[target.name] = {'sha256': sha(compressed), 'uncompressedSha256': sha(original), 'bytes': len(compressed)}
    observed_modules = [
        'common_frontier_runtime.py', 'common_radial_ports.py', 'radial_ports_access.py',
        'radial_ports_observation.py', 'common_animated_contact.py', 'animated_contact.py',
    ]
    source_hashes = {}
    for name in observed_modules:
        relative = 'agents/yf_arc3_v6/laya_proto/' + name
        if relative in manifest['files']:
            source_hashes[relative] = manifest['files'][relative]['sha256']
    summary = {
        'schema': 'logos-engine.v6.original-public-caller-collision.v1', 'referenceCommit': COMMIT,
        'qualification': 'Development-only replay of already witnessed public packets through the unchanged full original caller. Outcomes were returned only for exactly matching proposed commands. This is neither a live success nor a solver feeding the native production agent. Trace instrumentation timing is not a performance comparison.',
        'sourceVerification': {
            'sourceManifestSha256': sha(MANIFEST.read_bytes()), 'verifiedOriginalFiles': len(manifest['files']),
            'beforeOriginalMain': bool(matched), 'afterOriginalMain': process.returncode == 0,
            'method': 'Existing v6-caller-host-boundary.verify_source_manifest called before and after unchanged original main; after flag requires child success.',
            'sourceHashes': source_hashes,
        },
        'generator': {'path': str(Path(__file__).relative_to(SITE)), 'sha256': sha(Path(__file__).read_bytes())},
        'input': {'path': str(options.trace), 'sha256': sha(raw), 'publicPackets': len(packets), 'nativeSourceDigest': trace['sourceDigest']},
        'matchedActions': matched, 'childExitCode': process.returncode, 'stop': stop,
        'original': None if report is None else {
            'status': report['status'], 'reason': report['reason'], 'actions': report['actions'],
            'levelActions': report['level_actions'], 'final': report['final'], 'elapsedSeconds': report['elapsed_s'],
        },
        'proposals': proposals, 'evidence': evidence, 'wallSeconds': time.monotonic() - started,
    }
    Path(str(output_prefix) + '-collision.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
    (work / 'messages.json').write_text(packed(observations) + '\n')
    print(packed({key: summary[key] for key in ('matchedActions', 'childExitCode', 'stop', 'original')}), flush=True)


if __name__ == '__main__':
    main()
