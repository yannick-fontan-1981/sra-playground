/** Author-only local counterfactual validation. Never imported by the playable bundle or SRA runtime. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,circuitPressed,platformActive,equal} from '../dist/core.js';
import {replay,decodeCommand} from './solver.mjs';

const checks=[],sources=[];
function load(n){
 const path=new URL(`../reference/level${n}-design.json`,import.meta.url),bytes=readFileSync(path),data=JSON.parse(bytes);
 sources.push({level:n,path:`reference/level${n}-design.json`,sha256:createHash('sha256').update(bytes).digest('hex')});
 return {...data,world:compileLevel(data.spec),full:replay(data.spec,data.commands)};
}
const prefix=(d,turn)=>replay(d.spec,d.commands.slice(0,turn)).state;
const stage=(d,index)=>prefix(d,d.stages[index].turn);
function act(d,s,c){const a=decodeCommand(c,s);return stepDetailed(d.world,s,a.id,a.data);}
const good=r=>!r.state.failed&&!r.state.dead;
const moved=(r,actor)=>r.phases.flatMap(p=>p.moves).filter(m=>m.actor===actor);
const outcome=(d,r)=>({refused:r.state.failed,dead:r.state.dead,phases:r.phases.map(p=>p.kind),
 heroes:r.state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),supports:r.state.supports,
 circuits:Object.fromEntries(d.world.circuits.map(c=>[c.id,circuitPressed(d.world,r.state,c.id)])),
 moves:r.phases.flatMap(p=>p.moves)});
function check(id,level,claim,condition,evidence){assert.ok(condition,id);checks.push({id,level,claim,status:'PASS',evidence});}

const l4=load(4),moored=stage(l4,2),walking=act(l4,moored,'R'),departing=prefix(l4,l4.commands.length-1),reflected=act(l4,departing,'X');
check('l4-walk-removes-weight-reflection-keeps-it',4,
 'Au point de départ contrôlé, marcher vers l’est tire le miroir hors du bouton; le départ prévu par reflet conserve la commande.',
 circuitPressed(l4.world,moored,'mirror-mooring')&&good(walking)&&!circuitPressed(l4.world,walking.state,'mirror-mooring')&&moved(walking,'mirror').length===1&&
 good(reflected)&&circuitPressed(l4.world,reflected.state,'mirror-mooring')&&moved(reflected,'hero').length===1&&moved(reflected,'mirror').length===0,
 {walkingFromTurn:l4.stages[2].turn,walking:outcome(l4,walking),reflectionFromTurn:l4.commands.length-1,reflection:outcome(l4,reflected)});

const l5=load(5),blocked=act(l5,initialState(l5.world),'X'),transfer=l5.full.trace.find(t=>t.phases.some(p=>p.kind==='reflect'));
check('l5-mirror-must-be-cleared-in-tested-setup',5,
 'Le miroir initial refuse le reflet; le parcours déplace ce miroir avant le transfert réussi du Voleur.',
 blocked.state.failed&&!blocked.state.dead&&transfer&&!transfer.after.failed&&!transfer.after.dead&&transfer.phases.some(p=>p.moves.some(m=>m.actor==='hero'))&&l5.full.metrics.mirrorMoves>0,
 {initial:outcome(l5,blocked),witnessTransfer:{action:transfer.action,phases:transfer.phases.map(p=>p.kind),moves:transfer.phases.flatMap(p=>p.moves)}});

const l6=load(6),loaded=stage(l6,0),voluntary=act(l6,loaded,'R'),forced=l6.full.trace.find(t=>t.phases.some(p=>p.kind==='piston'));
const piston=forced.phases.find(p=>p.kind==='piston'),landing=piston.moves.find(m=>m.actor==='hero').to;
const landingIndex=l6.world.platforms.findIndex(p=>equal(p.at,landing)),landingDevice=l6.world.platforms[landingIndex];
check('l6-press-opens-its-own-forced-landing',6,
 'Après chargement, le pas volontaire vers l’est est refusé; la commande distante déclenche la presse et active l’appui sous l’arrivée forcée du Voleur.',
 voluntary.state.failed&&!voluntary.state.dead&&!forced.after.failed&&!forced.after.dead&&piston.moves.some(m=>m.actor==='stone')&&
 landingIndex>=0&&landingDevice.circuit==='chargement'&&!platformActive(l6.world,forced.before,landingIndex)&&platformActive(l6.world,forced.after,landingIndex)&&
 circuitPressed(l6.world,forced.after,'chargement')&&!forced.phases.some(p=>p.kind==='pull'),
 {voluntaryFromTurn:l6.stages[0].turn,voluntary:outcome(l6,voluntary),landingDevice,forced:{action:forced.action,phases:forced.phases.map(p=>p.kind),moves:piston.moves,
 landingActiveBefore:platformActive(l6.world,forced.before,landingIndex),landingActiveAfter:platformActive(l6.world,forced.after,landingIndex)}});

const l7=load(7),unshifted=act(l7,initialState(l7.world),'X'),shifted=act(l7,stage(l7,0),'X');
check('l7-mirror-offset-changes-water-landing',7,
 'Avant décalage, le reflet laisse la caisse sur le sol; après décalage, il crée le premier appui dans l’eau. Le parcours en crée ensuite un second.',
 good(unshifted)&&good(shifted)&&unshifted.state.supports.length===0&&shifted.state.supports.length===1&&stage(l7,6).supports.length===2,
 {beforeOffset:outcome(l7,unshifted),afterOffset:outcome(l7,shifted),secondSupportTurn:l7.stages[6].turn,secondSupports:stage(l7,6).supports});

const l8=load(8),mage=act(l8,initialState(l8.world),'C').state,unsafeCast=act(l8,mage,'R');
check('l8-near-target-is-unsafe-before-thief-clears-it',8,
 'L’échange initial vers l’est vise la caisse proche gardée et tue le Magicien; le parcours retire cette caisse avant son échange lointain.',
 !unsafeCast.state.failed&&unsafeCast.state.dead&&unsafeCast.phases.some(p=>p.kind==='swap')&&unsafeCast.phases.some(p=>p.kind==='combat'),
 {prematureCast:outcome(l8,unsafeCast),clearedLineTurn:l8.stages[0].turn,safeFarExchangeTurn:l8.stages[3].turn});
const early=act(l8,stage(l8,3),'X');
check('l8-reflection-before-weight-handoff-is-fatal',8,
 'Refléter avant que la caisse relève le Magicien retire la commande et fait disparaître l’appui d’arrivée du Voleur.',
 !early.state.failed&&early.state.dead&&!circuitPressed(l8.world,early.state,'arrivee'),
 {fromTurn:l8.stages[3].turn,result:outcome(l8,early)});
const farther=act(l8,stage(l8,4),'X');
check('l8-weight-handoff-alone-is-insufficient',8,
 'Après le remplacement du poids mais avant le rapprochement du Magicien, le miroir déplace la caisse de commande et l’arrivée du Voleur reste fatale.',
 !farther.state.failed&&farther.state.dead&&!circuitPressed(l8.world,farther.state,'arrivee')&&moved(farther,'stone').length===1,
 {fromTurn:l8.stages[4].turn,result:outcome(l8,farther)});
const ready=act(l8,stage(l8,5),'X');
check('l8-prepared-priority-moves-two-heroes-keeps-weight',8,
 'Lorsque le Magicien devient la cible la plus proche, les deux miroirs déplacent les deux héros et conservent la caisse sur la commande.',
 good(ready)&&moved(ready,'hero').length===2&&moved(ready,'stone').length===0&&circuitPressed(l8.world,ready.state,'arrivee'),
 {fromTurn:l8.stages[5].turn,result:outcome(l8,ready)});

const report={schemaVersion:1,scope:'Local counterfactuals at documented author-route states; no solver search.',
 limitations:['These checks do not prove global necessity, uniqueness or optimality of any solution.','Author routes and this report are validation-only and are not agent observations.'],
 sources,passed:checks.length,total:checks.length,checks};
const output=new URL('../validation/design-constraints-report.json',import.meta.url);
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'validation/design-constraints-report.json',passed:report.passed,total:report.total,scope:report.scope}));
