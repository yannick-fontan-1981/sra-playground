import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import {control,offsets,preimages} from './enumerer.mjs';

const dir=process.argv[2],read=p=>JSON.parse(readFileSync(join(dir,p)));
const versions=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef'];
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sig=t=>[t.family,t.pre.kind,t.command,t.data,t.pre.expected,t.after.matched,t.after.reason];
const [gel,branch]=versions.map(sha=>Object.assign({},...['choix','historique','repères','réserve'].map(g=>{
  const file=read(sha.slice(0,8)+'.'+g+'.json');assert.equal(file.sha,sha);return file.results;
})));
const withoutOffers=t=>{const {offers,...rest}=t;return rest;};
const differences={};
for(const name of Object.keys(gel)){
  const a=gel[name],b=branch[name];assert.deepEqual(a.card,b.card);assert.equal(a.steps.length,b.steps.length);
  differences[name]=b.steps.findIndex((t,i)=>!equal(withoutOffers(t),withoutOffers(a.steps[i])))+1;
  assert.equal(differences[name],{'initial-bis':1,'canal-bis':7}[name]??0);
}
function verifyMove(t,next){
  const event=t.after.events.find(e=>e.kind.endsWith('phase_displacement'));
  assert.ok(event);assert.equal(event.before,t.pre.ref);assert.equal(event.after,t.after.ref);
  assert.deepEqual(event.command.data??{},t.data);assert.equal(event.command.action_ref,t.command);
  const before=t.pre.scene,after=next.pre.scene;assert.deepEqual(before.colors,after.colors);
  for(const [i,profile] of before.profiles.entries()){
    const possible=offsets(profile,after.profiles[i]),period=profile.length;
    assert.deepEqual(possible,[(-event.delta[i]+period)%period]);
  }
}
function point(t){return [t.data.x,t.data.y];}
const cases={};
for(const [v,rows] of [gel,branch].entries()){
  const at=(name,i)=>rows[name].steps[i-1],nominal=rows.nominal.steps;
  assert.equal(Object.keys(rows).length,12);
  for(const row of Object.values(rows)){
    assert.equal(row.card.budget,16);assert.equal(row.steps.length,row.card.gestes);
    for(const [i,t] of row.steps.entries()){
      assert.ok(t.guard);assert.equal(t.seal,digest(t.pre));
      if(i+1<row.steps.length)assert.equal(t.after.ref,row.steps[i+1].pre.ref);
    }
  }
  assert.deepEqual(nominal.map(t=>t.command),read('gel.json').turns.slice(0,16).map(t=>t.cmd));
  for(const nm of ['nominal','ordre-déclaré','initial-essayé','initial-bis','renommée']){
    const x=at(nm,1);assert.equal(x.pre.mode,'initial_control_question');assert.equal(x.pre.expected,null);
    assert.equal(x.command,['ordre-déclaré','initial-essayé'].includes(nm)||(nm==='initial-bis' && v)?'ACTION4':'ACTION3');
    verifyMove(x,at(nm,2));assert.equal(at(nm,2).pre.mode,'joint_phase_target');
  }
  const exhausted=rows['initiaux-épuisés'];assert.equal(exhausted.changes[0].offre,null);
  assert.equal(exhausted.steps[0].family,'information_goal');assert.deepEqual(point(exhausted.steps[0]),[29,3]);
  const t2=nominal[1],scene=t2.pre.scene,goals=preimages(scene.profiles,scene.detectors);
  assert.equal(scene.periods.reduce((p,n)=>p*n,1),64);assert.equal(goals.length,11);assert.equal(t2.pre.domain.target_refs.length,11);
  const projected=t2.pre.expected.profiles;
  const shifts=projected.map((p,i)=>offsets(scene.profiles[i],p));assert.ok(shifts.every(o=>o.length===1));
  assert.ok(goals.some(g=>g.every((n,i)=>n===shifts[i][0])));
  assert.equal(t2.pre.mode,'joint_phase_target');assert.equal(t2.after.reason,'official_boundary');assert.equal(t2.after.matched,null);
  const no=at('sans-loi',2);assert.deepEqual(no.pre.scene,t2.pre.scene);assert.equal(no.command,t2.command);
  assert.equal(no.pre.mode,'initial_control_question');assert.equal(no.pre.expected,null);assert.equal(rows['sans-loi'].changes[0].acquisition.ref,t2.pre.ref);
  const filtered=at('préimage',2);assert.equal(filtered.projection.removed,true);assert.equal(filtered.projection.retained,10);
  assert.deepEqual(point(filtered),[4,32]);assert.ok(filtered.after.events.some(e=>e.kind==='strip_focus_changed'&&e.after===filtered.after.ref));
  assert.equal(at('préimage',3).after.reason,'official_boundary');
  for(const nm of ['nominal','canal-essayé','canaux-épuisés','canal-bis','renommée','renommée-essayée']){
    const t=at(nm,7),n=at(nm,8);assert.equal(t.level,3);assert.equal(t.pre.mode,'channel_question');assert.equal(t.pre.expected,null);
    assert.equal(t.after.reason,'unknown_channel_response');verifyMove(t,n);
    if(nm==='canaux-épuisés'){assert.equal(t.command,'ACTION4');assert.equal(n.pre.mode,'joint_phase_target');continue;}
    const right=['canal-essayé','renommée-essayée'].includes(nm)||(nm==='canal-bis'&&v);
    assert.deepEqual(point(t),[right?57:48,3]);assert.equal(n.family,right?'public_occurrence_recall':'periodic_sums');
    if(right)assert.equal(at(nm,9).pre.mode,'joint_phase_target');
  }
  const rename=rows.renommée.card.couleurs;assert.equal(rename.length,2);
  for(const [i,t] of rows.renommée.steps.entries()){
    const o=nominal[i];assert.deepEqual([t.command,t.data,t.pre.mode,t.after.reason,t.after.completed],[o.command,o.data,o.pre.mode,o.after.reason,o.after.completed]);
    if(t.pre.scene)assert.deepEqual(t.pre.scene.colors.map(id=>rename.includes(id)?rename[1-rename.indexOf(id)]:id),o.pre.scene.colors);
  }
  const s=at('canal-bis',7),f=at('initial-bis',1);
  if(v){
    for(const [t,types] of [[f,['initial_input','initial_input']],[s,['collective_channel','collective_channel','individual_channel']]]){
      const options=t.offers[0];assert.deepEqual(options.map(o=>o.kind),types);
      assert.ok(options.every(o=>o.observationRef===t.pre.ref));
      assert.equal(options[1].command.action_ref,t.command);assert.deepEqual(options[1].command.data??{},t.data);
    }
  }else{assert.deepEqual(f.offers,[]);assert.deepEqual(s.offers,[]);}
  cases[versions[v]]={départs:12,tickets:Object.values(rows).reduce((n,r)=>n+r.steps.length,0),
    réserveT7:2,reprisesRéservées:2,questionsInitialesÉpuisées:exhausted.steps[0].family,
    ordreDéclaré:at('ordre-déclaré',1).command,substitutionInitiale:f.command,substitutionCanal:point(s),préimages:goals.length};
}
console.log(JSON.stringify({révisions:cases,premierÉcartEntreMoteurs:differences,contrôleFini:control()},null,2));
