from collections import Counter
from types import SimpleNamespace
import hashlib,json
from agents.yf_arc3_v5.capabilities.autonomous_consumption_d import ConsumptionGraphD,_consumption_paths

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def components(rows):
 seen=set();out=[];h=len(rows);w=len(rows[0])
 for y in range(h):
  for x in range(w):
   if (x,y)in seen:continue
   value=rows[y][x];q=[(x,y)];seen.add((x,y));p=[]
   while q:
    a,b=q.pop();p.append([a,b])
    for c,d in ((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
     if 0<=c<w and 0<=d<h and(c,d)not in seen and rows[d][c]==value:seen.add((c,d));q.append((c,d))
   out.append({'value':value,'pixels':p,'area':len(p),'bbox':[min(a for a,b in p),min(b for a,b in p),max(a for a,b in p),max(b for a,b in p)]})
 return out

def acquire(rows,obs):
 cs=components(rows);floor=max(Counter(v for row in rows for v in row),key=Counter(v for row in rows for v in row).get);regions=[c for c in cs if c['value']==floor and c['area']>=16];owner={tuple(p):i for i,c in enumerate(regions)for p in c['pixels']};h=len(rows);w=len(rows[0]);gates=[]
 if len(regions)<2:return None
 for y in range(1,h-1):
  for x in range(1,w-1):
   for dx,dy in ((1,0),(0,1)):
    a=owner.get((x-dy,y-dx));b=owner.get((x+dy,y+dx))
    if a is None or b is None or a==b:continue
    for radius in range(2,8):
     ps=[[x+i*dx,y+i*dy]for i in range(-radius,radius+1)]
     if any(not(0<=u<w and 0<=v<h)for u,v in ps):continue
     vs=[rows[v][u]for u,v in ps];inner=vs[1:radius]+vs[radius+1:-1]
     if len(set(inner))!=1 or vs[0]!=vs[-1]or len({vs[0],inner[0],vs[radius],floor})!=4:continue
     margin=[[u,v]for u in range(max(0,x-radius*dx-1),min(w,x+radius*dx+2))for v in range(max(0,y-radius*dy-1),min(h,y+radius*dy+2))];gates.append({'center':[x,y],'axis':[dx,dy],'radius':radius,'regions':[a,b],'pixels':ps,'patch':margin,'closed_values':vs,'ref':'separator:'+digest([x,y,dx,dy,radius])});break
 if len(gates)<2:return None
 mask={tuple(p)for g in gates for p in g['patch']};walls=[c for c in cs if c['value']!=floor and c['area']>=16 and c['bbox'][2]-c['bbox'][0]>w//2 and c['bbox'][3]-c['bbox'][1]>h//2]
 if len(walls)!=1:return None
 wall=walls[0];protected=[[x,y,rows[y][x]]for x,y in wall['pixels']if(x,y)not in mask]
 return {'floor':floor,'regions':[{'pixels':c['pixels'],'bbox':c['bbox']}for c in regions],'gates':gates,'wall':protected,'epoch':obs['level_epoch'],'evidence':[obs['observation_ref']],'source_digest':digest(rows)}

def current(layout,rows):
 if any(rows[y][x]!=v for x,y,v in layout['wall']):return None
 owner={tuple(p):i for i,c in enumerate(layout['regions'])for p in c['pixels']};mask={tuple(p)for g in layout['gates']for p in g['patch']};bodies=[]
 for c in components(rows):
  if c['value']==layout['floor']or c['area']>49 or any(tuple(p)in mask for p in c['pixels']):continue
  around={owner.get((x+dx,y+dy))for x,y in c['pixels']for dx,dy in((1,0),(-1,0),(0,1),(0,-1))};around.discard(None)
  if len(around)==1:bodies.append({'value':c['value'],'pixels':c['pixels'],'area':c['area'],'region':next(iter(around))})
 gates=[]
 for g in layout['gates']:
  vs=[rows[y][x]for x,y in g['pixels']];opened=all(v==layout['floor']for v in vs[1:-1]);closed=vs[1:-1]==g['closed_values'][1:-1]
  if not(opened or closed):return None
  gates.append({**g,'open':opened})
 return {'gates':gates,'bodies':bodies}

def connected(layout,view,origins):
 ns=tuple('region:'+str(i)for i in range(len(layout['regions'])));edges=tuple(e for g in view['gates']if g['open']for e in((ns[g['regions'][0]],ns[g['regions'][1]]),(ns[g['regions'][1]],ns[g['regions'][0]])));graph=ConsumptionGraphD(node_refs=ns,directed_edges=edges,node_rooms=tuple((n,n)for n in ns),neighbor_order=ns)
 class Budget:
  def __init__(self):self.count=0
  def visit(self,row):
   self.count+=1
   if self.count>4096:raise ValueError('bounded region projection')
 budget=Budget();result=set()
 for i in origins:
  parents,depth,truncated=_consumption_paths(graph,ns[i],budget,len(ns));result.update(int(n.split(':')[1])for n in parents)
 return sorted(result),{'calculator':'autonomous_consumption_d._consumption_paths','visited_work':budget.count,'truncated':False,'depth_bound':len(ns),'meaning':'measured_open_region_connectivity_not_actor_access'}

def equality_pattern(values):
 labels={};return [labels.setdefault(v,len(labels))for v in values]
def paired_profiles(layout,view,gate):
 left,lp=connected(layout,view,[gate['regions'][0]]);right,rp=connected(layout,view,[gate['regions'][1]])
 if set(left)&set(right):return []
 out=[]
 for a,b in ((left,right),(right,left)):
  source=[o for o in view['bodies']if o['region']in a];target=[o for o in view['bodies']if o['region']in b];su=len({(o['value'],o['area'])for o in source})==1;tu=len({(o['value'],o['area'])for o in target})==1
  facts={'source_uniform':su,'target_uniform':tu,'source_larger_cardinality':len(source)>len(target),'source_plural':len(source)>1,'target_present':bool(target),'same_area':bool(source and target and source[0]['area']==target[0]['area']),'different_values':bool(source and target and source[0]['value']!=target[0]['value'])}
  out.append({'source_regions':a,'target_regions':b,'source_count':len(source),'target_count':len(target),'source_area':source[0]['area']if su else None,'target_area':target[0]['area']if tu else None,'facts':facts,'source_occurrences':source,'target_occurrences':target,'graph_proofs':[lp,rp]})
 return out
