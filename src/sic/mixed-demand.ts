import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Item = { ink: number; box: NativeBox; stamp?: string };
type Shape = { ink: number; stamp: string; box: NativeBox };
type Calibration = { palette: readonly number[]; radius: { lower: number; upper: number; refs: readonly string[] };
  recipes: readonly { input: number; inputSide: number; output: number; outputSide: number; evidence: string }[];
  mobileEffect?: { refs: readonly string[] } };
type Layout = { arena: NativeBox; receivers: NativeBox[]; square: { ink: number; side: number; count: number; box: NativeBox };
  request: Shape; mobileRanks: number[] };
export type MixedDemand = { epoch: number; layout: Layout; glyphWasCentered?: true; squareReceiver?: NativeBox;
  refs: string[]; attempts: string[] };
type Intent = 'produce_square' | 'produce_glyph' | 'gather_pair' | 'redirect_contact' | 'deliver_square' | 'deliver_glyph';
export type MixedChoice = { point: NativePoint; intent: Intent; focus: Item[]; receiver?: NativeBox; attempt: string;
  squares: number; glyphs: number; inputs: number; target: NativePoint };

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
  const head = wanted[0]!, side = width(head.bbox), ink = head.palette_value;
  if (!wanted.every(e => e.palette_value === ink && width(e.bbox) === side)) return null;
  const marks = glyphs(rows, [Math.max(...alt[0]!.map(e => e.bbox[2])) + 1, 1, columns - 2, fieldTop - 1], mobileRanks);
  if (marks.length !== 1 || mobileRanks.indexOf(marks[0]!.ink) < 1) return null;
  const request = marks[0]!;
  const receivers = observation.entities.filter(e => !e.rectangular && width(e.bbox) === height(e.bbox)
    && width(e.bbox) > Math.max(side, width(request.box), height(request.box)) && e.area > width(e.bbox) ** 2 / 2
    && enclosing(arena, e.bbox) && !palette.includes(e.palette_value) && !mobileRanks.includes(e.palette_value)).map(e => e.bbox);
  if (receivers.length < wanted.length + 1 || receivers.length > 5) return null;
  return { epoch: observation.level_epoch, layout: { arena, receivers, square: { ink, side, count: wanted.length, box: head.bbox }, request, mobileRanks },
    refs: [...known.radius.refs.slice(-3), ...known.mobileEffect.refs.slice(-3)], attempts: [] };
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

export function chooseMixedDemand(observation: NativeObservation, rows: NativeRows, local: MixedDemand, known: Calibration) {
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
  const supply = pairs(stock).filter(([a, b]) => a.ink === b.ink && width(a.box) === width(b.box) && canProduce(a, demand, known));
  if (squares.length < demand.count && supply.length) {
    for (const group of supply) {
      const route = nearest(receivers, center(group[0].box));
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

  const earlierInk = mobileRanks[mobileRanks.indexOf(request.ink) - 1];
  const mobileInputs = mobs.filter(p => p.ink === earlierInk);
  if (!glyph) {
    const candidates = pairs(mobileInputs).sort(([a, b], [c, d]) => distance(center(a.box), center(b.box)) - distance(center(c.box), center(d.box)));
    for (const group of candidates) {
      const a = center(group[0].box), b = center(group[1].box), middle: NativePoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const zone = nearest(available, middle);
      const choice = offer('produce_glyph', group, all.filter(p => p !== group[0] && p !== group[1]), zone ? center(zone) : middle, zone);
      if (choice) return { local, choice };
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
  const before = choice.focus[0]!, anchor = center(before.box), { target } = choice;
  const candidates = (before.stamp ? mobs : stock).filter(p => p.ink === before.ink && width(p.box) === width(before.box)
    && (!before.stamp || p.stamp === before.stamp));
  const improved = candidates.some(p => distance(center(p.box), target) < distance(anchor, target));
  const transformed = squares.length > choice.squares;
  const matched = squares.length >= choice.squares && (choice.intent === 'produce_square' ? transformed
    : choice.intent === 'produce_glyph' ? requested.length > choice.glyphs && mobs.filter(p => p.ink === before.ink).length === choice.inputs - 2
    : improved || choice.intent === 'redirect_contact' && transformed);
  const reason = !matched ? 'mixed_demand_projection_not_confirmed' : choice.intent === 'produce_glyph' ? 'selected_pair_became_requested_glyph'
    : transformed ? 'additional_requested_square_observed' : 'observed_piece_approached_its_target';
  return { matched, reason, local: { ...local, refs: [...local.refs.slice(-6), observation.observation_ref],
    attempts: [...local.attempts.slice(-63), choice.attempt] } };
}
