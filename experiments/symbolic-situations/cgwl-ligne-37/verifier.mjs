import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'beb11112bc53afdb80d46b843f42d01474254126'};
const arms=['nominal','sans-corps','sans-correspondance','sans-deplacement','stationnaire','sans-attache','stationnaire-attache'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
assert.equal(tree(shas.gel),tree(shas.candidat));
const read=(engine,arm)=>JSON.parse(readFileSync(join(dir,engine+'.'+arm+'.json'),'utf8'));
const cases=Object.keys(shas).map(engine=>Object.fromEntries(arms.map(arm=>{
  const {sha,arm:name,...r}=read(engine,arm);
  assert.deepEqual([sha,name],[shas[engine],arm]);
  for(const cut of [...r.steps.map(x=>x.pre.cut),r.next?.cut].filter(Boolean))assert.equal(hash(cut.pre),cut.seal);
  return [arm,r];
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],n=c.nominal.steps,p=(x,i)=>x[i-1].pre,r=(x,i)=>x[i-1].after;
const command=x=>[x,{}];
const core=r(n,1).record.state.core;
assert.deepEqual([p(n,1).family,p(n,1).command,core.palette_value,core.area,core.evidence],
  ['observed_frontier',command('ACTION1'),15,32,[p(n,1).ref,r(n,1).ref]]);
assert.deepEqual(r(n,1).record.state.moves.ACTION1.delta,[0,-4]);
const t2=p(n,2),q=t2.plan.offer,found=r(n,2).record.state.moves.ACTION2;
assert.deepEqual([t2.family,t2.slot,t2.command,q.kind,q.target.center,q.target.frame.center,t2.plan.expected],
  ['public_observed_binding','observed_object_binding',command('ACTION2'),'probe_control_for_correspondence',[12,44],[52,44],null]);
assert.deepEqual(t2.cut.pre.measured.offers.map(o=>[o.actions[0].action_ref,o.distance]),
  ['ACTION2','ACTION3','ACTION4','ACTION5','ACTION7'].map(x=>[x,36]));
assert.deepEqual([t2.scope.live.admitted,t2.scope.old.admitted,r(n,2).matched,r(n,2).record.state.held,r(n,2).record.state.interaction,
  found.delta,found.evidence],[true,false,null,null,null,[0,4],[t2.ref,r(n,2).ref]]);
assert.equal(p(n,3).plan.offer.kind,'approach_correspondence');
for(let i=3;i<=8;i++)assert.deepEqual([p(n,i).command,r(n,i).matched],[command('ACTION2'),true]);
for(const arm of ['sans-corps','sans-correspondance']){
  const x=c[arm].steps,k=p(x,2);
  assert.deepEqual(x.slice(0,1),n.slice(0,1));
  assert.deepEqual([k.ref,k.cut.pre.input,k.family,k.command],[t2.ref,t2.cut.pre.input,'observed_frontier',command('ACTION1')]);
}
assert.equal(p(c['sans-corps'].steps,2).cut.pre.measured?.tracker.core??null,null);
const filtered=p(c['sans-correspondance'].steps,2).cut.pre.measured;
assert.deepEqual([filtered.before.length,filtered.removed.length,filtered.offers],[5,5,[]]);
const noMove=c['sans-deplacement'].steps;
assert.deepEqual(noMove.slice(0,2),n.slice(0,2));
assert.deepEqual([p(noMove,3).command,p(noMove,3).plan.offer.kind],[command('ACTION3'),'probe_control_for_correspondence']);

const t12=p(n,12),a12=r(n,12).record,attached=a12.state.held,identity=attached.identity_binding;
assert.deepEqual([t12.command,t12.plan.offer.kind,a12.result.status,attached.original_bbox,attached.bbox,attached.evidence],
  [command('ACTION5'),'probe_unknown_contact_control','local_attachment_hypothesis',[9,41,14,47],[8,35,14,41],[t12.ref,r(n,12).ref]]);
assert.deepEqual([identity.status,identity.scope,identity.alternatives.length,
  identity.alternatives[0].translation,identity.alternatives[0].matching_visible_foreground.length,identity.alternatives[0].unobservable_points],
  ['visible_shape_compatible_under_bounded_translation','visible_part_only_occluded_part_unknown',1,[-1,-6],20,21]);
assert.equal(new Set(identity.alternatives[0].matching_visible_foreground.map(x=>x.join())).size,20);
assert.deepEqual(a12.result.alternatives,['attachment','remote_relocation_then_independent_object']);
const t13=p(n,13);
assert.deepEqual([t13.command,t13.plan.offer.kind,r(n,13).matched],[command('ACTION4'),'approach_reception',true]);
assert.ok(attached.evidence.every(ref=>t13.plan.offer.evidence.includes(ref)));
const noAttachment=c['sans-attache'].steps,non=p(noAttachment,13);
assert.deepEqual(noAttachment.slice(0,12),n.slice(0,12));
assert.deepEqual([non.ref,non.cut.pre.input,non.cut.pre.measured.tracker.held,non.cut.pre.measured.tracker.interaction,
  non.command,non.plan.offer.kind,r(noAttachment,13).record.result.status],
  [t13.ref,t13.cut.pre.input,null,t13.cut.pre.measured.tracker.interaction,command('ACTION5'),'probe_observed_binding','interaction_no_observed_identity_effect']);
assert.deepEqual([r(n,14).matched,r(n,14).seal,r(n,14).record.result.status,p(n,15).index,r(n,16).levels],
  [false,true,'object_remains_locally_bound_after_motion',0,0]);
for(const [arm,i,next] of [['stationnaire',2,'ACTION3'],['stationnaire-attache',12,'ACTION7']]){
  const fixture=c[arm],changed=r(fixture.steps,i);
  assert.deepEqual(fixture.steps.slice(0,i-1),n.slice(0,i-1));
  assert.deepEqual(p(fixture.steps,i),p(n,i));
  assert.deepEqual([changed.packet,changed.presented,changed.record.result.status,changed.record.state.held,fixture.next.command],
    [r(n,i).packet,r(n,i-1).presented,'interaction_no_observed_identity_effect',null,command(next)]);
}

const reports=Object.keys(shas).map(engine=>{
  const {sha,cases}=read(engine,'contraste');assert.equal(sha,shas[engine]);return cases;
});
assert.deepEqual(reports[0],reports[1]);
const {positive,refutation,ambiguity}=reports[0];
assert.deepEqual([positive.retours,refutation.retours,ambiguity.retours],[24,24,9]);
assert.deepEqual([positive.dernier,refutation.dernier,positive.prochain,refutation.prochain],
  [{action_ref:'ACTION3'},{action_ref:'ACTION3'},{action_ref:'ACTION3'},{action_ref:'ACTION4'}]);
assert.deepEqual([positive.own,refutation.own,ambiguity.own],['achieved','pending','pending']);
assert.ok(positive.reception.includes('reception_confirmed_by_separation'));
assert.ok(refutation.reception.includes('reception_refuted_object_moves_with_body'));
assert.ok(ambiguity.proof.some(x=>x.ambiguities?.includes(2)));
assert.equal(ambiguity.identity,null);
const count=n.filter(x=>x.pre.family==='public_observed_binding').length;
assert.equal(count,15);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0),scénariosConstruits:3}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),occurrences:count,
  déplacementT2:found.delta,attacheT12:{translation:identity.alternatives[0].translation,visibles:20,occlus:21},
  commandeT13:{nominale:t13.command[0],sansAttache:non.command[0]},score:r(n,16).levels,retoursConstruits:57},null,2));
