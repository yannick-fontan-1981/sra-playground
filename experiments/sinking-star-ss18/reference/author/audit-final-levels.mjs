/** Independent design review. Reads maps and witnesses; writes only its report. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,cellToPixel,circuitPressed,contains,traceSwap,gateClosed,renderWorld} from '../../dist/core.js';
import {replay,stateKey} from '../../scripts/solver.mjs';

const load=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const designs=[5,6,7,8].map(load),checks=[],alternatives=[];
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const pick=(w,s,role)=>stepDetailed(w,s,6,cellToPixel(hero(s,role).at)).state;
const note=(level,name,observed,details={})=>checks.push({level,name,passed:true,observed,...details});

// This finite graph holds both partners and every resource fixed. It is a
// deliberately narrower question than solvability of the whole room.
function initialWalking(w,s,role){
 const first=pick(w,s,role),queue=[first],seen=new Set([stateKey(first)]),goals=new Set();
 for(let head=0;head<queue.length;head++){
  const state=queue[head];w.goals.forEach((p,i)=>{if(eq(p,state.heroes[state.active].at))goals.add(i);});
  for(const id of [1,2,3,4]){
   const d=stepDetailed(w,state,id);if(d.state.failed||d.state.dead)continue;
   if(d.phases.some(p=>!['walk','gate','platform'].includes(p.kind)||p.moves.some(m=>m.actor!=='hero'||!eq(m.from,p.before.heroes[p.before.active].at))))continue;
   const key=stateKey(d.state);if(seen.has(key))continue;seen.add(key);queue.push(d.state);
  }
 }
 return{role,states:seen.size,reachableGoals:[...goals].map(i=>w.goals[i])};
}

function canonicalTerrain(spec){
 let rows=spec.rows.map(r=>[...r].map(c=>c==='#'?'#':c==='~'||c==='s'?'~':'.').join(''));
 const cells=rows.flatMap((r,y)=>[...r].flatMap((c,x)=>c==='#'?[]:[{x,y}]));
 const minX=Math.min(...cells.map(p=>p.x)),maxX=Math.max(...cells.map(p=>p.x));
 const minY=Math.min(...cells.map(p=>p.y)),maxY=Math.max(...cells.map(p=>p.y));
 rows=rows.slice(minY,maxY+1).map(r=>r.slice(minX,maxX+1));const forms=[];
 for(let i=0;i<4;i++){forms.push(rows.join('\n'),rows.map(r=>[...r].reverse().join('')).join('\n'));rows=Array.from({length:rows[0].length},(_,x)=>rows.map(r=>r[x]).reverse().join(''));}
 return forms.sort()[0];
}
const previous=[];
for(const episode of [14,15,16,17]){
 const source=readFileSync(new URL(`../../../sinking-star-ss${episode}/src/levels.ts`,import.meta.url),'utf8');
 const specs=JSON.parse(source.slice(source.indexOf('=')+1).trim().replace(/;\s*$/,''));
 for(const [i,spec]of specs.entries())previous.push({episode,level:i+1,terrain:canonicalTerrain(spec)});
}

const levels=designs.map((d,i)=>{
 const level=i+5,w=compileLevel(d.spec),s=initialState(w),r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.deepEqual(r.metrics,d.metrics);
 assert(w.gates.every(g=>!w.buttons.some(b=>eq(b,g.at))));
 const walking=w.heroes.map(h=>initialWalking(w,s,h.kind));
 const duplicates=previous.filter(p=>p.terrain===canonicalTerrain(d.spec)).map(({terrain,...p})=>p);assert.equal(duplicates.length,0);
 return{level,title:d.spec.title,reference:{entries:r.metrics.actions,selections:r.metrics.selections,nonSelectionActions:r.metrics.actions-r.metrics.selections,result:'WIN',metrics:r.metrics},initialWalking:walking,goals:w.goals,exactTerrainDuplicatesAfterRotationOrReflection:duplicates};
});

// N5: the encounter and the retained guardians have different real outcomes.
{
 const d=designs[0],r=replay(d.spec,d.commands),fight=replay(d.spec,d.commands.slice(0,d.stages[0].turn));
 assert.equal(fight.metrics.monstersRemoved,2);assert.equal(fight.state.monsters.length,2);
 assert(circuitPressed(r.world,r.state,'gardiens'));assert.equal(r.state.monsters.length,2);
 assert(r.world.circuits[0].buttons.every(p=>contains(r.state.monsters,p)));
 note(5,'Deux adversaires combattus, deux gardiens conservés','Le témoin élimine exactement deux monstres ; les deux survivants maintiennent les commandes à la victoire.');
 const a=new Author(d.spec).act(d.commands.slice(0,d.stages[1].turn)).select('wizard').act('U');
 assert(!circuitPressed(a.world,a.state,'gardiens'));assert(contains(a.state.monsters,{x:13,y:16}));
 note(5,'Échange depuis le mauvais côté','Le gardien est bien déplacé, mais sur une case ordinaire ; cette commande reste vide.',{commands:a.commands,scope:'Contre-branche locale réparable.'});
}

// N6: a mirror retained on its used station really blocks the global finale.
{
 const d=designs[1],a=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn)).go(7,10,'merchant');
 const result=stepDetailed(a.world,a.state,5);assert(result.state.failed);assert(!result.state.dead);assert(result.blockedMirrorIndices.includes(0));
 assert.deepEqual(result.state.heroes.map(h=>h.at),a.state.heroes.map(h=>h.at));
 note(6,'Retrait du miroir devenu obstacle','Sans déplacer le miroir après le départ est, le reflet final est refusé globalement et le miroir concerné est identifié.',{commands:a.commands+'X',blockedMirrorIndices:result.blockedMirrorIndices});
}

// N7: the early optical bypass is closed, but a later shorter exchange is valid.
{
 const d=designs[2],a=new Author(d.spec).go(8,10,'wizard');
 assert.equal(traceSwap(a.world,a.state,'E').plan,null);
 note(7,'Fenêtre de relève initialement fermée','La visée ne peut pas prendre directement la caisse terminale avant le dépôt dans l’alcôve précédente.');
 const alt=new Author(d.spec).act(d.commands.slice(0,d.stages[2].turn));
 alt.go(8,10,'wizard').act('R').go(13,10);
 alt.go(11,8,'merchant').act('UURR');alt.select('bard').act('LDDDDDDLLL');
 const r=replay(d.spec,alt.commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.equal(r.metrics.actions,43);assert.equal(r.metrics.supportMoves,10);
 alternatives.push({level:7,commands:alt.commands,metrics:r.metrics,result:'WIN',observed:'Échanger la caisse terminale après le dépôt de la réserve évite la troisième traversée et l’immersion terminale. Les deux premières traversées, le poids persistant et dix déplacements d’appui restent exercés.',decision:'Alternative conservée ; ne pas présenter les étapes évitées comme nécessaires dans toutes les solutions.'});
}

// N8: a resource invariant applies to every legal winning state. It does not
// prescribe a route: no hidden milestone or action counter participates in WIN.
{
 const d=designs[3],w=compileLevel(d.spec),s=initialState(w),r=replay(d.spec,d.commands);
 const reserve={x:16,y:3},accord=w.circuits.find(c=>c.id==='accord');
 const keys=ps=>ps.map(p=>`${p.x},${p.y}`),weights=state=>[...state.stones,...state.monsters,...state.mirrors.map(m=>m.at)];
 const goalGuards=w.gates.flatMap((g,i)=>contains(w.goals,g.at)?[{...g,index:i}]:[]);
 assert(accord);assert.equal(accord.buttons.length,4);assert.equal(new Set(keys(accord.buttons)).size,4);
 assert(accord.buttons.every(p=>!contains(w.goals,p)&&!w.gates.some(g=>eq(g.at,p))));
 assert.equal(w.heroes.length,3);assert.equal(w.goals.length,3);assert.equal(new Set(keys(w.goals)).size,3);
 assert.equal(w.stones.length,3);assert.equal(w.mirrors.length,1);assert.equal(w.monsters.length,0);
 assert.equal(w.supports.length,1);assert(contains(w.supports,{x:7,y:13}));
 assert(contains(w.stones,reserve));assert(!contains(accord.buttons,reserve));
 assert.equal(goalGuards.length,1);assert(goalGuards.every(g=>g.circuit==='accord'&&g.closedWhen==='released'));
 assert(goalGuards.every(g=>gateClosed(w,s,g.index)&&!gateClosed(w,r.state,g.index)));
 assert(circuitPressed(w,r.state,'accord'));assert(!circuitPressed(w,r.state,'hydraulique'));
 assert.equal(weights(r.state).length,4);assert.equal(new Set(keys(weights(r.state))).size,4);
 assert(accord.buttons.every(p=>contains(weights(r.state),p)));
 assert(r.state.heroes.every(h=>contains(w.goals,h.at)&&!contains(accord.buttons,h.at)));
 assert(contains(r.state.supports,{x:8,y:10}));
 const reserveIndex=w.stones.findIndex(p=>eq(p,reserve));
 assert(contains(accord.buttons,r.state.stones[reserveIndex]));
 for(const t of r.trace){
  const states=[t.before,t.after,...t.phases.flatMap(p=>[p.before,p.after])];
  assert(states.every(x=>x.stones.length===3&&x.mirrors.length===1&&x.monsters.length===0&&x.supports.length===1));
 }
 const extractionTurn=r.trace.findIndex(t=>!contains(t.after.stones,reserve))+1;
 assert(extractionTurn>0);
 const laterMirrorMoves=r.trace.slice(extractionTurn).flatMap(t=>t.phases.flatMap(p=>p.moves.filter(m=>m.actor==='mirror')));
 assert(laterMirrorMoves.some(m=>m.from.x!==m.to.x)&&laterMirrorMoves.some(m=>m.from.y!==m.to.y));
 note(8,'Certificat matériel : quatre poids pour quatre commandes',
  'Toute victoire exige les trois caisses sèches et le miroir sur les quatre boutons. La réserve nord-est ne peut rester dans son alcôve ; immerger ou perdre une caisse ou perdre le miroir retire un poids indispensable.',{
   certificate:{
    type:'Resource-counting invariant under the unchanged engine rules',
    buttons:accord.buttons,guardedGoals:goalGuards.map(({at,direction})=>({at,direction})),
    initialNonHeroWeights:{crates:3,mirrors:1,monsters:0,total:4},initialSupports:1,
    reserve:{initial:reserve,final:r.state.stones[reserveIndex],firstMovedAtEntry:extractionTurn},
    finalWeights:weights(r.state),referenceConservesEveryWeight:true,mirrorMovesAfterExtraction:laterMirrorMoves.length,
    argument:[
     'A live hero cannot remain in a closed press: entry is blocked and closure expels or crushes its occupant. The guarded destination therefore requires accord to be pressed at a legal WIN.',
     'The three living heroes occupy the three distinct goals at WIN. None of the four distinct accord buttons overlaps a goal or a press, so neither a hero nor a closed press can supply a final weight.',
     'The level starts with exactly three crates, one mirror and no monsters. Moves, songs, swaps and reflections relocate those objects; buoyancy or crushing can remove a weight but no rule creates or duplicates one.',
     'A submerged support is not a weight, cannot return to dry crate form and remains on water. The initial reusable support and any extra support cannot replace a missing final weight.',
     'Four nonhero weights are consequently required and exactly four exist. Every original crate, including the reserve initially outside all final buttons, and the original mirror must survive and occupy those buttons.'
    ],
    scope:'Necessity of the four physical weights in every reachable winning state under these rules. This is not an exhaustive state-space search, a unique solution, a mandatory order or a minimum-action proof.'
   }
  });

 // Keep the old map as a small historical regression fixture. Both bypasses
 // must first reproduce their genuine 0.1.1 WIN before failing on the revision.
 const previousSpec={"id":"ss18-08","title":"La cour au cœur du lac","rows":["####################","#..................#","#..............~~~.#","#............o.~o~.#","#..............~~~.#","#..................#","#..B..~~~~~~~~..M..#","#.....~~~~~~~~.....#","#....Z~~~~~~~~.....#","#......~~g.g~~.....#","#.......~...~~.....#","#......~~.g.~~.....#","##.....~~~~~~~.....#","#.....~~~~~~~~.....#","#..#...............#","#..................#","#........o.........#","#..................#","#..................#","####################"],"facing":"N","mirrors":[{"at":{"x":16,"y":7},"facing":"NW"}],"circuits":[{"id":"hydraulique","buttons":[{"x":13,"y":3}],"color":10},{"id":"accord","buttons":[{"x":13,"y":5},{"x":3,"y":15}],"color":15}],"gates":[{"at":{"x":16,"y":5},"circuit":"hydraulique","direction":"S","closedWhen":"released"},{"at":{"x":9,"y":10},"circuit":"accord","direction":"E","closedWhen":"released"}],"platforms":[{"at":{"x":16,"y":4},"circuit":"hydraulique","activeWhen":"pressed"}]};
 const oldBypasses=[{"name":"mirror-weight-shortcut","commands":"LDDRUURULLLCUUUUURCLUUUUURDDDDDDDDDDDDLLCCUURRRRRDDDDDDDDDDDLDLDRUUUUUUUCCDDDDDDDDDDDLLLLLLDLUUULLUUUUULLCCDDDDDLLLLLLLLLLLLLUUUUUURDURUURRRRRUCDRRRRRRUCDDDRRRRRRRDR","oldEntries":165},{"name":"two-supports-shortcut","commands":"LDDDDDDDDDDLLLLLLLDLUUURRRRRRRUUUUUUUUUUUUURRRCUUUUUURRRRRUCDDDDDDDRRULUUUUUUUUUUULCCDDLLLLLRCDDDDDDDDDCCDDLLLLLLLLLDDDDDRLCRRLUCCDDRRULUUUULLCRRRRRUUCLLLDDDDLLLLLLLLLDDDDDDRRRRRUULCDDDDDDRRRRRRR","oldEntries":195}];
 for(const old of oldBypasses){
  const before=replay(previousSpec,old.commands),after=replay(d.spec,old.commands);
  assert(before.state.complete);assert.equal(before.metrics.blocked,0);assert.equal(before.metrics.deaths,0);
  assert.equal(before.metrics.actions,old.oldEntries);assert(before.trace.every(t=>contains(t.after.stones,reserve)));
  assert(!after.state.complete&&!after.state.dead);assert(after.metrics.blocked>0);
  assert(after.trace.every(t=>contains(t.after.stones,reserve)));
  assert(!after.trace.some(t=>circuitPressed(after.world,t.after,'accord')));
  const wizard=pick(w,after.state,'wizard'),attempt=stepDetailed(w,wizard,4);
  assert(attempt.state.failed&&!attempt.state.dead&&!attempt.state.complete);
  if(old.name==='two-supports-shortcut'){
   assert(eq(hero(wizard,'wizard').at,{x:9,y:11}));
   assert(goalGuards.some(g=>eq(g.at,{x:10,y:11})&&gateClosed(w,wizard,g.index)));
  }
  note(8,'Ancien contournement fermé : '+old.name,
   old.name==='two-supports-shortcut'
    ?'Les deux appuis conduisent encore le Magicien dans la cour, mais la destination sous presse reste fermée : le pas depuis (9,11) vers (10,11) est refusé.'
    :'Le miroir remplaçant une caisse ne suffit plus à alimenter les quatre commandes ; la réserve reste inutilisée et la campagne ne gagne pas.',{
    baselineVersion:'0.1.1',commands:old.commands,baselineResult:'WIN',baselineEntries:before.metrics.actions,
    revisedResult:'NOT_FINISHED',revisedBlockedEntries:after.metrics.blocked,revisedDeaths:after.metrics.deaths,
    reserveUnchanged:true,accordEverPressed:false,finalAttempt:'Wizard east',finalAttemptRefused:true,
    scope:'Concrete replay regression. The resource certificate, rather than these two routes alone, establishes the general necessity of the reserve.'
   });
 }

 const intercepted=new Author(d.spec).act('D').select('wizard').act('R');
 assert(eq(hero(intercepted.state,'wizard').at,{x:16,y:7}));assert(contains(intercepted.state.stones,reserve));
 note(8,'Marchand dans la première cible','Le Magicien échange avec le Marchand resté devant le miroir ; la réserve demeure dans l’alcôve.',{commands:intercepted.commands});
 const returnTooSoon=new Author(d.spec).act(d.commands.slice(0,extractionTurn)).act('D');
 assert(contains(returnTooSoon.state.stones,reserve));assert(eq(hero(returnTooSoon.state,'wizard').at,{x:5,y:8}));
 note(8,'Retour avant dégagement du rayon','Le retour immédiat du Magicien replace la caisse dans son alcôve.',{commands:returnTooSoon.commands});
 const early=new Author(d.spec).act(d.commands.slice(0,extractionTurn));early.go(13,2,'merchant').act('DL').select('wizard');
 assert(!circuitPressed(early.world,early.state,'hydraulique'));const closed=stepDetailed(early.world,early.state,2);assert(closed.state.failed);assert(!closed.state.dead);
 note(8,'Commande hydraulique retirée trop tôt','La tentative de retour par le sud est refusée après fermeture du passage et disparition de la plateforme.',{commands:early.commands+'D'});
 const bardDeposit=d.stages.find(stage=>contains(stage.stones,{x:3,y:15})&&eq(hero(stage,'bard').at,{x:1,y:13}));
 assert(bardDeposit);
 const bard=new Author(d.spec).act(d.commands.slice(0,bardDeposit.turn));
 assert(stepDetailed(bard.world,bard.state,1).state.failed);
 const east=stepDetailed(bard.world,bard.state,4);assert(!east.state.failed);assert(contains(east.state.stones,{x:4,y:15}));
 note(8,'Séparation locale du chant','Le départ nord du Barde est fermé ; partir vers l’est retire le poids. L’échange du témoin laisse sa commande occupée.',{scope:'Constat local ; une autre réorganisation plus longue reste permise.'});
 const supportReady=d.stages.find(stage=>contains(stage.supports,{x:8,y:10})&&eq(hero(stage,'bard').at,{x:6,y:10}));
 assert(supportReady);
 const turn=new Author(d.spec).act(d.commands.slice(0,supportReady.turn)).act('RRRU');
 assert(contains(turn.state.supports,{x:8,y:9}));assert(!contains(turn.state.supports,{x:8,y:10}));
 turn.go(7,10,'merchant');assert(stepDetailed(turn.world,turn.state,4).state.failed);
 note(8,'Virage prématuré dans la cour','Monter dès la première case intérieure déplace l’appui vers le nord et refuse le passage suivant du Marchand.',{commands:turn.commands+'R'});

 // Reach this branch only by public actions from the initial room. A hero can
 // temporarily replace a lost crate, but must leave that plate to finish.
 const release=new Author(d.spec).act(d.commands.slice(0,-1));
 release.go(13,4,'merchant').go(10,11,'wizard').select('merchant').act('D');
 assert.equal(release.state.stones.length,2);assert.equal(release.state.supports.length,2);
 assert(contains(release.state.supports,{x:13,y:6}));assert(circuitPressed(w,release.state,'accord'));
 assert(eq(hero(release.state,'merchant').at,{x:13,y:5}));assert(eq(hero(release.state,'wizard').at,{x:10,y:11}));
 const expelled=stepDetailed(w,release.state,1),releaseRoute=release.commands+'U',releaseReplay=replay(d.spec,releaseRoute);
 assert.deepEqual(releaseReplay.state,expelled.state);assert.equal(releaseReplay.metrics.blocked,0);assert.equal(releaseReplay.metrics.deaths,0);
 assert(!expelled.state.failed&&!expelled.state.dead&&!expelled.state.complete);
 assert(expelled.phases.some(p=>p.kind==='piston'&&p.gateIndex===goalGuards[0].index));
 assert(eq(hero(expelled.state,'wizard').at,{x:10,y:10}));assert(gateClosed(w,expelled.state,goalGuards[0].index));
 assert(!circuitPressed(w,expelled.state,'accord'));assert.equal(weights(expelled.state).length,3);
 note(8,'Un héros ne peut remplacer durablement un poids perdu',
  'Après immersion de la caisse du bouton (13,5), le Marchand maintient encore le circuit en restant sur son bouton. Dès qu’il remonte, la presse de la destination expulse réellement le Magicien vers (10,10). Tous vivent, mais seuls trois poids non héros subsistent pour quatre commandes.',{
   commands:releaseRoute,entries:releaseReplay.metrics.actions,blocked:0,deaths:0,
   remainingNonHeroWeights:3,requiredFinalWeights:4,submergedSupports:2,
   temporaryHeroRelay:true,goalPressExpelledHero:true,goalAfterRelease:hero(expelled.state,'wizard').at,
   scope:'A reachable counter-branch demonstrates the physical release. The resource invariant makes the lost-weight state unwinnable without Undo or Reset.'
  });

 const tile=(state,p)=>{const frame=renderWorld(w,state),pixel=cellToPixel(p);return frame.slice(pixel.y,pixel.y+3).map(row=>row.slice(pixel.x,pixel.x+3));};
 const closedTile=tile(s,goalGuards[0].at),openState=r.trace.find(t=>circuitPressed(w,t.after,'accord')&&!t.after.heroes.some(h=>eq(h.at,goalGuards[0].at))).after;
 const openTile=tile(openState,goalGuards[0].at);
 assert.equal(closedTile[1][1],5);assert.equal(openTile[1][1],3);
 for(const image of [closedTile,openTile]){assert([image[0][0],image[0][2],image[2][0],image[2][2]].every(c=>c===11));assert(!image.flat().includes(9));}
 note(8,'Destination sous presse lisible','Les quatre coins jaunes du but restent visibles, le centre est noir fermé puis gris ouvert, sans pixel bleu parasite.',{closedPixels:closedTile,openPixels:openTile});
}

const report={success:true,levels,checks,acceptedAlternatives:alternatives,variety:{comparedEpisodes:[14,15,16,17],comparedMaps:previous.length,exactTerrainDuplicates:0,observations:[
 'N5 est une arène : deux dangers sont rapprochés tandis que deux autres deviennent des contrepoids. Les sorties sont réparties autour de la salle.',
 'N6 fait voyager le même miroir entre deux postes, puis le retire de l’axe optique. Le rythme est celui d’un équipement réaffecté, sans caisse de pont.',
 'N7 adopte un peigne d’alcôves et un chenal parallèle, avec des postes de stationnement hors du chant. La première destination accessible sert de parking utile.',
 'N8 vise une cour centrale entourée d’eau ; trois caisses et un miroir réaffecté doivent alimenter quatre commandes, tandis qu’un appui immergé initial prépare le passage.',
 'L’absence de doublon exact de terrain complète la lecture des problèmes ; elle ne constitue pas, à elle seule, une mesure de variété ou de difficulté.'
 ]},remainingCorrections:[],scope:'Lecture indépendante des cartes, rejeux complets, petits graphes de marche initiale, contre-branches locales, variante constructive N7, certificat matériel N8, anciens contournements rejoués et expulsion atteinte depuis la carte initiale. La nécessité des quatre poids de N8 est établie par décompte ; aucune recherche exhaustive à trois héros, unicité, nécessité universelle des pouvoirs ou optimalité des parcours n’est revendiquée. Les maps et builders N5–8 restent en lecture seule.'};
writeFileSync(new URL('../final-levels-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:levels.map(l=>({level:l.level,entries:l.reference.entries,nonSelectionActions:l.reference.nonSelectionActions,walking:l.initialWalking})),checks:checks.length,acceptedAlternatives:alternatives.length,comparedMaps:previous.length,remainingCorrections:0}));
