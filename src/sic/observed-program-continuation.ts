import { occurrenceCollectionScene, observeOccurrenceProgramPacket } from '../logos-engine/v6-occurrence-program-observer.ts';
import { programEditor, programWorld, programWordAt, projectedProgramMembers } from '../logos-engine/v6-program-composition-access.ts';
import { fitProgramCompositionModel, programSurface, searchProgram } from '../logos-engine/v6-program-compositions.ts';
import { renderProgramLayers } from '../logos-engine/v6-program-geometry.ts';
import { candidateProgramInputSites, learnProgramInputSupport } from '../logos-engine/v6-program-input-access.ts';
import { observeRespondentProgramPacket, programSupportMatch } from '../logos-engine/v6-program-respondent-observations.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';
import { planRespondentPrograms, type ProgramTurn, type RespondentContext, type ScheduledProgramStep } from './respondent-program-planner.ts';
import { chooseProgramContactTrial, verifyProgramTrialEdit } from './program-contact-trial.ts';
import { measureRespondentTerrain } from './program-terrain-context.ts';

export type ProgramEdit = { before: NativeRows; after: NativeRows; epoch: number; evidence: string[] };
export type ProgramWitness = { model: OccurrenceRecord; epoch: number; evidence: string[]; continued?: boolean };
type Display = { member_box: NativeBox; member_size: number[]; limit: number };
export type RetainedProgram = { word: number[]; display: Display };
export type ProgramChoice = {
  kind: 'bind_program_bearer' | 'compose_observed_program' | 'run_verified_program' | 'remove_program_operator' | 'probe_respondent_programs';
  action: NativeCommand;
  region: NativeBox | null;
  word: number[];
  display: Display;
  actor: NativeBox | null;
  sceneMembers: NativeBox[];
  affected: NativeBox[];
  forecast: { base: number[]; remaining: number }[] | null;
  next: number[] | null;
  respondentProbe?: { origin: number[]; next: number[] };
  respondents?: ProgramTurn[];
  scheduled?: ScheduledProgramStep[];
  contactTrial?: { palette: number[]; pending: boolean; destination?: NativeBox };
  markedTerrain?: NativeBox[];
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
  if (choice.contactTrial) return verifyProgramTrialEdit(choice, witness, rows);
  const { model } = witness;
  const members = displayMembers(rows, choice.display, model);
  if (!same(members.map(member => member.color), choice.word)) return false;
  if (choice.respondents) {
    const world = programWorld(rows, model);
    return choice.respondents.some(turn => {
      if (!programSupportMatch(rows, model, turn.base, choice.word).matches) return false;
      if (turn.targets.some(body => !programSupportMatch(rows, model, body.base, body.word).matches)) return false;
      return world.every(body => same(body.base, turn.base) || turn.targets.some(target => same(body.base, target.base) && same(body.word, target.word)));
    });
  }
  if (choice.next && !programWordAt(rows, model, choice.next, choice.word)) return false;
  if (!choice.forecast) return true;
  const world = programWorld(rows, model);
  return choice.forecast.every(({ base, remaining }) => {
    const matching = world.filter(object => same(object.base, base));
    return remaining ? matching.length === 1 && matching[0]!.word.length === remaining : !matching.length;
  });
}

function clickProgramRegion(region: NativeBox): NativeCommand {
  const [left, top, right, bottom] = region;
  return { action_ref: 'ACTION6', data: { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) } };
}

export function chooseRespondentProgram(witness: ProgramWitness, rows: NativeRows, available: readonly string[],
  remaining: number, deadline: number, retained?: RetainedProgram, context?: RespondentContext,
  scheduled?: ScheduledProgramStep[]): ProgramChoice | null {
  const { model } = witness, layout = programEditor(rows, model);
  if (!layout && !context && !scheduled) {
    const trial = chooseProgramContactTrial(witness, rows, available, remaining, deadline, body => wordBounds(body, model));
    if (trial || !retained) return trial;
  }
  const display: Display | undefined = layout ? { member_box: layout.member_box, member_size: layout.member_size, limit: layout.limit } : retained?.display;
  if (!display || !available.includes(model.command_ref)) return null;
  const members: OccurrenceRecord[] = layout?.members ?? displayMembers(rows, display, model);
  const word = members.map(member => member.color as number), world = programWorld(rows, model);
  if (!word.length && !context && !scheduled) return chooseObservedProgram(witness, rows, available, remaining, deadline, retained);
  const owners = word.length ? world.filter(body => same(body.word, word)) : [];
  const labels = layout?.controls.map((control: OccurrenceRecord) => control.color) ?? [];
  const plan = scheduled ?? (context && layout ? planRespondentPrograms(model, context, word, labels, remaining, deadline) : null);
  const step = plan?.[0];
  const matchedOwner: OccurrenceRecord | null = step && word.length ? owners.find(body => same(body.base, step.base))
    ?? (programSupportMatch(rows, model, step.base, word).matches ? { base: step.base, word } : null)
    : owners.length === 1 ? owners[0]! : null;
  const base: number[] | undefined = step?.base ?? matchedOwner?.base;
  if (!base) return null;
  const opponents = world.filter(body => !same(body.base, base));
  const actor = matchedOwner ? wordBounds({ ...matchedOwner, anchor: matchedOwner.anchor
    ?? base.map((value, index) => value - word.length * model.layer.step[index]) }, model) : null;
  const common = { display, actor, sceneMembers: members.map(member => member.bbox as NativeBox),
    affected: opponents.map(body => wordBounds(body, model)), forecast: null };
  const follow = (route: ScheduledProgramStep[] | null): ProgramChoice | null => {
    const step = route?.[0];
    if (!step || !same(word, step.before) || (word.length && !matchedOwner)) return null;
    const markedTerrain = step.markedTerrain?.map(([x, y]): NativeBox => {
      const shape = model.layer.shape as number[][];
      return [x, y, x + Math.max(...shape.map(point => point[0]!)), y + Math.max(...shape.map(point => point[1]!))];
    });
    const evidence = markedTerrain ? { markedTerrain } : {};
    if (step.kind === 'execute') return { ...common, kind: 'run_verified_program', action: { action_ref: model.command_ref, data: {} },
      region: null, word, next: null, respondents: step.forecasts, scheduled: route!.slice(1), ...evidence };
    if (!layout || !available.includes('ACTION6')) return null;
    const edited = step.kind === 'remove' ? layout.members[0]
      : layout.controls.find((control: OccurrenceRecord) => control.color === step.label);
    if (!edited) return null;
    const region = edited.bbox as NativeBox;
    return { ...common, kind: step.kind === 'remove' ? 'remove_program_operator' : 'compose_observed_program',
      action: clickProgramRegion(region), region, word: step.word, next: step.word.length ? base : null,
      scheduled: route!.slice(1), ...evidence };
  };
  if (context || scheduled) return follow(plan);
  if (!layout || !matchedOwner || word.length > 2) return null;
  const moves = (model.moves as OccurrenceRecord[]).filter(move => move.status === 'phase_observed_translation');
  if (opponents.length && opponents.every(body => body.word.every((label: number) => label === model.interaction.label))) {
    return chooseObservedProgram(witness, rows, available, remaining, deadline, retained);
  }
  const motion = moves.find(move => move.label === word.at(-1));
  const field = programSurface(rows, model, world, base);
  const tryTerrain = () => {
    if (!field || opponents.length !== 1) return null;
    const terrain = measureRespondentTerrain(rows, field, model, world);
    if (!terrain) return null;
    // A single visible respondent has no ordering ambiguity. Its current word,
    // the confirmed editing site and both tile hypotheses define the projection.
    return follow(planRespondentPrograms(model, { initial: { base, targets: opponents.map(body => ({ base: body.base, word: body.word })) },
      points: field.points, sites: [base], evidence: witness.evidence, terrain }, word, labels, remaining, deadline));
  };
  if (!motion) return tryTerrain();
  const vector: number[] = motion.vectors[0], next = base.map((value, index) => value + vector[index]!);
  if (!field?.points.some((point: number[]) => same(point, next)) || opponents.some(body => same(body.base, next))) return tryTerrain();
  const reverse = moves.find(move => vector.every((value, index) => value === -move.vectors[0][index]));
  if (!reverse) return tryTerrain();
  if (word.length === 1) {
    const control = layout.controls.find((part: OccurrenceRecord) => part.color === reverse.label);
    if (!control || !available.includes('ACTION6')) return tryTerrain();
    const region = control.bbox as NativeBox;
    return { ...common, kind: 'compose_observed_program', action: clickProgramRegion(region), region, word: [reverse.label, ...word], next: base };
  }
  if (word[0] !== reverse.label) return tryTerrain();
  return { ...common, kind: 'probe_respondent_programs', action: { action_ref: model.command_ref, data: {} }, region: null,
    word, next: base, respondentProbe: { origin: base, next } };
}

export function learnRespondentContext(choice: ProgramChoice, witness: ProgramWitness, before: NativeRows, after: NativeRows,
  frames: readonly NativeRows[], evidence: string): RespondentContext | null {
  if (!choice.respondentProbe) return null;
  const { model } = witness, { origin, next } = choice.respondentProbe;
  const layout = programEditor(before, model), world = programWorld(after, model);
  if (!layout || !verifyObservedProgram(choice, witness, after) || !programEditor(after, model)) return null;
  const moves = model.moves as OccurrenceRecord[];
  const candidates = programWorld(before, model).filter(body => !same(body.base, origin)).flatMap(body => {
    const label = [...body.word as number[]].reverse().find(label => moves.some(move => move.label === label));
    const operator = moves.find(move => move.label === label);
    if (!operator) return [];
    const vector = operator.vectors[0] as number[];
    return [{ object: body, expected_first_base: body.base.map((value: number, index: number) => value + vector[index]!) }];
  });
  const probe = { model, layout, own_prediction: { object: { base: origin, word: choice.word }, expected_first_base: next },
    prepared_word: choice.word, candidates };
  const support = learnProgramInputSupport(probe, before, frames);
  if (!support) return null;
  const packet = observeRespondentProgramPacket(probe, before, frames, { same_epoch: true });
  const observed = [
    ...packet.results.filter((result: OccurrenceRecord) => result.status === 'predicted_local_translation_witnessed'
      && !same(result.candidate.object.base, origin))
      .map((result: OccurrenceRecord) => ({ base: result.candidate.expected_first_base, word: result.candidate.object.word,
        frame: result.matching_packet_indices[0] })),
    ...packet.revealed_candidates.filter((result: OccurrenceRecord) => result.compatible_retroprojections.length === 1)
      .map((result: OccurrenceRecord) => ({ base: result.object.base, word: result.object.word,
        frame: result.first_complete_packet_index })),
  ];
  const others = world.filter(body => !same(body.base, origin));
  if (!others.length || others.length !== observed.length) return null;
  const order = observed.sort((a, b) => a.frame - b.frame);
  if (order.some((body, index) => (index > 0 && order[index - 1]!.frame === body.frame)
    || others.filter(other => same(body.base, other.base) && same(body.word, other.word)).length !== 1)) return null;
  const field = programSurface(after, model, world, origin);
  if (!field) return null;
  const sites = [origin, ...candidateProgramInputSites(after, field, support, origin)];
  return { initial: { base: origin, targets: order.map(({ base, word }) => ({ base, word })) },
    points: field.points, sites, evidence: [evidence] };
}
