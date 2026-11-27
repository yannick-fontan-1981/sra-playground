import { freshReceptionModels, pathToReceptions } from '../logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception, measureRetainedExposedReception } from '../logos-engine/v6-exposed-reception-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { motionIntoFootprint } from './observed-translation.ts';
import { chooseReception, receptionMotionModule } from './reception-motion-card.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { exposureBearing, exposureLayout, exposureMatches, exposureMoves, exposurePoint, exposureRules, finishedExposure,
  planExposure, readExposureBoard, readTrackedExposure,
  type CouplingColors, type ExposureBoard, type ExposureDial, type ExposureScene, type ExposureSite, type ExposureState } from './coupled-exposure.ts';
import { observeExposureConditions, type ExposureObservations } from './observed-exposure-conditions.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { continueRoleAfterPublicCompletion, publicCompletionFrames } from './observed-role-completion.ts';

export const directionalReceptionId = 'sic_directional_reception';
export const learnDirectionalReceptionId = 'sic_learn_reception_from_motion';
export const directionalReceptionStrategies = {
  measure_reception_displacement: 'Measure a direction that could move the pieces toward their receivers',
  approach_reception_slots: 'Use the measured displacement toward the matching receivers',
  orient_toward_mismatched_piece: 'Point the orientation control toward the mismatched piece',
  move_with_adjacent_piece: 'Check that the adjacent piece follows without entering the beam',
  orient_to_move_piece: 'Point the beam along the path from the piece to its receiver',
  continue_verified_illumination: 'Use another turn of the verified beam while the cursor stays still',
} as const;
const graph = compileStrategyGraph({ id: 'align_piece_and_receiver_state', version: 1, order: 'FALLBACK',
  priorities: ['orient_toward_mismatched_piece', 'approach_reception_slots', 'measure_reception_displacement'],
  strategies: {
    measure_reception_displacement: [{ fact: 'test', expected: true, label: 'A conditional route needs a direction that has yet to be measured' }],
    approach_reception_slots: [{ fact: 'route', expected: true, label: 'The measured displacement is the first step of the geometric route' }],
    orient_toward_mismatched_piece: [{ fact: 'orientation', expected: true, label: 'A piece occupies a receiver with a different appearance' }],
  },
}, ['test', 'route', 'orientation']);
type Site = ExposureSite;
type Dial = ExposureDial;
type Scene = ExposureScene;
type State = { epoch: number; layout: string; directions: Record<string, NativePoint>; coupled: number[]; tried: string[];
  evidence: string[]; count: number; beam?: { at: NativePoint; actor: NativePoint; direction: NativePoint } };
type LearnedControls = { completed: number; pitch: number; directions: Record<string, NativePoint>; ref: string; measuredAt?: string; evidence?: string[] };
type Effect = { kind: 'follow' | 'orient' | 'continue'; actor: NativePoint; body: Site; receiver: Site; direction: NativePoint };
type Choice = { command: NativeCommand; target?: Site; dial?: Dial; effect?: Effect };
type Aim = { choice: Choice; scene: Scene; receiver: Site };
type Proposal = NativeProposal & { local: State; scene: Scene; choice: Choice; attempt: string; needId: string; aims?: Aim[] };
type PhotoWitness = { epoch: number; shadow: number; lit: number; ref: string };
type CouplingWitness = CouplingColors & { epoch: number; ref: string };
type ExposureMemory = { epoch: number; board: ExposureBoard; scene: Scene; dialInk: number; current: ExposureState;
  route: number[]; refs: string[]; lastRef: string; stopped: boolean };
type ExposureProposal = NativeProposal & { exposure: ExposureMemory; forecasts: ExposureState[]; needId: string };
const isExposure = (proposal: Proposal | ExposureProposal): proposal is ExposureProposal => 'exposure' in proposal;
const hints: Readonly<Record<string, NativePoint>> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const plus = (a: NativePoint, b: NativePoint): NativePoint => [a[0] + b[0], a[1] + b[1]];
const minus = (a: NativePoint, b: NativePoint): NativePoint => [a[0] - b[0], a[1] - b[1]];
const command = (action_ref: string): Choice => ({ command: { action_ref, data: {} } });
const length = ([x, y]: NativePoint) => Math.abs(x) + Math.abs(y);
const directionOf = ([x, y]: NativePoint): NativePoint => [Math.sign(x), Math.sign(y)];
const alongAxis = ([x, y]: NativePoint) => (x === 0) !== (y === 0);
function cellBox({ origin, pitch }: Scene, [x, y]: NativePoint): NativeBox {
  const left = origin[0] + x * pitch, top = origin[1] + y * pitch;
  return [left, top, left + pitch - 1, top + pitch - 1];
}
function pointScore(vector: NativePoint, direction: NativePoint) {
  return (vector[0] * direction[0] + vector[1] * direction[1]) / Math.hypot(...vector);
}

function chooseObservedEffect(scene: Scene, state: State, allowed: readonly string[]): Choice | null {
  if (scene.bodies.length !== 1 || scene.slots.length !== 1) return null;
  const body = scene.bodies[0]!, receiver = scene.slots[0]!, lamp = scene.dial.find(control => control.active);
  if (!lamp) return null;
  const bearing = minus(body.pos, scene.actor), needs = minus(receiver.pos, body.pos);
  if (!alongAxis(needs)) return null;
  const direction = directionOf(needs);
  const available = ([x, y]: NativePoint) => x >= 0 && y >= 0 && x < scene.size[0] && y < scene.size[1]
    && !scene.walls.some(wall => same(wall, [x, y]));
  const landing = plus(body.pos, direction);
  if (!available(landing)) return null;
  if (body.color === receiver.color && length(bearing) === 1
    && bearing[0] * direction[0] + bearing[1] * direction[1] === 0
    && !same(directionOf(lamp.vector), bearing)) {
    const actor = plus(scene.actor, direction);
    const action = allowed.find(key => state.directions[key] && same(state.directions[key]!, direction))
      ?? allowed.find(key => hints[key] && same(hints[key]!, direction));
    return action && available(actor) ? { ...command(action), target: body,
      effect: { kind: 'follow', actor, body: { pos: landing, color: body.color }, receiver, direction } } : null;
  }
  if (!alongAxis(bearing) || !same(directionOf(bearing), direction)) return null;
  // The cursor stays still; only the lit object is predicted to move.
  const effect = { actor: scene.actor, body: { pos: landing, color: receiver.color }, receiver, direction };
  if (body.color !== receiver.color) {
    const dial = scene.dial.find(control => !control.active && same(directionOf(control.vector), direction));
    return dial ? { command: { action_ref: 'ACTION6', data: { x: dial.point[0], y: dial.point[1] } }, target: body, dial,
      effect: { ...effect, kind: 'orient' } } : null;
  }
  return state.beam && same(state.beam.at, body.pos) && same(state.beam.actor, scene.actor)
    && same(state.beam.direction, direction) && same(directionOf(lamp.vector), direction) && allowed.includes('ACTION5')
    ? { ...command('ACTION5'), target: body, effect: { ...effect, kind: 'continue' } } : null;
}

function returnedEffect(scene: Scene, effect: Effect): boolean {
  return same(scene.actor, effect.actor) && scene.bodies.some(body => body.color === effect.body.color && same(body.pos, effect.body.pos))
    && (effect.kind === 'follow' || scene.dial.some(dial => dial.active && same(directionOf(dial.vector), effect.direction)));
}

function pairedAims(scene: Scene, choice: Choice): Aim[] | null {
  if (scene.bodies.length !== 2 || scene.slots.length !== 2 || !choice.target || !choice.dial) return null;
  const first = choice.target, other = scene.bodies.find(body => body !== first);
  const receiver = scene.slots.find(slot => same(slot.pos, first.pos));
  const second = other && scene.slots.find(slot => same(slot.pos, other.pos));
  if (!other || !receiver || !second || first.color !== other.color || receiver.color !== second.color
    || first.color === receiver.color) return null;
  const left = minus(first.pos, scene.actor), right = minus(other.pos, scene.actor);
  if (!alongAxis(left) || !same(left, [-right[0], -right[1]]) || !same(directionOf(left), directionOf(choice.dial.vector))) return null;
  const dial = scene.dial.find(control => !control.active && same(directionOf(control.vector), directionOf(right)));
  if (!dial) return null;
  const armed: Scene = { ...scene,
    bodies: scene.bodies.map(body => body === first ? receiver : body),
    dial: scene.dial.map(control => ({ ...control, active: same(control.point, choice.dial!.point) })) };
  const next: Choice = { command: { action_ref: 'ACTION6', data: { x: dial.point[0], y: dial.point[1] } }, dial, target: other };
  return [{ scene, choice, receiver }, { scene: armed, choice: next, receiver: second }];
}

function matchesAim(actual: Scene | null, planned: Scene, dial: Dial): boolean {
  return !!actual && actual.layout === planned.layout && same(actual.actor, planned.actor)
    && actual.dial.some(control => control.active && same(control.point, dial.point))
    && actual.slots.length === planned.slots.length && planned.slots.every(slot =>
      actual.slots.some(site => same(site.pos, slot.pos) && site.color === slot.color))
    && actual.bodies.length === planned.bodies.length && planned.bodies.every(body =>
      actual.bodies.some(site => same(site.pos, body.pos) && site.color === body.color));
}

function observeExposure(rows: NativeRows, memory: ExposureMemory, expected: ExposureState): boolean {
  if (memory.board.colors.linked === null) {
    const visible = measureExposedReception(rows) as Scene | null;
    if (visible?.layout === memory.scene.layout && exposureMatches(memory.board, expected, visible)) return true;
  }
  const next = readTrackedExposure(rows, memory.scene, memory.board, memory.dialInk);
  return !!next && exposureMatches(memory.board, expected, next);
}

function confirmedNextLayout(rows: NativeRows, frames: readonly NativeRows[], memory: ExposureMemory, expected: ExposureState) {
  if (!finishedExposure(memory.board, expected)) return null;
  const next = measureExposedReception(rows) as Scene | null;
  if (!next || next.layout === memory.scene.layout || next.pitch !== memory.scene.pitch) return null;
  return frames.some(frame => observeExposure(frame, memory, expected)) ? next : null;
}

export function createSicDirectionalReception(family = directionalReceptionId, transferObservedReception = false): NativeFamily<Proposal | ExposureProposal> {
  const learns = family === learnDirectionalReceptionId;
  let state: State | null = null;
  let known: LearnedControls | null = null;
  let photo: PhotoWitness | null = null;
  let coupling: CouplingWitness | null = null;
  let exposure: ExposureMemory | null = null;
  let observations: ExposureObservations | null = null;
  function learnConditions(before: NativeObservation, after: NativeObservation, input: NativeCommand, first: NativeRows, second: NativeRows) {
    if (!learns || before.level_epoch !== after.level_epoch || before.state !== after.state ||
        before.levels_completed !== after.levels_completed) return;
    const a = measureExposedReception(first) as Scene | null, b = a && measureExposedReception(second) as Scene | null;
    if (a && b) observations = observeExposureConditions(observations, before.level_epoch, a, b, input, after.observation_ref);
  }
  function retainPublicCompletion(before: NativeObservation, after: NativeObservation, input: NativeCommand,
    first: NativeRows, second: NativeRows, frames: readonly NativeRows[]) {
    if (after.levels_completed <= before.levels_completed || !known || !photo
      || known.completed !== before.levels_completed || !before.available_action_refs.includes(input.action_ref)) return;
    const scene = measureExposedReception(first) as Scene | null;
    if (!scene || scene.pitch !== known.pitch) return;
    const current = exposure?.epoch === before.level_epoch && !exposure.stopped
      && observeExposure(first, exposure, exposure.current) ? exposure : null;
    const local = state?.epoch === before.level_epoch && state.layout === scene.layout ? state : null;
    if (!current && (!local || photo.epoch !== before.level_epoch)) return;
    const retained = coupling?.epoch === before.level_epoch ? coupling : null;
    const measured = current ? [current.board, current.current] as const : exposureLayout(scene,
      { shadow: photo.shadow, lit: photo.lit, ...(retained ? { linked: retained.linked, released: retained.released }
        : { linked: null, released: null }) });
    if (!measured) return;
    const [board, initial] = measured, directions = { ...known.directions, ...local?.directions };
    const direction = directions[input.action_ref];
    const dials = input.action_ref === 'ACTION6' ? scene.dial.filter(dial => same(dial.point, [input.data.x!, input.data.y!])) : [];
    const heading = dials.length === 1 ? exposureBearing(dials[0]!.vector) : -1;
    const operation = direction ? exposureMoves.findIndex(delta => same(delta, direction))
      : input.action_ref === 'ACTION5' ? 4 : heading >= 0 ? 5 + heading : -1;
    if (operation < 0) return;
    const expected = exposureRules(board).project(initial, operation), active = scene.dial.filter(dial => dial.active);
    if (!finishedExposure(board, expected) || active.length !== 1) return;
    const dialInk = first[active[0]!.point[1]]?.[active[0]!.point[0]];
    if (dialInk === undefined || !publicCompletionFrames(before, after, second, frames).some(rows => {
      const visible = measureExposedReception(rows) as Scene | null;
      if (visible?.layout === scene.layout && exposureMatches(board, expected, visible)) return true;
      const observed = readTrackedExposure(rows, scene, board, dialInk);
      return observed && exposureMatches(board, expected, observed);
    })) return;
    const continued = continueRoleAfterPublicCompletion(known, before, after, true,
      [known.ref, photo.ref, ...(current?.refs ?? local?.evidence ?? [])]);
    if (!continued) return;
    known = { ...continued, directions, ref: after.observation_ref };
    photo = { ...photo, epoch: before.level_epoch };
    if (board.colors.linked !== null && board.colors.released !== null) coupling = {
      linked: board.colors.linked, released: board.colors.released, epoch: before.level_epoch, ref: after.observation_ref };
  }
  let choose: NativeProgramHandle | undefined;
  async function offerExposure(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<ExposureProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: available } = observation;
    if (remaining < 1 || !available.includes('ACTION6')) return null;
    const fitted = learns && observations?.epoch === epoch && !observations.rejected ? observations.calibrated : undefined;
    const inherited = !learns && photo?.epoch === epoch - 1 && known?.completed === observation.levels_completed;
    if (!fitted && !inherited) return null;
    const directions = fitted ? observations!.directions : known!.directions;
    let memory = exposure?.epoch === epoch ? exposure : null;
    if (memory?.stopped) return null;
    if (memory && memory.lastRef !== ref) {
      if (!fitted) return null;
      memory = null;
    }
    const retained = inherited && coupling?.epoch === epoch - 1 ? coupling : null;
    if (!memory) {
      const scene = (measureExposedReception(rows) ?? (retained ? measureRetainedExposedReception(rows, known!.pitch) : null)) as Scene | null;
      if (!scene || scene.size[0] * scene.size[1] > (retained ? 196 : 144) || !Object.keys(directions).length ||
          fitted && observations!.layout !== scene.layout) return null;
      const measured = fitted ? exposureLayout(scene, {shadow: fitted.shadow, lit: fitted.lit, linked: null, released: null})
        : readExposureBoard(scene, { shadow: photo!.shadow, lit: photo!.lit }, retained ?? undefined);
      const active = scene.dial.find(d => d.active);
      if (!measured || !active) return null;
      const dialInk = rows[active.point[1]]?.[active.point[0]];
      if (dialInk === undefined) return null;
      const [board, current] = measured;
      memory = { epoch, board, scene, dialInk, current, route: [], refs: [], lastRef: ref, stopped: false };
    }
    const { board, current, scene } = memory;
    if (!observeExposure(rows, memory, current)) return null;
    const commands = new Map<number, NativeCommand>();
    for (const action_ref of available) {
      const delta = directions[action_ref] ?? (inherited ? hints[action_ref] : undefined);
      const index = delta ? exposureMoves.findIndex(move => same(move, delta)) : -1;
      if (index >= 0) commands.set(index, { action_ref, data: {} });
    }
    if (available.includes('ACTION5')) commands.set(4, { action_ref: 'ACTION5', data: {} });
    for (const dial of scene.dial) {
      const heading = exposureBearing(dial.vector);
      if (heading >= 0) commands.set(5 + heading, { action_ref: 'ACTION6', data: { x: dial.point[0], y: dial.point[1] } });
    }
    const route = memory.route.length ? memory.route : await planExposure(board, current, [...commands.keys()].sort((a, b) => a - b),
      remaining, execution);
    const step = route[0], action = step === undefined ? null : commands.get(step);
    if (step === undefined || !action) return null;
    const rules = exposureRules(board);
    const expected = rules.project(current, step), movement = step < 4;
    const evidence: [string, ...string[]] = [ref,
      ...new Set([...(fitted ? fitted.refs : [photo!.ref, known!.ref, ...(known!.evidence ?? [])]),
        ...(retained ? [retained.ref] : []), ...memory.refs].filter(value => value !== ref))];
    const mode = execution?.reasoningMode ?? 'solving', offer = { input: action.action_ref, expected: exposurePoint(expected.actor, board.width), evidence };
    const navigation = resolveNavigationPrimitives({ mode, evidence, probe: null, access: movement ? offer : null, interaction: movement ? null : offer });
    if (!navigation.selected) return null;
    const satisfied = (value: ExposureState) => board.goals.filter(goal => value.pieces.some(piece => piece.cell === goal.cell && piece.color === goal.color)).length;
    const changes = current.pieces.filter((piece, index) => piece.cell !== expected.pieces[index]!.cell || piece.color !== expected.pieces[index]!.color);
    const newLinks = current.pieces.filter((piece, index) => piece.color === board.colors.released
      && expected.pieces[index]!.color === board.colors.linked).length;
    const situation = satisfied(expected) < satisfied(current) ? 'Free a filled receiver temporarily while keeping it as a goal'
      : retained && newLinks >= 2 ? 'Test whether the light-driven push joins the pieces on contact'
        : retained && changes.length > 1 ? 'Advance the route and verify which pieces move or change color together'
          : !movement ? 'Change the beam or let its measured effect move a piece'
            : 'Move along the route and verify the cursor, the pieces and the occupied receivers';
    const point = action.action_ref === 'ACTION6' ? [Number(action.data.x), Number(action.data.y)] as NativePoint : null;
    const actions: NativeCommand[] = [], steps: NativeRecord[] = [], forecasts: ExposureState[] = [];
    const inactiveInk = new Set(scene.dial.filter(d => exposureBearing(d.vector) !== current.facing)
      .map(d => rows[d.point[1]]?.[d.point[0]]));
    let prior = current;
    for (const operation of route.slice(0, fitted ? Math.min(remaining, maximumCommittedActions) : 1)) {
      const command = commands.get(operation);
      if (!command) break;
      let binding;
      if (command.action_ref === 'ACTION6') {
        const locus: NativePoint = [command.data.x!, command.data.y!];
        binding = await ObservedInputDomain.makeLocusWitness(observation, rows, locus, { reason: situation, evidence });
        if (operation - 5 === current.facing && prior.facing !== current.facing) {
          const [ink] = inactiveInk;
          if (inactiveInk.size !== 1 || ink === undefined) break;
          binding = await ObservedInputDomain.projectLocusWitness(binding, ink);
        } else if (operation - 5 === prior.facing && prior.facing !== current.facing) {
          binding = await ObservedInputDomain.projectLocusWitness(binding, memory.dialInk);
        }
      }
      const forecast = rules.project(prior, operation);
      actions.push(command);
      steps.push({ action: command, expected_after: forecast, ...(binding ? { point_binding: binding } : {}) });
      forecasts.push(forecast);
      prior = forecast;
    }
    const parent = 'G_official_completion';
    const goal = { kind: 'satisfy_receivers_through_coupled_motion_and_exposure', scope: ref.split(':revision:', 1)[0]!,
      subjects: scene.slots.map(slot => slot.pos.join(',')), parentObjective: parent, satisfactionContract: 'official_progress_after_matching_all_receivers' };
    const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = family + ':' + need.id;
    return { status: 'proposed', kind: family, exposure: { ...memory, route }, forecasts, needId: need.id, actions,
      binding: { observation_ref: ref, level_epoch: epoch },
      steps,
      sicSituationCard: { strategy: navigation.selected.id, need: 'Fill every receiver with a piece of the required color',
        situation, evidence, agenda: navigation.entries, mode, triggerCard: navigation.card,
        actor: cellBox(scene, exposurePoint(current.actor, board.width)),
        pieces: (retained && changes.length ? changes : current.pieces).map(piece => cellBox(scene, exposurePoint(piece.cell, board.width))),
        receivers: scene.slots.map(slot => cellBox(scene, slot.pos)), ...(point ? { dial: [...point, ...point] } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: navigation.selected.id, objective: { id, label: situation, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation, preconditions: {},
        preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) choose = await registry.registerProgram(chooseReception, {}, await receptionMotionModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      return group === observedMechanicsGroup ? offerExposure(observation, rows, remaining, execution)
        : this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const complete = await offerExposure(observation, rows, remaining, execution);
      if (complete) return complete;
      const keys = observation.available_action_refs.filter(action => hints[action]);
      if (!keys.length || execution?.signal?.aborted) return null;
      const scene = measureExposedReception(rows) as Scene | null;
      if (!scene || scene.bodies.length > 4 || scene.size[0] * scene.size[1] > 256) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const reusable = (!learns || transferObservedReception) && known?.completed === observation.levels_completed
        && known.pitch === scene.pitch ? known : null;
      const receipt = learns && !prior ? execution?.readDirectionalMotion?.() : null;
      const movement = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch
        ? motionIntoFootprint(receipt, cellBox(scene, scene.actor)) : null;
      const delta = movement ? [movement[0] / scene.pitch, movement[1] / scene.pitch] as NativePoint : null;
      if (learns && !prior && !reusable && (!delta || Math.abs(delta[0]) + Math.abs(delta[1]) !== 1)) return null;
      const local: State = prior?.layout === scene.layout ? prior : {
        epoch: observation.level_epoch, layout: scene.layout,
        directions: prior?.directions ?? reusable?.directions ?? (receipt && delta ? { [receipt.command]: delta } : {}),
        coupled: [], tried: [], evidence: prior?.evidence ?? (reusable ? [...new Set([reusable.ref, ...(reusable.evidence ?? []),
          ...(reusable.measuredAt ? [reusable.measuredAt] : [])])] : receipt ? [receipt.beforeRef] : []), count: prior?.count ?? 0,
      };
      if (local.count >= 32) return null;
      const key = (action: NativeCommand) => JSON.stringify([observation.frame_hash, action]);
      const available = (choice: Choice) => !local.tried.includes(key(choice.command));
      const proposal = reusable && chooseObservedEffect(scene, local, observation.available_action_refs);
      const effectChoice = proposal && available(proposal) ? proposal : null;
      const mismatch = scene.bodies.find(body => scene.slots.some(slot => same(slot.pos, body.pos) && slot.color !== body.color));
      let orientation: Choice | null = null, route: Choice | null = null, trial: Choice | null = null;
      if (!effectChoice && mismatch) {
        const direction = minus(mismatch.pos, scene.actor);
        const dial = [...scene.dial].filter(control => !control.active).sort((a, b) =>
          pointScore(b.vector, direction) - pointScore(a.vector, direction));
        orientation = dial.map(control => ({ command: { action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } },
          target: mismatch, dial: control })).find(available) ?? null;
      }
      if (!effectChoice && !orientation) {
        const model = freshReceptionModels();
        for (const color of local.coupled) model.coupled[String(color)] = true;
        const result = pathToReceptions(scene, model, 800, {
          ...(execution?.deadlineMs === undefined ? {} : { deadlineMs: execution.deadlineMs }),
          ...(execution?.now ? { now: execution.now } : {}),
        });
        const delta = result.path[0]?.[0];
        if (!delta) return null;
        const learned = keys.find(action => local.directions[action] && same(local.directions[action]!, delta) && available(command(action)));
        if (learned) route = command(learned);
        const unknown = keys.filter(action => !local.directions[action] && available(command(action)));
        const probe = unknown.find(action => same(hints[action]!, delta)) ?? unknown[0];
        if (probe) trial = command(probe);
      }
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const situation = { test: !!trial, route: !!route, orientation: !!orientation, mode: execution?.reasoningMode ?? 'exploration' };
      const decision = learns ? await choose?.run({ situation }, { signal: execution?.signal }) : null;
      const evaluated = learns ? null : resolveStrategyGraph({ graph, mode: 'active', facts: {
        test: { value: !!trial, evidence }, route: { value: !!route, evidence }, orientation: { value: !!orientation, evidence },
      }, planners: { measure_reception_displacement: () => trial, approach_reception_slots: () => route,
        orient_toward_mismatched_piece: () => orientation } });
      const choices = { measure_reception_displacement: trial, approach_reception_slots: route, orient_toward_mismatched_piece: orientation,
        move_with_adjacent_piece: effectChoice, orient_to_move_piece: effectChoice, continue_verified_illumination: effectChoice };
      const byEffect = { follow: 'move_with_adjacent_piece', orient: 'orient_to_move_piece', continue: 'continue_verified_illumination' } as const;
      const requested = effectChoice?.effect ? byEffect[effectChoice.effect.kind] : decision?.result ?? evaluated?.selected?.id;
      if (typeof requested !== 'string' || !Object.hasOwn(choices, requested)) return null;
      const strategy = requested as keyof typeof choices, choice = choices[strategy];
      if (!choice) return null;
      const label = directionalReceptionStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_occupied_receivers', scope: ref.split(':revision:', 1)[0]!, subjects: ['controlled_body', 'receivers'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_matching_the_occupied_receivers' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = `directional-reception:${need.id}`;
      const actions = [choice.command];
      const binding = choice.dial && await ObservedInputDomain.makeLocusWitness(observation, rows, choice.dial.point, { reason: label, evidence });
      const steps = [{ action: choice.command, expected_after: null as Site | null, ...(binding ? { point_binding: binding } : {}) }];
      const pair = orientation === choice && remaining >= 2 && local.count < 31 && binding ? pairedAims(scene, choice) : null;
      const last = pair?.[1];
      const witness = last?.choice.dial && await ObservedInputDomain.makeLocusWitness(observation, rows, last.choice.dial.point,
        { reason: label, evidence });
      const aims = witness ? pair! : undefined;
      if (aims && witness && last) {
        actions.push(last.choice.command);
        steps[0]!.expected_after = aims[0]!.receiver;
        steps.push({ action: last.choice.command, expected_after: last.receiver, point_binding: witness });
      }
      return { status: 'proposed', kind: family, actions, local, scene, choice, attempt: key(choice.command), needId: need.id,
        steps, ...(aims ? { aims } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation } } : {}),
        sicSituationCard: { strategy, need: 'Bring the pieces and the receivers into agreement', mode: route ? 'solving' : 'exploration',
          situation: choice.dial && !choice.effect ? 'The piece is in the receiver but has a different color. Test the nearby direction on the dial.' : label,
          agenda: evaluated?.entries ?? [], evidence,
          ...(reusable?.measuredAt && !prior ? { newLevelConfiguration: 'Compare the previous directional effects with the current pieces and receivers' } : {}),
          actor: cellBox(scene, scene.actor),
          pieces: (choice.target ? [choice.target] : scene.bodies).map(body => cellBox(scene, body.pos)),
          receivers: scene.slots.map(slot => cellBox(scene, slot.pos)),
          ...(choice.effect ? { landing: cellBox(scene, choice.effect.body.pos) } : {}),
          dial: choice.dial ? [...choice.dial.point, ...choice.dial.point] : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && isExposure(proposal)) {
        const prior = proposal.forecasts[index - 1];
        const admitted = proposal.binding?.level_epoch === observation.level_epoch && !!prior
          && observeExposure(packet.frame_rows, proposal.exposure, prior);
        return { admitted, reason: admitted ? 'previous_configuration_confirmed' : 'previous_configuration_changed' };
      }
      const aims = isExposure(proposal) ? undefined : proposal.aims;
      const aim = aims?.[index], previous = aims?.[index - 1];
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!aim && !!previous?.choice.dial && proposal.binding?.level_epoch === observation.level_epoch
          && matchesAim(measureExposedReception(packet.frame_rows) as Scene | null, aim.scene, previous.choice.dial);
      return { admitted, reason: admitted ? 'directional_reception_bound' : 'directional_reception_changed' };
    },
    after(proposal, index, before, after, _first, second, frames = []) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isExposure(proposal)) {
        const expected = proposal.forecasts[index]!;
        const matched = observeExposure(second, proposal.exposure, expected);
        if (!matched && learns && confirmedNextLayout(second, frames, proposal.exposure, expected))
          return { matched: true, seal_prefix: true, reason: 'receiver_completed_before_new_layout' };
        return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
          reason: matched ? 'cursor_exposure_and_piece_positions_confirmed' : 'coupled_exposure_prediction_contradicted' };
      }
      if (proposal.aims?.[index]) {
        const current = proposal.aims[index]!, next = proposal.aims[index + 1];
        const predicted = next?.scene ?? { ...current.scene, bodies: current.scene.bodies.map(body =>
          same(body.pos, current.receiver.pos) ? current.receiver : body) };
        const matched = matchesAim(measureExposedReception(second) as Scene | null, predicted, current.choice.dial!);
        return { matched, seal_prefix: !matched || !next, reason: matched ? 'receiver_color_match_observed' : 'receiver_recolor_prediction_diverged' };
      }
      if (proposal.choice.effect) {
        const next = measureExposedReception(second) as Scene | null;
        if (next?.layout === proposal.scene.layout) {
          const matched = returnedEffect(next, proposal.choice.effect);
          const success = proposal.choice.effect.kind === 'follow' ? 'adjacent_piece_kept_its_offset' : 'light_moved_piece_while_cursor_stayed';
          return { matched, seal_prefix: true, reason: matched ? success : 'piece_or_control_return_contradicted' };
        }
      }
      return { matched: null, seal_prefix: true, reason: 'remeasure_piece_receiver_and_orientation' };
    },
    record(before, after, issued, _first, second: NativeRows, proposal, index, frames) {
      if (isExposure(proposal)) {
        const local = proposal.exposure, expected = proposal.forecasts[index]!;
        if (after.levels_completed > before.levels_completed && known && photo && local.refs.length && finishedExposure(local.board, expected)
            && local.board.colors.linked !== null && local.board.colors.released !== null) {
          const { linked, released } = local.board.colors;
          coupling = { linked, released, epoch: before.level_epoch, ref: after.observation_ref };
          known = { ...known, completed: after.levels_completed, pitch: local.scene.pitch, ref: after.observation_ref };
          photo = { ...photo, epoch: before.level_epoch };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const matched = observeExposure(second, local, expected);
        if (learns && observations?.calibrated && !matched) {
          const next = confirmedNextLayout(second, frames, local, expected);
          if (next) {
            observations = { ...observations, layout: next.layout, samples: [], calibrated: {
              ...observations.calibrated, refs: [...observations.calibrated.refs.slice(0, 3), after.observation_ref],
            } };
            exposure = null;
            return { events: [{status: 'receiver_completed_before_new_layout', evidence: [before.observation_ref, after.observation_ref]}] };
          }
          observations.rejected = true;
        }
        const priorRefs = index > 0 && exposure ? exposure.refs : local.refs;
        exposure = { ...local, current: matched ? expected : local.current, route: matched ? local.route.slice(index + 1) : [],
          refs: matched ? [...priorRefs.slice(-4), after.observation_ref] : priorRefs, stopped: !matched, lastRef: after.observation_ref };
        return { events: [] };
      }
      const local = index > 0 ? state ?? proposal.local : proposal.local;
      learnConditions(before, after, issued, _first, second);
      if (after.levels_completed > before.levels_completed && Object.keys(local.directions).length) {
        const retained = known?.completed === before.levels_completed && known.pitch === proposal.scene.pitch ? known : null;
        known = { completed: after.levels_completed, pitch: proposal.scene.pitch, directions: local.directions, ref: after.observation_ref,
          evidence: [...new Set([...(retained?.evidence ?? []), ...(retained ? [retained.ref] : []),
            ...local.evidence, before.observation_ref, after.observation_ref])],
          ...(transferObservedReception ? { measuredAt: local.evidence.at(-1) ?? before.observation_ref } : {}) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { scene, choice } = proposal.aims?.[index] ?? proposal;
      const attempt = index > 0 ? JSON.stringify([before.frame_hash, issued]) : proposal.attempt;
      const returned = measureExposedReception(second) as Scene | null;
      const directions = { ...local.directions }, coupled = [...local.coupled];
      if (choice.effect) {
        const effect = choice.effect;
        const changed = returned && returned.layout !== scene.layout;
        const matched = !!returned && returned.layout === scene.layout && returnedEffect(returned, effect);
        const terminal = changed && same(effect.body.pos, effect.receiver.pos) && frames.some(rows => {
          const measured = measureExposedReception(rows) as Scene | null;
          return measured?.layout === scene.layout && returnedEffect(measured, effect);
        });
        if (matched && effect.kind === 'orient' && scene.bodies.length === 1 && scene.bodies[0]!.color !== effect.body.color) {
          photo = { epoch: before.level_epoch, shadow: scene.bodies[0]!.color, lit: effect.body.color, ref: after.observation_ref };
        }
        if (matched && effect.kind === 'follow') directions[issued.action_ref] = effect.direction;
        const beam = matched && effect.kind !== 'follow' ? { at: effect.body.pos, actor: effect.actor, direction: effect.direction } : undefined;
        const { beam: _priorBeam, ...rest } = local;
        state = { ...rest, directions, ...(beam ? { beam } : {}), count: local.count + 1,
          tried: [...local.tried, attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
        const status = terminal ? 'receiver_filled_in_animation_before_layout_changed' : changed ? 'receiver_layout_changed'
          : matched ? 'observed_reception_effect_confirmed' : 'observed_reception_effect_contradicted';
        return { events: [{ status, evidence: [before.observation_ref, after.observation_ref] }] };
      }
      let colorMatched = false;
      if (returned?.layout === scene.layout) {
        const delta = minus(returned.actor, scene.actor);
        if (!choice.dial && Math.abs(delta[0]) + Math.abs(delta[1]) === 1) {
          directions[issued.action_ref] = delta;
          for (const color of new Set(scene.bodies.map(body => body.color))) {
            const group = scene.bodies.filter(body => body.color === color);
            if (group.length > 1 && group.every(body => returned.bodies.some(next => next.color === color && same(next.pos, plus(body.pos, delta))))) coupled.push(color);
          }
        }
        if (choice.target && returned.dial.some(dial => dial.active && same(dial.point, choice.dial!.point))) {
          const at = choice.target.pos;
          const target = scene.slots.find(slot => same(slot.pos, at));
          colorMatched = returned.bodies.some(body => same(body.pos, at) && body.color === target?.color);
        }
      }
      state = { ...local, directions, coupled: [...new Set(coupled)], count: local.count + 1,
        tried: [...local.tried, attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      const status = returned?.layout !== scene.layout ? 'receiver_layout_changed' : colorMatched ? 'receiver_color_match_observed' : 'receiver_return_measured';
      return { events: [{ status, evidence: [before.observation_ref, after.observation_ref] }] };
    },
    observePublicOutcome(before, after, input, first, second, frames = []) {
      if (learns && state?.epoch === before.level_epoch) learnConditions(before, after, input, first, second);
      retainPublicCompletion(before, after, input, first, second, frames);
    },
    state: () => ({ state, known, photo, exposure, coupling, ...(observations ? {observations} : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      known = structuredClone((value.known as LearnedControls | undefined) ?? null);
      photo = structuredClone((value.photo ?? null) as PhotoWitness | null);
      exposure = structuredClone((value.exposure ?? null) as ExposureMemory | null);
      coupling = structuredClone((value.coupling ?? null) as CouplingWitness | null);
      observations = structuredClone((value.observations ?? null) as ExposureObservations | null);
    },
  };
}
