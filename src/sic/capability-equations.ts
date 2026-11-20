import { add, diff, same, type XY } from './access-terrain.ts';

/** For output role i, read the input pose of source[i] and add offset[i].
 * Roles refer to publicly distinguishable components, not physical identities. */
export type PoseOperator = { source: number[]; offset: XY[] };
export const translation = (vectors: XY[]): PoseOperator => ({
  source: vectors.map((_, i) => i),
  offset: vectors,
});
export function applyOperator(f: PoseOperator, positions: XY[]): XY[] {
  return f.source.map((j, i) => add(positions[j]!, f.offset[i]!));
}
/** Sequential composition: act with first, then second. */
export function compose(first: PoseOperator, second: PoseOperator): PoseOperator {
  if (first.source.length !== second.source.length) throw Error('Incompatible role domains');
  return {
    source: second.source.map((j) => first.source[j]!),
    offset: second.source.map((j, i) => add(first.offset[j]!, second.offset[i]!)),
  };
}
export function inverse(f: PoseOperator): PoseOperator {
  const n = f.source.length,
    source = new Array<number>(n),
    offset = new Array<XY>(n);
  if (new Set(f.source).size !== n || f.source.some((i) => !Number.isInteger(i) || i < 0 || i >= n))
    throw Error('Role map is not invertible');
  f.source.forEach((j, i) => {
    source[j] = i;
    offset[j] = diff([0, 0], f.offset[i]!);
  });
  return { source, offset };
}
/** Solve X followed by P = P followed by U for the unknown capability X. */
export function inferCapability(p: PoseOperator, u: PoseOperator): PoseOperator {
  return compose(compose(p, u), inverse(p));
}
export const posesMatch = (a: XY[] | null, b: XY[]) =>
  !!a && a.length === b.length && a.every((p, i) => same(p, b[i]!));
