import { framedPatterns } from '../logos-engine/v6-geometric-scene.ts';
import { searchManagedAccess } from '../logos-engine/v6-morphology-managed.ts';
import { centeredMorphologyEnclosures } from '../logos-engine/v6-morphology-measurements.ts';
import { geometricComponents, rotateMask } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves, type CycleRouteLeg, type CycleStep } from './inset-cycle-route.ts';
import { knownManagedWalk, pixelsAt, pointKey, reserveSteps, type BodyOnSurface, type FramedReserve, type FramedRotation, type FramedTransport } from './managed-framed-access.ts';

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
type MovingRotation = {
  rule: FramedRotation; sites: NativePoint[]; observations: NativePoint[]; witnesses: string[]; period?: number;
};
export type GlyphRouteState = {
  epoch: number; layout: Layout; at: NativePoint; landings: Landing[]; blocked: { from: NativePoint; to: NativePoint }[];
  spent: string[]; shapeEffects: Change[]; colorEffects: Change[]; refs: string[];
  rotation?: MovingRotation; retainedColors?: Change[];
};
type GlyphWalkLeg = CycleRouteLeg & { rotationAfter?: NativePoint };
export type GlyphRouteStep = Omit<CycleStep, 'purpose' | 'walk'> & {
  purpose: CycleStep['purpose'] | 'test_color' | 'test_rotation' | 'transport'; entry: NativePoint;
  effect: 'shape' | 'color' | 'rotation' | 'charge' | 'transport' | null;
  rotationAfter?: NativePoint; walk?: GlyphWalkLeg[];
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

export function readGlyphRoute(rows: NativeRows, memory: GlyphRouteMemory, epoch: number,
  rotation?: FramedRotation, retainedColors?: Change[]): GlyphRouteState | null {
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
  const site = rotation && rotationSite(rows, layout, rotation);
  return { epoch, layout, at, landings, blocked: [], spent: [], shapeEffects: [], colorEffects: [], refs: [memory.evidence],
    ...(site && rotation ? { rotation: { rule: rotation, sites: [site], observations: [site], witnesses: [] },
      ...(retainedColors?.length ? { retainedColors } : {}) } : {}) };
}

function rotationSite(rows: NativeRows, layout: Layout, rule: FramedRotation) {
  const sites = layout.positions.filter(point => same(pixelsAt(rows, point, layout.pitch), rule.station));
  return sites.length === 1 ? sites[0] : undefined;
}

function rotated(value: string, turns: number) {
  const points = value.split(';').map((token): NativePoint => {
    const [x, y] = token.split(',');
    return [Number(x), Number(y)];
  });
  return mask(rotateMask(points, turns));
}

function observeMovingRotation(rows: NativeRows, layout: Layout, track: MovingRotation, landed: NativePoint,
  from: Glyph, to: Glyph, ref: string): MovingRotation {
  const { period, rule, observations } = track;
  const expected = period ? observations.at(-period) : undefined;
  const confirmedContact = expected && same(landed, expected) && from.ink === to.ink
    && rotated(from.mask, rule.delta) === to.mask && from.mask !== to.mask;
  const site = rotationSite(rows, layout, rule) ?? (confirmedContact ? expected : undefined);
  if (!site) return { rule, sites: track.sites, observations: [], witnesses: [] };
  const history = [...observations.slice(-16), site];
  const sites = track.sites.some(point => same(point, site)) ? track.sites : [...track.sites, site];
  const nextPeriod = Array.from({ length: 7 }, (_, i) => i + 2).find(n => history.length > 2 * n
    && history.slice(-2 * n - 1, -n).every((point, i) => same(point, history[history.length - n - 1 + i]!))
    && history.slice(-n).some(point => !same(point, site)));
  return { rule, sites, observations: history, witnesses: [...track.witnesses.slice(-16), ref], ...(nextPeriod ? { period: nextPeriod } : {}) };
}

function chooseMovingGlyphRoute(rows: NativeRows, state: GlyphRouteState, current: Glyph,
  available: readonly string[], remaining: number): GlyphRouteStep | null {
  const { layout, rotation } = state, { pitch, reserve, wanted } = layout;
  if (!rotation?.period) return null;
  const cycle = rotation.observations.slice(-rotation.period);
  const sameShape = (value: string) => [0, 1, 2, 3].some(turn => rotated(value, turn) === wanted.mask);
  const visitedByStation = new Set(rotation.sites.map(pointKey));
  const usable = new Set([...layout.cells.map(pointKey), ...visitedByStation]);
  const charges = new Map(layout.charges.map((point, index) => [pointKey(point), 1 << index]));
  const spent = state.spent.reduce((result, key) => result | (charges.get(key) ?? 0), 0);
  const units = reserveSteps(rows, reserve), capacity = Math.floor((reserve.right - reserve.left) / reserve.cost);
  const landings = new Map(state.landings.map(edge => [pointKey(edge.entry), edge.to]));
  const blocked = new Set(state.blocked.map(edge => pointKey(edge.from) + '/' + pointKey(edge.to)));
  const directions = cycleMoves.filter(([action]) => available.includes(action) && layout.directions.includes(action));
  const edges = new Map([...usable].map(key => {
    const [x, y] = key.split(',').map(Number);
    return [key, directions.flatMap(([action, dx, dy]) => {
      const entry: NativePoint = [x! + dx * pitch, y! + dy * pitch], address = pointKey(entry);
      return usable.has(address) && !blocked.has(key + '/' + address)
        ? [{ action, entry, step: landings.get(address) ?? entry }] : [];
    })];
  }));
  const fromShape = new Map(state.shapeEffects.filter(change => change.from.ink === change.to.ink).map(change => [change.from.mask, change.to.mask]));
  const fromColor = new Map([...(state.retainedColors ?? []), ...state.colorEffects]
    .filter(change => change.from.mask === change.to.mask).map(change => [change.from.ink, change.to.ink]));
  const aligned = new Map<string, boolean>();
  const rotations = new Map<string, string>();
  type Leg = Pick<GlyphRouteStep, 'action' | 'step' | 'entry' | 'effect' | 'rotationAfter'>;
  type Node = { at: NativePoint; mask: string; ink: number; phase: number; units: number; spent: number; depth: number;
    first?: Leg; charge?: NativePoint; walk: GlyphWalkLeg[] };
  const queue: Node[] = [{ at: state.at, ...current, phase: cycle.length - 1, units, spent, depth: 0, walk: [] }];
  const best = new Map<string, number>();
  let frontier: { plan: GlyphRouteStep; score: number } | undefined;
  const route = (leg: Leg, target: NativePoint, purpose: GlyphRouteStep['purpose'], distance: number, walk: GlyphWalkLeg[]): GlyphRouteStep => {
    const contact = leg.effect === 'shape' ? 'test_shape' : leg.effect === 'color' ? 'test_color'
      : leg.effect === 'rotation' ? 'test_rotation' : leg.effect === 'charge' ? 'recharge' : leg.effect === 'transport' ? 'transport' : null;
    return { ...leg, target: contact ? leg.step : target, purpose: contact ?? purpose, units, distance,
      ...(walk.length > 1 ? { walk } : {}) };
  };
  for (let i = 0; i < queue.length && i < 35_000; i++) {
    const node = queue[i]!;
    if (node.depth >= remaining || node.units <= 0) continue;
    const phase = (node.phase + 1) % cycle.length, station = cycle[phase]!;
    for (const edge of edges.get(pointKey(node.at)) ?? []) {
      const landing = pointKey(edge.step), chargeBit = charges.get(landing) ?? 0, chargesNow = (chargeBit & node.spent) === 0 ? chargeBit : 0;
      const exact = node.mask === wanted.mask && node.ink === wanted.ink;
      const shape = same(edge.step, layout.shape), color = same(edge.step, layout.color), turn = same(edge.step, station);
      const effect = chargesNow ? 'charge' : shape ? 'shape' : color ? 'color' : turn ? 'rotation'
        : same(edge.entry, edge.step) ? null : 'transport';
      const first = node.first ?? { ...edge, effect, rotationAfter: station }, nextDepth = node.depth + 1, used = node.spent | chargesNow;
      const left = chargesNow ? capacity : node.units - 1;
      if (same(edge.step, layout.exit)) {
        if (exact) return route(first, layout.exit, 'exit', nextDepth, node.walk);
        continue;
      }
      if (left <= 0) continue;
      let nextMask = node.mask, nextInk = node.ink;
      if (shape) nextMask = fromShape.get(node.mask) ?? '';
      if (color) nextInk = fromColor.get(node.ink) ?? -1;
      if (!nextMask || nextInk < 0) {
        if (!aligned.has(node.mask)) aligned.set(node.mask, sameShape(node.mask));
        if (shape && aligned.get(node.mask) || color && node.ink === wanted.ink) continue;
        const nextCharge = node.charge;
        const score = nextDepth - left * 0.35 + (shape && node.ink !== wanted.ink ? 4 : 0);
        const target = first.effect === 'charge' ? first.step : nextCharge ?? edge.step;
        const purpose = nextCharge || first.effect === 'charge' ? 'recharge' : shape ? 'test_shape' : 'test_color';
        if (!frontier || score < frontier.score) frontier = { plan: route(first, target, purpose, nextDepth, node.walk), score };
        continue;
      }
      if (turn) {
        if (!rotations.has(nextMask)) rotations.set(nextMask, rotated(nextMask, rotation.rule.delta));
        nextMask = rotations.get(nextMask)!;
      }
      const key = [landing, nextMask, nextInk, phase, used].join('/');
      if ((best.get(key) ?? -1) >= left) continue;
      best.set(key, left);
      const walk = effect === null && !visitedByStation.has(landing) && node.walk.length === node.depth && node.depth < 8
        ? [...node.walk, { action: edge.action, step: edge.step, rotationAfter: station }] : node.walk;
      queue.push({ at: edge.step, mask: nextMask, ink: nextInk, phase, units: left, spent: used, depth: nextDepth,
        first, walk, charge: node.charge ?? (chargesNow ? edge.step : undefined) });
    }
  }
  return frontier?.plan ?? null;
}

export function chooseGlyphRoute(rows: NativeRows, state: GlyphRouteState, available: readonly string[], ref: string, remaining: number): GlyphRouteStep | null {
  const { layout, at } = state, { pitch, wanted, reserve, shape, color, exit } = layout;
  const current = readGlyph(rows, layout.shownBox, layout.display.scale);
  if (!current || !same(pixelsAt(rows, at, pitch), layout.actor)) return null;
  if (state.rotation?.period) return chooseMovingGlyphRoute(rows, state, current, available, remaining);
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
  // Once the station moves, observe each step until the cycle repeats.
  const walk = state.rotation && state.rotation.sites.length > 1 ? []
    : knownManagedWalk(plan.conditional_path).map(leg => ({ action: leg.command as Direction, step: leg.to }));
  return { action: first.command, step: first.to, target: effect === 'transport' ? first.to : goal.to,
    entry, effect, purpose, units, distance: plan.primitive_count, walk };
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
  const rotation = local.rotation && observeMovingRotation(second, layout, local.rotation, landed, before, after, ref);
  const rotatedOnContact = step.effect === 'rotation' && !!local.rotation && !changedInk && rotated(before.mask, local.rotation.rule.delta) === after.mask;
  const actualStation = rotation?.observations.at(-1);
  const phaseMatches = !step.rotationAfter || (actualStation ? same(step.rotationAfter, actualStation)
    : rotatedOnContact && same(step.rotationAfter, landed));
  const outcome = step.effect === 'rotation' ? rotatedOnContact : step.effect === 'shape' ? changedMask && !changedInk : step.effect === 'color' ? changedInk && !changedMask
    : step.effect === 'charge' ? collected : !changedMask && !changedInk && spentPixels === reserve.cost;
  const reason = !phaseMatches ? 'rotation_phase_changed' : rotatedOnContact ? 'rotation_contact_observed'
    : step.effect === 'shape' && changedMask ? 'shape_change_observed' : step.effect === 'color' && changedInk ? 'color_change_observed'
    : collected ? 'recharge_observed' : transported ? 'transport_landing_observed' : vacancy ? 'direction_blocked'
      : debitChanged ? 'reserve_debit_remeasured' : 'framed_piece_landing_observed';
  const evidence = rotatedOnContact ? 'Contact with the moving station rotated the glyph while preserving its color.'
    : reason === 'shape_change_observed' && !changedInk
    ? (after.mask === layout.wanted.mask ? 'The new shape matches the exit and the color stayed the same.' : 'The shape changed and the color stayed the same.')
    : reason === 'color_change_observed' && !changedMask
      ? (after.ink === layout.wanted.ink ? 'The new color matches the exit and the shape stayed the same.' : 'The color advanced to another value and the shape stayed the same.')
      : collected ? 'The reserve returned to full after contact.'
        : transported ? 'The animation showed where the same piece landed.'
          : debitChanged ? 'SIC recalculated the reserve using the cost measured on this level.' : undefined;
  return { matched: phaseMatches && outcome && same(landed, step.step), reason, evidence,
    state: { ...local, layout: updatedLayout, at: landed, landings, blocked, spent, shapeEffects, colorEffects,
      ...(rotation ? { rotation } : {}), refs: [...local.refs.slice(-5), ref] } };
}
