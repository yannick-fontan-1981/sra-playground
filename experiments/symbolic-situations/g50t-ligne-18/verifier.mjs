import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual as eq} from 'node:util';
const dir=process.argv[2],shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd'];
const fixture=JSON.parse(gunzipSync(execFileSync('git',['show','ada97e9c:tests/fixtures/sic-linked-contact-g50t-public.json.gz'])));
const sig={},observed={};
function read(sha,group){
  const p=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json')));assert.equal(p.sha,sha);
  if(group!=='retrait'){
    const h=createHash('sha256').update(JSON.stringify(p.results)).digest('hex');
    if(sha===shas[0])sig[group]=h;else assert.equal(h,sig[group],group);
  }return p.results;
}
function valid(event,step,ret,pixels){
  return !!event && eq(event.pixels,pixels) && eq(event.site,step.site) && eq(event.from,step.from) &&
    event.action===step.ticket.actionRef && event.before_ref===step.ticket.observationRef && event.after_ref===ret.ref &&
    event.exclusive_cause_established===false;
}
for(const sha of shas){
  const t=read(sha,'historique')[0].turns;assert.equal(t.length,11);
  const steps=t.slice(2,8),posts=t.flatMap(d=>d.events),bindings=steps.slice(0,3),access=steps.slice(3);
  assert.ok(bindings.every(d=>d.family==='linked_temporal_preparation' && d.guard && d.kind==='linked_contact_experiment' && d.mode==='binding' && d.to===null && d.missing==='test_missing_control'));
  assert.deepEqual(bindings.map(d=>d.ticket.actionRef),['ACTION1','ACTION3','ACTION4']);
  for(let i=2;i<8;i++){const d=t[i],r=t[i+1].ret;assert.ok(r.ticket===d.ticket.id && r.matched===(i<5?null:true));}
  assert.deepEqual(access.map(d=>d.ticket.actionIndex),[0,1,2]);
  assert.ok(access.every(d=>d.guard && d.ticket.actionRef==='ACTION4' && d.mode==='access' && !d.missing));
  const poseFor=i=>posts.find(e=>e.after===t[i+1].ret.ref);
  assert.deepEqual([2,3,4,5,6,7].map(i=>poseFor(i).pose),[[14,8],[14,8],[20,8],[26,8],[32,8],[38,8]]);
  assert.deepEqual(new Map(poseFor(2).vectors).get('ACTION1'),[0,-6]);assert.ok(!new Map(poseFor(3).vectors).has('ACTION3'));
  assert.deepEqual(new Map(poseFor(4).vectors).get('ACTION4'),[6,0]);
  assert.ok(!poseFor(5).comparison.length && !poseFor(6).comparison.length);
  const d=t[7],a=fixture.observations[7].frame,b=fixture.observations[8].frame;
  const changes=d.support.flatMap(([x,y])=>a[y][x]===b[y][x]?[]:[[x,y,a[y][x],b[y][x]]]);
  assert.equal(changes.length,23);assert.ok(valid(poseFor(7).comparison[0],d,t[8].ret,changes));
  assert.equal(t[8].mode,'binding');assert.ok(t[8].evidence.includes(t[8].ret.ref));
  const coords={};
  for(const group of ['dev','res']){
    const rows=read(sha,group);
    assert.equal(rows.length,group==='dev'?4:2);
    for(const r of rows){
      const x=r.turns[8],last=x.events.find(e=>e.after===x.ret.ref);
      assert.deepEqual(r.turns.slice(0,8),t.slice(0,8));assert.equal(x.ret.ticket,d.ticket.id);
      if(r.variant==='stationnaire'){assert.deepEqual(last.pose,d.from);assert.equal(last.comparison.length,0);assert.equal(x.ret.matched,false);continue;}
      assert.deepEqual(last.pose,d.site);assert.equal(x.ret.matched,true);assert.equal(last.comparison.length,1);
      const inside=r.change && d.support.some(([px,py])=>px===r.change[0] && py===r.change[1]);
      if(r.change){const [px,py,old,to]=r.change;assert.equal(a[py][px],old);assert.notEqual(old,to);}
      const expected=inside?[r.change]:[];
      assert.equal(expected.length,Number(r.variant==='distant'));assert.ok(valid(last.comparison[0],d,x.ret,expected));
      if(r.change)(coords[r.variant]??=[]).push(r.change.slice(0,2));
      if(r.variant==='extérieur'){
        assert.ok(!valid({...last.comparison[0],pixels:[r.change]},d,x.ret,expected));
        assert.ok(!valid({...last.comparison[0],exclusive_cause_established:true},d,x.ret,expected));
      }
    }
  }
  assert.ok(Object.values(coords).every(pair=>pair.length===2 && !eq(pair[0],pair[1])));
  const measured=read(sha,'mesurée')[0].turns,spent=read(sha,'épuisée')[0].turns;
  for(const prefix of [measured,spent]){assert.deepEqual(prefix.slice(0,2),t.slice(0,2));assert.equal(prefix[2].ticket.observationRef,t[2].ticket.observationRef);}
  assert.deepEqual(measured[2].trajet,spent[2].trajet);assert.deepEqual(measured[2].trajet.site,t[2].site);
  assert.equal(measured[2].mode,'access');assert.equal(measured[2].ticket.actionRef,t[2].ticket.actionRef);
  assert.deepEqual(measured[2].to,measured[2].trajet.pas[1]);assert.notEqual(spent[2].family,t[2].family);
  if(sha===shas[1]){
    const off=read(sha,'retrait')[0].turns;assert.deepEqual(off.slice(0,2),t.slice(0,2));assert.ok(off[2].retiré && off[2].family!==t[2].family);
    observed.retrait={famille:off[2].family,commande:off[2].ticket.actionRef};
  }
}
console.log(JSON.stringify({révisions:shas,cas:{historique:1,retoursConstruits:6,interventionsPreuveT3:2},
  pixelsDistantsHistoriques:23,contreÉpreuves:observed,empreintes:sig},null,2));
