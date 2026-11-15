import { boundedReductionRouteCooperative, mergeReductionScene, packReductionState, reductionLayout, reductionMoved, reductionScan,
  reductionState, reductionSuccessors, REDUCTION_VECTORS,
  type ReductionModel, type ReductionPoint, type ReductionScene,
} from '../logos-engine/v6-reduction-transport.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { acquireCarrierView, carrierView, unpackCarrierView, type CarrierView } from './carrier-camera.ts';

export const observedCarrierReductionId = 'sic_transport_and_reduce_visible_population';
export const observedCarrierStrategies = {
  identify_carrier_motion: 'Test which way an available command moves the carrier on its rail',
  move_carrier_into_range: 'Move the carrier toward the planned landing or transfer',
  select_piece_for_reduction: 'Select the piece that can jump over its neighbor',
  verify_reduction_landing: 'Jump to the measured landing and verify that one piece is removed',
} as const;

type Packed = ReturnType<typeof packReductionState>;
type Motion = { vector: ReductionPoint; ref: string };
type Calibration = { epoch: number; model: ReductionModel | null; refs: string[] };
type Witness = { epoch: number; unit: number; pitch: number; token: number; refs: string[] };
type RecalledControls = { epoch: number; controls: Record<string, Motion> };
type Supports = { floor: string[]; rails: string[]; edges: string[] };
type State = { epoch: number; model: ReductionModel; controls: Record<string, Motion>; tested: string[];
  selected: ReductionPoint | null; selectedSupports: Supports | null; stopped: boolean; refs: string[]; view?: CarrierView };
type Choice = { stage: 'probe' | 'move' | 'select' | 'jump'; command: NativeCommand; effect: Packed | null;
  addressed: ReductionPoint | null; source: ReductionPoint | null; landing: ReductionPoint | null };
type Proposal = NativeProposal & { local: State; choice: Choice; current: Packed; needId: string };
const same = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);
const packed = (scene: ReductionScene) => packReductionState(reductionState(scene));
const scopeAttempt = (input: string, current: Packed) => JSON.stringify([input, current]);

const origin: ReductionPoint = [0, 0];
function boxFor(model: ReductionModel, [column, row]: ReductionPoint, offset: ReductionPoint = origin): NativeBox {
  const x = model.phase[0] + (column - offset[0]) * model.pitch, y = model.phase[1] + (row - offset[1]) * model.pitch;
  return [x, y, x + model.unit - 1, y + model.unit - 1];
}

function visibleSelection(model: ReductionModel, cell: ReductionPoint, first: NativeRows, second: NativeRows, offset = origin): boolean {
  const [left, top, right, bottom] = boxFor(model, cell, offset);
  for (let y = Math.max(0, top - 1); y <= Math.min(first.length - 1, bottom + 1); y++) {
    for (let x = Math.max(0, left - 1); x <= Math.min(first[y]!.length - 1, right + 1); x++) {
      if (first[y]![x] !== second[y]?.[x]) return true;
    }
  }
  return false;
}

function fitCarrierMotion(scene: ReductionScene, after: Packed): ReductionPoint | null {
  const current = reductionState(scene);
  if (same(packReductionState(current), after)) return null;
  const fits = REDUCTION_VECTORS.filter(vector => same(packReductionState(reductionMoved(current, vector, scene.edges)), after));
  return fits.length === 1 ? fits[0]! : null;
}

function plannerScene(rows: NativeRows, model: ReductionModel, selectedSupports: Supports | null): ReductionScene {
  const visible = reductionScan(rows, model);
  if (!selectedSupports) return visible;
  return mergeReductionScene({ ...visible, floor: new Set(selectedSupports.floor), rails: new Set(selectedSupports.rails),
    edges: new Set(selectedSupports.edges) }, visible, model, [0, 0]);
}

function isAddressed(model: ReductionModel, cell: ReductionPoint, command: NativeCommand): boolean {
  const [left, top, right, bottom] = boxFor(model, cell);
  const { x, y } = command.data;
  return typeof x === 'number' && typeof y === 'number' && x >= left && x <= right && y >= top && y <= bottom;
}

export function createSicObservedCarrierReduction(): NativeFamily<Proposal> {
  let calibration: Calibration | null = null, witness: Witness | null = null, state: State | null = null;
  let recalled: RecalledControls | null = null;
  return {
    id: observedCarrierReductionId,
    observePublicOutcome(before, after, command, first, second) {
      if (command.action_ref !== 'ACTION6') return;
      if (calibration?.epoch !== before.level_epoch) {
        calibration = { epoch: before.level_epoch, model: reductionLayout(before, first), refs: [] };
      }
      const { model, refs } = calibration;
      if (!model) return;
      const scene = reductionScan(first, model);
      const options = [...reductionSuccessors(reductionState(scene), scene)].filter(([, operation]) =>
        operation[0] === 'jump' && isAddressed(model, operation[2], command));
      if (!options.length) return;
      const observed = [before.observation_ref, after.observation_ref];
      if (after.levels_completed > before.levels_completed && refs.length && options.some(([result]) => result[0].size === 1)) {
        witness = { epoch: after.level_epoch, unit: model.unit, pitch: model.pitch, token: model.token, refs: [...refs, ...observed] };
      } else if (before.level_epoch === after.level_epoch) {
        const result = packed(reductionScan(second, model));
        if (options.some(([expected]) => same(packReductionState(expected), result))) {
          calibration.refs = [...refs.slice(-4), ...observed];
        }
      }
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const retained = witness;
      if (remaining < 1 || retained?.epoch !== observation.level_epoch || !observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped) return null;
      if (previous?.view && previous.refs.at(-1) !== observation.observation_ref) return null;
      const model = previous?.model ?? reductionLayout(observation, rows);
      if (!model || model.unit !== retained.unit || model.pitch !== retained.pitch || model.token !== retained.token || model.rail === null) return null;
      const visible = plannerScene(rows, model, previous?.selectedSupports ?? null);
      const reuse = recalled?.epoch === observation.level_epoch ? recalled.controls : null;
      const view = previous?.view ?? (reuse && visible.carriers.length > 1
        ? carrierView(origin, mergeReductionScene(null, visible, model, origin)) : null);
      const local: State = previous ?? { epoch: observation.level_epoch, model, controls: view && reuse ? reuse : {}, tested: [],
        ...(view ? { view } : {}),
        selected: null, selectedSupports: null, stopped: false, refs: [] };
      const scene = view ? unpackCarrierView(view) : visible, current = packed(scene);
      if (!scene.carriers.length || !scene.edges.size || scene.pegs.size < 2) return null;
      const initial = reductionState(scene);
      const budget = remaining + Number(local.selected !== null), bounds = { maximumStates: 8192, maximumFrontier: 16384 };
      const result = await boundedReductionRouteCooperative(initial, scene, budget, bounds, false, execution);
      const reveal = view && result.status === 'exhausted'
        ? await boundedReductionRouteCooperative(initial, scene, budget, bounds, true, execution) : null;
      const operation = (result.path ?? reveal?.path)?.[0];
      if (!operation) return null;
      let choice: Choice;
      if (operation[0] === 'move') {
        const vector = operation[1], available = observation.available_action_refs;
        const known = available.find(input => same(local.controls[input]?.vector, vector));
        const probe = available.find(input => /^ACTION[1-4]$/.test(input) && !local.controls[input] && !local.tested.includes(scopeAttempt(input, current)));
        const input = known ?? probe;
        if (!input) return null;
        choice = { stage: known ? 'move' : 'probe', command: { action_ref: input, data: {} },
          effect: known ? packReductionState(reductionMoved(initial, vector, scene.edges)) : null, addressed: null, source: null, landing: null };
      } else {
        const [, source, landing] = operation, selected = same(local.selected, source);
        const cell = selected ? landing : source, box = boxFor(model, cell, view?.offset);
        const [x, y] = [Math.floor((box[0] + box[2] + 1) / 2), Math.floor((box[1] + box[3] + 1) / 2)];
        if (x < 0 || y < 0 || x >= model.width || y >= model.height) return null;
        const planned = [...reductionSuccessors(initial, scene)].find(([, candidate]) => same(candidate, operation));
        if (!planned) return null;
        choice = { stage: selected ? 'jump' : 'select', command: { action_ref: 'ACTION6', data: { x, y } },
          effect: selected ? packReductionState(planned[0]) : current, addressed: cell, source, landing };
      }
      const strategy = choice.stage === 'probe' ? 'identify_carrier_motion' : choice.stage === 'move' ? 'move_carrier_into_range'
        : choice.stage === 'select' ? 'select_piece_for_reduction' : 'verify_reduction_landing';
      const ref = observation.observation_ref, parent = 'G_official_completion', label = observedCarrierStrategies[strategy];
      const situation = reveal?.path ? 'Move a loaded carrier toward the edge of the mapped area and check what the new view reveals' : label;
      const evidence: [string, ...string[]] = [ref, ...new Set([...retained.refs, ...local.refs,
        ...Object.values(local.controls).map(motion => motion.ref)].filter(item => item !== ref))];
      const action = choice.command, actions = [action];
      const locus = choice.addressed ? await ObservedInputDomain.makeLocusWitness(observation, rows, [Number(action.data.x), Number(action.data.y)], { reason: label, evidence }) : null;
      if (choice.addressed && !locus) return null;
      const objective = { kind: 'join_visible_population_through_supported_jumps', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['piece', 'carrier', 'landing'], parentObjective: parent, satisfactionContract: 'observe_reduce_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `carrier-reduction:${need.id}`;
      return { status: 'proposed', kind: observedCarrierReductionId, actions, local, choice, current, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, ...(locus ? { point_binding: locus } : {}), expected_after: choice.effect }],
        sicSituationCard: { strategy, need: 'Bring the separated pieces into one reachable group',
          situation, mode: choice.stage === 'probe' || reveal?.path ? 'exploration' : 'solving', evidence, agenda: [],
          carrier: boxFor(model, scene.carriers[0]!, view?.offset), source: choice.source && boxFor(model, choice.source, view?.offset),
          landing: choice.landing && boxFor(model, choice.landing, view?.offset) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, preconditions: {},
          preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'carrier_or_landing_bound' : 'transport_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) {
        return { matched: true, seal_prefix: true, reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      }
      const { local: { model, view }, choice } = proposal;
      if (view) {
        const next = acquireCarrierView(second, after, model, view, choice.effect);
        const selected = choice.stage !== 'select' || visibleSelection(model, choice.addressed!, first, second, view.offset);
        const matched = !next || !selected ? false : next.matches;
        return { matched, seal_prefix: true, reason: !next ? 'camera_registration_ambiguous' : !selected || matched === false
          ? 'tracked_population_or_carrier_motion_refuted' : next.newPegs ? 'camera_registered_and_new_pieces_observed'
            : next.cameraChanged ? 'tracked_population_preserved_across_camera_shift' : 'carrier_and_population_projection_confirmed' };
      }
      const next = packed(reductionScan(second, model));
      const matched = before.level_epoch === after.level_epoch && (choice.stage === 'probe' ? null
        : same(next, choice.effect) && (choice.stage !== 'select' || visibleSelection(model, choice.addressed!, first, second)));
      return { matched, seal_prefix: true, reason: matched === null ? 'measure_carrier_direction'
        : matched ? 'carrier_and_population_projection_confirmed' : 'carrier_or_population_projection_refuted' };
    },
    async record(before, after, action, first, second, proposal) {
      const { choice, current, local } = proposal;
      if (after.levels_completed > before.levels_completed && choice.stage === 'jump') {
        const { unit, pitch, token } = local.model;
        witness = { epoch: after.level_epoch, unit, pitch, token, refs: [...local.refs.slice(-4), before.observation_ref, after.observation_ref] };
        recalled = { epoch: after.level_epoch, controls: local.controls };
      }
      if (before.level_epoch !== after.level_epoch) return { events: [] };
      if (local.view) {
        const next = acquireCarrierView(second, after, local.model, local.view, choice.effect);
        const selected = choice.stage === 'select' && next?.matches && visibleSelection(local.model, choice.addressed!, first, second, local.view.offset)
          ? choice.addressed : null;
        const direction = choice.stage === 'probe' && next ? fitCarrierMotion(unpackCarrierView(local.view), packed(unpackCarrierView(next.view))) : null;
        state = { ...local, selected, model: next?.nextModel ?? local.model, view: next?.view ?? local.view,
          stopped: !next || next?.matches === false || choice.stage === 'select' && !selected,
          refs: [...local.refs.slice(-6), after.observation_ref],
          tested: choice.stage === 'probe' ? [...local.tested, scopeAttempt(action.action_ref, current)] : local.tested,
          controls: direction ? { ...local.controls, [action.action_ref]: { vector: direction, ref: after.observation_ref } } : local.controls };
        return { events: [] };
      }
      const result = await this.after(proposal, 0, before, after, first, second);
      const selected = choice.stage === 'select' && result.matched ? choice.addressed : null;
      const clear = selected ? reductionScan(first, local.model) : null;
      state = { ...local, selected, selectedSupports: clear ? { floor: [...clear.floor], rails: [...clear.rails], edges: [...clear.edges] } : null,
        stopped: result.matched === false, refs: [...local.refs.slice(-6), after.observation_ref] };
      if (choice.stage === 'probe') {
        const direction = fitCarrierMotion(reductionScan(first, local.model), packed(reductionScan(second, local.model)));
        state.tested = [...local.tested, scopeAttempt(action.action_ref, current)];
        if (direction) state.controls = { ...local.controls, [action.action_ref]: { vector: direction, ref: after.observation_ref } };
      }
      return { events: [] };
    },
    state: () => ({ calibration, witness, state, recalled }),
    restore(value: NativeRecord) {
      calibration = structuredClone((value.calibration as Calibration | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | undefined) ?? null);
      state = structuredClone((value.state as State | undefined) ?? null);
      recalled = structuredClone((value.recalled as RecalledControls | undefined) ?? null);
    },
  };
}
