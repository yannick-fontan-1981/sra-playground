import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const [receipt]=process.argv.slice(2);
const {result,foreign}=JSON.parse(readFileSync(receipt,'utf8'));
const groups=['G50T','AS66'].map(code=>{
  const runs=result.filter(r=>r.code===code);
  assert.deepEqual(runs.map(r=>r.budget),['absent',1,0]);
  for(const r of runs){
    assert.equal(r.budgets.maxActions,16);
    assert.ok(r.budgets.levelActionCaps.every(cap=>cap===600));
    assert.equal(r.rows.length,16);
    assert.equal(r.stop.reason,'session_action_budget');
    assert.ok(r.rows.every(s=>s.guard.admitted===true));
  }
  const [reference,active]=runs;
  assert.deepEqual(active.rows,reference.rows);
  return runs;
});
const [[,affordable,exhausted], [,as66,as66zero]]=groups;
const a=affordable.rows[0],b=exhausted.rows[0];
assert.deepEqual(a.before,b.before);
assert.deepEqual(a.ticket,b.ticket);
assert.equal(a.ticket.action,'ACTION1');
assert.equal(a.packet,b.packet);
assert.equal(a.physical,b.physical);
assert.equal(a.event.observation_ref,b.event.observation_ref);
assert.notEqual(a.ticket.ref,a.event.observation_ref);
assert.equal(a.event.sic_plan,a.plan.id);
assert.equal(b.event.sic_plan,b.plan.id);
assert.deepEqual([a.plan.family,a.guard.reason,a.event.family,a.event.reason,a.event.matched],
  ['sic_verify_remote_replay','current_replay_and_carrier_bound','sic_verify_remote_replay',
    'compare_replayed_motion_and_remote_return',null]);
assert.deepEqual([b.plan.family,b.guard.reason,b.event.family,b.event.reason,b.event.matched],
  ['sic_public_input_exploration','current_public_input_bound','sic_public_input_exploration','observed_public_input_return',null]);
assert.equal(a.plan.need.kind,'use_repeated_remote_effect_to_gain_access');
assert.equal(b.plan.need.kind,'learn_public_command_effect');
const x=affordable.comparisons[0],y=exhausted.comparisons[0];
assert.equal(x.firstDifference,null);
assert.equal(y.firstDifference,'selected');
assert.deepEqual([x.remaining,y.remaining,x.shadow.selected,y.shadow.selected],[1,0,true,false]);
assert.deepEqual(x.shadow.evidence,y.shadow.evidence);
assert.ok(x.shadow.evidence.length>0);
assert.equal(x.observationRef,y.observationRef);
assert.ok(foreign?.foreignRejected);
assert.notEqual(foreign.foreign,b.ticket.id);
assert.equal(foreign.ticket.id,b.ticket.id);
assert.equal(foreign.packetDigest,b.packet);
assert.deepEqual(foreign.accepted,b.event);
const [p07,p07zero]=[affordable,exhausted].map(r=>r.rows[5]);
assert.deepEqual([p07.plan.strategy,p07zero.plan.strategy,p07.ticket.action,p07zero.ticket.action],['P07','P07','ACTION4','ACTION4']);
assert.equal(p07.packet,p07zero.packet);
assert.deepEqual([p07.event.matched,p07zero.event.matched],[true,true]);
const [cavity,cavityZero]=[as66,as66zero].map(r=>r.rows[5]);
assert.deepEqual(cavity.before,cavityZero.before);
assert.deepEqual([cavity.plan.family,cavityZero.plan.family,cavity.ticket.action,cavityZero.ticket.action],
  ['sliding_cavity','observed_frontier','ACTION1','ACTION2']);
assert.deepEqual([as66.rows.at(-1).levels,as66zero.rows.at(-1).levels],[2,1]);

const first=(left,right,m)=>(left.rows.findIndex((row,i)=>JSON.stringify(m(row))!==JSON.stringify(m(right.rows[i])))+1)||null;
const summarize=(left,right)=>({code:left.code,premierTicketDifférent:first(left,right,r=>r.ticket),
  premierPropriétaireDifférent:first(left,right,r=>r.plan?.family),
  premierPaquetDifférent:first(left,right,r=>r.packet),
  niveaux:[left.rows.at(-1).levels,right.rows.at(-1).levels],
  comparaisons:[left.comparisons.length,right.comparisons.length]});
const selected=s=>({ticket:s.ticket,plan:s.plan.id,propriétaire:s.plan.family,besoin:s.plan.need.kind,garde:s.guard.reason,
  reçu:{propriétaire:s.event.family,motif:s.event.reason,plan:s.event.sic_plan,ref:s.event.observation_ref,matched:s.event.matched},paquet:s.packet});
console.log(JSON.stringify({sha:'09b9a509e5e07894b9fccf170f22ae26cbeffbda',départs:6,gestes:96,contreReçu:foreign.foreignRejected,
  sansOptionEtUnIdentiques:true,sélection:{un:selected(a),zéro:selected(b)},comparaisons:[summarize(affordable,exhausted),summarize(as66,as66zero)]},null,2));
