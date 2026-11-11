import test from 'node:test';
import assert from 'node:assert/strict';
import { MotifAccess, MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS } from '../src/logos-engine/v6-motif-access.ts';
import {
  boundedMotifPaths, boundedMotifPathsCooperative, motifBody, motifLattice, motifPaths,
  motifRoute, motifRowsDigest, motifTarget, motifTupleKey,
} from '../src/logos-engine/v6-motif-access-geometry.ts';
import type { MotifBody } from '../src/logos-engine/v6-motif-access-geometry.ts';
import { measureNativeObservation, projection, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const POINTS = [[3, 26], [8, 26], [3, 31], [8, 31]] as const;
const INPUTS: R[] = [{ action_ref: 'ACTION4', data: {} }, ...POINTS.map(([x, y]) => ({ action_ref: 'ACTION6', data: { x, y } }))];
const box = (rows: number[][], x: number, y: number, width: number, height: number, color: number) => {
  for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) rows[yy]![xx] = color;
};
/** Independent public raster; no recorded trajectory, game image or learned seed. */
function scene(options: { actor?: [number, number] | null; bits?: readonly number[]; goal?: boolean } = {}): number[][] {
  const rows = Array.from({ length: 40 }, () => Array<number>(64).fill(0));
  box(rows, 2, 3, 59, 4, 1);
  if (options.goal !== false) { box(rows, 53, 2, 7, 7, 2); box(rows, 55, 4, 2, 2, 3); }
  const actor = options.actor === undefined ? [3, 4] : options.actor;
  if (actor) { box(rows, actor[0]!, actor[1]!, 1, 2, 3); box(rows, actor[0]! + 1, actor[1]!, 1, 2, 4); }
  POINTS.forEach(([x, y], index) => box(rows, x, y, 2, 2, options.bits?.includes(index) ? 8 : 9 + index));
  box(rows, 20, 25, 7, 7, 6); box(rows, 20, 25, 2, 2, 7); box(rows, 25, 30, 2, 2, 7);
  box(rows, 35, 25, 7, 7, 6); box(rows, 40, 25, 2, 2, 7); box(rows, 35, 30, 2, 2, 7);
  return rows;
}
async function observation(rows: number[][], revision: number, epoch = 1) {
  return measureNativeObservation({ frame_rows: rows, frame_hash: await publicFrameHash(rows), level: epoch,
    levels_completed: epoch - 1, state: 'NOT_FINISHED', available_action_refs: ['ACTION4', 'ACTION6'] }, revision);
}
function packet(rows: number[][], o: R): NativePublicObservation {
  return { frame_rows: rows, frame_packet: [rows], level: o.level_epoch, levels_completed: o.levels_completed,
    state: o.state, step_index: o.revision, available_action_refs: o.available_action_refs, frame_hash: o.frame_hash };
}
async function calibrate(owner: MotifAccess, moved = true, goal = true) {
  const first = scene({ goal }), before = await observation(first, 1);
  const proposal = await owner.propose(before, first, INPUTS, 100);
  assert.ok(proposal); assert.equal(proposal.steps[0].mode, 'calibrate');
  const second = scene({ actor: moved ? [5, 4] : [3, 4], goal }), after = await observation(second, 2);
  const event = owner.record(before, after, proposal.actions[0], first, second, proposal, 0);
  return { first, before, proposal, second, after, event };
}
async function acquireInvocation(owner = new MotifAccess()) {
  const calibration = await calibrate(owner, false, false);
  const toggle = await owner.propose(calibration.after, calibration.second, INPUTS, 20);
  assert.ok(toggle); assert.equal(toggle.steps[0].mode, 'toggle'); assert.deepEqual(toggle.steps[0].card, [0, 3]);
  const toggledRows = scene({ goal: false, bits: [0] }), toggled = await observation(toggledRows, 3);
  assert.equal(owner.after(toggle, 0, calibration.after, toggled, calibration.second, toggledRows).matched, true);
  owner.record(calibration.after, toggled, toggle.actions[0], calibration.second, toggledRows, toggle, 0);
  const invoke = await owner.propose(toggled, toggledRows, INPUTS, 20);
  assert.ok(invoke); assert.equal(invoke.steps[0].mode, 'invoke');
  return { owner, calibration, toggle, toggledRows, toggled, invoke };
}

test('motif geometry measures a unique input lattice, cards, composite body and framed target', async () => {
  const rows = scene(), o = await observation(rows, 1), grid = motifLattice(o, rows, INPUTS);
  assert.ok(grid); assert.deepEqual(grid.points, POINTS); assert.equal(grid.n, 2); assert.equal(grid.size, 2);
  assert.deepEqual(grid.cards.map(card => card.mask), [[0, 3], [1, 2]]);
  assert.deepEqual(motifBody(rows, 25), { position: [3, 4], size: 2, colors: [3, 4], box: [3, 4, 4, 5] });
  assert.deepEqual(motifTarget(rows, 25, [3, 4]), [55, 4, 56, 5]);
  assert.equal(motifLattice(o, rows, INPUTS.slice(0, -1)), null);
  const ambiguous = structuredClone(rows), more = [[46, 25], [51, 25], [46, 30], [51, 30]];
  more.forEach(([x, y]) => box(ambiguous, x!, y!, 3, 3, 13));
  const domain = [...INPUTS, ...more.map(([x, y]) => ({ action_ref: 'ACTION6', data: { x, y } }))];
  assert.equal(motifLattice(await observation(ambiguous, 2), ambiguous, domain), null);
});

test('predicted balanced footprint survives merging while an untracked ambiguous body abstains', () => {
  const rows = scene({ goal: false });
  box(rows, 5, 4, 2, 2, 4);
  assert.equal(motifBody(rows, 25, [3, 4]), null);
  assert.deepEqual(motifBody(rows, 25, [3, 4], [[3, 4], 2])?.position, [3, 4]);
  const two = scene({ goal: false }); box(two, 14, 12, 1, 2, 3); box(two, 15, 12, 1, 2, 4);
  assert.equal(motifBody(two, 25), null);
  assert.deepEqual(motifBody(two, 25, [3, 4], [[3, 4], 2])?.position, [3, 4]);
});

test('actual calibration acquires motion, with prefix capped by 16 and remaining', async () => {
  const owner = new MotifAccess(), { second, after, event } = await calibrate(owner);
  assert.deepEqual(event.after, [[5, 4], 2]); assert.deepEqual(owner.motion, { ACTION4: [2, 0] });
  const full = await owner.propose(after, second, INPUTS, 100); assert.ok(full);
  assert.equal(full.steps.length, 16); assert.ok(full.steps.every((step: R) => step.mode === 'walk'));
  assert.deepEqual(full.steps[0].expected_after, [[7, 4], 2]); assert.equal(full.steps[1].expected_before.frame_hash, null);
  const limited = await owner.propose(after, second, INPUTS, 3); assert.ok(limited); assert.equal(limited.steps.length, 3);
  assert.equal(await owner.propose(after, second, INPUTS, 0), null);
  const changed = structuredClone(full); changed.motif_plan.measured_translations.ACTION4[0] = 999;
  assert.deepEqual(owner.motion.ACTION4, [2, 0]);
});

test('before rechecks pose, pattern, epoch, score, first observation and current action domain', async () => {
  const owner = new MotifAccess(), { second, after } = await calibrate(owner), p = await owner.propose(after, second, INPUTS, 3);
  assert.ok(p); assert.equal(owner.before(p, 0, packet(second, after), after).admitted, true);
  assert.equal(owner.before(p, 0, packet(second, after), { ...after, observation_ref: 'other' }).admitted, false);
  for (const override of [{ level: 2 }, { levels_completed: 9 }, { available_action_refs: ['ACTION6'] }]) {
    assert.equal(owner.before(p, 0, { ...packet(second, after), ...override }, after).admitted, false);
  }
  assert.equal(owner.before(p, 0, packet(scene({ actor: [9, 4] }), after), after).admitted, false);
  assert.equal(owner.before(p, 0, packet(scene({ actor: [5, 4], bits: [1] }), after), after).admitted, false);
  const next = scene({ actor: [7, 4] }), nextO = await observation(next, 3);
  assert.equal(owner.before(p, 1, packet(next, nextO), nextO).admitted, true);
});

test('contrary pose seals the prefix and records a projection-bound obstruction without inventing an effect', async () => {
  const owner = new MotifAccess(), { second, after } = await calibrate(owner), p = await owner.propose(after, second, INPUTS, 3);
  assert.ok(p); const still = await observation(second, 3), result = owner.after(p, 0, after, still, second, second);
  assert.deepEqual(result, { matched: false, seal_prefix: true, reason: 'compare_predicted_bit_or_body_effect' });
  owner.record(after, still, p.actions[0], second, second, p, 0);
  assert.equal(owner.blocked.get(motifTupleKey([[5, 4], 'ACTION4', 2])), motifRowsDigest(projection(second, [7, 4, 8, 5])));
  assert.deepEqual(owner.motion.ACTION4, [2, 0]);
  assert.deepEqual(owner.after(p, 0, after, { ...still, state: 'GAME_OVER' }, second, second),
    { matched: null, seal_prefix: true, reason: 'official_boundary' });
});

test('point binding preserves the whole witness and addresses the current cell projection', async () => {
  const { owner, toggle } = await acquireInvocation();
  const step = toggle.steps[0], source = { binding_id: 'measured-locus', arbitrary_marker: { witness: 7 }, coordinate: [3, 26] };
  const domain = { bindings: new Map([[`${owner.epoch}:${step.expected_before.frame_hash}`, new Map([['3,26', source]])]]) } as unknown as ObservedInputDomain;
  owner.bind(toggle, domain);
  assert.deepEqual(step.point_binding, { ...source, projection_bbox: [3, 26, 4, 27], projected_rows_digest: step.point_digest });
  step.point_binding.arbitrary_marker.witness = 99; assert.equal(source.arbitrary_marker.witness, 7);
  assert.throws(() => owner.bind(toggle, { bindings: new Map() } as unknown as ObservedInputDomain), /current observed input domain/);
});

test('toggle contradiction retires current context; invoke remains an unknown effect', async () => {
  const owner = new MotifAccess(), { second, after } = await calibrate(owner, false, false);
  const p = await owner.propose(after, second, INPUTS, 10); assert.ok(p); assert.equal(p.steps[0].mode, 'toggle');
  const wrong = scene({ goal: false, bits: [0, 1] }), next = await observation(wrong, 3);
  const event = owner.record(after, next, p.actions[0], second, wrong, p, 0);
  assert.equal(event.status, 'grid_effect_refuted'); assert.equal(owner.retired, true);
  assert.equal(await owner.propose(next, wrong, INPUTS, 10), null);
  const invocation = await acquireInvocation();
  assert.equal(invocation.invoke.steps[0].expected_after, null);
  const vanished = scene({ goal: false, actor: null }), vanishedO = await observation(vanished, 4);
  const response = invocation.owner.record(invocation.toggled, vanishedO, invocation.invoke.actions[0],
    invocation.toggledRows, vanished, invocation.invoke, 0);
  assert.equal(response.after, null); assert.equal(invocation.owner.learned.get('[0,3]')!.body_change, true);
  assert.deepEqual(invocation.owner.passed, []);
});

test('source learning and history cross epochs while current context is remapped and unknown cards rank first', async () => {
  const { owner, toggledRows, toggled, invoke } = await acquireInvocation();
  const moved = scene({ goal: false, actor: [5, 4] }), movedO = await observation(moved, 4);
  owner.record(toggled, movedO, invoke.actions[0], toggledRows, moved, invoke, 0);
  const learned = structuredClone(owner.state().learned), events = structuredClone(owner.events);
  const original = scene({ goal: false }), nextEpoch = await observation(original, 5, 2);
  const p = await owner.propose(nextEpoch, original, INPUTS, 10); assert.ok(p); assert.equal(p.steps[0].mode, 'calibrate');
  assert.deepEqual(owner.state().learned, learned); assert.deepEqual(owner.events, events); assert.equal(owner.ink, null);
  assert.deepEqual([...owner.verified], []); assert.deepEqual(owner.refs, {}); assert.equal(owner.selected, null);
  const still = await observation(original, 6, 2);
  owner.record(nextEpoch, still, p.actions[0], original, original, p, 0);
  const nextCard = await owner.propose(still, original, INPUTS, 10); assert.ok(nextCard);
  assert.deepEqual(nextCard.steps[0].card, [1, 2]);
});

test('official completion appends passed alone; measured motion persists when starting a new epoch', async () => {
  const owner = new MotifAccess(), { second, after } = await calibrate(owner);
  const p = await owner.propose(after, second, INPUTS, 1); assert.ok(p);
  const events = structuredClone(owner.events), completed = { ...after, observation_ref: 'official-pass', levels_completed: 1 };
  assert.deepEqual(owner.record(after, completed, p.actions[0], second, second, p, 0), { status: 'official_boundary', ref: 'official-pass' });
  assert.deepEqual(owner.events, events); assert.deepEqual(owner.passed, [{ ref: 'official-pass', score: 1 }]);
  const fresh = scene(), epoch = await observation(fresh, 4, 2);
  await owner.propose(epoch, fresh, INPUTS, 2); assert.deepEqual(owner.motion.ACTION4, [2, 0]); assert.equal(owner.verified.size, 0);
});

test('state restores tuples by value, detaches snapshots, and rejects invalid snapshots atomically', async () => {
  const { owner, toggledRows, toggled, invoke } = await acquireInvocation();
  const changed = scene({ goal: false, actor: [5, 4] }), changedO = await observation(changed, 4);
  owner.record(toggled, changedO, invoke.actions[0], toggledRows, changed, invoke, 0);
  const snapshot = owner.state(), restored = new MotifAccess(); restored.restore(snapshot);
  assert.deepEqual(restored.state(), snapshot);
  snapshot.learned[0][1].body_change = false; snapshot.grid.points[0][0] = 99;
  assert.equal(restored.learned.get('[0,3]')!.body_change, true); assert.deepEqual(restored.grid!.points[0], [3, 26]);
  const stable = restored.state();
  for (const corrupt of [
    (v: R) => { v.epoch = 'bad'; }, (v: R) => { v.motion.bad = [1, 1]; },
    (v: R) => { v.grid.points.pop(); }, (v: R) => { v.learned.push(v.learned[0]); },
    (v: R) => { v.events[0].after = ['bad']; }, (v: R) => { v.blocked = [[[[1, 2], 'unknown', 2], '0'.repeat(64)]]; },
    (v: R) => { v.selected = []; }, (v: R) => { v.selected = [0, 99]; }, (v: R) => { v.selected = [0, 1]; },
    (v: R) => { v.ray = { receiver: [12, 8, 15, 11], receiver_digest: '0'.repeat(64), color: 2,
      sampled_trajectory: [[0, [4, 5]], [1, [4, 5]]], direction: [1, 0], linked_blockers: [[10, 4, 11, 5]], card: [0, 3], evidence: 'invalid', aimed: false }; },
    (v: R) => { v.ray = { receiver: [12, 8, 15, 11], receiver_digest: '0'.repeat(64), color: 2,
      sampled_trajectory: [[0, [4, 5]], [1, [6, 5]]], direction: [1, 0], linked_blockers: [], card: [0, 3], evidence: 'invalid', aimed: false }; },
  ]) {
    const invalid = structuredClone(stable); corrupt(invalid);
    assert.throws(() => restored.restore(invalid), TypeError); assert.deepEqual(restored.state(), stable);
  }
  const fresh = new MotifAccess(); fresh.restore(new MotifAccess().state()); assert.equal(Object.hasOwn(fresh.state(), 'grid'), false);
  const empty = Array.from({ length: 40 }, () => Array<number>(64).fill(0)), o = await observation(empty, 5, 2);
  await restored.propose(o, empty, [], 20);
  const emptyState = restored.state(); assert.equal(emptyState.grid, null); assert.equal(emptyState.ui_top, 25);
  const roundtrip = new MotifAccess(); roundtrip.restore(emptyState); assert.deepEqual(roundtrip.state(), emptyState);
});

function supported() {
  const rows = Array.from({ length: 12 }, () => Array<number>(12).fill(0)); box(rows, 2, 2, 4, 4, 1);
  const body: MotifBody = { position: [2, 2], size: 2, colors: [3, 4], box: [2, 2, 3, 3] };
  const motion = { R: [1, 0], D: [0, 1], L: [-1, 0], U: [0, -1] } as Record<string, [number, number]>;
  return { rows, body, motion };
}
test('BFS preserves last-input states, first shortest-path order and a zero-length route', () => {
  const { rows, body, motion } = supported(), paths = motifPaths(rows, body, motion, 12);
  assert.deepEqual(paths[0], { position: [2, 2], last: null, path: [] });
  assert.ok(paths.some(item => item.position[0] === 2 && item.position[1] === 2 && item.last === 'L'));
  assert.ok(paths.some(item => item.position[0] === 2 && item.position[1] === 2 && item.last === 'U'));
  assert.deepEqual(motifRoute(rows, body, [3, 3, 4, 4], motion, 12), ['R', 'D']);
  assert.deepEqual(motifRoute(rows, body, [3, 3, 4, 4], { D: [0, 1], R: [1, 0], L: [-1, 0], U: [0, -1] }, 12), ['D', 'R']);
  assert.deepEqual(motifRoute(rows, body, body.box, motion, 12), []);
});

test('a blocked translation applies only to the same current destination projection', () => {
  const { rows, body, motion } = supported(), blocked = new Map([[motifTupleKey([[2, 2], 'R', 2]), motifRowsDigest(projection(rows, [3, 2, 4, 3]))]]);
  assert.deepEqual(motifRoute(rows, body, [3, 2, 4, 3], motion, 12, blocked), ['D', 'R', 'U']);
  const changed = structuredClone(rows); changed[2]![4] = 2;
  assert.deepEqual(motifRoute(changed, body, [3, 2, 4, 3], motion, 12, blocked), ['R']);
});

test('state/frontier bounds expose incomplete search and never a partial route', () => {
  const { rows, body, motion } = supported();
  for (const [bounds, expected] of [
    [{ maximumStates: 1, maximumFrontier: 100 }, 'maximum_states'],
    [{ maximumStates: 100, maximumFrontier: 1 }, 'maximum_frontier'],
  ] as const) {
    const result = boundedMotifPaths(rows, body, motion, 12, new Map(), bounds);
    assert.equal(result.status, 'resource_bound'); assert.equal(result.bound, expected); assert.equal(result.paths, null);
    assert.ok(result.counters.retainedStates <= bounds.maximumStates); assert.ok(result.counters.frontierEntries <= bounds.maximumFrontier);
  }
  const complete = boundedMotifPaths(rows, body, motion, 12, new Map(), MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS);
  assert.equal(complete.status, 'complete'); assert.deepEqual(complete.paths, motifPaths(rows, body, motion, 12));
  assert.throws(() => new MotifAccess({ boundedSearch: { maximumStates: 0, maximumFrontier: 1 } }), TypeError);
});

test('bounded owner refuses fallback on incomplete search with read-only current diagnostics', async () => {
  const owner = new MotifAccess({ boundedSearch: { maximumStates: 1, maximumFrontier: 10 } }), { second, after } = await calibrate(owner);
  const before = owner.state(); assert.equal(await owner.propose(after, second, INPUTS, 20), null); assert.deepEqual(owner.state(), before);
  const refusal = owner.currentProposalRefusal(after); assert.ok(refusal);
  assert.equal(refusal.status, 'unknown'); assert.equal(refusal.reached_bound, 'maximum_states'); assert.equal(refusal.release_authority, false);
  refusal.counters.retainedStates = 999; assert.equal(owner.currentProposalRefusal(after)!.counters.retainedStates, 1);
  assert.equal(owner.currentProposalRefusal({ ...after, observation_ref: 'stale' }), null);
  assert.equal(owner.currentProposalRefusal({ ...after, revision: after.revision + 1 }), null);
  owner.restore(before); assert.equal(owner.currentProposalRefusal(after), null);
});

test('deadline applies before calibration and cooperative abort never emits a fallback', async () => {
  const owner = new MotifAccess({ boundedSearch: MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS }), rows = scene(), o = await observation(rows, 1);
  assert.equal(await owner.propose(o, rows, INPUTS, 20, { deadlineMs: 10, now: () => 10, yieldControl: async () => {} }), null);
  assert.equal(owner.currentProposalRefusal(o)?.reached_bound, 'deadline');
  const control = new AbortController(); control.abort();
  await assert.rejects(owner.propose(o, rows, INPUTS, 20, { signal: control.signal, yieldControl: async () => {} }) as Promise<unknown>, { name: 'AbortError' });
  assert.equal(owner.currentProposalRefusal(o), null);
  const { rows: support, body, motion } = supported(), controller = new AbortController(); let yields = 0;
  box(support, 2, 2, 6, 6, 1); // Reach a real cooperative yield before requesting cancellation.
  await assert.rejects(boundedMotifPathsCooperative(support, body, motion, 12, new Map(), MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS,
    { signal: controller.signal, yieldControl: async () => { yields++; controller.abort(); } }), { name: 'AbortError' });
  assert.ok(yields > 0);
});
