/** V6 observed_inventory/material_layers.py: revalidate visible layered support. */
import { clone, key, type R } from './v6-inventory-measurements.ts';
import { pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

export function current_material_layers(underlays:Map<string,R>,epoch:number|null,rows:NativeRows,body:number[]|null,control_signature:string|null):R[]{
 const out:R[]=[];
 for(const under of underlays.values()){
  const layer=under.material_overlay??{},patch=layer.substrate_patch,material=layer.material_mask,b=layer.cell_bbox;
  if(!truth(patch)||!truth(material)||!truth(b)||layer.level_epoch!==epoch||layer.control_signature!==control_signature||!truth(layer.entry_evidence))continue;
  const [l,t,r,bottom]=b,h=bottom-t+1,w=r-l+1;
  if(l<0||t<0||bottom>=rows.length||r>=rows[0]!.length||patch.length!==h||patch.some((row:number[])=>row.length!==w))continue;
  if(!material.every(([x,y]:number[])=>0<=x!&&x!<w&&0<=y!&&y!<h))continue;
  const expected=clone(patch);for(const [x,y]of material)expected[y][x]=layer.material_value;
  const visible:number[][]=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(!(body&&body[0]!<=l+x&&l+x<=body[2]!&&body[1]!<=t+y&&t+y<=body[3]!))visible.push([x,y]);
  const points=new Set<string>(material.map(key));
  if(!visible.length||!visible.some(p=>points.has(key(p)))||visible.some(([x,y])=>rows[t+y!]![l+x!]!==expected[y!][x!]))continue;
  out.push({cell_bbox:[...b],substrate_patch:clone(patch),material_mask:clone(material),material_value:layer.material_value,evidence:[...layer.entry_evidence,...layer.evidence],visible_pixels:visible.length,hidden_pixels:w*h-visible.length,qualification:'current_visible_material_over_observed_entered_surface_collision_still_unknown'});
 }
 return out;
}
