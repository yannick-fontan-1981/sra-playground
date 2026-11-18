import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { SinkingStarSession } from '../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../src/games/sinking-star/levels.ts';
import { createSinkingStarBackend } from '../src/games/sinking-star.ts';
import { createSs02Backend } from '../src/games/sinking-star-ss02.ts';
import { PushPuzzleSession } from '../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../experiments/sinking-star-ss02/src/levels.ts';
import ss02Witnesses from '../experiments/sinking-star-ss02/tests/witnesses.json' with { type: 'json' };
import { routes } from './ss01-routes.ts';

test('Custom 4 lists SS01 then SS02 and preserves all four legacy collections', async () => {
  const { GAME_CATALOG, getGameByCode } = await import('../src/games/catalog.ts');
  assert.equal(GAME_CATALOG.length, 102);
  assert.equal(new Set(GAME_CATALOG.map(g => g.id)).size, GAME_CATALOG.length);
  assert.deepEqual(GAME_CATALOG.filter(g => g.group === 'custom_4').map(g => g.code), ['SS01','SS02']);
  for (const group of ['official','custom','custom_2','custom_3']) assert.equal(GAME_CATALOG.filter(g => g.group === group).length,25);
  assert.equal(getGameByCode(' ss01 ')?.levels,8);
  assert.match(getGameByCode('SS01')!.sourceUrl, /src\/games\/sinking-star\/levels\.ts$/);
  assert.equal(getGameByCode(' ss02 ')?.levels,8);
  assert.equal(getGameByCode('SS02')?.id, 'ss02-c4000001');
  assert.match(getGameByCode('SS02')!.sourceUrl, /experiments\/sinking-star-ss02\/src\/levels\.ts$/);
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

test('SS02 matches the laboratory through all 536 directions and eight levels without Python', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new PushPuzzleSession(SS02_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss02 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(Object.keys(current).sort(), ['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort());
  let directions = 0;
  let animatedPushes = 0;
  for (const [index, witness] of ss02Witnesses.entries()) {
    assert.equal(current.level, index + 1);
    for (const actionId of witness.actions) {
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4]);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (current.frames.length === 3) {
        animatedPushes++;
        assert.deepEqual(current.frameDurationsMs, [60, 80, 0]);
      }
      directions++;
    }
    assert.equal(current.levelsCompleted, index + 1);
  }
  assert.equal(directions, 536);
  assert.ok(animatedPushes > 0);
  assert.equal(current.state, 'WIN');
});

test('SS02 rejects Space and Merchant selection, and matches Undo, Reset, Restart and level selection', async () => {
  const backend = createSs02Backend();
  const reference = new PushPuzzleSession(SS02_LEVELS);
  assert.deepEqual(await backend.dispatch({ type: 'load', code: 'SS02', level: 7 }), reference.selectLevel(7));
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 5 }), /ACTION1–ACTION4/);
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data: { x: 12, y: 16 } }), /ACTION1–ACTION4/);
  assert.throws(() => backend.dispatch({ type: 'nextMerchant' }), /only supports/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 9 }), /Invalid level/);
  for (const request of [{ type: 'reset' }, { type: 'restart' }, { type: 'action', actionId: 4 },
    { type: 'undo' }, { type: 'selectLevel', level: 8 }] as const) {
    const expected = request.type === 'action' ? reference.action(request.actionId)
      : request.type === 'selectLevel' ? reference.selectLevel(request.level) : reference[request.type]();
    assert.deepEqual(await backend.dispatch(request), expected);
  }
});

test('SS01, SS02 and legacy sessions switch with Python loaded only once after an initial failure', async () => {
  let loads = 0;
  const dispatcher = createGameDispatcher(async () => {
    if (++loads === 1) throw new Error('offline');
    return { dispatch: request => {
      assert.equal(request.type, 'load');
      return { ...new PushPuzzleSession(SS02_LEVELS).observe(), gameCode: request.code };
    } };
  });
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS01' })).gameCode, 'SS01');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS02' })).gameCode, 'SS02');
  assert.equal(loads, 0);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'CASC' })), /offline/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 1 })), /Load a game/);
  for (const code of ['CASC', 'SS02', 'SS01', 'LS20']) {
    assert.equal((await dispatcher.dispatch({ type: 'load', code })).gameCode, code);
  }
  assert.equal(loads, 2);
});
