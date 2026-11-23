// Inspect an independently generated native SIC campaign. The oracle and its
// move sequence are not inputs. Run with Node 24 and the campaign JSONL path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileLevel, initialState, SinkingStarSession, stepWorld } from '../../../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../../../src/games/sinking-star/levels.ts';

const read = file => JSON.parse(readFileSync(file, 'utf8').trim());
const run = read(process.argv[2]);
assert.equal(run.resets, 0);
assert.deepEqual(run.levels.map(l => [l.level, l.won, l.actions]),
  [[1,true,36], [2,true,32], [3,true,42], [4,true,79], [5,true,62]]);
const session = new SinkingStarSession(SS01_LEVELS);
for (const command of run.replayCommands) session.action(command.id, command.data);
assert.equal(session.observe().levelsCompleted, 5);
assert.equal(session.observe().level, 6);

const w = compileLevel(SS01_LEVELS[4]);
const position = p => p.x + '/' + p.y;
// Independently count the pushes made possible by a landing. Approach by
// ordinary movement, preserving both the piece and the pivot, then actually
// attempt each motor and check that the box moves and survives.
function pushesFrom(s) {
  const queue = [s], seen = new Set([position(s.hero)]), pushes = new Set();
  for (const state of queue) for (const a of [1,2,3,4]) {
    const next = stepWorld(w, state, a);
    if (position(next.mirrors[0]) !== position(s.mirrors[0]) || !next.rocks.length) continue;
    if (position(next.rocks[0]) !== position(s.rocks[0])) {
      pushes.add('ACTION' + a);
    } else if (!seen.has(position(next.hero))) {
      seen.add(position(next.hero));
      queue.push(next);
    }
  }
  return pushes;
}
const commands = run.replayCommands.slice(189);
const first = commands.findIndex(c => c.contactFrontier?.purpose === 'test_passenger');
assert.equal(first + 1, 28);
const hypothesis = commands[first].contactFrontier.passenger;
let state = initialState(w), proofFrame, secondTransfer = false, crossedNewSupport = false;
for (const [i, command] of commands.entries()) {
  const before = state;
  state = stepWorld(w, state, command.id);
  const f = command.contactFrontier, forecast = f?.passenger;
  if (f?.alternatives?.includes('passive_part_transfers_alone')) {
    assert.ok(f.alternatives.includes('part_stays_at_source'));
    assert.equal(f.next, 'ACTION' + command.id);
    assert.deepEqual(state.hero, before.hero);
    assert.deepEqual(state.mirrors, before.mirrors);
    const from = before.rocks[0], to = state.rocks[0];
    assert.notEqual(position(from), position(to));
    assert.deepEqual([to.x - from.x, to.y - from.y],
      [forecast.destination % f.width - forecast.source % f.width,
        Math.floor(forecast.destination / f.width) - Math.floor(forecast.source / f.width)]);
    assert.deepEqual(new Set(forecast.pushes), pushesFrom(state));
    if (f.purpose === 'test_passenger') {
      assert.deepEqual(forecast, hypothesis);
      assert.equal(i+1, 41);
      assert.equal(pushesFrom(state).size, 4);
      proofFrame = command.to;
    } else {
      assert.equal(f.purpose, 'reach_goal');
      assert.equal(i+1, 50);
      assert.ok(proofFrame && forecast.witness.endsWith(':frame:' + proofFrame));
      secondTransfer = true;
    }
  }
  if (f?.verifyEntry && state.sunken.some(p => position(p) === position(state.hero))) crossedNewSupport = true;
}
assert.ok(secondTransfer && crossedNewSupport && state.complete);
if (process.argv[3]) {
  const baseline = read(process.argv[3]).replayCommands;
  const index = run.replayCommands.findIndex((c,i) => !baseline[i] ||
    c.id !== baseline[i].id || c.from !== baseline[i].from || c.to !== baseline[i].to);
  assert.equal(index+1, 217);
}
console.log('5 niveaux crédités. L5 en 62 coups. Projet au 28, transfert isolé au 41, réutilisation au 50, appui vérifié.');
