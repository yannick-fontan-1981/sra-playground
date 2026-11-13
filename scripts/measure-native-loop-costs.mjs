export const OFFICIAL_COST_PROTOCOL = Object.freeze({
  seriesOrder: ['A1', 'B1', 'B2', 'A2'],
  variantBySeries: Object.freeze({ A1: 'A', B1: 'B', B2: 'B', A2: 'A' }),
  games: Object.freeze({
    STCK: Object.freeze({ warmupActions: 3, measuredActions: 10, measuredSessionsPerSeries: 4 }),
    SMLP: Object.freeze({ warmupActions: 3, measuredActions: 15, measuredSessionsPerSeries: 4 }),
  }),
  globalThresholdPercent: 10,
  thresholdIsStrict: true,
  phaseOverrunIsBlocking: false,
  crossGameCompensationAllowed: false,
  measuredSampleRemovalAllowed: false,
});

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) throw new RangeError('median requires at least one value');
  const ordered = values.map(Number).sort((a, b) => a - b);
  if (ordered.some(value => !Number.isFinite(value))) throw new TypeError('median values must be finite');
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function validateSample(sample, descriptor) {
  if (!sample || typeof sample !== 'object') throw new TypeError(`missing sample for ${descriptor}`);
  if (!Number.isFinite(sample.durationMs) || sample.durationMs < 0) {
    throw new RangeError(`invalid durationMs for ${descriptor}`);
  }
  const phases = sample.phases ?? {};
  if (!phases || typeof phases !== 'object' || Array.isArray(phases)) {
    throw new TypeError(`invalid phases for ${descriptor}`);
  }
  for (const [phase, value] of Object.entries(phases)) {
    if (!phase || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`invalid phase sample for ${descriptor}`);
    }
  }
  return {
    durationMs: Number(sample.durationMs),
    phases: Object.fromEntries(Object.entries(phases).map(([phase, value]) => [phase, Number(value)])),
    metadata: sample.metadata === undefined ? undefined : structuredClone(sample.metadata),
  };
}

function relativeIncreasePercent(candidate, baseline) {
  if (baseline === 0) return candidate === 0 ? 0 : Number.POSITIVE_INFINITY;
  return 100 * (candidate / baseline - 1);
}

function phaseSummary(baselineSamples, candidateSamples) {
  const names = new Set();
  for (const sample of [...baselineSamples, ...candidateSamples]) {
    for (const name of Object.keys(sample.phases)) names.add(name);
  }
  const result = {};
  for (const name of [...names].sort()) {
    const baseline = baselineSamples.flatMap(sample => Object.hasOwn(sample.phases, name) ? [sample.phases[name]] : []);
    const candidate = candidateSamples.flatMap(sample => Object.hasOwn(sample.phases, name) ? [sample.phases[name]] : []);
    result[name] = {
      baselineCount: baseline.length,
      candidateCount: candidate.length,
      baselineMedianMs: baseline.length ? median(baseline) : null,
      candidateMedianMs: candidate.length ? median(candidate) : null,
      relativeIncreasePercent: baseline.length && candidate.length
        ? relativeIncreasePercent(median(candidate), median(baseline))
        : null,
    };
  }
  return result;
}

export async function runNativeLoopCostProtocol(runSession) {
  if (typeof runSession !== 'function') throw new TypeError('runSession must be a function');
  const series = [];
  let invocationIndex = 0;

  for (const seriesId of OFFICIAL_COST_PROTOCOL.seriesOrder) {
    const variant = OFFICIAL_COST_PROTOCOL.variantBySeries[seriesId];
    for (const game of ['STCK', 'SMLP']) {
      const spec = OFFICIAL_COST_PROTOCOL.games[game];
      const warmupDescriptor = {
        invocationIndex: invocationIndex++,
        series: seriesId,
        variant,
        game,
        kind: 'warmup',
        sessionIndex: 0,
        actions: spec.warmupActions,
      };
      const warmup = validateSample(await runSession(structuredClone(warmupDescriptor)), `${seriesId}/${game}/warmup`);

      const measured = [];
      for (let sessionIndex = 0; sessionIndex < spec.measuredSessionsPerSeries; sessionIndex += 1) {
        const descriptor = {
          invocationIndex: invocationIndex++,
          series: seriesId,
          variant,
          game,
          kind: 'measured',
          sessionIndex,
          actions: spec.measuredActions,
        };
        measured.push({
          descriptor,
          sample: validateSample(
            await runSession(structuredClone(descriptor)),
            `${seriesId}/${game}/measured-${sessionIndex + 1}`,
          ),
        });
      }
      series.push({ series: seriesId, variant, game, warmup: { descriptor: warmupDescriptor, sample: warmup }, measured });
    }
  }

  const games = {};
  for (const game of ['STCK', 'SMLP']) {
    const measured = series.filter(item => item.game === game).flatMap(item => item.measured.map(entry => ({ ...entry, series: item.series, variant: item.variant })));
    const baselineSamples = measured.filter(entry => entry.variant === 'A').map(entry => entry.sample);
    const candidateSamples = measured.filter(entry => entry.variant === 'B').map(entry => entry.sample);
    const baselineMedianMs = median(baselineSamples.map(sample => sample.durationMs));
    const candidateMedianMs = median(candidateSamples.map(sample => sample.durationMs));
    const increase = relativeIncreasePercent(candidateMedianMs, baselineMedianMs);
    const phases = phaseSummary(baselineSamples, candidateSamples);
    games[game] = {
      baselineMeasuredSessions: baselineSamples.length,
      candidateMeasuredSessions: candidateSamples.length,
      baselineMedianMs,
      candidateMedianMs,
      relativeIncreasePercent: increase,
      globalAccepted: increase < OFFICIAL_COST_PROTOCOL.globalThresholdPercent,
      phases,
      phaseOverruns: Object.fromEntries(
        Object.entries(phases).filter(([, value]) =>
          value.relativeIncreasePercent !== null
          && value.relativeIncreasePercent >= OFFICIAL_COST_PROTOCOL.globalThresholdPercent),
      ),
    };
  }

  const measuredSessions = series.reduce((sum, item) => sum + item.measured.length, 0);
  const warmupSessions = series.length;
  const measuredActions = series.reduce((sum, item) => sum + item.measured.reduce((inner, entry) => inner + entry.descriptor.actions, 0), 0);
  const warmupActions = series.reduce((sum, item) => sum + item.warmup.descriptor.actions, 0);
  return {
    protocol: OFFICIAL_COST_PROTOCOL,
    totals: {
      invocations: invocationIndex,
      warmupSessions,
      measuredSessions,
      warmupActions,
      measuredActions,
    },
    series,
    games,
    accepted: games.STCK.globalAccepted && games.SMLP.globalAccepted,
  };
}
