import { bandEffect, type BandSense } from '../logos-engine/v6-band-transfer.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type View = { axis: 0 | 1; reverse: boolean; breadth: number; depth: number };
type Interval = readonly [start: number, end: number];
type BandLevel = { band: number; amount: number };
type Door = { kind: 'door'; box: NativeBox } & ({ edge: number; amount: number } | { thresholds: [BandLevel, BandLevel] });
type Transfer = { kind: 'transfer'; box: NativeBox } & ({ index: number } | { link: [number, number] });
type Control = Transfer | Door;
type Depth = { top: number; base: number };
type Part = ReturnType<typeof geometricComponents>[number] & { box: NativeBox };
type Marker = { cap: number; thickness: number; width: number; accent: number; pixels: readonly NativePoint[]; height: number; target: NativeBox;
  targets: { bands: number[]; amount: number } | BandLevel[] };
export type PassageLayout = { view: View; bands: Interval[]; unit: number; fill: number;
  controls: Control[]; markers: Marker[]; depths?: Depth[] };
export type LegacyPassageLayout = Omit<PassageLayout, 'markers'> & { marker: Omit<Marker, 'targets'>; targets: Marker['targets'] };
type PassagePosition = { quantities: number[]; carried: number[] };
export type PassageReading = PassagePosition & { markerBoxes: NativeBox[] };
export type PassageStep = { index: number; next: PassagePosition };
export type PassagePlan = { steps: PassageStep[]; distance: number; gate: number | null };
export type IntakeLimit = { band: number; occupant: number; amount: number };

const key = (value: unknown) => JSON.stringify(value);
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const inBand = ([l, , r]: NativeBox, [start, end]: Interval) => l >= start && r <= end;
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);

function markerStarts([left, right]: Interval, markerWidth: number, breadth: number): Set<number> {
  const center = (left + right - markerWidth + 1) / 2;
  const starts = new Set([Math.floor(center), Math.ceil(center)]);
  // A border indicator can shift the visible center of an outer compartment.
  if (left === 0) starts.add(Math.floor(center) + 1);
  if (right === breadth - 1) starts.add(Math.ceil(center) - 1);
  return starts;
}

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
  const { bands, view, unit, fill, markers, controls, depths } = layout, bottom = view.depth - 1;
  const quantities: number[] = [];
  for (const [index, [left, right]] of bands.entries()) {
    const { base, top } = depths?.[index] ?? { base: bottom, top: 0 };
    const lengths: number[] = [];
    for (let x = left; x <= right; x++) {
      if (controls.some(control => control.kind === 'transfer' && control.box[0] <= x && x <= control.box[2]
        && top <= control.box[1] && control.box[3] <= base)) continue;
      let y = base;
      while (y >= top && pixel(rows, view, x, y) === fill) y--;
      lengths.push(base - y);
    }
    if (lengths.length < 2) return null;
    const count = new Map<number, number>();
    for (const length of lengths) count.set(length, (count.get(length) ?? 0) + 1);
    const amount = [...count].find(([, n]) => n * 2 > lengths.length)?.[0];
    if (amount === undefined || amount % unit !== 0) return null;
    quantities.push(amount);
  }
  const carried: number[] = [], markerBoxes: NativeBox[] = [];
  for (const marker of markers) {
    const matches: { band: number; box: NativeBox }[] = [];
    for (const [index, band] of bands.entries()) {
      const depth = depths?.[index];
      const capBottom = (depth?.base ?? bottom) - quantities[index]!, capTop = capBottom - marker.thickness + 1, top = capTop - marker.height;
      if (depth && top < depth.top) continue;
      for (const x of markerStarts(band, marker.width, view.breadth)) {
        const cap = Array.from({ length: marker.width * marker.thickness }, (_, i) =>
          pixel(rows, view, x + i % marker.width, capTop + Math.floor(i / marker.width)));
        if (cap.every(ink => ink === marker.cap) && marker.pixels.every(([u, v]) => pixel(rows, view, x + u, top + v) === marker.accent)) {
          matches.push({ band: index, box: [x, top, x + marker.width - 1, capBottom] });
        }
      }
    }
    if (matches.length !== 1 || carried.includes(matches[0]!.band)) return null;
    carried.push(matches[0]!.band);
    markerBoxes.push(matches[0]!.box);
  }
  return { quantities, carried, markerBoxes };
}

export function passageThresholds(control: Door): [BandLevel, BandLevel] {
  if ('thresholds' in control) return control.thresholds;
  const { edge, amount } = control;
  return [{ band: edge, amount }, { band: edge + 1, amount }];
}

function readMarker(rows: NativeRows, view: View, parts: Part[], bands: Interval[], unit: number, target: Part,
  targets: Marker['targets'], depths?: Depth[]) {
  const thickness = height(target.box);
  const caps = parts.filter(part => part.rectangular && part.color === target.color && height(part.box) === thickness
    && width(part.box) > unit && bands.some((band, index) => inBand(part.box, band)
      && (!depths || part.box[1] >= depths[index]!.top && part.box[3] <= depths[index]!.base)
      && markerStarts(band, width(part.box), view.breadth).has(part.box[0])));
  if (caps.length !== 1) return null;
  const cap = caps[0]!.box;
  const accents = parts.filter(part => part.box[3] === cap[1] - 1 && part.box[0] === cap[0] && part.box[2] === cap[2]
    && !part.rectangular && part.color !== target.color);
  if (accents.length !== 1) return null;
  const accent = accents[0]!, accentBox = accent.box, fill = pixel(rows, view, center(cap)[0], cap[3] + 1);
  if (fill === undefined || fill === target.color || fill === accent.color) return null;
  const pixels: NativePoint[] = [];
  for (let y = 0; y < height(accentBox); y++) for (let x = 0; x < width(accentBox); x++) {
    if (pixel(rows, view, cap[0] + x, accentBox[1] + y) === accent.color) pixels.push([x, y]);
  }
  const marker: Marker = { cap: target.color, width: width(cap), thickness, accent: accent.color, pixels,
    height: height(accentBox), target: target.box, targets };
  return { fill, marker };
}

function transverseLayouts(rows: NativeRows, view: View, parts: Part[]): PassageLayout[] {
  const bases = parts.filter(part => part.rectangular && width(part.box) >= 2 && width(part.box) === height(part.box));
  const address = (color: number, side: number, across: number, base: number) => [color, side, across, base].join(':');
  const byAddress = new Map(bases.map(({ box, color }) => [address(color, width(box), box[0], box[3]), box]));
  type Divider = { cut: Interval; unit: number; wall: number; color: number; buttons: [NativeBox, NativeBox][] };
  const pairs = new Map<string, Divider>();
  for (const { box, color } of bases) {
    const unit = width(box), u = box[2] + 1, limit = u + unit - 1;
    const peer = byAddress.get(address(color, unit, limit + 1, box[3]));
    if (!peer) continue;
    const wall = pixel(rows, view, u, box[3]);
    if (wall === undefined || wall === color || !Array.from({ length: unit }, (_, i) => pixel(rows, view, u + i, box[3])).every(ink => ink === wall)) continue;
    const signature = key([u, unit, color, wall]);
    const group = pairs.get(signature) ?? { cut: [u, limit], unit, wall, color, buttons: [] };
    group.buttons.push([box, peer]);
    pairs.set(signature, group);
  }
  const layouts: PassageLayout[] = [], bottom = view.depth - 1;
  const combinations = [...pairs.values()].map(divider => [divider]);
  const matching = new Map<string, Divider[]>();
  for (const divider of pairs.values()) {
    const signature = key([divider.unit, divider.wall, divider.color]);
    const group = matching.get(signature) ?? [];
    group.push(divider);
    matching.set(signature, group);
  }
  for (const dividers of matching.values()) if (dividers.length >= 2 && dividers.length <= 4) {
    combinations.push(dividers.sort((a, b) => a.cut[0] - b.cut[0]));
  }
  for (const dividers of combinations) {
    const { unit, wall } = dividers[0]!;
    const buttons = dividers.flatMap(divider => divider.buttons);
    const stations = [...new Set(buttons.map(([box]) => box[3]))].sort((a, b) => b - a);
    if (stations.length < 2 || dividers.some(divider => new Set(divider.buttons.map(([box]) => box[3])).size !== divider.buttons.length)) continue;
    const support = stations[0]!, enclosed = dividers.length > 1;
    if (!enclosed && support !== bottom) continue;
    const surround = pixel(rows, view, 0, support);
    if (enclosed && (surround === wall || surround !== pixel(rows, view, view.breadth - 1, support)
      || dividers.some(divider => !divider.buttons.some(([button]) => button[3] === support)))) continue;
    const occupied = Array.from({ length: view.breadth }, (_, u) => pixel(rows, view, u, support) !== surround);
    const start = enclosed ? occupied.indexOf(true) : 0;
    const end = enclosed ? occupied.lastIndexOf(true) : view.breadth - 1;
    const cuts = dividers.map(divider => divider.cut);
    const sides: Interval[] = [...cuts, [end + 1, end + 1]].map(([l], i) => [i ? cuts[i - 1]![1] + 1 : start, l - 1]);
    if (sides.some(([l, r]) => l < 0 || r - l + 1 < 2 * unit)) continue;
    const bands: Interval[] = [], depths: Depth[] = [];
    for (const [left, right] of sides) {
      const across = right - left + 1;
      let front = 0;
      if (enclosed) {
        for (let v = support - 1; v >= 0; v--) {
          if (Array.from({ length: across }, (_, i) => pixel(rows, view, left + i, v)).every(ink => ink === surround)) {
            front = v + 1;
            break;
          }
        }
      }
      // Only a wall behind a paired control establishes a second support on this side.
      const partitions = stations.slice(1).filter(base => base > front && Array.from({ length: unit }, (_, i) => base + i + 1)
        .every(v => Array.from({ length: across }, (_, i) => pixel(rows, view, left + i, v)).filter(ink => ink === wall).length * 4 >= across * 3));
      const supports = [support, ...partitions];
      for (const [index, base] of supports.entries()) {
        const next = supports[index + 1], top = next === undefined ? front : next + unit + 1;
        bands.push([left, right]);
        depths.push({ top, base });
      }
    }
    if (bands.length <= sides.length || depths.some(({ top, base }) => base - top + 1 < 2 * unit)) continue;
    const owner = (u: number, near: number, far: number) => bands.findIndex(([l, r], i) => l <= u && u <= r
      && depths[i]!.top <= near && far <= depths[i]!.base);
    const controls: Control[] = [];
    for (const [a, b] of buttons) {
      const first = owner(a[0], a[1], a[3]), second = owner(b[0], b[1], b[3]);
      if (first < 0 || second < 0) break;
      controls.push({ kind: 'transfer', box: a, link: [first, second] }, { kind: 'transfer', box: b, link: [second, first] });
    }
    if (controls.length !== 2 * buttons.length) continue;
    const markersByFill = new Map<number, Marker[]>();
    for (const part of parts) {
      const { box, color } = part;
      const cut = cuts.find(([l, r]) => box[0] === l && box[2] === r);
      if (!part.rectangular || color === wall || !cut
        || pixel(rows, view, box[0], box[1] - 1) !== wall || pixel(rows, view, box[0], box[3] + 1) !== wall) continue;
      const left = owner(cut[0] - 1, box[1], box[3]), right = owner(cut[1] + 1, box[1], box[3]);
      if (left < 0 || right < 0) continue;
      const thresholds: [BandLevel, BandLevel] = [{ band: left, amount: depths[left]!.base - box[3] },
        { band: right, amount: depths[right]!.base - box[3] }];
      if (thresholds.some(({ amount }) => amount <= 0 || amount % unit !== 0)) continue;
      if (height(box) >= 2 * unit) controls.push({ kind: 'door', box, thresholds });
      else {
        const measured = readMarker(rows, view, parts, bands, unit, part, thresholds, depths);
        if (!measured || measured.fill === wall) continue;
        const markers = markersByFill.get(measured.fill) ?? [];
        markers.push(measured.marker);
        markersByFill.set(measured.fill, markers);
      }
    }
    if (!controls.some(control => control.kind === 'door')) continue;
    for (const [fill, markers] of markersByFill) {
      if (new Set(markers.map(marker => marker.cap)).size !== markers.length) continue;
      const layout = { view, bands, depths, fill, unit, controls, markers };
      if (readPassage(rows, layout)) layouts.push(layout);
    }
  }
  return layouts;
}

export function measurePassage(rows: NativeRows): PassageLayout | null {
  const pictures = geometricComponents(rows), layouts: PassageLayout[] = [], views: { view: View; parts: Part[] }[] = [];
  for (const axis of [0, 1] as const) for (const reverse of [false, true]) {
    const w = rows[0]!.length, h = rows.length;
    const view: View = { axis, reverse, breadth: axis === 1 ? w : h, depth: axis === 1 ? h : w };
    const parts = pictures.map(part => ({ ...part, box: viewBox(view, part.bbox) })), bottom = view.depth - 1;
    views.push({ view, parts });
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
      const byFill = new Map<number, Marker[]>();
      for (const part of parts) {
        const { box: target, rectangular, color } = part;
        const edge = cuts.findIndex(([l, r]) => target[0] === l && target[2] === r);
        const amount = bottom - target[3];
        if (!rectangular || edge < 0 || color === wall || height(target) >= unit * 2 || amount <= 0 || amount % unit !== 0
          || pixel(rows, view, target[0], target[1] - 1) !== wall || pixel(rows, view, target[0], target[3] + 1) !== wall) continue;
        const measured = readMarker(rows, view, parts, bands, unit, part, { bands: [edge, edge + 1], amount });
        if (!measured || measured.fill === wall) continue;
        const markers = byFill.get(measured.fill) ?? [];
        markers.push(measured.marker);
        byFill.set(measured.fill, markers);
      }
      for (const [fill, markers] of byFill) {
        if (new Set(markers.map(marker => marker.cap)).size !== markers.length) continue;
        const layout = { view, bands, fill, unit, controls, markers };
        if (readPassage(rows, layout)) layouts.push(layout);
      }
    }
  }
  if (!layouts.length) layouts.push(...views.flatMap(({ view, parts }) => transverseLayouts(rows, view, parts)));
  return layouts.length === 1 ? layouts[0]! : null;
}

export function passageCommand(layout: PassageLayout, control: Control): NativeCommand {
  const [u, v] = center(control.box), [x, y] = screen(layout.view, u, v);
  return { action_ref: 'ACTION6', data: { x, y } };
}

export function passageAction(layout: PassageLayout, current: PassagePosition, sense: BandSense, index: number): PassagePosition | null {
  const { quantities, carried } = current, control = layout.controls[index]!;
  if (control.kind === 'transfer') {
    let next: number[];
    if ('link' in control) {
      const [clicked, peer] = control.link;
      const [first, second] = bandEffect([quantities[clicked]!, quantities[peer]!], 0, sense, layout.unit);
      next = quantities.slice();
      next[clicked] = first!;
      next[peer] = second!;
    } else next = bandEffect(quantities, control.index, sense, layout.unit);
    return !same(next, quantities) && fitsPassage(layout, next, carried) ? { quantities: next, carried } : null;
  }
  const [first, second] = passageThresholds(control);
  const a = first.band, b = second.band;
  if (!carried.some(band => band === a || band === b) || quantities[a] !== first.amount || quantities[b] !== second.amount) return null;
  const next = carried.map(band => band === a ? b : band === b ? a : band);
  return !layout.depths || fitsPassage(layout, quantities, next) ? { quantities, carried: next } : null;
}

function fitsPassage(layout: PassageLayout, quantities: readonly number[], carried: readonly number[]) {
  if (!layout.depths) return quantities.every(amount => amount < layout.view.depth);
  return layout.depths.every(({ top, base }, band) => {
    const marker = layout.markers[carried.indexOf(band)];
    return quantities[band]! + (marker ? marker.thickness + marker.height : 0) <= base - top + 1;
  });
}

export const passageKey = ({ quantities, carried }: PassagePosition, action: number) =>
  key([quantities, carried.length === 1 ? carried[0] : carried, action]);
export const samePassage = (a: PassagePosition, b: PassagePosition | null) =>
  !!b && same(a.carried, b.carried) && same(a.quantities, b.quantities);

export function hasCompoundPassages(layout: PassageLayout): boolean {
  return !!layout.depths && layout.markers.length >= 3
    && layout.controls.filter(control => control.kind === 'door').length >= 3;
}

export function findPassage(layout: PassageLayout, initial: PassageReading, sense: BandSense, rejected: readonly string[],
  remaining: number, limits: readonly IntakeLimit[] = []): PassagePlan | null {
  const { markers } = layout, blocked = new Set(rejected);
  const stateLimit = markers.length === 1 ? 32_768 : hasCompoundPassages(layout) ? 384_000 : 96_000;
  const initialState = { quantities: initial.quantities, carried: initial.carried };
  type Entry = PassagePosition & { command: number; previous: Entry | null; depth: number; gate: number | null };
  const queue: Entry[] = [{ ...initialState, depth: 0, command: -1, previous: null, gate: null }], seen = new Set([key(initialState)]);
  for (const entry of queue) {
    const { depth, carried, quantities } = entry;
    if (depth && markers.every(({ targets }, i) => Array.isArray(targets)
      ? targets.some(({ band, amount }) => carried[i] === band && quantities[band] === amount)
      : targets.bands.includes(carried[i]!) && quantities[carried[i]!] === targets.amount)) {
      const steps: PassageStep[] = [];
      for (let item = entry; item.previous; item = item.previous) {
        steps.push({ index: item.command, next: { quantities: item.quantities, carried: item.carried } });
      }
      return { steps: steps.reverse(), distance: depth, gate: entry.gate };
    }
    if (depth >= remaining) continue;
    for (let index = 0; index < layout.controls.length; index++) {
      if (blocked.has(passageKey(entry, index))) continue;
      const next = passageAction(layout, entry, sense, index);
      if (!next || limits.some(({ band, occupant, amount }) => next.carried.indexOf(band) === occupant
        && next.quantities[band]! > quantities[band]! && next.quantities[band]! > amount)
        || seen.has(key(next))) continue;
      if (queue.length >= stateLimit) return null;
      seen.add(key(next));
      const gate = entry.gate ?? (next.carried === carried ? null : index);
      queue.push({ ...next, command: index, previous: entry, depth: depth + 1, gate });
    }
  }
  return null;
}
