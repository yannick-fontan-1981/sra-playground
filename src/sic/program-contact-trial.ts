import { programSurface } from '../logos-engine/v6-program-compositions.ts';
import { programWordAt, programWorld } from '../logos-engine/v6-program-composition-access.ts';
import { bindCurrentProgramAccess } from '../logos-engine/v6-program-current-access.ts';
import { occurrenceRectangularMembers } from '../logos-engine/v6-occurrence-program-observer.ts';
import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { ProgramChoice, ProgramWitness } from './observed-program-continuation.ts';

const unmeasured = -1;
const key = (point: readonly number[]) => point.join(',');
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const equalWord = (left: readonly number[], right: readonly number[]) => left.length === right.length
  && left.every((label, i) => label === right[i]);
const controlPoint = ([l, t, r, b]: NativeBox) => ({ x: Math.floor((l + r) / 2), y: Math.floor((t + b) / 2) });
type Pair = { actor: NativePoint; target: NativePoint };
type Trial = NonNullable<ProgramChoice['contactTrial']>;

function controlLabels(model: OccurrenceRecord): number[] {
  return model.editor_geometry.controls.map((control: OccurrenceRecord) => control.color);
}

function membersAt(rows: NativeRows, display: ProgramChoice['display'], palette: number[]) {
  const x = display.member_box[0], [width, height] = display.member_size;
  return occurrenceRectangularMembers(rows, [{ bbox: [x, 0, x + width! - 1, height! - 1] }], new Set(palette), display.limit);
}

function projectTrial(initial: Pair, word: number[], moves: Map<number, NativePoint>, contacts: Set<string>, safe: Set<string>,
  destination: NativePoint, remaining: number, deadline: number): number[] | null {
  const atDestination = (pair: Pair) => key(pair.target) === key(destination);
  const step = ({ actor, target }: Pair, label: number): Pair | null => {
    const vector = moves.get(label);
    if (vector) {
      const next = add(actor, vector);
      return safe.has(key(next)) && key(next) !== key(target) ? { actor: next, target } : null;
    }
    if (label !== unmeasured) return null;
    const delta: NativePoint = [target[0] - actor[0], target[1] - actor[1]];
    if (!contacts.has(key(delta))) return null;
    const next = add(target, delta);
    return (safe.has(key(next)) || key(next) === key(destination)) && key(next) !== key(actor) ? { actor, target: next } : null;
  };
  let start = initial;
  for (const label of [...word].reverse()) {
    if (atDestination(start)) return null;
    const next = step(start, label);
    if (!next) return null;
    start = next;
  }
  if (atDestination(start)) return [];
  const queue = [{ pair: start, plan: [] as number[] }], seen = new Set<string>([key(start.actor) + ':' + key(start.target)]);
  for (let index = 0; index < queue.length && index < 1024 && performance.now() < deadline; index++) {
    const { pair, plan } = queue[index]!;
    if (plan.length >= remaining) continue;
    for (const label of [unmeasured, ...moves.keys()]) {
      const next = step(pair, label);
      if (!next) continue;
      const nextPlan = [...plan, label], identity = key(next.actor) + ':' + key(next.target);
      if (atDestination(next)) return nextPlan;
      if (seen.has(identity)) continue;
      seen.add(identity);
      queue.push({ pair: next, plan: nextPlan });
    }
  }
  return null;
}

export function chooseProgramContactTrial(witness: ProgramWitness, rows: NativeRows, available: readonly string[],
  remaining: number, deadline: number, bounds: (body: OccurrenceRecord) => NativeBox): ProgramChoice | null {
  const { model } = witness, access = bindCurrentProgramAccess(rows, model);
  if (access.status !== 'bound' || access.unknown_controls.length !== 1
    || !access.unavailable_labels.includes(model.interaction.label) || !available.includes(model.command_ref)
    || !available.includes('ACTION6')) return null;
  const [unknown] = access.unknown_controls, layout = access.layout;
  const display = { member_box: layout.member_box, member_size: layout.member_size, limit: layout.limit };
  const known = controlLabels(model), palette = [...new Set<number>([...known, ...unknown!.palette])];
  const members = membersAt(rows, display, palette), word: number[] = members.map(member => member.color);
  const newcomers = [...new Set(word.filter(label => !known.includes(label)))];
  if (newcomers.length > 1) return null;
  const [currentLabel] = newcomers;
  const worldModel = currentLabel === undefined ? model : { ...model, editor_geometry: { ...model.editor_geometry,
    controls: [...model.editor_geometry.controls, { color: currentLabel }] } };
  const world = programWorld(rows, worldModel);
  const controls = layout.controls as OccurrenceRecord[];
  const moves = new Map<number, NativePoint>((model.moves as OccurrenceRecord[])
    .filter(move => move.status === 'phase_observed_translation' && move.vectors.length === 1
      && controls.some(control => control.color === move.label))
    .map(move => [move.label, move.vectors[0]]));
  const common = { display, sceneMembers: members.map(part => part.bbox as NativeBox), actor: null as NativeBox | null,
    affected: [] as NativeBox[], forecast: null, next: null as number[] | null };
  const insert = (control: OccurrenceRecord, label: number, trial: Trial, kind: ProgramChoice['kind']): ProgramChoice => ({
    ...common, kind, action: { action_ref: 'ACTION6', data: controlPoint(control.bbox) },
    region: control.bbox, word: [label, ...word], contactTrial: trial,
  });
  const isRespondent = (body: OccurrenceRecord) => (body.word as number[]).every(label => label === model.interaction.label);
  if (!word.length) {
    const [label] = moves.keys(), control = controls.find(item => item.color === label);
    return remaining >= 3 && world.length === 1 && isRespondent(world[0]!) && control
      ? insert(control, label!, { palette, pending: false }, 'bind_program_bearer') : null;
  }
  const owners = world.filter(body => equalWord(body.word, word));
  if (world.length !== 2 || owners.length !== 1) return null;
  const owner = owners[0]!, target = world.find(body => body !== owner)!;
  if (!isRespondent(target)) return null;
  common.actor = bounds(owner);
  common.affected = [bounds(target)];
  common.next = owner.base;
  const field = programSurface(rows, model, world, owner.base);
  if (!field) return null;
  const points = field.points as NativePoint[], safe = new Set(points.map(key));
  const axes = model.basis as [NativePoint, NativePoint];
  const neighbours = axes.flatMap(([x, y]) => [[x, y], [-x, -y]] as NativePoint[]);
  const interior = new Map<string, NativePoint>();
  for (const point of points) for (const axis of neighbours) {
    const candidate = add(point, axis);
    if (!safe.has(key(candidate)) && neighbours.every(delta => safe.has(key(add(candidate, delta))))) {
      interior.set(key(candidate), candidate);
    }
  }
  if (interior.size !== 1) return null;
  const destination = [...interior.values()][0]!;
  const plan = projectTrial({ actor: owner.base, target: target.base }, word.map(label => label === currentLabel ? unmeasured : label),
    moves, new Set<string>((model.interaction.vectors as NativePoint[]).map(key)), safe, destination,
    Math.min(remaining - 1, 5 - word.length), deadline);
  if (!plan) return null;
  const [x, y] = destination;
  const trial = { palette, pending: false, destination: [x, y, x + layout.member_size[0] - 1, y + layout.member_size[1] - 1] as NativeBox };
  const label = plan[0];
  if (label === undefined) return { ...common, kind: 'run_verified_program', region: null, word, next: null,
    action: { action_ref: model.command_ref, data: {} }, contactTrial: trial };
  if (label === unmeasured) return insert(unknown!, currentLabel ?? unmeasured, { ...trial, pending: currentLabel === undefined }, 'compose_observed_program');
  const control = controls.find(item => item.color === label);
  return control ? insert(control, label, trial, 'compose_observed_program') : null;
}

export function verifyProgramTrialEdit(choice: ProgramChoice, witness: ProgramWitness, rows: NativeRows): boolean {
  const trial = choice.contactTrial!;
  if (choice.action.action_ref !== 'ACTION6') return false;
  const word = membersAt(rows, choice.display, trial.palette).map(member => member.color);
  if (choice.next && !programWordAt(rows, witness.model, choice.next, word)) return false;
  if (!trial.pending) return equalWord(word, choice.word);
  return word.length === choice.word.length && !controlLabels(witness.model).includes(word[0]!)
    && equalWord(word.slice(1), choice.word.slice(1));
}
