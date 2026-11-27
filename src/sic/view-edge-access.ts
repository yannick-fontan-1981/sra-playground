import { compareUnicode } from '../logos-engine/canonical.ts';

export type ViewPoint = readonly [number, number];

export interface ViewShiftHypothesis {
  readonly hypothetical_bulk_offset: ViewPoint;
  readonly unseen_viewport_pixels_if_realized: number;
}

export interface ViewEdgeProjection {
  readonly area: number;
  readonly cost: number;
  readonly alternatives: readonly ViewShiftHypothesis[];
}

/** The footprint belongs to the measured movers. A positive area is conditional on a camera shift. */
export function projectViewEdge(vector: ViewPoint, footprint: Iterable<ViewPoint>, width: number, height: number,
  alternatives: readonly ViewShiftHypothesis[]): ViewEdgeProjection | null {
  const [dx, dy] = vector;
  if ((dx === 0) === (dy === 0)) return null;
  const axis = dx === 0 ? 1 : 0;
  const stride = vector[axis];
  const positions = Array.from(footprint, point => point[axis]);
  if (positions.length === 0 || alternatives.length === 0) return null;
  const area = Math.max(...alternatives.map(shift => shift.unseen_viewport_pixels_if_realized));
  if (area <= 0) return null;
  const extent = axis === 0 ? width : height;
  const gap = stride > 0 ? extent - 1 - Math.max(...positions) : Math.min(...positions);
  return { area, cost: 1 + Math.floor(gap / Math.abs(stride)), alternatives };
}

interface MeasuredAccess {
  readonly projection: ViewEdgeProjection;
  readonly command: { readonly action_ref: string };
  readonly rule: string;
}

/** Compare prepared trajectories. Keep all equal measurements for the plan receipt. */
export function selectViewEdgeAccess<Offer extends MeasuredAccess>(offers: readonly Offer[]) {
  const ordered = [...offers].sort((a, b) => b.projection.area - a.projection.area || a.projection.cost - b.projection.cost
    || compareUnicode(a.command.action_ref, b.command.action_ref) || compareUnicode(a.rule, b.rule));
  const selected = ordered[0];
  if (!selected) return null;
  const tied = ordered.filter(offer => offer.projection.area === selected.projection.area && offer.projection.cost === selected.projection.cost);
  return { selected, ordered, tied };
}
