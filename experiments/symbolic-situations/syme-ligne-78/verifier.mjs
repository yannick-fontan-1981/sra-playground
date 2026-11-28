import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const [destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'85194a499e1b81c4c26e418efbd171bf469d00d1'};
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
const t=(r,i)=>r.steps[i-1];
const lengths={nominal:16,'autre-reference':0,'autre-reference-jouee':1,'retour-contraire':1,ambigu:0,'contraste-clair':0};
const all=paired(destination,lengths);
const {nominal,ambigu}=all;
const aux=paired(join(destination,'inventaire'),{inventaire:0,'temoin-etroit':0,ambigu:0,'contraste-clair':0});
const [alt,joue,contraire,clair]=['autre-reference','autre-reference-jouee','retour-contraire','contraste-clair'].map(x=>all[x]);
const fis=r=>r.cuts[0].pre;
const raster=fis(aux.inventaire).sample[0];
let paires=0,contrastes=0;
for(const line of raster){
  for(let x=0;x<Math.floor(line.length/2);x++){
    const [left,right]=[line[x],line[line.length-x-1]];
    if(left===right)paires++;
    else if((left===11)!==(right===11))contrastes++;
    else assert.fail('Paire de miroir inexpliquée');
  }
}
assert.deepEqual([paires,contrastes],[27,9]);
assert.deepEqual(fis(aux['temoin-etroit']).sample[0].flatMap((row,y)=>row.flatMap((v,x)=>v===raster[y][x]?[]:[[x,y]])),[[4,4]]);
const locallyScope=r=>{
  const [hyp]=fis(r).hypotheses;
  return hyp?.constraints.find(q=>q.cell[0]===5&&q.cell[1]===33)?.expected;
};
assert.deepEqual(locallyScope(aux['temoin-etroit']),[9]);
const n=t(nominal,1),j=t(joue,1),b=t(contraire,1);
assert.deepEqual(n.pre.command,alt.next.command);
assert.deepEqual(n.pre.command,j.pre.command);
assert.deepEqual(n.pre.command,aux['temoin-etroit'].next.command);
assert.deepEqual(n.pre.plan.cell.sources,[[53,33]]);
assert.deepEqual([n.pre.plan.cell.equal,j.pre.plan.cell.equal],[[9],[8]]);
assert.equal(n.pre.plan.predicted,false);
assert.equal(j.pre.plan.predicted,false);
assert.equal(n.after.packet,j.after.packet);
assert.equal(n.after.packet,b.after.packet);
assert.equal(n.after.record.result.after,9);
assert.equal(n.after.record.result.satisfies_frozen_constraint,true);
assert.equal(j.after.physical,j.after.presented);
assert.equal(j.after.record.result.status,'no_unique_local_rewrite');
assert.equal(b.after.record.result.satisfies_frozen_constraint,false);
assert.equal(b.after.record.result.counterexample_retained,true);
assert.equal(contraire.next.family,'information_goal');
function permissible(grid){
  const cells=[[0,0],[2,0],[0,2],[2,2]];
  const class00=cells.map(([x,y])=>grid[y][x]);
  const values=[...new Set(class00)];
  return values.map(v=>cells.flatMap(([x,y],i)=>class00[i]===v?[]:[{point:[12+10*x,12+10*y],to:v}]))
    .filter(changes=>changes.length>0&&changes.length<=2);
}
const options=permissible(fis(aux.ambigu).sample[0]);
assert.equal(options.length,2);
assert.ok(options[0].every(a=>options[1].every(b=>a.point.join()!==b.point.join())));
const expected=fis(ambigu).hypotheses.map(h=>h.constraints.filter(x=>x.expected.length).map(x=>({point:x.cell,to:x.expected[0]})));
assert.deepEqual([...options].reverse(),expected);
const unique=permissible(fis(aux['contraste-clair']).sample[0]).filter(x=>x.length===1);
assert.deepEqual(unique,[[{point:[12,12],to:9}]]);
assert.equal(fis(ambigu).hypotheses.length,2);
assert.equal(ambigu.cuts[0].local,null);
assert.deepEqual(ambigu.next.command,clair.next.command);
assert.deepEqual([ambigu.next.family,clair.next.family],['observed_frontier','regular_field_correspondence']);
assert.equal(t(nominal,9).after.levels,1);
console.log(JSON.stringify({sha,stats:{departsParSha:8,gestesParSha:18,recapturesSansGesteParSha:2},paires,contrastes,
  source:[53,33],clic:n.pre.command,valeurs:[9,8],valeurPhysique:9,retourSourceSubstitue:j.after.record.result.status,
  retourContraire:{valeur:b.after.record.result.after,contreExemple:true,suite:contraire.next.family},
  reparations:{options,intersection:[],unique},gainNominal:9},null,2));
