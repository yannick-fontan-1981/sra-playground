import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const body=b=>({box:b.bbox,color:b.value,target:b.target,relation:b.relation_kind,pockets:b.pocket_count,
  areas:b.evidence?.pocket_areas,scope:b.evidence?.scope,ref:b.evidence?.evidence_ref,pixels:b.cells.length});
const offer=o=>({key:o.key,mode:o.mode,point:o.point,site:o.site.bbox,body:body(o.body),facts:o.facts,method:o.method_revalidation});
const partition=m=>m&&{field:m.field,legend:m.legend,separator:m.separator,mapping:m.mapping,active:m.active,
  wells:m.wells.map(w=>({box:w.bbox,color:w.value})),bodies:m.bodies.map(body),evidence:m.evidence};
const state=s=>({epoch:s.epoch,selection:s.selection,writes:s.writes.map(w=>({refs:w.evidence,seed:w.seed,
  count:w.changed_mask.length,pigment:w.pigment,only:w.only_target_pigment,within:w.same_component_scope,outside:w.outside_count,
  binding:w.partition_binding})),attempts:s.attempts,portable:s.portable.map(p=>({epoch:p.source_epoch,
  selection:p.selection.map(v=>v.evidence),writes:p.writes.map(v=>v.evidence)}))});

export async function play(engine,variant,vendor){
  const {TopologicalRecolor}=await import(new URL('src/logos-engine/v6-topological-recolor.ts',engine));
  const {measure}=await import(new URL('src/logos-engine/v6-topological-recolor-geometry.ts',engine));
  const family=TopologicalRecolor.prototype, propose=family.proposeSource, offers=family.offers, record=family.recordSource;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let current=null,owner=null,change=null;
  hooks.push(mock.method(family,'offers',function(obs,rows){
    const result=offers.call(this,obs,rows),[available,m]=result;
    if(!current||current!==obs.observation_ref)return result;
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),actions:obs.available_action_refs,
      measurement:partition(m),offers:available.map(offer),state:state(this.state())};
    cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    return result;
  }));
  hooks.push(mock.method(family,'proposeSource',async function(obs,rows,inputs,remaining){
    const memory=this.state();
    current=obs.observation_ref;owner=this;
    let p;
    try{p=await propose.call(this,obs,rows,inputs,remaining);}
    finally{current=null;}
    if(p){
      const wrapper={frame_rows:rows,available_action_refs:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:this.before(p,0,wrapper,obs),stale:this.before(p,0,wrapper,
        {...obs,observation_ref:obs.observation_ref+':old'})});
    }else if(!cuts.has(obs.observation_ref)){
      const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),actions:obs.available_action_refs,
        measurement:null,offers:[],state:state(memory)};
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    }
    return p;
  }));
  hooks.push(mock.method(family,'recordSource',function(b,a,command,first,second,p,i){
    const result=record.call(this,b,a,command,first,second,p,i);
    if(p?.recolor_plan)records.set(a.observation_ref,{result,state:state(this.state())});
    return result;
  }));
  function openPocket(actual){
    const obs={observation_ref:"constructed:pocket-contrast",level_epoch:1},original=measure(actual.frame,obs,owner?.writes??[]);
    assert.ok(original);
    const key=([x,y])=>x+','+y,steps=[[0,-1],[1,0],[0,1],[-1,0]];
    for(const b of original.bodies){
      if(b.target===b.value||b.relation_kind!=='shell'||!b.pocket_count)continue;
      const shell=new Set(b.cells.map(key)),holes=new Set(b.evidence.pocket_masks.flat().map(([y,x])=>key([x,y])));
      for(const [x,y] of b.cells){
        const across=steps.map(([dx,dy])=>[x+dx,y+dy]);
        const outside=across.find(a=>!shell.has(key(a))&&!holes.has(key(a))&&actual.frame[a[1]]?.[a[0]]!==undefined);
        if(!outside||!across.some(a=>holes.has(key(a))))continue;
        const next=structuredClone(actual.frame);
        next[y][x]=actual.frame[outside[1]][outside[0]];
        if(next[y][x]===b.value)continue;
        const m=measure(next,obs,owner?.writes??[]);
        if(!m||digest(m.mapping)!==digest(original.mapping)||digest(m.field)!==digest(original.field)||m.active!==original.active)continue;
        const matched=m.bodies.find(v=>v.value===b.value&&digest(v.bbox)===digest(b.bbox));
        if(!matched||matched.pocket_count>=b.pocket_count||matched.target===b.target)continue;
        change={point:[x,y],before:b.value,after:next[y][x],region:b.bbox,old:body(b),new:body(matched)};
        return next;
      }
    }
    throw new Error('Pas de lien poche–extérieur modifiable sur le retour public');
  }

  try{
    const result=await rejouerService({engine,vendor,gameCode:'HOLE',sessionId:'hole-74',
      limit:variant==='nominal'?16:variant==='poche-ouverte'?7:6,reprise:true,entries:{cuts,records,guards},
      describe(p){
        const plan=p.recolor_plan;
        return {plan:plan?{offer:offer(plan.offer),choice:plan.choice,workflow:plan.workflow,
          hypothesis:p.compositions[0].properties,slot:p.material_access_subquestion}:null};
      },
      present({board,actual,i}){
        if(variant==='poche-ouverte'&&i>=5){
          const next=i===5?openPocket(actual):structuredClone(actual.frame);
          const [x,y]=change.point;
          if(i>5)next[y][x]=change.after;
          return {...actual,frame:next,frames:[next]};
        }
        if(i!==6||variant==='nominal')return actual;
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        const next=structuredClone(actual.frame),[x,y]=[0,0];
        assert.equal(actual.frame[y][x],board.frame[y][x]);
        next[y][x]=(actual.frame[y][x]+1)%16;
        change={point:[x,y],before:actual.frame[y][x],after:next[y][x]};
        return {...actual,frame:next,frames:[next]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','poche-ouverte','stationnaire','exterieur'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.offer.mode??s.pre.family,JSON.stringify(s.pre.command),s.after.record?.result?.status,s.after.levels);
  console.log('suite',r.next?.command,r.next?.plan?.offer.mode,r.stop,r.change);
}
