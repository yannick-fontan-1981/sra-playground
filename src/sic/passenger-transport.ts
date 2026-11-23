import { connectingSites, edgeKey, stepCell, walking, type Board, type Project, type Step } from './contact-frontier-search.ts';
import { contactRayClear } from './compose-support-plan.ts';

// Substitute a visible part for the subject of a learned nonlocal action. In
// the experiment only isolated, reversible transfers to supported sites count.
// A witnessed transfer can then be used as an operator in a contact plan.
export function passengerProject(
  board: Board, index: number, witness: string | undefined, permitsSupport: (at: number) => boolean,
  denied: Set<string>, limits: { maxNodes: number; maxDepth: number }
): Project | null {
  const transform = board.transport, pivotIndex = board.pivotIndex, role = board.roles[index]!;
  if (!transform || pivotIndex < 0 || index === pivotIndex || !board.goals.length) return null;
  const gaps = new Set([...connectingSites(board)].filter(permitsSupport));
  if (!gaps.size) return null;
  type Node = { actor: number; parts: number[]; support?: number; steps: Step[]; priority: number };
  const queue: Node[] = [{ actor: board.actor, parts: board.parts, steps: [], priority: 0 }];
  const seen = new Map<string, number>();
  let best: Project | null = null, bestGain = 0;
  const pushes = (b: Board, actor: number, parts: number[]) => {
    const paths = walking({ ...b, transport: undefined }, actor, parts, denied);
    const p = parts[index]!;
    return b.motors.filter(m => {
      const dest = stepCell(b, p, m.delta);
      return paths.has(stepCell(b, p, -m.delta)) && b.floor.has(dest) && !parts.includes(dest);
    }).map(m => m.op);
  };
  const initialPushes = pushes(board, board.actor, board.parts);
  for (let expanded = 0; queue.length && expanded < limits.maxNodes;) {
    queue.sort((a, b) => a.priority - b.priority);
    const n = queue.shift()!;
    if (n.steps.length >= limits.maxDepth || (!witness && bestGain === board.motors.length && best && n.steps.length >= best.steps.length)) continue;
    const floor = n.support === undefined ? board.floor : new Set([...board.floor, n.support]);
    const b = { ...board, floor }, part = n.parts[index]!, pivot = n.parts[pivotIndex]!;
    const projected = part < 0 ? null : transform.land(part, pivot);
    const passengerCanMove = (actor: number) => projected !== null && projected !== part && actor !== projected &&
      !n.parts.includes(projected) && contactRayClear(b, part, projected, pivot, [...n.parts, actor]);
    const subjectLanding = (from: number) => {
      const to = transform.land(from, pivot);
      return to !== null && floor.has(to) && !n.parts.includes(to) && contactRayClear(b, from, to, pivot, n.parts) ? to : null;
    };
    // Walking shortcuts must preserve the positions of every part.
    const paths = walking({ ...b, transport: { op: transform.op, land: from =>
      passengerCanMove(from) ? null : subjectLanding(from) } }, n.actor, n.parts, denied);
    const key = [Math.min(...paths.keys()), ...n.parts, n.support ?? -1].join('/');
    if ((seen.get(key) ?? Infinity) <= n.steps.length) continue;
    seen.set(key, n.steps.length);
    expanded++;
    if (witness) for (const goal of b.goals) {
      const tail = paths.get(goal);
      if (tail && n.steps.length + tail.length <= limits.maxDepth) {
        const steps = [...n.steps, ...tail];
        if (steps.length) return { purpose: 'reach_goal', role, site: goal, steps,
          preparations: steps.filter(s => s.boundary).map(s => ({ at: s.placed!, role, enables: ['subject_entry'] })) };
      }
    }
    const enqueue = (actor: number, parts: number[], steps: Step[], support?: number) => {
      if (steps.length >= limits.maxDepth) return;
      const distance = (a: number, c: number) => Math.abs(a % b.width - c % b.width) +
        Math.abs(Math.floor(a / b.width) - Math.floor(c / b.width));
      const remaining = witness && support === undefined ? Math.min(...[...gaps].map(g => distance(parts[index]!, g))) : 0;
      queue.push({ actor, parts, steps, support, priority: steps.length + remaining * 2 });
    };
    if (projected !== null && floor.has(projected) && !n.parts.includes(projected) &&
        transform.land(projected, pivot) === part) {
      const parts = n.parts.slice();
      parts[index] = projected;
      // Distinct launch stances can leave the subject on different components.
      const launches = new Set<number>();
      for (const [actor, approach] of paths) {
        if (subjectLanding(actor) !== null || !passengerCanMove(actor) || denied.has(edgeKey(actor, transform.op, n.parts))) continue;
        const steps = [...n.steps, ...approach];
        if (steps.length >= limits.maxDepth) continue;
        const region = walking({ ...b, transport: undefined }, actor, parts, denied);
        const component = Math.min(...region.keys());
        if (launches.has(component)) continue;
        launches.add(component);
        const enabled = pushes(b, actor, parts);
        steps.push({ from: actor, to: actor, op: transform.op, role, placed: projected, passenger: { source: part, pushes: enabled } });
        if (witness) enqueue(actor, parts, steps, n.support);
        else {
          const gain = enabled.filter(op => !initialPushes.includes(op)).length;
          if (gain && (gain > bestGain || (gain === bestGain && steps.length < (best?.steps.length ?? Infinity)))) {
            bestGain = gain;
            best = { purpose: 'test_passenger', role, site: projected, steps,
              passenger: { role, source: part, destination: projected, pushes: enabled } };
          }
        }
      }
    }
    for (const i of witness ? [index, pivotIndex] : [pivotIndex]) {
      const p = n.parts[i]!;
      if (p < 0) continue;
      for (const motor of b.motors) {
        const from = stepCell(b, p, -motor.delta), dest = stepCell(b, p, motor.delta), approach = paths.get(from);
        if (!approach || dest < 0 || n.parts.includes(dest) || denied.has(edgeKey(from, motor.op, n.parts))) continue;
        const boundary = !floor.has(dest);
        if (boundary && (i !== index || !gaps.has(dest))) continue;
        const parts = n.parts.slice();
        parts[i] = boundary ? -1 : dest;
        const step = { from, to: p, op: motor.op, role: b.roles[i]!, placed: dest, boundary };
        enqueue(p, parts, [...n.steps, ...approach, step], boundary ? dest : n.support);
      }
    }
  }
  return best;
}
