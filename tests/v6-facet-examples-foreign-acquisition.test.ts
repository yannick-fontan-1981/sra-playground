import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';

type R = Record<string, any>;
type Runtime = Awaited<ReturnType<typeof createNativeV6Runtime>>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-feedback-sequences-reference.json.gz', import.meta.url))).toString());
const declarations: NativeV6Declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};
const execution = { yieldControl: async () => {} };
const budgets = { targetLevels: 3, levelActionCaps: [120, 120, 120] };
const copy = <T>(value: T): T => structuredClone(value);
const commandValue = (command: NativeCommand | R) => ({ action_ref: command.action_ref, data: command.data ?? {} });
const coldFacet = (epoch: number | null = null): R => ({ failed: [], events: [], method: null, epoch,
  portable: null, compound_methods: {}, refuted_compounds: [] });
const supportOrder = ['oriented_coupling', 'invited_reduction', 'joint_transport', 'configured_arrivals',
  'metric_composition', 'sliding_cavity', 'ordered_support_transfer', 'animated_contact', 'fixed_origin',
  'subset_diagnosis', 'contextual_compartments', 'periodic_sums', 'reflected_cover'];
function session(id: string): R {
  const result = fixture.sessions.find((row: R) => row.id === id);
  assert.ok(result, `Retained original public Feedback session ${id}`); return result;
}
function graphValue(runtime: Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), node = graph.nodes[id];
  assert.ok(node, `Retained native node ${id}`);
  return (isNativeStateGraph(node.value)
    ? hydrateNativeState(node.value, fragment => graph.nodes[fragment]!.value)
    : decodeNativeState(node.value)) as R;
}
function facts(runtime: Runtime): R[] {
  return graphValue(runtime, 'reasoning:memory').facts.map((id: string) => graphValue(runtime, id));
}
function rebind(value: any, refs: Map<string, string>): any {
  if (typeof value === 'string') {
    if (value.startsWith('original-feedback-synthetic:epoch:')) {
      assert.ok(refs.has(value), `Unwitnessed original observation reference ${value}`); return refs.get(value);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(item => rebind(item, refs));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebind(item, refs)]));
  return value;
}

interface Call { owner: string; method: string; argc: number; before: string; after: string; selected: boolean }
function watch(runtime: Runtime) {
  const internal = runtime as unknown as R, owners = internal.families.filter((family: R) => family.id === 'facet_examples');
  assert.equal(owners.length, 1, 'The production factory retains exactly one Facet owner');
  const facet = owners[0]!, acquired = internal.acquisitionFamilies as R, calls: Call[] = [], facetRestores: R[] = [];
  assert.equal(Object.values(acquired).includes(facet), false, 'Facet is not a passive acquisition registration');
  assert.deepEqual(facet.state(), coldFacet());
  const observe = (owner: R, name: string, method: string): void => {
    assert.equal(typeof owner?.[method], 'function', `Existing ${name}.${method} hook`);
    const original = owner[method].bind(owner);
    // The spy neither replaces a provider nor fabricates a return. Preserve
    // each hook's synchronous/asynchronous return contract and real acquisition.
    owner[method] = (...args: any[]) => {
      calls.push({ owner: name, method, argc: args.length, before: args[0].observation_ref,
        after: args[1].observation_ref, selected: args[5] !== undefined && args[5] !== null });
      return original(...args);
    };
  };
  observe(facet, 'facet', 'record');
  const restore = facet.restore.bind(facet);
  facet.restore = (state: R) => { restore(state); facetRestores.push(copy(facet.state())); };
  // These are the distinct passive acquisition hooks in the actual caller.
  // Recolor and Symbols remain selected-only and are not falsely included.
  for (const [owner, method] of [
    ['supports', 'record'], ['preparations', 'recordSource'], ['recall', 'record'], ['workshop', 'recordSource'],
    ['framed', 'recordPublicTransition'], ['outline', 'recordPublicTransition'], ['inventory', 'recordSource'],
    ['reaction', 'recordSource'], ['reactive', 'recordSource'], ['feedback', 'record'], ['morphology', 'observeDepartures'],
  ]) observe(acquired[owner!]!, owner!, method!);
  assert.deepEqual(Object.keys(acquired.supports.acquiredCompositions), supportOrder);
  for (const child of supportOrder) observe(acquired.supports.acquiredCompositions[child], `support:${child}`, 'record');
  return { facet, feedback: acquired.feedback as R, calls, facetRestores };
}
const passiveOrder = ['supports', ...supportOrder.map(child => `support:${child}`), 'preparations', 'recall',
  'workshop', 'framed', 'outline', 'inventory', 'reaction', 'reactive', 'feedback', 'morphology'];
function assertReleased(result: NativeRuntimeYield, family: string): void {
  const snapshot = result.snapshot as R;
  assert.equal(result.kind, 'action', String(result.reason)); assert.equal(snapshot.lastDecision, family);
  assert.equal(snapshot.caller.enabled, true); assert.equal(snapshot.whyAct.enabled, true);
  assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(snapshot.whyAct.decision.decision.model_calls.length, 0);
  assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  const guard = snapshot.trace.findLast((entry: R) => entry.kind === 'before_guard');
  assert.equal(guard.admitted, true);
  if (result.command!.action_ref === 'ACTION6') assert.equal(guard.point_bound, true);
}
function assertUnacquiredFacet(runtime: Runtime, facet: R, expected: R, calls: Call[]): void {
  assert.equal(calls.filter(call => call.owner === 'facet').length, 0, 'A foreign selected return never invokes Facet.record');
  assert.deepEqual(facet.state(), expected, 'All seven source fields remain without foreign acquisition');
  assert.deepEqual(graphValue(runtime, 'family_state:facet_examples'), expected, 'The authoritative retained owner agrees');
  assert.deepEqual(facts(runtime).filter(fact => fact.key === 'facet_example_state' || /^facet_example_event:\d+$/.test(fact.key)), [],
    'No selected Facet event or acquired Facet reasoning fact is invented');
}

test('a genuinely selected Feedback return leaves Facet unacquired while every existing passive hook continues', async () => {
  // Unmodified production factory and source configuration, with a retained
  // cold synthetic public interface. No injected provider or prepared proposal.
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const { facet, feedback, calls, facetRestores } = watch(runtime), row = session('repeatable').steps[0], refs = new Map<string, string>();
  try {
    const selected = await runtime.initialize({ sessionId: 'facet-foreign-selected-feedback', observation: copy(row.beforePublic), budgets }, execution);
    assertReleased(selected, 'feedback_sequences');
    assert.equal((selected.snapshot as R).proposal.strategy_receipt.selected, 'goal_access');
    assert.deepEqual(commandValue(selected.command!), commandValue(row.command), 'Check the real computed input before supplying the archived public return');
    assert.deepEqual(commandValue(selected.command!), commandValue(row.proposal.actions[0]));
    refs.set(row.beforeObservation.observation_ref, selected.authorization!.observation_ref);
    const before = copy(facet.state());
    assert.ok(before.epoch === null || before.epoch === row.beforePublic.level, 'Planning may only measure the current epoch');
    assert.deepEqual(before, coldFacet(before.epoch));
    assert.equal(calls.length, 0, 'Planning does not acquire an unsent return');
    const returned = await runtime.advance({ command: selected.command!, observation: copy(row.afterPublic), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(returned.snapshot.actions, 1);
    const outcome = (returned.snapshot.trace as R[]).findLast(entry => entry.kind === 'actual_outcome');
    assert.ok(outcome); refs.set(row.afterObservation.observation_ref, outcome.observation_ref);
    assert.deepEqual(calls.map(call => call.owner), ['feedback', ...passiveOrder.filter(owner => owner !== 'feedback')],
      'Selected Feedback is recorded first and once; other passive acquisitions keep their source order');
    assert.equal(calls[0]!.argc, 8); assert.equal(calls[0]!.selected, true);
    assert.deepEqual(feedback.state(), rebind(row.stateAfter, refs), 'The selected foreign family still learns its exact source response');
    assertUnacquiredFacet(runtime, facet, before, calls);
    assert.ok(facetRestores.length > 0, 'The real common lifecycle restores the retained Facet owner');
    for (const state of facetRestores) {
      assert.ok(state.epoch === null || state.epoch === row.beforePublic.level);
      assert.deepEqual(state, coldFacet(state.epoch));
    }
    assert.deepEqual(facetRestores.at(-1), before);
  } finally { runtime.close('facet_foreign_selected_feedback_complete'); }
});

test('real frontier returns still teach passive Feedback, with no Facet acquisition or invented Facet event', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const { facet, feedback, calls } = watch(runtime), rows = session('passive-unmarked-append').steps.slice(0, 2), refs = new Map<string, string>();
  assert.equal(rows.length, 2); assert.ok(rows.every((row: R) => row.proposal === null));
  try {
    let selected = await runtime.initialize({ sessionId: 'facet-foreign-frontier-passive-feedback', observation: copy(rows[0].beforePublic), budgets }, execution);
    for (const [index, row] of rows.entries()) {
      if (selected.kind === 'boundary') selected = await runtime.resume(execution);
      assertReleased(selected, 'observed_frontier');
      assert.equal((selected.snapshot as R).proposal.strategy_receipt.selected, 'observed_frontier');
      assert.deepEqual(commandValue(selected.command!), commandValue(row.command), 'Compute the frontier input before giving its public return');
      refs.set(row.beforeObservation.observation_ref, selected.authorization!.observation_ref);
      const before = copy(facet.state()); assert.deepEqual(before, coldFacet(row.beforePublic.level));
      const count = calls.length;
      selected = await runtime.advance({ command: selected.command!, observation: copy(row.afterPublic), executionMs: 0 }, execution);
      assert.equal(selected.kind, 'boundary'); assert.equal(selected.snapshot.actions, index + 1);
      const outcome = (selected.snapshot.trace as R[]).findLast(entry => entry.kind === 'actual_outcome');
      assert.ok(outcome); refs.set(row.afterObservation.observation_ref, outcome.observation_ref);
      assert.deepEqual(calls.slice(count).map(call => call.owner), passiveOrder, 'Every existing passive owner sees the sealed public return once in source order');
      const passiveFeedback = calls.slice(count).find(call => call.owner === 'feedback')!;
      assert.equal(passiveFeedback.argc, 5); assert.equal(passiveFeedback.selected, false);
      assert.deepEqual(feedback.state(), rebind(row.stateAfter, refs));
      assertUnacquiredFacet(runtime, facet, before, calls);
    }
    assert.equal(feedback.state().entry_evidence.length, 1, 'The real second foreign return acquires an observed Feedback append');
    assert.equal(feedback.state().entry_evidence[0].value, 4);
    assert.equal(calls.filter(call => call.owner === 'feedback').length, 2);
    assert.deepEqual(facts(runtime).filter(fact => /^feedback_sequence_event:\d+$/.test(fact.key)), [],
      'Passive Feedback acquisition is retained as state without a selected-family event');
  } finally { runtime.close('facet_foreign_frontier_passive_feedback_complete'); }
});
