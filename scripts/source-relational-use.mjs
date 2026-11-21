// Learn an operation whose result at one position is the previous contents
// of another. Either operand can be the newly prepared site. Predictions
// contain the values of the current operands, never a training palette.
const offsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];

function topology(values) {
  const names=new Map();
  return values.map(v=>{
    if (!names.has(v)) names.set(v,names.size);
    return names.get(v);
  }).join(',');
}

function tile(frame,x,y,w,h) {
  if (x<0 || y<0 || x+w>frame[0].length || y+h>frame.length) return null;
  const pixels=frame.slice(y,y+h).flatMap(row=>row.slice(x,x+w));
  return {pixels,key:pixels.join(','),shape:topology(pixels),x,y};
}

function neighborhood(frame,x,y,w,h,px,py) {
  return offsets.map(([dx,dy])=>tile(frame,x+dx*px,y+dy*py,w,h));
}

function relation(parts) {
  return topology(parts.map(p=>p?.key??'outside'));
}

function actionAt(step,x,y,w,h,tx,ty) {
  if (step.a!==6) return 'ACTION'+step.a;
  const dx=step.data.x-x,dy=step.data.y-y;
  if (dx<0 || dy<0 || dx>=w || dy>=h) return null;
  return 'ACTION6:'+(tx+dx)+','+(ty+dy);
}

export function relationalUses(history,site,created,available,motors) {
  const [w,h]=site.size,[tx,ty]=site.end.map((v,k)=>Math.ceil(v-(site.size[k]-1)/2));
  const deltas=[...(motors?.values()??[])].filter(s=>s.size===1).map(s=>s.values().next().value);
  const pitch=[0,1].map(k=>Math.min(...deltas.map(d=>Math.abs(d[k])).filter(d=>d>0)));
  // Include only axes whose stride is observed. On the missing axis use
  // the single row/column through the site and leave its neighbours absent.
  const [px,py]=pitch.map((v,k)=>Number.isFinite(v)?v:(k?created.length:created[0].length));
  if (!pitch.some(Number.isFinite)) return [];
  const local=neighborhood(created,tx,ty,w,h,px,py), signature=relation(local), rules=new Map();
  const pairs=offsets.slice(1).flatMap((_,i)=>[[0,i+1],[i+1,0]])
    .filter(([s,d])=>local[s] && local[d] && local[s].key!==local[d].key);
  for (const {before,after,step} of history) {
    if (!available.includes(step.a)) continue;
    for (let y=ty%py;y+h<=before.length;y+=py) for (let x=tx%px;x+w<=before[0].length;x+=px) {
      if (x===tx && y===ty) continue;
      const input=actionAt(step,x,y,w,h,tx,ty);
      if (!input) continue;
      const at=neighborhood(before,x,y,w,h,px,py);
      const sameNeighborhood=relation(at)===signature &&
        at.every((p,i)=>!!p===!!local[i]);
      for (const [s,d] of pairs) {
        if (!at[s] || !at[d] || at[s].key===at[d].key ||
          at[s].shape!==local[s].shape || at[d].shape!==local[d].shape) continue;
        const dest=at[d],end=tile(after,dest.x,dest.y,w,h);
        if (!end) continue;
        for (const guard of sameNeighborhood?['shape','neighbours']:['shape']) {
          const key=JSON.stringify([input,s,d,guard]);
          const rule=rules.get(key)??{input,s,d,guard,hits:0,misses:0,sites:new Set()};
          if (end.key===at[s].key) {rule.hits++;rule.sites.add(x+','+y);}
          else rule.misses++;
          rules.set(key,rule);
        }
      }
    }
  }
  const out=[];
  for (const {input,s,d,guard,hits,misses,sites} of rules.values()) {
    if (!hits) continue;
    const dest=local[d];
    out.push({input,expected:local[s].pixels,tx:dest.x,ty:dest.y,w,h,sites:sites.size,
      hits,misses,guard,sourceOffset:offsets[s],destinationOffset:offsets[d]});
  }
  return out;
}
