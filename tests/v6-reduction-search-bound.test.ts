import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import {
  ReductionTransport, boundedReductionRoute, boundedReductionRouteCooperative,
  reductionLayout, reductionScan, reductionState, mergeReductionScene,
} from '../src/logos-engine/v6-reduction-transport.ts';
import type { ReductionPoint, ReductionScene } from '../src/logos-engine/v6-reduction-transport.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const reference = JSON.parse(gunzipSync(read('tests/fixtures/v6-reduction-transport-reference.json.gz')).toString());
const bounds = Object.freeze({ maximumStates: 8192, maximumFrontier: 16384 });
const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
function scene(value: any): ReductionScene {
  return { floor: new Set(value.floor.map(key)), pegs: new Set(value.pegs.map(key)),
    rails: new Set(value.rails.map(key)), carriers: structuredClone(value.carriers),
    edges: new Set(value.edges.map(([a, b]: ReductionPoint[]) => `${key(a)}>${key(b)}`)),
    ...(value.known_cells ? { known_cells: new Set<string>(value.known_cells.map(key)) } : {}) };
}

for (const item of reference.mechanics) test(`bounded source mechanics retain the independent Python route: ${item.name}`, async () => {
  const currentScene = scene(item.scene), current = reductionState(currentScene);
  const result = boundedReductionRoute(current, currentScene, item.limit, bounds, item.reveal);
  assert.equal(result.status, item.route === null ? 'exhausted' : 'found');
  assert.deepEqual(result.path, item.route);
  assert.equal(result.bound, null); assert.equal(result.blockedInsertion, null);
  assert.ok(result.counters.retainedStates <= bounds.maximumStates);
  assert.ok(result.counters.peakFrontierEntries <= bounds.maximumFrontier);
  const cooperative = await boundedReductionRouteCooperative(current, currentScene, item.limit, bounds, item.reveal,
    { yieldControl: async () => {}, now: () => 0, deadlineMs: 1 });
  assert.deepEqual(cooperative, result, 'cooperation preserves the entire deterministic search result');
});

for (const item of reference.geometry) test(`bounded source public geometry retains the independent Python route: ${item.name}`, () => {
  const model = reductionLayout(item.observation, item.rows); assert.deepEqual(model, item.model);
  if (!model) return;
  const merged = mergeReductionScene(null, reductionScan(item.rows, model), model, [0, 0]);
  const result = boundedReductionRoute(reductionState(merged), merged, 16, bounds);
  assert.equal(result.status, item.path === null ? 'exhausted' : 'found');
  assert.deepEqual(result.path, item.path); assert.equal(result.bound, null);
});

test('invalid resource profiles are rejected before any search', () => {
  const empty: ReductionScene = { floor: new Set(), pegs: new Set(), carriers: [], rails: new Set(), edges: new Set() };
  for (const configured of [
    { maximumStates: 0, maximumFrontier: 1 }, { maximumStates: 1, maximumFrontier: 0 },
    { maximumStates: 1.5, maximumFrontier: 2 }, { maximumStates: 1, maximumFrontier: Infinity },
  ]) {
    assert.throws(() => new ReductionTransport({ boundedSearch: configured }), /positive exact integers/);
    assert.throws(() => boundedReductionRoute(reductionState(empty), empty, 10, configured), /positive exact integers/);
  }
});

test('the state limit stops before retaining the next state or returning a partial route', () => {
  const item = reference.mechanics.find((value: any) => value.name === 'two_reductions'), currentScene = scene(item.scene);
  const result = boundedReductionRoute(reductionState(currentScene), currentScene, item.limit, { maximumStates: 2, maximumFrontier: 20 });
  assert.equal(result.status, 'resource_bound'); assert.equal(result.bound, 'maximum_states');
  assert.equal(result.path, null);
  assert.equal(result.counters.retainedStates, 2); assert.equal(result.counters.insertedEntries, 2);
  assert.equal(result.blockedInsertion!.newState, true); assert.equal(result.blockedInsertion!.requiredStates, 3);
  assert.equal(result.counters.frontierEntries, result.blockedInsertion!.requiredFrontierEntries - 1);
});

test('the frontier limit counts real heap entries and refuses the insertion before allocation', () => {
  const branching: ReductionScene = { floor: new Set(['0,0', '1,0', '2,0', '3,0', '4,0']),
    pegs: new Set(['0,0', '1,0', '3,0', '4,0']), carriers: [], rails: new Set(), edges: new Set() };
  const result = boundedReductionRoute(reductionState(branching), branching, 10, { maximumStates: 100, maximumFrontier: 1 });
  assert.equal(result.status, 'resource_bound'); assert.equal(result.bound, 'maximum_frontier'); assert.equal(result.path, null);
  assert.equal(result.counters.frontierEntries, 1); assert.equal(result.counters.peakFrontierEntries, 1);
  assert.equal(result.counters.retainedStates, 2); assert.equal(result.counters.insertedEntries, 2);
  assert.deepEqual(result.blockedInsertion, { newState: true, requiredStates: 3, requiredFrontierEntries: 2, cost: 2 });
});

test('found, exhausted under the primitive horizon, and resource bound are distinct', () => {
  const item = reference.mechanics.find((value: any) => value.name === 'one_jump'), currentScene = scene(item.scene);
  const start = reductionState(currentScene);
  const found = boundedReductionRoute(start, currentScene, 2, { maximumStates: 2, maximumFrontier: 1 });
  const exhausted = boundedReductionRoute(start, currentScene, 1, { maximumStates: 2, maximumFrontier: 1 });
  const unknown = boundedReductionRoute(start, currentScene, 2, { maximumStates: 1, maximumFrontier: 1 });
  assert.deepEqual(found.path, item.route); assert.equal(found.status, 'found');
  assert.equal(exhausted.status, 'exhausted'); assert.equal(exhausted.path, null); assert.equal(exhausted.bound, null);
  assert.equal(unknown.status, 'resource_bound'); assert.equal(unknown.path, null); assert.equal(unknown.bound, 'maximum_states');
  assert.equal(unknown.counters.retainedStates, 1);
});

const diagnosticDirectory = 'docs/migration/native-campaigns-v52/diagnostic-memory/';
const original = JSON.parse(read(`${diagnosticDirectory}reduction-scene-original.json`).toString());
const publicJournal = gunzipSync(read(`${diagnosticDirectory}actual-public-journal.jsonl.gz`)).toString().trim().split('\n').map(line => JSON.parse(line));
const packet = publicJournal[16]!.packet;
const observation = await measureNativeObservation(packet, 17, 'bounded-reduction-public-contract');
const inputs = new ObservedInputDomain(4096).candidates(observation);

test('actual seventeenth public packet reaches a resource bound with no command, no reveal and no impossible claim', async () => {
  assert.equal(original.sourceModified, false); assert.equal(original.routeCalls, 0); assert.equal(original.proposeCalls, 0);
  assert.equal(original.nativeResultsUsedAsExpectations, false);
  const model = reductionLayout(observation, packet.frame_rows); assert.deepEqual(model, original.model); assert.ok(model);
  const measured = reductionScan(packet.frame_rows, model);
  assert.deepEqual({ pegs: measured.pegs.size, floor: measured.floor.size, carriers: measured.carriers.length,
    rails: measured.rails.size, edges: measured.edges.size }, { pegs: 109, floor: 114, carriers: 0, rails: 0, edges: 0 });
  assert.equal(model.floor, model.token, 'equal measured values do not establish impossibility');
  const family = new ReductionTransport({ boundedSearch: bounds });
  let yields = 0;
  const proposal = await family.propose(observation, packet.frame_rows, inputs, 120, {
    yieldControl: async () => { yields++; await new Promise<void>(resolve => setImmediate(resolve)); },
    now: () => 0, deadlineMs: 1,
  });
  assert.equal(proposal, null); assert.ok(yields > 0);
  const refusal = family.currentProposalRefusal(observation); assert.ok(refusal);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.search_status, 'resource_bound');
  assert.equal(refusal.rule, 'native.bounded_reduction_search'); assert.equal(refusal.provider, family.familyId);
  assert.equal(refusal.release_authority, false); assert.equal(refusal.reached_bound, 'maximum_states');
  assert.equal(refusal.search_phase, 'goal'); assert.equal(refusal.searches_started, 1); assert.deepEqual(refusal.completed_searches, []);
  assert.deepEqual(refusal.bounds, bounds); assert.deepEqual(refusal.model, original.model);
  // These are native limit receipts, not a claim that the unsafe unbounded
  // original completed this view. Exact counts make an over-limit insertion visible.
  assert.deepEqual(refusal.counters, { retainedStates: 8192, frontierEntries: 7119, peakFrontierEntries: 7119,
    insertedEntries: 8192, poppedEntries: 1073, staleEntries: 0, expandedStates: 1073, generatedTransitions: 17732 });
  assert.deepEqual(refusal.blocked_insertion, { newState: true, requiredStates: 8193, requiredFrontierEntries: 7120, cost: 10 });
  assert.equal(family.scene, null, 'the incomplete search does not commit its staged scene');
  assert.equal(family.retired, false); assert.deepEqual(family.events, []); assert.deepEqual(family.refs, {});
  assert.equal(family.epoch, observation.level_epoch); assert.deepEqual(family.model, model, 'source scope initialization is retained');
  assert.match(refusal.state_ref, /^reduction_state:[0-9a-f]{64}$/);
  assert.match(refusal.scene_ref, /^reduction_scene:[0-9a-f]{64}$/);
  const detached = family.currentProposalRefusal(observation)!; detached.counters.retainedStates = -1;
  assert.deepEqual(family.currentProposalRefusal(observation), refusal);
  for (const [field, value] of [['observation_ref', 'other'], ['frame_hash', 'other'], ['level_epoch', -1]] as const) {
    assert.equal(family.currentProposalRefusal({ ...observation, [field]: value }), null);
  }
  family.retired = true;
  assert.equal(family.currentProposalRefusal(observation), null, 'a changed owner state invalidates the diagnostic witness');
});

test('bounded and cooperative routes keep identical ordering after actual cooperative yields', async () => {
  const currentScene = scene(original.scene), current = reductionState(currentScene);
  const smaller = { maximumStates: 512, maximumFrontier: 1024 };
  const synchronous = boundedReductionRoute(current, currentScene, 120, smaller);
  let yields = 0;
  const cooperative = await boundedReductionRouteCooperative(current, currentScene, 120, smaller, false,
    { yieldControl: async () => { yields++; }, now: () => 0, deadlineMs: 1 });
  assert.ok(yields > 0); assert.deepEqual(cooperative, synchronous);
});

test('cancellation and retry preserve acquired memory and do not commit a staged search scene', async () => {
  const family = new ReductionTransport({ boundedSearch: { maximumStates: 512, maximumFrontier: 1024 } });
  // A zero-horizon complete calculation records only the current public scene.
  assert.equal(await family.propose(observation, packet.frame_rows, inputs, 0), null);
  assert.ok(family.scene); assert.equal(family.currentProposalRefusal(observation), null);
  const saved = family.state(), controller = new AbortController(); let yields = 0;
  await assert.rejects(async () => family.propose(observation, packet.frame_rows, inputs, 120, {
    signal: controller.signal, yieldControl: async () => { yields++; controller.abort(); }, now: () => 0, deadlineMs: 1,
  }), { name: 'AbortError' });
  assert.ok(yields > 0); assert.deepEqual(family.state(), saved); assert.equal(family.currentProposalRefusal(observation), null);
  assert.equal(await family.propose(observation, packet.frame_rows, inputs, 120), null);
  const refusal = family.currentProposalRefusal(observation); assert.ok(refusal);
  assert.equal(refusal.reached_bound, 'maximum_states'); assert.equal(refusal.counters.retainedStates, 512);
  assert.equal(refusal.searches_started, 1); assert.deepEqual(family.state(), saved);
  family.restore(saved); assert.deepEqual(family.state(), saved); assert.equal(family.currentProposalRefusal(observation), null);
  assert.equal(await family.propose(observation, packet.frame_rows, inputs, 120), null);
  assert.deepEqual(family.currentProposalRefusal(observation), refusal, 'restored source state gives the same bounded refusal');
});

test('an already cancelled request has no source state mutation', async () => {
  const family = new ReductionTransport({ boundedSearch: bounds }), before = family.state(), controller = new AbortController(); controller.abort();
  await assert.rejects(async () => family.propose(observation, packet.frame_rows, inputs, 120,
    { signal: controller.signal, yieldControl: async () => {} }), { name: 'AbortError' });
  assert.deepEqual(family.state(), before); assert.equal(family.currentProposalRefusal(observation), null);
});

test('deadline uses the supplied monotonic clock and remains an unknown resource result', async () => {
  const currentScene = scene(original.scene), current = reductionState(currentScene);
  const expired = await boundedReductionRouteCooperative(current, currentScene, 120, bounds, false,
    { yieldControl: async () => {}, now: () => 10, deadlineMs: 10 });
  assert.equal(expired.status, 'resource_bound'); assert.equal(expired.bound, 'deadline'); assert.equal(expired.path, null);
  assert.equal(expired.counters.insertedEntries, 0); assert.equal(expired.counters.retainedStates, 0);
  const simple = scene(reference.mechanics.find((value: any) => value.name === 'one_jump').scene);
  const active = await boundedReductionRouteCooperative(reductionState(simple), simple, 2, bounds, false,
    { yieldControl: async () => {}, deadlineMs: performance.now() + 30_000 });
  assert.equal(active.status, 'found', 'default clock uses performance time, not an epoch timestamp');
});
