import { freshReceptionModels, pathToReceptions } from '../logos-engine/v6-exposed-reception-access.ts';
import { measureExposedReception } from '../logos-engine/v6-exposed-reception-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { motionIntoFootprint } from './observed-translation.ts';
import { chooseReception, receptionMotionModule } from './reception-motion-card.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { exposureBearing, exposureMatches, exposureMoves, exposurePoint, exposureRules, planExposure, readExposureBoard, readTrackedExposure,
  type ExposureBoard, type ExposureDial, type ExposureScene, type ExposureSite, type ExposureState } from './coupled-exposure.ts';

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
type LearnedControls = { completed: number; pitch: number; directions: Record<string, NativePoint>; ref: string };
type Effect = { kind: 'follow' | 'orient' | 'continue'; actor: NativePoint; body: Site; receiver: Site; direction: NativePoint };
type Choice = { command: NativeCommand; target?: Site; dial?: Dial; effect?: Effect };
type Proposal = NativeProposal & { local: State; scene: Scene; choice: Choice; attempt: string; needId: string };
type PhotoWitness = { epoch: number; shadow: number; lit: number; ref: string };
type ExposureMemory = { epoch: number; board: ExposureBoard; scene: Scene; dialInk: number; current: ExposureState;
  route: number[]; refs: string[]; lastRef: string; stopped: boolean };
type ExposureProposal = NativeProposal & { exposure: ExposureMemory; expected: ExposureState; needId: string };
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

function observeExposure(rows: NativeRows, memory: ExposureMemory, expected: ExposureState): boolean {
  const next = readTrackedExposure(rows, memory.scene, memory.board, memory.dialInk);
  return !!next && exposureMatches(memory.board, expected, next);
}

export function createSicDirectionalReception(family = directionalReceptionId): NativeFamily<Proposal | ExposureProposal> {
  const learns = family === learnDirectionalReceptionId;
  let state: State | null = null;
  let known: LearnedControls | null = null;
  let photo: PhotoWitness | null = null;
  let exposure: ExposureMemory | null = null;
  let choose: NativeProgramHandle | undefined;
  async function offerExposure(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<ExposureProposal | null> {
    const { level_epoch: epoch, observation_ref: ref, available_action_refs: available } = observation;
    if (learns || photo?.epoch !== epoch - 1 || known?.completed !== observation.levels_completed || remaining < 1
      || !available.includes('ACTION6')) return null;
    let memory = exposure?.epoch === epoch ? exposure : null;
    if (memory && (memory.stopped || memory.lastRef !== ref)) return null;
    if (!memory) {
      const scene = measureExposedReception(rows) as Scene | null;
      if (!scene || scene.size[0] * scene.size[1] > 144 || Object.values(known.directions).length < 1) return null;
      const measured = readExposureBoard(scene, { shadow: photo.shadow, lit: photo.lit });
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
      const delta = known.directions[action_ref] ?? hints[action_ref];
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
    const expected = exposureRules(board).project(current, step), movement = step < 4;
    const evidence: [string, ...string[]] = [ref, ...new Set([photo.ref, known.ref, ...memory.refs].filter(value => value !== ref))];
    const mode = execution?.reasoningMode ?? 'solving', offer = { input: action.action_ref, expected: exposurePoint(expected.actor, board.width), evidence };
    const navigation = resolveNavigationPrimitives({ mode, evidence, probe: null, access: movement ? offer : null, interaction: movement ? null : offer });
    if (!navigation.selected) return null;
    const satisfied = (value: ExposureState) => board.goals.filter(goal => value.pieces.some(piece => piece.cell === goal.cell && piece.color === goal.color)).length;
    const situation = satisfied(expected) < satisfied(current) ? 'Free a filled receiver temporarily while keeping it as a goal'
      : !movement ? 'Change the beam or let its measured effect move a piece'
        : 'Move along the route and verify the cursor, the pieces and the occupied receivers';
    const point = action.action_ref === 'ACTION6' ? [Number(action.data.x), Number(action.data.y)] as NativePoint : null;
    const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: situation, evidence });
    if (point && !binding) return null;
    const parent = 'G_official_completion';
    const goal = { kind: 'satisfy_receivers_through_coupled_motion_and_exposure', scope: ref.split(':revision:', 1)[0]!,
      subjects: scene.slots.map(slot => slot.pos.join(',')), parentObjective: parent, satisfactionContract: 'official_progress_after_matching_all_receivers' };
    const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = family + ':' + need.id;
    return { status: 'proposed', kind: family, exposure: { ...memory, route }, expected, needId: need.id, actions: [action],
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action, expected_after: expected, ...(binding ? { point_binding: binding } : {}) }],
      sicSituationCard: { strategy: navigation.selected.id, need: 'Fill every receiver with a piece of the required color',
        situation, evidence, agenda: navigation.entries, mode, triggerCard: navigation.card,
        actor: cellBox(scene, exposurePoint(current.actor, board.width)),
        pieces: current.pieces.map(piece => cellBox(scene, exposurePoint(piece.cell, board.width))),
        receivers: scene.slots.map(slot => cellBox(scene, slot.pos)), ...(point ? { dial: [...point, ...point] } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: navigation.selected.id, objective: { id, label: situation, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation, preconditions: {},
        preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
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
      const reusable = !learns && known?.completed === observation.levels_completed && known.pitch === scene.pitch ? known : null;
      const receipt = learns && !prior ? execution?.readDirectionalMotion?.() : null;
      const movement = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch
        ? motionIntoFootprint(receipt, cellBox(scene, scene.actor)) : null;
      const delta = movement ? [movement[0] / scene.pitch, movement[1] / scene.pitch] as NativePoint : null;
      if (learns && !prior && (!delta || Math.abs(delta[0]) + Math.abs(delta[1]) !== 1)) return null;
      const local: State = prior?.layout === scene.layout ? prior : {
        epoch: observation.level_epoch, layout: scene.layout,
        directions: prior?.directions ?? reusable?.directions ?? (receipt && delta ? { [receipt.command]: delta } : {}),
        coupled: [], tried: [], evidence: prior?.evidence ?? (reusable ? [reusable.ref] : receipt ? [receipt.beforeRef] : []), count: prior?.count ?? 0,
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
      return { status: 'proposed', kind: family, actions, local, scene, choice, attempt: key(choice.command), needId: need.id,
        steps: [{ action: choice.command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation } } : {}),
        sicSituationCard: { strategy, need: 'Bring the pieces and the receivers into agreement', mode: route ? 'solving' : 'exploration',
          situation: choice.dial && !choice.effect ? 'The piece is in the receiver but has a different color. Test the nearby direction on the dial.' : label,
          agenda: evaluated?.entries ?? [], evidence, actor: cellBox(scene, scene.actor),
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
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'directional_reception_bound' : 'directional_reception_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isExposure(proposal)) {
        const matched = observeExposure(second, proposal.exposure, proposal.expected);
        return { matched, seal_prefix: true, reason: matched ? 'cursor_exposure_and_piece_positions_confirmed' : 'coupled_exposure_prediction_contradicted' };
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
    record(before, after, issued, _first, second: NativeRows, proposal, _index, frames) {
      if (isExposure(proposal)) {
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const { exposure: local, expected } = proposal, matched = observeExposure(second, local, expected);
        exposure = { ...local, current: matched ? expected : local.current, route: matched ? local.route.slice(1) : [],
          refs: matched ? [...local.refs.slice(-4), after.observation_ref] : local.refs, stopped: !matched, lastRef: after.observation_ref };
        return { events: [] };
      }
      if (after.levels_completed > before.levels_completed && Object.keys(proposal.local.directions).length) {
        known = { completed: after.levels_completed, pitch: proposal.scene.pitch, directions: proposal.local.directions, ref: after.observation_ref };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene, choice } = proposal;
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
          tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
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
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      const status = returned?.layout !== scene.layout ? 'receiver_layout_changed' : colorMatched ? 'receiver_color_match_observed' : 'receiver_return_measured';
      return { events: [{ status, evidence: [before.observation_ref, after.observation_ref] }] };
    },
    state: () => ({ state, known, photo, exposure }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      known = structuredClone((value.known as LearnedControls | undefined) ?? null);
      photo = structuredClone((value.photo ?? null) as PhotoWitness | null);
      exposure = structuredClone((value.exposure ?? null) as ExposureMemory | null);
    },
  };
}
