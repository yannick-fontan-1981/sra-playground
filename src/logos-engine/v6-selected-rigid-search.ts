/** Conditional A* from selected_rigid.mechanism.route. Source tie order and
 * expanded-node accounting are independent of native scheduling checkpoints. */
import type { NativeExecution, NativeRecord } from './v6-native-types.ts';
import { SELECTED_RIGID_DIRECTIONS, selectedRigidMoved, selectedRigidPoses } from './v6-selected-rigid-geometry.ts';
import type { SelectedRigidPoses as Poses, SelectedRigidRouteResult, SelectedRigidRouteStep,
  SelectedRigidScene as Scene } from './v6-selected-rigid-types.ts';

export interface SelectedRigidLimits {
  /** Original source limits; timeBoundMs is applied by the proposing caller. */
  nodeBound: number; timeBoundMs: number;
  /** Explicit native allocation limits. Exhaustion proves no impossibility. */
  retainedStateBound: number; queuedStateBound: number;
  /** Cooperative work interval, separate from the source expanded-node count. */
  yieldInterval: number;
}
export const SELECTED_RIGID_SOURCE_LIMITS = Object.freeze({ nodeBound: 150000, timeBoundMs: 18000 });
export const SELECTED_RIGID_LIMITS: Readonly<SelectedRigidLimits> = Object.freeze({
  ...SELECTED_RIGID_SOURCE_LIMITS, retainedStateBound: 250000, queuedStateBound: 250000, yieldInterval: 256,
});
/** Qualification can tighten bounds but cannot enlarge a source budget. */
export function selectedRigidLimits(value: Partial<SelectedRigidLimits> = {}): SelectedRigidLimits {
  const result = { ...SELECTED_RIGID_LIMITS };
  for (const [key, amount] of Object.entries(value)) {
    const name = key as keyof SelectedRigidLimits;
    if (!Object.hasOwn(SELECTED_RIGID_LIMITS, name) || !Number.isSafeInteger(amount)
      || amount! < (name === 'yieldInterval' ? 1 : 0) || amount! > SELECTED_RIGID_LIMITS[name]) {
      throw new TypeError('Invalid or enlarged SelectedRigid bound: ' + key);
    }
    result[name] = amount!;
  }
  return result;
}
export class SelectedRigidIncomplete extends Error {
  readonly cause: string; readonly examined: number; readonly work: number; readonly frontier: NativeRecord;
  constructor(cause: string, examined: number, work: number, frontier: NativeRecord = {}) {
    super('SelectedRigid native calculation incomplete: ' + cause); this.name = 'SelectedRigidIncomplete';
    this.cause = cause; this.examined = examined; this.work = work; this.frontier = structuredClone(frontier);
  }
}

class Work {
  examined = 0; work = 0; private lastYieldWork = 0;
  readonly execution: NativeExecution | undefined;
  readonly limits: Readonly<SelectedRigidLimits>;
  constructor(execution: NativeExecution | undefined, limits: Readonly<SelectedRigidLimits>) {
    this.execution = execution; this.limits = limits;
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid SelectedRigid request deadline');
    if (execution?.signal?.aborted) this.stop('aborted');
  }
  now(): number {
    const value = (this.execution?.now ?? (() => performance.now()))();
    if (!Number.isFinite(value)) throw new TypeError('SelectedRigid clock must be finite');
    return value;
  }
  stop(cause: string, frontier: NativeRecord = {}): never {
    throw new SelectedRigidIncomplete(cause, this.examined, this.work, frontier);
  }
  check(): void {
    if (this.execution?.signal?.aborted) this.stop('aborted');
    if (this.execution?.deadlineMs !== undefined && this.now() >= this.execution.deadlineMs) this.stop('deadline');
  }
  tick = (): void => {
    this.work++;
    if (this.work % this.limits.yieldInterval === 0) this.check();
  };
  get due(): boolean { return this.work - this.lastYieldWork >= this.limits.yieldInterval; }
  async cooperate(): Promise<void> {
    this.check(); this.lastYieldWork = this.work;
    if (this.execution) await this.execution.yieldControl();
    else await new Promise<void>(resolve => setTimeout(resolve, 0));
    this.check();
  }
}
interface QueueItem {
  estimated: number; cost: number; serial: number; poses: Poses; active: number | null; key: string;
}
const less = (a: QueueItem, b: QueueItem): boolean => a.estimated < b.estimated
  || a.estimated === b.estimated && (a.cost < b.cost || a.cost === b.cost && a.serial < b.serial);

/** Python's unique itertools.count tie breaker means poses are never compared
 * by heapq. A heap sorted by f alone would select a different source path. */
class Queue {
  private readonly values: QueueItem[] = [];
  get size(): number { return this.values.length; }
  push(value: QueueItem): void {
    let index = this.values.length; this.values.push(value);
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (!less(value, this.values[parent]!)) break;
      this.values[index] = this.values[parent]!; index = parent;
    }
    this.values[index] = value;
  }
  pop(): QueueItem {
    const first = this.values[0];
    if (!first) throw new RangeError('Empty SelectedRigid search queue');
    const last = this.values.pop()!;
    if (this.values.length) {
      let index = 0;
      while (index * 2 + 1 < this.values.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.values.length && less(this.values[child + 1]!, this.values[child]!)) child++;
        if (!less(this.values[child]!, last)) break;
        this.values[index] = this.values[child]!; index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
}
const stateKey = (poses: Poses, active: number | null): string => JSON.stringify([poses, active]);

/** deadlineMs is the effective deadline supplied to source route; the family
 * supplies min(current level deadline, its actual now + 18000). Returning
 * [null,nodes] covers source exhaustion/time/node bounds. Native cancellation
 * and allocation bounds throw an explicitly qualified incomplete result. */
export async function selectedRigidRoute(scene: Scene, active: number | null, deadlineMs: number,
  execution?: NativeExecution, options: Partial<SelectedRigidLimits> = {}): Promise<SelectedRigidRouteResult> {
  if (!Number.isFinite(deadlineMs)) throw new TypeError('SelectedRigid route requires a finite deadline');
  const limits = Object.freeze(selectedRigidLimits(options)), work = new Work(execution, limits);
  const start = selectedRigidPoses(scene), targetIndex = scene.bodies.findIndex(body => body.key === scene.receptacle.key);
  if (targetIndex < 0) throw new TypeError('SelectedRigid receptacle has no measured body');
  const goal = scene.receptacle.position, heuristic = (poses: Poses): number =>
    Math.abs(poses[targetIndex]![0] - goal[0]) + Math.abs(poses[targetIndex]![1] - goal[1]);
  const queue = new Queue(), firstKey = stateKey(start, active), best = new Map<string, number>();
  const parent = new Map<string, { previous: string; step: SelectedRigidRouteStep }>();
  let serial = 0, nodes = 0;
  const allocation = (newState: boolean): void => {
    const frontier = { stage: 'conditional_configuration_search', retained_states: best.size, queued_states: queue.size };
    if (newState && best.size >= limits.retainedStateBound) work.stop('NATIVE_RETAINED_STATE_BOUND', frontier);
    if (queue.size >= limits.queuedStateBound) work.stop('NATIVE_QUEUED_STATE_BOUND', frontier);
  };
  allocation(true); best.set(firstKey, 0);
  queue.push({ estimated: heuristic(start), cost: 0, serial: serial++, poses: start, active, key: firstKey });
  while (queue.size && nodes < limits.nodeBound && work.now() < deadlineMs) {
    work.check();
    const current = queue.pop(); work.tick();
    if (best.get(current.key) !== current.cost) {
      if (work.due) await work.cooperate();
      continue;
    }
    nodes++; work.examined = nodes;
    if (current.poses[targetIndex]![0] === goal[0] && current.poses[targetIndex]![1] === goal[1]) {
      let key = current.key;
      const path: SelectedRigidRouteStep[] = [];
      while (parent.has(key)) {
        const previous = parent.get(key)!; path.push(previous.step); key = previous.previous; work.tick();
        if (work.due) await work.cooperate();
      }
      work.check(); path.reverse(); return [path, nodes];
    }
    for (let index = 0; index < current.poses.length; index++) for (const direction of SELECTED_RIGID_DIRECTIONS) {
      work.tick();
      const next = selectedRigidMoved(scene, current.poses, index, direction, work.tick);
      if (next !== current.poses) {
        const cost = current.cost + 1 + Number(current.active !== index), key = stateKey(next, index);
        if (cost < (best.get(key) ?? 1_000_000_000)) {
          allocation(!best.has(key)); best.set(key, cost);
          parent.set(key, { previous: current.key, step: [index, direction, next] });
          queue.push({ estimated: cost + heuristic(next), cost, serial: serial++, poses: next, active: index, key });
        }
      }
      if (work.due) await work.cooperate();
    }
  }
  return [null, nodes];
}
