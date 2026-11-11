/**
 * Native transfer of V6 common_multiscale_constraints.py,
 * common_symmetric_field.py and periodic_correspondence.py.
 * Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Shapes, palette values, addresses and proposed goals are measured, not game IDs.
 */
import { canonical } from './canonical.ts';
import { rowsDigest, projection, v6Digest as digest } from './v6-native-observer.ts';
import type { ObservedInputDomain, LocusWitness } from './v6-native-observer.ts';
export { rowsDigest, projection } from './v6-native-observer.ts';

export type Point = readonly [number, number];
export type Rows = readonly (readonly number[])[];
export type Box = readonly [number, number, number, number];
export interface FieldEntity { bbox: Box; area: number; palette_value: number }
export interface FieldObservation {
  entities: readonly FieldEntity[]; observation_ref: string; level_epoch: number;
  levels_completed: number; frame_hash: string; state: string; available_action_refs: readonly string[];
}
export interface FieldCommand { action_ref: string; data: Record<string, number> }
type Tile = { value?: number; glyph?: number[][]; shape?: Point };
type TileMap = Map<string, Tile>;
export interface MeasuredField { size: Point; pitch: Point; groups: TileMap[] }
export interface Constraint { actual: number; eq: Set<number>; ne: Set<number>; sources: Set<string> }
export type ConstraintTable = Map<string, Constraint>;
type Rule = { shape: number[]; anchor: number[]; orientation: number; roles: Record<string, boolean> };
type SymmetryRule = { lattice: unknown[]; family: string };
type AnyRule = Rule | SymmetryRule;
type Vote = { source: string; point: string; symbol: number; reference: number; value: number };
type Fit = { rule: Rule; field: MeasuredField; fit: Record<string, unknown> };
export interface FieldStep {
  action: FieldCommand;
  expected_before: { level_epoch: number; frame_hash: string | null };
  expected_before_rows_digest: string;
  expected_after: string | null;
  point_binding?: LocusWitness & { source_frame_hash: string };
  constraint: { p: number[]; before: number; equal: number[]; different: number[]; sources: number[][]; action: FieldCommand; expected_value: number | null };
}
export interface FieldProposal {
  status: 'proposed'; kind: string; constraint_plan: {
    rule: AnyRule | null; fit: Record<string, unknown> | null; cell_size: number[]; lattice_pitch: number[];
    projection_bbox: number[]; selected_cells: FieldStep['constraint'][]; total_violating_cells: number;
    constraint_count: number; prediction_scope: string;
  };
  actions: FieldCommand[]; steps: FieldStep[]; facts: Record<string, boolean>;
  compositions: Record<string, unknown>[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  binding: { observation_ref: string; level_epoch: number; levels_completed: number };
  bundle_template: Record<string, unknown>;
}
const key = (x: number, y: number): string => `${x},${y}`;
const point = (k: string): [number, number] => { const [x, y] = k.split(',').map(Number); return [x!, y!]; };
const cmpPoint = (a: Point, b: Point): number => a[0] - b[0] || a[1] - b[1];
const cmpKey = (a: string, b: string): number => cmpPoint(point(a), point(b));
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const sorted = (a: Iterable<number>): number[] => [...a].sort((x, y) => x - y);
const groupAdd = <T>(map: Map<string, T[]>, k: string, value: T): void => { const xs = map.get(k) ?? []; xs.push(value); map.set(k, xs); };
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };

function lengths(rows: Rows): number[] {
  const result: number[] = [];
  for (const row of rows) {
    let start = 0;
    for (let x = 1; x <= row.length; x++) if (x === row.length || row[x] !== row[x - 1]) { result.push(x - start); start = x; }
  }
  return result;
}
function turn(x: number, y: number, orientation: number): [number, number] {
  if (orientation >= 4) x = -x;
  for (let i = 0; i < orientation % 4; i++) [x, y] = [-y, x];
  return [x, y];
}
function pitch(origins: Point[], axis: 0 | 1, size: number): number | null {
  const lines = new Map<number, Set<number>>(), counts = new Map<number, number>();
  for (const p of origins) { const line = lines.get(p[1 - axis]!) ?? new Set<number>(); line.add(p[axis]); lines.set(p[1 - axis]!, line); }
  for (const line of lines.values()) {
    const xs = sorted(line);
    for (let i = 1; i < xs.length; i++) { const diff = xs[i]! - xs[i - 1]!; if (diff > size) counts.set(diff, (counts.get(diff) ?? 0) + 1); }
  }
  if (!counts.size) return null;
  const maximum = Math.max(...counts.values());
  return Math.min(...[...counts].filter(([, n]) => n === maximum).map(([value]) => value));
}

export function extractFields(obs: FieldObservation, rows: Rows): MeasuredField[] {
  const height = rows.length, width = rows[0]!.length;
  const rectangles = new Map<string, Point[]>();
  for (const e of obs.entities) {
    const [left, top, right, bottom] = e.bbox, w = right - left + 1, h = bottom - top + 1;
    if (Math.min(w, h) >= 2 && e.area === w * h) groupAdd(rectangles, key(w, h), [left, top]);
  }
  const result: MeasuredField[] = [];
  for (const [sizeKey, origins] of [...rectangles].sort((a, b) => b[1].length - a[1].length)) {
    const [w, h] = point(sizeKey);
    if (origins.length < 4) continue;
    const dx = pitch(origins, 0, w), dy = pitch(origins, 1, h);
    if (dx === null || dy === null) continue;
    const phases = new Map<string, number>(), tiles: TileMap = new Map();
    for (const [x, y] of origins) { const phase = key(x % dx, y % dy); phases.set(phase, (phases.get(phase) ?? 0) + 1); }
    for (const [phase, repeats] of phases) {
      if (repeats < 2) continue;
      const [px, py] = point(phase);
      for (let y = py; y < height - h; y += dy) for (let x = px; x < width - w; x += dx) {
        if (!x || !y) continue;
        const inner = rows.slice(y, y + h).map(row => row.slice(x, x + w));
        const ring = [...rows[y - 1]!.slice(x, x + w), ...rows[y + h]!.slice(x, x + w),
          ...rows.slice(y, y + h).map(row => row[x - 1]!), ...rows.slice(y, y + h).map(row => row[x + w]!)];
        if (ring.some(value => value !== ring[0]) || inner.some(row => row.includes(ring[0]!))) continue;
        if (inner.every(row => row.every(value => value === inner[0]![0]))) { tiles.set(key(x, y), { value: inner[0]![0]! }); continue; }
        const transposed = Array.from({ length: w }, (_, xx) => inner.map(row => row[xx]!));
        const sx = lengths(inner).reduce(gcd), sy = lengths(transposed).reduce(gcd);
        const nx = Math.floor(w / sx), ny = Math.floor(h / sy);
        if (sx <= 1 || sy <= 1 || nx < 2 || ny < 2) continue;
        tiles.set(key(x, y), { glyph: inner.filter((_, i) => i % sy === 0).map(row => row.filter((_, i) => i % sx === 0)), shape: [nx, ny] });
      }
    }
    const seen = new Set<string>(), components: TileMap[] = [];
    for (const seed of origins) {
      const seedKey = key(...seed);
      if (!tiles.has(seedKey) || seen.has(seedKey)) continue;
      const work = [seedKey], group: TileMap = new Map(); seen.add(seedKey);
      while (work.length) {
        const k = work.pop()!, [x, y] = point(k); group.set(k, tiles.get(k)!);
        for (const [xx, yy] of [[dx, 0], [-dx, 0], [0, dy], [0, -dy]] as Point[]) {
          const n = key(x + xx, y + yy);
          if (tiles.has(n) && !seen.has(n)) { seen.add(n); work.push(n); }
        }
      }
      if ([...group.values()].some(v => v.glyph !== undefined) && [...group.values()].filter(v => v.value !== undefined).length >= 2) components.push(group);
    }
    if (components.reduce((n, g) => n + [...g.values()].filter(t => t.glyph !== undefined).length, 0) >= 2) result.push({ size: [w, h], pitch: [dx, dy], groups: components });
  }
  return result;
}
function votes(field: MeasuredField, shape: readonly number[], anchor: readonly number[], orientation: number): Vote[] {
  const [dx, dy] = field.pitch, answer: Vote[] = [];
  for (const group of field.groups) for (const [src, tile] of group) {
    if (!tile.shape || !same(tile.shape, shape)) continue;
    const [x, y] = point(src), glyph = tile.glyph!, reference = glyph[anchor[1]!]![anchor[0]!]!;
    for (let j = 0; j < glyph.length; j++) for (let i = 0; i < glyph[j]!.length; i++) {
      if (i === anchor[0] && j === anchor[1]) continue;
      const [u, v] = turn(i - anchor[0]!, j - anchor[1]!, orientation), p = key(x + u * dx, y + v * dy), value = group.get(p)?.value;
      if (value !== undefined) answer.push({ source: src, point: p, symbol: glyph[j]![i]!, reference, value });
    }
  }
  return answer;
}
function mapping(rows: Vote[]): Record<string, boolean> | null {
  const counts = new Map<number, [number, number]>(), refs = new Map<number, Set<string>>();
  for (const { source, symbol, reference, value } of rows) {
    const ns = counts.get(symbol) ?? [0, 0]; ns[value === reference ? 1 : 0]++; counts.set(symbol, ns);
    const seen = refs.get(symbol) ?? new Set<string>(); seen.add(source); refs.set(symbol, seen);
  }
  const chosen: Record<string, boolean> = {};
  for (const [k, [no, yes]] of counts) {
    if (refs.get(k)!.size < 2 || yes === no) return null;
    chosen[String(k)] = yes > no;
  }
  return new Set(Object.values(chosen)).size === 2 ? chosen : null;
}
export function induceFields(fields: MeasuredField[]): Fit[] {
  const fits: { score: [number, number]; result: Fit }[] = [];
  for (const field of fields) {
    const shapes = new Map<string, Point>();
    for (const group of field.groups) for (const tile of group.values()) if (tile.shape) shapes.set(key(...tile.shape), tile.shape);
    for (const shape of shapes.values()) for (let x = 0; x < shape[0]; x++) for (let y = 0; y < shape[1]; y++) for (let orientation = 0; orientation < 8; orientation++) {
      const rs = votes(field, shape, [x, y], orientation), roles = mapping(rs);
      if (!roles) continue;
      const by = new Map<string, Vote[]>(); for (const row of rs) groupAdd(by, row.source, row);
      let cvHits = 0, cvN = 0, qualified = 0;
      for (const [src, held] of by) {
        const local = mapping(rs.filter(row => row.source !== src));
        if (!local || !same(local, roles)) continue;
        const hits = held.filter(r => roles[String(r.symbol)] === (r.value === r.reference)).length;
        cvHits += hits; cvN += held.length; if (hits === held.length) qualified++;
      }
      if (!qualified || cvHits * 2 <= cvN) continue;
      const equal = rs.filter(r => r.value === r.reference).length, baseline = Math.max(equal, rs.length - equal);
      if (cvHits <= baseline) continue;
      fits.push({ score: [2 * cvHits - cvN, cvN], result: { rule: { shape: [...shape], anchor: [x, y], orientation, roles }, field,
        fit: { window_count: by.size, holdout_correct: cvHits, holdout_total: cvN, perfect_holdout_count: qualified, constant_baseline_correct: baseline } } });
    }
  }
  if (!fits.length) return [];
  const best = fits.map(f => f.score).sort(cmpPoint).at(-1)!;
  return fits.filter(f => cmpPoint(f.score, best) === 0).map(f => f.result);
}
export function fieldConstraints(field: MeasuredField, rule: Rule): ConstraintTable | null {
  const rs = votes(field, rule.shape, rule.anchor, rule.orientation), answer: ConstraintTable = new Map();
  for (const { source, point: p, symbol, reference, value } of rs) {
    const role = rule.roles[String(symbol)]; if (role === undefined) return null;
    const c = answer.get(p) ?? { actual: value, eq: new Set<number>(), ne: new Set<number>(), sources: new Set<string>() };
    (role ? c.eq : c.ne).add(reference); c.sources.add(source); answer.set(p, c);
  }
  if (!rs.length || [...answer.values()].some(c => c.eq.size > 1 || [...c.eq].some(v => c.ne.has(v)))) return null;
  return answer;
}
export const acceptsConstraint = (c: Constraint, value: number): boolean => (!c.eq.size || c.eq.has(value)) && !c.ne.has(value);

export class WindowConstraints {
  readonly familyId: string = 'window_constraints';
  protected epoch: number | null = null;
  protected rule: AnyRule | null = null;
  protected provenance: Record<string, unknown> | null = null;
  protected prior: { rule: AnyRule; ref: string; score: number } | null = null;
  protected rejected = new Set<string>();
  protected effects = new Map<number, { point: string; value: number; ref: string }[]>();
  protected deactivated = false;
  protected first: string | null = null;
  protected cachedScene: [Point, Point] | null = null;
  readonly passed: { rule: AnyRule; ref: string; score: number }[] = [];
  last: FieldProposal['constraint_plan'] | null = null;

  state(): Record<string, unknown> {
    return structuredClone({ format: 'native.window_constraints.v1', family: this.familyId,
      epoch: this.epoch, rule: this.rule, provenance: this.provenance, prior: this.prior,
      rejected: [...this.rejected], effects: [...this.effects], deactivated: this.deactivated,
      first: this.first, cachedScene: this.cachedScene, last: this.last, passed: this.passed });
  }

  /** Restore only snapshots produced by this native version, including evidence. */
  restore(snapshot: Record<string, unknown>): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.window_constraints.v1' || value.family !== this.familyId
      || !Array.isArray(value.rejected) || !Array.isArray(value.effects) || !Array.isArray(value.passed)
      || typeof value.deactivated !== 'boolean' || !(value.epoch === null || Number.isSafeInteger(value.epoch))) {
      throw new TypeError('Incompatible field-constraint memory snapshot');
    }
    this.epoch = value.epoch as number | null; this.rule = value.rule as AnyRule | null;
    this.provenance = value.provenance as Record<string, unknown> | null; this.prior = value.prior as typeof this.prior;
    this.rejected = new Set(value.rejected as string[]); this.effects = new Map(value.effects as [number, { point: string; value: number; ref: string }[]][]);
    this.deactivated = value.deactivated; this.first = value.first as string | null;
    this.cachedScene = value.cachedScene as [Point, Point] | null; this.last = value.last as typeof this.last;
    this.passed.splice(0, this.passed.length, ...(value.passed as typeof this.passed));
  }

  protected clear(epoch: number): void {
    this.epoch = epoch; this.rule = null; this.provenance = null; this.rejected.clear(); this.effects.clear();
    this.deactivated = false; this.last = null; this.first = null; this.cachedScene = null;
  }
  protected fit(obs: FieldObservation, rows: Rows): [MeasuredField, ConstraintTable] | null {
    const fields = extractFields(obs, rows);
    if (this.rule !== null && 'roles' in this.rule) {
      for (const field of fields) {
        if (!same([field.size, field.pitch], this.cachedScene)) continue;
        const c = fieldConstraints(field, this.rule); if (c?.size) return [field, c];
      }
      return null;
    }
    const fits = induceFields(fields); let mode = 'empirical_cross_window_alignment';
    if (!fits.length && this.prior && 'roles' in this.prior.rule) {
      for (const field of fields) {
        const tab = fieldConstraints(field, this.prior.rule);
        if (tab?.size && [...tab.values()].some(v => acceptsConstraint(v, v.actual)) && [...tab.values()].some(v => !acceptsConstraint(v, v.actual))) {
          fits.push({ rule: this.prior.rule, field, fit: { source_score: this.prior.score, new_local_observations: tab.size } });
        }
      }
      mode = 'rebound_as_local_probe';
    }
    const options: { pattern: unknown; fit: Fit; table: ConstraintTable }[] = [];
    for (const fit of fits) {
      const table = fieldConstraints(fit.field, fit.rule);
      if (table?.size) options.push({ pattern: [...table].sort((a, b) => cmpKey(a[0], b[0])).map(([p, c]) => [point(p), sorted(c.eq), sorted(c.ne)]), fit, table });
    }
    if (!options.length || options.some(r => !same(r.pattern, options[0]!.pattern))) return null;
    const selected = options[0]!; this.rule = structuredClone(selected.fit.rule); this.cachedScene = [selected.fit.field.size, selected.fit.field.pitch]; this.first = obs.observation_ref;
    this.provenance = { method: mode, fit: selected.fit.fit, equivalent_alignments: options.length, initial_ref: this.first, prior_scoring_ref: this.prior?.ref ?? null };
    return [selected.fit.field, selected.table];
  }
  protected predictedRewrite(constraint: Constraint): number | null {
    const known = this.effects.get(constraint.actual) ?? [], values = new Set(known.map(r => r.value));
    return values.size === 1 && new Set(known.map(r => r.point)).size >= 2 ? [...values][0]! : null;
  }
  async propose(obs: FieldObservation, rows: Rows, inputs: readonly FieldCommand[], remaining: number): Promise<FieldProposal | null> {
    if (!inputs.some(a => Object.keys(a.data).length)) return null;
    if (this.epoch !== obs.level_epoch) this.clear(obs.level_epoch);
    if (this.deactivated) return null;
    const fit = this.fit(obs, rows); if (!fit) return null;
    const [field, table] = fit, [w, h] = field.size, items: FieldStep['constraint'][] = [];
    for (const [p, c] of table) {
      const [x, y] = point(p);
      if (acceptsConstraint(c, c.actual) || this.rejected.has(`${p},${c.actual}`)) continue;
      const located = inputs.filter(a => Object.keys(a.data).length && x <= a.data.x! && a.data.x! < x + w && y <= a.data.y! && a.data.y! < y + h);
      if (located.length !== 1) continue;
      const value = this.predictedRewrite(c); if (value !== null && !acceptsConstraint(c, value)) continue;
      items.push({ p: [x, y], before: c.actual, equal: sorted(c.eq), different: sorted(c.ne), sources: [...c.sources].sort(cmpKey).map(point), action: located[0]!, expected_value: value });
    }
    if (!items.length || remaining <= 0) return null;
    items.sort((a, b) => Number(a.expected_value === null) - Number(b.expected_value === null) || b.sources.length - a.sources.length || cmpPoint(a.p as unknown as Point, b.p as unknown as Point));
    const arr = rows.map(row => [...row]), steps: FieldStep[] = [], places = field.groups.flatMap(g => [...g.keys()].map(point));
    const box = [Math.min(...places.map(p => p[0])) - 1, Math.min(...places.map(p => p[1])) - 1, Math.max(...places.map(p => p[0])) + w, Math.max(...places.map(p => p[1])) + h];
    for (const item of items.slice(0, Math.min(16, remaining))) {
      const [x, y] = item.p as [number, number], expected = item.expected_value;
      const start = await rowsDigest(projection(arr, box));
      if (expected !== null) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) arr[j]![i] = expected;
      steps.push({ action: item.action, expected_before: { level_epoch: obs.level_epoch, frame_hash: steps.length ? null : obs.frame_hash },
        expected_before_rows_digest: start, expected_after: expected === null ? null : await rowsDigest(projection(arr, box)), constraint: item });
      if (expected === null) break;
    }
    const actions = steps.map(s => s.action), focus = 'C_constraint_' + (await digest([obs.observation_ref, this.rule, actions])).slice(0, 18);
    const facts = { measured_instances: true, local_constraint_conflict: true, current_addresses_bound: true };
    const why = 'Test or repair a measured disagreement between local instances of a repeated multiscale relation.';
    const plan: FieldProposal['constraint_plan'] = { rule: structuredClone(this.rule), fit: structuredClone(this.provenance), cell_size: [w, h], lattice_pitch: [...field.pitch], projection_bbox: box,
      selected_cells: steps.map(s => s.constraint), total_violating_cells: [...table.values()].filter(c => !acceptsConstraint(c, c.actual)).length, constraint_count: table.size,
      prediction_scope: 'hypothesized goal; direct property change unverified until measured' };
    const refs = [obs.observation_ref, this.first!, ...(this.prior ? [this.prior.ref] : [])]; this.last = plan;
    return { status: 'proposed', kind: 'public_window_constraint', constraint_plan: plan, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: plan, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'test_measured_multiscale_constraint', hypothesis_refs: refs }, route_refs: refs,
      binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs,
        actions, constraint_forecast: plan, outcome_guard: { path: ['value'], contains: focus } } };
  }
  async before(proposal: FieldProposal, index: number, obs: FieldObservation, rows: Rows): Promise<{ admitted: boolean; reason: string }> {
    const bound = proposal.binding, step = proposal.steps[index]!, c = step.constraint, data = step.action.data, [x, y] = c.p as [number, number], [w, h] = proposal.constraint_plan.cell_size as [number, number];
    const ok = obs.level_epoch === bound.level_epoch && obs.levels_completed === bound.levels_completed && obs.available_action_refs.includes(step.action.action_ref)
      && (index > 0 || obs.observation_ref === bound.observation_ref) && await rowsDigest(projection(rows, proposal.constraint_plan.projection_bbox)) === step.expected_before_rows_digest
      && x <= data.x! && data.x! < x + w && y <= data.y! && data.y! < y + h && rows.slice(y, y + h).every(row => row.slice(x, x + w).every(value => value === c.before));
    return { admitted: ok, reason: ok ? 'current_constraint_and_point_bound' : 'projected_constraint_or_address_changed' };
  }
  bind(proposal: FieldProposal, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0]!.expected_before.frame_hash!;
    for (const step of proposal.steps) {
      const { x, y } = step.action.data;
      const witness = domain.bindings.get(`${proposal.binding.level_epoch}:${frame}`)?.get(`${x},${y}`);
      if (!witness) throw new Error('Current field command lacks its measured point binding');
      step.point_binding = { ...structuredClone(witness), source_frame_hash: frame,
        projected_rows_digest: step.expected_before_rows_digest,
        projection_bbox: proposal.constraint_plan.projection_bbox,
        scope: 'same occurrence conditioned on exact projected field before this command' };
    }
  }
  async after(proposal: FieldProposal, index: number, before: FieldObservation, after: FieldObservation, rows: Rows): Promise<{ matched: boolean | null; seal_prefix: boolean; reason: string }> {
    if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed !== after.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const pred = proposal.steps[index]!.expected_after, matched = pred ? await rowsDigest(projection(rows, proposal.constraint_plan.projection_bbox)) === pred : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: matched ? 'projected_local_rewrite' : 'uncharacterized_or_different_local_effect' };
  }
  record(before: FieldObservation, after: FieldObservation, command: FieldCommand, first: Rows, second: Rows, proposal: FieldProposal, index: number): Record<string, unknown> {
    const plan = proposal.constraint_plan, step = proposal.steps[index]!, c = step.constraint, [x, y] = c.p as [number, number], [w, h] = plan.cell_size as [number, number];
    if (!same(step.action, command) || before.level_epoch !== proposal.binding.level_epoch) throw new Error('Observed rewrite differs from the committed input or epoch');
    if (after.levels_completed > before.levels_completed) {
      if (this.rule) { this.prior = { rule: structuredClone(this.rule), ref: after.observation_ref, score: after.levels_completed }; this.passed.push(this.prior); }
      this.clear(after.level_epoch); return { status: 'official_boundary_witness', evidence: after.observation_ref, transfer_authority: 'hypothesis_only' };
    }
    const values = new Set(second.slice(y, y + h).flatMap(row => row.slice(x, x + w)));
    let outsideChanged = 0, outsideInProjection = 0;
    const [left, top, right, bottom] = plan.projection_bbox as [number, number, number, number];
    for (let yy = 0; yy < first.length; yy++) for (let xx = 0; xx < first[yy]!.length; xx++) {
      if (first[yy]![xx] !== second[yy]![xx] && !(x <= xx && xx < x + w && y <= yy && yy < y + h)) {
        outsideChanged++; if (left <= xx && xx <= right && top <= yy && yy <= bottom) outsideInProjection++;
      }
    }
    const value = [...values][0]!;
    if (values.size !== 1 || value === c.before || outsideInProjection > 0) {
      this.rejected.add(`${x},${y},${c.before}`); return { status: 'no_unique_local_rewrite', address: [x, y], outside_changed: outsideChanged };
    }
    const known = this.effects.get(c.before) ?? []; known.push({ point: key(x, y), value, ref: after.observation_ref }); this.effects.set(c.before, known);
    const repaired = (!c.equal.length || c.equal.includes(value)) && !c.different.includes(value);
    return { status: 'local_rewrite_witness', address: [x, y], before: c.before, after: value, satisfies_frozen_constraint: repaired,
      constraint_refs: c.sources, changes_outside_bound_field: outsideChanged, counterexample_retained: !repaired };
  }
}

export function regularIndices(values: number[]): number[] | null {
  const xs = sorted(new Set(values)); if (xs.length < 3) return null;
  const step = xs[1]! - xs[0]!; return xs.slice(1).every((v, i) => v - xs[i]! === step) ? xs : null;
}
export interface RegularField { xs: number[]; ys: number[]; values: Map<string, number>; size: Point }
export function measuredFields(observation: FieldObservation): RegularField[] {
  const groups = new Map<string, Map<string, number>>();
  for (const entity of observation.entities) {
    const [left, top, right, bottom] = entity.bbox, w = right - left + 1, h = bottom - top + 1;
    if (entity.area === w * h) { const group = groups.get(key(w, h)) ?? new Map<string, number>(); group.set(key(left, top), entity.palette_value); groups.set(key(w, h), group); }
  }
  const result: RegularField[] = [];
  for (const [sizeKey, values] of groups) {
    const [w, h] = point(sizeKey), rows = new Map<string, number[]>();
    for (const k of values.keys()) { const [x, y] = point(k); groupAdd(rows, String(y), x); }
    const aligned = new Map<string, number[]>();
    for (const [y, xs] of rows) groupAdd(aligned, sorted(xs).join(','), Number(y));
    for (const [columns, lines] of aligned) {
      const xs = regularIndices(columns.split(',').map(Number)), ys = regularIndices(lines);
      if (!xs || !ys || xs[1]! - xs[0]! < w || ys[1]! - ys[0]! < h) continue;
      const qualified = new Map<string, number>(); for (const x of xs) for (const y of ys) qualified.set(key(x, y), values.get(key(x, y))!);
      result.push({ xs, ys, values: qualified, size: [w, h] });
    }
  }
  return result;
}
function correspondences(width: number, height: number, family: string): [Point, Point][] {
  const transforms: Record<string, (x: number, y: number) => Point> = {
    horizontal: (x, y) => [width - 1 - x, y], vertical: (x, y) => [x, height - 1 - y], half_turn: (x, y) => [width - 1 - x, height - 1 - y],
  };
  if (width === height) { transforms.diagonal = (x, y) => [y, x]; transforms.antidiagonal = (x, y) => [width - 1 - y, height - 1 - x]; }
  const transform = transforms[family]; if (!transform) return [];
  const result: [Point, Point][] = [];
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) { const other = transform(x, y); if (cmpPoint([x, y], other) < 0) result.push([[x, y], other]); }
  return result;
}
export function symmetryEvidence(field: RegularField, family: string): [ConstraintTable, Record<string, unknown>] | null {
  const { xs, ys, values } = field;
  const pairs = correspondences(xs.length, ys.length, family).map(([[x, y], [u, v]]) => [key(xs[x]!, ys[y]!), key(xs[u]!, ys[v]!)] as [string, string]);
  const equal = pairs.filter(([a, b]) => values.get(a) === values.get(b)), conflicts = pairs.filter(([a, b]) => values.get(a) !== values.get(b));
  const ordinary = new Set(equal.map(([a]) => values.get(a)!));
  if (!conflicts.length || ordinary.size < 2 || equal.length <= conflicts.length) return null;
  const desired: ConstraintTable = new Map();
  for (const [a, b] of conflicts) {
    const supported = [a, b].filter(q => ordinary.has(values.get(q)!)); if (supported.length !== 1) return null;
    const source = supported[0]!, target = source === a ? b : a;
    desired.set(target, { actual: values.get(target)!, eq: new Set([values.get(source)!]), ne: new Set(), sources: new Set([source]) });
  }
  return [desired, { unchanged_pairs: equal.length, contrast_pairs: conflicts.length, ordinary_values: sorted(ordinary), exceptional_values: sorted(new Set([...desired.values()].map(c => c.actual))) }];
}
function* combinations<T>(items: T[], count: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === count) { yield prefix; return; }
  for (let i = start; i <= items.length - count + prefix.length; i++) yield* combinations(items, count, i + 1, [...prefix, items[i]!]);
}
export function* periodicHypotheses(field: RegularField, maximumOmitted: number): Generator<[string, ConstraintTable, Record<string, unknown>]> {
  const { xs, ys, values } = field, palette = sorted(new Set(values.values()));
  for (let count = 1; count <= Math.min(maximumOmitted, palette.length - 2); count++) for (const omitted of combinations(palette, count)) {
    const excluded = new Set(omitted);
    for (let px = 1; px <= Math.floor(xs.length / 2); px++) for (let py = 1; py <= Math.floor(ys.length / 2); py++) {
      const classes = new Map<string, string[]>();
      for (let ix = 0; ix < xs.length; ix++) for (let iy = 0; iy < ys.length; iy++) groupAdd(classes, key(ix % px, iy % py), key(xs[ix]!, ys[iy]!));
      const desired: ConstraintTable = new Map(), ordinary = new Set<number>(); let intact = 0, valid = true;
      for (const cells of classes.values()) {
        const witnesses = cells.filter(cell => !excluded.has(values.get(cell)!)), colors = new Set(witnesses.map(cell => values.get(cell)!));
        if (witnesses.length < 2 || colors.size !== 1) { valid = false; break; }
        const expected = [...colors][0]!; ordinary.add(expected); intact += witnesses.length;
        for (const cell of cells) if (values.get(cell) !== expected) desired.set(cell, { actual: values.get(cell)!, eq: new Set([expected]), ne: new Set(), sources: new Set(witnesses) });
      }
      if (valid && desired.size && ordinary.size >= 2 && intact > desired.size) yield [`period:${px}:${py}`, desired, {
        unchanged_pairs: intact, contrast_pairs: desired.size, ordinary_values: sorted(ordinary), exceptional_values: sorted(excluded), hypothetically_omitted_values: sorted(excluded), period_in_cells: [px, py], minimum_independent_witnesses_per_class: 2,
      }];
    }
  }
}
export interface SymmetryPolicy { isometries: string[]; maximum_hypothetically_omitted_values?: number; question: string; exclude_observed_control_interface?: boolean }
export class SymmetricField extends WindowConstraints {
  override readonly familyId = 'regular_field_correspondence';
  private readonly policy: SymmetryPolicy;
  private tests = new Map<string, number>();
  constructor(policy: SymmetryPolicy) { super(); this.policy = structuredClone(policy); }
  override state(): Record<string, unknown> { return { ...super.state(), tests: [...this.tests] }; }
  override restore(snapshot: Record<string, unknown>): void {
    if (!Array.isArray(snapshot.tests)) throw new TypeError('Symmetric-field witnesses are missing');
    super.restore(snapshot); this.tests = new Map(structuredClone(snapshot.tests) as [string, number][]);
  }
  protected override clear(epoch: number): void { super.clear(epoch); this.tests.clear(); }
  protected override fit(obs: FieldObservation, _rows: Rows): [MeasuredField, ConstraintTable] | null {
    const hypotheses: { shape: unknown[]; family: string; field: MeasuredField; table: ConstraintTable; counts: Record<string, unknown> }[] = [];
    for (const measured of measuredFields(obs)) {
      const { xs, ys, values, size } = measured, shape = [xs[0]!, ys[0]!, xs.length, ys.length, [...size]];
      const field: MeasuredField = { size, pitch: [xs[1]! - xs[0]!, ys[1]! - ys[0]!], groups: [new Map([...values].map(([k, value]) => [k, { value }]))] };
      for (const family of this.policy.isometries) {
        if (this.rule && (!('lattice' in this.rule) || !same([this.rule.lattice, this.rule.family], [shape, family]))) continue;
        const fit = symmetryEvidence(measured, family); if (fit) hypotheses.push({ shape, family, field, table: fit[0], counts: fit[1] });
      }
      for (const [family, table, counts] of periodicHypotheses(measured, this.policy.maximum_hypothetically_omitted_values ?? 0)) {
        if (this.rule && (!('lattice' in this.rule) || !same([this.rule.lattice, this.rule.family], [shape, family]))) continue;
        hypotheses.push({ shape, family, field, table, counts });
      }
    }
    if (!hypotheses.length) return null;
    const forecasts = hypotheses.map(h => [...h.table].sort((a, b) => cmpKey(a[0], b[0])).map(([p, c]) => [point(p), [...c.eq][0]!]));
    const distinct = new Map(forecasts.map(f => [canonical(f), f]));
    const selected = hypotheses[0]!; let table = selected.table;
    if (distinct.size !== 1) {
      const sets = [...distinct.values()].map(f => new Set(f.map(canonical)));
      const common = new Set([...sets[0]!].filter(item => sets.every(s => s.has(item))));
      if (!common.size || new Set(hypotheses.map(h => canonical(h.shape))).size !== 1) return null;
      table = new Map([...table].filter(([p, c]) => common.has(canonical([point(p), [...c.eq][0]!])))); this.rule = null;
    } else this.rule = { lattice: selected.shape, family: selected.family };
    this.first ??= obs.observation_ref;
    this.provenance = { method: 'tested_regular_field_correspondence', geometries: hypotheses.map(h => h.family), ...selected.counts,
      unanimous_corrections: table.size, unresolved_prediction_disagreement: distinct.size > 1, observation: obs.observation_ref };
    return [selected.field, table];
  }
  protected override predictedRewrite(constraint: Constraint): number | null { return new Set(this.tests.values()).size < 2 ? null : [...constraint.eq][0]!; }
  override async propose(obs: FieldObservation, rows: Rows, inputs: readonly FieldCommand[], remaining: number): Promise<FieldProposal | null> {
    const proposal = await super.propose(obs, rows, inputs, remaining);
    if (proposal) { proposal.kind = 'public_symmetric_field'; proposal.question.reason = this.policy.question; proposal.bundle_template.purpose = this.policy.question; }
    return proposal;
  }
  override record(before: FieldObservation, after: FieldObservation, command: FieldCommand, first: Rows, second: Rows, proposal: FieldProposal, index: number): Record<string, unknown> {
    const result = super.record(before, after, command, first, second, proposal, index);
    if (result.status === 'local_rewrite_witness') {
      if (result.satisfies_frozen_constraint) this.tests.set((result.address as number[]).join(','), result.after as number);
      else { this.tests.clear(); this.deactivated = true; }
    }
    return result;
  }
}
