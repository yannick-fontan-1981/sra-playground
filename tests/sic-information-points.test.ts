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
import { contrastModels, forecast, PointExperimentMemory, SceneRelations } from '../src/logos-engine/v6-point-contrasts.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command, type V6Budgets, type V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const pinned = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, pinned), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
type Game = 'UPST' | 'EVAS';
interface Capture {
  sessionId: string;
  observations: V6PublicObservation[];
  commands: { id: number; data?: { x: number; y: number } }[];
  budgets: V6Budgets;
}
const captures: Record<Game, Capture> = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-point-contrasts-public.json.gz', import.meta.url))).toString());
const click = (x: number, y: number) => ({ actionRef: 'ACTION6', data: { x, y } });
type Row = Record<string, any>;

async function start(code: Game, live = false) {
  const sample = captures[code], sessionId = sample.sessionId;
  const backend = live && process.env.SIC_POINT_GAME_ROOT ? await sourceBackend(process.env.SIC_POINT_GAME_ROOT) : null;
  function input(sequence: number, command?: V6Command) {
    const historical = sample.observations[sequence]!;
    if (!backend) return historical;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code, level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...fields } = packet;
    assert.deepEqual(fields, historical, `${code} public return ${sequence}`);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  let sequence = 0;
  let result = await service.handle({ type: 'init', sessionId, sequence, observation: input(0), budgets: sample.budgets });
  return {
    async ticket() {
      if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(result.kind, 'action');
      const trace = result.snapshot.trace as readonly Row[], release = trace.findLast(e => e.kind === 'sic_native_plan')!;
      const guard = trace.findLast(e => e.kind === 'before_guard')!;
      assert.equal(guard.admitted, true);
      assert.equal(result.command!.actionRef, release.command.action_ref);
      assert.deepEqual(result.command!.data ?? {}, release.command.data ?? {});
      return { command: result.command!, release, guard, proposal: result.snapshot.proposal as Row };
    },
    async advance() {
      const expected = sample.commands[sequence]!;
      assert.equal(result.command!.actionRef, 'ACTION' + expected.id, `${code} ticket ${sequence + 1}`);
      assert.deepEqual(result.command!.data ?? {}, expected.data ?? {});
      const packet = input(++sequence, result.command!);
      result = await service.handle({ type: 'advance', sessionId, sequence, ticketId: result.ticket!.id, observation: packet, executionMs: 0 });
      const graph = runtime.inspectKnowledge();
      const state = (key: string) => hydrateNativeState(graph.nodes[key]!.value!, id => graph.nodes[id]!.value) as Row;
      const acquisition = state('reasoning:transition:' + sequence).caller_acquisition;
      return { point: acquisition.point_experiment_result, outcome: acquisition.information_goal_result,
        receipt: (result.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'sic_information_return'), memory: state('caller:points') };
    },
  };
}

type Ticket = Awaited<ReturnType<Awaited<ReturnType<typeof start>>['ticket']>>;
type Return = Awaited<ReturnType<Awaited<ReturnType<typeof start>>['advance']>>;
function checkTrial(ticket: Ticket, count: number, split: number[], point: V6Command) {
  const { release, proposal, guard } = ticket, goal = proposal.sic_information_decision, probe = proposal.question.curiosity;
  assert.deepEqual([release.family, release.strategy, release.authority, proposal.kind, guard.point_bound, guard.reason],
    ['information_goal', 'point_contrast', 'information', 'experiment', true, 'current_public_premises_match_provisional_step']);
  assert.deepEqual([goal.need.kind, goal.need.status, goal.need.parentObjective, release.subObjective],
    ['distinguish_public_hypotheses', 'assigned', 'G_protocol_completion', goal.objective.id]);
  assert.deepEqual([probe.admissible_offers, probe.worst_case_separation, probe.rejected, goal.evidence.distinctOutcomes], [count, split, {}, 2]);
  assert.deepEqual(ticket.command, point);
  assert.ok(goal.need.evidence.includes(release.observationRef));
  assert.deepEqual(probe.predictions, proposal.question.experiment.frozen_predictions);
}

function checkReturn(ticket: Ticket, result: Return, changed: boolean, matched: number, contradicted: number) {
  const { point, outcome, receipt } = result;
  const experiment = ticket.proposal.question.experiment;
  assert.deepEqual([point.record.action, point.record.observation_ref, point.record.observed_local_change],
    [ticket.release.command, ticket.release.observationRef, changed]);
  assert.deepEqual([receipt!.objective, receipt!.evidence, outcome.measured], [ticket.release.subObjective, point.record.after_ref, changed]);
  const checks = Object.fromEntries(Object.entries(experiment.frozen_predictions).map(([id, prediction]) => [id, prediction === changed ? 'matched' : 'contradicted']));
  assert.deepEqual(outcome.hypothesis_checks, checks);
  assert.deepEqual(receipt!.checks, checks);
  assert.deepEqual([Object.values(checks).filter(v => v === 'matched').length,
    Object.values(checks).filter(v => v === 'contradicted').length], [matched, contradicted]);
  assert.deepEqual(point.compared_pairs, experiment.new_contrast_pairs);
  for (const pair of point.compared_pairs) assert.ok(result.memory.compared_pairs.some((seen: string[]) => seen[0] === pair[0] && seen[1] === pair[1]));
}

test('UPST learns the first admissible point contrast at turn four and resumes exploration after its local return', async t => {
  const points = t.mock.method(PointExperimentMemory.prototype, 'offers');
  const displays = t.mock.method(CoupledDisplays.prototype, 'offers');
  const motion = t.mock.method(NativeCallerCoordinator.prototype, 'currentMotionOffers');
  const caller = t.mock.method(NativeCallerCoordinator.prototype, 'informationOffer');
  const game = await start('UPST', true);
  for (const [index, y] of [17, 1, 31].entries()) {
    const ticket = await game.ticket();
    assert.deepEqual([ticket.release.family, ticket.release.strategy, ticket.command], ['observed_frontier', 'test_local_input', click(10, y)]);
    assert.deepEqual(await points.mock.calls.at(-1)!.result, []);
    const returned = await game.advance();
    assert.equal(returned.point.record.observed_local_change, index === 2);
    assert.equal(returned.memory.has_positive, index === 2);
    assert.equal(returned.outcome, null);
  }
  const ticket = await game.ticket();
  checkTrial(ticket, 3, [1, 3], click(21, 13));
  const call = points.mock.calls.at(-1)!, [observation, actions] = call.arguments;
  assert.equal(observation.observation_ref, ticket.release.observationRef);
  const offers = (await call.result)!;
  assert.deepEqual(offers.map(o => o.binding.action.data), [{ x: 21, y: 13 }, { x: 42, y: 13 }, { x: 52, y: 31 }]);
  assert.deepEqual(displays.mock.calls.at(-1)!.result, []);
  assert.deepEqual(await motion.mock.calls.at(-1)!.result, []);
  assert.deepEqual(caller.mock.calls.at(-1)!.arguments[4]?.additionalOffers ?? [], []);
  // Re-elect the three real questions. Only the selected offer's current-observation reference changes.
  const goals = offers.map(pointGoal), priorRef = call.this!.records.at(-1)!.observation_ref;
  assert.notEqual(priorRef, observation.observation_ref);
  const [, , , remaining, options] = caller.mock.calls.at(-1)!.arguments;
  const choose = (rows: Row[]) => electInformationGoals(rows, observation, remaining, options?.meter ?? null,
    declarations.strategy.declarations[0].configuration.information_goal).next().value!;
  const [fresh] = choose(goals);
  const [alternative, election] = choose(goals.map(g => g === fresh ? { ...g, observation_ref: priorRef } : g));
  assert.deepEqual(fresh.action, ticket.release.command);
  assert.equal(alternative.source, 'point_contrast');
  assert.deepEqual(alternative.action.data, { x: 42, y: 13 });
  assert.notDeepEqual(alternative.relations, fresh.relations);
  assert.deepEqual([election.admissible_offers, election.rejected], [2, { stale: 1 }]);

  const models = await contrastModels(call.this!.records);
  const input = actions.find(a => a.data?.x === 53 && a.data.y === 17)!;
  const binding = await new SceneRelations(observation).features(input);
  assert.deepEqual(Object.values(forecast(models, binding!)), [false, false, false]);
  assert.ok(!offers.some(o => o.binding.action.data.x === 53 && o.binding.action.data.y === 17));
  const experiment = ticket.proposal.question.experiment;
  assert.deepEqual(Object.fromEntries(experiment.rivals.map((r: Row) => [r.feature, experiment.frozen_predictions[r.id]])),
    { pattern: false, ring: false, signature: true });
  assert.ok(experiment.rivals.every((r: Row) => r.source_ref === ticket.release.observationRef));
  const result = await game.advance();
  checkReturn(ticket, result, true, 1, 2);
  const nextModels = await contrastModels(result.memory.records);
  for (const rival of experiment.rivals) {
    const model = nextModels.find(m => m.id === rival.id)!;
    assert.deepEqual(model.counterexamples, rival.feature === 'signature' ? [] : [result.receipt!.evidence]);
  }
  const next = await game.ticket();
  assert.deepEqual(await points.mock.calls.at(-1)!.result, []);
  assert.deepEqual([next.release.family, next.release.strategy, next.command], ['observed_frontier', 'test_local_input', click(12, 1)]);
  assert.equal((await game.advance()).point.record.observed_local_change, false);
});

test('UPST same turn-four presentation with the two comparisons exhausted opens a frontier question', async t => {
  const original = NativeCallerCoordinator.prototype.informationOffer;
  let injected = false;
  t.mock.method(NativeCallerCoordinator.prototype, 'informationOffer', async function (this: NativeCallerCoordinator, ...args: Parameters<typeof original>) {
    const [observation] = args;
    if (!injected && observation.revision === 4) {
      const memory = this.points.state(), models = await contrastModels(memory.records);
      assert.deepEqual(memory.compared_pairs, []);
      const signature = models.find(m => m.feature === 'signature')!;
      const pairs = models.filter(m => ['pattern', 'ring'].includes(m.feature)).map(m => [signature.id, m.id].sort() as [string, string]);
      assert.equal(pairs.length, 2);
      this.points.restore({ ...memory, compared_pairs: pairs });
      injected = true;
    }
    return original.apply(this, args);
  });
  const points = t.mock.method(PointExperimentMemory.prototype, 'offers');
  const game = await start('UPST');
  for (let turn = 1; turn <= 3; turn++) { await game.ticket(); await game.advance(); }
  const fourth = await game.ticket();
  assert.ok(injected);
  assert.match(fourth.release.observationRef, /:revision:4:frame:8bca50d987f9fdee$/);
  assert.deepEqual(await points.mock.calls.at(-1)!.result, []);
  assert.deepEqual([fourth.release.family, fourth.release.strategy, fourth.command], ['observed_frontier', 'test_local_input', click(10, 48)]);
  assert.equal(fourth.proposal.sic_information_decision, undefined);
});

test('EVAS reuses point_contrast for a new need and then compares the three surviving models', async () => {
  const game = await start('EVAS', true);
  for (let turn = 1; turn <= 14; turn++) {
    const ticket = await game.ticket();
    assert.notEqual(ticket.release.strategy, 'point_contrast');
    await game.advance();
  }
  const first = await game.ticket();
  checkTrial(first, 11, [3, 7], click(31, 30));
  const returned = await game.advance();
  checkReturn(first, returned, true, 3, 4);
  const second = await game.ticket();
  checkTrial(second, 5, [1, 3], click(32, 35));
  assert.notEqual(second.release.subObjective, first.release.subObjective);
  assert.ok(second.proposal.sic_information_decision.need.evidence.includes(returned.receipt!.evidence));
  const survivors = Object.keys(returned.outcome.hypothesis_checks).filter(id => returned.outcome.hypothesis_checks[id] === 'matched');
  assert.deepEqual(Object.keys(second.proposal.question.experiment.frozen_predictions).sort(), survivors.sort());
  checkReturn(second, await game.advance(), false, 1, 2);
});
