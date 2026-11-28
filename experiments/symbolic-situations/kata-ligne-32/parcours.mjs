import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {NativePreviewPacking} from './src/logos-engine/v6-preview-packing.ts';

const source=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const gz=p=>JSON.parse(gunzipSync(readFileSync(new URL(p,import.meta.url))));
const trace=gz('docs/migration/lot6a-evidence/integrated-final-02/kata-public-trace.json.gz').packets;
const fixture=gz('tests/fixtures/sic-kata-alternate-returns.json.gz');
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function nominal(i){
  const p=trace[i].packet;
  return {frame:p.frame_rows,frames:p.frame_packet,level:p.level,levelsCompleted:p.levels_completed,
    state:p.state,stepIndex:p.step_index,availableActionIds:p.available_action_refs.map(v=>Number(v.slice(6)))};
}
function samples(frame,plan,member){
  const piece=plan.model.pieces.find(p=>p.id===member);
  if(!piece)return null;
  const {q,offset:[a,b]}=plan.model;
  return piece.mask.map(([y,x])=>{
    const counts={};
    for(let dy=0;dy<q;dy++)for(let dx=0;dx<q;dx++){
      const color=frame.at(a+(y+piece.anchor[0])*q+dy).at(b+(x+piece.anchor[1])*q+dx);
      counts[color]=(counts[color]??0)+1;
    }
    return counts;
  });
}
async function play(game,name,cap,budget,seed){
  const family=NativePreviewPacking.prototype,hooks=[],events=[],rows=[],interventions=[];
  const record=family.record,propose=family.propose;
  if(['moinsUn','moinsTout'].includes(name))hooks.push(mock.method(family,'propose',async function(...args){
    if(args[0].revision!==18)return propose.apply(this,args);
    const state=this.sourceState();
    const normal=await propose.apply(this,args);
    assert.equal(normal?.status,'proposed');
    const action=normal.actions[0].action_ref,written=state.packing_controls;
    assert.ok(Object.hasOwn(written,action));
    const kept={...written};
    for(const key of Object.keys(written))if(key===action||name==='moinsTout')delete kept[key];
    interventions.push({ref:args[0].observation_ref,controls:written,kept,action,prediction:normal.preview_packing_plan.expected[0]});
    const shadow=new NativePreviewPacking({limits:this.limits});
    shadow.restoreSourceState({...state,packing_controls:kept});
    return propose.apply(shadow,args);
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const result=record.apply(this,args);
    const {preview_packing_plan:plan}=args[5]??{};
    for(const e of result?.events??[]){
      const own=plan.model.pieces.find(p=>p.id===plan.chosen);
      const {selected,preview_color,pieces}=e.model;
      const other=plan.model.pieces.map(x=>x.id).filter(x=>x!==plan.chosen).sort();
      const alternative=name==='réserve'&&seed&&plan.mode==='select'&&other.length?other[seed[0]%other.length]:null;
      const invented=alternative&&{ref:e.detail.after,member:alternative,samples:samples(args[4],plan,alternative)};
      events.push({detail:e.detail,controls:e.controls,selected,preview_color,pieces,epoch:e.model.epoch,
        binding:plan.mode==='select'?{ref:e.detail.after,member:plan.chosen,samples:samples(args[4],plan,plan.chosen),color:own.color}:null,
        invented});
    }
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+fixture.session;
    let board=game.dispatch({type:'load',code:'KATA',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i),{palette,...actual}=real;
      if(i<=17||name==='catalogue'||name==='prolongé')assert.deepEqual(actual,nominal(i));
      if(name==='moinsTout'&&i>=18)assert.deepEqual(actual,fixture.observations[i-18]);
      const final=real.frame,frames=real.frames.map(digest),finalHash=digest(final);
      const obs=name==='stationnaire'&&i===1?{...real,frame:nominal(0).frame,frames:[nominal(0).frame]}:
        name==='réserve'&&i===1?{...real,frames:[final]}:real;
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.preview_packing_plan;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({tour:i+1,niveau:obs.level,score:obs.levelsCompleted,ref:ticket?.observationRef,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          admitted:guard?.admitted,mode:plan?.mode,pending:plan?.model.pieces.filter(v=>v.movable).map(v=>v.id),
          selected:plan?.model.selected,preview:plan?.model.preview_color,chosen:plan?.model.pieces.find(p=>p.id===plan.chosen),
          target:plan?.target,prediction:plan?.expected[ticket.actionIndex],refs:p.question?.hypothesis_refs,epoch:plan?.epoch},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          réel:frames,servi:obs.frames.map(digest),finale:finalHash,présenté:digest(obs.frame),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(i<17||name==='prolongé'){
        const command=trace[i+1].command;
        assert.deepEqual([ticket.actionRef,ticket.data],[command.action_ref,command.data??{}]);
      }
      previous={id:ticket.id};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),...(ticket.data?.x===undefined?{}:{data:ticket.data})});
    }
    return {rows,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,gameRoot,seed){
  const sets={nominal:{catalogue:[16,16],prolongé:[33,34]},contrôles:{stationnaire:[1,16],moinsUn:[19,23],moinsTout:[19,23]},
    réserve:{réserve:[1,16]}};
  assert.ok(Object.hasOwn(sets,group));
  const game=await sourceBackend(gameRoot),cases={};
  for(const [k,[cap,budget]] of Object.entries(sets[group]))cases[k]=await play(game,k,cap,budget,seed);
  return cases;
}
