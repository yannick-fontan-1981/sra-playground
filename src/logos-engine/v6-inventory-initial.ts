/** Initial body/lattice hypotheses retain their explicitly provisional authority. */
import { unique,key,box,detect_components,_unique_action_conditioned_control_centered_grid_candidate,materialize_grid,public_grid,_with_visible_grid_edges,type R } from './v6-inventory-measurements.ts';
import { enumerateSupportPeriodicCellGrids } from './v6-periodic-cell-grids.ts';
import type { NativeRows } from './v6-native-types.ts';
export function initial_candidates(observation:R,rows:NativeRows):[R[],R]{
 const candidates:R[]=[];
 for(const [signature,e]of Object.entries(unique(observation))){const [l,t,r,b]=e.bbox,w=r-l+1,h=b-t+1;if(w<3||h<3||w!==h||e.area!==2*w+2*h-4)continue;
  const shape=new Set<string>(e.mask.map(key)),perimeter=new Set<string>();for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||x===w-1||y===0||y===h-1)perimeter.add(key([x,y]));if(shape.size!==perimeter.size||[...shape].some(p=>!perimeter.has(p)))continue;
  const inner=new Set<number>();for(let y=t+1;y<b;y++)for(let x=l+1;x<r;x++)inner.add(rows[y]![x]!);if(inner.size!==1||inner.has(e.palette_value))continue;candidates.push({signature,bbox:e.bbox,area:w*h,status:'controlled_body_hypothesis_not_observed'});
 }
 const result=candidates.length?enumerateSupportPeriodicCellGrids(rows):{candidates:[],enumeration_truncated:false};return[candidates,{...result,candidates:result.candidates.map((g:R)=>public_grid(_with_visible_grid_edges(rows,materialize_grid(rows,g)))),schema_version:'yf_arc3_v5.periodic_cell_grid_result.v1'}];
}
// The source set holds at most three positive pitches (the original candidate
// bound); CPython's eight-slot small integer set iteration is deterministic.
function sourceQuanta(values:number[]):number[]{const slots:(number|undefined)[]=Array(8);for(const value of values){let i=value&7,perturb=value;while(slots[i]!==undefined&&slots[i]!==value){perturb>>>=5;i=(i*5+1+perturb)&7;}slots[i]=value;}return slots.filter((q):q is number=>q!==undefined);}
export function provisional_scenes(observation:R,rows:NativeRows):R[]{
 const [bodies,raw]=initial_candidates(observation,rows),components=detect_components(rows),quanta=sourceQuanta(raw.candidates.filter((g:R)=>g.row_pitch===g.col_pitch).map((g:R)=>g.row_pitch)),out:R[]=[];
 for(const body of bodies)for(const q of quanta){const grid=_unique_action_conditioned_control_centered_grid_candidate({frame:rows,components,available_action_refs:observation.available_action_refs,canonical_provisional_control_geometry_bboxes:[box(body.bbox)]},q);if(!grid)continue;
  out.push({status:'spatial_period_and_body_hypothesis',body:body.bbox,body_signature:body.signature,grids:[public_grid(grid)],controls:{},observation_ref:observation.observation_ref,level_epoch:observation.level_epoch,evidence:[observation.observation_ref],grid_authority:'hypothesis_from_repeated_spatial_period_not_observed_action',release_authority:false});}
 return out;
}
