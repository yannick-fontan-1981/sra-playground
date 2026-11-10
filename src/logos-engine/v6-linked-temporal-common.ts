/** Shared exact-data helpers for the consumed V6 linked-temporal adapter.
 * No coordinate, palette role or input direction is supplied by this module. */
import { compareUnicode } from './canonical.ts';
import { sha256Bytes } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeExecution, NativeRows } from './v6-native-types.ts';

export type TemporalRecord = Record<string, any>;
export type TemporalPoint = readonly [number, number];
export type TemporalSize = readonly [number, number];
export type TemporalPixelChange = readonly [number, number, number, number];
export type TemporalRouteStep = readonly [TemporalPoint, TemporalPoint, TemporalPoint];
export const temporalKey = (value: unknown): string => JSON.stringify(value);
export const temporalPointKey = (point: TemporalPoint): string => temporalKey(point);
export const temporalPoint = (key: string): TemporalPoint => JSON.parse(key) as TemporalPoint;
export const temporalAdd = (a: TemporalPoint, b: TemporalPoint): TemporalPoint => [a[0] + b[0], a[1] + b[1]];
export const temporalMinus = (a: TemporalPoint, b: TemporalPoint): TemporalPoint => [a[0] - b[0], a[1] - b[1]];
export const temporalModulo = (a: number, b: number): number => ((a % b) + b) % b;

export function temporalEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => temporalEqual(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && temporalEqual(a[k], b[k]));
}
export function temporalCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = temporalCompare(a[i], b[i]); if (c) return c; }
    return a.length - b.length;
  }
  if (typeof a === 'string' && typeof b === 'string') return compareUnicode(a, b);
  return Number(a) - Number(b);
}
export function temporalOwn(object: TemporalRecord, key: string, value: any): void {
  Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
}
export function temporalDictionary(): TemporalRecord { return Object.create(null) as TemporalRecord; }
export function temporalClone<T>(value: T): T { return structuredClone(value); }
export function temporalPythonJson(value: any, spaced = true): string {
  const ascii = (s: string) => JSON.stringify(s).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const comma = spaced ? ', ' : ',', colon = spaced ? ': ' : ':';
  if (value === null) return 'null';
  if (typeof value === 'string') return ascii(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) throw new TypeError('Linked temporal digests require exact native integers'); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(v => temporalPythonJson(v, spaced)).join(comma) + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort(compareUnicode).map(k => ascii(k) + colon + temporalPythonJson(value[k], spaced)).join(comma) + '}';
  throw new TypeError('Linked temporal digest requires JSON values');
}
export const temporalDigest = (value: unknown, spaced = true): string => sha256Bytes(new TextEncoder().encode(temporalPythonJson(value, spaced)));

/** NumPy positive/negative slice normalization, without inventing padding. */
export function temporalPatch(rows: NativeRows, position: TemporalPoint, size: TemporalSize): number[][] {
  const [x, y] = position, [w, h] = size;
  const index = (v: number, n: number) => Math.min(n, Math.max(0, v < 0 ? n + v : v));
  const top = index(y, rows.length), bottom = index(y + h, rows.length), width = rows[0]?.length ?? 0;
  const left = index(x, width), right = index(x + w, width);
  return rows.slice(top, Math.max(top, bottom)).map(row => row.slice(left, Math.max(left, right)));
}
/** PhaseTransfer.patch is strict and serializes uint8 C-order bytes. */
export function temporalBytePatch(rows: NativeRows, position: TemporalPoint, size: TemporalSize): number[] | null {
  const [x, y] = position, [w, h] = size;
  if (x < 0 || y < 0 || x + w > (rows[0]?.length ?? 0) || y + h > rows.length) return null;
  return rows.slice(y, y + h).flatMap(row => row.slice(x, x + w));
}
export function temporalPixel(rows: NativeRows, x: number, y: number): number {
  const row = rows.at(y), value = row?.at(x);
  if (value === undefined) throw new RangeError('Linked temporal pixel exceeds the public raster');
  return value;
}
export function temporalRectangle(position: TemporalPoint, size: TemporalSize): Set<string> {
  const result = new Set<string>();
  for (let dy = 0; dy < size[1]; dy++) for (let dx = 0; dx < size[0]; dx++) result.add(temporalPointKey([position[0] + dx, position[1] + dy]));
  return result;
}
export const temporalContains = (values: readonly any[], value: any): boolean => values.some(v => temporalEqual(v, value));
export const temporalCompressed = (values: readonly (TemporalPoint | undefined | null)[]): TemporalPoint[] => {
  const result: TemporalPoint[] = []; for (const value of values) if (value != null && (!result.length || !temporalEqual(value, result.at(-1)))) result.push(value); return result;
};
export function temporalMapState(map: ReadonlyMap<string, any>): any[] { return [...map].map(([key, value]) => [JSON.parse(key), value]); }
export function temporalSetState(set: ReadonlySet<string>): any[] { return [...set].map(k => JSON.parse(k)).sort(temporalCompare); }
export function temporalRestoreMap(value: readonly any[]): Map<string, any> { return new Map(value.map(([key, item]) => [temporalKey(key), temporalClone(item)])); }
export function temporalRestoreSet(value: readonly any[]): Set<string> { return new Set(value.map(temporalKey)); }

export interface LinkedTemporalSearchBounds { maximumNodes?: number; maximumWork?: number }
export const LINKED_TEMPORAL_NATIVE_SEARCH_BOUNDS = Object.freeze({ maximumNodes: 65_536, maximumWork: 2_000_000 });
export class LinkedTemporalWorkBound extends Error {
  readonly bound: string; readonly nodes: number; readonly work: number;
  constructor(bound: string, nodes: number, work: number) { super('Linked temporal search incomplete: ' + bound); this.name = 'LinkedTemporalWorkBound'; this.bound = bound; this.nodes = nodes; this.work = work; }
}
/** Work limits are a named native option. The source-compatible API has none. */
export class LinkedTemporalWork {
  nodes = 0; work = 0;
  readonly bounds: LinkedTemporalSearchBounds; readonly execution: NativeExecution | undefined;
  constructor(bounds: LinkedTemporalSearchBounds = {}, execution?: NativeExecution) {
    this.bounds = bounds; this.execution = execution;
    for (const n of [bounds.maximumNodes, bounds.maximumWork]) if (n !== undefined && (!Number.isSafeInteger(n) || n < 0)) throw new TypeError('Invalid linked temporal work bound');
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid linked temporal deadline');
    this.check();
  }
  check(): void {
    if (this.execution?.signal?.aborted) throw new LinkedTemporalWorkBound('aborted', this.nodes, this.work);
    if (this.execution?.deadlineMs !== undefined && (this.execution.now ?? (() => performance.now()))() >= this.execution.deadlineMs)
      throw new LinkedTemporalWorkBound('deadline', this.nodes, this.work);
  }
  tick(amount = 1): void {
    this.work += amount;
    if (this.bounds.maximumWork !== undefined && this.work > this.bounds.maximumWork) throw new LinkedTemporalWorkBound('maximum_work', this.nodes, this.work);
    if ((this.work & 255) === 0) this.check();
  }
  node(): void {
    this.nodes++;
    if (this.bounds.maximumNodes !== undefined && this.nodes > this.bounds.maximumNodes) throw new LinkedTemporalWorkBound('maximum_nodes', this.nodes, this.work);
    this.tick();
  }
}
export function temporalOwned<T>(value: T): T { return retainNativeJson(value); }
