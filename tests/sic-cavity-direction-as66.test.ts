import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { SlidingCavity } from '../src/logos-engine/v6-sliding-cavity.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const load = (name: string) => JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString());
const fixture = load('sic-cavity-direction-as66-public.json.gz');
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };

async function start(live = false) {
  const backend = live && process.env.SIC_CAVITY_GAME_ROOT ? await sourceBackend(process.env.SIC_CAVITY_GAME_ROOT) : null;
  function input(sequence: number, expected: V6PublicObservation, command?: V6Command) {
    if (!backend) return expected;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'AS66', level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...fields } = packet;
    assert.deepEqual(fields, expected, 'AS66 public return ' + sequence);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), sessionId = fixture.sessionId;
  let sequence = 0;
  let result = await service.handle({ type: 'init', sessionId, sequence, budgets: fixture.budgets, observation: input(0, fixture.observations[0]) });
  async function current() {
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  async function ticket() {
    await current();
    assert.equal(result.kind, 'action');
    const trace = result.snapshot.trace as readonly Row[];
    return { proposal: result.snapshot.proposal as Row, command: result.command!, release: trace.findLast(e => e.kind === 'sic_native_plan')!,
      guard: trace.findLast(e => e.kind === 'before_guard')! };
  }
  async function advance(expected?: V6PublicObservation) {
    const command = result.command!, packet = input(++sequence, expected ?? fixture.observations[sequence], command);
    result = await service.handle({ type: 'advance', sessionId, sequence, ticketId: result.ticket!.id, observation: packet, executionMs: 0 });
    return (result.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'actual_outcome')!;
  }
  for (let turn = 1; turn <= 5; turn++) {
    const step = await ticket();
    assert.equal(step.command.actionRef, 'ACTION' + fixture.commands[turn - 1].id);
    assert.equal(step.proposal.kind, turn === 5 ? 'sliding_cavity_access' : 'experiment');
    await advance();
  }
  return { current, ticket, advance };
}

function checkProbe(step: Awaited<ReturnType<Awaited<ReturnType<typeof start>>['ticket']>>, action: string, position: number[], retained: string) {
  const p = step.proposal, plan = p.support_plan;
  assert.deepEqual([step.release.family, p.kind, step.guard.admitted, step.guard.reason, step.command.actionRef],
    ['sliding_cavity', 'cavity_direction_question', true, 'current_cavity_body_surface_bound', action]);
  assert.deepEqual([plan.body_type, plan.positions, p.steps[0].expected_after.direction], [[11, 4, 4], [position], 'unknown']);
  assert.deepEqual(p.question.hypothesis_refs, [step.release.observationRef, retained]);
  assert.deepEqual([step.release.missingControl.id, step.release.missingControl.action, step.release.missingControl.agenda.result],
    ['test_missing_control', action, 'selected']);
  assert.equal(step.release.missingControl.observationRef, step.release.observationRef);
  assert.deepEqual(step.release.missingControl.evidence, [...new Set(p.question.hypothesis_refs)]);
}

test('AS66 historical probes bind the new L2 body, measure both unknown directions and then release an access plan', async t => {
  const records = t.mock.method(SlidingCavity.prototype, 'record');
  const game = await start(true), first = await game.ticket();
  const retained = first.release.observationRef;
  checkProbe(first, 'ACTION1', [48, 26], retained);
  const rebind = first.proposal.support_plan.role_rebinding;
  assert.deepEqual(rebind.prior_body_type, [8, 4, 4]);
  for (const field of ['current_component_ref', 'current_cavity_ref', 'current_surface_ref']) assert.equal(typeof rebind[field], 'string');
  const owner = records.mock.calls.at(-1)!.this!;
  assert.deepEqual(owner.directions, { ACTION2: [1, 0], ACTION3: [0, -1] });
  const firstReturn = await game.advance();
  assert.deepEqual([firstReturn.matched, firstReturn.reason], [null, 'unknown_input_direction_requires_observed_response_before_route_binding']);
  const change = records.mock.calls.at(-1)!.result.events[0];
  assert.deepEqual([change.before, change.after, change.local_delta, change.directions.ACTION1],
    [retained, firstReturn.observation_ref, [20, 0], [-1, 0]]);
  const second = await game.ticket();
  checkProbe(second, 'ACTION4', [48, 46], retained);
  assert.equal(second.release.observationRef, firstReturn.observation_ref);
  assert.equal(second.proposal.support_plan.role_rebinding, null);
  const keys = [first, second].map(step => step.proposal.support_plan.question_key);
  assert.notEqual(keys[0], keys[1]);
  const secondReturn = await game.advance(), record = records.mock.calls.at(-1)!;
  assert.deepEqual([secondReturn.matched, record.result.events[0].local_delta, record.this!.directions.ACTION4], [null, [0, -8], [0, 1]]);
  assert.ok(keys.every(key => record.this!.control_questions.attempted.has(key)));
  const next = await game.ticket();
  assert.deepEqual([next.release.family, next.proposal.kind, next.command.actionRef, next.release.missingControl],
    ['sliding_cavity', 'sliding_cavity_access', 'ACTION1', undefined]);
  assert.equal((await game.advance()).matched, true);
});

test('a fresh alternate native AS66 offer changes the real command, return and next plan at identical T6 evidence', async t => {
  const records = t.mock.method(SlidingCavity.prototype, 'record');
  const produce = SlidingCavity.prototype.proposeDirectionQuestion;
  let replaced = false;
  t.mock.method(SlidingCavity.prototype, 'proposeDirectionQuestion', async function (this: SlidingCavity, ...args: Parameters<typeof produce>) {
    const normal = await produce.apply(this, args);
    if (args[0].revision !== 6) return normal;
    assert.equal(normal!.actions[0].action_ref, 'ACTION1');
    const order = this.policy.action_order as string[];
    const other = new SlidingCavity({ sliding_cavity: { ...this.policy, action_order: ['ACTION4', ...order.filter(a => a !== 'ACTION4')] },
      cavity_binding_scope: this.scope_policy, cavity_clock_composition: this.clock_policy });
    other.restore(this.state());
    const offer = await produce.apply(other, args);
    assert.deepEqual(offer!.binding, normal!.binding);
    assert.deepEqual(offer!.question.hypothesis_refs, normal!.question.hypothesis_refs);
    assert.notEqual(offer!.support_plan.question_key, normal!.support_plan.question_key);
    replaced = true;
    return offer;
  });
  const game = await start(true), alternate = await game.ticket();
  assert.ok(replaced);
  checkProbe(alternate, 'ACTION4', [48, 26], alternate.release.observationRef);
  const outcome = await game.advance(fixture.alternateReturns[0]);
  assert.equal(outcome.matched, null);
  const measurement = records.mock.calls.at(-1)!.result.events[0];
  assert.deepEqual([measurement.before, measurement.after, measurement.local_delta],
    [alternate.release.observationRef, outcome.observation_ref, [0, -20]]);
  const next = await game.ticket();
  assert.deepEqual([next.command.actionRef, next.proposal.kind, next.proposal.support_plan.positions[0]],
    ['ACTION2', 'sliding_cavity_access', [28, 26]]);
  assert.equal(next.release.observationRef, outcome.observation_ref);
  assert.equal((await game.advance(fixture.alternateReturns[1])).matched, true);
});

function unchangedReturn() {
  const packet = structuredClone(fixture.observations[5]);
  packet.stepIndex = fixture.observations[6].stepIndex;
  packet.frames = [structuredClone(packet.frame)];
  return packet;
}

test('same geometry at a fresh revision keeps the failed question attempted and releases another probe', async () => {
  const game = await start(), first = await game.ticket();
  const outcome = await game.advance(unchangedReturn());
  const next = await game.ticket();
  checkProbe(next, 'ACTION4', [48, 26], first.release.observationRef);
  assert.equal(next.release.observationRef, outcome.observation_ref);
  assert.notEqual(next.release.observationRef, first.release.observationRef);
  assert.equal(next.proposal.support_plan.before_frame, first.proposal.support_plan.before_frame);
});

test('the native composition authority rejects a prior AS66 offer even when board, geometry and epoch still match', async t => {
  const guards = t.mock.method(SlidingCavity.prototype, 'before');
  const produce = SlidingCavity.prototype.propose;
  let previous: Row | null = null, offered = false;
  t.mock.method(SlidingCavity.prototype, 'propose', async function (this: SlidingCavity, ...args: Parameters<typeof produce>) {
    if (args[0].revision === 7) { assert.ok(previous); offered = true; return previous; }
    const plan = await produce.apply(this, args);
    if (args[0].revision === 6) previous = plan;
    return plan;
  });
  const game = await start(), first = await game.ticket();
  assert.equal(first.command.actionRef, 'ACTION1');
  const call = guards.mock.calls.at(-1)!, [plan, index, packet, observation] = call.arguments;
  const sameBoard = { ...observation, observation_ref: observation.observation_ref.replace(':revision:6:', ':revision:7:') };
  assert.deepEqual(call.this!.before(plan, index, packet, sameBoard), { admitted: true, reason: 'current_cavity_body_surface_bound' });
  await game.advance(unchangedReturn());
  const stopped = await game.current();
  assert.ok(offered);
  assert.deepEqual([stopped.kind, stopped.snapshot.reason], ['stopped', 'composition_target_stale_proposal']);
  assert.equal(stopped.ticket ?? null, null);
});

test('question keys track the cavity geometry, while loss of a unique bound body suspends the experiment', async () => {
  const game = load('v6-sliding-cavity-reference.json.gz').games.find((game: Row) => game.code === 'AS66');
  const [first, second] = game.steps.filter((step: Row) => step.proposal?.kind === 'cavity_direction_question');
  const family = new SlidingCavity();
  family.restore(first.beforeState);
  const ask = (view: Row) => family.propose(view.before.observation, view.before.public.frame_rows, [], view.remaining);
  const trial = (await ask(first))!;
  family.control_questions.recordAttempt(trial.support_plan.question_key);
  assert.equal((await ask(first))!.actions[0].action_ref, 'ACTION4');
  // Hold learned directions fixed. Only the current public scene moves to the second position.
  const moved = (await ask(second))!;
  assert.equal(moved.actions[0].action_ref, 'ACTION1');
  assert.notEqual(moved.support_plan.question_key, trial.support_plan.question_key);
  const pub = first.before.public, rows = pub.frame_rows.map((row: number[]) => [...row]);
  const [x, y] = trial.support_plan.positions[0], [, h, w] = trial.support_plan.body_type;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) rows[yy][xx] = family.floor;
  const packet = { ...pub, frame_rows: rows, frame_packet: [rows], frame_hash: await publicFrameHash(rows) };
  const observation = await measureNativeObservation(packet, 20, 'cavity-no-body');
  assert.equal(await family.propose(observation, rows, [], first.remaining), null);
});
