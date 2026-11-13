import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain, rowsDigest, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { programEditor, programWorld } from '../src/logos-engine/v6-program-composition-access.ts';
import { searchProgram } from '../src/logos-engine/v6-program-compositions.ts';
import { searchRespondentProgram, searchRespondentReplacement } from '../src/logos-engine/v6-program-respondent-search.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-program-composition-reference.json.gz', import.meta.url))).toString());
const diagnosis = JSON.parse(await readFile(new URL('../docs/migration/native-campaigns-v39/diagnostics/stck-level-four-program-diagnosis.json', import.meta.url), 'utf8'));

/** Replays an already exported public program journal. These tests do not
 * issue game actions or claim a new campaign, and controlled scenes below
 * remain explicitly separate from the real public L4 observation. */
function fromProgramEvents(events: R[], native = true): SharedSeriesConstraint {
  const source = new SharedSeriesConstraint(oracle.policy.recall);
  for (const event of events) { source.memory.applyEvent(copy(event)); source.events.push(copy(event)); }
  const family = new SharedSeriesConstraint(oracle.policy.recall, { currentProgramAccess: native });
  family.restore(source.state());
  return family;
}

async function controlledView(scene: R, rows: number[][], revision: number): Promise<{ public: NativePublicObservation; observation: R }> {
  const packet = { ...copy(scene.public), frame_rows: rows, frame_packet: [rows], frame_hash: await rowsDigest(rows) } as NativePublicObservation;
  return { public: packet, observation: await measureNativeObservation(packet, revision, 'native-partial-editor-controlled') };
}

function withoutControl(rows: NativeRows, model: R, label: number): number[][] {
  const result = rows.map(row => [...row]), control = model.editor_geometry.controls.find((entry: R) => entry.color === label);
  assert.ok(control);
  // A controlled absence, not an interpretation of any game's hidden cause.
  for (let y = control.bbox[1]; y <= control.bbox[3]; y++) for (let x = control.bbox[0]; x <= control.bbox[2]; x++) result[y]![x] = 255;
  return result;
}

function corruptControl(rows: NativeRows, control: R): number[][] {
  const result = rows.map(row => [...row]);
  for (let y = control.bbox[1]; y <= control.bbox[3]; y++) for (let x = control.bbox[0]; x <= control.bbox[2]; x++) {
    if (result[y]![x] === control.color) { result[y]![x] = 254; return result; }
  }
  throw new Error('Control has no measured foreground');
}

test('explicit native access leaves complete original common proposal envelopes unchanged', async () => {
  const entries = oracle.proposalCases.filter((entry: R) => entry.id.startsWith('actual_stck_'));
  assert.equal(entries.length, 4);
  for (const entry of entries) {
    const family = fromProgramEvents(oracle.states[entry.state].events), old = family.state(), scene = oracle.scenes[entry.scene];
    const proposal = await family.programPropose(copy(entry.observation), scene.rows, copy(entry.inputs), entry.remaining,
      entry.deadline === null ? null : entry.deadline * 1000, () => 0);
    assert.deepEqual(proposal, entry.expected, entry.id);
    assert.deepEqual(family.state(), old, 'Current revalidation does not acquire an effect');
  }
});

test('the actual public L4 journal binds partial editing access while retaining the absent operator and its visible target', async () => {
  assert.equal(diagnosis.qualification.hiddenGameSourceRead, false);
  assert.equal(diagnosis.qualification.privateGameStateRead, false);
  assert.equal(diagnosis.qualification.physicalActionsIssued, 0);
  const view = diagnosis.views[0], source = fromProgramEvents(diagnosis.events, false), family = fromProgramEvents(diagnosis.events);
  const state = family.state(), model = family.memory.compositionModels.at(-1)!;
  assert.deepEqual(model, diagnosis.model);
  assert.equal(programEditor(view.public.frame_rows, model), null);
  assert.equal(await source.programPropose(view.observation, view.public.frame_rows, [], 40, 360_000, () => 0), null);
  const proposal = await family.programPropose(view.observation, view.public.frame_rows, [], 40, 360_000, () => 0);
  assert.ok(proposal);
  assert.equal(proposal.kind, 'public_program_composition');
  const plan = proposal.program_composition_plan, access = plan.current_program_access;
  assert.equal(plan.mode, 'bind_single_member');
  assert.equal(access.status, 'current_program_access_bound');
  assert.deepEqual(access.geometry.unavailable_labels, [model.interaction.label]);
  assert.equal(plan.layout.controls.length + 1, model.editor_geometry.controls.length);
  assert.ok(access.geometry.insertable_labels.includes(plan.word[0]));
  assert.ok(!access.geometry.insertable_labels.includes(model.interaction.label));
  assert.deepEqual(plan.model, model, 'The absent insertion input does not remove its learned operator');
  const bodies = programWorld(view.public.frame_rows, model);
  assert.ok(bodies.some(body => body.word.includes(model.interaction.label)), 'The absent control label remains decoded on another bearer');
  const domain = new ObservedInputDomain(256);
  domain.candidates(view.observation); family.bind(proposal, domain);
  assert.deepEqual(proposal.steps[0].point_binding.point, [proposal.actions[0].data.x, proposal.actions[0].data.y]);
  assert.equal(proposal.steps[0].point_binding.observation_ref, view.observation.observation_ref);
  assert.equal(family.before(proposal, 0, view.public, view.observation).admitted, true);
  assert.deepEqual(family.state(), state);
});

test('partial current access still rejects unavailable actions, changed glyphs, a returned control and a substituted layout', async () => {
  const view = diagnosis.views[0], family = fromProgramEvents(diagnosis.events), state = family.state();
  const proposal = await family.programPropose(view.observation, view.public.frame_rows, [], 40, 360_000, () => 0);
  assert.ok(proposal);
  const plan = proposal.program_composition_plan;
  const unavailable = { ...view.public, available_action_refs: view.public.available_action_refs.filter((ref: string) => ref !== proposal.actions[0].action_ref) };
  assert.equal(family.before(proposal, 0, unavailable, view.observation).admitted, false);
  const changed = { ...view.public, frame_rows: corruptControl(view.public.frame_rows, plan.layout.controls[0]) };
  assert.deepEqual(family.before(proposal, 0, changed, view.observation), { admitted: false, reason: 'current_program_controls_changed' });
  const returned = copy(view.public), absent = plan.model.editor_geometry.controls.find((control: R) =>
    plan.current_program_access.geometry.unavailable_labels.includes(control.color));
  for (let y = absent.bbox[1]; y <= absent.bbox[3]; y++) for (let x = absent.bbox[0]; x <= absent.bbox[2]; x++) {
    returned.frame_rows[y][x] = absent.patch[y - absent.bbox[1]][x - absent.bbox[0]];
  }
  assert.equal(family.before(proposal, 0, returned, view.observation).reason, 'current_program_controls_changed');
  const substituted = copy(proposal);
  substituted.program_composition_plan.layout.controls[0].bbox[0]++;
  assert.equal(family.before(substituted, 0, view.public, view.observation).reason, 'current_program_controls_changed');
  assert.deepEqual(family.state(), state, 'Failed revalidation adds no acquired availability or operator');
});

test('a controlled partial editor preserves a known unavailable operator through execution, continuation and checkpoint restoration', async () => {
  const family = fromProgramEvents(oracle.states.fitted.events), model = family.memory.compositionModels.at(-1)!;
  const interaction = model.interaction.label;
  const first = await controlledView(oracle.scenes['toy:repeat_before'], withoutControl(oracle.scenes['toy:repeat_before'].rows, model, interaction), 100);
  const second = await controlledView(oracle.scenes['toy:repeat_middle'], withoutControl(oracle.scenes['toy:repeat_middle'].rows, model, interaction), 101);
  const proposal = await family.programPropose(first.observation, first.public.frame_rows, [], 4, 360_000, () => 0);
  assert.ok(proposal);
  const plan = proposal.program_composition_plan;
  assert.ok(plan.word.includes(interaction));
  assert.ok(!plan.current_program_access.geometry.insertable_labels.includes(interaction));
  assert.equal(plan.steps.length, 1); assert.equal(plan.steps[0].mode, 'execute');
  assert.equal(plan.turns.length, 2);
  assert.equal(family.before(proposal, 0, first.public, first.observation).admitted, true);
  assert.equal(family.after(proposal, 0, first.observation, second.observation, first.public.frame_rows, second.public.frame_rows).matched, true);
  family.record(first.observation, second.observation, proposal.actions[0], first.public.frame_rows, second.public.frame_rows, proposal, 0, second.public.frame_packet);
  const continuation = family.memory.compositionContinuation!;
  assert.deepEqual(continuation.current_program_access, plan.current_program_access);
  assert.deepEqual(family.memory.compositionModels.at(-1), model);
  const state = family.nativeState(), restored = new SharedSeriesConstraint(oracle.policy.recall, { currentProgramAccess: true });
  restored.restoreNative(state);
  assert.deepEqual(restored.nativeState(), state);
  const next = await restored.programPropose(second.observation, second.public.frame_rows, [], 3, 360_000, () => 0);
  assert.ok(next); assert.equal(next.program_composition_plan.mode, 'execute');
  assert.equal(restored.before(next, 0, second.public, second.observation).admitted, true);
  assert.deepEqual(next.program_composition_plan.current_program_access, plan.current_program_access);
  const originalOnly = new SharedSeriesConstraint(oracle.policy.recall);
  originalOnly.restoreNative(state);
  assert.equal(await originalOnly.programPropose(second.observation, second.public.frame_rows, [], 3, 360_000, () => 0), null,
    'A native continuation does not implicitly activate the opt-in extension');
});

test('a respondent probe rechecks current controls after its edit while retaining an unavailable operator on another body', async () => {
  const family = fromProgramEvents(oracle.states.fitted.events), model = family.memory.compositionModels.at(-1)!;
  const original = oracle.proposalCases.find((entry: R) => entry.id === 'other_bearer_probe').expected.respondent_probe_plan;
  const missing = model.interaction.label;
  assert.notEqual(missing, original.insert_control.color);
  const first = await controlledView(oracle.scenes['toy:epoch2'], withoutControl(oracle.scenes['toy:epoch2'].rows, model, missing), 110);
  const second = await controlledView(oracle.scenes['toy:probe_edit'], withoutControl(oracle.scenes['toy:probe_edit'].rows, model, missing), 111);
  const proposal = await family.programPropose(first.observation, first.public.frame_rows, [], 16, 360_000, () => 0);
  assert.ok(proposal); assert.equal(proposal.kind, 'public_program_respondent_probe');
  const plan = proposal.respondent_probe_plan;
  assert.ok(plan.current_program_access.geometry.unavailable_labels.includes(missing));
  assert.ok(plan.candidates.some((candidate: R) => candidate.object.word.includes(missing)));
  assert.equal(family.before(proposal, 0, first.public, first.observation).admitted, true);
  assert.equal(family.after(proposal, 0, first.observation, second.observation, first.public.frame_rows, second.public.frame_rows).matched, true);
  assert.equal(family.before(proposal, 1, second.public, second.observation).admitted, true,
    'An expected collection edit changes neither the current access proof nor known operators');
  const changed = { ...second.public, frame_rows: corruptControl(second.public.frame_rows, plan.insert_control) };
  assert.equal(family.before(proposal, 1, changed, second.observation).reason, 'current_program_controls_changed');
});

const searchModel = { moves: [{ label: 1, vectors: [[1, 0]] }, { label: 2, vectors: [[-1, 0]] }],
  interaction: { label: 9, vectors: [[1, 0], [-1, 0]] } };
const searchField = { points: [[0, 0], [1, 0], [2, 0], [3, 0]], origin: [0, 0], basis: [[1, 0], [0, 1]], bounds: [[0, 3], [0, 0]] };
const targets = [{ base: [2, 0], word: [9] }];
const searchOptions = { max_new_actions: 3, deadline: 1000, now: () => 0 };

test('stationary search restricts new insertions and proves the absence of its only reduction operator without enumerating', () => {
  const model = copy(searchModel), original = searchProgram([1], [0, 0], targets, model, searchField, searchOptions);
  assert.equal(original.status, 'proposed'); assert.deepEqual(original.plan.edits, [9]);
  const unavailable = searchProgram([1], [0, 0], targets, model, searchField, { ...searchOptions, insertable_labels: [1, 2] });
  assert.equal(unavailable.status, 'unknown'); assert.equal(unavailable.reason, 'no_insertable_or_retained_reduction_operator');
  assert.equal(unavailable.nodes, 0);
  const retained = searchProgram([9, 1], [0, 0], targets, model, searchField, { ...searchOptions, insertable_labels: [] });
  assert.equal(retained.status, 'proposed'); assert.deepEqual(retained.plan.edits, []);
  assert.deepEqual(retained.plan.word, [1, 9]);
  assert.deepEqual(model, searchModel);
});

test('respondent and replacement searches retain unavailable existing operators and filter only added suffixes', () => {
  const model = copy(searchModel), options = { ...searchOptions, insertable_labels: [] };
  const retained = searchRespondentProgram([9, 1], [0, 0], targets, model, searchField, options);
  assert.equal(retained.status, 'proposed'); assert.deepEqual(retained.plan.edits, []);
  assert.equal(retained.plan.predictions.length, 4, 'All original interaction and removal hypotheses remain required');
  const replacement = searchRespondentReplacement([1, 9, 1], [0, 0], targets, model, searchField, { ...options, max_members: 2 });
  assert.equal(replacement.status, 'proposed'); assert.equal(replacement.plan.removals, 1);
  assert.deepEqual(replacement.plan.edits, []); assert.deepEqual(replacement.plan.word, [1, 9]);
  const excluded = searchRespondentProgram([1], [0, 0], targets, model, searchField, { ...searchOptions, insertable_labels: [1, 2] });
  assert.equal(excluded.status, 'unknown');
  assert.deepEqual(model, searchModel);
});
