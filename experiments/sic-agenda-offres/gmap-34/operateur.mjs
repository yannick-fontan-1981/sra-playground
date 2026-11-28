import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {evaluateurJeu} from '../evaluateur-jeu.mjs';
import {loadGame} from '../frontiere-22-23/game.mjs';
import {withEngine} from '../moteur-reference.mjs';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const variants=['nominal','sans-repere','stationnaire','sans-localisation','sans-permission'];
const chartView=c=>c&&{epoch:c.epoch,refs:c.evidence,current:c.current,origin:c.origin,pitch:c.pitch,
  goal:c.goal_annotation_hypothesis,nodes:c.nodes.map(n=>({point:n.center,inside:n.inside,corner:n.corner,edge:n.edge,
    middle:n.center_value,box:n.bbox})),links:c.links,slots:c.slots.map(s=>s.bbox)};
const offer=o=>({kind:o.kind,action:o.action,distance:o.distance,from:o.position,start:o.location_alternatives,
  position_status:o.position_status,target:o.target.center,annotation:o.target.inside,held:o.held,
  route:o.route,alternatives:o.route_alternatives,chart_ref:o.chart_ref,facts:o.facts,unknown:o.unknown});
const memory=s=>({positions:s.positions,status:s.position_status,visited:s.visited,gains:s.gains,grants:s.grants,
  blocked:s.blocked,evidence:s.evidence,portable:s.portable});

function withoutCorners(rows,chart){
  assert.ok(chart);
  const n=chart.nodes.find(n=>n.center.toString()===chart.current.toString()),[l,t,r,b]=n.bbox;
  const pixels=[[l,t],[r,t],[l,b],[r,b]],changed=rows.map(row=>[...row]);
  assert.notEqual(n.edge,n.corner);
  for(const [x,y] of pixels){assert.equal(changed[y][x],n.corner);changed[y][x]=n.edge;}
  return {changed,pixels};
}

export async function play(engine,variant,vendor){
  assert.ok(variants.includes(variant));
  const {ChartNavigation}=await import(new URL('src/logos-engine/v6-chart-navigation.ts',engine));
  const geometry=await import(new URL('src/logos-engine/v6-chart-navigation-geometry.ts',engine));
  const family=ChartNavigation.prototype,cuts=new Map(),records=new Map(),checks=new Map(),slots=new WeakSet();
  const entry=family.proposeInSubquestion,offers=family.offers,before=family.before,record=family.recordSource;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1;
  hooks.push(mock.method(family,'proposeInSubquestion',async function(...args){
    slots.add(this);
    try{return await entry.apply(this,args);}finally{slots.delete(this);}
  }));
  hooks.push(mock.method(family,'offers',function(obs,rows){
    if(!slots.has(this))return offers.call(this,obs,rows);
    const raw=geometry.measureChart(rows,obs);
    const change=turn===1&&variant==='sans-repere'?withoutCorners(rows,raw):null,used=change?.changed??rows;
    const incoming=this.state(),uncertain=turn===2&&variant==='sans-localisation',
      permission=turn===4&&variant==='sans-permission';
    if(uncertain){
      assert.equal(raw,null);
      assert.equal(this.positions.length,1);
      this.positions=[this.chart.origin,...this.positions];
      this.position=null;
      this.position_status='indistinguishable_scene_location_alternatives';
    }
    if(permission){
      assert.equal(raw,null);
      assert.equal(this.grants.length,1);
      this.grants=[];
    }
    try{
      const result=offers.call(this,obs,used),chart=this.chart;
      const pre=structuredClone({observation:obs.observation_ref,epoch:obs.level_epoch,actions:obs.available_action_refs,
        input:digest(rows),changed:change?.pixels??[],measured:chartView(raw),decoded:chartView(chart),incoming:memory(incoming),
        state:memory(this.state()),offers:result.map(offer),held:chart?geometry.chartInventory(used,chart):null});
      cuts.set(obs.observation_ref,{pre,seal:digest(pre)});
      if(change||uncertain||permission)assert.deepEqual(result,[]);
      return result;
    }finally{
      if(uncertain)Object.assign(this,{positions:incoming.positions,position:incoming.position,position_status:incoming.position_status});
      if(permission)this.grants=incoming.grants;
    }
  }));
  hooks.push(mock.method(family,'before',function(p,i,packet,obs){
    const live=before.call(this,p,i,packet,obs);
    const old=before.call(this,p,i,packet,{...obs,observation_ref:obs.observation_ref+':old'});
    checks.set(obs.observation_ref,{live,old});
    return live;
  }));
  hooks.push(mock.method(family,'recordSource',function(b,a,cmd,first,second,p,index,frames){
    const result=record.call(this,b,a,cmd,first,second,p,index,frames),chart=this.chart;
    if(result)records.set(a.observation_ref,structuredClone({result,memory:memory(this.state()),owned:!!p?.chart_plan,
      oldHeld:chart&&geometry.chartInventory(first,chart),newHeld:chart&&geometry.chartInventory(second,chart),
      sceneChanged:chart&&geometry.chartScene(first,chart)!==geometry.chartScene(second,chart)}));
    return result;
  }));
  try{
    const {createService,defaultRecoveryPack,packet}=await evaluateurJeu(engine),service=createService(),
      game=await loadGame('GMAP',vendor,engine),sessionId='gmap-34';
    let board=game.initial;
    let r=await service.handle({type:'init',sessionId,sequence:0,recovery:defaultRecoveryPack,
      budgets:{targetLevels:board.levelCount,levelActionCaps:Array(board.levelCount).fill(600),maxActions:16},observation:packet(board,0)});
    const steps=[];
    const issued=()=>{
      if(!r.ticket)return null;
      const {snapshot,ticket}=r,p=snapshot.proposal,ref=ticket.observationRef;
      const release=snapshot.trace.findLast(e=>e.kind==='sic_native_plan'),g=snapshot.trace.findLast(e=>e.kind==='before_guard');
      const plan=p.chart_plan;
      return structuredClone({ref,ticket:ticket.id,level:board.level,family:release?.family??snapshot.lastDecision,
        kind:p.kind,slot:p.material_access_subquestion??null,bundle:p.bundle_template?.operation_key??null,
        command:[ticket.actionRef,ticket.data??{}],guard:{admitted:g?.admitted,reason:g?.reason},scope:checks.get(ref)??null,
        refs:p.route_refs,cut:cuts.get(ref)??null,plan:plan&&{offer:offer(plan.offer),policy:{choice:plan.choice,workflow:plan.workflow},
          root:p.bundle_template.objective_ref}});
    };
    const limit=variant==='nominal'?16:variant==='stationnaire'?1:variant==='sans-permission'?4:3;
    for(let i=1;i<=limit;i++){
      while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i-1});
      const pre=issued();
      if(!pre)break;
      const actual=await game.step(Number(pre.command[0].slice(6)),pre.command[1]);
      const replace=variant==='stationnaire'&&i===1;
      const shown=replace?{...board,frames:[board.frame]}:actual;
      turn=i+1;
      r=await service.handle({type:'advance',sessionId,sequence:i,ticketId:pre.ticket,observation:packet(shown,i),executionMs:0});
      const e=r.snapshot.trace.findLast(x=>x.kind==='actual_outcome');
      const after={ref:e.observation_ref,matched:e.matched,seal:e.seal_prefix,reason:e.reason,levels:shown.levelsCompleted,frames:actual.frames.length,
        packet:digest([actual.frame,actual.frames,actual.availableActionIds,actual.level,actual.levelsCompleted,actual.state]),
        physical:digest(actual.frame),presented:digest(shown.frame),record:records.get(e.observation_ref)??null};
      steps.push({i,pre,after});board=shown;
      if(replace){
        while(r.kind==='boundary')r=await service.handle({type:'resume',sessionId,sequence:i});
        break;
      }
    }
    return {steps,stop:r.reason??null,next:issued()};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
