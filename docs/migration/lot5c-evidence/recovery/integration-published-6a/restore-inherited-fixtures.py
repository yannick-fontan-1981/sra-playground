#!/usr/bin/env python3
"""Materialize two inherited fixtures from verified, already-published byte parts."""
from datetime import datetime, timezone
from pathlib import Path
import gzip
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if (p / '.openai/hosting.json').exists())
OUT = Path(__file__).resolve().parent
publication_path = ROOT / 'docs/migration/lot6a-evidence/integrated-final-02/publication-inputs.json'
publication = json.loads(publication_path.read_text())

def records(value, target):
    result = []
    if isinstance(value, dict):
        if value.get('path') == target:
            result.append(value)
        for child in value.values():
            result += records(child, target)
    elif isinstance(value, list):
        for child in value:
            result += records(child, target)
    return result

report_bytes = (ROOT / 'docs/migration/v6-coverage.json').read_bytes()
report = json.loads(report_bytes)
assert len(report['failures']) == 3
preserved = OUT / 'migration-audit-initial-report.json.gz'
with preserved.open('xb') as stream:
    stream.write(gzip.compress(report_bytes, mtime=0))
restored = []
for name in ['v6-feedback-sequences-reference.json.gz', 'v6-relative-arrangements-reference.json.gz']:
    destination = ROOT / 'tests/fixtures' / name
    parts_path = destination.with_name(destination.name + '.parts.json')
    manifest = json.loads(parts_path.read_text())
    assert manifest['original']['file'] == name
    declared = records(publication, destination.relative_to(ROOT).as_posix())
    assert declared and all(item['sha256'] == manifest['original']['sha256']
        and item['bytes'] == manifest['original']['bytes'] for item in declared)
    chunks = []
    for part in manifest['parts']:
        assert Path(part['file']).name == part['file']
        raw = (destination.parent / part['file']).read_bytes()
        assert len(raw) == part['bytes'] and hashlib.sha256(raw).hexdigest() == part['sha256']
        chunks.append(raw)
    raw = b''.join(chunks)
    assert len(raw) == manifest['original']['bytes']
    assert hashlib.sha256(raw).hexdigest() == manifest['original']['sha256']
    with destination.open('xb') as stream:
        stream.write(raw)
    restored.append({'path': destination.relative_to(ROOT).as_posix(), 'bytes': len(raw),
        'sha256': hashlib.sha256(raw).hexdigest(), 'partsManifest': parts_path.relative_to(ROOT).as_posix(),
        'partsVerified': len(chunks), 'matchesPublished6AInventory': True})
receipt = {
    'schema': 'logos-engine.lot5c.inherited-fixture-materialization.v1',
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'status': 'passed',
    'initialAuditCommandReceipt': 'docs/migration/lot5c-evidence/recovery/integration-published-6a/migration-audit.execution.json',
    'initialAuditCommandExit': 0, 'initialAuditSemanticStatus': 'failed',
    'initialAuditFailures': report['failures'],
    'preservedInitialReport': preserved.relative_to(ROOT).as_posix(),
    'initialReportSha256': hashlib.sha256(report_bytes).hexdigest(),
    'publishedInventory': publication_path.relative_to(ROOT).as_posix(),
    'restored': restored, 'nativeSourceChanged': False, 'testCriteriaChanged': False,
    'qualification': 'The audit generator returned0 but its report had three missing-evidence entries. '
        'Two gzip fixtures were absent while their tracked immutable parts were present. Exact byte '
        'assembly restores the originals and checks the published6A inventory. No expectation is '
        'generated, no source test or game is executed, and the original failed report is retained.',
}
with (OUT / 'inherited-fixture-materialization.json').open('x') as stream:
    stream.write(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'status': 'passed', 'restored': restored}))
