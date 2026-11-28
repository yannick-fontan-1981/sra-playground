import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const state=s=>({epoch:s.epoch,rejected:s.rejected,count:s.transition_count,
  contrasts:s.interface_state.contrasts.map(v=>({kind:v.kind,point:v.point,evidence:v.evidence,facts:v.facts,
    transform:v.transform_pairs??null})),methods:s.interface_state.methods.map(v=>({id:v.id,evidence:v.evidence})),
  refutations:s.interface_state.refutations});
const action=c=>[c.action_ref,c.data??{}];
const same=(a,b)=>digest(a)===digest(b);

export async function play(engine,variant,vendor,target){
  const {SymbolTransactions}=await import(new URL('src/logos-engine/v6-symbol-transactions.ts',engine));
  const {frame,measureDiagramTransition,perimeterEntities}=await import(new URL('src/logos-engine/v6-symbol-transactions-geometry.ts',engine));
  const {scene}=await import(new URL('src/logos-engine/v6-symbol-interface.ts',engine));
  const {geometricComponents}=await import(new URL('src/logos-engine/v6-native-observer.ts',engine));
  const family=SymbolTransactions.prototype,select=family.select,propose=family.proposeSource,record=family.recordSource;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let owner=null,active=null,change=null;
  hooks.push(mock.method(family,'select',function(measurement){
    const context=active;
    if(context){
      const {obs,rows}=context;
      const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),state:state(this.state()),
        scene:scene(rows,this.config),mode:measurement.mode??'guide',context:measurement.context,
        options:measurement.options.map(o=>({command:action(o.action),facts:o.facts,entities:o.entities.map(e=>e.bbox),
          point:{box:o.point_entity.bbox,palette:o.point_entity.palette_value},interface:o.interface_offer??null}))};
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    }
    return select.call(this,measurement);
  }));
  hooks.push(mock.method(family,'proposeSource',async function(obs,rows,inputs,limit){
    owner=this;active={obs,rows};
    let p;
    try{p=await propose.call(this,obs,rows,inputs,limit);}
    finally{active=null;}
    if(!cuts.has(obs.observation_ref)){
      const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),state:state(this.state()),
        scene:scene(rows,this.config),mode:null,options:[]};
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
    }
    cuts.get(obs.observation_ref).local=p?{command:p.actions[0],kind:p.kind}:null;
    if(p){
      const packet={frame_rows:rows,frame_hash:obs.frame_hash,level:obs.level_epoch,available_action_refs:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:this.before(p,0,packet,obs),stale:this.before(p,0,packet,
        {...obs,observation_ref:obs.observation_ref+':old'})});
    }
    return p;
  }));
  hooks.push(mock.method(family,'recordSource',function(b,a,cmd,first,second,p,i){
    const event=record.call(this,b,a,cmd,first,second,p,i);
    if(event){
      const old=scene(first,this.config),next=b.level_epoch===a.level_epoch?scene(second,this.config):null;
      records.set(a.observation_ref,{event,state:state(this.state()),old:{tight:old.tight,pairs:old.pairs,diagrams:old.diagrams},
        next:next&&{tight:next.tight,pairs:next.pairs,glyphs:next.glyphs}});
    }
    return event;
  }));
  function removeBorder(rows){
    const parts=geometricComponents(rows),entities=parts.map(p=>({...p,palette_value:p.color}));
    const guides=perimeterEntities({entities},0).filter(({bbox:[l,t,r,b]})=>l<4&&4<r&&t<11&&11<b);
    assert.equal(guides.length,1);
    const [l,t,r,b]=guides[0].bbox,x=Math.floor((l+r)/2),old=rows[t][x],to=rows[t-1][x];
    assert.equal(old,0);
    assert.notEqual(old,to);
    const next=structuredClone(rows);
    next[t][x]=to;
    change={box:[l,t,r,b],point:[x,t],from:old,to,center:[4,11],centerValue:rows[11][4]};
    return next;
  }
  function changeOutput(old,actual){
    const a=scene(old,owner.config),b=scene(actual,owner.config),base=measureDiagramTransition(frame(old),frame(actual));
    assert.equal(base,1);
    for(const g of b.glyphs){
      if(!g.solid||a.glyphs.some(k=>same(k,g)))continue;
      const [l,t,r,d]=g.box,to=Array.from({length:16},(_,i)=>i)
        .find(v=>v!==g.value&&!a.diagrams.some(row=>row.right.includes(v)));
      const next=structuredClone(actual);
      for(let y=t;y<=d;y++)for(let x=l;x<=r;x++)next[y][x]=to;
      if(measureDiagramTransition(frame(old),frame(next))!==0)continue;
      const measured=scene(next,owner.config);
      if(!same(measured.pairs,b.pairs)||!same(measured.diagrams,b.diagrams))continue;
      change={box:g.box,point:g.point,extent:g.size,from:g.value,to};
      return next;
    }
    throw new Error('Aucun produit unique à substituer avec les opérandes préservés');
  }
  try{
    const r=await rejouerService({engine,vendor,gameCode:'CRAF',sessionId:'craf-73',
      limit:variant==='nominal'?16:variant==='sans-guide'?0:variant==='stationnaire'?1:Math.max(target,9),
      reprise:true,entries:{cuts,records,guards},
      initial(board){
        if(variant!=='sans-guide')return board;
        const raster=removeBorder(board.frame);
        return {...board,frame:raster,frames:[raster]};
      },
      describe(p){
        const q=p.symbol_transaction_plan;
        return {plan:q?{mode:q.mode,facts:q.measured_facts,conclusions:q.conclusions,rules:q.rule_refs,
          interface:q.interface_offer,unknown:q.effect_status,point:p.steps[0].point_binding.bbox,
          slot:p.material_access_subquestion}:null};
      },
      present({board,actual,i}){
        if(variant==='stationnaire'&&i===1)return {...board,frames:[board.frame]};
        if(variant!=='produit-substitue'||i!==target)return actual;
        const raster=changeOutput(board.frame,actual.frame);
        return {...actual,frame:raster,frames:[raster]};
      }});
    return {...r,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}
if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string',default:'5'},recu:{type:'string'}}});
  assert.ok(['nominal','sans-guide','stationnaire','produit-substitue'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps){
    const e=s.after.record?.event;
    console.log(s.i,s.pre.level,s.pre.plan?.mode??s.pre.family,JSON.stringify(s.pre.command),e?.status,e?.changed_pixels,
      e?.diagram_operand_removal_result_appearance_matches,e?.interface_event?.kinds,s.after.levels);
  }
  console.log('suite',r.next?.command,r.next?.family,r.cuts.at(-1)?.local,r.stop,r.change);
}
