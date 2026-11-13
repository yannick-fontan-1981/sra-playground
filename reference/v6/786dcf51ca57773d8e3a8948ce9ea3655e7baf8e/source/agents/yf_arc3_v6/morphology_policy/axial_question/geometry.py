from collections import Counter
from hashlib import sha256
import json
from types import SimpleNamespace
from agents.yf_arc3_v6.morphology_policy.topological_recolor.geometry import components
from agents.yf_arc3_v5.capabilities.axial_field_configuration import AxialBody,AxialState,AxialModel,AxialInput,_direct
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def digest(v):return sha256(json.dumps(v,sort_keys=True,separators=(",", ":")).encode()).hexdigest()
def bar_segments(cc):
 # A pole may be connected to a neighbour of the same value. A straight
 # segment remains measurable; its enclosing square is checked separately.
 original=[c for c in cc if len(c['cells'])>=3 and (c['bbox'][0]==c['bbox'][2]or c['bbox'][1]==c['bbox'][3])]
 lengths=sorted({len(c['cells'])for c in original if len(c['cells'])%2==1})
 out=list(original);seen={(c['value'],tuple(c['bbox']))for c in out}
 for c in cc:
  l,t,r,b=c['bbox'];cells=set(map(tuple,c['cells']))
  if l==r or t==b:continue
  for n in lengths:
   if len(cells)>4*n*n:continue
   for x,y in sorted(cells):
    for dx,dy in((1,0),(0,1)):
     strip=[(x+dx*k,y+dy*k)for k in range(n)]
     box=[x,y,x+dx*(n-1),y+dy*(n-1)];key=(c['value'],tuple(box))
     if key not in seen and all(p in cells for p in strip):
      out.append({'value':c['value'],'bbox':box,'cells':strip});seen.add(key)
 return out

def measure(rows):
 if not rows or not rows[0]:return None
 cc=components(rows);bars=bar_segments(cc);bodies=[]
 for a in bars:
  x0,y0,x1,y1=a['bbox'];n=max(x1-x0,y1-y0)+1
  if n%2!=1:continue
  for b in bars:
   if a['value']>=b['value']:continue
   u0,v0,u1,v1=b['bbox'];horizontal=y0==y1
   if horizontal:
    if v0!=v1 or x0!=u0 or x1!=u1 or abs(v0-y0)!=n-1:continue
    box=[x0,min(y0,v0),x1,max(y1,v1)];axis=[-1 if y0<v0 else 1,0]
   else:
    if u0!=u1 or y0!=v0 or y1!=v1 or abs(u0-x0)!=n-1:continue
    box=[min(x0,u0),y0,max(x1,u1),y1];axis=[0,-1 if x0<u0 else 1]
   l,t,r,d=box;cx,cy=(l+r)//2,(t+d)//2;inside=[rows[y][x]for y in range(t+1,d)for x in range(l+1,r)if(x,y)!=(cx,cy)];sides=[rows[y][x]for y in range(t,d+1)for x in range(l,r+1)if(x in(l,r)or y in(t,d))and(x,y)not in set(map(tuple,a['cells']))|set(map(tuple,b['cells']))]
   if not inside or len(set(inside))!=1 or len(set(sides))!=1:continue
   if inside[0]in(a['value'],b['value'])or sides[0]in(a['value'],b['value']):continue
   bodies.append({'bbox':box,'center':[cx,cy],'axis':axis,'poles':[a['value'],b['value']],'core':inside[0],'side':sides[0],'marker':rows[cy][cx],'size':n,'signature':[a['value'],b['value'],inside[0],sides[0],n]})
 if not 2<=len(bodies)<=16 or len({tuple(b['center'])for b in bodies})!=len(bodies)or len({tuple(b['signature'])for b in bodies})!=1:return None
 n=bodies[0]['size'];core=bodies[0]['core'];anchors=[c for c in cc if c['value']==core and c['bbox'][2]-c['bbox'][0]+1==n-2 and c['bbox'][3]-c['bbox'][1]+1==n-2 and len(c['cells'])==(n-2)**2];centers=[[(c['bbox'][0]+c['bbox'][2])//2,(c['bbox'][1]+c['bbox'][3])//2]for c in anchors];xs=sorted({p[0]for p in centers});ys=sorted({p[1]for p in centers})
 if len(xs)<3 or len(ys)<3 or any((b-a)%n for values in(xs,ys)for a,b in zip(values,values[1:])):return None
 bounds=[min(xs),min(ys),max(xs),max(ys)];targets=[]
 for c in cc:
  l,t,r,d=c['bbox']
  if r-l+1!=n or d-t+1!=n or len(c['cells'])!=4*n-4:continue
  if not bounds[0]<=l<=r<=bounds[2]+n//2 or not bounds[1]<=t<=d<=bounds[3]+n//2:continue
  perimeter={(x,y)for y in range(t,d+1)for x in range(l,r+1)if x in(l,r)or y in(t,d)}
  if set(map(tuple,c['cells']))!=perimeter:continue
  cx,cy=(l+r)//2,(t+d)//2;interior=[rows[y][x]for y in range(t+1,d)for x in range(l+1,r)if(x,y)!=(cx,cy)]
  if len(set(interior))==1 and rows[cy][cx]==c['value']:targets.append({'center':[cx,cy],'bbox':c['bbox'],'ring_value':c['value'],'inside':interior[0]})
 if len(targets)!=1:return None
 markers=[b for b in bodies if b['marker']!=b['core']]
 return {'bodies':bodies,'target':targets[0],'quantum':n,'grid_bounds':bounds,'anchors':centers,'selected':markers[0]if len(markers)==1 else None,'ambiguous_selection':len(markers)>1,'signature':bodies[0]['signature']}

def projected_turns(m,body,cycle):
 refs={tuple(b['center']):'axial:'+digest(b['center'])for b in m['bodies']};bs=tuple(AxialBody(body_ref=refs[tuple(b['center'])],cell=tuple(reversed(b['center'])),positive_axis=tuple(b['axis']),positive_pole_ref='visible:'+str(b['poles'][0]),negative_pole_ref='visible:'+str(b['poles'][1]))for b in m['bodies']);state=AxialState(bodies=bs,active_body_ref=refs[tuple(body['center'])],reserve=0,terminated=False);model=AxialModel(model_ref='conditional_quarter_turn_only',floor_cells=tuple(b.cell for b in bs),orientation_cycle=tuple(map(tuple,cycle)));budget=DWorkBudget(SimpleNamespace(node_bound=1000,time_bound_ms=1000,domain_bound=1000));out=[]
 for turn in(-1,1):
  result=_direct(model,state,AxialInput(kind_ref='pivot',turn=turn),budget);out.append({'turn':turn,'axis':list(result['orientation_after']),'scope':'conditional_orientation_only_no_translation_model'})
 return out

def relations(m,actor):
 result=[];ay,ax=reversed(actor['center']);ty,tx=reversed(m['target']['center'])
 for peer in m['bodies']:
  if peer is actor or peer['center']==actor['center']:continue
  by,bx=reversed(peer['center']);row=ay==by;col=ax==bx
  if not(row or col):continue
  direction=[0,1]if row else[1,0]
  if peer['axis']not in(direction,[-v for v in direction]):continue
  a,b,t=(ax,bx,tx)if row else(ay,by,ty);aligned=(ty==ay)if row else(tx==ax);between=min(a,b)<t<max(a,b)
  dependency=[p for p in m['bodies']if p['center']not in(actor['center'],peer['center'])and((p['center'][0]==tx and min(p['center'][1],ay)<ty<max(p['center'][1],ay))if row else(p['center'][1]==ty and min(p['center'][0],ax)<tx<max(p['center'][0],ax)))]
  if aligned:kind='between'if between else'outside'
  elif between and dependency:kind='transverse_dependency'
  else:continue
  result.append({'kind':kind,'peer':peer,'dependency':[p['center']for p in dependency],'target':m['target']['center'],'scope':'qualitative_interaction_hypothesis_no_endpoint_prediction'})
 return result
