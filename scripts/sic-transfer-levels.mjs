import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  state: { type: 'string', default: join(root, 'artifacts', 'sic-transfer-levels') },
  report: { type: 'string', default: join(root, 'artifacts', 'sic-transfer-induction', 'report.json') },
  games: { type: 'string', default: Array.from({ length: 12 }, (_, i) => 'SS' + String(i + 8).padStart(2, '0')).join(',') },
  workers: { type: 'string', default: '6' },
  budget: { type: 'string', default: '180' },
  deadline: { type: 'string', default: '240' },
} });

function ranged(value, min, max, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error('Invalid ' + name);
  return parsed;
}

const workers = ranged(values.workers, 1, 16, 'workers');
const budget = ranged(values.budget, 1, 5000, 'action budget');
const deadline = ranged(values.deadline, 1, 3600, 'deadline');
const games = [...new Set(values.games.split(','))];
if (games.some(game => !/^SS(?:0[89]|1[0-9])$/.test(game))) throw new Error('Expected SS08 through SS19');

const directory = resolve(values.state);
const reportPath = resolve(values.report);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (!report.configuration.induction || !report.probe.rule) throw new Error('Expected a completed induction campaign');
mkdirSync(directory, { recursive: true });
const configuration = { revision: report.configuration.revision, fingerprint: report.configuration.fingerprint,
  rule: report.probe.rule.conditions, games, budget, deadline, mode: 'sic', level: 1 };
const configFile = join(directory, 'configuration.json');
if (existsSync(configFile) && JSON.stringify(JSON.parse(readFileSync(configFile, 'utf8'))) !== JSON.stringify(configuration)) {
  throw new Error('The state directory belongs to a different level campaign');
}
writeFileSync(configFile, JSON.stringify(configuration, null, 2) + '\n');

function runGame(code, arm) {
  const prefix = join(directory, code + '-' + arm);
  const resultFile = prefix + '.jsonl', usageFile = prefix + '-usage.json', checkpoint = prefix + '-result.json';
  if (existsSync(checkpoint)) return Promise.resolve(JSON.parse(readFileSync(checkpoint, 'utf8')));
  writeFileSync(resultFile, '');
  const ambient = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SIC_STUDY_')));
  const env = { ...ambient, SIC_STUDY_SOLVER: 'sic', SIC_STUDY_WORKERS: '1', SIC_STUDY_PROGRESS: '1' };
  const args = [];
  if (arm === 'induced') {
    env.SIC_TRANSFER_RULE_REPORT = reportPath;
    env.SIC_TRANSFER_RULE_USAGE = usageFile;
    args.push('--import', join(root, 'scripts/sic-transfer-level-profile.mjs'));
  }
  args.push(join(root, 'scripts/compare-source100.mjs'), root, root, resultFile, code, '1', '1', String(budget));
  const descriptor = openSync(prefix + '.log', 'w');
  return new Promise(resolveRun => {
    const start = performance.now();
    const child = spawn(process.execPath, args, { env, cwd: root, windowsHide: true, stdio: ['ignore', descriptor, descriptor] });
    closeSync(descriptor);
    let expired = false, error = null;
    const timer = setTimeout(() => { expired = true; child.kill(); }, deadline * 1000);
    child.on('error', issue => { error = issue.message; });
    child.once('close', status => {
      clearTimeout(timer);
      let result;
      try {
        const entries = readFileSync(resultFile, 'utf8').trim();
        const data = entries ? JSON.parse(entries) : null;
        const level = data?.levels?.[0];
        const valid = status === 0 && data?.solver === 'sic' && data.sic === data.issued && level?.level === 1 && data.initialCompleted === 0;
        result = { code, arm, status: valid ? 'completed' : expired ? 'timeout' : 'error',
          won: valid ? level.won : null, actions: valid ? level.actions : null,
          state: valid ? level.state : null, initial: valid ? data.initial : null, reason: valid ? level.reason : error ?? data?.error ?? null,
          usage: arm === 'induced' && !expired && existsSync(usageFile) ? JSON.parse(readFileSync(usageFile, 'utf8')) : null,
          seconds: Math.round((performance.now() - start) / 100) / 10 };
      } catch (issue) {
        result = { code, arm, status: expired ? 'timeout' : 'error', won: null, actions: null, reason: issue.message };
      }
      writeFileSync(checkpoint, JSON.stringify(result, null, 2) + '\n');
      console.log(JSON.stringify(result));
      resolveRun(result);
    });
  });
}

const pending = games.flatMap(code => [{ code, arm: 'reference' }, { code, arm: 'induced' }]);
const results = [];
async function lane() {
  while (pending.length) {
    const { code, arm } = pending.shift();
    results.push(await runGame(code, arm));
  }
}
await Promise.all(Array.from({ length: workers }, lane));
const comparisons = games.map(code => ({
  code,
  reference: results.find(result => result.code === code && result.arm === 'reference'),
  induced: results.find(result => result.code === code && result.arm === 'induced'),
}));
const paired = ({ reference, induced }) => reference.status === 'completed' && induced.status === 'completed'
  && reference.initial === induced.initial;
const unlocked = comparisons.filter(pair => paired(pair) && pair.reference.won === false && pair.induced.won === true)
  .map(game => game.code);
const proofBacked = comparisons.filter(pair => paired(pair) && pair.reference.won === false
  && pair.induced.won === true && pair.induced.usage?.inferred > 0).map(game => game.code);
const summary = { configuration, unlocked, proofBacked, comparisons };
const destination = join(directory, 'report.json');
writeFileSync(destination, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ unlocked, proofBacked, completed: results.filter(run => run.status === 'completed').length, report: destination }));
