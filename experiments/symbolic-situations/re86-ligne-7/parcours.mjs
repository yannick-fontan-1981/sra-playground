import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {ConstellationCover,ConstellationEvidence} from './src/logos-engine/v6-constellation-cover.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const gz=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,import.meta.url))));
const trace=gz('docs/migration/native-campaigns-v54/baseline-re86/re86-public-trace.json.gz').packets;
const alternate=gz('tests/fixtures/sic-re86-alternate-returns.json.gz');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function points(a,b){return b.flatMap((row,y)=>row.flatMap((p,x)=>p===a[y][x]?[]:[[x,y]]));}
function componentSets(points) {
  const pending=new Set(points.map(String)), groups=[];
  for(const first of points){
    if(!pending.delete(String(first)))continue;
    const region=[first];
    for(const [x,y] of region){
      for(const p of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(pending.delete(String(p)))region.push(p);
    }
    groups.push(region);
  }
  return groups;
}
function serve(name,seq,real,prior,seed){
  if((name==='stationnaire'&&seq===1)||(name==='stationnaire8'&&seq===8))
    return {obs:{...real,frame:prior,frames:real.frames.map(()=>prior)}};
  if(name!=='composante'||seq!==8)return {obs:real};
  const groups=componentSets(points(prior,real.frame));
  const kept=new Set((groups.length?groups[seed[0]%groups.length]:[]).map(String));
  const edit=frame=>frame.map((row,y)=>row.map((p,x)=>kept.has(String([x,y]))?p:prior[y][x]));
  return {obs:{...real,frame:edit(real.frame),frames:real.frames.map(edit)},composantes:groups.map(p=>p.length)};
}
function nominal(i){
  const p=trace[i].packet;
  return {frame:p.frame_rows,frames:p.frame_packet,level:p.level,levelsCompleted:p.levels_completed,
    state:p.state,stepIndex:p.step_index,availableActionIds:p.available_action_refs.map(v=>Number(v.slice(6)))};
}
async function play(game,name,cap,budget,seed){
  const C=ConstellationCover.prototype,E=ConstellationEvidence.prototype, hooks=[],rows=[],events=[],interventions=[];
  const record=E.record, propose=C.propose;
  if(name==='alternative')hooks.push(mock.method(C,'propose',function(...args){
    if(args[0].revision!==1)return propose.apply(this,args);
    const [obs,rows,inputs,remaining]=args;
    assert.ok(inputs.some(a=>a.action_ref==='ACTION1'));
    interventions.push({tour:1,retirée:'ACTION1',départ:obs.observation_ref});
    return propose.call(this,obs,rows,inputs.filter(a=>a.action_ref!=='ACTION1'),remaining);
  }));
  hooks.push(mock.method(E,'record',async function(...args){
    const result=await record.apply(this,args);
    events.push({ref:result.ref,before:args[0].observation_ref,status:result.status,mode:result.mode,
      vector:result.measured_vector,seléction:result.selection_local_occlusion_observed,poses:result.owner_poses,
      supports:result.acquired_supports?.map(s=>({owner:s.owner,palette:s.palette_value,pixels:s.relative_support_pixels.length,refs:s.evidence_refs})),
      complete:result.ownership_complete,bodies:result.acquired_bodies,tried:[...this.tried].length});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+alternate.session;
    let board=game.dispatch({type:'load',code:'RE86',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i),{obs,composantes}=serve(name,i,real,previous?.frame,seed);
      if(name==='catalogue'||name==='prolongé'||name==='alternative'){
        const {palette,...canonical}=real;
        assert.deepEqual(canonical,name==='alternative'&&i>0?alternate.observations[i-1]:nominal(i));
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal, plan=p?.constellation_plan, step=ticket&&p.steps[ticket.actionIndex];
      rows.push({tour:i+1,niveau:obs.level,score:obs.levelsCompleted,ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,
        owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,index:ticket.actionIndex,mode:step?.mode,
        poses:step?.poses,expected:step?.expected_after,cursor:step?.cursor,vectors:plan?.control_vectors,selector:plan?.selector,
        bodies:plan?.acquired_bodies,active:plan?.active,complete:plan?.ownership_complete,refs:p.question?.hypothesis_refs,
        admitted:snapshot.trace.findLast(e=>e.kind==='before_guard')?.admitted},
        ret:previous&&{id:previous.id,ref:outcome.observation_ref,owner:outcome.family,matched:outcome.matched,reason:outcome.reason,
          packet:hash([real.frame,real.frames]),shown:hash([obs.frame,obs.frames]),
          pixels:[points(previous.frame,real.frame).length,points(previous.frame,obs.frame).length],composantes,events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(name==='catalogue'||name==='prolongé')assert.equal(ticket.actionRef,trace[i+1].command.action_ref);
      if(name==='alternative')assert.equal(ticket.actionRef,'ACTION'+alternate.commands[i].id);
      previous={id:ticket.id,frame:obs.frame};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6))});
    }
    return {rows,interventions,budget};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16]],prolongé:[['prolongé',27,30]],alternative:[['alternative',29,32]],
    réserve:[['stationnaire',1,16],['composante',8,30],['stationnaire8',8,30]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await play(game,name,cap,budget,seed);}
  finally{clock.mock.restore();}
  return cases;
}
