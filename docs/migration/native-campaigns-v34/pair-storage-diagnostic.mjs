import { SharedSeriesConstraint } from './src/logos-engine/v6-shared-series.ts';
import { CoupledPairEpochAnchorMemory } from './src/logos-engine/v6-coupled-pair-epoch-anchor.ts';
import { OccurrenceRecallAccess } from './src/logos-engine/v6-occurrence-recall.ts';
import { NativeKnowledgeStore } from './src/logos-engine/v6-knowledge-store.ts';
import { retainNativeJson } from './src/logos-engine/v6-native-owned.ts';
import { symbolicDigest } from './src/logos-engine/v6-hash.ts';
import assert from 'node:assert/strict';

const mode = process.argv[2];
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const makeRows = offset => {
  const rows = Array.from({length:16}, () => Array(16).fill(0));
  for (const [top,left] of [[2+offset,2],[10+offset,10]])
    for(let row=top;row<top+2;row++) for(let col=left;col<left+2;col++) rows[row][col]=5;
  return rows;
};
const initial=makeRows(0), settled=makeRows(1);
const observation = i => ({level_epoch:1, levels_completed:0, state:'NOT_FINISHED',
  observation_ref:'run:epoch:1:revision:'+i+':frame:0123456789abcdef', revision:i});
class AnchorControl {
  memory=new OccurrenceRecallAccess(); pairs=new CoupledPairEpochAnchorMemory(); events=[];
  record(before) {const events=this.pairs.record(before,initial);this.events.push(...events);return {events};}
  state() {return {events:structuredClone(this.events),digest:this.pairs.retainedDigest(this.memory.retainedDigest())};}
  restore(state) {const pairs=new CoupledPairEpochAnchorMemory();for(const event of state.events)pairs.applyEvent(event);
    assert.equal(pairs.retainedDigest(this.memory.retainedDigest()),state.digest);
    this.events=structuredClone(state.events);this.pairs=pairs;}
}
const family = mode==='evidence' ? new SharedSeriesConstraint({}) : new AnchorControl();
const store = new NativeKnowledgeStore('coupled-pair-v34-bounded-diagnostic','pair-diagnostic');
const familyId='family_state:public_occurrence_recall';
const episode='common-observation-frontier', factKey='repeated_series_state';
const factId='reasoning:fact:'+symbolicDigest([episode,factKey]);
const cause = {workflow:'bounded_diagnostic',step:'response',statement:'acquire'};
await store.commit([{id:familyId,kind:'family_state',family:'public_occurrence_recall',value:family.state()}],cause);
global.gc();
const initialHeap=process.memoryUsage().heapUsed;
let currentFact=null, historicalRawStates=0, recordsWithEvents=0;
const summary=[];
for(let i=1;i<=100;i++) {
  const before=observation(i),after=observation(i+1);
  const result=family.record(before,after,{action_ref:'ACTION1'},i===1?initial:settled,settled,{},0,[]);
  const writes=[];
  if(result.events.length) {
    recordsWithEvents++;
    currentFact=retainNativeJson({episode,key:factKey,value:structuredClone(family.state()),evidence:after.observation_ref,revision:after.revision});
    family.restore(structuredClone(currentFact.value));
    writes.push({id:factId,kind:'component_state',component:'native_reasoning_fact',value:currentFact});
  }
  const state=family.state();
  historicalRawStates+=bytes(state);
  writes.push({id:familyId,kind:'family_state',family:'public_occurrence_recall',value:state});
  await store.commit(writes,cause);
  const retained=store.stateValue(familyId);
  if(currentFact) assert.deepEqual(store.stateValue(factId),currentFact);
  assert.deepEqual(retained,state);
  family.restore(structuredClone(retained));
  if([1,10,25,50,100].includes(i)) {
    global.gc();
    const memory=store.memory,nodes=Object.values(memory.nodes),fragments=nodes.filter(node=>node.kind==='state_fragment');
    const point={responses:i,recordsWithEvents,events:state.events.length,rawSharedStateBytes:bytes(state),
      summedRawHistoricalFamilyStatesBytes:historicalRawStates,
      graphNodes:nodes.length,fragmentNodes:fragments.length,deltas:memory.deltas.length,
      fragmentValueBytes:fragments.reduce((sum,node)=>sum+bytes(node.value),0),
      currentNodeValuesBytes:nodes.reduce((sum,node)=>sum+bytes(node.value),0),
      allHistoricalNodeValuesBytes:memory.deltas.reduce((sum,delta)=>sum+bytes(delta.node.value),0),
      graphJsonBytes:bytes(memory),heapAfterGcMiB:process.memoryUsage().heapUsed/1048576,
      heapIncreaseMiB:(process.memoryUsage().heapUsed-initialHeap)/1048576};
    summary.push(point);console.log(JSON.stringify({mode,point}));
  }
}
console.log(JSON.stringify({mode,initialHeapMiB:initialHeap/1048576,scope:'100 synthetic public responses; actual SharedSeries acquisition/restoration and actual V7 store; family_state and repeated_series_state fact mirror, no unrelated agent families/catalogue/prefix evidence; heap after explicit GC includes live family, current fact, hydration and bounded caches; no elapsed-time benchmark',summary}));
