import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { PreviewPackingIncomplete, previewPackingAssignments, previewPackingTransform } from '../logos-engine/v6-preview-packing-calculus.ts';
import { previewPackingMeasureScene, previewPackingPointFor, previewPackingPose, previewPackingSample } from '../logos-engine/v6-preview-packing-geometry.ts';
import type { PreviewPackingCell as Cell, PreviewPackingControl as Control, PreviewPackingPiece as Piece,
  PreviewPackingPose as Pose, PreviewPackingScene as Scene, PreviewPackingTransform as Transform } from '../logos-engine/v6-preview-packing-types.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const previewPlacementId = 'sic_preview_placement';
export const verifyPreviewPlacementId = 'sic_verify_preview_placement';
export const previewPlacementStrategies = {
  select_piece_for_partition: 'Select the piece needed to fill the remaining area',
  test_preview_control: 'Test an input on the selected piece',
  move_preview_into_partition: 'Move the selected piece toward its place in the partition',
  switch_to_complementary_piece: 'Keep the fitted piece in place and select the piece that completes the remaining area',
} as const;

type Strategy = keyof typeof previewPlacementStrategies;
type Contribution = { piece: Piece; goal: Pose };
type Transfer = { completed: number; controls: Record<string, Control>; evidence: string[] };
type State = { epoch: number; scene: Scene; piece: Piece; goal: Pose; controls: Record<string, Control>; tried: string[];
  evidence: string[]; count: number; stopped: boolean; pending?: Contribution[] };
type Proposal = NativeProposal & { local: State; strategy: Strategy; current: Pose; predicted: Pose | null;
  attempt: string; needId: string; nextPiece?: Contribution };
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

function previewRoute(scene: Scene, goal: Pose, controls: State['controls'], current: Pose,
  inputs: readonly NativeCommand[], budget: number) {
  const moves = inputs.filter(command => Object.hasOwn(controls, command.action_ref));
  const world = new Set(scene.world.map(key));
  const queue: { pose: Pose; depth: number; first: { command: NativeCommand; pose: Pose } | null }[] =
    [{ pose: current, depth: 0, first: null }];
  const seen = new Set([poseKey(current)]);
  for (const position of queue) {
    if (poseKey(position.pose) === poseKey(goal)) return { first: position.first, cost: position.depth };
    if (position.depth >= budget || seen.size >= 2048) continue;
    for (const command of moves) {
      const effect = controls[command.action_ref]!;
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

async function prepare(rows: NativeRows, epoch: number, inputs: readonly NativeCommand[], budget: number,
  learned: Transfer | null, execution: Parameters<typeof previewPackingAssignments>[1]): Promise<State | null> {
  const scene = previewPackingMeasureScene(rows);
  const movable = scene?.pieces.filter(piece => piece.movable);
  if (!scene || !movable?.length) return null;
  try {
    if (movable.length === 1) {
      const { packing_assignments: assignments } = await previewPackingAssignments(scene, execution);
      const piece = movable[0]!;
      const goal = assignments.length === 1 ? assignments[0]!.poses.find(pose => pose.piece_ref === piece.id) : null;
      return goal ? { epoch, scene, piece, goal: { anchor: goal.anchor, mask: goal.mask },
        controls: {}, tried: [], evidence: [], count: 0, stopped: false } : null;
    }
    if (!learned) return null;
    const { packing_assignments: assignments } = await previewPackingAssignments(scene, execution);
    let best: { cost: number; placements: Contribution[] } | null = null;
    for (const { poses } of assignments) {
      const placements: Contribution[] = [];
      let cost = movable.length;
      for (const piece of movable) {
        const pose = poses.find(pose => pose.piece_ref === piece.id);
        if (!pose) break;
        const goal = { anchor: pose.anchor, mask: pose.mask };
        const route = previewRoute(scene, goal, learned.controls, piece, inputs, budget - cost);
        if (!route) break;
        cost += route.cost;
        placements.push({ piece, goal });
      }
      if (placements.length === movable.length && cost <= budget && (!best || cost < best.cost)) best = { cost, placements };
    }
    if (!best) return null;
    const [first, ...pending] = best.placements;
    return { ...first!, epoch, scene, pending, controls: learned.controls, evidence: learned.evidence,
      tried: [], count: 0, stopped: false };
  } catch (error) {
    if (error instanceof PreviewPackingIncomplete) return null;
    throw error;
  }
}

export function createSicVerifyPreviewPlacement(): NativeFamily<Proposal> {
  let state: State | null = null;
  let transfer: Transfer | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyPreviewPlacementId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      const continuing = state?.epoch === observation.level_epoch && state.pending !== undefined
        && state.scene.selected === state.piece.id && !state.stopped;
      if ((group === observedMechanicsGroup) !== continuing) return null;
      return this.propose(observation, rows, inputs, remaining, execution);
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const learned = transfer?.completed === observation.levels_completed ? transfer : null;
      const local = state?.epoch === observation.level_epoch ? state
        : await prepare(rows, observation.level_epoch, inputs, remaining, learned, execution);
      if (!local || local.stopped || (local.pending === undefined && local.count >= 24)) return null;
      const { scene, piece } = local;
      const current = scene.selected ? previewPackingPose(rows, scene) : { anchor: piece.anchor, mask: piece.mask };
      if (!current) return null;
      const ready = poseKey(current) === poseKey(local.goal);
      const nextPiece = ready && scene.selected ? local.pending?.[0] : undefined;
      if (ready && !nextPiece) return null;
      const commands = inputs.filter(command => /^ACTION[1-5]$/.test(command.action_ref));
      const route = scene.selected && !nextPiece ? previewRoute(scene, local.goal, local.controls, current, commands, remaining)?.first ?? null : null;
      const probe = scene.selected ? commands.find(command => !local.controls[command.action_ref]
        && !local.tried.includes(key([poseKey(current), command.action_ref]))) ?? null : null;
      const point = previewPackingPointFor(scene, nextPiece?.piece ?? piece);
      const click: NativeCommand = { action_ref: 'ACTION6', data: point };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const trial = scene.selected && !nextPiece ? probe : click;
      const mode = execution?.reasoningMode ?? (route ? 'solving' : 'exploration');
      const facts = { routeSupported: !!route, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const selectedRoute = strategy === 'P07' ? route : null;
      const command = strategy === 'P07' ? route?.command : trial;
      if (!command) return null;
      const phase = selectedRoute ? 'move_preview_into_partition' : nextPiece ? 'switch_to_complementary_piece'
        : command === click ? 'select_piece_for_partition' : 'test_preview_control';
      const label = previewPlacementStrategies[phase];
      const parent = 'G_official_completion';
      const goal = { kind: 'complete_visible_partition', scope: ref.split(':revision:', 1)[0]!,
        subjects: [local.pending ? 'frame_and_complementary_pieces' : 'frame_and_movable_piece'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_filling_the_frame' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `preview-placement:${need.id}`, actions = [command];
      const binding = command === click ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [point.x, point.y], { reason: label, evidence }) : null;
      return { status: 'proposed', kind: verifyPreviewPlacementId, actions, local, strategy: phase, current, predicted: selectedRoute?.pose ?? null,
        ...(nextPiece ? { nextPiece } : {}),
        attempt: key([poseKey(current), command.action_ref]), needId: need.id,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: local.pending ? 'Fit the movable pieces together in the frame'
          : 'Fill the remaining part of the frame with the movable piece', mode,
          situation: label, agenda: [], evidence, triggerCard: decision.receipt.workflow,
          currentPiece: bounds(scene, current), target: bounds(scene, local.goal),
          ...(local.pending?.length ? { remaining: local.pending.map(({ piece, goal }) => ({
            piece: bounds(scene, piece), destination: bounds(scene, goal),
          })) } : {}) },
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
      const matched = proposal.nextPiece ? switchedPiece(second, local, proposal.nextPiece) !== null
        : strategy === 'select_piece_for_partition' ? selection(second, local.scene, local.piece) !== null
        : predicted ? next !== null && poseKey(next) === poseKey(predicted) : null;
      return { matched, seal_prefix: true, reason: matched === null ? 'observe_preview_control_return'
        : matched ? 'preview_pose_confirmed' : 'preview_pose_contradicted' };
    },
    record(before, after, command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        transfer = { completed: after.levels_completed, controls: proposal.local.controls,
          evidence: [...proposal.local.evidence.slice(-4), after.observation_ref] };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, strategy, current, predicted, attempt } = proposal;
      const next = { ...local, count: local.count + 1, evidence: [...local.evidence.slice(-4), after.observation_ref] };
      if (proposal.nextPiece) {
        const scene = switchedPiece(second, local, proposal.nextPiece);
        state = scene ? { ...next, ...proposal.nextPiece, scene, pending: local.pending!.slice(1), tried: [] }
          : { ...next, stopped: true };
        return { events: [] };
      }
      if (strategy === 'select_piece_for_partition') {
        const color = selection(second, local.scene, local.piece);
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
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone((value.transfer as Transfer | undefined) ?? null);
    },
  };
}

function selection(rows: NativeRows, scene: Scene, piece: Piece) {
  const colors = new Set(piece.mask.map(([r, c]) =>
    previewPackingSample(rows, scene, [piece.anchor[0] + r, piece.anchor[1] + c])[0]));
  return colors.size === 1 && !colors.has(piece.color) ? [...colors][0]! : null;
}

function switchedPiece(rows: NativeRows, local: State, next: Contribution): Scene | null {
  const color = selection(rows, local.scene, next.piece);
  if (color === null) return null;
  const pieces = local.scene.pieces.map(piece => piece.id === local.piece.id ? { ...piece, ...local.goal } : piece);
  const scene = { ...local.scene, selected: next.piece.id, preview_color: color, pieces };
  const preserved = pieces.filter(piece => piece.id !== next.piece.id).every(piece => piece.mask.every(([row, column]) =>
    previewPackingSample(rows, scene, [piece.anchor[0] + row, piece.anchor[1] + column])[0] === piece.color));
  const preview = previewPackingPose(rows, scene);
  return preserved && preview && poseKey(preview) === poseKey(next.piece) ? scene : null;
}
function measureEffect(current: Pose, observed: Pose, evidence: string[]): Control | null {
  const delta: Cell = [observed.anchor[0] - current.anchor[0], observed.anchor[1] - current.anchor[1]];
  if (same(current.mask, observed.mask) && Math.abs(delta[0]) + Math.abs(delta[1]) === 1) return { kind: 'translation', delta, evidence };
  if (!same(current.anchor, observed.anchor) || same(current.mask, observed.mask)) return null;
  const matches = transforms.filter(transform => same(previewPackingTransform(current.mask, transform), observed.mask));
  return matches.length === 1 ? { kind: 'transform', transform: matches[0]!, evidence } : null;
}
