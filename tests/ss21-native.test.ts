import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { createSs21Backend } from '../src/games/sinking-star-ss21.ts';
import { QuartetPuzzleSession } from '../experiments/sinking-star-ss21/src/core.ts';
import { SS21_LEVELS } from '../experiments/sinking-star-ss21/src/levels.ts';
import { heroSelection as quartetHeroSelection, lessonIds as quartetLessonIds, observeLesson as observeQuartetLesson, TUTORIAL_LEVEL as SS21_TUTORIAL_LEVEL, visibleHeroes as visibleQuartetHeroes, type GalleryLesson as QuartetLesson } from '../experiments/sinking-star-ss21/src/tutorial.ts';
import { SS21_ROOM_HELP_HTML } from '../src/games/sinking-star-ss21-help.ts';
import ss21Witnesses from '../experiments/sinking-star-ss21/tests/witnesses.json' with { type: 'json' };

type DuoAction = { id: number; data?: { x: number; y: number } };

test('SS21 preserves all four heroes across eight levels, animations and thirty-one tutorial discoveries', async () => {
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss21 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss21-c4000001', 'Les Quatre Destinations', 'custom_4', 'sinking_star_quartet', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss21/src/levels.ts');
  assert.deepEqual(SS21_LEVELS.map(level => level.title), [
    'L’école des quatre', 'Trois caisses, deux chambres', 'Les quatre balcons', 'Le rectangle sans issue',
    'Le dernier intercepteur', 'Le compte des îlots', 'L’écluse à deux étages', 'Le verrou à trois poids',
  ]);
  assert.equal(SS21_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss21Witnesses.map(({ actions }) => actions.length), [260, 143, 103, 182, 224, 202, 153, 219]);
  assert.deepEqual(SS21_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss21-0${i + 1}`));

  const backend = createSs21Backend(), reference = new QuartetPuzzleSession(SS21_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<QuartetLesson>();
  const outsideTutorial = new Set<QuartetLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss21 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS21' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss21Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleQuartetHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'merchant', selected: true }, { kind: 'thief', selected: false }, { kind: 'warrior', selected: false }, { kind: 'wizard', selected: false }]);
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
        const positions = (frame: number[][]) => visibleQuartetHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeQuartetLesson(lessons, before, current, id);
      if (level !== SS21_TUTORIAL_LEVEL) {
        assert.equal(lessons.size, priorDiscoveries);
        observeQuartetLesson(outsideTutorial, before, current, id);
        assert.equal(outsideTutorial.size, 0);
      }
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
    if (level >= SS21_TUTORIAL_LEVEL) assert.deepEqual(quartetLessonIds.filter(id => lessons.has(id)), [...quartetLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.deepEqual([actions, selections, frames], [1486, 208, 4128]);
});

test('SS21 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs21Backend(), reference = new QuartetPuzzleSession(SS21_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS21', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS21', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS21 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS21', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS21 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = quartetHeroSelection(initial.frame, 'wizard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});




test('SS21 selects all four roles from public pixels and restores every selection with Undo', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  let current = await routed.dispatch({ type: 'load', code: 'SS21' });
  for (const role of ['warrior', 'thief', 'wizard', 'merchant'] as const) {
    const before = current;
    const data = quartetHeroSelection(current.frame)!;
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
    assert.equal(visibleQuartetHeroes(current.frame).find(hero => hero.selected)?.kind, role);
    assert.equal(current.frames.length, 1);
    assert.deepEqual(visibleQuartetHeroes(current.frame).map(({ kind, x, y }) => [kind, x, y]),
      visibleQuartetHeroes(before.frame).map(({ kind, x, y }) => [kind, x, y]));
    const { frameDurationsMs: _timing, ...settledBefore } = before;
    assert.deepEqual(await routed.dispatch({ type: 'undo' }), settledBefore);
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
  }
});

test('SS21 keeps the returning Wizard ray, repeated feedback and whole-turn Undo in the native dispatcher', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const ref = new QuartetPuzzleSession(SS21_LEVELS);
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS21', level: 4 }), ref.selectLevel(4));
  const data = quartetHeroSelection(ref.observe().frame, 'wizard')!;
  const selected = await routed.dispatch({ type: 'action', actionId: 6, data });
  assert.deepEqual(selected, ref.action(6, data));
  const first = await routed.dispatch({ type: 'action', actionId: 4 });
  assert.deepEqual(first, ref.action(4));
  assert.equal(first.state, 'NOT_FINISHED');
  assert.deepEqual(first.frameDurationsMs, [90, 90, 90, 90, 100, 100, 80, 100, 0]);
  assert.deepEqual(visibleQuartetHeroes(first.frame).map(({kind,x,y})=>[kind,x,y]), visibleQuartetHeroes(selected.frame).map(({kind,x,y})=>[kind,x,y]));
  assert.deepEqual(await routed.dispatch({ type: 'action', actionId: 4 }), ref.action(4));
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), ref.undo());
  assert.deepEqual(ref.observe().frame, selected.frame);
});

test('SS21 native help exposes the same 31 discoveries and describes the fixed-support quartet', () => {
  const ids = [...SS21_ROOM_HELP_HTML.matchAll(/data-ss21-lesson="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [...quartetLessonIds]);
  const elementIds = [...SS21_ROOM_HELP_HTML.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length);
  for (const id of ['room-help','objective','source-label','source-link','secondary-source-link','tutorial','lesson-next','lesson-progress','piston-help','platform-help','platform-legend-active','platform-legend-inactive','monster-help']) {
    assert.ok(elementIds.includes('ss21-' + id), 'Native room updater requires ' + id);
  }
  assert.match(SS21_ROOM_HELP_HTML, /Destination · quatre à occuper/);
  assert.match(SS21_ROOM_HELP_HTML, /Appui immergé · fixe/);
  assert.doesNotMatch(SS21_ROOM_HELP_HTML, /Barde|bard|trois à occuper/);
});
