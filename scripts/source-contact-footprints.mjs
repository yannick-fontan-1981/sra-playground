import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { connectedJointFloor } from '../src/logos-engine/v6-joint-transport.ts';

const boxKey = p => p.bbox.join(',');
const center = p => [(p.bbox[0]+p.bbox[2])/2,(p.bbox[1]+p.bbox[3])/2];
const disjoint = (a,b) => a[2]<b[0] || b[2]<a[0] || a[3]<b[1] || b[3]<a[1];
export function footprints(rows) {
  const result=new Map();
  for(const p of geometricComponents(rows)){
    if(p.area<2 || p.area>rows.length*rows[0].length/12)continue;
    const shape=JSON.stringify([p.color,p.mask]);
    const group=result.get(shape)??new Map();group.set(boxKey(p),p);result.set(shape,group);
  }
  return result;
}
// Only the difference between the two multisets matters. Identical stationary copies cancel.
export function changedFootprints(before,after) {
  const moves=[];
  for(const [shape,group] of before){
    const next=after.get(shape);if(!next||group.size!==next.size)continue;
    const left=[...group].filter(([key])=>!next.has(key)),entered=[...next].filter(([key])=>!group.has(key));
    if(left.length!==1||entered.length!==1)continue;
    const from=left[0][1],to=entered[0][1],dx=to.bbox[0]-from.bbox[0],dy=to.bbox[1]-from.bbox[1];
    if((dx===0)===(dy===0))continue;
    moves.push({shape,from,to,dx,dy,copies:group.size});
  }
  return moves;
}
export function relativeSite(actor,peer,[dx,dy]) {
  if(!disjoint(actor.bbox,peer.bbox))return null;
  const [x,y]=center(actor),[u,v]=center(peer);
  const along=dx?(u-x)/dx:(v-y)/dy,across=dx?Math.abs(v-y):Math.abs(u-x);
  const pitch=Math.abs(dx||dy);
  if(across>pitch/2||Math.abs(Math.abs(along)-1)>0.5)return 0;
  return Math.sign(along);
}
export function peerReturn(first,second,shape,peer,delta) {
  const group=first.get(shape),next=second.get(shape);
  if(!group||!next||group.size!==next.size)return null;
  const here=boxKey(peer);
  if(next.has(here))return 'stayed';
  const target=peer.bbox.map((v,i)=>v+delta[i%2]).join(',');
  if(group.has(target)||!next.has(target))return null;
  if([...group.keys()].some(k=>k!==here&&!next.has(k)))return null;
  return 'travelled';
}

function lattice(part,pitch) {
  const corner=center(part).map(v=>Math.round(v-(pitch-1)/2));
  const offset=corner.map(v=>(v%pitch+pitch)%pitch);
  return {pitch,offset,cell:corner.map((v,i)=>(v-offset[i])/pitch)};
}
function tile(rows,grid,[col,row]){
  const [ox,oy]=grid.offset,x=ox+col*grid.pitch,y=oy+row*grid.pitch;
  if(x<0||y<0||y+grid.pitch>rows.length||x+grid.pitch>rows[0].length)return null;
  return rows.slice(y,y+grid.pitch).flatMap(r=>r.slice(x,x+grid.pitch));
}
export function measuredFloor(before,after,move){
  const pitch=Math.abs(move.dx||move.dy);
  if(pitch<2||pitch>Math.min(before.length,before[0].length)/2)return [];
  const grid=lattice(move.from,pitch),arrival=lattice(move.to,pitch);
  const old=tile(after,grid,grid.cell),entered=tile(before,arrival,arrival.cell);
  if(!old||!entered)return [];
  // Neighboring free cells can have different substrates. Certify each exposed
  // tile through stable boundary samples and a visible change where the body was.
  function uncovered(stamp,occupied){
    const corners=[0,pitch-1,pitch*(pitch-1),pitch*pitch-1];
    return corners.filter(i=>stamp[i]===occupied[i]).length>=2 && stamp.some((v,i)=>v!==occupied[i]);
  }
  const surfaces=[];
  if(uncovered(old,tile(before,grid,grid.cell)))surfaces.push(old);
  if(uncovered(entered,tile(after,arrival,arrival.cell)))surfaces.push(entered);
  return surfaces.map(pixels=>({offset:grid.offset,pitch,stamp:pixels.join(',')}));
}
/** Infer possible receiving surfaces from ground exposed by real travels and a conserved moving shape. */
export function recoverContactLayouts(rows,actor,peer,forms,surfaces,metrics={},prior=[]) {
  const pitch=Math.abs(actor.dx||actor.dy),grid=lattice(actor.to,pitch);
  const ground=surfaces.filter(s=>s.pitch===pitch&&s.offset.every((v,i)=>v===grid.offset[i]));
  metrics.templates=ground.length;metrics.offset=grid.offset;metrics.pitch=pitch;
  if(!ground.length)return [];
  const measured=[...new Set(ground.map(s=>s.stamp))];
  const complexity=stamp=>new Set(stamp.split(',')).size;
  const minimum=Math.min(...measured.map(complexity));
  const stamps=new Set(measured.filter(s=>complexity(s)===minimum)),templates=[...stamps].map(s=>s.split(',').map(Number));
  const nearest=part=>center(part).map((v,i)=>Math.round((v-grid.offset[i]-(pitch-1)/2)/pitch));
  const boxes=new Set([...forms.get(peer.shape).values()].map(part=>nearest(part).join(',')));
  const player=grid.cell,id=player.join(','),floor=new Set([id,...boxes]),groups=new Map();
  if(boxes.has(id))return [];
  const history=prior.map(v=>({rows:v.rows,occupied:new Set([actor.shape,peer.shape].flatMap(shape=>
    [...(v.forms.get(shape)?.values()??[])].map(part=>nearest(part).join(','))))}));
  function overlay(pixels){
    let best;
    for(const pattern of templates){
      const diff=[];
      for(let i=0;i<pixels.length;i++)if(pixels[i]!==pattern[i])diff.push(i);
      if(!best||diff.length<best.length)best=diff;
    }
    if(!best?.length||best.length*2>=pixels.length)return;
    const corners=[0,pitch-1,pitch*(pitch-1),pitch*pitch-1];
    if(corners.some(i=>best.includes(i)))return;
    return best.join(',');
  }
  for(let y=0;grid.offset[1]+(y+1)*pitch<=rows.length;y++)for(let x=0;grid.offset[0]+(x+1)*pitch<=rows[0].length;x++){
    const key=[x,y].join(','),taken=key===id||boxes.has(key);
    const pixels=tile(rows,grid,[x,y]);
    if(!taken&&stamps.has(pixels.join(','))){floor.add(key);continue;}
    const exposed=taken?history.filter(v=>!v.occupied.has(key)).map(v=>tile(v.rows,grid,[x,y])):[pixels];
    for(const sample of exposed){
      const shape=overlay(sample);
      if(shape){const set=groups.get(shape)??new Set();set.add(key);groups.set(shape,set);}
    }
  }
  const layouts=[];
  metrics.bareFloor=floor.size;metrics.overlayClasses=groups.size;metrics.counts=[];
  for(const targets of groups.values()){
    const region=connectedJointFloor(new Set([...floor,...targets]),player);
    const bodies=new Set([...boxes].filter(k=>region.has(k))),goals=new Set([...targets].filter(k=>region.has(k)));
    metrics.counts.push([region.size,bodies.size,goals.size]);
    if(!bodies.size||bodies.size>8||bodies.size!==goals.size||region.size>256)continue;
    const stationarySubjects=new Set([...forms.get(actor.shape).values()].map(part=>nearest(part).join(',')).filter(k=>k!==id&&region.has(k)));
    layouts.push({scale:pitch,offset:grid.offset,player,floor:region,boxes:bodies,targets:goals,stationarySubjects,
      wall_count:0,sprite_count:1+bodies.size+goals.size});
  }
  return layouts;
}

// A planned transition is evidence only if both the moving subject and every tracked
// body reappear at their predicted positions on the public board.
export function matchesJointState(forms,scene,actor,peer,[player,boxes]){
  const cell=part=>center(part).map((v,i)=>Math.round((v-scene.offset[i]-(scene.scale-1)/2)/scene.scale)).join(',');
  const actorCells=new Set([...(forms.get(actor.shape)?.values()??[])].map(cell).filter(k=>scene.floor.has(k)));
  const expected=new Set([...scene.stationarySubjects,player.join(',')]);
  const bodyCells=new Set([...(forms.get(peer.shape)?.values()??[])].map(cell).filter(k=>scene.floor.has(k)));
  return !scene.stationarySubjects.has(player.join(',')) && actorCells.size===expected.size && [...expected].every(k=>actorCells.has(k))
    && bodyCells.size===boxes.size && [...boxes].every(k=>bodyCells.has(k));
}
