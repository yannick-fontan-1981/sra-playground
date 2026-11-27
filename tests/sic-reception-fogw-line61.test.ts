import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { ReceptionServiceMemory, receptionServiceBefore } from '../src/logos-engine/v6-reception-service-access.ts';
import { measureReceptionService, receptionServiceCarriers } from '../src/logos-engine/v6-reception-service-observation.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-reception-fogw-public.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };

async function start(extended: boolean, live = false) {
  const backend = live && process.env.SIC_RECEIVER_GAME_ROOT ? await sourceBackend(process.env.SIC_RECEIVER_GAME_ROOT) : null;
  function input(sequence: number, command?: V6Command) {
    const historical = fixture.observations[sequence];
    if (!backend) return historical;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'FOGW', level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...fields } = packet;
    assert.deepEqual(fields, historical, 'FOGW public return ' + sequence);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), service = new V6AgentService(() => runtime);
  const sessionId = fixture.sessionId, budgets = extended ? fixture.extendedBudgets : fixture.budgets;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence, budgets, observation: input(0) });
  return {
    async ticket() {
      if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(result.kind, 'action');
      const trace = result.snapshot.trace as readonly Row[], proposal = result.snapshot.proposal as Row;
      const release = trace.findLast(e => e.kind === 'sic_native_plan')!, guard = trace.findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([release.family, proposal.kind, guard.admitted, guard.reason],
        ['public_occurrence_recall', 'reception_service', true, 'current_reception_binding']);
      return { command: result.command!, id: result.ticket!.id, proposal, plan: proposal.reception_service_plan as Row, index: guard.index };
    },
    async advance(packet?: V6PublicObservation) {
      const command = result.command!;
      assert.equal(command.actionRef, 'ACTION' + fixture.commands[sequence].id);
      result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: result.ticket!.id,
        observation: packet ?? input(sequence, command), executionMs: 0 });
      return (result.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

function requestColors(rows: readonly (readonly number[])[], box: number[]) {
  const [left, top, right, bottom] = box, counts: Record<string, number> = {};
  for (let y = top!; y <= bottom!; y++) for (let x = left!; x <= right!; x++) {
    const color = rows[y]![x]!; counts[color] = (counts[color] ?? 0) + 1;
  }
  return counts;
}

test('FOGW catalog lead-in distinguishes probe, approach, reception position and first measured hold', async () => {
  const game = await start(false, true);
  for (let turn = 1; turn <= 16; turn++) {
    const { plan, command } = await game.ticket();
    if (turn === 1) {
      assert.deepEqual([plan.kind, command.actionRef, plan.actor, plan.scene.target.anchor, plan.steps[0].to],
        ['control_probe', 'ACTION1', { anchor: [30, 42], color: 10 }, [50, 26], null]);
      assert.equal(plan.scene.counterparts.length, 1);
    }
    const outcome = await game.advance();
    if (turn === 1) assert.equal(outcome.matched, null);
    if (turn === 15) assert.deepEqual([plan.kind, plan.steps.at(-1).to, outcome.matched], ['access', [50, 26], true]);
    if (turn === 16) assert.deepEqual([command.actionRef, plan.kind, plan.actor, plan.steps.length, plan.steps[0].stationary_confirmed, outcome.matched],
      ['ACTION4', 'reception_observation', { anchor: [50, 26], color: 0 }, 1, false, true]);
  }
});

test('FOGW public request changes to caught only upon contact, followed by a new level and independent reception', async t => {
  const records = new Map<string, Row>(), original = ReceptionServiceMemory.prototype.record;
  t.mock.method(ReceptionServiceMemory.prototype, 'record', function (this: ReceptionServiceMemory, ...args: Parameters<typeof original>) {
    const events = original.apply(this, args);
    for (const event of events) records.set(event.detail.after, { delta: event.detail.carrier_delta, stationary: event.memory.stationary?.ACTION4,
      wait: event.memory.wait_spent, boundary: event.detail.boundary, matched: event.detail.matched });
    return events;
  });
  const game = await start(true, true);
  for (let turn = 1; turn <= 32; turn++) {
    const { plan, index, command } = await game.ticket(), step = plan.steps[index];
    if (turn === 19) assert.deepEqual([plan.epoch, plan.kind, command.actionRef, plan.memory.wait_spent, plan.memory.stationary],
      [2, 'control_probe', 'ACTION1', 0, undefined]);
    const outcome = await game.advance();
    const board = fixture.observations[turn];
    if ([15, 16, 17, 27, 28, 29, 30, 31].includes(turn)) {
      const box = plan.scene.counterparts[0].request_bbox;
      for (const frame of board.frames) assert.deepEqual(requestColors(frame, box), { 3: 4, 5: 5 });
    }
    if (turn === 16 || turn === 28) {
      assert.deepEqual([plan.kind, step.from, step.to, step.stationary_confirmed, records.get(outcome.observation_ref)],
        ['reception_observation', [50, 26], [50, 26], false, { delta: [0, 0], stationary: [50, 26], wait: 1, boundary: false, matched: true }]);
    }
    if (turn === 17 || turn === 29) assert.deepEqual([index, plan.kind, plan.steps.length, step.stationary_confirmed], [0, 'reception_observation', 8, true]);
    if (turn === 18 || turn === 32) {
      const box = plan.scene.counterparts[0].request_bbox;
      assert.deepEqual(requestColors(board.frames[0], box), { 3: 4, 5: 5 });
      assert.deepEqual(requestColors(board.frames[1], box), { 0: 5, 14: 4 });
      assert.deepEqual([board.levelsCompleted, outcome.matched, records.get(outcome.observation_ref)!.boundary],
        [turn === 18 ? 1 : 2, null, true]);
    }
  }
});

function changeRequest(packet: V6PublicObservation, background: number) {
  const changed = structuredClone(packet);
  for (const frame of [changed.frame, ...changed.frames]) {
    const rows = frame as number[][];
    for (let y = 57; y < 61; y++) for (let x = 24; x < 28; x++) rows[y]![x] = 3;
    for (let y = 25; y < 30; y++) for (let x = 27; x < 32; x++) rows[y]![x] = background;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]] as const) {
      rows[57 + dy]![24 + dx] = 5; rows[26 + dy]![28 + dx] = 10;
    }
  }
  return changed;
}

test('FOGW seals the old request, remeasures the new one and preserves the physical return and wait cost', async () => {
  const game = await start(true);
  for (let turn = 1; turn <= 16; turn++) { await game.ticket(); await game.advance(); }
  const old = await game.ticket(), packet = changeRequest(fixture.observations[17], old.plan.scene.background);
  const scene = measureReceptionService(packet.frame, old.plan.scene)!;
  assert.equal(scene.layout, old.plan.scene.layout);
  assert.deepEqual(receptionServiceCarriers(packet.frame, scene), [old.plan.actor]);
  assert.deepEqual(scene.counterparts.map((c: Row) => c.body_bbox), [[28, 26, 29, 27]]);
  assert.notEqual(scene.counterparts[0].request_shape, old.plan.scene.counterparts[0].request_shape);
  const meta = { epoch: old.plan.epoch, score: old.plan.score, observation_ref: 'fresh', available: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] };
  assert.equal(receptionServiceBefore(old.proposal, 0, fixture.observations[16].frame, meta).admitted, false);
  assert.equal(receptionServiceBefore(old.proposal, 1, packet.frame, meta).admitted, false);
  const visible = fixture.observations[17].frame;
  const current = measureReceptionService(visible, old.plan.scene)!;
  assert.notDeepEqual(current.counterparts[0].body_bbox, old.plan.scene.counterparts[0].body_bbox);
  assert.equal(receptionServiceBefore(old.proposal, 1, visible, meta).admitted, true, 'moving counterpart');
  const occluded = structuredClone(visible);
  for (const { body_bbox: [left, top, right, bottom] } of current.counterparts) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) occluded[y][x] = current.background;
  }
  assert.deepEqual(measureReceptionService(occluded, old.plan.scene)!.counterparts, old.plan.scene.counterparts);
  assert.equal(receptionServiceBefore(old.proposal, 1, occluded, meta).admitted, true, 'counterpart behind fog');
  const alteredSupport = structuredClone(visible), target = old.plan.scene.target;
  for (const [dx, dy] of target.mask) alteredSupport[target.bbox[1] + dy][target.bbox[0] + dx] = 2;
  assert.notEqual(measureReceptionService(alteredSupport, old.plan.scene)?.layout, old.plan.scene.layout);
  assert.equal(receptionServiceBefore(old.proposal, 1, alteredSupport, meta).admitted, false);
  const hidden = structuredClone(fixture.observations[17].frame), [x, y] = old.plan.actor.anchor;
  for (let j = 57; j < 61; j++) for (let i = 24; i < 28; i++) hidden[j][i] = 3;
  assert.equal(receptionServiceBefore(old.proposal, 1, hidden, meta).admitted, true, 'no visible contrary request');
  hidden[y][x] = hidden[y][x + 1];
  assert.equal(receptionServiceBefore(old.proposal, 1, hidden, meta).admitted, false, 'carrier no longer identified');
  const outcome = await game.advance(packet), next = await game.ticket();
  assert.deepEqual([outcome.matched, outcome.reason, next.command.actionRef, next.index, next.plan.observation_ref, next.plan.steps.length],
    [true, 'reception_subject_changed', 'ACTION4', 0, outcome.observation_ref, 1]);
  assert.notEqual(next.plan.observation_ref, old.plan.observation_ref);
  assert.deepEqual([next.plan.scene.counterparts[0].request_shape, next.plan.steps[0].stationary_confirmed, next.plan.memory.wait_spent],
    [scene.counterparts[0].request_shape, false, 2]);
  const sameRequest = { ...packet, stepIndex: fixture.observations[18].stepIndex };
  assert.equal((await game.advance(sameRequest)).matched, true);
  const renewed = await game.ticket();
  assert.deepEqual([renewed.index, renewed.command.actionRef, renewed.plan.steps.length, renewed.plan.steps[0].stationary_confirmed,
    renewed.plan.scene.counterparts[0].request_shape, renewed.plan.memory.wait_spent], [0, 'ACTION4', 8, true, scene.counterparts[0].request_shape, 3]);
});

test('FOGW consumes a replacement offer to remeasure before waiting at the same support', async t => {
  const select = ReceptionServiceMemory.prototype.offerStationaryObservation;
  let replaced = 0;
  t.mock.method(ReceptionServiceMemory.prototype, 'offerStationaryObservation', function (this: ReceptionServiceMemory, ...args: Parameters<typeof select>) {
    const offered = select.apply(this, args);
    if (!offered?.confirmed) return offered;
    replaced++;
    return { ...offered, confirmed: false };
  });
  const game = await start(true);
  for (let turn = 1; turn <= 16; turn++) { await game.ticket(); await game.advance(); }
  const held = await game.ticket();
  assert.ok(replaced > 0);
  assert.deepEqual([held.command.actionRef, held.plan.kind, held.plan.steps.length, held.plan.steps[0].stationary_confirmed],
    ['ACTION4', 'reception_observation', 1, false]);
  assert.equal((await game.advance()).matched, true);
  const next = await game.ticket();
  assert.equal(next.index, 0);
  assert.notEqual(next.plan.observation_ref, held.plan.observation_ref);
});
