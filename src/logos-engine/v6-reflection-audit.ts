/** Exact bounded object/layer audit consumed by ReflectedCover. This is a
 * measurement of caller-declared roles, never an assignment of game semantics.
 */
import { supportParts, supportCompare as compare, supportSame as same, supportKey as key, supportPoint as point, pointSet, sortedPoints } from './v6-support-measurements.ts';
import { symbolicDigest as digest } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';
type R=Record<string,any>;
const intersection=(a:Set<string>,b:Set<string>):Set<string>=>new Set([...a].filter(p=>b.has(p)));
const difference=(a:Set<string>,b:Set<string>):Set<string>=>new Set([...a].filter(p=>!b.has(p)));
export function reflectionConnectedSets(points:Set<string>):Set<string>[] {
 const unseen=new Set(points),groups:Set<string>[]=[];
 while(unseen.size){const first=sortedPoints(unseen)[0]!,start=key(first),group=new Set([start]),pending=[start];unseen.delete(start);
  while(pending.length){const [a,b]=point(pending.pop()!);for(const p of [[a!-1,b!],[a!+1,b!],[a!,b!-1],[a!,b!+1]]){const k=key(p);if(unseen.delete(k)){group.add(k);pending.push(k);}}}groups.push(group);
 }return groups;
}
function occupied(rows:NativeRows,color:number,q:number,rp:number,cp:number,bounds:number[]):Set<string>{
 const [top,left,bottom,right]=bounds as [number,number,number,number],cells=new Set<string>(),mod=(n:number)=>((n%q)+q)%q;
 for(let y=top+mod(rp-top);y<=bottom;y+=q)for(let x=left+mod(cp-left);x<=right;x+=q){let found=false;for(let r=y;r<Math.min(y+q,rows.length)&&!found;r++)for(let c=x;c<Math.min(x+q,rows[0]!.length);c++)if(rows[r]![c]===color){found=true;break;}if(found)cells.add(key([(y-rp)/q,(x-cp)/q]));}return cells;
}
function crossing(cells:Set<string>,minRow:number,minCol:number):[number,number]|null{
 const rs=new Map<number,number[]>(),cs=new Map<number,number[]>();for(const [r,c]of sortedPoints(cells)){rs.set(r!,[...(rs.get(r!)??[]),c!]);cs.set(c!,[...(cs.get(c!)??[]),r!]);}
 const pairs:number[][]=[];for(const [r,columns]of rs){const span=Math.max(...columns)-Math.min(...columns)+1;if(span<minRow)continue;for(const [c,rows]of cs){const h=Math.max(...rows)-Math.min(...rows)+1;if(h>=minCol&&Math.min(...columns)<=c&&c<=Math.max(...columns)&&Math.min(...rows)<=r&&r<=Math.max(...rows))pairs.push([r,c,span+h]);}}
 const best=Math.max(0,...pairs.map(p=>p[2]!)),hits=pairs.filter(p=>p[2]===best);return hits.length===1?[hits[0]![0]!,hits[0]![1]!]:null;
}
export function measureReflectionAudit(rows:NativeRows,args:R):R{
 const q=args.quantum;if(q<=0)return{};const components=supportParts(rows);let rp=args.row_phase,cp=args.col_phase;
 if(rp==null||cp==null){const values=new Set([args.support_palette_value,args.carrier_palette_value,...(args.direct_body_palette_values??[])]),rs=new Map<number,number>(),cs=new Map<number,number>();
  for(const c of components)if(values.has(c.value)&&!c.touches_frame_boundary){const r=c.bbox.top%q,s=c.bbox.left%q;rs.set(r,(rs.get(r)??0)+c.area);cs.set(s,(cs.get(s)??0)+c.area);}
  const phases=(map:Map<number,number>)=>{const n=Math.max(0,...map.values());return[...map].filter(([,v])=>v===n).map(([k])=>k).sort(compare);};
  if(rp==null){const ps=phases(rs);if(ps.length!==1)return{};rp=ps[0];}if(cp==null){const ps=phases(cs);if(ps.length!==1)return{};cp=ps[0];}
 }
 const frame=[0,0,rows.length-1,rows[0]!.length-1],measured=occupied(rows,args.support_palette_value,q,rp,cp,frame);let completed=pointSet(args.completed_cells??[]);const supportObjects:R[]=[];
 if(completed.size){for(const group of reflectionConnectedSets(completed)){const visible=intersection(measured,group);supportObjects.push({object_ref:'measurement.persistent_support_component.'+digest([args.support_component_ref??null,args.support_palette_value,sortedPoints(group)]).slice(0,16),palette_value:args.support_palette_value,persistent_support_cells:sortedPoints(group),currently_visible_palette_cells:sortedPoints(visible),currently_nonvisible_support_cells:sortedPoints(difference(group,visible)),persistent_cell_count:group.size,currently_visible_cell_count:visible.size});}}
 else{for(const c of components){const b=c.bbox;if(c.value!==args.support_palette_value||b.height<2*q||b.width<2*q||b.height%q||b.width%q)continue;const cells=occupied(rows,c.value,q,rp,cp,[b.top,b.left,b.bottom,b.right]);if(cells.size)supportObjects.push({object_ref:c.component_id,palette_value:args.support_palette_value,persistent_support_cells:sortedPoints(cells),currently_visible_palette_cells:sortedPoints(cells),currently_nonvisible_support_cells:[],persistent_cell_count:cells.size,currently_visible_cell_count:cells.size});}completed=pointSet(supportObjects.flatMap(o=>o.persistent_support_cells));}
 if(!completed.size||!supportObjects.length)return{};
 const carrier=occupied(rows,args.carrier_palette_value,q,rp,cp,frame);let row:number,col:number;
 if(args.carrier_row_axis_coordinate_twice==null||args.carrier_col_axis_coordinate_twice==null){const ps=sortedPoints(completed),a=crossing(carrier,Math.max(...ps.map(p=>p[1]!))-Math.min(...ps.map(p=>p[1]!))+1,Math.max(...ps.map(p=>p[0]!))-Math.min(...ps.map(p=>p[0]!))+1);if(!a)return{};[row,col]=a;}else{row=Math.floor(args.carrier_row_axis_coordinate_twice/2);col=Math.floor(args.carrier_col_axis_coordinate_twice/2);}
 const horizontal=new Set([...carrier].filter(p=>point(p)[0]===row)),vertical=new Set([...carrier].filter(p=>point(p)[1]===col)),shared=intersection(horizontal,vertical);
 const axes=[['horizontal',horizontal],['vertical',vertical]].map(([orientation,points])=>{const cells=points as Set<string>;return{object_ref:'measurement.lattice_line.'+digest([args.carrier_palette_value,orientation,sortedPoints(cells)]).slice(0,16),orientation,palette_value:args.carrier_palette_value,support_cells:sortedPoints(cells),cell_count:cells.size,shared_with_orthogonal_line_cells:sortedPoints(shared),shared_with_support_cells:sortedPoints(intersection(cells,completed)),matches_action_conditioned_current_control:!!(orientation==='horizontal'&&args.current_focus_horizontal_axis_like||orientation==='vertical'&&args.current_focus_vertical_axis_like)};});
 const values=new Set(args.direct_body_palette_values??[]),bodies:R[]=[];
 for(const c of components){const b=c.bbox;if(c.area<=1||c.touches_frame_boundary||[args.support_palette_value,args.carrier_palette_value].includes(c.value)||values.size&&!values.has(c.value)||b.height<2*q||b.width<2*q||b.height%q||b.width%q)continue;
  const cells=occupied(rows,c.value,q,rp,cp,[b.top,b.left,b.bottom,b.right]);if(cells.size<2||cells.size>completed.size)continue;const ps=sortedPoints(cells),r=Math.min(...ps.map(p=>p[0]!)),s=Math.min(...ps.map(p=>p[1]!));bodies.push({object_ref:c.component_id,palette_value:c.value,support_cells:ps,cell_count:cells.size,bbox_cells:[r,s,Math.max(...ps.map(p=>p[0]!)),Math.max(...ps.map(p=>p[1]!))],normalized_cell_offsets:ps.map(p=>[p[0]!-r,p[1]!-s]).sort(compare),matches_action_conditioned_current_control:same(args.current_focus_bbox_tuple??null,[b.top,b.left,b.bottom,b.right])});
 }
 const layers:R[]=[];for(const body of bodies){const cells:number[][]=body.support_cells;for(const [transform,ps]of [['reflection.horizontal_line',cells.map(([r,c])=>[2*row-r!,c!])],['reflection.vertical_line',cells.map(([r,c])=>[r!,2*col-c!])],['reflection.horizontal_then_vertical',cells.map(([r,c])=>[2*row-r!,2*col-c!])]] as [string,number[][]][]){const layer=pointSet(ps);layers.push({object_ref:'measurement.transformed_layer.'+digest([body.object_ref,transform,sortedPoints(layer)]).slice(0,16),source_object_ref:body.object_ref,transform_ref:transform,support_cells:sortedPoints(layer),cell_count:layer.size,shared_with_support_cells:sortedPoints(intersection(layer,completed))});}}
 const objects=([...axes,...supportObjects,...bodies,...layers] as R[]).map(o=>({ref:o.object_ref,cells:pointSet(o.support_cells??o.persistent_support_cells??[])})),all=new Set(objects.flatMap(o=>[...o.cells]));
 return{orthogonal_reflection_lattice_axis_object_measurements:axes,orthogonal_reflection_lattice_support_object_measurements:supportObjects,orthogonal_reflection_lattice_body_object_measurements:bodies,orthogonal_reflection_lattice_transformed_layer_measurements:layers,orthogonal_reflection_lattice_overlap_memberships:sortedPoints(all).flatMap(p=>{const refs=objects.filter(o=>o.cells.has(key(p))).map(o=>o.ref);return refs.length>1?[[p,refs]]:[];}),orthogonal_reflection_lattice_direct_body_value_binding_present:values.size>0};
}
