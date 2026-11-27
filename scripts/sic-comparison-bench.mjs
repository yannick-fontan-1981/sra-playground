import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTraces } from './compare-sic-decisions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const frozen = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
const references = 'docs/architecture/sic-replay-reference-levels-20261126.json';
const expectedFile = 'docs/diagnostics/sic-107-4a546a13-20261126/expected-budgets.json';
const games = ['AS66', 'G50T', 'HOLE'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', '--verify', frozen + '^{commit}'), frozen);
git('merge-base', '--is-ancestor', frozen, 'HEAD');
git('diff', '--quiet', frozen, '--', 'src', 'reference', 'public/python', references, expectedFile,
  'docs/architecture/sic-v8-level6-campaign-7bb9f152.json', 'scripts/sic-replay-budgets.mjs',
  'scripts/sic-replay-watchdog.mjs', 'scripts/python-runtime-assets.json', 'scripts/prepare-python.mjs');
const budgets = JSON.parse(readFileSync(join(root, expectedFile))).budgets;
// Verify the Pyodide distribution, including data already present on disk.
execFileSync(process.execPath, ['scripts/prepare-python.mjs'], { cwd: root, stdio: 'inherit' });
const parent = resolve(process.argv[2] ?? join(root, 'artifacts/sic-comparison'));
mkdirSync(parent, { recursive: true });
const directory = mkdtempSync(join(parent, 'run-'));
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
console.log(directory);

async function replay(game, label) {
  const prefix = join(directory, game + '-' + label);
  const args = ['scripts/check-sic-chronological.mjs', game, 'auto', prefix + '.receipt', '1', 'sic'];
  const log = openSync(prefix + '.log', 'wx');
  try {
    await new Promise((done, fail) => {
      const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', log, log],
        env: { ...process.env, SIC_DECISION_TRACE: prefix + '.jsonl', SIC_REPLAY_REFERENCES: references } });
      child.once('error', fail);
      child.once('close', code => code === 0 ? done() : fail(Error(prefix + ' exit ' + code)));
    });
  } finally {
    closeSync(log);
  }
  const receipt = JSON.parse(readFileSync(prefix + '.receipt', 'utf8'));
  const levels = receipt.levelStats ?? [];
  const qualified = receipt.reason === 'target_levels_completed' && receipt.levels === budgets[game].length
    && receipt.target === receipt.levels && receipt.actions > 0 && receipt.authority === receipt.actions
    && levels.length === receipt.target && levels.every((row, i) => row.won && row.level === i + 1);
  for (const [i, row] of levels.entries()) assert.deepEqual(row.budget, budgets[game][i], game + ' level ' + row.level);
  return { label, args, qualified, reason: receipt.reason, status: receipt.status, levels: receipt.levels,
    actions: receipt.actions, actionsByLevel: levels.map(row => row.actions), trajectory: receipt.trace };
}

const report = { frozen, revision: git('rev-parse', 'HEAD'), node: process.version, references, games: [] };
// Serial games keep the original wall budgets usable on a single machine.
// Each label starts its own watchdog, game backend, service and agent.
for (const game of games) {
  try {
    const a = await replay(game, 'A');
    const b = await replay(game, 'Aprime');
    const comparison = await compareTraces(join(directory, game + '-A.jsonl'), join(directory, game + '-Aprime.jsonl'));
    const valid = a.qualified && b.qualified && comparison.equal && a.actions === comparison.decisions
      && a.trajectory === b.trajectory;
    console.log(JSON.stringify({ game, valid, comparison, actions: [a.actions, b.actions] }));
    report.games.push({ game, a, b, comparison, valid });
  } catch (error) {
    console.error(game + ': ' + error.message);
    report.games.push({ game, valid: false, error: String(error) });
  }
  write(join(directory, 'report.json'), report);
}
report.firstDifference = report.games.find(result => result.comparison?.equal === false)?.comparison ?? null;
write(join(directory, 'report.json'), report);
write(join(parent, 'last-run.json'), { directory });
process.exitCode = report.games.every(result => result.valid) ? 0 : 1;
console.log('Report: ' + join(directory, 'report.json'));
