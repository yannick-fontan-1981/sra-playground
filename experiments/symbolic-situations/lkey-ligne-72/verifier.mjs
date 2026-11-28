import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'d67284e820e8d1987da055096732fc257c679f3f'};
function paired(dir,lengths){
  return Object.fromEntries(Object.entries(lengths).map(([arm,length])=>{
    const read=version=>{
      const {sha:actual,...r}=JSON.parse(readFileSync(join(dir,version+'.'+arm+'.json'),'utf8'));
      assert.equal(actual,sha[version]);
      assert.equal(r.arm,arm);
      assert.equal(r.steps.length,length);
      return r;
    };
    const gel=read('gel');
    assert.deepEqual(read('candidat'),gel,arm);
    return [arm,gel];
  }));
}
const t=(r,i)=>r.steps[i-1];const lengths={nominal:16,'sans-relation':12,'sans-mode':12,'ordre-inverse':12};
const arms=paired(destination,lengths);
const {nominal}=arms;
const owner='public_ranked_workshop';
const stage=['adjacent_exchange_probe','prepared_receiver_trial','release_after_acceptance',
  'free_focus_to_next_prepared_receiver','reacquire_mode_at_prepared_receiver','prepared_receiver_trial'];
const result=(r,i)=>t(r,i).after.record;
const action=(r,i)=>t(r,i).pre.command;
const refRevision=ref=>Number(ref.match(/:revision:(\d+):/)[1]);
const currentMode=result(nominal,10);
assert.equal(currentMode.result.status,'mode_marker_contrast');
assert.deepEqual(currentMode.mode.map(r=>r.observed_change),[[0,1]]);
assert.equal(t(nominal,11).pre.plan.neighbor,1);
assert.deepEqual(t(nominal,11).pre.plan.evidence.map(refRevision),[11,10]);
assert.deepEqual(nominal.steps.slice(10).map(s=>s.pre.plan.stage),stage);
for(const s of nominal.steps.slice(10)){
  assert.equal(s.pre.family,owner);
  assert.equal(s.pre.guard.admitted,true);
  assert.equal(s.pre.plan.extension,null);
  assert.equal(s.after.matched,null);
}
const exchange=result(nominal,11).effect;
assert.equal(exchange.slot_delta,-1);
assert.equal(exchange.held_before,true);
assert.equal(exchange.changes.marker_moved,true);
assert.equal(exchange.changes.profile_geometry_changed,true);
assert.equal(result(nominal,12).effect.changes.receiver_changed,true);
assert.deepEqual(result(nominal,13).mode.map(r=>r.observed_change),[[1,0]]);
assert.deepEqual(result(nominal,15).mode.map(r=>r.observed_change),[[0,1]]);
assert.equal(result(nominal,14).effect.slot_delta,1);
assert.equal(result(nominal,16).result.status,'official_boundary');
assert.equal(t(nominal,16).after.levels,1);
const inverse=arms['ordre-inverse'];
for(const i of [10,11,12]){
  assert.deepEqual(action(inverse,i),action(nominal,i));
  assert.equal(t(inverse,i).after.packet,t(nominal,i).after.packet);
}
assert.equal(t(inverse,11).pre.family,owner);
assert.equal(result(inverse,11).effect.slot_delta,-1);
for(const r of [arms['sans-relation'],arms['sans-mode']]){
  assert.equal(t(r,11).pre.ref,t(nominal,11).pre.ref);
  assert.deepEqual(t(r,10).after,t(nominal,10).after);
  assert.equal(t(r,11).pre.family,'public_framed_transfer');
  assert.equal(t(r,11).pre.guard.admitted,true);
  assert.deepEqual(action(r,11),['ACTION6',{x:47,y:18}]);
  assert.equal(t(r,11).after.physical,t(r,10).after.physical);
  assert.equal(t(r,11).after.levels,0);
  assert.equal(result(r,11),null);
  assert.deepEqual(action(r,12),action(nominal,11));
  assert.equal(t(r,12).pre.family,owner);
  assert.equal(t(r,12).after.packet,t(nominal,11).after.packet);
  assert.equal(result(r,12).effect.slot_delta,-1);
  assert.deepEqual(r.next.command,action(nominal,12));
}
assert.equal(arms['sans-relation'].cuts[0].neighborShown,0);
assert.equal(arms['sans-mode'].cuts[0].prior.length,1);
console.log(JSON.stringify({sha,stats:{departsParSha:4,gestesParSha:52,occurrencesCatalogue:6,extensionsPortablesConsommees:0},
  contrasteT10:currentMode.mode.map(r=>r.observed_change),tour11:{commande:action(nominal,11),revisions:[11,10],delta:exchange.slot_delta},
  retrait:{commande:action(arms['sans-mode'],11),effetGeometrique:0,reprise:action(arms['sans-mode'],12),suite:arms['sans-mode'].next.command},
  gainsNominaux:1},null,2));
