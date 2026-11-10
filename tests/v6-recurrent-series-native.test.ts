import assert from 'node:assert/strict';
import test from 'node:test';
import { RecurrentSeriesMemory, freshRecurrentSeriesMemory, repeatedLineBefore, repeatedLineAfter,
  recurrentSeriesBefore, recurrentSeriesAfter, bindRecurrentSeries } from '../src/logos-engine/v6-recurrent-series-access.ts';
import { searchLines, NativeLineSearchWorkBoundError } from '../src/logos-engine/v6-supported-lines.ts';
import { symbolicDigest as identity } from '../src/logos-engine/v6-hash.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const observation = (patch: R = {}): R => ({ level_epoch: 2, levels_completed: 1, observation_ref: 'public-before', state: 'NOT_FINISHED', ...patch });
const rows = [[0, 0, 4], [0, 0, 4], [4, 4, 4]];
const later = [[6, 6, 9], [6, 6, 4], [4, 4, 4]];
const line = (): R => ({ epoch: 2, score: 1, observation_ref: 'public-before', frame_digest: identity(rows),
  trial: 'trial-a', field: 'field-a', target: [0, 0], size: [2, 2], expected_palette: 6,
  action: { action_ref: 'ACTION6', data: { x: 0, y: 0 } }, candidate_length: 3, support_fields: ['field-a', 'field-b'] });
const beforeMeta = (): R => ({ epoch: 2, score: 1, observation_ref: 'public-before', available: ['ACTION6'] });
const afterMeta = (patch: R = {}): R => ({ epoch: 2, score: 1, state: 'NOT_FINISHED', ...patch });

test('recurrent memory preserves both original ancestor digest positions and opaque historic reducers', () => {
  const memory = new RecurrentSeriesMemory();
  assert.deepEqual(memory.currentState(), freshRecurrentSeriesMemory());
  const events = [
    { kind: 'repeated_line_trial', trial: 'old-minimal-trial' }, { kind: 'repeated_line_scored' },
    { kind: 'supported_insertion_observation' }, { kind: 'supported_insertion_order', source: 'old-minimal-order' },
    { kind: 'supported_line_refutation', trial: '\u{10000}', epoch: 9 },
    { kind: 'supported_line_refutation', trial: '\ue000', epoch: 3 },
  ];
  for (const event of events) memory.applyEvent(event);
  const state = memory.currentState();
  assert.equal(memory.repeatedDigest(), identity([state.line_trials, state.line_goals]));
  assert.equal(memory.retainedDigest(), identity([identity([state.line_trials, state.line_goals]),
    state.insert_samples, state.insert_orders, ['\ue000', '\u{10000}'], [3, 9]]));
  assert.equal(memory.nativeRevision, 6); assert.equal(memory.eventCount, 6);
  memory.applyEvent({ kind: 'repeated_line_trial', trial: 'later' });
  memory.applyEvent({ kind: 'repeated_line_trial', trial: 'old-minimal-trial', marker: 'replacement' });
  assert.deepEqual(Object.keys(memory.lineTrials), ['old-minimal-trial', 'later']);
  const restored = new RecurrentSeriesMemory(); restored.restore(memory.state());
  assert.deepEqual(restored.currentState(), memory.currentState()); assert.equal(restored.retainedDigest(), memory.retainedDigest());
});

test('recurrent reduction owns its inputs and exposes detached state, including literal dictionary keys', () => {
  const memory = new RecurrentSeriesMemory(), event: R = { kind: 'repeated_line_trial', trial: '__proto__', nested: { values: [1] } };
  memory.applyEvent(event); const expected = memory.state();
  event.nested.values.push(2); event.trial = 'changed';
  assert.equal(Object.getPrototypeOf(memory.lineTrials), Object.prototype);
  assert.equal(Object.hasOwn(memory.lineTrials, '__proto__'), true);
  assert.throws(() => memory.lineTrials.__proto__.nested.values.push(3));
  const state = memory.state(), projection = memory.currentState();
  state.events[0].nested.values.push(4); projection.line_trials.__proto__.nested.values.push(5);
  assert.deepEqual(memory.state(), expected);
  const fresh = freshRecurrentSeriesMemory(); fresh.line_goals.push({ kind: 'foreign' });
  assert.deepEqual(new RecurrentSeriesMemory().currentState(), freshRecurrentSeriesMemory());
});

test('malformed recurrent reductions and restoration leave the prior owner and revision intact', () => {
  const memory = new RecurrentSeriesMemory(); memory.applyEvent({ kind: 'repeated_line_trial', trial: 'retained' });
  const before = memory.state(), revision = memory.nativeRevision;
  for (const event of [{ kind: 'foreign' }, { kind: 'repeated_line_trial' }, { kind: 'supported_insertion_order' },
    { kind: 'supported_line_refutation', trial: 'x' }, { kind: 'supported_line_refutation', trial: 'x', epoch: 1.5 },
    { kind: 'repeated_line_scored', invalid: undefined }, { kind: 'repeated_line_scored', invalid: Infinity }]) {
    assert.throws(() => memory.applyEvent(event)); assert.deepEqual(memory.state(), before); assert.equal(memory.nativeRevision, revision);
  }
  for (const corrupt of [
    { ...copy(before), digest: 'forged' }, { ...copy(before), events: [] },
    { ...copy(before), events: [...before.events, { kind: 'supported_insertion_order' }] },
  ]) {
    assert.throws(() => memory.restore(corrupt)); assert.deepEqual(memory.state(), before); assert.equal(memory.nativeRevision, revision);
  }
});

test('repeated-line guards retain exact current context without replacing the common action authority', () => {
  const proposal = { line_plan: line(), actions: [{ action_ref: 'ACTION1' }] };
  assert.deepEqual(repeatedLineBefore(proposal, 0, rows, beforeMeta()), { admitted: true, reason: 'pointed_series_bound' });
  for (const [index, changedRows, meta] of [[1, rows, beforeMeta()], [0, later, beforeMeta()],
    [0, rows, { ...beforeMeta(), epoch: 3 }], [0, rows, { ...beforeMeta(), score: 0 }],
    [0, rows, { ...beforeMeta(), observation_ref: 'other' }], [0, rows, { ...beforeMeta(), available: [] }]] as any[]) {
    assert.deepEqual(repeatedLineBefore(proposal, index, changedRows, meta), { admitted: false, reason: 'pointed_series_changed' });
  }
  assert.deepEqual(repeatedLineBefore({}, 0, rows, beforeMeta()), { admitted: false, reason: 'missing_series_plan' });
  assert.deepEqual(repeatedLineAfter({}, 0, rows, later, afterMeta()), { matched: null, seal_prefix: true, reason: 'missing_series_plan' });
  assert.deepEqual(recurrentSeriesBefore(proposal, 0, rows, beforeMeta()), repeatedLineBefore(proposal, 0, rows, beforeMeta()));
});

test('repeated outcome is a local uniform patch and any official score inequality seals unknown', () => {
  const proposal = { line_plan: line() };
  assert.deepEqual(repeatedLineAfter(proposal, 98, rows, later, afterMeta()),
    { matched: true, seal_prefix: true, reason: 'series_continuation_observed' });
  assert.equal(repeatedLineAfter(proposal, 0, later, later, afterMeta()).matched, true, 'A previously present target is not itself a refutation');
  assert.deepEqual(repeatedLineAfter(proposal, 0, rows, rows, afterMeta()),
    { matched: false, seal_prefix: true, reason: 'series_continuation_refuted' });
  for (const meta of [afterMeta({ score: 0 }), afterMeta({ score: 2 }), afterMeta({ epoch: 3 }),
    afterMeta({ state: 'WIN' }), afterMeta({ state: 'GAME_OVER' })]) {
    assert.deepEqual(repeatedLineAfter(proposal, 0, rows, later, meta), { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' });
  }
  const negative = { line_plan: { ...line(), target: [-3, -3] } };
  assert.equal(repeatedLineAfter(negative, 0, rows, later, afterMeta()).matched, true);
  assert.throws(() => repeatedLineAfter({ line_plan: { ...line(), target: [5, 5] } }, 0, rows, later, afterMeta()));
});

test('supported guards outrank a repeated plan inside the own inherited envelope', () => {
  const proposal = { line_plan: line(), supported_line_plan: { ...line(), empty_palette: 0, response_palette: 7,
    goal_length: 3, layout: 'absent-layout', support_axis: 1, support_sign: 1 } };
  assert.deepEqual(recurrentSeriesBefore(proposal, 0, rows, beforeMeta()), { admitted: true, reason: 'supported_preparation_bound' });
  assert.deepEqual(recurrentSeriesAfter(proposal, 0, rows, later, afterMeta()),
    { matched: false, seal_prefix: true, reason: 'supported_insertion_or_response_refuted' });
});

test('both record layers use the common virtual after and acquire the actual returned command', () => {
  const memory = new RecurrentSeriesMemory(), proposal = { line_plan: line(), supported_line_plan: { trial: 'supported-trial' } }, calls: R[] = [];
  const command = { action_ref: 'ACTION1' };
  const events = memory.record(observation(), command, observation({ observation_ref: 'public-after' }), rows, later, proposal, 4,
    { after: (p, index, first, second, meta) => { calls.push({ p, index, first, second, meta }); return { matched: false, reason: 'higher_inherited_refutation' }; } });
  assert.equal(calls.length, 2); assert.equal(calls[0].p, proposal); assert.equal(calls[1].index, 4);
  assert.deepEqual(events.map(event => event.kind), ['repeated_line_trial', 'supported_line_refutation']);
  assert.equal(events[0].result, 'refuted'); assert.deepEqual(events[0].action, command);
  assert.equal(events[1].reason, 'higher_inherited_refutation'); assert.equal(memory.insertRefutedEpochs.has(2), true);
  const retained = memory.state(); events[0].support_fields.push('foreign'); proposal.line_plan.support_fields.push('changed');
  assert.deepEqual(memory.state(), retained);
});

test('score decreases retain boundary trials while only official increases produce scored witnesses', () => {
  for (const score of [0, 2]) {
    const memory = new RecurrentSeriesMemory();
    const events = memory.record(observation(), { action_ref: 'ACTION1' }, observation({ levels_completed: score, observation_ref: 'public-after' }),
      rows, later, { line_plan: line() }, 0);
    assert.equal(events[0].result, 'boundary'); assert.equal(events.length, score > 1 ? 2 : 1);
    assert.equal(memory.lineGoals.length, score > 1 ? 1 : 0);
  }
});

test('a malformed final event cannot partially acquire an earlier repeated or supported event', () => {
  const memory = new RecurrentSeriesMemory(), before = memory.state();
  assert.throws(() => memory.record(observation(), { action_ref: 'ACTION1', invalid: undefined },
    observation({ levels_completed: 2, observation_ref: 'public-after' }), rows, later, { line_plan: line() }, 0));
  assert.deepEqual(memory.state(), before); assert.equal(memory.nativeRevision, 0);
  assert.deepEqual(memory.record(observation(), { action_ref: 'ACTION1' }, observation(), rows, later, {}, 0), []);
});

test('packet order measures only the persistent final suffix of the latest matching public sample', () => {
  const memory = new RecurrentSeriesMemory(), sample = { kind: 'supported_insertion_observation', source: 'public-before',
    field: { origin: [0, 0], pitch: [1, 1], size: [1, 1] }, arrived: [0, 0], response: [1, 0], own: 6, other: 7 };
  memory.applyEvent({ ...sample, arrived: [2, 0], response: [0, 0] });
  memory.applyEvent(sample);
  const packet = [[[0, 0, 0]], [[6, 0, 0]], [[6, 7, 0]], [[6, 0, 0]], [[6, 7, 0]]];
  const events = memory.recordPacket(observation(), {}, {}, [], packet);
  assert.deepEqual(events, [{ kind: 'supported_insertion_order', epoch: 2, source: 'public-before', own_stable_from: 1,
    response_stable_from: 4, packet_frames: 5, own_before_response: true,
    scope: 'Order of persistent public patches within the returned packet, not private turn state.' }]);
  const simultaneous = memory.recordPacket(observation(), {}, {}, [], [[[0, 0, 0]], [[6, 7, 0]]]);
  assert.equal(simultaneous[0].own_before_response, false);
  const absent = memory.recordPacket(observation(), {}, {}, [], [[[6, 0, 0]]]);
  assert.equal(absent[0].response_stable_from, 1); assert.equal(absent[0].own_before_response, false);
  const retained = memory.state();
  assert.deepEqual(memory.recordPacket(observation(), {}, {}, [], []), []);
  assert.deepEqual(memory.recordPacket(observation({ observation_ref: 'unseen' }), {}, {}, [], packet), []);
  assert.deepEqual(memory.state(), retained);
});

test('composition-derived point binding requires a current measured domain and one unchanged address', () => {
  const proposal: R = { point_support: { level_epoch: 2, frame_hash: 'frame', point: [8, 9] },
    actions: [{ action_ref: 'ACTION6', data: { x: 8, y: 9 } }], steps: [{}] }, domain = new ObservedInputDomain(1);
  assert.throws(() => bindRecurrentSeries(proposal, domain), /has not been observed/);
  domain.bindings.set('2:frame', new Map()); bindRecurrentSeries(proposal, domain);
  assert.equal(proposal.steps[0].point_binding.scope,
    'one composition-derived measured cell, full-raster guarded; not an enumerated exploratory sample');
  const changed = copy(proposal); changed.actions[0].data.x = 7;
  assert.throws(() => bindRecurrentSeries(changed, domain), /address changed/);
  changed.actions = [proposal.actions[0], proposal.actions[0]];
  assert.throws(() => bindRecurrentSeries(changed, domain), /address changed/);
});

test('line search preserves completed exact results with one request-wide node allowance', () => {
  const board = [[0, 0, 0], [0, 6, 0], [7, 0, 0]], before = copy(board);
  const expected = searchLines(board, 6, 7, 0, 3, 1, 1, 4), total = expected[1].nodes;
  assert.ok(total > 4);
  assert.deepEqual(searchLines(board, 6, 7, 0, 3, 1, 1, 4, { maxNodes: total }), expected);
  for (const limit of [0, 1, total - 1]) {
    assert.throws(() => searchLines(board, 6, 7, 0, 3, 1, 1, 4, { maxNodes: limit }), (error: unknown) => {
      assert.ok(error instanceof NativeLineSearchWorkBoundError); assert.equal(error.bound, 'nodes'); assert.equal(error.nodes, limit); return true;
    });
  }
  assert.deepEqual(board, before);
});

test('line search deadline interruption never returns a partial ranking and malformed budgets fail explicitly', () => {
  const board = [[0, 0, 0], [0, 6, 0], [7, 0, 0]];
  assert.throws(() => searchLines(board, 6, 7, 0, 3, 1, 1, 4, { deadlineMs: 0, now: () => 0 }), (error: unknown) => {
    assert.ok(error instanceof NativeLineSearchWorkBoundError); assert.equal(error.bound, 'deadline'); assert.equal(error.nodes, 0); return true;
  });
  let ticks = 0;
  assert.throws(() => searchLines(board, 6, 7, 0, 3, 1, 1, 4, { deadlineMs: 6, now: () => ticks++ }), (error: unknown) => {
    assert.ok(error instanceof NativeLineSearchWorkBoundError); assert.equal(error.bound, 'deadline'); assert.ok(error.nodes > 0); return true;
  });
  for (const maxNodes of [-1, 0.5, NaN, Infinity]) assert.throws(() => searchLines(board, 6, 7, 0, 3, 1, 1, 4, { maxNodes }), /bound/);
  assert.throws(() => searchLines(board, 6, 7, 0, 3, 1, 1, 4, { deadlineMs: NaN }), /deadline/);
  assert.deepEqual(searchLines(board, 6, 7, 0, 3, 1, 1, 4, { deadlineMs: 100, now: () => 0 }), searchLines(board, 6, 7, 0, 3, 1, 1, 4));
});
