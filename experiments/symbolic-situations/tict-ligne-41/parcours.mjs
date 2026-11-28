import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { sourceBackend } from './scripts/sic-study-source-games.mjs';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { CellPlacementMemory } from './src/logos-engine/v6-cell-placement.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from './src/runtime/v6-agent-protocol.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const trace=JSON.parse(gunzipSync(readFileSync(new URL('docs/migration/native-campaigns-v46/tict-public-trace.json.gz',import.meta.url)))).packets;
const hash=mat=>createHash('sha256').update(JSON.stringify(mat)).digest('hex');

function cellImage(frame,field,x,y) {
  const left=field.origin[0]+x*field.pitch[0], top=field.origin[1]+y*field.pitch[1];
  return frame.slice(top,top+field.size[1]).map(row=>row.slice(left,left+field.size[0]));
}
function changedCells(before,after,field) {
  const changes=[];
  for(let y=0;y<field.shape[1];y++)for(let x=0;x<field.shape[0];x++){
    const a=hash(cellImage(before,field,x,y)), b=hash(cellImage(after,field,x,y));
    if(a!==b)changes.push({cell:[x,y],from:a,to:b});
  }
  return changes;
}
function edited(name,seq,real,previous) {
  if ((name==='statut' && seq===1)||(name==='réfutation' && seq===2)) {
    const frame=previous.frame.map(row=>row.slice());
    for(const x of [4,5]){assert.equal(frame[63][x],4);frame[63][x]=0;}
    return {...real,frame,frames:[frame]};
  }
  if(seq!==1)return real;
  if(name==='finale')return {...real,frames:[real.frame]};
  if(name==='distantDabord'){
    const delta=changedCells(previous.frame,real.frame,previous.field);
    const remote=delta.find(c=>String(c.cell)!==String(previous.point));
    assert.equal(delta.length,2);assert.ok(remote);
    const [x,y]=remote.cell;
    const field=previous.field, image=cellImage(real.frame,field,x,y);
    const left=field.origin[0]+x*field.pitch[0], top=field.origin[1]+y*field.pitch[1];
    const distant=previous.frame.map(row=>row.slice());
    for(const [dy,row] of image.entries())distant[top+dy].splice(left,row.length,...row);
    return {...real,frames:[distant,...real.frames.slice(1).map(()=>real.frame)]};
  }
  return real;
}
function summary(model) {
  return model && {status:model.status,field:model.field_ref,epoch:model.epoch,own:model.own,other:model.other,
    evidence:model.evidence,order:model.ordered_frames,counterexample:model.counterexample};
}
async function play(game,name,cap) {
  const rows=[],events=[],hooks=[];
  for(const key of ['record','recordPacket']){
    const original=CellPlacementMemory.prototype[key];
    hooks.push(mock.method(CellPlacementMemory.prototype,key,function(...args){
      const result=original.apply(this,args);
      for(const ev of result)events.push({method:key,refs:[ev.detail.before_ref,ev.detail.after_ref],
        order:ev.detail.dated_order,unchanged:ev.detail.canonical_unchanged,models:Object.values(ev.models).map(summary)});
      return result;
    }));
  }
  try {
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code:'TICT',level:1}), previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i), obs=edited(name,i,real,previous);
      if(name==='nominal'){
        const p=trace[i].packet;
        for(const [a,b] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed'],['stepIndex','step_index'],['state','state']])
          assert.deepEqual(real[a],p[b],i+' '+a);
        assert.deepEqual(real.availableActionIds,p.available_action_refs.map(a=>Number(a.slice(6))));
      }
      const before=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,plan=p?.cell_placement_plan;
      rows.push({turn:i+1,level:obs.level,completed:obs.levelsCompleted,status:reply.kind,
        returned:previous&&{ticket:previous.id,family:outcome?.family,ref:outcome?.observation_ref,matched:outcome?.matched,
          reason:outcome?.reason,frames:obs.frames.map(frame=>changedCells(previous.frame,frame,previous.field)),
          finalHash:hash(obs.frame),realFinalHash:hash(real.frame),events:events.slice(before)},
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,family:snapshot.lastDecision,kind:p.kind,sub:p.field_subquestion,
          action:ticket.actionRef,data:ticket.data,admitted:snapshot.trace.findLast(e=>e.kind==='before_guard')?.admitted,
          point:plan?.point,field:plan?.field.geometry,fieldRef:plan?.field.ref,model:summary(plan?.model),reason:p.question?.reason,
          expected:plan?.expected_motif,search:Boolean(plan?.search),refs:p.question?.hypothesis_refs}});
      if(!ticket||i===cap)break;
      assert.ok(plan);
      if(name==='nominal') assert.deepEqual([ticket.actionRef,ticket.data],[trace[i+1].command.action_ref,trace[i+1].command.data]);
      previous={id:ticket.id,frame:obs.frame,field:plan.field.geometry,point:plan.point};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),data:ticket.data});
    }
    return rows;
  } finally {for(const hook of hooks.reverse())hook.mock.restore();}
}

export async function run(group,root) {
  const cases={nominal:[['nominal',16]],variantes:[['statut',1],['finale',1],['distantDabord',1],['réfutation',2]]}[group];
  assert.ok(cases);
  const backend=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000), results={};
  try{for(const [name,cap] of cases)results[name]=await play(backend,name,cap);}
  finally{clock.mock.restore();}
  return results;
}
