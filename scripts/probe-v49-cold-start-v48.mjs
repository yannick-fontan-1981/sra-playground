/** Read-only planning diagnostic on the published v48 source and one retained public packet. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';

const ROOT = new URL('../', import.meta.url);
const hash = data => createHash('sha256').update(data).digest('hex');
const read = path => readFile(new URL(path, ROOT));
const evidence = async path => { const bytes = await read(path); return { path, sha256: hash(bytes), bytes: bytes.length }; };
const manifestPath = 'docs/migration/native-campaigns-v48/source-manifest.json';
const manifest = JSON.parse(await read(manifestPath));
async function unchangedV48() {
  for (const [path, sha] of Object.entries(manifest.files)) assert.equal(hash(await read(path)), sha, `Published v48 input changed: ${path}`);
  return { nativeSourceManifest: await evidence(manifestPath), digest: manifest.digest, files: Object.keys(manifest.files).length };
}
const before = await unchangedV48();
const source = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: JSON.parse(await read(source + 'laya_proto/common_frontier_policy.drm.json')),
  strategy: JSON.parse(await read(source + 'morphology_policy/strategy.drm')) };
const publicPath = 'tests/fixtures/v6-linked-packet-initial-public.json.gz';
const corpus = JSON.parse(gunzipSync(await read(publicPath)));
const initial = corpus.games.find(game => game.game === 'GRIL');
assert.ok(initial); assert.equal(corpus.actions, 0); assert.equal(corpus.levelJumps, 0);
const runtime = await createNativeV6Runtime(declarations);
const result = await runtime.initialize({ sessionId: 'anonymous-cold-catalogue-diagnostic', observation: initial.packet,
  budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, { yieldControl: async () => {} });
assert.equal(result.kind, 'action');
assert.equal(result.snapshot.lastDecision, 'observed_frontier');
assert.equal(result.snapshot.proposal.kind, 'experiment');
assert.equal(result.snapshot.proposal.question.reason, 'unobserved_input_effect_or_unexplained_transition');
assert.equal(result.snapshot.actions, 0);
const after = await unchangedV48();
const target = 'docs/migration/native-campaigns-v49/cold-start-v48.json';
const report = { schema: 'logos-engine.v49.cold-start-v48.v1', status: 'passed',
  sourceCommit: 'eb2a7b40d87cacd6b16d1b71b5042f9ccefc6cf7', nativeBefore: before, nativeAfter: after,
  sourceUnchanged: true, publicCorpus: await evidence(publicPath),
  game: 'GRIL', gameLabelVisibleToRuntime: false, packet: initial.packet, packetSha256: hash(JSON.stringify(initial.packet)),
  initializedSessions: 1, dispatchedActions: 0, manualPrimingActions: 0, levelJumps: 0,
  nativeResult: result, generator: await evidence('scripts/probe-v49-cold-start-v48.mjs'),
  qualification: 'A fresh native v48 common caller selects a scalar information experiment from the unchanged retained public initial packet. No game host is started and the proposed command is not dispatched. This establishes availability of cold acquisition, not a useful effect, completed level or source full-caller trajectory parity.' };
await mkdir(new URL('docs/migration/native-campaigns-v49/', ROOT), { recursive: true });
await writeFile(new URL(target, ROOT), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, selected: result.snapshot.lastDecision, command: result.command,
  proposalKind: result.snapshot.proposal.kind, dispatchedActions: 0, sourceUnchanged: true, output: fileURLToPath(new URL(target, ROOT)) }));
