import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {NativeSelectedRigid} from './src/logos-engine/v6-selected-rigid.ts';
import {selectedRigidScene,selectedRigidPoses,selectedRigidPoint,selectedRigidMoved} from './src/logos-engine/v6-selected-rigid-geometry.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const changes=(a,b)=>a.reduce((n,row,y)=>n+row.filter((v,x)=>v!==b[y][x]).length,0);
const poses=scene=>Object.fromEntries(scene.bodies.map((body,i)=>[body.key,selectedRigidPoses(scene)[i]]));
function action(game,ticket){
  const actionId=Number(ticket.actionRef.slice(6));
  return game.dispatch({type:'action',actionId,...(actionId===6?{data:ticket.data}:{})});
}
function moveOther(game,stock,current,plan,direction){
  const scene=selectedRigidScene(current.frame,plan.scene),positions=selectedRigidPoses(scene);
  const vectors=plan.models.map(m=>m[direction]);
  assert.equal(vectors.length,1);
  const other=scene.bodies.findIndex((body,i)=>i!==plan.active
    && JSON.stringify(selectedRigidMoved(scene,positions,i,vectors[0]))!==JSON.stringify(positions));
  assert.ok(other>=0);
  game.dispatch({type:'load',code:'KLOT',level:1});
  for(const ticket of stock.slice(0,7))action(game,ticket);
  const point=selectedRigidPoint(scene,other);
  const pre=action(game,{actionRef:'ACTION6',data:point});
  assert.deepEqual(poses(selectedRigidScene(pre.frame,scene)),poses(scene));
  const out=action(game,{actionRef:direction});
  const measured=poses(selectedRigidScene(out.frame,scene));
  const moved=scene.bodies.filter(b=>JSON.stringify(measured[b.key])!==JSON.stringify(poses(scene)[b.key])).map(b=>b.key);
  assert.deepEqual(moved,[scene.bodies[other].key]);
  return {out,point,moved,expected:scene.bodies[plan.active].key};
}
async function play(game,name,cap,target=0){
  const extent=16, M=NativeSelectedRigid.prototype;
  const {record,propose}=M;
  const events=new Map(),cuts=new Map(),rows=[],stock=[];
  const hooks=[mock.method(M,'record',function(...args){
    const result=record.apply(this,args);
    if(result){
      const {state,detail}=result.events[0];
      const plan=args[5].selected_rigid_plan;
      const first=selectedRigidScene(args[3],plan.scene),second=selectedRigidScene(args[4],plan.scene);
      assert.ok(first&&second);
      events.set(args[1].observation_ref,structuredClone({detail,sujet:state.scene.bodies[state.active]?.key??null,
        avant:poses(first),après:poses(second)}));
    }
    return result;
  })];
  if(name==='historique')hooks.push(mock.method(M,'propose',async function(...args){
    const obs=args[0];
    if(obs.revision!==target)return propose.apply(this,args);
    const source=this.sourceState(),event=source.events.at(-1),previous=source.events.at(-2);
    assert.equal(event.detail.after,obs.observation_ref);
    assert.equal(event.detail.role_status,'selected_receiver_hypothesis');
    cuts.set(obs.observation_ref,{ref:event.detail.after,sujet:event.state.scene.bodies[event.state.active].key,
      ancien:previous.state.scene.bodies[previous.state.active].key});
    this.restoreSourceState({format:source.format,events:source.events.slice(0,-1)});
    try{return await propose.apply(this,args);}finally{this.restoreSourceState(source);}
  }));

  try{
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    let board=game.dispatch({type:'load',code:'KLOT',level:1}),prior,previous,plan,alternate;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      let shown=real;
      if(i===target&&(name==='sélectionStationnaire'||name==='mouvementStationnaire'))
        shown={...prior,stepIndex:i,frames:[prior.frame]};
      if(i===target&&name==='autreRécepteur'){
        assert.equal(previous.actionRef,'ACTION1');
        const {out,...contrast}=moveOther(game,stock,prior,plan,previous.actionRef);
        shown=toV6PublicObservation(out,i);
        alternate=contrast;
      }
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,
          levelActionCaps:Array(6).fill(600),maxActions:extent}})});
      const received=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,q=p?.selected_rigid_plan;
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,vu:digest(shown.frame),arrêt:reply.reason??null,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,command:ticket.actionRef,
          data:ticket.data,admitted:guard?.admitted,mode:q?.mode,sujet:q?.scene.bodies[q.active]?.key,evidence:q?.state.evidence},
        ret:previous&&{id:previous.id,owner:received.family,ref:received.observation_ref,
          matched:received.matched,scellé:received.seal_prefix,raison:received.reason,original:changes(prior.frame,real.frame),
          servi:changes(prior.frame,shown.frame),packet:digest(real.frames),event:events.get(received.observation_ref)}});
      if(!ticket||i===cap)break;
      previous=ticket;prior=shown;plan=q;
      stock.push(ticket);
      board=action(game,ticket);
    }
    if(name==='historique')assert.equal(cuts.size,1);
    return {rows,alternate,...(cuts.size?{interventions:[...cuts.values()]}:{})};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={catalogue:[['nominal',16]],
    retraits:[['historique',8,7],['historique',10,9]],
    retours:[['sélectionStationnaire',2,1],['mouvementStationnaire',7,7],['autreRécepteur',9,9]]};
  assert.ok(Object.hasOwn(sets,group));
  const results={};
  for(const [name,cap,target] of sets[group])results[name==='historique'?name+target:name]=await play(game,name,cap,target);
  return results;
}
