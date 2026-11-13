#!/usr/bin/env python3
"""Restore the unchanged ReceptionService contribution JSON from exact gzip.

Usage: python -B docs/migration/lot3e-evidence/restore-contribution.py [restore|verify]
The default restores a missing original exclusively; an existing original is
verified and never overwritten. This transports bytes, without rerunning proof.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).absolute()
DIRECTORY = SCRIPT.parent
ROOT = DIRECTORY.parents[2]
ORIGINAL = 'final/fogw-reception-session/reception-service-contribution.json'
COMPRESSED = ORIGINAL + '.gz'
RECEIPT = 'contribution-transport.json'
MAXIMUM_BYTES = 16 * 1024 * 1024


def confined(name):
    path = DIRECTORY / name
    if not isinstance(name, str) or Path(name).is_absolute() or '..' in Path(name).parts:
        raise ValueError('Unsafe contribution transport path')
    path.relative_to(DIRECTORY)
    for item in [path, *path.parents]:
        if item.is_symlink():
            raise ValueError('Symlink transport paths are not supported')
        if item == ROOT:
            break
    path.resolve().relative_to(DIRECTORY.resolve())
    return path


def unique_object(pairs):
    value = {}
    for key, child in pairs:
        if key in value:
            raise ValueError('Duplicate transport receipt field')
        value[key] = child
    return value


def fingerprint(data):
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def validate_record(value, filename):
    if not isinstance(value, dict) or set(value) != {'path', 'bytes', 'sha256'} or value['path'] != filename:
        raise ValueError('Unexpected contribution transport record')
    if type(value['bytes']) is not int or not 0 < value['bytes'] <= MAXIMUM_BYTES:
        raise ValueError('Invalid bounded contribution size')
    if not isinstance(value['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', value['sha256']):
        raise ValueError('Invalid contribution digest')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', nargs='?', choices=['restore', 'verify'], default='restore')
    operation = parser.parse_args().operation
    confined(SCRIPT.name)
    receipt = json.loads(confined(RECEIPT).read_bytes(), object_pairs_hook=unique_object)
    fields = {'schema', 'original', 'compressed', 'gzipMtime', 'roundTripBytesEqual', 'qualification'}
    if not isinstance(receipt, dict) or set(receipt) != fields or receipt['schema'] != 'logos-engine.reception-contribution-transport.v1':
        raise ValueError('Unexpected contribution transport receipt')
    if receipt['gzipMtime'] != 0 or receipt['roundTripBytesEqual'] is not True:
        raise ValueError('Unverified contribution transport declaration')
    validate_record(receipt['original'], ORIGINAL)
    validate_record(receipt['compressed'], COMPRESSED)
    compressed = confined(COMPRESSED).read_bytes()
    expected_compressed = {key: receipt['compressed'][key] for key in ('bytes', 'sha256')}
    if fingerprint(compressed) != expected_compressed or compressed[:3] != b'\x1f\x8b\x08' or compressed[4:8] != b'\x00' * 4:
        raise ValueError('Compressed contribution differs from its receipt')
    # Bound decompression before creating any destination file.
    with gzip.GzipFile(fileobj=io.BytesIO(compressed), mode='rb') as stream:
        data = stream.read(receipt['original']['bytes'] + 1)
    expected_original = {key: receipt['original'][key] for key in ('bytes', 'sha256')}
    if fingerprint(data) != expected_original:
        raise ValueError('Decompressed contribution differs from its original bytes')
    target = confined(ORIGINAL)
    existed = target.exists()
    if existed:
        if target.read_bytes() != data:
            raise ValueError('Existing contribution differs; refusing overwrite')
    elif operation == 'restore':
        # Exclusive creation prevents replacing any existing file.
        with target.open('xb') as stream:
            stream.write(data)
        if fingerprint(target.read_bytes()) != expected_original:
            raise ValueError('Restored contribution failed exact-byte verification')
    print(json.dumps({'operation': operation, 'status': 'passed',
        'path': target.relative_to(ROOT).as_posix(), 'original': expected_original,
        'compressed': expected_compressed, 'restored': operation == 'restore' and not existed,
        'qualification': 'Exact byte reconstruction only; no case analysis or proof execution.'}, indent=2))


if __name__ == '__main__':
    main()
