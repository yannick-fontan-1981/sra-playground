import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  environment: { type: 'string', default: root },
  state: { type: 'string', default: join(root, 'artifacts', 'sic-effect-composer-replays') },
  partition: { type: 'string', default: 'initial' },
  workers: { type: 'string', default: '4' },
  deadline: { type: 'string', default: '300' },
} });
const directory = resolve(values.state);
const environment = resolve(values.environment);
const workers = Number(values.workers);
const deadline = Number(values.deadline);
if (!Number.isInteger(workers) || workers < 1 || workers > 12) throw new Error('Invalid worker count');
if (!Number.isInteger(deadline) || deadline < 1 || deadline > 3600) throw new Error('Invalid deadline');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--', 'src', 'scripts', 'package.json')) {
  throw new Error('Commit the solver and protocol before opening the reserved games');
}
const revision = git('rev-parse', 'HEAD');
const manifests = {
  initial: 'sic-effect-composer-reserved.json',
  extension: 'sic-effect-composer-reserved-extension.json',
  followup: 'sic-effect-composer-reserved-followup.json',
  controls: 'sic-effect-composer-controls.json',
};
if (!Object.hasOwn(manifests, values.partition)) throw new Error('Unknown reserved partition');
const frozen = read(join(root, 'scripts', manifests[values.partition]));
const solverTree = git('rev-parse', 'HEAD:src');
const configuration = { revision, solverTree, frozen, environment, deadline };
mkdirSync(directory, { recursive: true });
const configurationFile = join(directory, 'configuration.json');
if (existsSync(configurationFile) && JSON.stringify(read(configurationFile)) !== JSON.stringify(configuration)) {
  throw new Error('The output directory belongs to another frozen experiment');
}
write(configurationFile, configuration);

function run(game, arm) {
  const prefix = join(directory, game + '-' + arm);
  const resultPath = prefix + '-result.json';
  if (existsSync(resultPath)) {
    const saved = read(resultPath);
    if (saved.status === 'completed') return Promise.resolve(saved);
  }
  const raw = prefix + '.jsonl';
  const log = prefix + '.log';
  const usage = prefix + '-usage.json';
  writeFileSync(raw, '');
  write(usage, {});
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SIC_STUDY_')));
  Object.assign(env, { SIC_STUDY_SOLVER: frozen.mode, SIC_STUDY_WORKERS: '1', SIC_STUDY_PROGRESS: '1',
    SIC_STUDY_PROGRESS_EVERY: '10', SIC_STUDY_RECORD_COMMANDS: '1', SIC_COMPOSER_ARM: arm, SIC_COMPOSER_USAGE: usage });
  const args = ['--import', pathToFileURL(join(root, 'scripts', 'sic-effect-composer-profile.mjs')).href,
    join(root, 'scripts', 'compare-source100.mjs'), root, environment, raw, 'source:' + game,
    String(frozen.start), String(frozen.finish), String(frozen.actionsPerLevel)];
  return new Promise(resolveRun => {
    const descriptor = openSync(log, 'w');
    const began = performance.now();
    const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', descriptor, descriptor] });
    closeSync(descriptor);
    let expired = false, error;
    const timer = setTimeout(() => { expired = true; child.kill(); }, deadline * 1000);
    child.once('error', issue => { error = issue.message; });
    child.once('close', code => {
      clearTimeout(timer);
      let result;
      try {
        const line = readFileSync(raw, 'utf8').trim();
        const data = line ? JSON.parse(line) : null;
        const level = data?.levels?.[0];
        if (code !== 0 || data?.solver !== frozen.mode || data.sic !== data.issued || !Number.isInteger(data.initialCompleted)
          || data.initialCompleted < 0 || data.initialCompleted >= frozen.start
          || level?.level !== frozen.start || data.replayCommands?.length !== data.issued) {
          throw new Error(error ?? data?.error ?? 'Missing comparable SIC replay');
        }
        const executedFamilies = {};
        for (const { family } of data.replayCommands) executedFamilies[family ?? 'other'] = (executedFamilies[family ?? 'other'] ?? 0) + 1;
        result = { status: 'completed', won: level.won, commands: level.actions, sic: data.sic, initial: data.initial,
          initialCompleted: data.initialCompleted, level: level.level, resets: data.resets,
          state: level.state, reason: level.reason, usage: read(usage), executedFamilies };
      } catch (issue) {
        result = { status: expired ? 'timeout' : 'error', reason: expired ? 'deadline' : issue.message };
      }
      result = { game, arm, ...result, seconds: Math.round((performance.now() - began) / 100) / 10 };
      write(resultPath, result);
      console.log(JSON.stringify({ game, arm, status: result.status, won: result.won, commands: result.commands,
        domains: Object.keys(result.usage ?? {}), seconds: result.seconds }));
      resolveRun(result);
    });
  });
}

const queue = frozen.games.flatMap(game => frozen.arms.map(arm => ({ game, arm })));
const results = [];
await Promise.all(Array.from({ length: workers }, async () => {
  while (queue.length) {
    const { game, arm } = queue.shift();
    results.push(await run(game, arm));
  }
}));
const comparisons = frozen.games.map(game => {
  const arms = frozen.arms.map(arm => results.find(result => result.game === game && result.arm === arm));
  const comparable = arms.every(result => result.status === 'completed')
    && arms[0].initial === arms[1].initial && arms[0].initialCompleted === arms[1].initialCompleted;
  return { game, comparable, arms };
});
write(join(directory, 'report.json'), { configuration, comparisons });
if (comparisons.some(entry => !entry.comparable)) process.exitCode = 1;
