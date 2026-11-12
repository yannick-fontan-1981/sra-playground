/** Runs only in an explicitly created Node worker; it does not replace solver code. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainThread, parentPort, threadId, workerData } from 'node:worker_threads';

assert.equal(isMainThread, false, 'The environment bootstrap requires a real worker thread');
assert.ok(parentPort);
const CONTROL = 'logos-engine.lot8b.public-worker-environment.v1';
const BUNDLE = 'dist/assets/v6-agent-worker-XfSw5eyq.js';
const BUNDLE_SHA = '9c114f84e769879507618de08c9872020e8c65d33dc317dfe7ee959b6495a38f';
const LOCATION = 'https://branch-public.invalid/assets/v6-agent-worker-XfSw5eyq.js';
const ALLOWED_ASSET_PATHS = new Map([
  ['https://branch-public.invalid/assets/common_frontier_policy.drm-Dl1WBFy2.json', 'dist/assets/common_frontier_policy.drm-Dl1WBFy2.json'],
  ['https://branch-public.invalid/assets/strategy-g4UuL-Tb.drm', 'dist/assets/strategy-g4UuL-Tb.drm'],
]);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const control = (kind, detail) => parentPort.postMessage({ environmentBridge: CONTROL, kind, detail });

try {
  assert.equal(workerData.control, CONTROL);
  assert.equal(workerData.location, LOCATION);
  const root = resolve(workerData.checkout);
  assert.equal(await realpath(root), root);
  const pathFor = name => {
    const path = resolve(root, name);
    assert.ok(path.startsWith(root + sep), 'Environment input escaped its checkout');
    return path;
  };
  const readVerified = async item => {
    const path = pathFor(item.path);
    assert.equal(await realpath(path), path);
    const bytes = await readFile(path);
    assert.equal(bytes.length, item.bytes, `Input size changed: ${item.path}`);
    assert.equal(sha(bytes), item.sha256, `Input digest changed: ${item.path}`);
    return bytes;
  };
  const { pins } = workerData;
  assert.equal(pins.nativeDigest, 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a');
  assert.equal(pins.bundle.path, BUNDLE);
  assert.equal(pins.bundle.sha256, BUNDLE_SHA);
  assert.equal(pathFor(pins.bootstrap.path), fileURLToPath(import.meta.url));
  await readVerified(pins.bootstrap);
  await readVerified(pins.bundle);
  assert.equal(pins.assets.length, ALLOWED_ASSET_PATHS.size);
  const assets = new Map();
  for (const asset of pins.assets) {
    assert.equal(ALLOWED_ASSET_PATHS.get(asset.url), asset.path);
    assert.equal(assets.has(asset.url), false);
    await readVerified(asset);
    assets.set(asset.url, asset);
  }
  let listenerCount = 0;
  let fetchCalls = 0;
  globalThis.self = Object.freeze({
    location: Object.freeze({ href: LOCATION }),
    addEventListener(type, callback) {
      assert.equal(type, 'message');
      assert.equal(typeof callback, 'function');
      assert.equal(++listenerCount, 1, 'Unexpected additional worker entrypoint listener');
      parentPort.on('message', data => callback({ data }));
    },
    postMessage(message) { parentPort.postMessage(message); },
  });
  globalThis.fetch = async (input, init = {}) => {
    const count = ++fetchCalls;
    let url, method, asset;
    try {
      url = input instanceof URL ? input.href : typeof input === 'string' ? new URL(input).href : input?.url;
      method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      asset = assets.get(url);
    } catch (error) {
      control('fetch', { call: count, url: null, method: null, allowed: false,
        message: String(error?.message ?? error) });
      throw error;
    }
    if (!asset || method !== 'GET' || init?.body != null) {
      control('fetch', { call: count, url: typeof url === 'string' ? url : null, method, allowed: false });
      throw new Error('The published worker requested an undeclared declaration URL or method');
    }
    try {
      const bytes = await readVerified(asset);
      const response = new Response(bytes, { status: 200, headers: { 'content-type': 'application/json' } });
      control('fetch', { call: count, url, method, allowed: true, verified: true,
        input: { path: asset.path, bytes: asset.bytes, sha256: asset.sha256 } });
      return response;
    } catch (error) {
      control('fetch', { call: count, url, method, allowed: true, verified: false,
        message: String(error?.message ?? error) });
      throw error;
    }
  };
  await import(pathToFileURL(pathFor(pins.bundle.path)).href);
  assert.equal(listenerCount, 1, 'The published worker did not register its real message handler');
  control('ready', { threadId, bundle: pins.bundle, bootstrap: pins.bootstrap,
    location: LOCATION, allowedFetchUrls: [...assets.keys()], listenerCount,
    workerEntrypointUnmodified: true, runtimeOrServiceFactorySubstituted: false });
} catch (error) {
  control('bootstrap_failure', { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null });
  process.exitCode = 1;
  parentPort.close();
}
