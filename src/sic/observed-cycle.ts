export type CycleEvidence = { start: number; witnesses: number[] };
export type ObservedCycle<T> = CycleEvidence & { phases: T[] };

type CyclePolicy = { start?: number; minimumPeriod: number; minimumWitnesses: number; closingSample?: boolean };

function measurePeriod<T>(
  samples: readonly (T | null)[], start: number, period: number, minimumWitnesses: number,
  equal: (left: T, right: T) => boolean,
): ObservedCycle<T> | undefined {
  const slots = Array.from({ length: period }, () => ({ value: null as T | null, count: 0 }));
  for (let index = start; index < samples.length; index++) {
    const sample = samples[index]!;
    if (sample === null) continue;
    const phase = slots[(index - start) % period]!;
    if (phase.value !== null && !equal(phase.value, sample)) return;
    phase.value = sample;
    phase.count++;
  }
  if (slots.some(phase => phase.count < minimumWitnesses)) return;
  return { start, phases: slots.map(phase => phase.value!), witnesses: slots.map(phase => phase.count) };
}

export function inferObservedCycle<T>(
  samples: readonly (T | null)[], policy: CyclePolicy,
  equal: (left: T, right: T) => boolean = Object.is,
): ObservedCycle<T> | undefined {
  const { start = 0, minimumPeriod, minimumWitnesses, closingSample = false } = policy;
  const available = samples.length - start - Number(closingSample);
  for (let period = minimumPeriod; period * minimumWitnesses <= available; period++) {
    const cycle = measurePeriod(samples, start, period, minimumWitnesses, equal);
    if (cycle) return cycle;
  }
}

/**
 * Recover a steady cycle after a short, positively witnessed transient.
 * Missing observations provide no evidence. Every observed value after the
 * onset must agree with the same schedule.
 */
export function inferCycleAfterTransient<T>(
  samples: readonly (T | null)[],
  equal: (left: T, right: T) => boolean = Object.is,
  maxTransient = 3,
): ObservedCycle<T> | undefined {
  if (maxTransient < 1) return;
  const minWitnesses = 3;
  for (let period = 2; period * minWitnesses < samples.length; period++) {
    for (let start = 1; start <= maxTransient && start + period * minWitnesses <= samples.length; start++) {
      const predecessor = samples[start - 1];
      if (predecessor == null) continue;
      const cycle = measurePeriod(samples, start, period, minWitnesses, equal);
      if (!cycle) continue;
      const { phases } = cycle;
      if (equal(predecessor, phases[period - 1]!) || phases.every(value => equal(value, phases[0]!))) continue;
      return cycle;
    }
  }
}
