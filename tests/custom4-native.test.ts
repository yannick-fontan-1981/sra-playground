import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { SinkingStarSession } from '../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../src/games/sinking-star/levels.ts';
import { createSinkingStarBackend } from '../src/games/sinking-star.ts';
import { routes } from './ss01-routes.ts';

test('Custom 4 starts with SS01 and preserves all four legacy collections', async () => {
  const { GAME_CATALOG, getGameByCode } = await import('../src/games/catalog.ts');
  assert.equal(GAME_CATALOG.length, 101);
  assert.deepEqual(GAME_CATALOG.filter(g => g.group === 'custom_4').map(g => g.code), ['SS01']);
  for (const group of ['official','custom','custom_2','custom_3']) assert.equal(GAME_CATALOG.filter(g => g.group === group).length,25);
  assert.equal(getGameByCode(' ss01 ')?.levels,8);
  assert.match(getGameByCode('SS01')!.sourceUrl, /src\/games\/sinking-star\/levels\.ts$/);
});
test('SS01 loads natively without invoking the Python loader', async () => {
  let legacyLoads = 0;
  const dispatcher = createGameDispatcher(async () => {legacyLoads++; throw new Error('Python must not load');});
  const first = await dispatcher.dispatch({type:'load',code:'ss01'});
  assert.equal(first.level,1); assert.equal(first.gameCode,'SS01'); assert.equal(first.levelCount,8);
  assert.ok(first.availableActionIds.includes(6)); assert.equal(legacyLoads,0);
  assert.deepEqual(first, new SinkingStarSession(SS01_LEVELS).observe());
});
test('eight levels retain pixel/action/animation parity and finish WIN through the production router', async () => {
  const dispatcher = createGameDispatcher(async()=>{throw new Error('Unexpected Python');});
  const reference = new SinkingStarSession(SS01_LEVELS);
  let current = await dispatcher.dispatch({type:'load',code:'SS01'}), animations = 0;
  assert.deepEqual(current, reference.observe());
  for (const [index, packed] of routes.entries()) {
    assert.equal(current.level, index + 1);
    for (const command of packed.replace(/([A-Z])(\d+)/g, (_, c, n) => c.repeat(Number(n)))) {
      if (command === 'C') {
        current = await dispatcher.dispatch({type:'nextMerchant'});
        assert.deepEqual(current, reference.nextMerchant());
      } else {
        const actionId = ({U:1,D:2,L:3,R:4,X:5} as Record<string,number>)[command]!;
        current = await dispatcher.dispatch({type:'action',actionId});
        assert.deepEqual(current, reference.action(actionId));
      }
      assert.deepEqual(current.frames.at(-1),current.frame);
      if (current.frames.length > 1) animations++;
    }
  }
  assert.ok(animations > 2); assert.equal(current.state,'WIN'); assert.equal(current.levelsCompleted,8);
});
test('Undo, reset, restart, direct level navigation and manual merchant switch match v5', async () => {
  const backend = createSinkingStarBackend(), reference = new SinkingStarSession(SS01_LEVELS);
  await backend.dispatch({type:'load',code:'SS01'});
  for (const request of [{type:'nextMerchant'},{type:'undo'},{type:'selectLevel',level:8},{type:'nextMerchant'},
    {type:'action',actionId:3},{type:'reset'},{type:'restart'}] as const) {
    const expected = request.type==='action' ? reference.action(request.actionId)
      : request.type==='selectLevel' ? reference.selectLevel(request.level) : reference[request.type]();
    assert.deepEqual(await backend.dispatch(request),expected);
  }
});
test('native observations expose pixels and public metadata, never maps or solutions', async () => {
  const o = await createSinkingStarBackend().dispatch({type:'load',code:'SS01'});
  assert.deepEqual(Object.keys(o).sort(),['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort());
  assert.equal(o.frame.length,64);assert.ok(o.frame.every(row=>row.length===64&&row.every(p=>Number.isInteger(p)&&p>=0&&p<=15)));
});
test('legacy games reuse the legacy backend after switching from and to SS01', async () => {
  let loads = 0; const requests: unknown[]=[];
  const dummy = new SinkingStarSession(SS01_LEVELS).observe();
  const dispatcher = createGameDispatcher(async()=>{loads++;return {dispatch:r=>{requests.push(r);return {...dummy,gameCode:'CASC'};}};});
  await dispatcher.dispatch({type:'load',code:'CASC'});await dispatcher.dispatch({type:'action',actionId:1});
  await dispatcher.dispatch({type:'load',code:'SS01'});await dispatcher.dispatch({type:'action',actionId:2});
  await dispatcher.dispatch({type:'load',code:'LS20'});await dispatcher.dispatch({type:'undo'});
  assert.equal(loads,1);assert.equal(requests.length,4);
});
test('failed loads do not leave an old game active and can be retried', async () => {
  let fail=true;
  const dispatcher=createGameDispatcher(async()=>{if(fail){fail=false;throw new Error('offline');}return createSinkingStarBackend();});
  await dispatcher.dispatch({type:'load',code:'SS01'});
  await assert.rejects(()=>Promise.resolve(dispatcher.dispatch({type:'load',code:'CASC'})),/offline/);
  await assert.rejects(()=>Promise.resolve(dispatcher.dispatch({type:'action',actionId:1})),/Load a game/);
  assert.equal((await dispatcher.dispatch({type:'load',code:'SS01'})).gameCode,'SS01');
});
test('invalid levels and malformed coordinate actions are rejected without changing state', async () => {
  const backend=createSinkingStarBackend();const initial=await backend.dispatch({type:'load',code:'SS01'});
  assert.throws(()=>backend.dispatch({type:'selectLevel',level:0}),/Invalid level/);
  assert.throws(()=>backend.dispatch({type:'action',actionId:6}),/coordinates/);
  assert.throws(()=>backend.dispatch({type:'action',actionId:6,data:{x:64,y:0}}),/coordinates/);
  assert.deepEqual(await backend.dispatch({type:'undo'}),initial);
});
