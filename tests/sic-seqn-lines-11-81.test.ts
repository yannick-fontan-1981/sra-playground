import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SEQN_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { factoredProposal, partition }: typeof import('../src/logos-engine/v6-factored-return.ts') =
  await import(moduleURL('src/logos-engine/v6-factored-return.ts'));
const { ScoredRewriteAccess, scoredModel }: typeof import('../src/logos-engine/v6-scored-rewrite.ts') =
  await import(moduleURL('src/logos-engine/v6-scored-rewrite.ts'));
const { ProspectiveContactAdapter }: typeof import('../src/logos-engine/v6-prospective-contact.ts') =
  await import(moduleURL('src/logos-engine/v6-prospective-contact.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const replay = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-seqn-public-returns.json.gz', import.meta.url))).toString());
const sessionId = 'sra-v6-' + replay.session;
const packet = (n: number): V6PublicObservation => replay.nominal.observations[n];
const factor = 'factored_material_return', rewrite = 'scored_local_rewrite', frontier = 'observed_frontier';
const bandRows = [60, 61, 62];
type Presented = (observed: V6PublicObservation) => V6PublicObservation;

async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_SEQN_GAME_ROOT ? await sourceBackend(process.env.SIC_SEQN_GAME_ROOT) : null;
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official SEQN return ' + n);
    return { ...actual, palette };
  }
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'SEQN', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.equal(guard.admitted, true);
      return { p, guard, owner: reply.snapshot.lastDecision, command: reply.command!.actionRef };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1), present?: Presented) {
      const observed = observe({ type: 'action', actionId: Number(reply.command!.actionRef.slice(6)) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: present ? present(observed) : observed });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
type Game = Awaited<ReturnType<typeof start>>;
async function prefix(game: Game, count: number) {
  for (let i = 0; i < count; i++) {
    assert.equal((await game.decision()).command, 'ACTION' + replay.nominal.commands[i].id);
    await game.advance();
  }
}
function presentFrame(observed: V6PublicObservation, frame: V6PublicObservation['frame']): V6PublicObservation {
  return { ...observed, frame, frames: [frame] };
}
test('11 the guarded factored prefix scores and supplies the dated model that 81 tests on relocated supports', async t => {
  const record = t.mock.method(ScoredRewriteAccess.prototype, 'record'), game = await start(19, true);
  const refs = new Map<number, string>(), acquired: Row[] = [];
  let source: Row | undefined;
  for (let n = 1; n <= 19; n++) {
    const d = await game.decision(), step = d.guard.index;
    assert.equal(d.command, 'ACTION' + replay.nominal.commands[n - 1].id);
    if (n === 8) {
      assert.deepEqual(packet(7).frame, packet(0).frame);
      const p = d.p.factor_plan;
      assert.deepEqual([d.p.kind, p.axis, p.indices, p.return_ref, p.channel_witnesses, p.steps.map((s: Row) => s.action_ref)],
        ['public_factored_return', 'row', bandRows, refs.get(7), [refs.get(1), refs.get(3), refs.get(4)],
          ['ACTION1', 'ACTION3', 'ACTION2', 'ACTION4']]);
    }
    if (n >= 8 && n <= 11) {
      const plan = d.p.factor_plan;
      assert.deepEqual([d.owner, d.guard.reason, step, plan.steps[step].before],
        [factor, 'complete_partition_bound', n - 8, partition(packet(n - 1).frame, 'row', bandRows)]);
      assert.deepEqual(plan.steps[step].expected_after, n === 11 ? null : partition(packet(n).frame, 'row', bandRows));
    }
    if (n >= 12) {
      const p = d.p.rewrite_plan;
      assert.deepEqual([d.owner, d.p.kind, d.guard.reason, p.action, p.source, p.target],
        [rewrite, 'public_scored_rewrite', 'current_local_masks_bound', d.command, source!.model.source, source!.model.target]);
      assert.ok(d.p.question.hypothesis_refs.includes(source!.model.boundary_ref));
      assert.ok(source!.model.witnesses.every((ref: string) => d.p.question.hypothesis_refs.includes(ref)));
      if (n === 12 || n === 14) {
        assert.equal(d.command, 'ACTION1');
        assert.deepEqual(p.sites.map((s: Row) => s.origin), n === 12 ? [[16, 34]] : [[32, 34]]);
      }
      assert.equal(ScoredRewriteAccess.holds(p, packet(n - 1).frame, p.source), true);
    }
    const marks = record.mock.callCount(), out = await game.advance();
    refs.set(n, out.observation_ref);
    const events = (await Promise.all(record.mock.calls.slice(marks).map(c => c.result!))).flat();
    acquired.push(...events);
    if (n >= 8 && n <= 10) assert.deepEqual([out.matched, out.reason], [true, 'both_current_channels_matched']);
    if (n === 11) {
      assert.deepEqual([out.matched, out.reason, packet(n).levelsCompleted], [null, 'official_boundary_or_terminal', 1]);
      const samples = acquired.filter(e => e.kind === 'factored_rewrite_sample');
      source = events.find(e => e.kind === 'factored_rewrite_scored');
      assert.deepEqual([samples.map(s => s.action), source!.model.boundary_action, source!.model.boundary_ref, source!.after,
        source!.model.witnesses], [['ACTION1', 'ACTION3', 'ACTION2'], 'ACTION4', refs.get(10), out.observation_ref,
        [refs.get(7), refs.get(8), refs.get(9)]]);
      assert.deepEqual(source!.model, scoredModel(samples, record.mock.calls.at(-1)!.arguments[0], 'ACTION4'));
      assert.equal(scoredModel(samples.slice(0, 1), record.mock.calls.at(-1)!.arguments[0], 'ACTION4'), null);
    }
    if (n >= 12) {
      const e = events.find(e => e.kind === 'scored_rewrite_test')!;
      assert.deepEqual([e.action, e.outcome, e.before, e.after, e.predicted_sites], [d.command, n === 18 ? 'official_progress' : 'matched',
        refs.get(n - 1), out.observation_ref, d.p.rewrite_plan.sites.length]);
    }
  }
});

test('11 moving-band witness withdrawn at the same exact return releases the real frontier alternative', async t => {
  const native = ProspectiveContactAdapter.prototype.proposeFactored;
  let tested = false;
  t.mock.method(ProspectiveContactAdapter.prototype, 'proposeFactored', function (this: ProspectiveContactAdapter, ...args: Parameters<typeof native>) {
    const [observation, inputs, remaining] = args, result = native.apply(this, args);
    if (!result || observation.revision !== 8) return result;
    const episode = this.memory.episode, retained = episode.filter(([before]) => !before.ref.includes(':revision:4:'));
    assert.equal(retained.length, episode.length - 1);
    assert.deepEqual(result.factor_plan.indices, bandRows);
    tested = true;
    return factoredProposal(retained, observation, inputs, Math.min(16, remaining));
  });
  const game = await start(19, true);
  await prefix(game, 7);
  const fallback = await game.decision();
  assert.equal(tested, true);
  assert.deepEqual([fallback.owner, fallback.command], [frontier, 'ACTION4']);
  const out = await game.advance(replay.omitBand.first);
  assert.equal(out.family, frontier);
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command], [frontier, 'ACTION1']);
  await game.advance(replay.omitBand.second);
});

test('11 the same ACTION1 with a stale band fails even when the material projection matches', async t => {
  const record = t.mock.method(ScoredRewriteAccess.prototype, 'record'), game = await start(19);
  await prefix(game, 7);
  const ticket = await game.decision();
  assert.deepEqual([ticket.owner, ticket.command], [factor, 'ACTION1']);
  const out = await game.advance(packet(8), observed => {
    const frame = observed.frame.map((row, y) => bandRows.includes(y) ? packet(7).frame[y]! : row);
    const [main, band] = partition(frame, 'row', bandRows), [expectedMain, expectedBand] = ticket.p.factor_plan.steps[0].expected_after;
    assert.equal(main, expectedMain);
    assert.notEqual(band, expectedBand);
    return presentFrame(observed, frame);
  });
  assert.deepEqual([out.family, out.matched, out.reason, out.seal_prefix], [factor, false, 'partition_forecast_diverged', true]);
  const events = (await Promise.all(record.mock.calls.map(c => c.result!))).flat();
  assert.ok(!events.some(e => e.kind === 'factored_rewrite_sample'));
});

test('81 absent progression model leaves the same physical ACTION1 to the frontier, with a different receipt', async t => {
  const native = ProspectiveContactAdapter.prototype.proposeScoredRewrite;
  const record = t.mock.method(ScoredRewriteAccess.prototype, 'record');
  let tested = false;
  t.mock.method(ProspectiveContactAdapter.prototype, 'proposeScoredRewrite', async function (this: ProspectiveContactAdapter, ...args: Parameters<typeof native>) {
    const [observation] = args, result = await native.apply(this, args);
    if (!result || observation.revision !== 12) return result;
    assert.equal(this.memory.pre_score.model!.boundary_action, 'ACTION4');
    tested = true;
    const adapter = new ProspectiveContactAdapter();
    adapter.memory.pre_score.restore({ ...this.memory.pre_score.state(), model: null });
    return native.apply(adapter, args);
  });
  const game = await start(19, true);
  await prefix(game, 11);
  const fallback = await game.decision();
  assert.equal(tested, true);
  assert.deepEqual([fallback.owner, fallback.command, fallback.p.rewrite_plan], [frontier, 'ACTION1', undefined]);
  assert.deepEqual(replay.omitScore.first, packet(12));
  const mark = record.mock.callCount(), out = await game.advance(replay.omitScore.first);
  assert.equal(out.family, frontier);
  const events = (await Promise.all(record.mock.calls.slice(mark).map(c => c.result!))).flat();
  assert.ok(!events.some(e => e.kind === 'scored_rewrite_test'));
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command], [rewrite, 'ACTION2']);
  const resumed = await game.advance(replay.omitScore.second);
  assert.equal(resumed.matched, true);
});

test('81 a single unchanged pixel refutes the full predicted mask and prevents reuse of the action in that epoch', async t => {
  const record = t.mock.method(ScoredRewriteAccess.prototype, 'record'), game = await start(19);
  await prefix(game, 11);
  const ticket = await game.decision(), plan = ticket.p.rewrite_plan;
  assert.deepEqual([ticket.owner, ticket.command, plan.sites.length], [rewrite, 'ACTION1', 1]);
  const out = await game.advance(packet(12), actual => {
    const frame = actual.frame.map(row => [...row]), [{ origin: [x, y], mask: [[dx, dy]] }] = plan.sites;
    assert.equal(frame[y + dy]![x + dx], plan.target);
    frame[y + dy]![x + dx] = packet(11).frame[y + dy]![x + dx]!;
    return presentFrame(actual, frame);
  });
  assert.deepEqual([out.family, out.matched, out.reason, out.seal_prefix], [rewrite, false, 'predicted_mask_rewrite_refuted', true]);
  const call = record.mock.calls.at(-1)!;
  const e = (await call.result!).find(e => e.kind === 'scored_rewrite_test')!;
  assert.deepEqual([e.epoch, e.action, e.outcome, e.after], [2, 'ACTION1', 'refuted', out.observation_ref]);
  assert.ok(call.this.refuted.has(JSON.stringify([2, 'ACTION1'])));
  const next = await game.decision();
  assert.deepEqual([next.owner, next.command], [rewrite, 'ACTION2']);
});
