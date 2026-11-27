import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { root,variants } from './jouer.mjs';
import { refs,run,withEngine } from './moteurs.mjs';
import { secondView } from './seconde-vue.mjs';
import { sha } from './sonde.mjs';
const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
if(!values.pyodide) throw Error('Indiquer --pyodide');
const temp=await mkdtemp(join(tmpdir(),'sic-92-experiment-')), output=join(temp,'case.json');
function event(row,kind) {return row.before.findLast(e=>e.kind===kind);}
async function play(condition,engine,extra=[]) {
  run(process.execPath,[fileURLToPath(new URL('operateur.mjs',import.meta.url)),'--condition',condition,'--source',engine,
    '--pyodide',resolve(values.pyodide),'--recu',output,...extra]);
  return JSON.parse(await readFile(output,'utf8'));
}
function firstThirteen(result) {
  return result.history.slice(0,13).map(r=>[r.ticket,r.family,r.strategy,r.objective,r.returned]);
}
function release(result) {
  return result.history.map(({before,...row})=>{
    const {registration,...returned}=row.returned;
    return {...row,returned};
  });
}
try {
  const runs={};
  for(const name of variants) runs[name]=await play(name,root);
  const nominal=runs.nominal,[t13,t14,t15]=nominal.history.slice(12);
  const fields=kind=>event(t14,kind).data;
  assert.equal(t13.strategy,'confirm_access_obstruction');
  assert.equal(t13.returned.registration.block.stationary_trials,2);
  assert.equal(t13.returned.view.status,'no_new_area');
  assert.equal(t13.returned.ref,t14.ticket.ref);
  for(const result of Object.values(runs)) {
    assert.equal(result.prefix.length,14);
    assert.deepEqual(result.prefix,nominal.prefix);
    assert.deepEqual(firstThirteen(result),firstThirteen(nominal));
    for(const r of result.history) for(const e of r.before) assert.equal(sha(e.data),e.seal);
  }
  const view=fields('vue-avant'),slate=fields('questions'),freq=fields('frequences');
  assert.ok(view.question);
  assert.equal(view.block.key,t13.returned.registration.block.key);
  assert.equal(view.block.count,2);
  assert.equal(view.reveal,null);
  assert.deepEqual(fields('vue-parcours'),{phase:'obstruction',offres:[]});
  assert.equal(fields('vue-offre').status,null);
  assert.equal(view.points,0);
  assert.equal(fields('continuite-avant').plain.length,4);
  assert.deepEqual(slate.evidence,view.refs);
  assert.equal(slate.evidence.length,5);
  assert.equal(slate.evidence.at(-1),t13.returned.ref);
  assert.deepEqual(slate.questions.map(q=>[q.command.action_ref,q.priority]),[['ACTION3',3],['ACTION4',3],['ACTION1',3]]);
  const counts=Object.fromEntries(freq.questions.map(q=>[q.command,q.usage]));
  assert.equal(counts.ACTION3,counts.ACTION4);
  assert.ok(counts.ACTION1>counts.ACTION3);
  assert.equal(freq.order,'least_tried');
  assert.equal(slate.routeAttempted,false);
  assert.equal(slate.route,null);
  assert.deepEqual([t14.family,t14.strategy,t14.kind,t14.ticket.command],['view_continuity','test_local_input','experiment','ACTION3']);
  assert.equal(t14.objective.id,slate.questions[0].id);
  assert.equal(t14.purpose,'view_continuity');
  assert.equal(t14.guard.accepted,true);
  assert.equal(t14.returned.matched,null);
  assert.equal(t14.returned.status,'unknown_effect_observed');
  assert.deepEqual(t14.returned.acquisition,{objective:t14.objective.id,status:'observed',need:t14.need.id});
  assert.ok(t14.need.evidence.includes(t13.returned.ref));
  assert.equal(t14.need.satisfactionContract,'acquire_the_selected_input_return');
  assert.equal(t14.returned.registration.pixels,0);
  assert.equal(t14.returned.registration.block.stationary_trials,2);
  assert.equal(t15.ticket.command,t14.ticket.command);
  assert.equal(t15.family,'observed_frontier');
  assert.equal(event(t15,'vue-avant').data.question,true);
  assert.equal(event(t15,'continuite-avant').data.question,false);
  assert.notEqual(t15.objective.id,t14.objective.id);
  const prior=runs['premier-arret'].history[13];
  assert.equal(event(prior,'vue-avant').data.block.count,1);
  assert.deepEqual(event(prior,'vue-avant').data.plain,view.plain);
  assert.deepEqual([prior.family,prior.strategy,prior.ticket.command],['view','confirm_access_obstruction','ACTION2']);
  assert.equal(event(prior,'continuite-avant'),undefined);
  assert.equal(runs['premier-arret'].history[14].family,'view_continuity');
  const empty=runs['sans-question'].history[13],ordinary=runs['but-ordinaire'].history[13];
  for(const r of [empty,ordinary]) {
    assert.equal(r.ticket.command,t14.ticket.command);
    assert.equal(r.returned.ref,t14.returned.ref);
    assert.equal(r.purpose,null);
    assert.notEqual(r.objective.label,t14.objective.label);
  }
  assert.equal(empty.family,'observed_frontier');
  assert.equal(event(empty,'continuite-offre').data.status,null);
  assert.equal(ordinary.family,'view_continuity');
  const other=runs['autre-offre'].history[13],withdrawn=runs['commande-retiree'].history[13];
  assert.deepEqual(event(other,'questions'),event(t14,'questions'));
  assert.equal(other.objective.id,slate.questions[1].id);
  for(const r of [other,withdrawn]) {
    assert.equal(r.family,'view_continuity');
    assert.equal(r.ticket.command,'ACTION4');
    assert.equal(r.guard.accepted,true);
    assert.equal(r.returned.acquisition.objective,r.objective.id);
    assert.equal(r.returned.acquisition.need,r.need.id);
  }
  assert.ok(event(withdrawn,'questions').data.questions.every(q=>q.command.action_ref!=='ACTION3'));
  const held=runs.ponctuelles;
  assert.equal(held.history.length,13);
  assert.equal(held.tail.findLast(e=>e.kind==='continuite-offre').data.status,'unknown_no_observed_view_access');
  assert.equal(held.stop,'frontier_unknown_no_observed_view_access');
  const fixture=await secondView(root);
  assert.deepEqual(fixture.reveal,{status:'supported_bulk_offset',offset:[2,0],pixels:32,block:null});
  assert.deepEqual(fixture.evidence,[fixture.current]);
  assert.equal(fixture.noQuestion,null);
  assert.equal(fixture.priorView,null);
  assert.equal(fixture.offeredPoints,5);
  assert.equal(fixture.withoutPlain.status,'unknown_no_observed_view_access');
  assert.equal(fixture.action.action_ref,'ACTION1');
  assert.equal(fixture.guard.admitted,true);
  assert.equal(fixture.outcome.sic_frontier_outcome.need,fixture.need.id);
  assert.equal(fixture.next.action_ref,'ACTION2');
  assert.equal(fixture.exhausted.status,'frontier_exhausted');
  assert.deepEqual(fixture.exhausted.agenda,[['test_local_input','skipped'],['reach_open_input','no_plan']]);
  const without=await play('nominal',root,['--sans-sonde']);
  assert.deepEqual(release(without),release(nominal));
  const parity={};
  for(const [name,exercises] of [['historique',['nominal']],['gel',variants],['ligne91',['nominal','autre-offre','premier-arret']]]) {
    await withEngine(name,async engine=>{
      parity[name]={};
      for(const v of exercises) {
        const actual=await play(v,engine);
        assert.equal(sha(actual),sha(runs[v]),name+' / '+v);
        parity[name][v]=sha(actual);
      }
      assert.deepEqual(await secondView(engine),fixture);
    });
  }
  const compact=r=>({tour:r.i,famille:r.family,strategie:r.strategy,commande:r.ticket.command,question:r.objective?.id,
    finalite:r.purpose,objet:r.objective?.label,besoin:r.need?.id,garde:r.guard,retour:r.returned});
  const report={candidat:run('git',['rev-parse','HEAD']).trim(),refs,parite:parity,prefixe:sha(nominal.prefix),
    avantChoix:t14.before,decision:compact(t14),suite:compact(t15),sansSonde:sha(release(without)),fixture,
    conditions:Object.fromEntries(Object.entries(runs).map(([n,r])=>[n,r.history[13]?compact(r.history[13]):{arret:r.stop}]))};
  if(values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n');
  console.log('LS19/92 · 14 observations archivées, retour réel de ACTION3, trois offres locales ; ACTION4 testée et acquise.');
  console.log('Distances de bord non comparées au tour 14. Le retrait de la question conserve ACTION3 et change de famille.');
  console.log('Contrôles du gel, du candidat 91, de la translation indépendante et du parcours sans sonde réussis.');
} finally {await rm(temp,{recursive:true,force:true});}
