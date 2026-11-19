/** Verify the built SS08 Playground with its actual controls, worker and canvas. */
import assert from 'node:assert/strict';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss08/src/core.ts';
import { SS08_LEVELS } from '../experiments/sinking-star-ss08/src/levels.ts';
import { visibleHeroes } from '../experiments/sinking-star-ss08/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss08/tests/witnesses.json' with { type: 'json' };
import failures from '../experiments/sinking-star-ss08/tests/failures.json' with { type: 'json' };
import { assertNativeObservation, eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const live = process.argv.includes('--live');
const origin = new URL(process.env.SS08_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS08', live, successor: process.argv.includes('--successor') });

function targetCount(frame) {
  let count = 0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if ([frame[y][x], frame[y][x + 2], frame[y + 2][x], frame[y + 2][x + 2]].every(pixel => pixel === 11)) count++;
  }
  return count;
}

try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const roles = page.locator('#ss08-role-controls'), tutorial = page.locator('#ss08-tutorial');
  const merchant = roles.locator('[data-ss08-hero="merchant"]'), wizard = roles.locator('[data-ss08-hero="wizard"]');
  const defeat = page.locator('#native-defeat');
  const ref = new DuoPuzzleSession(SS08_LEVELS);
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
    assert.equal(await merchant.isVisible(), true);
    assert.equal(await wizard.isVisible(), true);
    assert.deepEqual(visibleHeroes(expected.frame).map(hero => hero.kind).sort(), ['merchant', 'wizard']);
    assert.equal(targetCount(expected.frame), 2);
  };


  assert.equal((await page.goto(origin + '/?game=SS08#playground')).status(), 200);
  await settled(1, ref.observe());
  await assertDuo(ref.observe());
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await tutorial.isVisible(), false);
  assert.equal(await merchant.getAttribute('aria-pressed'), 'true');
  const [width, height, rendering] = await canvas.evaluate(node => [node.width, node.height, getComputedStyle(node).imageRendering]);
  assert.deepEqual([width, height], [64, 64]);
  assert.match(rendering, /^(pixelated|crisp-edges)$/);
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  await select('wizard', pressPixel);
  assert.equal(await wizard.getAttribute('aria-pressed'), 'true');
  await select('merchant', () => canvas.press('Tab'));
  await select('wizard', () => canvas.press('2'));
  await select('merchant', () => canvas.press('1'));
  await select('wizard', () => wizard.click());
  const unchanged = await count();
  await canvas.press('2');
  assert.equal(await count(), unchanged);
  await canvas.press('Shift+Tab');
  assert.equal(await canvas.evaluate(node => document.activeElement === node), false);
  await press('z', ref.undo());
  await press('r', ref.reset());
  assert.equal(await page.locator('#undo-button').isDisabled(), true);

  await choose(4);
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 10);
  await tutorial.locator('summary').click();
  assert.equal(await tutorial.evaluate(node => node.open), false);
  await choose(1);
  await choose(4);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  await button('#restart-button', ref.restart());

  if (!live) {
    for (const { level, actions } of witnesses) {
      assert.equal(ref.observe().level, level);
      await assertDuo(ref.observe());
      if (level === 4) assert.equal(await tutorial.evaluate(node => node.open), true);
      for (const [turn, step] of actions.entries()) {
        if (level === 4 && step.id === 5 && turn === actions.findIndex(item => item.id === 5)) {
          await action(step, () => canvas.press('x'));
          await press('z', ref.undo());
          await action(step, () => page.locator('#space-button').click());
          await press('z', ref.undo());
        }
        const final = level === 8 && turn === actions.length - 1;
        if (final) await capture();
        const result = await action(step);
        if (level === 5 && turn === 14) {
          const box = await canvas.evaluate(node => Array.from(node.getContext('2d').getImageData(26, 32, 3, 3).data));
          const tile = result.frame.slice(32, 35).map(row => row.slice(26, 29));
          assert.deepEqual(tile, [[0, 5, 5], [7, 0, 5], [7, 7, 0]]);
          assert.equal(sha(Buffer.from(box)), pixelHash(tile, result.palette));
        }
        if (final) await assertPaints(result);
      }
      if (level === 4) assert.equal(await tutorial.locator('li.done').count(), 10);
    }
    assert.equal(ref.observe().state, 'WIN');
    assert.equal(await page.locator('#win-overlay').isVisible(), true);
    assert.equal(await page.locator('#space-button').isDisabled(), true);
    await press('z', ref.undo());
    assert.equal(await page.locator('#win-overlay').isVisible(), false);

    for (const { level, actions } of failures) {
      await choose(level);
      for (const step of actions.slice(0, -1)) await action(step);
      await capture();
      const outcome = await action(actions.at(-1));
      assert.equal(outcome.state, 'GAME_OVER');
      await assertPaints(outcome);
      assert.equal(await defeat.isVisible(), true);
      assert.match(await defeat.textContent(), /Un personnage a été perdu/);
      const dead = await count();
      await canvas.press('ArrowUp');
      await canvas.press('Space');
      await canvas.press('2');
      await page.locator('#agent-tab').click();
      assert.equal(await page.locator('#agent-step').isDisabled(), true);
      assert.equal(await count(), dead);
      await button('#native-defeat-undo', ref.undo());
    }
    console.log('SS08 witnesses, ten tutorial discoveries, mirror layering and terminal panels verified');
  }

  const selectInitialWizard = async () => {
    await choose(8);
    await assertDuo(ref.observe());
    return select('wizard', () => canvas.press('2'));
  };
  for (const id of [1, 2]) {
    const start = await selectInitialWizard();
    const north = [[4, 6], [8, 4], [13, 8], [8, 12], [4, 10]];
    const probes = id === 1 ? north : north.toReversed();
    await capture();
    const loop = await action({ id });
    assert.equal(loop.frames.length, 9);
    assert.deepEqual(loop.frameDurationsMs, [90, 90, 90, 90, 100, 100, 80, 100, 0]);
    assert.equal(loop.frameDurationsMs.reduce((sum, value) => sum + value, 0), 740);
    assert.deepEqual(visibleHeroes(loop.frame), visibleHeroes(start.frame));
    const { x, y } = visibleHeroes(loop.frame).find(hero => hero.kind === 'wizard');
    for (const i of [5, 7]) {
      for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        assert.equal(loop.frames[i][3 + y * 3 + dy][3 + x * 3 + dx], 0);
      }
    }
    for (const [i, [px, py]] of probes.entries()) assert.equal(loop.frames[i][3 + py * 3][3 + px * 3], 15);
    await assertPaints(loop);
    if (!live) {
      const repeated = await action({ id });
      assertNativeObservation(repeated, loop);
      await press('z', ref.undo());
      assert.equal(await boardHash(), pixelHash(start.frame, start.palette));
      await press('z', ref.undo());
      assert.equal(await page.locator('#undo-button').isDisabled(), true);
    }
  }

  if (!live) {
    for (const [selector, kind] of [['#undo-button', 'undo'], ['#reset-button', 'reset'], ['#restart-button', 'restart'], ['#level-select', 'selectLevel']]) {
      await selectInitialWizard();
      const before = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 2, level: 4 };
      }, selector);
      ref.action(1);
      const expected = kind === 'selectLevel' ? ref.selectLevel(4) : ref[kind]();
      await canvas.press('ArrowUp');
      await settled(before + 2, expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(r => r.type)), ['action', kind]);
      assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
      await page.waitForTimeout(210);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      assert.equal(await defeat.isVisible(), false);
    }
    await choose(8);
    for (const step of witnesses[7].actions.slice(0, 19)) await action(step);
    const waterStart = ref.observe();
    const water = frame => frame.slice(14, 17).map(row => row.slice(23, 26));
    for (let repeat = 0; repeat < 2; repeat++) {
      await capture();
      const refused = await action({ id: 1 });
      assert.equal(refused.frames.length, 1);
      assert.ok(refused.frameDurationsMs === undefined || refused.frameDurationsMs[0] === 0);
      assert.deepEqual(water(refused.frame), water(waterStart.frame));
      assert.deepEqual(visibleHeroes(refused.frame), visibleHeroes(waterStart.frame));
      await assertPaints(refused);
    }
    await press('z', ref.undo());
    assert.equal(await boardHash(), pixelHash(waterStart.frame, waterStart.palette));

    const start = await button('#restart-button', ref.restart());
    await page.locator('#agent-tab').click();
    await page.evaluate(() => {
      window.qa.requests.length = 0;
      window.qa.interrupted = null;
      window.qa.interruption = { selector: '#undo-button', paints: 0, at: 1, minFrames: 3, fromAgent: true };
    });
    for (let attempt = 0; attempt < 6; attempt++) {
      const before = await count();
      await page.locator('#agent-step').click();
      await ready(before + 1);
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
    const restored = ref.undo();
    await settled(await count(), restored);
    await page.waitForTimeout(210);
    assert.equal(await boardHash(), pixelHash(restored.frame, restored.palette));
    console.log('SS08 looping frames, water refusal, four manual interruptions and one agent interruption verified');
  }
  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const card = section.locator('[data-gallery-game="SS08"]');
  assert.deepEqual(await card.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  let galleryLevel;
  for (const level of eight) {
    await card.locator('[data-gallery-level]').selectOption(level);
    assert.equal(await card.locator('[data-gallery-launch]').getAttribute('href'), '/?game=SS08&level=' + level + '#playground');
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
  console.log('SS08 controls, both heroes in L8, eight actual gallery tiles and links, mobile layout, Steam credit and native loading verified');
} finally {
  await close();
}
