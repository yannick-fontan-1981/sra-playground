import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { digest } from '../src/logos-engine/canonical.ts';
import { ObservedFrontier, closedReturnContrast, frontierIndex } from '../src/logos-engine/v6-observed-frontier.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-frontier-reference.json', import.meta.url), 'utf8'));
const native = (target = 3, maximum = 16, state: R | null = null) => new ObservedFrontier(target, maximum, state, { nativeOwned: true });
const action = { action_ref: 'ACTION1' };
function observation(index: number, epoch = 1): NativeObservation {
  return { revision: index, level_epoch: epoch, frame_hash: `synthetic-frame-${index}`,
    observation_ref: `synthetic-observation-${epoch}-${index}`, state: 'NOT_FINISHED', levels_completed: epoch - 1,
    available_action_refs: ['ACTION1', 'ACTION2'], coordinate_basis: 'screen', entities: [], unknowns: [],
    provenance: 'declared synthetic public observation for frontier state contracts' };
}
async function operation(graph: ObservedFrontier, row: R, saved: Map<string, any>): Promise<any> {
  const a = structuredClone(row.args), kw = structuredClone(row.kwargs);
  switch (row.operation) {
    case 'observe': return graph.observe(a[0], a[1]);
    case 'propose': return graph.propose(a[0], a[1], kw);
    case 'record_transition': return graph.recordTransition(a[0], a[1], a[2], kw);
    case 'guard_saved': return graph.guard(saved.get(a[0]), a[1], a[2]);
    case 'outcome_saved': return graph.checkOutcome(saved.get(a[0]), a[1], a[2]);
    case 'check_outcome': return graph.checkOutcome(a[0], a[1], a[2]);
    case 'can_probe_here': return graph.canProbeHere(a[0], a[1]);
    case 'set_rules': graph.rules = a[0]; return null;
    case 'increment_revision': graph.knowledge_revision++; return null;
    case 'bind_current_candidate_context': graph.bindCurrentCandidateContext(a[0], a[1]); return null;
    case 'return_contrast': return closedReturnContrast(graph, a[0], a[1], a[2]);
    case 'propose_return': return graph.propose(a[0], a[1], { return_episode: a[2] });
    default: throw new Error('Unknown source fixture operation ' + row.operation);
  }
}

for (const scenario of fixture.scenarios as R[]) test('native immutable frontier preserves source sequence, deltas and restoration: ' + scenario.id, async () => {
  const ordinary = new ObservedFrontier(scenario.target, scenario.maximum), owned = native(scenario.target, scenario.maximum);
  const replay = native(scenario.target, scenario.maximum), sourceSaved = new Map<string, any>(), nativeSaved = new Map<string, any>();
  for (const [index, row] of (scenario.steps as R[]).entries()) {
    const label = `${scenario.id} ${index} ${row.operation}`;
    if (row.error) {
      await assert.rejects(() => operation(ordinary, row, sourceSaved), (error: any) => error.message === row.error, label);
      await assert.rejects(() => operation(owned, row, nativeSaved), (error: any) => error.message === row.error, label);
    } else {
      const expected = await operation(ordinary, row, sourceSaved), actual = await operation(owned, row, nativeSaved);
      assert.deepEqual(actual ?? null, row.expected, label + ' unchanged Python result');
      assert.deepEqual(actual, expected, label + ' ordinary TypeScript result');
      if (row.save) { sourceSaved.set(row.save, structuredClone(expected)); nativeSaved.set(row.save, structuredClone(actual)); }
    }
    const events = owned.drainDeltas();
    assert.deepEqual(events, ordinary.drainDeltas(), label + ' exact ordered hashes');
    assert.deepEqual(events, row.deltas, label + ' unchanged Python deltas');
    assert.deepEqual(owned.nativeSnapshot(), row.state, label + ' immutable snapshot');
    assert.deepEqual(owned.snapshot(), ordinary.snapshot(), label + ' public snapshot');
    if (row.operation === 'set_rules') replay.rules = structuredClone(row.args[0]);
    if (row.operation === 'increment_revision') replay.knowledge_revision++;
    for (const event of events) await replay.applyDelta(event);
    assert.deepEqual(replay.nativeSnapshot(), owned.nativeSnapshot(), label + ' replay');
    assert.deepEqual(native(3, 16, owned.nativeSnapshot()).nativeSnapshot(), owned.nativeSnapshot(), label + ' full restoration');
  }
});

test('empty native snapshots are stable and immutable, while public snapshots remain detached and mutable', () => {
  const owned = native(), first = owned.nativeSnapshot();
  assert.equal(owned.nativeSnapshot(), first);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.nodes));
  assert.throws(() => { first.nodes.foreign = {}; }, TypeError);
  const publicCopy = owned.snapshot(); publicCopy.nodes.foreign = { arbitrary: true }; publicCopy.max_prefix = 2;
  assert.deepEqual(owned.nativeSnapshot(), new ObservedFrontier().snapshot());
  const ordinary = new ObservedFrontier(); ordinary.nodes.external = { value: 1 };
  const ordinaryNative = ordinary.nativeSnapshot(); ordinary.nodes.external.value = 2;
  assert.equal(ordinaryNative.nodes.external.value, 1);
  assert.equal(ordinary.snapshot().nodes.external.value, 2, 'Default source object mutability remains unchanged');
});

test('native frontier changes only affected records and preserves older snapshots and cross-epoch facts', async () => {
  const graph = native(), firstObservation = observation(0), secondObservation = observation(1);
  await graph.observe(firstObservation, [action]); const first = graph.nativeSnapshot(), firstKey = await frontierIndex(firstObservation);
  await graph.observe(secondObservation, [action]); const second = graph.nativeSnapshot(), secondKey = await frontierIndex(secondObservation);
  assert.notEqual(second.nodes, first.nodes);
  assert.equal(second.nodes[firstKey], first.nodes[firstKey]);
  assert.equal(second.observations[firstObservation.observation_ref], first.observations[firstObservation.observation_ref]);
  await graph.recordTransition(firstObservation, action, secondObservation);
  const third = graph.nativeSnapshot();
  assert.notEqual(third.nodes[firstKey], second.nodes[firstKey]);
  assert.equal(third.nodes[secondKey], second.nodes[secondKey]);
  assert.equal(third.nodes[firstKey].protocol, second.nodes[firstKey].protocol);
  assert.equal(third.nodes[firstKey].actions, second.nodes[firstKey].actions);
  assert.equal(third.nodes[firstKey].occurrences, second.nodes[firstKey].occurrences);
  assert.deepEqual(second.nodes[firstKey].attempts, {});
  assert.equal(Object.keys(second.edges).length, 0);
  assert.equal((await graph.recordTransition(firstObservation, action, secondObservation)).status, 'duplicate_transition_not_counted');
  assert.equal(graph.nativeSnapshot(), third);
  const newOccurrence = { ...firstObservation, observation_ref: 'synthetic-new-occurrence-at-same-protocol' };
  await graph.observe(newOccurrence);
  const fourth = graph.nativeSnapshot();
  assert.equal(fourth.nodes[firstKey].attempts, third.nodes[firstKey].attempts);
  assert.notEqual(fourth.nodes[firstKey].occurrences, third.nodes[firstKey].occurrences);
  await graph.observe(observation(2, 2), [action]);
  const nextEpoch = graph.nativeSnapshot();
  assert.equal(nextEpoch.nodes[firstKey], fourth.nodes[firstKey]);
  assert.equal(nextEpoch.edges, fourth.edges, 'Old transition evidence is retained, not discarded at a boundary');
  graph.max_prefix = 2;
  const shorter = graph.nativeSnapshot();
  assert.notEqual(shorter, nextEpoch); assert.equal(shorter.max_prefix, 2); assert.equal(nextEpoch.max_prefix, 16);
  assert.equal(shorter.nodes, nextEpoch.nodes); assert.equal(shorter.chain, nextEpoch.chain);
});

test('native restore shares owned branches but the next valid delta preserves the checkpoint and exact source values', async () => {
  const original = native(); await original.observe(observation(0), [action]);
  const checkpoint = original.nativeSnapshot(), restored = native(3, 16, checkpoint), ordinary = new ObservedFrontier(3, 16, checkpoint);
  assert.equal(restored.nativeSnapshot().nodes, checkpoint.nodes);
  await restored.observe(observation(1), [action]); await ordinary.observe(observation(1), [action]);
  assert.deepEqual(restored.nativeSnapshot(), ordinary.snapshot());
  assert.deepEqual(restored.drainDeltas(), ordinary.drainDeltas());
  assert.equal(Object.keys(checkpoint.nodes).length, 1);
  assert.equal(Object.keys(restored.nodes).length, 2);
});

async function signed(graph: ObservedFrontier, kind: string, payload: R): Promise<R> {
  const value = { schema: 'prototype.observed_frontier.v1', sequence: graph.sequence + 1,
    previous_digest: graph.chain, kind, payload };
  return { ...value, digest: await digest(value) };
}

test('invalid native deltas cannot publish partial records, counters, chain or cached snapshots', async () => {
  const graph = native(); await graph.observe(observation(0), [action]); await graph.observe(observation(1), [action]);
  const current = graph.nativeSnapshot(), retainedEvents = graph.drainDeltas();
  const key = await frontierIndex(observation(0));
  const malformedTransition = { source: key, target: await frontierIndex(observation(1)), action, action_key: 'opaque-action',
    transition_ref: 'synthetic-transition', edge_id: 'synthetic-edge', assessment: {}, navigation_trial: null, proposal_id: null };
  for (const event of [
    { ...retainedEvents[0], digest: 'tampered' }, retainedEvents[0],
    await signed(graph, 'unknown', {}),
    await signed(graph, 'domain', { index: 'missing', actions: [action] }),
    await signed(graph, 'transition', malformedTransition),
  ]) {
    await assert.rejects(graph.applyDelta(event));
    assert.equal(graph.nativeSnapshot(), current);
    assert.deepEqual(graph.snapshot(), current);
    assert.deepEqual(graph.drainDeltas(), []);
  }
});

test('native event ingress is detached before hashing and external shallow freezes never authorize cached reuse', async () => {
  const producer = new ObservedFrontier(); await producer.observe(observation(0), [action]);
  const event = producer.drainDeltas()[0]!, graph = native(), pending = graph.applyDelta(event);
  event.payload.protocol.frame_hash = 'mutated-after-call';
  await pending;
  assert.deepEqual(graph.nativeSnapshot(), producer.snapshot());
  const external = { rule_id: 'synthetic-rule', status: 'candidate', scope_epochs: [1], counterexample_count: 0 };
  graph.rules = Object.freeze({ 'synthetic-rule': external });
  const first = graph.nativeSnapshot();
  external.status = 'refuted'; external.scope_epochs.push(2);
  assert.equal(graph.nativeSnapshot(), first);
  assert.equal(first.rules['synthetic-rule'].status, 'candidate');
  assert.deepEqual(first.rules['synthetic-rule'].scope_epochs, [1]);
  assert.throws(() => { graph.rules['synthetic-rule'].status = 'changed'; }, TypeError);
  graph.rules = { ...graph.rules, other: { status: 'unknown' } };
  assert.notEqual(graph.nativeSnapshot(), first);
  assert.equal(graph.nativeSnapshot().rules.other.status, 'unknown');
});

test('caller checkpoints use native frontier ownership while restoration and boundary replay retain authoritative values', async () => {
  const memory = new NativeReasoningMemory({ clock: () => 0 }), domain = new ObservedInputDomain(32);
  const caller = new NativeCallerCoordinator(memory, { targetLevels: 3, domain, strategy: {}, informationGoal: 'open_questions' });
  await caller.initialize(observation(0));
  const nativeBefore = caller.frontier.nativeSnapshot();
  assert.equal(caller.checkpointWrites().find(write => write.id === 'caller:frontier')!.value, nativeBefore);
  const publicBefore = caller.state(); publicBefore.frontier.nodes.extra = { arbitrary: true };
  assert.equal(caller.frontier.nativeSnapshot(), nativeBefore);
  const store = new NativeKnowledgeStore('native-frontier-checkpoint', 'synthetic');
  await store.commit(caller.checkpointWrites(), { workflow: 'synthetic', step: 'checkpoint', statement: 'retain' });
  caller.restoreFrom(store);
  assert.deepEqual(caller.frontier.nativeSnapshot(), nativeBefore);
  caller.prepare(observation(0), 3);
  assert.equal(caller.frontier.nativeSnapshot().max_prefix, 3);
  const replay = await caller.replayBoundary(observation(1, 2));
  assert.equal(replay.replayed_frontier_deltas, nativeBefore.sequence);
  assert.equal(replay.replayed_goal_events, 0);
  assert.equal(caller.frontier.max_prefix, 16);
  assert.ok(Object.isFrozen(caller.frontier.nodes));
  assert.equal(Object.keys(caller.frontier.nodes).length, 2);
  assert.equal(Object.keys(nativeBefore.nodes).length, 1);
});
