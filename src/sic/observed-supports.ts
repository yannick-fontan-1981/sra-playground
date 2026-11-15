import { geometricComponents, type GeometricComponent } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { MaterialBand } from '../logos-engine/v6-ordered-support.ts';

export type ObservedSupports = {
  structural_supports: { bbox: NativeBox; value: number }[];
  contacts: NativePoint[];
  bands: MaterialBand[][];
  configuration: number[][];
  target: number;
};

const width = ([l, , r]: NativeBox) => r - l + 1;
const center = ([l, , r]: NativeBox) => (l + r) / 2;
const pointKey = ([x, y]: NativePoint) => x + ',' + y;

function reflectedAt(a: GeometricComponent, b: GeometricComponent, axis: number): boolean {
  const [l, t, r, bot] = a.bbox, [u, v, w, end] = b.bbox;
  if (a.color !== b.color || a.area !== b.area || t !== v || bot !== end || l + w !== 2 * axis || r + u !== 2 * axis) return false;
  if (a.rectangular && b.rectangular) return true;
  const opposite = new Set(b.mask.map(pointKey));
  return a.mask.every(([x, y]) => opposite.has(pointKey([r - l - x, y])));
}

function contact(support: GeometricComponent): NativePoint {
  const [left, top, right, bottom] = support.bbox;
  const dx = right - left, dy = bottom - top;
  const distance = ([x, y]: NativePoint) => Math.abs(2 * x - dx) + Math.abs(2 * y - dy);
  const [x, y] = [...support.mask].sort((a, b) => distance(a) - distance(b) || a[1] - b[1] || a[0] - b[0])[0]!;
  return [left + x, top + y];
}

function relatedPieces(support: GeometricComponent, local: readonly GeometricComponent[], background: number) {
  const [left, top, right, bottom] = support.bbox;
  const aligned = local.filter(part => part.color !== background && part.bbox[1] >= top && part.bbox[3] <= bottom);
  const fromLeft = aligned.filter(part => part.bbox[2] <= left);
  const fromRight = aligned.filter(part => part.bbox[0] >= right);
  const bands: MaterialBand[] = [];
  let marked = false;
  for (const a of fromLeft) for (const b of fromRight) {
    if (!reflectedAt(a, b, center(support.bbox))) continue;
    if (!a.rectangular && !b.rectangular) marked = true;
    if (a.rectangular && b.rectangular && a.bbox[3] > a.bbox[1]
      && a.bbox[2] === left - 1 && b.bbox[0] === right + 1) {
      bands.push({ bbox: [a.bbox[0], a.bbox[1], b.bbox[2], a.bbox[3]], value: a.color });
    }
  }
  bands.sort((a, b) => b.bbox[1] - a.bbox[1]);
  return { bands, marked };
}

/** Measure repeated supports, their paired material, and the unique marked receiver. */
export function observeSupports(rows: NativeRows): ObservedSupports | null {
  const parts = geometricComponents(rows);
  const background = parts.reduce((largest, part) => part.area > largest.area ? part : largest).color;
  const groups = new Map<string, GeometricComponent[]>();
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox;
    if (bottom - top + 1 <= width(part.bbox) || left === 0 || top === 0 || right + 1 === rows[0]!.length || bottom + 1 === rows.length) continue;
    const signature = JSON.stringify([top, bottom, width(part.bbox), part.mask]);
    const aligned = groups.get(signature) ?? [];
    aligned.push(part);
    groups.set(signature, aligned);
  }
  const offers: ObservedSupports[] = [];
  for (const supports of groups.values()) {
    if (supports.length < 3 || supports.length > 8) continue;
    supports.sort((a, b) => center(a.bbox) - center(b.bbox));
    const centers = supports.map(support => center(support.bbox));
    const gap = centers[1]! - centers[0]!;
    if (centers.slice(1).some((x, i) => x - centers[i]! !== gap)) continue;
    const measured = supports.map((support, i) => relatedPieces(support, parts.filter(part => {
      const x = center(part.bbox), axis = centers[i]!;
      return x > axis - gap / 2 && x < axis + gap / 2;
    }), background));
    const goals = measured.flatMap((measurement, i) => measurement.marked ? [i] : []);
    const structural = supports.map(support => ({ bbox: support.bbox, value: support.color }));
    if (goals.length !== 1) continue;
    const bands = measured.map(measurement => measurement.bands);
    const configuration = bands.map(stack => stack.map(band => width(band.bbox)));
    const allWidths = configuration.flat();
    if (allWidths.length < 2 || new Set(allWidths).size !== allWidths.length
      || configuration.some(stack => stack.slice(1).some((value, i) => value >= stack[i]!))) continue;
    offers.push({ structural_supports: structural, contacts: supports.map(contact), bands, configuration, target: goals[0]! });
  }
  return offers.length === 1 ? offers[0]! : null;
}
