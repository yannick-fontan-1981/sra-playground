/**
 * Own ExposedReceptionAccess layer from pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. The common owner dispatches ancestor
 * planners/records and owns the ordered event journal. The V5 helper consumed
 * here is only its nominal _expand_push_chain, not the complete transaction.
 */
import { measureExposedReception, exposedReceptionProjection as projection,
  exposedReceptionPlanIdentity } from './v6-exposed-reception-observation.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export type ReceptionPoint = [number, number];
export type ReceptionSearchState = [ReceptionPoint, ReceptionPoint[]];
export type ReceptionPathStep = [ReceptionPoint, ReceptionSearchState];
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface ExposedReceptionState {
  reception_state: R | null; reception_controls: R; reception_models: R; reception_events: R[];
}
export interface ReceptionWorkLimits {
  maximumAssignmentChecks?: number;
  maximumAssignments?: number;
  maximumChainVisits?: number;
  maximumHeuristicChecks?: number;
  maximumBodies?: number;
  maximumCells?: number;
  deadlineMs?: number;
  now?: () => number;
}
export interface ReceptionPathResult {
  path: ReceptionPathStep[];
  nodes: number;
  visits: number;
  bounded: boolean;
  complete: boolean;
  stop_reason: string | null;
  assignment_checks: number;
  assignments: number;
  heuristic_checks: number;
}

const point = (p: readonly number[]): ReceptionPoint => [p[0]!, p[1]!];
const man = (a: readonly number[], b: readonly number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!);
const pointKey = (p: readonly number[]): string => `${p[0]},${p[1]}`;
const stateKey = (state: ReceptionSearchState): string => JSON.stringify(state);
const comparePoint = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const contains = (items: readonly unknown[], value: unknown): boolean => items.some(item => equal(item, value));
const own = (value: R, key: string): boolean => Object.hasOwn(value, key);

export function freshReceptionModels(): R { return { coupled: {}, attached: {}, color_edges: [], repulsion: {} }; }

class ReceptionWorkInterrupted extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}

/** Named native extension: finite work and physical-deadline checks surround the
 * source's otherwise unbounded permutation preparation and push-chain visits.
 * Hitting a bound never establishes impossibility or validates an incomplete
 * assignment domain. Unbounded-in-source ordinary cases keep the same result.
 */
class ReceptionWork {
  assignmentChecks = 0;
  assignments = 0;
  chainVisits = 0;
  heuristicChecks = 0;
  readonly maximumAssignmentChecks: number;
  readonly maximumAssignments: number;
  readonly maximumChainVisits: number;
  readonly maximumHeuristicChecks: number;
  readonly maximumBodies: number;
  readonly maximumCells: number;
  readonly deadlineMs: number;
  readonly now: () => number;
  constructor(limits: ReceptionWorkLimits = {}) {
    const finite = (value: number | undefined, fallback: number, name: string): number => {
      const result = value ?? fallback;
      if (!Number.isSafeInteger(result) || result < 0) throw new RangeError(`Invalid reception ${name}`);
      return result;
    };
    this.maximumAssignmentChecks = finite(limits.maximumAssignmentChecks, 100_000, 'assignment check bound');
    this.maximumAssignments = finite(limits.maximumAssignments, 10_000, 'assignment bound');
    this.maximumChainVisits = finite(limits.maximumChainVisits, 2_000_000, 'chain visit bound');
    this.maximumHeuristicChecks = finite(limits.maximumHeuristicChecks, 4_000_000, 'heuristic check bound');
    this.maximumBodies = finite(limits.maximumBodies, 128, 'body bound');
    this.maximumCells = finite(limits.maximumCells, 4096, 'cell bound');
    this.deadlineMs = limits.deadlineMs ?? Infinity;
    if (Number.isNaN(this.deadlineMs)) throw new RangeError('Invalid reception deadline');
    this.now = limits.now ?? (() => performance.now());
  }
  check(): void {
    if (this.now() >= this.deadlineMs) throw new ReceptionWorkInterrupted('reception_physical_deadline');
  }
  assignment(): void {
    this.check();
    if (this.assignmentChecks >= this.maximumAssignmentChecks) throw new ReceptionWorkInterrupted('reception_assignment_work_bound');
    this.assignmentChecks++;
  }
  admitAssignment(): void {
    if (this.assignments >= this.maximumAssignments) throw new ReceptionWorkInterrupted('reception_assignment_count_bound');
    this.assignments++;
  }
  heuristic(): void {
    this.check();
    if (this.heuristicChecks >= this.maximumHeuristicChecks) throw new ReceptionWorkInterrupted('reception_heuristic_work_bound');
    this.heuristicChecks++;
  }
  visit(): void {
    this.check();
    if (this.chainVisits >= this.maximumChainVisits) throw new ReceptionWorkInterrupted('reception_chain_work_bound');
    this.chainVisits++;
  }
}

export interface ReceptionVisits { n: number; visit?: (event: R) => void }
interface PushBody { ref: string; offsets: ReceptionPoint[]; admitted: Set<string>; pushable: boolean }
interface PushRequest { bodies: PushBody[]; depthBound: number; fixed: Set<string>; displacement: ReceptionPoint }

/** Literal V5 consumed kernel, with the caller's visit hook and source order. */
function expandPushChain(request: PushRequest, root: string, poses: Map<string, ReceptionPoint>, moved: Set<string>, visits: ReceptionVisits): [Set<string>, R[]] {
  const bodies = new Map(request.bodies.map(body => [body.ref, body]));
  if (moved.has(root)) return [new Set(), []];
  const occupied = new Map<string, Set<string>>();
  const visit = (event: R): void => { visits.visit?.(event); visits.n++; };
  for (const body of request.bodies) for (const [x, y] of body.offsets) {
    visit({ stage: 'current_push_occupancy', body_ref: body.ref });
    const pose = poses.get(body.ref)!, key = pointKey([pose[0] + x, pose[1] + y]);
    if (!occupied.has(key)) occupied.set(key, new Set());
    occupied.get(key)!.add(body.ref);
  }
  const pending = [root], chain = new Set([root]), witnesses: R[] = [];
  while (pending.length) {
    if (chain.size > request.depthBound) throw new ReceptionWorkInterrupted('reception_push_chain_depth_bound');
    const ref = pending.pop()!, body = bodies.get(ref)!;
    if (!body.pushable) witnesses.push({ body_ref: ref, code: 'BODY_NOT_PUSHABLE' });
    for (const [x, y] of body.offsets) {
      visit({ stage: 'seeded_chain_admission', body_ref: ref });
      const pose = poses.get(ref)!, p: ReceptionPoint = [pose[0] + x + request.displacement[0], pose[1] + y + request.displacement[1]], key = pointKey(p);
      if (!body.admitted.has(key) || request.fixed.has(key)) witnesses.push({ body_ref: ref, code: 'SUPPORT_OR_FIXED_BLOCK', cell: p });
      for (const peer of [...(occupied.get(key) ?? [])].sort(compareUnicode)) {
        if (peer === ref || chain.has(peer)) continue;
        if (moved.has(peer)) witnesses.push({ body_ref: ref, code: 'ALREADY_MOVED_SAME_CAUSE_OCCUPANT_BLOCKS', blocking_ref: peer, cell: p });
        else { chain.add(peer); pending.push(peer); }
      }
    }
  }
  return [chain, witnesses];
}

/** Nominal geometry, conditioned on the current acquired contact candidates. */
export function nominalReceptionStep(scene: R, actor: readonly number[], poses: readonly (readonly number[])[], delta: readonly number[], models: R,
  visits: ReceptionVisits = { n: 0 }): ReceptionSearchState | null {
  const colors = scene.bodies.map((body: R) => body.color), attached = new Set<number>(), pending: ReceptionPoint[] = [point(actor)];
  while (pending.length) {
    const p = pending.pop()!;
    for (let i = 0; i < poses.length; i++) if (!attached.has(i) && own(models.attached, String(colors[i])) && man(p, poses[i]!) === 1) {
      attached.add(i); pending.push(point(poses[i]!));
    }
  }
  const fixed = new Set<string>(scene.walls.map(pointKey)), admitted = new Set<string>();
  for (let y = 0; y < scene.size[1]; y++) for (let x = 0; x < scene.size[0]; x++) {
    const key = pointKey([x, y]); if (!fixed.has(key)) admitted.add(key);
  }
  const refs = new Map<string, number>(), offsets: ReceptionPoint[] = [[0, 0]];
  for (const i of [...attached].sort((a, b) => a - b)) offsets.push([poses[i]![0]! - actor[0]!, poses[i]![1]! - actor[1]!]);
  const bodies: PushBody[] = [{ ref: 'actor', offsets, admitted, pushable: true }];
  const positions = new Map<string, ReceptionPoint>([['actor', point(actor)]]);
  for (let i = 0; i < poses.length; i++) if (!attached.has(i)) {
    refs.set(String(i), i); bodies.push({ ref: String(i), offsets: [[0, 0]], admitted, pushable: true });
    positions.set(String(i), point(poses[i]!));
  }
  const request: PushRequest = { bodies, depthBound: bodies.length, fixed, displacement: point(delta) };
  const [local, refused] = expandPushChain(request, 'actor', positions, new Set(), visits);
  if (refused.length) return null;
  const moved = new Set<number>([...local].filter(ref => ref !== 'actor').map(ref => refs.get(ref)!));
  for (const i of attached) moved.add(i);
  const broadcast = new Set<number>([...moved].filter(i => own(models.coupled, String(colors[i]))).map(i => colors[i]));
  for (let i = 0; i < colors.length; i++) {
    if (moved.has(i) || !broadcast.has(colors[i]) || attached.has(i)) continue;
    const [chain, bad] = expandPushChain(request, String(i), positions, new Set(), visits);
    if (!bad.length && !chain.has('actor')) for (const ref of chain) moved.add(refs.get(ref)!);
  }
  const out = poses.map(point);
  for (const i of moved) out[i] = [poses[i]![0]! + delta[0]!, poses[i]![1]! + delta[1]!];
  if (new Set(out.map(pointKey)).size !== out.length) return null;
  return [[actor[0]! + delta[0]!, actor[1]! + delta[1]!], out];
}

interface HeapItem { priority: number; cost: number; state: ReceptionSearchState; key: string }
function compareItem(a: HeapItem, b: HeapItem): number {
  let order = a.priority - b.priority || a.cost - b.cost || comparePoint(a.state[0], b.state[0]);
  if (order) return order;
  for (let i = 0; i < Math.min(a.state[1].length, b.state[1].length); i++) {
    order = comparePoint(a.state[1][i]!, b.state[1][i]!); if (order) return order;
  }
  return a.state[1].length - b.state[1].length;
}
class ReceptionHeap {
  private data: HeapItem[] = [];
  get length(): number { return this.data.length; }
  push(item: HeapItem): void {
    let i = this.data.length; this.data.push(item);
    while (i) { const parent = (i - 1) >> 1; if (compareItem(this.data[parent]!, item) <= 0) break; this.data[i] = this.data[parent]!; i = parent; }
    this.data[i] = item;
  }
  pop(): HeapItem {
    const first = this.data[0]!, last = this.data.pop()!;
    if (this.data.length) {
      let i = 0;
      while (i * 2 + 1 < this.data.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.data.length && compareItem(this.data[child + 1]!, this.data[child]!) < 0) child++;
        if (compareItem(last, this.data[child]!) <= 0) break;
        this.data[i] = this.data[child]!; i = child;
      }
      this.data[i] = last;
    }
    return first;
  }
}

export function pathToReceptions(scene: R, models: R, maxNodes = 8000, limits: ReceptionWorkLimits = {}): ReceptionPathResult {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 0) throw new RangeError('Invalid reception search node bound');
  const work = new ReceptionWork(limits), result: ReceptionPathResult = { path: [], nodes: 0, visits: 0, bounded: false,
    complete: false, stop_reason: null, assignment_checks: 0, assignments: 0, heuristic_checks: 0 };
  const sync = (): ReceptionPathResult => { result.visits = work.chainVisits; result.assignment_checks = work.assignmentChecks; result.assignments = work.assignments; result.heuristic_checks = work.heuristicChecks; return result; };
  const colors = scene.bodies.map((body: R) => body.color), targets: ReceptionPoint[] = scene.slots.map((slot: R) => point(slot.pos));
  let best: ReceptionSearchState | null = null, start: ReceptionSearchState | null = null;
  const came = new Map<string, { previous: ReceptionSearchState; direction: ReceptionPoint }>();
  const recover = (state: ReceptionSearchState | null): ReceptionPathStep[] => {
    const path: ReceptionPathStep[] = [];
    while (state && start && stateKey(state) !== stateKey(start)) {
      const previous = came.get(stateKey(state));
      if (!previous) throw new Error('Reception path lost its acquired search predecessor');
      path.push([previous.direction, state]); state = previous.previous;
    }
    return path.reverse();
  };
  try {
    work.check();
    if (colors.length > work.maximumBodies || targets.length > work.maximumBodies) throw new ReceptionWorkInterrupted('reception_body_domain_bound');
    if (!Number.isSafeInteger(scene.size[0]) || !Number.isSafeInteger(scene.size[1]) || scene.size[0] < 0 || scene.size[1] < 0
      || scene.size[0] * scene.size[1] > work.maximumCells) throw new ReceptionWorkInterrupted('reception_cell_domain_bound');
    const pairs: Set<number>[] = colors.map((color: number) => new Set([color]));
    for (const allowed of pairs) {
      let change = true;
      while (change) {
        work.check(); const old = allowed.size;
        for (const [a, b] of models.color_edges) if (allowed.has(a)) allowed.add(b);
        change = allowed.size !== old;
      }
    }
    const domains: number[][] = pairs.map(allowed => scene.slots.flatMap((slot: R, j: number) => allowed.has(slot.color) ? [j] : []));
    if (domains.some(domain => !domain.length)) { result.complete = true; return sync(); }
    const assignments: number[][] = [], chosen: number[] = [], used = new Set<number>();
    const enumerate = (): void => {
      work.assignment();
      if (chosen.length === targets.length) { work.admitAssignment(); assignments.push([...chosen]); return; }
      for (let j = 0; j < targets.length; j++) if (!used.has(j) && (chosen.length >= domains.length || domains[chosen.length]!.includes(j))) {
        used.add(j); chosen.push(j); enumerate(); chosen.pop(); used.delete(j);
      }
    };
    enumerate();
    if (!assignments.length) { result.complete = true; return sync(); }
    const goal = (poses: ReceptionPoint[]): boolean => new Set(poses.map(pointKey)).size === poses.length
      && poses.every((p, i) => domains[i]!.some(j => equal(p, targets[j])));
    const lower = (poses: ReceptionPoint[]): number => {
      let minimum = Infinity;
      for (const assignment of assignments) {
        work.heuristic(); let sum = 0;
        for (let i = 0; i < Math.min(poses.length, assignment.length); i++) sum += man(poses[i]!, targets[assignment[i]!]!);
        minimum = Math.min(minimum, sum);
      }
      return minimum;
    };
    const rank = (poses: ReceptionPoint[]): [number, number] => [poses.reduce((n, p, i) => n + (domains[i]!.some(j => equal(p, targets[j])) ? 0 : 1), 0), lower(poses)];
    start = [point(scene.actor), scene.bodies.map((body: R) => point(body.pos))];
    best = start; let bestRank = rank(start[1]);
    const queue = new ReceptionHeap(), cost = new Map([[stateKey(start), 0]]);
    queue.push({ priority: lower(start[1]), cost: 0, state: start, key: stateKey(start) });
    const visits: ReceptionVisits = { n: 0, visit: () => work.visit() };
    const directions: ReceptionPoint[] = [[1, 0], [0, -1], [0, 1], [-1, 0]];
    while (queue.length && result.nodes < maxNodes) {
      work.check(); const item = queue.pop(), state = item.state, n = item.cost;
      if (cost.get(item.key) !== n) continue;
      result.nodes++;
      const currentRank = rank(state[1]);
      if (comparePoint(currentRank, bestRank) < 0) { best = state; bestRank = currentRank; }
      if (goal(state[1])) { result.path = recover(state); result.complete = true; return sync(); }
      for (const direction of directions) {
        const next = nominalReceptionStep(scene, state[0], state[1], direction, models, visits);
        if (next === null) continue;
        const key = stateKey(next);
        if (n + 1 >= (cost.get(key) ?? 1e9)) continue;
        cost.set(key, n + 1); came.set(key, { previous: state, direction });
        queue.push({ priority: n + 1 + lower(next[1]), cost: n + 1, state: next, key });
      }
    }
    result.path = recover(best);
    result.complete = queue.length === 0;
    result.bounded = !result.complete;
    result.stop_reason = result.bounded ? 'reception_search_node_bound' : null;
  } catch (error) {
    if (!(error instanceof ReceptionWorkInterrupted)) throw error;
    result.bounded = true; result.stop_reason = error.reason;
    // Assignment work cannot leave a partially admitted matching domain. Only
    // a state already extracted from the complete-domain search can contribute.
    result.path = recover(best);
  }
  return sync();
}

export function exposedReceptionBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  if (!own(proposal, 'exposed_reception_plan')) throw new TypeError('Exposed reception admission requires exposed_reception_plan');
  const plan = proposal.exposed_reception_plan, scene = measureExposedReception(rows);
  let admitted = proposal.proposal_id === 'exposed-reception:' + exposedReceptionPlanIdentity(plan)
    && equal(proposal.actions, plan.commands) && equal(plan.commands, proposal.bundle_template.actions)
    && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && Number.isSafeInteger(index) && index >= 0 && index < proposal.actions.length
    && meta.available.includes(proposal.actions[index].action_ref) && scene !== null && scene.layout === plan.scene.layout;
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else admitted = admitted && index <= plan.predicted.length && equal(projection(scene!), plan.predicted[index - 1])
    && equal(scene!.orientation, plan.scene.orientation);
  return { admitted: Boolean(admitted), reason: admitted ? 'current_reception_bound' : 'reception_binding_changed' };
}

export function exposedReceptionAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.exposed_reception_plan;
  if (!truth(plan)) throw new TypeError('Exposed reception outcome requires exposed_reception_plan');
  const scene = measureExposedReception(later), boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]);
  const matched = scene && !boundary && index < plan.predicted.length
    ? scene.layout === plan.scene.layout && equal(projection(scene), plan.predicted[index]) : null;
  return { matched, seal_prefix: boundary || matched !== true,
    reason: matched ? 'expected_conditional_reception_step' : 'changed_layout_or_unknown_effect' };
}

export class ExposedReceptionMemory {
  private receptionState: R | null = null;
  private receptionControls: R = {};
  private receptionModels: R = freshReceptionModels();
  private receptionEvents: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.receptionEvents.length; }
  currentState(): ExposedReceptionState {
    return structuredClone({ reception_state: this.receptionState, reception_controls: this.receptionControls,
      reception_models: this.receptionModels, reception_events: this.receptionEvents });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.receptionState, this.receptionControls, this.receptionModels, this.receptionEvents]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_exposed_reception') throw new TypeError(`Outside exposed reception layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!own(owned, 'state') || !own(owned, 'controls') || !own(owned, 'models')) throw new TypeError('Exposed reception event lacks its state, controls or models');
    this.version++; this.receptionState = owned.state; this.receptionControls = owned.controls; this.receptionModels = owned.models; this.receptionEvents.push(owned);
  }

  /** Null delegates to the inherited planner; explicit source refusals block it. */
  propose(observation: R, rows: NativeRows, _inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.exposed_reception_question;
    if (!truth(cfg)) return null;
    const scene = measureExposedReception(rows);
    if (!scene) return null;
    const memory: R = this.receptionState && this.receptionState.epoch === observation.level_epoch && this.receptionState.layout === scene.layout
      ? structuredClone(this.receptionState) : { epoch: observation.level_epoch, layout: scene.layout, evidence: [observation.observation_ref], probed: [], dial_tried: [] };
    const controls = structuredClone(this.receptionControls), models = structuredClone(this.receptionModels);
    const actions: R[] = [], predicted: R[] = [], available: string[] = observation.available_action_refs;
    let kind = 'access', why = cfg.access, nodes = 0, visits = 0, interrupted: ReceptionPathResult | null = null;
    const chooseDial = (body: R): R | undefined => {
      const delta = [body.pos[0] - scene.actor[0], body.pos[1] - scene.actor[1]];
      const score = (control: R): number => -(control.vector[0] * delta[0]! + control.vector[1] * delta[1]!) / Math.max(.1, Math.hypot(...control.vector));
      return [...scene.dial].sort((a: R, b: R) => score(a) - score(b)).find((control: R) => !control.active && !contains(memory.dial_tried, [scene.actor, body.pos, control.point]));
    };
    const expose = (chosen: R): void => { actions.push({ action_ref: 'ACTION6', data: { x: chosen.point[0], y: chosen.point[1] } }); kind = 'exposure_question'; why = cfg.expose; };
    const mismatched = scene.bodies.filter((body: R) => scene.slots.some((slot: R) => equal(slot.pos, body.pos) && slot.color !== body.color));
    if (mismatched.length && available.includes('ACTION6')) { const chosen = chooseDial(mismatched[0]); if (chosen) expose(chosen); }
    if (!actions.length) {
      const moving = scene.bodies.filter((body: R) => own(models.repulsion, String(body.color)) && scene.slots.some((slot: R) => slot.color === body.color && !equal(slot.pos, body.pos)));
      if (moving.length && available.includes('ACTION5')) { actions.push({ action_ref: 'ACTION5' }); kind = 'maintain_field'; why = cfg.maintain; }
    }
    if (!actions.length) {
      const adjacent = scene.bodies.filter((body: R) => man(body.pos, scene.actor) === 1 && !own(models.attached, String(body.color)));
      for (const body of adjacent) {
        const targets = scene.slots.filter((slot: R) => slot.color === body.color && !equal(slot.pos, body.pos));
        if (!targets.length) continue;
        const target = [...targets].sort((a: R, b: R) => man(a.pos, body.pos) - man(b.pos, body.pos))[0]!;
        const delta = [Math.sign(target.pos[0] - body.pos[0]), Math.sign(target.pos[1] - body.pos[1])];
        const action = Object.entries(controls).find(([ref, value]: [string, any]) => equal(value.delta, delta) && available.includes(ref))?.[0];
        if (action && Math.abs(delta[0]!) + Math.abs(delta[1]!) === 1
          && !equal([scene.actor[0] + delta[0]!, scene.actor[1] + delta[1]!], body.pos) && !contains(memory.probed, [scene.actor, action])) {
          actions.push({ action_ref: action }); kind = 'contact_transport_question'; why = cfg.contact; break;
        }
      }
    }
    if (!actions.length) {
      const limits: ReceptionWorkLimits = { ...(config.native_reception_work_budget ?? {}),
        ...(typeof config.level_deadline === 'number' ? { deadlineMs: config.level_deadline } : {}),
        ...(typeof config.native_reception_now === 'function' ? { now: config.native_reception_now } : {}) };
      const search = pathToReceptions(scene, models, cfg.max_search_nodes, limits);
      nodes = search.nodes; visits = search.visits;
      if (search.bounded) interrupted = search;
      if ((nodes >= cfg.max_search_nodes || search.bounded) && search.path.length) why = cfg.partial;
      for (const [delta, state] of search.path.slice(0, Math.min(16, limit))) {
        const action = Object.entries(controls).find(([ref, value]: [string, any]) => equal(value.delta, delta) && available.includes(ref))?.[0];
        if (action === undefined) break;
        actions.push({ action_ref: action });
        predicted.push({ actor: state[0], bodies: state[1].map((pos, i) => [pos, scene.bodies[i].color])
          .sort((a, b) => comparePoint(a[0], b[0]) || a[1] - b[1]) });
      }
      if (!actions.length && search.bounded && search.stop_reason !== 'reception_search_node_bound') return {
        status: 'unknown', block_unrelated_probe: true, reason: 'reception_computation_incomplete',
        native_reception_work_budget: { complete: false, reason: search.stop_reason, nodes, visits,
          assignment_checks: search.assignment_checks, assignments: search.assignments, heuristic_checks: search.heuristic_checks } };
      if (!actions.length) {
        const untried = cfg.probe_order.filter((ref: string) => available.includes(ref) && !own(controls, ref) && !contains(memory.probed, [scene.actor, ref]));
        if (untried.length) { actions.push({ action_ref: untried[0] }); kind = 'control_question'; why = cfg.control; }
        else if (available.includes('ACTION6')) {
          const targets = scene.bodies.filter((body: R) => scene.slots.some((slot: R) => slot.color !== body.color));
          if (targets.length) { const chosen = chooseDial(targets[0]); if (chosen) expose(chosen); }
        }
      }
      if (!actions.length) return { status: 'unknown', block_unrelated_probe: true, reason: 'reception_access_or_state_model_unresolved' };
    }
    const plan: R = structuredClone({ scene, state: memory, commands: actions, predicted, epoch: observation.level_epoch,
      score: observation.levels_completed, observation_ref: observation.observation_ref, frame_digest: identity(rows), kind, why,
      controls, models, search_nodes: nodes, v5_chain_visits: visits,
      ...(interrupted && interrupted.stop_reason !== 'reception_search_node_bound' ? { native_reception_work_budget: {
        complete: false, reason: interrupted.stop_reason, assignment_checks: interrupted.assignment_checks, assignments: interrupted.assignments, heuristic_checks: interrupted.heuristic_checks } } : {}) });
    const ref = 'exposed-reception:' + exposedReceptionPlanIdentity(plan), evidence = memory.evidence.slice(-16);
    return { status: 'proposed', kind: 'exposed_reception', proposal_id: ref, exposed_reception_plan: plan, actions,
      steps: actions.map(action => ({ action, expected_after: null })), facts: { current_reception_geometry: true, optical_law_unknown: true,
        v5_nominal_chain_only: true, conditional_contact_model: true },
      compositions: [{ id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', purpose: why,
        evidence, preconditions: {}, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** Called after ancestor acquisition exactly once for its selected proposal. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, _index: number): R[] {
    const plan = proposal.exposed_reception_plan;
    if (!truth(plan)) return [];
    const a = measureExposedReception(rows), b = measureExposedReception(later);
    if (!a || !b) return [];
    const controls = structuredClone(this.receptionControls), models = structuredClone(this.receptionModels);
    const memory: R = this.receptionState && this.receptionState.layout === plan.state.layout ? structuredClone(this.receptionState) : structuredClone(plan.state);
    const detail: R = { command, before: before.observation_ref, after: after.observation_ref };
    if (before.level_epoch !== after.level_epoch || a.layout !== b.layout) detail.layout_transition_unknown = true;
    else {
      const delta = [b.actor[0] - a.actor[0], b.actor[1] - a.actor[1]];
      memory.probed.push([a.actor, command.action_ref]); detail.actor_delta = delta;
      if (!truth(command.data) && Math.abs(delta[0]!) + Math.abs(delta[1]!) === 1) {
        const old = controls[command.action_ref];
        if (truth(old) && !equal(old.delta, delta)) detail.control_conflict = { old: old.delta, new: delta };
        else controls[command.action_ref] = { delta, evidence: [before.observation_ref, after.observation_ref] };
      }
      if (a.bodies.length === b.bodies.length && a.bodies.length <= 7) {
        const used = new Set<number>(), order: number[] = [];
        let best = Infinity, matches = 0, match: number[] = [];
        const enumerate = (score: number): void => {
          if (order.length === b.bodies.length) {
            if (score < best) { best = score; matches = 1; match = [...order]; }
            else if (score === best) matches++;
            return;
          }
          for (let j = 0; j < b.bodies.length; j++) if (!used.has(j)) {
            const next = score + man(a.bodies[order.length].pos, b.bodies[j].pos);
            // Future distances cannot reduce this score; ties still enumerate.
            if (next > best) continue;
            used.add(j); order.push(j); enumerate(next); order.pop(); used.delete(j);
          }
        };
        enumerate(0);
        if (matches === 1) {
          const changes: R[] = [];
          for (let i = 0; i < a.bodies.length; i++) {
            const old = a.bodies[i], next = b.bodies[match[i]!], displacement = [next.pos[0] - old.pos[0], next.pos[1] - old.pos[1]];
            if (old.color !== next.color) { const edge = [old.color, next.color]; if (!contains(models.color_edges, edge)) models.color_edges.push(edge); }
            if (!equal(displacement, [0, 0])) changes.push({ before: old, after: next, delta: displacement });
            if (equal(displacement, delta) && !equal(displacement, [0, 0]) && man(old.pos, a.actor) === 1
              && !equal([a.actor[0] + delta[0]!, a.actor[1] + delta[1]!], old.pos)) models.attached[String(old.color)] = {
                evidence: [before.observation_ref, after.observation_ref], status: 'side_contact_co_motion_candidate' };
            if (truth(command.data) && !equal(displacement, [0, 0]) && equal(delta, [0, 0])) models.repulsion[String(next.color)] = {
              evidence: [before.observation_ref, after.observation_ref], delta: displacement, status: 'orientation_associated_motion_candidate' };
          }
          for (const color of new Set(a.bodies.map((body: R) => body.color))) {
            const group = changes.filter(change => change.before.color === color);
            if (group.length >= 2 && group.every(change => equal(change.delta, delta)) && !equal(delta, [0, 0])) models.coupled[String(color)] = {
              evidence: [before.observation_ref, after.observation_ref], status: 'observed_same_mode_co_motion_candidate' };
          }
          detail.body_changes = changes;
        } else detail.body_correspondence_ambiguous = true;
      }
      if (truth(command.data)) {
        const p = [command.data.x, command.data.y];
        for (const body of a.bodies) memory.dial_tried.push([a.actor, body.pos, p]);
      }
    }
    memory.evidence.push(before.observation_ref, after.observation_ref);
    const event = structuredClone({ kind: 'observed_exposed_reception', state: memory, controls, models, detail });
    this.applyEvent(event); return [event];
  }
}

export function proposeExposedReception(memory: ExposedReceptionMemory, observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}
