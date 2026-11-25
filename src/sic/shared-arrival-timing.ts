import { configuredCrosses, configuredDistances, configuredPatch, configuredRoute, configuredTrajectories, type ConfiguredScene } from '../logos-engine/v6-configured-arrivals.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { inferCycleAfterTransient, inferObservedCycle, type CycleEvidence } from './observed-cycle.ts';

type Point = [number, number];
type Gate = { point: Point; open: boolean; mark: string };
type GateEdit = { point: Point; toggles: Point[] };
export type GateEffects = Readonly<Record<string, Point[]>>;
type ClockMark = { point: Point; mark: string };
export type TimedNetwork = { gates: Gate[]; pads: Map<string, string>; clocks: Map<string, ClockMark>; nodes: Set<string> };
export type ArrivalTiming = { orders: Point[][]; delays: Record<string, number>; observed: (number | null)[];
  clocks?: Record<string, boolean[]>; clockPrefixes?: Record<string, (boolean | null)[]>; clockEvidence?: Record<string, CycleEvidence> };
const key = (point: Point) => point.join(',');
const oneStep = (from: string, to: string, pitch: number) => {
  const [x, y] = from.split(',').map(Number) as Point, [u, v] = to.split(',').map(Number) as Point;
  return Math.abs(x - u) + Math.abs(y - v) === pitch;
};
const cardinals: Point[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const permutations = (points: Point[]): Point[][] => points.length === 0 ? [[]]
  : points.flatMap((point, index) => permutations(points.filter((_, i) => i !== index)).map(rest => [point, ...rest]));
const orders = permutations(cardinals);
// The planner checks subsets of controls, so cap the wider clocked search at 16,384 configurations.
const timedGateLimits = { independent: 8, withClocks: 14 };
const axes = [
  { pips: [1, 7], strips: [0, 2, 3, 5, 6, 8] },
  { pips: [3, 5], strips: [0, 1, 2, 6, 7, 8] },
];

function clockAppearance(scene: ConfiguredScene, patch: readonly number[]) {
  const center = patch[4]!;
  if (scene.background.has(center)) return null;
  for (const [axis, { pips, strips }] of axes.entries()) {
    const pip = patch[pips[0]!]!;
    if (pip !== patch[pips[1]!]) continue;
    if (pip !== center && !scene.background.has(pip) && strips.every(index => patch[index] === scene.floor)) {
      return { mark: axis + '/' + pip, open: true };
    }
    if (scene.background.has(pip) && pip !== scene.floor && strips.every(index => patch[index] === center)) {
      return { mark: axis + '/' + center, open: false };
    }
  }
  return null;
}

export function timedNetwork(scene: ConfiguredScene): TimedNetwork | null {
  if (scene.actors.length < 3) return null;
  const gates: Gate[] = [], pads = new Map<string, string>(), clocks = new Map<string, ClockMark>(), nodes = new Set(scene.base);
  const occupied = new Set([key(scene.target), ...scene.actors.map(([, x, y]) => key([x, y]))]);
  for (const [position, cell] of scene.cells) {
    if (occupied.has(position)) continue;
    const patch: number[] = cell.patch.flat();
    const clock = clockAppearance(scene, patch);
    if (clock) {
      clocks.set(position, { point: cell.point, mark: clock.mark });
      nodes.add(position);
      continue;
    }
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
  const gateLimit = clocks.size ? timedGateLimits.withClocks : timedGateLimits.independent;
  return pads.size && gates.length && gates.length <= gateLimit ? { gates, pads, clocks, nodes } : null;
}

function arrivalTicks(path: readonly Point[], network: TimedNetwork, timing: Pick<ArrivalTiming, 'delays' | 'clocks' | 'clockPrefixes'>): number[] | null {
  const ticks = [0];
  for (let i = 1; i < path.length; i++) {
    const pad = network.pads.get(key(path[i - 1]!)), dwell = pad ? timing.delays[pad] : 0;
    if (dwell === undefined) return null;
    let attempted = ticks[i - 1]! + dwell + 1;
    const destination = key(path[i]!), cycle = timing.clocks?.[destination];
    if (network.clocks.has(destination)) {
      if (!cycle?.includes(true)) return null;
      const prefix = timing.clockPrefixes?.[destination] ?? [];
      while (attempted < prefix.length && prefix[attempted] === false) attempted++;
      if (attempted < prefix.length) {
        if (prefix[attempted] !== true) return null;
      } else {
        while (!cycle[(attempted - prefix.length) % cycle.length]) attempted++;
      }
    }
    ticks.push(attempted);
  }
  return ticks;
}

function measureClockedTiming(scene: ConfiguredScene, network: TimedNetwork, frames: readonly NativeRows[], baseline: number,
  paths: ReturnType<typeof configuredTrajectories>, inherited?: Readonly<Record<string, number>>): ArrivalTiming | null {
  const last = Math.max(...[...paths.values()].map(([, times]) => times.at(-1)!));
  const ticks = frames.slice(0, last + 1).filter((_, index) => index % baseline === 0);
  const clocks: Record<string, boolean[]> = {};
  const clockPrefixes: Record<string, (boolean | null)[]> = {};
  const clockEvidence: Record<string, CycleEvidence> = {};
  for (const [id, { point, mark }] of network.clocks) {
    const samples = ticks.map(frame => {
      const appearance = clockAppearance(scene, configuredPatch(frame, point).flat());
      return appearance?.mark === mark ? appearance.open : null;
    });
    const cycle = inferObservedCycle(samples, { minimumPeriod: 2, minimumWitnesses: 2 });
    if (cycle?.phases.includes(true) && cycle.phases.includes(false)) {
      clocks[id] = cycle.phases;
      continue;
    }
    const steady = inferCycleAfterTransient(samples);
    if (!steady) return null;
    const { phases, ...evidence } = steady;
    clocks[id] = phases;
    clockPrefixes[id] = samples.slice(0, evidence.start);
    clockEvidence[id] = evidence;
  }
  const [pitch, left, top] = scene.grid;
  const positions = ticks.map(frame => configuredCrosses(frame)
    .filter(([, x, y]) => x % pitch === left && y % pitch === top));
  const traces = scene.actors.map(([color]) => positions.map(frame => {
    const matches = frame.filter(([ink]) => ink === color);
    return matches.length === 1 ? key([matches[0]![1], matches[0]![2]]) : null;
  }));
  const observedDelays: Record<string, number> = {};
  for (const trace of traces) {
    for (let start = 1; start < trace.length; start++) {
      const landed = trace[start], previous = trace[start - 1];
      const pad = landed && network.pads.get(landed);
      if (!landed || !pad || !previous || !oneStep(previous, landed, pitch)) continue;
      let next = start + 1;
      while (trace[next] === landed) next++;
      const nextPosition = trace[next];
      if (!nextPosition || !oneStep(landed, nextPosition, pitch) || network.clocks.has(nextPosition)) continue;
      const dwell = next - start - 1;
      if (Object.hasOwn(observedDelays, pad) && observedDelays[pad] !== dwell) return null;
      observedDelays[pad] = dwell;
    }
  }
  const delays = { ...inherited, ...observedDelays };
  const distances = configuredDistances(network.nodes, scene.target, pitch);
  const compatible = orders.filter(order => scene.actors.every(([, x, y], i) => {
    const path = configuredRoute(network.nodes, [x, y], scene.target, order, pitch, distances);
    const dates = path && arrivalTicks(path, network, { delays, clocks, clockPrefixes });
    if (!path || !dates || traces[i]!.filter(Boolean).length < 2) return false;
    let position = 0;
    return traces[i]!.every((observed, tick) => {
      while (position + 1 < dates.length && dates[position + 1]! <= tick) position++;
      return observed === null || observed === key(path[position]!);
    });
  }));
  if (!compatible.length) return null;
  const observed = scene.actors.map(([color]) => {
    const frame = paths.get(color)?.[1].at(-1);
    return frame === undefined ? null : frame / baseline;
  });
  return { orders: compatible, delays, observed, clocks,
    ...(Object.keys(clockPrefixes).length ? { clockPrefixes, clockEvidence } : {}) };
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
  if (!paths.size || partial && !inherited && !network.clocks.size) return null;
  const intervals = new Map<number, number>();
  for (const [, times] of paths.values()) {
    for (let i = 1; i < times.length; i++) {
      const samples = times[i]! - times[i - 1]!;
      intervals.set(samples, (intervals.get(samples) ?? 0) + 1);
    }
  }
  const baseline = [...intervals].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  if (!baseline) return null;
  if (network.clocks.size) return measureClockedTiming(scene, network, frames, baseline, paths, inherited);
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
  effects?: GateEffects, rejected: readonly string[] = [], interrupted: () => boolean = () => false) {
  let best: { edits: GateEdit[]; ticks: number[]; matchingOrders: number } | null = null;
  const controls = gateEdits(network, effects, rejected);
  for (let mask = 0; mask < 2 ** controls.length; mask++) {
    if ((mask & 63) === 0 && interrupted()) return null;
    const edits = controls.filter((_, index) => (mask & (1 << index)) !== 0);
    if (edits.length + 1 > remaining || (best?.matchingOrders === timing.orders.length && edits.length >= best.edits.length)) continue;
    const nodes = new Set(network.nodes);
    for (const edit of edits) for (const gate of edit.toggles) {
      const id = key(gate);
      if (nodes.has(id)) nodes.delete(id);
      else nodes.add(id);
    }
    const ticks = new Set<number>(), distances = configuredDistances(nodes, scene.target, scene.grid[0]);
    let matchingOrders = 0;
    for (const order of timing.orders) {
      const arrivals = scene.actors.map(([, x, y]) => {
        const path = configuredRoute(nodes, [x, y], scene.target, order, scene.grid[0], distances);
        return path ? arrivalTicks(path, network, timing)?.at(-1) ?? null : null;
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
