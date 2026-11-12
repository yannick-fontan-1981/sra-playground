import { performance } from 'node:perf_hooks';
import { runSyntheticOperationSession } from '../tests/helpers/op01-op31-synthetic-session.ts';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function sample(options, samples = 31) {
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const start = performance.now();
    const result = runSyntheticOperationSession(options);
    const elapsedMs = performance.now() - start;
    if (result.released !== options.cycles) throw new Error('Synthetic session did not release every cycle.');
    values.push(elapsedMs);
  }
  return values;
}

const cycles = Number(process.env.OP_CYCLES ?? 200);
const samples = Number(process.env.OP_SAMPLES ?? 31);
const modes = {
  baseline: { cycles, trace: false, cache: false },
  trace: { cycles, trace: true, cache: false },
  cache: { cycles, trace: false, cache: true },
  trace_cache: { cycles, trace: true, cache: true },
};

const results = Object.fromEntries(Object.entries(modes).map(([name, options]) => {
  const values = sample(options, samples);
  return [name, {
    samples,
    cycles,
    median_ms: median(values),
    min_ms: Math.min(...values),
    max_ms: Math.max(...values),
  }];
}));

for (const name of ['trace', 'cache', 'trace_cache']) {
  results[name].delta_vs_baseline_pct =
    ((results[name].median_ms - results.baseline.median_ms) / results.baseline.median_ms) * 100;
}

console.log(JSON.stringify({
  status: 'diagnostic_only',
  official_performance_qualification: false,
  note: 'Synthetic Logos-core session only; not STCK or SMLP.',
  results,
}, null, 2));
