/** Independent audit: numeric actions go directly to stepDetailed.
 * No Author, author route builder, replay helper or general-purpose solver.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as current from '../../dist/core.js';
import {SS25_LEVELS} from '../../dist/levels.js';
import * as previous from '../../../sinking-star-ss24/src/core.ts';

const lab=new URL('../../',import.meta.url),repo=new URL('../../../../',import.meta.url);
const roles=['warrior','thief','wizard','bard'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key=p=>`${p.x},${p.y}`,equal=(a,b)=>a.x===b.x&&a.y===b.y;
const directions=[[0,-1],[0,1],[-1,0],[1,0]];
const read=url=>JSON.parse(readFileSync(url,'utf8'));
const report={game:'SS25',success:false,status:'incomplete',method:'Relecture directe des actions numériques avec stepDetailed ; comparaison des états jalonnés et des métriques ; contre-branches indépendantes ; omissions bornées de séquences ; 88 géométries SS14–SS24 ; marches individuelles à ressources fixes.',levels:[],checks:[],counterBranches:[],shortcutReview:[],structuralComparison:[],errors:[],pending:[],limits:[
 'Un témoin gagnant prouve la faisabilité, sans prouver une solution unique, une route optimale ou un apprentissage autonome SRA.',
 'Les graphes de marche figent caisses, miroirs, appuis et monstres. Les circuits sont recalculés au départ du héros ; les déplacements forcés des presses et la coopération de plusieurs héros ne sont pas simulés. Le modèle généreux ignore les autres héros comme obstacles tout en conservant leurs poids.',
 'Chaque graphe de marche explore au plus 400 cases. Une affectation de quatre buts dans ce modèle ne prouverait pas une victoire réelle, et son absence ne mesure pas la difficulté ressentie.',
 'Les huit symétries, le recadrage des murs et la normalisation des occupants détectent les répétitions exactes de terrain. Ils ne mesurent ni la ressemblance thématique ni l’originalité subjective.',
 'Une contre-branche établit un effet depuis un poste précis. Un refus local ou une fermeture ne signifie pas que toute récupération ultérieure serait impossible.',
 'Les omissions testent seulement des portions du témoin et leurs suffixes. Les clics conservés sont retargetés sur le même rôle et les sélections nécessaires sont insérées ; toutes les actions résultantes sont ensuite rejouées numériquement. Les échecs ne prouvent aucune nécessité globale.',
 'Les nombres d’entrées, d’objets et de mécanismes sont descriptifs. La comparaison de difficulté avec SS24 s’appuie sur les coordinations vérifiées et reconnaît les mécanismes réutilisés, sans classement universel de difficulté.'
]};
const ok=(level,name,observed,scope='Effets constatés sur le témoin ou la branche indiquée ; aucune nécessité universelle de cet ordre exact.')=>report.checks.push({level,name,status:'passed',observed,scope});
const hero=(state,role)=>state.heroes.find(h=>h.kind===role);
const click=(state,role)=>{const h=hero(state,role);assert(h&&!h.dead);return{id:6,data:{x:3+h.at.x*3,y:3+h.at.y*3}};};
const physical=s=>({heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:s.stones,supports:s.supports,mirrors:s.mirrors,monsters:s.monsters});
const occupancy=(state,at)=>{
 const h=state.heroes.find(h=>!h.dead&&equal(h.at,at));if(h)return h.kind;
 if(state.stones.some(p=>equal(p,at)))return 'stone';if(state.monsters.some(p=>equal(p,at)))return 'monster';if(state.mirrors.some(m=>equal(m.at,at)))return 'mirror';return null;
};

function initialMetrics(pushRole){return{actions:0,selections:0,[pushRole+'Pushes']:0,thiefPulls:0,thiefPartnerPulls:0,thiefMirrorPulls:0,swaps:0,wizardHeroSwaps:0,wizardStoneSwaps:0,wizardMonsterSwaps:0,bentSwaps:0,songs:0,groupSongs:0,songHeroMoves:0,songStoneMoves:0,songMonsterMoves:0,supportMoves:0,partnerMoves:0,stoneMoves:0,mirrorMoves:0,monsterMoves:0,reflections:0,heroReflections:0,pistonPushes:0,platformsCreated:0,monstersRemoved:0,blocked:0,deaths:0};}
function direct(spec,actions,api=current,{strict=true}={}){
 const world=api.compileLevel(spec),initial=api.initialState(world),timeline=[];
 let state=initial,destroyedCargo=0;const pushRole=initial.heroes[0].kind,metrics=initialMetrics(pushRole);
 for(const[index,action]of actions.entries()){
  assert(Number.isInteger(action.id)&&action.id>=1&&action.id<=6,`${spec.id}: valid numeric action ${index+1}`);
  if(strict)assert(!state.complete&&!state.dead,`${spec.id}: no action after terminal state`);
  const before=state,detail=api.stepDetailed(world,state,action.id,action.data);state=detail.state;
  metrics.actions++;metrics.selections+=+(before.active!==state.active);metrics.blocked+=+state.failed;metrics.deaths+=+(!before.dead&&state.dead);
  metrics.platformsCreated+=Math.max(0,state.supports.length-before.supports.length);metrics.monstersRemoved+=before.monsters.length-state.monsters.length;
  if(strict){assert(!state.failed&&!state.dead,`${spec.id}: refused or fatal action ${index+1}`);assert.equal(state.heroes.length,4);}
  for(const phase of detail.phases){
   const active=phase.before.heroes[phase.before.active],others=phase.moves.filter(m=>!equal(m.from,active.at));
   if(phase.kind==='crush')destroyedCargo+=phase.before.stones.length-phase.after.stones.length;
   if(phase.kind==='push'){
    metrics[pushRole+'Pushes']++;if(strict){assert.equal(active.kind,pushRole);assert(phase.moves.length>=2);if(pushRole==='merchant')assert.equal(phase.moves.length,2);}
   }
   if(phase.kind==='pull'){
    metrics.thiefPulls++;metrics.thiefPartnerPulls+=+others.some(m=>m.actor==='hero');metrics.thiefMirrorPulls+=+others.some(m=>m.actor==='mirror');
    if(strict){assert.equal(active.kind,'thief');assert.equal(phase.moves.length,2);assert(others.every(m=>m.actor!=='support'&&equal(m.to,active.at)));}
   }
   if(phase.kind==='swap'){
    metrics.swaps++;metrics.wizardHeroSwaps+=+others.some(m=>m.actor==='hero');metrics.wizardStoneSwaps+=+others.some(m=>m.actor==='stone');metrics.wizardMonsterSwaps+=+others.some(m=>m.actor==='monster');
    const path=phase.paths?.[0]??[];metrics.bentSwaps+=+path.some((p,i)=>i>1&&((p.x-path[i-1].x)!==(path[i-1].x-path[i-2].x)||(p.y-path[i-1].y)!==(path[i-1].y-path[i-2].y)));
    if(strict){assert.equal(active.kind,'wizard');assert.equal(phase.moves.length,2);assert(others.every(m=>!['mirror','support'].includes(m.actor)));assert(equal(phase.moves[0].from,phase.moves[1].to)&&equal(phase.moves[0].to,phase.moves[1].from));}
   }
   if(phase.kind==='song'){
    metrics.songs++;metrics.groupSongs+=+(phase.moves.length>=3);metrics.songHeroMoves+=others.filter(m=>m.actor==='hero').length;metrics.songStoneMoves+=others.filter(m=>m.actor==='stone').length;metrics.songMonsterMoves+=others.filter(m=>m.actor==='monster').length;
    if(strict){assert.equal(active.kind,'bard');for(const move of phase.moves){assert.notEqual(move.actor,'mirror');assert.equal(Math.abs(move.to.x-move.from.x)+Math.abs(move.to.y-move.from.y),1);assert(Math.max(Math.abs(move.from.x-active.at.x),Math.abs(move.from.y-active.at.y))<=2);}}
   }
   if(['push','pull','swap','song'].includes(phase.kind))metrics.partnerMoves+=others.filter(m=>m.actor==='hero').length;
   if(phase.kind==='reflect'){metrics.reflections++;metrics.heroReflections+=phase.moves.filter(m=>m.actor==='hero').length;}
   metrics.pistonPushes+=+(phase.kind==='piston');
   for(const move of phase.moves){
    metrics.stoneMoves+=+(move.actor==='stone');metrics.mirrorMoves+=+(move.actor==='mirror');metrics.supportMoves+=+(move.actor==='support');metrics.monsterMoves+=+(move.actor==='monster');
    if(strict&&move.actor==='monster')assert(['push','pull','swap','song','reflect','piston'].includes(phase.kind));
    if(strict&&move.actor==='support'){assert.equal(phase.kind,'song');assert.equal(api.terrainAt(world,move.from),'~');assert.equal(api.terrainAt(world,move.to),'~');assert(phase.before.heroes.every(h=>!equal(h.at,move.from)));}
    if(strict&&move.actor==='mirror'){const beforeMirror=phase.before.mirrors.find(m=>equal(m.at,move.from)),afterMirror=phase.after.mirrors.find(m=>equal(m.at,move.to));assert(beforeMirror);if(afterMirror)assert.equal(afterMirror.facing,beforeMirror.facing);}
   }
  }
  if(strict){const goals=world.goals.filter(g=>state.heroes.some(h=>!h.dead&&equal(h.at,g))).length;assert.equal(state.complete,goals===4);assert.equal(state.stones.length+state.supports.length+destroyedCargo,initial.stones.length+initial.supports.length,'Crates become supports or are explicitly crushed; none appear silently');}
  timeline.push({turn:index+1,action,before,after:state,phases:detail.phases});
 }
 return{spec,world,initial,state,timeline,metrics,api,phases:timeline.flatMap(t=>t.phases.map(p=>({...p,turn:t.turn})))};
}
function compareDesign(design,r){
 assert.equal(design.commands.length,design.actions.length,'Commands and numeric actions have equal length');
 for(const[index,t]of r.timeline.entries()){
  const c=design.commands[index];assert.equal(t.action.id,c==='C'?6:{U:1,D:2,L:3,R:4,X:5}[c],'Command/action parity');
  if(c==='C')assert.equal(t.after.active,(t.before.active+1)%4,'Selection cycle parity');
 }
 for(const[field,value]of Object.entries(design.metrics))assert.equal(r.metrics[field],value,`${design.spec.id}: independently recounted ${field}`);
 let previousTurn=-1;const stages=[];
 for(const stage of design.stages){
  assert(Number.isInteger(stage.turn)&&stage.turn>=0&&stage.turn<=r.timeline.length&&stage.turn>previousTurn);previousTurn=stage.turn;
  const s=stage.turn?r.timeline[stage.turn-1].after:r.initial;
  assert.deepEqual(stage.heroes,s.heroes.map(h=>({kind:h.kind,at:h.at})),`${design.spec.id}: stage heroes`);
  for(const part of ['stones','supports','mirrors','monsters'])assert.deepEqual(stage[part],s[part],`${design.spec.id}: stage ${part}`);
  assert.deepEqual(stage.circuits,Object.fromEntries(r.world.circuits.map(c=>[c.id,r.api.circuitPressed(r.world,s,c.id)])));
  stages.push({label:stage.label,turn:stage.turn,physicalStateSha256:hash(physical(s)),circuits:stage.circuits});
 }
 assert(r.state.complete,`${design.spec.id}: four living heroes reach four goals`);return stages;
}

// Terrain comparison is independent of level ids, occupants, devices and wall padding.
function canonicalTerrain(rows){
 let matrix=rows.map(row=>[...row].map(c=>c==='#'?'#':'~s'.includes(c)?'~':'.'));
 const used=[];matrix.forEach((row,y)=>row.forEach((c,x)=>{if(c!=='#')used.push({x,y});}));assert(used.length);
 const xs=used.map(p=>p.x),ys=used.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 matrix=matrix.slice(y0,y1+1).map(row=>row.slice(x0,x1+1));
 const rotate=m=>m[0].map((_,x)=>m.map(row=>row[x]).reverse()),forms=[];
 for(let i=0;i<4;i++){forms.push(matrix.map(row=>row.join('')).join('\n'));forms.push(matrix.map(row=>[...row].reverse().join('')).join('\n'));matrix=rotate(matrix);}
 return hash(forms.sort()[0]);
}
function levelsFromSource(series){
 const relative=`experiments/sinking-star-ss${series}/src/levels.ts`,path=new URL(relative,repo);
 const source=existsSync(path)?readFileSync(path,'utf8'):execFileSync('git',['show','HEAD:'+relative],{cwd:fileURLToPath(repo),encoding:'utf8',maxBuffer:4*1024*1024});
 const match=source.match(/SS\d+_LEVELS[^=]*=\s*(\[[\s\S]*\])\s*;/);assert(match,'Readable level array: '+relative);return JSON.parse(match[1]);
}
function fixedWalking(world,state,subject,api,ignoreOtherHeroes){
 const occupied=[...state.stones,...state.monsters,...state.mirrors.map(m=>m.at),...(!ignoreOtherHeroes?state.heroes.filter(h=>h.kind!==subject.kind).map(h=>h.at):[])];
 const at=p=>({...state,gateClosed:undefined,platformActive:undefined,heroes:state.heroes.map(h=>h.kind===subject.kind?{...h,at:p}:h)});
 const blocked=(p,before,after)=>!api.supported(world,before,p)||!api.supported(world,after,p)||api.terrainAt(world,p)==='#'||occupied.some(q=>equal(q,p))
  ||state.monsters.some(m=>Math.abs(m.x-p.x)+Math.abs(m.y-p.y)===1)
  ||world.gates.some((g,i)=>equal(g.at,p)&&(api.gateClosed(world,before,i)||api.gateClosed(world,after,i)))
  ||world.doors.some(q=>equal(q,p))&&(!api.doorsOpen(world,before)||!api.doorsOpen(world,after));
 const queue=[subject.at],seen=new Set([key(subject.at)]);let transitions=0;
 for(let i=0;i<queue.length;i++)for(const[dx,dy]of directions){
  transitions++;const p={x:queue[i].x+dx,y:queue[i].y+dy};if(blocked(p,at(queue[i]),at(p))||seen.has(key(p)))continue;seen.add(key(p));queue.push(p);assert(seen.size<=400);
 }
 return{role:subject.kind,states:seen.size,transitions,reachableGoals:world.goals.filter(g=>seen.has(key(g))),stateBound:400,exhausted:true};
}
function matchingSize(walking){
 const match=(i,used)=>{if(i===walking.length)return 0;let best=match(i+1,used);for(const p of walking[i].reachableGoals)if(!used.has(key(p))){const next=new Set(used);next.add(key(p));best=Math.max(best,1+match(i+1,next));}return best;};return match(0,new Set());
}
function resourceHistories(r){
 const resources=[...r.initial.stones.map((at,i)=>({id:'crate-'+(i+1),kind:'stone',at,initial:at,events:[]})),...r.initial.supports.map((at,i)=>({id:'support-'+(i+1),kind:'support',at,initial:at,events:[]}))];
 for(const phase of r.phases){
  const moves=resources.map(piece=>piece.kind==='removed'?null:phase.moves.find(m=>m.actor===piece.kind&&equal(m.from,piece.at)));
  resources.forEach((piece,i)=>{const move=moves[i];if(move){piece.events.push({turn:phase.turn,phase:phase.kind,kind:piece.kind,from:piece.at,to:move.to});piece.at=move.to;}});
  for(const piece of resources){
   if(piece.kind!=='stone'||phase.after.stones.some(p=>equal(p,piece.at)))continue;
   if(phase.after.supports.some(p=>equal(p,piece.at))&&!phase.before.supports.some(p=>equal(p,piece.at))){piece.events.push({turn:phase.turn,phase:phase.kind,transition:'stone-to-support',at:piece.at});piece.kind='support';}
   else {assert.equal(phase.kind,'crush','Only an explicit crush destroys a crate');piece.events.push({turn:phase.turn,phase:phase.kind,transition:'removed',at:piece.at});piece.kind='removed';}
  }
 }
 for(const piece of resources)if(piece.kind!=='removed')assert(r.state[piece.kind==='stone'?'stones':'supports'].some(p=>equal(p,piece.at)),'Tracked resource reaches its recorded final position');
 return resources;
}
function signature(r){
 const {world,initial,state,phases,timeline,api}=r,buttonHistory=[];
 for(const c of world.circuits)for(const at of c.buttons){let last=occupancy(initial,at),changes=[];for(const t of timeline){const next=occupancy(t.after,at);if(next!==last){changes.push({turn:t.turn,from:last,to:next,pressedBefore:api.circuitPressed(world,t.before,c.id),pressedAfter:api.circuitPressed(world,t.after,c.id)});last=next;}}buttonHistory.push({circuit:c.id,at,initial:occupancy(initial,at),final:occupancy(state,at),changes});}
 const files=phases.filter(p=>p.kind==='push'&&p.moves.length>=3).map(p=>{const active=p.before.heroes[p.before.active],cargo=p.moves.filter(m=>!equal(m.from,active.at));return{turn:p.turn,occupants:cargo.length,kinds:[...new Set(cargo.map(m=>m.actor))],mixed:new Set(cargo.map(m=>m.actor)).size>=2};});
 const transitions=[];for(const t of timeline)for(const c of world.circuits){const before=api.circuitPressed(world,t.before,c.id),after=api.circuitPressed(world,t.after,c.id);if(before!==after)transitions.push({turn:t.turn,circuit:c.id,from:before,to:after});}
 const counter=kind=>phases.filter(p=>p.kind===kind).length;
 return{
  landCells:world.terrain.filter(c=>c==='.').length,waterCells:world.terrain.filter(c=>c==='~').length,
  initialResources:{stones:initial.stones.length,supports:initial.supports.length,mirrors:initial.mirrors.length,monsters:initial.monsters.length},
  finalResources:{stones:state.stones.length,supports:state.supports.length,mirrors:state.mirrors.length,monsters:state.monsters.length},
  circuits:world.circuits.length,buttons:world.buttons.length,presses:world.gates.length,hydraulicPlatforms:world.platforms.length,
  phaseCounts:Object.fromEntries([...new Set(phases.map(p=>p.kind))].sort().map(k=>[k,counter(k)])),
  filePushes:files.length,mixedFilePushes:files.filter(f=>f.mixed).length,maximumPushedOccupants:Math.max(0,...phases.filter(p=>p.kind==='push').map(p=>p.moves.length-1)),files,
  circuitTransitions:transitions,buttonHistory,
  preservedWeightTypeChanges:buttonHistory.flatMap(b=>b.changes.filter(c=>c.from!==null&&c.to!==null&&c.pressedBefore&&c.pressedAfter).map(c=>({circuit:b.circuit,at:b.at,...c}))),
  weightHistoryScope:'Types d’occupants constatés en fin d’entrée ; les remplacements entre deux caisses et les changements intermédiaires sont examinés séparément dans les phases et les historiques individuels.',
  combatWaves:counter('combat'),monstersRemovedInCombat:phases.filter(p=>p.kind==='combat').reduce((n,p)=>n+p.before.monsters.length-p.after.monsters.length,0),
  supportsCreated:r.metrics.platformsCreated,supportMoves:r.metrics.supportMoves,mirrorMoves:r.metrics.mirrorMoves,
  activePowerKinds:[...new Set(phases.filter(p=>['push','pull','swap','song','reflect'].includes(p.kind)).map(p=>p.kind))].sort(),
  resourceHistories:resourceHistories(r)
 };
}

function localBranch(r,name,startTurn,commands){
 let state=startTurn?r.timeline[startTurn-1].after:r.initial;const start=state,actions=[],events=[];
 for(const command of commands){const action=typeof command==='string'?click(state,command):{id:command};const before=state,detail=current.stepDetailed(r.world,state,action.id,action.data);state=detail.state;actions.push(action);events.push({action,before,after:state,phases:detail.phases});if(state.dead||state.complete)break;}
 const entry={level:Number(r.spec.id.slice(-2)),name,startTurn,startStateSha256:hash(start),actions,finalStateSha256:hash(state),failed:state.failed,dead:state.dead,complete:state.complete,phases:events.flatMap(e=>e.phases.map(p=>p.kind)),circuitBefore:Object.fromEntries(r.world.circuits.map(c=>[c.id,current.circuitPressed(r.world,start,c.id)])),circuitAfter:Object.fromEntries(r.world.circuits.map(c=>[c.id,current.circuitPressed(r.world,state,c.id)])),scope:'Effet local depuis ce poste précis, sans conclusion d’impasse globale.'};
 report.counterBranches.push(entry);return{state,start,events,entry};
}
function omissionAudit(r,design){
 const bounds=[0,...design.stages.map(s=>s.turn),design.actions.length].filter((n,i,a)=>i===0||n!==a[i-1]);
 const trials=[],winning=[];
 for(let b=1;b<bounds.length;b++){
  const from=bounds[b-1],to=bounds[b];if(to===design.actions.length)continue;
  let state=r.initial;const actions=[];let stopped=null,insertedSelections=0;
  for(const t of r.timeline){
   if(t.turn>from&&t.turn<=to)continue;
   const intended=t.action.id===6?t.after.heroes[t.after.active].kind:t.before.heroes[t.before.active].kind;
   if(t.action.id===6||state.heroes[state.active].kind!==intended){const action=click(state,intended);state=current.stepDetailed(r.world,state,action.id,action.data).state;actions.push(action);if(t.action.id!==6)insertedSelections++;}
   if(t.action.id!==6){const action={id:t.action.id},detail=current.stepDetailed(r.world,state,action.id);state=detail.state;actions.push(action);if(state.failed||state.dead){stopped={originalTurn:t.turn,failed:state.failed,dead:state.dead};break;}}
   if(state.complete)break;
  }
  const trial={omittedTurns:[from+1,to],omittedStage:design.stages.find(s=>s.turn===to)?.label??'suffix',testedActions:actions.length,insertedSelections,complete:state.complete,stopped,finalStateSha256:hash(state)};trials.push(trial);
  if(state.complete){const check=direct(design.spec,actions);assert(check.state.complete);winning.push({...trial,actions,metrics:check.metrics,limit:'Cette variante gagne sans la portion supprimée. Les autres séquences et préparations du témoin sont conservées ; aucune optimalité revendiquée.'});}
 }
 return{method:'Suppression indépendante de chaque bloc entre jalons puis relecture du suffixe ; intentions de sélection conservées.',trials,winningVariants:winning};
}

function targetedBranches(n,r,d){
 const at=i=>d.stages[i].turn,pressed=(s,id)=>current.circuitPressed(r.world,s,id),events=kind=>r.phases.filter(p=>p.kind===kind);
 const P=(x,y)=>({x:x+Math.floor((20-r.spec.rows[0].length)/2),y:y+Math.floor((20-r.spec.rows.length)/2)});
 if(n===1){
  const first=events('pull')[0],pushed=events('push').find(p=>p.moves.length>=4);assert(first&&pushed);assert.equal(first.moves.length,2);assert.equal(first.after.stones.length,r.initial.stones.length);
  const cargo=pushed.moves.filter(m=>!equal(m.from,pushed.before.heroes[pushed.before.active].at));assert.equal(cargo.filter(m=>m.actor==='stone').length,2);assert(cargo.some(m=>m.actor==='hero'&&equal(m.from,hero(pushed.before,'thief').at)));
  const leave=localBranch(r,'Retirer le premier poids après une relève latérale',0,['thief',3,3]);assert(!leave.state.failed&&!leave.state.dead);assert.equal(occupancy(leave.state,r.world.circuits.find(c=>c.id==='releve').buttons[0]),null);assert(!pressed(leave.state,'releve'));assert.equal(leave.state.stones.length,r.initial.stones.length);
  const single=localBranch(r,'Après une traction, le Guerrier peut reprendre toute la file',at(0),['warrior',2,2]);assert(!single.state.failed&&!single.state.dead);assert(single.events.some(e=>e.phases.some(p=>p.kind==='push'&&p.moves.length===4)));
  ok(n,'Prise unique, file mixte et poids final sont constatés sans déduire un quota de victoire',{firstPullTurn:first.turn,mixedFileTurn:pushed.turn,mixedCargo:cargo.map(m=>m.actor),initialDepartureVacatesFirstWeight:true,monstersRemovedInCombat:r.phases.filter(p=>p.kind==='combat').reduce((sum,p)=>sum+p.before.monsters.length-p.after.monsters.length,0),finalRelay:pressed(r.state,'releve')});
 }
 if(n===2){
  const convoyTurn=events('push').filter(p=>p.moves.length===3&&p.moves.some(m=>m.actor==='mirror')&&p.moves.some(m=>m.actor==='stone')).at(-1).turn;
  const early=localBranch(r,'Le premier envoi ferme l’accès avant l’arrivée du réceptionnaire',convoyTurn,['bard',4,'thief',4,4,4,4,4]);assert(early.state.failed&&!early.state.dead);assert(equal(hero(early.state,'thief').at,P(9,4)));assert(current.gateClosed(r.world,early.state,1));
  const occupied=localBranch(r,'Le second envoi conserve un quai encombré si la première charge n’est pas échangée',at(2),['bard',3,'warrior',4,'bard',4,'thief',2]);assert(occupied.state.failed&&!occupied.state.dead);assert(occupied.state.stones.some(p=>equal(p,P(12,5))));assert(occupied.state.mirrors.some(m=>equal(m.at,P(12,6))));
  const departure=localBranch(r,'Quitter la baie sans échange enlève le poids distant',at(2),['wizard',4]);assert(!departure.state.failed&&!departure.state.dead);assert(!pressed(departure.state,'depot'));assert(pressed(r.timeline[at(3)-1].after,'depot'));
  assert.equal(events('piston').length,2);assert.equal(r.initial.stones.length,1);assert.equal(r.initial.mirrors.length,1);
  ok(n,'Un même quai reçoit successivement une caisse et un miroir en conservant deux poids distincts',{convoyTurn,pressTransports:events('piston').map(p=>({turn:p.turn,moves:p.moves})),prematureAccessClosed:true,occupiedReceiverRefusesThief:true,wizardDepartureWithoutReplacementLosesDeposit:true,finalReception:pressed(r.state,'reception'),finalDeposit:pressed(r.state,'depot')});
 }
 if(n===3){
  const separated=localBranch(r,'Les deux appuis de livraison ne franchissent pas le chenal central',at(2),['warrior',2,2,2,2,2,4,4]);assert(separated.state.failed&&!separated.state.dead);assert(equal(hero(separated.state,'warrior').at,P(6,7)));
  const disturbed=localBranch(r,'Un départ volontaire vers le haut emporte l’appui déjà rangé',at(3),['bard',1]);assert(!disturbed.state.failed&&!disturbed.state.dead);assert(disturbed.state.supports.some(p=>equal(p,P(8,6))));assert(!disturbed.state.supports.some(p=>equal(p,P(8,7))));
  const beforePull=r.timeline[at(3)-1].after,afterPull=r.timeline[at(4)-1].after,joined=r.timeline[at(5)-1].after;assert.deepEqual(beforePull.supports,afterPull.supports);assert(joined.supports.some(p=>equal(p,P(7,7)))&&joined.supports.some(p=>equal(p,P(8,7))));
  const joinedWalking=joined.heroes.map(h=>fixedWalking(r.world,joined,h,current,true));assert.equal(matchingSize(joinedWalking),4);
  ok(n,'Les mêmes appuis changent de disposition après deux livraisons sèches',{separatedSupports:r.timeline[at(2)-1].after.supports,centralStepRefused:true,prematureBardDepartureMovesSupportTo:P(8,6),passiveExtractionPreservesBothSupports:true,joinedSupports:joined.supports,generousWalkingGoalAssignmentAfterJoining:4,stonesRemainDry:r.state.stones.length===r.initial.stones.length},'Les passages sont testés dans deux configurations précises ; les graphes de marche ne remplacent pas un solveur de coopération.');
 }
 if(n===4){
  const masked=localBranch(r,'Le premier reflet prend la cale qui masque le partenaire',at(0),[5]);assert(!masked.state.failed&&!masked.state.dead);assert(masked.events.some(e=>e.phases.some(p=>p.kind==='reflect'&&p.moves.some(m=>m.actor==='stone'))));assert(equal(hero(masked.state,'thief').at,hero(masked.start,'thief').at));
  const repull=localBranch(r,'Un second pas du Voleur reprend le premier dépôt',at(0),['thief',4]);assert(!repull.state.failed&&!repull.state.dead);assert(!pressed(repull.state,'traction'));
  const release=localBranch(r,'Reprendre la cale avant sa relève retire la passerelle hydraulique',at(2),['thief',4,1,2]);assert(!release.state.failed&&!release.state.dead);assert(!pressed(release.state,'releve'));assert(r.world.platforms.every((_,i)=>!current.platformActive(r.world,release.state,i)));
  const handover=events('push').find(p=>p.moves.filter(m=>m.actor==='stone').length===2&&p.moves.some(m=>equal(m.from,P(13,7))));assert(handover);assert(pressed(handover.before,'releve')&&pressed(handover.after,'releve'));assert(r.world.platforms.every((_,i)=>current.platformActive(r.world,handover.before,i)&&current.platformActive(r.world,handover.after,i)));
  const songLeave=localBranch(r,'Le départ chanté reprend le dernier poids avant extraction passive',at(5),['bard',2]);assert(!songLeave.state.failed&&!songLeave.state.dead);assert(!pressed(songLeave.state,'dernier'));
  const safeLeave=localBranch(r,'Après extraction passive, le même départ conserve le dernier poids',at(6),['bard',2]);assert(!safeLeave.state.failed&&!safeLeave.state.dead);assert(pressed(safeLeave.state,'dernier'));
  ok(n,'La cale passe de masque optique à relève hydraulique puis à poids final',{earlyReflectionTakesStone:true,secondThiefStepRetakesFirstDeposit:true,earlyWithdrawalRemovesPlatforms:2,fileHandoverTurn:handover.turn,fileHandoverPreservesPlatforms:2,earlyBardDepartureReleasesFinalWeight:true,postExtractionDeparturePreservesWeight:true});
 }
 if(n===5){
  const depart=localBranch(r,'Le Guerrier quitte seul le service avant la relève chantée',at(2),['warrior',4]);assert(!depart.state.failed&&!depart.state.dead);assert(!pressed(depart.state,'service'));assert(pressed(r.timeline[at(3)-1].after,'service'));
  const early=localBranch(r,'Reflet avant extraction de la cale',at(4),[5]);assert(!early.state.failed&&!early.state.dead);const reflected=early.events.flatMap(e=>e.phases).find(p=>p.kind==='reflect');assert(reflected?.moves.some(m=>m.actor==='stone'));assert(!reflected.moves.some(m=>m.actor==='hero'));assert(!pressed(early.state,'depart'));
  ok(n,'La relève conserve le service puis la cale doit cesser de masquer le reflet du héros',{unreplacedDepartureClosesService:true,witnessSongKeepsService:true,earlyReflectionMoves:reflected.moves,departureCircuitAfterEarlyReflection:false});
 }
 if(n===6){
  const release=localBranch(r,'La cible sèche ne peut quitter le service sans en fermer l’accès',at(0),['thief',1,3,3,2,4]);assert(!release.state.failed&&!release.state.dead);assert(pressed(release.start,'service'));assert(!pressed(release.state,'service'));
  const early=localBranch(r,'Première cible du retour avant dégagement des partenaires',at(3),['wizard',2,3]);assert(!early.state.failed&&!early.state.dead);const swaps=early.events.flatMap(e=>e.phases).filter(p=>p.kind==='swap');assert(swaps.some(p=>p.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(p.before,'warrior').at))));
  const upward=localBranch(r,'Depuis le retour, la commande haute échange avec la caisse au lieu de marcher',at(5),['warrior',2,2,3,'wizard',3,3,1]);assert(!upward.state.failed&&!upward.state.dead);assert(upward.events.some(e=>e.phases.some(p=>p.kind==='swap'&&p.moves.some(m=>m.actor==='stone'))));
  const resources=resourceHistories(r),target=resources.find(p=>equal(p.initial,P(6,9))),second=resources.find(p=>equal(p.initial,P(5,10))),reserve=resources.find(p=>equal(p.initial,P(3,15)));
  assert(target.events.some(e=>e.phase==='swap'));assert(target.events.some(e=>e.transition==='stone-to-support'&&equal(e.at,P(8,8))));assert.equal(target.kind,'support');
  assert(second.events.some(e=>e.transition==='stone-to-support'&&equal(e.at,P(6,11))));assert.equal(second.kind,'support');assert.equal(reserve.kind,'stone');assert(equal(reserve.at,P(8,6)));
  ok(n,'La caisse utilisée comme cible reste sèche jusqu’à son usage, puis devient un appui',{supportsCreated:r.metrics.platformsCreated,stoneSwaps:r.metrics.wizardStoneSwaps,earlyReturnTargetsWarrior:true,lateUpwardCommandTargetsStone:true,distinctResourceHistories:[target,second,reserve]});
 }
 if(n===7){
  const outbound=events('song').slice(0,4);assert.equal(outbound.length,4);for(const p of outbound){assert(p.before.stones.some(q=>equal(q,P(5,5)))&&p.after.stones.some(q=>equal(q,P(5,5))));assert(!p.moves.some(m=>equal(m.from,P(5,5))));assert(p.moves.some(m=>m.actor==='stone'));}
  const empty=localBranch(r,'Le retour prématuré retire le pont avant la livraison de la troisième charge',at(1),['bard',3,3]);assert(!empty.state.failed&&!empty.state.dead);assert(!current.platformActive(r.world,empty.state,0));assert(!empty.state.supports.some(p=>equal(p,P(11,8))));assert(equal(hero(empty.state,'wizard').at,P(16,14)));
  const trapped=localBranch(r,'Après livraison, un retour avant la sortie du Magicien ferme encore sa réserve',at(2),['bard',3,3,'wizard',1,1]);assert(trapped.state.failed&&!trapped.state.dead);assert(trapped.state.supports.some(p=>equal(p,P(11,8))));assert(equal(hero(trapped.state,'wizard').at,P(16,13)));assert(current.gateClosed(r.world,trapped.state,0));
  const earlyLeave=localBranch(r,'Le départ chanté reprend les deux poids des arrivées',at(4),['bard',2]);assert(!earlyLeave.state.failed&&!earlyLeave.state.dead);assert(!pressed(earlyLeave.state,'arrivees'));
  const safeLeave=localBranch(r,'Après quatre tractions passives, le Barde peut partir sans reprendre les poids',at(5),['bard',4]);assert(!safeLeave.state.failed&&!safeLeave.state.dead);assert(pressed(safeLeave.state,'arrivees'));
  const third=resourceHistories(r).find(p=>equal(p.initial,P(16,14)));assert(third?.events.some(e=>e.phase==='swap'));assert(third.events.some(e=>e.transition==='stone-to-support'&&e.phase==='platform'));assert.equal(third.kind,'support');
  ok(n,'L’aller maintient une charge par butée ; le retour consomme la troisième et réaffecte les deux premières',{selectiveOutboundSongs:4,emptyPrematureRetractionCreatesNoSupport:true,latePrematureRetractionCreatesSupportButClosesWizardExit:true,thirdResourceHistory:third,finalWeights:r.world.circuits.find(c=>c.id==='arrivees').buttons,passiveBardExtractionPreservesWeights:true});
 }
 if(n===8){
  const premature=localBranch(r,'Libérer les deux commandes avant de remplacer le Magicien sur la presse',at(0),[5]);assert(premature.state.dead);assert(hero(premature.state,'wizard').dead);assert(equal(hero(premature.state,'wizard').at,P(10,11)));assert(premature.events.some(e=>e.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'))));
  const reverse=localBranch(r,'Une sortie volontaire haute du Magicien échange de nouveau avec la caisse',at(1),['wizard',1]);assert(!reverse.state.failed&&!reverse.state.dead);assert(equal(hero(reverse.state,'wizard').at,P(9,11)));assert(reverse.state.stones.some(p=>equal(p,P(9,14))));
  const extractSongs=events('song').filter(p=>p.turn>at(1)&&p.turn<=at(2));assert.equal(extractSongs.length,4);for(const p of extractSongs){assert(!p.moves.some(m=>m.actor==='stone'));assert(p.after.stones.some(q=>equal(q,P(9,11))));}
  const partial=localBranch(r,'Le Voleur oublié dans l’axe laisse une seule commande libérée',0,['thief',1,1,1,1,1,'warrior',1,1,1,1,1,'wizard',2,'bard',1,1,3,3,5]);assert(!partial.state.failed&&!partial.state.dead);assert(pressed(partial.state,'rive-gauche'));assert(!pressed(partial.state,'rive-droite'));assert.equal(partial.state.monsters.length,2);assert.equal(partial.state.supports.length,0);
  for(const[p,i]of r.world.platforms.map((p,i)=>[p,i]))assert.equal(current.platformActive(r.world,partial.state,i),p.circuit==='rive-droite');assert(!partial.events.some(e=>e.phases.some(p=>p.kind==='piston')));
  const full=r.timeline[at(3)-1];assert.equal(full.action.id,5);assert.equal(full.after.monsters.length,0);assert.equal(full.before.monsters.length,2);assert(full.phases.some(p=>p.kind==='combat'));assert(full.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='stone')));assert(r.world.platforms.every((_,i)=>current.platformActive(r.world,full.after,i)));assert(full.after.supports.some(p=>equal(p,P(10,11))));
  const mageArrived=r.timeline.find(t=>t.turn>at(3)&&equal(hero(t.after,'wizard').at,P(12,18)));assert(mageArrived&&mageArrived.turn<at(4));
  const earlyBard=localBranch(r,'Passer le Barde avant les deux héros du haut déplace leur appui de retour',mageArrived.turn,['bard',4,4,4,4,4,2,2,2,'warrior',3,3,3,3,2,2,2]);assert(earlyBard.state.failed&&!earlyBard.state.dead);assert(earlyBard.state.supports.some(p=>equal(p,P(10,14))));assert(!current.supported(r.world,earlyBard.state,P(10,11)));assert(equal(hero(earlyBard.state,'warrior').at,P(10,10)));
  ok(n,'Les deux libérations, la charge de presse et l’ordre du passage composent le retour',{unpreparedReflectionKillsWizard:true,voluntaryWizardExitReversesSwap:true,passiveExtractionKeepsPressLoaded:true,partialRelease:{leftPressed:true,rightPressed:false,monsters:2,supports:0},preparedReflection:{turn:full.turn,monstersRemoved:2,activePlatforms:r.world.platforms.length,pressCreatedSupport:P(10,11)},earlyBardPassageMovesSupportTo:P(10,14),followingWarriorStepRefused:true},'La branche mortelle échoue réellement. Le départ trop tôt du Barde retire seulement l’appui de son poste utile : un retour de l’appui ou une autre coopération n’est pas déclaré impossible.');
 }
}

const comparisons={
 1:{coordination:'Le chantier ajoute une poussée de deux caisses et d’un partenaire à la prise unique du Voleur, puis réemploie le miroir comme second poids de sortie.',ss24:'L’atelier SS24 enseignait la poussée d’un seul occupant et la même famille d’interactions eau, chant, visée, presses et contacts.',evidence:'File mixte observée, retrait de poids testé, 39 découvertes contrôlées séparément par les tests publics du tutoriel.',limit:'La variante gagnante de 214 entrées omet la première traction ; les leçons restent une progression pédagogique, sans condition cachée de victoire.'},
 2:{coordination:'Le quai reçoit deux objets de types différents par la même presse. Le réceptionnaire doit être installé avant la fermeture d’accès, puis la première charge quitte le quai en conservant un poids distant.',ss24:'SS24 N2 descendait une charge dans un escalier puis conservait une porte pendant des transports passifs. SS25 remplace cette descente par deux réceptions, deux dépôts et une fermeture qui coupe le trajet du réceptionnaire.',evidence:'Trois branches testent l’envoi trop tôt, le quai encore encombré et le départ du Magicien sans remplacement ; deux transports de presse figurent au témoin.',limit:'Le témoin SS25 est plus court que celui de SS24. Ni la longueur ni l’absence de chant dans cette solution ne permettent de classer seuls la difficulté.'},
 3:{coordination:'Une file de deux caisses est divisée entre deux commandes ; les deux appuis servent aux livraisons séparées avant d’être réunis en pont central.',ss24:'SS24 N3 conservait quatre caisses dans deux galeries décalées et dégageait des cibles de retour. SS25 conserve deux caisses sèches mais reconfigure deux appuis, après les avoir utilisés autrement.',evidence:'Le pas central est refusé avec les appuis séparés ; le départ volontaire déplace l’appui rangé ; l’extraction passive le conserve ; le pont assemblé permet quatre affectations de marche dans le modèle figé.',limit:'Le témoin plus long comprend des trajets de préparation. La nouveauté vérifiée porte sur la réutilisation spatiale des appuis, sans estimation du temps de résolution humain.'},
 4:{coordination:'Une même cale masque d’abord un reflet, maintient ensuite deux plateformes, puis rejoint un troisième dépôt après remplacement par une autre caisse poussée en file.',ss24:'SS24 N4 séparait placement passif du Magicien, visée coudée et livraison d’une charge. SS25 lie trois dépôts et deux plateformes à plusieurs usages successifs de la même cale.',evidence:'Cinq branches vérifient le reflet masqué, la reprise d’une charge par traction, la perte des plateformes, le départ chanté dangereux et le départ après extraction passive. La relève en file conserve les deux plateformes.',limit:'Ces conséquences sont locales. Elles n’excluent pas toutes les façons de rétablir un poids ou de déplacer un héros après une mauvaise préparation.'},
 5:{coordination:'Le miroir, le Guerrier puis la caisse tiennent le service. Une file verticale utilise ensuite cette caisse comme cale, avant sa séparation latérale et quatre reflets de héros.',ss24:'SS24 N5 interrompait une commande pour transformer un chargement en appui puis rétablissait le passage. SS25 prépare une permutation et un poste de reflet, puis abandonne le service devenu inutile.',evidence:'Le départ solitaire ferme le service ; la relève chantée le conserve ; un reflet prématuré prend la caisse au lieu d’un héros. Les quatre transports de héros par reflet figurent au témoin.',limit:'Le Magicien est transporté sans échange actif dans cette solution. Le rôle de chacun n’est pas artificiellement rendu obligatoire par un compteur de capacités.'},
 6:{coordination:'Trois caisses ont des usages distincts : cible puis appui supérieur, réception puis appui inférieur, poids de service puis poids final. Le dernier passage du Magicien exige un placement passif dans le témoin.',ss24:'SS24 N6 restaurait un miroir avant de fermer un accès et conservait sa seule caisse. SS25 retire irréversiblement deux caisses du plan des cibles, puis réemploie le poids qui rendait le premier accès possible.',evidence:'Les historiques individuels suivent les deux conversions. Les branches constatent la fermeture du service, une première cible de retour trop proche et une visée involontaire sur le poids final.',limit:'L’ordre d’utilisation et de consommation est démontré par le témoin et ces postes testés ; aucune preuve de solution unique ou de nécessité de chaque sélection n’est revendiquée.'},
 7:{coordination:'Le chant maintient une caisse contre une butée tout en en livrant une autre. La troisième doit revenir sur la plateforme, et le Magicien sortir, avant que les deux premiers poids changent de rôle.',ss24:'SS24 N7 protégeait le stationnement d’un miroir de trois presses et combinait une plateforme temporaire avec un appui mobile. SS25 transforme une charge rapportée en appui lors du retrait de la plateforme, puis libère les deux anciens poids pour la sortie.',evidence:'Le retour trop tôt retire le pont vide ; après livraison il crée l’appui mais enferme localement le Magicien resté en bas. Le départ chanté reprend les deux poids, tandis que quatre tractions passives permettent un départ sûr.',limit:'La reprise d’une commande peut rouvrir la réserve. Le rapport ne qualifie pas ces contrebranches d’impasses globales.'},
 8:{coordination:'Deux monstres sont les poids provisoires de deux familles de plateformes. Deux miroirs les retirent ensemble ; cette libération ferme aussi la presse, dont la charge doit remplacer le Magicien et combler une sixième case d’eau.',ss24:'SS24 N8 achevait un tableau de trois dépôts avec une réserve échangée et une plateforme locale. SS25 organise une transition entre accès de chantier et retour central, avec deux poids retirés, cinq plateformes activées, un appui créé et un passage du Barde qui peut déplacer cet appui.',evidence:'Une libération avant remplacement du Magicien est mortelle. Un Voleur resté dans le rayon ne libère qu’un circuit. Un Magicien qui remonte reprend la caisse par échange. Faire passer le Barde trop tôt déplace l’appui et refuse le pas suivant du Guerrier.',limit:'Le témoin final est plus court que celui de SS24. La charge de raisonnement visée tient aux conséquences combinées de la même libération, sans preuve de difficulté humaine supérieure pour chaque joueur ni nécessité globale de l’ordre du témoin.'}
};

try{
 const historical=[];for(let series=14;series<=24;series++){const specs=levelsFromSource(series);assert.equal(specs.length,8,`SS${series}: eight historical maps`);for(const s of specs)historical.push({game:'SS'+series,id:s.id,title:s.title,terrainSha256:canonicalTerrain(s.rows)});}assert.equal(historical.length,88);
 report.layoutComparison={previousGames:Array.from({length:11},(_,i)=>'SS'+(14+i)),previousLevels:88,method:'Murs extérieurs retirés, occupants normalisés en sol, eau conservée, minimum canonique des huit symétries du plan.',historical};
 const oldSpecs=levelsFromSource(24),oldRuns=[];
 for(let i=0;i<8;i++){const d=read(new URL(`../../../sinking-star-ss24/reference/level${i+1}-design.json`,import.meta.url));assert.deepEqual(d.spec,oldSpecs[i]);const r=direct(d.spec,d.actions,previous);compareDesign(d,r);oldRuns.push(r);}
 report.ss24Baseline={method:'Les huit témoins SS24 sont eux aussi rejoués directement avec leur propre moteur, sans réutiliser leurs métriques déclarées comme preuve.',levels:oldRuns.map((r,i)=>({level:i+1,title:r.spec.title,mapSha256:hash(r.spec),actionsSha256:hash(r.timeline.map(t=>t.action)),metrics:r.metrics,structure:signature(r),complete:r.state.complete}))};
 let published=[];try{published=levelsFromSource(25);}catch(error){report.pending.push('src/levels.ts non encore synchronisé : '+error.message);}
 const terrainSeen=new Map(),currentRuns=[];
 for(let n=1;n<=8;n++){
  const path=new URL(`reference/level${n}-design.json`,lab);if(!existsSync(path)){report.pending.push(`N${n} : design absent`);continue;}
  try{
   const d=read(path),r=direct(d.spec,d.actions);assert.equal(d.spec.id,`ss25-${String(n).padStart(2,'0')}`);assert.deepEqual(r.initial.heroes.map(h=>h.kind),roles);
   const stages=compareDesign(d,r),geometry=canonicalTerrain(d.spec.rows);assert.equal(r.world.goals.length,4);assert.equal(new Set(r.world.goals.map(key)).size,4);assert(!r.initial.complete&&!r.initial.dead);
   assert(r.initial.heroes.every(h=>!r.world.goals.some(g=>equal(g,h.at))));for(const g of r.world.gates)assert(!r.world.buttons.some(b=>equal(b,g.at)),'Buttons and presses occupy distinct tiles');
   const repeated=historical.filter(s=>s.terrainSha256===geometry);assert.deepEqual(repeated,[],`${d.spec.id}: exact historical terrain repeat`);assert(!terrainSeen.has(geometry),`${d.spec.id}: repeats SS25 N${terrainSeen.get(geometry)}`);terrainSeen.set(geometry,n);
   const walking=r.initial.heroes.map(h=>fixedWalking(r.world,r.initial,h,current,false)),generousWalking=r.initial.heroes.map(h=>fixedWalking(r.world,r.initial,h,current,true)),matching=matchingSize(generousWalking);assert(matching<4,`${d.spec.id}: fixed-resource walking can assign all four destinations; inspect potential shortcut`);
   const beforeLast=r.world.goals.filter(g=>r.timeline.at(-1).before.heroes.some(h=>equal(h.at,g))).length;assert(beforeLast<4);
   if(!published[n-1]||hash(published[n-1])!==hash(d.spec))report.pending.push(`N${n} : src/levels.ts doit être synchronisé avec le design final`);
   if(!SS25_LEVELS[n-1]||hash(SS25_LEVELS[n-1])!==hash(d.spec))report.pending.push(`N${n} : dist/levels.js doit être reconstruit depuis les sources synchronisées`);
   if(!comparisons[n])report.pending.push(`N${n} : contrebranches et comparaison qualitative indépendante à finaliser`);
   const structure=signature(r);report.levels.push({level:n,title:d.spec.title,mapSha256:hash(d.spec),actionsSha256:hash(d.actions),terrainSha256:geometry,actions:d.actions.length,selections:r.metrics.selections,complete:true,refusedActions:0,deaths:0,goalCountBeforeLastAction:beforeLast,goalCountAfterLastAction:4,independentlyRecountedMetrics:r.metrics,stagesChecked:stages.length,stages,finalPositions:r.state.heroes.map(h=>({role:h.kind,at:h.at})),structure,walking,generousWalking,maximumIndividualWalkingGoalAssignment:matching,exactHistoricalTerrainRepeats:repeated});
   ok(n,'Les données sources, jalons, métriques et actions concordent avec une victoire à quatre héros',{actions:d.actions.length,stages:stages.length,metricsFields:Object.keys(d.metrics).length,goalsBeforeLastAction:beforeLast,goalsAfterLastAction:4});
   targetedBranches(n,r,d);report.shortcutReview.push({level:n,...omissionAudit(r,d)});currentRuns.push(r);
  }catch(error){report.errors.push({level:n,error:error.stack});}
 }
 report.structuralComparison=currentRuns.map(r=>{const n=Number(r.spec.id.slice(-2)),old=oldRuns[n-1],now=signature(r),before=signature(old);return{level:n,ss24Title:old.spec.title,ss25Title:r.spec.title,ss24:{actions:old.metrics.actions,selections:old.metrics.selections,filePushes:before.filePushes,maximumPushedOccupants:before.maximumPushedOccupants,circuits:before.circuits,buttons:before.buttons,presses:before.presses,supportsCreated:before.supportsCreated,supportMoves:before.supportMoves,mirrorMoves:before.mirrorMoves,combatWaves:before.combatWaves,activePowerKinds:before.activePowerKinds},ss25:{actions:r.metrics.actions,selections:r.metrics.selections,filePushes:now.filePushes,mixedFilePushes:now.mixedFilePushes,maximumPushedOccupants:now.maximumPushedOccupants,circuits:now.circuits,buttons:now.buttons,presses:now.presses,supportsCreated:now.supportsCreated,supportMoves:now.supportMoves,mirrorMoves:now.mirrorMoves,combatWaves:now.combatWaves,activePowerKinds:now.activePowerKinds},counterBranches:report.counterBranches.filter(b=>b.level===n).map(b=>b.name),qualitative:comparisons[n]??{pending:'La comparaison qualitative attend les cartes et contrebranches finales.'},interpretation:'Dimensions observées sur deux parcours ; les différences de longueur ou de quantité ne sont pas un score de difficulté.'};});
 report.success=report.levels.length===8&&report.errors.length===0&&report.pending.length===0;
 report.status=report.success?'passed':report.errors.length?'failed':'incomplete';
}catch(error){report.errors.push({error:error.stack});report.status='failed';}
writeFileSync(new URL('reference/independent-ss25-review.json',lab),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,status:report.status,levels:report.levels.length,checks:report.checks.length,counterBranches:report.counterBranches.length,winningOmissions:report.shortcutReview.reduce((sum,r)=>sum+r.winningVariants.length,0),historicalLevels:report.layoutComparison?.previousLevels,pending:report.pending,errors:report.errors},null,2));
if(!report.success&&!process.argv.includes('--partial'))process.exitCode=1;
