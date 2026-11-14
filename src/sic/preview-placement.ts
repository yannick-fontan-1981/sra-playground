import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { PreviewPackingIncomplete, previewPackingAssignments, previewPackingTransform } from '../logos-engine/v6-preview-packing-calculus.ts';
import { previewPackingMeasureScene, previewPackingPointFor, previewPackingPose, previewPackingSample } from '../logos-engine/v6-preview-packing-geometry.ts';
import type { PreviewPackingCell as Cell, PreviewPackingControl as Control, PreviewPackingPiece as Piece,
  PreviewPackingPose as Pose, PreviewPackingScene as Scene, PreviewPackingTransform as Transform } from '../logos-engine/v6-preview-packing-types.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const previewPlacementId = 'sic_preview_placement';
export const previewPlacementStrategies = {
  select_piece_for_partition: 'Select the piece needed to fill the remaining area',
  test_preview_control: 'Test an input on the selected piece',
  move_preview_into_partition: 'Move the selected piece toward its place in the partition',
} as const;
const graph = compileStrategyGraph({ id: 'fit_preview_piece_in_remaining_space', version: 1, order: 'FALLBACK',
  priorities: ['move_preview_into_partition', 'select_piece_for_partition', 'test_preview_control'],
  strategies: {
    select_piece_for_partition: [{ fact: 'canSelect', expected: true, label: 'A complete partition indicates a unique position for the movable piece' }],
    test_preview_control: [{ fact: 'canTest', expected: true, label: 'A selected piece has an untested command in its current pose' }],
    move_preview_into_partition: [{ fact: 'canRoute', expected: true, label: 'Observed commands produce a route to the measured partition' }],
  },
}, ['canSelect', 'canTest', 'canRoute']);

type Strategy = keyof typeof previewPlacementStrategies;
type State = { epoch: number; scene: Scene; piece: Piece; goal: Pose; controls: Record<string, Control>; tried: string[];
  evidence: string[]; count: number; stopped: boolean };
type Proposal = NativeProposal & { local: State; strategy: Strategy; current: Pose; predicted: Pose | null; attempt: string; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const poseKey = ({ anchor, mask }: Pose) => key([anchor, mask]);
const same = (a: unknown, b: unknown) => key(a) === key(b);
const transforms: Transform[] = ['rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns'];

function bounds(scene: Scene, pose: Pose): NativeBox {
  const rows = pose.mask.map(([y]) => y + pose.anchor[0]), cols = pose.mask.map(([, x]) => x + pose.anchor[1]);
  const [top, left] = scene.offset, q = scene.q;
  return [left + Math.min(...cols) * q, top + Math.min(...rows) * q,
    left + (Math.max(...cols) + 1) * q - 1, top + (Math.max(...rows) + 1) * q - 1];
}

function firstStep(local: State, current: Pose, inputs: readonly NativeCommand[], budget: number) {
  const moves = inputs.filter(command => Object.hasOwn(local.controls, command.action_ref));
  const world = new Set(local.scene.world.map(key));
  const queue: { pose: Pose; depth: number; first: { command: NativeCommand; pose: Pose } | null }[] =
    [{ pose: current, depth: 0, first: null }];
  const seen = new Set([poseKey(current)]);
  for (const position of queue) {
    if (poseKey(position.pose) === poseKey(local.goal)) return position.first;
    if (position.depth >= budget || seen.size >= 2048) continue;
    for (const command of moves) {
      const effect = local.controls[command.action_ref]!;
      const [row, column] = position.pose.anchor;
      const pose: Pose = effect.kind === 'translation'
        ? { anchor: [row + effect.delta[0], column + effect.delta[1]], mask: position.pose.mask }
        : { anchor: position.pose.anchor, mask: previewPackingTransform(position.pose.mask, effect.transform) };
      const signature = poseKey(pose);
      if (seen.has(signature) || pose.mask.some(([r, c]) => !world.has(key([r + pose.anchor[0], c + pose.anchor[1]])))) continue;
      seen.add(signature);
      queue.push({ pose, depth: position.depth + 1, first: position.first ?? { command, pose } });
    }
  }
  return null;
}

async function prepare(rows: NativeRows, epoch: number, execution: Parameters<typeof previewPackingAssignments>[1]): Promise<State | null> {
  const scene = previewPackingMeasureScene(rows);
  const movable = scene?.pieces.filter(piece => piece.movable);
  if (!scene || movable?.length !== 1) return null;
  const piece = movable[0]!;
  try {
    const result = await previewPackingAssignments(scene, execution);
    const { packing_assignments: assignments } = result;
    const goal = assignments.length === 1 ? assignments[0]!.poses.find(pose => pose.piece_ref === piece.id) : null;
    return goal ? { epoch, scene, piece, goal: { anchor: goal.anchor, mask: goal.mask },
      controls: {}, tried: [], evidence: [], count: 0, stopped: false } : null;
  } catch (error) {
    if (error instanceof PreviewPackingIncomplete) return null;
    throw error;
  }
}

export function createSicPreviewPlacement(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: previewPlacementId,
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const local = state?.epoch === observation.level_epoch ? state : await prepare(rows, observation.level_epoch, execution);
      if (!local || local.stopped || local.count >= 24) return null;
      const { scene, piece } = local;
      const current = scene.selected ? previewPackingPose(rows, scene) : { anchor: piece.anchor, mask: piece.mask };
      if (!current || poseKey(current) === poseKey(local.goal)) return null;
      const commands = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const route = scene.selected ? firstStep(local, current, commands, remaining) : null;
      const probe = scene.selected ? commands.find(command => !local.controls[command.action_ref]
        && !local.tried.includes(key([poseKey(current), command.action_ref]))) ?? null : null;
      const point = previewPackingPointFor(scene, piece);
      const click: NativeCommand = { action_ref: 'ACTION6', data: point };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        canSelect: { value: !scene.selected, evidence }, canTest: { value: !!probe, evidence }, canRoute: { value: !!route, evidence },
      }, planners: { select_piece_for_partition: () => click, test_preview_control: () => probe,
        move_preview_into_partition: () => route?.command ?? null } });
      if (!selected) return null;
      const strategy = selected.id, command = selected.plan, label = previewPlacementStrategies[strategy];
      const parent = 'G_official_completion';
      const goal = { kind: 'complete_visible_partition', scope: ref.split(':revision:', 1)[0]!, subjects: ['frame_and_movable_piece'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_filling_the_frame' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `preview-placement:${need.id}`, actions = [command];
      const binding = command === click ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [point.x, point.y], { reason: label, evidence }) : null;
      return { status: 'proposed', kind: previewPlacementId, actions, local, strategy, current, predicted: route?.pose ?? null,
        attempt: key([poseKey(current), command.action_ref]), needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Fill the remaining part of the frame with the movable piece', mode: route ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, currentPiece: bounds(scene, current), target: bounds(scene, local.goal) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'preview_placement_bound' : 'preview_placement_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, predicted, strategy } = proposal;
      const next = predicted ? previewPackingPose(second, local.scene) : null;
      const matched = strategy === 'select_piece_for_partition' ? selection(second, local) !== null
        : predicted ? next !== null && poseKey(next) === poseKey(predicted) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_preview_control_return'
        : matched ? 'preview_pose_confirmed' : 'preview_pose_contradicted' };
    },
    record(before, after, command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, strategy, current, predicted, attempt } = proposal;
      const next = { ...local, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      if (strategy === 'select_piece_for_partition') {
        const color = selection(second, local);
        state = color === null ? { ...next, stopped: true }
          : { ...next, scene: { ...local.scene, selected: local.piece.id, preview_color: color } };
        return { events: [] };
      }
      const observed = previewPackingPose(second, local.scene);
      if (!observed || predicted && poseKey(predicted) !== poseKey(observed)) {
        state = { ...next, stopped: true };
        return { events: [] };
      }
      const effect = measureEffect(current, observed, [before.observation_ref, after.observation_ref]);
      state = { ...next, tried: [...local.tried, attempt],
        controls: effect ? { ...local.controls, [command.action_ref]: effect } : local.controls };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}

function selection(rows: NativeRows, { scene, piece }: State) {
  const colors = new Set(piece.mask.map(([r, c]) =>
    previewPackingSample(rows, scene, [piece.anchor[0] + r, piece.anchor[1] + c])[0]));
  return colors.size === 1 && !colors.has(piece.color) ? [...colors][0]! : null;
}

function measureEffect(current: Pose, observed: Pose, evidence: string[]): Control | null {
  const delta: Cell = [observed.anchor[0] - current.anchor[0], observed.anchor[1] - current.anchor[1]];
  if (same(current.mask, observed.mask) && Math.abs(delta[0]) + Math.abs(delta[1]) === 1) return { kind: 'translation', delta, evidence };
  if (!same(current.anchor, observed.anchor) || same(current.mask, observed.mask)) return null;
  const matches = transforms.filter(transform => same(previewPackingTransform(current.mask, transform), observed.mask));
  return matches.length === 1 ? { kind: 'transform', transform: matches[0]!, evidence } : null;
}
