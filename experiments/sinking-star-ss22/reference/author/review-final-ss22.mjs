import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {build as build6,spec as spec6} from './build-level6.mjs';
import {build as build7,spec as spec7} from './build-level7.mjs';
import {build as build8,spec as spec8} from './build-level8.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';

const checks=[];
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const at=(spec,x,y)=>({x:x+Math.floor((20-spec.rows[0].length)/2),y:y+Math.floor((20-spec.rows.length)/2)});
const has=(ps,p)=>ps.some(q=>eq(p,q));
const check=(id,label,fn)=>{const evidence=fn();checks.push({id,label,status:'passed',...evidence});};
const designs=[build6(),build7(),build8()];
const [d6,d7,d8]=designs;
const prefix=(d,i)=>replay(d.spec,d.commands.slice(0,d.stages[i].turn));
const authorPrefix=(d,i)=>new Author(d.spec).act(d.commands.slice(0,d.stages[i].turn));
function walkRegion(w,s,starts,{allGatesOpen=false,allPlatformsActive=false}={}){
 const pass=p=>p.x>=0&&p.y>=0&&p.x<20&&p.y<20&&w.terrain[p.y*20+p.x]!=='#'
  &&(w.terrain[p.y*20+p.x]==='.'||has(s.supports,p)||w.platforms.some((a,i)=>eq(a.at,p)&&(allPlatformsActive||platformActive(w,s,i))))
  &&(allGatesOpen||!w.gates.some((g,i)=>eq(g.at,p)&&s.gateClosed[i]));
 const key=p=>`${p.x},${p.y}`,q=[...starts],seen=new Set(q.map(key));
 for(let i=0;i<q.length;i++)for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const p={x:q[i].x+dx,y:q[i].y+dy};if(seen.has(key(p))||!pass(p))continue;seen.add(key(p));q.push(p);
 }
 return seen;
}
function legalVariant(spec,a,scope){const r=replay(spec,a.commands);assert.ok(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return {commands:a.commands,metrics:r.metrics,scope};}

for(const [i,d] of designs.entries())check(`level${i+6}-witness`,'Le parcours auteur termine avec les quatre héros, sans refus ni perte',()=>{
 const r=replay(d.spec,d.commands);assert.ok(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.deepEqual(r.state.heroes.map(h=>h.kind),['merchant','warrior','thief','bard']);assert.equal(r.world.goals.length,4);
 return {level:i+6,title:d.spec.title,metrics:r.metrics};
});

check('level6-walking-insufficient','Les deux commandes du fret sont inaccessibles aux héros à pied',()=>{
 const w=compileLevel(spec6),s=initialState(w),region=walkRegion(w,s,s.heroes.map(h=>h.at),{allGatesOpen:true});
 const c=w.circuits.find(c=>c.id==='livraison');assert.ok(c.buttons.every(p=>!region.has(`${p.x},${p.y}`)));assert.equal(circuitPressed(w,s,'livraison'),false);
 assert.ok(w.gates.some(g=>g.circuit==='livraison'));
 return {proof:'Même en ouvrant toutes les presses pour majorer les accès, aucun départ de héros ne rejoint les deux commandes de la rue de fret. Les poids doivent donc y être déplacés. La porte des quatre arrivées dépend de ces commandes.'};
});
check('level6-two-itineraries','La charge et la Barde empruntent des rues différentes',()=>{
 const first=prefix(d6,0),turn=prefix(d6,2);assert.ok(has(first.state.stones,at(spec6,11,4)));assert.ok(eq(first.state.heroes[3].at,at(spec6,9,2)));
 assert.ok(has(turn.state.stones,at(spec6,7,12)));assert.ok(eq(turn.state.heroes[3].at,at(spec6,5,10)));assert.equal(turn.state.gateClosed[0],false);
 return {firstCargo:at(spec6,11,4),lastCorner:at(spec6,7,12),operator:at(spec6,5,10)};
});
check('level6-premature-discharge','Fermer avant la dernière marche retient la caisse au-dessus de la presse',()=>{
 const a=new Author(spec6).act(d6.commands.slice(0,d6.stages[2].turn-1));assert.ok(has(a.state.stones,at(spec6,7,11)));
 a.select('merchant').act('L').select('bard').act('D');assert.ok(has(a.state.stones,at(spec6,7,11)));assert.equal(a.state.gateClosed[0],true);assert.equal(circuitPressed(a.world,a.state,'livraison'),false);
 return {commands:a.commands,cargo:at(spec6,7,11),scope:'Ceci établit un obstacle local réparable en rouvrant la presse, pas une impasse irréversible.'};
});
check('level6-actual-discharge','La fermeture correcte effectue le changement d’axe',()=>{
 const r=prefix(d6,3);assert.ok(has(r.state.stones,at(spec6,8,12)));assert.equal(r.metrics.pistonPushes,1);assert.equal(r.state.gateClosed[0],true);assert.equal(r.state.gateClosed[1],false);assert.equal(r.state.gateClosed[2],false);
 return {cargo:at(spec6,8,12),pistonPushes:r.metrics.pistonPushes,lowerAccessesOpen:true};
});
check('level6-safe-departure','Le départ par le bas laisse les deux poids sur leurs commandes',()=>{
 const loaded=prefix(d6,4),departed=prefix(d6,5);assert.ok(has(loaded.state.stones,at(spec6,12,12)));assert.ok(has(loaded.state.monsters,at(spec6,13,12)));
 assert.deepEqual(departed.state.stones,loaded.state.stones);assert.deepEqual(departed.state.monsters,loaded.state.monsters);assert.ok(circuitPressed(departed.world,departed.state,'livraison'));
 const a=authorPrefix(d6,4).act('L');assert.equal(circuitPressed(a.world,a.state,'livraison'),false);
 return {safePrefix:d6.stages[5].turn,wrongDeparture:a.commands,scope:'Le départ vers l’ouest déplace les poids ; le départ vers le sud est retenu par les bâtiments.'};
});
check('level6-guardian-first-variant','Le gardien peut être placé avant la dernière livraison de la caisse',()=>{
 const a=authorPrefix(d6,1).act('DDDDRR');assert.ok(has(a.state.monsters,at(spec6,13,12)));
 a.go(9,6).act('LLLLDDDD').select('merchant').act('L').go(5,14,'bard').act('RRRRRRRRDD').go(18,18);
 a.go(15,18,'merchant');a.go(16,18,'warrior');a.go(17,18,'thief');
 return legalVariant(spec6,a,'La préparation du gardien et la livraison finale peuvent être ordonnées autrement. Le témoin ne démontre ni ordre unique ni solution optimale.');
});

check('level7-walking-insufficient','Les arrivées basses sont séparées de tous les départs sans déplacement d’appui',()=>{
 const w=compileLevel(spec7),s=initialState(w),region=walkRegion(w,s,s.heroes.map(h=>h.at),{allGatesOpen:true,allPlatformsActive:true});assert.ok(w.goals.every(p=>!region.has(`${p.x},${p.y}`)));
 assert.equal(s.supports.length,2);assert.equal(s.stones.length,0);assert.equal(w.mirrors.length,0);
 return {initialSupports:2,proof:'Même en ignorant les collisions entre héros, aucune des quatre arrivées n’appartient aux composantes de marche initiales. Il n’existe ni caisse supplémentaire, ni reflet, ni plateforme pour combler le passage.'};
});
check('level7-disembark-before-moving','Le chant refuse de déplacer le pont avec un voyageur encore dessus',()=>{
 const a=new Author(spec7).select('bard').act('D');a.go(9,5,'merchant');a.select('bard');
 const d=stepDetailed(a.world,a.state,2);assert.ok(d.state.failed);assert.equal(d.state.dead,false);assert.deepEqual(d.state.supports,a.state.supports);assert.ok(eq(d.state.heroes[0].at,at(spec7,9,5)));
 a.go(2,3,'merchant').select('bard').act('D');assert.ok(has(a.state.supports,at(spec7,9,6)));assert.ok(has(a.state.supports,at(spec7,10,6)));
 return {refusalWithOccupant:true,supportsAfterDisembarking:a.state.supports,scope:'Un appui occupé reste ancré ; la tentative ne noie pas le voyageur et ne modifie pas le monde.'};
});
check('level7-first-buttress','La première butée crée deux hauteurs différentes',()=>{
 const r=prefix(d7,2);assert.ok(has(r.state.supports,at(spec7,9,8)));assert.ok(has(r.state.supports,at(spec7,10,11)));assert.equal(r.world.terrain[at(spec7,9,9).y*20+at(spec7,9,9).x],'#');
 return {supports:r.state.supports};
});
check('level7-regrouping','La file devient une paire devant l’entrée de la cour',()=>{
 const file=prefix(d7,3),pair=prefix(d7,4);assert.ok(has(file.state.supports,at(spec7,10,12)));assert.ok(has(file.state.supports,at(spec7,10,13)));
 assert.ok(has(pair.state.supports,at(spec7,9,12)));assert.ok(has(pair.state.supports,at(spec7,10,12)));
 return {file:file.state.supports,pair:pair.state.supports};
});
check('level7-wrong-final-approach','Remonter directement après le calage défait le pont',()=>{
 const a=authorPrefix(d7,4).act('U');assert.ok(has(a.state.supports,at(spec7,9,12)));assert.ok(has(a.state.supports,at(spec7,10,11)));assert.ok(!has(a.state.supports,at(spec7,10,12)));
 return {commands:a.commands,supports:a.state.supports,scope:'Le témoin effectue donc un détour pour rejoindre la traverse sans la déplacer. La mauvaise approche reste réparable.'};
});
check('level7-upper-crossing-variant','Les voyageurs peuvent quitter le débarcadère avant la première descente du pont',()=>{
 const a=new Author(spec7);a.go(2,3,'merchant');a.go(2,6,'warrior');a.go(2,9,'thief');
 a.select('bard').act('D').go(8,4).act('DDDDDD').go(7,8).act('RDDDDLDDDRU').go(8,12).act('RRR').go(15,10);
 a.go(12,10,'merchant');a.go(13,10,'warrior');a.go(14,10,'thief');
 return legalVariant(spec7,a,'La ligne de départ des voyageurs peut être la rangée initiale du pont. Le calage inférieur et le changement de formation restent présents.');
});

check('level8-walking-insufficient','La réserve et la cour finale ne sont pas accessibles par la marche initiale',()=>{
 const w=compileLevel(spec8),s=initialState(w),region=walkRegion(w,s,s.heroes.map(h=>h.at),{allGatesOpen:true,allPlatformsActive:true});assert.ok(w.goals.every(p=>!region.has(`${p.x},${p.y}`)));
 assert.equal(s.supports.length,3);assert.equal(s.stones.length,1);assert.equal(w.mirrors.length,0);assert.equal(s.monsters.length,0);
 return {initialSupports:3,initialDryCrates:1,proof:'La dernière cour reste inaccessible même avec la presse ouverte et la plateforme active. Le Voleur commence dans une composante distincte ; la commande ne remplace pas l’appui de sa branche.'};
});
check('level8-deposited-part','Un appui est laissé dans la branche et les deux autres préparent la traverse',()=>{
 const r=prefix(d8,1);assert.ok(has(r.state.supports,at(spec8,9,4)));assert.ok(has(r.state.supports,at(spec8,14,11)));assert.ok(has(r.state.supports,at(spec8,15,11)));
 assert.ok(eq(r.state.heroes[2].at,at(spec8,9,2)));assert.ok(has(r.state.stones,at(spec8,9,1)));
 return {supports:r.state.supports,thiefStillInReserve:true,scope:'Le retour de la caisse est encore à faire ; la pièce de la branche n’est pas un surplus abandonné après usage.'};
});
check('level8-reclaim-breaks-return','Reprendre l’appui déposé coupe concrètement le retour du Voleur',()=>{
 const a=authorPrefix(d8,0).act('D');assert.ok(!has(a.state.supports,at(spec8,9,4)));assert.ok(has(a.state.supports,at(spec8,9,5)));
 a.select('thief').act('D');const d=stepDetailed(a.world,a.state,2);assert.ok(d.state.failed);assert.equal(d.state.dead,false);assert.ok(eq(d.state.heroes[2].at,at(spec8,9,3)));
 return {commands:a.commands+'D',missingSupport:at(spec8,9,4),returnRefused:true,scope:'Preuve locale de l’utilité de la dépose. Remettre l’appui répare l’accès ; aucun quota ni sacrifice irréversible n’est annoncé.'};
});
check('level8-occupied-support-anchors','Un appui occupé reste sur place lorsque le chant fait descendre le Voleur vers la plateforme',()=>{
 const a=authorPrefix(d8,0);a.select('thief').act('DD').select('bard');const d=stepDetailed(a.world,a.state,2);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.ok(has(d.state.supports,at(spec8,9,4)));assert.ok(eq(d.state.heroes[2].at,at(spec8,9,5)));
 assert.ok(has(d.state.stones,at(spec8,9,3)));assert.ok(d.phases.some(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='hero'&&eq(m.from,at(spec8,9,4)))));
 return {branch:a.commands+'D',supportStayed:at(spec8,9,4),passengerArrival:at(spec8,9,5),crateStayed:at(spec8,9,3),scope:'Le Voleur est déplacé par le chant, pas porté par l’appui ; sa traction personnelle ne se déclenche pas.'};
});
check('level8-platform-still-needed','L’appui déposé ne remplace pas la plateforme tenue par le Marchand',()=>{
 const a=authorPrefix(d8,0).select('merchant').act('L').select('thief').act('DD');assert.equal(platformActive(a.world,a.state,0),false);
 const d=stepDetailed(a.world,a.state,2);assert.ok(d.state.failed);assert.equal(d.state.dead,false);assert.ok(eq(d.state.heroes[2].at,at(spec8,9,4)));
 return {commands:a.commands+'D',unsupportedPlatform:at(spec8,9,5),scope:'Le retour nécessite deux appuis de nature différente : celui déposé et la plateforme encore alimentée.'};
});
check('level8-dry-return','La caisse traverse les deux appuis du retour en restant sèche',()=>{
 const r=prefix(d8,3);assert.equal(r.state.stones.length,1);assert.equal(r.state.supports.length,3);assert.ok(has(r.state.stones,at(spec8,9,9)));assert.equal(r.metrics.thiefPulls,8);
 return {crate:at(spec8,9,9),thiefPulls:8,supports:r.state.supports};
});
check('level8-continuous-mixed-relay','La poussée de rangée remplace le Marchand sans interrompre le circuit',()=>{
 const r=replay(spec8,d8.commands),phases=r.trace.flatMap(t=>t.phases),p=phases.find(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='stone'&&eq(m.to,at(spec8,6,11))));assert.ok(p);
 assert.ok(p.moves.some(m=>m.actor==='hero'&&eq(m.from,at(spec8,6,11))&&eq(m.to,at(spec8,6,12))));
 assert.equal(p.before.heroes[p.before.active].kind,'warrior');assert.ok(circuitPressed(r.world,p.before,'retour'));assert.ok(circuitPressed(r.world,p.after,'retour'));
 assert.equal(r.metrics.chainPushes,1);assert.equal(r.metrics.mixedPushes,1);assert.ok(has(r.state.stones,at(spec8,6,11)));
 return {moves:p.moves,circuitBefore:true,circuitAfter:true,chainPushes:1,mixedPushes:1};
});
check('level8-return-first-variant','La caisse peut revenir avant la construction de la traverse finale',()=>{
 const a=authorPrefix(d8,0).act('RRRDD').go(13,13);
 a.select('thief').act('DDDDDDDDL').go(10,9,'warrior').act('LLL').go(6,8).act('DD');
 a.go(4,6,'merchant');a.go(4,8,'warrior');a.go(4,10,'thief');
 a.go(9,7,'bard').act('RRRRDDDDDD').go(13,11).act('RRR').go(18,9);
 a.go(17,9,'merchant');a.go(17,10,'warrior');a.go(18,10,'thief');
 return legalVariant(spec8,a,'La dépose garde son utilité, mais l’ordre entre retour du chargement et construction de la traverse n’est pas unique.');
});

check('all-support-motions-empty-water','Les témoins ne déplacent que des appuis vides entre cases d’eau',()=>{
 let count=0;
 for(const d of designs){const r=replay(d.spec,d.commands);for(const t of r.trace)for(const p of t.phases)for(const m of p.moves)if(m.actor==='support'){
  count++;assert.equal(p.kind,'song');assert.equal(r.world.terrain[m.from.y*20+m.from.x],'~');assert.equal(r.world.terrain[m.to.y*20+m.to.x],'~');assert.ok(!p.before.heroes.some(h=>eq(h.at,m.from)));
 }}assert.equal(count,50);return {supportMoves:count,occupiedSupportMoves:0};
});

const report={game:'SS22',title:'Les Cortèges Mécaniques',status:'passed',scope:'Revue auteur des niveaux 6–8 : témoins complets, géométrie excluant la marche seule, contre-épreuves locales et variantes constructives. Les besoins locaux sont distingués des choix du témoin. Ni unicité, ni optimalité, ni impossibilité globale issue d’une recherche bornée ne sont revendiquées.',checks,totals:{checks:checks.length,passed:checks.length}};
writeFileSync(new URL('../final-ss22-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,totals:report.totals,variants:checks.filter(c=>c.commands&&c.metrics).map(c=>({id:c.id,actions:c.metrics.actions}))}));
