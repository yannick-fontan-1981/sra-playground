import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { development,game } from './situations.mjs';
import { evaluate } from './criteres.mjs';

const [receipt,selection]=process.argv.slice(2),raw=readFileSync(receipt),packet=JSON.parse(raw);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let specs=development;
if(selection){const bytes=readFileSync(selection);
  assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8').includes(hash(bytes)));
  specs=JSON.parse(bytes).situations;
}
let pairs=0,fakes=0,oneMover=0;
for(let start=0;start<specs.length;start+=2){
  const pair=specs.slice(start,start+2);
  const steady=pair.find(s=>s.change==='identique'), altered=pair.find(s=>s!==steady);
  const fixed=game(steady), other=game(altered);
  const rows=s=>packet.results.find(r=>r.id===s.id).turns;
  const a=rows(steady),b=rows(altered);
  assert.deepEqual(fixed.initial,other.initial); assert.deepEqual(fixed.budgets,other.budgets);
  let previous=fixed.initial;
  for(let i=0;i<steady.step;i++) {
    assert.deepEqual(a[i],b[i]);
    const left=fixed.advance(i,a[i].command),right=other.advance(i,b[i].command);
    assert.ok(left && right);
    if(i+1<steady.step) assert.deepEqual(left,right);
    else {
      const {frame,frames,...metadata}=right;
      assert.deepEqual(left,{...metadata,frame:left.frame,frames:left.frames});
      assert.deepEqual(left.frame,previous.frame);
      assert.deepEqual(frames,[frame]);
      const colors=new Set();
      for(let y=0;y<frame.length;y++)for(let x=0;x<frame[y].length;x++){
        if(left.frame[y][x]!==frame[y][x]) {colors.add(left.frame[y][x]);colors.add(frame[y][x]);}
      }
      assert.ok(colors.size>1);
      const movers=[9,12].filter(n=>colors.has(n));
      assert.equal(movers.length,({ouverture:0,passage:2,partiel:1})[altered.change]);
      if(altered.change==='partiel'){
        assert.deepEqual(movers,[altered.band]);
        assert.deepEqual([...colors].sort((x,y)=>x-y),[3,altered.band]);
        const count=f=>f.flat().filter(c=>c===altered.band).length;
        assert.equal(count(frame),count(left.frame));
        oneMover++;
      }
    }
    previous=left;
  }
  function reject(spec,trace,mutate,reason){
    assert.ok(evaluate(spec,trace).ok);
    const changed=structuredClone(trace);mutate(changed);
    assert.ok(evaluate(spec,changed).ecarts.includes(reason),reason);
    fakes++;
  }
  reject(steady,a,t=>{t[13].view=t[12].view;t[13].command=t[12].command;},
    'aucune troisième confirmation avec le même dossier');
  reject(steady,a,t=>{t[13].event.receipt.objective=t[11].view.objective;},
    'répétition consommée, reçu lié au nouveau plan et à la nouvelle révision');
  reject(steady,a,t=>{t[13].event.from=t[12].event.from;},
    'répétition consommée, reçu lié au nouveau plan et à la nouvelle révision');
  if(altered.step===12) reject(altered,b,t=>{t[12].view=a[12].view;t[12].command=a[12].command;},
    'ancien ticket sans confirmation lorsque le témoin ne correspond plus');
  else reject(altered,b,t=>{t[13].event.block=a[13].event.block;},'la pose modifiée lève la question de blocage');
  pairs++;
}
console.log(JSON.stringify({paires:pairs,fauxReçusRejetes:fakes,paireUnPorteur:oneMover,sha256:hash(raw)}));
