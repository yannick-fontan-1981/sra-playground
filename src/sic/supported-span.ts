import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = ReturnType<typeof geometricComponents>[number];
type Rect = { x: number; y: number; w: number; h: number };
type Beam = Rect;
type Slot = { box: NativeBox; width: number; backing: number };
export type SpanMemory = { pitch: number; beamHeight: number; resize: number; targetPaint: number; barPaint: number; validPaint: number;
  completed: number; refs: string[]; confirmedSpan?: true };
export type SpanLayout = { pitch: number; width: number; h: number; bases: [Rect, Rect]; fixture: Rect; bars: Rect[];
  goal: Rect; slots: Slot[]; stock: number[]; validPaint: number };
export type SpanPose = { box: NativeBox; x: number; y: number; w: number; valid: boolean };
export type SpanStep = { action: string; beam: Beam; point?: NativePoint; kind: 'resize' | 'align' | 'place' };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const end = ({ x, w }: Rect) => x + w;
const overlaps = (a: Rect, b: Rect) => a.x < end(b) && b.x < end(a) && a.y < b.y + b.h && b.y < a.y + a.h;
const touchesX = (a: Rect, b: Rect) => a.x < end(b) && b.x < end(a);
const fromPixels = ([l, t, r, b]: NativeBox, p: number): Rect => ({ x: l / p, y: t / p, w: (r - l + 1) / p, h: (b - t + 1) / p });
export const beamBox = ({ x, y, w, h }: Rect, p: number): NativeBox => [x * p, y * p, (x + w) * p - 1, (y + h) * p - 1];
const aligned = (box: NativeBox, p: number) => [box[0], box[1], box[2] + 1, box[3] + 1].every(value => value % p === 0);
function outline(part: Part) {
  const w = width(part.bbox), h = height(part.bbox);
  return part.area === 2 * (w + h - 2) && part.mask.every(([x, y]) => x === 0 || x === w - 1 || y === 0 || y === h - 1);
}

export function readSpanPose(parts: Part[], pitch: number, beamHeight: number, validPaint: number): SpanPose | null {
  const options = parts.filter(part => height(part.bbox) === beamHeight && width(part.bbox) >= beamHeight && aligned(part.bbox, pitch) && outline(part));
  if (options.length !== 1) return null;
  const { bbox, color } = options[0]!;
  const { x, y, w } = fromPixels(bbox, pitch);
  return { box: bbox, x, y, w, valid: color === validPaint };
}

export function spanStock(rows: NativeRows, slot: Slot): number {
  const [l, t, r, b] = slot.box;
  let value = 0;
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) if (rows[y]?.[x] !== slot.backing) value++;
  return value;
}

export function measureSpan(rows: NativeRows, parts: Part[], memory: SpanMemory, pose: SpanPose): SpanLayout | null {
  const { pitch, targetPaint, barPaint, validPaint } = memory;
  const h = memory.beamHeight / pitch, boardWidth = rows[0]!.length / pitch;
  if (boardWidth > 32 || !Number.isInteger(boardWidth) || !Number.isInteger(h) || h < 1) return null;
  const goal = parts.filter(part => part.color === targetPaint && part.bbox[1] < pose.box[1]
    && height(part.bbox) === pitch && width(part.bbox) >= pitch && aligned(part.bbox, pitch));
  if (goal.length !== 1) return null;
  const bars = parts.filter(part => part.color === barPaint && height(part.bbox) === pitch && part.bbox[3] < pose.box[1] && aligned(part.bbox, pitch))
    .map(part => fromPixels(part.bbox, pitch));
  if (bars.length < 2) return null;
  const plates = parts.filter(part => part.color === targetPaint && height(part.bbox) === pitch / 2 && width(part.bbox) >= pitch
    && part.bbox[1] % pitch === 0 && (part.bbox[2] + 1) % pitch === 0);
  const edge = plates.filter(part => part.bbox[0] === 0 || part.bbox[2] === rows[0]!.length - 1).sort((a, b) => a.bbox[0] - b.bbox[0]);
  if (edge.length !== 2 || edge[0]!.bbox[1] !== edge[1]!.bbox[1] || pose.box[3] >= edge[0]!.bbox[1]) return null;
  const platform = (part: Part, left = part.bbox[0]) => fromPixels([left, part.bbox[1], part.bbox[2], part.bbox[1] + pitch - 1], pitch);
  const bases: [Rect, Rect] = [platform(edge[0]!), platform(edge[1]!)];
  const fixtures = plates.flatMap(part => {
    const [l, t, r] = part.bbox;
    const left = Math.floor(l / pitch) * pitch;
    if (left === l || left <= end(bases[0]) * pitch || r >= bases[1].x * pitch || t >= edge[0]!.bbox[1]) return [];
    const rim = parts.find(piece => piece.bbox[0] === left && piece.bbox[1] === t && piece.bbox[2] === l - 1
      && piece.bbox[3] === t + pitch - 1 && piece.rectangular);
    return rim ? [platform(part, left)] : [];
  });
  if (fixtures.length !== 1) return null;
  const frames = parts.filter(part => part.bbox[1] >= rows.length - pitch && height(part.bbox) === pitch
    && width(part.bbox) >= pitch + 2 && outline(part)).sort((a, b) => a.bbox[0] - b.bbox[0]);
  const selected = frames.findIndex(part => part.color === validPaint);
  if (frames.length < 2 || frames.length > 4 || selected < 0 || frames.filter(part => part.color === validPaint).length !== 1
    || frames.some((part, i) => width(part.bbox) !== width(frames[0]!.bbox) || part.bbox[1] !== frames[0]!.bbox[1]
      || i > 0 && part.bbox[0] - frames[i - 1]!.bbox[2] !== 2)) return null;
  const slots: Slot[] = frames.map(({ bbox }, i) => {
    const colors = new Map<number, number>();
    for (let y = bbox[1] + 1; y < bbox[3]; y++) for (let x = bbox[0] + 1; x < bbox[2]; x++) {
      const color = rows[y]![x]!;
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
    const ranks = [...colors].sort((a, b) => b[1] - a[1]);
    return { box: bbox, width: pose.w + (i - selected) * memory.resize, backing: ranks[0]![0] };
  });
  const stock = slots.map(slot => spanStock(rows, slot));
  if (slots[0]!.width < h || slots.at(-1)!.width > boardWidth || stock.some(value => value <= 0)) return null;
  return { pitch, h, width: boardWidth, bases, fixture: fixtures[0]!, bars,
    goal: fromPixels(goal[0]!.bbox, pitch), slots, stock, validPaint };
}

function contact(beam: Beam, below: Rect): [number, number] {
  return [Math.max(beam.x, below.x), Math.min(end(beam), end(below))];
}

function loadClearance(stack: readonly Beam[], fixed: Rect): number {
  let load = 0, moment = 0, clearance = Infinity;
  for (let i = stack.length - 1; i >= 0; i--) {
    const beam = stack[i]!, [l, r] = contact(beam, stack[i - 1] ?? fixed);
    load += beam.w;
    moment += (beam.x + beam.w / 2) * beam.w;
    const center = moment / load;
    clearance = Math.min(clearance, center - l, r - center);
  }
  return clearance;
}

type Force = { x: number; amount: number };
type SpanLoad = { x: number; onFixture: boolean };
type StructureLoad = { pressure: number; beams: SpanLoad[] };

export function distributedSpanLoad(layout: SpanLayout, placed: readonly Beam[]): StructureLoad | null {
  const supports = [...placed, ...layout.bases, layout.fixture];
  const fixture = supports.length - 1;
  const incoming = placed.map(() => [] as Force[]);
  const loads: SpanLoad[] = [];
  let pressure = 0;
  const order = placed.map((_, i) => i).sort((a, b) => placed[a]!.y - placed[b]!.y);
  for (const i of order) {
    const beam = placed[i]!, forces = incoming[i]!;
    const amount = beam.w + forces.reduce((sum, applied) => sum + applied.amount, 0);
    const moment = beam.w * (beam.x + beam.w / 2) + forces.reduce((sum, applied) => sum + applied.x * applied.amount, 0);
    const x = moment / amount;
    const contacts = supports.flatMap((support, j) => {
      if (support.y !== beam.y + beam.h || !touchesX(beam, support)) return [];
      const [l, r] = contact(beam, support);
      return [{ j, l, r, center: (l + r) / 2 }];
    });
    const covers = ({ l, r }: { l: number; r: number }) => l <= x + 1e-9 && x <= r + 1e-9;
    const fixed = contacts.filter(item => item.j >= placed.length && covers(item));
    const engaged = fixed.length ? fixed : contacts;
    if (!engaged.length) return null;
    const ordered = engaged.sort((a, b) => a.center - b.center);
    const first = ordered[0]!, last = ordered.at(-1)!;
    const covering = ordered.find(covers);
    const transmit = (j: number, x: number, amount: number) => {
      if (j < placed.length && amount > 0) incoming[j]!.push({ x, amount });
    };
    if (first.center < last.center && x >= first.center && x <= last.center) {
      const share = amount * (last.center - x) / (last.center - first.center);
      transmit(first.j, first.center, share);
      transmit(last.j, last.center, amount - share);
    } else if (covering) {
      transmit(covering.j, x, amount);
    } else return null;
    pressure = Math.max(pressure, amount / ordered.reduce((sum, item) => sum + item.r - item.l, 0));
    loads[i] = { x, onFixture: !!covering && covering.j === fixture && fixed.length > 0 };
  }
  return { pressure, beams: loads };
}

function drop(layout: SpanLayout, x: number, w: number, placed: readonly Beam[]): Beam | null {
  const projection = { x, y: 0, w, h: layout.h };
  const supports = [...layout.bases, layout.fixture, ...placed].filter(s => touchesX(projection, s));
  if (!supports.length) return null;
  const beam = { ...projection, y: Math.min(...supports.map(s => s.y)) - layout.h };
  return beam.y >= 0 && ![...layout.bars, ...placed].some(s => overlaps(beam, s)) ? beam : null;
}

function stocksAfter(layout: SpanLayout, placed: readonly Beam[]): number[] {
  return layout.slots.map((slot, i) => layout.stock[i]! - placed.filter(beam => beam.w === slot.width).length);
}

export function planSpan(layout: SpanLayout, pose: SpanPose, distribute = false): Beam[] | null {
  const { bases, fixture, goal, width, h, slots } = layout;
  const depth = (bases[0].y - fixture.y) / h, cap = 100_000;
  if (!Number.isInteger(depth) || depth < 1 || depth > 3 || bases[0].y !== bases[1].y) return null;
  let examined = 0;
  const build = (side: number, prefix: Beam[] = []): Beam[][] => {
    if (prefix.length === depth) return [prefix];
    const plans: Beam[][] = [];
    const available = stocksAfter(layout, prefix);
    for (const [i, slot] of slots.entries()) {
      if (available[i]! <= 0) continue;
      for (let x = side === 0 ? 0 : end(fixture); x + slot.width <= (side === 0 ? fixture.x : width); x++) {
        if (++examined > cap) return plans;
        const beam = drop(layout, x, slot.width, prefix);
        if (!beam || beam.y !== bases[side]!.y - (prefix.length + 1) * h) continue;
        const candidate = [...prefix, beam];
        if (loadClearance(candidate, bases[side]!) >= 0.25) plans.push(...build(side, candidate));
      }
    }
    return plans;
  };
  const left = build(0), right = build(1);
  let result: { cost: number; pressure: number; poses: Beam[] } | null = null;
  const consider = (placed: Beam[], upper: Beam[], lowerMargin: number, lowerWidth: number, previousPressure = 0) => {
    const clearance = loadClearance(upper, fixture);
    if ((!distribute && clearance < 0.1) || ++examined > cap) return;
    const built = [...placed, ...upper];
    const load = distribute ? distributedSpanLoad(layout, built) : null;
    if (distribute && !load) return;
    const pressure = Math.max(previousPressure, load?.pressure ?? 0);
    const top = upper.at(-1)!;
    if (overlaps(top, goal)) {
      let changes = 0, prior = pose;
      for (const beam of built) {
        changes += 1 + Number(prior.x !== beam.x) + Math.abs(slots.findIndex(slot => slot.width === prior.w) - slots.findIndex(slot => slot.width === beam.w));
        prior = { ...prior, x: beam.x, w: beam.w };
      }
      const cost = changes - Math.min(lowerMargin, distribute ? lowerMargin : clearance) * 2 - lowerWidth / 5;
      if (!result || pressure < result.pressure - 1e-9 || Math.abs(pressure - result.pressure) < 1e-9 && cost < result.cost) {
        result = { cost, pressure, poses: built };
      }
      return;
    }
    if (top.y <= goal.y) return;
    const available = stocksAfter(layout, built);
    for (const [i, slot] of slots.entries()) {
      if (available[i]! <= 0) continue;
      for (let x = Math.max(0, top.x - slot.width + 1); x < end(top) && x + slot.width <= width; x++) {
        const candidate = drop(layout, x, slot.width, built);
        if (candidate?.y === top.y - h && candidate.y >= goal.y) consider(placed, [...upper, candidate], lowerMargin, lowerWidth, pressure);
      }
    }
  };
  for (const a of left) for (const b of right) {
    if (examined >= cap) break;
    const first = a.at(-1)!, second = b.at(-1)!;
    const built = [a[0]!, b[0]!, ...a.slice(1), ...b.slice(1)];
    const available = stocksAfter(layout, built);
    if (available.some(quantity => quantity < 0)) continue;
    const margin = Math.min(loadClearance(a, bases[0]), loadClearance(b, bases[1]));
    for (const [i, slot] of slots.entries()) {
      if (available[i]! <= 0) continue;
      for (let x = Math.max(0, second.x + 1 - slot.width); x < end(first) && x + slot.width <= width; x++) {
        const bridge = drop(layout, x, slot.width, built);
        if (bridge?.y === fixture.y - h && touchesX(bridge, fixture)) consider(built, [bridge], margin, a[0]!.w + b[0]!.w);
      }
    }
  }
  return (result as { poses: Beam[] } | null)?.poses ?? null;
}

export function nextSpanStep(layout: SpanLayout, pose: SpanPose, beam: Beam, clickRefused: boolean): SpanStep | null {
  if (pose.w !== beam.w) return { action: pose.w > beam.w ? 'ACTION2' : 'ACTION1', beam, kind: 'resize' };
  if (pose.x !== beam.x) {
    if (clickRefused || Math.abs(pose.x - beam.x) === 1) return { action: pose.x < beam.x ? 'ACTION4' : 'ACTION3', beam, kind: 'align' };
    const point: NativePoint = [Math.floor((beam.x + beam.w / 2) * layout.pitch), layout.goal.y * layout.pitch + Math.floor(layout.pitch / 2)];
    return { action: 'ACTION6', point, beam, kind: 'align' };
  }
  return pose.valid && pose.y === beam.y ? { action: 'ACTION5', beam, kind: 'place' } : null;
}

export function assessSpanStep(layout: SpanLayout, step: SpanStep, pose: SpanPose, before: NativeRows, after: NativeRows): string | null {
  const current = readSpanPose(geometricComponents(after), layout.pitch, layout.h * layout.pitch, layout.validPaint);
  if (!current) return null;
  const consumed = layout.slots.map(slot => spanStock(before, slot) - spanStock(after, slot));
  if (step.kind === 'place') {
    if (!consumed.every((delta, i) => delta === Number(layout.slots[i]!.width === step.beam.w))) return null;
    const [l, t, r, b] = beamBox(step.beam, layout.pitch);
    const cellChanged = (x: number, y: number) => before[y]?.[x] !== after[y]?.[x];
    let coveredColumns = 0;
    for (let x = l + 1; x < r; x++) {
      let changed = 0;
      for (let y = t + 1; y < b; y++) if (cellChanged(x, y)) changed++;
      if (changed >= (b - t - 1) / 2) coveredColumns++;
    }
    return coveredColumns >= (r - l - 1) * 0.8 ? 'new_span_verified_at_predicted_height_and_stock_consumed' : null;
  }
  if (consumed.some(Boolean)) return null;
  if (step.kind === 'resize') {
    return Math.abs(current.w - step.beam.w) < Math.abs(pose.w - step.beam.w) ? 'preview_width_adjusted_without_consuming_stock' : null;
  }
  return current.w === pose.w && Math.abs(current.x - step.beam.x) < Math.abs(pose.x - step.beam.x)
    ? 'preview_position_adjusted_without_consuming_stock' : null;
}
