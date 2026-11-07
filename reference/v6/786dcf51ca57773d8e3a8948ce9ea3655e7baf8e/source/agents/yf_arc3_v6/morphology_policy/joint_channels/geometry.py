from collections import Counter,deque
from hashlib import sha256
import json,heapq
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
from agents.yf_arc3_v5.capabilities.compatible_source_residual_d import _residual_components

def digest(v):return sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def tile(rows,b):return [list(r[b[0]:b[2]+1])for r in rows[b[1]:b[3]+1]]
def marker(t):
 n=len(t);m=len(t[0]);y=n//2;x=m//2
 if n<3 or m<3:return None
 c=t[y][x];cross=[t[y+dy][x+dx]for dx,dy in[(0,-1),(0,1),(-1,0),(1,0)]];corners=[t[y+dy][x+dx]for dx,dy in[(-1,-1),(-1,1),(1,-1),(1,1)]]
 if len(set(cross))==1 and cross[0]!=c and all(v==c for v in corners) and sum(v!=c for r in t for v in r)==4:return {'kind':'cross','pigment':c,'mark':cross[0]}
 if len(set(corners))==1 and corners[0]!=c and all(v==c for v in cross) and sum(v!=c for r in t for v in r)==4:return {'kind':'corners','pigment':corners[0],'background':c}
 return None

def acquire(rows,obs):
 results=[]
 for g in enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,rows))))).candidates:
  if g.row_gap or g.col_gap or g.cell_height!=g.cell_width:continue
  cells=[]
  for c in g.cells:
   b=[c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom];t=tile(rows,b);cells.append({'bbox':b,'point':[b[0]+g.cell_width//2,b[1]+g.cell_height//2],'tile':t,'pattern':digest(t),'marker':marker(t)})
  groups={}
  for c in cells:groups.setdefault(c['pattern'],[]).append(c)
  for pattern,group in groups.items():
   if len(group)<4 or len({v for r in group[0]['tile']for v in r})<2:continue
   x0=min(c['bbox'][0]for c in group);x1=max(c['bbox'][0]for c in group);y0=min(c['bbox'][1]for c in group);y1=max(c['bbox'][1]for c in group);field=[c for c in cells if x0<=c['bbox'][0]<=x1 and y0<=c['bbox'][1]<=y1]
   if not field or any(c['pattern']!=pattern for c in field if c['bbox'][0]in(x0,x1)or c['bbox'][1]in(y0,y1)):continue
   sources=[c for c in field if c['marker']and c['marker']['kind']=='cross'];targets=[c for c in field if c['marker']and c['marker']['kind']=='corners']
   if not sources or not targets:continue
   others=Counter(c['pattern']for c in field if not c['marker']and c['pattern']!=pattern and len({v for r in c['tile']for v in r})>1)
   if not others or list(others.values()).count(max(others.values()))!=1:continue
   soft=others.most_common(1)[0][0]
   if any(not c['marker']and c['pattern']not in(pattern,soft)and len({v for r in c['tile']for v in r})!=1 for c in field):continue
   for i,c in enumerate(field):c['ref']=str(i);c['class']='boundary_pattern'if c['pattern']==pattern else'candidate_edit'if c['pattern']==soft else'initial_open_hypothesis'
   results.append({'cells':field,'pitch':[g.col_pitch,g.row_pitch],'bbox':[x0,y0,x1+g.cell_width-1,y1+g.cell_height-1],'blocked_pattern':pattern,'editable_pattern':soft,'grid_ref':g.candidate_ref,'evidence':[obs['observation_ref']],'epoch':obs['level_epoch']})
 if len(results)!=1:return None
 return results[0]

def current(layout,rows):
 if not layout:return None
 out=[]
 for c in layout['cells']:
  t=tile(rows,c['bbox']);q={**c,'current_tile':t,'current_pattern':digest(t)}
  if c['class']=='boundary_pattern'and t!=c['tile']:return None
  if c['marker']:
   m=marker(t)
   # Original source identity and target marks are retained separately from flowing background.
   if c['marker']['kind']=='cross':
    y=len(t)//2;x=len(t[0])//2
    if t[y][x]!=c['marker']['pigment']or any(t[y+dy][x+dx]!=c['marker']['mark']for dx,dy in[(0,-1),(0,1),(-1,0),(1,0)]):return None
   if c['marker']['kind']=='corners':
    n=len(t);y=n//2;x=len(t[0])//2
    if any(t[y+dy][x+dx]!=c['marker']['pigment']for dx,dy in[(-1,-1),(-1,1),(1,-1),(1,1)]):return None
  if c['class']=='candidate_edit'and t!=c['tile']and len({v for r in t for v in r})!=1:return None
  q['opened']=c['class']=='initial_open_hypothesis'or(c['class']=='candidate_edit'and t!=c['tile']);out.append(q)
 return out

class Budget:
 def __init__(self):self.count=0
 def visit(self,v):self.count+=1

def joint_plan(layout,view,limit=16000,path_limit=96):
 cells={c['ref']:c for c in view};available={k for k,c in cells.items()if c['class']!='boundary_pattern'};opened={k for k,c in cells.items()if c['opened']};edges=[];adj={k:[]for k in cells};pitch=layout['pitch']
 for i,c in cells.items():
  for j,d in cells.items():
   if i<j and((abs(c['point'][0]-d['point'][0])==pitch[0]and c['point'][1]==d['point'][1])or(abs(c['point'][1]-d['point'][1])==pitch[1]and c['point'][0]==d['point'][0])):
    edges.append(SimpleNamespace(first_ref=i,second_ref=j,edge_ref=i+':'+j));adj[i].append(j);adj[j].append(i)
 sources={};targets={}
 for k,c in cells.items():
  if c['marker']:(sources if c['marker']['kind']=='cross'else targets).setdefault(c['marker']['pigment'],[]).append(k)
 if set(sources)!=set(targets)or any(len(v)!=1 for v in [*sources.values(),*targets.values()]):return None
 pairs=[(sources[v][0],targets[v][0],v)for v in sorted(targets)];labels={s:v for s,t,v in pairs}|{t:v for s,t,v in pairs};budget=Budget();iterations=0
 def closure(chosen):
  comps,by=_residual_components(opened|set(chosen),edges,budget)
  return comps,by
 def clean(chosen):
  comps,by=closure(chosen)
  return all(len({labels[x]for x in co if x in labels})<=1 for co in comps)
 def paths(s,t,blocked):
  allowed=available-set(blocked);heap=[(0,0,(s,))];serial=0;found=[];seen=0
  while heap and len(found)<path_limit and seen<limit:
   cost,_,path=heapq.heappop(heap);seen+=1;v=path[-1]
   if v==t:found.append(path);continue
   for n in sorted(adj[v]):
    if n in allowed and n not in path:
     serial+=1;heapq.heappush(heap,(cost+(n not in opened),serial,path+(n,)))
  return found,seen
 def search(todo,chosen,orders):
  nonlocal iterations
  iterations+=1
  if iterations>limit or not clean(chosen):return None
  comps,by=closure(chosen);remaining=[p for p in todo if by[p[0]]!=by[p[1]]]
  if not remaining:return orders
  choices=[]
  for s,t,v in remaining:
   bad={x for co in comps if any(labels.get(z)not in(None,v)for z in co)for x in co};blocked=bad|{n for x in bad for n in adj[x]};ps,work=paths(s,t,blocked);iterations+=work
   if not ps:return None
   choices.append((len(ps),s,t,v,ps))
  _,s,t,v,ps=min(choices,key=lambda z:(z[0],z[1]))
  for path in ps:
   new=set(path)-opened-set(chosen)
   if not clean(set(chosen)|new):continue
   answer=search([p for p in remaining if p!=(s,t,v)],set(chosen)|new,orders+[{'source':s,'target':t,'pigment':v,'path':list(path),'excavations':[x for x in path if x in new]}])
   if answer is not None:return answer
  return None
 answer=search(pairs,set(),[])
 if answer is None:return None
 digs=[x for q in answer for x in q['excavations']]
 return {'orders':answer,'excavations':digs,'total_cost':len(digs),'hypothetical_pairs':[list(p)for p in pairs],'joint_contacts_checked':True,'calculator':'compatible_source_residual_d._residual_components','work':iterations,'bounded_search':True,'candidate_domain_complete':False,'next':cells[digs[0]]if digs else None}

def affected_component(layout,view,cell_ref):
 nodes={c['ref']for c in view if c['opened']}|{cell_ref};edges=[];pitch=layout['pitch']
 for c in view:
  for d in view:
   if c['ref']<d['ref']and((abs(c['point'][0]-d['point'][0])==pitch[0]and c['point'][1]==d['point'][1])or(abs(c['point'][1]-d['point'][1])==pitch[1]and c['point'][0]==d['point'][0])):edges.append(SimpleNamespace(first_ref=c['ref'],second_ref=d['ref'],edge_ref=c['ref']+':'+d['ref']))
 comps,by=_residual_components(nodes,edges,Budget());return set(comps[by[cell_ref]])


def remaining_group_hypothesis(view,methods):
 from itertools import combinations
 sources=[c for c in view if c['marker']and c['marker']['kind']=='cross'];targets=[c for c in view if c['marker']and c['marker']['kind']=='corners'];groups=[];used=set();unmatched=[]
 for t in targets:
  peers=[c for c in sources if c['marker']['pigment']==t['marker']['pigment']]
  if len(peers)==1:groups.append({'sources':[peers[0]['ref']],'target':t['ref'],'required_display':t['marker']['pigment'],'status':'direct_correspondence_hypothesis'});used.add(peers[0]['ref'])
  elif not peers:unmatched.append(t)
  else:return None
 if len(unmatched)!=1:return None
 remaining=[c for c in sources if c['ref']not in used];target=unmatched[0];known={}
 for m in methods:
  for e in m.get('equilibria',[]):
   if e.get('provenance_status','measured_contrasted_markers')=='measured_contrasted_markers':known.setdefault(tuple(e['original_source_set']),set()).add(e['display_value'])
 # Unknown subsets remain candidates. Singleton observations exclude only their incompatible displayed result.
 alternatives=[];rejected=[]
 for count in range(1,len(remaining)+1):
  for subset in combinations(remaining,count):
   values=tuple(sorted({c['marker']['pigment']for c in subset}));outputs=known.get(values)
   if outputs and len(outputs)>1:return None # conflicting empirical outputs cannot support a stable-set exclusion
   entry={'source_refs':[c['ref']for c in subset],'original_source_set':list(values),'observed_outputs':sorted(outputs)if outputs else [],'target':target['ref'],'required_display':target['marker']['pigment']}
   if outputs and target['marker']['pigment']not in outputs:rejected.append(entry)
   else:alternatives.append(entry)
 if len(alternatives)!=1:return None
 chosen=alternatives[0];groups.append({'sources':chosen['source_refs'],'target':chosen['target'],'required_display':chosen['required_display'],'status':'unknown_source_subset_experiment'})
 return {'groups':groups,'remaining_alternatives':alternatives,'rejected_under_observed_stable_output_model':rejected,'unknown_subset_output':True,'uniqueness_is_model_conditioned':True}

def group_plan(layout,view,hypothesis,limit=16000,path_limit=96):
 cells={c['ref']:c for c in view};available={k for k,c in cells.items()if c['class']!='boundary_pattern'};opened={k for k,c in cells.items()if c['opened']};edges=[];adj={k:[]for k in cells};pitch=layout['pitch']
 for i,c in cells.items():
  for j,d in cells.items():
   if i<j and((abs(c['point'][0]-d['point'][0])==pitch[0]and c['point'][1]==d['point'][1])or(abs(c['point'][1]-d['point'][1])==pitch[1]and c['point'][0]==d['point'][0])):edges.append(SimpleNamespace(first_ref=i,second_ref=j,edge_ref=i+':'+j));adj[i].append(j);adj[j].append(i)
 groups=[g['sources']+[g['target']]for g in hypothesis['groups']];labels={v:i for i,g in enumerate(groups)for v in g}
 for k,c in cells.items():
  if c['marker']and k not in labels:labels[k]=len(groups)+len(labels)
 budget=Budget();work=0
 def closure(chosen):return _residual_components(opened|set(chosen),edges,budget)
 def clean(comps):return all(len({labels[v]for v in co if v in labels})<=1 for co in comps)
 def paths(start,end,blocked):
  heap=[(0,0,(start,))];serial=0;seen=0;found=[]
  while heap and len(found)<path_limit and seen<limit:
   cost,_,path=heapq.heappop(heap);seen+=1;x=path[-1]
   if x==end:found.append(path);continue
   for n in sorted(adj[x]):
    if n in available and n not in blocked and n not in path:serial+=1;heapq.heappush(heap,(cost+(n not in opened),serial,path+(n,)))
  return found,seen
 def search(chosen,orders):
  nonlocal work
  work+=1
  if work>limit:return None
  comps,by=closure(chosen)
  if not clean(comps):return None
  todo=[(i,g)for i,g in enumerate(groups)if len({by[x]for x in g})>1]
  if not todo:return orders
  options=[]
  for i,g in todo:
   bad={x for co in comps if any(labels.get(v)not in(None,i)for v in co)for x in co};blocked=bad|{n for x in bad for n in adj[x]};candidates=[]
   optimistic,positions=_residual_components(available-blocked,edges,budget)
   if any(x not in positions for x in g)or len({positions[x]for x in g})!=1:return None
   for t in g[1:]:
    if by[g[0]]==by[t]:continue
    ps,n=paths(g[0],t,blocked);work+=n
    candidates.extend((path,t)for path in ps)
   if not candidates:return None
   options.append((len(candidates),i,g,candidates))
  _,i,g,candidates=min(options,key=lambda x:(x[0],x[1]))
  for path,t in candidates:
   new=set(path)-opened-set(chosen);answer=search(set(chosen)|new,orders+[{'source':g[0],'target':t,'group':i,'path':list(path),'excavations':[v for v in path if v in new]}])
   if answer is not None:return answer
  return None
 answer=search(set(),[])
 if answer is None:return None
 digs=[v for q in answer for v in q['excavations']]
 return {'orders':answer,'excavations':digs,'total_cost':len(digs),'hypothetical_pairs':[[g['sources'][0],g['target'],g['required_display']]for g in hypothesis['groups']],'source_group_hypothesis':hypothesis,'joint_contacts_checked':True,'calculator':'compatible_source_residual_d._residual_components','work':work,'bounded_search':True,'candidate_domain_complete':False,'next':cells[digs[0]]if digs else None}


def merged_marker_hypothesis(layout):
 from copy import deepcopy
 layout=deepcopy(layout);sources=[c for c in layout['cells']if c['marker']and c['marker']['kind']=='cross'];targets=[c for c in layout['cells']if c['marker']and c['marker']['kind']=='corners'];marks={c['marker']['mark']for c in sources}
 if len(marks)!=1:return layout
 mark=next(iter(marks));requests=[c for c in targets if c['marker']['pigment']==mark]
 if len(requests)!=1 or any(c['marker']['pigment']==mark for c in sources):return layout
 candidates=[c for c in layout['cells']if c['class']=='initial_open_hypothesis'and not c['marker']and {v for r in c['tile']for v in r}=={mark}]
 if len(candidates)!=1:return layout
 candidates[0]['marker']={'kind':'cross','pigment':mark,'mark':mark,'role_status':'coincident_glyph_hypothesis_not_observed_source'};layout['merged_marker_hypothesis']={'cell':candidates[0]['ref'],'reception':requests[0]['ref'],'current_cross_mark':mark,'facts':{'unique_uniform_match':True,'unique_current_cross_mark':True,'current_receiver_homologue':True},'unknown':['source_role','zero_contrast_glyph_interpretation']};return layout

def assignment_hypotheses(view,methods,bound):
 from itertools import combinations,product
 sources=[c for c in view if c['marker']and c['marker']['kind']=='cross'];targets=[c for c in view if c['marker']and c['marker']['kind']=='corners'];known={}
 for m in methods:
  for e in m.get('equilibria',[]):
   if e.get('provenance_status','measured_contrasted_markers')=='measured_contrasted_markers':known.setdefault(tuple(e['original_source_set']),set()).add(e['display_value'])
 direct=[];unknown=[]
 for t in targets:
  matches=[c for c in sources if c['marker']['pigment']==t['marker']['pigment']]
  if matches:direct.append((t,matches))
  else:unknown.append(t)
 if not unknown:return None
 outputs=[];truncated=False;contradicted=False
 def extend(index,remaining,groups,rejected):
  nonlocal truncated,contradicted
  if len(outputs)>=bound:truncated=True;return
  if index==len(unknown):outputs.append({'groups':groups,'observed_exclusions':rejected,'unknown_subset_output':True,'assignment_is_hypothesis':True});return
  target=unknown[index]
  for n in range(1,len(remaining)+1):
   for subset in combinations(remaining,n):
    values=tuple(sorted({c['marker']['pigment']for c in subset}));actual=known.get(values)
    if actual and len(actual)>1:contradicted=True;return
    if actual and target['marker']['pigment']not in actual:continue
    ids=[c['ref']for c in subset];g={'sources':ids,'target':target['ref'],'required_display':target['marker']['pigment'],'status':'observed_output_compatible_hypothesis'if actual else'unknown_source_subset_experiment','original_source_set':list(values),'observed_outputs':sorted(actual)if actual else []};extend(index+1,[c for c in remaining if c['ref']not in ids],groups+[g],rejected)
 for chosen in product(*(matches for target,matches in direct)):
  if len({c['ref']for c in chosen})!=len(chosen):continue
  used={c['ref']for c in chosen};groups=[{'sources':[c['ref']],'target':t['ref'],'required_display':t['marker']['pigment'],'status':'direct_correspondence_hypothesis'}for(t,matches),c in zip(direct,chosen)];extend(0,[c for c in sources if c['ref']not in used],groups,[])
 if contradicted or not outputs:return None
 return {'assignments':outputs,'enumeration_truncated':truncated,'direct_correspondence_preference_is_prior':True,'all_sources_required':False}

def prioritize_source_fusions(plan):
 from copy import deepcopy
 q=deepcopy(plan);groups=q['source_group_hypothesis']['groups'];early=[];late=[]
 for order in q['orders']:
  group=groups[order['group']]
  (early if len(group['sources'])>1 and order['target']in group['sources']else late).append(order)
 allowed=set(q['excavations']);seen=set();digs=[]
 for order in early+late:
  for cell in order['path']:
   if cell in allowed and cell not in seen:seen.add(cell);digs.append(cell)
 if seen!=allowed:raise ValueError('Reordering changed joint excavation set')
 q['orders']=early+late;q['excavations']=digs;q['fusion_first_is_conditional_order']=True
 return q

def contrary_assignment(plan,component,display):
 return [g for g in plan.get('source_group_hypothesis',{}).get('groups',[])if set(g['sources'])<=set(component)and g['required_display']!=display]
