import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime,NativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {defaultRecoveryPack} from './src/sic/active-recovery.ts';
import {createSicVerifyRemoteReplay} from './src/sic/replay-access.ts';

const [version,assets,destination]=process.argv.slice(2);
const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const file=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:file('laya_proto/common_frontier_policy.drm.json'),strategy:file('morphology_policy/strategy.drm')};
const engine=await sourceBackend(assets),agenda={mode:'active',actionBudget:1};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const last=(r,kind)=>r.snapshot.trace.findLast(e=>e.kind===kind);
const strip=(source,key)=>Object.fromEntries(Object.entries(source).filter(([k])=>k!==key));
const obs=(board,seq)=>toV6PublicObservation({...board,gameCode:board.gameCode??board.code},seq);

async function play(arm){
  const scope=arm!=='nominal', family=scope?createSicVerifyRemoteReplay():null;
  let turn=0,substituted=null,withheld=null;
  const refs=[],rows=[];
  if(family){
    const record=family.record.bind(family);
    family.record=async(...args)=>{
      const [before,after,command,,,proposal]=args;
      if(turn!==5||command.action_ref!=='ACTION4'||!proposal.controlEffectChild)return record(...args);
      const child=proposal.controlEffectChild;
      assert.equal(child.opening,before.observation_ref);
      if(arm==='provenance'){
        const prior=refs[2];
        assert.ok(prior&&prior!==child.opening&&prior!==after.observation_ref);
        substituted={genuine:child.opening,other:prior};
        args[5]={...proposal,controlEffectChild:{...child,opening:prior}};
      }
      const answer=await record(...args);
      if(arm!=='retrait')return answer;
      const effect=answer.controlEffectReturn;
      assert.equal(effect?.status,'observed_translation');
      const memory=family.state(),state=memory.state;
      assert.deepEqual(state.controls.ACTION4,effect.displacement);
      assert.equal(state.controlEvidence.ACTION4,effect.afterRef);
      withheld={control:state.controls.ACTION4,reference:state.controlEvidence.ACTION4};
      family.restore({...memory,state:{...state,controls:strip(state.controls,'ACTION4'),
        controlEvidence:strip(state.controlEvidence,'ACTION4')}});
      return strip(answer,'controlEffectReturn');
    };
  }
  const service=new V6AgentService(recovery=>scope
    ?new NativeV6Runtime({families:[family],groups:[{id:'replay',families:[family.id]}],
      sourceDigest:'p05-child-independent',now:()=>0,maxPointOccurrences:250,controlTrialAgenda:agenda})
    :createNativeV6Runtime(declarations,{recovery,now:()=>0,controlTrialAgenda:agenda}));
  const sessionId='p05-operator-child', budgets={targetLevels:1,levelActionCaps:[600],maxActions:16};
  let board=engine.dispatch({type:'load',code:'G50T',level:1});
  let reply=await service.handle({type:'init',sessionId,sequence:0,observation:obs(board,0),budgets,
    recovery:scope?defaultRecoveryPack:{...defaultRecoveryPack,solver:'sic'}});
  for(let i=1;i<=(scope?6:16);i++){
    if(reply.kind==='boundary'&&!reply.ticket)reply=await service.handle({type:'resume',sessionId,sequence:i-1});
    if(!reply.ticket)break;
    const ticket=reply.ticket, plan=last(reply,'sic_native_plan'),child=plan?.controlEffectChild;
    assert.equal(last(reply,'before_guard')?.admitted,true);
    if(child){
      assert.equal(child.status,'awaiting_native_return');
      assert.equal(child.opening,ticket.observationRef);
      assert.equal(child.need.parentObjective,plan.need.id);
      assert.equal(child.actionBudget,1);
    }
    const shot={command:ticket.actionRef,data:ticket.data,id:ticket.id,ref:ticket.observationRef,strategy:plan?.strategy??null,
      owner:plan?.family,expected:reply.snapshot.proposal?.steps?.[ticket.actionIndex]?.expected_after??null,
      evidence:plan?.need?.evidence??null,child:child??null};
    if (scope&&i===6&&arm==='stationnaire'){
      rows.push({i,shot,comparisonOnly:true});
      break;
    }
    const previous=board;
    board=engine.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),
      ...(ticket.actionRef==='ACTION6'?{data:ticket.data}:{})});
    const present=arm==='stationnaire'&&i===5?previous:board;
    const authentic=obs(board,i), shown=obs(present,i);
    turn=i;
    reply=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:shown,executionMs:0});
    const outcome=last(reply,'actual_outcome');
    assert.ok(outcome?.observation_ref);
    refs.push(outcome.observation_ref);
    const result=reply.snapshot.trace.filter(e=>e.kind==='native_composition_dependency')
      .map(e=>e.control_effect_return).findLast(x=>x?.beforeRef===ticket.observationRef)??null;
    const memory=family?.state().state;
    rows.push({i,shot,actual:digest(authentic),presented:digest(shown),frame:digest(authentic.frame),
      outcome:{reason:outcome.reason??null,ref:outcome.observation_ref,family:outcome.family,matched:outcome.matched},
      result,control:memory?.controls?.ACTION4??null,controlEvidence:memory?.controlEvidence?.ACTION4??null});
  }
  return {arm,rows,substituted,withheld,last:{kind:reply.kind,reason:reply.reason??null}};
}
const runs=[];
for(const arm of version==='base'?['nominal']:['nominal','témoin','stationnaire','provenance','retrait']){
  runs.push(await play(arm));
}
writeFileSync(destination,JSON.stringify({version,runs},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({version,rows:runs.map(r=>[r.arm,r.rows.length])}));
