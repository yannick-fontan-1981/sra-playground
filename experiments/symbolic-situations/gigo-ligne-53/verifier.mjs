import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','b2eef22648f3a511bed0783d938013bae8673a8a'];
const tree=sha=>execFileSync('git',['rev-parse',sha+':src'],{encoding:'utf8'}).trim();
assert.equal(tree(shas[0]),tree(shas[1]));
const cases=shas.map(sha=>Object.assign({},...['nominal','contrôles'].map(group=>{
  const a=JSON.parse(readFileSync(join(dir,sha.slice(0,8)+'.'+group+'.json'),'utf8'));
  assert.equal(a.sha,sha);assert.equal(a.group,group);return a.cases;
})));
assert.deepEqual(cases[0],cases[1]);
const c=cases[0],g=c.GIGO.rows,v=c.VALV.rows;
const t=(rows,i)=>rows[i-1].ticket,r=(rows,i)=>rows[i].ret;
assert.deepEqual(Object.values(c).map(x=>x.rows.length-1),[1,11,1,1,1,1]);
for(const {rows} of Object.values(c))for(let i=1;i<rows.length;i++){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.id,q.owner,q.admitted],[b.ticket,b.owner,true]);
  if(t(rows,i+1))assert.equal(t(rows,i+1).ref,b.ref);
}
function field(rows,i,kind,x,y){
  const q=t(rows,i),b=r(rows,i);
  assert.deepEqual([q.owner,q.entry,q.kind,q.action,q.data,q.guard,q.expected,q.predicted],
    ['public_occurrence_recall','field_service_composition',kind,'ACTION6',{x,y},'current_nested_core_exact_point','unknown',null]);
  assert.deepEqual([b.matched,b.seal,b.reason],[null,true,'unknown_control_response_observed']);
  const current=b.events.filter(e=>e.evidence?.at(-1)===b.ref),first=current[0];
  assert.deepEqual([first.kind,first.evidence,first.total,first.local,first.distant],
    ['nested_control_response',[q.ref,b.ref],b.servi.total,b.servi.près,b.servi.loin]);
  return current;
}
assert.deepEqual(c.GIGO.offers,[{ref:t(g,1).ref,matches:[{bbox:[24,18,29,23],point:[26,20],core:16,area:36}],point:[26,20]}]);
const exact={admitted:true,reason:'current_nested_core_exact_point'},wrong={admitted:false,reason:'nested_context_or_payload_changed'};
assert.deepEqual(c.GIGO.guards,[{actual:exact,other:wrong}]);
assert.deepEqual([t(g,1).selected.bbox,t(g,1).selected.core_area,t(g,1).selected.core_palette,t(g,1).alts],[[24,18,29,23],16,5,[]]);
const main=field(g,1,'nested_control_experiment',26,20);
const p=r(g,1).servi;
assert.deepEqual([main.length,main[0].official,main[0].same,g[1].score,g[1].stop],
  [1,false,true,0,'nested_control_effect_requires_composition']);
assert.equal(t(g,2),null);
assert.deepEqual([p.total,p.près,p.loin,p.local,p.distant],[420,20,400,{'15→0':20},{'0→9':316,'15→0':84}]);

const tie=c.exAequo;
assert.deepEqual(tie.offers[0].matches.map(x=>[x.point,x.area]),[[[4,4],36],[[26,20],36]]);
assert.equal(tie.offers[0].point,null);
assert.deepEqual([t(tie.rows,1).owner,t(tie.rows,1).kind,t(tie.rows,1).action],['observed_frontier','experiment','ACTION1']);
for(const [key,near,far] of [['stationnaire',0,0],['local',20,0],['distant',0,400]]){
  const {rows}=c[key],ret=r(rows,1),record=field(rows,1,'nested_control_experiment',26,20);
  assert.deepEqual(t(rows,1),t(g,1));assert.deepEqual([ret.original,ret.paquet],[p,r(g,1).paquet]);
  assert.deepEqual([ret.servi.près,ret.servi.loin,record.length],[near,far,1]);
  if(key==='stationnaire'){
    const a=record[0];
    assert.deepEqual([a.disposition,a.selection,a.impossible,a.frame,t(rows,2).owner,t(rows,2).action],
      ['local_no_visible_effect',false,false,t(g,1).frame,'observed_frontier','ACTION1']);
  }else{
    assert.equal(t(rows,2),null);assert.equal(rows[1].stop,g[1].stop);
  }
}
assert.deepEqual(c.VALV.guards,[{actual:exact,other:wrong}]);
assert.deepEqual(c.VALV.offers[0].matches.map(x=>x.area).sort((a,b)=>a-b),[25,81]);
assert.deepEqual(c.VALV.offers[0].point,[32,50]);
const val=field(v,1,'nested_control_experiment',32,50),fill=val[1],measured=r(v,1).servi;
assert.deepEqual([measured.total,measured.près,measured.loin,fill.kind,fill.count,fill.phase,fill.contextRefs],
  [72,0,72,'envelope_fill_context',3,'repeat',[t(v,1).ref,r(v,1).ref]]);
assert.ok(t(v,2).evidence.includes(t(v,1).ref));
assert.ok(t(v,2).evidence.includes(r(v,1).ref));
assert.deepEqual([2,5,11].map(i=>t(v,i).phase),['repeat','isolate','revalidate_source_access']);
assert.deepEqual(field(v,2,'envelope_fill_experiment',32,50).map(x=>x.kind),['nested_control_response','envelope_fill_context']);
assert.deepEqual(field(v,5,'field_service_experiment',50,33).map(x=>x.kind),['nested_control_response','field_service_context','field_service_transfer']);
assert.deepEqual(field(v,11,'field_service_transfer_experiment',11,35).map(x=>x.kind),['nested_control_response','field_service_transfer']);
assert.deepEqual([v[10].niveau,v[10].score,t(v,12).phase],[2,1,'revalidate_conditional_service']);
const stats=shas.map(sha=>{
  const report=readFileSync(join(dir,sha.slice(0,8)+'.auteur.txt'),'utf8');
  assert.match(report,/pass 4\b/);assert.match(report,/fail 0/);
  return {sha,départs:Object.keys(c).length,gestes:Object.values(c).reduce((n,x)=>n+x.rows.length-1,0),testsAuteur:4};
});
console.log(JSON.stringify({stats,moteur:tree(shas[0]),occurrences53:{rejouées:2,catalogue:6},GIGO:{pixels:p,arrêt:g[1].stop},
  retoursConstruits:['stationnaire','local','distant'].map(x=>[x,r(c[x].rows,1).servi.total,c[x].rows[1].stop??t(c[x].rows,2).owner]),
  VALV:{gestes:v.length-1,pixels:measured,champs:fill.count,reprise:t(v,2).kind}},null,2));
