import { fixedPortRule, fixedStrokePorts } from '../logos-engine/v6-fixed-origin.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Ports = (number | null)[];
type Direction = 0 | 1 | 2 | 3;
type Track = [Ports, Ports, Ports, Ports];
export type NeighborProgramPlan = { origin: number; repellers: number[]; arrivals: number[] };
type Forecast = Omit<NeighborProgramPlan, 'origin'>;
const opposite: Direction[] = [1, 0, 3, 2];
const horizontal: Direction[][] = [[0, 1], [1, 0]];
const vertical: Direction[][] = [[2, 3], [3, 2]];
const priorities = horizontal.flatMap(x => vertical.flatMap(y => [[...x, ...y], [...y, ...x]]));

export function reflectedInstruction(rows: NativeRows, [left, top, right, bottom]: number[]): string {
  const interior = rows.slice(top! + 1, bottom!).map(row => row.slice(left! + 1, right!).reverse());
  const inks = new Map<number, number>();
  for (const row of interior) for (const ink of row) inks.set(ink, (inks.get(ink) ?? 0) + 1);
  const background = [...inks].sort((a, b) => b[1] - a[1])[0]?.[0];
  return symbolicDigest(interior.flatMap((row, y) => row.flatMap((ink, x) => ink === background ? [] : [[y, x]])));
}

function visibleTracks(rows: NativeRows, nodes: number[][], direction: number): Ports[] {
  const strokes = fixedStrokePorts(rows, nodes, direction);
  const tables = Object.keys(strokes).map(ink => fixedPortRule(nodes, ['stroke_priority', direction, Number(ink)], null, { [direction]: strokes }));
  return [...new Map(tables.map(table => [JSON.stringify(table), table])).entries()]
    .sort(([a], [b]) => a.localeCompare(b)).map(([, table]) => table);
}

function forecast(start: number, count: number, tracks: Track, toward: Direction, priority: Direction[],
  repelling: ReadonlySet<number>, hazards: ReadonlySet<number>): Forecast {
  let here = start;
  const arrivals: number[] = [];
  const used = new Set<number>();
  for (let step = 0; step < count; step++) {
    const next = tracks[toward][here] ?? null;
    if (next !== null && repelling.has(next)) used.add(next);
    else if (next !== null) {
      here = next;
      if (hazards.has(here)) break;
      const visited = new Set([here]);
      while (true) {
        const facing = priority.find(direction => repelling.has(tracks[direction][here] ?? -1));
        if (facing === undefined) break;
        const pushed = tracks[opposite[facing]!][here] ?? null;
        if (pushed === null || repelling.has(pushed) || visited.has(pushed)) break;
        used.add(tracks[facing][here]!);
        here = pushed;
        if (hazards.has(here)) break;
        visited.add(here);
      }
      if (hazards.has(here)) break;
    }
    arrivals.push(here);
  }
  return { arrivals, repellers: [...used] };
}

export function planNeighborProgram(rows: NativeRows, nodes: number[][], count: number, direction: -1 | 1,
  fills: (number | null)[], common: number, target: number, blockedFills: number[], attempted: number[]): NeighborProgramPlan | null {
  const marked = new Map<number, number[]>();
  const hazards = new Set<number>();
  for (const [node, fill] of fills.entries()) {
    if (fill === null || fill === common || node === target) continue;
    if (blockedFills.includes(fill)) hazards.add(node);
    else marked.set(fill, [...(marked.get(fill) ?? []), node]);
  }
  const groups = [...marked.values()].filter(nodes => nodes.length > 1);
  if (groups.length !== 1) return null;
  const repelling = new Set(groups[0]!);
  const upward = visibleTracks(rows, nodes, -1), downward = visibleTracks(rows, nodes, 1);
  if (!upward.length || !downward.length || upward.length * downward.length > 16) return null;
  const left = fixedPortRule(nodes, ['cyclic_order', -1, 1]), right = fixedPortRule(nodes, ['cyclic_order', 1, 1]);
  const toward = direction === -1 ? 0 : 1;
  const support = new Map<number, { count: number; prediction: Forecast }>();
  const empty = new Set<number>();
  const neutral: Track = [left, right, [], []];
  for (const [origin, fill] of fills.entries()) {
    if (fill !== common || attempted.includes(origin)) continue;
    if (forecast(origin, count, neutral, toward, [], empty, hazards).arrivals.at(-1) === target) continue;
    for (const up of upward) for (const down of downward) for (const priority of priorities) {
      const prediction = forecast(origin, count, [left, right, up, down], toward, priority, repelling, hazards);
      const { arrivals } = prediction;
      if (arrivals.length !== count || arrivals.at(-1) !== target) continue;
      const previous = support.get(origin);
      support.set(origin, { count: (previous?.count ?? 0) + 1, prediction: previous?.prediction ?? prediction });
    }
  }
  const best = [...support].sort((a, b) => b[1].count - a[1].count || a[0] - b[0])[0];
  return best ? { origin: best[0], ...best[1].prediction } : null;
}
