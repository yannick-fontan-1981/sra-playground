import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_ELAS_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { MetricComposition, measuredMetricScene, measuredMetricState, metricTargetCandidates, metricVisible, METRIC_EMPTY }:
  typeof import('../src/logos-engine/v6-metric-composition.ts') = await import(moduleURL('src/logos-engine/v6-metric-composition.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_ELAS_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const load = { type: 'load', code: 'ELAS', level: 1 };

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

test('19 builds distinct metric placements in N1 and N2 and replans when the measured target reference changes', async t => {
  const record = t.mock.method(MetricComposition.prototype, 'record');
  const game = await start();
  const historical = [6, 1, 6, 1, 1, 4, 6, 1, 6, 1, 3];
  let learnedAt: string | undefined, remeasuredTarget: string | undefined;
  for (let n = 1; n <= 11; n++) {
    const d = await game.decision(), p = d.proposal.support_plan;
    const step = p.transitions[d.guard.index];
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.guard.admitted, d.guard.reason],
      ['metric_composition', 'metric_composition_access', 'ACTION' + historical[n - 1], true, 'metric_target_selection_and_visible_support_bound']);
    if (n === 1 || n === 3) {
      const first = n === 1;
      const scene = measuredMetricScene(game.observation.frame)!;
      const obs = d.proposal.binding, state = measuredMetricState(scene, obs);
      const candidates = metricTargetCandidates(scene, obs, state);
      assert.ok(candidates.some(c => JSON.stringify(c) === JSON.stringify(p.target)));
      assert.deepEqual([scene.selected, p.target.anchor, p.target.scale, d.command.data, p.complete_model_cost],
        first ? [null, [14, 10], [2, 1], { x: 28, y: 25 }, 2] : [null, [8, 6], [3, 1], { x: 19, y: 28 }, 9]);
      assert.deepEqual(p.target.requirements.filter((r: string[]) => r[1] !== METRIC_EMPTY),
        first ? [['8', '8'], ['9', '9'], ['17', '11']] : [['8', '8'], ['9', '9'], ['16', '14'], ['17', '11']]);
      assert.deepEqual([step.primitive.kind, step.primitive.cell_ref, step.primitive.occurrence_ref, p.transitions[1].primitive.destination_ref,
        p.control_facts, p.cut_reason, p.conditional_law.dimension_rule],
        ['SELECT', first ? '24' : '30', first ? 'visible:24' : 'visible:30', first ? '17' : '23',
          null, 'first_unmeasured_control_geometry', 'CELL_SUPPORT']);
    }
    if (n === 5) {
      assert.ok(d.proposal.route_refs.includes(learnedAt));
      assert.ok(p.control_facts);
      assert.equal(step.primitive.occurrence_ref, 'visible:30');
    }
    if (n === 6) {
      assert.equal(p.target_ref, remeasuredTarget);
      assert.equal(p.target.requirements.some(([, color]: string[]) => color === '9'), false);
    }
    const previousFrame = game.observation.frame;
    const out = await game.advance();
    assert.equal(out.family, 'metric_composition');
    if (n === 1 || n === 3) {
      assert.equal(out.reason, 'metric_predicted_visible_effect');
      assert.equal(measuredMetricScene(game.observation.frame)!.selected, n === 1 ? 24 : 30);
    }
    if (n === 2 || n === 11) {
      assert.deepEqual([out.reason, game.observation.level, game.observation.levelsCompleted],
        n === 2 ? ['official_score', 2, 1] : ['official_score', 3, 2]);
    }
    if (n === 4 || n === 5) {
      const reply = record.mock.calls.map(call => call.result as Row).findLast(r =>
        r?.events.some((e: Row) => e.kind === 'metric_control_response' && e.after === out.observation_ref))!;
      const event = reply.events.find((e: Row) => e.kind === 'metric_control_response');
      assert.deepEqual([out.matched, event.expected_visible_matched, event.unknown_underlay_revealed], [n === 4, true, false]);
      if (n === 4) learnedAt = out.observation_ref;
      if (n === 5) {
        const current = measuredMetricScene(game.observation.frame)!;
        const previous = measuredMetricScene(previousFrame)!;
        assert.equal(out.reason, 'metric_effect_or_underlay_requires_reconciliation');
        assert.deepEqual([current.grid_ref, current.selected, current.fills], [p.grid_ref, 16, metricVisible(step.after)]);
        assert.equal(previous.target.flat().includes('9'), true);
        assert.equal(current.target.flat().includes('9'), false);
        assert.notEqual(current.target_ref, p.target_ref);
        remeasuredTarget = current.target_ref;
        for (const [y, row] of game.observation.frame.entries()) for (const [x, pixel] of row.entries()) {
          if (x < current.xs[0] || x >= current.xs.at(-1) || y < current.ys[0] || y >= current.ys.at(-1)) {
            assert.equal(pixel, previousFrame[y]![x], 'outside reference raster remains identical');
          }
        }
      }
    }
  }
  const next = await game.decision();
  assert.deepEqual([game.observation.level, next.family], [3, 'contextual_compartments']);
});

test('19 refuses the nominal transfer when the official selection is a different occurrence', async t => {
  const alternate = await sourceBackend(assetRoot);
  alternate.dispatch(load);
  const otherPick = toV6PublicObservation(alternate.dispatch({ type: 'action', actionId: 6, data: { x: 17, y: 13 } }), 1);
  const selected = measuredMetricScene(otherPick.frame)!;
  assert.deepEqual([selected.selected, selected.fills[8]], [8, '8']);
  const originalBefore = MetricComposition.prototype.before, originalAfter = MetricComposition.prototype.after;
  let refused: Row | undefined, unconfirmed: Row | undefined;
  t.mock.method(MetricComposition.prototype, 'before', function (this: InstanceType<typeof MetricComposition>,
    ...args: Parameters<typeof originalBefore>) {
    const [proposal, index, packet, observation] = args;
    if (index === 1 && proposal.support_plan?.transitions[index]?.primitive.occurrence_ref === 'visible:24') {
      const scene = measuredMetricScene(packet.frame_rows)!;
      assert.deepEqual([scene.selected, scene.fills, scene.target_ref, scene.grid_ref], [24, selected.fills, selected.target_ref, selected.grid_ref]);
      refused = originalBefore.call(this, proposal, index, { ...packet, frame_rows: otherPick.frame }, observation);
    }
    return originalBefore.apply(this, args);
  });
  t.mock.method(MetricComposition.prototype, 'after', function (this: InstanceType<typeof MetricComposition>,
    ...args: Parameters<typeof originalAfter>) {
    const [proposal, index, before, after, first] = args;
    if (index === 0 && proposal.support_plan?.transitions[index]?.primitive.occurrence_ref === 'visible:24') {
      unconfirmed = originalAfter.call(this, proposal, index, before, after, first, otherPick.frame);
    }
    return originalAfter.apply(this, args);
  });
  const game = await start();
  assert.equal((await game.decision()).command.actionRef, 'ACTION6');
  await game.advance();
  assert.deepEqual(unconfirmed, { matched: false, seal_prefix: true, reason: 'metric_effect_or_underlay_requires_reconciliation' });
  const next = await game.decision();
  assert.deepEqual([next.command.actionRef, next.guard.admitted, refused], ['ACTION1', true, { admitted: false, reason: 'metric_premise_changed' }]);
  const alternateAfter = toV6PublicObservation(alternate.dispatch({ type: 'action', actionId: 1 }), 2);
  const other = measuredMetricScene(alternateAfter.frame)!;
  assert.deepEqual([alternateAfter.level, alternateAfter.levelsCompleted, other.selected, other.fills[1], other.fills[8], other.fills[24]],
    [1, 0, 1, '8', METRIC_EMPTY, '11']);
});
