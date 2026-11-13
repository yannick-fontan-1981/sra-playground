import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';
import { createServer } from 'vite';

import { selectNativeRegionAction6CostAction } from './native-loop-region-action6-corpus.mjs';
import {
  assertWorkerPyodideParity,
  WORKER_PYODIDE_PARITY_PLAN,
} from './worker-pyodide-parity-contract.mjs';

const HOST = '127.0.0.1';
const PORT = 4173;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/lot9b-worker-pyodide.html`;

function frameHash(frame) {
  if (!Array.isArray(frame) || frame.length !== 64 || frame.some(row => !Array.isArray(row) || row.length !== 64)) {
    throw new RangeError('reference parity frame must be 64x64');
  }
  return createHash('sha256').update(Uint8Array.from(frame.flat())).digest('hex');
}

function changedPixels(before, after) {
  let changed = 0;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      if (before[y][x] !== after[y][x]) changed += 1;
    }
  }
  return changed;
}

function publicState(observation) {
  return {
    frameHash: frameHash(observation.frame),
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

function createPythonArchiveClient() {
  const child = spawn(process.env.PYTHON ?? 'python3', ['scripts/native-python-archive-session.py'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const lines = readline.createInterface({ input: child.stdout });
  const waiting = [];
  let closedError;

  lines.on('line', line => {
    const pending = waiting.shift();
    if (!pending) return;
    try {
      const payload = JSON.parse(line);
      if (!payload.ok) pending.reject(new Error(payload.error));
      else pending.resolve(payload.result);
    } catch (error) {
      pending.reject(error);
    }
  });
  child.on('exit', (code, signal) => {
    closedError = new Error(`native archive session exited code=${code} signal=${signal}`);
    for (const pending of waiting.splice(0)) pending.reject(closedError);
  });

  return {
    request(payload) {
      if (closedError) return Promise.reject(closedError);
      return new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        child.stdin.write(JSON.stringify(payload) + '\n');
      });
    },
    async close() {
      child.stdin.end();
      if (child.exitCode === null) {
        await new Promise(resolve => child.once('exit', resolve));
      }
    },
  };
}

async function runReferenceSample(client, game, actionsRequested) {
  let observation = await client.request({ type: 'load', code: game });
  const gameId = observation.gameId;
  const initial = publicState(observation);
  const steps = [];

  for (let index = 0; index < actionsRequested; index += 1) {
    const action = selectNativeRegionAction6CostAction({ game, observation });
    if (!action || action.id !== 6) {
      throw new Error(`${game} CPython reference could not select ACTION6 at step ${index + 1}`);
    }
    const before = observation;
    observation = await client.request({
      type: 'action',
      actionId: 6,
      data: { x: action.x, y: action.y },
    });
    const delta = changedPixels(before.frame, observation.frame);
    if (delta <= 0) {
      throw new Error(`${game} CPython ACTION6 produced no public delta at step ${index + 1}`);
    }
    steps.push({
      action: { id: 6, x: action.x, y: action.y },
      changedPixelCount: delta,
      ...publicState(observation),
    });
  }

  return {
    game,
    actionsRequested,
    gameId,
    backend: observation.backend,
    initial,
    steps,
  };
}

async function createReferenceReport() {
  const client = createPythonArchiveClient();
  try {
    const samples = [];
    for (const item of WORKER_PYODIDE_PARITY_PLAN) {
      samples.push(await runReferenceSample(client, item.game, item.actions));
    }
    return {
      version: 1,
      runtime: 'cpython-custom-games-archive',
      samples,
    };
  } finally {
    await client.close();
  }
}

function findChrome() {
  const explicit = process.env.CHROME_BIN;
  if (explicit) return explicit;
  const command = [
    'command -v google-chrome-stable',
    'command -v google-chrome',
    'command -v chromium',
    'command -v chromium-browser',
  ].join(' || ');
  const result = spawnSync('bash', ['-lc', command], { encoding: 'utf8' });
  const found = result.stdout.trim().split('\n')[0];
  if (!found) throw new Error('no supported Chrome/Chromium executable found');
  return found;
}

async function createBrowserReport() {
  let resolvePayload;
  let rejectPayload;
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
      name: 'lot9b-worker-pyodide-report',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__lot9b-report', (request, response, next) => {
          if (request.method !== 'POST') return next();
          let body = '';
          request.setEncoding('utf8');
          request.on('data', chunk => {
            body += chunk;
            if (body.length > 20_000_000) request.destroy(new Error('parity report too large'));
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

  const chromeProfile = await mkdtemp(join(tmpdir(), 'lot9b-chrome-'));
  let chrome;
  let stderr = '';
  try {
    await server.listen();
    const executable = findChrome();
    chrome = spawn(executable, [
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
      setTimeout(() => reject(new Error(`Worker/Pyodide browser qualification timed out\n${stderr.slice(-4000)}`)), 600_000);
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    if (!payload || payload.status !== 'success') {
      throw new Error(`Worker/Pyodide browser fixture failed: ${payload?.error ?? 'unknown error'}\n${stderr.slice(-4000)}`);
    }
    return payload.report;
  } finally {
    chrome?.kill('SIGTERM');
    await server.close();
    await rm(chromeProfile, { recursive: true, force: true });
  }
}

const outputPath = process.env.LOT9B_WORKER_PYODIDE_REPORT
  ?? 'lot9b-worker-pyodide-parity-report.json';

const reference = await createReferenceReport();
const candidate = await createBrowserReport();
const parity = assertWorkerPyodideParity(reference, candidate);
const report = {
  version: 1,
  status: 'worker-pyodide-functional-parity-qualified',
  qualification: 'functional-parity-only-not-official-performance',
  reference,
  candidate,
  parity,
  transport: 'BrowserGameRuntime -> game-worker.ts -> Pyodide -> game_bridge.py -> custom-games.zip',
  timingDisposition: 'not_measured_for_acceptance',
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  samplesCompared: parity.samplesCompared,
  stepsCompared: parity.stepsCompared,
  outputPath,
}, null, 2));
