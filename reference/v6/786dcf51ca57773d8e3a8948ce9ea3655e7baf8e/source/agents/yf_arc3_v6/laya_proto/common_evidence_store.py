"""Lossless storage of repeated symbolic evidence. No game or planner dependency.

Each referenced rule/structural part is immutable, addressed by SHA256 of its
JSON value, and committed before its manifest can be published. A manifest is
not an independent copy of the evidence database: both must be preserved.
"""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import zlib


FORMAT = 'v6.symbolic.evidence.v1'
REF = '$symbolic_evidence_sha256'
DATABASE = 'evidence-blobs.sqlite3'


def _bytes(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode('utf8')


def _hash(raw):
    return hashlib.sha256(raw).hexdigest()


class EvidenceStore:
    def __init__(self, root, *, readonly=False):
        self.root = Path(root).resolve()
        self.readonly = readonly
        path = self.root / DATABASE
        if readonly:
            self.db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
        else:
            self.db = sqlite3.connect(path)
            self.db.execute('PRAGMA synchronous=FULL')
            self.db.execute('CREATE TABLE IF NOT EXISTS chunks (digest TEXT PRIMARY KEY, size INTEGER NOT NULL, body BLOB NOT NULL) WITHOUT ROWID')
            self.db.commit()

    def close(self):
        self.db.close()

    def _path(self, path):
        path = Path(path).resolve()
        if path.parent != self.root:
            raise ValueError('Evidence manifest must be a child of its run directory')
        return path

    def _get(self, digest):
        row = self.db.execute('SELECT size, body FROM chunks WHERE digest=?', (digest,)).fetchone()
        if row is None:
            raise ValueError('Missing symbolic evidence: ' + str(digest))
        try:
            raw = zlib.decompress(row[1])
        except zlib.error as exc:
            raise ValueError('Damaged compressed symbolic evidence: ' + str(digest)) from exc
        if len(raw) != row[0] or _hash(raw) != digest:
            raise ValueError('Damaged symbolic evidence: ' + str(digest))
        return json.loads(raw)

    def _put(self, value):
        raw = _bytes(value); digest = _hash(raw)
        if not self.db.execute('SELECT 1 FROM chunks WHERE digest=?', (digest,)).fetchone():
            self.db.execute('INSERT INTO chunks VALUES(?,?,?)', (digest, len(raw), zlib.compress(raw, 1)))
        return {REF: digest}

    def _encode(self, value):
        if isinstance(value, (tuple, list)):
            return [self._encode(item) for item in value]
        if not isinstance(value, dict):
            return value
        if REF in value:
            raise ValueError('Reserved evidence field in input')
        # Expensive, stable structure is shared even when validation changes
        # a rule's status. Selection and mechanism data themselves are unaltered.
        if 'rule_id' in value and 'conditions' in value and 'effect' in value:
            item = {k: self._put({'literal': v}) if k in ('conditions', 'effect') else self._encode(v)
                    for k, v in value.items()}
            return self._put({'encoded': item})
        return {k: self._encode(v) for k, v in value.items()}

    def _decode(self, value, verified, *, materialize):
        if isinstance(value, list):
            if materialize:
                return [self._decode(item, verified, materialize=True) for item in value]
            for item in value: self._decode(item, verified, materialize=False)
            return
        if not isinstance(value, dict):
            return value if materialize else None
        if REF in value:
            if set(value) != {REF}: raise ValueError('Malformed evidence reference')
            digest = value[REF]
            if not materialize and digest in verified: return
            chunk = self._get(digest)
            if set(chunk) == {'literal'}:
                result = chunk['literal'] if materialize else None
            elif set(chunk) == {'encoded'}:
                result = self._decode(chunk['encoded'], verified, materialize=materialize)
            else: raise ValueError('Bad evidence chunk schema')
            verified.add(digest)
            return result
        if materialize:
            return {k: self._decode(v, verified, materialize=True) for k, v in value.items()}
        for v in value.values(): self._decode(v, verified, materialize=False)

    def write(self, path, value):
        if self.readonly: raise ValueError('Read-only evidence store')
        path = self._path(path)
        if path.exists(): raise FileExistsError(path)
        with self.db:
            document = self._encode(value)
        envelope = {'format': FORMAT, 'database': DATABASE, 'root_sha256': _hash(_bytes(document)), 'document': document}
        # The immutable dependencies are committed before this record. A crash
        # can leave unreferenced chunks or an incomplete record, never a permit.
        with path.open('xb') as stream:
            stream.write(_bytes(envelope)); stream.flush(); os.fsync(stream.fileno())

    def _document(self, path):
        item = json.loads(self._path(path).read_bytes())
        if item.get('format') != FORMAT or item.get('database') != DATABASE:
            raise ValueError('Unexpected evidence manifest format')
        if _hash(_bytes(item['document'])) != item.get('root_sha256'):
            raise ValueError('Invalid evidence manifest digest')
        return item['document']

    def verify(self, path):
        verified = set()
        if self._decode(self._document(path), verified, materialize=False) is not None:
            raise ValueError('Invalid verification result')
        return {'verified_chunks': len(verified)}

    def read(self, path):
        return self._decode(self._document(path), set(), materialize=True)
