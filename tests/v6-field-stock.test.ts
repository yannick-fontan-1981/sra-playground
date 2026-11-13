import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldStock, fieldStockAnchor, fieldStockFeature, type FieldStockBody } from '../src/logos-engine/v6-field-stock.ts';
import { AddressedWork, AddressedWorkBound } from '../src/logos-engine/v6-addressed-material-common.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
type Mark = readonly [x: number, y: number, palette: number, side?: number];
const mask = (width: number, height = width) => Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, y) => [x, y])).flat();
const template = (aligned = true) => ({ size: [1, 1], offset: [0, 0], mask: [[0, 0]], alignment_supported: aligned });
const retainedRule = (product: number) => ({ consumed_count: 2, product, produced_count: 1, confirmations: 2,
  prior_evidence: [], evidence: ['synthetic:past:1', 'synthetic:past:2'] });

/** Component tests explicitly supply a synthetic prior. They do not claim
 * cold field acquisition or an official successful game boundary. The separate
 * source oracle owns those complete acquisition chains. */
function prior(patch: R = {}): R {
  return { action_ref: 'ACTION6', lower_squared: 4, upper_squared: 9, request_row: 2,
    goal_region: { size: [3, 3], envelope: mask(3) }, class_templates: { '8': template() },
    qualification: 'synthetic component prior supplied explicitly', ...patch };
}
function rowsFor(marks: readonly Mark[], requestOrder: readonly number[] = [3, 6]): number[][] {
  const rows = Array.from({ length: 20 }, () => Array(30).fill(0));
  const paint = (x: number, y: number, side: number, palette: number) => {
    for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) rows[y + dy]![x + dx] = palette;
  };
  paint(2, 1, 2, 8); paint(6, 1, 2, 3); paint(10, 1, 2, 6);
  rows[2]![20] = requestOrder[0]!; rows[2]![24] = requestOrder[1]!;
  for (let y = 12; y <= 14; y++) for (let x = 20; x <= 22; x++) if (x === 20 || x === 22 || y === 12 || y === 14) rows[y]![x] = 9;
  for (const [x, y, palette, side = 1] of marks) paint(x, y, side, palette);
  return rows;
}
async function packet(marks: readonly Mark[] = [[2, 10, 8], [4, 10, 8]], revision = 0, requestOrder: readonly number[] = [3, 6]) {
  const rows = rowsFor(marks, requestOrder), frame_hash = await publicFrameHash(rows);
  const publicPacket = { frame_rows: rows, frame_packet: [rows], level: 2, levels_completed: 1, state: 'NOT_FINISHED',
    step_index: revision, available_action_refs: ['ACTION6'], frame_hash };
  const observation = await measureNativeObservation(publicPacket, revision, 'synthetic:field-stock-component');
  return { rows, observation, publicPacket };
}
async function component(marks?: readonly Mark[], patch: R = {}, requestOrder: readonly number[] = [3, 6]) {
  const current = await packet(marks, 0, requestOrder), hypothesis = prior(patch), stock = FieldStock.create(hypothesis, current.observation, current.rows);
  assert.ok(stock); return { stock, current, hypothesis };
}
function fusionPlan(stock: FieldStock, current: Awaited<ReturnType<typeof packet>>, point = [3, 12]): R {
  const bodies = stock.bodies(current.rows), selected = bodies.flatMap((body, index) => body.palette === 8 ? [index] : []);
  assert.equal(selected.length, 2);
  return { field_plan: { stock: true }, binding: { observation_ref: current.observation.observation_ref, level_epoch: 2, levels_completed: 1 },
    steps: [{ before_bodies: bodies, offer: { kind: 'fuse', selected, point, product: 3, known: false, purpose: 'Synthetic component question.' }, expected_after: null }] };
}

test('stock creation binds measured ladder, requests and filled zones and declines incomplete priors', async () => {
  const { stock, current, hypothesis } = await component(), state = stock.sourceState();
  assert.deepEqual(state.order, [8, 3, 6]); assert.deepEqual(state.demands, [[3, 1], [6, 1]]);
  assert.equal(state.requests.length, 2); assert.equal(state.interface_boxes.length, 5);
  assert.deepEqual(state.zones, [{ bbox: [20, 12, 22, 14], point: [21, 13], source_ref: current.observation.observation_ref }]);
  assert.deepEqual(stock.bodies(current.rows).map(fieldStockFeature), [[8, [2, 10, 2, 10]], [8, [4, 10, 4, 10]]]);
  assert.equal(FieldStock.create({ ...hypothesis, upper_squared: null }, current.observation, current.rows), null);
  assert.equal(FieldStock.create({ ...hypothesis, goal_region: null }, current.observation, current.rows), null);
  assert.equal(FieldStock.create(hypothesis, { ...current.observation, entities: [] }, current.rows), null);
  assert.deepEqual(FieldStock.fromState(stock.state()).sourceState(), state);
});

test('retained rewrites preserve insertion order and require two new current confirmations', async () => {
  const observedRules = [[8, retainedRule(6)], [3, retainedRule(6)]];
  const { stock, current } = await component(undefined, { observed_rules: observedRules, type_order: [8, 3, 6] });
  const state = stock.sourceState();
  assert.deepEqual(state.rules.map(([symbol]: [number, R]) => symbol), [8, 3]);
  for (const [, rule] of state.rules) { assert.equal(rule.confirmations, 0); assert.deepEqual(rule.evidence, []); assert.deepEqual(rule.prior_evidence, ['synthetic:past:1', 'synthetic:past:2']); }
  assert.equal(stock.offer(current.rows, stock.bodies(current.rows))!.known, false);
  assert.deepEqual(state.prior.observed_rules, observedRules);
  const hypotheses = stock.retainedHypotheses('synthetic:boundary'), publicResult = stock.retained('synthetic:boundary');
  assert.deepEqual(hypotheses.observed_rules.map(([symbol]: [number, R]) => symbol), [8, 3]);
  assert.equal(Array.isArray(publicResult.observed_rules), false); assert.equal(publicResult.observed_rules['8'].product, 6);
  const next = FieldStock.create(hypotheses, current.observation, current.rows)!;
  assert.deepEqual(next.sourceState().rules.map(([symbol]: [number, R]) => symbol), [8, 3]);
  assert.deepEqual(FieldStock.fromState(next.state()).sourceState(), next.sourceState());
});

test('source projection distinguishes string-key synthetic rules and integer-key retained rules', async () => {
  const { stock } = await component(undefined, { observed_rules: { '8': retainedRule(3) }, type_order: [8, 3, 6] });
  assert.equal(stock.sourceState().prior.observed_rules[0][0], '8');
  assert.equal(stock.sourceState().rules[0][0], 8);
  assert.deepEqual(FieldStock.fromState(stock.state()).sourceState(), stock.sourceState());
  const { stock: empty } = await component(undefined, { observed_rules: {}, type_order: [8, 3, 6] });
  assert.deepEqual(empty.sourceState().prior.observed_rules, []);
});

test('allocation reserves delivered types and acquired preservation minimums never decrease', async () => {
  const { stock, current } = await component([[10, 10, 3], [21, 13, 6]], {}, [6, 3]);
  const bodies = stock.bodies(current.rows), [remaining, free, reserved, ready] = stock.allocations(bodies);
  assert.deepEqual(remaining, { '3': 1, '6': 0 }); assert.deepEqual(free, []);
  assert.deepEqual(ready, [0]); assert.deepEqual(reserved, [0, 1]);
  assert.deepEqual(stock.sourceState().demands, [[6, 1], [3, 1]]);
  const obligations = stock.preservationObligations(current.observation, current.rows);
  assert.deepEqual(obligations.map(item => item.entity_predicate.palette_value), [6, 3]);
  assert.deepEqual(stock.sourceState().minimums, [[6, 1], [3, 1]]);
  const saved = stock.nativeState(), revision = stock.revision, absent = await packet([], 1, [6, 3]);
  assert.deepEqual(stock.preservationObligations(absent.observation, absent.rows).map(item => item.entity_predicate.minimum_count), [1, 1]);
  assert.equal(stock.revision, revision); assert.equal(stock.nativeState(), saved);
});

test('zero minimum entries are retained and a pure repeated question reuses its checkpoint', async () => {
  const { stock, current } = await component([[14, 10, 6]]);
  const initial = stock.nativeState(); stock.preservationObligations(current.observation, current.rows);
  const acquired = stock.nativeState(); assert.notEqual(acquired, initial);
  assert.deepEqual(acquired.source.minimums, [[3, 0], [6, 1]]);
  assert.equal(acquired.source.requests, initial.source.requests); assert.equal(acquired.source.prior, initial.source.prior);
  stock.preservationObligations(current.observation, current.rows); assert.equal(stock.nativeState(), acquired);
  const external = stock.state(); external.source.minimums[0][1] = 99; external.source.requests[0].bbox[0] = 29;
  assert.equal(stock.nativeState(), acquired); assert.equal(stock.sourceState().minimums[0][1], 0);
});

test('unknown rewrites close their prefix and known movement composes guarded addresses', async () => {
  const { stock, current } = await component(), question = await stock.propose(current.observation, current.rows, 16);
  assert.ok(question); assert.equal(question.kind, 'typed_field_stock'); assert.equal(question.steps.length, 1);
  assert.equal(question.steps[0].offer.kind, 'fuse'); assert.equal(question.steps[0].expected_after, null);
  assert.equal(question.facts.unknown_rewrite_closes_prefix, true);
  assert.equal(Array.isArray(question.field_plan.demands), false); assert.deepEqual(question.field_plan.demands, { '3': 1, '6': 1 });
  const moving = await component([[4, 10, 3]], { class_templates: { '8': template(), '3': template() } });
  const proposal = await moving.stock.propose(moving.current.observation, moving.current.rows, 16); assert.ok(proposal);
  assert.ok(proposal.actions.length > 1 && proposal.actions.length <= 16);
  assert.equal(proposal.steps[0].expected_before.frame_hash, moving.current.observation.frame_hash);
  assert.equal(proposal.steps[1].expected_before.frame_hash, null);
  assert.equal(moving.stock.before(proposal, 0, moving.current.publicPacket, moving.current.observation).admitted, true);
  assert.equal(moving.stock.before(proposal, 0, moving.current.publicPacket, { ...moving.current.observation, observation_ref: 'stale' }).admitted, false);
  const first = proposal.actions[0].data, after = await packet([[first.x, first.y, 3]], 1);
  assert.deepEqual(moving.stock.after(proposal, 0, moving.current.observation, after.observation, moving.current.rows, after.rows),
    { matched: true, seal_prefix: proposal.steps.length === 1, reason: 'compare_stable_material_stock' });
  assert.deepEqual(moving.stock.after(proposal, 0, moving.current.observation, { ...after.observation, levels_completed: 2 }, moving.current.rows, after.rows),
    { matched: null, seal_prefix: true, reason: 'official_boundary' });
  proposal.bundle_template.frozen_field_plan.steps[0].offer.point[0] = 99;
  assert.notEqual(proposal.steps[0].offer.point[0], 99);
});

test('current public records revalidate a rewrite and preserve source mutation order on contradiction', async () => {
  const { stock, current } = await component(undefined, { observed_rules: [[8, retainedRule(6)]], type_order: [8, 3, 6] });
  const first = await packet([[3, 12, 3]], 1);
  const acquired = stock.record(current.observation, first.observation, { action_ref: 'ACTION6', data: { x: 3, y: 12 } }, current.rows, first.rows);
  assert.deepEqual(acquired.events.map((event: R) => event.kind), ['recalled_rewrite_refuted', 'observed_joint_material_rewrite']);
  assert.equal(acquired.events[1].conserved_pixel_identity_claimed, false); assert.equal(acquired.events[1].joint_origins.length, 2);
  assert.equal(stock.sourceState().rules[0][1].confirmations, 1); assert.equal(stock.sourceState().templates['3'].alignment_supported, false);
  const secondBefore = await packet([[3, 12, 3], [8, 10, 8], [10, 10, 8]], 2), secondAfter = await packet([[3, 12, 3], [9, 12, 3]], 3);
  stock.record(secondBefore.observation, secondAfter.observation, { action_ref: 'ACTION6', data: { x: 9, y: 12 } }, secondBefore.rows, secondAfter.rows);
  assert.equal(stock.sourceState().rules[0][1].confirmations, 2);
  assert.equal(stock.offer(current.rows, stock.bodies(current.rows))!.known, true);
  const thirdBefore = await packet([[3, 12, 3], [9, 12, 3], [12, 10, 8], [14, 10, 8]], 4), thirdAfter = await packet([[3, 12, 3], [9, 12, 3], [13, 12, 6]], 5);
  const refusal = stock.record(thirdBefore.observation, thirdAfter.observation, { action_ref: 'ACTION6', data: { x: 13, y: 12 } }, thirdBefore.rows, thirdAfter.rows);
  assert.equal(refusal.status, 'material_rewrite_refuted'); assert.equal(refusal.events[0].reason, 'observed_rewrite_context_changed');
  const state = stock.sourceState(); assert.deepEqual(state.events, []); assert.ok(state.templates['6']);
  assert.ok(state.lineages.some(([feature]: [any, string[]]) => feature[0] === 6));
  assert.equal(state.rules[0][1].product, 3); assert.equal(state.rules[0][1].confirmations, 2);
  assert.deepEqual((await stock.propose(thirdAfter.observation, thirdAfter.rows, 16))!.actions, []);
  assert.deepEqual(FieldStock.fromState(stock.state()).sourceState(), state);
});

test('unknown guards preserve unselected stock and an acquired loss returns a recognized refusal', async () => {
  const { stock, current } = await component([[2, 10, 8], [4, 10, 8], [14, 10, 6]]), plan = fusionPlan(stock, current);
  const preserved = await packet([[3, 12, 3], [14, 10, 6]], 1), lost = await packet([[3, 12, 3]], 2);
  assert.deepEqual(stock.after(plan, 0, current.observation, preserved.observation, current.rows, preserved.rows),
    { matched: null, seal_prefix: true, reason: 'compare_stable_material_stock' });
  assert.equal(stock.after(plan, 0, current.observation, lost.observation, current.rows, lost.rows).matched, false);
  const result = stock.record(current.observation, lost.observation, { action_ref: 'ACTION6', data: { x: 3, y: 12 } }, current.rows, lost.rows, plan, 0);
  assert.equal(result.status, 'field_preservation_prediction_refuted'); assert.equal(result.events.length, 1);
  assert.deepEqual(stock.sourceState().events, []);
  const refusal = await stock.propose(lost.observation, lost.rows, 16); assert.equal(refusal!.status, 'typed_field_applicability_refuted'); assert.deepEqual(refusal!.actions, []);
});

test('a no-response fuse excludes only the acquired parent pair and locus after restoration', async () => {
  const { stock, current } = await component(), firstOffer = stock.offer(current.rows, stock.bodies(current.rows))!;
  const plan = fusionPlan(stock, current, [...firstOffer.point]);
  const result = stock.record(current.observation, current.observation, { action_ref: 'ACTION6', data: { x: firstOffer.point[0], y: firstOffer.point[1] } }, current.rows, current.rows, plan, 0);
  assert.equal(result.events[0].kind, 'material_response_unresolved'); assert.equal(stock.sourceState().failures.length, 1);
  const restored = FieldStock.fromState(stock.state()), next = stock.offer(current.rows, stock.bodies(current.rows)); assert.ok(next);
  assert.notDeepEqual(next.point, firstOffer.point);
  assert.deepEqual(restored.offer(current.rows, restored.bodies(current.rows)), next);
  assert.deepEqual(restored.sourceState(), stock.sourceState());
});

test('a one-body relocation acquires its anchor and lineage without a pixel-identity claim', async () => {
  const { stock, current } = await component([[4, 10, 3]]), after = await packet([[6, 11, 3]], 1);
  const result = stock.record(current.observation, after.observation, { action_ref: 'ACTION6', data: { x: 6, y: 11 } }, current.rows, after.rows);
  assert.equal(result.events[0].kind, 'typed_material_relocated_to_address'); assert.equal(result.events[0].conserved_pixel_identity_claimed, false);
  assert.equal(stock.sourceState().templates['3'].alignment_supported, true);
  const body = stock.bodies(after.rows)[0]!; assert.deepEqual(fieldStockAnchor(body), [6, 11]); assert.equal(body.origins.length, 1);
  assert.equal(stock.offer(after.rows, [body])!.known, true);
  assert.deepEqual(FieldStock.fromState(stock.state()).bodies(after.rows), [body]);
});

test('malformed checkpoints fail atomically before changing acquired stock', async () => {
  const { stock, current } = await component(), after = await packet([[3, 12, 3]], 1);
  stock.record(current.observation, after.observation, { action_ref: 'ACTION6', data: { x: 3, y: 12 } }, current.rows, after.rows);
  stock.preservationObligations(after.observation, after.rows);
  const baseline = stock.state(), identity = stock.nativeState(), revision = stock.revision;
  const edits: ((state: R) => void)[] = [
    state => { state.schema = 'wrong'; }, state => { delete state.source.events; }, state => { state.source.order.push(8); },
    state => { state.source.demands[0][1] = 2; }, state => { state.source.zones[0].point = [0, 0]; },
    state => { state.source.interface_boxes[0][2]++; }, state => { state.source.lower++; },
    state => { state.source.templates['3'].mask[0] = [1, 0]; }, state => { state.source.rules[0][1].confirmations = 9; },
    state => { state.source.minimums[0][1] = 2; }, state => { state.source.motion_types.push(3); },
    state => { state.source.lineages[0][1].push(state.source.lineages[0][1][0]); },
    state => { state.source.failures = [[[8, [2, 10, 2, 10]], [3, [4, 10, 4, 10]], [3, 10]]]; },
    state => { state.source.events[0].conserved_pixel_identity_claimed = true; },
    state => { state.source.invalid = { reason: 'invented', before: 'a', after: 'b' }; },
  ];
  for (const edit of edits) {
    const malformed = structuredClone(baseline); edit(malformed); assert.throws(() => stock.restore(malformed));
    assert.deepEqual(stock.state(), baseline); assert.equal(stock.nativeState(), identity); assert.equal(stock.revision, revision);
  }
  const shallow = Object.freeze({ ...baseline, source: { ...baseline.source, upper: Infinity } });
  assert.throws(() => stock.restore(shallow)); assert.equal(stock.nativeState(), identity);
});

test('cooperative exhaustion stays incomplete and never acquires a material refutation', async () => {
  const { stock, current } = await component(), before = stock.sourceState();
  await assert.rejects(stock.propose(current.observation, current.rows, 16, new AddressedWork({ maximumNodes: 0 })), AddressedWorkBound);
  assert.deepEqual(stock.sourceState(), before);
  assert.throws(() => stock.preservationObligations(current.observation, current.rows, new AddressedWork({ maximumWork: 0 })), AddressedWorkBound);
  assert.deepEqual(stock.sourceState(), before); assert.equal(stock.sourceState().invalid, null);
  const controller = new AbortController(); controller.abort();
  assert.throws(() => new AddressedWork({}, { signal: controller.signal, yieldControl: async () => {} }), AddressedWorkBound);
  assert.throws(() => new AddressedWork({}, { now: () => 10, deadlineMs: 10, yieldControl: async () => {} }), AddressedWorkBound);
  assert.deepEqual(stock.sourceState(), before);
});

test('unavailable action declines but a recognized inaccessible stock keeps its source refusal', async () => {
  const { stock, current } = await component([]);
  assert.equal(await stock.propose({ ...current.observation, available_action_refs: [] }, current.rows, 16), null);
  assert.deepEqual(await stock.propose(current.observation, current.rows, 16), { status: 'typed_material_access_or_rewrite_unresolved', actions: [] });
  const before = stock.sourceState(), result = stock.record(current.observation, current.observation, { action_ref: 'ACTION1', data: {} }, current.rows, current.rows);
  assert.deepEqual(result, { status: 'material_transition_unaddressed', events: [] }); assert.deepEqual(stock.sourceState(), before);
});
