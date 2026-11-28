import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_CD82_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { SurfaceProgram }: typeof import('../src/logos-engine/v6-surface-program.ts') =
  await import(moduleURL('src/logos-engine/v6-surface-program.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_CD82_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'CD82', level: 1 }), sequence);
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

const historical = [1, 2, 3, 3, 1, 2, 2, 4, 5, 5, 6, 4, 2, 2, 5, 6];
const referenceBox = [3, 3, 12, 12];
const editedBox = [27, 34, 36, 43];
type Owner = InstanceType<typeof SurfaceProgram>;
type Packet = ReturnType<typeof toV6PublicObservation>;

function changed(before: Packet, after: Packet, [left, top, right, bottom]: number[]) {
  return before.frame.slice(top, bottom + 1)
    .reduce((count, row, y) => count + row.slice(left, right + 1)
      .filter((value, x) => value !== after.frame[top + y][left + x]).length, 0);
}

test('89 reuses the learned write on a new reference then composes it with a hue change', async t => {
  const record = SurfaceProgram.prototype.record;
  const records = new Map<number, Row>();
  t.mock.method(SurfaceProgram.prototype, 'record', function (this: Owner, ...args: Parameters<typeof record>) {
    const event = record.apply(this, args);
    records.set(Number(args[0].revision), event);
    return event;
  });
  const original = SurfaceProgram.prototype.before;
  let rejectedReference: Row | undefined;
  t.mock.method(SurfaceProgram.prototype, 'before', function (this: Owner, ...args: Parameters<typeof original>) {
    const [proposal, index, packet, observation] = args;
    if (observation.level_epoch === 2 && observation.revision === 10) {
      const changedTarget = packet.frame_rows.map(row => [...row]);
      const [left, top] = referenceBox;
      changedTarget[top][left] = (changedTarget[top][left] + 1) % 16;
      rejectedReference = original.call(this, proposal, index, { ...packet, frame_rows: changedTarget }, observation);
    }
    return original.apply(this, args);
  });

  const game = await start();
  for (const [i, action] of historical.entries()) {
    const turn = i + 1, before = game.observation;
    const decision = await game.decision();
    const plan = decision.proposal.surface_plan;
    assert.deepEqual([decision.family, decision.proposal.kind, decision.command.actionRef, decision.guard.admitted, decision.guard.reason],
      ['surface_program', 'surface_rewrite_program', 'ACTION' + action, true, 'bind_current_template_color_pose_and_surface']);
    assert.deepEqual([plan.fixed_reference, plan.editable_candidate], [referenceBox, editedBox]);
    if (turn === 1) assert.deepEqual([plan.current_pose, plan.current_hue, plan.label_assignments_left, plan.backward_program],
      [6, 15, 240, [[2, 15]]]);
    if (turn === 10) {
      assert.deepEqual([plan.current_pose, plan.current_hue, plan.label_assignments_left, plan.backward_program],
        [6, 15, 1, [[6, 15], [1, 12]]]);
      assert.deepEqual(rejectedReference, { admitted: false, reason: 'bind_current_template_color_pose_and_surface' });
    }
    if (turn === 11) assert.deepEqual([decision.command.data, plan.backward_program], [{ x: 46, y: 4 }, [[1, 12]]]);
    const outcome = await game.advance();
    if (turn === 1) {
      assert.deepEqual([outcome.matched, records.get(turn)?.compatible_labels, changed(before, game.observation, editedBox)], [null, 96, 0]);
    }
    if (turn === 9 || turn === 15) {
      assert.equal(game.observation.levelsCompleted, turn === 9 ? 1 : 2);
      assert.equal(outcome.reason, 'official_boundary');
    }
    if (turn === 10) {
      assert.deepEqual([outcome.matched, records.get(turn)?.compatible_labels, changed(before, game.observation, editedBox),
        changed(before, game.observation, referenceBox)], [true, 1, 50, 0]);
    }
  }
});

test('89 changes the offered input when the new surface can no longer reuse the prior assignment', async t => {
  const original = SurfaceProgram.prototype.start;
  let withdrawn = false;
  t.mock.method(SurfaceProgram.prototype, 'start', function (this: Owner, ...args: Parameters<typeof original>) {
    if (args[0].level_epoch !== 2 || withdrawn) return original.apply(this, args);
    const saved = this.prior;
    assert.equal(saved?.models.length, 1);
    withdrawn = true;
    this.prior = null;
    try {
      return original.apply(this, args);
    } finally {
      this.prior = saved;
    }
  });
  const game = await start();
  for (let i = 0; i < 9; i++) {
    assert.equal((await game.decision()).command.actionRef, 'ACTION' + historical[i]);
    await game.advance();
  }
  const before = game.observation;
  const decision = await game.decision();
  assert.ok(withdrawn);
  assert.equal(game.observation, before);
  const plan = decision.proposal.surface_plan;
  assert.deepEqual([decision.family, plan.label_assignments_left, plan.backward_program], ['surface_program', 240, [[6, 15], [1, 12]]]);
  assert.equal(decision.command.actionRef, 'ACTION1');
  const outcome = await game.advance();
  const next = await game.decision();
  assert.deepEqual([outcome.matched, changed(before, game.observation, editedBox),
    next.command.actionRef, next.proposal.surface_plan.label_assignments_left], [null, 0, 'ACTION2', 96]);
});
