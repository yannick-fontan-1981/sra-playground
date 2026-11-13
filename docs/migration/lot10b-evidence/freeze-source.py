#!/usr/bin/env python3
"""Freeze native execution inputs; split large archives without changing bytes.

freeze DIRECTORY creates a new manifest/archive from current code. split keeps
an existing archive and its immutable manifest intact. restore reconstructs the
exact original from checked parts. None of these operations runs an agent.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('v53_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
PART_SIZE = 900_000


def write_json(path, value):
    with path.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')


def inside(name):
    path = ROOT / name
    path.resolve().relative_to(ROOT)
    if path.is_symlink():
        raise ValueError('Symlink evidence is not accepted')
    return path


def split(out):
    original = json.loads((out / 'source-archive.json').read_text())['archive']
    archive = inside(original['path'])
    if proof.evidence(archive) != original:
        raise ValueError('Archive differs from the frozen source receipt')
    chunks = []
    with archive.open('rb') as stream:
        while data := stream.read(PART_SIZE):
            part = out / f'source-archive.tar.gz.part{len(chunks):03d}'
            with part.open('xb') as output:
                output.write(data)
            chunks.append(proof.evidence(part))
    value = {'schema': 'logos-engine.v53.frozen-source-parts.v1', 'original': original,
             'parts': chunks, 'qualification': 'Ordered byte slices of the exact frozen gzip archive. No source or evidence content changes.'}
    write_json(out / 'source-archive-parts.json', value)
    verify_parts(out, restore=False)


def verify_parts(out, restore):
    value = json.loads((out / 'source-archive-parts.json').read_text())
    chunks = []
    for record in value['parts']:
        path = inside(record['path'])
        if proof.evidence(path) != record or record['bytes'] > PART_SIZE:
            raise ValueError('Part fingerprint mismatch')
        chunks.append(path.read_bytes())
    data = b''.join(chunks)
    original = value['original']
    if len(data) != original['bytes'] or hashlib.sha256(data).hexdigest() != original['sha256']:
        raise ValueError('Reconstructed archive mismatch')
    destination = inside(original['path'])
    if destination.exists():
        if proof.evidence(destination) != original:
            raise ValueError('Existing original differs; refusing overwrite')
    elif restore:
        with destination.open('xb') as stream:
            stream.write(data)
    return original


def freeze(out, campaign_only=False):
    out.mkdir(parents=True, exist_ok=True)
    if (out / 'source-manifest.json').exists():
        raise FileExistsError('A source freeze is immutable')
    native = proof.native_source()
    files = dict(native['files'])
    # All repository execution helpers are retained, including their direct
    # local imports. Native runtime imports are already covered by native_source.
    # Fixtures remain separately fingerprinted by the release receipt; Window's
    # new independent fixture is included here as an additional source contract.
    extras = ['package.json', 'package-lock.json', 'tsconfig.json', '.openai/hosting.json',
              'migration/v6-transfer-map.json',
              'tests/fixtures/v6-window-question-reference.json.gz']
    for folder in ['scripts', 'tests/helpers', 'docs/migration/lot10b-evidence']:
        extras += [path.relative_to(ROOT).as_posix() for path in sorted((ROOT / folder).glob('*'))
                   if path.is_file() and path.suffix in ('.ts', '.py', '.mjs', '.json')]
    scope = json.loads((ROOT / 'docs/migration/lot10b-evidence/validation-test-scope.json').read_text())
    extras += [name for group in scope['groups'] for name in group['testFiles']]
    extra_scope = ROOT / 'docs/migration/lot10b-evidence/integrated-extra-test-scope.json'
    if extra_scope.exists(): extras += json.loads(extra_scope.read_text())['testFiles']
    reference = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
    extras += [reference + name for name in ['laya_proto/common_frontier_policy.drm.json',
                'morphology_policy/strategy.drm', 'morphology_policy/window_question/window.drm',
                'morphology_policy/window_question/window.src']]
    if campaign_only:
        extras = ['package.json', 'package-lock.json', 'tsconfig.json', '.openai/hosting.json',
                  'scripts/run-v53-campaign-proof.py', 'scripts/freeze-v53-native-source.py',
                  'tests/helpers/v6-live-game-campaign.ts', 'tests/helpers/v6-window-question-capture.ts',
                  'tests/helpers/capture-preview-packing.ts',
                  'docs/migration/lot10b-evidence/freeze-source.py',
                  'docs/migration/lot10b-evidence/run-hpdl-campaign.mjs',
                  'docs/migration/lot10b-evidence/stream-evidence-json.mjs',
                  'docs/migration/lot10b-evidence/run-hpdl-clocked-proof.py',
                  reference + 'laya_proto/common_frontier_policy.drm.json',
                  reference + 'morphology_policy/strategy.drm']
    for name in sorted(set(extras)): files[name] = proof.sha(inside(name))
    files = dict(sorted(files.items()))
    archive = out / 'source-archive.tar.gz'
    with archive.open('xb') as stream:
        with gzip.GzipFile(filename='', mode='wb', fileobj=stream, mtime=0, compresslevel=9) as compressed:
            with tarfile.open(fileobj=compressed, mode='w|') as tar:
                for name in files:
                    data = inside(name).read_bytes()
                    if hashlib.sha256(data).hexdigest() != files[name]:
                        raise ValueError('Source changed during freeze: ' + name)
                    info = tarfile.TarInfo(name)
                    info.size = len(data)
                    info.mode = 0o644
                    tar.addfile(info, io.BytesIO(data))
    if any(proof.sha(inside(name)) != digest for name, digest in files.items()):
        raise ValueError('Execution input changed during freeze')
    if native != proof.native_source():
        raise ValueError('Native source changed during freeze')
    write_json(out / 'source-manifest.json', native)
    write_json(out / 'source-archive.json', {
        'schema': 'logos-engine.v53.frozen-source-archive.v1',
        'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'nativeSourceManifestDigest': native['digest'], 'files': files, 'archive': proof.evidence(archive),
        'qualification': 'Exact reconstructed native implementation, declared affected tests, original Window fixture and repository execution helper closure before this attempt. Game assets and the full original source inventory retain separate hashes in campaign/oracle receipts. No learned state or solution is included.'})
    split(out)
    return {'nativeSourceManifestDigest': native['digest'], 'files': len(files), 'nativeFiles': native['fileCount']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['freeze', 'split', 'restore', 'verify'])
    parser.add_argument('directory')
    parser.add_argument('--campaign-only', action='store_true', help='Freeze the actual HPDL execution closure while separate cost-tool preparation continues.')
    args = parser.parse_args()
    out = inside(args.directory)
    if args.operation == 'freeze':
        result = freeze(out, args.campaign_only)
    elif args.operation == 'split':
        split(out)
        result = verify_parts(out, False)
    else:
        result = verify_parts(out, args.operation == 'restore')
    print(json.dumps({'operation': args.operation, 'directory': args.directory, 'verified': result}))


if __name__ == '__main__':
    main()
