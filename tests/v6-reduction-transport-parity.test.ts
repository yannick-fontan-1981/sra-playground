import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  ReductionTransport, REDUCTION_VECTORS, reductionLayout, reductionScan, reductionState, packReductionState,
  reductionMoved, reductionSuccessors, reductionRoute, translatedReductionScene, reductionVisibleCells,
  mergeReductionScene, alignReductionScene,
} from '../src/logos-engine/v6-reduction-transport.ts';
import type { ReductionPoint, ReductionScene } from '../src/logos-engine/v6-reduction-transport.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const fixture = (path: string) => JSON.parse(gunzipSync(read(path)).toString());
const tracePath = 'tests/fixtures/v6-reduction-transport-lf52-original-public.json.gz';
const trace = fixture(tracePath), reference = fixture('tests/fixtures/v6-reduction-transport-reference.json.gz');
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const pointKey = (p: readonly number[]) => `${p[0]},${p[1]}`;
const numericPoint = (s: string): ReductionPoint => s.split(',').map(Number) as ReductionPoint;
const compare = (a: readonly number[], b: readonly number[]) => a[0]! - b[0]! || a[1]! - b[1]!;
const list = (values: Set<string>) => [...values].map(numericPoint).sort(compare);
function packedScene(s: ReductionScene | null): any {
  if (s === null) return null;
  return { floor: list(s.floor), pegs: list(s.pegs), rails: list(s.rails), carriers: structuredClone(s.carriers),
    edges: [...s.edges].map(e => e.split('>').map(numericPoint)).sort((a, b) => compare(a[0]!, b[0]!) || compare(a[1]!, b[1]!)),
    ...(s.known_cells ? { known_cells: list(s.known_cells) } : {}) };
}
function unpackedScene(s: any): ReductionScene {
  return { floor: new Set(s.floor.map(pointKey)), pegs: new Set(s.pegs.map(pointKey)), rails: new Set(s.rails.map(pointKey)),
    carriers: structuredClone(s.carriers), edges: new Set(s.edges.map(([a, b]: ReductionPoint[]) => `${pointKey(a!)}>${pointKey(b!)}`)),
    ...(s.known_cells ? { known_cells: new Set<string>(s.known_cells.map(pointKey)) } : {}) };
}
function sourceState(s: any): any {
  const value = structuredClone(s); delete value.format;
  // Python stores tested as a set of immutable states. JSON has no set order.
  if (value.tested) value.tested.sort((a: any, b: any) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0);
  return value;
}
const restored = (snapshot: any): ReductionTransport => {
  const family = new ReductionTransport(); family.restore({ ...structuredClone(snapshot), format: 'native.reduction_transport.v1' }); return family;
};

test('reduction source fixtures retain pinned source and public-only generator identity', () => {
  assert.equal(trace.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(trace.sourceModified, false); assert.equal(trace.manualPrimingActions, 0); assert.equal(trace.sessionCount, 1);
  assert.equal(trace.status, 'passed'); assert.equal(trace.levelsCompleted, 3); assert.equal(trace.actions, 102);
  assert.equal(trace.prefixes.length, 69); assert.equal(trace.packets.length, 103);
  assert.deepEqual(trace.boundaries.map((b: any) => b.levelActions), [8, 40, 54]);
  for (const proof of [trace, reference]) {
    assert.equal(hash(read(proof.generator)), proof.generatorSha256);
    for (const [path, sha256] of Object.entries(proof.sourceHashes)) assert.equal(hash(read(`reference/v6/${proof.sourceCommit}/source/${path}`)), sha256, path);
  }
  assert.equal(reference.publicTraceSha256, hash(read(tracePath)));
});

test('69 complete original proposals and all 102 acquired public returns remain exact', async t => {
  const family = new ReductionTransport(), domain = new ObservedInputDomain(4096);
  let action = 0, levelStart = 0;
  assert.deepEqual(sourceState(family.state()), trace.initialState);
  for (const [cycle, prefix] of trace.prefixes.entries()) await t.test(`source prefix ${cycle + 1}`, () => {
    const current = trace.packets[action], observation = current.observation;
    const proposal = family.propose(observation, current.packet.frame_rows, domain.candidates(observation), trace.budget.levelActions - (action - levelStart));
    assert.ok(proposal); family.bind(proposal, domain);
    assert.deepEqual(proposal, prefix.proposal);
    assert.deepEqual(sourceState(family.state()), sourceState(prefix.beforeState));
    for (const step of prefix.steps) {
      const before = trace.packets[action], after = trace.packets[++action];
      assert.deepEqual(family.before(proposal, step.index, before.packet, before.observation), step.beforeGuard);
      assert.deepEqual(family.after(proposal, step.index, before.observation, after.observation, before.packet.frame_rows, after.packet.frame_rows), step.outcome);
      assert.deepEqual(family.record(before.observation, after.observation, step.command, before.packet.frame_rows, after.packet.frame_rows, proposal, step.index, after.packet.frame_packet), step.acquired);
      assert.deepEqual(sourceState(family.state()), sourceState(step.afterState));
      assert.deepEqual(sourceState(restored(step.afterState).state()), sourceState(step.afterState));
      if (after.observation.levels_completed > before.observation.levels_completed) levelStart = action;
    }
  });
  assert.equal(action, trace.actions); assert.deepEqual(sourceState(family.state()), sourceState(trace.finalState));
});

for (const item of reference.geometry) test(`source geometry and camera registration: ${item.name}`, () => {
  const model = reductionLayout(item.observation, item.rows); assert.deepEqual(model, item.model);
  if (!model) return;
  const local = reductionScan(item.rows, model), merged = mergeReductionScene(null, local, model, [0, 0]);
  assert.deepEqual(packedScene(local), item.scene);
  assert.deepEqual(packedScene(merged), item.merged);
  assert.deepEqual(list(reductionVisibleCells(model, [0, 0])), item.visible);
  assert.deepEqual(packedScene(translatedReductionScene(local, [-2, 3])), item.translated);
  assert.deepEqual(reductionRoute(reductionState(merged), merged, 16), item.path);
  const alignment = alignReductionScene(item.rows, item.observation, model, merged, [0, 0]);
  assert.deepEqual(alignment ? [alignment[0], alignment[1], packedScene(alignment[2])] : null, item.aligned);
});

for (const item of reference.mechanics) test(`finite source support mechanics: ${item.name}`, () => {
  const scene = unpackedScene(item.scene), current = reductionState(scene);
  assert.deepEqual(packReductionState(current), item.current);
  assert.deepEqual(reductionRoute(current, scene, item.limit, item.reveal), item.route);
  assert.deepEqual(REDUCTION_VECTORS.map(vector => packReductionState(reductionMoved(current, vector, scene.edges))), item.moved);
  assert.deepEqual([...reductionSuccessors(current, scene)].map(([state, action, cost]) => [packReductionState(state), action, cost]), item.successors);
});

for (const item of reference.guards) test(`source dispatch guard: ${item.name}`, () => {
  const family = restored(item.snapshot);
  assert.deepEqual(family.before(item.proposal, item.index, item.public, item.observation), item.result);
});
for (const item of reference.outcomes) test(`source physical outcome: ${item.name}`, () => {
  const family = restored(item.snapshot);
  assert.deepEqual(family.after(item.proposal, item.index, item.before, item.after, item.first, item.second), item.result);
});

test('missing current point action abstains without creating epoch evidence', () => {
  const family = new ReductionTransport(), first = trace.packets[0], before = family.state();
  assert.equal(family.propose({ ...first.observation, available_action_refs: ['ACTION1'] }, first.packet.frame_rows, [{ action_ref: 'ACTION1', data: {} }], 120), null);
  assert.deepEqual(family.state(), before);
});

test('repeated population is necessary and earlier failed hypotheses do not authorize a new epoch', () => {
  const absent = reference.geometry.find((item: any) => item.name === 'no_repeated_population');
  const family = new ReductionTransport(), domain = new ObservedInputDomain(4096);
  assert.equal(family.propose(absent.observation, absent.rows, domain.candidates(absent.observation), 120), null);
  assert.equal(family.state().model, null);
  const first = trace.packets[0]; family.retired = true;
  assert.equal(family.propose(first.observation, first.packet.frame_rows, domain.candidates(first.observation), 120), null);
  const fresh = { ...first.observation, level_epoch: first.observation.level_epoch + 1 };
  assert.ok(family.propose(fresh, first.packet.frame_rows, domain.candidates(fresh), 120));
});

test('retained projection is detached and restore validates before replacing evidence', () => {
  const family = restored(trace.finalState), before = family.state(), view = family.state();
  view.events[0].status = 'tampered'; view.passed[0].score = 999; view.offset[0] = 999;
  view.scene.floor[0][0] = 999; view.motion.arbitrary = [0, 0];
  assert.deepEqual(family.state(), before);
  for (const mutate of [
    (value: any) => { value.model.pitch = 0; },
    (value: any) => { value.offset = [0]; },
    (value: any) => { value.scene.edges = [[0, 0]]; },
    (value: any) => { value.tested = [['ACTION1', []]]; },
    (value: any) => { value.verified = [42]; },
  ]) {
    const changed = structuredClone(before); mutate(changed);
    assert.throws(() => family.restore(changed), TypeError); assert.deepEqual(family.state(), before);
  }
});

test('point binding requires the present sampled physical locus', () => {
  const first = trace.packets[0], family = new ReductionTransport(), domain = new ObservedInputDomain(4096);
  const proposal = family.propose(first.observation, first.packet.frame_rows, domain.candidates(first.observation), 120)!;
  assert.throws(() => family.bind(proposal, new ObservedInputDomain(4096)), /current measured input domain/);
  family.bind(proposal, domain);
  assert.deepEqual(proposal.steps[0].point_binding.point, [proposal.actions[0].data.x, proposal.actions[0].data.y]);
});
