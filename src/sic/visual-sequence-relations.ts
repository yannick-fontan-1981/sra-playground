import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Shape = NativePoint[];
type Card = Map<number, Shape>;
type Relation = 'interleaved_patterns' | 'local_component_rotations' | 'varying_steps_around_landmarks';
const quarterTurns = [1, 2, 3] as const;
type Rotation = typeof quarterTurns[number];
export const visualRelationDescriptions: Record<Relation, string> = {
  interleaved_patterns: 'Compare each card with earlier cards in the same alternating color sequence',
  local_component_rotations: 'Check each component’s rotation around its own center',
  varying_steps_around_landmarks: 'Measure how the step size changes around the visible landmarks',
};

const signature = (shape: Shape) => shape.map(([x, y]) => `${x},${y}`).sort().join('|');
const sameShape = (first: Shape, second: Shape) => first.length === second.length && signature(first) === signature(second);
const mod = (n: number, d: number) => (n % d + d) % d;

function measure(raster: NativeRows, background: number): Card {
  const card: Card = new Map();
  raster.forEach((row, y) => row.forEach((ink, x) => {
    if (ink !== background) {
      const points = card.get(ink) ?? [];
      points.push([x, y]);
      card.set(ink, points);
    }
  }));
  return card;
}

function rotate([x, y]: NativePoint, turns: Rotation): NativePoint {
  if (turns === 1) return [-y, x];
  if (turns === 2) return [-x, -y];
  return [y, -x];
}

function followsRotation(shapes: Shape[], turns: Rotation, [tx, ty]: NativePoint): boolean {
  return shapes.slice(1).every((next, i) => sameShape(next, shapes[i]!.map(point => {
    const [x, y] = rotate(point, turns);
    return [x + tx, y + ty];
  })));
}

function rotatesAround(shapes: Shape[], center: NativePoint): boolean {
  return quarterTurns.some(turns => {
    const [x, y] = rotate(center, turns);
    return followsRotation(shapes, turns, [center[0] - x, center[1] - y]);
  });
}

function rotatesLocally(shapes: Shape[]): boolean {
  const total = (shape: Shape): NativePoint => shape.reduce<NativePoint>(([sx, sy], [x, y]) => [sx + x, sy + y], [0, 0]);
  const first = total(shapes[0]!), second = total(shapes[1]!), size = shapes[0]!.length;
  return quarterTurns.some(turns => {
    const [x, y] = rotate(first, turns), tx = (second[0] - x) / size, ty = (second[1] - y) / size;
    return Number.isInteger(tx) && Number.isInteger(ty) && followsRotation(shapes, turns, [tx, ty]);
  });
}

function growsByAddition(shapes: Shape[]): boolean {
  const increment = shapes[1]!.length - shapes[0]!.length;
  if (!increment) return false;
  const ordered = increment > 0 ? shapes : [...shapes].reverse();
  return ordered.slice(1).every((shape, i) => {
    const prior = ordered[i]!, points = new Set(shape.map(point => point.join(',')));
    return shape.length - prior.length === Math.abs(increment) && prior.every(point => points.has(point.join(',')));
  });
}

function interleaves(cards: Card[], center: NativePoint): boolean {
  if (cards.some(card => card.size !== 1)) return false;
  const tracks = new Map<number, Shape[]>();
  for (const card of cards) {
    const [color, shape] = [...card][0]!;
    const track = tracks.get(color) ?? [];
    track.push(shape);
    tracks.set(color, track);
  }
  const period = tracks.size;
  if (period < 2 || period > 3 || cards.length < period * 2 + 1) return false;
  const colors = cards.map(card => card.keys().next().value);
  return new Set(colors.slice(0, period)).size === period && colors.every((color, i) => color === colors[i % period])
    && [...tracks.values()].every(track => growsByAddition(track) || (new Set(track.map(signature)).size > 1 && rotatesAround(track, center)));
}

function componentsRotate(cards: Card[]): boolean {
  const first = cards[0]!, rotating = new Set<number>();
  if (first.size < 2 || cards.length < 5 || cards.some(card => card.size !== first.size)) return false;
  for (const [ink, shape] of first) {
    const track = cards.map(card => card.get(ink));
    if (track.some(part => part?.length !== shape.length)) return false;
    const shapes = track as Shape[], forms = new Set(shapes.map(signature));
    if (forms.size === 1) continue;
    if (shape.length < 2 || forms.size < 3 || !rotatesLocally(shapes)) return false;
    rotating.add(ink);
  }
  return rotating.size >= 2;
}

function movesAroundLandmarks(cards: Card[]): boolean {
  const first = cards[0]!;
  if (first.size !== 3 || cards.length < 5 || cards.some(card => card.size !== first.size)) return false;
  const center = [...first].find(([ink, shape]) => shape.length === 1
    && cards.every(card => card.has(ink) && sameShape(shape, card.get(ink)!)));
  if (!center) return false;
  const movingInk = [...first].find(([ink, shape]) => ink !== center[0] && shape.length === 1)?.[0];
  const ringInk = [...first].find(([ink, shape]) => ink !== center[0] && ink !== movingInk && shape.length >= 4)?.[0];
  if (movingInk === undefined || ringInk === undefined) return false;
  const [cx, cy] = center[1][0]!, ring = [...first.get(ringInk)!, ...first.get(movingInk)!];
  if (ring.length > 16 || cards.some(card => {
    const marker = card.get(movingInk), landmarks = card.get(ringInk);
    return marker?.length !== 1 || !landmarks || !sameShape([...landmarks, ...marker], ring);
  })) return false;
  const angle = ([x, y]: NativePoint) => Math.atan2(y - cy, x - cx);
  const order = [...ring].sort((first, second) => angle(first) - angle(second)), period = order.length;
  if (order.slice(1).some((point, i) => angle(point) === angle(order[i]!))) return false;
  const indices = cards.map(card => order.findIndex(point => point.join(',') === card.get(movingInk)![0]!.join(',')));
  if (new Set(indices).size < 4) return false;
  const steps = indices.slice(1).map((value, i) => mod(value - indices[i]!, period));
  const difference = mod(steps[1]! - steps[0]!, period);
  return difference !== 0 && steps.slice(1).every((step, i) => mod(step - steps[i]!, period) === difference);
}

export function visualRelation(rasters: (NativeRows | null)[], index: number, candidate: NativeRows, background: number): Relation | null {
  const cards = rasters.map((raster, i) => measure(i === index ? candidate : raster!, background));
  const height = candidate.length, width = candidate[0]!.length;
  if (interleaves(cards, [(width - 1) / 2, (height - 1) / 2])) return 'interleaved_patterns';
  if (componentsRotate(cards)) return 'local_component_rotations';
  if (movesAroundLandmarks(cards)) return 'varying_steps_around_landmarks';
  return null;
}
