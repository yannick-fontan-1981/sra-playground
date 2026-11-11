#!/usr/bin/env python3
"""Freeze the selected-rigid native candidate and its passive execution adapters.

Derived from scripts/freeze-v53-native-source.py. The same native inventory and
byte-parts schema are used. Preview, SelectedRigid and inherited Window passive
evidence adapters are included explicitly. No game, native runtime, oracle or measurement is executed.
"""
from pathlib import Path
import gzip, hashlib, importlib.util, io, json, subprocess, sys, tarfile

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('freeze_source_parent', ROOT / 'scripts/freeze-v53-native-source.py')
parent = importlib.util.module_from_spec(spec); spec.loader.exec_module(parent)
proof = parent.proof

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python -B docs/migration/lot6b-evidence/freeze-source.py OUTPUT_DIRECTORY')
    out = (ROOT / sys.argv[1]).resolve(); out.relative_to(ROOT)
    out.mkdir(parents=True, exist_ok=True)
    if any((out / name).exists() for name in ('source-manifest.json', 'source-archive.json', 'source-archive.tar.gz')):
        raise FileExistsError('A source freeze is immutable')
    native = proof.native_source(); files = dict(native['files'])
    inputs = ['tests/helpers/v6-live-game-campaign.ts', 'tests/helpers/capture-preview-packing.ts', 'tests/helpers/capture-selected-rigid.ts',
              'tests/helpers/v6-window-question-capture.ts',
              'scripts/run-v53-journaled-campaign.mjs', 'scripts/run-v53-campaign-proof.py',
              'scripts/replay-v53-public-regression.mjs', 'scripts/run-v53-regression-checks.py',
              'scripts/run-v53-release-checks.py', 'scripts/freeze-v53-native-source.py',
              'scripts/run-recorded-public-regressions.py', 'scripts/compare-v54-regressions.py',
              'scripts/verify-native-delta.py', 'docs/migration/lot6b-evidence/freeze-source.py',
              'scripts/run-bounded-native-campaign.mjs', 'scripts/run-bounded-native-campaign-proof.py',
              'package.json', 'package-lock.json', 'tsconfig.json', '.openai/hosting.json']
    for name in inputs: files[name] = proof.sha(ROOT / name)
    files = dict(sorted(files.items())); archive = out / 'source-archive.tar.gz'
    with archive.open('xb') as stream, gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0, compresslevel=9) as zipped:
        with tarfile.open(fileobj=zipped, mode='w|') as tar:
            for name, expected in files.items():
                data = (ROOT / name).read_bytes()
                if hashlib.sha256(data).hexdigest() != expected: raise ValueError('Source changed: ' + name)
                info = tarfile.TarInfo(name); info.size = len(data); info.mode = 0o644
                tar.addfile(info, io.BytesIO(data))
    if proof.native_source() != native: raise ValueError('Native source changed during freeze')
    parent.write_json(out / 'source-manifest.json', native)
    parent.write_json(out / 'source-archive.json', {
        'schema': 'logos-engine.v53.frozen-source-archive.v1',
        'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'nativeSourceManifestDigest': native['digest'], 'files': files,
        'archive': proof.evidence(archive), 'generator': proof.evidence(Path(__file__)),
        'qualification': 'SelectedRigid candidate freeze. Includes exact native code and passive execution adapters; no learned state, game source or historical receipt is supplied as a production input.'})
    parent.split(out)
    print(json.dumps({'status': 'frozen', 'nativeDigest': native['digest'], 'nativeFiles': native['fileCount'],
                      'archiveFiles': len(files), 'directory': str(out.relative_to(ROOT))}))

if __name__ == '__main__': main()
