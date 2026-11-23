// Project verified changes of support through several pushes. Search hypotheses
// describe terrain, never game objects or absolute screen locations.
import {
  components,
  edgeKey,
  stepCell,
  walking,
  type Board,
  type Project,
  type Step,
} from './contact-frontier-search.ts';

type Permission = (role: string, site: number) => boolean;
type Design = {
  sites: number[];
  final: Set<number>;
  regions: Map<number, number>;
  goalRegions: Set<number>;
  delivery: Map<number, Map<number, number>>;
  pivotCost: Map<number, number>;
  rank: number;
};
const ascending = (a: number, b: number) => a - b;

function pushDistances(b: Board, floor: Set<number>, targets: Iterable<number>) {
  const result = new Map<number, number>();
  const queue = [...targets];
  for (const at of queue) result.set(at, 0);
  for (const at of queue)
    for (const { delta } of b.motors) {
      const from = stepCell(b, at, -delta),
        stance = stepCell(b, from, -delta);
      if (!floor.has(from) || !floor.has(stance) || result.has(from)) continue;
      result.set(from, result.get(at)! + 1);
      queue.push(from);
    }
  return result;
}

function corridors(b: Board, stock: number, allowed: (p: number) => boolean, limit: number) {
  const regions = components(b);
  const pairs = new Map<string, { length: number; paths: Map<string, number[]> }>();
  for (const seed of new Set(regions.values())) {
    const layer = [...regions].filter(([, r]) => r === seed).map(([p]) => p);
    const distance = new Map(layer.map((p) => [p, 0]));
    const parents = new Map<number, number[]>();
    function remember(region: number, last: number) {
      if (seed >= region) return;
      const key = seed + '/' + region,
        n = distance.get(last)!;
      let pair = pairs.get(key);
      if (!pair || n < pair.length) {
        pair = { length: n, paths: new Map() };
        pairs.set(key, pair);
      }
      if (n !== pair.length || pair.paths.size >= limit) return;
      const trace = (at: number, path: number[]) => {
        if (pair!.paths.size >= limit) return;
        if (!distance.get(at)) {
          const sites = path.slice().sort(ascending);
          pair!.paths.set(sites.join(), sites);
          return;
        }
        for (const prev of parents.get(at) ?? []) trace(prev, [...path, at]);
      };
      trace(last, []);
    }
    for (const p of layer) {
      const depth = distance.get(p)!;
      for (const { delta } of b.motors) {
        const to = stepCell(b, p, delta);
        if (to < 0) continue;
        const region = regions.get(to);
        if (region !== undefined) {
          if (depth && region !== seed) remember(region, p);
          continue;
        }
        if (depth >= stock || !allowed(to)) continue;
        if (!distance.has(to)) {
          distance.set(to, depth + 1);
          parents.set(to, [p]);
          layer.push(to);
        } else if (distance.get(to) === depth + 1) parents.get(to)!.push(p);
      }
    }
  }
  return [...pairs.values()].flatMap((v) => [...v.paths.values()]);
}

function assignment(b: Board, d: Design, parts: number[], missing: number[], allowed: Permission) {
  // Minimum one-to-one delivery cost. A single object cannot be promised to two sites.
  const done = (1 << missing.length) - 1;
  const costs = new Map<number, number>([[0, 0]]);
  for (const [i, p] of parts.entries()) {
    if (i === b.pivotIndex || p < 0) continue;
    for (const [mask, cost] of [...costs]) {
      for (const [j, site] of missing.entries()) {
        const bit = 1 << j,
          steps = d.delivery.get(site)!.get(p);
        if (mask & bit || steps === undefined || !allowed(b.roles[i]!, site)) continue;
        const next = mask | bit;
        costs.set(next, Math.min(costs.get(next) ?? Infinity, cost + steps));
      }
    }
  }
  return costs.get(done) ?? Infinity;
}
function transitCost(b: Board, d: Design, actor: number, parts: number[]) {
  if (d.goalRegions.has(d.regions.get(actor)!)) return 0;
  if (!b.transport || b.pivotIndex < 0) return Infinity;
  return d.pivotCost.get(parts[b.pivotIndex]!) ?? Infinity;
}
function designs(b: Board, allowed: Permission, maxNodes: number) {
  const stock = Math.min(b.roles.filter((_, i) => i !== b.pivotIndex).length, Math.floor(Math.log2(maxNodes + 1)), 20);
  const corridorsFound = corridors(
    b,
    stock,
    (at) => b.roles.some((r, i) => i !== b.pivotIndex && allowed(r, at)),
    maxNodes
  );
  const patterns: number[][] = [[]],
    seen = new Set(['']);
  for (const sites of patterns) {
    if (patterns.length >= maxNodes) break;
    for (const addition of corridorsFound) {
      const next = [...new Set([...sites, ...addition])].sort(ascending),
        key = next.join();
      if (next.length > stock || seen.has(key)) continue;
      seen.add(key);
      patterns.push(next);
      if (patterns.length >= maxNodes) break;
    }
  }
  const result: Design[] = [];
  for (const sites of patterns) {
    const final = new Set([...b.floor, ...sites]);
    const regions = components({ ...b, floor: final }),
      goalRegions = new Set(b.goals.map((g) => regions.get(g)!));
    const delivery = new Map(sites.map((site) => [site, pushDistances(b, final, [site])]));
    const d: Design = { sites, final, regions, goalRegions, delivery, pivotCost: new Map(), rank: 0 };
    const supplies = assignment(b, d, b.parts, sites, allowed);
    if (!Number.isFinite(supplies)) continue;
    if (b.transport && b.pivotIndex >= 0) {
      const launches = [];
      for (const pivot of final)
        for (const from of final) {
          if (goalRegions.has(regions.get(from)!)) continue;
          const to = b.transport.land(from, pivot);
          if (to !== null && goalRegions.has(regions.get(to)!)) {
            launches.push(pivot);
            break;
          }
        }
      d.pivotCost = pushDistances(b, final, launches);
    }
    const transit = transitCost(b, d, b.actor, b.parts);
    if (!Number.isFinite(transit)) continue;
    d.rank = supplies + transit + sites.length;
    result.push(d);
  }
  return result.sort((a, c) => a.rank - c.rank);
}

type Position = { actor: number; parts: number[]; missing: number[]; steps: Step[]; priority: number };
export function contactRayClear(b: Board, from: number, to: number, pivot: number, parts: number[]) {
  for (const endpoint of [from, to]) {
    const dx = (endpoint % b.width) - (pivot % b.width),
      dy = Math.floor(endpoint / b.width) - Math.floor(pivot / b.width);
    if (dx && dy) continue;
    const n = Math.abs(dx) + Math.abs(dy),
      stride = Math.sign(dx) + b.width * Math.sign(dy);
    for (let i = 1; i < n; i++) if (parts.includes(pivot + i * stride)) return false;
  }
  return true;
}

function solveDesign(
  b: Board,
  d: Design,
  allowed: Permission,
  denied: Set<string>,
  limits: { maxDepth: number; maxNodes: number }
) {
  const queue: Position[] = [{ actor: b.actor, parts: b.parts, missing: d.sites, steps: [], priority: 0 }];
  const seen = new Map<string, number>();
  let expanded = 0;
  while (queue.length && expanded < limits.maxNodes) {
    queue.sort((a, c) => c.priority - a.priority);
    const n = queue.pop()!;
    const floor = new Set([...b.floor, ...d.sites.filter((p) => !n.missing.includes(p))]);
    const transport = b.transport && {
      ...b.transport,
      land: (from: number, pivot: number) => {
        const to = b.transport!.land(from, pivot);
        return to !== null && contactRayClear(b, from, to, pivot, n.parts) ? to : null;
      },
    };
    const paths = walking({ ...b, floor, transport }, n.actor, n.parts, denied);
    const key = [Math.min(...paths.keys()), ...n.parts, -2, ...n.missing].join('/');
    if ((seen.get(key) ?? Infinity) <= n.steps.length) continue;
    seen.set(key, n.steps.length);
    expanded++;
    for (const goal of b.goals) {
      const tail = paths.get(goal);
      if (tail && n.steps.length + tail.length <= limits.maxDepth && n.steps.length + tail.length > 0) {
        const steps = [...n.steps, ...tail];
        const preparations = steps.flatMap((s, index) => {
          if (!s.boundary) return [];
          const uses = new Set<string>();
          for (const later of steps.slice(index + 1)) {
            if (later.to === s.placed) uses.add('subject_entry');
            if (later.from === s.placed && later.role) uses.add('stance_for:' + later.role);
            if (later.placed === s.placed && later.role) uses.add('transit_of:' + later.role);
          }
          return [{ at: s.placed!, role: s.role!, enables: [...uses] }];
        });
        const project: Project = { purpose: 'reach_goal', site: goal, steps, preparations };
        return { project, expanded };
      }
    }
    for (const [i, p] of n.parts.entries()) {
      if (p < 0) continue;
      for (const motor of b.motors) {
        const stance = stepCell(b, p, -motor.delta),
          dest = stepCell(b, p, motor.delta),
          approach = paths.get(stance);
        if (!approach || dest < 0 || n.parts.includes(dest) || denied.has(edgeKey(stance, motor.op, n.parts))) continue;
        const boundary = !floor.has(dest),
          role = b.roles[i]!;
        if (boundary && (i === b.pivotIndex || !n.missing.includes(dest) || !allowed(role, dest))) continue;
        const steps = [...n.steps, ...approach, { from: stance, to: p, op: motor.op, role, placed: dest, boundary }];
        if (steps.length > limits.maxDepth) continue;
        const parts = n.parts.slice();
        parts[i] = boundary ? -1 : dest;
        const missing = boundary ? n.missing.filter((v) => v !== dest) : n.missing;
        const effort = assignment(b, d, parts, missing, allowed) + transitCost(b, d, p, parts);
        if (!Number.isFinite(effort)) continue;
        const priority = steps.length + 5 * effort + 12 * missing.length;
        queue.push({ actor: p, parts, missing, steps, priority });
      }
    }
  }
  return { project: null, expanded };
}

export function composeSupportPlan(
  b: Board,
  allowed: Permission,
  denied: Set<string>,
  limits: { maxNodes: number; maxDepth: number }
): Project | null {
  if (!b.goals.length || !b.parts.length) return null;
  const alternatives = designs(b, allowed, limits.maxNodes);
  let remaining = limits.maxNodes;
  for (const [i, design] of alternatives.entries()) {
    const budget = Math.ceil(remaining / (alternatives.length - i));
    const { project, expanded } = solveDesign(b, design, allowed, denied, { ...limits, maxNodes: budget });
    remaining -= expanded;
    if (project) return project;
    if (remaining <= 0) break;
  }
  return null;
}

// Exhaust the public push/transport model without the corridor or depth
// pruning used for finding plans. An interrupted search is inconclusive.
export function closedSupportRegion(b: Board, maxNodes: number, transportedRoles?: ReadonlySet<string>): number | null {
  const queue = [{ actor: b.actor, parts: b.parts, added: [] as number[] }],
    seen = new Set<string>();
  for (const n of queue) {
    const floor = new Set([...b.floor, ...n.added]);
    const paths = walking({ ...b, floor }, n.actor, n.parts, new Set());
    if (b.goals.some((p) => paths.has(p))) return null;
    const key = [[...paths.keys()].sort(ascending).join(','), n.parts.join(','), n.added.join(',')].join('/');
    if (seen.has(key)) continue;
    if (seen.size >= maxNodes) return null;
    seen.add(key);
    for (const [i, p] of n.parts.entries()) {
      if (p < 0) continue;
      // Relaxation for a closure proof: permit a witnessed passenger to move
      // independently of the subject, even without a clear launch stance.
      // Ordinary walking already grants the converse independent movement.
      if (i !== b.pivotIndex && transportedRoles?.has(b.roles[i]!) && b.transport) {
        const dest = b.transport.land(p, n.parts[b.pivotIndex]!);
        if (dest !== null && dest >= 0 && dest < b.width * b.height && !n.parts.includes(dest)) {
          const parts = n.parts.slice(), boundary = !floor.has(dest);
          parts[i] = boundary ? -1 : dest;
          queue.push({ actor: n.actor, parts, added: boundary ? [...n.added, dest].sort(ascending) : n.added });
        }
      }
      for (const motor of b.motors) {
        const dest = stepCell(b, p, motor.delta);
        if (dest < 0 || n.parts.includes(dest) || !paths.has(stepCell(b, p, -motor.delta))) continue;
        const boundary = !floor.has(dest);
        if (boundary && i === b.pivotIndex) continue;
        const parts = n.parts.slice();
        parts[i] = boundary ? -1 : dest;
        queue.push({ actor: p, parts, added: boundary ? [...n.added, dest].sort(ascending) : n.added });
      }
    }
  }
  return seen.size;
}
