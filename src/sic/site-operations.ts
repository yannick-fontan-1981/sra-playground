import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, size, type XY } from './access-terrain.ts';

export type SiteOperation = {
  shape: string;
  at: XY;
  ref: number;
  op: string;
  before: string;
  address?: XY;
  displacement?: XY;
};
export type SiteLedger = Record<string, SiteOperation>;

const geometries = new WeakMap<NativeEntity, string>();
export function siteShape(e: NativeEntity) {
  const old = geometries.get(e);
  if (old) return old;
  // The local mask is ordered by the native observer. Exclude colour and world position.
  let a = 2166136261,
    b = 5381;
  for (const [x, y] of e.mask) {
    a = Math.imul(a ^ x, 16777619);
    a = Math.imul(a ^ y, 16777619);
    b = Math.imul(b, 33) + x;
    b = Math.imul(b, 33) + y;
  }
  const k = [e.area, e.bbox[2] - e.bbox[0], e.bbox[3] - e.bbox[1], a >>> 0, b >>> 0].join('/');
  geometries.set(e, k);
  return k;
}
export const siteKey = (shape: string, at: readonly number[]) => shape + '@' + at.join();
export function siteParts(o: NativeObservation, rows: NativeRows) {
  const cap = (rows.length * rows[0]!.length) / 12;
  return o.entities.filter((e) => e.area > 0 && e.area <= cap);
}
// Compare the local substrate under an operation without imposing palette labels on it.
export function siteSubstrate(rows: NativeRows, p: XY) {
  const seen = new Map<number, number>(),
    result: number[] = [];
  for (let y = p[1] - 2; y <= p[1] + 2; y++)
    for (let x = p[0] - 2; x <= p[0] + 2; x++) {
      const ink = rows[y]?.[x];
      if (ink === undefined) {
        result.push(-1);
        continue;
      }
      if (!seen.has(ink)) seen.set(ink, seen.size);
      result.push(seen.get(ink)!);
    }
  return result.join('.');
}
export function witnessedSites(
  prior: SiteLedger,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  op: string
): SiteLedger {
  if (b.level_epoch !== a.level_epoch || a.levels_completed > b.levels_completed) return {};
  if (b.frame_hash === a.frame_hash) return prior;
  const before = siteParts(b, rows),
    old = new Set(before.map((e) => siteKey(siteShape(e), e.position)));
  const identities = new Map(before.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  const address = op.includes(':') ? (op.split(':')[1]!.split(',').map(Number) as XY) : null;
  const result: SiteLedger = {};
  for (const e of siteParts(a, next)) {
    const at: XY = [...e.position],
      shape = siteShape(e),
      key = siteKey(shape, at);
    if (old.has(key)) {
      if (prior[key]) result[key] = prior[key]!;
      continue;
    }
    const previous = !e.identity_ambiguous ? identities.get(e.signature) : undefined;
    const delta = previous ? diff(at, [...previous.position]) : null;
    const local =
      address &&
      address[0] >= e.bbox[0] - 1 &&
      address[0] <= e.bbox[2] + 1 &&
      address[1] >= e.bbox[1] - 1 &&
      address[1] <= e.bbox[3] + 1;
    result[key] = {
      at,
      shape,
      ref: a.revision,
      op,
      before: siteSubstrate(rows, at),
      ...(local ? { address: diff(address!, at) } : {}),
      ...(delta && size(delta) ? { displacement: delta } : {}),
    };
  }
  return result;
}
export function transferAddress(site: SiteOperation, at: XY, rows: NativeRows, available: Set<string>) {
  if (!site.address || site.before !== siteSubstrate(rows, at)) return null;
  const key = 'ACTION6:' + add(at, site.address).join();
  return available.has(key) ? key : null;
}
