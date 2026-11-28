/** Observation-only P14 hypotheses. No evaluator, case identifier or wall clock is read here. */
export type TemporalSample = { tick: number; value: number | null; ref: string; reliable: boolean };
export type TemporalPrediction = { value: number; evidence: string[] };
export type TemporalHypothesis = {
  period: number;
  since: number;
  phases: number[];
  evidence: string[];
};

type Witness = { tick: number; value: number; ref: string };
type PeriodState = { period: number; since: number; phases: Witness[][]; boundary: string[] };

/**
 * Keeps the longest suffix compatible with each bounded period. A phase needs three
 * separately dated witnesses; constant suffixes cannot establish an opening cycle.
 * The bound is an explicit inductive capability, not knowledge of a world's period.
 */
export function createTemporalEvidence(options: { maxPeriod?: number; witnesses?: number } = {}) {
  const maxPeriod = options.maxPeriod ?? 24, witnesses = options.witnesses ?? 3;
  if (!Number.isInteger(maxPeriod) || maxPeriod < 2 || maxPeriod > 128
    || !Number.isInteger(witnesses) || witnesses < 3) throw new Error('Invalid temporal inference bound');
  const periods: PeriodState[] = Array.from({ length: maxPeriod - 1 }, (_, index) => ({
    period: index + 2, since: 0, phases: Array.from({ length: index + 2 }, () => []), boundary: [],
  }));
  let latest = -1, accepted: TemporalHypothesis[] | null = null;
  return {
    observe(sample: TemporalSample) {
      if (!Number.isSafeInteger(sample.tick) || sample.tick < 0) throw new Error('Invalid game tick');
      if (!sample.reliable || sample.value === null) return;
      if (sample.tick <= latest) throw new Error('Temporal witnesses must be ordered and unique');
      latest = sample.tick;
      accepted = null;
      for (const state of periods) {
        const residue = sample.tick % state.period, previous = state.phases[residue]!.at(-1);
        if (previous && previous.value !== sample.value) {
          state.since = Math.max(state.since, previous.tick + 1);
          state.boundary = [previous.ref, sample.ref];
          for (let index = 0; index < state.period; index++) {
            state.phases[index] = state.phases[index]!.filter(item => item.tick >= state.since);
          }
        }
        const phase = state.phases[residue]!;
        phase.push({ tick: sample.tick, value: sample.value, ref: sample.ref });
        if (phase.length > witnesses) phase.shift();
      }
    },
    hypotheses(): TemporalHypothesis[] {
      if (accepted) return accepted;
      accepted = [];
      for (const state of periods) {
        if (state.phases.some(phase => phase.length < witnesses)) continue;
        const phases = state.phases.map(phase => phase.at(-1)!.value);
        if (phases.every(value => value === phases[0])) continue;
        // Old measurements of an unseen phase are not fresh support for its reuse.
        if (state.phases.some(phase => latest - phase.at(-1)!.tick >= 2 * state.period)) continue;
        accepted.push({ period: state.period, since: state.since, phases,
          evidence: [...new Set([...state.boundary, ...state.phases.flatMap(phase => phase.map(item => item.ref))])] });
      }
      return accepted;
    },
    predict(tick: number): TemporalPrediction | undefined {
      const alternatives = this.hypotheses();
      if (!alternatives.length) return;
      const values = alternatives.map(model => model.phases[tick % model.period]!);
      if (values.some(value => value !== values[0])) return;
      return { value: values[0]!, evidence: [...new Set(alternatives.flatMap(model => model.evidence))] };
    },
  };
}

export type DelayedResponse = { delay: number; width: number; evidence: string[] };

/** A complete reliable command-relative 0→1→0 return establishes a bounded pulse. */
export function inferDelayedResponse(samples: readonly TemporalSample[], start: number): DelayedResponse | undefined {
  const reliable = samples.filter(sample => sample.reliable && sample.value !== null && sample.tick >= start);
  const opening = reliable.find(sample => sample.value === 1);
  if (!opening || opening.tick <= start) return;
  const closing = reliable.find(sample => sample.tick > opening.tick && sample.value === 0);
  if (!closing) return;
  const byTick = new Map(reliable.map(sample => [sample.tick, sample]));
  const evidence: string[] = [];
  for (let tick = start; tick <= closing.tick; tick++) {
    const sample = byTick.get(tick);
    if (!sample || sample.value !== (tick >= opening.tick && tick < closing.tick ? 1 : 0)) return;
    evidence.push(sample.ref);
  }
  return { delay: opening.tick - start, width: closing.tick - opening.tick, evidence };
}
