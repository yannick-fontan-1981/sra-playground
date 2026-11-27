import assert from 'node:assert/strict';
import { inquire,root } from './enquete.mjs';
import { trace } from './trajet.mjs';
import { sha } from '../revision-96/sonde.mjs';

function normalizePhysical(physical,colors) {
  const [a,b]=colors;
  const renamed=ref=>ref==='material:'+a?'material:'+b:ref==='material:'+b?'material:'+a:ref;
  return {...physical,pieces:physical.pieces.map(([id,box])=>[renamed(id),box]).sort(([x],[y])=>x.localeCompare(y))};
}
function renamedConfiguration(cfg,pairs) {
  // Les références de pièces peuvent aussi figurer dans les paires de support et d'entrée.
  const rename=new Map(pairs);
  return JSON.parse(JSON.stringify(cfg,(_key,value)=>typeof value==='string' && rename.has(value)?rename.get(value):value));
}
export async function evidence(engine=root) {
  const {measurePiercingGoal,searchPiercingPlans}=await import(new URL('src/logos-engine/v5-piercing-plan.ts',engine));
  const {rootedLineModel}=await import(new URL('src/logos-engine/v6-rooted-line-mechanics.ts',engine));
  const nominal=await inquire([],engine);
  const commands=nominal.search.plans[0].action_refs;
  assert.equal(commands.length,11);
  const originalPath=await trace(nominal,commands,engine),record=[];
  for(const colors of [[],[8,14],[9,14]]) {
    const m=colors.length ? await inquire(colors,engine) : nominal;
    const path=colors.length ? await trace(m,commands,engine) : originalPath;
    const rename=n=>n===colors[0]?colors[1]:n===colors[1]?colors[0]:n;
    assert.equal(sha(m.publicFrames.map(frame=>frame.map(row=>row.map(rename)))),sha(nominal.publicFrames));
    assert.deepEqual(m.scene.order.map(n=>String(rename(Number(n)))),nominal.scene.order);
    assert.deepEqual(m.observations.map(s=>s.available_action_refs),nominal.observations.map(s=>s.available_action_refs));
    assert.deepEqual(m.scene.field,nominal.scene.field);
    assert.equal(m.scene.unit,nominal.scene.unit);
    for(const [cmd,effect] of Object.entries(m.state.controls)) {
      const n=nominal.state.controls[cmd];
      assert.deepEqual(effect.root_translation,n.root_translation);
      assert.equal(effect.extent_delta,n.extent_delta);
      assert.equal(effect.evidence_refs.length,2);
    }
    assert.deepEqual(normalizePhysical(m.physical,colors),normalizePhysical(nominal.physical,[]));
    assert.equal(m.state.refuted.length,0);
    assert.equal(m.state.sic_recovery_need,undefined);
    assert.deepEqual(path.map(s=>normalizePhysical(s.physical,colors)),originalPath.map(s=>normalizePhysical(s.physical,[])));
    assert.deepEqual(m.search.plans[0].action_refs,commands);
    assert.equal(m.search.expanded_node_count,282);
    const end=path.at(-1), trial=m.search.plans[0].goal;
    assert.equal(trial.predicted_rooted_match,false);
    assert.equal(trial.rooted_match,false);
    assert.equal(trial.projected_order_trial.status,'compatible_unordered');
    assert.deepEqual(trial.projected_order_trial.groups.map(g=>g.station),[20,26]);
    record.push({couleurs:colors,ordre:m.scene.order,controle:Object.keys(m.state.controls),avant:m.observations[4].observation_ref,
      etats:m.search.expanded_node_count,trajet:commands,projectionsNormalisees:sha(path.map(s=>normalizePhysical(s.physical,colors))),
      noyauParDefaut:end.matched,preuve:trial.projected_order_trial});
  }
  const last=originalPath.at(-1).configuration, target=nominal.scene.order;
  const assess=(configuration,order,policy)=>measurePiercingGoal({configuration,requested_root_ref:'current_root',requested_type_order:order},policy);
  const policy='test_compatible_stations';
  const test=assess(last,target,policy);
  const reverseTie=assess(last,[target[0],target[2],target[1]],policy);
  const reversal=assess(last,[target[1],target[0],target[2]],policy);
  for(const r of [test,reverseTie]) {
    assert.equal(r.projected_order_trial.status,'compatible_unordered');
    assert.deepEqual(r.measured_type_order,[]);
    assert.equal(r.predicted_rooted_match,false);
    assert.equal(r.rooted_match,false);
  }
  assert.equal(reversal.projected_order_trial.status,'incompatible');
  assert.equal(reversal.predicted_rooted_match,false);
  const refs=[['material:14','zeta'],['material:9','alpha'],['material:8','mu']];
  const renamed=renamedConfiguration(last,refs);
  const opaque=assess(renamed,target,policy);
  assert.equal(opaque.projected_order_trial.status,'compatible_unordered');
  assert.notEqual(assess(last,target).predicted_rooted_match,assess(renamed,target).predicted_rooted_match);
  const pureSearch=searchPiercingPlans({configuration:renamedConfiguration(nominal.configuration,refs),
    effects:Object.values(nominal.state.controls),models:[rootedLineModel(nominal.cfg)],goal_requested_root_ref:'current_root',
    goal_requested_type_order:target,max_microsteps:nominal.cfg.max_microsteps,max_depth:nominal.cfg.max_depth,
    max_nodes:nominal.cfg.max_nodes,max_plans:1},undefined,policy);
  assert.deepEqual(pureSearch.plans[0].action_refs,commands);
  assert.equal(pureSearch.expanded_node_count,282);
  const strict=structuredClone(last);
  const middle=strict.pieces.find(p=>p.piece_ref==='material:14');
  middle.occupied_positions=middle.occupied_positions.map(([row,col])=>[row,col-2]);
  const strictGoal=assess(strict,target,policy);
  assert.equal(strictGoal.predicted_rooted_match,true);
  assert.equal(strictGoal.rooted_match,false);
  assert.equal(strictGoal.projected_order_trial,undefined);
  assert.equal(assess(strict,[target[1],target[0],target[2]],policy).predicted_rooted_match,false);
  // Un classement compatible ne remplace pas un support établi dans le modèle.
  const incomplete=structuredClone(last);
  incomplete.possible_support_pairs=[['current_rod','material:8']];
  incomplete.hypothetical_support_pairs=incomplete.hypothetical_support_pairs.filter(([,id])=>id!=='material:8');
  incomplete.pieces.find(p=>p.piece_ref==='material:8').support_refs=[];
  const unsupported={...rootedLineModel(nominal.cfg),possible_support_mode:null,support_assignments:[]};
  const bounded=searchPiercingPlans({configuration:incomplete,effects:[nominal.state.controls.ACTION1],
    models:[unsupported],goal_requested_root_ref:'current_root',goal_requested_type_order:target,
    max_microsteps:nominal.cfg.max_microsteps,max_depth:1,max_nodes:2,max_plans:1},undefined,policy);
  assert.equal(bounded.plans.length,0);
  assert.ok(bounded.missing_premise_refs.includes('premise.supplied_possible_support_hypothesis'));
  return {palettes:record,twiceCompatible:[test.projected_order_trial.status,reverseTie.projected_order_trial.status],
    inversion:reversal.projected_order_trial.status,opaque:opaque.projected_order_trial,opaqueSearch:pureSearch.expanded_node_count,
    strictlyOrdered:strictGoal.measured_type_order,plansSansSupport:bounded.plans.length};
}
