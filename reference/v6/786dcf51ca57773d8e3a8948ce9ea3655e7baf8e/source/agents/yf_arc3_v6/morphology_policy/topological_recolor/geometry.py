from collections import defaultdict
from types import SimpleNamespace
from hashlib import sha256
import json
from agents.yf_arc3_v5.capabilities.topological_region_recolor import RecolorRegion, _pockets, _components
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def digest(v):return sha256(json.dumps(v,sort_keys=True,separators=(",", ":")).encode()).hexdigest()
def components(rows,box=None):
 h=len(rows);w=len(rows[0]);x0,y0,x1,y1=box or (0,0,w-1,h-1);left={(x,y)for y in range(y0,y1+1)for x in range(x0,x1+1)};out=[]
 while left:
  seed=min(left,key=lambda p:(p[1],p[0]));left.remove(seed);todo=[seed];cells=[];v=rows[seed[1]][seed[0]]
  while todo:
   x,y=todo.pop();cells.append((x,y))
   for q in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if q in left and rows[q[1]][q[0]]==v:left.remove(q);todo.append(q)
  xs,ys=zip(*cells);out.append({'value':v,'cells':sorted(cells),'bbox':[min(xs),min(ys),max(xs),max(ys)]})
 return out

def pockets(c,ref,box=None):
 if box and any(x in(box[0],box[2])or y in(box[1],box[3])for x,y in c['cells']):
  x0,y0,x1,y1=c['bbox'];left=max(box[0],x0-1);right=min(box[2],x1+1);top=max(box[1],y0-1);bottom=min(box[3],y1+1);support={(y,x)for x,y in c['cells']};empty={(y,x)for y in range(top,bottom+1)for x in range(left,right+1)}-support
  budget=DWorkBudget(SimpleNamespace(node_bound=50000,time_bound_ms=1000,domain_bound=20000));masks=[]
  for component in _components(empty,4,budget):
   if not any(y in(top,bottom)or x in(left,right)for y,x in component):masks.append(tuple(sorted(component)))
  return {'region_ref':'visible_region:'+digest(c),'evidence_ref':ref,'connectivity':4,'pocket_masks':tuple(masks),'pocket_areas':tuple(len(m)for m in masks),'pocket_count':len(masks),'scope':'closed_visible_pockets_only','complete_object_topology':False,'unobserved_beyond_field':True}

 region=RecolorRegion(region_ref='region:'+digest(c),support=tuple((y,x)for x,y in c['cells']),evidence_ref=ref,clipped=False,boundary_complete=True)
 budget=DWorkBudget(SimpleNamespace(node_bound=50000,time_bound_ms=1000,domain_bound=20000))
 return _pockets(region,4,budget)

def measure(rows,obs,writes=()):
 if not rows or not rows[0]:return None
 h=len(rows);w=len(rows[0]);cc=components(rows);groups=defaultdict(list)
 for c in cc:
  x0,y0,x1,y1=c['bbox'];bw=x1-x0+1;bh=y1-y0+1
  if len(c['cells'])==bw*bh and bw>=2 and bh>=2 and bw<w//3 and bh<h//3:groups[(y0,y1,bw,bh)].append(c)
 groups=[sorted(g,key=lambda c:c['bbox'][0])for g in groups.values()if len(g)>=3 and len({c['value']for c in g})==len(g)]
 layouts=[]
 for wells in groups:
  wy0=wells[0]['bbox'][1];wy1=wells[0]['bbox'][3]
  for sy in range(h):
   if len(set(rows[sy]))!=1 or wy0<=sy<=wy1:continue
   edge=rows[sy][0];top,bottom=(0,sy-1)if sy<wy0 else(sy+1,h-1)
   if bottom-top<5:continue
   separators=[x for x in range(1,w-1)if all(rows[y][x]==edge for y in range(top,bottom+1))]
   for sx in separators:
    for lb,fb in [((0,top,sx-1,bottom),(sx+1,top,w-1,bottom)),((sx+1,top,w-1,bottom),(0,top,sx-1,bottom))]:
     palette={c['value']for c in wells};samples=[c for c in components(rows,lb)if c['value']in palette and not any(x in (lb[0],lb[2])or y in(lb[1],lb[3])for x,y in c['cells'])]
     if len(samples)<2:continue
     mapping={};valid=True
     for c in samples:
      pk=pockets(c,obs['observation_ref']);n=pk['pocket_count']
      if n in mapping and mapping[n]!=c['value']:valid=False;break
      mapping[n]=c['value']
     if not valid:continue
     bodies=[];parts=components(rows,fb);boundary=[c for c in parts if {(fb[0],fb[1]),(fb[0],fb[3]),(fb[2],fb[1]),(fb[2],fb[3])}<=set(c['cells'])]
     holes=set()
     for c in parts:
      if c in boundary:continue
      pk=pockets(c,obs['observation_ref'],fb);holes.update((x,y)for mask in pk['pocket_masks']for y,x in mask)
     for c in parts:
      if c in boundary or set(c['cells'])<=holes:continue
      pk=pockets(c,obs['observation_ref'],fb);n=pk['pocket_count']
      if n not in mapping:continue
      bodies.append({**c,'pocket_count':n,'target':mapping[n],'evidence':pk,'relation_kind':'shell','partial_topology':pk.get('complete_object_topology')is False})
     if not bodies:continue
     legend_outer=[c for c in components(rows,lb)if {(lb[0],lb[1]),(lb[0],lb[3]),(lb[2],lb[1]),(lb[2],lb[3])}<=set(c['cells'])]
     shells_match=all(c['value']==c['target']for c in bodies)
     if len(boundary)==1 and len(legend_outer)==1 and legend_outer[0]['value']in palette and legend_outer[0]['value']not in mapping.values():
      c=boundary[0];bodies.append({**c,'target':legend_outer[0]['value'],'pocket_count':None,'relation_kind':'surround','partial_topology':False,'shells_currently_match':shells_match,'evidence':{'source_sample':legend_outer[0],'observation_ref':obs['observation_ref'],'scope':'current_surround_correspondence_hypothesis'}})
     borders=[]
     for c in wells:
      a,b,d,e=c['bbox'];ring=[(x,y)for y in range(b-1,e+2)for x in range(a-1,d+2)if 0<=x<w and 0<=y<h and(x in(a-1,d+1)or y in(b-1,e+1))];vs={rows[y][x]for x,y in ring};borders.append(next(iter(vs))if len(vs)==1 else None)
     counts={v:borders.count(v)for v in set(borders)};active=[c['value']for c,v in zip(wells,borders)if v is not None and counts[v]==1 and max(counts.values())==len(wells)-1]
     layouts.append({'field':list(fb),'legend':list(lb),'wells':wells,'mapping':{str(k):v for k,v in mapping.items()},'bodies':bodies,'active':active[0]if len(active)==1 else None,'selection_signature':borders,'separator':[sx,sy,edge],'evidence':[obs['observation_ref']]})
 if len(layouts)>1:
  supported=[]
  for m in layouts:
   for receipt in writes:
    binding=receipt.get('partition_binding',{});mask=receipt.get('changed_mask',[])
    if receipt.get('source_epoch')!=obs['level_epoch']or not receipt.get('only_target_pigment')or receipt.get('outside_count')!=0 or not mask or len(receipt.get('evidence',[]))!=2:continue
    if binding!={k:m[k]for k in('field','legend','separator','mapping')}:continue
    x0,y0,x1,y1=m['field']
    if all(x0<=x<=x1 and y0<=y<=y1 for x,y in mask):supported.append(m);break
  layouts=supported
 if len(layouts)!=1:return None
 return layouts[0]

def selection_support_signature(m):
 wells=m['wells'];xbase=min(c['bbox'][0]for c in wells);ybase=min(c['bbox'][1]for c in wells)
 return {'wells':[[c['bbox'][0]-xbase,c['bbox'][1]-ybase,c['bbox'][2]-c['bbox'][0]+1,c['bbox'][3]-c['bbox'][1]+1]for c in wells],'one_distinct_indicator':m['active']is not None,'uniform_well_bodies':all(len(c['cells'])==(c['bbox'][2]-c['bbox'][0]+1)*(c['bbox'][3]-c['bbox'][1]+1)for c in wells)}
