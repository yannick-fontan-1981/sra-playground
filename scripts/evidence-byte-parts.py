#!/usr/bin/env python3
"""Lossless transport for completed .json.gz evidence inside this repository.

Usage: python scripts/evidence-byte-parts.py pack|verify|restore DIRECTORY
pack splits files larger than 900000 bytes, preserves originals, and adds exact
.gitignore entries only after verified reconstruction. Repeated runs verify and
reuse existing parts; no existing evidence or part is overwritten. restore
creates missing originals exclusively. Run pack only after the writers finish.
Frozen source archives retain their separate archive manifest/restore command.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('original_evidence_parts', ROOT / 'scripts/restore-v53-evidence.py')
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
PART_SIZE = original.PART_SIZE


def confined(path, directory=ROOT):
    path = Path(path)
    if not path.is_absolute():path = ROOT / path
    if '..' in path.parts:raise ValueError('Parent traversal is not supported')
    path.relative_to(directory)
    for item in [path, *path.parents]:
        if item.is_symlink():raise ValueError('Symlink evidence paths are not supported')
        if item == ROOT:break
    path.resolve().relative_to(directory.resolve())
    return path


def files(directory, suffix):
    found = []
    for folder, dirs, names in os.walk(directory, followlinks=False):
        for name in dirs + names:confined(Path(folder) / name, directory)
        found.extend(Path(folder) / name for name in names if name.endswith(suffix))
    return sorted(found)


def unique_object(pairs):
    value = {}
    for key, child in pairs:
        if key in value:raise ValueError('Duplicate manifest key')
        value[key] = child
    return value


def valid_record(value):
    if not isinstance(value, dict) or set(value) != {'file', 'bytes', 'sha256'}:raise ValueError('Invalid byte record')
    name = value['file']
    if not isinstance(name, str) or not name or name in ('.', '..') or any(c in '/\\' or ord(c) < 32 for c in name):raise ValueError('Unsafe evidence filename')
    if type(value['bytes']) is not int or value['bytes'] <= 0:raise ValueError('Invalid evidence size')
    if not isinstance(value['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', value['sha256']):raise ValueError('Invalid evidence digest')


def verify(path, restore=False, directory=ROOT):
    path = confined(path, directory)
    manifest = json.loads(path.read_bytes(), object_pairs_hook=unique_object)
    if not isinstance(manifest, dict) or set(manifest) != {'schema', 'original', 'parts', 'qualification'} or manifest['schema'] != 'logos-engine.evidence-byte-parts.v1':raise ValueError('Invalid byte manifest')
    source = manifest['original'];valid_record(source)
    if not source['file'].endswith('.json.gz') or path.name != source['file'] + '.parts.json':raise ValueError('Manifest does not name its evidence file')
    parts = manifest['parts']
    if not isinstance(parts, list) or len(parts) != (source['bytes'] + PART_SIZE - 1) // PART_SIZE:raise ValueError('Invalid ordered partition count')
    for index, item in enumerate(parts):
        valid_record(item)
        if item['file'] != source['file'] + f'.part{index:03d}' or item['bytes'] != min(PART_SIZE, source['bytes'] - index * PART_SIZE):raise ValueError('Invalid ordered byte partition')
        confined(path.parent / item['file'], directory)
    target = confined(path.parent / source['file'], directory)
    existed = target.exists()
    checked = original.verify(path, restore)
    return {**checked, 'manifest': path.relative_to(ROOT).as_posix(), 'parts': len(parts), 'restored': restore and not existed}


def pack(path, directory=ROOT):
    path = confined(path, directory)
    if not path.name.endswith('.json.gz') or path.stat().st_size <= PART_SIZE:raise ValueError('Pack requires .json.gz evidence larger than one part')
    manifest_path = path.with_name(path.name + '.parts.json')
    if manifest_path.exists() or manifest_path.is_symlink():return verify(manifest_path, directory=directory)
    data = path.read_bytes();source = {'file': path.name, **original.fingerprint(data)};parts = []
    for index, offset in enumerate(range(0, len(data), PART_SIZE)):
        part = confined(path.with_name(path.name + f'.part{index:03d}'), directory)
        payload = data[offset:offset + PART_SIZE]
        if part.exists():
            if part.read_bytes() != payload:raise ValueError('Existing part differs; refusing overwrite')
        else:
            with part.open('xb') as stream:stream.write(payload)
        parts.append(original.record(part))
    if original.record(path) != source:raise ValueError('Evidence changed during packing')
    manifest = {'schema': 'logos-engine.evidence-byte-parts.v1', 'original': source, 'parts': parts,
        'qualification': 'Exact byte partitions of immutable evidence; original data and checksum are unchanged.'}
    confined(manifest_path, directory)
    with manifest_path.open('x') as stream:stream.write(json.dumps(manifest, indent=2) + '\n')
    return verify(manifest_path, directory=directory)


def ignore_verified(verified):
    path = confined(ROOT / '.gitignore')
    prior = path.read_text() if path.exists() else ''
    entries = []
    for item in verified:
        # Escape gitignore metacharacters: every added pattern names one exact
        # repository-relative original, never an extension or directory glob.
        pattern = '/' + ''.join('\\' + c if c in '\\*?[] #!' else c for c in item['path'])
        if pattern not in prior.splitlines() and pattern not in entries:entries.append(pattern)
    if entries:
        with path.open('a') as stream:
            if prior and not prior.endswith('\n'):stream.write('\n')
            stream.write('\n# Exact evidence originals; restore with scripts/evidence-byte-parts.py restore DIRECTORY\n' + '\n'.join(entries) + '\n')
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['pack', 'verify', 'restore'])
    parser.add_argument('directory', help='Existing evidence directory inside this repository')
    args = parser.parse_args();directory = confined(args.directory)
    if not directory.is_dir():raise ValueError('Evidence directory does not exist')
    if args.operation == 'pack':
        for path in files(directory, '.json.gz'):
            if path.stat().st_size > PART_SIZE:pack(path, directory)
    checked = [verify(path, args.operation == 'restore', directory) for path in files(directory, '.json.gz.parts.json')]
    added = ignore_verified(checked) if args.operation == 'pack' else []
    print(json.dumps({'operation': args.operation, 'directory': directory.relative_to(ROOT).as_posix(),
        'partBytes': PART_SIZE, 'verified': checked, 'gitignoreEntriesAdded': added,
        'qualification': 'Exact byte transport only; no agent result is regenerated or reinterpreted.'}, indent=2))


if __name__ == '__main__':main()
