import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import {symbolicDigest} from '../src/logos-engine/v6-hash.ts';
import {ObservedInputDomain} from '../src/logos-engine/v6-native-observer.ts';
import {PeriodicSums,measurePeriodicSums,periodicTargetDomain} from '../src/logos-engine/v6-periodic-sums.ts';
import {SubsetDiagnosis,measureSubsetScene,subsetFeedback,subsetNavigationPrediction} from '../src/logos-engine/v6-subset-diagnosis.ts';
import {FixedOrigin,measureFixedScene,fixedBands,fixedConnectedPorts,fixedStrokePorts} from '../src/logos-engine/v6-fixed-origin.ts';
import {calculateFixedProgram} from '../src/logos-engine/v6-fixed-program-calculation.ts';
import {ReflectedCover,measureReflectedLattice,initializeReflectedWorld,encodeReflectedWorld} from '../src/logos-engine/v6-reflected-cover.ts';
import {measureReflectionAudit} from '../src/logos-engine/v6-reflection-audit.ts';
import {supportPoint,supportCompare,sortedPoints} from '../src/logos-engine/v6-support-measurements.ts';

const fixture=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-support-procedures-reference.json.gz',import.meta.url))).toString('utf8'));
const fresh=(id:string):any=>id==='periodic_sums'?new PeriodicSums(fixture.policy.periodic_sums):id==='subset_diagnosis'?new SubsetDiagnosis(fixture.policy.subset_diagnosis):id==='fixed_origin'?new FixedOrigin(fixture.policy):id==='reflected_cover'?new ReflectedCover(fixture.policy.reflected_cover):null;
function reflectionScene(s:any):any{return s===null?null:{...s,cells:[...s.cells].map(([k,v])=>[supportPoint(k),v]),marks:sortedPoints(s.marks),mark_values:[...s.mark_values].map(([k,v])=>[supportPoint(k),v]),families:[...s.families].map(([k,v])=>[k,sortedPoints(v as Set<string>)])};}

test('support procedure oracle is pinned unchanged source, with explicitly qualified real game traces',async()=>{
 assert.equal(fixture.provenance.commit,'786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
 for(const [path,hash]of Object.entries(fixture.provenance.sources)){const bytes=await readFile(new URL(`../reference/v6/${fixture.provenance.commit}/source/${path}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,path);}
 const onde=fixture.realGames.find((g:any)=>g.code==='ONDE');assert.equal(onde.state,'WIN');assert.equal(onde.levelsCompleted,6);assert.equal(onde.actions,48);assert.deepEqual(onde.publicPrimingExperiments,[]);
 assert.ok(fixture.realGames.filter((g:any)=>g.code!=='ONDE').every((g:any)=>g.publicPrimingExperiments.length>0));
});

for(const c of fixture.cases)test(`Python ↔ TypeScript support procedure: ${c.id}`,async()=>{
 const a=c.arguments,v=typeof a.scene==='string'?fixture.scenes[a.scene]:null;let actual:any;
 if(c.operation==='measure_periodic')actual=measurePeriodicSums(v.rows);
 else if(c.operation==='measure_subset')actual=measureSubsetScene(v.rows);
 else if(c.operation==='measure_fixed')actual=measureFixedScene(v.rows);
 else if(c.operation==='fixed_bands')actual=fixedBands(a.nodes);
 else if(c.operation==='fixed_connected')actual=fixedConnectedPorts(v.rows,a.nodes,a.direction);
 else if(c.operation==='fixed_strokes')actual=fixedStrokePorts(v.rows,a.nodes,a.direction);
 else if(c.operation==='fixed_calculation')actual=calculateFixedProgram(a.models,a.word,a.operation,a.origin??undefined);
 else if(c.operation==='periodic_target'){actual=periodicTargetDomain(a.scene);if(actual)actual.targets.sort(supportCompare);}
 else if(c.operation==='measure_reflection')actual=reflectionScene(measureReflectedLattice(v.rows));
 else if(c.operation==='initialize_reflection'){const s=measureReflectedLattice(v.rows)!;actual=encodeReflectedWorld(initializeReflectedWorld(s)!);}
 else if(c.operation==='reflection_audit')actual=measureReflectionAudit(v.rows,a.args);
 else if(c.operation==='subset_feedback')actual=subsetFeedback(v.rows,a.frames,a.measured);
 else if(c.operation==='subset_navigation')actual=subsetNavigationPrediction(a.scene,a.candidates,a.tested,a.remaining);
 else if(c.operation==='family_guard'){const family=fresh(a.family);family.restore(a.state);actual=await family.before(a.proposal,0,a.public,v.observation);}
 else throw new Error('Unknown comparison: '+c.operation);
 assert.deepEqual(actual,c.expected);
});

for(const journal of fixture.journals)test(`Python ↔ TypeScript support journal: ${journal.id}`,async()=>{
 let family=fresh(journal.family),proposal:any=null;
 for(const [ordinal,entry]of journal.steps.entries()){
  const op=entry.operation;let result:any=null;
  if(op.kind==='propose'){const v=fixture.scenes[op.scene];proposal=await family.propose(v.observation,v.rows,new ObservedInputDomain(256).candidates(v.observation),op.remaining??400);result=proposal;}
  else if(op.kind==='before'){const v=fixture.scenes[op.scene];result=await family.before(proposal,op.index??0,v.public,v.observation);}
  else if(op.kind==='after'||op.kind==='record'){const a=fixture.scenes[op.before],b=fixture.scenes[op.after],index=op.index??0;result=op.kind==='after'?await family.after(proposal,index,a.observation,b.observation,a.rows,b.rows):await family.record(a.observation,b.observation,op.command??proposal.actions[index],a.rows,b.rows,proposal,index,b.public.frame_packet);}
  else if(op.kind==='proposal'){proposal=structuredClone(op.proposal);result=proposal;}
  else throw new Error('Unknown operation: '+op.kind);
  assert.deepEqual(result,entry.expected.result,`${journal.id} ${ordinal} ${op.kind}: proposal/response`);
  const state=family.state();assert.equal(symbolicDigest(state),entry.expected.stateDigest,`${journal.id} ${ordinal} ${op.kind}: source memory`);
  family=fresh(journal.family);family.restore(state);assert.deepEqual(family.state(),state,'Lossless reconstruction after every operation');
 }
 assert.deepEqual(family.state(),journal.finalState,'Complete retained source memory');
});
