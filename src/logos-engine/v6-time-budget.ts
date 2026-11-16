const activeTimeForOneWorkerMs = 360_000;
const workersForDoubleTime = 8;

export function v6LevelActiveTimeMs(parallelWorkers = 1): number {
  if (!Number.isSafeInteger(parallelWorkers) || parallelWorkers < 1) {
    throw new RangeError('The campaign worker count must be a positive integer.');
  }
  const addedFraction = (Math.min(parallelWorkers, workersForDoubleTime) - 1) / (workersForDoubleTime - 1);
  return Math.round(activeTimeForOneWorkerMs * (1 + addedFraction));
}
