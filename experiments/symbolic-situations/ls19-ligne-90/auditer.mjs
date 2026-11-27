import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { build,development } from './fixture.mjs';
import { check,expected } from './criteres.mjs';

const [file,selection]=process.argv.slice(2),bytes=readFileSync(file),packet=JSON.parse(bytes);
const pairs=selection?JSON.parse(readFileSync(selection)).cases:development.map(s=>[s,expected[s.op]]);
if(selection) assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8')
  .includes(createHash('sha256').update(readFileSync(selection)).digest('hex')));
let checked=0,mutants=0;
for(let j=0;j<pairs.length;j+=2){
  const [normal,held]=pairs.slice(j,j+2).sort(([a],[b])=>(a.hold??0)-(b.hold??0));
  const t=held[0].hold;
  const a=build(normal[0]), b=build(held[0]);
  assert.deepEqual(a.initial,b.initial); assert.deepEqual(a.budgets,b.budgets);
  const left=packet.results.find(r=>r.fiche===normal[0].op), right=packet.results.find(r=>r.fiche===held[0].op);
  assert.ok(left.ok && right.ok); let previous=b.initial;
  for(let i=0;i<t;i++){
    assert.deepEqual(left.turns[i],right.turns[i]);
    const action=left.turns[i].command, na=a.advance(i,action), nb=b.advance(i,action);
    assert.ok(na && nb);
    if(i+1<t) assert.deepEqual(na,nb);
    else {
      assert.deepEqual(nb.frame,previous.frame);
      assert.notDeepEqual(na.frame,nb.frame);
      assert.deepEqual(na.availableActionIds,nb.availableActionIds);
      assert.equal(na.stepIndex,nb.stepIndex);
    }
    previous=nb;
  }
  const copied=structuredClone(right.turns);
  copied[t].command=left.turns[t].command;
  assert.ok(check(held[1],copied).ecarts.includes('continuation au retour '+t));
  const stale=structuredClone(right.turns);
  stale[t].returned.view.objective='ancien-plan';
  assert.ok(check(held[1],stale).ecarts.some(s=>s.startsWith('retour à ')));
  checked++;mutants+=2;
}
console.log(JSON.stringify({paires:checked,fauxRecusRejetes:mutants,sha256:createHash('sha256').update(bytes).digest('hex')}));
