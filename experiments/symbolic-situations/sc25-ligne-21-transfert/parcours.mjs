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
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const diff=(a,b)=>a.flatMap((r,y)=>r.flatMap((v,x)=>v!==b[y][x]?[[x,y,v,b[y][x]]]:[]));
const sample=p=>({raster:hash(p.frame),frames:p.frames.length,support:p.frame[6].slice(9,15),
  body:p.frame.slice(0,8).flatMap((r,y)=>r.slice(0,13).flatMap((v,x)=>v===3||v===4?[[x,y,v]]:[])),
  score:p.levelsCompleted});
async function play(arm){
  const M=MotifAccess.prototype,{record,propose}=M,board=field(),rows=[],events=[],cuts=[];
  const hooks=[mock.method(M,'record',function(...args){
    const r=record.apply(this,args);
    events.push(structuredClone({tour:args[0].revision,beforeRef:args[0].observation_ref,afterRef:args[1].observation_ref,
      mode:r.mode,ref:r.ref,cleared:r.grid_cleared,before:r.before,after:r.after,ray:this.ray,motion:this.motion,
      blocked:[...this.blocked.keys()]}));
    return r;
  })];
  if(['sansLien','récepteurÉtranger'].includes(arm))hooks.push(mock.method(M,'propose',async function(obs,...args){
    if(obs.revision<8||obs.revision>9)return propose.call(this,obs,...args);
    const ray=this.ray;
    assert.ok(ray&&ray.evidence===this.refs.invoke);
    this.ray=arm==='sansLien'?null:{...ray,receiver:[45,3,49,8]};
    cuts.push(structuredClone({tour:obs.revision,ref:obs.observation_ref,invocation:this.refs.invoke,before:ray,
      used:this.ray,motion:this.motion}));
    try{return await propose.call(this,obs,...args);}finally{this.ray=ray;}
  }));
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sc25-transfer-indep';
    const cap=arm==='intact'?10:9;
    let actual=board.observation(),prior,previous;
    for(let i=0;i<=cap;i++){
      let shown=actual;
      if(arm==='sansOuvertureServie'&&i===9){
        const altered=actual.frame.map(r=>[...r]);
        for(let x=9;x<=14;x++)altered[6][x]=prior.frame[6][x];
        shown={...actual,frame:altered,frames:[altered]};
      }
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:3,
          levelActionCaps:[16,16,16],maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,s=p?.steps?.[ticket?.actionIndex];
      const guard=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,vu:sample(shown),arrêt:reply.reason??null,ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,
        end:s?.expected_after,card:s?.card,mode:s?.mode,refs:p.question?.hypothesis_refs,
        admitted:guard?.admitted,command:ticket.actionRef,data:ticket.data,owner:snapshot.lastDecision,
        entry:p.material_access_subquestion},ret:previous&&{id:previous.id,ref:outcome.observation_ref,
          matched:outcome.matched,scellé:outcome.seal_prefix,raw:sample(actual),position:board.position,
          entrance:board.entrance,contraste:diff(actual.frame,shown.frame)}});
      if(!ticket||i===cap)break;
      previous=ticket;prior=shown;
      actual=board.act(reply.command);
    }
    return {rows,events,cuts};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(){
  const out={};
  for(const arm of ['intact','sansLien','récepteurÉtranger','sansOuvertureServie'])out[arm]=await play(arm);
  return out;
}
