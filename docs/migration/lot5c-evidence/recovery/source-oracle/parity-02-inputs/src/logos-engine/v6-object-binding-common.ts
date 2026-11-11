/** Source-value helpers and explicitly native cooperative limits for
 * guarded_binding. Limits never constitute acquired source knowledge. */
import { compareUnicode } from './canonical.ts';
import { copyNativeValue } from './v6-native-owned.ts';
import { pythonEqual, pythonTruthy } from './v6-operations.ts';
import type { NativeExecution } from './v6-native-types.ts';

export type BindingRecord = Record<string, any>;
export type BindingPoint = readonly [number, number];
export type BindingFloatPath = readonly (string | number)[];
export const bindingClone = <T>(value: T): T => copyNativeValue(value);
export const bindingEqual = pythonEqual;
export const bindingTruthy = pythonTruthy;
export const bindingKey = (point: readonly number[]): string => JSON.stringify(point);
export const bindingUnique = <T>(values: readonly T[]): T[] => [...new Set(values)];
export function bindingCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const delta = bindingCompare(a[i], b[i]); if (delta) return delta; }
    return a.length - b.length;
  }
  return typeof a === 'string' && typeof b === 'string' ? compareUnicode(a, b) : Number(a) - Number(b);
}

export interface BindingSearchBounds { maximumNodes?: number; maximumWork?: number }
export const OBSERVED_BINDING_NATIVE_SEARCH_BOUNDS = Object.freeze({ maximumNodes: 65_536, maximumWork: 2_000_000 });
export class BindingWorkBound extends Error {
  readonly bound: string;
  readonly nodes: number;
  readonly work: number;
  constructor(bound: string, nodes: number, work: number) {
    super('Observed binding work incomplete: ' + bound);
    this.name = 'BindingWorkBound'; this.bound = bound; this.nodes = nodes; this.work = work;
  }
}
export class BindingWork {
  nodes = 0;
  work = 0;
  readonly bounds: BindingSearchBounds;
  readonly execution: NativeExecution | undefined;
  private nextClockCheck = 256;
  constructor(bounds: BindingSearchBounds = {}, execution?: NativeExecution) {
    this.bounds = bounds; this.execution = execution;
    for (const value of [bounds.maximumNodes, bounds.maximumWork])
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new TypeError('Invalid binding work bound');
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid binding deadline');
    this.check();
  }
  check(): void {
    if (this.execution?.signal?.aborted) throw new BindingWorkBound('aborted', this.nodes, this.work);
    if (this.execution?.deadlineMs !== undefined && (this.execution.now ?? (() => performance.now()))() >= this.execution.deadlineMs)
      throw new BindingWorkBound('deadline', this.nodes, this.work);
  }
  tick(amount = 1): void {
    this.work += amount;
    if (this.bounds.maximumWork !== undefined && this.work > this.bounds.maximumWork)
      throw new BindingWorkBound('maximum_work', this.nodes, this.work);
    if (this.work >= this.nextClockCheck) { this.nextClockCheck = this.work + 256; this.check(); }
  }
  node(): void {
    this.nodes++;
    if (this.bounds.maximumNodes !== undefined && this.nodes > this.bounds.maximumNodes)
      throw new BindingWorkBound('maximum_nodes', this.nodes, this.work);
    this.tick();
  }
  async yield(): Promise<void> { this.check(); if (this.execution) await this.execution.yieldControl(); this.check(); }
}
