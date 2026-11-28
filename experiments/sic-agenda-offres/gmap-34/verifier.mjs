import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {publicContrast} from './contraste.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'gmap-34-')),out=join(tmp,'prefixe.json');
const variants=['nominal','sans-repere','stationnaire','sans-localisation','sans-permission'];
const guard={admitted:true,reason:'current_anchor_or_scoped_transition_hypothesis_and_route_revalidated'};
const edge=(from,to,delta,annotation)=>({from,to,delta,annotation});
const anchor=[23,28],east=[29,28],dep=[29,22],gate=[35,28],goal=[41,28];
const input=(a,b)=>assert.deepEqual([a.observation,a.epoch,a.actions,a.input],[b.observation,b.epoch,b.actions,b.input]);

function ticket(step,kind,action,route){
  const p=step.pre;
  assert.deepEqual([p.family,p.kind,p.slot,p.bundle,p.command,p.guard,p.plan.root],
    ['public_chart_navigation','public_chart_navigation','chart_navigation','OP18',[action,{}],guard,'G_official_completion']);
  assert.deepEqual(p.scope,{live:guard,old:{admitted:false,reason:'scope_changed'}});
  assert.deepEqual(p.plan.offer,p.cut.pre.offers[p.plan.policy.choice.index]);
  assert.equal(p.plan.offer.kind,kind);
  assert.deepEqual(p.plan.offer.route,route);
  assert.equal(p.plan.policy.choice.release_authority,false);
  assert.deepEqual([step.after.matched,step.after.seal],[null,true]);
}

async function replay(engine,mode){
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}

try{
  const h=await withEngine('historique',engine=>replay(engine,'nominal'));
  const g=await withEngine('gel',async engine=>{
    const runs={};
    for(const mode of variants)runs[mode]=await replay(engine,mode);
    return runs;
  });
  const fixture=await withEngine('gel',publicContrast);
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[a,b,c,d,e,f]=n,cut=a.pre.cut.pre;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.ok(n.every(x=>x.pre.slot==='chart_navigation'));
  const chart=cut.decoded;
  assert.deepEqual([chart.current,chart.origin,chart.pitch,chart.goal,chart.nodes.length,chart.slots.length],[anchor,anchor,6,11,6,3]);
  const origin=chart.nodes.find(n=>n.point.toString()===anchor.toString());
  assert.deepEqual([origin.corner,origin.edge,origin.middle,origin.inside],[0,3,0,11]);
  assert.deepEqual(chart.nodes.filter(n=>n.inside===chart.goal).map(n=>n.point),[anchor,goal]);
  assert.ok(chart.links.some(e=>e.annotation===10&&e.from.toString()===east.toString()&&e.to.toString()===gate.toString()));
  assert.deepEqual(cut.held,[]);
  assert.equal(cut.offers.length,1);
  assert.deepEqual([cut.offers[0].target,cut.offers[0].annotation],[dep,10]);
  const first=edge(anchor,east,[1,0],13),second=edge(east,dep,[0,-1],13);
  ticket(a,'annotation_dependency','ACTION4',[first,second]);
  const q=a.after.record;
  assert.deepEqual([q.owned,q.sceneChanged,q.oldHeld,q.newHeld],[true,true,[],[]]);
  assert.deepEqual([q.result.events,q.result.position,q.result.location_alternatives,q.result.position_status,q.result.actual_score_delta],
    [['scene_change_after_direction'],east,[east],'conditional_arrival_scene_changed_not_unique_world_proof',0]);
  assert.deepEqual(q.result.evidence,[a.pre.ref,a.after.ref]);
  assert.ok(b.pre.refs.includes(a.after.ref));
  assert.deepEqual(b.pre.cut.pre.incoming.positions,[east]);
  assert.equal(b.pre.cut.pre.measured,null);
  ticket(b,'annotation_dependency','ACTION1',[second]);
  const gained=b.after.record.result.events[1].peripheral_value_gained;
  assert.deepEqual([gained.value,gained.current_occurrence],[10,dep]);
  const south=edge(dep,east,[0,1],13),middle=edge(east,gate,[1,0],10),last=edge(gate,goal,[1,0],13);
  ticket(c,'homologous_marker','ACTION2',[south,middle,last]);
  assert.deepEqual(c.pre.plan.offer.held,[10]);
  assert.deepEqual(c.pre.plan.offer.target,goal);
  const observed=c.after.record.result;
  assert.equal(observed.events[1].peripheral_value_lost,10);
  const grant=observed.events[2].inventory_loss_and_local_boundary_change;
  assert.deepEqual([grant.from,grant.to,grant.value,grant.status],[east,gate,10,'local_permission_hypothesis_not_confirmed_transaction']);
  assert.deepEqual(grant.evidence,[a.after.ref,c.pre.ref,c.after.ref]);
  ticket(d,'homologous_marker','ACTION4',[middle,last]);
  assert.deepEqual(d.pre.plan.offer.held,[]);
  assert.deepEqual(d.pre.cut.pre.state.grants,[grant]);
  assert.deepEqual(d.after.record.result.location_alternatives,[east,gate]);
  assert.deepEqual(d.after.record.result.events,['scene_equal_retains_stay_and_arrival_alternatives']);
  ticket(e,'homologous_marker','ACTION4',[middle,last]);
  assert.deepEqual(e.pre.plan.offer.alternatives,[[middle,last],[last]]);
  assert.equal(e.after.levels,1);
  assert.equal(e.after.record.result.status,'official_boundary_return');
  assert.equal(e.after.record.result.new_epoch_pixels_not_old_scope_evidence,true);
  assert.deepEqual([f.pre.level,f.pre.plan.offer.target,f.pre.plan.offer.distance],[2,[32,19],4]);
  assert.deepEqual(f.pre.cut.pre.incoming.positions,[]);
  assert.equal(f.pre.cut.pre.state.portable.at(-1).source_epoch,1);

  const lost=g['sans-repere'].steps[0],lc=lost.pre.cut.pre;
  input(cut,lc);
  assert.deepEqual(lc.measured,chart);
  assert.deepEqual(lc.changed,[[21,26],[25,26],[21,30],[25,30]]);
  assert.equal(lc.decoded,null);
  assert.deepEqual(lc.offers,[]);
  assert.deepEqual([lost.pre.family,lost.pre.command],['observed_frontier',['ACTION1',{}]]);

  const s=g.stationnaire.steps[0],sq=s.after.record;
  assert.deepEqual(s.pre,a.pre);
  assert.equal(s.after.packet,a.after.packet);
  assert.notEqual(s.after.physical,s.after.presented);
  assert.deepEqual([sq.sceneChanged,sq.oldHeld,sq.newHeld,sq.result.position],[false,[],[],null]);
  assert.deepEqual(sq.result.events,['scene_equal_retains_stay_and_arrival_alternatives']);
  assert.deepEqual(sq.result.location_alternatives,[anchor,east]);

  const unknown=g['sans-localisation'].steps[1],uc=unknown.pre.cut.pre,bc=b.pre.cut.pre;
  assert.deepEqual(g['sans-localisation'].steps[0],a);
  input(bc,uc);
  assert.deepEqual(uc.decoded,bc.decoded);
  assert.deepEqual(uc.incoming,bc.incoming);
  assert.deepEqual(uc.held,bc.held);
  assert.deepEqual(uc.state.positions,[anchor,east]);
  assert.deepEqual(uc.offers,[]);
  assert.deepEqual([unknown.pre.family,unknown.pre.command],['observed_frontier',b.pre.command]);

  const denied=g['sans-permission'].steps[3],dc=denied.pre.cut.pre,mc=d.pre.cut.pre;
  assert.deepEqual(g['sans-permission'].steps.slice(0,3),n.slice(0,3));
  input(mc,dc);
  assert.deepEqual(dc.decoded,mc.decoded);
  assert.deepEqual(dc.incoming,mc.incoming);
  assert.deepEqual(dc.held,mc.held);
  assert.deepEqual(dc.state,{...mc.state,grants:[]});
  assert.deepEqual(dc.offers,[]);
  assert.deepEqual([denied.pre.family,denied.pre.command],['observed_frontier',['ACTION3',{}]]);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:6,
    native:g,contraste:fixture},null,2)+'\n');
  console.log('GMAP 34 · six préfixes natifs et contraste public. Repère, localisation, possession et accès vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
