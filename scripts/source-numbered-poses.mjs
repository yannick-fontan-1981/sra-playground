import { poseFamilyKey } from '../src/sic/pose-families.ts';
import { publicParts } from './source-transfer-demonstration.mjs';
import { hash } from './sic-study-source-replay.mjs';

// Index in first-observation order within one episode. Rows contain doubled centres to
// preserve cells with an even width or height without rounding a centre to another pixel.
export function sourcePoseIndex() {
  const inspect=publicParts(),states=new Map(),forms=new Map(),families=new Map();
  return async b=>{
    const k=hash(b);
    if(states.has(k))return states.get(k);
    const groups=new Map(),rows=[];
    for(const e of (await inspect(b)).parts){
      if(e.area>b.frame.length*b.frame[0].length/12)continue;
      if(!forms.has(e.signature)){
        const key=poseFamilyKey(e);
        if(!families.has(key))families.set(key,families.size+1);
        forms.set(e.signature,{shape:forms.size+1,family:families.get(key)});
      }
      const {shape,family}=forms.get(e.signature),box=e.bbox,position=[box[0]+box[2],box[1]+box[3]];
      rows.push([shape,family,...position,e.area,box[2]-box[0]+1,box[3]-box[1]+1]);
      const same=groups.get(family)??[];same.push({shape,p:position});groups.set(family,same);
    }
    const value={rows,groups};
    states.set(k,value);return value;
  };
}

