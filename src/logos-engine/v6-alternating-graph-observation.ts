/**
 * Consumed closure of V6 alternating_graph_observation.py and V5
 * _alternating_material_graph_measurement, reference 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * The scene projection contains exactly the components and sprite fields read
 * by this closure. Unconsumed periodic grids, holes and membership projections
 * from describe_visual_scene are not claimed as transferred by this module.
 */
import { compareUnicode } from './canonical.ts';
import { supportCompare, supportParts } from './v6-support-measurements.ts';
import { validateRows } from './v6-native-observer.ts';
import type { V5BoundingBox } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export type AlternatingPosition = readonly [row: number, column: number];
export type AlternatingBox = readonly [top: number, left: number, bottom: number, right: number];
export interface AlternatingActor {
  bbox: AlternatingBox;
  histogram: number[][];
  size: number;
}
export interface AlternatingSprite {
  sprite_id: string;
  bbox: V5BoundingBox;
  pattern: NativeRows;
  color_histogram: readonly (readonly number[])[];
  pattern_occurrence_count: number;
  touches_frame_boundary: boolean;
}
export interface AlternatingDescription {
  components: readonly R[];
  sprites: readonly AlternatingSprite[];
}
const pointKey = (point: readonly number[]): string => point.join(',');
const boxKey = (box: V5BoundingBox): string => [box.top, box.left, box.bottom, box.right].join(',');
const point = (key: string): AlternatingPosition => key.split(',').map(Number) as unknown as AlternatingPosition;
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;
const orderPoint = (left: AlternatingPosition, right: AlternatingPosition): number => left[0] - right[0] || left[1] - right[1];
const asBox = (box: V5BoundingBox): AlternatingBox => [box.top, box.left, box.bottom, box.right];
const frozen = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
};
// Like the original description cache, this cache has eight entries. Keys bind
// current raster content, including caller-owned arrays that can be edited.
const descriptions = new Map<string, AlternatingDescription>();

export function alternatingHistogram(rows: NativeRows, box: readonly number[]): number[][] {
  if (box.length !== 4 || box.some(value => !Number.isSafeInteger(value))) throw new TypeError('Four integer row/column bounds are required');
  const [top, left, bottom, right] = box as AlternatingBox, counts = new Map<number, number>();
  for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) {
    // The original is a direct Python list lookup, including negative indices.
    const value = rows.at(row)?.at(column);
    if (value === undefined) throw new RangeError('list index out of range');
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort(([left], [right]) => left - right);
}

/** Exact component-crop fields consumed from describe_visual_scene.sprites. */
export function alternatingDescription(rows: NativeRows): AlternatingDescription {
  validateRows(rows);
  const key = JSON.stringify(rows), previous = descriptions.get(key);
  if (previous) { descriptions.delete(key); descriptions.set(key, previous); return previous; }
  const components = supportParts(rows), height = rows.length, width = rows[0]!.length, frameArea = height * width;
  const candidates = components.filter(component => {
    const box = component.bbox;
    const contacts = Number(box.top === 0) + Number(box.left === 0) + Number(box.bottom === height - 1) + Number(box.right === width - 1);
    return !(frameArea >= 64 && component.touches_frame_boundary && contacts >= 2
      && box.height * box.width * 2 >= frameArea && component.area * 2 >= frameArea);
  }).map(component => {
    const box = component.bbox as V5BoundingBox;
    const pattern = rows.slice(box.top, box.bottom + 1).map(row => row.slice(box.left, box.right + 1));
    return { component, pattern, key: JSON.stringify(pattern) };
  });
  const occurrences = new Map<string, number>();
  for (const item of candidates) occurrences.set(item.key, (occurrences.get(item.key) ?? 0) + 1);
  const sprites = candidates.map(({ component, pattern, key }): AlternatingSprite => ({
    sprite_id: `sprite.crop.${component.component_id}`, bbox: component.bbox, pattern,
    color_histogram: alternatingHistogram(rows, asBox(component.bbox)),
    pattern_occurrence_count: occurrences.get(key)!, touches_frame_boundary: component.touches_frame_boundary,
  }));
  const result = frozen({ components, sprites });
  descriptions.set(key, result);
  if (descriptions.size > 8) descriptions.delete(descriptions.keys().next().value!);
  return result;
}

export function alternatingOverlays(rows: NativeRows): AlternatingActor[] {
  const result: AlternatingActor[] = [];
  for (const sprite of alternatingDescription(rows).sprites) {
    const q = sprite.bbox.width;
    if (q === sprite.bbox.height && q >= 2 && q <= 16 && !sprite.touches_frame_boundary && sprite.color_histogram.length > 1) {
      const bbox = asBox(sprite.bbox);
      result.push({ bbox, histogram: alternatingHistogram(rows, bbox), size: q });
    }
  }
  return result;
}

interface Overlay {
  bbox: AlternatingBox;
  position: AlternatingPosition;
  palette_value_count: number;
  pattern_occurrence_count: number;
  sprite_ref: string;
  cardinal_marker_step: AlternatingPosition[];
}
interface GraphRecord {
  quantum: number; pitch: number; first_value: number; connector_values: number[];
  node_count: number; edge_count: number; overlay_count: number; start_bbox: AlternatingBox;
  additional_occupant_count: number; excluded_positions: AlternatingPosition[];
  supported_departures: string[]; route_witnesses: string[][]; route_bound_reached: boolean;
}

/** All fields of the original V6 measure result, including conditional refusals. */
export function measureAlternatingGraph(
  rows: NativeRows, observation: R, actor: Readonly<AlternatingActor>,
  controls: Readonly<Record<string, readonly number[]>>, evidence: readonly string[], lastAction: string | null,
  markerPrecaution = false,
): R {
  const { components, sprites } = alternatingDescription(rows);
  // The V6 wrapper supplies exactly these source bounds. They are not enlarged
  // for a particular scene or for a caller's remaining action budget.
  const maximumDescriptions = 3, maximumRouteWitnesses = 3, maximumExpandedStates = 512, maximumDepth = 40;
  const squareGroups = new Map<string, { q: number; value: number; positions: Set<string> }>();
  const squareValues = new Map<string, number>();
  for (const component of components) {
    const box = component.bbox as V5BoundingBox, q = box.height;
    if (q < 2 || q > 16 || box.width !== q || component.area !== q * q
      || component.relative_pixels.length !== q * q || component.touches_frame_boundary) continue;
    const key = `${q}:${component.value}`, group = squareGroups.get(key) ?? { q, value: component.value, positions: new Set<string>() };
    group.positions.add(pointKey([box.top, box.left])); squareGroups.set(key, group);
    squareValues.set(boxKey(box), component.value);
  }
  const actionRefsByStep = new Map<string, string[]>();
  const orderedControls = Object.entries(controls).sort(([left], [right]) => compareUnicode(left, right));
  for (const [action, delta] of orderedControls) {
    const step: AlternatingPosition = [Math.sign(Math.trunc(delta[0]!)), Math.sign(Math.trunc(delta[1]!))];
    if (step[0] === 0 && step[1] === 0 || !observation.available_action_refs.includes(action)) continue;
    const key = pointKey(step), refs = actionRefsByStep.get(key) ?? [];
    if (!refs.includes(action)) refs.push(action);
    actionRefsByStep.set(key, refs);
  }
  const actionRefByStep = new Map([...actionRefsByStep].filter(([, refs]) => refs.length === 1).map(([key, refs]) => [key, refs[0]!]));
  const groupedItems = [...squareGroups.values()].sort((left, right) => left.q - right.q || left.value - right.value);
  const records: GraphRecord[] = [];
  let descriptionBoundReached = false;
  for (const first of groupedItems) {
    if (first.positions.size < 4) continue;
    const quantum = first.q, pitch = quantum * 2;
    const residues = new Map<string, number>();
    for (const key of first.positions) {
      const [row, column] = point(key), residue = pointKey([modulo(row, pitch), modulo(column, pitch)]);
      residues.set(residue, (residues.get(residue) ?? 0) + 1);
    }
    const greatest = Math.max(...residues.values());
    const dominant = [...residues].filter(([, count]) => count === greatest && count >= 4).map(([key]) => point(key)).sort(orderPoint);
    if (dominant.length !== 1) continue;
    const [rowResidue, columnResidue] = dominant[0]!;
    const stable = new Set([...first.positions].filter(key => {
      const [row, column] = point(key); return modulo(row, pitch) === rowResidue && modulo(column, pitch) === columnResidue;
    }));
    const connectorGroups: { value: number; positions: Set<string> }[] = [];
    for (const group of groupedItems) {
      if (group.q !== quantum || group.value === first.value) continue;
      const positions = new Set([...group.positions].filter(key => {
        const [row, column] = point(key);
        return modulo(row, pitch) === rowResidue && modulo(column, pitch) === modulo(columnResidue + quantum, pitch)
          || modulo(row, pitch) === modulo(rowResidue + quantum, pitch) && modulo(column, pitch) === columnResidue;
      }));
      if (positions.size) connectorGroups.push({ value: group.value, positions });
    }
    if (!connectorGroups.length) continue;
    const connectorValues = connectorGroups.map(group => group.value).sort((left, right) => left - right);
    const connectors = new Set(connectorGroups.flatMap(group => [...group.positions]));
    // The source inner loop contributes only the first compatible connector
    // value; the candidate uses the union of all compatible connector classes.
    if (connectors.size < 3) continue;
    const overlayByBox = new Map<string, Overlay>();
    for (const sprite of sprites) {
      const box = sprite.bbox;
      if (sprite.touches_frame_boundary || box.height !== quantum || box.width !== quantum
        || modulo(box.top, pitch) !== rowResidue || modulo(box.left, pitch) !== columnResidue) continue;
      const key = boxKey(box), uniformValue = squareValues.get(key);
      if (uniformValue === first.value || uniformValue !== undefined && connectorValues.includes(uniformValue)) continue;
      const histogram = [...sprite.color_histogram].sort(supportCompare);
      const singletons = histogram.filter(([, count]) => count === 1).map(([value]) => value!);
      const cardinal: AlternatingPosition[] = [];
      for (let row = 0; row < quantum; row++) for (let column = 0; column < quantum; column++) {
        if (histogram.length !== 2 || singletons.length !== 1 || rows[box.top + row]![box.left + column] !== singletons[0]) continue;
        const dy = 2 * row - quantum + 1, dx = 2 * column - quantum + 1;
        if ((dy === 0) !== (dx === 0)) cardinal.push([Math.sign(dy), Math.sign(dx)]);
      }
      const record: Overlay = { bbox: asBox(box), position: [box.top, box.left], palette_value_count: sprite.color_histogram.length,
        pattern_occurrence_count: sprite.pattern_occurrence_count, sprite_ref: sprite.sprite_id, cardinal_marker_step: cardinal };
      const incumbent = overlayByBox.get(key);
      if (!incumbent || record.palette_value_count > incumbent.palette_value_count
        || record.palette_value_count === incumbent.palette_value_count && compareUnicode(record.sprite_ref, incumbent.sprite_ref) > 0) overlayByBox.set(key, record);
    }
    const overlays = [...overlayByBox.values()].sort((left, right) => supportCompare(left.bbox, right.bbox));
    if (overlays.length < 2 || overlays.length > 8) continue;
    const nonuniform = overlays.filter(item => item.palette_value_count > 1);
    const aligned = nonuniform.filter(item => supportCompare(item.bbox, actor.bbox) === 0);
    const controlled = nonuniform.length === 1 ? nonuniform[0]! : aligned.length === 1 ? aligned[0]! : null;
    if (!controlled) continue;
    const additional = nonuniform.filter(item => item !== controlled);
    if (additional.length && (!markerPrecaution || additional.length > 3 || additional.some(item => item.cardinal_marker_step.length !== 1))) continue;
    const excluded = new Set(additional.map(item => pointKey([
      item.position[0] + item.cardinal_marker_step[0]![0] * pitch,
      item.position[1] + item.cardinal_marker_step[0]![1] * pitch,
    ])));
    const targets = overlays.filter(item => item.palette_value_count === 1);
    const nodes = new Set([...stable, ...overlays.map(item => pointKey(item.position))]);
    const adjacency = new Map<string, { position: AlternatingPosition; action: string }[]>();
    const edgePairs = new Set<string>();
    for (const key of connectors) {
      const [row, column] = point(key);
      const endpoints: AlternatingPosition[] = modulo(row, pitch) === rowResidue
        ? [[row, column - quantum], [row, column + quantum]] : [[row - quantum, column], [row + quantum, column]];
      const [left, right] = endpoints as [AlternatingPosition, AlternatingPosition], a = pointKey(left), b = pointKey(right);
      if (!nodes.has(a) || !nodes.has(b)) continue;
      const edge = [left, right].sort(orderPoint).map(pointKey).join('|');
      if (edgePairs.has(edge)) continue;
      edgePairs.add(edge);
      const step: AlternatingPosition = [Math.sign(right[0] - left[0]), Math.sign(right[1] - left[1])];
      const forward = actionRefByStep.get(pointKey(step)), reverse = actionRefByStep.get(pointKey([-step[0], -step[1]]));
      if (forward) { const outgoing = adjacency.get(a) ?? []; outgoing.push({ position: right, action: forward }); adjacency.set(a, outgoing); }
      if (reverse) { const outgoing = adjacency.get(b) ?? []; outgoing.push({ position: left, action: reverse }); adjacency.set(b, outgoing); }
    }
    if (edgePairs.size < 3) continue;
    const start = pointKey(controlled.position);
    const departures = [...new Set((adjacency.get(start) ?? []).map(item => item.action))].sort(compareUnicode);
    const routeWitnesses: string[][] = [];
    let routeBoundReached = false;
    for (const endpoint of targets) {
      const target = pointKey(endpoint.position), queue: string[] = [start], depths = new Map([[start, 0]]);
      const predecessor = new Map<string, { parent: string; action: string }>();
      let expanded = 0, found = false;
      for (let cursor = 0; cursor < queue.length && expanded < maximumExpandedStates && !found; cursor++) {
        const current = queue[cursor]!; expanded++;
        if (depths.get(current)! >= maximumDepth) continue;
        const neighbors = [...adjacency.get(current) ?? []].sort((left, right) => orderPoint(left.position, right.position) || compareUnicode(left.action, right.action));
        for (const neighbor of neighbors) {
          const next = pointKey(neighbor.position);
          if (depths.has(next) || excluded.has(next)) continue;
          depths.set(next, depths.get(current)! + 1); predecessor.set(next, { parent: current, action: neighbor.action });
          if (next === target) {
            const route: string[] = [];
            for (let at = next; at !== start;) { const previous = predecessor.get(at)!; route.push(previous.action); at = previous.parent; }
            routeWitnesses.push(route.reverse()); found = true; break;
          }
          queue.push(next);
        }
      }
      if (routeWitnesses.length >= maximumRouteWitnesses) { routeBoundReached = targets.length > routeWitnesses.length; break; }
    }
    if (!routeWitnesses.length) continue;
    records.push({ quantum, pitch, first_value: first.value, connector_values: connectorValues, node_count: nodes.size,
      edge_count: edgePairs.size, overlay_count: overlays.length, start_bbox: controlled.bbox, additional_occupant_count: additional.length,
      excluded_positions: [...excluded].map(point).sort(orderPoint), supported_departures: departures, route_witnesses: routeWitnesses,
      route_bound_reached: routeBoundReached });
    if (records.length > maximumDescriptions) { descriptionBoundReached = true; break; }
  }
  if (descriptionBoundReached || records.length !== 1) {
    return { alternating_material_graph_description_count: records.length, alternating_material_graph_description_bound_reached: descriptionBoundReached,
      unique_alternating_material_graph_description_present: false, nonuniform_overlay_single_adjacent_action_refs: [],
      translated_overlay_matches_alternating_pitch_and_edge: false, alternating_material_first_shortest_action_refs: [],
      alternating_material_first_shortest_edge_count: 0, alternating_material_route_witness_count: 0,
      alternating_material_additional_occupant_count: 0, alternating_material_counterfactual_exclusion_present: false };
  }
  const record = records[0]!;
  const aligned = supportCompare(record.start_bbox, actor.bbox) === 0;
  const pitchMatched = orderedControls.some(([action, delta]) => action === (lastAction || '')
    && (Math.abs(Math.trunc(delta[0]!)) === record.pitch && Math.trunc(delta[1]!) === 0
      || Math.abs(Math.trunc(delta[1]!)) === record.pitch && Math.trunc(delta[0]!) === 0));
  const translated = Boolean(evidence.length && aligned && pitchMatched && Object.hasOwn(controls, lastAction || ''));
  const route = translated && record.route_witnesses.length === 1 ? record.route_witnesses[0]! : [];
  return { alternating_material_graph_description_count: 1, alternating_material_graph_description_bound_reached: false,
    unique_alternating_material_graph_description_present: true, alternating_material_block_quantum: record.quantum,
    alternating_material_full_step_pitch: record.pitch, alternating_material_first_value: record.first_value,
    alternating_material_connector_values: record.connector_values, alternating_material_value_count: 1 + record.connector_values.length,
    alternating_material_graph_node_count: record.node_count, alternating_material_graph_edge_count: record.edge_count,
    alternating_material_overlay_count: record.overlay_count, alternating_material_additional_occupant_count: record.additional_occupant_count,
    alternating_material_counterfactual_exclusion_present: record.excluded_positions.length > 0,
    alternating_material_counterfactual_excluded_positions: record.excluded_positions,
    alternating_material_measurement_frame_ref: observation.observation_ref,
    nonuniform_overlay_single_adjacent_action_refs: record.supported_departures.length === 1 ? record.supported_departures : [],
    translated_overlay_matches_alternating_pitch_and_edge: translated, alternating_material_route_witness_count: record.route_witnesses.length,
    alternating_material_route_witness_bound_reached: record.route_bound_reached,
    alternating_material_first_shortest_action_refs: route, alternating_material_first_shortest_edge_count: route.length };
}
