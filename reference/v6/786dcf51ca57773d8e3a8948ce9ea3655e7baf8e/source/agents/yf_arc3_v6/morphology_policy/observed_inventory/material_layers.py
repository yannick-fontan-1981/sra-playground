"""Revalidate an observed surface beneath a subsequently deposited material.
This measures a layered hypothesis; it never declares a collision-free cell.
"""
from copy import deepcopy

def current_material_layers(underlays,epoch,rows,body,control_signature):
 out=[]
 for under in underlays.values():
  layer=under.get('material_overlay') or {};patch=layer.get('substrate_patch');material=layer.get('material_mask');box=layer.get('cell_bbox')
  if not patch or not material or not box or layer.get('level_epoch')!=epoch or layer.get('control_signature')!=control_signature or not layer.get('entry_evidence'):continue
  l,t,r,b=box;h=b-t+1;w=r-l+1
  if l<0 or t<0 or b>=len(rows) or r>=len(rows[0]) or len(patch)!=h or any(len(row)!=w for row in patch):continue
  if not all(0<=x<w and 0<=y<h for x,y in material):continue
  expected=[list(row) for row in patch]
  for x,y in material:expected[y][x]=layer['material_value']
  hidden=lambda x,y:bool(body and body[0]<=x<=body[2] and body[1]<=y<=body[3])
  visible=[(x,y) for y in range(h) for x in range(w) if not hidden(l+x,t+y)]
  points={tuple(p) for p in material}
  if not visible or not any((x,y) in points for x,y in visible):continue
  if any(rows[t+y][l+x]!=expected[y][x] for x,y in visible):continue
  out.append({'cell_bbox':list(box),'substrate_patch':deepcopy(patch),'material_mask':deepcopy(material),'material_value':layer['material_value'],'evidence':layer['entry_evidence']+layer['evidence'],'visible_pixels':len(visible),'hidden_pixels':w*h-len(visible),'qualification':'current_visible_material_over_observed_entered_surface_collision_still_unknown'})
 return out
