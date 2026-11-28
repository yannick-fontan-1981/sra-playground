import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_ZIPP_67_71_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { TraceFieldMemory }: typeof import('../src/logos-engine/v6-trace-field-access.ts') = await import(moduleURL('src/logos-engine/v6-trace-field-access.ts'));
const { OutlineService }: typeof import('../src/logos-engine/v6-outline-service.ts') = await import(moduleURL('src/logos-engine/v6-outline-service.ts'));
const { OutlinePolicy }: typeof import('../src/logos-engine/v6-outline-policy.ts') = await import(moduleURL('src/logos-engine/v6-outline-policy.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_ZIPP_67_71_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const load = { type: 'load', code: 'ZIPP', level: 1 };
const clickPath = [[32, 12], [48, 12], [48, 28], [32, 28], [16, 28], [16, 44], [32, 44], [48, 44]];

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch(load), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    get observation() { return observation; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance() {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      observation = toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

test('67 acquires two distinct ordered extensions before committing the rest of the measured field path', async t => {
  const record = t.mock.method(TraceFieldMemory.prototype, 'record');
  const game = await start(), acquired: string[] = [];
  for (let n = 1; n <= 8; n++) {
    const d = await game.decision(), p = d.proposal.trace_field_plan, [x, y] = clickPath[n - 1]!;
    const step = d.proposal.steps[d.guard.index];
    assert.deepEqual([d.family, d.proposal.field_subquestion, d.proposal.kind, d.command.actionRef, d.command.data,
      d.guard.admitted, d.guard.reason, step.relation_observed],
      ['public_occurrence_recall', 'trace_field_composition', 'trace_field_experiment', 'ACTION6', { x, y },
        true, 'trace_current_head_and_point_bound', n >= 3]);
    if (n <= 3) {
      assert.deepEqual([p.scene.geometry.shape, p.scene.geometry.bbox, p.scene.geometry.pitch, p.scene.trace_value, p.commands.length,
        p.state.successes.map((e: Row) => e.after_ref)],
        [[3, 3], [8, 4, 56, 52], 16, n === 1 ? null : 12, n <= 2 ? 1 : 6, acquired]);
      assert.deepEqual([step.source, step.target], n === 1 ? [[0, 0], [1, 0]] : n === 2 ? [[1, 0], [2, 0]] : [[2, 0], [2, 1]]);
    }
    const out = await game.advance();
    acquired.push(out.observation_ref);
    assert.deepEqual([out.family, out.matched, game.observation.levelsCompleted], ['public_occurrence_recall', n < 8 ? true : null, n === 8 ? 1 : 0]);
    if (n <= 2 || n === 8) {
      const event = record.mock.calls.flatMap(call => call.result || []).find((e: Row) => e.transition.after_ref === out.observation_ref)!;
      assert.deepEqual([event.transition.source, event.transition.target, event.transition.outcome, event.transition.outside_support_effect_role],
        [step.source, step.target, n === 8 ? 'official_boundary' : 'local_extension_observed', 'unknown']);
    }
  }
  const next = await game.decision();
  assert.deepEqual([game.observation.level, next.family, next.command.actionRef], [2, 'containment', 'ACTION1']);
});

test('67 retains the same click in a measured field with only one acquired edge and seals before continuing', async t => {
  const original = TraceFieldMemory.prototype.applyEvent;
  let removed = false;
  t.mock.method(TraceFieldMemory.prototype, 'applyEvent', function (this: InstanceType<typeof TraceFieldMemory>, event: Row) {
    if (event.state?.epoch === 1 && event.transition?.after_ref.includes(':revision:3:')) {
      const successes = event.state.successes.filter((e: Row) => e.after_ref !== event.transition.after_ref);
      removed ||= successes.length !== event.state.successes.length;
      return original.call(this, { ...event, state: { ...event.state, successes } });
    }
    return original.call(this, event);
  });
  const game = await start();
  for (let n = 1; n <= 2; n++) { await game.decision(); await game.advance(); }
  const next = await game.decision(), p = next.proposal.trace_field_plan;
  assert.ok(removed);
  assert.deepEqual([next.family, next.command.data, p.scene.prefix, p.state.successes.length, p.commands.length, next.proposal.steps[0].relation_observed],
    ['public_occurrence_recall', { x: 48, y: 28 }, [[0, 0], [1, 0], [2, 0]], 1, 1, false]);
  const revision = next.proposal.binding.observation_ref;
  assert.equal((await game.advance()).matched, true);
  const following = await game.decision();
  assert.notEqual(following.proposal.binding.observation_ref, revision);
  assert.deepEqual([following.family, following.command.data, following.proposal.actions.length], ['public_occurrence_recall', { x: 32, y: 28 }, 5]);
});

test('71 binds an exact-fit contour from current-level returns, with an unchanged local probe and ordinary continuation', async t => {
  const record = t.mock.method(OutlineService.prototype, 'recordSource');
  const sourceBefore = OutlineService.prototype.beforeSource;
  let contourRejected: Row | undefined;
  t.mock.method(OutlineService.prototype, 'beforeSource', function (this: InstanceType<typeof OutlineService>,
    ...args: Parameters<typeof sourceBefore>) {
    const [proposal, index, packet, observation] = args;
    if (observation.level_epoch === 2 && observation.revision === 14 && proposal.outline_plan?.operator) {
      const changed = packet.frame_rows.map(row => [...row]);
      const [l, top, r, b] = proposal.outline_plan.measurement.current.bbox, value = proposal.outline_plan.measurement.current.value;
      for (let y = top; y <= b; y++) for (let x = l; x <= r; x++) if (x === l || x === r || y === top || y === b) changed[y]![x] = (value + 1) % 16;
      contourRejected = sourceBefore.call(this, proposal, index, { ...packet, frame_rows: changed }, observation);
    }
    return sourceBefore.apply(this, args);
  });
  const game = await start();
  const outlineEvidence: string[] = [];
  for (let n = 1; n <= 13; n++) {
    const d = await game.decision(), before = game.observation.frame;
    if (n >= 9) {
      assert.equal(d.family, 'containment');
      outlineEvidence.push(d.proposal.binding.observation_ref);
    }
    if (n === 13) assert.equal(d.command.actionRef, 'ACTION5');
    await game.advance();
    if (n === 13) assert.notDeepEqual(game.observation.frame, before, 'the preceding ACTION5 changed the real game');
  }
  const d = await game.decision(), p = d.proposal.outline_plan;
  assert.deepEqual([d.family, d.proposal.material_access_subquestion, p.meaning.kind, p.measurement.facts.exact_locus, p.measurement.facts.local_operator_observed, d.command.actionRef,
    d.proposal.steps[0].expected_after, d.guard.reason, p.measurement.current.bbox],
    ['public_outline_service', 'observed_outline_service', 'local_operator_hypothesis', true, false, 'ACTION5', null, 'current_outline_and_sealed_action', [11, 43, 17, 49]]);
  assert.deepEqual([p.control.level_epoch, p.control.evidence], [2, outlineEvidence]);
  assert.ok(d.proposal.route_refs.includes(d.proposal.binding.observation_ref));
  assert.deepEqual(contourRejected, { admitted: false, reason: 'outline_or_command_changed' });
  const policy = await OutlinePolicy.create();
  const [withoutFit] = await policy.evaluate({ ...p.measurement.facts, exact_locus: false });
  assert.deepEqual([withoutFit.status, withoutFit.conclusions, withoutFit.release_authority], ['abstain', [], false]);

  const before = game.observation.frame, out = await game.advance();
  const receipts = await Promise.all(record.mock.calls.map(call => call.result));
  const own = receipts.find(r => r?.status === 'no_visible_local_change' && r.evidence.at(-1) === out.observation_ref)!;
  assert.deepEqual([out.matched, out.reason, own.local_count, own.scope], [null, 'unknown_local_operator_effect_compare_public_return', 0, 2]);
  assert.deepEqual(game.observation.frame, before);
  const following = await game.decision();
  assert.deepEqual([following.family, following.command.actionRef], ['acquire_control_for_target', 'ACTION2']);
});

test('71 retains the current outline decision when the preceding level contributes no trace boundary event', async t => {
  const original = TraceFieldMemory.prototype.record;
  let removed = false;
  t.mock.method(TraceFieldMemory.prototype, 'record', function (this: InstanceType<typeof TraceFieldMemory>,
    ...args: Parameters<typeof original>) {
    const [before, , after, , , proposal] = args;
    if (before.level_epoch === 1 && after.level_epoch === 2 && proposal.kind === 'trace_field_experiment') {
      removed = true;
      return [];
    }
    return original.apply(this, args);
  });
  const game = await start();
  for (let n = 1; n <= 13; n++) {
    const prior = await game.decision();
    if (n <= 8) {
      const [x, y] = clickPath[n - 1]!;
      assert.deepEqual([prior.family, prior.command.actionRef, prior.command.data], ['public_occurrence_recall', 'ACTION6', { x, y }]);
    } else {
      assert.deepEqual([prior.family, prior.command.actionRef], ['containment', 'ACTION' + (n - 8)]);
    }
    await game.advance();
  }
  assert.ok(removed);
  const d = await game.decision(), p = d.proposal.outline_plan;
  assert.deepEqual([game.observation.levelsCompleted, d.family, d.command.actionRef, p.meaning.kind, p.control.level_epoch, p.measurement.current.bbox],
    [1, 'public_outline_service', 'ACTION5', 'local_operator_hypothesis', 2, [11, 43, 17, 49]]);
  const out = await game.advance();
  assert.deepEqual([out.family, out.matched], ['public_outline_service', null]);
  const following = await game.decision();
  assert.deepEqual([following.family, following.command.actionRef], ['acquire_control_for_target', 'ACTION2']);
});
