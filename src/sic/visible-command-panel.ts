import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

type Component = ReturnType<typeof geometricComponents>[number];
export type VisibleCommandPanel = { area: NativeBox; fieldInk: number; panel: NativeBox; buttons: Component[]; aligned: Component[] };

const contains = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => l <= x && u <= r && t <= y && v <= b;
const disjoint = (a: NativeBox, b: NativeBox) => a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];

/** A compact group can contain controls smaller than an isolated button. */
function fourTileControls(parts: readonly Component[], background: number) {
  const tiles = new Map(parts.filter(part => part.color !== background && part.rectangular && part.area === 4
    && part.bbox[2] - part.bbox[0] === 1).map(part => [part.bbox.slice(0, 2).join(','), part]));
  const groups = [...tiles.values()].flatMap(part => {
    const [x, y] = part.bbox;
    const group = [part, tiles.get(`${x + 2},${y}`), tiles.get(`${x},${y + 2}`), tiles.get(`${x + 2},${y + 2}`)];
    return group.every(tile => tile !== undefined) && new Set(group.map(tile => tile?.color)).size === 4
      ? group as Component[] : [];
  });
  return [...new Set(groups)];
}

function crossedCenter(parts: readonly Component[], background: number) {
  const matches = parts.filter(center => {
    const [left, top, right, bottom] = center.bbox, side = right - left + 1;
    if (center.color !== background || !center.rectangular || side < 2 || bottom - top + 1 !== side) return false;
    const slots = parts.filter(({ color, bbox: [l, t, r, b], area }) => color !== background && r - l + 1 === side
      && b - t + 1 === side && area >= side * side - 1);
    const offsets = slots.map(part => [part.bbox[0] - left, part.bbox[1] - top] as const);
    const spacing = ([[0, -1], [0, 1], [-1, 0], [1, 0]] as const).map(([dx, dy]) =>
      Math.min(...offsets.filter(([x, y]) => dx ? x * dx >= side && y === 0 : y * dy >= side && x === 0)
        .map(([x, y]) => Math.abs(x) + Math.abs(y))));
    return Number.isFinite(spacing[0]) && spacing.every(distance => distance === spacing[0]);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function visibleCommandPanel(rows: NativeRows, parts = geometricComponents(rows)): VisibleCommandPanel | null {
  const area = rows.length * rows[0]!.length;
  const surfaces = parts.filter(part => !part.rectangular && part.area * 5 >= area).sort((a, b) => b.area - a.area);
  const field = surfaces[0];
  const panel = field && surfaces.find(part => part !== field && disjoint(part.bbox, field.bbox));
  if (!field || !panel) return null;
  const attached = parts.filter(part => part !== panel && contains(panel.bbox, part.bbox)
    && part.area >= 6 && part.area * 8 < panel.area);
  const small = fourTileControls(parts.filter(part => contains(panel.bbox, part.bbox)), panel.color);
  const center = crossedCenter(attached, panel.color);
  if (center) return { area: field.bbox, fieldInk: field.color, panel: panel.bbox,
    buttons: [...attached.filter(part => part !== center), ...small], aligned: [] };
  const rowsOfButtons = new Map<string, Component[]>();
  for (const part of attached) {
    const [l, t, r, b] = part.bbox, width = r - l + 1, height = b - t + 1;
    if (!part.rectangular || width < 2 || height < 2 || width > 10 || height > 10) continue;
    for (const axis of [0, 1] as const) {
      const key = [axis, part.bbox[1 - axis], width, height].join(',');
      const group = rowsOfButtons.get(key) ?? [];
      group.push(part);
      rowsOfButtons.set(key, group);
    }
  }
  const aligned = [...rowsOfButtons.entries()].flatMap(([key, group]) => {
    if (group.length < 3 || group.length > 8) return [];
    const axis = key.startsWith('0') ? 0 : 1;
    const sorted = group.sort((a, b) => a.bbox[axis] - b.bbox[axis]);
    const spacing = sorted[1]!.bbox[axis] - sorted[0]!.bbox[axis];
    return spacing > 0 && sorted.every((part, i) => part.bbox[axis] === sorted[0]!.bbox[axis] + i * spacing) ? [sorted] : [];
  }).sort((a, b) => b.length - a.length);
  if (!aligned.length || aligned[0]!.length === aligned[1]?.length) return null;
  const buttons = [...new Set([...aligned[0]!, ...attached, ...small])];
  return { area: field.bbox, fieldInk: field.color, panel: panel.bbox, buttons, aligned: aligned[0]! };
}

/** Scope experiments to the observed playing surface and controls, outside status strips. */
export function commandPanelState(rows: NativeRows, { area, panel }: Pick<VisibleCommandPanel, 'area' | 'panel'>, inputs: readonly string[]): string {
  return symbolicDigest([area, panel, ...[area, panel].map(([left, top, right, bottom]) =>
    rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1))), [...inputs].sort()]);
}
