// A relation is admitted by a previously produced and still visible edit.
// The mapped pixels must already have the observed new values. Untouched
// siblings then provide competing, independently testable predictions.
function geometry(rows,offers) {
  const boxes=[...offers.map(o=>o.target),...offers[0].kept.map(s=>s.box)];
  const rect=[Math.min(...boxes.map(b=>b[0])),Math.min(...boxes.map(b=>b[1])),
    Math.max(...boxes.map(b=>b[2])),Math.max(...boxes.map(b=>b[3]))];
  const result=[],known=new Set();
  function add(name,matrix){
    if(!matrix.every(Number.isInteger)||known.has(matrix.join()))return;
    result.push({name,matrix});known.add(matrix.join());
  }
  for(const [type,[l,t,r,b]] of [['image',[0,0,rows[0].length-1,rows.length-1]],['sites',rect]]){
    add(type+'-horizontal',[-1,0,0,1,l+r,0]);add(type+'-vertical',[1,0,0,-1,0,t+b]);
    add(type+'-halfturn',[-1,0,0,-1,l+r,t+b]);
    if(r-l===b-t){
      add(type+'-diagonal',[0,1,1,0,l-t,t-l]);add(type+'-antidiagonal',[0,-1,-1,0,l+b,t+r]);
      add(type+'-right',[0,-1,1,0,l+b,t-l]);add(type+'-left',[0,1,-1,0,l-t,t+r]);
    }
  }
  const offsets=new Map();
  for(const a of boxes)for(const b of boxes){
    const dx=b[0]-a[0],dy=b[1]-a[1];if(!dx&&!dy)continue;
    const k=[dx,dy].join();offsets.set(k,(offsets.get(k)??0)+1);
  }
  for(const [k,n] of [...offsets].sort((a,b)=>b[1]-a[1]).slice(0,16)){
    if(n<2)continue;const [dx,dy]=k.split(',').map(Number);add('translation',[1,0,0,1,dx,dy]);
  }
  return result;
}
function differences(rule){
  const a=rule.before.split('/').map(row=>row.split(',').map(Number));
  const b=rule.after.split('/').map(row=>row.split(',').map(Number)),changes=[];
  for(let y=0;y<a.length;y++)for(let x=0;x<a[y].length;x++)
    if(a[y][x]!==b[y][x])changes.push([x,y,a[y][x],b[y][x]]);
  return changes;
}
function match(rows,box,changes,matrix){
  const [a,b,c,d,u,v]=matrix;let agreed=0,old=0;
  for(const [i,j,was,want] of changes){
    const x=box[0]+i,y=box[1]+j,tx=a*x+b*y+u,ty=c*x+d*y+v;
    if(tx>=box[0]&&tx<=box[2]&&ty>=box[1]&&ty<=box[3])return null;
    const color=rows[ty]?.[tx];if(color===undefined)return null;
    agreed+=Number(color===want);old+=Number(color===was);
  }
  return {newValue:agreed/changes.length,oldValue:old/changes.length};
}
export function correspondences(rows,offers){
  const score=offers.map(()=>0),evidence=[];
  if(offers.length<2)return {score,evidence};
  const rule=offers[0].rule,changes=differences(rule),kept=offers[0].kept;
  if(!changes.length)return {score,evidence};
  for(const trans of geometry(rows,offers)){
    const fitted=kept.every(s=>match(rows,s.box,changes,trans.matrix)?.newValue===1);
    if(!fitted)continue;
    const votes=offers.map(o=>match(rows,o.target,changes,trans.matrix)?.newValue===1);
    const count=votes.filter(Boolean).length;
    if(!count||count===offers.length)continue;
    const weight=Math.log2(1+kept.length)/count;
    votes.forEach((v,i)=>{if(v)score[i]+=weight;});
    evidence.push({kind:trans.name,matrix:trans.matrix,compatible:count});
  }
  return {score,evidence};
}
