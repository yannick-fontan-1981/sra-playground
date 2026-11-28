import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mock} from 'node:test';
import {sourceBackend} from './scripts/sic-study-source-games.mjs';
import {createNativeV6Runtime} from './src/logos-engine/v6-native-runtime.ts';
import {CodeProgram} from './src/logos-engine/v6-code-program.ts';
import {V6AgentService} from './src/runtime/v6-agent-service.ts';
import {toV6PublicObservation} from './src/runtime/v6-agent-protocol.ts';

const src=new URL('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,src)));
const declarations={common:read('laya_proto/common_frontier_policy.drm.json'),strategy:read('morphology_policy/strategy.drm')};
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('tests/fixtures/sic-tn36-public-returns.json.gz',import.meta.url))));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const effects=map=>[...map].map(([word,vector])=>[String(word),vector]);

function actor(frame,board){
  const [originX,originY]=board.origin,[width,height]=board.shape, size=board.size, result=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(board.mask.every(([u,v])=>frame[originY+y*size+v]?.[originX+x*size+u]===board.hue))result.push([x,y]);
  }
  return result.length===1?result[0]:null;
}
function tracePixels(frames,board){
  return frames.map(frame=>{
    const counts=board.columns.map(column=>{
      const [x0,y0,x1]=column[0], y1=column.at(-1)[3];
      let count=0;
      for(let y=y0-1;y<=y1+1;y++)for(let x=x0-1;x<=x1+1;x++)if(frame[y]?.[x]===board.button_hue)count++;
      return count;
    });
    const maximum=Math.max(...counts), visible=counts.map((count,i)=>count===maximum?i:-1).filter(i=>i>=0);
    return {position:actor(frame,board),colonne:maximum>0 && visible.length===1?visible[0]:null};
  });
}
function altered(name,i,obs,seed){
  if(i!==1)return {obs};
  if(name==='finale')return {obs:{...obs,frames:[obs.frame]}};
  if(name!=='permutation')return {obs};
  const frames=obs.frames.slice(), keys=frames.map(hash), candidates=[];
  for(let j=1;j<frames.length-1;j++)for(let k=j+1;k<frames.length-1;k++)if(keys[j]!==keys[k])candidates.push([j,k]);
  assert.ok(candidates.length);
  const pair=candidates[seed[0]%candidates.length], [j,k]=pair;
  [frames[j],frames[k]]=[frames[k],frames[j]];
  assert.deepEqual(frames[0],obs.frames[0]);assert.deepEqual(frames.at(-1),obs.frames.at(-1));
  return {obs:{...obs,frames},pair};
}

async function play(game,name,cap,budget,seed){
  const rows=[],events=[],preparation=new Map(),hooks=[],interventions=[];
  let turn=0;
  const C=CodeProgram.prototype;
  const wrap=(key,fn)=>{
    const original=C[key];hooks.push(mock.method(C,key,function(...args){return fn.call(this,original,args);}));
  };
  wrap('start',function(original,args){
    const result=original.apply(this,args);
    if(name==='autreExemple'&&args[0].level_epoch===2){
      assert.deepEqual([...this.demoTried],[]);assert.equal(this.effects.size,0);this.demoTried.add(0);
      interventions.push({turn,exempleRetiré:0});
    }
    return result;
  });
  wrap('propose',async function(original,args){
    const remove=name==='sansOpérateur'&&turn===2,saved=this.effects;
    if(remove){
      assert.deepEqual(effects(saved),[['3',[0,1]]]);this.effects=new Map();
      interventions.push({turn,opérateurRetiré:3});
    }
    try{
      const p=await original.apply(this,args);
      preparation.set(args[0].observation_ref,{opérateurs:effects(this.effects),essais:[...this.demoTried],preuves:this.evidence.slice()});
      return p;
    }finally{if(remove)this.effects=saved;}
  });
  wrap('record',function(original,args){
    const board=this.board, prior=effects(this.effects), e=original.apply(this,args);
    events.push({ref:e.ref,mode:e.mode,status:e.status,mesures:e.measured,préservé:e.preserved_actual_world,
      avant:prior,après:effects(this.effects),références:this.evidence.slice(),
      position:[actor(args[3],board),actor(args[4],board)],
      images:turn===2?tracePixels(args[7],board):undefined});
    return e;
  });
  try{
    const service=new V6AgentService(()=>createNativeV6Runtime(declarations,{now:()=>0}));
    const sessionId='sra-v6-'+fixture.session;
    let board=game.dispatch({type:'load',code:'TN36',level:1}),previous;
    for(let i=0;i<=cap;i++){
      turn=i+1;
      const real=toV6PublicObservation(board,i),{obs,pair}=altered(name,i,real,seed);
      if(name==='catalogue'||name==='prolongé'){
        const {palette,...obsSansPalette}=real,{palette:archivedPalette,...archived}=fixture.nominal.observations[i];
        assert.deepEqual(obsSansPalette,archived);
      }
      const start=events.length;
      let reply=await service.handle({sessionId,sequence:i,observation:obs,...(previous?
        {type:'advance',ticketId:previous.id,executionMs:0}:{type:'init',budgets:{targetLevels:6,levelActionCaps:Array(6).fill(600),maxActions:budget}})});
      const outcome=reply.snapshot.trace.findLast(e=>e.kind==='actual_outcome');
      while(reply.kind==='boundary')reply=await service.handle({type:'resume',sessionId,sequence:i});
      const {snapshot,ticket}=reply,p=snapshot.proposal,plan=p?.code_plan,s=ticket&&p.steps[ticket.actionIndex];
      const guard=snapshot.trace.findLast(e=>e.kind==='before_guard');
      rows.push({tour:turn,niveau:obs.level,progression:obs.levelsCompleted,statut:reply.kind,
        reçu:previous&&{id:previous.id,ref:outcome?.observation_ref,famille:outcome?.family,accord:outcome?.matched,
          motif:outcome?.reason,images:obs.frames.length,paquet:obs.frames.map(hash),finale:hash(obs.frame),pair,événements:events.slice(start)},
        ticket:ticket&&{id:ticket.id,ref:ticket.observationRef,famille:snapshot.lastDecision,kind:p.kind,cmd:ticket.actionRef,point:ticket.data,
          admis:guard?.admitted,mode:s?.mode,position:s?.position,acteur:plan?.actor_position,but:plan?.goal,
          code:s?.code,courant:plan?.current_codes,cible:plan?.desired_codes,prévu:s?.expected_after,
          opérateurs:plan?.locally_observed_operators,exécutions:plan?.observed_executions,exemple:s?.example,exemples:plan?.available_examples,
          preuves:p.question?.hypothesis_refs,observé:preparation.get(ticket.observationRef)}});
      if(!ticket||i===cap)break;
      if(name==='catalogue'||name==='prolongé')assert.deepEqual(ticket.data,fixture.nominal.commands[i].data);
      previous={id:ticket.id};
      board=game.dispatch({type:'action',actionId:Number(ticket.actionRef.slice(6)),data:ticket.data});
    }
    return {rows,interventions,budget};
  }finally{for(const hook of hooks.reverse())hook.mock.restore();}
}
export async function run(group,root,seed){
  const groups={nominal:[['catalogue',16,16],['prolongé',19,19]],
    contrôles:[['finale',3,16],['sansOpérateur',2,16],['autreExemple',10,19]],réserve:[['permutation',2,16]]};
  assert.ok(groups[group]);
  const game=await sourceBackend(root),clock=mock.method(Date,'now',()=>1700000000000),cases={};
  try{for(const [name,cap,budget] of groups[group])cases[name]=await play(game,name,cap,budget,seed);}
  finally{clock.mock.restore();}
  return cases;
}
