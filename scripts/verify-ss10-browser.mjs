/** Verify the built SS10 Playground with its actual controls, worker and canvas. */
import assert from 'node:assert/strict';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss10/src/core.ts';
import { LEVEL_INFO } from '../experiments/sinking-star-ss10/src/level-info.ts';
import { SS10_LEVELS } from '../experiments/sinking-star-ss10/src/levels.ts';
import { visibleHeroes } from '../experiments/sinking-star-ss10/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss10/tests/witnesses.json' with { type: 'json' };
import failures from '../experiments/sinking-star-ss10/tests/failures.json' with { type: 'json' };
import { assertNativeObservation, eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const live = process.argv.includes('--live');
const origin = new URL(process.env.SS10_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS10', live, successor: process.argv.includes('--successor') });

function targetCount(frame) {
  let count = 0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if ([frame[y][x], frame[y][x + 2], frame[y + 2][x], frame[y + 2][x + 2]].every(pixel => pixel === 11)) count++;
  }
  return count;
}

try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const roles = page.locator('#ss10-role-controls'), tutorial = page.locator('#ss10-tutorial');
  const warrior = roles.locator('[data-ss10-hero="warrior"]'), thief = roles.locator('[data-ss10-hero="thief"]');
  const defeat = page.locator('#native-defeat');
  const ref = new DuoPuzzleSession(SS10_LEVELS);
  const count = () => page.evaluate(() => window.qa.count);
  const ready = minimum => page.waitForFunction(n => window.qa.count >= n
    && document.querySelector('#game-canvas').getAttribute('aria-busy') === 'false'
    && document.querySelector('#game-availability').textContent === 'Ready', minimum, { timeout: 20000 });
  const settled = async (minimum, expected) => {
    await ready(minimum);
    assertNativeObservation(await page.evaluate(() => window.qa.latest), expected);
    return expected;
  };
  const operate = async (gesture, expected) => {
    const before = await count();
    await gesture();
    return settled(before + 1, expected);
  };
  const button = (selector, expected) => operate(() => page.locator(selector).click(), expected);
  const choose = level => operate(() => levels.selectOption(String(level)), ref.selectLevel(level));
  const press = (key, expected) => operate(() => canvas.press(key), expected);
  const pressPixel = async ({ x, y }) => {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    assert.ok(box);
    await page.mouse.click(box.x + (x + 0.5) * box.width / 64, box.y + (y + 0.5) * box.height / 64);
  };
  const select = (kind, gesture) => {
    const hero = visibleHeroes(ref.observe().frame).find(candidate => candidate.kind === kind);
    assert.ok(hero);
    const data = { x: 3 + 3 * hero.x, y: 3 + 3 * hero.y };
    return operate(() => gesture(data), ref.action(6, data));
  };
  const action = ({ id, data }, reflect = () => canvas.press('Space')) => operate(
    () => id === 6 ? pressPixel(data) : id === 5 ? reflect() : canvas.press(keys[id]),
    ref.action(id, data),
  );
  const boardHash = async () => sha(Buffer.from(await canvas.evaluate(node =>
    Array.from(node.getContext('2d').getImageData(0, 0, 64, 64).data))));
  const capture = () => page.evaluate(() => { window.qa.paints = []; });
  const assertPaints = async expected => {
    const paints = await page.evaluate(() => { const result = window.qa.paints; delete window.qa.paints; return result; });
    assert.equal(paints.length, expected.frames.length + 1);
    for (const [i, frame] of [...expected.frames, expected.frame].entries()) {
      assert.equal(sha(Buffer.from(paints[i].rgba)), pixelHash(frame, expected.palette));
      assert.equal(paints[i].defeatHidden, true);
      assert.equal(paints[i].victoryHidden, true);
    }
  };
  const assertDuo = async expected => {
    assert.equal(await warrior.isVisible(), true);
    assert.equal(await thief.isVisible(), true);
    assert.deepEqual(visibleHeroes(expected.frame).map(hero => hero.kind).sort(), ['thief', 'warrior']);
    assert.equal(targetCount(expected.frame), 2);
  };



  const visit = async (level = 1) => {
    const url = origin + '/?game=SS10' + (level === 1 ? '' : '&level=' + level) + '#playground';
    assert.equal((await page.goto(url)).status(), 200);
    ref.restart();
    return settled(1, ref.selectLevel(level));
  };
  const spec = SS10_LEVELS[7];
  assert.deepEqual([spec.rows[0].length, spec.rows.length], [13, 9]);
  assert.equal(spec.rows.join('').split('o').length - 1, 5);
  const ox = Math.floor((20 - spec.rows[0].length) / 2), oy = Math.floor((20 - spec.rows.length) / 2);
  const finaleSupports = [[2, 4], [3, 3], [3, 6], [6, 7], [2, 7]].map(([x, y]) =>
    [2 + 3 * (x + ox), 2 + 3 * (y + oy)]);
  const opening = await visit();
  await assertDuo(opening);
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 12);
  assert.equal(await warrior.getAttribute('aria-pressed'), 'true');
  const [width, height, rendering] = await canvas.evaluate(node => [node.width, node.height, getComputedStyle(node).imageRendering]);
  assert.deepEqual([width, height], [64, 64]);
  assert.match(rendering, /^(pixelated|crisp-edges)$/);
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);

  const initialSelection = await select('thief', pressPixel);
  assert.equal(await thief.getAttribute('aria-pressed'), 'true');
  assert.equal(await warrior.getAttribute('aria-pressed'), 'false');
  const recorded = await page.evaluate(() => window.qa.requests.at(-1));
  assert.equal(recorded.type, 'action');
  assert.equal(recorded.actionId, 6);
  assert.ok([recorded.data.x, recorded.data.y].every(value => Number.isInteger(value) && value >= 0 && value < 64));
  await press('z', ref.undo());
  assertNativeObservation(await action({ id: recorded.actionId, data: recorded.data }), initialSelection);
  await select('warrior', () => canvas.press('Tab'));
  await select('thief', () => canvas.press('2'));
  await select('warrior', () => canvas.press('1'));
  await select('thief', () => thief.click());
  const unchanged = await count();
  await canvas.press('2');
  assert.equal(await count(), unchanged);
  await canvas.press('Shift+Tab');
  assert.equal(await canvas.evaluate(node => document.activeElement === node), false);
  await press('z', ref.undo());
  await press('r', ref.reset());
  assert.equal(await page.locator('#undo-button').isDisabled(), true);

  if (!live) {
    for (const { level, actions } of witnesses) {
      assert.equal(ref.observe().level, level);
      const info = LEVEL_INFO[level - 1];
      assert.equal(await page.locator('#ss10-objective').textContent(), info.objective);
      assert.equal(await page.locator('#ss10-source-label').textContent(), info.label);
      if (info.url) assert.equal(await page.locator('#ss10-source-link').getAttribute('href'), info.url);
      else assert.equal(await page.locator('#ss10-source-link').isVisible(), false);
      await assertDuo(ref.observe());
      for (const [turn, step] of actions.entries()) {
        if (level === 1 && step.id === 5 && turn === actions.findIndex(candidate => candidate.id === 5)) {
          await action(step, () => canvas.press('x'));
          await press('z', ref.undo());
          await action(step, () => page.locator('#space-button').click());
          await press('z', ref.undo());
        }
        const final = level === 8 && turn === actions.length - 1;
        if (final) await capture();
        const observed = await action(step);
        if (final) {
          await assertPaints(observed);
          for (const [x, y] of finaleSupports) {
            const data = await canvas.evaluate((node, [x, y]) => Array.from(node.getContext('2d').getImageData(x, y, 3, 3).data), [x, y]);
            assert.equal(sha(Buffer.from(data)), pixelHash([[10, 13, 10], [13, 10, 13], [10, 13, 10]], observed.palette));
          }
        }
      }
      if (level === 1) {
        assert.equal(await tutorial.locator('li.done').count(), 12);
        console.log('SS10: all twelve discoveries reached using the real keyboard and canvas');
      }
    }
    assert.equal(ref.observe().state, 'WIN');
    assert.equal(await page.locator('#win-overlay').isVisible(), true);
    assert.equal(await page.locator('#space-button').isDisabled(), true);
    await press('z', ref.undo());
    assert.equal(await page.locator('#win-overlay').isVisible(), false);
    console.log('SS10: all eight witnesses passed, including the final animation and victory');

    for (const { level, actions } of failures) {
      await choose(level);
      for (const step of actions.slice(0, -1)) await action(step);
      await capture();
      const dead = await action(actions.at(-1));
      assert.equal(dead.state, 'GAME_OVER');
      await assertPaints(dead);
      assert.equal(await defeat.isVisible(), true);
      const before = await count();
      await canvas.press('ArrowUp');
      await canvas.press('Space');
      await page.locator('#agent-tab').click();
      assert.equal(await page.locator('#agent-step').isDisabled(), true);
      assert.equal(await count(), before);
      await button('#native-defeat-undo', ref.undo());
    }

    await choose(5);
    const commands = { L: 3, U: 1, D: 2 };
    for (const symbol of 'LLUULC') {
      if (symbol === 'C') await select('thief', () => canvas.press('Tab'));
      else await action({ id: commands[symbol] });
    }
    const preMove = ref.observe();
    await action({ id: 2 });
    const beforeWarning = ref.observe();
    await capture();
    const warning = await action({ id: 5 });
    assert.equal(warning.frames.length, 4);
    assert.deepEqual(warning.frameDurationsMs, [110, 70, 110, 0]);
    assert.equal(pixelHash(warning.frame, warning.palette), pixelHash(beforeWarning.frame, beforeWarning.palette));
    await assertPaints(warning);
    assert.match(await page.locator('#game-feedback').textContent(), /clignote en rouge/);
    const changedMirrors = new Set();
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (warning.frames[0][y][x] === beforeWarning.frame[y][x]) continue;
      assert.deepEqual([beforeWarning.frame[y][x], warning.frames[0][y][x]], [5, 8]);
      changedMirrors.add(Math.floor((y - 2) / 3) * 20 + Math.floor((x - 2) / 3));
    }
    assert.equal(changedMirrors.size, 2);
    await capture();
    assertNativeObservation(await action({ id: 5 }), warning);
    await assertPaints(warning);
    const before = await count();
    await page.evaluate(() => {
      window.qa.requests.length = 0;
      window.qa.interruption = { selector: '#undo-button', paints: 0, at: 2 };
    });
    ref.action(5);
    const restored = ref.undo();
    assertNativeObservation(restored, preMove);
    await canvas.press('Space');
    await settled(before + 2, restored);
    assert.deepEqual(await page.evaluate(() => window.qa.requests.map(request => request.type)), ['action', 'undo']);
    assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
    await page.waitForTimeout(220);
    assert.equal(await boardHash(), pixelHash(restored.frame, restored.palette));

    const lethal = failures[0];
    for (const [selector, kind] of [['#reset-button', 'reset'], ['#restart-button', 'restart'], ['#level-select', 'selectLevel']]) {
      await choose(lethal.level);
      for (const step of lethal.actions.slice(0, -1)) await action(step);
      const last = lethal.actions.at(-1);
      const countBefore = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 2, level: 4 };
      }, selector);
      ref.action(last.id, last.data);
      const expected = kind === 'selectLevel' ? ref.selectLevel(4) : ref[kind]();
      await canvas.press(keys[last.id]);
      await settled(countBefore + 2, expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(request => request.type)), ['action', kind]);
      await page.waitForTimeout(220);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      assert.equal(await defeat.isVisible(), false);
    }
    console.log('SS10: terminal effects, mirror warning, repeated playback and four manual interruptions passed');

    const start = await button('#restart-button', ref.restart());
    await page.locator('#agent-tab').click();
    await page.evaluate(() => {
      window.qa.requests.length = 0;
      window.qa.interrupted = null;
      window.qa.interruption = { selector: '#undo-button', paints: 0, at: 1, minFrames: 3, fromAgent: true };
    });
    for (let attempt = 0; attempt < 6; attempt++) {
      const countBefore = await count();
      await page.locator('#agent-step').click();
      await ready(countBefore + 1);
      if (await page.evaluate(() => Boolean(window.qa.interrupted))) break;
    }
    const requests = await page.evaluate(() => window.qa.requests);
    assert.equal(requests.at(-1).type, 'undo');
    assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
    assert.equal(await page.evaluate(() => window.qa.agentStepDisabled), true);
    for (const request of requests.slice(0, -1)) {
      assert.equal(request.type, 'action');
      assert.ok(start.availableActionIds.includes(request.actionId));
      ref.action(request.actionId, request.data);
    }
    const restoredAgent = ref.undo();
    await settled(await count(), restoredAgent);
    await page.waitForTimeout(220);
    assert.equal(await boardHash(), pixelHash(restoredAgent.frame, restoredAgent.palette));
    console.log('SS10: the generic SRA sent a native action and Undo interrupted its animation');
  }

  // Verify direct level URLs in addition to the links on the gallery card.
  for (const level of [1, 6, 8]) {
    const observed = await visit(level);
    await assertDuo(observed);
    assert.equal(await tutorial.isVisible(), level === 1);
    if (level === 6) assert.equal(SS10_LEVELS[level - 1].title, 'Le dernier changement de sens');
    if (level === 8) {
      assert.match(await page.locator('#ss10-source-label').textContent(), /Heroes and Water.*énigme 3/);
      assert.match(await page.locator('#ss10-objective').textContent(), /cinq appuis/);
      for (const [x, y] of finaleSupports) assert.equal(observed.frame[y + 1][x + 1], 9);
    }
  }
  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const card = section.locator('[data-gallery-game="SS10"]');
  assert.deepEqual(await card.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  let galleryLevel;
  for (const level of eight) {
    await card.locator('[data-gallery-level]').selectOption(level);
    assert.equal(await card.locator('[data-gallery-launch]').getAttribute('href'), '/?game=SS10&level=' + level + '#playground');
    const tile = await card.locator('[data-gallery-frame]').evaluate(async node => {
      const image = node.querySelector('img');
      image.loading = 'eager';
      await image.decode();
      const row = Number(node.style.getPropertyValue('--atlas-row'));
      const column = Number(node.style.getPropertyValue('--atlas-column'));
      const sample = document.createElement('canvas');
      sample.width = sample.height = 64;
      const ctx = sample.getContext('2d');
      ctx.drawImage(image, column * 64, row * 64, 64, 64, 0, 0, 64, 64);
      return { dimensions: [image.naturalWidth, image.naturalHeight], rgba: Array.from(ctx.getImageData(0, 0, 64, 64).data) };
    });
    galleryLevel = ref.selectLevel(Number(level));
    assert.deepEqual(tile.dimensions, [512, groups.length * 64]);
    assert.equal(sha(Buffer.from(tile.rgba)), pixelHash(galleryLevel.frame, galleryLevel.palette), 'Gallery tile ' + level);
  }
  await card.locator('[data-gallery-launch]').click();
  await settled(1, galleryLevel);
  await assertDuo(galleryLevel);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  assert.deepEqual(pythonRequests, []);
  assert.deepEqual(errors, []);
  console.log('SS10 controls, both heroes in L8, eight actual gallery tiles and links, mobile layout, Steam credit and native loading verified');
} finally {
  await close();
}
