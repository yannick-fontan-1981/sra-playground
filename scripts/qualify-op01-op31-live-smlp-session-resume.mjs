import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

import {
  assertOp01Op31LiveSmlpSessionResumeReport,
} from './op01-op31-live-smlp-session-resume-contract.mjs';

const HOST = '127.0.0.1';
const PORT = 4175;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/op01-op31-live-smlp-session-resume.html`;

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

async function createBrowserReport() {
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
      name: 'op01-op31-live-smlp-session-resume-report',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__op01-op31-live-smlp-session-resume-report', (request, response, next) => {
          if (request.method !== 'POST') return next();
          let body = '';
          request.setEncoding('utf8');
          request.on('data', chunk => {
            body += chunk;
            if (body.length > 5_000_000) request.destroy(new Error('live SMLP session-resume report too large'));
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

  const profile = await mkdtemp(join(tmpdir(), 'op01-op31-resume-chrome-'));
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
      `--user-data-dir=${profile}`,
      PAGE_URL,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', chunk => { stderr += chunk; });

    const timeout = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`live SMLP session-resume qualification timed out\n${stderr.slice(-4000)}`)),
        600_000,
      );
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    if (!payload || payload.status !== 'success') {
      throw new Error(`live SMLP session-resume browser fixture failed: ${payload?.error ?? 'unknown error'}\n${stderr.slice(-4000)}`);
    }
    return payload.report;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    await stopProcess(chrome);
    await server.close();
    await removeChromeProfile(profile);
  }
}

const outputPath = process.env.OP01_OP31_LIVE_SMLP_SESSION_RESUME_REPORT
  ?? 'op01-op31-live-smlp-session-resume-report.json';
const candidate = await createBrowserReport();
const assertions = assertOp01Op31LiveSmlpSessionResumeReport(candidate);
const report = {
  version: 1,
  status: 'live-smlp-browser-session-resume-qualified',
  qualification: 'functional-real-browser-not-official-performance',
  candidate,
  assertions,
  timingDisposition: 'not_measured_for_acceptance',
  performanceScope: 'C7 Region remains unchanged; snapshot and restore cost are not qualified by this report',
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  realWorkersQualified: assertions.realWorkersQualified,
  physicalActionsQualified: assertions.physicalActionsQualified,
  controllerReactivationsQualified: assertions.controllerReactivationsQualified,
  dispatchedReturnsResumed: assertions.dispatchedReturnsResumed,
  replayedActions: assertions.replayedActions,
  duplicatePresentations: assertions.duplicatePresentations,
  outputPath,
}, null, 2));
