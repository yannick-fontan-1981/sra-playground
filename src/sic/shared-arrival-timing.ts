import { configuredRoute, configuredTrajectories, type ConfiguredScene } from '../logos-engine/v6-configured-arrivals.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Point = [number, number];
type Gate = { point: Point; open: boolean };
export type TimedNetwork = { gates: Gate[]; pads: Map<string, string>; nodes: Set<string> };
export type ArrivalTiming = { orders: Point[][]; delays: Record<string, number>; observed: number[] };
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
    for (const { pips, strips } of axes) {
      const open = cell.open && patch[pips[0]!] === patch[pips[1]!] && !scene.background.has(patch[pips[0]!]!)
        && patch.every((ink, index) => pips.includes(index) || index === 4 || ink === scene.floor);
      const closed = !cell.open && !scene.background.has(patch[strips[0]!]!)
        && patch.every((ink, index) => ink === (strips.includes(index) ? patch[strips[0]!] : center));
      if (open || (closed && scene.background.has(center))) {
        gates.push({ point: cell.point, open });
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

export function measureArrivalTiming(scene: ConfiguredScene, network: TimedNetwork, frames: readonly NativeRows[]): ArrivalTiming | null {
  const paths = configuredTrajectories(scene, frames);
  if (paths.size !== scene.actors.length) return null;
  const compatible = orders.filter(order => scene.actors.every(([color, x, y]) => {
    const projected = configuredRoute(network.nodes, [x, y], scene.target, order, scene.grid[0]);
    return projected?.map(key).join(';') === paths.get(color)![0].map(key).join(';');
  }));
  if (!compatible.length) return null;
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
  if (!Object.values(delays).some(dwell => dwell > 0)) return null;
  const observed = scene.actors.map(([color]) => paths.get(color)![1].at(-1)! / baseline);
  return { orders: compatible, delays, observed };
}

export function planTimedArrival(scene: ConfiguredScene, network: TimedNetwork, timing: ArrivalTiming, remaining: number) {
  let best: { edits: Gate[]; ticks: number[]; matchingOrders: number } | null = null;
  for (let mask = 0; mask < 2 ** network.gates.length; mask++) {
    const edits = network.gates.filter((_, index) => (mask & (1 << index)) !== 0);
    if (edits.length + 1 > remaining || (best?.matchingOrders === timing.orders.length && edits.length >= best.edits.length)) continue;
    const nodes = new Set(network.nodes);
    for (const gate of edits) {
      if (gate.open) nodes.delete(key(gate.point));
      else nodes.add(key(gate.point));
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
