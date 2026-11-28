import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_LS20_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { NativeMorphologyFamily }: typeof import('../src/logos-engine/v6-morphology-family.ts') = await import(moduleURL('src/logos-engine/v6-morphology-family.ts'));
const { NativeMorphologyPolicy }: typeof import('../src/logos-engine/v6-morphology-policy.ts') = await import(moduleURL('src/logos-engine/v6-morphology-policy.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const trace = '../docs/migration/lot2c-evidence/final/ls20-method-continuation/ls20-public-trace.json.gz';
const archive: Row[] = JSON.parse(gunzipSync(readFileSync(new URL(trace, import.meta.url))).toString()).packets;

function packet(n: number): V6PublicObservation {
  const p = archive[n]!.packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}

async function start() {
  const root = process.env.SIC_LS20_GAME_ROOT;
  const backend = root ? await sourceBackend(root) : null;
  const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  function observe(request: object, n: number, nominal: boolean) {
    if (!backend) return packet(n);
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    if (nominal) assert.deepEqual(actual, packet(n), 'official LS20 return ' + n);
    return { ...actual, palette };
  }

  let sequence = 0;
  let reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'LS20', level: 1 }, sequence, true),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 19 } });
  return {
    get reply() { return reply; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, ticket: reply.ticket!, proposal: reply.snapshot.proposal as Row,
        family: reply.snapshot.lastDecision, guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance(nominal = true) {
      const { actionRef, data } = reply.command!;
      if (nominal) assert.deepEqual([actionRef, data], [archive[sequence + 1]!.command.action_ref, archive[sequence + 1]!.command.data ?? {}]);
      const observation = observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, ++sequence, nominal);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return { observation, outcome: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')! };
    },
  };
}

test('20 binds the measured orientation to modifier access, then reuses morphology for peer access after selective alignment', async t => {
  const record = t.mock.method(NativeMorphologyFamily.prototype, 'record');
  const game = await start();
  let pairRef: string | undefined;
  let selectiveReturnRef: string | undefined;
  for (let n = 1; n <= 18; n++) {
    const d = await game.decision();
    const plan = d.proposal.morphology_plan;
    if (n >= 7 && n <= 17) {
      const expectedRoute = n <= 10 ? 'modifier' : n <= 13 ? 'peer_access_probe' : 'peer';
      assert.deepEqual([d.family, d.proposal.kind, d.guard.admitted, d.guard.reason, plan.route_key],
        ['morphology', 'morphology_probe', true, 'current_geometry_bound', expectedRoute]);
    }
    if (n === 7) {
      const f = plan.facts;
      pairRef = f.pair_ref;
      assert.deepEqual([d.command.actionRef, f.homologous, f.asymmetric, f.orientation_relation, f.color_relation,
        f.feature_residuals.orientation_alternatives, f.single_pattern_contact_change, plan.pair.scales, plan.steps[0].from, plan.steps[0].to],
        ['ACTION3', true, true, 'different', 'equal', [3], false, [1, 2], [24, 45], [19, 45]]);
      assert.deepEqual([f.routes.modifier.observation_ref, f.routes.modifier.level_epoch], [plan.observation_ref, plan.level_epoch]);
    }
    if (n === 11 || n === 14) {
      const f = plan.facts;
      assert.deepEqual([f.pair_ref, f.orientation_relation, f.color_relation, f.feature_residuals.orientation_alternatives,
        f.single_pattern_contact_change, plan.steps[0].from, plan.steps[0].to],
        [pairRef, 'aligned', 'equal', [0], true, n === 11 ? [19, 30] : [29, 25], n === 11 ? [19, 25] : [34, 25]]);
      assert.equal(f.single_pattern_change_observation_ref, selectiveReturnRef);
    }
    if (n === 14) {
      const policy = await NativeMorphologyPolicy.create();
      const f = plan.facts;
      const withoutReturn = await policy.evaluate({ ...f, single_pattern_contact_change: false }) as Row;
      assert.deepEqual([withoutReturn.observation_ref, withoutReturn.route_bindings.peer,
        withoutReturn.route_key, withoutReturn.release_authority], [plan.observation_ref, 'bound', null, false]);
    }
    if (n === 18) assert.equal(d.family, 'acquire_control_for_target');
    const { observation, outcome } = await game.advance();
    if (n === 7 || n === 14) assert.deepEqual([outcome.family, outcome.matched, outcome.reason], ['morphology', true, 'compare_predicted_position']);
    if (n === 10) {
      const event = (await record.mock.calls.at(-1)!.result).events[0];
      assert.deepEqual([outcome.reason, outcome.matched, event.unchanged_peer], ['measure_terminal_contact_or_boundary', null, [33, 9, 39, 15]]);
      assert.ok(event.pair_key);
      assert.equal(event.observation_ref, outcome.observation_ref);
      selectiveReturnRef = event.observation_ref;
    }
    if (n === 17) assert.deepEqual([observation.level, observation.levelsCompleted, outcome.family], [2, 1, 'morphology']);
  }
});

for (const mode of ['orientation', 'observation'] as const) {
  test('20 rejects modifier access at the same T7 observation with altered ' + mode, async t => {
    const original = NativeMorphologyPolicy.prototype.evaluate;
    let sequence = 0, intervention: Row | undefined;
    t.mock.method(NativeMorphologyPolicy.prototype, 'evaluate', async function (this: InstanceType<typeof NativeMorphologyPolicy>, facts: Row) {
      if (sequence !== 6 || !facts.routes?.modifier) return await original.call(this, facts);
      const nominal = await original.call(this, facts);
      const altered = mode === 'orientation'
        ? { ...facts, orientation_relation: 'ambiguous', feature_residuals: { ...facts.feature_residuals, orientation: 'ambiguous', orientation_alternatives: [] } }
        : { ...facts, routes: { ...facts.routes, modifier: { ...facts.routes.modifier, observation_ref: 'stale-observation' } } };
      const actual = await original.call(this, altered);
      intervention = { nominal, actual, current: facts.observation_ref };
      return actual;
    });
    const game = await start();
    for (; sequence < 6;) {
      await game.decision();
      sequence++;
      await game.advance();
    }
    const replacement = await game.decision();
    assert.ok(intervention);
    const { nominal, actual, current } = intervention;
    assert.deepEqual([nominal.observation_ref, nominal.route_key, nominal.route_bindings.modifier], [current, 'modifier', 'bound']);
    assert.deepEqual([actual.observation_ref, actual.route_key, actual.route_bindings.modifier, actual.release_authority],
      [current, null, mode === 'orientation' ? 'bound' : 'stale_scope', false]);
    assert.equal(actual.reason, mode === 'orientation' ? 'pose_not_discriminated' : 'modifier_access_unbound');
    assert.deepEqual([replacement.family, replacement.command.actionRef, replacement.guard.admitted], ['view', 'ACTION2', true]);
    if (process.env.SIC_LS20_GAME_ROOT) {
      const { observation, outcome } = await game.advance(false);
      assert.equal(outcome.family, 'view');
      assert.deepEqual([observation.level, observation.levelsCompleted], [1, 0]);
      assert.notDeepEqual(observation.frame, packet(6).frame);
      assert.notDeepEqual(observation.frame, packet(7).frame);
    }
  });
}
