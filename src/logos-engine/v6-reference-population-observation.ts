/**
 * Public-raster projection consumed by reference_population_access.py, pinned
 * at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. Receiving/reference frames,
 * lattice pitch, occupancy and appearances are measured; no palette role or
 * neighborhood color law is supplied. Coordinates here are [row, column].
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { geometricComponents, validateRows } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export type ReferencePopulationCell = [number, number];
export type ReferencePopulationPath = [R[], ReferencePopulationCell[]];
type CellCollection = readonly (readonly number[])[] | ReadonlySet<string>;
const orderCell = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
export const referencePopulationCellKey = (cell: readonly number[]): string => JSON.stringify(cell);
const cellSet = (cells: CellCollection): ReadonlySet<string> => Array.isArray(cells)
  ? new Set(cells.map(referencePopulationCellKey)) : cells as ReadonlySet<string>;

function mode(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let selected: number | undefined, maximum = -1;
  // Counter.most_common ties retain first row-major encounter order.
  for (const [value, count] of counts) if (count > maximum) { selected = value; maximum = count; }
  if (selected === undefined) throw new RangeError('Population projection requires a nonempty measured cell');
  return selected;
}

function measuredPixel(rows: NativeRows, y: number, x: number): number {
  if (!Number.isSafeInteger(y) || !Number.isSafeInteger(x) || y < 0 || x < 0
    || y >= rows.length || x >= rows[y]!.length) {
    throw new RangeError('Retained population cell is outside the current public raster');
  }
  return rows[y]![x]!;
}

export function measureReferencePopulation(rows: NativeRows, retained: R | null = null): R | null {
  if (retained && Object.keys(retained).length) {
    validateRows(rows);
    const pitch = retained.q, size = pitch - 1, [oy, ox] = retained.offset, bodies: R[] = [];
    if (!Number.isSafeInteger(pitch) || pitch < 2) throw new RangeError('Invalid retained population lattice pitch');
    for (const [y, x] of retained.floor as number[][]) {
      const values: number[] = [];
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        values.push(measuredPixel(rows, oy + y! * pitch + dy, ox + x! * pitch + dx));
      }
      const appearance = mode(values), differences: number[][] = [];
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const value = values[dy * size + dx]!;
        if (value !== appearance) differences.push([dy, dx, value]);
      }
      const marked = differences.length === 1 && (retained.observed_marker_overlays ?? [])
        .some((overlay: number[]) => overlay.length === 3 && overlay.every((value, i) => value === differences[0]![i]));
      if ((new Set(values).size === 1 || marked)
        && ![retained.background, retained.empty, retained.border].includes(appearance)) {
        bodies.push({ cell: [y, x], appearance });
      }
    }
    if (bodies.length !== retained.population) return null;
    const [left, top, right, bottom] = retained.reference_box;
    if (identity(rows.slice(top, bottom + 1).map(row => row.slice(left, right + 1))) !== retained.reference_digest) return null;
    return structuredClone({ ...retained, bodies: bodies.sort((a, b) => orderCell(a.cell, b.cell)) });
  }

  const parts = geometricComponents(rows), background = mode(rows.flat()), frames = [];
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1, height = bottom - top + 1;
    if (Math.min(width, height) < 7) continue;
    const mask = new Set(part.mask.map(referencePopulationCellKey));
    let complete = true;
    for (let x = 0; complete && x < width; x++) {
      complete = mask.has(referencePopulationCellKey([x, 0])) && mask.has(referencePopulationCellKey([x, height - 1]));
    }
    for (let y = 0; complete && y < height; y++) {
      complete = mask.has(referencePopulationCellKey([0, y])) && mask.has(referencePopulationCellKey([width - 1, y]));
    }
    if (complete) frames.push(part);
  }
  const squares = parts.filter(part => part.rectangular && part.bbox[2] - part.bbox[0] === part.bbox[3] - part.bbox[1]
    && 2 <= part.scale && part.scale <= 8);
  // itertools.permutations preserves the observer's encounter order.
  for (const zone of frames) for (const reference of frames) {
    if (zone === reference || zone.color !== reference.color) continue;
    const [left, top, right, bottom] = zone.bbox, [rl, rt, rr, rb] = reference.bbox;
    if (!(right < rl || rr < left || bottom < rt || rb < top)) continue;
    const inside = squares.filter(part => left < part.bbox[0] && part.bbox[2] < right
      && top < part.bbox[1] && part.bbox[3] < bottom);
    if (inside.length < 2 || new Set(inside.map(part => part.color)).size !== 1
      || new Set(inside.map(part => part.scale)).size !== 1) continue;
    const empty = inside[0]!.color, pitch = inside[0]!.scale + 1;
    const zy = Math.min(...inside.map(part => part.bbox[1])), zx = Math.min(...inside.map(part => part.bbox[0]));
    const height = Math.floor((bottom - top) / pitch), width = Math.floor((right - left) / pitch);
    if (inside.length !== height * width) continue;
    const refs = squares.filter(part => part.scale === pitch - 1 && rl < part.bbox[0] && part.bbox[2] < rr
      && rt < part.bbox[1] && part.bbox[3] < rb && part.color !== background);
    if (!refs.length) continue;
    const ry = Math.min(...refs.map(part => part.bbox[1])), rx = Math.min(...refs.map(part => part.bbox[0]));
    const target = refs.map(part => [Math.floor((part.bbox[1] - ry) / pitch), Math.floor((part.bbox[0] - rx) / pitch), part.color]);
    if (Math.max(...target.map(cell => cell[0]!)) >= height || Math.max(...target.map(cell => cell[1]!)) >= width) continue;
    const separators = parts.filter(part => part.rectangular && part.bbox[0] === 0 && part.bbox[2] === rows[0]!.length - 1
      && part.bbox[1] > bottom).map(part => part.bbox[1]);
    if (!separators.length) continue;
    const lowerBoundary = Math.min(...separators), oy = zy % pitch, ox = zx % pitch, floor: ReferencePopulationCell[] = [];
    for (let y = 0; y <= Math.floor((lowerBoundary - oy - (pitch - 1)) / pitch); y++) {
      for (let x = 0; x <= Math.floor((rows[0]!.length - ox - (pitch - 1)) / pitch); x++) floor.push([y, x]);
    }
    const bodyParts = squares.filter(part => part.scale === pitch - 1 && part.bbox[3] < lowerBoundary
      && ![background, empty, zone.color].includes(part.color)
      && part.bbox[0] % pitch === ox && part.bbox[1] % pitch === oy);
    if (bodyParts.length !== target.length) continue;
    const bodies = bodyParts.map(part => ({ cell: [Math.floor((part.bbox[1] - oy) / pitch), Math.floor((part.bbox[0] - ox) / pitch)], appearance: part.color }))
      .sort((a, b) => orderCell(a.cell, b.cell));
    const desired = target.map(([y, x, appearance]) => [Math.floor((zy - oy) / pitch) + y!, Math.floor((zx - ox) / pitch) + x!, appearance]);
    return structuredClone({ q: pitch, offset: [oy, ox], floor, zone_box: zone.bbox, reference_box: reference.bbox,
      reference_digest: identity(rows.slice(rt, rb + 1).map(row => row.slice(rl, rr + 1))), target: desired,
      background, empty, border: zone.color, population: bodies.length, bodies });
  }
  return null;
}

export function referencePopulationPoint(scene: R, cell: readonly number[]): { x: number; y: number } {
  return { x: scene.offset[1] + cell[1]! * scene.q + Math.floor((scene.q - 1) / 2),
    y: scene.offset[0] + cell[0]! * scene.q + Math.floor((scene.q - 1) / 2) };
}

/** The shared owner adds inherited candidates exactly once. */
export function referencePopulationInputs(rows: NativeRows, available: readonly string[]): R[] {
  const scene = measureReferencePopulation(rows);
  return scene && available.includes('ACTION6') ? scene.bodies.map((body: R) =>
    ({ action_ref: 'ACTION6', data: referencePopulationPoint(scene, body.cell) })) : [];
}

export function referencePopulationPaths(start: readonly number[], floor: CellCollection, occupied: CellCollection,
  controls: R, visit?: () => void): Map<string, ReferencePopulationPath> {
  const free = cellSet(floor), taken = cellSet(occupied), initial: ReferencePopulationCell = [start[0]!, start[1]!];
  const found = new Map<string, ReferencePopulationPath>([[referencePopulationCellKey(initial), [[], [initial]]]]), queue = [initial];
  const ordered = Object.entries(controls).sort(([a], [b]) => compareUnicode(a, b));
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!, [word, path] = found.get(referencePopulationCellKey(cell))!;
    for (const [action, law] of ordered) {
      visit?.();
      const next: ReferencePopulationCell = [cell[0] + law.delta[0], cell[1] + law.delta[1]], key = referencePopulationCellKey(next);
      if (found.has(key) || !free.has(key) || (taken.has(key) && key !== referencePopulationCellKey(initial))) continue;
      found.set(key, [[...word, { action_ref: action }], [...path, next]]); queue.push(next);
    }
  }
  return found;
}

export function referencePopulationLocalRelations(scene: R): R[] {
  const occupied = new Set(scene.bodies.map((body: R) => referencePopulationCellKey(body.cell)));
  return scene.bodies.map((body: R) => {
    const [y, x] = body.cell; let mask = 0, degree = 0;
    for (const [index, [dy, dx]] of [[-1, 0], [1, 0], [0, -1], [0, 1]].entries()) {
      if (occupied.has(referencePopulationCellKey([y + dy!, x + dx!]))) { mask += 1 << index; degree++; }
    }
    return { local_direction_mask: mask, degree, appearance: body.appearance };
  });
}
