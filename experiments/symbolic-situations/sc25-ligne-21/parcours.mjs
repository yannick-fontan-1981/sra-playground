import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {MotifAccess} from './src/logos-engine/v6-motif-access.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const changed=(a,b)=>a.reduce((n,row,y)=>n+row.filter((v,x)=>v!==b[y][x]).length,0);
async function play(game,name,budget,cap,level=1){
  const M=MotifAccess.prototype,hooks=[],rows=[],events=[],interventions=[];
  const before=M.propose,record=M.record;
  if(['sansGrille','sansCarte'].includes(name))hooks.push(mock.method(M,'propose',async function(...args){
    const [obs,frame,inputs]=args,target=name==='sansGrille'?2:8;
    if(obs.level_epoch!==1||obs.revision!==target)return before.apply(this,args);
    if(this.epoch!==obs.level_epoch)this.start(obs,frame,inputs);
    const grid=this.grid;
    assert.ok(grid?.cards.length);
    this.grid=target===2?null:{...grid,cards:[]};
    interventions.push({ref:obs.observation_ref,grid:target===2?'retirée':'conservée',cards:grid.cards.map(c=>c.mask)});
    try{return await before.apply(this,args);}finally{this.grid=grid;}
  }));
  hooks.push(mock.method(M,'record',function(...args){
    const out=record.apply(this,args);
    events.push({ref:out.ref,status:out.status,mode:out.mode,before:out.before,after:out.after,cleared:out.grid_cleared,
      ray:out.remote_color_contact_hypothesis});
    return out;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'SC25',level}),prior,previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      const shown=name==='stationnaire'&&i===15?{...prior,stepIndex:i,frames:[prior.frame]}:real;
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,f=p?.motif_plan,q=ticket&&p.steps?.[ticket.actionIndex];
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,vu:digest(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,entry:p.material_access_subquestion,
          kind:p.kind,command:ticket.actionRef,data:ticket.data,admitted:guard?.admitted,reason:guard?.reason,refs:p.route_refs,
          motif:f&&{grid:f.ui_lattice_size,cards:f.cards,actor:f.actor,goal:f.homologous_goal,motion:f.measured_translations,
            chosen:f.selected,mode:q.mode,predicted:q.expected_after,card:q.card}},
        ret:previous&&{id:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          frames:real.frames.map(digest),original:changed(prior.frame,real.frame),servi:changed(prior.frame,shown.frame),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      previous={id:ticket.id};prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  const sets={nominal:[['catalogue',16,16]],
    contrôles:[['sansGrille',16,2],['sansCarte',16,8],['stationnaire',16,15]],
    recherche:[['prolongé',55,55],['départN2',16,16,2]]};
  assert.ok(Object.hasOwn(sets,group));
  const combined={};
  for(const [name,...scope] of sets[group]){
    if(name!=='départN2'){
      combined[name]=await play(game,name,...scope);
      continue;
    }
    await assert.rejects(()=>play(game,name,...scope),error=>{
      assert.equal(error.code,'invalid');
      assert.match(error.message,/must begin at level 1 with zero completed levels/);
      combined[name]={refus:error.message};
      return true;
    });
  }
  return combined;
}
