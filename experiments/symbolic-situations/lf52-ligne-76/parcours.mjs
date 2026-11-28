import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {ReductionTransport} from './src/logos-engine/v6-reduction-transport.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const mask=f=>f.map((row,y)=>row.map((v,x)=>x>=29&&x<=32&&y>=18&&y<=21&&v===1?0:v));
const landing=f=>f.slice(18,22).flatMap(row=>row.slice(29,33));
const counts=p=>Object.fromEntries([0,1,2].map(v=>[v,landing(p.frame).filter(x=>x===v).length]));
async function play(game,arm,cap){
  const M=ReductionTransport.prototype,{record,propose}=M;
  const events=new Map(),controls=[],rows=[];
  const hooks=[mock.method(M,'record',function(b,a,act,f,s,p,i){
    const event=record.call(this,b,a,act,f,s,p,i);
    if(event)events.set(a.observation_ref,structuredClone({status:event.status,before:event.before_population,after:event.after_population,
      refs:[b.observation_ref,a.observation_ref],selected:this.selected,landing:this.scene?.floor.has('4,3'),
      support:this.scene?.floor.size,pegs:[...this.scene?.pegs??[]].sort()}));
    return event;
  })];
  if(['retrait','témoin'].includes(arm))hooks.push(mock.method(M,'propose',function(obs,...args){
    if(obs.revision!==2)return propose.call(this,obs,...args);
    const floor=this.scene.floor;
    assert.ok(floor.has('4,3'));
    const ignored=new Set(['2,3','3,3','4,3','5,3','6,3','6,4','6,5','6,6','6,7',...this.scene.pegs]);
    const use=arm==='retrait'?'4,3':[...floor].find(c=>!ignored.has(c));
    assert.ok(use);
    this.scene={...this.scene,floor:new Set(floor)};
    this.scene.floor.delete(use);
    controls.push({ref:obs.observation_ref,removed:use,remaining:this.scene.floor.size});
    return propose.call(this,obs,...args);
  }));
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'LF52',level:1}),old,previous;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      let shown=actual;
      if(i===1&&['masqué','retrait','témoin'].includes(arm))shown={...actual,frame:mask(actual.frame),frames:actual.frames.map(mask)};
      if(i===2&&arm==='stationnaire')shown={...old,stepIndex:i,frames:[old.frame]};
      let reply=await service.handle({sessionId,observation:shown,sequence:i,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,
          levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,step=p?.steps?.[ticket?.actionIndex],plan=p?.reduction_plan;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,photo:digest(shown.frame),niveau:shown.level,score:shown.levelsCompleted,appui:counts(shown),
        arrêt:reply.reason??null,ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,
          kind:p.kind,command:ticket.actionRef,point:ticket.data,admis:guard?.admitted,mode:step.mode,cell:step.cell,
          carriers:plan?.carriers},ret:previous&&{id:previous.id,ref:outcome.observation_ref,matched:outcome.matched,
            seal:outcome.seal_prefix,packet:digest(actual.frames),physical:digest(actual.frame),rawSupport:counts(actual),
            event:events.get(outcome.observation_ref)}});
      if(!ticket||i===cap)break;
      previous=ticket;old=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,controls};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={nominal:[['nominal',16]],contrôles:[['masqué',3],['retrait',2],['témoin',2],['stationnaire',2]]};
  assert.ok(Object.hasOwn(sets,group));
  const result={};
  for(const [arm,n] of sets[group])result[arm]=await play(game,arm,n);
  return result;
}
