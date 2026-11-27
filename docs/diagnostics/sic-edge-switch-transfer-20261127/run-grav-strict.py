"""One strict chronological run on a verified frozen source; budgets unchanged."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import subprocess
import sys

root, expected, canonical, out = Path(sys.argv[1]).resolve(), sys.argv[2], sys.argv[3], Path(sys.argv[4]).resolve()
git = lambda *args: subprocess.check_output(['git', *args], cwd=root, text=True).strip()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
files = ['src/sic/settle-matching-edges.ts', 'src/sic/navigation-primitives.ts',
         'src/sic/standalone-families.ts', 'src/sic/experiment-selection-groups.ts',
         'src/logos-engine/v6-native-runtime.ts', 'src/runtime/v6-agent-service.ts',
         'scripts/check-sic-chronological.mjs', 'scripts/sic-replay-budgets.mjs', 'scripts/sic-replay-watchdog.mjs',
         'tests/sic-edge-switch-transfer.test.ts',
         'docs/architecture/sic-replay-reference-levels-20261126.json',
         'docs/architecture/sic-v8-level6-campaign-7bb9f152.json']
assert git('rev-parse', 'HEAD') == expected and not git('status', '--porcelain')
assert not out.exists(), 'Every qualification has a separate immutable output directory'
out.mkdir()
settings = {'SIC_REPLAY_REFERENCES': 'docs/architecture/sic-replay-reference-levels-20261126.json'}
command = ['node', 'scripts/check-sic-chronological.mjs', 'GRAV', '6', str(out / 'results.jsonl'), '1', 'sic']
manifest = {'startedAt': now(), 'sourceCommit': expected, 'canonicalCommit': canonical, 'sourceTree': git('rev-parse', 'HEAD^{tree}'),
            'sourceHashes': {name: digest(root / name) for name in files}, 'game': 'GRAV', 'startLevel': 1,
            'targetLevels': 6, 'workers': 1, 'command': command, 'environment': settings, 'cwd': str(root),
            'qualification': 'One SIC session from level1, original per-level reference ceilings, no instrumentation.'}
(out / 'run-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'startedAt': manifest['startedAt'], 'sourceCommit': expected, 'output': str(out)}), flush=True)
with (out / 'runner.log').open('w') as log:
    result = subprocess.run(command, cwd=root, env={**os.environ, **settings}, stdout=log, stderr=subprocess.STDOUT)
end = {'observedEndAt': now(), 'exitCode': result.returncode, 'sourceCommit': git('rev-parse', 'HEAD'),
       'clean': not git('status', '--porcelain'), 'sourceHashes': {name: digest(root / name) for name in files},
       'resultsSha256': digest(out / 'results.jsonl') if (out / 'results.jsonl').exists() else None}
end['sourceUnchanged'] = end['sourceCommit'] == expected and end['clean'] and end['sourceHashes'] == manifest['sourceHashes']
(out / 'run-end.json').write_text(json.dumps(end, indent=2) + '\n')
assert end['sourceUnchanged'], 'Frozen source changed during qualification'
assert result.returncode == 0, 'Harness failed'
verdict = json.loads((out / 'results.jsonl').read_text())
print(json.dumps({'endedAt': end['observedEndAt'], 'levels': verdict.get('levels'),
                  'actions': verdict.get('actions'), 'reason': verdict.get('reason'),
                  'resultsSha256': end['resultsSha256'], 'sourceUnchanged': True}), flush=True)
