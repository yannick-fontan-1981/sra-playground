#!/usr/bin/env python3
"""Hold the shared advisory lock, then run the unchanged official cost runner.

The explicit stdin trigger is sent only after completed readiness and the
pre-measurement evidence commit. This wrapper changes no measurement settings.
"""
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[4]
PERF = Path(__file__).resolve().parent
BASELINE = Path('/workspace/sites/sra-lot7b-baseline-20261110')
LOCK = Path('/workspace/shared/sra-coordination/performance.lock')


def now():
    return datetime.now(timezone.utc).isoformat()


def fp(path):
    raw = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


assert os.environ.get('NODE_OPTIONS') is None
assert not (PERF / 'window.json').exists()
with LOCK.open('a+') as held:
    fcntl.flock(held.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    acquired = {'schema': 'logos-engine.advisory-performance-lock.v1',
                'status': 'acquired_before_readiness', 'acquiredAt': now(),
                'pid': os.getpid(), 'lock': str(LOCK),
                'launcher': fp(Path(__file__)), 'nodeOptionsOverride': None,
                'qualification': 'Actual exclusive nonblocking flock. Retained through the unchanged official runner. Cooperative lane and own-work evidence remain separate.'}
    with (PERF / 'performance-lock-acquired.json').open('x') as stream:
        json.dump(acquired, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'phase': 'lock_acquired_waiting_for_ready_commit',
                      'pid': os.getpid(), 'acquiredAt': acquired['acquiredAt']}), flush=True)
    assert sys.stdin.readline().strip() == 'RUN_OFFICIAL_7B_ABBA'
    readiness = json.loads((PERF / 'readiness.json').read_bytes())
    assert readiness['status'] == 'ready' and readiness['measurementAuthorized'] is True
    assert readiness['pendingRequirements'] == []
    assert not subprocess.check_output(['git', 'status', '--porcelain=v1'], cwd=ROOT).strip()
    assert not (PERF / 'window.json').exists()
    command = [sys.executable, '-B', 'scripts/run-native-cost-window.py', str(BASELINE),
               PERF.relative_to(ROOT).as_posix(),
               'docs/migration/lot7b-evidence/baseline-integrated/source-manifest.json',
               'docs/migration/lot7b-evidence/integrated-final/source-manifest.json']
    started = now()
    result = subprocess.run(command, cwd=ROOT)
    finished = now()
    completion = {'schema': 'logos-engine.advisory-performance-lock-completion.v1',
                  'startedAt': started, 'finishedAt': finished, 'pid': os.getpid(),
                  'lock': str(LOCK), 'exitCode': result.returncode, 'command': command,
                  'acquisition': fp(PERF / 'performance-lock-acquired.json'),
                  'readiness': fp(PERF / 'readiness.json'),
                  'qualification': 'The exclusive advisory lock remained held for the entire child runner. It is released when this wrapper exits.'}
    with (PERF / 'performance-lock-completion.json').open('x') as stream:
        json.dump(completion, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'phase': 'official_window_finished_releasing_lock',
                      'exitCode': result.returncode, 'finishedAt': finished}), flush=True)
    sys.exit(result.returncode)
