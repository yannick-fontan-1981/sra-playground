import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { measureInsetContact } from './inset-contact.ts';
import { pixelsAt, pointKey } from './managed-framed-access.ts';

export const cycleMoves = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
export type CycleGauge = { line: number; active: number; depleted: number; dots: number[]; perMove: number; observations: number };
export type CycleKnowledge = { epoch: number; gauge: CycleGauge; pitch: number; floor: number; ref: string };
type Inlay = { point: NativePoint; scale: number; side: number; palette: number[]; target: string };
export type CycleLayout = { pitch: number; grid: NativePoint[]; station: NativePoint; exit: NativePoint;
  charge: NativePoint; gauge: CycleGauge; symbol: Inlay; body: number[] };
export type CycleState = { epoch: number; layout: CycleLayout; at: NativePoint; spentCharge: boolean; triedSymbols: string[];
  refs: string[]; stopped: boolean; restoredReserve?: number };
export type CycleRouteLeg = { action: typeof cycleMoves[number][0]; step: NativePoint };
export type CycleStep = CycleRouteLeg & { target: NativePoint;
  purpose: 'test_shape' | 'recharge' | 'exit'; units: number; distance: number; walk?: CycleRouteLeg[] };
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((p, i) => p === b[i]);
const corner = ([l, t]: NativeBox): NativePoint => [l, t];
const widen = ([x, y]: NativePoint, side: number): NativeBox => [x, y, x + side - 1, y + side - 1];
const inside = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;

export function learnCycleGauge(before: NativeRows, after: NativeRows, pitch: number, previous?: CycleGauge): CycleGauge | undefined {
  if (previous) {
    const { line, active, depleted, dots, perMove } = previous;
    if (!dots.every(x => before[line]?.[x] === active || before[line]?.[x] === depleted)
      || !dots.every(x => after[line]?.[x] === active || after[line]?.[x] === depleted)) return undefined;
    const lost = dots.filter(x => before[line]?.[x] === active && after[line]?.[x] === depleted).length;
    const gained = dots.some(x => before[line]?.[x] === depleted && after[line]?.[x] === active);
    return lost === perMove && !gained ? { ...previous, observations: previous.observations + 1 } : undefined;
  }
  const changes = before.slice(0, Math.floor(pitch / 2)).flatMap((row, y) =>
    row.flatMap((active, x) => after[y]?.[x] === active ? [] : [{ y, active, depleted: after[y]![x]! }]));
  const first = changes[0];
  if (!first || changes.some(change => change.y !== first.y || change.active !== first.active || change.depleted !== first.depleted)) return undefined;
  const { y: line, active, depleted } = first;
  const dots = before[line]!.flatMap((paint, x) => paint === active || paint === depleted ? [x] : []);
  if (dots.length < pitch || dots.some((x, i) => i > 0 && x - dots[i - 1]! !== dots[1]! - dots[0]!)) return undefined;
  return { line, active, depleted, dots, perMove: changes.length, observations: 1 };
}

export function readCycleReserve(rows: NativeRows, { line, dots, active, perMove }: CycleGauge): number {
  return Math.floor(dots.filter(x => rows[line]?.[x] === active).length / perMove);
}

function readGlyph(rows: NativeRows, point: NativePoint, scale: number, side: number, palette: readonly number[]): string {
  const half = Math.floor(scale / 2);
  const values: number[] = [];
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    values.push(palette.indexOf(rows[point[1] + y * scale + half]?.[point[0] + x * scale + half] ?? -1));
  }
  return values.join(',');
}

export function readCycleLayout(rows: NativeRows, known: CycleKnowledge): { layout: CycleLayout; at: NativePoint } | null {
  const parts = geometricComponents(rows);
  const inset = measureInsetContact(rows, parts);
  const { pitch, floor, gauge } = known;
  if (!inset || inset.body[2] - inset.body[0] + 1 !== pitch || readCycleReserve(rows, gauge) < 1) return null;
  const at = corner(inset.body), exit = corner(inset.target), body = pixelsAt(rows, at, pitch);
  const targetColors = new Map<number, number>();
  for (const pixel of pixelsAt(rows, exit, pitch)) targetColors.set(pixel, (targetColors.get(pixel) ?? 0) + 1);
  const colors = [...targetColors].sort((a, b) => b[1] - a[1]).map(([paint]) => paint);
  if (colors.length !== 3) return null;
  const palette = colors.slice(1);
  const marks = parts.filter(part => palette.includes(part.color) && part.rectangular && part.area >= 4
    && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1]
    && inside(corner(part.bbox), inset.target) && inside([part.bbox[2], part.bbox[3]], inset.target));
  if (marks.length !== 1) return null;
  const mark = marks[0]!, insetScale = mark.bbox[2] - mark.bbox[0] + 1, side = Math.floor((pitch - 1) / insetScale);
  if (side < 2 || side > 5) return null;
  const target = readGlyph(rows, corner(mark.bbox), insetScale, side, palette);
  const grid = [at], transitions: NativePoint[] = [], refills: NativePoint[] = [];
  for (let y = at[1] % pitch; y + pitch <= rows.length; y += pitch) {
    for (let x = at[0] % pitch; x + pitch <= rows[0]!.length; x += pitch) {
      const point: NativePoint = [x, y];
      if (same(point, at) || same(point, exit)) continue;
      const patch = pixelsAt(rows, point, pitch), colors = new Set(patch);
      if (!colors.has(floor) || patch.filter(value => value === floor).length < patch.length / 2) continue;
      if (colors.size === 1) grid.push(point);
      else if (colors.size === 3 && palette.every(value => colors.has(value))) transitions.push(point);
      else if (colors.size === 2 && colors.has(gauge.active)) refills.push(point);
    }
  }
  if (grid.length < 6 || transitions.length !== 1 || refills.length !== 1) return null;
  const bounds: NativeBox = [Math.min(...grid.map(p => p[0])), Math.min(...grid.map(p => p[1])),
    Math.max(...grid.map(p => p[0])) + pitch - 1, Math.max(...grid.map(p => p[1])) + pitch - 1];
  const remote = parts.filter(part => part.color === mark.color && part.rectangular && part.area > mark.area
    && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1] && !inside(corner(part.bbox), bounds));
  if (remote.length !== 1) return null;
  const anchor = remote[0]!.bbox, scale = anchor[2] - anchor[0] + 1;
  if (anchor[0] + side * scale > rows[0]!.length || anchor[1] + side * scale > rows.length) return null;
  const symbol = { point: corner(anchor), side, scale, target, palette };
  const initials = readGlyph(rows, symbol.point, scale, side, palette);
  if (initials === target || !palette.every((_, i) => initials.split(',').includes(String(i)))) return null;
  return { at, layout: { pitch, grid: [...grid, transitions[0]!, refills[0]!, exit],
    station: transitions[0]!, charge: refills[0]!, exit, gauge, body, symbol } };
}

export function readCycleSymbol(rows: NativeRows, { symbol }: CycleLayout) {
  return readGlyph(rows, symbol.point, symbol.scale, symbol.side, symbol.palette);
}

function path(layout: CycleLayout, start: NativePoint, target: NativePoint, avoid: readonly NativePoint[]) {
  const accessible = new Set(layout.grid.filter(point => !avoid.some(skip => same(point, skip))).map(pointKey));
  const queue: { at: NativePoint; depth: number; legs: CycleRouteLeg[] }[] = [{ at: start, depth: 0, legs: [] }];
  const seen = new Set<string>();
  for (const item of queue) for (const [action, dx, dy] of cycleMoves) {
    const step: NativePoint = [item.at[0] + dx * layout.pitch, item.at[1] + dy * layout.pitch], key = pointKey(step);
    if (!accessible.has(key)) continue;
    const candidate = { at: step, depth: item.depth + 1, legs: [...item.legs, { action, step }] };
    if (same(step, target)) return candidate;
    if (same(step, start) || seen.has(key)) continue;
    seen.add(key);
    queue.push(candidate);
  }
  return null;
}

export function chooseCycleStep(rows: NativeRows, state: CycleState): CycleStep | null {
  const { layout, at } = state, { station, exit, charge, symbol } = layout;
  if (state.stopped) return null;
  const current = readCycleSymbol(rows, layout), units = readCycleReserve(rows, layout.gauge), aligned = current === symbol.target;
  const toExit = aligned ? path(layout, at, exit, [station, ...(!state.spentCharge ? [charge] : [])]) : null;
  if (toExit && toExit.depth <= units) return { ...toExit.legs[0]!, purpose: 'exit', target: exit, units, distance: toExit.depth,
    walk: toExit.legs.slice(0, -1) };
  const toStation = !aligned ? path(layout, at, station, [exit, ...(!state.spentCharge ? [charge] : [])]) : null;
  const afterward = !state.spentCharge ? path(layout, station, charge, [exit])?.depth : 0;
  if (toStation && afterward !== undefined && toStation.depth + afterward < units) {
    return { ...toStation.legs[0]!, purpose: 'test_shape', target: station, units, distance: toStation.depth,
      walk: toStation.legs.slice(0, -1) };
  }
  const refill = !state.spentCharge ? path(layout, at, charge, [station, exit]) : null;
  return refill && refill.depth <= units ? { ...refill.legs[0]!, purpose: 'recharge', target: charge, units, distance: refill.depth,
    walk: refill.legs.slice(0, -1) } : null;
}

export function observeCycleStep(rows: NativeRows, first: NativeRows, state: CycleState, step: CycleStep) {
  const { layout } = state;
  if (!same(pixelsAt(rows, step.step, layout.pitch), layout.body)) return null;
  const now = readCycleReserve(rows, layout.gauge), oldSymbol = readCycleSymbol(first, layout);
  const symbol = readCycleSymbol(rows, layout);
  if (same(step.step, layout.charge) && !state.spentCharge) {
    return now > step.units && oldSymbol === symbol ? { reason: 'reserve_recovered_with_symbol_preserved', recovered: true } : null;
  }
  if (now !== step.units - 1 || same(step.step, layout.exit)) return null;
  if (same(step.step, layout.station)) return oldSymbol !== symbol
    ? { reason: 'reentry_changed_the_visible_symbol', symbol } : null;
  return oldSymbol === symbol ? { reason: 'step_preserved_symbol_and_consumed_measured_reserve' } : null;
}

export function cycleSubject(layout: Pick<CycleLayout, 'pitch'>, point: NativePoint): NativeBox {
  return widen(point, layout.pitch);
}
