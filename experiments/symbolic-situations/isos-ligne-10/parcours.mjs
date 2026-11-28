import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {NativeFacetExamples} from './src/logos-engine/v6-facet-examples.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const load={type:'load',code:'ISOS',level:1};
function pixelDiff(a,b,bounds){
  let inside=0,outside=0;
  for(let y=0;y<a.length;y++)for(let x=0;x<a[y].length;x++){
    if(a[y][x]===b[y][x])continue;
    if(bounds&&x>=bounds[0]&&y>=bounds[1]&&x<=bounds[2]&&y<=bounds[3])inside++;
    else outside++;
  }
  return {inside,outside};
}
async function play(game,name,cap){
  const F=NativeFacetExamples.prototype,events=[],rows=[],changes=[],hooks=[];
  const record=F.record;
  hooks.push(mock.method(F,'record',function(...args){
    const result=record.apply(this,args),[before,after]=args,state=this.state(),prior=state.portable;
    const epoch=name==='sansPassageN3'?2:1;
    if(before.level_epoch===epoch&&after.level_epoch===epoch+1&&result.status==='official_boundary'&&
        ['sansPassage','sansPassageN3','référenceÉtrangère'].includes(name)){
      assert.equal(prior.boundary_ref,after.observation_ref);
      const adjusted={...prior};
      if(name==='référenceÉtrangère')adjusted.boundary_ref=before.observation_ref;
      else delete adjusted.boundary_ref;
      this.restore({...state,portable:adjusted});
      changes.push({tour:before.revision,avant:prior,après:adjusted,retour:after.observation_ref});
    }
    events.push({status:result.status,evidence:result.evidence,shift:result.cap_shift,side:result.side_changes?.map(x=>x.vertical_extension),
      outside:result.outside_preserved,matched:result.whole_colored_render_matched,portable:prior,
      before:before.observation_ref,after:after.observation_ref});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),prior,previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      const still=name==='stationnaireT1'&&i===1||name==='stationnaireT2'&&i===2;
      const shown=still?{...prior,stepIndex:i,frames:[prior.frame]}:real,start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.facet_plan,q=plan?.projection,g=snapshot.trace.findLast(x=>x.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,image:hash(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,entry:p.program_subquestion,
          command:ticket.actionRef,data:ticket.data,admitted:g?.admitted,guard:g?.reason,refs:p.route_refs,
          predicted:p.steps?.[ticket.actionIndex]?.expected_after,world:q?.world,example:q?.example_box,scale:q?.scale_hypothesis,scope:q?.scope_ref,
          offer:q?.offer.kind,support:q?.offer.support.bbox,method:plan?.method,
          parts:q&&[q.example_parts.map(r=>r.palette_value),q.reference_parts.map(r=>r.palette_value)],
          compound:q?.compound&&{prefix:q.compound.prefix,status:q.compound.port_status,model:q.compound.model_ref}},
        return:previous&&{id:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          official:[real.level,real.levelsCompleted],packet:real.frames.map(hash),original:pixelDiff(prior.frame,real.frame,previous.world),
          served:pixelDiff(prior.frame,shown.frame,previous.world),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      const id=Number(ticket.actionRef.slice(6));previous={id:ticket.id,world:q?.world};prior=shown;
      board=game.dispatch({type:'action',actionId:id,...(id===6?{data:ticket.data}:{})});
    }
    return {rows,changes};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root);
  if(group==='nominal')return {catalogue:await play(game,'catalogue',16)};
  assert.equal(group,'contrôles');
  const out={};
  for(const [name,cap] of Object.entries({sansPassage:3,sansPassageN3:7,référenceÉtrangère:4,stationnaireT1:1,stationnaireT2:2})){
    out[name]=await play(game,name,cap);
  }
  return out;
}
