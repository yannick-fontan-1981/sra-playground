import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { NativeSrcProgram } from '../src/logos-engine/v6-src-program.ts';
import type { Primitive } from '../src/logos-engine/ir.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-control-attention-reference.json.gz', import.meta.url))).toString());
const scene = (name: string): R => fixture.scenes[name];
const obs = (name: string): NativeObservation => scene(name).observation;
const snapshot = (name: string): Snapshot => Snapshot.fromPublic(obs(name), scene(name).rows);
const configuration = { targetLevels: 3, domain: new ObservedInputDomain(256), strategy: fixture.configuration, informationGoal: 'open_questions' as const };
const projection = (value: R): R => Object.fromEntries([
  'proposal', 'selected', 'visited', 'deferred_curiosity', 'morphology', 'attention_return', 'attention', 'frontier_calls',
].map(key => [key, value[key]]));

/** Same explicit dependency boundaries as the Python reference. This records
 * questions from the real coordinator; it neither grants nor executes actions.
 */
function connectBoundaries(caller: NativeCallerCoordinator, args: R, calls: R[]): void {
  caller.frontier.bindCurrentCandidateContext = (observation, registry) => {
    calls.push({ kind: 'bind', observation_ref: observation.observation_ref, registry: structuredClone(registry) });
  };
  caller.frontier.canProbeHere = async (observation, command) => {
    const result = !(args.frontier.unprobeable ?? []).includes(command.action_ref);
    calls.push({ kind: 'can_probe_here', observation_ref: observation.observation_ref, command: structuredClone(command), result });
    return result;
  };
  caller.frontier.propose = async (observation, inputs, options = {}) => {
    const sourceOptions = options as R, projected = structuredClone(sourceOptions);
    if (sourceOptions.return_episode) projected.return_episode = sourceOptions.return_episode.map(([before, command, after]: [Snapshot, string, Snapshot]) => [before.ref, command, after.ref]);
    calls.push({ kind: 'propose', observation_ref: observation.observation_ref, inputs: structuredClone(inputs), options: projected });
    if (Object.hasOwn(sourceOptions, 'return_episode')) return null;
    if (sourceOptions.control_acquisition) {
      const value = sourceOptions.control_acquisition;
      if ((args.frontier.decline_control ?? []).includes(value.action_ref)) return null;
      return { status: 'proposed', actions: [{ action_ref: value.action_ref }],
        question: { control_acquisition: structuredClone(value) }, contract_boundary: 'frontier' };
    }
    if (sourceOptions.curiosity) {
      const value = sourceOptions.curiosity;
      if ((args.frontier.decline_curiosity ?? []).includes(value.action.action_ref)) return null;
      return { status: 'proposed', actions: [structuredClone(value.action)],
        ...(args.sicInformation ? { bundle_template: { information_target: 'C_information_reference', objective_ref: 'G_protocol_completion' } } : {}),
        question: { curiosity: structuredClone(value) }, contract_boundary: 'frontier' };
    }
    return { status: 'unknown_contract_frontier', actions: [], contract_boundary: 'frontier' };
  };
  caller.points.offers = async () => [];
  caller.displays.offers = () => structuredClone(args.offers);
  caller.controls.offer = async () => null;
}

/** The native source SRC scheduler visits the actual DRM inventory. Untargeted
 * families are explicit null dependencies, matching the reference generator.
 */
async function runCase(sample: R, restore: boolean, sicInformation?: 'shadow' | 'active'): Promise<R[]> {
  const args = sample.args, current = obs(args.current), rows = scene(args.current).rows;
  const memory = new NativeReasoningMemory();
  const options = { ...configuration, sicInformation };
  let caller = new NativeCallerCoordinator(memory, options);
  caller.goal.memory.episode = args.history.map(([before, command, after]: string[]) => [snapshot(before!), command!, snapshot(after!)]);
  caller.targetMethod = structuredClone(args.target_method);
  const setupResults = [];
  for (const operation of args.attention_setup) {
    const values = structuredClone(operation.args);
    if (operation.expected_motion_order) values[0].expected_motion = Object.fromEntries(
      operation.expected_motion_order.map((signature: string) => [signature, values[0].expected_motion[signature]]));
    if (operation.focus) values[values.length - 1] = caller.attention.item!.id;
    const method = operation.method === 'take_parent_return' ? 'takeParentReturn' : operation.method;
    setupResults.push(await (caller.attention as any)[method](...values) ?? null);
  }
  assert.deepEqual(setupResults, sample.setup_results, 'Attention setup executes original events');
  assert.deepEqual(caller.attention.state(), sample.initial_attention);
  const result: R[] = [];
  for (let index = 0; index < args.repeat; index++) {
    if (restore) {
      const state = caller.state();
      caller = new NativeCallerCoordinator(memory, options);
      caller.restore(state);
      assert.deepEqual(caller.state(), state, 'Current evidence and attention survive caller restoration');
    }
    const calls: R[] = [];
    connectBoundaries(caller, { ...args, sicInformation }, calls);
    caller.prepare(current, args.remaining);
    let last: R | null = null;
    const offers = new Map<string, R | null>(), order: string[] = fixture.configuration.families;
    const provider = async (group: string): Promise<R | null> => {
      if (group === 'goal_access') return structuredClone(args.prior);
      if (group === 'morphology') {
        last = structuredClone(args.decision);
        return structuredClone(args.morphology_proposal);
      }
      if (group === 'attention_parent_return') return caller.attentionParentReturnOffer(current, rows, args.inputs, last);
      if (group === 'returned_branch_contrast') return caller.returnedBranchOffer(current, args.inputs);
      if (group === 'information_goal') return caller.currentInformationOffer(current, rows, args.inputs, args.remaining, null, last);
      if (group === 'acquire_control_for_target') return caller.acquireControlForTarget(current, rows, args.inputs, last);
      if (group === 'observed_frontier') return caller.frontierOffer(current, args.inputs);
      return null;
    };
    const callbacks: Record<string, Primitive> = {
      'families.begin': () => ({ pending: true, done: false, index: 0, progress: 0, visited: [] }),
      'families.offer': async ({ session }: R) => {
        const family = order[session.index]!;
        const proposal = await provider(family); offers.set(family, proposal);
        return { family, selected: proposal !== null };
      },
      'families.finish': ({ session, trial }: R) => ({ ...session, pending: false, done: true, progress: session.progress + 1,
        selected: trial.family, visited: [...session.visited, trial.family] }),
      'families.advance': ({ session }: R) => {
        const next = session.index + 1;
        return { ...session, index: next, progress: next, pending: next < order.length, done: next === order.length,
          visited: [...session.visited, order[session.index]] };
      },
    };
    const program = await NativeSrcProgram.create('v6.composition_strategy.choose', callbacks);
    const choice = (await program.run({ request: current.observation_ref })).result as R;
    const proposal = choice.selected ? offers.get(choice.selected) : { status: 'no_admissible_family', actions: [] };
    result.push({ proposal, selected: choice.selected ?? null, visited: choice.visited, deferred_curiosity: caller.deferredCuriosity,
      morphology: last ?? { status: 'not_evaluated', reason: 'prior_family_selected' },
      attention_return: caller.returnedAttention ? Object.fromEntries(['id', 'status', 'parent', 'pair_ref', 'returned_at'].map(key => [key, caller.returnedAttention![key]])) : null,
      attention: caller.attention.state(), frontier_calls: structuredClone(calls) });
  }
  return result;
}

test('control/attention reference executes the unchanged strategy source with declared boundary doubles', async () => {
  assert.equal(fixture.method.sourceModified, false);
  assert.equal(fixture.method.astTransformed, false);
  assert.equal(fixture.method.sourceChecks, 1786);
  assert.equal(fixture.method.before, true);
  assert.equal(fixture.method.after, true);
  assert.match(fixture.method.scope, /not a game or measurement proof/);
  const executed = new Set<string>(fixture.executed.map((row: R) => row.function));
  for (const name of ['StrategyRouter.choose', 'StrategyRouter.choose.<locals>.acquire_control',
    'StrategyRouter.choose.<locals>.information_goal', 'StrategyRouter.choose.<locals>.resume_parent',
    'contextual_translation_exposures', 'recalled_directions', 'AttentionMemory.take_parent_return']) assert.ok(executed.has(name), name);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  for (const sample of fixture.cases) for (const expected of sample.expected) {
    assert.ok(expected.morphology_reset_observed.every((value: boolean) => value === true), sample.id);
  }
});

test('the information agenda preserves native choices, resource guards and deferred attention', async () => {
  let selections = 0;
  for (const sample of fixture.cases) for (const mode of ['shadow', 'active'] as const) {
    const actual = await runCase(sample, false, mode);
    for (const row of actual) {
      if (row.proposal?.sic_information_decision) {
        const decision = row.proposal.sic_information_decision;
        assert.equal(decision.mode, mode);
        assert.equal(decision.objective.id, row.proposal.bundle_template.information_target);
        assert.equal(decision.considered.at(-1)?.result, 'selected');
        assert.match(decision.need.id, /^sic-need:/);
        selections++;
        delete row.proposal.sic_information_decision;
      }
      if (row.proposal?.question?.curiosity) delete row.proposal.bundle_template;
    }
    assert.deepEqual(actual, sample.expected.map(projection), `${sample.id} ${mode}`);
  }
  assert.ok(selections > 0);
});

for (const sample of fixture.cases) test(`original V6 control/attention consumer parity: ${sample.id}`, async () => {
  assert.deepEqual(await runCase(sample, false), sample.expected.map(projection));
});

test('retained focus, recalled directions and single-use parent returns preserve parity after authoritative caller restoration', async () => {
  const cases = fixture.cases.filter((sample: R) => sample.args.attention_setup.length || sample.args.target_method);
  assert.ok(cases.length >= 10);
  for (const sample of cases) assert.deepEqual(await runCase(sample, true), sample.expected.map(projection), sample.id);
});

test('the assimilation card changes the command offered to the guarded frontier when an earlier effect can be revalidated', async () => {
  const args = fixture.cases.find((sample: R) => sample.id === 'recalled_unmeasured_axis_precedes_parallel').args;
  const observation = obs(args.current);
  const strategy = { ...configuration.strategy, acquire_control_for_target: {
    ...configuration.strategy.acquire_control_for_target, recall: 'source_order',
  } };
  async function choose(assimilate: boolean, decline: string[] = []) {
    const caller = new NativeCallerCoordinator(new NativeReasoningMemory(), { ...configuration, strategy });
    caller.targetMethod = structuredClone(args.target_method);
    delete caller.targetMethod!.motion_examples.ACTION2;
    caller.goal.memory.episode = args.history.map(([before, command, after]: string[]) => [snapshot(before!), command!, snapshot(after!)]);
    connectBoundaries(caller, { ...args, frontier: { ...args.frontier, decline_control: decline } }, []);
    caller.prepare(observation, args.remaining);
    if (assimilate) caller.reasoningMode = 'assimilation';
    return (await caller.acquireControlForTarget(observation, scene(args.current).rows, args.inputs, args.decision))
      ?.question.control_acquisition.action_ref;
  }
  assert.equal(await choose(false), 'ACTION2');
  assert.equal(await choose(true), 'ACTION3');
  assert.equal(await choose(true, ['ACTION3']), 'ACTION2');
});

test('source witnesses cover both information refusals, shared questions, all return outcomes and exact group order', () => {
  const byId: Record<string, R> = Object.fromEntries(fixture.cases.map((row: R) => [row.id, row]));
  const first = (id: string): R => byId[id]!.expected[0];
  assert.equal(first('replication_precedes_unused_command').proposal.question.control_acquisition.experiment, 'replicate_translation');
  assert.equal(first('contextual_block_replication').proposal.question.control_acquisition.experiment, 'replicate_after_contextual_block');
  assert.equal(first('unused_lexical_control').proposal.question.control_acquisition.experiment, 'sample_unused_control');
  assert.equal(first('unused_parent_defers_unbound_other_question').deferred_curiosity[0].reason, 'unbound_return_from_the_current_role_acquisition_goal');
  assert.equal(first('replication_defers_question_and_opens_attention').deferred_curiosity[0].reason, 'would_abandon_current_control_witness_without_bound_return');
  assert.ok(first('same_action_information_tests_control').proposal.question.curiosity.also_tests_current_control);
  assert.equal(first('bound_return_allows_other_information').selected, 'information_goal');
  assert.deepEqual(first('no_offers_does_not_inspect_control').frontier_calls.filter((row: R) => row.kind === 'can_probe_here'), []);
  for (const status of ['matched', 'contradicted', 'unobserved']) {
    const sample = byId[`parent_return_${status}`]!, expected = sample.expected[0];
    assert.equal(expected.selected, 'attention_parent_return');
    assert.equal(expected.attention_return.status, status);
    assert.equal(expected.attention.item.status, 'returned');
    assert.equal(sample.expected[1].attention_return, null, 'The observed return is consumed once');
  }
  for (const [label, status] of [['missing_first', 'unobserved'], ['contradiction_first', 'contradicted']]) {
    const sample = byId[`parent_return_mixed_${label}`]!, expected = sample.expected[0];
    assert.equal(sample.setup_results[1].status, status,
      'Attention preserves the first missing/contradicted role in the explicitly supplied traversal order');
    assert.equal(expected.attention_return.status, status);
    assert.equal(expected.selected, 'attention_parent_return');
    assert.equal(expected.attention.item.result, status);
    assert.equal(sample.expected[1].attention_return, null, 'Both mixed outcomes return only once');
  }
  assert.notEqual(first('returned_pair_mismatch_falls_through').selected, 'attention_parent_return');
  assert.deepEqual(first('prior_family_resets_last_before_morphology').morphology, { status: 'not_evaluated', reason: 'prior_family_selected' });
  const order = fixture.configuration.families, start = order.indexOf('morphology');
  assert.deepEqual(order.slice(start), ['morphology', 'attention_parent_return', 'returned_branch_contrast', 'information_goal',
    'acquire_control_for_target', 'view', 'view_continuity', 'observed_frontier']);
});
