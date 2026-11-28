import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'77df94e33aa8bae8ecc7f81c8b57e062943dffa6'};
const sizes={nominal:16,long:20,stationnaire:1,'decoration-contradictoire':10,
  'finale-t4':4,'bornes-t4':4,'finale-t18':18,'ordre-t18':18};
const runs={};
for(const [name,steps] of Object.entries(sizes)){
  const [gel,candidate]=Object.entries(versions).map(([v,sha])=>{
    const {sha:found,...data}=JSON.parse(readFileSync(join(dir,v+'.'+name+'.json'),'utf8'));
    assert.equal(found,sha);
    assert.equal(data.steps.length,steps);
    return data;
  });
  assert.deepEqual(gel,candidate);
  runs[name]=gel;
}
const nominal=runs.nominal.steps;
const applied=(arm,t)=>runs[arm].steps[t-1].after;
const before=(arm,t)=>runs[arm].steps[t-1]?.pre??runs[arm].next;
const front=(a,t)=>applied(a,t).record.packet;
const one=applied('nominal',1);
assert.deepEqual(one.record.affected.map(([,points])=>points),[[30,24]]);
assert.equal(one.record.step.selection_witness.kind,'single_cochanged_support');
assert.deepEqual([one.record.step.before_ref,one.record.step.after_ref],[before('nominal',1).ref,one.ref]);
const stationary=applied('stationnaire',1);
assert.equal(stationary.packet,one.packet);
assert.deepEqual(stationary.record.affected,[]);
assert.deepEqual(Object.values(stationary.record.state.bindings),[]);
assert.equal(before('stationnaire',2).family,'observed_frontier');
assert.deepEqual(before('stationnaire',2).command,['ACTION3',{}]);

const four=applied('nominal',4),packet=front('nominal',4);
assert.equal(packet.count,16);
assert.equal(packet.detail.canonicalSame,true);
assert.equal(packet.detail.segments.length,2);
assert.deepEqual(packet.detail.received.map(a=>a.frame_interval),[[8,13]]);
assert.equal(packet.detail.received[0].body_ref,one.record.affected[0][0]);
assert.deepEqual([packet.detail.before,packet.detail.after],[before('nominal',4).ref,four.ref]);
assert.equal(packet.detail.received[0].evidence,packet.detail.before);
assert.equal(packet.memory.launch,'ACTION5');
assert.deepEqual(before('nominal',5).command,['ACTION3',{}]);
assert.ok(before('nominal',5).refs.includes(four.ref));
for(const [arm,count] of [['finale-t4',1],['bornes-t4',2]]){
  const a=applied(arm,4),p=front(arm,4),decision=before(arm,5);
  assert.deepEqual(before(arm,4),before('nominal',4));
  assert.deepEqual([a.packet,a.presented],[four.packet,four.presented]);
  assert.equal(p.count,count);
  assert.equal(p.accepted,false);
  assert.equal(p.memory.launch,null);
  assert.equal(decision.family,'observed_frontier');
  assert.deepEqual(decision.command,['ACTION6',{x:10,y:61}]);
}

const ten=applied('nominal',10),unbound=applied('decoration-contradictoire',10);
assert.equal(ten.packet,unbound.packet);
assert.notEqual(ten.presented,unbound.presented);
assert.deepEqual(ten.record.affected,unbound.record.affected);
const supports=ten.record.affected;
assert.deepEqual(supports.map(([,point])=>point),[[18,28],[44,28]]);
assert.equal(ten.record.step.selection_witness.kind,'reciprocal_center_decoration_replacement');
assert.equal(unbound.record.step.selection_witness.kind,'cochange_without_reciprocal_decoration');
assert.equal(unbound.record.step.binding_status,'unknown_or_ambiguous');
assert.deepEqual(before('nominal',11).command,['ACTION5',{}]);
assert.deepEqual(before('decoration-contradictoire',11).command,['ACTION6',{x:43,y:52}]);

const full=applied('long',18),comparison=front('long',18).detail.comparison;
assert.equal(front('long',18).count,25);
assert.deepEqual(front('long',18).detail.received.map(a=>[a.body_ref,a.frame_interval]),
  [[supports[0][0],[5,9]],[supports[1][0],[12,15]]]);
assert.equal(comparison.comparison,'matched_observed_front_prefix');
assert.equal(comparison.official_progress,true);
assert.deepEqual([full.levels,full.matched],[2,null]);
const final=applied('finale-t18',18);
assert.deepEqual([final.packet,final.presented,final.levels,final.matched],[full.packet,full.presented,2,null]);
assert.equal(front('finale-t18',18).accepted,false);
assert.deepEqual(before('finale-t18',19).command,before('long',19).command);

const reversed=applied('ordre-t18',18),inverted=front('ordre-t18',18);
assert.deepEqual([reversed.packet,reversed.presented,reversed.levels,reversed.matched],[full.packet,full.presented,2,null]);
assert.equal(inverted.count,25);
const temporal=[...inverted.detail.received].sort((a,b)=>a.frame_interval[0]-b.frame_interval[0]);
assert.deepEqual(temporal.map(a=>a.body_ref),supports.map(x=>x[0]).reverse());
assert.notEqual(inverted.detail.comparison.comparison,comparison.comparison);
assert.deepEqual(before('ordre-t18',19).command,before('long',19).command);
assert.ok(nominal.every(x=>x.after.matched===null&&x.after.seal===true));

console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(sizes).length,
  gestesParVersion:Object.values(sizes).reduce((a,b)=>a+b,0),catalogue:16,
  paquetsCanoniquesRéduitsParVersion:3,ordrePermutéParVersion:1},premierLien:one.record.affected,
  T4:{front:packet.detail.received[0].frame_interval,avant:packet.detail.before,après:packet.detail.after},
  T18:{officiel:full.levels,nominal:comparison.comparison,inversé:inverted.detail.comparison.comparison,
    intervalleInversé:temporal.map(a=>a.frame_interval)}},null,2));
