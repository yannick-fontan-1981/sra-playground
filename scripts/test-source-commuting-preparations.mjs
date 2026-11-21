import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

// Fit no game-specific symbols. Try both orders of two preparations and a common
// final use. Repeated preparations keep the lengths and the clock identical.
const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), results = [], seen = new Set();
function overlay(before, a, b) {
  let onlyA = 0, onlyB = 0, conflicts = 0;
  const independent = [];
  const frame = before.map((row, y) => row.map((v, x) => {
    const u = a[y]?.[x], w = b[y]?.[x];
    if (u === undefined || w === undefined || u !== v && w !== v && u !== w) conflicts++;
    if (u !== v && w === v) { onlyA++; independent.push([x, y, u]); }
    if (w !== v && u === v) { onlyB++; independent.push([x, y, w]); }
    return u !== v ? u : w;
  }));
  return {onlyA, onlyB, conflicts, anticipated: !conflicts && onlyA > 0 && onlyB > 0 ? hash({frame}).slice(0, 16) : null,
    retained(rows) { return onlyA > 0 && onlyB > 0 && independent.every(([x, y, ink]) => rows[y]?.[x] === ink); }};
}
function subjects(rows) {
  const groups = new Map();
  for (const part of geometricComponents(rows)) {
    const key = JSON.stringify([part.color, part.mask]);
    groups.set(key, groups.has(key) ? null : part.bbox.slice(0, 2));
  }
  return groups;
}
function combinedPositions(before, a, b) {
  const origins = subjects(before), first = subjects(a), second = subjects(b);
  const additions = [], onlyA = [], onlyB = [];
  for (const [role, p] of origins) {
    const q = first.get(role), r = second.get(role);
    if (!p || !q || !r) continue;
    const movesA = p[0] !== q[0] || p[1] !== q[1], movesB = p[0] !== r[0] || p[1] !== r[1];
    if (movesA && movesB) {
      const dest = [q[0] + r[0] - p[0], q[1] + r[1] - p[1]];
      if (dest[0] !== p[0] || dest[1] !== p[1]) additions.push([role, dest]);
    } else if (movesA) onlyA.push([role, q]);
    else if (movesB) onlyB.push([role, r]);
  }
  const joint = onlyA.length && onlyB.length ? [...onlyA, ...onlyB] : [];
  function confirm(r, predicates) {
    return predicates.length > 0 && predicates.every(([key, p]) => r.get(key)?.join() === p.join());
  }
  return {added: additions.length, separate: joint.length, check(rows) {
    const detected = subjects(rows);
    return {added: confirm(detected, additions), separate: confirm(detected, joint)};
  }};
}
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code), key = r.code + '/' + r.start;
  assert.ok(game && game.group !== 'custom_4');
  if (!r.levels?.[0]?.won || r.error || r.resets || r.sourcePrefixActions || r.observedPriorLevelActions
      || r.start !== r.finish || seen.has(key)) continue;
  seen.add(key);
  const replay = sourceReplay(engine, {}, r), tape = r.steps.map(op);
  assert.ok(replay.win(replay.restore(tape.length)));
  const experiments = [];
  for (const length of [1, 2]) for (const tail of [1, 2]) {
    const prefix = tape.length - tail - 2 * length;
    if (prefix < 0) continue;
    const a = tape.slice(prefix, prefix + length), b = tape.slice(prefix + length, -tail), use = tape.slice(-tail);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const initial = replay.restore(prefix), memo = new Map();
    function arm(commands) {
      const id = commands.join('/');
      if (!memo.has(id)) {
        let board = replay.restore(prefix), used = 0;
        for (const cmd of commands) {
          if (replay.win(board) || board.state !== 'NOT_FINISHED'
              || !board.availableActionIds.includes(Number(cmd.split(':')[0].slice(6)))) break;
          board = replay.act(cmd); used++;
        }
        memo.set(id, {board, used, won: replay.win(board)});
      }
      return memo.get(id);
    }
    const first = arm(a), second = arm(b);
    if (first.won || second.won || first.used < length || second.used < length) continue;
    // Fix the predicted arrangement using just the two isolated preparations.
    const forecast = overlay(initial.frame, first.board.frame, second.board.frame);
    const positions = combinedPositions(initial.frame, first.board.frame, second.board.frame);
    const afterAB = arm([...a, ...b]), afterBA = arm([...b, ...a]);
    const signature = v => hash(v.board).slice(0, 16);
    const ab = signature(afterAB), ba = signature(afterBA);
    assert.equal(ab, r.steps[tape.length - tail - 1].to);
    const swapped = arm([...b, ...a, ...use]), original = arm([...a, ...b, ...use]);
    assert.ok(original.won && !afterAB.won && original.used === tape.length - prefix);
    const bothOrders = swapped.won && !afterBA.won && swapped.used === original.used;
    const row = {prefix, length, tail, a, b, use, bothOrders, sameArrangement: ab === ba,
      onlyA: forecast.onlyA, onlyB: forecast.onlyB, conflicts: forecast.conflicts,
      overlayAvailable: forecast.anticipated !== null, overlayAB: ab === forecast.anticipated, overlayBA: ba === forecast.anticipated,
      writesAB: forecast.retained(afterAB.board.frame), writesBA: forecast.retained(afterBA.board.frame),
      added: positions.added, separate: positions.separate, positionsAB: positions.check(afterAB.board.frame),
      positionsBA: positions.check(afterBA.board.frame)};
    if (bothOrders) {
      const withoutA = arm([...b, ...use]).won, withoutB = arm([...a, ...use]).won;
      const noPreparation = arm(use).won, duplicateA = arm([...a, ...a, ...use]).won, duplicateB = arm([...b, ...b, ...use]).won;
      Object.assign(row, {withoutA, withoutB, noPreparation, duplicateA, duplicateB,
        requiresBoth: !(withoutA || withoutB || noPreparation || duplicateA || duplicateB)});
    }
    experiments.push(row);
  }
  results.push({code: r.code, level: r.start, experiments});
}
await writeFile(output, JSON.stringify(results));
console.log('source wins', results.length, 'windows', results.reduce((count, r) => count + r.experiments.length, 0));
