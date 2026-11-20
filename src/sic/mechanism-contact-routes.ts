import { add, diff, same, type XY } from './access-terrain.ts';
import type { Motor } from './local-progress.ts';
import type { LayoutStep } from './reachable-preview-configurations.ts';
const k = (p: XY) => p.join();
export function pathToContact(from: XY, c: XY, motors: Motor[], open: (at: XY) => boolean) {
  const queue = [from],
    parents = new Map<string, LayoutStep>(),
    result: { path: LayoutStep[]; possible: number; opened: number; recoverable: boolean }[] = [];
  for (const p of queue)
    for (const motor of motors) {
      const to = add(p, motor.d);
      if (same(c, to)) {
        const placed = add(to, motor.d);
        if (!open(placed)) continue;

        const steps: LayoutStep[] = [];
        let v = p;
        while (!same(v, from)) {
          const step = parents.get(k(v))!;
          steps.push(step);
          v = step.p;
        }
        steps.reverse();
        result.push({
          path: [...steps, { op: motor.op, stage: 'write', p, c, to, placed }],
          possible: 0,
          opened: 0,
          recoverable: false,
        });
        continue;
      }
      if (!open(to) || same(to, from) || parents.has(k(to))) continue;
      parents.set(k(to), { op: motor.op, stage: 'move', p, c, to, placed: c });
      queue.push(to);
    }
  const home = new Set(queue.map(k));
  for (const option of result) {
    const placed = option.path.at(-1)!.placed,
      accessible = new Set([k(c)]),
      after = [c];
    for (const position of after)
      for (const motor of motors) {
        const next = add(position, motor.d);
        if (!same(next, placed) && open(next) && !accessible.has(k(next))) {
          accessible.add(k(next));
          after.push(next);
        }
      }
    const possible = motors.filter((m) => accessible.has(k(diff(placed, m.d))) && open(add(placed, m.d)));
    option.possible = possible.length;
    option.recoverable = possible.some((m) => same(add(placed, m.d), c));
    option.opened = after.filter((p) => !same(p, c) && !home.has(k(p))).length;
  }
  return result;
}
