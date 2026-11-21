import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { transientSubjectAudit } from './study-transient-subjects.mjs';

const [environment, solver, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), results = [], seen = new Set();
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code);
  assert.ok(game && game.group !== 'custom_4');
  const key = r.code + '/' + r.start;
  if (seen.has(key) || r.error || r.resets || r.observedPriorLevelActions || r.sourcePrefixActions || r.start !== r.finish) continue;
  seen.add(key);
  const audit = await transientSubjectAudit(solver), replay = sourceReplay(engine, {}, r);
  let board = replay.restore(0);
  for (const step of r.steps) {
    const before = board;
    assert.equal(hash(before).slice(0, 16), step.from);
    board = replay.act(op(step));
    assert.equal(hash(board).slice(0, 16), step.to);
    audit.observe(before, board, step.a);
  }
  assert.equal(replay.win(board), r.levels[0].won);
  results.push({code: r.code, level: r.start, ...audit.tally});
}
await writeFile(output, JSON.stringify(results));
console.log('verified source levels', results.length, 'levels with returning subjects', results.filter(r => r.returningSubject).length);
