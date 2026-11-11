#!/usr/bin/env python3
"""Freeze the declared final 5C native and execution inputs without running them.

freeze DIRECTORY creates a new manifest/archive from current code. split keeps
an existing archive and its immutable manifest intact. restore reconstructs the
exact original from checked parts. None of these operations runs an agent.
"""
# Adapted from docs/migration/lot10b-evidence/freeze-source.py.
# Direct source SHA-256: 3b39a3d18025372749c9250539512616b10cb7400e57fe574dc1d58a6a74c065
# No historical execution result is reused.
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
DERIVED_FROM = 'docs/migration/lot10b-evidence/freeze-source.py'
DERIVED_SHA256 = '3b39a3d18025372749c9250539512616b10cb7400e57fe574dc1d58a6a74c065'
PART_SIZE = 900_000
EXPECTED_TEST_COUNT = 138
EXPECTED_REPLAY_COUNT = 11
COMMON_PLAN = 'docs/migration/lot5c-evidence/recovery/common/common-plan.json'
BINDING_FIXTURE = 'tests/fixtures/v6-observed-binding-reference.json.gz'
EXCLUDED_TESTS = {
    'tests/v6-ranked-workshop-reference.test.ts',
    'tests/v6-ranked-workshop-kernel.test.ts',
    'tests/v6-symbol-transactions-kernel.test.ts',
    'tests/v6-framed-transfer-reference.test.ts',
}
proof = None


def load_proof():
    global proof
    if proof is None:
        spec = importlib.util.spec_from_file_location('v53_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
        proof = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(proof)


def require(condition, message):
    if not condition:
        raise ValueError(message)



def write_json(path, value):
    with path.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')


def inside(name):
    require(isinstance(name, str) and bool(name), 'A repository-relative path is required')
    value = Path(name)
    require(not value.is_absolute() and value.as_posix() == name
            and all(part not in ('.', '..', 'project_sources') for part in value.parts),
            'A canonical repository-relative path outside project_sources is required: ' + name)
    path = ROOT / value
    path.resolve().relative_to(ROOT)
    require(not any(item.is_symlink() for item in (path, *path.parents) if item != ROOT.parent),
            'Symlink evidence is not accepted: ' + name)
    return path


def validate_test_scope(scope):
    require(type(scope) is dict and scope.get('schema') == 'logos-engine.lot5c.actual-published-final-scope-reconciliation.v1',
            'The actual-published 5C final scope reconciliation is required')
    selection = scope.get('testScope', {})
    require(type(selection) is dict, 'The reconciled test scope must be an object')
    tests = selection.get('testFiles')
    require(type(tests) is list and len(tests) == EXPECTED_TEST_COUNT
            and all(type(name) is str and name.startswith('tests/') and name.endswith('.test.ts') for name in tests),
            'Exactly 138 declared TypeScript test files are required')
    require(tests == sorted(set(tests)) and selection.get('testFileCount') == EXPECTED_TEST_COUNT,
            'The 138 test files must be unique, sorted and correctly counted')
    exclusions = selection.get('excludedWholeModules')
    require(type(exclusions) is list and len(exclusions) == 4 and set(exclusions) == EXCLUDED_TESTS
            and not set(tests).intersection(EXCLUDED_TESTS)
            and selection.get('excludedModulesInScope') == []
            and selection.get('missingFromCurrentCandidateCheckout') == [],
            'The four closed-budget whole-module exclusions must remain exact')
    for name in tests:
        inside(name)
    return tests


def validate_replay_scope(replay, scope):
    expected = scope.get('recordedReplayScope', {})
    require(type(replay) is dict and replay.get('schema') == 'logos-engine.recorded-public-regression-cases.v1',
            'A runnable recorded-public regression manifest is required')
    rows = replay.get('cases')
    require(type(expected) is dict and type(rows) is list and len(rows) == EXPECTED_REPLAY_COUNT
            and rows == expected.get('cases')
            and expected.get('caseCount') == EXPECTED_REPLAY_COUNT
            and expected.get('expectedChecksPerCase') == 17
            and expected.get('expectedComparisonChecks') == 187,
            'Replay rows must equal the eleven reconciled historical rows and preserve all 187 checks')
    return rows


def read_declaration(path):
    with path.open('rb') as stream:
        raw = stream.read(131073)
    require(len(raw) <= 131072, 'A declaration exceeds the bounded 128 KiB input limit')
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def validate_declaration_pins(files, pins):
    require(all(files.get(name) == digest for name, digest in pins.items()),
            'A declaration changed after its exact bytes were validated')


def declared_extras(test_scope, replay_scope, contract):
    # Declarations are read; their referenced journals and traces are not decoded
    # or archived. They remain separately pinned by the actual replay/oracle receipts.
    paths = [inside(name) for name in (test_scope, replay_scope, contract)]
    require(len(set(paths)) == 3 and all(path.is_file() for path in paths),
            'Three distinct existing test-scope, replay-scope and validation-contract inputs are required')
    loaded = [read_declaration(path) for path in paths]
    scope, replay, validation = [item[0] for item in loaded]
    declaration_pins = {name: item[1] for name, item in zip((test_scope, replay_scope, contract), loaded)}
    tests = validate_test_scope(scope)
    validate_replay_scope(replay, scope)
    require(type(validation) is dict and type(validation.get('schema')) is str and bool(validation['schema']),
            'The explicit validation contract needs its schema; its exact bytes will be frozen')
    extras = ['package.json', 'package-lock.json', 'tsconfig.json', '.openai/hosting.json',
              'migration/v6-transfer-map.json', BINDING_FIXTURE, COMMON_PLAN,
              test_scope, replay_scope, contract, DERIVED_FROM,
              'docs/migration/lot5c-evidence/recovery/planning/final-freezer-preparation.json']
    for folder in ('scripts', 'tests/helpers', 'docs/migration/lot5c-evidence'):
        for path in sorted((ROOT / folder).glob('*')):
            if path.is_file() and path.suffix in ('.ts', '.py', '.mjs', '.js', '.cjs', '.sh', '.json'):
                # Native declarative programs are separately covered by native_source;
                # large logs/journals are never admitted through a helper JSON glob.
                require(path.suffix != '.json' or path.stat().st_size <= 131072,
                        'Large helper JSON is outside the declared source archive: ' + str(path.relative_to(ROOT)))
                extras.append(path.relative_to(ROOT).as_posix())
    extras += tests
    reference = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
    extras += [reference + name for name in (
        'laya_proto/common_frontier_policy.drm.json', 'morphology_policy/strategy.drm',
        'morphology_policy/window_question/window.drm', 'morphology_policy/window_question/window.src',
        'morphology_policy/guarded_binding/binding.drm', 'morphology_policy/guarded_binding/binding.src')]
    for name in extras:
        path = inside(name)
        require(path.is_file(), 'A declared execution input is missing: ' + name)
    require(hashlib.sha256(inside(DERIVED_FROM).read_bytes()).hexdigest() == DERIVED_SHA256,
            'The retained 10B freezer provenance source changed')
    return sorted(set(extras)), declaration_pins


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


def freeze(out, test_scope, replay_scope, contract):
    extras, declaration_pins = declared_extras(test_scope, replay_scope, contract)
    out.mkdir(parents=True, exist_ok=True)
    require(not any((out / name).exists() for name in ('source-manifest.json', 'source-archive.json',
                'source-archive.tar.gz', 'source-archive-parts.json'))
            and not any(out.glob('source-archive.tar.gz.part*')), 'A source freeze is immutable; use a new output directory')
    native = proof.native_source()
    files = dict(native['files'])
    for name in sorted(set(extras)): files[name] = proof.sha(inside(name))
    files = dict(sorted(files.items()))
    validate_declaration_pins(files, declaration_pins)
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
    final_extras, final_declaration_pins = declared_extras(test_scope, replay_scope, contract)
    require(final_extras == extras and final_declaration_pins == declaration_pins,
            'Declared input bytes or execution-helper membership changed during freeze')
    if native != proof.native_source():
        raise ValueError('Native source changed during freeze')
    write_json(out / 'source-manifest.json', native)
    write_json(out / 'source-archive.json', {
        'schema': 'logos-engine.v53.frozen-source-archive.v1',
        'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'nativeSourceManifestDigest': native['digest'], 'files': files, 'archive': proof.evidence(archive),
        'qualification': 'Exact final 5C native implementation, 138 reconciled test files, Binding fixture, declared 11-case replay manifest, validation contract, common plan and execution helper closure before this attempt. Historical journals, game engines, game assets, project_sources and learned state are not included. Other fixtures and the full original source inventory retain their separate hashes in actual test/replay/oracle receipts.'})
    split(out)
    return {'nativeSourceManifestDigest': native['digest'], 'files': len(files), 'nativeFiles': native['fileCount']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['freeze', 'split', 'restore', 'verify'])
    parser.add_argument('directory')
    parser.add_argument('--test-scope', help='Explicit 5C reconciliation JSON containing testScope.testFiles (exactly 138).')
    parser.add_argument('--replay-scope', help='Explicit runnable eleven-case manifest matching the reconciliation exactly.')
    parser.add_argument('--contract', help='Explicit validation-contract JSON whose exact bytes are frozen.')
    args = parser.parse_args()
    out = inside(args.directory)
    if args.operation == 'freeze' and not all((args.test_scope, args.replay_scope, args.contract)):
        parser.error('freeze requires --test-scope, --replay-scope and --contract')
    load_proof()
    if args.operation == 'freeze':
        result = freeze(out, args.test_scope, args.replay_scope, args.contract)
    elif args.operation == 'split':
        split(out)
        result = verify_parts(out, False)
    else:
        result = verify_parts(out, args.operation == 'restore')
    print(json.dumps({'operation': args.operation, 'directory': args.directory, 'verified': result}))


if __name__ == '__main__':
    main()
