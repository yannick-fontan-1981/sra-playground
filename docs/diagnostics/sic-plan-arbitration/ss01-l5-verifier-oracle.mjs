// Offline SS01 L5 diagnostic. No solver imports this file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileLevel, initialState, reflectionPreviews, SinkingStarSession, stepWorld } from '../../../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../../../src/games/sinking-star/levels.ts';

const report = readFileSync(new URL('./ss01-l5-oracle-caisse-marquee.md', import.meta.url), 'utf8');
const names = ' HBGDX';
const route = [];
for (const [, first, last, sequence] of report.matchAll(/^\| (\d+)–(\d+) \| `([HBGDX\d ]+)` \|/gm)) {
  assert.equal(route.length + 1, Number(first));
  for (const token of sequence.split(' ')) {
    const [, name, repeat] = /^([HBGDX])([1-9]\d*)?$/.exec(token);
    route.push(...Array(Number(repeat ?? 1)).fill(names.indexOf(name)));
  }
  assert.equal(route.length, Number(last));
}
assert.equal(route.length, 38);
const world = compileLevel(SS01_LEVELS[4]);
const start = initialState(world);
const cell = ({x, y}) => 20 * y + x;
const directions = [-20, 20, -1, 1];
const coord = (x, y) => x + 20 * y;
const bridge = coord(6, 8);
const crate = s => s.rocks.length ? cell(s.rocks[0]) : -1;
const mirror = s => cell(s.mirrors[0]);
const physical = s => [cell(s.hero), mirror(s), crate(s), ...s.sunken.map(cell)].join('/');
const play = (state, moves) => moves.reduce((s, a) => stepWorld(world, s, a), state);
const game = new SinkingStarSession(SS01_LEVELS);
game.selectLevel(5);
const frames = [start];
for (const a of route) {
  frames.push(stepWorld(world, frames.at(-1), a));
  game.action(a);
}
assert.equal(game.observe().levelsCompleted, 1);
assert.equal(frames[38].complete, true);
assert.deepEqual(reflectionPreviews(world, frames[17]), [
  {from: {x: 10, y: 9}, to: {x: 12, y: 7}, kind: 'stone', valid: true},
]);
function inert(s) {
  return {...s, rocks: s.rocks.map(r => ({...r, reflectable: false}))};
}
assert.equal(physical(play(inert(frames[17]), [5])), physical(frames[17]));
assert.equal(physical(play(frames[18], [5])), physical(frames[17]));
for (const [n, from, to] of [[18, coord(10, 9), coord(12, 7)], [26, coord(12, 6), coord(7, 11)]]) {
  assert.equal(crate(frames[n-1]), from);
  assert.equal(crate(frames[n]), to);
  assert.equal(cell(frames[n-1].hero), cell(frames[n].hero));
  assert.equal(mirror(frames[n-1]), mirror(frames[n]));
}
assert.equal(cell(frames[28].hero), coord(8, 11));
assert.equal(crate(frames[29]), coord(6, 11));
assert.deepEqual(frames[34].sunken.map(cell), [bridge]);

function flood(seed, mayEnter) {
  const cells = new Set([seed]);
  for (const pos of cells) for (const d of directions) {
    const next = pos + d;
    if (Math.abs(pos % 20 - next % 20) <= 1 && mayEnter(next)) cells.add(next);
  }
  return cells;
}
const dry = p => world.tiles[p] === '.';
const right = flood(crate(start), dry), top = flood(cell(world.goal), dry);
function availablePushes(s) {
  const box = crate(s);
  if (box < 0) return [];
  const free = p => dry(p) && p !== mirror(s) && p !== box;
  const walk = flood(cell(s.hero), free);
  return directions.filter(d => walk.has(box - d) && free(box + d));
}
const fourPushes = s => availablePushes(s).length === 4;
assert.ok(fourPushes(frames[18]));
for (const [prepare, landing, count] of [[[], coord(13,6), 0], [[4,1,3], coord(12,7), 4]]) {
  const ready = play(frames[13], prepare), result = play(ready, [5]);
  const previews = reflectionPreviews(world, ready);
  assert.equal(previews.length, 1);
  assert.ok(previews[0].valid && previews[0].kind === 'stone' && cell(previews[0].to) === landing);
  assert.equal(crate(result), landing);
  assert.equal(cell(result.hero), cell(ready.hero));
  assert.equal(availablePushes(result).length, count);
  assert.equal(physical(play(result, [5])), physical(ready));
}

// Index only physical state. This level has a single mirror of fixed orientation
// and one crate that becomes a single permanent platform when it sinks.
function build(initial) {
  const states = [initial], index = new Map([[physical(initial), 0]]), edges = [], back = [[]];
  for (const [i, s] of states.entries()) {
    const row = [];
    for (let a = 1; a <= 5; a++) {
      const t = stepWorld(world, s, a), key = physical(t);
      if (!index.has(key)) {
        index.set(key, states.length);
        states.push(t);
        back.push([]);
      }
      const j = index.get(key);
      row.push(j);
      if (i !== j) back[j].push(i);
    }
    edges.push(row);
  }
  const viable = new Set(states.flatMap((s, i) => s.complete ? [i] : []));
  for (const i of viable) for (const j of back[i]) viable.add(j);
  return {states, index, edges, viable};
}
const graph = build(start);
function distances(from, allow = () => true) {
  const dist = new Map([[from, 0]]);
  for (const [i, n] of dist) for (const [k, j] of graph.edges[i].entries()) {
    if (!dist.has(j) && allow(i, k+1, j)) dist.set(j, n+1);
  }
  return dist;
}
function minWin(dist) {
  let best = Infinity;
  for (const [i, n] of dist) if (graph.states[i].complete) best = Math.min(n, best);
  return best;
}
const changedDryCrate = (s, t) => crate(s) >= 0 && crate(t) >= 0 && crate(s) !== crate(t);
const onRight = (s, t) => changedDryCrate(s, t) && right.has(crate(s)) && right.has(crate(t));
assert.equal(graph.states.length, 46829);
assert.equal(minWin(distances(0)), 38);
const dormant = build(inert(start));
assert.equal(dormant.states.length, 1930);
assert.equal(dormant.viable.size, 0);
for (const [i, s] of graph.states.entries()) {
  if (s.complete) assert.ok(s.sunken.some(p => cell(p) === bridge));
  const t = graph.states[graph.edges[i][4]];
  if (!top.has(cell(s.hero))) assert.ok(!top.has(cell(t.hero)));
  if (s.rocks.length) assert.ok(!t.sunken.some(p => cell(p) === bridge));
}
assert.equal(minWin(distances(0, (i, a, j) => a !== 5 || !onRight(graph.states[i], graph.states[j]))), Infinity);
assert.equal(minWin(distances(0, (i, a, j) => {
  const s = graph.states[i], t = graph.states[j];
  return !(a === 5 && changedDryCrate(s, t) && right.has(crate(t)) && fourPushes(t));
})), 44);
const shoreOutcomes = new Set();
const initialCrate = distances(0, (_i, _a, j) => crate(graph.states[j]) === crate(start));
for (const i of initialCrate.keys()) for (const [k, j] of graph.edges[i].slice(0, 4).entries()) {
  const t = graph.states[j];
  if (crate(t) === crate(start)) continue;
  assert.equal(crate(t), -1);
  assert.ok(!graph.viable.has(j));
  shoreOutcomes.add(names[k+1] + ':' + cell(t.sunken[0]));
}
assert.deepEqual(shoreOutcomes, new Set(['G:' + coord(9,9), 'H:' + coord(10,8)]));

// Native campaign witness, up to and including its first irreversible decision.
const observedPrefix = 'BBBDHGBDXBHHXDXHGHGBBXDDDXXBBDGHDDDHDGDGDXXHDXXXBBBBB';
const decode = word => [...word].map(c => names.indexOf(c));
let prior = 0, lost;
for (const [k, a] of decode(observedPrefix).entries()) {
  const j = graph.edges[prior][a-1];
  assert.equal(graph.viable.has(j), k + 1 < 53);
  if (k + 1 === 53) { lost = j; break; }
  prior = j;
}
assert.deepEqual(graph.edges[prior].map(j => graph.viable.has(j)), [true, false, true, true, true]);
const trapped = distances(lost);
assert.equal(trapped.size, 115);
for (const j of trapped.keys()) assert.equal(mirror(graph.states[j]), coord(13,12));
assert.equal(minWin(distances(prior)), 30);
const probed = play(graph.states[prior], decode('XBDHHDHGX'));
assert.equal(crate(probed), coord(12,7));
assert.ok(fourPushes(probed));

if (process.argv[2]) {
  const run = JSON.parse(readFileSync(process.argv[2], 'utf8').trim());
  assert.deepEqual(run.levels.map(s => [s.won, s.actions]),
    [[true,36], [true,32], [true,42], [true,79], [false,120]]);
  assert.equal(run.resets, 0);
  const l5 = run.replayCommands.slice(189).map(c => c.id);
  assert.equal(l5.length, 120);
  assert.deepEqual(l5.slice(0,53), decode(observedPrefix));
  let i = 0, activations = 0, crossings = 0;
  for (const a of l5) {
    const s = graph.states[i], activated = graph.states[graph.edges[i][4]];
    assert.ok(!changedDryCrate(s, activated));
    i = graph.edges[i][a-1];
    const t = graph.states[i];
    assert.equal(crate(t), crate(start));
    if (a === 5) { activations++; if (cell(s.hero) !== cell(t.hero)) crossings++; }
  }
  assert.deepEqual([activations, crossings], [21, 16]);
  console.log('Campagne autonome vérifiée. L5 : 120 coups, 21 activations, premier blocage au coup 53.');
}
console.log('Oracle vérifié. L5 crédité en 38 coups. Caisse inerte : aucune victoire. Après la poussée 53 : 115 états, aucune victoire.');
