import { acceptsConstraint, fieldConstraints, type ConstraintTable, type MeasuredField } from '../logos-engine/v6-field-constraints.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Rule = Parameters<typeof fieldConstraints>[1];
type Control = { address: string; point: NativePoint; box: NativeBox; value: number; marked: boolean };
export type FieldChange = { box: NativeBox; from: number; to: number };
export type BinaryField = { controls: Control[]; constraints: ConstraintTable; colors: [number, number]; pitch: NativePoint };

// The middle and corners carry the value. The four uniform orthogonal marks describe a possible action footprint.
function markerValue(glyph: number[][] | undefined): number | undefined {
  if (glyph?.length !== 3 || glyph.some(row => row.length !== 3)) return undefined;
  const [a, north, c] = glyph[0]!, [west, value, east] = glyph[1]!, [g, south, i] = glyph[2]!;
  return a === value && c === value && g === value && i === value && north !== value
    && north === east && north === south && north === west ? value : undefined;
}

export function protectedWindowBoxes(field: MeasuredField): NativeBox[] {
  if (field.groups.length !== 1) return [];
  const tiles = [...field.groups[0]!], [w, h] = field.size;
  const marked = tiles.filter(([, tile]) => markerValue(tile.glyph) !== undefined);
  if (marked.length < 2 || !tiles.some(([, tile]) => tile.value !== undefined)) return [];
  const windows = tiles.filter(([, tile]) => tile.shape?.join() === '3,3' && markerValue(tile.glyph) === undefined);
  if (windows.length < 2) return [];
  return windows.map(([address]) => {
    const [x, y] = address.split(',').map(Number) as [number, number];
    return [x, y, x + w - 1, y + h - 1];
  });
}

export function readBinaryField(field: MeasuredField, rule: Rule): BinaryField | null {
  if (field.groups.length !== 1 || rule.shape.join() !== '3,3') return null;
  const group = field.groups[0]!, decoded = new Map(group), controls: Control[] = [];
  const values = new Set<number>();
  for (const [address, tile] of group) {
    const value = tile.value ?? markerValue(tile.glyph);
    if (value === undefined) {
      const [x, y] = rule.anchor, reference = tile.glyph?.[y!]?.[x!];
      if (reference !== undefined) values.add(reference);
      continue;
    }
    const [x, y] = address.split(',').map(Number) as [number, number];
    const [w, h] = field.size, marked = tile.value === undefined;
    controls.push({ address, point: [x, y], box: [x, y, x + w - 1, y + h - 1], value, marked });
    values.add(value);
    if (marked) decoded.set(address, { value });
  }
  if (values.size !== 2 || controls.length > 64 || controls.filter(control => control.marked).length < 2
    || controls.every(control => control.marked)) return null;
  const constraints = fieldConstraints({ ...field, groups: [decoded] }, rule);
  if (!constraints?.size) return null;
  const colors = [...values] as [number, number];
  if ([...constraints.values()].some(constraint => !colors.some(color => acceptsConstraint(constraint, color)))) return null;
  return { controls: controls.sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]), constraints, colors, pitch: field.pitch };
}

export function actionFootprint(field: BinaryField, control: Control): Control[] {
  const [x, y] = control.point, [dx, dy] = field.pitch;
  return field.controls.filter(other => {
    if (other.address === control.address) return true;
    if (!control.marked) return false;
    const [a, b] = other.point;
    return (a === x && Math.abs(b - y) === dy) || (b === y && Math.abs(a - x) === dx);
  });
}

export function binaryChanges(field: BinaryField, control: Control): FieldChange[] {
  return actionFootprint(field, control).map(({ box, value }) => ({ box, from: value,
    to: field.colors[0] === value ? field.colors[1] : field.colors[0] }));
}

export function followsBinaryEffect(bounds: NativeBox, changes: readonly FieldChange[], before: NativeRows, after: NativeRows): boolean {
  const [l, t, r, b] = bounds;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const ink = before[y]?.[x];
    const change = changes.find(({ box: [left, top, right, bottom], from }) =>
      ink === from && x >= left && y >= top && x <= right && y <= bottom);
    if (after[y]?.[x] !== (change?.to ?? ink)) return false;
  }
  return true;
}

export function solveBinaryField(field: BinaryField): Control[] | null {
  const controls = field.controls, footprints = controls.map(control => new Set(actionFootprint(field, control).map(item => item.address)));
  const variables = controls.map((_, i) => 1n << BigInt(i)), rhs = 1n << BigInt(controls.length);
  const rows = [...field.constraints].flatMap(([address, constraint]) => {
    if (field.colors.every(color => acceptsConstraint(constraint, color))) return [];
    let row = acceptsConstraint(constraint, constraint.actual) ? 0n : rhs;
    for (const [i, footprint] of footprints.entries()) if (footprint.has(address)) row |= variables[i]!;
    return [row];
  });
  const pivots = new Map<number, number>();
  for (const [i, bit] of variables.entries()) {
    const rank = pivots.size;
    const pivot = rows.findIndex((row, rowIndex) => rowIndex >= rank && !!(row & bit));
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot]!, rows[rank]!];
    for (const [j, row] of rows.entries()) if (j !== rank && (row & bit)) rows[j] = row ^ rows[rank]!;
    pivots.set(i, rank);
  }
  if (rows.some(row => row === rhs)) return null;
  const free = variables.filter((_, i) => !pivots.has(i));
  let best: Control[] | null = null;
  const completions = free.length <= 10 ? 2 ** free.length : 1;
  for (let assignment = 0; assignment < completions; assignment++) {
    let result = free.reduce((mask, bit, i) => (assignment & (1 << i)) ? mask | bit : mask, 0n);
    for (const [i, row] of pivots) {
      let parity = Boolean(rows[row]! & rhs);
      for (const bit of free) if (rows[row]! & result & bit) parity = !parity;
      if (parity) result |= variables[i]!;
    }
    const moves = controls.filter((_, i) => result & variables[i]!);
    if (!best || moves.length < best.length) best = moves;
  }
  return best;
}
