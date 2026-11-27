import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
assert.ok(root, 'Supply an extracted baseline checkout containing src/');
const load = (base, path) => import(pathToFileURL(resolve(base, 'src', path)));
const modules = async base => ({
  ...(await load(base, 'sic/test-prepared-effects.ts')),
  ...(await load(base, 'logos-engine/v6-knowledge-store.ts')),
  ...(await load(base, 'logos-engine/v6-native-owned.ts')),
  ...(await load(base, 'logos-engine/canonical.ts')),
});
const raw = readFileSync('docs/diagnostics/sic-27-wa30-20261127/wa30-last-part-public.jsonl.gz');
const events = gunzipSync(raw).toString().trim().split('\n').map(JSON.parse);
const measurements = {};
let expectedSnapshot, expectedGraph;
for (const [name, path] of [['before',root], ['after','.']]) {
  const { createPreparedEffects, NativeKnowledgeStore, retainNativeJson, canonical } = await modules(path);
  const family = createPreparedEffects();
  let previous, observed = 0;
  for (const event of events) {
    if (event.kind === 'plan') {
      previous = event.observation;
      continue;
    }
    assert.equal(event.kind, 'return');
    assert.ok(previous && event.observation.revision === previous.revision + 1);
    family.observePublicOutcome(previous, event.observation, event.command, event.first, event.second, [event.second]);
    previous = event.observation;
    observed++;
  }
  const store = new NativeKnowledgeStore('restoration-benchmark', 'restoration-scope');
  const write = value => ({ id:'family_state:prepared', kind:'family_state', family:family.id, value });
  const cause = { workflow:'restoration-benchmark', step:'checkpoint', statement:'before-benchmark' };
  await store.commit([write(retainNativeJson(family.state()))], cause);
  const state = store.value('family_state:prepared');
  const samples = [];
  for (let round = 0; round < 5; round++) {
    const started = performance.now();
    for (let cycle = 0; cycle < 40; cycle++) {
      family.restoreNative(state);
      family.restoreNative(state);
      family.state();
    }
    samples.push(Math.round(performance.now()-started));
  }
  await store.commit([write(family.nativeState())], { ...cause, statement:'after-benchmark' });
  const snapshot = canonical(store.memory);
  const graph = createHash('sha256').update(snapshot).digest('hex');
  if (expectedSnapshot !== undefined) {
    assert.equal(snapshot, expectedSnapshot, 'Complete canonical graph changed');
    assert.equal(graph, expectedGraph);
  } else { expectedSnapshot = snapshot; expectedGraph = graph; }
  measurements[name] = { observed, bytes:snapshot.length, samples, graph };
}
console.log(JSON.stringify({measurements, evidenceSHA256:createHash('sha256').update(raw).digest('hex')}));
