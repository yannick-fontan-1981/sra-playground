import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { SELECTED_RIGID_DIRECTIONS, selectedRigidMoved, selectedRigidPoint, selectedRigidPoses, selectedRigidScene } from '../logos-engine/v6-selected-rigid-geometry.ts';
import { selectedRigidRoute, SELECTED_RIGID_SOURCE_LIMITS, SelectedRigidIncomplete } from '../logos-engine/v6-selected-rigid-search.ts';
import type { SelectedRigidPoses, SelectedRigidRouteStep, SelectedRigidScene } from '../logos-engine/v6-selected-rigid-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const moveMaskedPiecesId = 'sic_move_masked_pieces';
export const learnSelectedAccessId = 'sic_learn_selected_access';

const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] as const;
const permutations = (values: readonly NativePoint[]): NativePoint[][] => values.length
  ? values.flatMap((value, index) => permutations(values.filter((_, j) => j !== index)).map(tail => [value, ...tail]))
  : [[]];
const controlModels = permutations(SELECTED_RIGID_DIRECTIONS);

type State = {
  epoch: number;
  scene: SelectedRigidScene;
  active: number | null;
  models: NativePoint[][];
  route: SelectedRigidRouteStep[] | null;
  refs: string[];
};
type Variant = { model: NativePoint[]; poses: SelectedRigidPoses };
type Transfer = { epoch: number; models: NativePoint[][]; evidence: string[] };
type Choice = { kind: 'select' | 'probe' | 'move'; index: number; action: NativeCommand; variants: Variant[]; route: SelectedRigidRouteStep[] };
type RigidLeg = { action: NativeCommand; index: number; prediction: SelectedRigidPoses };
type Proposal = NativeProposal & { local: State; choice: Choice; walk?: RigidLeg[]; needId: string };

const same = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const samePoses = (a: SelectedRigidPoses, b: SelectedRigidPoses) => a.length === b.length && a.every((p, i) => same(p, b[i]!));
const measurement = { outlinedReceptacles: true };

function forLeg(proposal: Proposal, index: number, models: State['models']): Choice {
  if (!index || !proposal.walk) return proposal.choice;
  const { action, index: piece, prediction } = proposal.walk[index]!;
  return { kind: 'move', index: piece, action, variants: models.map(model => ({ model, poses: prediction })),
    route: proposal.choice.route.slice(index) };
}

function partiallyInserted(scene: SelectedRigidScene): boolean {
  const target = scene.receptacle.access && scene.bodies.find(body => body.key === scene.receptacle.key);
  if (!target) return false;
  const entered = target.mask.filter(([, y]) => y + target.position[1] >= scene.geometry.size[1]).length;
  return entered > 0 && entered < target.mask.length;
}

async function choose(local: State, routeTimeBoundMs: number, execution?: NativeExecution): Promise<Choice | null> {
  const { scene, active, models } = local;
  if (!models.length) return null;
  const now = execution?.now ?? (() => performance.now());
  const deadline = Math.min(execution?.deadlineMs ?? Infinity, now() + routeTimeBoundMs);
  let route = local.route;
  if (!route) {
    try {
      // Check cancellation on the search's work interval, but yield the UI on
      // elapsed time. Counting cheap collision checks can otherwise spend the
      // route deadline in timers even when the search itself is fast.
      let resumedAt = now();
      const searchExecution: NativeExecution = {
        ...execution, now, deadlineMs: deadline,
        async yieldControl() {
          if (now() - resumedAt < 10) return;
          await (execution?.yieldControl() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
          resumedAt = now();
        },
      };
      [route] = await selectedRigidRoute(scene, active, deadline, searchExecution);
    } catch (error) {
      if (error instanceof SelectedRigidIncomplete) return null;
      throw error;
    }
  }
  const next = route?.[0];
  if (!route || !next) return null;
  const [index, direction] = next;
  if (index !== active) {
    return { kind: 'select', index, action: { action_ref: 'ACTION6', data: selectedRigidPoint(scene, index) }, variants: [], route };
  }
  const poses = selectedRigidPoses(scene);
  const candidates = inputs.map((action_ref, i) => {
    const variants = models.map(model => ({ model, poses: selectedRigidMoved(scene, poses, index, model[i]!) }));
    const toward = models.filter(model => same(model[i]!, direction)).length;
    const distinct = new Set(variants.map(v => JSON.stringify(v.poses))).size;
    return { action: { action_ref, data: {} }, variants, toward, distinct };
  });
  const known = candidates.find(c => c.toward === models.length);
  if (known) return { ...known, kind: 'move', index, route };
  const probe = candidates.filter(c => c.distinct > 1).sort((a, b) => b.distinct - a.distinct || b.toward - a.toward)[0];
  return probe ? { ...probe, kind: 'probe', index, route } : null;
}

function boxFor(scene: SelectedRigidScene, position: NativePoint, mask: NativePoint[]): NativeBox {
  const { origin: [ox, oy], q } = scene.geometry;
  const [x, y] = position;
  return [ox + x * q, oy + y * q,
    ox + (x + 1 + Math.max(...mask.map(p => p[0]))) * q - 1,
    oy + (y + 1 + Math.max(...mask.map(p => p[1]))) * q - 1];
}

export function createSicMoveMaskedPieces(id = moveMaskedPiecesId): NativeFamily<Proposal> {
  let state: State | null = null;
  let transfer: Transfer | null = null;
  const routeTimeBoundMs = id === learnSelectedAccessId ? SELECTED_RIGID_SOURCE_LIMITS.timeBoundMs : 4000;
  return {
    id,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION6', ...inputs].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const motion = execution?.observedControlledMotion;
      if (id === learnSelectedAccessId && !prior && !motion) return null;
      const scene = selectedRigidScene(rows, prior?.scene, measurement);
      if (!scene) return null;
      const continuous = prior && samePoses(selectedRigidPoses(prior.scene), selectedRigidPoses(scene));
      const recalled = scene.receptacle.access && transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      const local: State = continuous ? { ...prior, scene } : { epoch: observation.level_epoch, scene, active: null,
        models: prior?.models ?? recalled?.models ?? controlModels, route: null, refs: prior?.refs ?? recalled?.evidence ?? [] };
      if (id === learnSelectedAccessId && !prior && motion) {
        const q = scene.geometry.q;
        const dx = (motion.to[0] - motion.from[0]) / q, dy = (motion.to[1] - motion.from[1]) / q;
        const inputIndex = inputs.findIndex(input => input === motion.command);
        const [x, y] = scene.geometry.origin;
        const points = scene.bodies.flatMap((body, index) => body.mask.some(([cx, cy]) => {
          const left = x + (body.position[0] + cx) * q, top = y + (body.position[1] + cy) * q;
          return left <= motion.to[2] && top <= motion.to[3] && left + q - 1 >= motion.to[0] && top + q - 1 >= motion.to[1];
        }) ? [index] : []);
        if (points.length !== 1 || inputIndex < 0 || Math.abs(dx) + Math.abs(dy) !== 1) return null;
        const active = points[0]!;
        const poses = selectedRigidPoses(scene);
        const previous = selectedRigidMoved(scene, poses, active, [-dx, -dy]);
        if (samePoses(poses, previous) || !samePoses(poses, selectedRigidMoved(scene, previous, active, [dx, dy]))) return null;
        local.active = active;
        local.models = controlModels.filter(model => same(model[inputIndex]!, [dx, dy]));
        local.refs = [...motion.evidence];
      }
      const choice = await choose(local, routeTimeBoundMs, execution);
      if (!choice) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const next = choice.route[0]!;
      const offer = { input: choice.action.action_ref, expected: next[2][choice.index]!, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: choice.kind === 'move' ? null : offer, access: choice.kind === 'move' ? offer : null, interaction: null });
      if (!selected) return null;
      const situation = choice.kind === 'select' ? 'Select the piece needed to clear or reach the opening'
        : choice.kind === 'probe' ? 'Distinguish the possible directional effects on the selected piece'
          : partiallyInserted(scene) && scene.bodies[choice.index]?.key === scene.receptacle.key
            ? 'Part of the piece is still on the board. Complete the insertion and check the level result.'
            : 'Follow the route while checking the full outline of each piece';
      const witness = choice.kind === 'select' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [choice.action.data.x!, choice.action.data.y!], { reason: situation, evidence }) : null;
      if (choice.kind === 'select' && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_selected_piece_through_opening', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['selected_piece', 'movable_obstacles', 'matching_opening'], parentObjective: parent, satisfactionContract: 'official_progress_at_matching_opening' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const composition = id + ':' + need.id, action = choice.action;
      const focus = scene.bodies[choice.index]!, goal = scene.receptacle;
      const walk: RigidLeg[] = [];
      if (choice.kind === 'move' && choice.variants.every(variant => samePoses(variant.poses, next[2]))) {
        let poses = selectedRigidPoses(scene);
        for (const [index, direction, prediction] of choice.route.slice(0, Math.min(remaining, maximumCommittedActions))) {
          if (index !== local.active) break;
          const input = inputs.findIndex((_, i) => local.models.every(model => same(model[i]!, direction)));
          if (input < 0 || !samePoses(selectedRigidMoved(scene, poses, index, direction), prediction)) break;
          walk.push({ action: { action_ref: inputs[input]!, data: {} }, index, prediction });
          poses = prediction;
        }
      }
      const actions = walk.length > 1 ? walk.map(step => step.action) : [action];
      return {
        status: 'proposed', kind: id, local, choice, needId: need.id,
        ...(walk.length > 1 ? { walk } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: choice.kind === 'move' ? walk[index]?.prediction ?? next[2] : null,
          ...(witness ? { point_binding: witness } : {}) })),
        sicSituationCard: { strategy: selected.id, need: 'Clear a route for the piece that fits the opening', situation, evidence, agenda: entries, mode,
          triggerCard: card, focus: boxFor(scene, focus.position, focus.mask), target: boxFor(scene, goal.position, goal.mask),
          destination: boxFor(scene, next[2][choice.index]!, focus.mask), compatibleControls: local.models.length },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id: composition, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id: composition, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: composition, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: composition } },
      };
    },
    before(proposal, index, packet, current) {
      if (index > 0 && proposal.walk) {
        const observed = selectedRigidScene(packet.frame_rows, proposal.local.scene, measurement);
        const admitted = proposal.local.epoch === current.level_epoch && !!observed
          && samePoses(selectedRigidPoses(observed), proposal.walk[index - 1]!.prediction);
        return { admitted, reason: admitted ? 'retained_masks_and_landing_confirmed' : 'piece_configuration_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'piece_configuration_bound' : 'piece_configuration_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local } = proposal, choice = forLeg(proposal, index, local.models);
      const scene = selectedRigidScene(second, local.scene, measurement);
      if (choice.kind === 'select') return { matched: null, seal_prefix: true, reason: 'selection_pending_directional_evidence' };
      const compatible = scene && choice.variants.some(v => samePoses(v.poses, selectedRigidPoses(scene)));
      return { matched: !!compatible, seal_prefix: !compatible || index + 1 >= proposal.actions.length, reason: compatible
        ? partiallyInserted(scene) ? 'observed_partial_insertion' : 'compatible_full_mask_return' : 'full_mask_projection_contradicted' };
    },
    record(before, after, action, _first, second, proposal, index) {
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const choice = forLeg(proposal, index, local.models);
      if (after.levels_completed > before.levels_completed && choice.kind === 'move' && local.models.length === 1) {
        transfer = { epoch: before.level_epoch, models: local.models, evidence: [...local.refs.slice(-4), after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const scene = selectedRigidScene(second, local.scene, measurement);
      if (!scene) {
        state = { ...local, active: null, models: [], route: null };
        return { events: [] };
      }
      const poses = selectedRigidPoses(scene), stationary = samePoses(poses, selectedRigidPoses(local.scene));
      let models = choice.kind === 'select' ? local.models : choice.variants.filter(v => samePoses(v.poses, poses)).map(v => v.model);
      let active: number | null = choice.index;
      // If every learned mapping predicted motion and nothing moved, reselect before revising the mappings.
      if (local.scene.receptacle.access && !models.length && choice.kind !== 'select'
          && (id !== learnSelectedAccessId || !stationary)) {
        const input = inputs.findIndex(candidate => candidate === action.action_ref);
        if (input >= 0) models = controlModels.filter(model => samePoses(poses,
          selectedRigidMoved(local.scene, selectedRigidPoses(local.scene), choice.index, model[input]!)));
      }
      if (id === learnSelectedAccessId && !models.length && choice.kind !== 'select') {
        const priorPoses = selectedRigidPoses(local.scene);
        const moved = poses.flatMap((position, index) => same(position, priorPoses[index]!) ? [] : [index]);
        const command = inputs.findIndex(input => input === choice.action.action_ref);
        if (moved.length === 1 && command >= 0) {
          active = moved[0]!;
          const from = priorPoses[active]!, to = poses[active]!;
          models = local.models.filter(model => same(model[command]!, [to[0] - from[0], to[1] - from[1]]));
        }
        if (!models.length) {
          models = local.models;
          active = null;
        }
      }
      const advanced = choice.route[0] && samePoses(poses, choice.route[0][2]);
      state = { ...local, scene, active, models,
        route: active === null ? null : stationary ? choice.route : advanced ? choice.route.slice(1) : null,
        refs: [...local.refs.slice(-4), after.observation_ref] };
      return { events: [], ...(!stationary && partiallyInserted(scene) ? {
        reviewEvidence: 'The observed full mask still spans the board and the entrance, with no level advancement.',
      } : {}) };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone((value.transfer as Transfer | undefined) ?? null);
    },
  };
}
