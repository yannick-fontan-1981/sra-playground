import { bandEffect, type BandSense } from '../logos-engine/v6-band-transfer.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type View = { axis: 0 | 1; reverse: boolean; breadth: number; depth: number };
type Interval = readonly [start: number, end: number];
type Control = { kind: 'transfer'; box: NativeBox; index: number } | { kind: 'door'; box: NativeBox; edge: number; amount: number };
type Marker = { cap: number; thickness: number; width: number; accent: number; pixels: readonly NativePoint[]; height: number; target: NativeBox };
export type PassageLayout = { view: View; bands: Interval[]; unit: number; fill: number;
  controls: Control[]; marker: Marker; targets: { bands: number[]; amount: number } };
export type PassageReading = { quantities: number[]; carried: number; marker: NativeBox };
export type PassageMove = { index: number; next: { quantities: number[]; carried: number }; distance: number; gate: number | null };

const key = (value: unknown) => JSON.stringify(value);
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inBand = ([l, , r]: NativeBox, [start, end]: Interval) => l >= start && r <= end;
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);

function screen(view: View, u: number, v: number): NativePoint {
  const along = view.reverse ? view.depth - 1 - v : v;
  return view.axis === 1 ? [u, along] : [along, u];
}

function pixel(rows: NativeRows, view: View, u: number, v: number): number | undefined {
  const [x, y] = screen(view, u, v);
  return rows[y]?.[x];
}

function viewBox(view: View, [l, t, r, b]: NativeBox): NativeBox {
  const [u, v, u2, v2] = view.axis === 1 ? [l, t, r, b] : [t, l, b, r];
  return view.reverse ? [u, view.depth - 1 - v2, u2, view.depth - 1 - v] : [u, v, u2, v2];
}

export function passageBox(view: View, [l, t, r, b]: NativeBox): NativeBox {
  const [x, y] = screen(view, l, t), [x2, y2] = screen(view, r, b);
  return [Math.min(x, x2), Math.min(y, y2), Math.max(x, x2), Math.max(y, y2)];
}

function runs(pixels: readonly (number | undefined)[]) {
  const result: { start: number; end: number; hue: number | undefined }[] = [];
  for (const [i, hue] of pixels.entries()) {
    const last = result.at(-1);
    if (last && hue === last.hue) last.end = i;
    else result.push({ start: i, end: i, hue });
  }
  return result;
}

export function readPassage(rows: NativeRows, layout: PassageLayout): PassageReading | null {
  const { bands, view, unit, fill, marker, controls } = layout, bottom = view.depth - 1;
  const quantities: number[] = [], matches: { band: number; box: NativeBox }[] = [];
  for (const [index, [left, right]] of bands.entries()) {
    const lengths: number[] = [];
    for (let x = left; x <= right; x++) {
      if (controls.some(control => control.kind === 'transfer' && control.box[0] <= x && x <= control.box[2])) continue;
      let y = bottom;
      while (y >= 0 && pixel(rows, view, x, y) === fill) y--;
      lengths.push(bottom - y);
    }
    if (lengths.length < 2) return null;
    const count = new Map<number, number>();
    for (const length of lengths) count.set(length, (count.get(length) ?? 0) + 1);
    const amount = [...count].find(([, n]) => n * 2 > lengths.length)?.[0];
    if (amount === undefined || amount % unit !== 0) return null;
    quantities.push(amount);
    const capBottom = bottom - amount, capTop = capBottom - marker.thickness + 1, top = capTop - marker.height;
    const x0 = (left + right - marker.width + 1) / 2;
    for (const x of new Set([Math.floor(x0), Math.ceil(x0)])) {
      const cap = Array.from({ length: marker.width * marker.thickness }, (_, i) =>
        pixel(rows, view, x + i % marker.width, capTop + Math.floor(i / marker.width)));
      if (cap.every(ink => ink === marker.cap) && marker.pixels.every(([u, v]) => pixel(rows, view, x + u, top + v) === marker.accent)) {
        matches.push({ band: index, box: [x, top, x + marker.width - 1, capBottom] });
      }
    }
  }
  return matches.length === 1 ? { quantities, carried: matches[0]!.band, marker: matches[0]!.box } : null;
}

export function measurePassage(rows: NativeRows): PassageLayout | null {
  const pictures = geometricComponents(rows), layouts: PassageLayout[] = [];
  for (const axis of [0, 1] as const) for (const reverse of [false, true]) {
    const w = rows[0]!.length, h = rows.length;
    const view: View = { axis, reverse, breadth: axis === 1 ? w : h, depth: axis === 1 ? h : w };
    const parts = pictures.map(part => ({ ...part, box: viewBox(view, part.bbox) })), bottom = view.depth - 1;
    const groups = new Map<string, typeof parts>();
    for (const part of parts) {
      const { box, color } = part, side = width(box);
      if (box[3] !== bottom || !part.rectangular || side < 2 || side !== height(box)) continue;
      const signature = key([color, side]), group = groups.get(signature) ?? [];
      group.push(part);
      groups.set(signature, group);
    }
    for (const group of groups.values()) {
      if (group.length < 2 || group.length % 2 !== 0) continue;
      const buttons = group.map(part => part.box).sort((a, b) => a[0] - b[0]), unit = width(buttons[0]!);
      const paired = buttons.filter((box, i) => i % 2 === 0 && buttons[i + 1]![0] - box[2] - 1 === unit);
      const wallColors = new Set(paired.map(box => pixel(rows, view, box[2] + 1, bottom)));
      if (wallColors.size !== 1 || wallColors.has(group[0]!.color)) continue;
      const wall = [...wallColors][0];
      const cuts = runs(Array.from({ length: view.breadth }, (_, x) => pixel(rows, view, x, bottom)))
        .filter(run => run.hue === wall && run.end - run.start + 1 === unit && run.start > 0 && run.end + 1 < view.breadth)
        .map(({ start, end }): Interval => [start, end]);
      if (cuts.length < 2 || cuts.length > 7) continue;
      const bands = [...cuts, [view.breadth, view.breadth] as const].map(([start], i): Interval => [i ? cuts[i - 1]![1] + 1 : 0, start - 1]);
      if (bands.some(([l, r]) => r - l + 1 < unit * 2)) continue;
      const controls: Control[] = [];
      for (const [edge, [l, r]] of cuts.entries()) {
        const before = buttons.find(box => box[2] === l - 1), after = buttons.find(box => box[0] === r + 1);
        if (before && after) controls.push({ kind: 'transfer', box: before, index: edge * 2 }, { kind: 'transfer', box: after, index: edge * 2 + 1 });
        const doors = parts.filter(({ rectangular, box, color }) => rectangular && box[0] === l && box[2] === r && color !== wall
          && height(box) >= unit * 2 && box[3] < bottom && (bottom - box[3]) % unit === 0
          && pixel(rows, view, l, box[1] - 1) === wall && pixel(rows, view, l, box[3] + 1) === wall);
        if (doors.length === 1) controls.push({ kind: 'door', box: doors[0]!.box, edge, amount: bottom - doors[0]!.box[3] });
      }
      if (controls.filter(control => control.kind === 'transfer').length !== buttons.length || !controls.some(control => control.kind === 'door')) continue;
      for (const { box: target, rectangular, color } of parts) {
        const edge = cuts.findIndex(([l, r]) => target[0] === l && target[2] === r);
        const amount = bottom - target[3];
        if (!rectangular || edge < 0 || color === wall || height(target) >= unit * 2 || amount <= 0 || amount % unit !== 0
          || pixel(rows, view, target[0], target[1] - 1) !== wall || pixel(rows, view, target[0], target[3] + 1) !== wall) continue;
        const caps = parts.filter(part => part.rectangular && part.color === color && height(part.box) === height(target)
          && width(part.box) > unit && bands.some(band => inBand(part.box, band) && Math.abs(part.box[0] + part.box[2] - band[0] - band[1]) <= 1));
        if (caps.length !== 1) continue;
        const cap = caps[0]!.box;
        const accents = parts.filter(part => part.box[3] === cap[1] - 1 && part.box[0] === cap[0] && part.box[2] === cap[2]
          && !part.rectangular && part.color !== color);
        if (accents.length !== 1) continue;
        const accent = accents[0]!, accentBox = accent.box, fill = pixel(rows, view, center(cap)[0], cap[3] + 1);
        if (fill === undefined || fill === wall || fill === color || fill === accent.color) continue;
        const pixels: NativePoint[] = [];
        for (let y = 0; y < height(accentBox); y++) for (let x = 0; x < width(accentBox); x++) {
          if (pixel(rows, view, cap[0] + x, accentBox[1] + y) === accent.color) pixels.push([x, y]);
        }
        const marker = { cap: color, width: width(cap), thickness: height(cap), accent: accent.color, pixels, height: height(accentBox), target };
        const layout = { view, bands, fill, unit, controls, marker, targets: { bands: [edge, edge + 1], amount } };
        if (readPassage(rows, layout)) layouts.push(layout);
      }
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

export function passageCommand(layout: PassageLayout, control: Control): NativeCommand {
  const [u, v] = center(control.box), [x, y] = screen(layout.view, u, v);
  return { action_ref: 'ACTION6', data: { x, y } };
}

export function passageAction(layout: PassageLayout, current: Pick<PassageReading, 'quantities' | 'carried'>, sense: BandSense, index: number) {
  const { quantities, carried } = current, control = layout.controls[index]!;
  if (control.kind === 'transfer') {
    const next = bandEffect(quantities, control.index, sense, layout.unit);
    return !same(next, quantities) && next.every(amount => amount < layout.view.depth) ? { quantities: next, carried } : null;
  }
  const { edge, amount } = control;
  return (carried === edge || carried === edge + 1) && quantities[edge] === amount && quantities[edge + 1] === amount
    ? { quantities, carried: 2 * edge + 1 - carried } : null;
}

export const passageKey = ({ quantities, carried }: Pick<PassageReading, 'quantities' | 'carried'>, action: number) => key([quantities, carried, action]);
export const samePassage = (a: Pick<PassageReading, 'quantities' | 'carried'>, b: Pick<PassageReading, 'quantities' | 'carried'> | null) =>
  !!b && a.carried === b.carried && same(a.quantities, b.quantities);

export function findPassage(layout: PassageLayout, initial: PassageReading, sense: BandSense, rejected: readonly string[], remaining: number): PassageMove | null {
  const { targets } = layout, blocked = new Set(rejected);
  const initialState = { quantities: initial.quantities, carried: initial.carried };
  type Entry = typeof initialState & { first: PassageMove | null; depth: number; gate: number | null };
  const queue: Entry[] = [{ ...initialState, depth: 0, first: null, gate: null }], seen = new Set([key(initialState)]);
  for (const entry of queue) {
    const { depth, first, carried, quantities } = entry;
    if (first && targets.bands.includes(carried) && quantities[carried] === targets.amount) return { ...first, distance: depth, gate: entry.gate };
    if (depth >= remaining) continue;
    for (let index = 0; index < layout.controls.length; index++) {
      if (blocked.has(passageKey(entry, index))) continue;
      const next = passageAction(layout, entry, sense, index);
      if (!next || seen.has(key(next))) continue;
      if (queue.length >= 32_768) return null;
      seen.add(key(next));
      const gate = entry.gate ?? (next.carried === carried ? null : index);
      queue.push({ ...next, first: first ?? { index, next, distance: 0, gate }, depth: depth + 1, gate });
    }
  }
  return null;
}
