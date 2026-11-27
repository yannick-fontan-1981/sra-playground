import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {situations} from './situations.mjs';
import {withEngine} from './montage.mjs';
const [sha,receipt,selection]=process.argv.slice(2);
let seed=null;
if(selection){
  const b=readFileSync(selection);
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(b).digest('hex')));
  seed=Buffer.from(JSON.parse(b).seed,'hex');
}
const cards=situations(seed),out={};
await withEngine(sha,async({root,lab})=>{
  const {prepareFixture}=await import(pathToFileURL(join(lab,'ouverture-98/fiche.mjs')));
  const play=await prepareFixture(root);
  for(const [k,card] of Object.entries(cards))out[k]=await play(card,'active');
  out.retrait=await play({...cards.nouvelle,points:cards.nouvelle.points.slice(0,-1)},'active');
  out.shadow=await play(cards.nouvelle,'shadow');
});
function scores(d,card){
  return card.clics.map(([x,y])=>d.slate.pre.eligible.find(v=>v.command.data.x===x && v.command.data.y===y)?.target?.count);
}
function oracle(card){
  return card.clics.map(([x,y])=>{
    const neighbors=new Set();
    for(const [px,py,c] of card.points){
      const dx=px-x,dy=py-y;
      if(dx===0 && dy!==0 && Math.abs(dy)<=8)neighbors.add('v'+Math.sign(dy)+'/'+c);
      if(dy===0 && dx!==0 && Math.abs(dx)<=8)neighbors.add('h'+Math.sign(dx)+'/'+c);
    }
    return neighbors.size;
  });
}
for(const [k,d] of Object.entries(out)){
  const card=cards[k]??(k==='shadow'?cards.nouvelle:cards.égalité);
  assert.deepEqual(scores(d,card),oracle(card));
  assert.ok(d.guard.admitted && d.slate.pre.eligible.length===3 && d.slate.pre.offered.length===3);
  const best=d.slate.pre.eligible.find(q=>q.target.count===Math.max(...oracle(card)));
  assert.deepEqual(d.opening.command,best.command);
  if(k==='shadow'){assert.ok(!d.opening.selected);assert.deepEqual(d.command,d.opening.baseline);}
  else{assert.ok(d.opening.selected);assert.deepEqual(d.command,best.command);assert.equal(d.question.id,best.ref);}
}
assert.deepEqual(out.égalité,out.retrait);
assert.deepEqual(out.doublon.command,out.égalité.command);
assert.notDeepEqual(out.nouvelle.command,out.égalité.command);
assert.deepEqual(oracle(cards.égalité),[2,2,1]);assert.deepEqual(oracle(cards.nouvelle),[2,3,1]);
const faux=[2,3,1];assert.notDeepEqual(faux,scores(out.doublon,cards.doublon));
writeFileSync(receipt,JSON.stringify({sha,out})+'\n',{flag:'wx'});
console.log('5 lectures validées. Reçu qui double une relation rejeté.');
