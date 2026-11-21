import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG, getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// A pair is chosen without the final score or any observation after the proposed fork.
function joinPoints(first, second) {
  const prefix = run => run.steps.map(step => [step.from, op(step), step.to].join('/'));
  const a = prefix(first), b = prefix(second);
  let common = 0;
  while (common < Math.min(a.length, b.length) && a[common] === b[common]) common++;
  const pairs = [];
  for (let j = common + 1; j < b.length; j++) {
    for (let i = 1; i < a.length; i++) {
      const left = first.steps[i], right = second.steps[j];
      if (left.from !== right.from || op(left) === op(right)) continue;
      // Omit nearby points on the same shared tail; the two histories must
      // arrive through different last commands or different predecessor boards.
      if (a[i - 1] === b[j - 1]) continue;
      pairs.push({ i, j, common });
      break;
    }
    if (pairs.length) break;
  }
  return pairs[0];
}

async function readRuns(files, heldoutFamilies) {
  const runs = new Map();
  for (const file of files) {
    for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
      const r = JSON.parse(line);
      const entry = getGameByCode(r.code);
      assert.ok(entry && entry.group !== 'custom_4', 'Only source games are admissible');
      if (heldoutFamilies.has(entry.family)) continue;
      assert.ok(!r.error && !r.resets && !r.observedPriorLevelActions && r.start === r.finish && r.issued === r.steps.length);
      const key = [r.code, r.start, r.initial, r.initialCompleted, r.sourcePrefixActions ?? 0].join('/');
      assert.ok(!runs.has(key), 'Duplicate source trajectory in one arm: ' + key);
      runs.set(key, r);
    }
  }
  return runs;
}

function continueFrom(replay, receiver, start, donor, cut) {
  let board = replay.restore(start);
  const words = donor.steps.slice(cut);
  let issued = 0, identical = 0;
  for (const step of words) {
    if (board.state !== 'NOT_FINISHED' || replay.win(board)) break;
    if (!board.availableActionIds.includes(step.a)) break;
    board = replay.act(op(step));
    issued++;
    if (identical === issued - 1 && hash(board).slice(0, 16) === step.to) identical++;
  }
  return { issued, identical, complete: issued === words.length, won: replay.win(board),
    score: board.levelsCompleted - receiver.initialCompleted };
}

function testDirection(engine, programs, receiver, at, donor, cut) {
  const replay = sourceReplay(engine, programs, receiver);
  const predicted = donor.steps[cut].from;
  assert.equal(hash(replay.restore(at)).slice(0, 16), predicted);
  let earlier = at - 1;
  while (earlier >= 0 && receiver.steps[earlier].from === predicted) earlier--;
  return { at, cut, length: donor.steps.length - cut, donorWon: donor.levels[0].won,
    receiverWon: receiver.levels[0].won,
    matched: continueFrom(replay, receiver, at, donor, cut),
    displaced: earlier < 0 ? null : { at: earlier, ...continueFrom(replay, receiver, earlier, donor, cut) } };
}

const [environment, destination, ...inputs] = process.argv.slice(2);
const split = inputs.indexOf('--');
assert.ok(split > 0 && split < inputs.length - 1);
const heldoutFamilies = new Set(['hanoi_order', ...GAME_CATALOG.filter(game => game.group === 'official').map(game => game.family)]);
const [left, right, programs, engine] = await Promise.all([
  readRuns(inputs.slice(0, split), heldoutFamilies), readRuns(inputs.slice(split + 1), heldoutFamilies),
  readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8').then(JSON.parse),
  sourceBackend(resolve(environment)),
]);
const results = [], keys = [...left.keys()].filter(key => right.has(key)).sort();
for (const key of keys) {
  const a = left.get(key), b = right.get(key), pair = joinPoints(a, b);
  if (!pair) continue;
  for (const r of [a,b]) {
    const replay = sourceReplay(engine, programs, r);
    assert.equal(replay.win(replay.restore(r.steps.length)), r.levels[0].won, 'Unauthenticated supplier or receiver: '+key);
  }
  results.push({ code: a.code, level: a.start, initial: a.initial, common: pair.common,
    intoLeft: testDirection(engine, programs, a, pair.i, b, pair.j),
    intoRight: testDirection(engine, programs, b, pair.j, a, pair.i) });
}
const directions = results.flatMap(r => [r.intoLeft, r.intoRight]);
const summary = { pairedEntries: keys.length, qualifyingEntries: results.length, directions: directions.length,
  exactFirst: directions.filter(r => r.matched.identical >= 1).length,
  exactWhole: directions.filter(r => r.matched.identical === r.length).length,
  scoredSuppliers: directions.filter(r => r.donorWon).length,
  retainedWin: directions.filter(r => r.donorWon && r.matched.won).length,
  convertedLoss: directions.filter(r => !r.receiverWon && r.matched.won).length,
  controlOffered: directions.filter(r => r.displaced).length,
  controlExactWhole: directions.filter(r => r.displaced?.identical === r.length).length,
  controlWins: directions.filter(r => r.displaced?.won).length };
const hashKeys = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');
await writeFile(destination, JSON.stringify({ heldoutFamilies: [...heldoutFamilies], pairedEntryDigest: hashKeys(keys),
  inputDigests: await Promise.all(inputs.filter(f => f !== '--').map(async f => createHash('sha256').update(await readFile(f)).digest('hex'))),
  summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary));
