import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {VisualSequences,visualInterior} from './src/logos-engine/v6-visual-sequences.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const eventView=e=>({status:e.status,key:e.question,ref:e.evidence,preserved:e.other_cards_preserved,filled:e.expected_card_filled});
async function play(game,arm,cap){
  const M=VisualSequences.prototype,{record,before,proposeContinuation}=M;
  const events=new Map(),guards=new Map(),rows=[],cuts=[];
  const hooks=[mock.method(M,'record',function(b,a,cmd,f,s,p,index){
    const received=record.call(this,b,a,cmd,f,s,p,index),q=p.sequence_plan;
    events.set(a.observation_ref,structuredClone({...eventView(received),trial:q.trial,fail:this.state().failed,
      target:q.target_box,expected:digest(q.expected_raster),observed:digest(visualInterior(s,q.target_box))}));
    return received;
  })];
  hooks.push(mock.method(M,'before',function(p,index,packet,obs){
    if(obs.revision===5){
      const q=p.sequence_plan;
      const [x,y]=[p.actions[index].data.x,p.actions[index].data.y];
      const actor=packet.frame_rows.map(x=>[...x]);
      actor[y][x]=(actor[y][x]+1)%16;
      const changed=before.call(this,p,index,{...packet,frame_rows:actor},obs);
      const stale=before.call(this,p,index,packet,{...obs,observation_ref:obs.observation_ref+':ancien'});
      guards.set(obs.observation_ref,{point:changed.admitted,stale:stale.admitted,box:q.option_box});
    }
    return before.call(this,p,index,packet,obs);
  }));
  if(['retraitDeux','doublon','sansLimite'].includes(arm))hooks.push(mock.method(M,'proposeContinuation',async function(obs,...args){
    if(obs.level_epoch!==2||obs.revision!==5)return proposeContinuation.call(this,obs,...args);
    const original=this.state(),completed=original.events.filter(e=>e.status==='observed_row_completion');
    assert.equal(completed.length,3);
    let used;
    if(arm==='retraitDeux')used=original.events.filter(e=>!completed.slice(1).includes(e));
    if(arm==='doublon')used=original.events.map(e=>e===completed[2]?completed[1]:e);
    if(arm==='sansLimite')used=original.events.filter(e=>e.status!=='official_boundary');
    cuts.push({ref:obs.observation_ref,original:original.events.map(eventView),used:used.map(eventView)});
    this.restore({...original,events:used});
    try{return await proposeContinuation.call(this,obs,...args);}finally{this.restore(original);}
  }));
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'SERI',level:1}),previous,prior;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      const shown=arm==='stationnaire'&&i===1?{...prior,stepIndex:i,frames:[prior.frame]}:actual;
      if(arm==='stationnaire'&&i===1)game.dispatch({type:'load',code:'SERI',level:1});
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,
          levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,q=p?.sequence_plan;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,photo:digest(shown.frame),niveau:shown.level,score:shown.levelsCompleted,
        arrêt:reply.reason??null,ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,command:ticket.actionRef,
          point:ticket.data,owner:snapshot.lastDecision,kind:p.kind,admitted:guard?.admitted,
          row:q?.row,rank:q?.missing_rank,continuation:q?.continuation_witnesses,reason:q?.inference.status,
          guards:guards.get(ticket.observationRef),trial:q?.trial,expected:q&&digest(q.expected_raster)},
        ret:previous&&{id:previous.id,ref:outcome.observation_ref,matched:outcome.matched,sealed:outcome.seal_prefix,
          owner:outcome.family,physical:digest(actual.frame),shown:digest(shown.frame),event:events.get(outcome.observation_ref)}});
      if(!ticket||i===cap)break;
      previous=ticket;prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,cuts};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={nominal:[['nominal',16]],contrôles:[['retraitDeux',5],['doublon',5],['sansLimite',5],['stationnaire',2]]};
  assert.ok(Object.hasOwn(sets,group));
  const result={};
  for(const [arm,cap] of sets[group])result[arm]=await play(game,arm,cap);
  return result;
}
