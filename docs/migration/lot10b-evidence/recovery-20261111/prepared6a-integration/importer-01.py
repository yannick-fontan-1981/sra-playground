from pathlib import Path
import hashlib, json, subprocess, tarfile, tempfile
from datetime import datetime, timezone

ROOT = Path('/workspace/sites/sra-lot10b-recovery-20261111/.sites-checkout')
PREPARED = Path('/workspace/sites/sra-lot6a-recovery-20261111/.sites-checkout')
BASE = '3a70463039768f7114edae7d94d7dd33b7f36aa8'
FREEZE = PREPARED / 'docs/migration/lot6a-evidence/integrated-final'
OUT = ROOT / 'docs/migration/lot10b-evidence/recovery-20261111/prepared6a-integration'
OUT.mkdir(parents=True, exist_ok=False)
def digest(data): return hashlib.sha256(data).hexdigest()
def fingerprint(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(PREPARED)), 'sha256': digest(data), 'bytes': len(data)}
native = json.loads((FREEZE / 'source-manifest.json').read_bytes())
archive = json.loads((FREEZE / 'source-archive.json').read_bytes())
assert native['digest'] == 'ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229'
assert archive['nativeSourceManifestDigest'] == native['digest']
packed = PREPARED / archive['archive']['path']
assert fingerprint(packed) == archive['archive']
native_names = [
    'src/logos-engine/v6-native-runtime.ts',
    'src/logos-engine/v6-preview-packing-calculus.ts',
    'src/logos-engine/v6-preview-packing-geometry.ts',
    'src/logos-engine/v6-preview-packing-types.ts',
    'src/logos-engine/v6-preview-packing.ts',
]
frozen_names = [*native_names, 'tests/helpers/v6-live-game-campaign.ts', 'tests/helpers/capture-preview-packing.ts']
payload = {}
with tarfile.open(packed, 'r:gz') as tar:
    for name in frozen_names:
        member = tar.getmember(name)
        assert member.isfile()
        data = tar.extractfile(member).read()
        assert digest(data) == archive['files'][name]
        if name in native['files']: assert digest(data) == native['files'][name]
        assert digest((PREPARED / name).read_bytes()) == digest(data), 'Prepared source changed after its freeze: ' + name
        payload[name] = data
additional = [
    'scripts/audit-v6-entry-points.ts',
    'tests/v6-preview-packing-native.test.ts',
    'tests/v6-preview-packing-reference.test.ts',
    'tests/v6-preview-packing-integration.test.ts',
    'tests/v6-preview-capture.test.ts',
    'tests/fixtures/v6-preview-packing/reference.json.gz',
    'scripts/compare-v6-preview-packing-reference.ts',
    'scripts/export-v6-preview-packing-reference.py',
    'scripts/compare-preview-packing-public-parity.py',
    'docs/migration/lot6a-preview-packing-lineage.md',
    'docs/migration/lot6a-evidence/recovery/native-source-review.json',
]
for name in additional: payload[name] = (PREPARED / name).read_bytes()
merged = {'src/logos-engine/v6-native-runtime.ts', 'tests/helpers/v6-live-game-campaign.ts', 'scripts/audit-v6-entry-points.ts'}
records, conflicts = [], []
for name, incoming in payload.items():
    target = ROOT / name
    row = {'path': name, 'preparedSha256': digest(incoming), 'bytes': len(incoming),
           'archivedAtPreparedFreeze': name in archive['files'],
           'mode': 'three_way_merge' if name in merged else 'exact_copy'}
    if name in merged:
        base = subprocess.check_output(['git', 'show', BASE + ':' + name], cwd=ROOT)
        current = target.read_bytes()
        row.update(baseSha256=digest(base), currentBeforeSha256=digest(current))
        with tempfile.TemporaryDirectory() as tmp:
            paths = [Path(tmp)/part for part in ('current', 'base', 'prepared')]
            for path, data in zip(paths, (current, base, incoming)): path.write_bytes(data)
            result = subprocess.run(['git', 'merge-file', '-p', '-L', 'window_and_workshop', '-L', 'published_site95', '-L', 'prepared_preview', *map(str, paths)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            assert 0 <= result.returncode <= 127, result.stderr.decode()
            target.write_bytes(result.stdout)
            row['mergeExitCode'] = result.returncode
            if result.returncode: conflicts.append(name)
        (OUT / (target.name + '.prepared')).write_bytes(incoming)
    else:
        if target.exists(): assert target.read_bytes() == incoming, 'Refusing another existing source: ' + name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(incoming)
    assert (PREPARED / name).read_bytes() == incoming, 'Prepared input changed during copy: ' + name
    row['copiedOrMergedSha256'] = digest(target.read_bytes())
    records.append(row)

current_map = json.loads((ROOT / 'migration/v6-transfer-map.json').read_bytes())
prepared_map = json.loads((PREPARED / 'migration/v6-transfer-map.json').read_bytes())
base_map = json.loads(subprocess.check_output(['git', 'show', BASE + ':migration/v6-transfer-map.json'], cwd=ROOT))
old_keys = {tuple(item['sources']) for item in base_map['mappings']}
present = {tuple(item['sources']) for item in current_map['mappings']}
added = []
for item in prepared_map['mappings']:
    key = tuple(item['sources'])
    if key not in old_keys:
        assert key not in present
        current_map['mappings'].append(item); added.append(list(key))
assert len(added) == 2
(ROOT / 'migration/v6-transfer-map.json').write_text(json.dumps(current_map, indent=2, ensure_ascii=False)+'\n')
result = {'schema': 'logos-engine.lot10b.prepared-source-integration.v1',
          'recordedAt': datetime.now(timezone.utc).isoformat(), 'baseCommit': BASE,
          'preparedNativeDigest': native['digest'], 'preparedNativeFileCount': native['fileCount'],
          'preparedSourceManifest': fingerprint(FREEZE / 'source-manifest.json'),
          'preparedSourceArchiveReceipt': fingerprint(FREEZE / 'source-archive.json'),
          'preparedSourceArchive': fingerprint(packed), 'files': records,
          'newMappings': added, 'unresolvedMergeFiles': conflicts,
          'qualification': 'Exact actual prepared PreviewPacking source, not a publication. Five native inputs and both capture inputs were checked against the existing frozen tar archive; supplemental tests/exporters are fingerprinted actual prepared bytes. Common files use explicit three-way merges from actual Site95. Final source reconciliation against the actual published predecessor remains required. No game, test, replay or clock was run by this import.'}
(OUT / 'source-observation.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'preparedNativeDigest':native['digest'], 'importedFiles': len(records), 'mergeConflicts': conflicts, 'newMappings':len(added)}))
