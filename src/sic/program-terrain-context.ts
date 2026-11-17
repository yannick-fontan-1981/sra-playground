import { renderProgramLayers } from '../logos-engine/v6-program-geometry.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { OccurrenceRecord } from '../logos-engine/v6-occurrence-scene.ts';
import type { RespondentTerrain } from './respondent-program-planner.ts';

const key = (point: readonly number[]) => point.join(',');
const at = (origin: readonly number[], a: NativePoint, b: NativePoint, u: number, v: number): NativePoint =>
  [origin[0]! + a[0] * u + b[0] * v, origin[1]! + a[1] * u + b[1] * v];

/** Locate a repeated patch inside the measured board. Its effect is still a hypothesis. */
export function measureRespondentTerrain(rows: NativeRows, field: OccurrenceRecord, model: OccurrenceRecord,
  bodies: readonly OccurrenceRecord[]): RespondentTerrain | null {
  const points = new Set<string>(field.points.map(key));
  const [a, b] = model.basis as [NativePoint, NativePoint];
  const origin = field.origin as NativePoint;
  const bounds = field.bounds as [NativePoint, NativePoint];
  const shape = model.layer.shape as NativePoint[];
  const occupied = new Set<string>();
  for (const body of bodies) {
    const [left, top] = body.anchor as NativePoint;
    for (const position of renderProgramLayers(body.word, shape, model.layer.step).keys()) {
      const [x, y] = position.split(',').map(Number);
      occupied.add(key([left + x!, top + y!]));
    }
  }
  const unsupported: NativePoint[] = [];
  const patterns = new Map<string, NativePoint[]>();
  for (let u = bounds[0][0]; u <= bounds[0][1]; u++) {
    for (let v = bounds[1][0]; v <= bounds[1][1]; v++) {
      const position = at(origin, a, b, u, v);
      if (points.has(key(position))) continue;
      unsupported.push(position);
      const neighbors = [at(origin, a, b, u - 1, v), at(origin, a, b, u + 1, v),
        at(origin, a, b, u, v - 1), at(origin, a, b, u, v + 1)];
      if (neighbors.some(point => !points.has(key(point)))) continue;
      const pixels: number[] = [];
      for (const [dx, dy] of shape) {
        const locus = [position[0] + dx, position[1] + dy] as const;
        const ink = rows[locus[1]]?.[locus[0]];
        if (ink === undefined || occupied.has(key(locus))) break;
        pixels.push(ink);
      }
      if (pixels.length !== shape.length) continue;
      const id = key(pixels);
      const group = patterns.get(id) ?? [];
      group.push(position);
      patterns.set(id, group);
    }
  }
  const marked = [...patterns.values()].filter(group => group.length > 1);
  if (marked.length !== 1) return null;
  // Keep unseen positions inside the lattice as unknown. Only exterior positions
  // can still use the outer-boundary hypothesis from the earlier levels.
  const [tiles] = marked;
  const distinctive = new Set(tiles!.map(key));
  return { marked: tiles!, unknown: unsupported.filter(point => !distinctive.has(key(point))) };
}
