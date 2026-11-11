import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createNativeV6Runtime } from '../../../../src/logos-engine/v6-native-runtime.ts';
import { MotifAccess } from '../../../../src/logos-engine/v6-motif-access.ts';
const root = new URL('../../../../', import.meta.url), ref = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const declarations = { common: await read(ref + 'laya_proto/common_frontier_policy.drm.json'), strategy: await read(ref + 'morphology_policy/strategy.drm') };
const fixture = await read('tests/fixtures/v6-motif-access-reference.json');
const execution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360000 };
const target = process.argv[2]; if (!target) throw Error('An exclusive output filename is required');
const report = { schema:'sra.lot8a.synthetic-caller-diagnostic.v1', startedAt:new Date().toISOString(), qualification:'Independent synthetic public frames through the production factory; development diagnostic, not a live game or final integrated delivery gate.', trace:[], records:[] };
let runtime;
const describe = result => ({ kind:result.kind, reason:result.reason, command:result.command, authorization:result.authorization, family:result.snapshot.lastDecision, actions:result.snapshot.actions, acquiredRecords:result.snapshot.acquiredRecords, levelsCompleted:result.snapshot.levelsCompleted, proposal:result.snapshot.proposal, whyActStatus:result.snapshot.whyAct?.decision?.decision?.status, analysis:result.snapshot.whyAct?.analysis?.map(x=>x.operation), srcWorkflow:result.snapshot.srcDecision?.workflow });
try {
 runtime = await createNativeV6Runtime(declarations,{now:()=>0});
 const owner = runtime.families.find(x=>x.id==='motif_access'); if (!owner) throw Error('No motif owner');
 const record = owner.record.bind(owner); owner.record = (...args) => { report.records.push({revision:args[0].revision,command:args[2],mode:args[5].steps?.[args[6]]?.mode}); return record(...args); };
 report.implementation=runtime.snapshot().implementation;
 report.initialOwner=owner.state();
 let result=await runtime.initialize({sessionId:'independent-motif-cold-caller-diagnostic',observation:fixture.frames.base.public,budgets:{targetLevels:3,levelActionCaps:[12,12,12],maxActions:36}},execution);
 const steps=[['moved','ACTION4',null],['toggled','ACTION6',[3,20,4,21]],['open','ACTION6',[7,24,8,25]],['walked','ACTION4',null]];
 for(const [name,action,box] of steps){
  report.trace.push({phase:'offer',forFrame:name,...describe(result)});
  if(result.kind!=='action'||result.command?.action_ref!==action||box&&!(box[0]<=result.command.data.x&&result.command.data.x<=box[2]&&box[1]<=result.command.data.y&&result.command.data.y<=box[3])){
   report.status='unexpected_source_offer';report.expected={name,action,box};break;
  }
  result=await runtime.advance({command:result.command,observation:fixture.frames[name].public,executionMs:0},execution);
  report.trace.push({phase:'return',fromFrame:name,...describe(result)});
  if(name==='open'){
   report.acquiredBeforeRestore=owner.state();owner.restore(new MotifAccess().state());report.ownerWasCleared=owner.state();
  }
  if(result.kind==='boundary')result=await runtime.resume(execution);
  if(name==='open')report.restoredBeforeNextAction=owner.state();
 }
 if(!report.status)report.status='completed_declared_synthetic_steps';
 report.finalOffer=describe(result);report.finalOwner=owner.state();
 report.motifEpisodeKeys=report.records.map(item=>({revision:item.revision,value:runtime.authority.memory.get('common-observation-frontier',`motif:${item.revision}`).value}));
} catch(error){report.status='error';report.error={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}
finally{runtime?.close('synthetic-motif-diagnostic-complete');report.finishedAt=new Date().toISOString();await writeFile(target,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,trace:report.trace.map(x=>({phase:x.phase,frame:x.forFrame??x.fromFrame,kind:x.kind,family:x.family,command:x.command,reason:x.reason})),records:report.records,error:report.error}));}
