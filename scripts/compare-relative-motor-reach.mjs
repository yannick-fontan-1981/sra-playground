import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {openParkedSubjects} from './sic-study-parked-subjects.mjs';

const [env,tape,code,comparison,out]=process.argv.slice(2);
const example=JSON.parse(await readFile(comparison,'utf8')).examples.different_position;
assert.equal(example.suffix.length,1,'This audit needs two outcomes after a single common motor');
const {prepare,select,act,live,view,at,same,original,selected,first,second,parked,moving,directions}=
  await openParkedSubjects(env,tape,code);
const plus=(p,q)=>p.map((v,i)=>v+q[i]),minus=(p,q)=>p.map((v,i)=>v-q[i]);
const distance=(p,q)=>p.reduce((sum,v,i)=>sum+Math.abs(v-q[i]),0);
const boxSize=b=>[b[2]-b[0]+1,b[3]-b[1]+1];
async function measure(word){
  await prepare(word);
  const b=await act(select);
  if(!live(b))return;
  const before=await view(b),origin=at(before,moving),guard=at(before,parked);
  if(!origin||!guard)return;
  const next=await act({id:example.suffix[0]});if(!live(next))return;
  const after=await view(next),end=at(after,moving);
  if(!end||!same(at(after,parked),guard))return;
  const boxes=[before[moving][0].box,after[moving][0].box];
  if(distance(boxSize(boxes[0]),boxSize(boxes[1]))!==0)return;
  return {origin,guard,end,boxes,word};
}
const training=[];
for(const word of example.preparations){const t=await measure(word);assert.ok(t);training.push(t);}
training.sort((a,b)=>distance(a.end,a.origin)-distance(b.end,b.origin));
const [short,long]=training,step=minus(short.end,short.origin),axis=step.findIndex(n=>n!==0);
assert.ok(same(short.origin,long.origin)&&axis>=0&&step[1-axis]===0&&step[axis]*(long.end[axis]-long.origin[axis])>0);
const nearGuard=minus(long.end,long.guard),lateral=long.guard[1-axis]-long.origin[1-axis];
const poses=[{word:[],at:original}],seen=new Set([original.join()]);
for(let i=0;i<poses.length&&poses.length<34;i++){
  const pose=poses[i];if(pose.word.length>=12)continue;
  for(const id of directions){
    const word=[...pose.word,id],b=await prepare(word);if(!live(b))continue;
    const l=await view(b),p=at(l,first);if(!p||!same(at(l,second),selected)||seen.has(p.join()))continue;
    seen.add(p.join());poses.push({at:p,word});
  }
}
const data={poses:poses.length,comparable:0,aligned:0,alignedMatches:0,alignedOrdinaryMatches:0,other:0,otherMatches:0,unscored:0};
for(const pose of poses){
  if(training.some(t=>same(t.guard,pose.at)))continue;
  const t=await measure(pose.word);if(!t||!same(t.origin,long.origin)||!same(t.guard,pose.at)){data.unscored++;continue;}
  const aligned=Math.abs(t.guard[1-axis]-t.origin[1-axis]-lateral)<=1&&
    Math.sign(step[axis])*(t.guard[axis]+nearGuard[axis]-t.origin[axis])>Math.abs(step[axis]);
  const ordinary=plus(t.origin,step),target=aligned?plus(t.guard,nearGuard):ordinary;
  data.comparable++;const matches=same(t.end,target);
  if(aligned){data.aligned++;if(matches)data.alignedMatches++;if(same(t.end,ordinary))data.alignedOrdinaryMatches++;}
  else{data.other++;if(matches)data.otherMatches++;}
}
await writeFile(out,JSON.stringify({code,command:example.suffix[0],training,ordinaryDisplacement:step,offsetFromPartner:nearGuard,results:data}));
console.log(JSON.stringify(data));
