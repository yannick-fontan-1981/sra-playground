/** Offline writer diagnostic only. Run after explicit quiet release through
 * the case-clock diagnostic wrapper, with its single shared external deadline.
 * Application imports are limited to the evidence serializer. No harness,
 * agent, game, original component or native runtime is imported or executed.
 */
import assert from 'node:assert/strict';
import { closeSync, existsSync, fstatSync, fsyncSync, linkSync, mkdtempSync,
  openSync, readFileSync, readSync, realpathSync, rmSync, statSync, unlinkSync,
  writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip, createGzip } from 'node:zlib';
import { evidenceJsonChunks, writeEvidenceJsonSync } from './stream-evidence-json.mjs';

const SELF = fileURLToPath(import.meta.url), BASE = realpathSync(dirname(SELF));
const ROOT = realpathSync(resolve(BASE, '../../..'));
const MAX_CHUNK_BYTES = 49_152, SMALL_LIMIT_BYTES = 262_144;
const startedAt = new Date().toISOString(), started = performance.now();
const names = ['--checkpoint', '--execution-receipt', '--output'];
const args = process.argv.slice(2), options = new Map();
assert.equal(args.length, 6, 'Expected --checkpoint RAW_JSON --execution-receipt EXECUTION_JSON --output NEW_JSON');
for (let index = 0; index < args.length; index += 2) {
  assert(names.includes(args[index]) && !options.has(args[index]), 'Unknown or repeated diagnostic argument');
  options.set(args[index], args[index + 1]);
}
function inside(value, fresh = false) {
  assert.equal(typeof value, 'string', 'Missing diagnostic path');
  const path = resolve(ROOT, value), child = relative(ROOT, path);
  assert(child && child !== '..' && !child.startsWith(`..${sep}`), 'Diagnostic path escapes the checkout');
  assert.equal(realpathSync(fresh ? dirname(path) : path), fresh ? dirname(path) : path, 'Use canonical existing input/parent paths');
  return path;
}
const checkpointPath = inside(options.get('--checkpoint'));
const executionPath = inside(options.get('--execution-receipt'));
const output = inside(options.get('--output'), true), outputChild = relative(BASE, output);
assert(outputChild && outputChild !== '..' && !outputChild.startsWith(`..${sep}`)
  && output.endsWith('.json') && !existsSync(output), 'Use a new JSON receipt below lot10b-evidence');
assert(checkpointPath.endsWith('.json'), 'This diagnostic uses the retained raw checkpoint JSON, not a gzip or reconstructed report');

function stamp(stat) {
  return Object.fromEntries(['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'].map(key => [key, String(stat[key])]));
}
function fingerprint(path) {
  const hash = createHash('sha256'), scratch = Buffer.allocUnsafe(65_536), fd = openSync(path, 'r');
  let bytes = 0;
  try {
    for (;;) {
      const length = readSync(fd, scratch, 0, scratch.length, null);
      if (!length) break;
      hash.update(scratch.subarray(0, length)); bytes += length;
    }
  } finally { closeSync(fd); }
  return { path: relative(ROOT, path), bytes, sha256: hash.digest('hex') };
}
function memory() {
  return { ...process.memoryUsage(), processLifetimeMaxRssBytes: process.resourceUsage().maxRSS * 1024 };
}
function stage(name, extra = {}) {
  const row = { event: name, recordedAt: new Date().toISOString(), elapsedMs: performance.now() - started, memory: memory(), ...extra };
  process.stdout.write(`${JSON.stringify(row)}\n`);
  return row;
}
function errorValue(error) {
  return { name: error instanceof Error ? error.name : typeof error,
    message: String(error instanceof Error ? error.message : error).slice(0, 4_096) };
}
function writeReceipt(value) {
  const temporary = `${output}.inprogress-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  const fd = openSync(temporary, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
  linkSync(temporary, output); unlinkSync(temporary);
  const folder = openSync(dirname(output), 'r');
  try { fsyncSync(folder); } finally { closeSync(folder); }
}

// These small cases intentionally include behavior absent from parsed JSON.
// Each path receives a fresh value, so getters/toJSON are not reused after the
// native reference serializer has already changed their object.
const smallCases = [
  ['empty_values', () => ({ object: {}, array: [], text: '', truth: true, falsehood: false, nil: null })],
  ['property_order', () => {
    const value = Object.create(null);
    for (const [key, entry] of [['b', 1], ['10', 10], ['2', 2], ['01', 1], ['a', 3], ['__proto__', 4]]) value[key] = entry;
    Object.defineProperty(value, 'hidden', { value: 9 }); value[Symbol('ignored')] = 10;
    return value;
  }],
  ['omissions_and_sparse_arrays', () => ({ missing: undefined, fn() {}, symbol: Symbol('ignored'),
    values: [undefined, , () => 1, Symbol('ignored'), null] })],
  ['numbers', () => [-0, NaN, Infinity, -Infinity, 0, 1e-7, 1e20, 1e21, Number.MIN_VALUE, Number.MAX_VALUE]],
  ['unicode_and_escaping', () => ({
    text: 'a'.repeat(2_047) + '\u{1f603}' + '\ud800' + '\udc00' + '\u0000\n\r\t\b\f"\\/\u2028\u2029' + '中文'.repeat(10_000),
    controls: '\u0000'.repeat(5_000),
    ['k'.repeat(2_047) + '\u{1f603}' + '\ud800']: 'value',
  })],
  ['buffer_boundaries', () => ['x'.repeat(50_000), 'a'.repeat(16_383) + '\u{1f603}', '\ud800x\udc00']],
  ['shared_acyclic_reference', () => { const shared = { values: [1, 2, 3] }; return { first: shared, second: shared }; }],
  ['to_json_keys_and_function', log => {
    const callable = () => 0;
    callable.toJSON = key => { log.push(`function:${key}`); return 7; };
    return { toJSON(key) { log.push(`root:${key}`); return { callable,
      values: [{ toJSON(key) { log.push(`element:${key}`); return { okay: true }; } }] }; } };
  }],
  ['getter_and_key_snapshot', log => {
    const value = {};
    Object.defineProperty(value, 'a', { enumerable: true, get() {
      log.push('get:a'); delete value.b; value.later = 3;
      return { toJSON(key) { log.push(`toJSON:${key}`); return 'A'; } };
    } });
    value.b = 2;
    return value;
  }],
  ['native_wrappers', () => [new Number(-0), new String('wrapped'), new Boolean(false),
    new Date('2020-01-02T03:04:05.000Z'), new Date(NaN), new Uint8Array([1, 2])]],
  ['root_undefined', () => undefined],
  ['root_symbol', () => Symbol('root')],
  ['root_function', () => function root() {}],
];
if (typeof JSON.rawJSON === 'function') smallCases.push(['native_raw_json', () => ({ raw: JSON.rawJSON('12345678901234567890') })]);

function checkSmallCases(directory) {
  const passed = [];
  for (const [name, make] of smallCases) {
    for (const trailingNewline of [false, true]) {
      const nativeLog = [], native = JSON.stringify(make(nativeLog));
      const expected = Buffer.from(native === undefined ? '' : native + (trailingNewline ? '\n' : ''), 'utf8');
      assert(expected.length <= SMALL_LIMIT_BYTES, 'Small corpus unexpectedly exceeds its declared bound');
      const chunkLog = [], chunks = [], value = make(chunkLog);
      let bytes = 0;
      for (const chunk of evidenceJsonChunks(value, { trailingNewline })) {
        assert(Buffer.isBuffer(chunk) && chunk.length > 0 && chunk.length <= MAX_CHUNK_BYTES, 'Invalid emitted Buffer size');
        bytes += chunk.length; assert(bytes <= SMALL_LIMIT_BYTES, 'Small-case output exceeded its bound'); chunks.push(chunk);
      }
      assert(Buffer.concat(chunks).equals(expected), `Small iterator byte mismatch: ${name}`);
      assert.deepEqual(chunkLog, nativeLog, `Iterator getter/toJSON order: ${name}`);
      const path = resolve(directory, `${passed.length}.json`), fd = openSync(path, 'wx', 0o600), writeLog = [];
      let written;
      try { written = writeEvidenceJsonSync(fd, make(writeLog), { trailingNewline }); }
      finally { closeSync(fd); }
      assert.equal(written, expected.length, `Synchronous byte count: ${name}`);
      assert(readFileSync(path).equals(expected), `Synchronous file byte mismatch: ${name}`);
      assert.deepEqual(writeLog, nativeLog, `Synchronous getter/toJSON order: ${name}`);
      passed.push({ name, trailingNewline, bytes: written, iteratorEqual: true, synchronousFileEqual: true });
    }
  }
  return passed;
}

function captured(operation) { try { operation(); return { threw: false }; } catch (error) { return { threw: true, error }; } }
function drainSmall(value) {
  let bytes = 0;
  for (const chunk of evidenceJsonChunks(value)) {
    bytes += chunk.length; assert(bytes <= SMALL_LIMIT_BYTES, 'Expected-error case exceeded its bound');
  }
}
function checkErrors(directory) {
  const marker = new Error('original getter/toJSON marker');
  const cases = [
    ['ancestor_cycle', () => { const value = {}; value.self = value; return value; }],
    ['array_cycle', () => { const value = []; value.push(value); return value; }],
    ['bigint', () => ({ unsupported: 1n })],
    ['bigint_to_json_once', log => { const value = Object(1n); value.toJSON = key => { log.push(key); return 1n; }; return { value }; }],
    ['getter_error_identity', () => Object.defineProperty({}, 'value', { enumerable: true, get() { throw marker; } }), true],
    ['to_json_error_identity', () => ({ toJSON() { throw marker; } }), true],
  ];
  const passed = [];
  for (const [name, make, sameIdentity] of cases) {
    const nativeLog = [], native = captured(() => JSON.stringify(make(nativeLog)));
    assert(native.threw, `Reference error case did not throw: ${name}`);
    for (const mode of ['iterator', 'sync_writer']) {
      const log = [], path = resolve(directory, `error-${passed.length}.json`), fd = openSync(path, 'wx', 0o600);
      let actual;
      try { actual = captured(() => mode === 'iterator' ? drainSmall(make(log)) : writeEvidenceJsonSync(fd, make(log))); }
      finally { closeSync(fd); }
      assert(actual.threw, `Serializer swallowed an error: ${name}/${mode}`);
      if (sameIdentity) assert.equal(actual.error, marker, `Original error identity: ${name}/${mode}`);
      else assert.equal(actual.error?.constructor, native.error?.constructor, `Serialization error kind: ${name}/${mode}`);
      assert.deepEqual(log, nativeLog, `Failing toJSON call order: ${name}/${mode}`);
      passed.push({ name, mode, originalErrorPropagated: true, errorName: actual.error?.name ?? typeof actual.error });
    }
  }
  const readonly = openSync(resolve(directory, '0.json'), 'r');
  try {
    const result = captured(() => writeEvidenceJsonSync(readonly, { write: 'must fail' }));
    assert(result.threw && result.error?.code === 'EBADF', 'An actual write failure was not propagated');
    passed.push({ name: 'readonly_descriptor', mode: 'sync_writer', originalErrorPropagated: true, errorCode: result.error.code });
  } finally { closeSync(readonly); }
  return passed;
}

function byteComparator(fd, expected, label) {
  const scratch = Buffer.allocUnsafe(65_536), hash = createHash('sha256');
  let offset = 0, chunks = 0, maximumChunkBytes = 0;
  return {
    accept(chunk) {
      assert(Buffer.isBuffer(chunk) && chunk.length > 0 && chunk.length <= scratch.length, `${label}: invalid chunk`);
      let length = 0;
      while (length < chunk.length) {
        const read = readSync(fd, scratch, length, chunk.length - length, offset + length);
        assert(read > 0, `${label}: generated bytes extend past original EOF at ${offset + length}`);
        length += read;
      }
      const original = scratch.subarray(0, length);
      if (!chunk.equals(original)) {
        let index = 0;
        while (index < length && chunk[index] === original[index]) index++;
        throw new Error(`${label}: byte mismatch at absolute offset ${offset + index}`);
      }
      // Hash the original bytes actually compared, not a copied expected hash.
      hash.update(original); offset += length; chunks++; maximumChunkBytes = Math.max(maximumChunkBytes, length);
    },
    finish() {
      assert.equal(offset, expected.bytes, `${label}: incomplete byte count`);
      assert.equal(readSync(fd, scratch, 0, 1, offset), 0, `${label}: unconsumed original bytes`);
      const originalSha256 = hash.digest('hex');
      assert.equal(originalSha256, expected.sha256, `${label}: compared original differs from the retained execution receipt`);
      return { equalByteForByte: true, bytes: offset, exactEof: true, chunks, maximumChunkBytes, originalSha256 };
    },
  };
}

const sourcePaths = {
  verifier: SELF, serializer: resolve(BASE, 'stream-evidence-json.mjs'),
  runnerReadOnly: resolve(BASE, 'run-hpdl-campaign.mjs'), checkpoint: checkpointPath, executionReceipt: executionPath,
};
const report = {
  schema: 'logos-engine.lot10b.stream-evidence-json-check.v1', status: 'running', startedAt,
  gameHostRun: false, nativeAgentRun: false, originalComponentRun: false, harnessImported: false,
  nodeVersion: process.version, execArgv: process.execArgv, pid: process.pid,
  byteComparisonMethod: 'Direct positional comparison against every retained original byte, including the trailing newline, followed independently by gzip/gunzip output comparison against the same original file.',
  qualification: 'One serialization traversal of one retained partial checkpoint. This establishes neither game success, the cause of SIGKILL, total campaign capture cost nor a bound on production process RSS. The parent diagnostic clock owns the complete interval and timeout accounting.',
};
let checkpointFd = null, smallDirectory = null;
try {
  report.started = stage('writer_diagnostic_started');
  report.inputsBefore = Object.fromEntries(Object.entries(sourcePaths).map(([key, path]) => [key, fingerprint(path)]));
  const execution = JSON.parse(readFileSync(executionPath, 'utf8'));
  assert.equal(execution.schema, 'logos-engine.lot10b.hpdl-clocked-execution.v1');
  assert.equal(execution.game, 'HPDL');
  const expected = execution.artifacts?.[basename(checkpointPath)];
  assert.deepEqual(report.inputsBefore.checkpoint, expected, 'Use the exact raw checkpoint retained by the actual execution');
  smallDirectory = mkdtempSync(resolve(tmpdir(), 'window-stream-json-check-'));
  report.smallCases = checkSmallCases(smallDirectory);
  report.errorCases = checkErrors(smallDirectory);
  rmSync(smallDirectory, { recursive: true }); smallDirectory = null;
  report.afterSmallCases = stage('small_cases_completed', { cases: report.smallCases.length, errors: report.errorCases.length });

  checkpointFd = openSync(checkpointPath, 'r');
  const statBefore = stamp(fstatSync(checkpointFd, { bigint: true }));
  const parseStarted = performance.now();
  // The temporary UTF-8 string is not retained in another variable. No raw
  // whole-file Buffer or JSON.stringify(checkpoint) is kept beside the object.
  let checkpoint = JSON.parse(readFileSync(checkpointFd, 'utf8'));
  report.parseElapsedMs = performance.now() - parseStarted;
  assert.equal(checkpoint.schema, 'logos-engine.lot10b.hpdl-campaign-checkpoint.v1');
  assert.equal(checkpoint.game, 'HPDL'); assert.equal(checkpoint.completeCampaign, false);
  assert.equal(checkpoint.report?.status, 'running'); assert(!Object.hasOwn(checkpoint.report, 'final'));
  const observed = execution.capture?.lastCheckpoint;
  assert.equal(checkpoint.sequence, observed?.sequence);
  assert.equal(checkpoint.recordedAt, observed?.recordedAt);
  assert.equal(checkpoint.report.actions.length, observed?.recordedActions);
  assert.equal(checkpoint.report.prefixes.length, observed?.recordedPrefixes);
  report.partialInput = { sequence: checkpoint.sequence, recordedAt: checkpoint.recordedAt,
    actions: checkpoint.report.actions.length, prefixes: checkpoint.report.prefixes.length,
    campaignStatus: checkpoint.report.status, finalFieldsAdded: false };
  report.afterParse = stage('checkpoint_parsed');
  assert.equal(typeof global.gc, 'function', 'Use --expose-gc for this isolated diagnostic');
  global.gc();
  report.beforeSerialization = stage('checkpoint_before_serialization', { diagnosticGcBeforeTraversal: true });
  const direct = byteComparator(checkpointFd, expected, 'direct serializer');
  const roundtrip = byteComparator(checkpointFd, expected, 'gzip round trip');
  let directResult, compressedBytes = 0;
  function* checkedChunks() {
    for (const chunk of evidenceJsonChunks(checkpoint, { trailingNewline: true })) {
      assert(chunk.length <= MAX_CHUNK_BYTES, 'Serializer exceeded the declared Buffer bound');
      direct.accept(chunk);
      // The helper allocated this Buffer. Do not reuse or mutate it while the
      // downstream pipeline may still hold it under backpressure.
      yield chunk;
    }
    directResult = direct.finish();
  }
  const serializationStarted = performance.now();
  await pipeline(
    Readable.from(checkedChunks(), { objectMode: false }),
    createGzip({ mtime: 0 }),
    new Transform({ transform(chunk, _encoding, callback) { compressedBytes += chunk.length; callback(null, chunk); } }),
    createGunzip(),
    new Writable({ write(chunk, _encoding, callback) {
      try { roundtrip.accept(chunk); callback(); } catch (error) { callback(error); }
    } }),
  );
  const roundtripResult = roundtrip.finish();
  assert(directResult, 'The raw generator did not reach its actual EOF');
  report.bytesComparisons = { direct: directResult, gzipRoundTrip: roundtripResult,
    gzipAndGunzipCompleted: true, compressedBytes, generatorTraversals: 1,
    hugeOutputCollected: false, hugeOutputFileCreated: false,
    serializationAndRoundTripElapsedMs: performance.now() - serializationStarted };
  report.afterSerialization = stage('checkpoint_bytes_verified', { bytes: directResult.bytes, compressedBytes });
  checkpoint = null; global.gc();
  assert.deepEqual(stamp(fstatSync(checkpointFd, { bigint: true })), statBefore, 'The opened original changed during comparison');
  assert.deepEqual(stamp(statSync(checkpointPath, { bigint: true })), statBefore, 'The retained checkpoint path changed during comparison');
  report.originalFileStatBeforeAndAfter = statBefore;
  closeSync(checkpointFd); checkpointFd = null;
  report.inputsAfter = Object.fromEntries(Object.entries(sourcePaths).map(([key, path]) => [key, fingerprint(path)]));
  assert.deepEqual(report.inputsAfter, report.inputsBefore, 'A diagnostic source/input changed');
  report.inputsUnchanged = true;
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = errorValue(error); process.exitCode = 1;
} finally {
  if (checkpointFd !== null) closeSync(checkpointFd);
  if (smallDirectory !== null) rmSync(smallDirectory, { recursive: true, force: true });
}
report.completedAt = new Date().toISOString();
report.elapsedMsInsideChild = performance.now() - started;
report.finalMemory = memory();
report.memoryQualification = 'Before/after samples and lifetime process max RSS include parsing and this offline diagnostic. They are not a production per-checkpoint peak or an explanation of the earlier SIGKILL. Explicit GC is confined to this diagnostic; production allocation is unchanged.';
writeReceipt(report);
process.stdout.write(`${JSON.stringify({ event: 'writer_diagnostic_completed', status: report.status,
  output: relative(ROOT, output), elapsedMsInsideChild: report.elapsedMsInsideChild,
  bytesComparisons: report.bytesComparisons ?? null, error: report.error ?? null })}\n`);
