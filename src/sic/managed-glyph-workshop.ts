import { framedPatterns } from '../logos-engine/v6-geometric-scene.ts';
import { centeredMorphologyEnclosures } from '../logos-engine/v6-morphology-measurements.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cycleMoves } from './inset-cycle-route.ts';
import { pixelsAt, pointKey, type FramedRotation } from './managed-framed-access.ts';
import { bands, readGlyph, rotated, type Glyph, type GlyphRouteMemory, type GlyphRouteStep } from './managed-glyph-access.ts';

type Role = 'shape' | 'color' | 'rotation';
type Station = { role: Role; image: string };
type Snapshot = (NativePoint | null)[];
type Goal = { at: NativePoint; box: NativeBox; glyph: Glyph };
type Layout = GlyphRouteMemory & {
  display: { point: NativePoint; scale: number; side: number }; shownBox: NativeBox; exit: NativePoint; exitBox: NativeBox;
  positions: NativePoint[]; cells: NativePoint[]; goals: Goal[]; stations: Station[]; charges: NativePoint[]; turn: number;
};
type Effect = { from: Glyph; to: Glyph; evidence: string };
type Landing = { entry: NativePoint; to: NativePoint; evidence: string };
export type GlyphWorkshopState = {
  epoch: number; layout: Layout; at: NativePoint; refs: string[]; history: Snapshot[]; cycle?: Snapshot[];
  shapes: Effect[]; colors: Effect[]; landings: Landing[]; acquired: number; spent: number;
  blocked: string[]; visits: string[]; stopped?: true;
};
type Leg = Pick<GlyphRouteStep, 'action' | 'entry' | 'step' | 'effect'>;
type WalkLeg = Pick<Leg, 'action' | 'entry' | 'step'> & { expected: Glyph };
export type GlyphWorkshopStep = Omit<GlyphRouteStep, 'purpose' | 'walk'> & {
  purpose: GlyphRouteStep['purpose'] | 'track_stations'; goal: number; expected?: Glyph; walk?: WalkLeg[];
};

const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const same = (a: NativePoint | null, b: NativePoint) => !!a && equal(a, b);
const matches = (a: Glyph, b: Glyph) => a.ink === b.ink && a.mask === b.mask;
const imageAt = (rows: NativeRows, at: NativePoint, pitch: number) => pixelsAt(rows, at, pitch).join(',');
const reservePixels = (rows: NativeRows, { reserve }: Pick<Layout, 'reserve'>) =>
  rows[reserve.row]!.slice(reserve.left, reserve.right).filter(value => value === reserve.active).length;

function readStations(rows: NativeRows, layout: Layout): Snapshot {
  const slots: NativePoint[][] = layout.stations.map(() => []);
  const index = new Map(layout.stations.map((station, i) => [station.image, i]));
  for (const at of layout.positions) {
    const slot = index.get(imageAt(rows, at, layout.pitch));
    if (slot !== undefined) slots[slot]!.push(at);
  }
  return slots.map(items => items.length === 1 ? items[0]! : null);
}

export function readGlyphWorkshop(rows: NativeRows, memory: GlyphRouteMemory, epoch: number, rotation: FramedRotation | undefined,
  colors: Effect[] = []): GlyphWorkshopState | null {
  if (!rotation) return null;
  const { pitch, floor, actor, reserve, peerScale } = memory;
  const gauge = rows[reserve.row]?.slice(reserve.left, reserve.right);
  if (!gauge?.length || !gauge.every(ink => ink === reserve.active || ink === reserve.depleted)) return null;
  const parts = geometricComponents(rows);
  const contours = new Set(centeredMorphologyEnclosures(rows, parts, 'eligible_components').map(item => item.box.join(',')));
  const patterns = framedPatterns(rows, parts).filter(item => contours.has(item.bbox.join(',')));
  const peers = patterns.filter(item => item.scale === peerScale), displays = patterns.filter(item => item.scale !== peerScale);
  if (peers.length < 2 || peers.length > 6 || displays.length !== 1) return null;
  const shown = displays[0]!;
  const goals = peers.map(({ bbox: box, mask, color: ink }) => {
    const glyph = { mask: mask.map(pointKey).sort().join(';'), ink };
    const at: NativePoint = [(box[0] + box[2] - pitch + 1) / 2, (box[1] + box[3] - pitch + 1) / 2];
    return { glyph, at, box };
  });
  if (!readGlyph(rows, shown.bbox, shown.scale)) return null;
  const bodies: NativePoint[] = [];
  for (let y = 0; y + pitch <= rows.length; y++) for (let x = 0; x + pitch <= rows[y]!.length; x++) {
    if (rows[y]![x] === actor[0] && equal(pixelsAt(rows, [x, y], pitch), actor)) bodies.push([x, y]);
  }
  if (bodies.length !== 1) return null;
  const at = bodies[0]!;
  if (!goals.every(goal => goal.at.every((value, i) => (value - at[i]!) % pitch === 0))) return null;
  const cells: NativePoint[] = [], positions: NativePoint[] = [], charges: NativePoint[] = [];
  const stations: Station[] = [];
  const exitInks = new Set(goals.map(({ box: [x, y] }) => rows[y]![x]!));
  for (let y = at[1] % pitch; y + pitch <= rows.length; y += pitch) for (let x = at[0] % pitch; x + pitch <= rows[y]!.length; x += pitch) {
    const point: NativePoint = [x, y], image = pixelsAt(rows, point, pitch), inks = [...new Set(image)];
    positions.push(point);
    if (equal(point, at) || inks.length === 1 && inks[0] === floor || goals.some(goal => same(goal.at, point)
      || Math.abs(goal.at[0] - x) + Math.abs(goal.at[1] - y) === pitch
        && inks.length === 2 && inks.includes(floor) && inks.some(ink => exitInks.has(ink) && ink !== floor))) {
      cells.push(point);
      continue;
    }
    const foreground = image.flatMap((ink, i) => ink === floor ? [] : [i]);
    if (!foreground.length || foreground.length * 2 >= image.length || foreground.some(i =>
      i < pitch || i >= image.length - pitch || i % pitch === 0 || i % pitch === pitch - 1)) continue;
    if (inks.length === 2 && inks.includes(reserve.active)) {
      charges.push(point); cells.push(point); continue;
    }
    const role = equal(image, rotation.station) ? 'rotation' : inks.length === 2 ? 'shape'
      : inks.length >= 4 && (inks.includes(shown.color) || goals.some(goal => inks.includes(goal.glyph.ink))) ? 'color' : null;
    if (role) { cells.push(point); stations.push({ role, image: image.join(',') }); }
  }
  if (stations.length !== 3 || new Set(stations.map(item => item.role)).size !== 3 || !charges.length || charges.length > 8) return null;
  const usable = new Set(cells.map(pointKey));
  const landings = bands(rows, pitch, at).flatMap(({ entry, vector: [dx, dy], ink }) => {
    if (!memory.bandInks.includes(ink) || !usable.has(pointKey(entry))) return [];
    let to = entry;
    while (usable.has(pointKey([to[0] + dx * pitch, to[1] + dy * pitch]))) to = [to[0] + dx * pitch, to[1] + dy * pitch];
    return equal(to, entry) ? [] : [{ entry, to, evidence: memory.evidence }];
  });
  if (new Set(landings.map(edge => pointKey(edge.entry))).size !== landings.length) return null;
  const display = { point: [shown.bbox[0], shown.bbox[1]] as NativePoint, scale: shown.scale,
    side: (shown.bbox[2] - shown.bbox[0] + 1) / shown.scale };
  const layout = { ...memory, display, shownBox: shown.bbox, exit: goals[0]!.at, exitBox: goals[0]!.box,
    positions, cells, stations, goals, charges, turn: rotation.delta };
  return { epoch, layout, at, refs: [memory.evidence, rotation.evidence], history: [readStations(rows, layout)],
    shapes: [], colors, landings, acquired: 0, spent: 0, blocked: [], visits: [pointKey(at)] };
}

export function measureGlyphStationCycle(history: Snapshot[]): Snapshot[] | undefined {
  for (let period = 2; period <= 12 && history.length > 2 * period; period++) {
    const recent = history.slice(-2 * period);
    const cycle: Snapshot[] = recent.slice(period).map((snapshot, i) => snapshot.map((point, slot) => point ?? recent[i]![slot] ?? null));
    if (cycle.some(snapshot => snapshot.includes(null))) continue;
    const enough = cycle[0]!.every((_, slot) => {
      let matches = 0;
      for (let i = 0; i < period; i++) {
        const a = recent[i]![slot], b = recent[i + period]![slot];
        if (!a || !b) continue;
        if (!same(a, b)) return false;
        matches++;
      }
      return matches >= Math.ceil(period / 2);
    });
    if (enough && cycle.some(snapshot => snapshot.some((p, i) => !same(p, cycle[0]![i]!)))) {
      return [cycle.at(-1)!, ...cycle.slice(0, -1)];
    }
  }
  return undefined;
}

function edgesFrom(state: GlyphWorkshopState, available: readonly string[]) {
  const { layout: { cells, pitch, directions }, landings, blocked } = state;
  const usable = new Set(cells.map(pointKey)), landingByEntry = new Map(landings.map(edge => [pointKey(edge.entry), edge.to]));
  const excluded = new Set(blocked);
  const moves = cycleMoves.filter(([action]) => available.includes(action) && directions.includes(action));
  return new Map(cells.map(from => [pointKey(from), moves.flatMap(([action, dx, dy]) => {
    const entry: NativePoint = [from[0] + dx * pitch, from[1] + dy * pitch], key = pointKey(entry);
    if (!usable.has(key) || excluded.has(pointKey(from) + '/' + key)) return [];
    return [{ action, entry, step: landingByEntry.get(key) ?? entry }];
  })]));
}

function shapeProjection(effects: Effect[], current: Glyph): string | undefined {
  const candidates = new Set(effects.flatMap(({ from, to }) => [0, 1, 2, 3].flatMap(turn =>
    rotated(from.mask, turn) === current.mask ? [rotated(to.mask, turn)] : [])));
  return candidates.size === 1 ? [...candidates][0] : undefined;
}

const distanceBetween = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const rotationMatches = (mask: string, target: string) => [0, 1, 2, 3].some(turn => rotated(mask, turn) === target);

export function chooseGlyphWorkshopStep(rows: NativeRows, state: GlyphWorkshopState, available: readonly string[], remaining: number): GlyphWorkshopStep | null {
  const { layout, at, cycle } = state, { goals, charges, reserve, shownBox, display, turn } = layout;
  const current = readGlyph(rows, shownBox, display.scale);
  if (state.stopped || !current || remaining < 1 || !equal(pixelsAt(rows, at, layout.pitch), layout.actor)) return null;
  const outstanding = goals.map((_, i) => i).filter(i => !(state.acquired & (1 << i)));
  const goal = outstanding[0];
  if (goal === undefined) return null;
  const units = Math.floor(reservePixels(rows, layout) / reserve.cost), capacity = Math.floor((reserve.right - reserve.left) / reserve.cost);
  const edges = edgesFrom(state, available);
  const atGoal = new Map(outstanding.map(i => [pointKey(goals[i]!.at), i]));
  const chargeBits = new Map(charges.map((p, i) => [pointKey(p), 1 << i]));
  if (!cycle) {
    const visits = new Map<string, number>();
    for (const visit of state.visits) visits.set(visit, (visits.get(visit) ?? 0) + 1);
    const aligned = outstanding.some(i => goals[i]!.glyph.mask === current.mask);
    const reachesByRotation = outstanding.some(i => rotationMatches(current.mask, goals[i]!.glyph.mask));
    const desired = aligned ? 'color' : reachesByRotation ? 'rotation' : 'shape';
    const pursued = layout.stations.findIndex(station => station.role === desired);
    const focus = state.history.at(-1)![pursued];
    const knownShapeTrack = state.history.flatMap(snapshot => {
      const point = snapshot[layout.stations.findIndex(station => station.role === 'shape')];
      return point ? [point] : [];
    });
    const options = (edges.get(pointKey(at)) ?? []).filter(edge => !atGoal.has(pointKey(edge.step)))
      .map(edge => ({ edge, count: (visits.get(pointKey(edge.step)) ?? 0) + Number(units > 8 && chargeBits.has(pointKey(edge.step))) * 20
        + Number(reachesByRotation && knownShapeTrack.some(site => same(site, edge.step))) * 8
        + (focus ? distanceBetween(edge.step, focus) / layout.pitch * 0.35 : 0) }))
      .sort((a, b) => a.count - b.count);
    const move = options[0]?.edge;
    return move ? { ...move, effect: null, purpose: 'track_stations', target: move.step, units, distance: 1, goal } : null;
  }
  type Node = { at: NativePoint; glyph: Glyph; phase: number; left: number; used: number; acquired: number; depth: number;
    first?: GlyphWorkshopStep; nextGoal?: number; walk: WalkLeg[] };
  const queue: Node[] = [{ at, glyph: current, phase: 0, left: units, used: state.spent, acquired: state.acquired, depth: 0, walk: [] }];
  const best = new Map<string, number>(), shapeCache = new Map<string, string | undefined>(), turnCache = new Map<string, string>();
  const colorMap = new Map(state.colors.map(({ from, to }) => [from.ink, to.ink]));
  const allGoals = (1 << goals.length) - 1;
  const movingCells = new Set(cycle.flatMap(snapshot => snapshot.flatMap(site => site ? [pointKey(site)] : [])));
  let frontier: { step: GlyphWorkshopStep; score: number } | undefined;
  for (let i = 0; i < queue.length && i < 65_536; i++) {
    const node = queue[i]!;
    if (node.depth >= remaining || node.left <= 0) continue;
    const phase = (node.phase + 1) % cycle.length;
    const stationSites: Snapshot = cycle[phase]!;
    for (const edge of edges.get(pointKey(node.at)) ?? []) {
      const key = pointKey(edge.step), hit = atGoal.get(key);
      const wanted = hit !== undefined && !(node.acquired & (1 << hit)) ? hit : undefined;
      if (wanted !== undefined && !matches(node.glyph, goals[wanted]!.glyph)) continue;
      const acquired = wanted === undefined ? node.acquired : node.acquired | (1 << wanted);
      const nextGoal = node.nextGoal ?? wanted;
      const station = stationSites.findIndex(site => same(site, edge.step)), role = layout.stations[station]?.role;
      const bit = chargeBits.get(key) ?? 0, recovered = (node.used & bit) === 0 ? bit : 0;
      const used = node.used | recovered, left = recovered ? capacity : node.left - 1, depth = node.depth + 1;
      let nextGlyph: Glyph | undefined = node.glyph;
      const effect = recovered ? 'charge' : role ?? (equal(edge.entry, edge.step) ? null : 'transport');
      if (role === 'shape') {
        if (!shapeCache.has(node.glyph.mask)) shapeCache.set(node.glyph.mask, shapeProjection(state.shapes, node.glyph));
        const mask = shapeCache.get(node.glyph.mask);
        nextGlyph = mask === undefined ? undefined : { ...node.glyph, mask };
      } else if (role === 'color') {
        const ink = colorMap.get(node.glyph.ink);
        nextGlyph = ink === undefined ? undefined : { ...node.glyph, ink };
      } else if (role === 'rotation') {
        if (!turnCache.has(node.glyph.mask)) turnCache.set(node.glyph.mask, rotated(node.glyph.mask, turn));
        nextGlyph = { ...node.glyph, mask: turnCache.get(node.glyph.mask)! };
      }
      const first = node.first ?? { ...edge, effect, units, goal, distance: depth, target: edge.step, purpose: 'exit' as const,
        ...(nextGlyph ? { expected: nextGlyph } : {}) };
      const target = nextGoal === undefined ? edge.step : goals[nextGoal]!.at;
      const purpose: GlyphWorkshopStep['purpose'] = first.effect === 'shape' ? 'test_shape' : first.effect === 'color' ? 'test_color'
        : first.effect === 'rotation' ? 'test_rotation' : first.effect === 'charge' ? 'recharge'
          : first.effect === 'transport' ? 'transport' : !nextGlyph && role === 'shape' ? 'test_shape'
            : !nextGlyph && role === 'color' ? 'test_color' : 'exit';
      const route = { ...first, purpose, target: first.effect ? first.step : target, goal: nextGoal ?? goal, distance: depth,
        ...(node.walk.length > 1 ? { walk: node.walk } : {}) };
      if (acquired === allGoals) return route;
      if (left <= 0) continue;
      if (!nextGlyph) {
        const compatible = role === 'shape' && outstanding.some(i => !(acquired & (1 << i)) && rotationMatches(node.glyph.mask, goals[i]!.glyph.mask));
        const score = depth - left * 0.28 + Number(compatible) * 12 - Number(acquired !== state.acquired) * 12;
        if (!frontier || score < frontier.score) frontier = { step: route, score };
        continue;
      }
      const id = [key, phase, nextGlyph.mask, nextGlyph.ink, used, acquired].join('/');
      if ((best.get(id) ?? -1) >= left) continue;
      best.set(id, left);
      const walk = !effect && wanted === undefined && !movingCells.has(key) && node.walk.length === node.depth && node.depth < 8
        ? [...node.walk, { ...edge, expected: nextGlyph }] : node.walk;
      queue.push({ at: edge.step, glyph: nextGlyph, phase, left, used, acquired, depth, first, nextGoal, walk });
    }
  }
  return frontier?.step ?? null;
}

export function observeGlyphWorkshop(first: NativeRows, second: NativeRows, state: GlyphWorkshopState, step: GlyphWorkshopStep, ref: string) {
  const { layout, at, cycle } = state, { actor, pitch, shownBox, display, goals } = layout;
  const before = readGlyph(first, shownBox, display.scale), after = readGlyph(second, shownBox, display.scale);
  const bodies = layout.positions.filter(point => equal(pixelsAt(second, point, pitch), actor));
  if (!before || !after || bodies.length !== 1) return null;
  const landed = bodies[0]!, moved = !same(at, landed), tracked = readStations(second, layout);
  const predicted = cycle?.[moved ? 1 : 0];
  const changed = !matches(before, after);
  const role = !changed ? undefined : before.ink !== after.ink
    ? before.mask === after.mask ? 'color' : undefined
    : rotated(before.mask, layout.turn) === after.mask ? 'rotation' : 'shape';
  const station = role && layout.stations.findIndex(item => item.role === role);
  if (typeof station === 'number' && station >= 0 && moved && !tracked[station]
    && (!predicted || same(predicted[station]!, landed))) tracked[station] = landed;
  const phaseMatches = !predicted || tracked.every((point, i) => point ? same(predicted[i]!, point) : same(predicted[i]!, landed));
  const history = [...(phaseMatches ? state.history.slice(-25) : []), tracked];
  const nextCycle = cycle && phaseMatches ? moved ? [...cycle.slice(1), cycle[0]!] : cycle : measureGlyphStationCycle(history);
  const transferred = moved && !same(step.entry, landed);
  const contacted = moved ? goals.findIndex(goal => same(goal.at, landed) && matches(before, goal.glyph)) : -1;
  const found = contacted >= 0 && !framedPatterns(second, geometricComponents(second))
    .some(item => equal(item.bbox, goals[contacted]!.box)) ? contacted : -1;
  const charge = moved ? layout.charges.findIndex(point => same(point, landed)) : -1;
  const debit = reservePixels(first, layout) - reservePixels(second, layout), capacity = layout.reserve.right - layout.reserve.left;
  const tookCharge = charge >= 0 && reservePixels(second, layout) === capacity && debit <= 0;
  const observedCost = moved && !tookCharge && debit > 0 && capacity % debit === 0 ? debit : layout.reserve.cost;
  const witnessed = moved && typeof station === 'number' && station >= 0 && same(tracked[station]!, landed);
  const change = { from: before, to: after, evidence: ref };
  const debitMatches = !cycle || step.effect !== null || found >= 0 || debit === layout.reserve.cost;
  const matched = same(step.step, landed) && phaseMatches && debitMatches && (!step.expected || matches(step.expected, after));
  const reason = found >= 0 ? 'matching_exit_consumed' : tookCharge ? 'recharge_observed'
    : witnessed ? `moving_${role}_contact_observed` : transferred ? 'transport_landing_observed'
      : !moved ? 'direction_blocked' : !phaseMatches ? 'station_phase_changed' : 'framed_piece_landing_observed';
  const evidence = found >= 0 ? 'The matching frame disappeared after the piece entered its cell.'
    : tookCharge ? 'The reserve returned to full after contact.'
      : witnessed ? `Contact with the moving station changed the glyph's ${role}.`
        : transferred ? 'The same piece landed past the intended cell after forced movement.' : undefined;
  const { cycle: _cycle, ...previous } = state;
  return { matched, reason, evidence, state: {
    ...previous, layout: observedCost === layout.reserve.cost ? layout : { ...layout, reserve: { ...layout.reserve, cost: observedCost } },
    at: landed, history, ...(nextCycle ? { cycle: nextCycle } : {}),
    refs: [...state.refs.slice(-7), ref], visits: [...state.visits.slice(-47), pointKey(landed)],
    acquired: found >= 0 ? state.acquired | (1 << found) : state.acquired, spent: tookCharge ? state.spent | (1 << charge) : state.spent,
    blocked: moved ? state.blocked : [...state.blocked, pointKey(at) + '/' + pointKey(step.entry)],
    landings: moved && (transferred || state.landings.some(item => same(item.entry, step.entry)))
      ? [...state.landings.filter(item => !same(item.entry, step.entry)), ...(transferred ? [{ entry: step.entry, to: landed, evidence: ref }] : [])]
      : state.landings,
    shapes: witnessed && role === 'shape' ? [...state.shapes, change] : state.shapes,
    colors: witnessed && role === 'color' ? [...state.colors, change] : state.colors,
  } satisfies GlyphWorkshopState };
}
