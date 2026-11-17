import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { ObservedCommandGraph } from './observed-command-frontier.ts';
import { containsBox, panelFootingEvidence, reachablePanelFootings, sameBox, type PanelWalker } from './panel-context-probe.ts';
import { panelTransportPose } from './panel-mechanism-probe.ts';

type Held = { tool: NativeBox; support: NativeBox };
type Move = { key: string; delta: NativePoint; accessCost: number };
type Peer = { marker: NativeBox; evidence: string };
type Edge = { from: string; to: string; move: Move; evidence?: string };
type Candidate = { placement: Held; marker: NativeBox; gain: number; evidence: string };
export type PanelBridgeTarget = { goal: Candidate; railInk: number; railPixels: number[] };
const shifted = ([x, y, r, b]: NativeBox, [dx, dy]: NativePoint): NativeBox => [x + dx, y + dy, r + dx, b + dy];
const center = ([x, y, r, b]: NativeBox): NativePoint => [Math.floor((x + r) / 2), Math.floor((y + b) / 2)];
const pixel = (x: number, y: number) => y * 256 + x;

/** Start from placements that give an unvisited, addressable landing access
 * to additional fixed floor. Walk the rail graph backward to choose the next
 * guarded command. A projected edge is an experiment, not a witnessed move. */
export function planPanelBridge(walker: PanelWalker, rows: NativeRows, field: NativeBox, held: Held,
  returns: ObservedCommandGraph, moves: readonly Move[], peers: readonly Peer[], budget: number, retained?: PanelBridgeTarget) {
  if (!peers.length || budget < 2 || !moves.some(move => move.delta[0]) || !moves.some(move => move.delta[1])) return;
  const components = geometricComponents(rows), tool = components.find(part => sameBox(part.bbox, held.tool));
  if (!tool) return;
  const support = components.filter(part => part.rectangular && containsBox(held.support, part.bbox)
    && !containsBox(held.tool, part.bbox));
  if (support.length !== 2 || support[0]!.color !== support[1]!.color) return;
  if (!Object.values(walker.contacts ?? {}).some(contact => contact.patch.split(',').includes(String(tool.color)))) return;

  const heldLeft = Math.min(held.tool[0], held.support[0]), heldTop = Math.min(held.tool[1], held.support[1]);
  const heldRight = Math.max(held.tool[2], held.support[2]), heldBottom = Math.max(held.tool[3], held.support[3]);
  const mask: NativePoint[] = [];
  for (let y = heldTop; y <= heldBottom; y++) for (let x = heldLeft; x <= heldRight; x++) {
    if (rows[y]?.[x] === tool.color || rows[y]?.[x] === support[0]!.color) mask.push([x, y]);
  }
  const occupied = new Set(mask.map(([x, y]) => pixel(x, y)));
  const rackColors = new Set(components.filter(part => !part.rectangular && containsBox(field, part.bbox)
    && part.color !== walker.floor && part.color !== walker.ink && part.color !== tool.color && part.color !== support[0]!.color
    && part.area > tool.area && part.area * 6 < rows.length * rows[0]!.length).map(part => part.color));
  // A putative rail must support a measured departure or arrival at a
  // center that the current sprites no longer cover.
  const witnessed = Object.entries(returns).flatMap(([source, edges]) =>
    edges.filter(edge => edge.destination && edge.destination !== source).flatMap(edge => [source, edge.destination!]));
  const centers = [...new Set(witnessed)].flatMap(pose => {
    const [l, t, r, b] = pose.split(':')[0]!.split(',').map(Number);
    if (l === undefined || t === undefined || r === undefined || b === undefined) return [];
    const [x, y] = center([l, t, r, b]);
    return x >= heldLeft && x <= heldRight && y >= heldTop && y <= heldBottom ? [] : [[x, y] as const];
  });
  for (const ink of [...rackColors]) {
    if (centers.filter(([x, y]) => rows[y]?.[x] === ink).length < Math.min(2, centers.length) || !centers.length) rackColors.delete(ink);
  }
  const previous = retained && peers.some(peer => sameBox(peer.marker, retained.goal.marker)) ? retained : undefined;
  if (!previous && rackColors.size !== 1) return;
  const railInk = previous?.railInk ?? [...rackColors][0]!;
  // Moving pieces can cover the same rail cells that justified the plan.
  // Preserve the earlier visible witnesses while the goal remains bound.
  const railPixels = new Set(previous?.railPixels ?? []);
  for (let y = field[1]; y <= field[3]; y++) for (let x = field[0]; x <= field[2]; x++) {
    if (rows[y]?.[x] === railInk) railPixels.add(pixel(x, y));
  }
  const current = panelTransportPose(held), poses = new Map([[current, held]]), queue = [current];
  const reverse = new Map<string, Edge[]>();
  for (const key of queue) {
    if (poses.size > 128) return;
    const from = poses.get(key)!;
    for (const move of moves) {
      const placement = { tool: shifted(from.tool, move.delta), support: shifted(from.support, move.delta) };
      if (!containsBox(field, placement.tool) || !containsBox(field, placement.support)) continue;
      const to = panelTransportPose(placement), observed = returns[key]?.find(edge => edge.action === move.key);
      const [x, y] = center(placement.tool);
      if (observed ? observed.destination !== to : !railPixels.has(pixel(x, y))) continue;
      const edge: Edge = { from: key, to, move, evidence: observed?.evidence };
      const incoming = reverse.get(to) ?? [];
      incoming.push(edge); reverse.set(to, incoming);
      if (!poses.has(to)) { poses.set(to, placement); queue.push(to); }
    }
  }
  if (poses.size === 1) return;

  const fieldOfWalk: NativeBox = [0, 0, rows[0]!.length - 1, rows.length - 1];
  const cornerPixels = ([x, y, r, b]: NativeBox) => [pixel(x, y), pixel(r, y), pixel(x, b), pixel(r, b)];
  const fixedFloor = (box: NativeBox) => cornerPixels(box).every(point => !occupied.has(point))
    && !!panelFootingEvidence(walker, rows, box);
  const baseline = peers.map(peer => new Set(reachablePanelFootings(walker, rows, fieldOfWalk, peer.marker, fixedFloor).map(box => box.join(','))));
  const targets: { key: string; goal: Candidate }[] = [];
  if (previous) {
    const key = panelTransportPose(previous.goal.placement);
    if (key !== current && poses.has(key)) targets.push({ key, goal: previous.goal });
  }
  for (const [key, placement] of targets.length ? [] : poses) {
    if (key === current) continue;
    const dx = placement.tool[0] - held.tool[0], dy = placement.tool[1] - held.tool[1];
    const projectedMask = new Set(mask.map(([x, y]) => pixel(x + dx, y + dy)));
    for (const [index, peer] of peers.entries()) {
      if (cornerPixels(peer.marker).some(point => projectedMask.has(point))) continue;
      const availableFloor = (box: NativeBox) => cornerPixels(box).every(point => !projectedMask.has(point)) && fixedFloor(box);
      const supported = (box: NativeBox) => availableFloor(box) || cornerPixels(box).every(point => projectedMask.has(point));
      const gain = reachablePanelFootings(walker, rows, fieldOfWalk, peer.marker, supported)
        .filter(box => availableFloor(box) && !baseline[index]!.has(box.join(','))).length;
      if (gain > 0) targets.push({ key, goal: { placement, marker: peer.marker, gain, evidence: peer.evidence } });
    }
  }
  targets.sort((a, b) => b.goal.gain - a.goal.gain);
  let best: { first: Edge; goal: Candidate; cost: number } | undefined;
  for (const { key, goal } of targets) {
    if (best && goal.gain < best.goal.gain) break;
    const seen = new Set([key]);
    const route = [{ key, depth: 0 }];
    for (const node of route) {
      if (node.depth + 1 >= budget) break;
      for (const edge of reverse.get(node.key) ?? []) {
        if (edge.from === current) {
          const cost = node.depth + 1 + edge.move.accessCost;
          if (cost <= budget && (!best || cost < best.cost)) best = { first: edge, goal, cost };
        } else if (!seen.has(edge.from)) {
          seen.add(edge.from);
          route.push({ key: edge.from, depth: node.depth + 1 });
        }
      }
    }
  }
  return best && { ...best, target: { goal: best.goal, railInk, railPixels: [...railPixels] } };
}
