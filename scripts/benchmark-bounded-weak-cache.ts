/** Isolated reproducible cache-accounting measurement; not a game-speed claim. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BoundedWeakCache } from '../src/logos-engine/bounded-weak-cache.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASELINE = 'f55f3b514658c5228f118bb5891f0bebf52c8832';
const SOURCE = 'src/logos-engine/bounded-weak-cache.ts';
const EXPECTED_BASELINE_SHA256 = 'b04ce3e0a2c51044840ee45778d5e73f4cf445c90524ed5977865fe24b84d39a';
const MAX_WEIGHT = 16 * 1024 * 1024, MAX_ENTRIES = 4096;
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
type Cache = { set(key: object, value: number, weight: number): void; get(key: object): number | undefined;
  readonly retainedWeight: number; readonly entryCount: number };
type Constructor = new (weight: number, entries: number) => Cache;
type Operation = readonly [kind: 0 | 1, key: number, value: number, weight: number];
interface Case { id: string; keys: object[]; operations: Operation[] }

function cases(): Case[] {
  const count = 120_000, keys = Array.from({ length: 16_384 }, () => ({}));
  const hits: Operation[] = [], churn: Operation[] = [], mixed: Operation[] = [];
  let seed = 0x13579bdf;
  const random = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (let index = 0; index < count; index++) {
    hits.push([0, (index * 31) % MAX_ENTRIES, 0, 0]);
    churn.push([1, (MAX_ENTRIES + index) % keys.length, index + 1, 1024]);
    const key = random() % keys.length;
    const kind = random() % 8 < 3 ? 0 : 1;
    const weight = index % 97 === 0 ? MAX_WEIGHT + 1 : index % 19 === 0 ? 256 * 1024 : 512 + (random() % 1536);
    mixed.push([kind, key, index + 1, weight]);
  }
  return [{ id: 'promote_live_entries', keys, operations: hits },
    { id: 'evict_oldest_live_entries', keys, operations: churn },
    { id: 'mixed_weighted_replacements', keys, operations: mixed }];
}

function execute(CacheClass: Constructor, workload: Case, limit = workload.operations.length) {
  const cache = new CacheClass(MAX_WEIGHT, MAX_ENTRIES);
  for (let index = 0; index < MAX_ENTRIES; index++) cache.set(workload.keys[index]!, index + 1, 1024);
  let checksum = 0, hits = 0;
  const started = performance.now();
  for (let index = 0; index < limit; index++) {
    const [kind, key, value, weight] = workload.operations[index]!;
    if (kind) cache.set(workload.keys[key]!, value, weight);
    else {
      const answer = cache.get(workload.keys[key]!);
      if (answer !== undefined) { hits++; checksum = (checksum + answer) >>> 0; }
    }
  }
  const elapsedMs = performance.now() - started;
  assert.ok(cache.retainedWeight <= MAX_WEIGHT); assert.ok(cache.entryCount <= MAX_ENTRIES);
  return { elapsedMs, checksum, hits, retainedWeight: cache.retainedWeight, entryCount: cache.entryCount };
}

const baselineSource = execFileSync('git', ['show', `${BASELINE}:${SOURCE}`], { cwd: ROOT });
assert.equal(hash(baselineSource), EXPECTED_BASELINE_SHA256);
const nativeSource = await readFile(new URL('../' + SOURCE, import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'logos-cache-baseline-'));
try {
  const baselinePath = join(temporary, 'bounded-weak-cache.ts');
  await writeFile(baselinePath, baselineSource);
  const BaselineCache: Constructor = (await import(pathToFileURL(baselinePath).href)).BoundedWeakCache;
  const results = [];
  for (const workload of cases()) {
    execute(BaselineCache, workload, 10_000); execute(BoundedWeakCache, workload, 10_000);
    const before = [], after = [];
    for (let round = 0; round < 5; round++) {
      // Alternate order so neither implementation always inherits the same
      // immediate warm-up/GC position. No timing threshold is a test assertion.
      const first = round % 2 ? execute(BoundedWeakCache, workload) : execute(BaselineCache, workload);
      const second = round % 2 ? execute(BaselineCache, workload) : execute(BoundedWeakCache, workload);
      const old = round % 2 ? second : first, current = round % 2 ? first : second;
      const { elapsedMs: oldMs, ...oldOutcome } = old, { elapsedMs: currentMs, ...currentOutcome } = current;
      assert.deepEqual(currentOutcome, oldOutcome);
      before.push(oldMs); after.push(currentMs);
    }
    const median = (values: number[]): number => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
    results.push({ id: workload.id, operations: workload.operations.length,
      operationsSha256: hash(JSON.stringify(workload.operations)), baselineMs: before, nativeMs: after,
      baselineMedianMs: median(before), nativeMedianMs: median(after), medianRatio: median(before) / median(after),
      matchingPublicOutcomes: true });
  }
  assert.equal(hash(await readFile(new URL('../' + SOURCE, import.meta.url))), hash(nativeSource));
  const report = { schema: 'logos-engine.cache-accounting-benchmark.v1', node: process.version,
    baselineCommit: BASELINE, baselineSourceSha256: hash(baselineSource), nativeSourceSha256: hash(nativeSource),
    bounds: { maxWeight: MAX_WEIGHT, maxEntries: MAX_ENTRIES },
    qualification: 'Synthetic cache-accounting workloads with live keys and numeric values. Weights model accounting, not allocated string bytes. Five alternating-order rounds after warm-up; no forced GC or timing assertion. This does not establish game speed, bounded decision time or a causal end-to-end gain.',
    cases: results };
  if (process.argv[2]) {
    const path = resolve(process.argv[2]); await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
