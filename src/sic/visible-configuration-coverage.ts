import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const visibleConfigurationCoverageId = 'sic_cover_visible_configurations';
export const visibleConfigurationStrategies = {
  cover_next_configuration: 'Change one factor to reach an unvisited configuration',
  test_visible_factor_cycle: 'Test the next value of a newly encountered factor',
} as const;

type Factor = { box: NativeBox; values: number[]; active: number };
type Card = { box: NativeBox; values: number[]; border: number };
type Catalogue = { factors: Factor[]; cards: Card[]; current: number[]; visited: string[] };
type FactorEvidence = { values: number[]; input: string; ref: string };
type Calibration = { epoch: number; factors: FactorEvidence[]; visitedBorder: number };
type Witness = { epoch: number; factors: FactorEvidence[]; visitedBorder: number; boundary: string };
type Choice = { factor: number; expected: number[]; target: Card };
type Proposal = NativeProposal & { choice: Choice; current: Catalogue; needId: string };

const key = (values: readonly number[]) => values.join(',');
const width = (box: NativeBox) => box[2] - box[0] + 1;
const height = (box: NativeBox) => box[3] - box[1] + 1;
const center = ([left, top, right, bottom]: NativeBox): NativePoint => [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)];
const inside = ([left, top, right, bottom]: NativeBox, [x, y]: NativePoint) => left <= x && x <= right && top <= y && y <= bottom;

function groups<T>(items: readonly T[], signature: (item: T) => string): T[][] {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const id = signature(item);
    const matching = result.get(id) ?? [];
    matching.push(item);
    result.set(id, matching);
  }
  return [...result.values()];
}

function hasBorder(rows: NativeRows, [left, top, right, bottom]: NativeBox, value: number): boolean {
  if (left < 0 || top < 0 || right >= rows[0]!.length || bottom >= rows.length) return false;
  for (let x = left; x <= right; x++) if (rows[top]![x] !== value || rows[bottom]![x] !== value) return false;
  for (let y = top + 1; y < bottom; y++) if (rows[y]![left] !== value || rows[y]![right] !== value) return false;
  return true;
}

function readFactors(observation: NativeObservation, rows: NativeRows): Factor[][] {
  const squares = observation.entities.filter(part => width(part.bbox) === height(part.bbox));
  const controls = squares.flatMap(part => {
    const box = part.bbox, [, , , b] = box, size = width(box);
    if (size < 5 || size > rows[0]!.length / 3) return [];
    if (!hasBorder(rows, box, part.palette_value)) return [];
    const [x, y] = center(box), active = rows[y]![x]!;
    const swatches = squares.filter(other => other.rectangular && width(other.bbox) >= 2 && width(other.bbox) < size / 2
      && other.bbox[0] >= box[0] && other.bbox[2] <= box[2] && other.bbox[1] > b + 1 && other.bbox[1] - b < size);
    const legend = groups(swatches, item => key([item.bbox[1], width(item.bbox)]))
      .filter(group => group.length >= 2 && group.length <= 4 && new Set(group.map(item => item.palette_value)).size === group.length);
    if (legend.length !== 1) return [];
    const values = legend[0]!.sort((a, z) => a.bbox[0] - z.bbox[0]).map(item => item.palette_value);
    return values.includes(active) ? [{ box, values, active }] : [];
  });
  const outer = groups(controls, factor => key(center(factor.box)))
    .map(matches => matches.sort((a, b) => width(b.box) - width(a.box))[0]!);
  return groups(outer, factor => key([factor.box[1], width(factor.box)]))
    .filter(group => group.length >= 2 && group.length <= 4)
    .map(group => group.sort((a, b) => a.box[0] - b.box[0]));
}

function readCatalogue(observation: NativeObservation, rows: NativeRows, visitedBorder: number | null = null): Catalogue | null {
  if (!observation.available_action_refs.includes('ACTION6')) return null;
  const candidates = readFactors(observation, rows).flatMap(factors => {
    const count = factors.reduce((total, factor) => total * factor.values.length, 1);
    if (count > 64) return [];
    const rectangles = observation.entities.filter(part => height(part.bbox) >= 3 && height(part.bbox) < width(factors[0]!.box) / 2
      && width(part.bbox) >= factors.length + 2 && part.bbox[1] > factors[0]!.box[3]
      && hasBorder(rows, part.bbox, part.palette_value));
    return groups(rectangles, part => key([width(part.bbox), height(part.bbox)]))
      .filter(group => group.length === count).flatMap(group => {
        const strips = group.map(part => {
          const [, y] = center(part.bbox);
          return rows[y]!.slice(part.bbox[0] + 1, part.bbox[2]);
        });
        const slots: number[] = [], backing = new Set<number>();
        for (const [index, value] of strips[0]!.entries()) {
          if (strips.every(strip => strip[index] === value)) backing.add(value);
          else slots.push(index);
        }
        if (backing.size !== 1 || slots.length !== factors.length) return [];
        const cards: Card[] = group.map((part, index) => ({ box: part.bbox, border: part.palette_value,
          values: slots.map(slot => strips[index]![slot]!) }));
        const borders = new Set(cards.map(card => card.border));
        if (cards.some(card => card.values.some((value, i) => !factors[i]!.values.includes(value)))
          || new Set(cards.map(card => key(card.values))).size !== count || borders.size < 2 || borders.size > 3) return [];
        const current = factors.map(factor => factor.active);
        const active = cards.find(card => key(card.values) === key(current));
        if (!active || cards.filter(card => card.border === active.border).length !== 1) return [];
        return [{ factors, cards, current, visited: cards.filter(card => card === active || card.border === visitedBorder).map(card => key(card.values)) }];
      });
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function nextValue(factor: Factor, current: number): number {
  return factor.values[(factor.values.indexOf(current) + 1) % factor.values.length]!;
}

function chooseConfiguration(scene: Catalogue): Choice | null {
  const visited = new Set(scene.visited);
  const unvisited = new Map(scene.cards.filter(card => !visited.has(key(card.values))).map(card => [key(card.values), card]));
  const queue = [{ values: scene.current, first: null as Omit<Choice, 'target'> | null }];
  const reached = new Set([key(scene.current)]);
  for (const { values, first } of queue) {
    const target = unvisited.get(key(values));
    if (target && first) return { ...first, target };
    for (const [factor, control] of scene.factors.entries()) {
      const expected = values.map((value, index) => index === factor ? nextValue(control, value) : value);
      const signature = key(expected);
      if (reached.has(signature)) continue;
      reached.add(signature);
      queue.push({ values: expected, first: first ?? { factor, expected } });
    }
  }
  return null;
}

function verifyChange(previous: Catalogue, next: Catalogue, expected: readonly number[]): boolean {
  return key(next.current) === key(expected)
    && previous.factors.every((factor, i) => key(next.factors[i]?.values ?? []) === key(factor.values))
    && next.visited.slice().sort().join(';') === [...new Set([...previous.visited, key(expected)])].sort().join(';');
}

function inputTargets(command: NativeCommand, box: NativeBox): boolean {
  const { x, y } = command.data;
  return command.action_ref === 'ACTION6' && typeof x === 'number' && typeof y === 'number' && inside(box, [x, y]);
}

function confirmsClosingVisit(scene: Catalogue, choice: Choice, rows: NativeRows, visitedBorder: number): boolean {
  const active = scene.cards.find(card => key(card.values) === key(scene.current));
  if (!active || !scene.factors.every((factor, index) => {
    const [x, y] = center(factor.box);
    return rows[y]?.[x] === choice.expected[index];
  })) return false;
  return scene.cards.every(card => hasBorder(rows, card.box, card === choice.target ? active.border : visitedBorder));
}

export type CatalogueAcquisition = { learned?: Calibration; witness?: Witness };

export function acquireCatalogueReturn(previousState: CatalogueAcquisition | undefined, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows, frames: readonly NativeRows[]): CatalogueAcquisition | undefined {
  const learned = previousState?.learned, witness = previousState?.witness;
  const calibration = learned?.epoch === before.level_epoch ? learned : null;
  const knownBorder = calibration?.visitedBorder ?? (witness?.epoch === before.level_epoch ? witness.visitedBorder : null);
  const current = readCatalogue(before, first, knownBorder);
  if (!current) return previousState;
  const previous = calibration?.factors ?? [];
  if (after.levels_completed > before.levels_completed) {
    if (knownBorder === null || previous.length < 2 || current.visited.length !== current.cards.length - 1) return previousState;
    const choice = chooseConfiguration(current);
    if (choice && key(choice.expected) === key(choice.target.values) &&
      (inputTargets(command, current.factors[choice.factor]!.box) || frames.some(frame => confirmsClosingVisit(current, choice, frame, knownBorder)))) {
      return { ...previousState, witness: { epoch: after.level_epoch, factors: previous, visitedBorder: knownBorder, boundary: after.observation_ref } };
    }
    return previousState;
  }
  let next = before.level_epoch === after.level_epoch ? readCatalogue(after, second, knownBorder) : null;
  if (!next) return previousState;
  const currentValues = next.current;
  const differences = current.current.flatMap((value, index) => value === currentValues[index] ? [] : [index]);
  if (differences.length !== 1) return previousState;
  const priorCard = next.cards.find(card => key(card.values) === key(current.current));
  if (!priorCard || next.cards.find(card => key(card.values) === key(currentValues))?.border === priorCard.border) return previousState;
  const border = knownBorder ?? priorCard.border;
  if (knownBorder === null) next = readCatalogue(after, second, border);
  if (!next) return previousState;
  const index = differences[0]!, factor = current.factors[index]!;
  if (next.current[index] !== nextValue(factor, factor.active) || !verifyChange(current, next, next.current)) return previousState;
  return { ...previousState, learned: { epoch: before.level_epoch, visitedBorder: border, factors: [...previous.filter(entry => key(entry.values) !== key(factor.values)),
    { values: factor.values, input: command.action_ref, ref: after.observation_ref }] } };
}

export function projectRecalledCatalogue(transfer: CatalogueAcquisition, observation: NativeObservation, rows: NativeRows, remaining: number) {
  const { witness } = transfer;
  if (witness?.epoch !== observation.level_epoch) return null;
  const scene = readCatalogue(observation, rows, witness.visitedBorder);
  if (!scene || scene.cards.length - scene.visited.length > remaining) return null;
  const reused = witness.factors.filter(known => scene.factors.some(factor => key(factor.values) === key(known.values)));
  if (reused.length < 2 && witness.factors.filter(known => known.input === 'ACTION6').length < 2) return null;
  const choice = chooseConfiguration(scene);
  if (!choice) return null;
  const factor = scene.factors[choice.factor]!;
  const proof = [...new Set([...witness.factors, ...transfer.learned?.factors ?? []].map(item => item.ref))];
  return { scene, choice, border: witness.visitedBorder, box: factor.box, point: center(factor.box), evidence: [...proof, witness.boundary],
    novelty: ![...witness.factors, ...transfer.learned?.factors ?? []].some(known => key(known.values) === key(factor.values)) };
}

export function checkRecalledCatalogue({ scene, choice, border }: NonNullable<ReturnType<typeof projectRecalledCatalogue>>,
  after: NativeObservation, rows: NativeRows) {
  const next = readCatalogue(after, rows, border);
  return !!next && verifyChange(scene, next, choice.expected);
}

export function createSicVisibleConfigurationCoverage(): NativeFamily<Proposal> {
  let learned: Calibration | null = null;
  let witness: Witness | null = null;
  let stopped: number | null = null;
  return {
    id: visibleConfigurationCoverageId,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      const retained = acquireCatalogueReturn({ ...(learned ? { learned } : {}), ...(witness ? { witness } : {}) },
        before, after, command, first, second, frames);
      learned = retained?.learned ?? null;
      witness = retained?.witness ?? null;
    },
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || witness?.epoch !== observation.level_epoch || stopped === observation.level_epoch) return null;
      const current = readCatalogue(observation, rows, witness.visitedBorder);
      if (!current) return null;
      const transferable = witness.factors.filter(known => current.factors.some(factor => key(factor.values) === key(known.values)));
      const clickEvidence = witness.factors.filter(known => known.input === 'ACTION6');
      if (transferable.length < 2 && clickEvidence.length < 2) return null;
      if (current.cards.length - current.visited.length > remaining) return null;
      const choice = chooseConfiguration(current);
      if (!choice) return null;
      const factor = current.factors[choice.factor]!;
      const learnedHere = learned?.epoch === observation.level_epoch ? learned.factors : [];
      const observations = [...transferable, ...learnedHere];
      const known = observations.some(entry => key(entry.values) === key(factor.values));
      const strategy = known ? 'cover_next_configuration' : 'test_visible_factor_cycle', label = visibleConfigurationStrategies[strategy];
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const support = transferable.length >= 2 ? observations : [...clickEvidence, ...observations];
      const evidence: [string, ...string[]] = [ref, ...new Set([witness.boundary, ...support.map(entry => entry.ref)].filter(item => item !== ref))];
      const [x, y] = center(factor.box), action = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      const goal = { kind: 'cover_displayed_tuple_catalogue', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['visible_factor', 'unvisited_configuration'], parentObjective: parent,
        satisfactionContract: 'displayed_tuples_acquired_and_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `configuration-coverage:${need.id}`;
      return { status: 'proposed', kind: visibleConfigurationCoverageId, actions, choice, current, needId: need.id,
        steps: [{ action, point_binding: pointBinding, expected_after: choice.expected }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Visit the remaining configurations shown in the catalogue',
          situation: label, mode: known ? 'solving' : 'exploration', agenda: [], evidence, factor: factor.box,
          target: choice.target.box, visited: current.visited.length, total: current.cards.length },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'displayed_factor_bound' : 'visible_catalogue_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const next = readCatalogue(after, second, witness?.visitedBorder);
      const matched = !!next && verifyChange(proposal.current, next, proposal.choice.expected);
      return { matched, seal_prefix: true, reason: matched ? 'configuration_and_visit_confirmed' : 'visible_factor_prediction_contradicted' };
    },
    record(before, after, command, first, second, proposal, _index, frames) {
      this.observePublicOutcome!(before, after, command, first, second, frames);
      if (before.level_epoch === after.level_epoch) {
        const next = readCatalogue(after, second, witness?.visitedBorder);
        if (!next || !verifyChange(proposal.current, next, proposal.choice.expected)) stopped = before.level_epoch;
      }
      return { events: [] };
    },
    state: () => ({ learned, witness, stopped }),
    restore(value: NativeRecord) {
      learned = structuredClone((value.learned as Calibration | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      stopped = typeof value.stopped === 'number' ? value.stopped : null;
    },
  };
}
