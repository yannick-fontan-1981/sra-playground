/** Small offline checks only: serializer, gzip transport and atomic publication.
 * No campaign, game, original agent or native runtime is imported or executed.
 * Temporary test files are removed; the small result is written to stdout.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { MAX_JSON_CHUNK_BYTES, writeStreamedEvidenceGzip } from './write-streamed-evidence-gzip.mjs';

const SMALL_LIMIT_BYTES = 262_144;
const cases = [
  ['report_fields', () => ({ schema: 'example', status: 'passed', initial: { level: 1 },
    actions: [{ command: { action_ref: 'ACTION6', data: { x: 2, y: 3 } }, frame: [0, 1, 2] }],
    prefixes: [{ acquiredActions: 1, source: { repeated: [1, 1, null] } }],
    final: { levelsCompleted: 1, reason: null }, absent: undefined })],
  ['empty_values', () => ({ object: {}, array: [], text: '', nil: null, yes: true, no: false })],
  ['property_order', () => {
    const value = Object.create(null);
    for (const [key, entry] of [['b', 1], ['10', 10], ['2', 2], ['01', 1], ['a', 3], ['__proto__', 4]]) value[key] = entry;
    Object.defineProperty(value, 'hidden', { value: 9 }); value[Symbol('ignored')] = 10;
    return value;
  }],
  ['array_and_object_omissions', () => ({ absent: undefined, fn() {}, symbol: Symbol('ignored'),
    values: [undefined, , () => 1, Symbol('ignored'), null] })],
  ['numbers', () => [-0, NaN, Infinity, -Infinity, 0, 1e-7, 1e20, 1e21, Number.MIN_VALUE, Number.MAX_VALUE]],
  ['unicode_chunk_boundaries', () => ({ text: 'a'.repeat(2_047) + '\u{1f603}' + '\ud800x\udc00'
    + '\u0000\n\r\t\b\f"\\/\u2028\u2029' + '中文'.repeat(10_000), controls: '\u0000'.repeat(5_000) })],
  ['multiple_chunks', () => ({ text: 'x'.repeat(131_072), last: 'complete' })],
  ['shared_acyclic_reference', () => { const shared = { values: [1, 2, 3] }; return { first: shared, second: shared }; }],
  ['getter_tojson_order', log => {
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
];
const directory = await mkdtemp(join(tmpdir(), 'lot8a-streamed-evidence-check-'));
const report = {
  schema: 'logos-engine.lot8a.streamed-evidence-gzip-check.v1', status: 'failed',
  gameHostRun: false, nativeAgentRun: false, originalComponentRun: false,
  harnessImported: false, smallLimitBytes: SMALL_LIMIT_BYTES, cases: [], errors: [],
  qualification: 'Small JSON byte-equality, complete gzip output and failure-publication checks only. '
    + 'This does not execute a game, qualify the eleven regressions, prove total report memory bounds or measure performance.',
};

async function absent(path) {
  await assert.rejects(lstat(path), error => error.code === 'ENOENT');
}
async function noTemporaryFiles() {
  assert.equal((await readdir(directory)).filter(name => name.includes('.inprogress-')).length, 0);
}
try {
  for (const [name, make] of cases) {
    const nativeLog = [], expected = Buffer.from(JSON.stringify(make(nativeLog)) + '\n', 'utf8');
    assert(expected.length <= SMALL_LIMIT_BYTES);
    const actualLog = [], output = join(directory, `${name}.json.gz`);
    const result = await writeStreamedEvidenceGzip(output, make(actualLog));
    const compressed = await readFile(output), raw = gunzipSync(compressed);
    assert(raw.equals(expected), `${name}: complete JSON bytes differ`);
    assert.deepEqual(actualLog, nativeLog, `${name}: getter/toJSON order differs`);
    assert.equal(result.rawBytes, expected.length);
    assert.equal(result.rawSha256, createHash('sha256').update(expected).digest('hex'));
    assert.equal(result.gzipBytes, compressed.length);
    assert(result.chunks > 0 && result.maximumChunkBytes <= MAX_JSON_CHUNK_BYTES);
    await noTemporaryFiles();
    report.cases.push({ name, passed: true, bytes: raw.length, ...result });
  }

  const marker = new Error('expected getter or toJSON failure');
  const failingCases = [
    ['ancestor_cycle', () => { const value = {}; value.self = value; return value; }, TypeError],
    ['array_cycle', () => { const value = []; value.push(value); return value; }, TypeError],
    ['bigint', () => ({ unsupported: 1n }), TypeError],
    ['undefined_root', () => undefined, TypeError],
    ['getter_after_partial_bytes', () => {
      const value = { first: 'x'.repeat(65_536) };
      Object.defineProperty(value, 'later', { enumerable: true, get() { throw marker; } });
      return value;
    }, marker],
    ['tojson_error', () => ({ toJSON() { throw marker; } }), marker],
  ];
  for (const [name, make, expected] of failingCases) {
    const output = join(directory, `${name}.json.gz`);
    await assert.rejects(writeStreamedEvidenceGzip(output, make()), error =>
      typeof expected === 'function' ? error instanceof expected : error === expected);
    await absent(output); await noTemporaryFiles();
    report.errors.push({ name, passed: true, noFinalReport: true, temporaryRemoved: true });
  }

  const existing = join(directory, 'existing.json.gz'), sentinel = Buffer.from('retained exact bytes');
  await writeFile(existing, sentinel, { flag: 'wx' });
  await assert.rejects(writeStreamedEvidenceGzip(existing, { replacement: true }), error => error.code === 'EEXIST');
  assert((await readFile(existing)).equals(sentinel)); await noTemporaryFiles();
  report.errors.push({ name: 'existing_report_unchanged', passed: true });

  const racing = join(directory, 'racing.json.gz');
  const choices = [{ contender: 'a', text: 'a'.repeat(65_536) }, { contender: 'b', text: 'b'.repeat(65_536) }];
  const outcomes = await Promise.allSettled(choices.map(value => writeStreamedEvidenceGzip(racing, value)));
  assert.equal(outcomes.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(value => value.status === 'rejected' && value.reason.code === 'EEXIST').length, 1);
  const winner = outcomes.findIndex(value => value.status === 'fulfilled');
  assert(gunzipSync(await readFile(racing)).equals(Buffer.from(JSON.stringify(choices[winner]) + '\n')));
  await noTemporaryFiles();
  report.errors.push({ name: 'concurrent_final_path_no_replace', passed: true });

  const controller = new AbortController(), aborted = join(directory, 'aborted.json.gz');
  const aborting = { first: 'x'.repeat(65_536) };
  Object.defineProperty(aborting, 'later', { enumerable: true, get() {
    // External cancellation occurs between chunks, not reentrantly inside a
    // synchronous generator's next() call (which Node reports as AggregateError).
    queueMicrotask(() => controller.abort());
    return 'uncommitted';
  } });
  await assert.rejects(writeStreamedEvidenceGzip(aborted, aborting, { signal: controller.signal }), error => error.name === 'AbortError');
  await absent(aborted); await noTemporaryFiles();
  report.errors.push({ name: 'abort_after_partial_bytes', passed: true, noFinalReport: true, temporaryRemoved: true });

  report.status = 'passed';
  report.passedCases = report.cases.length;
  report.passedErrors = report.errors.length;
} finally {
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
