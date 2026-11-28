import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mock } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from './scripts/sic-study-source-games.mjs';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { BranchRouting } from './src/logos-engine/v6-branch-routing.ts';
import { CellPlacementMemory } from './src/logos-engine/v6-cell-placement.ts';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from './src/runtime/v6-agent-protocol.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const ref=path=>JSON.parse(readFileSync(new URL(path,src)));
const declarations={common:ref('laya_proto/common_frontier_policy.drm.json'),strategy:ref('morphology_policy/strategy.drm')};
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/sic-sp80-public-returns.json.gz',import.meta.url))));
const branch='parallel_branch_routing', cell='cell_patch_placement';

function pixelChanges(before,after,field) {
  const points=[];let total=0,local=0;
  for(let y=0;y<after.length;y++)for(let x=0;x<after[y].length;x++){
    if(before[y][x]===after[y][x])continue;
    total++;
    if(total<=8)points.push([x,y]);
    if(field){
      const {origin,pitch,size,shape}=field;
      if(x>=origin[0] && x<origin[0]+(shape[0]-1)*pitch[0]+size[0] &&
         y>=origin[1] && y<origin[1]+(shape[1]-1)*pitch[1]+size[1])local++;
    }
  }
  return {total,local:field?local:null,points:total<=8?points:undefined};
}

function summarizeCell(e) {
  return {kind:e.kind,before:e.detail?.before_ref,after:e.detail?.after_ref,unchanged:e.detail?.canonical_unchanged,
    refused:e.refused,models:Object.keys(e.models??{}),trial:e.detail?.trial};
}

async function play(game,name,cap,seed) {
  const hooks=[],offers=[],choices=[],events=[],rows=[];
  let turn=0;
  const B=BranchRouting.prototype,C=CellPlacementMemory.prototype;
  function wrap(obj,key,handler){
    const original=obj[key];
    hooks.push(mock.method(obj,key,function(...args){return handler.call(this,original,args);}));
  }
  function offer(p,family,kind,obs,base){
    if(p?.kind!==kind)return p;
    const suppress=(turn===1 && name==='retrait4' && kind===branch) || (turn===12 && name==='retrait41' && kind===cell);
    offers.push({turn,family,kind,ref:obs.observation_ref,action:p.actions[0],point:p.cell_placement_plan?.point,suppress});
    return suppress?base:p;
  }
  wrap(B,'propose',function(original,args){
    const got=original.apply(this,args), inspect=p=>offer(p,'branch_routing',branch,args[0],null);
    return got instanceof Promise ? got.then(inspect) : inspect(got);
  });
  wrap(C,'proposeCell',function(original,args){
    return offer(original.apply(this,args),'public_occurrence_recall',cell,args[0],args[5]??{status:'abstained'});
  });
  for(const [t,owner,key,line] of [[1,B,'selectCalibration',4],[12,C,'selectProbeCell',41]]){
    if(!['autre'+line,'vide'+line].includes(name))continue;
    wrap(owner,key,function(original,args){
      if(t!==turn)return original.apply(this,args);
      const ordered=args[0];assert.ok(ordered.length>=2);
      const index=name.startsWith('vide')?null:1+seed[line===4?0:1]%(ordered.length-1);
      choices.push({turn,ordered,index});
      if(line===41)return index;
      return index===null?undefined:ordered[index];
    });
  }
  wrap(B,'record',function(original,args){
    const e=original.apply(this,args);
    events.push({family:'branch_routing',status:e.status,mode:e.mode,source:args[0].observation_ref,ref:e.ref,
      before:e.before,after:e.after,motion:{...this.motion},refs:{...this.refs}});
    return e;
  });
  for(const key of ['record','recordPacket']){
    wrap(C,key,function(original,args){
      const acquired=original.apply(this,args);
      for(const event of acquired)events.push({family:'public_occurrence_recall',...summarizeCell(event)});
      return acquired;
    });
  }
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+fixture.session;
    let board=game.dispatch({type:'load',code:'SP80',level:1}),past;
    for(let i=0;i<=cap;i++){
      turn=i+1;
      const real=toV6PublicObservation(board,i);
      const obs=name==='stationnaire' && i===12?{...real,frame:past.frame,frames:real.frames.map(()=>past.frame)}:real;
      if(name==='nominal')assert.deepEqual(obs,fixture.observations[i]);
      const eventStart=events.length,offerStart=offers.length;
      let r=await service.handle({sessionId,sequence:i,observation:obs,...(past?
        {type:'advance',ticketId:past.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=r.snapshot.trace.findLast(v=>v.kind==='actual_outcome');
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=r,p=snapshot.proposal,fp=p?.cell_placement_plan,step=ticket&&p.steps[ticket.actionIndex];
      const guard=snapshot.trace.findLast(v=>v.kind==='before_guard');
      rows.push({turn,status:r.kind,level:obs.level,completed:obs.levelsCompleted,offers:offers.slice(offerStart),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,family:snapshot.lastDecision,kind:p.kind,
          sub:p.field_subquestion??p.material_access_subquestion,cmd:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          mode:step?.mode,admitted:guard?.admitted,expected:step?.expected_after,field:fp?.field.geometry,grid:fp?.field.grid,
          point:fp?.point,trial:fp?.trial,expectedMotif:fp?.expected_motif,
          topology:name==='topologie' && p.branch_plan ? {sources:p.branch_plan.sources,cavities:p.branch_plan.cavities,
            lengths:p.branch_plan.contributor_lengths,state:p.branch_plan.current}:undefined},
        returned:past&&{ticket:past.id,cmd:past.cmd,data:past.data,ref:outcome?.observation_ref,family:outcome?.family,matched:outcome?.matched,
          reason:outcome?.reason,real:pixelChanges(past.frame,real.frame,past.field),seen:pixelChanges(past.frame,obs.frame,past.field),
          realFrames:real.frames.map(f=>pixelChanges(past.frame,f,past.field).total),servedFrames:obs.frames.map(f=>pixelChanges(past.frame,f,past.field).total),
          events:events.slice(eventStart)}});
      if(!ticket || i===cap)break;
      if(name==='nominal')assert.deepEqual([ticket.actionRef,ticket.data],['ACTION'+fixture.commands[i].id,fixture.commands[i].data??{}]);
      past={id:ticket.id,cmd:ticket.actionRef,data:ticket.data,frame:obs.frame,field:fp?.field.geometry};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),data:ticket.data});
    }
    return {rows,choices};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['nominal',16]],topologie:[['topologie',0]],retrait:[['retrait4',2],['retrait41',13]],réserve:[['stationnaire',13]],
    substitution:[['autre4',2],['autre41',13],['vide4',2],['vide41',13]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root), clock=mock.method(Date,'now',()=>1700000000000), results={};
  try{for(const [name,cap] of groups[group])results[name]=await play(game,name,cap,seed);}
  finally{clock.mock.restore();}
  return results;
}
