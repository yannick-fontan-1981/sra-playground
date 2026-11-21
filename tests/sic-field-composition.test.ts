import assert from 'node:assert/strict';
import test from 'node:test';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { exemplarPlans, type ExemplarRule } from '../src/sic/field-exemplars.ts';
import { fieldObligationPlans, fulfillsSite, siteValue } from '../src/sic/field-obligations.ts';

// Use palettes and spacing independent of the corpus. A small symbol can
// name the state of a larger cell even when neither shares a pixel value.
const blank = () => Array.from({length:46},() => Array<number>(69).fill(5));
function square(rows:number[][],x:number,y:number,n:number,color:number) {
  for (let j=y;j<y+n;j++) for (let i=x;i<x+n;i++) rows[j]![i]=color;
}
function panel(rows:number[][],x:number,y:number,bits:string,anchor:number,other:number,paint:boolean) {
  for (let k=0;k<9;k++) {
    const dx=k%3, dy=Math.floor(k/3);
    if (k!==4) square(rows,x+dx*8,y+dy*8,6,paint&&bits[k]==='1'?anchor:other);
    square(rows,x+8+dx*2,y+8+dy*2,2,k===4?anchor:bits[k]==='1'?7:13);
  }
}

test('independent current fields explain a fresh glyph palette and specify a joint target',()=>{
  const rows=blank();
  panel(rows,1,1,'101100010',3,11,true);
  panel(rows,26,1,'110101100',3,11,true);
  panel(rows,1,24,'010001011',3,11,false);
  const plan=exemplarPlans(rows,geometricComponents(rows)).find(p=>p.field[1]===24);
  assert.ok(plan);
  assert.equal(plan.examples,2);
  assert.equal(plan.agreements,16);
  assert.deepEqual(plan.relativeRules,[{columns:3,rows:3,cueIndex:4,orientation:0,sameAsCue:[7],differentFromCue:[13]}]);
  const missing=plan.assignments.filter(c=>c.before!==c.desired);
  assert.equal(missing.length,4);
  assert.ok(missing.every(c=>c.desired===3));
});

test('equally supported orientations that prescribe different configurations leave the target unresolved',()=>{
  const rows=blank();
  panel(rows,1,1,'101100010',3,11,true);
  panel(rows,26,1,'110001100',3,11,true);
  panel(rows,1,24,'010001011',3,11,false);
  assert.equal(exemplarPlans(rows,geometricComponents(rows)).length,0);
});

const rule:ExemplarRule={columns:3,rows:3,cueIndex:4,orientation:0,sameAsCue:[7],differentFromCue:[13]};
function overlapping(conflict:boolean) {
  const rows=blank();
  // Two complete neighborhoods share a column of three cells.
  for (let i=0;i<5;i++) for (let j=0;j<3;j++) square(rows,2+i*8,2+j*8,6,10);
  for (const center of [1,3]) for (let j=0;j<3;j++) for (let i=0;i<3;i++) {
    const globalX=center+i-1;
    let equal=(globalX+j)%3===0;
    if (conflict && center===3 && i===0 && j===0) equal=!equal;
    square(rows,2+center*8+i*2,10+j*2,2,i===1&&j===1?6:equal?7:13);
  }
  return rows;
}
test('overlapping fields combine equalities and inequalities at unique sites under a new output palette',()=>{
  const rows=overlapping(false),plans=fieldObligationPlans(rows,geometricComponents(rows),[rule]);
  assert.equal(plans.length,1);
  const p=plans[0]!;
  assert.equal(p.cues.length,2);
  assert.equal(p.obligations.length,13);
  const remaining=p.obligations.filter(s=>!fulfillsSite(siteValue(rows,s.box),s));
  assert.ok(remaining.length>1);
  assert.ok(remaining.every(s=>s.equal.includes(6)));
});
test('a contradictory shared site invalidates the combined configuration',()=>{
  const rows=overlapping(true);
  assert.equal(fieldObligationPlans(rows,geometricComponents(rows),[rule]).length,0);
});
test('competing transferred legends must agree on the complete assignment',()=>{
  const rows=overlapping(false), reversed={...rule,sameAsCue:rule.differentFromCue,differentFromCue:rule.sameAsCue};
  assert.equal(fieldObligationPlans(rows,geometricComponents(rows),[rule,reversed]).length,0);
});
