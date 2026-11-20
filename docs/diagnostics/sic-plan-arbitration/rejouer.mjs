import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const proof = JSON.parse(await readFile(new URL('depart-direct.json', import.meta.url), 'utf8'));
const root = resolve(process.argv[2]);
assert.equal(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), proof.engine);
const load = name => import(pathToFileURL(resolve(root, 'src/games/sinking-star', name)).href);
const { SinkingStarSession, compileLevel, initialState, stepWorld, pixelToCell } = await load('core.ts');
const { SS01_LEVELS } = await load('levels.ts');
const spec = SS01_LEVELS[1], world = compileLevel(spec);
const local = p => [p.x - Math.floor((20 - spec.rows[0].length) / 2) + 1,
  p.y - Math.floor((20 - spec.rows.length) / 2) + 1];
const forecastCell = xy => local(pixelToCell(Math.floor(xy[0] / 2), Math.floor(xy[1] / 2)));
const hash = frame => createHash('sha256').update(JSON.stringify(frame)).digest('hex').slice(0, 16);
const same = (a, b) => a.x === b.x && a.y === b.y;
function island(origin) {
  const queue = [origin], seen = new Set([origin.y * 20 + origin.x]);
  for (const p of queue) for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const x = p.x + dx, y = p.y + dy, k = y * 20 + x;
    if (x < 0 || y < 0 || x >= 20 || y >= 20 || world.tiles[k] !== '.' || seen.has(k)) continue;
    seen.add(k);
    queue.push({x, y});
  }
  return seen;
}
const top = island(world.start), right = island(world.goal);
const region = p => top.has(p.y*20+p.x) ? 'haut' : right.has(p.y*20+p.x) ? 'droite' : 'gauche';
const game = new SinkingStarSession(SS01_LEVELS);
let board = game.selectLevel(2), state = initialState(world);
assert.equal(board.levelsCompleted, 0);
const crossings = [], pushes = [], activations = [], forecasts = [];
for (const [i, cmd] of proof.actions.entries()) {
  const n = i + 1, before = state;
  assert.equal(board.level, 2);
  assert.equal(hash(board.frame), cmd.from);
  const stage = proof.plans.find(p => n >= p.start && n < p.start + p.steps.length);
  if (stage) {
    const step = stage.steps[n - stage.start];
    assert.equal(step.op, 'ACTION' + cmd.id);
    assert.deepEqual(forecastCell(step.p), local(state.hero));
    assert.ok(state.mirrors.some(m => local(m).join() === forecastCell(step.c).join()));
    if (stage.start === n) forecasts.push({command:n, reachable:stage.home,
      proposed:stage.otherSetups, mirror:forecastCell(stage.placed), launch:forecastCell(stage.launch),
      arrival:forecastCell(stage.arrival), continuation:forecastCell(stage.use)});
  }
  state = stepWorld(world, before, cmd.id, cmd.data);
  board = game.action(cmd.id, cmd.data);
  assert.equal(hash(board.frame), cmd.to);
  if (stage) {
    const step = stage.steps[n - stage.start];
    assert.deepEqual(forecastCell(step.to), local(state.hero));
    assert.ok(state.mirrors.some(m => local(m).join() === forecastCell(step.placed).join()));
  }
  if (cmd.id === 5) activations.push({n, from:local(before.hero), to:local(state.hero)});
  if (region(before.hero) !== region(state.hero)) crossings.push({n, region:region(state.hero), at:local(state.hero)});
  for (let j = 0; j < state.mirrors.length; j++) if (!same(before.mirrors[j], state.mirrors[j]))
    pushes.push({n, from:local(before.mirrors[j]), to:local(state.mirrors[j])});
}
assert.equal(state.complete, true);
assert.equal(board.levelsCompleted, 1);
assert.equal(board.level, 1);
console.log(JSON.stringify({commands:proof.actions.length, priorActions:0, score:board.levelsCompleted,
  nextDisplayedLevel:board.level, forecasts, activations, pushes, crossings, lastCell:local(state.hero)}));
