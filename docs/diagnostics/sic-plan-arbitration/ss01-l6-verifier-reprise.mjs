// Run with Node 24, the frozen baseline campaign JSONL and the candidate JSONL.
// Only the evaluator reads game state. Native SIC receives the public images.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {compileLevel, initialState, SinkingStarSession, stepWorld} from '../../../src/games/sinking-star/core.ts';
import {SS01_LEVELS} from '../../../src/games/sinking-star/levels.ts';

const read = path => JSON.parse(readFileSync(path, 'utf8').trim());
const hash = frame => createHash('sha256').update(JSON.stringify(frame)).digest('hex').slice(0,16);
const baseline = read(process.argv[2]), candidate = read(process.argv[3]);
const prefix = [36,32,42,79,62], entry = prefix.reduce((a,b) => a+b,0);
for (const run of [baseline, candidate]) {
  assert.deepEqual(run.levels.slice(0,5).map(row => [row.won,row.actions]), prefix.map(n => [true,n]));
}
assert.equal(baseline.levels[5].won, false);
assert.equal(baseline.resets, 0);
assert.equal(candidate.levels[5].won, true);
assert.equal(candidate.resets, 1);
const trappedAt = 29, before = baseline.replayCommands[entry + trappedAt - 1];
for (let k = 0; k < entry + trappedAt; k++) {
  const a = baseline.replayCommands[k], b = candidate.replayCommands[k];
  assert.deepEqual([a.id,a.from,a.to], [b.id,b.from,b.to]);
}
const session = new SinkingStarSession(SS01_LEVELS);
let shown = session.observe(), resetAt, alternative, restore;
for (const [index, cmd] of candidate.replayCommands.entries()) {
  if (cmd.from !== hash(shown.frame)) {
    assert.equal(index, entry + trappedAt);
    assert.equal(shown.level, 6);
    assert.equal(shown.levelsCompleted, 5);
    shown = session.reset();
    assert.equal(hash(shown.frame), candidate.replayCommands[entry].from);
    resetAt = index - entry;
  }
  assert.equal(cmd.from, hash(shown.frame));
  if (resetAt && cmd.from === before.from && !alternative) {
    assert.notEqual(cmd.id, before.id);
    assert.equal(cmd.contactFrontier?.purpose, 'reach_goal');
    restore = cmd.contactFrontier.afterReset;
    assert.equal(restore.checkpoint, cmd.from);
    assert.ok(restore.alternativeLength > 0);
    alternative = {at:index+1-entry, op:cmd.id};
  }
  shown = session.action(cmd.id,cmd.data);
  assert.equal(hash(shown.frame), cmd.to);
}
assert.ok(resetAt && alternative);
assert.equal(shown.level, 7);
assert.equal(shown.levelsCompleted, 6);

// Independent mechanical comparison, including every possible immersion.
const world = compileLevel(SS01_LEVELS[5]);
const first = initialState(world), l6 = baseline.replayCommands.slice(entry);
const position = p => p.y*20+p.x;
const key = s => [position(s.hero),...s.mirrors.map(position), ...s.rocks.map(r => [r.reflectable!==false,position(r)]),
  -1,...s.sunken.map(position).sort((a,b) => a-b)].join('/');
const old = l6.slice(0,trappedAt-1).reduce((s,cmd) => stepWorld(world,s,cmd.id),first);
const trap = stepWorld(world,old,before.id), queue = [trap], seen = new Set([key(trap)]), mirrorSites = new Set();
assert.notEqual(position(trap.mirrors[0]),position(old.mirrors[0]));
const controls = [1,2,3,4,5];
for (const op of controls.filter(op => op !== before.id)) {
  const next = stepWorld(world,old,op);
  assert.ok(controls.some(reverse => key(stepWorld(world,next,reverse)) === key(old)));
}
for (const s of queue) {
  assert.equal(s.complete,false);
  mirrorSites.add(position(s.mirrors[0]));
  for (const op of controls) {
    const next = stepWorld(world,s,op), id = key(next);
    if (!seen.has(id)) { seen.add(id); queue.push(next); }
  }
}
assert.equal(seen.size, 5259);
assert.equal(mirrorSites.size, 3);
assert.ok(!mirrorSites.has(position(old.mirrors[0])));
// A single manual undo is a second physical control from the same losing state.
const manual = new SinkingStarSession(SS01_LEVELS);
manual.selectLevel(6);
for (const cmd of l6.slice(0,trappedAt)) manual.action(cmd.id,cmd.data);
assert.equal(hash(manual.observe().frame), before.to);
assert.equal(hash(manual.undo().frame), before.from);
console.log(JSON.stringify({resetAt, alternative, alternativeLength:restore.alternativeLength,
  trappedStates:seen.size, mirrorSites:mirrorSites.size, actions:candidate.levels[5].actions, opens:shown.level}));
