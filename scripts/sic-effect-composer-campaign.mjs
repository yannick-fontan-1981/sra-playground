import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { compareMechanic, development, generateMechanic, reserved } from './sic-effect-mechanics.mjs';
import { openQueue } from './sic-transfer-queue.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  count: { type: 'string', default: '10000' },
  seed: { type: 'string', default: '261125' },
  state: { type: 'string', default: join(root, 'artifacts', 'sic-effect-composer') },
} });
const count = Number(values.count), seed = Number(values.seed);
if (!Number.isInteger(count) || count < 1) throw new Error('Invalid comparison count');
if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('Invalid seed');
const directory = resolve(values.state);
const stages = [
  { stage: 'development', families: development, count: count - Math.floor(count / 5) },
  { stage: 'reserved', families: reserved, count: Math.floor(count / 5) },
];
const fingerprint = createHash('sha256');
for (const file of ['src/sic/effect-composer.ts', 'scripts/sic-effect-mechanics.mjs', 'scripts/sic-effect-composer-campaign.mjs']) {
  fingerprint.update(readFileSync(join(root, file)));
}
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const configuration = { protocol: 'effect-composer-1', count, seed, revision, fingerprint: fingerprint.digest('hex'), stages };
mkdirSync(directory, { recursive: true });
const queue = openQueue(join(directory, 'comparisons.sqlite'), configuration);
const owner = randomUUID();

function* generate({ families, count, stage }, used) {
  let word = (seed ^ (stage === 'development' ? 0x43b38dc2 : 0x90b7f533)) >>> 0;
  function draw(limit) {
    word = (word + 0x6d2b79f5) | 0;
    let value = Math.imul(word ^ word >>> 15, 1 | word);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) % limit;
  }
  for (let index = 0; index < count; index++) {
    const family = families[index % families.length];
    let spec, key, tries = 0;
    do {
      if (++tries > 10_000) throw new Error('Generator exhausted structural variations for ' + family);
      spec = generateMechanic(family, draw);
      const byName = [...spec.operations].sort((a, b) => a.name.localeCompare(b.name));
      key = createHash('sha256').update(JSON.stringify({ ...spec, operations: byName })).digest('hex');
    } while (used.has(key));
    used.add(key);
    yield { spec, key };
  }
}

function summarise(results) {
  const report = {
    tested: 0, feasible: 0, impossible: 0, declaredNegative: 0, composed: 0, greedy: 0, gains: 0,
    shorter: 0, regressions: 0, plannerMiss: 0, invalid: 0, nonMinimum: 0, infeasibleWithinHorizon: 0,
    negativeFeasible: 0, longest: 0,
  };
  const examples = {};
  for (const { id, spec, commands, baseline, oracle, invalid, plan } of results) {
    report.tested++;
    if (oracle === null) report.impossible++;
    else report.feasible++;
    if (spec.negative) report.declaredNegative++;
    if (spec.negative && oracle !== null) report.negativeFeasible++;
    if (!spec.negative && oracle === null) report.infeasibleWithinHorizon++;
    if (invalid) report.invalid++;
    if (commands !== null) {
      report.composed++;
      report.longest = Math.max(report.longest, commands);
      if (commands !== oracle) report.nonMinimum++;
    }
    if (baseline !== null) report.greedy++;
    if (commands === null && baseline !== null) report.regressions++;
    if (oracle !== null && commands === null) report.plannerMiss++;
    if (commands !== null && baseline === null) report.gains++;
    if (commands !== null && baseline !== null && commands < baseline) report.shorter++;
    if (commands !== null && baseline === null && (!examples[spec.family] || examples[spec.family].commands < commands)) {
      examples[spec.family] = { id, commands, plan };
    }
  }
  return { ...report, examples };
}

const began = performance.now();
try {
  for (const stage of stages) queue.seed(stage.stage, used => generate(stage, used), { count: stage.count });
  for (const { stage, count } of stages) {
    let committed = count - queue.pending(stage);
    let checkpoint = Math.floor(committed / 1000);
    while (queue.pending(stage)) {
      const batch = queue.claim(stage, owner, 24, 45_000);
      if (!batch.length) {
        await pause(500);
        continue;
      }
      queue.checkpoint(owner, batch.map(({ id, spec }) => ({ id, ...compareMechanic(spec) })));
      committed += batch.length;
      if (Math.floor(committed / 1000) > checkpoint) {
        checkpoint = Math.floor(committed / 1000);
        console.log(JSON.stringify({ stage, committed, count, seconds: Math.round((performance.now() - began) / 1000) }));
      }
    }
  }
  const partitions = stages.map(({ stage, families }) => {
    const rows = queue.results(stage);
    return { stage, totals: summarise(rows),
      families: Object.fromEntries(families.map(family => [family, summarise(rows.filter(row => row.spec.family === family))])) };
  });
  const stats = summarise(stages.flatMap(({ stage }) => queue.results(stage)));
  const report = { configuration, stats, partitions, seconds: Math.round((performance.now() - began) / 1000) };
  writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const { examples, ...totals } = stats;
  console.log(JSON.stringify({ ...totals, seconds: report.seconds }));
  if (count !== stats.tested || stats.invalid || stats.plannerMiss || stats.nonMinimum
    || stats.negativeFeasible) process.exitCode = 1;
} finally {
  queue.release(owner);
  queue.close();
}
