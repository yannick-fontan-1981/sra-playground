import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_KEYD_ENGINE_ROOT;
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
const assetRoot = process.env.SIC_KEYD_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'KEYD', level: 1 }), sequence);
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

const inventory = 'public_observed_inventory';
const actions = [4, 4, 2, 2, 5, 1, 1, 4, 4, 2, 2, 4, 4, 2, 2, 3];
const partition = [24, 6, 28, 10];
const display = [43, 58, 47, 61];

type InventoryOwner = InstanceType<typeof ObservedInventory>;
function pixels(observation: ReturnType<typeof toV6PublicObservation>, [left, top, right, bottom]: number[]) {
  return observation.frame.slice(top, bottom + 1).flatMap(row => row.slice(left, right + 1));
}

test('38 measures the held signature, a local access return and its prospective use in KEYD', async t => {
  const record = ObservedInventory.prototype.recordSource;
  const receipts = new Map<number, Row>();
  t.mock.method(ObservedInventory.prototype, 'recordSource', function (this: InventoryOwner, ...args: Parameters<typeof record>) {
    const result = record.apply(this, args);
    if (result) receipts.set(args[0].revision, result);
    return result;
  });
  const game = await start();
  let access: Row | undefined;
  for (const [i, id] of actions.entries()) {
    const turn = i + 1, before = game.observation;
    const { command, family, proposal, guard } = await game.decision();
    assert.deepEqual([family, proposal.kind, command.actionRef, guard.admitted],
      [inventory, 'public_inventory_composition', 'ACTION' + id, true]);
    const { offer } = proposal.inventory_plan;
    const kind = turn < 5 ? 'approach_candidate' : turn === 5 ? 'acquisition_probe_candidate'
      : turn <= 8 ? 'access_probe_candidate' : 'capacity_probe_candidate';
    assert.equal(offer.kind, kind);
    if (turn === 5) {
      assert.deepEqual(offer.target.source_bbox, [19, 16, 23, 19]);
      assert.equal(offer.scene.displayed_candidate, null);
    }
    if (turn >= 6 && turn <= 8) {
      assert.equal(offer.scene.displayed_candidate.status, 'observed_correspondence_possession_hypothesis');
      assert.deepEqual(offer.scene.displayed_candidate.display_bbox, display);
      assert.deepEqual([offer.target.target_row, offer.target.target_col], [1, 4]);
    }
    if (turn >= 9) {
      assert.ok(access);
      assert.deepEqual(offer.target.dependency_return, access);
      assert.equal(offer.target.appearance_relation_only, true);
      assert.deepEqual(offer.target.target_bbox, [19, 26, 23, 30]);
    }
    const outcome = await game.advance();
    assert.equal(outcome.matched, turn === 5 ? null : true);
    assert.equal(game.observation.levelsCompleted, 0);
    if (turn === 5) {
      assert.notDeepEqual(pixels(game.observation, display), pixels(before, display));
      assert.equal(receipts.get(turn)?.status, 'unique_corresponding_transfer');
    }
    if (turn === 9) assert.deepEqual(locate(game.observation.frame, offer.core), [30, 7, 32, 9]);
    if (turn === 8) {
      assert.deepEqual(locate(game.observation.frame, offer.core), [25, 7, 27, 9]);
      access = receipts.get(turn)?.dependency_return;
      assert.ok(access);
      assert.deepEqual([access.status, access.level_epoch, access.partition_bbox, access.partition_changed_pixels,
        access.display_bbox, access.display_signature_disappeared, access.entered_bound_partition, access.objective_ref],
      ['local_access_return', 1, partition, 11, display, true, true, 'G_official_completion']);
      assert.deepEqual(access.evidence, [access.before, access.after]);
      assert.match(access.before, /:revision:8:/);
      assert.match(access.after, /:revision:9:/);
      assert.notDeepEqual(pixels(game.observation, display), pixels(before, display));
      assert.deepEqual(access.unknown, ['universal_consumption', 'capacity', 'terminal_rule', 'new_resource_effect']);
    }
  }
});

for (const variant of ['missing', 'earlier ref', 'earlier transition'] as const) {
  test('38 current T9 with ' + variant + ' access evidence', async t => {
    const project = ObservedInventory.prototype.project;
    const refs = new Map<number, string>();
    let substituted: string[] | undefined;
    t.mock.method(ObservedInventory.prototype, 'project', function (this: InventoryOwner, ...args: Parameters<typeof project>) {
      const requestRef = String(args[0].observation_ref);
      const revision = Number(/:epoch:1:revision:(\d+):/.exec(requestRef)?.[1]);
      refs.set(revision, requestRef);
      if (revision !== 9) return project.apply(this, args);
      const previous = this.access_returns;
      const current = previous.find(receipt => receipt.active && receipt.after === requestRef);
      assert.ok(current);
      assert.equal(current.before, refs.get(8));
      const wrongBefore = variant === 'earlier transition' ? refs.get(7)! : current.before;
      const wrongAfter = refs.get(variant === 'earlier transition' ? 8 : 6)!;
      assert.ok(wrongBefore && wrongAfter);
      substituted = variant === 'missing' ? [] : [wrongBefore, wrongAfter];
      this.access_returns = previous.flatMap(receipt => receipt !== current ? [receipt] : variant === 'missing' ? []
        : [{ ...receipt, before: wrongBefore, after: wrongAfter, evidence: substituted }]);
      try {
        return project.apply(this, args);
      } finally {
        this.access_returns = previous;
      }
    });
    const game = await start();
    for (let turn = 1; turn < 9; turn++) {
      assert.equal((await game.decision()).command.actionRef, 'ACTION' + actions[turn - 1]);
      await game.advance();
    }
    const before = game.observation;
    const decision = await game.decision();
    const offer = decision.proposal.inventory_plan.offer;
    assert.ok(substituted);
    assert.equal(game.observation, before);
    assert.deepEqual([decision.family, decision.command.actionRef, decision.guard.admitted], [inventory, 'ACTION4', true]);
    assert.equal(offer.kind, 'endpoint_approach_candidate');
    assert.equal(offer.target.endpoint_role, 'unknown');
    assert.equal(offer.target.dependency_return?.status, undefined);
    const outcome = await game.advance();
    assert.equal(outcome.matched, true);
    assert.deepEqual(locate(game.observation.frame, offer.core), [30, 7, 32, 9]);
    assert.equal(game.observation.levelsCompleted, 0);
  });
}
