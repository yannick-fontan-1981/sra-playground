import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
export const reference='e03b78df9c0776dbe3e64a88282b5f096c3d13bf';
const blob=execFileSync('git',['show',reference+':tests/fixtures/sic-information-displays-public.json.gz']);
assert.equal(createHash('sha256').update(blob).digest('hex'),'9f2a049421405a35829214a44950ceb9a30e08c126ae052e32e53de459949158');
const source=JSON.parse(gunzipSync(blob)).games.LOGI;
export const historical={...source,initial:source.observations[0],length:2,advance(i,c){
  return c?.actionRef===source.commands[i].actionRef && c.data.x===source.commands[i].data.x &&
    c.data.y===source.commands[i].data.y?source.observations[i+1]:null;
}};
export const development=[
  {id:'D1-égalité',initial:[11,3,14],effects:['stable']},
  {id:'D1-minorité',initial:[11,3,11],effects:['stable']},
  {id:'D2-gauche',initial:[11,11,3],effects:[0,'contraire']},
  {id:'D2-centre',initial:[11,11,3],effects:[1,'contraire']},
];
export const baseControls=[0,1,2].map(i=>[4+22*i,49,6+22*i,51]);
export const baseReceivers=[0,1,2].map(i=>[8+22*i,4,12+22*i,6]);
function paint(frame,box,color) {
  const [a,b,c,d]=box;
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++)frame[y][x]=color;
}
export function readRow(frame,boxes) {
  return boxes.map(([x,y,right,bottom])=>{
    const val=frame[y][x];
    for(let j=y;j<=bottom;j++)for(let k=x;k<=right;k++)assert.equal(frame[j][k],val);
    return val;
  });
}
export function board(spec) {
  // Translation circulaire du cadre public, avec les six rectangles entièrement dans la vue.
  const dx=spec.dx??0;
  assert.ok(Number.isInteger(dx) && Math.abs(dx)<=3);
  const shift=box=>box.map((n,i)=>i%2===0?n+dx:n);
  const controls=baseControls.map(shift), receivers=baseReceivers.map(shift);
  const base=source.observations[0];
  const rows=base.frame.map(row=>row.map((_,x)=>row[(x-dx+row.length)%row.length]));
  let values=[3,3,3], lamps=[...spec.initial];
  function observation(i){
    const f=structuredClone(rows);
    controls.forEach((b,k)=>paint(f,b,values[k]));receivers.forEach((b,k)=>paint(f,b,lamps[k]));
    return {...base,stepIndex:i,frame:f,frames:[f]};
  }
  return {controls,receivers,budgets:source.budgets,initial:observation(0),length:spec.effects.length,
    advance(i,c) {
      if(c?.actionRef!=='ACTION6') return null;
      const index=controls.findIndex(([x,y,a,b])=>c.data.x>=x && c.data.x<=a && c.data.y>=y && c.data.y<=b);
      if(index<0)return null;
      const e=spec.effects[i],j=e==='contraire' || e?.wrong ? (index+1)%3:index;
      if(e!=='stable') values[j]=values[j]===3?14:3;
      if(typeof e==='number') lamps[e]=lamps[e]===11?3:11;
      if(e && typeof e==='object') {
        const k=(index+e.offset)%3;
        lamps[k]=e.value==='sameAsAddressed'?lamps[index]:e.value;
      }
      if(e==='contraire') lamps[index]=lamps[index]===11?3:11;
      return observation(i+1);
    }};
}
