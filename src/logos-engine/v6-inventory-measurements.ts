/** Exact consumed V5/V6 measurements for ObservedInventory.
 * The probe domain is the JSON projection constructed by CellProjection and
 * endpoints.py: one current body, current/known translations, measured cells
 * and optional visited boxes. Unused production InteractionProbe branches
 * are not replaced with heuristic authority. */
import { symbolicDigest } from './v6-hash.ts';
import { supportParts, supportCompare } from './v6-support-measurements.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
export type R = Record<string, any>;
export const digest = symbolicDigest;
export const clone = <T>(v:T):T => structuredClone(v);
export const key = (p:readonly number[]):string => p.join(',');
export const xybox = (b:R):number[] => [b.left,b.top,b.right,b.bottom];
export const box = (p:readonly number[]):R => ({left:p[0],top:p[1],right:p[2],bottom:p[3],width:p[2]!-p[0]!+1,height:p[3]!-p[1]!+1});
export const overlap = (a:R,b:R):boolean => !(a.bottom<b.top||b.bottom<a.top||a.right<b.left||b.right<a.left);
export const enclosed = (a:R,b:R):boolean => b.top<=a.top&&a.bottom<=b.bottom&&b.left<=a.left&&a.right<=b.right;
export const patch = (rows:NativeRows,b:readonly number[]):number[][] => rows.slice(b[1],b[3]!+1).map(r=>[...r.slice(b[0],b[2]!+1)]);
export const detect_components = (rows:NativeRows,connectivity:4|8=4):R => ({components:supportParts(rows,connectivity),schema_version:'yf_arc3_v5.component_extraction_result.v1'});
export function unique(obs:R):R {const counts=new Map<string,number>();for(const e of obs.entities)counts.set(e.signature,(counts.get(e.signature)??0)+1);return Object.fromEntries(obs.entities.filter((e:R)=>counts.get(e.signature)===1).map((e:R)=>[e.signature,e]));}
export function find_body(obs:R,signature:string|null):R|null{return signature===null?null:unique(obs)[signature]??null;}
export function moved_core(before:R,after:R,minimum_area=4,preferred_minimum_area:number|null=null):R|null{
 const a=unique(before),b=unique(after);let moving:R[]=[];
 for(const signature of Object.keys(a)){if(!Object.hasOwn(b,signature))continue;const f=a[signature],s=b[signature],delta=[(s.bbox[0]+s.bbox[2]-f.bbox[0]-f.bbox[2])/2,(s.bbox[1]+s.bbox[3]-f.bbox[1]-f.bbox[3])/2];if(same(delta,[0,0])||f.area<minimum_area)continue;moving.push({signature,before_bbox:f.bbox,bbox:s.bbox,delta,area:f.area,palette_value:f.palette_value});}
 if(preferred_minimum_area!==null){const preferred=moving.filter(v=>v.area>=preferred_minimum_area);if(preferred.length)moving=preferred;}
 const cores=moving.filter(v=>!moving.some(o=>o!==v&&enclosed(box(o.bbox),box(v.bbox))&&!same(v.bbox,o.bbox)&&same(v.delta,o.delta)));return cores.length===1?cores[0]!:null;
}
export function locate(rows:NativeRows,core:R):number[]|null{const candidates=supportParts(rows).filter(c=>c.value===core.palette_value&&c.area===core.area&&same(c.relative_pixels.map(([r,c]:number[])=>[c,r]).sort(supportCompare),[...core.offsets].sort(supportCompare)));return candidates.length===1?xybox(candidates[0]!.bbox):null;}
export function revalidate_frame(frame:R,rows:NativeRows,occluders:readonly number[][]=[],contour_values:readonly number[]=[]):R|null{
 const [l,t,r,b]=frame.bbox,measured:number[][]=[];let corners=0;if(l<0||t<0||b>=rows.length||r>=rows[0]!.length)return null;
 for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){if(x!==l&&x!==r&&y!==t&&y!==b)continue;if(occluders.some(([a,d,c,e])=>a!<=x&&x<=c!&&d!<=y&&y<=e!))continue;if(contour_values.includes(rows[y]![x]!))continue;const corner=(x===l||x===r)&&(y===t||y===b);if(rows[y]![x]!== (corner?frame.corner_value:frame.palette_value))return null;measured.push([x,y]);corners+=Number(corner);}
 return corners<2||measured.length<r-l+b-t?null:{...frame,current_unoccluded_perimeter:measured,status:occluders.length?'partially_occluded_frame_revalidated':'frame_revalidated'};
}
/** Complete bounded contour-domain result consumed by effect_scope.measure. */
export function measure_contour_domain(component:R):R|null{
 const b=component.bbox,h=b.height,w=b.width;if(h*w>4096||Math.min(h,w)<3||component.touches_frame_boundary)return null;
 const boundary=new Set<string>(component.relative_pixels.map(key)),outside=new Set<string>(),pending:number[][]=[];
 for(let r=-1;r<=h;r++)for(let c=-1;c<=w;c++)if(r===-1||r===h||c===-1||c===w){outside.add(key([r,c]));pending.push([r,c]);}
 for(let i=0;i<pending.length;i++){const [r,c]=pending[i]!;for(const p of [[r!-1,c!],[r!+1,c!],[r!,c!-1],[r!,c!+1]]){const k=key(p);if(p[0]!>=-1&&p[0]!<=h&&p[1]!>=-1&&p[1]!<=w&&!boundary.has(k)&&!outside.has(k)){outside.add(k);pending.push(p);}}}
 const interior:number[][]=[];for(let r=0;r<h;r++)for(let c=0;c<w;c++)if(!boundary.has(key([r,c]))&&!outside.has(key([r,c])))interior.push([r,c]);if(!interior.length)return null;
 const domain=new Set([...boundary,...interior.map(key)]),points=[...domain].map(s=>s.split(',').map(Number)).sort(supportCompare);
 const edge=points.filter(([r,c])=>[[r!-1,c!],[r!+1,c!],[r!,c!-1],[r!,c!+1]].some(p=>!domain.has(key(p)))),rectangle=domain.size===h*w;
 const radius=Math.max(...points.map(([r,c])=>(2*r!-h+1)**2+(2*c!-w+1)**2));let disk=h===w;
 for(let r=0;r<h;r++)for(let c=0;c<w;c++)if(domain.has(key([r,c]))!==((2*r-h+1)**2+(2*c-w+1)**2<=radius))disk=false;
 return {relative_boundary:component.relative_pixels,relative_interior:interior,relative_domain:points,closed_contour_present:true,exact_rectangular_domain:rectangle,contour_is_exact_domain_boundary:same([...boundary].sort(),edge.map(key).sort()),exact_circular_domain:disk&&!rectangle,boundary_inclusion_unknown:true,domain_digest:digest(points).slice(0,16)};
}
export function _unique_primitive_action_translation_quantum(value:R):number|null{
 const quanta=new Set<number>((value.known_action_translation_deltas??[]).filter(([_a,r,c]:any[])=>((r===0)!==(c===0))&&Math.abs(r||c)>1).map(([_a,r,c]:any[])=>Math.abs(r||c)));
 const observed=value.observed_input_aligned_action_translation,bodies=value.canonical_provisional_control_geometry_bboxes?.length?value.canonical_provisional_control_geometry_bboxes:value.input_aligned_entity_bboxes??[];
 if(observed){const [_a,r,c]=observed,q=Math.abs(r||c);if((r===0)!==(c===0)&&q>1&&(!bodies.length||bodies.length<=4&&Math.max(...bodies.map((b:R)=>b.bottom))-Math.min(...bodies.map((b:R)=>b.top))+1<=q&&Math.max(...bodies.map((b:R)=>b.right))-Math.min(...bodies.map((b:R)=>b.left))+1<=q))quanta.add(q);}
 if(!quanta.size)return null;const q=Math.min(...quanta);return [...quanta].every(x=>x%q===0)?q:null;
}
export function _action_quantized_route_grid_evidence_is_current(value:R):boolean{
 if(value.observed_input_aligned_action_translation!=null)return true;
 const directions=new Set((value.interface_action_translation_deltas??[]).filter(([_a,r,c]:any[])=>Math.abs(r)+Math.abs(c)===1).map(([a]:any[])=>a));
 return new Set((value.known_action_translation_deltas??[]).filter(([a,r,c]:any[])=>(!directions.size||directions.has(a))&&(r===0)!==(c===0)&&Math.abs(r||c)>1).map(([a]:any[])=>a)).size>=2;
}
export function _action_quantized_grid_candidate(rows:NativeRows,quantum:number,row_offset:number,col_offset:number,candidate_kind='action_centered'):R|null{
 const rs:number[]=[],cs:number[]=[];for(let r=row_offset;r<=rows.length-quantum;r+=quantum)rs.push(r);for(let c=col_offset;c<=rows[0]!.length-quantum;c+=quantum)cs.push(c);if(rs.length<2||cs.length<2)return null;
 const patterns=rs.flatMap(r=>cs.map(c=>patch(rows,[c,r,c+quantum-1,r+quantum-1]))),counts=new Map<string,number>();for(const p of patterns){const k=JSON.stringify(p);counts.set(k,(counts.get(k)??0)+1);}
 const cells=rs.flatMap((r,i)=>cs.map((c,j)=>{const p=patterns[i*cs.length+j]!,values=[...new Set(p.flat())].sort((a,b)=>a-b);return {row:i,col:j,bbox:box([c,r,c+quantum-1,r+quantum-1]),point:[r+Math.floor(quantum/2),c+Math.floor(quantum/2)],pattern_ref:'measurement.cell_pattern.'+digest(p).slice(0,16),palette_value_count:values.length,palette_values:values,pattern_occurrence_count:counts.get(JSON.stringify(p))};}));
 return {candidate_ref:'measurement.periodic_grid.'+candidate_kind+'.r'+row_offset+'.'+quantum+'.0.c'+col_offset+'.'+quantum+'.0',row_offset,col_offset,cell_height:quantum,cell_width:quantum,row_gap:0,col_gap:0,row_pitch:quantum,col_pitch:quantum,logical_rows:rs.length,logical_columns:cs.length,separator_consistency_ppm:0,repeated_pattern_count:[...counts.values()].filter(n=>n>1).length,distinct_pattern_count:counts.size,cells};
}
/** Materialize the original contract dump, excluding computed bbox properties. */
export function public_grid(grid:R):R{
 const out:R={row_boundary_contrast_ppm:0,col_boundary_contrast_ppm:0,row_proper_divisor_boundary_gain_line_ppm:0,col_proper_divisor_boundary_gain_line_ppm:0,clipped_cells:[],visible_row_range:null,visible_column_range:null,schema_version:'yf_arc3_v5.periodic_cell_grid_candidate.v1',...clone(grid)};
 out.cells=grid.cells.map((c:R)=>({...clone(c),bbox:{top:c.bbox.top,left:c.bbox.left,bottom:c.bbox.bottom,right:c.bbox.right},schema_version:'yf_arc3_v5.periodic_cell_description.v1'}));return out;
}
export function materialize_grid(rows:NativeRows,geometry:R):R{
 const patterns:number[][][]=[],positions:number[][]=[];for(let r=0;r<geometry.logical_rows;r++)for(let c=0;c<geometry.logical_columns;c++){const top=geometry.row_offset+r*geometry.row_pitch,left=geometry.col_offset+c*geometry.col_pitch;positions.push([r,c,top,left]);patterns.push(patch(rows,[left,top,left+geometry.cell_width-1,top+geometry.cell_height-1]));}
 const counts=new Map<string,number>();for(const p of patterns){const k=JSON.stringify(p);counts.set(k,(counts.get(k)??0)+1);}
 return {...geometry,cells:positions.map(([row,col,top,left],i)=>{const p=patterns[i]!,values=[...new Set(p.flat())].sort((a,b)=>a-b);return{row,col,bbox:box([left!,top!,left!+geometry.cell_width-1,top!+geometry.cell_height-1]),point:[top!+Math.floor(geometry.cell_height/2),left!+Math.floor(geometry.cell_width/2)],pattern_ref:'measurement.cell_pattern.'+digest(p).slice(0,16),palette_value_count:values.length,palette_values:values,pattern_occurrence_count:counts.get(JSON.stringify(p))};})};
}
/** frame._with_visible_grid_edges: complete patterns constrain cropped edges. */
export function _with_visible_grid_edges(rows:NativeRows,grid:R):R{
 const first_row=grid.row_offset-grid.row_pitch+grid.cell_height>0?-1:0,first_col=grid.col_offset-grid.col_pitch+grid.cell_width>0?-1:0,stop_row=Math.floor((rows.length-1-grid.row_offset)/grid.row_pitch)+1,stop_col=Math.floor((rows[0]!.length-1-grid.col_offset)/grid.col_pitch)+1;
 const edge_rows:number[]=[],edge_cols:number[]=[],positions:number[][]=[];
 for(let r=first_row;r<0;r++)edge_rows.push(r);for(let r=grid.logical_rows;r<stop_row;r++)edge_rows.push(r);
 for(let c=first_col;c<0;c++)edge_cols.push(c);for(let c=grid.logical_columns;c<stop_col;c++)edge_cols.push(c);
 for(const r of edge_rows)for(let c=first_col;c<stop_col;c++)positions.push([r,c]);for(let r=0;r<grid.logical_rows;r++)for(const c of edge_cols)positions.push([r,c]);
 const patterns=new Map<string,number[][]>();if(positions.length)for(const cell of grid.cells)if(!patterns.has(cell.pattern_ref))patterns.set(cell.pattern_ref,patch(rows,xybox(cell.bbox)));
 const clipped=positions.map(([row,col])=>{const top=grid.row_offset+row!*grid.row_pitch,left=grid.col_offset+col!*grid.col_pitch,b=box([Math.max(0,left),Math.max(0,top),Math.min(rows[0]!.length-1,left+grid.cell_width-1),Math.min(rows.length-1,top+grid.cell_height-1)]),dr=b.top-top,dc=b.left-left,crop=patch(rows,xybox(b));
  return{row,col,bbox:{top:b.top,left:b.left,bottom:b.bottom,right:b.right},crop_offset:[dr,dc],compatible_pattern_refs:[...patterns].filter(([_ref,p])=>same(p.slice(dr,dr+b.height).map(row=>row.slice(dc,dc+b.width)),crop)).map(([ref])=>ref)};
 });return{...grid,clipped_cells:clipped,visible_row_range:[first_row,stop_row],visible_column_range:[first_col,stop_col]};
}
export function _unique_action_conditioned_control_centered_grid_candidate(value:R,quantum:number):R|null{
 const bodies=value.canonical_provisional_control_geometry_bboxes?.length?value.canonical_provisional_control_geometry_bboxes:value.input_aligned_entity_bboxes??[];if(!bodies.length||quantum<=1)return null;
 if(new Set(bodies.map((b:R)=>b.top+b.bottom)).size!==1||new Set(bodies.map((b:R)=>b.left+b.right)).size!==1)return null;
 const t=Math.min(...bodies.map((b:R)=>b.top)),l=Math.min(...bodies.map((b:R)=>b.left)),b=Math.max(...bodies.map((b:R)=>b.bottom)),r=Math.max(...bodies.map((b:R)=>b.right)),h=b-t+1,w=r-l+1;
 if(h>quantum||w>quantum||(quantum-h)%2||(quantum-w)%2)return null;const mod=(n:number)=>(n%quantum+quantum)%quantum;
 return _action_quantized_grid_candidate(value.frame,quantum,mod(t-Math.floor((quantum-h)/2)),mod(l-Math.floor((quantum-w)/2)));
}
/** CellProjection supplies no interface deltas, retained grids or fill growth;
 * the non-centred shared-clearance branch therefore abstains exactly. */
export function _action_quantized_route_grid_candidates(value:R):R[]{
 const measured=value.periodic_cell_grids?.candidates??[];
 const maximal=()=>{if(!measured.length)return[];const n=Math.max(...measured.slice(0,3).map((g:R)=>g.cells.length)),max=measured.slice(0,3).filter((g:R)=>g.cells.length===n),sep=Math.max(...max.map((g:R)=>g.separator_consistency_ppm));return max.filter((g:R)=>g.separator_consistency_ppm===sep);};
 if(!_action_quantized_route_grid_evidence_is_current(value))return maximal();
 const q=_unique_primitive_action_translation_quantum(value);if(q===null)return maximal();if(q>32)return measured.slice(0,3);
 const grid=_unique_action_conditioned_control_centered_grid_candidate(value,q);return grid?[grid]:[];
}
export function _current_action_quantized_control_cell_retained_underlay_value_count(value:R):number{
 const values=new Set<number>(value.current_input_aligned_underlay_values??[]),boxes=value.canonical_provisional_control_geometry_bboxes?.length?value.canonical_provisional_control_geometry_bboxes:value.input_aligned_entity_bboxes??[];
 if(!values.size||!boxes.length)return 0;const counts=new Set<number>();for(const g of _action_quantized_route_grid_candidates(value)){const starts=g.cells.filter((c:R)=>boxes.some((b:R)=>overlap(c.bbox,b)));if(starts.length===1)counts.add(starts[0].palette_values.filter((n:number)=>values.has(n)).length);}return counts.size===1?[...counts][0]!:0;
}
export function _edge_display_exact_complement_cell_measurements(value:R,route_grids?:R[]):R[]{
 const supplied=route_grids?.length?route_grids:value.periodic_cell_grids?.candidates??[],grids:R[]=[],seen=new Set<string>();
 for(const g of supplied){const k=JSON.stringify([g.row_offset,g.col_offset,g.row_pitch,g.col_pitch,g.cell_height,g.cell_width,g.row_gap,g.col_gap,g.logical_rows,g.logical_columns,g.cells]);if(!seen.has(k)){seen.add(k);grids.push(g);}}
 if(!grids.length)return[];const rows=value.frame,H=rows.length,W=rows[0].length,carriers:R[]=[],mh=Math.max(...grids.map(g=>g.row_pitch)),mw=Math.max(...grids.map(g=>g.col_pitch));
 for(const c of supportParts(rows)){const b=c.bbox;if(b.width*2>=W&&b.height<=2*mh&&(b.top===0||b.bottom===H-1)||b.height*2>=H&&b.width<=2*mw&&(b.left===0||b.right===W-1))carriers.push(b);}
 if(!carriers.length)return[];const zones=supportParts(rows,8).filter(c=>c.area>1&&!c.touches_frame_boundary&&carriers.some(b=>enclosed(c.bbox,b))),found=new Map<string,{order:any[];value:R}>();
 for(const g of grids)for(const c of zones){if(c.bbox.height>g.row_pitch||c.bbox.width>g.col_pitch||c.area>=g.row_pitch*g.col_pitch)continue;
  for(const cell of g.cells){const boxes=[cell.bbox];if((g.row_gap>0||g.col_gap>0)&&g.row_gap%2===0&&g.col_gap%2===0){const b=cell.bbox,e=box([b.left-g.col_gap/2,b.top-g.row_gap/2,b.right+g.col_gap/2,b.bottom+g.row_gap/2]);if(e.top>=0&&e.left>=0&&e.bottom<H&&e.right<W)boxes.push(e);}
   for(const b of boxes){if(carriers.some(x=>overlap(x,b)))continue;const occupied=new Set<string>();for(let r=0;r<b.height;r++)for(let col=0;col<b.width;col++)if(rows[b.top+r][b.left+col]===c.value)occupied.add(key([r,col]));
    if(!occupied.size||occupied.size+c.area!==b.height*b.width)continue;const placements:number[][][]=[];for(let dy=0;dy<=b.height-c.bbox.height;dy++)for(let dx=0;dx<=b.width-c.bbox.width;dx++){const p=c.relative_pixels.map(([r,col]:number[])=>[r!+dy,col!+dx]);if(p.every((p:number[])=>!occupied.has(key(p))))placements.push(p.sort(supportCompare));}
    if(placements.length!==1)continue;const exact=placements[0]!,bb=[b.top,b.left,b.bottom,b.right],order=[c.component_id,g.candidate_ref,cell.row,cell.col,...bb];
    found.set(JSON.stringify(order),{order,value:{relation_ref:'measurement.edge_display_exact_complement_cell_relation:'+digest([c.component_id,g.candidate_ref,cell.row,cell.col,exact,bb]).slice(0,20),display_component_ref:c.component_id,display_bbox:[c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right],display_relative_pixels:c.relative_pixels,inserted_cell_pixels:exact,display_cell_offset:[Math.min(...exact.map(p=>p[0]!)),Math.min(...exact.map(p=>p[1]!))],target_cell_ref:cell.pattern_ref,target_grid_ref:g.candidate_ref,target_row:cell.row,target_col:cell.col,target_bbox:bb,shared_value:c.value,display_shape_area:c.area,target_same_value_area:occupied.size,exact_disjoint_union_fills_cell:true}});
   }
  }
 }
 return [...found.values()].sort((a,b)=>supportCompare(a.order,b.order)).slice(0,8).map(v=>v.value);
}
/** Exact endpoints.py invocation: no retained roles, failed contacts, assembly,
 * actuator/hostile catalogues or policy overrides are supplied. */
export function _provisional_object_terminating_routes(value:R):[R,R,string[]]{
 const q=_unique_primitive_action_translation_quantum(value),canonical=value.canonical_provisional_control_geometry_bboxes??[],resource=!!value.established_boundary_indicator_present;
 const quantized=!!(value.action_conditioned_grid_evidence&&q!==null&&canonical.length===1&&_action_quantized_route_grid_evidence_is_current(value));
 const controls=quantized||resource&&canonical.length===1?canonical:[];if(!controls.length)return[{},{},[]];
 const deltas:R={};for(const [a,r,c] of [...value.known_action_translation_deltas,...(value.interface_action_translation_deltas??[])])if(value.available_action_refs.includes(a)&&a!=='ACTION6'&&a!==value.level_start_checkpoint_action_ref&&(r===0)!==(c===0))deltas[a]=[Math.sign(r),Math.sign(c)];
 const entries=Object.entries(deltas).sort((a,b)=>supportCompare(a[0],b[0])) as [string,number[]][];if(!entries.length)return[{},{},[]];
 const generated=_action_quantized_route_grid_candidates(value),grids=generated.length?generated:value.periodic_cell_grids?.candidates??[],relations=_edge_display_exact_complement_cell_measurements(value,grids),displayBoxes=relations.map(r=>box([r.target_bbox[1],r.target_bbox[0],r.target_bbox[3],r.target_bbox[2]])),measured:R[]=[];
 for(const g of grids){const cells=new Map<string,R>(g.cells.map((c:R)=>[key([c.row,c.col]),c])),movers=g.cells.filter((c:R)=>controls.some((b:R)=>overlap(c.bbox,b)));if(movers.length!==1)continue;const mover=movers[0],start=key([mover.row,mover.col]),hollows:R[]=[];
  for(const c of value.components.components){const b=c.bbox;if(b.height!==mover.bbox.height+2||b.width!==mover.bbox.width+2||c.area!==2*b.height+2*b.width-4)continue;let complete=true,open=true;for(let r=b.top;r<=b.bottom;r++)for(let col=b.left;col<=b.right;col++){if(r===b.top||r===b.bottom||col===b.left||col===b.right){if(value.frame[r][col]!==c.value)complete=false;}else if(value.frame[r][col]===c.value)open=false;}if(complete&&open)hollows.push(b);}
  const visited=value.visited_input_aligned_entity_bboxes??[],visitedCells=new Set<string>(g.cells.filter((c:R)=>visited.some((b:R)=>overlap(c.bbox,b))).map((c:R)=>key([c.row,c.col]))),passable=new Set<string>(g.cells.filter((c:R)=>c!==mover&&c.pattern_occurrence_count>1&&visited.some((b:R)=>overlap(c.bbox,b))).map((c:R)=>c.pattern_ref));
  const latest=value.observed_input_aligned_action_translation;if(latest){const [,r,c]=latest;if((r===0)!==(c===0)){const pred=cells.get(key([mover.row-Math.sign(r),mover.col-Math.sign(c)]));if(pred&&pred.pattern_occurrence_count>1)passable.add(pred.pattern_ref);}}
  const recurrent=new Set<number>(g.cells.filter((c:R)=>passable.has(c.pattern_ref)&&c.pattern_occurrence_count>1&&c.palette_value_count===1).flatMap((c:R)=>c.palette_values)),guarded=[...hollows,...displayBoxes];
  const destinations:[R,R|null][]=[];
  for(const c of g.cells)if(c!==mover&&!visitedCells.has(key([c.row,c.col]))&&(c.pattern_occurrence_count===1||(resource||quantized)&&value.action_conditioned_grid_evidence&&c.pattern_occurrence_count>1&&c.pattern_occurrence_count<=8)&&(c.palette_value_count>1||quantized&&recurrent.size>0&&c.pattern_occurrence_count<=8&&!c.palette_values.every((v:number)=>recurrent.has(v)))&&!guarded.some(b=>overlap(c.bbox,b)))destinations.push([c,null]);
  for(const b of hollows)for(const c of g.cells)if(c!==mover&&!visitedCells.has(key([c.row,c.col]))&&c.bbox.top<=Math.floor((b.top+b.bottom)/2)&&Math.floor((b.top+b.bottom)/2)<=c.bbox.bottom&&c.bbox.left<=Math.floor((b.left+b.right)/2)&&Math.floor((b.left+b.right)/2)<=c.bbox.right)destinations.push([c,b]);
  for(const b of displayBoxes)for(const c of g.cells)if(c!==mover&&c.bbox.top<=Math.floor((b.top+b.bottom)/2)&&Math.floor((b.top+b.bottom)/2)<=c.bbox.bottom&&c.bbox.left<=Math.floor((b.left+b.right)/2)&&Math.floor((b.left+b.right)/2)<=c.bbox.right)destinations.push([c,b]);
  for(const [dest,aligned]of destinations){const target=key([dest.row,dest.col]),queue:[string,string[]][]=[[start,[]]],seen=new Set([start]);let witness:string[]|null=null;
   for(let i=0;i<queue.length&&!witness;i++){const [at,path]=queue[i]!,[r,c]=at.split(',').map(Number);if(path.length>=24)continue;for(const [a,[dr,dc]]of entries){const next=key([r!+dr!,c!+dc!]),cell=cells.get(next);if(seen.has(next)||!cell)continue;if(next!==target&&next!==start&&!passable.has(cell.pattern_ref)&&!(aligned&&overlap(cell.bbox,aligned)))continue;const route=[...path,a];if(next===target){witness=route;break;}seen.add(next);queue.push([next,route]);}}
   if(!witness)continue;const ref='probe:object-terminating-route:'+g.candidate_ref+':'+dest.row+':'+dest.col;measured.push({length:witness.length,pattern:dest.pattern_ref,ref,witness,aligned:aligned!==null,region:aligned?[aligned.top,aligned.left,aligned.bottom,aligned.right]:[],complement:displayBoxes.some(b=>overlap(dest.bbox,b))});
  }
 }
 const routes:R={};for(const m of [...measured].sort((a,b)=>supportCompare([!a.complement,true,a.length,a.pattern,a.ref],[!b.complement,true,b.length,b.pattern,b.ref])).slice(0,3)){const first=m.witness[0],prior=routes[first];if(!prior||m.aligned&&!prior[1]||m.aligned===prior[1]&&m.length<prior[0].length)routes[first]=[m.witness,m.aligned,m.ref,m.region];}
 const refs=[...new Set<string>(measured.map(m=>m.ref))].sort();return[routes,{},refs.length===1?refs:[]];
}
