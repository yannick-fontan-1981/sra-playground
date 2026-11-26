/** Local design claims and legal alternatives; no optimality or unique-solution claim. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,inSongRange,terrainAt,equal} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=Object.fromEntries([3,4,5].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const ok=(level,name,observed,scope='État ou branche locale rejouée ; aucune unicité ou nécessité universelle de chaque capacité affirmée.',extra={})=>checks.push({level,name,status:'passed',observed,scope,...extra});
const at=(n,k)=>replay(designs[n].spec,designs[n].commands.slice(0,designs[n].stages[k].turn));
const one=(w,s,c)=>{const action=decodeCommand(c,s);return stepDetailed(w,s,action.id,action.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
const variant=(n,name,a,scope)=>{const r=win(n,a.commands);ok(n,name,r.metrics,scope,{commands:a.commands,expected:{complete:true,dead:false,failed:false}});};

for(const n of [3,4,5]){
 const d=designs[n],r=win(n,d.commands);assert.deepEqual(d.actions,r.actions);assert.equal(r.world.heroes.length,4);assert.equal(r.world.goals.length,4);
 assert.deepEqual(r.state.heroes.map(h=>h.kind).sort(),['bard','merchant','thief','warrior']);
 d.metrics=r.metrics;
 ok(n,'Témoin complet, quatre personnages et quatre destinations',r.metrics);
}

// N3: a forced press movement disconnects the Thief without activating his traction.
{
 const d=designs[3],loaded=at(3,0),ready=at(3,1),released=at(3,2);
 const pushes=loaded.trace.flatMap(t=>t.phases).filter(p=>p.kind==='push');assert.equal(pushes.length,2);
 assert(pushes.every(p=>p.before.heroes[p.before.active].kind==='warrior'&&p.moves.filter(m=>m.actor==='stone').length===2));
 assert.deepEqual(loaded.state.stones,[{x:10,y:5},{x:11,y:5}]);
 ok(3,'Une file réelle distribue les deux charges',{pushes:pushes.map(p=>p.moves),loadingPositions:loaded.state.stones});
 assert.deepEqual(ready.state.heroes[2].at,{x:10,y:10});assert(ready.state.stones.some(p=>equal(p,{x:10,y:9})));assert(circuitPressed(ready.world,ready.state,'sortie'));
 for(const p of [{x:9,y:10},{x:11,y:10}])assert.equal(terrainAt(ready.world,p),'#');
 const ownDeparture=one(ready.world,ready.state,'D');assert(!ownDeparture.state.failed&&!ownDeparture.state.dead);
 assert(ownDeparture.phases.some(p=>p.kind==='pull'));assert(ownDeparture.state.stones.some(p=>equal(p,{x:10,y:10})));assert(!circuitPressed(ready.world,ownDeparture.state,'sortie'));assert(ownDeparture.state.gateClosed[1]);
 ok(3,'Le départ volontaire reprend le poids de sortie',{from:{x:10,y:10},command:'D',thiefAfter:ownDeparture.state.heroes[2].at,crateAfter:{x:10,y:10},exitClosed:true},'Contre-branche locale ; la caisse est encore présente et peut nécessiter une nouvelle intervention.');
 const finalTurn=released.trace.at(-1),press=finalTurn.phases.find(p=>p.kind==='piston');assert(press);
 assert.deepEqual(press.moves,[{actor:'hero',from:{x:10,y:10},to:{x:10,y:11}}]);assert(finalTurn.phases.every(p=>p.kind!=='pull'));
 assert(released.state.stones.some(p=>equal(p,{x:10,y:9})));assert(circuitPressed(released.world,released.state,'sortie'));assert(circuitPressed(released.world,released.state,'decrochage'));
 ok(3,'La presse libère le Voleur en laissant sa caisse',{turn:released.trace.length,phases:finalTurn.phases.map(p=>p.kind),pressMoves:press.moves,exitWeight:{x:10,y:9},controlWeight:{x:11,y:3}});
 const songs=released.trace.flatMap(t=>t.phases).filter(p=>p.kind==='song');assert.equal(songs.length,2);assert(songs.every(p=>p.moves.some(m=>m.actor==='stone'&&m.from.x===11)));
 assert.equal(terrainAt(released.world,{x:10,y:3}),'#');assert.equal(terrainAt(released.world,{x:10,y:4}),'#');
 const cleared=at(3,3);assert.deepEqual(cleared.state.stones,released.state.stones);
 ok(3,'Le chant traverse la cloison, puis le mur retient la commande',{songCrateMoves:songs.flatMap(p=>p.moves.filter(m=>m.actor==='stone')),bardAfter:cleared.state.heroes[3].at,controlPreserved:true});
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn));alternate.go(11,16,'bard').go(12,18,'thief').go(8,17,'warrior').go(6,16,'merchant');
 variant(3,'Variante gagnante : le Marchand entre en dernier',alternate,'Les deux poids autorisent plusieurs ordres d’arrivée ; le choix du témoin n’est pas une règle.');
}

// N4: select only the upper gallery and preserve the one dry resource for a different water gap.
{
 const d=designs[4],a=new Author(d.spec).select('bard'),initial=a.state;
 assert(inSongRange(initial.heroes[3].at,{x:8,y:6}));assert(inSongRange(initial.heroes[3].at,{x:8,y:10}));
 const wrong=one(a.world,initial,'R');assert(!wrong.state.failed&&!wrong.state.dead);assert.equal(wrong.state.stones.length,0);assert.deepEqual(wrong.state.supports,[{x:9,y:10}]);assert.equal(wrong.state.monsters.length,0);
 const raised=one(a.world,initial,'U');assert(!raised.state.failed&&!raised.state.dead);assert(inSongRange(raised.state.heroes[3].at,{x:8,y:6}));assert(!inSongRange(raised.state.heroes[3].at,{x:8,y:10}));
 const correct=one(a.world,raised.state,'R');assert(!correct.state.failed&&!correct.state.dead);assert.deepEqual(correct.state.stones,[{x:8,y:10}]);assert.equal(correct.state.supports.length,0);assert.equal(correct.state.monsters.length,0);
 ok(4,'Un pas change la galerie sélectionnée',{lowerPost:initial.heroes[3].at,upperPost:raised.state.heroes[3].at,lowerSong:{monsters:0,stones:0,support:{x:9,y:10}},upperSong:{monsters:0,dryCrate:{x:8,y:10}}},'Les deux branches partent de la même position. Seul le pas vers le haut exclut la réserve du carré de chant.');
 const waters=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(terrainAt(a.world,{x,y})==='~')waters.push({x,y});
 assert.deepEqual(waters,[{x:9,y:10},{x:16,y:15}]);assert.equal(a.world.mirrors.length,0);assert.equal(a.world.platforms.length,0);
 for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])assert.notEqual(terrainAt(a.world,{x:9+dx,y:10+dy}),'~');
 const component=[a.world.goals[0]],seen=new Set(component.map(p=>`${p.x},${p.y}`));
 for(let i=0;i<component.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const p={x:component[i].x+dx,y:component[i].y+dy},key=`${p.x},${p.y}`;if(terrainAt(a.world,p)!=='.'||seen.has(key))continue;seen.add(key);component.push(p);}
 assert(a.world.goals.every(p=>seen.has(`${p.x},${p.y}`)));assert(wrong.state.heroes.every(h=>!seen.has(`${h.at.x},${h.at.y}`)));
 ok(4,'La mare inutile ne peut pas fournir l’appui final',{waterCells:waters,wrongBranchDryCrates:0,wrongBranchSupport:{x:9,y:10},supportHasNoWaterNeighbour:true,destinationComponent:component},'Argument géométrique pour cette branche : aucun miroir ni plateforme, plus de caisse sèche, un appui qui ne peut se déplacer que vers une case d’eau voisine, et toutes les destinations dans une composante terrestre encore vide. Annuler le geste restaure la ressource.');
 const extracted=at(4,2);assert.deepEqual(extracted.state.stones,[{x:6,y:12}]);assert(extracted.metrics.thiefPulls===4);
 const launched=at(4,4),mixed=launched.trace.at(-1).phases.find(p=>p.kind==='push');assert(mixed);assert.equal(mixed.before.heroes[mixed.before.active].kind,'warrior');
 assert.deepEqual(mixed.moves,[{actor:'hero',from:{x:13,y:15},to:{x:14,y:15}},{actor:'hero',from:{x:14,y:15},to:{x:15,y:15}},{actor:'stone',from:{x:15,y:15},to:{x:16,y:15}}]);
 assert.deepEqual(launched.state.supports,[{x:16,y:15}]);assert.equal(launched.state.stones.length,0);
 ok(4,'La ressource sauvée est extraite puis lancée avec un partenaire',{extracted:extracted.state.stones[0],mixedFile:mixed.moves,finalSupport:launched.state.supports[0]});
 const alternate=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn));alternate.act('R').go(17,18).go(11,14,'warrior').go(18,18,'thief').go(18,14,'bard').go(17,14,'warrior');
 const alternativeResult=win(4,alternate.commands);assert.equal(alternativeResult.metrics.warriorPushes,0);
 variant(4,'Variante gagnante : le Marchand lance seul la caisse',alternate,'La file mixte montre un réemploi coopératif ; cette variante prouve que la poussée du Guerrier n’est pas imposée pour gagner cette salle.');
}

// N5: the middle delivery has two accesses with different unassisted departure geometry.
{
 const d=designs[5],distributed=at(5,0);assert.deepEqual(distributed.state.stones,[{x:7,y:4},{x:8,y:4},{x:10,y:9}]);assert.equal(distributed.metrics.chainPushes,3);
 const upperWeight=at(5,1),lowerWeight=at(5,3);assert(upperWeight.state.stones.some(p=>equal(p,{x:8,y:3})));assert(lowerWeight.state.stones.some(p=>equal(p,{x:8,y:15})));assert(!circuitPressed(lowerWeight.world,lowerWeight.state,'arrivee'));
 ok(5,'Deux livraisons détachent la file avant le réglage central',{initialFileDestination:distributed.state.stones,upperWeight:{x:8,y:3},lowerWeight:{x:8,y:15},finalAccessStillClosed:true});
 const good=at(5,4),goodExit=one(good.world,good.state,'U');assert(circuitPressed(good.world,good.state,'arrivee'));assert(!goodExit.state.failed&&!goodExit.state.dead);assert(circuitPressed(good.world,goodExit.state,'arrivee'));assert.deepEqual(goodExit.state.stones,good.state.stones);
 const cleared=at(5,5);assert.deepEqual(cleared.state.stones,good.state.stones);assert(circuitPressed(cleared.world,cleared.state,'arrivee'));
 ok(5,'La sortie haute conserve le décalage utile',{bardBefore:good.state.heroes[3].at,command:'U',bardAfter:goodExit.state.heroes[3].at,middleWeight:{x:12,y:9},weightPreservedThroughoutDetour:true});
 const lower=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn)).go(8,11,'bard').act('RR');
 assert.deepEqual(lower.hero.at,{x:10,y:11});assert(circuitPressed(lower.world,lower.state,'arrivee'));
 for(const p of [{x:10,y:10},{x:10,y:12},{x:11,y:11}])assert.equal(terrainAt(lower.world,p),'#');
 const retreat=one(lower.world,lower.state,'L');assert(!retreat.state.failed&&!retreat.state.dead);assert(retreat.state.stones.some(p=>equal(p,{x:11,y:9})));assert(!circuitPressed(lower.world,retreat.state,'arrivee'));
 ok(5,'Le retrait autonome de l’accès bas reprend la charge',{bard:lower.hero.at,onlyFreeNeighbour:{x:9,y:11},retreat:'L',middleCrateAfter:{x:11,y:9},exitClosed:true},'L’impossibilité porte sur un retrait autonome conservant la charge depuis ce poste ; elle ne supprime pas les transports par un partenaire.');
 const turnBeforeRescue=lower.commands.length;lower.go(9,11,'thief').act('LLLL').go(1,16);
 const rescue=replay(d.spec,lower.commands).trace.slice(turnBeforeRescue).flatMap(t=>t.phases).filter(p=>p.kind==='pull'&&p.moves.some(m=>m.actor==='hero'&&equal(m.from,p.before.heroes[3].at)));
 assert.equal(rescue.length,4);for(const p of rescue){assert(circuitPressed(lower.world,p.before,'arrivee'));assert(circuitPressed(lower.world,p.after,'arrivee'));assert.deepEqual(p.after.stones,p.before.stones);}
 assert.deepEqual(lower.state.heroes[3].at,{x:6,y:11});
 ok(5,'Un partenaire fournit une autre sortie sans chant',{pulls:rescue.map(p=>p.moves),bardAfter:lower.state.heroes[3].at,middleWeightPreserved:true});
 lower.go(18,18,'bard').go(14,14,'merchant').go(17,14,'warrior').go(14,18,'thief');
 variant(5,'Variante gagnante : entrée basse et secours du Voleur',lower,'L’accès haut autorise le départ autonome ; l’accès bas fonctionne aussi grâce au transport imposé. L’adaptation conserve les quatre pouvoirs sans ajouter de règle cachée interdisant cette coopération.');
}

for(const n of [3,4,5]){designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');}
const report={game:'SS22',success:true,levels:[3,4,5],method:'Témoins complets, conséquences de presses, comparaison de portées, bilan d’une ressource et géométrie des accès ; variantes complètes rejouées.',limits:['Aucune solution unique ou optimale revendiquée.','Les comparaisons de branches partent d’états précisés et ne remplacent pas une recherche exhaustive.','Le bilan géométrique du niveau 4 concerne la branche qui immerge l’unique caisse dans la mare isolée.','Les variantes des niveaux 4 et 5 restent légales et font partie de la qualification.'],checks};
writeFileSync(new URL('../middle-ss22-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/middle-ss22-review.json'}));
