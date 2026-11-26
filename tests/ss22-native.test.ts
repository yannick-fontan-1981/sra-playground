import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { createSs22Backend } from '../src/games/sinking-star-ss22.ts';
import { QuartetPuzzleSession } from '../experiments/sinking-star-ss22/src/core.ts';
import { SS22_LEVELS } from '../experiments/sinking-star-ss22/src/levels.ts';
import { heroSelection as cortegeHeroSelection, lessonIds as cortegeLessonIds, observeLesson as observeCortegeLesson, TUTORIAL_LEVEL as SS22_TUTORIAL_LEVEL, visibleHeroes as visibleCortegeHeroes, type GalleryLesson as CortegeLesson } from '../experiments/sinking-star-ss22/src/tutorial.ts';
import { SS22_ROOM_HELP_HTML } from '../src/games/sinking-star-ss22-help.ts';

type DuoAction = { id: number; data?: { x: number; y: number } };

test('SS22 preserves all four heroes across eight levels, animations and thirty-three tutorial discoveries', async t => {
  const ss22Witnesses = JSON.parse(readFileSync(new URL('../experiments/sinking-star-ss22/tests/witnesses.json', import.meta.url), 'utf8')) as { level: number; actions: DuoAction[] }[];
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss22 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss22-c4000001', 'Les Cortèges Mécaniques', 'custom_4', 'sinking_star_quartet', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss22/src/levels.ts');
  assert.equal(new Set(SS22_LEVELS.map(level => level.title)).size, 8);
  assert.ok(SS22_LEVELS.every(level => level.title.trim().length > 0));
  assert.equal(SS22_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss22Witnesses.map(({ level }) => level), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(ss22Witnesses.every(({ actions }) => actions.length > 0));
  assert.equal(cortegeLessonIds.length, 33);
  assert.deepEqual(SS22_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss22-0${i + 1}`));

  const backend = createSs22Backend(), reference = new QuartetPuzzleSession(SS22_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<CortegeLesson>();
  const outsideTutorial = new Set<CortegeLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss22 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS22' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss22Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleCortegeHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'merchant', selected: true }, { kind: 'thief', selected: false }, { kind: 'warrior', selected: false }]);
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
        const positions = (frame: number[][]) => visibleCortegeHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeCortegeLesson(lessons, before, current, id);
      if (level !== SS22_TUTORIAL_LEVEL) {
        assert.equal(lessons.size, priorDiscoveries);
        observeCortegeLesson(outsideTutorial, before, current, id);
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
    if (level >= SS22_TUTORIAL_LEVEL) assert.deepEqual(cortegeLessonIds.filter(id => lessons.has(id)), [...cortegeLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.equal(actions, ss22Witnesses.reduce((sum, route) => sum + route.actions.length, 0));
  t.diagnostic(JSON.stringify({ commandsByLevel: ss22Witnesses.map(route => route.actions.length), actions, selections, frames, discoveries: lessons.size }));
});

test('SS22 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs22Backend(), reference = new QuartetPuzzleSession(SS22_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS22', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS22', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS22 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS22', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS22 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = cortegeHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});




test('SS22 selects all four roles from public pixels and restores every selection with Undo', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  let current = await routed.dispatch({ type: 'load', code: 'SS22' });
  for (const role of ['warrior', 'thief', 'bard', 'merchant'] as const) {
    const before = current;
    const data = cortegeHeroSelection(current.frame)!;
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
    assert.equal(visibleCortegeHeroes(current.frame).find(hero => hero.selected)?.kind, role);
    assert.equal(current.frames.length, 1);
    assert.deepEqual(visibleCortegeHeroes(current.frame).map(({ kind, x, y }) => [kind, x, y]),
      visibleCortegeHeroes(before.frame).map(({ kind, x, y }) => [kind, x, y]));
    const { frameDurationsMs: _timing, ...settledBefore } = before;
    assert.deepEqual(await routed.dispatch({ type: 'undo' }), settledBefore);
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
  }
});

test('SS22 native help exposes the same 33 discoveries and describes the quartet with mobile supports', () => {
  const ids = [...SS22_ROOM_HELP_HTML.matchAll(/data-ss22-lesson="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [...cortegeLessonIds]);
  const elementIds = [...SS22_ROOM_HELP_HTML.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length);
  for (const id of ['room-help','objective','source-label','source-link','secondary-source-link','tutorial','lesson-next','lesson-progress','warrior-help','bard-help','piston-help','platform-help','platform-legend-active','platform-legend-inactive','monster-help']) {
    assert.ok(elementIds.includes('ss22-' + id), 'Native room updater requires ' + id);
  }
  assert.match(SS22_ROOM_HELP_HTML, /Destination · quatre à occuper/);
  assert.match(SS22_ROOM_HELP_HTML, /Appui immergé · mobile par le chant/);
  assert.match(SS22_ROOM_HELP_HTML, /Barde magenta/);
  assert.match(SS22_ROOM_HELP_HTML, /Guerrier rouge/);
  assert.match(SS22_ROOM_HELP_HTML, /carré de 5 × 5/);
  assert.doesNotMatch(SS22_ROOM_HELP_HTML, /Magicien|wizard|trois à occuper|appui fixe/i);
});
