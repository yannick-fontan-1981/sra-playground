import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

import { assertLot6cBrowserProductRuntimeReport } from './lot6c-browser-product-runtime-contract.mjs';

const HOST = '127.0.0.1';
const PORT = 4174;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/lot6c-product-runtime.html`;

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const result = spawnSync('bash', ['-lc', [
    'command -v google-chrome-stable',
    'command -v google-chrome',
    'command -v chromium',
    'command -v chromium-browser',
  ].join(' || ')], { encoding: 'utf8' });
  const executable = result.stdout.trim().split('\n')[0];
  if (!executable) throw new Error('no supported Chrome/Chromium executable found');
  return executable;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    const killed = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGKILL');
    await Promise.race([killed, delay(5_000)]);
  }
}

async function removeChromeProfile(path) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) {
        console.warn(`Chrome profile cleanup failed without invalidating qualification: ${error}`);
        return;
      }
      await delay(250 * (attempt + 1));
    }
  }
}

async function runBrowserQualification() {
  let resolvePayload;
  let rejectPayload;
  let timeoutHandle;
  const payloadPromise = new Promise((resolve, reject) => {
    resolvePayload = resolve;
    rejectPayload = reject;
  });

  const server = await createServer({
    configFile: 'vite.config.ts',
    logLevel: 'warn',
    server: {
      host: HOST,
      port: PORT,
      strictPort: true,
      allowedHosts: [HOST, 'localhost'],
    },
    plugins: [{
      name: 'lot6c-browser-product-report',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__lot6c-report', (request, response, next) => {
          if (request.method !== 'POST') return next();
          let body = '';
          request.setEncoding('utf8');
          request.on('data', chunk => {
            body += chunk;
            if (body.length > 1_000_000) request.destroy(new Error('Lot 6C browser report too large'));
          });
          request.on('end', () => {
            try {
              resolvePayload(JSON.parse(body));
              response.statusCode = 204;
              response.end();
            } catch (error) {
              rejectPayload(error);
              response.statusCode = 400;
              response.end();
            }
          });
          return undefined;
        });
      },
    }],
  });

  const chromeProfile = await mkdtemp(join(tmpdir(), 'lot6c-chrome-'));
  let chrome;
  let stderr = '';
  try {
    await server.listen();
    chrome = spawn(findChrome(), [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      `--user-data-dir=${chromeProfile}`,
      PAGE_URL,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', chunk => { stderr += chunk; });

    const timeout = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`Lot 6C browser qualification timed out\n${stderr.slice(-4000)}`)),
        120_000,
      );
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    if (!payload || payload.status !== 'success') {
      throw new Error(`Lot 6C browser fixture failed: ${payload?.error ?? 'unknown error'}\n${stderr.slice(-4000)}`);
    }
    return payload.report;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    await stopProcess(chrome);
    await server.close();
    await removeChromeProfile(chromeProfile);
  }
}

const outputPath = process.env.LOT6C_BROWSER_PRODUCT_REPORT
  ?? 'lot6c-browser-product-runtime-report.json';
const candidate = await runBrowserQualification();
const assertions = assertLot6cBrowserProductRuntimeReport(candidate);
const report = {
  version: 1,
  status: 'lot6c-browser-product-runtime-qualified',
  qualification: 'functional-browser-only-not-official-performance',
  transport: 'main.ts -> BrowserGameRuntime -> synthetic protocol-compatible Worker -> presentProductObservation -> real DOM/canvas ports',
  candidate,
  assertions,
  timingDisposition: 'not_measured_for_acceptance',
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  workerRequestsQualified: assertions.workerRequestsQualified,
  busyTransitionsQualified: assertions.busyTransitionsQualified,
  canvasStatesQualified: assertions.canvasStatesQualified,
  outputPath,
}, null, 2));
