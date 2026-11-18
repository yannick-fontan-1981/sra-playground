import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { chooseClearanceRoute, clearanceEdge, clearanceMoved, clearanceObserved, clearanceProject, extensionButtonMask,
  readClearanceLayout, type ClearanceLayout, type ClearanceMove, type ClearanceProjection, type ExtensionWitness } from './extension-clearance.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { chooseTurningRoute, initialTurningPose, moveTurningPose, projectTurningPose, readTurningLayout, turningEdge, turningObserved,
  type TurningLayout, type TurningMove, type TurningPose, type TurnSign } from './turning-extensions.ts';

export const coupledGaugeRouteId = 'sic_route_by_measured_extensions';

type Part = Pick<NativeEntity, 'palette_value' | 'bbox' | 'area' | 'rectangular'>;
type Button = { readonly box: NativeBox; readonly point: NativePoint };
type Control = { readonly color: number; readonly buttons: readonly [Button, Button] };
type Layout = { readonly marker: NativePoint; readonly bodies: readonly NativeBox[] };
type Scene = {
  readonly controls: readonly Control[];
  readonly base: Layout;
  readonly target: NativePoint;
  readonly marks: readonly NativePoint[];
  readonly markerColor: number;
  readonly divider: NativeBox;
  readonly field: NativeBox;
};
type Move = { readonly index: number; readonly delta: 1 | -1 };
type Effect = {
  readonly expand: 0 | 1;
  readonly shift: NativePoint;
  readonly side: 0 | 1 | 2 | 3;
  readonly carried: readonly number[];
  readonly evidence: readonly string[];
};
type Memory = {
  readonly epoch: number;
  readonly scene: Scene;
  readonly measured: readonly Effect[];
  readonly pending: Effect | null;
  readonly ineffective: 0 | 1 | null;
  readonly lengths: readonly number[];
  readonly route: readonly Move[];
  readonly blocked: readonly string[];
  readonly lastRef: string;
  readonly stopped: boolean;
};
type Step = {
  readonly kind: 'measure' | 'reverse' | 'route';
  readonly button: 0 | 1;
  readonly index: number;
  readonly move?: Move;
  readonly expected: Layout | null;
};
type Proposal = NativeProposal & { readonly memory: Memory; readonly step: Step; readonly needId: string };
type ClearanceMemory = { epoch: number; layout: ClearanceLayout; lengths: number[]; route: ClearanceMove[];
  blocked: string[]; refs: string[]; lastRef: string; stopped: boolean };
type ClearanceProposal = NativeProposal & { clearance: ClearanceMemory; expected: ClearanceProjection; move: ClearanceMove; needId: string };
type TurningMemory = { epoch: number; lastRef: string; layout: TurningLayout; pose: TurningPose; direction: TurnSign | null;
  hypothesis: TurnSign; route: TurningMove[]; blocked: string[]; refs: string[]; stopped: boolean };
type TurningStep = { move: TurningMove; before: TurningPose; after: TurningPose };
type TurningProposal = NativeProposal & { turning: TurningMemory; turns: TurningStep[]; probe: boolean; needId: string };
type GaugeProposal = Proposal | ClearanceProposal | TurningProposal;
const isClearance = (proposal: GaugeProposal): proposal is ClearanceProposal => 'clearance' in proposal;
const isTurning = (proposal: GaugeProposal): proposal is TurningProposal => 'turning' in proposal;

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const sameLayout = (a: Layout, b: Layout) => same(a.marker, b.marker) && a.bodies.length === b.bodies.length &&
  a.bodies.every((box, i) => same(box, b.bodies[i]!));
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const dot = ([x, y]: NativePoint): NativeBox => [x, y, x, y];
const translate = ([l, t, r, b]: NativeBox, [dx, dy]: NativePoint): NativeBox => [l + dx, t + dy, r + dx, b + dy];
const inside = (a: NativeBox, b: NativeBox) => a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
const overlaps = (a: NativeBox, b: NativeBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const otherButton = (button: 0 | 1): 0 | 1 => button === 0 ? 1 : 0;
const movedBy = (lengths: readonly number[], { index, delta }: Move) => lengths.map((length, i) => i === index ? length + delta : length);
const edgeKey = (lengths: readonly number[], { index, delta }: Move) => `${lengths.join(',')}|${index}|${delta}`;

function readLayout(parts: readonly Part[], scene: Omit<Scene, 'base'>): Layout | null {
  if (!parts.some(part => same(part.bbox, scene.divider))) return null;
  const field = parts.filter(part => inside(part.bbox, scene.field));
  const dots = field.filter(part => part.palette_value === scene.markerColor && part.area === 1).map(part => center(part.bbox));
  if (dots.length !== scene.marks.length + 1 || !scene.marks.every(mark => dots.some(point => same(point, mark)))) return null;
  const marker = dots.find(point => !scene.marks.some(mark => same(point, mark)))!;
  const bodies = [];
  for (const control of scene.controls) {
    const matching = field.filter(part => part.palette_value === control.color);
    if (matching.length !== 1) return null;
    bodies.push(matching[0]!.bbox);
  }
  return { marker, bodies };
}

function readScene(parts: readonly Part[], width: number, height: number): Scene | null {
  const maxSize = Math.floor(Math.min(width, height) / 8);
  const rowsOfControls = new Map<string, Part[]>();
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1, height = bottom - top + 1;
    if (width < 2 || height < 2 || Math.max(width, height) > maxSize) continue;
    const key = [top, width, height, part.area].join(',');
    const group = rowsOfControls.get(key) ?? [];
    group.push(part);
    rowsOfControls.set(key, group);
  }
  const candidates = [...rowsOfControls.values()].flatMap(keycaps => {
    if (keycaps.length < 4 || keycaps.length > 8 || keycaps.length % 2) return [];
    return scenesForControls(width, parts, keycaps);
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function scenesForControls(width: number, parts: readonly Part[], keycaps: readonly Part[]): Scene[] {
  const controls: Control[] = [];
  for (const color of new Set(keycaps.map(part => part.palette_value))) {
    const pair = keycaps.filter(part => part.palette_value === color).map(part => ({ box: part.bbox, point: center(part.bbox) }));
    if (pair.length !== 2) return [];
    controls.push({ color, buttons: [pair[0]!, pair[1]!] });
  }
  const field: NativeBox = [0, 0, width - 1, keycaps[0]!.bbox[1] - 1];
  const fieldParts = parts.filter(part => inside(part.bbox, field) && controls.every(control => part.palette_value !== control.color));
  const dividers = fieldParts.filter(({ rectangular, bbox: [l, t, r, b] }) => rectangular &&
    Math.min(r - l, b - t) >= 1 && Math.max(r - l, b - t) >= 5 * Math.min(r - l, b - t));
  const dots = fieldParts.filter(part => part.area === 1);
  const candidates: Scene[] = [];
  for (const moving of dots) {
    const marks = dots.filter(part => part.palette_value === moving.palette_value && part !== moving).map(part => center(part.bbox));
    if (marks.length !== 4) continue;
    const [left, , , right] = marks.map(([x]) => x).sort((a, b) => a - b);
    const [top, , , bottom] = marks.map(([, y]) => y).sort((a, b) => a - b);
    const target: NativePoint = [(left! + right!) / 2, (top! + bottom!) / 2];
    const [x, y] = target;
    if (left === right || top === bottom || !target.every(Number.isInteger) ||
      ![[left!, y], [right!, y], [x, top!], [x, bottom!]].every(arm => marks.some(mark => same(mark, arm)))) continue;
    const marker = center(moving.bbox);
    const divider = dividers.filter(({ bbox }) => {
      const axis = bbox[2] - bbox[0] < bbox[3] - bbox[1] ? 0 : 1;
      const [first, last] = [marker[axis], target[axis]].sort((a, b) => a - b);
      return first! < bbox[axis] && last! > bbox[axis + 2]!;
    });
    if (divider.length !== 1) continue;
    const scene = { controls, target, marks, markerColor: moving.palette_value, divider: divider[0]!.bbox, field };
    const base = readLayout(parts, scene);
    if (base && base.bodies.some(box => inside(dot(base.marker), box))) candidates.push({ ...scene, base });
  }
  return candidates;
}

function learnExtension(base: Layout, reported: Layout, index: number, expand: 0 | 1, ref: string): Effect | null {
  const shift: NativePoint = [reported.marker[0] - base.marker[0], reported.marker[1] - base.marker[1]];
  const [dx, dy] = shift;
  if ((dx === 0) === (dy === 0)) return null;
  const side = dx ? (dx > 0 ? 2 : 0) : (dy > 0 ? 3 : 1);
  const expected: [number, number, number, number] = [...base.bodies[index]!];
  expected[side] += dx + dy;
  if (!same(expected, reported.bodies[index]!)) return null;
  const carried: number[] = [];
  for (const [i, box] of base.bodies.entries()) {
    if (i === index || same(box, reported.bodies[i]!)) continue;
    if (!same(translate(box, shift), reported.bodies[i]!)) return null;
    carried.push(i);
  }
  return { expand, shift, side, carried, evidence: [ref] };
}

function project(base: Layout, effects: readonly Effect[], lengths: readonly number[]): Layout {
  const bodies = base.bodies.map(box => [...box] as [number, number, number, number]);
  let [x, y] = base.marker;
  for (const [index, effect] of effects.entries()) {
    const length = lengths[index] ?? 0, dx = length * effect.shift[0], dy = length * effect.shift[1];
    if (!length) continue;
    bodies[index]![effect.side] += dx + dy;
    for (const i of effect.carried) bodies[i] = [...translate(bodies[i]!, [dx, dy])];
    x += dx;
    y += dy;
  }
  return { bodies, marker: [x, y] };
}

function findRoute(memory: Memory): readonly Move[] {
  const { scene, measured, lengths } = memory;
  if (!measured.some(effect => effect.carried.length)) return [];
  const blocked = new Set(memory.blocked);
  const seen = new Set([lengths.join(',')]);
  type Node = { readonly lengths: readonly number[]; readonly parent: number; readonly move?: Move };
  const queue: Node[] = [{ lengths, parent: -1 }];
  for (let i = 0; i < queue.length && i < 30_000; i++) {
    const node = queue[i]!;
    if (same(project(scene.base, measured, node.lengths).marker, scene.target)) {
      const route: Move[] = [];
      for (let at = node; at.move; at = queue[at.parent]!) route.push(at.move);
      return route.reverse();
    }
    for (const index of measured.keys()) for (const delta of [1, -1] as const) {
      const move = { index, delta };
      if (blocked.has(edgeKey(node.lengths, move))) continue;
      const next = movedBy(node.lengths, move), key = next.join(',');
      if (next[index]! < 0 || seen.has(key)) continue;
      seen.add(key);
      const { bodies, marker } = project(scene.base, measured, next);
      if ([...bodies, dot(marker)].some(box => !inside(box, scene.field) || overlaps(box, scene.divider))) continue;
      queue.push({ lengths: next, parent: i, move });
    }
  }
  return [];
}

function planStep(memory: Memory): Step | null {
  const index = memory.measured.length;
  if (memory.pending) return { kind: 'reverse', index, button: otherButton(memory.pending.expand), expected: memory.scene.base };
  if (index < memory.scene.controls.length) {
    return { kind: 'measure', index, button: memory.ineffective === 0 ? 1 : 0, expected: null };
  }
  const move = memory.route[0];
  if (!move) return null;
  const { expand } = memory.measured[move.index]!;
  return { kind: 'route', index: move.index, move, button: move.delta === 1 ? expand : otherButton(expand),
    expected: project(memory.scene.base, memory.measured, movedBy(memory.lengths, move)) };
}

export function createSicCoupledGaugeRoute(): NativeFamily<GaugeProposal> {
  let state: Memory | null = null;
  let clearance: ClearanceMemory | null = null;
  let turning: TurningMemory | null = null;
  let witnessed: ExtensionWitness | null = null;
  let decide: NativeProgramHandle | undefined;
  async function offerTurning(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<TurningProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: available } = observation;
    if (!decide || witnessed?.epoch !== epoch || remaining < 1 || available.length !== 1 || available[0] !== 'ACTION6') return null;
    const prior = turning?.epoch === epoch ? turning : null;
    if (prior && (prior.stopped || prior.lastRef !== ref)) return null;
    const layout = prior?.layout ?? readTurningLayout(rows, observation.entities, witnessed);
    if (!layout) return null;
    const current: TurningMemory = prior ?? { epoch, lastRef: ref, layout, pose: initialTurningPose(layout), direction: null,
      hypothesis: 1, route: [], blocked: [], refs: [], stopped: false };
    if (!turningObserved(rows, layout, current.pose)) return null;
    let hypothesis = current.hypothesis;
    let route = current.route.length <= remaining ? current.route : [];
    if (!route.length) {
      route = await chooseTurningRoute(layout, current.pose, hypothesis, current.blocked, remaining, execution);
      if (!route.length && current.direction === null) {
        hypothesis = hypothesis === 1 ? -1 : 1;
        route = await chooseTurningRoute(layout, current.pose, hypothesis, current.blocked, remaining, execution);
      }
    }
    const first = route[0];
    if (!first) return null;
    const unknown = current.direction === null ? route.findIndex(move => move.operation === 'turn') : -1;
    const probe = unknown === 0, strategy = probe ? 'P05' : 'P02', mode = execution?.reasoningMode ?? 'solving';
    const facts = { repeatSupportedInteraction: !probe, probeNeededInteraction: probe, mode };
    const decision = await decide.run({ situation: facts }, { signal: execution?.signal });
    if (decision.result !== strategy) return null;
    const evidence: [string, ...string[]] = [ref, ...new Set([...witnessed.evidence, ...current.refs].filter(value => value !== ref))];
    const situation = probe ? 'Measure which bars rotate around the selected pivot'
      : first.operation === 'turn' ? 'Rotate the linked bars to clear a path around an obstacle'
        : 'Adjust the length of the linked bars and advance the marker';
    const objective = { kind: 'align_linked_marker_by_turning_and_extending', scope: ref.split(':revision:', 1)[0]!,
      subjects: [layout.target.join(',')], parentObjective: 'G_official_completion', satisfactionContract: 'official_progress_after_marker_alignment' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
    const id = coupledGaugeRouteId + ':' + need.id;
    const actions: NativeCommand[] = [], steps: NativeRecord[] = [], turns: TurningStep[] = [];
    const count = probe ? 1 : Math.min(maximumCommittedActions, remaining, unknown < 0 ? route.length : unknown);
    let pose = current.pose;
    for (const move of route.slice(0, count)) {
      const button = layout.segments[move.body]!.buttons[move.operation];
      const point = await ObservedInputDomain.makeLocusWitness(observation, rows, button.at, { reason: situation, evidence });
      if (!point) break;
      const [x, y] = button.at, action = { action_ref: 'ACTION6', data: { x, y } };
      const next = moveTurningPose(pose, move, hypothesis);
      actions.push(action);
      steps.push({ action, point_binding: point, expected_after: probe ? null : projectTurningPose(layout, next) });
      turns.push({ move, before: pose, after: next });
      pose = next;
    }
    if (!actions.length) return null;
    const projected = projectTurningPose(layout, current.pose), next = projectTurningPose(layout, turns[0]!.after);
    const button = layout.segments[first.body]!.buttons[first.operation];
    return { status: 'proposed', kind: coupledGaugeRouteId, turning: { ...current, hypothesis, route }, turns, probe, needId: need.id,
      actions, steps, binding: { observation_ref: ref, level_epoch: epoch },
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
        edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Bring the marker to the visible target', situation, mode, evidence, agenda: [],
        triggerCard: chooseInteraction, focus: button.box, gauge: projected.parts[first.body]!.box,
        pivot: dot(projected.parts[first.body]!.pivot), carried: projected.parts.slice(first.body + 1).map(part => part.box),
        actor: dot(projected.marker), target: dot(layout.target), ...(probe ? {} : { landing: dot(next.marker) }) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + objective.parentObjective] }],
      sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent: objective.parentObjective }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective.parentObjective, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  async function offerClearance(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<ClearanceProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: actionsAvailable } = observation;
    if (!decide || witnessed?.epoch !== epoch || remaining < 1 || actionsAvailable.length !== 1 || actionsAvailable[0] !== 'ACTION6') return null;
    const prior = clearance?.epoch === epoch ? clearance : null;
    if (prior && (prior.stopped || prior.lastRef !== ref)) return null;
    const layout = prior?.layout ?? readClearanceLayout(rows, observation.entities, witnessed);
    if (!layout) return null;
    const current: ClearanceMemory = prior ?? { epoch, layout, lengths: layout.bodies.map(() => 0), route: [],
      blocked: [], refs: [], lastRef: ref, stopped: false };
    const geometry = clearanceProject(layout, current.lengths);
    if (!clearanceObserved(rows, layout, geometry)) return null;
    const route = current.route.length ? current.route : await chooseClearanceRoute(layout, current.lengths, current.blocked, remaining, execution);
    const move = route[0];
    if (!move) return null;
    const button = layout.bodies[move.body]!.buttons?.[move.delta === 1 ? 0 : 1];
    if (!button) return null;
    const mode = execution?.reasoningMode ?? 'solving', strategy = 'P02';
    const facts = { repeatSupportedInteraction: true, probeNeededInteraction: false, mode };
    const decision = await decide.run({ situation: facts }, { signal: execution?.signal });
    if (decision.result !== strategy) return null;
    const evidence: [string, ...string[]] = [ref, ...new Set([...witnessed.evidence, ...current.refs].filter(value => value !== ref))];
    const expected = clearanceProject(layout, clearanceMoved(current.lengths, move));
    const target = layout.targets.find(({ body }) => layout.coupledTargets
      ? !same(geometry.markers[body]!, expected.markers[body]!) : body === move.body);
    const start = target ? geometry.markers[target.body]! : null;
    const landing = target ? expected.markers[target.body]! : null;
    const reopensTarget = layout.coupledTargets && target && start && same(start, target.at);
    const restoresTarget = layout.coupledTargets && target && landing && same(landing, target.at)
      && same(layout.bodies[target.body]!.marker!, target.at);
    const situation = reopensTarget ? 'Move the aligned marker temporarily to give the other assembly room'
      : restoresTarget ? 'Restore the earlier alignment now that the other path is clear'
      : layout.coupledTargets && target ? 'Move the marked assembly along one axis while accounting for every linked bar'
      : move.receivers ? 'Extend all bars on the shared control after clearing their paths'
      : target ? 'Extend the marked bar along the cleared corridor toward its target'
        : layout.targets.length === 1 ? 'Move the obstructing group out of the paths of the linked bars'
          : 'Move the obstructing group so both marked bars can reach their targets';
    const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, button.point, { reason: situation, evidence });
    if (!witness) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'clear_corridors_for_marked_extensions', scope: ref.split(':revision:', 1)[0]!,
      subjects: layout.targets.map(goal => goal.at.join(',')), parentObjective: parent, satisfactionContract: 'official_progress_after_all_markers_align' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = coupledGaugeRouteId + ':' + need.id;
    const [x, y] = button.point, action = { action_ref: 'ACTION6', data: { x, y } };
    return { status: 'proposed', kind: coupledGaugeRouteId, clearance: { ...current, route }, expected, move, needId: need.id, actions: [action],
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action, point_binding: witness, expected_after: expected }],
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
        edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: layout.targets.length === 1 ? 'Make room for every bar driven by the shared control'
        : 'Free the paths to both visible targets', situation, mode, evidence, agenda: [],
        triggerCard: chooseInteraction, focus: button.box, gauge: geometry.boxes[move.body],
        carried: geometry.boxes.filter((box, index) => index !== move.body && !same(box, expected.boxes[index]!)),
        ...(target && start && landing ? { actor: dot(start), target: dot(target.at), landing: dot(landing) } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: coupledGaugeRouteId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      return group === observedMechanicsGroup ? await offerClearance(observation, rows, remaining, execution)
        ?? await offerTurning(observation, rows, remaining, execution)
        : this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !decide || observation.available_action_refs.length !== 1 ||
        observation.available_action_refs[0] !== 'ACTION6') return null;
      const clearing = await offerClearance(observation, rows, remaining, execution);
      if (clearing) return clearing;
      const pivoting = await offerTurning(observation, rows, remaining, execution);
      if (pivoting) return pivoting;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped) return null;
      const scene = prior?.scene ?? readScene(observation.entities, rows[0]!.length, rows.length);
      if (!scene) return null;
      const ref = observation.observation_ref;
      let memory: Memory = prior ?? { epoch: observation.level_epoch, scene, measured: [], pending: null, ineffective: null,
        lengths: scene.controls.map(() => 0), route: [], blocked: [], lastRef: ref, stopped: false };
      const layout = prior ? readLayout(observation.entities, scene) : scene.base;
      const expected = memory.pending
        ? project(scene.base, [...memory.measured, memory.pending], memory.lengths.map((_, i) => Number(i === memory.measured.length)))
        : project(scene.base, memory.measured, memory.lengths);
      if (!layout || !sameLayout(layout, expected)) return null;
      if (memory.measured.length === scene.controls.length && !memory.route.length) memory = { ...memory, route: findRoute(memory) };
      const step = planStep(memory);
      if (!step) return null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const repeated = step.kind === 'route';
      const facts = { repeatSupportedInteraction: repeated, probeNeededInteraction: !repeated, mode };
      const decision = await decide.run({ situation: facts }, { signal: execution?.signal });
      const strategy = repeated ? 'P02' : 'P05';
      if (decision.result !== strategy) return null;
      const evidence: [string, ...string[]] = [ref, ...new Set([memory.lastRef, ...memory.measured.flatMap(effect => effect.evidence),
        ...(memory.pending?.evidence ?? [])].filter(value => value !== ref))];
      const button = scene.controls[step.index]!.buttons[step.button];
      const situation = step.kind === 'measure' ? 'Check which pieces move when the button is pressed'
        : step.kind === 'reverse' ? 'Test whether the other button reverses the measured movement'
          : 'Use the measured movement to bring the marker around the obstacle';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, button.point, { reason: situation, evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'route_coupled_marker_to_visible_target', scope: ref.split(':revision:', 1)[0]!,
        subjects: [scene.target.join(',')], parentObjective: parent, satisfactionContract: 'official_progress_after_marker_reaches_target' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = coupledGaugeRouteId + ':' + need.id;
      const [x, y] = button.point;
      const marksX = scene.marks.map(([mx]) => mx), marksY = scene.marks.map(([, my]) => my);
      const targetBox = [Math.min(...marksX), Math.min(...marksY), Math.max(...marksX), Math.max(...marksY)];
      const action = { action_ref: 'ACTION6', data: { x, y } };
      const effect = memory.pending ?? memory.measured[step.index];
      return {
        status: 'proposed', kind: coupledGaugeRouteId, memory, step, needId: need.id, actions: [action],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: witness, expected_after: step.expected }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy, need: 'Bring the linked marker to the centre of the four marks', situation,
          mode, evidence, agenda: [], triggerCard: chooseInteraction, focus: button.box, gauge: layout.bodies[step.index],
          actor: dot(layout.marker), target: targetBox, obstacle: scene.divider,
          carried: effect ? effect.carried.map(i => layout.bodies[i]) : [], landing: step.expected && dot(step.expected.marker) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      if (isTurning(proposal) && index > 0) {
        const step = proposal.turns[index];
        const admitted = !!step && observation.level_epoch === proposal.turning.epoch
          && turningObserved(packet.frame_rows, proposal.turning.layout, step.before);
        return { admitted, reason: admitted ? 'linked_pivots_and_marker_still_aligned' : 'linked_extension_context_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'coupled_button_bound' : 'coupled_button_context_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isClearance(proposal)) {
        const matched = clearanceObserved(second, proposal.clearance.layout, proposal.expected);
        return { matched, seal_prefix: true, reason: matched ? 'extension_marker_and_attached_bodies_confirmed'
          : 'extension_or_attachment_prediction_contradicted' };
      }
      if (isTurning(proposal)) {
        const step = proposal.turns[index]!;
        if (proposal.probe) return { matched: null, seal_prefix: true, reason: 'compare_quarter_turn_and_carried_bars' };
        const matched = turningObserved(second, proposal.turning.layout, step.after);
        return { matched, seal_prefix: !matched || index + 1 >= proposal.turns.length,
          reason: matched ? 'linked_pivots_lengths_and_marker_confirmed' : 'linked_extension_prediction_contradicted' };
      }
      const { step, memory } = proposal;
      const layout = readLayout(after.entities, memory.scene);
      const matched = step.expected ? !!layout && sameLayout(layout, step.expected) : null;
      return { matched, seal_prefix: true, reason: 'compare_marker_and_linked_piece_positions' };
    },
    record(before, after, _action, first, second, proposal, index) {
      if (isClearance(proposal) || isTurning(proposal)) {
        if (after.levels_completed > before.levels_completed && witnessed?.epoch === before.level_epoch) {
          witnessed = { ...witnessed, epoch: after.level_epoch,
            evidence: [...witnessed.evidence.slice(-6), after.observation_ref] };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        if (isTurning(proposal)) {
          const { turning: run } = proposal, step = proposal.turns[index]!;
          const refs = [...(turning?.epoch === run.epoch ? turning.refs : run.refs).slice(-8), after.observation_ref];
          const next = { ...run, refs, lastRef: after.observation_ref };
          if (turningObserved(second, run.layout, step.after)) {
            turning = { ...next, pose: step.after, direction: proposal.probe ? run.hypothesis : run.direction,
              route: run.route.slice(index + 1) };
            return { events: [], ...(proposal.probe ? { reviewEvidence: 'The pivot turned by one quarter-turn and carried the rest of the chain.' } : {}) };
          }
          if (proposal.probe) {
            const hypothesis = run.hypothesis === 1 ? -1 : 1, other = moveTurningPose(step.before, step.move, hypothesis);
            if (turningObserved(second, run.layout, other)) {
              turning = { ...next, pose: other, direction: hypothesis, hypothesis, route: [] };
              return { events: [], reviewEvidence: 'The linked bars turned in the opposite direction from the first prediction.' };
            }
          }
          const remained = turningObserved(second, run.layout, step.before);
          turning = { ...next, pose: step.before, route: [], stopped: !remained || run.blocked.length >= 48,
            blocked: remained ? [...run.blocked, turningEdge(step.before, step.move)] : run.blocked };
          return { events: [] };
        }
        const { clearance: current, expected, move } = proposal, { layout, lengths } = current;
        const matched = clearanceObserved(second, layout, expected);
        const remained = !matched && clearanceObserved(second, layout, clearanceProject(layout, lengths));
        clearance = { ...current, lastRef: after.observation_ref, stopped: !matched && !remained,
          lengths: matched ? clearanceMoved(lengths, move) : lengths, route: matched ? current.route.slice(1) : [],
          blocked: remained ? [...current.blocked, clearanceEdge(lengths, move)] : current.blocked,
          refs: [...current.refs.slice(-4), after.observation_ref] };
        return { events: [] };
      }
      if (after.levels_completed > before.levels_completed && proposal.memory.measured.length) {
        const { measured, scene } = proposal.memory;
        const scales = new Set(measured.map(effect => Math.abs(effect.shift[0]) + Math.abs(effect.shift[1])));
        const maskFor = (reverse: boolean) => new Set(measured.map((effect, index) => {
          const control = scene.controls[index]!;
          const button = control.buttons[reverse ? otherButton(effect.expand) : effect.expand];
          return extensionButtonMask(first, button.box, control.color);
        }));
        const extendsMasks = maskFor(false), retractMasks = maskFor(true);
        if (scales.size === 1 && extendsMasks.size === 1 && retractMasks.size === 1) {
          const extend = [...extendsMasks][0]!, retract = [...retractMasks][0]!;
          if (extend !== retract) witnessed = { epoch: after.level_epoch, quantum: [...scales][0]!, extend, retract,
            evidence: [...measured.flatMap(effect => effect.evidence), after.observation_ref] };
        }
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { memory, step } = proposal;
      const { scene } = memory;
      const ref = after.observation_ref;
      const layout = readLayout(after.entities, scene);
      state = { ...memory, lastRef: ref, stopped: true };
      if (!layout) return { events: [] };
      if (step.kind === 'measure') {
        const pending = learnExtension(scene.base, layout, step.index, step.button, ref);
        if (pending) state = { ...state, pending, stopped: false };
        else if (memory.ineffective === null && sameLayout(scene.base, layout)) state = { ...state, ineffective: step.button, stopped: false };
      } else if (step.expected && sameLayout(layout, step.expected)) {
        if (step.move) state = { ...state, lengths: movedBy(memory.lengths, step.move), route: memory.route.slice(1), stopped: false };
        else if (memory.pending) state = { ...state, measured: [...memory.measured, { ...memory.pending,
          evidence: [...memory.pending.evidence, ref] }], pending: null, ineffective: null, stopped: false };
      } else if (step.move && memory.blocked.length < 16 && sameLayout(layout, project(scene.base, memory.measured, memory.lengths))) {
        state = { ...state, route: [], blocked: [...memory.blocked, edgeKey(memory.lengths, step.move)], stopped: false };
      }
      return { events: [] };
    },
    state: () => ({ state, witnessed, clearance, ...(turning ? { turning } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      witnessed = structuredClone((value.witnessed ?? null) as ExtensionWitness | null);
      clearance = structuredClone((value.clearance ?? null) as ClearanceMemory | null);
      turning = structuredClone((value.turning ?? null) as TurningMemory | null);
    },
  };
}
