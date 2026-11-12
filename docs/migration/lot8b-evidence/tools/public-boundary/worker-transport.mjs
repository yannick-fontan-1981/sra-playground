/** Environment-only bridge for the unchanged native 0.67 published worker.
 * Importing/preparing this module does not start a worker or native runtime.
 * The real BrowserV6WorkerClient receives `factory`; its protocol stays intact.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const SELF = fileURLToPath(import.meta.url);
const BOOTSTRAP = resolve(dirname(SELF), 'worker-bootstrap.mjs');
const CONTROL = 'logos-engine.lot8b.public-worker-environment.v1';
const NATIVE_DIGEST = 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a';
const BUNDLE = 'dist/assets/v6-agent-worker-XfSw5eyq.js';
const BUNDLE_SHA = '9c114f84e769879507618de08c9872020e8c65d33dc317dfe7ee959b6495a38f';
const ASSETS = [
  ['/assets/common_frontier_policy.drm-Dl1WBFy2.json', 'dist/assets/common_frontier_policy.drm-Dl1WBFy2.json'],
  ['/assets/strategy-g4UuL-Tb.drm', 'dist/assets/strategy-g4UuL-Tb.drm'],
];
const LOCATION = 'https://branch-public.invalid/assets/v6-agent-worker-XfSw5eyq.js';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const utc = () => new Date().toISOString();

async function fingerprint(path, checkout) {
  assert.equal(await realpath(path), path, `Noncanonical input: ${path}`);
  assert.ok((await stat(path)).isFile(), `Expected a regular input: ${path}`);
  const bytes = await readFile(path);
  return { path: relative(checkout, path), bytes: bytes.length, sha256: sha(bytes) };
}

/**
 * await preparePublishedWorkerTransport({checkout, buildManifestPath, onRecord})
 * → {factory, waitForReady, close, snapshot}.
 *
 * `onRecord` receives a detached JSON capture of each real RPC envelope and
 * environment event. It may be async: replies wait for their capture write,
 * and close waits for the complete capture queue. A rejected write fails close.
 * JSON object properties whose value is undefined are omitted, as in the
 * existing evidence tools; actual interthread payloads use structuredClone.
 * This is untimed functional instrumentation, never a performance harness.
 */
export async function preparePublishedWorkerTransport({
  checkout,
  buildManifestPath = 'docs/migration/lot8b-evidence/final-version-067-01/build-manifest.json',
  onRecord,
  maxWorkers = 8,
  startupTimeoutMs = 30_000,
} = {}) {
  assert.equal(typeof checkout, 'string');
  assert.equal(typeof onRecord, 'function', 'A retained capture callback is required');
  assert.ok(Number.isSafeInteger(maxWorkers) && maxWorkers >= 1 && maxWorkers <= 32);
  assert.ok(Number.isSafeInteger(startupTimeoutMs) && startupTimeoutMs >= 1_000 && startupTimeoutMs <= 60_000);
  const root = resolve(checkout);
  assert.equal(await realpath(root), root);
  const inside = value => {
    const path = isAbsolute(value) ? resolve(value) : resolve(root, value);
    assert.ok(path.startsWith(root + sep), `Input outside owned checkout: ${path}`);
    return path;
  };
  const manifestPath = inside(buildManifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.nativeDigest, NATIVE_DIGEST);
  assert.equal(manifest.worker.path, BUNDLE);
  assert.equal(manifest.worker.sha256, BUNDLE_SHA);
  const declared = new Map(manifest.files.map(item => [item.path, item]));
  const verified = async name => {
    const actual = await fingerprint(inside(name), root);
    const expected = declared.get(name);
    assert.ok(expected, `Build manifest omits ${name}`);
    assert.deepEqual(actual, { path: expected.path, bytes: expected.bytes, sha256: expected.sha256 });
    return actual;
  };
  const bundle = await verified(BUNDLE);
  assert.equal(bundle.sha256, BUNDLE_SHA);
  const assets = [];
  for (const [pathname, name] of ASSETS) assets.push({ url: new URL(pathname, LOCATION).href, ...await verified(name) });
  const pins = {
    nativeDigest: NATIVE_DIGEST,
    manifest: await fingerprint(manifestPath, root),
    bundle,
    assets,
    transport: await fingerprint(inside(SELF), root),
    bootstrap: await fingerprint(inside(BOOTSTRAP), root),
  };
  const entries = [];
  const loggingFailures = [];
  let closed = false;
  let recordSequence = 0;
  let tail = Promise.resolve();
  const record = (kind, detail) => {
    const row = copy({ schema: 'logos-engine.lot8b.public-worker-capture-event.v1',
      sequence: ++recordSequence, recordedAt: utc(), kind, ...detail });
    const next = tail.then(() => onRecord(row));
    tail = next.catch(error => { loggingFailures.push(String(error?.message ?? error)); });
    return next;
  };
  await record('transport_prepared', { pins, workerStarted: false, nativeRuntimeStarted: false,
    maxWorkers, startupTimeoutMs, resourceLimits: { maxOldGenerationSizeMb: 1536 },
    jsonCaptureQualification: 'Detached JSON projection of actual envelopes; interthread values are structured-cloned, never reconstructed from this projection.' });

  function factory() {
    assert.equal(closed, false, 'The published-worker transport is closed');
    assert.ok(entries.length < maxWorkers, 'Declared worker population exhausted');
    const index = entries.length + 1;
    const listeners = new Map();
    let resolveReady, rejectReady, resolveExit;
    const ready = new Promise((yes, no) => { resolveReady = yes; rejectReady = no; });
    void ready.catch(() => {}); // Readiness is optional to await; failure is also captured/emitted.
    const exited = new Promise(yes => { resolveExit = yes; });
    const worker = new Worker(BOOTSTRAP, {
      workerData: { control: CONTROL, checkout: root, location: LOCATION, pins },
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 1536 },
      name: `lot8b-public-native067-${index}`,
    });
    const state = { index, threadId: worker.threadId, createdAt: utc(), readyAt: null,
      exitedAt: null, exitCode: null, terminationRequested: false,
      terminationAcknowledged: false, terminationResult: null,
      requests: 0, responses: 0, rpcErrors: 0, fetchCalls: [], environmentErrors: [] };
    const entry = { worker, state, ready, exited, termination: null, startupTimer: null };
    entries.push(entry);
    const emit = (type, event) => {
      for (const callback of listeners.get(type) ?? []) {
        try { callback(event); }
        catch (error) {
          const message = String(error?.message ?? error);
          state.environmentErrors.push(`Adapter listener failed: ${message}`);
          void record('worker_adapter_listener_error', { worker: index, type, message }).catch(() => {});
          void stop('adapter_listener_failure');
        }
      }
    };
    const stop = reason => {
      if (entry.termination) return entry.termination;
      state.terminationRequested = true;
      void record('worker_termination_requested', { worker: index, reason }).catch(() => {});
      entry.termination = worker.terminate().then(code => {
        state.terminationAcknowledged = true;
        state.terminationResult = code ?? null;
        void record('worker_termination_acknowledged', { worker: index, result: code ?? null }).catch(() => {});
        return code;
      });
      void entry.termination.catch(() => {});
      return entry.termination;
    };
    entry.stop = stop;
    const environmentFailure = error => {
      const message = String(error?.message ?? error);
      state.environmentErrors.push(message);
      clearTimeout(entry.startupTimer);
      rejectReady(new Error(message));
      emit('error', { error, message });
      void stop('environment_failure');
    };
    entry.startupTimer = setTimeout(() => {
      const error = new Error('Published worker entrypoint did not become ready before its declared startup deadline');
      void record('worker_startup_timeout', { worker: index, timeoutMs: startupTimeoutMs }).catch(() => {});
      environmentFailure(error);
    }, startupTimeoutMs);
    worker.on('message', value => {
      if (value?.environmentBridge === CONTROL) {
        if (value.kind === 'ready') {
          clearTimeout(entry.startupTimer);
          state.readyAt = utc();
          void record('worker_ready', { worker: index, ...value.detail }).then(() => resolveReady(), environmentFailure);
        } else if (value.kind === 'fetch') {
          state.fetchCalls.push(copy(value.detail));
          void record('worker_fetch', { worker: index, ...value.detail }).catch(environmentFailure);
        } else {
          const message = value.detail?.message ?? 'Unknown published-worker environment event';
          void record('worker_environment_error', { worker: index, detail: value.detail ?? null }).catch(() => {});
          environmentFailure(new Error(message));
        }
        return;
      }
      const envelope = structuredClone(value);
      state.responses += 1;
      if (envelope && typeof envelope === 'object' && Object.hasOwn(envelope, 'error')) state.rpcErrors += 1;
      void record('rpc_response', { worker: index, envelope }).then(
        () => emit('message', { data: envelope }), environmentFailure);
    });
    worker.on('error', error => {
      void record('worker_error', { worker: index, name: error.name, message: error.message, stack: error.stack ?? null }).catch(() => {});
      environmentFailure(error);
    });
    worker.on('messageerror', error => {
      const message = String(error?.message ?? error);
      state.environmentErrors.push(message);
      void record('worker_messageerror', { worker: index, message }).catch(() => {});
      emit('messageerror', { error, message });
      void stop('message_deserialization_failure');
    });
    worker.on('exit', code => {
      clearTimeout(entry.startupTimer);
      state.exitedAt = utc(); state.exitCode = code;
      if (!state.readyAt) rejectReady(new Error(`Published worker exited before readiness (${code})`));
      void record('worker_exit', { worker: index, exitCode: code, terminationRequested: state.terminationRequested }).catch(() => {});
      resolveExit(code);
      if (!state.terminationRequested) environmentFailure(new Error(`Published worker exited without a termination request (${code})`));
    });
    void record('worker_created', { worker: index, threadId: state.threadId }).catch(environmentFailure);
    return {
      addEventListener(type, callback) {
        assert.ok(['message', 'error', 'messageerror'].includes(type));
        assert.equal(typeof callback, 'function');
        listeners.set(type, [...(listeners.get(type) ?? []), callback]);
      },
      postMessage(value) {
        assert.equal(state.terminationRequested, false, 'Cannot send to a terminating worker');
        assert.equal(state.exitedAt, null, 'Cannot send to an exited worker');
        const envelope = structuredClone(value);
        state.requests += 1;
        void record('rpc_request', { worker: index, envelope }).catch(environmentFailure);
        worker.postMessage(envelope);
      },
      terminate() { void stop('webworker_client_terminate'); },
    };
  }

  async function close() {
    closed = true;
    const settled = await Promise.allSettled(entries.map(entry => entry.stop('capture_owner_close')));
    await Promise.all(entries.map(entry => entry.exited));
    await tail;
    const rejected = settled.filter(value => value.status === 'rejected');
    assert.equal(rejected.length, 0, 'A real worker termination failed');
    assert.equal(loggingFailures.length, 0, `Capture writes failed: ${loggingFailures.join('; ')}`);
    assert.ok(entries.every(entry => entry.state.exitedAt && entry.state.terminationAcknowledged), 'A worker lacks explicit termination acknowledgement');
    assert.ok(entries.every(entry => entry.state.environmentErrors.length === 0), 'A worker environment or adapter failed; inspect the retained capture');
  }

  return {
    factory,
    async waitForReady() {
      assert.ok(entries.length > 0, 'factory has not started any worker');
      await Promise.all(entries.map(entry => entry.ready));
    },
    close,
    snapshot: () => copy({ schema: 'logos-engine.lot8b.public-worker-transport-receipt.v1',
      pins, nativeVersion: '0.67.0', closed, recordCount: recordSequence,
      loggingFailures, workerCount: entries.length, workers: entries.map(entry => entry.state),
      actualPublishedEntrypoint: entries.length > 0 && entries.every(entry => entry.state.readyAt !== null),
      productionClientControllerVerifiedByTransport: false,
      nativeServiceReplaced: false, nativeRuntimeReplaced: false,
      internalNativeStateInjected: false, browserExecution: false, liveGameEngineExecution: false,
      scope: 'Actual published worker entrypoint over real Node interthread transport when readiness is recorded. Environment-only self/fetch/message adaptation; caller independently binds the production client/controller. No browser DOM, HTTP/CSP or real-game qualification.' }),
  };
}
