import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// Replay the same use after alternative, equally long placements that demonstrably
// produced the same local effect while keeping the previously acquired effect.
const [environment, output, choicesFile, ...traceFiles] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const choices = JSON.parse(await readFile(choicesFile, 'utf8'));
const results = [];
const actionId = (command) => Number(command.split(':')[0].slice(6));

function testGroup(replay, run, group, alternatives) {
  const root = replay.restore(group.prefix);
  const history = run.steps.slice(0, group.prefix).map(op);
  const latestClicks = [...new Set(history.filter(a => actionId(a) === 6).reverse())].slice(0, 4);
  const targetClicks = alternatives.map(({ target: [x, y, right, bottom] }) =>
    'ACTION6:' + [Math.floor((x + right) / 2), Math.floor((y + bottom) / 2)].join(','));
  const available = new Set(root.availableActionIds);
  const gestures = new Set(root.availableActionIds.filter(id => id !== 6).map(id => 'ACTION' + id));
  if (available.has(6)) for (const click of [...latestClicks, ...targetClicks]) gestures.add(click);
  const words = [...gestures].map(gesture => [gesture]);
  const seenPairs = new Set();
  for (let i = history.length - 1; i > 0 && seenPairs.size < 4; i--) {
    const pair = history.slice(i - 1, i + 1);
    const key = pair.join('/');
    if (seenPairs.has(key) || !pair.every(a => available.has(actionId(a)))) continue;
    seenPairs.add(key);
    words.push(pair);
  }

  function use(placement, word) {
    let board = replay.restore(group.prefix);
    for (const action of placement) {
      assert.ok(board.availableActionIds.includes(actionId(action)));
      board = replay.act(action);
      assert.ok(!replay.win(board) && board.state === 'NOT_FINISHED');
    }
    const origin = hash(board);
    let used = 0;
    for (const action of word) {
      if (!board.availableActionIds.includes(actionId(action))) break;
      board = replay.act(action);
      used++;
      if (replay.win(board) || board.state !== 'NOT_FINISHED') break;
    }
    return { used, won: replay.win(board), lost: board.state === 'GAME_OVER', changed: hash(board) !== origin };
  }

  const effects = [];
  let usesTested = 0;
  for (const word of words) {
    if (group.prefix + alternatives[0].word.length + word.length > run.cap) continue;
    usesTested++;
    const bare = use([], word);
    const uses = alternatives.map(a => use(a.word, word));
    const endedAtStart = result => result.used === word.length && !result.won && !result.lost && !result.changed;
    const liveChange = result => result.used === word.length && result.changed && !result.won && !result.lost;
    const requiresPlacementForScore = !bare.won && uses.some(t => t.won) && uses.some(t => !t.won);
    const requiresPlacementForChange = endedAtStart(bare) && uses.some(liveChange) && uses.some(endedAtStart);
    if (requiresPlacementForScore || requiresPlacementForChange) {
      effects.push({ word, bare, uses, requiresPlacementForScore, requiresPlacementForChange });
    }
  }
  return { prefix: group.prefix, alternatives: alternatives.map(a => ({target: a.target, word: a.word})), usesTested, effects };
}

for (const file of traceFiles) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    const game = getGameByCode(run.code);
    assert.ok(game && game.group !== 'custom_4');
    if (run.error || run.resets || run.observedPriorLevelActions || run.sourcePrefixActions) continue;
    const row = choices.find(r => r.code === run.code && r.level === run.start);
    if (!row) continue;
    const replay = sourceReplay(engine, {}, run);
    const experiments = [];
    for (const group of row.groups) {
      const eligible = group.choices.filter(choice => choice.observed?.changed && choice.observed.kept && !choice.won);
      for (const length of new Set(eligible.map(c => c.word.length))) {
        const alternatives = eligible.filter(c => c.word.length === length);
        if (alternatives.length >= 2) experiments.push(testGroup(replay, run, group, alternatives));
      }
    }
    results.push({ code: run.code, level: run.start, baselineWon: run.levels[0].won, experiments });
  }
}
await writeFile(output, JSON.stringify(results));
console.log('matched groups', results.reduce((sum, row) => sum + row.experiments.length, 0));
