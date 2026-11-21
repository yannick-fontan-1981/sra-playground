import { shortcuts } from './paired-previews.ts';
import { poseId, type TransportForecast } from './transport-observations.ts';
import {
  surrounding,
  pointCommand,
  type Scene,
  type Reading,
} from './paired-scene.ts';
import {
  type Learning,
  imagine,
  geometry,
  law,
  peer,
  key,
  md,
  forecast,
} from './paired-displacements.ts';

type Node = {
  s: Reading;
  g: number;
  f: number;
  score: number;
  parent?: Node;
  op?: string;
};
export function planDisplacements(
  s: Scene,
  m: Learning,
  v: Reading,
  ref: string,
  depth: number,
  budget: number,
): TransportForecast | undefined {
  const space = geometry(s),
    ops = Object.keys(m.motors),
    world = v.subjects.join('/') + '|' + v.active;
  const offer = (state: Reading, op: string, why: string, open: string[]) =>
    forecast(s, m, v, state, op, why, open, ref);
  // A single displacement can satisfy several occupied controls at once. Test
  // that prediction while the material still has the required relative shape.
  const commonVector = (state: Reading, targets: number[]) => {
    if (targets.length < 2 || state.pieces.length < targets.length)
      return Infinity;
    const w = s.grid.columns,
      base = targets[0]!;
    let best = Infinity;
    for (const piece of state.pieces) {
      const dx = (base % w) - (piece % w),
        dy = Math.floor(base / w) - Math.floor(piece / w);
      const related = targets.every((t) => {
        const x = (t % w) - dx,
          y = Math.floor(t / w) - dy;
        return (
          x >= 0 &&
          x < w &&
          y >= 0 &&
          y < s.grid.rows &&
          state.pieces.includes(y * w + x)
        );
      });
      if (related) best = Math.min(best, Math.abs(dx) + Math.abs(dy));
    }
    return best;
  };
  const sets = m.scope
    ? s.doors.filter(
        (d) =>
          !d.controls.every((p) => v.pieces.includes(p)) &&
          Number.isFinite(commonVector(v, d.controls)),
      )
    : [];
  for (const door of sets) {
    const distance = commonVector(v, door.controls);
    for (const op of ops) {
      const next = imagine(s, space, v, op, m, law(m, v.active));
      if (
        next &&
        commonVector(next, door.controls) < distance &&
        !m.denied[key(v) + '|' + op]
      ) {
        delete m.plan;
        return offer(
          next,
          op,
          'transport_a_matching_arrangement_onto_multiple_controls',
          ['each_object_advances_by_the_same_vector'],
        );
      }
    }
  }
  const candidates = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
  if (sets.length)
    candidates.sort(
      (a, b) =>
        Number(m.checked.some((x) => x.endsWith(a))) -
        Number(m.checked.some((x) => x.endsWith(b))),
    );
  const untried = candidates.find(
    (op) => !m.motors[op] && !m.checked.includes(world + op),
  );
  if (untried) {
    m.checked.push(world + untried);
    return offer(
      v,
      untried,
      'measure_a_direction_for_the_two_registered_subjects',
      ['which_subject_moves_and_which_objects_follow'],
    );
  }
  if (!ops.length) return;
  const laws = [law(m, 0), law(m, 1)] as const;
  const saved = m.plan?.[0];
  if (saved?.from === key(v) && !m.denied[key(v) + '|' + saved.command]) {
    return offer(
      saved.expected,
      saved.command,
      'continue_a_verified_change_of_relative_positions',
      [],
    );
  }
  delete m.plan;
  const normalized = (n: Reading) => key(n),
    command = (n: Reading, op: string) =>
      op === 'select' ? pointCommand(s.grid, n.subjects[peer(n.active)]) : op;
  const adjacent = Array.from({ length: s.initial.length }, (_, p) =>
    surrounding(s.grid, p),
  );
  const jumps = m.projections?.length
    ? s.initial.map((_, p) => shortcuts(s, p, m.projections!))
    : undefined;
  type Routes = { distance: number[]; toward: number[] };
  const paths = new Map<string, Routes>();
  const independent = (n: Reading, site: number, walker: number) => {
    const door = space.doors.get(site);
    return (
      !door ||
      door.controls.every(
        (p) =>
          n.pieces.includes(p) ||
          n.subjects.some((q, i) => i !== walker && q === p),
      )
    );
  };
  const heldAtStart = s.doors.filter(
    (d) =>
      d.controls.length > 1 && d.controls.every((p) => v.pieces.includes(p)),
  );

  function routes(n: Reading, goal: number, walker: number): Routes {
    const doorFlags = s.doors
      .map((d) => Number(independent(n, d.site, walker)))
      .join('');
    const k = [goal, n.supports.join('.'), doorFlags].join('/');
    const old = paths.get(k);
    if (old) return old;
    const distance = s.initial.map(() => Infinity),
      toward = s.initial.map(() => -1),
      q = [[0, goal]];
    distance[goal] = 0;
    const done = new Set<number>();
    while (q.length) {
      q.sort((a, b) => b[0]! - a[0]!);
      const [cost, p] = q.pop()! as [number, number];
      if (done.has(p)) continue;
      done.add(p);
      const step =
        space.walk(n, p) && independent(n, p, walker)
          ? 1
          : space.medium.has(p)
            ? 16
            : space.doors.has(p)
              ? 12
              : Infinity;
      for (const next of jumps
        ? [...adjacent[p]!, ...jumps[p]!]
        : adjacent[p]!) {
        if (!space.ground.has(next) && !space.medium.has(next)) continue;
        if (cost + step < distance[next]!) {
          distance[next] = cost + step;
          toward[next] = p;
          q.push([cost + step, next]);
        }
      }
    }
    const r = { distance, toward };
    paths.set(k, r);
    return r;
  }
  function pressure(n: Reading, controls: number[]) {
    const relevant = [...n.pieces, ...n.subjects];
    let total = 0;
    const used = new Set<number>();
    for (const target of controls
      .slice()
      .sort(
        (a, b) => Number(relevant.includes(b)) - Number(relevant.includes(a)),
      )) {
      const options = relevant.filter((x) => !used.has(x));
      if (!options.length) {
        total += 20;
        continue;
      }
      const cost = (x: number) =>
        md(s, x, target) + (n.subjects.includes(x) ? 2 : 0);
      const p = options.reduce((a, b) => (cost(a) <= cost(b) ? a : b));
      used.add(p);
      total += cost(p);
    }
    return total;
  }
  function score(n: Reading): number {
    const [a, b] = n.subjects,
      [u, w] = s.goals as [number, number];
    if ((a === u && b === w) || (a === w && b === u)) return 0;
    const x = routes(n, u, 0),
      y = routes(n, w, 1),
      xx = routes(n, u, 1),
      yy = routes(n, w, 0);
    const d = (r: Routes, p: number, goal: number) =>
      Number.isFinite(r.distance[p]) ? r.distance[p]! : 100 + md(s, p, goal);
    const norm = d(x, a, u) + d(y, b, w) <= d(xx, b, u) + d(yy, a, w);
    let total = 0;
    for (const [p, g, r] of (norm
      ? [
          [a, u, x],
          [b, w, y],
        ]
      : [
          [a, w, yy],
          [b, u, xx],
        ]) as [number, number, Routes][]) {
      total += d(r, p, g);
      let t = p;
      const seen = new Set<number>();
      while (t !== g && r.toward[t]! >= 0 && !seen.has(t)) {
        seen.add(t);
        t = r.toward[t]!;
        const door = space.doors.get(t);
        if (door && !independent(n, t, p === a ? 0 : 1)) {
          total += 3 * pressure(n, door.controls);
          break;
        }
        if (space.medium.has(t) && !n.supports.includes(t)) {
          const avail = n.pieces;
          if (avail.length) {
            const best = Math.min(
              ...avail.map(
                (z) =>
                  md(s, z, t) +
                  0.45 * Math.min(...n.subjects.map((p) => md(s, z, p))),
              ),
            );
            total += 2.5 * best;
          } else total += 40;
          break;
        }
      }
    }
    for (const door of heldAtStart)
      if (!door.controls.every((p) => n.pieces.includes(p))) total += 35;
    return total;
  }
  const root: Node = { s: v, g: 0, f: 0, score: score(v) },
    heap: Node[] = [root],
    seen = new Map([[normalized(v), 0]]);
  function push(n: Node) {
    let i = heap.length;
    heap.push(n);
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= n.f) break;
      heap[i] = heap[p]!;
      i = p;
    }
    heap[i] = n;
  }
  function pop() {
    const n = heap[0]!,
      x = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1;
        if (j + 1 < heap.length && heap[j + 1]!.f < heap[j]!.f) j++;
        if (heap[j]!.f >= x.f) break;
        heap[i] = heap[j]!;
        i = j;
      }
      heap[i] = x;
    }
    return n;
  }
  let best = root,
    bestProgress = Infinity;
  for (let i = 0; heap.length && i < budget; i++) {
    const n = pop();
    if (n.score === 0) {
      best = n;
      break;
    }
    if (n.g >= depth) continue;
    for (const op of [
      ...ops,
      'select',
      ...(m.projections?.length ? ['ACTION5'] : []),
    ]) {
      const action = command(n.s, op);
      if (m.denied[key(n.s) + '|' + action]) continue;
      const t = imagine(s, space, n.s, op, m, laws[n.s.active]);
      if (!t) continue;
      const id = normalized(t),
        cost = n.g + 1;
      if ((seen.get(id) ?? Infinity) <= cost) continue;
      seen.set(id, cost);
      const rank = score(t),
        f = rank + 0.7 * cost + Math.min(15, (m.visits[id] ?? 0) * 3);
      const next = { s: t, g: cost, f, score: rank, parent: n, op: action };
      if (!rank) {
        best = next;
        heap.length = 0;
        break;
      }
      if (f < bestProgress) {
        bestProgress = f;
        best = next;
      }
      push(next);
    }
  }
  if (!best.parent) return;
  const plan = [];
  for (let n: Node = best; n.parent; n = n.parent)
    plan.push({ from: key(n.parent.s), command: n.op!, expected: n.s });
  m.plan = plan.reverse();
  const step = m.plan[0]!;
  return offer(
    step.expected,
    step.command,
    'prepare_a_configuration_that_opens_a_route_for_both_subjects',
    ['compare_predicted_and_observed_displacement'],
  );
}
