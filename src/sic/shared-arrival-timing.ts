import { configuredCrosses, configuredRoute, configuredTrajectories, type ConfiguredScene } from '../logos-engine/v6-configured-arrivals.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Point = [number, number];
type Gate = { point: Point; open: boolean; mark: string };
type GateEdit = { point: Point; toggles: Point[] };
export type GateEffects = Readonly<Record<string, Point[]>>;
export type TimedNetwork = { gates: Gate[]; pads: Map<string, string>; nodes: Set<string> };
export type ArrivalTiming = { orders: Point[][]; delays: Record<string, number>; observed: (number | null)[] };
const key = (point: Point) => point.join(',');
const cardinals: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const permutations = (points: Point[]): Point[][] => points.length === 0 ? [[]]
  : points.flatMap((point, index) => permutations(points.filter((_, i) => i !== index)).map(rest => [point, ...rest]));
const orders = permutations(cardinals);
const axes = [
  { pips: [1, 7], strips: [0, 2, 3, 5, 6, 8] },
  { pips: [3, 5], strips: [0, 1, 2, 6, 7, 8] },
];

export function timedNetwork(scene: ConfiguredScene): TimedNetwork | null {
  if (scene.actors.length < 3) return null;
  const gates: Gate[] = [], pads = new Map<string, string>(), nodes = new Set(scene.base);
  const occupied = new Set([key(scene.target), ...scene.actors.map(([, x, y]) => key([x, y]))]);
  for (const [position, cell] of scene.cells) {
    if (occupied.has(position)) continue;
    const patch: number[] = cell.patch.flat();
    const center = patch[4]!;
    for (const [axis, { pips, strips }] of axes.entries()) {
      const open = cell.open && patch[pips[0]!] === patch[pips[1]!] && !scene.background.has(patch[pips[0]!]!)
        && patch.every((ink, index) => pips.includes(index) || index === 4 || ink === scene.floor);
      const closed = !cell.open && !scene.background.has(patch[strips[0]!]!)
        && patch.every((ink, index) => ink === (strips.includes(index) ? patch[strips[0]!] : center));
      if (open || (closed && scene.background.has(center))) {
        gates.push({ point: cell.point, open, mark: axis + '/' + (open ? patch[pips[0]!] : patch[strips[0]!]) });
        break;
      }
    }
    const singleMark = !scene.background.has(center) && patch[0] !== scene.floor && patch[0] !== center
      && patch.every((ink, index) => index === 4 || ink === patch[0]);
    const pairedMark = axes.some(({ pips }) => center !== scene.floor && patch[pips[0]!] !== center && !scene.background.has(patch[pips[0]!]!)
      && patch.every((ink, index) => ink === (pips.includes(index) ? patch[pips[0]!] : center)));
    if (singleMark || pairedMark) {
      pads.set(position, patch.join(','));
      nodes.add(position);
    }
  }
  return pads.size && gates.length && gates.length <= 8 ? { gates, pads, nodes } : null;
}

function visiblePrefixes(scene: ConfiguredScene, frames: readonly NativeRows[]): Map<number, Point[]> {
  const [pitch, left, top] = scene.grid, poses = frames.map(configuredCrosses);
  return new Map(scene.actors.map(([color, x, y]) => {
    const path: Point[] = [[x, y]];
    for (const frame of poses) {
      const matches = frame.filter(([value, a, b]) => value === color && a % pitch === left && b % pitch === top);
      if (matches.length !== 1) continue;
      const [, a, b] = matches[0]!, [u, v] = path.at(-1)!;
      const distance = Math.abs(a - u) + Math.abs(b - v);
      if (distance === 0) continue;
      if (distance !== pitch || path.some(point => key(point) === key([a, b]))) break;
      path.push([a, b]);
      if (key([a, b]) === key(scene.target)) break;
    }
    return [color, path];
  }));
}

function prefixDelay(network: TimedNetwork, delays: Readonly<Record<string, number>>, positions: readonly string[]): number | null {
  let total = 0;
  for (const position of positions) {
    const pad = network.pads.get(position);
    if (!pad) continue;
    const dwell = delays[pad];
    if (dwell === undefined) return null;
    total += dwell;
  }
  return total;
}

export function measureArrivalTiming(scene: ConfiguredScene, network: TimedNetwork, frames: readonly NativeRows[],
  inherited?: Readonly<Record<string, number>>): ArrivalTiming | null {
  const paths = configuredTrajectories(scene, frames);
  const partial = paths.size !== scene.actors.length;
  if (!paths.size || partial && !inherited) return null;
  const intervals = new Map<number, number>();
  for (const [, times] of paths.values()) {
    for (let i = 1; i < times.length; i++) {
      const samples = times[i]! - times[i - 1]!;
      intervals.set(samples, (intervals.get(samples) ?? 0) + 1);
    }
  }
  const baseline = [...intervals].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  if (!baseline) return null;
  const delays: Record<string, number> = {};
  for (const [path, times] of paths.values()) {
    for (let i = 0; i < times.length - 1; i++) {
      const pad = network.pads.get(key(path[i]!));
      const dwell = (times[i + 1]! - times[i]!) / baseline - 1;
      if (!Number.isInteger(dwell) || dwell < 0 || (!pad && dwell > 0)) return null;
      if (!pad) continue;
      if (Object.hasOwn(delays, pad) && delays[pad] !== dwell) return null;
      delays[pad] = dwell;
    }
  }
  const retained = { ...inherited, ...delays };
  if (!Object.values(retained).some(dwell => dwell > 0)) return null;
  const prefixes = partial ? visiblePrefixes(scene, frames) : null;
  const compatible = orders.filter(order => {
    const projected = scene.actors.map(([, x, y]) => configuredRoute(network.nodes, [x, y], scene.target, order, scene.grid[0])?.map(key));
    return scene.actors.every(([color], i) => {
      const route = projected[i], complete = paths.get(color);
      if (!route) return false;
      if (complete) return route.join(';') === complete[0].map(key).join(';');
      const prefix = prefixes?.get(color)?.map(key);
      if (!prefix || prefix.length < 2 || prefix.length >= route.length || !prefix.every((position, j) => route[j] === position)) return false;
      const delay = prefixDelay(network, retained, prefix);
      if (delay === null) return false;
      // Pieces can share the remaining visible cells only if they reach the merge together.
      return projected.some((other, j) => j !== i && other?.length === route.length
        && route.slice(prefix.length).every((position, k) => position === other[prefix.length + k])
        && delay === prefixDelay(network, retained, other.slice(0, prefix.length)));
    });
  });
  if (!compatible.length) return null;
  const observed = scene.actors.map(([color]) => {
    const frame = paths.get(color)?.[1].at(-1);
    return frame === undefined ? null : frame / baseline;
  });
  return { orders: compatible, delays: retained, observed };
}

function gateEdits(network: TimedNetwork, effects: GateEffects | undefined, rejected: readonly string[]): GateEdit[] {
  return network.gates.flatMap(gate => {
    const id = key(gate.point);
    if (rejected.includes(id)) return [];
    const measured = effects?.[id];
    if (measured) return [{ point: gate.point, toggles: measured }];
    const peers = effects && network.gates.filter(other => other.mark === gate.mark);
    if (!peers || peers.length !== 2 || peers[0]!.open === peers[1]!.open
      || peers.some(peer => effects?.[key(peer.point)])) return [{ point: gate.point, toggles: [gate.point] }];
    const candidates = peers.filter(peer => !rejected.includes(key(peer.point)));
    const trial = candidates.find(peer => !peer.open) ?? candidates[0];
    return gate === trial ? [{ point: gate.point, toggles: peers.map(peer => peer.point) }] : [];
  });
}

export function planTimedArrival(scene: ConfiguredScene, network: TimedNetwork, timing: ArrivalTiming, remaining: number,
  effects?: GateEffects, rejected: readonly string[] = []) {
  let best: { edits: GateEdit[]; ticks: number[]; matchingOrders: number } | null = null;
  const controls = gateEdits(network, effects, rejected);
  for (let mask = 0; mask < 2 ** controls.length; mask++) {
    const edits = controls.filter((_, index) => (mask & (1 << index)) !== 0);
    if (edits.length + 1 > remaining || (best?.matchingOrders === timing.orders.length && edits.length >= best.edits.length)) continue;
    const nodes = new Set(network.nodes);
    for (const edit of edits) for (const gate of edit.toggles) {
      const id = key(gate);
      if (nodes.has(id)) nodes.delete(id);
      else nodes.add(id);
    }
    const ticks = new Set<number>();
    let matchingOrders = 0;
    for (const order of timing.orders) {
      const arrivals = scene.actors.map(([, x, y]) => {
        const path = configuredRoute(nodes, [x, y], scene.target, order, scene.grid[0]);
        if (!path) return null;
        let tick = path.length - 1;
        for (const point of path.slice(0, -1)) {
          const pad = network.pads.get(key(point));
          if (!pad) continue;
          const dwell = timing.delays[pad];
          if (dwell === undefined) return null;
          tick += dwell;
        }
        return tick;
      });
      const first = arrivals[0];
      if (first != null && arrivals.every(tick => tick === first)) {
        ticks.add(first);
        matchingOrders++;
      }
    }
    if (!matchingOrders || (best && (best.matchingOrders > matchingOrders
      || (best.matchingOrders === matchingOrders && best.edits.length <= edits.length)))) continue;
    best = { edits, ticks: [...ticks].sort((a, b) => a - b), matchingOrders };
    if (!edits.length && matchingOrders === timing.orders.length) break;
  }
  return best;
}
