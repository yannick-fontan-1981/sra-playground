import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {evaluateurJeu} from '../evaluateur-jeu.mjs';
import {loadGame} from '../frontiere-22-23/game.mjs';
import {withEngine} from '../moteur-reference.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const point=k=>k.split(',').map(Number);
const variants=['nominal','une-fenetre','sans-adresse','stationnaire','un-seul-effet'];
const plainField=f=>({size:f.size,pitch:f.pitch,groups:f.groups.map(g=>[...g].filter(([,tile])=>tile.glyph)
  .map(([origin,tile])=>({origin:point(origin),shape:tile.shape,glyph:tile.glyph})))});
const cRecord=([k,c])=>({point:point(k),value:c.actual,equal:[...c.eq],different:[...c.ne],sources:[...c.sources].map(point)});
const plainState=s=>({epoch:s.epoch,rule:s.rule,fit:s.provenance,rejected:s.rejected,effects:s.effects,prior:s.prior,
  cached:s.cachedScene,first:s.first});

export async function play(engine,variant,vendor,removedPoint){
  assert.ok(variants.includes(variant));
  const moduleURL=new URL('src/logos-engine/v6-field-constraints.ts',engine).href;
  const key=Symbol.for('sic.ft09.94.sources'),sources=new Map(),cuts=new Map(),results=new Map(),guards=new Map();
  let turn=1;
  globalThis[key]=(owner,obs,fields)=>{
    if(owner.familyId!=='window_constraints')return fields;
    const used=turn===1&&variant==='une-fenetre'?fields.map(f=>{
      const [kept]=f.groups.flatMap(g=>[...g].filter(([,s])=>s.glyph).map(([k])=>k)).sort();
      return {...f,groups:f.groups.map(g=>new Map([...g].filter(([k,t])=>!t.glyph||k===kept)))};
    }):fields;
    sources.set(obs.observation_ref,structuredClone({before:fields.map(plainField),used:used.map(plainField)}));
    return used;
  };
  const loader=registerHooks({load(url,c,next){
    const loaded=next(url,c);
    if(url!==moduleURL)return loaded;
    const source=loaded.source.toString(),marker='const fields = extractFields(obs, rows);';
    assert.equal(source.split(marker).length,2);
    return {...loaded,source:source.replace(marker,'const fields = globalThis[Symbol.for("sic.ft09.94.sources")](this,obs,extractFields(obs,rows));')};
  }});
  const {WindowConstraints,acceptsConstraint}=await import(moduleURL);
  const family=WindowConstraints.prototype,fit=family.fit,propose=family.propose,record=family.record,before=family.before;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  hooks.push(mock.method(family,'fit',function(obs,rows){
    const r=fit.call(this,obs,rows);
    if(this.familyId==='window_constraints'){
      const out=r&&{field:plainField(r[0]),constraints:r[1].size,violations:[...r[1]].filter(([,c])=>!acceptsConstraint(c,c.actual)).map(cRecord)};
      cuts.set(obs.observation_ref,{obs:obs.observation_ref,fields:sources.get(obs.observation_ref),out,retained:plainState(this.state())});
    }
    return r;
  }));
  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,remaining){
    if(this.familyId!=='window_constraints')return propose.call(this,obs,rows,inputs,remaining);
    const originalEffects=this.effects;
    if(turn===3&&variant==='un-seul-effet'){
      const acquired=originalEffects.get(9);
      assert.equal(acquired.length,2);
      this.effects=new Map(originalEffects);
      this.effects.set(9,acquired.slice(0,1));
    }
    const native=this.state(),removed=turn===1&&variant==='sans-adresse'?inputs.filter(a=>a.data?.x===removedPoint[0]&&a.data?.y===removedPoint[1]):[];
    if(turn===1&&variant==='sans-adresse')assert.equal(removed.length,1);
    const filtered=inputs.filter(a=>!removed.includes(a));
    try{
      const r=await propose.call(this,obs,rows,filtered,remaining);
      const raw=cuts.get(obs.observation_ref)??null;
      if(raw){
        const pre=structuredClone({...raw,minimized:plainState(native),remaining,removed,
          addressed:filtered.filter(a=>Object.hasOwn(a.data,'x')).map(a=>[a.data.x,a.data.y])});
        cuts.set(obs.observation_ref,{pre,seal:digest(pre),offered:r?.constraint_plan?.selected_cells??null});
      }
      return r;
    }finally{
      if(turn===3&&variant==='un-seul-effet')this.effects=originalEffects;
    }
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const result=record.apply(this,args);
    if(this.familyId==='window_constraints')
      results.set(args[1].observation_ref,structuredClone({result,memory:plainState(this.state())}));
    return result;
  }));
  hooks.push(mock.method(family,'before',async function(proposal,index,obs,rows){
    const live=await before.call(this,proposal,index,obs,rows);
    if(this.familyId==='window_constraints'&&index===0&&live.admitted){
      const old=await before.call(this,proposal,index,{...obs,observation_ref:obs.observation_ref+':stale'},rows);
      guards.set(obs.observation_ref,{live,old,payload:proposal.steps[index].point_binding?.point??null});
    }
    return live;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService();
    const game=await loadGame('FT09',vendor,engine),sessionId='ft09-94';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!r.ticket)return null;
      const {snapshot,ticket}=r,p=snapshot.proposal,plan=p.constraint_plan,ref=ticket.observationRef,step=p.steps[ticket.actionIndex];
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      return structuredClone({ref,ticket:ticket.id,family:release?.family??snapshot.lastDecision,entry:p.field_subquestion??null,
        kind:p.kind,index:ticket.actionIndex,command:[ticket.actionRef,ticket.data??{}],level:board.level,bundle:p.bundle_template?.operation_key,
        guard:{admitted:g?.admitted,reason:g?.reason},scope:guards.get(ref)??null,refs:p.route_refs,cut:cuts.get(ref)??null,
        plan:plan&&{...plan,selected:step.constraint,prediction:step.expected_after,point:step.point_binding?.point??null}});
    };
    const limit=variant==='nominal'?16:variant==='un-seul-effet'?4:3;
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=variant==='stationnaire'&&i===1;
      const shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),presented:digest(shown.frame),record:results.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replace){
        while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,stop:r.reason??null,next:issued()};
  }finally{
    for(const h of hooks.reverse())h.mock.restore();
    loader.deregister();
    delete globalThis[key];
  }
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},point:{type:'string'},recu:{type:'string'}}});
  const locus=values.point?point(values.point):null;
  if(values.variante==='sans-adresse')assert.ok(locus?.length===2&&locus.every(v=>Number.isInteger(v)&&v>=0&&v<=63));
  const run=e=>play(e,values.variante,resolve(values.pyodide),locus),r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
