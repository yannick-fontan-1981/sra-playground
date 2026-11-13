import test from 'node:test';
import assert from 'node:assert/strict';
import { measureOutlineAccessArrival } from '../src/logos-engine/v6-outline-arrival.ts';
import { measureOutlineAnnouncedAccess } from '../src/logos-engine/v6-outline-access.ts';
import { outlineBoxes } from '../src/logos-engine/v6-outline-geometry.ts';
import { makeOutlinePublicTransition } from '../src/logos-engine/v6-outline-public-context.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const GOAL = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter';

/** Synthetic component contracts only. These frames exercise provenance and
 * geometry; they are not a simulated game or evidence of any local effect. */
async function sample(options: { shift?: readonly [number, number]; width?: number; height?: number; palette?: readonly number[]; left?: string; local?: string } = {}) {
  const [sx, sy] = options.shift ?? [0, 0], width = options.width ?? 4, height = options.height ?? 4;
  const [background, control, body, changed] = options.palette ?? [0, 2, 7, 9];
  const left = options.left ?? 'MOVE_L', local = options.local ?? 'LOCAL_TEST';
  const x = 16 + sx, y = 12 + sy, target = [x, y, x + width - 1, y + height - 1];
  const oldLead = target.map((value, index) => value + (index % 2 === 0 ? width : 0));
  const seedLead = target.map((value, index) => value + (index % 2 === 0 ? 2 * width : 0));
  const directions = [['MOVE_U', -1, 0], ['MOVE_D', 1, 0], [left, 0, -1], ['MOVE_R', 0, 1]];
  const available = [...directions.map(entry => entry[0]), local];
  const ring = (rows: number[][], box: number[], value: number) => {
    for (let row = box[1]; row <= box[3]; row++) for (let col = box[0]; col <= box[2]; col++) {
      if (row === box[1] || row === box[3] || col === box[0] || col === box[2]) rows[row][col] = value;
    }
  };
  const scene = (lead: number[], marker = false, changeInset = false) => {
    const rows = Array.from({ length: 56 }, () => Array(64).fill(background));
    for (let row = y + 1; row < y + height; row++) for (let col = x + 1; col < x + width; col++) rows[row][col] = body;
    ring(rows, [x + 4 * width, y, x + 5 * width - 1, y + height - 1], body);
    if (marker) rows[y + 1][x + width + 1] = body;
    ring(rows, lead, control);
    if (changeInset) rows[y + height - 2][x + width - 2] = changed;
    return rows;
  };
  const observation = (rows: number[][], revision: number) => ({ observation_ref: `synthetic:public:${revision}`,
    level_epoch: 2, levels_completed: 1, revision, frame_hash: symbolicDigest(rows).slice(0, 16) });
  const fieldsFor = async (rows: number[][], lead: number[], revision: number): Promise<R> => {
    const outline = (await outlineBoxes(rows)).find(value => value.bbox.every((coordinate, index) => coordinate === lead[index]));
    assert.ok(outline);
    return { available_action_refs: available, canonical_provisional_control_term_facts: [{ entity_ref: outline.component_ref }],
      canonical_provisional_control_geometry_bboxes: [lead], current_action_conditioned_control_outline_bboxes: [lead],
      known_action_translation_deltas: [[left, 0, -width]], interface_action_translation_deltas: directions,
      current_control_reacquired: true, current_observation_ref: `synthetic:public:${revision}`,
      current_level_epoch: 2, current_revision: revision,
      current_control_evidence_refs: [`synthetic:public:${revision - 1}`, `synthetic:public:${revision}`], interface_local_action_ref: local };
  };
  const selected = (access: R, before: R) => ({ proposal_ref: `synthetic:actually-selected:${before.revision}`,
    meaning_kind: access.kind === 'current_announced_cell_access_question' ? 'native_current_announced_access_hypothesis' : 'native_current_observed_body_access_hypothesis',
    active_goal_ref: GOAL, active_terminal_goal_ref: GOAL, observation_ref: before.observation_ref,
    level_epoch: before.level_epoch, frame_hash: before.frame_hash, action_index: 0,
    command: { action_ref: access.action_ref, data: {} }, guard_admitted: true,
    access_relation: access, access_relation_ref: `outline_access:${symbolicDigest(access)}` });
  const seed = scene(seedLead, true), beforeRows = scene(oldLead), rows = scene(target, false, true);
  const seedObs = observation(seed, 1), beforeObs = observation(beforeRows, 2), afterObs = observation(rows, 3);
  const initial = await measureOutlineAnnouncedAccess(seed, await fieldsFor(seed, seedLead, 1)) as R;
  assert.ok(initial); assert.equal(initial.kind, 'current_announced_cell_access_question');
  const firstContext = makeOutlinePublicTransition(seedObs as any, beforeObs as any, { action_ref: left, data: {} },
    seed, beforeRows, { epoch: 2 }, selected(initial, seedObs));
  const accessFields = { ...await fieldsFor(beforeRows, oldLead, 2), previous_action_observed_frame: seed, previous_public_transition: firstContext };
  const access = await measureOutlineAnnouncedAccess(beforeRows, accessFields) as R;
  assert.ok(access); assert.equal(access.kind, 'current_observed_body_access_question');
  assert.deepEqual(access.expected_body_bbox, target); assert.equal(access.distance_after, 0);
  const context = makeOutlinePublicTransition(beforeObs as any, afterObs as any, { action_ref: left, data: {} },
    beforeRows, rows, { epoch: 2 }, selected(access, beforeObs));
  const fields = { ...await fieldsFor(rows, target, 3), previous_action_observed_frame: beforeRows, previous_public_transition: context };
  const changedRows = async (next: number[][]) => {
    const altered = structuredClone(fields);
    Object.assign(altered, await fieldsFor(next, target, 3));
    altered.previous_public_transition.after_rows_sha256 = symbolicDigest(next);
    altered.previous_public_transition.after.frame_hash = symbolicDigest(next).slice(0, 16);
    return altered;
  };
  return { rows, fields, beforeRows, access, target, oldLead, width, height, x, y, background, control, body, changed, local, left, scene, ring, changedRows };
}

test('selected observed-body access arrival measures only the visible changed inset and one conditional candidate', async () => {
  const input = await sample(), kept = structuredClone({ rows: input.rows, fields: input.fields });
  const witness = await measureOutlineAccessArrival(input.rows, input.fields) as R;
  assert.ok(witness);
  assert.equal(witness.kind, 'current_observed_body_arrival_local_question'); assert.equal(witness.action_ref, input.local);
  assert.deepEqual(witness.current_control_bbox, input.target); assert.deepEqual(witness.actual_control_delta_xy, [-input.width, 0]);
  assert.equal(witness.current_visible_same_value_count, 3); assert.equal(witness.changed_inset_count, 1);
  assert.equal(witness.prior_body_pixels_now_covered_by_outline_row_column.length, 5);
  assert.equal(witness.complete_current_body, null); assert.equal(witness.body_survival_established, false);
  assert.equal(witness.current_body_identity_established, false); assert.equal(witness.action_effect_known, false);
  assert.equal(witness.operator_effect_basis, 'unbound_conditional_candidate'); assert.equal(witness.release_authority, false);
  assert.equal(witness.primitive_bound, 1); assert.equal(witness.replan_after_each_primitive, true);
  assert.equal(witness.source_principle.exact_source_projection_matched, false);
  assert.ok(witness.pending_service_gates.includes('historical_local_method_revalidation'));
  assert.ok(witness.pending_service_gates.includes('actual_untried_current_caller_trial'));
  assert.deepEqual({ rows: input.rows, fields: input.fields }, kept);
});

test('arrival geometry is independent of palette, translation, action spelling and square quantum', async () => {
  const input = await sample({ shift: [3, 2], width: 5, height: 3, palette: [11, 19, 23, 31], left: 'toward-west', local: 'test-current-contact' });
  const witness = await measureOutlineAccessArrival(input.rows, input.fields) as R;
  assert.ok(witness); assert.equal(witness.action_ref, 'test-current-contact');
  assert.deepEqual(witness.reached_prior_body_cell_bbox, input.target);
  assert.deepEqual(witness.actual_control_delta_xy, [-5, 0]); assert.equal(witness.current_visible_same_value_count, 2);
  assert.equal(witness.changed_inset_count, 1);
});

test('arrival requires actual selected access, current scope, reacquired control and declared available local input', async () => {
  const input = await sample();
  const mutations: [string, (fields: R) => void][] = [
    ['unacquired control', fields => { fields.current_control_reacquired = false; }],
    ['missing actual before evidence', fields => { fields.current_control_evidence_refs = [fields.current_observation_ref]; }],
    ['different epoch', fields => { fields.current_level_epoch++; }],
    ['nonadjacent revision', fields => { fields.previous_public_transition.before.revision--; }],
    ['stale current rows', fields => { fields.previous_public_transition.after_rows_sha256 = '0'.repeat(64); }],
    ['unselected proposal', fields => { fields.previous_public_transition.selected_outline = null; }],
    ['unguarded proposal', fields => { fields.previous_public_transition.selected_outline.guard_admitted = false; }],
    ['unowned goal', fields => { fields.previous_public_transition.selected_outline.active_goal_ref = 'another-goal'; }],
    ['different actual command', fields => { fields.previous_public_transition.command.action_ref = 'MOVE_R'; }],
    ['different command payload', fields => { fields.previous_public_transition.selected_outline.command.data = { extra: 1 }; }],
    ['stale access digest', fields => { fields.previous_public_transition.selected_outline.access_relation_ref = 'outline_access:stale'; }],
    ['missing local prior', fields => { delete fields.interface_local_action_ref; }],
    ['directional local prior', fields => { fields.interface_local_action_ref = input.left; }],
    ['unavailable local prior', fields => { fields.available_action_refs = fields.available_action_refs.filter(value => value !== input.local); }],
    ['declared checkpoint prior', fields => { fields.level_start_checkpoint_action_ref = input.local; }],
    ['declared point prior', fields => { fields.interface_point_action_ref = input.local; }],
  ];
  for (const [name, mutate] of mutations) {
    const fields = structuredClone(input.fields); mutate(fields);
    assert.equal(await measureOutlineAccessArrival(input.rows, fields), null, name);
  }
});

test('a recomputed retained digest cannot substitute another body, target or displacement', async () => {
  const input = await sample();
  const mutations: [string, (access: R) => void][] = [
    ['target differs', access => { access.target_cell_bbox[0]--; }],
    ['body cell differs', access => { access.body_cell_bbox[1]--; }],
    ['prediction differs', access => { access.expected_body_bbox[2]++; }],
    ['delta differs', access => { access.expected_delta[0]--; }],
    ['target not reached', access => { access.distance_after = 1; }],
    ['prior body pixels forged', access => { access.relation.compact_body.pixels_sha256 = '0'.repeat(64); }],
    ['prior control forged', access => { access.relation.controlled_outline.value++; }],
    ['absent marker reconstructed', access => { access.relation.cardinal_marker = { value: input.body }; }],
  ];
  for (const [name, mutate] of mutations) {
    const fields = structuredClone(input.fields), selected = fields.previous_public_transition.selected_outline;
    mutate(selected.access_relation); selected.access_relation_ref = `outline_access:${symbolicDigest(selected.access_relation)}`;
    assert.equal(await measureOutlineAccessArrival(input.rows, fields), null, name);
  }
});

test('a reached cell without current remnant or changed inset does not create an arrival-local question', async () => {
  const input = await sample();
  const noChange = input.scene(input.target);
  assert.equal(await measureOutlineAccessArrival(noChange, await input.changedRows(noChange)), null);
  const onlyRemoteChange = structuredClone(noChange); onlyRemoteChange[40][50] = input.changed;
  assert.equal(await measureOutlineAccessArrival(onlyRemoteChange, await input.changedRows(onlyRemoteChange)), null,
    'An outside world change is not a changed inset');
  const noRemnant = structuredClone(input.rows);
  for (let row = input.y + 1; row < input.y + input.height - 1; row++) for (let col = input.x + 1; col < input.x + input.width - 1; col++) noRemnant[row][col] = input.changed;
  assert.equal(await measureOutlineAccessArrival(noRemnant, await input.changedRows(noRemnant)), null,
    'No hidden body is inferred after all its current visible pixels disappear');
});

test('current perimeter ambiguity or relocation invalidates the earlier relation', async () => {
  const input = await sample();
  const ambiguous = structuredClone(input.rows); input.ring(ambiguous, [44, 24, 47, 27], input.body);
  assert.equal(await measureOutlineAccessArrival(ambiguous, await input.changedRows(ambiguous)), null);
  const moved = structuredClone(input.rows);
  for (let row = input.y; row < input.y + input.height; row++) for (let col = input.x + 4 * input.width; col < input.x + 5 * input.width; col++) moved[row][col] = input.background;
  input.ring(moved, [input.x + 4 * input.width, input.y + input.height, input.x + 5 * input.width - 1, input.y + 2 * input.height - 1], input.body);
  assert.equal(await measureOutlineAccessArrival(moved, await input.changedRows(moved)), null,
    'A different current occurrence cannot inherit the previous endpoint relation merely by matching a palette value');
});
