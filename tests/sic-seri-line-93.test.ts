import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SERI_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { VisualSequences, visualInterior }: typeof import('../src/logos-engine/v6-visual-sequences.ts') =
  await import(moduleURL('src/logos-engine/v6-visual-sequences.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_SERI_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'SERI', level: 1 }), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  async function continuation() {
    if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  return {
    get observation() { return observation; },
    continuation,
    async decision() {
      await continuation();
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance(returned?: V6PublicObservation) {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      sequence++;
      observation = returned ?? toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const catalog = [[41,54],[21,55],[31,54],[41,54],[46,54],[26,54],[16,54],[36,54]];
const revision = (ref: string) => Number(/:revision:(\d+):/.exec(ref)?.[1]);
type VisualOwner = InstanceType<typeof VisualSequences>;

function observeReturns(t: TestContext) {
  const original = VisualSequences.prototype.record;
  const returned = new Map<number, Row>();
  t.mock.method(VisualSequences.prototype, 'record', function (this: VisualOwner, ...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    returned.set(args[0].revision, result);
    return result;
  });
  return returned;
}

test('93 fills observed rows and substantiates the continuation at the next real level', async t => {
  const returned = observeReturns(t);
  const game = await start();
  for (const [i, [x, y]] of catalog.entries()) {
    const turn = i + 1, prior = game.observation;
    const d = await game.decision(), plan = d.proposal.sequence_plan;
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.reason, d.guard.admitted],
      ['visual_sequences', 'public_visual_sequence', 'ACTION6', { x, y }, 'current_question_and_option_bound', true]);
    assert.deepEqual([plan.row, plan.missing_rank, plan.inference.status, plan.inference.compatible_options.length],
      [i % 4, 5, 'unique', 1]);
    if (turn === 5) assert.deepEqual(plan.continuation_witnesses.map(revision), [3, 4, 5]);
    const outcome = await game.advance();
    assert.equal(outcome.matched, null);
    const event = returned.get(turn)!;
    assert.equal(revision(event.evidence), turn + 1);
    if (turn === 4 || turn === 8) {
      assert.equal(event.status, 'official_boundary');
      assert.equal(game.observation.levelsCompleted, turn / 4);
    } else {
      assert.deepEqual([event.status, event.other_cards_preserved, event.expected_card_filled],
        ['observed_row_completion', true, true]);
      assert.notDeepEqual(visualInterior(prior.frame, plan.target_box), plan.expected_raster);
      assert.deepEqual(visualInterior(game.observation.frame, plan.target_box), plan.expected_raster);
    }
  }
});

for (const dropped of [1, 2]) {
  test('93 continuation with ' + dropped + ' prior row completions removed', async t => {
    const original = VisualSequences.prototype.proposeContinuation;
    let withdrawn = false;
    t.mock.method(VisualSequences.prototype, 'proposeContinuation', async function (this: VisualOwner, ...args: Parameters<typeof original>) {
      if (args[0].level_epoch !== 2 || args[0].revision !== 5) return original.apply(this, args);
      const state = this.state();
      const events = state.events as Row[];
      const rows = events.filter(e => e.status === 'observed_row_completion');
      assert.equal(rows.length, 3);
      assert.equal(args[4], 2);
      withdrawn = true;
      const removed = new Set(rows.slice(-dropped));
      this.restore({ ...state, events: events.filter(e => !removed.has(e)) });
      try {
        return await original.apply(this, args);
      } finally {
        this.restore(state);
      }
    });
    const game = await start();
    for (const [x,y] of catalog.slice(0, 4)) {
      assert.deepEqual((await game.decision()).command.data, { x, y });
      await game.advance();
    }
    assert.equal(game.observation.levelsCompleted, 1);
    const d = await game.decision();
    assert.ok(withdrawn);
    if (dropped === 1) {
      assert.deepEqual([d.family, d.command.data, d.proposal.sequence_plan.continuation_witnesses.map(revision)],
        ['visual_sequences', { x: 46, y: 54 }, [2, 3, 5]]);
    } else {
      assert.deepEqual([d.family, d.command.actionRef, d.command.data, d.proposal.sequence_plan?.continuation_witnesses],
        ['visual_sequences', 'ACTION6', { x: 46, y: 54 }, undefined]);
    }
    const plan = d.proposal.sequence_plan;
    await game.advance();
    assert.deepEqual(visualInterior(game.observation.frame, plan.target_box), plan.expected_raster);
  });
}

test('93 incomplete visual response keeps the same answer unconfirmed and changes the next ticket', async t => {
  const returned = observeReturns(t);
  const game = await start();
  const before = game.observation;
  const first = await game.decision();
  assert.deepEqual([first.family, first.command.actionRef, first.command.data],
    ['visual_sequences', 'ACTION6', { x: 41, y: 54 }]);
  const outcome = await game.advance({ ...before, stepIndex: 1 });
  assert.equal(outcome.matched, null);
  const event = returned.get(1)!;
  assert.deepEqual([event.status, event.expected_card_filled, event.other_cards_preserved, revision(event.evidence)],
    ['answer_acceptance_unconfirmed', false, true, 2]);
  const reply = await game.continuation();
  assert.deepEqual([reply.kind, reply.snapshot.lastDecision, reply.command?.actionRef, reply.command?.data],
    ['action', 'observed_frontier', 'ACTION1', {}]);
  await game.advance();
  assert.equal(game.observation.levelsCompleted, 0);
});
