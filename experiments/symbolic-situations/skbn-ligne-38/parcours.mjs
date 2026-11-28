import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {ObservedInventory} from './src/logos-engine/v6-observed-inventory.ts';
import {locate} from './src/logos-engine/v6-inventory-measurements.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const changes=(a,b)=>a.flatMap((row,y)=>row.flatMap((v,x)=>v===b[y][x]?[]:[[x,y]]));
const inside=([x,y],[l,t,r,b])=>l<=x&&x<=r&&t<=y&&y<=b;
async function play(game,code,name,budget,cap=budget){
  const M=ObservedInventory.prototype,cuts=new Map(),returns=new Map(),records=new Map(),rows=[],hooks=[];
  const {after,recordSource,project,before}=M;
  hooks.push(mock.method(M,'recordSource',function(...args){
    const [b,a,cmd]=args;
    const former=this.access_returns.map(x=>x.evidence);
    const out=recordSource.apply(this,args);
    const added=this.access_returns.filter(x=>!former.some(e=>JSON.stringify(e)===JSON.stringify(x.evidence)));
    if(args[5]?.inventory_plan||added.length)records.set(a.observation_ref,{avant:b.observation_ref,
      commande:cmd.action_ref,acquis:added.map(x=>({status:x.status,evidence:x.evidence,objective:x.objective_ref})),
      propre:out?.status??out?.kind??null});
    return out;
  }));
  hooks.push(mock.method(M,'after',function(...args){
    const [proposal,index,b,a,first,second]=args;
    const out=after.apply(this,args);
    const step=proposal.steps[index],offer=proposal.inventory_plan.offer;
    const regions=[step.body_before,step.expected_after?.body_bbox,offer.target.source_bbox].filter(Array.isArray);
    const changed=changes(first,second);
    returns.set(a.observation_ref,{avant:b.observation_ref,position:locate(second,offer.core),
      confirmée:out.body_position_matched,matched:out.matched,scellé:out.seal_prefix,pixels:changed.length,
      hors:changed.filter(p=>!regions.some(r=>inside(p,r))).length});
    return out;
  }));
  hooks.push(mock.method(M,'before',function(p,index,packet,obs){
    const out=before.call(this,p,index,packet,obs);
    if(index===0){
      const stale=before.call(this,p,index,packet,{...obs,observation_ref:obs.observation_ref+':autre'});
      cuts.set(obs.observation_ref,{...cuts.get(obs.observation_ref),stale:stale.admitted});
    }
    return out;
  }));
  if(name==='sansMesure'||name==='référenceÉtrangère')hooks.push(mock.method(M,'project',function(request){
    const obs=this.context[0];
    if(obs.revision!==14)return project.call(this,request);
    const controls=this.tracker.controls,original=controls.ACTION1;
    assert.ok(original);
    assert.ok(Array.isArray(original.evidence));
    const alternative=Object.values(controls).find(v=>v!==original&&v.evidence?.length);
    assert.ok(alternative);
    const intervention=structuredClone({original:original.evidence,alternative:alternative.evidence,type:name});
    cuts.set(obs.observation_ref,{...cuts.get(obs.observation_ref),intervention});
    if(name==='sansMesure')delete controls.ACTION1;
    else controls.ACTION1={...original,evidence:alternative.evidence};
    try{return project.call(this,request);}finally{controls.ACTION1=original;}
  }));
  if(['sansAccès','preuveÉtrangère','sansSignature'].includes(name))hooks.push(mock.method(M,'project',function(request){
    const obs=this.context[0];
    const target=name==='sansSignature'?6:9;
    if(obs.revision!==target)return project.call(this,request);
    const access=this.access_returns,display=this.tracker.displayed;
    if(name==='sansSignature'){
      assert.ok(display);
      cuts.set(obs.observation_ref,{type:name,signature:display.source_value,box:display.display_bbox});
      this.tracker.displayed=null;
    }else{
      assert.equal(access.length,1);
      const [premature]=access[0].evidence;
      const previous=rows.at(-2)?.ticket?.ref;
      assert.ok(previous);
      const changed=[previous,premature];
      cuts.set(obs.observation_ref,{type:name,original:structuredClone(access[0].evidence),remplacement:changed});
      this.access_returns=name==='sansAccès'?[]:[{...access[0],evidence:changed,before:previous,after:premature}];
    }
    try{return project.call(this,request);}finally{this.access_returns=access;this.tracker.displayed=display;}
  }));
  try{
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    let board=game.dispatch({type:'load',code,level:1}),prior,previous,previousOffer;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      let shown=real;
      if(i===14&&name==='stationnaire')shown={...prior,stepIndex:i,frames:[prior.frame]};
      if(i===14&&name==='conservation'){
        assert.equal(previousOffer.kind,'endpoint_approach_candidate');
        const areas=[previousOffer.scene.body,previousOffer.target.source_bbox];
        const fixed=prior.frame.map((r,y)=>r.map((v,x)=>areas.some(a=>inside([x,y],a))?real.frame[y][x]:v));
        shown={...real,frame:fixed,frames:[fixed]};
      }
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,offer=p?.inventory_plan?.offer;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      const used=offer&&structuredClone({kind:offer.kind,body:offer.scene.body,cell:offer.target?.source_cell,box:offer.target?.source_bbox,
        role:offer.target?.endpoint_role,visé:offer.target?.observed_at,
        displayed:offer.scene.displayed_candidate?.display_bbox??null,control:offer.route?.prefix?.[0]?.control?.evidence,
        retained:offer.scene.retained_material_surfaces?.length??null,
        dependency:offer.target?.dependency_return?.evidence??p.inventory_plan?.dependency_return?.evidence,
        expected:ticket&&p.steps?.[ticket.actionIndex]?.expected_after?.body_bbox});
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,vu:digest(shown.frame),arrêt:reply.reason??null,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,command:ticket.actionRef,
          data:ticket.data,admitted:guard?.admitted,reason:guard?.reason,scope:cuts.get(ticket.observationRef),
          evidence:structuredClone(p.bundle_template?.evidence),offer:used},
        ret:previous&&{id:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          original:changes(prior.frame,real.frame).length,servi:changes(prior.frame,shown.frame).length,packet:digest(real.frames),
          mesure:returns.get(outcome.observation_ref),acquisition:records.get(outcome.observation_ref)}});
      if(!ticket||i===cap)break;
      previous=ticket;previousOffer=offer;prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return rows;
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={catalogue:[['hist',16]],suite:[['nominal',19],['stationnaire',19,15],['conservation',19,15]],
    retrait:[['sansMesure',19,14],['référenceÉtrangère',19,14]]};
  if(Object.hasOwn(sets,group)){
    const results={};
    for(const [name,...args] of sets[group])results[name]=await play(game,'SKBN',name,...args);
    return results;
  }
  const companion=/^jeu-([A-Z0-9]{4})$/.exec(group);
  if(companion)return {[companion[1]]:await play(game,companion[1],'companion',16)};
  if(group==='preuve-KEYD'){
    const results={};
    for(const [name,limit] of [['sansSignature',6],['sansAccès',9],['preuveÉtrangère',9]])
      results[name]=await play(game,'KEYD',name,16,limit);
    return results;
  }
  throw new Error('Groupe inconnu '+group);
}
