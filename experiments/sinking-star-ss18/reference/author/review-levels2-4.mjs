import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {stepDetailed,contains} from '../../dist/core.js';
import {replay} from '../../scripts/solver.mjs';

const load=n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url),'utf8'));
const ds=[2,3,4].map(load),report={success:false,scope:'Rejeux et contre-branches locales des niveaux 2 à 4 ; aucune optimalité ou unicité revendiquée.',levels:[],checks:[]};
for(const [i,d] of ds.entries()){
 const r=replay(d.spec,d.commands);
 assert.equal(r.state.complete,true);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.deepEqual(r.metrics,d.metrics);
 report.levels.push({level:i+2,title:d.spec.title,actions:r.metrics.actions,moves:r.metrics.actions-r.metrics.selections,metrics:r.metrics,goals:r.world.goals});
}

// L2: the Merchant is imprisoned before the first reflected load arrives.
{
 const d=ds[0],a=new Author(d.spec);
 const blocked=[1,2,3,4].map(id=>stepDetailed(a.world,a.state,id).state.failed);
 assert(blocked.every(Boolean));
 report.checks.push({level:2,name:'Cellule initiale du Marchand',passed:true,observed:'Les quatre déplacements sont refusés avant le premier chargement distant.'});
 a.act(d.commands.slice(0,d.stages[3].turn));a.go(15,7,'wizard').act('X');
 const rejected=stepDetailed(a.world,a.state,4);assert.equal(rejected.state.failed,true);
 report.checks.push({level:2,name:'Basculer avant d’entrer dans le sas est',passed:true,commands:a.commands+'R',observed:'La première presse se ferme avant le passage ; le pas vers l’est est refusé.'});
 const trace=replay(d.spec,d.commands).trace;
 const ejection=trace.find(t=>t.phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'&&m.to.x===17&&m.to.y===7)));
 assert(ejection);assert.equal(ejection.after.dead,false);
 report.checks.push({level:2,name:'Bascule avec le Magicien dans le sas',passed:true,turn:trace.indexOf(ejection)+1,observed:'Une presse se ferme et transporte le Magicien dans la case libérée par l’autre.'});
}

// L3: a legal song can undo the sorting; a forced move preserves it.
{
 const d=ds[1],r=replay(d.spec,d.adaptation.localChecks[0].commands);
 assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert(contains(r.state.stones,{x:6,y:8}));assert(contains(r.state.stones,{x:6,y:12}));
 const world=r.world;
 assert.equal(world.buttons.length+world.doors.length+world.gates.length+world.mirrors.length+world.platforms.length,0);
 assert.equal(world.terrain.filter(t=>t==='~').length,0);
 report.checks.push({level:3,name:'Départ volontaire du Barde',passed:true,commands:d.adaptation.localChecks[0].commands,observed:'Les deux accès verticaux se remplissent de caisses ; aucun verrou ajouté ne produit cette contrainte.'});
 const solved=replay(d.spec,d.commands),extraction=solved.trace.find(t=>t.phases.some(p=>p.kind==='push'&&p.moves.some(m=>m.actor==='hero'&&m.from.x===5&&m.from.y===10)));
 assert(extraction);assert.equal(extraction.phases.some(p=>p.kind==='song'),false);
 assert(!contains(extraction.after.stones,{x:6,y:8}));assert(!contains(extraction.after.stones,{x:6,y:12}));
 report.checks.push({level:3,name:'Extraction par poussée du Marchand',passed:true,turn:solved.trace.indexOf(extraction)+1,observed:'Le Barde se déplace sans chant et les deux accès restent dégagés.'});
}

// L4: the reference departure is an actual simultaneous transfer of three heroes.
{
 const d=ds[2],r=replay(d.spec,d.adaptation.localChecks[0].commands),last=r.trace.at(-1);
 assert.equal(r.metrics.blocked,1);assert.equal(r.metrics.deaths,0);
 assert.deepEqual(last.before.heroes.map(h=>h.at),last.after.heroes.map(h=>h.at));
 report.checks.push({level:4,name:'Troisième commande libre',passed:true,commands:d.adaptation.localChecks[0].commands,observed:'Le reflet prématuré est refusé sans déplacer aucun héros.'});
 const solved=replay(d.spec,d.commands),finish=solved.trace.at(-1),phase=finish.phases.find(p=>p.kind==='reflect');
 assert.equal(phase.moves.filter(m=>m.actor==='hero').length,3);assert.equal(finish.after.complete,true);
 assert.equal(new Set(solved.world.goals.map(p=>p.x)).size,3);assert.equal(new Set(solved.world.goals.map(p=>p.y)).size,3);
 report.checks.push({level:4,name:'Départ collectif vers trois secteurs',passed:true,turn:d.commands.length,observed:'Les trois héros gagnent simultanément trois destinations de lignes et colonnes différentes.'});
}
report.success=true;
writeFileSync(new URL('../levels2-4-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
