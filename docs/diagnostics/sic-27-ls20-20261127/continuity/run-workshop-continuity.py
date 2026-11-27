"""Collect passive LS20 evidence with the standard, immutable study runner."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import subprocess
import sys

root, source, remote, tree, destination = sys.argv[1:]
root, out = Path(root), Path(destination)
git = lambda *args: subprocess.check_output(['git', *args], cwd=root, text=True).strip()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
assert git('rev-parse', 'HEAD') == source and git('rev-parse', 'HEAD^{tree}') == tree
assert not git('status', '--porcelain')
assert not out.exists(), 'Do not overwrite an earlier collector'
out.mkdir()
files = ['src/sic/framed-contact.ts', 'src/logos-engine/v6-native-runtime.ts',
         'src/runtime/v6-agent-service.ts', 'scripts/compare-source100.mjs',
         'scripts/sic-continuity-evidence.mjs', 'scripts/sic-continuity-contract.mjs',
         'scripts/sic-workshop-phase-continuity.mjs',
         'scripts/sic-workshop-phase-continuity-contract.mjs']
settings = {'SIC_STUDY_CONTINUITY': '1', 'SIC_STUDY_WORKERS': '1', 'SIC_STUDY_SOLVER': 'sic',
            'SIC_STUDY_RECORD_COMMANDS': '1', 'SIC_STUDY_PROGRESS': '1'}
command = ['node', 'scripts/compare-source100.mjs', '.', '.', str(out / 'results.jsonl'), 'source:LS20', '1', '7', '129']
quota = Path('/sys/fs/cgroup/cpu.max')
manifest = {'schema': 'sic.observed-workshop-phase.collector.v1', 'startedAt': now(),
            'sourceCommit': source, 'remoteCommit': remote, 'sourceTree': tree,
            'sourceHashes': {name: digest(root / name) for name in files},
            'workers': 1, 'startLevel': 1, 'targetLevels': 7, 'game': 'LS20', 'cap': 129,
            'strictActionCeilings': [20, 54, 50, 52, 58, 113, 129],
            'strictTimeCeilingsMs': [12000, 20000, 26000, 23000, 27000, 50000, 67000],
            'purpose': 'Actual native tickets, public pixels and acquired receipts. Strict per-level timing qualification is archived separately.',
            'command': command, 'environment': settings, 'cwd': str(root),
            'cpuMax': quota.read_text().strip() if quota.exists() else None}
(out / 'run-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'startedAt': manifest['startedAt'], 'sourceCommit': source, 'output': str(out)}), flush=True)
with (out / 'runner.log').open('w') as stream:
    result = subprocess.run(command, cwd=root, env={**os.environ, **settings}, stdout=stream, stderr=subprocess.STDOUT)
end = {'observedEndAt': now(), 'exitCode': result.returncode, 'sourceCommit': git('rev-parse', 'HEAD'),
       'clean': not git('status', '--porcelain'), 'sourceHashes': {name: digest(root / name) for name in files},
       'resultsSha256': digest(out / 'results.jsonl') if (out / 'results.jsonl').exists() else None}
end['sourceUnchanged'] = end['sourceCommit'] == source and end['sourceHashes'] == manifest['sourceHashes'] and end['clean']
(out / 'run-end.json').write_text(json.dumps(end, indent=2) + '\n')
print(json.dumps(end), flush=True)
assert end['sourceUnchanged'], 'Collector source changed during execution'
sys.exit(result.returncode)
