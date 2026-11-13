#!/usr/bin/env python3
"""Index this delivery and verify exact retained files, without running an agent."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
OUTPUT = BASE / 'evidence-index.json'
RELATED = ['.gitignore', 'migration/v6-transfer-map.json', 'docs/migration/lot3d-rooted-line.md', 'docs/migration/lot3d-rooted-line-lineage.md', 'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md', 'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json', 'src/logos-engine/v5-piercing-contracts.ts', 'src/logos-engine/v5-piercing-plan.ts', 'src/logos-engine/v6-rooted-line-observation.ts', 'src/logos-engine/v6-rooted-line-mechanics.ts', 'src/logos-engine/v6-rooted-line-access.ts', 'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-native-runtime.ts', 'tests/v5-piercing-native.test.ts', 'tests/v6-rooted-line-observation.test.ts', 'tests/v6-rooted-line-access.test.ts', 'tests/v6-rooted-line-integration.test.ts', 'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-support-caller-integration.test.ts', 'tests/helpers/v6-live-game-campaign.ts', 'scripts/export-v5-piercing-reference.py', 'scripts/export-v6-rooted-line-reference.py', 'scripts/export-v6-rooted-line-legacy-checkpoints.mjs', 'scripts/prove-observed-rooted-line-contribution.mjs', 'tests/fixtures/v5-piercing-reference.json.gz', 'tests/fixtures/v6-rooted-line-reference.json.gz', 'tests/fixtures/v6-rooted-line-legacy-checkpoints.json.gz']


def records():
    paths = {p for p in BASE.rglob('*') if p.is_file() and p != OUTPUT}
    paths.update(ROOT / name for name in RELATED)
    names = sorted(p.relative_to(ROOT).as_posix() for p in paths)
    proc = subprocess.run(['git', 'check-ignore', '-z', '--stdin'], cwd=ROOT,
                          input=('\0'.join(names) + '\0').encode(), capture_output=True)
    if proc.returncode not in (0, 1):
        raise RuntimeError(proc.stderr.decode())
    ignored = set(proc.stdout.decode().split('\0'))
    result = []
    for name in names:
        if name in ignored:
            continue
        path = ROOT / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Expected regular retained file: ' + name)
        data = path.read_bytes()
        result.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return result


def main():
    rows = records()
    if sys.argv[1:] == ['--verify']:
        value = json.loads(OUTPUT.read_text())
        if value['files'] != rows or value['fileCount'] != len(rows):
            raise ValueError('Evidence index differs from current retained membership or bytes')
        print(json.dumps({'status': 'verified', 'fileCount': len(rows),
                          'indexSha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}))
        return
    if sys.argv[1:]:
        raise ValueError('Usage: build-evidence-index.py [--verify]')
    native = json.loads((BASE / 'final/source-manifest.json').read_text())
    cost = json.loads((BASE / 'performance/global-budget-decision.json').read_text())
    value = {
        'schema': 'logos-engine.lot3d-rooted-line.delivery-index.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'nativeVersion': '0.45.0', 'nativeSourceDigest': native['digest'],
        'baselineSourceCommit': 'a39997bffdca1ce080879d967d3f5eb95a88d544',
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'functionalQualification': 'RootedLine own transfer and consumed non-staged V5 kernel verified;4/6observed branches,50/76complete entries. Cold SK48 target3unmet:12actions/0levels/5prefixes; original and native agree through the acquired refutation and blocking refusal. No game-specific repair. SK48 cumulative clock667.35444seconds retained; CWSE2399.683865seconds unchanged, no new attempt. Functional qualification stays distinct from cost acceptance.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery files plus named related source and roadmap files. Ignored originals are retained byte-identically as indexed parts with reconstruction manifests. This index excludes itself and does not rerun or reinterpret tests, game evidence or cost. The published commit also contains the complete prior evidence history.'
    }
    with OUTPUT.open('x') as out:
        out.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows)}))


if __name__ == '__main__':
    main()
