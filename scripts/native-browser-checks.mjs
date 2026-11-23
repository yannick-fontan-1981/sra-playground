import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GAME_CATALOG } from '../src/games/catalog.ts';

export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const pixelHash = (frame, palette) => sha(Buffer.from(frame.flat().flatMap(color => [...Buffer.from(palette[color].slice(1), 'hex'), 255])));
export const groups = GAME_CATALOG.filter(game => game.group === 'custom_4').map(game => game.code);
export const eight = Array.from({ length: 8 }, (_, i) => String(i + 1));
export const keys = { 1: 'ArrowUp', 2: 'ArrowDown', 3: 'ArrowLeft', 4: 'ArrowRight', 5: 'Space' };

export function assertNativeObservation(actual, expected) {
  const { frame: actualFrame, frames: actualFrames, ...actualData } = actual;
  const { frame: expectedFrame, frames: expectedFrames, ...expectedData } = expected;
  assert.deepEqual(actualData, expectedData);
  assert.equal(sha(Buffer.from(actualFrame.flat())), sha(Buffer.from(expectedFrame.flat())), 'Settled pixels');
  assert.equal(actualFrames.length, expectedFrames.length);
  assert.equal(sha(Buffer.from(actualFrames.flat(2))), sha(Buffer.from(expectedFrames.flat(2))), 'Animation pixels');
}

async function liveHeaders({ origin, game, successor }) {
  const headers = {};
  process.stdin.setEncoding('utf8');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  console.log('Ready for Site verification credential on stdin (input is hidden).');
  let input = '';
  while (!/[\r\n]/.test(input)) {
    const [chunk] = await once(process.stdin, 'data');
    if (chunk.includes('\u0003')) process.exit(130);
    input += chunk;
  }
  process.stdin.pause();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  headers['OAI-Sites-Authorization'] = 'Bearer ' + input.trim();
  const dist = new URL('../dist/', import.meta.url);
  const index = (await readFile(new URL('index.html', dist), 'utf8')).match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1];
  assert.ok(index);
  const worker = (await readFile(new URL(index, dist), 'utf8')).match(/assets\/game-worker-[\w-]+\.js/)?.[0];
  assert.ok(worker);
  if (!successor) {
    const home = await fetch(origin + '/?game=' + game, { headers, redirect: 'error', cache: 'no-store' });
    assert.equal(home.status, 200);
    assert.equal((await home.text()).match(/src="\/(assets\/index-[^"]+\.js)"/)?.[1], index);
  }
  const assets = successor ? [worker, 'gallery/custom_4.png'] : [index, worker, 'gallery/custom_4.png'];
  for (const asset of assets) {
    const response = await fetch(origin + '/' + asset, { headers, redirect: 'error', cache: 'no-store' });
    assert.equal(response.status, 200, asset);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), sha(await readFile(new URL(asset, dist))), asset);
  }
  console.log('Published browser assets matched the local build');
  return headers;
}

export async function openNativeBrowser({ origin, game, live, successor = false, hasTouch = false }) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
  const headers = live ? await liveHeaders({ origin, game, successor }) : {};
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch, serviceWorkers: 'block' });
  try {
    if (live) await context.route(url => url.origin === origin, async route => {
      try { await route.fulfill({ response: await route.fetch({ headers: { ...route.request().headers(), ...headers }, maxRedirects: 0 }) }); }
      catch { await route.abort().catch(() => {}); }
    });
    await context.addInitScript(() => {
      window.qa = { count: 0, latest: null, requests: [] };
      const OriginalWorker = window.Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', event => {
            const result = event.data?.result;
            if (!result?.frame || !result.availableActionIds) return;
            const { code, ...observation } = result;
            window.qa.latest = { ...observation, gameCode: code ?? observation.gameCode };
            window.qa.count++;
          });
        }
        postMessage(message, ...args) {
          if (message?.request) window.qa.requests.push(message.request);
          super.postMessage(message, ...args);
        }
      };
      const put = CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData = function (image, ...args) {
        put.call(this, image, ...args);
        if (this.canvas.id !== 'game-canvas') return;
        const qa = window.qa;
        const defeatHidden = document.querySelector('#native-defeat').hidden;
        const victoryHidden = document.querySelector('#win-overlay').hidden;
        qa.paints?.push({ rgba: Array.from(image.data), defeatHidden, victoryHidden });
        const interruption = qa.interruption;
        if (!interruption || qa.latest.frames.length < (interruption.minFrames ?? 1) || ++interruption.paints !== interruption.at) return;
        qa.agentStepDisabled = document.querySelector('#agent-step').disabled;
        if (interruption.fromAgent) {
          document.querySelector('#manual-tab').click();
        }
        const control = document.querySelector(interruption.selector);
        qa.interruption = null;
        qa.interrupted = { busy: this.canvas.getAttribute('aria-busy'), controlEnabled: !control.disabled };
        this.canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        if (control instanceof HTMLSelectElement) {
          control.value = String(interruption.level ?? 8);
          control.dispatchEvent(new Event('change', { bubbles: true }));
        } else control.click();
      };
    });

    const pythonRequests = [], errors = [];
    context.on('request', request => { if (/\/(python|vendor\/pyodide)\//.test(request.url())) pythonRequests.push(new URL(request.url()).pathname); });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    return { page, pythonRequests, errors, async close() {
      if (live) await context.unrouteAll({ behavior: 'wait' });
      await browser.close();
    } };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
