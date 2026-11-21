import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import {
  neighbor,
  poseId,
  readTransport,
  sitePoint,
  tileUniform,
  type TransportMemory,
  type TransportSide,
  type TransportState,
  type TransportForecast,
  type TransportStep,
} from './transport-observations.ts';
type Corridor = {
  material: number[];
  approach: number[];
  dx: number;
  dy: number;
};
export type Crossing = {
  floor: number[];
  goals: number[];
  gate: number;
  control: number;
  closed: string;
  piece: string;
  material: number[];
  corridors: Corridor[];
  destination: number[];
  initialPusher: TransportSide;
  selection: string;
  supports: number[];
  opened?: string;
  built?: string;
  chain?: string;
  contact?: string;
  denied: Record<string, true>;
  plan?: TransportStep[];
};
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const other = (s: TransportSide): TransportSide => (s === 0 ? 1 : 0);
const ink = (k: string) => k.split(',');
const core = (k: string) => {
  const a = ink(k),
    h = Math.floor(a.length / 2);
  return a[0] !== a[h] && a.every((v, i) => i === h || v === a[0]);
};
function region(m: TransportMemory, walk: Set<number>, start: number) {
  const seen = new Set([start]),
    queue = [start];
  for (const p of queue)
    for (const [dx, dy] of directions) {
      const n = neighbor(m.grid, p, dx, dy);
      if (walk.has(n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  return seen;
}
export function registerCrossing(
  m: TransportMemory,
  rows: NativeRows,
): Crossing | undefined {
  const r = readTransport(m, rows);
  if (!r) return;
  const byForm = new Map<string, number[]>();
  r.tiles.forEach((k, i) => {
    const v = byForm.get(k) ?? [];
    v.push(i);
    byForm.set(k, v);
  });
  const forms = [...byForm.keys()],
    grounds = forms.filter(
      (k) =>
        tileUniform(k) &&
        r.subject.every((n) => ink(r.tiles[n]!).includes(ink(k)[0]!)),
    );
  if (grounds.length !== 1) return;
  const floor = grounds[0]!,
    ground = ink(floor)[0]!,
    rings = forms.filter(core);
  const goals = rings.filter(
    (k) =>
      byForm.get(k)!.length === r.subject.length &&
      ink(k)[Math.floor(ink(k).length / 2)] === ground,
  );
  const cargo = rings.filter(
    (k) =>
      byForm.get(k)!.length > 1 &&
      ink(k)[Math.floor(ink(k).length / 2)] !== ground,
  );
  if (goals.length !== 1 || cargo.length !== 1) return;
  const exits = byForm.get(goals[0]!)!,
    piece = cargo[0]!,
    objects = byForm.get(piece)!;
  const pitch = m.grid.pitch,
    h = Math.floor(pitch / 2);
  const switches = forms.filter((k) => {
    if (byForm.get(k)!.length !== 1 || r.subject.includes(byForm.get(k)![0]!))
      return false;
    return ink(k).every((v, i) =>
      i % pitch === h || Math.floor(i / pitch) === h
        ? v !== ground
        : v === ground,
    );
  });
  if (switches.length !== 1) return;
  const sw = switches[0]!,
    control = byForm.get(sw)![0]!,
    pigments = new Set(ink(sw).filter((v) => v !== ground));
  const gates = forms.filter(
    (k) =>
      k !== sw &&
      byForm.get(k)!.length === 1 &&
      !r.subject.includes(byForm.get(k)![0]!) &&
      ink(k).some((v) => pigments.has(v)),
  );
  if (gates.length !== 1) return;
  const closed = gates[0]!,
    gate = byForm.get(closed)![0]!,
    terrain = [
      ...new Set([
        ...byForm.get(floor)!,
        ...objects,
        ...exits,
        ...r.subject,
        control,
      ]),
    ];
  const walk = new Set([...terrain, gate]),
    dest = region(m, walk, exits[0]!);
  if (!exits.every((p) => dest.has(p)) || r.subject.some((n) => dest.has(n)))
    return;
  const regions = r.subject.map((n) => region(m, walk, n));
  const paths = new Map<string, { r: Corridor; side: TransportSide }[]>();
  for (const side of [0, 1] as const)
    for (const bank of regions[side]!)
      for (const [dx, dy] of directions) {
        let n = neighbor(m.grid, bank, dx, dy);
        const glyph = r.tiles[n];
        if (!glyph || !tileUniform(glyph) || glyph === floor) continue;
        const material = [];
        while (n >= 0 && r.tiles[n] === glyph) {
          material.push(n);
          n = neighbor(m.grid, n, dx, dy);
        }
        if (material.length === 0 || !dest.has(n)) continue;
        const approach = [];
        n = bank;
        while (n >= 0 && regions[side]!.has(n)) {
          approach.push(n);
          n = neighbor(m.grid, n, -dx, -dy);
        }
        if (approach.length < 2) continue;
        const list = paths.get(glyph) ?? [];
        list.push({ side, r: { material, approach, dx, dy } });
        paths.set(glyph, list);
      }
  const candidates = [...paths.entries()].filter(([, v]) =>
    v.some(
      (p) =>
        p.r.material.length > 1 &&
        p.r.approach.some((n) => objects.includes(n)),
    ),
  );
  if (candidates.length !== 1) return;
  const [medium, pathsToGoal] = candidates[0]!,
    likely = [
      ...new Set(
        pathsToGoal
          .filter((p) => p.r.approach.some((n) => objects.includes(n)))
          .map((p) => p.side),
      ),
    ];
  if (likely.length !== 1) return;
  return {
    floor: terrain,
    goals: exits,
    gate,
    control,
    closed,
    piece,
    material: byForm.get(medium)!,
    corridors: pathsToGoal.filter((p) => p.side === likely[0]).map((p) => p.r),
    destination: [...dest],
    initialPusher: likely[0]!,
    selection: m.selection,
    supports: [],
    denied: {},
  };
}
export function crossingState(
  c: Crossing,
  m: TransportMemory,
  r: NonNullable<ReturnType<typeof readTransport>>,
): TransportState {
  const center = Math.floor(m.grid.pitch ** 2 / 2),
    middle = ink(c.piece)[center];
  return {
    subjects: r.subject,
    active: m.active,
    supports: [...c.supports],
    pieces: r.tiles.flatMap((k, n) =>
      k === c.piece ||
      (n === c.control && !r.subject.includes(n) && ink(k)[center] === middle)
        ? [n]
        : [],
    ),
  };
}
const held = (c: Crossing, s: TransportState) =>
  s.subjects.includes(c.control) || s.pieces.includes(c.control);
export function observeCrossing(
  c: Crossing,
  m: TransportMemory,
  b: NativeRows,
  a: NativeRows,
  op: string,
  ref: string,
  f?: TransportForecast,
) {
  const before = readTransport(m, b),
    after = readTransport(m, a);
  if (!before || !after) {
    if (f) {
      delete c.plan;
      c.denied[f.key] = true;
      return 'crossing_observation_ambiguous';
    }
    return;
  }
  const s = crossingState(c, m, before),
    n = crossingState(c, m, after),
    side = m.active,
    motor = m.motors[op];
  if (!held(c, s) && held(c, n) && after.tiles[c.gate] !== c.closed)
    c.opened ??= ref;
  if (motor && s.subjects[other(side)] === n.subjects[other(side)]) {
    const first = neighbor(m.grid, s.subjects[side], motor.dx, motor.dy);
    if (n.subjects[side] === first && s.pieces.includes(first)) {
      let end = first,
        length = 0;
      while (s.pieces.includes(end)) {
        length++;
        end = neighbor(m.grid, end, motor.dx, motor.dy);
      }
      if (!n.pieces.includes(first) && n.pieces.includes(end)) {
        c.contact ??= ref;
        if (length > 1) c.chain ??= ref;
      }
      if (
        n.pieces.length === s.pieces.length - 1 &&
        c.material.includes(end) &&
        !c.supports.includes(end) &&
        before.tiles[end] !== after.tiles[end] &&
        !tileUniform(after.tiles[end]!)
      ) {
        c.supports.push(end);
        c.supports.sort((a, b) => a - b);
        c.built ??= ref;
        if (length > 1) c.chain ??= ref;
      }
    }
  }
  if (f) {
    const observed = crossingState(c, m, after);
    if (poseId(observed) !== poseId(f.expected)) {
      c.denied[f.key] = true;
      delete c.plan;
      return 'crossing_prediction_refuted';
    }
    if (c.plan?.[0]?.command === op) c.plan.shift();
    return 'crossing_prediction_verified';
  }
}
type SearchNode = {
  s: TransportState;
  cost: number;
  rank: number;
  parent?: SearchNode;
  op?: string;
  side?: TransportSide;
};
export function proposeCrossing(
  c: Crossing,
  m: TransportMemory,
  rows: NativeRows,
  depth: number,
  budget: number,
): TransportForecast | undefined {
  if (!c.opened && !m.swap && !c.contact) return;
  const r = readTransport(m, rows);
  if (!r) return;
  const initial = crossingState(c, m, r),
    grid = m.grid,
    ops = Object.entries(m.motors);
  if (!ops.length) return;
  const pusher =
      m.push?.side ?? (m.swap ? other(m.swap.side) : c.initialPusher),
    swapper = other(pusher);
  const key = (s: TransportState, op: string) =>
    pusher + '/' + poseId(s) + '/' + op;
  const click = (s: TransportState, side: TransportSide) =>
    'ACTION6:' + sitePoint(grid, s.subjects[side]).join(',');
  const evidence = [
    c.selection,
    ...[c.opened, c.contact, m.swap?.ref, c.built, c.chain].filter(
      (v): v is string => !!v,
    ),
    ...ops.map(([, d]) => d.ref),
  ];
  const ground = new Set(c.floor),
    medium = new Set(c.material),
    core = new Set(c.destination),
    gaps = new Set(c.corridors.flatMap((g) => g.material));
  const md = (a: number, b: number) =>
    Math.abs((a % grid.columns) - (b % grid.columns)) +
    Math.abs(Math.floor(a / grid.columns) - Math.floor(b / grid.columns));
  function passage(s: TransportState) {
    let best = Infinity,
      selected = c.corridors[0]!;
    for (const corridor of c.corridors) {
      const missing = corridor.material.filter(
          (n) => !s.supports.includes(n),
        ).length,
        bank = corridor.approach[0]!;
      if (!missing) return { cost: 0, selected: corridor };
      const line = corridor.approach.filter(
        (p) =>
          s.pieces.includes(p) &&
          ground.has(neighbor(grid, p, -corridor.dx, -corridor.dy)),
      );
      const standing = line.map(
        (p) =>
          md(
            s.subjects[pusher],
            neighbor(grid, p, -corridor.dx, -corridor.dy),
          ) +
          0.5 * md(p, bank),
      );
      const cost =
        9 * missing +
        5 * Math.max(0, missing - line.length) +
        (standing.length ? Math.min(...standing) : 14) +
        3 * Number(bank === c.gate && !held(c, s));
      if (cost < best) {
        best = cost;
        selected = corridor;
      }
    }
    return { cost: best, selected };
  }
  function rank(s: TransportState) {
    const a = s.subjects[pusher],
      b = s.subjects[swapper],
      [u, v] = c.goals as [number, number],
      goals = Math.min(md(a, u) + md(b, v), md(a, v) + md(b, u));
    if (!goals) return 0;
    if (core.has(a))
      return goals + 0.3 * Math.min(...c.destination.map((n) => md(b, n)));
    if (
      core.has(b) &&
      c.destination.some(
        (n) =>
          a % grid.columns === n % grid.columns ||
          Math.floor(a / grid.columns) === Math.floor(n / grid.columns),
      )
    )
      return 5 + goals;
    const d = passage(s).cost;
    return d ? 22 + d + 0.08 * goals : 2 + goals;
  }
  function describe(step: TransportStep): TransportForecast {
    const corridor = passage(step.state).selected;
    return {
      purpose: 'maintain_the_gate_and_extend_walkable_ground_to_the_arrivals',
      from: step.state,
      expected: step.after,
      command: step.command,
      key: key(step.state, step.command),
      target: c.goals,
      evidence: [...new Set(evidence)],
      open: [
        ...(!c.opened ? ['occupation_changes_the_gate'] : []),
        ...(!c.contact ? ['contact_moves_an_aligned_piece'] : []),
        ...(!c.chain ? ['contact_can_move_a_line_of_pieces'] : []),
        ...(!c.built ? ['a_piece_creates_walkable_ground'] : []),
        ...(!m.swap
          ? ['the_other_subject_can_exchange_with_an_aligned_piece']
          : []),
      ],
      crossing: {
        gate: c.gate,
        control: c.control,
        material: corridor.material,
        missing: corridor.material.filter(
          (n) => !step.state.supports.includes(n),
        ),
        pusher,
        swapper,
        heldAfter: held(c, step.after),
      },
    };
  }
  const saved = c.plan?.[0];
  if (
    saved &&
    poseId(saved.state) === poseId(initial) &&
    !c.denied[key(initial, saved.command)]
  )
    return describe(saved);
  delete c.plan;
  const root: SearchNode = { s: initial, cost: 0, rank: 0 },
    queue = [root],
    cost = new Map([[poseId(initial), 0]]);
  let best = root,
    bestEstimate = rank(initial);
  for (let i = 0; queue.length && i < budget; i++) {
    const node = queue.pop()!,
      s = node.s;
    if (cost.get(poseId(s)) !== node.cost) continue;
    const value = rank(s);
    if (value < bestEstimate) {
      best = node;
      bestEstimate = value;
    }
    if (value === 0) {
      best = node;
      break;
    }
    if (node.cost >= depth) continue;
    const floor = (p: number) =>
      ground.has(p) || s.supports.includes(p) || (p === c.gate && held(c, s));
    for (const side of [pusher, swapper]) {
      const parked = s.subjects[other(side)],
        from = s.subjects[side],
        selected = side === s.active ? s : { ...s, active: side };
      if (side !== s.active && c.denied[key(s, click(s, side))]) continue;
      for (const [op, { dx, dy }] of ops) {
        if (c.denied[key(selected, op)]) continue;
        let to = neighbor(grid, from, dx, dy),
          peer = parked,
          pieces = s.pieces,
          supports = s.supports;
        if (side === pusher) {
          if (to === parked) continue;
          if (pieces.includes(to)) {
            let end = to;
            while (pieces.includes(end)) end = neighbor(grid, end, dx, dy);
            if (end === parked) continue;
            if (floor(end))
              pieces = s.pieces
                .map((n) => (n === to ? end : n))
                .sort((a, b) => a - b);
            else if (gaps.has(end) && medium.has(end)) {
              pieces = s.pieces.filter((n) => n !== to);
              supports = [...s.supports, end].sort((a, b) => a - b);
            } else continue;
          } else if (!floor(to)) continue;
        } else {
          let hit = to;
          while (
            (floor(hit) || medium.has(hit)) &&
            hit !== parked &&
            !pieces.includes(hit)
          )
            hit = neighbor(grid, hit, dx, dy);
          if (hit === parked) {
            to = hit;
            peer = from;
          } else if (pieces.includes(hit)) {
            to = hit;
            pieces = s.pieces
              .map((n) => (n === hit ? from : n))
              .sort((a, b) => a - b);
          } else if (!floor(to)) continue;
        }
        const subjects: [number, number] = [...s.subjects];
        subjects[side] = to;
        subjects[other(side)] = peer;
        const next = { subjects, pieces, supports, active: side },
          k = poseId(next),
          g = node.cost + 1 + Number(s.active !== side);
        if (
          g > depth ||
          g >= (cost.get(k) ?? Infinity) ||
          (!cost.has(k) && cost.size >= budget)
        )
          continue;
        cost.set(k, g);
        const child = {
          s: next,
          cost: g,
          rank: g + 5 * rank(next),
          parent: node,
          op,
          side,
        };
        let l = 0,
          h = queue.length;
        while (l < h) {
          const mid = (l + h) >>> 1;
          if (queue[mid]!.rank > child.rank) l = mid + 1;
          else h = mid;
        }
        queue.splice(l, 0, child);
      }
    }
  }
  if (best === root) return;
  const plan: TransportStep[] = [];
  for (let n = best; n.parent; n = n.parent) {
    const before = n.parent.s,
      side = n.side!,
      selected = side === before.active ? before : { ...before, active: side };
    plan.push({ state: selected, command: n.op!, after: n.s });
    if (side !== before.active)
      plan.push({
        state: before,
        command: click(before, side),
        after: selected,
      });
  }
  c.plan = plan.reverse();
  return describe(c.plan[0]!);
}
