import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

import { verifyNativeLoopRunnerManifest } from './verify-native-loop-runner-manifest.mjs';

const HOST = '127.0.0.1';
const PORT = 4174;
const PAGE_URL = `http://${HOST}:${PORT}/benchmarks/native-region-official.html`;
const OUTPUT_PATH = process.env.LOT9B_OFFICIAL_BENCHMARK_REPORT
  ?? 'lot9b-official-native-region-abba-report.json';
const MEASUREMENT_ISOLATION = process.env.LOT9B_MEASUREMENT_ISOLATION
  ?? 'non-isolated-unspecified-environment';

function findChrome() {
  const explicit = process.env.CHROME_BIN;
  if (explicit) return explicit;
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
        console.warn(`Chrome profile cleanup failed without invalidating benchmark: ${error}`);
        return;
      }
      await delay(250 * (attempt + 1));
    }
  }
}

function chromeVersion(executable) {
  const result = spawnSync(executable, ['--version'], { encoding: 'utf8' });
  return result.stdout.trim() || result.stderr.trim() || 'unknown';
}

async function loadManifest() {
  await verifyNativeLoopRunnerManifest();
  return JSON.parse(await readFile('docs/recovery/native-loop-runner-manifest.json', 'utf8'));
}

async function runBrowserBenchmark(manifest) {
  let resolvePayload;
  let rejectPayload;
  let timeoutHandle;
  const payloadPromise = new Promise((resolve, reject) => {
    resolvePayload = resolve;
    rejectPayload = reject;
  });
  const config = {
    manifestVersion: manifest.version,
    manifestStatus: manifest.status,
    referenceSourceRef: manifest.sourceRefs.reference,
    candidateSourceRef: manifest.sourceRefs.candidate,
    corpusRef: manifest.corpus.id,
    measurementIsolation: MEASUREMENT_ISOLATION,
    requestedAt: new Date().toISOString(),
  };

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
      name: 'lot9b-official-native-region-benchmark',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__lot9b-benchmark-config', (request, response, next) => {
          if (request.method !== 'GET') return next();
          response.statusCode = 200;
          response.setHeader('content-type', 'application/json');
          response.setHeader('cache-control', 'no-store');
          response.end(JSON.stringify(config));
          return undefined;
        });
        viteServer.middlewares.use('/__lot9b-benchmark-report', (request, response, next) => {
          if (request.method !== 'POST') return next();
          let body = '';
          request.setEncoding('utf8');
          request.on('data', chunk => {
            body += chunk;
            if (body.length > 50_000_000) request.destroy(new Error('benchmark report too large'));
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

  const executable = findChrome();
  const profile = await mkdtemp(join(tmpdir(), 'lot9b-official-chrome-'));
  let chrome;
  let stderr = '';
  try {
    await server.listen();
    chrome = spawn(executable, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profile}`,
      PAGE_URL,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', chunk => { stderr += chunk; });

    const timeout = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`official browser benchmark timed out\n${stderr.slice(-8000)}`)),
        1_200_000,
      );
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    return {
      payload,
      chrome: chromeVersion(executable),
      stderrTail: stderr.slice(-4000),
      config,
    };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    await stopProcess(chrome);
    await server.close();
    await removeChromeProfile(profile);
  }
}

const manifest = await loadManifest();
let execution;
try {
  execution = await runBrowserBenchmark(manifest);
  const wrapper = {
    orchestratorVersion: 1,
    gitCommit: process.env.GITHUB_SHA ?? null,
    measurementIsolation: MEASUREMENT_ISOLATION,
    chrome: execution.chrome,
    manifestSourceRefs: manifest.sourceRefs,
    payload: execution.payload,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(wrapper, null, 2)}\n`);
  if (!execution.payload || execution.payload.status !== 'success') {
    throw new Error(`official benchmark browser payload failed: ${execution.payload?.error ?? 'unknown error'}`);
  }
  const result = execution.payload.report.result;
  console.log(JSON.stringify({
    accepted: result.accepted,
    measurementIsolation: MEASUREMENT_ISOLATION,
    STCK: result.games.STCK,
    SMLP: result.games.SMLP,
    totals: result.totals,
    outputPath: OUTPUT_PATH,
  }, null, 2));
} catch (error) {
  if (!execution) {
    await writeFile(OUTPUT_PATH, `${JSON.stringify({
      orchestratorVersion: 1,
      gitCommit: process.env.GITHUB_SHA ?? null,
      measurementIsolation: MEASUREMENT_ISOLATION,
      status: 'orchestrator-error',
      error: error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error),
    }, null, 2)}\n`);
  }
  throw error;
}
