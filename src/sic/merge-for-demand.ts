import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeEntity, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal,
  NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseContactDemand, contactMobileBox, measureContactDemand, observeContactDemand, type ContactChoice,
  type ContactDemand } from './contact-demand.ts';
import { calibrateMixedMotion, chooseMixedDemand, measureMixedDemand, observeMixedDemand, type MixedChoice, type MixedDemand } from './mixed-demand.ts';

export const mergeForDemandId = 'sic_merge_to_meet_visible_demand';

type Piece = { readonly color: number; readonly side: number; readonly box: NativeBox; readonly point: NativePoint };
type Scene = { readonly samples: readonly Piece[]; readonly demand: Piece; readonly receptor: NativeBox;
  readonly field: readonly [number, number]; readonly probeRange: number;
  readonly requirements?: readonly Piece[]; readonly receivers?: readonly NativeBox[]; readonly screenWidth?: number };
type Recipe = { readonly input: number; readonly inputSide: number; readonly output: number; readonly outputSide: number;
  readonly evidence: string };
type Motion = { readonly color: number; readonly side: number; readonly range: number; readonly evidence: string };
type Radius = { readonly lower: number; readonly upper: number; readonly refs: readonly string[] };
type Transfer = { readonly palette: readonly number[]; readonly recipes: readonly Recipe[]; readonly motion: readonly Motion[];
  readonly radius: Radius; readonly mobileEffect?: Pick<Pressure, 'travel' | 'diversion' | 'refs'> };
type MobileGlyph = { readonly color: number; readonly mask: readonly NativePoint[]; readonly box: NativeBox };
type Pressure = { readonly body: MobileGlyph; readonly travel: number; readonly diversion: number;
  readonly attempts: readonly string[]; readonly refs: readonly string[]; readonly lost?: true };
type Memory = { readonly epoch: number; readonly scene: Scene; readonly recipes: readonly Recipe[];
  readonly motion: readonly Motion[]; readonly tried: readonly string[]; readonly count: number; readonly radius?: Radius;
  readonly pressure?: Pressure; readonly mobiles?: readonly Pressure[]; readonly parallelContact?: readonly string[] };
type Choice = { readonly intent: 'merge' | 'approach' | 'deliver' | 'divert'; readonly member: Piece; readonly partner: Piece | null;
  readonly point: NativePoint; readonly expected: Recipe | null; readonly delivery?: { demand: Piece; receptor: NativeBox };
  readonly projected?: readonly Piece[]; readonly reserved?: readonly Piece[] };
type Proposal = NativeProposal & { readonly memory: Memory; readonly stock: readonly Piece[]; readonly choice: Choice;
  readonly attempt: string; readonly needId: string };
type ContactProposal = NativeProposal & { readonly contact: ContactDemand; readonly contactChoice: ContactChoice; readonly needId: string };
type MixedProposal = NativeProposal & { readonly mixed: MixedDemand; readonly mixedChoice: MixedChoice; readonly needId: string };
const isMixedProposal = (proposal: Proposal | ContactProposal | MixedProposal): proposal is MixedProposal => !!proposal.mixed;
const isContactProposal = (proposal: Proposal | ContactProposal): proposal is ContactProposal => !!proposal.contact;

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.hypot(x - a, y - b);
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const enclosed = (outer: NativeBox, inner: NativeBox) => outer[0] <= inner[0] && outer[1] <= inner[1] &&
  inner[2] <= outer[2] && inner[3] <= outer[3];
const solidSquare = (part: NativeEntity) => part.rectangular && width(part.bbox) === height(part.bbox);
const piece = (part: NativeEntity): Piece => ({ color: part.palette_value, side: width(part.bbox), box: part.bbox, point: center(part.bbox) });
const matches = (a: Pick<Piece, 'color' | 'side'>, b: Pick<Piece, 'color' | 'side'>) => a.color === b.color && a.side === b.side;
const samePiece = (a: Piece, b: Piece) => matches(a, b) && same(a.point, b.point);
const paletteRank = (scene: Scene, color: number) => scene.samples.findIndex(sample => sample.color === color);

function readStock(observation: NativeObservation, scene: Scene): Piece[] {
  const [top, bottom] = scene.field;
  return observation.entities.filter(part => part.bbox[1] >= top && part.bbox[3] <= bottom && solidSquare(part) &&
    paletteRank(scene, part.palette_value) >= 0 && width(part.bbox) <= scene.demand.side).map(piece);
}

function identify(observation: NativeObservation, screenWidth: number, screenHeight: number): Scene | null {
  const { entities } = observation;
  const reserve = entities.filter(part => width(part.bbox) === screenWidth && height(part.bbox) === 1 &&
    part.bbox[1] >= screenHeight * 0.85 && part.area === screenWidth);
  if (reserve.length !== 1) return null;
  const bottom = reserve[0]!.bbox[1] - 1;
  const scenes: Scene[] = [];
  for (const frame of entities) {
    const [left, top, right, stripBottom] = frame.bbox;
    if (top > screenHeight / 6 || width(frame.bbox) < 3 * height(frame.bbox) || height(frame.bbox) > screenHeight / 6) continue;
    const samples = entities.filter(part => solidSquare(part) && width(part.bbox) >= 2 &&
      part.bbox[0] > left && part.bbox[1] > top && part.bbox[2] < right && part.bbox[3] < stripBottom).map(piece);
    samples.sort((a, b) => a.point[0] - b.point[0]);
    if (samples.length < 3 || samples.length > 8 || new Set(samples.map(item => item.color)).size !== samples.length ||
      samples.some(item => item.side !== samples[0]!.side || item.point[1] !== samples[0]!.point[1])) continue;
    const demand = entities.filter(part => solidSquare(part) && !enclosed(frame.bbox, part.bbox) && width(part.bbox) > samples[0]!.side &&
      part.bbox[1] <= screenHeight / 6 && samples.some(item => item.color === part.palette_value));
    if (!demand.length || demand.length > 4 || (samples.length > 5 && demand.length === 1)) continue;
    const requirements = demand.map(piece), wanted = requirements.reduce((largest, item) => item.side > largest.side ? item : largest);
    const fieldTop = Math.max(stripBottom, ...requirements.map(item => item.box[3])) + 1;
    const receptacles = entities.filter(part => part.bbox[1] >= fieldTop && part.bbox[3] <= bottom &&
      !part.rectangular && width(part.bbox) === height(part.bbox) && width(part.bbox) > 2 * wanted.side &&
      part.area > width(part.bbox) ** 2 / 2 && samples.every(item => item.color !== part.palette_value));
    if (demand.length === 1 ? receptacles.length !== 1 : receptacles.length < 2 || receptacles.length > 5) continue;
    const receptor = receptacles[0]!.bbox;
    const scene: Scene = { samples, demand: wanted, receptor, field: [fieldTop, bottom], probeRange: Math.floor(width(receptor) * 0.8),
      ...(requirements.length > 1 ? { requirements, receivers: receptacles.map(part => part.bbox), screenWidth } : {}) };
    const stock = readStock(observation, scene);
    if (stock.length < 2 || stock.length > 24 || !stock.some((a, i) => stock.slice(i + 1).some(b => matches(a, b)))) continue;
    scenes.push(scene);
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function attemptKey(stock: readonly Piece[], point: NativePoint) {
  return stock.map(p => [p.color, p.side, p.point.join(',')].join(':')).sort().join('|') + '>' + point.join(',');
}

const anchor = ({ point: [x, y] }: Piece): NativePoint => [Math.round(x), Math.round(y)];
const boxDistance = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) =>
  Math.hypot(Math.max(l - x, 0, x - r), Math.max(t - y, 0, y - b));
const typeKey = (color: number, side: number) => [color, side].join(':');

function observeMobiles(observation: NativeObservation, scene: Scene): MobileGlyph[] {
  return observation.entities.filter(part => part.bbox[1] >= scene.field[0] && part.bbox[3] <= scene.field[1]
    && !part.rectangular && part.area >= 3 && width(part.bbox) <= scene.demand.side && height(part.bbox) <= scene.demand.side
    && paletteRank(scene, part.palette_value) < 0).map(part => ({ box: part.bbox, color: part.palette_value, mask: part.mask }));
}

const sameGlyph = (a: MobileGlyph, b: MobileGlyph) => a.color === b.color && a.mask.length === b.mask.length
  && a.mask.every((point, i) => same(point, b.mask[i]!));

function observeMobile(observation: NativeObservation, scene: Scene, known?: MobileGlyph): MobileGlyph | null {
  const candidates = observeMobiles(observation, scene).filter(body => !known || sameGlyph(body, known));
  return candidates.length === 1 ? candidates[0]! : null;
}

const diversionKey = (body: MobileGlyph, point: NativePoint) => `${center(body.box).join(',')}>${point.join(',')}`;
const clearance = (point: NativePoint, stock: readonly Piece[]) => Math.min(...stock.map(item => boxDistance(point, item.box)));

function protectChoice(stock: readonly Piece[], memory: Memory, planned: Choice | null): Choice | null {
  const { pressure, radius, scene } = memory;
  if (pressure?.lost) return null;
  if (!pressure || !radius || !planned || !pressure.travel) return planned;
  const position = center(pressure.body.box), margin = Math.hypot(width(pressure.body.box), height(pressure.body.box)) / 2;
  const safe = clearance(position, planned.projected ?? stock), current = clearance(position, stock);
  if (Math.min(safe, current) > 2 * pressure.travel + margin) return planned;
  const step = Math.floor(radius.lower), reach = Math.max(step, pressure.diversion);
  const [x, y] = position;
  const [top, bottom] = scene.field, screenWidth = scene.screenWidth!;
  const hazard = stock.reduce((nearer, item) => boxDistance(position, item.box) < boxDistance(position, nearer.box) ? item : nearer);
  let bestPoint: NativePoint | null = null, bestClearance = current;
  for (let cy = Math.max(top + 1, Math.ceil(y - step)); cy <= Math.min(bottom - 1, Math.floor(y + step)); cy++) {
    for (let cx = Math.max(1, Math.ceil(x - step)); cx <= Math.min(screenWidth - 2, Math.floor(x + step)); cx++) {
      const point: NativePoint = [cx, cy], span = distance(position, point);
      if (span < 1 || span > step || clearance(point, stock) <= radius.upper || pressure.attempts.includes(diversionKey(pressure.body, point))) continue;
      const projected: NativePoint = [x + (cx - x) * reach / span, y + (cy - y) * reach / span];
      if (projected[0] < margin || projected[0] >= screenWidth - margin || projected[1] < top + margin || projected[1] > bottom - margin) continue;
      const gap = clearance(projected, stock);
      if (gap <= bestClearance || clearance(projected, planned.projected ?? stock) <= safe) continue;
      bestClearance = gap;
      bestPoint = point;
    }
  }
  if (bestPoint) return { intent: 'divert', member: hazard, partner: null, point: bestPoint, expected: null, projected: stock };
  return safe > pressure.travel + margin ? planned : null;
}

function pressureReturn(proposal: Proposal, after: NativeObservation) {
  const { memory, choice, stock } = proposal;
  const prior = memory.pressure;
  if (!prior) return null;
  const body = observeMobile(after, memory.scene, prior.body);
  if (!body) return null;
  const start = center(prior.body.box), end = center(body.box), shift = distance(start, end);
  const isolated = choice.intent === 'divert', nextStock = readStock(after, memory.scene);
  const preserved = nextStock.length === stock.length && stock.every(item => nextStock.some(next => samePiece(item, next)));
  const followsClick = (end[0] - start[0]) * (choice.point[0] - start[0]) + (end[1] - start[1]) * (choice.point[1] - start[1]) > 0;
  const widened = isolated && preserved && followsClick && shift > prior.travel && clearance(end, nextStock) > clearance(start, stock);
  const pressure: Pressure = { body, travel: isolated ? prior.travel : Math.max(prior.travel, shift),
    diversion: widened ? Math.max(prior.diversion, shift) : prior.diversion,
    attempts: isolated ? [...prior.attempts, diversionKey(prior.body, choice.point)] : prior.attempts,
    refs: shift ? [...new Set([...prior.refs.slice(-3), after.observation_ref])] : prior.refs };
  return { pressure, widened };
}

function updateRadius(previous: Radius | undefined, stock: readonly Piece[], actual: readonly Piece[], point: NativePoint, ref: string): Radius | undefined {
  let lower = previous?.lower ?? 0, upper = previous?.upper ?? Math.ceil(Math.hypot(64, 64));
  for (const item of stock) {
    const span = Math.ceil(boxDistance(point, item.box));
    if (!actual.some(candidate => samePiece(candidate, item))) lower = Math.max(lower, span);
    else if (!same(point, anchor(item))) upper = Math.min(upper, span - 1);
  }
  if (lower > upper) return previous;
  if (previous && lower === previous.lower && upper === previous.upper) return previous;
  return { lower, upper, refs: [...(previous?.refs ?? []).slice(-3), ref] };
}

function placedAt(color: number, side: number, at: NativePoint): Piece {
  const [x, y] = at, left = x - Math.floor(side / 2), top = y - Math.floor(side / 2);
  const box: NativeBox = [left, top, left + side - 1, top + side - 1];
  return { color, side, box, point: center(box) };
}

function canSupply(stock: readonly Piece[], requirements: readonly Piece[], memory: Memory): boolean {
  const counts = new Map<string, number>();
  for (const { color, side } of stock) {
    const key = typeKey(color, side);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const sample of memory.scene.samples) {
    for (const request of requirements.filter(item => item.color === sample.color)) {
      const key = typeKey(request.color, request.side), count = counts.get(key) ?? 0;
      if (!count) return false;
      counts.set(key, count - 1);
    }
    for (const recipe of memory.recipes.filter(rule => rule.input === sample.color
      && paletteRank(memory.scene, rule.output) > paletteRank(memory.scene, rule.input))) {
      const input = typeKey(recipe.input, recipe.inputSide), output = typeKey(recipe.output, recipe.outputSide);
      const pairs = Math.floor((counts.get(input) ?? 0) / 2);
      counts.set(input, (counts.get(input) ?? 0) - 2 * pairs);
      counts.set(output, (counts.get(output) ?? 0) + pairs);
    }
  }
  return true;
}

function remainingMerges(stock: readonly Piece[], requirements: readonly Piece[], memory: Memory): number {
  const supply = new Map<string, number>(), demand = new Map<string, number>();
  for (const item of stock) {
    const key = typeKey(item.color, item.side);
    supply.set(key, (supply.get(key) ?? 0) + 1);
  }
  for (const item of requirements) {
    const key = typeKey(item.color, item.side);
    demand.set(key, (demand.get(key) ?? 0) + 1);
  }
  let merges = 0;
  for (const sample of [...memory.scene.samples].reverse()) {
    for (const [type, quantity] of demand) {
      if (!type.startsWith(sample.color + ':')) continue;
      const deficit = quantity - (supply.get(type) ?? 0);
      if (deficit <= 0) continue;
      const options = memory.recipes.filter(rule => typeKey(rule.output, rule.outputSide) === type
        && paletteRank(memory.scene, rule.input) < paletteRank(memory.scene, rule.output));
      if (options.length !== 1) return Infinity;
      const input = typeKey(options[0]!.input, options[0]!.inputSide);
      demand.set(input, (demand.get(input) ?? 0) + 2 * deficit);
      merges += deficit;
    }
  }
  return merges;
}

function reservedMaterial(stock: readonly Piece[], memory: Memory): Piece[] {
  const requirements = memory.scene.requirements!, cost = remainingMerges(stock, requirements, memory);
  return stock.filter(piece => remainingMerges(stock.filter(item => item !== piece), requirements, memory) > cost);
}

function mobileClearance(mobile: Pressure, stock: readonly Piece[], required: readonly Piece[], point: NativePoint, memory: Memory): number {
  const position = center(mobile.body.box), radius = memory.radius!, { scene } = memory;
  const directed = boxDistance(point, mobile.body.box) <= radius.lower;
  const closest = stock.reduce<Piece | undefined>((best, item) =>
    !best || distance(position, item.point) < distance(position, best.point) ? item : best, undefined);
  const target = directed ? point : closest?.point ?? position;
  // Approximate pursuit and attraction separately using the displacements already measured.
  const stride = directed ? Math.floor(mobile.diversion) : Math.round(mobile.travel / Math.SQRT2);
  const margin = (Math.max(width(mobile.body.box), height(mobile.body.box)) + 1) / 2;
  const move = (start: number, end: number, low: number, high: number) =>
    Math.max(low, Math.min(high, start + Math.sign(end - start) * Math.min(stride, Math.abs(end - start) * (directed ? 2 : 1))));
  const next: NativePoint = [move(position[0], target[0], margin, scene.screenWidth! - margin - 1),
    move(position[1], target[1], scene.field[0] + margin, scene.field[1] - margin)];
  return clearance(next, required) - margin;
}

function protectMultiple(stock: readonly Piece[], memory: Memory, planned: Choice): Choice | null {
  const { mobiles, radius, scene } = memory;
  if (!mobiles?.length || !radius) return planned;
  if (mobiles.some(mobile => mobile.lost)) return null;
  const projected = planned.projected ?? stock, needed = reservedMaterial(projected, memory);
  const risk = (future: readonly Piece[], relevant: readonly Piece[], point: NativePoint) =>
    Math.min(...mobiles.map(mobile => mobileClearance(mobile, future, relevant, point, memory)));
  const plannedGap = risk(projected, needed, planned.point);
  if (plannedGap > Math.max(...mobiles.map(body => body.travel)) / Math.SQRT2) return planned;
  const required = reservedMaterial(stock, memory);
  const [top, bottom] = scene.field;
  let bestPoint: NativePoint | null = null, bestGap = Math.max(0, plannedGap);
  for (const body of mobiles.map(mobile => mobile.body)) {
    for (let y = Math.max(top + 1, body.box[1] - radius.lower); y <= Math.min(bottom - 1, body.box[3] + radius.lower); y++) {
      for (let x = Math.max(1, body.box[0] - radius.lower); x <= Math.min(scene.screenWidth! - 2, body.box[2] + radius.lower); x++) {
        const point: NativePoint = [x, y];
        if (boxDistance(point, body.box) > radius.lower || clearance(point, stock) <= radius.upper
          || mobiles.some(mobile => mobile.attempts.includes(diversionKey(mobile.body, point)))) continue;
        const gap = risk(stock, required, point);
        if (gap <= bestGap) continue;
        bestPoint = point;
        bestGap = gap;
      }
    }
  }
  return bestPoint ? { intent: 'divert', member: required[0] ?? planned.member, partner: null, point: bestPoint,
    expected: null, projected: stock, reserved: required } : plannedGap > 0 ? planned : null;
}

function multiplePressureReturn(proposal: Proposal, after: NativeObservation) {
  const { memory, stock, choice } = proposal;
  if (!memory.mobiles) return null;
  const unused = new Set(observeMobiles(after, memory.scene));
  const isolated = choice.intent === 'divert', newStock = readStock(after, memory.scene);
  let widened = false;
  const mobiles = memory.mobiles.map(prior => {
    const start = center(prior.body.box);
    const body = [...unused].filter(glyph => sameGlyph(glyph, prior.body))
      .sort((a, b) => distance(start, center(a.box)) - distance(start, center(b.box)))[0];
    if (!body) return { ...prior, lost: true as const };
    unused.delete(body);
    const end = center(body.box), shift = distance(start, end), near = boxDistance(choice.point, prior.body.box) <= memory.radius!.lower;
    if (isolated && near && shift > prior.travel && clearance(end, newStock) > clearance(start, stock)) widened = true;
    return { body, travel: near ? prior.travel : Math.max(prior.travel, shift),
      diversion: isolated && near ? Math.max(prior.diversion, shift) : prior.diversion,
      attempts: isolated ? [...prior.attempts, diversionKey(prior.body, choice.point)] : prior.attempts,
      refs: shift ? [...new Set([...prior.refs.slice(-3), after.observation_ref])] : prior.refs };
  });
  const preserved = newStock.length === stock.length && stock.every(item => newStock.some(next => samePiece(item, next)));
  return { mobiles, widened: widened && preserved && mobiles.every(mobile => !('lost' in mobile)) };
}

function clickToward(stock: readonly Piece[], memory: Memory, affected: readonly Piece[], ideal: NativePoint,
  improvements: (point: NativePoint) => boolean): NativePoint | null {
  const { lower, upper } = memory.radius!, { scene, tried } = memory;
  const others = stock.filter(item => !affected.includes(item));
  const left = Math.max(1, ...affected.map(item => item.box[0] - lower));
  const right = Math.min(scene.screenWidth! - 2, ...affected.map(item => item.box[2] + lower));
  const top = Math.max(scene.field[0] + 1, ...affected.map(item => item.box[1] - lower));
  const bottom = Math.min(scene.field[1] - 1, ...affected.map(item => item.box[3] + lower));
  let best: NativePoint | null = null, score = Infinity;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const point: NativePoint = [x, y], gap = distance(point, ideal);
    if (gap >= score || !improvements(point) || affected.some(item => boxDistance(point, item.box) > lower)
      || others.some(item => boxDistance(point, item.box) <= upper) || tried.includes(attemptKey(stock, point))) continue;
    best = point;
    score = gap;
  }
  return best;
}

function nextSplitChoice(stock: readonly Piece[], memory: Memory): Choice | null {
  const { scene, radius } = memory;
  if (!radius || radius.lower < 1 || radius.upper - radius.lower > 5) return null;
  const requests = scene.requirements!;
  let requirements = [...requests];
  if (!canSupply(stock, requirements, memory)) {
    if (!memory.parallelContact) return null;
    // Preserve a contribution we can already produce while the independent contact evolves.
    requirements = [];
    for (let selected = 1; selected < (1 << requests.length); selected++) {
      const subset = requests.filter((_, index) => selected & (1 << index));
      if (subset.length > requirements.length && canSupply(stock, subset, memory)) requirements = subset;
    }
    if (!requirements.length) return null;
  }
  const receivers = scene.receivers!;
  const nearest = (demand: Piece) => Math.min(...stock.filter(item => matches(item, demand))
    .flatMap(item => receivers.map(receptor => distance(anchor(item), center(receptor)))));
  requirements.sort((a, b) => nearest(a) - nearest(b));
  const reserved: Piece[] = [], used = new Set<Piece>(), occupied = new Set<NativeBox>();
  const placements = requirements.flatMap(demand => {
    const candidates = stock.filter(item => matches(item, demand) && !used.has(item));
    if (!candidates.length) return [];
    const zones = receivers.length >= requirements.length ? receivers.filter(receptor => !occupied.has(receptor)) : receivers;
    const options = candidates.flatMap(member => zones.map(receptor => ({ member, demand, receptor, gap: distance(anchor(member), center(receptor)) })));
    options.sort((a, b) => a.gap - b.gap);
    const best = options[0]!;
    used.add(best.member);
    occupied.add(best.receptor);
    reserved.push(best.member);
    return [best];
  });
  for (const { member, demand, receptor, gap } of placements) {
    if (gap <= 1) continue;
    const goal = center(receptor), point = clickToward(stock, memory, [member], goal, at => distance(at, goal) < gap);
    if (point) return { intent: 'deliver', member, partner: null, point, expected: null, delivery: { demand, receptor }, reserved,
      projected: [...stock.filter(item => item !== member), placedAt(member.color, member.side, point)] };
  }
  const working = stock.filter(item => !used.has(item));
  const workload = memory.mobiles ? remainingMerges(stock, requirements, memory) : Infinity;
  const pairs = working.flatMap((a, i) => working.slice(i + 1).flatMap(b => {
    if (!matches(a, b)) return [];
    const recipe = memory.recipes.find(rule => rule.input === a.color && rule.inputSide === a.side);
    if (!recipe || recipe.outputSide > scene.demand.side) return [];
    const rest = stock.filter(item => item !== a && item !== b);
    const middle = center([a.point[0], a.point[1], b.point[0], b.point[1]]);
    const output = placedAt(recipe.output, recipe.outputSide, middle);
    if (Number.isFinite(workload) && remainingMerges([...rest, output], requirements, memory) >= workload) return [];
    return canSupply([...rest, output], requirements, memory) ? [{ a, b, recipe, rest, middle, gap: distance(a.point, b.point) }] : [];
  })).sort((a, b) => a.gap - b.gap);
  const destinations = receivers.filter(receptor => !occupied.has(receptor)).map(center);
  for (const { a, b, recipe, rest, middle } of pairs) {
    const toward = memory.parallelContact
      ? [...destinations].sort((a, b) => distance(a, middle) - distance(b, middle))[0] ?? middle : middle;
    const point = clickToward(stock, memory, [a, b], toward, () => true);
    if (point) return { intent: 'merge', member: a, partner: b, point, expected: recipe, reserved,
      projected: [...rest, placedAt(recipe.output, recipe.outputSide, point)] };
  }
  for (const { a, b, recipe, gap } of pairs) {
    for (const [member, partner] of [[a, b], [b, a]] as const) {
      const goal = anchor(partner), point = clickToward(stock, memory, [member], goal, at => distance(at, goal) + 1 < gap);
      if (point) return { intent: 'approach', member, partner, point, expected: recipe, reserved,
        projected: [...stock.filter(item => item !== member), placedAt(member.color, member.side, point)] };
    }
  }
  return null;
}

function nextChoice(stock: readonly Piece[], memory: Memory): Choice | null {
  const { scene } = memory;
  const demandRank = paletteRank(scene, scene.demand.color);
  const tried = new Set(memory.tried);
  const limitFor = (member: Piece) => {
    const motion = memory.motion.find(item => matches(item, member));
    return motion ? Math.min(scene.probeRange, Math.max(1, Math.round(motion.range))) : scene.probeRange;
  };
  const available = (at: NativePoint) => at[1] >= scene.field[0] && at[1] <= scene.field[1] && !tried.has(attemptKey(stock, at));
  const approach = (member: Piece, goal: NativePoint) => {
    const [x, y] = member.point, [a, b] = goal;
    const span = distance(member.point, goal);
    if (!span) return null;
    for (let step = Math.min(limitFor(member), span); step >= 1; step--) {
      const point: NativePoint = [Math.round(x + step * (a - x) / span), Math.round(y + step * (b - y) / span)];
      if (!same(point, member.point) && available(point)) return point;
    }
    return null;
  };
  const product = stock.find(item => matches(item, scene.demand));
  if (product) {
    const point = approach(product, center(scene.receptor));
    return point ? { intent: 'deliver', member: product, partner: null, point, expected: null } : null;
  }
  for (let rank = demandRank - 1; rank >= 0; rank--) {
    const color = scene.samples[rank]!.color;
    const group = stock.filter(item => item.color === color);
    const pairs = group.flatMap((a, i) => group.slice(i + 1).filter(b => matches(a, b)).map(b => ({ a, b, separation: distance(a.point, b.point) })));
    pairs.sort((a, b) => a.separation - b.separation);
    for (const { a, b, separation } of pairs) {
      const expected = memory.recipes.find(recipe => recipe.input === color && recipe.inputSide === a.side) ?? null;
      const mean: NativePoint = [Math.round((a.point[0] + b.point[0]) / 2), Math.round((a.point[1] + b.point[1]) / 2)];
      if (separation <= Math.round(1.5 * limitFor(a)) && available(mean)) return { intent: 'merge', member: a, partner: b, point: mean, expected };
      const first = approach(a, b.point);
      if (first) return { intent: 'approach', member: a, partner: b, point: first, expected };
      const reverse = approach(b, a.point);
      if (reverse) return { intent: 'approach', member: b, partner: a, point: reverse, expected };
    }
  }
  return null;
}

function measureReturn(proposal: Proposal, after: NativeObservation) {
  const { choice, stock, memory } = proposal, { member, partner, expected } = choice;
  const actual = readStock(after, memory.scene);
  if (choice.projected) {
    const { projected } = choice;
    const agrees = actual.length === projected.length && projected.every(piece => actual.some(item => samePiece(piece, item)));
    if (!agrees) {
      if (!memory.mobiles || !memory.scene.requirements) return null;
      const consumed = stock.filter(piece => !projected.includes(piece));
      const confirmed = [...projected.filter(piece => !stock.includes(piece)), ...reservedMaterial(projected, memory)];
      if (consumed.some(piece => actual.some(item => samePiece(piece, item)))
        || confirmed.some(piece => !actual.some(item => samePiece(piece, item)))
        || remainingMerges(actual, memory.scene.requirements, memory) > remainingMerges(projected, memory.scene.requirements, memory)) return null;
    }
    return { recipe: choice.intent === 'merge' ? expected : null,
      range: choice.intent === 'merge' ? null : distance(member.point, choice.point), parallelChange: !agrees };
  }
  const gone = stock.filter(old => !actual.some(now => samePiece(old, now)));
  const added = actual.filter(now => !stock.some(old => samePiece(old, now)));
  if (partner && gone.length === 2 && added.length === 1 && gone.some(item => samePiece(item, member)) &&
    gone.some(item => samePiece(item, partner))) {
    const output = added[0]!;
    const supported = expected ? expected.output === output.color && expected.outputSide === output.side
      : paletteRank(memory.scene, output.color) > paletteRank(memory.scene, member.color) && output.side > member.side;
    if (supported) {
      const recipe: Recipe = { input: member.color, inputSide: member.side, output: output.color, outputSide: output.side,
        evidence: after.observation_ref };
      return { recipe, range: null };
    }
  }
  if (!gone.some(item => samePiece(item, member)) || gone.length !== added.length) return null;
  if (gone.some(item => !matches(item, member)) || added.some(item => !matches(item, member))) return null;
  const target = partner?.point ?? center(memory.scene.receptor);
  const shifted = added.filter(item => distance(item.point, choice.point) < distance(member.point, choice.point))
    .sort((a, b) => distance(a.point, choice.point) - distance(b.point, choice.point))[0];
  if (!shifted) return null;
  const oldGap = distance(member.point, target);
  const newGap = partner && gone.some(item => samePiece(item, partner)) && added.length === 2
    ? distance(added[0]!.point, added[1]!.point) : distance(shifted.point, target);
  if (newGap >= oldGap) return null;
  return { recipe: null, range: distance(member.point, choice.point) };
}

export function createSicMergeForDemand(): NativeFamily<Proposal | ContactProposal | MixedProposal> {
  let state: Memory | null = null, transfer: Transfer | null = null;
  let contact: ContactDemand | null = null;
  let mixed: MixedDemand | null = null;
  let choose: NativeProgramHandle | undefined;

  async function offerContact(observation: NativeObservation, rows: NativeRows, mode: string, signal: AbortSignal | undefined,
    shouldStop: () => boolean): Promise<ContactProposal | null> {
    const local = contact?.epoch === observation.level_epoch ? contact : transfer ? measureContactDemand(observation, rows, transfer) : null;
    const picked = local && chooseContactDemand(local, shouldStop);
    if (!local || !picked) return null;
    const delivering = picked.intent === 'deliver';
    const facts = { knownInteraction: false, routeSupported: delivering, eligibleProbe: !delivering, mode };
    const decision = await choose?.run({ situation: facts }, { signal });
    const strategy = delivering ? 'P07' : 'P05';
    if (decision?.result !== strategy) return null;
    const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set(local.refs.filter(item => item !== ref))];
    const situation = delivering ? 'Bring both requested pieces into their receivers during the same return'
      : picked.intent === 'advance' ? 'Let the nearby mobile advance while leaving both bodies outside the click field'
        : 'Bring the square and mobile close enough to test a type change';
    const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, picked.point, { reason: situation, evidence });
    if (!pointBinding) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'produce_and_deliver_requested_visible_type', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['requested_square', 'requested_mobile'], parentObjective: parent,
      satisfactionContract: 'both_requested_pieces_simultaneously_accepted' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = mergeForDemandId + ':' + need.id;
    const [x, y] = picked.point, action = { action_ref: 'ACTION6', data: { x, y } };
    return { status: 'proposed', kind: mergeForDemandId, contact: local, contactChoice: picked, needId: need.id,
      binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
      steps: [{ action, point_binding: pointBinding, expected_after: null }],
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
        instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Prepare the requested square and deliver both pieces together', situation, evidence, mode,
        agenda: [], triggerCard: decision.receipt.workflow, actor: local.world.square.box,
        mobileRequest: contactMobileBox(local.scene, local.world.mobile.at),
        focus: [x, y, x, y], ...(picked.receivers ? { receptor: picked.receivers[0].box, otherReceiver: picked.receivers[1].box } : {}) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
  }

  async function offerMixed(observation: NativeObservation, rows: NativeRows, mode: string, execution?: NativeExecution): Promise<MixedProposal | null> {
    if (!transfer) return null;
    const local = mixed?.epoch === observation.level_epoch ? mixed : measureMixedDemand(observation, rows, transfer);
    const shouldStop = () => !!execution?.signal?.aborted || (execution?.now?.() ?? performance.now()) >= (execution?.deadlineMs ?? Infinity);
    const plan = local && chooseMixedDemand(observation, rows, local, transfer, shouldStop);
    if (!plan) return null;
    const { choice } = plan, delivering = choice.intent === 'deliver_square' || choice.intent === 'deliver_glyph';
    const facts = { knownInteraction: false, routeSupported: delivering, eligibleProbe: !delivering, mode };
    const decision = await choose?.run({ situation: facts }, { signal: execution?.signal });
    const strategy = delivering ? 'P07' : 'P05';
    if (decision?.result !== strategy) return null;
    const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set(
      [...local.refs, ...transfer.recipes.map(recipe => recipe.evidence)].filter(item => item !== ref))];
    const situation = choice.joint ? 'Time the deliveries so all requested products occupy receivers in the same return' : {
      produce_square: 'Test a compatible fusion for the requested square',
      produce_glyph: 'Attract the selected pair while keeping the other mobile outside the field',
      gather_pair: 'Bring one input closer to its partner without disturbing other pieces',
      redirect_contact: 'Bring the remaining mobile toward the material that needs a lower rank',
      deliver_square: 'Bring the square to an open receiver while preserving the other products',
      deliver_glyph: 'Bring the requested glyph back to its receiver',
    }[choice.intent];
    const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: situation, evidence });
    if (!pointBinding) return null;
    const parent = 'G_official_completion', objective = { kind: 'produce_and_deliver_requested_visible_type', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['requested_squares', 'requested_mobile'], parentObjective: parent,
      satisfactionContract: 'accept_requested_products_of_both_kinds_simultaneously' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = mergeForDemandId + ':' + need.id;
    const [x, y] = choice.point, action = { action_ref: 'ACTION6', data: { x, y } };
    return { status: 'proposed', kind: mergeForDemandId, mixed: plan.local, mixedChoice: choice, needId: need.id,
      binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
      steps: [{ action, point_binding: pointBinding, expected_after: null }],
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
        edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Prepare and preserve the requested products together', situation, evidence, mode, agenda: [],
        triggerCard: decision.receipt.workflow, actor: choice.focus[0]!.box, partner: choice.focus[1]?.box ?? null,
        ...(choice.receiver ? { receptor: choice.receiver } : {}),
        focus: [x, y, x, y], demand: choice.intent === 'deliver_glyph' || choice.intent === 'produce_glyph'
          ? plan.local.layout.request.box : plan.local.layout.square.box },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } } };
  }

  return {
    id: mergeForDemandId,
    async attachPrograms(registry) {
      choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (!choose || remaining < 1 || !observation.available_action_refs.includes('ACTION6') ||
        observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const identified = prior?.scene ?? identify(observation, rows[0]!.length, rows.length);
      if (!identified || mixed?.epoch === observation.level_epoch) {
        const proposal = await offerMixed(observation, rows, execution?.reasoningMode ?? 'exploration', execution);
        if (proposal || mixed?.epoch === observation.level_epoch) return proposal;
      }
      if (!identified || contact?.epoch === observation.level_epoch) {
        const shouldStop = () => !!execution?.signal?.aborted || (execution?.now?.() ?? performance.now()) >= (execution?.deadlineMs ?? Infinity);
        return offerContact(observation, rows, execution?.reasoningMode ?? 'exploration', execution?.signal, shouldStop);
      }
      if ((prior?.count ?? 0) >= 40) return null;
      const palette = identified.samples.map(sample => sample.color).join();
      const previousContact = contact?.epoch === observation.level_epoch - 1 && contact.contacts > 0
        && identified.requirements && identified.requirements.length > 1 && palette === contact.scene.palette.join() ? contact : null;
      const saved = transfer && (palette === transfer.palette.join() || previousContact) ? transfer : null;
      const glyphs = !prior && saved ? observeMobiles(observation, identified) : [];
      const mobile = !identified.requirements && glyphs.length === 1 ? glyphs[0] : null;
      const inheritedEffect = saved?.mobileEffect;
      const multiple = inheritedEffect && glyphs.length > 1 && glyphs.every(body => sameGlyph(body, glyphs[0]!));
      const scene = (mobile || multiple) && !identified.requirements
        ? { ...identified, requirements: [identified.demand], receivers: [identified.receptor], screenWidth: rows[0]!.length } : identified;
      const inherited = scene.requirements ? saved : null;
      const pressure: Pressure | undefined = mobile ? { body: mobile, travel: 0, diversion: 0, attempts: [], refs: [observation.observation_ref] } : undefined;
      const memory: Memory = prior ?? { scene, epoch: observation.level_epoch, recipes: inherited?.recipes ?? [],
        motion: inherited?.motion ?? [], tried: [], count: 0, ...(inherited ? { radius: inherited.radius } : {}), ...(pressure ? { pressure } : {}),
        ...(previousContact && multiple ? { parallelContact: previousContact.refs } : {}),
        ...(multiple ? { mobiles: glyphs.map(body => ({ ...inheritedEffect!, body, attempts: [],
          refs: [...inheritedEffect!.refs.slice(-3), observation.observation_ref] })) } : {}) };
      const stock = readStock(observation, scene);
      const planned = scene.requirements ? nextSplitChoice(stock, memory) : nextChoice(stock, memory);
      const choice = planned && memory.mobiles ? protectMultiple(stock, memory, planned) : protectChoice(stock, memory, planned);
      if (!choice) return null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const measured = memory.motion.find(item => matches(item, choice.member));
      const knownInteraction = choice.intent === 'merge' && !!choice.expected;
      const routeSupported = choice.intent !== 'merge' && choice.intent !== 'divert' && !!measured;
      const facts = { knownInteraction, routeSupported, eligibleProbe: !knownInteraction && !routeSupported, mode };
      const decision = await choose.run({ situation: facts }, { signal: execution?.signal });
      const strategy = knownInteraction ? 'P02' : routeSupported ? 'P07' : 'P05';
      if (decision.result !== strategy) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([measured?.evidence, ...memory.recipes.map(recipe => recipe.evidence),
        ...(scene.requirements ? memory.radius?.refs ?? [] : []), ...(memory.pressure?.refs ?? []),
        ...(memory.mobiles?.flatMap(body => body.refs) ?? []), ...(memory.parallelContact ?? [])]
        .filter((item): item is string => !!item && item !== ref))];
      const situation = choice.intent === 'divert' ? 'Test whether an isolated click gives the needed material more room'
        : choice.intent === 'merge'
        ? knownInteraction ? 'Repeat the observed merge on two compatible pieces' : 'Test whether two nearby pieces merge into a new type'
        : choice.intent === 'deliver' ? 'Bring the requested product to its receiver' : 'Bring two compatible pieces within range of the same click';
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: situation, evidence });
      if (!witness) return null;
      const [x, y] = choice.point, parent = 'G_official_completion';
      const demand = choice.delivery?.demand ?? scene.demand, receptor = choice.delivery?.receptor ?? scene.receptor;
      const objective = { kind: 'produce_and_deliver_requested_visible_type', scope: ref.split(':revision:', 1)[0]!,
        subjects: [typeKey(demand.color, demand.side)], parentObjective: parent,
        satisfactionContract: 'official_progress_after_delivery_of_requested_type' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = mergeForDemandId + ':' + need.id, action = { action_ref: 'ACTION6', data: { x, y } };
      const prediction = knownInteraction ? { color: choice.expected!.output, side: choice.expected!.outputSide } : null;
      return {
        status: 'proposed', kind: mergeForDemandId, memory, stock, choice, needId: need.id, attempt: attemptKey(stock, choice.point),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: prediction }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
          edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy, need: 'Make the displayed product and bring it to the receiver', situation, evidence, agenda: [],
          mode, triggerCard: decision.receipt.workflow, actor: choice.member.box, partner: choice.partner?.box ?? null,
          demand: demand.box, receptor, focus: [x, y, x, y],
          ...(choice.reserved ? { reserved: choice.reserved.filter(item => item !== choice.member).map(item => item.box) } : {}),
          ...(memory.pressure ? { autonomous: memory.pressure.body.box, protectiveClick: choice.intent === 'divert' } : {}),
          ...(memory.mobiles ? { autonomousMobiles: memory.mobiles.map(mobile => mobile.body.box), protectiveClick: choice.intent === 'divert' } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'production_click_bound' : 'production_scene_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isMixedProposal(proposal)) {
        const result = transfer && observeMixedDemand(proposal.mixed, proposal.mixedChoice, after, second, transfer);
        return { matched: result?.matched ?? false, seal_prefix: true, reason: result?.reason ?? 'mixed_demand_calibration_missing' };
      }
      if (isContactProposal(proposal)) {
        const returned = observeContactDemand(proposal.contact, proposal.contactChoice, after, second);
        return { matched: returned?.confirmed ?? false, seal_prefix: true, reason: returned?.converted ? 'contact_lowered_square_rank'
          : returned?.confirmed ? 'both_bodies_remeasured_after_click' : 'contact_or_transport_not_confirmed' };
      }
      if (proposal.choice.intent === 'divert') {
        const result = multiplePressureReturn(proposal, after) ?? pressureReturn(proposal, after);
        return { matched: result?.widened ?? false, seal_prefix: true, reason: result?.widened
          ? 'mobile_redirected_material_preserved' : 'protective_click_not_confirmed' };
      }
      const effect = measureReturn(proposal, after);
      if (proposal.choice.intent === 'merge' && proposal.choice.expected && !effect?.recipe) {
        return { matched: false, seal_prefix: true, reason: 'expected_merge_not_observed' };
      }
      const reason = effect?.recipe ? 'two_inputs_consumed_and_output_observed'
        : effect && 'parallelChange' in effect && effect.parallelChange ? 'material_approached_despite_surplus_change'
          : effect ? 'material_approached_destination' : 'expected_material_effect_not_observed';
      return { matched: !!effect, seal_prefix: true, reason };
    },
    record(before, after, _command, _first, _second, proposal, _index, frames) {
      if (isMixedProposal(proposal)) {
        if (!transfer || before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const result = observeMixedDemand(proposal.mixed, proposal.mixedChoice, after, _second, transfer);
        const motion = calibrateMixedMotion(result.local, proposal.mixedChoice, _first, frames, transfer, after);
        mixed = motion ? { ...result.local, motion } : result.local;
        return { events: [], ...(result.matched && result.reason === 'selected_pair_became_requested_glyph'
          ? { reviewEvidence: 'The selected pair produced the requested glyph and the unselected mobile remained in play.' } : {}) };
      }
      if (isContactProposal(proposal)) {
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const returned = observeContactDemand(proposal.contact, proposal.contactChoice, after, _second);
        contact = returned?.next ?? { ...proposal.contact, stopped: true };
        return { events: [], ...(returned?.converted
          ? { reviewEvidence: 'The square changed to a lower rank after the encounter and the requested mobile remained visible.' } : {}) };
      }
      const { memory, choice: { member } } = proposal;
      if (after.levels_completed > before.levels_completed && memory.radius && memory.recipes.length) {
        const mobile = memory.pressure ?? memory.mobiles?.[0];
        transfer = { palette: memory.scene.samples.map(sample => sample.color), recipes: memory.recipes, motion: memory.motion, radius: memory.radius,
          ...(mobile?.travel && mobile.diversion ? { mobileEffect: { travel: mobile.travel, diversion: mobile.diversion, refs: mobile.refs } } : {}) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const mobile = pressureReturn(proposal, after);
      const crowd = multiplePressureReturn(proposal, after);
      const pressure: Pressure | undefined = mobile?.pressure ?? (memory.pressure ? { ...memory.pressure, lost: true } : undefined);
      if (proposal.choice.intent === 'divert') {
        state = { ...memory, count: memory.count + 1, ...(pressure ? { pressure } : {}), ...(crowd ? { mobiles: crowd.mobiles } : {}) };
        return { events: [], ...(mobile?.widened || crowd?.widened ? { reviewEvidence: 'The mobile moved away and the material stayed in place.' } : {}) };
      }
      const effect = measureReturn(proposal, after), recipe = effect?.recipe;
      const previous = memory.motion.find(item => matches(item, member));
      const motion = effect?.range && effect.range > (previous?.range ?? 0) ? [...memory.motion.filter(item => item !== previous),
        { color: member.color, side: member.side, range: effect.range, evidence: after.observation_ref }] : memory.motion;
      const recipes = recipe && !memory.recipes.some(known => known.input === recipe.input && known.inputSide === recipe.inputSide)
        ? [...memory.recipes, recipe] : memory.recipes;
      const radius = effect && !('parallelChange' in effect && effect.parallelChange)
        ? updateRadius(memory.radius, proposal.stock, readStock(after, memory.scene), proposal.choice.point, after.observation_ref)
        : memory.radius;
      state = { ...memory, motion, recipes, count: memory.count + 1, tried: [...memory.tried, proposal.attempt], ...(radius ? { radius } : {}),
        ...(pressure ? { pressure } : {}), ...(crowd ? { mobiles: crowd.mobiles } : {}) };
      if (effect && 'parallelChange' in effect && effect.parallelChange && memory.parallelContact) {
        return { events: [], reviewEvidence: 'The planned material changed as expected, and another piece changed during the same click.' };
      }
      return { events: [], ...(memory.pressure?.travel === 0 && mobile?.pressure.travel ?
        { reviewEvidence: 'The mobile changed position during the material action.' } : {}) };
    },
    state: () => ({ state, transfer, ...(contact ? { contact } : {}), ...(mixed ? { mixed } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      transfer = structuredClone((value.transfer as Transfer | undefined) ?? null);
      contact = structuredClone((value.contact as ContactDemand | undefined) ?? null);
      mixed = structuredClone((value.mixed as MixedDemand | undefined) ?? null);
    },
  };
}
