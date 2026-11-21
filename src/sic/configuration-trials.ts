import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { clickSite, type Site } from './local-response.ts';

type Factor = { action: string; site: Site; values: [number,number]; forward: string; reverse?: string };
export type ConfigurationMemory = { factors: Factor[]; visited: string[]; failures: string[] };
export type ConfigurationTrial = { action: string; from: string; expected: string; target: string; evidence: string[] };
export const newConfigurationMemory = (): ConfigurationMemory => ({factors:[],visited:[],failures:[]});
const bitAt = (rows: NativeRows, factor: Factor) => factor.values.indexOf(rows[factor.site[1]]?.[factor.site[0]] ?? -1);
function configuration(factors: Factor[], rows: NativeRows): string | null {
  const bits=factors.map(f=>bitAt(rows,f));
  return bits.includes(-1)?null:bits.join('');
}
const changedBit=(mask:string,j:number)=>mask.slice(0,j)+(mask[j]==='0'?'1':'0')+mask.slice(j+1);
function remember(values:string[], value:string) { if(!values.includes(value))values.push(value); }

function responseSite(before: NativeRows, after: NativeRows, action: string): Site | null {
  const focus=clickSite(action),reach=Math.max(2,Math.floor(Math.min(before.length,before[0]!.length)/8));
  let best:Site|null=null,nearest=Infinity,loX=Infinity,hiX=-1,loY=Infinity,hiY=-1;
  for(let y=0;y<before.length;y++) for(let x=0;x<before[y]!.length;x++) {
    if(before[y]![x]===after[y]?.[x])continue;
    const distance=focus?Math.abs(x-focus[0])+Math.abs(y-focus[1]):0;
    if(focus && distance>reach)continue;
    loX=Math.min(x,loX);hiX=Math.max(x,hiX);loY=Math.min(y,loY);hiY=Math.max(y,hiY);
    if(distance<nearest){best=[x,y];nearest=distance;}
  }
  if(!focus && Math.max(hiX-loX,hiY-loY)>reach)return null;
  return best;
}

export function observeConfiguration(m: ConfigurationMemory, before: NativeRows, after: NativeRows,
  action: string, ref: string, trial?: ConfigurationTrial): void {
  if(action==='RESET' || action==='ACTION7' || !before.length || before.length!==after.length ||
      before[0]!.length!==after[0]?.length)return;
  const previous=configuration(m.factors,before), result=configuration(m.factors,after);
  if(trial && trial.action===action && previous===trial.from && result!==trial.expected)
    remember(m.failures,trial.from+'/'+action);
  const known=m.factors.find(f=>f.action===action);
  if(known){
    if(bitAt(before,known)===1 && bitAt(after,known)===0)known.reverse=ref;
  }else if(m.factors.length<10){
    const site=responseSite(before,after,action);
    if(site){
      const [x,y]=site;
      // An alternative command that also writes an existing factor has not
      // supplied a new independently addressable bit.
      const preserves=m.factors.every(f=>bitAt(before,f)>=0 && bitAt(before,f)===bitAt(after,f));
      if(preserves && !m.factors.some(f=>f.site[0]===x && f.site[1]===y)){
        m.factors.push({action,site,values:[before[y]![x]!,after[y]![x]!],forward:ref});
        m.visited=[];m.failures=[];
      }
    }
  }
  for(const rows of [before,after]){
    const mask=configuration(m.factors,rows);
    if(mask!==null)remember(m.visited,mask);
  }
}

export function nextConfiguration(m:ConfigurationMemory, rows:NativeRows, available:readonly string[]):ConfigurationTrial|null {
  const from=configuration(m.factors,rows);
  if(from===null || m.factors.length<2)return null;
  const visited=new Set(m.visited), seen=new Set([from]), blocked=new Set(m.failures);
  const queue:[string,number][]=[[from,-1]];
  for(let i=0;i<queue.length;i++){
    const [at,first]=queue[i]!;
    const order=m.factors.map((f,j)=>({f,j,verified:at[j]==='0'||!!f.reverse}))
      .sort((a,b)=>Number(b.verified)-Number(a.verified));
    for(const {f,j} of order){
      if(!available.includes(f.action.split(':')[0]!) || blocked.has(at+'/'+f.action))continue;
      const target=changedBit(at,j);
      if(seen.has(target))continue;
      seen.add(target);
      const which=first<0?j:first;
      if(!visited.has(target)){
        const factor=m.factors[which]!;
        return {action:factor.action,from,expected:changedBit(from,which),target,
          evidence:[...new Set(m.factors.flatMap(bit=>bit.reverse?[bit.forward,bit.reverse]:[bit.forward]))]};
      }
      queue.push([target,which]);
    }
  }
  return null;
}
