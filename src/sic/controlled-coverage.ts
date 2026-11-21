import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import {
  neighbor,
  readTransport,
  sitePoint,
  type TransportMemory,
  poseId,
  type TransportSide,
  type TransportState,
  type TransportForecast,
  type TransportStep,
} from './transport-observations.ts';

type Grid = {
  pitch: number;
  left: number;
  top: number;
  columns: number;
  rows: number;
};
export type Motion = { dx: number; dy: number; ref: string };
export type PieceRelation = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  free: boolean;
  moved: boolean;
  ref: string;
};
export type Coverage = {
  grid: Grid;
  inks: [number, number];
  accent: number;
  counts: [[number, number], [number, number]];
  terrain: number[];
  controls: number[];
  goals: number[];
  gate: number;
  closed: number[];
  piece: number[];
  selection: string;
  motors: Record<string, Motion>;
  observations: [PieceRelation[], PieceRelation[]];
  tried: Record<string, true>;
  denied: Record<string, true>;
  discovery?: string;
  testContacts?: boolean;
  pullCandidate?: TransportSide;
  peerPush?: Partial<Record<TransportSide, string>>;
  refusedPeerPush?: Partial<Record<TransportSide, string>>;
  opening?: string;
  plan?: TransportStep[];
};
const count = (tile: readonly number[], ink: number) =>
  tile.filter((v) => v === ink).length;
const middle = (tile: readonly number[]) => tile[Math.floor(tile.length / 2)]!;
const ring = (tile: readonly number[]) =>
  middle(tile) !== tile[0] &&
  tile.every((v, i) => i === Math.floor(tile.length / 2) || v === tile[0]);
export const other = (side: TransportSide): TransportSide =>
  side === 0 ? 1 : 0;
function tiles(g: Grid, rows: NativeRows) {
  const result: number[][] = [];
  for (let y = 0; y < g.rows; y++)
    for (let x = 0; x < g.columns; x++) {
      const px = g.left + x * g.pitch,
        py = g.top + y * g.pitch,
        tile: number[] = [];
      for (let i = py; i < py + g.pitch; i++)
        for (let j = px; j < px + g.pitch; j++) tile.push(rows[i]![j]!);
      result.push(tile);
    }
  return result;
}
export function registerCoverage(
  rows: NativeRows,
  after: NativeRows,
  source: NativeBox,
  target: NativeBox,
  selection: string,
): Coverage | undefined {
  const pitch = source[2] - source[0] + 1;
  if (
    pitch < 2 ||
    pitch % 2 !== 1 ||
    [source, target].some(
      (b) => b[2] - b[0] + 1 !== pitch || b[3] - b[1] + 1 !== pitch,
    )
  )
    return;
  const left = source[0] % pitch,
    top = source[1] % pitch;
  if (target[0] % pitch !== left || target[1] % pitch !== top) return;
  const g = {
    pitch,
    left,
    top,
    columns: Math.floor((rows[0]!.length - left) / pitch),
    rows: Math.floor((rows.length - top) / pitch),
  };
  const base = tiles(g, rows),
    fresh = tiles(g, after);
  const anchors = [source, target].map(
    (b) => (b[0] - left) / pitch + (g.columns * (b[1] - top)) / pitch,
  );
  const [a, b] = anchors as [number, number];
  if (a === b || !base[a] || !base[b]) return;
  const accent = base[a].find(
    (v) =>
      !fresh[a]!.includes(v) && !base[b]!.includes(v) && fresh[b]!.includes(v),
  );
  if (accent === undefined) return;
  const groups = new Map<string, number[]>();
  base.forEach((tile, i) => {
    const k = tile.join(','),
      sites = groups.get(k) ?? [];
    sites.push(i);
    groups.set(k, sites);
  });
  const patterns = [...groups.values()];
  const grounds = patterns.filter((ns) => {
    const t = base[ns[0]!]!;
    return (
      t.every((v) => v === t[0]) &&
      [a, b].every((n) => base[n]!.includes(t[0]!))
    );
  });
  if (grounds.length !== 1) return;
  const ground = grounds[0]!,
    floor = base[ground[0]!]![0]!;
  const inks = anchors.map((n, i) => [
    ...new Set(
      base[n]!.filter(
        (v) =>
          v !== floor &&
          v !== accent &&
          fresh[n]!.includes(v) &&
          !base[anchors[1 - i]!]!.includes(v),
      ),
    ),
  ]);
  if (inks.some((v) => v.length !== 1)) return;
  const roleInks: [number, number] = [inks[0]![0]!, inks[1]![0]!];
  const counts = anchors.map((n, i) => [
    count(base[n]!, roleInks[i]!),
    count(fresh[n]!, roleInks[i]!),
  ]);
  const repeats = patterns.filter((s) => s.length === anchors.length);
  const exits = repeats.filter((s) => {
    const t = base[s[0]!]!;
    return ring(t) && middle(t) === floor;
  });
  const pieces = repeats.filter((s) => {
    const t = base[s[0]!]!;
    return ring(t) && middle(t) !== floor;
  });
  if (exits.length !== 1 || pieces.length !== 1) return;
  const goals = exits[0]!,
    objects = pieces[0]!,
    piece = base[objects[0]!]!;
  const switches = repeats.filter(
    (s) =>
      s !== goals &&
      s !== objects &&
      base[s[0]!]!.includes(floor) &&
      !s.some((n) => anchors.includes(n)),
  );
  if (switches.length !== 1) return;
  const controls = switches[0]!,
    colors = new Set(base[controls[0]!]!.filter((v) => v !== floor));
  const doors = patterns.filter(
    (ns) =>
      ns.length === 1 &&
      !anchors.includes(ns[0]!) &&
      base[ns[0]!]!.some((v) => colors.has(v)),
  );
  const terrain = [
      ...new Set([...ground, ...objects, ...anchors, ...controls, ...goals]),
    ],
    walk = new Set(terrain);
  function reachable(gate: number) {
    const q = [a],
      seen = new Set(q);
    for (const n of q)
      for (const [dx, dy] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const to = neighbor(g, n, dx, dy);
        if (to >= 0 && !seen.has(to) && (walk.has(to) || to === gate)) {
          seen.add(to);
          q.push(to);
        }
      }
    return goals.some((n) => seen.has(n));
  }
  if (reachable(-1)) return;
  const gates = doors.map((ns) => ns[0]!).filter(reachable);
  if (gates.length !== 1) return;
  const gate = gates[0]!;
  const m: Coverage = {
    grid: g,
    inks: roleInks,
    accent,
    counts: [
      [counts[0]![1]!, counts[0]![0]!],
      [counts[1]![0]!, counts[1]![1]!],
    ],
    terrain,
    controls,
    goals,
    gate,
    closed: base[gate]!,
    piece,
    selection,
    motors: {},
    observations: [[], []],
    tried: {},
    denied: {},
  };
  if (
    readCoverage(m, rows)?.active !== 0 ||
    readCoverage(m, after)?.active !== 1
  )
    return;
  return m;
}
export function registerCoverageFromControl(
  rows: NativeRows,
  after: NativeRows,
  m: TransportMemory,
  ref: string,
) {
  const view = readTransport(m, rows);
  if (!view) return;
  const box = (n: number): NativeBox => {
    const [x, y] = sitePoint(m.grid, n) as [number, number],
      h = Math.floor(m.grid.pitch / 2);
    return [x - h, y - h, x + h, y + h];
  };
  const c = registerCoverage(
    rows,
    after,
    box(view.subject[0]),
    box(view.subject[1]),
    ref,
  );
  if (!c) return;
  const state = readCoverage(c, after);
  if (!state) return;
  const ground = new Set(c.terrain);
  const directions = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  // When no push can dislodge a cornered piece, test whether drawing it away is possible.
  if (
    state.pieces.some((p) =>
      directions.every(
        ([dx, dy]) =>
          !ground.has(neighbor(c.grid, p, dx!, dy!)) ||
          !ground.has(neighbor(c.grid, p, -dx!, -dy!)),
      ),
    )
  )
    c.pullCandidate = state.active;
  return c;
}
export function readCoverage(
  c: Coverage,
  rows: NativeRows,
): TransportState | undefined {
  const board = tiles(c.grid, rows),
    subjects: [number[], number[]] = [[], []],
    active: TransportSide[] = [],
    pieces: number[] = [];
  for (const [n, t] of board.entries()) {
    const marked = t.includes(c.accent);
    for (const side of [0, 1] as const) {
      if (count(t, c.inks[side]) !== c.counts[side][marked ? 1 : 0]) continue;
      subjects[side].push(n);
      if (marked) active.push(side);
    }
    if (
      middle(t) === middle(c.piece) &&
      (count(t, c.piece[0]!) >= t.length / 3 || c.controls.includes(n))
    )
      pieces.push(n);
  }
  if (
    subjects.some((s) => s.length !== 1) ||
    active.length !== 1 ||
    pieces.length !== c.controls.length
  )
    return;
  return {
    subjects: [subjects[0][0]!, subjects[1][0]!],
    active: active[0]!,
    pieces,
    supports: [],
  };
}
export const maintained = (c: Coverage, s: TransportState) =>
  c.controls.every((n) => s.pieces.includes(n));
export function observeCoverage(
  c: Coverage,
  b: NativeRows,
  a: NativeRows,
  op: string,
  ref: string,
  f?: TransportForecast,
) {
  const before = readCoverage(c, b),
    after = readCoverage(c, a);
  if (!before || !after) {
    if (f) {
      c.denied[f.key] = true;
      delete c.plan;
      return 'coverage_observation_ambiguous';
    }
    return;
  }
  const side = before.active,
    peer = other(side),
    start = before.subjects[side],
    end = after.subjects[side],
    cols = c.grid.columns;
  if (/^ACTION[1-4]$/.test(op)) {
    c.tried[poseId(before) + '/' + op] = true;
    const dx = (end % cols) - (start % cols),
      dy = Math.floor(end / cols) - Math.floor(start / cols);
    const motor = c.motors[op],
      touch =
        motor &&
        neighbor(c.grid, start, motor.dx, motor.dy) === before.subjects[peer];
    if (c.testContacts && side === after.active && touch) {
      const dest = neighbor(c.grid, before.subjects[peer], motor.dx, motor.dy);
      if (end === before.subjects[peer] && after.subjects[peer] === dest)
        (c.peerPush ??= {})[side] = ref;
      else if (
        f?.coverage?.testPeerPush &&
        end === start &&
        after.subjects[peer] === before.subjects[peer]
      )
        (c.refusedPeerPush ??= {})[side] = ref;
    }
    if (
      side === after.active &&
      before.subjects[peer] === after.subjects[peer] &&
      Math.abs(dx) + Math.abs(dy) === 1
    ) {
      c.motors[op] = { dx, dy, ref };
      const data = c.observations[side];
      for (const p of before.pieces) {
        const to = neighbor(c.grid, p, dx, dy);
        const free =
          c.terrain.includes(to) &&
          !before.pieces.includes(to) &&
          to !== before.subjects[peer] &&
          (to !== start || end !== start);
        if (!free) continue;
        const moved = !after.pieces.includes(p) && after.pieces.includes(to);
        const x = (p % cols) - (start % cols),
          y = Math.floor(p / cols) - Math.floor(start / cols);
        if (moved) c.discovery ??= ref;
        if (
          !data.some(
            (o) =>
              o.x === x &&
              o.y === y &&
              o.dx === dx &&
              o.dy === dy &&
              o.moved === moved,
          )
        )
          data.push({ x, y, dx, dy, free, moved, ref });
      }
    }
  }
  if (
    maintained(c, after) &&
    !maintained(c, before) &&
    !after.subjects.includes(c.gate)
  ) {
    const t = tiles(c.grid, a)[c.gate]!;
    if (t.some((v, j) => v !== c.closed[j] && !c.inks.includes(v)))
      c.opening = ref;
  }
  if (f) {
    if (f.purpose === 'measure_direction_for_coverage')
      return c.motors[op]
        ? 'coverage_direction_observed'
        : 'coverage_direction_unresolved';
    if (poseId(after) !== poseId(f.expected)) {
      c.denied[f.key] = true;
      delete c.plan;
      return 'coverage_prediction_refuted';
    }
    if (c.plan?.[0]?.command === op) c.plan.shift();
    return 'coverage_prediction_verified';
  }
}
