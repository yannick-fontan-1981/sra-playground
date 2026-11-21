import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

type Part = {box: NativeBox; ink: number};
function footprint(rows: NativeRows, part: Part, mark?: number) {
  const [l,t,r,b]=part.box, result:string[]=[];
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){
    const v=rows[y]?.[x];
    if(v===part.ink || v===mark && mark!==undefined)result.push([x-l,y-t,v].join(','));
  }
  return result.join('/');
}

// Local foregrounds may rotate or reflect when a directional input changes the pose.
// Compare just the two witnessed inks so that a third piece can enter the parked tile.
export function markedPoseMotion(before:NativeRows,after:NativeRows,source:Part,target:Part,accent:number) {
  if(source.ink===target.ink||target.ink===accent||source.ink===accent)return;
  const park=footprint(before,source);
  if(!park||park!==footprint(after,source))return;
  const [l,t,r,b]=target.box,w=r-l+1,h=b-t+1;
  const original=footprint(before,target,accent);
  if(!original.split('/').some(p=>p.endsWith(','+accent))||!original.split('/').some(p=>p.endsWith(','+target.ink)))return;
  const admitted=new Set<string>();
  for(const transpose of w===h?[false,true]:[false])for(const flipX of [false,true])for(const flipY of [false,true]){
    const rotated=original.split('/').map(p=>{
      const [x,y,v]=p.split(',').map(Number) as [number,number,number];
      const a=transpose?y:x,c=transpose?x:y;
      return [flipX?w-1-a:a,flipY?h-1-c:c,v];
    }).sort((a,b)=>a[1]!-b[1]!||a[0]!-b[0]!);
    admitted.add(rotated.map(p=>p.join(',')).join('/'));
  }
  if(admitted.has(footprint(after,target,accent)))return;
  const choices=[];
  for(const [dx,dy] of [[-w,0],[w,0],[0,-h],[0,h]] as const){
    const box:NativeBox=[l+dx,t+dy,r+dx,b+dy];
    if(box[0]<0||box[1]<0||box[2]>=after[0]!.length||box[3]>=after.length)continue;
    const site={...target,box};
    if(admitted.has(footprint(after,site,accent))&&!admitted.has(footprint(before,site,accent)))choices.push({box,dx,dy});
  }
  if(choices.length===1)return choices[0];
}
