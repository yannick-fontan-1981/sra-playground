import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {RelativeArrangements} from './src/logos-engine/v6-relative-arrangements.ts';
import {overlayMovedParticipant} from './placement.ts';

const ref=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,ref)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const delta=(a,b)=>a.reduce((n,r,y)=>n+r.filter((v,x)=>v!==b[y][x]).length,0);
async function play(game,arm,cap){
  const M=RelativeArrangements.prototype,{record,before}=M;
  const rows=[],events=new Map(),guards=new Map();
  const hooks=[mock.method(M,'record',function(b,a,act,first,later,p,index){
    const result=record.call(this,b,a,act,first,later,p,index);
    if(result)events.set(a.observation_ref,structuredClone({status:result.status,from:result.from,to:result.to,delta:result.delta,
      value:result.object_value,selection:result.selection_ref,preserved:result.preserved_objects,
      before:b.observation_ref,after:a.observation_ref}));
    return result;
  }),mock.method(M,'before',function(p,i,packet,obs){
    if(obs.revision===3||obs.revision===9){
      const altered=before.call(this,p,i,packet,{...obs,observation_ref:obs.observation_ref+':autre'});
      guards.set(obs.observation_ref,altered.admitted);
    }
    return before.call(this,p,i,packet,obs);
  })];
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'TRIA',level:1}),prior,prev;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      let served=arm==='disposition'?overlayMovedParticipant(actual):actual;
      if(arm==='stationnaire'&&i===9)served={...prior,stepIndex:i,frames:[prior.frame]};
      let result=await service.handle({sessionId,observation:served,sequence:i,...(prev?
        {type:'advance',ticketId:prev.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=result.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(result.kind==='boundary')result=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=result,p=snapshot.proposal,q=p?.arrangement_plan;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,photo:digest(served.frame),vraiePhoto:digest(actual.frame),niveau:served.level,score:served.levelsCompleted,
        écartRaster:delta(actual.frame,served.frame),arrêt:result.reason??null,ticket:ticket&&{
          ref:ticket.observationRef,id:ticket.id,owner:snapshot.lastDecision,kind:p.kind,
          command:ticket.actionRef,data:ticket.data,admis:guard?.admitted,ancienne:guards.get(ticket.observationRef),
          plan:q&&{rôle:q.offer.kind,move:q.offer.move,goal:q.offer.goal.target.add,evidence:q.offer.model_evidence,
            objets:q.projection.objects.map(x=>[x.xy,x.value])}},
        ret:prev&&{id:prev.id,ref:outcome.observation_ref,matched:outcome.matched,sealed:outcome.seal_prefix,
          packet:digest(actual.frames),event:events.get(outcome.observation_ref)}});
      if(!ticket||i===cap)break;
      prev=ticket;prior=served;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return rows;
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={nominal:[['nominal',16]],contrôles:[['disposition',4],['stationnaire',9]]};
  assert.ok(Object.hasOwn(sets,group));
  const result={};
  for(const [arm,limit] of sets[group])result[arm]=await play(game,arm,limit);
  return result;
}
