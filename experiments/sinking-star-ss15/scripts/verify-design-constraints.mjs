/** Independent, local design review. This is author tooling, never a game rule.
 * Every branch starts at an executed witness state. Search limits are inconclusive.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,circuitPressed,gateClosed} from '../dist/core.js';
import {decodeCommand,replay,stateKey} from './solver.mjs';

const root=new URL('../',import.meta.url);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const at=(p,x,y)=>p.x===x&&p.y===y;
const positions=points=>points.map(p=>`${p.x},${p.y}`).sort();
const outcome=s=>s.dead?'dead':s.failed?'refused':s.complete?'won':'legal';
const snapshot=(world,state)=>({
  heroes:state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),
  stones:state.stones,supports:state.supports,monsters:state.monsters,mirrors:state.mirrors,
  circuits:Object.fromEntries(world.circuits.map(c=>[c.id,circuitPressed(world,state,c.id)])),
  gates:world.gates.map((g,i)=>({at:g.at,closed:gateClosed(world,state,i)})),
  complete:state.complete,refused:state.failed,dead:state.dead
});

function load(level){
  const design=JSON.parse(readFileSync(new URL(`reference/level${level}-design.json`,root),'utf8'));
  const route=replay(design.spec,design.commands),world=compileLevel(design.spec);
  assert.ok(route.state.complete);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
  assert.deepEqual(route.actions,design.actions);assert.deepEqual(route.metrics,design.metrics);
  const stateAt=turn=>turn?route.trace[turn-1].after:initialState(world);
  for(const stage of design.stages){
    const s=stateAt(stage.turn);
    assert.deepEqual(stage.heroes,s.heroes.map(h=>({kind:h.kind,at:h.at})));
    for(const key of ['stones','supports','monsters','mirrors'])assert.deepEqual(stage[key],s[key]);
    assert.deepEqual(stage.circuits,snapshot(world,s).circuits);
  }
  return{level,design,route,world,stateAt};
}

function branch(context,label,afterTurn,commands,meaning){
  let state=context.stateAt(afterTurn);const steps=[];
  for(const [index,command] of [...commands].entries()){
    const a=decodeCommand(command,state),detail=stepDetailed(context.world,state,a.id,a.data);
    state=detail.state;
    steps.push({turn:index+1,command,outcome:outcome(state),phases:detail.phases.map(p=>p.kind)});
    if(state.dead||state.failed||state.complete)break;
  }
  return{label,afterTurn,commands,executedCommands:steps.map(s=>s.command).join(''),meaning,
    outcome:outcome(state),refusedTurns:steps.filter(s=>s.outcome==='refused').map(s=>s.turn),
    deadTurns:steps.filter(s=>s.outcome==='dead').map(s=>s.turn),
    steps,state:snapshot(context.world,state)};
}

function authorBranches(context){
  return context.design.adaptation.localCounterfactuals.map(saved=>{
    const actual=branch(context,saved.label,saved.afterTurn,saved.commands,saved.meaning);
    assert.equal(actual.executedCommands,saved.commands,`${saved.label}: no hidden earlier refusal or death`);
    for(const key of ['stones','supports','monsters','mirrors'])if(key in saved)assert.deepEqual(actual.state[key],saved[key]);
    assert.deepEqual(actual.state.heroes,saved.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})));
    assert.deepEqual(actual.state.circuits,saved.circuits);
    for(const key of ['refused','dead','complete'])assert.equal(actual.state[key],saved[key]);
    return actual;
  });
}

/** Floor component containing the goals when the final entrance is blocked.
 * This is a map audit, not a claim that every game transition is a walk.
 */
function goalChamber(world,gateIndex){
  const blocked=world.gates[gateIndex].at,start=world.goals[0],queue=[start],seen=new Set([start.y*20+start.x]);
  for(let head=0;head<queue.length;head++)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
    const p={x:queue[head].x+dx,y:queue[head].y+dy},key=p.y*20+p.x;
    if(p.x<0||p.y<0||p.x>=20||p.y>=20||same(p,blocked)||world.terrain[key]!=='.'||seen.has(key))continue;
    seen.add(key);queue.push(p);
  }
  assert.ok(world.goals.every(p=>seen.has(p.y*20+p.x)));
  const initial=initialState(world),occupants=[...initial.heroes.map(h=>h.at),...initial.stones,...initial.monsters];
  assert.equal(occupants.filter(p=>seen.has(p.y*20+p.x)).length,0,'The final room starts without a swap target');
  assert.equal(initial.mirrors.filter(m=>seen.has(m.at.y*20+m.at.x)).length,0);
  const frontier=[];
  for(const p of queue)for(const [dx,dy]of[[0,-1],[0,1],[-1,0],[1,0]]){
    const q={x:p.x+dx,y:p.y+dy};
    if(q.x>=0&&q.y>=0&&q.x<20&&q.y<20&&world.terrain[q.y*20+q.x]==='.'&&!seen.has(q.y*20+q.x)&&!frontier.some(f=>same(f,q)))frontier.push(q);
  }
  assert.deepEqual(frontier,[blocked],'One floor entrance connects the final room');
  return{inside:p=>seen.has(p.y*20+p.x),audit:{floorCells:queue.length,goals:world.goals,entrance:blocked,
    initialMobileOccupants:0,initialMirrors:0,walkingFrontier:frontier,
    scope:'Static floor connectivity with this entrance closed; teleportation is tested separately.'}};
}

/** Enumerate ordinary approaches with one selected hero and unchanged cargo,
 * supports, mirrors and partner, then execute all four directions and ACTION5.
 * Refused and fatal probes are recorded separately. The approach family is
 * deliberately limited; exhausting it is not an exhaustive game proof.
 */
function directAccess(context,afterTurn,gateIndex,chamber,{maxMs=3000,maxStates=1500}={}){
  const started=performance.now(),counts={legal:0,refused:0,dead:0,won:0};
  const approaches=[],entries=[],examples={};let limited=false;
  for(const kind of ['wizard','bard']){
    let start=context.stateAt(afterTurn),selection='';
    assert.equal(gateClosed(context.world,start,gateIndex),true);
    if(start.heroes[start.active].kind!==kind){const a=decodeCommand('C',start);start=stepDetailed(context.world,start,a.id,a.data).state;selection='C';}
    const frozen=s=>JSON.stringify({partner:s.heroes.find(h=>h.kind!==kind).at,stones:positions(s.stones),monsters:positions(s.monsters),supports:positions(s.supports),mirrors:s.mirrors});
    const signature=frozen(start),queue=[{state:start,commands:selection}],seen=new Set([stateKey(start)]);let expanded=0;
    for(let head=0;head<queue.length;head++){
      if(performance.now()-started>=maxMs||seen.size>=maxStates){limited=true;break;}
      const node=queue[head];expanded++;
      for(const command of 'UDLRX'){
        const a=decodeCommand(command,node.state),d=stepDetailed(context.world,node.state,a.id,a.data),next=d.state,status=outcome(next);
        counts[status]++;
        if(!examples[status])examples[status]={selected:kind,commands:node.commands+command,phases:d.phases.map(p=>p.kind),state:snapshot(context.world,next)};
        if(status==='dead'||status==='refused')continue;
        if(next.heroes.some(h=>!h.dead&&chamber.inside(h.at)))entries.push({selected:kind,commands:node.commands+command,phases:d.phases.map(p=>p.kind),entranceClosed:gateClosed(context.world,next,gateIndex),state:snapshot(context.world,next)});
        if(command==='X'||next.complete||!gateClosed(context.world,next,gateIndex)||frozen(next)!==signature||d.phases.some(p=>!['walk','gate','platform'].includes(p.kind)))continue;
        const key=stateKey(next);if(seen.has(key))continue;seen.add(key);queue.push({state:next,commands:node.commands+command});
      }
    }
    approaches.push({hero:kind,states:seen.size,expanded});
    if(limited)break;
  }
  return{afterTurn,status:limited?'limit-inconclusive':'local-family-exhausted',maxMs,maxStates,elapsedMs:Math.round(performance.now()-started),approaches,probes:counts,examples,entries,
    interpretation:limited?'The limit cannot establish absence of a shortcut.':'No entry found in this explicitly restricted family of direct approaches; this is not a global necessity proof.'};
}

function reviewSeven(c){
  const {route,design,stateAt}=c,branches=authorBranches(c),stages=design.stages;
  assert.equal(stages.length,9);
  assert.ok(route.trace.every(t=>t.after.supports.length===1));assert.equal(route.metrics.platformsCreated,0);
  const supportRoute=[0,...stages.map(s=>s.turn)].map(turn=>({turn,supports:stateAt(turn).supports}));
  for(const point of [[5,10],[10,8],[10,5],[12,10]])assert.ok(supportRoute.some(s=>s.supports.some(p=>at(p,...point))));
  const reflection=route.trace[stages[4].turn-1];assert.equal(reflection.command,'X');
  assert.deepEqual(reflection.phases.map(p=>p.kind),['reflect','piston','gate']);
  assert.deepEqual(reflection.phases[0].moves,[{actor:'stone',from:{x:2,y:5},to:{x:5,y:2}},{actor:'hero',from:{x:15,y:5},to:{x:13,y:7}}]);
  assert.deepEqual(reflection.phases[1].moves,[{actor:'mirror',from:{x:5,y:5},to:{x:5,y:6}}]);
  for(const t of route.trace.slice(stages[4].turn-1)){
    assert.ok(t.after.stones.some(p=>at(p,5,2)));assert.ok(t.after.mirrors.some(m=>at(m.at,5,6)));
    assert.equal(circuitPressed(c.world,t.after,'deux-poids'),true);
  }
  const legalImport=branch(c,'west-bank-import-before-moving-the-support',stages[0].turn,'RRRURRRUR',
    'Legal local alternative: extract the crate from the western bank before moving the support toward the eastern bank. It does not by itself rescue the Wizard or fill the final commands.');
  assert.equal(legalImport.outcome,'legal');assert.ok(legalImport.state.stones.some(p=>at(p,6,5)));assert.deepEqual(legalImport.state.supports,[{x:5,y:10}]);
  const inverse=branch(c,'reverse-the-extraction',stages[2].turn,'L','The trapped Wizard can reverse his own substitution. This returns the dry crate to its reserve; it is a legal retreat, not a successful rescue retaining the extracted crate.');
  assert.equal(inverse.outcome,'legal');assert.ok(inverse.state.stones.some(p=>at(p,15,5)));
  const safeDeparture=branch(c,'leave-the-yellow-command-along-its-wall',stages[3].turn,'UX','A northward Bard step is legal: the wall holds the crate on the command, and the subsequent double reflection still succeeds.');
  assert.equal(safeDeparture.outcome,'legal');assert.ok(safeDeparture.state.stones.some(p=>at(p,5,2)));assert.equal(safeDeparture.state.circuits['deux-poids'],true);
  const misplaced=branches.find(b=>b.label==='bard-arrival-moves-the-wizard-off-his-goal');
  const corrected=branch(c,'correct-the-legal-alternate-goal-order',misplaced.afterTurn,misplaced.commands+'CUL','The alternate goal order is not a dead end: selecting the Wizard and walking up/left repairs the displacement and wins.');
  assert.equal(corrected.outcome,'won');
  const chamber=goalChamber(c.world,2),direct=[0,stages[0].turn,stages[2].turn,stages[3].turn].map(turn=>directAccess(c,turn,2,chamber));
  assert.ok(direct.every(result=>!result.entries.length),'A direct final-chamber entry needs review');
  return{level:7,title:design.spec.title,mapSha256:hash(design.spec),witnessSha256:hash(design.actions),witnessActions:design.actions.length,
    constraints:[
      {id:'one-support-reused',result:'verified-on-witness',evidence:supportRoute,interpretation:'One permanent support is reused along the three recorded water arms; no extra crate is sunk by this witness. The west-bank import alternative shows that the order of every crossing is not mandatory.'},
      {id:'rescue-needs-a-prepared-line',result:'verified-locally',branches:['rescue-before-its-command','reverse-the-extraction'],interpretation:'ACTION5 is refused before its command is weighted; reversing the extraction remains legal and restores the original reserve.'},
      {id:'double-reflection-then-mirror-press',result:'verified-on-witness',turn:stages[4].turn,phases:reflection.phases.map(p=>({kind:p.kind,moves:p.moves})),branches:['press-before-the-double-reflection','leave-the-yellow-command-along-its-wall']},
      {id:'dry-crate-and-mirror-stay-as-final-weights',result:'verified-on-witness-and-branches',retainedFromTurn:stages[4].turn,finalState:snapshot(c.world,route.state),branches:['ordinary-departure-loses-the-only-dry-weight','shift-the-ferry-before-the-wizard','correct-the-legal-alternate-goal-order']},
      {id:'final-room-direct-access',result:'no-entry-in-tested-local-families',geometry:chamber.audit,checks:direct}
    ],branches:[...branches,legalImport,inverse,safeDeparture,corrected],
    legalAlternatives:['Western extraction before moving the support','Reverse the extraction to recover the original position','Northward Bard departure held by the wall before the double reflection','Alternate goal order followed by a three-input repair']};
}

function bankCounts(state){
  const counts={west:0,river:0,east:0};
  for(const p of [...state.heroes.filter(h=>!h.dead).map(h=>h.at),...state.stones,...state.monsters])counts[p.x<=8?'west':p.x>=11?'east':'river']++;
  return counts;
}

function reviewEight(c){
  const {route,design,stateAt}=c,branches=authorBranches(c),stages=design.stages;
  assert.equal(stages.length,11);
  const swaps=[],transfers=[],immersions=[];
  const bank=p=>p.x<=8?'west':p.x>=11?'east':'river';
  for(const [index,t]of route.trace.entries())for(const p of t.phases){
    if(p.kind==='swap'){
      const before=bankCounts(p.before),after=bankCounts(p.after);assert.deepEqual(after,before);
      swaps.push({turn:index+1,before,after,moves:p.moves});
    }else for(const m of p.moves)if(['hero','stone','monster'].includes(m.actor)&&bank(m.from)!==bank(m.to))transfers.push({turn:index+1,phase:p.kind,...m});
    if(p.after.stones.length<p.before.stones.length&&p.after.supports.length>p.before.supports.length)immersions.push({turn:index+1,phase:p.kind,removedDryCrates:p.before.stones.length-p.after.stones.length,createdSupports:p.after.supports.length-p.before.supports.length});
  }
  assert.equal(swaps.length,4);assert.equal(immersions.length,1);assert.equal(immersions[0].phase,'piston');
  const cargoImports=transfers.filter(m=>m.actor==='stone'&&m.from.x===10&&m.to.x===11);
  assert.equal(cargoImports.length,1);assert.equal(cargoImports[0].phase,'song');
  assert.deepEqual(bankCounts(stateAt(0)),{west:5,river:0,east:1});assert.deepEqual(bankCounts(route.state),{west:2,river:0,east:3});
  const sunkAt=stages[4].turn,transportedAt=stages[5].turn,placedAt=stages[6].turn,openAt=stages[8].turn;
  assert.deepEqual(positions(stateAt(sunkAt).supports),['10,14','9,14']);
  assert.deepEqual(positions(stateAt(transportedAt).supports),['10,13','9,13']);
  assert.deepEqual(positions(stateAt(placedAt).supports),['10,13','9,13']);
  const doubleBend=route.trace[stages[7].turn-1].phases.find(p=>p.kind==='swap');assert.ok(doubleBend);
  assert.equal(doubleBend.paths[0].filter(p=>doubleBend.before.mirrors.some(m=>same(m.at,p))).length,2);
  for(const t of route.trace.slice(openAt-1)){
    assert.deepEqual(positions(t.after.monsters),['3,7','7,7']);assert.deepEqual(t.after.stones,[{x:14,y:4}]);
    assert.equal(circuitPressed(c.world,t.after,'accord-final'),true);assert.equal(circuitPressed(c.world,t.after,'premier-choeur'),false);
  }
  const repair=branch(c,'repair-the-voluntary-final-choir-departure',openAt,'DU','The southward departure closes the chamber but remains reversible: the next northward song restores both living weights and reopens it.');
  assert.equal(repair.outcome,'legal');assert.deepEqual(repair.state.monsters,stateAt(openAt).monsters);assert.equal(repair.state.circuits['accord-final'],true);
  const chamber=goalChamber(c.world,1),direct=[0,stages[0].turn,stages[2].turn,stages[6].turn,stages[7].turn].map(turn=>directAccess(c,turn,1,chamber));
  assert.ok(direct.every(result=>!result.entries.length),'A direct final-chamber entry needs review');
  return{level:8,title:design.spec.title,mapSha256:hash(design.spec),witnessSha256:hash(design.actions),witnessActions:design.actions.length,
    constraints:[
      {id:'substitutions-preserve-bank-counts',result:'verified-on-all-witness-swaps',definition:'Living heroes, dry crates and monsters; west x≤8, river x9–10, east x≥11. Supports and fixed mirrors excluded.',initial:bankCounts(stateAt(0)),final:bankCounts(route.state),swaps,physicalTransfers:transfers,immersions,interpretation:'Every executed substitution preserves the count in each region. Walking/song changes these counts, and the deliberate immersion removes one dry occupant.'},
      {id:'loaded-press-creates-the-second-support',result:'verified-on-witness-and-local-branches',turn:sunkAt,createdSupports:stateAt(sunkAt).supports,branches:['ordinary-loading-exit-moves-cargo-and-support','unload-the-command-before-loading-the-press'],interpretation:'Closing the prepared press sinks its loaded crate. Closing it empty is legal and creates no support.'},
      {id:'dry-cargo-crosses-while-return-supports-are-preserved',result:'verified-on-witness-and-local-branch',cargoImports,supportsAtDelivery:stateAt(placedAt).supports,branches:['straight-delivery-carries-away-the-return-support','wrong-final-exit-realigns-the-bridge-with-the-closed-press']},
      {id:'living-weights-and-dry-cargo-retained',result:'verified-on-witness-and-local-branches',openFromTurn:openAt,twoBendSwapTurn:stages[7].turn,twoBendMoves:doubleBend.moves,finalState:snapshot(c.world,route.state),branches:['walking-away-withdraws-the-first-bridge','global-reflection-is-not-the-two-bend-spell','ordinary-final-exit-removes-the-living-weights','straight-ray-selects-the-guard-before-the-bard','repair-the-voluntary-final-choir-departure']},
      {id:'final-room-direct-access',result:'no-entry-in-tested-local-families',geometry:chamber.audit,checks:direct}
    ],branches:[...branches,repair],legalAlternatives:['An early empty-press closure can be prepared again','Direct cargo delivery is legal but moves a return support','A voluntary departure from the final choir can be reversed with an opposite step']};
}

const report={success:false,scope:'Independent execution of two final-room witnesses, local counterfactuals, bank counts and bounded direct-access families',levels:[],limits:[
  'Five constraints per finale are reviewed. Witness execution is evidence of one route, not minimum length, uniqueness or global ability necessity.',
  'Branch outcomes distinguish legal moves, refused inputs and hero deaths. A legal non-winning branch is not declared a dead end.',
  'Each direct-access case has a 3000 ms and 1500-state limit. A limit is explicitly inconclusive.',
  'Direct-access enumeration fixes cargo, supports, mirrors and the partner during the approach, then executes one real ray, reflection or step. Exhaustion applies only to this stated local family.',
  'No game rule, map, witness, UI or core is modified by this review.'
]};
try{
  report.levels=[reviewSeven(load(7)),reviewEight(load(8))];
  const branches=report.levels.flatMap(l=>l.branches),direct=report.levels.flatMap(l=>l.constraints.find(c=>c.id==='final-room-direct-access').checks);
  report.totals={constraints:report.levels.reduce((n,l)=>n+l.constraints.length,0),branches:branches.length,
    branchOutcomes:Object.fromEntries(['legal','refused','dead','won'].map(key=>[key,branches.filter(b=>b.outcome===key).length])),
    directAccessCases:direct.length,limitedDirectAccessCases:direct.filter(d=>d.status==='limit-inconclusive').length,
    directProbes:Object.fromEntries(['legal','refused','dead','won'].map(key=>[key,direct.reduce((n,d)=>n+d.probes[key],0)])),
    directChamberEntries:direct.reduce((n,d)=>n+d.entries.length,0)};
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
mkdirSync(new URL('validation/',root),{recursive:true});
writeFileSync(new URL('validation/design-constraints-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,totals:report.totals,error:report.error,levels:report.levels.map(l=>({level:l.level,title:l.title,actions:l.witnessActions,constraints:l.constraints.length,branches:l.branches.length}))},null,2));
