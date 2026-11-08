import assert from 'node:assert/strict';
import test from 'node:test';
import { programControlDiscoveryQuestion, programControlDiscoveryBefore, programControlDiscoveryAfter,
  recordProgramControlDiscovery, programControlDiscoveryBlocksOrdinaryPlan } from '../src/logos-engine/v6-program-control-discovery.ts';
import { renderProgramLayers } from '../src/logos-engine/v6-program-geometry.ts';
import { programIdentity } from '../src/logos-engine/v6-program-identity.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);

/** Controlled editor geometry only. No game engine or game solution is used. */
function fixture(options: R = {}): R {
  const width = 64, height = 52, row = 43, memberWidth = options.memberWidth ?? 3, memberHeight = options.memberHeight ?? 2;
  const controlWidth = options.controlWidth ?? 3, controlHeight = options.controlHeight ?? 3;
  const background = options.background ?? 0, labels = options.labels ?? [12, 43, 88], unknown = options.glyphColor ?? 90;
  const otherInk = options.otherInk ?? 5, emitted = options.emitted ?? 201, gap = options.gap ?? 1;
  const controls = labels.map((color: number, index: number) => {
    const x = 11 + index * (controlWidth + 4), patch = Array.from({ length: controlHeight }, () => Array(controlWidth).fill(color));
    patch[Math.floor(controlHeight / 2)][Math.floor(controlWidth / 2)] = background;
    return { bbox: [x, row, x + controlWidth - 1, row + controlHeight - 1], color, patch };
  });
  const unknownPatch = Array.from({ length: controlHeight }, (_, y) => Array.from({ length: controlWidth }, (_, x) =>
    (x + y) % 3 === 0 ? background : (x + y) % 3 === 1 ? unknown : otherInk));
  const model: R = {
    layer: { shape: [[0, 0], [1, 0], [2, 0], [1, 1]], step: [0, 1] },
    moves: [{ label: labels[0], vectors: [[2, 0]], status: 'phase_observed_translation' },
      { label: labels[1], vectors: [[-2, 0]], status: 'phase_observed_translation' }],
    interaction: { label: labels[2], vectors: [[2, 0], [-2, 0]], status: 'conditional_reduction' },
    editor_geometry: { controls, member_size: [memberWidth, memberHeight], member_column: [1, 0, memberWidth, height - 1], footer: [0, row, width - 1, height - 1] },
    command_ref: 'ACTION5', evidence_refs: ['controlled-acquired:before', 'controlled-acquired:after'],
    status: 'conditional_program_composition_model', acquisition_epoch: 1,
  };
  model.model_id = 'controlled-model:' + programIdentity(model).slice(0, 20);
  const ownBase = [22, 24], targetBase = [40, 22];
  const draw = (word: number[], drawOptions: R = {}): number[][] => {
    const rows = Array.from({ length: height }, () => Array(width).fill(background));
    const patch = (box: number[], values: number[][]): void => values.forEach((line, y) => line.forEach((value, x) => { rows[box[1] + y]![box[0] + x] = value; }));
    for (const control of controls.slice(0, -1)) patch(control.bbox, control.patch);
    patch(controls.at(-1).bbox, unknownPatch);
    const start = row - 3 - word.length * (memberHeight + gap);
    word.forEach((color, index) => {
      for (let y = start + index * (memberHeight + gap); y < start + index * (memberHeight + gap) + memberHeight; y++) {
        for (let x = 1; x <= memberWidth; x++) rows[y]![x] = color;
      }
    });
    const paintBody = (bodyWord: number[], base: number[]): void => {
      const anchor = [base[0] - bodyWord.length * model.layer.step[0], base[1] - bodyWord.length * model.layer.step[1]];
      for (const [point, color] of renderProgramLayers(bodyWord, model.layer.shape, model.layer.step)) {
        const [x, y] = point.split(',').map(Number); rows[anchor[1] + y]![anchor[0] + x] = color;
      }
    };
    if (word.length) paintBody(word, drawOptions.ownBase ?? ownBase);
    paintBody(drawOptions.targetWord ?? [labels[2], labels[2], labels[2]], targetBase);
    if (drawOptions.duplicateOwner) paintBody(word, [31, 31]);
    if (drawOptions.highlight !== undefined) {
      const y = start + drawOptions.highlight * (memberHeight + gap);
      rows[y]![1] = options.highlightColor ?? 255;
    }
    return rows;
  };
  return { model, draw, word: [labels[0]], emitted, labels, ownBase, targetBase, unknownPatch, unknownBox: controls.at(-1).bbox };
}

function observation(rows: number[][], revision: number, options: R = {}): R {
  return { level_epoch: 4, levels_completed: 3, state: 'NOT_FINISHED', available_action_refs: ['ACTION5', 'ACTION6'],
    observation_ref: `controlled-public:${revision}:${programIdentity(rows).slice(0, 10)}`, ...options };
}
function meta(model: R, events: R[], view: R): R {
  return { epoch: view.level_epoch, score: view.levels_completed, observation_ref: view.observation_ref,
    available: view.available_action_refs, state: view.state, model, events };
}
function acquireEdit(f = fixture()): R {
  const events: R[] = [], rows = f.draw(f.word), before = observation(rows, 1);
  const proposal = programControlDiscoveryQuestion(f.model, events, before, rows);
  assert.ok(proposal); assert.equal(proposal.program_control_probe_plan.mode, 'probe_edit');
  const later = f.draw([f.emitted, ...f.word]), after = observation(later, 2);
  const acquired = recordProgramControlDiscovery(before, proposal.actions[0], after, rows, later, [later], proposal, { model: f.model, events });
  events.push(...acquired);
  const binding = events.find(event => event.kind === 'native_program_control_binding');
  assert.ok(binding, 'A controlled exact insertion has acquired a binding');
  return { f, events, rows, before, proposal, later, after, binding };
}

test('an unknown row patch is only a current one-action question, with no assigned label or model mutation', () => {
  const f = fixture(), rows = f.draw(f.word), view = observation(rows, 1), retained = copy(f.model), events: R[] = [];
  const proposal = programControlDiscoveryQuestion(f.model, events, view, rows);
  assert.ok(proposal); assert.equal(proposal.kind, 'public_program_control_probe');
  assert.equal(proposal.actions.length, 1); assert.equal(proposal.program_control_probe_plan.operator_status, 'unknown');
  assert.equal(proposal.program_control_probe_plan.binding, undefined);
  assert.deepEqual(proposal.program_control_probe_plan.entity.bbox, f.unknownBox);
  assert.equal(programControlDiscoveryBefore(proposal, 0, rows, meta(f.model, events, view)).admitted, true);
  assert.equal(programControlDiscoveryBlocksOrdinaryPlan(f.model, events, rows), false);
  assert.deepEqual(f.model, retained); assert.deepEqual(events, []);
});

test('insertion learns the actual emitted member colour even when absent from the clicked glyph', () => {
  const { f, events, binding, later } = acquireEdit();
  assert.ok(!f.unknownPatch.flat().includes(f.emitted));
  assert.equal(binding.label, f.emitted); assert.deepEqual(binding.before_word, f.word);
  assert.deepEqual(binding.after_word, [f.emitted, ...f.word]);
  assert.equal(binding.operator_status, 'unknown'); assert.equal(binding.evidence.length, 2);
  assert.equal(programControlDiscoveryBlocksOrdinaryPlan(f.model, events, later), true);
  assert.ok(!f.model.moves.some((move: R) => move.label === f.emitted));
});

test('arbitrary label values, background and member/control dimensions preserve acquisition', () => {
  const { f, binding } = acquireEdit(fixture({ memberWidth: 5, memberHeight: 3, controlWidth: 5, controlHeight: 3,
    background: 17, labels: [0, 229, 61], glyphColor: 131, otherInk: 45, emitted: 214, highlightColor: 32 }));
  assert.equal(binding.label, 214); assert.deepEqual(binding.owner_after.base, f.ownBase);
  assert.equal(binding.members_after.length, 2);
});

test('a background gap of member height is not an additional member', () => {
  const { binding } = acquireEdit(fixture({ memberHeight: 2, gap: 2 }));
  assert.deepEqual(binding.after_word, [201, 12]);
});

test('current observation, model, available command and clicked patch are all required before probing', () => {
  const f = fixture(), rows = f.draw(f.word), view = observation(rows, 1), events: R[] = [];
  const proposal = programControlDiscoveryQuestion(f.model, events, view, rows)!;
  for (const change of [{ observation_ref: 'stale' }, { epoch: 99 }, { score: 12 }, { available: ['ACTION5'] }, { model: { ...f.model, model_id: 'forged' } }]) {
    assert.equal(programControlDiscoveryBefore(proposal, 0, rows, { ...meta(f.model, events, view), ...change }).admitted, false);
  }
  const altered = copy(rows); altered[f.unknownBox[1]][f.unknownBox[0]] = 254;
  assert.equal(programControlDiscoveryBefore(proposal, 0, altered, meta(f.model, events, view)).admitted, false);
  assert.equal(programControlDiscoveryBefore(proposal, 1, rows, meta(f.model, events, view)).admitted, false);
});

test('a visual insertion after a different actual command never proves the queried input', () => {
  const f = fixture(), rows = f.draw(f.word), later = f.draw([f.emitted, ...f.word]);
  const before = observation(rows, 1), after = observation(later, 2), proposal = programControlDiscoveryQuestion(f.model, [], before, rows)!;
  for (const command of [{ action_ref: 'ACTION5' }, { action_ref: 'ACTION6', data: { x: 1, y: 1 } }]) {
    assert.deepEqual(recordProgramControlDiscovery(before, command, after, rows, later, [later], proposal, { model: f.model, events: [] }), []);
  }
});

test('a stationary edit return records a scoped trial and does not retry that identical public context', () => {
  const f = fixture(), rows = f.draw(f.word), before = observation(rows, 1), after = observation(rows, 2), model = copy(f.model);
  const proposal = programControlDiscoveryQuestion(f.model, [], before, rows)!;
  const events = recordProgramControlDiscovery(before, proposal.actions[0], after, rows, rows, [rows], proposal, { model: f.model, events: [] });
  assert.equal(events.length, 1); assert.equal(events[0].outcome, 'collection_insertion_unresolved');
  assert.equal(programControlDiscoveryQuestion(f.model, events, after, rows), null);
  assert.equal(programControlDiscoveryAfter(proposal, 0, rows, rows, { epoch: 4, score: 3, state: 'NOT_FINISHED' }).matched, null);
  assert.deepEqual(f.model, model);
});

test('ambiguous bearers or compound edits remain unbound', () => {
  const f = fixture(), ambiguous = f.draw(f.word, { duplicateOwner: true });
  assert.equal(programControlDiscoveryQuestion(f.model, [], observation(ambiguous, 1), ambiguous), null);
  const rows = f.draw(f.word), before = observation(rows, 1), proposal = programControlDiscoveryQuestion(f.model, [], before, rows)!;
  const later = f.draw([f.emitted, f.emitted, ...f.word]);
  const events = recordProgramControlDiscovery(before, proposal.actions[0], observation(later, 2), rows, later, [later], proposal, { model: f.model, events: [] });
  assert.equal(events.length, 1); assert.equal(events[0].outcome, 'collection_insertion_unresolved');
});

test('an official boundary is retained without assigning its rewrite to an insertion', () => {
  const f = fixture(), rows = f.draw(f.word), later = f.draw([f.emitted, ...f.word]), before = observation(rows, 1);
  const after = observation(later, 2, { level_epoch: 5, levels_completed: 4 }), proposal = programControlDiscoveryQuestion(f.model, [], before, rows)!;
  const events = recordProgramControlDiscovery(before, proposal.actions[0], after, rows, later, [later], proposal, { model: f.model, events: [] });
  assert.equal(events.length, 1); assert.equal(events[0].official_progress, true);
  assert.equal(events[0].outcome, 'collection_insertion_unresolved');
});

test('execution requires the acquired binding in memory, not a self-asserted proposal', () => {
  const { f, events, later, after } = acquireEdit(), proposal = programControlDiscoveryQuestion(f.model, events, after, later)!;
  assert.equal(proposal.program_control_probe_plan.mode, 'probe_execute');
  assert.equal(programControlDiscoveryBefore(proposal, 0, later, meta(f.model, events, after)).admitted, true);
  assert.equal(programControlDiscoveryBefore(proposal, 0, later, meta(f.model, [], after)).admitted, false);
  const forged = copy(proposal); forged.program_control_probe_plan.binding.evidence = ['invented:a', 'invented:b'];
  assert.equal(programControlDiscoveryBefore(forged, 0, later, meta(f.model, events, after)).admitted, false);
});

test('execution will not omit another unknown member or repeat a newly inserted label', () => {
  const { f, events } = acquireEdit();
  for (const word of [[f.emitted, f.emitted, ...f.word], [202, f.emitted, ...f.word]]) {
    const rows = f.draw(word);
    assert.equal(programControlDiscoveryQuestion(f.model, events, observation(rows, 3), rows), null);
    assert.equal(programControlDiscoveryBlocksOrdinaryPlan(f.model, events, rows), true);
  }
});

test('a controlled public packet supplies isolated phase measurements without creating a predictive operator', () => {
  const { f, events, later: rows, after: before, binding } = acquireEdit(), word = binding.after_word;
  const proposal = programControlDiscoveryQuestion(f.model, events, before, rows)!;
  const frames = [f.draw(word, { highlight: 1 }), f.draw(word, { highlight: 1, ownBase: [24, 24] }),
    f.draw(word, { highlight: 0, ownBase: [24, 24] }),
    f.draw(word, { highlight: 0, ownBase: [24, 24], targetWord: [f.labels[2], f.labels[2]] }),
    f.draw(word, { ownBase: [24, 24], targetWord: [f.labels[2], f.labels[2]] })];
  const later = frames.at(-1)!, after = observation(later, 3), retained = copy(f.model);
  const acquired = recordProgramControlDiscovery(before, { action_ref: 'ACTION5', data: {} }, after, rows, later, frames, proposal, { model: f.model, events });
  const effect = acquired.find(event => event.kind === 'native_program_control_effect');
  assert.ok(effect); assert.equal(effect.status, 'isolated_public_phase_measured');
  const phase = effect.phases.find((item: R) => item.new_control_label);
  assert.equal(phase.label, f.emitted); assert.equal(phase.world.word_changes[0].member_count_delta, -1);
  assert.equal(effect.operator_model_created, false); assert.equal(effect.packet_frame_count, 5);
  assert.ok(!Object.hasOwn(effect, 'frames')); assert.deepEqual(f.model, retained);
});

test('a return without isolated new-member phases remains unresolved, not an identity law', () => {
  const { f, events, later: rows, after: before } = acquireEdit(), proposal = programControlDiscoveryQuestion(f.model, events, before, rows)!;
  const after = observation(rows, 3), acquired = recordProgramControlDiscovery(before, proposal.actions[0], after, rows, rows, [rows], proposal, { model: f.model, events });
  const effect = acquired.find(event => event.kind === 'native_program_control_effect')!;
  assert.equal(effect.status, 'operator_effect_unresolved'); assert.equal(effect.operator_model_created, false);
  assert.deepEqual(effect.phases, []);
  assert.equal(programControlDiscoveryQuestion(f.model, [...events, ...acquired], after, rows), null);
});

test('the execution command must still be available and retain its learned payload domain', () => {
  const { f, events, later: rows, after: before } = acquireEdit(), unavailable = { ...before, available_action_refs: ['ACTION6'] };
  assert.equal(programControlDiscoveryQuestion(f.model, events, unavailable, rows), null);
  const proposal = programControlDiscoveryQuestion(f.model, events, before, rows)!;
  assert.deepEqual(recordProgramControlDiscovery(before, { action_ref: 'ACTION5', data: { x: 2 } }, observation(rows, 3), rows, rows, [rows], proposal,
    { model: f.model, events }), []);
});

test('explicit return preparation inserts only a phase-observed inverse and does not claim the unknown phase preserves its bearer', () => {
  const { f, events, later, after } = acquireEdit(), previous = copy(events), model = copy(f.model);
  assert.equal(programControlDiscoveryQuestion(f.model, events, after, later)!.program_control_probe_plan.mode, 'probe_execute');
  const proposal = programControlDiscoveryQuestion(f.model, events, after, later, { prepareReturn: true })!;
  assert.equal(proposal.program_control_probe_plan.mode, 'probe_prepare_return');
  assert.deepEqual(proposal.program_control_probe_plan.prepared_word, [f.labels[1], f.emitted, f.labels[0]]);
  assert.deepEqual(proposal.program_control_probe_plan.expected_return_base, f.ownBase);
  assert.equal(proposal.program_control_probe_plan.return_status, 'conditional_known_inverse_after_unknown_phase');
  assert.equal(proposal.program_control_probe_plan.operator_status, 'unknown');
  assert.equal(proposal.actions.length, 1);
  assert.equal(programControlDiscoveryBefore(proposal, 0, later, { ...meta(f.model, events, after), prepareReturn: true }).admitted, true);
  assert.equal(programControlDiscoveryBefore(proposal, 0, later, meta(f.model, events, after)).admitted, false,
    'The plan cannot enable a native return-preparation option on its own');
  assert.deepEqual(f.model, model); assert.deepEqual(events, previous);
});

test('execution after a controlled return edit requires the actual retained preparation trial', () => {
  const { f, events, later, after, binding } = acquireEdit();
  const proposal = programControlDiscoveryQuestion(f.model, events, after, later, { prepareReturn: true })!;
  const returned = f.draw(proposal.program_control_probe_plan.prepared_word), observationAfter = observation(returned, 3);
  assert.equal(programControlDiscoveryQuestion(f.model, events, observationAfter, returned, { prepareReturn: true }), null,
    'The visible prepared word does not manufacture its own insertion evidence');
  const acquired = recordProgramControlDiscovery(after, proposal.actions[0], observationAfter, later, returned, [returned], proposal,
    { model: f.model, events, prepareReturn: true });
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0].kind, 'native_program_control_trial');
  assert.equal(acquired[0].mode, 'probe_prepare_return');
  assert.equal(acquired[0].outcome, 'known_return_member_inserted');
  assert.equal(acquired[0].binding_id, binding.binding_id);
  assert.equal(acquired[0].return_preparation.status, 'observed_known_member_edit_return_still_conditional');
  events.push(...acquired);
  const execute = programControlDiscoveryQuestion(f.model, events, observationAfter, returned, { prepareReturn: true })!;
  assert.equal(execute.program_control_probe_plan.mode, 'probe_execute');
  assert.deepEqual(execute.program_control_probe_plan.before_word, [f.labels[1], f.emitted, f.labels[0]]);
  assert.deepEqual(execute.program_control_probe_plan.return_preparation_evidence, acquired[0].evidence);
  assert.equal(programControlDiscoveryBefore(execute, 0, returned, { ...meta(f.model, events, observationAfter), prepareReturn: true }).admitted, true);
  assert.equal(programControlDiscoveryBefore(execute, 0, returned,
    { ...meta(f.model, events.slice(0, -1), observationAfter), prepareReturn: true }).admitted, false);
  assert.deepEqual(recordProgramControlDiscovery(after, { action_ref: 'ACTION5' }, observationAfter, later, returned, [returned], proposal,
    { model: f.model, events: events.slice(0, -1), prepareReturn: true }), [], 'An unissued insertion cannot acquire the return binding');
});

test('a stationary return-preparation edit remains a local unresolved trial and cannot authorize execution', () => {
  const { f, events, later, after, binding } = acquireEdit();
  const proposal = programControlDiscoveryQuestion(f.model, events, after, later, { prepareReturn: true })!;
  const stationary = observation(later, 3);
  const acquired = recordProgramControlDiscovery(after, proposal.actions[0], stationary, later, later, [later], proposal,
    { model: f.model, events, prepareReturn: true });
  assert.equal(acquired.length, 1);
  assert.equal(acquired[0].outcome, 'known_return_preparation_unresolved');
  assert.equal(acquired[0].return_preparation, null);
  events.push(...acquired);
  assert.equal(programControlDiscoveryQuestion(f.model, events, stationary, later, { prepareReturn: true }), null);
  assert.equal(events.filter(event => event.kind === 'native_program_control_binding').length, 1);
  assert.deepEqual(events.find(event => event.kind === 'native_program_control_binding'), binding);
});

test('glyph resemblance without an observed inverse is insufficient for return preparation', () => {
  const f = fixture(); f.model.moves[1].status = 'glyph_extrapolation_candidate';
  const { events, later, after } = acquireEdit(f);
  assert.equal(programControlDiscoveryQuestion(f.model, events, after, later, { prepareReturn: true }), null);
  assert.equal(programControlDiscoveryQuestion(f.model, events, after, later)!.program_control_probe_plan.mode, 'probe_execute',
    'The separate native option does not silently change the original discovery contract');
});
