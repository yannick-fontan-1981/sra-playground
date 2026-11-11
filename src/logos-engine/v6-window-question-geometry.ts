/** Pinned WindowQuestion measurement and conditional static coverage.
 * Source: morphology_policy/window_question/geometry.py at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. A visible box is not an acquired
 * capture law, and reading order is not an observed rail or beat model.
 */
import { components, RecolorWorkBudget } from './v6-topological-recolor-geometry.ts';
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy } from './v6-operations.ts';
import { normalizeTrainRank, normalizeWindowReceiver, normalizeWindowBeatState, windowEligibility, processOneBeat } from './v5-window-processing.ts';
import type { TrainRankD } from './v5-window-processing.ts';
import type { NativeExecution, NativeRows } from './v6-native-types.ts';

export type WindowMeasurement = Record<string, any>;
type R = WindowMeasurement;
export type WindowSettings = (readonly [number, number | null, number | null])[];
export type WindowPlanResult = [R[], R];
export const digest = symbolicDigest;

/** Counter.most_common keeps the first inserted value on a count tie. */
function dominant(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: number | undefined, highest = -1;
  for (const [value, count] of counts) if (count > highest) { best = value; highest = count; }
  if (best === undefined) throw new TypeError('A source Counter requires a nonempty field');
  return best;
}
const coordinateKey = (x: number, y: number): string => `${x},${y}`;
const modulo = (n: number, d: number): number => ((n % d) + d) % d;
const pythonScalar = (value: unknown): string => value === null ? 'None' : value === true ? 'True' : value === false ? 'False' : String(value);

export function measure(rows: NativeRows | null | undefined): R | null {
  if (!rows?.length || !rows[0]?.length) return null;
  const cc = components(rows), boxes: R[] = [];
  for (const component of cc) {
    const [l, t, r, b] = component.bbox as number[], w = r! - l! + 1, h = b! - t! + 1;
    if (h < 6 || w < 2 * h || w > 3 * h) continue;
    const cells = new Set<string>((component.cells as number[][]).map(([x, y]) => coordinateKey(x!, y!)));
    let ring = true;
    for (let y = t!; y <= b! && ring; y++) for (let x = l!; x <= r!; x++) {
      if ((x === l || x === r || y === t || y === b) && !cells.has(coordinateKey(x, y))) { ring = false; break; }
    }
    if (!ring || (h - 2) % 3) continue;
    const unit = (h - 2) / 3, start = b! - unit, interior: number[] = [], slots: R[] = [];
    for (let y = t! + 1; y < b!; y++) for (let x = l! + 1; x < r!; x++) interior.push(rows[y]![x]!);
    const base = dominant(interior);
    for (let x = l! + 1; x < r!;) {
      let empty = true;
      for (let y = start; y < b!; y++) if (rows[y]![x] !== base) { empty = false; break; }
      if (empty) { x++; continue; }
      let end = x;
      while (end + 1 < r!) {
        let occupied = false;
        for (let y = start; y < b!; y++) if (rows[y]![end + 1] !== base) { occupied = true; break; }
        if (!occupied) break;
        end++;
      }
      const pixels: number[] = [];
      for (let y = start; y < b!; y++) for (let xx = x; xx <= end; xx++) pixels.push(rows[y]![xx]!);
      slots.push({ box: [x, start, end, b! - 1], values: pixels, full: new Set(pixels).size === 1 }); x = end + 1;
    }
    if (!slots.length || slots.length > 16 || slots.some(slot => slot.box[2] - slot.box[0] + 1 !== unit)) continue;
    const fixed = !slots.every(slot => slot.full);
    if (fixed && !slots.every(slot => new Set(slot.values).size === 2
      && (slot.values as number[]).filter(value => value === base).length === (unit - 1) ** 2)) continue;
    const active = (slots[0]!.values as number[]).at(-1)!, capacity = fixed ? slots.length
      : slots.filter(slot => slot.values[0] === active).length;
    if (!fixed && slots.some((slot, index) => (slot.values[0] === active) !== (index < capacity))) continue;
    const fw = 2 * unit + 1, fl = l! + 1, ft = t! + 1, fr = fl + fw - 1, fb = start - 1;
    const field = (left: number): R | null => {
      const right = left + fw - 1, patch: number[] = [], overlay = new Set<string>(), other: number[][] = [];
      for (let y = ft; y <= fb; y++) for (let x = left; x <= right; x++) patch.push(rows[y]![x]!);
      const color = dominant(patch);
      for (let y = ft + 1; y < fb; y++) overlay.add(coordinateKey(left + unit, y));
      for (let y = ft; y <= fb; y++) for (let x = left; x <= right; x++) if (rows[y]![x] !== color) other.push([x, y]);
      const point = [Math.floor((left + right) / 2), Math.floor((ft + fb) / 2)];
      if (color !== base && other.every(([x, y]) => overlay.has(coordinateKey(x!, y!)))) {
        return { value: color, domain: [color], fixed_hypothesis: true,
          overlay: other.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!), point };
      }
      const core: number[] = [];
      for (let y = ft; y <= fb; y++) for (let x = left + unit; x <= right; x++) core.push(rows[y]![x]!);
      if (new Set(core).size !== 1 || core[0] === base) return null;
      const domain: number[] = [];
      for (let y = ft; y <= fb; y++) { const value = rows[y]![left]!; if (value !== base && !domain.includes(value)) domain.push(value); }
      if (domain.length < 2 || !domain.includes(core[0]!)) return null;
      return { value: core[0], domain, fixed_hypothesis: false, overlay: [], point };
    };
    const leftField = field(fl), rightField = field(r! - fw), filter = leftField ? leftField.value : null,
      domain = leftField ? leftField.domain : [];
    if (!leftField) {
      const patch = new Set<number>();
      for (let y = ft; y <= fb; y++) for (let x = fl; x <= fr; x++) patch.add(rows[y]![x]!);
      if (patch.size < 3) continue;
    }
    const filterPoint = [Math.floor((fl + fr) / 2), Math.floor((ft + fb) / 2)],
      output = rightField && !equal(rightField.point, filterPoint) ? rightField : null;
    boxes.push({ bbox: [l, t, r, b], border: component.value, base, unit, slots, capacity,
      capacity_domain: fixed ? [slots.length] : Array.from({ length: slots.length }, (_, i) => i + 1),
      capacity_point: [Math.floor((l! + r!) / 2), start], filter, filter_domain: domain, filter_point: filterPoint,
      wildcard_hypothesis: filter === null, fixed_capacity: fixed, left_field: leftField, second_field: output });
  }
  if (boxes.length < 2 || new Set(boxes.map(box => `${box.bbox[2] - box.bbox[0]},${box.bbox[3] - box.bbox[1]}`)).size !== 1) return null;
  boxes.sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  const top = Math.min(...boxes.map(box => box.bbox[1])), groups = new Map<string, { width: number; units: R[] }>();
  for (const component of cc) {
    const [l, t, r, b] = component.bbox as number[], w = r! - l! + 1, h = b! - t! + 1;
    if (b! >= top || w !== h || w < 2 || w > 6 || component.cells.length !== w * h) continue;
    const key = `${t},${b},${w}`;
    if (!groups.has(key)) groups.set(key, { width: w, units: [] });
    groups.get(key)!.units.push(component);
  }
  const candidates: R[][] = [];
  for (const group of groups.values()) {
    const units = group.units.sort((a, b) => a.bbox[0] - b.bbox[0]), gaps = units.slice(1).map((unit, index) => unit.bbox[0] - units[index]!.bbox[0]);
    if (units.length >= 3 && new Set(gaps).size === 1 && gaps[0]! > group.width) candidates.push(units);
  }
  if (candidates.length !== 1) return null;
  const word = candidates[0]!, colors = word.map(unit => unit.value);
  if (new Set(colors).size < 2 || boxes.some(box => box.filter !== null && !colors.includes(box.filter))) return null;
  return { boxes, word: word.map(unit => ({ bbox: unit.bbox, value: unit.value })), colors,
    signature: { box_shape: [boxes[0]!.bbox[2] - boxes[0]!.bbox[0] + 1, boxes[0]!.bbox[3] - boxes[0]!.bbox[1] + 1],
      unit: boxes[0]!.unit, word_shape: [word[0]!.bbox[2] - word[0]!.bbox[0] + 1, word[0]!.bbox[3] - word[0]!.bbox[1] + 1] } };
}

export function coverage(measurement: R, settings: readonly (readonly any[])[], model: R): [boolean, R[]] {
  if (model.receiver_order_hypothesis !== 'visual_reading_order_not_rail_law' || model.one_use_for_run !== true) return [false, []];
  let train: TrainRankD[] = (measurement.colors as unknown[]).map((color, index) => normalizeTrainRank({
    unit_ref: `visible_rank:${index}`, rank: index, current_color_ref: 'pixel:' + pythonScalar(color), captured: false }));
  // Source creates exactly one fresh budget per coverage, not per receiver or
  // per plan enumeration. The private kernels do not call budget.finish().
  const budget = new RecolorWorkBudget({ node_bound: 4096, time_bound_ms: 1000, domain_bound: 4096 }), receipts: R[] = [];
  for (let ordinal = 0; ordinal < Math.min(measurement.boxes.length, settings.length); ordinal++) {
    const box = measurement.boxes[ordinal]!, [size, color, output] = settings[ordinal]!, operation = pythonTruthy(box.second_field)
      ? model.dual_field_operation_hypothesis : model.single_field_operation_hypothesis;
    const receiver = normalizeWindowReceiver({ receiver_ref: `box:${ordinal}`, first_rank_at_beat_zero: 0, window_size: size,
      admitted_color_refs: color === null ? null : ['pixel:' + pythonScalar(color)], maximal_group_required: model.maximal_group_required,
      action: operation, paint_color_ref: operation === 'PAINT' ? 'pixel:' + pythonScalar(output) : null,
      event_ref: 'hypothetical_capture', one_use_for_run: model.one_use_for_run });
    const state = normalizeWindowBeatState({ train, receivers: [receiver], receiver_order: [receiver.receiver_ref], beat: 0,
      rank_shift_per_beat: 0, visitation_policy: 'single_ordered_pass', revisit_termination_evidence_ref: null });
    for (let start = 0; start < train.length - size + 1; start++) {
      const current = { ...receiver, first_rank_at_beat_zero: start }, result = windowEligibility(state, current, train, new Set(), [], budget);
      if (result.eligible) {
        const ranks = [...new Set<number>(result.input_ranks)].sort((a, b) => a - b),
          [projected, ledger] = processOneBeat({ ...state, receivers: [current] }, budget, 1);
        train = projected.train;
        receipts.push({ box: ordinal, ranks, operation_hypothesis: operation, projection: ledger.ordered_events,
          status: 'conditional_static_coverage_not_observed_no_real_beat_inferred' }); break;
      }
    }
  }
  return [train.every(unit => unit.captured), receipts];
}

interface SearchDomain { axes: any[][]; bound: R }
function searchDomain(measurement: R, model: R): SearchDomain {
  const axes: any[][] = []; let count = 1n;
  for (const box of measurement.boxes as R[]) {
    const fields = [box.capacity_domain, pythonTruthy(box.filter_domain) ? box.filter_domain : [null],
      pythonTruthy(box.second_field) ? box.second_field.domain : [null]];
    for (const values of fields) {
      if (!Array.isArray(values)) throw new TypeError('Window configuration dimensions must be arrays');
      axes.push([...values]); count *= BigInt(values.length);
    }
  }
  if (!Number.isSafeInteger(model.configuration_bound)) throw new TypeError('Window configuration bound must be an exact native integer');
  const truncated = count > BigInt(model.configuration_bound);
  if (count > BigInt(Number.MAX_SAFE_INTEGER)) {
    // An unsafe complete domain cannot occur under a safe declared bound.
    // Keep the true integer on the no-plan branch, never Infinity or a cap.
    return { axes, bound: { truncated, domain: count.toString(), native_domain_format: 'exact_decimal_integer' } };
  }
  return { axes, bound: { truncated, domain: Number(count) } };
}

/** Lazy equivalent of product(*[product(capacity, filter, output), ...]).
 * The rightmost dimension varies fastest, including the empty product. */
function* configurations(axes: readonly any[][]): Generator<any[][]> {
  if (axes.some(values => !values.length)) return;
  const indexes = axes.map(() => 0);
  for (;;) {
    const settings: any[][] = [];
    for (let index = 0; index < axes.length; index += 3) settings.push([
      axes[index]![indexes[index]!], axes[index + 1]![indexes[index + 1]!], axes[index + 2]![indexes[index + 2]!],
    ]);
    yield settings;
    let index = indexes.length - 1;
    for (; index >= 0; index--) { indexes[index] = indexes[index]! + 1; if (indexes[index]! < axes[index]!.length) break; indexes[index] = 0; }
    if (index < 0) return;
  }
}
function cyclicSteps(domain: readonly any[], desired: unknown, current: unknown): number {
  const next = domain.findIndex(value => equal(value, desired)), previous = domain.findIndex(value => equal(value, current));
  if (next < 0 || previous < 0 || !domain.length) throw new TypeError('A source edit value is absent from its declared cycle');
  return modulo(next - previous, domain.length);
}
function* candidates(measurement: R, model: R, axes: readonly any[][]): Generator<R | null> {
  for (const settings of configurations(axes)) {
    const [okay, receipts] = coverage(measurement, settings, model);
    if (!okay) { yield null; continue; }
    const edits: R[] = [];
    for (let index = 0; index < Math.min(measurement.boxes.length, settings.length); index++) {
      const box = measurement.boxes[index]!, [size, color, output] = settings[index]!;
      const add = (field: string, point: any, desired: any, steps: number): void => {
        for (let count = 0; count < steps; count++) edits.push({ box: index, field, point, desired });
      };
      if (pythonTruthy(box.second_field) && !equal(output, box.second_field.value)) {
        const field = box.second_field; add('second_field', field.point, output, cyclicSteps(field.domain, output, field.value));
      }
      if (!equal(size, box.capacity)) add('capacity', box.capacity_point, size, cyclicSteps(box.capacity_domain, size, box.capacity));
      if (!equal(color, box.filter)) add('filter', box.filter_point, color, cyclicSteps(box.filter_domain, color, box.filter));
    }
    yield { settings, edits, cost: edits.length + 1, coverage: receipts };
  }
}

export function plans(measurement: R, model: R): WindowPlanResult {
  const { axes, bound } = searchDomain(measurement, model);
  if (bound.truncated) return [[], bound];
  const result: R[] = [];
  for (const candidate of candidates(measurement, model, axes)) if (candidate) result.push(candidate);
  return [result, bound];
}

function interrupted(execution: NativeExecution, completed: number): R | null {
  const reason = execution.signal?.aborted ? 'native_abort'
    : execution.deadlineMs !== undefined && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs ? 'native_deadline' : null;
  return reason ? { reason, frontier: { completed_configurations: completed } } : null;
}
/** Native scheduling adaptation only. Source budgets still use their own
 * per-coverage clock. An interrupted enumeration exposes no partial plans. */
export async function plansCooperative(measurement: R, model: R, execution?: NativeExecution): Promise<WindowPlanResult> {
  if (!execution) return plans(measurement, model);
  const { axes, bound } = searchDomain(measurement, model);
  if (bound.truncated) return [[], bound];
  const incomplete = (detail: R): WindowPlanResult => [[], { ...bound, truncated: true, native_search_incomplete: detail }];
  let completed = 0, stop = interrupted(execution, completed);
  if (stop) return incomplete(stop);
  const result: R[] = [];
  for (const candidate of candidates(measurement, model, axes)) {
    completed++; if (candidate) result.push(candidate);
    stop = interrupted(execution, completed); if (stop) return incomplete(stop);
    if (completed % 32 === 0) {
      try { await execution.yieldControl(); }
      catch (error) {
        if (execution.signal?.aborted || error instanceof Error && error.name === 'AbortError') {
          return incomplete({ reason: 'native_abort', frontier: { completed_configurations: completed } });
        }
        throw error;
      }
      stop = interrupted(execution, completed); if (stop) return incomplete(stop);
    }
  }
  // A deadline/abort after the final coverage must not be labelled complete.
  stop = interrupted(execution, completed); if (stop) return incomplete(stop);
  return [result, bound];
}
