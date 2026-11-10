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
RELATED = [
    '.gitignore',
    'docs/migration/lot3c-current-evidence-correction.md',
    'docs/migration/v6-delivery-roadmap.md',
    'docs/migration/v6-native-transfer.md',
    'docs/migration/v6-entry-point-progress.json',
    'scripts/prove-exposed-current-evidence.mjs',
    'src/logos-engine/v6-exposed-reception-access.ts',
    'src/logos-engine/v6-native-runtime.ts',
    'tests/v6-exposed-reception.test.ts',
    'tests/v6-exposed-current-evidence.test.ts',
    'docs/migration/lot3b-global-budget-acceptance.json',
    'docs/migration/lot3b-global-budget-acceptance.md',
]


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
        'schema': 'logos-engine.lot3c-current-evidence.delivery-index.v1',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'nativeVersion': '0.44.0', 'nativeSourceDigest': native['digest'],
        'baselineSourceCommit': 'e9fd144112b05a65af5c88e9f05c541f43ed8ed7',
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'functionalQualification': 'Current-evidence contract corrected; cold CWSE target of 3 levels unmet with 107 actions / 2 levels / 93 prefixes and unchanged active-time stop. Lot 3C remains qualified/open. Next independent source priority 3D; no further CWSE attempt on this freeze.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery files plus named related source and roadmap files. Ignored originals are retained byte-identically as indexed parts with reconstruction manifests. This index excludes itself and does not rerun or reinterpret tests, game evidence or cost. The published commit also contains the complete prior evidence history.'
    }
    with OUTPUT.open('x') as out:
        out.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows)}))


if __name__ == '__main__':
    main()
