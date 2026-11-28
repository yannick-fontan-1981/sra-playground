import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','stationnaire','sans-selection','sans-effets','sans-relation'];
const memory=m=>({symbols:m.symbols,confirmed:m.selection_observed,evidence:m.evidence,effects:m.effects,failed:m.failed});
const scene=s=>s&&s.panels.map(p=>({id:p.id,box:p.bbox,room:p.room,mark:p.room_marker,material:p.material,
  selected:p.activity_controls.filter(c=>c.outline===p.selection_color).map(c=>c.row),
  services:p.services.map(x=>({kind:x.kind,site:x.observed_site,input:x.input,output:x.output??null,point:x.control?.point??null}))}));
const crop=(rows,[x,y,r,b])=>rows.slice(y,b+1).map(row=>row.slice(x,r+1));
const compare=(before,after,box)=>{
  const a=crop(before,box),b=crop(after,box);
  return {before:digest(a),after:digest(b),changed:a.flatMap((row,y)=>row.filter((v,x)=>v!==b[y][x])).length};
};

function withoutRelation(rows,measured,panelIndex,components){
  const p=measured?.panels[panelIndex];
  assert.ok(p);
  const direct=p.operators.find(s=>s.kind==='displayed_receiver'&&s.input===p.material);
  const service=direct??p.operators.find(s=>s.kind==='displayed_rewrite'&&s.input===p.material
    &&p.services.some(r=>r.kind==='displayed_receiver'&&r.input===s.output));
  assert.ok(service);
  const [x,y]=service.observed_site,unit=service.control.bbox[2]-service.control.bbox[0]+1;
  const [left,top,right,bottom]=p.room;
  const cells=components(rows).filter(({bbox:[l,t,r,b],area,color})=>area===unit*unit&&r-l+1===unit&&b-t+1===unit
    &&l>=left&&t>=top&&r<=right&&b<=bottom&&color===p.material
    &&(direct?l===x&&t>=y+unit&&t-y-unit<unit:t===y&&r<x&&x-r<=unit));
  assert.equal(cells.length,1);
  const [target]=cells,[l,t,r,b]=target.bbox,background=rows[t-1][l],changed=rows.map(row=>[...row]);
  assert.notEqual(background,target.color);
  for(let py=t;py<=b;py++)for(let px=l;px<=r;px++)changed[py][px]=background;
  return {changed,detail:{panel:p.id,site:service.observed_site,removed:target.bbox,value:target.color,background}};
}

export async function play(engine,variant,vendor,targetTurn,panelIndex){
  assert.ok(variants.includes(variant));
  const target=!['nominal','stationnaire'].includes(variant);
  assert.ok(!target||Number.isInteger(targetTurn)&&targetTurn>0);
  const prefix='src/logos-engine/v6-panel-service-';
  const {PanelServiceMemory,panelServiceBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measurePanelService,panelServiceProjection}=await import(new URL(prefix+'observation.ts',engine));
  const {geometricComponents}=await import(new URL('src/logos-engine/v6-native-observer.ts',engine));
  const family=PanelServiceMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.propose,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'propose',function(obs,rows,...args){
    const saved=this.panelMemory;
    const raw=measurePanelService(rows,saved.symbols),replace=turn===targetTurn;
    const mutation=replace&&variant==='sans-relation'?withoutRelation(rows,raw,panelIndex,geometricComponents):null;
    const used=mutation?.changed??rows;
    if(replace&&variant==='sans-effets')this.panelMemory={...saved,effects:[]};
    if(replace&&variant==='sans-selection')this.panelMemory={...saved,selection_observed:false};
    try{
      const observed=mutation?measurePanelService(used,saved.symbols):raw;
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,available:obs.available_action_refs,
        hash:digest(rows),fields:scene(raw),usedFields:scene(observed),prior:memory(saved),used:memory(this.panelMemory),
        changed:mutation?.detail??null,samePanels:!mutation||raw.panels.every(p=>digest(crop(rows,p.bbox))===digest(crop(used,p.bbox)))});
      const cut={pre,seal:digest(pre)};
      cuts.set(obs.observation_ref,cut);
      const p=propose.call(this,obs,used,...args);
      cut.result=p?{status:p.status,reason:p.reason??null,blocking:p.block_unrelated_probe??false,missing:p.missing_panels??null}:null;
      if(p?.panel_service_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        guards.set(obs.observation_ref,{live:panelServiceBefore(p,0,rows,meta),
          stale:panelServiceBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'})});
      }
      return p;
    }finally{if(this.panelMemory!==saved)this.panelMemory=saved;}
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,index){
    const events=record.call(this,b,cmd,a,rows,later,p,index),e=events[0],plan=p?.panel_service_plan;
    if(e){
      const next=measurePanelService(later,e.memory.symbols);
      records.set(a.observation_ref,structuredClone({detail:e.detail,memory:memory(e.memory),before:scene(plan.scene),after:scene(next),
        projected:next?panelServiceProjection(next):null,physical:plan.scene.panels.map(p=>({id:p.id,room:compare(rows,later,p.room),
          panel:compare(rows,later,p.bbox)}))}));
    }
    return events;
  }));
  try{
    const played=await rejouerService({engine,vendor,gameCode:'RSWP',sessionId:'rswp-55',entries:{cuts,guards,records},
      limit:variant==='nominal'?16:variant==='stationnaire'?1:targetTurn-1,reprise:variant!=='nominal',onTurn:i=>turn=i,
      describe(p,i){
        const plan=p.panel_service_plan;
        return {plan:plan?{kind:plan.kind,commands:plan.commands,contributions:plan.contributions,edit:plan.steps[i].edit,
          expected:plan.steps[i].expected,memory:memory(plan.memory),projection:panelServiceProjection(plan.scene)}:null};
      },
      present({board,actual}){return variant==='stationnaire'?{...board,frames:[board.frame]}:actual;}});
    return {...played,lastCut:[...cuts.values()].at(-1)??null};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},panneau:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour),Number(values.panneau??0));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.kind??s.pre.kind,JSON.stringify(s.pre.command),
    s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
