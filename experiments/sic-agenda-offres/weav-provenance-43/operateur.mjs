import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','ancienne-reference','journal-altere','journal-intact','sans-paire','sans-recu','epoque'];
const proof=s=>({pairs:s.cross_pairs,receipts:s.cross_events.filter(e=>e.kind==='crossed_prefix_state'&&e.crossing_receipt)
  .map(e=>({after:e.evidence,digest:e.crossing_receipt,comparison:e.outcome})),
  past:s.cross_events.filter(e=>e.kind==='crossed_prefix_input'),axisInputs:s.cross_axis_inputs,
  progress:s.cross_state?.progress??null});

export async function play(engine,variant,vendor){
  assert.ok(variants.includes(variant));
  const m=await import(new URL('src/logos-engine/v6-crossed-prefix-access.ts',engine));
  const {symbolicDigest}=await import(new URL('src/logos-engine/v6-hash.ts',engine));
  const {CrossedPrefixMemory,crossedPrefixBefore}=m,family=CrossedPrefixMemory.prototype;
  const cuts=new Map(),guards=new Map(),records=new Map(),propose=family.crossQuestion,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'crossQuestion',function(obs,rows,inputs,options){
    const original=this.currentState(),pairs=this.pairs;
    let provider=this;
    const alter=turn===7&&!['nominal','epoque'].includes(variant);
    const before=proof(original);
    if(alter){
      assert.equal(pairs.length,1);
      const oldStep=before.past[0],bad={...pairs[0],evidence:[oldStep.evidence,pairs[0].evidence[1]]};
      assert.equal(oldStep.axis,0);
      assert.notDeepEqual(bad.evidence,pairs[0].evidence);
      if(variant==='ancienne-reference')this.pairs=[bad];
      else if(variant==='sans-paire')this.pairs=[];
      else{
        provider=new CrossedPrefixMemory();
        for(const event of original.cross_events){
          if(variant==='sans-recu'&&event.crossing_receipt){
            const {crossing_receipt,...legacy}=event;
            provider.applyEvent(legacy);
          }else provider.applyEvent(variant==='journal-altere'&&event.kind==='crossed_prefix_pair'?bad:event);
        }
      }
    }
    try{
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,available:obs.available_action_refs,raster:digest(rows),
        before,used:proof(provider.currentState()),attestation:options?.attestCrossedPairs===true});
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
      const p=propose.call(provider,obs,rows,inputs,options);
      if(p?.crossed_prefix_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        const stale={...meta,observation_ref:obs.observation_ref+':old'};
        guards.set(obs.observation_ref,{live:crossedPrefixBefore(p,0,rows,meta),stale:crossedPrefixBefore(p,0,rows,stale)});
      }
      return p;
    }finally{if(alter)this.pairs=pairs;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args),after=args[2],pair=events.find(e=>e.kind==='crossed_prefix_pair');
    if(events.length){
      const e=events.at(-1);
      records.set(after.observation_ref,structuredClone({progress:e.state.progress,comparison:e.outcome,
        pair:pair??null,pairDigest:pair?symbolicDigest(pair):null,witness:e.crossing_receipt??null,evidence:e.evidence}));
    }
    return events;
  }));
  try{
    const limit=variant==='nominal'?16:variant==='epoque'?32:7;
    return await rejouerService({engine,vendor,gameCode:'WEAV',sessionId:'weav-provenance-43',entries:{cuts,guards,records},
      limit,maxActions:variant==='epoque'?32:16,onTurn:i=>turn=i,reprise:false,
      describe(p){
        const q=p.crossed_prefix_plan;
        return {plan:q?{cell:q.intent.cell??null,mode:q.mode,pair:q.intent.predicted_pair??null,control:q.controller.key}:null};
      }});
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide)),r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.family,JSON.stringify(s.pre.command),s.after.levels,!!s.after.record?.witness);
}
