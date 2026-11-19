/** Verify the built SS07 Playground with its actual controls, worker and canvas. */
import assert from 'node:assert/strict';
import { DuoPuzzleSession } from '../experiments/sinking-star-ss07/src/core.ts';
import { SS07_LEVELS } from '../experiments/sinking-star-ss07/src/levels.ts';
import { visibleHeroes } from '../experiments/sinking-star-ss07/src/tutorial.ts';
import witnesses from '../experiments/sinking-star-ss07/tests/witnesses.json' with { type: 'json' };
import failures from '../experiments/sinking-star-ss07/tests/failures.json' with { type: 'json' };
import { eight, groups, keys, openNativeBrowser, pixelHash, sha } from './native-browser-checks.mjs';

const live = process.argv.includes('--live');
const origin = new URL(process.env.SS07_TEST_URL ?? 'http://127.0.0.1:4174').origin;
const { page, pythonRequests, errors, close } = await openNativeBrowser({ origin, game: 'SS07', live, successor: process.argv.includes('--successor') });

function assertObservation(actual, expected) {
  const { frame: af, frames: as, ...publicData } = actual;
  const { frame: ef, frames: es, ...referenceData } = expected;
  assert.deepEqual(publicData, referenceData);
  assert.equal(sha(Buffer.from(af.flat())), sha(Buffer.from(ef.flat())), 'Settled pixels');
  assert.equal(as.length, es.length);
  assert.equal(sha(Buffer.from(as.flat(2))), sha(Buffer.from(es.flat(2))), 'Animation pixels');
}

function targetCount(frame) {
  let count = 0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if ([frame[y][x], frame[y][x + 2], frame[y + 2][x], frame[y + 2][x + 2]].every(pixel => pixel === 11)) count++;
  }
  return count;
}

try {
  const canvas = page.locator('#game-canvas'), levels = page.locator('#level-select');
  const roles = page.locator('#ss07-role-controls'), tutorial = page.locator('#ss07-tutorial');
  const merchant = roles.locator('[data-ss07-hero="merchant"]'), thief = roles.locator('[data-ss07-hero="thief"]');
  const defeat = page.locator('#native-defeat');
  const ref = new DuoPuzzleSession(SS07_LEVELS);
  const count = () => page.evaluate(() => window.qa.count);
  const ready = minimum => page.waitForFunction(n => window.qa.count >= n
    && document.querySelector('#game-canvas').getAttribute('aria-busy') === 'false'
    && document.querySelector('#game-availability').textContent === 'Ready', minimum, { timeout: 20000 });
  const settled = async (minimum, expected) => {
    await ready(minimum);
    assertObservation(await page.evaluate(() => window.qa.latest), expected);
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
    assert.equal(await thief.isVisible(), true);
    assert.deepEqual(visibleHeroes(expected.frame).map(hero => hero.kind).sort(), ['merchant', 'thief']);
    assert.equal(targetCount(expected.frame), 2);
  };

  assert.equal((await page.goto(origin + '/?game=SS07#playground')).status(), 200);
  await settled(1, ref.observe());
  await assertDuo(ref.observe());
  assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
  assert.equal(await tutorial.isVisible(), true);
  assert.equal(await tutorial.evaluate(node => node.open), true);
  assert.equal(await tutorial.locator('li').count(), 9);
  assert.equal(await merchant.getAttribute('aria-pressed'), 'true');
  const [width, height, rendering] = await canvas.evaluate(node => [node.width, node.height, getComputedStyle(node).imageRendering]);
  assert.deepEqual([width, height], [64, 64]);
  assert.match(rendering, /^(pixelated|crisp-edges)$/);
  assert.equal(await page.locator('#space-button').textContent(), 'Reflet');
  assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(items => items.map(item => item.value)), groups);
  assert.deepEqual(await levels.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  assert.match(await page.locator('#board-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  await select('thief', pressPixel);
  assert.equal(await thief.getAttribute('aria-pressed'), 'true');
  await select('merchant', () => canvas.press('Tab'));
  await select('thief', () => canvas.press('2'));
  await select('merchant', () => canvas.press('1'));
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
    let checkedMirror = false;
    for (const step of witnesses[0].actions) {
      if (step.id === 5 && !checkedMirror) {
        await action(step, () => canvas.press('x'));
        await press('z', ref.undo());
        await action(step, () => page.locator('#space-button').click());
        await press('z', ref.undo());
        checkedMirror = true;
      }
      await action(step);
    }
    assert.equal(await tutorial.locator('li.done').count(), 9);
    assert.equal(ref.observe().level, 2);

    for (const { level, actions } of failures) {
      await choose(level);
      const last = actions.at(-1);
      for (const step of actions.slice(0, -1)) {
        // The L7 loss route also crosses the mutual monster combat.
        if (level === 7 && step === actions[38]) {
          await capture();
          const combat = await action(step);
          assert.ok(combat.frames.length >= 11);
          await assertPaints(combat);
        } else await action(step);
      }
      await capture();
      const terminal = await action(last);
      assert.equal(terminal.state, 'GAME_OVER');
      await assertPaints(terminal);
      assert.match(await defeat.textContent(), /Un personnage a été perdu/);
      assert.equal(await defeat.isVisible(), true);
      const dead = await count();
      await canvas.press('ArrowUp');
      await canvas.press('Space');
      await canvas.press('2');
      await page.locator('#agent-tab').click();
      assert.equal(await page.locator('#agent-step').isDisabled(), true);
      assert.equal(await count(), dead);
      await button('#native-defeat-undo', ref.undo());
    }

    const lethal = failures[0];
    for (const [selector, kind] of [['#undo-button', 'undo'], ['#reset-button', 'reset'], ['#restart-button', 'restart'], ['#level-select', 'selectLevel']]) {
      await choose(lethal.level);
      for (const step of lethal.actions.slice(0, -1)) await action(step);
      const last = lethal.actions.at(-1), before = await count();
      await page.evaluate(selector => {
        window.qa.requests.length = 0;
        window.qa.interruption = { selector, paints: 0, at: 2 };
      }, selector);
      ref.action(last.id, last.data);
      const expected = kind === 'selectLevel' ? ref.selectLevel(8) : ref[kind]();
      await canvas.press(keys[last.id]);
      await settled(before + 2, expected);
      assert.deepEqual(await page.evaluate(() => window.qa.requests.map(r => r.type)), ['action', kind]);
      assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
      await page.waitForTimeout(260);
      assert.equal(await boardHash(), pixelHash(expected.frame, expected.palette));
      assert.equal(await defeat.isVisible(), false);
    }
    console.log('SS07 tutorial, three defeats, full combat and four manual interruptions verified');

    const start = await button('#restart-button', ref.restart());
    await page.locator('#agent-tab').click();
    await page.evaluate(() => {
      window.qa.requests.length = 0;
      window.qa.interrupted = null;
      window.qa.interruption = { selector: '#undo-button', paints: 0, at: 1, minFrames: 3, fromAgent: true };
    });
    let interruptedAgent = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const before = await count();
      await page.locator('#agent-step').click();
      await ready(before + 1);
      if (await page.evaluate(() => Boolean(window.qa.interrupted))) {
        interruptedAgent = true;
        break;
      }
    }
    assert.ok(interruptedAgent, 'An animated SRA action should be interruptible');
    const requests = await page.evaluate(() => window.qa.requests);
    assert.equal(requests.at(-1).type, 'undo');
    assert.deepEqual(await page.evaluate(() => window.qa.interrupted), { busy: 'true', controlEnabled: true });
    for (const request of requests.slice(0, -1)) {
      assert.equal(request.type, 'action');
      assert.ok(start.availableActionIds.includes(request.actionId));
      ref.action(request.actionId, request.data);
    }
    const restored = ref.undo();
    await settled(await count(), restored);
    await page.waitForTimeout(260);
    assert.equal(await boardHash(), pixelHash(restored.frame, restored.palette));
    assert.equal(await page.locator('#manual-tab').getAttribute('aria-selected'), 'true');
    console.log('One animated SRA action was interrupted by Undo through the manual controls');
  }

  await choose(8);
  await assertDuo(ref.observe());
  assert.equal(await page.locator('#ss07-platform-help').isVisible(), true);
  await select('thief', () => canvas.press('2'));
  await press('z', ref.undo());
  if (!live) {
    for (const step of witnesses[7].actions.slice(0, 83)) await action(step);
    const last = ref.observe();
    assert.equal(last.state, 'NOT_FINISHED');
    await assertDuo(last);
    await press('z', ref.undo());
    await action(witnesses[7].actions[82]);
    assert.equal(await boardHash(), pixelHash(last.frame, last.palette));
  }
  await button('#restart-button', ref.restart());

  await page.goto(origin + (live ? '/gallery' : '/gallery.html'));
  const section = page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards => cards.map(card => card.dataset.galleryGame)), groups);
  assert.match(await section.locator('.gallery-source-credit a').getAttribute('href'), /^https:\/\/store\.steampowered\.com\//);
  const card = section.locator('[data-gallery-game="SS07"]');
  assert.deepEqual(await card.locator('option').evaluateAll(items => items.map(item => item.value)), eight);
  let galleryLevel;
  for (const level of eight) {
    await card.locator('[data-gallery-level]').selectOption(level);
    assert.equal(await card.locator('[data-gallery-launch]').getAttribute('href'), '/?game=SS07&level=' + level + '#playground');
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
  console.log('SS07 controls, both heroes in L8, eight actual gallery tiles and links, mobile layout, Steam credit and native loading verified');
} finally {
  await close();
}
