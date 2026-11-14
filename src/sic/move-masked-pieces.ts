import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { SELECTED_RIGID_DIRECTIONS, selectedRigidMoved, selectedRigidPoint, selectedRigidPoses, selectedRigidScene } from '../logos-engine/v6-selected-rigid-geometry.ts';
import { selectedRigidRoute, SelectedRigidIncomplete } from '../logos-engine/v6-selected-rigid-search.ts';
import type { SelectedRigidPoses, SelectedRigidRouteStep, SelectedRigidScene } from '../logos-engine/v6-selected-rigid-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const moveMaskedPiecesId = 'sic_move_masked_pieces';

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
type Choice = { kind: 'select' | 'probe' | 'move'; index: number; action: NativeCommand; variants: Variant[]; route: SelectedRigidRouteStep[] };
type Proposal = NativeProposal & { local: State; choice: Choice; needId: string };

const same = ([x, y]: NativePoint, [a, b]: NativePoint) => x === a && y === b;
const samePoses = (a: SelectedRigidPoses, b: SelectedRigidPoses) => a.length === b.length && a.every((p, i) => same(p, b[i]!));

async function choose(local: State, execution?: NativeExecution): Promise<Choice | null> {
  const { scene, active, models } = local;
  if (!models.length) return null;
  const now = execution?.now ?? (() => performance.now());
  const deadline = Math.min(execution?.deadlineMs ?? Infinity, now() + 4000);
  let route = local.route;
  if (!route) {
    try {
      let checkpoints = 0;
      const searchExecution: NativeExecution = {
        ...execution, now, deadlineMs: deadline,
        async yieldControl() {
          if (++checkpoints % 32 !== 0) return;
          await (execution?.yieldControl() ?? new Promise<void>(resolve => setTimeout(resolve, 0)));
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

export function createSicMoveMaskedPieces(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: moveMaskedPiecesId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION6', ...inputs].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = selectedRigidScene(rows, prior?.scene);
      if (!scene) return null;
      const continuous = prior && samePoses(selectedRigidPoses(prior.scene), selectedRigidPoses(scene));
      const local: State = continuous ? { ...prior, scene } : { epoch: observation.level_epoch, scene, active: null,
        models: prior?.models ?? controlModels, route: null, refs: prior?.refs ?? [] };
      const choice = await choose(local, execution);
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
          : 'Follow the route while checking the full outline of each piece';
      const witness = choice.kind === 'select' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [choice.action.data.x!, choice.action.data.y!], { reason: situation, evidence }) : null;
      if (choice.kind === 'select' && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'fit_selected_piece_through_opening', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['selected_piece', 'movable_obstacles', 'matching_opening'], parentObjective: parent, satisfactionContract: 'official_progress_at_matching_opening' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = moveMaskedPiecesId + ':' + need.id, action = choice.action;
      const focus = scene.bodies[choice.index]!, goal = scene.receptacle;
      return {
        status: 'proposed', kind: moveMaskedPiecesId, local, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.kind === 'move' ? next[2] : null, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Clear a route for the piece that fits the opening', situation, evidence, agenda: entries, mode,
          triggerCard: card, focus: boxFor(scene, focus.position, focus.mask), target: boxFor(scene, goal.position, goal.mask),
          destination: boxFor(scene, next[2][choice.index]!, focus.mask), compatibleControls: local.models.length },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'piece_configuration_bound' : 'piece_configuration_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, choice } = proposal, scene = selectedRigidScene(second, local.scene);
      if (choice.kind === 'select') return { matched: null, seal_prefix: true, reason: 'selection_pending_directional_evidence' };
      const compatible = scene && choice.variants.some(v => samePoses(v.poses, selectedRigidPoses(scene)));
      return { matched: !!compatible, seal_prefix: true, reason: compatible ? 'compatible_full_mask_return' : 'full_mask_projection_contradicted' };
    },
    record(before, after, _action, _first, second, { local, choice }) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const scene = selectedRigidScene(second, local.scene);
      if (!scene) {
        state = { ...local, active: null, models: [], route: null };
        return { events: [] };
      }
      const poses = selectedRigidPoses(scene), stationary = samePoses(poses, selectedRigidPoses(local.scene));
      const models = choice.kind === 'select' ? local.models : choice.variants.filter(v => samePoses(v.poses, poses)).map(v => v.model);
      const advanced = choice.route[0] && samePoses(poses, choice.route[0][2]);
      state = { ...local, scene, active: choice.index, models,
        route: stationary ? choice.route : advanced ? choice.route.slice(1) : null,
        refs: [...local.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
