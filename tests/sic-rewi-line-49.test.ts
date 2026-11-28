import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_REWI_49_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { FramedWindowMemory, framedWindowBefore }: typeof import('../src/logos-engine/v6-framed-window-access.ts') =
  await import(moduleURL('src/logos-engine/v6-framed-window-access.ts'));
const { measureFramedWindow }: typeof import('../src/logos-engine/v6-framed-window-observation.ts') =
  await import(moduleURL('src/logos-engine/v6-framed-window-observation.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_REWI_49_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const load = { type: 'load', code: 'REWI', level: 1 };
const informationPoints = [34, 28, 22, 16, 10, 4];
const windowPoint = { x: 33, y: 24 };
type Edit = (o: V6PublicObservation) => V6PublicObservation;

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch(load), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    get observation() { return observation; },
    get reply() { return reply; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance(edit?: Edit, unchanged = false) {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      sequence++;
      observation = unchanged ? { ...observation, stepIndex: sequence, frames: [observation.frame] }
        : toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), sequence);
      if (edit) observation = edit(observation);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

async function opening(game: Awaited<ReturnType<typeof start>>, editLast?: Edit) {
  for (let n = 1; n <= 8; n++) {
    const d = await game.decision();
    assert.equal(measureFramedWindow(game.observation.frame), null);
    if (n <= 6) {
      assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data],
        ['information_goal', 'experiment', 'ACTION6', { x: informationPoints[n - 1], y: 61 }]);
      assert.ok(d.proposal.sic_information_decision);
    } else assert.deepEqual([d.family, d.command.actionRef], ['observed_frontier', 'ACTION3']);
    await game.advance(n === 8 ? editLast : undefined);
  }
}

test('49 binds the only exact framed window after the information prefix and records the true boundary', async t => {
  const record = t.mock.method(FramedWindowMemory.prototype, 'record');
  const game = await start();
  await opening(game);
  const d = await game.decision(), p = d.proposal.framed_window_plan;
  assert.deepEqual([d.family, d.proposal.field_subquestion, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.reason, d.proposal.steps[0].expected_after],
    ['public_occurrence_recall', 'framed_window_composition', 'framed_window_experiment', 'ACTION6', windowPoint, 'current_window_and_point_bound', null]);
  const measured = measureFramedWindow(game.observation.frame)!;
  assert.deepEqual([measured.reference_box, measured.image_box, measured.matches, measured.examined_windows],
    [[53, 53, 62, 62], [1, 1, 62, 42], [[27, 18]], 1749]);
  assert.deepEqual([p.reference_box, p.image_box, p.window, p.point, p.examined_windows, p.method_receipt.status, p.method_receipt.domain_complete],
    [measured.reference_box, measured.image_box, measured.matches[0], [33, 24], 1749, 'COMPLETE', true]);
  assert.deepEqual(d.proposal.route_refs, [p.observation_ref]);
  const out = await game.advance(), events = record.mock.calls.flatMap(c => c.result || []);
  const e = events.find((event: Row) => event.evidence.at(-1) === out.observation_ref)!;
  assert.deepEqual([out.matched, out.reason, e.kind, e.epoch, e.after_epoch, e.official_progress, e.canonical_changed, e.evidence, game.observation.levelsCompleted],
    [null, 'window_point_effect_requires_public_reconciliation', 'framed_window_response', 1, 2, true, true, [p.observation_ref, out.observation_ref], 1]);
  const next = await game.decision();
  assert.deepEqual([game.observation.level, next.family, next.command.actionRef, next.proposal.question.reason],
    [2, 'observed_frontier', 'ACTION3', 'rebind_prior_epoch_hypothesis_without_transferring_authority']);
});

test('49 abstains at the same point and frame geometry when a second exact window is present', async t => {
  const propose = t.mock.method(FramedWindowMemory.prototype, 'propose');
  const game = await start();
  let changed: V6PublicObservation | undefined;
  await opening(game, observation => {
    const frame = observation.frame.map(row => [...row]), measured = measureFramedWindow(frame)!;
    const [left, top] = measured.image_box;
    for (const [y, row] of (measured.reference as number[][]).entries()) {
      for (const [x, value] of row.entries()) frame[top + 6 + y]![left + 6 + x] = value;
    }
    const ambiguous = measureFramedWindow(frame, true)!;
    assert.deepEqual([ambiguous.reference_box, ambiguous.image_box, ambiguous.matches], [measured.reference_box, measured.image_box, [[5, 5], [27, 18]]]);
    assert.equal(measureFramedWindow(frame), null);
    changed = { ...observation, frame, frames: [frame] };
    return changed;
  });
  assert.ok(changed);
  const crop = propose.mock.calls.filter(c => c.arguments[0].revision === 9);
  assert.ok(crop.every(c => !c.result || !c.result.framed_window_plan));
  const next = await game.decision();
  assert.notEqual(next.proposal.kind, 'framed_window_experiment');
});

test('49 a no-gain return blocks the same current trial without transferring a terminal law', async t => {
  const original = FramedWindowMemory.prototype.applyEvent;
  let blocked: string[] = [], event: Row | undefined;
  t.mock.method(FramedWindowMemory.prototype, 'applyEvent', function (this: InstanceType<typeof FramedWindowMemory>, acquired: Row) {
    original.call(this, acquired);
    event = acquired;
    blocked = this.currentState().window_blocked;
  });
  const game = await start();
  await opening(game);
  const d = await game.decision(), p = d.proposal.framed_window_plan;
  assert.deepEqual([d.command.actionRef, d.command.data], ['ACTION6', windowPoint]);
  const out = await game.advance(undefined, true);
  assert.deepEqual([out.matched, event?.official_progress, event?.canonical_changed, event?.evidence, blocked, game.observation.levelsCompleted],
    [null, false, false, [p.observation_ref, out.observation_ref], [p.trial_key], 0]);
  const next = await game.decision();
  assert.notEqual(next.proposal.kind, 'framed_window_experiment');
});

test('49 the same official click one step early has no gain and cannot validate the later ticket', async () => {
  const earlier = await sourceBackend(assetRoot);
  let current = earlier.dispatch(load);
  for (const x of informationPoints) current = earlier.dispatch({ type: 'action', actionId: 6, data: { x, y: 61 } });
  current = earlier.dispatch({ type: 'action', actionId: 3 });
  const scene = toV6PublicObservation(current, 7);
  assert.equal(measureFramedWindow(scene.frame), null);
  const early = toV6PublicObservation(earlier.dispatch({ type: 'action', actionId: 6, data: windowPoint }), 8);
  assert.deepEqual([early.level, early.levelsCompleted], [1, 0]);

  const game = await start();
  await opening(game);
  const d = await game.decision(), p = d.proposal.framed_window_plan;
  assert.deepEqual(d.command.data, windowPoint);
  assert.deepEqual(framedWindowBefore(d.proposal, 0, scene.frame, { epoch: 1, score: 0, observation_ref: p.observation_ref, available: ['ACTION6'] }),
    { admitted: false, reason: 'window_context_or_payload_changed' });
});
