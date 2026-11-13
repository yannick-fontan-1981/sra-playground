import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { inspectOfficialWindows, assertNoActiveOfficialWindow } from './official-window-guard.mjs';

const NOW = Date.parse('2026-11-11T21:22:21.199Z');
const active = (patch = {}) => ({ id: 'official-test-01', owner: 'lot5c', kind: 'performance', state: 'active',
  startedAt: '2026-11-11T21:22:00.000Z', deadlineAt: '2026-11-11T21:23:00.000Z', releasedAt: null, ...patch });
const inspect = status => inspectOfficialWindows([{ lane: 'lot5c', status }], NOW);
const refusal = (window, code = 'OFFICIAL_ACTIVE_WINDOW_INVALID') =>
  assert.throws(() => inspect({ official_window: window }), { code, lane: 'lot5c' });

test('historical quiet requests never gate ordinary work', () => {
  const result = inspect({ quiet_requested: true, quiet_scope: 'obsolete request', quiet_request_id: 'old' });
  assert.equal(result.length, 1); assert.equal(result[0].quietRequested, true);
  assert.equal(result[0].preparatoryQuietIsAGate, false); assert.equal(result[0].actualWindow, null);
});
test('historical performance/publication started flags do not substitute for an official window', () => {
  assert.equal(inspect({ performance_started: true, publication_started: true, heavy_execution_active: true })[0].actualWindow, null);
});
test('absent and explicit-null official windows mean no window', () => {
  for (const status of [{}, { official_window: null }]) assert.equal(inspect(status)[0].actualWindow, null);
});
for (const state of ['preparing', 'released']) test(state + ' does not gate ordinary work despite old flags', () => {
  const rows = inspect({ quiet_requested: true, performance_started: true, publication_started: true,
    official_window: { ...active(), state, releasedAt: state === 'released' ? '2026-11-11T21:22:10.000Z' : null } });
  assert.deepEqual(rows[0].actualWindow, { state, blocksOrdinaryWork: false });
});
for (const kind of ['performance', 'publication']) test('actual active ' + kind + ' window defers ordinary work', () => {
  refusal(active({ kind }), 'OFFICIAL_WINDOW_ACTIVE');
});
test('valid Python UTC microseconds and +00:00 are accepted', () => {
  refusal(active({ startedAt: '2026-11-11T21:22:00.123456+00:00', deadlineAt: '2026-11-11T21:23:00.123456+00:00' }), 'OFFICIAL_WINDOW_ACTIVE');
});
test('Python microsecond deadline is not expired by millisecond truncation', () => {
  refusal(active({ deadlineAt: '2026-11-11T21:22:21.199898+00:00' }), 'OFFICIAL_WINDOW_ACTIVE');
});
test('valid UTC without fractional seconds is accepted', () => {
  refusal(active({ startedAt: '2026-11-11T21:22:00Z', deadlineAt: '2026-11-11T21:23:00+00:00' }), 'OFFICIAL_WINDOW_ACTIVE');
});
for (const [name, patch] of [
  ['different owner', { owner: 'lot10c' }], ['missing owner', { owner: undefined }],
  ['empty id', { id: '' }], ['whitespace id', { id: '  ' }], ['wrong kind', { kind: 'preparation' }],
  ['future start', { startedAt: '2026-11-11T21:22:22.000Z' }],
  ['nonincreasing deadline', { deadlineAt: '2026-11-11T21:22:00.000Z' }],
  ['numeric date coercion', { startedAt: 0 }], ['missing date', { startedAt: undefined }],
  ['invalid date text', { startedAt: 'not-a-date' }],
  ['local time without UTC', { startedAt: '2026-11-11T21:22:00' }],
  ['non-UTC offset', { startedAt: '2026-11-11T20:22:00-01:00' }],
  ['impossible calendar day', { startedAt: '2026-02-30T21:22:00.000Z' }],
  ['midnight rollover', { startedAt: '2026-11-10T24:00:00.000Z' }],
  ['already released active declaration', { releasedAt: '2026-11-11T21:22:10.000Z' }],
  ['missing active release sentinel', { releasedAt: undefined }],
]) test('invalid active declaration refuses: ' + name, () => refusal(active(patch)));
for (const state of [undefined, null, 'actve', 'unknown']) test('unrecognized state refuses: ' + String(state), () => {
  refusal(active({ state }), 'OFFICIAL_WINDOW_STATE_INVALID');
});
for (const window of [true, 'active', []]) test('non-object declaration refuses: ' + JSON.stringify(window), () => {
  refusal(window, 'OFFICIAL_WINDOW_INVALID');
});
test('expired active window requires owner closure, including exact expiry boundary', () => {
  for (const deadlineAt of ['2026-11-11T21:22:10.000Z', '2026-11-11T21:22:21.199Z'])
    refusal(active({ deadlineAt }), 'OFFICIAL_WINDOW_EXPIRED_NEEDS_OWNER_CLOSURE');
});
test('invalid observation clock refuses', () => {
  for (const now of [NaN, Infinity, -Infinity]) assert.throws(() => inspectOfficialWindows([], now), { code: 'OFFICIAL_CLOCK_INVALID' });
});
test('inspection never rewrites its input declaration', () => {
  const rows = [{ lane: 'lot5c', status: { quiet_requested: true, official_window: active() } }], retained = structuredClone(rows);
  assert.throws(() => inspectOfficialWindows(rows, NOW), { code: 'OFFICIAL_WINDOW_ACTIVE' });
  assert.deepEqual(rows, retained);
});

// Exercise the actual status-reader API with mocked status bytes, trapping all
// lock/process/mutation routes. No real shared status or lock file is accessed.
function withReadOnlyStatusIO(statuses, operation) {
  const restore = [], reads = [], forbidden = [];
  const replace = (object, key, value) => { const previous = object[key]; restore.push(() => { object[key] = previous; }); object[key] = value; };
  const denied = name => (...args) => { forbidden.push(name); throw new Error('Forbidden side effect: ' + name); };
  replace(fs, 'readFileSync', (path, encoding) => {
    const match = /^\/workspace\/shared\/sra-coordination\/(lot5c|lot6b|lot8a|lot10c)-status\.json$/.exec(String(path));
    assert.ok(match, 'Only a lane status may be read; never a global lock'); assert.equal(encoding, 'utf8');
    reads.push(match[1]); return JSON.stringify(statuses[match[1]] ?? {});
  });
  for (const name of ['open', 'openSync', 'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'unlink', 'unlinkSync', 'rename', 'renameSync', 'rm', 'rmSync', 'mkdir', 'mkdirSync']) replace(fs, name, denied('fs.' + name));
  for (const name of ['open', 'writeFile', 'appendFile', 'unlink', 'rename', 'rm', 'mkdir']) replace(fs.promises, name, denied('fs.promises.' + name));
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) replace(cp, name, denied('child_process.' + name));
  for (const name of ['setTimeout', 'setInterval', 'setImmediate']) replace(globalThis, name, denied(name));
  syncBuiltinESMExports();
  try { operation(); assert.deepEqual(forbidden, []); return reads; }
  finally { for (const reset of restore.reverse()) reset(); syncBuiltinESMExports(); }
}
test('actual status reader uses one read per lane and no global lock or mutation', () => {
  const reads = withReadOnlyStatusIO({ lot5c: { quiet_requested: true }, lot8a: { performance_started: true } }, () => {
    assert.equal(assertNoActiveOfficialWindow().length, 4);
  });
  assert.deepEqual(reads, ['lot5c', 'lot6b', 'lot8a', 'lot10c']);
});
test('expired reader refuses once with owner identity, without retries, unlink or lock replacement', () => {
  const reads = withReadOnlyStatusIO({ lot5c: { official_window: active({ startedAt: '2000-01-01T00:00:00Z', deadlineAt: '2000-01-02T00:00:00Z' }) } }, () => {
    assert.throws(() => assertNoActiveOfficialWindow(), { code: 'OFFICIAL_WINDOW_EXPIRED_NEEDS_OWNER_CLOSURE', lane: 'lot5c' });
  });
  assert.deepEqual(reads, ['lot5c', 'lot6b', 'lot8a', 'lot10c']);
});
