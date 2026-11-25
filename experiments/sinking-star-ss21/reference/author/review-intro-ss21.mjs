/** Authored-room review. These checks establish witnessed effects, not unique solutions. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,terrainAt,equal} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=Object.fromEntries([1,2].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const ok=(level,name,observed,scope='État ou contre-branche locale rejouée ; aucune nécessité globale ni solution unique affirmée.')=>checks.push({level,name,status:'passed',observed,scope});
const at=(n,k)=>replay(designs[n].spec,designs[n].commands.slice(0,designs[n].stages[k].turn));
const one=(w,s,c)=>{const a=decodeCommand(c,s);return stepDetailed(w,s,a.id,a.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
for(const n of [1,2]){
 const d=designs[n],r=win(n,d.commands);assert.equal(r.world.heroes.length,4);assert.equal(r.world.goals.length,4);
 assert.deepEqual(r.actions,d.actions);ok(n,'Parcours complet avec quatre destinations',r.metrics);
}

// Workshop: actions teach their visible consequences; the exit is controlled by physical weights.
{
 const opening=at(1,0);assert(circuitPressed(opening.world,opening.state,'atelier'));assert(opening.state.stones.some(p=>equal(p,{x:4,y:2})));
 assert(opening.world.gates.filter(g=>g.circuit==='atelier').every(g=>!opening.state.gateClosed[opening.world.gates.indexOf(g)]));
 ok(1,'Une seule caisse ouvre les deux accès bleus',{button:{x:4,y:2},gates:opening.world.gates.filter(g=>g.circuit==='atelier').map(g=>g.at)});
 const file=at(1,1),pushes=file.trace.flatMap(t=>t.phases).filter(p=>p.kind==='push'&&p.before.heroes[p.before.active].kind==='warrior');
 assert(pushes.some(p=>p.moves.filter(m=>m.actor==='stone').length===2&&p.moves.filter(m=>m.actor==='hero').length===2));
 const separated=at(1,2);assert(separated.metrics.thiefPulls>0);assert(separated.trace.flatMap(t=>t.phases).some(p=>p.kind==='pull'&&p.moves.some(m=>m.actor==='hero'&&!equal(m.from,p.before.heroes[p.before.active].at))));
 ok(1,'La file mixte puis son extraction changent réellement les occupants',{mixedPushes:pushes.map(p=>p.moves),partnerPulls:separated.metrics.partnerMoves});
 const optics=at(1,4);assert(optics.metrics.bentSwaps>0);assert(optics.metrics.reflections>0);assert(optics.metrics.mirrorMoves>0);
 const water=at(1,5);assert.deepEqual(water.state.supports,[{x:13,y:4}]);assert.equal(terrainAt(water.world,{x:13,y:4}),'~');
 ok(1,'Les transports optiques précèdent un appui fixe réellement traversé',{bentSwaps:optics.metrics.bentSwaps,reflections:optics.metrics.reflections,mirrorMoves:optics.metrics.mirrorMoves,supports:water.state.supports});
 const meeting=at(1,8),last=meeting.trace.at(-1);assert.deepEqual(last.phases.map(p=>p.kind),['walk','piston','combat']);
 assert.deepEqual(last.phases.find(p=>p.kind==='piston').moves,[{actor:'monster',from:{x:14,y:12},to:{x:15,y:12}}]);
 assert.equal(last.before.monsters.length,2);assert.equal(last.after.monsters.length,0);assert(!last.after.dead);
 ok(1,'La presse déclenche une rencontre, sans déplacement autonome des gardiens',{phases:last.phases.map(p=>p.kind),moved:last.phases[1].moves,monstersBefore:2,monstersAfter:0});
 const ready=at(1,12);assert(circuitPressed(ready.world,ready.state,'sorties'));assert(ready.world.circuits.find(c=>c.id==='sorties').buttons.every(b=>ready.state.stones.some(p=>equal(p,b))));
 const released=one(ready.world,ready.state,'D');assert(!released.state.failed&&!released.state.dead);assert(!circuitPressed(ready.world,released.state,'sorties'));
 const exits=ready.world.gates.map((g,i)=>g.circuit==='sorties'?i:-1).filter(i=>i>=0);assert(exits.every(i=>released.state.gateClosed[i]));
 ok(1,'Retirer le troisième poids referme les quatre passages',{command:'D',thiefBefore:ready.state.heroes[2].at,stoneAfter:{x:11,y:13},closedExitCount:exits.length},'Retrait légal au stade préparé ; il ne constitue pas une preuve d’impasse irréversible.');
 const alternate=new Author(designs[1].spec).act(designs[1].commands.slice(0,designs[1].stages[12].turn));
 alternate.go(11,17,'thief').go(7,17,'warrior').go(3,17,'merchant').go(17,17,'wizard');
 ok(1,'Variante gagnante : le Magicien part en dernier',win(1,alternate.commands).metrics,'Les mêmes poids autorisent plusieurs ordres de départ ; le témoin ne fixe pas un ordre caché.');
}

// Two one-cell chambers: exchanging occupants frees a hero only if a replacement remains behind.
{
 const d=designs[2],world=compileLevel(d.spec),start=initialState(world),chambers=[{x:2,y:3},{x:16,y:12}];
 for(const p of chambers){assert.equal(terrainAt(world,p),'.');assert.equal([[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>terrainAt(world,{x:p.x+dx,y:p.y+dy})==='.').length,0);}
 assert.equal(start.stones.length,3);assert.equal(world.mirrors.length,0);assert.equal(world.platforms.length,0);
 ok(2,'Deux chambres à une case isolées de la cour',{chambers,initialCrates:3,waterSpans:[[{x:3,y:3},{x:4,y:3},{x:5,y:3}],[{x:13,y:12},{x:14,y:12},{x:15,y:12}]]},'Constat géométrique initial, sans calcul exhaustif de tous les plans possibles.');
 const first=at(2,0),undoExchange=one(first.world,first.state,'R');assert(!undoExchange.state.failed&&!undoExchange.state.dead);
 assert.deepEqual(undoExchange.state.heroes[1].at,chambers[0]);assert.deepEqual(undoExchange.state.heroes[3].at,{x:11,y:3});
 ok(2,'Un retour immédiat réenferme le Guerrier',{command:'R',warrior:undoExchange.state.heroes[1].at,wizard:undoExchange.state.heroes[3].at},'Contre-branche réversible : le Magicien sort, mais la libération du partenaire est annulée.');
 const north=at(2,2),south=at(2,6);assert(north.state.stones.some(p=>equal(p,chambers[0])));assert(south.state.stones.some(p=>equal(p,chambers[1])));
 assert(south.state.heroes.every(h=>!chambers.some(p=>equal(p,h.at))));
 const complete=win(2,d.commands);for(const t of complete.trace)for(const p of chambers){const count=t.after.heroes.filter(h=>equal(h.at,p)).length+t.after.stones.filter(q=>equal(q,p)).length;assert.equal(count,1);}
 ok(2,'Les caisses remplacent les héros dans les deux chambres',{replacements:south.state.stones.filter(p=>chambers.some(q=>equal(p,q))),remainingMobileCrate:south.state.stones.find(p=>!chambers.some(q=>equal(p,q)))},'Le nombre d’occupants de chaque chambre reste un à chaque état du parcours qualifié.');
 const second=at(2,4),repeat=one(second.world,second.state,'L');assert(!repeat.state.failed&&!repeat.state.dead);assert.deepEqual(repeat.state.heroes[2].at,chambers[1]);
 ok(2,'Le retour sud sans remplacement réenferme le Voleur',{command:'L',thief:repeat.state.heroes[2].at,wizard:repeat.state.heroes[3].at});
 const ready=at(2,7);assert.deepEqual(ready.state.stones,[chambers[0],chambers[1],{x:9,y:15}]);assert(circuitPressed(world,ready.state,'retour'));assert(!ready.state.gateClosed[0]);
 ok(2,'La troisième caisse maintient le passage final',{threeDestinationsForCrates:ready.state.stones,gate:world.gates[0].at,open:true});
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[7].turn));alternate.go(3,17,'warrior').go(2,15,'merchant').go(6,17,'thief').go(5,15,'wizard');
 ok(2,'Variante gagnante : évacuation dans un autre ordre',win(2,alternate.commands).metrics,'L’allocation des trois charges reste identique ; cette variante ne prouve pas une allocation unique.');
}

for(const n of [1,2]){designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');}
const report={game:'SS21',success:true,levels:[1,2],method:'Rejeu des étapes, effets physiques, chambres isolées, contre-branches de relève et variantes gagnantes.',limits:['Aucun parcours optimal ou unique revendiqué.','Les variantes n’établissent pas la nécessité universelle de chaque capacité.','Les conséquences des contre-branches sont locales ; les erreurs peuvent être réparées ou annulées.'],checks};
writeFileSync(new URL('../intro-ss21-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/intro-ss21-review.json'}));
