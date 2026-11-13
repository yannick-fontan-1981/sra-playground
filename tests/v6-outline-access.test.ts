import test from 'node:test';
import assert from 'node:assert/strict';
import { detectV5Components } from '../src/logos-engine/v6-native-observer.ts';
import { measureOutlineAnnouncedAccess } from '../src/logos-engine/v6-outline-access.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
function paint(rows: number[][], [left, top, right, bottom]: number[], value: number, rim = false): void {
  for (let row = top!; row <= bottom!; row++) for (let col = left!; col <= right!; col++) {
    if (!rim || row === top || row === bottom || col === left || col === right) rows[row]![col] = value;
  }
}
function scene(lead = [4, 24, 7, 27]) {
  const rows = Array.from({ length: 36 }, () => Array(44).fill(0));
  paint(rows, lead, 7, true);
  paint(rows, [13, 9, 15, 11], 2);
  paint(rows, [17, 9, 17, 9], 2);
  paint(rows, [28, 8, 31, 11], 2, true);
  return { rows, lead };
}
async function fieldsFor(rows: number[][], lead: number[]): Promise<R> {
  const components = (await detectV5Components(rows, 4)).components;
  const found = components.find(component => [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom].every((value, index) => value === lead[index]));
  return {
    available_action_refs: ['D_LEFT', 'B_RIGHT', 'C_DOWN', 'A_UP', 'LOCAL'],
    canonical_provisional_control_term_facts: [{ term_ref: 'controlled:current', entity_ref: found?.component_id ?? 'missing:outline' }],
    canonical_provisional_control_geometry_bboxes: [lead], current_action_conditioned_control_outline_bboxes: [lead],
    known_action_translation_deltas: [['D_LEFT', 0, -4], ['B_RIGHT', 0, 4], ['C_DOWN', 4, 0], ['A_UP', -4, 0]],
    interface_action_translation_deltas: [['A_UP', -1, 0], ['B_RIGHT', 0, 1], ['C_DOWN', 1, 0], ['D_LEFT', 0, -1]],
    current_control_reacquired: true, current_observation_ref: 'public:current',
    current_control_evidence_refs: ['public:earlier-translation', 'public:current'],
  };
}
async function sample() { const { rows, lead } = scene(); return { rows, fields: await fieldsFor(rows, lead) }; }

test('native announced access proposes one currently measured distance-reducing experiment', async () => {
  const input = await sample(), before = clone(input), witness = await measureOutlineAnnouncedAccess(input.rows, input.fields) as R;
  assert.equal(witness.schema, 'logos-engine.native.outline-announced-access.v1');
  assert.equal(witness.action_ref, 'A_UP', 'Equal reductions use the original lexical action order, independent of available-action insertion order');
  assert.deepEqual(witness.marker_cell_bbox, [16, 8, 19, 11]);
  assert.deepEqual(witness.expected_delta, [0, -4]);
  assert.deepEqual(witness.expected_body_bbox, [4, 20, 7, 23]);
  assert.equal(witness.distance_before, 7); assert.equal(witness.distance_after, 6);
  assert.equal(witness.motion_basis, 'current_observed_translation');
  assert.equal(witness.primitive_bound, 1); assert.equal(witness.replan_after_each_primitive, true);
  assert.equal(witness.release_authority, false); assert.equal(witness.action_effect_known, false); assert.equal(witness.route_safety_established, false);
  assert.match(witness.source_motif.qualification, /explicit native extension/);
  assert.equal(witness.relation.compact_body.value, witness.relation.cardinal_marker.value);
  assert.equal(witness.relation.compact_body.value, witness.relation.hollow_perimeter.value);
  assert.deepEqual(input, before, 'The experiment cannot alter the current observation or control evidence');
});

test('native announced access remains equivariant under translation and palette permutation', async () => {
  const base = await sample(), original = await measureOutlineAnnouncedAccess(base.rows, base.fields) as R;
  const shifted = Array.from({ length: 42 }, () => Array(50).fill(0));
  for (let row = 0; row < base.rows.length; row++) for (let col = 0; col < base.rows[row]!.length; col++) shifted[row + 3]![col + 2] = base.rows[row]![col]!;
  const lead = [6, 27, 9, 30], translated = await measureOutlineAnnouncedAccess(shifted, await fieldsFor(shifted, lead)) as R;
  const recolored = base.rows.map(row => row.map(value => new Map([[0, 10], [2, 5], [7, 11]]).get(value) ?? value));
  const palette = await measureOutlineAnnouncedAccess(recolored, await fieldsFor(recolored, [4, 24, 7, 27])) as R;
  for (const witness of [translated, palette]) {
    assert.equal(witness.action_ref, original.action_ref); assert.equal(witness.distance_before, original.distance_before);
    assert.equal(witness.distance_after, original.distance_after); assert.deepEqual(witness.expected_delta, original.expected_delta);
  }
  assert.deepEqual(translated.marker_cell_bbox, [18, 11, 21, 14]);
  assert.deepEqual(translated.expected_body_bbox, [6, 23, 9, 26]);
  assert.equal(palette.relation.compact_body.value, 5);
});

test('native announced access refuses ambiguous body-marker-perimeter correspondence', async () => {
  const { rows, lead } = scene(); paint(rows, [28, 16, 31, 19], 2, true);
  assert.equal(await measureOutlineAnnouncedAccess(rows, await fieldsFor(rows, lead)), null);
  const next = scene(); paint(next.rows, [13, 5, 13, 5], 2);
  assert.equal(await measureOutlineAnnouncedAccess(next.rows, await fieldsFor(next.rows, next.lead)), null);
});

test('native announced access requires an exact current motif and current control identity', async () => {
  for (const change of [
    (rows: number[][]) => { rows[9]![17] = 4; },
    (rows: number[][]) => { rows[10]![14] = 0; },
    (rows: number[][]) => { rows[8]![29] = 0; },
    (rows: number[][]) => { rows[25]![4] = 0; },
  ]) {
    const { rows, lead } = scene(); change(rows);
    assert.equal(await measureOutlineAnnouncedAccess(rows, await fieldsFor(rows, lead)), null);
  }
  const input = await sample(); input.fields.canonical_provisional_control_term_facts[0].entity_ref = 'foreign:outline';
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
});

test('native announced access refuses missing acquisition, stale evidence and unsupported geometry', async () => {
  const base = await sample();
  for (const override of [
    { current_control_reacquired: false }, { current_control_evidence_refs: [] },
    { current_control_evidence_refs: ['public:previous-only'] }, { current_observation_ref: null },
    { known_action_translation_deltas: [] }, { available_action_refs: [] },
    { canonical_provisional_control_term_facts: [] },
    { canonical_provisional_control_geometry_bboxes: [[4, 24, 7, 27], [8, 24, 11, 27]] },
    { current_action_conditioned_control_outline_bboxes: [[4, 20, 7, 23]] },
    { canonical_provisional_control_geometry_bboxes: [[-4, 24, -1, 27]] },
  ]) assert.equal(await measureOutlineAnnouncedAccess(base.rows, { ...base.fields, ...override }), null);
  const unaligned = scene([5, 24, 8, 27]);
  assert.equal(await measureOutlineAnnouncedAccess(unaligned.rows, await fieldsFor(unaligned.rows, unaligned.lead)), null);
  const arrived = scene([16, 8, 19, 11]);
  assert.equal(await measureOutlineAnnouncedAccess(arrived.rows, await fieldsFor(arrived.rows, arrived.lead)), null);
});

test('native announced access labels missing directional mappings as revisable priors', async () => {
  const input = await sample(); input.fields.known_action_translation_deltas = [['C_DOWN', 4, 0]];
  const witness = await measureOutlineAnnouncedAccess(input.rows, input.fields) as R;
  assert.equal(witness.action_ref, 'A_UP'); assert.equal(witness.motion_basis, 'declared_revisable_interface_prior');
  assert.equal(witness.observed_delta_row_column, null); assert.deepEqual(witness.interface_prior_row_column, [-1, 0]);
  input.fields.interface_action_translation_deltas = [];
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
});

test('native announced access never overwrites a contradictory measured direction with a prior', async () => {
  const input = await sample(); input.fields.available_action_refs = ['A_UP', 'C_DOWN'];
  input.fields.known_action_translation_deltas = [['A_UP', -4, 4], ['C_DOWN', 4, 0]];
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
  input.fields.known_action_translation_deltas = [['A_UP', 4, 0], ['C_DOWN', 4, 0]];
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
  input.fields.known_action_translation_deltas = [['A_UP', -4, 0], ['A_UP', 4, 0]];
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
});

test('native announced access uses measured quantum and rejects a step leaving the frame', async () => {
  const input = await sample(); input.fields.known_action_translation_deltas = [['A_UP', -8, 0], ['B_RIGHT', 0, 4]];
  const witness = await measureOutlineAnnouncedAccess(input.rows, input.fields) as R;
  assert.deepEqual(witness.expected_delta, [0, -8]); assert.equal(witness.distance_after, 5);
  input.fields.available_action_refs = ['A_UP']; input.fields.known_action_translation_deltas = [['A_UP', -28, 0]];
  assert.equal(await measureOutlineAnnouncedAccess(input.rows, input.fields), null);
});

test('native announced access exposes unknown passability and does not interpret incidental colors as obstacles', async () => {
  const input = await sample(); paint(input.rows, [4, 20, 7, 23], 4);
  const witness = await measureOutlineAnnouncedAccess(input.rows, input.fields) as R;
  assert.equal(witness.action_ref, 'A_UP'); assert.equal(witness.route_safety_established, false);
  assert.ok(witness.unknown.includes('cell_passability')); assert.ok(witness.unknown.includes('autonomous_motion'));
  assert.ok(!Object.hasOwn(witness, 'route_action_refs'), 'Only the current one-step question is returned');
});

test('native announced access keeps a recalled unique control hypothesis separate from current reacquisition', async () => {
  const input = await sample();
  input.fields.current_control_reacquired = false; input.fields.current_recalled_control_unique = true;
  input.fields.known_action_translation_deltas = []; input.fields.historical_control_evidence_refs = ['previous-epoch:control'];
  const witness = await measureOutlineAnnouncedAccess(input.rows, input.fields) as R;
  assert.equal(witness.control_binding_basis, 'current_unique_revalidated_recalled_control_hypothesis');
  assert.equal(witness.motion_basis, 'declared_revisable_interface_prior');
  assert.deepEqual(witness.historical_control_evidence_refs, ['previous-epoch:control']);
  assert.equal(witness.observed_delta_row_column, null);
  for (const override of [
    { historical_control_evidence_refs: [] }, { current_recalled_control_unique: false },
    { known_action_translation_deltas: [['A_UP', -4, 0]] },
    { interface_action_translation_deltas: [] },
    { current_action_conditioned_control_outline_bboxes: [[8, 24, 11, 27]] },
  ]) assert.equal(await measureOutlineAnnouncedAccess(input.rows, { ...input.fields, ...override }), null);
});

async function temporalFields(rows: number[][], lead: number[], previous: number[][], prior: R | null,
  revision = 2, level = 2): Promise<R> {
  const fields = await fieldsFor(rows, lead), command = { action_ref: prior?.action_ref ?? 'A_UP', data: {} };
  const beforeRef = `public:${revision - 1}`, afterRef = `public:${revision}`;
  fields.current_level_epoch = level; fields.current_revision = revision; fields.current_observation_ref = afterRef;
  fields.current_control_evidence_refs = [afterRef, 'current-epoch:translation']; fields.previous_action_observed_frame = previous;
  const beforeHash = symbolicDigest(previous), afterHash = symbolicDigest(rows);
  fields.previous_public_transition = {
    before: { observation_ref: beforeRef, level_epoch: level, levels_completed: level - 1, revision: revision - 1, frame_hash: beforeHash.slice(0, 16) },
    after: { observation_ref: afterRef, level_epoch: level, levels_completed: level - 1, revision, frame_hash: afterHash.slice(0, 16) },
    before_rows_sha256: beforeHash, after_rows_sha256: afterHash, command,
    selected_outline: prior ? {
      proposal_ref: `actually-dispatched:${revision - 1}`, guard_admitted: true, action_index: 0, command,
      observation_ref: beforeRef, level_epoch: level, frame_hash: beforeHash.slice(0, 16),
      meaning_kind: prior.kind === 'current_announced_cell_access_question' ? 'native_current_announced_access_hypothesis' : 'native_current_observed_body_access_hypothesis',
      active_goal_ref: 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter',
      active_terminal_goal_ref: 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter', access_relation: prior,
    } : null,
  };
  return fields;
}
async function initialTemporalAccess() {
  const input = await sample(); input.fields.current_observation_ref = 'public:1'; input.fields.current_control_evidence_refs = ['public:1', 'current-epoch:translation'];
  return { ...input, witness: await measureOutlineAnnouncedAccess(input.rows, input.fields) as R };
}

test('native observed-body access survives three actual missing-marker returns without reconstructing a marker', async () => {
  const initial = await initialTemporalAccess(); let previous = initial.rows, prior = initial.witness;
  const witnesses: R[] = [];
  for (let revision = 2; revision <= 4; revision++) {
    const lead = prior.expected_body_bbox as number[], current = scene(lead); current.rows[9]![17] = 0;
    const fields = await temporalFields(current.rows, lead, previous, prior, revision);
    const witness = await measureOutlineAnnouncedAccess(current.rows, fields) as R;
    assert.ok(witness, 'Each missing-marker step needs its own current public proof');
    assert.equal(witness.kind, 'current_observed_body_access_question');
    assert.equal(witness.target_basis, 'current_visible_compact_body_cell');
    assert.deepEqual(witness.target_cell_bbox, [12, 8, 15, 11]); assert.deepEqual(witness.body_cell_bbox, witness.target_cell_bbox);
    assert.equal(witness.marker_cell_bbox, null); assert.equal(witness.relation.cardinal_marker, null);
    assert.equal(witness.relation.announced_delta_row_column, null); assert.equal(witness.relation.announced_body_to_perimeter_distance, null);
    assert.equal(witness.temporal_evidence.current_body_binding, 'same_exact_current_visible_body');
    assert.equal(witness.temporal_evidence.current_marker_present, false);
    assert.equal(witness.temporal_evidence.previous_revision, revision - 1); assert.equal(witness.temporal_evidence.current_revision, revision);
    assert.ok(witness.distance_after < witness.distance_before);
    const hasRetainedWitness = (value: unknown): boolean => value !== null && typeof value === 'object'
      && (Object.hasOwn(value, 'access_relation') || Object.values(value).some(hasRetainedWitness));
    assert.ok(!hasRetainedWitness(witness), 'The new proof does not recursively retain the previous access witness');
    witnesses.push(witness); previous = current.rows; prior = witness;
  }
  assert.equal(witnesses.length, 3);
});

test('native observed-body access can remeasure the unique previous public motif without a prior selected goal', async () => {
  const previous = scene(), current = scene([4, 20, 7, 23]); current.rows[9]![17] = 0;
  const fields = await temporalFields(current.rows, current.lead, previous.rows, null);
  const witness = await measureOutlineAnnouncedAccess(current.rows, fields) as R;
  assert.equal(witness.kind, 'current_observed_body_access_question');
  assert.equal(witness.temporal_evidence.relation_basis, 'unique_announced_relation_remeasured_in_previous_public_raster');
  assert.equal(witness.temporal_evidence.selected_proposal_ref, null);
  assert.equal(witness.marker_cell_bbox, null);
});

test('native observed-body access accepts only the actual prior singleton destination for a changed body', async () => {
  const previous = scene(), current = scene([4, 20, 7, 23]);
  paint(current.rows, [13, 9, 15, 11], 0); paint(current.rows, [17, 9, 19, 11], 2);
  const fields = await temporalFields(current.rows, current.lead, previous.rows, null);
  const witness = await measureOutlineAnnouncedAccess(current.rows, fields) as R;
  assert.equal(witness.kind, 'current_observed_body_access_question');
  assert.equal(witness.temporal_evidence.current_body_binding, 'actual_previous_singleton_became_current_visible_body');
  assert.deepEqual(witness.temporal_evidence.current_body_delta_row_column, [0, 4]);
  assert.deepEqual(witness.target_cell_bbox, [16, 8, 19, 11]); assert.equal(witness.marker_cell_bbox, null);
  const wrong = scene([4, 20, 7, 23]); paint(wrong.rows, [13, 9, 15, 11], 0); wrong.rows[9]![17] = 0; paint(wrong.rows, [21, 9, 23, 11], 2);
  assert.equal(await measureOutlineAnnouncedAccess(wrong.rows, await temporalFields(wrong.rows, wrong.lead, previous.rows, null)), null);
  const unannounced = scene([4, 20, 7, 23]); paint(unannounced.rows, [13, 9, 15, 11], 0); unannounced.rows[9]![17] = 0; paint(unannounced.rows, [13, 13, 15, 15], 2);
  assert.equal(await measureOutlineAnnouncedAccess(unannounced.rows, await temporalFields(unannounced.rows, unannounced.lead, previous.rows, null)), null);
});

test('native observed-body access refuses stale, cross-epoch, nonadjacent and forged prior context', async () => {
  const initial = await initialTemporalAccess(), current = scene([4, 20, 7, 23]); current.rows[9]![17] = 0;
  const fields = await temporalFields(current.rows, current.lead, initial.rows, initial.witness);
  assert.ok(await measureOutlineAnnouncedAccess(current.rows, fields));
  for (const mutate of [
    (value: R) => { value.previous_public_transition = null; },
    (value: R) => { value.previous_action_observed_frame = current.rows; },
    (value: R) => { value.previous_public_transition.before.level_epoch--; },
    (value: R) => { value.previous_public_transition.after.level_epoch++; },
    (value: R) => { value.previous_public_transition.before.revision--; },
    (value: R) => { value.previous_public_transition.after.observation_ref = 'foreign:current'; },
    (value: R) => { value.previous_public_transition.before_rows_sha256 = '0'.repeat(64); },
    (value: R) => { value.previous_public_transition.selected_outline.guard_admitted = false; },
    (value: R) => { value.previous_public_transition.selected_outline.command.action_ref = 'foreign:command'; },
    (value: R) => { value.previous_public_transition.selected_outline.access_relation.relation.compact_body.bbox[0]++; },
    (value: R) => { value.previous_public_transition.selected_outline.access_relation.current_rows_sha256 = '0'.repeat(64); },
    (value: R) => { value.previous_public_transition.selected_outline.access_relation.observation_ref = 'foreign:previous'; },
  ]) {
    const rejected = clone(fields); mutate(rejected);
    assert.equal(await measureOutlineAnnouncedAccess(current.rows, rejected), null);
  }
});

test('native observed-body access requires a current solid unique body and current corresponding perimeter', async () => {
  const initial = await initialTemporalAccess();
  for (const mutate of [
    (rows: number[][]) => { rows[10]![14] = 0; },
    (rows: number[][]) => { paint(rows, [21, 17, 23, 19], 2); },
    (rows: number[][]) => { paint(rows, [28, 8, 31, 11], 4, true); },
    (rows: number[][]) => { paint(rows, [28, 16, 31, 19], 2, true); },
  ]) {
    const current = scene([4, 20, 7, 23]); current.rows[9]![17] = 0; mutate(current.rows);
    assert.equal(await measureOutlineAnnouncedAccess(current.rows,
      await temporalFields(current.rows, current.lead, initial.rows, initial.witness)), null);
  }
});
