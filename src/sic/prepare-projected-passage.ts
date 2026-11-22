import { castingSites } from './paired-previews.ts';
import { surrounding, type Scene, type Reading } from './paired-scene.ts';
import { neighbor, type TransportSide } from './transport-observations.ts';
import {
  key,
  forecast,
  imagine,
  geometry,
  law,
  peer,
  type Learning,
} from './paired-displacements.ts';

type Indication = {
  source: number;
  landing: number;
  dir: number;
  out: number;
  side: number;
};
export type Passage = {
  form: string;
  pivot: number;
  rejected: string[];
  signs: Indication[];
  orientation?: [number, number];
  evidence?: string;
  blocked: string[];
};
const code = (p: number, site: number, dest: number) =>
  [p, site, dest].join('/');
function indicated(s: Scene, tile: string, cargo: boolean) {
  const inks = tile.split(',').map(Number),
    pitch = s.grid.pitch,
    mid = Math.floor(pitch / 2),
    center = inks[mid * pitch + mid],
    edge = inks[0];
  if (center === edge || s.bodies.includes(center!)) return false;
  return inks.every(
    (ink, i) =>
      ink ===
      (cargo
        ? i === mid * pitch + mid
          ? center
          : edge
        : i % pitch === mid || Math.floor(i / pitch) === mid
          ? center
          : edge),
  );
}
export function watchPassage(
  s: Scene,
  m: Learning,
  old: Reading,
  now: Reading,
  tiles: string[],
  ref: string,
  op: string,
) {
  const p = m.passage;
  if (!p) return;
  const marks = tiles.flatMap((k, i) => (k === p.form ? [i] : []));
  if (marks.length !== 1) {
    p.signs = [];
    return;
  }
  if (op === 'ACTION5') {
    const result = p.signs.find((t) =>
      t.side >= 0
        ? now.subjects[t.side] === t.landing &&
          old.subjects[t.side] === t.source
        : old.pieces.includes(t.source) &&
          !now.pieces.includes(t.source) &&
          (now.pieces.includes(t.landing) || now.supports.includes(t.landing)),
    );
    if (result) {
      p.orientation = [result.dir, result.out];
      p.evidence = ref;
    }
  }
  const motor = m.motors[op],
    oldSite = old.subjects[old.active];
  if (
    motor &&
    neighbor(s.grid, oldSite, motor.dx, motor.dy) === p.pivot &&
    oldSite === now.subjects[old.active] &&
    p.pivot === marks[0]
  ) {
    const denial = [old.active, p.pivot, oldSite, op].join('/');
    if (!p.blocked.includes(denial)) p.blocked.push(denial);
  }
  p.pivot = marks[0]!;
  if (
    s.other.some((i) => s.initial[i] === p.form) &&
    p.pivot !== s.other.find((i) => s.initial[i] === p.form)
  ) {
    const departed = s.other.find((i) => s.initial[i] === p.form)!;
    if (!s.ground.includes(departed)) s.ground.push(departed);
  }
  const signs: Indication[] = [];
  [...now.subjects, ...now.pieces].forEach((source, i) => {
    for (const z of castingSites(s, source, p.pivot)) {
      const tile = tiles[z.landing]!;
      if (
        tile === s.initial[z.landing] ||
        now.subjects.includes(z.landing) ||
        now.pieces.includes(z.landing) ||
        !indicated(s, tile, i >= 2)
      )
        continue;
      signs.push({ source, side: i < 2 ? i : -1, ...z });
    }
  });
  p.signs = signs;
}
function component(s: Scene, sites: number[], start: number[]) {
  const allowed = new Set(sites),
    seen = new Set(start),
    queue = [...start];
  for (const p of queue)
    for (const n of surrounding(s.grid, p))
      if (allowed.has(n) && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  return seen;
}
export function startPassage(s: Scene): Passage | undefined {
  const distinct = s.other.filter(
    (p) => s.other.filter((n) => s.initial[n] === s.initial[p]).length === 1,
  );
  if (distinct.length === 1)
    return {
      pivot: distinct[0]!,
      form: s.initial[distinct[0]!]!,
      rejected: [],
      blocked: [],
      signs: [],
    };
}
export function recallProjectedPassage(
  s: Scene,
  m: Learning,
  v: Reading,
  tiles: string[],
): Passage | undefined {
  const pose = key(v);
  const next = m.plan?.[0];
  if (m.passage || m.join || !m.projections?.length || (m.visits[pose] ?? 0) < 2) return;
  if (next?.from === pose && !m.denied[pose + '|' + next.command]) return;
  const closed = new Set(s.doors.filter(d => !v.opened.includes(d.site)).map(d => d.site));
  const land = s.ground.filter(site => !closed.has(site)).concat(v.supports);
  const destination = component(s, land, s.goals);
  if (v.subjects.every(site => destination.has(site))) return;
  // A repeated pose supplies the reason to look for another crossing. The
  // predicted transform, not the number of other fixtures, identifies its pivot.
  for (const rule of m.projections) {
    const sites = tiles.flatMap((tile, site) => (tile === rule.pivotForm ? [site] : []));
    if (sites.length !== 1 || !s.other.some(site => s.initial[site] === rule.pivotForm)) continue;
    return {
      form: rule.pivotForm,
      pivot: sites[0]!,
      signs: [],
      rejected: [],
      blocked: [],
      orientation: [rule.from, rule.to],
      evidence: rule.ref,
    };
  }
}
export function projectedPassage(
  s: Scene,
  m: Learning,
  v: Reading,
  ref: string,
  depth: number,
  budget: number,
) {
  const p = m.passage;
  if (!p) return;
  const space = geometry(s),
    ops = Object.entries(m.motors),
    dry = [...s.ground, ...v.supports].filter(site => space.open(v, site) || v.opened.includes(site)),
    destinations = component(s, dry, s.goals);
  const inRoom = v.subjects.map((n) => destinations.has(n));
  if (inRoom.every(Boolean) || !ops.length) return;
  const side = v.active,
    other = peer(side),
    source = v.subjects[side],
    peerSite = v.subjects[other];
  const offer = (op: string, next: Reading, why: string, open: string[]) =>
    forecast(s, m, v, next, op, why, open, ref);
  const orient = (dir: number, out: number) =>
    !p.orientation ||
    (p.orientation.includes(dir) && p.orientation.includes(out));
  if (inRoom[side]) {
    if (!s.goals.includes(source)) {
      const q = [source],
        first = new Map<number, string>();
      first.set(source, '');
      for (const x of q) {
        if (s.goals.includes(x)) {
          const op = first.get(x)!,
            n = imagine(s, space, v, op, m, law(m, side));
          if (n)
            return offer(
              op,
              n,
              'preserve_the_crossing_by_vacating_the_landing',
              ['place_the_arrived_subject_on_a_goal'],
            );
          break;
        }
        for (const [op, { dx, dy }] of ops) {
          const z = neighbor(s.grid, x, dx, dy);
          if (
            !destinations.has(z) ||
            first.has(z) ||
            z === peerSite ||
            v.pieces.includes(z) ||
            (x === source && m.denied[key(v) + '|' + op])
          )
            continue;
          first.set(z, x === source ? op : first.get(x)!);
          q.push(z);
        }
      }
    }
    return offer(
      'select',
      { ...v, active: other },
      'use_the_verified_passage_for_the_remaining_subject',
      ['preserve_the_prepared_configuration'],
    );
  }
  const exact = p.signs.find(
    (t) =>
      t.side === side &&
      destinations.has(t.landing) &&
      !v.subjects.includes(t.landing),
  );
  const unsafe = p.signs.some((t) => t.side >= 0 && !dry.includes(t.landing));
  if (exact && !unsafe && !m.denied[key(v) + '|ACTION5']) {
    const next = structuredClone(v);
    next.subjects[side] = exact.landing;
    return offer(
      'ACTION5',
      next,
      'test_a_visible_projection_into_the_unreached_region',
      [
        'the_subject_arrives_on_supported_ground',
        ...(p.evidence ? [p.evidence] : []),
      ],
    );
  }
  const current = castingSites(s, source, p.pivot).filter(
    (z) =>
      orient(z.dir, z.out) &&
      destinations.has(z.landing) &&
      !v.subjects.includes(z.landing),
  );
  if (current.length) {
    const cargo = p.signs.find((t) => t.side === -1 && orient(t.dir, t.out));
    if (cargo && !unsafe && !m.denied[key(v) + '|ACTION5']) {
      const next = structuredClone(v);
      next.pieces = next.pieces.filter((n) => n !== cargo.source);
      if (s.medium.includes(cargo.landing))
        next.supports = [...new Set([...next.supports, cargo.landing])].sort(
          (a, b) => a - b,
        );
      else next.pieces = [...next.pieces, cargo.landing].sort((a, b) => a - b);
      return offer(
        'ACTION5',
        next,
        'clear_a_nearer_projected_object_before_retesting_the_subject',
        [
          'a_closer_object_occupies_the_active_ray',
          'the_next_image_can_change',
        ],
      );
    }
    for (const c of current) {
      const k = code(p.pivot, source, c.landing);
      if (!p.rejected.includes(k)) p.rejected.push(k);
    }
  }
  const passable = new Set(dry);
  // Occupied ground becomes walkable in the hypothesis where the landmark has moved.
  passable.add(p.pivot);
  const distance = (a: number, b: number) =>
    Math.abs((a % s.grid.columns) - (b % s.grid.columns)) +
    Math.abs(Math.floor(a / s.grid.columns) - Math.floor(b / s.grid.columns));
  type Node = {
    site: number;
    pivot: number;
    cost: number;
    pushes: number;
    first: string;
    moveTo: number;
  };
  let remaining = budget;
  const arrangement = (operator: TransportSide) => {
    const source = v.subjects[operator],
      peerSite = v.subjects[peer(operator)],
      canPush = law(m, operator) === 'push',
      pose = key({ ...v, active: operator });
    const q: Node[] = [
        {
          site: source,
          pivot: p.pivot,
          cost: 0,
          pushes: 0,
          first: '',
          moveTo: -1,
        },
      ],
      seen = new Set([source + '/' + p.pivot]);
    let best: (Node & { landing: number }) | undefined,
      score = Infinity;
    for (let i = 0; i < q.length && remaining > 0; i++) {
      remaining--;
      const n = q[i]!;
      if (n.cost > depth || n.cost > score + 1) continue;
      if (n.first)
        for (const c of castingSites(s, n.site, n.pivot)) {
          if (
            !orient(c.dir, c.out) ||
            !destinations.has(c.landing) ||
            c.landing === peerSite ||
            v.pieces.includes(c.landing) ||
            p.rejected.includes(code(n.pivot, n.site, c.landing))
          )
            continue;
          const penalty =
            n.cost +
            0.65 * n.pushes +
            (v.supports.includes(c.landing) ? 3 : 0) +
            0.035 * distance(n.site, n.pivot);
          if (penalty < score) {
            score = penalty;
            best = { ...n, landing: c.landing };
          }
        }
      for (const [op, { dx, dy }] of ops) {
        const z = neighbor(s.grid, n.site, dx, dy),
          hit = z === n.pivot;
        if (
          !passable.has(z) ||
          z === peerSite ||
          v.pieces.includes(z) ||
          (!n.first && m.denied[pose + '|' + op])
        )
          continue;
        let pivot = n.pivot;
        if (hit) {
          pivot = neighbor(s.grid, z, dx, dy);
          if (
            !canPush ||
            !passable.has(pivot) ||
            v.supports.includes(pivot) ||
            pivot === peerSite ||
            v.pieces.includes(pivot) ||
            p.blocked.includes([operator, n.pivot, n.site, op].join('/'))
          )
            continue;
        }
        const k = z + '/' + pivot;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({
          site: z,
          pivot,
          cost: n.cost + 1,
          pushes: n.pushes + (hit ? 1 : 0),
          first: n.first || op,
          moveTo: n.first ? n.moveTo : z,
        });
      }
    }
    return best;
  };
  const best = arrangement(side);
  if (!best) {
    if (law(m, side) !== 'push' && !inRoom[other] && law(m, other) === 'push') {
      const alternative = arrangement(other);
      if (alternative) {
        const choice = offer(
          'select',
          { ...v, active: other },
          'select_the_subject_with_a_reachable_launch_configuration',
          [
            'preserve_the_other_subject_position',
            'test_the_projected_landing_from_the_prepared_configuration',
          ],
        );
        if (p.evidence && !choice.evidence.includes(p.evidence)) choice.evidence.push(p.evidence);
        choice.projectedSetup = {
          operator: other, pivot: alternative.pivot, launch: alternative.site,
          landing: alternative.landing, firstCommand: alternative.first,
        };
        return choice;
      }
    }
    return;
  }
  const next =
    imagine(s, space, v, best.first, m, law(m, side)) ?? structuredClone(v);
  next.subjects[side] = best.moveTo;
  return offer(
    best.first,
    next,
    'arrange_a_landmark_and_a_launch_site_for_an_unreached_region',
    ['compare_the_expected_indication_with_the_next_image'],
  );
}
