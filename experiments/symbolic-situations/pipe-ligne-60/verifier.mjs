import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const folder=process.argv[2];
const shas=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','aa75791a365b1ab6edcfa6a464654c6432cb3b46'];
const sizes={nominal:16,stationnaire:2,autrePièce:2,sansMéthode:3,preuveÉtrangère:4,extérieur:15};
const data={};
for(const [arm,length] of Object.entries(sizes)){
  const [gel,candidat]=shas.map(sha=>{
    const {sha:found,...result}=JSON.parse(readFileSync(join(folder,sha.slice(0,8)+'.'+arm+'.json'),'utf8'));
    assert.equal(found,sha);
    assert.equal(result.arm,arm);
    assert.equal(result.steps.length,length);
    return result;
  });
  assert.deepEqual(gel,candidat);
  data[arm]=gel;
}
const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
const rotate=(ports,k)=>ports.map(v=>(v+k)%4);
const edgeList=(state,n)=>state.flatMap((ports,i)=>ports.flatMap(k=>{
  if(k!==1&&k!==2)return [];
  const [dx,dy]=dirs[k],x=i%n+dx,y=Math.floor(i/n)+dy;
  if(x>=n||y>=n)return [];
  const j=x+n*y;
  return state[j].includes((k+2)%4)?[[i,j]]:[];
}));
function layouts(initial){
  const n=Math.sqrt(initial.length);
  assert.equal(n,3);
  const results=[],poses=[],state=[];
  function visit(i){
    if(i===initial.length){
      const edges=edgeList(state,n);
      const seen=new Set([0]);
      for(let count=0;count<state.length;count++){
        for(const [a,b] of edges)if(seen.has(a)||seen.has(b)){seen.add(a);seen.add(b);}
      }
      if(seen.size===state.length&&edges.length===state.length-1)
        results.push({poses:[...poses],edges,clockwise:poses.reduce((c,d)=>c+d,0),
          unknownSense:poses.reduce((c,d)=>c+Math.min(d,4-d),0)});
      return;
    }
    const x=i%n,y=Math.floor(i/n);
    for(let k=0;k<4;k++){
      const ports=rotate(initial[i],k);
      if(ports.includes(0)!==(y>0&&state[i-n].includes(2)))continue;
      if(ports.includes(3)!==(x>0&&state[i-1].includes(1)))continue;
      if(x===n-1&&ports.includes(1)||y===n-1&&ports.includes(2))continue;
      poses[i]=k;state[i]=ports;visit(i+1);
    }
  }
  visit(0);
  return results;
}

const n=data.nominal.steps,first=n[0],second=n[1],m=first.after.record;
assert.equal(n.filter(s=>s.pre.kind==='radial_port_composition').length,16);
assert.equal(first.pre.bundle,'OP18');
assert.equal(first.pre.plan.reason,'initial_radial_interface_experiment');
assert.equal(first.pre.plan.portsAfter,null);
assert.equal(first.pre.plan.length,1);
assert.deepEqual(first.pre.command,['ACTION6',{x:16,y:28}]);
assert.deepEqual(m.before.joins,[[0,1],[1,2],[3,4],[4,5]]);
assert.equal(m.before.open.length,8);
assert.deepEqual([m.changed,m.gained,m.lost,m.selected.index],[[3],[[3,6]],[],3]);
assert.deepEqual(m.event.rule.evidence,[first.pre.ref,first.after.ref]);
assert.equal(m.event.rule.turn,1);
assert.equal(first.after.matched,null);
assert.equal(first.after.seal,true);
const feasible=layouts(first.pre.plan.portsBefore);
assert.ok(feasible.length>0);
const min=Math.min(...feasible.map(f=>f.clockwise));
const minAny=Math.min(...feasible.map(f=>f.unknownSense));
assert.equal(min,4);
assert.equal(minAny,4);
const chosen=feasible.find(f=>f.poses.toString()==='0,0,0,1,0,1,1,0,1');
assert.ok(chosen);
assert.equal(chosen.edges.length,8);
assert.equal(chosen.clockwise,min);

for(const name of ['stationnaire','autrePièce']){
  const other=data[name].steps[0],r=other.after.record;
  assert.equal(other.after.packet,first.after.packet);
  assert.equal(r.event.rule,null);
  assert.equal(r.event.refuted,true);
  assert.equal(other.after.matched,null);
  assert.equal(data[name].steps[1].pre.guard.admitted,true);
}
assert.deepEqual(data.stationnaire.steps[0].after.record.changed,[]);
const {alternative:wrong,steps:changed}=data.autrePièce;
assert.equal(wrong.from,first.pre.cut.raster);
assert.notEqual(wrong.cell,first.pre.plan.cell);
assert.deepEqual(changed[0].after.record.changed,[wrong.cell]);
assert.equal(changed[0].after.record.selected.index,wrong.cell);
assert.notDeepEqual(changed[0].after.record.gained,m.gained);

const blind=data.sansMéthode.steps[1];
assert.equal(blind.pre.cut.raster,second.pre.cut.raster);
assert.deepEqual(blind.pre.command,second.pre.command);
assert.deepEqual(blind.pre.cut.change.removed,m.event.rule.evidence);
assert.equal(blind.pre.cut.used.method,null);
assert.deepEqual([second.pre.plan.length,blind.pre.plan.length],[3,1]);
assert.equal(blind.pre.plan.revalidated,false);
assert.equal(blind.pre.plan.portsAfter,null);
assert.equal(blind.after.packet,second.after.packet);
assert.equal(blind.after.matched,null);
assert.equal(second.after.matched,true);
assert.deepEqual(blind.after.record.event.rule,second.after.record.event.rule);

const older=data.preuveÉtrangère.steps[3];
assert.deepEqual(older.pre.cut.change.foreign,m.event.rule.evidence);
assert.notDeepEqual(older.pre.cut.change.foreign,older.pre.cut.change.authentic);
assert.equal(older.pre.cut.used.method.epoch,older.pre.cut.before.method.epoch);
assert.equal(older.pre.cut.used.method.geometry_ref,older.pre.cut.before.method.geometry_ref);
assert.deepEqual(older.pre.command,n[3].pre.command);
assert.deepEqual(older.pre.plan,n[3].pre.plan);
assert.equal(older.after.packet,n[3].after.packet);

assert.equal(n[4].pre.plan.reason,'test_point_binding_of_recalled_rotation');
assert.equal(n[5].pre.plan.length,7);
assert.equal(n[12].pre.plan.reason,'test_point_binding_of_recalled_rotation');
assert.deepEqual(n.filter((s,i)=>s.after.levels>(n[i-1]?.after.levels??0)).map(s=>s.i),[4,12]);
const [step14,step15]=n.slice(13);
const [other14,other15]=data.extérieur.steps.slice(13);
assert.deepEqual([step14.after.matched,step14.after.seal],[true,false]);
assert.deepEqual([other14.after.matched,other14.after.seal],[true,true]);
assert.equal(other14.after.reason,'ports_matched_extra_pixels_unexplained');
assert.equal(other14.after.packet,step14.after.packet);
assert.notEqual(other14.after.presented,other14.after.physical);
assert.deepEqual(step15.pre.plan.portsBefore,other15.pre.plan.portsBefore);
assert.deepEqual(step15.pre.command,other15.pre.command);
assert.deepEqual([step15.pre.index,step15.pre.plan.length,other15.pre.index,other15.pre.plan.length],[1,3,0,2]);
assert.equal(other15.after.packet,step15.after.packet);
assert.equal(other15.after.matched,true);
console.log(JSON.stringify({stats:{versions:2,départsParVersion:Object.keys(sizes).length,
  gestesServiceParVersion:Object.values(sizes).reduce((a,b)=>a+b,0),gestesAuxiliairesParVersion:1,
  catalogue:16,niveauxTerminés:2},coût:{minQuartsSensHoraire:min,minSansSensAcquis:minAny,
    affectationsConnectéesAcycliques:feasible.length,exemple:chosen},
  premierRaccord:m.gained,réemploi:{tour:15,commande:step15.pre.command,nominal:1,recalculé:0}},null,2));
