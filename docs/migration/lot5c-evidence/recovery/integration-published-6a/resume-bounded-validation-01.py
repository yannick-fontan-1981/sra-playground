#!/usr/bin/env python3
"""Resume only the uncompleted checks after the preserved directory-guard failure."""
from pathlib import Path
import json
import os
import subprocess

ROOT = next(p for p in Path(__file__).resolve().parents if (p / '.openai/hosting.json').exists())
OUT = Path(__file__).resolve().parent
REL = OUT.relative_to(ROOT).as_posix()
amendment = json.loads((OUT / 'bounded-validation-amendment-01.json').read_text())
commands = [
    ('binding-acquisition-bounds-retry-01', ['node', '--max-old-space-size=768', '--test', '--test-reporter=tap',
        '--test-concurrency=1', f'--test-name-pattern={amendment["sameNamePattern"]}',
        'tests/v6-object-binding-common.test.ts'],
        {'LOGOS_LOT5C_COMMON_EVIDENCE_DIR': str(ROOT / amendment['correctedEvidenceDirectory'])}),
    ('typecheck', ['node', 'node_modules/typescript/bin/tsc', '--noEmit'], {}),
    ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts'], {}),
    ('migration-audit', ['python', 'scripts/audit-v6-migration.py'], {}),
]
results = []
for name, command, extra_env in commands:
    for lane in ['lot7-followup-status.json', 'lot10b-status.json']:
        status = json.loads((Path('/workspace/shared/sra-coordination') / lane).read_text())
        if status.get('quiet_requested') or status.get('performance_started'):
            print(json.dumps({'status': 'deferred_for_peer_quiet', 'next': name, 'lane': lane}), flush=True)
            raise SystemExit(75)
    print(json.dumps({'starting': name}), flush=True)
    code = subprocess.run(['python', 'docs/migration/lot5c-evidence/run-evidence-command.py',
        '--stem', f'{REL}/{name}', '--timeout', '180', '--', *command],
        cwd=ROOT, env={**os.environ, **extra_env}).returncode
    results.append({'name': name, 'exitCode': code})
    if code:
        print(json.dumps({'status': 'failed', 'results': results}), flush=True)
        raise SystemExit(code)
print(json.dumps({'status': 'passed', 'results': results}), flush=True)
