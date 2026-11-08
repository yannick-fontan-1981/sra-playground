import assert from 'node:assert/strict';
import test from 'node:test';
import { bindCurrentProgramAccess, currentProgramAccessMatches } from '../src/logos-engine/v6-program-current-access.ts';
import { programEditor } from '../src/logos-engine/v6-program-composition-access.ts';

type R = Record<string, any>;
type Box = [number, number, number, number];
const values = [12, 27, 44, 63, 91, 135, 174, 201];
const glyph = (color: number): number[][] => Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) =>
  x === 1 && y === 1 || x === 3 && y === 3 ? 1 : x === 2 && y === 2 ? 0 : color));
const paint = (rows: number[][], box: readonly number[], patch: readonly (readonly number[])[]): void => {
  for (const [y, row] of patch.entries()) for (const [x, value] of row.entries()) rows[box[1]! + y]![box[0]! + x] = value;
};
const shifted = (box: readonly number[], dx: number, dy: number): Box => [box[0]! + dx, box[1]! + dy, box[2]! + dx, box[3]! + dy];

function fixture(count = 6): { model: R; frame: (selected?: number[], dx?: number, dy?: number, word?: number[]) => number[][] } {
  const controls = values.slice(0, count).map((color, index) => ({ color, bbox: [11 + index * 9, 23, 15 + index * 9, 27], patch: glyph(color) }));
  const model: R = {
    status: 'conditional_program_composition_model', model_id: 'synthetic-acquired-program', acquisition_epoch: 71,
    evidence_refs: ['public-before', 'public-after'], command_ref: 'ACTION2',
    editor_geometry: { controls, member_column: [3, 0, 6, 41], member_size: [4, 3], footer: [0, 23, 119, 41] },
    moves: controls.slice(0, -1).map((control, index) => ({ label: control.color, vectors: [[index + 1, 0]], status: 'phase_observed_translation' })),
    interaction: { label: controls.at(-1)!.color, vectors: [[1, 0], [-1, 0]] },
    layer: { shape: [[0, 0]], step: [0, 1] }, basis: [[1, 0], [0, 1]], surface_templates: [],
  };
  const frame = (selected = controls.map((_, index) => index), dx = 0, dy = 0, word: number[] = []): number[][] => {
    const rows = Array.from({ length: 42 }, () => Array(120).fill(0) as number[]);
    for (const index of selected) {
      const control = controls[index]!;
      paint(rows, shifted(control.bbox, dx, dy), control.patch);
    }
    for (const [index, color] of word.entries()) paint(rows, [3 + dx, 3 + dy + index * 5], Array.from({ length: 3 }, () => Array(4).fill(color) as number[]));
    return rows;
  };
  return { model, frame };
}

test('full current access preserves the learned model and supplies exact public evidence', () => {
  const { model, frame } = fixture(), rows = frame(), original = structuredClone(model);
  const result = bindCurrentProgramAccess(rows, model, { observation_ref: 'current-frame', level_epoch: 29 });
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.deepEqual(result.layout.controls.map((control: R) => control.color), values.slice(0, 6));
  assert.deepEqual(result.insertable_labels, values.slice(0, 6));
  assert.deepEqual(result.unavailable_labels, []);
  assert.deepEqual(result.unknown_controls, []);
  assert.deepEqual(result.evidence.geometry.offset, [0, 0]);
  assert.equal(result.evidence.observation_ref, 'current-frame');
  assert.equal(result.evidence.level_epoch, 29);
  assert.ok(result.evidence.geometry.matches.every((match: R) => match.patch_digest && match.status === 'exact_current_learned_appearance'));
  assert.strictEqual(result.layout.current_access, result.evidence);
  assert.deepEqual(model, original);
  assert.ok(programEditor(rows, model), 'The unchanged source path still accepts its ordinary complete editor');
});

for (const [name, selected] of [
  ['missing left end', [1, 2, 3, 4, 5]], ['missing right end', [0, 1, 2, 3, 4]],
  ['missing interior', [0, 1, 3, 4, 5]], ['several interior gaps', [0, 2, 5]],
] as const) test(`partial access handles ${name} without changing learned semantics`, () => {
  const { model, frame } = fixture(), rows = frame([...selected]), original = structuredClone(model);
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  const expected: number[] = selected.map(index => values[index]!);
  assert.deepEqual(result.insertable_labels, expected);
  assert.deepEqual(result.unavailable_labels, values.slice(0, 6).filter(color => !expected.includes(color)));
  assert.deepEqual(result.evidence.geometry.known_operator_labels, values.slice(0, 6));
  assert.equal(result.evidence.geometry.unavailable_controls.length, 6 - selected.length);
  assert.ok(result.evidence.geometry.unavailable_controls.every((entry: R) => entry.status === 'current_access_not_attested'));
  assert.deepEqual(model, original);
  assert.equal(programEditor(rows, model), null, 'The new access rule does not relax the source-parity editor');
});

for (const count of [1, 2, 8]) test(`access does not assume five controls: ${count} learned appearances`, () => {
  const { model, frame } = fixture(count), selected = count === 1 ? [0] : [count - 1];
  const result = bindCurrentProgramAccess(frame(selected), model);
  assert.equal(result.status, 'bound');
  if (result.status === 'bound') assert.deepEqual(result.evidence.geometry.attested_control_labels, [values[count - 1]]);
});

test('a common translation rebinds current points and the member column with interior gaps', () => {
  const { model, frame } = fixture(), rows = frame([0, 2, 4, 5], 7, 4, [values[1]!]);
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.deepEqual(result.layout.offset, [7, 4]);
  assert.deepEqual(result.layout.member_box, [10, 0, 13, 26]);
  assert.equal(result.layout.limit, 27);
  assert.deepEqual(result.layout.controls[0].bbox, [18, 27, 22, 31]);
  assert.deepEqual(result.evidence.geometry.matches[0].point, [20, 29]);
  assert.deepEqual(result.layout.members.map((member: R) => member.color), [values[1]],
    'Existing members keep their semantics even without a corresponding current control');
});

test('an unavailable interaction remains readable in the collection and in the complete model', () => {
  const { model, frame } = fixture(), interaction = model.interaction.label;
  const result = bindCurrentProgramAccess(frame([0, 1, 2, 3, 4], 0, 0, [interaction, interaction]), model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.deepEqual(result.layout.members.map((member: R) => member.color), [interaction, interaction]);
  assert.deepEqual(result.unavailable_labels, [interaction]);
  assert.ok(!result.insertable_labels.includes(interaction));
  assert.equal(model.interaction.label, interaction);
});

test('additional current glyphs are recorded without assigning learned operator semantics', () => {
  const { model, frame } = fixture(), rows = frame([0, 1, 3, 4, 5]), before = structuredClone(model);
  // A new appearance occupies the missing old slot; another has disconnected
  // foreground at a new slot. Neither is supplied as a semantic control label.
  paint(rows, model.editor_geometry.controls[2].bbox, glyph(220));
  const newBox = [11 + 6 * 9, 23, 15 + 6 * 9, 27];
  paint(rows, newBox, Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => (x + y) % 2 ? 0 : 230)));
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.deepEqual(result.unknown_controls.map(control => control.bbox), [model.editor_geometry.controls[2].bbox, newBox]);
  assert.ok(result.unknown_controls.every(control => control.status === 'unattributed_current_row_appearance' && !Object.hasOwn(control, 'label')));
  assert.ok(!result.insertable_labels.includes(220) && !result.insertable_labels.includes(230));
  assert.ok(!result.layout.controls.some((control: R) => [220, 230].includes(control.color)));
  assert.deepEqual(model, before);
});

test('known appearance without learned operator semantics does not become an insertable operator', () => {
  const { model, frame } = fixture();
  model.moves = model.moves.filter((operator: R) => operator.label !== values[0]);
  const result = bindCurrentProgramAccess(frame(), model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.ok(result.evidence.geometry.attested_control_labels.includes(values[0]));
  assert.ok(!result.insertable_labels.includes(values[0]!));
});

test('duplicated exact appearances are ambiguous even when one copy is in the old position', () => {
  const { model, frame } = fixture(), rows = frame(), control = model.editor_geometry.controls[0];
  paint(rows, [90, 5], control.patch);
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'unknown');
  if (result.status === 'unknown') assert.equal(result.reason, 'ambiguous_current_control');
});

test('separately relocated controls do not establish a common translation', () => {
  const { model, frame } = fixture(), rows = frame([0, 1, 2, 3, 4]), control = model.editor_geometry.controls[5];
  paint(rows, shifted(control.bbox, 1, 0), control.patch);
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'unknown');
  if (result.status === 'unknown') assert.equal(result.reason, 'inconsistent_current_control_translation');
});

test('a changed known-colour glyph is refused instead of being treated as a deletion', () => {
  const { model, frame } = fixture(), rows = frame(), control = model.editor_geometry.controls[2];
  rows[control.bbox[1] + 1]![control.bbox[0] + 1] = 2;
  const result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'unknown');
  if (result.status === 'unknown') assert.equal(result.reason, 'changed_learned_control_appearance');
});

test('no current retained appearance establishes no access', () => {
  const { model, frame } = fixture(), result = bindCurrentProgramAccess(frame([]), model);
  assert.equal(result.status, 'unknown');
  if (result.status === 'unknown') assert.equal(result.reason, 'no_current_learned_control');
});

test('access guards allow collection edits but replan on control or geometry changes', () => {
  const { model, frame } = fixture(), selected = [0, 1, 3, 4, 5], rows = frame(selected);
  const result = bindCurrentProgramAccess(rows, model, { observation_ref: 'before-edit', level_epoch: 5 });
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  const proof = result.evidence;
  assert.equal(currentProgramAccessMatches(frame(selected, 0, 0, [values[2]!, values[5]!]), model, proof), true);
  assert.equal(currentProgramAccessMatches(frame(), model, proof), false, 'A previously absent input reappeared');
  assert.equal(currentProgramAccessMatches(frame(selected, 1, 0), model, proof), false, 'The retained points are no longer current');
  assert.equal(currentProgramAccessMatches(frame([0, 1, 3, 4]), model, proof), false, 'A previously attested control disappeared');
  const extra = frame(selected);
  paint(extra, [11 + 6 * 9, 23], glyph(221));
  assert.equal(currentProgramAccessMatches(extra, model, proof), false, 'An unassigned control appearance requires a fresh plan');
});

test('access guards bind the full model and reject a tampered structural proof', () => {
  const { model, frame } = fixture(), rows = frame(), result = bindCurrentProgramAccess(rows, model);
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  const proof = structuredClone(result.evidence);
  proof.geometry.insertable_labels = [];
  assert.equal(currentProgramAccessMatches(rows, model, proof), false);
  const modified = structuredClone(model);
  modified.moves[0].vectors[0][0] += 1;
  assert.equal(currentProgramAccessMatches(rows, modified, result.evidence), false, 'An unchanged model_id cannot conceal changed semantics');
  const provenance = structuredClone(result.evidence);
  provenance.frame_digest = 'earlier-frame'; provenance.observation_ref = 'earlier-observation'; provenance.level_epoch = 123;
  assert.equal(currentProgramAccessMatches(rows, model, provenance), true,
    'Current frame/epoch authority is the runtime guard; this helper checks only access between primitives');
});
