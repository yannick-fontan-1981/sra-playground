import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

import { selectNativeRegionAction6CostAction } from './native-loop-region-action6-corpus.mjs';

const HOST = '127.0.0.1';
const PORT = 4173;
const PAGE_URL = `http://${HOST}:${PORT}/tests/browser/op01-op31-live-smlp-product-campaign.html`;
const ACTIONS_REQUESTED = 3;
const EXPECTED_CHANNELS = [
  'public_action_availability_v1',
  'public_visible_target_v1',
].sort();

function stable(value) {
  return JSON.stringify(value);
}

function compare(mismatches, path, reference, candidate) {
  if (stable(reference) !== stable(candidate)) {
    mismatches.push({ path, reference, candidate });
  }
}

function frameHash(frame) {
  if (!Array.isArray(frame) || frame.length !== 64 || frame.some(row => !Array.isArray(row) || row.length !== 64)) {
    throw new RangeError('reference SMLP frame must be 64x64');
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

async function createReferenceReport() {
  const client = createPythonArchiveClient();
  try {
    let observation = await client.request({ type: 'load', code: 'SMLP' });
    const report = {
      version: 1,
      runtime: 'cpython-custom-games-archive',
      game: 'SMLP',
      gameId: observation.gameId,
      backend: observation.backend,
      actionsRequested: ACTIONS_REQUESTED,
      initial: publicState(observation),
      steps: [],
    };

    for (let index = 0; index < ACTIONS_REQUESTED; index += 1) {
      const action = selectNativeRegionAction6CostAction({ game: 'SMLP', observation });
      if (!action || action.id !== 6) {
        throw new Error(`SMLP CPython reference could not select ACTION6 at step ${index + 1}`);
      }
      const before = observation;
      observation = await client.request({
        type: 'action',
        actionId: 6,
        data: { x: action.x, y: action.y },
      });
      const delta = changedPixels(before.frame, observation.frame);
      if (delta <= 0) throw new Error(`SMLP CPython ACTION6 produced no delta at step ${index + 1}`);
      report.steps.push({
        index: index + 1,
        action: { id: 6, x: action.x, y: action.y },
        changedPixelCount: delta,
        ...publicState(observation),
      });
    }
    return report;
  } finally {
    await client.close();
  }
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
      name: 'op01-op31-live-smlp-product-report',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__op01-op31-live-smlp-report', (request, response, next) => {
          if (request.method !== 'POST') return next();
          let body = '';
          request.setEncoding('utf8');
          request.on('data', chunk => {
            body += chunk;
            if (body.length > 10_000_000) request.destroy(new Error('live SMLP report too large'));
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

  const profile = await mkdtemp(join(tmpdir(), 'op01-op31-smlp-chrome-'));
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
        () => reject(new Error(`live SMLP product campaign timed out\n${stderr.slice(-4000)}`)),
        600_000,
      );
    });
    const payload = await Promise.race([payloadPromise, timeout]);
    if (!payload || payload.status !== 'success') {
      throw new Error(`live SMLP product browser fixture failed: ${payload?.error ?? 'unknown error'}\n${stderr.slice(-4000)}`);
    }
    return payload.report;
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    await stopProcess(chrome);
    await server.close();
    await removeChromeProfile(profile);
  }
}

function assertLiveProductParity(reference, candidate) {
  if (!reference || reference.version !== 1 || !candidate || candidate.version !== 1) {
    throw new TypeError('live SMLP qualification requires version 1 reports');
  }
  const mismatches = [];
  compare(mismatches, 'reference.backend', 'python-native-archive', reference.backend);
  compare(mismatches, 'candidate.runtime', 'browser-product-host-game-worker-pyodide', candidate.runtime);
  compare(mismatches, 'candidate.backend', 'python-wasm', candidate.backend);
  compare(mismatches, 'game', reference.game, candidate.game);
  compare(mismatches, 'gameId', reference.gameId, candidate.gameId);
  compare(mismatches, 'actionsRequested', reference.actionsRequested, candidate.actionsRequested);
  for (const field of ['frameHash', 'availableActionIds', 'state', 'level', 'levelsCompleted']) {
    compare(mismatches, `initial.${field}`, reference.initial?.[field], candidate.initial?.[field]);
  }
  compare(mismatches, 'cycleCount', reference.steps?.length, candidate.cycles?.length);

  const count = Math.min(reference.steps?.length ?? 0, candidate.cycles?.length ?? 0);
  const needIds = new Set();
  for (let index = 0; index < count; index += 1) {
    const expected = reference.steps[index];
    const actual = candidate.cycles[index];
    const prefix = `cycles[${index}]`;
    for (const field of [
      'index',
      'action',
      'changedPixelCount',
      'frameHash',
      'availableActionIds',
      'state',
      'level',
      'levelsCompleted',
    ]) {
      compare(mismatches, `${prefix}.${field}`, expected?.[field], actual?.[field]);
    }
    compare(mismatches, `${prefix}.ownerId`, 'joint_channels_v1', actual?.ownerId);
    compare(mismatches, `${prefix}.dispatch.accepted`, true, actual?.dispatch?.accepted);
    compare(mismatches, `${prefix}.dispatch.stale`, false, actual?.dispatch?.stale);
    compare(mismatches, `${prefix}.acquisition.ownerId`, 'joint_channels_v1', actual?.acquisition?.ownerId);
    compare(mismatches, `${prefix}.acquisition.routed`, true, actual?.acquisition?.routed);
    compare(mismatches, `${prefix}.acquisition.duplicate`, false, actual?.acquisition?.duplicate);
    compare(mismatches, `${prefix}.acquisition.needId`, actual?.needId, actual?.acquisition?.needId);
    compare(mismatches, `${prefix}.callback.needId`, actual?.needId, actual?.callbackReceipt?.needId);
    compare(mismatches, `${prefix}.agentSequence`, index + 1, actual?.agentSequence);
    compare(mismatches, `${prefix}.fieldKnowledgeStatus`, 'empty', actual?.fieldKnowledgeStatus);
    compare(mismatches, `${prefix}.events`, [
      'action:6:32:26',
      'action-return',
      'passive-field-stock',
      'acquired',
      'present',
    ], actual?.events);
    compare(mismatches, `${prefix}.busyTransitions`, [true, false], actual?.busyTransitions);

    const channels = (actual?.acquisition?.channels ?? []).map(channel => channel.channelId).sort();
    compare(mismatches, `${prefix}.channels`, EXPECTED_CHANNELS, channels);
    for (const channel of actual?.acquisition?.channels ?? []) {
      compare(mismatches, `${prefix}.${channel.channelId}.acquired`, true, channel.acquired);
      compare(mismatches, `${prefix}.${channel.channelId}.needId`, actual.needId, channel.needId);
      compare(mismatches, `${prefix}.${channel.channelId}.proposalRef`, actual.proposalRef, channel.proposalRef);
      compare(mismatches, `${prefix}.${channel.channelId}.jointRef`, actual.acquisition.jointRef, channel.jointRef);
    }

    if (needIds.has(actual?.needId)) {
      mismatches.push({ path: `${prefix}.needId`, reference: 'unique settled needId', candidate: actual?.needId });
    }
    needIds.add(actual?.needId);
  }

  compare(mismatches, 'finalFieldStock.status', 'empty', candidate.finalFieldStock?.status);
  compare(mismatches, 'finalFieldStock.hasModel', false, candidate.finalFieldStock?.hasModel);
  compare(mismatches, 'finalFieldStock.hasPrior', false, candidate.finalFieldStock?.hasPrior);
  compare(mismatches, 'finalFieldStock.hasStock', false, candidate.finalFieldStock?.hasStock);
  compare(mismatches, 'finalFieldStock.samples', 0, candidate.finalFieldStock?.samples);

  if (mismatches.length > 0) {
    const preview = mismatches.slice(0, 16)
      .map(item => `${item.path}: reference=${stable(item.reference)} candidate=${stable(item.candidate)}`)
      .join('\n');
    throw new Error(`live SMLP product campaign mismatch (${mismatches.length})\n${preview}`);
  }

  return {
    cyclesCompared: count,
    needIds: [...needIds],
    expectedChannels: [...EXPECTED_CHANNELS],
    action: { id: 6, x: 32, y: 26 },
    changedPixelsPerCycle: reference.steps.map(step => step.changedPixelCount),
  };
}

const outputPath = process.env.OP01_OP31_LIVE_SMLP_REPORT
  ?? 'op01-op31-live-smlp-product-campaign-report.json';

const reference = await createReferenceReport();
const candidate = await createBrowserReport();
const parity = assertLiveProductParity(reference, candidate);
const report = {
  version: 1,
  status: 'live-smlp-product-campaign-qualified',
  qualification: 'functional-real-browser-not-official-performance',
  reference,
  candidate,
  parity,
  timingDisposition: 'not_measured_for_acceptance',
  performanceScope: 'C7 Region remains unchanged; this report does not qualify product-owner cost',
};
await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  status: report.status,
  cyclesCompared: parity.cyclesCompared,
  needIds: parity.needIds,
  outputPath,
}, null, 2));
