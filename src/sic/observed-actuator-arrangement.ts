import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { relativeArrangementCell, relativeArrangementEffect, relativeArrangementProject, translatedRelativeArrangementTargets,
  type RelativeArrangementCell, type RelativeArrangementLayout, type RelativeArrangementPad, type RelativeArrangementPoint } from '../logos-engine/v6-relative-arrangements-geometry.ts';
import { relativeArrangementAssignments, type RelativeArrangementPair } from '../logos-engine/v6-relative-arrangements-planner.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const observedActuatorArrangementId = 'sic_compose_observed_actuator_effects';

type Point = RelativeArrangementPoint;
type Axis = 0 | 1;
type Gains = [number | null, number | null];
type SelectedPad = RelativeArrangementPad & { selected: RelativeArrangementCell };
type Select = { kind: 'select'; point: Point; piece: Point; goal?: Point; measuredRoute?: true };
type Learn = { kind: 'learn'; point: Point; axis: Axis; pad: string; marker: Point; goal?: Point };
type Place = { kind: 'place'; point: Point; pad: string; marker: Point; expected: Point; goal: Point };
type Choice = Select | Learn | Place;
type Memory = { epoch: number; scope: string; gains: Record<string, Gains>; pieces: Record<string, SelectedPad[]>;
  rejected: string[]; refs: string[]; blocked: boolean; destination?: ReturnType<typeof translatedRelativeArrangementTargets>[number] };
type Witness = { epoch: number; score: number; refs: string[]; shape?: Point; gains?: Record<string, Gains> };
type Proposal = NativeProposal & { layout: RelativeArrangementLayout; memory: Memory; choice: Choice; needId: string };
type Waypoint = { point: Point; pad: string; marker: Point; expected: Point };
type Route = { at: Point; markers: Point[]; depth: number; first: Waypoint | null };

const pointKey = ([x, y]: NativePoint) => `${x},${y}`;
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const pieceKey = ({ xy, value }: RelativeArrangementCell) => `${pointKey(xy)}/${value}`;
const gainKey = (value: number, pad: string) => `${value}/${pad}`;
const wrapped = (value: number, width: number) => ((value % width) + width) % width;
const activePads = ({ pads }: RelativeArrangementLayout): SelectedPad[] =>
  pads.filter((pad): pad is SelectedPad => pad.selected !== null);
const gainsFor = (memory: Memory, value: number, pad: string): Gains => memory.gains[gainKey(value, pad)] ?? [null, null];
const trialKey = (piece: RelativeArrangementCell, pad: string, from: Point, to: Point) =>
  `${pieceKey(piece)}/${pad}/${pointKey(from)}/${pointKey(to)}`;

function learnAxis(layout: RelativeArrangementLayout, memory: Memory): Learn | null {
  if (!layout.selected) return null;
  for (const pad of activePads(layout)) for (const axis of [0, 1] as const) {
    if (gainsFor(memory, layout.selected.value, pad.ref)[axis] !== null) continue;
    const from = pad.selected.xy, other = axis === 0 ? 1 : 0;
    const choices = pad.cells.filter(cell => cell.xy[other] === from[other] && Math.abs(cell.xy[axis] - from[axis]) === 1)
      .sort((a, b) => b.xy[axis] - a.xy[axis]);
    const target = choices.find(cell => !memory.rejected.includes(trialKey(layout.selected!, pad.ref, from, cell.xy)));
    if (target) return { kind: 'learn', point: target.point, axis, pad: pad.ref, marker: target.xy };
  }
  return null;
}

function rememberSelection(memory: Memory, layout: RelativeArrangementLayout): Memory {
  if (!layout.selected) return memory;
  return { ...memory, pieces: { ...memory.pieces, [pieceKey(layout.selected)]: activePads(layout) } };
}

function needsCalibration(memory: Memory, object: RelativeArrangementCell): boolean {
  const pads = memory.pieces[pieceKey(object)];
  return !pads?.length || pads.some(pad => gainsFor(memory, object.value, pad.ref).includes(null));
}

function routesFor(layout: RelativeArrangementLayout, memory: Memory, object: RelativeArrangementCell,
  options: { partial?: boolean; ignoreOccupied?: boolean } = {}): Map<string, Route> {
  const pads = memory.pieces[pieceKey(object)]!;
  const markers = pads.map(pad => pad.selected.xy), occupied = new Set(layout.objects
    .filter(peer => !equal(peer.xy, object.xy)).map(peer => pointKey(peer.xy)));
  const stateKey = (values: Point[]) => values.map(pointKey).join(';');
  const seen = new Set([stateKey(markers)]), rejected = new Set(memory.rejected), routes = new Map<string, Route>();
  const queue: Route[] = [{ at: object.xy, markers, depth: 0, first: null }];
  for (let cursor = 0; cursor < queue.length && cursor < 2_048; cursor++) {
    const current = queue[cursor]!, location = pointKey(current.at);
    if (!routes.has(location)) routes.set(location, current);
    for (const [index, pad] of pads.entries()) {
      const [horizontal, vertical] = gainsFor(memory, object.value, pad.ref);
      if (options.partial ? horizontal === null && vertical === null : horizontal === null || vertical === null) continue;
      const from = current.markers[index]!;
      for (const choice of pad.cells) {
        const offset = [choice.xy[0] - from[0], choice.xy[1] - from[1]];
        if (horizontal === null && offset[0] || vertical === null && offset[1]) continue;
        const markers = current.markers.map((value, j) => j === index ? choice.xy : value), id = stateKey(markers);
        if (seen.has(id) || !options.ignoreOccupied && rejected.has(trialKey({ ...object, xy: current.at }, pad.ref, from, choice.xy))) continue;
        const at: Point = [wrapped(current.at[0] + offset[0]! * (horizontal ?? 0), layout.shape[0]),
          wrapped(current.at[1] + offset[1]! * (vertical ?? 0), layout.shape[1])];
        if (!options.ignoreOccupied && occupied.has(pointKey(at))) continue;
        seen.add(id);
        queue.push({ at, markers, depth: current.depth + 1, first: current.first
          ?? { point: choice.point, pad: pad.ref, marker: choice.xy, expected: at } });
      }
    }
  }
  return routes;
}

const distance = (a: Point, b: Point) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const byPosition = (a: Point, b: Point) => a[1] - b[1] || a[0] - b[0];
const byPlacement = (a: RelativeArrangementPair, b: RelativeArrangementPair) => byPosition(a.from, b.from) || byPosition(a.to, b.to);

function chooseTowardDestination(layout: RelativeArrangementLayout, memory: Memory): Choice | null {
  if (!memory.destination) return null;
  const knownRoutes = new Map(layout.objects.filter(object => !needsCalibration(memory, object))
    .map(object => [pointKey(object.xy), routesFor(layout, memory, object, { ignoreOccupied: true })]));
  const plans = relativeArrangementAssignments(layout, [memory.destination], 720)
    .filter(plan => plan.moves.length && plan.moves.every(move => knownRoutes.get(pointKey(move.from))?.has(pointKey(move.to)) ?? true))
    .sort((a, b) => a.moves.length - b.moves.length || a.distance - b.distance);
  const moves = plans[0]?.moves;
  if (!moves) return null;
  const available = [...moves].sort((a, b) => distance(a.from, a.to) - distance(b.from, b.to)
    || a.from[0] - b.from[0] || a.from[1] - b.from[1]);
  const occupied = new Set(layout.objects.map(object => pointKey(object.xy)));
  const next = available.find(move => layout.selected && equal(move.from, layout.selected.xy) && !occupied.has(pointKey(move.to)))
    ?? available.find(move => !occupied.has(pointKey(move.to)));
  if (!next) return null;
  const object = layout.objects.find(cell => equal(cell.xy, next.from))!;
  if (!layout.selected || !equal(layout.selected.xy, object.xy)) {
    return { kind: 'select', point: object.point, piece: object.xy, goal: next.to };
  }
  const measured = routesFor(layout, memory, object, { partial: true }).get(pointKey(next.to))?.first;
  if (measured) return { kind: 'place', ...measured, goal: next.to };
  for (const pad of activePads(layout)) for (const axis of [0, 1] as const) {
    const residual = next.to[axis] - object.xy[axis];
    if (!residual || gainsFor(memory, object.value, pad.ref)[axis] !== null) continue;
    const other = axis === 0 ? 1 : 0, from = pad.selected.xy, direction = Math.sign(residual);
    const target = pad.cells.find(cell => cell.xy[other] === from[other] && cell.xy[axis] === from[axis] + direction);
    if (!target || memory.rejected.includes(trialKey(object, pad.ref, from, target.xy))) continue;
    const predicted: Point = [...object.xy];
    predicted[axis] = wrapped(predicted[axis] + direction, layout.shape[axis]);
    if (occupied.has(pointKey(predicted))) continue;
    return { kind: 'learn', point: target.point, axis, pad: pad.ref, marker: target.xy, goal: next.to };
  }
  return null;
}

function choose(layout: RelativeArrangementLayout, memory: Memory): Choice | null {
  const unknown = layout.objects.find(object => needsCalibration(memory, object));
  if (unknown) {
    return chooseTowardDestination(layout, memory) ?? learnAxis(layout, memory)
      ?? (layout.selected && equal(unknown.xy, layout.selected.xy) ? null : { kind: 'select', point: unknown.point, piece: unknown.xy });
  }

  const objects = new Map(layout.objects.map(object => [pointKey(object.xy), object]));
  const paths = new Map(layout.objects.map(object => [pointKey(object.xy), routesFor(layout, memory, object)]));
  function chooseReachable(targets: ReturnType<typeof translatedRelativeArrangementTargets>): Choice | null {
    let chosen: Choice | null = null, bestCost = Infinity, bestPairs: RelativeArrangementPair[] = [];
    for (const { pairs } of relativeArrangementAssignments(layout, targets, 720)) {
      const ordered = [...pairs].sort(byPlacement);
      const trips = ordered.map(pair => ({ pair, route: paths.get(pointKey(pair.from))?.get(pointKey(pair.to)) }));
      if (trips.some(trip => !trip.route)) continue;
      const cost = trips.reduce((sum, trip) => sum + trip.route!.depth, 0);
      if (cost > bestCost || cost === 0) continue;
      if (cost === bestCost) {
        const firstDifference = ordered.map((pair, i) => byPlacement(pair, bestPairs[i]!)).find(order => order !== 0);
        if (firstDifference === undefined || firstDifference > 0) continue;
      }
      const moving = trips.find(trip => trip.route!.first && layout.selected && equal(layout.selected.xy, trip.pair.from))
        ?? trips.find(trip => trip.route!.first);
      if (!moving) continue;
      bestCost = cost;
      bestPairs = ordered;
      chosen = layout.selected && equal(layout.selected.xy, moving.pair.from)
        ? { kind: 'place', ...moving.route!.first!, goal: moving.pair.to }
        : { kind: 'select', point: objects.get(pointKey(moving.pair.from))!.point, piece: moving.pair.from,
          goal: moving.pair.to, measuredRoute: true };
    }
    return chosen;
  }
  const anchored = chooseReachable(translatedRelativeArrangementTargets(layout));
  if (anchored) return anchored;
  const anchor = layout.legend.features[0]!;
  const reachable = layout.objects.filter(object => object.value === anchor.value).flatMap(object =>
    [...paths.get(pointKey(object.xy))!.values()].map(route => ({ xy: route.at, value: object.value })));
  return chooseReachable(translatedRelativeArrangementTargets(layout, reachable));
}

function layoutBox(layout: RelativeArrangementLayout, [column, row]: NativePoint): NativeBox {
  const x = layout.board[0] + 1 + column * layout.size, y = layout.board[1] + 1 + row * layout.size;
  return [x, y, x + layout.size - 1, y + layout.size - 1];
}

function reachesLegend(layout: RelativeArrangementLayout, rows: NativeRows): boolean {
  const values = new Set(layout.legend.features.map(feature => feature.value)), objects: RelativeArrangementCell[] = [];
  for (let row = 0; row < layout.shape[1]; row++) for (let column = 0; column < layout.shape[0]; column++) {
    const [x, y] = layoutBox(layout, [column, row]);
    const cell = relativeArrangementCell(rows, x, y, layout.size);
    if (cell && values.has(cell.value)) objects.push({ xy: [column, row], ...cell });
  }
  return objects.length === layout.objects.length && translatedRelativeArrangementTargets({ ...layout, objects })
    .some(target => target.already_preserved.length === objects.length);
}

function verifyChoice(layout: RelativeArrangementLayout, next: RelativeArrangementLayout | null, choice: Choice): boolean {
  if (!next?.selected || next.scope_ref !== layout.scope_ref) return false;
  if (choice.kind === 'select') return equal(next.selected.xy, choice.piece)
    && next.objects.every(object => layout.objects.some(old => old.value === object.value && equal(old.xy, object.xy)));
  const marker = next.pads.find(pad => pad.ref === choice.pad)?.selected;
  if (!marker || !equal(marker.xy, choice.marker) || !layout.selected || next.selected.value !== layout.selected.value) return false;
  if (!layout.objects.every(object => equal(object.xy, layout.selected!.xy)
    || next.objects.some(kept => kept.value === object.value && equal(kept.xy, object.xy)))) return false;
  return choice.kind === 'place' ? equal(next.selected.xy, choice.expected)
    : next.selected.xy[choice.axis === 0 ? 1 : 0] === layout.selected.xy[choice.axis === 0 ? 1 : 0];
}

export function createSicObservedActuatorArrangement(): NativeFamily<Proposal> {
  let training: { epoch: number; refs: string[] } | null = null;
  let witness: Witness | null = null, state: Memory | null = null;
  return {
    id: observedActuatorArrangementId,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      if (before.frame_hash === after.frame_hash || !['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6']
        .every(action => before.available_action_refs.includes(action))) return;
      const previous = training?.epoch === before.level_epoch ? training : null;
      const layout = relativeArrangementProject(before, first);
      if (!layout) return;
      if (after.levels_completed > before.levels_completed) {
        if (previous && frames.some(frame => reachesLegend(layout, frame))) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, refs: [...previous.refs, after.observation_ref] };
        }
        return;
      }
      if (before.level_epoch !== after.level_epoch) return;
      const observed = relativeArrangementEffect(layout, relativeArrangementProject(after, second), command);
      if (observed.status === 'single_object_and_actuator_displacement') {
        training = { epoch: before.level_epoch, refs: [...new Set([...(previous?.refs ?? []).slice(-4),
          before.observation_ref, after.observation_ref])] };
      }
    },
    async propose(observation, rows, _inputs, remaining) {
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed || remaining < 1
        || !observation.available_action_refs.includes('ACTION6')) return null;
      const layout = relativeArrangementProject(observation, rows);
      if (!layout || layout.pads.length > 3) return null;
      const prior = state?.epoch === observation.level_epoch && state.scope === layout.scope_ref ? state : null;
      if (prior?.blocked) return null;
      let transferred: Record<string, Gains> | undefined;
      if (!prior && witness.shape && equal(witness.shape, layout.shape) && witness.gains) {
        const colors = new Set(layout.objects.map(object => object.value));
        const availableGains = new Set([...colors].flatMap(color => layout.pads.map(pad => gainKey(color, pad.ref))));
        transferred = Object.fromEntries(Object.entries(witness.gains).filter(([key]) => availableGains.has(key)));
      }
      const goals = transferred && Object.keys(transferred).length ? translatedRelativeArrangementTargets(layout) : [];
      const nearby = goals.sort((a, b) => b.already_preserved.length - a.already_preserved.length)[0];
      const memory = rememberSelection(prior ?? { epoch: observation.level_epoch, scope: layout.scope_ref,
        gains: transferred ?? {}, pieces: {}, rejected: [], refs: witness.refs, blocked: false,
        ...(nearby?.already_preserved.length && nearby.remove.length ? { destination: nearby } : {}) }, layout);
      const choice = choose(layout, memory);
      if (!choice) return null;
      const [x, y] = choice.point, ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...new Set(memory.refs.filter(value => value !== ref))];
      const reason = choice.kind === 'select' ? choice.measuredRoute ? 'Select a piece with a measured route to its place in the arrangement'
        : choice.goal ? 'Keep the matching pieces in place and select a displaced piece'
        : 'Select the piece and read its current controls'
        : choice.kind === 'learn' ? choice.goal ? 'Test one control axis toward the missing position'
          : 'Change one control axis and measure the piece displacement'
          : 'Combine measured control effects to match the visible arrangement';
      const action: NativeCommand = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason, evidence });
      if (!binding) return null;
      const objective = { kind: 'match_relative_layout_with_measured_controls', scope: layout.scope_ref,
        subjects: ['selected_piece', 'active_control', 'relative_example'], parentObjective: parent,
        satisfactionContract: 'verify_composed_displacements_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `relative-motion:${need.id}`, strategy = choice.kind === 'place' ? 'P07' : 'P05';
      const focus = choice.kind === 'select' ? choice.piece : layout.selected!.xy;
      return { status: 'proposed', kind: observedActuatorArrangementId, actions, layout, memory, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: choice.kind === 'place' ? choice.expected : null }],
        sicSituationCard: { strategy, mode: choice.kind === 'place' ? 'solving' : 'exploration',
          need: 'Match the relative positions shown by the example', situation: reason, evidence, agenda: [],
          focus: layoutBox(layout, focus), reference: layout.legend.box, control: [x - 1, y - 1, x + 1, y + 1],
          destination: choice.goal ? layoutBox(layout, choice.goal) : null },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_relative_layout_bound' : 'relative_layout_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = verifyChoice(proposal.layout, relativeArrangementProject(after, second), proposal.choice);
      return { matched, seal_prefix: true, reason: matched ? 'selected_piece_and_control_return_verified' : 'relative_motion_prediction_differs' };
    },
    record(before, after, _action, _first, second, proposal) {
      const { layout, choice, memory } = proposal;
      if (after.levels_completed > before.levels_completed) {
        witness = { epoch: after.level_epoch, score: after.levels_completed, refs: [...memory.refs.slice(-5), after.observation_ref],
          shape: layout.shape, gains: memory.gains };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = relativeArrangementProject(after, second), matched = verifyChoice(layout, next, choice);
      const update = { ...memory, pieces: { ...memory.pieces }, gains: { ...memory.gains },
        refs: [...memory.refs.slice(-6), after.observation_ref], blocked: !next || choice.kind === 'select' && !matched };
      if (next?.selected && layout.selected && choice.kind !== 'select') {
        const old = layout.selected, oldPad = activePads(layout).find(pad => pad.ref === choice.pad)!;
        const { pieces, gains } = update, label = gainKey(old.value, choice.pad);
        if (!equal(old.xy, next.selected.xy)) delete pieces[pieceKey(old)];
        if (matched && choice.kind === 'learn') {
          const axis = choice.axis, d = choice.marker[axis] - oldPad.selected.xy[axis];
          const coefficient = wrapped((next.selected.xy[axis] - old.xy[axis]) * d, layout.shape[axis]);
          const measured: Gains = [...(gains[label] ?? [null, null])];
          measured[axis] = coefficient;
          gains[label] = measured;
        }
        if (!matched) {
          update.rejected = [...memory.rejected.slice(-31), trialKey(old, choice.pad, oldPad.selected.xy, choice.marker)];
          if (choice.kind === 'place') delete gains[label];
        }
      }
      state = next ? rememberSelection(update, next) : update;
      return { events: [] };
    },
    state: () => ({ training, witness, state }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as typeof training | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | null | undefined) ?? null);
      state = structuredClone((value.state as Memory | null | undefined) ?? null);
    },
  };
}
