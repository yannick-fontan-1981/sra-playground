import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {defaultRecoveryPack} from './src/sic/active-recovery.ts';

const [environment,destination]=process.argv.slice(2);
const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const file=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:file('laya_proto/common_frontier_policy.drm.json'),strategy:file('morphology_policy/strategy.drm')};
const engine=await sourceBackend(environment);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const active=(ticket)=>({id:ticket.id,action:ticket.actionRef,data:ticket.data,ref:ticket.observationRef,index:ticket.actionIndex});
const abridge=reply=>({kind:reply.kind,reason:reply.reason??null,ticket:reply.ticket?.id??null});
const observations=(board,seq)=>toV6PublicObservation({...board,gameCode:board.gameCode??board.code},seq);
const issue=(board,action)=>({type:'action',actionId:Number(action.action.slice(6)),
  ...(action.action==='ACTION6'?{data:action.data}:{})});
const fromTrace=(reply,type)=>reply.snapshot.trace.findLast(e=>e.kind===type);

async function run(code,budget,foreign=null){
  const comparisons=[];
  const solver=code==='G50T'?'sic':'v6';
  const service=new V6AgentService(recovery=>createNativeV6Runtime(declarations,{recovery,now:()=>0,
    observeControlTrialShadow:r=>comparisons.push(structuredClone(r)),
    ...(budget==='absent'?{}:{controlTrialAgenda:{mode:'active',actionBudget:budget}})
  }));
  const sessionId='operateur-p05-'+code,targetLevels=code==='AS66'?6:1;
  const budgets={targetLevels,levelActionCaps:Array(targetLevels).fill(600),maxActions:16};
  let board=engine.dispatch({type:'load',code,level:1}),seq=0;
  let reply=await service.handle({type:'init',sessionId,sequence:0,observation:observations(board,0),
    recovery:solver==='sic'?{...defaultRecoveryPack,solver}:defaultRecoveryPack,budgets});
  const rows=[];
  let foreignRejected=null;
  while(seq<16){
    while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:seq});
    if(!reply.ticket)break;
    const ticket=active(reply.ticket);
    const plan=fromTrace(reply,'sic_native_plan');
    const guard=fromTrace(reply,'before_guard');
    assert.equal(guard?.admitted,true);
    const evidence=reply.snapshot.proposal?.bundle_template?.evidence;
    const obs=observations(board,seq);
    const before={frame:digest(obs.frame),actions:obs.availableActionIds,level:obs.level};
    board=engine.dispatch(issue(board,ticket));
    const packet=observations(board,seq+1);
    const packetDigest=digest(packet);
    if(foreign&&seq===0){
      try{
        await service.handle({type:'advance',sessionId,sequence:seq+1,ticketId:foreign,observation:packet,executionMs:0});
        throw new Error('Le ticket étranger a été admis');
      }catch(e){
        assert.notEqual(e.message,'Le ticket étranger a été admis');
        foreignRejected={name:e.name,code:e.code,message:e.message};
      }
    }
    const out=await service.handle({type:'advance',sessionId,sequence:seq+1,ticketId:ticket.id,observation:packet,executionMs:0});
    seq++;
    const outcome=fromTrace(out,'actual_outcome');
    assert.ok(outcome?.observation_ref);
    const acquisition=out.snapshot.trace.filter(e=>
      ['native_acquisition_incomplete','native_control_acquisition','need_acquisition','observed_need'].includes(e.kind)).slice(-3);
    rows.push({i:seq,ticket,before,plan,guard,evidence,packet:packetDigest,physical:digest(packet.frame),frames:packet.frames.length,
      event:outcome,acquisition,levels:board.levelsCompleted});
    reply=out;
    if(foreign) return {ticket,foreign,foreignRejected,accepted:outcome,packetDigest};
  }
  return {code,solver,budget,budgets,rows,stop:abridge(reply),comparisons};
}

const result=[];
for(const code of ['G50T','AS66'])for(const budget of ['absent',1,0])result.push(await run(code,budget));
const [,one,zero]=result;
let foreign=null;
const oneId=one.rows[0].ticket.id,zeroId=zero.rows[0].ticket.id;
foreign=await run('G50T',0,oneId===zeroId?oneId+':foreign':oneId);
writeFileSync(destination,JSON.stringify({result,foreign},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({departs:result.length,gestes:result.map(r=>r.rows.length),foreign:!!foreign?.foreignRejected}));
