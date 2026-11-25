import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findRelayPlan } from '../src/sic/observed-relay-plan.ts';
import { observedGateDependencies } from '../src/sic/observed-gate-dependency.ts';

const families=['handoff','weight-holds-open','release-to-open','consumed-weight','exchange-without-gate'];
const directions=[[1,0],[-1,0],[0,1],[0,-1]];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const occupied=(state,cell)=>state.actors.includes(cell)||state.loads.includes(cell);
const sameSet=(a,b)=>a.length===b.length&&a.every(value=>b.includes(value));

function world(kind,index){
  const variant=index%4, size=Math.floor(index/4);
  const width=5+size, hinge=3+(size%2), top=2+(size%2);
  function orient(x,y){
    if(variant&1)x=18-x;
    if(variant&2)[x,y]=[y,x];
    return (x+3)+64*(y+3);
  }
  const axis=(dx,dy)=>orient(6+dx,6+dy)-orient(6,6);
  const chamber=(from,to)=>Array.from({length:(to-from+1)*width},(_,i)=>orient(1+i%width,from+Math.floor(i/width)));
  const floor=new Set([...chamber(1,top),...chamber(top+2,top+5)]);
  const throat=orient(hinge,top+1);
  const plate=orient(kind==='weight-holds-open'||kind==='release-to-open'?hinge+1:hinge,top);
  const goals=[orient(2,top+5),orient(width,top+5)];
  let actors=[orient(2,top),orient(hinge,top+3)], loads=[orient(hinge-1,top+4)], water=[];
  const gateRules=new Map();
  if (kind!=='consumed-weight'&&kind!=='exchange-without-gate') {
    floor.add(throat);
    gateRules.set(throat,{ control:plate, closedWhenPressed:kind==='release-to-open' });
  } else if(kind==='consumed-weight') {
    water=[throat];
  } else floor.add(throat);
  if(kind==='weight-holds-open'||kind==='consumed-weight'){
    actors=[orient(hinge,1),orient(width,top)];
    loads=[orient(hinge,kind==='consumed-weight'?top:2)];
    if(kind==='weight-holds-open'){
      actors[0]=orient(2,1);
      loads=[orient(hinge,top)];
    }
  }
  if(kind==='release-to-open')actors[0]=plate;
  if(kind==='exchange-without-gate'){
    actors=[orient(hinge,1),orient(width,top+3)];
    loads=[throat];
  }
  const ray={peers:true,loads:true};
  const rays=kind==='handoff'?[null,ray]:kind==='exchange-without-gate'?[ray,null]:[null,null];
  const limits=kind==='exchange-without-gate'?[0,0]:[1+(size%3),rays[1]?0:1];
  const controls=actors.map((_,actor)=>directions.map(([dx,dy],n)=>({
    action:'move_'+actor+'_'+((n+variant+size)%4),axis:axis(dx,dy),
  })));
  return {kind,floor,water:new Set(water),gateRules,goals,rays,limits,controls,
    state:{actors,loads,reflectors:[],supports:[]},plate:gateRules.size?plate:null};
}

// This checker applies commands from the public action table to the fixture.
// It receives the actual constraints, independent of the law given to SIC.
function experimentStep(world,state,actor,action){
  const delta=world.controls[actor].find(entry=>entry.action===action)?.axis;
  if(!delta)return;
  const from=state.actors[actor], dest=from+delta;
  const closed=(pose,cell)=>{
    const gate=world.gateRules.get(cell);
    return !!gate&&(occupied(pose,gate.control)===gate.closedWhenPressed);
  };
  const exists=cell=>world.floor.has(cell)||world.water.has(cell);
  const pass=cell=>exists(cell)&&!closed(state,cell);
  const safe=cell=>world.floor.has(cell)||state.supports.includes(cell);
  if(!pass(dest))return;
  const effects=new Map();
  if(world.rays[actor]){
    let target=dest;
    while(pass(target)&&safe(target)&&!occupied(state,target))target+=delta;
    if(pass(target)&&occupied(state,target)){
      effects.set(from,target);effects.set(target,from);
    }
  }
  if(!effects.size){
    if(!safe(dest))return;
    effects.set(from,dest);
    let cell=dest,n=0;
    while(occupied(state,cell)){
      if(++n>world.limits[actor]||!pass(cell+delta))return;
      effects.set(cell,cell+delta);
      cell+=delta;
    }
  }
  const at=cell=>effects.get(cell)??cell;
  const actors=state.actors.map(at);
  if(actors.some(cell=>!safe(cell)))return;
  const supports=[...state.supports], loads=[];
  for(const target of state.loads.map(at)){
    if(safe(target))loads.push(target);
    else if(world.water.has(target))supports.push(target);
    else return;
  }
  const after={actors,loads,reflectors:[],supports};
  for(const gate of world.gateRules.keys())if(closed(after,gate)&&occupied(after,gate))return;
  return after;
}

function learnedGates(world){
  const bindings=[];
  for(const [gate, expected] of world.gateRules){
    const occupied=new Map([[expected.control,false],['unrelated',false]]);
    const pressed=new Map([[expected.control,true],['unrelated',false]]);
    const before={occupied,closed:new Map([[gate,!expected.closedWhenPressed]])};
    const after={occupied:pressed,closed:new Map([[gate,expected.closedWhenPressed]])};
    const law=observedGateDependencies(before,after,'controlled intervention',()=>true).get(gate);
    assert.deepEqual(law,{...expected,evidence:'controlled intervention'});
    const confounded={...after,occupied:new Map([[expected.control,true],['unrelated',true]])};
    assert.equal(observedGateDependencies(before,confounded,'confounded',()=>true).size,0);
    bindings.push({cell:gate,control:law.control,closedWhenPressed:law.closedWhenPressed});
  }
  return bindings;
}

async function run(world,ablate){
  const gates=learnedGates(world), floor=new Set(world.floor);
  if(ablate)for(const gate of gates)if(gate.closedWhenPressed===occupied(world.state,gate.control))floor.delete(gate.cell);
  const plan=await findRelayPlan({
    floor,water:world.water,gates:ablate?[]:gates,plate:world.plate,goals:world.goals,
    arms:[],controls:world.controls,capacity:world.limits,trigger:'',activeActor:0,
    rayExchange:ablate?[null,null]:world.rays,
  },world.state,{maxNodes:11000,yieldControl:async()=>{}});
  if(!plan?.length)return {verified:false};
  let current=world.state, ray=0, gatesHeld=0, built=0;
  for (const step of plan){
    assert.ok(equal(current.actors,step.before.actors)&&sameSet(current.loads,step.before.loads));
    const next=experimentStep(world,current,step.actor,step.action);
    if(!next||!equal(next.actors,step.after.actors)||!sameSet(next.loads,step.after.loads)||!sameSet(next.supports,step.after.supports)){
      return {verified:false,refuted:true};
    }
    const from=current.actors[step.actor], to=next.actors[step.actor];
    const distance=Math.abs(from%64-to%64)+Math.abs(Math.floor(from/64)-Math.floor(to/64));
    if(distance>1)ray++;
    const delta=world.controls[step.actor].find(move=>move.action===step.action).axis;
    const spans=Array.from({length:distance},(_,index)=>from+(index+1)*delta);
    if(gates.some(g=>g.closedWhenPressed!==occupied(current,g.control)
      &&([ ...next.actors,...next.loads ].includes(g.cell)||spans.includes(g.cell))))gatesHeld++;
    built+=next.supports.length-current.supports.length;
    current=next;
  }
  return {verified:world.goals.every(goal=>current.actors.includes(goal)),commands:plan.length,ray,gatesHeld,built};
}

function causalControls(){
  let controls=0;
  for(let i=0;i<1000;i++){
    const site={name:i%3?'lever':'pad'}, other={name:'ambient'}, first={name:'curtain'}, second={name:'bridge'};
    const closed=i%2===0, mode=i%5;
    const before={occupied:new Map([[site,false],[other,false]]),closed:new Map([[first,closed],[second,!closed]])};
    const after={occupied:new Map([[site,true],[other,mode===1]]),
      closed:new Map([[first,!closed],...(mode===2?[]:[[second,closed]])])};
    const observed=observedGateDependencies(before,after,'transition#'+i,(_,gate)=>mode!==3||gate!==first);
    assert.equal(observed.size,mode===1?0:mode===2||mode===3?1:2);
    for(const [gate,rule] of observed) {
      assert.equal(rule.control,site);assert.equal(rule.closedWhenPressed,after.closed.get(gate));
    }
    controls++;
  }
  return controls;
}

const summary={ causalControls:causalControls(), families:{}, comparisons:0 };
for(const family of families){
  const results=[];
  for(let index=0;index<12;index++){
    const fixture=world(family,index);
    results.push({index,reference:await run(fixture,true),candidate:await run(fixture,false)});
  }
  summary.families[family]={
    count:results.length, candidate:results.filter(r=>r.candidate.verified).length,
    reference:results.filter(r=>r.reference.verified).length,
    refuted:results.filter(r=>r.candidate.refuted).length,
    physicalWitnesses:results.reduce((c,r)=>({ray:c.ray+(r.candidate.ray??0),gates:c.gates+(r.candidate.gatesHeld??0),
      built:c.built+(r.candidate.built??0)}),{ray:0,gates:0,built:0}),results,
  };
  summary.comparisons+=results.length;
}
const dest=resolve(process.argv[2]??'artifacts/l1-pressure-proof');
mkdirSync(dest,{recursive:true});
writeFileSync(join(dest,'transfer-report.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({comparisons:summary.comparisons,causalControls:summary.causalControls,
  families:Object.fromEntries(Object.entries(summary.families).map(([key,{results,...value}])=>[key,value]))}));
