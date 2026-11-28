import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {ConfiguredArrivals,configuredScene,configuredTrajectories} from './src/logos-engine/v6-configured-arrivals.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const gz=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,import.meta.url))));
const archive=gz('docs/migration/native-campaigns-v57/baseline-smlp/smlp-public-trace.json.gz').packets;
const extra=gz('tests/fixtures/sic-smlp-alternate-returns.json.gz');
const sum=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const patch=(frame,x,y)=>frame.slice(y-1,y+2).map(row=>row.slice(x-1,x+2));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function pixelCount(a,b){return a.reduce((n,row,y)=>n+row.reduce((s,p,x)=>s+Number(p!==b[y][x]),0),0);}
function directlyVisible(frame,color){
  const centers=[];
  for(let y=1;y+1<frame.length;y++)for(let x=1;x+1<frame[y].length;x++){
    const square=patch(frame,x,y).flat();
    if([1,3,5,7].every(j=>square[j]===color)&&[0,2,4,6,8].every(j=>square[j]!==color))centers.push([x,y]);
  }
  return centers;
}
function measure(frames,scene){
  const paths=Object.fromEntries([...configuredTrajectories(scene,frames)].map(([v,[path,ticks]])=>{
    const seen=frames.map((f,i)=>[i,directlyVisible(f,v)]).filter(([,places])=>places.length>0);
    return [v,{path,ticks,lastVisible:seen.at(-1),goalVisible:seen.find(([,places])=>places.some(p=>same(p,scene.target)))?.[0]??null}];
  }));
  return {goal:scene.target,paths};
}
function present(name,i,real,previous,seed){
  if(i!==1)return {obs:real};
  if(name==='finale')return {obs:{...real,frames:[real.frame]}};
  if(name!=='échantillon')return {obs:real};
  const geometry=configuredScene(previous.frame);
  assert.ok(geometry);
  const paths=configuredTrajectories(geometry,real.frames), last=real.frames.length-1;
  let eligible=[...new Set([...paths.values()].map(([,times])=>times.at(-1)).filter(k=>k>0&&k<last))].sort((a,b)=>a-b);
  if(!eligible.length)eligible=real.frames.map((f,k)=>k>0&&k<last&&!same(f,real.frame)?k:-1).filter(k=>k>=0);
  assert.ok(eligible.length);
  const index=eligible[seed[0]%eligible.length], frames=real.frames.slice();
  frames[index]=frames[index-1];
  return {obs:{...real,frames},variant:{index,eligible}};
}
function expected(i){
  if(i===16)return extra.lastReturn;
  const p=archive[i].packet;
  return {frame:p.frame_rows,frames:p.frame_packet,level:p.level,levelsCompleted:p.levels_completed,
    state:p.state,stepIndex:p.step_index,availableActionIds:p.available_action_refs.map(a=>Number(a.slice(6)))};
}
async function play(game,name,cap,seed){
  const C=ConfiguredArrivals.prototype,hooks=[],events=[],rows=[],edits=[];
  function wrap(key,fn){const original=C[key];hooks.push(mock.method(C,key,function(...args){return fn.call(this,original,args);}));}
  wrap('record',function(original,args){
    const result=original.apply(this,args);
    for(const event of result.events??[]){
      const {kind,before,after,tracks,compatible_route_orders,samples_per_cell,point}=event;
      const measured=kind==='public_configured_arrival_packet'?measure(args[7],configuredScene(args[3],this.grid)):undefined;
      const local=point&&{avant:patch(args[3],...point),après:patch(args[4],...point)};
      events.push({kind,before,after,tracks,compatible_route_orders,samples_per_cell,point,measured,local});
    }
    return result;
  });
  if(name==='sansOrdre')wrap('propose',async function(original,args){
    const p=await original.apply(this,args);
    if(args[0].revision!==10 || p?.support_plan?.v5_proof?.question!=='route_order_discrimination')return p;
    const copy=new ConfiguredArrivals(this.policy);
    copy.restore(this.state());
    const fitting=copy.fit.at(-1), former=fitting.compatible_orders;
    fitting.compatible_orders=0;
    const edited=await original.apply(copy,args);
    edits.push({tour:10,ancien:former,nouveau:fitting.compatible_orders,offre:edited?.kind??null});
    return edited;
  });
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+extra.session;
    let board=game.dispatch({type:'load',code:'SMLP',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i),{obs,variant}=present(name,i,real,previous,seed);
      if(name==='nominal'){
        const {palette,...canonical}=obs;assert.deepEqual(canonical,expected(i));
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,plan=p?.support_plan, proof=plan?.v5_proof;
      rows.push({tour:i+1,niveau:obs.level,score:obs.levelsCompleted,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,sub:p.program_subquestion,
          cmd:ticket.actionRef,data:ticket.data,admis:snapshot.trace.findLast(e=>e.kind==='before_guard')?.admitted,
          refs:p.question?.hypothesis_refs,index:ticket.actionIndex,
          fit:plan?.fit?.at(-1),goal:plan?.target,proof:proof?{question:proof.question,orders:proof.conditional_predictions.map(r=>r.arrival_intervals),
            cohorts:proof.dated_cohorts,domains:proof.route_domains.map(r=>r.status)}:proof},
        ret:previous&&{id:previous.id,ref:outcome?.observation_ref,owner:outcome?.family,match:outcome?.matched,motif:outcome?.reason,
          frames:obs.frames.map(sum),actual:real.frames.map(sum),finale:sum(obs.frame),variant,pixels:pixelCount(previous.frame,obs.frame),
          events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(name==='nominal'){
        const c=i===15?{action_ref:'ACTION5',data:{}}:archive[i+1].command;
        assert.deepEqual([ticket.actionRef,ticket.data],[c.action_ref,c.data??{}]);
      }
      previous={id:ticket.id,frame:obs.frame};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,edits};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['nominal',16]],contrôles:[['finale',2],['sansOrdre',13]],réserve:[['échantillon',2]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap] of groups[group])cases[name]=await play(game,name,cap,seed);}
  finally{clock.mock.restore();}
  return cases;
}
