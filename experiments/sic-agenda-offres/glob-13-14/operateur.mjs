import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mock } from 'node:test';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { withEngine } from '../moteur-reference.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function shift(board,dy) {
  if(!dy) return board;
  function move(rows) {
    const bg=rows[0][0], edge=dy===1?rows.at(-1):rows[0];
    assert.ok(edge.every(v=>v===bg),'Le déplacement supprimerait un pixel observable.');
    const blank=Array(rows[0].length).fill(bg);
    return dy===1?[blank,...rows.slice(0,-1)]:[...rows.slice(1),blank];
  }
  return {...board,frame:move(board.frame),frames:board.frames.map(move)};
}
export async function readCard(path) {
  const c=JSON.parse(await readFile(path,'utf8'));
  if(c?.version!=='sic.glob/1'||Object.keys(c).some(k=>!['version','gestes','dy','intervention','permuterCible','commandes'].includes(k))||
     !Number.isInteger(c.gestes)||c.gestes<1||c.gestes>16||![-1,0,1].includes(c.dy)) throw Error('Fiche GLOB invalide');
  if(c.intervention!==undefined && (!c.intervention||Object.keys(c.intervention).sort().join(',')!=='geste,type'||
     !Number.isInteger(c.intervention.geste)||c.intervention.geste<1||c.intervention.geste>c.gestes||
     !['reference_etrangere','retrait_inertie','image_finale','placement_absent','retirer_dependance','retirer_acces'].includes(c.intervention.type))) throw Error('Intervention inconnue.');
  const edit=c.permuterCible;
  if(c.commandes!==undefined && (!Array.isArray(c.commandes)||c.commandes.length!==2||c.commandes[0]===c.commandes[1]||
    c.commandes.some(id=>!Number.isInteger(id)||id<1||id>5))) throw Error('Permutation des commandes sans point invalide.');
  if(edit!==undefined && (!edit||Object.keys(edit).sort().join(',')!=='apres,noeuds'||!Number.isInteger(edit.apres)||
    edit.apres<1||edit.apres>=c.gestes||!Array.isArray(edit.noeuds)||edit.noeuds.length!==2||edit.noeuds[0]===edit.noeuds[1]||
    edit.noeuds.some(i=>!Number.isInteger(i)||i<0))) throw Error('Permutation de cible invalide.');
  return c;
}
export async function play(engine,card,vendor) {
  let turn=1;
  const intervention=()=>card.intervention?.geste===turn?card.intervention.type:null;
  const decisions=new Map(),answers=new Map(),domains=new Map(),steps=[];
  const url=new URL('src/logos-engine/v6-fixed-origin.ts',engine).href, slot=Symbol.for('sic.glob.offres');
  globalThis[slot]=(ref,data)=>domains.set(ref,structuredClone(data));
  const loader=registerHooks({load(path,context,next){
    const source=next(path,context);
    if(path!==url) return source;
    const code=source.source.toString(),anchor='if(!offers.length)return null;offers.sort';
    assert.equal(code.split(anchor).length,2);
    const capture="globalThis[Symbol.for('sic.glob.offres')](obs.observation_ref,{target,eligible:offers.map(o=>({origin:o[0],command:o[1],question:o[2]})),safe:[...safe],domain:domains.map(o=>o[0]),models:models.length});";
    return {...source,source:code.replace(anchor,capture+anchor)};
  }});
  const {FixedOrigin,measureFixedScene,fixedProgramSamples,fixedFill}=await import(url);
  const propose=FixedOrigin.prototype.propose,record=FixedOrigin.prototype.record,access=FixedOrigin.prototype.originOffer;
  const dependency=FixedOrigin.prototype.dependencyOffer;
  const dh=dependency && mock.method(FixedOrigin.prototype,'dependencyOffer',function(...args) {
    if(intervention()==='retirer_dependance') return null;
    return dependency.apply(this,args);
  });
  const ah=mock.method(FixedOrigin.prototype,'originOffer',async function(...args) {
    if(intervention()==='retirer_acces') return null;
    return access.apply(this,args);
  });
  const ph=mock.method(FixedOrigin.prototype,'propose',async function(obs,rows,inputs,remaining) {
    const pending=this.pending,inert=this.inert;
    if(intervention()==='reference_etrangere'&&pending) this.pending={...pending,ref:pending.ref+'-etranger'};
    if(intervention()==='retrait_inertie') this.inert=new Set();
    try{
      const scene=measureFixedScene(rows);
      const pre={ref:obs.observation_ref,frame:obs.frame_hash,remaining,scene:scene&&{nodes:scene.nodes,word:scene.word},
        pending:this.pending&&{ref:this.pending.ref,frame:this.pending.frame,node:this.pending.node,placement:this.pending.placement,evidence:this.pending.evidence},
        inert:[...this.inert],attempted:[...this.questions.attempted],executions:this.executions.map(x=>({before:x.before,after:x.after,samples:fixedProgramSamples(x)}))};
      const p=await propose.call(this,obs,rows,inputs,remaining);
      decisions.set(obs.observation_ref,{pre,seal:digest(pre),offer:p?.kind??null,origins:domains.get(obs.observation_ref)??null});
      return p;
    } finally{this.pending=pending;this.inert=inert;}
  });
  const rh=mock.method(FixedOrigin.prototype,'record',function(...args){
    const r=record.apply(this,args);
    answers.set(args[1].observation_ref,{status:r.status,events:r.events.map(e=>e.kind==='fixed_program_public_execution'?
      {kind:e.kind,before:e.before,after:e.after,command:e.command,samples:fixedProgramSamples(e),frames:e.trace.length,
        transitions:e.trace.filter((v,i)=>i===0||v.active!==e.trace[i-1].active||v.node!==e.trace[i-1].node)}:e)});
    return r;
  });
  const clock=mock.method(Date,'now',()=>1700000000000);
  try{
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine);
    const service=createService(),game=await loadGame('GLOB',vendor,engine),sessionId='glob-qualification';
    const [a,b]=card.commandes??[];
    const renamed=id=>id===a?b:id===b?a:id;
    const present=value=>({...shift(value,card.dy),availableActionIds:value.availableActionIds.map(renamed)});
    let board=present(game.initial);
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    for(let i=1;i<=card.gestes;i++){
      while(r.kind==='boundary') r=await service.handle({type:'resume',sessionId,sequence:i-1});
      if(!r.ticket)return {steps,stop:r.reason??r.kind};
      const {snapshot,ticket}=r,p=snapshot.proposal,plan=p.support_plan,index=ticket.actionIndex;
      const g=snapshot.trace.findLast(x=>x.kind==='before_guard'),ref=ticket.observationRef;
      const selection=decisions.get(ref)??null;
      const pre={ref,level:board.level,family:snapshot.lastDecision,kind:p.kind,selected:selection,guard:g?.admitted,
        ticket:ticket.id,index,cmd:ticket.actionRef,data:ticket.data??{},question:plan?.question_key,origin:plan?.origin,target:plan?.target,
        trace:plan?.expected_instruction_nodes,models:plan?.current_port_models,solver:plan?.v5_status,expected:p.steps?.[index]?.expected_after,
        facts:p.facts,refs:p.route_refs,plan:p.actions};
      const act=intervention(),point=ticket.actionRef==='ACTION6'?{...ticket.data,y:ticket.data.y-card.dy}:ticket.data;
      const next=present(await game.step(renamed(Number(ticket.actionRef.slice(6))),point));
      const rawFrames=next.frames.length;
      if(card.permuterCible?.apres===i) {
        const layout=measureFixedScene(next.frame),boxes=card.permuterCible.noeuds.map(n=>layout?.nodes[n]);
        if(boxes.some(b=>!b)) throw Error('Nœud absent du plateau public.');
        const fills=boxes.map(b=>fixedFill(next.frame,b));
        if(fills.includes(null)||fills[0]===fills[1]||!fills.includes(layout.common_fill)) throw Error('Permutation non discriminante.');
        const changed=next.frame.map(row=>[...row]);
        boxes.forEach(([l,t,r,b],n)=>{for(let y=t;y<=b;y++) for(let x=l;x<=r;x++) changed[y][x]=fills[1-n];});
        assert.deepEqual(next.frames.at(-1),next.frame);
        next.frames=[...next.frames.slice(0,-1),changed]; next.frame=changed;
      }
      if(act==='image_finale') next.frames=[next.frame];
      if(act==='placement_absent'){next.frame=board.frame;next.frames=[board.frame];}
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(next,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      steps.push({i,pre,after:{ref:e?.observation_ref,matched:e?.matched,seal:e?.seal_prefix,reason:e?.reason,
        completed:next.levelsCompleted,rawFrames,shownFrames:next.frames.length,record:answers.get(e?.observation_ref)??null}});
      board=next;
    }
    return {steps,stop:'lecture'};
  } finally {clock.mock.restore();rh.mock.restore();ph.mock.restore();ah.mock.restore();dh?.mock.restore();loader.deregister();delete globalThis[slot];}
}
if(import.meta.main) {
  const {values}=parseArgs({options:{pyodide:{type:'string'},fiche:{type:'string'},moteur:{type:'string',default:'candidat'},recu:{type:'string'}}});
  const c=await readCard(values.fiche);
  const r=await withEngine(values.moteur,e=>play(e,c,resolve(values.pyodide)));
  if(values.recu) await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  console.log(r.steps.map(s=>[s.i,s.pre.level,s.pre.family,s.pre.kind,s.pre.cmd,JSON.stringify(s.pre.data),s.after.reason].join(' ')).join('\n'));
}
