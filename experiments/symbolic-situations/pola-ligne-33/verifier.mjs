import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d'};
const arms=['nominal','sans-attestation','axe-perpendiculaire','stationnaire','sans-methode','stationnaire-n2'];
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
const c=cases[0],n=c.nominal.steps;
const axis=m=>m.bodies.find(x=>JSON.stringify(x.center)===JSON.stringify(m.selected)).axis;
const turn=(a,b)=>a[1]*b[0]-a[0]*b[1];
const p=(rows,i)=>rows[i-1].pre,r=(rows,i)=>rows[i-1].after;
const command=x=>[x,{}];
const rotation=ret=>turn(axis(ret.record.input),axis(ret.record.compared));
for(const run of Object.values(c))for(let i=0;i<run.steps.length-1;i++)assert.equal(run.steps[i].after.ref,run.steps[i+1].pre.ref);
const t4=p(n,4),cut=t4.cut.pre,after4=r(n,4);
assert.deepEqual([p(n,3).family,p(n,3).command,r(n,3).record.result.events],['observed_frontier',command('ACTION5'),['selection_marker_changed_under_input']]);
assert.deepEqual([t4.family,t4.kind,t4.command,t4.bundle,t4.plan.root],
  ['public_axial_question','public_axial_question',command('ACTION4'),'OP18','G_official_completion']);
assert.deepEqual([cut.usedGeometry.selected,axis(cut.usedGeometry),cut.usedGeometry.target.center,cut.offers[1].peer,cut.offers[1].peerAxis],
  [[21,25],[-1,0],[26,25],[41,25],[0,1]]);
assert.deepEqual(cut.offers.map(o=>[o.action,o.distance,o.turn,o.method?.method??null]),[['ACTION3',3,-1,null],['ACTION4',1,1,null]]);
assert.deepEqual(t4.scope,{live:{admitted:true,reason:'selected_marker_body_peer_target_and_command_current'},
  old:{admitted:false,reason:'scope_changed'}});
assert.deepEqual([after4.frames,after4.levels,after4.matched,after4.seal,rotation(after4),
  after4.record.result.native_packet_attribution.accepted_frame_ordinals],[5,1,null,true,1,[0]]);
assert.deepEqual([axis(after4.record.input),axis(after4.record.compared)], [[-1,0],[0,1]]);
const effect=after4.record.result.events.find(x=>typeof x==='object');
assert.deepEqual(effect.joint_positions_after,effect.joint_positions_before);
assert.equal(effect.sealed_score_delta,1);

for(const arm of ['sans-attestation','axe-perpendiculaire']){
  const branch=c[arm].steps,probe=p(branch,4).cut.pre;
  assert.deepEqual(branch.slice(0,3),n.slice(0,3));
  assert.deepEqual([probe.observation,probe.input,probe.actions,probe.offers],[cut.observation,cut.input,cut.actions,[]]);
  assert.deepEqual([p(branch,4).family,p(branch,4).command],['observed_frontier',['ACTION6',{x:11,y:10}]]);
  if(arm==='sans-attestation')assert.equal(probe.selection,null);
  else{
    assert.notEqual(probe.usedRows,cut.usedRows);
    assert.deepEqual(probe.usedGeometry.selected,cut.usedGeometry.selected);
    assert.deepEqual(probe.usedGeometry.target,cut.usedGeometry.target);
  }
}
const nominal=t4.cut.pre.selection;
assert.ok(nominal.evidence?.includes(r(n,3).ref)||nominal.current_evidence?.includes(r(n,3).ref));

const t8=p(n,8),after8=r(n,8),lost=c['sans-methode'].steps,off=p(lost,8),alt8=r(lost,8);
assert.deepEqual(lost.slice(0,7),n.slice(0,7));
assert.deepEqual([off.ref,off.cut.pre.usedRows,off.cut.pre.selection,off.cut.pre.usedGeometry],
  [t8.ref,t8.cut.pre.usedRows,t8.cut.pre.selection,t8.cut.pre.usedGeometry]);
assert.deepEqual([off.cut.pre.portable,t8.cut.pre.portable.length], [[],1]);
const method=t8.plan.offer.method.method;
assert.deepEqual([method.action,method.turn,method.source_epoch,method.boundary,method.evidence.slice(0,2)],
  ['ACTION4',1,1,true,[t4.ref,after4.ref]]);
assert.deepEqual(t8.cut.pre.offers.map(o=>o.distance),[2,2]);
assert.deepEqual(off.cut.pre.offers.map(o=>o.distance),[2,2]);
assert.deepEqual([t8.command,off.command,rotation(after8),rotation(alt8),after8.levels,alt8.levels],
  [command('ACTION4'),command('ACTION3'),1,-1,1,1]);
assert.notEqual(after8.packet,alt8.packet);
assert.deepEqual([after8.record.rotations[0].turn,alt8.record.rotations[0].turn],[1,-1]);
assert.deepEqual([r(n,9).levels,r(lost,9).levels,r(n,9).matched,r(lost,9).matched],[2,2,null,null]);

for(const [arm,i] of [['stationnaire',4],['stationnaire-n2',8]]){
  const stationary=c[arm],rows=stationary.steps,real=r(n,i),served=r(rows,i);
  assert.deepEqual(rows.slice(0,i-1),n.slice(0,i-1));
  assert.deepEqual(p(rows,i),p(n,i));assert.equal(served.packet,real.packet);
  assert.equal(served.presented,r(n,i-1).presented);
  assert.deepEqual([served.record.rotations.length,rotation(served),served.levels,stationary.next.command],
    [0,0,r(n,i-1).levels,command('ACTION3')]);
}

const contrast=read('gel','contraste');
assert.deepEqual(contrast,read('candidat','contraste'));
assert.deepEqual([contrast.fixture,contrast.first.action,contrast.first.turn,contrast.conditional.matched,
  contrast.retained.action,contrast.retained.turn,contrast.retained.method.turn,contrast.withheld.action,contrast.withheld.method],
  ['kernelCold','ACTION4',1,null,'ACTION4',-1,-1,'ACTION3',null]);
assert.ok(contrast.returned.events.includes('quarter_rotation_observed'));
const rank=contrast.rankings;
assert.deepEqual(rank.original,[...rank.reversed].reverse());
assert.deepEqual([rank.original[rank.originalIndex],rank.reversed[rank.reversedIndex],rank.chosen],Array(3).fill('ACTION4'));
assert.notEqual(rank.originalIndex,rank.reversedIndex);

const count=n.filter(x=>x.pre.family==='public_axial_question').length;
assert.equal(count,6);
const stats=Object.entries(shas).map(([engine,sha],i)=>({engine,sha,départs:arms.length,gestes:Object.values(cases[i]).reduce((n,r)=>n+r.steps.length,0),contrasteConstruit:1}));
console.log(JSON.stringify({stats,moteur:tree(shas.gel),occurrencesCatalogue:count,N1:{sens:rotation(after4),trames:after4.frames,attribuées:[0],score:after4.levels},
  N2:{avecRappel:[t8.command[0],rotation(after8)],sansRappel:[off.command[0],rotation(alt8)],scoreAuT9:2},
  contraste:{directionDuRetour:contrast.retained.turn,classementInvariant:true}},null,2));
