import assert from 'node:assert/strict';

export function offsets(before,after){
  if(before.length!==after.length)return [];
  return before.map((_,i)=>i).filter(i=>after.every((v,x)=>v===before[(x+i)%before.length]));
}
export function preimages(tracks,detectors){
  let states=[[]];
  for(const track of tracks)states=states.flatMap(prefix=>track.map((_,i)=>[...prefix,i]));
  return states.filter(state=>detectors.every(({x,target})=>target===tracks.reduce((sum,p,i)=>sum+p[(x+state[i])%p.length],0)));
}
function shortest(tracks,goals,actions){
  const queue=[{state:tracks.map(()=>0),first:null,depth:0}],visited=new Set(),found=new Set();let best=Infinity;
  for(let cursor=0;cursor<queue.length;cursor++){
    const {state,first,depth}=queue[cursor];if(depth>best)break;
    const key=JSON.stringify([state,first]);if(visited.has(key))continue;visited.add(key);
    if(goals.some(g=>g.every((v,i)=>v===state[i]))){best=depth;found.add(first);continue;}
    for(const [label,delta] of Object.entries(actions))queue.push({
      state:state.map((v,i)=>(v+delta[i])%tracks[i].length),first:first??label,depth:depth+1});
  }
  return {distance:Number.isFinite(best)?best:null,premiers:[...found].sort()};
}
function accepts(claim,receipt){
  const shift=offsets(receipt.before,receipt.after);
  return claim.ticket===receipt.ticket && claim.receiver===receipt.receiver && shift.length===1 && shift[0]===claim.delta;
}
export function control(){
  const tracks=[[0,1,3],[2,0,1,0]],actions={u:[1,0],v:[0,1]},tests=[];
  for(const [target,expected] of [[[0,3],[[0,1],[0,3]]],[[2,2],[[1,2]]]]){
    const goals=preimages(tracks,target.map((v,i)=>({x:i*2,target:v})));
    assert.deepEqual(goals,expected);
    tests.push({target,goals,complet:shortest(tracks,goals,actions),sansU:shortest(tracks,goals,{v:actions.v})});
  }
  assert.deepEqual(tests.map(t=>t.complet),[{distance:1,premiers:['v']},{distance:3,premiers:['u','v']}]);
  assert.deepEqual(tests.map(t=>t.sansU),[{distance:1,premiers:['v']},{distance:null,premiers:[]}]);
  const receipt={ticket:'a',receiver:'b',before:[0,1,3],after:[1,3,0]},claim={ticket:'a',receiver:'b',delta:1};
  assert.ok(accepts(claim,receipt));assert.ok(!accepts({...claim,ticket:'c'},receipt));assert.ok(!accepts({...claim,receiver:'d'},receipt));
  const ambiguous={...receipt,before:[0,2,0,2],after:[2,0,2,0]};
  assert.deepEqual(offsets(ambiguous.before,ambiguous.after),[1,3]);assert.ok(!accepts(claim,ambiguous));
  return {phases:12,cibles:tests,décalagesAmbigus:[1,3],reçusErronésRejetés:3};
}
