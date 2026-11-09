import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ObservedInventory } from '../src/logos-engine/v6-observed-inventory.ts';
import { InventoryPolicy } from '../src/logos-engine/v6-inventory-policy.ts';
import { ObservedMeter, CollectionEvidence, InventoryCallerContext, strips, single_line_supports, boundary_strip_decrease } from '../src/logos-engine/v6-inventory-caller-context.ts';
type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-inventory-family-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(v: T): T => structuredClone(v);
const receiptFields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
function sourceView(v: any): any {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(sourceView);
  if (receiptFields.every(k => Object.hasOwn(v,k)) && typeof v.workflow === 'string') assert.deepEqual(Object.keys(v).sort(), [...receiptFields].sort());
  return Object.fromEntries(Object.entries(v).map(([k,child]) => [k,sourceView(child)]));
}

for (const row of fixture.cases) test(`inventory original family: ${row.id}`, async () => {
  const family = await ObservedInventory.create(); family.restore(copy(row.seedState));
  if (row.context) family.context = copy(row.context);
  const args = copy(row.arguments);
  if (row.operation === 'proposeSource' && args[6]) { const collection = new CollectionEvidence(); collection.restore(args[6]); args[6] = collection; }
  const run = async () => { const value = await (family as unknown as R)[row.operation](...args); return value === undefined ? null : sourceView(value); };
  if (row.error) await assert.rejects(run); else assert.deepEqual(await run(),row.value);
  assert.deepEqual(sourceView(family.state()),row.afterState);
});

for (const row of fixture.policyCases) test(`inventory exact DRM/SRC: ${row.id}`, async () => {
  const policy = await InventoryPolicy.create();
  assert.deepEqual(policy.interpret(copy(row.facts)),row.interpret);
  assert.deepEqual(sourceView(await policy.evaluate(copy(row.facts))),row.evaluate);
  assert.equal(row.interpret.release_authority,false);
});

for (const row of fixture.meterCases) test(`inventory original caller meter: ${row.id}`, () => {
  let meter = new ObservedMeter();
  for (const [i,[epoch,ref,rows,index]] of row.steps.entries()) {
    meter.observe(epoch,ref,copy(rows),index);
    assert.deepEqual(meter.state(),row.values[i].state,`step ${i} state`);
    assert.deepEqual(meter.forecast(),row.values[i].forecast,`step ${i} forecast`);
    const saved = meter.state(); meter = new ObservedMeter(); meter.restore(saved);
    assert.deepEqual(meter.state(),saved,'caller context can restore mid-sequence');
  }
});
for (const row of fixture.collectionCases) test(`inventory original caller collection: ${row.id}`, () => {
  const collection = new CollectionEvidence(); collection.restore(copy(row.seedState));
  const args = copy(row.arguments), result = row.operation === 'observe'
    ? collection.observe(args.before,args.after,args.first,args.second,args.action,args.meter_before ?? null,args.mover ?? null)
    : (collection as unknown as R)[row.operation](...args);
  assert.deepEqual(result === undefined ? null : result,row.value);
  assert.deepEqual(collection.retained_state(),row.afterState);
  const restored = new CollectionEvidence(); restored.restore(collection.retained_state());
  assert.deepEqual(restored.pending,collection.pending); assert.deepEqual(restored.history,collection.history);
});
const tupleCompare = (a: readonly any[],b: readonly any[]): number => {
  for (let i=0;i<Math.min(a.length,b.length);i++) if(a[i]!==b[i]) return a[i]<b[i]?-1:1;
  return a.length-b.length;
};
for (const row of fixture.contextPrimitives) test(`inventory consumed V5 strip predicate: ${row.id}`, () => {
  const measured = strips(row.first);
  assert.deepEqual([...measured].map(([k,v])=>[JSON.parse(k),v]).sort((a,b)=>tupleCompare(a[0],b[0])),row.strips);
  assert.deepEqual([...single_line_supports(row.first,measured)].map(k=>JSON.parse(k)).sort(tupleCompare),row.single);
  assert.equal(boundary_strip_decrease(row.first,row.second),row.decrease);
});

test('inventory reference expectations remain tied to unchanged original V5/V6 source bytes', () => {
  assert.equal(fixture.referenceCommit,'786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.qualification,/synthetic/); assert.match(fixture.qualification,/No game dispatch/);
  for(const [path,expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,path);
  }
});

test('inventory source entry delegates one family and preserves exact receipt', async () => {
  const row=fixture.cases.find((r:R)=>r.id==='observed_supplier_acquisition_proposal'), family=await ObservedInventory.create();
  family.restore(copy(row.seedState)); const [obs,rows,inputs,remaining]=copy(row.arguments);
  assert.deepEqual(await family.proposeInSubquestion('factored_material_return','observed_inventory_composition',obs,rows,inputs,remaining),
    {...row.value,material_access_subquestion:'observed_inventory_composition'});
  await assert.rejects(family.proposeInSubquestion('surface','observed_inventory_composition',obs,rows,inputs,remaining));
  await assert.rejects(family.proposeInSubquestion('factored_material_return','ordered_reaction',obs,rows,inputs,remaining));
});

test('inventory retains eight source fields and detached atomic checkpoints with optional caller annex', async () => {
  const row=fixture.cases.find((r:R)=>r.id==='current_display_preservation'),family=await ObservedInventory.create(),seed=copy(row.seedState);
  family.restore(seed); const expected=family.state(); seed.seen_pairs.length=0; seed.tracker.controls={}; assert.deepEqual(family.state(),expected);
  const detached=family.state();detached.tracker.underlays.length=0;assert.deepEqual(family.state(),expected);
  const saved=family.nativeState() as R,revision=family.nativeRevision;
  assert.equal(Object.keys(saved.source_state).length,8);assert.equal(saved.caller_context,null);
  assert.ok(Object.isFrozen(saved));assert.ok(Object.isFrozen(saved.source_state.tracker));assert.equal(family.nativeState(),saved);
  for(const bad of [{...copy(saved),format:'wrong'},{...copy(saved),extra:true},
    {...copy(saved),source_state:{...copy(expected),failed:[1]}},{...copy(saved),source_state:{...copy(expected),seen_pairs:{}}},
    {...copy(saved),source_state:{...copy(expected),pending_access:[]}}, {...copy(saved),caller_context:{}}]) {
    assert.throws(()=>family.restoreNative(bad));assert.deepEqual(family.state(),expected);assert.equal(family.nativeRevision,revision);assert.equal(family.nativeState(),saved);
  }
  family.restore({tracker:copy(expected.tracker)});assert.deepEqual(family.state().seen_pairs,[]);family.restoreNative(saved);assert.deepEqual(family.state(),expected);
  family.enableCallerContext(()=>[]);family.observeCallerContext(row.arguments[0],row.arguments[1]);
  const complete=family.nativeState() as R,context=copy(complete.caller_context);
  family.observeCallerContext({...row.arguments[0],level_epoch:2,observation_ref:'changed'},row.arguments[1]);
  assert.notDeepEqual(family.callerContextState(),context);family.restoreNative(complete);
  assert.deepEqual(family.callerContextState(),context);assert.deepEqual(family.state(),expected);
  const malformed={...copy(complete),caller_context:{meter:{},collection:{events:[]}}};
  assert.throws(()=>family.restoreNative(malformed));assert.deepEqual(family.nativeState(),complete);
});

test('caller acquisition keeps collection before the next measured meter and restores from events', async () => {
  const entry=fixture.collectionCases.find((r:R)=>r.id==='gain_on_anchored_entry'),a=entry.arguments,context=new InventoryCallerContext();
  const measured=new ObservedMeter(),steps=fixture.meterCases.find((r:R)=>r.id==='constant_loss:False:False').steps;
  for(const [epoch,ref,rows,index] of steps) measured.observe(epoch,ref,rows,index);
  // The family facade and Kernel test exercise source call ordering. Here the
  // annex round-trip covers both nonempty retained event state and tuple maps.
  context.meter=measured;context.collection.restore(copy(entry.afterState));const retained=context.state();
  const restored=new InventoryCallerContext();restored.restore(retained);assert.deepEqual(restored.state(),retained);
  const family=await ObservedInventory.create();family.enableCallerContext(()=>[]);
  family.observeCallerContext(a.before,a.first);const before=family.callerContextState()!.meter;
  family.recordCallerContext(a.before,a.after,a.action,a.first,a.second,{},0);
  assert.deepEqual(family.callerContextState()!.meter,before,'collection acquisition does not move the meter observation');
  family.observeCallerContext(a.after,a.second);assert.equal(family.callerContextState()!.meter.last_ref,a.after.observation_ref);
});

test('inventory source branch only reads caller forecast and never inserts the pending morphology observation',async()=>{
  const row=fixture.cases.find((r:R)=>r.id==='observed_supplier_acquisition_proposal'),family=await ObservedInventory.create();
  family.restore(copy(row.seedState));family.enableCallerContext(()=>[]);const before=family.callerContextState();
  const [obs,rows,inputs,remaining]=copy(row.arguments);
  await family.propose(obs,rows,inputs,remaining);
  assert.deepEqual(family.callerContextState(),before);assert.equal(family.callerContextState()!.meter.last_ref,null);
  family.observeCallerContext(obs,rows);const acquired=family.callerContextState();
  await family.propose({...obs,observation_ref:'different',revision:99},rows,inputs,remaining);
  assert.deepEqual(family.callerContextState(),acquired);
});
