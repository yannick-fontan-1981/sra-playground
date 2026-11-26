import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {build as build6,spec as spec6} from './build-level6.mjs';
import {build as build7,spec as spec7} from './build-level7.mjs';
import {build as build8,spec as spec8} from './build-level8.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';
import {stepDetailed,circuitPressed,traceSwap,terrainAt,platformActive,equal} from '../../dist/core.js';

const checks=[];
function check(label,fn){const evidence=fn();checks.push({label,passed:true,...evidence});}
const at=(a,x,y)=>a.point(x,y);
const has=(ps,p)=>ps.some(q=>equal(p,q));
const act=(a,c)=>{const d=decodeCommand(c,a.state);return stepDetailed(a.world,a.state,d.id,d.data);};
const resume=(spec,d,stage)=>new Author(spec).act(d.commands.slice(0,d.stages[stage].turn));
const ds=[build6(),build7(),build8()];
for(const d of ds)check(`${d.spec.id}: témoin complet, sans refus ni décès`,()=>{assert.equal(d.metrics.blocked,0);assert.equal(d.metrics.deaths,0);assert(replay(d.spec,d.commands).state.complete);return{inputs:d.metrics.actions,selections:d.metrics.selections};});
for(const d of ds)check(`${d.spec.id}: inventaire fixe et quatre arrivées`,()=>{assert.deepEqual([...d.spec.rows.join('')].filter(c=>'MTZB'.includes(c)).sort(),['B','M','T','Z']);assert.equal([...d.spec.rows.join('')].filter(c=>c==='g').length,4);assert(d.spec.rows.length<=20&&d.spec.rows[0].length<=20);return{width:d.spec.rows[0].length,height:d.spec.rows.length};});

check('N6 : livrer avant de restituer le miroir ferme bien son passage direct',()=>{
 const a=resume(spec6,ds[0],0);a.go(10,7,'merchant').act('DD').select('thief');const r=act(a,'D');
 assert(r.state.failed);assert(has(a.state.mirrors.map(m=>m.at),at(a,6,4)));assert(circuitPressed(a.world,a.state,'chargement'));
 return{tested:'D du Voleur après livraison prématurée',refused:r.state.failed,limit:'La livraison peut encore être annulée ; ce contrôle ne prétend pas à une impasse globale.'};
});
check('N6 : le miroir est revenu avant la livraison du témoin',()=>{const a=resume(spec6,ds[0],1);assert(has(a.state.mirrors.map(m=>m.at),at(a,6,8)));assert(!circuitPressed(a.world,a.state,'chargement'));const r=replay(spec6,ds[0].commands);assert.equal(r.metrics.thiefMirrorPulls,8);return{mirrorPulls:8};});
check('N6 : sans le décalage du monstre, la montée finale tue le Magicien',()=>{
 const a=resume(spec6,ds[0],2);a.select('wizard').act('U').select('bard').act('RRRDDDD').select('wizard').act('RU');const r=act(a,'U');
 assert(r.state.dead);assert(has(a.state.monsters,at(a,17,6)));return{tested:'Montée depuis la chambre droite après omission du premier chant',death:r.state.dead};
});
check('N6 : le monstre reste vivant et quitte le voisinage dangereux dans le témoin',()=>{const a=resume(spec6,ds[0],3);assert.equal(a.state.monsters.length,1);assert(has(a.state.monsters,at(a,18,6)));assert.equal(ds[0].metrics.monstersRemoved,0);return{monsterMoves:ds[0].metrics.monsterMoves};});
check('N6 : un départ gauche prématuré immerge le poids du dépôt',()=>{const a=resume(spec6,ds[0],5);const r=act(a,'L');assert(!r.state.failed&&!r.state.dead);assert(!circuitPressed(a.world,r.state,'depot'));assert(has(r.state.supports,at(a,10,12)));return{tested:'L de la Barde juste après le dépôt',supportCreated:true,depositReleased:true};});
check('N6 : le fond de niche interdit le poste de traction inférieur',()=>{const a=new Author(spec6);assert.equal(terrainAt(a.world,at(a,11,13)),'#');assert.equal(terrainAt(a.world,at(a,11,9)),'#');return{lowerPullStation:'wall',upperPushStation:'wall'};});

check('N7 : la fenêtre fermée interdit l’usage optique avant la livraison',()=>{const a=resume(spec7,ds[1],0).select('wizard');assert.equal(traceSwap(a.world,a.state,'S').plan,null);assert.equal(a.state.mirrors.length,1);return{rayBlockedBeforeDelivery:true};});
for(const x of [4,7,10])check(`N7 : station ${x},6 détruite par le transport suivant`,()=>{
 const a=new Author(spec7);a.select('thief').act('R'.repeat(x-4)).go(4,8).select('merchant').act('RRRRRRRRR');
 const r=replay(spec7,a.commands);assert.equal(a.state.mirrors.length,0);assert(r.trace.some(t=>t.phases.some(p=>p.kind==='crush')));assert(!a.state.dead);
 return{station:{x,y:6},mirrorDestroyed:true,heroDeaths:r.metrics.deaths};
});
check('N7 : les trois presses sont effectivement activées pendant la livraison sûre',()=>{const r=replay(spec7,ds[1].commands);for(let i=0;i<3;i++)assert(r.trace.some(t=>!t.before.gateClosed[i]&&t.after.gateClosed[i]));assert.equal(r.state.mirrors.length,1);return{pressesTriggered:3,mirrorSurvives:true};});
check('N7 : tous les glissements d’appui partent d’une case vide et restent dans l’eau',()=>{const r=replay(spec7,ds[1].commands);let n=0;for(const t of r.trace)for(const p of t.phases)for(const m of p.moves)if(m.actor==='support'){n++;assert.equal(terrainAt(r.world,m.from),'~');assert.equal(terrainAt(r.world,m.to),'~');assert(!p.before.heroes.some(h=>equal(h.at,m.from)));}assert(n>0);return{checkedSupportMotions:n};});
check('N7 : le passage conserve son appui pour les partenaires après la Barde',()=>{const a=resume(spec7,ds[1],4);assert(has(a.state.supports,at(a,16,10)));assert(platformActive(a.world,a.state,0));return{support:{x:16,y:10},platformActive:true};});

check('N8 : depuis le poste gauche, le sort dépose la réserve une case trop tôt',()=>{const a=resume(spec8,ds[2],3).select('wizard');const r=act(a,'R');assert(!r.state.failed&&!r.state.dead);assert(has(r.state.stones,at(a,11,7)));assert(!has(r.state.stones,at(a,12,7)));assert(!circuitPressed(a.world,r.state,'composition'));return{wrongDeposit:{x:11,y:7},requiredDeposit:{x:12,y:7}};});
check('N8 : la dernière commande ne peut être abordée par le haut dans l’état préparé',()=>{const a=resume(spec8,ds[2],3);assert.equal(terrainAt(a.world,at(a,12,6)),'~');assert(!platformActive(a.world,a.state,0));return{upperApproach:'unsupported water',rayRemainsTransparent:true};});
check('N8 : depuis le bas, la visée traverse cette eau et reprend le poids supérieur',()=>{const a=resume(spec8,ds[2],2).select('wizard');assert(equal(a.hero.at,at(a,12,8)));const p=traceSwap(a.world,a.state,'N').plan;assert(p);assert(equal(p.to,at(a,12,5)));return{target:{x:12,y:5},lastCell:{x:12,y:7}};});
check('N8 : le miroir occupe la quatrième approche',()=>{const a=resume(spec8,ds[2],3);assert(has(a.state.mirrors.map(m=>m.at),at(a,13,7)));return{rightApproach:'mirror'};});
check('N8 : reculer le poste du Barde fait suivre un poids qui devait rester',()=>{const a=resume(spec8,ds[2],3).select('bard').act('LR');assert(has(a.state.stones,at(a,11,7)));assert(!has(a.state.stones,at(a,10,7)));a.select('wizard').act('R');assert(!circuitPressed(a.world,a.state,'composition'));return{extraMovedStone:{from:{x:10,y:7},to:{x:11,y:7}},compositionIncomplete:true};});
check('N8 : reprendre le miroir tandis que la Barde reste proche expose le dernier poids',()=>{const a=resume(spec8,ds[2],5);a.go(14,8,'thief').act('UULU').select('bard');const r=act(a,'R');assert(!r.state.failed&&!r.state.dead);assert(has(r.state.stones,at(a,13,7)));assert(!circuitPressed(a.world,r.state,'composition'));return{earlyMirrorPull:true,bardStillInRange:true,lastWeightMoves:true,detail:'Le Voleur contourne le coude en entraînant la Barde de deux cases sans chant, puis reprend le miroir ; le pas droit suivant de la Barde déplace le poids.'};});
check('N8 : le chant utile entraîne le Magicien sans lancer son sort ni déplacer de poids',()=>{const r=replay(spec8,ds[2].commands);const song=r.trace.flatMap(t=>t.phases).filter(p=>p.kind==='song');assert.equal(song.length,1);assert.equal(song[0].moves.filter(m=>m.actor==='hero').length,2);assert.equal(song[0].moves.filter(m=>m.actor==='stone').length,0);assert.equal(ds[2].metrics.bentSwaps,1);return{songHeroMoves:1,songStoneMoves:0,bentSwaps:1};});

function variant6(){const a=new Author(spec6);a.select('thief').act('UUU').go(5,8).act('RRRRRR').go(6,6).act('DDD').go(2,12);a.go(10,7,'merchant').act('DD');a.select('bard').act('R');a.select('wizard').act('U');a.select('bard').act('RRRDDDD');a.go(2,2,'merchant');a.go(3,2,'thief');a.go(16,5,'wizard');a.go(4,2,'bard');return a;}
function variant7(){const a=new Author(spec7);a.select('thief').act('RRRR').go(4,8);a.select('merchant').act('RRR');a.go(9,6,'thief').act('RRRRR').go(4,8);a.select('merchant').act('RRRRRR');a.select('bard').act('DD');a.select('wizard').act('DD');a.select('bard').act('RRRDDDR');a.go(17,11,'merchant');a.go(18,11,'thief');a.go(17,3,'wizard');a.select('bard').act('UUUUUUUUUU');return a;}
function variant8(){const a=new Author(spec8);a.select('merchant').act('RRR').go(2,11);a.go(10,8,'thief').act('UU').go(9,6);a.go(12,4).act('DD');a.go(15,7).act('LLLDLD').go(5,11);a.go(12,8,'wizard').go(11,8).go(11,7);a.select('bard').act('R');a.select('wizard').act('R');a.select('bard').act('RR').go(18,1);a.go(15,1,'wizard');a.go(16,1,'merchant');a.go(13,6,'thief').act('UUU').go(17,1);return a;}
const variations=[];
for(const [id,label,make] of [[6,'Garage du miroir une case plus bas',variant6],[7,'Stationnement intermédiaire sûr, puis livraison entrelacée avec la traction du miroir',variant7],[8,'Extraction du bloc inférieur avant celle du bloc supérieur',variant8]])check(`N${id} : variante gagnante — ${label}`,()=>{const a=make(),r=replay(a.spec,a.commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);variations.push({level:id,label,commands:a.commands,metrics:r.metrics});return{inputs:r.metrics.actions,selections:r.metrics.selections};});

const report={campaign:'SS24 — Les Voies de Traverse',scope:'Revue d’auteur des salles 6 à 8',checks,passed:checks.length,main:ds.map(d=>({id:d.spec.id,title:d.spec.title,metrics:d.metrics})),variations,
 limits:['Les témoins établissent la victoire, pas une longueur minimale.','Les contre-branches portent sur les états et actions indiqués ; elles ne prouvent pas l’absence de toute autre solution.','La contrainte de dernier pas de N8 est vérifiée dans la composition préparée ; préparer le Magicien plus tôt demeure une piste légitime.','Les variantes de N6 et N8 changent un stationnement ou un ordre d’extraction ; celle de N7 entrelace deux préparations qui peuvent être anticipées séparément.','Aucun solveur ni script d’auteur ne doit être importé dans le bundle jouable.']};
writeFileSync(new URL('../final-ss24-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,variants:variations.map(v=>({level:v.level,inputs:v.metrics.actions})),limits:report.limits}));
