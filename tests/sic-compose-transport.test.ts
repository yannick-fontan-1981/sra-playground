import assert from 'node:assert/strict';
import test from 'node:test';
import {detectTransportSelection,observeTransport,readTransport,transportState,type TransportForecast} from '../src/sic/transport-observations.ts';
import {chooseTransport} from '../src/sic/compose-transport.ts';

const columns=9,rows=7,pitch=3,floor=1,water=2,marker=8,inks=[7,9],token=4,marks=[1,10];
const at=(x:number,y:number)=>y*columns+x;
type Scene={a:number;b:number;active:0|1;pieces:number[];bridges?:number[]};
const land=new Set([1,10,19,28,37,12,13,14,15,16,21,22,23,24,25,34,43]);
const point=(n:number)=>[n%columns*pitch+1,Math.floor(n/columns)*pitch+1];
function draw(s:Scene){
  const a=Array.from({length:rows*pitch},()=>Array<number>(columns*pitch).fill(water));
  for(let n=0;n<columns*rows;n++){
    const [x,y]=point(n),owner=n===s.a?0:n===s.b?1:undefined;
    const values=Array<number>(9).fill(land.has(n)?floor:water);
    if(marks.includes(n)){values.fill(5);values[4]=floor;}
    if(s.pieces.includes(n)){values.fill(token);values[4]=6;}
    if(s.bridges?.includes(n))for(let k=0;k<9;k++)values[k]=k%2?4:3;
    if(owner!==undefined){for(const i of [1,3,4,5,7])values[i]=inks[owner]!;if(owner===s.active)values[1]=marker;}
    for(let j=0;j<pitch;j++)for(let i=0;i<pitch;i++)a[y!+j-1]![x!+i-1]=values[j*pitch+i]!;
  }
  return a;
}
const layout={goals:marks.map(n=>{const [x,y]=point(n) as [number,number];return {at:[2*x,2*y] as [number,number],box:[x-1,y-1,x+1,y+1],form:'ring'};})};
test('the receipt separates a remote reciprocal exchange from the creation and use of a support',()=>{
  const initial:Scene={a:at(4,1),b:at(7,2),active:0,pieces:[at(3,2),at(7,1)]};
  const switched:Scene={...initial,active:1};
  const m=detectTransportSelection(layout,draw(initial),draw(switched),point(initial.b),'user-select')!;
  assert.ok(m);assert.equal(m.swap,undefined);
  const swap:Scene={...switched,b:at(3,2),pieces:[at(7,2),at(7,1)]};
  observeTransport(m,draw(switched),draw(swap),'ACTION3','two-ends');
  assert.equal(m.swap?.ref,'two-ends');assert.equal(m.push,undefined);
  const pushing:Scene={...initial,a:at(6,1),b:at(3,2),pieces:[at(7,1),at(3,1)]};
  observeTransport(m,draw({...pushing,active:1}),draw(pushing),'ACTION6:'+point(pushing.a).join(','),'recover');
  const built:Scene={...pushing,a:at(7,1),pieces:[at(3,1)],bridges:[at(8,1)]};
  observeTransport(m,draw(pushing),draw(built),'ACTION4','material-change');
  assert.equal(m.push?.ref,'material-change');assert.equal(m.supportRef,undefined);
  const crossed={...built,a:at(8,1)};
  observeTransport(m,draw(built),draw(crossed),'ACTION4','occupied');
  assert.equal(m.supportRef,'occupied');
  assert.deepEqual(transportState(m,readTransport(m,draw(crossed))!)?.supports,[at(8,1)]);
});
test('advance toward an abstract assignment retains its motor forecast and can be refuted',()=>{
  const phase:Scene={a:at(4,1),b:at(7,2),active:0,pieces:[at(3,2),at(7,1)]},switched:Scene={...phase,active:1};
  const m=detectTransportSelection(layout,draw(phase),draw(switched),point(phase.b),'switch')!;
  const swapped:Scene={...switched,b:at(3,2),pieces:[at(7,2),at(7,1)]};
  observeTransport(m,draw(switched),draw(swapped),'ACTION3','exchange');
  assert.equal(chooseTransport(m,draw(swapped),50,500),undefined);
  const start:Scene={a:at(1,2),b:at(1,3),active:1,pieces:swapped.pieces};
  m.verified=[true,true];
  for(const [i,[dx,dy]]of [[0,-1],[0,1],[-1,0],[1,0]].entries())m.motors['ACTION'+(i+1)]={dx:dx!,dy:dy!,ref:'measured-axis'};
  const offer=chooseTransport(m,draw(start),50,500) as TransportForecast;
  assert.ok(offer);assert.equal(offer.target.length,2);assert.ok(offer.evidence.includes('exchange'));
  assert.equal(observeTransport(m,draw(start),draw(start),offer.command,'failed',offer),'transport_prediction_refuted');
  assert.equal(m.denied[offer.key],true);
});
