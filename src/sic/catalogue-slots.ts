import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type CatalogueSlot = { bbox: NativeBox; point: NativePoint; mask: NativePoint[]; extent: NativePoint };
export type CatalogueSelector = { palette: number; bbox: NativeBox; point: NativePoint };
export type SlottedCatalogue = { field: NativeBox; background: number; palette: number; controls: CatalogueSelector[];
  cards: CatalogueSlot[]; selectedCard: number | null };
type Bank = { ink: number; spans: [number, number][]; rows: number[] };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const area = (box: NativeBox) => width(box) * height(box);
const around = ([l, t, r, b]: NativeBox): NativeBox => [l - 1, t - 1, r + 1, b + 1];
const perimeter = ([l, t, r, b]: NativeBox): NativePoint[] => [
  ...Array.from({ length: r - l + 1 }, (_, i) => [[l + i, t], [l + i, b]] as NativePoint[]).flat(),
  ...Array.from({ length: b - t - 1 }, (_, i) => [[l, t + i + 1], [r, t + i + 1]] as NativePoint[]).flat(),
];
const uniformRim = (rows: NativeRows, box: NativeBox) => {
  const ink = rows[box[1]]?.[box[0]];
  return ink !== undefined && perimeter(box).every(([x, y]) => rows[y]?.[x] === ink) ? ink : null;
};

export function readSlottedCatalogue(rows: NativeRows): SlottedCatalogue | null {
  const parts = geometricComponents(rows), h = rows.length, w = rows[0]!.length;
  const frames = parts.filter(part => !part.rectangular && area(part.bbox) >= w * h / 6
    && part.bbox.every((bound, i) => i < 2 ? bound > 0 : bound < (i === 2 ? w : h) - 1)
    && uniformRim(rows, part.bbox) === part.color).sort((a, b) => area(b.bbox) - area(a.bbox));
  if (!frames[0] || frames[1] && area(frames[0].bbox) === area(frames[1].bbox)) return null;
  const field = frames[0].bbox, [l, t, r, b] = field, ambient = rows[0]![0]!;
  const inks = new Set(rows.slice(t + 1, b).flatMap(row => row.slice(l + 1, r)));
  const selectors = parts.filter(part => part.rectangular && part.bbox[3] + 1 < t && width(part.bbox) >= 3 && height(part.bbox) >= 3
    && inks.has(part.color) && part.color !== ambient).sort((a, b) => a.bbox[0] - b.bbox[0]);
  if (selectors.length < 2 || selectors.length > 6 || new Set(selectors.map(part => part.color)).size !== selectors.length
    || selectors.some(part => part.bbox[1] !== selectors[0]!.bbox[1] || part.bbox[3] !== selectors[0]!.bbox[3])) return null;
  const active = selectors.flatMap(part => {
    const rim = uniformRim(rows, around(part.bbox));
    return rim !== null && rim !== ambient && rim !== part.color ? [{ part, rim }] : [];
  });
  if (active.length !== 1) return null;
  const palette = active[0]!.part.color, outline = active[0]!.rim;
  const banks = new Map<string, Bank>();
  for (let y = b + 2; y < h - 1; y++) {
    const line = rows[y]!;
    for (const ink of new Set(line)) {
      if (ink === ambient || ink === outline || selectors.some(part => part.color === ink) || !inks.has(ink)) continue;
      const spans: [number, number][] = [];
      for (let x = 1; x < w - 1; x++) {
        if (line[x] !== ink || line[x - 1] === ink) continue;
        let right = x;
        while (line[right + 1] === ink) right++;
        if (right - x + 1 >= 4 && right < w - 1) spans.push([x, right]);
      }
      if (spans.length < 3 || spans.length > 8) continue;
      const period = spans[1]![0] - spans[0]![0], length = spans[0]![1] - spans[0]![0];
      if (spans.some(([x, right], index) => right - x !== length || x !== spans[0]![0] + period * index)) continue;
      const key = JSON.stringify([ink, spans]);
      const bank = banks.get(key) ?? { ink, spans, rows: [] };
      bank.rows.push(y);
      banks.set(key, bank);
    }
  }
  const compareBank = (a: Bank, b: Bank) => b.spans.length - a.spans.length
    || (b.spans[0]![1] - b.spans[0]![0]) - (a.spans[0]![1] - a.spans[0]![0]) || b.rows.length - a.rows.length;
  const ordered = [...banks.values()].filter(bank => bank.rows.length >= 2).sort(compareBank);
  const bank = ordered[0], other = ordered[1];
  if (!bank || other && compareBank(bank, other) === 0) return null;
  let top = bank.rows[0]!, bottom = bank.rows.at(-1)!;
  const insideSlot = (y: number) => bank.spans.every(([x, right]) =>
    rows[y]?.slice(x, right + 1).every(ink => ink === bank.ink || ink === palette || ink === outline));
  while (top > b + 1 && insideSlot(top - 1)) top--;
  while (bottom < h - 2 && insideSlot(bottom + 1)) bottom++;
  const cards = bank.spans.flatMap(([x, right]) => {
    const pixels: NativePoint[] = [];
    for (let y = top; y <= bottom; y++) for (let col = x; col <= right; col++) {
      const ink = rows[y]![col]!;
      if (![palette, bank.ink, outline].includes(ink)) return [];
      if (ink === palette) pixels.push([col, y]);
    }
    if (pixels.length < 2) return [];
    const x0 = Math.min(...pixels.map(point => point[0])), y0 = Math.min(...pixels.map(point => point[1]));
    const bbox: NativeBox = [x, top, right, bottom];
    const extent: NativePoint = [Math.max(...pixels.map(point => point[0])) - x0 + 1, Math.max(...pixels.map(point => point[1])) - y0 + 1];
    return [{ bbox, point: center(bbox), extent, mask: pixels.map(([a, c]): NativePoint => [a - x0, c - y0]) }];
  });
  if (cards.length !== bank.spans.length || new Set(cards.map(card => JSON.stringify(card.mask))).size !== cards.length) return null;
  const marked = cards.map((card, index) => {
    const [x, y, right, bottom] = card.bbox;
    return uniformRim(rows, [x - 1, y, right + 1, bottom]) === outline ? index : -1;
  }).filter(index => index >= 0);
  if (marked.length > 1) return null;
  return { field, background: bank.ink, palette, cards, selectedCard: marked[0] ?? null,
    controls: selectors.map(part => ({ palette: part.color, bbox: part.bbox, point: center(part.bbox) })) };
}
