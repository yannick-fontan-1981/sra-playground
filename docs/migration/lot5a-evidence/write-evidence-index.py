#!/usr/bin/env python3
"""Index retained lot5A evidence after writers finish; never overwrite an index."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot5a-evidence'


def fingerprint(path):
    path = path.resolve(strict=True)
    assert path.is_relative_to(ROOT) and path.is_file()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(data)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    assert output.is_relative_to(EVIDENCE) and not output.exists()
    paths = sorted(p for p in EVIDENCE.rglob('*') if p.is_file() and p.resolve() != output)
    paths += [ROOT / 'docs/migration/lot5a-linked-temporal-preparation.md',
              ROOT / 'docs/migration/lot5a-linked-temporal-lineage.md',
              ROOT / 'docs/migration/v6-delivery-roadmap.md',
              ROOT / 'docs/migration/v6-native-transfer.md',
              ROOT / 'docs/migration/v6-entry-point-progress.json',
              ROOT / 'docs/migration/v6-coverage.json',
              ROOT / 'migration/v6-transfer-map.json']
    records = [fingerprint(p) for p in paths]
    assert len(records) == len({r['path'] for r in records})
    frozen = json.loads((EVIDENCE / 'final/source-manifest.json').read_bytes())
    assert frozen['fileCount'] == 283
    for name, digest in frozen['files'].items():
        assert fingerprint(ROOT / name)['sha256'] == digest, name
    data = {'schema': 'logos-engine.lot5a-evidence-index.v1', 'status': 'indexed_retained_bytes',
            'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': fingerprint(Path(__file__)),
            'sourceHead': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
            'sourceHeadRole': 'Ancestry at indexing; the publication records the completed source tree separately.',
            'nativeSourceDigest': frozen['digest'], 'indexedFiles': len(records),
            'indexedBytes': sum(r['bytes'] for r in records), 'files': records,
            'qualification': 'Complete byte inventory of the retained lot5A evidence at this timestamp plus current delivery documents and coverage. The index excludes itself. Raw originals may be supplied through retained lossless parts; their byte identity is separately verified. Future publication receipts are not anticipated. No game, test, build or cost is executed or reinterpreted.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        json.dump(data,stream,ensure_ascii=False,indent=2,allow_nan=False);stream.write('\n')
    print(json.dumps({'status':data['status'],'files':len(records),'output':fingerprint(output)}))


if __name__ == '__main__':
    main()
