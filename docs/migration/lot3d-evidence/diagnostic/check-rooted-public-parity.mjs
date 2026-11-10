/** Read-only own-layer comparison of the frozen native code, source replay and
 * the already captured public journal. No game engine or session is opened. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { RootedLineMemory, rootedLineBefore, rootedLineAfter } from '../../../../src/logos-engine/v6-rooted-line-access.ts';
import { measureRootedLine, physicalRootedLine } from '../../../../src/logos-engine/v6-rooted-line-observation.ts';

const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../../../..');
const session=resolve(root,'docs/migration/lot3d-evidence/final/sk48-rooted-session');
const sha=value=>createHash('sha256').update(value).digest('hex');
const load=path=>JSON.parse(gunzipSync(readFileSync(path)).toString());
const sourcePath=resolve(here,'sk48-public-source-replay.json.gz'), source=load(sourcePath);
const report=load(resolve(session,'sk48-campaign.json.gz'));
const journal=gunzipSync(readFileSync(resolve(session,'sk48-actual-public-journal.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
const observations=new Map(), checks=[];
const equal=(actual,expected,label)=>{ assert.deepStrictEqual(actual,expected,label); checks.push(label); };
function findObservations(value){
  if(Array.isArray(value)){ for(const child of value)findObservations(child); }
  else if(value && typeof value==='object'){
    if(['observation_ref','revision','level_epoch','available_action_refs'].every(key=>key in value))observations.set(value.revision,value);
    else for(const child of Object.values(value))findObservations(child);
  }
}
findObservations(report.inventorySourceCalls);
equal([...observations.keys()].sort((a,b)=>a-b),Array.from({length:13},(_,i)=>i+1),'all 13 actual observations present');
const policyPath=resolve(root,'reference/v6',source.sourceCommit,'source/agents/yf_arc3_v6/morphology_policy/strategy.drm');
const config=JSON.parse(readFileSync(policyPath,'utf8')).declarations[0].configuration.observed_composition_services;
const memory=new RootedLineMemory();
function sameState(expected,label){
  equal(memory.currentState(),{line_memory:expected.memory,line_events:expected.events},label+' own state');
  equal(memory.retainedDigest(expected.parentDigest),expected.digest,label+' digest suffix on opaque original ancestor');
}
sameState(source.initialState,'cold initial');
let used=0;
for(const prefix of source.prefixes){
  sameState(prefix.sourceStateBefore,`prefix ${prefix.index} prior`);
  const observation=observations.get(prefix.revision), rows=journal[used].packet.frame_rows;
  const proposal=memory.propose(structuredClone(observation),structuredClone(rows),[],prefix.prefixLimit,
    {...structuredClone(config),remaining_level_actions:prefix.remainingActions});
  equal(proposal,prefix.sourceProposal,`prefix ${prefix.index} complete own proposal`);
  equal(proposal,prefix.nativeOwnProjection,`prefix ${prefix.index} captured own native projection`);
  for(const step of source.steps.filter(value=>value.prefixIndex===prefix.index)){
    const first=journal[used].packet.frame_rows, later=journal[used+1].packet.frame_rows;
    equal(proposal.actions[step.index],step.command,`return ${step.sequence} command`);
    equal(rootedLineBefore(proposal,step.index,first,step.beforeMeta),step.beforeGuard,`return ${step.sequence} before guard`);
    equal(rootedLineAfter(proposal,step.index,first,later,step.afterMeta),step.afterGuard,`return ${step.sequence} after guard`);
    const measured=measureRootedLine(later);
    equal(measured===null?null:physicalRootedLine(measured),step.observedPhysical,`return ${step.sequence} actual physical projection`);
    const events=memory.record(structuredClone(observations.get(step.beforeRevision)),structuredClone(step.command),
      structuredClone(observations.get(step.afterRevision)),structuredClone(first),structuredClone(later),proposal,step.index);
    equal(events,[step.sourceOwnEvent],`return ${step.sequence} exact source event`);
    equal(events,[step.nativeOwnEvent],`return ${step.sequence} exact captured event`);
    sameState(step.sourceStateAfter,`return ${step.sequence}`);used++;
  }
}
equal(used,12,'all actual returns consumed once');
const terminal=memory.propose(structuredClone(observations.get(13)),structuredClone(journal[12].packet.frame_rows),[],16,
  {...structuredClone(config),remaining_level_actions:588});
equal(terminal,source.terminalSourceRefusal,'terminal own refusal');
sameState(source.finalState,'final');
const restored=new RootedLineMemory();
for(const event of source.finalState.events)restored.applyEvent(structuredClone(event));
equal(restored.currentState(),memory.currentState(),'reconstruct own state from actual source events');
equal(restored.retainedDigest(source.finalState.parentDigest),source.finalState.digest,'reconstruct own digest suffix');
const mismatches=source.steps.filter(step=>step.afterGuard.matched===false);
equal(mismatches.map(step=>step.sequence),[12],'first and sole physical prediction counterexample');
const last=mismatches[0], expected=new Map(last.expectedPhysical.pieces), observed=new Map(last.observedPhysical.pieces);
const pieceDeltas=[...expected].map(([piece,box])=>({piece,expected:box,observed:observed.get(piece),
  observedMinusExpected:observed.get(piece).map((value,i)=>value-box[i])}));
const inputs={};
for(const path of [sourcePath,resolve(session,'sk48-campaign.json.gz'),resolve(session,'sk48-actual-public-journal.jsonl.gz'),
  policyPath,resolve(root,'src/logos-engine/v6-rooted-line-access.ts'),resolve(root,'src/logos-engine/v6-rooted-line-observation.ts'),
  resolve(root,'src/logos-engine/v6-rooted-line-mechanics.ts'),resolve(root,'src/logos-engine/v5-piercing-plan.ts'),
  resolve(root,'src/logos-engine/v5-piercing-contracts.ts'),fileURLToPath(import.meta.url)])inputs[relative(root,path)]=sha(readFileSync(path));
const receipt={schema:'logos-engine.lot3d.rooted-public-native-source-parity.v1',game:'SK48',sourceCommit:source.sourceCommit,
  checks:checks.length,failed:0,labels:checks,prefixes:source.prefixes.length,returns:used,coldStart:true,
  primedFromNativeProposalMemory:false,newGameActions:0,levelJumps:0,inputs,
  sourceOriginalFilesBefore:source.originalFilesVerifiedBefore,sourceOriginalFilesAfter:source.originalFilesVerifiedAfter,
  capturedCommonTerminal:{status:report.final.status,reason:report.final.reason,levelsCompleted:report.final.levelsCompleted},
  replayedOriginalOwnTerminal:source.terminalSourceRefusal,replayedNativeOwnTerminal:terminal,
  counterexample:{sequence:12,conditionalStep:8,command:last.command,rootMatches:JSON.stringify(last.expectedPhysical.root)===JSON.stringify(last.observedPhysical.root),
    tipMatches:last.expectedPhysical.tip===last.observedPhysical.tip,pieceDeltas},
  qualification:'Cold own-layer differential replay only, from captured public observations and actual returns. Source and native agree through the physical counterexample and blocking refusal. This is an inherited model limitation on this observed path, not a demonstrated native translation mismatch. No game mechanics were opened, no repair or further action was attempted, and no complete original caller parity is claimed.'};
const out=resolve(here,'sk48-public-parity.json');writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
process.stdout.write(JSON.stringify({path:relative(root,out),checks:checks.length,prefixes:source.prefixes.length,returns:used,failed:0,terminal,pieceDeltas})+'\n');
