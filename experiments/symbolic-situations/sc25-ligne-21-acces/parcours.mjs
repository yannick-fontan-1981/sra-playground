import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {MotifAccess} from './src/logos-engine/v6-motif-access.ts';
import {field} from './terrain.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const diffs=(a,b)=>a.flatMap((row,y)=>row.flatMap((v,x)=>v===b[y][x]?[]:[[x,y,v,b[y][x]]]));
const body=frame=>frame.slice(0,19).flatMap((row,y)=>row.flatMap((v,x)=>v===3||v===4?[[x,y,v]]:[]));
function sample(packet,board){
  const {frame,levelsCompleted}=packet;
  return {hash:digest(frame),pixels:body(frame),support:board.bridge.map(([x,y])=>[x,y,frame[y][x]]),score:levelsCompleted};
}
async function play(axis,arm){
  const wired=arm!=='fermé',board=field(axis,wired),M=MotifAccess.prototype,rows=[],events=[],alterations=[];
  const {record,propose}=M;
  const hooks=[mock.method(M,'record',function(...args){
    const event=record.apply(this,args);
    events.push(structuredClone({ref:event.ref,status:event.status,mode:event.mode,cleared:event.grid_cleared,
      before:event.before,after:event.after,motion:this.motion}));
    return event;
  })];
  if(arm==='sansPreuve')hooks.push(mock.method(M,'propose',async function(...args){
    if(args[0].revision!==4)return propose.apply(this,args);
    const refs=this.refs,stored=this.events;
    assert.ok(refs.invoke);
    const {invoke,...other}=refs;
    this.refs=other;
    this.events=stored.filter(event=>event.ref!==invoke);
    assert.equal(this.events.length,stored.length-1);
    alterations.push({current:args[0].observation_ref,removed:invoke});
    try{return await propose.apply(this,args);}finally{this.refs=refs;this.events=stored;}
  }));
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='motif-indep-'+axis;
    const limit=arm==='ouvert'?9:arm==='stationnaire'?5:4;
    let observation=board.observation(),prior,ticket,acted,invocationReturn;
    for(let i=0;i<=limit;i++){
      const shown=arm==='stationnaire'&&i===5?{...prior,stepIndex:i,frames:[prior.frame]}:observation;
      if(i===3)invocationReturn=shown.frame;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(ticket?
        {type:'advance',ticketId:ticket.id,executionMs:0}:{type:'init',budgets:{targetLevels:3,levelActionCaps:[12,12,12],maxActions:12}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot}=reply,p=snapshot.proposal,s=p?.steps?.[reply.ticket?.actionIndex];
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,vue:sample(shown,board),arrêt:reply.reason??null,ticket:reply.ticket&&{
        id:reply.ticket.id,ref:reply.ticket.observationRef,owner:snapshot.lastDecision,entry:p.material_access_subquestion,
        command:reply.command.actionRef,data:reply.command.data,mode:s.mode,expected:s.expected_after,refs:p.question?.hypothesis_refs,
        admitted:guard?.admitted},ret:ticket&&{id:ticket.id,ref:outcome.observation_ref,owner:outcome.family,
          matched:outcome.matched,sealed:outcome.seal_prefix,actual:sample(observation,board),
          divergence:diffs(shown.frame,observation.frame).length,action:acted}});
      if(!reply.ticket||i===limit||arm==='ouvert'&&events.some(e=>e.mode==='walk'&&e.ref.includes(':revision:6:')))break;
      prior=shown;ticket=reply.ticket;acted=reply.command;
      observation=board.act(acted);
    }
    return {rows,events,alterations,invocationReturn};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(){
  const cases={},invocationDifferences={};
  for(const axis of ['horizontal','vertical']){
    cases[axis]={};
    const prints={};
    for(const arm of ['ouvert','fermé','sansPreuve','stationnaire']){
      const {invocationReturn,...receipt}=await play(axis,arm);
      prints[arm]=invocationReturn;
      cases[axis][arm]=receipt;
    }
    invocationDifferences[axis]=diffs(prints.fermé,prints.ouvert);
  }
  return {cases,invocationDifferences};
}
