import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {NativeV6Runtime} from '../src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from '../src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from '../src/runtime/v6-agent-protocol.ts';
import {createSicPairedPassage,pairedPassageId} from '../src/sic/paired-passage.ts';
import {pairedPassageRoom} from './helpers/sic-paired-passage-room.ts';

const [version,dest]=process.argv.slice(2);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const trace=(reply,k)=>reply.snapshot.trace.findLast(t=>t.kind===k);
function offer(reply){
  const t=reply.ticket;
  if(!t)return null;
  const p=reply.snapshot.proposal,guard=trace(reply,'before_guard');
  assert.equal(guard?.admitted,true);
  const {strategy,evidence}=p.sicSituationCard??{};
  return {command:t.actionRef,index:t.actionIndex,id:t.id,observation:t.observationRef,strategy,
    evidence,guard:guard.reason,target:p.route.steps[t.actionIndex].point};
}

async function run(variant,arm,forbidden){
  const room=pairedPassageRoom(variant),family=createSicPairedPassage(),comparisons=[];
  const mode=arm==='reference'?{}:{controlTrialAgenda:{mode:'active',actionBudget:arm==='retenu'?0:1}};
  const service=new V6AgentService(()=>new NativeV6Runtime({families:[family],sourceDigest:'operator-paired-passage',
    now:()=>0,maxPointOccurrences:250,groups:[{id:'follow_visible_passages',families:[pairedPassageId]}],
    observeControlTrialShadow:r=>comparisons.push(structuredClone(r)),...mode}));
  const sessionId='operator-contact-'+Number(variant);
  function observation(seq,cut){
    const raw=room.packet(),ids=[...raw.availableActionIds];
    if(cut&&arm==='inverse')ids.reverse();
    const shown=cut&&arm==='retrait'?ids.filter(v=>'ACTION'+v!==forbidden):ids;
    return toV6PublicObservation({...raw,availableActionIds:shown},seq);
  }
  let sequence=0,reply=await service.handle({type:'init',sessionId,sequence,
    observation:observation(sequence,false),budgets:{targetLevels:3,levelActionCaps:[30,30,30],maxActions:90}});
  async function execute(cut=false){
    assert.ok(reply.ticket,reply.reason);
    const authorization=reply.ticket,selected=offer(reply);
    room.act(authorization);
    const obs=observation(++sequence,cut);
    reply=await service.handle({type:'advance',sessionId,sequence,ticketId:authorization.id,executionMs:1,observation:obs});
    const event=trace(reply,'actual_outcome');
    const reduced={reason:event.reason,matched:event.matched,ref:event.observation_ref,plan:event.sic_plan??null,
      family:event.family,sealed:event.seal_prefix};
    const step={offer:selected,retour:reduced,paquet:hash(obs),image:hash(obs.frame),rewired:room.rewired};
    while(reply.kind==='boundary'&&!reply.ticket)reply=await service.handle({type:'resume',sessionId,sequence});
    return step;
  }
  const earlier=[];
  while(room.level<3){
    assert.ok(earlier.length<40);
    earlier.push(await execute());
  }
  const walk=[await execute(),await execute(true)];
  assert.deepEqual(walk.map(s=>s.offer.strategy),['P07','P07']);
  assert.ok(!room.rewired);
  const at=observation(sequence,true),cut=offer(reply),frozen={image:hash(at.frame),controls:at.availableActionIds,changed:room.rewired};
  let staleGuard=null,retour=null;
  if (cut?.strategy==='P05'){
    const proposal=reply.snapshot.proposal;
    const packet={frame_rows:at.frame};
    const live=family.before(proposal,0,packet,{observation_ref:cut.observation});
    const stale=family.before(proposal,0,packet,{observation_ref:walk[1].offer.observation});
    staleGuard={live,stale};
    assert.equal(live.admitted,true);
    assert.equal(stale.admitted,false);
    retour=await execute();
    assert.ok(room.rewired);
    assert.equal(retour.retour.reason,'passage_connections_rewritten_at_landing');
    assert.equal(retour.retour.matched,true);
  }
  return {variant,arm,earlier:earlier.length,earlierHash:hash(earlier),walk,at:frozen,cut,
    comparisons,staleGuard,retour,rewired:room.rewired};
}

const output=[];
for(const variant of [false,true]){
  const reference=await run(variant,'reference');
  assert.ok(reference.cut);
  output.push(reference);
  for(const phase of ['active','retenu','inverse','retrait'])output.push(await run(variant,phase,reference.cut.command));
}
writeFileSync(dest,JSON.stringify({version,output},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({version,departs:output.length,contacts:output.filter(r=>r.retour).length,
  without:output.filter(r=>!r.cut).length}));
