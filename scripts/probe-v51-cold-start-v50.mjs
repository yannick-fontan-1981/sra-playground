/** Read-only planning diagnostic on the published v50 source and one retained public packet. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';

const ROOT = new URL('../', import.meta.url);
const hash = data => createHash('sha256').update(data).digest('hex');
const read = path => readFile(new URL(path, ROOT));
const evidence = async path => { const bytes = await read(path); return { path, sha256: hash(bytes), bytes: bytes.length }; };
const manifestPath = 'docs/migration/native-campaigns-v50/source-manifest-final.json';
const manifest = JSON.parse(await read(manifestPath));
async function unchangedV50() {
  const actual = [];
  async function walk(folder) {
    for (const entry of await readdir(new URL(folder, ROOT), { withFileTypes: true })) {
      const path = folder + '/' + entry.name;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && /\.(ts|json|drm)$/.test(path)) actual.push(path);
    }
  }
  await walk('src/logos-engine'); await walk('src/runtime');
  assert.deepEqual(actual.sort(), Object.keys(manifest.files).sort(), 'The complete native file inventory must remain v50');
  for (const [path, sha] of Object.entries(manifest.files)) assert.equal(hash(await read(path)), sha, `Published v50 input changed: ${path}`);
  return { nativeSourceManifest: await evidence(manifestPath), digest: manifest.digest, files: Object.keys(manifest.files).length };
}
const before = await unchangedV50();
assert.equal(before.files, 170);
assert.equal(before.digest, '66529083d89d420f9d198e99c8639ee174f1d829380d0d71eb86432ad184a94f');
const source = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: JSON.parse(await read(source + 'laya_proto/common_frontier_policy.drm.json')),
  strategy: JSON.parse(await read(source + 'morphology_policy/strategy.drm')) };
const publicPath = 'tests/fixtures/v6-linked-packet-initial-public.json.gz';
const corpus = JSON.parse(gunzipSync(await read(publicPath)));
const initial = corpus.games.find(game => game.game === 'VALV');
assert.ok(initial); assert.equal(corpus.actions, 0); assert.equal(corpus.levelJumps, 0);
assert.ok(!('game' in initial.packet) && !('code' in initial.packet));
const runtime = await createNativeV6Runtime(declarations);
const result = await runtime.initialize({ sessionId: 'anonymous-cold-field-service-diagnostic', observation: initial.packet,
  budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, { yieldControl: async () => {} });
assert.equal(result.snapshot.actions, 0);
const after = await unchangedV50();
const target = 'docs/migration/native-campaigns-v51/cold-start-v50.json';
const report = { schema: 'logos-engine.v51.cold-start-v50.v1', status: 'passed',
  sourceCommit: '049091c01b5969034350f3982c32141d42f4d67f', nativeBefore: before, nativeAfter: after,
  sourceUnchanged: true, publicCorpus: await evidence(publicPath),
  game: 'VALV', gameLabelVisibleToRuntime: false, packet: initial.packet, packetSha256: hash(JSON.stringify(initial.packet)),
  initializedSessions: 1, dispatchedActions: 0, manualPrimingActions: 0, levelJumps: 0,
  nativeResult: result, generator: await evidence('scripts/probe-v51-cold-start-v50.mjs'),
  qualification: 'A fresh native v50 common caller is initialized against the unchanged retained public initial VALV packet before the field-service transfer. The actual decision and proposal are retained without overriding their priority. No game host is started and no proposed command is dispatched. This is a planning diagnostic, not evidence of a useful effect, completed level or source full-caller trajectory parity.' };
await mkdir(new URL('docs/migration/native-campaigns-v51/', ROOT), { recursive: true });
await writeFile(new URL(target, ROOT), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, selected: result.snapshot.lastDecision, command: result.command,
  proposalKind: result.snapshot.proposal?.kind, dispatchedActions: 0, sourceUnchanged: true, output: fileURLToPath(new URL(target, ROOT)) }));
