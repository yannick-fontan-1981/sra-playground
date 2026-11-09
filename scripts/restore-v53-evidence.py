#!/usr/bin/env python3
"""Store/restore immutable large gzip evidence as exact ordered byte parts.

--pack FILE creates parts and a manifest without changing the original.
Without --pack, verify every parts manifest; --restore also restores missing
originals. This is byte transport only, not regeneration or validation of an
agent result. Frozen source tar archives have their own restore command.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PART_SIZE = 900_000


def fingerprint(data):
    return {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def record(path):
    if path.is_symlink():
        raise ValueError('Symlink evidence is not supported')
    return {'file': path.name, **fingerprint(path.read_bytes())}


def verify(manifest_path, restore):
    manifest = json.loads(manifest_path.read_bytes())
    if manifest['schema'] != 'logos-engine.evidence-byte-parts.v1':
        raise ValueError('Invalid byte manifest schema')
    parts = []
    for item in manifest['parts']:
        if Path(item['file']).name != item['file']:
            raise ValueError('Invalid part filename')
        path = manifest_path.parent / item['file']
        if record(path) != item or item['bytes'] > PART_SIZE:
            raise ValueError('Part differs from manifest')
        parts.append(path.read_bytes())
    data = b''.join(parts)
    original = manifest['original']
    if not parts or Path(original['file']).name != original['file'] or fingerprint(data) != {k: original[k] for k in ['sha256', 'bytes']}:
        raise ValueError('Reconstruction differs from original')
    path = manifest_path.parent / original['file']
    if path.exists():
        if record(path) != original:
            raise ValueError('Existing evidence differs; refusing overwrite')
    elif restore:
        with path.open('xb') as stream:
            stream.write(data)
    return {'path': path.relative_to(ROOT).as_posix(), **fingerprint(data)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pack')
    parser.add_argument('--restore', action='store_true')
    args = parser.parse_args()
    if args.pack:
        path = ROOT / args.pack
        path.resolve().relative_to(ROOT)
        data = path.read_bytes()
        parts = []
        for index, offset in enumerate(range(0, len(data), PART_SIZE)):
            part = path.with_name(path.name + f'.part{index:03d}')
            with part.open('xb') as stream:
                stream.write(data[offset:offset + PART_SIZE])
            parts.append(record(part))
        manifest_path = path.with_name(path.name + '.parts.json')
        with manifest_path.open('x') as stream:
            stream.write(json.dumps({'schema': 'logos-engine.evidence-byte-parts.v1',
                'original': record(path), 'parts': parts,
                'qualification': 'Exact byte partitions of immutable evidence; original data and checksum are unchanged.'}, indent=2) + '\n')
    verified = [verify(path, args.restore) for folder in ['tests/fixtures', 'docs/migration/native-campaigns-v53']
                for path in sorted((ROOT / folder).rglob('*.parts.json'))]
    print(json.dumps({'verified': verified, 'restoredMissing': args.restore}))


if __name__ == '__main__':
    main()
