/** Independent workshop review. No condition here is part of the playable rules.
 * The searched families are explicit; a limit never establishes impossibility.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,circuitPressed,gateClosed} from '../dist/core.js';
import {decodeCommand,replay,stateKey} from './solver.mjs';

const root=new URL('../',import.meta.url);
const accessOnly=process.argv.includes('--access-only');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cell=p=>p.y*20+p.x;
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const cardinal=[[0,-1],[0,1],[-1,0],[1,0]];
const inside=p=>p.x>=0&&p.x<20&&p.y>=0&&p.y<20;
const outcome=s=>s.dead?'dead':s.failed?'refused':s.complete?'won':'legal';
const positions=points=>points.map(cell).sort((a,b)=>a-b);
const cargoKey=s=>JSON.stringify({stones:positions(s.stones),monsters:positions(s.monsters),supports:positions(s.supports),mirrors:s.mirrors.map(m=>[cell(m.at),m.facing]).sort()});
const snapshot=(world,state)=>({
  heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),
  stones:state.stones,supports:state.supports,monsters:state.monsters,mirrors:state.mirrors,
  circuits:Object.fromEntries(world.circuits.map(c=>[c.id,circuitPressed(world,state,c.id)])),
  gates:world.gates.map((g,i)=>({at:g.at,closed:gateClosed(world,state,i)})),
  complete:state.complete,refused:state.failed,dead:state.dead
});

function loadWorkshop(){
  const design=JSON.parse(readFileSync(new URL('reference/level4-design.json',root),'utf8'));
  assert.equal(design.spec.id,'ss15-04');
  const world=compileLevel(design.spec),route=replay(design.spec,design.commands);
  assert.ok(route.state.complete,'The workshop witness wins');
  assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
  assert.deepEqual(route.metrics,design.metrics);assert.deepEqual(route.actions,design.actions);
  const stateAt=turn=>turn?route.trace[turn-1].after:initialState(world);
  for(const stage of design.stages){
    assert.ok(Number.isInteger(stage.turn)&&stage.turn>=0&&stage.turn<=route.trace.length);
    const state=stateAt(stage.turn);
    assert.deepEqual(stage.heroes,state.heroes.map(h=>({kind:h.kind,at:h.at})));
    for(const key of ['stones','supports','monsters','mirrors'])assert.deepEqual(stage[key],state[key]);
    assert.deepEqual(stage.circuits,snapshot(world,state).circuits);
  }
  return {design,world,route,stateAt};
}

/** Water transmits rays. Include it when auditing the sealed final region so
 * a river is never treated as if it were a wall against swaps or reflections.
 */
function sealedRegion(world){
  const gateCells=new Set(world.gates.map(g=>cell(g.at)));
  const queue=[world.goals[0]],seen=new Set(queue.map(cell));
  for(let head=0;head<queue.length;head++)for(const [dx,dy] of cardinal){
    const next={x:queue[head].x+dx,y:queue[head].y+dy},key=cell(next);
    if(!inside(next)||world.terrain[key]==='#'||gateCells.has(key)||seen.has(key))continue;
    seen.add(key);queue.push(next);
  }
  assert.ok(world.goals.every(p=>seen.has(cell(p))),'Both destinations share the protected final region');
  const frontier=[];
  for(const p of queue)for(const [dx,dy] of cardinal){
    const next={x:p.x+dx,y:p.y+dy};
    if(inside(next)&&gateCells.has(cell(next))&&!frontier.some(q=>same(q,next)))frontier.push(next);
  }
  const entrances=world.gates.flatMap((g,index)=>frontier.some(p=>same(p,g.at))?[index]:[]);
  assert.ok(entrances.length,'The final region has a controlled entrance');
  const initial=initialState(world);
  const occupants=[...initial.heroes.map(h=>h.at),...initial.stones,...initial.monsters];
  assert.equal(occupants.filter(p=>seen.has(cell(p))).length,0,'No initial actor in the final region can serve as a swap target');
  assert.equal(initial.mirrors.filter(m=>seen.has(cell(m.at))).length,0,'No mirror starts inside the final region');
  assert.ok(entrances.every(i=>gateClosed(world,initial,i)),'The protected entrances start closed');
  return {
    contains:p=>seen.has(cell(p)),entrances,
    audit:{cells:queue.length,floorCells:queue.filter(p=>world.terrain[cell(p)]==='.').length,
      waterCells:queue.filter(p=>world.terrain[cell(p)]==='~').length,goals:world.goals,
      entrances:entrances.map(i=>({index:i,...world.gates[i]})),initialMobileOccupants:0,initialMirrors:0,
      interpretation:'Non-wall connectivity with presses blocked, including water because rays cross it. This is a geometry check, not a proof that every future entrance must use the authored route.'}
  };
}

function branch(context,saved){
  const {afterTurn,commands,label,meaning}=saved;
  assert.ok(Number.isInteger(afterTurn)&&afterTurn>=0&&afterTurn<=context.route.trace.length);
  let state=context.stateAt(afterTurn);const steps=[];
  for(const [index,command] of [...commands].entries()){
    const action=decodeCommand(command,state),detail=stepDetailed(context.world,state,action.id,action.data);
    state=detail.state;steps.push({turn:index+1,command,outcome:outcome(state),phases:detail.phases.map(p=>p.kind)});
    if(state.dead||state.failed||state.complete)break;
  }
  const actual=snapshot(context.world,state);
  assert.equal(steps.map(step=>step.command).join(''),commands,`${label}: no earlier refusal, death or completion is hidden in the preparation`);
  if(saved.heroes)assert.deepEqual(actual.heroes,saved.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})));
  for(const key of ['stones','supports','monsters','mirrors','circuits','refused','dead','complete'])if(key in saved)assert.deepEqual(actual[key],saved[key],`${label}: ${key}`);
  return {label,afterTurn,commands,meaning,outcome:outcome(state),steps,state:actual};
}

/** Move one hero freely while partner and resources stay fixed; at each such
 * approach execute one actual step, directional spell or global reflection.
 * The last probe may move resources. It is not followed by a second probe.
 */
function directProbes(context,region,afterTurn,{maxStates=2000,maxMs=4000}={}){
  const began=performance.now(),counts={legal:0,refused:0,dead:0,won:0},approaches=[],entries=[];
  let limited=false,totalEntries=0;
  for(const kind of ['wizard','bard']){
    let start=context.stateAt(afterTurn),selection='';
    if(start.heroes[start.active].kind!==kind){const action=decodeCommand('C',start);start=stepDetailed(context.world,start,action.id,action.data).state;selection='C';}
    const frozen=s=>cargoKey(s)+'|'+cell(s.heroes.find(h=>h.kind!==kind).at);
    const fixed=frozen(start),queue=[{state:start,commands:selection}],seen=new Set([stateKey(start)]);let expanded=0;
    for(let head=0;head<queue.length;head++){
      if(performance.now()-began>=maxMs||seen.size>=maxStates){limited=true;break;}
      const node=queue[head];expanded++;
      for(const command of 'UDLRX'){
        const action=decodeCommand(command,node.state),detail=stepDetailed(context.world,node.state,action.id,action.data),next=detail.state,status=outcome(next);
        counts[status]++;
        if(status==='dead'||status==='refused')continue;
        if(next.heroes.some(h=>!h.dead&&region.contains(h.at))){
          totalEntries++;
          if(entries.length<3)entries.push({hero:kind,commands:node.commands+command,phases:detail.phases.map(p=>p.kind),state:snapshot(context.world,next)});
        }
        if(command==='X'||next.complete||frozen(next)!==fixed||detail.phases.some(p=>!['walk','song','gate','platform'].includes(p.kind)||p.moves.some(m=>m.actor!=='hero')))continue;
        const key=stateKey(next);if(seen.has(key))continue;seen.add(key);queue.push({state:next,commands:node.commands+command});
      }
    }
    approaches.push({hero:kind,states:seen.size,expanded});
    if(limited)break;
  }
  return {afterTurn,status:limited?'limit-inconclusive':'local-family-exhausted',maxStates,maxMs,elapsedMs:Math.round(performance.now()-began),approaches,probes:counts,totalEntries,entryExamples:entries,
    scope:'Fixed cargo, supports, monsters, mirrors and partner during a one-hero walking approach; one subsequent real step, directional spell or global reflection. Exhaustion applies only to this family.'};
}

/** Search both heroes jointly. Chained hero swaps, hero reflections, presses
 * carrying only heroes and safe hero-only songs are allowed. Circuit and
 * platform changes remain real; every nonhero resource remains stationary.
 */
function noCargoTransport(context,region,afterTurn=0,{maxStates=180000,maxMs=14000}={}){
  const began=performance.now(),initial=context.stateAt(afterTurn),fixed=cargoKey(initial);
  const nodes=[{state:initial,parent:-1,command:''}],seen=new Set([stateKey(initial)]);
  let expanded=0,probes=0,firstEntry;
  const commandsFor=index=>{let result='';while(nodes[index].parent>=0){result=nodes[index].command+result;index=nodes[index].parent;}return result;};
  const result=(status,extra={})=>({afterTurn,status,maxStates,maxMs,states:seen.size,expanded,probes,elapsedMs:Math.round(performance.now()-began),firstEntry,...extra,
    scope:'Both heroes may walk, select, exchange with one another, reflect, be pushed by presses and move together through a hero-only song. Circuits and hydraulic platforms may change. No crate, monster, permanent support or mirror may move or disappear. This is not a search over all legal puzzle strategies.'});
  for(let head=0;head<nodes.length;head++){
    if(performance.now()-began>=maxMs)return result('limit-inconclusive');
    const node=nodes[head];expanded++;
    if(node.state.complete)return result('counterexample-found',{commands:commandsFor(head),state:snapshot(context.world,node.state)});
    for(const command of 'UDLRXC'){
      const action=decodeCommand(command,node.state),detail=stepDetailed(context.world,node.state,action.id,action.data),next=detail.state;probes++;
      if(next.failed||next.dead||cargoKey(next)!==fixed||detail.phases.some(p=>p.moves.some(m=>m.actor!=='hero')))continue;
      const key=stateKey(next);if(seen.has(key))continue;
      if(seen.size>=maxStates)return result('limit-inconclusive');
      seen.add(key);nodes.push({state:next,parent:head,command});
      if(!firstEntry&&next.heroes.some(h=>region.contains(h.at)))firstEntry={commands:commandsFor(nodes.length-1),state:snapshot(context.world,next)};
    }
  }
  return result('restricted-family-exhausted');
}

const report={success:false,partial:accessOnly,level:4,scope:'Independent replay, final-region geometry, local counter-branches and explicitly restricted direct-access searches',limitations:[
  'A winning authored route demonstrates solvability, not minimum length or a unique solution.',
  'The geometry audit includes water and treats the listed presses as barriers; it does not prescribe how their commands must eventually be prepared.',
  'Local direct probes allow only one spell or reflection after a fixed-resource walking approach. Their exhaustion is not a global shortcut proof.',
  'The two-hero search freezes all nonhero resources. It can refute an effortless completion but cannot establish the necessity of every authored mechanic.',
  'Any state or time limit is reported as inconclusive. A legal branch that has not won is not automatically a dead end.',
  'This verifier does not change the map, engine, tutorial, saved route or playable rules.'
]};
try{
  const context=loadWorkshop(),{design,route,world}=context,region=sealedRegion(world);
  report.title=design.spec.title;report.mapSha256=hash(design.spec);report.witnessSha256=hash(design.actions);
  report.witness={actions:route.metrics.actions,refusals:route.metrics.blocked,deaths:route.metrics.deaths,complete:route.state.complete,stages:design.stages.length,metrics:route.metrics};
  report.geometry=region.audit;
  report.branches=(design.adaptation.localCounterfactuals??[]).map(saved=>branch(context,saved));
  if(!accessOnly)assert.ok(report.branches.length>=4,'At least four replayed local choices document the reinforced workshop');
  const firstSupportStage=design.stages.find(stage=>stage.supports.length>world.supports.length);
  assert.ok(firstSupportStage,'The workshop witness creates its first water support');
  const turns=[...new Set([0,...design.stages.filter(stage=>stage.turn<=firstSupportStage.turn).map(stage=>stage.turn)])];
  report.directAccess=turns.map(turn=>directProbes(context,region,turn));
  const firstCargoSongTurn=route.trace.findIndex(t=>t.phases.some(p=>p.kind==='song'&&p.moves.some(m=>m.actor!=='hero')))+1;
  assert.ok(firstCargoSongTurn>0,'The workshop witness transports a resource through song');
  const firstCargoSongStage=design.stages.find(stage=>stage.turn>=firstCargoSongTurn);
  const jointTurns=[...new Set([0,firstCargoSongStage.turn,firstSupportStage.turn])];
  report.withoutResourceTransport=jointTurns.map(turn=>noCargoTransport(context,region,turn));
  report.totals={localBranches:report.branches.length,directFamilies:report.directAccess.length,
    directProbes:report.directAccess.reduce((n,r)=>n+Object.values(r.probes).reduce((a,b)=>a+b,0),0),
    directEntries:report.directAccess.reduce((n,r)=>n+r.totalEntries,0),
    limitedDirectFamilies:report.directAccess.filter(r=>r.status==='limit-inconclusive').length,
    jointSearchCases:report.withoutResourceTransport.length,limitedJointCases:report.withoutResourceTransport.filter(r=>r.status==='limit-inconclusive').length};
  assert.ok(report.directAccess.every(result=>result.probes.won===0),'A direct probe won the workshop and needs review');
  assert.ok(report.withoutResourceTransport.every(result=>result.status!=='counterexample-found'),'The workshop can be completed from an early checkpoint without further resource transport');
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
mkdirSync(new URL('validation/',root),{recursive:true});
writeFileSync(new URL('validation/workshop-constraints-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,partial:report.partial,level:report.level,title:report.title,witness:report.witness,totals:report.totals,
  withoutResourceTransport:report.withoutResourceTransport?.map(result=>({afterTurn:result.afterTurn,status:result.status,states:result.states,expanded:result.expanded,probes:result.probes,elapsedMs:result.elapsedMs,commands:result.commands})),
  error:report.error},null,2));
