import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { CoupledDisplays } from '../src/logos-engine/v6-coupled-displays.ts';
import { electInformationGoals, pointGoal } from '../src/logos-engine/v6-information-goals.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { PointExperimentMemory } from '../src/logos-engine/v6-point-contrasts.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { compileInformationPreference } from '../src/sic/information-preference.ts';

const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(readFileSync(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(readFileSync(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};
const policy = declarations.strategy.declarations[0].configuration.information_goal;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-information-displays-public.json.gz', import.meta.url))).toString());
const click = (x: number, y: number) => ({ actionRef: 'ACTION6', data: { x, y } });

async function session(code: 'LOGI' | 'REWI', options: { initial?: V6PublicObservation; sessionId?: string; live?: boolean } = {}) {
  const sample = fixture.games[code], sessionId = options.sessionId ?? sample.sessionId;
  const backend = options.live && process.env.SIC_INFORMATION_GAME_ROOT ? await sourceBackend(process.env.SIC_INFORMATION_GAME_ROOT) : null;
  function input(sequence: number, command?: V6Command) {
    if (!backend) return sample.observations[sequence];
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code, level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...historical } = packet;
    assert.deepEqual(historical, sample.observations[sequence], `${code} public return ${sequence}`);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  let sequence = 0;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: options.initial ?? input(0), budgets: sample.budgets });
  return {
    async ticket() {
      if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(result.kind, 'action');
      const snapshot = result.snapshot, proposal = snapshot.proposal as Record<string, any>;
      const release = snapshot.trace.findLast(e => e.kind === 'sic_native_plan')!, guard = snapshot.trace.findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([release.family, release.strategy, release.authority, proposal.kind, guard.admitted, guard.reason],
        ['information_goal', 'coupled_displays', 'information', 'experiment', true, 'current_public_premises_match_provisional_step']);
      assert.equal(release.subObjective, proposal.sic_information_decision.objective.id);
      return { command: result.command!, probe: proposal.question.curiosity, decision: proposal.sic_information_decision };
    },
    async advance(observation?: V6PublicObservation) {
      sequence++;
      result = await service.handle({ type: 'advance', sessionId, sequence, ticketId: result.ticket!.id,
        observation: observation ?? input(sequence, result.command!), executionMs: 0 });
      const graph = runtime.inspectKnowledge();
      const read = (key: string) => hydrateNativeState(graph.nodes[key]!.value!, id => graph.nodes[id]!.value) as Record<string, any>;
      return { outcome: read(`reasoning:transition:${sequence}`).caller_acquisition.information_goal_result,
        memory: read('caller:displays'), receipt: result.snapshot.trace.findLast(e => e.kind === 'sic_information_return')! };
    },
  };
}

test('LOGI information election consumes the available sources and checks the addressed return', async t => {
  // Pass-through spies observe the native producers without supplying any offer or result.
  const points = t.mock.method(PointExperimentMemory.prototype, 'offers');
  const displays = t.mock.method(CoupledDisplays.prototype, 'offers');
  const motion = t.mock.method(NativeCallerCoordinator.prototype, 'currentMotionOffers');
  const caller = t.mock.method(NativeCallerCoordinator.prototype, 'informationOffer');
  const game = await session('LOGI', { live: true });
  const first = await game.ticket();
  assert.deepEqual(first.command, click(49, 50));
  assert.deepEqual([first.probe.starting_values, first.probe.receiver_values, first.probe.control_index], [[3, 3, 3], [11, 11, 3], 2]);
  assert.deepEqual([first.probe.distinct_outcomes, first.probe.admissible_offers, first.probe.rejected], [3, 1, {}]);
  assert.deepEqual(first.decision.need.evidence, [first.probe.observation_ref]);
  assert.equal(first.decision.need.kind, 'distinguish_public_hypotheses');
  assert.deepEqual(await points.mock.calls.at(-1)!.result, []);
  assert.deepEqual(await motion.mock.calls.at(-1)!.result, []);
  assert.equal(displays.mock.calls.at(-1)!.result!.length, 1);
  assert.equal(caller.mock.calls.at(-1)!.arguments[4]?.additionalOffers?.length ?? 0, 0);
  const changed = await game.advance();
  assert.deepEqual(changed.outcome.hypothesis_checks, { inert_decoration: 'contradicted', local_switch: 'contradicted', coupled_switch: 'matched' });
  assert.deepEqual([changed.outcome.measured, changed.receipt.objective, changed.receipt.evidence],
    ['coupled', first.decision.objective.id, changed.outcome.observation_ref]);
  assert.deepEqual(changed.memory.history.map((e: Record<string, any>) => [e.control, e.result, e.evidence]), [[2, 'coupled', changed.receipt.evidence]]);

  const second = await game.ticket();
  assert.deepEqual(second.command, click(5, 50));
  assert.equal(second.decision.need.id, first.decision.need.id);
  assert.deepEqual([second.probe.starting_values, second.probe.receiver_values, second.probe.engaged_parent], [[3, 3, 14], [3, 11, 11], true]);
  assert.deepEqual([second.probe.admissible_offers, second.probe.rejected, second.decision.considered], [2, {}, [{ strategy: 'coupled_displays', result: 'selected' }]]);
  const pointOffers = (await points.mock.calls.at(-1)!.result)!.map(pointGoal);
  const displayOffers = displays.mock.calls.at(-1)!.result!;
  assert.deepEqual(pointOffers.map(o => o.action), [{ action_ref: 'ACTION6', data: { x: 49, y: 50 } }]);
  assert.deepEqual(displayOffers.map(o => o.action), [{ action_ref: 'ACTION6', data: { x: 5, y: 50 } }]);
  assert.deepEqual(await motion.mock.calls.at(-1)!.result, []);
  // Same two real offers and same preference. Vary only evidence of an engaged parent.
  const preferPoint = compileInformationPreference({ mode: 'active', strategy: 'point_contrast', minimumOutcomes: 2 });
  const [context, , , remaining, options] = caller.mock.calls.at(-1)!.arguments;
  const choose = (engaged: boolean) => electInformationGoals([...pointOffers, { ...displayOffers[0], engaged_parent: engaged }],
    context, remaining, options?.meter ?? null, policy, false, preferPoint).next().value?.[0].source;
  assert.equal(choose(true), 'coupled_displays');
  assert.equal(choose(false), 'point_contrast');
  const boundary = await game.advance();
  assert.equal(boundary.outcome.measured, null);
  assert.deepEqual(boundary.outcome.hypothesis_checks, { inert_decoration: 'unknown', local_switch: 'unknown', coupled_switch: 'unknown' });
  assert.ok(boundary.memory.scored_schema);
});

function setReceiverValues(packet: V6PublicObservation, boxes: readonly number[][], values: number[]) {
  const changed = structuredClone(packet);
  for (const rows of [changed.frame, ...changed.frames]) for (const [i, [x1, y1, x2, y2]] of boxes.entries()) {
    for (let y = y1!; y <= y2!; y++) for (let x = x1!; x <= x2!; x++) (rows[y] as number[])[x] = values[i]!;
  }
  return changed;
}

test('fixed LOGI geometry changes the selected click with the rare receiver and the prediction with the return', async () => {
  const baseline = await session('LOGI'), original = await baseline.ticket();
  const { observations } = fixture.games.LOGI;
  const shifted = await session('LOGI', { initial: setReceiverValues(observations[0], original.probe.receivers, [3, 11, 11]) });
  const alternate = await shifted.ticket();
  assert.deepEqual(alternate.command, click(5, 50));
  assert.equal(alternate.probe.control_index, 0);
  assert.equal(alternate.decision.need.id, original.decision.need.id);
  assert.deepEqual([alternate.probe.controls, alternate.probe.receivers, alternate.probe.predictions],
    [original.probe.controls, original.probe.receivers, original.probe.predictions]);
  const local = await baseline.advance(setReceiverValues(observations[1], original.probe.receivers, original.probe.receiver_values));
  assert.equal(local.outcome.measured, 'local_only');
  assert.deepEqual(local.outcome.hypothesis_checks, { inert_decoration: 'contradicted', local_switch: 'matched', coupled_switch: 'contradicted' });
});

test('REWI opens a new scoped information need and an unchanged return excludes the same control', async () => {
  const game = await session('REWI', { sessionId: 'independent-rewi', live: true });
  const first = await game.ticket();
  assert.deepEqual(first.command, click(34, 61));
  assert.match(first.decision.need.scope, /^independent-rewi:epoch:1$/);
  assert.deepEqual([first.probe.controls.length, first.probe.receivers.length, first.probe.control_index], [6, 5, 5]);
  const stable = await game.advance();
  assert.equal(stable.outcome.measured, 'unchanged');
  assert.deepEqual(stable.outcome.hypothesis_checks, { inert_decoration: 'matched', local_switch: 'contradicted', coupled_switch: 'contradicted' });
  const second = await game.ticket();
  assert.deepEqual(second.command, click(28, 61));
  assert.deepEqual([second.probe.control_index, second.probe.engaged_parent, second.decision.need.id], [4, false, first.decision.need.id]);
  assert.deepEqual([second.probe.starting_values, second.probe.receiver_values], [first.probe.starting_values, first.probe.receiver_values]);
  assert.equal((await game.advance()).outcome.measured, 'unchanged');
});

test('an unreadable receiver leaves the three LOGI predictions unknown and acquires no display effect', async () => {
  const game = await session('LOGI'), first = await game.ticket();
  assert.deepEqual(first.command, click(49, 50));
  const partial = structuredClone(fixture.games.LOGI.observations[1]);
  const [x, y] = first.probe.receivers[0];
  for (const rows of [partial.frame, ...partial.frames]) rows[y][x] = 9;
  const unreadable = await game.advance(partial);
  assert.equal(unreadable.outcome.measured, null);
  assert.deepEqual(unreadable.outcome.hypothesis_checks, { inert_decoration: 'unknown', local_switch: 'unknown', coupled_switch: 'unknown' });
  assert.deepEqual(unreadable.memory.history, []);
});
