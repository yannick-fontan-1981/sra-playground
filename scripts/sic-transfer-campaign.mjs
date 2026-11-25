import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { chooseProbe, summarize } from './sic-transfer-evidence.mjs';
import { generateSituations } from './sic-transfer-generator.mjs';
import { openQueue } from './sic-transfer-queue.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const workerFile = new URL('./sic-transfer-worker.mjs', import.meta.url);
const batchSize = 12;
const batchTimeout = 30_000;
const lease = 45_000;

function evaluate(worker, jobs) {
  return new Promise((resolveBatch, rejectBatch) => {
    const finish = error => {
      clearTimeout(timer);
      worker.off('message', message);
      worker.off('error', fail);
      worker.off('exit', exit);
      if (error) rejectBatch(error);
    };
    const message = results => {
      finish();
      resolveBatch(results);
    };
    const fail = error => finish(error);
    const exit = status => finish(new Error('Comparison worker exited with status ' + status));
    const timer = setTimeout(() => finish(new Error('Comparison batch exceeded its time budget')), batchTimeout);
    worker.once('message', message);
    worker.once('error', fail);
    worker.once('exit', exit);
    worker.postMessage(jobs);
  });
}

function compare(jobs, before, after) {
  const baseline = new Map(before.map(result => [result.id, result]));
  const candidate = new Map(after.map(result => [result.id, result]));
  if (baseline.size !== jobs.length || candidate.size !== jobs.length) throw new Error('Comparison batch counts differ');
  return jobs.map(({ id }) => {
    const left = baseline.get(id), right = candidate.get(id);
    if (!left || !right) throw new Error('The workers did not evaluate the same comparison ' + id);
    const { id: leftId, ...baselineResult } = left;
    const { id: rightId, ...candidateResult } = right;
    return { id, baseline: baselineResult, candidate: candidateResult };
  });
}

let interrupted = false;
const interrupt = () => { interrupted = true; };
process.on('SIGINT', interrupt);
process.on('SIGTERM', interrupt);

async function executeStage(queue, stage, plan, lanes, total) {
  if (queue.pending(stage) === 0) return;
  let abort = false;
  let nextUpdate = Math.floor((total - queue.pending(stage)) / 100 + 1) * 100;
  async function runLane() {
    const owner = randomUUID();
    const before = new Worker(workerFile, { workerData: plan.baseline });
    const after = new Worker(workerFile, { workerData: plan.candidate });
    try {
      while (!interrupted && !abort) {
        const jobs = queue.claim(stage, owner, batchSize, lease);
        if (!jobs.length) {
          if (!queue.pending(stage)) break;
          await pause(200);
          continue;
        }
        const [left, right] = await Promise.all([evaluate(before, jobs), evaluate(after, jobs)]);
        queue.checkpoint(owner, compare(jobs, left, right));
        const done = total - queue.pending(stage);
        if (done >= nextUpdate || done === total) {
          console.log(JSON.stringify({ stage, completed: done, total }));
          nextUpdate = Math.floor(done / 100 + 1) * 100;
        }
      }
    } catch (error) {
      abort = true;
      throw error;
    } finally {
      queue.release(owner);
      await Promise.allSettled([before.terminate(), after.terminate()]);
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: lanes }, runLane));
  for (const result of settled) if (result.status === 'rejected') throw result.reason;
  if (interrupted) throw new Error('Interrupted. Completed comparisons have been saved.');
}

function integer(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(name + ' must be between ' + min + ' and ' + max);
  return parsed;
}

const inputs = [
  'scripts/sic-transfer-campaign.mjs', 'scripts/sic-transfer-queue.mjs', 'scripts/sic-transfer-evidence.mjs',
  'scripts/sic-transfer-generator.mjs', 'scripts/sic-transfer-generated-engines.mjs', 'scripts/sic-transfer-worker.mjs',
  'scripts/sic-transfer-profiles.mjs', 'src/sic/observed-cycle.ts',
  'src/sic/shared-arrival-timing.ts', 'src/sic/carried-support-route.ts',
];
const { values } = parseArgs({ options: {
  count: { type: 'string', default: '1000' }, workers: { type: 'string', default: '4' },
  state: { type: 'string', default: join(root, 'artifacts', 'sic-transfer-campaign') },
  seed: { type: 'string', default: '8026' },
} });
const total = integer(values.count, 'count', 32, 100_000);
const lanes = integer(values.workers, 'workers', 1, 16);
const seed = integer(values.seed, 'seed', 1, 2 ** 31 - 1);
const directory = resolve(values.state);
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || null;
const fingerprint = inputs.reduce((hash, file) => hash.update(readFileSync(join(root, file))),
  createHash('sha256').update(revision ?? ''),).digest('hex');
const configuration = { total, seed, fingerprint, revision };
const discoveryCount = Math.floor(total * 0.8 / 2) * 2;
const probeCount = total - discoveryCount;

mkdirSync(directory, { recursive: true });
const queue = openQueue(join(directory, 'queue.sqlite'), configuration);
const start = Date.now();
try {
  const discoveryPlan = queue.seed('discovery', used => generateSituations(discoveryCount, seed, 'discovery', used),
    { baseline: 'disabled', candidate: 'production' });
  console.log(JSON.stringify({ stage: 'discovery', pending: queue.pending('discovery'), total: discoveryCount, lanes }));
  await executeStage(queue, 'discovery', discoveryPlan, lanes, discoveryCount);
  const discovery = summarize(queue.results('discovery'), discoveryPlan);
  const proposed = chooseProbe(discovery);
  const probePlan = queue.seed('probe', used => generateSituations(probeCount, seed ^ 0x51f15e, 'probe', used), proposed);
  console.log(JSON.stringify({ stage: 'probe', ...probePlan, pending: queue.pending('probe'), total: probeCount, lanes }));
  await executeStage(queue, 'probe', probePlan, lanes, probeCount);
  const probe = summarize(queue.results('probe'), probePlan);
  if (discovery.comparisons + probe.comparisons !== total) throw new Error('Campaign completed with a comparison missing');
  const elapsedSeconds = Math.round((Date.now() - start) / 100) / 10;
  const report = { configuration, pairedComparisons: total, strategyExecutions: total * 2,
    latestRunSeconds: elapsedSeconds, discovery, probe };
  const destination = join(directory, 'report.json');
  const temporary = join(directory, 'report-' + process.pid + '.tmp');
  writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n');
  renameSync(temporary, destination);
  console.log(JSON.stringify({
    paired: total, executions: total * 2, elapsedSeconds,
    discovery: { supported: discovery.supported, qualified: discovery.qualified },
    probe: { supported: probe.supported, qualified: probe.qualified }, report: destination,
  }));
} finally {
  queue.close();
}
