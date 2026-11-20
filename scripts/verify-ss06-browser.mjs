/** Exercise the built Playground through its documented controls and public worker observations. */
import assert from 'node:assert/strict';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss06/src/core.ts';
import { SS06_LEVELS } from '../experiments/sinking-star-ss06/src/levels.ts';
import { visibleHeroes } from '../experiments/sinking-star-ss06/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss06/tests/witnesses.json' with { type: 'json' };
import failures from '../experiments/sinking-star-ss06/tests/failures.json' with { type: 'json' };

import { eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const origin = new URL(process.env.SS06_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const live = process.argv.includes('--live');
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS06', live, successor: process.argv.includes('--successor') });
try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const tutorial = page.locator('#ss06-tutorial'), roles = page.locator('#ss06-role-controls');
  const warrior = roles.locator('[data-ss06-hero="warrior"]');
  const merchant = roles.locator('[data-ss06-hero="merchant"]');
  const defeat = page.locator('#native-defeat');
  const reference = new DuoPuzzleSession(SS06_LEVELS);
  const count = () => page.evaluate(() => window.qa.count);
  const latest = () => page.evaluate(() => window.qa.latest);
  const settled = async (minimum, expected) => {
    await page.waitForFunction(n => window.qa.count >= n && document.querySelector('#game-availability').textContent === 'Ready'
      && document.querySelector('#game-canvas').getAttribute('aria-busy') === 'false', minimum, { timeout: 15000 });
    const actual = await latest();
    assert.deepEqual(actual, expected);
    return actual;
  };
  const operate = async (fn, expected) => {
    const n = await count();
    await fn();
    return settled(n + 1, expected);
  };
  const choose = level => operate(() => levels.selectOption(String(level)), reference.selectLevel(level));
  const withKey = (key, expected) => operate(() => canvas.press(key), expected);
  const withButton = (selector, expected) => operate(() => page.locator(selector).click(), expected);
  const pressPixel = async ({ x, y }) => {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + (x + 0.5) * box.width / 64, box.y + (y + 0.5) * box.height / 64);
  };
  const selectRole = (kind, gesture) => {
    const hero = visibleHeroes(reference.observe().frame).find(candidate => candidate.kind === kind);
    assert.ok(hero);
    const data = { x: 3 + 3 * hero.x, y: 3 + 3 * hero.y };
    return operate(() => gesture(data), reference.action(6, data));
  };
  const action = ({ id, data }, mirror = 'Space') => operate(
    () => id === 6 ? pressPixel(data) : canvas.press(id === 5 ? mirror : keys[id]), reference.action(id, data),
  );
  const fileRoute = level => origin + '/?game=SS06' + (level ? '&level=' + level : '') + '#playground';
  const boardHash = async () => sha(Buffer.from(await canvas.evaluate(node => Array.from(node.getContext('2d').getImageData(0, 0, 64, 64).data))));
  const isSolo = async () => {
    assert.equal(await roles.isVisible(), false);
    assert.equal(await page.locator('#ss06-cooperation-help').isVisible(), false);
    assert.equal(await page.locator('#ss06-platform-help').isVisible(), true);
    assert.equal(await page.locator('#ss06-piston-help').isVisible(), false);
    assert.match(await page.locator('#ss06-objective').textContent(), /l’unique contour jaune/);
  };

  assert.equal((await page.goto(fileRoute())).status(), 200);
  await settled(1, reference.observe());
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 8);
  assert.equal(await merchant.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  await selectRole('warrior', pressPixel);
  assert.equal(await warrior.getAttribute('aria-pressed'), 'true');
  await selectRole('merchant', () => canvas.press('Tab'));
  await selectRole('warrior', () => canvas.press('2'));
  await selectRole('merchant', () => canvas.press('1'));
  await selectRole('warrior', () => warrior.click());
  const unchanged = await count();
  await canvas.press('2');
  assert.equal(await count(), unchanged);
  await canvas.press('Shift+Tab');
  assert.equal(await canvas.evaluate(node => document.activeElement === node), false);
  await withKey('z', reference.undo());
  await withKey('r', reference.reset());
  assert.equal(await page.locator('#undo-button').isDisabled(), true);

  if (!live) {
    for (const step of witnesses[0].actions) await action(step);
    assert.equal(await tutorial.locator('li.done').count(), 8);
    assert.equal((await latest()).level, 2);
    const lethal = failures[0].actions;
    const prepareCombat = async () => {
      await choose(6);
      for (const step of lethal.slice(0, -1)) await action(step);
    };
    const last = lethal.at(-1);
    for (const [selector, command] of [['#undo-button', 'undo'], ['#reset-button', 'reset'], ['#restart-button', 'restart'], ['#level-select', 'selectLevel']]) {
      await prepareCombat();
      const before = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 5 };
      }, selector);
      const terminal = reference.action(last.id, last.data);
      assert.equal(terminal.frames.length, 8);
      const expected = command === 'selectLevel' ? reference.selectLevel(8) : reference[command]();
      await canvas.press(keys[last.id]);
      await settled(before + 2, expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(request => request.type)), ['action', command]);
      assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
      await page.waitForTimeout(335);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      assert.equal(await defeat.isVisible(), false);
    }
    await prepareCombat();
    await page.evaluate(() => { window.qa.paints = []; });
    const terminal = await action(last);
    const paints = await page.evaluate(() => { const frames = window.qa.paints; delete window.qa.paints; return frames; });
    assert.equal(terminal.state, 'GAME_OVER');
    assert.deepEqual(terminal.frameDurationsMs, [60, 80, 40, 80, 90, 100, 110, 0]);
    assert.equal(paints.length, terminal.frames.length + 1);
    for (const [index, frame] of [...terminal.frames, terminal.frame].entries()) {
      assert.equal(sha(Buffer.from(paints[index].rgba)), pixelHash(frame, terminal.palette));
      assert.equal(paints[index].defeatHidden, true);
      assert.equal(paints[index].victoryHidden, true);
    }
    assert.match(await defeat.textContent(), /Un personnage a été perdu/);
    assert.equal(await defeat.isVisible(), true);
    const dead = await count();
    await canvas.press('ArrowUp');
    await canvas.press('Space');
    await page.locator('#agent-tab').click();
    assert.equal(await page.locator('#agent-step').isDisabled(), true);
    assert.equal(await count(), dead);
    await withButton('#native-defeat-undo', reference.undo());
    console.log('Eight tutorial discoveries, combat frames and all four animation interruptions verified');
  }

  await choose(8);
  await isSolo();
  assert.equal(visibleHeroes((await latest()).frame).filter(hero => hero.kind === 'warrior').length, 1);
  const initialSolo = reference.observe();
  const beforeSoloKeys = await count();
  await canvas.press('1');
  await canvas.press('2');
  await canvas.press('Tab');
  assert.equal(await count(), beforeSoloKeys);
  if (!live) {
    const route = witnesses[7].actions;
    for (const step of route.slice(0, 17)) await action(step);
    const reflection = route[17];
    assert.equal(reflection.id, 5);
    await action(reflection, 'x');
    await withKey('z', reference.undo());
    await withButton('#space-button', reference.action(5));
    for (const step of route.slice(18)) await action(step);
    assert.match(await page.locator('#game-feedback').textContent(), /La destination est atteinte/);
    assert.notEqual((await latest()).level, 8);
    await withKey('z', reference.undo());
    await isSolo();
  } else {
    await action(witnesses[7].actions[0]);
    await withKey('z', reference.undo());
    assert.deepEqual(await latest(), initialSolo);
  }
  await choose(7);
  assert.equal(await roles.isVisible(), true);
  assert.equal(await merchant.getAttribute('aria-pressed'), 'true');
  await withButton('#restart-button', reference.restart());
  if (!live) {
    await page.locator('#agent-tab').click();
    const beforeAgent = await count();
    await page.locator('#agent-step').click();
    await page.waitForFunction(n => window.qa.count > n, beforeAgent, { timeout: 30000 });
    const request = await page.evaluate(() => window.qa.requests.at(-1));
    assert.equal(request.type, 'action');
    assert.ok(reference.observe().availableActionIds.includes(request.actionId));
    await settled(beforeAgent + 1, reference.action(request.actionId, request.data));
    console.log('SRA completed one public action through the native runtime');
  }

  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  const card = section.locator('[data-gallery-game="SS06"]');
  assert.deepEqual(await card.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  await card.locator('[data-gallery-level]').selectOption('8');
  assert.match(await card.locator('[data-gallery-launch]').getAttribute('href'), /game=SS06&level=8/);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const preview = card.locator('[data-gallery-frame]');
  const previewBytes = await preview.evaluate(async node => {
    const image = node.querySelector('img');
    image.loading = 'eager';
    await image.decode();
    const { naturalWidth, naturalHeight } = image;
    const row = Number(node.style.getPropertyValue('--atlas-row'));
    const column = Number(node.style.getPropertyValue('--atlas-column'));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, column * 64, row * 64, 64, 64, 0, 0, 64, 64);
    return { naturalWidth, naturalHeight, rgba: Array.from(ctx.getImageData(0, 0, 64, 64).data) };
  });
  const galleryLevel = new DuoPuzzleSession(SS06_LEVELS).selectLevel(8);
  assert.deepEqual([previewBytes.naturalWidth, previewBytes.naturalHeight], [512, groups.length * 64]);
  assert.equal(sha(Buffer.from(previewBytes.rgba)), pixelHash(galleryLevel.frame, galleryLevel.palette));
  await card.locator('[data-gallery-launch]').click();
  await settled(1, galleryLevel);
  await isSolo();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  assert.deepEqual(pythonRequests, []);
  assert.deepEqual(errors, []);
  console.log('SS06 controls, solo level, gallery launch, mobile layout, Steam credit and native-only loading verified');
} finally {
  await close();
}
