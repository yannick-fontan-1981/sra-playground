#!/usr/bin/env python3
"""Run a declared relative-arrangement case phase within the one cumulative case deadline."""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('selection', type=Path)
    parser.add_argument('phase')
    args = parser.parse_args()
    selection_path = (ROOT / args.selection).resolve()
    selection = json.loads(selection_path.read_text())
    phase = selection['phases'][args.phase]
    remaining = (datetime.fromisoformat(selection['deadline']) - datetime.now(timezone.utc)).total_seconds()
    assert remaining > 0, 'The retained case deadline is exhausted'
    checkout = Path(phase['checkout'])
    relative = Path(phase['directory'])
    out = checkout / relative
    out.mkdir(parents=True, exist_ok=True)
    with (out / 'source-manifest.json').open('xb') as stream:
        stream.write((ROOT / phase['manifest']).read_bytes())
    bounded = phase.get('actionCap')
    command = [sys.executable, '-B', 'scripts/run-bounded-native-campaign-proof.py' if bounded else 'scripts/run-v53-campaign-proof.py',
        selection['game'], str(selection['targetLevels']), *([str(bounded)] if bounded else []), str(relative)]
    log = BASE / f"{selection['game'].lower()}-{args.phase}-phase.log"
    started = datetime.now(timezone.utc)
    clock = time.monotonic()
    timed_out = False
    with log.open('xb') as stream:
        process = subprocess.Popen(command, cwd=checkout, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = process.wait(timeout=remaining)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try: code = process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                code = process.wait()
    if checkout != ROOT: shutil.copytree(out, ROOT / relative)
    finished = datetime.now(timezone.utc)
    def record(path):
        return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    receipt = {'schema': 'logos-engine.relative-arrangement-case-phase.v1', 'game': selection['game'], 'phase': args.phase,
        'selection': record(selection_path), 'generator': record(Path(__file__)), 'checkout': str(checkout), 'command': command,
        'startedAt': started.isoformat(), 'finishedAt': finished.isoformat(), 'elapsedSeconds': time.monotonic() - clock,
        'exitCode': code, 'caseDeadlineReached': timed_out,
        'cumulativeCaseSecondsAtEnd': selection['previousChargedSeconds'] + (finished - datetime.fromisoformat(selection['selectedAt'])).total_seconds(),
        'output': record(log), 'artifacts': [record(p) for p in sorted((ROOT / relative).rglob('*')) if p.is_file()],
        'qualification': 'A single cumulative wall-clock deadline covers every attempt and debugging interval for this selected case. The ordinary common agent receives only public game packets. An action-capped baseline is not a complete-game impossibility verdict.'}
    with (BASE / f"{selection['game'].lower()}-{args.phase}-phase.json").open('x') as stream:
        stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({key: receipt[key] for key in ['game', 'phase', 'exitCode', 'caseDeadlineReached', 'cumulativeCaseSecondsAtEnd']}), flush=True)
    return 124 if timed_out else code

if __name__ == '__main__': sys.exit(main())
