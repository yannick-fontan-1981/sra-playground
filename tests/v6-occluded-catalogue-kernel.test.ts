import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-occluded-catalogue-frontier-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const policy = declarations.strategy.declarations[0]!.configuration.window_constraints;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const OWNER = 'family_state:public_occurrence_recall';
const CATALOGUE_KINDS = new Set(['catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed']);
const CAUSE = { workflow: 'test.catalogue.common', step: 'checkpoint', statement: 'retain' };

function recordSourceReturn(family: SharedSeriesConstraint, index: number): R {
  const before = probe.packets[index], after = probe.packets[index + 1];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, copy(probe.prefixes[index].proposal), 0, after.packet.frame_packet);
}
function acquired(count: number): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(policy.occurrence_recall);
  for (let index = 0; index < count; index++) recordSourceReturn(family, index);
  return family;
}
function ownState(family: SharedSeriesConstraint): R {
  const state = family.catalogue.currentState() as unknown as R;
  return Object.fromEntries(Object.keys(probe.initialState.projection).map(key => [key, state[key]]));
}
async function offer(family: SharedSeriesConstraint, packetIndex: number, mode: 'point' | 'view'): Promise<R | null> {
  const row = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  const inputs = domain.candidates(row.observation);
  return mode === 'view'
    ? family.catalogueViewPropose(row.observation, row.packet.frame_rows, inputs, 600, policy.occluded_catalogue_composition, 360_000, () => 0)
    : family.cataloguePropose(row.observation, row.packet.frame_rows, inputs, 600, policy.occluded_catalogue_composition, 360_000, () => 0);
}

// Expected commands stay in the test host. The native common caller starts
// empty and chooses each command before it receives the retained public return.
test('cold common caller acquires catalogue inputs passively and reaches the first public boundary without priming', async context => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, initial = copy(family.state());
  const view = families.find(family => family.id === 'view')!;
  const viewOriginal = view.propose.bind(view), sharedOriginal = family.proposeInGroup!.bind(family), visits: string[] = [];
  context.mock.method(view, 'propose', (...args: Parameters<NativeFamily['propose']>) => {
    visits.push('view'); return viewOriginal(...args);
  });
  context.mock.method(family, 'proposeInGroup', (...args: Parameters<NonNullable<NativeFamily['proposeInGroup']>>) => {
    if (args[0] === 'view') visits.push('catalogue');
    return sharedOriginal(...args);
  });
  let result = await runtime.initialize({ sessionId: 'anonymous-catalogue-common-public-replay', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.deepEqual(family.state(), initial, 'Planning cannot acquire a projected first-view effect');
  const groups = (result.snapshot.coverage as R).sourceGroups;
  assert.deepEqual(groups.find((group: R) => group.id === 'view').families, ['view', family.id]);
  const window = groups.find((group: R) => group.id === 'window_constraints');
  assert.ok(window.entryPoints.indexOf('occluded_catalogue_composition') < window.entryPoints.indexOf('queued_field_composition'));
  let expectedEvents = 0, viewPrefixes = 0;
  // The five-command first level is the verified common trajectory. The full
  // native caller can select providers absent from the source subset later.
  for (let index = 0; index < 5; index++) {
    if (result.kind === 'boundary') {
      const retained = copy(family.state()); visits.length = 0;
      result = await runtime.resume(execution);
      assert.deepEqual(family.state(), retained, 'Replanning must not duplicate actual catalogue acquisitions');
    }
    assert.equal(result.kind, 'action', result.reason);
    assert.ok(result.authorization, 'Catalogue inference cannot bypass the actual WHY/ACT gate');
    assert.deepEqual(result.command, probe.packets[index + 1].command,
      `public return ${index + 1}, level ${result.snapshot.level}, provider ${result.snapshot.lastDecision}, kind ${(result.snapshot.proposal as R).kind}`);
    const proposal = result.snapshot.proposal as R, sourceProposal = probe.prefixes[index].proposal;
    const mode = sourceProposal.occluded_catalogue_plan?.mode;
    if (!mode) {
      // The source fixture coordinates three providers, not the full caller.
      // Later epoch-start inputs can be chosen by another native capability.
      if (index === 0) {
        assert.equal(result.snapshot.lastDecision, 'observed_frontier');
        assert.equal(proposal.kind, 'experiment');
        assert.equal(proposal.question.reason, 'unobserved_input_effect_or_unexplained_transition');
      }
      assert.equal(proposal.occluded_catalogue_plan, undefined);
      assert.equal(proposal.steps[0].point_binding, undefined);
    } else {
      assert.equal(result.snapshot.lastDecision, family.id);
      assert.equal(proposal.occluded_catalogue_plan.mode, mode);
      if (mode === 'view') {
        viewPrefixes++;
        assert.deepEqual(visits, ['view', 'catalogue'], 'The catalogue is only the source fallback after ViewFrontier');
        assert.equal(proposal.strategy_receipt.selected, 'view');
        assert.equal(proposal.field_subquestion, undefined);
        assert.equal(proposal.steps[0].point_binding, undefined, 'Scalar view inputs need no invented pixel binding');
        assert.equal(proposal.steps[0].point_support, undefined);
        assert.equal(result.command!.data, undefined, 'Keep the raw scalar identity, not transport data:{}');
        assert.equal(proposal.occluded_catalogue_plan.details.terminal_role, 'unknown');
      } else {
        assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
        assert.equal(proposal.field_subquestion, 'occluded_catalogue_composition');
        const binding = proposal.steps[0].point_binding;
        assert.ok(binding);
        assert.deepEqual(binding.point, [result.command!.data!.x, result.command!.data!.y]);
        assert.equal(binding.frame_hash, probe.packets[index].packet.frame_hash);
        assert.equal(binding.palette_value, probe.packets[index].packet.frame_rows[binding.point[1]][binding.point[0]]);
      }
    }
    result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(probe.packets[index + 1].packet) }, execution);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    const graph = runtime.inspectKnowledge();
    const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
    const state = read(OWNER), catalogue = state.events.filter((event: R) => CATALOGUE_KINDS.has(event.kind));
    expectedEvents += probe.prefixes[index].steps[0].acquired.events.filter((event: R) => CATALOGUE_KINDS.has(event.kind)).length;
    assert.equal(catalogue.length, expectedEvents, 'Selected and passive acquisition must retain each event only once');
    assert.deepEqual(state, family.state());
    const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
    assert.equal(prefix.transitions.length, 1);
    const transition = read(`reasoning:transition:${prefix.decision_revision}`);
    assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    if (index === 0) {
      const input = catalogue.find((event: R) => event.kind === 'catalogue_field_input_observed');
      assert.equal(input.field_changed, true); assert.equal(input.structure_preserved, true);
      assert.deepEqual(input.command, (result.snapshot.proposal as R).actions[0]);
      assert.equal(input.command.data, undefined);
      const facts = (read('reasoning:memory').facts as string[]).map(read);
      assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, state);
    }
  }
  assert.equal(result.kind, 'boundary'); assert.equal(result.reason, null);
  assert.equal(result.snapshot.actions, 5); assert.equal(result.snapshot.levelsCompleted, 1);
  assert.equal(result.snapshot.level, 2);
  assert.equal((result.snapshot.caller as R).boundaryReplays, 1);
  assert.equal(viewPrefixes, 1); assert.equal(expectedEvents, 9);
});

test('catalogue source layers preserve passive state, view inheritance and actual Kernel hydration', async context => {
  const family = acquired(3);
  assert.deepEqual(ownState(family), probe.prefixes[2].steps[0].afterState.projection);
  const oldEvents = copy(family.state());
  assert.equal(await offer(family, 3, 'point'), null, 'Ambiguous candidates do not license an answer');
  const next = await offer(family, 3, 'view'); assert.ok(next);
  assert.deepEqual(family.state(), oldEvents);
  const observed: Record<string, boolean> = {};
  for (const [name, owner] of [['queued', family.queued], ['rooted', family.rooted], ['product', family.product]] as const) {
    const original = owner.record.bind(owner);
    context.mock.method(owner, 'record', (...args: any[]) => {
      observed[name] = Boolean(args[5].occluded_catalogue_plan);
      return (original as (...values: any[]) => any)(...args);
    });
  }
  const response = recordSourceReturn(family, 3);
  assert.deepEqual(observed, { queued: true, rooted: false, product: true });
  assert.ok(probe.prefixes[3].proposal.occluded_catalogue_plan, 'Inheritance cannot delete the original retained proposal');
  assert.equal(response.events.filter((event: R) => event.kind === 'catalogue_response').length, 0);
  assert.equal(response.events.filter((event: R) => event.kind === 'catalogue_field_input_observed').length, 1);
  assert.deepEqual(ownState(family), probe.prefixes[3].steps[0].afterState.projection);

  const store = new NativeKnowledgeStore('catalogue-native-integration-v49', 'catalogue-hydrate');
  await store.commit([{ id: OWNER, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const retained = store.stateValue(OWNER) as R, restored = new SharedSeriesConstraint(policy.occurrence_recall);
  restored.restoreNative(retained);
  assert.deepEqual(restored.state(), retained);
  assert.deepEqual(ownState(restored), ownState(family));
  assert.deepEqual(await offer(restored, 4, 'point'), await offer(family, 4, 'point'));
  const exposed = restored.catalogue.currentState();
  exposed.catalogue_events.length = 0; exposed.catalogue_view_events[0]!.command.action_ref = 'UNACQUIRED_EDIT';
  response.events.find((event: R) => event.kind === 'catalogue_field_input_observed').command.action_ref = 'UNACQUIRED_EDIT';
  assert.deepEqual(restored.state(), retained, 'Detached public state and returned events cannot edit retained memory');
});

test('a scalar catalogue view is bound to its current public premises and available command', async () => {
  const family = acquired(3), row = probe.packets[3], proposal = await offer(family, 3, 'view'); assert.ok(proposal);
  const domain = new ObservedInputDomain(4096); domain.candidates(row.observation);
  family.bind(proposal, domain);
  assert.equal(proposal.steps[0].point_binding, undefined);
  assert.equal(family.before(proposal, 0, row.packet, row.observation).admitted, true);
  const point = copy(proposal); point.actions[0].data = { x: 1, y: 1 };
  assert.throws(() => family.bind(point, domain), /point data/);
  const payload = copy(proposal); payload.bundle_template.actions[0].action_ref = 'ACTION7';
  assert.equal(family.before(payload, 0, row.packet, row.observation).admitted, false);
  const changed = copy(row.packet); changed.frame_rows[0][0] = (changed.frame_rows[0][0] + 1) % 16;
  assert.equal(family.before(proposal, 0, changed, row.observation).admitted, false);
  assert.equal(family.before(proposal, 1, row.packet, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, level: 2 }, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, levels_completed: 1 }, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, row.packet, { ...row.observation, observation_ref: 'another-occurrence' }).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, available_action_refs: [] }, row.observation).admitted, false);
});

test('a catalogue answer needs the current measured point and retains global correctness as unknown', async () => {
  const family = acquired(1), row = probe.packets[1], proposal = await offer(family, 1, 'point'); assert.ok(proposal);
  assert.equal(proposal.occluded_catalogue_plan.mode, 'answer');
  assert.throws(() => family.bind(copy(proposal), new ObservedInputDomain(4096)), /current observed input domain/);
  const domain = new ObservedInputDomain(4096); domain.candidates(row.observation);
  family.bind(proposal, domain);
  assert.deepEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support);
  assert.equal(family.before(proposal, 0, row.packet, row.observation).admitted, true);
  const changed = copy(proposal); changed.actions[0].data.x += 1;
  assert.throws(() => family.bind(changed, domain), /payload changed/);
  assert.equal(family.before(changed, 0, row.packet, row.observation).admitted, false);
  const after = probe.packets[2];
  const outcome = family.after(proposal, 0, row.observation, after.observation, row.packet.frame_rows, after.packet.frame_rows);
  assert.equal(outcome.matched, null); assert.equal(outcome.official_progress, false);
  assert.equal(outcome.reason, 'catalogue_submission_without_local_correctness_claim');
});

test('empty candidate contradictions survive recall and corrupt journals are rejected atomically', async () => {
  const family = acquired(3), clean = family.nativeState(), changed = copy(clean);
  changed.events.find((event: R) => event.kind === 'catalogue_observation').candidate_ids = [999];
  assert.throws(() => family.restore(changed), /Shared series memory changed/);
  assert.deepEqual(family.nativeState(), clean);

  // Controlled reducer input: an observed contradiction remains empty after
  // checkpoint hydration. It grants neither an answer nor a further view.
  const observation = copy([...family.catalogue.currentState().catalogue_events].reverse()
    .find(event => event.kind === 'catalogue_observation'));
  observation.candidate_ids = []; observation.current_pose_alternatives = [];
  family.catalogue.applyEvent(observation); family.events.push(observation);
  const contradictory = family.nativeState(); assert.notDeepEqual(contradictory, clean);
  const restored = new SharedSeriesConstraint(policy.occurrence_recall); restored.restoreNative(contradictory);
  assert.deepEqual(restored.catalogue.currentState().catalogue_candidates[observation.catalogue_key], []);
  assert.equal(await offer(restored, 3, 'point'), null);
  assert.equal(await offer(restored, 3, 'view'), null);
  family.restoreNative(clean);
  assert.deepEqual(family.nativeState(), clean, 'A stale accepted checkpoint cannot hide changed reducer state');
  assert.deepEqual(ownState(family), probe.prefixes[2].steps[0].afterState.projection);
});
