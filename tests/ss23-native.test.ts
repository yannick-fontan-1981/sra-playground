import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { createSs23Backend } from '../src/games/sinking-star-ss23.ts';
import { QuartetPuzzleSession } from '../experiments/sinking-star-ss23/src/core.ts';
import { SS23_LEVELS } from '../experiments/sinking-star-ss23/src/levels.ts';
import { heroSelection as resonanceHeroSelection, lessonIds as resonanceLessonIds, observeLesson as observeResonanceLesson, TUTORIAL_LEVEL as SS23_TUTORIAL_LEVEL, visibleHeroes as visibleResonanceHeroes, type GalleryLesson as ResonanceLesson } from '../experiments/sinking-star-ss23/src/tutorial.ts';
import { SS23_ROOM_HELP_HTML } from '../src/games/sinking-star-ss23-help.ts';

type DuoAction = { id: number; data?: { x: number; y: number } };

test('SS23 preserves all four heroes across eight levels, animations and thirty-six tutorial discoveries', async t => {
  const ss23Witnesses = JSON.parse(readFileSync(new URL('../experiments/sinking-star-ss23/tests/witnesses.json', import.meta.url), 'utf8')) as { level: number; actions: DuoAction[] }[];
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss23 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss23-c4000001', 'Les Chambres de Résonance', 'custom_4', 'sinking_star_quartet', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss23/src/levels.ts');
  assert.equal(new Set(SS23_LEVELS.map(level => level.title)).size, 8);
  assert.ok(SS23_LEVELS.every(level => level.title.trim().length > 0));
  assert.equal(SS23_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss23Witnesses.map(({ level }) => level), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(ss23Witnesses.every(({ actions }) => actions.length > 0));
  assert.equal(resonanceLessonIds.length, 36);
  assert.deepEqual(SS23_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss23-0${i + 1}`));

  const backend = createSs23Backend(), reference = new QuartetPuzzleSession(SS23_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<ResonanceLesson>();
  const outsideTutorial = new Set<ResonanceLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss23 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS23' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss23Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleResonanceHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'merchant', selected: true }, { kind: 'warrior', selected: false }, { kind: 'wizard', selected: false }]);
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
        const positions = (frame: number[][]) => visibleResonanceHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeResonanceLesson(lessons, before, current, id);
      if (level !== SS23_TUTORIAL_LEVEL) {
        assert.equal(lessons.size, priorDiscoveries);
        observeResonanceLesson(outsideTutorial, before, current, id);
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
    if (level >= SS23_TUTORIAL_LEVEL) assert.deepEqual(resonanceLessonIds.filter(id => lessons.has(id)), [...resonanceLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.equal(actions, ss23Witnesses.reduce((sum, route) => sum + route.actions.length, 0));
  t.diagnostic(JSON.stringify({ commandsByLevel: ss23Witnesses.map(route => route.actions.length), actions, selections, frames, discoveries: lessons.size }));
});

test('SS23 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs23Backend(), reference = new QuartetPuzzleSession(SS23_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS23', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS23', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS23 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS23', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS23 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = resonanceHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});




test('SS23 selects all four roles from public pixels and restores every selection with Undo', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  let current = await routed.dispatch({ type: 'load', code: 'SS23' });
  for (const role of ['warrior', 'wizard', 'bard', 'merchant'] as const) {
    const before = current;
    const data = resonanceHeroSelection(current.frame)!;
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
    assert.equal(visibleResonanceHeroes(current.frame).find(hero => hero.selected)?.kind, role);
    assert.equal(current.frames.length, 1);
    assert.deepEqual(visibleResonanceHeroes(current.frame).map(({ kind, x, y }) => [kind, x, y]),
      visibleResonanceHeroes(before.frame).map(({ kind, x, y }) => [kind, x, y]));
    const { frameDurationsMs: _timing, ...settledBefore } = before;
    assert.deepEqual(await routed.dispatch({ type: 'undo' }), settledBefore);
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
  }
});

test('SS23 native help exposes the same 36 discoveries and describes the quartet with mobile supports', () => {
  const ids = [...SS23_ROOM_HELP_HTML.matchAll(/data-ss23-lesson="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [...resonanceLessonIds]);
  const elementIds = [...SS23_ROOM_HELP_HTML.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length);
  for (const id of ['room-help','objective','source-label','source-link','secondary-source-link','tutorial','lesson-next','lesson-progress','warrior-help','wizard-help','bard-help','piston-help','platform-help','platform-legend-active','platform-legend-inactive','monster-help']) {
    assert.ok(elementIds.includes('ss23-' + id), 'Native room updater requires ' + id);
  }
  assert.match(SS23_ROOM_HELP_HTML, /Destination · quatre à occuper/);
  assert.match(SS23_ROOM_HELP_HTML, /Appui immergé · mobile par le chant/);
  assert.match(SS23_ROOM_HELP_HTML, /Barde magenta/);
  assert.match(SS23_ROOM_HELP_HTML, /Guerrier rouge/);
  assert.match(SS23_ROOM_HELP_HTML, /Magicien violet/);
  assert.match(SS23_ROOM_HELP_HTML, /Échanger le Barde laisse son groupe en place/);
  assert.match(SS23_ROOM_HELP_HTML, /carré de 5 × 5/);
  assert.doesNotMatch(SS23_ROOM_HELP_HTML, /Voleur|thief|trois à occuper|appui fixe/i);
});
