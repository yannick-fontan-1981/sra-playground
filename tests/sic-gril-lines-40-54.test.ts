import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_GRIL_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { OccludedCatalogueMemory }: typeof import('../src/logos-engine/v6-occluded-catalogue-access.ts') =
  await import(moduleURL('src/logos-engine/v6-occluded-catalogue-access.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gz = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gz('../docs/migration/native-campaigns-v49/gril-public-trace.json.gz').packets;
const alternate = gz('./fixtures/sic-gril-alternate-returns.json.gz');
const recall = 'public_occurrence_recall', site = 'occluded_catalogue_experiment', view = 'catalogue_view_experiment', frontier = 'observed_frontier';
const sessionId = 'sra-v6-' + alternate.session;
function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
function delta(before: V6PublicObservation, after: V6PublicObservation) {
  return before.frame.reduce((count, row, y) => count + row.filter((value, x) => value !== after.frame[y]![x]).length, 0);
}
async function start(live = false) {
  const backend = live && process.env.SIC_GRIL_GAME_ROOT ? await sourceBackend(process.env.SIC_GRIL_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official GRIL return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'GRIL', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.equal(guard.admitted, true);
      return { owner: reply.snapshot.lastDecision, p, plan: p.occluded_catalogue_plan, guard, command: reply.command! };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const { actionRef, data } = reply.command!;
      const observation = observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
type Game = Awaited<ReturnType<typeof start>>;
function historical(d: Awaited<ReturnType<Game['decision']>>, n: number) {
  assert.deepEqual([d.command.actionRef, d.command.data], [archive[n].command.action_ref, archive[n].command.data ?? {}]);
}
async function prefix(game: Game, n: number) {
  for (let i = 1; i <= n; i++) {
    historical(await game.decision(), i);
    await game.advance();
  }
}
test('54 occurrence answer, palette selection and 40 view use distinct receipts on two GRIL levels', async t => {
  const record = t.mock.method(OccludedCatalogueMemory.prototype, 'record'), game = await start(true), refs = new Map<number, string>();
  const clickTurns = [2, 3, 5, 7, 8, 10, 12, 13, 16], viewTurns = [4, 15];
  for (let n = 1; n <= 16; n++) {
    const d = await game.decision();
    historical(d, n);
    if (clickTurns.includes(n)) {
      assert.deepEqual([d.owner, d.p.kind, d.p.field_subquestion, d.guard.reason],
        [recall, site, 'occluded_catalogue_composition', 'current_catalogue_point_bound']);
    }
    if (n === 2 || n === 12) {
      assert.deepEqual([d.plan.mode, d.plan.target_palette, d.plan.evidence.candidate, d.plan.evidence.backgrounds],
        ['answer', 8, n === 2 ? 0 : 3, [5]]);
      assert.ok(d.plan.evidence.supporting_observation_refs.includes(refs.get(n - 2)));
      assert.equal(d.p.steps[0].expected_after, null);
    }
    if (viewTurns.includes(n)) {
      const source = n === 4 ? 0 : 10;
      assert.deepEqual([d.owner, d.p.kind, d.guard.reason, d.plan.mode, d.plan.details.candidate_ids, d.plan.details.evidence_refs],
        [recall, view, 'current_catalogue_view_experiment', 'view', n === 4 ? [0, 1, 2] : [0, 1, 2, 3], [refs.get(source), refs.get(source + 1)]]);
      assert.ok(!d.plan.details.evidence_refs.includes(refs.get(n - 2)));
    }
    const out = await game.advance();
    refs.set(n, out.observation_ref);
    const acquired = record.mock.calls.at(-1)?.result ?? [];
    if (n === 1 || n === 11 || viewTurns.includes(n)) {
      const e = acquired.find(e => e.kind === 'catalogue_field_input_observed')!;
      if (n === 1) refs.set(0, e.evidence[0]);
      assert.deepEqual([e.command.action_ref, e.field_changed, e.structure_preserved, e.evidence],
        ['ACTION3', true, true, [refs.get(n - 1), out.observation_ref]]);
    }
    if (n === 2 || n === 12) {
      const e = acquired.find(e => e.kind === 'catalogue_response')!;
      assert.deepEqual([out.matched, e.mode, e.palette, e.official_progress, e.trial_key, e.evidence],
        [null, 'answer', 8, false, d.plan.trial_key, [refs.get(n - 1), out.observation_ref]]);
    }
    if (n === 3 || n === 13) {
      assert.deepEqual([d.plan.mode, d.plan.target_palette, out.matched], ['select', 9, true]);
    }
    if (viewTurns.includes(n)) {
      const e = acquired.find(e => e.kind === 'catalogue_observation')!;
      assert.deepEqual([out.matched, out.reason, e.candidate_ids],
        [null, 'field_changed_requires_catalogue_recomparison', n === 4 ? [2] : [0]]);
    }
    if (n === 5 || n === 10) assert.equal(packet(n).levelsCompleted, n === 5 ? 1 : 2);
    if (n === 16) assert.equal(packet(n).levelsCompleted, 2);
  }
  assert.deepEqual([delta(packet(1), packet(2)), delta(packet(3), packet(4))], [63, 39]);
});
function withoutEvents(memory: OccludedCatalogueMemory, remove: (event: Row) => boolean) {
  const state = memory.currentState(), rebuilt = new OccludedCatalogueMemory(), removed: Row[] = [];
  for (const event of [...state.catalogue_events, ...state.catalogue_view_events]) {
    if (remove(event)) removed.push(event);
    else rebuilt.applyEvent(event);
  }
  return { rebuilt, removed };
}
test('54 suppressing only the submitted-answer receipt repeats the same physical click and delays the selector', async t => {
  const native = OccludedCatalogueMemory.prototype.proposeCatalogue, skipped: Row[] = [];
  t.mock.method(OccludedCatalogueMemory.prototype, 'proposeCatalogue', async function (this: OccludedCatalogueMemory, ...args: Parameters<typeof native>) {
    const result = await native.apply(this, args);
    if (args[0].revision !== 3 || result?.occluded_catalogue_plan?.mode !== 'select') return result;
    const { rebuilt, removed } = withoutEvents(this, event => event.kind === 'catalogue_response' && event.mode === 'answer');
    assert.equal(removed.length, 1);
    skipped.push(...removed);
    return native.apply(rebuilt, args);
  });
  const game = await start(true);
  await prefix(game, 1);
  const before = await game.decision();
  historical(before, 2);
  const out = await game.advance();
  const repeated = await game.decision();
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every(e => e.trial_key === before.plan.trial_key && e.evidence[1] === out.observation_ref));
  assert.deepEqual([repeated.owner, repeated.plan.mode, repeated.command.data], [recall, 'answer', before.command.data]);
  assert.equal(delta(packet(2), alternate.withoutAnswer), 0);
  const second = await game.advance(alternate.withoutAnswer);
  assert.equal(second.reason, 'catalogue_submission_without_local_correctness_claim');
});
test('40 removing only the T1 access witness preserves the two clicks then releases the other physical view', async t => {
  const native = OccludedCatalogueMemory.prototype.proposeCatalogue, skipped: Row[] = [];
  t.mock.method(OccludedCatalogueMemory.prototype, 'proposeCatalogue', async function (this: OccludedCatalogueMemory, ...args: Parameters<typeof native>) {
    const result = await native.apply(this, args);
    if (args[0].revision !== 4 || result?.kind !== view) return result;
    const { rebuilt, removed } = withoutEvents(this, event => event.kind === 'catalogue_field_input_observed');
    assert.equal(removed.length, 1);
    skipped.push(...removed);
    return native.apply(rebuilt, args);
  });
  const record = t.mock.method(OccludedCatalogueMemory.prototype, 'record'), game = await start(true);
  await prefix(game, 3);
  const fallback = await game.decision();
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every(e => e.command.action_ref === 'ACTION3' && e.field_changed && e.structure_preserved));
  assert.deepEqual([fallback.owner, fallback.p.kind, fallback.command.actionRef], [frontier, 'experiment', 'ACTION4']);
  assert.equal(delta(packet(3), alternate.withoutViewWitness), 50);
  const out = await game.advance(alternate.withoutViewWitness);
  const e = record.mock.calls.at(-1)!.result!.find(e => e.kind === 'catalogue_field_input_observed')!;
  assert.deepEqual([out.family, e.command.action_ref, e.field_changed, e.structure_preserved, e.evidence[1]],
    [frontier, 'ACTION4', true, true, out.observation_ref]);
});
test('40 on the same post-selector observation can reconstruct its offer without T2 catalogue receipts', async t => {
  const native = OccludedCatalogueMemory.prototype.proposeCatalogue;
  let comparisons = 0;
  t.mock.method(OccludedCatalogueMemory.prototype, 'proposeCatalogue', async function (this: OccludedCatalogueMemory, ...args: Parameters<typeof native>) {
    const result = await native.apply(this, args);
    if (result?.kind === view && args[0].revision === 4) {
      const { rebuilt, removed } = withoutEvents(this, event => event.evidence[1].includes(':revision:3:'));
      assert.deepEqual(removed.map(e => e.kind), ['catalogue_observation', 'catalogue_response']);
      const offer = await native.apply(rebuilt, args);
      assert.deepEqual(offer, result);
      comparisons++;
    }
    return result;
  });
  const game = await start();
  await prefix(game, 3);
  const d = await game.decision();
  historical(d, 4);
  assert.deepEqual([d.owner, d.p.kind], [recall, view]);
  assert.ok(comparisons > 0);
});
