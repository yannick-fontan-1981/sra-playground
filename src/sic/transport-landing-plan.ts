import {
  components,
  edgeKey,
  stepCell,
  walking,
  type Board,
  type Project,
  type Step,
} from './contact-frontier-search.ts';
import { contactRayClear } from './compose-support-plan.ts';

type Design = { pivot: number; launch: number; arrival: number; goal: number };
type Permission = (role: string, site: number) => boolean;
type Limits = { maxNodes: number; maxDepth: number };
type Node = { actor: number; parts: number[]; added: number[]; steps: Step[]; priority: number };

function rim(b: Board, sites: Iterable<number>) {
  const outside = new Set<number>();
  for (const site of sites)
    for (const m of b.motors) {
      const at = stepCell(b, site, m.delta);
      if (at >= 0 && !b.floor.has(at)) outside.add(at);
    }
  return outside;
}

// Invert the witnessed arrival relation at the boundary of the goal region.
// A proposed support may carry the mechanism itself or receive a passenger.
// Both consume distinct resources and must be justified by the later use.
export function transportLandingPlan(
  b: Board,
  witnesses: Map<string, string>,
  allows: Permission,
  denied: Set<string>,
  limits: Limits,
): Project | null {
  if (!b.transport || b.pivotIndex < 0 || !witnesses.size) return null;
  const regions = components(b),
    pivotRegion = regions.get(b.parts[b.pivotIndex]!);
  const regionCells = (region: number | undefined) => [...b.floor].filter((p) => regions.get(p) === region);
  const home = regionCells(pivotRegion),
    pivots = [...home, ...rim(b, home)];
  const designs: Design[] = [];
  for (const goal of b.goals) {
    const goalRegion = regions.get(goal);
    if (goalRegion === pivotRegion || goalRegion === regions.get(b.actor)) continue;
    const arrivals = rim(b, regionCells(goalRegion));
    for (const pivot of pivots)
      for (const arrival of arrivals) {
        const launch = b.transport.land(arrival, pivot);
        if (
          launch === null ||
          !b.floor.has(launch) ||
          regions.get(launch) === goalRegion ||
          b.transport.land(launch, pivot) !== arrival ||
          pivot === arrival
        )
          continue;
        const supply = b.parts.some(
          (p, i) =>
            i !== b.pivotIndex &&
            regions.get(p) === regions.get(launch) &&
            witnesses.has(b.roles[i]!) &&
            allows(b.roles[i]!, arrival) &&
            (b.floor.has(pivot) ||
              b.parts.some(
                (other, j) =>
                  j !== i &&
                  j !== b.pivotIndex &&
                  regions.get(other) === pivotRegion &&
                  allows(b.roles[j]!, pivot),
              )),
        );
        if (supply) designs.push({ pivot, launch, arrival, goal });
      }
  }
  let remaining = limits.maxNodes;
  for (const [i, d] of designs.entries()) {
    const results = solve(b, d, witnesses, allows, denied, {
      ...limits,
      maxNodes: Math.ceil(remaining / (designs.length - i)),
    });
    if (results.plan) return results.plan;
    remaining -= results.expanded;
  }
  return null;
}

function solve(
  b: Board,
  d: Design,
  witnesses: Map<string, string>,
  allows: Permission,
  denied: Set<string>,
  limits: Limits,
) {
  const transport = b.transport!,
    queue: Node[] = [{ actor: b.actor, parts: b.parts, added: [], steps: [], priority: 0 }];
  const seen = new Map<string, number>();
  const distance = (p: number, q: number) =>
    Math.abs((p % b.width) - (q % b.width)) + Math.abs(Math.floor(p / b.width) - Math.floor(q / b.width));
  let expanded = 0;
  while (queue.length && expanded < limits.maxNodes) {
    queue.sort((a, c) => a.priority - c.priority);
    const n = queue.shift()!,
      pivot = n.parts[b.pivotIndex]!,
      floor = new Set([...b.floor, ...n.added]);
    const local = { ...b, floor };
    const predictions = n.parts.flatMap((p, i) => {
      if (p < 0 || i === b.pivotIndex || !witnesses.has(b.roles[i]!)) return [];
      const dest = transport.land(p, pivot);
      if (
        dest === null ||
        dest < 0 ||
        dest >= b.width * b.height ||
        n.parts.includes(dest) ||
        !contactRayClear(b, p, dest, pivot, n.parts)
      )
        return [];
      return [{ i, p, dest }];
    });
    const changes = (actor: number) =>
      predictions.filter((v) => actor !== v.dest && contactRayClear(b, v.p, v.dest, pivot, [actor]));
    const subject = (from: number) => {
      const dest = transport.land(from, pivot);
      return dest !== null &&
        floor.has(dest) &&
        !n.parts.includes(dest) &&
        contactRayClear(b, from, dest, pivot, n.parts)
        ? dest
        : null;
    };
    const paths = walking(
      {
        ...local,
        transport: { op: transport.op, land: (from) => (changes(from).length ? null : subject(from)) },
      },
      n.actor,
      n.parts,
      denied,
    );
    const key = [Math.min(...paths.keys()), ...n.parts, -2, ...n.added].join('/');
    if ((seen.get(key) ?? Infinity) <= n.steps.length) continue;
    seen.set(key, n.steps.length);
    expanded++;
    const tail = paths.get(d.goal);
    if (tail && n.added.includes(d.arrival) && n.steps.length + tail.length <= limits.maxDepth) {
      const steps = [...n.steps, ...tail],
        deposit = steps.find((s) => s.boundary && s.passenger && s.placed === d.arrival);
      if (deposit?.role && steps.some((s) => s.to === d.arrival && s.op === transport.op)) {
        const plan: Project = {
          purpose: 'reach_goal',
          role: deposit.role,
          site: d.goal,
          steps,
          landing: {
            pivot: d.pivot,
            launch: d.launch,
            arrival: d.arrival,
            witness: witnesses.get(deposit.role)!,
          },
          preparations: steps
            .filter((s) => s.boundary)
            .map((s) => ({
              at: s.placed!,
              role: s.role!,
              enables:
                s.placed === d.arrival ? ['transport_arrival', 'subject_entry'] : ['mechanism_placement'],
            })),
        };
        return { plan, expanded };
      }
    }
    const enqueue = (actor: number, i: number, step: Step, approach: Step[]) => {
      const steps = [...n.steps, ...approach, step];
      if (steps.length >= limits.maxDepth) return;
      const parts = n.parts.slice(),
        at = step.placed!;
      parts[i] = step.boundary ? -1 : at;
      const added = step.boundary ? [...n.added, at].sort((a, c) => a - c) : n.added;
      const pivotReady = b.floor.has(d.pivot) || added.includes(d.pivot);
      const target = pivotReady ? d.launch : d.pivot;
      const loads = parts.filter((p, j) => p >= 0 && j !== b.pivotIndex);
      const effort = added.includes(d.arrival) ? 0 : Math.min(...loads.map((p) => distance(p, target)));
      const priority =
        steps.length + 2 * effort + 2 * distance(parts[b.pivotIndex]!, d.pivot) + (pivotReady ? 0 : 12);
      queue.push({ actor, parts, added, steps, priority });
    };
    for (const [i, p] of n.parts.entries()) {
      if (p < 0) continue;
      const role = b.roles[i]!;
      for (const m of b.motors) {
        const from = stepCell(b, p, -m.delta),
          dest = stepCell(b, p, m.delta),
          approach = paths.get(from);
        if (!approach || dest < 0 || n.parts.includes(dest) || denied.has(edgeKey(from, m.op, n.parts)))
          continue;
        const boundary = !floor.has(dest);
        if (boundary && (i === b.pivotIndex || dest !== d.pivot || !allows(role, dest))) continue;
        enqueue(p, i, { from, to: p, op: m.op, role, placed: dest, boundary }, approach);
      }
    }
    const launches = new Set<string>();
    for (const [actor, approach] of paths) {
      if (denied.has(edgeKey(actor, transport.op, n.parts)) || subject(actor) !== null) continue;
      const moves = changes(actor);
      if (moves.length !== 1) continue;
      const { i, p, dest } = moves[0]!,
        role = b.roles[i]!,
        boundary = !floor.has(dest);
      if (boundary && (dest !== d.arrival || pivot !== d.pivot || p !== d.launch || !allows(role, dest)))
        continue;
      const parts = n.parts.slice();
      parts[i] = boundary ? -1 : dest;
      const after = walking({ ...local, transport: undefined }, actor, parts, denied);
      const key = [i, Math.min(...after.keys())].join('/');
      if (launches.has(key)) continue;
      launches.add(key);
      const pushes = boundary
        ? []
        : b.motors
            .filter(
              (m) =>
                after.has(stepCell(b, dest, -m.delta)) &&
                floor.has(stepCell(b, dest, m.delta)) &&
                !parts.includes(stepCell(b, dest, m.delta)),
            )
            .map((m) => m.op);
      enqueue(
        actor,
        i,
        {
          from: actor,
          to: actor,
          op: transport.op,
          role,
          placed: dest,
          boundary,
          passenger: { source: p, pushes },
        },
        approach,
      );
    }
  }
  return { plan: null, expanded };
}
