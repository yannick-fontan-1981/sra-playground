/** Native common_contextual_compartments.py and its bounded rectangle measure. */
import { detectV5Components, ObservedInputDomain, v6Canonical, v6Digest } from './v6-native-observer.ts';
import { ControlDependencies } from './v6-transition-learning.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeFamily, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const key = (a: unknown): string => JSON.stringify(a);
const same = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
const compare = (a: readonly number[], b: readonly number[]): number => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return a.length - b.length; };
const counts = (values: readonly number[]): Map<number, number> => { const out = new Map<number, number>(); for (const v of values) out.set(v, (out.get(v) ?? 0) + 1); return out; };
const most = (values: Map<number, number>): number => [...values].sort((a, b) => b[1] - a[1])[0]![0];
const cut = (rows: NativeRows, box: readonly number[]): number[][] => rows.slice(box[1], box[3]! + 1).map(row => [...row.slice(box[0], box[2]! + 1)]);

/** Tuples in the source contract are represented by explicit coordinate arrays. */
export function measureProgramInstructionShape(support: unknown): R {
  if (!Array.isArray(support) || !support.length || support.length > 256 || support.some(p => !Array.isArray(p) || p.length !== 2 || p.some((x: unknown) => !Number.isSafeInteger(x))) || new Set(support.map(key)).size !== support.length) return { shape_complete: false };
  const rs = support.map(p => p[0]), cs = support.map(p => p[1]), top = Math.min(...rs), left = Math.min(...cs), height = Math.max(...rs) - top + 1, width = Math.max(...cs) - left + 1;
  if (height * width > 256) return { shape_complete: false };
  const normalized = support.map(p => [p[0] - top, p[1] - left]).sort(compare), border: number[][] = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) if (r === 0 || r === height - 1 || c === 0 || c === width - 1) border.push([r, c]);
  return { shape_complete: true, normalized_support: normalized, rectangle_filled: normalized.length === height * width, rectangle_border_only: height >= 3 && width >= 3 && same(normalized, border) };
}

export async function measureContextualCompartments(rows: NativeRows, mark: number | null = null): Promise<R | null> {
  const h = rows.length, w = rows[0]!.length, background = most(counts(rows.flat())), frames: R[] = [];
  for (const c of (await detectV5Components(rows)).components) {
    const { left: l, top: t, right: r, bottom: b, width: ww, height: hh } = c.bbox;
    if (c.value === background || ww < 3 || ww > Math.floor(w / 5) || hh < Math.max(7, ww + 2) || hh > Math.floor(h / 2)) continue;
    const pixels = new Set(c.pixels.map(key)); let sides = 0;
    for (let y = t; y <= b; y++) for (const x of [l, r]) if (pixels.has(key([y, x]))) sides++;
    if (sides < Math.floor(2 * hh * 2 / 3)) continue;
    const shape = measureProgramInstructionShape([...c.pixels].sort(compare)), contents = new Map<number, number>();
    for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) { const v = rows[y]![x]!; if (v !== background && v !== c.value) contents.set(v, (contents.get(v) ?? 0) + 1); }
    const region = [Math.max(0, l - 2 * ww), t, Math.min(w - 1, r), b];
    frames.push({ box: [l, t, r, b], border: c.value, closed: !!shape.rectangle_border_only, filled: [...contents.values()].reduce((a, n) => a + n, 0), contents: [...contents].sort((a, b) => a[0] - b[0]), point: [Math.floor((l + r) / 2), Math.floor((t + b) / 2)], local: await v6Digest(cut(rows, region)), region, shape: await v6Digest([ww, hh, [...c.relative_pixels].sort(compare)]) });
  }
  if (frames.length < 5) return null;
  frames.sort((a, b) => compare(a.box, b.box)); const normal = most(counts(frames.map(f => f.border))), marked = frames.filter(f => mark === null ? f.border !== normal : f.border === mark);
  if (mark === null) { if (!marked.length || new Set(marked.map(v => v.border)).size !== 1) return null; mark = marked[0]!.border; }
  return { frames, marked, mark, normal, background, key: await v6Digest(frames.map(v => [v.box, v.border, v.filled, v.contents, v.local])) };
}

export class ContextualCompartments implements NativeFamily<any> {
  readonly id = 'contextual_compartments';
  epoch: number | null = null; mark: number | null = null; refs: string[] = []; tried = new Set<string>(); pending: R | null = null;
  events: R[] = []; passed: R[] = []; transitions: R = {}; receipts: R[] = []; dependencies = new Map<string, Set<string>>(); terminal_shapes: R[] = []; productive = new Set<string>();
  readonly config: R;
  constructor(config: R) { this.config = config; }
  state(): R { return structuredClone({ format: 'native.contextual_compartments.v1', epoch: this.epoch, mark: this.mark, refs: this.refs, tried: [...this.tried].sort(), pending: this.pending, events: this.events, passed: this.passed, transitions: this.transitions, receipts: this.receipts,
    dependencies: [...this.dependencies].map(([k, v]) => [JSON.parse(k), [...v].map(x => JSON.parse(x)).sort(compare)]), terminal_shapes: this.terminal_shapes, productive: [...this.productive].sort() }); }
  restore(s: R): void {
    if (s.format !== 'native.contextual_compartments.v1') throw new TypeError('Compartment memory schema mismatch');
    for (const name of ['epoch', 'mark', 'refs', 'pending', 'events', 'passed', 'transitions', 'receipts', 'terminal_shapes']) (this as any)[name] = structuredClone(s[name]);
    this.tried = new Set(s.tried); this.productive = new Set(s.productive); this.dependencies = new Map(s.dependencies.map(([k, vs]: any[]) => [key(k), new Set(vs.map(key))]));
  }
  async record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal?: R, index?: number | null): Promise<any> {
    this.events = []; const a = await measureContextualCompartments(first, this.mark), b = await measureContextualCompartments(second, a ? a.mark : this.mark);
    if (!a) return { status: 'compartment_domain_absent', events: [] };
    if (this.epoch !== before.level_epoch) { this.epoch = before.level_epoch; this.pending = null; this.tried.clear(); this.dependencies.clear(); }
    const owned = !!proposal?.support_plan?.contextual_compartments;
    if (after.levels_completed > before.levels_completed) {
      if (owned) { const control = proposal!.steps[index!].control; this.terminal_shapes.push({ shape: control.shape, box: control.box, layout: a.frames.filter((v: R) => v.closed).map((v: R) => ({ box: v.box, shape: v.shape })), evidence: [before.observation_ref, after.observation_ref] }); }
      this.passed.push({ before: before.observation_ref, after: after.observation_ref, command, method: 'contextual_compartment_progression' }); this.events = [{ kind: 'compartment_official_boundary', before: before.observation_ref, after: after.observation_ref }]; this.pending = null; this.epoch = null; return { status: 'compartment_boundary', events: this.events };
    }
    if (!owned) return { status: 'compartment_unowned_observation', events: [] };
    const chosen = proposal!.steps[index!].control, question = proposal!.steps[index!].question_key, [l, t, r, bb] = chosen.region;
    this.tried.add(question); let changed = false;
    for (let y = t; y <= bb; y++) for (let x = l; x <= r; x++) if (first[y]![x] !== second[y]![x]) changed = true;
    this.mark = chosen.border; this.refs.push(after.observation_ref); if (changed) this.productive.add(question); else this.productive.delete(question);
    if (b) {
      const old = new Map<string, R>(a.frames.map((v: R) => [key(v.box), v])), fresh = new Map<string, R>(b.frames.map((v: R) => [key(v.box), v]));
      const controlKey = key(chosen.box), related = this.dependencies.get(controlKey) ?? new Set<string>(); this.dependencies.set(controlKey, related);
      for (const [position, v] of old) if (fresh.has(position) && position !== controlKey && !same(v.contents, fresh.get(position)!.contents)) related.add(position);
      const current = fresh.get(controlKey);
      if (related.size && current && same(current.contents, chosen.contents) && chosen.filled) {
        const receivers = b.frames.filter((v: R) => related.has(key(v.box))).map((v: R) => ({ box: v.box, contents: v.contents, border: v.border }));
        this.tried.add(await ControlDependencies.questionKey(before.level_epoch, 'contextual_compartment_control', { box: current.box, local: current.local, filled: current.filled, receivers }, []));
      }
    }
    this.pending = changed && !chosen.filled ? { control: chosen, local: await v6Digest(cut(second, chosen.region)), ref: after.observation_ref } : null;
    const effect = { kind: 'contextual_compartment_response', before: before.observation_ref, after: after.observation_ref, control_box: chosen.box, local_changed: changed, before_filled_pixels: chosen.filled, hypotheses: ['contextual operation', 'selection or indication remains possible until transfer measured'], unknowns: ['native clock debit', 'freshness unit', 'recipe multiplicity', 'job duration'] };
    this.receipts.push(effect); this.events = [effect];
    if (b) { const signature = await v6Digest([a.key, command]), prior = this.transitions[signature], entry = { before: a, after: b, action: command, control: chosen, evidence: [before.observation_ref, after.observation_ref] };
      if (prior && prior.after.key !== b.key) this.transitions[signature] = { ambiguous: true, outcomes: [prior.after?.key ?? null, b.key] }; else if (!prior) this.transitions[signature] = entry; }
    return { status: 'compartment_response_retained', events: this.events };
  }
  async choose(scene: R, obs: R): Promise<[R | null, string | null]> {
    const mark = scene.frames.some((v: R) => v.border === this.mark) ? this.mark : scene.mark, candidates = scene.frames.filter((v: R) => v.border === mark), terminal: R[] = [];
    const current = new Set(scene.frames.filter((v: R) => v.closed).map((v: R) => key([v.box, v.shape])));
    for (const v of scene.frames) for (const memory of this.terminal_shapes) {
      if (v.box[2] - v.box[0] !== memory.box[2] - memory.box[0]) continue;
      const dx = v.box[0] - memory.box[0], dy = v.box[1] - memory.box[1];
      const expected = new Set(memory.layout.map((a: R) => key([a.box.map((z: number, i: number) => z + (i % 2 === 0 ? dx : dy)), a.shape])));
      if (expected.size > 2 && [...expected].every(p => current.has(p))) { terminal.push(v); break; }
    }
    const rank = (v: R): number => { if (terminal.length !== 1) return 1; const target = terminal[0]!, [l, t, r, b] = v.box, [ll, tt, rr, bb] = target.box; return v === target || ll - r > 0 && ll - r <= 2 * (rr - ll + 1) && Math.min(b, bb) >= Math.max(t, tt) ? 0 : 1; };
    candidates.sort((a: R, b: R) => rank(a) - rank(b) || Number(!a.closed) - Number(!b.closed) || Number(!a.filled) - Number(!b.filled) || a.box[1] - b.box[1] || a.box[0] - b.box[0]);
    for (const candidate of candidates) {
      const related = this.dependencies.get(key(candidate.box)) ?? new Set<string>(), receivers = scene.frames.filter((v: R) => related.has(key(v.box))).map((v: R) => ({ box: v.box, contents: v.contents, border: v.border }));
      const question = await ControlDependencies.questionKey(obs.level_epoch, 'contextual_compartment_control', { box: candidate.box, local: candidate.local, filled: candidate.filled, receivers }, []);
      if (!this.tried.has(question) || rank(candidate) === 0 && this.productive.has(question)) return [candidate, question];
    }
    if (this.pending) { const candidate = { ...this.pending.control, local: this.pending.local }, question = await ControlDependencies.questionKey(obs.level_epoch, 'contextual_compartment_control', { box: candidate.box, local: candidate.local, filled: candidate.filled }, []); if (!this.tried.has(question)) return [candidate, question]; }
    return [null, null];
  }
  async propose(obs: R, rows: NativeRows, _inputs: readonly R[], remaining: number): Promise<R | null> {
    if (!this.config.enabled || !obs.available_action_refs.includes('ACTION6') || remaining < 1) return null;
    const scene = await measureContextualCompartments(rows, this.mark); if (!scene) return null;
    if (this.epoch !== obs.level_epoch) { this.epoch = obs.level_epoch; this.tried.clear(); this.pending = null; this.dependencies.clear(); }
    let current = scene; const steps: R[] = [], actions: R[] = [], seen = new Set<string>();
    for (let n = 0; n < Math.min(16, remaining); n++) {
      const [chosen, question] = await this.choose(current, obs); if (!chosen || seen.has(question!)) break; seen.add(question!);
      const action = { action_ref: 'ACTION6', data: { x: chosen.point[0], y: chosen.point[1] } }, retained = this.transitions[await v6Digest([current.key, action])], known = retained && !retained.ambiguous ? retained : null;
      const step = { action, control: chosen, question_key: question, expected_before: current.key, expected_after: known ? known.after.key : null, probe: !known,
        locus_witness: await ObservedInputDomain.makeLocusWitness(obs as any, rows, chosen.point, { reason: 'Test currently distinguished compartment control; no recipe or deadline supplied.', evidence: [obs.observation_ref] }) };
      actions.push(action); steps.push(step); if (!known) break; current = known.after;
    }
    if (!actions.length) return null;
    const why = 'Revalidate any score-associated output through current compartment anchors, then test its marked enabling neighbor. Otherwise test a currently distinguished compartment. Highlight and adjacency remain revisable hypotheses. Preserve local progress; reopen a command only when its observed receiver or local premises change.';
    const facts = { repeated_compartments_measured: true, current_mark_contrast_present: true, control_context_bound: true }, ref = 'C_compartment_' + (await v6Digest([obs.observation_ref, actions])).slice(0, 16), evidence = [obs.observation_ref, ...this.refs.slice(-4)];
    const plan = { contextual_compartments: true, frame_hash: obs.frame_hash, scene_key: scene.key, mark: scene.mark, prior_boundaries: this.passed.slice(-3), recalled_output_anchors: this.terminal_shapes.slice(-3), receiver_dependencies: [...this.dependencies].map(([control, vs]) => ({ control: JSON.parse(control), receivers: [...vs].map(v => JSON.parse(v)).sort(compare) })), unknowns: ['typed freshness calibration', 'complete job and recipe law', 'partial contour residual', 'causal necessity of adjacent process'] };
    return { status: 'proposed', kind: 'contextual_compartment_question', support_plan: plan, actions, steps, facts, compositions: [{ id: ref, role: 'compartment_control_question', observed: false, open_question: why, properties: { candidate_count: scene.marked.length }, relations: ['contributes_to:G_official_completion'] }], question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence, binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed }, bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence, actions, frozen_support_plan: structuredClone(plan), outcome_guard: { path: ['value'], contains: ref } } };
  }
  bind(p: R): void { for (const step of p.steps) if (step.locus_witness) step.point_binding = step.locus_witness; }
  async before(p: R, i: number, packet: R, _obs: R): Promise<NativeBeforeResult> {
    const scene = await measureContextualCompartments(packet.frame_rows, p.support_plan.mark); let ok = scene !== null && scene.key === p.steps[i].expected_before && packet.level === p.binding.level_epoch && packet.levels_completed === p.binding.levels_completed;
    if (i === 0) ok = ok && packet.frame_hash === p.support_plan.frame_hash;
    return { admitted: !!ok, reason: 'current_compartment_occurrences_and_context' };
  }
  async after(p: R, i: number, before: R, after: R, _first: NativeRows, second: NativeRows): Promise<NativeAfterResult> {
    if (after.levels_completed > before.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    if (p.steps[i].expected_after === null) return { matched: null, seal_prefix: true, reason: 'unknown_compartment_response' };
    const scene = await measureContextualCompartments(second, p.support_plan.mark), ok = scene !== null && scene.key === p.steps[i].expected_after;
    return { matched: !!ok, seal_prefix: !ok, reason: ok ? 'remembered_local_composition' : 'compartment_context_diverged' };
  }
}
