// Search in units of witnessed movement. Walking to the back of a part and
// moving that part are separate obligations, even with a nonlocal movement.
export type Motor = { op: string; delta: number };
export type Board = {
  width: number;
  height: number;
  floor: Set<number>;
  goals: number[];
  actor: number;
  parts: number[];
  roles: string[];
  pivotIndex: number;
  motors: Motor[];
  transport?: { op: string; land: (actor: number, pivot: number) => number | null };
};
export type Step = { op: string; from: number; to: number; role?: string; placed?: number; boundary?: boolean };
export type Project = {
  steps: Step[];
  purpose: 'test_support' | 'reach_goal' | 'test_contact';
  site: number;
  role?: string;
  preparations?: { at: number; role: string; enables: string[] }[];
};
export const edgeKey = (from: number, op: string, parts: readonly number[]) => [from, op, ...parts].join('/');
const distance = (a: number, b: number, w: number) =>
  Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w));
export function stepCell(b: Board, a: number, d: number) {
  const v = a + d;
  return v >= 0 && v < b.width * b.height && distance(a, v, b.width) === 1 ? v : -1;
}
export function components(b: Board) {
  const component = new Map<number, number>();
  for (const seed of b.floor) {
    if (component.has(seed)) continue;
    const queue = [seed];
    component.set(seed, seed);
    for (const p of queue)
      for (const m of b.motors) {
        const at = stepCell(b, p, m.delta);
        if (b.floor.has(at) && !component.has(at)) {
          component.set(at, seed);
          queue.push(at);
        }
      }
  }
  return component;
}
function connectingSites(b: Board) {
  const regions = components(b),
    sites = new Set<number>();
  for (const p of b.floor)
    for (const m of b.motors) {
      const gap = stepCell(b, p, m.delta);
      if (gap < 0 || b.floor.has(gap)) continue;
      if (
        b.motors.some((other) => {
          const neighbour = regions.get(stepCell(b, gap, other.delta));
          return neighbour !== undefined && neighbour !== regions.get(p);
        })
      )
        sites.add(gap);
    }
  return sites;
}
export function walking(b: Board, actor: number, parts: number[], denied: Set<string>) {
  const occupied = new Set(parts),
    path = new Map<number, Step[]>();
  path.set(actor, []);
  const queue = [actor];
  for (const p of queue) {
    const add = (to: number, op: string) => {
      if (!b.floor.has(to) || occupied.has(to) || path.has(to) || denied.has(edgeKey(p, op, parts))) return;
      path.set(to, [...path.get(p)!, { from: p, to, op }]);
      queue.push(to);
    };
    for (const motor of b.motors) add(stepCell(b, p, motor.delta), motor.op);
    if (b.transport && b.pivotIndex >= 0) {
      const target = b.transport.land(p, parts[b.pivotIndex]!);
      if (target !== null) add(target, b.transport.op);
    }
  }
  return path;
}
type Node = { actor: number; parts: number[]; steps: Step[]; priority: number };
export function contactProject(
  b: Board,
  denied: Set<string>,
  limits: { maxNodes: number; maxDepth: number },
  localUnknown: Set<string> = new Set(),
  provenSupport?: (role: string, at: number) => boolean
): Project | null {
  const sites = connectingSites(b),
    candidates = [...sites];
  const seekKnown =
    !!provenSupport && b.roles.some((role, i) => i !== b.pivotIndex && candidates.some((c) => provenSupport(role, c)));
  const queue: Node[] = [{ actor: b.actor, parts: b.parts, steps: [], priority: 0 }];
  const seen = new Map<string, number>(),
    queued = new Map<string, number>();
  let best: Project | null = null,
    contact: Project | null = null;
  let bestKnown = false;
  for (let expanded = 0; queue.length && expanded < limits.maxNodes; ) {
    queue.sort((a, c) => c.priority - a.priority);
    const n = queue.pop()!;
    const paths = walking(b, n.actor, n.parts, denied);
    const key = [Math.min(...paths.keys()), ...n.parts].join('/');
    if ((seen.get(key) ?? Infinity) <= n.steps.length) continue;
    seen.set(key, n.steps.length);
    expanded++;
    for (const goal of b.goals) {
      const tail = paths.get(goal);
      if (tail && n.steps.length + tail.length > 0 && n.steps.length + tail.length <= limits.maxDepth)
        return { purpose: 'reach_goal', site: goal, steps: [...n.steps, ...tail] };
    }
    if (best && (!seekKnown || bestKnown) && n.steps.length >= best.steps.length - 1) continue;
    for (const [i, obj] of n.parts.entries())
      for (const motor of b.motors) {
        const stance = stepCell(b, obj, -motor.delta),
          dest = stepCell(b, obj, motor.delta);
        const approach = paths.get(stance),
          role = b.roles[i]!;
        if (!approach || dest < 0 || n.parts.includes(dest) || denied.has(edgeKey(stance, motor.op, n.parts))) continue;
        if (
          !n.steps.length &&
          localUnknown.size &&
          (!localUnknown.has(role) || approach.some((s) => s.op === b.transport?.op))
        )
          continue;
        const gap = !b.floor.has(dest);
        if (gap && (i === b.pivotIndex || !sites.has(dest))) continue;
        const step: Step = {
          op: motor.op,
          from: stance,
          to: obj,
          placed: dest,
          role,
          ...(gap ? { boundary: true } : {}),
        };
        const steps = [...n.steps, ...approach, step];
        if (steps.length > limits.maxDepth) continue;
        if (gap) {
          const known = provenSupport?.(role, dest) ?? false;
          if (!best || (known && !bestKnown) || (known === bestKnown && steps.length < best.steps.length)) {
            best = { purpose: 'test_support', site: dest, role, steps };
            bestKnown = known;
          }
          continue;
        }
        if (
          !n.steps.length &&
          localUnknown.has(role) &&
          !approach.some((s) => s.op === b.transport?.op) &&
          (!contact || steps.length < contact.steps.length)
        )
          contact = { purpose: 'test_contact', site: obj, role, steps };
        const parts = n.parts.slice();
        parts[i] = dest;
        const queuedKey = [obj, ...parts].join('/');
        if ((queued.get(queuedKey) ?? Infinity) <= steps.length) continue;
        queued.set(queuedKey, steps.length);
        const estimate = candidates.length
          ? Math.min(
              ...parts.flatMap((v, j) => (j === b.pivotIndex ? [] : candidates.map((c) => distance(v, c, b.width))))
            )
          : 0;
        queue.push({ actor: obj, parts, steps, priority: steps.length + estimate });
      }
    if (!b.goals.length) return contact;
    if (best && (!seekKnown || bestKnown) && queue.every((v) => v.priority >= best!.steps.length)) break;
  }
  return best ?? contact;
}
