import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {FieldServiceMemory,fieldServiceBefore} from './src/logos-engine/v6-field-service-access.ts';
import {framedPatterns} from './src/logos-engine/v6-geometric-scene.ts';
import {geometricComponents} from './src/logos-engine/v6-native-observer.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const inside=(box,x,y)=>box&&x>=box[0]&&y>=box[1]&&x<=box[2]&&y<=box[3];
function delta(a,b,box){
  const hist={},local={},distant={};
  let total=0,près=0;
  for(let y=0;y<a.length;y++)for(let x=0;x<a[y].length;x++){
    if(a[y][x]===b[y][x])continue;
    const tag=a[y][x]+'→'+b[y][x],isLocal=inside(box,x,y),region=isLocal?local:distant;
    total++;près+=Number(Boolean(isLocal));hist[tag]=(hist[tag]??0)+1;region[tag]=(region[tag]??0)+1;
  }
  return {total,près,loin:total-près,hist,local,distant};
}
function view(name,index,actual,prior,box){
  if(name==='exAequo'&&index===0){
    const frame=actual.frame.map(row=>row.slice());
    for(let y=0;y<6;y++)for(let x=0;x<6;x++)frame[2+y][2+x]=actual.frame[18+y][24+x];
    return {...actual,frame,frames:[frame]};
  }
  if(index!==1||!['local','distant','stationnaire'].includes(name))return actual;
  const frame=actual.frame.map((row,y)=>row.map((v,x)=>{
    const local=inside(box,x,y);
    return (name==='local'&&local||name==='distant'&&!local)?v:prior.frame[y][x];
  }));
  return {...actual,frame,frames:[frame]};
}
async function play(game,code,name,cap){
  const F=FieldServiceMemory.prototype,events=[],offers=[],rows=[],guards=[],hooks=[];
  const record=F.record,offer=F.nestedQuestion;
  hooks.push(mock.method(F,'nestedQuestion',function(obs,frame,cfg){
    const answer=offer.call(this,obs,frame,cfg);
    if(obs.revision===1){
      const matches=framedPatterns(frame,geometricComponents(frame)).filter(p=>{
        const [l,t,r,b]=p.bbox,w=r-l+1,h=b-t+1,[x,y]=p.center;
        return w===h&&w<=Math.min(frame.length,frame[0].length)*cfg.maximum_extent_fraction&&p.mask.length===1&&
          p.foreground_area>=cfg.minimum_core_area&&p.foreground_area===p.scale**2&&frame[y][x]===p.color;
      }).map(p=>({bbox:p.bbox,point:p.center,core:p.foreground_area,area:(p.bbox[2]-p.bbox[0]+1)**2}));
      offers.push({ref:obs.observation_ref,matches,point:answer?.nested_control_plan.selected.point??null});
    }
    return answer;
  }));
  hooks.push(mock.method(F,'record',function(...args){
    const result=record.apply(this,args);
    for(const e of result??[])events.push({kind:e.kind,evidence:e.evidence,stop:e.stop_reason,frame:e.frame_digest,
      phase:e.context?.phase,count:e.context?.fields?.length,contextRefs:e.context?.evidence,
      total:e.changed_pixels,local:e.changed_inside_control,distant:e.changed_outside_control,same:e.same_epoch,
      official:e.official_progress,disposition:e.disposition,selection:e.selection_acquired,impossible:e.impossibility_acquired});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch({type:'load',code,level:1}),previous,prior;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i),shown=view(name,i,actual,prior,previous?.box);
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.nested_control_plan;
      const g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      if(i===0&&plan){
        const meta={epoch:plan.epoch,score:plan.score,observation_ref:plan.observation_ref,available:shown.availableActionIds.map(a=>'ACTION'+a)};
        const alternative={...p,actions:p.actions.map(x=>({...x,data:{...x.data,x:x.data.x+1}}))};
        guards.push({actual:fieldServiceBefore(p,0,shown.frame,meta),other:fieldServiceBefore(alternative,0,shown.frame,meta)});
      }
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,
        présenté:digest(shown.frame),réel:digest(actual.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,entry:p.field_subquestion,kind:p.kind,
          action:ticket.actionRef,data:ticket.data,admitted:g?.admitted,guard:g?.reason,selected:plan?.selected,alts:plan?.alternative_enclosures,
          expected:plan?.expected_effect,predicted:p.steps?.[ticket.actionIndex]?.expected_after,
          phase:plan?.phase,evidence:p.route_refs,frame:plan?.frame_digest,field:plan?.field_state_before},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,seal:outcome.seal_prefix,
          reason:outcome.reason,original:delta(prior.frame,actual.frame,previous.box),servi:delta(prior.frame,shown.frame,previous.box),
          paquet:actual.frames.map(digest),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      previous={id:ticket.id,box:plan?.selected?.bbox};prior=shown;
      const id=Number(ticket.actionRef.slice(6));
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,offers,guards};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  if(group==='nominal')return {GIGO:await play(game,'GIGO','nominal',1),VALV:await play(game,'VALV','nominal',11)};
  assert.equal(group,'contrôles');
  const result={};
  for(const name of ['exAequo','stationnaire','local','distant'])result[name]=await play(game,'GIGO',name,1);
  return result;
}
