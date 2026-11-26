/** Reproducible local consequences and complete alternatives. Author tooling only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {compileLevel,initialState,stepDetailed,equal,terrainAt,inSongRange} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=Object.fromEntries([3,4,5].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[];
const point=(n,x,y)=>({x:x+Math.floor((20-designs[n].spec.rows[0].length)/2),y:y+Math.floor((20-designs[n].spec.rows.length)/2)});
const sorted=ps=>ps.map(p=>`${p.x},${p.y}`).sort();
const record=(level,name,observed,scope='État ou contre-branche locale rejouée ; aucune solution unique ou optimale affirmée.',extra={})=>checks.push({level,name,status:'passed',observed,scope,...extra});
const at=(n,i)=>replay(designs[n].spec,designs[n].commands.slice(0,designs[n].stages[i].turn));
const one=(world,state,command)=>{const action=decodeCommand(command,state);return stepDetailed(world,state,action.id,action.data);};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
const variant=(n,name,a,scope)=>{const r=win(n,a.commands);record(n,name,r.metrics,scope,{commands:a.commands,expected:{complete:true,dead:false,failed:false}});return r;};

for(const n of [3,4,5]){
 const d=designs[n],r=win(n,d.commands);assert.deepEqual(r.actions,d.actions);assert.deepEqual(r.metrics,d.metrics);
 assert.equal(r.world.goals.length,4);assert.deepEqual(r.state.heroes.map(h=>h.kind),['merchant','warrior','wizard','bard']);
 assert(r.state.heroes.every(h=>!h.dead&&r.world.goals.some(g=>equal(g,h.at))));
 record(n,'Témoin complet et quatre destinations occupées',r.metrics);
}

// N3: the extra cell frees the crossing; a wall changes the composition of the file.
{
 const d=designs[3],a=new Author(d.spec).select('bard');
 const closer=one(a.world,a.state,'D'),blocked=one(a.world,closer.state,'D');
 assert(!closer.state.failed);assert.deepEqual(closer.state.stones,a.state.stones);assert(blocked.state.failed);assert.deepEqual(blocked.state.stones,a.state.stones);
 record(3,'Le groupe nord ne peut pas entrer dans le croisement occupé',{commands:a.commands+'DD',firstStepChangesCrates:false,secondStepRefused:true});

 const rows=[...d.spec.rows];rows[7]=rows[7].slice(0,8)+'#'+rows[7].slice(9);
 const short=new Author({...d.spec,rows}).select('warrior').act('R');const tooShort=one(short.world,short.state,'R');assert(tooShort.state.failed);
 const loaded=at(3,0);assert.equal(loaded.metrics.chainPushes,2);assert(loaded.state.stones.some(p=>equal(p,point(3,8,7))));
 record(3,'La dernière case du bras droit finance la seconde poussée',{removedCell:point(3,8,7),shortArmSecondPushRefused:true,realArmChainPushes:2},'Comparaison locale avec cette seule case murée ; ne prouve pas l’impossibilité de toute autre stratégie sur la carte modifiée.');

 const waiting=new Author(d.spec).select('warrior').act('RR').select('bard').act('D');const occupied=one(waiting.world,waiting.state,'D');assert(occupied.state.failed);
 assert(!inSongRange(waiting.state.heroes[3].at,waiting.state.heroes[1].at));
 record(3,'Le Guerrier doit aussi dégager la réception de cette branche',{commands:waiting.commands+'D',warrior:waiting.state.heroes[1].at,bard:waiting.state.heroes[3].at,refused:true},'Le Guerrier encore dans le croisement est hors portée et bloque la dernière caisse ; le témoin le range dans le bras sud.');

 const shifted=at(3,2);assert.deepEqual(sorted(shifted.state.stones),sorted([[5,6],[3,7],[4,7],[5,7]].map(([x,y])=>point(3,x,y))));
 assert.equal(terrainAt(shifted.world,point(3,4,6)),'#');assert.equal(shifted.metrics.groupSongs,4);assert.equal(shifted.state.stones.length,4);
 const lifted=at(3,3),lastPush=lifted.trace.at(-1).phases.find(p=>p.kind==='push');assert(lastPush);assert.equal(lastPush.moves.filter(m=>m.actor==='stone').length,2);
 record(3,'La butée fabrique une nouvelle file avec les mêmes charges',{afterThreeLeftSongs:shifted.state.stones,wall:point(3,4,6),reusedFile:lastPush.moves,cratesConserved:4});

 const v=new Author(d.spec).act(d.commands.slice(0,d.stages[3].turn));v.go(9,3,'warrior').select('wizard').act('U').go(8,3).go(1,5,'merchant');
 const r=variant(3,'Variante gagnante : le Magicien sort par une caisse après le départ du Guerrier',v,'Les trois poussées de file et la transformation chantée subsistent ; l’échange avec le Guerrier du témoin n’est pas imposé.');
 assert.equal(r.metrics.wizardHeroSwaps,0);assert.equal(r.metrics.wizardStoneSwaps,1);
}

// N4: send the Bard to the work station; the first target must first be moved away.
{
 const d=designs[4],arrived=at(4,0),returnNow=one(arrived.world,arrived.state,'L');
 assert(!returnNow.state.failed&&!returnNow.state.dead);assert(equal(returnNow.state.heroes[2].at,point(4,4,3)));
 assert(equal(returnNow.state.heroes[3].at,point(4,2,3)));assert(returnNow.state.stones.some(p=>equal(p,point(4,10,3))));
 record(4,'Sans dégagement, la balise intercepte le retour',{fromTurn:d.stages[0].turn,command:'L',wizardAfter:returnNow.state.heroes[2].at,bardUnchanged:true,beaconReturnedToStation:true});

 const cleared=at(4,1),sent=at(4,2);assert(equal(sent.state.heroes[3].at,point(4,10,3)));
 assert.deepEqual(sent.state.stones,cleared.state.stones);assert.equal(sent.metrics.wizardHeroSwaps,1);
 const b=new Author(d.spec).act(d.commands.slice(0,d.stages[2].turn)).select('bard');const firstSong=one(b.world,b.state,'D');
 assert(firstSong.state.stones.some(p=>equal(p,point(4,12,5))));assert(firstSong.state.stones.some(p=>equal(p,point(4,13,7))));
 assert(inSongRange(b.hero.at,point(4,12,4)));assert(!inSongRange(b.hero.at,point(4,13,7)));
 record(4,'L’échange installe le spécialiste sans déplacer les stocks',{bardStation:sent.state.heroes[3].at,stonesPreservedBySwap:true,firstSongMoved:point(4,12,4),firstSongHeld:point(4,13,7)},'La portée est mesurée avant le pas, depuis la loge. Cette comparaison porte sur les deux stocks et ce poste précis.');

 const full=win(4,d.commands);for(const turn of full.trace)assert.equal(turn.after.stones.length+turn.after.supports.length,3);
 assert.deepEqual(sorted(full.state.supports),sorted([[6,10],[7,10],[8,10]].map(([x,y])=>point(4,x,y))));
 assert.equal(full.world.mirrors.length,0);assert.equal(full.world.platforms.length,0);assert.equal(full.world.gates.length,0);
 record(4,'La balise et les deux réserves sont réemployées',{initialCrates:3,finalSupports:full.state.supports,reflections:0,hydraulicPlatforms:0,gates:0},'Conservation vérifiée sur chaque étape du témoin ; ne fixe pas tous les emplacements possibles d’une autre traversée.');

 const middle=at(4,5),up=one(middle.world,middle.state,'U'),down=one(middle.world,middle.state,'D');
 assert(up.state.failed);assert(!down.state.failed&&!down.state.dead);assert.deepEqual(down.state.supports,middle.state.supports);
 record(4,'Le départ de la case de service conserve l’appui',{bard:middle.state.heroes[3].at,upRefused:true,downAccepted:true,supportsPreserved:true,blockingCell:point(4,8,11)},'La comparaison porte sur les deux pas depuis la case de service ; l’appui sous-jacent n’est pas un passager.');

 const v=new Author(d.spec).act(d.commands.slice(0,d.stages[2].turn));
 v.go(4,3,'merchant').act('DDDDDD').go(3,10).act('RR').select('warrior').act(d.commands.slice(d.stages[3].turn,d.stages[7].turn));
 v.go(10,13,'merchant').go(14,10,'warrior').go(5,10,'wizard').act('R').go(10,10,'warrior');
 const r=variant(4,'Variante gagnante : le Marchand immerge seul la balise',v,'La poussée mixte enseigne la manutention d’un partenaire ; elle n’est pas une obligation de cette salle. L’envoi du Barde et le travail des réserves sont conservés.');
 assert.equal(r.metrics.warriorPushes,0);
}

// N5: the first receiving cell and the second departure cell have different dangers.
{
 const d=designs[5],initial=new Author(d.spec).select('wizard'),unsafeArrival=one(initial.world,initial.state,'R');
 assert(unsafeArrival.state.dead);assert(unsafeArrival.state.heroes.find(h=>h.kind==='wizard').dead);
 record(5,'Une caisse échangeable peut être une arrivée mortelle',{commands:initial.commands+'R',wizardArrival:point(5,9,5),adjacentMonster:point(5,9,4),deadHero:'wizard'},'La cible est une caisse voisine d’un monstre ; cette mort ne repose pas sur un monstre qui attaquerait avant son échange.');

 const early=new Author(d.spec).select('warrior').act('L').select('bard').act('U').select('wizard').act('RR').select('merchant');
 const prematureExit=one(early.world,early.state,'U');assert(prematureExit.state.dead);assert(prematureExit.state.heroes[0].dead);
 record(5,'Un seul décalage sécurise le Magicien, pas encore le passage du Marchand',{commands:early.commands+'U',merchantArrival:point(5,9,4),monster:point(5,9,3),deadHero:'merchant'},'Le second décalage du témoin dégage le voisinage de ce passage ; d’autres préparations ne sont pas exclues.');

 const near=new Author(d.spec).act(d.commands.slice(0,d.stages[2].turn)).act('RU').select('merchant').act('R').select('wizard');
 const unsafeReception=one(near.world,near.state,'R');
 assert(unsafeReception.state.dead);assert(unsafeReception.state.heroes[0].dead);
 record(5,'Le monstre reçu frappe le partenaire revenu à côté',{commands:near.commands+'R',monsterArrival:point(5,10,4),merchant:point(5,10,5),deadHero:'merchant'},'Le Marchand revient dans sa niche au lieu de s’écarter. Ce contre-parcours local met en évidence le danger du point de réception.');

 const evacuated=at(5,3),transferred=at(5,4),swap=transferred.trace.at(-1).phases.find(p=>p.kind==='swap');
 assert(swap);assert(swap.moves.some(m=>m.actor==='monster'&&equal(m.to,point(5,10,4))));assert.equal(transferred.metrics.bentSwaps,1);
 assert(equal(evacuated.state.heroes[0].at,point(5,13,3)));assert(!transferred.state.dead);
 record(5,'La même réception devient sûre après évacuation',{merchant:evacuated.state.heroes[0].at,swap:swap.moves,ray:swap.paths?.[0],aliveHeroes:4});

 const meeting=at(5,5),combat=meeting.trace.at(-1).phases.find(p=>p.kind==='combat');assert(combat);
 assert.deepEqual(sorted(combat.before.monsters),sorted([[9,4],[10,4]].map(([x,y])=>point(5,x,y))));assert.equal(meeting.state.monsters.length,0);
 assert.equal(meeting.world.circuits.length,0);assert.equal(meeting.world.gates.length,0);assert.equal(meeting.world.platforms.length,0);
 record(5,'La portée sélective provoque une rencontre et dégage le goulot',{beforeContact:combat.before.monsters,monstersAfter:0,circuits:0,gates:0},'Le retrait des deux acteurs libère le passage de retour. La victoire ne lit aucun compteur de morts.');

 const v=new Author(d.spec).select('warrior').act('L').select('bard').act('U').select('wizard').act('R').select('bard').act('U').select('wizard').act('R');
 v.go(13,3,'merchant').select('wizard').act('UR').select('bard').act('DD').go(7,1).go(9,5,'wizard').act('L').go(4,8).go(14,1,'merchant');
 variant(5,'Variante gagnante : l’échange de caisse précède le dernier décalage',v,'Le premier pas suffit à l’arrivée du Magicien ; le second reste effectué avant l’évacuation du Marchand. L’ordre entre ces préparations reste ouvert.');

 const world=compileLevel(d.spec),start=initialState(world),global=one(world,start,'X');assert(global.state.failed&&!global.state.dead);assert.deepEqual(global.state.monsters,start.monsters);
 record(5,'Le reflet global initial est refusé sans effet partiel',{command:'X',refused:true,monstersPreserved:true,blockedMirrorIndices:global.blockedMirrorIndices},'Le gardien occidental viserait la case du second miroir. Cette géométrie corrige le raccourci initial découvert lors de la revue indépendante.');
 const optical=new Author(d.spec).select('warrior').act('L').select('bard').act('UUX').select('wizard').act('RR').go(11,3,'merchant').select('wizard').act('UR').go(13,3,'merchant');
 optical.select('bard').act('DD').go(7,1).go(9,5,'wizard').act('L').go(4,8).go(14,1,'merchant');
 variant(5,'Variante gagnante : reflet préparé et étape d’évacuation intermédiaire',optical,'Après les deux chants préparatoires, le reflet devient légal. Il place le second gardien dans la visée : le Marchand attend un poste plus proche, puis poursuit son évacuation après l’échange du monstre.');
}

for(const n of [3,4,5]){designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');}
const report={game:'SS23',success:true,levels:[3,4,5],method:'Rejeu des témoins et de variantes complètes, conséquences locales des déplacements, portée et première cible, conservation des ressources et sécurité des deux extrémités.',checks,limits:['Aucune solution unique ni longueur minimale démontrée.','La case murée du N3 est un contre-factuel local, pas une recherche exhaustive sur une autre carte.','Les variantes restent autorisées ; la poussée mixte du N4 et le choix de la cible de sortie du N3 ne sont pas des obligations universelles.','Les morts contrôlées du N5 appartiennent uniquement aux branches de revue ; les témoins livrés n’en contiennent aucune.']};
writeFileSync(new URL('../middle-ss23-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,passed:checks.length,report:'reference/middle-ss23-review.json'}));
