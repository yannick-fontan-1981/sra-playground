import { framedPatterns } from '../logos-engine/v6-geometric-scene.ts';
import { centeredMorphologyEnclosures } from '../logos-engine/v6-morphology-measurements.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves } from './inset-cycle-route.ts';
import { bands, readGlyph, rotated, type Glyph, type GlyphRouteMemory } from './managed-glyph-access.ts';
import { pixelsAt, pointKey, reserveSteps, type FramedRotation } from './managed-framed-access.ts';

type Direction = typeof cycleMoves[number][0];
type Role = 'shape' | 'color' | 'rotation';
type Tile = 'wall' | 'floor' | 'charge' | 'shape' | 'color' | 'exit';
type Band = ReturnType<typeof bands>[number];
type Effect = { from: Glyph; to: Glyph; evidence: string };
type Target = { at: NativePoint; box: NativeBox; glyph: Glyph; rim: number };
type RotationSample = { at: NativePoint; tick: number };
type RotationModel = { axis: 0 | 1; cross: number; start: number; pitch: number; span: number; phase: number };

export type FogGlyphCarry = {
  memory: GlyphRouteMemory;
  display: { box: NativeBox; scale: number };
  stations: { role: Role; image: string }[];
  rotation: FramedRotation;
  shapes: Effect[];
  colors: Effect[];
};

export type FogGlyphRoute = {
  epoch: number;
  carry: FogGlyphCarry;
  at: NativePoint;
  positions: NativePoint[];
  hiddenInk: number;
  radius: number;
  glyph: Glyph;
  units: number;
  reservePixels: number;
  atlas: Record<string, Tile>;
  target: Target | null;
  bands: Record<string, Band>;
  landings: Record<string, NativePoint>;
  spent: string[];
  visited: string[];
  tried: string[];
  blocked: string[];
  samples: RotationSample[];
  refs: string[];
  shapes: Effect[];
  colors: Effect[];
  tick: number;
  stopped?: true;
};

type Edge = { action: Direction; entry: NativePoint; to: NativePoint; band?: Band; wait?: true };
export type FogGlyphStep = Edge & {
  need: 'discover_exit' | 'recharge' | 'shape' | 'color' | 'rotation' | 'exit' | 'discover_station';
  target: NativePoint;
  effect: Role | 'charge' | 'transport' | null;
  rotationConfidence?: number;
  units: number;
  distance: number;
};
type Route = { at: NativePoint; first: Edge | null; units: number; depth: number; consumed: bigint; spill: number };

const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const match = (a: Glyph, b: Glyph) => a.ink === b.ink && a.mask === b.mask;
const symmetry = (a: string, b: string) => [0, 1, 2, 3].some(turn => rotated(a, turn) === b);
const manhattan = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const center = ([l, t, r, b]: NativeBox, pitch: number): NativePoint => [(l + r - pitch + 1) / 2, (t + b - pitch + 1) / 2];
const activeReservePixels = (rows: NativeRows, reserve: GlyphRouteMemory['reserve']) =>
  rows[reserve.row]!.slice(reserve.left, reserve.right).filter(ink => ink === reserve.active).length;

export function fogGlyphPrediction(local: FogGlyphRoute, step: FogGlyphStep): { glyph: Glyph; refs: string[] } | null {
  const { glyph, shapes, colors, carry } = local;
  if (step.effect === 'rotation') return { glyph: { ...glyph, mask: rotated(glyph.mask, carry.rotation.delta) }, refs: [carry.rotation.evidence] };
  const candidates = step.effect === 'shape' ? shapes.flatMap(({ from, to, evidence }) =>
    from.ink === to.ink ? [0, 1, 2, 3].flatMap(turn =>
      rotated(from.mask, turn) === glyph.mask ? [{ glyph: { ...glyph, mask: rotated(to.mask, turn) }, refs: [evidence] }] : []) : [])
    : step.effect === 'color' ? colors.flatMap(({ from, to, evidence }) =>
      from.mask === to.mask && from.ink === glyph.ink ? [{ glyph: { ...glyph, ink: to.ink }, refs: [evidence] }] : []) : [];
  const first = candidates[0];
  return first && candidates.every(candidate => match(candidate.glyph, first.glyph))
    ? { glyph: first.glyph, refs: [...new Set(candidates.flatMap(candidate => candidate.refs))] } : null;
}

function locateActor(rows: NativeRows, { actor, pitch }: GlyphRouteMemory): NativePoint | null {
  const matches: NativePoint[] = [];
  for (let y = 0; y + pitch <= rows.length; y++) for (let x = 0; x + pitch <= rows[y]!.length; x++) {
    if (rows[y]![x] === actor[0] && pixelsAt(rows, [x, y], pitch).every((ink, i) => ink === actor[i])) matches.push([x, y]);
  }
  return matches.length === 1 ? matches[0]! : null;
}

function visibleTarget(rows: NativeRows, local: FogGlyphRoute): Target | null {
  const { carry: { display, memory: { peerScale, pitch } }, at } = local;
  const parts = geometricComponents(rows);
  const contours = new Set(centeredMorphologyEnclosures(rows, parts, 'eligible_components').map(item => item.box.join(',')));
  const peers = framedPatterns(rows, parts).flatMap(({ bbox: box, scale, color, mask }) => {
    const [l, t, r, b] = box, place = center(box, pitch);
    if (scale !== peerScale || r - l + 1 !== pitch + 2 || b - t + 1 !== pitch + 2 || !contours.has(box.join(','))
      || t >= display.box[1] || place.some((value, i) => (value - at[i]!) % pitch !== 0)) return [];
    return [{ at: place, box, glyph: { mask: mask.map(pointKey).sort().join(';'), ink: color }, rim: rows[t]![l]! }];
  });
  return peers.length === 1 ? peers[0]! : null;
}

function scanFog(rows: NativeRows, local: FogGlyphRoute, ref: string, rotationContact = false): FogGlyphRoute {
  const { carry: { memory: { pitch, floor, reserve, bandInks }, stations }, at, hiddenInk } = local;
  const target = visibleTarget(rows, local) ?? local.target;
  const atlas = { ...local.atlas }, strips = { ...local.bands };
  const roles = new Map(stations.map(station => [station.image, station.role]));
  const visibleBands = bands(rows, pitch, at).filter(band => bandInks.includes(band.ink));
  for (const band of visibleBands) strips[pointKey(band.entry)] = band;
  const rotation: NativePoint[] = [];
  for (const point of local.positions) {
    const key = pointKey(point), image = pixelsAt(rows, point, pitch);
    if (target && same(point, target.at)) { atlas[key] = 'exit'; continue; }
    if (same(point, at)) {
      if (local.spent.includes(key)) atlas[key] = 'floor';
      else atlas[key] ??= 'floor';
      continue;
    }
    if (target && manhattan(point, target.at) === pitch && image.every(ink => ink === floor || ink === target.rim)
      && image.filter(ink => ink === floor).length >= pitch * (pitch - 1)) {
      atlas[key] = 'floor'; continue;
    }
    if (image.includes(hiddenInk)) continue;
    if (image.every(ink => ink === floor)) { atlas[key] = 'floor'; continue; }
    const role = roles.get(image.join(','));
    if (role === 'rotation') { atlas[key] = 'floor'; rotation.push(point); continue; }
    if (role) { atlas[key] = role; continue; }
    const foreground = image.flatMap((ink, i) => ink === floor ? [] : [i]);
    const interior = foreground.length * 2 < image.length && foreground.every(i =>
      i >= pitch && i < image.length - pitch && i % pitch !== 0 && i % pitch !== pitch - 1);
    if (interior && foreground.every(i => image[i] === reserve.active)) {
      atlas[key] = local.spent.includes(key) ? 'floor' : 'charge'; continue;
    }
    const strip = strips[key];
    if ((strip && foreground.every(i => image[i] === strip.ink)) || interior) {
      atlas[key] = 'floor'; continue;
    }
    atlas[key] = 'wall';
  }
  const measured = rotationContact ? at : rotation.length === 1 ? rotation[0] : undefined;
  return { ...local, atlas, target, bands: strips, refs: [...local.refs.slice(-7), ref],
    samples: measured ? [...local.samples.slice(-23), { at: measured, tick: local.tick }] : local.samples };
}

export function readFogGlyphRoute(rows: NativeRows, carry: FogGlyphCarry, epoch: number, ref: string): FogGlyphRoute | null {
  const { memory, display } = carry, { pitch, floor, reserve } = memory, at = locateActor(rows, memory);
  const hiddenInk = rows[0]?.[0], width = rows[0]?.length ?? 0;
  if (!at || hiddenInk === undefined || hiddenInk === floor || memory.actor.includes(hiddenInk)
    || hiddenInk !== rows[0]?.[width - 1]
    || rows.slice(0, display.box[1]).flat().filter(ink => ink === hiddenInk).length < width * display.box[1] / 3) return null;
  const glyph = readGlyph(rows, display.box, display.scale, hiddenInk);
  const units = reserveSteps(rows, reserve);
  if (!glyph || units < 1 || !rows[reserve.row]?.slice(reserve.left, reserve.right).every(ink => ink === reserve.active || ink === reserve.depleted)) return null;
  const positions: NativePoint[] = [];
  const firstRow = at[1] % pitch;
  const fieldEnd = firstRow + Math.ceil((display.box[1] - firstRow) / pitch) * pitch;
  for (let y = firstRow; y + pitch <= fieldEnd; y += pitch) for (let x = at[0] % pitch; x + pitch <= width; x += pitch)
    positions.push([x, y]);
  if (!positions.some(point => same(point, at))) return null;
  const radius = Math.max(pitch * 2, ...positions.filter(point => !pixelsAt(rows, point, pitch).includes(hiddenInk))
    .map(point => Math.hypot(point[0] - at[0], point[1] - at[1])));
  return scanFog(rows, { epoch, carry, at, positions, hiddenInk, radius, glyph, units, reservePixels: activeReservePixels(rows, reserve),
    atlas: {}, target: null,
    bands: {}, landings: {}, spent: [], visited: [pointKey(at)], tried: [], blocked: [], samples: [], refs: [memory.evidence],
    shapes: carry.shapes, colors: carry.colors, tick: 0 }, ref);
}

function modeledRotation(state: FogGlyphRoute): RotationModel[] {
  const { samples, carry: { memory: { pitch } } } = state;
  const last = samples.at(-1);
  if (!last || samples.length < 2) return [];
  const models: RotationModel[] = [];
  for (const axis of [0, 1] as const) {
    const other = axis === 0 ? 1 : 0, cross = last.at[other];
    if (samples.some(s => s.at[other] !== cross)) continue;
    const seats = state.positions.filter(point => point[other] === cross && state.atlas[pointKey(point)] !== 'wall');
    for (const [i, start] of seats.entries()) for (const end of seats.slice(i + 1)) {
      const span = (end[axis] - start[axis]) / pitch;
      if (span < 1 || samples.some(s => s.at[axis] < start[axis] || s.at[axis] > end[axis])) continue;
      for (let phase = 0; phase < 2 * span; phase++) {
        const model = { axis, cross, start: start[axis], pitch, span, phase };
        if (samples.every(sample => same(rotationAt(model, sample.tick), sample.at))) models.push(model);
      }
    }
  }
  return models;
}

function rotationAt(model: RotationModel, tick: number): NativePoint {
  const phase = (model.phase + tick) % (2 * model.span);
  const along = model.start + Math.min(phase, 2 * model.span - phase) * model.pitch;
  return model.axis === 0 ? [along, model.cross] : [model.cross, along];
}

const effectFor = (tile: Tile | undefined): FogGlyphStep['effect'] =>
  tile === 'charge' || tile === 'shape' || tile === 'color' ? tile : null;
const edgeKey = (at: NativePoint, action: Direction) => pointKey(at) + '/' + action;

export function chooseFogGlyphStep(state: FogGlyphRoute, available: readonly string[], remaining: number): FogGlyphStep | null {
  const { at, glyph, target, atlas, positions, bands: strips, landings, units, carry: { memory: { pitch, reserve, directions } } } = state;
  const capacity = Math.floor((reserve.right - reserve.left) / reserve.cost);
  const valid = new Set(positions.map(pointKey)), blocked = new Set(state.blocked), visited = new Set(state.visited);
  const observed = Object.keys(atlas).length, chargeSites = positions.filter(p => atlas[pointKey(p)] === 'charge');
  const chargeBits = new Map(chargeSites.map((site, i) => [pointKey(site), 1n << BigInt(i)]));
  const move = cycleMoves.filter(([action]) => available.includes(action) && directions.includes(action));
  if (state.stopped || !move.length || units < 1 || remaining < 1) return null;
  const need: FogGlyphStep['need'] = !target ? 'discover_exit' : !symmetry(glyph.mask, target.glyph.mask) ? 'shape'
    : glyph.ink !== target.glyph.ink ? 'color' : glyph.mask !== target.glyph.mask ? 'rotation' : 'exit';
  const models = need === 'rotation' ? modeledRotation(state) : [];
  const lastRotation = state.samples.at(-1);
  const rotationConfidence = (point: NativePoint, depth: number) => models.length
    ? models.filter(model => same(rotationAt(model, state.tick + depth), point)).length / models.length : 0;
  const edges = (from: NativePoint): Edge[] => move.flatMap(([action, dx, dy]): Edge[] => {
    if (blocked.has(edgeKey(from, action))) return [];
    const entry: NativePoint = [from[0] + dx * pitch, from[1] + dy * pitch], key = pointKey(entry);
    if (!valid.has(key)) return [];
    const band = strips[key], landing = landings[key];
    if (band && !landing) return [{ action, entry, to: entry, band }];
    if (atlas[key] === 'wall' || !atlas[key]) return atlas[key] === 'wall' && models.length ? [{ action, entry, to: from, wait: true }] : [];
    return [{ action, entry, to: landing ?? entry }];
  });

  let exact: { rank: number; step: FogGlyphStep } | null = null;
  let exploration: { rank: number; step: FogGlyphStep } | null = null;
  let replenish: { rank: number; step: FogGlyphStep } | null = null;
  const queue: Route[] = [{ at, first: null, units, depth: 0, consumed: 0n, spill: 0 }];
  const keep = new Map<string, number>();
  const propose = (node: Route, intent: FogGlyphStep['need'], focus: NativePoint, effect: FogGlyphStep['effect']): FogGlyphStep => ({
    ...node.first!, target: focus, need: intent, effect, units: node.units, distance: node.depth,
  });
  for (let cursor = 0; cursor < queue.length && cursor < 15_000; cursor++) {
    const node = queue[cursor]!;
    if (node.depth >= remaining || node.units < 1) continue;
    for (const edge of edges(node.at)) {
      const key = pointKey(edge.to), tile = atlas[key], bit = chargeBits.get(key) ?? 0n, depth = node.depth + 1;
      const charge = bit !== 0n && !(node.consumed & bit);
      const next = { at: edge.to, first: node.first ?? edge, units: charge ? capacity : node.units - 1,
        depth, consumed: node.consumed | bit, spill: node.spill + (charge ? node.units - 1 : 0) };
      const first = next.first;
      const actualEffect = first.band || !same(first.entry, first.to) && !first.wait ? 'transport'
        : effectFor(atlas[pointKey(first.to)]);
      const routeCost = depth + next.spill / 8;
      const viable = next.units >= 1;
      if (charge && units < capacity && routeCost < (replenish?.rank ?? Infinity))
        replenish = { rank: routeCost, step: propose(next, 'recharge', edge.to, actualEffect) };
      const compatibleSite = need === 'exit' ? target && same(edge.to, target.at) : need === 'shape' || need === 'color'
        ? tile === need && !state.tried.includes(key + '/' + glyph.ink + '/' + glyph.mask) : false;
      const rotation = need === 'rotation' ? rotationConfidence(edge.to, depth) : 0;
      if (!edge.band && (compatibleSite || rotation > 0) && (need === 'exit' || next.units >= 3)) {
        const rank = routeCost + (rotation > 0 ? 8 * (1 - rotation) : 0);
        if (rank < (exact?.rank ?? Infinity)) {
          const confidence = rotationConfidence(first.to, 1);
          exact = { rank, step: { ...propose(next, need, edge.to, confidence > 0 ? 'rotation' : actualEffect),
            ...(confidence > 0 ? { rotationConfidence: confidence } : {}) } };
        }
      }
      if (tile === 'exit' && need !== 'exit' || (tile === 'shape' || tile === 'color') && need !== tile && !!target) continue;

      const frontier = edge.band && viable || !edge.wait && viable && !visited.has(key);
      if (frontier && next.units >= 5) {
        const reveal = positions.filter(p => !atlas[pointKey(p)] && Math.hypot(p[0] - edge.to[0], p[1] - edge.to[1]) <= state.radius).length;
        const closer = need === 'rotation' && lastRotation
          ? (manhattan(at, lastRotation.at) - manhattan(edge.to, lastRotation.at)) / pitch : 0;
        const rank = (edge.band ? 13 : reveal) / (1 + routeCost / 5) + 1.7 * closer
          + Math.min(0, next.units - 8) - next.spill / 10;
        if ((rank > 0 || !observed) && rank > (exploration?.rank ?? -Infinity))
          exploration = { rank, step: propose(next, target ? 'discover_station' : 'discover_exit', edge.to, actualEffect) };
      }
      if (edge.band || !viable || tile === 'exit' || compatibleSite) continue;
      const signature = key + '/' + next.consumed + (models.length ? '/' + depth % 24 : '');
      if ((keep.get(signature) ?? Infinity) <= routeCost) continue;
      keep.set(signature, routeCost);
      queue.push(next);
    }
  }
  if (exact) return exact.step;
  if (units <= Math.ceil(capacity / 3) && replenish) return replenish.step;
  return exploration?.step ?? replenish?.step ?? null;
}

export function observeFogGlyphStep(rows: NativeRows, local: FogGlyphRoute, step: FogGlyphStep, ref: string) {
  const { carry: { display, memory, rotation }, glyph } = local;
  const at = locateActor(rows, memory), next = readGlyph(rows, display.box, display.scale, local.hiddenInk);
  const gauge = rows[memory.reserve.row]?.slice(memory.reserve.left, memory.reserve.right);
  if (!at || !next || !gauge?.every(ink => ink === memory.reserve.active || ink === memory.reserve.depleted)) return null;
  const pixels = activeReservePixels(rows, memory.reserve), spentPixels = local.reservePixels - pixels;
  const [dx, dy] = step.band?.vector ?? [0, 0];
  const deltaX = at[0] - step.entry[0], deltaY = at[1] - step.entry[1];
  const transport = !!step.band && deltaX * dy === deltaY * dx && deltaX * dx + deltaY * dy > 0;
  const landed = same(at, step.to), blockedMove = same(at, local.at) && !step.wait && !same(at, step.to);
  if (!transport && !landed && !blockedMove) return null;
  const role = effectFor(local.atlas[pointKey(at)]);
  const rotatedGlyph = glyph.ink === next.ink && glyph.mask !== next.mask && rotated(glyph.mask, rotation.delta) === next.mask;
  const rotationContact = rotatedGlyph && role !== 'shape';
  const change = { from: glyph, to: next, evidence: ref };
  const shapes = role === 'shape' && glyph.mask !== next.mask ? [...local.shapes.slice(-23), change] : local.shapes;
  const colors = role === 'color' && glyph.ink !== next.ink ? [...local.colors.slice(-23), change] : local.colors;
  const charged = role === 'charge' && pixels >= local.reservePixels && !same(at, local.at);
  const cost = !charged && pixels > 0 && spentPixels > 0
    ? local.tick === 0 ? spentPixels : Math.max(spentPixels, memory.reserve.cost) : memory.reserve.cost;
  const carry = cost === memory.reserve.cost ? local.carry : { ...local.carry, memory: { ...memory,
    reserve: { ...memory.reserve, cost } } };
  const forecast = fogGlyphPrediction(local, step);
  const glyphContradicted = !!forecast && (step.effect !== 'rotation' || step.rotationConfidence === 1) && !match(forecast.glyph, next);
  const position = pointKey(at);
  const state = scanFog(rows, { ...local, carry, at, glyph: next, units: Math.floor(pixels / cost), reservePixels: pixels,
    shapes, colors, tick: local.tick + 1,
    visited: local.visited.includes(position) ? local.visited : [...local.visited, position],
    spent: charged ? [...local.spent, position] : local.spent,
    landings: transport ? { ...local.landings, [pointKey(step.entry)]: at } : local.landings,
    tried: !match(next, glyph) || role !== 'shape' && role !== 'color' ? local.tried
      : [...local.tried, position + '/' + glyph.ink + '/' + glyph.mask],
    blocked: blockedMove ? [...local.blocked, edgeKey(local.at, step.action)] : local.blocked,
  }, ref, rotationContact);
  return { state, matched: (landed || transport) && !glyphContradicted,
    evidence: glyphContradicted ? 'retained_glyph_effect_contradicted' : transport ? 'fog_transport_landing_measured'
    : charged ? 'fog_reserve_restored' : rotationContact ? 'fog_rotation_contact_measured'
      : !match(glyph, next) ? 'fog_station_effect_measured' : state.target && !local.target ? 'fog_matching_exit_revealed'
        : blockedMove ? 'fog_route_edge_contradicted' : 'fog_position_and_reserve_confirmed' };
}
