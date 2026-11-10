import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureExposedReception, measureLargeExposedReception, measureSmallExposedReception,
  exposedReceptionProjection, exposedReceptionInputCandidates } from '../src/logos-engine/v6-exposed-reception-observation.ts';
import { ExposedReceptionMemory, proposeExposedReception, exposedReceptionBefore, exposedReceptionAfter,
  nominalReceptionStep, pathToReceptions, freshReceptionModels } from '../src/logos-engine/v6-exposed-reception-access.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const file = (path: string): Buffer => readFileSync(new URL(path, root));
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const compressed = (path: string): R => JSON.parse(gunzipSync(file(path)).toString());
const fixture = compressed('tests/fixtures/v6-exposed-reception-parity.json.gz');
const clone = <T>(value: T): T => structuredClone(value);
function seeded(events: R[] = []): ExposedReceptionMemory {
  const memory = new ExposedReceptionMemory();
  for (const event of events) memory.applyEvent(clone(event));
  return memory;
}
function assertState(memory: ExposedReceptionMemory, expected: R): void {
  assert.deepEqual(memory.currentState(), expected.projection);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}

test('exposed reception parity pins unchanged V5/V6 and separates synthetic contracts from game evidence', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.exposed-reception-parity.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  const manifest = JSON.parse(file(`reference/v6/${fixture.sourceCommit}/manifest.json`).toString());
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, descriptor] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(file(`reference/v6/${fixture.sourceCommit}/source/${path}`)), descriptor.sha256, path);
  }
  for (const [path, digest] of Object.entries(fixture.sourceHashes)) assert.equal(manifest.files[path].sha256, digest, path);
  assert.equal(hash(file(fixture.generator)), fixture.generatorSha256);
  assert.equal(hash(file(fixture.policySource)), fixture.policySourceSha256);
  for (const key of ['sourceModified', 'sourceMonkeyPatched', 'gameHostRunByExporter', 'gameSourceRead', 'oracleOrSolutionRead']) {
    assert.equal(fixture.qualification[key], false, key);
  }
  assert.equal(fixture.qualification.physicalActions, 0);
});

for (const item of fixture.cases as R[]) test(`original exposed reception ${item.id}`, () => {
  const a = clone(item.arguments), memory = seeded(item.seedEvents);
  if (item.beforeState) assertState(memory, item.beforeState);
  let actual: unknown;
  switch (item.operation) {
    case 'scene': actual = measureExposedReception(a.rows); break;
    case 'large_scene': actual = measureLargeExposedReception(a.rows); break;
    case 'small_scene': actual = measureSmallExposedReception(a.rows); break;
    case 'projection': actual = exposedReceptionProjection(a.scene); break;
    case 'input_candidates': actual = exposedReceptionInputCandidates(a.rows, a.available, a.inherited); break;
    case 'nominal_step': {
      const visits = { n: 0 };
      actual = { result: nominalReceptionStep(a.scene, a.actor, a.poses, a.delta, a.models, visits), visits: visits.n }; break;
    }
    case 'path_to_receptions': {
      const result = pathToReceptions(a.scene, a.models, a.maxNodes);
      actual = { path: result.path, nodes: result.nodes, visits: result.visits }; break;
    }
    case 'propose': actual = proposeExposedReception(memory, a.obs, a.rows, a.inputs, a.limit, a.config); break;
    case 'record': actual = memory.record(a.before, a.command, a.after, a.rows, a.later, a.proposal, a.index); break;
    default: throw new Error('Unknown exposed-reception operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
  if (item.afterState) assertState(memory, item.afterState);
});

for (const item of fixture.guards as R[]) test(`original exposed reception guard ${item.id}`, () => {
  const a = clone(item.arguments);
  const actual = item.operation === 'before' ? exposedReceptionBefore(a.proposal, a.index, a.rows, a.meta)
    : exposedReceptionAfter(a.proposal, a.index, a.rows, a.later, a.meta);
  assert.deepEqual(actual, item.expected, item.id);
});

function corridor(): R {
  return { size: [7, 5], actor: [1, 2], bodies: [{ pos: [2, 2], color: 3 }], slots: [{ pos: [5, 2], color: 3 }],
    walls: [...Array.from({ length: 7 }, (_, x) => [x, 0]), ...Array.from({ length: 7 }, (_, x) => [x, 4]), [0, 1], [0, 2], [0, 3], [6, 1], [6, 2], [6, 3]] };
}

test('nominal push admits supported chains and keeps blocked remote broadcasts conditional', () => {
  const scene = corridor(), models = freshReceptionModels(), visits = { n: 0 };
  assert.deepEqual(nominalReceptionStep(scene, scene.actor, scene.bodies.map((b: R) => b.pos), [1, 0], models, visits), [[2, 2], [[3, 2]]]);
  assert.equal(visits.n, 4);
  assert.equal(nominalReceptionStep(scene, scene.actor, scene.bodies.map((b: R) => b.pos), [-1, 0], models), null);
  scene.bodies.push({ pos: [5, 1], color: 3 }); models.coupled['3'] = { status: 'observed_same_mode_co_motion_candidate' };
  assert.deepEqual(nominalReceptionStep(scene, scene.actor, scene.bodies.map((b: R) => b.pos), [1, 0], models), [[2, 2], [[3, 2], [5, 1]]]);
});

test('a node-limited search returns only a nonempty strictly improved partial route', () => {
  const scene = corridor(), models = freshReceptionModels();
  const full = pathToReceptions(scene, models, 100);
  assert.deepEqual(full.path.map(([delta]) => delta), [[1, 0], [1, 0], [1, 0]]);
  assert.equal(full.complete, true); assert.equal(full.bounded, false);
  const limited = pathToReceptions(scene, models, 2);
  assert.equal(limited.complete, false); assert.equal(limited.bounded, true);
  assert.equal(limited.stop_reason, 'reception_search_node_bound');
  assert.deepEqual(limited.path.map(([delta]) => delta), [[1, 0]]);
  assert.deepEqual(limited.path.at(-1)![1][1], [[3, 2]]);
  const noImprovement = pathToReceptions(scene, models, 1);
  assert.deepEqual(noImprovement.path, []);
  assert.equal(noImprovement.bounded, true);
});

test('assignment work interruption cannot turn a partial matching domain into a route', () => {
  const scene = corridor();
  scene.size = [20, 10]; scene.walls = [];
  scene.bodies = Array.from({ length: 8 }, (_, i) => ({ pos: [i + 2, 2], color: 3 }));
  scene.slots = Array.from({ length: 8 }, (_, i) => ({ pos: [i + 2, 5], color: 3 }));
  const original = clone(scene);
  const result = pathToReceptions(scene, freshReceptionModels(), 8000, { maximumAssignmentChecks: 8 });
  assert.equal(result.stop_reason, 'reception_assignment_work_bound');
  assert.equal(result.assignment_checks, 8); assert.equal(result.nodes, 0);
  assert.equal(result.bounded, true); assert.equal(result.complete, false); assert.deepEqual(result.path, []);
  assert.deepEqual(scene, original);
});

test('chain, heuristic, body and cell bounds stay incomplete and retain input ownership', () => {
  const scene = corridor(), models = freshReceptionModels(), original = clone({ scene, models });
  const variants = [
    [{ maximumChainVisits: 0 }, 'reception_chain_work_bound'],
    [{ maximumHeuristicChecks: 0 }, 'reception_heuristic_work_bound'],
    [{ maximumBodies: 0 }, 'reception_body_domain_bound'],
    [{ maximumCells: 1 }, 'reception_cell_domain_bound'],
    [{ maximumAssignments: 0 }, 'reception_assignment_count_bound'],
  ] as const;
  for (const [limits, reason] of variants) {
    const result = pathToReceptions(scene, models, 8000, limits);
    assert.equal(result.stop_reason, reason); assert.equal(result.complete, false); assert.equal(result.bounded, true);
    assert.deepEqual(result.path, []);
  }
  assert.deepEqual({ scene, models }, original);
});

test('an expired physical deadline is checked before matching or push work', () => {
  const result = pathToReceptions(corridor(), freshReceptionModels(), 8000, { deadlineMs: 12, now: () => 12 });
  assert.equal(result.stop_reason, 'reception_physical_deadline');
  assert.equal(result.nodes, 0); assert.equal(result.visits, 0); assert.equal(result.assignment_checks, 0);
  assert.equal(result.complete, false); assert.equal(result.bounded, true); assert.deepEqual(result.path, []);
});

test('own event replay detaches caller and export mutations and retains exact history', () => {
  const event: R = { kind: 'observed_exposed_reception', state: { epoch: 0, layout: 'layout', evidence: ['a', 'b'], probed: [], dial_tried: [] },
    controls: { ACTION4: { delta: [1, 0], evidence: ['a', 'b'] } }, models: freshReceptionModels(), detail: { before: 'a', after: 'b' } };
  const memory = new ExposedReceptionMemory(); memory.applyEvent(event);
  const digest = memory.retainedDigest('parent'), state = memory.currentState();
  event.controls.ACTION4.delta[0] = -1; event.state.evidence.push('foreign');
  state.reception_controls.ACTION4.delta[0] = -1; state.reception_events.length = 0;
  state.reception_state!.evidence.push('export mutation');
  assert.equal(memory.retainedDigest('parent'), digest);
  assert.equal(memory.eventCount, 1); assert.equal(memory.nativeRevision, 1);
  const restored = seeded(memory.currentState().reception_events);
  assert.deepEqual(restored.currentState(), memory.currentState()); assert.equal(restored.retainedDigest('parent'), digest);
  assert.throws(() => memory.applyEvent({ kind: 'foreign', state: {}, controls: {}, models: {} }), /Outside exposed reception/);
  assert.throws(() => memory.applyEvent({ kind: 'observed_exposed_reception', state: {} }), /lacks/);
  assert.equal(memory.nativeRevision, 1);
});

test('an interrupted push search retains only an already ranked improvement', () => {
  const result = pathToReceptions(corridor(), freshReceptionModels(), 8000, { maximumChainVisits: 20 });
  assert.equal(result.stop_reason, 'reception_chain_work_bound');
  assert.equal(result.visits, 20); assert.equal(result.complete, false); assert.equal(result.bounded, true);
  assert.deepEqual(result.path.map(([delta]) => delta), [[1, 0]]);
  assert.deepEqual(result.path.at(-1)![1], [[2, 2], [[3, 2]]]);
});

test('an uncompleted assignment search cannot fall through into an untested physical probe', () => {
  const item = fixture.cases.find((value: R) => value.id === 'propose:small_unmeasured_controls');
  assert.equal(item.expected.exposed_reception_plan.kind, 'control_question');
  const a = clone(item.arguments), memory = seeded(item.seedEvents), original = memory.currentState();
  a.config.native_reception_work_budget = { maximumAssignmentChecks: 0 };
  const proposal = memory.propose(a.obs, a.rows, a.inputs, a.limit, a.config)!;
  assert.equal(proposal.status, 'unknown'); assert.equal(proposal.block_unrelated_probe, true);
  assert.equal(proposal.reason, 'reception_computation_incomplete');
  assert.equal(proposal.native_reception_work_budget.reason, 'reception_assignment_work_bound');
  assert.equal(Object.hasOwn(proposal, 'actions'), false);
  assert.deepEqual(memory.currentState(), original);
});
