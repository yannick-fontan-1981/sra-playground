import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {SlidingCavity} from './src/logos-engine/v6-sliding-cavity.ts';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {defaultRecoveryPack} from './src/sic/active-recovery.ts';

const [version,assets,destination]=process.argv.slice(2);
const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const get=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:get('laya_proto/common_frontier_policy.drm.json'),strategy:get('morphology_policy/strategy.drm')};
const game=await sourceBackend(assets);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const last=(message,kind)=>message.snapshot.trace.findLast(e=>e.kind===kind);
const native=(raw,seq)=>toV6PublicObservation({...raw,gameCode:raw.gameCode??raw.code},seq);
const count=(before,after)=>before.reduce((t,row,y)=>t+row.filter((p,x)=>p!==after[y][x]).length,0);

async function examine(arm){
  const proto=SlidingCavity.prototype, propose=proto.proposeDirectionQuestion, record=proto.record;
  const comparisons=[], rows=[], preparations=[], acquisitions=[];
  let sequence=0, flight=0;
  proto.proposeDirectionQuestion=async function(...args){
    if(sequence!==5)return propose.apply(this,args);
    const [obs,,,,,,execution]=args;
    const neutral={...execution,controlTrialAgenda:undefined,observeControlTrialShadow:undefined};
    const unobserved=[...args];unobserved[6]=neutral;
    const trials=this.control_questions.attempted, original=[...trials];
    const directions=structuredClone(this.directions);
    const first=await propose.apply(this,unobserved);
    assert.equal(first?.actions[0].action_ref,'ACTION1');
    const choice1=first.support_plan.question_key;
    assert.ok(!trials.has(choice1));
    trials.add(choice1);
    let second;
    try{second=await propose.apply(this,unobserved);}
    finally{trials.delete(choice1);}
    assert.equal(second?.actions[0].action_ref,'ACTION4');
    const choice4=second.support_plan.question_key;
    assert.notEqual(choice1,choice4);
    assert.ok(!trials.has(choice4));
    const suppressed=arm==='première'?[choice1]:arm==='seconde'?[choice4]:arm==='deux'?[choice1,choice4]:[];
    assert.deepEqual(this.directions,directions);
    assert.deepEqual([...trials],original);
    try{
      for(const key of suppressed)trials.add(key);
      const chosen=await propose.apply(this,args);
      preparations.push({view:obs.observation_ref,frame:obs.frame_hash,actions:obs.available_action_refs,
        known:directions,questions:[choice1,choice4],suppressed,chosen:chosen?.actions[0].action_ref??null});
      assert.deepEqual(this.directions,directions);
      return chosen;
    }finally{
      for(const key of suppressed)trials.delete(key);
      assert.deepEqual([...trials],original);
    }
  };
  proto.record=async function(...args){
    const before=structuredClone(this.directions);
    const response=await record.apply(this,args);
    if(flight===6){
      const [b,a,command]=args;
      acquisitions.push({command:command.action_ref,before,after:structuredClone(this.directions),
        opening:b.observation_ref,return:a.observation_ref});
    }
    return response;
  };
  try{
    const service=new V6AgentService(recovery=>createNativeV6Runtime(declarations,{recovery,now:()=>0,
      controlTrialAgenda:{mode:'active',actionBudget:1},observeControlTrialShadow:r=>comparisons.push(structuredClone(r))}));
    const sessionId='as66-operator-p05-tiebreak';
    const budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
    let board=game.dispatch({type:'load',code:'AS66',level:1});
    let reply=await service.handle({type:'init',sessionId,sequence,budgets,observation:native(board,0),recovery:defaultRecoveryPack});
    for(let i=1;i<=7;i++){
      if(reply.kind==='boundary'&&!reply.ticket)reply=await service.handle({type:'resume',sessionId,sequence});
      if(!reply.ticket)break;
      const ticket=reply.ticket, plan=last(reply,'sic_native_plan'), guard=last(reply,'before_guard');
      assert.equal(guard?.admitted,true);
      const proposal=reply.snapshot.proposal, before=board;
      const observation=native(board,sequence);
      const q={id:ticket.id,command:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,ref:ticket.observationRef,
        owner:plan?.family,strategy:plan?.strategy,kind:proposal?.kind,question:proposal?.support_plan?.question_key??null,
        guard:guard.reason};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),
        ...(ticket.actionRef==='ACTION6'?{data:ticket.data}:{})});
      flight=i;
      const after=native(board,++sequence);
      reply=await service.handle({type:'advance',sessionId,sequence,ticketId:ticket.id,executionMs:0,observation:after});
      const event=last(reply,'actual_outcome');
      assert.ok(event?.observation_ref);
      rows.push({i,level:before.level,observation:digest(observation),q,returned:{ref:event.observation_ref,
        reason:event.reason??null,family:event.family,matched:event.matched},
        after:digest(after),changed:count(observation.frame,after.frame),score:board.levelsCompleted});
    }
    return {arm,budgets,rows,preparations,acquisitions,comparisons};
  }finally{
    proto.proposeDirectionQuestion=propose;
    proto.record=record;
  }
}
const runs=[];
for(const arm of ['nominal','première','seconde','deux'])runs.push(await examine(arm));
writeFileSync(destination,JSON.stringify({version,runs},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({version,lengths:runs.map(r=>r.rows.length)}));
