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
RELATED = ['.gitignore', 'migration/v6-transfer-map.json', 'docs/migration/lot3e-reception-service.md', 'docs/migration/lot3e-reception-service-lineage.md', 'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md', 'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json', 'src/logos-engine/v5-reception-wait-contracts.ts', 'src/logos-engine/v6-reception-residual-evidence.ts', 'src/logos-engine/v6-reception-service-access.ts', 'src/logos-engine/v6-reception-service-observation.ts', 'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-native-runtime.ts', 'tests/helpers/v6-live-game-campaign.ts', 'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-support-caller-integration.test.ts', 'scripts/export-v6-reception-service-legacy-checkpoints.mjs', 'scripts/export-v6-reception-service-reference.py', 'scripts/prove-observed-reception-service-contribution.mjs', 'tests/fixtures/v6-reception-service-legacy-checkpoints.json.gz', 'tests/fixtures/v6-reception-service-reference.json.gz', 'tests/v5-reception-wait-contracts.test.ts', 'tests/v6-reception-residual-evidence.test.ts', 'tests/v6-reception-service-access.test.ts', 'tests/v6-reception-service-integration.test.ts', 'tests/v6-reception-service-observation.test.ts', 'tests/v6-reception-service-native-contracts.test.ts']


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
        'schema': 'logos-engine.lot3e-reception-service.delivery-index.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'nativeVersion': '0.46.0', 'nativeSourceDigest': native['digest'],
        'baselineSourceCommit': '79e8fb89521b2d0fa8907e79467f24e7cf8a2b4e',
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'functionalQualification': 'ReceptionService own transfer, consumed residual reducer and wait ledger verified, with explicit native journal/current-epoch/stationary/wait corrections.5/6observed branches,50/76complete entries. Cold FOGW target3met in50actions/27prefixes; original unchanged source and adapted native-contract parity are separately qualified. Prior CWSE/SK48 clocks unchanged. Cost acceptance remains a distinct receipt.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery files plus named related source and roadmap files. Ignored originals are retained byte-identically as indexed parts or deterministic gzip with reconstruction receipts. This index excludes itself and does not rerun or reinterpret tests, game evidence or cost. The published commit also contains the complete prior evidence history.'
    }
    with OUTPUT.open('x') as out:
        out.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows)}))


if __name__ == '__main__':
    main()
