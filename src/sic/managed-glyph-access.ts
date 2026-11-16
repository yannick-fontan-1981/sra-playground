import { framedPatterns } from '../logos-engine/v6-geometric-scene.ts';
import { searchManagedAccess } from '../logos-engine/v6-morphology-managed.ts';
import { centeredMorphologyEnclosures } from '../logos-engine/v6-morphology-measurements.ts';
import { geometricComponents, rotateMask } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves, type CycleStep } from './inset-cycle-route.ts';
import { pixelsAt, pointKey, reserveSteps, type BodyOnSurface, type FramedReserve, type FramedTransport } from './managed-framed-access.ts';

type Direction = CycleStep['action'];
type Glyph = { mask: string; ink: number };
type Band = { entry: NativePoint; vector: NativePoint; ink: number };
type Landing = { entry: NativePoint; to: NativePoint; evidence: string[] };
export type GlyphRouteMemory = {
  epoch: number; evidence: string; actor: number[]; pitch: number; floor: number; peerScale: number;
  reserve: FramedReserve; bandInks: number[]; directions: Direction[];
};
type Layout = GlyphRouteMemory & {
  positions: NativePoint[]; cells: NativePoint[]; charges: NativePoint[]; shape: NativePoint; color: NativePoint; exit: NativePoint;
  display: { point: NativePoint; side: number; scale: number }; shownBox: NativeBox; exitBox: NativeBox; wanted: Glyph;
};
type Change = { from: Glyph; to: Glyph; evidence: string };
export type GlyphRouteState = {
  epoch: number; layout: Layout; at: NativePoint; landings: Landing[]; blocked: { from: NativePoint; to: NativePoint }[];
  spent: string[]; shapeEffects: Change[]; colorEffects: Change[]; refs: string[];
};
export type GlyphRouteStep = Omit<CycleStep, 'purpose'> & {
  purpose: CycleStep['purpose'] | 'test_color' | 'transport'; entry: NativePoint;
  effect: 'shape' | 'color' | 'charge' | 'transport' | null;
};

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const mod = (n: number, m: number) => ((n % m) + m) % m;
const center = ([l, t, r, b]: NativeBox, pitch: number): NativePoint => [(l + r - pitch + 1) / 2, (t + b - pitch + 1) / 2];
const mask = (points: readonly NativePoint[]) => points.map(pointKey).sort().join(';');

function bands(rows: NativeRows, pitch: number, origin: NativePoint): Band[] {
  return geometricComponents(rows).flatMap(({ rectangular, area, bbox: [l, t, r, b], color: ink }) => {
    if (!rectangular || area !== pitch || Math.min(r - l, b - t) !== 0) return [];
    const candidates: Band[] = l === r
      ? [{ entry: [r + 1, t], vector: [1, 0], ink }, { entry: [l - pitch, t], vector: [-1, 0], ink }]
      : [{ entry: [l, b + 1], vector: [0, 1], ink }, { entry: [l, t - pitch], vector: [0, -1], ink }];
    return candidates.filter(({ entry }) => entry.every((value, i) => mod(value - origin[i]!, pitch) === 0));
  });
}

export function carriedBandInks(rows: NativeRows, body: BodyOnSurface, transports: readonly FramedTransport[]): number[] {
  const candidates = bands(rows, body.pitch, body.at);
  return [...new Set(transports.flatMap(transport => {
    const move = cycleMoves.find(([input]) => input === transport.action);
    if (!move) return [];
    const [, dx, dy] = move;
    const entry: NativePoint = [transport.from[0] + dx * body.pitch, transport.from[1] + dy * body.pitch];
    const x = transport.landing[0] - entry[0], y = transport.landing[1] - entry[1];
    return candidates.filter(band => same(band.entry, entry) && x * band.vector[1] === y * band.vector[0]
      && x * band.vector[0] + y * band.vector[1] > 0).map(band => band.ink);
  }))];
}

function readGlyph(rows: NativeRows, box: NativeBox, scale: number): Glyph | null {
  const [l, t, r, b] = box, ground = rows[t]?.[l];
  const points: NativePoint[] = [], colors = new Set<number>();
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const color = rows[y]![x]!;
    if (color !== ground) { points.push([x, y]); colors.add(color); }
  }
  if (!points.length || colors.size !== 1) return null;
  const x0 = Math.min(...points.map(p => p[0])), y0 = Math.min(...points.map(p => p[1]));
  const pixels = new Map<string, NativePoint>();
  for (const [x, y] of points) {
    const point: NativePoint = [Math.floor((x - x0) / scale), Math.floor((y - y0) / scale)];
    pixels.set(pointKey(point), point);
  }
  return points.length === pixels.size * scale * scale ? { mask: mask([...pixels.values()]), ink: [...colors][0]! } : null;
}

export function readGlyphRoute(rows: NativeRows, memory: GlyphRouteMemory, epoch: number): GlyphRouteState | null {
  const { pitch, actor, floor, reserve, peerScale, bandInks } = memory;
  if (!rows[reserve.row]?.slice(reserve.left, reserve.right).every(ink => ink === reserve.active || ink === reserve.depleted)) return null;
  const parts = geometricComponents(rows);
  const contours = new Set(centeredMorphologyEnclosures(rows, parts).map(item => JSON.stringify(item.box)));
  const patterns = framedPatterns(rows, parts).filter(item => contours.has(JSON.stringify(item.bbox)));
  const peer = patterns.find(item => item.scale === peerScale), shown = patterns.find(item => item.scale !== peerScale);
  if (patterns.length !== 2 || !peer || !shown || [0, 1, 2, 3].some(turn => mask(rotateMask(shown.mask, turn)) === mask(peer.mask))) return null;
  const actors: NativePoint[] = [];
  for (let y = 0; y + pitch <= rows.length; y++) for (let x = 0; x + pitch <= rows[y]!.length; x++) {
    if (rows[y]![x] === actor[0] && same(pixelsAt(rows, [x, y], pitch), actor)) actors.push([x, y]);
  }
  if (actors.length !== 1) return null;
  const at = actors[0]!, exit = center(peer.bbox, pitch);
  if (!exit.every((value, i) => mod(value - at[i]!, pitch) === 0)) return null;
  const positions: NativePoint[] = [], cells: NativePoint[] = [], clear: NativePoint[] = [];
  const shapes: NativePoint[] = [], colors: NativePoint[] = [], charges: NativePoint[] = [];
  const exitGround = rows[peer.bbox[1]]![peer.bbox[0]]!;
  for (let y = at[1] % pitch; y + pitch <= rows.length; y += pitch) for (let x = at[0] % pitch; x + pitch <= rows[y]!.length; x += pitch) {
    const point: NativePoint = [x, y], image = pixelsAt(rows, point, pitch), palette = new Set(image);
    positions.push(point);
    if (same(point, at) || same(point, exit)) { cells.push(point); continue; }
    const ordinary = image.every(ink => ink === floor);
    const nearExit = Math.abs(x - exit[0]) + Math.abs(y - exit[1]) === pitch;
    if (ordinary || (nearExit && palette.size === 2 && palette.has(floor) && palette.has(exitGround))) {
      cells.push(point);
      if (ordinary) clear.push(point);
      continue;
    }
    const foreground = image.flatMap((ink, i) => ink === floor ? [] : [i]);
    if (!foreground.length || foreground.length * 2 >= image.length || foreground.some(i =>
      i < pitch || i >= image.length - pitch || i % pitch === 0 || i % pitch === pitch - 1)) continue;
    if (palette.size === 2 && palette.has(reserve.active)) charges.push(point);
    else if (palette.size === 2) shapes.push(point);
    else if (palette.size >= 4 && palette.has(shown.color) && palette.has(peer.color)) colors.push(point);
  }
  if (shapes.length !== 1 || colors.length !== 1 || !charges.length || charges.length > 12) return null;
  const shape = shapes[0]!, color = colors[0]!, walkable = new Set(clear.map(pointKey));
  cells.push(shape, color, ...charges);
  const landings = bands(rows, pitch, at).flatMap(({ entry, vector: [dx, dy], ink }) => {
    if (!bandInks.includes(ink) || !walkable.has(pointKey(entry))) return [];
    let to = entry;
    while (walkable.has(pointKey([to[0] + dx * pitch, to[1] + dy * pitch]))) to = [to[0] + dx * pitch, to[1] + dy * pitch];
    return same(to, entry) ? [] : [{ entry, to, evidence: [memory.evidence] }];
  });
  if (new Set(landings.map(edge => pointKey(edge.entry))).size !== landings.length) return null;
  const layout = { ...memory, positions, cells, charges, shape, color, exit, shownBox: shown.bbox, exitBox: peer.bbox,
    display: { point: [shown.bbox[0], shown.bbox[1]] as NativePoint, side: (shown.bbox[2] - shown.bbox[0] + 1) / shown.scale, scale: shown.scale },
    wanted: { mask: mask(peer.mask), ink: peer.color } };
  return { epoch, layout, at, landings, blocked: [], spent: [], shapeEffects: [], colorEffects: [], refs: [memory.evidence] };
}

export function chooseGlyphRoute(rows: NativeRows, state: GlyphRouteState, available: readonly string[], ref: string, remaining: number): GlyphRouteStep | null {
  const { layout, at } = state, { pitch, wanted, reserve, shape, color, exit } = layout;
  const current = readGlyph(rows, layout.shownBox, layout.display.scale);
  if (!current || !same(pixelsAt(rows, at, pitch), layout.actor)) return null;
  const shapeNeeded = current.mask !== wanted.mask, colorNeeded = current.ink !== wanted.ink;
  if ((shapeNeeded && state.shapeEffects.some(effect => effect.from.mask === current.mask))
    || (colorNeeded && state.colorEffects.some(effect => effect.from.ink === current.ink))) return null;
  const units = reserveSteps(rows, reserve), context = { level_epoch: state.epoch, observation_ref: ref };
  const evidence = [ref, ...state.refs.filter(value => value !== ref)];
  const moves = Object.fromEntries(cycleMoves.filter(([action]) => available.includes(action) && layout.directions.includes(action))
    .map(([action, dx, dy]) => [action, [dx * pitch, dy * pitch]]));
  const preserveShape = shapeNeeded ? [] : layout.cells.filter(cell => Math.abs(cell[0] - shape[0]) + Math.abs(cell[1] - shape[1]) === pitch)
    .map(from => ({ from, to: shape }));
  const projected = { ...context, start: at, moves, cells: layout.cells,
    modifiers: [{ id: 'shape', sites: [shape], evidence }], peers: [{ id: 'exit', sites: [exit], evidence }],
    charges: layout.charges.map(point => ({ id: pointKey(point), sites: [point], evidence,
      status: state.spent.includes(pointKey(point)) ? 'consumed' : 'hypothesis' })),
    forced_landings: state.landings, edge_exclusions: [...state.blocked, ...preserveShape],
    color_state: { initial: current.ink, wanted: wanted.ink, mobile_site: layout.shownBox, features: [{ id: 'color', sites: [color], uncertain_sources: [],
      effects: colorNeeded ? [{ from_color: current.ink, to_color: wanted.ink, mobile_site: layout.shownBox }] : [] }] } };
  const meter = { ...context, steps_before_empty: units, capacity_steps: (reserve.right - reserve.left) / reserve.cost };
  const orientation = { ...context, modulus: 2, residual: Number(shapeNeeded), entry_delta: 1,
    status: 'revalidated_transfer_hypothesis', evidence };
  const plan = searchManagedAccess(projected, meter, orientation, { actionBudget: remaining, maxPrefix: 1, maxStates: 12000 }).options[0];
  const first = plan?.prefix[0], goal = plan?.next_composition;
  if (!first || !goal) return null;
  const vector = moves[first.command];
  if (!vector) return null;
  const entry: NativePoint = [at[0] + vector[0]!, at[1] + vector[1]!];
  const effect = first.modifier ? 'shape' : first.feature ? 'color' : first.charge ? 'charge' : first.conditional_crossing ? 'transport' : null;
  const purpose = effect === 'transport' ? 'transport' : goal.modifier ? 'test_shape' : goal.feature ? 'test_color' : goal.charge ? 'recharge' : 'exit';
  return { action: first.command, step: first.to, target: effect === 'transport' ? first.to : goal.to,
    entry, effect, purpose, units, distance: plan.primitive_count };
}

export function observeGlyphRoute(first: NativeRows, second: NativeRows, local: GlyphRouteState, step: GlyphRouteStep, ref: string) {
  const { layout, at } = local, { pitch, actor, reserve, shownBox, display } = layout;
  const possibilities = (same(pixelsAt(second, step.step, pitch), actor) ? [step.step]
    : layout.positions.filter(point => same(pixelsAt(second, point, pitch), actor)));
  const before = readGlyph(first, shownBox, display.scale), after = readGlyph(second, shownBox, display.scale);
  if (possibilities.length !== 1 || !before || !after) return null;
  const landed = possibilities[0]!, changedMask = before.mask !== after.mask, changedInk = before.ink !== after.ink;
  const activePixels = (rows: NativeRows) => rows[reserve.row]!.slice(reserve.left, reserve.right).filter(ink => ink === reserve.active).length;
  const remainingPixels = activePixels(second), spentPixels = activePixels(first) - remainingPixels;
  const change = { from: before, to: after, evidence: ref };
  const vacancy = same(landed, at), transported = !vacancy && !same(landed, step.entry);
  const width = reserve.right - reserve.left, collected = step.effect === 'charge' && remainingPixels === width;
  const debitChanged = !vacancy && step.effect !== 'charge' && spentPixels > 0 && spentPixels !== reserve.cost && width % spentPixels === 0;
  const updatedLayout = debitChanged ? { ...layout, reserve: { ...reserve, cost: spentPixels, samples: 1 } } : layout;
  const spent = step.effect === 'charge' && same(landed, step.step) ? [...local.spent, pointKey(landed)] : local.spent;
  const blocked = vacancy ? [...local.blocked, { from: at, to: step.entry }] : local.blocked;
  const knownLanding = local.landings.find(edge => same(edge.entry, step.entry));
  const landings = !vacancy && (transported || knownLanding) ? local.landings.filter(edge => !same(edge.entry, step.entry)) : local.landings;
  if (transported) landings.push({ entry: step.entry, to: landed, evidence: [ref] });
  const shapeEffects = step.effect === 'shape' && same(landed, step.step) ? [...local.shapeEffects, change] : local.shapeEffects;
  const colorEffects = step.effect === 'color' && same(landed, step.step) ? [...local.colorEffects, change] : local.colorEffects;
  const outcome = step.effect === 'shape' ? changedMask && !changedInk : step.effect === 'color' ? changedInk && !changedMask
    : step.effect === 'charge' ? collected : !changedMask && !changedInk && spentPixels === reserve.cost;
  const reason = step.effect === 'shape' && changedMask ? 'shape_change_observed' : step.effect === 'color' && changedInk ? 'color_change_observed'
    : collected ? 'recharge_observed' : transported ? 'transport_landing_observed' : vacancy ? 'direction_blocked'
      : debitChanged ? 'reserve_debit_remeasured' : 'framed_piece_landing_observed';
  const evidence = reason === 'shape_change_observed' && !changedInk
    ? (after.mask === layout.wanted.mask ? 'The new shape matches the exit and the color stayed the same.' : 'The shape changed and the color stayed the same.')
    : reason === 'color_change_observed' && !changedMask
      ? (after.ink === layout.wanted.ink ? 'The new color matches the exit and the shape stayed the same.' : 'The color advanced to another value and the shape stayed the same.')
      : collected ? 'The reserve returned to full after contact.'
        : transported ? 'The animation showed where the same piece landed.'
          : debitChanged ? 'SIC recalculated the reserve using the cost measured on this level.' : undefined;
  return { matched: outcome && same(landed, step.step), reason, evidence,
    state: { ...local, layout: updatedLayout, at: landed, landings, blocked, spent, shapeEffects, colorEffects, refs: [...local.refs.slice(-5), ref] } };
}
