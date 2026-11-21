import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, output, measurements, ...files] = process.argv.slice(2);
const rows = JSON.parse(await readFile(measurements, 'utf8'));
const engine = await sourceBackend(resolve(environment));
const results = [];
const actionId = word => Number(word.split(':')[0].slice(6));

function placementTrials(row) {
  if (!('blockedUsesTested' in row)) return row.experiments;
  const trials = [], tested = new Set();
  for (const group of row.experiments) {
    const retained = group.contrasts.filter(c => !c.score && c.placementKept && !c.returnedToRoot);
    for (const gesture of new Set(retained.map(c => c.positive))) {
      const rivals = new Set(retained.filter(c => c.positive === gesture).map(c => c.rival));
      const key = JSON.stringify([group.prefix, group.use, gesture, [...rivals].sort()]);
      if (tested.has(key)) continue;
      tested.add(key);
      const options = group.options.filter(o => o.prepare === gesture || rivals.has(o.prepare));
      trials.push({prefix:group.prefix, alternatives:options.map(o => ({word:[o.prepare]})),
        effects:[{word:[group.use], requiresPlacementForChange:true,
          uses:options.map(o => ({used:1, won:false, lost:false, changed:o.changed}))}]});
    }
  }
  return trials;
}

for (const file of files) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    const game = getGameByCode(run.code);
    assert.ok(game && game.group !== 'custom_4');
    const row = rows.find(r => r.code === run.code && r.level === run.start);
    if (!row) continue;
    const replay = sourceReplay(engine, {}, run);
    for (const group of placementTrials(row)) {
      function play(word) {
        let board = replay.restore(group.prefix);
        let used = 0;
        for (const command of word) {
          if (used + group.prefix >= run.cap || board.state !== 'NOT_FINISHED' || !board.availableActionIds.includes(actionId(command))) break;
          board = replay.act(command);
          used++;
          if (replay.win(board)) break;
        }
        return {used, won: replay.win(board)};
      }
      if (group.effects.some(e => e.requiresPlacementForScore)) {
        const gestures = group.alternatives.map(a => a.word);
        const singles = gestures.map(a => play(a));
        const pairs = [];
        for (const [i, a] of gestures.entries()) for (const [j, b] of gestures.entries()) {
          if (group.prefix + a.length + b.length <= run.cap) pairs.push({i,j,...play([...a,...b])});
        }
        results.push({kind:'score_matrix',code:row.code,level:row.level,prefix:group.prefix,gestures,singles,pairs});
      }
      for (const effect of group.effects.filter(t => t.requiresPlacementForChange)) {
        const completed = use => use.used === effect.word.length && !use.won && !use.lost;
        const positive = effect.uses.flatMap((use, i) => completed(use) && use.changed ? [i] : []);
        const rivals = effect.uses.flatMap((use, i) => completed(use) && !use.changed ? [i] : []);
        assert.ok(positive.length && rivals.length);
        const history = run.steps.slice(0, group.prefix).map(op);
        const root = replay.restore(group.prefix);
        const primitives = new Set(root.availableActionIds.filter(n => n !== 6).map(n => 'ACTION' + n));
        const priorClicks = [...new Set(history.filter(s => actionId(s) === 6).reverse())].slice(0, 4);
        for (const command of [...priorClicks, ...effect.word, ...group.alternatives.flatMap(a => a.word)]) primitives.add(command);
        const continuations = [...primitives].map(command => ({kind: 'single', word: [command]}));
        continuations.push({kind: 'repeat_use', word: effect.word});
        const recorded = run.steps.slice(group.prefix).map(op);
        if (recorded.length) continuations.push({kind: 'resume_recorded', word: recorded});
        const tested = new Set(), wins = [];
        function useSteps(placement) {
          let board = replay.restore(group.prefix);
          for (const action of placement) board = replay.act(action);
          const origin = hash(board), steps = [];
          for (const action of effect.word) {
            const before = hash(board);
            board = replay.act(action);
            const after = hash(board);
            steps.push({changed: before !== after, differentFromStart: after !== origin});
          }
          return steps;
        }
        const useObservations = {
          alone: useSteps([]),
          positive: positive.map(i => useSteps(group.alternatives[i].word)),
          rivals: rivals.map(i => useSteps(group.alternatives[i].word)),
        };
        for (const continuation of continuations) {
          const key = continuation.word.join('/');
          if (tested.has(key)) continue;
          tested.add(key);
          for (const index of positive) {
            const placement = group.alternatives[index].word;
            const sequence = [...placement, ...effect.word, ...continuation.word];
            const after = play(sequence);
            if (!after.won) continue;
            wins.push({placement, sequence: sequence.slice(0, after.used), kind: continuation.kind, after,
              withoutPlacement: play([...effect.word, ...continuation.word]),
              withoutUse: play([...placement, ...continuation.word]),
              otherPlacements: rivals.map(i => play([...group.alternatives[i].word, ...effect.word, ...continuation.word]))});
          }
        }
        results.push({code: row.code, level: row.level, baselineWon: row.baselineWon, prefix: group.prefix,
          use: effect.word, positive: positive.length, rivals: rivals.length, useObservations, continuations: tested.size, wins});
      }
    }
  }
}
await writeFile(output, JSON.stringify(results));
console.log('tested openings', results.length);
