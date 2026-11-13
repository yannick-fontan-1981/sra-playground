import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

import {
  assertOp01Op31BrowserCrashResumeReport,
} from './op01-op31-browser-crash-resume-contract.mjs';

const HOST = '127.0.0.1';
const PORT = 4176;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/op01-op31-browser-crash-resume.html?game=SMLP&level=1`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  return JSON.stringify(value);
}

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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withTimeout(promise, label, timeoutMs = 600_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function readJsonRequest(request, maximumBytes = 12_000_000) {
  return await new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > maximumBytes) request.destroy(new Error('browser crash report too large'));
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function launchChrome(executable, profile, label) {
  const child = spawn(executable, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-session-crashed-bubble',
    '--disable-features=Translate,OptimizationHints',
    `--user-data-dir=${profile}`,
    PAGE_URL,
  ], {
    detached: true,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr += chunk; });
  return {
    child,
    label,
    stderr: () => stderr,
  };
}

async function waitForExit(processInfo, timeoutMs = 10_000) {
  const { child } = processInfo;
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return await withTimeout(
    new Promise(resolve => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    }),
    `${processInfo.label} exit`,
    timeoutMs,
  );
}

function signalProcessGroup(processInfo, signal) {
  const pid = processInfo.child.pid;
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      processInfo.child.kill(signal);
    } catch {
      // Already stopped.
    }
  }
}

async function hardKillChrome(processInfo) {
  assert(processInfo.child.exitCode === null && processInfo.child.signalCode === null, 'phase-one Chrome exited before SIGKILL');
  signalProcessGroup(processInfo, 'SIGKILL');
  return await waitForExit(processInfo);
}

async function stopChrome(processInfo) {
  if (!processInfo) return;
  const { child } = processInfo;
  if (child.exitCode !== null || child.signalCode !== null) return;
  signalProcessGroup(processInfo, 'SIGTERM');
  try {
    await waitForExit(processInfo, 5_000);
  } catch {
    signalProcessGroup(processInfo, 'SIGKILL');
    await waitForExit(processInfo, 5_000).catch(() => {});
  }
}

async function removeChromeProfile(profile) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 5) {
        console.warn(`Chrome profile cleanup failed without invalidating qualification: ${error}`);
        return;
      }
      await delay(300 * (attempt + 1));
    }
  }
}

async function createCrashReport() {
  const phaseOne = deferred();
  const phaseTwo = deferred();
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
      name: 'op01-op31-browser-crash-resume-report',
      configureServer(viteServer) {
        viteServer.middlewares.use(async (request, response, next) => {
          const target = request.url?.split('?', 1)[0];
          const sink = target === '/__op01-op31-browser-crash-resume-phase-one'
            ? phaseOne
            : target === '/__op01-op31-browser-crash-resume-report'
              ? phaseTwo
              : null;
          if (!sink || request.method !== 'POST') return next();
          try {
            const payload = await readJsonRequest(request);
            sink.resolve(payload);
            response.statusCode = 204;
            response.end();
          } catch (error) {
            sink.reject(error);
            response.statusCode = 400;
            response.end();
          }
          return undefined;
        });
      },
    }],
  });

  const profile = await mkdtemp(join(tmpdir(), 'op01-op31-crash-resume-chrome-'));
  const chromeExecutable = findChrome();
  let firstChrome;
  let secondChrome;
  try {
    await server.listen();
    firstChrome = launchChrome(chromeExecutable, profile, 'phase-one Chrome');
    const firstPayload = await withTimeout(phaseOne.promise, 'phase-one crash boundary');
    if (!firstPayload || firstPayload.status !== 'phase-one-ready') {
      throw new Error(
        `phase-one browser fixture failed: ${firstPayload?.error ?? 'unknown error'}\n${firstChrome.stderr().slice(-6000)}`,
      );
    }
    assert(firstPayload.evidence?.pagehideObservedBeforeKill === false, 'phase one observed pagehide before the external crash');

    // Give the browser process time to flush the synchronous localStorage write,
    // then terminate the entire process group without any lifecycle event.
    await delay(1_000);
    const firstExit = await hardKillChrome(firstChrome);
    assert(firstExit.signal === 'SIGKILL', `phase-one Chrome exited with ${firstExit.signal ?? firstExit.code}`);

    // Chrome may leave stale singleton files after SIGKILL. They are safe to
    // remove only after the process group is confirmed dead.
    await Promise.all([
      rm(join(profile, 'SingletonLock'), { force: true }),
      rm(join(profile, 'SingletonCookie'), { force: true }),
      rm(join(profile, 'SingletonSocket'), { force: true }),
    ]).catch(() => {});
    await delay(750);

    secondChrome = launchChrome(chromeExecutable, profile, 'phase-two Chrome');
    const secondPayload = await withTimeout(phaseTwo.promise, 'phase-two crash recovery');
    if (!secondPayload || secondPayload.status !== 'success') {
      throw new Error(
        `phase-two browser fixture failed: ${secondPayload?.error ?? 'unknown error'}\n${secondChrome.stderr().slice(-6000)}`,
      );
    }
    assert(
      stable(secondPayload.report?.phaseOne) === stable(firstPayload.evidence),
      'phase-two browser did not recover the exact phase-one evidence',
    );

    return {
      ...secondPayload.report,
      hardKill: {
        signal: 'SIGKILL',
        actualExitSignal: firstExit.signal,
        actualExitCode: firstExit.code,
        pagehideEndpointObserved: firstPayload.evidence.pagehideObservedBeforeKill,
        freshChromeProcessStarted: true,
      },
    };
  } finally {
    await stopChrome(secondChrome);
    await stopChrome(firstChrome);
    await server.close();
    await removeChromeProfile(profile);
  }
}

const outputPath = process.env.OP01_OP31_BROWSER_CRASH_RESUME_REPORT
  ?? 'op01-op31-browser-crash-resume-report.json';

const report = await createCrashReport();
const verification = assertOp01Op31BrowserCrashResumeReport(report);
const qualified = {
  version: 1,
  status: report.status,
  qualification: report.qualification,
  browser: report,
  verification,
  timingDisposition: 'not_measured_for_acceptance',
  performanceScope: 'C7 Region remains unchanged; autosave, localStorage and replay overhead are not qualified here',
  sitePublished: false,
};
await writeFile(outputPath, JSON.stringify(qualified, null, 2) + '\n');
console.log(JSON.stringify({
  status: qualified.status,
  game: verification.game,
  backend: verification.backend,
  hardKillSignal: verification.hardKillSignal,
  action: verification.action,
  needId: verification.needId,
  changedPixelCount: verification.changedPixelCount,
  outputPath,
}, null, 2));
