import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { mock } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from './scripts/sic-study-source-games.mjs';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { OrientedCoupling } from './src/logos-engine/v6-oriented-coupling.ts';
import { EffectAccess } from './src/logos-engine/v6-effect-access.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from './src/runtime/v6-agent-protocol.ts';

const base=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,base)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const archived=new URL('docs/migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz',import.meta.url);
const trace=JSON.parse(gunzipSync(readFileSync(archived))).packets;
const sum=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function changes(before,after) {
  const points=[];
  for(let y=0;y<after.length;y++)for(let x=0;x<after[y].length;x++)if(before[y][x]!==after[y][x])points.push([x,y]);
  return points;
}
function components(points) {
  const remaining=new Set(points.map(([x,y])=>y*64+x)), groups=[];
  for(const [x,y] of points){
    if(!remaining.delete(y*64+x))continue;
    const group=[[x,y]];
    for(const [u,v] of group){
      for(const [a,b] of [[u-1,v],[u+1,v],[u,v-1],[u,v+1]])if(a>=0 && a<64 && remaining.delete(b*64+a))group.push([a,b]);
    }
    groups.push(group);
  }
  return groups;
}
function present(name,i,real,prior,seed) {
  if ((name==='stationnaire26'&&i===3)||(name==='stationnaire31'&&i===16)||(name==='complément31'&&i===17))
    return {obs:{...real,frame:prior,frames:real.frames.map(()=>prior)}};
  if(name!=='composante26'||i!==3)return {obs:real};
  const groups=components(changes(prior,real.frame));assert.ok(groups.length);
  const index=seed[0]%groups.length;
  const kept=new Set(groups[index].map(p=>String(p)));
  const apply=f=>f.map((row,y)=>row.map((px,x)=>kept.has(String([x,y]))?px:prior[y][x]));
  return {obs:{...real,frame:apply(real.frame),frames:real.frames.map(apply)},groupSizes:groups.map(x=>x.length)};
}
async function gameRun(game,name,cap,budget,seed){
  const rows=[],acquired=[],offers=[],interventions=[],hooks=[];
  let turn=0;
  const O=OrientedCoupling.prototype,E=EffectAccess.prototype;
  function wrap(owner,key,fn){
    const original=owner[key];
    hooks.push(mock.method(owner,key,function(...args){return fn.call(this,original,args);}));
  }
  wrap(O,'record',function(original,args){
    const result=original.apply(this,args);
    acquired.push({family:'oriented_coupling',events:result.events?.map(e=>({kind:e.kind,ref:e.evidence,delta:e.delta}))??[],
      held:this.held,coupled:this.coupled,tried:this.tried.size,invitation:this.invitation});
    return result;
  });
  wrap(E,'record',async function(original,args){
    const events=await original.apply(this,args);
    for(const e of events) if(e.kind==='pre_score_effect_contact')acquired.push({family:'pre_score_contact',
      kind:e.kind,before:e.before_ref,after:e.after_ref,key:e.trial_key,role:e.role,action:e.action,vector:e.provisional_vector,
      measured:e.input_status,remoteExpected:e.expected_families,remoteMatched:e.matched_families,score:e.score_delta,retained:this.tried.has(e.trial_key)});
    return events;
  });
  if(name==='sansInvitation')wrap(O,'propose',async function(original,args){
    if(turn!==3)return original.apply(this,args);
    const previous=this.invitation;
    interventions.push({turn,invitation:previous});this.invitation=null;
    try{return await original.apply(this,args);}
    finally{this.invitation=previous;}
  });
  if(name==='retraitInterne26')wrap(O,'frontalContactTrial',function(original,args){
    const value=original.apply(this,args);
    if(turn!==3)return value;
    interventions.push({turn,eligible:Boolean(value)});return null;
  });
  wrap(E,'propose',async function(original,args){
    const p=await original.apply(this,args), offer=p?.effect_plan;
    if(!offer)return p;
    offers.push({turn,ref:offer.observation_ref,site:offer.site,eligible:offer.reachable_contact_alternatives});
    if(name==='retrait31'&&turn===16){
      interventions.push({turn,site:offer.site});
      return {status:'abstained',reason:'no_reachable_bound_effect_question'};
    }
    return p;
  });
  if(name==='autre31'||name==='retraitInterne31')wrap(E,'selectInitialContact',function(original,args){
    if(turn!==16)return original.apply(this,args);
    interventions.push({turn,eligible:args[0]});
    return name==='autre31'?1:null;
  });
  if(name==='sansAcquisition')wrap(E,'applyEvent',function(original,args){
    if(turn===17 && args[0].kind==='pre_score_effect_contact'){
      interventions.push({turn,ref:args[0].after_ref});return;
    }
    return original.apply(this,args);
  });
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'WA30',level:1}), previous;
    for(let i=0;i<=cap;i++){
      turn=i+1;
      const real=toV6PublicObservation(board,i),{obs,groupSizes}=present(name,i,real,previous?.frame,seed);
      if(name==='catalogue'||name==='prolongé'){
        const p=trace[i].packet;
        for(const [a,b] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed'],['stepIndex','step_index'],['state','state']])
          assert.deepEqual(obs[a],p[b],i+' '+a);
        assert.deepEqual(obs.availableActionIds,p.available_action_refs.map(id=>Number(id.slice(6))));
      }
      const start=acquired.length, beginning=offers.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,contact=p?.effect_plan, step=ticket&&p.steps[ticket.actionIndex];
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({turn,status:reply.kind,level:obs.level,snapshot:sum(real.frame),offers:offers.slice(beginning),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,sub:p.material_access_subquestion,
          cmd:ticket.actionRef,data:ticket.data,admitted:guard?.admitted,refs:p.question?.hypothesis_refs,
          pose:step?.expected_before?.pose,face:step?.expected_before?.face,expected:step?.expected_after,
          site:contact?.site,origin:contact?.prefix[0].from,effect:contact?.prefix[0].effect,eligible:contact?.reachable_contact_alternatives,key:contact?.trial_key},
        ret:previous&&{id:previous.id,ref:outcome?.observation_ref,owner:outcome?.family,matched:outcome?.matched,reason:outcome?.reason,
          physical:sum(real.frame),served:sum(obs.frame),physicalFrames:real.frames.map(f=>changes(previous.frame,f).length),
          observedFrames:obs.frames.map(f=>changes(previous.frame,f).length),groupSizes,list:acquired.slice(start)}});
      if(!ticket||i===cap)break;
      if(name==='catalogue'||name==='prolongé')assert.deepEqual([ticket.actionRef,ticket.data],[trace[i+1].command.action_ref,trace[i+1].command.data]);
      previous={id:ticket.id,frame:obs.frame};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,interventions,budget};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16],['prolongé',19,19]],
    contrôles:[['sansInvitation',4,16],['retrait31',17,19],['sansAcquisition',16,19],['complément31',17,19]],
    réserve:[['composante26',3,16],['stationnaire26',3,16],['stationnaire31',16,19]],
    branche:[['retraitInterne26',4,16],['autre31',17,19],['retraitInterne31',17,19]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await gameRun(game,name,cap,budget,seed);}
  finally{clock.mock.restore();}
  return cases;
}
