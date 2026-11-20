import { matchCoupledPair, measureCoupledPairs, type CoupledPair, type CoupledPairBox, type CoupledPairDelta } from '../logos-engine/v6-coupled-pair-observation.ts';
import { jointCoupledPairRoute, type CoupledPairRoute } from '../logos-engine/v6-coupled-pair-route.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { auxiliarySubjects, measureAuxiliaryRoute, verifyAuxiliaryStep, type AuxiliaryRoute } from './auxiliary-coupled-route.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { confirmedPressureControl, measurePressureField, planPressureRoute, pressureCellBox, pressureOpen,
  readPressureResponse, verifyPressureFrame, type PressureState, type PressureStep } from './pressure-coupled-route.ts';
import { measurePressureStop, planPressureWithStop, verifyPressureStop, type MovableStop } from './pressure-movable-stop.ts';

export const coupledMotionId = 'sic_coupled_motion';
export const verifyCoupledRouteId = 'sic_verify_coupled_route';
export const coupledMotionStrategies = {
  measure_pair_displacement: 'Test a direction and compare the movement of both pieces',
  route_coupled_pieces: 'Move both pieces toward a possible meeting point',
} as const;


type Sample = { input: string; first: CoupledPairDelta; second: CoupledPairDelta };
type State = { epoch: number; pair: CoupledPair; samples: Sample[]; floors: number[]; evidence: string[];
  remainingRoute: { actions: string[]; expected: CoupledPairBox[][] } | null; count: number; stopped: boolean; frame?: string };
type AuxiliaryTransfer = { epoch: number; pairColor: number; auxiliaryColor: number; floor: number;
  leftFirst: boolean; controls: AuxiliaryRoute['field']['controls']; evidence: string[] };
type Candidate = { input: string; route: State['remainingRoute'] };
type PairProposal = NativeProposal & ({ local: State; candidate: Candidate; auxiliary?: undefined } | { auxiliary: AuxiliaryRoute }) & { needId: string };
type PressureProposal = NativeProposal & { pressure: PressureState; pressureSteps: PressureStep[]; pressureStop?: MovableStop; needId: string };
type Proposal = PairProposal | PressureProposal;
const isPressure = (proposal: Proposal): proposal is PressureProposal => Object.hasOwn(proposal, 'pressure');
const displayBox = ([t, l, b, r]: CoupledPairBox): NativeBox => [l, t, r, b];
const keys = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function inBox([t, l, b, r]: CoupledPairBox, y: number, x: number): boolean {
  return t <= y && y <= b && l <= x && x <= r;
}
function pairVisible(rows: NativeRows, value: number, boxes: readonly CoupledPairBox[]): boolean {
  for (const [top, left, bottom, right] of boxes) for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) if (rows[y]?.[x] !== value) return false;
  }
  return true;
}

function matchProjection(rows: NativeRows, later: NativeRows, pair: CoupledPair, next: readonly CoupledPairBox[]): boolean {
  if (!pairVisible(later, pair.value, next)) return false;
  const affected = [...pair.boxes, ...next];
  for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[y]!.length - 1; x++) {
    if (rows[y]![x] !== later[y]?.[x] && !affected.some(box => inBox(box, y, x))) return false;
  }
  return true;
}

function revealedFloor(previous: CoupledPair, next: readonly CoupledPairBox[], rows: NativeRows): number[] {
  return previous.boxes.flatMap(([top, left, bottom, right]) => {
    const values = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const value = rows[y]?.[x];
      if (value !== undefined && !next.some(box => inBox(box, y, x))) values.add(value);
    }
    return values.size === 1 ? [...values] : [];
  });
}

function routeFromSamples(state: State, rows: NativeRows, available: readonly string[], remaining: number): CoupledPairRoute | null {
  if (!state.floors.length) return null;
  const vectors = new Map<string, Map<string, CoupledPairDelta>>();
  const signs = [new Set<number>(), new Set<number>()];
  for (const { input, first, second } of state.samples) {
    if (first.some(Boolean)) {
      const seen = vectors.get(input) ?? new Map();
      seen.set(first.join(','), first);
      vectors.set(input, seen);
    }
    for (const axis of [0, 1] as const) {
      if (first[axis] && Math.abs(first[axis]) === Math.abs(second[axis])) signs[axis]!.add(Math.sign(first[axis] * second[axis]));
    }
  }
  if (signs.some(axis => axis.size !== 1)) return null;
  const controls = Object.fromEntries([...vectors].flatMap(([input, seen]) => available.includes(input) && seen.size === 1 ? [[input, [...seen.values()][0]!]] : []));
  return jointCoupledPairRoute(rows, state.pair, controls, state.floors, signs.map(axis => [...axis][0]!), Math.min(40, remaining), state.evidence, true);
}

function transferredControls(state: State) {
  const normalize = (delta: CoupledPairDelta): CoupledPairDelta => [delta[0] / state.pair.size, delta[1] / state.pair.size];
  const unit = (delta: CoupledPairDelta) => Math.abs(delta[0]) + Math.abs(delta[1]) === state.pair.size;
  const controls = keys.flatMap(input => {
    const candidates = state.samples.filter(sample => sample.input === input && unit(sample.first) && unit(sample.second));
    const reference = candidates[0];
    return reference && candidates.every(sample => same(reference, sample))
      ? [{ first: normalize(reference.first), second: normalize(reference.second) }] : [];
  });
  return controls.length === keys.length && new Set(controls.map(control => control.first.join(','))).size === keys.length
    && new Set(controls.map(control => control.second.join(','))).size === keys.length ? controls : null;
}

export function projectRevalidatedPair(observation: NativeObservation, rows: NativeRows, remaining: number,
  learned: { ink: number; size: number; floors: number[]; trials: Record<string, { ref: string }> }, prior?: State) {
  if (prior?.stopped || (prior?.count ?? 0) >= 60) return null;
  const available = keys.filter(input => observation.available_action_refs.includes(input));
  if (available.length < 3) return null;
  const candidates = prior ? [] : measureCoupledPairs(rows).filter(item => item.value === learned.ink);
  const pair = prior?.pair ?? (candidates.length === 1 ? candidates[0] : undefined);
  if (!pair || !pairVisible(rows, pair.value, pair.boxes)) return null;
  const local: State = prior ?? { epoch: observation.level_epoch, pair, samples: [], floors: [], count: 0, stopped: false,
    remainingRoute: null, evidence: Object.values(learned.trials).map(trial => trial.ref) };
  const probe = available.find(input => !local.samples.some(sample => sample.input === input));
  const route = local.remainingRoute?.actions.every(input => available.includes(input)) ? local.remainingRoute
    : !probe ? routeFromSamples(local, rows, available, remaining) : null;
  const input = route?.actions[0] ?? probe;
  if (!input) return null;
  return { local, input, route, box: displayBox(pair.boxes[0]!), goal: displayBox(pair.boxes[1]!) };
}

export function observeRevalidatedPair({ local, route, input }: NonNullable<ReturnType<typeof projectRevalidatedPair>>,
  first: NativeRows, second: NativeRows, after: NativeObservation) {
  const pair = local.pair, next = measureCoupledPairs(second).filter(item => item.value === pair.value && item.size === pair.size);
  const match = next.length === 1 ? matchCoupledPair(pair, next[0]!) : null;
  const expected = route?.expected[0], projected = expected && matchProjection(first, second, pair, expected) ? expected : null;
  const boxes = projected ?? match?.boxes ?? pair.boxes;
  const samples = route ? local.samples : [...local.samples,
    { input, first: match?.deltas[0] ?? [0, 0] as CoupledPairDelta, second: match?.deltas[1] ?? [0, 0] as CoupledPairDelta }];
  const state: State = { ...local, pair: { ...pair, boxes }, count: local.count + 1, frame: after.frame_hash, samples,
    floors: [...new Set([...local.floors, ...revealedFloor(pair, boxes, second)])],
    evidence: [...local.evidence.slice(-6), after.observation_ref], stopped: route ? !projected : !match,
    remainingRoute: projected && route && route.actions.length > 1 ? { actions: route.actions.slice(1), expected: route.expected.slice(1) } : null };
  return { matched: route ? !!projected : match ? null : false, state };
}

export function createSicVerifyCoupledRoute(): NativeFamily<Proposal> {
  let state: State | null = null;
  let auxiliary: AuxiliaryRoute | null = null;
  let auxiliaryTransfer: AuxiliaryTransfer | null = null;
  let pressure: PressureState | null = null;
  let pressureStop: MovableStop | null = null;
  let decide: NativeProgramHandle | undefined;
  async function proposePressure(observation: NativeObservation, rows: NativeRows, remaining: number,
    execution?: NativeExecution): Promise<PressureProposal | null> {
    const epoch = observation.level_epoch, ref = observation.observation_ref;
    const available = keys.filter(key => observation.available_action_refs.includes(key));
    if (available.length !== keys.length || remaining < 1) return null;
    let local = pressure?.epoch === epoch ? pressure : null;
    let stop = local ? pressureStop : null;
    const transfer = auxiliaryTransfer?.epoch === epoch - 1 ? auxiliaryTransfer : null;
    const prior = pressure?.epoch === epoch - 1 && !pressure.stopped && pressure.opened.length ? pressure : null;
    if (!local && (transfer || prior)) {
      const pairColor = prior?.field.paint ?? transfer!.pairColor, floor = prior?.field.floor ?? transfer!.floor;
      const measured = measureCoupledPairs(rows).filter(pair => pair.value === pairColor);
      if (measured.length !== 1) return null;
      const field = measurePressureField(rows, measured[0]!, floor);
      if (!field) return null;
      local = { ...field, epoch, controls: {}, evidence: prior?.evidence ?? transfer!.evidence,
        tested: [], opened: [], closed: [], stopped: false };
    }
    if (!local || local.stopped || (stop ? !verifyPressureStop(rows, local.field, stop, stop.pose)
      : !verifyPressureFrame(rows, local.field, local.positions))) return null;
    const probe = !stop && available.find(key => !local!.controls[key] && !local!.tested.includes(JSON.stringify([key, local!.positions])));
    const interrupted = () => !!execution?.signal?.aborted || (execution?.deadlineMs !== undefined
      && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs);
    const path = probe || stop ? [] : planPressureRoute(local, available, remaining, interrupted);
    if (!probe && !path[0] && !stop && auxiliaryTransfer && auxiliaryTransfer.pairColor === local.field.paint
      && auxiliaryTransfer.floor === local.field.floor && observation.available_action_refs.includes('ACTION6')
      && available.every(command => local!.controls[command]) && !interrupted()) {
      const measured = measurePressureStop(rows, local, auxiliaryTransfer.auxiliaryColor);
      if (measured) {
        const route = planPressureWithStop(measured.field, measured.stop.pose, local.controls, available, remaining, interrupted);
        if (route.length) {
          stop = { ...measured.stop, remaining: route };
          local = { ...local, field: measured.field, evidence: [...new Set([...local.evidence, ...auxiliaryTransfer.evidence])] };
        }
      }
    }
    const { field, positions } = local, open = pressureOpen(field, positions);
    const stopStep = stop?.remaining[0], first = stopStep ?? path[0];
    if (!probe && !first) return null;
    const held = stopStep?.heldMember;
    const heldRelation = held === undefined ? -1 : field.relations.findIndex(candidate => candidate.plates.includes(positions[held]!));
    const relation = heldRelation >= 0 ? heldRelation : first?.changes[0] ?? first?.gateCrossings[0] ?? open.findIndex(Boolean);
    const relationEffectsKnown = (index: number) => (open[index] ? local!.closed : local!.opened).includes(index);
    const testingGate = !!first?.changes.some(index => !relationEffectsKnown(index));
    const learning = !!probe || testingGate || (stopStep?.command === 'ACTION6' && !stop?.focus);
    const mode = execution?.reasoningMode ?? (learning ? 'exploration' : 'solving'), strategy = learning ? 'P05' : 'P07';
    const facts = { routeSupported: !learning, eligibleProbe: learning, knownInteraction: false, mode };
    const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
    if (decision?.result !== strategy) return null;
    const steps: PressureStep[] = [];
    for (const move of (stopStep ? [stopStep] : path.slice(0, Math.min(remaining, maximumCommittedActions)))) {
      if (steps.length && move.changes.length) break;
      steps.push(move);
      if (move.changes.length) break;
    }
    const actions: NativeCommand[] = stopStep ? [stopStep.action] : probe ? [{ action_ref: probe, data: {} }]
      : steps.map(move => ({ action_ref: move.command, data: {} }));
    const selectedRelation = field.relations[relation];
    const holderPositions = first?.positions ?? positions;
    const holder = selectedRelation ? holderPositions.findIndex(cell => selectedRelation.plates.includes(cell)) : -1;
    const stopLabel = stopStep?.command === 'ACTION6' ? (stopStep.pose.selected ? 'Select the movable stop'
      : 'Return the directional controls to the two pieces')
      : stopStep?.pose.selected ? (stopStep.gateCrossings.length ? 'Move the selected stop through the open passage'
        : 'Reposition the selected stop while both pieces stay in place')
        : held !== undefined ? (heldRelation >= 0 ? 'Keep one piece on its plate while the other moves'
          : 'Use the movable stop to hold one piece while the other moves') : null;
    const label = probe ? 'Measure how this direction moves each member on the new board'
      : stopLabel ?? (testingGate ? 'Compare the marked passage before and after the move onto or off its plate'
        : holder >= 0 && selectedRelation ? 'Keep one member at the plate while the other approaches or crosses the passage'
          : 'Reach the next joint position using the observed shared controls');
    const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
    const point = stopStep?.command === 'ACTION6' ? [stopStep.action.data.x!, stopStep.action.data.y!] as const : null;
    const witness = point ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
    if (point && !witness) return null;
    const parent = 'G_official_completion', objective = { kind: 'bring_jointly_controlled_pieces_together', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['first_piece', 'second_piece', 'pressure_plates', 'held_passages'], parentObjective: parent,
      satisfactionContract: 'official_progress_after_the_joint_meeting_test' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = 'coupled-pressure:' + need.id;
    return { status: 'proposed', kind: verifyCoupledRouteId, actions, pressure: local, pressureSteps: steps, needId: need.id,
      ...(stop ? { pressureStop: stop } : {}),
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: actions.map((action, i) => ({ action, expected_after: steps[i] ?? null, ...(witness ? { locus_witness: witness } : {}) })),
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
        instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Keep the passages open so the two pieces can meet',
        mode, situation: label, evidence, agenda: [], triggerCard: decision.receipt.workflow,
        members: positions.map(cell => pressureCellBox(field, cell)), nextMembers: first?.positions.map(cell => pressureCellBox(field, cell)) ?? [],
        ...(stop && stopStep ? { auxiliary: pressureCellBox(field, stop.pose.cell), nextAuxiliary: pressureCellBox(field, stopStep.pose.cell) } : {}),
        ...(selectedRelation ? { pressurePlates: selectedRelation.plates.map(cell => pressureCellBox(field, cell)),
          pressureGates: selectedRelation.gates.map(cell => pressureCellBox(field, cell)),
          pressureHolder: holder >= 0 ? pressureCellBox(field, holderPositions[holder]!) : null } : {}) },
      question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: verifyCoupledRouteId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution): Promise<Proposal | null> {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const epoch = observation.level_epoch, ref = observation.observation_ref;
      if (remaining < 1 || !['ACTION6', ...keys].every(input => observation.available_action_refs.includes(input))) return null;
      const held = await proposePressure(observation, rows, remaining, execution);
      if (held) return held;
      let local = auxiliary?.epoch === epoch ? auxiliary : null;
      if (local && (local.stopped || local.frame !== observation.frame_hash)) return null;
      if (!local && auxiliaryTransfer?.epoch === epoch - 1) {
        const recalled = auxiliaryTransfer;
        const pairs = measureCoupledPairs(rows).filter(pair => pair.value === recalled.pairColor);
        const pair = pairs.length === 1 ? pairs[0]! : null;
        if (pair && pair.boxes[0]![1] !== pair.boxes[1]![1]) {
          const leftFirst = pair.boxes[0]![1] < pair.boxes[1]![1];
          const controls = leftFirst === recalled.leftFirst ? recalled.controls
            : recalled.controls.map(({ first, second }) => ({ first: second, second: first }));
          local = measureAuxiliaryRoute(rows, pair, [recalled.floor], controls, epoch, observation.frame_hash, recalled.evidence,
            recalled.auxiliaryColor, remaining);
        }
      }
      if (!local && state?.epoch === epoch - 1 && !state.stopped) {
        const controls = transferredControls(state);
        const pair = measureCoupledPairs(rows).filter(candidate => candidate.size === state!.pair.size);
        if (controls && pair.length === 1 && pair[0]!.value === state.pair.value) {
          local = measureAuxiliaryRoute(rows, pair[0]!, state.floors, controls, epoch, observation.frame_hash, state.evidence);
        }
      }
      const step = local?.steps[0];
      if (!local || !step) return null;
      const mode = execution?.reasoningMode ?? (local.focusPaint ? 'solving' : 'exploration');
      const facts = { routeSupported: !step.click, eligibleProbe: !!step.click && !local.focusPaint,
        knownInteraction: !!step.click && !!local.focusPaint, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || strategy !== (facts.routeSupported ? 'P07' : facts.knownInteraction ? 'P02' : 'P05')) return null;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const label = local.singleAuxiliary && step.stoppedMember !== undefined
        ? 'Use the repositioned auxiliary to hold one piece while the other moves'
        : local.singleAuxiliary && step.auxiliary !== undefined && !step.click
          ? 'Move the selected auxiliary to clear the passage and prepare a directional stop'
          : step.click ? step.auxiliary === undefined ? 'Return control to the two pieces'
        : local.focusPaint ? 'Select an auxiliary to clear the passage' : 'Test whether selecting the auxiliary transfers directional control'
        : step.auxiliary === undefined ? 'Bring together the two pieces with shared controls' : 'Move the selected auxiliary into a side pocket';
      const point = step.click ? [Math.floor((step.click[0] + step.click[2] + Number(step.auxiliary !== undefined)) / 2),
        Math.floor((step.click[1] + step.click[3] + Number(step.auxiliary !== undefined)) / 2)] as const : null;
      const witness = point ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
      if (point && !witness) return null;
      const action: NativeCommand = point ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }
        : { action_ref: keys[step.direction!]!, data: {} };
      const actions = [action], parent = 'G_official_completion';
      const objective = { kind: 'bring_jointly_controlled_pieces_together', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['first_piece', 'second_piece', 'shared_controls'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_the_joint_meeting_test' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'coupled-motion:' + need.id, subjects = auxiliarySubjects(local);
      return { status: 'proposed', kind: verifyCoupledRouteId, auxiliary: local, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: epoch },
        steps: [{ action, expected_after: subjects, ...(witness ? { point_binding: witness } : {}) }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Make room for the two pieces to meet', situation: label, evidence, agenda: [],
          mode, triggerCard: decision.receipt.workflow, ...subjects },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const available = keys.filter(input => observation.available_action_refs.includes(input));
      if (remaining < 1 || available.length < 3 || rows.length < 3) return null;
      if (pressure?.epoch === observation.level_epoch) return proposePressure(observation, rows, remaining, execution);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 60) return null;
      const measured = measureCoupledPairs(rows);
      const separate = prior ? measured.find(pair => pair.value === prior.pair.value && pair.size === prior.pair.size
        && pair.boxes.every(box => prior.pair.boxes.some(bound => same(box, bound)))) : measured.length === 1 ? measured[0] : null;
      const retained = prior?.frame === observation.frame_hash && pairVisible(rows, prior.pair.value, prior.pair.boxes) ? prior.pair : null;
      const pair = separate ?? retained;
      if (!pair || Math.floor(rows.length / pair.size) * Math.floor(rows[0]!.length / pair.size) > 4096) return null;
      const [a, b] = pair.boxes;
      if (!a || !b || (a[0] - b[0]) % pair.size || (a[1] - b[1]) % pair.size) return null;
      if (!prior && new Set(rows.flat()).size < 4) return null;
      if (!prior) {
        const stationary = execution?.readPriorDirectionalScene?.(first => pairVisible(first, pair.value, pair.boxes) ? true : null);
        const motion = stationary ? execution?.readDirectionalMotion?.() : null;
        const moving = motion?.translations.length === 1 ? motion.translations[0] : null;
        // A verified translation of a separate piece takes precedence over a fresh pair hypothesis.
        if (stationary?.afterRef === observation.observation_ref && moving && moving.color !== pair.value
          && moving.area === pair.size ** 2 && moving.to[2] - moving.to[0] + 1 === pair.size
          && moving.to[3] - moving.to[1] + 1 === pair.size) return null;
      }
      const local: State = prior ?? { epoch: observation.level_epoch, pair, samples: [], floors: [], evidence: [],
        remainingRoute: null, count: 0, stopped: false };
      const untested = available.find(input => !local.samples.some(sample => sample.input === input));
      const route = local.remainingRoute?.actions.every(input => available.includes(input)) ? local.remainingRoute
        : !untested ? routeFromSamples(local, rows, available, remaining) : null;
      const first = route?.actions[0];
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? (first ? 'solving' : 'exploration');
      const facts = { routeSupported: !!first, eligibleProbe: !!untested, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const candidate: Candidate | null = strategy === 'P07'
        ? first && route ? { input: first, route: { actions: route.actions, expected: route.expected } } : null
        : untested ? { input: untested, route: null } : null;
      if (!candidate) return null;
      const label = strategy === 'P07' ? coupledMotionStrategies.route_coupled_pieces : coupledMotionStrategies.measure_pair_displacement;
      const parent = 'G_official_completion';
      const objective = { kind: 'bring_jointly_controlled_pieces_together', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['first_piece', 'second_piece', 'shared_controls'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_the_joint_meeting_test' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'coupled-motion:' + need.id;
      const inputs = candidate.route?.actions.slice(0, Math.min(remaining, maximumCommittedActions, 60 - local.count)) ?? [candidate.input];
      const actions = inputs.map(action_ref => ({ action_ref, data: {} }));
      return { status: 'proposed', kind: verifyCoupledRouteId, candidate, local, actions, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: actions.map((action, index) => ({ action, expected_after: candidate.route?.expected[index] ?? null })),
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find how to bring together pieces that share controls', situation: label, evidence, agenda: [],
          mode, triggerCard: decision.receipt.workflow, members: local.pair.boxes.map(displayBox),
          nextMembers: candidate.route?.expected[0]?.map(displayBox) ?? [] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (isPressure(proposal)) {
        const previous = proposal.pressureSteps[index - 1];
        const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
          : !!previous && proposal.pressure.epoch === observation.level_epoch
            && verifyPressureFrame(packet.frame_rows, proposal.pressure.field, previous.positions);
        return { admitted, reason: admitted ? 'coupled_positions_and_gates_confirmed' : 'pressure_route_context_changed' };
      }
      let admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      if (index > 0 && !proposal.auxiliary && proposal.local.epoch === observation.level_epoch) {
        const previous = proposal.candidate.route?.expected[index - 1], expected = proposal.candidate.route?.expected[index];
        if (previous && expected && pairVisible(packet.frame_rows, proposal.local.pair.value, previous)) {
          const floors = proposal.local.floors;
          admitted = expected.every(([top, left, bottom, right]) => {
            for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
              const value = packet.frame_rows[y]?.[x];
              if (!previous.some(box => inBox(box, y, x)) && (value === undefined || !floors.includes(value))) return false;
            }
            return true;
          });
        }
      }
      return { admitted, reason: admitted ? 'current_joint_control_and_pieces_bound' : 'joint_control_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isPressure(proposal)) {
        const { field } = proposal.pressure, step = proposal.pressureSteps[index];
        const inScope = before.level_epoch === after.level_epoch && before.state === after.state;
        const stop = proposal.pressureStop, stopStep = stop?.remaining[0];
        if (stop && stopStep) {
          const matched = inScope && !!verifyPressureStop(second, field, stop, stopStep.pose);
          return { matched, seal_prefix: true, reason: matched ? 'verify_movable_stop_joint_positions_and_passages'
            : 'movable_stop_or_passage_prediction_refuted' };
        }
        const matched = !inScope ? false : step ? verifyPressureFrame(second, field, step.positions)
          : readPressureResponse(second, field, proposal.pressure.positions) ? null : false;
        return { matched, seal_prefix: matched !== true || !!step?.changes.length,
          reason: !step ? 'measure_both_displacements_on_the_current_board' : matched
            ? step.changes.length ? 'pressure_plate_changed_matching_passages' : 'verify_joint_positions_and_held_passages'
            : 'joint_positions_or_passage_prediction_refuted' };
      }
      if (proposal.auxiliary) {
        const matched = !!verifyAuxiliaryStep(proposal.auxiliary, first, second);
        const step = proposal.auxiliary.steps[0]!;
        return { matched, seal_prefix: true, reason: !matched ? 'auxiliary_route_prediction_contradicted'
          : step.click ? 'observed_directional_focus_transfer'
          : step.stoppedMember !== undefined ? 'observed_one_piece_stopped_by_auxiliary'
          : step.auxiliary === undefined ? 'observed_joint_displacement' : 'observed_auxiliary_displacement_while_pair_stationary' };
      }
      const expected = proposal.candidate.route?.expected[index];
      const boxes = proposal.candidate.route?.expected[index - 1] ?? proposal.local.pair.boxes;
      const matched = expected ? matchProjection(first, second, { ...proposal.local.pair, boxes }, expected) : null;
      return { matched, seal_prefix: matched !== true || index + 1 >= proposal.actions.length,
        reason: matched === true ? 'observed_joint_displacement' : 'compare_both_piece_returns' };
    },
    record(before, after, command, first, second, proposal, index) {
      if (isPressure(proposal)) {
        const local = index > 0 && pressure?.epoch === before.level_epoch ? pressure : proposal.pressure;
        if (after.levels_completed > before.levels_completed) return { events: [],
          reviewEvidence: 'Holding the passages allowed both pieces to reach the same position.' };
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const stop = proposal.pressureStop, stopStep = stop?.remaining[0];
        const proof = stop && stopStep ? verifyPressureStop(second, local.field, stop, stopStep.pose) : null;
        if (stop && stopStep) pressureStop = proof ? { ...stop, ...proof, pose: stopStep.pose, remaining: stop.remaining.slice(1) } : null;
        else pressureStop = null;
        const step = proposal.pressureSteps[index];
        const expected = stop ? !!proof : step && verifyPressureFrame(second, local.field, step.positions);
        const seen = expected || stop ? null : readPressureResponse(second, local.field, local.positions);
        const positions = expected && step ? step.positions : seen?.positions ?? local.positions;
        const learned = !step && seen ? confirmedPressureControl(local.field, local.positions, seen, command.action_ref, local.controls) : null;
        const controls = learned ? { ...local.controls, [command.action_ref]: learned } : local.controls;
        const pre = pressureOpen(local.field, local.positions), post = pressureOpen(local.field, positions);
        const opened = post.flatMap((open, i) => open && !pre[i] ? [i] : []);
        const closed = pre.flatMap((open, i) => open && !post[i] ? [i] : []);
        pressure = { ...local, positions, controls, evidence: [...local.evidence.slice(-7), after.observation_ref],
          tested: [...new Set([...local.tested, ...(!step ? [JSON.stringify([command.action_ref, local.positions])] : [])])],
          opened: [...new Set([...local.opened, ...opened])], closed: [...new Set([...local.closed, ...closed])],
          stopped: !expected && !seen };
        return { events: [], ...(opened.length || closed.length ? {
          reviewEvidence: opened.length ? 'A matching passage opened when a member reached its plate.'
            : 'The matching passage closed when the last member left its plate.',
        } : {}) };
      }
      if (proposal.auxiliary && after.levels_completed > before.levels_completed) {
        const { field, focusPaint, initialLeftFirst, steps, epoch, evidence } = proposal.auxiliary;
        const [a, b] = steps[0]!.position.members;
        if (a === b && focusPaint && initialLeftFirst !== undefined && field.floorColor !== undefined) {
          auxiliaryTransfer = { epoch, pairColor: field.pairColor, auxiliaryColor: field.auxiliaryColor, floor: field.floorColor,
            leftFirst: initialLeftFirst, controls: field.controls, evidence: [...evidence.slice(-7), after.observation_ref] };
        }
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (proposal.auxiliary) {
        const local = proposal.auxiliary, verified = verifyAuxiliaryStep(local, first, second);
        const step = local.steps[0]!;
        auxiliary = verified ? { ...local, focusPaint: verified.focusPaint, position: step.position, steps: local.steps.slice(1),
          evidence: [...local.evidence.slice(-7), after.observation_ref], frame: after.frame_hash } : { ...local, stopped: true };
        return { events: [], ...(verified && step.stoppedMember !== undefined
          ? { reviewEvidence: 'The return shows one piece stopping at the relocated auxiliary while the other continues.' } : {}) };
      }
      const local = (index > 0 && state?.frame === before.frame_hash ? state : null) ?? proposal.local;
      const previous = local.pair, route = proposal.candidate.route, expected = route?.expected[index];
      const measured = measureCoupledPairs(second).filter(pair => pair.value === previous.value && pair.size === previous.size);
      const match = measured.length === 1 ? matchCoupledPair(previous, measured[0]!) : null;
      const projected = expected && matchProjection(first, second, previous, expected) ? expected : null;
      const boxes = projected ?? match?.boxes ?? previous.boxes;
      const sample: Sample | null = !route ? { input: command.action_ref, first: match?.deltas[0] ?? [0, 0],
        second: match?.deltas[1] ?? [0, 0] } : null;
      state = { ...local, pair: { ...previous, boxes }, count: local.count + 1, frame: after.frame_hash,
        samples: sample ? [...local.samples, sample] : local.samples, floors: [...new Set([...local.floors, ...revealedFloor(previous, boxes, second)])],
        evidence: [...local.evidence.slice(-7), after.observation_ref], stopped: route ? !projected : !match,
        remainingRoute: projected && route && route.actions.length > index + 1
          ? { actions: route.actions.slice(index + 1), expected: route.expected.slice(index + 1) } : null };
      return { events: [] };
    },
    state: () => ({ state, auxiliary, auxiliaryTransfer, ...(pressure ? { pressure } : {}), ...(pressureStop ? { pressureStop } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      auxiliary = structuredClone((value.auxiliary as AuxiliaryRoute | undefined) ?? null);
      auxiliaryTransfer = structuredClone((value.auxiliaryTransfer as AuxiliaryTransfer | undefined) ?? null);
      pressure = structuredClone((value.pressure as PressureState | undefined) ?? null);
      pressureStop = structuredClone((value.pressureStop as MovableStop | undefined) ?? null);
    },
  };
}
