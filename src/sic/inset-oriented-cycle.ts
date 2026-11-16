import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves, readCycleReserve, type CycleRouteLeg } from './inset-cycle-route.ts';
import { sameCyclePixels as same, sampleCycleGlyph, type CompositeCycleEvidence, type CompositeCycleState, type CompositeCycleStep,
  type CycleGlyph, type GlyphTransitions } from './inset-composite-route.ts';
import { pixelsAt, pointKey } from './managed-framed-access.ts';

type OrientedGlyph = CycleGlyph & { turn: number };
type Layout = CompositeCycleState['layout'] & { orientation: NativePoint; orientationStamp: number[]; wanted: OrientedGlyph };
export type OrientedCycleState = CompositeCycleState & { layout: Layout; transitions: GlyphTransitions; rotation?: number };
type Input = typeof cycleMoves[number][0];
type Site = { point: NativePoint; purpose: CompositeCycleStep['purpose']; charge: number };
type Segment = { site: number; length: number; action: Input; step: NativePoint; legs: CycleRouteLeg[] };
type Flight = { site: number; units: number; spent: number; glyph: OrientedGlyph; first?: CompositeCycleStep };

export function hasOrientation(state: CompositeCycleState): state is OrientedCycleState {
  return 'orientation' in state.layout;
}

function orientedGlyph(pixels: number[], side: number, anchor: number, ground: number): OrientedGlyph | null {
  const corner = [0, side - 1, side ** 2 - 1, side * (side - 1)];
  const turn = corner.findIndex(index => pixels[index] === anchor);
  if (turn < 0 || pixels.filter(ink => ink === anchor).length !== 1) return null;
  const colors = new Set(pixels.filter(ink => ink !== ground && ink !== anchor));
  if (colors.size !== 1 || colors.has(-1)) return null;
  let mask = pixels.map(ink => Number(ink !== ground));
  for (let step = 0; step < turn; step++) {
    const previous = mask;
    mask = previous.map((_, index) => previous[(index % side) * side + side - 1 - Math.floor(index / side)]!);
  }
  return { turn, ink: [...colors][0]!, mask: mask.join('') };
}

export function readOrientedCycle(rows: NativeRows, memory: CompositeCycleEvidence, epoch: number): OrientedCycleState | null {
  if (!memory.observed || readCycleReserve(rows, memory.gauge) < 1) return null;
  const { display, pitch, floor, gauge, body, patternStation, exitRim } = memory;
  const { anchorInk, transitions, rotation } = memory.observed;
  const [x, y] = display.point, displayGround = rows[y]?.[x - 1];
  if (displayGround === undefined || displayGround === anchorInk || display.side !== pitch - 1) return null;
  const current = orientedGlyph(sampleCycleGlyph(rows, display.point, display.side, display.scale), display.side, anchorInk, displayGround);
  if (!current) return null;
  const starts: NativePoint[] = [];
  for (let y = 0; y + pitch <= rows.length; y++) for (let x = 0; x + pitch <= rows[0]!.length; x++) {
    if (rows[y]![x] === body[0] && same(pixelsAt(rows, [x, y], pitch), body)) starts.push([x, y]);
  }
  if (starts.length !== 1) return null;
  const at = starts[0]!, points: NativePoint[] = [], shapes: NativePoint[] = [], charges: NativePoint[] = [];
  const possibleTurns: NativePoint[] = [], colors: { at: NativePoint; inks: Set<number> }[] = [];
  const exits: { at: NativePoint; wanted: OrientedGlyph }[] = [];
  for (let y = at[1] % pitch; y + pitch <= rows.length; y += pitch) {
    for (let x = at[0] % pitch; x + pitch <= rows[0]!.length; x += pitch) {
      const site: NativePoint = [x, y], tile = pixelsAt(rows, site, pitch), inks = new Set(tile);
      if (same(site, at) || (inks.size === 1 && inks.has(floor))) points.push(site);
      else if (same(tile, patternStation)) shapes.push(site);
      else if (tile.every((ink, i) => ink === (i % pitch > 0 && i % pitch < pitch - 1 && i >= pitch && i < tile.length - pitch
        ? gauge.active : floor))) charges.push(site);
      else if (tile.every((ink, i) => i >= pitch && i % pitch > 0 || ink === exitRim)) {
        const wanted = orientedGlyph(sampleCycleGlyph(rows, [x + 1, y + 1], display.side, 1), display.side, anchorInk, exitRim);
        if (wanted) exits.push({ at: site, wanted });
      } else if (inks.size >= 3 && !inks.has(floor) && inks.has(current.ink)) colors.push({ at: site, inks });
      else if (inks.size >= 3 && tile.filter(ink => ink === floor).length >= tile.length / 2) possibleTurns.push(site);
    }
  }
  if (shapes.length !== 1 || charges.length < 2 || charges.length > 12 || exits.length !== 1) return null;
  const { at: exit, wanted } = exits[0]!;
  const inkStations = colors.filter(site => site.inks.has(wanted.ink)), walking = new Set(points.map(pointKey));
  const possibleOrientation = possibleTurns.filter(([x, y]) => cycleMoves.filter(([, dx, dy]) =>
    walking.has(pointKey([x + dx * pitch, y + dy * pitch]))).length >= 2);
  if (inkStations.length !== 1 || possibleOrientation.length !== 1) return null;
  const shape = shapes[0]!, color = inkStations[0]!.at, orientation = possibleOrientation[0]!;
  const orientationStamp = pixelsAt(rows, orientation, pitch);
  const layout: Layout = { ...memory, points: [...points, shape, color, orientation, exit, ...charges], shape, color, orientation,
    orientationStamp, exit, charges, wanted, anchorInk, displayGround };
  return { epoch, layout, at, transitions, spent: 0, seen: [], refs: [memory.ref], stopped: false,
    ...(rotation && same(rotation.stamp, orientationStamp) ? { rotation: rotation.advance } : {}) };
}

function currentGlyph(rows: NativeRows, layout: Layout) {
  const { point, side, scale } = layout.display;
  return orientedGlyph(sampleCycleGlyph(rows, point, side, scale), side, layout.anchorInk, layout.displayGround);
}

function segments(start: NativePoint, sites: Site[], layout: Layout, moves: typeof cycleMoves[number][]): Segment[] {
  const destinations = new Map(sites.map((site, index) => [pointKey(site.point), index]));
  const ordinary = new Set(layout.points.map(pointKey)), reached = new Set([pointKey(start)]);
  const queue: { point: NativePoint; path: Omit<Segment, 'site'> | null }[] = [{ point: start, path: null }];
  const found: Segment[] = [];
  for (const { point, path } of queue) {
    for (const [action, dx, dy] of moves) {
      const next: NativePoint = [point[0] + dx * layout.pitch, point[1] + dy * layout.pitch], key = pointKey(next);
      if (reached.has(key) || !ordinary.has(key)) continue;
      reached.add(key);
      const step: CycleRouteLeg = { action, step: next };
      const leg = path ? { ...path, length: path.length + 1, legs: [...path.legs, step] }
        : { ...step, length: 1, legs: [step] };
      const destination = destinations.get(key);
      if (destination === undefined) queue.push({ point: next, path: leg });
      else found.push({ site: destination, ...leg });
    }
  }
  const here = destinations.get(pointKey(start));
  if (here !== undefined && sites[here]!.purpose.startsWith('test_')) {
    const neighbor = queue[1]?.path;
    if (neighbor) found.push({ site: here, ...neighbor, length: 2 });
  }
  return found;
}

function applyStation(glyph: OrientedGlyph, state: OrientedCycleState, purpose: Site['purpose']): OrientedGlyph | null {
  if (purpose === 'test_rotation') return { ...glyph, turn: (glyph.turn + (state.rotation ?? 1)) % 4 };
  if (purpose === 'test_color') {
    const ink = state.transitions.color[glyph.ink];
    return ink === undefined ? null : { ...glyph, ink };
  }
  if (purpose === 'test_shape') {
    const mask = state.transitions.shape[glyph.mask];
    return mask === undefined ? null : { ...glyph, mask };
  }
  return glyph;
}

const agrees = (a: OrientedGlyph, b: OrientedGlyph) => a.mask === b.mask && a.ink === b.ink && a.turn === b.turn;

export function chooseOrientedCycleStep(rows: NativeRows, state: OrientedCycleState, available: readonly string[],
  remaining: number): CompositeCycleStep | null {
  const { layout, at, spent } = state, glyph = currentGlyph(rows, layout);
  if (state.stopped || !glyph || !same(pixelsAt(rows, at, layout.pitch), layout.body)) return null;
  const units = readCycleReserve(rows, layout.gauge);
  const sites: Site[] = [
    { point: layout.shape, purpose: 'test_shape', charge: -1 }, { point: layout.color, purpose: 'test_color', charge: -1 },
    { point: layout.orientation, purpose: 'test_rotation', charge: -1 }, { point: layout.exit, purpose: 'exit', charge: -1 },
    ...layout.charges.flatMap((point, index) => spent & (1 << index) ? [] : [{ point, purpose: 'recharge' as const, charge: index }]),
  ];
  const moves = cycleMoves.filter(([action]) => available.includes(action)), maximum = Math.min(remaining, 600);
  const routes = sites.map(site => segments(site.point, sites, layout, moves));
  const start = sites.findIndex(site => same(site.point, at)), origin = start >= 0 ? start : routes.length;
  if (start < 0) routes.push(segments(at, sites, layout, moves));
  const queue: Flight[][] = Array.from({ length: maximum + 1 }, () => []);
  queue[0]!.push({ site: origin, units, spent, glyph });
  const best = new Map<string, number>();
  let finishing: CompositeCycleStep | null = null, finishCost = maximum + 1;
  for (let cost = 0; cost < finishCost && cost <= maximum; cost++) for (const flight of queue[cost]!) {
    const key = [flight.site, flight.glyph.mask, flight.glyph.ink, flight.glyph.turn, flight.spent].join(':');
    if ((best.get(key) ?? -1) >= flight.units) continue;
    best.set(key, flight.units);
    for (const leg of routes[flight.site]!) {
      const distance = cost + leg.length;
      if (distance > maximum || distance >= finishCost || leg.length >= flight.units) continue;
      const site = sites[leg.site]!, collecting = site.charge >= 0 && !(flight.spent & (1 << site.charge));
      const first: CompositeCycleStep = flight.first ?? { action: leg.action, step: leg.step, target: site.point, purpose: site.purpose,
        units, distance, charge: collecting && leg.length === 1 ? site.charge : -1, walk: leg.legs.slice(0, -1) };
      if (site.purpose === 'exit') {
        if (agrees(flight.glyph, layout.wanted)) { finishing = { ...first, distance }; finishCost = distance; }
        continue;
      }
      const after = applyStation(flight.glyph, state, site.purpose), energy = collecting ? layout.fullReserve : flight.units - leg.length;
      if (after && energy > 0) queue[distance]!.push({ site: leg.site, units: energy, glyph: after,
        spent: collecting ? flight.spent | (1 << site.charge) : flight.spent, first });
    }
  }
  return finishing;
}

export function observeOrientedCycleStep(first: NativeRows, second: NativeRows, state: OrientedCycleState, step: CompositeCycleStep) {
  const { layout } = state;
  if (!same(pixelsAt(second, step.step, layout.pitch), layout.body)) return null;
  const before = currentGlyph(first, layout), after = currentGlyph(second, layout);
  if (!before || !after) return null;
  const shape = before.mask !== after.mask, color = before.ink !== after.ink, turn = (after.turn - before.turn + 4) % 4;
  const recharge = step.charge >= 0, reserve = readCycleReserve(second, layout.gauge);
  if (recharge ? reserve <= step.units - 1 : reserve !== step.units - 1) return null;
  if (shape !== same(step.step, layout.shape) || color !== same(step.step, layout.color)
    || (turn !== 0) !== same(step.step, layout.orientation) || turn === 2) return null;
  const transitions = { shape: shape ? { ...state.transitions.shape, [before.mask]: after.mask } : state.transitions.shape,
    color: color ? { ...state.transitions.color, [before.ink]: after.ink } : state.transitions.color };
  const next: OrientedCycleState = { ...state, at: step.step, transitions,
    ...(turn ? { rotation: turn } : {}), spent: recharge ? state.spent | (1 << step.charge) : state.spent,
    layout: recharge && reserve !== layout.fullReserve ? { ...layout, fullReserve: reserve } : layout };
  return { state: next, reason: turn ? 'rotation_preserved_shape_and_color' : shape ? 'shape_preserved_color_and_orientation'
    : color ? 'color_preserved_shape_and_orientation' : recharge ? 'recharge_preserved_all_glyph_properties' : 'step_preserved_all_glyph_properties',
    evidence: turn ? 'The motif turned and retained its shape and color.' : shape ? 'The contact changed the shape and retained its color and orientation.'
      : color ? 'The contact changed the color and retained its shape and orientation.' : recharge ? 'Contact restored the reserve and retained the complete motif.' : undefined };
}
