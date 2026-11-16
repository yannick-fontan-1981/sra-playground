import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves, readCycleReserve, type CycleGauge, type CycleRouteLeg, type CycleState, type CycleStep } from './inset-cycle-route.ts';
import { pixelsAt, pointKey } from './managed-framed-access.ts';

export type CycleGlyph = { mask: string; ink: number };
type Glyph = CycleGlyph;
export type GlyphTransitions = { shape: Record<string, string>; color: Record<number, number> };
export type CompositeCycleEvidence = { epoch: number; ref: string; pitch: number; floor: number; gauge: CycleGauge;
  body: number[]; patternStation: number[]; exitRim: number; fullReserve: number; display: CycleState['layout']['symbol'];
  observed?: { transitions: GlyphTransitions; anchorInk: number; rotation?: { advance: number; stamp: number[] } } };
type Layout = CompositeCycleEvidence & { points: NativePoint[]; shape: NativePoint; color: NativePoint;
  exit: NativePoint; charges: NativePoint[]; displayGround: number; anchorInk: number; wanted: Glyph };
export type CompositeCycleState = { epoch: number; layout: Layout; at: NativePoint; spent: number; seen: string[]; refs: string[]; stopped: boolean;
  transitions?: GlyphTransitions };
export type CompositeCycleStep = Omit<CycleStep, 'purpose'> & { purpose: CycleStep['purpose'] | 'test_color' | 'test_rotation'; charge: number };
type Flight = { at: NativePoint; reserve: number; spent: number; distance: number; walk: CycleRouteLeg[];
  first?: Pick<CompositeCycleStep, 'action' | 'step' | 'charge'> };
export const sameCyclePixels = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const same = sameCyclePixels;
const cyclicGlyphKey = ({ mask, ink }: Glyph) => mask + ':' + ink;

function glyph(palette: number[], base: number, ground: number): Glyph | null {
  const colors = [...new Set(palette.slice(1).filter(ink => ink !== ground))];
  return palette[0] === base && colors.length === 1 ? { ink: colors[0]!, mask: palette.map(ink => Number(ink !== ground)).join('') } : null;
}

export function sampleCycleGlyph(rows: NativeRows, [x, y]: NativePoint, side: number, scale: number): number[] {
  const half = Math.floor(scale / 2);
  return Array.from({ length: side * side }, (_, i) => rows[y + Math.floor(i / side) * scale + half]?.[x + (i % side) * scale + half] ?? -1);
}
const sampleGlyph = sampleCycleGlyph;

function rescale(square: number[], before: number, after: number): number[] {
  const ratio = before / after;
  return Array.from({ length: after * after }, (_, i) => {
    const y = Math.floor((Math.floor(i / after) + 0.5) * ratio);
    const x = Math.floor((i % after + 0.5) * ratio);
    return square[y * before + x]!;
  });
}

export function readCompositeCycle(rows: NativeRows, memory: CompositeCycleEvidence, epoch: number): CompositeCycleState | null {
  const { gauge, floor, display, pitch: beforePitch } = memory;
  if (readCycleReserve(rows, gauge) < 1) return null;
  const parts = geometricComponents(rows);
  const pitches = [...new Set(parts.filter(part => part.rectangular && part.color === gauge.active
    && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1] && part.area > 1)
    .map(part => 2 * (part.bbox[2] - part.bbox[0] + 1)))].filter(pitch => pitch < beforePitch
      && beforePitch % pitch === 0 && pitch === display.side + 1);
  const [x, y] = display.point;
  const displayGround = rows[y]?.[x - 1], anchorInk = rows[y]?.[x];
  if (displayGround === undefined || anchorInk === undefined || displayGround === anchorInk) return null;
  const current = glyph(sampleGlyph(rows, display.point, display.side, display.scale), anchorInk, displayGround);
  if (!current) return null;
  const measured: CompositeCycleState[] = [];
  for (const pitch of pitches) {
    const body = rescale(memory.body, beforePitch, pitch), stamp = rescale(memory.patternStation, beforePitch, pitch);
    const bodies: NativePoint[] = [];
    for (let y = 1; y + pitch <= rows.length; y++) for (let x = 1; x + pitch <= rows[0]!.length; x++) {
      const point: NativePoint = [x, y];
      if (rows[y]?.[x] === body[0] && same(pixelsAt(rows, point, pitch), body)) bodies.push(point);
    }
    if (bodies.length !== 1) continue;
    const at = bodies[0]!, points: NativePoint[] = [], shapes: NativePoint[] = [], charges: NativePoint[] = [];
    const colors: { at: NativePoint; inks: Set<number> }[] = [], exits: { at: NativePoint; wanted: Glyph }[] = [];
    for (let y = at[1] % pitch; y + pitch <= rows.length; y += pitch) {
      for (let x = at[0] % pitch; x + pitch <= rows[0]!.length; x += pitch) {
        const point: NativePoint = [x, y], tile = pixelsAt(rows, point, pitch), inks = new Set(tile);
        if (same(point, at) || (inks.size === 1 && inks.has(floor))) points.push(point);
        else if (same(tile, stamp)) shapes.push(point);
        else if (tile.every((ink, i) => ink === (i % pitch > 0 && i % pitch < pitch - 1
          && i >= pitch && i < tile.length - pitch ? gauge.active : floor))) charges.push(point);
        else if (tile.every((ink, i) => i >= pitch && i % pitch > 0 || ink === memory.exitRim)) {
          const wanted = glyph(sampleGlyph(rows, [x + 1, y + 1], display.side, 1), anchorInk, memory.exitRim);
          if (wanted) exits.push({ at: point, wanted });
        } else if (inks.size >= 3 && !inks.has(floor) && inks.has(current.ink)) colors.push({ at: point, inks });
      }
    }
    if (shapes.length !== 1 || charges.length < 2 || charges.length > 12 || exits.length !== 1) continue;
    const { at: exit, wanted } = exits[0]!;
    const inkStations = colors.filter(station => station.inks.has(wanted.ink));
    if (inkStations.length !== 1 || !points.length || cyclicGlyphKey(current) === cyclicGlyphKey(wanted)) continue;
    const shape = shapes[0]!, color = inkStations[0]!.at;
    const layout = { ...memory, pitch, body, points: [...points, shape, color, ...charges, exit],
      shape, color, exit, charges, wanted, anchorInk, displayGround };
    measured.push({ epoch, layout, at, spent: 0, seen: [], refs: [memory.ref], stopped: false });
  }
  return measured.length === 1 ? measured[0]! : null;
}

function displayed(rows: NativeRows, layout: Layout): Glyph | null {
  const { point, side, scale } = layout.display;
  return glyph(sampleGlyph(rows, point, side, scale), layout.anchorInk, layout.displayGround);
}

export function chooseCompositeCycleStep(rows: NativeRows, state: CompositeCycleState, available: readonly string[],
  remaining: number): CompositeCycleStep | null {
  const { layout, at, spent } = state, shown = displayed(rows, layout);
  if (state.stopped || !shown || !same(pixelsAt(rows, at, layout.pitch), layout.body)) return null;
  const units = readCycleReserve(rows, layout.gauge);
  const goals = new Map<string, CompositeCycleStep['purpose']>();
  if (shown.mask !== layout.wanted.mask) goals.set(pointKey(layout.shape), 'test_shape');
  if (shown.ink !== layout.wanted.ink) goals.set(pointKey(layout.color), 'test_color');
  if (!goals.size) goals.set(pointKey(layout.exit), 'exit');
  const stops = new Set([layout.shape, layout.color, layout.exit].map(pointKey));
  const walkable = new Set(layout.points.map(pointKey));
  const chargeAt = new Map(layout.charges.map((point, index) => [pointKey(point), index]));
  const moves = cycleMoves.filter(([action]) => available.includes(action));

  function canLeave(start: NativePoint, reserve: number, used: number) {
    const queue = [{ point: start, depth: 0 }], seen = new Set([pointKey(start)]);
    for (const { point, depth } of queue) {
      if (depth + 1 > reserve) break;
      for (const [, dx, dy] of moves) {
        const next: NativePoint = [point[0] + dx * layout.pitch, point[1] + dy * layout.pitch], signature = pointKey(next);
        if (!walkable.has(signature) || seen.has(signature)) continue;
        const charge = chargeAt.get(signature);
        if (same(next, layout.exit) || charge !== undefined && !(used & (1 << charge))) return true;
        if (stops.has(signature)) continue;
        seen.add(signature);
        queue.push({ point: next, depth: depth + 1 });
      }
    }
    return false;
  }

  const queue: Flight[] = [{ at, reserve: units, spent, distance: 0, walk: [] }], bestEnergy = new Map<string, number>();
  for (const item of queue) {
    if (queue.length >= 24000) break;
    if (item.reserve < 1 || item.distance >= remaining) continue;
    for (const [action, dx, dy] of moves) {
      const step: NativePoint = [item.at[0] + dx * layout.pitch, item.at[1] + dy * layout.pitch], signature = pointKey(step);
      if (!walkable.has(signature)) continue;
      const charge = chargeAt.get(signature) ?? -1;
      const collecting = charge >= 0 && !(item.spent & (1 << charge));
      const nextSpent = collecting ? item.spent | (1 << charge) : item.spent;
      const reserve = collecting ? layout.fullReserve : item.reserve - 1;
      const first = item.first ?? { action, step, charge: collecting ? charge : -1 };
      const purpose = goals.get(signature);
      if (purpose === 'exit' || (purpose && reserve > 0 && canLeave(step, reserve, nextSpent))) {
        const charging = first.charge >= 0;
        return { ...first, purpose: charging ? 'recharge' : purpose, target: charging ? first.step : step, units, distance: item.distance + 1,
          walk: item.walk };
      }
      if (stops.has(signature) || reserve <= 0) continue;
      const key = signature + ':' + nextSpent;
      if ((bestEnergy.get(key) ?? -1) >= reserve) continue;
      bestEnergy.set(key, reserve);
      const walk = collecting || item.walk.length !== item.distance ? item.walk : [...item.walk, { action, step }];
      queue.push({ at: step, reserve, spent: nextSpent, distance: item.distance + 1, first, walk });
    }
  }
  return null;
}

export function observeCompositeCycleStep(first: NativeRows, second: NativeRows, state: CompositeCycleState, step: CompositeCycleStep) {
  const { layout } = state;
  if (!same(pixelsAt(second, step.step, layout.pitch), layout.body)) return null;
  const before = displayed(first, layout), after = displayed(second, layout);
  if (!before || !after) return null;
  const shape = before.mask !== after.mask, color = before.ink !== after.ink;
  const recharge = step.charge >= 0, reserve = readCycleReserve(second, layout.gauge);
  if (recharge ? reserve <= step.units - 1 : reserve !== step.units - 1) return null;
  if (shape !== same(step.step, layout.shape) || color !== same(step.step, layout.color)) return null;
  return { reason: recharge ? 'reserve_recovered_with_shape_and_color_preserved'
    : shape ? 'shape_changed_with_color_preserved' : color ? 'color_changed_with_shape_preserved' : 'step_preserved_both_glyph_properties',
    symbol: shape || color ? cyclicGlyphKey(after) : null, matchesGoal: cyclicGlyphKey(after) === cyclicGlyphKey(layout.wanted),
    changedShape: shape ? [before.mask, after.mask] as const : null, changedColor: color ? [before.ink, after.ink] as const : null };
}
