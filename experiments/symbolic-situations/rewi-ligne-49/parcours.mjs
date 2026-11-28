import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';
import {FramedWindowMemory,framedWindowBefore} from './src/logos-engine/v6-framed-window-access.ts';
import {measureFramedWindow} from './src/logos-engine/v6-framed-window-observation.ts';

const root=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const load={type:'load',code:'REWI',level:1};
const point={x:33,y:24};
const clicks=[34,28,22,16,10,4];
const gameStep=(game,actionId,data)=>game.dispatch({type:'action',actionId,...(actionId===6?{data}:{})});
const difference=(a,b)=>a.reduce((c,row,y)=>c+row.filter((x,i)=>x!==b[y][i]).length,0);
const inner=(frame,[l,t,r,b])=>frame.slice(t+1,b).map(row=>row.slice(l+1,r));
function enumerate(frame,boxes){
  const pattern=inner(frame,boxes[0]),image=inner(frame,boxes[1]);
  let checks=0;const matches=[];
  for(let y=0;y+pattern.length<=image.length;y++)for(let x=0;x+pattern[0].length<=image[0].length;x++){
    checks++;
    if(pattern.every((row,dy)=>row.every((v,dx)=>image[y+dy][x+dx]===v)))matches.push([x,y]);
  }
  return {checks,matches,boxes};
}
function fromNative(native){
  if(!native)return null;
  return {matches:native.matches,checks:native.examined_windows,boxes:[native.reference_box,native.image_box]};
}
function altered(name,real,original){
  const frame=real.frame.map(row=>row.slice());
  const [l,t]=original.image_box,w=original.reference;
  if(name==='deux'){
    for(const [y,row] of w.entries())for(const [x,v] of row.entries())frame[t+6+y][l+6+x]=v;
  }else{
    const [x,y]=original.matches[0],xx=l+x+1,yy=t+y+1;
    frame[yy][xx]=(frame[yy][xx]+1)%16;
  }
  return {...real,frame,frames:[frame]};
}
function early(game){
  const prefix=[toV6PublicObservation(game.dispatch(load),0)];
  for(const x of clicks)prefix.push(toV6PublicObservation(gameStep(game,6,{x,y:61}),prefix.length));
  const prior=toV6PublicObservation(gameStep(game,3),7);prefix.push(prior);
  const result=toV6PublicObservation(gameStep(game,6,point),8);
  return {prior,summary:{prefix:prefix.map(x=>hash(x.frame)),action:['ACTION6',point],unique:fromNative(measureFramedWindow(prior.frame)),
    gain:result.levelsCompleted,level:result.level,changed:difference(prior.frame,result.frame),packet:result.frames.map(hash)}};
}
async function play(game,name,cap,earlyCase){
  const F=FramedWindowMemory.prototype,events=[],blocked=[],guards=[],rows=[],hooks=[];
  const record=F.record,apply=F.applyEvent;
  hooks.push(mock.method(F,'record',function(...args){
    const r=record.apply(this,args);events.push(...r);return r;
  }));
  hooks.push(mock.method(F,'applyEvent',function(e){
    const r=apply.call(this,e);
    if(e.kind==='framed_window_response')blocked.push({ref:e.evidence.at(-1),keys:this.currentState().window_blocked});
    return r;
  }));
  try{
    const runtime=await createNativeV6Runtime(declarations,{now:()=>0}),service=new V6AgentService(()=>runtime);
    const sessionId='sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
    let board=game.dispatch(load),previous,prior,nominalFrame;
    for(let i=0;i<=cap;i++){
      const real=toV6PublicObservation(board,i);
      if(i===8)nominalFrame=real;
      const rawMatch=i===8?measureFramedWindow(real.frame):null;
      const shown=i===8&&['deux','zéro'].includes(name)?altered(name,real,rawMatch):
        i===9&&name==='stationnaire'?{...prior,stepIndex:i,frames:[prior.frame]}:real;
      const found=measureFramedWindow(shown.frame,true);
      const box=rawMatch&&[rawMatch.reference_box,rawMatch.image_box],start=events.length,prevB=blocked.length;
      let reply=await service.handle({sessionId,sequence:i,observation:shown,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:16}})});
      const outcome=reply.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {ticket,snapshot}=reply,p=snapshot.proposal,f=p?.framed_window_plan,g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      if(i===8&&f){
        const meta={epoch:f.epoch,score:f.score,observation_ref:f.observation_ref,available:shown.availableActionIds.map(a=>'ACTION'+a)};
        const probe=frame=>framedWindowBefore(p,0,frame,meta);
        guards.push({actuel:probe(shown.frame),unTourAvant:probe(earlyCase.prior.frame),sansÉgalité:probe(altered('zéro',nominalFrame,rawMatch).frame),
          doubleÉgalité:probe(altered('deux',nominalFrame,rawMatch).frame)});
      }
      rows.push({tour:i+1,niveau:shown.level,score:shown.levelsCompleted,stop:reply.reason??null,empreinte:hash(shown.frame),
        physique:hash(real.frame),unique:Boolean(measureFramedWindow(shown.frame)),natif:fromNative(found),
        indépendant:box&&enumerate(shown.frame,box),
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,owner:snapshot.lastDecision,entry:p.field_subquestion,kind:p.kind,action:ticket.actionRef,
          data:ticket.data,admitted:g?.admitted,guard:g?.reason,question:p.question?.reason,refs:p.route_refs,
          expected:p.steps?.[ticket.actionIndex]?.expected_after,information:Boolean(p.sic_information_decision),
          window:f&&{reference:f.reference_box,image:f.image_box,window:f.window,point:f.point,examined:f.examined_windows,trial:f.trial_key,
            method:{status:f.method_receipt.status,complete:f.method_receipt.domain_complete}}},
        ret:previous&&{ticket:previous.id,owner:outcome.family,ref:outcome.observation_ref,matched:outcome.matched,seal:outcome.seal_prefix,
          reason:outcome.reason,physique:real.frames.map(hash),pixels: difference(prior.frame,shown.frame),
          official:[real.level,real.levelsCompleted],events:events.slice(start),blocked:blocked.slice(prevB)}});
      if(!ticket||i===cap)break;
      previous={id:ticket.id};prior=shown;
      board=gameStep(game,Number(ticket.actionRef.slice(6)),ticket.data);
    }
    return {rows,guards};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
export async function run(group,root){
  const game=await sourceBackend(root),earlyCase=early(game);
  if(group==='nominal')return {nominal:await play(game,'nominal',11,earlyCase),précoce:earlyCase.summary};
  assert.equal(group,'contrôles');
  return {deux:await play(game,'deux',8,earlyCase),zéro:await play(game,'zéro',8,earlyCase),
    stationnaire:await play(game,'stationnaire',9,earlyCase)};
}
