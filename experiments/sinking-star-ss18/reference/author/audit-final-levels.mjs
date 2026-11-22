/** Independent design review. Reads maps and witnesses; writes only its report. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,cellToPixel,circuitPressed,contains,traceSwap,gateClosed,platformActive} from '../../dist/core.js';
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

// Geometric lower bound only: every new water cell on a simple walking path
// costs one support. Actors and powers are ignored, so this is not a solver.
function minimumWaterCells(w,s,centralGateOpen){
 const costs=Array(400).fill(Infinity),done=new Set();for(const h of s.heroes)costs[h.at.y*20+h.at.x]=0;
 for(let k=0;k<400;k++){
  let index=-1;for(let j=0;j<400;j++)if(!done.has(j)&&(index<0||costs[j]<costs[index]))index=j;
  if(index<0||!Number.isFinite(costs[index]))break;done.add(index);
  const p={x:index%20,y:Math.floor(index/20)};
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
   const q={x:p.x+dx,y:p.y+dy};if(q.x<0||q.x>=20||q.y<0||q.y>=20)continue;
   const next=q.y*20+q.x;if(w.terrain[next]==='#')continue;
   if(w.gates.some((g,i)=>eq(g.at,q)&&(g.circuit==='accord'?!centralGateOpen:gateClosed(w,s,i))))continue;
   const isActivePlatform=w.platforms.some((a,i)=>eq(a.at,q)&&platformActive(w,s,i));
   const cost=w.terrain[next]==='~'&&!contains(s.supports,q)&&!isActivePlatform?1:0;
   costs[next]=Math.min(costs[next],costs[index]+cost);
  }
 }
 return Math.min(...w.goals.map(p=>costs[p.y*20+p.x]));
}

// N8: resource budget, first target, hydraulic return and central entry.
{
 const d=designs[3],w=compileLevel(d.spec),s=initialState(w),r=replay(d.spec,d.commands);
 assert.equal(minimumWaterCells(w,s,false),2);assert.equal(minimumWaterCells(w,s,true),1);
 assert.equal(r.state.stones.length,2);assert.equal(r.state.supports.length,1);assert(circuitPressed(w,r.state,'accord'));
 assert(!circuitPressed(w,r.state,'hydraulique'));assert(contains(r.state.supports,{x:8,y:10}));
 note(8,'Budget géométrique des ressources','Avec un seul appui neuf, l’entrée doit emprunter la porte accord. Un passage qui évite cette porte exige au moins deux cases d’eau comblées. Le témoin conserve deux poids secs et un seul appui immergé.',{minimumNewWaterCellsWithAccordClosed:2,minimumNewWaterCellsWithAccordOpen:1,scope:'Borne géométrique des chemins à pied. Les pouvoirs peuvent changer la répartition des héros ; aucune impossibilité globale de solution alternative n’est déduite.'});
 const intercepted=new Author(d.spec).act('D').select('wizard').act('R');
 assert(eq(hero(intercepted.state,'wizard').at,{x:16,y:7}));assert(contains(intercepted.state.stones,{x:16,y:3}));
 note(8,'Marchand dans la première cible','Le Magicien échange avec le Marchand resté devant le miroir ; la réserve demeure dans l’alcôve.',{commands:intercepted.commands});
 const returnTooSoon=new Author(d.spec).act(d.commands.slice(0,d.stages[1].turn)).act('D');
 assert(contains(returnTooSoon.state.stones,{x:16,y:3}));assert(eq(hero(returnTooSoon.state,'wizard').at,{x:5,y:8}));
 note(8,'Retour avant dégagement du rayon','Le retour immédiat du Magicien replace la caisse dans son alcôve.',{commands:returnTooSoon.commands});
 const early=new Author(d.spec).act(d.commands.slice(0,d.stages[1].turn));early.go(13,2,'merchant').act('DL').select('wizard');
 assert(!circuitPressed(early.world,early.state,'hydraulique'));const closed=stepDetailed(early.world,early.state,2);assert(closed.state.failed);assert(!closed.state.dead);
 note(8,'Commande hydraulique retirée trop tôt','La tentative de retour par le sud est refusée après fermeture du passage et disparition de la plateforme.',{commands:early.commands+'D'});
 const bard=new Author(d.spec).act(d.commands.slice(0,d.stages[2].turn));
 assert(stepDetailed(bard.world,bard.state,1).state.failed);
 const east=stepDetailed(bard.world,bard.state,4);assert(!east.state.failed);assert(contains(east.state.stones,{x:4,y:15}));
 note(8,'Séparation locale du chant','Le départ nord du Barde est fermé ; partir vers l’est retire le poids. L’échange du témoin laisse sa commande occupée.',{scope:'Constat local ; une autre réorganisation plus longue reste permise.'});
 const turn=new Author(d.spec).act(d.commands.slice(0,d.stages[6].turn)).act('RRRU');
 assert(contains(turn.state.supports,{x:8,y:9}));assert(!contains(turn.state.supports,{x:8,y:10}));
 turn.go(7,10,'merchant');assert(stepDetailed(turn.world,turn.state,4).state.failed);
 note(8,'Virage prématuré dans la cour','Monter dès la première case intérieure déplace l’appui vers le nord et refuse le passage suivant du Marchand.',{commands:turn.commands+'R'});
}

const report={success:true,levels,checks,acceptedAlternatives:alternatives,variety:{comparedEpisodes:[14,15,16,17],comparedMaps:previous.length,exactTerrainDuplicates:0,observations:[
 'N5 est une arène : deux dangers sont rapprochés tandis que deux autres deviennent des contrepoids. Les sorties sont réparties autour de la salle.',
 'N6 fait voyager le même miroir entre deux postes, puis le retire de l’axe optique. Le rythme est celui d’un équipement réaffecté, sans caisse de pont.',
 'N7 adopte un peigne d’alcôves et un chenal parallèle, avec des postes de stationnement hors du chant. La première destination accessible sert de parking utile.',
 'N8 vise une cour centrale entourée d’eau ; la préparation se déroule dans une galerie périphérique et trois ressources changent de rôle.',
 'L’absence de doublon exact de terrain complète la lecture des problèmes ; elle ne constitue pas, à elle seule, une mesure de variété ou de difficulté.'
 ]},remainingCorrections:[],scope:'Lecture indépendante des cartes, rejeux complets, petits graphes de marche initiale, contre-branches locales, variante constructive N7 et borne géométrique N8. Aucune recherche exhaustive à trois héros, unicité, nécessité universelle des pouvoirs ou optimalité des parcours n’est revendiquée. Les maps et builders N5–8 restent en lecture seule.'};
writeFileSync(new URL('../final-levels-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:levels.map(l=>({level:l.level,entries:l.reference.entries,nonSelectionActions:l.reference.nonSelectionActions,walking:l.initialWalking})),checks:checks.length,acceptedAlternatives:alternatives.length,comparedMaps:previous.length,remainingCorrections:0}));
