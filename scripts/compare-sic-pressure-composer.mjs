import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [referencePath, candidatePath] = process.argv.slice(2);
if (!referencePath || !candidatePath) throw Error('Expected the reference and candidate chronological JSONL receipts');

function receipts(path) {
  const rows = readFileSync(path, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.deepEqual(rows.map(row => row.code), ['SS05', 'SS11']);
  for (const row of rows) {
    assert.equal(row.mode, 'sic');
    assert.equal(row.target, 1);
    assert.equal(row.parallelWorkers, 1);
    assert.equal(row.effects.length, row.actions);
    assert.equal(row.authority, row.actions);
    assert.equal(row.levelStats.length, 1);
  }
  return rows;
}

function firstDifference(before, after) {
  for (let index = 0; index < Math.max(before.effects.length, after.effects.length); index++) {
    if (JSON.stringify(before.effects[index]) !== JSON.stringify(after.effects[index])) {
      return { turn: index + 1, field: 'effect' };
    }
  }
  for (const field of ['levels', 'actions', 'authority', 'status', 'reason', 'recoveries', 'decisions', 'usage', 'series', 'pathKinds', 'trace']) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) return { field };
  }
  for (const field of ['won', 'actions', 'budget', 'prefixHash']) {
    if (JSON.stringify(before.levelStats[0][field]) !== JSON.stringify(after.levelStats[0][field])) {
      return { level: 1, field };
    }
  }
  return null;
}

const before = receipts(referencePath);
const after = receipts(candidatePath);
const comparison = before.map((row, index) => ({
  game: row.code, levels: [row.levels, after[index].levels], actions: [row.actions, after[index].actions],
  stop: [row.reason, after[index].reason], firstDifference: firstDifference(row, after[index]),
}));
console.log(JSON.stringify(comparison, null, 2));
if (comparison.some(row => row.firstDifference)) process.exitCode = 1;
