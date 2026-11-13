/** Native transfer of V6 visual_sequences/{measure,programs,family}.py. */
import { canonical } from './canonical.ts';
import { v6Digest, ObservedInputDomain } from './v6-native-observer.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeObservation, NativePublicObservation, NativeRows, NativeCommand, NativeRecord, NativeProposal, NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { JsonValue } from './ir.ts';

type Raster = readonly (readonly number[])[];
type Mask = readonly (readonly boolean[])[];
type Point = readonly [number, number];
type Box = readonly [number, number, number, number];
type Explanation = Record<string, unknown>;
interface Configuration { maximum_cycle: number; rotation_steps: number[]; maximum_layers: number; geometry_families: string[]; numeric_families: string[]; question: string }
interface FrameBox { box: Box; border: number; size: Point }
interface Question { row: number; missing: number; boxes: Box[]; rasters: Raster[] }
interface Layout { active: Question; grid: Box[][]; options: { box: Box; raster: Raster }[]; background: number; question_ref: string; grid_digest: string }
interface Inference extends Record<string, unknown> { status: string; question_ref?: string; missing_rank?: number; compatible_options?: { index: number; why: Explanation; raster_sha: string }[] }
interface SequencePlan extends Record<string, unknown> {
  trial: string; question_ref: string; grid: Box[][]; row: number; missing_rank: number; target_box: Box; option_box: Box;
  expected_raster: Raster; inference: Inference; workflow: Record<string, unknown>; control_status: string;
}
export interface VisualSequenceProposal extends NativeProposal {
  status: 'proposed'; kind: 'public_visual_sequence'; actions: NativeCommand[];
  steps: { action: NativeCommand; expected_before: { level_epoch: number; frame_hash: string }; expected_after: null; point_binding?: unknown }[];
  facts: Record<string, boolean>; binding: { observation_ref: string; level_epoch: number; levels_completed: number; frame_hash: string };
  sequence_plan: SequencePlan; compositions: NativeRecord[]; question: { reason: string; hypothesis_refs: string[] }; route_refs: string[];
  bundle_template: { operation_key: string; composition_ref: string; objective_ref: string; preserve_refs: string[]; purpose: string; preconditions: Record<string, boolean>; evidence: string[]; actions: NativeCommand[]; outcome_guard: { path: string[]; contains: string } };
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const pkey = (x: number, y: number): string => `${x},${y}`;
const point = (k: string): Point => { const [x, y] = k.split(',').map(Number); return [x!, y!]; };
const sorted = (values: Iterable<number>): number[] => [...values].sort((a, b) => a - b);
const modulo = (a: number, n: number): number => (a % n + n) % n;
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
const json = (v: unknown): JsonValue => v as JsonValue;
const addGroup = <K, V>(groups: Map<K, V[]>, k: K, value: V): void => { const xs = groups.get(k) ?? []; xs.push(value); groups.set(k, xs); };

export function visualFrameBoxes(observation: NativeObservation): FrameBox[] {
  const boxes: FrameBox[] = [];
  for (const e of observation.entities) {
    const [l, t, r, b] = e.bbox, w = r - l + 1, h = b - t + 1;
    if (w < 4 || h < 4 || e.area !== 2 * w + 2 * h - 4) continue;
    const expected = new Set<string>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || x === w - 1 || y === 0 || y === h - 1) expected.add(pkey(x, y));
    if (e.mask.length === expected.size && e.mask.every(([x, y]) => expected.has(pkey(x, y)))) boxes.push({ box: [l, t, r, b], border: e.palette_value, size: [w, h] });
  }
  return boxes;
}
export function visualInterior(rows: NativeRows, box: Box): number[][] {
  const [l, t, r, b] = box; return rows.slice(t + 1, b).map(row => row.slice(l + 1, r));
}
export async function visualLayout(observation: NativeObservation, rows: NativeRows): Promise<Layout | null> {
  const groups = new Map<string, FrameBox[]>(), matrix = new Map<string, FrameBox[][]>(), counts = new Map<number, number>();
  for (const box of visualFrameBoxes(observation)) addGroup(groups, canonical([box.size, box.box[1]]), box);
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.box[0] - b.box[0]), xs = ordered.map(b => b.box[0]);
    if (xs.length < 3 || new Set(xs.slice(1).map((x, i) => x - xs[i]!)).size !== 1) continue;
    addGroup(matrix, canonical([ordered[0]!.size, xs]), ordered);
  }
  for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  const background = [...counts].sort((a, b) => b[1] - a[1])[0]![0], candidates: Layout[] = [];
  for (const rawLines of matrix.values()) {
    if (rawLines.length < 2) continue;
    const lines = [...rawLines].sort((a, b) => a[0]!.box[1] - b[0]!.box[1]), ys = lines.map(line => line[0]!.box[1]), size = lines[0]![0]!.size;
    if (new Set(ys.slice(1).map((y, i) => y - ys[i]!)).size !== 1) continue;
    const options = [...groups.values()].filter(group => equal(group[0]!.size, size) && !ys.includes(group[0]!.box[1]) && group.length >= 2)
      .map(group => [...group].sort((a, b) => a.box[0] - b.box[0]));
    if (options.length !== 1) continue;
    const active: Question[] = [];
    for (let row = 0; row < lines.length; row++) {
      const line = lines[row]!, rasters = line.map(b => visualInterior(rows, b.box));
      const missing = rasters.flatMap((raster, i) => raster.every(row => row.every(v => v === background)) ? [i] : []);
      if (missing.length !== 1) continue;
      const index = missing[0]!, surround = new Set(line.filter((_, i) => i !== index).map(b => b.border));
      if (surround.size === 1 && !surround.has(line[index]!.border)) active.push({ row, missing: index, boxes: line.map(b => b.box), rasters });
    }
    if (active.length === 1) candidates.push({ active: active[0]!, grid: lines.map(line => line.map(b => b.box)), options: options[0]!.map(b => ({ box: b.box, raster: visualInterior(rows, b.box) })),
      background, question_ref: 'question:' + await v6Digest([observation.level_epoch, active[0]!.boxes]), grid_digest: await v6Digest(lines.map(line => line.map(b => visualInterior(rows, b.box)))) });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

/** Unchanged finite-value laws of the V5 kernel, including its refusal cases. */
export interface FeatureProgram {
  law_ref: string; cycle_values?: readonly (number | string)[]; cycle_origin?: number;
  start?: number | null; step?: number | null; increment_step?: number | null; lower?: number | null; upper?: number | null;
}
export function featureValue(program: FeatureProgram, rank: number | null): number | string | null {
  if (rank === null) return null;
  if (!Number.isSafeInteger(rank) || rank < 0) throw new Error('NEGATIVE_CLOCK_RANK_UNSUPPORTED');
  if (program.law_ref === 'finite_cyclic_value') {
    const cycle = program.cycle_values ?? [], origin = program.cycle_origin ?? 0;
    if (!cycle.length || origin >= cycle.length) throw new Error('FINITE_CYCLE_OR_ORIGIN_MISSING');
    return cycle[(origin + rank) % cycle.length]!;
  }
  if (program.start === null || program.start === undefined || program.step === null || program.step === undefined) throw new Error('NUMERIC_TRANSFORMATION_PARAMETERS_MISSING');
  if (program.law_ref === 'arithmetic_value') return program.start + rank * program.step;
  if (program.law_ref === 'cumulative_arithmetic_increment') {
    if (program.increment_step === null || program.increment_step === undefined) throw new Error('CUMULATIVE_INCREMENT_LAW_MISSING');
    return program.start + rank * program.step + Math.floor(rank * (rank - 1) / 2) * program.increment_step;
  }
  if (program.law_ref === 'reflected_bounded_value') {
    if (program.lower === null || program.lower === undefined || program.upper === null || program.upper === undefined || program.upper < program.lower) throw new Error('BOUNCE_BOUNDS_MISSING');
    const span = program.upper - program.lower; if (!span) return program.lower;
    const phase = modulo(program.start + rank * program.step - program.lower, 2 * span);
    return program.lower + (phase <= span ? phase : 2 * span - phase);
  }
  throw new Error('SUPPLIED_TRANSFORMATION_FAMILY_UNSUPPORTED');
}
export function cyclicPredictions<T extends number | string>(values: readonly (T | null)[], index: number, maximum: number): [T, Explanation][] {
  const known = values.flatMap((v, i) => v === null ? [] : [[i, v] as const]), answer: [T, Explanation][] = [];
  for (let period = 1; period <= Math.min(maximum, Math.floor(values.length / 2)); period++) {
    const residues = Array.from({ length: period }, (_, r) => new Set(known.filter(([i]) => i % period === r).map(([, v]) => v)));
    if (residues.some(v => v.size !== 1) || known.length - period < 2) continue;
    const cycle = residues.map(v => [...v][0]!);
    if (known.every(([i, v]) => cycle[i % period] === v)) answer.push([cycle[index % period]!, { law: 'finite_cyclic_value', period, support_ranks: known.map(([i]) => i) }]);
  }
  return answer;
}
export function numericPredictions(values: readonly (number | null)[], index: number, config: Configuration): [number, Explanation][] {
  const known = new Map(values.flatMap((v, i) => v === null ? [] : [[i, v] as const])), answer = cyclicPredictions(values, index, config.maximum_cycle);
  if (known.size < 3) return answer;
  const first = Math.min(...known.keys()), last = Math.max(...known.keys()), delta = (known.get(last)! - known.get(first)!) / (last - first);
  if (Number.isInteger(delta)) {
    const start = known.get(first)! - first * delta;
    if ([...known].every(([i, value]) => start + i * delta === value)) answer.push([start + index * delta, { law: 'arithmetic_value', step: delta, start }]);
  }
  const differences = new Set([...known].flatMap(([i, v]) => known.has(i + 1) ? [known.get(i + 1)! - v] : []));
  if ([...differences].some(x => x > 0) && [...differences].some(x => x < 0)) {
    const lower = Math.min(...known.values()), upper = Math.max(...known.values());
    for (const step of sorted(new Set([...differences].filter(Boolean).map(Math.abs)))) for (const direction of [-step, step]) for (let start = lower; start <= upper; start++) {
      const program: FeatureProgram = { law_ref: 'reflected_bounded_value', start, step: direction, lower, upper };
      if ([...known].every(([i, v]) => featureValue(program, i) === v)) answer.push([featureValue(program, index) as number, { law: 'reflected_bounded_value', lower, upper, step: direction, start }]);
    }
  }
  return answer.filter(([, why]) => config.numeric_families.includes(why.law as string));
}
export function rotatedMask(mask: Mask, turns: number): Mask {
  let result = mask.map(row => [...row]);
  for (let i = 0; i < modulo(turns, 4); i++) result = Array.from({ length: result[0]!.length }, (_, x) => result.map(row => row[x]!).reverse());
  return result;
}
function maskComponents(mask: Mask): Set<string>[] {
  const cells = new Set<string>(), groups: Set<string>[] = [];
  for (let y = 0; y < mask.length; y++) for (let x = 0; x < mask[y]!.length; x++) if (mask[y]![x]) cells.add(pkey(x, y));
  while (cells.size) {
    const seed = cells.values().next().value!, stack = [seed], part = new Set(stack); cells.delete(seed);
    while (stack.length) {
      const [x, y] = point(stack.pop()!);
      for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const q = pkey(a!, b!); if (cells.delete(q)) { part.add(q); stack.push(q); }
      }
    }
    groups.push(part);
  }
  return groups;
}
function normalizedUnit(part: Set<string>): Point[] {
  const points = [...part].map(point), x = Math.min(...points.map(p => p[0])), y = Math.min(...points.map(p => p[1]));
  return points.map(([a, b]) => [a - x, b - y] as Point).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export function fillEnclosed(mask: Mask): Mask {
  const h = mask.length, w = mask[0]!.length, outside = new Set<string>(), queue: Point[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && !mask[y]![x]) { outside.add(pkey(x, y)); queue.push([x, y]); }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as Point[]) {
      const q = pkey(a, b); if (a >= 0 && a < w && b >= 0 && b < h && !mask[b]![a] && !outside.has(q)) { outside.add(q); queue.push([a, b]); }
    }
  }
  return mask.map((row, y) => row.map((v, x) => v || !outside.has(pkey(x, y))));
}
export async function maskPredictions(masks: readonly (Mask | null)[], index: number, candidate: Mask, config: Configuration, allowFill = true): Promise<Explanation[]> {
  const known = new Map(masks.flatMap((m, i) => m === null ? [] : [[i, m] as const])), proof: Explanation[] = [];
  if (!known.size) return proof;
  const refs = await Promise.all(masks.map(m => m === null ? null : v6Digest(m))), candidateHash = await v6Digest(candidate);
  for (const [predicted, why] of cyclicPredictions(refs, index, config.maximum_cycle)) if (predicted === candidateHash) proof.push({ model: 'mask_cycle', ...why });
  const origin = Math.min(...known.keys()), base = known.get(origin)!;
  if (base.length === base[0]!.length) for (const step of config.rotation_steps) {
    const values = await Promise.all([0, 1, 2, 3].map(i => v6Digest(rotatedMask(base, (i - origin) * step))));
    if ([...known.keys()].every(i => values[i % 4] === refs[i]) && values[index % 4] === candidateHash) proof.push({ model: 'rigid_card_rotation', quarter_turn_step: step, support_ranks: [...known.keys()] });
  }
  const solid = (mask: Mask): [number, number, number, number] | null => {
    const points: Point[] = []; for (let y = 0; y < mask.length; y++) for (let x = 0; x < mask[y]!.length; x++) if (mask[y]![x]) points.push([x, y]);
    if (!points.length) return null;
    const l = Math.min(...points.map(p => p[0])), r = Math.max(...points.map(p => p[0])), t = Math.min(...points.map(p => p[1])), b = Math.max(...points.map(p => p[1]));
    return points.length === (r - l + 1) * (b - t + 1) ? [r - l + 1, b - t + 1, l + r, t + b] : null;
  };
  const bounds = new Map([...known].map(([i, m]) => [i, solid(m)])), target = solid(candidate), nonnull = [...bounds.values()].filter(v => v !== null);
  if (target && nonnull.length === bounds.size && new Set(nonnull.map(b => canonical(b.slice(2)))).size === 1 && equal(target.slice(2), nonnull[0]!.slice(2))) {
    const axes = [0, 1].map(axis => numericPredictions(masks.map((m, i) => m === null ? null : bounds.get(i)![axis]!), index, config).filter(([value]) => value === target[axis]).map(([, why]) => why));
    if (axes.every(a => a.length)) proof.push({ model: 'center_preserving_solid_rectangle', width_laws: axes[0], height_laws: axes[1] });
  }
  const groups = new Map([...known].map(([i, m]) => [i, maskComponents(m)])), targetParts = maskComponents(candidate);
  const pieces = new Map<string, Point[]>(); for (const parts of groups.values()) for (const p of parts) { const u = normalizedUnit(p); pieces.set(canonical(u), u); }
  const targetPieces = new Set(targetParts.map(p => canonical(normalizedUnit(p))));
  if (pieces.size === 1 && [...groups.values()].some(p => p.length > 1) && targetParts.length && targetPieces.size === 1 && targetPieces.has([...pieces.keys()][0]!)) {
    const counts = masks.map((m, i) => m === null ? null : groups.get(i)!.length), forecasts = numericPredictions(counts, index, config).filter(([value]) => value === targetParts.length).map(([, why]) => why);
    const anchor = (p: Set<string>): Point => { const coords = [...p].map(point); return [Math.min(...coords.map(c => c[0])), Math.min(...coords.map(c => c[1]))]; };
    const anchors = [...groups.values()].flatMap(parts => parts.map(anchor)), phases = [0, 1].map(axis => { const coords = sorted(new Set(anchors.map(a => a[axis]!))); return [coords[0]!, coords.slice(1).map((v, i) => v - coords[i]!).reduce(gcd, 0)] as const; });
    const compatible = targetParts.map(anchor).every(v => phases.every(([start, pitch], axis) => pitch === 0 ? v[axis] === start : modulo(v[axis]! - start, pitch) === 0));
    if (forecasts.length && compatible) proof.push({ model: 'identical_unit_count_on_measured_lattice', count_laws: forecasts, unit: [...pieces.values()][0], layout_scope: 'lattice phase; no arbitrary unseen spatial arrangement claimed' });
  }
  if (allowFill && config.geometry_families.includes('shape_and_enclosed_fill')) {
    const filled = masks.map(m => m === null ? null : fillEnclosed(m)), targetFilled = fillEnclosed(candidate), flags = masks.map((m, i) => m === null ? null : Number(equal(m, filled[i])));
    if (new Set(flags.filter(v => v !== null)).size > 1) {
      const fillLaws = cyclicPredictions(flags, index, config.maximum_cycle).filter(([v]) => v === Number(equal(candidate, targetFilled))).map(([, why]) => why);
      const shapeLaws = await maskPredictions(filled, index, targetFilled, config, false);
      if (fillLaws.length && shapeLaws.length) proof.push({ model: 'shape_and_enclosed_fill', fill_laws: fillLaws, outer_shape_laws: shapeLaws, scope: 'four-connected exterior distinguishes enclosed empty regions; no named shape table' });
    }
  }
  return proof.filter(p => config.geometry_families.includes(p.model as string));
}
export async function explainVisual(rasters: readonly (Raster | null)[], index: number, candidate: Raster, background: number, configuration: Configuration): Promise<Explanation | null> {
  const palette = (r: Raster) => new Set(r.flat().filter(v => v !== background));
  const known = rasters.filter(r => r !== null), palettes = known.map(palette), targetPalette = palette(candidate);
  const binary = (r: Raster, p: Set<number>): Mask => r.map(row => row.map(v => p.has(v)));
  if (palettes.every(p => p.size === 1) && targetPalette.size === 1) {
    const colors = rasters.map(r => r === null ? null : [...palette(r)][0]!), predicted = cyclicPredictions(colors, index, configuration.maximum_cycle).filter(([value]) => value === [...targetPalette][0]).map(([, why]) => why);
    const masks = rasters.map(r => r === null ? null : binary(r, palette(r))), forms = await maskPredictions(masks, index, binary(candidate, targetPalette), configuration);
    return predicted.length && forms.length ? { decomposition: 'independent_single_color_and_binary_geometry', color_laws: predicted, geometry_laws: forms } : null;
  }
  const union = new Set(palettes.flatMap(p => [...p]));
  if (!union.size || union.size > configuration.maximum_layers || [...targetPalette].some(v => !union.has(v))) return null;
  const layers: Explanation[] = [];
  for (const color of sorted(union)) {
    const laws = await maskPredictions(rasters.map(r => r === null ? null : binary(r, new Set([color]))), index, binary(candidate, new Set([color])), configuration);
    if (!laws.length) return null; layers.push({ palette_value: color, laws });
  }
  return { decomposition: 'independent_observed_palette_layers', layers };
}

export class VisualSequences {
  readonly id = 'visual_sequences';
  private readonly config: Configuration;
  private src: Promise<NativeProgramHandle>;
  private failed = new Set<string>();
  private events: NativeRecord[] = [];
  private context: { observation: NativeObservation; rows: NativeRows; inputs: readonly NativeCommand[]; remaining: number } | null = null;
  private layout: Layout | null = null;
  private selected: { action: NativeCommand; key: string; option: Layout['options'][number]; inference: Inference } | null = null;
  last: Inference | null = null;
  constructor() {
    const source = (V6_DECLARATIVE_SOURCES as unknown as Record<string, { text: string }>)['agents/yf_arc3_v6/morphology_policy/visual_sequences/visual_sequences.drm']!;
    this.config = JSON.parse(source.text).declarations[0].configuration as Configuration;
    this.src = NativeSrcProgram.create('v6.visual_sequences.choose', this.callbacks());
  }
  private callbacks() {
    return {
      'sequence.measure': async () => json(await this.measure()),
      'sequence.infer': async (args: import('./ir.ts').JsonObject) => json(await this.infer(args.measured as unknown as { qualified: boolean; remaining: number })),
      'sequence.bind': async (args: import('./ir.ts').JsonObject) => json(await this.select(args.inferred as unknown as Inference)),
    };
  }
  async attachPrograms(registry: NativeProgramRegistry): Promise<void> {
    this.src = registry.registerProgram('v6.visual_sequences.choose', this.callbacks());
    await this.src;
  }
  private async measure(): Promise<{ qualified: boolean; remaining: number }> {
    const ctx = this.context!; this.layout = await visualLayout(ctx.observation, ctx.rows); return { qualified: this.layout !== null, remaining: ctx.remaining };
  }
  private async infer(measured: { qualified: boolean; remaining: number }): Promise<Inference> {
    if (!measured.qualified || measured.remaining < 1) return { status: 'no_bound_question' };
    const lay = this.layout!, q = lay.active, cards: (Raster | null)[] = [...q.rasters], options: NonNullable<Inference['compatible_options']> = []; cards[q.missing] = null;
    for (let i = 0; i < lay.options.length; i++) {
      const option = lay.options[i]!, why = await explainVisual(cards, q.missing, option.raster, lay.background, this.config);
      if (why) options.push({ index: i, why, raster_sha: await v6Digest(option.raster) });
    }
    this.last = { status: options.length === 1 ? 'unique' : options.length ? 'ambiguous' : 'no_supported_declared_model', question_ref: lay.question_ref, missing_rank: q.missing, compatible_options: options,
      grammar_scope: 'declared bounded feature laws; neither arbitrary law induction nor uniqueness of generating mechanism' };
    return this.last;
  }
  private async select(inferred: Inference): Promise<{ selected: boolean; reason: string }> {
    if (inferred.status !== 'unique') return { selected: false, reason: inferred.status };
    const ctx = this.context!, lay = this.layout!, choice = inferred.compatible_options![0]!, option = lay.options[choice.index]!;
    const key = await v6Digest([ctx.observation.level_epoch, lay.question_ref, lay.grid_digest, choice.raster_sha]);
    if (this.failed.has(key)) return { selected: false, reason: 'same_answer_acceptance_unconfirmed' };
    const [l, t, r, b] = option.box, points = ctx.inputs.filter(a => a.data.x !== undefined && l < a.data.x && a.data.x < r && t < a.data.y! && a.data.y! < b);
    if (!points.length) return { selected: false, reason: 'no_current_option_locus' };
    const cost = (a: NativeCommand): number => (2 * a.data.x! - l - r) ** 2 + (2 * a.data.y! - t - b) ** 2;
    const action = [...points].sort((a, b) => cost(a) - cost(b) || a.data.y! - b.data.y! || a.data.x! - b.data.x!)[0]!;
    this.selected = { action, key, option, inference: inferred }; return { selected: true, reason: 'unique_option_on_all_supported_feature_relations' };
  }
  async propose(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number): Promise<VisualSequenceProposal | null> {
    this.context = { observation: obs, rows, inputs, remaining };
    const { result, receipt } = await (await this.src).run({ request: { observation_ref: obs.observation_ref } });
    if (!(result as unknown as { selected: boolean }).selected) return null;
    const picked = this.selected!, lay = this.layout!, q = lay.active, action = picked.action, focus = 'composition:visual_answer:' + (await v6Digest([obs.observation_ref, picked.key])).slice(0, 20);
    const facts = { indexed_question_current: true, unique_supported_option: true }, evidence = [obs.observation_ref];
    const workflow = { workflow: receipt.workflow, src_hash: receipt.src_hash, src_status: receipt.src_status, executed_statements: receipt.executed_statements };
    return { status: 'proposed', kind: 'public_visual_sequence', actions: [action], steps: [{ action, expected_before: { level_epoch: obs.level_epoch, frame_hash: obs.frame_hash }, expected_after: null }], facts,
      binding: { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, levels_completed: obs.levels_completed, frame_hash: obs.frame_hash },
      sequence_plan: { trial: picked.key, question_ref: lay.question_ref, grid: lay.grid, row: q.row, missing_rank: q.missing, target_box: q.boxes[q.missing]!, option_box: picked.option.box,
        expected_raster: picked.option.raster, inference: picked.inference, workflow, control_status: 'pointed_option_submission_unconfirmed_until_observed' },
      compositions: [{ id: focus, role: 'information_question', observed: false, things: ['indexed_cards', 'missing_rank', 'visible_option'], properties: { feature_constraints: picked.inference, preserve: 'other_card_contents' }, relations: ['contributes_to:G_official_completion'], open_question: this.config.question }],
      question: { reason: this.config.question, hypothesis_refs: evidence }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: this.config.question, preconditions: facts, evidence, actions: [action], outcome_guard: { path: ['value'], contains: focus } } };
  }
  async proposeContinuation(obs: NativeObservation, rows: NativeRows, inputs: readonly NativeCommand[], remaining: number, minimumRows: number): Promise<VisualSequenceProposal | null> {
    const seen = this.events.filter(e => e.status === 'observed_row_completion' && e.other_cards_preserved && e.expected_card_filled), boundaries = this.events.filter(e => e.status === 'official_boundary');
    if (new Set(seen.map(e => e.question)).size < minimumRows || !boundaries.length) return null;
    const proposal = await this.propose(obs, rows, inputs, remaining); if (!proposal) return null;
    const witnesses = [...seen.slice(-minimumRows).map(e => e.evidence as string), boundaries.at(-1)!.evidence as string];
    proposal.facts.visual_answer_method_recalled = true; proposal.bundle_template.preconditions.visual_answer_method_recalled = true;
    proposal.bundle_template.evidence.push(...witnesses); proposal.sequence_plan.continuation_witnesses = witnesses; return proposal;
  }
  bind(proposal: VisualSequenceProposal, domain: ObservedInputDomain): void { domain.bindProposal(proposal as unknown as Parameters<ObservedInputDomain['bindProposal']>[0]); }
  before(proposal: VisualSequenceProposal, index: number, publicPacket: NativePublicObservation, obs: NativeObservation) {
    const p = proposal.binding, step = proposal.steps[index]!, action = proposal.actions[index]!, plan = proposal.sequence_plan, point = action.data, [l, t, r, b] = plan.option_box;
    const ok = publicPacket.level === p.level_epoch && publicPacket.levels_completed === p.levels_completed && publicPacket.frame_hash === p.frame_hash && obs.observation_ref === p.observation_ref
      && equal(action, step.action) && publicPacket.available_action_refs.includes(action.action_ref) && l < (point.x ?? -1) && (point.x ?? -1) < r && t < (point.y ?? -1) && (point.y ?? -1) < b
      && equal(visualInterior(publicPacket.frame_rows, plan.option_box), plan.expected_raster);
    return { admitted: ok, reason: ok ? 'current_question_and_option_bound' : 'sequence_or_option_scope_changed' };
  }
  after(_proposal: VisualSequenceProposal, _index: number, _before: NativeObservation, _after: NativeObservation, _first: NativeRows, _second: NativeRows) {
    return { matched: null, seal_prefix: true, reason: 'observe_answer_acceptance_or_boundary' };
  }
  record(before: NativeObservation, after: NativeObservation, command: NativeCommand, first: NativeRows, second: NativeRows, proposal: VisualSequenceProposal, index: number): NativeRecord {
    if (!equal(command, proposal.actions[index]) || before.observation_ref !== proposal.binding.observation_ref) throw new Error('Unbound visual answer response');
    const p = proposal.sequence_plan; let event: NativeRecord;
    if (after.levels_completed > before.levels_completed) event = { status: 'official_boundary', evidence: after.observation_ref, question: p.question_ref, scope: 'transition corroborates the attempted final answer; necessity not inferred' };
    else {
      const preserved = p.grid.flat().filter(box => !equal(box, p.target_box)).every(box => equal(visualInterior(first, box), visualInterior(second, box)));
      const filled = equal(visualInterior(second, p.target_box), p.expected_raster);
      event = { status: filled && preserved ? 'observed_row_completion' : 'answer_acceptance_unconfirmed', evidence: after.observation_ref, question: p.question_ref, other_cards_preserved: preserved, expected_card_filled: filled };
      if (!filled || !preserved) this.failed.add(p.trial);
    }
    event.tested_relations = p.inference; this.events.push(event); return event;
  }
  state(): NativeRecord { return structuredClone({ failed: [...this.failed].sort(), events: this.events }); }
  restore(state: NativeRecord): void {
    if (!Array.isArray(state.failed) || !state.failed.every(x => typeof x === 'string') || !Array.isArray(state.events)) throw new TypeError('Invalid visual-sequence memory');
    this.failed = new Set(state.failed); this.events = structuredClone(state.events) as NativeRecord[];
  }
}
