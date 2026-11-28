import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','catalogue-incomplet','sans-arete','stationnaire','multifactoriel','petite-reserve'];
const sceneView=s=>s&&{ref:s.geometry_ref,geometry:s.geometry,controls:s.controls.map(c=>({point:c.point,values:c.values})),
  current:s.current,catalogue:s.catalogue};
const estimateView=e=>e&&{indices:e.indices,factors:e.factors,status:e.receipt.status,complete:e.receipt.domain_complete,
  examined:e.receipt.examined_count,releases:e.receipt.descriptive_facts.primitive_release_authorized,
  assumptions:e.receipt.scope.assumption_refs,trace:e.trace};
const stateView=s=>s&&{epoch:s.epoch,geometry:s.geometry_ref,visited:s.visited,edges:s.edges,evidence:s.evidence,
  counterexamples:s.counterexamples,boundary:s.boundary_witness??null};

function duplicateEntry(rows,scene){
  assert.ok(scene);
  const target=scene.entries[0],other=scene.entries.find(r=>r.values.filter((value,i)=>value!==target.values[i]).length===1);
  assert.ok(other);
  const factor=target.values.findIndex((value,i)=>value!==other.values[i]),[dx,dy]=scene.geometry.offsets[factor];
  const x=target.bbox[0]+dx,y=target.bbox[1]+dy;
  const changed=rows.map(row=>[...row]);
  changed[y][x]=other.values[factor];
  return {changed,contrast:{factor,point:[x,y],before:target.values,after:other.values}};
}

export async function play(engine,variant,vendor,targetTurn){
  assert.ok(variants.includes(variant));
  const scoped=['sans-arete','petite-reserve'].includes(variant);
  assert.ok(!scoped||Number.isInteger(targetTurn)&&targetTurn>1);
  const prefix='src/logos-engine/v6-product-panel-';
  const {ProductPanelMemory,productPanelBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measureProductPanel}=await import(new URL(prefix+'observation.ts',engine));
  const family=ProductPanelMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeProduct,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,opening=null;
  hooks.push(mock.method(family,'proposeProduct',function(obs,rows,inputs,limit,config,deadline,now,base){
    const raw=measureProductPanel(rows),old=this.productState;
    const mutation=turn===1&&variant==='catalogue-incomplet'?duplicateEntry(rows,raw):null,
      used=mutation?.changed??rows,adjusted=turn===targetTurn&&variant==='sans-arete',
      available=turn===targetTurn&&variant==='petite-reserve'?{...config,remaining_level_actions:1}:config;
    if(variant==='nominal'||variant==='multifactoriel')opening??=raw;
    let withheld=null;
    if(adjusted){
      assert.ok(old?.edges.length>=2);
      withheld=old.edges.at(-1);
      assert.equal(old.edges.filter(e=>e.factor===withheld.factor).length,1);
      this.productState={...old,edges:old.edges.slice(0,-1)};
    }
    try{
      const measured=mutation?measureProductPanel(used):raw;
      const state=this.productState?.epoch===obs.level_epoch&&this.productState?.geometry_ref===measured?.geometry_ref?this.productState:null;
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),actions:obs.available_action_refs,
        maxPrefix:limit,remaining:config.remaining_level_actions,available:available.remaining_level_actions,
        original:sceneView(raw),scene:sceneView(measured),
        contrast:mutation?.contrast??null,retained:stateView(old),used:stateView(state),withheld,
        unknown:measured?.controls.map((_,i)=>i).filter(i=>!state?.edges.some(e=>e.factor===i))??null});
      const cut={pre,seal:digest(pre)};
      cuts.set(obs.observation_ref,cut);
      const p=propose.call(this,obs,used,inputs,limit,available,deadline,now,base);
      cut.result=p?{status:p.status,reason:p.reason??null}:null;
      if(p?.product_panel_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        const step=p.steps[0],control=p.product_panel_plan.scene.controls[step.factor],[x,y]=control.point;
        const wrong=rows.map(row=>[...row]);
        wrong[y][x]=control.values.find(v=>v!==control.current);
        guards.set(obs.observation_ref,{live:productPanelBefore(p,0,rows,meta),
          stale:productPanelBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'}),
          wrongValues:productPanelBefore(p,0,wrong,meta)});
      }
      return p;
    }finally{if(adjusted)this.productState=old;}
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,index){
    const events=record.call(this,b,cmd,a,rows,later,p,index);
    if(events.length)records.set(a.observation_ref,structuredClone({before:measureProductPanel(rows)?.current??null,
      after:measureProductPanel(later)?.current??null,own:!!p?.product_panel_plan,command:cmd,state:stateView(events[0].state)}));
    return events;
  }));
  try{
    return await rejouerService({engine,vendor,gameCode:'COMB',sessionId:'comb-46',entries:{cuts,records,guards},
      limit:variant==='nominal'?16:scoped?targetTurn-1:1,reprise:variant!=='nominal',
      onTurn:i=>turn=i,
      describe(p,index){
        const plan=p.product_panel_plan;
        return {plan:plan?{step:p.steps[index],steps:p.steps.map(({factor,before_values,after_values,relation_observed})=>
          ({factor,before_values,after_values,relation_observed})),estimate:estimateView(plan.estimate),scene:sceneView(plan.scene),
          purpose:p.bundle_template.purpose}:null};
      },
      present({board,actual,pre}){
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        if(variant!=='multifactoriel')return actual;
        const another=opening.controls.find((c,i)=>i!==pre.plan.step.factor);
        const [x,y]=another.point,changed=actual.frame.map(row=>[...row]);
        const old=changed[y][x],value=another.values.find(v=>v!==old),[l,t,r,b]=another.bbox;
        for(let v=t+1;v<b;v++)for(let u=l+1;u<r;u++)if(changed[v][u]===old)changed[v][u]=value;
        return {...actual,frame:changed,frames:[changed]};
      }});
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
