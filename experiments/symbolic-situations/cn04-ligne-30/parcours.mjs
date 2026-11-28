import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {PortAssembly,portAgreement,compatiblePorts,portAccessPath,placedPorts,portCells} from './src/logos-engine/v6-port-assembly.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const load={type:'load',code:'CN04',level:1};
const historical=[1,2,3,4,5,5,5,2,2,2,2,2,2,2,4,4,4,4,1];
function contacts(frame,model,goal){
  const overlap=placedPorts(model,0,goal[0])[1].intersection(placedPorts(model,1,goal[1])[1]).sorted();
  const map=portCells(frame,model);
  return {pixels:overlap.map(point=>[point,map.get(point.join(','))?.value]),match:portAgreement(frame,model,goal)};
}
async function play(game,name,cap,budget){
  const F=PortAssembly.prototype,rows=[],events=[],guards=[],qualifiers=[],hooks=[];
  const record=F.record,before=F.before;
  let owner,preRotation;
  hooks.push(mock.method(F,'before',function(p,index,packet,obs){
    owner=this;
    const real=before.call(this,p,index,packet,obs),plan=p.port_plan;
    if(obs.level_epoch===1&&obs.revision===5)preRotation=packet.frame_rows;
    if(obs.level_epoch===1&&obs.revision===8&&plan.joint_goal){
      const previous=before.call(this,p,index,{...packet,frame_rows:preRotation},obs);
      guards.push({real,previous,ref:obs.observation_ref});
    }
    if(obs.level_epoch===1&&[5,8].includes(obs.revision)&&plan.joint_goal){
      const target=plan.joint_goal;
      const known=new Map(this.motion),withoutDown=new Map([...known].filter(([key])=>key!=='ACTION2'));
      qualifiers.push({ref:obs.observation_ref,compatible:compatiblePorts(this.model,0,target[0],new Map([[1,target[1]]])),
        path:portAccessPath(this.model,plan.poses,0,target[0],known),
        withoutDown:portAccessPath(this.model,plan.poses,0,target[0],withoutDown),known:[...known]});
    }
    return real;
  }));
  hooks.push(mock.method(F,'record',function(...args){
    const r=record.apply(this,args);
    events.push({ref:r.ref,status:r.status,poses:r.poses,motion:[...this.motion]});
    return r;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),prior,previous;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      const shown=name==='finale'&&i===18?{...actual,frames:[actual.frame]}:
        name==='sansRotation'&&i===7?{...prior,stepIndex:i,frames:[prior.frame]}:actual;
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.port_plan,q=ticket&&p.steps?.[ticket.actionIndex];
      const g=snapshot.trace.findLast(x=>x.kind==='before_guard');
      const priorGoal=previous?.target,priorModel=previous?.model;
      const values=(s)=>priorGoal&&priorModel&&[17,18].includes(i)?s.frames.map(frame=>contacts(frame,priorModel,priorGoal)):null;
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,présenté:hash(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,data:ticket.data,
          index:ticket.actionIndex,admitted:g?.admitted,reason:g?.reason,mode:q?.mode,expected:q?.expected_after,
          materials:plan?.materials,ports:plan?.known_ports,poses:plan?.poses,goal:plan?.joint_goal,unit:owner?.model?.unit,
          word:p.actions?.map(x=>x.action_ref),refs:p.route_refs},
        ret:previous&&{id:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,
          reason:outcome.reason,official:[actual.level,actual.levelsCompleted],packet:actual.frames.map(hash),served:shown.frames.map(hash),
          physicalContacts:values(actual),shownContacts:values(shown),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      assert.equal(ticket.actionRef,'ACTION'+historical[i]);
      previous={id:ticket.id,model:owner?.model,target:plan?.joint_goal};prior=shown;
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6))});
    }
    return {rows,guards,qualifiers};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const sets={nominal:{catalogue:[16,16],prolongé:[19,20]},contrôles:{finale:[18,20],sansRotation:[7,20]}};
  assert.ok(Object.hasOwn(sets,group));
  const game=await sourceBackend(root),out={};
  for(const [name,[cap,budget]] of Object.entries(sets[group]))out[name]=await play(game,name,cap,budget);
  return out;
}
