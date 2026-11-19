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
import { createSs03Backend } from '../src/games/sinking-star-ss03.ts';
import { compileLevel, initialState, PullPuzzleSession, stepDetailed } from '../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../experiments/sinking-star-ss03/src/levels.ts';
import ss03Witnesses from '../experiments/sinking-star-ss03/tests/witnesses.json' with { type: 'json' };
import { WizardPuzzleSession, compileLevel as compileWizardLevel, initialState as initialWizardState, planSwap, stepDetailed as stepWizard } from '../experiments/sinking-star-ss04/src/core.ts';
import { SS04_LEVELS } from '../experiments/sinking-star-ss04/src/levels.ts';
import ss04Witnesses from '../experiments/sinking-star-ss04/tests/witnesses.json' with { type: 'json' };
import { createSs05Backend } from '../src/games/sinking-star-ss05.ts';
import { BardPuzzleSession, compileLevel as compileBardLevel, initialState as initialBardState, stepDetailed as stepBard } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import ss05Witnesses from '../experiments/sinking-star-ss05/tests/witnesses.json' with { type: 'json' };
import { createSs06Backend } from '../src/games/sinking-star-ss06.ts';
import { DuoPuzzleSession, circuitPressed, compileLevel as compileDuoLevel, initialState as initialDuoState, stepDetailed as stepDuo } from '../experiments/sinking-star-ss06/src/core.ts';
import { SS06_LEVELS } from '../experiments/sinking-star-ss06/src/levels.ts';
import { lessonIds as duoLessonIds, observeLesson as observeDuoLesson, visibleHeroes, type DuoLesson } from '../experiments/sinking-star-ss06/src/tutorial.ts';
import ss06Witnesses from '../experiments/sinking-star-ss06/tests/witnesses.json' with { type: 'json' };
import ss06Failures from '../experiments/sinking-star-ss06/tests/failures.json' with { type: 'json' };
import { createSs07Backend } from '../src/games/sinking-star-ss07.ts';
import { DuoPuzzleSession as ThiefDuoSession, compileLevel as compileThiefLevel, initialState as initialThiefState, stepDetailed as stepThief } from '../experiments/sinking-star-ss07/src/core.ts';
import { SS07_LEVELS } from '../experiments/sinking-star-ss07/src/levels.ts';
import { lessonIds as thiefLessonIds, observeLesson as observeThiefLesson, visibleHeroes as visibleThiefHeroes, type ThiefLesson } from '../experiments/sinking-star-ss07/src/tutorial.ts';
import ss07Witnesses from '../experiments/sinking-star-ss07/tests/witnesses.json' with { type: 'json' };
import ss07Failures from '../experiments/sinking-star-ss07/tests/failures.json' with { type: 'json' };
import { routes } from './ss01-routes.ts';

test('Custom 4 lists SS01 through SS07 and preserves all four legacy collections', async () => {
  const { GAME_CATALOG, getGameByCode } = await import('../src/games/catalog.ts');
  assert.equal(GAME_CATALOG.length, 107);
  assert.equal(new Set(GAME_CATALOG.map(g => g.id)).size, GAME_CATALOG.length);
  assert.deepEqual(GAME_CATALOG.filter(g => g.group === 'custom_4').map(g => g.code), ['SS01','SS02','SS03','SS04','SS05','SS06','SS07']);
  for (const group of ['official','custom','custom_2','custom_3']) assert.equal(GAME_CATALOG.filter(g => g.group === group).length,25);
  assert.equal(getGameByCode(' ss01 ')?.levels,8);
  assert.match(getGameByCode('SS01')!.sourceUrl, /src\/games\/sinking-star\/levels\.ts$/);
  assert.equal(getGameByCode(' ss02 ')?.levels,8);
  assert.equal(getGameByCode('SS02')?.id, 'ss02-c4000001');
  assert.match(getGameByCode('SS02')!.sourceUrl, /experiments\/sinking-star-ss02\/src\/levels\.ts$/);
  assert.equal(getGameByCode(' ss03 ')?.levels, 8);
  assert.equal(getGameByCode('SS03')?.id, 'ss03-c4000001');
  assert.equal(getGameByCode('SS03')?.name, 'La ruse verte');
  assert.match(getGameByCode('SS03')!.sourceUrl, /experiments\/sinking-star-ss03\/src\/levels\.ts$/);
  assert.equal(getGameByCode(' ss04 ')?.levels, 8);
  assert.equal(getGameByCode('SS04')?.id, 'ss04-c4000001');
  assert.equal(getGameByCode('SS04')?.name, 'L’Axe violet');
  assert.match(getGameByCode('SS04')!.sourceUrl, /experiments\/sinking-star-ss04\/src\/levels\.ts$/);
  assert.equal(getGameByCode(' ss05 ')?.levels, 8);
  assert.equal(getGameByCode('SS05')?.id, 'ss05-c4000001');
  assert.equal(getGameByCode('SS05')?.name, 'Le Chant Magenta');
  assert.match(getGameByCode('SS05')!.sourceUrl, /experiments\/sinking-star-ss05\/src\/levels\.ts$/);
  const ss06 = getGameByCode(' ss06 ');
  assert.equal(ss06?.id, 'ss06-c4000001');
  assert.equal(ss06?.name, 'Les Ponts Réfléchis');
  assert.equal(ss06?.levels, 8);
  assert.equal(ss06?.availability, 'playable');
  assert.match(ss06!.sourceUrl, /experiments\/sinking-star-ss06\/src\/levels\.ts$/);
  const ss07 = getGameByCode(' ss07 ');
  assert.equal(ss07?.id, 'ss07-c4000001');
  assert.equal(ss07?.name, 'La Distance Dérobée');
  assert.equal(ss07?.levels, 8);
  assert.equal(ss07?.availability, 'playable');
  assert.match(ss07!.sourceUrl, /experiments\/sinking-star-ss07\/src\/levels\.ts$/);
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

test('all native and legacy sessions switch with Python loaded only once after an initial failure', async () => {
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
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS03' })).gameCode, 'SS03');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS04' })).gameCode, 'SS04');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS05' })).gameCode, 'SS05');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS06' })).gameCode, 'SS06');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS07' })).gameCode, 'SS07');
  assert.equal(loads, 0);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'CASC' })), /offline/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 1 })), /Load a game/);
  for (const code of ['CASC', 'SS07', 'SS06', 'SS05', 'SS04', 'SS03', 'SS02', 'SS01', 'LS20', 'SS07']) {
    assert.equal((await dispatcher.dispatch({ type: 'load', code })).gameCode, code);
  }
  assert.equal(loads, 2);
});

test('SS03 replays the eight lab witnesses through the dispatcher without Python', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new PullPuzzleSession(SS03_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss03 ' });
  assert.deepEqual(current, reference.observe());
  const publicKeys = Object.keys(current).sort();
  assert.deepEqual(publicKeys, ['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort());
  let directions = 0, pulls = 0, pistons = 0, combinedPush = false, cascade = false;
  for (const [index, { actions }] of ss03Witnesses.entries()) {
    assert.equal(current.level, index + 1);
    const world = compileLevel(SS03_LEVELS[index]!);
    let state = initialState(world);
    for (const actionId of actions) {
      const detail = stepDetailed(world, state, actionId);
      state = detail.state;
      const kinds = detail.phases.map(phase => phase.kind);
      pulls += kinds.filter(kind => kind === 'pull').length;
      pistons += kinds.filter(kind => kind === 'piston').length;
      const previous = current;
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
      assert.deepEqual(current.frames.at(-1), current.frame);
      assert.equal(current.frameDurationsMs?.length ?? 1, current.frames.length);
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4]);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      if (kinds.includes('pull') && kinds.includes('piston') && current.level === previous.level) {
        if (kinds.length === 2) {
          assert.deepEqual(current.frameDurationsMs, [60, 80, 40, 60, 80, 0]);
          combinedPush = true;
        }
      }
      if (kinds.filter(kind => kind === 'piston').length > 1) cascade ||= current.frames.length > 6;
      directions++;
    }
    assert.equal(current.levelsCompleted, index + 1);
  }
  assert.deepEqual([directions, pulls, pistons], [484, 154, 10]);
  assert.equal(ss03Witnesses[6]!.actions.length, 54);
  assert.equal(combinedPush, true);
  assert.equal(cascade, true);
  assert.equal(current.state, 'WIN');
});

test('SS03 can finish at level 1 after solving the other seven and supports navigation and Undo', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new PullPuzzleSession(SS03_LEVELS);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS03', level: 8 }), reference.selectLevel(8));
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'SS03', level: 9 })), /Invalid level/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'undo' })), /Load a game/);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS03' });
  assert.deepEqual(current, reference.restart());
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 5 })), /ACTION1–ACTION4/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'nextMerchant' })), /only supports/);
  for (const level of [2, 3, 4, 5, 6, 7, 8, 1]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
    for (const actionId of ss03Witnesses[level - 1]!.actions) {
      const expected = reference.action(actionId);
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, expected);
    }
    assert.equal(current.level, 1);
  }
  assert.equal(current.state, 'WIN');
  assert.equal(current.levelsCompleted, 8);
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(await dispatcher.dispatch({ type: 'restart' }), reference.restart());
});

test('SS03 preserves GAME_OVER, blocks directional changes and recovers via Undo and Reset', async () => {
  const backend = createSs03Backend([{
    id: 'test-crush', title: 'Crush fixture',
    rows: ['#########', '#...#...#', '#..T....#', '#......g#', '#########'],
    circuits: [{ id: 'a', buttons: [{ x: 3, y: 2 }] }],
    gates: [{ at: { x: 4, y: 2 }, direction: 'N', circuit: 'a', closedWhen: 'released' }],
  }]);
  const initial = await backend.dispatch({ type: 'load', code: 'SS03' });
  const dead = await backend.dispatch({ type: 'action', actionId: 4 });
  assert.equal(dead.state, 'GAME_OVER');
  assert.equal(dead.canUndo, true);
  assert.deepEqual((await backend.dispatch({ type: 'action', actionId: 1 })).frame, dead.frame);
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), initial);
  assert.equal((await backend.dispatch({ type: 'action', actionId: 4 })).state, 'GAME_OVER');
  assert.deepEqual(await backend.dispatch({ type: 'reset' }), initial);
});

test('SS04 matches all eight witnesses through the native dispatcher with public observations only', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WizardPuzzleSession(SS04_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss04 ' });
  assert.deepEqual(current, reference.observe());
  const publicKeys = ['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort();
  assert.deepEqual(Object.keys(current).sort(), publicKeys);
  const directions = ['N', 'S', 'W', 'E'] as const;
  let actions = 0, swaps = 0, reflected = 0, monsters = 0, pistons = 0, platforms = 0;
  for (const [index, witness] of ss04Witnesses.entries()) {
    const level = SS04_LEVELS[index]!;
    assert.equal(witness.id, level.id);
    assert.equal(current.level, index + 1);
    const world = compileWizardLevel(level);
    let state = initialWizardState(world);
    for (const [turn, actionId] of witness.actions.entries()) {
      const plan = planSwap(world, state, directions[actionId - 1]!);
      const detail = stepWizard(world, state, actionId);
      assert.equal(Boolean(detail.state.dead || detail.state.failed), false);
      const exchange = detail.phases.some(phase => phase.kind === 'swap');
      if (exchange) {
        swaps++;
        if (plan && plan.reflections > 0) reflected++;
        if (plan?.target === 'monster') monsters++;
      }
      pistons += detail.phases.filter(phase => phase.kind === 'piston').length;
      platforms += detail.state.supports.length - state.supports.length;
      state = detail.state;
      actions++;

      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
      assert.deepEqual(current.frames.at(-1), current.frame);
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4]);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frame.length, 64);
      assert.ok(current.frame.every(row => row.length === 64 && !row.includes(1)));
      if (index === 7 && turn === 10) assert.deepEqual(current.frameDurationsMs, [40, 60, 80, 40, 60, 80, 0]);
    }
    assert.equal(current.levelsCompleted, index + 1);
  }
  assert.deepEqual([actions, swaps, reflected, monsters, pistons, platforms], [398, 55, 5, 8, 5, 4]);
  assert.equal(current.state, 'WIN');
});

test('SS04 handles direct navigation, invalid loads, Undo across a transition and an out-of-order victory', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WizardPuzzleSession(SS04_LEVELS);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS04', level: 8 }), reference.selectLevel(8));
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'SS-04' })), /Invalid game code/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 1 })), /Load a game/);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS04', level: 8 }), reference.selectLevel(8));
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'SS04', level: 9 })), /Invalid level/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 1 })), /Load a game/);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS04' });
  assert.deepEqual(current, reference.restart());
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 5 })), /ACTION1–ACTION4/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'nextMerchant' })), /only supports/);
  for (const level of [2, 3, 4, 5, 6, 7, 8, 1]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
    const actions = ss04Witnesses[level - 1]!.actions;
    for (const actionId of actions) {
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
    }
    assert.equal(current.level, 1);
    if (level === 2) {
      const undone = await dispatcher.dispatch({ type: 'undo' });
      assert.deepEqual(undone, reference.undo());
      assert.equal(undone.level, 2);
      assert.equal(undone.levelsCompleted, 0);
      assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: actions.at(-1)! }), reference.action(actions.at(-1)!));
    }
  }
  assert.equal(current.state, 'WIN');
  assert.equal(current.levelsCompleted, 8);
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 1 }), reference.observe());
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(await dispatcher.dispatch({ type: 'restart' }), reference.restart());
});

test('SS04 preserves a reachable monster defeat, blocks directions, and recovers through Undo and Reset', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const initial = await dispatcher.dispatch({ type: 'load', code: 'SS04', level: 4 });
  const before = await dispatcher.dispatch({ type: 'action', actionId: 2 });
  const dead = await dispatcher.dispatch({ type: 'action', actionId: 4 });
  assert.equal(dead.state, 'GAME_OVER');
  assert.ok(dead.frames.length > 1);
  assert.equal(dead.canUndo, true);
  assert.deepEqual((await dispatcher.dispatch({ type: 'action', actionId: 1 })).frame, dead.frame);
  const undone = await dispatcher.dispatch({ type: 'undo' });
  assert.equal(undone.state, 'NOT_FINISHED');
  assert.deepEqual(undone.frame, before.frame);
  assert.equal((await dispatcher.dispatch({ type: 'action', actionId: 4 })).state, 'GAME_OVER');
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), initial);
});

test('SS05 matches the 395 actions and 1222 frames of the lab witnesses through the native dispatcher', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new BardPuzzleSession(SS05_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss05 ' });
  assert.deepEqual(current, reference.observe());
  const publicKeys = ['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort();
  assert.deepEqual(Object.keys(current).sort(), publicKeys);
  const combatDurations = [60, 80, 40, 80, 90, 100, 110, 0];
  let actions = 0, frames = 0, mutualCombat = false, mobilePlatform = false;
  for (const [index, witness] of ss05Witnesses.entries()) {
    assert.equal(current.level, index + 1);
    const world = compileBardLevel(SS05_LEVELS[index]!);
    let state = initialBardState(world);
    for (const [turn, actionId] of witness.actions.entries()) {
      const detail = stepBard(world, state, actionId);
      state = detail.state;
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4, 5]);
      assert.deepEqual(current.frames.at(-1), current.frame);
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frame.length, 64);
      assert.ok(current.frame.every(row => row.length === 64));
      if (index === 2 && detail.phases.some(phase => phase.kind === 'combat' && phase.before.monsters.length - phase.after.monsters.length >= 2)) {
        assert.deepEqual(current.frameDurationsMs, combatDurations);
        mutualCombat = true;
      }
      if (index === 6 && detail.phases.some(phase => phase.kind === 'song' && phase.moves.some(motion => motion.actor === 'support'))) mobilePlatform = true;
      if (index === 7 && turn === 19) assert.equal(current.frames.length, 9);
      assert.equal(Boolean(state.failed || state.dead), false);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, index + 1);
  }
  assert.deepEqual([actions, frames, mutualCombat, mobilePlatform], [395, 1222, true, true]);
  assert.equal(current.state, 'WIN');
});

test('SS05 validates direct loads and selections before replacing the current session', async () => {
  const backend = createSs05Backend();
  const reference = new BardPuzzleSession(SS05_LEVELS);
  assert.deepEqual(await backend.dispatch({ type: 'load', code: 'SS05', level: 8 }), reference.selectLevel(8));
  assert.throws(() => backend.dispatch({ type: 'load', code: 'SS05', level: 9 }), /Invalid level/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), reference.observe());
  assert.throws(() => backend.dispatch({ type: 'nextMerchant' }), /Merchant selection/);
  assert.deepEqual(await backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS05 supports out-of-order victory and ignores directions and reflection after WIN', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new BardPuzzleSession(SS05_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS05' });
  for (const level of [2, 3, 4, 5, 6, 7, 8, 1]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
    for (const actionId of ss05Witnesses[level - 1]!.actions) {
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
    }
    assert.equal(current.level, 1);
  }
  assert.equal(current.state, 'WIN');
  for (const actionId of [1, 5]) assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId }), reference.observe());
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await dispatcher.dispatch({ type: 'restart' }), reference.restart());
});

for (const [level, route] of [[3, 'UURRRRRDDDRRRUUUUUU'], [6, 'RRRX']] as const) {
  test(`SS05 level ${level} preserves GAME_OVER and restores the board through Undo and Reset`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new BardPuzzleSession(SS05_LEVELS);
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS05', level });
    assert.deepEqual(initial, reference.selectLevel(level));
    const actions = [...route].map(key => ({ U:1, D:2, L:3, R:4, X:5 })[key as 'U' | 'D' | 'L' | 'R' | 'X']);
    let current = initial;
    for (const actionId of actions) {
      current = await dispatcher.dispatch({ type: 'action', actionId });
      assert.deepEqual(current, reference.action(actionId));
    }
    assert.equal(current.state, 'GAME_OVER');
    if (level === 3) assert.deepEqual(current.frameDurationsMs, [60, 80, 40, 80, 90, 100, 110, 0]);
    for (const actionId of [1, 5]) assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId }), reference.observe());
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
    assert.equal((await dispatcher.dispatch({ type: 'action', actionId: actions.at(-1)! })).state, 'GAME_OVER');
    assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), initial);
  });
}

type DuoAction = { id: number; data?: { x: number; y: number } };

test('SS06 preserves public observations, timing and all eight tutorial discoveries through the native dispatcher', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new DuoPuzzleSession(SS06_LEVELS);
  const lessons = new Set<DuoLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss06 ' });
  assert.deepEqual(current, reference.observe());
  const publicKeys = Object.keys(current).sort();
  assert.deepEqual(publicKeys, ['gameCode', 'frame', 'frames', 'state', 'availableActionIds', 'canUndo', 'canSelectLevel',
    'level', 'levelCount', 'levelsCompleted', 'defaultFps', 'palette'].sort());
  let actions = 0, selections = 0, frames = 0;
  for (const [index, witness] of ss06Witnesses.entries()) {
    assert.equal(current.level, index + 1);
    assert.equal(visibleHeroes(current.frame).length, index === 7 ? 1 : 2);
    const world = compileDuoLevel(SS06_LEVELS[index]!);
    let state = initialDuoState(world);
    const green: boolean[] = [], violet: boolean[] = [];
    for (const { id, data } of witness.actions as DuoAction[]) {
      const before = current;
      const detail = stepDuo(world, state, id, data);
      current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
      assert.deepEqual(current, reference.action(id, data));
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4, 5, 6]);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.deepEqual(current.frames.at(-1), current.frame);
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.ok(current.frames.every(frame => frame.length === 64 && frame.every(row => row.length === 64)));
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        assert.equal(detail.phases.length, 0);
        assert.deepEqual(detail.state.heroes, state.heroes);
        assert.deepEqual(detail.state.monsters, state.monsters);
        selections++;
      }
      state = detail.state;
      if (index === 7 && id === 5) {
        green.push(circuitPressed(world, state, 'ancrage'));
        violet.push(circuitPressed(world, state, 'alternance'));
        assert.ok(state.platformActive?.slice(0, 4).every(Boolean));
      }
      observeDuoLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, index + 1);
    if (index === 7) {
      assert.equal(SS06_LEVELS[index]!.mode, 'solo-warrior');
      assert.deepEqual([world.heroes.length, world.goals.length, world.mirrors.length, world.gates.length, world.platforms.length], [1, 1, 3, 0, 7]);
      assert.equal(witness.actions.length, 61);
      assert.ok(witness.actions.every(action => action.id !== 6));
      assert.deepEqual(green, [true, true, true]);
      assert.deepEqual(violet, [true, false, true]);
    }
  }
  assert.deepEqual([actions, selections, frames], [433, 17, 1338]);
  assert.deepEqual(duoLessonIds.filter(lesson => lessons.has(lesson)), [...duoLessonIds]);
  assert.equal(current.state, 'WIN');
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), reference.observe());
});

test('SS06 validates loads and ACTION6 coordinates and preserves same-hero selection as a no-op', async () => {
  const backend = createSs06Backend();
  const reference = new DuoPuzzleSession(SS06_LEVELS);
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 5 }), /not loaded/);
  assert.deepEqual(await backend.dispatch({ type: 'load', code: 'SS06', level: 8 }), reference.selectLevel(8));
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS06', level }), /Invalid level/);
    assert.throws(() => backend.dispatch({ type: 'selectLevel', level }), /Invalid level/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS06 action/);
  for (const data of [undefined, { x: -1, y: 0 }, { x: 0, y: 64 }, { x: 0.5, y: 1 }, { x: 3, y: NaN }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 6, data: { x: 0, y: 63 } }), reference.observe());
  const [warrior] = visibleHeroes(reference.observe().frame);
  assert.ok(warrior?.selected);
  const data = { x: 3 + 3 * warrior.x, y: 3 + 3 * warrior.y };
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 6, data }), reference.observe());
  assert.equal((await backend.dispatch({ type: 'action', actionId: 6, data })).canUndo, false);
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 1 }), reference.action(1));
  const [moved] = visibleHeroes(reference.observe().frame);
  assert.ok(moved?.selected);
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 6, data: { x: 3 + 3 * moved.x, y: 3 + 3 * moved.y } }), reference.observe());
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await backend.dispatch({ type: 'restart' }), reference.restart());

  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  await dispatcher.dispatch({ type: 'load', code: 'SS06' });
  await assert.rejects(async () => dispatcher.dispatch({ type: 'load', code: 'SS06', level: 9 }), /Invalid level/);
  await assert.rejects(async () => dispatcher.dispatch({ type: 'action', actionId: 5 }), /Load a game/);
});

test('SS06 supports out-of-order progress and can undo the duo to solo transition', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new DuoPuzzleSession(SS06_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS06' });
  for (const level of [2, 3, 4, 5, 6, 1, 7, 8]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
    const actions = ss06Witnesses[level - 1]!.actions as DuoAction[];
    for (const [index, { id, data }] of actions.entries()) {
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, reference.action(id, data));
      if (level === 7 && index === actions.length - 1) {
        assert.equal(current.level, 8);
        assert.equal(visibleHeroes(current.frame).length, 1);
        const restored = await dispatcher.dispatch({ type: 'undo' });
        assert.deepEqual(restored, reference.undo());
        assert.equal(restored.level, 7);
        assert.equal(restored.levelsCompleted, 6);
        assert.equal(visibleHeroes(restored.frame).length, 2);
        current = await dispatcher.dispatch(request);
        assert.deepEqual(current, reference.action(id, data));
      }
    }
    if (level >= 2 && level <= 6) assert.equal(current.level, 1);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), reference.reset());
});

for (const { level, cause, actions } of ss06Failures) {
  test(`SS06 level ${level} restores the board with Undo after ${cause}`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new DuoPuzzleSession(SS06_LEVELS);
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS06', level });
    assert.deepEqual(initial, reference.selectLevel(level));
    let current = initial, previous = initial;
    for (const { id, data } of actions as DuoAction[]) {
      previous = current;
      current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
      assert.deepEqual(current, reference.action(id, data));
    }
    assert.equal(current.state, 'GAME_OVER');
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 1 }), reference.observe());
    const restored = await dispatcher.dispatch({ type: 'undo' });
    assert.deepEqual(restored, reference.undo());
    assert.deepEqual(restored.frame, previous.frame);
    assert.equal(restored.state, 'NOT_FINISHED');
    assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), initial);
  });
}

test('SS07 replays 593 actions through the adapter and the router with all nine tutorial discoveries', async () => {
  const backend = createSs07Backend();
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new ThiefDuoSession(SS07_LEVELS);
  const load = { type: 'load', code: 'SS07' } as const;
  const lessons = new Set<ThiefLesson>();
  let current = await dispatcher.dispatch(load);
  assert.deepEqual(current, await backend.dispatch(load));
  assert.deepEqual(current, reference.observe());
  const publicKeys = ['gameCode', 'frame', 'frames', 'state', 'availableActionIds', 'canUndo',
    'canSelectLevel', 'level', 'levelCount', 'levelsCompleted', 'defaultFps', 'palette'].sort();
  assert.deepEqual(Object.keys(current).sort(), publicKeys);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss07Witnesses) {
    assert.equal(current.level, level);
    const world = compileThiefLevel(SS07_LEVELS[level - 1]!);
    assert.deepEqual(visibleThiefHeroes(current.frame).map(h => h.kind).sort(), ['merchant', 'thief']);
    assert.equal(world.goals.length, 2);
    let state = initialThiefState(world);
    let openedGreenGate = false, builtPermanentBridge = false, raisedBridge = false, combat = false;
    if (level === 6) assert.deepEqual(state.gateClosed, [true]);
    if (level === 8) {
      assert.equal(state.supports.length, 2);
      assert.deepEqual(state.platformActive, [false, false, false]);
    }
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const request = { type: 'action', actionId: id, data } as const;
      const expected = reference.action(id, data);
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(await backend.dispatch(request), expected);
      assert.deepEqual(current.availableActionIds, [1, 2, 3, 4, 5, 6]);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.deepEqual(current.frames.at(-1), current.frame);
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.ok(current.frames.every(frame => frame.length === 64 && frame.every(row => row.length === 64)));
      const detail = stepThief(world, state, id, data);
      const phases = detail.phases.map(phase => phase.kind);
      if (id === 6) {
        assert.deepEqual(detail.state.heroes, state.heroes);
        assert.deepEqual(detail.state.monsters, state.monsters);
        assert.equal(detail.phases.length, 0);
        assert.equal(current.frames.length, 1);
        selections++;
      }
      if (id === 5) assert.ok(!phases.includes('pull'));
      if (level === 6 && state.gateClosed?.[0] && !detail.state.gateClosed?.[0]) {
        assert.deepEqual(phases, ['reflect', 'gate']);
        assert.deepEqual(detail.state.monsters, world.circuits.find(c => c.id === 'sentinelle')?.buttons);
        openedGreenGate = true;
      }
      if (level === 7 && phases.includes('combat')) {
        assert.deepEqual(current.frameDurationsMs, [60, 80, 40, 60, 80, 40, 80, 90, 100, 110, 0]);
        combat = true;
      }
      if (level === 8 && phases.includes('platform')) {
        if (detail.state.platformActive?.every(Boolean)) raisedBridge = true;
        else {
          assert.ok(raisedBridge);
          assert.deepEqual(detail.state.platformActive, [false, false, false]);
          assert.equal(detail.state.supports.length - state.supports.length, 3);
          assert.equal(detail.state.supports.length, 5);
          for (const { at } of world.platforms) assert.ok(detail.state.supports.some(p => p.x === at.x && p.y === at.y));
          builtPermanentBridge = true;
        }
      }
      state = detail.state;
      observeThiefLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    if (level === 6) assert.ok(openedGreenGate);
    if (level === 7) assert.ok(combat);
    if (level === 8) assert.ok(builtPermanentBridge);
  }
  assert.deepEqual([actions, selections, frames], [593, 39, 1745]);
  assert.deepEqual(thiefLessonIds.filter(lesson => lessons.has(lesson)), [...thiefLessonIds]);
  assert.equal(current.state, 'WIN');
  for (const id of [1, 5, 6]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: id, data: { x: 3, y: 3 } }), reference.observe());
  }
});

test('SS07 level 7 reflects only the near crate when the Merchant stands farther from the mirror', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  await dispatcher.dispatch({ type: 'load', code: 'SS07', level: 7 });
  for (const { id, data } of ss07Witnesses[6]!.actions.slice(0, 42) as DuoAction[]) {
    await dispatcher.dispatch({ type: 'action', actionId: id, data });
  }
  const at = (frame: number[][], x: number, y: number) => frame[3 + y * 3]![3 + x * 3]!;
  const equal = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  assert.equal(at(equal.frames[2]!, 12, 2), 12, 'The Merchant exchanges with the crate at equal distances');
  await dispatcher.dispatch({ type: 'undo' });
  const before = await dispatcher.dispatch({ type: 'action', actionId: 4 });
  assert.equal(at(before.frame, 16, 5), 12);
  const unequal = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  const transferred = unequal.frames[2]!;
  assert.equal(at(transferred, 16, 5), 12, 'The farther Merchant stays on the other axis');
  assert.equal(at(transferred, 15, 5), 5, 'The closer crate arrives');
  assert.equal(transferred[3 + 5 * 3]![2 + 15 * 3], 13, 'The destination contains the crate sprite');
});

test('SS07 validates ACTION6 and bad loads and keeps progress across out-of-order rooms', async () => {
  const backend = createSs07Backend();
  const reference = new ThiefDuoSession(SS07_LEVELS);
  assert.deepEqual(await backend.dispatch({ type: 'load', code: 'SS07', level: 8 }), reference.selectLevel(8));
  for (const level of [0, 9, 1.5]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS07', level }), /Invalid level/);
    assert.throws(() => backend.dispatch({ type: 'selectLevel', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: -1, y: 3 }, { x: 3, y: 64 }, { x: 1.5, y: 3 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  const merchant = visibleThiefHeroes(reference.observe().frame).find(h => h.kind === 'merchant')!;
  const data = { x: 3 + merchant.x * 3, y: 3 + merchant.y * 3 };
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 6, data }), reference.observe());
  assert.equal(reference.observe().canUndo, false);
  for (const { id, data } of ss07Witnesses[7]!.actions as DuoAction[]) {
    assert.deepEqual(await backend.dispatch({ type: 'action', actionId: id, data }), reference.action(id, data));
  }
  assert.equal(reference.observe().levelsCompleted, 1);
  assert.equal(reference.observe().level, 1);
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), reference.undo());
  assert.equal(reference.observe().level, 8);
  assert.equal(reference.observe().levelsCompleted, 0);
  assert.deepEqual(await backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(await backend.dispatch({ type: 'restart' }), reference.restart());
});

for (const { level, actions } of ss07Failures) {
  test(`SS07 level ${level} presents the reachable defeat and restores the entire action with Undo`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new ThiefDuoSession(SS07_LEVELS);
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS07', level });
    assert.deepEqual(initial, reference.selectLevel(level));
    let current = initial, previous = initial;
    for (const { id, data } of actions as DuoAction[]) {
      previous = current;
      current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
      assert.deepEqual(current, reference.action(id, data));
    }
    assert.equal(current.state, 'GAME_OVER');
    assert.ok(current.frames.length >= 3);
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), reference.observe());
    const restored = await dispatcher.dispatch({ type: 'undo' });
    assert.deepEqual(restored, reference.undo());
    assert.deepEqual(restored.frame, previous.frame);
    assert.equal(restored.state, 'NOT_FINISHED');
    assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), initial);
  });
}
