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
import { createSs08Backend } from '../src/games/sinking-star-ss08.ts';
import { DuoPuzzleSession as WizardDuoSession } from '../experiments/sinking-star-ss08/src/core.ts';
import { SS08_LEVELS } from '../experiments/sinking-star-ss08/src/levels.ts';
import { lessonIds as transpositionLessonIds, observeLesson as observeTranspositionLesson, visibleHeroes as visibleTranspositionHeroes, type TranspositionLesson } from '../experiments/sinking-star-ss08/src/tutorial.ts';
import ss08Witnesses from '../experiments/sinking-star-ss08/tests/witnesses.json' with { type: 'json' };
import ss08Failures from '../experiments/sinking-star-ss08/tests/failures.json' with { type: 'json' };
import { createSs09Backend } from '../src/games/sinking-star-ss09.ts';
import { DuoPuzzleSession as ChorusDuoSession } from '../experiments/sinking-star-ss09/src/core.ts';
import { SS09_LEVELS } from '../experiments/sinking-star-ss09/src/levels.ts';
import { heroSelection as chorusHeroSelection, lessonIds as chorusLessonIds, observeLesson as observeChorusLesson, visibleHeroes as visibleChorusHeroes, type ChorusLesson } from '../experiments/sinking-star-ss09/src/tutorial.ts';
import ss09Witnesses from '../experiments/sinking-star-ss09/tests/witnesses.json' with { type: 'json' };
import ss09Failures from '../experiments/sinking-star-ss09/tests/failures.json' with { type: 'json' };
import { createSs10Backend } from '../src/games/sinking-star-ss10.ts';
import { DuoPuzzleSession as WarehouseDuoSession, compileLevel as compileWarehouseLevel } from '../experiments/sinking-star-ss10/src/core.ts';
import { SS10_LEVELS } from '../experiments/sinking-star-ss10/src/levels.ts';
import { heroSelection as warehouseHeroSelection, lessonIds as warehouseLessonIds, observeLesson as observeWarehouseLesson, visibleHeroes as visibleWarehouseHeroes, type WarehouseLesson } from '../experiments/sinking-star-ss10/src/tutorial.ts';
import ss10Witnesses from '../experiments/sinking-star-ss10/tests/witnesses.json' with { type: 'json' };
import ss10Failures from '../experiments/sinking-star-ss10/tests/failures.json' with { type: 'json' };
import { createSs11Backend } from '../src/games/sinking-star-ss11.ts';
import { DuoPuzzleSession as ForgeDuoSession } from '../experiments/sinking-star-ss11/src/core.ts';
import { SS11_LEVELS } from '../experiments/sinking-star-ss11/src/levels.ts';
import { heroSelection as forgeHeroSelection, lessonIds as forgeLessonIds, observeLesson as observeForgeLesson, TUTORIAL_LEVEL as SS11_TUTORIAL_LEVEL, visibleHeroes as visibleForgeHeroes, type TranspositionLesson as ForgeLesson } from '../experiments/sinking-star-ss11/src/tutorial.ts';
import ss11Witnesses from '../experiments/sinking-star-ss11/tests/witnesses.json' with { type: 'json' };
import { createSs12Backend } from '../src/games/sinking-star-ss12.ts';
import { DuoPuzzleSession as ColumnDuoSession } from '../experiments/sinking-star-ss12/src/core.ts';
import { SS12_LEVELS } from '../experiments/sinking-star-ss12/src/levels.ts';
import { heroSelection as columnHeroSelection, lessonIds as columnLessonIds, observeLesson as observeColumnLesson, TUTORIAL_LEVEL as SS12_TUTORIAL_LEVEL, visibleHeroes as visibleColumnHeroes, type ChorusLesson as ColumnLesson } from '../experiments/sinking-star-ss12/src/tutorial.ts';
import ss12Witnesses from '../experiments/sinking-star-ss12/tests/witnesses.json' with { type: 'json' };
import { createSs13Backend } from '../src/games/sinking-star-ss13.ts';
import { DuoPuzzleSession as AnchorDuoSession } from '../experiments/sinking-star-ss13/src/core.ts';
import { SS13_LEVELS } from '../experiments/sinking-star-ss13/src/levels.ts';
import { heroSelection as anchorHeroSelection, lessonIds as anchorLessonIds, observeLesson as observeAnchorLesson, TUTORIAL_LEVEL as SS13_TUTORIAL_LEVEL, visibleHeroes as visibleAnchorHeroes, type TranspositionLesson as AnchorLesson } from '../experiments/sinking-star-ss13/src/tutorial.ts';
import ss13Witnesses from '../experiments/sinking-star-ss13/tests/witnesses.json' with { type: 'json' };
import { createSs14Backend } from '../src/games/sinking-star-ss14.ts';
import { DuoPuzzleSession as HarmonyDuoSession } from '../experiments/sinking-star-ss14/src/core.ts';
import { SS14_LEVELS } from '../experiments/sinking-star-ss14/src/levels.ts';
import { heroSelection as harmonyHeroSelection, lessonIds as harmonyLessonIds, observeLesson as observeHarmonyLesson, TUTORIAL_LEVEL as SS14_TUTORIAL_LEVEL, visibleHeroes as visibleHarmonyHeroes, type HarmonyLesson } from '../experiments/sinking-star-ss14/src/tutorial.ts';
import ss14Witnesses from '../experiments/sinking-star-ss14/tests/witnesses.json' with { type: 'json' };
import { createSs15Backend } from '../src/games/sinking-star-ss15.ts';
import { DuoPuzzleSession as AccordDuoSession, compileLevel as compileAccordLevel } from '../experiments/sinking-star-ss15/src/core.ts';
import { SS15_LEVELS } from '../experiments/sinking-star-ss15/src/levels.ts';
import { heroSelection as accordHeroSelection, lessonIds as accordLessonIds, observeLesson as observeAccordLesson, TUTORIAL_LEVEL as SS15_TUTORIAL_LEVEL, visibleHeroes as visibleAccordHeroes, type HarmonyLesson as AccordLesson } from '../experiments/sinking-star-ss15/src/tutorial.ts';
import ss15Witnesses from '../experiments/sinking-star-ss15/tests/witnesses.json' with { type: 'json' };
import { createSs16Backend } from '../src/games/sinking-star-ss16.ts';
import { TrioPuzzleSession, compileLevel as compileBridgesLevel } from '../experiments/sinking-star-ss16/src/core.ts';
import { SS16_LEVELS } from '../experiments/sinking-star-ss16/src/levels.ts';
import { heroSelection as bridgesHeroSelection, lessonIds as bridgesLessonIds, observeLesson as observeBridgesLesson, TUTORIAL_LEVEL as SS16_TUTORIAL_LEVEL, visibleHeroes as visibleBridgesHeroes, type BridgesLesson } from '../experiments/sinking-star-ss16/src/tutorial.ts';
import ss16Witnesses from '../experiments/sinking-star-ss16/tests/witnesses.json' with { type: 'json' };

import { createSs17Backend } from '../src/games/sinking-star-ss17.ts';
import { TrioPuzzleSession as FortressSession, compileLevel as compileFortressLevel } from '../experiments/sinking-star-ss17/src/core.ts';
import { SS17_LEVELS } from '../experiments/sinking-star-ss17/src/levels.ts';
import { heroSelection as fortressHeroSelection, lessonIds as fortressLessonIds, observeLesson as observeFortressLesson, TUTORIAL_LEVEL as SS17_TUTORIAL_LEVEL, visibleHeroes as visibleFortressHeroes, type FortressLesson } from '../experiments/sinking-star-ss17/src/tutorial.ts';
import ss17Witnesses from '../experiments/sinking-star-ss17/tests/witnesses.json' with { type: 'json' };

import { createSs18Backend } from '../src/games/sinking-star-ss18.ts';
import { TrioPuzzleSession as GallerySession, compileLevel as compileGalleryLevel } from '../experiments/sinking-star-ss18/src/core.ts';
import { SS18_LEVELS } from '../experiments/sinking-star-ss18/src/levels.ts';
import { heroSelection as galleryHeroSelection, lessonIds as galleryLessonIds, observeLesson as observeGalleryLesson, TUTORIAL_LEVEL as SS18_TUTORIAL_LEVEL, visibleHeroes as visibleGalleryHeroes, type GalleryLesson } from '../experiments/sinking-star-ss18/src/tutorial.ts';
import ss18Witnesses from '../experiments/sinking-star-ss18/tests/witnesses.json' with { type: 'json' };

import { createSs19Backend } from '../src/games/sinking-star-ss19.ts';
import { TrioPuzzleSession as GuardiansSession, compileLevel as compileGuardiansLevel } from '../experiments/sinking-star-ss19/src/core.ts';
import { SS19_LEVELS } from '../experiments/sinking-star-ss19/src/levels.ts';
import { heroSelection as guardiansHeroSelection, lessonIds as guardiansLessonIds, observeLesson as observeGuardiansLesson, TUTORIAL_LEVEL as SS19_TUTORIAL_LEVEL, visibleHeroes as visibleGuardiansHeroes, type GalleryLesson as GuardiansLesson } from '../experiments/sinking-star-ss19/src/tutorial.ts';
import ss19Witnesses from '../experiments/sinking-star-ss19/tests/witnesses.json' with { type: 'json' };
import ss19MiddleReview from '../experiments/sinking-star-ss19/reference/ss19-middle-review.json' with { type: 'json' };
import ss19FinalReview from '../experiments/sinking-star-ss19/reference/final-ss19-review.json' with { type: 'json' };
import ss19IndependentReview from '../experiments/sinking-star-ss19/reference/independent-review-ss19.json' with { type: 'json' };

import galleryFinalReview from '../experiments/sinking-star-ss18/reference/final-levels-independent-review.json' with { type: 'json' };

import fortressLevel1Variant from '../experiments/sinking-star-ss17/reference/level1-alternative.json' with { type: 'json' };
import fortressLevel5Chain from '../experiments/sinking-star-ss17/reference/level5-chain-alternative.json' with { type: 'json' };
import fortressLevel5Ferry from '../experiments/sinking-star-ss17/reference/level5-ferry-alternative.json' with { type: 'json' };
import fortressLevel6Review from '../experiments/sinking-star-ss17/reference/level6-independent-review.json' with { type: 'json' };
import fortressLevel7Variant from '../experiments/sinking-star-ss17/reference/level7-two-roles-alternative.json' with { type: 'json' };
import fortressLevel8Shortcut from '../experiments/sinking-star-ss17/reference/level8-rejected-shortcut.json' with { type: 'json' };
import { routes } from './ss01-routes.ts';

test('Custom 4 lists SS01 through SS19 and preserves all four legacy collections', async () => {
  const { GAME_CATALOG, getGameByCode } = await import('../src/games/catalog.ts');
  assert.equal(GAME_CATALOG.length, 119);
  assert.equal(new Set(GAME_CATALOG.map(g => g.id)).size, GAME_CATALOG.length);
  assert.deepEqual(GAME_CATALOG.filter(g => g.group === 'custom_4').map(g => g.code), ['SS01','SS02','SS03','SS04','SS05','SS06','SS07','SS08','SS09','SS10','SS11','SS12','SS13','SS14','SS15','SS16','SS17','SS18','SS19']);
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
  const ss08 = getGameByCode(' ss08 ');
  assert.equal(ss08?.id, 'ss08-c4000001');
  assert.equal(ss08?.name, 'La Double Transposition');
  assert.equal(ss08?.levels, 8);
  assert.equal(ss08?.availability, 'playable');
  assert.match(ss08!.sourceUrl, /experiments\/sinking-star-ss08\/src\/levels\.ts$/);
  const ss09 = getGameByCode(' ss09 ');
  assert.equal(ss09?.id, 'ss09-c4000001');
  assert.equal(ss09?.name, 'Le Chœur des Miroirs');
  assert.equal(ss09?.family, 'sinking_star_duo');
  assert.equal(ss09?.levels, 8);
  assert.equal(ss09?.availability, 'playable');
  assert.match(ss09!.sourceUrl, /experiments\/sinking-star-ss09\/src\/levels\.ts$/);
  const ss10 = getGameByCode(' ss10 ');
  assert.equal(ss10?.id, 'ss10-c4000001');
  assert.equal(ss10?.name, 'L’Entrepôt Réversible');
  assert.equal(ss10?.family, 'sinking_star_duo');
  assert.equal(ss10?.levels, 8);
  assert.equal(ss10?.availability, 'playable');
  assert.match(ss10!.sourceUrl, /experiments\/sinking-star-ss10\/src\/levels\.ts$/);
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
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS08' })).gameCode, 'SS08');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS09' })).gameCode, 'SS09');
  assert.equal((await dispatcher.dispatch({ type: 'load', code: 'SS10' })).gameCode, 'SS10');
  assert.equal(loads, 0);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'load', code: 'CASC' })), /offline/);
  await assert.rejects(() => Promise.resolve(dispatcher.dispatch({ type: 'action', actionId: 1 })), /Load a game/);
  for (const code of ['CASC', 'SS19', 'SS18', 'SS17', 'SS16', 'SS15', 'SS14', 'SS13', 'SS12', 'SS11', 'SS10', 'SS09', 'SS08', 'SS07', 'SS06', 'SS05', 'SS04', 'SS03', 'SS02', 'SS01', 'LS20', 'SS10']) {
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

test('SS08 replays 324 actions through the adapter and router with all ten level 4 discoveries', async () => {
  const backend = createSs08Backend();
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WizardDuoSession(SS08_LEVELS);
  const lessons = new Set<TranspositionLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss08 ' });
  assert.deepEqual(current, await backend.dispatch({ type: 'load', code: 'SS08' }));
  assert.deepEqual(current, reference.observe());
  const publicKeys = ['gameCode', 'frame', 'frames', 'state', 'availableActionIds', 'canUndo', 'canSelectLevel',
    'level', 'levelCount', 'levelsCompleted', 'defaultFps', 'palette'].sort();
  assert.deepEqual(Object.keys(current).sort(), publicKeys);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss08Witnesses) {
    assert.equal(current.level, level);
    assert.deepEqual(visibleTranspositionHeroes(current.frame).map(h => h.kind).sort(), ['merchant', 'wizard']);
    for (const [turn, { id, data }] of (route as DuoAction[]).entries()) {
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
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleTranspositionHeroes(frame).map(({ x, y, kind }) => ({ x, y, kind }));
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      if (level === 5 && [15, 22, 37].includes(turn + 1)) {
        const [x, y] = [2 + 3 * 8, 2 + 3 * 10];
        const tile = current.frame.slice(y, y + 3).map(row => row.slice(x, x + 3));
        assert.deepEqual(tile, [[0, 5, 5], [7, 0, 5], [7, 7, 0]], 'The mirror diagonal and back cover the button');
      }
      observeTranspositionLesson(lessons, before, current, id);
      if (level < 4) assert.equal(lessons.size, 0);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    if (level === 4) assert.deepEqual(transpositionLessonIds.filter(lesson => lessons.has(lesson)), [...transpositionLessonIds]);
  }
  assert.deepEqual([actions, selections, frames], [324, 29, 970]);
  assert.equal(current.state, 'WIN');
  for (const actionId of [1, 5, 6]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId, data: { x: 3, y: 3 } }), reference.observe());
  }
});

test('SS08 plays the returning Wizard loop in both directions and repeats without adding Undo entries', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WizardDuoSession(SS08_LEVELS);
  const north = [[4, 6], [8, 4], [13, 8], [8, 12], [4, 10]];
  for (const [actionId, probes] of [[1, north], [2, [...north].reverse()]] as const) {
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS08', level: 8 });
    assert.deepEqual(initial, reference.selectLevel(8));
    const wizard = visibleTranspositionHeroes(initial.frame).find(hero => hero.kind === 'wizard')!;
    const data = { x: 3 + 3 * wizard.x, y: 3 + 3 * wizard.y };
    const selected = await dispatcher.dispatch({ type: 'action', actionId: 6, data });
    assert.deepEqual(selected, reference.action(6, data));
    const first = await dispatcher.dispatch({ type: 'action', actionId });
    assert.deepEqual(first, reference.action(actionId));
    assert.deepEqual(first.frameDurationsMs, [90, 90, 90, 90, 100, 100, 80, 100, 0]);
    assert.equal(first.frameDurationsMs!.reduce((sum, duration) => sum + duration), 740);
    assert.equal(first.frames.length, 9);
    assert.deepEqual(visibleTranspositionHeroes(first.frame), visibleTranspositionHeroes(selected.frame));
    assert.equal(first.state, 'NOT_FINISHED');
    assert.equal(first.levelsCompleted, 0);
    for (const [y, row] of first.frame.entries()) {
      for (const [x, pixel] of row.entries()) {
        if (Math.abs(x - data.x) > 1 || Math.abs(y - data.y) > 1) assert.equal(pixel, selected.frame[y]![x]);
      }
    }
    for (let frame = 0; frame < probes.length; frame++) {
      for (const [index, [x, y]] of probes.entries()) {
        const [px, py] = [3 + x! * 3, 3 + y! * 3];
        assert.equal(first.frames[frame]![py]![px], index <= frame ? 15 : first.frame[py]![px]);
      }
    }
    for (const frame of [5, 7]) {
      for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        assert.equal(first.frames[frame]![data.y + dy!]![data.x + dx!], 0);
      }
    }
    for (let repeat = 0; repeat < 2; repeat++) {
      assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId }), first);
    }
    const undone = await dispatcher.dispatch({ type: 'undo' });
    assert.deepEqual(undone, reference.undo());
    assert.deepEqual(undone.frame, selected.frame);
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), initial);
  }
});

test('SS08 refuses unsupported water immediately without marking it and validates ACTION6 and level loads', async () => {
  const backend = createSs08Backend();
  const reference = new WizardDuoSession(SS08_LEVELS);
  assert.deepEqual(await backend.dispatch({ type: 'load', code: 'SS08', level: 8 }), reference.selectLevel(8));
  assert.throws(() => backend.dispatch({ type: 'load', code: 'SS08', level: 9 }), /Invalid level/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  for (const data of [undefined, { x: -1, y: 3 }, { x: 3, y: 64 }, { x: 1.5, y: 3 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  for (const { id, data } of ss08Witnesses[7]!.actions.slice(0, 19) as DuoAction[]) {
    assert.deepEqual(await backend.dispatch({ type: 'action', actionId: id, data }), reference.action(id, data));
  }
  const before = reference.observe();
  const water = (frame: number[][]) => frame.slice(14, 17).map(row => row.slice(23, 26));
  for (let repeat = 0; repeat < 2; repeat++) {
    const next = await backend.dispatch({ type: 'action', actionId: 1 });
    assert.deepEqual(next, reference.action(1));
    assert.equal(next.frames.length, 1);
    assert.ok(next.frameDurationsMs === undefined || next.frameDurationsMs[0] === 0);
    assert.deepEqual(water(next.frame), water(before.frame));
    assert.deepEqual(visibleTranspositionHeroes(next.frame), visibleTranspositionHeroes(before.frame));
    assert.equal(next.state, 'NOT_FINISHED');
  }
  const undone = await backend.dispatch({ type: 'undo' });
  assert.deepEqual(undone, reference.undo());
  assert.deepEqual(undone.frame, before.frame);
  assert.deepEqual(await backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(await backend.dispatch({ type: 'restart' }), reference.restart());
});

for (const { level, actions } of ss08Failures) {
  test(`SS08 level ${level} presents its reachable defeat and restores the board with Undo`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new WizardDuoSession(SS08_LEVELS);
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS08', level });
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

test('SS09 replays the eight unmodified witnesses through adapter and router and satisfies all twelve lessons', async () => {
  const backend = createSs09Backend();
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new ChorusDuoSession(SS09_LEVELS);
  const learned = new Set<ChorusLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss09 ' });
  assert.deepEqual(current, await backend.dispatch({ type: 'load', code: 'SS09' }));
  assert.deepEqual(current, reference.observe());
  const publicKeys = ['gameCode', 'frame', 'frames', 'state', 'availableActionIds', 'canUndo',
    'canSelectLevel', 'level', 'levelCount', 'levelsCompleted', 'defaultFps', 'palette'].sort();
  assert.deepEqual(Object.keys(current).sort(), publicKeys);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss09Witnesses) {
    assert.equal(current.level, level);
    assert.deepEqual(visibleChorusHeroes(current.frame).map(h => h.kind).sort(), ['bard', 'merchant']);
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
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleChorusHeroes(frame).map(({ x, y, kind }) => ({ x, y, kind }));
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      observeChorusLesson(learned, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    if (level === 1) assert.deepEqual(chorusLessonIds.filter(lesson => learned.has(lesson)), [...chorusLessonIds]);
  }
  assert.deepEqual([actions, selections, frames], [443, 33, 1312]);
  assert.equal(current.state, 'WIN');
  for (const actionId of [1, 5, 6]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId, data: { x: 3, y: 3 } }), reference.observe());
  }
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
});

test('SS09 validates loads and ACTION6 and can replay a coordinate-bearing selection', async () => {
  const backend = createSs09Backend();
  const reference = new ChorusDuoSession(SS09_LEVELS);
  const initial = await backend.dispatch({ type: 'load', code: 'SS09', level: 8 });
  assert.deepEqual(initial, reference.selectLevel(8));
  for (const level of [0, 9, 1.5]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS09', level }), /Invalid level/);
    assert.throws(() => backend.dispatch({ type: 'selectLevel', level }), /Invalid level/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS09 action/);
  assert.throws(() => backend.dispatch({ type: 'nextMerchant' }), /ACTION6/);
  for (const data of [undefined, { x: -1, y: 3 }, { x: 3, y: 64 }, { x: 1.5, y: 3 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  const data = chorusHeroSelection(initial.frame, 'bard');
  assert.ok(data);
  const selection = { type: 'action', actionId: 6, data } as const;
  const selected = await backend.dispatch(selection);
  assert.deepEqual(selected, reference.action(6, data));
  assert.deepEqual(await backend.dispatch({ type: 'action', actionId: 6, data }), reference.observe());
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), initial);
  assert.deepEqual(await backend.dispatch(selection), selected);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  await dispatcher.dispatch({ type: 'load', code: 'SS09' });
  await assert.rejects(async () => dispatcher.dispatch({ type: 'load', code: 'SS09', level: 9 }), /Invalid level/);
  await assert.rejects(async () => dispatcher.dispatch({ type: 'action', actionId: 5 }), /Load a game/);
});

test('SS09 level 5 replays the four red-white frames of one blocked mirror and leaves Undo unchanged', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new ChorusDuoSession(SS09_LEVELS);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS09', level: 5 }), reference.selectLevel(5));
  for (const { id, data } of ss09Witnesses[4]!.actions.slice(0, 42) as DuoAction[]) {
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: id, data }), reference.action(id, data));
  }
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 2 }), reference.action(2));
  const before = reference.observe();
  const warning = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  assert.deepEqual(warning, reference.action(5));
  assert.deepEqual(warning.frame, before.frame);
  assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
  assert.equal(warning.frames.length, 4);
  assert.deepEqual(warning.frames[0], warning.frames[2]);
  assert.deepEqual(warning.frames[1], before.frame);
  assert.deepEqual(warning.frames[3], before.frame);
  const tiles = new Set<string>();
  for (let y=0; y<64; y++) for (let x=0; x<64; x++) {
    if (warning.frames[0]![y]![x] === before.frame[y]![x]) continue;
    assert.deepEqual([before.frame[y]![x], warning.frames[0]![y]![x]], [0,8]);
    tiles.add(`${Math.floor((x-2)/3)},${Math.floor((y-2)/3)}`);
  }
  assert.equal(tiles.size, 1);
  for (let n=0; n<2; n++) assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), warning);
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), reference.reset());
});

test('SS09 chooses the first unfinished level, restores a transition, and restarts at level 1', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new ChorusDuoSession(SS09_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS09', level: 8 });
  assert.deepEqual(current, reference.selectLevel(8));
  for (const { id, data } of ss09Witnesses[7]!.actions as DuoAction[]) {
    current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
    assert.deepEqual(current, reference.action(id, data));
  }
  assert.deepEqual([current.level, current.levelsCompleted], [1, 1]);
  const restored = await dispatcher.dispatch({ type: 'undo' });
  assert.deepEqual(restored, reference.undo());
  assert.deepEqual([restored.level, restored.levelsCompleted], [8, 0]);
  assert.deepEqual(await dispatcher.dispatch({ type: 'restart' }), reference.restart());
});

for (const [index, { level, actions }] of ss09Failures.entries()) {
  test(`SS09 defeat ${index + 1} at level ${level} ends after the last frame and Undo restores the state`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new ChorusDuoSession(SS09_LEVELS);
    const initial = await dispatcher.dispatch({ type: 'load', code: 'SS09', level });
    assert.deepEqual(initial, reference.selectLevel(level));
    let previous = initial, current = initial;
    for (const { id, data } of actions as DuoAction[]) {
      previous = current;
      current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
      assert.deepEqual(current, reference.action(id, data));
    }
    assert.equal(current.state, 'GAME_OVER');
    assert.ok(current.frames.length >= 3);
    assert.deepEqual(current.frames.at(-1), current.frame);
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), reference.observe());
    const restored = await dispatcher.dispatch({ type: 'undo' });
    assert.deepEqual(restored, reference.undo());
    assert.deepEqual(restored.frame, previous.frame);
    assert.equal(restored.state, 'NOT_FINISHED');
    assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), initial);
  });
}

test('SS10 matches the laboratory in all eight rooms and records twelve tutorial discoveries', async () => {
  const backend = createSs10Backend();
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WarehouseDuoSession(SS10_LEVELS);
  const lessons = new Set<WarehouseLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss10 ' });
  assert.deepEqual(current, await backend.dispatch({ type: 'load', code: 'SS10' }));
  assert.deepEqual(current, reference.observe());
  const publicKeys = Object.keys(current);
  const pressWorld = compileWarehouseLevel(SS10_LEVELS[6]!);
  assert.deepEqual(Object.fromEntries(pressWorld.circuits.map(({ id, color }) => [id, color])), { presse: 0, pont: 14, sortie: 15 });
  const button = pressWorld.circuits.find(circuit => circuit.id === 'presse')!.buttons[0]!;
  const gate = pressWorld.gates.find(item => item.circuit === 'presse')!.at;
  const tile = (frame: number[][], at: { x: number; y: number }) =>
    frame.slice(2 + 3 * at.y, 5 + 3 * at.y).map(row => row.slice(2 + 3 * at.x, 5 + 3 * at.x));
  let actions = 0, selections = 0, frames = 0;
  let whiteButton = false, whiteGate = false;
  for (const { level, actions: route } of ss10Witnesses) {
    assert.equal(current.level, level);
    assert.deepEqual(visibleWarehouseHeroes(current.frame).map(hero => hero.kind).sort(), ['thief', 'warrior']);
    assert.equal(visibleWarehouseHeroes(current.frame).find(hero => hero.selected)?.kind, 'warrior');
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
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleWarehouseHeroes(frame).map(({ x, y, kind }) => ({ x, y, kind }));
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      if (level === 7) {
        for (const frame of current.frames) {
          const b = tile(frame, button), g = tile(frame, gate);
          whiteButton ||= b[1]![1] === 0 && [b[0]![1], b[1]![0], b[1]![2], b[2]![1]].every(value => value === 7);
          whiteGate ||= [g[0]![0], g[0]![2], g[2]![0], g[2]![2]].every(value => value === 7)
            && [g[0]![1], g[1]![0], g[1]![2], g[2]![1]].filter(value => value === 0).length === 3;
        }
      }
      observeWarehouseLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    if (level === 1) assert.deepEqual(warehouseLessonIds.filter(lesson => lessons.has(lesson)), [...warehouseLessonIds]);
  }
  assert.ok(whiteButton && whiteGate);
  assert.equal(SS10_LEVELS[5]!.title, 'Le dernier changement de sens');
  assert.deepEqual([actions, selections, frames], [627, 58, 1807]);
  assert.equal(current.state, 'WIN');
  const finaleSpec = SS10_LEVELS[7]!;
  assert.deepEqual([finaleSpec.rows[0]!.length, finaleSpec.rows.length], [13, 9]);
  const finale = compileWarehouseLevel(finaleSpec);
  assert.equal(finale.stones.length, 5);
  const ox = Math.floor((20 - finaleSpec.rows[0]!.length) / 2), oy = Math.floor((20 - finaleSpec.rows.length) / 2);
  const supports = [[2, 4], [3, 3], [3, 6], [6, 7], [2, 7]].map(([x, y]) => ({ x: x! + ox, y: y! + oy }));
  for (const at of supports) {
    assert.equal(finale.terrain[at.y * 20 + at.x], '~');
    assert.deepEqual(tile(current.frame, at), [[10, 13, 10], [13, 10, 13], [10, 13, 10]]);
  }
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), reference.observe());
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
});

test('SS10 level 5 flashes only the backing of two blocking mirrors and replays the warning without new Undo', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const reference = new WarehouseDuoSession(SS10_LEVELS);
  let current = await dispatcher.dispatch({ type: 'load', code: 'SS10', level: 5 });
  assert.deepEqual(current, reference.selectLevel(5));
  for (const command of 'LLUULCD') {
    const actionId = { L: 3, U: 1, D: 2, C: 6 }[command]!;
    const data = actionId === 6 ? warehouseHeroSelection(current.frame) : undefined;
    current = await dispatcher.dispatch({ type: 'action', actionId, data });
    assert.deepEqual(current, reference.action(actionId, data));
  }
  const before = reference.observe();
  const warning = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  assert.deepEqual(warning, reference.action(5));
  assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
  assert.equal(warning.frames.length, 4);
  assert.deepEqual(warning.frames[0], warning.frames[2]);
  assert.deepEqual(warning.frames[1], before.frame);
  assert.deepEqual(warning.frame, before.frame);
  const tiles = new Set<number>();
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (warning.frames[0]![y]![x] === before.frame[y]![x]) continue;
    assert.deepEqual([before.frame[y]![x], warning.frames[0]![y]![x]], [5, 8]);
    tiles.add(Math.floor((y - 2) / 3) * 20 + Math.floor((x - 2) / 3));
  }
  assert.equal(tiles.size, 2);
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), warning);
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), reference.reset());
});

test('SS10 validates ACTION6, preserves the adapter on bad loads and restores out-of-order completion', async () => {
  const backend = createSs10Backend();
  const reference = new WarehouseDuoSession(SS10_LEVELS);
  const initial = await backend.dispatch({ type: 'load', code: 'SS10', level: 8 });
  assert.deepEqual(initial, reference.selectLevel(8));
  for (const level of [0, 9, 1.5]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS10', level }), /Invalid level/);
    assert.throws(() => backend.dispatch({ type: 'selectLevel', level }), /Invalid level/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS10 action/);
  assert.throws(() => backend.dispatch({ type: 'nextMerchant' }), /ACTION6/);
  for (const data of [undefined, { x: -1, y: 3 }, { x: 3, y: 64 }, { x: 1.5, y: 3 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  const data = warehouseHeroSelection(initial.frame, 'thief');
  assert.ok(data);
  const selectThief = { type: 'action', actionId: 6, data } as const;
  const selected = await backend.dispatch(selectThief);
  assert.deepEqual(selected, reference.action(6, data));
  assert.deepEqual(await backend.dispatch(selectThief), reference.observe());
  assert.deepEqual(await backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(await backend.dispatch(selectThief), selected);
  assert.deepEqual(await backend.dispatch({ type: 'reset' }), reference.reset());
  for (const { id, data } of ss10Witnesses[7]!.actions as DuoAction[]) {
    assert.deepEqual(await backend.dispatch({ type: 'action', actionId: id, data }), reference.action(id, data));
  }
  assert.deepEqual([reference.observe().level, reference.observe().levelsCompleted], [1, 1]);
  const undone = await backend.dispatch({ type: 'undo' });
  assert.deepEqual(undone, reference.undo());
  assert.deepEqual([undone.level, undone.levelsCompleted], [8, 0]);
  assert.deepEqual(await backend.dispatch({ type: 'restart' }), reference.restart());
});

for (const { level, actions } of ss10Failures) {
  test(`SS10 level ${level} retains its reachable defeat and Undo returns to the last safe state`, async () => {
    const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
    const reference = new WarehouseDuoSession(SS10_LEVELS);
    let current = await dispatcher.dispatch({ type: 'load', code: 'SS10', level });
    let previous = current;
    assert.deepEqual(current, reference.selectLevel(level));
    for (const { id, data } of actions as DuoAction[]) {
      previous = current;
      current = await dispatcher.dispatch({ type: 'action', actionId: id, data });
      assert.deepEqual(current, reference.action(id, data));
    }
    assert.equal(current.state, 'GAME_OVER');
    assert.ok(current.frames.length > 1);
    assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), reference.observe());
    const restored = await dispatcher.dispatch({ type: 'undo' });
    assert.deepEqual(restored, reference.undo());
    assert.deepEqual(restored.frame, previous.frame);
    assert.equal(restored.state, 'NOT_FINISHED');
  });
}


test('SS11 preserves eight ordered levels, public observations, animations and twelve tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss11 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss11-c4000001', 'La Forge des Reflets', 'custom_4', 'sinking_star_duo', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss11/src/levels.ts');
  assert.deepEqual(SS11_LEVELS.map(level => level.title), [
    'La relève du gardien', 'Le damier des cargaisons', 'Le poids du danger', 'La passerelle à contre-sens',
    'L’écluse des remplaçants', 'Le cristal derrière deux rives', 'La cour aux deux sorties', 'Les cinq îles — le vrai transfert',
  ]);
  assert.equal(SS11_TUTORIAL_LEVEL, 7);

  const backend = createSs11Backend(), reference = new ForgeDuoSession(SS11_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<ForgeLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss11 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS11' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss11Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleForgeHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'warrior', selected: true }, { kind: 'wizard', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleForgeHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      observeForgeLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    if (level < 7) assert.equal(lessons.size, 0);
    else assert.deepEqual(forgeLessonIds.filter(id => lessons.has(id)), [...forgeLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [464, 45, 1338]);
});

test('SS11 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs11Backend(), reference = new ForgeDuoSession(SS11_LEVELS);
  const initial = reference.selectLevel(7);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS11', level: 7 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS11', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS11 action/);
  const data = forgeHeroSelection(initial.frame, 'wizard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS12 preserves eight ordered levels, public observations, animations and thirteen tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss12 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss12-c4000001', 'La Colonne en Marche', 'custom_4', 'sinking_star_duo', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss12/src/levels.ts');
  assert.deepEqual(SS12_LEVELS.map(level => level.title), [
    'La répétition des deux rives', 'Les deux rails et le convoi', 'Le quai ramené d’en bas', 'Les trois poids sous garde',
    'Le poids reste, le chant s’en va', 'Les deux écluses de pierre', 'Le canal aux quatre coudes', 'La coda des deux reflets',
  ]);
  assert.equal(SS12_TUTORIAL_LEVEL, 1);
  assert.deepEqual(SS12_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss12-0${i + 1}`));

  const backend = createSs12Backend(), reference = new ColumnDuoSession(SS12_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<ColumnLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss12 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS12' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss12Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleColumnHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'warrior', selected: true }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleColumnHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      observeColumnLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    assert.deepEqual(columnLessonIds.filter(id => lessons.has(id)), [...columnLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [526, 38, 1548]);
});

test('SS12 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs12Backend(), reference = new ColumnDuoSession(SS12_LEVELS);
  const initial = reference.selectLevel(6);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS12', level: 6 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS12', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS12 action/);
  const data = columnHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS13 preserves eight ordered levels, public observations, animations and fourteen tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss13 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss13-c4000001', 'L’Ancre Verte', 'custom_4', 'sinking_star_duo', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss13/src/levels.ts');
  assert.deepEqual(SS13_LEVELS.map(level => level.title), [
    'L’atelier de l’ancre verte', 'Une place de plus sur l’autre rive', 'La cellule et les trois relèves', 'Le miroir reste à quai',
    'Le gardien devenu poids', 'La presse délivre le tireur', 'L’amarre et les trois diagonales', 'Les deux retours de l’ancre',
  ]);
  assert.equal(SS13_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss13Witnesses.slice(6).map(({ actions }) => actions.length), [231, 212]);
  assert.deepEqual(SS13_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss13-0${i + 1}`));

  const backend = createSs13Backend(), reference = new AnchorDuoSession(SS13_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<AnchorLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss13 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS13' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss13Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleAnchorHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'thief', selected: true }, { kind: 'wizard', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleAnchorHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      observeAnchorLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    assert.deepEqual(anchorLessonIds.filter(id => lessons.has(id)), [...anchorLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [781, 49, 2411]);
});

test('SS13 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs13Backend(), reference = new AnchorDuoSession(SS13_LEVELS);
  const initial = reference.selectLevel(6);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS13', level: 6 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS13', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS13 action/);
  const data = anchorHeroSelection(initial.frame, 'wizard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS14 preserves eight ordered levels, public observations, animations and seventeen tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss14 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss14-c4000001', 'La Traction Harmonique', 'custom_4', 'sinking_star_duo', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss14/src/levels.ts');
  assert.deepEqual(SS14_LEVELS.map(level => level.title), [
    'L’atelier des deux voix', 'La relève silencieuse', 'L’appui sous le partenaire', 'Les deux départs sans geste',
    'Les gardiens et le poids retiré', 'Le passage des deux presses', 'La pierre des trois traversées', 'Le dernier accord des deux rives',
  ]);
  assert.equal(SS14_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss14Witnesses.map(({ actions }) => actions.length), [80, 72, 93, 85, 107, 107, 195, 289]);
  assert.deepEqual(SS14_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss14-0${i + 1}`));

  const backend = createSs14Backend(), reference = new HarmonyDuoSession(SS14_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<HarmonyLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss14 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS14' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss14Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleHarmonyHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'thief', selected: true }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleHarmonyHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      observeHarmonyLesson(lessons, before, current, id);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    assert.deepEqual(harmonyLessonIds.filter(id => lessons.has(id)), [...harmonyLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [1028, 63, 3039]);
});

test('SS14 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs14Backend(), reference = new HarmonyDuoSession(SS14_LEVELS);
  const initial = reference.selectLevel(6);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS14', level: 6 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS14', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS14 action/);
  const data = harmonyHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS14 preserves the distinct quay button and both press states in level 6 and the exposed level 8 button', async () => {
  const runtime = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const tile = (observation: { level: number; frame: number[][] }, x: number, y: number) => {
    const rows = SS14_LEVELS[observation.level - 1]!.rows;
    const px = 2 + 3 * (x + Math.floor((20 - rows[0]!.length) / 2));
    const py = 2 + 3 * (y + Math.floor((20 - rows.length) / 2));
    return observation.frame.slice(py, py + 3).map(row => row.slice(px, px + 3));
  };
  const finale = await runtime.dispatch({ type: 'load', code: 'SS14', level: 8 });
  assert.deepEqual(tile(finale, 11, 14), [[3, 7, 3], [7, 15, 7], [3, 7, 3]]);
  const quay = await runtime.dispatch({ type: 'selectLevel', level: 6 });
  assert.deepEqual(tile(quay, 8, 3), [[3, 7, 3], [7, 9, 7], [3, 7, 3]]);
  for (const [turn, { id, data }] of (ss14Witnesses[5]!.actions as DuoAction[]).slice(0, 49).entries()) {
    const next = await runtime.dispatch({ type: 'action', actionId: id, data });
    if (turn === 46) assert.deepEqual(tile(next, 13, 8), [[7, 7, 7], [15, 5, 15], [7, 15, 7]]);
    if (turn === 48) assert.deepEqual(tile(next, 13, 8), [[7, 3, 7], [15, 3, 15], [7, 15, 7]]);
  }
});

test('SS15 preserves eight ordered levels, public observations, animations and twenty tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss15 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss15-c4000001', 'Les Accords Transposés', 'custom_4', 'sinking_star_duo', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss15/src/levels.ts');
  assert.deepEqual(SS15_LEVELS.map(level => level.title), [
    'L’appui des deux traversées', 'Le départ qui garde le poids', 'Le remplaçant derrière le reflet', 'L’atelier des passages croisés',
    'Les gardiens qu’il faut garder', 'La visée et le dernier appui', 'Le relais des trois rives', 'Le compte des deux rives',
  ]);
  assert.equal(SS15_TUTORIAL_LEVEL, 4);
  assert.deepEqual(ss15Witnesses.map(({ actions }) => actions.length), [56, 49, 56, 142, 39, 47, 162, 181]);
  assert.deepEqual(SS15_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss15-0${i + 1}`));

  const backend = createSs15Backend(), reference = new AccordDuoSession(SS15_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<AccordLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss15 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS15' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss15Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleAccordHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'wizard', selected: true }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleAccordHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeAccordLesson(lessons, before, current, id);
      if (level !== SS15_TUTORIAL_LEVEL) assert.equal(lessons.size, priorDiscoveries);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    if (level < SS15_TUTORIAL_LEVEL) assert.equal(lessons.size, 0);
    else assert.deepEqual(accordLessonIds.filter(id => lessons.has(id)), [...accordLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [732, 56, 2153]);
});

test('SS15 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs15Backend(), reference = new AccordDuoSession(SS15_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS15', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS15', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS15 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS15', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS15 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  const data = accordHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS15 keeps each press distinct from buttons and the workshop final circuit uses three posts', async () => {
  for (const spec of SS15_LEVELS) {
    const world = compileAccordLevel(spec);
    const buttons = [...world.buttons, ...world.circuits.flatMap(circuit => circuit.buttons)];
    assert.ok(world.gates.every(({ at }) => !buttons.some(button => button.x === at.x && button.y === at.y)));
  }
  const workshop = compileAccordLevel(SS15_LEVELS[3]!);
  assert.deepEqual(workshop.circuits.find(circuit => circuit.id === 'trois-postes')?.buttons,
    [{ x: 2, y: 5 }, { x: 16, y: 4 }, { x: 14, y: 5 }]);
  const backend = createSs15Backend();
  const initial = await backend.dispatch({ type: 'load', code: 'SS15', level: 4 });
  const tile = (frame: number[][], x: number, y: number) =>
    frame.slice(2 + 3 * y, 5 + 3 * y).map(row => row.slice(2 + 3 * x, 5 + 3 * x));
  assert.deepEqual(tile(initial.frame, 12, 9), [[3, 7, 3], [7, 15, 7], [3, 7, 3]]);
  for (const [turn, { id, data }] of (ss15Witnesses[3]!.actions as DuoAction[]).slice(0, 51).entries()) {
    const observed = await backend.dispatch({ type: 'action', actionId: id, data });
    if (turn === 49 || turn === 50) {
      const press = tile(observed.frame, 14, 4);
      assert.equal(press[1]![1], turn === 49 ? 5 : 3);
      assert.ok(!press.flat().includes(9));
    }
  }
});

test('SS16 preserves all three heroes across eight levels, animations and twenty tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss16 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss16-c4000001', 'Les Ponts Engloutis', 'custom_4', 'sinking_star_trio', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss16/src/levels.ts');
  assert.deepEqual(SS16_LEVELS.map(level => level.title), [
    'L’atelier des trois passeurs', 'Récupérer avant de combler', 'Lâcher le miroir, garder son poids', 'Le quai des deux impulsions',
    'La relève du gardien', 'Le chantier avant la marée basse', 'Les deux postes du miroir', 'Le gardien et les trois lests',
  ]);
  assert.equal(SS16_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss16Witnesses.map(({ actions }) => actions.length), [158, 214, 160, 64, 265, 82, 120, 180]);
  assert.deepEqual(SS16_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss16-0${i + 1}`));

  const backend = createSs16Backend(), reference = new TrioPuzzleSession(SS16_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<BridgesLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss16 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS16' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss16Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleBridgesHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'merchant', selected: true }, { kind: 'thief', selected: false }, { kind: 'warrior', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleBridgesHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeBridgesLesson(lessons, before, current, id);
      if (level !== SS16_TUTORIAL_LEVEL) assert.equal(lessons.size, priorDiscoveries);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    assert.deepEqual(bridgesLessonIds.filter(id => lessons.has(id)), [...bridgesLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [1243, 126, 3655]);
});

test('SS16 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs16Backend(), reference = new TrioPuzzleSession(SS16_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS16', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS16', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS16 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS16', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS16 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  const data = bridgesHeroSelection(initial.frame, 'thief')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});

test('SS16 level 8 flashes only the refused mirror and leaves the undo history and world unchanged', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const initial = await dispatcher.dispatch({ type: 'load', code: 'SS16', level: 8 });
  const warning = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
  assert.deepEqual(warning.frame, initial.frame);
  assert.equal(warning.canUndo, false);
  const tile = (frame: number[][], x: number, y: number) =>
    frame.slice(2 + 3 * y, 5 + 3 * y).map(row => row.slice(2 + 3 * x, 5 + 3 * x));
  const mirrors = compileBridgesLevel(SS16_LEVELS[7]!).mirrors;
  for (const [index, { at: { x, y } }] of mirrors.entries()) {
    const normal = tile(initial.frame, x, y);
    const red = normal.map(row => row.map(color => color === 5 ? 8 : color));
    assert.deepEqual(warning.frames.map(frame => tile(frame, x, y)), index === 0
      ? [red, normal, red, normal] : [normal, normal, normal, normal]);
  }
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), warning);
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), initial);
});

test('SS16 keeps the reinforced level 5, three goals and manual out-of-order progress', async () => {
  for (const spec of SS16_LEVELS) {
    const world = compileBridgesLevel(spec);
    assert.equal(world.goals.length, 3);
    const buttons = [...world.buttons, ...world.circuits.flatMap(circuit => circuit.buttons)];
    assert.ok(world.gates.every(({ at }) => !buttons.some(button => button.x === at.x && button.y === at.y)));
  }
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new TrioPuzzleSession(SS16_LEVELS);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS16', level: 5 }), ref.selectLevel(5));
  const route = ss16Witnesses[4]!.actions as DuoAction[];
  assert.equal(route.length, 265);
  for (const { id, data } of route) {
    const result = await dispatcher.dispatch({ type: 'action', actionId: id, data });
    assert.deepEqual(result, ref.action(id, data));
  }
  assert.equal(ref.observe().level, 1);
  assert.equal(ref.observe().levelsCompleted, 1);
  assert.deepEqual(await dispatcher.dispatch({ type: 'selectLevel', level: 8 }), ref.selectLevel(8));
  assert.deepEqual(await dispatcher.dispatch({ type: 'reset' }), ref.reset());
  assert.equal(ref.observe().levelsCompleted, 1);
  assert.deepEqual(await dispatcher.dispatch({ type: 'restart' }), ref.restart());
  assert.equal(ref.observe().level, 1);
  assert.equal(ref.observe().levelsCompleted, 0);
});

test('SS17 preserves all three heroes across eight levels, animations and twenty-three tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss17 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss17-c4000001', 'La Forteresse Rose', 'custom_4', 'sinking_star_trio', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss17/src/levels.ts');
  assert.deepEqual(SS17_LEVELS.map(level => level.title), [
    'Les trois cours de la forteresse', 'Les cellules de relève', 'Le compte des îles', 'Le miroir, puis le lest',
    'La relève à angle droit', 'Les deux emplois des miroirs', 'Les trois vies de la clef', 'La forteresse aux deux visées',
  ]);
  assert.equal(SS17_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss17Witnesses.map(({ actions }) => actions.length), [120, 115, 129, 76, 241, 170, 410, 205]);
  assert.deepEqual(SS17_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss17-0${i + 1}`));

  const backend = createSs17Backend(), reference = new FortressSession(SS17_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<FortressLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss17 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS17' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss17Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleFortressHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'thief', selected: false }, { kind: 'warrior', selected: true }, { kind: 'wizard', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleFortressHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeFortressLesson(lessons, before, current, id);
      if (level !== SS17_TUTORIAL_LEVEL) assert.equal(lessons.size, priorDiscoveries);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    assert.deepEqual(fortressLessonIds.filter(id => lessons.has(id)), [...fortressLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [1466, 152, 4179]);
});

test('SS17 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs17Backend(), reference = new FortressSession(SS17_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS17', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS17', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS17 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS17', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS17 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = fortressHeroSelection(initial.frame, 'thief')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
});


test('SS17 preserves the reachable two-mirror warning without an Undo entry', async () => {
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new FortressSession(SS17_LEVELS);
  assert.deepEqual(await dispatcher.dispatch({ type: 'load', code: 'SS17', level: 8 }), ref.selectLevel(8));
  let beforeWarning = ref.observe();
  for (const { id, data } of ss17Witnesses[7]!.actions.slice(0, 5) as DuoAction[]) {
    beforeWarning = await dispatcher.dispatch({ type: 'action', actionId: id, data });
    assert.deepEqual(beforeWarning, ref.action(id, data));
  }
  const warning = await dispatcher.dispatch({ type: 'action', actionId: 5 });
  assert.deepEqual(warning, ref.action(5));
  assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
  assert.deepEqual(warning.frames, [warning.frames[0], beforeWarning.frame, warning.frames[0], beforeWarning.frame]);
  const normal = beforeWarning.frame.flat();
  const red = warning.frames[0]!.flat();
  const changed = normal.flatMap((color, i) => color === red[i] ? [] : [[color, red[i]]]);
  assert.deepEqual(changed, Array.from({ length: 6 }, () => [5, 8]));
  assert.deepEqual(await dispatcher.dispatch({ type: 'action', actionId: 5 }), warning);
  assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), ref.undo());
});

test('SS17 keeps the physical locks, rejects the two shortcuts and accepts five archived variants', async () => {
  for (const spec of SS17_LEVELS) {
    const world = compileFortressLevel(spec);
    assert.equal(world.goals.length, 3);
    assert.ok(world.gates.every(({ at }) => !world.buttons.some(button => button.x === at.x && button.y === at.y)));
  }
  assert.ok(SS17_LEVELS[5]!.gates?.some(gate => gate.at.x === 18 && gate.at.y === 14 &&
    gate.circuit === 'retenue' && gate.closedWhen === 'pressed' && gate.direction === 'S'));
  assert.ok(SS17_LEVELS[7]!.gates?.some(gate => gate.at.x === 14 && gate.at.y === 18 &&
    gate.circuit === 'prison-clef' && gate.closedWhen === 'pressed' && gate.direction === 'N'));
  const cyan = SS17_LEVELS[7]!.circuits?.find(circuit => circuit.id === 'prison-clef');
  assert.deepEqual(cyan?.buttons, [{ x: 17, y: 15 }]);
  assert.equal(cyan?.color, 10);

  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new FortressSession(SS17_LEVELS);
  const directions = { U: 1, D: 2, L: 3, R: 4, X: 5 } as const;
  const roles = ['warrior', 'thief', 'wizard'] as const;
  const routes = [
    { level: 1, commands: fortressLevel1Variant.commands, length: 130, completed: true },
    { level: 5, commands: fortressLevel5Chain.commands, length: 215, completed: true },
    { level: 5, commands: fortressLevel5Ferry.commands, length: 257, completed: true },
    { level: 6, commands: fortressLevel6Review.historical.counterexample.commands, length: 170, completed: false },
    { level: 6, commands: fortressLevel6Review.advancedAlternative.commands, length: 214, completed: true },
    { level: 7, commands: fortressLevel7Variant.commands, length: 366, completed: true },
    { level: 8, commands: fortressLevel8Shortcut.historical.commands, length: 156, completed: false },
    { level: 8, commands: 'CDDDDRCX', length: 8, completed: false, dead: true },
  ];
  for (const { level, commands, length, completed, dead } of routes) {
    assert.equal(commands.length, length);
    ref.restart();
    let result = await dispatcher.dispatch({ type: 'load', code: 'SS17', level });
    assert.deepEqual(result, ref.selectLevel(level));
    for (const command of commands) {
      const actionId = command === 'C' ? 6 : directions[command as keyof typeof directions];
      assert.ok(actionId);
      const selected = visibleFortressHeroes(result.frame).find(hero => hero.selected)?.kind;
      const nextRole = roles[(roles.findIndex(role => role === selected) + 1) % roles.length]!;
      const data = actionId === 6 ? fortressHeroSelection(result.frame, nextRole) ?? undefined : undefined;
      result = await dispatcher.dispatch({ type: 'action', actionId, data });
      assert.deepEqual(result, ref.action(actionId, data));
    }
    assert.equal(result.levelsCompleted, Number(completed));
    assert.equal(result.level, completed ? (level === 1 ? 2 : 1) : level);
    assert.equal(result.state, dead ? 'GAME_OVER' : 'NOT_FINISHED');
    if (dead) assert.equal((await dispatcher.dispatch({ type: 'undo' })).state, 'NOT_FINISHED');
  }
});

test('SS18 preserves all three heroes across eight levels, animations and twenty-seven tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss18 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss18-c4000001', 'La Galerie Résonante', 'custom_4', 'sinking_star_trio', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss18/src/levels.ts');
  assert.deepEqual(SS18_LEVELS.map(level => level.title), [
    'Les trois pièces du chœur', 'Le carrefour à contretemps', 'Le jardin des trois issues', 'Personne ne part le premier',
    'Les gardiens de l’arène', 'Le miroir en tournée', 'La navette des alcôves', 'La cour au cœur du lac',
  ]);
  assert.equal(SS18_TUTORIAL_LEVEL, 3);
  assert.deepEqual(ss18Witnesses.map(({ actions }) => actions.length), [66, 87, 111, 86, 93, 58, 54, 184]);
  assert.deepEqual(SS18_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss18-0${i + 1}`));

  const backend = createSs18Backend(), reference = new GallerySession(SS18_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<GalleryLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss18 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS18' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss18Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleGalleryHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'merchant', selected: true }, { kind: 'wizard', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleGalleryHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeGalleryLesson(lessons, before, current, id);
      if (level !== SS18_TUTORIAL_LEVEL) assert.equal(lessons.size, priorDiscoveries);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    if (level >= SS18_TUTORIAL_LEVEL) assert.deepEqual(galleryLessonIds.filter(id => lessons.has(id)), [...galleryLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [739, 89, 2096]);
});

test('SS18 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs18Backend(), reference = new GallerySession(SS18_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS18', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS18', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS18 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS18', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS18 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = galleryHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});



test('SS18 retains warning pixels, repeat timing, Undo and defeat across the native dispatcher', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new GallerySession(SS18_LEVELS);
  for (const [level, prefix] of [[8, 38], [2, 20]] as const) {
    assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS18', level }), ref.selectLevel(level));
    let previous = ref.observe();
    for (const { id, data } of ss18Witnesses[level - 1]!.actions.slice(0, prefix) as DuoAction[]) {
      previous = ref.observe();
      assert.deepEqual(await routed.dispatch({ type: 'action', actionId: id, data }), ref.action(id, data));
    }
    const before = ref.observe();
    const result = await routed.dispatch({ type: 'action', actionId: 5 });
    assert.deepEqual(result, ref.action(5));
    if (level === 8) {
      assert.deepEqual(result.frameDurationsMs, [110, 70, 110, 0]);
      const red = result.frames[0]!.flat();
      assert.deepEqual(before.frame.flat().flatMap((color, i) => color === red[i] ? [] : [[color, red[i]]]), [[5, 8], [5, 8], [5, 8]]);
      assert.deepEqual(result.frames, [result.frames[0], before.frame, result.frames[0], before.frame]);
      assert.deepEqual(await routed.dispatch({ type: 'action', actionId: 5 }), result);
      assert.deepEqual(await routed.dispatch({ type: 'undo' }), previous);
    } else {
      assert.equal(result.state, 'GAME_OVER');
      assert.deepEqual(await routed.dispatch({ type: 'undo' }), before);
    }
  }
});

test('SS18 retains the four-weight material lock and the archived alternatives and counterexamples', async () => {
  const spec = SS18_LEVELS[7]!;
  const world = compileGalleryLevel(spec);
  assert.equal(world.goals.length, 3);
  assert.equal(world.stones.length, 3);
  assert.equal(world.mirrors.length, 1);
  assert.equal(world.monsters.length, 0);
  assert.equal(spec.rows[13]![7], 's');
  for (const [x, y] of [[8, 16], [10, 16], [9, 17]] as const) assert.equal(spec.rows[y]![x], '#');
  const accord = spec.circuits?.find(circuit => circuit.id === 'accord');
  assert.deepEqual(accord?.buttons, [{ x: 13, y: 5 }, { x: 3, y: 15 }, { x: 9, y: 14 }, { x: 15, y: 11 }]);
  assert.ok(spec.gates?.some(gate => gate.at.x === 10 && gate.at.y === 11 &&
    gate.circuit === 'accord' && gate.closedWhen === 'released' && gate.direction === 'N'));

  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new GallerySession(SS18_LEVELS);
  const roles = ['merchant', 'wizard', 'bard'] as const;
  const directions = { U: 1, D: 2, L: 3, R: 4, X: 5 } as const;
  const replays = [
    ...galleryFinalReview.checks.flatMap(record => record.level === 8 && 'commands' in record
      ? [{ level: record.level, commands: record.commands, wins: false, expelsHero: 'goalPressExpelledHero' in record }] : []),
    ...galleryFinalReview.acceptedAlternatives.map(({ level, commands }) => ({ level, commands, wins: true, expelsHero: false })),
  ];
  assert.equal(replays.length, 8);
  for (const { level, commands, wins, expelsHero } of replays) {
    ref.restart();
    let result = await routed.dispatch({ type: 'load', code: 'SS18', level });
    assert.deepEqual(result, ref.selectLevel(level));
    for (const command of commands!) {
      const actionId = command === 'C' ? 6 : directions[command as keyof typeof directions];
      assert.ok(actionId);
      const selected = visibleGalleryHeroes(result.frame).find(hero => hero.selected)?.kind;
      const nextRole = roles[(roles.findIndex(role => role === selected) + 1) % roles.length]!;
      const data = actionId === 6 ? galleryHeroSelection(result.frame, nextRole) ?? undefined : undefined;
      result = await routed.dispatch({ type: 'action', actionId, data });
      assert.deepEqual(result, ref.action(actionId, data));
    }
    assert.equal(result.levelsCompleted, Number(wins));
    assert.equal(result.level, wins ? 1 : level);
    assert.equal(result.state, 'NOT_FINISHED');
    if (expelsHero) {
      const wizard = visibleGalleryHeroes(result.frame).find(hero => hero.kind === 'wizard');
      assert.deepEqual([wizard?.x, wizard?.y], [10, 10]);
      assert.equal(result.frame[36]![33], 5);
      assert.deepEqual(await routed.dispatch({ type: 'undo' }), ref.undo());
    }
  }
});

test('SS19 preserves all three heroes across eight levels, animations and thirty-one tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss19 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss19-c4000001', 'Les Gardiens Noirs', 'custom_4', 'sinking_star_trio', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss19/src/levels.ts');
  assert.deepEqual(SS19_LEVELS.map(level => level.title), [
    'Le gardien du seuil', 'Les galeries des gardiens', 'L’interrupteur hors d’atteinte', 'Le gardien de la vanne',
    'Le troisième doit rester vivant', 'La seconde image', 'Le relais condamné', 'Les deux gardiens vivants',
  ]);
  assert.equal(SS19_TUTORIAL_LEVEL, 2);
  assert.deepEqual(ss19Witnesses.map(({ actions }) => actions.length), [62, 208, 150, 135, 134, 74, 52, 97]);
  assert.deepEqual(SS19_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss19-0${i + 1}`));

  const backend = createSs19Backend(), reference = new GuardiansSession(SS19_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<GuardiansLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss19 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS19' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss19Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleGuardiansHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'warrior', selected: true }, { kind: 'wizard', selected: false }]);
    for (const { id, data } of route as DuoAction[]) {
      const before = current;
      const expected = reference.action(id, data);
      const request = { type: 'action', actionId: id, data } as const;
      current = await dispatcher.dispatch(request);
      assert.deepEqual(current, expected);
      assert.deepEqual(backend.dispatch(request), expected);
      assert.ok(Object.keys(current).every(key => key === 'frameDurationsMs' || publicKeys.includes(key)));
      assert.equal(current.frameDurationsMs?.length, current.frames.length);
      assert.deepEqual(current.frames.at(-1), current.frame);
      if (id === 6) {
        assert.equal(current.frames.length, 1);
        const positions = (frame: number[][]) => visibleGuardiansHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeGuardiansLesson(lessons, before, current, id);
      if (level !== SS19_TUTORIAL_LEVEL) assert.equal(lessons.size, priorDiscoveries);
      actions++;
      frames += current.frames.length;
    }
    assert.equal(current.levelsCompleted, level);
    const victory = current;
    const undo = reference.undo();
    assert.deepEqual(await dispatcher.dispatch({ type: 'undo' }), undo);
    assert.deepEqual(backend.dispatch({ type: 'undo' }), undo);
    assert.equal(undo.level, level);
    assert.equal(undo.levelsCompleted, level - 1);
    const last = route.at(-1)! as DuoAction;
    const request = { type: 'action', actionId: last.id, data: last.data } as const;
    assert.deepEqual(reference.action(last.id, last.data), victory);
    current = await dispatcher.dispatch(request);
    assert.deepEqual(current, victory);
    assert.deepEqual(backend.dispatch(request), victory);
    if (level < SS19_TUTORIAL_LEVEL) assert.equal(lessons.size, 0);
    if (level >= SS19_TUTORIAL_LEVEL) assert.deepEqual(guardiansLessonIds.filter(id => lessons.has(id)), [...guardiansLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [912, 105, 2615]);
});

test('SS19 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs19Backend(), reference = new GuardiansSession(SS19_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS19', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS19', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS19 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS19', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS19 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = guardiansHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});



test('SS19 retains warning pixels, repeat timing, Undo and defeat across the native dispatcher', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new GuardiansSession(SS19_LEVELS);
  for (const [level, prefix] of [[8, 7], [6, 31]] as const) {
    assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS19', level }), ref.selectLevel(level));
    let previous = ref.observe();
    for (const { id, data } of ss19Witnesses[level - 1]!.actions.slice(0, prefix) as DuoAction[]) {
      previous = ref.observe();
      assert.deepEqual(await routed.dispatch({ type: 'action', actionId: id, data }), ref.action(id, data));
    }
    const before = ref.observe();
    const result = await routed.dispatch({ type: 'action', actionId: 5 });
    assert.deepEqual(result, ref.action(5));
    if (level === 8) {
      assert.deepEqual(result.frameDurationsMs, [110, 70, 110, 0]);
      const red = result.frames[0]!.flat();
      assert.deepEqual(before.frame.flat().flatMap((color, i) => color === red[i] ? [] : [[color, red[i]]]), [[5, 8], [5, 8], [5, 8]]);
      assert.deepEqual(result.frames, [result.frames[0], before.frame, result.frames[0], before.frame]);
      assert.deepEqual(await routed.dispatch({ type: 'action', actionId: 5 }), result);
      assert.deepEqual(await routed.dispatch({ type: 'undo' }), previous);
    } else {
      assert.equal(result.state, 'GAME_OVER');
      assert.deepEqual(await routed.dispatch({ type: 'undo' }), before);
    }
  }
});


test('SS19 preserves the final physical resources and six valid alternatives', async () => {
  const spec = SS19_LEVELS[7]!;
  const world = compileGuardiansLevel(spec);
  assert.equal(world.stones.length, 1);
  assert.equal(world.monsters.length, 2);
  assert.equal(world.mirrors.length, 1);
  assert.equal(world.goals.length, 3);
  assert.equal(spec.rows[17]![13], '~');
  assert.equal(world.gates.filter(gate => world.goals.some(goal => goal.x === gate.at.x && goal.y === gate.at.y)
    && gate.closedWhen === 'released').length, 2);

  const alternative = (level: number, length: number, commands: string | undefined) => {
    assert.equal(commands?.length, length);
    return { level, commands: commands! };
  };
  const middle = ss19MiddleReview.checks;
  const final = ss19FinalReview.checks;
  const replays = [
    alternative(4, 135, middle.find(item => item.name.includes('relâcher avant le chant'))?.commands),
    alternative(4, 138, middle.find(item => item.name.includes('traversée chantée'))?.commands),
    alternative(6, 95, final.find(item => item.id === 'level6-alternative-calendar')?.commands),
    alternative(7, 50, ss19IndependentReview.levels.find(item => item.level === 7)?.alternatives?.[0]?.commands),
    alternative(8, 75, final.find(item => item.id === 'level8-reflected-reserve-variant')?.commands),
    alternative(8, 93, final.find(item => item.id === 'level8-sung-delivery-variant')?.commands),
  ];
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new GuardiansSession(SS19_LEVELS);
  const roles = ['warrior', 'wizard', 'bard'] as const;
  const directions = { U: 1, D: 2, L: 3, R: 4, X: 5 } as const;
  for (const { level, commands } of replays) {
    ref.restart();
    let result = await routed.dispatch({ type: 'load', code: 'SS19', level });
    assert.deepEqual(result, ref.selectLevel(level));
    for (const command of commands) {
      const actionId = command === 'C' ? 6 : directions[command as keyof typeof directions];
      assert.ok(actionId);
      const selected = visibleGuardiansHeroes(result.frame).find(hero => hero.selected)?.kind;
      const nextRole = roles[(roles.findIndex(role => role === selected) + 1) % roles.length]!;
      const data = actionId === 6 ? guardiansHeroSelection(result.frame, nextRole) ?? undefined : undefined;
      result = await routed.dispatch({ type: 'action', actionId, data });
      assert.deepEqual(result, ref.action(actionId, data));
    }
    assert.equal(result.level, 1);
    assert.equal(result.levelsCompleted, 1);
  }
});
