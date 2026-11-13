/** V5 frame.py / tile_lattice.py / cell_shape_support.py measurement closure.
 * Candidate geometry projection: exact retention rules are preserved; the
 * unused cell-description/pattern-ID serialization is not materialized.
 */
import { supportParts, supportCompare as compare, supportKey as key, supportPoint as point } from './v6-support-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';
type R=Record<string,any>;type P=[number,number];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const mod=(a:number,b:number)=>((a%b)+b)%b;
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
const unique=(a:number[])=>[...new Set(a)].sort((x,y)=>x-y);
const range=(a:number,b:number,step=1):number[]=>{const out:number[]=[];for(let x=a;x<b;x+=step)out.push(x);return out;};
const count=(a:unknown[]):Map<string,number>=>{const out=new Map<string,number>();for(const x of a){const k=JSON.stringify(x);out.set(k,(out.get(k)??0)+1);}return out;};
const arraySlice = Array.prototype.slice, arrayMap = Array.prototype.map;
interface EncodedPeriodicColumns { width: number; axes: string[][] }

/**
 * V5 frame.py's exact horizontal-fragment IDs and fixed-width byte strings.
 * This is temporary measurement data owned by one enumeration, not knowledge
 * or a raster-identity cache. Equal fixed-size cells have equal strings iff
 * every palette value is equal; no lossy digest enters candidate ranking.
 *
 * Keep the former JSON path for nonordinary arrays. Eligibility inspects data
 * descriptors, so it neither invokes an accessor nor masks slice/toJSON hooks.
 */
function encodePeriodicColumns(rows: NativeRows, axes: R[]): EncodedPeriodicColumns | null {
  if (Object.getPrototypeOf(Array.prototype) !== Object.prototype
    || Object.getOwnPropertyDescriptor(Array.prototype, 'slice')?.value !== arraySlice
    || Object.getOwnPropertyDescriptor(Array.prototype, 'map')?.value !== arrayMap
    || Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON')
    || Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')) return null;
  const dense = (value: unknown): unknown[] | null => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
      || Object.getOwnPropertySymbols(value).length) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.keys(descriptors).length !== value.length + 1) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index++) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
      result.push(descriptor.value);
    }
    return result;
  };
  const outer = dense(rows);
  if (!outer) return null;
  const owned: number[][] = [], palette = new Set<number>();
  for (const row of outer) {
    const values = dense(row);
    if (!values || values.length !== rows[0]!.length) return null;
    const pixels: number[] = [];
    for (const value of values) {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 255) return null;
      pixels.push(value); palette.add(value);
    }
    owned.push(pixels);
  }
  const paletteIndex = new Map([...palette].sort((a, b) => a - b).map((value, index) => [value, index]));
  const encodedRows = owned.map(row => row.map(value => String.fromCharCode(paletteIndex.get(value)!)).join(''));
  const fragments = new Map<string, number>(), columns = new Map<string, number[]>();
  for (const axis of axes) for (const left of axis.starts as number[]) {
    const columnKey = key([left, axis.cell_extent]);
    if (columns.has(columnKey)) continue;
    columns.set(columnKey, encodedRows.map(row => {
      const fragment = row.slice(left, left + axis.cell_extent);
      if (!fragments.has(fragment)) fragments.set(fragment, fragments.size);
      return fragments.get(fragment)!;
    }));
  }
  let width = 1;
  for (let maximum = fragments.size - 1; maximum >= 256; maximum = Math.floor(maximum / 256)) width++;
  const bytes = new Map<string, string>();
  for (const [columnKey, ids] of columns) {
    let column = '';
    for (let id of ids) for (let byte = 0; byte < width; byte++) {
      column += String.fromCharCode(id % 256); id = Math.floor(id / 256);
    }
    bytes.set(columnKey, column);
  }
  return { width, axes: axes.map(axis => (axis.starts as number[]).map(left => bytes.get(key([left, axis.cell_extent]))!)) };
}

function encodedPatternCounts(starts: readonly number[], extent: number, width: number, columns: readonly string[]): number[] {
  const counts = new Map<string, number>();
  for (const top of starts) for (const column of columns) {
    const pattern = column.slice(top * width, (top + extent) * width);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }
  return [...counts.values()];
}
export function exactSupportTileLattices(rows:NativeRows,maximumPitch=16,bordered=false):number[][] {
 const H=rows.length,W=rows[0]!.length,groups=new Map<string,Map<string,number>>();
 for(const c of supportParts(rows)){const b=c.bbox,h=b.height,w=b.width;
  if(h<2||w<2||h>(bordered?maximumPitch-1:maximumPitch)||w>(bordered?maximumPitch-1:maximumPitch)||c.area!==h*w)continue;
  let group:number[]=[h,w];
  if(bordered){if(b.top<1||b.left<1||b.bottom>=H-1||b.right>=W-1)continue;const border=new Set<number>();for(let x=b.left;x<=b.right;x++){border.add(rows[b.top-1]![x]!);border.add(rows[b.bottom+1]![x]!);}for(let y=b.top;y<=b.bottom;y++){border.add(rows[y]![b.left-1]!);border.add(rows[y]![b.right+1]!);}if(border.size!==1)continue;group=[h,w,c.value,[...border][0]!];}
  const k=key(group),positions=groups.get(k)??new Map<string,number>();positions.set(key([b.top,b.left]),c.value);groups.set(k,positions);
 }
 const found=new Map<string,number[]>();
 for(const [g,positions]of [...groups].sort((a,b)=>compare(point(a[0]),point(b[0])))){const [h,w,_value,border]=point(g) as [number,number,number,number];if(positions.size<9||(!bordered&&new Set(positions.values()).size<2))continue;
  const ps=[...positions.keys()].map(k=>point(k) as P),rs=unique(ps.map(p=>p[0])),cs=unique(ps.map(p=>p[1]));if(rs.length<3||cs.length<3)continue;
  const rp=rs.slice(1).map((v,i)=>v-rs[i]!).reduce(gcd),cp=cs.slice(1).map((v,i)=>v-cs[i]!).reduce(gcd);
  if(bordered?!(h<rp&&rp<=maximumPitch&&w<cp&&cp<=maximumPitch):rp!==h||cp!==w)continue;
  const capacity=(1+Math.floor((rs.at(-1)!-rs[0]!)/rp))*(1+Math.floor((cs.at(-1)!-cs[0]!)/cp));if(positions.size*2<capacity)continue;
  let geometry:number[];
  if(bordered){const ti=Math.floor((rp-h+1)/2),li=Math.floor((cp-w+1)/2);let complete=true;
   for(const [r,c]of ps){const top=r-ti,left=c-li;if(top<0||left<0||top+rp>H||left+cp>W){complete=false;break;}for(let y=top;y<top+rp;y++)for(let x=left;x<left+cp;x++)if(!(r<=y&&y<r+h&&c<=x&&x<c+w)&&rows[y]![x]!==border)complete=false;if(!complete)break;}
   if(!complete)continue;geometry=[mod(rs[0]!-ti,rp),mod(cs[0]!-li,cp),rp,cp];
  }else{if(![[h,0],[0,w]].every(([dy,dx])=>ps.some(([r,c])=>positions.has(key([r+dy!,c+dx!])))))continue;geometry=[mod(rs[0]!,h),mod(cs[0]!,w),h,w];}
  found.set(key(geometry),geometry);
 }
 return found.size<=3?[...found.values()].sort(compare):[];
}
export function measureSupportPeriodicAxes(rows:NativeRows,axis:'row'|'column',maximumPitch=16,exactZeroGapAxes:number[][]=[]):R[] {
 const H=rows.length,W=rows[0]!.length,extent=axis==='row'?H:W,orth=axis==='row'?W:H,palette=unique(rows.flat() as number[]),candidates:R[]=[];
 const changes=range(0,extent).map(i=>i===0?0:range(0,orth).filter(j=>axis==='row'?rows[i-1]![j]!==rows[i]![j]:rows[j]![i-1]!==rows[j]![i]).length);
 const hist=range(0,extent).map(i=>palette.map(v=>range(0,orth).filter(j=>(axis==='row'?rows[i]![j]:rows[j]![i])===v).length));
 for(let pitch=2;pitch<=Math.min(maximumPitch,extent);pitch++)for(const gap of pitch===2?[0]:range(0,Math.min(3,pitch-1)+1))for(let offset=0;offset<pitch;offset++){
  const size=pitch-gap,starts=range(offset,extent-size+1,pitch);if(starts.length<3)continue;
  const indices=starts.flatMap(start=>range(start+size,Math.min(start+pitch,extent)));if(gap>0&&indices.length<starts.length-1)continue;
  const histogram=palette.map((_v,i)=>indices.reduce((n,j)=>n+hist[j]![i]!,0)),total=indices.length*orth,boundaries=starts.map(s=>s+size).filter(s=>s>0&&s<extent);
  candidates.push({offset,cell_extent:size,gap_extent:gap,pitch,starts,separator_consistent:total?Math.max(...histogram):0,separator_total:total,boundary_contrast_ppm:boundaries.length?Math.floor(boundaries.reduce((n,j)=>n+changes[j]!,0)*1000000/(boundaries.length*orth)):0,boundary_count:boundaries.length});
 }
 const retained:R[]=[];
 for(let pitch=2;pitch<=Math.min(maximumPitch,extent);pitch++){
  const separated=candidates.filter(a=>a.pitch===pitch&&a.gap_extent>0).sort((a,b)=>compare([b.separator_consistent/b.separator_total,b.starts.length,-b.gap_extent,-b.offset],[a.separator_consistent/a.separator_total,a.starts.length,-a.gap_extent,-a.offset]));retained.push(...separated.slice(0,2));
  const zero=candidates.filter(a=>a.pitch===pitch&&a.gap_extent===0).sort((a,b)=>compare([Number(b.offset===0)+Number(b.starts.at(-1)+b.cell_extent===extent),b.starts.length,-b.offset],[Number(a.offset===0)+Number(a.starts.at(-1)+a.cell_extent===extent),a.starts.length,-a.offset]));retained.push(...zero.slice(0,2));
  const strongest=[...zero].sort((a,b)=>compare([b.boundary_contrast_ppm,b.boundary_count,-b.offset],[a.boundary_contrast_ppm,a.boundary_count,-a.offset]))[0];if(strongest&&!retained.includes(strongest))retained.push(strongest);
 }
 for(const a of candidates)if(a.gap_extent===0&&exactZeroGapAxes.some(p=>same(p,[a.pitch,a.offset]))&&!retained.includes(a))retained.push(a);return retained;
}
/** Exact geometry/ordering of all candidates returned by the V5 measurement. */
export function enumerateSupportPeriodicCellGrids(rows:NativeRows,options:R={}):R {
 const maximumPitch=options.maximum_pitch??16,maximumCandidates=options.maximum_candidates??3,conditioned=options.action_conditioned_grid_evidence??true,quantum=options.observed_translation_quantum??0;
 if(maximumPitch<2||maximumPitch>32||maximumCandidates<1||maximumCandidates>8)throw new TypeError('Periodic grid bounds exceed source limits');
 const exact=[...new Map([...exactSupportTileLattices(rows,maximumPitch,true),...exactSupportTileLattices(rows,maximumPitch,false)].map(p=>[key(p),p])).values()].sort(compare);
 const raxes=measureSupportPeriodicAxes(rows,'row',maximumPitch,exact.map(([r,_c,h])=>[h!,r!])),caxes=measureSupportPeriodicAxes(rows,'column',maximumPitch,exact.map(([_r,c,_h,w])=>[w!,c!]));
 const encoded=encodePeriodicColumns(rows,caxes);
 const gain=(a:R,axes:R[])=>{if(a.gap_extent!==0)return 0;const aliases=axes.filter(x=>x.gap_extent===0&&x.pitch<a.pitch&&a.pitch%x.pitch===0&&x.offset===a.offset%x.pitch);return aliases.length?Math.max(0,(a.boundary_contrast_ppm-Math.max(...aliases.map(x=>x.boundary_contrast_ppm)))*a.boundary_count):0;};
 const rg=raxes.map(a=>gain(a,raxes)),cg=caxes.map(a=>gain(a,caxes)),described:R[]=[];let pruned=false;
 // The source's exact optimistic pruning is an acceleration. Exhaustive
 // retained-axis measurement yields the same candidates and truncation flag.
 for(let i=0;i<raxes.length;i++)for(let j=0;j<caxes.length;j++){
  const r=raxes[i]!,c=caxes[j]!;if(!conditioned&&(r.gap_extent===0||c.gap_extent===0)&&!(r.gap_extent===0&&c.gap_extent===0&&r.cell_extent===c.cell_extent)){pruned=true;continue;}
  let counts:number[];
  if(encoded)counts=encodedPatternCounts(r.starts,r.cell_extent,encoded.width,encoded.axes[j]!);
  else{const patterns:unknown[]=[];for(const top of r.starts)for(const left of c.starts)patterns.push(rows.slice(top,top+r.cell_extent).map(row=>row.slice(left,left+c.cell_extent)));counts=[...count(patterns).values()];}
  const n=r.starts.length*c.starts.length,repeated=counts.filter(v=>v>1).reduce((a,b)=>a+b,0),repeatedTypes=counts.filter(v=>v>1).length,total=r.separator_total+c.separator_total,consistency=total?Math.floor((r.separator_consistent+c.separator_consistent)*1000000/total):0;
  const order=[Number(total>0&&consistency===1000000),r.gap_extent===0&&c.gap_extent===0&&n?Math.floor(Math.max(...counts)*1000000/n):0,repeated*r.cell_extent*c.cell_extent,repeated,repeatedTypes,consistency,n,-r.pitch,-c.pitch,-r.offset,-c.offset];
  described.push({order,ref:`measurement.periodic_grid.r${r.offset}.${r.cell_extent}.${r.gap_extent}.c${c.offset}.${c.cell_extent}.${c.gap_extent}`,r,c,n,counts,consistency,rg:rg[i],cg:cg[j]});
 }
 described.sort((a,b)=>compare([b.order,b.ref],[a.order,a.ref]));
 const iso=(d:R)=>d.r.cell_extent===d.c.cell_extent&&d.r.gap_extent===d.c.gap_extent,zero=(d:R)=>d.r.cell_extent===d.c.cell_extent&&d.r.gap_extent===0&&d.c.gap_extent===0;
 const separated=described.filter(d=>iso(d)&&d.r.gap_extent>0).slice(0,Math.min(2,maximumCandidates));
 const primitive=described.filter(d=>zero(d)&&d.rg>=1000000&&d.cg>=1000000&&separated.every(s=>s.consistency<1000000)&&d.counts.filter((v:number)=>v>1).reduce((a:number,b:number)=>a+b,0)*2>=d.n).sort((a,b)=>compare([a.r.pitch,a.ref],[b.r.pitch,b.ref]))[0];
 let bounded:R[]=primitive?[primitive]:[];bounded.push(...separated.filter(d=>!bounded.some(x=>x.ref===d.ref)));bounded=bounded.slice(0,maximumCandidates);
 const quantized=described.find(d=>conditioned&&quantum>0&&d.r.cell_extent===quantum&&d.c.cell_extent===quantum&&d.r.gap_extent===0&&d.c.gap_extent===0);
 if(quantized&&!bounded.some(d=>d.ref===quantized.ref)){if(bounded.length>=maximumCandidates)bounded=bounded.slice(0,Math.max(0,maximumCandidates-1));bounded.push(quantized);}
 const strong=described.find(d=>{const counts=[...d.counts].sort((a,b)=>b-a),max=counts[0]??0;return zero(d)&&d.n&&max>=2*(d.n-max)&&counts.length>1&&3*counts[1]!>=max&&!bounded.some(x=>x.ref===d.ref);});
 if(strong&&separated.every(d=>d.consistency<1000000))bounded=described.filter(iso).slice(0,Math.min(2,maximumCandidates));
 const allowZero=!!strong||!!primitive||(conditioned&&!separated.length);
 for(const d of described){if(bounded.length>=maximumCandidates)break;if(!allowZero&&(d.r.gap_extent===0||d.c.gap_extent===0))continue;if(!bounded.some(x=>x.ref===d.ref))bounded.push(d);}
 if(exact.length===1){const [ro,co,rp,cp]=exact[0]!;const compatible=!primitive||(primitive.r.pitch===rp&&primitive.c.pitch===cp),exactCandidates=described.filter(d=>d.r.offset===ro&&d.c.offset===co&&d.r.cell_extent===rp&&d.c.cell_extent===cp&&d.r.gap_extent===0&&d.c.gap_extent===0),separator=separated.some(d=>d.consistency===1000000&&d.r.pitch===rp&&d.c.pitch===cp);if(compatible&&!separator&&exactCandidates.length===1)bounded=exactCandidates;}
 return {candidates:bounded.map(d=>({candidate_ref:d.ref,row_offset:d.r.offset,col_offset:d.c.offset,cell_height:d.r.cell_extent,cell_width:d.c.cell_extent,row_gap:d.r.gap_extent,col_gap:d.c.gap_extent,row_pitch:d.r.pitch,col_pitch:d.c.pitch,logical_rows:d.r.starts.length,logical_columns:d.c.starts.length,separator_consistency_ppm:d.consistency,row_boundary_contrast_ppm:d.r.boundary_contrast_ppm,col_boundary_contrast_ppm:d.c.boundary_contrast_ppm,row_proper_divisor_boundary_gain_line_ppm:d.rg,col_proper_divisor_boundary_gain_line_ppm:d.cg,repeated_pattern_count:d.counts.filter((v:number)=>v>1).length,distinct_pattern_count:d.counts.length})),enumeration_truncated:pruned||described.length>bounded.length};
}
export function measureSupportShapeLatticeGeometries(rows:NativeRows,families:readonly R[],maxPitch=16,maxGeometries=16):R {
 if(!(1<=maxPitch&&maxPitch<=32&&1<=maxGeometries&&maxGeometries<=32))throw new TypeError('lattice bounds must stay within hard limits');const geometries:R[]=[],H=rows.length,W=rows[0]!.length;
 for(let i=0;i<families.length;i++){const f=families[i]!;if(f.origins.length<2)continue;for(let rp=f.height;rp<=maxPitch;rp++){const rres=unique(f.origins.map(([r]:P)=>mod(r,rp)));if(rres.length!==1)continue;for(let cp=f.width;cp<=maxPitch;cp++){const cres=unique(f.origins.map(([_r,c]:P)=>mod(c,cp)));if(cres.length!==1)continue;const ro=rres[0]!,co=cres[0]!;if(ro+f.height>H||co+f.width>W)continue;
  const bottom=ro+Math.floor((H-ro-f.height)/rp)*rp+f.height,right=co+Math.floor((W-co-f.width)/cp)*cp+f.width,separator=new Map<number,number>(),embedded:unknown[]=[];
  for(let r=ro;r<bottom;r++)for(let c=co;c<right;c++)if((r-ro)%rp>=f.height||(c-co)%cp>=f.width){const v=rows[r]![c]!;separator.set(v,(separator.get(v)??0)+1);}
  for(let start=ro;start<bottom;start+=rp)for(let top=start+f.height;top<Math.min(start+rp-f.height+1,bottom-f.height+1);top++)for(let c=co;c<right-f.width+1;c+=cp)embedded.push(rows.slice(top,top+f.height).map(row=>row.slice(c,c+f.width)));
  const patterns=count(embedded);geometries.push({family_index:i,row_offset:ro,col_offset:co,row_pitch:rp,col_pitch:cp,row_gap:rp-f.height,col_gap:cp-f.width,separator_value_counts:[...separator].sort(compare),embedded_full_footprint_windows:embedded.length,repeated_multivalue_windows:[...patterns].reduce((n,[k,v])=>n+(v>1&&new Set((JSON.parse(k) as number[][]).flat()).size>1?v:0),0)});if(geometries.length>maxGeometries)return {geometries:[],enumeration_truncated:true};
 }}}return {geometries,enumeration_truncated:false};
}
