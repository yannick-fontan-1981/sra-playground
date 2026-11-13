import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { RecurrentSeriesMemory, repeatedLineBefore, repeatedLineAfter, recurrentSeriesBefore, recurrentSeriesAfter,
  proposeRecurrentSeriesCommon, bindRecurrentSeries } from '../src/logos-engine/v6-recurrent-series-access.ts';
import { lineInsertions, lineWindows, linePlace, searchLines } from '../src/logos-engine/v6-supported-lines.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-recurrent-series-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
function seeded(events: R[] = []): RecurrentSeriesMemory {
  const memory = new RecurrentSeriesMemory();
  for (const event of events) memory.applyEvent(copy(event));
  return memory;
}
function assertState(memory: RecurrentSeriesMemory, expected: R): void {
  const current = memory.currentState();
  if (!Object.hasOwn(expected, 'insert_samples')) {
    assert.deepEqual({ line_trials: current.line_trials, line_goals: current.line_goals, digest: memory.repeatedDigest() }, expected);
  } else assert.deepEqual({ ...current, repeated_digest: memory.repeatedDigest(), digest: memory.retainedDigest() }, expected);
}
function domain(bindings: [number, string][] = []): ObservedInputDomain {
  const value = new ObservedInputDomain(1);
  for (const [epoch, frame] of bindings) value.bindings.set(`${epoch}:${frame}`, new Map());
  return value;
}
async function access(memory: RecurrentSeriesMemory, value: R): Promise<unknown> {
  if (value.method === 'line_question') return memory.lineQuestion(value.observation, value.rows, value.inputs);
  if (value.method === 'propose') return memory.propose(value.observation, value.rows, value.inputs, value.limit,
    value.owner === 'repeated' ? { ...value.config, prepare_supported_lines: false } : value.config);
  if (['pointed_propose', 'supported_propose', 'observed_propose'].includes(value.method)) {
    // Supported/Observed inherit the same consumed wrapper. Pointed's separate
    // constructor lacks SupportedLine state, so its own fallback is disabled.
    return proposeRecurrentSeriesCommon(memory, value.observation, value.rows, value.inputs, value.remaining,
      value.method === 'pointed_propose' ? { ...value.config, prepare_supported_lines: false } : value.config, null, () => 0);
  }
  throw new Error('Unexpected source access method: ' + value.method);
}

for (const item of fixture.helperCases as R[]) test('original recurrent conditional calculation ' + item.id, () => {
  const value = copy(item), a = value.arguments;
  const call = (): unknown => {
    if (value.method === 'insertions') return lineInsertions(a.board, a.empty, a.axis, a.sign);
    if (value.method === 'line_windows') return lineWindows(a.board, a.length);
    if (value.method === 'place') return linePlace(a.board, a.point ?? a.p, a.color);
    if (value.method === 'search_lines') return searchLines(a.board, a.own, a.other, a.empty, a.length, a.axis, a.sign, a.depth);
    throw new Error('Unexpected conditional helper: ' + value.method);
  };
  if (value.error) assert.throws(call);
  else assert.deepEqual(call(), value.expected);
  assert.deepEqual(value, item);
});

for (const item of fixture.accessCases as R[]) test('original recurrent access ' + item.id, async () => {
  const value = copy(item), memory = seeded(value.initialEvents);
  assertState(memory, value.beforeState);
  if (value.error) await assert.rejects(() => access(memory, value));
  else assert.deepEqual(await access(memory, value), value.expected);
  assertState(memory, value.afterState);
  assert.deepEqual(value, item, 'A question cannot acquire its own simulated prediction or mutate caller observations');
});

for (const item of fixture.guardCases as R[]) test('original recurrent guard ' + item.id, () => {
  const value = copy(item);
  const call = (): R => {
    if (value.method === 'before') return (value.owner === 'repeated' ? repeatedLineBefore : recurrentSeriesBefore)(value.proposal, value.index, value.rows, value.meta);
    if (value.method === 'after') return (value.owner === 'repeated' ? repeatedLineAfter : recurrentSeriesAfter)(value.proposal, value.index, value.rows, value.later, value.meta);
    throw new Error('Unexpected source guard: ' + value.method);
  };
  if (value.error) assert.throws(call);
  else assert.deepEqual(call(), value.expected);
  assert.deepEqual(value, item);
});

for (const item of fixture.recordCases as R[]) test('original recurrent acquisition ' + item.id, () => {
  const value = copy(item), memory = seeded(value.initialEvents);
  assertState(memory, value.beforeState);
  const call = () => memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index,
    value.owner === 'repeated' ? { after: repeatedLineAfter } : {});
  if (value.error) assert.throws(call);
  else assert.deepEqual(call(), value.expected);
  assertState(memory, value.afterState); assert.deepEqual(value, item);
});

for (const item of fixture.packetCases as R[]) test('original recurrent persistent public packet ' + item.id, () => {
  const value = copy(item), memory = seeded(value.initialEvents);
  assertState(memory, value.beforeState);
  const call = () => memory.recordPacket(value.before, value.command, value.after, value.rows, value.packet);
  if (value.error) assert.throws(call);
  else assert.deepEqual(call(), value.expected);
  assertState(memory, value.afterState); assert.deepEqual(value, item);
});

for (const item of fixture.eventCases as R[]) test('original recurrent event reduction ' + item.id, () => {
  const value = copy(item), memory = new RecurrentSeriesMemory();
  assertState(memory, value.beforeState);
  const call = () => { for (const event of value.events) memory.applyEvent(event); };
  if (value.error) assert.throws(call);
  else call();
  assertState(memory, value.afterState); assert.deepEqual(value, item);
});

// PointedLineConstraint.state/restore are replaced by SupportedLineConstraint
// and then the complete Observed caller. These checks cover the consumed own
// Supported journal. Shared caller checkpoints are verified separately and are
// not presented as the full, still partly unmigrated Python ancestor digest.
for (const item of (fixture.restoreCases as R[]).filter(value => value.wrapper === 'supported')) {
  test('original supported-series cold restore ' + item.id, () => {
    const value = copy(item), memory = seeded(value.initialEvents);
    assertState(memory, value.beforeState); assert.deepEqual(memory.state(), value.beforeSnapshot);
    if (value.error) assert.throws(() => memory.restore(value.snapshot));
    else memory.restore(value.snapshot);
    assertState(memory, value.afterState); assert.deepEqual(memory.state(), value.afterSnapshot); assert.deepEqual(value, item);
  });
}

for (const item of (fixture.adapterCases as R[]).filter(value => value.method === 'bind' || value.wrapper === 'supported')) {
  test('original recurrent measured transport ' + item.id, () => {
    const value = copy(item);
    if (value.method === 'bind') {
      const call = () => { bindRecurrentSeries(value.proposal, domain(value.bindings)); return value.proposal; };
      if (value.error) assert.throws(call);
      else assert.deepEqual(call(), value.expected);
    } else {
      const memory = seeded(value.initialEvents); assertState(memory, value.beforeState);
      const own = memory.record(value.before, value.command, value.after, value.rows, value.later, value.proposal, value.index);
      const packet = memory.recordPacket(value.before, value.command, value.after, value.rows, value.frames);
      assert.deepEqual([...own, ...packet], value.expected.events);
      assertState(memory, value.afterState); assert.deepEqual(memory.state(), value.snapshot); assert.deepEqual(value, item);
    }
  });
}

for (const item of fixture.chains as R[]) test('original recurrent scored-to-supported cold chain ' + item.id, () => {
  const value = copy(item), score = value.scoredTransition;
  let memory = seeded(score.initialEvents);
  assertState(memory, score.beforeState);
  assert.deepEqual(memory.record(score.before, score.command, score.after, score.rows, score.later, score.proposal, score.index), score.expected);
  assertState(memory, score.afterState);
  for (const step of value.steps) {
    assertState(memory, step.beforeState);
    const events = memory.record(step.before, step.command, step.after, step.rows, step.later, step.proposal, step.index);
    events.push(...memory.recordPacket(step.before, step.command, step.after, step.rows, step.frames));
    assert.deepEqual(events, step.expected.events); assertState(memory, step.afterState);
    const cold = new RecurrentSeriesMemory(); cold.restore(step.snapshot);
    assert.deepEqual(cold.state(), memory.state()); memory = cold;
  }
  assertState(memory, value.finalState); assert.deepEqual(memory.state().events, value.events);
  const last = value.steps.at(-1);
  assert.deepEqual(memory.propose(last.after, last.later,
    fixture.accessCases.find((entry: R) => entry.id === 'supported:acquired_preparation').inputs, 1,
    { repeated_line_completion: true, prepare_supported_lines: true, supported_line_reply_plies: 6 }), value.following);
  assert.deepEqual(value, item);
});

test('supported work bounds preserve the acquired state and block unrelated probing without a partial plan', async () => {
  const value = copy(fixture.accessCases.find((entry: R) => entry.id === 'supported:acquired_preparation'));
  const memory = seeded(value.initialEvents), state = memory.state();
  for (const options of [{ nativeBounds: true, maxNodes: 0 }, { nativeBounds: true, maxNodes: 1 },
    { nativeBounds: true, deadlineMs: 0, now: () => 0 }]) {
    const result = memory.propose(value.observation, value.rows, value.inputs, value.limit, value.config, options);
    assert.equal(result.status, 'unknown'); assert.equal(result.block_unrelated_probe, true); assert.equal(result.frontier.complete, false);
    assert.equal(Object.hasOwn(result, 'actions'), false); assert.equal(Object.hasOwn(result, 'supported_line_plan'), false);
    assert.deepEqual(memory.state(), state);
  }
  const completed = memory.propose(value.observation, value.rows, value.inputs, value.limit, value.config,
    { nativeBounds: true, maxNodes: value.expected.supported_line_plan.search.nodes });
  assert.deepEqual(completed, value.expected);
  const common = await proposeRecurrentSeriesCommon(memory, value.observation, value.rows, [], 1, value.config, null, () => 0, { maxNodes: 0 });
  assert.equal(common.status, 'unknown'); assert.equal(common.exhausted_bound, 'nodes'); assert.deepEqual(memory.state(), state);
});

test('a measured repeated continuation precedes supported search and never consumes that search allowance', async () => {
  const value = copy(fixture.accessCases.find((entry: R) => entry.id === 'supported:repeated_priority'));
  const memory = seeded(value.initialEvents), state = memory.state();
  assert.deepEqual(memory.propose(value.observation, value.rows, value.inputs, 0, value.config,
    { nativeBounds: true, maxNodes: 0, deadlineMs: 0, now: () => 0 }), value.expected);
  assert.equal(await proposeRecurrentSeriesCommon(memory, value.observation, value.rows, [], 0, {} as any), null,
    'The transport remaining check precedes missing config fields, as in the source');
  await assert.rejects(() => proposeRecurrentSeriesCommon(memory, value.observation, value.rows, [], 1, {} as any), /prepare_supported_lines/);
  assert.deepEqual(memory.state(), state);
});
