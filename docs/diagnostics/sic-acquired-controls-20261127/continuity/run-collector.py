"""Collect passive evidence on a frozen source; qualification uses a separate strict replay."""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, sys

root, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
games = sys.argv[3:]
git = lambda *args: subprocess.check_output(['git', *args], cwd=root, text=True).strip()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
assert not git('status', '--porcelain', '--untracked-files=no'), 'Tracked source must be clean'
assert not out.exists(), 'Never overwrite collected evidence'
out.mkdir(parents=True)
files = subprocess.check_output(['git', 'ls-files', 'src', 'scripts'], cwd=root, text=True).splitlines()
files = [name for name in files if (root / name).is_file()]
settings = {'SIC_STUDY_CONTINUITY': '1', 'SIC_STUDY_WORKERS': '1', 'SIC_STUDY_SOLVER': 'sic'}
cohorts = {'GRAV': (6, 57), 'DC22': (6, 271)}
commands = [['node', 'scripts/compare-source100.mjs', '.', '.', str(out / (game.lower() + '.jsonl')),
             'source:' + game, '1', str(cohorts[game][0]), str(cohorts[game][1])] for game in games]
manifest = {'startedAt': now(), 'sourceCommit': git('rev-parse', 'HEAD'), 'sourceTree': git('rev-parse', 'HEAD^{tree}'),
    'sourceHashes': {name: digest(root / name) for name in files}, 'games': games, 'startLevel': 1,
    'workers': 1, 'commands': commands, 'environment': settings, 'cwd': str(root),
    'purpose': 'Passive native ticket and public physical-return evidence, no active-time claim.'}
(out / 'run-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'startedAt': manifest['startedAt'], 'sourceCommit': manifest['sourceCommit'], 'output': str(out)}), flush=True)
statuses = []
for game, command in zip(games, commands):
    with (out / (game.lower() + '.log')).open('w') as log:
        result = subprocess.run(command, cwd=root, env={**os.environ, **settings}, stdout=log, stderr=subprocess.STDOUT)
    statuses.append({'game': game, 'exitCode': result.returncode})
    print(json.dumps(statuses[-1]), flush=True)
    if result.returncode != 0:
        break
end = {'observedEndAt': now(), 'statuses': statuses, 'sourceCommit': git('rev-parse', 'HEAD'),
    'trackedClean': not git('status', '--porcelain', '--untracked-files=no'),
    'sourceHashes': {name: digest(root / name) for name in files},
    'files': {path.name: digest(path) for path in out.glob('*.jsonl')}}
end['sourceUnchanged'] = end['sourceCommit'] == manifest['sourceCommit'] and end['trackedClean'] and end['sourceHashes'] == manifest['sourceHashes']
(out / 'run-end.json').write_text(json.dumps(end, indent=2) + '\n')
assert end['sourceUnchanged'], 'Frozen source changed'
assert len(statuses) == len(games) and all(row['exitCode'] == 0 for row in statuses), 'Collector process failed'
print(json.dumps({'endedAt': end['observedEndAt'], 'sourceUnchanged': True}), flush=True)
