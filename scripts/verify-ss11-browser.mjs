/** Exercise the published or local SS11 through the real worker, controls and gallery. */
import assert from 'node:assert/strict';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss11/src/core.ts';
import { LEVEL_INFO } from '../experiments/sinking-star-ss11/src/level-info.ts';
import { SS11_LEVELS } from '../experiments/sinking-star-ss11/src/levels.ts';
import { heroSelection, TUTORIAL_LEVEL, visibleHeroes } from '../experiments/sinking-star-ss11/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss11/tests/witnesses.json' with { type: 'json' };
import { assertNativeObservation, eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const live = process.argv.includes('--live');
const origin = new URL(process.env.SS11_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS11', live });
const link = level => '/?game=SS11' + (level ? '&level=' + level : '') + '#playground';

try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const warrior = page.locator('[data-ss11-hero="warrior"]'), wizard = page.locator('[data-ss11-hero="wizard"]');
  const tutorial = page.locator('#ss11-tutorial'), progress = page.locator('#ss11-lesson-progress');
  const ref = new DuoPuzzleSession(SS11_LEVELS);
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
    assert.equal((await page.goto(origin + link(level))).status(), 200);
    ref.restart();
    const expected = level ? ref.selectLevel(level) : ref.observe();
    await settled(1, expected);
    assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
    assert.equal(await tutorial.isVisible(), level === TUTORIAL_LEVEL);
    assert.equal(await warrior.isVisible(), true);
    assert.equal(await wizard.isVisible(), true);
    assert.equal(await warrior.getAttribute('aria-pressed'), 'true');
    assert.deepEqual(visibleHeroes(expected.frame).map(hero => hero.kind).sort(), ['warrior', 'wizard']);
    assert.equal(await page.locator('#ss11-source-label').textContent(), LEVEL_INFO[expected.level - 1].label);
    return expected;
  };

  const opening = await visit();
  assert.equal(opening.level, 1);
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  assert.deepEqual(await canvas.evaluate(node => [node.width, node.height, node.getContext('2d').imageSmoothingEnabled]), [64, 64, false]);
  assert.match(await canvas.evaluate(node => getComputedStyle(node).imageRendering), /^(pixelated|crisp-edges)$/);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  await select('wizard', clickPixel);
  assert.equal(await wizard.getAttribute('aria-pressed'), 'true');
  const selection = await page.evaluate(() => window.qa.requests.at(-1));
  assert.equal(selection.actionId, 6);
  assert.ok([selection.data.x, selection.data.y].every(value => Number.isInteger(value) && value >= 0 && value <= 63));
  await select('warrior', () => canvas.press('Tab'));
  await select('wizard', () => canvas.press('2'));
  await select('warrior', () => canvas.press('1'));
  await select('wizard', () => wizard.click());
  await press('x', ref.action(5));
  await press('z', ref.undo());
  await press('r', ref.reset());
  assert.equal(await page.locator('#undo-button').isDisabled(), true);

  await visit(TUTORIAL_LEVEL);
  assert.equal(SS11_LEVELS[TUTORIAL_LEVEL - 1].title, 'La cour aux deux sorties');
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 12);
  assert.equal(await progress.textContent(), '0 / 12 découvertes');
  assert.equal(await page.locator('#ss11-source-link').getAttribute('href'), LEVEL_INFO[TUTORIAL_LEVEL - 1].url);
  await select('wizard', () => canvas.press('2'));
  assert.equal(await progress.textContent(), '1 / 12 découvertes');
  await press('z', ref.undo());
  assert.equal(await progress.textContent(), '1 / 12 découvertes');
  await press('r', ref.reset());
  assert.equal(await progress.textContent(), '0 / 12 découvertes');
  await button('#restart-button', ref.restart());
  assert.equal(await tutorial.isVisible(), false);

  if (!live) {
    const first = witnesses[0].actions[0];
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
      const expected = kind === 'mode' ? motion : kind === 'selectLevel' ? ref.selectLevel(4) : ref[kind]();
      const before = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 2, level: 4 };
      }, selector);
      await canvas.press(keys[start.id]);
      await settled(before + (kind === 'mode' ? 1 : 2), expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(request => request.type)), kind === 'mode' ? ['action'] : ['action', kind]);
      assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
      await page.waitForTimeout(250);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      if (kind === 'mode') await page.locator('#manual-tab').click();
    }
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
    console.log('SS11: manual interruptions and return from the generic agent verified');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await button('#restart-button', ref.restart());
    for (const { level, actions } of witnesses) {
      assert.equal(ref.observe().level, level);
      for (const [i, step] of actions.entries()) {
        if (level === 8 && i === actions.length - 1) {
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await capture();
          await act(step);
          const finale = await page.evaluate(() => window.qa.latest);
          await assertPaints(finale);
        } else await act(step);
        if (level === TUTORIAL_LEVEL && i === actions.length - 1) {
          assert.equal(await progress.textContent(), '12 / 12 découvertes');
        }
      }
    }
    assert.equal(ref.observe().state, 'WIN');
    assert.equal(await page.locator('#win-overlay').isVisible(), true);
    await press('z', ref.undo());
    assert.equal(await page.locator('#win-overlay').isVisible(), false);
    console.log('SS11: eight routes and twelve tutorial discoveries verified through the real interface');
  }

  for (const level of eight.map(Number)) await visit(level);
  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const card = section.locator('[data-gallery-game="SS11"]');
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
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  assert.deepEqual(pythonRequests, []);
  assert.deepEqual(errors, []);
  console.log('SS11: default level, level 7 tutorial, eight direct links and gallery tiles, credits, mobile and native loading verified');
} finally {
  await close();
}
