/** Exercise the published or local SS16 through the real worker, controls and gallery. */
import assert from 'node:assert/strict';
import { TrioPuzzleSession } from '../experiments/sinking-star-ss16/src/core.ts';
import { LEVEL_INFO } from '../experiments/sinking-star-ss16/src/level-info.ts';
import { SS16_LEVELS } from '../experiments/sinking-star-ss16/src/levels.ts';
import { heroSelection, TUTORIAL_LEVEL, visibleHeroes } from '../experiments/sinking-star-ss16/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss16/tests/witnesses.json' with { type: 'json' };
import { assertNativeObservation, eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const live = process.argv.includes('--live');
const origin = new URL(process.env.SS16_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS16', live });
const link = level => '/?game=SS16' + (level ? '&level=' + level : '') + '#playground';

try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const merchant = page.locator('[data-ss16-hero="merchant"]'), thief = page.locator('[data-ss16-hero="thief"]');
  const warrior = page.locator('[data-ss16-hero="warrior"]');
  const tutorial = page.locator('#ss16-tutorial'), progress = page.locator('#ss16-lesson-progress');
  const ref = new TrioPuzzleSession(SS16_LEVELS);
  const count = () => page.evaluate(() => window.qa.count);
  const settled = async (minimum, expected) => {
    await page.waitForFunction(n => window.qa.count >= n
      && document.querySelector('#game-canvas').getAttribute('aria-busy') === 'false'
      && document.querySelector('#game-availability').textContent === 'Ready', minimum, { timeout: 20000 });
    if (expected) assertNativeObservation(await page.evaluate(() => window.qa.latest), expected);
  };
  const operate = async (gesture, expected) => {
    const before = await count();
    await gesture();
    await settled(before + 1, expected);
  };
  const button = (selector, expected) => operate(() => page.locator(selector).click(), expected);
  const press = (key, expected) => operate(() => canvas.press(key), expected);
  const choose = level => operate(() => levels.selectOption(String(level)), ref.selectLevel(level));
  const clickPixel = async ({ x, y }) => {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + (x + 0.5) * box.width / 64, box.y + (y + 0.5) * box.height / 64);
  };
  const select = (kind, gesture) => {
    const data = heroSelection(ref.observe().frame, kind);
    assert.ok(data);
    return operate(() => gesture(data), ref.action(6, data));
  };
  const act = ({ id, data }) => operate(() => id === 6 ? clickPixel(data) : canvas.press(keys[id]), ref.action(id, data));
  // In the complete replay, dispatch public UI inputs within the page and wait for
  // each corresponding worker observation and repaint before sending the next one.
  const replay = async steps => {
    if (steps.length === 0) return ref.observe();
    const before = await count();
    let expected;
    for (const { id, data } of steps) expected = ref.action(id, data);
    await canvas.evaluate(async (node, { steps, keys }) => {
      for (const { id, data } of steps) {
        const nextCount = window.qa.count + 1;
        await new Promise((resolve, reject) => {
          const observer = new MutationObserver(() => {
            if (window.qa.count < nextCount || node.getAttribute('aria-busy') !== 'false') return;
            observer.disconnect();
            clearTimeout(timeout);
            resolve();
          });
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error('SS16 UI did not settle after action ' + id));
          }, 12000);
          observer.observe(node, { attributes: true, attributeFilter: ['aria-busy'] });
          if (id === 6) {
            const box = node.getBoundingClientRect();
            node.dispatchEvent(new MouseEvent('click', {
              bubbles: true,
              clientX: box.x + (data.x + 0.5) * box.width / 64,
              clientY: box.y + (data.y + 0.5) * box.height / 64,
            }));
          } else node.dispatchEvent(new KeyboardEvent('keydown', { key: id === 5 ? ' ' : keys[id], bubbles: true }));
        });
      }
    }, { steps, keys });
    await settled(before + steps.length, expected);
    assert.equal(await count(), before + steps.length);
    return expected;
  };
  const assertDevice = async (level, x, y, expected) => {
    const rows = SS16_LEVELS[level - 1].rows;
    const px = 2 + 3 * (x + Math.floor((20 - rows[0].length) / 2));
    const py = 2 + 3 * (y + Math.floor((20 - rows.length) / 2));
    const rgba = await canvas.evaluate((node, { px, py }) =>
      Array.from(node.getContext('2d').getImageData(px, py, 3, 3).data), { px, py });
    assert.equal(sha(Buffer.from(rgba)), pixelHash(expected, ref.observe().palette), 'Device at level ' + level + ' (' + x + ',' + y + ')');
  };
  const boardHash = async () => sha(Buffer.from(await canvas.evaluate(node =>
    Array.from(node.getContext('2d').getImageData(0, 0, 64, 64).data))));
  const distinct = observation => new Set(observation.frames.map(frame => pixelHash(frame, observation.palette))).size;
  const capture = () => page.evaluate(() => { window.qa.paints = []; });
  const assertPaints = async expected => {
    const paints = await page.evaluate(() => { const captured = window.qa.paints; delete window.qa.paints; return captured; });
    assert.deepEqual(paints.map(paint => sha(Buffer.from(paint.rgba))),
      [...expected.frames, expected.frame].map(frame => pixelHash(frame, expected.palette)));
    assert.ok(paints.every(paint => paint.victoryHidden && paint.defeatHidden));
  };
  const visit = async level => {
    const url = origin + link(level);
    const response = page.url() === url ? await page.reload() : await page.goto(url);
    assert.equal(response?.status(), 200, url);
    ref.restart();
    const expected = level ? ref.selectLevel(level) : ref.observe();
    await settled(1, expected);
    assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
    assert.equal(await tutorial.isVisible(), expected.level === TUTORIAL_LEVEL);
    assert.equal(await merchant.isVisible(), true);
    assert.equal(await thief.isVisible(), true);
    assert.equal(await warrior.isVisible(), true);
    assert.equal(await merchant.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(visibleHeroes(expected.frame).map(hero => hero.kind).sort(), ['merchant', 'thief', 'warrior']);
    assert.equal(await page.locator('#ss16-source-label').textContent(), LEVEL_INFO[expected.level - 1].label);
    return expected;
  };

  const opening = await visit();
  assert.deepEqual([
    await page.locator('#undo-button span').textContent(),
    await page.locator('#reset-button span').textContent(),
    await page.locator('#restart-button span').textContent(),
  ], ['Annuler', 'Recommencer', 'Repartir du niveau 1']);
  assert.equal(await page.locator('#ss16-room-help summary').first().textContent(), 'Légende du plateau');
  assert.match(await page.locator('#ss16-legend').textContent(), /Appui dans l’eau · fixe/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  assert.equal(opening.level, 1);
  assert.equal(SS16_LEVELS[0].title, 'L’atelier des trois passeurs');
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  assert.deepEqual(await canvas.evaluate(node => [node.width, node.height, node.getContext('2d').imageSmoothingEnabled]), [64, 64, false]);
  assert.match(await canvas.evaluate(node => getComputedStyle(node).imageRendering), /^(pixelated|crisp-edges)$/);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  await select('thief', clickPixel);
  assert.equal(await thief.getAttribute('aria-pressed'), 'true');
  const selection = await page.evaluate(() => window.qa.requests.at(-1));
  assert.equal(selection.actionId, 6);
  assert.ok([selection.data.x, selection.data.y].every(value => Number.isInteger(value) && value >= 0 && value <= 63));
  await select('merchant', () => canvas.press('Tab'));
  await select('warrior', () => canvas.press('Tab'));
  await select('thief', () => canvas.press('Tab'));
  await select('merchant', () => canvas.press('1'));
  await select('warrior', () => canvas.press('2'));
  await select('thief', () => canvas.press('3'));
  await select('warrior', () => warrior.click());
  await select('thief', () => thief.click());
  await press('x', ref.action(5));
  await press('z', ref.undo());
  await press('r', ref.reset());
  assert.equal(await page.locator('#undo-button').isDisabled(), true);
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 20);
  assert.equal(await progress.textContent(), '0 / 20 découvertes');
  await select('thief', () => canvas.press('3'));
  assert.equal(await progress.textContent(), '1 / 20 découvertes');
  await press('z', ref.undo());
  assert.equal(await progress.textContent(), '1 / 20 découvertes');
  await choose(2);
  assert.equal(await tutorial.isVisible(), false);
  assert.equal(await page.locator('#ss16-platform-help').isVisible(), false);
  await choose(5);
  assert.equal(await page.locator('#ss16-platform-help').isVisible(), true);
  const secondary = page.locator('#ss16-secondary-source-link');
  assert.equal(await secondary.isVisible(), false);
  await choose(3);
  assert.equal(await secondary.getAttribute('href'), LEVEL_INFO[2].secondary.url);
  await button('#restart-button', ref.restart());
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await progress.textContent(), '0 / 20 découvertes');

  if (!live && !process.argv.includes('--smoke')) {
    await choose(TUTORIAL_LEVEL);
    const first = witnesses[TUTORIAL_LEVEL - 1].actions[0];
    await capture();
    const move = ref.action(first.id, first.data);
    assert.equal(move.frames.length, 3);
    assert.ok(distinct(move) > 1);
    await press(keys[first.id], move);
    await assertPaints(move);

    for (const [selector, kind] of [
      ['#undo-button', 'undo'], ['#reset-button', 'reset'], ['#restart-button', 'restart'],
      ['#level-select', 'selectLevel'], ['#agent-tab', 'mode'],
    ]) {
      await choose(TUTORIAL_LEVEL);
      const start = witnesses[TUTORIAL_LEVEL - 1].actions[0];
      const motion = ref.action(start.id, start.data);
      assert.ok(motion.frames.length >= 3);
      const expected = kind === 'mode' ? motion : kind === 'selectLevel' ? ref.selectLevel(2) : ref[kind]();
      const before = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 2, level: 2 };
      }, selector);
      await canvas.press(keys[start.id]);
      await settled(before + (kind === 'mode' ? 1 : 2), expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(request => request.type)), kind === 'mode' ? ['action'] : ['action', kind]);
      assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
      await page.waitForTimeout(250);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      if (kind === 'mode') await page.locator('#manual-tab').click();
    }
    await choose(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await replay(witnesses[0].actions.slice(0, 129));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await capture();
    const dead = ref.action(5);
    assert.equal(dead.state, 'GAME_OVER');
    await press(keys[5], dead);
    await assertPaints(dead);
    assert.equal(await page.locator('#native-defeat').isVisible(), true);
    await button('#native-defeat-undo', ref.undo());
    assert.equal(await page.locator('#native-defeat').isVisible(), false);

    await button('#restart-button', ref.restart());
    await page.locator('#agent-tab').click();
    await page.evaluate(() => {
      window.qa.requests.length = 0;
      window.qa.interrupted = null;
      window.qa.interruption = { selector: '#manual-tab', paints: 0, at: 1, minFrames: 3 };
    });
    for (let attempt = 0; attempt < 6; attempt++) {
      const before = await count();
      await page.locator('#agent-step').click();
      await settled(before + 1);
      if (await page.evaluate(() => Boolean(window.qa.interrupted))) break;
    }
    const requests = await page.evaluate(() => window.qa.requests);
    assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
    assert.equal(await page.evaluate(() => window.qa.agentStepDisabled), true);
    let agentReturn;
    for (const { type, actionId, data } of requests) {
      assert.equal(type, 'action');
      assert.ok(opening.availableActionIds.includes(actionId));
      agentReturn = ref.action(actionId, data);
    }
    assert.ok(agentReturn);
    await settled(await count(), agentReturn);
    await page.waitForTimeout(250);
    assert.equal(await boardHash(), pixelHash(ref.observe().frame, ref.observe().palette));
    await press('z', ref.undo());
    console.log('SS16: manual interruptions and return from the generic agent verified');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await button('#restart-button', ref.restart());
    for (const { level, actions } of witnesses) {
      assert.equal(ref.observe().level, level);
      if (level === 8) {
        await replay(actions.slice(0, -1));
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await capture();
        await act(actions.at(-1));
        await assertPaints(await page.evaluate(() => window.qa.latest));
      } else await replay(actions);
      assert.equal(ref.observe().levelsCompleted, level);
      if (level === TUTORIAL_LEVEL) assert.equal(await progress.textContent(), '20 / 20 découvertes');
    }
    assert.equal(ref.observe().state, 'WIN');
    assert.equal(await page.locator('#win-overlay').isVisible(), true);
    await press('z', ref.undo());
    assert.equal(await page.locator('#win-overlay').isVisible(), false);
    console.log('SS16: eight routes and twenty tutorial discoveries verified through the real interface');
  }

  for (const level of eight.map(Number)) {
    const opening = await visit(level);
    if (level === 5) {
      assert.equal(SS16_LEVELS[4].title, 'La relève du gardien');
      assert.equal(witnesses[4].actions.length, 265);
      await assertDevice(5, 5, 4, [[3, 7, 3], [7, 14, 7], [3, 7, 3]]);
      await assertDevice(5, 12, 4, [[7, 14, 7], [7, 5, 14], [7, 14, 7]]);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await replay(witnesses[4].actions.slice(0, 4));
      await assertDevice(5, 12, 4, [[7, 14, 7], [3, 3, 14], [7, 14, 7]]);
      await replay(witnesses[4].actions.slice(4));
      assert.equal(ref.observe().levelsCompleted, 1);
      assert.equal(ref.observe().level, 1);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      console.log('SS16: reinforced level 5, all 265 entries and exact button and press pixels verified');
    }
    if (level === 8) {
      await page.evaluate(() => {
        const original = window.setTimeout;
        window.qa.warningWaits = [];
        window.qa.restoreClock = () => { window.setTimeout = original; };
        window.setTimeout = (callback, delay, ...args) => {
          if (delay === 110 || delay === 70) window.qa.warningWaits.push(delay);
          return original(callback, delay, ...args);
        };
      });
      const warning = ref.action(5);
      assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
      assert.equal(warning.canUndo, false);
      assert.deepEqual(warning.frame, opening.frame);
      for (const reduced of ['no-preference', 'reduce']) {
        await page.emulateMedia({ reducedMotion: reduced });
        await capture();
        await press('Space', warning);
        await assertPaints(warning);
        assert.equal(await boardHash(), pixelHash(opening.frame, opening.palette));
        assert.equal(await page.locator('#undo-button').isDisabled(), true);
        const waits = await page.evaluate(() => window.qa.warningWaits.splice(0));
        assert.deepEqual(waits, reduced === 'reduce' ? [] : [110, 70, 110]);
      }
      await page.evaluate(() => window.qa.restoreClock());
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      console.log('SS16: actual level 8 red/normal/red/normal warning, waits, reduced motion and unchanged Undo verified');
    }
  }
  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const card = section.locator('[data-gallery-game="SS16"]');
  assert.deepEqual(await card.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  ref.restart();
  for (const level of eight) {
    await card.locator('[data-gallery-level]').selectOption(level);
    assert.equal(await card.locator('[data-gallery-launch]').getAttribute('href'), link(level));
    const tile = await card.locator('[data-gallery-frame]').evaluate(async node => {
      const image = node.querySelector('img');
      image.loading = 'eager';
      await image.decode();
      const sample = document.createElement('canvas');
      sample.width = sample.height = 64;
      const ctx = sample.getContext('2d');
      const row = Number(node.style.getPropertyValue('--atlas-row'));
      const column = Number(node.style.getPropertyValue('--atlas-column'));
      ctx.drawImage(image, column * 64, row * 64, 64, 64, 0, 0, 64, 64);
      return { dimensions: [image.naturalWidth, image.naturalHeight], rgba: Array.from(ctx.getImageData(0, 0, 64, 64).data) };
    });
    const expected = ref.selectLevel(Number(level));
    assert.deepEqual(tile.dimensions, [512, groups.length * 64]);
    assert.equal(sha(Buffer.from(tile.rgba)), pixelHash(expected.frame, expected.palette), 'Gallery tile ' + level);
  }
  await card.locator('[data-gallery-launch]').click();
  await settled(1, ref.observe());
  await page.setViewportSize({ width: 390, height: 844 });
  const boardWidth = await canvas.evaluate(node => node.getBoundingClientRect().width);
  assert.ok(boardWidth > 250 && boardWidth <= 390);
  await select('warrior', () => warrior.click());
  await select('thief', () => thief.click());
  assert.equal(await thief.getAttribute('aria-pressed'), 'true');
  for (const role of [merchant, warrior, thief]) assert.ok((await role.boundingBox()).height >= 44);
  await button('[data-action="5"]', ref.action(5));
  await choose(TUTORIAL_LEVEL);
  assert.equal(await tutorial.isVisible(), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  assert.deepEqual(pythonRequests, []);
  assert.deepEqual(errors, []);
  console.log('SS16: all three roles and level 1 tutorial, eight direct links and gallery tiles, credits, mobile and native loading verified');
} finally {
  await close();
}
