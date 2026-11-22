import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SS01_LEVELS } from '../../../src/games/sinking-star/levels.ts';
import {
  SinkingStarSession,
  compileLevel,
  initialState,
  stepWorld,
} from '../../../src/games/sinking-star/core.ts';

const report = readFileSync(new URL('./ss01-l8-relais-et-oracle.md', import.meta.url), 'utf8');
const translate = (s) =>
  [...s.replaceAll(' ', '')].map((c) => ({
    id: ' HBGDXC'.indexOf(c),
    ...(c === 'C' ? { data: { x: 45, y: 24 } } : {}),
  }));
const moves = [];
for (const [, first, last, sequence] of report.matchAll(/^\| (\d+)(?:–(\d+))? \| `([HBGDXC ]+)` \|/gm)) {
  assert.equal(Number(first), moves.length + 1);
  moves.push(...translate(sequence));
  assert.equal(moves.length, Number(last ?? first));
}
const w = compileLevel(SS01_LEVELS[7]),
  start = initialState(w),
  xy = (p) => [p.x, p.y],
  world = (s, c) => stepWorld(w, s, c.id, c.data);
function score(route) {
  const game = new SinkingStarSession(SS01_LEVELS);
  game.selectLevel(8);
  const frames = [start];
  for (const c of route) {
    game.action(c.id, c.data);
    frames.push(world(frames.at(-1), c));
  }
  assert.equal(frames.at(-1).complete, true);
  assert.equal(game.observe().levelsCompleted, 1);
  return frames;
}
const f = score(moves);
assert.equal(moves.length, 43);
assert.deepEqual(f[9].rocks.map(xy), [[6, 7]]);
assert.deepEqual(f[21].mirrors.map(xy), [[12, 7]]);
assert.deepEqual(f[22].sunken.map(xy), [[12, 13]]);
assert.deepEqual(xy(f[30].hero), [12, 13]);
assert.deepEqual(f[31].others.map(xy), [[12, 13]]);
assert.deepEqual(f[37].mirrors.map(xy), [[12, 4]]);
assert.deepEqual(f[39].others.map(xy), [[3, 4]]);
assert.deepEqual(xy(f[43].hero), [15, 5]);
const alt = translate(/séquence de comparaison est `([HBGDXC]+)`/.exec(report)[1]),
  v = score(alt);
assert.deepEqual(v.at(-1).sunken.map(xy), [[13, 14]]);
assert.deepEqual(v.at(-1).mirrors.map(xy), [[13, 4]]);

// Intervene at the same checkpoint. A one-cell-short load changes the landing.
const shorter = stepWorld(w, { ...f[21], rocks: f[21].rocks.map((p) => ({ ...p, x: p.x + 1 })) }, 5);
assert.deepEqual(shorter.sunken.map(xy), [[12, 12]]);
for (const op of [1, 2, 3, 4]) assert.deepEqual(xy(stepWorld(w, f[30], op).hero), [12, 13]);
assert.deepEqual(stepWorld(w, f[37], 5).others.map(xy), [[12, 13]]);
const bottom = stepWorld(w, f[21], 2);
assert.deepEqual(bottom.mirrors.map(xy), [[12, 8]]);
const dry = (p) => w.tiles[p] === '.',
  reachable = new Set([12 + 20 * 8]);
// Even granting access to every dry stance, the pivot cannot get back up.
for (const p of reachable)
  for (const d of [-20, 20, -1, 1]) if (dry(p - d) && dry(p + d)) reachable.add(p + d);
assert.ok(!reachable.has(12 + 20 * 4));
console.log(
  JSON.stringify({
    oracle: moves.length,
    alternate: alt.length,
    isolated: [12, 13],
    strandedPivotSites: reachable.size,
  }),
);

if (process.argv.length > 2) {
  assert.equal(process.argv.length, 4);
  const [old, current] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8').trim()));
  const prefix = [36, 32, 42, 79, 62, 116, 37],
    entry = prefix.reduce((a, b) => a + b, 0);
  for (const run of [old, current]) {
    assert.deepEqual([run.solver, run.parallelWorkers, run.cap], ['sic', 1, 120]);
    assert.deepEqual(
      run.levels.slice(0, 7).map((l) => [l.won, l.actions]),
      prefix.map((n) => [true, n]),
    );
  }
  assert.deepEqual([old.levels[7].won, old.levels[7].actions], [false, 120]);
  const digest = (c) => [c.id, c.data, c.from, c.to];
  for (let i = 0; i < entry; i++)
    assert.deepEqual(digest(current.replayCommands[i]), digest(old.replayCommands[i]));
  const earlier = old.replayCommands.slice(entry);
  let oldState = start,
    firstSelect;
  const oldFrames = [start];
  for (const [i, c] of earlier.entries()) {
    const next = world(oldState, c);
    if (c.id === 6 && next.hero !== oldState.hero && !firstSelect) firstSelect = i + 1;
    oldFrames.push(next);
    oldState = next;
  }
  assert.deepEqual(xy(oldFrames[1].hero), [15, 5]);
  assert.ok(earlier[0].terminalContactSeal);
  assert.deepEqual(oldFrames[92].sunken.map(xy), [[10, 4]]);
  const route = current.replayCommands.slice(entry),
    relay = route[0].contactFrontier.relay;
  assert.ok(relay.cargo && relay.control);
  assert.ok(route.every((c) => c.contactFrontier?.relay));
  const campaign = new SinkingStarSession(SS01_LEVELS),
    hash = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
  let sight = campaign.observe(),
    resets = 0;
  for (const c of current.replayCommands) {
    if (hash(sight.frame) !== c.from) {
      sight = campaign.reset();
      resets++;
    }
    assert.equal(hash(sight.frame), c.from);
    sight = campaign.action(c.id, c.data);
    assert.equal(hash(sight.frame), c.to);
  }
  assert.deepEqual([sight.state, sight.levelsCompleted, resets], ['WIN', 8, 1]);
  assert.deepEqual([current.levels[7].won, current.levels[7].actions], [true, 41]);
  console.log(
    JSON.stringify({
      prefix: entry,
      firstControlChangeInBaseline: firstSelect,
      candidate: route.length,
      clicks: route.flatMap((c, i) => (c.id === 6 ? [i + 1] : [])),
      total: current.issued,
      state: sight.state,
    }),
  );
}
