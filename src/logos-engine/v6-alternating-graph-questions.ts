/** Exact V6 alternating_graph_questions.py; every returned contact remains conditional. */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as same } from './v6-operations.ts';
import { alternatingDescription, alternatingHistogram, alternatingOverlays } from './v6-alternating-graph-observation.ts';
import type { AlternatingActor, AlternatingBox, AlternatingPosition } from './v6-alternating-graph-observation.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const key = (point: readonly number[]): string => point.join(',');
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;
export interface AlternatingGuard {
  position: AlternatingPosition;
  front: AlternatingPosition;
  histogram: number[][];
  bbox: AlternatingBox;
}
/** String point keys encode the original sets/maps of row-column tuples. */
export interface AlternatingTopology {
  nodes: Set<string>;
  edges: Map<string, Set<string>>;
  target: AlternatingPosition;
  guards: AlternatingGuard[];
  pitch: number;
  first: number;
}

export function alternatingTopology(rows: NativeRows, actor: Readonly<AlternatingActor>, calibration: R): AlternatingTopology | null {
  const q = actor.size, pitch = calibration.alternating_material_full_step_pitch, first = calibration.alternating_material_first_value;
  const links = new Set<number>(calibration.alternating_material_connector_values), [row, column] = actor.bbox;
  if (pitch !== 2 * q) return null;
  const scene = alternatingDescription(rows), nodes = new Set<string>(), connectors: AlternatingPosition[] = [], targets: AlternatingPosition[] = [];
  for (const sprite of scene.sprites) {
    const box = sprite.bbox;
    if (box.height !== q || box.width !== q || sprite.touches_frame_boundary
      || modulo(box.top - row, pitch) !== 0 || modulo(box.left - column, pitch) !== 0) continue;
    const histogram = alternatingHistogram(rows, [box.top, box.left, box.bottom, box.right]), position: AlternatingPosition = [box.top, box.left];
    if (histogram.length > 1 || histogram[0]![0] === first) nodes.add(key(position));
    else if (!links.has(histogram[0]![0]!)) { nodes.add(key(position)); targets.push(position); }
  }
  for (const component of scene.components) {
    const box = component.bbox;
    if (box.width !== q || box.height !== q || component.area !== q * q || component.touches_frame_boundary) continue;
    const position: AlternatingPosition = [box.top, box.left];
    if (component.value === first && modulo(position[0] - row, pitch) === 0 && modulo(position[1] - column, pitch) === 0) nodes.add(key(position));
    else if (links.has(component.value)) connectors.push(position);
  }
  const edges = new Map([...nodes].map(node => [node, new Set<string>()]));
  for (const [y, x] of connectors) {
    const pairs: [AlternatingPosition, AlternatingPosition][] = [];
    if (modulo(y - row, pitch) === 0 && modulo(x - column - q, pitch) === 0) pairs.push([[y, x - q], [y, x + q]]);
    if (modulo(y - row - q, pitch) === 0 && modulo(x - column, pitch) === 0) pairs.push([[y - q, x], [y + q, x]]);
    for (const [a, b] of pairs) if (nodes.has(key(a)) && nodes.has(key(b))) { edges.get(key(a))!.add(key(b)); edges.get(key(b))!.add(key(a)); }
  }
  if (nodes.size < 4 || new Set(targets.map(key)).size !== 1) return null;
  const guards: AlternatingGuard[] = [];
  for (const candidate of alternatingOverlays(rows)) {
    if (same(candidate.bbox, actor.bbox) || candidate.size !== q) continue;
    const position: AlternatingPosition = [candidate.bbox[0], candidate.bbox[1]];
    if (!nodes.has(key(position))) continue;
    const singular = candidate.histogram.filter(([, count]) => count === 1).map(([value]) => value!);
    const offsets: AlternatingPosition[] = [];
    for (let y = 0; y < q; y++) for (let x = 0; x < q; x++) {
      if (candidate.histogram.length === 2 && singular.length === 1 && rows[position[0] + y]![position[1] + x] === singular[0]) offsets.push([2 * y - q + 1, 2 * x - q + 1]);
    }
    if (offsets.length !== 1 || !((offsets[0]![0] === 0) !== (offsets[0]![1] === 0))) return null;
    const [dy, dx] = offsets[0]!;
    guards.push({ position, front: [position[0] + Math.sign(dy) * pitch, position[1] + Math.sign(dx) * pitch],
      histogram: candidate.histogram, bbox: candidate.bbox });
  }
  return { nodes, edges, target: targets[0]!, guards, pitch, first };
}

interface SearchState {
  position: AlternatingPosition;
  removed: bigint;
  depth: number;
  parent: number | null;
  action: string | null;
  contact: number | null;
}

export function instrumentalAlternatingContact(
  rows: NativeRows, actor: Readonly<AlternatingActor>, controls: Readonly<Record<string, readonly number[]>>,
  calibration: R, removals: readonly R[], remaining: number,
): R | null {
  const graph = alternatingTopology(rows, actor, calibration);
  if (!graph || !graph.guards.length) return null;
  const compatible = new Set(graph.guards.flatMap((guard, index) => removals.some(removal => same(removal.guard_histogram, guard.histogram) && removal.size === actor.size) ? [index] : []));
  if (!compatible.size) return null;
  const indices = new Map(graph.guards.map((guard, index) => [key(guard.position), index]));
  const initial: AlternatingPosition = [actor.bbox[0], actor.bbox[1]];
  const queue: SearchState[] = [{ position: initial, removed: 0n, depth: 0, parent: null, action: null, contact: null }];
  const stateKey = (position: AlternatingPosition, removed: bigint): string => `${key(position)}|${removed.toString()}`;
  const seen = new Set([stateKey(initial, 0n)]), actions = Object.entries(controls).sort(([left], [right]) => compareUnicode(left, right));
  let final: number | null = null, examined = 0;
  for (let cursor = 0; cursor < queue.length && examined < 512; cursor++) {
    const state = queue[cursor]!, position = state.position; examined++;
    if (same(position, graph.target)) { final = cursor; break; }
    if (state.depth >= remaining) continue;
    for (const [action, delta] of actions) {
      const destination: AlternatingPosition = [position[0] + delta[0]!, position[1] + delta[1]!];
      if (!graph.edges.get(key(position))?.has(key(destination))) continue;
      if (graph.guards.some((guard, index) => same(destination, guard.front) && !(state.removed & (1n << BigInt(index))))) continue;
      let changed = state.removed;
      const index = indices.get(key(destination));
      if (index !== undefined && !(state.removed & (1n << BigInt(index)))) {
        if (!compatible.has(index)) continue;
        changed |= 1n << BigInt(index);
      }
      const nextKey = stateKey(destination, changed);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey); queue.push({ position: destination, removed: changed, depth: state.depth + 1, parent: cursor, action,
        contact: changed !== state.removed ? index! : null });
    }
  }
  if (final === null) return null;
  const path: R[] = [];
  for (let cursor = final; queue[cursor]!.parent !== null;) {
    const state = queue[cursor]!, previous = queue[state.parent!]!;
    path.push({ action_ref: state.action, from: [...previous.position], to: [...state.position], contact_index: state.contact });
    cursor = state.parent!;
  }
  path.reverse();
  const first = path.findIndex(step => step.contact_index !== null);
  if (first < 0) return null;
  const guard = graph.guards[path[first]!.contact_index]!;
  return { prefix: path.slice(0, first + 1), guard, counterfactual_complete_length: path.length, examined,
    node_count: graph.nodes.size, edge_count: [...graph.edges.values()].reduce((total, values) => total + values.size, 0) / 2,
    evidence: removals.filter(removal => same(removal.guard_histogram, guard.histogram)).flatMap(removal => removal.evidence),
    scope: 'Conditional graph-change path. Removal is supported only by a previous contact followed by revealed ordinary support; transfer of side/rear applicability is a hypothesis. Prefix ends at first contact; no unobserved full reactive order supplied.' };
}
