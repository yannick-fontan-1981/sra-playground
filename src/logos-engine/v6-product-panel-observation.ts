/** Pinned product_panel_observation: measured controls and complete finite products. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Group = { width: number; height: number; frames: R[] };
const sameSet = <T>(a: Set<T>, b: Set<T>): boolean => a.size === b.size && [...a].every(value => b.has(value));
const tupleKey = (values: readonly number[]): string => JSON.stringify(values);
function product(values: readonly number[][]): number[][] {
  let rows: number[][] = [[]];
  for (const domain of values) rows = rows.flatMap(row => domain.map(value => [...row, value]));
  return rows;
}

export function measureProductPanel(rows: NativeRows): R | null {
  const groups = new Map<string, Group>(), solids: R[] = [];
  for (const component of geometricComponents(rows)) {
    const [l, t, r, b] = component.bbox, w = r - l + 1, h = b - t + 1;
    if (component.area === w * h) solids.push(component);
    if (w < 3 || h < 3) continue;
    const edge = new Set<number>();
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (y === t || y === b || x === l || x === r) edge.add(rows[y]![x]!);
    if (edge.size !== 1) continue;
    const key = `${w},${h}`;
    if (!groups.has(key)) groups.set(key, { width: w, height: h, frames: [] });
    groups.get(key)!.frames.push({ bbox: [l, t, r, b], border: [...edge][0] });
  }
  const candidates: R[] = [];
  for (const { width: w, height: h, frames } of groups.values()) {
    if (w !== h || frames.length < 2) continue;
    const byRow = new Map<number, R[]>();
    for (const frame of frames) {
      const y = frame.bbox[1];
      if (!byRow.has(y)) byRow.set(y, []);
      byRow.get(y)!.push(frame);
    }
    for (const group of byRow.values()) {
      if (group.length < 2) continue;
      const controls: R[] = [];
      for (const frame of [...group].sort((a, b) => a.bbox[0] - b.bbox[0])) {
        const [l, t, r, b] = frame.bbox, legends = new Map<string, { y: number; size: number; parts: R[] }>();
        for (const component of solids) {
          const [x, y, rr, bb] = component.bbox, ww = rr - x + 1, hh = bb - y + 1;
          if (ww !== hh || ww >= w || !(l <= x && x <= rr && rr <= r && b < y)) continue;
          const key = `${y},${ww}`;
          if (!legends.has(key)) legends.set(key, { y, size: ww, parts: [] });
          legends.get(key)!.parts.push(component);
        }
        const valid = [...legends.values()].filter(legend => legend.parts.length >= 2 && new Set(legend.parts.map(c => c.color)).size === legend.parts.length);
        if (!valid.length) break;
        valid.sort((a, b) => a.y - b.y || b.size - a.size);
        const parts = [...valid[0]!.parts].sort((a, b) => a.bbox[0] - b.bbox[0]);
        const values = parts.map(c => c.color), point = [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
        const current = rows[point[1]!]![point[0]!]!;
        if (!values.includes(current)) break;
        controls.push({ bbox: frame.bbox, point, values, current, legend_boxes: parts.map(c => c.bbox) });
      }
      if (controls.length !== group.length) continue;
      const count = controls.reduce((total, control) => total * control.values.length, 1);
      for (const { width: cw, height: ch, frames: rawCards } of groups.values()) {
        if (cw >= w || ch >= h || rawCards.length !== count) continue;
        const cards = [...rawCards].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
        const offsets: number[][] = [];
        for (const control of controls) {
          const matches: number[][] = [];
          for (let yy = 1; yy < ch - 1; yy++) for (let xx = 1; xx < cw - 1; xx++) {
            const values = new Set<number>(cards.map(card => rows[card.bbox[1] + yy]![card.bbox[0] + xx]!));
            if (sameSet(values, new Set<number>(control.values))) matches.push([xx, yy]);
          }
          if (matches.length !== 1) break;
          offsets.push(matches[0]!);
        }
        if (offsets.length !== controls.length || new Set(offsets.map(tupleKey)).size !== offsets.length) continue;
        const entries: R[] = cards.map(card => ({ ...card, values: offsets.map(([x, y]) => rows[card.bbox[1] + y!]![card.bbox[0] + x!]!) }));
        const catalogue = entries.map(entry => entry.values), unique = new Set(catalogue.map(tupleKey));
        if (unique.size !== count || !sameSet(unique, new Set(product(controls.map(control => control.values)).map(tupleKey)))) continue;
        const geometry = { controls: controls.map(control => control.bbox), legends: controls.map(control => control.legend_boxes),
          cards: entries.map(entry => entry.bbox), offsets };
        candidates.push({ geometry, geometry_ref: identity(geometry), controls, entries, current: controls.map(control => control.current), catalogue });
      }
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function productPanelCurrent(rows: NativeRows, geometry: R): number[] {
  return geometry.controls.map(([l, t, r, b]: number[]) => rows[Math.floor((t! + b!) / 2)]![Math.floor((l! + r!) / 2)]!);
}

export function productPanelCommand(control: R): R {
  return { action_ref: 'ACTION6', data: { x: control.point[0], y: control.point[1] } };
}
