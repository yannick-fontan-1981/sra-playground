/** Author-only difficulty evidence. Never imported by the game or SRA runtime. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive,traceSwap,planReflection,equal} from '../dist/core.js';
import {replay,decodeCommand,solve} from './solver.mjs';
import {Author} from '../reference/author/author.mjs';

const BASELINE_COMMIT='61b8d970f30ead54480721c9c080aeb02372a2cc';
const lab=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=p=>`${p.x},${p.y}`;
const sources=[],checks=[],scopeChecks=[],searches=[];
function baselineBytes(path){return execFileSync('git',['show',`${BASELINE_COMMIT}:experiments/sinking-star-ss13/${path}`],{cwd:lab,maxBuffer:8*1024*1024});}
function load(n,baseline=false){
 const path=`reference/level${n}-design.json`,bytes=baseline?baselineBytes(path):readFileSync(new URL(`../${path}`,import.meta.url)),data=JSON.parse(bytes);
 sources.push({level:n,revision:baseline?BASELINE_COMMIT:'working-tree',path,sha256:hash(bytes)});
 const full=replay(data.spec,data.commands);
 assert.ok(full.state.complete&&!full.metrics.blocked&&!full.metrics.deaths,`L${n} clean winning route (${baseline?'baseline':'new'})`);
 return {...data,level:n,world:full.world,full};
}
const prefix=(d,turn)=>replay(d.spec,d.commands.slice(0,turn)).state;
const stage=(d,index)=>prefix(d,d.stages[index].turn);
function act(d,s,c){const a=decodeCommand(c,s);return stepDetailed(d.world,s,a.id,a.data);}
const good=r=>!r.state.failed&&!r.state.dead;
const moved=(r,actor)=>r.phases.flatMap(p=>p.moves).filter(m=>m.actor===actor);
function stateSummary(d,s){return{heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),active:s.heroes[s.active].kind,stones:s.stones,mirrors:s.mirrors,monsters:s.monsters,supports:s.supports,circuits:Object.fromEntries(d.world.circuits.map(c=>[c.id,circuitPressed(d.world,s,c.id)])),gateClosed:s.gateClosed??[],platformActive:s.platformActive??[],complete:s.complete,dead:s.dead,refused:s.failed};}
function outcome(d,r){return {...stateSummary(d,r.state),phases:r.phases.map(p=>p.kind),moves:r.phases.flatMap(p=>p.moves)};}
function check(id,level,claim,condition,evidence){assert.ok(condition,id);checks.push({id,level,claim,status:'PASS',evidence});}
function resourceProfile(d){
 const entities=[...d.world.stones.map((at,i)=>({id:`crate-${i+1}`,actor:'stone',initialAt:at,at,motions:[],buttonVisits:[],uses:[]})),
  ...d.world.mirrors.map((m,i)=>({id:`mirror-${i+1}`,actor:'mirror',initialAt:m.at,at:m.at,motions:[],buttonVisits:[],uses:[]}))];
 const recordButtons=(state,turn)=>{
  for(const e of entities){
   const buttons=e.at?d.world.circuits.flatMap(c=>c.buttons.filter(p=>equal(p,e.at)).map(at=>({circuit:c.id,at}))):[];
   for(const b of buttons){const last=e.buttonVisits.at(-1);if(last&&last.circuit===b.circuit&&equal(last.at,b.at)&&last.lastTurn>=turn-1)last.lastTurn=turn;else e.buttonVisits.push({...b,firstTurn:turn,lastTurn:turn});}
  }
 };
 recordButtons(initialState(d.world),0);
 for(const [i,t] of d.full.trace.entries()){
  const turn=i+1;
  if(t.phases.some(p=>p.kind==='swap')){
   const p=traceSwap(d.world,t.before,({U:'N',D:'S',L:'W',R:'E'})[t.command]).plan;
   for(const e of entities)if(e.actor==='mirror'&&e.at&&p.path.some(at=>equal(at,e.at)))e.uses.push({turn,kind:'bent-ray',at:e.at});
  }
  if(t.phases.some(p=>p.kind==='reflect')){
   const plan=planReflection(d.world,t.before);
   for(const index of plan.mirrorIndices){const at=t.before.mirrors[index].at,e=entities.find(e=>e.actor==='mirror'&&e.at&&equal(e.at,at));if(e)e.uses.push({turn,kind:'reflection',at:e.at});}
  }
  for(const p of t.phases){
   const updates=p.moves.map(m=>({move:m,entity:entities.find(e=>e.actor===m.actor&&e.at&&equal(e.at,m.from))})).filter(x=>x.entity);
   for(const {entity:e,move:m} of updates){e.at=m.to;e.motions.push({turn,kind:p.kind,from:m.from,to:m.to});}
   for(const e of entities){
    if(!e.at)continue;
    const present=e.actor==='stone'?p.after.stones.some(at=>equal(at,e.at)):p.after.mirrors.some(m=>equal(m.at,e.at));
    if(!present){e.removed={turn,at:e.at,kind:e.actor==='stone'&&p.after.supports.some(at=>equal(at,e.at))?'submerged-support':'removed'};e.at=null;}
   }
  }
  recordButtons(t.after,turn);
 }
 return entities.map(e=>({...e,workingPositions:[...new Set(e.uses.map(u=>key(u.at)))].length,
  usedAsWeightBeforeImmersion:e.removed?.kind==='submerged-support'&&e.buttonVisits.some(v=>v.firstTurn<e.removed.turn)}));
}
function profile(d){
 const {world,full}=d,events=[],circuitTransitions=[],supportEvents=[],casts=[],pullsByCargo={hero:0,stone:0,mirror:0,monster:0};
 let toolInputs=0,toolEpisodes=0,lastPull=null;
 for(const [i,t] of full.trace.entries()){
  const turn=i+1,toolPhases=t.phases.filter(p=>['pull','swap','reflect','piston','crush'].includes(p.kind));
  const transitions=world.circuits.flatMap(c=>{const before=circuitPressed(world,t.before,c.id),after=circuitPressed(world,t.after,c.id);return before===after?[]:[{turn,circuit:c.id,before,after}];});
  circuitTransitions.push(...transitions);
  const added=t.after.supports.filter(p=>!t.before.supports.some(q=>equal(p,q)));
  if(added.length)supportEvents.push({turn,cells:added});
  if(toolPhases.length){
   toolInputs++;
   const pull=toolPhases.length===1&&toolPhases[0].kind==='pull'?toolPhases[0]:null;
   const signature=pull?`${t.command}:${pull.moves.filter(m=>!(m.actor==='hero'&&equal(m.from,t.before.heroes[t.before.active].at))).map(m=>m.actor).sort().join(',')}`:null;
   if(!signature||signature!==lastPull||transitions.length)toolEpisodes++;
   lastPull=signature;
  }else lastPull=null;
  for(const p of t.phases.filter(p=>p.kind==='pull'))for(const m of p.moves)if(!(m.actor==='hero'&&equal(m.from,t.before.heroes[t.before.active].at)))pullsByCargo[m.actor]++;
  if(t.phases.some(p=>p.kind==='swap')){
   const plan=traceSwap(world,t.before,({U:'N',D:'S',L:'W',R:'E'})[t.command]).plan;
   assert.ok(plan,'Recorded swap has an inspectable ray');casts.push({turn,target:plan.target,reflections:plan.reflections,from:plan.from,to:plan.to});
  }
  if(toolPhases.length||transitions.length||added.length)events.push({turn,command:t.command,phases:t.phases.map(p=>p.kind),moves:t.phases.flatMap(p=>p.moves),circuits:transitions,newSupports:added});
 }
 return {title:d.spec.title,metrics:full.metrics,toolInputs,toolEpisodes,pullsByCargo,bentCasts:casts.filter(c=>c.reflections>0).length,circuitTransitionCount:circuitTransitions.length,
  layout:{crates:world.stones.length,mirrors:world.mirrors.length,monsters:world.monsters.length,circuits:world.circuits.length,buttons:world.circuits.reduce((n,c)=>n+c.buttons.length,0),gates:world.gates.length,hydraulicPlatforms:world.platforms.length},
  stages:d.stages,casts,circuitTransitions,supportEvents,resources:resourceProfile(d),events};
}
function search(d,label,fromTurn,options){
 const result=solve(d.spec,{start:prefix(d,fromTurn),maxStates:12000,maxMs:1000,...options});
 const record={level:d.level,label,fromTurn,remainingAuthorInputs:d.commands.length-fromTurn,limits:{maxStates:12000,maxMs:1000},forbidden:Object.keys(options).filter(k=>k.startsWith('disable')&&options[k]),status:result.status,states:result.states,expanded:result.expanded,ms:result.ms};
 if(result.commands!==undefined){record.commands=result.commands;record.actions=result.commands.length;}
 record.interpretation=result.status==='limit'?'Inconclusive: the bounded search did not settle reachability.':result.status==='unsolvable'?'The explored finite state graph is exhausted under these restrictions.':'A valid alternate route was found under these restrictions; inspect it before claiming this mechanic is necessary.';
 searches.push(record);return result;
}
for(const path of ['src/core.ts','src/browser.ts','src/tutorial.ts',...Array.from({length:6},(_,i)=>`reference/level${i+1}-design.json`)]){
 const before=baselineBytes(path),after=readFileSync(new URL(`../${path}`,import.meta.url));
 assert.equal(hash(after),hash(before),`Out-of-scope file changed: ${path}`);
 scopeChecks.push({path,baselineCommit:BASELINE_COMMIT,sha256:hash(after),status:'UNCHANGED'});
}
const old7=load(7,true),old8=load(8,true),l7=load(7),l8=load(8);
const comparisons=[{level:7,before:profile(old7),after:profile(l7)},{level:8,before:profile(old8),after:profile(l8)}];

function branch(d,fromTurn,commands){
 let state=prefix(d,fromTurn),last;
 const before=state;
 for(const [i,c] of [...commands].entries()){
  assert.ok(!state.dead&&!state.complete,`Counterfactual reached a terminal state before input ${i+1}`);
  last=act(d,state,c);state=last.state;
  if(i<commands.length-1)assert.ok(!state.failed&&!state.dead,`Counterfactual setup failed at input ${i+1}`);
 }
 return {...last,fromTurn,commands,before};
}
const branchEvidence=(d,r)=>({fromTurn:r.fromTurn,commands:r.commands,before:stateSummary(d,r.before),after:outcome(d,r)});
const has=(points,x,y)=>points.some(p=>p.x===x&&p.y===y);
const actor=(s,kind)=>s.heroes.find(h=>h.kind===kind);
function authorAt(d,turn){const a=new Author(d.spec);a.act(d.commands.slice(0,turn));return a;}

// The authored probes provide reproducible reachable setups. The audit evaluates
// their outcomes independently, rather than trusting their stored observations.
const c7=l7.localCounterfactuals;
const closedPress=branch(l7,c7.releasePressBeforeSecondReflection.startTurn,c7.releasePressBeforeSecondReflection.commands);
check('l7-releasing-press-blocks-the-next-reflection',7,
 'At the documented second-mirror setup, releasing the press closes the optical path and refuses the second reflection.',
 closedPress.state.failed&&!closedPress.state.dead&&!circuitPressed(l7.world,closedPress.state,'presse')&&closedPress.state.supports.length===1&&stage(l7,3).supports.length===2,
 branchEvidence(l7,closedPress));
const earlyAnchor=branch(l7,c7.removeAnchorBeforeMirrorCrossing.startTurn,c7.removeAnchorBeforeMirrorCrossing.commands);
check('l7-early-anchor-removal-blocks-mirror-crossing',7,
 'Removing the southern weight before this mirror crossing retracts the northern landing; the attempted traction is refused.',
 earlyAnchor.state.failed&&!earlyAnchor.state.dead&&!circuitPressed(l7.world,earlyAnchor.state,'amarre')&&equal(actor(earlyAnchor.state,'thief').at,{x:5,y:6})&&earlyAnchor.state.mirrors.some(m=>equal(m.at,{x:5,y:7})),
 branchEvidence(l7,earlyAnchor));
const missingThird=branch(l7,c7.skipThirdSupportBeforeMirrorTransport.startTurn,c7.skipThirdSupportBeforeMirrorTransport.commands);
check('l7-mirror-cannot-be-hauled-over-unfilled-third-gap',7,
 'With the third reflection omitted at this setup, the mirror haul stops before the eastern gap; the observed winning route fills this gap first.',
 missingThird.state.failed&&!missingThird.state.dead&&!has(missingThird.state.supports,15,4)&&equal(actor(missingThird.state,'thief').at,{x:14,y:4})&&stage(l7,8).mirrors.some(m=>equal(m.at,{x:17,y:6})),
 branchEvidence(l7,missingThird));
const unclearedRay=branch(l7,c7.leaveAnchorBeforeClearingCast.startTurn,c7.leaveAnchorBeforeClearingCast.commands);
check('l7-first-target-returns-the-recovered-weight',7,
 'Attempting to leave the southern command before clearing the recovered crate makes the Wizard swap with that same first target and restores the crate to the southern button.',
 good(unclearedRay)&&unclearedRay.phases.some(p=>p.kind==='swap')&&has(unclearedRay.state.stones,3,17)&&circuitPressed(l7.world,unclearedRay.state,'amarre')&&!circuitPressed(l7.world,stage(l7,12),'amarre'),
 branchEvidence(l7,unclearedRay));
const manualPress=branch(l7,c7.walkInsteadOfPiston.startTurn,c7.walkInsteadOfPiston.commands);
const press7=l7.full.trace.find(t=>t.phases.some(p=>p.kind==='piston'));
const pressLanding=l7.world.platforms.findIndex(p=>equal(p.at,{x:10,y:10}));
check('l7-forced-press-activates-its-own-landing',7,
 'From the loaded press, a voluntary east step is refused. The witnessed remote release instead pushes the crate and Thief together and activates the Thief’s landing in the same cascade.',
 manualPress.state.failed&&!manualPress.state.dead&&press7&&press7.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero')&&p.moves.some(m=>m.actor==='stone'))&&
 !press7.phases.some(p=>p.kind==='pull')&&!platformActive(l7.world,press7.before,pressLanding)&&platformActive(l7.world,press7.after,pressLanding)&&!press7.after.dead,
 {manual:branchEvidence(l7,manualPress),successful:{turn:l7.full.trace.indexOf(press7)+1,before:stateSummary(l7,press7.before),after:outcome(l7,{state:press7.after,phases:press7.phases})}});

// Independent resource-substitution regression: the first draft had a clean
// 89-input WIN by using the northern crate as the final weight. Reconstruct the
// same allocation on the revised geometry, instead of only replaying an obsolete
// movement string that could fail for an unrelated changed wall.
const substituted=authorAt(l7,l7.stages[4].turn);
substituted.go(5,2,'thief').go(9,1,'wizard').go(12,2,'thief').act('D').go(11,2).act('LLL').select('wizard').act('D').go(5,2,'thief');
const substitutionEntry=act(l7,substituted.state,'L');
check('l7-northern-crate-alone-no-longer-opens-the-chamber',7,
 'The previously winning allocation—northern crate on the northern seal, southern weight retained, only two supports—now leaves the second seal empty and the inner opposed gate closed; entry is refused.',
 has(substituted.state.stones,9,1)&&has(substituted.state.stones,3,17)&&substituted.state.supports.length===2&&!circuitPressed(l7.world,substituted.state,'sceau')&&
 circuitPressed(l7.world,substituted.state,'amarre')&&substitutionEntry.state.failed&&!substitutionEntry.state.dead,
 {previousDraftBypass:{inputs:89,newSupports:2,pistonPushes:0,scope:'Verified on the first working draft, not on the released baseline.'},setupCommands:substituted.commands,before:stateSummary(l7,substituted.state),attempt:'L',after:outcome(l7,substitutionEntry)});

const c8=Object.fromEntries(l8.adaptation.localCounterfactuals.map(c=>[c.label,c]));
function probe8(label){const c=c8[label];assert.ok(c,`Missing L8 probe ${label}`);return branch(l8,c.afterTurn,c.commands);}
const nearTarget=probe8('near-target-is-fatal');
check('l8-near-target-cannot-be-skipped',8,
 'An immediate east cast reaches the guarded near crate and kills the Wizard; the first target cannot be skipped.',
 nearTarget.state.dead&&actor(nearTarget.state,'wizard').dead&&equal(actor(nearTarget.state,'wizard').at,{x:6,y:10}),branchEvidence(l8,nearTarget));
const earlyMirror=probe8('early-mirror-extraction-refused');
check('l8-early-left-mirror-extraction-is-refused',8,
 'After its first adjustment, the left mirror cannot be hauled again before the hydraulic extraction landing is active.',
 earlyMirror.state.failed&&!earlyMirror.state.dead&&!circuitPressed(l8.world,earlyMirror.state,'ancre-vivante')&&earlyMirror.state.mirrors.some(m=>equal(m.at,{x:8,y:15})),branchEvidence(l8,earlyMirror));
const leaveArrival=probe8('arrival-weight-cannot-leave-first');
check('l8-arrival-weight-must-outlast-the-landing',8,
 'If the Wizard leaves the temporary command while the Thief is still on its arrival platform, the Thief falls.',
 leaveArrival.state.dead&&actor(leaveArrival.state,'thief').dead&&equal(actor(leaveArrival.state,'thief').at,{x:16,y:15})&&!circuitPressed(l8.world,leaveArrival.state,'ancre-vivante'),branchEvidence(l8,leaveArrival));
const mirrorSubstitution=probe8('mirror-is-not-a-free-final-weight');
check('l8-local-mirror-weight-substitution-is-fatal',8,
 'Dragging the right mirror directly onto the final living-anchor command in this setup places the Thief adjacent to the guard and kills him.',
 mirrorSubstitution.state.dead&&actor(mirrorSubstitution.state,'thief').dead&&equal(actor(mirrorSubstitution.state,'thief').at,{x:14,y:9})&&mirrorSubstitution.state.mirrors.some(m=>equal(m.at,{x:14,y:8}))&&has(mirrorSubstitution.state.monsters,14,10),branchEvidence(l8,mirrorSubstitution));
const prematureImmersion=probe8('premature-bridge-immersion');
check('l8-premature-return-release-consumes-the-cargo',8,
 'Recovering the return mirror while the cargo remains on the bridge irreversibly converts that cargo to a fixed support at the wrong site, without killing a hero.',
 good(prematureImmersion)&&has(prematureImmersion.state.supports,10,12)&&!has(prematureImmersion.state.stones,10,12)&&!has(prematureImmersion.state.supports,15,6)&&!circuitPressed(l8.world,prematureImmersion.state,'retour'),branchEvidence(l8,prematureImmersion));
const wrongDistance=probe8('wrong-second-reflection-distance');
check('l8-second-reflection-needs-the-correct-distance',8,
 'Being nearer than the monster is insufficient: reflecting from the documented uncorrected distance sends the Wizard into water.',
 wrongDistance.state.dead&&actor(wrongDistance.state,'wizard').dead&&equal(actor(wrongDistance.state,'wizard').at,{x:10,y:4})&&!stage(l8,19).dead,branchEvidence(l8,wrongDistance));
const unprotectedMonster=probe8('unprotected-final-reflection-loses-monster');
check('l8-unshielded-reflection-destroys-the-living-weight',8,
 'Leaving the second mirror’s ray entirely before reflection makes its farther monster become the first target; the valid reflection destroys that living command weight in water.',
 good(unprotectedMonster)&&unprotectedMonster.state.monsters.length===1&&!has(unprotectedMonster.state.monsters,14,10)&&!circuitPressed(l8.world,unprotectedMonster.state,'ancre-vivante'),branchEvidence(l8,unprotectedMonster));

const lostExtraction=probe8('extraction-weight-cannot-leave-first');
check('l8-extraction-weight-must-outlast-the-haul',8,
 'Leaving the command during the actual mirror haul withdraws the platform under the Thief before extraction is complete.',
 lostExtraction.state.dead&&actor(lostExtraction.state,'thief').dead&&equal(actor(lostExtraction.state,'thief').at,{x:8,y:13}),branchEvidence(l8,lostExtraction));
const press8=l8.full.trace.find(t=>t.phases.some(p=>p.kind==='piston'));
const pressAttempt=authorAt(l8,l8.stages[11].turn);pressAttempt.go(13,6,'thief');
const manual8=act(l8,pressAttempt.state,'R');
check('l8-lateral-press-places-the-cargo-in-water',8,
 'The Thief cannot push the loaded crate east. The witnessed remote press moves it from the press into the water and creates the permanent final support without a pull.',
 manual8.state.failed&&!manual8.state.dead&&press8&&press8.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='stone'&&equal(m.from,{x:14,y:6})&&equal(m.to,{x:15,y:6})))&&
 !press8.phases.some(p=>p.kind==='pull')&&has(press8.after.supports,15,6)&&!has(press8.before.supports,15,6),
 {manual:{setupCommands:pressAttempt.commands,before:stateSummary(l8,pressAttempt.state),attempt:'R',after:outcome(l8,manual8)},successful:{turn:l8.full.trace.indexOf(press8)+1,before:stateSummary(l8,press8.before),after:outcome(l8,{state:press8.after,phases:press8.phases})}});
const opposedExit=authorAt(l8,l8.stages[21].turn);opposedExit.go(17,6,'wizard');
const exitRefused=act(l8,opposedExit.state,'R');
check('l8-return-command-blocks-the-final-exit',8,
 'Even with the durable final weights installed, keeping the return command occupied closes the last exit gate; the east step is refused until the return command is released.',
 circuitPressed(l8.world,opposedExit.state,'retour')&&circuitPressed(l8.world,opposedExit.state,'ancre-vivante')&&circuitPressed(l8.world,opposedExit.state,'dernier-miroir')&&exitRefused.state.failed&&!exitRefused.state.dead,
 {setupCommands:opposedExit.commands,before:stateSummary(l8,opposedExit.state),attempt:'R',after:outcome(l8,exitRefused)});

// Short searches address concrete alternate-mechanic risks. They are deliberately
// bounded and are reported as inconclusive whenever their budget is reached.
search(l7,'Can the final chamber be completed after the second support without creating any further support?',l7.stages[6].turn,{disablePlatforms:true});
search(l8,'Can the loaded final cargo reach a complete solution without any piston firing?',l8.stages[11].turn,{disablePistons:true});

const report={schemaVersion:1,baselineCommit:BASELINE_COMMIT,scope:'Observed winning-route mechanisms, local counterfactuals at documented states, and bounded searches for specific bypasses.',
 limitations:['Input count and mechanism count describe these witness routes; they are not a proof of cognitive difficulty, global necessity, uniqueness or optimality.','Consecutive pulls in the same direction with the same cargo classes are grouped into one tool episode; walking and circuit changes split episodes.','Circuit transitions include incidental button crossings. Resource button visits describe observed occupancy, not a proof that every visit is required.','A solver limit is inconclusive. Only queue exhaustion establishes impossibility within the stated restrictions.','Elaborate alternate allocations of monsters, mirrors and crates may remain possible. The review rejects demonstrated shortcuts that remove most dependencies, not every alternative solution.','Author routes and internal state evidence are validation-only and are not observations supplied to playing agents.'],
 sources,scopeChecks,comparisons,passed:checks.length,total:checks.length,checks,searches};
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});
writeFileSync(new URL('../validation/hard-finals-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'validation/hard-finals-report.json',passed:checks.length,total:checks.length,unchangedFiles:scopeChecks.length,comparisons:comparisons.map(c=>({level:c.level,before:{inputs:c.before.metrics.actions,toolInputs:c.before.toolInputs,toolEpisodes:c.before.toolEpisodes},after:{inputs:c.after.metrics.actions,toolInputs:c.after.toolInputs,toolEpisodes:c.after.toolEpisodes,circuitTransitions:c.after.circuitTransitionCount}})),searches:searches.map(({level,label,status,states,ms})=>({level,label,status,states,ms}))}));
