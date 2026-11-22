import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed,cellToPixel,circuitPressed,contains} from '../../dist/core.js';
import {replay,stateKey} from '../../scripts/solver.mjs';
import {Author} from './author.mjs';

// Independent review: read the builders and their saved designs without executing
// or editing the builders. Only this review JSON is written by this script.
const load=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const designs=[2,3,4].map(load);
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const pick=(world,state,role)=>stepDetailed(world,state,6,cellToPixel(state.heroes.find(h=>h.kind===role).at)).state;

// A small single-character graph, with the two partners and all resources fixed.
// Walking may update a circuit, but pushes, songs, spells, reflections and
// transported occupants are excluded. This is not a three-character solver.
function unassistedWalk(world,initial,role){
 const first=pick(world,initial,role),queue=[first],seen=new Set([stateKey(first)]),goals=new Set();let transitions=0;
 for(let head=0;head<queue.length;head++){
  const state=queue[head],hero=state.heroes[state.active];
  world.goals.forEach((p,i)=>{if(eq(p,hero.at))goals.add(i);});
  for(const id of [1,2,3,4]){
   transitions++;const detail=stepDetailed(world,state,id);
   if(detail.state.failed||detail.state.dead)continue;
   if(detail.phases.some(p=>!['walk','gate','platform'].includes(p.kind)))continue;
   if(detail.phases.some(p=>p.moves.some(m=>m.actor!=='hero'||!eq(m.from,p.before.heroes[p.before.active].at))))continue;
   const key=stateKey(detail.state);if(seen.has(key))continue;seen.add(key);queue.push(detail.state);
  }
 }
 return{role,positions:seen.size,transitions,reachableGoals:[...goals].map(i=>world.goals[i])};
}

// Exact terrain comparison is deliberately modest: the absence of a duplicate
// does not, by itself, prove an original or interesting puzzle.
function terrainRows(spec){return spec.rows.map(r=>[...r].map(c=>c==='#'?'#':c==='~'||c==='s'?'~':'.').join(''));}
function crop(rows){
 const points=rows.flatMap((row,y)=>[...row].flatMap((c,x)=>c==='#'?[]:[{x,y}]));
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 return rows.slice(minY,maxY+1).map(r=>r.slice(minX,maxX+1));
}
const rotate=rows=>Array.from({length:rows[0].length},(_,x)=>rows.map(r=>r[x]).reverse().join(''));
function canonicalTerrain(spec){
 let rows=crop(terrainRows(spec));const variants=[];
 for(let i=0;i<4;i++){variants.push(rows.join('\n'),rows.map(r=>[...r].reverse().join('')).join('\n'));rows=rotate(rows);}
 return variants.sort()[0];
}
const previous=[];
for(const episode of [14,15,16,17]){
 const path=new URL(`../../../sinking-star-ss${episode}/src/levels.ts`,import.meta.url);
 const text=readFileSync(path,'utf8'),start=text.indexOf('=')+1;
 const specs=JSON.parse(text.slice(start).trim().replace(/;\s*$/,''));
 assert.equal(specs.length,8);
 for(const [i,spec]of specs.entries())previous.push({episode,level:i+1,title:spec.title,terrain:canonicalTerrain(spec)});
}

const levels=[];
for(const [index,design]of designs.entries()){
 const level=index+2,world=compileLevel(design.spec),initial=initialState(world),reference=replay(design.spec,design.commands);
 assert.equal(reference.state.complete,true);assert.equal(reference.metrics.blocked,0);assert.equal(reference.metrics.deaths,0);
 assert.equal(world.goals.length,3);assert.ok(world.gates.every(g=>!world.buttons.some(b=>eq(g.at,b))));
 const walking=world.heroes.map(h=>unassistedWalk(world,initial,h.kind));
 assert.ok(walking.every(r=>r.reachableGoals.length===0),`Level ${level} has a goal reachable by unassisted initial walking`);
 const duplicates=previous.filter(p=>p.terrain===canonicalTerrain(design.spec)).map(({terrain,...p})=>p);
 assert.equal(duplicates.length,0);
 levels.push({level,title:design.spec.title,reference:{entries:reference.metrics.actions,moves:reference.metrics.actions-reference.metrics.selections,selections:reference.metrics.selections,result:'WIN',blocked:0,deaths:0},initialUnassistedWalking:walking,layout:{goals:world.goals,pressesAreSeparateFromButtons:true,exactTerrainDuplicatesAfterRotationOrReflection:duplicates},observations:[]});
}

// L2: the east branch is a real two-phase transfer. Both presses point east;
// their activation polarities, rather than their directions, are opposite.
{
 const design=designs[0],r=replay(design.spec,design.commands),world=r.world;
 const east=world.gates.filter(g=>g.at.y===7&&g.at.x>=16);
 assert.equal(east.length,2);assert.ok(east.every(g=>g.direction==='E'));
 assert.deepEqual(east.map(g=>g.closedWhen).sort(),['pressed','released']);
 const transfer=r.trace.find(t=>t.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'&&eq(m.from,{x:16,y:7})&&eq(m.to,{x:17,y:7}))));
 assert.ok(transfer);assert.equal(transfer.after.dead,false);
 levels[0].observations.push({name:'Sas de polarités opposées',result:'confirmed',entry:r.trace.indexOf(transfer)+1,directions:east.map(g=>g.direction),polarities:east.map(g=>g.closedWhen),description:'Le changement de phase transporte réellement le Magicien de la première presse vers la case libérée par la seconde.'});
 levels[0].observations.push({name:'Rythme et géométrie',result:'qualitative-review',description:'La cour autour du bassin sert à recaler une commande distante puis à choisir la phase de trois branches séparées. Le cœur du niveau est la bascule et le transfert du sas, pas la fabrication répétée de ponts ou le rangement de lests finaux.'});
}

// L3: compare a voluntary Bard step with the actual Merchant extraction from
// the same reached state. This counter-branch is legal; it is not a dead-end proof.
{
 const design=designs[1],r=replay(design.spec,design.commands),world=r.world;
 assert.equal(world.buttons.length+world.doors.length+world.gates.length+world.mirrors.length+world.platforms.length,0);
 assert.equal(world.terrain.filter(t=>t==='~').length,0);
 const extraction=r.trace.find(t=>t.phases.some(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='hero'&&eq(m.from,{x:5,y:10})&&eq(m.to,{x:6,y:10}))));
 assert.ok(extraction);assert.deepEqual(extraction.after.stones,extraction.before.stones);
 const voluntary=stepDetailed(world,pick(world,extraction.before,'bard'),4);
 assert.equal(voluntary.state.failed,false);assert.equal(voluntary.state.dead,false);
 assert.ok(contains(voluntary.state.stones,{x:6,y:8})&&contains(voluntary.state.stones,{x:6,y:12}));
 levels[1].observations.push({name:'Tri matériel et départ sans chant',result:'confirmed',entry:r.trace.indexOf(extraction)+1,description:'Le départ volontaire est permis mais rebouche les deux accès verticaux. La poussée du Marchand conserve exactement la disposition des caisses. Aucune commande cachée ni porte de sortie ne fabrique cette contrainte.'});
 levels[1].observations.push({name:'Rythme et géométrie',result:'qualitative-review',description:'Un petit espace de tri à butées dessert trois longues alcôves. L’absence complète d’eau, de boutons, de portes et de miroirs distingue nettement ce niveau des ateliers et chantiers à circuits des épisodes précédents.'});
}

// L4: keep an interesting alternative instead of manufacturing an obligation
// to cast the initial Wizard exchange. It still aligns three mirrors and makes
// the three-character departure in one final reflection.
let alternative;
{
 const design=designs[2],a=new Author(design.spec);
 a.act('X').go(11,5).act('L').go(5,12).act('U').go(14,13).act('U');
 a.go(5,7,'wizard').go(12,5,'merchant').go(14,8,'bard').act('X');
 const r=replay(design.spec,a.commands),finish=r.trace.at(-1),phase=finish.phases.find(p=>p.kind==='reflect');
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);assert.equal(r.metrics.swaps,0);assert.equal(r.metrics.mirrorMoves,3);
 assert.equal(phase.moves.filter(m=>m.actor==='hero').length,3);
 assert.ok(r.world.circuits.every(c=>circuitPressed(r.world,finish.before,c.id)&&!circuitPressed(r.world,finish.after,c.id)));
 alternative={level:4,commands:a.commands,entries:r.metrics.actions,moves:r.metrics.actions-r.metrics.selections,selections:r.metrics.selections,metrics:r.metrics,result:'WIN',scope:'Alternative constructive, sans recherche de minimum. Le reflet initial libère le Marchand directement ; les trois réglages de miroir et le départ collectif restent présents.'};
 levels[2].observations.push({name:'Alternative initiale conservée',result:'accepted-alternative',description:'X dès le départ transporte le Marchand hors de l’îlot. L’échange initial du Magicien appartient au témoin pédagogique et ne constitue pas une nécessité globale.'});
 levels[2].observations.push({name:'Trois départs croisés',result:'confirmed',description:'Avant le dernier reflet les trois commandes sont occupées ; après le transport simultané les trois héros sont sur leurs destinations et les commandes sont relâchées.'});
 levels[2].observations.push({name:'Rythme et géométrie',result:'qualitative-review',description:'La cour annulaire, les trois commandes croisées et les sorties dans trois secteurs organisent un départ collectif. Le thème du départ par reflet existait déjà dans SS14, mais ici aucun stock de caisses, aucune immersion et aucun miroir transformé en lest final ne prolongent le dispositif.'});
}

const report={success:true,review:'Independent early-level review',levels,alternative,descriptionCorrections:[
 {level:2,status:designs[0].source.objective.includes('polarités opposées')?'applied':'reported-to-author',correction:'Dire presses de polarités opposées : les deux directions sont E.'},
 {level:4,status:designs[2].source.objective.includes('occupant')?'applied':'reported-to-author',correction:'L’objectif général parle de l’occupant de l’îlot ; le Magicien reste le rôle utilisé par le témoin.'}
 ],variety:{comparedEpisodes:[14,15,16,17],comparedMaps:previous.length,method:'Comparaison exacte du terrain recadré, y compris eau, sous les huit rotations/réflexions, complétée par une lecture des objectifs et des ressources.',findings:[
 'Aucune des trois cartes n’est un doublon géométrique des 32 cartes comparées, même après rotation ou réflexion.',
 'N2 et N4 partagent un plan général de cour avec trois branches : ce point commun est assumé, leurs interactions et leur rythme diffèrent.',
 'N3 offre la rupture la plus nette : tri de cargaisons sur sol sec, sans aucun dispositif de circuit ou miroir.',
 'SS14 utilisait déjà des destinations séparées et des départs par reflet ; la revue ne prétend pas que chacun de ces ingrédients apparaît pour la première fois.',
 'Les contrôles n’ont trouvé aucune sortie accessible par la seule marche initiale d’un héros pendant que ses partenaires et les ressources restent fixes.'
 ]},scope:'Rejeux complets, petits graphes de marche initiale à un seul héros, contre-branche locale et alternative construite. Aucune recherche exhaustive des états à trois héros, aucune preuve de nécessité globale de chaque mécanique, aucun minimum de coups ni résultat autonome SRA ne sont revendiqués. Les builders des niveaux 2–4 restent en lecture seule.'};
writeFileSync(new URL('../early-levels-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:levels.map(l=>({level:l.level,reference:l.reference,walking:l.initialUnassistedWalking})),alternative:{level:4,entries:alternative.entries,moves:alternative.moves},descriptionCorrections:report.descriptionCorrections,comparedMaps:previous.length}));
