import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_SKBN_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { ObservedInventory }: typeof import('../src/logos-engine/v6-observed-inventory.ts') =
  await import(moduleURL('src/logos-engine/v6-observed-inventory.ts'));
const { locate }: typeof import('../src/logos-engine/v6-inventory-measurements.ts') =
  await import(moduleURL('src/logos-engine/v6-inventory-measurements.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_SKBN_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'SKBN', level: 1 }), sequence);
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

const inventory = 'public_observed_inventory';
const endpointBox = [44, 9, 51, 16];
const materialBox = [46, 11, 49, 14];

function pixelChanges(before: ReturnType<typeof toV6PublicObservation>, after: ReturnType<typeof toV6PublicObservation>) {
  return before.frame.flatMap((row, y) => row.flatMap((pixel, x) => pixel === after.frame[y][x] ? [] : [[x, y]]));
}

const contains = ([left, top, right, bottom]: number[], [x, y]: number[]) =>
  left <= x && x <= right && top <= y && y <= bottom;

test('38 approaches the same unclassified endpoint from two directions and consumes neither return as access', async t => {
  const original = ObservedInventory.prototype.after;
  const measured = new Map<number, Row>();
  t.mock.method(ObservedInventory.prototype, 'after', function (this: InstanceType<typeof ObservedInventory>, ...args: Parameters<typeof original>) {
    const [proposal, index, before, after, , second] = args;
    const outcome = original.apply(this, args);
    measured.set(before.revision, {
      refs: [before.observation_ref, after.observation_ref],
      predicted: proposal.steps[index].expected_after.body_bbox,
      observed: locate(second, proposal.inventory_plan.offer.core),
      bodyMatched: outcome.body_position_matched, matched: outcome.matched, sealed: outcome.seal_prefix,
    });
    return outcome;
  });
  const game = await start();
  for (let turn = 1; turn <= 17; turn++) {
    const before = game.observation;
    const { command, family, proposal, guard } = await game.decision();
    let formerBody: number[] | undefined;
    const approach = turn === 14 || turn === 16;
    if (approach) {
      const { offer } = proposal.inventory_plan;
      formerBody = offer.scene.body;
      const direction = turn === 14 ? 'ACTION1' : 'ACTION4';
      assert.deepEqual([family, proposal.kind, command.actionRef, guard.admitted, guard.reason],
        [inventory, 'public_inventory_composition', direction, true, 'current_scoped_inventory_composition']);
      assert.deepEqual([offer.kind, offer.scene.displayed_candidate, offer.scene.display_complements, offer.scene.retained_material_surfaces],
        ['endpoint_approach_candidate', null, [], []]);
      assert.deepEqual([offer.target.source_cell, offer.target.source_bbox, offer.target.source_entity.bbox,
        offer.target.endpoint_role, offer.target.observed_at, offer.target.route_actions],
      [[1, 5], endpointBox, materialBox, 'unknown', offer.scene.observation_ref, [direction]]);
      assert.equal(offer.route.prefix[0].control.status, 'observed_translation');
      assert.ok(offer.route.prefix[0].control.evidence.length > 0);
      assert.deepEqual(offer.route.prefix[0].control.cell_delta, turn === 14 ? [-1, 0] : [0, 1]);
    }
    const result = await game.advance();
    if (formerBody) {
      const changed = pixelChanges(before, game.observation);
      assert.equal(changed.length, 62);
      assert.equal(changed.filter(point => !contains(formerBody!, point) && !contains(endpointBox, point)).length, 16);
      assert.equal(game.observation.levelsCompleted, 0);
      const receipt = measured.get(turn)!;
      assert.deepEqual([receipt.predicted, receipt.observed, receipt.bodyMatched, receipt.matched, receipt.sealed],
        [materialBox, materialBox, true, false, true]);
      assert.match(receipt.refs[0], new RegExp(':revision:' + turn + ':'));
      assert.match(receipt.refs[1], new RegExp(':revision:' + (turn + 1) + ':'));
      assert.deepEqual([result.family, result.matched, result.reason], [inventory, false, 'conditional_body_and_other_current_cells_compared']);
    }
    if (turn === 15 || turn === 17) {
      assert.deepEqual([family, command.actionRef],
        turn === 15 ? ['observed_frontier', 'ACTION3'] : ['pre_score_contact', 'ACTION3']);
    }
  }
});

test('38 suppresses the endpoint offer when the inventory marks that cell already visited', async t => {
  const project = ObservedInventory.prototype.project;
  let intervention: { ref: unknown; hadVisit: boolean; measured: boolean } | undefined;
  t.mock.method(ObservedInventory.prototype, 'project', function (this: InstanceType<typeof ObservedInventory>, ...args: Parameters<typeof project>) {
    const [request] = args;
    if (!String(request.observation_ref).includes(':epoch:1:revision:14:')) return project.apply(this, args);
    const visited = this.tracker.underlays;
    const key = materialBox.join(',');
    intervention = { ref: request.observation_ref, hadVisit: visited.has(key), measured: Boolean(this.tracker.controls.ACTION1) };
    const previous = visited.get(key);
    visited.set(key, {});
    try {
      return project.apply(this, args);
    } finally {
      if (previous) visited.set(key, previous);
      else visited.delete(key);
    }
  });
  const game = await start();
  for (let turn = 1; turn < 14; turn++) {
    await game.decision();
    await game.advance();
  }
  const decision = await game.decision();
  assert.ok(intervention);
  assert.deepEqual([intervention.hadVisit, intervention.measured], [false, true]);
  assert.match(String(intervention.ref), /:revision:14:/);
  assert.deepEqual([decision.family, decision.command.actionRef], ['observed_frontier', 'ACTION2']);
  await game.advance();
});
