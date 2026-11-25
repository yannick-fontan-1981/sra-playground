import { parentPort, workerData } from 'node:worker_threads';
import { installCycleProfile } from './sic-transfer-profiles.mjs';

let traces = [];
function capture(samples, equal) {
  const values = [];
  const trace = samples.map(sample => {
    if (sample === null) return null;
    const symbol = values.findIndex(value => equal(value, sample));
    if (symbol >= 0) return symbol;
    values.push(sample);
    return values.length - 1;
  });
  const aligned = traces.findIndex(old => old.slice(0, Math.min(old.length, trace.length))
    .every((value, index) => value === trace[index]));
  if (aligned >= 0) {
    if (trace.length > traces[aligned].length) traces[aligned] = trace;
  } else if (traces.length < 6) traces.push(trace);
}

installCycleProfile(workerData, capture);
const { engines } = await import('./sic-transfer-generated-engines.mjs');
const { additionalEngines } = await import('./sic-transfer-additional-engines.mjs');
const available = { ...engines, ...additionalEngines };
parentPort.on('message', jobs => {
  const results = jobs.map(({ id, spec }) => {
    traces = [];
    const start = performance.now();
    const result = available[spec.strategy](spec);
    return { id, ...result,
      ...(traces.length && result.outcome !== 'verified' ? { traces } : {}),
      ms: Math.round((performance.now() - start) * 1000) / 1000 };
  });
  parentPort.postMessage(results);
});
