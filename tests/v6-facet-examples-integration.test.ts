import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { createNativeV6Runtime, NativeV6Runtime, facetExampleFamily } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeFamily, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-facet-examples-reference.json.gz', import.meta.url))).toString());
const declarations: NativeV6Declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
};
const copy = <T>(value: T): T => structuredClone(value);
const OWNER = 'facet_examples';
const execution = { yieldControl: async () => {} };
const budgets = { targetLevels: 6, levelActionCaps: [80, 80, 80, 80, 80, 80] };
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
const facts = (runtime: NativeV6Runtime): R[] => value(runtime, 'reasoning:memory').facts.map((id: string) => value(runtime, id));
function rebind(data: any, refs: Map<string, string>): any {
  if (typeof data === 'string') {
    if (data.startsWith(`${fixture.provenance.observationScope}:epoch:`)) {
      assert.ok(refs.has(data), `Unwitnessed original observation reference ${data}`); return refs.get(data);
    }
    return data;
  }
  if (Array.isArray(data)) return data.map(item => rebind(item, refs));
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, rebind(item, refs)]));
  return data;
}
function watch(runtime: NativeV6Runtime) {
  const backend = runtime as unknown as R;
  const owners = backend.families.filter((family: NativeFamily) => family.id === OWNER);
  assert.equal(owners.length, 1);
  const owner = owners[0] as NativeFamily, records: R[] = [], restores: R[] = [];
  assert.equal(Object.values(backend.acquisitionFamilies).includes(owner), false, 'Facet is selected-only, not a passive acquisition owner');
  const record = owner.record.bind(owner), restore = owner.restore.bind(owner);
  owner.record = async (...args) => {
    const result = await record(...args);
    records.push({ argc: args.length, arguments: copy(args.slice(0, 7)), result: copy(result) }); return result;
  };
  owner.restore = state => { restore(state); restores.push(copy(owner.state())); };
  return { owner, records, restores };
}
function assertReleased(result: NativeRuntimeYield): void {
  assert.equal(result.kind, 'action', String(result.reason));
  const snapshot = result.snapshot as R;
  assert.equal(snapshot.lastDecision, OWNER);
  assert.equal(snapshot.whyAct.decision.decision.status, 'action_set_released');
  assert.equal(snapshot.whyAct.decision.decision.model_calls.length, 0);
  assert.equal(snapshot.caller.enabled, true);
  assert.equal(snapshot.srcDecision.workflow, 'v6.composition_strategy.choose');
  assert.equal(snapshot.proposal.program_subquestion, 'facet_example');
  assert.equal(snapshot.proposal.strategy_receipt.selected, 'surface');
  const guard = snapshot.trace.findLast((row: R) => row.kind === 'before_guard');
  assert.equal(guard.admitted, true); assert.equal(guard.point_bound, true);
}

test('production factory places one Facet owner first in the declared surface order, with no recognition stop', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const groups = (runtime.snapshot().coverage as R).sourceGroups;
    const surface = groups.find((group: R) => group.id === 'surface');
    assert.deepEqual(surface.families.slice(0, 3), [OWNER, 'surface_program', 'code_program']);
    assert.equal(surface.entryPoints[0], 'facet_example');
    assert.equal(declarations.strategy.declarations[0]!.configuration.program_construction.ordered_subquestions[0], 'facet_example');
    const { owner } = watch(runtime);
    assert.equal(owner.sourceGroupStop, undefined);
    assert.deepEqual(owner.state(), { failed: [], events: [], method: null, epoch: null,
      portable: null, compound_methods: {}, refuted_compounds: [] });
    assert.equal((runtime.snapshot().coverage as R).fullV6Parity, false);
  } finally { runtime.close('facet_registration_contract_complete'); }
});

const coldSessions = fixture.sessions.filter((session: R) => {
  const state = session.steps[0]?.stateBefore;
  return state && state.epoch === null && state.portable === null && state.method === null
    && state.events.length === 0 && state.failed.length === 0 && Object.keys(state.compound_methods).length === 0 && state.refuted_compounds.length === 0;
});
assert.ok(coldSessions.length >= 2, 'Source fixtures must contain distinct cold acquisition sessions');
for (const session of coldSessions) test(`actual common Facet selection, acquisition, Kernel retention and restoration: ${session.id}`, async () => {
  // Only the source family-order configuration is isolated. Measurements,
  // compiled workflow, proposals, WHY/ACT, action guards and memory are real.
  const policy = copy(declarations);
  policy.strategy.declarations[0]!.configuration.families = ['surface'];
  policy.strategy.declarations[0]!.configuration.program_construction.ordered_subquestions = ['facet_example'];
  const runtime = await createNativeV6Runtime(policy, { now: () => 0 });
  const { owner, records, restores } = watch(runtime), refs = new Map<string, string>();
  let result: NativeRuntimeYield;
  try {
    result = await runtime.initialize({ sessionId: `facet-integration-${session.id}`,
      observation: copy(session.steps[0].beforePublic), budgets }, execution);
    for (const row of session.steps) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      assert.deepEqual((runtime as unknown as R).current, row.beforePublic,
        'The source step begins at the actual preceding public return, without an injected observation');
      const observation = (runtime as unknown as R).observation;
      refs.set(row.beforeObservation.observation_ref, observation.observation_ref);
      assert.deepEqual(owner.state(), rebind(row.stateAfterPropose, refs), 'Proposal changes only source-authorized epoch state');
      if (!row.proposal) { assert.notEqual(result.kind, 'action'); continue; }
      assertReleased(result);
      assert.deepEqual(result.command, row.proposal.actions[0], 'Compute the experiment before supplying any archived return');
      assert.deepEqual((result.snapshot as R).proposal.facet_plan, rebind(row.proposal.facet_plan, refs));
      if (!row.command) continue;
      assert.deepEqual(result.command, row.command);
      const count = records.length;
      result = await runtime.advance({ command: result.command!, observation: copy(row.afterPublic), executionMs: 0 }, execution);
      assert.equal(result.kind, 'boundary');
      const outcome = (result.snapshot.trace as R[]).findLast(item => item.kind === 'actual_outcome');
      assert.ok(outcome); refs.set(row.afterObservation.observation_ref, outcome.observation_ref);
      const expected = rebind(row.stateAfter, refs);
      assert.equal(records.length, count + 1, 'Selected response acquired once');
      assert.equal(records.at(-1)!.argc, 8, 'The actual selected-family call supplies its proposal, index and public frame packet');
      assert.equal(records.at(-1)!.arguments.length, 7);
      assert.ok(records.at(-1)!.arguments[5]?.facet_plan);
      assert.deepEqual(records.at(-1)!.result, { events: [rebind(row.record, refs)] });
      assert.deepEqual(owner.state(), expected);
      assert.deepEqual(value(runtime, `family_state:${OWNER}`), expected);
      const stored = facts(runtime).find(fact => fact.key === 'facet_example_state');
      assert.ok(stored); assert.deepEqual(stored.value, expected);
      assert.ok(restores.some(state => state.events.length === expected.events.length));
      // Discard this working copy and restore from the actual common store.
      owner.restore(copy(session.steps[0].stateBefore));
      (runtime as unknown as R).restoreFamilies();
      assert.deepEqual(owner.state(), expected);
    }
    const acquired = session.steps.filter((row: R) => row.command);
    assert.equal(records.length, acquired.length);
    assert.equal(facts(runtime).filter(fact => /^facet_example_event:\d+$/.test(fact.key)).length, acquired.length);
    assert.deepEqual(records.map(row => row.result.events[0].status), acquired.map((row: R) => row.record.status));
    assert.deepEqual(Object.keys(owner.state()).sort(), ['compound_methods', 'epoch', 'events', 'failed', 'method', 'portable', 'refuted_compounds']);
  } finally { runtime.close(`facet_common_${session.id}_complete`); }
});

for (const id of ['action6-unavailable', 'no-world-frame']) test(`a Facet abstention leaves later surface providers and outer groups reachable: ${id}`, async () => {
  // Select an intrinsic public-interface refusal. The fixture's first null
  // proposal is remaining-zero, which would become eligible under these real
  // nonzero runtime budgets and therefore cannot establish this routing rule.
  const initial = fixture.initial.find((row: R) => row.id === id);
  assert.ok(initial, 'Original-source refusal fixture');
  assert.equal(initial.proposal, null); assert.ok(initial.remaining > 0);
  assert.equal(initial.projection !== null, id === 'action6-unavailable', 'Cover both a recognized interface and an unrecognized domain');
  const calls: string[] = [], facet = facetExampleFamily();
  const probe = (id: string): NativeFamily => ({ id,
    propose: () => { calls.push(id); return null; },
    before: () => assert.fail('No proposal to authorize'), after: () => assert.fail('No invented response'),
    record: () => assert.fail('No invented acquisition'), state: () => ({}), restore: state => assert.deepEqual(state, {}) });
  const later = probe('later_surface_contract'), outer = probe('outer_group_contract');
  const runtime = new NativeV6Runtime({ sourceDigest: `facet-source-refusal-scope:${id}`, now: () => 0,
    families: [facet, later, outer], maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
    groups: [{ id: 'surface', families: [facet.id, later.id], entryPoints: ['facet_example', null] },
      { id: 'view', families: [outer.id] }] });
  try {
    const result = await runtime.initialize({ sessionId: `facet-source-refusal:${id}`, observation: copy(initial.public), budgets }, execution);
    assert.notEqual(result.kind, 'action'); assert.deepEqual(calls, [later.id, outer.id]);
    assert.deepEqual((result.snapshot.trace as R[]).filter(row => row.kind === 'source_group_stop'), []);
    assert.equal(result.snapshot.actions, 0);
  } finally { runtime.close(`facet_refusal_scope_${id}_complete`); }
});
