import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {FeedbackSequences} from './src/logos-engine/v6-feedback-sequences.ts';

const source=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const gz=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,import.meta.url))));
const trace=gz('docs/migration/lot4a-evidence/integrated-051/mind-live-01/mind-public-trace.json.gz').packets;
const fixture=gz('tests/fixtures/sic-mind-alternate-returns.json.gz');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function nominal(i){
  const p=trace[i].packet;
  return {frame:p.frame_rows,frames:p.frame_packet,level:p.level,levelsCompleted:p.levels_completed,
    state:p.state,stepIndex:p.step_index,availableActionIds:p.available_action_refs.map(v=>Number(v.slice(6)))};
}
function present(name,i,packet,seed){
  if(name!=='retourRéduit'||i!==8)return {obs:packet};
  const end=digest(packet.frame),hashes=packet.frames.map(digest);
  const eligible=hashes.map((h,k)=>k>0&&k<hashes.length-1&&h!==end?k:-1).filter(k=>k>=0);
  const kept=eligible.length?eligible[seed[0]%eligible.length]:null;
  const frames=kept===null?[packet.frame]:packet.frames.map((f,k)=>k===kept?f:packet.frame);
  return {obs:{...packet,frames},variation:{eligible,kept}};
}
async function play(game,name,cap,budget,seed){
  const F=FeedbackSequences.prototype, hooks=[],events=[],rows=[],interventions=[];
  const record=F.record, propose=F.propose;
  const alternative=name==='sansHistorique'||name==='retourRéduit';
  if(alternative)hooks.push(mock.method(F,'propose',async function(...args){
    if(args[0].revision!==5)return propose.apply(this,args);
    const state=this.state();if(!state.history.length)return propose.apply(this,args);
    interventions.push({tour:5,retirés:state.history.map(v=>v.ref)});
    const copy=new FeedbackSequences();copy.restore({...state,history:[]});
    return propose.apply(copy,args);
  }));
  hooks.push(mock.method(F,'record',async function(...args){
    const result=await record.apply(this,args), e=result.event;
    events.push({status:result.status,ref:args[1].observation_ref,before:args[0].observation_ref,matchs:result.matches,
      proof:result.evidence,values:e?.values,marks:e?.marks,value:e?.value,repeatable:e?.repeatable,revalidated:e?.method_revalidation});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+fixture.session;
    let board=game.dispatch({type:'load',code:'MIND',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i),{obs,variation}=present(name,i,real,seed);
      const {palette,...canonical}=real;
      assert.deepEqual(canonical,alternative&&i>=5?fixture.observations[i-5]:nominal(i));
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.feedback_plan,step=ticket&&p.steps[ticket.actionIndex];
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({tour:i+1,niveau:obs.level,score:obs.levelsCompleted,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          admitted:guard?.admitted,mode:step?.kind,value:step?.value,préfixe:step?.prefix_before,prévu:step?.expected_after,
          choix:plan?.selection,refs:plan?.evidence,actions:p.actions},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          réel:real.frames.map(digest),servi:obs.frames.map(digest),finale:digest(obs.frame),variation,events:events.slice(start)}});
      if(!ticket||i===cap)break;
      const c=alternative&&i>=4?{action_ref:'ACTION'+fixture.commands[i-4].id,data:fixture.commands[i-4].data}:trace[i+1].command;
      assert.deepEqual([ticket.actionRef,ticket.data],[c.action_ref,c.data??{}]);
      previous={id:ticket.id};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,budget,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16],['prolongé',17,19]],
    contrôles:[['sansHistorique',13,14]],réserve:[['retourRéduit',8,14]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await play(game,name,cap,budget,seed);}
  finally{clock.mock.restore();}
  return cases;
}
