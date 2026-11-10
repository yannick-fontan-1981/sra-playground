#!/usr/bin/env python3
"""Lossless raw-byte transport for a retained JSON file or opaque Git bundle.

pack --repo CHECKOUT --source FILE --original-path RELATIVE_PATH --manifest RELATIVE_MANIFEST
restore --repo CHECKOUT --manifest RELATIVE_MANIFEST
verify --repo CHECKOUT --manifest RELATIVE_MANIFEST [--require-original]

Manifest v1: {schema, codec:"raw", partBytes:900000,
  original:{path,bytes,sha256}, parts:[{path,bytes,sha256}, ...]}.
Paths in a manifest are canonical POSIX paths relative to --repo. Parts sit
beside the manifest. Only pack's explicit source may be outside that root.
Existing files are never overwritten or deleted: identical files are validated,
and mismatches fail. A failed/interrupted operation leaves its bytes in place.
No JSON payload, bundle content, source code or Git command is interpreted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys

PART_BYTES = 900_000
SCHEMA = 'logos-engine.retained-byte-transport.v1'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def confined(root, relative):
    require(isinstance(relative, str) and bool(relative) and '\\' not in relative, 'Invalid relative path')
    path = PurePosixPath(relative)
    require(not path.is_absolute() and '..' not in path.parts and relative == path.as_posix()
            and relative != '.', 'Expected a canonical relative POSIX path: ' + relative)
    target = root.joinpath(*path.parts).resolve()
    require(target != root and target.is_relative_to(root), 'Path escapes the selected checkout: ' + relative)
    return target


def fingerprint(path):
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            size += len(block)
            digest.update(block)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def write_or_match(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open('xb') as stream:
            require(stream.write(data) == len(data), 'Short write: ' + str(path))
    except FileExistsError:
        require(fingerprint(path) == {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()},
                'Existing file differs; refusing overwrite: ' + str(path))


def part_name(manifest, index):
    path = PurePosixPath(manifest)
    return (path.parent / (path.name + '.part-' + f'{index:06d}' + '.bin')).as_posix()


def valid_fingerprint(record):
    require(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}
            and type(record['bytes']) is int and record['bytes'] >= 0
            and isinstance(record['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', record['sha256']),
            'Invalid byte fingerprint')


def read_part(root, record):
    path = confined(root, record['path'])
    with path.open('rb') as stream:
        data = stream.read(PART_BYTES + 1)
    require(len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'],
            'Part size or SHA-256 differs: ' + record['path'])
    return data


def inspect_transport(root, manifest_path):
    manifest_file = confined(root, manifest_path)
    manifest = json.loads(manifest_file.read_bytes())
    require(isinstance(manifest, dict) and set(manifest) == {'schema', 'codec', 'partBytes', 'original', 'parts'}
            and manifest['schema'] == SCHEMA and manifest['codec'] == 'raw'
            and type(manifest['partBytes']) is int and manifest['partBytes'] == PART_BYTES, 'Unsupported transport manifest')
    original = manifest['original']
    valid_fingerprint(original)
    target = confined(root, original['path'])
    require(target != manifest_file, 'Original and manifest paths must differ')
    parts = manifest['parts']
    require(isinstance(parts, list) and len(parts) == (original['bytes'] + PART_BYTES - 1) // PART_BYTES,
            'Part count does not match original byte count')
    total, digest = 0, hashlib.sha256()
    for index, record in enumerate(parts, 1):
        valid_fingerprint(record)
        require(record['path'] == part_name(manifest_path, index), 'Unexpected part path or order')
        require(confined(root, record['path']) != target, 'Original path collides with a part')
        require(record['bytes'] == min(PART_BYTES, original['bytes'] - total), 'Unexpected part length')
        data = read_part(root, record)
        total += len(data)
        digest.update(data)
    require(total == original['bytes'] and digest.hexdigest() == original['sha256'],
            'Concatenated transport differs from the original fingerprint')
    if target.exists():
        require(fingerprint(target) == {'bytes': original['bytes'], 'sha256': original['sha256']},
                'Existing original differs; refusing overwrite: ' + original['path'])
    return manifest, target


def pack(args, root):
    source = Path(args.source).resolve(strict=True)
    require(source.is_file(), 'Pack source must be an ordinary file')
    manifest_path = confined(root, args.manifest)
    original_path = confined(root, args.original_path)
    require(manifest_path != original_path and manifest_path != source, 'Manifest would replace source/original')
    before = source.stat()
    count = (before.st_size + PART_BYTES - 1) // PART_BYTES
    for index in range(1, count + 1):
        target = confined(root, part_name(args.manifest, index))
        require(target != source and target != original_path, 'A part would replace source/original')
    digest, size, parts = hashlib.sha256(), 0, []
    with source.open('rb') as stream:
        for index, data in enumerate(iter(lambda: stream.read(PART_BYTES), b''), 1):
            relative = part_name(args.manifest, index)
            target = confined(root, relative)
            require(target != source and target != original_path, 'A part would replace source/original')
            write_or_match(target, data)
            parts.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            size += len(data)
            digest.update(data)
    after = source.stat()
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
            == (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns)
            and size == before.st_size, 'Source changed while packing; no manifest was written')
    original = {'path': args.original_path, 'bytes': size, 'sha256': digest.hexdigest()}
    if original_path.exists() and original_path != source:
        require(fingerprint(original_path) == {'bytes': size, 'sha256': original['sha256']},
                'Stored original path already contains different bytes')
    manifest = {'schema': SCHEMA, 'codec': 'raw', 'partBytes': PART_BYTES, 'original': original, 'parts': parts}
    encoded = (json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
    write_or_match(manifest_path, encoded)
    return inspect_transport(root, args.manifest)


def restore(root, manifest, target):
    if target.exists():
        original = manifest['original']
        require(fingerprint(target) == {'bytes': original['bytes'], 'sha256': original['sha256']},
                'Existing original changed; refusing overwrite')
        return 'validated_existing_original'
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with target.open('xb') as stream:
            for record in manifest['parts']:
                data = read_part(root, record)
                require(stream.write(data) == len(data), 'Short restore write; partial bytes retained')
    except FileExistsError:
        pass  # A concurrent creator is accepted only after exact validation below.
    original = manifest['original']
    require(fingerprint(target) == {'bytes': original['bytes'], 'sha256': original['sha256']},
            'Restored/existing file differs; no original was overwritten or deleted')
    return 'restored_or_validated_exact_original'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='operation', required=True)
    for name in ['pack', 'restore', 'verify']:
        command = commands.add_parser(name)
        command.add_argument('--repo', required=True, help='Explicit checkout root; no Git discovery is performed')
        command.add_argument('--manifest', required=True, help='Canonical manifest path relative to --repo')
        if name == 'pack':
            command.add_argument('--source', required=True, help='Opaque input file, optionally outside --repo')
            command.add_argument('--original-path', required=True, help='Stored original path relative to --repo')
        elif name == 'verify':
            command.add_argument('--require-original', action='store_true')
    args = parser.parse_args()
    root = Path(args.repo).resolve(strict=True)
    require(root.is_dir(), 'The selected checkout root is not a directory')
    manifest, target = pack(args, root) if args.operation == 'pack' else inspect_transport(root, args.manifest)
    status = 'packed_exact_transport' if args.operation == 'pack' else 'verified_exact_transport'
    if args.operation == 'restore':
        status = restore(root, manifest, target)
    if args.operation == 'verify' and args.require_original:
        require(target.is_file(), 'Original is absent; restore it before requiring original verification')
    print(json.dumps({'status': status, 'manifest': args.manifest, 'original': manifest['original'],
                      'parts': len(manifest['parts']), 'originalPresent': target.is_file(),
                      'overwrittenFiles': 0, 'deletedFiles': 0}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'transport_failed', 'error': type(error).__name__ + ': ' + str(error),
                          'qualification': 'Existing files were not overwritten or deleted; partial new outputs, if any, remain.'}),
              file=sys.stderr)
        raise SystemExit(1)
