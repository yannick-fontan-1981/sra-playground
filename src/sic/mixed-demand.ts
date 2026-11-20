import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { motionAnchor, planJointDelivery, type JointMotion } from './joint-demand-route.ts';

type Item = { ink: number; box: NativeBox; stamp?: string };
type Shape = { ink: number; stamp: string; box: NativeBox };
type Calibration = { palette: readonly number[]; radius: { lower: number; upper: number; refs: readonly string[] };
  recipes: readonly { input: number; inputSide: number; output: number; outputSide: number; evidence: string }[];
  mobileEffect?: { refs: readonly string[]; travel?: number } };
type SquareDemand = { ink: number; side: number; count: number; box: NativeBox };
type Layout = { arena: NativeBox; receivers: NativeBox[]; square: SquareDemand;
  request: Shape; mobileRanks: number[]; requirements?: SquareDemand[] };
export type MixedDemand = { epoch: number; layout: Layout; glyphWasCentered?: true; squareReceiver?: NativeBox;
  refs: string[]; attempts: string[]; motion?: JointMotion };
type Intent = 'produce_square' | 'produce_glyph' | 'gather_pair' | 'redirect_contact' | 'deliver_square' | 'deliver_glyph';
export type MixedChoice = { point: NativePoint; intent: Intent; focus: Item[]; receiver?: NativeBox; attempt: string;
  squares: number; glyphs: number; inputs: number; target: NativePoint;
  output?: { ink: number; count: number }; joint?: { anchors: number[]; mobileAffected: boolean } };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.hypot(x - a, y - b);
const gap = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) =>
  Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b));
const enclosing = ([l, t, r, b]: NativeBox, [a, c, d, e]: NativeBox) => l <= a && t <= c && r >= d && b >= e;
const square = (part: NativeEntity) => part.rectangular && width(part.bbox) === height(part.bbox);
const item = (e: NativeEntity): Item => ({ ink: e.palette_value, box: e.bbox });
const pairs = <T>(items: readonly T[]): [T, T][] => items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]));
const nearest = (zones: readonly NativeBox[], at: NativePoint) =>
  [...zones].sort((a, b) => distance(center(a), at) - distance(center(b), at))[0];
const ofDemand = (piece: Item, demand: SquareDemand) => piece.ink === demand.ink && width(piece.box) === demand.side;

function glyphs(rows: NativeRows, [left, top, right, bottom]: NativeBox, inks: readonly number[]): Shape[] {
  const visited = new Set<string>(), shapes: Shape[] = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const ink = rows[y]![x]!, key = x + ',' + y;
    if (!inks.includes(ink) || visited.has(key)) continue;
    const queue: NativePoint[] = [[x, y]];
    let l = x, t = y, r = x, b = y;
    visited.add(key);
    for (const [a, c] of queue) for (let py = c - 1; py <= c + 1; py++) for (let px = a - 1; px <= a + 1; px++) {
      const at = px + ',' + py;
      if (px < left || px > right || py < top || py > bottom || visited.has(at) || rows[py]![px] !== ink) continue;
      visited.add(at); queue.push([px, py]);
      l = Math.min(l, px); t = Math.min(t, py); r = Math.max(r, px); b = Math.max(b, py);
    }
    if (queue.length < 5 || queue.length > 20 || queue.length === (r - l + 1) * (b - t + 1)) continue;
    const stamp = queue.map(([px, py]) => [px - l, py - t].join(',')).sort().join(';');
    shapes.push({ ink, box: [l, t, r, b], stamp });
  }
  return shapes;
}

export function measureMixedDemand(observation: NativeObservation, rows: NativeRows, known: Calibration): MixedDemand | null {
  const columns = rows[0]?.length ?? 0, lines = rows.length, { palette, radius } = known;
  if (!known.mobileEffect || radius.lower < 1 || radius.upper - radius.lower > 5) return null;
  const header = observation.entities.filter(e => e.bbox[1] === 0 && width(e.bbox) === columns && height(e.bbox) > 1 && height(e.bbox) <= lines / 6);
  const reserve = observation.entities.filter(e => e.area === columns && height(e.bbox) === 1 && e.bbox[1] >= lines * 0.85);
  if (header.length !== 1 || reserve.length !== 1) return null;
  const fieldTop = header[0]!.bbox[3] + 1, arena: NativeBox = [1, fieldTop, columns - 2, reserve[0]!.bbox[1] - 1];
  const headerSquares = observation.entities.filter(e => e.bbox[1] > 0 && e.bbox[3] < fieldTop && square(e) && width(e.bbox) >= 2);
  const sampleRows = new Map<string, NativeEntity[]>();
  for (const e of headerSquares) {
    const key = [e.bbox[1], width(e.bbox)].join(','), samples = sampleRows.get(key) ?? [];
    samples.push(e); sampleRows.set(key, samples);
  }
  const swatches = [...sampleRows.values()].map(row => row.sort((a, b) => a.bbox[0] - b.bbox[0]));
  const legend = swatches.find(row => row.length === palette.length && row.every((e, i) => e.palette_value === palette[i]));
  if (!legend) return null;
  const size = width(legend[0]!.bbox);
  const alt = swatches.filter(row => row.length >= 2 && row.length <= 8 && row[0]!.bbox[1] > legend[0]!.bbox[1]
    && width(row[0]!.bbox) === size && row.every(e => !palette.includes(e.palette_value))
    && new Set(row.map(e => e.palette_value)).size === row.length);
  if (alt.length !== 1) return null;
  const mobileRanks = alt[0]!.map(e => e.palette_value);
  const wanted = headerSquares.filter(e => width(e.bbox) > size && palette.includes(e.palette_value));
  if (wanted.length < 2 || wanted.length > 4) return null;
  const demands = new Map<string, SquareDemand>();
  for (const e of wanted) {
    const ink = e.palette_value, side = width(e.bbox), key = [ink, side].join(',');
    const demand = demands.get(key);
    if (demand) demand.count++;
    else demands.set(key, { ink, side, count: 1, box: e.bbox });
  }
  const multiple = demands.size > 1 ? [...demands.values()] : undefined;
  const stock = multiple ? observation.entities.filter(e => enclosing(arena, e.bbox) && square(e)).map(item) : [];
  const primary = multiple?.find(demand => pairs(stock).some(([a, b]) =>
    a.ink === b.ink && width(a.box) === width(b.box) && canProduce(a, demand, known))) ?? [...demands.values()][0]!;
  const marks = glyphs(rows, [Math.max(...alt[0]!.map(e => e.bbox[2])) + 1, 1, columns - 2, fieldTop - 1], mobileRanks);
  if (marks.length !== 1 || mobileRanks.indexOf(marks[0]!.ink) < 1) return null;
  const request = marks[0]!;
  const receivers = observation.entities.filter(e => !e.rectangular && width(e.bbox) === height(e.bbox)
    && width(e.bbox) > Math.max(...[...demands.values()].map(demand => demand.side), width(request.box), height(request.box)) && e.area > width(e.bbox) ** 2 / 2
    && enclosing(arena, e.bbox) && !palette.includes(e.palette_value) && !mobileRanks.includes(e.palette_value)).map(e => e.bbox);
  if (receivers.length < wanted.length + 1 || receivers.length > 5) return null;
  return { epoch: observation.level_epoch, layout: { arena, receivers, square: primary, request, mobileRanks,
    ...(multiple ? { requirements: multiple } : {}) },
    refs: [...known.radius.refs.slice(-3), ...known.mobileEffect.refs.slice(-3)], attempts: [] };
}

function requestedStock(stock: readonly Item[], requirements: readonly SquareDemand[]) {
  return requirements.flatMap(demand => stock.filter(piece => ofDemand(piece, demand)).slice(0, demand.count));
}

export function calibrateMixedMotion(local: MixedDemand, choice: MixedChoice, first: NativeRows,
  frames: readonly NativeRows[], known: Calibration, observation: NativeObservation): JointMotion | undefined {
  if (!local.layout.requirements || !frames.length || !known.mobileEffect?.travel) return local.motion;
  if (local.motion) {
    if (!choice.joint || choice.joint.mobileAffected) return local.motion;
    const anchors = frames.flatMap(frame => {
      const matching = glyphs(frame, local.layout.arena, [local.layout.request.ink])
        .filter(piece => piece.stamp === local.layout.request.stamp);
      return matching.length === 1 ? [motionAnchor(matching[0]!.box)] : [];
    });
    const rates = anchors.slice(1).map(([x, y], i) => Math.max(Math.abs(x - anchors[i]![0]), Math.abs(y - anchors[i]![1])))
      .filter(rate => rate > 0 && rate <= local.motion!.stride);
    const typical = rates.length >= 2 && rates.every(rate => rate === rates[0]) ? rates[0] : undefined;
    return typical === undefined ? local.motion : { ...local.motion, pursuit: typical };
  }
  const [x, y] = choice.point, opening = frames[0]!, visible = [opening[0]!.length, opening.length];
  let radius: number | null = null, strength = 0;
  for (let r = Math.max(1, Math.floor(known.radius.lower)); r <= Math.ceil(known.radius.upper); r++) {
    const counts = new Map<number, number>();
    let shell = 0;
    for (let j = Math.max(0, y - r); j < Math.min(visible[1]!, y + r + 1); j++) {
      for (let i = Math.max(0, x - r); i < Math.min(visible[0]!, x + r + 1); i++) {
        if (Math.round(Math.hypot(i - x, j - y)) !== r) continue;
        shell++;
        const ink = opening[j]![i]!;
        if (ink !== first[j]?.[i]) counts.set(ink, (counts.get(ink) ?? 0) + 1);
      }
    }
    const count = Math.max(0, ...counts.values());
    if (count >= 12 && count >= 0.65 * shell && count > strength) {
      radius = r;
      strength = count;
    }
  }
  if (radius === null) return undefined;
  const ticks = Math.max(1, Math.min(8, Math.round(known.mobileEffect.travel / Math.SQRT2)));
  const largestSide = Math.max(...observation.entities.filter(e => square(e) && enclosing(local.layout.arena, e.bbox)
    && known.palette.includes(e.palette_value)).map(e => width(e.bbox)), local.layout.square.side);
  const stride = Math.ceil((known.radius.upper + Math.floor(largestSide / 2)) / ticks);
  // The more developed requested shape may move farther than its precursor. Recheck its rate in the returns.
  const pursuit = Math.max(1, local.layout.mobileRanks.indexOf(local.layout.request.ink));
  return { radius, ticks, stride, pursuit };
}

function readWorld(observation: NativeObservation, rows: NativeRows, { layout }: MixedDemand, known: Calibration) {
  const stock = observation.entities.filter(e => enclosing(layout.arena, e.bbox) && square(e) && known.palette.includes(e.palette_value)).map(item);
  const mobs = glyphs(rows, layout.arena, layout.mobileRanks);
  return { stock, mobs, squares: stock.filter(p => p.ink === layout.square.ink && width(p.box) === layout.square.side),
    requested: mobs.filter(m => m.ink === layout.request.ink && m.stamp === layout.request.stamp) };
}

function canProduce(input: Item, target: Layout['square'], known: Calibration): boolean {
  const rank = (ink: number) => known.palette.indexOf(ink), side = width(input.box);
  const recipe = known.recipes.find(r => r.input === input.ink && r.inputSide === side);
  if (recipe) return recipe.output === target.ink && recipe.outputSide === target.side;
  return known.recipes.length >= 2 && known.recipes.every(r => r.outputSide === r.inputSide + 1 && rank(r.output) === rank(r.input) + 1)
    && target.side === side + 1 && rank(target.ink) === rank(input.ink) + 1;
}

function segmentGap(at: NativePoint, from: NativePoint, to: NativePoint): number {
  const dx = to[0] - from[0], dy = to[1] - from[1], length = dx * dx + dy * dy;
  const step = length ? Math.max(0, Math.min(1, ((at[0] - from[0]) * dx + (at[1] - from[1]) * dy) / length)) : 0;
  return distance(at, [from[0] + step * dx, from[1] + step * dy]);
}

export function chooseMixedDemand(observation: NativeObservation, rows: NativeRows, local: MixedDemand, known: Calibration,
  shouldStop: () => boolean = () => false) {
  const { layout } = local, { stock, mobs, squares, requested } = readWorld(observation, rows, local, known);
  const { lower, upper } = known.radius, { arena, receivers, square: demand, mobileRanks, request } = layout;
  const [left, top, right, bottom] = arena, tried = new Set(local.attempts);
  const key = JSON.stringify([...stock, ...mobs].map(p => [p.ink, p.box, p.stamp]));
  const offer = (intent: Intent, focus: Item[], others: Item[], goal: NativePoint, receiver?: NativeBox): MixedChoice | null => {
    let point: NativePoint | null = null, rank = Infinity;
    for (let y = top; y < bottom; y++) for (let x = left; x <= right; x++) {
      const at: NativePoint = [x, y], score = distance(at, goal);
      if (score >= rank || tried.has(key + '>' + at.join(',')) || focus.some(p => gap(at, p.box) > lower)
        || others.some(p => gap(at, p.box) <= upper)) continue;
      point = at; rank = score;
    }
    return point && { point, intent, focus, ...(receiver ? { receiver } : {}), target: goal, attempt: key + '>' + point.join(','),
      squares: squares.length, glyphs: requested.length, inputs: mobs.filter(p => p.ink === focus[0]!.ink).length };
  };
  const deliver = (kind: 'deliver_square' | 'deliver_glyph', piece: Item, receiver: NativeBox, obstacles: Item[]) =>
    offer(kind, [piece], obstacles.filter(p => p !== piece), center(receiver), receiver);
  const all = [...stock, ...mobs], glyph = requested.length === 1 ? requested[0] : undefined;
  if (layout.requirements && glyph && mobs.length === 1 && local.motion) {
    const products = requestedStock(stock, layout.requirements);
    if (products.length === stock.length && products.length === layout.requirements.reduce((sum, demand) => sum + demand.count, 0)) {
      const pieces = [...products, glyph];
      const plan = planJointDelivery(pieces.map(piece => piece.box), arena, receivers, local.motion,
        point => tried.has(key + '>' + point.join(',')), shouldStop);
      if (!plan) return null;
      const focusIndex = Math.max(0, plan.affected.indexOf(true)), focus = pieces[focusIndex]!;
      const choice: MixedChoice = { point: plan.point, intent: focus.stamp ? 'deliver_glyph' : 'deliver_square', focus: [focus],
        target: [plan.anchors[2 * focusIndex]!, plan.anchors[2 * focusIndex + 1]!],
        attempt: key + '>' + plan.point.join(','), squares: squares.length, glyphs: requested.length, inputs: 0,
        joint: { anchors: plan.anchors, mobileAffected: plan.affected.at(-1) ?? false } };
      return { local, choice };
    }
  }
  const supply = pairs(stock).filter(([a, b]) => a.ink === b.ink && width(a.box) === width(b.box) && canProduce(a, demand, known));
  if (squares.length < demand.count && supply.length) {
    for (const group of supply) {
      const [a, b] = group.map(piece => center(piece.box));
      const route = nearest(receivers, layout.requirements ? [(a![0] + b![0]) / 2, (a![1] + b![1]) / 2] : a!);
      const choice = route && offer('produce_square', group, stock.filter(p => !group.includes(p)), center(route), route);
      if (choice) return { local, choice };
    }
  }

  const centered = (p: Item, zone: NativeBox) => distance(center(p.box), center(zone)) <= 1.75;
  const parked = squares.filter(p => receivers.some(z => centered(p, z)));
  const available = receivers.filter(z => !parked.some(p => centered(p, z)));
  if (!glyph && squares.length > 0 && parked.length === 0) {
    const zone = nearest(available, center(squares[0]!.box));
    const choice = zone && deliver('deliver_square', squares[0]!, zone, stock);
    if (choice) return { local, choice };
  }

  const requestRank = mobileRanks.indexOf(request.ink);
  const earlierInk = (layout.requirements ? mobileRanks.slice(0, requestRank).reverse()
    .find(ink => mobs.filter(piece => piece.ink === ink).length >= 2) : undefined) ?? mobileRanks[requestRank - 1];
  const nextInk = mobileRanks[mobileRanks.indexOf(earlierInk!) + 1];
  const mobileInputs = mobs.filter(p => p.ink === earlierInk);
  if (!glyph) {
    const candidates = pairs(mobileInputs).sort(([a, b], [c, d]) => distance(center(a.box), center(b.box)) - distance(center(c.box), center(d.box)));
    for (const group of candidates) {
      const a = center(group[0].box), b = center(group[1].box), middle: NativePoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const zone = nearest(available, middle);
      const choice = offer('produce_glyph', group, all.filter(p => p !== group[0] && p !== group[1]), zone ? center(zone) : middle, zone);
      if (choice) return { local, choice: { ...choice, ...(layout.requirements && nextInk !== undefined
        ? { output: { ink: nextInk, count: mobs.filter(piece => piece.ink === nextInk).length } } : {}) } };
    }
    for (const [a, b] of candidates) for (const [from, partner] of [[a, b], [b, a]] as const) {
      const toward = center(partner.box), choice = offer('gather_pair', [from], all.filter(p => p !== from), toward);
      if (choice && distance(choice.point, toward) + 1 < distance(center(from.box), toward)) return { local, choice };
    }
    return null;
  }

  const higher = stock.find(p => known.palette.indexOf(p.ink) === known.palette.indexOf(demand.ink) + 1);
  if (squares.length < demand.count && higher && mobileInputs.length === 1) {
    const spare = mobileInputs[0]!, current = gap(center(spare.box), higher.box);
    if (current > upper + 2) {
      const choice = offer('redirect_contact', [spare], all.filter(p => p !== spare), center(higher.box));
      if (choice && gap(choice.point, higher.box) + 1 < current) return { local, choice };
    }
  }

  const active = squares.find(p => !parked.includes(p));
  const squareReceiver = active && available.find(zone => zone.every((n, i) => n === local.squareReceiver?.[i]));
  const glyphZone = nearest(available.filter(z => z !== squareReceiver), center(glyph.box));
  if (!glyphZone) return null;
  if (!local.glyphWasCentered && distance(center(glyph.box), center(glyphZone)) > 1.25) {
    const choice = deliver('deliver_glyph', glyph, glyphZone, all);
    if (choice) return { local, choice };
  }
  const ready: MixedDemand = { ...local, glyphWasCentered: true };
  if (active) {
    const position = center(active.box);
    const cost = (zone: NativeBox) => {
      const at = center(zone), clearance = Math.min(...mobileInputs.map(p => segmentGap(center(p.box), position, at)));
      return distance(position, at) + 4 * Math.max(0, upper - clearance);
    };
    const target = squareReceiver ?? available.filter(z => z !== glyphZone).sort((a, b) => cost(a) - cost(b))[0];
    const choice = target && deliver('deliver_square', active, target, all);
    if (choice) return { local: { ...ready, squareReceiver: target }, choice };
  }
  const choice = deliver('deliver_glyph', glyph, glyphZone, all);
  return choice ? { local: ready, choice } : null;
}

export function observeMixedDemand(local: MixedDemand, choice: MixedChoice, observation: NativeObservation, rows: NativeRows, known: Calibration) {
  const { stock, mobs, squares, requested } = readWorld(observation, rows, local, known);
  const next: MixedDemand = { ...local, refs: [...local.refs.slice(-6), observation.observation_ref],
    attempts: [...local.attempts.slice(-63), choice.attempt] };
  if (choice.joint && local.layout.requirements) {
    const anchors = [...requestedStock(stock, local.layout.requirements), ...requested].flatMap(piece => motionAnchor(piece.box));
    const matched = anchors.length === choice.joint.anchors.length && anchors.every((axis, i) => axis === choice.joint!.anchors[i]);
    return { matched, reason: matched ? 'joint_delivery_projection_confirmed' : 'joint_delivery_projection_refuted', local: next };
  }
  const before = choice.focus[0]!, anchor = center(before.box), { target } = choice;
  const candidates = (before.stamp ? mobs : stock).filter(p => p.ink === before.ink && width(p.box) === width(before.box)
    && (!before.stamp || p.stamp === before.stamp));
  const improved = candidates.some(p => distance(center(p.box), target) < distance(anchor, target));
  const transformed = squares.length > choice.squares;
  const outputSeen = choice.output ? mobs.filter(p => p.ink === choice.output!.ink).length > choice.output.count : requested.length > choice.glyphs;
  const matched = squares.length >= choice.squares && (choice.intent === 'produce_square' ? transformed
    : choice.intent === 'produce_glyph' ? outputSeen && mobs.filter(p => p.ink === before.ink).length === choice.inputs - 2
    : improved || choice.intent === 'redirect_contact' && transformed);
  const reason = !matched ? 'mixed_demand_projection_not_confirmed' : choice.intent === 'produce_glyph'
    ? choice.output && choice.output.ink !== local.layout.request.ink ? 'intermediate_glyph_observed' : 'selected_pair_became_requested_glyph'
    : transformed ? 'additional_requested_square_observed' : 'observed_piece_approached_its_target';
  return { matched, reason, local: next };
}
