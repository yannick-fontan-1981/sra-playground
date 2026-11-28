import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {TraceFieldMemory} from './src/logos-engine/v6-trace-field-access.ts';
import {OutlineService} from './src/logos-engine/v6-outline-service.ts';
import {OutlinePolicy} from './src/logos-engine/v6-outline-policy.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const load={type:'load',code:'ZIPP',level:1};
const path=[[32,12],[48,12],[48,28],[32,28],[16,28],[16,44],[32,44],[48,44]];
function changed(a,b){
  return a.reduce((s,row,y)=>s+row.reduce((r,v,x)=>r+Number(v!==b[y][x]),0),0);
}
async function play(game,name,cap){
  const F=TraceFieldMemory.prototype,O=OutlineService.prototype,hooks=[],rows=[],recorded=[],outline=[],guards=[],interventions=[];
  const record=F.record,apply=F.applyEvent,before=O.beforeSource,outlineRecord=O.recordSource;
  hooks.push(mock.method(F,'record',function(...args){
    const [before,,after,,,proposal]=args;
    if(name==='sansFrontière'&&proposal.trace_field_plan&&before.level_epoch!==after.level_epoch){
      interventions.push({type:'trace-boundary',ref:after.observation_ref});
      return [];
    }
    const events=record.apply(this,args);
    for(const e of events??[]){
      const t=e.transition;
      if(t)recorded.push(t);
    }
    return events;
  }));
  if(name==='sansSecond'||name==='sansPremier')hooks.push(mock.method(F,'applyEvent',function(e){
    const n=name==='sansSecond'?3:2,target=e.transition?.after_ref;
    if(e.state?.epoch===1&&target?.includes(':revision:'+n+':')){
      const removed=e.state.successes.filter(s=>s.after_ref===target);
      if(removed.length){
        const successes=e.state.successes.filter(s=>s.after_ref!==target);
        interventions.push({type:'trace-edge',ref:target,countBefore:e.state.successes.length,countAfter:successes.length});
        return apply.call(this,{...e,state:{...e.state,successes}});
      }
    }
    return apply.call(this,e);
  }));
  hooks.push(mock.method(O,'recordSource',async function(...args){
    const ret=await outlineRecord.apply(this,args);
    if(ret)outline.push({status:ret.status,evidence:ret.evidence,local:ret.local_count,scope:ret.scope});
    return ret;
  }));
  hooks.push(mock.method(O,'beforeSource',function(p,index,packet,obs){
    const real=before.call(this,p,index,packet,obs);
    if(obs.level_epoch!==2||obs.revision!==14||!p.outline_plan?.operator)return real;
    const {bbox:[l,t,r,b],value}=p.outline_plan.measurement.current;
    const copy=packet.frame_rows.map(row=>row.slice());
    for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)if(x===l||x===r||y===t||y===b)copy[y][x]=(value+1)%16;
    const other=before.call(this,p,index,{...packet,frame_rows:copy},obs);
    const corner=packet.frame_rows.map(row=>row.slice());corner[t][l]=(value+1)%16;
    const local=before.call(this,p,index,{...packet,frame_rows:corner},obs);
    guards.push({ref:obs.observation_ref,real,other,local,pixels:changed(copy,packet.frame_rows),corner:changed(corner,packet.frame_rows),command:p.actions[index].action_ref});
    return name==='contourModifié'?other:real;
  }));
  try {
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime),policy=await OutlinePolicy.create();
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load), previous,prior;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      const shown=name==='stationnaire'&&i===2?{...real,frame:prior.frame,frames:[prior.frame]}:real;
      const start=recorded.length, ol=outline.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,f=p?.trace_field_plan,o=p?.outline_plan,q=ticket&&p.steps?.[ticket.actionIndex];
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard'),publicRelease=snapshot.trace.findLast(x=>x.kind==='sic_native_plan');
      const check=o?.operator&&i===13?(await policy.evaluate({...o.measurement.facts,exact_locus:false}))[0]:null;
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,shown:digest(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:publicRelease?.family??snapshot.lastDecision,kind:p.kind,
          entry:p.field_subquestion??p.material_access_subquestion,action:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          admitted:guard?.admitted,reason:guard?.reason,refs:p.route_refs,anticipated:q?.expected_after,
          trace:f&&{area:f.scene.geometry,shape:f.scene.prefix,paint:f.scene.trace_value,n:f.commands.length,r:f.state.successes.map(s=>s.after_ref),
            source:q.source,target:q.target,measured:q.relation_observed},
          outline:o&&{meaning:o.meaning.kind,current:o.measurement.current,facts:o.measurement.facts,epoch:o.control.level_epoch,
            history:o.control.evidence,withoutFit:check&&{status:check.status,conclusions:check.conclusions,authority:check.release_authority}}},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,seal:outcome.seal_prefix,
          reason:outcome.reason,physical:digest(real.frame),frames:real.frames.map(digest),
          diff:changed(prior.frame,real.frame),events:recorded.slice(start),outline:outline.slice(ol)}});
      if(!ticket||i===cap)break;
      if(i<8&&name!=='stationnaire'){
        assert.equal(ticket.actionRef,'ACTION6');
        assert.deepEqual([ticket.data.x,ticket.data.y],path[i]);
      }
      previous={id:ticket.id};prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,guards,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,gameRoot){
  const sets={nominal:{nominal:16,stationnaire:2,sansPremier:4,sansSecond:4},contours:{sansFrontière:14,contourModifié:13}};
  assert.ok(Object.hasOwn(sets,group));
  const game=await sourceBackend(gameRoot),cases={};
  for(const [name,cap] of Object.entries(sets[group]))cases[name]=await play(game,name,cap);
  return cases;
}
