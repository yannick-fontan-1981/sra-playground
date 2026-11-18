import { chartEdgeKey, chartPointKey, chartRectangles,
  type ChartEdge, type ChartPoint, type ChartRectangle, type MeasuredChart } from '../logos-engine/v6-chart-navigation-geometry.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

const same = (a: ChartPoint, b: ChartPoint) => a[0] === b[0] && a[1] === b[1];
const cardinal = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const deltaKey = (delta: ChartPoint) => delta.join(',');

export interface CompactChart extends MeasuredChart {
  unconfirmed: string[];
}

function visibleBoundaryColors(rows: NativeRows, chart: MeasuredChart, nodes: readonly ChartRectangle[]): Map<string, number> {
  const height = chart.field_bottom, width = rows[0]!.length, size = nodes[0]!.size;
  const pigments = new Set(nodes.flatMap(node => node.inside !== null && node.inside !== chart.goal_annotation_hypothesis
    ? [node.inside] : []));
  const parts = geometricComponents(rows.slice(0, height)).filter(part => pigments.has(part.color));
  const result = new Map<string, number>();
  for (const direction of cardinal) {
    const [dx, dy] = direction, axis = dx ? 0 : 1, cross = 1 - axis;
    const bound = axis === 0 ? width : height, middle = (axis === 0 ? height : width) / 2;
    const groups = new Map<number, { lo: number; hi: number; area: number }>();
    for (const part of parts) {
      const box = part.bbox;
      const low = box[axis]!, high = box[axis + 2]!;
      if (dx + dy > 0 ? high < bound - 2 || low < bound - size * 2 : low > 1 || high >= size * 2) continue;
      const lo = box[cross]!, hi = box[cross + 2]!;
      if (Math.min(Math.abs(lo - middle), Math.abs(hi - middle)) > size * 2) continue;
      const group = groups.get(part.color) ?? { lo, hi, area: 0 };
      group.lo = Math.min(group.lo, lo);
      group.hi = Math.max(group.hi, hi);
      group.area += part.area;
      groups.set(part.color, group);
    }
    const matches = [...groups].filter(([, { lo, hi, area }]) => hi - lo + 1 >= size && hi - lo + 1 <= size * 4
      && Math.abs((lo + hi) / 2 - middle) <= size && area >= size * size);
    if (matches.length === 1) result.set(deltaKey(direction), matches[0]![0]);
  }
  return result;
}

/** A dense rendering can overlay every connecting segment with the node frames.
 * Only the anchored node locations survive. Preserve older links and treat new
 * adjacency as a hypothesis until movement or a matching boundary supports it. */
export function measureCompactChart(rows: NativeRows, observation: NativeObservation, retained: MeasuredChart,
  positions: readonly ChartPoint[]): CompactChart | null {
  const former = retained.nodes.find(node => same(node.center, retained.current));
  if (!former || former.corner === former.edge) return null;
  const { size, edge, corner } = former;
  const rectangles = chartRectangles(rows).filter(node => node.bbox[3] < retained.field_bottom && node.size === size && node.edge === edge);
  const markers = rectangles.filter(node => node.corner === corner && node.inside === retained.goal_annotation_hypothesis);
  const starts = rectangles.filter(node => node.corner === edge && node.center_value === corner
    && node.inside === retained.goal_annotation_hypothesis);
  if (markers.length !== 1 || starts.length !== 1) return null;
  const current = markers[0]!.center, origin = starts[0]!.center;
  const fits: { pitch: number; nodes: ChartRectangle[]; known: ChartEdge[]; unconfirmed: string[] }[] = [];
  for (let pitch = 2; pitch <= size; pitch++) {
    const transform = ([x, y]: ChartPoint): [number, number] => [
      origin[0] + (x - retained.origin[0]) / retained.pitch * pitch,
      origin[1] + (y - retained.origin[1]) / retained.pitch * pitch,
    ];
    if (!positions.some(point => same(transform(point), current))) continue;
    const nodes = rectangles.filter(node => (node.center[0] - origin[0]) % pitch === 0 && (node.center[1] - origin[1]) % pitch === 0
      && (node.corner === edge || node === markers[0]));
    const byPosition = new Map(nodes.map(node => [chartPointKey(node.center), node]));
    const witnesses = retained.nodes.filter(node => {
      const next = byPosition.get(chartPointKey(transform(node.center)));
      return next && (next.inside === node.inside || same(next.center, current));
    });
    if (witnesses.length < 3) continue;
    const matched = new Set(witnesses.map(node => chartPointKey(node.center)));
    const previous = new Set<string>(Array.isArray(retained.unconfirmed) ? retained.unconfirmed : []);
    const known = retained.links.filter(link => matched.has(chartPointKey(link.from)) && matched.has(chartPointKey(link.to)));
    if (!known.length) continue;
    fits.push({ pitch, nodes, known: known.map(link => ({ ...link, from: transform(link.from), to: transform(link.to) })),
      unconfirmed: known.filter(link => previous.has(chartEdgeKey(link)))
        .map(link => chartEdgeKey({ from: transform(link.from), to: transform(link.to) })) });
  }
  if (fits.length !== 1) return null;
  const { nodes, pitch, known, unconfirmed } = fits[0]!;
  const byPosition = new Map(nodes.map(node => [chartPointKey(node.center), node]));
  const links = new Map(known.map(link => [chartEdgeKey(link), link]));
  const boundary = visibleBoundaryColors(rows, retained, nodes);
  for (const { center: from } of nodes) for (const delta of cardinal) {
    const to: [number, number] = [from[0] + delta[0] * pitch, from[1] + delta[1] * pitch];
    if (!byPosition.has(chartPointKey(to))) continue;
    const link = { from, to, delta: [...delta] as [number, number], annotation: -1 };
    const key = chartEdgeKey(link), prior = links.get(key);
    const color = same(from, current) ? boundary.get(deltaKey(delta))
      : same(to, current) ? boundary.get(deltaKey([-delta[0], -delta[1]])) : undefined;
    if (!prior && color === undefined) unconfirmed.push(key);
    if (color !== undefined) {
      links.set(key, { ...link, annotation: color });
      const index = unconfirmed.indexOf(key);
      if (index >= 0) unconfirmed.splice(index, 1);
    } else if (!prior) links.set(key, link);
  }
  return { ...retained, nodes, current, origin, pitch, links: [...links.values()], unconfirmed, epoch: observation.level_epoch,
    evidence: [...new Set([...retained.evidence, observation.observation_ref])] };
}
