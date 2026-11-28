import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {OrbitConstraints,orbitValues} from './src/logos-engine/v6-orbit-constraints.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const load={type:'load',code:'LP85',level:1};
const point=[5,32];
const historical=[point,[58,32],point,point,point,point,point,[14,26],[14,35],[20,17],[39,17],[48,26],[48,35],[14,35],[14,26],[14,26],[14,35]];
function sample(frame,positions,size){
  return positions.map(([x,y])=>{
    const seen=new Set();
    for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++)seen.add(frame[y+dy][x+dx]);
    return [...seen].sort((a,b)=>a-b);
  });
}
async function play(game,name,cap,budget){
  const F=OrbitConstraints.prototype,rows=[],events=[],interventions=[],guards=[],hooks=[];
  const record=F.record,propose=F.propose,before=F.before;
  if(name==='sansPreuve')hooks.push(mock.method(F,'propose',function(...args){
    const [obs]=args;
    if(obs.level_epoch===1&&obs.revision===3){
      const pair=[...this.models].find(([,x])=>x.key[0]===point[0]&&x.key[1]===point[1]);
      if(pair){
        const [key,model]=pair;
        interventions.push({ref:obs.observation_ref,lost:this.refs.get(key),opérateurs:model.permutations.length});
        this.models.delete(key);this.refs.delete(key);
      }
    }
    return propose.apply(this,args);
  }));
  hooks.push(mock.method(F,'record',function(...args){
    const r=record.apply(this,args);
    events.push({ref:r.ref,status:r.status,matches:r.matches,fields:Object.keys(r).sort()});
    return r;
  }));
  hooks.push(mock.method(F,'before',async function(p,index,packet,obs){
    const real=await before.call(this,p,index,packet,obs);
    if(obs.level_epoch===1&&obs.revision===4&&index===1){
      const {positions,size}=p.orbit_plan,[x,y]=positions[0],frame=packet.frame_rows.map(row=>row.slice());
      const old=frame[y][x],other=(old+1)%16;
      for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++)frame[y+dy][x+dx]=other;
      const rejected=await before.call(this,p,index,{...packet,frame_rows:frame},obs);
      guards.push({ref:obs.observation_ref,site:[x,y],index,old,other,real,rejected});
    }
    return real;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),prior,previous;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      const shown=name==='stationnaire'&&i===3?{...prior,stepIndex:i,frames:[prior.frame]}:actual;
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.orbit_plan,q=ticket&&p.steps?.[ticket.actionIndex];
      const g=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,présenté:hash(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,
          data:ticket.data,index:ticket.actionIndex,admitted:g?.admitted,reason:g?.reason,refs:p.route_refs,
          sides:plan&&{positions:plan.positions,size:plan.size,targets:plan.targets,controls:plan.candidate_control_count,
            operators:plan.unique_observed_operators,why:plan.why,
            before:q.before_values,prediction:q.expected_after,len:p.actions.length,measure:orbitValues(shown.frame,plan.positions,plan.size),
            sampled:sample(shown.frame,plan.positions,plan.size)}},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,seal:outcome.seal_prefix,
          reason:outcome.reason,official:[actual.level,actual.levelsCompleted],packet:actual.frames.map(hash),
          vrai:previous.plan&&sample(actual.frame,previous.plan.positions,previous.plan.size),
          vu:previous.plan&&sample(shown.frame,previous.plan.positions,previous.plan.size),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(i<2||['catalogue','prolongé'].includes(name)){
        assert.equal(ticket.actionRef,'ACTION6');
        assert.deepEqual([ticket.data.x,ticket.data.y],historical[i]);
      }
      previous={id:ticket.id,plan:plan&&{positions:plan.positions,size:plan.size}};prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,guards,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const sets={nominal:{catalogue:[16,16],prolongé:[17,19]},contrôles:{sansPreuve:[3,19],stationnaire:[3,19]}};
  assert.ok(Object.hasOwn(sets,group));
  const game=await sourceBackend(root),out={};
  for(const [name,[cap,budget]] of Object.entries(sets[group]))out[name]=await play(game,name,cap,budget);
  return out;
}
