"""Exact canonical SHA for a mapping whose rows share immutable children."""
from collections import Counter
import hashlib
from json.encoder import encode_basestring_ascii

from agents.yf_arc3_v5.logos.types import FrozenMap, canonical_json, stable_digest


def shared_row_binding_digest(value: FrozenMap, rows_field: str) -> str:
    """Stream the existing JSON bytes, encoding repeated row children once.

    Exact scalar fragments and shared immutable children are encoded once per
    invocation. Other children stay on the canonical JSON encoder. Neither a
    new hash format nor a persistent history cache is introduced. Non-row
    envelopes use the ordinary canonical digest.
    """
    if value._digest is not None:
        return value._digest
    rows = value.get(rows_field)
    if (not isinstance(rows, FrozenMap) or len(rows) < 2
            or any(not isinstance(row, FrozenMap) for _, row in rows.canonical_items())):
        return stable_digest(value)
    occurrences = Counter(id(child) for _, row in rows.canonical_items()
                          for _, child in row.canonical_items()
                          if isinstance(child, (FrozenMap, tuple)))
    shared_ids = {identity for identity, count in sorted(occurrences.items()) if count > 1}
    if not shared_ids:
        return stable_digest(value)
    fragments = {}
    scalar_fragments = {}
    key_fragments = {}
    digest = hashlib.sha256()

    def encoded_value(child):
        # Exact scalar types only: bool/int and signed floating zero must not
        # alias. Float/model/other values retain the canonical encoder.
        kind = type(child)
        if child is None or kind in (str, bool, int):
            key = (kind, child)
            encoded = scalar_fragments.get(key)
            if encoded is None:
                encoded = (b'null' if child is None else
                           encode_basestring_ascii(child).encode('ascii') if kind is str else
                           b'true' if child is True else b'false' if child is False else
                           str(child).encode('ascii'))
                scalar_fragments[key] = encoded
            return encoded
        identity = id(child)
        if identity not in shared_ids:
            return canonical_json(child).encode('utf-8')
        encoded = fragments.get(identity)
        if encoded is None:
            encoded = canonical_json(child).encode('utf-8')
            fragments[identity] = encoded
        return encoded

    def encoded_key(key):
        encoded = key_fragments.get(key)
        if encoded is None:
            encoded = encode_basestring_ascii(key).encode('utf-8') + b':'
            key_fragments[key] = encoded
        return encoded

    def feed_row(row):
        # Bound the temporary buffer to one row. Joining exact fragments avoids
        # a Python-to-hash call for every punctuation mark and field value;
        # neither the complete envelope nor growing history is buffered here.
        parts = [b'{']
        for ordinal, (key, child) in enumerate(row.canonical_items()):
            if ordinal:
                parts.append(b',')
            parts.append(encoded_key(key))
            parts.append(encoded_value(child))
        parts.append(b'}')
        digest.update(b''.join(parts))

    digest.update(b'{')
    for ordinal, (key, child) in enumerate(value.canonical_items()):
        if ordinal:
            digest.update(b',')
        digest.update(encoded_key(key))
        if key != rows_field:
            digest.update(encoded_value(child))
            continue
        digest.update(b'{')
        for row_ordinal, (ref, row) in enumerate(rows.canonical_items()):
            if row_ordinal:
                digest.update(b',')
            digest.update(encoded_key(ref))
            feed_row(row)
        digest.update(b'}')
    digest.update(b'}')
    value._digest = digest.hexdigest()
    return value._digest
