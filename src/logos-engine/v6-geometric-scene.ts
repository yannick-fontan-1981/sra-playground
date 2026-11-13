/** Remaining palette-neutral measurements from the pinned geometric_observer.py. */
import { geometricComponents, geometricTransitions, rotateMask } from './v6-native-observer.ts';
import type { GeometricComponent, NativeRows, Pixel, PixelBox } from './v6-native-observer.ts';
import { pythonEqual } from './v6-operations.ts';

type R = Record<string, any>;
export interface FramedPattern {
  id: string; bbox: PixelBox; color: number; scale: number; mask: readonly Pixel[];
  center: Pixel; foreground_area: number;
}
const key = (x: number, y: number) => `${x},${y}`;
const compare = (a: Pixel, b: Pixel) => a[0] - b[0] || a[1] - b[1];
const sameMask = (a: readonly Pixel[], b: readonly Pixel[]) => a.length === b.length && a.every((p, i) => p[0] === b[i]![0] && p[1] === b[i]![1]);

export function compactComponents(parts: readonly GeometricComponent[]): R[] {
  return parts.map(part => Object.fromEntries(Object.entries(part).filter(([name]) => name !== 'mask' && name !== 'normalized')));
}

/** Iteration of the two-element CPython set of nonnegative uint8 colors. */
function twoColorOrder(colors: readonly number[]): number[] {
  const slots: (number | undefined)[] = Array(8).fill(undefined);
  for (const color of colors) {
    let slot = color & 7, perturb = color;
    while (slots[slot] !== undefined && slots[slot] !== color) { perturb >>>= 5; slot = (slot * 5 + 1 + perturb) & 7; }
    slots[slot] = color;
  }
  return slots.filter((value): value is number => value !== undefined);
}

export function framedPatterns(rows: NativeRows, parts: readonly GeometricComponent[], occlusionBBox: PixelBox | null = null): FramedPattern[] {
  const patterns: FramedPattern[] = [];
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox;
    if (part.rectangular || Math.max(right - left + 1, bottom - top + 1) > 32 || Math.min(right - left + 1, bottom - top + 1) < 5) continue;
    const visible = (x: number, y: number) => !occlusionBBox || !(occlusionBBox[0] <= x && x <= occlusionBBox[2] && occlusionBBox[1] <= y && y <= occlusionBBox[3]);
    const colors = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (visible(x, y)) colors.add(rows[y]![x]!);
    if (colors.size !== 2) continue;
    const other = twoColorOrder([...colors]).find(color => color !== part.color)!;
    const points: Pixel[] = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (visible(x, y) && rows[y]![x] === other) points.push([x, y]);
    if (!points.length) continue;
    const x0 = Math.min(...points.map(p => p[0])), y0 = Math.min(...points.map(p => p[1]));
    const x1 = Math.max(...points.map(p => p[0])), y1 = Math.max(...points.map(p => p[1]));
    let scale = 1;
    for (let size = 2; size <= Math.min(x1 - x0 + 1, y1 - y0 + 1); size++) {
      if ((x1 - x0 + 1) % size || (y1 - y0 + 1) % size) continue;
      const blocks = new Map<string, Set<boolean>>();
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const id = key(Math.floor((x - x0) / size), Math.floor((y - y0) / size));
        const values = blocks.get(id) ?? new Set<boolean>(); values.add(rows[y]![x] === other); blocks.set(id, values);
      }
      if ([...blocks.values()].every(values => values.size === 1)) scale = size;
    }
    const mask = new Map<string, Pixel>();
    for (const [x, y] of points) { const a = Math.floor((x - x0) / scale), b = Math.floor((y - y0) / scale); mask.set(key(a, b), [a, b]); }
    patterns.push({ id: part.id, bbox: part.bbox, color: other, scale, mask: [...mask.values()].sort(compare),
      center: [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)], foreground_area: points.length });
  }
  return patterns;
}

export function matchingGeometricRules(rules: readonly R[], facts: R): R[] {
  return rules.filter(rule => Object.entries(rule.when).every(([name, expected]) => pythonEqual(Object.hasOwn(facts, name) ? facts[name] : null, expected)));
}

export function alignmentScene(rows: NativeRows, policy: R, occlusionBBox: PixelBox | null = null): R {
  const parts = geometricComponents(rows), patterns = framedPatterns(rows, parts, occlusionBBox);
  const pairs: [FramedPattern, FramedPattern, number[]][] = [];
  for (const a of patterns) for (const b of patterns) {
    if (a.scale <= b.scale) continue;
    const turns = [0, 1, 2, 3].filter(turn => sameMask(rotateMask(a.mask, turn), b.mask));
    if (turns.length) pairs.push([a, b, turns]);
  }
  if (pairs.length !== 1) throw new RangeError(`Unresolved framed-pattern pair domain: ${pairs.length}`);
  const [display, target, turns] = pairs[0]!, height = rows.length, width = rows[0]!.length;
  const interior = parts.filter(p => p.bbox[0] > 0 && p.bbox[1] > 0 && p.bbox[2] < width - 1 && p.bbox[3] < height - 1);
  if (!interior.length) throw new RangeError('max() arg is an empty sequence');
  const maximum = Math.max(...interior.map(p => p.area));
  const substrates = interior.filter(p => matchingGeometricRules(policy.role_rules, { largest_interior_component: p.area === maximum, rectangular: p.rectangular }).length);
  if (substrates.length !== 1) throw new RangeError('Unresolved substrate domain');
  const roles: R[] = [];
  const subjects: [FramedPattern | GeometricComponent, R][] = [
    [display, { paired_shape: true, larger_scale: true }], [target, { paired_shape: true, smaller_scale: true }],
    [substrates[0]!, { largest_interior_component: true, rectangular: false }],
  ];
  for (const [part, facts] of subjects) for (const rule of matchingGeometricRules(policy.role_rules, facts)) roles.push({ entity: part.id, role: rule.id,
    status: rule.status, evidence: facts, falsifier: rule.falsifier });
  return { parts, display, target, substrate: substrates[0]!, roles,
    residual: { shape_equal_under_rotation: true, orientation_turns: turns, color_equal: display.color === target.color },
    aligned: turns.includes(0) && display.color === target.color };
}

export function movedBody(before: readonly GeometricComponent[], after: readonly GeometricComponent[], previousBBox: PixelBox | null = null): R {
  if (previousBBox) {
    const [l, t, r, b] = previousBBox;
    before = before.filter(p => l <= p.bbox[0] && p.bbox[0] <= p.bbox[2] && p.bbox[2] <= r && t <= p.bbox[1] && p.bbox[1] <= p.bbox[3] && p.bbox[3] <= b);
  }
  const changes = geometricTransitions(before, after).filter(c => (c.translation[0] !== 0 || c.translation[1] !== 0) && c.quarter_turns.includes(0));
  const vectors = new Map(changes.map(c => [JSON.stringify(c.translation), c.translation]));
  if (vectors.size !== 1) throw new RangeError('Ambiguous controlled translation');
  const ids = new Set(changes.map(c => c.after)), selected = after.filter(p => ids.has(p.id));
  const bounds = [Math.min(...selected.map(p => p.bbox[0])), Math.min(...selected.map(p => p.bbox[1])), Math.max(...selected.map(p => p.bbox[2])), Math.max(...selected.map(p => p.bbox[3]))];
  return { bbox: bounds, center: [Math.floor((bounds[0]! + bounds[2]!) / 2), Math.floor((bounds[1]! + bounds[3]!) / 2)],
    translation: vectors.values().next().value!, parts: selected.map(p => p.id) };
}

export function geometricGridPaths(rows: NativeRows, scene: R, body: R, step: number): { cells: Map<string, number[]>; paths: Map<string, string[]> } {
  if (!Number.isSafeInteger(step) || step === 0) throw new RangeError('A nonzero integer lattice step is required');
  const start = body.center as Pixel, [l, t, r, b] = scene.substrate.bbox as PixelBox, color = scene.substrate.color;
  const half = Math.floor(step / 2), mod = (x: number) => ((x % step) + step) % step || 0;
  const cells = new Map<string, number[]>();
  for (let y = mod(start[1]); step > 0 ? y < rows.length : y > rows.length; y += step) {
    for (let x = mod(start[0]); step > 0 ? x < rows[0]!.length : x > rows[0]!.length; x += step) {
      if (!(l <= x && x <= r && t <= y && y <= b)) continue;
      const values: number[] = [];
      for (let yy = Math.max(0, y - half); yy < Math.min(rows.length, y + half + 1); yy++) for (let xx = Math.max(0, x - half); xx < Math.min(rows[0]!.length, x + half + 1); xx++) values.push(rows[yy]![xx]!);
      if (values.filter(value => value === color).length > Math.floor(values.length / 2)) cells.set(key(x, y), values);
    }
  }
  const startKey = key(...start), destination = scene.target.center as Pixel;
  cells.set(startKey, []); cells.set(key(...destination), []);
  const paths = new Map<string, string[]>([[startKey, []]]), queue: Pixel[] = [start];
  const movements: [string, number, number][] = [['ACTION1', 0, -step], ['ACTION2', 0, step], ['ACTION3', -step, 0], ['ACTION4', step, 0]];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [x, y] = queue[cursor]!;
    for (const [action, dx, dy] of movements) {
      const next = key(x + dx, y + dy);
      if (cells.has(next) && !paths.has(next)) { paths.set(next, [...paths.get(key(x, y))!, action]); queue.push([x + dx, y + dy]); }
    }
  }
  return { cells, paths };
}
