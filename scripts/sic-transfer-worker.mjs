import { parentPort, workerData } from 'node:worker_threads';
import { installCycleProfile } from './sic-transfer-profiles.mjs';

installCycleProfile(workerData);
const { engines } = await import('./sic-transfer-generated-engines.mjs');
parentPort.on('message', jobs => {
  const results = jobs.map(({ id, spec }) => {
    const start = performance.now();
    const result = engines[spec.strategy](spec);
    return { id, ...result, ms: Math.round((performance.now() - start) * 1000) / 1000 };
  });
  parentPort.postMessage(results);
});
