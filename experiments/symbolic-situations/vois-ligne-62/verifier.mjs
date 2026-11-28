import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.argv[2];
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'1391bd741ad11addfce68370db8969cd3d37b6b0'};
const arms={nominal:16,'reference-retiree':1,'reference-deplacee':1,'pion-retire':1,stationnaire:2,'reference-changee':6};
const results={};
for(const [arm,gestures] of Object.entries(arms)){
  const [gel,candidate]=Object.entries(shas).map(([v,expected])=>{
    const {sha,...contents}=JSON.parse(readFileSync(join(dir,v+'.'+arm+'.json'),'utf8'));
    assert.equal(sha,expected);assert.equal(contents.arm,arm);assert.equal(contents.steps.length,gestures);
    return contents;
  });
  assert.deepEqual(gel,candidate);
  results[arm]=gel;
}
const n=results.nominal.steps,bodies=s=>s.bodies.map(b=>b.cell),goals=s=>s.target.map(t=>t.slice(0,2));
const first=n[0],second=n[1],six=n[5],firstScene=first.pre.cut.pre.scene;
assert.equal(n.filter(x=>x.pre.kind==='reference_population').length,16);
assert.deepEqual(bodies(firstScene),[[5,3],[5,10]]);
assert.deepEqual(goals(firstScene),[[5,6],[5,7]]);
assert.deepEqual(first.pre.command,['ACTION6',{x:15,y:23}]);
assert.equal(first.pre.plan.complete,false);
assert.deepEqual(first.after.record.event.pending,[5,3]);
assert.deepEqual(first.after.record.event.controls,{});
const relocated=results['reference-deplacee'].steps[0],newScene=relocated.pre.cut.pre.scene;
assert.deepEqual(newScene.bodies,firstScene.bodies);
assert.deepEqual(goals(newScene),[[5,7],[6,6]]);
assert.deepEqual(relocated.pre.command,['ACTION6',{x:43,y:23}]);
assert.deepEqual(results['reference-deplacee'].change,{from:[55,55],to:[55,59],color:8});
const missingGoal=results['reference-retiree'],missingPawn=results['pion-retire'];
const measured=missingGoal.cuts[0].pre;
assert.equal(measured.scene,null);
assert.deepEqual(bodies(measured.surplus),bodies(firstScene));
assert.deepEqual(goals(measured.surplus),[[5,6]]);
assert.equal(missingPawn.cuts[0].pre.scene,null);
assert.deepEqual(missingPawn.change.body,[5,10]);
assert.deepEqual(missingPawn.change.target,goals(firstScene));
for(const run of [missingGoal,missingPawn]){
  assert.equal(run.steps[0].pre.family,'animated_contact');
  assert.notEqual(run.steps[0].pre.kind,'reference_population');
  assert.equal(run.steps[0].pre.guard.admitted,true);
}
assert.equal(missingPawn.steps[0].after.packet,missingGoal.steps[0].after.packet);

assert.deepEqual(bodies(second.after.record.current),[[4,3],[5,10]]);
assert.equal(second.after.record.event.detail.V5_physical_step_matches,true);
assert.equal(second.after.record.event.detail.before,second.pre.ref);
assert.equal(second.after.record.event.detail.after,second.after.ref);
const held=results.stationnaire.steps[1];
assert.equal(held.after.packet,second.after.packet);
assert.deepEqual(bodies(held.after.record.current),bodies(firstScene));
assert.deepEqual(Object.keys(held.after.record.event.controls),[]);
assert.equal(six.pre.plan.complete,true);
const proofs=six.pre.cut.pre.domains;
assert.deepEqual(proofs.map(x=>x.reachable.map(r=>r.steps)),[[3,4],[4,3]]);
const at3=proofs.map(d=>[d.cell,d.reachable.filter(r=>r.steps<=3).map(r=>r.goal)]);
assert.deepEqual(at3,[[[5,3],[[5,6]]],[[5,10],[[5,7]]]]);
assert.deepEqual(six.pre.plan.expected,[[5,4],[5,5],[5,6]]);
assert.ok(n.slice(5,8).every((r,i)=>r.pre.index===i&&r.after.matched===true));
assert.deepEqual(bodies(n[7].after.record.current),[[5,6],[5,10]]);
const changed=results['reference-changee'];
assert.deepEqual(changed.steps.at(-1).pre,six.pre);
assert.equal(changed.steps.at(-1).after.packet,six.after.packet);
assert.deepEqual([changed.steps.at(-1).after.matched,changed.steps.at(-1).after.seal],[false,true]);
assert.equal(changed.cuts.at(-1).local.reason,'current_reference_population_revalidation_missing');
assert.equal(changed.next,null);
assert.equal(n[13].after.levels,1);
assert.equal(n[13].after.matched,null);
assert.equal(n[14].pre.cut.pre.scene.bodies.length,4);
assert.equal(n[14].pre.cut.pre.scene.target.length,4);
assert.equal(Object.keys(n[14].pre.cut.pre.controls).length,4);
assert.ok(n[15].after.record.event.detail.V5_physical_step_matches);
assert.deepEqual(bodies(n[15].after.record.current),[[2,5],[2,9],[6,9],[7,5]]);
console.log(JSON.stringify({stats:{versions:2,départsParVersion:6,
  gestesParVersion:Object.values(arms).reduce((s,n)=>s+n,0),catalogue:16,niveauxTerminés:1},
  appariement:at3,carréDéplacé:results['reference-deplacee'].change,pionRetiré:missingPawn.change,
  limite:changed.cuts.at(-1).local.reason},null,2));
