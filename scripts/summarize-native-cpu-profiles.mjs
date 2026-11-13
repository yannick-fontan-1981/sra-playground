#!/usr/bin/env node
/** Summarize two actual Node CPU profiles without treating samples as a budget. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const confined = name => {
  const path = resolve(root, name), rel = relative(root, path);
  assert.ok(rel && !rel.startsWith('..'), 'Keep diagnostic files inside the checkout');
  return path;
};
const [beforeArg, afterArg, outputArg] = process.argv.slice(2);
assert.equal(process.argv.length, 5, 'Usage: summarize-native-cpu-profiles.mjs BEFORE.cpuprofile AFTER.cpuprofile OUTPUT.json');
async function summarize(name) {
  const path = confined(name), raw = await readFile(path), profile = JSON.parse(raw);
  assert.equal(profile.samples.length, profile.timeDeltas.length);
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const functions = new Map(), files = new Map();
  let sampledMicroseconds = 0;
  const signedDeltaAnomalies = [];
  for (let index = 0; index < profile.samples.length; index++) {
    const node = nodes.get(profile.samples[index]), dt = profile.timeDeltas[index];
    assert.ok(node && Number.isFinite(dt));
    // The actual profiler emitted a few -1/-2 microsecond intervals. Preserve
    // them in the signed sum and report each occurrence; never drop samples.
    if (dt < 0) signedDeltaAnomalies.push({ index, nodeId: node.id, microseconds: dt });
    const frame = node.callFrame;
    const file = frame.url?.startsWith('file:') ? relative(root, fileURLToPath(frame.url)) : frame.url || '(native)';
    const key = JSON.stringify([file, frame.functionName, frame.lineNumber + 1]);
    functions.set(key, (functions.get(key) ?? 0) + dt);
    files.set(file, (files.get(file) ?? 0) + dt);
    sampledMicroseconds += dt;
  }
  const compressed = gzipSync(raw, { level: 9 });
  assert.deepEqual(gunzipSync(compressed), raw);
  await writeFile(`${path}.gz`, compressed, { flag: 'wx' });
  return {
    original: { path: relative(root, path), bytes: raw.length, sha256: hash(raw) },
    archive: { path: relative(root, `${path}.gz`), bytes: compressed.length, sha256: hash(compressed) },
    samples: profile.samples.length, sampledMs: sampledMicroseconds / 1000, signedDeltaAnomalies,
    processProfileIntervalMs: (profile.endTime - profile.startTime) / 1000,
    files: [...files].sort((a, b) => b[1] - a[1]).map(([file, us]) => ({ file, selfMs: us / 1000 })),
    functions: [...functions].sort((a, b) => b[1] - a[1]).map(([key, us]) => {
      const [file, name, line] = JSON.parse(key); return { file, name, line, selfMs: us / 1000 };
    }),
  };
}
const result = { schema: 'logos-engine.native-cpu-diagnostic-comparison.v1',
  generatedAt: new Date().toISOString(), generator: { path: relative(root, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  before: await summarize(beforeArg), after: await summarize(afterArg),
  qualification: 'Two single instrumented executions. CPU samples cover the entire Node process, including setup and diagnostic export, not only the replay. Self times are sampled signed estimates, not allocations, exact causal attribution, percentiles or budget gates. Any negative raw microsecond intervals are retained and individually reported without exclusion. Nested method timings are retained separately in the original replay receipts. Raw profiles reconstruct exactly from the gzip archives.' };
await writeFile(confined(outputArg), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: outputArg, beforeSamples: result.before.samples, afterSamples: result.after.samples,
  beforeSampledMs: result.before.sampledMs, afterSampledMs: result.after.sampledMs }));
