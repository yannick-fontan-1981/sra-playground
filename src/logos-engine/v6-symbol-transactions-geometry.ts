/** Pinned SymbolTransactions raster-to-public-entity projection.
 * Geometry remains distinct from DRM eligibility and current action guards. */
import { FrameGrid, measureConcentricFrames, measureConcentricContext, measureConcentricCandidate,
  sameRC, type RC, type Measurement } from './v5-concentric-frames.ts';
import { measureDiagramContext, measureDiagramCandidate } from './v5-symbolic-diagrams.ts';
import type { NativeRows } from './v6-native-types.ts';
export { FrameGrid } from './v5-concentric-frames.ts';
export { measureDiagramTransition, measure_diagram_transition } from './v5-symbolic-diagrams.ts';
type R = Record<string, any>;
export type GeometryProjection = { context: Measurement; options: R[] };

export function frame(rows: NativeRows): FrameGrid { return new FrameGrid(rows); }
export function perimeterEntities(obs: R, value: number): R[] {
  const result: R[] = [];
  for (const entity of obs.entities ?? []) {
    if (entity.palette_value !== value) continue;
    const [left, top, right, bottom] = entity.bbox, w = right - left + 1, h = bottom - top + 1;
    if (Math.min(w, h) >= 3 && entity.area === 2 * (w + h) - 4
      && entity.mask.every(([x, y]: readonly number[]) => x === 0 || x === w - 1 || y === 0 || y === h - 1)) result.push(entity);
  }
  return result;
}
export const perimeter_entities = perimeterEntities;
export function project(obs: R, rows: NativeRows, inputs: readonly R[], config: R, transition_count = 0): GeometryProjection | null {
  const value = config.palette_white_value, entities = perimeterEntities(obs, value);
  if (!entities.length) return null;
  const f = frame(rows), rects = measureConcentricFrames(f);
  const context = { ...measureDiagramContext(f, transition_count), ...measureConcentricContext(rects, [], value, f) };
  const options: R[] = [];
  for (const action of inputs) {
    // The common native domain supplies integer-valued JSON point maps. An
    // invalid non-map is declined here; Python set(data) can instead raise.
    // Python's nominal 44.0-versus-44 distinction has no JSON-number analogue.
    // The source oracle records these excluded boundaries separately.
    const data = action.data ?? {};
    if (data === null || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 2
      || !Object.hasOwn(data, 'x') || !Object.hasOwn(data, 'y') || !Number.isSafeInteger(data.x) || !Number.isSafeInteger(data.y)) continue;
    const point: RC = [data.y, data.x], candidate = { point };
    const matching = entities.filter(e => rects.some(r => sameRC(r.center, point) && r.maximum_equal_padding > 1 && r.outer_value === value
      && e.bbox.length === 4 && e.bbox.every((v: number, i: number) => v === [r.left, r.top, r.right, r.bottom][i])));
    if (!matching.length) continue;
    const facts = { ...context, ...measureDiagramCandidate(f, candidate, value), ...measureConcentricCandidate(rects, candidate, [], value, f),
      current_spaced_frame_entity_count: matching.length };
    const at_point = obs.entities.filter((e: R) => e.mask.some(([x, y]: readonly number[]) =>
      x === point[1] - e.position[0] && y === point[0] - e.position[1]));
    if (at_point.length === 1) options.push({ action, facts, entities: matching, point_entity: at_point[0] });
  }
  return { context, options };
}
