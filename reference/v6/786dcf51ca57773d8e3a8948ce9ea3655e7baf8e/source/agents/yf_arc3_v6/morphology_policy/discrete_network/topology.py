"""Conditional port transmission identified by public before/after contrasts."""
from copy import deepcopy
from collections import defaultdict
import hashlib,json
from .relations import graph,interior

def edge_key(edge):return (edge['source'],edge['target'],tuple(edge['source_port']),tuple(edge['target_port']))
def value(rows,point):return rows[point[1]][point[0]]

def structural_key(obs,rows,projection,core_slots,signal_values):
 if projection is None:return None
 normalized=[list(row) for row in rows];nodes=[]
 route_palette={value(rows,point) for node in projection['nodes'] for points in node['ports'].values() for point in points}
 left,top,right,bottom=projection['extent']
 for y in range(top,bottom+1):
  for x in range(left,right+1):
   if rows[y][x] in route_palette:normalized[y][x]='measured_route_support'
 for node in projection['nodes']:
  l,t,r,b=node['box'];points=[(x,y) for y in range(t+1,b) for x in range(l+1,r)];values=[rows[y][x] for x,y in points];slot=core_slots.get(str(tuple(node['shape'])))
  if len(set(values))==1:
   for x,y in points:normalized[y][x]='uniform_observed_channel'
  elif slot is not None and slot<len(points):
   x,y=points[slot];normalized[y][x]='observed_mutable_channel'
  else:return None
  stable_values=list(values)
  if len(set(values))==1:stable_values=['uniform_observed_channel']
  elif slot is not None and slot<len(stable_values):stable_values[slot]='observed_mutable_channel'
  nodes.append([node['id'],node['box'],node['shape'],node['rim'],node['ports'],stable_values])
 payload=[obs['level_epoch'],projection.get('extent'),nodes,normalized]
 return hashlib.sha256(json.dumps(payload,separators=(',',':'),sort_keys=True).encode()).hexdigest()

class TopologyContinuity:
 def __init__(self):self.receipts={};self.refutations=[]
 def observe(self,before,after,first,second,left,right,core_slots,command):
  if before['level_epoch']!=after['level_epoch']:self.receipts={};return []
  if left is None or right is None or command.get('action_ref')!='ACTION6':return []
  incoming={e['target'] for e in left['edges']};sources=[n for n in left['nodes'] if n['id'] not in incoming];data=command.get('data',{});x,y=data.get('x',-1),data.get('y',-1)
  addressed=[n['id'] for n in sources if n['box'][0]<x<n['box'][2] and n['box'][1]<y<n['box'][3]]
  changed=[n['id'] for n in sources if interior(first,n['box'])!=interior(second,n['box'])]
  if len(addressed)!=1 or changed!=addressed:return []
  groups=defaultdict(dict)
  for edge in left['edges']+right['edges']:groups[(edge['target'],tuple(edge['target_port']))][edge_key(edge)]=edge
  acquired=[]
  for port,options in groups.items():
   if len(options)<2:continue
   a,b=value(first,port[1]),value(second,port[1])
   if a==b:continue
   matches=[e for e in options.values() if value(first,e['source_port'])==a and value(second,e['source_port'])==b]
   if len(matches)!=1:continue
   chosen=matches[0];alphabet=sorted({a,b});left_key=structural_key(before,first,left,core_slots,alphabet);right_key=structural_key(after,second,right,core_slots,alphabet)
   if not left_key or left_key!=right_key:continue
   receipt={'level_epoch':before['level_epoch'],'structural_key':left_key,'edge':edge_key(chosen),'signal_values':alphabet,'evidence':[before['observation_ref'],after['observation_ref']],'addressed_source':addressed[0],
    'contrast':{'target':[a,b],'candidates':[{'edge':edge_key(e),'signal':[value(first,e['source_port']),value(second,e['source_port'])]} for e in options.values()]},
    'claim':'one_source_matches_changed_target_port_under_equal_signal_transport_hypothesis; target_output_need_not_change'}
   self.receipts[str(port)]=receipt;acquired.append(receipt)
  return acquired
 def resolve(self,obs,rows,raw,core_slots):
  for key,receipt in list(self.receipts.items()):
   if receipt['level_epoch']!=obs['level_epoch'] or structural_key(obs,rows,raw,core_slots,receipt['signal_values'])!=receipt['structural_key']:continue
   edge=receipt['edge'];source=value(rows,edge[2]);target=value(rows,edge[3])
   if source!=target or source not in receipt['signal_values']:
    self.receipts.pop(key,None)
    self.refutations.append({'status':'port_transport_refuted','edge':deepcopy(edge),'observed_signal':[source,target],'evidence':receipt['evidence']+[obs['observation_ref']],'reason':'current_source_target_signal_contradiction_in_revalidated_scope'})
  if graph(deepcopy(raw)) is not None:return raw,None
  groups=defaultdict(list)
  for edge in raw['edges']:groups[(edge['target'],tuple(edge['target_port']))].append(edge)
  resolved=deepcopy(raw);used=[]
  for port,options in groups.items():
   if len(options)<2:continue
   receipt=self.receipts.get(str(port))
   if not receipt or receipt['level_epoch']!=obs['level_epoch'] or structural_key(obs,rows,raw,core_slots,receipt['signal_values'])!=receipt['structural_key']:continue
   e=receipt['edge'];known=(e[0],e[1],tuple(e[2]),tuple(e[3]));matches=[edge for edge in options if edge_key(edge)==known]
   if len(matches)!=1 or value(rows,known[2])!=value(rows,known[3]):continue
   if value(rows,known[2]) not in receipt['signal_values']:continue
   resolved['edges']=[edge for edge in resolved['edges'] if (edge['target'],tuple(edge['target_port']))!=port or edge_key(edge)==known]
   used.append({**deepcopy(receipt),'current_observation_ref':obs['observation_ref'],'discarded_visual_alternatives':len(options)-1})
  if not used or graph(resolved) is None:return raw,None
  return resolved,{'status':'contrasted_port_transport_revalidated','evidence':sorted({ref for receipt in used for ref in receipt['evidence']}),'bindings':used,'current_observation_ref':obs['observation_ref']}
 def state(self):return {'receipts':deepcopy(self.receipts),'refutations':deepcopy(self.refutations)}
 def restore(self,state):
  state=state or {};self.receipts=deepcopy(state.get('receipts',state if 'refutations' not in state else {}));self.refutations=deepcopy(state.get('refutations',[]))
