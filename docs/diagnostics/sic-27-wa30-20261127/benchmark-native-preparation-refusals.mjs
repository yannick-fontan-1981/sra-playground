import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const baseline = process.argv[2];
assert.ok(baseline, 'Supply an extracted baseline checkout containing src/');
const load = (base, path) => import(pathToFileURL(resolve(base, 'src', path)));
const raw = readFileSync('docs/diagnostics/sic-27-wa30-20261127/wa30-last-part-public.jsonl.gz');
const events = gunzipSync(raw).toString().trim().split('\n').map(JSON.parse);
const groups = [
 'test_or_continue_a_grounded_coverage_plan',
 'continue_or_test_a_witnessed_effect',
 'revalidate_transferred_preview_after_grounded_mechanics',
 'experiment_after_unproductive_returns',
];
const cases = [];
for (const base of [baseline, '.']) {
  const { createPreparedEffects } = await load(base, 'sic/test-prepared-effects.ts');
  const { NativeKnowledgeStore } = await load(base, 'logos-engine/v6-knowledge-store.ts');
  const { defaultRecoveryPack } = await load(base, 'sic/active-recovery.ts');
  const { canonical } = await load(base, 'logos-engine/canonical.ts');
  const family = createPreparedEffects(defaultRecoveryPack.informationPreference, defaultRecoveryPack);
  let previous, last, observed = 0;
  for (const event of events) {
    if (event.kind === 'plan') { previous = event.observation; continue; }
    assert.equal(event.kind, 'return');
    assert.ok(previous && event.observation.revision === previous.revision + 1);
    if (previous.level_epoch !== event.observation.level_epoch) break;
    family.observePublicOutcome(previous, event.observation, event.command, event.first, event.second, [event.second]);
    previous = event.observation; last=event; observed++;
  }
  const store = new NativeKnowledgeStore('preparation-read', 'restoration-scope');
  const write = value => ({ id:'family_state:prepared', kind:'family_state', family:family.id, value });
  const cause = { workflow:'preparation-read', step:'checkpoint', statement:'before-benchmark' };
  await store.commit([write(family.nativeState())], cause);
  cases.push({family,store,write,cause,state:store.value('family_state:prepared'),last,canonical,observed});
}
const results = {};
for (const group of groups) {
  const timings = cases.map(()=>[]);
  const proposals = cases.map(()=>null);
  const receipts = cases.map(()=>null);
  for(let round=0;round<5;round++) for(const j of round%2?[1,0]:[0,1]) {
    const c=cases[j], step=c.last, duration=12;
    let ready=0, borrowed=0;
    const start=performance.now();
    for(let i=0;i<duration;i++){
      c.family.restoreNative(c.state);
      const proposal=await c.family.proposeInGroup(group,step.observation,step.second,[],35);
      if(proposal) ready++;
      const state=c.family.nativeState();
      assert.ok(Object.isFrozen(state));
      if(state===c.state) borrowed++;
      proposals[j]=proposal;
      receipts[j]=state;
    }
    timings[j].push({ms:Math.round(performance.now()-start),ready,borrowed});
  }
  assert.deepEqual(proposals[0],proposals[1]);
  assert.deepEqual(receipts[0],receipts[1]);
  results[group]=timings;
}
let graph;
for(const c of cases){
  await c.store.commit([c.write(c.family.nativeState())], { ...c.cause, statement:'after-benchmark' });
  const canonical = c.canonical(c.store.memory);
  if (graph !== undefined) assert.equal(canonical,graph);
  else graph=canonical;
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
console.log(JSON.stringify({observed:cases[0].observed, graphSHA256:hash(graph), samples:results}));
