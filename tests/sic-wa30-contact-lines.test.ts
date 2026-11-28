import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_WA30_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { OrientedCoupling }: typeof import('../src/logos-engine/v6-oriented-coupling.ts') = await import(moduleURL('src/logos-engine/v6-oriented-coupling.ts'));
const { EffectAccess }: typeof import('../src/logos-engine/v6-effect-access.ts') = await import(moduleURL('src/logos-engine/v6-effect-access.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gzip = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gzip('../docs/migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz').packets;
const alternatives = gzip('./fixtures/sic-wa30-alternate-returns.json.gz');
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const oriented = 'oriented_coupling', access = 'pre_score_contact', frontier = 'observed_frontier';
const sites = [{ site: [36, 29], action_ref: 'ACTION1' }, { site: [32, 33], action_ref: 'ACTION3' }];
function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_WA30_GAME_ROOT ? await sourceBackend(process.env.SIC_WA30_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const actual = toV6PublicObservation(backend.dispatch(request), n);
    if (expected.palette === undefined) {
      const { palette, ...archivedFields } = actual;
      assert.deepEqual(archivedFields, expected, 'official WA30 return ' + n);
    } else {
      assert.deepEqual(actual, expected, 'official WA30 return ' + n);
    }
    return actual;
  }
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'WA30', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard');
      assert.equal(guard?.admitted, true);
      return { owner: reply.snapshot.lastDecision, command: reply.command!, p, guard: guard! };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const { actionRef, data } = reply.command!;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, expected, sequence) });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
function changedPixels(before: V6PublicObservation, after: V6PublicObservation): number {
  return before.frame.reduce((count, row, y) =>
    count + row.filter((value, x) => value !== after.frame[y]![x]).length, 0);
}
type Game = Awaited<ReturnType<typeof start>>;
async function prefix(game: Game, count: number) {
  for (let n = 1; n <= count; n++) {
    const ticket = await game.decision();
    assert.deepEqual([ticket.command.actionRef, ticket.command.data], [archive[n].command.action_ref, archive[n].command.data]);
    await game.advance();
  }
}
test('26 WA30 reproduces the inventory and distinguishes an invitation, a relation candidate and rigid translation', async t => {
  const record = t.mock.method(OrientedCoupling.prototype, 'record');
  const game = await start(16, true);
  for (let n = 1; n <= 16; n++) {
    const { owner, command, p, guard } = await game.decision();
    assert.deepEqual([command.actionRef, command.data], [archive[n].command.action_ref, archive[n].command.data]);
    assert.equal(owner, n <= 2 ? frontier : n <= 15 ? oriented : access);
    if (n === 3) {
      assert.deepEqual([p.kind, p.material_access_subquestion, guard.reason, p.steps[0].expected_after],
        ['conditional_oriented_coupling', oriented, 'current_controller_part_masks_and_orientation', null]);
      const invitation = record.mock.calls.at(-1)!.result!.events[0] as Row;
      assert.equal(invitation.kind, 'front_contour_invitation');
      assert.ok(p.question.hypothesis_refs.includes(invitation.evidence));
      assert.deepEqual(p.steps[0].expected_before.pose, [8, 10]);
      assert.deepEqual(p.steps[0].expected_before.face, [0, -1]);
    }
    const outcome = await game.advance();
    assert.equal(outcome.matched, n >= 4 && n <= 15 ? true : null);
    if (n === 3 || n === 4) {
      assert.equal(changedPixels(packet(n - 1), packet(n)), n === 3 ? 12 : 44);
      const call = record.mock.calls.at(-1)!;
      const [event] = call.result!.events as Row[];
      assert.deepEqual([event!.kind, event!.evidence, event!.delta, call.this.coupled, call.this.held], n === 3
        ? ['visible_relation_change_candidate', outcome.observation_ref, undefined, false, [8, 9]]
        : ['public_rigid_pair_translation', outcome.observation_ref, [0, -1], true, [8, 8]]);
    }
  }
});
test('26 a stationary return after the same ACTION5 keeps the trial but grants no attachment or displacement', async t => {
  const record = t.mock.method(OrientedCoupling.prototype, 'record');
  const game = await start(16);
  await prefix(game, 2);
  const first = await game.decision();
  assert.deepEqual([first.owner, first.command.actionRef], [oriented, 'ACTION5']);
  const prior = packet(2).frame, out = await game.advance({ ...packet(3), frame: prior, frames: [prior] });
  const call = record.mock.calls.at(-1)!;
  assert.deepEqual([out.matched, call.result!.events, call.this.held, call.this.coupled, call.this.tried.size],
    [null, [], null, false, 1]);
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command.actionRef], [frontier, 'ACTION1']);
});
test('26 removing only the frontal offer releases the frontier, then the same physical pose allows the invitation again',
  { skip: !OrientedCoupling.prototype.frontalContactTrial }, async t => {
    const game = await start(16, true);
    const first = await game.decision();
    assert.equal(first.owner, frontier);
    await game.advance();
    await game.decision();
    const trial = t.mock.method(OrientedCoupling.prototype, 'frontalContactTrial');
    trial.mock.mockImplementationOnce(() => null);
    await game.advance();
    const fallback = await game.decision();
    assert.deepEqual([fallback.owner, fallback.command.actionRef], [frontier, 'ACTION1']);
    assert.deepEqual([trial.mock.calls[0]!.arguments[0].pose, trial.mock.calls[0]!.arguments[0].face], [[8, 10], [0, -1]]);
    assert.equal(changedPixels(packet(2), alternatives.off26[0]), 0);
    await game.advance(alternatives.off26[0]);
    const resume = await game.decision();
    assert.deepEqual([resume.owner, resume.command.actionRef], [oriented, 'ACTION5']);
    await game.advance(alternatives.off26[1]);
    const next = await game.decision();
    assert.deepEqual([next.owner, next.command.actionRef], [oriented, 'ACTION1']);
  });

function assertContactEvent(event: Row, plan: Row, outcome: Row) {
  assert.deepEqual([event.kind, event.before_ref, event.after_ref, event.trial_key, event.role, event.action, event.input_status,
    event.expected_families, event.matched_families, event.score_delta],
  ['pre_score_effect_contact', plan.observation_ref, outcome.observation_ref, plan.trial_key, plan.role, plan.prefix[0].action_ref,
    'measured', [], [], 0]);
}
test('31 the first site is tried with a known vector and no distant proof, then the second site and coupling take separate tickets', async t => {
  const record = t.mock.method(EffectAccess.prototype, 'record');
  const game = await start(19, true);
  await prefix(game, 15);
  for (const [i, site] of sites.entries()) {
    const ticket = await game.decision(), plan = ticket.p.effect_plan;
    assert.deepEqual([ticket.owner, ticket.p.kind, ticket.command.actionRef, plan.kind, plan.site, plan.reachable_contact_alternatives,
      plan.initial_contact_acquisition, plan.observed_nonlocal_contact_count, plan.contact_evidence, ticket.p.steps[0].expected_after,
      plan.prefix[0].from, plan.prefix[0].effect],
    [access, 'observed_effect_access', site.action_ref, 'acquire_visible_contact_response', site.site, sites.slice(i), true, 0, [], null,
      [36, 33], 'unknown_then_observe']);
    assert.equal(changedPixels(packet(15 + i), packet(16 + i)), i === 0 ? 0 : 44);
    const outcome = await game.advance();
    assert.deepEqual([outcome.matched, outcome.reason], [null, 'experimental_contact_observed']);
    const [event] = await record.mock.calls.at(-1)!.result!;
    assertContactEvent(event!, plan, outcome);
    assert.deepEqual(event!.provisional_vector, i === 0 ? [0, -4] : [-4, 0]);
  }
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command.actionRef], [oriented, 'ACTION3']);
  assert.equal((await game.advance()).matched, true);
});
test('31 withholds only acquisition of the returned trial and repeats the same site at the next decision', async t => {
  const game = await start(19);
  await prefix(game, 15);
  const ticket = await game.decision();
  assert.deepEqual([ticket.owner, ticket.command.actionRef], [access, 'ACTION1']);
  const applyOriginal = EffectAccess.prototype.applyEvent;
  const uptake = t.mock.method(EffectAccess.prototype, 'applyEvent');
  uptake.mock.mockImplementation(function (this: EffectAccess, event: Row) {
    if (event.kind !== 'pre_score_effect_contact') applyOriginal.call(this, event);
  });
  const outcome = await game.advance();
  assert.equal(outcome.matched, null);
  const events = uptake.mock.calls.map(call => call.arguments[0]);
  assert.ok(events.some(event => event.kind === 'pre_score_effect_contact' && event.after_ref === outcome.observation_ref));
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command.actionRef, next.p.effect_plan.site], [access, 'ACTION1', [36, 29]]);
});
test('31 selects the other reachable site while preserving the same observation and admits its physical receipt',
  { skip: !EffectAccess.prototype.selectInitialContact }, async t => {
    const game = await start(19, true), record = t.mock.method(EffectAccess.prototype, 'record');
    await prefix(game, 14);
    await game.decision();
    const choose = t.mock.method(EffectAccess.prototype, 'selectInitialContact');
    choose.mock.mockImplementationOnce(() => 1);
    await game.advance();
    const changed = await game.decision(), plan = changed.p.effect_plan;
    assert.deepEqual(choose.mock.calls[0]!.arguments[0], sites);
    assert.deepEqual([changed.owner, changed.command.actionRef, plan.site, plan.prefix[0].from], [access, 'ACTION3', [32, 33], [36, 33]]);
    assert.equal(changedPixels(packet(15), alternatives.alt31[0]), 44);
    const out = await game.advance(alternatives.alt31[0]), [event] = await record.mock.calls.at(-1)!.result!;
    assertContactEvent(event!, plan, out);
    const next = await game.decision();
    assert.deepEqual([next.owner, next.command.actionRef], [oriented, 'ACTION3']);
    assert.equal((await game.advance(alternatives.alt31[1])).matched, true);
  });

test('31 withdrawing the first-contact offer preserves ACTION3 in the fallback but changes who acquires it',
  { skip: !EffectAccess.prototype.selectInitialContact }, async t => {
    const game = await start(19), record = t.mock.method(EffectAccess.prototype, 'record');
    await prefix(game, 14);
    await game.decision();
    const choose = t.mock.method(EffectAccess.prototype, 'selectInitialContact');
    choose.mock.mockImplementationOnce(() => null);
    await game.advance();
    const fallback = await game.decision();
    assert.deepEqual(choose.mock.calls[0]!.arguments[0], sites);
    assert.deepEqual([fallback.owner, fallback.command.actionRef, fallback.p.effect_plan], [oriented, 'ACTION3', undefined]);
    const beforeReturn = record.mock.callCount();
    const out = await game.advance(alternatives.alt31[0]);
    assert.equal(out.family, oriented);
    const recorded = await Promise.all(record.mock.calls.slice(beforeReturn).map(call => call.result!));
    assert.deepEqual(recorded.flat().filter(event => event.kind === 'pre_score_effect_contact'), []);
    const next = await game.decision();
    assert.deepEqual([next.owner, next.command.actionRef], [oriented, 'ACTION3']);
  });
