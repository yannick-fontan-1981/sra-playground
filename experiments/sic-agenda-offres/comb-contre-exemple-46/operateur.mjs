import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const limits={nominal:16,'capture-n1':1,'capture-n2':5,'capture-exacte':9,'contradiction-n1':3,'contradiction-n2':9,
  locale:10,'locale-contredite':9,ancienne:9,etrangere:4};
const applies={'contradiction-n1':3,'contradiction-n2':9,locale:9,'locale-contredite':9,ancienne:9,etrangere:4};
const view=s=>s&&{epoch:s.epoch,geometry:s.geometry_ref,visited:s.visited,edges:s.edges,counterexamples:s.counterexamples,
  evidence:s.evidence,local:s.local_replays??[],boundary:s.boundary_witness??null};

export async function play(engine,variant,vendor,seed){
  assert.ok(Object.hasOwn(limits,variant));
  assert.ok(!Object.hasOwn(applies,variant)||seed);
  const prefix='src/logos-engine/v6-product-panel-';
  const {ProductPanelMemory,productPanelBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measureProductPanel}=await import(new URL(prefix+'observation.ts',engine));
  const family=ProductPanelMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeProduct,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'proposeProduct',function(obs,rows,inputs,limit,config,deadline,now,base,native){
    const prior=this.productState,scene=measureProductPanel(rows);
    const apply=turn===applies[variant];
    if(apply){
      const s=variant==='contradiction-n1'||variant==='etrangere'?seed.n1:variant==='locale-contredite'?seed.exact:seed.n2;
      const legacy=variant==='ancienne',direct=['locale','locale-contredite','ancienne'].includes(variant);
      const [counterexample]=s.counterexamples;
      assert.deepEqual([prior.epoch,prior.geometry_ref],[s.epoch,s.geometry]);
      assert.deepEqual(prior.counterexamples,[]);
      const {before,after,...legacyWitness}=counterexample;
      assert.ok(before&&after);
      const fixtureEdge=direct?[seed.local]:[];
      this.productState={...prior,counterexamples:[legacy?legacyWitness:counterexample],
        edges:[...prior.edges,...fixtureEdge],evidence:[...new Set([...prior.evidence,...counterexample.evidence,
          ...fixtureEdge.flatMap(a=>a.evidence)])]};
    }
    try{
      const current=this.productState,matching=current?.epoch===obs.level_epoch&&current.geometry_ref===scene?.geometry_ref;
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,hash:digest(rows),available:obs.available_action_refs,
        geometry:scene?.geometry_ref??null,values:scene?.current??null,prior:view(prior),used:matching?view(current):null,
        configured:native?.honorCounterexamples===true});
      const cut={pre,seal:digest(pre)};
      cuts.set(obs.observation_ref,cut);
      const p=propose.call(this,obs,rows,inputs,limit,config,deadline,now,base,native);
      cut.result=p?{status:p.status,reason:p.reason??null}:null;
      if(p?.product_panel_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        guards.set(obs.observation_ref,{live:productPanelBefore(p,0,rows,meta),
          stale:productPanelBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'})});
      }
      return p;
    }finally{
      if(apply&&variant!=='locale')this.productState=prior;
    }
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args),photo=events[0];
    if(photo)records.set(args[2].observation_ref,structuredClone(view(photo.state)));
    return events;
  }));
  try{
    return await rejouerService({engine,vendor,gameCode:'COMB',sessionId:'comb-conflit-46',entries:{cuts,records,guards},
      limit:limits[variant],onTurn:i=>turn=i,
      describe(p,index){
        const plan=p.product_panel_plan;
        return {plan:plan?{local:plan.local_replay??null,compiled:plan.estimate?.indices??null,commands:plan.commands,
          factor:p.steps[index].factor,relation:p.steps[index].relation_observed,input:p.steps[index].before_values,
          projected:p.steps[index].after_values}:null};
      },
      present({board,actual,pre,i}){
        if(!Object.hasOwn({'capture-n1':1,'capture-n2':5,'capture-exacte':9},variant)||i!==limits[variant])return actual;
        const scene=measureProductPanel(board.frame),another=scene.controls.find((_,factor)=>factor!==pre.plan.factor);
        assert.equal(actual.level,board.level);
        const [x,y]=another.point,changed=actual.frame.map(row=>[...row]);
        const old=changed[y][x],value=another.values.find(v=>v!==old),[l,t,r,b]=another.bbox;
        for(let py=t+1;py<b;py++)for(let px=l+1;px<r;px++)if(changed[py][px]===old)changed[py][px]=value;
        return {...actual,frame:changed,frames:[changed]};
      }});
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},amorce:{type:'string'},recu:{type:'string'}}});
  const seed=values.amorce?JSON.parse(await readFile(values.amorce,'utf8')):null;
  const run=e=>play(e,values.variante,resolve(values.pyodide),seed);
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.family,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
}
