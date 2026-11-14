import { exactJointPath, jointLayers, jointStatePair, measureJointTransport, type JointScene } from '../logos-engine/v6-joint-transport.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { motionIntoFootprint } from './observed-translation.ts';

export const transportContactId = 'sic_transport_contact';
export const learnTransportAccessId = 'sic_learn_transport_access';
export const transportContactStrategies = {
  prepare_push: 'Move to a position from which to push',
  push_toward_matching_sites: 'Push a body toward the matching sites',
} as const;
const graph = compileStrategyGraph({ id: 'occupy_matching_sites_by_contact', version: 1, order: 'FALLBACK',
  priorities: ['push_toward_matching_sites', 'prepare_push'],
  strategies: {
    push_toward_matching_sites: [{ fact: 'pushNext', expected: true, label: 'The next input makes contact along the conditional route' }],
    prepare_push: [{ fact: 'pushNext', expected: false, label: 'The route first needs another support position' }],
  },
}, ['pushNext']);

const directions: Readonly<Record<string, NativePoint>> = {
  ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0],
};
type Geometry = { scale: number; offset: NativePoint; floor: NativePoint[]; targets: NativePoint[] };
type Occupancy = ReturnType<typeof jointStatePair>;
type Proposal = NativeProposal & { geometry: Geometry; predicted: Occupancy; context: string; needId: string };
type State = { epoch: number; geometry: Geometry | null; evidence: readonly string[]; refuted: string[] };
const empty = (epoch = 0): State => ({ epoch, geometry: null, evidence: [], refuted: [] });
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const measure = (rows: NativeRows, targets: readonly NativePoint[] = []): JointScene | null => {
  try {
    return measureJointTransport(rows, targets.map(([x, y]) => [x, y]));
  } catch {
    return null;
  }
};
const layers = (scene: JointScene) => jointLayers(scene) as Geometry;
const sameGeometry = (a: Geometry, b: Geometry) => a.scale === b.scale && equal(a.offset, b.offset)
  && equal(a.floor, b.floor) && equal(a.targets, b.targets);
const sprite = ({ scale, offset: [ox, oy] }: Geometry, [x, y]: NativePoint): NativeBox => {
  const left = x * scale + ox, top = y * scale + oy;
  return [left, top, left + scale - 1, top + scale - 1];
};

export function createSicTransportContact(family = transportContactId): NativeFamily<Proposal> {
  const learns = family === learnTransportAccessId;
  let state = empty();
  return {
    id: family,
    propose(observation, rows, inputs, remaining, execution) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const actions = inputs.filter(input => Object.hasOwn(directions, input.action_ref));
      if (actions.length !== 4 || remaining < 1 || local.refuted.length >= 8) return null;
      const scene = measure(rows, local.geometry?.targets);
      if (!scene || scene.floor.size > 100 || scene.boxes.size > 5) return null;
      const geometry = layers(scene), current = jointStatePair(scene), context = JSON.stringify([geometry.scale, geometry.offset, geometry.floor, geometry.targets, current]);
      if (local.refuted.includes(context) || (local.geometry && !sameGeometry(local.geometry, geometry))) return null;
      const receipt = learns && !local.geometry ? execution?.readDirectionalMotion?.() : null;
      const observed = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch ? receipt : null;
      const motion = observed && motionIntoFootprint(observed, sprite(geometry, current[0]));
      const direction = observed ? directions[observed.command] : null;
      const established = !!direction && !!motion && motion.every((delta, axis) => delta === direction[axis]! * geometry.scale);
      const clock = execution?.now ?? (() => performance.now());
      const deadline = Math.min(clock() + 150, execution?.deadlineMs ?? Infinity) / 1000;
      let route: ReturnType<typeof exactJointPath>['path'];
      try {
        route = exactJointPath(scene, directions, deadline, () => clock() / 1000).path;
      } catch {
        return null;
      }
      if (!route.length || route.length > remaining) return null;
      const [action, push, [player, positions]] = route[0]!;
      // A first measurement is allowed only if the projected move leaves all
      // bodies in place. This preserves the current transport options.
      if (learns && !local.geometry && !established && push) return null;
      const command = actions.find(input => input.action_ref === action)!;
      const predicted: Occupancy = [player, [...positions].map(key => key.split(',').map(Number) as [number, number])
        .sort(([ax, ay], [bx, by]) => ax - bx || ay - by)];
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence, ...(established && observed ? [observed.beforeRef] : [])];
      const normal = resolveStrategyGraph({ graph, mode: 'active',
        facts: { pushNext: { value: push, evidence } },
        planners: { prepare_push: () => command, push_toward_matching_sites: () => command } });
      if (!normal.selected) return null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action, expected: player, evidence };
      const trial = push || (!local.geometry && !established);
      const primitive = learns ? resolveNavigationPrimitives({ mode, evidence, probe: trial ? offer : null,
        access: trial ? null : offer, interaction: null }) : null;
      const strategy = primitive?.selected?.id ?? normal.selected.id;
      const label = transportContactStrategies[normal.selected.id], objective = 'G_official_completion';
      const goal = { kind: 'test_transport_to_matching_sites', scope: ref.split(':revision:', 1)[0]!,
        subjects: geometry.targets.map(point => point.join(',')), parentObjective: objective,
        satisfactionContract: 'observe_official_progress_after_joint_occupation' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `${learns ? family : 'transport'}:${need.id}`, commands = [command];
      return { status: 'proposed', kind: family, actions: commands, geometry, predicted, context, needId: need.id,
        steps: [{ action: command, expected_after: predicted }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Test whether the bodies can occupy the matching sites',
          mode: learns ? mode : local.evidence.length ? 'solving' : 'exploration', situation: label, agenda: primitive?.entries ?? normal.entries, evidence, distance: route.length,
          subjects: [sprite(geometry, current[0]), ...current[1].slice(0, 4).map(point => sprite(geometry, point)),
            ...geometry.targets.slice(0, 4).map(point => sprite(geometry, point))] },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        sicLocalDecision: { strategy, objective: { id, label: primitive?.selected ? navigationPrimitives[primitive.selected.id] : label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions: commands, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_transport_scope_bound' : 'transport_scope_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const scene = scored ? null : measure(second, proposal.geometry.targets);
      const matched = scored ? null : !!scene && sameGeometry(layers(scene), proposal.geometry) && equal(jointStatePair(scene), proposal.predicted);
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary' : matched ? 'observed_joint_occupation' : 'joint_occupation_contradicted',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      const scene = measure(second, proposal.geometry.targets);
      if (scene && sameGeometry(layers(scene), proposal.geometry) && equal(jointStatePair(scene), proposal.predicted)) {
        state.geometry = layers(scene);
        state.evidence = [...state.evidence.slice(-3), after.observation_ref];
      } else state.refuted.push(proposal.context);
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}
