const minus=(p,q)=>p.map((v,i)=>v-q[i]);
const span=p=>Math.max(...p.map(Math.abs));
export function translations(l) {
  const offsets=new Map();
  for(const g of Object.values(l)){
    if(g.length!==2)continue;
    for(const [a,b] of [[g[0],g[1]],[g[1],g[0]]]){
      const d=minus(b.at,a.at);
      if(span(d)<=2*Math.max(a.box[2]-a.box[0]+1,a.box[3]-a.box[1]+1))continue;
      const key=d.join(),w=offsets.get(key)??{d,boxes:[]};
      if(w.boxes.every(e=>[a.box,b.box].every(p=>p[0]>e[2]||e[0]>p[2]||p[1]>e[3]||e[1]>p[3])))w.boxes.push(a.box,b.box);
      offsets.set(key,w);
    }
  }
  return [...offsets.values()].filter(w=>w.boxes.length>=4);
}
