import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_DC22_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { SupportNavigation }: typeof import('../src/logos-engine/v6-support-navigation.ts') = await import(moduleURL('src/logos-engine/v6-support-navigation.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_DC22_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const load = { type: 'load', code: 'DC22', level: 1 };
const historicalActions = [1, 2, 3, 4, 1, 4, 6, 6, 6, 3, 1, 1, 1, 1, 4, 4];
const flatCell = (o: V6PublicObservation, x: number, y: number) => o.frame.slice(y, y + 2).flatMap(row => row.slice(x, x + 2));

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

test('88 learns a support step, measures two command contexts and uses the reconfigured surface', async t => {
  const record = t.mock.method(SupportNavigation.prototype, 'recordExisting');
  const game = await start(), triedKeys = new Set<string>();
  for (let n = 1; n <= 16; n++) {
    const d = await game.decision(), s = d.proposal.support_plan;
    if (n >= 2) assert.deepEqual([d.family, d.proposal.kind, d.guard.admitted, d.guard.reason],
      ['support_navigation', 'reconfigurable_support', true, 'current_support_actor_and_epoch_bound']);
    assert.equal(d.command.actionRef, 'ACTION' + historicalActions[n - 1]);
    if (n === 2) {
      assert.deepEqual([d.command.actionRef, d.proposal.question.reason, s.actor_bbox, s.positions, s.underlay.row.underlay_values],
        ['ACTION2', 'Acquire the missing input displacement under the current support hypothesis.', [10, 38, 11, 39], [null], [2]]);
    }
    if (n === 5) assert.deepEqual([d.proposal.actions.map((a: Row) => a.action_ref), s.positions], [['ACTION1', 'ACTION4'], [[10, 38], [12, 38]]]);
    if (n >= 7 && n <= 9) {
      assert.deepEqual([d.command.actionRef, d.command.data, s.actor_bbox, s.positions], ['ACTION6',
        { x: 48, y: n === 9 ? 36 : 19 }, [12, 38, 13, 39], [[12, 38]]]);
      assert.equal(triedKeys.has(s.experiment_key), false);
      assert.ok(s.experiment_key);
      triedKeys.add(s.experiment_key);
    }
    if (n === 11) {
      assert.deepEqual([d.command.actionRef, s.positions[d.guard.index], flatCell(game.observation, 10, 38), flatCell(game.observation, 10, 36)],
        ['ACTION1', [10, 36], [14, 14, 14, 14], [9, 9, 9, 9]]);
    }
    const out = await game.advance();
    if (n === 2 || (n >= 7 && n <= 9)) {
      const events = (await record.mock.calls.at(-1)!.result).events as Row[];
      if (n === 2) {
        const step = events.find(e => e.kind === 'unit_translation_and_support_observed')!;
        assert.deepEqual([out.matched, step.command, step.delta, step.after], [null, 'ACTION2', [2, 0], out.observation_ref]);
      } else {
        const effect = events.find(e => e.kind === 'remote_support_effect_measured')!;
        assert.deepEqual([out.matched, effect.effect.after, effect.usefulness], [true, out.observation_ref, 'unconfirmed']);
        assert.ok(effect.effect.typed_transition_measurements.cell_transition_rows.length > 0);
        assert.ok(events.some(e => e.kind === 'contextual_control_question_closed' && e.question_key === s.experiment_key));
      }
    }
    if (n === 11) assert.deepEqual([out.matched, flatCell(game.observation, 10, 36)], [true, [14, 14, 14, 14]]);
  }
});

test('88 rejects the same next step against an official surface left unreconfigured', async t => {
  const alternate = await sourceBackend(assetRoot);
  let alternateObs = toV6PublicObservation(alternate.dispatch(load), 0);
  const send = (a: number | { x: number; y: number }) => {
    const request = typeof a === 'number' ? { type: 'action', actionId: a } : { type: 'action', actionId: 6, data: a };
    alternateObs = toV6PublicObservation(alternate.dispatch(request), alternateObs.stepIndex + 1);
    return alternateObs;
  };
  for (const action of [1, 2, 3, 4, 1, 4, { x: 48, y: 19 }, { x: 48, y: 19 }, 3]) send(action);
  assert.deepEqual([flatCell(alternateObs, 10, 38), flatCell(alternateObs, 10, 36)], [[14, 14, 14, 14], [4, 9, 9, 4]]);
  const alternateBefore = alternateObs;
  const original = SupportNavigation.prototype.before;
  let refused: Row | undefined;
  t.mock.method(SupportNavigation.prototype, 'before', async function (this: InstanceType<typeof SupportNavigation>,
    ...args: Parameters<typeof original>) {
    const [proposal, index, packet, observation] = args;
    if (index === 1 && proposal.support_plan?.positions[index]?.join() === '10,36') {
      assert.equal(proposal.actions[index].action_ref, 'ACTION1');
      const alteredPacket = { ...packet, frame_rows: alternateBefore.frame };
      refused = await original.call(this, proposal, index, alteredPacket, observation);
    }
    return await original.apply(this, args);
  });
  const game = await start();
  for (let n = 1; n <= 10; n++) { await game.decision(); await game.advance(); }
  const nominal = await game.decision();
  assert.deepEqual([nominal.command.actionRef, nominal.guard.admitted, refused], ['ACTION1', true, { admitted: false, reason: 'support_binding_changed' }]);
  const alternateAfter = send(1);
  assert.deepEqual([flatCell(alternateAfter, 10, 38), flatCell(alternateAfter, 10, 36)], [[14, 14, 14, 14], [4, 9, 9, 4]]);
});
