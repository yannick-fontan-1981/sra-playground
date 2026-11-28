import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_LP85_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { OrbitConstraints, orbitValues }: typeof import('../src/logos-engine/v6-orbit-constraints.ts') =
  await import(moduleURL('src/logos-engine/v6-orbit-constraints.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_LP85_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const first = [5, 32];
const firstResult = [2, 1, 10, 15, 2, 10, 1, 9, 1, 15, 9, 11, 9, 2, 10, 15, 9, 10, 2, 15];
const points = [first, [58, 32], first, first, first, first, first, [14, 26], [14, 35],
  [20, 17], [39, 17], [48, 26], [48, 35], [14, 35], [14, 26], [14, 26]];

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'LP85', level: 1 }), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 19 } });
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

test('24 measures two controls and composes the observed permutations, then narrows rivals in a different field', async t => {
  const record = t.mock.method(OrbitConstraints.prototype, 'record');
  const original = OrbitConstraints.prototype.before;
  let denied: Row | undefined;
  t.mock.method(OrbitConstraints.prototype, 'before', async function (this: InstanceType<typeof OrbitConstraints>,
    ...args: Parameters<typeof original>) {
    const [proposal, index, packet, observation] = args;
    if (observation.level_epoch === 1 && index === 1) {
      const [x, y] = proposal.orbit_plan.positions[0], size = proposal.orbit_plan.size;
      const frame = packet.frame_rows.map(row => [...row]), color = (frame[y]![x]! + 1) % 16;
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) frame[y + dy]![x + dx] = color;
      denied = await original.call(this, proposal, index, { ...packet, frame_rows: frame }, observation);
    }
    return await original.apply(this, args);
  });
  const game = await start(), refs = new Map<number, string>();
  let initialSlots: number[] = [], beforeFifteen: number[] = [];
  for (let n = 1; n <= 17; n++) {
    const d = await game.decision(), p = d.proposal.orbit_plan, step = d.proposal.steps[d.guard.index];
    const [x, y] = points[n - 1] ?? [14, 35];
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.admitted, d.guard.reason],
      ['orbit_constraints', 'measured_slot_permutation', 'ACTION6', { x, y }, true, 'compare_frozen_positions_contents_and_control']);
    assert.deepEqual(step.before_values, orbitValues(game.observation.frame, p.positions, p.size));
    if (n === 1) {
      initialSlots = step.before_values;
      assert.deepEqual([p.positions.length, p.size, p.candidate_control_count, p.targets, p.unique_observed_operators, step.expected_after],
        [20, 4, 2, [[0, 11]], 0, null]);
    }
    if (n === 2) assert.deepEqual([p.unique_observed_operators, step.expected_after], [1, null]);
    if (n === 3) {
      assert.deepEqual([step.before_values, step.expected_after, p.unique_observed_operators, d.proposal.actions.length],
        [initialSlots, firstResult, 2, 5]);
      assert.ok(d.proposal.route_refs.includes(refs.get(1)));
    }
    if (n === 4) assert.deepEqual(denied, { admitted: false, reason: 'compare_frozen_positions_contents_and_control' });
    if (n === 8) assert.deepEqual([p.positions.length, p.size, p.candidate_control_count, p.targets, p.unique_observed_operators],
      [42, 2, 6, [[29, 11], [32, 11]], 0]);
    if (n === 15) beforeFifteen = [...step.before_values];
    if (n === 16) {
      assert.notDeepEqual(step.before_values, beforeFifteen);
      assert.equal(step.expected_after, null);
      assert.match(p.why, /different content arrangement/);
    }
    if (n === 17) assert.equal(p.unique_observed_operators, 3);

    const out = await game.advance();
    refs.set(n, out.observation_ref);
    const event = record.mock.calls.map(c => c.result as Row).findLast(r => r?.ref === out.observation_ref)!;
    if (n === 1 || n === 2 || n === 16) assert.deepEqual([event.status, event.matches], ['locally_fitted', 1]);
    if (n === 15) assert.ok(event.matches > 1);
    if (n === 3) assert.deepEqual([out.matched, orbitValues(game.observation.frame, p.positions, p.size)], [true, firstResult]);
    if (n === 7) assert.deepEqual([event.status, out.reason, game.observation.level, game.observation.levelsCompleted], ['official_boundary', 'official_boundary', 2, 1]);
  }
});

test('24 keeps the same real click but withdraws the predicted series when the measured model is absent', async t => {
  const original = OrbitConstraints.prototype.propose;
  let removed: Row | undefined;
  t.mock.method(OrbitConstraints.prototype, 'propose', function (this: InstanceType<typeof OrbitConstraints>,
    ...args: Parameters<typeof original>) {
    const [obs] = args;
    if (obs.level_epoch === 1 && obs.revision === 3) {
      const found = [...this.models].find(([, model]) => model.key[0] === first[0] && model.key[1] === first[1]);
      assert.ok(found);
      const [key, model] = found;
      assert.equal(model.permutations.length, 1);
      removed = this.refs.get(key);
      this.models.delete(key);
      this.refs.delete(key);
    }
    return original.apply(this, args);
  });
  const game = await start();
  let evidenceRef: string | undefined;
  for (let n = 1; n <= 2; n++) {
    await game.decision();
    const out = await game.advance();
    if (n === 1) evidenceRef = out.observation_ref;
  }
  const d = await game.decision(), p = d.proposal.orbit_plan;
  assert.deepEqual([removed?.ref, d.family, d.command.data, p.unique_observed_operators, d.proposal.actions.length, d.proposal.steps[0].expected_after],
    [evidenceRef, 'orbit_constraints', { x: first[0], y: first[1] }, 1, 1, null]);
  assert.ok(!d.proposal.route_refs.includes(evidenceRef));
  const out = await game.advance();
  assert.deepEqual([out.matched, orbitValues(game.observation.frame, p.positions, p.size)], [null, firstResult]);
  const next = await game.decision();
  assert.equal(next.proposal.orbit_plan.unique_observed_operators, 2);
  assert.ok(next.proposal.route_refs.includes(out.observation_ref));
});
