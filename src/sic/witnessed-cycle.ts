export type WitnessedCycle<T> = { onset: number; phases: T[]; witnesses: number[] };

/** An observed suffix must predict fresh samples in every phase after two cycles. */
export function inferWitnessedSuffixCycle<T>(
  samples: readonly (T | null)[], equal: (a: T, b: T) => boolean = Object.is,
): WitnessedCycle<T> | undefined {
  let accepted: WitnessedCycle<T> | undefined;
  for (let period = 2; period * 3 + 3 <= samples.length; period++) {
    for (let onset = 3; onset <= 6 && onset + period * 3 <= samples.length; onset++) {
      const preceding = samples[onset - 1];
      if (preceding == null) continue;
      const phases = Array<T>(period), witnesses = Array<number>(period).fill(0);
      const late = new Set<number>();
      let agrees = true;
      for (let index = onset; index < samples.length; index++) {
        const sample = samples[index];
        if (sample == null) continue;
        const phase = (index - onset) % period;
        if (witnesses[phase] && !equal(phases[phase]!, sample)) {
          agrees = false;
          break;
        }
        phases[phase] = sample;
        witnesses[phase]!++;
        if (index >= onset + 2 * period) late.add(phase);
      }
      if (!agrees || witnesses.some(count => count < 3) || late.size !== period
        || equal(preceding, phases[period - 1]!) || phases.every(phase => equal(phase, phases[0]!))) continue;
      let conflicts = 0;
      for (let index = Math.max(0, onset - period); index < onset; index++) {
        const observed = samples[index];
        if (observed != null && !equal(observed, phases[index - onset + period]!)) conflicts++;
      }
      if (conflicts < 3) continue;
      if (accepted) {
        for (let index = samples.length; index < samples.length + period + accepted.phases.length; index++) {
          if (!equal(phases[(index - onset) % period]!,
            accepted.phases[(index - accepted.onset) % accepted.phases.length]!)) return;
        }
      } else {
        accepted = { onset, phases, witnesses };
      }
    }
  }
  return accepted;
}
