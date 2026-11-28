import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from './scripts/sic-study-source-games.mjs';
import { V6AgentService } from './src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from './src/runtime/v6-agent-protocol.ts';
import { createNativeV6Runtime } from './src/logos-engine/v6-native-runtime.ts';
import { AnimatedContactAccess, animatedCrossInvitation } from './src/logos-engine/v6-animated-contact.ts';
import { TypedMaterialMemory } from './src/logos-engine/v6-typed-material-access.ts';

const source = new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path,source)));
const declarations = { common:read('laya_proto/common_frontier_policy.drm.json'), strategy:read('morphology_policy/strategy.drm') };
const trace = JSON.parse(gunzipSync(readFileSync(new URL('docs/migration/native-campaigns-v50/life-public-trace-final.json.gz',import.meta.url)))).packets;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const subject = s => s && ({ id:s.id, point:s.point, bbox:s.bbox, profile:s.fringe, source:s.source_ref });
const diff = (a,b) => a.reduce((n,row,y) => n+row.reduce((m,c,x)=>m+Number(c!==b[y][x]),0),0);

function recordEvent(e) {
  return {kind:e.kind, refs:e.evidence, point:e.command?.data, selected:subject(e.selected),
    effect:e.effect, context:e.contact_context?.kind, marked:subject(e.context?.child),
    additions:e.added_children?.map(subject), removed:e.removed_children, pixels:e.changed_public_pixels?.length,
    mode:e.mode, frames:e.packet_frames, measurement:e.measurement && hash(e.measurement), model:e.model && hash(e.model)};
}

function serve(name, turn, observation, previous, seed) {
  if (name==='immobile' && turn===1) return {...observation, frames:observation.frames.map(()=>observation.frame)};
  if (name==='sansMarque'+turn) {
    const frames=observation.frames.slice();
    frames[frames.length-1]=previous.frame;
    return {...observation,frame:previous.frame,frames};
  }
  if (name!=='local'+turn) return observation;
  const radius = 3 + seed[turn===2 ? 2 : 3]%3;
  const {x,y} = previous.data;
  const edit = frame => frame.map((row,v)=>row.map((pixel,u)=>
    Math.max(Math.abs(x-u),Math.abs(y-v))<=radius ? previous.frame[v][u] : pixel));
  return {...observation, frame:edit(observation.frame), frames:observation.frames.map(edit)};
}

async function one(game, name, cap, seed) {
  const handles=[], events=[], offers=[], rows=[];
  const AP=AnimatedContactAccess.prototype, TP=TypedMaterialMemory.prototype;
  const listen=(obj,key,fn)=>{ const original=obj[key]; handles.push(mock.method(obj,key,function(...args){ return fn.call(this,original,args); })); };
  let revision=0;
  listen(AP,'recordPacket',function(original,args){ const result=original.apply(this,args);events.push(...result.map(recordEvent));return result; });
  listen(TP,'record',function(original,args){ const result=original.apply(this,args);events.push(...result.map(recordEvent));return result; });
  if (name==='retrait1') listen(AP,'proposeGraph',function(original,args){
    if (revision===1) {
      const graph=args[0], invitation=animatedCrossInvitation(graph);
      if (invitation) {
        offers.push({revision, invitation:invitation.point});
        args[0]={...graph,entities:graph.entities.filter(e=>e.id!==invitation.entity_ref)};
      }
    }
    return original.apply(this,args);
  });
  if (name.startsWith('autre')) listen(TP,'selectUnboundSubject',function(original,args){
    if (name!=='autre'+revision) return original.apply(this,args);
    const candidates=args[0];
    assert.ok(candidates.length>1);
    const index=1+seed[revision===2?0:1]%(candidates.length-1);
    offers.push({revision,index,points:candidates.map(c=>c.point)});
    return index;
  });
  try {
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    const budgets={targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16};
    let board=game.dispatch({type:'load',code:'LIFE',level:1}), previous;
    for(let i=0;i<=cap;i++){
      revision=i+1;
      const real=toV6PublicObservation(board,i), obs=serve(name,i,real,previous,seed);
      if(name==='nominal'){
        for(const [key,archived] of [['frame','frame_rows'],['frames','frame_packet'],['level','level'],['levelsCompleted','levels_completed']]){
          assert.deepEqual(obs[key],trace[i].packet[archived],i+' '+key);
        }
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous ?
        {type:'advance',ticketId:previous.id,executionMs:0} : {type:'init',budgets})});
      const ret=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply, p=snapshot.proposal, carrier=p?.typed_carrier_plan, flow=p?.material_flow_plan;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({turn:revision,status:reply.kind,level:obs.level,score:obs.levelsCompleted,
        returned:previous && {ticket:previous.id,owner:ret?.family,ref:ret?.observation_ref,matched:ret?.matched,reason:ret?.reason,
          actualPixels:diff(real.frame,previous.frame),seenPixels:diff(obs.frame,previous.frame),
          altered:diff(real.frame,obs.frame),images:obs.frames.length,distinct:new Set(obs.frames.map(hash)).size,events:events.slice(start)},
        ticket:ticket && {id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,sub:p.field_subquestion,
          action:ticket.actionRef,point:ticket.data,admitted:guard?.admitted,expected:p.steps?.[ticket.actionIndex]?.expected_after,
          offeredCarriers:carrier?.scene.carriers.map(subject),chosen:subject(carrier?.selected),bound:subject(carrier?.contact_context?.selected),
          context:carrier?.contact_context?.kind,mode:flow?.mode,child:subject(flow?.child),target:subject(flow?.target),refs:p.route_refs}});
      if(!ticket || i===cap) break;
      if(name==='nominal') assert.deepEqual(ticket.data,trace[i+1].command.data);
      previous={id:ticket.id,frame:obs.frame,data:ticket.data};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),data:ticket.data});
    }
    return {rows,offers};
  } finally {for(const handle of handles.reverse())handle.mock.restore();}
}

export async function run(group,root,seed) {
  const cases={nominal:[['nominal',16]],contact:[['retrait1',2],['immobile',2]],
    réserve:[['local2',3],['local5',6]],substitution:[['autre2',4],['autre5',6]],
    complément:[['sansMarque2',2],['sansMarque5',5]]}[group];
  assert.ok(cases);
  const game=await sourceBackend(root), results={};
  const clock=mock.method(Date,'now',()=>1700000000000);
  try {for(const [name,cap] of cases)results[name]=await one(game,name,cap,seed);}
  finally {clock.mock.restore();}
  return results;
}
