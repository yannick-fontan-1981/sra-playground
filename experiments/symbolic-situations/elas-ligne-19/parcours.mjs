import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {MetricComposition,measuredMetricScene,measuredMetricState,metricTargetCandidates,metricVisible} from './src/logos-engine/v6-metric-composition.ts';

const source=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const load={type:'load',code:'ELAS',level:1};
const short=[6,1,6,1,1,4,6,1,6,1,3];
const step=(game,id,data)=>game.dispatch({type:'action',actionId:id,...(id===6?{data}:{})});
function projection(x){
  return x&&{grid:x.grid_ref,target:x.target_ref,fills:x.fills,selected:x.selected,bounds:[x.xs[0],x.ys[0],x.xs.at(-1),x.ys.at(-1)],visibleTarget:x.target};
}
function alternative(game){
  const first=toV6PublicObservation(game.dispatch(load),0);
  const click={x:17,y:13},choice=toV6PublicObservation(step(game,6,click),1),effect=toV6PublicObservation(step(game,1),2);
  return {choice,summary:{first:digest(first.frame),click,action:'ACTION6',choice:projection(measuredMetricScene(choice.frame)),
    effect:projection(measuredMetricScene(effect.frame)),physique:[digest(choice.frame),digest(effect.frame)],
    niveau:effect.level,score:effect.levelsCompleted}};
}
async function play(game,name,cap,other){
  const F=MetricComposition.prototype,events=[],guards=[],rows=[],hooks=[],interventions=[];
  const before=F.before,record=F.record,assess=F.after;
  if(name==='référenceRecalculée')hooks.push(mock.method(F,'after',function(p,i,a,b,first,second){
    const current=assess.call(this,p,i,a,b,first,second);
    if(b.revision!==6)return current;
    const measured=measuredMetricScene(second);
    assert.notEqual(measured.target_ref,p.support_plan.target_ref);
    const changed={...p,support_plan:{...p.support_plan,target_ref:measured.target_ref}};
    const compared=assess.call(this,changed,i,a,b,first,second);
    interventions.push({retour:b.observation_ref,offre:p.support_plan.target_ref,mesure:measured.target_ref,current,compared});
    return compared;
  }));
  if(name==='nominal')hooks.push(mock.method(F,'before',function(p,i,packet,obs){
    const current=before.call(this,p,i,packet,obs);
    if(i===1&&p.support_plan?.transitions[i]?.primitive.occurrence_ref==='visible:24'){
      const crossed=before.call(this,p,i,{...packet,frame_rows:other.choice.frame},obs);
      guards.push({ref:obs.observation_ref,origine:p.support_plan.transitions[i].primitive.occurrence_ref,vrai:current,croisé:crossed});
    }
    return current;
  }));
  hooks.push(mock.method(F,'record',function(...args){
    const result=record.apply(this,args);
    for(const e of result?.events??[])events.push(e);
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),prior,previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      const shown=name==='stationnaire'&&i===1?{...real,frame:prior.frame,frames:[prior.frame]}:
        name==='autreReçu'&&i===1?other.choice:real;
      const scene=measuredMetricScene(shown.frame),start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.support_plan;
      const q=plan?.transitions?.[ticket?.actionIndex],guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const targets=q?.primitive.kind==='SELECT'&&scene?metricTargetCandidates(scene,p.binding,measuredMetricState(scene,p.binding)):null;
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,
        forme:projection(scene),empreinte:digest(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,
          data:ticket.data,index:ticket.actionIndex,admitted:guard?.admitted,guard:guard?.reason,
          source:plan?.target_ref,grid:plan?.grid_ref,target:plan?.target,cost:plan?.complete_model_cost,
          controls:plan?.control_facts,refs:p.route_refs,primitive:q?.primitive,visible:q&&metricVisible(q.after),
          directions:plan?.directions,offers:targets?.length,certifié:targets?.some(x=>digest(x)===digest(plan.target))},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,seal:outcome.seal_prefix,
          reason:outcome.reason,réel:digest(real.frame),paquet:real.frames.map(digest),formeRéelle:projection(measuredMetricScene(real.frame)),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(i<short.length)assert.equal(ticket.actionRef,'ACTION'+short[i]);
      previous={id:ticket.id};prior=shown;
      board=step(game,Number(ticket.actionRef.slice(6)),ticket.data);
    }
    return {rows,guards,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,gameRoot){
  const game=await sourceBackend(gameRoot),alt=alternative(game);
  if(group==='nominal')return {nominal:await play(game,'nominal',16,alt),alternatif:alt.summary};
  assert.equal(group,'contrôles');
  return {stationnaire:await play(game,'stationnaire',1,alt),autreReçu:await play(game,'autreReçu',1,alt),
    référenceRecalculée:await play(game,'référenceRecalculée',5,alt)};
}
