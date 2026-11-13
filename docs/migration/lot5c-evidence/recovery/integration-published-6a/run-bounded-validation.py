#!/usr/bin/env python3
"""Execute the predeclared clock integration checks under the caller-held lock."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import subprocess

ROOT = next(p for p in Path(__file__).resolve().parents if (p / '.openai/hosting.json').exists())
OUT = Path(__file__).resolve().parent
REL = OUT.relative_to(ROOT).as_posix()
WRAPPER = 'docs/migration/lot5c-evidence/run-evidence-command.py'
plan = json.loads((OUT / 'bounded-validation-plan.json').read_text())
commands = [
    ('source-freeze', 60, ['python', 'scripts/freeze-v53-native-source.py', 'freeze', f'{REL}/source-after-clock'], {}),
    ('native-runtime-tests', 120, ['node', '--max-old-space-size=768', '--test', '--test-reporter=tap',
        '--test-concurrency=1', 'tests/v6-native-runtime.test.ts'], {}),
    ('window-kernel-tests', 120, ['node', '--max-old-space-size=768', '--test', '--test-reporter=tap',
        '--test-concurrency=1', 'tests/v6-window-question-kernel.test.ts'], {}),
    ('binding-acquisition-bounds', 180, ['node', '--max-old-space-size=768', '--test', '--test-reporter=tap',
        '--test-concurrency=1', f'--test-name-pattern={plan["tests"][2]["namePattern"]}',
        'tests/v6-object-binding-common.test.ts'],
        {'LOGOS_LOT5C_COMMON_EVIDENCE_DIR': str(OUT / 'binding-acquisition-bounds')}),
    ('typecheck', 180, ['node', 'node_modules/typescript/bin/tsc', '--noEmit'], {}),
    ('entry-audit', 180, ['node', 'scripts/audit-v6-entry-points.ts'], {}),
    ('migration-audit', 180, ['python', 'scripts/audit-v6-migration.py'], {}),
]
results = []
for name, timeout, command, extra_env in commands:
    for lane in ['lot7-followup-status.json', 'lot10b-status.json']:
        status = json.loads((Path('/workspace/shared/sra-coordination') / lane).read_text())
        if status.get('quiet_requested') or status.get('performance_started'):
            print(json.dumps({'status': 'deferred_for_peer_quiet', 'next': name, 'lane': lane}), flush=True)
            raise SystemExit(75)
    print(json.dumps({'starting': name, 'recordedAt': datetime.now(timezone.utc).isoformat()}), flush=True)
    argv = ['python', WRAPPER, '--stem', f'{REL}/{name}', '--timeout', str(timeout), '--', *command]
    code = subprocess.run(argv, cwd=ROOT, env={**os.environ, **extra_env}).returncode
    results.append({'name': name, 'exitCode': code})
    if code:
        print(json.dumps({'status': 'failed', 'results': results}), flush=True)
        raise SystemExit(code)
print(json.dumps({'status': 'passed', 'results': results}), flush=True)
