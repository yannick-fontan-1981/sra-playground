export interface HypothesisPartition {
  readonly outcomes: number;
  readonly remaining: number;
  readonly eliminatedShare: { readonly n: bigint; readonly d: bigint };
}

/** Each group contains the hypotheses predicting the same observable return. */
export function assessHypothesisPartition(groups: Iterable<number>): HypothesisPartition | null {
  let total = 0, remaining = 0, outcomes = 0;
  for (const size of groups) {
    if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('A hypothesis group must have a nonnegative integer size.');
    if (size === 0) continue;
    total += size;
    if (!Number.isSafeInteger(total)) throw new RangeError('The hypothesis count exceeds the supported range.');
    remaining = Math.max(remaining, size);
    outcomes++;
  }
  if (total === 0) return null;
  const eliminated = BigInt(total - remaining);
  let a = eliminated, b = BigInt(total);
  while (b) [a, b] = [b, a % b];
  return { outcomes, remaining, eliminatedShare: { n: eliminated / a, d: BigInt(total) / a } };
}

export function compareSeparation(first: HypothesisPartition['eliminatedShare'], second: HypothesisPartition['eliminatedShare']): number {
  const difference = first.n * second.d - second.n * first.d;
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}
