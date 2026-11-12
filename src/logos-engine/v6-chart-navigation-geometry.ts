/** Pinned V6 chart_navigation/geometry.py and its consumed V5 chart decoder.
 * Coordinates, explicit links and location alternatives remain descriptive.
 * The decoder does not infer inventory, registrations or blocked terrain.
 */
import { symbolicDigest } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

export type ChartRecord = Record<string, any>;
export type ChartPoint = readonly [number, number];
export interface ChartRectangle {
  center: [number, number];
  bbox: [number, number, number, number];
  size: number;
  edge: number;
  corner: number;
  inside: number | null;
  center_value: number;
}
export interface ChartEdge {
  from: [number, number];
  to: [number, number];
  delta: [number, number];
  annotation: number;
}
export interface MeasuredChart extends ChartRecord {
  nodes: ChartRectangle[];
  links: ChartEdge[];
  current: [number, number];
  origin: [number, number];
  pitch: number;
  goal_annotation_hypothesis: number;
  slots: ChartRectangle[];
  slot_background: number;
  field_bottom: number;
  evidence: string[];
  epoch: number;
}

/** Python json.dumps(sort_keys=True, separators=(',', ':')), full SHA-256. */
export const chartDigest = symbolicDigest;
export const chartPointKey = (point: readonly number[]): string => `[${point[0]}, ${point[1]}]`;
export const chartEdgeKey = (edge: { from: readonly number[]; to: readonly number[] } | ChartRecord): string =>
  `${chartPointKey(edge.from)}>${chartPointKey(edge.to)}`;
const samePoint = (left: readonly number[], right: readonly number[]): boolean =>
  left[0] === right[0] && left[1] === right[1];

/** Rows have already crossed the common public-observation boundary. */
export function chartRectangles(rows: NativeRows): ChartRectangle[] {
  const height = rows.length, width = rows[0]!.length, out: ChartRectangle[] = [];
  // The source range stops strictly below min(12, height, width).
  for (let size = 5; size < Math.min(12, height, width); size += 2) {
    for (let y = 0; y <= height - size; y++) for (let x = 0; x <= width - size; x++) {
      const edge = rows[y]![x + 1]!;
      let uniformEdge = true;
      for (let i = 1; i < size - 1; i++) {
        if (rows[y]![x + i] !== edge || rows[y + size - 1]![x + i] !== edge
          || rows[y + i]![x] !== edge || rows[y + i]![x + size - 1] !== edge) {
          uniformEdge = false; break;
        }
      }
      if (!uniformEdge) continue;
      const corners = [rows[y]![x]!, rows[y]![x + size - 1]!,
        rows[y + size - 1]![x]!, rows[y + size - 1]![x + size - 1]!];
      if (!corners.every(value => value === corners[0])) continue;
      const cx = x + Math.floor(size / 2), cy = y + Math.floor(size / 2), inside: number[] = [];
      for (let yy = y + 1; yy < y + size - 1; yy++) for (let xx = x + 1; xx < x + size - 1; xx++) {
        if (xx !== cx || yy !== cy) inside.push(rows[yy]![xx]!);
      }
      if (inside.every(value => value === edge)) continue;
      out.push({ center: [cx, cy], bbox: [x, y, x + size - 1, y + size - 1], size, edge,
        corner: corners[0]!, inside: inside.every(value => value === inside[0]) ? inside[0]! : null,
        center_value: rows[cy]![cx]! });
    }
  }
  return out;
}

export function measureChart(rows: NativeRows, obs: ChartRecord): MeasuredChart | null {
  const rectangles = chartRectangles(rows), markers = rectangles.filter(rectangle =>
    rectangle.corner !== rectangle.edge && rectangle.center_value === rectangle.corner && rectangle.inside !== null);
  const charts: MeasuredChart[] = [];
  for (const marker of markers) {
    const candidates = rectangles.filter(rectangle => rectangle.size === marker.size && rectangle.edge === marker.edge);
    let pitch = Infinity;
    for (const first of candidates) for (const second of candidates) for (const axis of [0, 1] as const) {
      const delta = Math.abs(first.center[axis] - second.center[axis]);
      if (first.center[1 - axis] === second.center[1 - axis] && delta > marker.size) pitch = Math.min(pitch, delta);
    }
    if (pitch === Infinity) continue;
    const links: ChartEdge[] = [];
    for (const first of candidates) for (const second of candidates) {
      const dx = second.center[0] - first.center[0], dy = second.center[1] - first.center[1];
      if (Math.abs(dx) + Math.abs(dy) !== pitch || dx !== 0 && dy !== 0) continue;
      const sx = Math.sign(dx), sy = Math.sign(dy), half = Math.floor(first.size / 2), gap: number[] = [];
      for (let i = half + 1; i < pitch - half; i++) gap.push(rows[first.center[1] + sy * i]![first.center[0] + sx * i]!);
      if (!gap.length || !gap.every(value => value === gap[0]) || gap[0] === first.edge) continue;
      links.push({ from: first.center, to: second.center, delta: [sx, sy], annotation: gap[0]! });
    }
    const reached = new Set([chartPointKey(marker.center)]);
    for (let i = 0; i < candidates.length; i++) {
      const next = links.filter(link => reached.has(chartPointKey(link.from))).map(link => chartPointKey(link.to));
      for (const point of next) reached.add(point);
    }
    const nodes = candidates.filter(node => reached.has(chartPointKey(node.center))),
      edges = links.filter(link => reached.has(chartPointKey(link.from)) && reached.has(chartPointKey(link.to)));
    if (nodes.length < 3 || nodes.filter(node => node.corner !== node.edge).length !== 1) continue;
    const nodeBottom = Math.max(...nodes.map(node => node.bbox[3])),
      slots = rectangles.filter(rectangle => rectangle.size !== marker.size && rectangle.edge === marker.edge
        && rectangle.corner === rectangle.edge && rectangle.bbox[1] > nodeBottom),
      groups = new Map<string, ChartRectangle[]>();
    for (const slot of slots) {
      const key = `${slot.size},${slot.edge},${slot.bbox[1]}`, group = groups.get(key) ?? [];
      group.push(slot); groups.set(key, group);
    }
    const slotCandidates = [...groups.values()].filter(group => group.length >= 2);
    if (slotCandidates.length !== 1) continue;
    const selectedSlots = slotCandidates[0]!, bottom = Math.min(...selectedSlots.map(slot => slot.bbox[1])),
      counts = new Map<number, number>();
    for (const slot of selectedSlots) for (let y = slot.bbox[1] + 1; y < slot.bbox[3]; y++) {
      for (let x = slot.bbox[0] + 1; x < slot.bbox[2]; x++) {
        const value = rows[y]![x]!; counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    // Counter.most_common(1) retains the first observed value on equal counts.
    let background = 0, most = -1;
    for (const [value, count] of counts) if (count > most) { background = value; most = count; }
    charts.push({ nodes, links: edges, current: marker.center, origin: marker.center, pitch,
      goal_annotation_hypothesis: marker.inside!, slots: selectedSlots, slot_background: background,
      field_bottom: bottom, evidence: [obs.observation_ref], epoch: obs.level_epoch });
  }
  return charts.length === 1 ? charts[0]! : null;
}

export function chartInventory(rows: NativeRows, supplied: MeasuredChart | ChartRecord): number[] {
  const chart = supplied as MeasuredChart, held = new Set<number>();
  for (const slot of chart.slots) for (let y = slot.bbox[1] + 1; y < slot.bbox[3]; y++) {
    for (let x = slot.bbox[0] + 1; x < slot.bbox[2]; x++) {
      const value = rows[y]![x]!;
      if (value !== chart.slot_background && value !== slot.edge) held.add(value);
    }
  }
  return [...held].sort((left, right) => left - right);
}

export function chartScene(rows: NativeRows, chart: MeasuredChart | ChartRecord): string {
  return chartDigest(rows.slice(0, chart.field_bottom));
}

export interface ChartNode {
  readonly chart_node_ref: string;
  readonly point: ChartPoint;
  readonly signature_refs: readonly string[];
  readonly static_key_type_refs: readonly string[];
  readonly static_door_refs: readonly string[];
  readonly disclosed: boolean;
}
export interface ChartLink {
  readonly from_ref: string;
  readonly to_ref: string;
  readonly direction_ref: string;
  readonly supported_evidence_ref: string;
}
export interface ChartFragment {
  readonly chart_ref: string;
  readonly lattice_ref: string;
  readonly measured_origin: ChartPoint;
  readonly measured_pitch: ChartPoint;
  readonly nodes: readonly ChartNode[];
  readonly links: readonly ChartLink[];
  readonly current_marker_alternatives: readonly string[];
  readonly corner_anchor_refs: readonly string[];
}
export interface ChartMechanicalScope {
  readonly request_ref: string;
  readonly caller_ref: string;
  readonly parent_goal_ref: string;
  readonly parent_contribution_ref: string;
  readonly epoch: number;
  readonly evidence_revision_ref: string;
  readonly model_revision_ref: string;
  readonly model_status_ref: string;
  readonly event_owner_ref: string;
  readonly input_domain_complete: boolean;
  readonly assumption_refs?: readonly string[];
  readonly retained_alternative_refs?: readonly string[];
  readonly eligible_sibling_refs?: readonly string[];
  readonly consumed_request_refs?: readonly string[];
}
export interface ChartDecodeRequest {
  readonly charts: readonly ChartFragment[];
  readonly maximum_evaluations: number;
  readonly scope: ChartMechanicalScope;
  readonly operation_ref: string;
  readonly mode: string | null;
}
export interface ChartMechanicalResult extends ChartRecord {
  readonly schema_version: 'yf_arc3_v5.mechanical_family_result.v1';
  readonly scope: ChartMechanicalScope;
  readonly operation_ref: string;
  readonly mode: string | null;
  readonly signature_supported: true;
  readonly prerequisite_refs: readonly string[];
  readonly implementation_debt_refs: readonly string[];
  readonly values: ChartRecord;
  readonly examined_count: number;
  readonly domain_complete: boolean;
  readonly computation_bound_reached: boolean;
  readonly frontier: ChartRecord;
  readonly descriptive_facts: ChartRecord;
}

function ref(value: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('A chart reference must be a nonempty string');
  return value.trim();
}
function refs(values: readonly string[], maximum: number): string[] {
  if (!Array.isArray(values) || values.length > maximum) throw new TypeError('Chart reference tuple exceeds its source bound');
  return values.map(ref);
}
function point(value: ChartPoint): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isSafeInteger)) {
    throw new TypeError('A chart coordinate requires two exact integers');
  }
  return [value[0], value[1]];
}

/** Only the consumed ChartNode/ChartLink/ChartFragment model constraints. */
function fragment(supplied: ChartFragment): ChartFragment {
  const origin = point(supplied.measured_origin), pitch = point(supplied.measured_pitch);
  if (pitch.some(value => value <= 0)) throw new TypeError('Chart scale is measured separately for each fragment');
  if (!Array.isArray(supplied.nodes) || supplied.nodes.length > 1024
    || !Array.isArray(supplied.links) || supplied.links.length > 4096) {
    throw new TypeError('Chart node/link tuple exceeds its source bound');
  }
  const nodes: ChartNode[] = supplied.nodes.map(node => {
    if (typeof node.disclosed !== 'boolean') throw new TypeError('Chart disclosure must be explicit');
    return { chart_node_ref: ref(node.chart_node_ref), point: point(node.point),
      signature_refs: refs(node.signature_refs, 32), static_key_type_refs: refs(node.static_key_type_refs, 64),
      static_door_refs: refs(node.static_door_refs, 64), disclosed: node.disclosed };
  });
  const links: ChartLink[] = supplied.links.map(link => ({ from_ref: ref(link.from_ref), to_ref: ref(link.to_ref),
    direction_ref: ref(link.direction_ref), supported_evidence_ref: ref(link.supported_evidence_ref) }));
  const nodeRefs = new Set(nodes.map(node => node.chart_node_ref));
  if (nodeRefs.size !== nodes.length || links.some(link => !nodeRefs.has(link.from_ref) || !nodeRefs.has(link.to_ref))) {
    throw new TypeError('Chart node/link lattice and partial disclosure');
  }
  return { chart_ref: ref(supplied.chart_ref), lattice_ref: ref(supplied.lattice_ref), measured_origin: origin,
    measured_pitch: pitch, nodes, links, current_marker_alternatives: refs(supplied.current_marker_alternatives, 128),
    corner_anchor_refs: refs(supplied.corner_anchor_refs, 128) };
}

function scope(supplied: ChartMechanicalScope): ChartMechanicalScope {
  if (!Number.isSafeInteger(supplied.epoch) || supplied.epoch < 0 || typeof supplied.input_domain_complete !== 'boolean') {
    throw new TypeError('A chart mechanical scope requires its epoch and input-domain status');
  }
  return { request_ref: ref(supplied.request_ref), caller_ref: ref(supplied.caller_ref),
    parent_goal_ref: ref(supplied.parent_goal_ref), parent_contribution_ref: ref(supplied.parent_contribution_ref),
    epoch: supplied.epoch, evidence_revision_ref: ref(supplied.evidence_revision_ref),
    model_revision_ref: ref(supplied.model_revision_ref), model_status_ref: ref(supplied.model_status_ref),
    event_owner_ref: ref(supplied.event_owner_ref), input_domain_complete: supplied.input_domain_complete,
    assumption_refs: refs(supplied.assumption_refs ?? [], 64),
    retained_alternative_refs: refs(supplied.retained_alternative_refs ?? [], 128),
    eligible_sibling_refs: refs(supplied.eligible_sibling_refs ?? [], 128),
    consumed_request_refs: refs(supplied.consumed_request_refs ?? [], 256) };
}

/** Python str(Fraction(p - origin, positive pitch)), without floating rounding. */
function normalizedCoordinate(value: number, origin: number, pitch: number): string {
  let numerator = BigInt(value) - BigInt(origin), denominator = BigInt(pitch),
    first = numerator < 0n ? -numerator : numerator, second = denominator;
  while (second) [first, second] = [second, first % second];
  numerator /= first; denominator /= first;
  return denominator === 1n ? String(numerator) : `${numerator}/${denominator}`;
}

function result(request: ChartDecodeRequest, callerScope: ChartMechanicalScope, values: ChartRecord,
  examined: number, bound: boolean, frontier: ChartRecord): ChartMechanicalResult {
  const complete = !bound && callerScope.input_domain_complete;
  return { schema_version: 'yf_arc3_v5.mechanical_family_result.v1', scope: callerScope,
    operation_ref: ref(request.operation_ref), mode: request.mode === null ? null : ref(request.mode),
    signature_supported: true, prerequisite_refs: [], implementation_debt_refs: [], values,
    examined_count: examined, domain_complete: complete, computation_bound_reached: bound, frontier,
    descriptive_facts: { signature_supported: true, implementation_complete: true, prerequisites_empty: true,
      domain_complete: complete, computation_bound_reached: bound } };
}

/** Direct _chart_decode path; no NavigationRequestBase or other V5 operation. */
export function decodeChartFragments(request: ChartDecodeRequest): ChartMechanicalResult {
  const charts = request.charts.map(fragment), callerScope = scope(request.scope),
    count = charts.reduce((total, chart) => total + chart.nodes.length + chart.links.length, 0);
  if (count > request.maximum_evaluations) {
    return result(request, callerScope, {}, 0, true, { phase: 'chart_lattice_decode', next_chart_index: 0 });
  }
  const decoded: ChartRecord[] = [];
  for (const chart of charts) {
    const points = new Map<string, { point: ChartPoint; refs: string[] }>(), adjacency = new Map<string, ChartLink[]>();
    for (const node of chart.nodes) {
      const key = chartPointKey(node.point), item = points.get(key) ?? { point: node.point, refs: [] };
      item.refs.push(node.chart_node_ref); points.set(key, item);
    }
    for (const link of chart.links) {
      const links = adjacency.get(link.from_ref) ?? []; links.push(link); adjacency.set(link.from_ref, links);
    }
    const coordinates = chart.nodes.map(node => ({ node_ref: node.chart_node_ref,
      normalized_chart_address: node.point.map((value, axis) => normalizedCoordinate(value, chart.measured_origin[axis]!, chart.measured_pitch[axis]!)),
      chart_pitch: [...chart.measured_pitch], disclosed: node.disclosed, signature_alternatives: [...node.signature_refs] }));
    const links = chart.nodes.map(node => ({ from_ref: node.chart_node_ref,
      supported_links: (adjacency.get(node.chart_node_ref) ?? []).map(link => ({ ...link })) }));
    decoded.push({ chart_ref: chart.chart_ref, lattice_ref: chart.lattice_ref,
      coordinate_index: [...points.values()].sort((left, right) => left.point[0] - right.point[0] || left.point[1] - right.point[1])
        .map(item => [[...item.point], [...item.refs]]),
      normalized_node_coordinates: coordinates, directional_link_index: links,
      marker_alternatives: [...chart.current_marker_alternatives], corner_anchors: [...chart.corner_anchor_refs] });
  }
  return result(request, callerScope, { partial_chart_graphs: decoded, node_interiors_and_corner_anchors_separate: true,
    missing_disclosure_is_blocked_terrain: false, visually_identical_markers_retained: true }, count, false, {});
}

export function decodeChart(supplied: MeasuredChart | ChartRecord, obs: ChartRecord): ChartMechanicalResult {
  const chart = supplied as MeasuredChart, nodeRef = (value: readonly number[]): string => 'chart-node:' + chartDigest(value);
  const current: ChartFragment = { chart_ref: 'chart:' + chartDigest(chart.evidence), lattice_ref: 'current-measured-pitch',
    measured_origin: chart.origin, measured_pitch: [chart.pitch, chart.pitch],
    nodes: chart.nodes.map(node => ({ chart_node_ref: nodeRef(node.center), point: node.center,
      signature_refs: ['appearance:' + chartDigest(node)], static_key_type_refs: [], static_door_refs: [], disclosed: true })),
    links: chart.links.map(link => ({ from_ref: nodeRef(link.from), to_ref: nodeRef(link.to),
      direction_ref: 'delta:' + chartPointKey(link.delta), supported_evidence_ref: obs.observation_ref })),
    current_marker_alternatives: [nodeRef(chart.current)], corner_anchor_refs: [obs.observation_ref] };
  return decodeChartFragments({ charts: [current], maximum_evaluations: 4096,
    scope: { request_ref: 'decode-current-chart', caller_ref: 'chart-navigation', parent_goal_ref: 'level-composition',
      parent_contribution_ref: 'measured-chart', epoch: obs.level_epoch, evidence_revision_ref: obs.observation_ref,
      model_revision_ref: obs.frame_hash, model_status_ref: 'geometry_only', event_owner_ref: obs.observation_ref,
      input_domain_complete: false, assumption_refs: ['chart-is-navigation-hypothesis'] },
    operation_ref: 'mechanics.charted_room_navigation.decode_chart', mode: 'MEASURE' });
}

export function routeChart(supplied: MeasuredChart | ChartRecord, start: readonly number[], target: readonly number[],
  excluded: ReadonlySet<string>, blocked: readonly string[] | ReadonlySet<string>): ChartEdge[] | null {
  const chart = supplied as MeasuredChart, queue: { node: readonly number[]; path: ChartEdge[] }[] = [{ node: start, path: [] }],
    seen = new Set([chartPointKey(start)]), blockedEdges = new Set(blocked);
  for (let index = 0; index < queue.length; index++) {
    const { node, path } = queue[index]!;
    if (samePoint(node, target)) return path;
    for (const edge of chart.links) {
      const next = chartPointKey(edge.to);
      if (!samePoint(edge.from, node) || seen.has(next) || blockedEdges.has(chartEdgeKey(edge))
        || excluded.has(next) && !samePoint(edge.to, target)) continue;
      seen.add(next); queue.push({ node: edge.to, path: [...path, edge] });
    }
  }
  return null;
}
