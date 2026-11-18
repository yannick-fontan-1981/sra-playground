/** Possible source ranks for each output rank of a tool that reorders a profile. */
export type RankOrder = number[][];
/** For each rank, true complements its height and null leaves the effect unresolved. */
export type HeightInversion = (boolean | null)[];

export function projectHeightInversion(values: readonly number[], ranks: HeightInversion, sum: number): number[] | null {
  if (values.length !== ranks.length || values.some((value, i) => ranks[i] === null && sum - value !== value)) return null;
  return values.map((value, i) => ranks[i] ? sum - value : value);
}

export function observeHeightInversion(before: readonly number[], after: readonly number[], sum: number,
  prior?: HeightInversion): HeightInversion | null {
  if (before.length !== after.length || prior && before.length !== prior.length) return null;
  const ranks: HeightInversion = [];
  for (const [i, original] of before.entries()) {
    const actual = after[i]!, known = prior?.[i];
    const unchanged = actual === original, reflected = actual === sum - original;
    if (!unchanged && !reflected || known === true && !reflected || known === false && !unchanged) return null;
    ranks.push(known ?? (unchanged && reflected ? null : reflected));
  }
  return ranks.includes(true) && (!prior || ranks.some((rank, i) => rank !== prior[i])) ? ranks : null;
}

function hasBijection(order: RankOrder): boolean {
  const assigned = new Map<number, number>();
  function place(output: number, tried: Set<number>): boolean {
    for (const source of order[output]!) {
      if (tried.has(source)) continue;
      tried.add(source);
      const displaced = assigned.get(source);
      if (displaced !== undefined && !place(displaced, tried)) continue;
      assigned.set(source, output);
      return true;
    }
    return false;
  }
  return order.every((_, output) => place(output, new Set()));
}

export function observeRankOrder(first: readonly number[], second: readonly number[], prior?: RankOrder): RankOrder | null {
  if (first.length !== second.length || prior && prior.length !== second.length) return null;
  const sources = first.map((_, index) => index);
  const order = second.map((value, output) => (prior?.[output] ?? sources).filter(source => first[source] === value));
  return hasBijection(order) ? order : null;
}

export function projectRankOrder(values: readonly number[], order: RankOrder): number[] | null {
  if (values.length !== order.length) return null;
  const result = [];
  for (const sources of order) {
    const value = values[sources[0]!];
    if (value === undefined || sources.some(source => values[source] !== value)) return null;
    result.push(value);
  }
  return result;
}

const reverseRank = (rank: number, length: number) => length - 1 - rank;
const shiftedRank = (rank: number, length: number) => (rank + length - 1) % length;
const matchesPattern = (order: RankOrder, source: (rank: number, length: number) => number) =>
  order.every((possible, rank) => possible.length === 1 && possible[0] === source(rank, order.length));

export function resizeRankOrder(order: RankOrder, length: number): RankOrder | null {
  if (order.length === length) return order;
  const patterns = [reverseRank, shiftedRank].filter(pattern => matchesPattern(order, pattern));
  return patterns.length === 1 ? Array.from({ length }, (_, index) => [patterns[0]!(index, length)]) : null;
}

export function describeRankOrder(order: RankOrder): string {
  if (matchesPattern(order, reverseRank)) {
    return 'Reverse the order of the teeth';
  }
  if (matchesPattern(order, shiftedRank)) {
    return 'Move the last tooth to the front and shift the others one place';
  }
  return 'Reorder the teeth using the observed position mapping';
}
