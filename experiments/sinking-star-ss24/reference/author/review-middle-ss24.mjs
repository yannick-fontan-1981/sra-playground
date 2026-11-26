/** Reproducible author review: local consequences and complete legal alternatives. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {stepDetailed,equal,terrainAt,inSongRange,circuitPressed,traceSwap} from '../../dist/core.js';
import {replay,decodeCommand} from '../../scripts/solver.mjs';

const designs=Object.fromEntries([3,4,5].map(n=>[n,JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url)))]));
const checks=[],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const point=(n,x,y)=>({x:x+Math.floor((20-designs[n].spec.rows[0].length)/2),y:y+Math.floor((20-designs[n].spec.rows.length)/2)});
const sorted=ps=>ps.map(p=>`${p.x},${p.y}`).sort();
const record=(level,name,observed,scope='Conséquence de l’état ou de la branche annoncés ; aucune unicité ni optimalité affirmée.',extra={})=>checks.push({level,name,status:'passed',observed,scope,...extra});
const one=(world,state,c)=>{const a=decodeCommand(c,state);return stepDetailed(world,state,a.id,a.data);};
const at=(n,i)=>replay(designs[n].spec,designs[n].commands.slice(0,designs[n].stages[i].turn));
const prefix=(n,i,role)=>{const a=new Author(designs[n].spec).act(designs[n].commands.slice(0,designs[n].stages[i].turn));return role?a.select(role):a;};
const win=(n,commands)=>{const r=replay(designs[n].spec,commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);return r;};
const variant=(n,name,commands,scope)=>{const r=win(n,commands);record(n,name,r.metrics,scope,{commands,expected:{complete:true,dead:false,failed:false}});return r;};

for(const n of [3,4,5]){
 const d=designs[n],r=win(n,d.commands);assert.deepEqual(r.actions,d.actions);assert.deepEqual(r.metrics,d.metrics);
 assert.equal(r.world.goals.length,4);assert.deepEqual(r.state.heroes.map(h=>h.kind),['merchant','thief','wizard','bard']);
 assert(r.state.heroes.every(h=>!h.dead&&r.world.goals.some(g=>equal(g,h.at))));
 const beforeLast=r.world.goals.filter(g=>r.trace.at(-1).before.heroes.some(h=>equal(h.at,g))).length;assert(beforeLast<4);
 record(n,'Témoin complet : quatre rôles vivants et quatre destinations', {...r.metrics,goalCountBeforeLastAction:beforeLast,mapSha256:hash(d.spec),actionsSha256:hash(d.actions)});
}

// N3 — separating a pair, clearing returned targets and reusing the upper charge.
{
 const d=designs[3],initial=new Author(d.spec),blocked=one(initial.world,initial.state,'R');
 assert(blocked.state.failed);assert.deepEqual(blocked.state.stones,initial.state.stones);
 const t=new Author(d.spec).select('thief'),pull=one(t.world,t.state,'R');assert(!pull.state.failed&&!pull.state.dead);
 assert(pull.state.stones.some(p=>equal(p,point(3,6,4))));assert(pull.state.stones.some(p=>equal(p,point(3,8,4))));
 assert.equal(pull.phases[0].moves.filter(m=>m.actor==='stone').length,1);
 const after=prefix(3,0,'merchant'),single=one(after.world,after.state,'R');assert(!single.state.failed);assert(single.state.stones.some(p=>equal(p,point(3,7,4))));
 record(3,'La paire bloque le Marchand ; la traction ne sépare que son voisin',{initialPushRefused:true,firstPull:pull.phases[0].moves,pushAfterSeparation:single.phases[0].moves});

 const crossed=at(3,2);assert.equal(crossed.metrics.wizardStoneSwaps,2);assert.equal(crossed.metrics.wizardHeroSwaps,1);
 assert(crossed.state.stones.some(p=>equal(p,point(3,5,7))));assert(crossed.state.stones.some(p=>equal(p,point(3,6,7))));
 const back=one(crossed.world,crossed.state,'L');assert(!back.state.failed);assert(equal(back.state.heroes[2].at,point(3,7,7)));assert(equal(back.state.heroes[3].at,point(3,4,7)));
 const poised=prefix(3,3,'thief').go(6,8).select('wizard'),masked=one(poised.world,poised.state,'L');assert(!masked.state.failed);assert(equal(masked.state.heroes[2].at,point(3,6,7)));
 const ready=at(3,4),send=one(ready.world,{...ready.state,active:2},'L');assert(!send.state.failed);assert(equal(send.state.heroes[3].at,point(3,10,7)));
 record(3,'Les caisses renvoyées masquent la Barde jusqu’à leur dégagement',{returnedTargets:[point(3,5,7),point(3,6,7)],firstThiefInterception:back.state.heroes[2].at,crateAfterThiefReposition:masked.state.heroes[2].at,bardAfterClearing:send.state.heroes[3].at});

 const m=prefix(3,5,'merchant').go(6,4),tooEarly=one(m.world,m.state,'R');assert(tooEarly.state.failed);
 const b=prefix(3,5,'bard').go(9,6),down=one(b.world,b.state,'D');assert(!down.state.failed);
 assert(inSongRange(b.hero.at,point(3,7,4))&&inSongRange(b.hero.at,point(3,8,4)));
 assert(down.state.stones.some(p=>equal(p,point(3,7,4))));assert(down.state.stones.some(p=>equal(p,point(3,8,5))));assert.equal(terrainAt(b.world,point(3,7,5)),'#');
 record(3,'La butée garde la caisse arrière pendant la dépose de la tête',{pushBeforeSongRefused:true,bard:b.hero.at,held:point(3,7,4),movedTo:point(3,8,5),wall:point(3,7,5)});

 const full=win(3,d.commands);for(const t of full.trace){assert.equal(t.after.stones.length,4);assert.equal(t.after.supports.length,0);}
 const returned=at(3,8);assert(returned.state.stones.some(p=>equal(p,point(3,5,4))));assert.equal(returned.metrics.wizardStoneSwaps,3);
 assert(full.metrics.thiefPulls>returned.metrics.thiefPulls);assert.equal(full.world.gates.length,0);
 record(3,'La charge haute sert encore de cible puis de charge extraite au retour',{cratesConserved:4,returnedCharge:point(3,5,4),laterPulls:full.metrics.thiefPulls-returned.metrics.thiefPulls,gates:0});

 const v=variant(3,'Variante gagnante : construire l’appui de la galerie basse','CDDRDRCRRRCCCDLDCCUCDLLDDRRRRRUURRRUUURRRCCDDRRRRCCCULLDDRURRURRRDDRRCCRURRUURRUUUR','La variante dépense une caisse dans la coupure basse et réorganise les partenaires par traction. Elle garde des échanges, une extraction et des chants ; la conservation de quatre caisses sèches et le trajet supérieur ne sont pas obligatoires.');
 assert.equal(v.metrics.actions,83);assert.equal(v.state.supports.length,1);assert.equal(v.state.stones.length,3);assert(v.metrics.thiefPartnerPulls>0);
}

// N4 — moving the caster changes the aim and the position left to the receiver.
{
 const d=designs[4],z=new Author(d.spec).select('wizard'),oldAim=one(z.world,z.state,'U');assert(oldAim.state.failed);
 const shifted=at(4,0),aim=traceSwap(shifted.world,{...shifted.state,active:2},'N');assert(aim.plan);assert.equal(aim.plan.reflections,1);assert(equal(aim.plan.to,point(4,3,3)));
 assert.equal(shifted.metrics.thiefPartnerPulls,1);assert.equal(shifted.metrics.swaps,0);assert.deepEqual(shifted.state.stones,z.state.stones);
 record(4,'Une traction donne une autre colonne de visée sans lancer de sort',{initialUpRefused:true,wizardAfterPull:shifted.state.heroes[2].at,newTarget:aim.plan.to,ray:aim.plan.path,reflections:aim.plan.reflections});

 const direct=new Author(d.spec).select('wizard').act('RU').select('thief'),exit=one(direct.world,direct.state,'R');assert(exit.state.failed);assert(equal(direct.hero.at,point(4,5,5)));assert(direct.state.stones.some(p=>equal(p,point(4,6,5))));
 record(4,'L’échange direct laisse le Voleur derrière la caisse reçue',{commands:direct.commands+'R',thief:direct.hero.at,blockingCharge:point(4,6,5),firstExitRefused:true},'Ce refus concerne la sortie immédiate. Une variante complète ci-dessous réorganise les charges et récupère le Voleur.');

 const initial=new Author(d.spec),reflect=one(initial.world,initial.state,'X');assert(!reflect.state.failed);assert(reflect.state.dead);assert(reflect.state.heroes[1].dead);assert(equal(reflect.state.heroes[1].at,point(4,4,3)));assert.equal(terrainAt(initial.world,point(4,4,3)),'~');assert.deepEqual(reflect.state.stones,initial.state.stones);
 record(4,'Le reflet global initial envoie le Voleur dans l’eau nue',{command:'X',refused:false,deadHero:'thief',landing:point(4,4,3),cratesPreserved:true},'Cette activation est légale mais mortelle. Seul l’état initial est comparé ; les autres usages possibles du miroir restent autorisés.');

 const loaded=at(4,3),chain=one(loaded.world,loaded.state,'D');assert(chain.state.failed);
 const b=prefix(4,3,'bard'),song=one(b.world,b.state,'R');assert(!song.state.failed);
 assert(song.state.stones.some(p=>equal(p,point(4,7,6))));assert(song.state.stones.some(p=>equal(p,point(4,8,7))));assert(equal(song.state.heroes[0].at,point(4,8,5)));
 assert.equal(terrainAt(b.world,point(4,8,6)),'#');assert.deepEqual(song.phases.map(p=>p.kind),['song']);
 record(4,'La butée sépare le chargement et le chant transporte le Marchand sans poussée',{doublePushRefused:true,heldCharge:point(4,7,6),shiftedCharge:point(4,8,7),merchantAfter:song.state.heroes[0].at,phaseKinds:song.phases.map(p=>p.kind)});

 const delivered=at(4,5),full=win(4,d.commands);assert(circuitPressed(delivered.world,delivered.state,'acces'));assert(delivered.state.gateClosed.every(x=>!x));
 for(const t of full.trace)assert.equal(t.after.stones.length,2);assert.deepEqual(full.state.mirrors,full.world.mirrors);assert(full.state.stones.some(p=>equal(p,point(4,7,9))));assert(full.state.stones.some(p=>equal(p,point(4,3,7))));
 const ret=full.trace.flatMap(t=>t.phases).filter(p=>p.kind==='swap').at(-1);assert(ret.moves.some(m=>m.actor==='stone'&&equal(m.from,point(4,8,7))&&equal(m.to,point(4,3,7))));
 record(4,'Le retour réemploie la caisse écartée et conserve le poids livré',{returnSwap:ret.moves,weight:point(4,7,9),cratesConserved:2,mirrorMoved:false,pistonPushes:full.metrics.pistonPushes});

 const v=variant(4,'Variante gagnante : échange direct puis récupération du Voleur','CCRUCUULRRDDLDCCRRRRDRRDDLRUUUUCCCUULLLDDDCCCDDRUUURRDDRRCUUURRDDRRRRUURRCCDDDDRRRRRRUUCCCDDDRRDD','L’échange initial atteint la même colonne mais laisse le Voleur dans la niche. Neuf chants, puis une traction de partenaire, réorganisent la réception. La visée coudée, la livraison et la cible de retour restent utiles ; la traction initiale du Magicien n’est pas universellement nécessaire.');
 assert.equal(v.metrics.actions,97);assert.equal(v.metrics.wizardHeroSwaps,1);assert.equal(v.metrics.songs,9);
}

// N5 — deliberate release after loading; reciprocal relays alone keep the circuit.
{
 const d=designs[5],relay=at(5,1);assert(circuitPressed(relay.world,relay.state,'relais'));assert.equal(relay.metrics.pistonPushes,0);assert.equal(relay.state.supports.length,0);
 assert(equal(relay.state.heroes[2].at,point(5,8,10)));assert(equal(relay.state.heroes[1].at,point(5,9,10)));
 record(5,'La première relève libère le chargeur sans fermer la presse',{wizard:relay.state.heroes[2].at,thief:relay.state.heroes[1].at,circuitPressed:true,pistonPushes:0});

 const loaded=at(5,2),state={...loaded.state,active:2},directions={};assert(loaded.state.stones.some(p=>equal(p,point(5,12,4))));
 for(const c of 'UDLR'){
  const r=one(loaded.world,state,c);directions[c]={refused:r.state.failed,circuitPressed:circuitPressed(loaded.world,r.state,'relais'),phases:r.phases.map(p=>p.kind)};
  assert(circuitPressed(loaded.world,r.state,'relais'));assert.equal(r.state.supports.length,0);assert(!r.phases.some(p=>p.kind==='piston'));
  if(c==='U'||c==='D')assert(r.state.failed);else{assert(!r.state.failed);assert(r.phases.some(p=>p.kind==='swap'));}
 }
 record(5,'Depuis le poste chargé, aucune flèche du Magicien ne vide simplement la commande',{fromTurn:d.stages[2].turn,directions},'Quatre gestes depuis cet état précis. Les déplacements ultérieurs des deux écrans peuvent modifier ces possibilités.');

 const passive=one(loaded.world,{...loaded.state,active:1},'R');assert(!passive.state.failed&&!passive.state.dead);assert(!circuitPressed(loaded.world,passive.state,'relais'));assert(equal(passive.state.heroes[2].at,point(5,9,10)));assert(passive.phases.some(p=>p.kind==='pull'));assert(passive.phases.some(p=>p.kind==='piston'));assert(passive.state.supports.some(p=>equal(p,point(5,13,4))));
 record(5,'La traction du partenaire peut aussi produire la rupture préparée',{fromTurn:d.stages[2].turn,command:'R',active:'thief',wizardAfter:passive.state.heroes[2].at,phaseKinds:passive.phases.map(p=>p.kind),createdSupport:point(5,13,4)},'Ce transport ne lance aucun sort et conserve le problème du chargement puis du retrait. Une variante complète ci-dessous remplace le chant par cette traction.');

 const pulling=prefix(5,3,'wizard').go(5,7).select('thief'),continuous=one(pulling.world,pulling.state,'R');assert(!continuous.state.failed);assert(circuitPressed(pulling.world,continuous.state,'relais'));assert.equal(continuous.state.supports.length,0);assert(continuous.state.stones.some(p=>equal(p,point(5,8,10))));
 record(5,'Une traction volontaire remplace le Voleur et laisse le chargement sur la presse',{commands:pulling.commands+'R',circuitPressed:true,weight:point(5,8,10),cargoStillLoaded:continuous.state.stones.some(p=>equal(p,point(5,12,4))),pistonPushes:continuous.phases.filter(p=>p.kind==='piston').length});

 const b=prefix(5,3,'bard'),released=one(b.world,b.state,'R');assert(!released.state.failed&&!released.state.dead);
 assert(inSongRange(b.hero.at,point(5,8,10)));assert(!inSongRange(b.hero.at,point(5,7,10)));assert.equal(terrainAt(b.world,point(5,12,10)),'#');
 const song=released.phases.find(p=>p.kind==='song'),press=released.phases.find(p=>p.kind==='piston');assert(song&&press);assert.equal(song.moves.filter(m=>m.actor==='hero').length,3);assert(!song.moves.some(m=>m.actor==='stone'));
 assert(!circuitPressed(b.world,released.state,'relais'));assert(released.state.supports.some(p=>equal(p,point(5,13,4))));assert(press.moves.some(m=>m.actor==='stone'&&equal(m.from,point(5,12,4))));
 record(5,'Le chant laisse les écrans en place et produit une véritable fermeture chargée',{song: song.moves,piston:press.moves,createdSupport:point(5,13,4),rearScreenOutOfRange:true,rightScreenHeldBy:point(5,12,10)});

 const crowded=prefix(5,4,'thief'),left=one(crowded.world,crowded.state,'L'),again=one(crowded.world,left.state,'R');assert(!left.state.failed);assert(equal(left.state.heroes[2].at,point(5,9,10)));assert(again.state.failed);
 record(5,'Revenir avant le retrait du Magicien le tire dans le passage',{commands:crowded.commands+'LR',firstMoveAccepted:true,pulledWizard:left.state.heroes[2].at,nextMoveRefused:true},'Le retour immédiat reste légal mais ramène le Magicien devant le Voleur. Le témoin le range avant cette traction.');

 const kept=at(5,5),full=win(5,d.commands);assert(circuitPressed(kept.world,kept.state,'relais'));assert(kept.state.gateClosed.every(x=>!x));assert(kept.state.stones.some(p=>equal(p,point(5,8,10))));
 for(const t of full.trace)assert.equal(t.after.stones.length+t.after.supports.length,3);
 assert.equal(full.state.stones.length,2);assert.equal(full.state.supports.length,1);assert.equal(full.metrics.pistonPushes,1);
 record(5,'La réouverture et la relève finale conservent les trois ressources',{dryCrates:2,supports:1,finalWeight:point(5,8,10),pistonPushes:1,circuitPressed:true},'Inventaire et maintien du passage sur le témoin ; le moteur n’exige pas un nombre particulier de fermetures.');

 const early=new Author(d.spec).select('bard'),emptyClose=one(early.world,early.state,'R');assert(!emptyClose.state.failed&&!emptyClose.state.dead);assert(!circuitPressed(early.world,emptyClose.state,'relais'));assert.equal(emptyClose.state.supports.length,0);assert(!emptyClose.phases.some(p=>p.kind==='piston'));
 record(5,'Une fermeture avant chargement ne construit aucun appui',{commands:early.commands+'R',pressClosed:true,supportsCreated:0,pistonPushes:0},'La fermeture prématurée est légale et peut être réparée. Le test établit uniquement l’absence de dépôt quand la presse est vide.');

 const v=variant(5,'Variante gagnante : le Voleur assure la première relève par traction','CLUUUUUURRRRRDLDDDLDLDCCCRCCRCRCCCUUULLLLLCCCLRDDLLULCCDLUUUUUUUUURRRRDDRRCUUUUUURRRRRRRRUURRCCUUURRRRRRRRRUUCCCUUUUUUURRRRRRRRDD','La première relève remplace le Voleur par le Magicien tiré, puis le Marchand prépare la réserve plus tard. Le chargement, la rupture chantée, la fermeture et la relève finale sont conservés.');
 assert.equal(v.metrics.actions,129);assert.equal(v.metrics.wizardHeroSwaps,1);assert.equal(v.metrics.thiefPartnerPulls,1);assert.equal(v.metrics.pistonPushes,1);

 const passiveVariant=variant(5,'Variante gagnante : tirer le Magicien pour déclencher la fermeture','RCCLCCCUUUUUURRRDLDDDLDLDRCUUULLLLCCCULDLRUULLDDDLCCUUUUUUUURRRRDDRRCUUUUUURRRRRRRRUURRCCUUURRRRRRRRRUUCCCUUUUUUURRRRRRRRDD','Après chargement, le Voleur tire le Magicien hors de la commande, puis contourne l’écran droit avant de rétablir le circuit. La variante n’emploie aucun chant ; elle conserve la relève, le chargement, le transport passif qui interrompt l’occupation, la fermeture et le poids final.');
 assert.equal(passiveVariant.metrics.actions,123);assert.equal(passiveVariant.metrics.songs,0);assert.equal(passiveVariant.metrics.thiefPartnerPulls,1);assert.equal(passiveVariant.metrics.pistonPushes,1);
}

for(const n of [3,4,5]){
 designs[n].adaptation.localChecks=checks.filter(c=>c.level===n).map(({level,...c})=>c);
 writeFileSync(new URL(`../level${n}-design.json`,import.meta.url),JSON.stringify(designs[n],null,2)+'\n');
}
const report={game:'SS24',success:true,levels:[3,4,5],method:'Direct replay of authored routes, comparison of concrete local branches and complete legal alternatives. No search timeout is used as an impossibility proof.',checks,limits:[
 'Les témoins prouvent une résolution, sans optimalité ni unicité.',
 'Les variantes publiées peuvent éviter un geste du témoin ; le jeu ne compte pas les capacités employées.',
 'La marche individuelle initiale et la comparaison des terrains historiques sont qualifiées séparément par le contrôle global.',
 'Les mécanismes de la source qui ne sont pas dans SS24 (clones, lumière orange, feu de dragon) ne sont pas importés.'
]};
writeFileSync(new URL('../middle-ss24-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:3,checks:checks.length,variants:checks.filter(c=>c.commands&&c.expected).length}));
