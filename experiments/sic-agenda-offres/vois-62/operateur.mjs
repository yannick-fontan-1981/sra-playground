import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const brief=s=>s&&{pitch:s.q,offset:s.offset,box:s.reference_box,zone:s.zone_box,digest:s.reference_digest,
  target:s.target,bodies:s.bodies,population:s.population,floor:s.floor.length};
const same=(a,b)=>digest(a)===digest(b);
const byCell=(a,b)=>a[0]-b[0]||a[1]-b[1];
const slots=s=>s.target.map(t=>t.slice(0,2));
function closest(s){
  const target=slots(s),missing=target.filter(g=>!s.bodies.some(b=>same(b.cell,g)));
  const foreign=s.bodies.filter(b=>!target.some(g=>same(g,b.cell)));
  assert.ok(missing.length&&foreign.length);
  const distance=b=>Math.min(...missing.map(g=>Math.abs(b.cell[0]-g[0])+Math.abs(b.cell[1]-g[1])));
  return foreign.sort((a,b)=>distance(a)-distance(b)||byCell(a.cell,b.cell))[0].cell;
}
function referenceUnits(rows,s){
  const [l,t,r,b]=s.reference_box,units=[];
  for(let y=t+1;y+s.q-2<b;y++)for(let x=l+1;x+s.q-2<r;x++){
    const color=rows[y][x];
    if(color===s.background||color===s.border)continue;
    const pixel=(dx,dy)=>rows[y+dy]?.[x+dx];
    if(pixel(-1,0)===color||pixel(0,-1)===color||pixel(s.q-1,0)===color||pixel(0,s.q-1)===color)continue;
    if(Array.from({length:s.q-1},(_,i)=>rows[y+i].slice(x,x+s.q-1)).flat().every(v=>v===color))units.push([x,y,color]);
  }
  assert.equal(units.length,s.target.length);
  return units;
}
function changeReference(rows,s,measure,remove){
  const [l,t,r,b]=s.reference_box,q=s.q,units=referenceUnits(rows,s);
  const paint=(raster,x,y,value)=>{for(let j=0;j<q-1;j++)for(let i=0;i<q-1;i++)raster[y+j][x+i]=value;};
  if(remove){
    const [x,y,color]=units.at(-1),raster=structuredClone(rows);
    paint(raster,x,y,s.background);
    return {raster,change:{from:[x,y],to:null,color}};
  }
  const origin=[Math.min(...units.map(u=>u[0])),Math.min(...units.map(u=>u[1]))];
  for(const [x,y,color] of units){
    for(let i=origin[0]%q+l-l%q;i+q-2<r;i+=q)for(let j=origin[1]%q+t-t%q;j+q-2<b;j+=q){
      if(i<=l||j<=t||units.some(u=>u[0]===i&&u[1]===j))continue;
      const raster=structuredClone(rows);
      paint(raster,x,y,s.background);
      if(!Array.from({length:q-1},(_,k)=>rows[j+k].slice(i,i+q-1)).flat().every(v=>v===s.background))continue;
      paint(raster,i,j,color);
      const candidate=measure(raster);
      if(!candidate||!same(candidate.bodies,s.bodies)||!same(candidate.reference_box,s.reference_box)
        ||!same(candidate.zone_box,s.zone_box)||same(slots(candidate),slots(s))||same(closest(candidate),closest(s)))continue;
      return {raster,change:{from:[x,y],to:[i,j],color}};
    }
  }
  throw new Error('Aucun déplacement unitaire contrastant dans le cadre de référence');
}

export async function play(engine,variant,vendor){
  const {ReferencePopulationMemory,referencePopulationBefore}=await import(new URL('src/logos-engine/v6-reference-population-access.ts',engine));
  const {measureReferencePopulation,referencePopulationPaths}=await import(new URL('src/logos-engine/v6-reference-population-observation.ts',engine));
  const family=ReferencePopulationMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.propose,record=family.record,hooks=[mock.method(Date,'now',()=>1700000000000)];
  let change=null,plannedScene=null;
  hooks.push(mock.method(family,'propose',function(obs,rows,inputs,limit,config){
    const m=this.currentState(),retained=m.population_state?.epoch===obs.level_epoch?m.population_state:null;
    const current=measureReferencePopulation(rows,retained?.scene??null);
    const available=Object.fromEntries(Object.entries(m.population_controls).filter(([key])=>obs.available_action_refs.includes(key)));
    const wanted=current&&slots(current),occupied=current?.bodies.map(b=>b.cell);
    const loose=occupied?.filter(c=>!wanted.some(g=>same(g,c))),open=wanted?.filter(g=>!occupied.some(c=>same(c,g)));
    const domains=loose?.map(cell=>({cell,reachable:open.flatMap(goal=>{
      const path=referencePopulationPaths(cell,current.floor,occupied,available).get(JSON.stringify(goal));
      return path?[{goal,steps:path[0].length}]:[];
    })}));
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),scene:brief(current),
      retained:retained&&{active:retained.active,pending:retained.pending,reference:retained.scene.reference_digest,refs:retained.evidence},
      controls:available,loose,open,domains,
      surplus:current===null&&retained===null?brief(measureReferencePopulation(rows,null,{allowSurplus:true})):null};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=propose.call(this,obs,rows,inputs,limit,config),plan=p?.reference_population_plan;
    cut.local={status:p?.status??'abstained',reason:p?.reason??null};
    if(plan){
      plannedScene=plan.scene;
      const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:referencePopulationBefore(p,0,rows,meta),
        stale:referencePopulationBefore(p,0,rows,{...meta,observation_ref:obs.observation_ref+':old'})});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',function(b,cmd,a,rows,later,p,i){
    const events=record.call(this,b,cmd,a,rows,later,p,i),plan=p.reference_population_plan;
    if(plan){
      const event=events[0],valid=a.level_epoch===b.level_epoch;
      records.set(a.observation_ref,{event:event&&{detail:event.detail,active:event.state.active,pending:event.state.pending,
        controls:event.controls,relations:event.observed_local_relations,color:event.color_rule_status},
        current:valid&&brief(measureReferencePopulation(later,plan.scene)),fresh:valid&&brief(measureReferencePopulation(later))});
    }
    return events;
  }));
  try{
    const scope=variant==='nominal'?16:variant==='reference-changee'?6:variant==='stationnaire'?2:1;
    const result=await rejouerService({engine,vendor,gameCode:'VOIS',sessionId:'vois-62',limit:scope,reprise:true,entries:{cuts,records,guards},
      initial(board){
        if(!['reference-retiree','reference-deplacee'].includes(variant))return board;
        const scene=measureReferencePopulation(board.frame);
        assert.ok(scene);
        const changed=changeReference(board.frame,scene,measureReferencePopulation,variant==='reference-retiree');
        change=changed.change;
        return {...board,frame:changed.raster,frames:[changed.raster]};
      },
      describe(p,i){
        const plan=p.reference_population_plan;
        return {plan:plan?{mode:plan.mode,chosen:plan.chosen,expected:plan.expected,before:plan.before_cells,
          commands:plan.commands,assignment:plan.assignment_method,complete:plan.assignment_complete,controls:plan.controls}:null};
      },
      present({actual,board,i}){
        if(variant==='stationnaire'&&i===2)return {...board,frames:[board.frame]};
        if(variant!=='reference-changee'||i!==6)return actual;
        const scene=plannedScene;
        const [x,y,color]=referenceUnits(board.frame,scene).at(-1),altered=structuredClone(actual.frame);
        assert.equal(altered[y][x],color);
        altered[y][x]=scene.background;
        change={from:[x,y],to:null,color};
        return {...actual,frame:altered,frames:[altered]};
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','reference-retiree','reference-deplacee','reference-changee','stationnaire'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.plan?.mode??s.pre.family,JSON.stringify(s.pre.command),s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.stop,r.cuts.at(-1)?.local,r.change);
}
