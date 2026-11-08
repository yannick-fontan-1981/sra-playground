/** Conditional geometric grammar fitted from public program phases and edits.
 * Source: pinned V6 program_geometry.py. No game identity or authored grammar.
 */
import { occurrenceProgramTranslationCandidates, occurrenceProgramWorldParts } from './v6-occurrence-program-observer.ts';
import { PointSet, pointKey } from './v6-point-set.ts';
import type { Point } from './v6-point-set.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { programIdentity } from './v6-program-identity.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const pair = (value: readonly number[]): Point => [value[0]!, value[1]!];

/** Tuple-keyed Python dictionaries are represented by unambiguous x,y keys. */
export function renderProgramLayers(word: readonly number[], shape: readonly (readonly number[])[], step: readonly number[]): Map<string, number> {
  const result = new Map<string, number>();
  for (let index = word.length - 1; index >= 0; index--) {
    for (const [x, y] of shape) result.set(`${x! + index * step[0]!},${y! + index * step[1]!}`, word[index]!);
  }
  return result;
}

// Geometry source indexes rows directly, with Python sequence semantics.
function pixel(rows: NativeRows, x: number, y: number): number {
  const row = rows[y < 0 ? rows.length + y : y];
  if (row === undefined) throw new RangeError('Program pixel row outside observed raster');
  const value = row[x < 0 ? row.length + x : x];
  if (value === undefined) throw new RangeError('Program pixel column outside observed raster');
  return value;
}

export function fitProgramLayerOffset(before: NativeRows, after: NativeRows, beforeMembers: readonly R[], afterMembers: readonly R[],
  shape: readonly (readonly number[])[], exclusions: readonly (readonly number[])[]): R | null {
  const change = afterMembers.length - beforeMembers.length;
  if (Math.abs(change) !== 1 || !beforeMembers.length || !afterMembers.length || beforeMembers[0]!.color !== afterMembers[0]!.color) return null;
  const palette = beforeMembers[0]!.color;
  const matches = [before, after].map(rows => [...occurrenceProgramWorldParts(rows, exclusions).values()].flat()
    .filter(entity => entity.palette === palette && equal(entity.mask, shape)));
  if (matches.some(entities => entities.length !== 1)) return null;
  const a: number[] = matches[0]![0]!.position, b: number[] = matches[1]![0]!.position;
  const growth = [0, 1].map(index => Math.floor((b[index]! - a[index]!) / change));
  if ([0, 1].some(index => (b[index]! - a[index]!) % change !== 0) || growth.reduce((sum, value) => sum + value * value, 0) !== 1) return null;
  const step = growth.map(value => value ? -value : 0);
  for (const [rows, members, entity] of [[before, beforeMembers, matches[0]![0]!], [after, afterMembers, matches[1]![0]!]] as const) {
    const [x, y] = entity.position;
    for (const [point, color] of renderProgramLayers(members.map(member => member.color), shape, step)) {
      const [u, v] = point.split(',').map(Number);
      if (pixel(rows, x + u!, y + v!) !== color) return null;
    }
  }
  return { step, shape, status: 'conditional_visual_extrusion', before_anchor: a, after_anchor: b, member_delta: change,
    same_base_hypothesis: [0, 1].map(index => a[index]! + beforeMembers.length * step[index]!),
    scope: 'Visual height correspondence fitted to a collection edit; not a physical translation law.' };
}

export function fitProgramGlyphVectors(alignment: R): R | null {
  const rules = occurrenceProgramTranslationCandidates(alignment), controls: R[] = alignment.editor_geometry.controls;
  const byLabel = new Map(controls.map(control => [control.color, control]));
  const known = rules.map(rule => {
    const control = byLabel.get(rule.label)!, holes = new PointSet();
    (control.patch as NativeRows).forEach((row, y) => row.forEach((value, x) => { if (value !== control.color) holes.add([x, y]); }));
    return { rule, control, holes };
  });
  if (known.length < 2) return null;
  let holes = known[0]!.holes.intersection(known[1]!.holes);
  for (const example of known.slice(2)) holes = holes.intersection(example.holes);
  if (holes.size < 3) return null;
  const center = [0, 1].map(index => [...holes].reduce((sum, point) => sum + point[index]!, 0) / holes.size);
  const inks = new Set<number>(known.flatMap(({ control }) => (control.patch as NativeRows).flat()));
  const viable: { ink: number; matrix: number[][] }[] = [];
  for (const ink of inks) {
    const examples: { point: number[]; target: number[] }[] = [];
    for (const { rule, control } of known) {
      const marks = [...holes].filter(([x, y]) => control.patch[y][x] === ink);
      if (marks.length !== 1) break;
      examples.push({ point: [0, 1].map(index => marks[0]![index]! - center[index]!), target: rule.vector });
    }
    if (examples.length !== known.length) continue;
    for (const { point: a, target: u } of examples) for (const { point: b, target: v } of examples) {
      const determinant = a[0]! * b[1]! - a[1]! * b[0]!;
      if (!determinant) continue;
      const matrix = [0, 1].map(index => [(u[index]! * b[1]! - v[index]! * a[1]!) / determinant,
        (-u[index]! * b[0]! + v[index]! * a[0]!) / determinant].map(value => Math.abs(value) < 1e-12 ? 0 : value));
      if (examples.every(({ point, target }) => [0, 1].every(j =>
        Math.abs(matrix[j]![0]! * point[0]! + matrix[j]![1]! * point[1]! - target[j]!) < 1e-9))) viable.push({ ink, matrix });
    }
  }
  // The key is local uniqueness, while all externally retained identities use
  // the typed glyph record below, preserving Python's float field spellings.
  const unique = new Map(viable.map(value => [programIdentity([value.ink, value.matrix]), value]));
  if (unique.size !== 1) return null;
  const { ink, matrix } = [...unique.values()][0]!, operators: R[] = [];
  for (const control of controls) {
    const marks = [...holes].filter(([x, y]) => control.patch[y][x] === ink), vectors: number[][] = [];
    for (const point of marks) {
      const vector = [0, 1].map(j => matrix[j]![0]! * (point[0] - center[0]!) + matrix[j]![1]! * (point[1] - center[1]!));
      if (vector.some(value => Math.abs(value - Math.round(value)) > 1e-9)) { vectors.length = 0; break; }
      vectors.push(vector.map(value => Math.round(value) || 0));
    }
    if (vectors.length) operators.push({ label: control.color, glyph_patch: control.patch, vectors,
      status: rules.some(rule => rule.label === control.color) ? 'phase_observed_translation' : 'glyph_extrapolation_candidate' });
  }
  return { status: 'conditional_glyph_vector_map', matrix, ink, center, operators,
    scope: 'A shared marked-position grammar fits three phase-observed displacements; other marks remain extrapolated hypotheses.' };
}

/** Color-agnostic connected supports fitting only the measured extrusion. */
export function decodeProgramStacks(rows: NativeRows, model: R, palette: ReadonlySet<number>,
  exclusions: readonly (readonly number[])[]): R[] {
  const remaining = new PointSet(), regions: PointSet[] = [];
  rows.forEach((row, y) => row.forEach((color, x) => {
    if (palette.has(color) && !exclusions.some(([a, b, c, d]) => a! <= x && x <= c! && b! <= y && y <= d!)) remaining.add([x, y]);
  }));
  while (remaining.size) {
    const seed = remaining.pop(), group = new PointSet([seed]), queue = [seed];
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const point of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as Point[]) {
        if (remaining.has(point)) { remaining.delete(point); group.add(point); queue.push(point); }
      }
    }
    regions.push(group);
  }
  const shape: Point[] = (model.shape as number[][]).map(pair), step: number[] = model.step, result: R[] = [];
  for (const region of regions) {
    const x = Math.min(...[...region].map(point => point[0])), y = Math.min(...[...region].map(point => point[1]));
    const actual = new PointSet([...region].map(([a, b]) => [a - x, b - y] as Point));
    for (let count = 1; count <= region.size; count++) {
      const supports = Array.from({ length: count }, (_, index) => new PointSet(shape.map(([u, v]) => [u + index * step[0]!, v + index * step[1]!] as Point)));
      const union = supports[0]!.union(...supports.slice(1)), minX = Math.min(...[...union].map(point => point[0])), minY = Math.min(...[...union].map(point => point[1]));
      const normal = new PointSet([...union].map(([a, b]) => [a - minX, b - minY] as Point));
      if (normal.size > region.size) break;
      if (!normal.equals(actual)) continue;
      const origin: Point = [x - minX, y - minY], word: number[] = [];
      for (let index = 0; index < supports.length; index++) {
        const support = supports[index]!, others = supports.filter((_, j) => index !== j);
        const exclusive = count > 1 ? support.difference(others[0]!.union(...others.slice(1))) : support;
        const colors = new Set([...exclusive].map(([a, b]) => pixel(rows, origin[0] + a, origin[1] + b)));
        if (colors.size !== 1) break;
        word.push([...colors][0]!);
      }
      if (word.length !== count) continue;
      if ([...renderProgramLayers(word, shape, step)].some(([key, color]) => {
        const [a, b] = key.split(',').map(Number); return pixel(rows, origin[0] + a!, origin[1] + b!) !== color;
      })) continue;
      result.push({ anchor: [...origin], word, base: [0, 1].map(index => origin[index]! + count * step[index]!), binding: 'measured_extruded_public_color_word' });
      break;
    }
  }
  return result;
}
