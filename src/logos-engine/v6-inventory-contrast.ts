/** Exact bounded V6 local disappearance/peripheral appearance correspondence. */
import { detect_components,key,xybox,box as bbox,enclosed,type R } from './v6-inventory-measurements.ts';
import { supportCompare as compare } from './v6-support-measurements.ts';
import { pythonEqual as same,pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
export function normalized(points:readonly number[][]):number[][]{
 if(!points.length)return[];const x=Math.min(...points.map(p=>p[0]!)),y=Math.min(...points.map(p=>p[1]!));return points.map(p=>[p[0]!-x,p[1]!-y]).sort(compare);
}
export function transferred_shape(before:R,after:R,first:NativeRows,second:NativeRows,first_facts:R,second_facts:R,action:R):R{
 const out:R={status:'unbound',evidence:[before.observation_ref,after.observation_ref],action,release_authority:false};
 if(before.level_epoch!==after.level_epoch||!same(first_facts.body??null,second_facts.body??null))return out;
 if(first_facts.observation_ref!==before.observation_ref||second_facts.observation_ref!==after.observation_ref||first_facts.level_epoch!==before.level_epoch||second_facts.level_epoch!==after.level_epoch)return out;
 const under=first_facts.underlay_evidence??{},patch=under.patch,box=under.cell_bbox;if(!truth(patch)||!truth(box)||!truth(first_facts.retained_underlay_value_count))return out;
 const [cl,ct,cr,cb]=box,[bl,bt,br,bb]=first_facts.body,removed=new Map<number,number[][]>();
 for(let y=ct;y<=cb;y++)for(let x=cl;x<=cr;x++){if(bl<=x&&x<=br&&bt<=y&&y<=bb)continue;if(first[y]![x]!==second[y]![x]){const v=first[y]![x]!,p=removed.get(v)??[];p.push([x,y]);removed.set(v,p);}}
 const components=detect_components(second,8).components,hits:R[]=[];
 for(const [value,pixels]of removed){
  const source:number[][]=[];for(let y=0;y<patch.length;y++)for(let x=0;x<patch[y].length;x++)if(patch[y][x]===value)source.push([x,y]);
  if(!source.length||source.some(([x,y])=>!(bl<=cl+x!&&cl+x!<=br&&bt<=ct+y!&&ct+y!<=bb)&&first[ct+y!]![cl+x!]!==value))continue;if(pixels.some(([x,y])=>second[y!]![x!]===value))continue;
  for(const comp of components){if(comp.value!==value||!same(normalized(comp.relative_pixels.map(([r,c]:number[])=>[c,r])),normalized(source)))continue;const b=comp.bbox;
   if(!(b.right<cl||b.left>cr||b.bottom<ct||b.top>cb)||comp.relative_pixels.some(([y,x]:number[])=>first[b.top+y!]![b.left+x!]===value))continue;
   hits.push({source_cell_bbox:box,source_value:value,source_mask:normalized(source),display_component_ref:comp.component_id,display_bbox:xybox(b),visible_source_removed:pixels.length,display_pixels_added:comp.area,source_before_entry_evidence:under.evidence});
  }
 }
 return Object.assign(out,{status:hits.length===1?'unique_corresponding_transfer':hits.length?'ambiguous':'no_matching_transfer',matches:hits});
}
export function world_complements(facts:R,rows:NativeRows):R[]{
 if((facts.grids??[]).length!==1)return[];const grid=facts.grids[0],h=grid.cell_height,w=grid.cell_width;if(h*w>1024)return[];const out:R[]=[];
 for(const comp of detect_components(rows,8).components){const b=comp.bbox;if(comp.area<=1||comp.area>=h*w||b.width>w||b.height>h||b.width===w&&b.height===h)continue;
  const sources=grid.cells.filter((c:R)=>enclosed(b,c.bbox));if(sources.length!==1)continue;const rel=comp.relative_pixels.map(([r,c]:number[])=>[c,r]).sort(compare);
  for(const cell of grid.cells){if(same(cell,sources[0]))continue;const box=cell.bbox,l=box.left,t=box.top,mask=new Set<string>();
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(rows[t+y]![l+x]===comp.value)mask.add(key([x,y]));if(!mask.size||mask.size+rel.length!==h*w)continue;
   const placements:number[][]=[];for(let dy=0;dy<=h-b.height;dy++)for(let dx=0;dx<=w-b.width;dx++)if(rel.every(([x,y]:number[])=>!mask.has(key([x!+dx,y!+dy]))))placements.push([dx,dy]);if(placements.length!==1)continue;
   out.push({source_cell:[sources[0].row,sources[0].col],source_bbox:xybox(b),source_mask:rel,source_value:comp.value,target_cell:[cell.row,cell.col],target_bbox:xybox(box),exact_disjoint_union_fills_cell:true,offset:placements[0],observation_ref:facts.observation_ref,level_epoch:facts.level_epoch});
  }
 }
 return out.slice(0,8);
}
export function display_matches(receipt:R,rows:NativeRows):boolean{
 const [l,t,r,b]=receipt.display_bbox,mask=new Set<string>(receipt.source_mask.map(key)),value=receipt.source_value;
 for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)if((rows[y]![x]===value)!==mask.has(key([x-l,y-t])))return false;return true;
}
export function reverse_transfer(receipt:R,before:R,after:R,first:NativeRows,second:NativeRows,facts:R):R{
 const out:R={status:'unbound',evidence:[before.observation_ref,after.observation_ref]};if(before.level_epoch!==after.level_epoch||!display_matches(receipt,first)||display_matches(receipt,second))return out;
 const grids=facts.grids??[],body=facts.body;if(grids.length!==1||!truth(body))return out;
 const [bl,bt,br,bb]=body,cells=grids[0].cells.filter((c:R)=>enclosed(bbox(body),c.bbox));if(cells.length!==1)return out;
 const [l,t,r,b]=xybox(cells[0].bbox),shape=[...new Map<string,number[]>(receipt.source_mask.map((p:number[])=>[key(p),p])).values()],value=receipt.source_value,hits:R[]=[];
 if(!shape.length)throw new RangeError('max() arg is an empty sequence');
 for(let dy=0;dy<b!-t!+1-Math.max(...shape.map(p=>p[1]!));dy++)for(let dx=0;dx<r!-l!+1-Math.max(...shape.map(p=>p[0]!));dx++){
  const points=shape.map(([x,y])=>[l!+dx+x!,t!+dy+y!]),visible=points.filter(([x,y])=>!(bl<=x!&&x!<=br&&bt<=y!&&y!<=bb));
  if(!visible.length||visible.some(([x,y])=>second[y!]![x!]!==value)||!visible.some(([x,y])=>first[y!]![x!]!==value))continue;
  const other:string[]=[];for(let y=t!;y<=b!;y++)for(let x=l!;x<=r!;x++)if(second[y]![x]===value&&!(bl<=x&&x<=br&&bt<=y&&y<=bb))other.push(key([x,y]));if(!same(other.sort(),visible.map(key).sort()))continue;
  hits.push({cell_bbox:[l,t,r,b],offset:[dx,dy],visible_added:visible.filter(([x,y])=>first[y!]![x!]!==value).length,hidden_points_unknown:points.length-visible.length});
 }
 return Object.assign(out,{status:hits.length===1?'unique_reverse_correspondence':hits.length?'ambiguous':'display_changed_without_local_reverse',alternatives:hits});
}
