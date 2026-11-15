import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { solidRegionValue } from './observed-click-regions.ts';
import { observeRepeatedCells } from './observed-repeated-cells.ts';

export type VisibleScope = {
  boxes: NativeBox[];
  controls: { color: string; bbox: NativeBox; shape: readonly [number, number, unknown]; area: number }[];
  scope_members: Record<string, number[]>;
  universe_ref: string;
  focus: number[];
};

const contained = ([l, t, r, b]: NativeBox, x: number, y: number) => l <= x && x <= r && t <= y && y <= b;
const separated = ([l, t, r, b]: NativeBox, [a, d, e, f]: NativeBox) => r < a || e < l || b < d || f < t;
const extent = ([l, t, r, b]: NativeBox) => (r - l + 1) * (b - t + 1);

function nearerEdge([l, t, r, b]: NativeBox, [a, d, e, f]: NativeBox) {
  const gaps = [a - r, d - b, l - e, t - f];
  const visible = gaps.flatMap((gap, edge) => gap > 0 ? [{ gap, edge }] : []).sort((x, y) => x.gap - y.gap);
  return visible[0] && visible[0].gap !== visible[1]?.gap ? visible[0].edge : null;
}

/** The shared appearance of a control and a marked region suggests a scope to test. */
export function observeVisibleScope(rows: NativeRows): VisibleScope | null {
  const parts = geometricComponents(rows);
  const variable = observeRepeatedCells(rows, { components: parts }).filter(field => new Set(field.values.values()).size > 1);
  const offers = observeRepeatedCells(rows, { minimumSide: 2, includeUnitCells: true, separateValues: true, components: parts }).flatMap(field => {
    const { xs, ys, size: [w, h], values } = field;
    const colors = new Set(values.values());
    if (colors.size !== 1) return [];
    if (variable.some(other => other.size[0] === w && other.size[1] === h && other.values.size > values.size
      && [...values.keys()].every(address => other.values.has(address)))) return [];
    const [siteColor] = colors;
    const boxes = ys.flatMap(top => xs.map((left): NativeBox => [left, top, left + w - 1, top + h - 1]));
    const marginX = Math.floor((xs[1]! - xs[0]!) / 2), marginY = Math.floor((ys[1]! - ys[0]!) / 2);
    const domain: NativeBox = [Math.max(0, xs[0]! - marginX), Math.max(0, ys[0]! - marginY),
      Math.min(rows[0]!.length - 1, xs.at(-1)! + w - 1 + marginX), Math.min(rows.length - 1, ys.at(-1)! + h - 1 + marginY)];
    const outside = parts.filter(part => part.color !== siteColor && separated(part.bbox, domain)
      && part.area >= Math.min(w * h, 4));
    const controlColors = new Set(outside.map(part => part.color));
    if (controlColors.size < 2) return [];
    const marks = new Map<number, [number, number, number, number]>();
    const [left, top, right, bottom] = domain;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const value = rows[y]![x]!;
      if (!controlColors.has(value)) continue;
      const bounds = marks.get(value) ?? [x, y, x, y];
      bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
      marks.set(value, bounds);
    }
    const scopes = new Map<string, number[]>();
    for (const [color, bounds] of marks) {
      const members = boxes.flatMap(([l, t, r, b], i) => contained(bounds, (l + r) / 2, (t + b) / 2) ? [i] : []);
      if (members.length && members.length < boxes.length) scopes.set(String(color), members);
    }
    if (new Set([...scopes.values()].map(set => set.join(','))).size < 2) return [];
    const candidates = outside.filter(part => scopes.has(String(part.color)));
    const controlEdges = new Set(candidates.filter(part => part.area > 1)
      .flatMap(part => { const edge = nearerEdge(part.bbox, domain); return edge === null ? [] : [edge]; }));
    const controls = candidates.filter(part => {
      const edge = nearerEdge(part.bbox, domain);
      return part.area > 1 || edge !== null && controlEdges.has(edge);
    }).map(part => ({
      color: String(part.color), bbox: part.bbox, area: part.area,
      shape: [part.bbox[2] - part.bbox[0] + 1, part.bbox[3] - part.bbox[1] + 1, part.mask] as const,
    }));
    if (!controls.length) return [];
    return [{ boxes, controls, scope_members: Object.fromEntries(scopes),
      universe_ref: symbolicDigest(boxes), focus: [...new Set([...scopes.values()].flat())].sort((a, b) => a - b), extent: extent(domain) }];
  }).sort((a, b) => b.extent - a.extent);
  const [first, other] = offers;
  return first && first.extent !== other?.extent ? first : null;
}

const dominant = (rows: NativeRows) => {
  const counts = new Map<number, number>();
  for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** A stable set of sites can contain or propagate a local visual change. */
export function measureGroupResponse(before: NativeRows, frames: readonly NativeRows[], boxes: readonly NativeBox[]) {
  const baseline = boxes.map(box => solidRegionValue(before, box));
  if (baseline.some(value => value === null)) return null;
  const background = dominant(before);
  const responses: number[][] = [];
  for (const frame of frames) {
    if (dominant(frame) !== background) continue;
    const values = boxes.map(box => solidRegionValue(frame, box));
    if (values.some(value => value === null)) continue;
    const changed = values.flatMap((value, index) => value === baseline[index] ? [] : [index]);
    if (changed.length) responses.push(changed);
  }
  const tested = responses[0];
  if (!tested || tested.length === boxes.length) return null;
  if (responses.some(changed => changed.length === boxes.length)) return { tested, reachesEverySite: true };
  const observed = new Set(tested);
  return responses.every(changed => changed.every(index => observed.has(index))) ? { tested, reachesEverySite: false } : null;
}
