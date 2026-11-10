/**
 * Reconstructed from the executed stdin diagnostic, without rerunning it.
 * The matcher, data, warmups, rounds and timed loops are unchanged. Imports
 * and the output destination are parameters so the archived input can be used
 * without overwriting the retained raw result.
 *
 * From an extraction of final-v2/source-archive.tar.gz:
 * node witness-reflect-synthetic-replay.mjs ABSOLUTE_HELPER_PATH NEW_OUTPUT_PATH
 * This is a synthetic local diagnostic, never an official budget comparison.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const [helperPath, output] = process.argv.slice(2);
if (!helperPath || !output) throw new Error('Expected archived helper path and a new output path');
const expected = new Map([
  [path.resolve(helperPath), 'fff7787232c752b91accb917974290312fbd34f7cbddb0112fcf6ac2ee298d02'],
  [path.resolve(path.dirname(helperPath), 'v6-native-owned.ts'), '0ea8f174f0af66b3a37cf3bacf47ef8a9e2f7b26f43b645e955b0a5a23130ada'],
]);
for (const [file, sha256] of expected) {
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== sha256) {
    throw new Error(`Expected the original final-v2 input: ${file}`);
  }
}
if (fs.existsSync(output)) throw new Error('The replay output must be a new file');
const { captureWorkingWitness, matchesWorkingWitness } = await import(pathToFileURL(path.resolve(helperPath)).href);

function alternative(witness, value) {
  if (witness.kind === 'leaf') return Object.is(value, witness.value);
  if (witness.kind === 'untracked') return false;
  if (value !== witness.value || Object.getPrototypeOf(value) !== witness.prototype) return false;
  if (witness.kind === 'map') {
    if (Reflect.ownKeys(witness.value).length || witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.entries();
    for (const [key, child] of witness.entries) {
      const next = entries.next().value;
      if (next === undefined || !alternative(key, next[0]) || !alternative(child, next[1])) return false;
    }
    return true;
  }
  if (witness.kind === 'set') {
    if (Reflect.ownKeys(witness.value).length || witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.values();
    for (const child of witness.entries) if (!alternative(child, entries.next().value)) return false;
    return true;
  }
  if (!Array.isArray(witness.value) && Symbol.iterator in witness.value) return false;
  const keys = Reflect.ownKeys(witness.value);
  if (keys.length !== witness.fields.length) return false;
  for (let index = 0; index < keys.length; index++) {
    const [key, enumerable, child] = witness.fields[index];
    if (key !== keys[index]) return false;
    const descriptor = Object.getOwnPropertyDescriptor(witness.value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== enumerable || !alternative(child, descriptor.value)) return false;
  }
  return true;
}
const values = {
  grid64: Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => (x + y) % 16)),
  records: Array.from({ length: 256 }, (_, n) => ({ x: n % 64, y: n / 64, z: null, flags: new Set([0, 1]), nested: { a: true, b: false } })),
};
const results = [];
for (const [caseName, value] of Object.entries(values)) {
  const witness = captureWorkingWitness(value);
  const functions = { current: matchesWorkingWitness, alternative };
  for (const fn of Object.values(functions)) for (let i = 0; i < 20; i++) if (!fn(witness, value)) throw Error('unexpected mismatch');
  for (let round = 0; round < 4; round++) for (const name of round % 2 ? ['alternative', 'current'] : ['current', 'alternative']) {
    const start = performance.now();
    for (let i = 0; i < 100; i++) if (!functions[name](witness, value)) throw Error('unexpected mismatch');
    results.push({ case: caseName, implementation: name, round, calls: 100, elapsedMs: performance.now() - start });
  }
}
const report = { kind: 'synthetic_diagnostic_only', note: 'No runtime/source change; current witness reused; full structural inspections on every call; not an official budget comparison.', results };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, results }));
