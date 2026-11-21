/** Compare the same public game and agent workload in two built Playgrounds. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const [before, after, roundsArg = '7'] = process.argv.slice(2);
const rounds = Number(roundsArg);
assert.ok(before && after && Number.isInteger(rounds) && rounds >= 3, 'Usage: node scripts/compare-custom4-browser-cost.mjs BEFORE_URL AFTER_URL [ROUNDS]');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true });
const games = process.env.CUSTOM4_BENCH_GAMES?.split(',') ?? ['SS09', 'SS11'];
const stepLimit = 4;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

async function trial(origin, game) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    await context.addInitScript(() => {
      window.runtimeCost = { observations: 0, requests: [] };
      const BaseWorker = window.Worker;
      window.Worker = class extends BaseWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener('message', event => {
            if (event.data?.result?.frame && event.data.result.availableActionIds) window.runtimeCost.observations++;
          });
        }
        postMessage(message, ...args) {
          if (message?.request) window.runtimeCost.requests.push(message.request);
          super.postMessage(message, ...args);
        }
      };
    });
    const page = await context.newPage();
    const started = performance.now();
    const url = new URL('/?game=' + game + '#playground', origin);
    assert.equal((await page.goto(url.href)).status(), 200);
    await page.waitForFunction(() => window.runtimeCost.observations === 1
      && document.querySelector('#game-availability').textContent === 'Ready'
      && document.querySelector('#game-canvas').getAttribute('aria-busy') === 'false');
    await page.locator('#agent-tab').click();
    for (let step = 1; step <= stepLimit; step++) {
      await page.locator('#agent-step').click();
      await page.waitForFunction(minimum => window.runtimeCost.observations >= minimum
        && !document.querySelector('#agent-step').disabled, step + 1, { timeout: 20000 });
    }
    const elapsedMs = performance.now() - started;
    const actionSequence = await page.evaluate(() => window.runtimeCost.requests.filter(request => request.type === 'action'));
    assert.equal(actionSequence.length, stepLimit);
    return { elapsedMs, actionSequence };
  } finally {
    await context.close();
  }
}

try {
  const pairs = [];
  for (let round = -1; round < rounds; round++) {
    const pair = { baseline: [], candidate: [] };
    for (const game of games) {
      for (const side of round % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']) {
        pair[side].push(await trial(side === 'baseline' ? before : after, game));
      }
      assert.deepEqual(pair.candidate.at(-1).actionSequence, pair.baseline.at(-1).actionSequence, game + ' public actions');
    }
    if (round >= 0) pairs.push(pair);
  }
  const baseline = pairs.map(pair => pair.baseline.map(item => item.elapsedMs));
  const candidate = pairs.map(pair => pair.candidate.map(item => item.elapsedMs));
  const total = samples => samples.map(row => row.reduce((a, b) => a + b, 0));
  const baselineTotal = median(total(baseline)), candidateTotal = median(total(candidate));
  const changePercent = (candidateTotal / baselineTotal - 1) * 100;
  console.log(JSON.stringify({
    browser: browser.version(), rounds, stepsPerGame: stepLimit, games,
    medianBaselineMs: baselineTotal, medianCandidateMs: candidateTotal,
    perGame: games.map((game, i) => ({ game, baselineMs: median(baseline.map(row => row[i])), candidateMs: median(candidate.map(row => row[i])) })),
    changePercent, samePublicActionsInEveryPair: true, withinBudget: changePercent <= 10,
  }, null, 2));
  assert.ok(changePercent <= 10, 'Combined browser journey exceeds the +10% budget');
} finally {
  await browser.close();
}
