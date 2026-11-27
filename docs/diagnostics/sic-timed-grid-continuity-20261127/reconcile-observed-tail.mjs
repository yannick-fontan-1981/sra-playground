// Offline native reconciliation of already returned public observations only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { NativeV6Runtime } from '../../../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../../../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../../../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../../../src/sic/navigate-revealed-grid.ts';
const [captureFile,tailFile,outputFile]=process.argv.slice(2);
const capture=JSON.parse(readFileSync(captureFile,'utf8')), tail=JSON.parse(readFileSync(tailFile,'utf8'));
const transitions=[...capture.learning.map((x,i)=>({index:i+1,action:x.action,before:x.before,after:x.after})),
...capture.publicEvidence.map(x=>({index:x.index,action:x.action,before:x.publicBefore,after:x.publicAfter})),...tail.tail];
const family=createSicNavigateRevealedGrid();const runtime=new NativeV6Runtime({families:[family],sourceDigest:'observed-tail-native-diagnostic',maxPointOccurrences:300});
const service=new V6AgentService(()=>runtime),sessionId='observed-tail-native-diagnostic';
const packet=(v,stepIndex)=>toV6PublicObservation({...v,gameCode:'PUBLIC',levelCount:6,frames:v.frames??[v.frame],canUndo:false,canSelectLevel:false,defaultFps:10},stepIndex);
let sequence=0,reply=await service.handle({type:'init',sessionId,sequence,observation:packet(transitions[0].before,0),budgets:{targetLevels:6,levelActionCaps:[80,80,80,80,80,80]}});
const observations=[];
for(const step of transitions){
 if(!reply.ticket) reply=await service.handle({type:'resume',sessionId,sequence});
 assert.ok(reply.ticket,'Missing ticket '+step.index);assert.equal(reply.ticket.actionRef,'ACTION'+step.action.id,'Command '+step.index);
 const offered=structuredClone(reply.snapshot.proposal), ticket=structuredClone(reply.ticket), beforeState=structuredClone(family.state());
 reply=await service.handle({type:'advance',sessionId,sequence:++sequence,ticketId:ticket.id,executionMs:1,observation:packet(step.after,sequence)});
 if(step.index>=149) observations.push({index:step.index,ticket,proposal:offered,beforeState,afterState:structuredClone(family.state()),afterNative:reply.snapshot.observation,
  actual:reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome'),seal:reply.snapshot.trace.findLast(x=>x.kind==='sealed_prefix'),nextTicket:reply.ticket});
}
if(!reply.ticket) reply=await service.handle({type:'resume',sessionId,sequence});
const next={ticket:reply.ticket,proposal:reply.snapshot.proposal};
runtime.close('diagnostic_complete');
writeFileSync(outputFile,JSON.stringify({diagnosticOnly:true,reconciledCommands:sequence,observations,next}));
for(const x of observations.filter(x=>x.index>=157)){const p=x.proposal,l=p.local;console.log(JSON.stringify({index:x.index,ticket:{action:x.ticket.actionRef,decision:x.ticket.decisionRevision,index:x.ticket.actionIndex},choice:p.choice,walk:p.walk,hold:p.hold,position:l.last.position,afterPosition:x.afterState.state?.last.position,actual:x.actual,seal:x.seal,clock:l.timing?.clock}));}
console.log(JSON.stringify({next,outputFile}));
