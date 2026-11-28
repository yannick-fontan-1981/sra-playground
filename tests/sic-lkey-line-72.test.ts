import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_LKEY_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { RankedWorkshop }: typeof import('../src/logos-engine/v6-ranked-workshop.ts') =
  await import(moduleURL('src/logos-engine/v6-ranked-workshop.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_LKEY_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'LKEY', level: 1 }), sequence);
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
    async advance() {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      observation = toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const ids = [6,6,1,2,6,6,2,3,4,5,1,4,5,2,5,4];
const family = 'public_ranked_workshop';
const above = 'station_profile_neighbor_above_equal_marked_cut_count';
type Workshop = InstanceType<typeof RankedWorkshop>;
const refRevision = (ref: string) => Number(/:revision:(\d+):/.exec(ref)?.[1]);

function observeWorkshop(t: TestContext) {
  const record = RankedWorkshop.prototype.recordSource;
  const events = new Map<number, Row>();
  t.mock.method(RankedWorkshop.prototype, 'recordSource', function (this: Workshop, ...args: Parameters<typeof record>) {
    const result = record.apply(this, args);
    const afterRef = args[1].observation_ref;
    const effect = this.input_effects.find(e => e.evidence.at(-1) === afterRef);
    if (result || effect) events.set(args[0].revision, structuredClone({ result, effect, mode: this.mode_evidence }));
    return result;
  });
  return events;
}

test('72 follows the measured ranked profiles and their actual changes in LKEY', async t => {
  const events = observeWorkshop(t);
  const game = await start();
  const stages = ['adjacent_exchange_probe', 'prepared_receiver_trial', 'release_after_acceptance',
    'free_focus_to_next_prepared_receiver', 'reacquire_mode_at_prepared_receiver', 'prepared_receiver_trial'];
  for (const [i, id] of ids.entries()) {
    const turn = i + 1;
    const d = await game.decision();
    assert.equal(d.command.actionRef, 'ACTION' + id);
    if (turn >= 11) {
      const p = d.proposal.workshop_plan;
      assert.deepEqual([d.family, d.proposal.kind, d.guard.admitted, p.stage, p.extension],
        [family, family, true, stages[i - 10], null]);
      if (turn === 11) {
        assert.equal(p.context[above], 1);
        assert.equal(p.context.station_profile_inner_singleton_count, 1);
        assert.deepEqual(p.evidence.map(refRevision), [11,10]);
      }
    }
    const outcome = await game.advance();
    if (turn >= 11) assert.equal(outcome.matched, null);
    const event = events.get(turn);
    if (turn === 10) {
      assert.equal(event?.result.status, 'mode_marker_contrast');
      assert.deepEqual(event?.mode.map((receipt: Row) => [receipt.action.action_ref, receipt.observed_change]), [['ACTION5', [0,1]]]);
    }
    if (turn === 11 || turn === 14) {
      assert.deepEqual([event?.result.status, event?.effect.slot_delta, event?.effect.changes.marker_moved,
        event?.effect.held_before, event?.effect.changes.profile_geometry_changed],
      ['current_geometric_effect', turn === 11 ? -1 : 1, true, turn === 11, turn === 11]);
    }
    if (turn === 12) assert.equal(event?.effect.changes.receiver_changed, true);
    if (turn === 13 || turn === 15) assert.deepEqual(event?.mode[0].observed_change, turn === 13 ? [1,0] : [0,1]);
    if (turn === 16) {
      assert.equal(event?.result.status, 'official_boundary');
      assert.equal(game.observation.levelsCompleted, 1);
    }
  }
});

for (const mutation of ['reverse', 'neighbor', 'mode'] as const) {
  test('72 current T11 with ' + mutation + ' intervention', async t => {
    const events = observeWorkshop(t);
    const select = RankedWorkshop.prototype.select, propose = RankedWorkshop.prototype.proposeSource;
    let scoped = false;
    if (mutation === 'mode') {
      t.mock.method(RankedWorkshop.prototype, 'proposeSource', async function (this: Workshop, ...args: Parameters<typeof propose>) {
        if (args[0].level_epoch !== 1 || args[0].revision !== 11) return propose.apply(this, args);
        const mode = this.mode_evidence;
        assert.equal(mode.length, 1);
        assert.deepEqual(mode[0].observed_change, [0,1]);
        scoped = true;
        this.mode_evidence = [];
        try { return await propose.apply(this, args); }
        finally { this.mode_evidence = mode; }
      });
    } else {
      t.mock.method(RankedWorkshop.prototype, 'select', function (this: Workshop, measured: Row) {
        const holder = this as unknown as { observation: NativeObservation };
        const prior = holder.observation;
        if (prior.level_epoch !== 1 || prior.revision !== 11) return select.call(this, measured);
        assert.equal(measured.context[above], 1);
        scoped = true;
        if (mutation === 'neighbor') return select.call(this, { ...measured, context: { ...measured.context, [above]: 0 } });
        holder.observation = { ...prior, available_action_refs: [...prior.available_action_refs].reverse() };
        try { return select.call(this, measured); }
        finally { holder.observation = prior; }
      });
    }
    const game = await start();
    for (let i = 0; i < 10; i++) {
      assert.equal((await game.decision()).command.actionRef, 'ACTION' + ids[i]);
      await game.advance();
    }
    const before = game.observation;
    const reply = await game.continuation();
    assert.ok(scoped);
    assert.equal(game.observation, before);
    const plan = (reply.snapshot.proposal as Row).workshop_plan;
    assert.equal(reply.kind, 'action');
    if (mutation === 'reverse') {
      assert.deepEqual([reply.snapshot.lastDecision, reply.command?.actionRef, plan?.stage],
        [family, 'ACTION1', 'adjacent_exchange_probe']);
    } else {
      assert.deepEqual([reply.snapshot.lastDecision, reply.command?.actionRef, plan],
        ['public_framed_transfer', 'ACTION6', undefined]);
    }
    await game.advance();
    if (mutation === 'reverse') assert.equal(events.get(11)?.effect.slot_delta, -1);
    assert.equal(game.observation.levelsCompleted, 0);
  });
}
