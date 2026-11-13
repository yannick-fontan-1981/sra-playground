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
RELATED = ['.gitignore', 'migration/v6-transfer-map.json', 'docs/migration/lot3f-reference-population.md', 'docs/migration/lot3f-reference-population-lineage.md', 'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md', 'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json', 'src/logos-engine/v5-reference-population-calculus.ts', 'src/logos-engine/v6-reference-population-observation.ts', 'src/logos-engine/v6-reference-population-access.ts', 'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-native-runtime.ts', 'tests/helpers/v6-live-game-campaign.ts', 'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-radial-port-integration.test.ts', 'tests/v6-support-caller-integration.test.ts', 'scripts/audit-v6-entry-points.ts', 'scripts/export-v6-reference-population-reference.py', 'scripts/export-v6-reference-population-legacy-checkpoints.mjs', 'scripts/prove-observed-reference-population-contribution.mjs', 'tests/fixtures/v6-reference-population-reference.json.gz', 'tests/fixtures/v6-reference-population-legacy-checkpoints.json.gz', 'tests/v5-reference-population-calculus.test.ts', 'tests/v6-reference-population-observation.test.ts', 'tests/v6-reference-population-access.test.ts', 'tests/v6-reference-population-integration.test.ts']


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
        'schema': 'logos-engine.lot3f-reference-population.delivery-index.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'nativeVersion': '0.47.0', 'nativeSourceDigest': native['digest'],
        'baselineSourceCommit': 'a6edbb838670785733155262ae95f69892a236fc',
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'functionalQualification': 'ReferencePopulation own transfer and consumed V5 finite-cell matching/cardinal move verified. 6/6 observed branches, 51/76 complete declared entries, 37 compiled workflows; full inherited caller parity remains partial. Cold VOIS meets the first-three-level target in 78 actions / 42 prefixes; exact own original-source replay and acquired-knowledge contribution remain separately qualified. Prior CWSE/SK48/FOGW clocks unchanged. Cost acceptance remains a distinct receipt.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery files plus named related source and roadmap files. Ignored originals are retained byte-identically as indexed parts or deterministic gzip with reconstruction receipts. This index excludes itself and does not rerun or reinterpret tests, game evidence or cost. The published commit also contains the complete prior evidence history.'
    }
    with OUTPUT.open('x') as out:
        out.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows)}))


if __name__ == '__main__':
    main()
