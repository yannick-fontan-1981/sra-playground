import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {build as build6,spec as spec6} from './build-level6.mjs';
import {build as build7,spec as spec7} from './build-level7.mjs';
import {build as build8,spec as spec8,pattern} from './build-level8.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive,traceSwap} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';

const checks=[];
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const has=(ps,p)=>ps.some(q=>eq(p,q));
const at=(s,x,y)=>({x:x+Math.floor((20-s.rows[0].length)/2),y:y+Math.floor((20-s.rows.length)/2)});
const key=p=>`${p.x},${p.y}`;
const check=(id,label,fn)=>{const evidence=fn();checks.push({id,label,status:'passed',...evidence});};
const designs=[build6(),build7(),build8()];
const [d6,d7,d8]=designs;
const prefix=(d,i)=>replay(d.spec,d.commands.slice(0,d.stages[i].turn));
const authorPrefix=(d,i)=>new Author(d.spec).act(d.commands.slice(0,d.stages[i].turn));
function walkRegion(w,s){
 const pass=p=>p.x>=0&&p.y>=0&&p.x<20&&p.y<20&&w.terrain[p.y*20+p.x]!=='#'
  &&(w.terrain[p.y*20+p.x]==='.'||has(s.supports,p)||w.platforms.some((a,i)=>eq(a.at,p)&&platformActive(w,s,i)))
  &&!w.gates.some((g,i)=>eq(g.at,p)&&s.gateClosed[i]);
 const q=s.heroes.map(h=>h.at),seen=new Set(q.map(key));
 for(let i=0;i<q.length;i++)for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const p={x:q[i].x+dx,y:q[i].y+dy};if(seen.has(key(p))||!pass(p))continue;seen.add(key(p));q.push(p);
 }return seen;
}
function legalVariant(spec,a,scope){const r=replay(spec,a.commands);assert.ok(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return{commands:a.commands,metrics:r.metrics,scope};}

for(const [i,d]of designs.entries())check(`level${i+6}-witness`,'Le témoin termine avec les quatre rôles, sans refus ni décès',()=>{
 const r=replay(d.spec,d.commands);assert.ok(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.deepEqual(r.state.heroes.map(h=>h.kind),['merchant','warrior','wizard','bard']);assert.equal(r.world.goals.length,4);
 return{level:i+6,title:d.spec.title,metrics:r.metrics};
});

check('level6-walking-insufficient','Les deux poids de rangement ne peuvent être remplacés par les héros à l’arrivée',()=>{
 const w=compileLevel(spec6),s=initialState(w),c=w.circuits.find(c=>c.id==='rangement');
 assert.equal(s.stones.length,2);assert.equal(s.monsters.length,0);assert.ok(c.buttons.every(p=>!has(s.stones,p)&&!has(w.goals,p)));assert.equal(circuitPressed(w,s,'rangement'),false);
 for(const m of s.mirrors)for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const from={x:m.at.x-dx,y:m.at.y-dy},to={x:m.at.x+dx,y:m.at.y+dy};assert.ok(w.terrain[from.y*20+from.x]==='#'||w.terrain[to.y*20+to.x]==='#');
 }
 return{proof:'Les quatre héros doivent quitter les deux boutons pour occuper les quatre destinations. Les deux blocs doivent donc être livrés ; les miroirs ont, sur chaque axe de poussée, un mur devant ou derrière et ne peuvent servir de poids de remplacement. Une marche seule ne change pas leur placement.'};
});
check('level6-end-wall-and-selective-song','Le mur arrête la file et le chant n’abaisse qu’un de ses blocs',()=>{
 const before=authorPrefix(d6,0),bad=stepDetailed(before.world,before.state,4);assert.ok(bad.state.failed);assert.equal(bad.state.dead,false);
 const r=prefix(d6,1);assert.ok(has(r.state.stones,at(spec6,9,8)));assert.ok(has(r.state.stones,at(spec6,10,7)));assert.equal(r.metrics.songStoneMoves,1);
 return{blockedExtraPush:true,loweredBlock:at(spec6,9,8),upperBlock:at(spec6,10,7)};
});
check('level6-sacrificial-access-loses-weight','Pousser le bloc du bas plus loin le convertit en appui et retire un poids',()=>{
 const a=authorPrefix(d6,1).act('D');assert.equal(a.state.stones.length,1);assert.equal(a.state.supports.length,1);assert.ok(has(a.state.supports,at(spec6,9,9)));
 return{commands:a.commands,remainingDryBlocks:1,requiredFinalWeights:2,scope:'L’eau peut ouvrir un passage local, mais le bloc coulé ne peut plus couvrir un bouton. Les deux miroirs restent immobiles et les quatre héros doivent rejoindre leurs destinations.'};
});
check('level6-bent-specialist-deployment','La visée contourne les blocs par deux miroirs et déploie le Guerrier',()=>{
 const a=authorPrefix(d6,1).select('wizard'),plan=traceSwap(a.world,a.state,'N').plan;assert.ok(plan);assert.equal(plan.reflections,2);assert.equal(plan.target,'hero');assert.ok(eq(plan.to,at(spec6,8,7)));
 const r=prefix(d6,2);assert.ok(eq(r.state.heroes[1].at,at(spec6,14,7)));assert.ok(eq(r.state.heroes[2].at,at(spec6,8,7)));assert.equal(r.metrics.bentSwaps,1);
 return{path:plan.path,reflections:2,warriorArrival:at(spec6,14,7)};
});
check('level6-press-causal-placement','La fermeture pousse réellement les deux blocs sur leurs boutons',()=>{
 const r=prefix(d6,3),p=r.trace.flatMap(t=>t.phases).find(p=>p.kind==='piston');assert.ok(p);assert.equal(p.moves.length,2);assert.ok(p.moves.every(m=>m.actor==='stone'));
 assert.ok(has(r.state.stones,at(spec6,6,8)));assert.ok(has(r.state.stones,at(spec6,7,8)));assert.ok(circuitPressed(r.world,r.state,'rangement'));
 const early=new Author(spec6).act(d6.commands.slice(0,d6.stages[3].turn-1)).act('U');assert.equal(circuitPressed(early.world,early.state,'rangement'),false);assert.ok(has(early.state.stones,at(spec6,9,8)));
 return{pistonMoves:p.moves,earlyRelease:early.commands,scope:'Quitter la commande une étape plus tôt laisse un bloc dans la reprise. Cette erreur locale est réparable ; aucun ordre global unique n’est déduit.'};
});
check('level6-preserving-the-storage','La sortie latérale de la Barde conserve le rangement',()=>{
 const a=authorPrefix(d6,3).go(5,12,'wizard').go(4,12,'warrior').go(1,12,'merchant').select('bard');
 const upward=stepDetailed(a.world,a.state,1);assert.equal(upward.state.failed,false);assert.equal(circuitPressed(a.world,upward.state,'rangement'),false);
 const leftward=stepDetailed(a.world,a.state,3);assert.equal(leftward.state.failed,false);assert.deepEqual(leftward.state.stones,a.state.stones);assert.ok(circuitPressed(a.world,leftward.state,'rangement'));
 return{upwardDepartureReleases:true,leftwardDeparturePreserves:true,scope:'La butée ordinaire bloque les blocs vers la gauche, même s’ils se trouvent dans la portée du chant.'};
});
check('level6-right-block-first-variant','Le poste droit peut être préparé avant le premier chant',()=>{
 const a=new Author(spec6);a.select('warrior').act('RRRR').select('wizard').act('U').go(5,12).go(10,6,'warrior').act('D');
 a.select('bard').act('D').go(11,8,'warrior').act('LL').go(4,12).go(1,12,'merchant').go(3,9,'bard').go(1,1).go(2,1,'wizard').go(3,1,'warrior').go(4,1,'merchant');
 return legalVariant(spec6,a,'L’échange et la préparation du bloc droit peuvent précéder le chant sélectif, à condition de retirer le Magicien de la file. Le témoin principal ne revendique pas un ordre unique.');
});

check('level7-walking-insufficient','Le dispositif initial ne relie aucun départ aux arrivées',()=>{
 const w=compileLevel(spec7),s=initialState(w),region=walkRegion(w,s);assert.ok(w.goals.every(p=>!region.has(key(p))));assert.equal(s.supports.length,2);assert.equal(s.stones.length,1);
 return{proof:'Même en ignorant les collisions entre héros, les appuis initiaux et les plateformes actives laissent une case d’eau ouverte avant la rive orientale. Le poste de chant est une galerie distincte.'};
});
check('level7-differential-anchoring','Le héros est entraîné sur la plateforme tandis que son ancien appui reste en place',()=>{
 const before=prefix(d7,0),after=prefix(d7,1);assert.ok(eq(before.state.heroes[2].at,at(spec7,8,8)));assert.ok(eq(after.state.heroes[2].at,at(spec7,9,8)));
 assert.ok(has(after.state.supports,at(spec7,8,8)));assert.ok(has(after.state.supports,at(spec7,11,8)));assert.equal(after.metrics.supportMoves,1);
 const a=new Author(spec7).act(d7.commands.slice(0,d7.stages[0].turn-1)).select('bard').act('R');assert.ok(!has(a.state.supports,at(spec7,8,8)));assert.ok(has(a.state.supports,at(spec7,9,8)));
 const region=walkRegion(a.world,a.state);assert.ok(a.world.goals.every(p=>!region.has(key(p))));
 return{anchored:at(spec7,8,8),heroArrival:at(spec7,9,8),emptySupportArrival:at(spec7,11,8),unanchoredBranch:a.commands,scope:'Sans l’occupant, le même chant déplace les deux appuis et coupe l’accès occidental. Ceci compare deux états locaux, pas toutes les solutions possibles.'};
});
check('level7-platform-needed-for-sung-hero','Retirer les plateformes avant ce chant refuse la marche forcée du Magicien',()=>{
 const a=authorPrefix(d7,0).select('merchant').act('L').select('bard'),d=stepDetailed(a.world,a.state,4);assert.ok(d.state.failed);assert.equal(d.state.dead,false);assert.deepEqual(d.state.supports,a.state.supports);
 return{commands:a.commands+'R',refusal:true,scope:'Le héros aurait quitté l’appui ancré vers une case d’eau nue. Le moteur refuse le chant entier sans noyer le héros.'};
});
check('level7-inverse-north-door','La galerie nord n’est ouverte que pendant le retrait des plateformes',()=>{
 const a=authorPrefix(d7,2);assert.equal(a.state.gateClosed[0],true);assert.ok(platformActive(a.world,a.state,0));a.select('bard');assert.ok(stepDetailed(a.world,a.state,3).state.failed);
 a.select('merchant').act('L');assert.equal(a.state.gateClosed[0],false);assert.equal(a.state.gateClosed[1],true);assert.equal(platformActive(a.world,a.state,0),false);assert.equal(a.state.dead,false);
 a.select('bard').act('L');assert.ok(eq(a.hero.at,at(spec7,8,3)));
 return{northOpensWhenPlatformsWithdrawn:true,exitDoorClosedDuringWithdrawal:true,scope:'Le témoin relâche seulement après le transfert des deux héros vers des sols secs. La réserve doit rester sèche pour ouvrir ensuite la porte des quatre arrivées.'};
});
check('level7-continuous-reserve-relay','La poussée de file remplace le Marchand sans couper les plateformes',()=>{
 const r=prefix(d7,4),p=r.trace.flatMap(t=>t.phases).find(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='stone'&&eq(m.to,at(spec7,3,13))));assert.ok(p);
 assert.ok(p.moves.some(m=>m.actor==='hero'&&eq(m.from,at(spec7,3,13))&&eq(m.to,at(spec7,3,14))));assert.ok(circuitPressed(r.world,p.before,'passage'));assert.ok(circuitPressed(r.world,p.after,'passage'));
 assert.equal(r.metrics.mixedPushes,1);return{moves:p.moves,circuitStayedPressed:true};
});
check('level7-quiet-boarding-matters','Approcher la Barde en marchant déplace prématurément le premier appui',()=>{
 const a=authorPrefix(d7,4).go(5,8,'bard').act('RR');assert.ok(!has(a.state.supports,at(spec7,8,8)));assert.ok(has(a.state.supports,at(spec7,9,8)));
 const d=stepDetailed(a.world,a.state,4);assert.ok(d.state.failed);assert.equal(d.state.dead,false);
 return{commands:a.commands+'R',firstSupportMissing:at(spec7,8,8),scope:'Le témoin utilise donc le Guerrier pour installer la Barde silencieusement. Cette contre-épreuve porte sur l’approche choisie, sans prétendre exclure toute autre préparation.'};
});
check('level7-final-duo-has-two-phases','Le dernier duo laisse d’abord l’appui puis le déplace derrière lui',()=>{
 const a=authorPrefix(d7,5).select('bard').act('R');assert.ok(has(a.state.supports,at(spec7,8,8)));assert.ok(eq(a.state.heroes[1].at,at(spec7,9,8)));
 a.act('R');assert.ok(!has(a.state.supports,at(spec7,8,8)));assert.ok(has(a.state.supports,at(spec7,9,8)));assert.ok(eq(a.state.heroes[1].at,at(spec7,10,8)));
 const end=prefix(d7,6);assert.ok(end.state.heroes.every(h=>h.at.x>=at(spec7,12,0).x));return{firstPulseKeepsSupport:true,secondPulseMovesEmptySupport:true,allHeroesAcrossAtLastPulse:true};
});
check('level7-reserve-first-variant','La réserve peut remplacer le Marchand avant l’extraction de la Barde',()=>{
 const a=authorPrefix(d7,1);a.go(6,8,'warrior').act('LL').go(3,7).act('DDDDD');a.go(9,3,'wizard').act('D');
 a.go(4,13,'warrior').act('L').go(1,13);a.go(3,3,'bard');a.select('warrior').act('R');a.go(4,6,'wizard');
 a.go(18,5,'wizard');a.go(17,5,'merchant');a.go(5,8,'bard');a.go(4,8,'warrior').act('RRRR');a.select('bard').act('RRRR');a.go(12,12,'warrior');a.go(18,8,'bard').act('UUU');a.go(17,5,'warrior');
 return legalVariant(spec7,a,'La réserve est livrée plus tôt, puis déplacée temporairement pour ouvrir la porte nord et remise sur le bouton. Le Marchand n’a pas à rester le gardien du circuit jusqu’à cette extraction.');
});

check('level8-walking-insufficient-and-finite-load','Neuf boutons physiques nécessitent les neuf blocs conservés',()=>{
 const w=compileLevel(spec8),s=initialState(w),c=w.circuits[0];assert.equal(c.buttons.length,9);assert.equal(s.stones.length,9);assert.equal(s.mirrors.length,0);assert.equal(s.monsters.length,0);
 assert.ok(c.buttons.every(p=>!has(s.stones,p)&&!has(w.goals,p)));assert.equal(circuitPressed(w,s,'composition'),false);
 const a=new Author(spec8).go(1,4,'merchant').act('RRRR');assert.equal(a.state.stones.length,8);assert.equal(a.state.supports.length,1);
 return{buttons:9,initialBlocks:9,spilledReserveBranch:a.commands,proof:'Aucun bloc ne commence sur un bouton ; quatre marcheurs ne peuvent couvrir neuf boutons. À l’arrivée, les quatre héros sont sur des destinations distinctes des boutons, donc chacun des neuf blocs doit rester utilisable comme poids. Un bloc coulé ne se récupère pas.'};
});
check('level8-two-staggered-fragments','Le fragment inférieur ne rejoint le chant qu’au troisième pas',()=>{
 const a=authorPrefix(d8,0).select('bard'),initial=[9,10,11].map(x=>at(spec8,x,10));assert.ok(initial.every(p=>has(a.state.stones,p)));
 a.act('R');assert.ok(initial.every(p=>has(a.state.stones,p)));a.act('R');assert.ok(initial.every(p=>has(a.state.stones,p)));
 a.act('R');assert.ok([10,11,12].every(x=>has(a.state.stones,at(spec8,x,10))));
 return{initialLowerFragment:initial,firstTwoSongsLeaveItStill:true,thirdSongMovesIt:true,scope:'Le départ n’est pas un carré 3×3. Une rangée vide et deux colonnes de décalage séparent les fragments ; les membres encore hors portée retiennent d’abord le rang inférieur.'};
});
check('level8-different-stops-shape-the-load','Les deux axes déforment les fragments de façons différentes',()=>{
 const horizontal=prefix(d8,1),vertical=prefix(d8,2);assert.ok([11,12,13].every(x=>has(horizontal.state.stones,at(spec8,x,7))));assert.ok([12,13,14].every(x=>has(horizontal.state.stones,at(spec8,x,10))));
 assert.ok(has(vertical.state.stones,at(spec8,14,8)));assert.ok(has(vertical.state.stones,at(spec8,14,9)));assert.ok(has(vertical.state.stones,at(spec8,12,6)));assert.ok(has(vertical.state.stones,at(spec8,13,6)));
 assert.ok(circuitPressed(vertical.world,vertical.state,'composition'));assert.ok(eq(vertical.state.heroes[3].at,at(spec8,12,4)));
 return{horizontalBlocks:horizontal.state.stones,composedBlocks:vertical.state.stones,bardFillsNinthPlace:true};
});
check('level8-preserve-the-composition','L’échange extrait la Barde sans déformer les huit blocs',()=>{
 const before=prefix(d8,2),after=prefix(d8,3);assert.deepEqual(after.state.stones,before.state.stones);assert.ok(circuitPressed(after.world,after.state,'composition'));
 assert.ok(eq(after.state.heroes[3].at,at(spec8,5,4)));assert.ok(eq(after.state.heroes[2].at,at(spec8,12,4)));
 const a=authorPrefix(d8,2).act('L');assert.equal(circuitPressed(a.world,a.state,'composition'),false);
 return{silentExchangePreserves:true,sungLeftDepartureReleases:true,scope:'La fabrication du motif est le sujet de la salle. Le retrait silencieux conserve ensuite ce travail ; il n’est pas présenté comme une mécanique inédite de SS23.'};
});
check('level8-last-vacancy-replaced','La réserve remplace physiquement le Magicien dans la neuvième place',()=>{
 const before=prefix(d8,4),after=prefix(d8,5);assert.ok(has(before.state.stones,at(spec8,5,4)));assert.ok(eq(before.state.heroes[2].at,at(spec8,12,4)));
 assert.ok(pattern.every(([x,y])=>has(after.state.stones,at(spec8,x,y))));assert.ok(eq(after.state.heroes[2].at,at(spec8,5,4)));assert.ok(circuitPressed(after.world,after.state,'composition'));
 return{finalWeights:after.state.stones,wizardReturnedToGallery:true,scope:'La porte vérifie des boutons ordinaires. Aucun quota de chants, nombre de déplacements, ordre de découverte ou test caché de motif ne déclenche la victoire.'};
});
check('level8-reserve-parking-variant','La réserve peut être garée plus bas avant la composition puis remontée',()=>{
 const a=authorPrefix(d8,0);a.go(2,3,'merchant').act('DD').go(1,12);a.select('bard').act('RRRRRUUUU');a.go(5,4,'wizard').act('R');a.select('bard').act('DDD').go(3,12);
 a.go(2,7,'merchant').act('UU').go(1,4).act('RRRD');a.select('wizard').act('L');a.go(1,9,'warrior');a.go(2,17,'wizard');a.go(4,17,'merchant');a.go(3,14,'bard').act('DDDD');a.go(3,17,'warrior');
 return legalVariant(spec8,a,'Le premier stationnement de la réserve n’est pas imposé. Elle peut attendre dans une autre zone sèche hors du chant, puis retrouver la fenêtre de retour. Le motif final et son dernier poids restent physiques.');
});

check('all-support-motions-empty-water','Les appuis déplacés sont vides de héros et glissent uniquement entre cases d’eau',()=>{
 let count=0;for(const d of designs){const r=replay(d.spec,d.commands);for(const t of r.trace)for(const p of t.phases)for(const m of p.moves)if(m.actor==='support'){
  count++;assert.equal(p.kind,'song');assert.equal(r.world.terrain[m.from.y*20+m.from.x],'~');assert.equal(r.world.terrain[m.to.y*20+m.to.x],'~');assert.ok(!p.before.heroes.some(h=>eq(h.at,m.from)));
 }}assert.equal(count,3);return{supportMoves:count,occupiedSupportMoves:0};
});

const report={game:'SS23',title:'Les Chambres de Résonance',status:'passed',scope:'Revue auteur des salles 6–8 : témoins complets, contraintes de poids et de géométrie, contre-épreuves locales et variantes gagnantes. Les preuves locales ne sont pas présentées comme une unicité globale. Aucun résultat de recherche bornée ne vaut preuve d’impossibilité, et aucune optimalité n’est revendiquée.',checks,totals:{checks:checks.length,passed:checks.length}};
writeFileSync(new URL('../final-ss23-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,totals:report.totals,variants:checks.filter(c=>c.commands&&c.metrics).map(c=>({id:c.id,actions:c.metrics.actions}))}));
