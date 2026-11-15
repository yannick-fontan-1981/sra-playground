import { occurrenceCollectionScene, observeOccurrenceProgramPacket } from '../logos-engine/v6-occurrence-program-observer.ts';
import { programEditor, programWorld, programWordAt, projectedProgramMembers } from '../logos-engine/v6-program-composition-access.ts';
import { fitProgramCompositionModel, programSurface, searchProgram } from '../logos-engine/v6-program-compositions.ts';
import { renderProgramLayers } from '../logos-engine/v6-program-geometry.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';

export type ProgramEdit = { before: NativeRows; after: NativeRows; epoch: number; evidence: string[] };
export type ProgramWitness = { model: OccurrenceRecord; epoch: number; evidence: string[] };
type Display = { member_box: NativeBox; member_size: number[]; limit: number };
export type RetainedProgram = { word: number[]; display: Display };
export type ProgramChoice = {
  kind: 'bind_program_bearer' | 'compose_observed_program' | 'run_verified_program';
  action: NativeCommand;
  region: NativeBox | null;
  word: number[];
  display: Display;
  actor: NativeBox | null;
  sceneMembers: NativeBox[];
  affected: NativeBox[];
  forecast: { base: number[]; remaining: number }[] | null;
  next: number[] | null;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function displayMembers(rows: NativeRows, display: Display, model: OccurrenceRecord): OccurrenceRecord[] {
  return projectedProgramMembers(rows, display, new Set(model.editor_geometry.controls.map((control: OccurrenceRecord) => control.color)));
}

function wordBounds(object: OccurrenceRecord, model: OccurrenceRecord): NativeBox {
  const pixels = renderProgramLayers(object.word, model.layer.shape, model.layer.step);
  const local = [...pixels.keys()].map(point => point.split(',').map(Number));
  const [x, y] = object.anchor;
  const xs = local.map(point => x + point[0]!), ys = local.map(point => y + point[1]!);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function learnObservedProgram(edit: ProgramEdit, before: NativeObservation, after: NativeObservation, command: NativeCommand,
  rows: NativeRows, frames: readonly NativeRows[]): ProgramWitness | null {
  if (edit.epoch !== before.level_epoch || after.levels_completed <= before.levels_completed) return null;
  const first = occurrenceCollectionScene(edit.before), second = occurrenceCollectionScene(edit.after);
  if (!first || !second) return null;
  const event = observeOccurrenceProgramPacket(before, command, after, rows, frames)[0];
  const model = event && fitProgramCompositionModel(event.alignment, edit.before, edit.after, first.members, second.members,
    rows, frames, { official_progress: true });
  return model ? { model, epoch: after.level_epoch, evidence: [...edit.evidence, before.observation_ref, after.observation_ref] } : null;
}

export function chooseObservedProgram(witness: ProgramWitness, rows: NativeRows, available: readonly string[], remaining: number,
  deadlineMs: number, retained?: RetainedProgram): ProgramChoice | null {
  const { model } = witness;
  const layout = programEditor(rows, model);
  if (!available.includes(model.command_ref)) return null;
  const display: Display | undefined = layout ? { member_box: layout.member_box, member_size: layout.member_size, limit: layout.limit }
    : retained?.display;
  if (!display) return null;
  const members: OccurrenceRecord[] = layout?.members ?? displayMembers(rows, display, model);
  const word = members.map(member => member.color as number);
  if (!layout && !same(word, retained?.word)) return null;
  const sceneMembers = members.map(member => member.bbox as NativeBox);
  const activeControls: readonly OccurrenceRecord[] = available.includes('ACTION6') ? layout?.controls ?? [] : [];
  const insert = (label: number, kind: ProgramChoice['kind'], actor: NativeBox | null): ProgramChoice | null => {
    const controls = activeControls.filter(control => control.color === label);
    if (controls.length !== 1) return null;
    const region = controls[0]!.bbox as NativeBox;
    const [left, top, right, bottom] = region;
    return { kind, action: { action_ref: 'ACTION6', data: { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) } },
      region, word: [label, ...word], display, actor, sceneMembers, affected: [], forecast: null, next: null };
  };
  if (!word.length) {
    const learned = model.moves.find((move: OccurrenceRecord) => move.status === 'phase_observed_translation'
      && activeControls.some(control => control.color === move.label));
    return learned ? insert(learned.label, 'bind_program_bearer', null) : null;
  }
  const world = programWorld(rows, model);
  const owners = world.filter(object => same(object.word, word));
  if (owners.length !== 1) return null;
  const owner = owners[0]!;
  const targets = world.filter(object => object !== owner);
  const field = targets.length && programSurface(rows, model, world, owner.base);
  if (!field) return null;
  const result = searchProgram(word, owner.base, targets, model, field, {
    max_new_actions: Math.min(remaining, 12), deadline: deadlineMs / 1000,
    insertable_labels: activeControls.map(control => control.color),
  });
  const plan = result.status === 'proposed' ? result.plan : result.best;
  if (!plan) return null;
  const actor = wordBounds(owner, model);
  const affected = targets.map(target => wordBounds(target, model));
  if (plan.edits.length) {
    const offered = insert(plan.edits[0], 'compose_observed_program', actor);
    return offered && { ...offered, affected, next: owner.base };
  }
  const turn = plan.prediction.turns[0];
  return { kind: 'run_verified_program', action: { action_ref: model.command_ref, data: {} }, region: null, word, display,
    actor, sceneMembers, affected, next: turn.base,
    forecast: targets.map((target, index) => ({ base: target.base, remaining: turn.remaining[index] })) };
}

export function verifyObservedProgram(choice: ProgramChoice, witness: ProgramWitness, rows: NativeRows): boolean {
  const { model } = witness;
  const members = displayMembers(rows, choice.display, model);
  if (!same(members.map(member => member.color), choice.word)) return false;
  if (choice.next && !programWordAt(rows, model, choice.next, choice.word)) return false;
  if (!choice.forecast) return true;
  const world = programWorld(rows, model);
  return choice.forecast.every(({ base, remaining }) => {
    const matching = world.filter(object => same(object.base, base));
    return remaining ? matching.length === 1 && matching[0]!.word.length === remaining : !matching.length;
  });
}
