#!/usr/bin/env python3
"""Verify completed native delivery inputs and lossless evidence transport.

Usage: python -B scripts/verify-native-delivery.py DIRECTORY
       [--validation-directory PATH] [--require-regressions] [--receipt FILE ...]

Run only after validation, regressions and evidence packing have finished.
Additional receipts are fingerprinted, not reinterpreted. FILE may be relative
to DIRECTORY, repository-relative, or absolute inside DIRECTORY. The exclusive
output is DIRECTORY/delivery-integrity.json. Originals must remain available:
only an initially empty temporary root receives restored evidence. This tool
does not run a game, an agent, a source comparison, tests or a production build.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tarfile
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SOURCE_HELPER = 'scripts/compare-v54-reactive-public-evidence.py'
CAMPAIGN_HELPER = 'scripts/run-v53-campaign-proof.py'
TRANSPORT_HELPER = 'scripts/evidence-byte-parts.py'
RESTORE_HELPER = 'scripts/restore-v53-evidence.py'
BUILD_EXTRAS = [
    'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
    'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
    'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs',
]
QUALIFICATION = (
    'Post-validation file integrity and lossless evidence transport only. Every completed JSON evidence parts manifest '
    'is checked with the existing transport helpers, restored into an initially empty temporary root and compared '
    'byte for byte with its unchanged original. Frozen source archive members, recorded native/source/test/build '
    'inputs and recorded validation status are checked without rerunning or reinterpreting a game, agent, source '
    'comparison, test or build. Additional receipts are fingerprinted only. This is not a new campaign, proof of '
    'causal game improvement or complete migration.'
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def relative_name(value):
    require(isinstance(value, str) and bool(value), 'Expected a nonempty relative path')
    require(not PurePosixPath(value).is_absolute() and '\\' not in value
            and all(part not in ('', '.', '..') for part in value.split('/'))
            and all(ord(c) >= 32 for c in value), 'Unsafe relative path: ' + repr(value))
    return value


def confined(value, boundary=ROOT):
    """Check lexical ancestry and every existing path component before resolve."""
    boundary = Path(boundary)
    path = Path(value)
    require('..' not in path.parts and '\\' not in str(value) and all(ord(c) >= 32 for c in str(value)),
            'Unsafe delivery path: ' + repr(str(value)))
    if not path.is_absolute():
        path = boundary / path
    try:
        relative = path.relative_to(boundary)
    except ValueError as error:
        raise ValueError('Path is outside its declared root: ' + str(path)) from error
    current = boundary
    require(not current.is_symlink(), 'Symlink roots are not supported')
    for part in relative.parts:
        current = current / part
        require(not current.is_symlink(), 'Symlink paths are not supported: ' + str(current))
    require(path.resolve().is_relative_to(boundary.resolve()), 'Resolved path escapes its declared root')
    return path


def repository_path(name):
    return confined(ROOT / relative_name(name))


def walk_files(directory, boundary=ROOT):
    directory = confined(directory, boundary)
    require(directory.is_dir(), 'Missing input directory: ' + str(directory))
    found = []
    for folder, dirs, names in os.walk(directory, followlinks=False):
        for name in dirs + names:
            confined(Path(folder) / name, boundary)
        for name in names:
            path = Path(folder) / name
            require(path.is_file(), 'Non-regular delivery input: ' + str(path))
            found.append(path)
    return sorted(found)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def fingerprint(path, root=ROOT):
    path = confined(path, root)
    require(path.is_file(), 'Missing regular input file: ' + str(path))
    return {'path': path.relative_to(root).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def valid_digest(value):
    return isinstance(value, str) and re.fullmatch(r'[0-9a-f]{64}', value) is not None


def check_record(record, boundary=ROOT):
    require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'}, 'Invalid file fingerprint')
    require(valid_digest(record['sha256']) and type(record['bytes']) is int and record['bytes'] >= 0, 'Invalid fingerprint values')
    path = repository_path(record['path'])
    confined(path, boundary)
    require(fingerprint(path) == record, 'File fingerprint differs: ' + record['path'])
    return path


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError('Non-finite JSON value: ' + value)


def read_json(path):
    path = confined(path)
    require(path.is_file(), 'Missing JSON receipt: ' + str(path))
    return json.loads(path.read_bytes(), object_pairs_hook=unique_object, parse_constant=invalid_constant)


def load_helper(name, relative):
    path = repository_path(relative)
    require(path.is_file(), 'Missing verification helper: ' + relative)
    spec = importlib.util.spec_from_file_location(name, path)
    require(spec is not None and spec.loader is not None, 'Cannot load helper: ' + relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def inventory(folders, suffixes=None):
    return dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
                       for folder in folders for path in walk_files(repository_path(folder))
                       if suffixes is None or path.suffix in suffixes))


def check_map(files, label):
    require(isinstance(files, dict) and bool(files), 'Empty or invalid inventory: ' + label)
    for name, expected in files.items():
        require(valid_digest(expected), 'Invalid digest in ' + label)
        path = repository_path(name)
        require(path.is_file() and sha(path) == expected, label + ' differs: ' + name)
    return len(files)


def verify_native(manifest, campaign):
    require(isinstance(manifest, dict) and set(manifest) == {'fileCount', 'digest', 'files'}, 'Invalid native source manifest')
    files = inventory(['src/logos-engine', 'src/runtime'], {'.ts', '.json', '.drm'})
    expected = {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}
    require(type(manifest['fileCount']) is int and manifest == expected, 'Current native inventory differs from frozen manifest')
    require(campaign.native_source() == expected, 'Existing native-source helper disagrees with confined inventory')
    return len(files)


def verify_source_archive(directory, native):
    receipt = read_json(directory / 'source-archive.json')
    require(receipt.get('schema') == 'logos-engine.v53.frozen-source-archive.v1', 'Unsupported frozen source archive contract')
    require(receipt.get('nativeSourceManifestDigest') == native['digest'], 'Archive names another native source')
    files = receipt.get('files')
    count = check_map(files, 'archive inputs')
    require(all(files.get(name) == digest for name, digest in native['files'].items()), 'Archive omits a frozen native input')
    archive = check_record(receipt['archive'], directory)
    with tarfile.open(archive, 'r:gz') as tar:
        seen = set()
        for member in tar:
            name = relative_name(member.name)
            require(member.isfile() and not member.issym() and not member.islnk(), 'Only regular frozen archive members are supported')
            require(name in files and name not in seen, 'Unexpected or duplicate frozen archive member: ' + name)
            repository_path(name)
            incoming = tar.extractfile(member)
            require(incoming is not None, 'Missing archive member payload')
            with incoming:
                digest = hashlib.sha256(); size = 0
                for chunk in iter(lambda: incoming.read(1024 * 1024), b''):
                    digest.update(chunk); size += len(chunk)
            require(size == member.size and digest.hexdigest() == files[name], 'Frozen archive member differs: ' + name)
            seen.add(name)
        require(seen == set(files), 'Frozen archive member inventory is incomplete')
    parts_path = directory / 'source-archive-parts.json'
    require(parts_path.is_file(), 'Missing frozen source archive parts manifest')
    parts = read_json(parts_path)
    require(parts.get('schema') == 'logos-engine.v53.frozen-source-parts.v1'
            and parts.get('original') == receipt['archive'], 'Frozen archive parts name another original')
    require(isinstance(parts.get('parts'), list) and bool(parts['parts']), 'Missing ordered frozen archive parts')
    total = 0; reconstructed = hashlib.sha256()
    with archive.open('rb') as original:
        for index, item in enumerate(parts['parts']):
            path = check_record(item, directory)
            require(path == directory / f'source-archive.tar.gz.part{index:03d}' and 0 < item['bytes'] <= 900000,
                    'Unexpected frozen archive part order or size')
            data = path.read_bytes()
            require(original.read(len(data)) == data, 'Frozen archive parts are not byte-identical')
            reconstructed.update(data); total += len(data)
        require(original.read(1) == b'', 'Frozen archive parts omit bytes')
    require(total == receipt['archive']['bytes'] and reconstructed.hexdigest() == receipt['archive']['sha256'], 'Frozen archive reconstruction differs')
    return receipt, {'files': count, 'archive': receipt['archive'], 'members': len(seen), 'parts': len(parts['parts']), 'byteIdentical': True}


def verify_check_receipt(value, native, names):
    require(value.get('schema') == 'logos-engine.native-delta-verification.v1' and value.get('status') == 'passed', 'Recorded native checks did not pass')
    require(value.get('nativeSource') == native and value.get('nativeSourceManifestDigest') == native['digest']
            and value.get('nativeSourceUnchanged') is True, 'Validation names changed native inputs')
    check_record(value['generator'])
    checks = value.get('checks')
    require(isinstance(checks, list) and [row.get('name') for row in checks] == names, 'Incomplete or unexpected recorded checks')
    for row in checks:
        require(type(row.get('exitCode')) is int and row['exitCode'] == 0, 'Recorded check failed: ' + row['name'])
        check_record(row['output'])


def verify_tests(value, native):
    verify_check_receipt(value, native, ['delta-tests'])
    require(value.get('sourceAndTestInputsUnchanged') is True, 'Test inputs changed during execution')
    expected = value.get('sourceAndTestInputs')
    check_map(expected, 'source/test inputs')
    require(expected == inventory(['src', 'tests']), 'Current source/test membership differs from recorded inventory')
    tests = value.get('testFiles')
    require(isinstance(tests, list) and bool(tests) and len(tests) == len(set(tests)), 'Invalid recorded test-file list')
    require(all(name in expected and name.startswith('tests/') and name.endswith('.test.ts') for name in tests), 'Test file outside recorded test inventory')
    check = value['checks'][0]; counts = check.get('counts')
    require(check.get('tapSummaryComplete') is True and isinstance(counts, dict)
            and set(counts) == {'tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'}, 'Incomplete recorded TAP summary')
    require(all(type(n) is int and n >= 0 for n in counts.values()) and counts['tests'] > 0
            and counts['tests'] == counts['pass'] and all(counts[k] == 0 for k in ['fail', 'cancelled', 'skipped', 'todo']),
            'Recorded test counts are not a complete pass')
    return len(expected), counts


def verify_build(value, native):
    verify_check_receipt(value, native, ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build'])
    inputs = value.get('buildInputs'); check_map(inputs, 'build inputs')
    current = inventory(['src', 'public', 'content'])
    for name in BUILD_EXTRAS:
        path = repository_path(name)
        if path.exists():
            require(path.is_file(), 'Build input is not a file: ' + name)
            current[name] = sha(path)
    require(inputs == current, 'Current build input membership differs from recorded inventory')
    worker = value['nativeAgentWorker']; path = check_record(worker, ROOT / 'dist/assets')
    workers = [p for p in walk_files(ROOT / 'dist/assets') if re.fullmatch(r'v6-agent-worker-[^/]+\.js', p.name)]
    require(workers == [path], 'Expected exactly the recorded native production worker')
    return len(inputs), worker


def verify_regressions(path, native, required):
    if not path.exists():
        require(not required, 'Required recorded regression summary is absent')
        return None, 0
    value = read_json(path)
    require(value.get('schema') == 'logos-engine.recorded-public-regressions.v1' and value.get('status') == 'passed', 'Recorded regressions did not pass')
    require(value.get('nativeSource') == native and value.get('nativeSourceAfter') == native
            and value.get('executionInputsUnchanged') is True
            and value.get('executionInputs') == value.get('executionInputsAfter'), 'Regression execution inputs changed')
    count = check_map(value['executionInputs'], 'regression execution inputs')
    check_record(value['caseManifest'])
    results = value.get('results')
    require(type(value.get('total')) is int and value['total'] > 0 and value.get('passed') == value['total']
            and isinstance(results, list) and len(results) == value['total']
            and all(row.get('passed') is True for row in results), 'Incomplete recorded regression result set')
    require(type(value.get('comparisonChecksExpected')) is int and value['comparisonChecksExpected'] > 0
            and value.get('comparisonChecksPassed') == value['comparisonChecksExpected'], 'Regression comparison checks are incomplete')
    require(type(value.get('passiveOwnerPrefixesChecked')) is int and value['passiveOwnerPrefixesChecked'] >= 0
            and value.get('passiveOwnerPrefixesPassed') == value['passiveOwnerPrefixesChecked'], 'Passive-owner regression checks are incomplete')
    return value, count


def bytes_equal(first, second):
    with Path(first).open('rb') as left, Path(second).open('rb') as right:
        while True:
            a, b = left.read(1024 * 1024), right.read(1024 * 1024)
            if a != b:
                return False
            if not a:
                return True


@contextmanager
def transport_root(module, root):
    """Existing helpers have an explicit module ROOT; source code is unchanged."""
    old, old_original = module.ROOT, module.original.ROOT
    module.ROOT = root; module.original.ROOT = root
    try:
        yield
    finally:
        module.ROOT = old; module.original.ROOT = old_original


def verify_byte_storage(directory, transport, root=ROOT):
    directory = confined(directory, root)
    files = walk_files(directory, root)
    paths = [p for p in files if p.name.endswith('.parts.json')]
    for path in files:
        if path.name.endswith('.json.gz') and path.stat().st_size > transport.PART_SIZE:
            require(path.with_name(path.name + '.parts.json') in paths, 'Packing is incomplete for large evidence: ' + str(path))
    checked = []; tracked = {}
    with transport_root(transport, root):
        for path in paths:
            # Strict schema, unique keys, exact partition sizes/order and both
            # helper hashes are checked before any manifest-controlled copying.
            item = transport.verify(path, restore=False, directory=directory)
            manifest = json.loads(path.read_bytes(), object_pairs_hook=unique_object, parse_constant=invalid_constant)
            original = confined(path.parent / manifest['original']['file'], directory)
            require(original.is_file(), 'Byte comparison requires the unchanged original: ' + str(original))
            row = {'path': path, 'manifest': manifest, 'original': original, 'verified': item}
            checked.append(row)
            for source in [path, original, *[path.parent / part['file'] for part in manifest['parts']]]:
                require(source not in tracked or tracked[source] == fingerprint(source, root), 'Conflicting evidence part input')
                tracked[source] = fingerprint(source, root)
    restored = []; temporary = None
    with tempfile.TemporaryDirectory(prefix='native-delivery-restore-') as folder:
        temporary = Path(folder)
        require(not any(temporary.iterdir()), 'Restore root must start empty')
        for row in checked:
            path, manifest = row['path'], row['manifest']
            destination = confined(temporary / row['original'].relative_to(root), temporary)
            require(not destination.exists() and not destination.is_symlink(), 'Restore original must be absent before reconstruction')
            for source in [path, *[path.parent / part['file'] for part in manifest['parts']]]:
                target = confined(temporary / source.relative_to(root), temporary)
                target.parent.mkdir(parents=True, exist_ok=True)
                confined(target, temporary)
                with source.open('rb') as incoming, target.open('xb') as outgoing:
                    shutil.copyfileobj(incoming, outgoing, length=1024 * 1024)
            copied_manifest = temporary / path.relative_to(root)
            with transport_root(transport, temporary):
                result = transport.verify(copied_manifest, restore=True, directory=temporary)
            require(result.get('restored') is True and destination.is_file(), 'Existing helper did not restore an absent original')
            require(bytes_equal(row['original'], destination), 'Restored evidence is not byte-identical: ' + result['path'])
            require(fingerprint(destination, temporary) == fingerprint(row['original'], root), 'Restored evidence fingerprint differs')
            restored.append({**row['verified'], 'restored': True, 'byteIdentical': True})
    require(temporary is not None and not temporary.exists(), 'Temporary restore root was not removed')
    for path, before in tracked.items():
        require(fingerprint(path, root) == before, 'Original evidence or parts changed during verification: ' + str(path))
    return {'reports': len(restored), 'parts': sum(row['parts'] for row in restored), 'bytes': sum(row['bytes'] for row in restored),
            'originalsAbsentBeforeRestore': True, 'temporaryRootRemoved': True, 'originalsUnchanged': True,
            'restoredByteIdentical': restored}


def extra_receipt(value, directory):
    path = Path(value)
    if path.is_absolute():
        return confined(path, directory)
    relative_name(value)
    directory_parts = directory.relative_to(ROOT).parts
    path = ROOT / path if path.parts[:len(directory_parts)] == directory_parts else directory / path
    return confined(path, directory)


def verify_pinned_source(helper):
    source = confined(helper.SOURCE)
    manifest_path = confined(source.parent / 'manifest.json')
    manifest = read_json(manifest_path)
    files = manifest.get('files')
    require(isinstance(files, dict) and len(files) == 1786, 'Unexpected pinned original source inventory')
    expected = {}
    for name, item in files.items():
        path = confined(source / relative_name(name), source)
        require(path.is_file() and isinstance(item, dict) and valid_digest(item.get('sha256')), 'Invalid pinned source entry')
        require(sha(path) == item['sha256'], 'Pinned original source changed: ' + name)
        expected[name] = item['sha256']
    require(helper.verify_source() == expected, 'Existing original-source helper disagrees')
    return expected, fingerprint(manifest_path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', help='Completed frozen delivery directory inside this repository')
    parser.add_argument('--validation-directory', default='validation', metavar='PATH',
                        help='Completed tests/build receipt directory confined inside DIRECTORY (default: validation)')
    parser.add_argument('--receipt', action='append', default=[], metavar='FILE', help='Additional existing receipt to fingerprint; repeatable')
    parser.add_argument('--require-regressions', action='store_true', help='Fail unless regressions/regression-summary.json exists and passed')
    args = parser.parse_args()
    directory = confined(args.directory)
    require(directory.is_dir(), 'Delivery directory does not exist')
    validation = extra_receipt(args.validation_directory, directory)
    require(validation.is_dir(), 'Validation directory does not exist')
    output = confined(directory / 'delivery-integrity.json')
    if output.exists() or output.is_symlink():
        raise FileExistsError('Delivery receipt is exclusive: ' + str(output))
    campaign = load_helper('native_delivery_campaign', CAMPAIGN_HELPER)
    original = load_helper('native_delivery_original', SOURCE_HELPER)
    transport = load_helper('native_delivery_transport', TRANSPORT_HELPER)
    helpers = [fingerprint(repository_path(name)) for name in [CAMPAIGN_HELPER, SOURCE_HELPER, TRANSPORT_HELPER, RESTORE_HELPER]]
    generator = fingerprint(Path(__file__))
    paths = [directory / 'source-manifest.json', directory / 'source-archive.json', directory / 'source-archive-parts.json',
             validation / 'delta-tests-run.json', validation / 'checks-run.json']
    regression_path = directory / 'regressions/regression-summary.json'
    if regression_path.exists():
        paths.append(regression_path)
    paths.extend(extra_receipt(name, directory) for name in args.receipt)
    paths = list(dict.fromkeys(paths))
    receipts_before = [fingerprint(path) for path in paths]
    native = read_json(paths[0]); native_count = verify_native(native, campaign)
    archive, archive_check = verify_source_archive(directory, native)
    tests = read_json(validation / 'delta-tests-run.json')
    test_count, counts = verify_tests(tests, native)
    build = read_json(validation / 'checks-run.json')
    build_count, worker = verify_build(build, native)
    regressions, regression_count = verify_regressions(regression_path, native, args.require_regressions)
    pinned_before, pinned_manifest = verify_pinned_source(original)
    byte_storage = verify_byte_storage(directory, transport)
    byte_storage['generators'] = [fingerprint(repository_path(name)) for name in [TRANSPORT_HELPER, RESTORE_HELPER]]
    # A successful result binds the same inputs after transport verification.
    require(verify_native(native, campaign) == native_count, 'Native inventory changed during verification')
    check_map(archive['files'], 'archive inputs after transport')
    require(verify_tests(tests, native) == (test_count, counts), 'Test inventory changed during verification')
    require(verify_build(build, native) == (build_count, worker), 'Build inventory changed during verification')
    if regressions is not None:
        require(verify_regressions(regression_path, native, True)[0] == regressions, 'Regression receipt changed during verification')
    require(verify_pinned_source(original) == (pinned_before, pinned_manifest), 'Pinned source changed during verification')
    require([fingerprint(path) for path in paths] == receipts_before, 'Delivery receipts changed during verification')
    require(fingerprint(Path(__file__)) == generator and [fingerprint(repository_path(item['path'])) for item in helpers] == helpers,
            'Verification helpers changed during execution')
    regression_fields = ['passed', 'total', 'comparisonChecksPassed', 'comparisonChecksExpected', 'passiveOwnerPrefixesChecked',
                         'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained', 'prevalidatedTotals']
    result = {'schema': 'logos-engine.native-delivery-integrity.v1', 'status': 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'directory': directory.relative_to(ROOT).as_posix(),
              'validationDirectory': validation.relative_to(ROOT).as_posix(),
              'generator': generator, 'verificationHelpers': helpers, 'nativeSourceDigest': native['digest'],
              'matchedFileInventories': {'native': native_count, 'archive': archive_check['files'], 'sourceAndTests': test_count,
                                         'buildInputs': build_count, 'regressionExecutionInputs': regression_count},
              'originalSourceFilesUnchanged': len(pinned_before), 'originalSourceManifest': pinned_manifest,
              'tests': counts, 'regressions': {key: regressions[key] for key in regression_fields} if regressions is not None else None,
              'nativeAgentWorker': worker, 'sourceArchiveVerification': archive_check, 'byteStorage': byte_storage,
              'receipts': receipts_before, 'qualification': QUALIFICATION}
    payload = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
    confined(output)
    with output.open('xb') as stream:
        stream.write(payload)
    print(json.dumps({'status': 'passed', 'receipt': fingerprint(output), 'nativeSourceDigest': native['digest'],
                      'inventories': result['matchedFileInventories'], 'byteReports': byte_storage['reports'],
                      'byteParts': byte_storage['parts'], 'restoredBytes': byte_storage['bytes']}))


if __name__ == '__main__':
    main()
