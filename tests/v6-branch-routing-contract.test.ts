import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchRouting } from '../src/logos-engine/v6-branch-routing.ts';
import {
  BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS, BranchRoutingIncomplete, checkedBranchBounds,
  branchObservedState, boundedBranchObservedState, boundedBranchObservedStateCooperative,
  branchPlacement, boundedBranchPlacementCooperative,
} from '../src/logos-engine/v6-branch-routing-geometry.ts';
import type { BranchModel, BranchPoint, BranchSearchBounds } from '../src/logos-engine/v6-branch-routing-geometry.ts';
import type { NativeExecution } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const INPUTS: R[] = [1, 2, 3, 4, 5].map(n => ({ action_ref: `ACTION${n}` }));
const MOTION = { ACTION1: [-1, 0], ACTION2: [1, 0], ACTION3: [0, -1], ACTION4: [0, 1] };
const EXECUTION: NativeExecution = { yieldControl: async () => {} };

/** Declared generic counterfactual model, not an acquired cold-chain fixture.
 * One length-two vertical contributor splits source2 into goals1 and4 at start2.
 * Starts0..3 form a complete four-placement domain, hand-derived independently
 * of the implementation and of the Python differential corpus.
 */
function model(position: BranchPoint = [2, 0]): BranchModel {
  return { axis: 0, tangent: 1, sign: 1, unit: 1, goals: [1, 4], sources: [2],
    bars: [{ position: [...position], length: 2, hue: 9 }], active: 0, highlight: 9,
    order: [0], limit: 5, goal_boxes: [[6, 1, 6, 1], [6, 4, 6, 4]] };
}
function rows(positions: readonly BranchPoint[]): number[][] {
  const value = Array.from({ length: 7 }, () => Array<number>(8).fill(0));
  for (const [x, y] of positions) { value[y]![x] = 9; value[y + 1]![x] = 9; }
  return value;
}
function observation(positions: readonly BranchPoint[], revision = 1): R {
  return { level_epoch: 1, levels_completed: 0, state: 'NOT_FINISHED', revision,
    observation_ref: `O_contract_${revision}`, frame_hash: `F_contract_${revision}`,
    entities: positions.map(([x, y]) => ({ rectangular: true, bbox: [x, y, x, y + 1],
      position: [x, y], palette_value: 9 })) };
}
function snapshot(options: { position?: BranchPoint; ready?: boolean } = {}): R {
  const value = model(options.position);
  return { format: 'native.branch_routing.v1', epoch: 1,
    motion: options.ready ? structuredClone(MOTION) : {}, passed: [], events: [],
    model: value, current: [[...value.bars[0]!.position]], verified: [], seen: [], refs: {}, finished: false };
}
function seeded(options: { position?: BranchPoint; ready?: boolean; bounds?: Partial<BranchSearchBounds> } = {}): BranchRouting {
  const owner = new BranchRouting(options.bounds === undefined ? {} : { boundedSearch: options.bounds });
  owner.restore(snapshot(options)); return owner;
}
function incomplete(phase: 'identity' | 'placements', cause: BranchRoutingIncomplete['cause'], examined: number) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof BranchRoutingIncomplete);
    assert.equal(error.phase, phase); assert.equal(error.cause, cause); assert.equal(error.examined, examined);
    assert.equal(error.name, 'BranchRoutingIncomplete');
    return true;
  };
}

test('branch bounds are explicit, positive and cannot silently exceed the published ceilings', () => {
  assert.deepEqual(BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS,
    { maximumIdentityAssignments: 16_384, maximumPlacements: 65_536, yieldInterval: 128 });
  assert.ok(Object.isFrozen(BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS));
  const defaults = checkedBranchBounds({}); assert.deepEqual(defaults, BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS);
  assert.ok(Object.isFrozen(defaults));
  assert.deepEqual(checkedBranchBounds({ maximumIdentityAssignments: 1, maximumPlacements: 1, yieldInterval: 1 }),
    { maximumIdentityAssignments: 1, maximumPlacements: 1, yieldInterval: 1 });
  const reduced = { maximumPlacements: 3 }; const copied = checkedBranchBounds(reduced); reduced.maximumPlacements = 4;
  assert.equal(copied.maximumPlacements, 3);
  for (const key of ['maximumIdentityAssignments', 'maximumPlacements', 'yieldInterval'] as const) {
    for (const invalid of [0, -1, 1.5, NaN, Infinity, BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS[key] + 1]) {
      assert.throws(() => checkedBranchBounds({ [key]: invalid }), TypeError);
    }
  }
  for (const invalid of [null, [], 3, { unknownLimit: 2 }]) {
    assert.throws(() => checkedBranchBounds(invalid as any), TypeError);
  }
  assert.throws(() => new BranchRouting({ boundedSearch: { maximumPlacements: 0 } }), TypeError);
});

test('an identity found before the bound is not returned while another assignment remains', () => {
  const m = model(), prior: BranchPoint[] = [[2, 0]], o = observation([[2, 0], [2, 3]]);
  assert.deepEqual(branchObservedState(o, m, prior), [[[2, 0]], 0]);
  assert.throws(() => boundedBranchObservedState(o, m, prior, { maximumIdentityAssignments: 1 }),
    incomplete('identity', 'maximum_identity_assignments', 1));
  assert.deepEqual(boundedBranchObservedState(o, m, prior, { maximumIdentityAssignments: 2 }), [[[2, 0]], 0]);
});

test('a placement optimum found before the last candidate is withheld until enumeration is complete', async () => {
  const m = model([2, 2]), positions: BranchPoint[] = [[2, 2]];
  assert.deepEqual(branchPlacement(m, positions, 0), { cost: 1, starts: [2], displacement: [0] });
  // Start2, examined third, already has the theoretical minimum cost1. The
  // unexamined fourth start still prevents the bounded routine from returning it.
  await assert.rejects(() => boundedBranchPlacementCooperative(m, positions, 0,
    { maximumPlacements: 3, yieldInterval: 1 }, EXECUTION), incomplete('placements', 'maximum_placements', 3));
  assert.deepEqual(await boundedBranchPlacementCooperative(m, positions, 0,
    { maximumPlacements: 4, yieldInterval: 1 }, EXECUTION), { cost: 1, starts: [2], displacement: [0] });
});

test('cooperative identity and placement enumeration actually yields on a small complete domain', async () => {
  let identityYields = 0;
  assert.deepEqual(await boundedBranchObservedStateCooperative(observation([[2, 0], [2, 3]]), model(), [[2, 0]],
    { maximumIdentityAssignments: 2, yieldInterval: 1 }, { yieldControl: async () => { identityYields++; } }), [[[2, 0]], 0]);
  assert.equal(identityYields, 2);
  let placementYields = 0;
  assert.deepEqual(await boundedBranchPlacementCooperative(model([2, 2]), [[2, 2]], 0,
    { maximumPlacements: 4, yieldInterval: 1 }, { yieldControl: async () => { placementYields++; } }),
  { cost: 1, starts: [2], displacement: [0] });
  assert.equal(placementYields, 4);
});

test('cancellation and deadlines stop before work or at the next cooperative checkpoint', async () => {
  const o = observation([[2, 0], [2, 3]]), m = model(), prior: BranchPoint[] = [[2, 0]];
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  assert.throws(() => boundedBranchObservedState(o, m, prior, {},
    { signal: alreadyAborted.signal, yieldControl: async () => {} }), incomplete('identity', 'aborted', 0));
  assert.throws(() => boundedBranchObservedState(o, m, prior, {},
    { now: () => 4, deadlineMs: 4, yieldControl: async () => {} }), incomplete('identity', 'deadline', 0));
  const duringIdentity = new AbortController(); let identityYields = 0;
  await assert.rejects(() => boundedBranchObservedStateCooperative(o, m, prior, { yieldInterval: 1 },
    { signal: duringIdentity.signal, yieldControl: async () => { identityYields++; duringIdentity.abort(); } }),
  incomplete('identity', 'aborted', 1));
  assert.equal(identityYields, 1);
  let clock = 0, placementYields = 0;
  await assert.rejects(() => boundedBranchPlacementCooperative(model([2, 2]), [[2, 2]], 0, { yieldInterval: 1 },
    { now: () => clock, deadlineMs: 1, yieldControl: async () => { placementYields++; clock = 1; } }),
  incomplete('placements', 'deadline', 1));
  assert.equal(placementYields, 1);
});

test('invalid deadline and clock values cannot silently disable a declared bound', () => {
  const o = observation([[2, 0]]);
  for (const deadlineMs of [NaN, Infinity, -Infinity]) {
    assert.throws(() => boundedBranchObservedState(o, model(), [[2, 0]], {},
      { deadlineMs, yieldControl: async () => {} }), TypeError);
  }
  assert.throws(() => boundedBranchObservedState(o, model(), [[2, 0]], {},
    { deadlineMs: 1, now: () => NaN, yieldControl: async () => {} }), TypeError);
});

test('bounded proposal refusal says unknown and is scoped to both the observation and owner state', async () => {
  const positions: BranchPoint[] = [[2, 0], [2, 3]], o = observation(positions), image = rows(positions);
  const exact = seeded({ ready: true }); assert.ok(await exact.propose(o, image, INPUTS, 8));
  const owner = seeded({ ready: true, bounds: { maximumIdentityAssignments: 1 } });
  const before = owner.state(); assert.equal(await owner.propose(o, image, INPUTS, 8, EXECUTION), null);
  assert.deepEqual(owner.state(), before);
  const refusal = owner.currentProposalRefusal(o); assert.ok(refusal);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.search_status, 'resource_bound');
  assert.equal(refusal.release_authority, false); assert.equal(refusal.search_phase, 'identity');
  assert.equal(refusal.reached_bound, 'maximum_identity_assignments'); assert.equal(refusal.examined, 1);
  assert.equal(refusal.actions, undefined); assert.equal(refusal.steps, undefined);
  const originalRefusal = structuredClone(refusal); refusal.bounds.maximumIdentityAssignments = 999;
  assert.deepEqual(owner.currentProposalRefusal(o), originalRefusal);
  for (const changed of [{ observation_ref: 'another' }, { level_epoch: 2 }, { frame_hash: 'another' },
    { revision: 2 }, { levels_completed: 1 }]) assert.equal(owner.currentProposalRefusal({ ...o, ...changed }), null);
  owner.motion.ACTION1 = [0, 3]; assert.equal(owner.currentProposalRefusal(o), null);
  owner.restore(before); assert.equal(owner.currentProposalRefusal(o), null);
});

test('owner withholds a complete-looking propagation proposal when placement work is incomplete', async () => {
  const o = observation([[2, 2]]), image = rows([[2, 2]]);
  const exact = seeded({ position: [2, 2], ready: true });
  const complete = await exact.propose(o, image, INPUTS, 8); assert.ok(complete);
  assert.equal(complete.steps[0].mode, 'propagate');
  const owner = seeded({ position: [2, 2], ready: true, bounds: { maximumPlacements: 3, yieldInterval: 1 } });
  const before = owner.state(); assert.equal(await owner.propose(o, image, INPUTS, 8, EXECUTION), null);
  assert.deepEqual(owner.state(), before);
  const refusal = owner.currentProposalRefusal(o); assert.ok(refusal);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.search_phase, 'placements');
  assert.equal(refusal.reached_bound, 'maximum_placements'); assert.equal(refusal.release_authority, false);
});

test('aborted and expired proposals retain their unknown refusal instead of claiming no solution', async () => {
  for (const cause of ['aborted', 'deadline'] as const) {
    const owner = seeded({ bounds: {} }), o = observation([[2, 0]]), controller = new AbortController();
    if (cause === 'aborted') controller.abort();
    const execution: NativeExecution = { yieldControl: async () => {},
      ...(cause === 'aborted' ? { signal: controller.signal } : { now: () => 5, deadlineMs: 5 }) };
    assert.equal(await owner.propose(o, rows([[2, 0]]), INPUTS, 8, execution), null);
    const refusal = owner.currentProposalRefusal(o); assert.ok(refusal);
    assert.equal(refusal.reached_bound, cause); assert.equal(refusal.status, 'unknown');
    assert.equal(refusal.examined, 0); assert.equal(refusal.release_authority, false);
    owner.clearTransient(); assert.equal(owner.currentProposalRefusal(o), null);
  }
});

test('a mutation during an identity yield is preserved and never overwritten by the pending proposal', async () => {
  const owner = seeded({ bounds: { yieldInterval: 1 } }), o = observation([[2, 1]]);
  const before = owner.state(); let yields = 0;
  await assert.rejects(() => Promise.resolve(owner.propose(o, rows([[2, 1]]), INPUTS, 8,
    { yieldControl: async () => { yields++; owner.motion.ACTION1 = [0, 3]; } })),
  /memory changed during cooperative enumeration/);
  assert.equal(yields, 1); assert.deepEqual(owner.motion.ACTION1, [0, 3]);
  assert.deepEqual(owner.current, before.current); assert.notDeepEqual(owner.current, [[2, 1]]);
  assert.deepEqual(owner.events, before.events); assert.equal(owner.currentProposalRefusal(o), null);
});

test('a mutation during a placement yield also wins over the pending decision', async () => {
  const owner = seeded({ position: [2, 2], ready: true, bounds: { yieldInterval: 1 } });
  const o = observation([[2, 2]]); let yields = 0;
  await assert.rejects(() => Promise.resolve(owner.propose(o, rows([[2, 2]]), INPUTS, 8,
    { yieldControl: async () => { yields++; if (yields === 2) owner.finished = true; } })),
  /memory changed during cooperative enumeration/);
  assert.ok(yields >= 2); assert.equal(owner.finished, true);
  assert.deepEqual(owner.current, [[2, 2]]); assert.deepEqual(owner.events, []);
  assert.equal(owner.currentProposalRefusal(o), null);
});

test('bounded record raises its typed incomplete result before acquiring any part of the return', async () => {
  const owner = seeded({ bounds: { maximumIdentityAssignments: 1 } });
  const before = observation([[2, 0], [2, 3]]), after = observation([[2, 1], [2, 3]], 2);
  const image = rows([[2, 0], [2, 3]]);
  assert.equal(await owner.propose(before, image, INPUTS, 8, EXECUTION), null);
  const beforeState = owner.state(), beforeRefusal = owner.currentProposalRefusal(before);
  const proposal = { steps: [{ mode: 'calibrate', state: [[[2, 0]], 0] }] };
  assert.throws(() => owner.record(before, after, { action_ref: 'ACTION1' }, image,
    rows([[2, 1], [2, 3]]), proposal, 0), incomplete('identity', 'maximum_identity_assignments', 1));
  assert.deepEqual(owner.state(), beforeState); assert.deepEqual(owner.currentProposalRefusal(before), beforeRefusal);
  assert.deepEqual(owner.motion, {}); assert.equal(owner.seen.size, 0); assert.equal(owner.verified.size, 0);
  assert.deepEqual(owner.refs, {}); assert.deepEqual(owner.events, []); assert.equal(owner.finished, false);
});

test('an official score boundary remains prior to identity work and ordinary propagation mutation', () => {
  const owner = seeded({ bounds: { maximumIdentityAssignments: 1 } });
  const before = observation([[2, 0]], 1), after = { ...observation([[2, 0], [2, 3]], 2), levels_completed: 1 };
  const controller = new AbortController(); controller.abort();
  const proposal = { steps: [{ mode: 'propagate', state: [[[2, 0]], 0] }] };
  const event = owner.record(before, after, { action_ref: 'ACTION5' }, rows([[2, 0]]), rows([[2, 0], [2, 3]]), proposal, 0, [],
    { signal: controller.signal, deadlineMs: 0, now: () => 1, yieldControl: async () => {} });
  assert.deepEqual(event, { status: 'official_boundary', ref: after.observation_ref });
  assert.deepEqual(owner.passed, [{ score: 1, ref: after.observation_ref }]);
  assert.deepEqual(owner.events, []); assert.equal(owner.finished, false); assert.deepEqual(owner.current, [[2, 0]]);
});

test('the acquired event returned to a caller cannot mutate retained owner tuples or history', () => {
  const owner = seeded(), before = observation([[2, 0]], 1), after = observation([[2, 1]], 2);
  const proposal = { steps: [{ mode: 'calibrate', state: [[[2, 0]], 0] }] };
  const event = owner.record(before, after, { action_ref: 'ACTION1' }, rows([[2, 0]]), rows([[2, 1]]), proposal, 0);
  assert.deepEqual(event.after, [[[2, 1]], 0]); const retained = owner.state();
  event.after[0][0][0] = 999; event.before[0][0][0] = 998; event.ref = 'mutated outside';
  assert.deepEqual(owner.state(), retained); assert.deepEqual(owner.motion.ACTION1, [0, 1]);
});

test('cold snapshots, exported snapshots and restored input snapshots are detached', () => {
  const cold = new BranchRouting().state();
  assert.deepEqual(cold, { format: 'native.branch_routing.v1', epoch: null, motion: {}, passed: [], events: [] });
  const input = snapshot({ ready: true }), owner = new BranchRouting(); owner.restore(input);
  const expected = owner.state(); input.motion.ACTION1[0] = 999; input.model.bars[0].position[0] = 999;
  assert.deepEqual(owner.state(), expected);
  const exported = owner.state(); exported.current[0][0] = 999; exported.model.goals[0] = 999; exported.motion.ACTION2[0] = 999;
  assert.deepEqual(owner.state(), expected);
  owner.restore(cold); assert.deepEqual(owner.state(), cold); assert.equal(owner.model, undefined);
});

test('invalid restore is atomic across shape, numeric, ownership and duplicate-state failures', () => {
  const owner = seeded({ ready: true }), before = owner.state();
  const corruptions: Array<(value: R) => void> = [
    value => { value.format = 'native.other.v1'; },
    value => { value.epoch = NaN; },
    value => { value.extra = true; },
    value => { value.motion.ACTION1 = [0, 0]; },
    value => { value.model.order = [1]; },
    value => { value.current = [[2, 0], [2, 0]]; },
    value => { value.verified = ['ACTION1', 'ACTION1']; },
    value => { value.refs = { ACTION1: 'not verified in this epoch' }; },
    value => { value.seen = [['ACTION1', [[2, 0]], 1]]; },
    value => { value.events = [{ status: 'measured_response', mode: 'invented', before: [[[2, 0]], 0], after: null, ref: 'R' }]; },
    value => { value.model = null; },
    value => { value.self = value; },
  ];
  for (const corrupt of corruptions) {
    const candidate = structuredClone(before); corrupt(candidate);
    assert.throws(() => owner.restore(candidate)); assert.deepEqual(owner.state(), before);
  }
});

test('old events are restored independently of the current model and can survive a model-free epoch', () => {
  const historical: R = { status: 'measured_response', mode: 'select',
    before: [[[1, 1], [3, 1], [5, 1]], 0], after: [[[1, 1], [3, 1], [5, 1]], 2], ref: 'O_previous_epoch' };
  const value = snapshot({ ready: true }); value.events = [historical]; value.passed = [{ score: 1, ref: 'O_boundary' }];
  value.motion.ACTION1 = [0, 3];
  const owner = new BranchRouting(); owner.restore(value); assert.deepEqual(owner.state(), value);
  const absent = { ...structuredClone(value), epoch: 2, model: null, current: [], verified: [], seen: [], refs: {}, finished: false };
  owner.restore(absent); assert.deepEqual(owner.state(), absent);
  assert.equal(owner.events[0]!.before[0].length, 3); assert.deepEqual(owner.motion.ACTION1, [0, 3]);
});
