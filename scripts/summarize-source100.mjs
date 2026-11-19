import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';

// Arguments: destination, baseline JSONL shards, "--", candidate JSONL shards.
const [output, ...paths] = process.argv.slice(2);
const split = paths.indexOf('--');
if (split < 1 || split === paths.length - 1) throw Error('Expected baseline and candidate shards separated by --');
const codes = GAME_CATALOG.map((game) => game.code).sort();
async function collect(files) {
  const rows = new Map();
  for (const file of files) {
    for (const line of (await readFile(file, 'utf8')).trim().split('\n')) {
      const entry = JSON.parse(line);
      if (
        rows.has(entry.code) ||
        entry.error ||
        entry.sic !== entry.issued ||
        entry.start !== 1 ||
        entry.finish !== 1 ||
        entry.cap !== 60 ||
        entry.levels.length !== 1 ||
        entry.steps.length !== entry.issued
      )
        throw Error('Invalid source record ' + entry.code);
      rows.set(entry.code, entry);
    }
  }
  if (codes.length !== 100 || [...rows.keys()].sort().join() !== codes.join())
    throw Error('Incomplete original cohort');
  return rows;
}
const baseline = await collect(paths.slice(0, split));
const candidate = await collect(paths.slice(split + 1));
function compact(run) {
  const level = run.levels[0];
  return {
    won: level.won,
    actions: run.issued,
    reason: level.reason,
    resets: run.resets,
    trajectory: run.trajectory,
  };
}
const rows = codes.map((code) => {
  const a = baseline.get(code),
    b = candidate.get(code);
  if (a.initial !== b.initial || a.initialCompleted !== b.initialCompleted) throw Error('Unpaired starts ' + code);
  return {
    code,
    initial: a.initial,
    baseline: compact(a),
    candidate: compact(b),
    trials: b.trials,
    changes: b.changes,
    newScenes: b.newScenes,
    relational: b.relational,
    trialActions: b.trialActions,
  };
});
const sum = (selector) => rows.reduce((total, row) => total + Number(selector(row)), 0);
const summary = {
  games: rows.length,
  baselineWins: sum((r) => r.baseline.won),
  candidateWins: sum((r) => r.candidate.won),
  gains: rows.filter((r) => r.candidate.won && !r.baseline.won).map((r) => r.code),
  losses: rows.filter((r) => !r.candidate.won && r.baseline.won).map((r) => r.code),
  baselineActions: sum((r) => r.baseline.actions),
  candidateActions: sum((r) => r.candidate.actions),
  compositionTrials: sum((r) => r.trials),
  changedTrials: sum((r) => r.changes),
  newScenes: sum((r) => r.newScenes),
  relational: sum((r) => r.relational),
  gamesWithCompositionTrials: sum((r) => r.trials > 0),
  identicalTrajectories: sum((r) => r.baseline.trajectory === r.candidate.trajectory),
};
await writeFile(output, JSON.stringify({ summary, rows }, null, 2) + '\n');
console.log(JSON.stringify(summary));
