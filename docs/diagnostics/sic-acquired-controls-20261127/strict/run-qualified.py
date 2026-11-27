"""Immutable local qualification; preserve the original replay budgets."""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, sys

root, code, target, out = Path(sys.argv[1]).resolve(), sys.argv[2], sys.argv[3], Path(sys.argv[4]).resolve()
git = lambda *args: subprocess.check_output(['git', *args], cwd=root, text=True).strip()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
assert not git('status', '--porcelain', '--untracked-files=no'), 'Tracked source must be clean'
assert not out.exists(), 'Never overwrite a qualification'
out.mkdir(parents=True)
files = subprocess.check_output(['git', 'ls-files', 'src', 'scripts', 'docs/architecture/sic-replay-reference-levels-20261126.json',
    'docs/architecture/sic-v8-level6-campaign-7bb9f152.json'], cwd=root, text=True).splitlines()
files = [name for name in files if (root / name).is_file()]
settings = {'SIC_REPLAY_REFERENCES': 'docs/architecture/sic-replay-reference-levels-20261126.json'}
command = ['node', 'scripts/check-sic-chronological.mjs', code, target, str(out / 'results.jsonl'), '1', 'sic']
manifest = {'startedAt': now(), 'sourceCommit': git('rev-parse', 'HEAD'), 'sourceTree': git('rev-parse', 'HEAD^{tree}'),
    'sourceHashes': {name: digest(root / name) for name in files}, 'games': code.split(','), 'startLevel': 1,
    'targetLevels': target, 'workers': 1, 'command': command, 'environment': settings, 'cwd': str(root),
    'externalDependencies': {'public/vendor': str((root / 'public/vendor').resolve())},
    'qualification': 'One chronological SIC session per game, original per-level reference ceilings, no instrumentation.'}
(out / 'run-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'startedAt': manifest['startedAt'], 'sourceCommit': manifest['sourceCommit'], 'output': str(out)}), flush=True)
with (out / 'runner.log').open('w') as log:
    result = subprocess.run(command, cwd=root, env={**os.environ, **settings}, stdout=log, stderr=subprocess.STDOUT)
end = {'observedEndAt': now(), 'exitCode': result.returncode, 'sourceCommit': git('rev-parse', 'HEAD'),
    'trackedClean': not git('status', '--porcelain', '--untracked-files=no'),
    'sourceHashes': {name: digest(root / name) for name in files},
    'resultsSha256': digest(out / 'results.jsonl') if (out / 'results.jsonl').exists() else None}
end['sourceUnchanged'] = end['sourceCommit'] == manifest['sourceCommit'] and end['trackedClean'] and end['sourceHashes'] == manifest['sourceHashes']
(out / 'run-end.json').write_text(json.dumps(end, indent=2) + '\n')
assert end['sourceUnchanged'], 'Frozen source changed'
assert result.returncode == 0, 'Harness process failed'
rows = [json.loads(line) for line in (out / 'results.jsonl').read_text().splitlines()]
print(json.dumps({'endedAt': end['observedEndAt'], 'sourceUnchanged': True, 'games': [
    {key: row.get(key) for key in ['code', 'levels', 'target', 'actions', 'reason', 'status']} for row in rows]}), flush=True)
