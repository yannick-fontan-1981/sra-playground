import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { mock } from 'node:test';
import { parseArgs } from 'node:util';
import { evaluateurJeu } from '../evaluateur-jeu.mjs';
import { loadGame } from '../frontiere-22-23/game.mjs';
import { withEngine } from '../moteur-reference.mjs';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const channel = Symbol.for('sic.dico.navigation');
const navKind = 'subset_scope_navigation';
const withoutRaster = (shape) => shape ? [shape[0],shape[1],digest(shape)] : null;

export async function play(engine, variant, vendor) {
  assert.ok(['nominal','autre-commande','permutation','retrait','stationnaire'].includes(variant),'Variante DICO inconnue');
  const native = new URL('src/logos-engine/v6-subset-diagnosis.ts', engine).href;
  const captures = new Map(), returns = new Map();
  let turn = 1;
  globalThis[channel] = (obs, remaining, scene, candidates, family, offers, queryCount) => {
    const pre = structuredClone({
      ref:obs.observation_ref, epoch:obs.level_epoch, universe:scene.universe_ref, focus:scene.focus,
      candidates, remaining, queryCount, evidence:family.method_refs.slice(-8),
      attempted:[...family.questions.attempted].sort(), knownNavigationShapes:family.nav_shapes.map(withoutRaster),
      pressShapes:family.press_shapes.map(withoutRaster),
      offers:offers.map(o=>({scope:o.scope, command:o.command, shape:withoutRaster(o.shape),
        question:o.question, knownEffect:o.knownEffect})),
    });
    captures.set(obs.observation_ref, {pre, seal:digest(pre)});
  };
  const loader = registerHooks({load(url, context, next) {
    const loaded = next(url,context);
    if (url !== native) return loaded;
    const source = loaded.source.toString();
    const marker = "  let mode='query'";
    assert.equal(source.split(marker).length,2);
    const fields = source.includes('selectNavigationOffer(nav)')
      ? 'nav' : 'nav.map(([,scope,command,shape,question])=>({scope,command,shape,question,knownEffect:hasShape(this.nav_shapes,shape)}))';
    const tap = '  globalThis[Symbol.for("sic.dico.navigation")](obs,remaining,scene,candidates,this,'+fields+',offers.length);\n';
    return {...loaded,source:source.replace(marker,tap+marker)};
  }});
  const hooks = [mock.method(Date,'now',()=>1700000000000)];
  try {
    const { SubsetDiagnosis } = await import(native);
    const family = SubsetDiagnosis.prototype, record = family.record;
    hooks.push(mock.method(family,'record',function(...args){
      const r=record.apply(this,args), event=r.events?.[0];
      if(event){
        const {calculation,press_shapes,nav_shapes,...facts}=event;
        returns.set(args[1].observation_ref,structuredClone(facts));
      }
      return r;
    }));
    const select = family.selectNavigationOffer;
    if(select) hooks.push(mock.method(family,'selectNavigationOffer',function(offers){
      if(turn!==2)return select.call(this,offers);
      if(variant==='autre-commande' && offers.length>1){
        const first=select.call(this,offers);
        return select.call(this,offers.filter(o=>o!==first));
      }
      if(variant==='permutation')return select.call(this,[...offers].reverse());
      if(variant==='retrait')return null;
      return select.call(this,offers);
    }));
    let guard;
    const before=family.before;
    hooks.push(mock.method(family,'before',function(...args){
      if(turn===2 && args[0].kind===navKind)guard={family:this, args};
      return before.apply(this,args);
    }));
    const {createService,packet,defaultRecoveryPack}=await evaluateurJeu(engine);
    const service=createService(),game=await loadGame('DICO',vendor,engine),sessionId='dico-navigation';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[],staleChecks=[];
    for(let i=1;i<=4;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const {snapshot,ticket}=r;
      assert.ok(ticket,'ticket T'+i);
      const p=snapshot.proposal,plan=p.support_plan,entry=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const pre={ref:ticket.observationRef,family:snapshot.lastDecision,kind:p.kind,command:[ticket.actionRef,ticket.data??null],
        ticket:ticket.id,guard:entry?.admitted,guardReason:entry?.reason,offers:captures.get(ticket.observationRef)??null,
        subset:plan?.subset_diagnosis?{universe:plan.universe_ref,question:plan.question_key,focus:plan.focus,
          scope:plan.tested,candidates:plan.candidates,prediction:plan.navigation_prediction,refs:p.route_refs}:null};
      const actual=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);
      const shown=i===2&&variant==='stationnaire'?{...actual,frame:board.frame,frames:[board.frame]}:actual;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:ticket.id,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,match:e.matched,reason:e.reason,seal:e.seal_prefix,
        count:shown.frames.length,completed:shown.levelsCompleted,gamePacket:digest([actual.frame,actual.frames,actual.availableActionIds,
          actual.level,actual.levelsCompleted,actual.state]),shownFrame:digest(shown.frame),
        record:returns.get(e.observation_ref)??null};
      steps.push({i,pre,after});
      if(i===2 && guard && variant==='nominal'){
        const [original,index,originalView,originalObs]=guard.args;
        staleChecks.push(before.call(guard.family,original,index,
          {...originalView,frame_rows:shown.frame,frame_hash:e.observation_ref.split(':').at(-1)},originalObs));
      }
      if(i===2 && variant==='stationnaire')break;
      board=shown;
    }
    if(variant==='stationnaire'){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:2});
      const ticket=r.ticket;
      assert.ok(ticket);
      return {steps,staleChecks,nextStationary:{ref:ticket.observationRef,command:[ticket.actionRef,ticket.data],
        kind:r.snapshot.proposal.kind,offers:captures.get(ticket.observationRef),question:r.snapshot.proposal.support_plan?.question_key}};
    }
    return {steps,staleChecks};
  } finally {
    for(const hook of hooks.reverse())hook.mock.restore();
    loader.deregister();
    delete globalThis[channel];
  }
}

if(import.meta.main) {
  const {values}=parseArgs({options:{moteur:{type:'string',default:'candidat'},source:{type:'string'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const task = e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await task(values.source):await withEngine(values.moteur,task);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.kind,JSON.stringify(s.pre.command),s.after.record?.kind??'');
}
