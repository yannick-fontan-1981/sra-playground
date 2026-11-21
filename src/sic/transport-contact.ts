import { maximumCommittedActions } from './plan-step.ts';
import { exactJointPath, jointLayers, jointStatePair, measureJointTransport, type JointScene } from '../logos-engine/v6-joint-transport.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { bestContactPlan, contactScene, newContactHistory, observeContact, type ContactBasis, type ContactHistory } from './contact-induced-layout.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { motionIntoFootprint } from './observed-translation.ts';
import { measureRetainedTransport, rememberTransportAppearance, type TransportAppearance } from './transport-contact-observation.ts';

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
type TransportLeg = { before: Occupancy; predicted: Occupancy; push: boolean };
type Proposal = NativeProposal & { geometry: Geometry; route: TransportLeg[]; needId: string; usesRetainedAppearance?: boolean; contactBasis?: ContactBasis };
type State = { epoch: number; geometry: Geometry | null; evidence: readonly string[]; refuted: string[];
  appearance?: TransportAppearance; usesRetainedAppearance?: boolean; pushRef?: string; inputRefs?: Record<string, string>;
  strictEntry?: boolean; contactHistory?: ContactHistory; contactBasis?: ContactBasis };
type Transfer = { completed: number; appearance: TransportAppearance; evidence: string[]; inputRefs: Record<string, string> };
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
const measureWithAppearance = (rows: NativeRows, remembered: Geometry | null, appearance: TransportAppearance): JointScene | null => {
  try {
    return measureRetainedTransport(rows, appearance, remembered?.targets.map(([x, y]) => [x, y]), remembered ?? undefined);
  } catch {
    return null;
  }
};
const sameGeometry = (a: Geometry, b: Geometry) => a.scale === b.scale && equal(a.offset, b.offset)
  && equal(a.floor, b.floor) && equal(a.targets, b.targets);
const contextKey = (geometry: Geometry, current: Occupancy) =>
  JSON.stringify([geometry.scale, geometry.offset, geometry.floor, geometry.targets, current]);
const sprite = ({ scale, offset: [ox, oy] }: Geometry, [x, y]: NativePoint): NativeBox => {
  const left = x * scale + ox, top = y * scale + oy;
  return [left, top, left + scale - 1, top + scale - 1];
};

export function createSicTransportContact(family = transportContactId): NativeFamily<Proposal> {
  const learns = family === learnTransportAccessId;
  let state = empty();
  let retained: Transfer | null = null;
  return {
    id: family,
    observePublicOutcome(b,a,c,first,second) {
      if(!learns||b.level_epoch!==a.level_epoch||b.levels_completed!==a.levels_completed||b.state!==a.state)return;
      if(state.epoch!==a.level_epoch)state=empty(a.level_epoch);
      if(!b.available_action_refs.some(input=>/^ACTION[1-4]$/.test(input)))return;
      state.strictEntry??=!!measure(first);
      if(state.contactBasis && !contactScene(state.contactBasis,a,second))state={...empty(a.level_epoch),strictEntry:false,refuted:state.refuted};
      if(state.strictEntry || state.geometry || state.contactBasis)return;
      observeContact(state.contactHistory??=newContactHistory(),b,a,c.action_ref,first,second);
    },
    async proposeInGroup(group,observation,rows,inputs,remaining,execution) {
      if(group===observedMechanicsGroup && !(state.epoch===observation.level_epoch &&
        (state.contactBasis || state.contactHistory?.candidates.some(c=>c.ref===observation.observation_ref))))return null;
      const proposal=await this.propose(observation,rows,inputs,remaining,execution);
      return group===observedMechanicsGroup&&!proposal?.contactBasis ? null : proposal;
    },
    propose(observation, rows, inputs, remaining, execution) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const actions = inputs.filter(input => Object.hasOwn(directions, input.action_ref));
      if (actions.length !== 4 || remaining < 1 || local.refuted.length >= 8) return null;
      const transfer = retained?.completed === observation.levels_completed ? retained : null;
      const direct = local.usesRetainedAppearance || local.contactBasis ? null : measure(rows, local.geometry?.targets);
      const legacy = direct ?? (transfer ? measureWithAppearance(rows, local.geometry, transfer.appearance) : null);
      const clock = execution?.now ?? (() => performance.now());
      const deadline = Math.min(clock() + 150, execution?.deadlineMs ?? Infinity) / 1000;
      const induced = !legacy && learns ? bestContactPlan(local.contactBasis?[local.contactBasis]:local.contactHistory?.candidates??[],
        observation,rows,remaining,deadline,()=>clock()/1000,!!local.contactBasis) : null;
      const scene = legacy ?? induced?.scene;
      if (!scene || scene.floor.size > 100 || scene.boxes.size > 5) return null;
      const usesRetainedAppearance = !direct && !induced;
      const geometry = layers(scene), current = jointStatePair(scene), context = contextKey(geometry, current);
      if (local.refuted.includes(context) || (local.geometry && !sameGeometry(local.geometry, geometry))) return null;
      const receipt = learns && !local.geometry ? execution?.readDirectionalMotion?.() : null;
      const observed = receipt?.afterRef === observation.observation_ref && receipt.levelEpoch === observation.level_epoch ? receipt : null;
      const motion = observed && motionIntoFootprint(observed, sprite(geometry, current[0]));
      const direction = observed ? directions[observed.command] : null;
      const established = !!direction && !!motion && motion.every((delta, axis) => delta === direction[axis]! * geometry.scale);
      let route: ReturnType<typeof exactJointPath>['path'];
      try {
        route = induced?.route ?? exactJointPath(scene, directions, deadline, () => clock() / 1000).path;
      } catch {
        return null;
      }
      if (!route.length || route.length > remaining) return null;
      const [action, push, [player, positions]] = route[0]!;
      const retainedDirection = usesRetainedAppearance ? transfer?.inputRefs?.[action] : undefined;
      if (usesRetainedAppearance && !local.geometry && push && !retainedDirection) return null;
      // A first measurement is allowed only if the projected move leaves all
      // bodies in place. This preserves the current transport options.
      if (learns && !local.geometry && !established && !usesRetainedAppearance && push) return null;
      const command = actions.find(input => input.action_ref === action)!;
      const predicted: Occupancy = [player, [...positions].map(key => key.split(',').map(Number) as [number, number])
        .sort(([ax, ay], [bx, by]) => ax - bx || ay - by)];
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence,
        ...(usesRetainedAppearance ? transfer!.evidence : []), ...(retainedDirection ? [retainedDirection] : []),
        ...(established && observed ? [observed.beforeRef] : []), ...(induced?.model.refs??[])])];
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
      const label = induced && !local.contactBasis ? 'Move the subject away from the observed contact and check that the other body stays in place'
        : usesRetainedAppearance && !local.geometry && push
        ? 'Reuse the confirmed contact rule to test the first push on the newly measured grid'
        : transportContactStrategies[normal.selected.id];
      const objective = 'G_official_completion';
      const goal = { kind: 'test_transport_to_matching_sites', scope: ref.split(':revision:', 1)[0]!,
        subjects: geometry.targets.map(point => point.join(',')), parentObjective: objective,
        satisfactionContract: 'observe_official_progress_after_joint_occupation' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `${learns ? family : 'transport'}:${need.id}`, commands = [command];
      const legs: TransportLeg[] = [{ before: current, predicted, push }];
      if (local.geometry && (!push || local.pushRef)) for (const [input, pushing, [next, boxes]] of route.slice(1, maximumCommittedActions)) {
        const previous = legs.at(-1)!.predicted;
        const nextCommand = actions.find(candidate => candidate.action_ref === input);
        if (!nextCommand || pushing && !local.pushRef || local.refuted.includes(contextKey(geometry, previous))) break;
        const occupied: Occupancy = [next, [...boxes].map(key => key.split(',').map(Number) as [number, number])
          .sort(([ax, ay], [bx, by]) => ax - bx || ay - by)];
        legs.push({ before: previous, predicted: occupied, push: pushing });
        commands.push(nextCommand);
      }
      return { status: 'proposed', kind: family, actions: commands, geometry, route: legs, needId: need.id,
        ...(induced?{contactBasis:induced.model}:{}),
        ...(usesRetainedAppearance ? { usesRetainedAppearance: true } : {}),
        steps: commands.map((action, index) => ({ action, expected_after: legs[index]!.predicted })),
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
    before(proposal, index, packet, observation) {
      const scene = index === 0 ? null : proposal.contactBasis ? contactScene(proposal.contactBasis,observation,packet.frame_rows) : proposal.usesRetainedAppearance && retained
        ? measureWithAppearance(packet.frame_rows, proposal.geometry, retained.appearance) : measure(packet.frame_rows, proposal.geometry.targets);
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : proposal.binding?.level_epoch === observation.level_epoch && !!scene && sameGeometry(layers(scene), proposal.geometry)
          && equal(jointStatePair(scene), proposal.route[index]!.before);
      return { admitted, reason: admitted ? 'current_transport_scope_bound' : 'transport_scope_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const scene = scored ? null : proposal.contactBasis ? contactScene(proposal.contactBasis,after,second) : proposal.usesRetainedAppearance && retained
        ? measureWithAppearance(second, proposal.geometry, retained.appearance) : measure(second, proposal.geometry.targets);
      const matched = scored ? null : !!scene && sameGeometry(layers(scene), proposal.geometry) && equal(jointStatePair(scene), proposal.route[index]!.predicted);
      return { matched, seal_prefix: !matched || index + 1 >= proposal.route.length, reason: scored ? 'official_boundary' : matched ? 'observed_joint_occupation' : 'joint_occupation_contradicted',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, first, second, proposal, index) {
      if (after.levels_completed > before.levels_completed && state.appearance && state.pushRef && state.inputRefs) {
        retained = { completed: after.levels_completed, appearance: state.appearance,
          evidence: [state.pushRef, ...state.evidence.slice(-3), after.observation_ref], inputRefs: state.inputRefs };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      const scene = proposal.contactBasis ? contactScene(proposal.contactBasis,after,second) : proposal.usesRetainedAppearance && retained
        ? measureWithAppearance(second, proposal.geometry, retained.appearance) : measure(second, proposal.geometry.targets);
      const leg = proposal.route[index]!;
      if (scene && sameGeometry(layers(scene), proposal.geometry) && equal(jointStatePair(scene), leg.predicted)) {
        const firstMatch = !state.geometry;
        if(proposal.contactBasis)state.contactBasis=proposal.contactBasis;
        state.geometry = layers(scene);
        state.usesRetainedAppearance = proposal.usesRetainedAppearance === true;
        state.evidence = [...state.evidence.slice(-3), after.observation_ref];
        state.inputRefs = { ...state.inputRefs, [command.action_ref]: after.observation_ref };
        if (leg.push) state.pushRef = after.observation_ref;
        const earlier = !firstMatch ? null : proposal.usesRetainedAppearance && retained
          ? measureWithAppearance(first, proposal.geometry, retained.appearance) : measure(first, proposal.geometry.targets);
        const known = earlier ? rememberTransportAppearance(first, earlier) : state.appearance;
        state.appearance = rememberTransportAppearance(second, scene, known);
        if (firstMatch && proposal.usesRetainedAppearance && leg.push) return {
          events: [], reviewEvidence: 'The new grid shows the player and one body moving together by one cell after contact.',
        };
      } else {
        state.refuted.push(contextKey(proposal.geometry,leg.before));
        if(proposal.contactBasis)state={...empty(after.level_epoch),strictEntry:false,refuted:state.refuted};
      }
      return { events: [] };
    },
    state: () => ({ ...state, ...(retained ? { retained } : {}) }),
    restore(value: NativeRecord) {
      const { retained: saved, ...local } = structuredClone(value);
      state = local as State;
      retained = (saved as Transfer | undefined) ?? null;
    },
  };
}
