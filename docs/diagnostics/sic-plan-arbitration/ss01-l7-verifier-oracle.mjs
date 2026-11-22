import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  compileLevel,
  initialState,
  SinkingStarSession,
  stepWorld,
} from '../../../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../../../src/games/sinking-star/levels.ts';

const text = readFileSync(new URL('./ss01-l7-oracle-et-composition.md', import.meta.url), 'utf8');
const moves = [];
for (const [, first, last, group] of text.matchAll(/^\| (\d+)–(\d+) \| `([HBGDX ]+)` \|/gm)) {
  assert.equal(moves.length + 1, Number(first));
  for (const move of group.split(' ')) moves.push(' HBGDX'.indexOf(move));
  assert.equal(moves.length, Number(last));
}
assert.equal(moves.length, 37);
const world = compileLevel(SS01_LEVELS[6]),
  start = initialState(world);
const frames = [start],
  session = new SinkingStarSession(SS01_LEVELS);
session.selectLevel(7);
for (const action of moves) {
  frames.push(stepWorld(world, frames.at(-1), action));
  session.action(action);
}
const xy = (p) => [p.x, p.y];
assert.deepEqual(frames[11].sunken.map(xy), [[11, 7]]);
assert.deepEqual(xy(frames[18].mirrors[0]), [11, 7]);
assert.deepEqual(xy(frames[21].hero), [8, 7]);
assert.deepEqual(frames[29].rocks.map(xy), [[5, 7]]);
assert.deepEqual(xy(frames[30].hero), xy(frames[29].hero));
assert.deepEqual(frames[30].sunken.map(xy), [
  [11, 7],
  [11, 13],
]);
assert.deepEqual(xy(frames[32].hero), [11, 13]);
assert.deepEqual(xy(frames[37].hero), xy(world.goal));
assert.equal(frames[37].complete, true);
assert.equal(session.observe().levelsCompleted, 1);

// Single-condition interventions at the same checkpoint and with the same command.
assert.deepEqual(
  xy(stepWorld(world, { ...frames[17], sunken: [] }, moves[17]).mirrors[0]),
  xy(frames[17].mirrors[0]),
);
const inert = { ...frames[29], rocks: frames[29].rocks.map((r) => ({ ...r, reflectable: false })) };
assert.deepEqual(stepWorld(world, inert, moves[29]).sunken, frames[29].sunken);
const unsupported = { ...frames[31], sunken: frames[31].sunken.slice(0, 1) };
assert.deepEqual(xy(stepWorld(world, unsupported, moves[31]).hero), xy(frames[31].hero));

// Enumerate the claimed geometry independently of the oracle's commands.
const width = 20;
const id = (p) => width * p.y + p.x;
const neighbours = (p) =>
  [p - width, p + width, p - 1, p + 1].filter(
    (n) => n >= 0 && n < world.tiles.length && Math.abs((n % width) - (p % width)) <= 1,
  );
const island = (start) => {
  const found = new Set([start]);
  for (const p of found) for (const q of neighbours(p)) if (world.tiles[q] === '.') found.add(q);
  return found;
};
const rim = (region) => new Set([...region].flatMap(neighbours).filter((p) => world.tiles[p] === '~'));
const home = island(id(start.hero)),
  upper = island(id(start.rocks[0])),
  goal = island(id(world.goal));
assert.deepEqual([home.size, upper.size, goal.size], [19, 17, 15]);
const arrivals = rim(goal),
  triples = [];
for (const p of [...home, ...rim(home)])
  for (const from of upper) {
    const x = p % width,
      y = Math.floor(p / width),
      dx = (from % width) - x,
      dy = Math.floor(from / width) - y;
    const dest = dy === 0 && dx < 0 ? [x, y - dx] : dx === 0 && dy > 0 ? [x - dy, y] : null;
    if (dest && dest.every((n) => n >= 0 && n < width) && arrivals.has(dest[1] * width + dest[0]))
      triples.push([[x, y], [from % width, Math.floor(from / width)], dest]);
  }
assert.deepEqual(triples, [
  [
    [11, 7],
    [5, 7],
    [11, 13],
  ],
]);

const stateKey = (s) => JSON.stringify([xy(s.hero), s.mirrors.map(xy), s.rocks.map(xy), s.sunken.map(xy)]);
const reachable = [start],
  visited = new Set([stateKey(start)]);
for (const state of reachable) {
  assert.equal(state.complete, false);
  for (const move of [1, 2, 3, 4]) {
    const next = stepWorld(world, state, move),
      key = stateKey(next);
    if (!visited.has(key)) {
      visited.add(key);
      reachable.push(next);
    }
  }
}
console.log(
  JSON.stringify({
    actions: moves.length,
    credits: session.observe().levelsCompleted,
    interventions: 3,
    cardinalOnlyStates: visited.size,
    cardinalOnlyWins: 0,
  }),
);

if (process.argv.length > 2) {
  assert.equal(process.argv.length, 5, 'Supply the frozen baseline, candidate and the cap per level.');
  const [baseline, candidate] = process.argv
    .slice(2, 4)
    .map((file) => JSON.parse(readFileSync(file, 'utf8').trim()));
  const cap = Number(process.argv[4]),
    prefix = [36, 32, 42, 79, 62, 116];
  const entry = prefix.reduce((a, b) => a + b, 0);
  for (const run of [baseline, candidate]) {
    assert.equal(run.solver, 'sic');
    assert.equal(run.parallelWorkers, 1);
    assert.equal(run.cap, cap);
    assert.equal(run.resets, 1);
    assert.deepEqual(
      run.levels.slice(0, 6).map((l) => [l.won, l.actions]),
      prefix.map((n) => [true, n]),
    );
  }
  assert.equal(baseline.levels[6].won, false);
  assert.equal(baseline.levels[6].actions, cap);
  const trace = candidate.replayCommands,
    old = baseline.replayCommands;
  const movement = (c) => [c.id, c.data, c.from, c.to];
  for (let i = 0; i < entry; i++) assert.deepEqual(movement(trace[i]), movement(old[i]));
  const before = old[entry].contactFrontier,
    after = trace[entry].contactFrontier;
  assert.deepEqual(before.preparations, []);
  assert.equal(before.remaining, 21);
  assert.equal(after.remaining, 37);
  assert.equal(after.preparations.length, 2);
  assert.ok(after.landing.witness);
  assert.deepEqual(movement(trace[entry]), movement(old[entry]));
  assert.notEqual(trace[entry + 1].id, old[entry + 1].id);
  const hash = (frame) => createHash('sha256').update(JSON.stringify(frame)).digest('hex').slice(0, 16);
  const warm = new SinkingStarSession(SS01_LEVELS);
  let view = warm.observe(),
    restarts = 0;
  for (const c of trace) {
    if (hash(view.frame) !== c.from) {
      view = warm.reset();
      restarts++;
    }
    assert.equal(hash(view.frame), c.from);
    view = warm.action(c.id, c.data);
    assert.equal(hash(view.frame), c.to);
  }
  assert.equal(restarts, 1);
  assert.equal(view.level, 8);
  assert.equal(view.levelsCompleted, 7);
  assert.deepEqual([candidate.levels[6].won, candidate.levels[6].actions], [true, 37]);
  console.log(
    JSON.stringify({
      commonPrefix: entry,
      firstDifferentL7Command: 2,
      baseline: before.remaining,
      candidate: after.remaining,
      credits: view.levelsCompleted,
      preparations: after.preparations.map((v) => v.enables),
      actions: trace.length,
    }),
  );
}
