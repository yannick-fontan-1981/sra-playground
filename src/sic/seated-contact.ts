import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const seatedContactId = 'sic_seated_contact';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Direction = typeof directions[number];
type Part = ReturnType<typeof geometricComponents>[number];
type Scene = { piece: Part; frame: Part; floor: Part; side: number };
type State = { epoch: number; at: NativePoint; scene: Scene; refs: string[]; blocked: string[]; avoid: string[]; seated: boolean; tried: string[]; count: number };
type Step = { direction: Direction; at: NativePoint };
type Proposal = NativeProposal & { local: State; step: Step; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const dist = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const footprint = ([x, y]: NativePoint, n: number): NativeBox => [x, y, x + n - 1, y + n - 1];
const shift = ([x, y]: NativePoint, [, dx, dy]: Direction, n: number): NativePoint => [x + dx * n, y + dy * n];

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
      if (seen.has(k) || avoid.includes(k) || blocked.includes(key(item.at) + '/' + step.direction[0])) continue;
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

export function createSicSeatedContact(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: seatedContactId,
    propose(observation, rows, _inputs, remaining, execution): Proposal | null {
      if (remaining < 1 || !directions.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? measure(rows);
      if (!scene || (prior?.count ?? 0) >= 36) return null;
      const local = prior ?? { epoch: observation.level_epoch, at: origin(scene.piece.bbox), scene, refs: [], blocked: [], avoid: [], seated: false, tried: [], count: 0 };
      const step = plan(rows, local);
      if (!step) return null;

      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(r => r !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const action = { action_ref: step.direction[0], data: {} };
      const offer = { input: action.action_ref, expected: step.at, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({
        mode, evidence, probe: local.refs.length ? null : offer, access: local.refs.length && !local.seated ? offer : null,
        interaction: local.seated ? offer : null,
      });
      if (!selected) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'test_contact_with_compatible_frame', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(origin(scene.frame.bbox))], parentObjective: parent, satisfactionContract: 'official_progress_after_contact' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = seatedContactId + ':' + need.id;
      const situation = local.seated ? 'Test the direction into the frame after the piece and frame joined visually'
        : selected.id === 'P05' ? 'Check that the direction moves the piece by one tile'
          : 'Approach the frame through the visible surface and revise the route if a step is refused';
      return {
        status: 'proposed', kind: seatedContactId, local, step, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: step.at }],
        sicSituationCard: { strategy: selected.id, need: 'Test contact with the receiving frame', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: footprint(local.at, scene.side), focus: scene.frame.bbox, landing: footprint(step.at, scene.side) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'frame_contact_step_bound' : 'frame_contact_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = outcome(second, proposal).kind;
      return { matched: result === 'landing' || result === 'contact', seal_prefix: true,
        reason: { landing: 'piece_at_predicted_tile', contact: 'piece_joined_frame_without_completion', blocked: 'piece_did_not_move',
          redirected: 'piece_redirected_to_another_tile', changed: 'piece_or_surface_changed' }[result] };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, step } = proposal, { kind: result, at } = outcome(second, proposal);
      const moved = result === 'landing' || result === 'contact';
      state = { ...local, count: local.count + 1, at, seated: result === 'contact' || local.seated && result === 'changed',
        tried: local.seated && !moved ? [...local.tried, step.direction[0]] : [],
        avoid: local.seated && result === 'redirected' ? [...local.avoid, key(local.at)] : local.avoid,
        refs: moved ? [...local.refs.slice(-5), after.observation_ref] : local.refs,
        blocked: result === 'blocked' ? [...local.blocked, key(local.at) + '/' + step.direction[0]] : local.blocked };
      if (result === 'changed' && !local.seated) state = { ...state, count: 36 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
