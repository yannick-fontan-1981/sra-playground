"""Public relative-layout projection. No game names, controls, palettes or offsets."""
from collections import Counter,defaultdict,deque
from terminal_composition import identity

def rectangles(obs):
 out=[]
 for e in obs['entities']:
  l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
  if min(w,h)<3 or e['area']!=2*w+2*h-4:continue
  edge={(x,y) for y in range(h) for x in range(w) if x in (0,w-1) or y in (0,h-1)}
  if set(map(tuple,e['mask']))==edge:out.append(e['bbox'])
 return out

def cell(rows,x,y,size):
 values=[rows[j][i] for j in range(y,y+size) for i in range(x,x+size)];value,count=Counter(values).most_common(1)[0]
 center=(x+size//2,y+size//2);exceptions=[(i,j) for j in range(y,y+size) for i in range(x,x+size) if rows[j][i]!=value]
 if exceptions and exceptions!=[center]:return None
 return {'value':value,'marker':rows[center[1]][center[0]] if exceptions else None,'point':list(center)}

def pads(obs,rows,board,size):
 l,t,r,b=board;tiles={}
 for e in obs['entities']:
  x,y,xx,yy=e['bbox']
  if xx-x+1!=size or yy-y+1!=size or (l<=x<=r and t<=y<=b):continue
  v=cell(rows,x,y,size)
  if v:tiles[x,y]=v
 distances=sorted({abs(a[0]-b[0]) for a in tiles for b in tiles if a[1]==b[1] and abs(a[0]-b[0])>size}|{abs(a[1]-b[1]) for a in tiles for b in tiles if a[0]==b[0] and abs(a[1]-b[1])>size})
 if not distances:return []
 pitch=distances[0];pending=set(tiles);groups=[]
 while pending:
  first=min(pending);pending.remove(first);todo=[first];group=[]
  while todo:
   pos=todo.pop();group.append(pos)
   for dx,dy in [(pitch,0),(-pitch,0),(0,pitch),(0,-pitch)]:
    nxt=(pos[0]+dx,pos[1]+dy)
    if nxt in pending:pending.remove(nxt);todo.append(nxt)
  xs=sorted({p[0] for p in group});ys=sorted({p[1] for p in group})
  if min(len(xs),len(ys))<2 or len(group)!=len(xs)*len(ys):continue
  cells=[{'xy':[xs.index(x),ys.index(y)],**tiles[x,y]} for x,y in group];markers=[c for c in cells if c['marker'] is not None]
  if len(markers)>1:continue
  groups.append({'ref':identity([xs,ys,size]),'shape':[len(xs),len(ys)],'origin':[xs[0],ys[0]],'pitch':pitch,'cells':cells,'selected':markers[0] if markers else None})
 return sorted(groups,key=lambda p:p['origin'])

def project(obs,rows):
 frames=rectangles(obs);candidates=[]
 for board in frames:
  l,t,r,b=board;innerw,innerh=r-l-1,b-t-1
  sizes=Counter(e['bbox'][2]-e['bbox'][0]+1 for e in obs['entities'] if e['bbox'][0]>l and e['bbox'][1]>t and e['bbox'][2]<r and e['bbox'][3]<b and e['bbox'][2]-e['bbox'][0]==e['bbox'][3]-e['bbox'][1] and e['area']==(e['bbox'][2]-e['bbox'][0]+1)**2)
  for size,count in sizes.most_common(1):
   if size<2 or innerw%size or innerh%size or min(innerw//size,innerh//size)<3 or count<6:continue
   width,height=innerw//size,innerh//size;cells=[];valid=True
   for y in range(height):
    for x in range(width):
     value=cell(rows,l+1+x*size,t+1+y*size,size)
     if value is None:valid=False;break
     cells.append({'xy':[x,y],**value})
   if not valid:continue
   phase=[Counter(c['value'] for c in cells if sum(c['xy'])%2==p).most_common(1)[0] for p in (0,1)]
   if phase[0][0]==phase[1][0] or sum(n for _,n in phase)*2<=len(cells):continue
   terrain={v for v,_ in phase}
   for box in frames:
    if box==board:continue
    a,bb,cc,d=box
    if not (cc<l or a>r or d<t or bb>b):continue
    features=[{'xy':[x-a-1,y-bb-1],'value':rows[y][x]} for y in range(bb+1,d) for x in range(a+1,cc) if rows[y][x] not in terrain]
    if len(features)<2:continue
    values={f['value'] for f in features};objects=[c for c in cells if c['value'] in values]
    if Counter(c['value'] for c in objects)!=Counter(f['value'] for f in features):continue
    selected=[o for o in objects if o['marker'] is not None]
    controls=pads(obs,rows,board,size)
    if len(selected)>1 or not controls:continue
    candidates.append({'board':board,'size':size,'shape':[width,height],'terrain':sorted(terrain),'objects':objects,
     'legend':{'box':box,'features':features},'selected':selected[0] if selected else None,'pads':controls,
     'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
     'scope_ref':identity([obs['level_epoch'],board,size,box,features])})
 return candidates[0] if len(candidates)==1 else None

def translated_targets(layout):
 """Enumerate distinct matching arrangements by fixing a measured participant."""
 features=layout['legend']['features'];objects=layout['objects'];w,h=layout['shape'];seen=set();out=[]
 for obj in objects:
  for f in features:
   if obj['value']!=f['value']:continue
   dx,dy=[obj['xy'][i]-f['xy'][i] for i in (0,1)]
   target=sorted((p['xy'][0]+dx,p['xy'][1]+dy,p['value']) for p in features)
   if any(not (0<=x<w and 0<=y<h) for x,y,_ in target) or tuple(target) in seen:continue
   seen.add(tuple(target));current={(o['xy'][0],o['xy'][1],o['value']) for o in objects};wanted=set(target)
   out.append({'target':target,'already_preserved':sorted(current&wanted),'remove':sorted(current-wanted),'add':sorted(wanted-current),
      'relation':'same_typed_relative_displacements_as_visible_model','terminal_role':'hypothesis_until_observed_boundary'})
 return out

def effect(before,after,command):
 if not before or not after or before['scope_ref']!=after['scope_ref']:return {'status':'scope_unbound'}
 bs,as_=before['selected'],after['selected']
 if not bs and as_:return {'status':'selection_observed','object':as_,'evidence':[before['observation_ref'],after['observation_ref']]}
 old={(o['xy'][0],o['xy'][1],o['value']) for o in before['objects']};new={(o['xy'][0],o['xy'][1],o['value']) for o in after['objects']}
 removed,added=old-new,new-old
 if not removed and not added:
  if as_ and (not bs or as_['xy']!=bs['xy']):return {'status':'selection_observed','object':as_,'evidence':[before['observation_ref'],after['observation_ref']]}
  return {'status':'no_arrangement_change'}
 if len(removed)!=1 or len(added)!=1:return {'status':'ambiguous_multi_object_change'}
 source=next(iter(removed));target=next(iter(added))
 if source[2]!=target[2] or not bs or not as_ or tuple(bs['xy'])!=source[:2] or tuple(as_['xy'])!=target[:2]:return {'status':'selected_identity_unbound'}
 changes=[]
 for oldpad in before['pads']:
  newpad=next((p for p in after['pads'] if p['ref']==oldpad['ref']),None)
  if not newpad or not oldpad['selected'] or not newpad['selected']:continue
  aa,bb=oldpad['selected'],newpad['selected']
  if aa['xy']!=bb['xy']:changes.append({'pad_ref':oldpad['ref'],'from':aa['xy'],'to':bb['xy'],'marker_value':aa['value']})
 if len(changes)!=1:return {'status':'actuator_change_ambiguous'}
 return {'status':'single_object_and_actuator_displacement','object_value':source[2],'from':list(source[:2]),'to':list(target[:2]),
  'delta':[target[i]-source[i] for i in (0,1)],'control':changes[0],'action':command,
  'preserved_objects':sorted(old&new),'evidence':[before['observation_ref'],after['observation_ref']],
  'scope':'current_selected_object_and_current_actuator_only','unresolved':['gain_after_new_selection','opposite_axis','edge_wrapping','actuator_saturation']}
