/** Native common_joint_transport.py and joint_transport_geometry.py, pinned V6.
 * All roles remain the source's provisional hypotheses over public pixels.
 */
import { geometricComponents, v6Canonical, v6Digest } from './v6-native-observer.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeExecution, NativeFamily, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
type Point = [number, number];
export interface JointScene { scale: number; offset: Point; floor: Set<string>; boxes: Set<string>; targets: Set<string>; player: Point; wall_count: number; sprite_count: number }
export type JointState = [Point, Set<string>];
const key = (p: readonly number[]): string => p.join(',');
const point = (s: string): Point => s.split(',').map(Number) as Point;
const compare = (a: readonly number[], b: readonly number[]): number => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return a.length - b.length; };
const sorted = (s: Set<string>): Point[] => [...s].map(point).sort(compare);
const same = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
const subset = (a: Set<string>, b: Set<string>): boolean => [...a].every(p => b.has(p));
const stateKey = (s: JointState): string => JSON.stringify([s[0], sorted(s[1])]);
export const jointStatePair = (s: JointScene): [Point, Point[]] => [[...s.player], sorted(s.boxes)];
export const jointLayers = (s: JointScene): R => ({ scale: s.scale, offset: [...s.offset], floor: sorted(s.floor), targets: sorted(s.targets) });

export function measureJointTransport(rows: NativeRows, rememberedTargets: readonly Point[] = []): JointScene {
  const h = rows.length, w = rows[0]!.length, parts = geometricComponents(rows);
  const squares = parts.filter(p => p.rectangular && p.bbox[2] - p.bbox[0] === p.bbox[3] - p.bbox[1] && p.bbox[2] - p.bbox[0] + 1 >= 4 && p.bbox[2] - p.bbox[0] + 1 <= 12);
  const tally = new Map<number, number>();
  for (const p of squares) { const size = p.bbox[2] - p.bbox[0] + 1; tally.set(size, (tally.get(size) ?? 0) + 1); }
  if (!tally.size) throw new Error('No repeated macro-cell support');
  const scale = [...tally.keys()].sort((a, b) => tally.get(b)! * b * b - tally.get(a)! * a * a || b - a)[0]!;
  const offsets = new Map<string, number>();
  for (const p of squares.filter(p => p.bbox[2] - p.bbox[0] + 1 === scale)) { const k = key([p.bbox[0] % scale, p.bbox[1] % scale]); offsets.set(k, (offsets.get(k) ?? 0) + 1); }
  const [ox, oy] = point([...offsets].sort((a, b) => b[1] - a[1])[0]![0]);
  let hud = h;
  for (let y = 0; y < h; y++) if (y > Math.floor(h / 2) && new Set(rows[y]).size === 1 && rows[y]![0] !== rows[0]![0]) { hud = y; break; }
  let floor = new Set<string>(), boxes = new Set<string>(), targets = new Set(rememberedTargets.map(key));
  const walls = new Set<string>(), players: Point[] = [], sprites = new Map<string, string>();
  for (let y = oy; y <= hud - scale; y += scale) for (let x = ox; x <= w - scale; x += scale) {
    const cell: Point = [(x - ox) / scale, (y - oy) / scale], k = key(cell);
    const tile = rows.slice(y, y + scale).map(row => row.slice(x, x + scale)), perimeter = new Set<number>();
    for (let r = 0; r < scale; r++) for (let c = 0; c < scale; c++) if (r === 0 || r === scale - 1 || c === 0 || c === scale - 1) perimeter.add(tile[r]![c]!);
    if (perimeter.size !== 1) { walls.add(k); continue; }
    const substrate = [...perimeter][0]!, foreground: Point[] = [];
    for (let r = 0; r < scale; r++) for (let c = 0; c < scale; c++) if (tile[r]![c] !== substrate) foreground.push([c, r]);
    floor.add(k); if (!foreground.length) continue;
    if (tile[Math.floor(scale / 2)]![Math.floor(scale / 2)] === substrate) { targets.add(k); sprites.set(k, 'target'); continue; }
    const xs = foreground.map(p => p[0]), ys = foreground.map(p => p[1]);
    if (foreground.length === (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1)) { boxes.add(k); sprites.set(k, 'box'); }
    else { players.push(cell); sprites.set(k, 'controller'); }
  }
  if (players.length !== 1) throw new Error(`Controlled sprite ambiguity: ${players.length}`);
  const player = players[0]!, connected = new Set([key(player)]), todo = [player];
  for (let i = 0; i < todo.length; i++) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const q: Point = [todo[i]![0] + dx!, todo[i]![1] + dy!], k = key(q);
    if (floor.has(k) && !connected.has(k)) { connected.add(k); todo.push(q); }
  }
  floor = connected; boxes = new Set([...boxes].filter(p => floor.has(p))); targets = new Set([...targets].filter(p => floor.has(p)));
  if (!boxes.size || boxes.size !== targets.size) throw new Error(`Occupancy composition unresolved: ${boxes.size} bodies/${targets.size} loci`);
  return { scale, offset: [ox, oy], floor, boxes, targets, player, wall_count: walls.size, sprite_count: sprites.size };
}

export function jointSuccessor(state: JointState, direction: readonly number[], floor: Set<string>): [JointState, boolean] | null {
  const [player, boxes] = state, [dx, dy] = direction as Point, q: Point = [player[0] + dx, player[1] + dy];
  if (!floor.has(key(q))) return null;
  if (!boxes.has(key(q))) return [[q, boxes], false];
  const destination: Point = [q[0] + dx, q[1] + dy];
  if (!floor.has(key(destination)) || boxes.has(key(destination))) return null;
  const moved = new Set(boxes); moved.delete(key(q)); moved.add(key(destination)); return [[q, moved], true];
}

export function exactJointPath(scene: JointScene, directions: R, deadline: number, now: () => number = () => performance.now() / 1000): { path: [string, boolean, JointState][]; states: number; dead: number } {
  const { floor, targets } = scene, safe = new Set(targets), todo = [...targets].map(point);
  for (let i = 0; i < todo.length; i++) for (const [dx, dy] of Object.values(directions) as Point[]) {
    const p = todo[i]!, predecessor: Point = [p[0] - dx, p[1] - dy], support: Point = [p[0] - 2 * dx, p[1] - 2 * dy];
    if (floor.has(key(predecessor)) && floor.has(key(support)) && !safe.has(key(predecessor))) { safe.add(key(predecessor)); todo.push(predecessor); }
  }
  if (!subset(scene.boxes, safe)) throw new Error('Observed body on certified dead cell');
  const start: JointState = [scene.player, scene.boxes], queue = [start], parents = new Map<string, [JointState, string, boolean] | null>([[stateKey(start), null]]);
  let end: JointState | null = null;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    if (parents.size % 1024 === 0 && now() >= deadline) throw new Error('Level deadline during finite search');
    const state = queue[cursor]!;
    if (state[1].size === targets.size && subset(state[1], targets)) { end = state; break; }
    for (const [action, direction] of Object.entries(directions)) {
      const result = jointSuccessor(state, direction, floor); if (!result) continue;
      const [next, push] = result, k = stateKey(next);
      if (!subset(next[1], safe) || parents.has(k)) continue;
      parents.set(k, [state, action, push]); queue.push(next);
    }
  }
  if (!end) throw new Error('No feasible joint transport composition');
  const path: [string, boolean, JointState][] = [];
  let cursor: JointState = end;
  while (parents.get(stateKey(cursor)) !== null) { const parent: [JointState, string, boolean] = parents.get(stateKey(cursor))!; path.push([parent[1], parent[2], cursor]); cursor = parent[0]; }
  return { path: path.reverse(), states: parents.size, dead: floor.size - safe.size };
}

export class JointTransport implements NativeFamily<any> {
  readonly id = 'joint_transport';
  epoch: number | null = null; support: R | null = null; operators: R = {}; push_confirmed = false;
  refs: string[] = []; events: R[] = []; plan: R[] = []; authorizations: Record<string, string> = {}; method_origin: string[] = []; rejected: string[] = [];
  level_deadline: number | null = null;
  private now: () => number;
  readonly config: R;
  constructor(config: R, now: () => number = () => performance.now() / 1000) { this.config = config; this.now = now; }
  state(): R { return structuredClone({ epoch: this.epoch, support: this.support, operators: this.operators, push_confirmed: this.push_confirmed, refs: this.refs, events: this.events, plan: this.plan, authorizations: this.authorizations, method_origin: this.method_origin, rejected: this.rejected }); }
  restore(s: R): void { for (const k of Object.keys(this.state())) if (Object.hasOwn(s, k)) (this as any)[k] = structuredClone(s[k]); }
  enter(epoch: number): void { if (this.epoch !== epoch) { this.epoch = epoch; this.support = null; this.plan = []; this.authorizations = {}; this.rejected = []; } }
  scene(rows: NativeRows, support: R | null = null): JointScene | null { try { return measureJointTransport(rows, support?.targets ?? []); } catch { return null; } }
  async propose(obs: R, rows: NativeRows, inputs: readonly R[], remaining: number, execution?: NativeExecution): Promise<R | null> {
    if (execution?.deadlineMs !== undefined) { this.level_deadline = execution.deadlineMs / 1000; this.now = () => (execution.now?.() ?? performance.now()) / 1000; }
    if (remaining < 1 || !this.config.enabled || this.level_deadline === null || this.now() >= this.level_deadline) return null;
    this.enter(obs.level_epoch); const s = this.scene(rows, this.support);
    if (!s || s.floor.size > this.config.maximum_floor_cells || s.boxes.size > this.config.maximum_bodies) return null;
    const current = jointLayers(s), context = await v6Digest([current, jointStatePair(s)]);
    if (this.rejected.includes(context) || this.support !== null && !same(current, this.support)) return null;
    const available = new Set(inputs.filter(a => !a.data || Object.keys(a.data).length === 0).map(a => a.action_ref));
    const directions = Object.fromEntries(Object.entries(this.config.hypotheses.action_directions).filter(([a]) => available.has(a)));
    if (!Object.keys(directions).length) return null;
    if (!this.plan.length || !same(this.plan[0]!.before, jointStatePair(s))) {
      let result: ReturnType<typeof exactJointPath>; try { result = exactJointPath(s, directions, this.level_deadline, this.now); } catch { return null; }
      if (!result.path.length || result.path.length > remaining) return null;
      let before = jointStatePair(s); this.plan = [];
      for (const [a, push, pair] of result.path) { const after: [Point, Point[]] = [[...pair[0]], sorted(pair[1])]; this.plan.push({ action_ref: a, push, before, after }); before = after; }
    }
    if (this.plan.length > remaining) return null;
    this.support = current; const prefix: R[] = [];
    for (const step of this.plan) { if (!available.has(step.action_ref)) return null; prefix.push(step); if (!(step.action_ref in this.operators) || step.push && !this.push_confirmed || prefix.length >= Math.min(16, remaining)) break; }
    const actions = prefix.map(x => ({ action_ref: x.action_ref }));
    const steps = prefix.map((x, i) => ({ action: actions[i], expected_before: structuredClone(x.before), expected_after: structuredClone(x.after), unknown_method: !(x.action_ref in this.operators) || x.push && !this.push_confirmed, push: x.push }));
    const probe = steps.some(x => x.unknown_method), ref = 'C_joint_transport_' + (await v6Digest([obs.observation_ref, current, actions])).slice(0, 20);
    const evidence = [obs.observation_ref, ...this.refs.slice(-6)], why = 'Prepare the required support faces while preserving a complete joint occupation route under the explicitly provisional single-body contact model; validate the first unknown command or contact before continuing.';
    const binding = Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash'].map(k => [k, obs[k]]));
    const plan: R = { joint_transport: true, layers: current, binding, hypotheses: structuredClone(this.config.hypotheses), remaining_joint_cost: this.plan.length, recalled_method_refs: this.method_origin.slice(-8), role_status: this.config.role_status, role_hypotheses: structuredClone(this.config.roles), context_key: context };
    this.authorizations[ref] = await v6Digest([binding, actions, steps, plan]); plan.authorization_ref = ref;
    const facts = { current_joint_transport_geometry: true, complete_conditional_joint_route: true, first_unknown_input_seals: true };
    const composition = { id: ref, observed: false, role: 'conditional_joint_occupation', open_question: why, properties: { transported_count: s.boxes.size, target_count: s.targets.size, scope: current, hypotheses: structuredClone(this.config.hypotheses), method_recall_evidence: this.method_origin.slice(-8) }, relations: ['contributes_to:G_official_completion'] };
    return { status: 'proposed', kind: 'conditional_joint_transport', support_plan: plan, actions, steps, facts, binding, compositions: [composition], question: { reason: why, hypothesis_refs: evidence, unknowns: ['current command sign until tested', 'single body contact until tested', 'terminal role until official score'] }, route_refs: evidence,
      bundle_template: { operation_key: probe ? 'OP18' : 'OP28', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence, actions, outcome_guard: { path: ['value'], contains: probe ? ref : 'B0' } } };
  }
  async before(p: R, i: number, packet: R, obs: R): Promise<NativeBeforeResult> {
    const plan = p.support_plan, authplan = Object.fromEntries(Object.entries(plan).filter(([k]) => k !== 'authorization_ref'));
    let ok = i >= 0 && i < p.steps.length && this.authorizations[plan.authorization_ref] === await v6Digest([p.binding, p.actions, p.steps, authplan]);
    ok = ok && obs.level_epoch === p.binding.level_epoch && p.binding.level_epoch === packet.level && obs.levels_completed === p.binding.levels_completed && p.binding.levels_completed === packet.levels_completed && same(p.actions[i], p.steps[i].action) && packet.available_action_refs.includes(p.actions[i].action_ref) && (!p.actions[i].data || !Object.keys(p.actions[i].data).length);
    if (i === 0) ok = ok && obs.observation_ref === p.binding.observation_ref && packet.frame_hash === p.binding.frame_hash;
    const s = this.scene(packet.frame_rows, plan.layers); ok = ok && s !== null && same(jointLayers(s), plan.layers) && same(jointStatePair(s), p.steps[i].expected_before);
    return { admitted: !!ok, reason: ok ? 'current_joint_body_support_target_and_exact_input' : 'joint_transport_binding_or_preservation_changed' };
  }
  after(p: R, i: number, before: R, after: R, _first: NativeRows, second: NativeRows): NativeAfterResult & { geometry_matched?: boolean } {
    if (after.levels_completed > before.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary_distinct_from_last_geometric_prediction' };
    const s = this.scene(second, p.support_plan.layers), ok = s !== null && same(jointLayers(s), p.support_plan.layers) && same(jointStatePair(s), p.steps[i].expected_after), unknown = p.steps[i].unknown_method;
    return { matched: unknown ? null : !!ok, seal_prefix: unknown || !ok, geometry_matched: !!ok, reason: ok ? 'joint_effect_observed_for_method_reconciliation' : 'joint_effect_or_preservation_contradiction' };
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal?: R, index?: number | null): any {
    if (!proposal?.support_plan?.joint_transport) return { events: [] };
    const i = index ?? 0; if (!same(command, proposal.actions[i])) return { events: [] };
    const refs = [before.observation_ref, after.observation_ref]; this.refs = [...new Set([...this.refs, ...refs])];
    const post = this.after(proposal, i, before, after, first, second); let event: R;
    if (after.level_epoch !== before.level_epoch) { event = { status: 'official_boundary', evidence: refs, last_geometric_effect_unconfirmed: true, method_preserved: true }; this.enter(after.level_epoch); }
    else if (post.geometry_matched) { this.operators[command.action_ref] = structuredClone(this.config.hypotheses.action_directions[command.action_ref]); this.push_confirmed ||= proposal.steps[i].push; this.method_origin = [...new Set([...this.method_origin, ...refs])]; this.plan = this.plan.length && same(this.plan[0]!.before, proposal.steps[i].expected_before) ? this.plan.slice(1) : []; event = { status: 'observed_joint_translation', push: proposal.steps[i].push, evidence: refs, model_universal: false }; }
    else { this.rejected.push(proposal.support_plan.context_key); this.plan = []; event = { status: 'joint_model_contradiction', evidence: refs, preservation_not_discarded: true }; }
    this.events = [...this.events, event].slice(-32); return { events: [event] };
  }
}
