// Baseline checkout argument must contain the source preceding the coupling-role correction.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const baseline=resolve(process.argv[2]);
const {measureNativeObservation}=await import(pathToFileURL(root+'src/logos-engine/v6-native-observer.ts'));
const rows=gunzipSync(readFileSync(new URL('wa30-strict-bd2c45e5.jsonl.public.jsonl.gz',import.meta.url))).toString().trim().split('\n').map(JSON.parse);
const results=[];
for(const count of [102,105]) {
  const capture=rows.find(row=>row.level===8 && row.proposal.local.count+1===count);
  assert.ok(capture);
  const before={...await measureNativeObservation({frame_rows:capture.first, frame_hash:capture.beforeRef.split(':frame:')[1],state:'NOT_FINISHED',level:8,levels_completed:7,available_action_refs:['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5']},count,'captured-peer-role'),observation_ref:capture.beforeRef,level_epoch:8};
  const output={command:count,limitation:'Offline proposal comparison on the same actual public observation and captured owner context; no game command or full runtime restored.'};
  for(const [name,worktree] of [['before',baseline],['after',root]]) {
    const {createSicVerifyOrientedDelivery}=await import(pathToFileURL(worktree+'/src/sic/oriented-delivery.ts'));
    const family=createSicVerifyOrientedDelivery(capture.proposal.kind);
    await family.attachPrograms({registerProgram:async()=>({run:async({situation})=>({result:situation.routeSupported?'P07':situation.knownInteraction?'P02':'P05',receipt:{}})})});
    family.restore({state:structuredClone(capture.proposal.local)});
    const proposal=await family.propose(before,capture.first,[],100);
    assert.ok(proposal);
    if(name==='before') assert.deepEqual(proposal.step,capture.proposal.step);
    output[name]={step:proposal.step,actions:proposal.actions,reservedParts:proposal.sicSituationCard.reservedParts??[],evidence:proposal.route_refs};
  }
  const associated=capture.proposal.local.transports.find(item=>item.sources.length===1);
  assert.ok(associated);
  assert.ok(output.after.evidence.includes(associated.sources[0]));
  assert.ok(output.after.evidence.includes(capture.proposal.local.sharedEvidence));
  assert.notDeepEqual(output.before.step.route.at(-1).prediction,output.after.step.route.at(-1).prediction);
  results.push(output);
}
writeFileSync(process.argv[3]??'/tmp/wa30-reused-role-counterfactual.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(result=>({command:result.command,beforeReserved:result.before.reservedParts,afterReserved:result.after.reservedParts,beforeApproach:result.before.step.route.at(-1).prediction,afterApproach:result.after.step.route.at(-1).prediction}))));
