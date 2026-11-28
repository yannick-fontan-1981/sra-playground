import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {NativeMorphologyFamily} from './src/logos-engine/v6-morphology-family.ts';
import {NativeMorphologyPolicy} from './src/logos-engine/v6-morphology-policy.ts';

const source=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const trace=JSON.parse(gunzipSync(readFileSync(new URL('docs/migration/lot2c-evidence/final/ls20-method-continuation/ls20-public-trace.json.gz',import.meta.url)))).packets;
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function nominal(i){
  const p=trace[i].packet;
  return {frame:p.frame_rows,frames:p.frame_packet,level:p.level,levelsCompleted:p.levels_completed,state:p.state,
    stepIndex:p.step_index,availableActionIds:p.available_action_refs.map(v=>Number(v.slice(6)))};
}
const policyDecision=x=>({ref:x.observation_ref,route:x.route_key,bindings:x.route_bindings,authority:x.release_authority,reason:x.reason});
function crop(frame,bbox){
  if(!bbox)return null;
  const [y0,x0,y1,x1]=bbox,values={};
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const color=frame[y][x];values[color]=(values[color]??0)+1;
  }
  return {n:(x1-x0+1)*(y1-y0+1),hist:values};
}
async function play(game,name,cap,budget){
  const F=NativeMorphologyFamily.prototype,P=NativeMorphologyPolicy.prototype,hooks=[],events=[],rows=[],interventions=[];
  const original=P.evaluate,record=F.record;
  let turn=1;
  if(['orientation','périmée','sansSélectif'].includes(name))hooks.push(mock.method(P,'evaluate',async function(facts){
    const route=name==='sansSélectif'?'peer':'modifier',at=name==='sansSélectif'?14:7;
    if(turn!==at||!facts.routes?.[route])return original.call(this,facts);
    const observed=await original.call(this,facts);
    if(observed.route_key!==route)return observed;
    let altered;
    if(name==='orientation')altered={...facts,orientation_relation:'ambiguous',feature_residuals:{...facts.feature_residuals,orientation:'ambiguous',orientation_alternatives:[]}};
    if(name==='périmée')altered={...facts,routes:{...facts.routes,modifier:{...facts.routes.modifier,observation_ref:rows[4].ticket.ref}}};
    if(name==='sansSélectif')altered={...facts,single_pattern_contact_change:false,single_pattern_change_observation_ref:null};
    const result=await original.call(this,altered);
    interventions.push({tour:turn,nominal:policyDecision(observed),altéré:policyDecision(result),
      avant:{pair:facts.pair_ref,orientation:facts.orientation_relation,selective:facts.single_pattern_change_observation_ref,binding:facts.routes[route]},
      après:{pair:altered.pair_ref,orientation:altered.orientation_relation,selective:altered.single_pattern_change_observation_ref,binding:altered.routes[route]}});
    return result;
  }));
  hooks.push(mock.method(F,'record',async function(...args){
    const result=await record.apply(this,args);
    for(const e of result.events??[]){
      const plan=args[5]?.morphology_plan;
      const counts=e.unchanged_peer?[crop(args[3],e.unchanged_peer),crop(args[4],e.unchanged_peer)]:null;
      events.push({...e,parent:args[0].observation_ref,route:plan?.route_key,peerCounts:counts});
    }
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'LS20',level:1}),previous,prior;
    const divergence=({orientation:7,périmée:7,sansSélectif:14,stationnaire:10})[name]??Infinity;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i),{palette,...canonical}=actual;
      if(i<divergence||i===divergence&&name==='stationnaire')assert.deepEqual(canonical,nominal(i));
      const shown=name==='stationnaire'&&i===10?{...actual,frame:prior.frame,frames:[prior.frame]}:actual;
      const frames=actual.frames.map(digest),start=events.length;
      turn=i+1;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.morphology_plan;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          admitted:guard?.admitted,guard:guard?.reason,route:plan?.route_key,pair:plan?.pair,facts:plan?.facts,
          step:plan?.steps[ticket.actionIndex],remaining:plan?.steps.length,epoch:plan?.level_epoch},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          réel:frames,servi:shown.frames.map(digest),finale:digest(actual.frame),présenté:digest(shown.frame),events:events.slice(start),
          différence:prior.frame.reduce((s,row,y)=>s+row.reduce((k,v,x)=>k+Number(v!==actual.frame[y][x]),0),0)}});
      if(!ticket||i===cap)break;
      if(i+1<divergence||i+1===divergence&&name==='stationnaire'){
        const command=trace[i+1].command;
        assert.deepEqual([ticket.actionRef,ticket.data],[command.action_ref,command.data??{}]);
      }
      previous={id:ticket.id};prior=shown;
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,gameRoot){
  const sets={nominal:{catalogue:[16,16],prolongé:[18,19]},contrôles:{orientation:[7,19],périmée:[7,19],sansSélectif:[14,19],stationnaire:[10,19]}};
  assert.ok(Object.hasOwn(sets,group));
  const game=await sourceBackend(gameRoot),cases={};
  for(const [k,[cap,budget]] of Object.entries(sets[group]))cases[k]=await play(game,k,cap,budget);
  return cases;
}
