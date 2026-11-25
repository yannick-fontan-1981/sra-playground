export type ObservedCycle<T> = { start: number; phases: T[] };

/**
 * Recover a steady cycle after a short, positively witnessed transient.
 * Missing observations provide no evidence. Each phase needs three witnesses,
 * and every observed value after the onset must agree with the same schedule.
 */
export function inferCycleAfterTransient<T>(
  samples: readonly (T | null)[],
  equal: (left: T, right: T) => boolean = Object.is,
): ObservedCycle<T> | undefined {
  const maxTransient = 3;
  const minWitnesses = 3;
  for (let period = 2; period * minWitnesses < samples.length; period++) {
    for (let start = 1; start <= maxTransient && start + period * minWitnesses <= samples.length; start++) {
      const predecessor = samples[start - 1];
      if (predecessor == null) continue;
      const phases = Array.from({ length: period }, () => ({ value: null as T | null, count: 0 }));
      const consistent = samples.slice(start).every((sample, offset) => {
        if (sample === null) return true;
        const phase = phases[offset % period]!;
        if (phase.value !== null && !equal(phase.value, sample)) return false;
        phase.value = sample;
        phase.count++;
        return true;
      });
      if (!consistent || phases.some(phase => phase.count < minWitnesses)) continue;
      const values = phases.map(phase => phase.value!);
      if (equal(predecessor, values[period - 1]!) || values.every(value => equal(value, values[0]!))) continue;
      return { start, phases: values };
    }
  }
}
