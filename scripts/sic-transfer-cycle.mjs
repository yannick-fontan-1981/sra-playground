import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ownPath = fileURLToPath(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const sharedCycle = new URL('../src/sic/observed-cycle.ts', import.meta.url);
const candidateFiles = [
  ownPath,
  fileURLToPath(sharedCycle),
  join(root, 'src/sic/shared-arrival-timing.ts'),
  join(root, 'src/sic/carried-support-route.ts'),
  join(root, 'scripts/sic-transfer-scenarios.mjs'),
];

async function evaluate(cycle, ablate) {
  if (ablate) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context);
        return result.url === sharedCycle.href
          ? { url: 'data:text/javascript,export const inferCycleAfterTransient=()=>undefined', shortCircuit: true }
          : result;
      },
    });
  }
  const { casesForCycle, strategies } = await import('./sic-transfer-scenarios.mjs');
  return casesForCycle(cycle).map(spec => ({
    ...spec, ...strategies[spec.strategy](spec),
  }));
}

function runWorker(cycle, mode) {
  const child = spawnSync(process.execPath, [ownPath, '--worker', mode, '--round', String(cycle)], {
    cwd: root, encoding: 'utf8', timeout: 30_000, maxBuffer: 256 * 1024,
  });
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Worker ${mode} exited ${child.status}: ${child.stderr.slice(-1500)}`);
  return JSON.parse(child.stdout);
}

function resultOf(result) {
  return result.verified ? 'verified' : result.abstained ? 'abstained' : 'failed';
}

function qualifier(cycle, seed, revision, fingerprint) {
  const baseline = runWorker(seed, 'baseline'), candidate = runWorker(seed, 'candidate');
  if (baseline.length !== candidate.length) throw new Error('Baseline and candidate case counts differ');
  const cases = candidate.map(({ strategy, id, expected, baselineExpected, verified, abstained, evidence, ...parameters }, index) => {
    const before = baseline[index];
    if (!before || before.strategy !== strategy || before.id !== id) throw new Error('Baseline and candidate cases differ');
    const result = resultOf({ verified, abstained });
    const previous = resultOf(before);
    return { strategy, id, parameters, baseline: previous, candidate: result, expected, baselineExpected,
      baselineEvidence: before.evidence, evidence, pass: result === expected && previous === baselineExpected };
  });
  const gains = cases.filter(item => item.baseline === 'abstained' && item.candidate === 'verified');
  const changedStrategies = [...new Set(gains.map(item => item.strategy))];
  const passed = cases.every(item => item.pass) && changedStrategies.length >= 2;
  return { cycle, seed, revision, fingerprint, passed, changedStrategies, gains: gains.length, cases };
}

function readMatrix(report) {
  const design = readFileSync(join(root, 'docs/architecture/sic-v8-composition-des-98-strategies.md'), 'utf8');
  const pilot = new Map([[6, 'clocked-arrival'], [88, 'switched-support']]);
  return [...design.matchAll(/^\| (\d+) \| ([^|]+) \|/gm)].map(([, id, label]) => {
    const strategy = pilot.get(Number(id));
    const cases = report.cases.filter(item => item.strategy === strategy);
    return { id: Number(id), label: label.trim(), pilot: strategy ?? null,
      status: cases.length ? (cases.every(item => item.pass) ? 'pilot-passed' : 'pilot-failed') : 'pending',
      cases: cases.map(({ id: situation, candidate, baseline }) => ({ situation, candidate, baseline })) };
  });
}

function checkpoint(directory, report) {
  const name = `cycle-${report.cycle}.json`;
  const temporary = join(directory, `.${name}.${process.pid}.tmp`);
  writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  try {
    // Link the completed report without overwriting a result from another process.
    linkSync(temporary, join(directory, name));
  } finally {
    rmSync(temporary);
  }
}

function positiveInt(input, label) {
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

const { values } = parseArgs({ options: {
  cycles: { type: 'string', default: '1' },
  state: { type: 'string', default: join(root, 'artifacts', 'sic-transfer') },
  worker: { type: 'string' }, round: { type: 'string' },
} });
if (values.worker) {
  if (!['baseline', 'candidate'].includes(values.worker)) throw new Error('Unknown worker mode');
  console.log(JSON.stringify(await evaluate(positiveInt(values.round, 'round'), values.worker === 'baseline')));
} else {
  const count = positiveInt(values.cycles, 'cycles');
  const state = resolve(values.state);
  mkdirSync(state, { recursive: true });
  const finished = readdirSync(state).flatMap(name => name.match(/^cycle-(\d+)\.json$/)?.[1] ?? []);
  const latest = finished.reduce((largest, round) => Math.max(largest, Number(round)), 0);
  const previous = latest ? JSON.parse(readFileSync(join(state, `cycle-${latest}.json`), 'utf8')) : null;
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || null;
  const hash = createHash('sha256').update(revision ?? '');
  const fingerprint = candidateFiles.reduce((digest, file) => digest.update(readFileSync(file)), hash).digest('hex');
  if (previous?.passed === false && previous.fingerprint === fingerprint) {
    throw new Error(`Cycle ${latest} already failed with these inputs. Its report is in ${state}`);
  }
  const start = latest + 1;
  let seed = previous ? (previous.seed ?? previous.cycle) + Number(previous.passed) : 1;
  for (let cycle = start; cycle < start + count; cycle++, seed++) {
    const report = qualifier(cycle, seed, revision, fingerprint);
    const matrix = readMatrix(report);
    checkpoint(state, { ...report, matrix });
    console.log(JSON.stringify({
      cycle, seed, passed: report.passed, strategies: report.changedStrategies, gains: report.gains,
      cases: report.cases.length, failures: report.cases.filter(item => !item.pass).map(({ strategy, id, baseline, candidate }) =>
        ({ strategy, id, baseline, candidate })),
      catalogued: matrix.length, path: join(state, `cycle-${cycle}.json`),
    }));
    if (!report.passed) {
      process.exitCode = 1;
      break;
    }
  }
}
