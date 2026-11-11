/** Exact-data helpers shared by the consumed addressed-field and stock owners.
 * All roles, coordinates and distance bounds come from public observations. */
import { compareUnicode } from './canonical.ts';
import { fillContainmentSupport } from './v6-containment.ts';
import { sha256Bytes } from './v6-hash.ts';
import { copyNativeValue } from './v6-native-owned.ts';
import type { NativeExecution } from './v6-native-types.ts';

export type AddressedRecord = Record<string, any>;
export type AddressedPoint = readonly [number, number];
export const addressedKey = (value: unknown): string => JSON.stringify(value);
export const addressedClone = <T>(value: T): T => copyNativeValue(value);

export function addressedEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => addressedEqual(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && addressedEqual(a[k], b[k]));
}
export function addressedCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = addressedCompare(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  if (typeof a === 'string' && typeof b === 'string') return compareUnicode(a, b);
  return Number(a) - Number(b);
}
/** The consumed common_multiscale_constraints.digest uses sorted, compact,
 * ASCII JSON. Its addressed-field/stock inputs contain exact integers. */
export function addressedPythonJson(value: any): string {
  const ascii = (s: string) => JSON.stringify(s).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (value === null) return 'null';
  if (typeof value === 'string') return ascii(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new TypeError('Addressed digests require exact native integers'); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(addressedPythonJson).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort(compareUnicode).map(k => ascii(k) + ':' + addressedPythonJson(value[k])).join(',') + '}';
  throw new TypeError('Addressed digest requires explicit JSON values');
}
export const addressedDigest = (value: unknown): string => sha256Bytes(new TextEncoder().encode(addressedPythonJson(value)));
export const addressedContains = (outer: readonly number[], inner: readonly number[]): boolean =>
  outer[0]! <= inner[0]! && outer[1]! <= inner[1]! && outer[2]! >= inner[2]! && outer[3]! >= inner[3]!;

/** Same exterior flood as common_containment.filled. The uninstrumented path
 * shares the already transferred helper; instrumentation does not change its set. */
export function addressedFilled(support: ReadonlySet<string>, width: number, height: number, work?: AddressedWork): Set<string> {
  if (!work) return new Set(fillContainmentSupport([...support].map(k => JSON.parse(k) as AddressedPoint), width, height).map(addressedKey));
  const exterior = new Set([addressedKey([-1, -1])]), queue: AddressedPoint[] = [[-1, -1]];
  for (let head = 0; head < queue.length; head++) {
    work.node(); const [x, y] = queue[head]!;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
      work.tick(); const nx = x + dx, ny = y + dy, key = addressedKey([nx, ny]);
      if (-1 <= nx && nx <= width && -1 <= ny && ny <= height && !exterior.has(key) && !support.has(key)) { exterior.add(key); queue.push([nx, ny]); }
    }
  }
  const result = new Set<string>();
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) { work.tick(); const key = addressedKey([x, y]); if (!exterior.has(key)) result.add(key); }
  return result;
}

export interface AddressedSearchBounds { maximumNodes?: number; maximumWork?: number }
/** Native cooperative limits are explicit extensions, not source policy. */
export const ADDRESSED_NATIVE_SEARCH_BOUNDS = Object.freeze({ maximumNodes: 65_536, maximumWork: 2_000_000 });
export class AddressedWorkBound extends Error {
  readonly bound: string; readonly nodes: number; readonly work: number;
  constructor(bound: string, nodes: number, work: number) {
    super('Addressed material search incomplete: ' + bound); this.name = 'AddressedWorkBound'; this.bound = bound; this.nodes = nodes; this.work = work;
  }
}
export class AddressedWork {
  nodes = 0; work = 0;
  readonly bounds: AddressedSearchBounds; readonly execution: NativeExecution | undefined;
  private nextClockCheck = 256;
  constructor(bounds: AddressedSearchBounds = {}, execution?: NativeExecution) {
    this.bounds = bounds; this.execution = execution;
    for (const n of [bounds.maximumNodes, bounds.maximumWork]) if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new TypeError('Invalid addressed work bound');
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid addressed deadline');
    this.check();
  }
  check(): void {
    if (this.execution?.signal?.aborted) throw new AddressedWorkBound('aborted', this.nodes, this.work);
    if (this.execution?.deadlineMs !== undefined && (this.execution.now ?? (() => performance.now()))() >= this.execution.deadlineMs)
      throw new AddressedWorkBound('deadline', this.nodes, this.work);
  }
  tick(amount = 1): void {
    this.work += amount;
    if (this.bounds.maximumWork !== undefined && this.work > this.bounds.maximumWork) throw new AddressedWorkBound('maximum_work', this.nodes, this.work);
    if (this.work >= this.nextClockCheck) { this.nextClockCheck = this.work + 256; this.check(); }
  }
  node(): void {
    this.nodes++;
    if (this.bounds.maximumNodes !== undefined && this.nodes > this.bounds.maximumNodes) throw new AddressedWorkBound('maximum_nodes', this.nodes, this.work);
    this.tick();
  }
  async yield(): Promise<void> { this.check(); if (this.execution) await this.execution.yieldControl(); this.check(); }
}
