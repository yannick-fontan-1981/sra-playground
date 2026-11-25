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
import { induceAbstraction } from './sic-transfer-induction.mjs';

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
  'scripts/sic-transfer-profiles.mjs', 'scripts/sic-transfer-induction.mjs', 'scripts/sic-transfer-rule.mjs',
  'scripts/sic-transfer-additional-engines.mjs', 'src/sic/observed-cycle.ts', 'src/sic/phased-support-route.ts',
  'src/sic/lit-route-timing.ts',
  'src/sic/shared-arrival-timing.ts', 'src/sic/carried-support-route.ts',
];
const { values } = parseArgs({ options: {
  count: { type: 'string', default: '1000' }, workers: { type: 'string', default: '4' },
  state: { type: 'string' },
  induce: { type: 'boolean', default: false },
  seed: { type: 'string', default: '8026' },
} });
const total = integer(values.count, 'count', 32, 100_000);
const lanes = integer(values.workers, 'workers', 1, 16);
const seed = integer(values.seed, 'seed', 1, 2 ** 31 - 1);
const induction = values.induce;
const directory = resolve(values.state ?? join(root, 'artifacts', induction ? 'sic-transfer-induction' : 'sic-transfer-campaign'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || null;
const fingerprint = inputs.reduce((hash, file) => hash.update(readFileSync(join(root, file))),
  createHash('sha256').update(revision ?? ''),).digest('hex');
const configuration = { total, seed, fingerprint, revision, induction };
const discoveryCount = induction ? Math.floor(total * 0.6 / 4) * 4 : Math.floor(total * 0.8 / 2) * 2;
const calibrationCount = induction ? Math.floor(total * 0.2 / 4) * 4 : 0;
const probeCount = total - discoveryCount - calibrationCount;

mkdirSync(directory, { recursive: true });
const queue = openQueue(join(directory, 'queue.sqlite'), configuration);
const start = Date.now();
try {
  async function run(stage, count, proposed, multiplier) {
    const generator = induction ? 'induction-' + stage : stage;
    const plan = queue.seed(stage, used => generateSituations(count, seed ^ multiplier, generator, used), proposed);
    console.log(JSON.stringify({ stage, pending: queue.pending(stage), total: count, lanes,
      ...(plan.rule ? { conditions: plan.rule.conditions, training: plan.rule.fit } : {}),
      ...(plan.target ? { target: plan.target, reason: plan.reason } : {}),
    }));
    await executeStage(queue, stage, plan, lanes, count);
    const rows = queue.results(stage);
    return { rows, summary: summarize(rows, plan) };
  }
  const traced = { mode: 'trace' };
  const discovery = await run('discovery', discoveryCount,
    { baseline: 'disabled', candidate: induction ? traced : 'production' }, 0);
  let calibration, probe;
  if (induction) {
    const first = induceAbstraction(discovery.rows);
    calibration = await run('calibration', calibrationCount,
      { baseline: traced, candidate: { mode: 'induced', rule: first }, rule: first }, 0x51f15e);
    const refined = induceAbstraction([...discovery.rows, ...calibration.rows]);
    probe = await run('validation', probeCount,
      { baseline: traced, candidate: { mode: 'induced', rule: refined }, rule: refined }, 0x39afd1);
  } else {
    probe = await run('probe', probeCount, chooseProbe(discovery.summary), 0x51f15e);
  }
  if (discovery.rows.length + (calibration?.rows.length ?? 0) + probe.rows.length !== total) {
    throw new Error('Campaign completed with a comparison missing');
  }
  const elapsedSeconds = Math.round((Date.now() - start) / 100) / 10;
  const report = { configuration, pairedComparisons: total, strategyExecutions: total * 2,
    latestRunSeconds: elapsedSeconds, discovery: discovery.summary,
    ...(calibration ? { calibration: calibration.summary } : {}), probe: probe.summary };
  const destination = join(directory, 'report.json');
  const temporary = join(directory, 'report-' + process.pid + '.tmp');
  writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n');
  renameSync(temporary, destination);
  console.log(JSON.stringify({
    paired: total, executions: total * 2, elapsedSeconds,
    discovery: { supported: discovery.summary.supported, qualified: discovery.summary.qualified },
    probe: { supported: probe.summary.supported, qualified: probe.summary.qualified }, report: destination,
  }));
} finally {
  queue.close();
}
