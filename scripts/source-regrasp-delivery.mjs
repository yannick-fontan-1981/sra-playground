// Joint state search for a single carried object. Letting go and changing
// sides can make a previously impossible translation possible at a corner.
const directions=[[0,-1],[0,1],[-1,0],[1,0]];
const inputs=['ACTION1','ACTION2','ACTION3','ACTION4'];
export function deliveryByRegrasp(floor,actor,face,boxes,goals,{allowRegrasp=true,budget=100}={}) {
  const cells=[...floor].map(k=>k.split(',').map(Number));
  const index=new Map(cells.map((p,i)=>[p.join(),i])),n=cells.length;
  const neighbor=cells.map(p=>directions.map(([x,y])=>index.get([p[0]+x,p[1]+y].join())??-1));
  const objects=boxes.map(p=>index.get(p.join())),targets=new Set(goals.map(p=>index.get(p.join())));
  const start=index.get(actor.join()),initialFace=directions.findIndex(d=>d.join()===face.join());
  if (start===undefined || initialFace<0 || objects.includes(undefined)) return null;
  const encode=(at,look,part,held)=>((part*n+at)*4+look)*2+Number(held);
  let best=null;
  for (const object of objects) {
    if (targets.has(object)) continue;
    const fixed=new Set(objects.filter(p=>p!==object));
    const queue=[], seen=new Set();
    function add(at,look,part,held,parent,input,depth) {
      const key=encode(at,look,part,held);
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({at,look,part,held,parent,input,depth});
    }
    add(start,initialFace,object,false,-1,null,0);
    for (let i=0;i<queue.length;i++) {
      const {at,look,part,held,depth}=queue[i];
      if (depth>=(best?.steps.length??(budget+1))) break;
      if (!held && targets.has(part)) {
        const steps=[];
        for (let j=i;queue[j].parent>=0;j=queue[j].parent) {
          const s=queue[j];
          steps.push({input:s.input,actor:cells[s.at],object:cells[s.part],face:directions[s.look],held:s.held});
        }
        best={initialObject:cells[object],steps:steps.reverse()};break;
      }
      if (depth>=budget) continue;
      const ahead=neighbor[at][look];
      if (!held && ahead===part) add(at,look,part,true,i,'ACTION5',depth+1);
      if (held && (allowRegrasp||targets.has(part))) add(at,look,part,false,i,'ACTION5',depth+1);
      for (let dir=0;dir<4;dir++) {
        const to=neighbor[at][dir],nextPart=held?neighbor[part][dir]:part,nextFace=held?look:dir;
        const free=to>=0 && !fixed.has(to) && (held?nextPart>=0&&!fixed.has(nextPart):to!==part);
        if (free) add(to,nextFace,nextPart,held,i,inputs[dir],depth+1);
        else if (nextFace!==look) add(at,nextFace,part,held,i,inputs[dir],depth+1);
      }
    }
  }
  return best;
}
