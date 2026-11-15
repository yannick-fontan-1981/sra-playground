import test from 'node:test';
import assert from 'node:assert/strict';
import { GRID, PALETTE, compileLevel, initialState, stepWorld, renderWorld, cellToPixel, pixelToCell, SinkingStarSession } from '../dist/core.js';
import { LEGACY_LEVELS as SS01_LEVELS } from './fixtures/pilot-levels.mjs';

/** Authoring oracle only. Never imported by browser.ts or shipped in agent input. */
function solve(world, actions = [1,2,3,4,5]) {
  const start = initialState(world), queue = [{ state: start, path: [] }];
  const seen = new Set([JSON.stringify(start)]);
  for (let head = 0; head < queue.length; head++) {
    const { state, path } = queue[head];
    if (state.complete) return path;
    for (const action of actions) {
      const next = stepWorld(world, state, action), key = JSON.stringify(next);
      if (!seen.has(key)) { seen.add(key); queue.push({ state: next, path: [...path, action] }); }
    }
    assert.ok(queue.length < 10000, 'Pilot search should remain bounded.');
  }
  return null;
}
function rotate(spec) {
  const replacements = { '1': '2', '2': '3', '3': '4', '4': '1' };
  const rows = [...spec.rows[0]].map((_, x) => spec.rows.map(row => replacements[row[x]] ?? row[x]).reverse().join(''));
  return { ...spec, rows, facing: { N:'E', E:'S', S:'W', W:'N' }[spec.facing] };
}

for (const [index, spec] of SS01_LEVELS.entries()) {
  test(`${spec.id}: shortest witness and no walking-only shortcut`, () => {
    const world = compileLevel(spec), witness = solve(world);
    assert.deepEqual(witness, index === 0 ? [5] : [1,5]);
    assert.equal(solve(world, [1,2,3,4]), null);
    assert.ok(witness.includes(5));
  });
  test(`${spec.id}: every reachable state respects terrain, bounds, frame and determinism`, () => {
    const world = compileLevel(spec), initial = initialState(world), queue = [initial], seen = new Set([JSON.stringify(initial)]);
    for (let head = 0; head < queue.length; head++) {
      const s = queue[head];
      assert.equal(world.tiles[s.hero.y * 20 + s.hero.x], '.');
      assert.ok(s.hero.x >= 0 && s.hero.x < 20 && s.hero.y >= 0 && s.hero.y < 20);
      const frame = renderWorld(world, s);
      assert.equal(frame.length, 64);
      assert.ok(frame.every(row => row.length === 64 && row.every(c => Number.isInteger(c) && c >= 0 && c <= 15)));
      assert.deepEqual(frame, renderWorld(world, s));
      for (const a of [1,2,3,4,5]) {
        const before = JSON.stringify(s), next = stepWorld(world,s,a);
        assert.equal(JSON.stringify(s), before, 'Input state is immutable to transition.');
        assert.deepEqual(stepWorld(world, s, a), next);
        if (!seen.has(JSON.stringify(next))) { seen.add(JSON.stringify(next)); queue.push(next); }
      }
      assert.ok(queue.length < 10000);
    }
    assert.ok(seen.size > 4);
  });
}
test('geometry: 400 cells, all nine pixels per cell, strict border exclusion', () => {
  assert.equal(2 * GRID.originPx + GRID.cells * GRID.cellPx, GRID.canvasPx);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const p = cellToPixel({x,y});
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) assert.deepEqual(pixelToCell(p.x + dx, p.y + dy), {x,y});
  }
  for (const n of [-1,0,1,62,63,64,NaN,Infinity,2.5]) {
    assert.equal(pixelToCell(n,10), null); assert.equal(pixelToCell(10,n), null);
  }
  assert.throws(() => cellToPixel({x:20,y:0}), RangeError);
  assert.throws(() => cellToPixel({x:.5,y:0}), RangeError);
});
test('palette is local, exactly 16 entries, wizard 15 and bard 6 stay distinct', () => {
  assert.equal(PALETTE.length, 16); assert.equal(new Set(PALETTE).size, 16);
  assert.notEqual(PALETTE[6], PALETTE[7]); assert.notEqual(PALETTE[6], PALETTE[15]);
  assert.equal(PALETTE[13], '#8b5a2b'); assert.ok(Object.isFrozen(PALETTE));
});
test('mirrors: all four orientations preserve geometry and have different sprites', () => {
  let spec = SS01_LEVELS[0]; const sprites = new Set();
  for (let n = 0; n < 4; n++) {
    const w = compileLevel(spec), s = initialState(w), next = stepWorld(w,s,5);
    assert.deepEqual(next.hero, w.goal); assert.equal(next.complete,true);
    const p = cellToPixel(w.mirrors[0]), frame = renderWorld(w,s);
    const sprite = [0,1,2].map(dy => frame[p.y+dy].slice(p.x,p.x+3));
    assert.equal(sprite.flat().filter(c => c === 0).length,3);
    assert.equal(sprite.flat().filter(c => c === 5).length,3);
    sprites.add(JSON.stringify(sprite)); spec = rotate(spec);
  }
  assert.equal(sprites.size,4);
});
test('mirror power ignores facing when exactly one counterpart is valid', () => {
  const w = compileLevel(SS01_LEVELS[0]);
  for (const facing of ['N','S','E','W']) assert.equal(stepWorld(w,{...initialState(w),facing},5).complete,true);
});
test('water landing is rejected; failure feedback clears on the next direction input', () => {
  const w = compileLevel(SS01_LEVELS[1]), initial = initialState(w), failed = stepWorld(w,initial,5);
  assert.deepEqual(failed.hero,initial.hero); assert.equal(failed.failed,true);
  assert.equal(stepWorld(w,failed,1).failed,false);
  assert.notDeepEqual(renderWorld(w,failed),renderWorld(w,initial));
});
test('a wall on the counterpart blocks the power', () => {
  const w = compileLevel(SS01_LEVELS[2]), s = initialState(w), next = stepWorld(w,s,5);
  assert.deepEqual(next.hero,s.hero); assert.equal(next.complete,false); assert.equal(next.failed,true);
});
test('water blocks walking but a blocked direction still changes facing', () => {
  const w = compileLevel(SS01_LEVELS[0]), s = initialState(w), next = stepWorld(w,s,4);
  assert.deepEqual(next.hero,s.hero); assert.equal(next.facing,'E');
});
test('mirror body blocks walking', () => {
  const w = compileLevel(SS01_LEVELS[0]);
  const adjacent = stepWorld(w,initialState(w),1), blocked = stepWorld(w,adjacent,1);
  assert.deepEqual(blocked.hero,adjacent.hero);
});
test('mirror back does not act as an invisible third ray', () => {
  const w = compileLevel({id:'back',title:'back',facing:'S',rows:[
    '#######','#~~M~~#','#~~.~~#','#~~2.g#','#~~~~~#','#~~~~~#','#######',
  ]});
  assert.equal(stepWorld(w,initialState(w),5).failed,true);
});
test('an intervening wall blocks reflection, not just its endpoint', () => {
  const w = compileLevel({ ...SS01_LEVELS[0], rows: SS01_LEVELS[0].rows.map((r,i) => i===3 ? '#~~2#g#' : r) });
  assert.equal(stepWorld(w,initialState(w),5).failed,true);
});
test('ambiguous mirrors fail instead of choosing array order', () => {
  const w = compileLevel({id:'ambiguous',title:'ambiguous',facing:'W',rows:[
    '#########','#.......#','#.......#','#.2.M.3.#','#.......#','#.g.....#','#########',
  ]});
  const s = initialState(w); assert.equal(stepWorld(w,s,5).failed,true);
  assert.deepEqual(stepWorld(w,s,5).hero,s.hero);
});
test('goal stays visible beneath the merchant through yellow corners', () => {
  const w = compileLevel(SS01_LEVELS[0]), won = stepWorld(w,initialState(w),5), frame = renderWorld(w,won), p = cellToPixel(w.goal);
  for (const [dx,dy] of [[0,0],[0,2],[2,0],[2,2]]) assert.equal(frame[p.y+dy][p.x+dx],11);
});
test('level validation rejects malformed or unsupported maps', () => {
  const good = SS01_LEVELS[0];
  for (const rows of [[],['M.g'],['M2g','..'],['M2gg'],['MM2g'],['M2?g'],['M2g'.padEnd(21,'.')]]) {
    assert.throws(() => compileLevel({...good,rows}));
  }
  assert.throws(() => compileLevel({...good,facing:'invalid'}));
  assert.throws(() => new SinkingStarSession([]));
  assert.throws(() => new SinkingStarSession([good,good]));
  assert.ok(Object.isFrozen(compileLevel(good).tiles));
});
test('session: witnesses finish the three-level pilot, Undo restores prior level and score', () => {
  const session = new SinkingStarSession(SS01_LEVELS), start = session.observe();
  assert.equal(session.action(5).level,2);
  assert.deepEqual(session.undo(),start);
  for (const a of [5,1,5,1,5]) session.action(a);
  assert.equal(session.observe().state,'WIN'); assert.equal(session.observe().levelsCompleted,3);
  const undone = session.undo(); assert.equal(undone.state,'NOT_FINISHED'); assert.equal(undone.level,3); assert.equal(undone.levelsCompleted,2);
  assert.equal(session.action(5).state,'WIN');
  assert.deepEqual(session.restart(),start);
});
test('session: navigation does not manufacture completed levels', () => {
  const session = new SinkingStarSession(SS01_LEVELS);
  session.selectLevel(3); session.action(1); const obs = session.action(5);
  assert.equal(obs.state,'NOT_FINISHED'); assert.equal(obs.levelsCompleted,1); assert.equal(obs.level,1);
  assert.equal(session.reset().levelsCompleted,1);
  assert.equal(session.selectLevel(3).levelsCompleted,0);
  for (const bad of [0,4,1.5,NaN]) assert.throws(() => session.selectLevel(bad),RangeError);
});
test('observation is pixels and public metadata only; external changes cannot mutate session', () => {
  const session = new SinkingStarSession(SS01_LEVELS), before = session.observe();
  assert.deepEqual(Object.keys(before).sort(), ['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort());
  before.frame[0][0] = 999; before.availableActionIds.push(6); before.palette[12] = '#000000';
  assert.equal(session.observe().frame[0][0],4); assert.deepEqual(session.observe().availableActionIds,[1,2,3,4,5]);
  assert.equal(session.observe().palette[12],PALETTE[12]);
});
test('invalid actions do not mutate a session, and completed levels are absorbing', () => {
  const session = new SinkingStarSession(SS01_LEVELS), before = session.observe();
  for (const bad of [0,6,7,-1,1.5,NaN,Infinity]) assert.throws(() => session.action(bad),RangeError);
  assert.deepEqual(session.observe(),before);
  const w = compileLevel(SS01_LEVELS[0]), won = stepWorld(w,initialState(w),5);
  for (const a of [1,2,3,4,5]) assert.strictEqual(stepWorld(w,won,a),won);
});
