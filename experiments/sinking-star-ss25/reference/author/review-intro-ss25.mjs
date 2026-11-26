/** Reproducible observations and counter-branches for the real tutorial map. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {build,spec} from './build-level1.mjs';
import {QuartetPuzzleSession,circuitPressed,gateClosed,equal,terrainAt} from '../../dist/core.js';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
import {replay} from '../../scripts/solver.mjs';

const d=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const checks=[],record=(name,observed,scope='Contre-branche ou état local réellement rejoué ; aucune unicité ni optimalité déduite.')=>checks.push({level:1,name,status:'passed',observed,scope});
const a=build(),point=(x,y)=>a.point(x,y),hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const atStage=i=>new Author(d.spec).act(d.commands.slice(0,d.stages[i].turn));
const route=replay(d.spec,d.commands),phases=route.trace.flatMap(t=>t.phases);
assert.deepEqual(spec(),d.spec);assert.equal(a.commands,d.commands);assert.deepEqual(a.stages,d.stages);
assert.deepEqual(route.actions,d.actions);assert.deepEqual(route.metrics,d.metrics);
assert(route.state.complete);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
assert.deepEqual(route.world.heroes.map(h=>h.kind),['warrior','thief','wizard','bard']);
record('Le témoin sauvegardé termine avec quatre héros vivants',route.metrics,'Rejeu du JSON et égalité avec le générateur de carte.');

{
 const session=new QuartetPuzzleSession([d.spec]),learned=new Set(),firstObservedAt={};
 const publicPart=o=>JSON.parse(JSON.stringify({level:o.level,frame:o.frame,frames:o.frames,levelsCompleted:o.levelsCompleted}));
 let frames=0,beforeLast,last;
 for(const[i,action]of d.actions.entries()){
  const before=session.observe(),previous=new Set(learned);beforeLast=before;
  last=session.action(action.id,action.data);frames+=last.frames.length;
  assert.deepEqual(last.frames.at(-1),last.frame);assert.equal(last.frames.length,last.frameDurationsMs.length);
  observeLesson(learned,publicPart(before),publicPart(last),action.id);
  for(const id of learned)if(!previous.has(id))firstObservedAt[id]=i+1;
 }
 assert.equal(last.state,'WIN');assert.equal(lessonIds.length,39);assert.deepEqual([...learned].sort(),[...lessonIds].sort());
 assert.deepEqual(session.undo(),beforeLast);const finalAction=d.actions.at(-1);assert.deepEqual(session.action(finalAction.id,finalAction.data),last);
 record('39 découvertes sur les seules observations publiques et Undo exact',{acquired:learned.size,lessons:[...lessonIds],firstObservedAt,frames,actions:d.actions.length,publicFields:['level','frame','frames','levelsCompleted'],finalState:'WIN',completionUndo:true},'Le détecteur reçoit uniquement des copies JSON explicites des quatre champs publics, sans carte ni état privé.');
}

{
 const p=route.trace[d.stages[0].turn-1].phases.find(p=>p.kind==='pull');assert(p);
 assert(p.moves.some(m=>m.actor==='stone'&&equal(m.from,point(3,4))&&equal(m.to,point(3,5))));
 assert(p.before.stones.some(s=>equal(s,point(3,3))));assert(p.after.stones.some(s=>equal(s,point(3,3))));
 assert.equal(p.moves.filter(m=>m.actor==='stone').length,1);
 record('La traction remplace le poids, mais ne prend pas la deuxième caisse',{turn:d.stages[0].turn,moves:p.moves,secondStoneUnchanged:point(3,3)});
 const pushed=route.trace[d.stages[1].turn-1].phases.find(p=>p.kind==='push');assert(pushed);
 assert.equal(pushed.moves.filter(m=>m.actor==='stone').length,2);
 assert(pushed.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pushed.before,'thief').at)));
 assert.equal(pushed.moves.length,4);assert.equal(phases.filter(p=>p.kind==='pull'&&p.before.active===0).length,0);
 record('La file mixte transporte deux caisses et le Voleur sans sa traction',{turn:d.stages[1].turn,moves:pushed.moves});
}

{
 const pushed=route.trace[d.stages[2].turn-1].phases.find(p=>p.kind==='push');assert(pushed);
 assert(pushed.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pushed.before,'wizard').at)));
 assert.deepEqual(pushed.before.stones,pushed.after.stones);
 const swapped=route.trace[d.stages[3].turn-1].phases.find(p=>p.kind==='swap');assert(swapped);
 assert(swapped.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(swapped.before,'bard').at)));
 assert.deepEqual(swapped.before.stones,swapped.after.stones);assert(swapped.after.stones.some(s=>equal(s,point(6,9))));
 const voluntary=atStage(3).select('bard').act('D');assert.notDeepEqual(voluntary.state.stones,swapped.after.stones);
 const pulled=route.trace[d.stages[4].turn-1].phases.find(p=>p.kind==='pull');assert(pulled);
 assert(pulled.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(pulled.before,'bard').at)));assert.deepEqual(pulled.before.stones,pulled.after.stones);
 record('Les transports imposés restent distincts du pouvoir volontaire',{wizardPushTurn:d.stages[2].turn,firstTargetSwapTurn:d.stages[3].turn,fartherStonePreserved:point(6,9),bardPullTurn:d.stages[4].turn,voluntarySongCommands:voluntary.commands});
 const walk=route.trace[d.stages[5].turn-1];assert.equal(walk.phases.length,1);assert.equal(walk.phases[0].kind,'walk');
 record('Le Magicien sans cible effectue un pas ordinaire',{turn:d.stages[5].turn,moves:walk.phases[0].moves});
}

{
 const p=route.trace[d.stages[6].turn-1].phases.find(p=>p.kind==='song');assert(p);
 for(const [x,y]of[[4,3],[4,5]])assert(p.moves.some(m=>m.actor==='stone'&&equal(m.from,point(x,y))&&equal(m.to,point(x,y+1))));
 assert(p.before.stones.some(s=>equal(s,point(4,7))));assert(p.after.stones.some(s=>equal(s,point(4,7))));
 for(const kind of ['warrior','thief','wizard'])assert(p.moves.some(m=>m.actor==='hero'&&equal(m.from,hero(p.before,kind).at)));
 record('Le même chant démontre diagonale, cloison, butée et trois partenaires',{turn:d.stages[6].turn,moves:p.moves,wall:point(5,5),heldStone:point(4,7),stop:point(4,8)});
}

{
 const created=atStage(8);assert(created.state.supports.some(p=>equal(p,point(9,2))));assert(!created.state.stones.some(p=>equal(p,point(9,2))));
 const slides=phases.filter(p=>p.moves.some(m=>m.actor==='support'));
 for(const p of slides){assert.equal(p.kind,'song');for(const m of p.moves.filter(m=>m.actor==='support')){
  assert.equal(terrainAt(route.world,m.from),'~');assert.equal(terrainAt(route.world,m.to),'~');assert(!p.before.heroes.some(h=>equal(h.at,m.from)));
 }}
 const landing=route.trace[d.stages[10].turn-1].phases.find(p=>p.kind==='song'),at=hero(landing.after,'bard').at;
 assert(landing.before.supports.some(p=>equal(p,at)));assert(landing.after.supports.some(p=>equal(p,at)));
 assert(!landing.moves.some(m=>m.actor==='support'&&equal(m.from,at)));
 const exchange=route.trace[d.stages[11].turn-1].phases.find(p=>p.kind==='swap');assert(exchange);assert.deepEqual(exchange.before.supports,exchange.after.supports);
 const bank=route.trace[d.stages[12].turn-1].phases.find(p=>p.kind==='song'),oldWizard=hero(bank.before,'wizard').at;
 assert(bank.before.supports.some(p=>equal(p,oldWizard)));assert(!bank.moves.some(m=>m.actor==='support'&&equal(m.from,oldWizard)));
 const unsafe=replay(d.spec,d.commands.slice(0,d.stages[10].turn)+'R');assert(unsafe.state.failed);assert(!unsafe.state.dead);
 record('Appui consommé, glissement libre et deux formes d’ancrage',{createdAt:point(9,2),supportMoves:slides.flatMap(p=>p.moves.filter(m=>m.actor==='support')),bardLanding:at,occupiedSupport:oldWizard,waterSwapTurn:d.stages[11].turn,unsupportedStepRefused:true,unsupportedCommands:d.commands.slice(0,d.stages[10].turn)+'R'});
}

{
 const presses=phases.filter(p=>p.kind==='piston');assert.equal(presses.length,1);
 assert(presses[0].moves.some(m=>m.actor==='monster'&&equal(m.from,point(3,17))&&equal(m.to,point(3,16))));
 assert(phases.some(p=>p.kind==='song'&&p.moves.some(m=>m.actor==='monster')));assert.equal(route.metrics.monstersRemoved,4);
 const approach=new Author(d.spec).go(1,15,'warrior'),unsafe=replay(d.spec,approach.commands+'R');assert(unsafe.state.dead);
 record('Presse et chant réunissent les monstres ; le Guerrier reste vulnérable',{press:presses[0].moves,monstersRemoved:4,unsafeApproachCommands:approach.commands+'R',orthogonalContactFatal:true});
}

{
 const reflection=phases.filter(p=>p.kind==='reflect');assert.equal(reflection.length,2);
 assert(reflection[0].moves.every(m=>m.actor==='stone'));assert(reflection[1].moves.some(m=>m.actor==='hero'));assert.equal(route.metrics.bentSwaps,1);
 const turn=route.trace[d.stages[17].turn-1],pull=turn.phases.find(p=>p.kind==='pull');assert(pull);
 assert(pull.moves.some(m=>m.actor==='mirror'&&equal(m.from,point(10,16))&&equal(m.to,point(10,17))));
 assert.deepEqual(pull.before.mirrors.map(m=>m.facing),pull.after.mirrors.map(m=>m.facing));
 assert(circuitPressed(route.world,turn.after,'releve'));assert(!gateClosed(route.world,turn.after,0));
 const remove=atStage(17).go(9,17,'thief').act('L');assert(!circuitPressed(remove.world,remove.state,'releve'));assert(gateClosed(remove.world,remove.state,0));
 record('Le miroir sert au transport puis au second poids de sortie',{reflections:reflection.map(p=>p.moves),bentSwapTurn:d.stages[16].turn,mirrorPullTurn:d.stages[17].turn,orientationPreserved:true,removalCommands:remove.commands,gateClosesWhenMirrorLeaves:true});
}

{
 const before=atStage(17),after=atStage(18);assert.deepEqual(before.state.stones,after.state.stones);assert.deepEqual(before.state.mirrors,after.state.mirrors);
 const voluntary=atStage(17).select('bard').act('D');assert.notDeepEqual(voluntary.state.stones,before.state.stones);
 assert(circuitPressed(after.world,after.state,'releve'));
 record('L’extraction tardive du Barde conserve sa charge et les deux commandes',{passiveTurn:d.stages[18].turn,stonesUnchanged:true,voluntarySongCommands:voluntary.commands,voluntarySongMovesStone:true});
 const alternate=atStage(19).go(17,16,'thief').go(15,18,'warrior').go(15,16,'wizard');
 const r=replay(d.spec,alternate.commands);assert(r.state.complete);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 record('Trois arrivées permutées donnent une autre victoire',{commands:alternate.commands,actions:r.metrics.actions,finalState:'WIN'},'Les buts n’imposent aucune couleur ; cette variante conserve toutes les démonstrations et ne prouve pas un minimum de coups.');
}

const report={game:'SS25',success:true,levels:[1],mapSha256:hash(d.spec),witnessSha256:hash(d.actions),checks,limits:['Tutoriel sans quota caché.','Contre-branches locales, sans preuve de solution unique ou optimale.','Aucune qualification de résolution autonome SRA.']};
writeFileSync(new URL('../intro-ss25-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,checks:checks.length,actions:route.metrics.actions,lessons:lessonIds.length,report:'reference/intro-ss25-review.json'}));
