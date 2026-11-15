import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { blockedRouteStep, rememberRouteRefusal, type RouteRefusals } from './route-refusals.ts';
import { assessRoomStep, contactDirections as directions, nextRoomStep, shiftTile as shift, startRoomRoute,
  tileBox as footprint, type ContactStep as Step, type RoomRoute, type RoomStep } from './revealed-compartment-route.ts';

export const seatedContactId = 'sic_seated_contact';
export const verifyFrameContactId = 'sic_verify_frame_contact';

type Part = ReturnType<typeof geometricComponents>[number];
type Scene = { piece: Part; frame: Part; floor: Part; side: number };
type State = { epoch: number; at: NativePoint; scene: Scene; refs: string[]; blocked: RouteRefusals; avoid: string[];
  seated: boolean; tried: string[]; count: number; roomRoute?: RoomRoute };
type Proposal = NativeProposal & { local: State; step: Step; needId: string; roomStep?: RoomStep };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const dist = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function measure(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows);
  const floor = parts.find(p => p.area * 2 > rows.length * (rows[0]?.length ?? 0));
  if (!floor) return null;
  const candidates: Scene[] = [];
  for (const frame of parts) {
    const n = width(frame.bbox);
    if (n < 3 || n > 12 || n !== height(frame.bbox) || frame.area !== 4 * (n - 1)
      || frame.mask.some(([x, y]) => x !== 0 && x !== n - 1 && y !== 0 && y !== n - 1)) continue;
    const [fx, fy] = origin(frame.bbox);
    const inset = parts.find(p => p.color === floor.color && p.area === (n - 2) ** 2
      && p.bbox[0] === fx + 1 && p.bbox[1] === fy + 1 && p.bbox[2] === fx + n - 2 && p.bbox[3] === fy + n - 2);
    if (!inset) continue;
    const pieces = parts.filter(p => p.color === frame.color && width(p.bbox) === n && height(p.bbox) === n
      && p.area === n * n - 1 && (p.bbox[0] - fx) % n === 0 && (p.bbox[1] - fy) % n === 0);
    if (pieces.length === 1) candidates.push({ piece: pieces[0]!, frame, floor, side: n });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function visibleFloor(rows: NativeRows, box: NativeBox, color: number): boolean {
  const [l, t, r, b] = box;
  if (l < 0 || t < 0 || r >= (rows[0]?.length ?? 0) || b >= rows.length) return false;
  return rows.slice(t, b + 1).every(row => row.slice(l, r + 1).every(pixel => pixel === color));
}

function plan(rows: NativeRows, local: State): Step | null {
  const { scene, at, seated, tried, blocked, avoid } = local;
  const goal = origin(scene.frame.bbox), side = scene.side;
  if (seated) {
    const toward = directions.find(d => same(shift(at, d, side), goal) && !tried.includes(d[0]));
    const direction = toward ?? directions.find(d => !tried.includes(d[0]) && visibleFloor(rows, footprint(shift(at, d, side), side), scene.floor.color));
    return direction ? { direction, at: shift(at, direction, side) } : null;
  }
  const queue: { at: NativePoint; first?: Step }[] = [{ at }];
  const seen = new Set([key(at)]);
  for (const item of queue) {
    const candidates = directions.map(direction => ({ direction, at: shift(item.at, direction, side) }));
    candidates.sort((a, b) => dist(a.at, goal) - dist(b.at, goal)
      || Math.abs(a.at[0] - goal[0]) - Math.abs(b.at[0] - goal[0]));
    for (const step of candidates) {
      const k = key(step.at);
      if (seen.has(k) || avoid.includes(k) || blockedRouteStep(blocked, item.at, step.direction[0])) continue;
      const first = item.first ?? step;
      if (!visibleFloor(rows, footprint(step.at, side), scene.floor.color)) continue;
      if (dist(step.at, goal) === side) return first;
      seen.add(k);
      queue.push({ at: step.at, first });
    }
  }
  return null;
}

function outcome(rows: NativeRows, proposal: Proposal) {
  const { local, step } = proposal;
  const { piece, frame, side } = local.scene;
  const parts = geometricComponents(rows);
  const actor = parts.find(p => p.color === piece.color && p.area === piece.area
    && width(p.bbox) === side && height(p.bbox) === side);
  if (actor) {
    const at = origin(actor.bbox);
    if (same(at, step.at)) return { kind: 'landing' as const, at };
    return { kind: same(at, local.at) ? 'blocked' as const : 'redirected' as const, at };
  }
  if (dist(step.at, origin(frame.bbox)) === side && parts.some(p => p.color === frame.color && p.area === frame.area + piece.area
    && p.bbox[0] === Math.min(frame.bbox[0], step.at[0]) && p.bbox[1] === Math.min(frame.bbox[1], step.at[1])
    && p.bbox[2] === Math.max(frame.bbox[2], step.at[0] + side - 1) && p.bbox[3] === Math.max(frame.bbox[3], step.at[1] + side - 1))) {
    return { kind: 'contact' as const, at: step.at };
  }
  return { kind: 'changed' as const, at: local.at };
}

export function createSicVerifyFrameContact(): NativeFamily<Proposal> {
  let state: State | null = null;
  let previousWin: { completed: number; side: number; ref: string } | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyFrameContactId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !directions.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? measure(rows);
      if (!scene || (prior?.count ?? 0) >= 36) return null;
      const start = origin(scene.piece.bbox), goal = origin(scene.frame.bbox);
      const learned = previousWin?.completed === observation.levels_completed && previousWin.side === scene.side ? previousWin : null;
      const roomRoute = prior?.roomRoute ?? (!prior && learned ? startRoomRoute(rows, { side: scene.side, start, goal }) : null);
      const local: State = prior ?? { epoch: observation.level_epoch, at: start, scene, refs: [], blocked: [], avoid: [], seated: false,
        tried: [], count: 0, ...(roomRoute ? { roomRoute } : {}) };
      const roomStep = roomRoute ? nextRoomStep(roomRoute, local.at) : null;
      const step = roomRoute ? roomStep : plan(rows, local);
      if (!step) return null;

      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(r => r !== ref),
        ...(roomRoute && learned && learned.ref !== ref ? [learned.ref] : [])];
      const mode = execution?.reasoningMode ?? 'exploration';
      const action = { action_ref: step.direction[0], data: {} };
      const facts = { eligibleProbe: !local.refs.length && !local.seated,
        routeSupported: !!local.refs.length && !local.seated, knownInteraction: local.seated, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = local.seated ? 'P02' : local.refs.length ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const parent = 'G_official_completion';
      const objective = { kind: roomRoute ? 'reach_frame_via_observed_compartments' : 'test_contact_with_compatible_frame', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(goal)], parentObjective: parent, satisfactionContract: 'official_progress_after_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = verifyFrameContactId + ':' + need.id;
      const roomSituations = {
        release_home: 'Test the nearby control and retain the visible map if the room goes dark',
        survey: 'Reach an untested control and check whether it reveals the distant room',
        release_survey: 'Release the used capacity after observing the distant floor and walls',
        open_access: 'Reach the remaining control and check whether it removes the barrier between the rooms',
        traverse: 'Cross the verified passage using floor observed when the rooms were lit',
      } as const;
      const situation = local.seated ? 'Test the direction into the frame after the piece and frame joined visually'
        : roomRoute ? roomSituations[roomRoute.phase] : strategy === 'P05' ? 'Check that the direction moves the piece by one tile'
          : 'Approach the frame through the visible surface and revise the route if a step is refused';
      return {
        status: 'proposed', kind: verifyFrameContactId, local, step, needId: need.id, ...(roomStep ? { roomStep } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: step.at }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: roomRoute ? 'Reach the exit with the two room maps retained' : 'Test contact with the receiving frame',
          situation, evidence, agenda: [], mode, triggerCard: decision.receipt.workflow, actor: footprint(local.at, scene.side),
          focus: roomStep ? footprint(roomStep.target, scene.side) : scene.frame.bbox, landing: footprint(step.at, scene.side),
          ...(roomRoute?.passage ? { passage: footprint(roomRoute.passage, scene.side) } : {}),
          ...(roomRoute?.capacity ? { capacity: roomRoute.capacity.box } : {}),
          ...(roomRoute ? { exit: scene.frame.bbox } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'frame_contact_step_bound' : 'frame_contact_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { kind: result, at } = outcome(second, proposal);
      if (proposal.local.roomRoute && proposal.roomStep) {
        const assessment = assessRoomStep(proposal.local.roomRoute, proposal.roomStep, first, second, proposal.local.at, at, result);
        return { matched: assessment !== null, seal_prefix: true, reason: assessment?.reason ?? 'room_route_prediction_contradicted' };
      }
      return { matched: result === 'landing' || result === 'contact', seal_prefix: true,
        reason: { landing: 'piece_at_predicted_tile', contact: 'piece_joined_frame_without_completion', blocked: 'piece_did_not_move',
          redirected: 'piece_redirected_to_another_tile', changed: 'piece_or_surface_changed' }[result] };
    },
    record(before, after, _action, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) previousWin = { completed: after.levels_completed,
        side: proposal.local.scene.side, ref: after.observation_ref };
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, step } = proposal, { kind: result, at } = outcome(second, proposal);
      if (local.roomRoute && proposal.roomStep) {
        const assessment = assessRoomStep(local.roomRoute, proposal.roomStep, first, second, local.at, at, result);
        state = { ...local, at, seated: result === 'contact', count: local.count + 1,
          roomRoute: assessment?.route ?? { ...local.roomRoute, stopped: true },
          refs: assessment ? [...local.refs.slice(-5), after.observation_ref] : local.refs };
        return { events: [] };
      }
      const moved = result === 'landing' || result === 'contact';
      state = { ...local, count: local.count + 1, at, seated: result === 'contact' || local.seated && result === 'changed',
        tried: local.seated && !moved ? [...local.tried, step.direction[0]] : [],
        avoid: local.seated && result === 'redirected' ? [...local.avoid, key(local.at)] : local.avoid,
        refs: moved ? [...local.refs.slice(-5), after.observation_ref] : local.refs,
        blocked: result === 'blocked' ? rememberRouteRefusal(local.blocked, local.at, step.direction[0], after.observation_ref) : local.blocked };
      if (result === 'changed' && !local.seated) state = { ...state, count: 36 };
      return { events: [] };
    },
    state: () => ({ state, previousWin }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      previousWin = structuredClone((value.previousWin as typeof previousWin | undefined) ?? null);
    },
  };
}
