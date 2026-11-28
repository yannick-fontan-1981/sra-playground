import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {OrderedSupportTransfer,measureOrderedSupportScene} from './src/logos-engine/v6-ordered-support.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/sic-hano-public-returns.json.gz',import.meta.url))));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function changed(a,b){return b.flatMap((row,y)=>row.flatMap((p,x)=>p===a[y][x]?[]:[[x,y]]));}
function area(points){return points.length?[
  Math.min(...points.map(([x])=>x)),Math.min(...points.map(([,y])=>y)),
  Math.max(...points.map(([x])=>x)),Math.max(...points.map(([,y])=>y))]:null;}
function show(name,i,actual,prior){
  if(name==='marque'&&i===1){
    const [left,top,right,bottom]=prior.plan.member.bbox;
    const delta=changed(prior.frame,actual.frame);
    const inside=delta.filter(([x,y])=>left<=x&&x<=right&&top<=y&&y<=bottom);
    assert.ok(inside.length!==delta.length,'la marque a changé de géométrie');
    return {obs:{...actual,frame:prior.frame,frames:actual.frames.map(()=>prior.frame)},
      variation:{raison:'marque hors du membre',modificationsDansLeMembre:inside.length}};
  }
  if(name==='autreMembre'&&i===1){
    const frame=fixture.nominal.observations[3].frame;
    return {obs:{...actual,frame,frames:actual.frames.map(()=>frame)},variation:{observationComparée:3}};
  }
  if(name==='dépôtStationnaire'&&i===2)return {obs:{...actual,frame:prior.frame,frames:actual.frames.map(()=>prior.frame)}};
  return {obs:actual};
}
async function play(game,name,cap,budget){
  const O=OrderedSupportTransfer.prototype,hooks=[],rows=[],events=[],interventions=[];
  if(name==='retrait'){
    const propose=O.propose;
    hooks.push(mock.method(O,'propose',async function(...args){
      const original=await propose.apply(this,args);
      if(!original||args[0].revision!==1)return original;
      interventions.push({tour:1,ref:original.binding.observation_ref,source:original.support_plan.source});
      const alternative=new OrderedSupportTransfer({...this.policy,enabled:false});
      alternative.restore(this.state());
      return propose.apply(alternative,args);
    }));
  }
  const record=O.record;
  hooks.push(mock.method(O,'record',async function(...args){
    const result=await record.apply(this,args);
    for(const event of result.events)events.push({event,closed:this.state().closed});
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}), service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-'+fixture.session;
    let board=game.dispatch({type:'load',code:'HANO',level:1}),previous;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i),{obs,variation}=show(name,i,real,previous);
      if(name==='catalogue'||name==='prolongé'){
        const {palette,...publicPacket}=real;
        assert.deepEqual(publicPacket,fixture.nominal.observations[i]);
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,plan=p?.support_plan?.ordered_support_transfer?p.support_plan:null;
      const physical=previous?changed(previous.frame,real.frame):null,visible=previous?changed(previous.frame,obs.frame):null;
      const stacks=i<=16?await measureOrderedSupportScene(obs.frame):null;
      rows.push({tour:i+1,level:obs.level,score:obs.levelsCompleted,configuration:stacks?.configuration,
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,cmd:ticket.actionRef,data:ticket.data,
          index:ticket.actionIndex,admitted:snapshot.trace.findLast(e=>e.kind==='before_guard')?.admitted,refs:p.question?.hypothesis_refs,
          plan:plan&&{configuration:plan.scene.configuration,target:plan.scene.target,source:plan.source,destination:plan.destination,
            member:plan.member,expected:plan.expected_configuration,key:plan.context_key}},
        ret:previous&&{id:previous.id,ref:outcome.observation_ref,owner:outcome.family,matched:outcome.matched,reason:outcome.reason,seals:outcome.seal_prefix,
          real:hash([real.frame,real.frames]),shown:hash([obs.frame,obs.frames]),pixels:[physical.length,visible.length],bbox:area(visible),variation,events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(name==='catalogue'||name==='prolongé'){
        const expect=fixture.nominal.commands[i];assert.deepEqual([ticket.actionRef,ticket.data],['ACTION'+expect.id,expect.data]);
      }
      previous={id:ticket.id,frame:obs.frame,plan};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),data:ticket.data});
    }
    return {rows,interventions,budget};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16],['prolongé',19,19]],contrôles:[['retrait',4,16],['autreMembre',1,16]],
    réserve:[['marque',1,16],['dépôtStationnaire',2,16]]};
  assert.ok(groups[group]);
  if(group==='réserve')assert.ok(seed);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await play(game,name,cap,budget);}
  finally{clock.mock.restore();}
  return cases;
}
