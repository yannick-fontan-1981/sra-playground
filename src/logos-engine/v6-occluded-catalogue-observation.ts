/** Pinned public catalogue geometry and finite partial-view comparisons. */
import { geometricComponents } from './v6-native-observer.ts';
import { framedPatterns } from './v6-geometric-scene.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type P = readonly [number, number];
const key = ([x, y]: P): string => `${x},${y}`;
const compare = (a: P, b: P): number => a[0] - b[0] || a[1] - b[1];
const ascending = (a: number, b: number): number => a - b;

export function measureOccludedCatalogue(rows: NativeRows): R | null {
  const parts = geometricComponents(rows), frames = [];
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, w = r - l + 1, h = b - t + 1;
    if (Math.min(w, h) < 3 || Math.min(l, t) === 0 || r === rows[0]!.length - 1 || b === rows.length - 1) continue;
    const mask = new Set(part.mask.map(key));
    let enclosed = true;
    for (let x = 0; x < w && enclosed; x++) for (let y = 0; y < h; y++) {
      if ((x === 0 || x === w - 1 || y === 0 || y === h - 1) && !mask.has(key([x, y]))) { enclosed = false; break; }
    }
    if (enclosed) frames.push(part);
  }
  if (!frames.length) return null;
  const largest = Math.max(...frames.map(part => (part.bbox[2] - part.bbox[0]) * (part.bbox[3] - part.bbox[1])));
  const fields = frames.filter(part => (part.bbox[2] - part.bbox[0]) * (part.bbox[3] - part.bbox[1]) === largest);
  if (fields.length !== 1) return null;
  const field = fields[0]!.bbox, [l, t, r, b] = field, values = new Set<number>();
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) values.add(rows[y]![x]!);
  const groups = new Map<string, R[]>();
  for (const part of framedPatterns(rows, parts)) {
    const [x, y, z, v] = part.bbox;
    if (y <= b || !values.has(part.color) || part.foreground_area < 2) continue;
    const id = `${y + v},${z - x},${part.color}`;
    const group = groups.get(id) ?? []; group.push(part); groups.set(id, group);
  }
  const rowsOfCards = [...groups.values()].filter(group => group.length >= 2).map(group => group.sort((a, b) => a.bbox[0] - b.bbox[0]));
  if (!rowsOfCards.length) return null;
  const spans = rowsOfCards.map(cards => ({ cards, span: Math.max(...cards.map(p => p.bbox[2])) - Math.min(...cards.map(p => p.bbox[0])) }));
  const maximum = Math.max(...spans.map(item => item.span)), choices = spans.filter(item => item.span === maximum);
  if (choices.length !== 1) return null;
  const cards = choices[0]!.cards, palette = cards[0]!.color, raw: R[] = [];
  for (const card of cards) {
    const [x, y, z, v] = card.bbox, pixels: P[] = [];
    for (let c = y + 1; c < v; c++) for (let a = x + 1; a < z; a++) if (rows[c]![a] === palette) pixels.push([a, c]);
    if (!pixels.length) return null;
    const xmin = Math.min(...pixels.map(p => p[0])), xmax = Math.max(...pixels.map(p => p[0]));
    const ymin = Math.min(...pixels.map(p => p[1])), ymax = Math.max(...pixels.map(p => p[1]));
    raw.push({ bbox: card.bbox, point: card.center, mask: pixels.map(([a, c]): P => [a - xmin, c - ymin]).sort(compare), extent: [xmax - xmin + 1, ymax - ymin + 1] });
  }
  if (new Set(raw.map(p => JSON.stringify(p.extent))).size !== 1) return null;
  const controls = parts.filter(p => p.rectangular && p.bbox[3] < t && values.has(p.color)
    && Math.min(p.bbox[2] - p.bbox[0] + 1, p.bbox[3] - p.bbox[1] + 1) >= 2)
    .map(p => ({ palette: p.color, bbox: p.bbox, point: [Math.floor((p.bbox[0] + p.bbox[2]) / 2), Math.floor((p.bbox[1] + p.bbox[3]) / 2)] }));
  if (controls.length < 2 || controls.filter(p => p.palette === palette).length !== 1
    || new Set(controls.map(p => `${p.bbox[1]},${p.bbox[3]}`)).size !== 1) return null;
  return { field, palette, cards: raw, controls,
    geometry_ref: identity([field, raw.map(p => [p.bbox, p.extent]), controls.map(p => p.bbox)]),
    scope: 'Largest enclosed field, aligned lower catalogue and upper same-palette selectors are structural hypotheses; equal native catalogue extents required.' };
}

/** Measured positives and acquired substrate negatives; every other pixel stays unknown. */
export function fitOccludedCatalogue(rows: NativeRows, scene: R, backgrounds: readonly number[]): R[] {
  const [l, t, r, b] = scene.field, color = scene.palette, present: P[] = [], absent = new Set<string>();
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) {
    if (rows[y]![x] === color) present.push([x, y]);
    if (backgrounds.includes(rows[y]![x]!)) absent.add(key([x, y]));
  }
  if (!present.length) return [];
  const minx = Math.min(...present.map(p => p[0])), maxx = Math.max(...present.map(p => p[0]));
  const miny = Math.min(...present.map(p => p[1])), maxy = Math.max(...present.map(p => p[1]));
  const result: R[] = [];
  for (const [index, card] of (scene.cards as R[]).entries()) {
    const [w, h] = card.extent;
    for (let scale = 1; scale <= Math.min(Math.floor((r - l - 1) / w), Math.floor((b - t - 1) / h)); scale++) {
      const expanded: P[] = [];
      for (const [x, y] of card.mask as P[]) for (let dx = 0; dx < scale; dx++) for (let dy = 0; dy < scale; dy++) expanded.push([x * scale + dx, y * scale + dy]);
      for (let x = Math.max(l + 1, maxx - w * scale + 1); x <= Math.min(minx, r - w * scale); x++) {
        for (let y = Math.max(t + 1, maxy - h * scale + 1); y <= Math.min(miny, b - h * scale); y++) {
          const shifted = new Set(expanded.map(([a, c]) => key([x + a, y + c])));
          if (present.every(p => shifted.has(key(p))) && ![...shifted].some(p => absent.has(p))) result.push({ candidate: index, scale, translation: [x, y] });
        }
      }
    }
  }
  return result;
}

export function exposedCatalogueValues(before: NativeRows, after: NativeRows, scene: R): number[] {
  const [l, t, r, b] = scene.field, color = scene.palette, departed = new Set<number>(), entered = new Set<number>();
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) {
    if (before[y]![x] === color && after[y]![x] !== color) departed.add(after[y]![x]!);
    if (after[y]![x] === color && before[y]![x] !== color) entered.add(before[y]![x]!);
  }
  return departed.size === 1 && entered.size === 1 && [...departed].every(value => entered.has(value)) ? [...departed].sort(ascending) : [];
}

export function catalogueStructure(scene: R): unknown[] {
  return [scene.field, (scene.cards as R[]).map(card => [card.mask, card.extent]), scene.palette, scene.controls];
}
export function catalogueFieldPixels(rows: NativeRows, scene: R): number[][] {
  const [x, y, r, b] = scene.field;
  return rows.slice(y, b + 1).map(row => row.slice(x, r + 1));
}
