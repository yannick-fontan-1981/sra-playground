/** Bounded JSON evidence output, without a whole-document string or Buffer.
 * No replacer or indentation is applied. Standard JSON.stringify semantics
 * determine property order, omissions, array nulls, numbers and string escapes.
 * Repeated references are serialized repeatedly; only ancestor cycles fail.
 * A top-level undefined/function/symbol produces no JSON bytes, like the
 * undefined result of JSON.stringify. Evidence callers supply object roots.
 */
import { writeSync } from 'node:fs';
import { types } from 'node:util';

// A chunk contains at most this many UTF-16 units. UTF-8 uses at most three
// bytes per unit, so every emitted Buffer is at most 49,152 bytes. String
// escapes are generated from smaller slices and never split a surrogate pair.
const CHUNK_CHAR_LIMIT = 16_384;
const STRING_SLICE_UNITS = 2_048;
const omitted = value => value === undefined || typeof value === 'function' || typeof value === 'symbol';

function sourceValue(value, key) {
  const kind = typeof value;
  if (value !== null && (kind === 'object' || kind === 'function' || kind === 'bigint')) {
    const toJSON = value.toJSON;
    if (typeof toJSON === 'function') value = Reflect.apply(toJSON, value, [key]);
  }
  // JSON.stringify unboxes these four built-in wrapper kinds after toJSON.
  // The util predicates inspect the internal kind without reading a spoofable
  // Symbol.toStringTag or depending on the object's realm/prototype chain.
  if (value !== null && typeof value === 'object') {
    if (types.isNumberObject(value)) value = +value;
    else if (types.isStringObject(value)) value = String(value);
    else if (types.isBooleanObject(value)) value = Reflect.apply(Boolean.prototype.valueOf, value, []);
    else if (types.isBigIntObject(value)) value = Reflect.apply(BigInt.prototype.valueOf, value, []);
  }
  return value;
}

function* stringSlices(value) {
  for (let start = 0; start < value.length;) {
    let end = Math.min(start + STRING_SLICE_UNITS, value.length);
    if (end < value.length) {
      const left = value.charCodeAt(end - 1), right = value.charCodeAt(end);
      if (left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff) end--;
    }
    yield value.slice(start, end);
    start = end;
  }
}

function* quotedString(value) {
  yield '"';
  for (const part of stringSlices(value)) {
    // Delegate escaping, including lone surrogates, to the native serializer.
    const encoded = JSON.stringify(part);
    yield encoded.slice(1, -1);
  }
  yield '"';
}

function arrayLength(value) {
  // LengthOfArrayLike/ToLength, including a proxy's actual length getter.
  const length = +value.length;
  if (Number.isNaN(length) || length <= 0) return 0;
  return Math.min(Math.floor(length), Number.MAX_SAFE_INTEGER);
}

function* jsonTokens(input) {
  let value = sourceValue(input, '');
  if (omitted(value)) return;
  const frames = [], ancestors = new Set();
  let pendingValue = true;
  while (pendingValue || frames.length) {
    if (pendingValue) {
      pendingValue = false;
      if (value === null) { yield 'null'; continue; }
      const kind = typeof value;
      if (kind === 'string') { yield* quotedString(value); continue; }
      if (kind === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
      if (kind === 'number' || kind === 'boolean') {
        // Native number formatting preserves -0, nonfinite nulls and exponent
        // spelling. BigInt is rejected above after exactly one toJSON call.
        yield JSON.stringify(value);
        continue;
      }
      if (typeof JSON.isRawJSON === 'function' && JSON.isRawJSON(value)) {
        yield* stringSlices(value.rawJSON);
        continue;
      }
      if (ancestors.has(value)) throw new TypeError('Converting circular structure to JSON');
      ancestors.add(value);
      if (Array.isArray(value)) {
        frames.push({ kind: 'array', value, index: 0, length: arrayLength(value) });
        yield '[';
      } else {
        // Snapshot enumerable own string keys once, then read each value at
        // its turn. This retains native key order and getter/toJSON ordering.
        frames.push({ kind: 'object', value, keys: Object.keys(value), index: 0, first: true });
        yield '{';
      }
      continue;
    }

    const frame = frames[frames.length - 1];
    if (frame.kind === 'array') {
      if (frame.index === frame.length) {
        frames.pop(); ancestors.delete(frame.value); yield ']';
        continue;
      }
      if (frame.index) yield ',';
      const key = String(frame.index++);
      value = sourceValue(frame.value[key], key);
      if (omitted(value)) value = null;
      pendingValue = true;
      continue;
    }

    while (frame.index < frame.keys.length) {
      const key = frame.keys[frame.index++];
      value = sourceValue(frame.value[key], key);
      if (omitted(value)) continue;
      if (!frame.first) yield ',';
      frame.first = false;
      yield* quotedString(key);
      yield ':';
      pendingValue = true;
      break;
    }
    if (!pendingValue) {
      frames.pop(); ancestors.delete(frame.value); yield '}';
    }
  }
}

/** Synchronous iterable of small UTF-8 Buffers, suitable for a backpressured
 * Readable.from(..., { objectMode: false }) and a streaming gzip pipeline.
 * Getter, toJSON, cycle and scalar errors propagate to the consuming writer.
 */
export function* evidenceJsonChunks(value, { trailingNewline = false } = {}) {
  let pending = '', present = false;
  for (const token of jsonTokens(value)) {
    present = true;
    if (pending.length + token.length > CHUNK_CHAR_LIMIT) {
      if (pending) yield Buffer.from(pending, 'utf8');
      pending = '';
    }
    pending += token;
  }
  if (present && trailingNewline) {
    if (pending.length === CHUNK_CHAR_LIMIT) {
      yield Buffer.from(pending, 'utf8'); pending = '';
    }
    pending += '\n';
  }
  if (pending) yield Buffer.from(pending, 'utf8');
}

/** Write the complete serialization synchronously without retaining it.
 * The caller owns open/fsync/close and commits a temporary file only on success.
 * A partial write is retried; an exception or a zero-progress write is fatal.
 */
export function writeEvidenceJsonSync(fd, value, options) {
  let total = 0;
  for (const chunk of evidenceJsonChunks(value, options)) {
    for (let offset = 0; offset < chunk.length;) {
      const written = writeSync(fd, chunk, offset, chunk.length - offset);
      if (written <= 0) throw new Error('Evidence JSON write made no progress');
      offset += written; total += written;
    }
  }
  return total;
}
