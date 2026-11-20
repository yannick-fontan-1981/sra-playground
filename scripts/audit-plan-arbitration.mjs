import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hasExperimentOpportunity, recordReturn } from '../src/sic/experiment-arbitration.ts';

// Chronological replay of the public transitions. The final score is used only to group the results.
const runs = new Map();
for (const file of process.argv.slice(2)) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    assert.equal(run.start, 1);
    assert.equal(run.cap, 60);
    assert.equal(run.steps.length, run.issued);
    assert.ok(!runs.has(run.code));
    runs.set(run.code, run);
  }
}
assert.equal(runs.size, 100);
const digest = createHash('sha256');
const counts = () => ({ levels: 0, actions: 0, fresh: 0, eligible: 0, levelsEligible: 0 });
const summary = { won: counts(), unfinished: counts() };
for (const [code, run] of [...runs].sort(([a], [b]) => a.localeCompare(b))) {
  const result = run.levels[0].won ? summary.won : summary.unfinished;
  const state = { turns: 0, recurrences: 0, frontier: { lastScene: 0 }, returnHistory: { repeatedChanges: 0, recent: [] } };
  const scenes = new Set();
  const edges = new Set();
  let eligible = false;
  let previous;
  result.levels++;
  for (const step of run.steps) {
    if (previous !== undefined) assert.equal(step.from, previous);
    previous = step.to;
    const edge = JSON.stringify([step.from, step.a, step.data ?? null, step.to]);
    digest.update(JSON.stringify([code, edge]) + '\n');
    scenes.add(step.from);
    const changed = step.from !== step.to;
    const returned = changed && scenes.has(step.to);
    state.turns++;
    if (!scenes.has(step.to)) {
      state.frontier.lastScene = state.turns;
      result.fresh++;
    }
    if (returned) state.recurrences++;
    recordReturn(state.returnHistory, changed && edges.has(edge), returned);
    scenes.add(step.to);
    edges.add(edge);
    result.actions++;
    if (hasExperimentOpportunity(state)) {
      result.eligible++;
      eligible = true;
    }
  }
  if (eligible) result.levelsEligible++;
}
console.log(JSON.stringify({ evidenceDigest: digest.digest('hex'), ...summary }, null, 2));
