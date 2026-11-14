export type PredictionTrial<Value> = {
  readonly address: string;
  readonly hypotheses: readonly string[];
  readonly expected: Value;
  readonly actual: Value | null;
  readonly ref: string;
};

/** A rule gains support from distinct sites in distinct observed returns. */
export function independentPredictionSupport<Value>(
  hypotheses: readonly string[], trials: readonly PredictionTrial<Value>[],
) {
  return hypotheses.map(hypothesis => {
    const refs = new Set<string>(), addresses = new Set<string>();
    const matches = trials.filter(trial => {
      if (trial.actual === null || !Object.is(trial.expected, trial.actual)
        || !trial.hypotheses.includes(hypothesis) || refs.has(trial.ref) || addresses.has(trial.address)) return false;
      refs.add(trial.ref);
      addresses.add(trial.address);
      return true;
    });
    return { hypothesis, matches };
  }).sort((a, b) => b.matches.length - a.matches.length);
}
