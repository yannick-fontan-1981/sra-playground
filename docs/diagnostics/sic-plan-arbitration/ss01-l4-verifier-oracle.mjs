// Offline diagnostic. Run with Node 24 from any working directory.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileLevel, initialState, SinkingStarSession, stepWorld } from '../../../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../../../src/games/sinking-star/levels.ts';

const report = readFileSync(new URL('./ss01-l4-oracle-pont-du-miroir.md', import.meta.url), 'utf8');
const commands = { H: 1, B: 2, G: 3, D: 4, X: 5 };
const table = [...report.matchAll(/^\| (\d+)–(\d+) \| `([^\x60]+)` \|/gm)];
const actions = [];
for (const [, first, last, words] of table) {
  assert.equal(actions.length + 1, Number(first));
  for (const word of words.split(' ')) {
    const match = /^([HBGDX])([1-9]\d*)?$/.exec(word);
    assert.ok(match, word);
    actions.push(...Array(Number(match[2] ?? 1)).fill(commands[match[1]]));
  }
  assert.equal(actions.length, Number(last));
}
assert.equal(actions.length, 77);

const world = compileLevel(SS01_LEVELS[3]);
const initial = initialState(world);
const game = new SinkingStarSession(SS01_LEVELS);
game.selectLevel(4);
const cell = p => p.x + 20 * p.y;
const play = (state, moves) => moves.reduce((s, id) => stepWorld(world, s, id), state);
let state = initial;
const platforms = [], crossings = [];
for (const [index, action] of actions.entries()) {
  const before = state;
  state = stepWorld(world, state, action);
  if (state.sunken.length > before.sunken.length) {
    const { x, y } = state.sunken.at(-1);
    platforms.push([index + 1, x, y]);
  }
  if (action === commands.X && cell(before.hero) !== cell(state.hero)) crossings.push(index + 1);
  game.action(action);
}
assert.deepEqual(platforms, [[11, 9, 6], [33, 9, 8], [50, 9, 7]]);
assert.deepEqual(crossings, [13, 26, 69, 75]);
assert.equal(state.complete, true);
assert.equal(game.observe().levelsCompleted, 1);

// The bottom components contain the two lower crates and the exit respectively.
function islandAt(seed) {
  const island = new Set([seed]), cells = [seed];
  for (const i of cells) {
    for (const n of [i - 20, i + 20, i - 1, i + 1]) {
      if (Math.abs(n % 20 - i % 20) > 1 || world.tiles[n] !== '.' || island.has(n)) continue;
      island.add(n);
      cells.push(n);
    }
  }
  return island;
}
const lowerLeft = islandAt(cell(initial.rocks[1])), exitIsland = islandAt(cell(world.goal));
const bottom = new Set([...lowerLeft, ...exitIsland]);
// This level has one merchant, one fixed mirror orientation and identical inert
// crates. Facing and the failed-action animation cannot affect future controls.
function key(s) {
  return [cell(s.hero), cell(s.mirrors[0]), ...s.rocks.map(cell).sort((a, b) => a - b),
    -1, ...s.sunken.map(cell).sort((a, b) => a - b)].join('/');
}
function lowerReachable(start) {
  const queue = [start], seen = new Set([key(start)]);
  for (const s of queue) {
    if (bottom.has(cell(s.hero))) return { reachable: true };
    for (const action of Object.values(commands)) {
      const next = stepWorld(world, s, action), id = key(next);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return { reachable: false, states: seen.size };
}

// Explore every physical state before the first visit to either bottom island.
const upper = [initial], seenUpper = new Set([key(initial)]), typeOfFirstLanding = new Set();
for (const s of upper) {
  for (const action of Object.values(commands)) {
    const next = stepWorld(world, s, action);
    if (bottom.has(cell(next.hero))) {
      typeOfFirstLanding.add(JSON.stringify([action, lowerLeft.has(cell(next.hero)), next.sunken.map(cell)]));
      continue;
    }
    const id = key(next);
    if (seenUpper.has(id)) continue;
    seenUpper.add(id);
    upper.push(next);
  }
}
assert.equal(seenUpper.size, 2187);
assert.deepEqual([...typeOfFirstLanding], [JSON.stringify([commands.X, true, [129]])]);
const beforeFourth = play(initial, [commands.B, commands.D, commands.X]);
assert.equal(play(beforeFourth, [commands.X, commands.H, ...actions]).complete, true);
for (const [letter, action] of Object.entries(commands)) {
  const result = lowerReachable(stepWorld(world, beforeFourth, action));
  if (letter === 'H') assert.deepEqual(result, { reachable: false, states: 112 });
  else assert.equal(result.reachable, true, letter);
}
console.log('L4 credited in 77 commands. Three platforms, four reflections. Move 4 and its four alternatives verified.');
