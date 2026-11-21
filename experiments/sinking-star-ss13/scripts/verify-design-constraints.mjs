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

// The rebuilt final rooms are checked independently by audit-hard-finals.mjs.
const report={schemaVersion:1,scope:'Local counterfactuals at documented author-route states; no solver search.',
 limitations:['These checks do not prove global necessity, uniqueness or optimality of any solution.','Author routes and this report are validation-only and are not agent observations.'],
 sources,passed:checks.length,total:checks.length,checks};
const output=new URL('../validation/design-constraints-report.json',import.meta.url);
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:'validation/design-constraints-report.json',passed:report.passed,total:report.total,scope:report.scope}));
