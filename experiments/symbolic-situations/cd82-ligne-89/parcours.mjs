import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {SurfaceProgram} from './src/logos-engine/v6-surface-program.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function changed(a,b,box){
  if(!box)return null;
  const [l,t,r,f]=box;
  let count=0;
  for(let y=t;y<=f;y++)for(let x=l;x<=r;x++)if(a[y][x]!==b[y][x])count++;
  return count;
}
async function play(game,arm,cap){
  const M=SurfaceProgram.prototype,{record,before,start}=M;
  const rows=[],events=new Map(),guards=new Map(),controls=[];
  let observedModels;
  const hooks=[mock.method(M,'record',function(b,a,cmd,f,s,p,index){
    const result=record.call(this,b,a,cmd,f,s,p,index);
    if(b.revision===1)observedModels={models:structuredClone(this.models),keys:[...this.keys],ref:a.observation_ref};
    if(result){
      const detail=result.events?.[0]?.detail??result.events?.[0]??result.event?.detail??result;
      events.set(a.observation_ref,structuredClone({before:b.observation_ref,after:a.observation_ref,retained:this.prior,
        models:this.models?.length??null,origin:this.passed?.at(-1)?.ref??null,outcome:detail.compatible_labels??null,
        epoch:a.level_epoch}));
    }
    return result;
  })];
  hooks.push(mock.method(M,'before',function(p,index,packet,obs){
    const result=before.call(this,p,index,packet,obs);
    if(obs.level_epoch===2&&obs.revision===10){
      const plan=p.surface_plan;
      const [x,y]=plan.fixed_reference;
      const edited=packet.frame_rows.map(r=>[...r]);
      edited[y][x]=(edited[y][x]+1)%16;
      const [u,v]=plan.editable_candidate;
      const refOther=before.call(this,p,index,{...packet,frame_rows:edited},obs);
      const work=packet.frame_rows.map(r=>[...r]);
      work[v][u]=(work[v][u]+1)%16;
      const editableOther=before.call(this,p,index,{...packet,frame_rows:work},obs);
      const refStale=before.call(this,p,index,packet,{...obs,observation_ref:obs.observation_ref+':ancien'});
      guards.set(obs.observation_ref,{reference:refOther.admitted,edit:editableOther.admitted,stale:refStale.admitted});
    }
    return result;
  }));
  if(arm!=='nominal')hooks.push(mock.method(M,'start',function(obs,...args){
    if(obs.level_epoch!==2||controls.length)return start.call(this,obs,...args);
    const old=this.prior;
    assert.equal(old.models.length,1);
    if(arm==='sansModèle')this.prior=null;
    if(arm==='autreDomaine')this.prior={...old,keys:old.keys.map((key,i)=>i===0?key+':autre':key)};
    if(arm==='hypothèseN1'){
      const j=observedModels.keys.indexOf('ACTION5');
      assert.deepEqual(observedModels.keys,old.keys);
      assert.ok(j>=0);
      const wrong=observedModels.models.find(m=>m[0][j]!=='write');
      assert.ok(wrong);
      this.prior={...old,models:[wrong]};
    }
    controls.push(structuredClone({original:old,used:this.prior,source:this.passed.at(-1)?.ref,early:observedModels.ref}));
    try{return start.call(this,obs,...args);}finally{this.prior=old;}
  }));
  try{
    let shown=game.dispatch({type:'load',code:'CD82',level:1}),prior,previous;
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    for(let i=0;i<=cap;i++){
      const observation=toV6PublicObservation(shown,i);
      let reply=await service.handle({sessionId,sequence:i,observation,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,
          levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,q=p?.surface_plan;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,ref:ticket?.observationRef,photo:digest(observation.frame),niveau:observation.level,
        score:observation.levelsCompleted,arrêt:reply.reason??null,ticket:ticket&&{
          id:ticket.id,kind:p.kind,owner:snapshot.lastDecision,command:ticket.actionRef,point:ticket.data,
          admis:guard?.admitted,refs:p.route_refs,guards:guards.get(ticket.observationRef),
          plan:q&&{models:q.label_assignments_left,target:q.fixed_reference,surface:q.editable_candidate,
            program:q.backward_program,pose:q.current_pose,hue:q.current_hue}},ret:previous&&{
              id:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
              surface:changed(prior.frame,observation.frame,previous.surface),fixed:changed(prior.frame,observation.frame,previous.target),
              event:events.get(outcome.observation_ref),packet:digest(observation.frames)}});
      if(!ticket||i===cap)break;
      previous={id:ticket.id,surface:q?.editable_candidate,target:q?.fixed_reference};
      prior=observation;
      const id=Number(ticket.actionRef.slice(6));
      shown=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,controls};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={nominal:[['nominal',16]],contrôles:[['sansModèle',11],['autreDomaine',11],['hypothèseN1',11]]};
  assert.ok(Object.hasOwn(sets,group));
  const results={};
  for(const [arm,cap] of sets[group])results[arm]=await play(game,arm,cap);
  return results;
}
