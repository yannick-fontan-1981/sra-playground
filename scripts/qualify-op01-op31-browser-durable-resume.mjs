import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

const HOST = '127.0.0.1';
const PORT = 4174;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/op01-op31-browser-durable-resume.html`;
const EXPECTED_ACTION = { id: 6, x: 32, y: 26 };

function stable(value) {
  return JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const result = spawnSync('bash', ['-lc', [
    'command -v google-chrome-stable',
    'command -v google-chrome',
    'command -v chromium',
    'command -v chromium-browser',
  ].join(' || ')], { encoding: 'utf8' });
  const found = result.stdout.trim().split('\n')[0];
  if (!found) throw new Error('no supported Chrome/Chromium executable found');
  return found;
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
      name: 'op01-op31-browser-durable-resume-report',
      configureServer(viteServer) {
        viteServer.middlewares.use(
          '/__op01-op31-browser-durable-resume-report',
          (request, response, next) => {
            if (request.method !== 'POST') return next();
            let body = '';
            request.setEncoding('utf8');
            request.on('data', chunk => {
              body += chunk;
              if (body.length > 10_000_000) {
                request.destroy(new Error('durable browser report too large'));
              }
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
          },
        );
      },
    }],
  });

  const profile = await mkdtemp(join(tmpdir(), 'op01-op31-durable-chrome-'));
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
        () => reject(new Error(`durable Chrome reload timed out\n${stderr.slice(-6000)}`)),
        600_000,
      );
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    if (!payload || payload.status !== 'success') {
      throw new Error(
        `durable browser fixture failed: ${payload?.error ?? 'unknown error'}\n${stderr.slice(-6000)}`,
      );
    }
    return payload.report;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    await stopProcess(chrome);
    await server.close();
    await removeChromeProfile(profile);
  }
}

function requestAction(request) {
  if (!request || request.type !== 'action') return null;
  return {
    id: request.actionId,
    x: request.data?.x,
    y: request.data?.y,
  };
}

function verifyReport(report) {
  assert(report?.version === 1, 'durable browser report version changed');
  assert(report.status === 'browser-durable-session-reload-qualified', 'durable browser fixture did not qualify');
  assert(report.runtime === 'chrome-reload-browser-game-runtime-pyodide', 'unexpected durable browser runtime');
  assert(report.replayPolicy === 'deterministic-command-journal', 'unexpected durable replay policy');
  assert(report.game === 'SMLP', 'durable browser fixture changed game');
  assert(report.backend === 'python-wasm', `unexpected durable backend ${report.backend}`);

  const phaseOne = report.phaseOne;
  const phaseTwo = report.phaseTwo;
  assert(phaseOne?.version === 1, 'phase-one evidence is missing');
  assert(stable(phaseOne.action) === stable(EXPECTED_ACTION), 'phase-one action changed');
  assert(phaseOne.changedPixelCount === 9, 'phase-one SMLP delta is not 9 pixels');
  assert(phaseOne.runtimeCommittedEntries === 1, 'phase-one runtime journal should contain only load');
  assert(phaseOne.runtimePendingSequence === 2, 'phase-one pending action sequence changed');
  assert(phaseOne.controllerActionsDispatched === 1, 'phase-one action count was not preserved');
  assert(phaseOne.phaseOnePostedRequests?.length === 2, 'phase one did not send load plus ACTION6');
  assert(phaseOne.phaseOnePostedRequests[0]?.type === 'load', 'phase one did not start with load');
  assert(stable(requestAction(phaseOne.phaseOnePostedRequests[1])) === stable(EXPECTED_ACTION), 'phase-one worker ACTION6 changed');

  assert(phaseTwo?.replayedEntries === 1, 'reconstruction did not replay one committed load');
  assert(phaseTwo.replayedPending === true, 'reconstruction did not replay the pending physical action');
  assert(phaseTwo.reconstructionRequests?.length === 2, 'reconstruction did not emit exactly load plus ACTION6');
  assert(phaseTwo.reconstructionRequests[0]?.type === 'load', 'reconstruction did not start with load');
  assert(stable(requestAction(phaseTwo.reconstructionRequests[1])) === stable(EXPECTED_ACTION), 'reconstruction ACTION6 changed');
  assert(phaseTwo.reconstructedIdentity === phaseOne.returnedIdentity, 'reconstructed observation changed');
  assert(phaseTwo.controllerActionCalls === 0, 'Agent replayed a physical action after restore');
  assert(phaseTwo.presentationCalls === 0, 'already-live return was presented twice');
  assert(phaseTwo.acquisition?.needId === phaseOne.needId, 'needId changed across page reload');
  assert(phaseTwo.acquisition?.proposalRef === phaseOne.proposalRef, 'proposalRef changed across page reload');
  assert(phaseTwo.acquisition?.routed === true, 'reconstructed return was not routed');
  assert(phaseTwo.acquisition?.duplicate === false, 'reconstructed return was acquired as a duplicate');
  assert(phaseTwo.controller?.stopReason === 'manual', 'restored controller did not stop cleanly');
  assert(phaseTwo.controller?.campaignStatus === 'resumed', 'restored controller did not expose resumed status');
  assert(phaseTwo.controller?.actionsDispatched === 1, 'restored controller action count changed');
  assert(phaseTwo.controller?.sessionId === 'op01-op31-durable-smlp-session', 'restored session id changed');

  const causal = report.causalProofs ?? {};
  for (const key of [
    'pageReloadOccurred',
    'freshWorkerCreated',
    'pyodideJournalReplayed',
    'pendingPhysicalActionReplayedOnceToReconstructState',
    'sameNeedIdAcquired',
    'acquisitionRoutedOnce',
    'actionCountPreserved',
    'sessionIdPreserved',
  ]) {
    assert(causal[key] === true, `causal proof ${key} is missing`);
  }
  assert(causal.agentPhysicalActionReplayedAfterRestore === false, 'Agent physical action replay flag changed');
  assert(causal.returnedObservationPresentedTwice === false, 'double presentation flag changed');
  assert(causal.changedPixels === 9, 'causal delta changed');

  const boundary = report.proofBoundary ?? {};
  assert(boundary.rawPythonHeapSnapshot === false, 'fixture must not claim a Python heap snapshot');
  assert(boundary.deterministicReplayRequired === true, 'deterministic replay boundary is missing');
  assert(boundary.localStorageUsed === true, 'localStorage boundary is missing');
  assert(boundary.crossBrowserQualified === false, 'fixture must not claim cross-browser qualification');
  assert(boundary.crashWithoutPagehideQualified === false, 'fixture must not claim crash recovery without pagehide');
  assert(boundary.performanceQualified === false, 'fixture must not claim performance qualification');
  assert(boundary.sitePublished === false, 'fixture must not claim Site publication');

  return {
    game: report.game,
    backend: report.backend,
    action: EXPECTED_ACTION,
    needId: phaseOne.needId,
    changedPixelCount: phaseOne.changedPixelCount,
    phaseOneRequests: phaseOne.phaseOnePostedRequests.length,
    reconstructionRequests: phaseTwo.reconstructionRequests.length,
    controllerActionCalls: phaseTwo.controllerActionCalls,
    presentationCalls: phaseTwo.presentationCalls,
    actionsDispatched: phaseTwo.controller.actionsDispatched,
  };
}

const outputPath = process.env.OP01_OP31_BROWSER_DURABLE_REPORT
  ?? 'op01-op31-browser-durable-resume-report.json';

const browser = await createBrowserReport();
const verification = verifyReport(browser);
const report = {
  version: 1,
  status: 'browser-durable-session-reload-qualified',
  qualification: 'functional-real-chrome-pyodide-reload-not-official-performance',
  browser,
  verification,
  timingDisposition: 'not_measured_for_acceptance',
  performanceScope: 'C7 Region remains unchanged; durable resume overhead is not qualified here',
  sitePublished: false,
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  game: verification.game,
  backend: verification.backend,
  action: verification.action,
  needId: verification.needId,
  changedPixelCount: verification.changedPixelCount,
  outputPath,
}, null, 2));
