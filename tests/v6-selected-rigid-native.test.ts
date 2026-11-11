import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeSelectedRigid, SELECTED_RIGID_STATE_SCHEMA } from '../src/logos-engine/v6-selected-rigid.ts';
import { selectedRigidInputCandidates, selectedRigidMoved, selectedRigidPoint, selectedRigidPoses,
  selectedRigidScene } from '../src/logos-engine/v6-selected-rigid-geometry.ts';
import { SELECTED_RIGID_LIMITS, SelectedRigidIncomplete, selectedRigidLimits,
  selectedRigidRoute } from '../src/logos-engine/v6-selected-rigid-search.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativeExecution, NativePublicObservation, NativeRecord } from '../src/logos-engine/v6-native-types.ts';
import type { SelectedRigidCell as Cell, SelectedRigidProposal,
  SelectedRigidSourceState } from '../src/logos-engine/v6-selected-rigid-types.ts';

const available = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6'];
const inputs = available.map(action_ref => ({ action_ref, data: {} }));
const copy = <T>(value: T): T => structuredClone(value);
const execution = (now: () => number = () => 0, extra: Partial<NativeExecution> = {}): NativeExecution => ({
  now, deadlineMs: 1_000_000, remainingLevelActions: 100, yieldControl: async () => {}, ...extra,
});

/** Synthetic measured raster only. It encodes no game, level or authored
 * solution. A three-sided measured carrier and separated cell insets satisfy
 * the source's actual scene predicate. Body 10 has an absent concave corner. */
function raster(position: Cell = [0, 0], targetX = 0): number[][] {
  const rows = Array.from({ length: 44 }, () => Array<number>(40).fill(0)), q = 6, ox = 3, oy = 3;
  for (let x = 1; x <= 28; x++) rows[1]![x] = 9;
  for (let y = 2; y <= 28; y++) { rows[y]![1] = 9; rows[y]![28] = 9; }
  const fill = (color: number, at: Cell, mask: readonly Cell[]): void => {
    for (const [dx, dy] of mask) for (let y = 1; y < q - 1; y++) for (let x = 1; x < q - 1; x++) {
      rows[oy + (at[1] + dy) * q + y]![ox + (at[0] + dx) * q + x] = color;
    }
  };
  fill(2, position, [[0, 0], [0, 1]]);
  fill(10, [2, 0], [[0, 0], [0, 1], [1, 1]]);
  fill(11, [3, 0], [[0, 0]]);
  const left = ox + targetX * q, top = oy + 4 * q, right = left + q - 1, bottom = top + 2 * q - 1;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x === left || x === right || y === top || y === bottom) rows[y]![x] = 2;
  }
  return rows;
}
async function packet(rows: number[][], revision: number, epoch = 1, score = 0, state = 'IN_PROGRESS') {
  const publicPacket: NativePublicObservation = { frame_rows: rows, frame_packet: [rows], level: epoch,
    levels_completed: score, state, step_index: revision, available_action_refs: available,
    frame_hash: await publicFrameHash(rows) };
  return { publicPacket, observation: await measureNativeObservation(publicPacket, revision, 'selected-rigid-synthetic') };
}
function proposed(value: Awaited<ReturnType<NativeSelectedRigid['propose']>>): asserts value is SelectedRigidProposal {
  assert.ok(value && value.status === 'proposed');
}
async function selected(targetX = 0) {
  const owner = new NativeSelectedRigid(), rows = raster([0, 0], targetX), before = await packet(rows, 0);
  const proposal = await owner.propose(before.observation, rows, inputs, 16, execution()); proposed(proposal);
  assert.equal(proposal.selected_rigid_plan.mode, 'select');
  const after = await packet(rows, 1), result = owner.record(before.observation, after.observation, proposal.actions[0]!, rows, rows, proposal);
  assert.ok(result); assert.equal(result.events[0]!.models.length, 24);
  return { owner, rows, before, after, proposal, result, targetX };
}
async function learned(targetX = 0) {
  const first = await selected(targetX);
  const proposal = await first.owner.propose(first.after.observation, first.rows, inputs, 16, execution()); proposed(proposal);
  assert.equal(proposal.selected_rigid_plan.mode, 'probe');
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION4' }]);
  const rows = raster([0, 1], targetX), after = await packet(rows, 2);
  const result = first.owner.record(first.after.observation, after.observation, proposal.actions[0]!, first.rows, rows, proposal);
  assert.ok(result); assert.equal(result.events[0]!.models.length, 6);
  return { ...first, rows, before: first.after, after, proposal, result };
}

test('explicit empty configuration abstains while omitted configuration and limits-only options retain source defaults', async () => {
  const rows = raster(), before = await packet(rows, 0), defaultConfiguration = new NativeSelectedRigid().captureContext().configuration;
  assert.ok(defaultConfiguration?.compose && defaultConfiguration.control);
  for (const owner of [new NativeSelectedRigid({}), new NativeSelectedRigid({ configuration: {} as any })]) {
    assert.deepEqual(owner.captureContext().configuration, {});
    assert.equal(await owner.propose(before.observation, rows, inputs, 16, execution()), null);
    assert.equal(owner.captureContext().requestedStopReason, null);
    assert.deepEqual(owner.sourceState(), { format: 'selected_rigid_events.v1', events: [] });
  }
  for (const owner of [new NativeSelectedRigid(undefined), new NativeSelectedRigid({ limits: { nodeBound: 100 } })]) {
    assert.deepEqual(owner.captureContext().configuration, defaultConfiguration);
    proposed(await owner.propose(before.observation, rows, inputs, 16, execution()));
  }
});

const deeplyFrozen = (value: any): boolean => value === null || typeof value !== 'object'
  || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);

test('source and native checkpoints have only their exact declared fields', () => {
  const owner = new NativeSelectedRigid();
  assert.deepEqual(owner.sourceState(), { format: 'selected_rigid_events.v1', events: [] });
  const native = owner.nativeState();
  assert.deepEqual(Object.keys(native).sort(), ['events', 'format', 'schema']);
  assert.equal(native.schema, SELECTED_RIGID_STATE_SCHEMA); assert.equal(deeplyFrozen(native), true);
  assert.strictEqual(owner.nativeState(), native); assert.equal(owner.hasRetainedEvents(), false);
  assert.equal(owner.retainedDigest(), symbolicDigest(['isolated-selected-rigid-v1', null, null, []]));
});

test('measurement retains numeric body order, complete concave masks and the single outlined prior', () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  assert.deepEqual(scene.geometry, { q: 6, origin: [3, 3], size: [4, 4], frame_color: 9 });
  assert.deepEqual(scene.bodies.map(body => body.key), ['2', '10', '11']);
  assert.deepEqual(scene.bodies[1]!.mask, [[0, 0], [0, 1], [1, 1]]);
  assert.deepEqual(scene.receptacle, { key: '2', position: [0, 4], mask: [[0, 0], [0, 1]] });
  assert.deepEqual(selectedRigidPoint(scene, 0), { x: 6, y: 6 });
  assert.deepEqual(selectedRigidInputCandidates(raster(), available), scene.bodies.map((_, index) => ({
    action_ref: 'ACTION6', data: selectedRigidPoint(scene, index),
  })));
  assert.deepEqual(selectedRigidInputCandidates(raster(), ['ACTION1']), []);
});

test('scene reuse measures current bodies in the old geometry instead of granting a fresh frame proof', () => {
  const old = selectedRigidScene(raster()); assert.ok(old);
  const rows = raster([0, 1]);
  for (let x = 1; x <= 28; x++) rows[1]![x] = 0;
  for (let y = 2; y <= 28; y++) { rows[y]![1] = 0; rows[y]![28] = 0; }
  assert.equal(selectedRigidScene(rows), null);
  const current = selectedRigidScene(rows, old); assert.ok(current);
  assert.strictEqual(current.geometry, old.geometry); assert.deepEqual(current.bodies[0]!.position, [0, 1]);
});

test('full-mask displacement admits an absent concave corner and rejects occupied cells', () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  scene.geometry.size = [5, 4]; scene.bodies[2]!.position = [4, 0];
  const poses = selectedRigidPoses(scene), intoCorner = selectedRigidMoved(scene, poses, 2, [-1, 0]);
  assert.deepEqual(intoCorner[2], [3, 0]); assert.notStrictEqual(intoCorner, poses);
  assert.strictEqual(selectedRigidMoved(scene, intoCorner, 2, [-1, 0]), intoCorner);
  assert.strictEqual(selectedRigidMoved(scene, intoCorner, 2, [0, 1]), intoCorner);
});

test('only the homologous body receives the measured target-cell boundary exception', () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  const poses = [...selectedRigidPoses(scene)]; poses[0] = [0, 3];
  assert.deepEqual(selectedRigidMoved(scene, poses, 0, [0, 1])[0], [0, 4]);
  poses[0] = [0, 0]; poses[2] = [0, 3];
  assert.strictEqual(selectedRigidMoved(scene, poses, 2, [0, 1]), poses);
});

test('A* retains the source four-step route and exact expanded-node accounting', async () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  const [path, nodes] = await selectedRigidRoute(scene, null, 1000, execution()); assert.ok(path);
  assert.equal(nodes, 5); assert.equal(path.length, 4);
  assert.deepEqual(path.map(([body, direction, poses]) => [body, direction, poses[0]]), [
    [0, [0, 1], [0, 1]], [0, [0, 1], [0, 2]], [0, [0, 1], [0, 3]], [0, [0, 1], [0, 4]],
  ]);
  const goal = copy(scene); goal.bodies[0]!.position = [0, 4];
  assert.deepEqual(await selectedRigidRoute(goal, 0, 1000, execution()), [[], 1]);
});

test('route source bounds return no partial path and do not count stale/ungenerated work as expanded nodes', async () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  assert.deepEqual(await selectedRigidRoute(scene, null, 1000, execution(), { nodeBound: 0 }), [null, 0]);
  assert.deepEqual(await selectedRigidRoute(scene, null, 1000, execution(), { nodeBound: 3 }), [null, 3]);
  assert.deepEqual(await selectedRigidRoute(scene, null, 0, execution()), [null, 0]);
});

test('cooperative route cancellation rejects without returning a partial solution', async () => {
  const scene = selectedRigidScene(raster()); assert.ok(scene);
  const controller = new AbortController(); let yields = 0;
  await assert.rejects(() => selectedRigidRoute(scene, null, 1000, execution(() => 0, {
    signal: controller.signal, yieldControl: async () => { yields++; controller.abort(); },
  }), { yieldInterval: 1 }), (error: unknown) => error instanceof SelectedRigidIncomplete && error.cause === 'aborted');
  assert.equal(yields, 1);
});

for (const [bound, cause] of [['retainedStateBound', 'NATIVE_RETAINED_STATE_BOUND'], ['queuedStateBound', 'NATIVE_QUEUED_STATE_BOUND']] as const) {
  test(`${bound} is an explicit native incomplete result, never an impossibility`, async () => {
    const owner = new NativeSelectedRigid({ limits: { [bound]: 0 } }), rows = raster(), current = await packet(rows, 0);
    const before = owner.nativeState(), result = await owner.propose(current.observation, rows, inputs, 16, execution());
    assert.ok(result && result.status === 'unknown'); assert.equal(result.block_unrelated_probe, true);
    assert.equal(result.reason, 'rigid_conditional_configuration_search_incomplete');
    assert.equal(result.native_incomplete?.cause, cause); assert.equal(Object.hasOwn(result, 'actions'), false);
    assert.strictEqual(owner.nativeState(), before);
  });
}

for (const [bound, cap] of Object.entries(SELECTED_RIGID_LIMITS)) test(`source/native ${bound} cannot be enlarged through qualification options`, () => {
  assert.throws(() => selectedRigidLimits({ [bound]: cap + 1 }), /Invalid or enlarged/);
  assert.throws(() => selectedRigidLimits({ [bound]: -1 }), /Invalid or enlarged/);
});

test('missing and expired deadlines abstain, while a missing current action budget raises only after admission', async () => {
  const owner = new NativeSelectedRigid(), rows = raster(), current = await packet(rows, 0);
  assert.equal(await owner.propose(current.observation, rows, inputs, 16), null);
  owner.setCurrentBudget(execution(() => 10, { deadlineMs: 10 }), null);
  assert.equal(await owner.propose(current.observation, rows, inputs, 16), null);
  owner.setCurrentBudget(execution(), null);
  await assert.rejects(() => owner.propose(current.observation, rows, inputs, 16), /Missing current level action budget/);
  assert.equal(await owner.propose(current.observation, rows, inputs, 0), null);
  owner.setCurrentBudget(execution(), 0);
  const result = await owner.propose(current.observation, rows, inputs, 1); proposed(result);
  assert.equal(result.actions.length, 1);
});

test('budget and capture access consume no extra clock readings and restoration preserves ephemeral context', async () => {
  const owner = new NativeSelectedRigid(); let calls = 0;
  const clock = execution(() => calls++), observed: number[] = [], detach = owner.attachClockObserver(value => observed.push(value));
  owner.setCurrentBudget(clock, 9); const first = owner.captureContext(); owner.captureContext();
  assert.equal(calls, 0); assert.equal(first.observedNowMs, null);
  const blank = Array.from({ length: 44 }, () => Array<number>(40).fill(0)), current = await packet(blank, 0);
  assert.equal(await owner.propose(current.observation, blank, inputs, 9), null);
  assert.deepEqual(observed, [0]); assert.equal(calls, 1);
  const context = owner.captureContext(); assert.equal(context.observedNowMs, 0);
  owner.restoreSourceState({ format: 'selected_rigid_events.v1', events: [] });
  owner.restoreNative(owner.nativeState()); assert.deepEqual(owner.captureContext(), context); assert.equal(calls, 1);
  detach(); await owner.propose(current.observation, blank, inputs, 9);
  assert.equal(calls, 2); assert.deepEqual(observed, [0]);
});

test('the actual level action budget takes precedence over a smaller session remainder', async () => {
  const owner = new NativeSelectedRigid(), rows = raster(), current = await packet(rows, 0);
  const result = await owner.propose(current.observation, rows, inputs, 1, execution(() => 0, { remainingLevelActions: 30 })); proposed(result);
  assert.equal(owner.captureContext().remainingLevelActions, 30); assert.equal(result.actions.length, 1);
});

test('a point selection remains hypothetical when the public raster does not change', async () => {
  const value = await selected(), event = value.result.events[0]!;
  assert.equal(event.state.active, 0); assert.equal(event.detail.selection_pixels_changed, false);
  assert.equal(event.detail.role_status, 'selected_receiver_hypothesis'); assert.equal(event.models.length, 24);
  assert.deepEqual(value.owner.after(value.proposal, 0, value.before.observation, value.after.observation, value.rows, value.rows), {
    matched: true, seal_prefix: true, reason: 'rigid_public_projection',
  });
});

test('control ties select the lexicographically last action and displacement retains six hypotheses', async () => {
  const value = await learned(), event = value.result.events[0]!;
  assert.deepEqual(value.proposal.actions, [{ action_ref: 'ACTION4' }]);
  assert.equal(event.detail.prior_model_count, 24); assert.equal(event.detail.compatible_model_count, 6);
  assert.equal(event.detail.role_status, 'observed_exclusive_receiver'); assert.equal(event.detail.moved, true);
  assert.ok(event.models.every(model => JSON.stringify(model.ACTION4) === '[0,1]'));
});

test('known paths obey remaining actions and compare the complete current population at each step', async () => {
  const value = await learned();
  const proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 2, execution()); proposed(proposal);
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION4' }, { action_ref: 'ACTION4' }]);
  assert.equal(proposal.selected_rigid_plan.expected.length, 2); assert.equal(proposal.steps.length, 2);
  assert.equal(Object.hasOwn(proposal.actions[0]!, 'data'), false);
  const rows = raster([0, 2]), next = await packet(rows, 3);
  assert.equal(value.owner.before(proposal, 0, value.after.publicPacket, value.after.observation).admitted, true);
  assert.deepEqual(value.owner.after(proposal, 0, value.after.observation, next.observation, value.rows, rows), {
    matched: true, seal_prefix: false, reason: 'rigid_public_projection',
  });
  assert.equal(value.owner.before(proposal, 1, next.publicPacket, next.observation).admitted, true);
});

test('a mixed known-then-probe prefix does not seal its successful known step just because mode is probe', async () => {
  const value = await learned(1);
  const proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 16, execution()); proposed(proposal);
  assert.equal(proposal.selected_rigid_plan.mode, 'probe'); assert.ok(proposal.actions.length > 1);
  assert.notEqual(proposal.selected_rigid_plan.expected[0], null); assert.equal(proposal.selected_rigid_plan.expected.at(-1), null);
  const rows = raster([0, 2], 1), after = await packet(rows, 3);
  assert.equal(value.owner.after(proposal, 0, value.after.observation, after.observation, value.rows, rows).seal_prefix, false);
});

test('empty data takes the direction branch and cannot silently reaffirm selection', async () => {
  const value = await selected(), proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 16, execution()); proposed(proposal);
  const rows = raster([0, 1]), after = await packet(rows, 2);
  const result = value.owner.record(value.after.observation, after.observation, { action_ref: 'ACTION4', data: {} }, value.rows, rows, proposal);
  assert.ok(result); assert.equal(result.events[0]!.detail.moved, true);
  assert.equal(Object.hasOwn(result.events[0]!.detail, 'selection_pixels_changed'), false);
});

test('epoch changes acquire nothing; a score-only change still acquires the selected source return', async () => {
  const value = await selected(), before = value.owner.nativeState();
  const boundary = { ...value.after.observation, level_epoch: 2, levels_completed: 1 };
  assert.equal(value.owner.record(value.before.observation, boundary, value.proposal.actions[0]!, value.rows, value.rows, value.proposal), null);
  assert.strictEqual(value.owner.nativeState(), before);
  const scoreOnly = { ...value.after.observation, levels_completed: 1 };
  assert.deepEqual(value.owner.after(value.proposal, 0, value.before.observation, scoreOnly, value.rows, value.rows), {
    matched: null, seal_prefix: true, reason: 'boundary',
  });
  assert.ok(value.owner.record(value.before.observation, scoreOnly, value.proposal.actions[0]!, value.rows, value.rows, value.proposal));
  assert.equal(value.owner.sourceState().events.length, 2);
});

test('WIN alone does not change the source after guard when epoch, score and poses are unchanged', async () => {
  const value = await learned(), proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 2, execution()); proposed(proposal);
  const rows = raster([0, 2]), after = await packet(rows, 3, 1, 0, 'WIN');
  assert.deepEqual(value.owner.after(proposal, 0, value.after.observation, after.observation, value.rows, rows), {
    matched: true, seal_prefix: false, reason: 'rigid_public_projection',
  });
});

test('a foreign return and an unselected proposal cannot create a source event', async () => {
  const value = await selected(), before = value.owner.nativeState();
  assert.equal(value.owner.record(value.before.observation, value.after.observation, { action_ref: 'ACTION1' }, value.rows, value.rows, null), null);
  assert.strictEqual(value.owner.nativeState(), before);
  const proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 16, execution()); proposed(proposal);
  assert.strictEqual(value.owner.nativeState(), before);
});

test('point binding needs exactly one current entity and a currently available ACTION6', async () => {
  const rows = raster(), current = await packet(rows, 0), owner = new NativeSelectedRigid();
  const duplicate = { ...current.observation, entities: [...current.observation.entities, ...current.observation.entities] };
  assert.equal(await owner.propose(duplicate, rows, inputs, 16, execution()), null);
  assert.equal(await owner.propose({ ...current.observation, available_action_refs: available.slice(0, 4) }, rows, inputs, 16, execution()), null);
  const incomplete = await owner.propose({ ...current.observation, available_action_refs: ['ACTION1', 'ACTION2', 'ACTION6'] }, rows, inputs, 16, execution());
  assert.ok(incomplete && incomplete.status === 'unknown'); assert.equal(incomplete.reason, 'rigid_direction_domain_incomplete');
});

test('source guards reject altered exact commands and identity but do not claim an extra point/facts guard', async () => {
  const value = await selected(), bad = copy(value.proposal);
  bad.selected_rigid_plan.commands[0] = { action_ref: 'ACTION1' };
  assert.deepEqual(value.owner.before(bad, 0, value.before.publicPacket, value.before.observation), {
    admitted: false, reason: 'selected_rigid_exact_binding_changed',
  });
  const id = copy(value.proposal); id.proposal_id += 'changed';
  assert.equal(value.owner.before(id, 0, value.before.publicPacket, value.before.observation).admitted, false);
  const outsidePlan = copy(value.proposal) as any;
  outsidePlan.steps[0].point_binding.point = [0, 0]; outsidePlan.steps[0].expected_after = 'not-consumed';
  outsidePlan.facts.current_full_masks_measured = false;
  assert.equal(value.owner.before(outsidePlan, 0, value.before.publicPacket, value.before.observation).admitted, true);
});

test('before uses the freshly supplied deadline and rejects an invalid action index', async () => {
  const value = await selected();
  value.owner.setCurrentBudget(execution(() => 10, { deadlineMs: 10 }), 10);
  assert.deepEqual(value.owner.before(value.proposal, 0, value.before.publicPacket, value.before.observation), { admitted: false, reason: 'level_deadline' });
  value.owner.setCurrentBudget(execution(), 10);
  for (const index of [-1, 0.5, 1]) assert.equal(value.owner.before(value.proposal, index, value.before.publicPacket, value.before.observation).admitted, false);
});

test('retained empty controls survive epoch changes and the stop reason clears on the next proposal attempt', async () => {
  const value = await learned(), saved = value.owner.sourceState(); saved.events.at(-1)!.models = [];
  value.owner.restoreSourceState(saved);
  const later = { ...value.after.observation, level_epoch: 2 };
  const result = await value.owner.propose(later, value.rows, inputs, 16, execution());
  assert.ok(result && result.status === 'unknown'); assert.equal(result.reason, 'rigid_control_or_collision_model_refuted');
  assert.equal(value.owner.captureContext().requestedStopReason, result.reason);
  const blank = Array.from({ length: 44 }, () => Array<number>(40).fill(0));
  assert.equal(await value.owner.propose(later, blank, inputs, 16, execution()), null);
  assert.equal(value.owner.captureContext().requestedStopReason, null);
  assert.deepEqual(value.owner.sourceState(), saved);
});

test('actual native/source restores reconstruct the last event without retaining stale models or sharing mutable inputs', async () => {
  const value = await learned(), source = value.owner.sourceState(), snapshot = value.owner.state(), restored = new NativeSelectedRigid();
  restored.restoreNative(snapshot); assert.deepEqual(restored.sourceState(), source); assert.equal(restored.retainedDigest(), value.owner.retainedDigest());
  snapshot.events.length = 0; assert.deepEqual(restored.sourceState(), source);
  const first = restored.nativeState(); restored.restoreNative(first); assert.strictEqual(restored.nativeState(), first);
  restored.restoreNative(copy(first)); assert.equal(deeplyFrozen(restored.nativeState()), true); assert.deepEqual(restored.sourceState(), source);
  const exported = restored.sourceState(); exported.events.at(-1)!.state.evidence.length = 0;
  assert.deepEqual(restored.sourceState(), source);
  restored.setCurrentBudget(execution(), 10);
  const proposal = await restored.propose(value.after.observation, value.rows, inputs, 2); proposed(proposal);
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION4' }, { action_ref: 'ACTION4' }]);
  const context = restored.captureContext(); restored.restoreSourceState({ format: 'selected_rigid_events.v1', events: [] });
  assert.equal(restored.hasRetainedEvents(), false); assert.deepEqual(restored.captureContext(), context);
  assert.equal(restored.retainedDigest(), symbolicDigest(['isolated-selected-rigid-v1', null, null, []]));
});

test('acquisition owns its event while earlier snapshots and returned mutable events remain independent', async () => {
  const value = await selected(), before = value.owner.nativeState(), saved = copy(before);
  const proposal = await value.owner.propose(value.after.observation, value.rows, inputs, 16, execution()); proposed(proposal);
  const rows = raster([0, 1]), after = await packet(rows, 2);
  const result = value.owner.record(value.after.observation, after.observation, proposal.actions[0]!, value.rows, rows, proposal); assert.ok(result);
  const current = value.owner.sourceState(); result.events[0]!.models.length = 0; result.events[0]!.state.evidence.length = 0;
  assert.deepEqual(value.owner.sourceState(), current); assert.deepEqual(before, saved); assert.notStrictEqual(value.owner.nativeState(), before);
});

const corruptions: [string, (value: any) => void][] = [
  ['schema', value => { value.schema = 'native.selected_rigid.v0'; }],
  ['format', value => { value.format = 'selected_rigid_events.v0'; }],
  ['missing events', value => { delete value.events; }],
  ['invented cached source field', value => { value.rigid_models = []; }],
  ['foreign owner event', value => { value.events[0].kind = 'observed_preview_packing'; }],
  ['duplicate full-mask cell', value => { value.events[0].state.scene.bodies[0].mask.push([0, 0]); }],
  ['unknown control direction', value => { value.events[0].models[0].ACTION1 = [2, 0]; }],
  ['nonnumeric epoch', value => { value.events[0].state.epoch = 'old'; }],
  ['invented role status', value => { value.events[0].detail.role_status = 'terminal_law'; }],
];
for (const [label, corrupt] of corruptions) test(`native ingress rejects ${label} atomically without claiming Python has the same validation`, async () => {
  const value = await selected(), before = value.owner.nativeState(), candidate = value.owner.state(); corrupt(candidate);
  assert.throws(() => value.owner.restoreNative(candidate)); assert.strictEqual(value.owner.nativeState(), before);
});

test('restoration does not execute foreign getters, accept cyclic state or transport runtime budgets', async () => {
  const value = await selected(), before = value.owner.nativeState(), candidate: NativeRecord = value.owner.state(); let getterCalls = 0;
  Object.defineProperty(candidate, 'events', { enumerable: true, get() { getterCalls++; return []; } });
  assert.throws(() => value.owner.restoreNative(candidate), /enumerable data properties/); assert.equal(getterCalls, 0);
  const cyclic: any = value.owner.state(); cyclic.events.push(cyclic);
  assert.throws(() => value.owner.restoreNative(cyclic), /Cyclic/);
  assert.throws(() => value.owner.restoreSourceState({ ...value.owner.sourceState(), level_deadline: 10 }), /fields/);
  assert.strictEqual(value.owner.nativeState(), before);
});

test('an aborted proposal and a zero source search budget preserve the complete acquired memory', async () => {
  const value = await learned(), before = value.owner.nativeState(), controller = new AbortController(); controller.abort();
  const stopped = await value.owner.propose(value.after.observation, value.rows, inputs, 16, execution(() => 0, { signal: controller.signal }));
  assert.ok(stopped && stopped.status === 'unknown'); assert.equal(stopped.native_incomplete?.cause, 'aborted');
  assert.strictEqual(value.owner.nativeState(), before);
  for (const limits of [{ nodeBound: 0 }, { timeBoundMs: 0 }]) {
    const owner = new NativeSelectedRigid({ limits }); owner.restoreSourceState(value.owner.sourceState() as SelectedRigidSourceState);
    const retained = owner.nativeState(), result = await owner.propose(value.after.observation, value.rows, inputs, 16, execution());
    assert.ok(result && result.status === 'unknown'); assert.equal(result.reason, 'rigid_conditional_configuration_search_incomplete');
    assert.equal(Object.hasOwn(result, 'actions'), false); assert.strictEqual(owner.nativeState(), retained);
  }
});
