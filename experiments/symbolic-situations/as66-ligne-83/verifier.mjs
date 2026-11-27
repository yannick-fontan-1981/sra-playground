import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2],engines=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','1aaafe36177ab73edf63c18f1a0950bd790a9c6c'];
const fixture=JSON.parse(gunzipSync(execFileSync('git',['show','1aaafe36:tests/fixtures/sic-cavity-direction-as66-public.json.gz'])));
function position(frame){
  let x=Infinity,y=Infinity,count=0;
  frame.forEach((row,j)=>row.forEach((p,i)=>{if(p===11){count++;x=Math.min(x,i);y=Math.min(y,j);}}));
  if(count!==16 || !frame.slice(y,y+4).every(r=>r.slice(x,x+4).every(p=>p===11)))return null;
  return [x,y];
}
function movement(before,after){
  const points=[before.frame,...after.frames].map(position).filter(Boolean);
  const vectors=points.slice(1).map(([x,y],i)=>[y-points[i][1],x-points[i][0]]);
  const local=vectors.filter(d=>Math.abs(d[0])+Math.abs(d[1])===4);
  const signs=new Set(local.map(d=>JSON.stringify(d.map(Math.sign))));
  assert.equal(signs.size,1);
  const [x,y]=position(before.frame),[xx,yy]=position(after.frame);
  return {sens:JSON.parse([...signs][0]),net:[yy-y,xx-x]};
}
const hashes={};
for(const sha of engines){
  function load(group){
    const o=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));
    assert.equal(o.sha,sha);const h=createHash('sha256').update(JSON.stringify(o.results)).digest('hex');
    if(hashes[group])assert.equal(h,hashes[group]);else hashes[group]=h;
    return o.results.map(r=>r.turns);
  }
  const [h,a]=load('parcours'),[body,cavity,fresh,stale]=load('développement'),[rf,rs]=load('réserve');
  assert.deepEqual(h.slice(0,5),a.slice(0,5));assert.equal(h.length,10);assert.equal(a.length,8);
  assert.deepEqual(h[5].liaison.prior_body_type,[8,4,4]);assert.deepEqual(h[5].corps,[11,4,4]);
  for(const k of ['current_component_ref','current_cavity_ref','current_surface_ref'])assert.ok(h[5].liaison[k]);
  const initial=h[5],visible=position(fixture.observations[5].frame);
  function attributable(claim){
    return claim.ref===initial.ticket.observationRef && claim.corps===initial.liaison.current_component_ref &&
      claim.position[0]===visible[0] && claim.position[1]===visible[1];
  }
  const claim={ref:initial.ticket.observationRef,corps:initial.liaison.current_component_ref,position:initial.position};
  assert.ok(attributable(claim));
  assert.ok(!attributable({...claim,corps:initial.liaison.current_cavity_ref}));
  assert.ok(!attributable({...claim,ref:h[4].ticket.observationRef}));
  assert.equal(h[5].memo.méthode,'observed_stop_then_oriented_cavity_access');
  for(const [i,arr,old,now] of [[5,h,fixture.observations[5],fixture.observations[6]],[6,h,fixture.observations[6],fixture.observations[7]],[5,a,fixture.observations[5],fixture.alternateReturns[0]]]){
    const d=arr[i],next=arr[i+1],o=d.offre.présentée,act=d.ticket.actionRef,m=movement(old,now);
    assert.ok(d.offre.garde && d.famille==='sliding_cavity' && d.kind==='cavity_direction_question' && d.besoin==='test_missing_control');
    assert.equal(act,o.commande);assert.equal(d.ticket.observationRef,o.ref);assert.deepEqual(o.position,position(old.frame));
    assert.ok(!d.memo.clés.includes(o.clé) && next.memo.clés.includes(o.clé));assert.ok(!(act in d.memo.directions));
    assert.equal(next.reçu.ticket,d.ticket.id);assert.equal(next.reçu.matched,null);
    assert.deepEqual(next.memo.événements,[{before:o.ref,after:next.reçu.ref,local_delta:m.net}]);
    assert.deepEqual(next.memo.directions[act],m.sens);assert.notDeepEqual(m.net.map(Math.sign),m.sens);
    assert.deepEqual(next.position,position(now.frame));
  }
  assert.deepEqual([h[5],h[6],a[5]].map(r=>r.ticket.actionRef),['ACTION1','ACTION4','ACTION4']);
  assert.deepEqual(a[5].offre.fraîche,h[5].offre.présentée);assert.deepEqual(a[5].offre.présentée.preuves,h[5].offre.présentée.preuves);
  for(const [arr,i,cmd] of [[h,7,'ACTION1'],[a,6,'ACTION2']]){
    const d=arr[i];assert.deepEqual([d.kind,d.famille,d.ticket.actionRef,d.besoin,d.ticket.observationRef,d.reçu.ref],[ 'sliding_cavity_access','sliding_cavity',cmd,undefined,d.reçu.ref,d.reçu.ref]);
    assert.equal(arr[i+1].reçu.matched,true);assert.equal(arr[i+1].reçu.ticket,d.ticket.id);
  }
  for(const variant of [body,cavity]){const d=variant[5];assert.equal(d.famille,'observed_frontier');assert.equal(d.kind,'experiment');assert.equal(d.offre,null);}
  for(const [x,y] of [[fresh,stale],[rf,rs]]){
    assert.deepEqual(x.slice(0,6),y.slice(0,6));const first=x[5],good=x[6],bad=y[6];
    assert.equal(first.ticket.frameHash,good.ticket.frameHash);assert.notEqual(first.ticket.observationRef,good.ticket.observationRef);
    assert.deepEqual(bad.offre.fraîche,good.offre.présentée);assert.deepEqual({...bad.offre.présentée,ref:good.ticket.observationRef},good.offre.présentée);
    assert.equal(bad.offre.présentée.ref,first.ticket.observationRef);
    assert.ok(good.offre.garde && bad.offre.garde);assert.equal(good.ticket.actionRef,'ACTION4');assert.ok(!bad.ticket);
    assert.ok(good.memo.clés.includes(first.offre.présentée.clé));assert.equal(bad.raison,'composition_target_stale_proposal');
  }
  assert.equal(Math.abs(rf[5].position[0]-fresh[5].position[0]),1);
  assert.notEqual(rf[5].ticket.frameHash,fresh[5].ticket.frameHash);
}
console.log(JSON.stringify({révisions:engines,départsParRévision:8,parcours:2,construitsDéveloppement:4,construitsRéserve:2,empreintes:hashes},null,2));
