import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { createSs24Backend } from '../src/games/sinking-star-ss24.ts';
import { QuartetPuzzleSession } from '../experiments/sinking-star-ss24/src/core.ts';
import { SS24_LEVELS } from '../experiments/sinking-star-ss24/src/levels.ts';
import { heroSelection as traverseHeroSelection, lessonIds as traverseLessonIds, observeLesson as observeTraverseLesson, TUTORIAL_LEVEL as SS24_TUTORIAL_LEVEL, visibleHeroes as visibleTraverseHeroes, type GalleryLesson as TraverseLesson } from '../experiments/sinking-star-ss24/src/tutorial.ts';
import { SS24_ROOM_HELP_HTML } from '../src/games/sinking-star-ss24-help.ts';

type DuoAction = { id: number; data?: { x: number; y: number } };

test('SS24 preserves all four heroes across eight levels, animations and thirty-seven tutorial discoveries', async t => {
  const ss24Witnesses = JSON.parse(readFileSync(new URL('../experiments/sinking-star-ss24/tests/witnesses.json', import.meta.url), 'utf8')) as { level: number; actions: DuoAction[] }[];
  const { getGameByCode } = await import('../src/games/catalog.ts');
  const entry = getGameByCode(' ss24 ')!;
  assert.deepEqual([entry.id, entry.name, entry.group, entry.family, entry.levels, entry.availability],
    ['ss24-c4000001', 'Les Voies de Traverse', 'custom_4', 'sinking_star_quartet', 8, 'playable']);
  assert.equal(entry.sourcePath, 'experiments/sinking-star-ss24/src/levels.ts');
  assert.equal(new Set(SS24_LEVELS.map(level => level.title)).size, 8);
  assert.ok(SS24_LEVELS.every(level => level.title.trim().length > 0));
  assert.equal(SS24_TUTORIAL_LEVEL, 1);
  assert.deepEqual(ss24Witnesses.map(({ level }) => level), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(ss24Witnesses.every(({ actions }) => actions.length > 0));
  assert.equal(traverseLessonIds.length, 37);
  assert.deepEqual(SS24_LEVELS.map(level => level.id), Array.from({ length: 8 }, (_, i) => `ss24-0${i + 1}`));

  const backend = createSs24Backend(), reference = new QuartetPuzzleSession(SS24_LEVELS);
  const dispatcher = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  const lessons = new Set<TraverseLesson>();
  const outsideTutorial = new Set<TraverseLesson>();
  let current = await dispatcher.dispatch({ type: 'load', code: ' ss24 ' });
  assert.deepEqual(current, reference.observe());
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS24' }), current);
  const publicKeys = Object.keys(current);
  let actions = 0, selections = 0, frames = 0;
  for (const { level, actions: route } of ss24Witnesses) {
    assert.equal(current.level, level);
    assert.equal(current.palette?.length, 16);
    assert.deepEqual(visibleTraverseHeroes(current.frame).map(({ kind, selected }) => ({ kind, selected })).sort((a, b) => a.kind.localeCompare(b.kind)),
      [{ kind: 'bard', selected: false }, { kind: 'merchant', selected: true }, { kind: 'thief', selected: false }, { kind: 'wizard', selected: false }]);
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
        const positions = (frame: number[][]) => visibleTraverseHeroes(frame).map(({ kind, x, y }) => [kind, x, y]);
        assert.deepEqual(positions(current.frame), positions(before.frame));
        selections++;
      }
      const priorDiscoveries = lessons.size;
      observeTraverseLesson(lessons, before, current, id);
      if (level !== SS24_TUTORIAL_LEVEL) {
        assert.equal(lessons.size, priorDiscoveries);
        observeTraverseLesson(outsideTutorial, before, current, id);
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
    if (level >= SS24_TUTORIAL_LEVEL) assert.deepEqual(traverseLessonIds.filter(id => lessons.has(id)), [...traverseLessonIds]);
  }
  assert.equal(current.state, 'WIN');
  assert.equal(actions, ss24Witnesses.reduce((sum, route) => sum + route.actions.length, 0));
  t.diagnostic(JSON.stringify({ commandsByLevel: ss24Witnesses.map(route => route.actions.length), actions, selections, frames, discoveries: lessons.size }));
});

test('SS24 rejects invalid loads and actions and preserves selection, Undo, Reset and Restart', async () => {
  const backend = createSs24Backend(), reference = new QuartetPuzzleSession(SS24_LEVELS);
  const initial = reference.selectLevel(4);
  assert.deepEqual(backend.dispatch({ type: 'load', code: 'SS24', level: 4 }), initial);
  for (const level of [0, 9, 1.5, NaN]) {
    assert.throws(() => backend.dispatch({ type: 'load', code: 'SS24', level }), /Invalid level/);
  }
  for (const data of [undefined, { x: 1.5, y: 20 }, { x: -1, y: 0 }, { x: 0, y: 64 }]) {
    assert.throws(() => backend.dispatch({ type: 'action', actionId: 6, data }), /pixel coordinates/);
  }
  assert.throws(() => backend.dispatch({ type: 'action', actionId: 7 }), /Invalid SS24 action/);
  assert.throws(() => backend.dispatch({ type: 'selectLevel', level: 0 }), /Invalid level/);
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  assert.deepEqual(await routed.dispatch({ type: 'load', code: 'SS24', level: 4 }), initial);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: 6, data: { x: 64, y: 1 } })), /pixel coordinates/);
  await assert.rejects(() => Promise.resolve(routed.dispatch({ type: 'action', actionId: -1 })), /Invalid SS24 action/);
  assert.deepEqual(await routed.dispatch({ type: 'undo' }), initial);
  for (const level of [8, 3, 7, 2, 5, 1, 6, 4]) {
    assert.deepEqual(await routed.dispatch({ type: 'selectLevel', level }), reference.selectLevel(level));
  }
  const data = traverseHeroSelection(initial.frame, 'bard')!;
  assert.deepEqual(backend.dispatch({ type: 'action', actionId: 6, data }), reference.action(6, data));
  assert.deepEqual(backend.dispatch({ type: 'undo' }), reference.undo());
  assert.deepEqual(backend.dispatch({ type: 'reset' }), reference.reset());
  assert.deepEqual(backend.dispatch({ type: 'selectLevel', level: 8 }), reference.selectLevel(8));
  assert.deepEqual(backend.dispatch({ type: 'restart' }), reference.restart());
  assert.deepEqual(await routed.dispatch({ type: 'restart' }), reference.observe());
});




test('SS24 selects all four roles from public pixels and restores every selection with Undo', async () => {
  const routed = createGameDispatcher(async () => { throw new Error('Unexpected Python'); });
  let current = await routed.dispatch({ type: 'load', code: 'SS24' });
  for (const role of ['thief', 'wizard', 'bard', 'merchant'] as const) {
    const before = current;
    const data = traverseHeroSelection(current.frame)!;
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
    assert.equal(visibleTraverseHeroes(current.frame).find(hero => hero.selected)?.kind, role);
    assert.equal(current.frames.length, 1);
    assert.deepEqual(visibleTraverseHeroes(current.frame).map(({ kind, x, y }) => [kind, x, y]),
      visibleTraverseHeroes(before.frame).map(({ kind, x, y }) => [kind, x, y]));
    const { frameDurationsMs: _timing, ...settledBefore } = before;
    assert.deepEqual(await routed.dispatch({ type: 'undo' }), settledBefore);
    current = await routed.dispatch({ type: 'action', actionId: 6, data });
  }
});

test('SS24 native help exposes the same 37 discoveries and describes the quartet with mobile supports', () => {
  const ids = [...SS24_ROOM_HELP_HTML.matchAll(/data-ss24-lesson="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, [...traverseLessonIds]);
  const elementIds = [...SS24_ROOM_HELP_HTML.matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length);
  for (const id of ['room-help','objective','source-label','source-link','secondary-source-link','tutorial','lesson-next','lesson-progress','thief-help','wizard-help','bard-help','piston-help','platform-help','platform-legend-active','platform-legend-inactive','monster-help']) {
    assert.ok(elementIds.includes('ss24-' + id), 'Native room updater requires ' + id);
  }
  assert.match(SS24_ROOM_HELP_HTML, /Destination · quatre à occuper/);
  assert.match(SS24_ROOM_HELP_HTML, /Appui immergé · mobile par le chant/);
  assert.match(SS24_ROOM_HELP_HTML, /Barde magenta/);
  assert.match(SS24_ROOM_HELP_HTML, /Voleur vert/);
  assert.match(SS24_ROOM_HELP_HTML, /Magicien violet/);
  assert.match(SS24_ROOM_HELP_HTML, /Échanger le Barde laisse son groupe en place/);
  assert.match(SS24_ROOM_HELP_HTML, /Tirer le Barde laisse ses caisses et ses appuis en place/);
  assert.match(SS24_ROOM_HELP_HTML, /tirer le Magicien ne lance pas son rayon/);
  assert.match(SS24_ROOM_HELP_HTML, /Un pas refusé ne tire rien/);
  assert.match(SS24_ROOM_HELP_HTML, /carré de 5 × 5/);
  assert.doesNotMatch(SS24_ROOM_HELP_HTML, /Guerrier|warrior|trois à occuper|appui fixe/i);
});
