import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {SupportNavigation} from './src/logos-engine/v6-support-navigation.ts';

const source=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,source)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const load={type:'load',code:'DC22',level:1};
const catalogue=[1,2,3,4,1,4,6,6,6,3,1,1,1,1,4,4];
const click=(x,y)=>({x,y});
const act=(game,id,data)=>game.dispatch({type:'action',actionId:id,...(id===6?{data}:{})});
const flat=(o,x,y)=>o.frame.slice(y,y+2).flatMap(row=>row.slice(x,x+2));
const surface=o=>({porteur:flat(o,10,38),cible:flat(o,10,36)});
const different=(a,b)=>{
  const values={};
  for(let y=0;y<a.length;y++)for(let x=0;x<a[y].length;x++){
    if(a[y][x]===b[y][x])continue;
    const key=a[y][x]+'→'+b[y][x];values[key]=(values[key]??0)+1;
  }
  return values;
};
function alternate(game){
  const first=toV6PublicObservation(game.dispatch(load),0),prefix=[];
  const word=[1,2,3,4,1,4,click(48,19),click(48,19),3];
  for(const [i,item] of word.entries())prefix.push(toV6PublicObservation(act(game,typeof item==='number'?item:6,item),i+1));
  const last=toV6PublicObservation(act(game,1),word.length+1),before=prefix.at(-1);
  return {before,last,summary:{origin:digest(first.frame),prefix:prefix.slice(0,8).map(x=>digest(x.frame)),
    commandes:word,avant:surface(before),après:surface(last),empreintes:[digest(before.frame),digest(last.frame)],
    changement:different(before.frame,last.frame),score:last.levelsCompleted}};
}
async function play(game,name,cap,outside){
  const F=SupportNavigation.prototype,hooks=[],events=[],rows=[],interventions=[],guards=[];
  const propose=F.propose,before=F.before,record=F.recordExisting;
  let turn=1;
  if(name==='retrait')hooks.push(mock.method(F,'propose',async function(...args){
    const proposal=await propose.apply(this,args),p=proposal?.support_plan;
    if(turn!==9||!p?.experiment_key||proposal.actions[0]?.action_ref!=='ACTION6')return proposal;
    interventions.push({ref:args[0].observation_ref,key:p.experiment_key,offer:proposal.actions[0]});
    return null;
  }));
  if(outside)hooks.push(mock.method(F,'before',async function(proposal,index,packet,observation){
    const real=await before.call(this,proposal,index,packet,observation);
    const plan=proposal.support_plan;
    if(turn===11&&index===1&&plan.positions[index]?.join()==='10,36'){
      const cross=await before.call(this,proposal,index,{...packet,frame_rows:outside.before.frame},observation);
      guards.push({ref:observation.observation_ref,index,command:proposal.actions[index],scope:proposal.binding,
        vrai:real,croisé:cross,cible:plan.positions[index],surfaceÉtrangère:surface(outside.before)});
    }
    return real;
  }));
  hooks.push(mock.method(F,'recordExisting',async function(...args){
    const result=await record.apply(this,args);
    const additions=result.events.map(e=>{
      const effect=e.effect,measurement=effect?.typed_transition_measurements;
      return {kind:e.kind,command:e.command,delta:e.delta,question:e.question_key,usefulness:e.usefulness,
        before:e.before??effect?.before??args[0].observation_ref,after:e.after??effect?.after??args[1].observation_ref,
        cellRows:measurement?.cell_transition_rows?.length};
    });
    events.push(...additions);
    return result;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),previous,prior;
    for(let i=0;i<=cap;i++){
      const actual=toV6PublicObservation(board,i);
      const shown=name==='stationnaire'&&i===2?{...actual,frame:prior.frame,frames:[prior.frame]}:actual;
      const start=events.length;turn=i+1;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.support_plan;
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,surface:surface(shown),empreinte:digest(shown.frame),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,kind:p.kind,action:ticket.actionRef,data:ticket.data,index:ticket.actionIndex,
          admitted:guard?.admitted,guard:guard?.reason,question:p.question?.reason,promesse:plan?.positions[ticket.actionIndex],
          positions:plan?.positions,actions:p.actions,underlay:plan?.underlay?.row?.underlay_values,
          actor:plan?.actor_bbox,experiment:plan?.experiment_key},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,reason:outcome.reason,
          vrai:digest(actual.frame),paquet:actual.frames.map(digest),changement:different(prior.frame,actual.frame),events:events.slice(start)}});
      if(!ticket||i===cap)break;
      if(name==='nominal'||i<(name==='retrait'?8:2))assert.equal(ticket.actionRef,'ACTION'+catalogue[i]);
      previous={id:ticket.id};prior=shown;
      board=act(game,Number(ticket.actionRef.slice(6)),ticket.data);
    }
    return {rows,guards,interventions};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,gameRoot){
  const game=await sourceBackend(gameRoot);
  if(group==='nominal'){
    const alt=alternate(game);
    return {nominal:await play(game,'nominal',16,alt),alternatif:alt.summary};
  }
  assert.equal(group,'contrôles');
  return {retrait:await play(game,'retrait',11),stationnaire:await play(game,'stationnaire',2)};
}
