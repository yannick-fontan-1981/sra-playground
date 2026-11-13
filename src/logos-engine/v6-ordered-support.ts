/**
 * Native transfer of V6 common_ordered_support.py and its V5 ordered_supports
 * measurements/search. Reference: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * A repeated support is measured from public pixels. The ordering law and the
 * hollow reference's role remain hypotheses until actual responses are acquired.
 * No game name, engine object, level definition or solution enters this module.
 */
import { detectV5Components, rowsDigest, v6Canonical, v6Digest } from './v6-native-observer.ts';
import type { V5Component, V5ComponentExtraction } from './v6-native-observer.ts';
import type {
  NativeAfterResult, NativeBeforeResult, NativeBox, NativeCommand, NativeFamily,
  NativeObservation, NativeProposal, NativePublicObservation, NativeRecord,
  NativeRecordResult, NativeRows,
} from './v6-native-types.ts';

type RowColumn = readonly [row: number, column: number];
type MutableBox = [left: number, top: number, right: number, bottom: number];

export interface OrderedSupportDescription {
  support_ref: string;
  center_column: number;
  point: RowColumn;
  structural_extent: number;
  layer_extents: number[];
  schema_version: 'yf_arc3_v5.ordered_support_description.v1';
}
export interface OrderedSupportGeometry {
  supports: OrderedSupportDescription[];
  repeated_support_count: number;
  strict_layer_order_observed: boolean;
  globally_unique_layer_extents_observed: boolean;
  unique_widest_support_index: number | null;
  schema_version: 'yf_arc3_v5.ordered_support_geometry_measurements.v1';
}
export interface OrderedSupportRequest {
  configuration: { support_extents: readonly (readonly number[])[] };
  endpoint_support_index: number;
  traversal_orders: readonly (readonly number[])[];
  maximum_state_expansions: number;
  maximum_transfer_depth: number;
}
export interface OrderedSupportStep {
  extent: number;
  source_support_index: number;
  destination_support_index: number;
  schema_version: 'yf_arc3_v5.ordered_support_transfer_step.v1';
}
export interface OrderedSupportWitness {
  traversal_order_ordinal: number;
  steps: OrderedSupportStep[];
  expanded_state_count: number;
  schema_version: 'yf_arc3_v5.ordered_support_transfer_witness.v1';
}
export interface OrderedSupportResult {
  witnesses: OrderedSupportWitness[];
  total_expanded_state_count: number;
  state_expansion_bound_reached: boolean;
  transfer_depth_bound_reached: boolean;
  failure_kinds: string[];
  schema_version: 'yf_arc3_v5.ordered_support_transfer_result.v1';
}
export interface MaterialBand { bbox: MutableBox; value: number }
export interface OrderedSupportScene {
  geometry: OrderedSupportGeometry;
  configuration: number[][];
  target: number;
  spans: number[];
  reference_pairs: [string, string][];
  structural_supports: MaterialBand[];
}
interface OrderedSupportBinding extends NativeRecord {
  observation_ref: string; level_epoch: number; levels_completed: number; frame_hash: string;
}
export interface OrderedSupportPlan extends NativeRecord {
  ordered_support_transfer: true;
  scene: OrderedSupportScene;
  member: MaterialBand;
  source: number;
  destination: number;
  expected_configuration: number[][];
  before_rows: NativeRows;
  commands: NativeCommand[];
  context_key: string;
  binding: OrderedSupportBinding;
  model_status: 'conditional_top_only_smaller_on_larger_not_exclusive';
  alternatives: readonly string[];
}
export interface OrderedSupportProposal extends NativeProposal {
  status: 'proposed';
  kind: 'conditional_ordered_support_transfer';
  support_plan: OrderedSupportPlan;
  actions: NativeCommand[];
  steps: NativeRecord[];
  facts: Record<string, boolean>;
  compositions: NativeRecord[];
  binding: OrderedSupportBinding;
  question: { reason: string; hypothesis_refs: string[] };
  route_refs: string[];
  bundle_template: NativeRecord;
}
interface OrderedSupportEvent extends NativeRecord {
  kind: 'ordered_support_response'; before: string; after: string; origin_epoch: number;
  command: NativeCommand; parent: 'G_official_completion'; selection_observed: boolean;
  transfer_observed: boolean; official_progress: boolean; model_scope: string;
  matched: boolean | null;
}
export interface OrderedSupportPolicy {
  enabled: boolean;
  point_action: string;
  traversal_orders: readonly string[];
  maximum_state_expansions: number;
  maximum_transfer_depth: number;
  measurement_scope: string;
  why: string;
  alternatives: readonly string[];
}

/** Exact ordered_support_transfer subsection of common_frontier_policy.drm.json. */
export const ORDERED_SUPPORT_POLICY: Readonly<OrderedSupportPolicy> = Object.freeze({
  enabled: true,
  point_action: 'ACTION6',
  traversal_orders: Object.freeze(['canonical']),
  maximum_state_expansions: 65536,
  maximum_transfer_depth: 128,
  measurement_scope: 'Reuse conservative V5 repeated-support and non-layer-span detector; nonrecognition means unknown, not no ordered mechanism. No dimensions, palette or member count supplied by the game.',
  why: 'The current repeated supports, strictly nested unique extents and hollow reference permit testing an ordered transfer model toward a revisable reference objective. Bind the measured source point, observe selection, then conditionally deposit only under the intermediate selection guard. Preserve every other member and reference; an unexpected response closes this local experiment, not the universal mechanism. Official completion alone closes the parent.',
  alternatives: Object.freeze([
    'point toggles a visual marker without taking a member',
    'selection chooses another occurrence or none',
    'deposit may exchange, refuse, or change ordering',
    'hollow reference may not be the terminal goal',
  ]),
});

const same = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
const pixelKey = (x: number, y: number): string => `${x},${y}`;
const componentBox = (component: V5Component): MutableBox => [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom];

/** Counter.most_common(1), including Python's first-seen tie break. */
function backgroundValue(rows: NativeRows): number {
  const counts = new Map<number, number>();
  for (const row of rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  let result: number | undefined, maximum = -1;
  for (const [value, count] of counts) if (count > maximum) { result = value; maximum = count; }
  if (result === undefined) throw new TypeError('Ordered-support measurement needs public pixels');
  return result;
}

function emptyGeometry(count = 0): OrderedSupportGeometry {
  return { supports: [], repeated_support_count: count, strict_layer_order_observed: false,
    globally_unique_layer_extents_observed: false, unique_widest_support_index: null,
    schema_version: 'yf_arc3_v5.ordered_support_geometry_measurements.v1' };
}

/** Conservative V5 repeated-support geometry, without assigning a support role. */
export function measureOrderedSupportGeometry(rows: NativeRows, extraction: V5ComponentExtraction): OrderedSupportGeometry {
  const background = backgroundValue(rows), lowerHalf = Math.floor(rows.length / 2);
  const vertical = extraction.components.filter(component => !component.touches_frame_boundary &&
    component.bbox.top >= lowerHalf && component.bbox.height >= 6 && component.bbox.width <= 3 &&
    component.bbox.height >= 3 * component.bbox.width);
  if (!vertical.length) return emptyGeometry();
  const greatestBottom = Math.max(...vertical.map(component => component.bbox.bottom));
  const floorAligned = vertical.filter(component => component.bbox.bottom === greatestBottom);
  const greatestWidth = Math.max(...floorAligned.map(component => component.bbox.width));
  const supportComponents = floorAligned.filter(component => component.bbox.width === greatestWidth)
    .sort((a, b) => a.bbox.left + a.bbox.right - b.bbox.left - b.bbox.right ||
      (a.component_id < b.component_id ? -1 : a.component_id > b.component_id ? 1 : 0));
  if (supportComponents.length < 3 || supportComponents.length > 8) return emptyGeometry(supportComponents.length);
  const shapes = new Set(supportComponents.map(component => v6Canonical([component.bbox.height, component.bbox.width, component.relative_pixels])));
  if (shapes.size !== 1) return emptyGeometry(supportComponents.length);
  const centers = supportComponents.map(component => Math.floor((component.bbox.left + component.bbox.right) / 2));
  const descriptions: OrderedSupportDescription[] = [];
  for (const [index, component] of supportComponents.entries()) {
    const center = centers[index]!;
    const leftBoundary = index === 0 ? 0 : Math.floor((centers[index - 1]! + center) / 2) + 1;
    const rightBoundary = index === centers.length - 1 ? rows[0]!.length - 1 : Math.floor((center + centers[index + 1]!) / 2);
    const rowRuns: { row: number; width: number; values: readonly number[] }[] = [];
    let structuralExtent = component.bbox.width;
    for (let y = component.bbox.top; y <= component.bbox.bottom; y++) {
      const row = rows[y]!, occupied: number[] = [];
      for (let x = leftBoundary; x <= rightBoundary; x++) if (row[x] !== background) occupied.push(x);
      if (occupied.length) structuralExtent = Math.max(structuralExtent, occupied.at(-1)! - occupied[0]! + 1);
      let left = center, right = center;
      while (left > leftBoundary && row[left - 1] !== background) left--;
      while (right < rightBoundary && row[right + 1] !== background) right++;
      rowRuns.push({ row: y, width: right - left + 1, values: row.slice(left, right + 1) });
    }
    const uniqueBands = new Map<number, number>();
    for (let i = 0; i + 1 < rowRuns.length; i++) {
      const current = rowRuns[i]!, following = rowRuns[i + 1]!;
      if (current.width > component.bbox.width && current.width === following.width &&
          same(current.values, following.values) && following.row === current.row + 1 && !uniqueBands.has(current.width)) {
        uniqueBands.set(current.width, current.row);
      }
    }
    const layerExtents = [...uniqueBands].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([extent]) => extent);
    const distance = ([y, x]: RowColumn): number => Math.abs(2 * y - component.bbox.top - component.bbox.bottom) +
      Math.abs(2 * x - component.bbox.left - component.bbox.right);
    const point = [...component.pixels].sort((a, b) => distance(a) - distance(b) || a[0] - b[0] || a[1] - b[1])[0]!;
    descriptions.push({ support_ref: component.component_id, center_column: center, point,
      structural_extent: structuralExtent, layer_extents: layerExtents, schema_version: 'yf_arc3_v5.ordered_support_description.v1' });
  }
  const flattened = descriptions.flatMap(support => support.layer_extents);
  const widestExtent = Math.max(...descriptions.map(support => support.structural_extent));
  const widestIndices = descriptions.flatMap((support, index) => support.structural_extent === widestExtent ? [index] : []);
  return { supports: descriptions, repeated_support_count: descriptions.length,
    strict_layer_order_observed: flattened.length > 0 && descriptions.every(support =>
      support.layer_extents.slice(1).every((upper, index) => support.layer_extents[index]! > upper)),
    globally_unique_layer_extents_observed: flattened.length > 0 && new Set(flattened).size === flattened.length,
    unique_widest_support_index: widestIndices.length === 1 ? widestIndices[0]! : null,
    schema_version: 'yf_arc3_v5.ordered_support_geometry_measurements.v1' };
}

/** Separate repeated solid bands from raw spans; the result still assigns no role. */
export function measureOrderedSupportNonLayerSpans(rows: NativeRows, extraction: V5ComponentExtraction,
  geometry: OrderedSupportGeometry): [spans: number[], unique: number | null, explainedTie: boolean] {
  const background = backgroundValue(rows), byRef = new Map(extraction.components.map(component => [component.component_id, component]));
  const centers = geometry.supports.map(support => support.center_column), spans: number[] = [], occupiedMaxima: boolean[] = [];
  for (const [index, support] of geometry.supports.entries()) {
    const component = byRef.get(support.support_ref)!;
    const low = index === 0 ? 0 : Math.floor((centers[index - 1]! + centers[index]!) / 2) + 1;
    const high = index + 1 === centers.length ? rows[0]!.length - 1 : Math.floor((centers[index]! + centers[index + 1]!) / 2);
    const measuredRows: { row: number; span: number; values: readonly number[] }[] = [];
    for (let y = component.bbox.top; y <= component.bbox.bottom; y++) {
      const row = rows[y]!, occupied: number[] = [];
      for (let x = low; x <= high; x++) if (row[x] !== background) occupied.push(x);
      let left = centers[index]!, right = centers[index]!;
      while (left > low && row[left - 1] !== background) left--;
      while (right < high && row[right + 1] !== background) right++;
      measuredRows.push({ row: y, span: occupied.length ? occupied.at(-1)! - occupied[0]! + 1 : 0, values: row.slice(left, right + 1) });
    }
    const bandRows = new Set<number>();
    for (let i = 0; i + 1 < measuredRows.length; i++) {
      const first = measuredRows[i]!, second = measuredRows[i + 1]!;
      if (first.values.length > component.bbox.width && same(first.values, second.values)) {
        bandRows.add(first.row); bandRows.add(second.row);
      }
    }
    const residual = measuredRows.filter(row => !bandRows.has(row.row)).map(row => row.span);
    spans.push(residual.length ? Math.max(...residual) : component.bbox.width);
    occupiedMaxima.push(support.layer_extents.length > 0 && measuredRows.filter(row => row.span === support.structural_extent)
      .every(row => bandRows.has(row.row)));
  }
  const rawMaximum = Math.max(...geometry.supports.map(support => support.structural_extent));
  const rawIndices = geometry.supports.flatMap((support, index) => support.structural_extent === rawMaximum ? [index] : []);
  const residualIndices = spans.flatMap((span, index) => span === Math.max(...spans) ? [index] : []);
  const unique = residualIndices.length === 1 ? residualIndices[0]! : null;
  const explainedTie = rawIndices.length > 1 && unique !== null && rawIndices.includes(unique) &&
    geometry.supports[unique]!.layer_extents.length === 0 && rawIndices.filter(index => index !== unique).every(index => occupiedMaxima[index]);
  return [spans, unique, explainedTie];
}

/** Mechanically instantiate at most three orders explicitly declared by DRM. */
export function declaredSupportOrders(count: number, endpoint: number, variantRefs: readonly string[]): number[][] {
  const canonical = Array.from({ length: count }, (_, index) => index), variants: number[][] = [];
  for (const ref of variantRefs.slice(0, 3)) {
    let order: number[];
    if (ref === 'canonical') order = [...canonical];
    else if (ref === 'reverse_canonical') order = [...canonical].reverse();
    else if (ref === 'endpoint_outward') order = [...canonical].sort((a, b) => Math.abs(a - endpoint) - Math.abs(b - endpoint) || a - b);
    else continue;
    if (!variants.some(prior => same(prior, order))) variants.push(order);
  }
  return variants;
}

function validateTransferRequest(value: OrderedSupportRequest): void {
  const supports = value.configuration.support_extents, flattened = supports.flat();
  const integer = (n: number, min: number, max: number): boolean => Number.isSafeInteger(n) && n >= min && n <= max;
  if (!integer(supports.length, 3, 8) || !flattened.length || flattened.some(n => !integer(n, 1, Number.MAX_SAFE_INTEGER)) ||
      new Set(flattened).size !== flattened.length || supports.some(support => support.slice(1).some((upper, i) => support[i]! <= upper))) {
    throw new TypeError('Ordered-support extents must be positive, globally unique and strictly decreasing bottom-to-top on 3–8 supports');
  }
  const expected = Array.from({ length: supports.length }, (_, index) => index);
  if (!integer(value.endpoint_support_index, 0, supports.length - 1) || !integer(value.traversal_orders.length, 1, 3) ||
      value.traversal_orders.some(order => !same([...order].sort((a, b) => a - b), expected)) ||
      new Set(value.traversal_orders.map(order => v6Canonical(order))).size !== value.traversal_orders.length ||
      !integer(value.maximum_state_expansions, 1, 65536) || !integer(value.maximum_transfer_depth, 1, 128)) {
    throw new TypeError('Ordered-support request requires unique support permutations and declared finite bounds');
  }
}

/** V5 BFS: first shortest witness per declared traversal, one global expansion cap. */
export function materializeOrderedSupportTransferWitnesses(value: OrderedSupportRequest): OrderedSupportResult {
  validateTransferRequest(value);
  const initial = value.configuration.support_extents.map(support => [...support]);
  const terminalStack = initial.flat().sort((a, b) => b - a);
  const terminal = initial.map((_, index) => index === value.endpoint_support_index ? terminalStack : []);
  const result: OrderedSupportResult = { witnesses: [], total_expanded_state_count: 0,
    state_expansion_bound_reached: false, transfer_depth_bound_reached: false, failure_kinds: [],
    schema_version: 'yf_arc3_v5.ordered_support_transfer_result.v1' };
  if (same(initial, terminal)) { result.failure_kinds = ['already_at_declared_endpoint']; return result; }
  type Path = [extent: number, source: number, destination: number][];
  const retainedPaths = new Set<string>();
  for (const [ordinal, order] of value.traversal_orders.entries()) {
    const queue: { state: number[][]; path: Path }[] = [{ state: initial, path: [] }];
    const visited = new Set([JSON.stringify(initial)]);
    let cursor = 0, localExpanded = 0, firstPath: Path | null = null;
    while (cursor < queue.length) {
      if (result.total_expanded_state_count >= value.maximum_state_expansions) { result.state_expansion_bound_reached = true; break; }
      const { state, path } = queue[cursor++]!;
      result.total_expanded_state_count++; localExpanded++;
      if (same(state, terminal)) { firstPath = path; break; }
      if (path.length >= value.maximum_transfer_depth) { result.transfer_depth_bound_reached = true; continue; }
      for (const sourceIndex of order) {
        const source = state[sourceIndex]!;
        if (!source.length) continue;
        const extent = source.at(-1)!;
        for (const destinationIndex of order) {
          if (sourceIndex === destinationIndex) continue;
          const destination = state[destinationIndex]!;
          if (destination.length && destination.at(-1)! <= extent) continue;
          const next = state.map(support => [...support]);
          next[sourceIndex] = source.slice(0, -1); next[destinationIndex] = [...destination, extent];
          const key = JSON.stringify(next);
          if (visited.has(key)) continue;
          visited.add(key); queue.push({ state: next, path: [...path, [extent, sourceIndex, destinationIndex]] });
        }
      }
      if (result.witnesses.length >= 3) break;
    }
    if (result.state_expansion_bound_reached) break;
    if (firstPath === null || retainedPaths.has(JSON.stringify(firstPath))) continue;
    retainedPaths.add(JSON.stringify(firstPath));
    result.witnesses.push({ traversal_order_ordinal: ordinal, steps: firstPath.map(([extent, source, destination]) => ({ extent,
      source_support_index: source, destination_support_index: destination, schema_version: 'yf_arc3_v5.ordered_support_transfer_step.v1' })),
    expanded_state_count: localExpanded, schema_version: 'yf_arc3_v5.ordered_support_transfer_witness.v1' });
    if (result.witnesses.length >= 3) break;
  }
  if (result.state_expansion_bound_reached) result.failure_kinds.push('state_expansion_bound_reached');
  if (result.transfer_depth_bound_reached && !result.witnesses.length) result.failure_kinds.push('transfer_depth_bound_reached');
  if (!result.witnesses.length && !result.failure_kinds.length) result.failure_kinds.push('no_legal_route_within_declared_bounds');
  result.failure_kinds = result.failure_kinds.slice(0, 3);
  return result;
}

export interface OrderedSupportPointCandidate {
  candidate_ref: string;
  action_ref: string;
  action_data: NativeRecord;
  component_ref?: string | null;
  point?: RowColumn | null;
}

/**
 * Full V5 click-counterfactual projection. An upstream DRM declaration selects
 * the endpoint measurement, traversal ordinal and bounds. Only that route's
 * candidate payload is exposed; the remaining search paths stay internal.
 */
export function materializeOrderedSupportClickCounterfactual(value: {
  rows: NativeRows;
  components: V5ComponentExtraction;
  point_candidates: readonly OrderedSupportPointCandidate[];
  point_action_ref: string;
  configuration: NativeRecord;
}): [context: NativeRecord, candidates: NativeRecord] {
  const { rows, components, point_candidates: pointCandidates, point_action_ref: pointActionRef, configuration } = value;
  const geometry = measureOrderedSupportGeometry(rows, components);
  const context: NativeRecord = {
    ordered_support_repeated_support_count: geometry.repeated_support_count,
    ordered_support_strict_layer_order_observed: geometry.strict_layer_order_observed,
    ordered_support_globally_unique_layer_extents_observed: geometry.globally_unique_layer_extents_observed,
    ordered_support_unique_widest_structural_endpoint_present: geometry.unique_widest_support_index !== null,
    ordered_support_measured_layer_count: geometry.supports.reduce((sum, support) => sum + support.layer_extents.length, 0),
    ordered_support_route_witness_count: 0,
    ordered_support_route_global_witness_bound: 3,
    ordered_support_route_state_expansion_bound_reached: false,
    ordered_support_route_transfer_depth_bound_reached: false,
    ordered_support_route_failure_kinds: [],
    ordered_support_declared_route_ordinal_available: false,
    ordered_support_unique_non_layer_structural_endpoint_present: false,
    ordered_support_occupied_maximum_tie_disambiguated: false,
  };
  const endpointMeasurements = (configuration.ordered_support_endpoint_measurements ?? ['unique_raw_structural_span']) as readonly string[];
  const measuredEndpoints = new Map<string, number | null>([['unique_raw_structural_span', geometry.unique_widest_support_index]]);
  if (endpointMeasurements.includes('unique_non_layer_span_under_occupied_tie') && geometry.unique_widest_support_index === null &&
      geometry.repeated_support_count >= 3 && geometry.strict_layer_order_observed && geometry.globally_unique_layer_extents_observed) {
    const [spans, unique, explainedTie] = measureOrderedSupportNonLayerSpans(rows, components, geometry);
    context.ordered_support_non_layer_structural_spans = spans;
    context.ordered_support_unique_non_layer_structural_endpoint_present = unique !== null;
    context.ordered_support_occupied_maximum_tie_disambiguated = explainedTie;
    measuredEndpoints.set('unique_non_layer_span_under_occupied_tie', explainedTie ? unique : null);
  }
  const endpoints = endpointMeasurements.flatMap(ref => {
    const endpoint = measuredEndpoints.get(ref); return endpoint !== undefined && endpoint !== null ? [[ref, endpoint] as const] : [];
  });
  const endpoint = endpoints.length === 1 ? endpoints[0]![1] : null;
  if (endpoint !== null) context.ordered_support_endpoint_measurement_ref = endpoints[0]![0];
  const variants = ((configuration.ordered_support_traversal_orders ?? []) as readonly unknown[]).map(String).slice(0, 3);
  const declaredOrdinal = configuration.ordered_support_committed_traversal_ordinal;
  const stateBound = Number(configuration.ordered_support_max_expanded_states || 0);
  const depthBound = Number(configuration.ordered_support_max_transfer_depth || 0);
  if (endpoint === null || !geometry.strict_layer_order_observed || !geometry.globally_unique_layer_extents_observed ||
      !variants.length || declaredOrdinal === null || declaredOrdinal === undefined || stateBound <= 0 || depthBound <= 0) return [context, {}];
  const orders = declaredSupportOrders(geometry.supports.length, endpoint, variants);
  if (!orders.length) return [context, {}];
  const result = materializeOrderedSupportTransferWitnesses({ configuration: { support_extents: geometry.supports.map(support => support.layer_extents) },
    endpoint_support_index: endpoint, traversal_orders: orders, maximum_state_expansions: stateBound, maximum_transfer_depth: depthBound });
  Object.assign(context, {
    ordered_support_route_witness_count: result.witnesses.length,
    ordered_support_route_global_witness_bound_not_exceeded: result.witnesses.length <= 3,
    ordered_support_route_total_expanded_state_count: result.total_expanded_state_count,
    ordered_support_route_state_expansion_bound: stateBound,
    ordered_support_route_transfer_depth_bound: depthBound,
    ordered_support_route_state_expansion_bound_reached: result.state_expansion_bound_reached,
    ordered_support_route_transfer_depth_bound_reached: result.transfer_depth_bound_reached,
    ordered_support_route_failure_kinds: result.failure_kinds,
  });
  const retained = result.witnesses.find(witness => witness.traversal_order_ordinal === Number(declaredOrdinal));
  if (!retained) return [context, {}];
  const candidateBySupport = new Map(pointCandidates.filter(candidate => candidate.action_ref === pointActionRef &&
    candidate.component_ref != null && candidate.point != null).map(candidate => [String(candidate.component_ref), candidate]));
  if (geometry.supports.some(support => !candidateBySupport.has(support.support_ref))) return [context, {}];
  const clickSupportIndices = retained.steps.flatMap(step => [step.source_support_index, step.destination_support_index]);
  const clickCandidates = clickSupportIndices.map(index => candidateBySupport.get(geometry.supports[index]!.support_ref)!);
  if (!clickCandidates.length) return [context, {}];
  Object.assign(context, {
    ordered_support_declared_route_ordinal_available: true,
    ordered_support_declared_route_ordinal: Number(declaredOrdinal),
    ordered_support_route_transfer_count: retained.steps.length,
    ordered_support_route_click_count: clickCandidates.length,
    ordered_support_route_nonretained_payloads_discarded: true,
  });
  const routeFacts = {
    candidate_is_declared_ordered_support_route_first_click: true,
    ordered_support_click_path_length: clickCandidates.length,
    ordered_support_click_path_action_refs: clickCandidates.map(() => pointActionRef),
    ordered_support_click_path_action_payloads: clickCandidates.map(candidate => candidate.action_data),
    ordered_support_click_path_component_refs: clickCandidates.map(candidate => candidate.component_ref),
    ordered_support_click_path_candidate_refs: clickCandidates.map(candidate => candidate.candidate_ref),
    ordered_support_route_all_intermediate_states_valid: true,
    ordered_support_route_conserves_measured_extents: true,
    ordered_support_route_is_first_shortest_for_declared_order: true,
  };
  return [context, { [clickCandidates[0]!.candidate_ref]: routeFacts }];
}

/** Equal material wings, keeping a bound hollow reference separate from matter. */
export function measureMaterialBands(rows: NativeRows, box: NativeBox, referencePixels: ReadonlySet<string>): MaterialBand[] | null {
  const background = backgroundValue(rows), [left, top, right, bottom] = box;
  type Profile = readonly [left: number, right: number, value: number] | 'ambiguous' | null;
  const profiles: { row: number; profile: Profile }[] = [];
  for (let y = top; y <= bottom; y++) {
    const row = rows[y]!;
    if (left <= 0 || right + 1 >= row.length) return null;
    const leftValue = row[left - 1]!, rightValue = row[right + 1]!;
    if (leftValue === background && rightValue === background || referencePixels.has(pixelKey(left - 1, y)) || referencePixels.has(pixelKey(right + 1, y))) {
      profiles.push({ row: y, profile: null }); continue;
    }
    if (leftValue !== rightValue || leftValue === background) { profiles.push({ row: y, profile: 'ambiguous' }); continue; }
    let xl = left - 1, xr = right + 1;
    while (xl > 0 && row[xl - 1] === leftValue && !referencePixels.has(pixelKey(xl - 1, y))) xl--;
    while (xr + 1 < row.length && row[xr + 1] === leftValue && !referencePixels.has(pixelKey(xr + 1, y))) xr++;
    const outsideOk = [xl - 1, xr + 1].every(x => x < 0 || x >= row.length || row[x] === background || referencePixels.has(pixelKey(x, y)));
    profiles.push({ row: y, profile: left - xl !== xr - right || !outsideOk ? 'ambiguous' : [xl, xr, leftValue] });
  }
  const groups: typeof profiles[] = [];
  for (const profile of profiles) {
    const last = groups.at(-1)?.at(-1);
    if (last && same(last.profile, profile.profile) && last.row + 1 === profile.row) groups.at(-1)!.push(profile);
    else groups.push([profile]);
  }
  const result: MaterialBand[] = [];
  for (const group of groups) {
    const profile = group[0]!.profile;
    if (group.length < 2 || profile === null) continue;
    if (profile === 'ambiguous') return null;
    const [xl, xr, value] = profile;
    result.push({ bbox: [xl, group[0]!.row, xr, group.at(-1)!.row], value });
  }
  return result;
}

/** V6 rebinding of measured V5 geometry; only unique strict material is retained. */
export async function measureOrderedSupportScene(rows: NativeRows): Promise<OrderedSupportScene | null> {
  const parts = await detectV5Components(rows), geometry = measureOrderedSupportGeometry(rows, parts);
  if (!geometry.supports.length) return null;
  const [spans, target] = measureOrderedSupportNonLayerSpans(rows, parts, geometry);
  if (target === null) return null;
  const byRef = new Map(parts.components.map(component => [component.component_id, component]));
  const stem = byRef.get(geometry.supports[target]!.support_ref)!, cx = geometry.supports[target]!.center_column;
  const hollow = parts.components.filter(component => component.bbox.top >= stem.bbox.top &&
    component.bbox.bottom <= stem.bbox.bottom && component.area < component.bbox.width * component.bbox.height);
  const pairs: [V5Component, V5Component][] = [];
  for (const a of hollow) for (const b of hollow) if (a !== b && a.value === b.value &&
      a.bbox.top === b.bbox.top && a.bbox.bottom === b.bbox.bottom && a.bbox.left + b.bbox.right === 2 * cx &&
      a.bbox.right + b.bbox.left === 2 * cx && a.bbox.right < cx && cx < b.bbox.left) pairs.push([a, b]);
  if (!pairs.length) return null;
  const referencePixels = new Set(pairs.flatMap(pair => pair.flatMap(component => component.pixels.map(([y, x]) => pixelKey(x, y)))));
  const measured: OrderedSupportDescription[] = [];
  for (const support of geometry.supports) {
    const component = byRef.get(support.support_ref)!;
    const bands = measureMaterialBands(rows, componentBox(component), referencePixels);
    if (bands === null) return null;
    const extents = bands.sort((a, b) => b.bbox[1] - a.bbox[1]).map(band => band.bbox[2] - band.bbox[0] + 1);
    if (extents.slice(1).some((upper, i) => extents[i]! <= upper)) return null;
    measured.push({ ...support, layer_extents: extents });
  }
  const extents = measured.flatMap(support => support.layer_extents);
  if (new Set(extents).size !== extents.length) return null;
  return { geometry: { ...geometry, supports: measured, strict_layer_order_observed: true, globally_unique_layer_extents_observed: true },
    configuration: measured.map(support => [...support.layer_extents]), target, spans,
    reference_pairs: pairs.map(([a, b]) => [a.component_id, b.component_id]),
    structural_supports: measured.map(support => { const component = byRef.get(support.support_ref)!; return { bbox: componentBox(component), value: component.value }; }) };
}

export async function measureSupportBand(rows: NativeRows, scene: OrderedSupportScene, source: number, extent: number): Promise<MaterialBand | null> {
  const parts = await detectV5Components(rows), byRef = new Map(parts.components.map(component => [component.component_id, component]));
  const referencePixels = new Set(scene.reference_pairs.flatMap(pair => pair.flatMap(ref => byRef.get(ref)!.pixels.map(([y, x]) => pixelKey(x, y)))));
  const candidates = measureMaterialBands(rows, scene.structural_supports[source]!.bbox, referencePixels)?.filter(band => band.bbox[2] - band.bbox[0] + 1 === extent);
  return candidates?.length === 1 ? candidates[0]! : null;
}

/** Bind selection to the exact measured member and an optional monochrome ring. */
export function orderedSupportSelectionMatches(first: NativeRows, later: NativeRows, plan: Pick<OrderedSupportPlan, 'member'>): boolean {
  if (first.length !== later.length || first.some((row, i) => row.length !== later[i]!.length)) return false;
  const [left, top, right, bottom] = plan.member.bbox, color = plan.member.value;
  const changed: [number, number][] = [];
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) if (first[y]![x] !== later[y]![x]) changed.push([x, y]);
  if (!changed.length) return false;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (later[y]![x] !== color) return false;
  const outside = changed.filter(([x, y]) => !(left <= x && x <= right && top <= y && y <= bottom));
  if (!outside.length) return true;
  const xl = Math.min(...outside.map(([x]) => x)), xr = Math.max(...outside.map(([x]) => x));
  const yt = Math.min(...outside.map(([, y]) => y)), yb = Math.max(...outside.map(([, y]) => y));
  if (!(xl < left && left <= right && right < xr && yt < top && top <= bottom && bottom < yb && left - xl === xr - right && top - yt === yb - bottom)) return false;
  const perimeter = new Set<string>(), values = new Set<number>();
  for (let y = yt; y <= yb; y++) for (let x = xl; x <= xr; x++) if (x === xl || x === xr || y === yt || y === yb) {
    perimeter.add(pixelKey(x, y)); values.add(later[y]![x]!);
  }
  return outside.every(([x, y]) => perimeter.has(pixelKey(x, y))) && values.size === 1;
}

/** Original V6 conditional family; the shared SRC runtime decides commitment. */
export class OrderedSupportTransfer implements NativeFamily<OrderedSupportProposal> {
  readonly id = 'ordered_support_transfer';
  readonly policy: Readonly<OrderedSupportPolicy>;
  private events: OrderedSupportEvent[] = [];
  private closed = new Set<string>();

  constructor(policy: Readonly<OrderedSupportPolicy> = ORDERED_SUPPORT_POLICY) { this.policy = structuredClone(policy); }

  state(): NativeRecord {
    return structuredClone({ format: 'ordered_support_transfer.v1', events: this.events, closed: [...this.closed].sort() });
  }
  restore(state: NativeRecord): void {
    if (!same(Object.keys(state).sort(), ['closed', 'events', 'format']) || state.format !== 'ordered_support_transfer.v1' ||
        !Array.isArray(state.events) || !Array.isArray(state.closed) || state.closed.some(key => typeof key !== 'string')) {
      throw new TypeError('Incomplete ordered support state');
    }
    this.events = structuredClone(state.events) as OrderedSupportEvent[]; this.closed = new Set(state.closed as string[]);
  }

  async propose(obs: NativeObservation, rows: NativeRows, _inputs: readonly NativeCommand[], remaining: number): Promise<OrderedSupportProposal | null> {
    const cfg = this.policy, action = cfg.point_action;
    if (!cfg.enabled || !obs.available_action_refs.includes(action) || remaining < 2) return null;
    const scene = await measureOrderedSupportScene(rows);
    if (scene === null) return null;
    const key = await v6Digest([obs.level_epoch, scene.configuration, scene.target, scene.structural_supports]);
    if (this.closed.has(key)) return null;
    const result = materializeOrderedSupportTransferWitnesses({ configuration: { support_extents: scene.configuration },
      endpoint_support_index: scene.target, traversal_orders: declaredSupportOrders(scene.configuration.length, scene.target, cfg.traversal_orders),
      maximum_state_expansions: cfg.maximum_state_expansions, maximum_transfer_depth: Math.min(cfg.maximum_transfer_depth, Math.floor(remaining / 2)) });
    if (!result.witnesses.length) return null;
    const step = result.witnesses[0]!.steps[0]!, source = step.source_support_index, destination = step.destination_support_index;
    const member = await measureSupportBand(rows, scene, source, step.extent);
    if (member === null) return null;
    const expected = scene.configuration.map(support => [...support]); expected[destination]!.push(expected[source]!.pop()!);
    const actions: NativeCommand[] = [source, destination].map(index => {
      const [y, x] = scene.geometry.supports[index]!.point; return { action_ref: action, data: { x, y } };
    });
    const binding: OrderedSupportBinding = { observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
      levels_completed: obs.levels_completed, frame_hash: obs.frame_hash };
    const plan: OrderedSupportPlan = { ordered_support_transfer: true, scene, member, source, destination, expected_configuration: expected,
      before_rows: rows, commands: actions, context_key: key, binding,
      model_status: 'conditional_top_only_smaller_on_larger_not_exclusive', alternatives: cfg.alternatives };
    const ref = `C_ordered_support_${await v6Digest([obs.observation_ref, source, destination, step.extent])}`;
    const facts = { current_repeated_supports_and_strict_extents: true, current_hollow_reference_bound: true,
      conditional_ordered_route_exists: true, selection_before_deposit_guard_required: true, current_input_publicly_available: true };
    const evidence = [obs.observation_ref, ...this.events.slice(-8).filter(event => event.transfer_observed).map(event => event.after)];
    const steps: NativeRecord[] = [];
    for (const [index, command] of actions.entries()) {
      const x = command.data.x!, y = command.data.y!, value = rows[y]![x]!;
      steps.push({ action: command, locus_witness: { level_epoch: obs.level_epoch, observation_ref: obs.observation_ref,
        frame_hash: obs.frame_hash, point: [x, y], palette_value: value, projection_bbox: [x, y, x, y],
        projected_rows_digest: await rowsDigest([[value]]), entity_ref: scene.geometry.supports[[source, destination][index]!]!.support_ref,
        signature: await v6Digest([obs.observation_ref, x, y, value]),
        scope: 'Current V5 measured support pixel; role and response remain conditional.' },
      expected_after: index === 0 ? { selection: 'unknown_until_current_comparison' } : { configuration: expected } });
    }
    return { status: 'proposed', kind: 'conditional_ordered_support_transfer', support_plan: structuredClone(plan), actions, steps, facts,
      compositions: [{ id: ref, observed: false, role: 'information_question', open_question: cfg.why,
        properties: { reference_role: 'hypothesis', ordering_law: 'conditional', remaining_transfers: result.witnesses[0]!.steps.length,
          alternatives: cfg.alternatives }, relations: ['contributes_to:G_official_completion'] }], binding,
      question: { reason: cfg.why, hypothesis_refs: evidence }, route_refs: evidence,
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: cfg.why, preconditions: facts, evidence, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  before(proposal: OrderedSupportProposal, index: number, current: NativePublicObservation, obs: NativeObservation): NativeBeforeResult {
    const plan = proposal.support_plan, binding = plan.binding;
    let admitted = same(proposal.actions, plan.commands) && (index === 0 || index === 1) && current.level === binding.level_epoch &&
      current.levels_completed === binding.levels_completed && current.available_action_refs.includes(proposal.actions[index]!.action_ref);
    if (index === 0) admitted = admitted && current.frame_hash === binding.frame_hash && obs.observation_ref === binding.observation_ref && same(current.frame_rows, plan.before_rows);
    else admitted = admitted && orderedSupportSelectionMatches(plan.before_rows, current.frame_rows, plan);
    return { admitted, reason: admitted ? 'current_ordered_support_scope_and_intermediate_selection' : 'ordered_support_scope_or_selection_unbound' };
  }

  async after(proposal: OrderedSupportProposal, index: number, before: NativeObservation, after: NativeObservation,
    _firstRows: NativeRows, secondRows: NativeRows): Promise<NativeAfterResult> {
    const plan = proposal.support_plan;
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed) {
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    }
    let matched: boolean;
    if (index === 0) matched = orderedSupportSelectionMatches(plan.before_rows, secondRows, plan);
    else {
      const current = await measureOrderedSupportScene(secondRows);
      matched = current !== null && same(current.configuration, plan.expected_configuration) && current.target === plan.scene.target &&
        same(current.structural_supports, plan.scene.structural_supports);
    }
    return { matched, seal_prefix: !matched || index === 1,
      reason: index === 0 ? 'observed_selection_only' : 'compare_conditional_transfer_not_universal_law' };
  }

  async record(before: NativeObservation, after: NativeObservation, command: NativeCommand, firstRows: NativeRows, secondRows: NativeRows,
    proposal?: OrderedSupportProposal, index?: number, _frames?: readonly NativeRows[]): Promise<NativeRecordResult> {
    if (!proposal?.support_plan?.ordered_support_transfer) return { events: [] };
    if ((index !== 0 && index !== 1) || !same(command, proposal.actions[index])) throw new TypeError('Ordered support observed command differs from released binding');
    const result = await this.after(proposal, index, before, after, firstRows, secondRows);
    const event: OrderedSupportEvent = { kind: 'ordered_support_response', before: before.observation_ref, after: after.observation_ref,
      origin_epoch: before.level_epoch, command, parent: 'G_official_completion', selection_observed: index === 0 && result.matched === true,
      transfer_observed: index === 1 && result.matched === true, official_progress: after.levels_completed > before.levels_completed,
      model_scope: 'observed local response; ordering and terminal interpretations remain revisable', matched: result.matched };
    this.events.push(event);
    if (result.matched === false) this.closed.add(proposal.support_plan.context_key);
    return { events: [event] };
  }
}
