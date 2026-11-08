import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint, createNativeSharedSeriesFamily } from '../src/logos-engine/v6-shared-series.ts';
import { AlternatingGraphMemory } from '../src/logos-engine/v6-alternating-graph-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativeExecution, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixtureBytes = await readFile(new URL('./fixtures/v6-alternating-graph-access-reference.json.gz', import.meta.url));
const oracle = JSON.parse(gunzipSync(fixtureBytes).toString());
const common = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-alternating-common-reference.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('agents/yf_arc3_v6/morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const copy = <T>(value: T): T => structuredClone(value);
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';

function initial(id: string | null): SharedSeriesConstraint {
  const seed = new SharedSeriesConstraint(oracle.policy.recall);
  // Replay every raw event, including source ancestor events. Unsupported kinds
  // must fail here rather than be removed to manufacture inherited parity.
  for (const original of id ? oracle.states[id].events : []) {
    const event = copy(original);
    if (event.kind === 'alternating_graph_evidence') seed.graph.applyEvent(event);
    else seed.memory.applyEvent(event);
    seed.events.push(copy(event));
  }
  if (id) assert.deepEqual(seed.graph.state(), oracle.states[id].projection);
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  family.restore(seed.state()); return family;
}

test('whole common envelopes bind the actual unmodified inherited caller and input fixture', async () => {
  assert.equal(common.sourceCommit, oracle.sourceCommit); assert.equal(common.sourceModified, false);
  assert.equal(common.inputSha256, createHash('sha256').update(fixtureBytes).digest('hex'));
  for (const [path, expected] of Object.entries(common.sourceHashes)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(path, source))).digest('hex'), expected, path);
  }
  assert.equal(common.journals.length, oracle.journals.length);
});

for (const journal of common.journals) test('complete original common acquisition and V7 restoration: ' + journal.id, async () => {
  const inputs = oracle.journals.find((entry: R) => entry.id === journal.id);
  assert.ok(inputs); assert.equal(journal.steps.length, inputs.steps.length);
  let family = initial(journal.initialState);
  const store = new NativeKnowledgeStore('alternating-common-v36', journal.id);
  for (const [index, reference] of journal.steps.entries()) {
    const step = inputs.steps[index], before = oracle.scenes[step.before], after = oracle.scenes[step.after];
    const result = family.record(before.observation, after.observation, step.command,
      before.rows, after.rows, step.proposal, step.index, after.public.frame_packet);
    assert.deepEqual(result, reference.expected, 'Compare the complete unchanged common record envelope, without event filtering');
    assert.deepEqual(family.state().events, reference.state.events);
    assert.deepEqual(family.graph.state(), step.state.projection);
    assert.notEqual(family.state().digest, reference.state.digest, 'Unported inherited source layers remain outside the qualified native digest');
    await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }],
      { workflow: 'v6.composition_strategy.choose', step: 'alternating_graph_composition', statement: `acquire.${index}` });
    const authoritative = store.stateValue(ID) as R;
    family = new SharedSeriesConstraint(oracle.policy.recall); family.restoreNative(authoritative);
    assert.deepEqual(family.state(), authoritative);
    assert.deepEqual(family.graph.state(), step.state.projection);
  }
});

for (const entry of oracle.proposalCases.filter((item: R) => item.operation === 'common')) {
  test('shared graph entry matches original common wrapper: ' + entry.id, () => {
    const family = initial(entry.state), before = family.state(), scene = oracle.scenes[entry.scene];
    const invoke = () => family.graphPropose(copy(entry.observation), copy(scene.rows), copy(entry.inputs),
      entry.remaining, copy(entry.config), entry.deadline);
    if (entry.error) assert.throws(invoke, { message: entry.error.message });
    else assert.deepEqual(invoke(), entry.expected);
    assert.deepEqual(family.state(), before, 'A proposal cannot acquire a calibration, control or contact');
  });
}

for (const entry of oracle.bindCases) test('shared binder keeps exact graph payload rule: ' + entry.id, () => {
  const family = initial(null), proposal = copy(entry.proposal), domain = new ObservedInputDomain(256);
  if (entry.error) assert.throws(() => family.bind(proposal, domain), { message: entry.error.message });
  else { family.bind(proposal, domain); assert.deepEqual(proposal, entry.expected); }
});

test('graph reducer changes invalidate native checkpoint reuse, then rollback restores the exact old state', context => {
  const family = initial('static'), trusted = family.nativeState(), original = AlternatingGraphMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(AlternatingGraphMemory.prototype, 'applyEvent', function (this: AlternatingGraphMemory, event: R) {
    replays++; original.call(this, event);
  });
  family.restoreNative(trusted); assert.equal(replays, 0);
  const event = copy(oracle.states.static.projection.graph_events.at(-1));
  event.refused.push('direct-uncommitted-graph-change');
  family.graph.applyEvent(event);
  const inconsistent = family.nativeState();
  assert.throws(() => family.restoreNative(inconsistent), /Shared series memory changed/);
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, oracle.states.static.projection.graph_events.length);
  assert.deepEqual(family.state(), trusted); assert.deepEqual(family.graph.state(), oracle.states.static.projection);
  replays = 0; family.restoreNative(trusted); assert.equal(replays, 0);
});

test('rejected graph journal edits leave all live layers and the certified checkpoint intact', context => {
  const family = initial('validation_departure'), trusted = family.nativeState(), graph = family.graph.state();
  const original = AlternatingGraphMemory.prototype.applyEvent; let replays = 0;
  context.mock.method(AlternatingGraphMemory.prototype, 'applyEvent', function (this: AlternatingGraphMemory, event: R) {
    replays++; original.call(this, event);
  });
  for (const edit of [
    (state: R) => { state.events.at(-1).contacts[0].status = 'unwitnessed_removal'; },
    (state: R) => { state.events.pop(); },
    (state: R) => { state.digest = 'forged'; },
  ]) {
    const invalid = copy(trusted); edit(invalid);
    assert.throws(() => family.restoreNative(invalid));
    assert.deepEqual(family.graph.state(), graph); assert.deepEqual(family.state(), trusted);
    replays = 0; family.restoreNative(trusted); assert.equal(replays, 0);
  }
});

function runtimeFor(state: string) {
  const family = createNativeSharedSeriesFamily(oracle.policy.recall, oracle.policy.coupled, oracle.policy.graph);
  family.restore(initial(state).state());
  let probes = 0;
  const fallback: NativeFamily = { id: 'unrelated-probe-contract',
    propose: () => { probes++; return null; }, before: () => assert.fail('No unrelated action'),
    after: () => assert.fail('No unrelated outcome'), record: () => assert.fail('No unrelated learning'),
    state: () => ({}), restore: value => assert.deepEqual(value, {}) };
  const runtime = new NativeV6Runtime({ sourceDigest: 'alternating-common-live-contract-v36', now: () => 0,
    families: [family, fallback], maxPointOccurrences: 256,
    groups: [{ id: 'goal_access', families: [family.id, family.id],
      entryPoints: ['coupled_support_composition', 'alternating_graph_composition'] },
      { id: 'window_constraints', families: [family.id] }, { id: 'observed_frontier', families: [fallback.id] }],
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration });
  return { runtime, family, probes: () => probes };
}

test('common SRC and WHY/ACT release the graph route and learn all observations only at its sealed boundary', async () => {
  const { runtime, family, probes } = runtimeFor('static'), retained = family.state();
  let result = await runtime.initialize({ sessionId: 'alternating-common-route',
    observation: { ...copy(oracle.scenes['seed:4'].public), step_index: 0 },
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.equal((result.snapshot.proposal as R).kind, 'alternating_graph_access');
  assert.equal((result.snapshot.proposal as R).field_subquestion, 'alternating_graph_composition');
  assert.equal((result.snapshot.proposal as R).strategy_receipt.selected, 'goal_access');
  assert.equal((result.snapshot.caller as R).enabled, true); assert.equal((result.snapshot.whyAct as R).enabled, true);
  assert.deepEqual(family.state(), retained);
  for (let index = 0; index < 3; index++) {
    assert.equal(result.kind, 'action'); assert.ok(result.authorization);
    assert.deepEqual(result.command, oracle.plans.static.actions[index]);
    result = await runtime.advance({ command: result.command!, executionMs: 1,
      observation: { ...copy(oracle.scenes[`static-response:${index}`].public), step_index: index + 1 } as NativePublicObservation }, execution);
    if (index < 2) { assert.equal(result.snapshot.acquiredRecords, 0); assert.deepEqual(family.state(), retained); }
  }
  assert.equal(result.snapshot.actions, 3); assert.equal(result.snapshot.acquiredRecords, 3);
  assert.equal(result.snapshot.cycles, 1); assert.equal((result.snapshot.caller as R).acquiredTransitions, 3);
  assert.equal(probes(), 0);
  const final = family.state() as R, events = final.events.slice((retained.events as R[]).length);
  assert.equal(events.filter((event: R) => event.kind === 'alternating_graph_evidence').length, 3);
  assert.equal(events.filter((event: R) => event.kind === 'coupled_pair_epoch_anchor').length, 1);
  assert.ok(events.findIndex((event: R) => event.kind === 'alternating_graph_evidence')
    < events.findIndex((event: R) => event.kind === 'coupled_pair_epoch_anchor'));
  const graph = runtime.inspectKnowledge();
  const persisted = hydrateNativeState(graph.nodes[ID]!.value, id => graph.nodes[id]?.value);
  assert.deepEqual(persisted, final);
  const restored = new SharedSeriesConstraint(oracle.policy.recall); restored.restore(persisted as R);
  assert.equal(restored.graph.state().graph_terminal.length, 1);
});

test('an unresolved graph contact blocks unrelated probing through the actual common caller', async () => {
  const { runtime, family, probes } = runtimeFor('occlusion'), retained = family.state();
  const result = await runtime.initialize({ sessionId: 'alternating-common-refusal',
    observation: { ...copy(oracle.scenes['instrumental:before'].public), step_index: 0 },
    budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'frontier_abstained');
  assert.equal(result.command, null); assert.equal(result.authorization, null); assert.equal(result.snapshot.actions, 0);
  assert.equal(result.snapshot.acquiredRecords, 0); assert.equal(probes(), 0); assert.deepEqual(family.state(), retained);
});
