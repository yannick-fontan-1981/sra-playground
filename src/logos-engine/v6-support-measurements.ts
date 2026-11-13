/** Exact public geometry used by the transferred V6 SupportNavigation.
 * Source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e; no role is inferred here.
 */
import { geometricComponents, v6Canonical, validateRows } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';
export type SupportRecord = Record<string, any>;
export type RC = readonly [number, number];
export const supportSame = (a: unknown, b: unknown): boolean => v6Canonical(a) === v6Canonical(b);
export const supportKey = (p: readonly number[]): string => p.join(',');
export const supportPoint = (p: string): number[] => p.split(',').map(Number);
export function supportCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) { for (let i=0;i<Math.min(a.length,b.length);i++) { const c=supportCompare(a[i],b[i]); if(c)return c; } return a.length-b.length; }
  return a < b ? -1 : a > b ? 1 : 0;
}
// Source V5 component records are immutable. Reuse only an exact, validated
// raster-content key; never trust the identity of a caller-owned mutable array.
// The eight-entry LRU is fixed-size and cannot grow with episode history.
const componentCache = new Map<string, readonly SupportRecord[]>();
function freezeMeasurement<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freezeMeasurement(child);Object.freeze(value);}return value;
}
/** Reuse the native component extraction; retain V5 row/column IDs. */
export function supportParts(rows: NativeRows, connectivity: 4 | 8 = 4): SupportRecord[] {
  if(connectivity!==4&&connectivity!==8)throw new TypeError('Connectivity must be 4 or 8');
  validateRows(rows);const rasterKey=(connectivity===4?'':'8:')+JSON.stringify(rows),cached=componentCache.get(rasterKey);
  if(cached){componentCache.delete(rasterKey);componentCache.set(rasterKey,cached);return [...cached];}
  const instances=new Map<string,number>(),hashes=new Map<string,string>();
  const measured=geometricComponents(rows,connectivity).map(c=>{
    const [left,top,right,bottom]=c.bbox,height=bottom-top+1,width=right-left+1;
    const relative_pixels=c.mask.map(([x,y])=>[y,x]).sort(supportCompare),pixels=relative_pixels.map(([r,s])=>[top+r!,left+s!]);
    const key=v6Canonical(relative_pixels),instance=(instances.get(key)??0)+1;instances.set(key,instance);
    const hash=hashes.get(key)??symbolicDigest(relative_pixels).slice(0,8);hashes.set(key,hash);
    return {component_id:`${connectivity===4?'block':'zone'}.shape_${height}x${width}.area_${c.area}.pattern_${hash}.instance_${String(instance).padStart(3,'0')}`,
      value:c.color,pixels,relative_pixels,bbox:{top,left,right,bottom,height,width},area:c.area,
      touches_frame_boundary:top===0||left===0||bottom===rows.length-1||right===rows[0]!.length-1,schema_version:'yf_arc3_v5.component_description.v1'};
  });
  freezeMeasurement(measured);componentCache.set(rasterKey,measured);if(componentCache.size>8)componentCache.delete(componentCache.keys().next().value!);return [...measured];
}
export const supportBox = (c: SupportRecord): number[] => [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom];
export const supportSignature = (c: SupportRecord): number[][] => c.pixels.map(([r,s]:number[])=>[r!-c.bbox.top,s!-c.bbox.left,c.value]).sort(supportCompare);
export const supportShape = (c: SupportRecord): number[][] => supportSignature(c).map(([r,s])=>[r!,s!]);
export const supportAssociation = (c: SupportRecord,role:string): SupportRecord => ({term_ref:`association.${role}.${symbolicDigest(supportSignature(c)).slice(0,16)}`,normalized_valued_pixels:supportSignature(c)});
export const pointSet = (points: readonly (readonly number[])[]): Set<string> => new Set(points.map(supportKey));
export const sortedPoints = (points: Set<string>): number[][] => [...points].map(supportPoint).sort(supportCompare);
export const intersects = (a:Set<string>,b:Set<string>):boolean => [...a].some(p=>b.has(p));
export const contained = (a:Set<string>,b:Set<string>):boolean => [...a].every(p=>b.has(p));
export function rectangularPoints(box:SupportRecord):number[][] {
  const points:number[][]=[];for(let r=box.top;r<=box.bottom;r++)for(let c=box.left;c<=box.right;c++)points.push([r,c]);return points;
}

/** V5 appearance.measure_orthogonal_bands: orientation and each band retained. */
export function measureSupportOrthogonalBands(points:readonly (readonly number[])[]):SupportRecord {
  if(!points.length)throw new TypeError('Orthogonal bands need a nonempty silhouette');
  const top=Math.min(...points.map(p=>p[0]!)),left=Math.min(...points.map(p=>p[1]!));
  const normalized=points.map(p=>[p[0]!-top,p[1]!-left]);
  const mask=pointSet(normalized),height=Math.max(...normalized.map(p=>p[0]!))+1,width=Math.max(...normalized.map(p=>p[1]!))+1;
  const rows=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>mask.has(supportKey([r,c]))));
  const rowStarts=rows.flatMap((row,i)=>i===0||!supportSame(row,rows[i-1])?[i]:[]);
  const columns=Array.from({length:width},(_,c)=>rowStarts.map(r=>rows[r]![c]));
  const colStarts=columns.flatMap((col,i)=>i===0||!supportSame(col,columns[i-1])?[i]:[]);
  const reduced=rowStarts.map(r=>colStarts.map(c=>rows[r]![c]));
  return {measurement_contract:'yf_arc3_v5.orthogonal_silhouette_bands.v1',oriented_signature:symbolicDigest(reduced),
    band_rows:rowStarts.length,band_columns:colStarts.length,row_thicknesses:rowStarts.map((a,i)=>(rowStarts[i+1]??height)-a),
    column_thicknesses:colStarts.map((a,i)=>(colStarts[i+1]??width)-a),height,width};
}
export function enclosedSupportPixels(points:readonly (readonly number[])[]):number[][] {
  if(!points.length)return [];
  const top=Math.min(...points.map(p=>p[0]!)),bottom=Math.max(...points.map(p=>p[0]!)),left=Math.min(...points.map(p=>p[1]!)),right=Math.max(...points.map(p=>p[1]!));
  const mask=pointSet(points),outside=new Set<string>();
  for(let r=top;r<=bottom;r++)for(const c of [left,right])if(!mask.has(supportKey([r,c])))outside.add(supportKey([r,c]));
  for(const r of [top,bottom])for(let c=left;c<=right;c++)if(!mask.has(supportKey([r,c])))outside.add(supportKey([r,c]));
  const pending=[...outside];while(pending.length){const [r,c]=supportPoint(pending.pop()!);for(const p of [[r!-1,c!],[r!+1,c!],[r!,c!-1],[r!,c!+1]]){
    const k=supportKey(p);if(p[0]!>=top&&p[0]!<=bottom&&p[1]!>=left&&p[1]!<=right&&!mask.has(k)&&!outside.has(k)){outside.add(k);pending.push(k);}
  }}
  const result:number[][]=[];for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++)if(!mask.has(supportKey([r,c]))&&!outside.has(supportKey([r,c])))result.push([r,c]);return result;
}

/** navigation_transition_measurements.measure_current_translation_underlays. */
export function measureCurrentSupportUnderlays(before:NativeRows|null,after:NativeRows):SupportRecord[] {
  if(!before?.length||!after.length||before.length!==after.length)return [];
  const width=after[0]!.length;if(after.length*width>4096||[...before,...after].some(r=>r.length!==width))return [];
  const groups:Map<string,{signature:any[];parts:SupportRecord[]}>[]=[];
  for(const frame of [before,after]){
    const parts=supportParts(frame);if(parts.length>256)return [];
    const grouped=new Map<string,{signature:any[];parts:SupportRecord[]}>();
    for(const c of parts){const signature=[c.value,supportShape(c)],key=v6Canonical(signature),entry=grouped.get(key)??{signature,parts:[]};entry.parts.push(c);grouped.set(key,entry);}groups.push(grouped);
  }
  const translated:SupportRecord[]=[];
  for(const [key,entry] of [...groups[1]!].sort((a,b)=>supportCompare(a[1].signature,b[1].signature))){
    const prior=groups[0]!.get(key)?.parts??[];if(entry.parts.length!==1||prior.length!==1)continue;
    const a=prior[0]!,b=entry.parts[0]!,dr=b.bbox.top-a.bbox.top,dc=b.bbox.left-a.bbox.left;if(dr===0&&dc===0)continue;
    const interior=enclosedSupportPixels(a.pixels),follows=interior.every(([r,c])=>before[r!]![c!]===after[r!+dr]![c!+dc]);
    const oldMask=pointSet(follows?[...a.pixels,...interior]:a.pixels),newMask=pointSet(sortedPoints(oldMask).map(([r,c])=>[r!+dr,c!+dc]));
    translated.push({a,b,delta:[dr,dc],oldMask,newMask});
  }
  const movingPrior=new Set<string>(translated.flatMap(t=>[...t.oldMask]));
  if(translated.length>64)return [];
  return translated.map(({b,delta,newMask})=>({component_ref:b.component_id,bbox:[b.bbox.top,b.bbox.left,b.bbox.bottom,b.bbox.right],translation_delta:delta,
    observed_underlay_pixels:sortedPoints(newMask).filter(p=>!movingPrior.has(supportKey(p))).map(([r,c])=>[r,c,before[r!]![c!]]),
    underlay_values:[...new Set(rectangularPoints(b.bbox).map(([r,c])=>before[r!]![c!]))].sort(supportCompare)}));
}

export function transformSupportPoints(points:readonly (readonly number[])[],command:SupportRecord):number[][]|null {
  if(command.kind==='TRANSLATE')return command.delta==null?null:points.map(([r,c])=>[r!+command.delta[0],c!+command.delta[1]]).sort(supportCompare);
  if(command.pivot==null||command.quarter_turns==null)return null;
  return points.map(([r,c])=>{let dr=r!-command.pivot[0],dc=c!-command.pivot[1];for(let q=0;q<command.quarter_turns;q++)[dr,dc]=[dc,-dr];return [command.pivot[0]+dr,command.pivot[1]+dc];}).sort(supportCompare);
}

/** All candidate centres and all exact quarter-turn fits are retained. */
export function measureRemoteSupportTransition(before:NativeRows,after:NativeRows,beforeComponents:readonly SupportRecord[],afterComponents:readonly SupportRecord[],control:SupportRecord,actor:SupportRecord,maximumPixels=4096,maximumPivots=32):SupportRecord {
  const height=before.length,width=before[0]!.length;if(height*width>maximumPixels||after.length!==height||[...before,...after].some(r=>r.length!==width))throw new TypeError('navigation transition frame bound/shape mismatch');
  const h=actor.bbox.height,w=actor.bbox.width,phaseR=actor.bbox.top%h,phaseC=actor.bbox.left%w;
  const excluded=pointSet([...actor.pixels,...rectangularPoints(control.bbox)]),groups=new Map<string,{a:number[];b:number[];positions:number[][]}>();
  for(let r=phaseR;r<=height-h;r+=h)for(let c=phaseC;c<=width-w;c+=w){
    const pixels:number[][]=[];for(let dr=0;dr<h;dr++)for(let dc=0;dc<w;dc++)pixels.push([r+dr,c+dc]);
    if(pixels.some(p=>excluded.has(supportKey(p))))continue;
    const a=pixels.map(([rr,cc])=>before[rr!]![cc!]!),b=pixels.map(([rr,cc])=>after[rr!]![cc!]!);if(supportSame(a,b))continue;
    const key=v6Canonical([a,b]),group=groups.get(key)??{a,b,positions:[]};group.positions.push([r,c]);groups.set(key,group);
  }
  const cellRows=[...groups.values()].sort((a,b)=>supportCompare([a.a,a.b],[b.a,b.b])).map(g=>({before_pattern:g.a,after_pattern:g.b,cell_height:h,cell_width:w,cell_positions:g.positions,cell_count:g.positions.length}));
  const changed=new Set<string>();for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(before[r]![c]!==after[r]![c]&&!excluded.has(supportKey([r,c])))changed.add(supportKey([r,c]));
  const afterKeys=new Set(afterComponents.map(c=>v6Canonical([c.value,c.pixels]))),actorPixels=pointSet(actor.pixels);
  const persistent=beforeComponents.filter(c=>afterKeys.has(v6Canonical([c.value,c.pixels]))&&c.area>1&&!intersects(pointSet(c.pixels),excluded)&&
    c.area+sortedPoints(actorPixels).filter(([r,s])=>r!>=c.bbox.top&&r!<=c.bbox.bottom&&s!>=c.bbox.left&&s!<=c.bbox.right).length===c.bbox.height*c.bbox.width);
  const complete=persistent.length<=maximumPivots,fitRows:SupportRecord[]=[];
  if(persistent.length&&complete){
    const values=[...new Set(sortedPoints(changed).flatMap(([r,c])=>[before[r!]![c!],after[r!]![c!]]))].sort(supportCompare);
    for(const value of values){
      const masks=[beforeComponents,afterComponents].map(cs=>pointSet(cs.filter(c=>c.value===value&&intersects(pointSet(c.pixels),changed)&&!intersects(pointSet(c.pixels),excluded)).flatMap(c=>c.pixels)));
      const a=masks[0]!,b=masks[1]!;if(!a.size||!b.size||a.size!==b.size||contained(a,b))continue;
      const beforeTwice=sortedPoints(a).map(([r,c])=>[2*r!,2*c!]),afterTwice=sortedPoints(b).map(([r,c])=>[2*r!,2*c!]);
      const candidates=persistent.map((c,i)=>({c,ref:`component:${i}`})).sort((x,y)=>supportCompare(x.ref,y.ref));
      for(const {c:landmark} of candidates){const centre=[landmark.bbox.top+landmark.bbox.bottom,landmark.bbox.left+landmark.bbox.right];
        for(const turn of [1,2,3])if(supportSame(transformSupportPoints(beforeTwice,{kind:'QUARTER_TURN',pivot:centre,quarter_turns:turn}),afterTwice))fitRows.push({
          changed_value:value,control_value_equals_changed_value:value===control.value,quarter_turns_clockwise:turn,pivot_centre_twice:centre,pivot_value:landmark.value,
          pivot_height:landmark.bbox.height,pivot_width:landmark.bbox.width,pivot_occluded_pixel_count:landmark.bbox.height*landmark.bbox.width-landmark.area,
          pivot_outside_transformed_masks:!pointSet(beforeTwice).has(supportKey(centre))&&!pointSet(afterTwice).has(supportKey(centre)),
          before_relative_pixels_twice:beforeTwice.map(([r,c])=>[r!-centre[0]!,c!-centre[1]!]).sort(supportCompare),
          after_relative_pixels_twice:afterTwice.map(([r,c])=>[r!-centre[0]!,c!-centre[1]!]).sort(supportCompare)});
      }
    }
  }
  return {cell_transition_rows:cellRows,rigid_fit_rows:fitRows,rigid_fit_enumeration_complete:complete,persistent_component_count:persistent.length,coordinate_scale:2};
}

const containsBox=(a:readonly number[],b:readonly number[]):boolean=>a[0]!<=b[0]!&&a[1]!<=b[1]!&&a[2]!>=b[2]!&&a[3]!>=b[3]!;
export function supportEnclosingContours(observation:SupportRecord,body:SupportRecord):number[]{return observation.entities.filter((e:SupportRecord)=>{
  const [l,t,r,b]=e.bbox,w=r-l+1,h=b-t+1;return containsBox(e.bbox,body.bbox)&&w>2*(body.bbox[2]-body.bbox[0]+1)&&h>2*(body.bbox[3]-body.bbox[1]+1)&&e.area<w*h/4;
}).map((e:SupportRecord)=>e.palette_value);}
export function supportUnchanged(entity:SupportRecord,observation:SupportRecord):boolean{return observation.entities.some((e:SupportRecord)=>supportSame(e.signature,entity.signature)&&supportSame(e.bbox,entity.bbox));}
export function supportVisibleCompatible(source:SupportRecord,candidate:SupportRecord,first:NativeRows,second:NativeRows,before:SupportRecord,after:SupportRecord,bodyBefore:SupportRecord|null=null,bodyAfter:SupportRecord|null=null):SupportRecord|null{
  const value=source.palette_value,old=source.bbox,next=candidate.bbox,occlusions=[bodyBefore?.bbox??null,bodyAfter?.bbox??null],contours=[bodyBefore?supportEnclosingContours(before,bodyBefore):[],bodyAfter?supportEnclosingContours(after,bodyAfter):[]];
  const shifts=sortedPoints(pointSet([[next[0]-old[0],next[1]-old[1]],[next[2]-old[2],next[1]-old[1]],[next[0]-old[0],next[3]-old[3]],[next[2]-old[2],next[3]-old[3]]]));
  const accepted:SupportRecord[]=[];
  const visible=(rows:NativeRows,x:number,y:number,box:number[]|null,values:number[])=>x>=0&&x<rows[0]!.length&&y>=0&&y<rows.length&&(!box||!(x>=box[0]!&&x<=box[2]!&&y>=box[1]!&&y<=box[3]!))&&!values.includes(rows[y]![x]!);
  for(const [dx0,dy0] of shifts){const dx=dx0!,dy=dy0!,l=Math.min(old[0],next[0]-dx),t=Math.min(old[1],next[1]-dy),r=Math.max(old[2],next[2]-dx),b=Math.max(old[3],next[3]-dy);let background=0,hidden=0,contradicted=false;const matches:number[][]=[];
    for(let y=t;y<=b&&!contradicted;y++)for(let x=l;x<=r;x++){
      const xx=x+dx,yy=y+dy;if(!visible(first,x,y,occlusions[0]!,contours[0]!)||!visible(second,xx,yy,occlusions[1]!,contours[1]!)){hidden++;continue;}
      const a=first[y]![x]===value,c=second[yy]![xx]===value;if(a!==c){contradicted=true;break;}if(a)matches.push([x,y]);else background++;
    }
    if(!contradicted&&new Set(matches.map(p=>p[0])).size>1&&new Set(matches.map(p=>p[1])).size>1)accepted.push({translation:[dx,dy],matching_visible_foreground:matches,matching_visible_background_count:background,unobservable_points:hidden});
  }
  return accepted.length?{status:'visible_shape_compatible_under_bounded_translation',alternatives:accepted,scope:'visible_part_only_occluded_part_unknown'}:null;
}
export function supportResidualCorrespondences(before:SupportRecord,after:SupportRecord,first:NativeRows,second:NativeRows):SupportRecord{
  const groups=new Map<string,{signature:any;left:SupportRecord[];right:SupportRecord[]}>(),stationary:SupportRecord[]=[];
  const add=(e:SupportRecord,side:'left'|'right')=>{const key=v6Canonical(e.signature),g=groups.get(key)??{signature:e.signature,left:[],right:[]};g[side].push(e);groups.set(key,g);};
  for(const e of before.entities)if(supportUnchanged(e,after))stationary.push(e);else add(e,'left');
  for(const e of after.entities)if(!supportUnchanged(e,before))add(e,'right');
  const candidates:SupportRecord[]=[],unresolved:SupportRecord[]=[];
  for(const {signature,left,right}of groups.values()){
    if(left.length!==1||right.length!==1){unresolved.push({signature,before_count:left.length,after_count:right.length,reason:'multiple_or_missing_residuals'});continue;}
    const proof=supportVisibleCompatible(left[0]!,right[0]!,first,second,before,after);if(!proof){unresolved.push({signature,before_count:1,after_count:1,reason:'insufficient_visible_shape; reveal_cover_or_relocation_remain_open'});continue;}
    candidates.push({before:left[0],after:right[0],visible_comparison:proof,stationary_same_signature:stationary.filter(e=>supportSame(e.signature,signature)),identity_status:'conditional_visible_correspondence; hidden_exchange_unknown'});
  }return {stationary,candidates,unresolved};
}

export function currentReciprocalSupportFields(effects:readonly SupportRecord[],rows:NativeRows,epoch:number,height:number,width:number):SupportRecord[]{
  const candidates=new Map<string,SupportRecord>();
  for(const effect of effects){if(!effect.before.includes(`:epoch:${epoch}:`))continue;const changes=effect.typed_transition_measurements.cell_transition_rows;
    const swaps=new Map<string,number[]>();for(const r of changes)if(r.cell_height===height&&r.cell_width===width&&new Set(r.before_pattern).size>1&&supportSame([...r.before_pattern].sort(supportCompare),[...r.after_pattern].sort(supportCompare))&&!supportSame(r.before_pattern,r.after_pattern))swaps.set(v6Canonical(r.before_pattern),r.after_pattern);
    for(const change of changes){const first=change.before_pattern,second=change.after_pattern;if(!supportSame(swaps.get(v6Canonical(first))??null,second)||!supportSame(swaps.get(v6Canonical(second))??null,first))continue;
      for(const [top,left]of change.cell_positions){const pattern:number[]=[];for(let r=0;r<height;r++)for(let c=0;c<width;c++)pattern.push(rows[top+r]![left+c]!);if(!supportSame(pattern,first)&&!supportSame(pattern,second))continue;
        const key=v6Canonical([effect.control_association_ref,top,left]);candidates.set(key,{control_ref:effect.control_association_ref,bbox:[left,top,left+width-1,top+height-1],pattern,alternatives:[first,second],evidence:[effect.before,effect.after]});
      }
    }
  }return [...candidates.values()];
}
export function addressedSupportComponent(field:SupportRecord):SupportRecord{
  const [left,top,right,bottom]=field.bbox,width=right-left+1,height=bottom-top+1,box={left,top,right,bottom,width,height},pixels=rectangularPoints(box);
  return {component_id:'addressed_observed_field',bbox:box,pixels,valued_pixels:pixels.map(([r,c],i)=>[r,c,field.pattern[i]]),value:null,area:pixels.length};
}
export function supportFieldAssociation(field:SupportRecord):SupportRecord{
  const width=field.bbox[2]-field.bbox[0]+1;return {term_ref:'association.addressed_field',normalized_valued_pixels:field.pattern.map((v:number,i:number)=>[Math.floor(i/width),i%width,v])};
}
export function measureSupportTranslationLattices(boxes:readonly SupportRecord[],translations:readonly (readonly number[])[]):number[][]{
  if(!boxes.length||!translations.length||boxes.some(b=>b.height<=0||b.width<=0))return [];
  const extents=new Map(boxes.map(b=>{const a=[b.height,b.width,b.top%b.height,b.left%b.width];return[v6Canonical(a),a];}));if(extents.size!==1)return [];
  const [h,w,rp,cp]=[...extents.values()][0]!;const steps=sortedPoints(pointSet(translations));
  if(steps.some(p=>!pointSet([[-h!,0],[h!,0],[0,-w!],[0,w!]]).has(supportKey(p)))||!steps.some(p=>p[0])||!steps.some(p=>p[1]))return [];
  return [[h!,w!,rp!,cp!]];
}
export function measureSupportValuedMaskPoses(frame:NativeRows,signature:readonly (readonly number[])[],turns:readonly number[],maximumPixels:number,maximumMatches:number):SupportRecord[]{
  if(!frame.length||!frame[0]!.length||frame.length*frame[0]!.length>maximumPixels||!signature.length||signature.length>maximumPixels||pointSet(signature.map(p=>p.slice(0,2))).size!==signature.length)return [];
  const poses=new Map<string,number[][]>();for(const q of turns){if(!Number.isInteger(q)||q<0||q>3)throw new TypeError('quarter-turn measurement domain is invalid');let points=signature.map(p=>[...p]);for(let i=0;i<q;i++)points=points.map(([r,c,v])=>[-c!,r!,v!]);const top=Math.min(...points.map(p=>p[0]!)),left=Math.min(...points.map(p=>p[1]!));points=points.map(([r,c,v])=>[r!-top,c!-left,v!]).sort(supportCompare);poses.set(v6Canonical(points),points);}
  const found=new Map<string,{key:any[];component:SupportRecord}>();for(const pose of [...poses.values()].sort(supportCompare)){
    const height=Math.max(...pose.map(p=>p[0]!))+1,width=Math.max(...pose.map(p=>p[1]!))+1;if(height*width>maximumPixels)return [];
    const values=new Set(pose.map(p=>p[2])),occupied=pointSet(pose.map(p=>p.slice(0,2))),missing:number[][]=[];for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(!occupied.has(supportKey([r,c])))missing.push([r,c]);
    for(let top=0;top<=frame.length-height;top++)for(let left=0;left<=frame[0]!.length-width;left++){
      if(!pose.every(([r,c,v])=>frame[top+r!]![left+c!]===v)||missing.some(([r,c])=>values.has(frame[top+r!]![left+c!])))continue;
      const pixels=pose.map(([r,c])=>[top+r!,left+c!]),key=[top,left,pose];found.set(v6Canonical(key),{key,component:{component_id:'support.valued_pose.'+symbolicDigest(key),bbox:{top,left,bottom:top+height-1,right:left+width-1,height,width},pixels,area:pixels.length,value:values.size===1?[...values][0]:null,valued_pixels:pose.map(([r,c,v])=>[top+r!,left+c!,v])}});
      if(found.size>maximumMatches)throw new TypeError('valued-mask measurement match bound exceeded');
    }
  }return [...found.values()].sort((a,b)=>supportCompare(a.key,b.key)).map(x=>x.component);
}
