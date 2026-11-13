export const WORKER_PYODIDE_PARITY_PLAN = Object.freeze([
  Object.freeze({ game: 'STCK', actions: 3 }),
  Object.freeze({ game: 'STCK', actions: 10 }),
  Object.freeze({ game: 'SMLP', actions: 3 }),
  Object.freeze({ game: 'SMLP', actions: 15 }),
]);

function stable(value) {
  return JSON.stringify(value);
}

function compareValue(mismatches, path, reference, candidate) {
  if (stable(reference) !== stable(candidate)) {
    mismatches.push({ path, reference, candidate });
  }
}

function validateReport(report, label) {
  if (!report || typeof report !== 'object' || report.version !== 1) {
    throw new TypeError(`${label} parity report must use version 1`);
  }
  if (!Array.isArray(report.samples)) {
    throw new TypeError(`${label} parity report must contain samples`);
  }
  return report;
}

/**
 * Compare only public session semantics. Runtime labels/backends intentionally
 * differ (CPython archive versus browser Worker/Pyodide) and are recorded but
 * are not parity fields.
 */
export function assertWorkerPyodideParity(referenceReport, candidateReport) {
  const reference = validateReport(referenceReport, 'reference');
  const candidate = validateReport(candidateReport, 'candidate');
  const mismatches = [];

  compareValue(mismatches, 'sampleCount', reference.samples.length, candidate.samples.length);
  const count = Math.min(reference.samples.length, candidate.samples.length);
  let comparedSteps = 0;

  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    const a = reference.samples[sampleIndex];
    const b = candidate.samples[sampleIndex];
    const prefix = `samples[${sampleIndex}]`;
    for (const field of ['game', 'actionsRequested', 'gameId']) {
      compareValue(mismatches, `${prefix}.${field}`, a?.[field], b?.[field]);
    }
    for (const field of ['frameHash', 'availableActionIds', 'state', 'level', 'levelsCompleted']) {
      compareValue(mismatches, `${prefix}.initial.${field}`, a?.initial?.[field], b?.initial?.[field]);
    }
    compareValue(mismatches, `${prefix}.stepCount`, a?.steps?.length, b?.steps?.length);
    const stepCount = Math.min(a?.steps?.length ?? 0, b?.steps?.length ?? 0);
    comparedSteps += stepCount;
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      const left = a.steps[stepIndex];
      const right = b.steps[stepIndex];
      const stepPrefix = `${prefix}.steps[${stepIndex}]`;
      for (const field of [
        'action',
        'changedPixelCount',
        'frameHash',
        'availableActionIds',
        'state',
        'level',
        'levelsCompleted',
      ]) {
        compareValue(mismatches, `${stepPrefix}.${field}`, left?.[field], right?.[field]);
      }
    }
  }

  if (mismatches.length > 0) {
    const preview = mismatches.slice(0, 12)
      .map(item => `${item.path}: reference=${stable(item.reference)} candidate=${stable(item.candidate)}`)
      .join('\n');
    throw new Error(`Worker/Pyodide parity mismatch (${mismatches.length})\n${preview}`);
  }

  return {
    samplesCompared: count,
    stepsCompared: comparedSteps,
    plan: WORKER_PYODIDE_PARITY_PLAN.map(item => ({ ...item })),
  };
}
