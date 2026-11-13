/** Native V6 common_invited_reduction.py. Selection, capture and goals remain
 * witnessed hypotheses; the finite geometry never releases a game command.
 */
import { detectV5Components, ObservedInputDomain, rowsDigest, v6Canonical, v6Digest } from './v6-native-observer.ts';
import { measureRayCaptureDomain } from './v6-ray-capture-domain.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeFamily, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>; type P = [number, number]; type Body = [number, string];
export interface ReductionScene { pitch: number; origin: P; cells: Map<string, number[][]>; bodies: Map<string, Body>; templates: R; mask: P[] }
const key = (p: unknown): string => JSON.stringify(p);
const pointOf = (k: string): P => JSON.parse(k);
const tupleRef = (p: P): string => `(${p[0]}, ${p[1]})`;
const compare = (a: readonly any[], b: readonly any[]): number => { for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = Array.isArray(a[i]) ? compare(a[i], b[i]) : typeof a[i] === 'number' ? a[i] - b[i] : a[i] < b[i] ? -1 : a[i] > b[i] ? 1 : 0; if (c) return c; } return a.length - b.length; };
const same = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
function count<T>(values: readonly T[]): Map<T, number> { const out = new Map<T, number>(); for (const v of values) out.set(v, (out.get(v) ?? 0) + 1); return out; }
function common<T>(values: readonly T[]): [T, number] { return [...count(values)].sort((a, b) => b[1] - a[1])[0]!; }
export const reductionPacked = (bodies: Map<string, Body>): any[][] => [...bodies].map(([p, v]) => [...pointOf(p), ...v]).sort(compare);
export const reductionPoint = (s: ReductionScene, p: P): P => [s.origin[0] + p[0] * s.pitch + Math.floor(s.pitch / 2), s.origin[1] + p[1] * s.pitch + Math.floor(s.pitch / 2)];
const click = (s: ReductionScene, p: P): R => { const [x, y] = reductionPoint(s, p); return { action_ref: 'ACTION6', data: { x, y } }; };
export function reductionGeometry(s: ReductionScene): R { return { pitch: s.pitch, origin: [...s.origin], mask: structuredClone(s.mask), cells: [...s.cells.keys()].map(pointOf), anchors: [...s.cells].filter(([, cut]) => new Set(cut.flat()).size === 1).map(([p, cut]) => [pointOf(p), cut[0]![0]]) }; }
const cell = (s: ReductionScene, command: R): string | null => { const p = key([Math.floor(((command.data?.x ?? -999) - s.origin[0]) / s.pitch), Math.floor(((command.data?.y ?? -999) - s.origin[1]) / s.pitch)]); return s.cells.has(p) ? p : null; };
async function cellBody(cut: number[][], pitch: number, mask: readonly P[]): Promise<Body | null> {
  const values = mask.map(([r, c]) => cut[1 + r]![1 + c]!), [value, amount] = common(values);
  const corners = [[0, 0], [0, pitch - 3], [pitch - 3, 0], [pitch - 3, pitch - 3]].map(([r, c]) => cut[1 + r!]![1 + c!]);
  return amount >= mask.length * .6 && corners.every(z => z !== value) ? [value, (await v6Digest(values.map(z => Number(z !== value)))).slice(0, 12)] : null;
}
export async function measureReductionScene(rows: NativeRows): Promise<ReductionScene | null> {
  const cs = (await detectV5Components(rows)).components, squares = cs.filter(c => c.area >= 9 && c.bbox.width === c.bbox.height && c.area === c.bbox.width ** 2), groups = count(squares.map(c => key([c.value, c.bbox.width]))), options: ReductionScene[] = [];
  for (const [group, n] of groups) {
    if (n < 4) continue;
    const [value, pitch] = pointOf(group), ss = squares.filter(c => c.value === value && c.bbox.width === pitch);
    let x0 = Math.min(...ss.map(c => c.bbox.left)), y0 = Math.min(...ss.map(c => c.bbox.top)); const x1 = Math.max(...ss.map(c => c.bbox.right)), y1 = Math.max(...ss.map(c => c.bbox.bottom));
    if (ss.some(c => (c.bbox.left - x0) % pitch || (c.bbox.top - y0) % pitch)) continue;
    const token = cs.filter(c => c.bbox.width === c.bbox.height && c.bbox.width === pitch - 2 && c.area > c.bbox.width ** 2 / 2 && c.area < c.bbox.width ** 2 && x0 - pitch < c.bbox.left && c.bbox.left <= x1 && y0 - pitch < c.bbox.top && c.bbox.top <= y1);
    if (token.length < 2) continue;
    const [rawMask, amount] = common(token.map(c => key(c.pixels.map(([r, col]) => [r - c.bbox.top, col - c.bbox.left]).sort(compare)))); if (amount < 2) continue;
    const mask = JSON.parse(rawMask) as P[], tx = Math.min(...token.map(c => c.bbox.left - 1)), ty = Math.min(...token.map(c => c.bbox.top - 1));
    if (tx < x0 && x0 - tx === pitch) x0 = tx; if (ty < y0 && y0 - ty === pitch) y0 = ty;
    const cells = new Map<string, number[][]>(), bodies = new Map<string, Body>(), templates: R = {};
    for (let y = y0; y <= y1; y += pitch) for (let x = x0; x <= x1; x += pitch) {
      if (x + pitch > rows[0]!.length || y + pitch > rows.length) continue;
      const p = key([(x - x0) / pitch, (y - y0) / pitch]), cut = rows.slice(y, y + pitch).map(row => [...row.slice(x, x + pitch)]); cells.set(p, cut);
      const body = await cellBody(cut, pitch, mask); if (body) { bodies.set(p, body); templates[body[1]] = mask.map(([r, c]) => Number(cut[1 + r]![1 + c] !== body[0])); }
    }
    if (bodies.size >= 2) options.push({ pitch, origin: [x0, y0], cells, bodies, templates, mask });
  }
  return options.length === 1 ? options[0]! : null;
}
export async function retainedReductionScene(rows: NativeRows, hint: R | null): Promise<ReductionScene | null> {
  if (!hint) return measureReductionScene(rows);
  const { pitch, mask } = hint, [x0, y0] = hint.origin, cells = new Map<string, number[][]>(), bodies = new Map<string, Body>(), templates: R = {};
  for (const p of hint.cells) {
    const x = x0 + p[0] * pitch, y = y0 + p[1] * pitch; if (x < 0 || y < 0 || x + pitch > rows[0]!.length || y + pitch > rows.length) return null;
    const cut = rows.slice(y, y + pitch).map(row => [...row.slice(x, x + pitch)]); cells.set(key(p), cut);
    const body = await cellBody(cut, pitch, mask); if (body) { bodies.set(key(p), body); templates[body[1]] = mask.map(([r, c]: P) => Number(cut[1 + r]![1 + c] !== body[0])); }
  }
  if (!hint.anchors.length || hint.anchors.some(([p, v]: any[]) => cells.get(key(p))!.some(row => row.some(z => z !== v)))) return null;
  return { pitch, origin: [x0, y0], cells, bodies, mask, templates };
}

export class InvitedReduction implements NativeFamily<any> {
  readonly id = 'invited_reduction'; epoch: number | null = null; focus: P | null = null; invites: P[] = []; relations: Record<string, Set<string>> = {}; rays: Record<string, P> = {};
  refs: string[] = []; events: R[] = []; goal = false; tried = new Set<string>(); selected = false; base_values = new Set<number>(); control_marks: [number, number, number][] = []; hint: R | null = null; invitation_value: number | null = null;
  readonly config: R;
  constructor(config: R) { this.config = config; }
  state(): R { return structuredClone({ schema: 'invited_reduction_state.v1', epoch: this.epoch, focus: this.focus, invites: this.invites, relations: Object.fromEntries(Object.entries(this.relations).map(([k, v]) => [k, [...v].map(x => JSON.parse(x)).sort(compare)])), rays: this.rays, refs: this.refs, events: this.events, goal: this.goal, tried: [...this.tried].map(pointOf).sort(compare), selected: this.selected, base_values: [...this.base_values].sort((a, b) => a - b), control_marks: this.control_marks, hint: this.hint, invitation_value: this.invitation_value }); }
  restore(state: R): void {
    if (state.schema !== 'invited_reduction_state.v1') throw new TypeError('Invited reduction memory schema mismatch');
    for (const k of ['epoch', 'focus', 'invites', 'refs', 'events', 'goal', 'selected', 'hint', 'invitation_value', 'control_marks', 'rays']) (this as any)[k] = structuredClone(state[k]);
    this.tried = new Set(state.tried.map(key)); this.base_values = new Set(state.base_values); this.relations = Object.fromEntries(Object.entries(state.relations).map(([k, values]) => [k, new Set((values as any[]).map(key))]));
  }
  enter(epoch: number, s: ReductionScene): void { this.epoch = epoch; this.hint = reductionGeometry(s); this.focus = null; this.invites = []; this.tried.clear(); this.control_marks = []; this.base_values = new Set([...s.cells].filter(([p]) => !s.bodies.has(p)).map(([, cut]) => common(cut.flat())[0])); }
  currentInvites(s: ReductionScene): P[] { return [...s.cells].filter(([p, cut]) => !s.bodies.has(p) && !this.base_values.has(common(cut.flat())[0])).map(([p]) => pointOf(p)); }
  async record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, _proposal?: R, _index?: number | null): Promise<any> {
    this.events = []; const a = this.epoch === before.level_epoch ? await retainedReductionScene(first, this.hint) : await measureReductionScene(first), b = this.epoch === before.level_epoch ? await retainedReductionScene(second, this.hint) : await measureReductionScene(second);
    if (!a) return { status: 'invited_reduction_absent', events: [] }; if (this.epoch !== before.level_epoch) this.enter(before.level_epoch, a);
    const target = cell(a, command);
    if (after.levels_completed > before.levels_completed) { this.goal = true; this.refs.push(after.observation_ref); this.events = [{ kind: 'reduction_official_boundary', evidence: after.observation_ref }]; this.focus = null; this.invites = []; return { status: 'invited_reduction_boundary', events: this.events }; }
    if (!b || a.pitch !== b.pitch || !same(a.origin, b.origin)) return { status: 'invited_reduction_scope_changed', events: [] };
    const A = a.bodies, B = b.bodies;
    if (same(reductionPacked(A), reductionPacked(B)) && target !== null && A.has(target)) {
      const changed = this.currentInvites(b);
      if (changed.length) { this.focus = pointOf(target); this.invites = changed; this.selected = true; const values = new Set(changed.map(p => b.cells.get(key(p))![Math.floor(b.pitch / 2)]![Math.floor(b.pitch / 2)]!)); this.invitation_value = values.size === 1 ? [...values][0]! : null; this.control_marks = [];
        const old = a.cells.get(target)!, cut = b.cells.get(target)!; for (let r = 0; r < cut.length; r++) for (let c = 0; c < cut[r]!.length; c++) if (old[r]![c] !== cut[r]![c] && (r === 0 || r === a.pitch - 1 || c === 0 || c === a.pitch - 1)) this.control_marks.push([r, c, cut[r]![c]!]);
      } else if (this.focus !== null && key(this.focus) === target) { this.focus = null; this.invites = []; }
      this.tried.add(target); this.refs.push(after.observation_ref); this.events = [{ kind: 'current_selection_domain', focus: this.focus, invitations: this.invites, evidence: after.observation_ref, effect_status: 'selection hypothesis, no capture law implied' }];
    } else if (B.size === A.size - 1 && this.focus !== null && A.has(key(this.focus))) {
      const focus = key(this.focus), removed = [...A.keys()].filter(p => !B.has(p)), added = [...B.keys()].filter(p => !A.has(p));
      if (removed.includes(focus) && removed.length === 2 && added.length === 1) { const destination = added[0]!, victim = pointOf(removed.find(p => p !== focus)!), dst = pointOf(destination), rank = A.get(focus)![1], u: P = [victim[0] - this.focus[0], victim[1] - this.focus[1]], v: P = [dst[0] - this.focus[0], dst[1] - this.focus[1]];
        if (same(B.get(destination), A.get(focus)) && target === destination) { (this.relations[rank] ??= new Set()).add(key([u, v])); const g = gcd(Math.abs(v[0]), Math.abs(v[1])); this.refs.push(after.observation_ref); if (g > 2) this.rays[rank] = [v[0] / g, v[1] / g]; this.focus = dst; this.invites = this.currentInvites(b); this.events = [{ kind: 'observed_consumed_intermediate', relation: [u, v], rank, evidence: after.observation_ref, scope: 'local public transaction; symmetric extension is provisional' }]; }
      }
    }
    return { status: 'invited_reduction_response', events: this.events };
  }
  domain(s: ReductionScene, bodies: Map<string, Body>, focus: P, obs: R): [P, P][] {
    const rank = bodies.get(key(focus))![1], relations = this.relations[rank]; if (!relations?.size) return [];
    const expanded = new Set<string>(); for (const relation of relations) { const [u, v] = JSON.parse(relation) as [P, P]; for (const swap of [false, true]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const U = swap ? [...u].reverse() : u, V = swap ? [...v].reverse() : v; expanded.add(key([[sx * U[0]!, sy * U[1]!], [sx * V[0]!, sy * V[1]!] ])); } }
    const ordered = [...expanded].map(v => JSON.parse(v) as [P, P]).sort(compare), directions = new Set(ordered.map(([, v]) => { const g = gcd(Math.abs(v[0]), Math.abs(v[1])); return key([v[0] / g, v[1] / g]); }));
    const scope = { request_ref: 'capture:' + obs.observation_ref, caller_ref: 'common_invited_reduction', parent_consumer_ref: 'SupportNavigation', parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'preserve_reduction_continuation', caller_next_item_ref: 'current_capture_domain', epoch: obs.level_epoch, evidence_revision_ref: obs.observation_ref, model_revision_ref: this.refs.at(-1), model_status_ref: 'observed_reduction_with_conditional_symmetries', event_owner_ref: 'public_response', input_domain_complete: true, assumption_refs: ['same_pattern_rank', 'spatial_symmetry_provisional', 'no_hidden_goal'] };
    const cells = [...s.cells.keys()].map(pointOf), result = measureRayCaptureDomain({ scope, operation_ref: 'mechanics.typed_jump_carriers.ray_capture_domain', mode_ref: 'DOMAIN', requested_result_type: 'DMechanicalResult', node_bound: 10000, depth_bound: 64, domain_bound: 4096, time_bound_ms: 1000, phase_ref: 'CURRENT_CAPTURE_DOMAIN', population: [...bodies].map(([p, v]) => ({ member_ref: tupleRef(pointOf(p)), type_ref: v[1], rank: 0, origin: pointOf(p), occupied_offsets: [[0, 0]] })), native_focus_ref: tupleRef(focus), board_cells: cells, ray_passage_cells: cells, landing_support_cells: cells, eligible_victim_refs: [...bodies.keys()].filter(p => p !== key(focus)).map(p => tupleRef(pointOf(p))), range_kind: rank in this.rays ? 'RAY' : 'SHORT', range_law_evidence_ref: this.refs.at(-1), range_law_rank: 0, directions: [...directions].map(pointOf).sort(compare), short_relations: ordered.map(([u, v], i) => ({ relation_ref: String(i), intermediate_delta: u, landing_delta: v })), proposed_landing: null });
    if (result.status !== 'COMPLETE') return [];
    const mapping = new Map([...bodies.keys()].map(p => [tupleRef(pointOf(p)), pointOf(p)])); return result.values.capture_incidences.map((r: R) => [mapping.get(r.victim_ref)!, r.landing]);
  }
  async propose(obs: R, rows: NativeRows, _inputs: readonly R[], remaining: number): Promise<R | null> {
    if (!this.config.enabled || !this.selected && !this.config.initial_selection_question?.enabled) return null;
    const s = this.epoch === obs.level_epoch ? await retainedReductionScene(rows, this.hint) : await measureReductionScene(rows); if (!s || !obs.available_action_refs.includes('ACTION6')) return null;
    if (this.epoch !== obs.level_epoch) this.enter(obs.level_epoch, s);
    const bodies = s.bodies, actions: R[] = [], steps: R[] = [], cur = new Map(bodies); let why = '', focus = this.focus;
    const goalColors = new Set((await detectV5Components(rows)).components.filter(c => c.bbox.bottom < s.origin[1] && c.bbox.right - c.bbox.left >= 2 && c.bbox.bottom - c.bbox.top >= 2 && c.area === c.bbox.width * c.bbox.height && [...bodies.values()].some(v => v[0] === c.value)).map(c => c.value));
    const terminal = (B: Map<string, Body>): boolean => B.size === 1 || goalColors.size === 1 && [...B.values()].every(v => goalColors.has(v[0]));
    type Move = [string, P, [P, P] | null]; type Pending = [Map<string, Body>, P | null, Move[]];
    const queue: Pending[] = [[new Map(bodies), focus, []]], seen = new Set<string>(); let cursor = 0, winning: Move[] | null = null;
    if (Object.keys(this.relations).length) while (cursor < queue.length && seen.size < 8192) {
      const [B, F, path] = queue[cursor++]!, state = key([reductionPacked(B), F]); if (seen.has(state)) continue; seen.add(state);
      if (path.length && terminal(B)) { winning = path; break; } if (path.length >= Math.min(16, remaining)) continue;
      for (const src of [...B.keys()].map(pointOf).sort(compare)) for (const [victim, dst] of this.domain(s, B, src, obs)) {
        const next = new Map(B), value = next.get(key(src))!; next.delete(key(src)); next.delete(key(victim)); next.set(key(dst), value);
        const following: Move[] = [...path, ...(F !== null && same(F, src) ? [] : [['select', src, null] as Move]), ['capture', dst, [src, victim]]]; if (following.length <= Math.min(16, remaining)) queue.push([next, dst, following]);
      }
    }
    let plan = winning;
    if (plan) why = 'conditional complete population reduction; preserve intermediate services and current selection';
    else if (focus !== null && bodies.has(key(focus)) && this.invites.length) { const dst = [...this.invites].sort(compare).find(p => !bodies.has(key(p))); if (dst) { plan = [['probe', dst, null]]; why = 'consume current invitation; distinguish selection from a population transaction'; } }
    if (!plan) { const candidates = [...bodies.keys()].map(pointOf).sort((a, b) => a[1] - b[1] || a[0] - b[0]).filter(p => (focus === null || !same(p, focus)) && !this.tried.has(key(p))); if (!candidates.length) return null; plan = [['select', candidates[0]!, null]]; why = !this.selected ? this.config.initial_selection_question.purpose : 'bind one current repeated occurrence to its public command domain'; }
    for (const [mode, p, relation] of plan) {
      const expected = reductionPacked(cur); actions.push(click(s, p)); const prior = focus;
      if (mode === 'capture') { const [src, victim] = relation!, value = cur.get(key(src))!; cur.delete(key(src)); cur.delete(key(victim)); cur.set(key(p), value); } focus = p;
      const witness: R = await ObservedInputDomain.makeLocusWitness(obs as any, rows, reductionPoint(s, p), { reason: why, evidence: [obs.observation_ref, ...this.refs.slice(-3)] });
      const step: R = { action: actions.at(-1), expected_before: expected, expected_after: mode === 'probe' ? null : reductionPacked(cur), mode, focus_before: prior === null ? null : [...prior], focus_after: [...focus], control_marks: structuredClone(this.control_marks), locus_witness: witness };
      steps.push(step); if (steps.length > 1 && mode === 'capture' && this.invitation_value !== null) Object.assign(witness, { palette_value: this.invitation_value, projected_rows_digest: await rowsDigest([[this.invitation_value]]), scope: 'conditional_invitation_pixel_after_bound_selection_or_capture', source_observed_palette_value: rows[reductionPoint(s, p)[1]]![reductionPoint(s, p)[0]] }); step.geometry = this.hint;
    }
    const ref = 'C_reduction_' + (await v6Digest([obs.observation_ref, actions])).slice(0, 16), evidence = [obs.observation_ref, ...this.refs.slice(-4)], facts = { repeated_population_bound: true, current_invitation_or_conditional_reduction: true, joint_continuation_preserved: true };
    const payload = { invited_reduction: true, frame_hash: obs.frame_hash, pitch: s.pitch, origin: [...s.origin], hypothesis: why, goal_status: 'residual cardinality/class hypothesis; official return only', search_states: seen.size, search_exhausted: cursor >= queue.length, unknowns: ['unseen range types', 'exclusive symmetry', 'terminal class quantifier'] };
    return { status: 'proposed', kind: 'invited_population_reduction', support_plan: payload, actions, steps, facts, compositions: [{ id: ref, role: 'conditional_population_reduction', observed: false, open_question: why, properties: { population: bodies.size }, relations: ['contributes_to:G_official_completion'] }], question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence, binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed }, bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence, actions, frozen_support_plan: payload, outcome_guard: { path: ['value'], contains: ref } } };
  }
  bind(p: R): void { for (const step of p.steps) if (step.locus_witness) step.point_binding = step.locus_witness; }
  async before(p: R, i: number, packet: R, _obs: R): Promise<NativeBeforeResult> {
    const step = p.steps[i], s = await retainedReductionScene(packet.frame_rows, step.geometry); let ok = !!s && packet.level === p.binding.level_epoch && packet.levels_completed === p.binding.levels_completed && same(reductionPacked(s.bodies), step.expected_before) && same(s.origin, p.support_plan.origin) && s.pitch === p.support_plan.pitch;
    if (i === 0) ok = ok && packet.frame_hash === p.support_plan.frame_hash;
    if (ok && ['capture', 'probe'].includes(step.mode) && step.control_marks.length) { const cut = s!.cells.get(key(step.focus_before)); ok = !!cut && step.control_marks.every(([r, c, v]: number[]) => cut[r!]![c!] === v); }
    return { admitted: ok, reason: 'current_population_selection_and_lattice' };
  }
  async after(p: R, i: number, before: R, after: R, _first: NativeRows, second: NativeRows): Promise<NativeAfterResult> {
    if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary' };
    const step = p.steps[i], expected = step.expected_after, s = await retainedReductionScene(second, step.geometry);
    if (expected === null) return { matched: null, seal_prefix: true, reason: 'invitation_transaction_requires_reconciliation' };
    let ok = !!s && same(reductionPacked(s.bodies), expected); if (ok && step.control_marks.length) { const cut = s!.cells.get(key(step.focus_after)); ok = !!cut && step.control_marks.every(([r, c, v]: number[]) => cut[r!]![c!] === v); }
    return { matched: ok, seal_prefix: !ok, reason: ok ? 'joint_population_prediction' : 'population_or_control_contradiction' };
  }
}
