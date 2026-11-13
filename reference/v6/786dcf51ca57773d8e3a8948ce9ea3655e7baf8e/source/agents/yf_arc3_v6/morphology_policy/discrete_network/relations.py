"""Finite partially observed relations, shared variables, no named gate laws."""
from itertools import product
from collections import defaultdict
import json

def key(value):return json.dumps(value,separators=(',',':'),sort_keys=True)

def graph(projection):
 nodes=projection['nodes'];incoming=defaultdict(list);outgoing=defaultdict(list)
 for e in projection['edges']:
  incoming[e['target']].append(e);outgoing[e['source']].append(e)
 # A port with competing causal predecessors must remain unbound.
 for target,edges in incoming.items():
  ports=[tuple(e['target_port']) for e in edges]
  if len(ports)!=len(set(ports)):return None
 for n in nodes:
  n['incoming']=sorted(incoming[n['id']],key=lambda e:tuple(e['target_port']))
  n['role']='source' if not incoming[n['id']] else 'sink' if not outgoing[n['id']] else 'component'
 pending={n['id']:n for n in nodes};order=[];done=set()
 while pending:
  ready=[n for n in pending.values() if all(e['source'] in done for e in n['incoming'])]
  if not ready:return None
  for n in sorted(ready,key=lambda n:n['id']):order.append(n);done.add(n['id']);del pending[n['id']]
 return order

def interior(rows,box):
 l,t,r,b=box
 return [rows[y][x] for y in range(t+1,b) for x in range(l+1,r)]

def inspect(projection,rows,core_slots):
 order=graph(projection)
 if order is None:return None
 view=[]
 for n in order:
  values=interior(rows,n['box']);shape=tuple(n['shape']);role=n['role'];slot=core_slots.get(str(shape));observed=None
  if role in ('source','sink'):
   if len(set(values))!=1:return None
   observed=values[0];signature=[role,shape,len(n['incoming'])]
  else:
   if slot is not None and slot<len(values):
    observed=values[slot];values=values[:];values[slot]='mutable_channel'
   signature=[role,shape,n['rim'],values,len(n['incoming'])]
  view.append({'id':n['id'],'role':role,'shape':shape,'signature':key(signature),'value':observed,'interior':interior(rows,n['box']),'parents':[e['source'] for e in n['incoming']],'box':n['box']})
 return view

class PartialRelations:
 def __init__(self):
  self.core_slots={};self.channel_evidence={};self.domains={};self.rows={};self.evidence={};self.conflicts=[];self.goal_values={};self.sources=[]
 def learn_channels(self,before_projection,before_rows,after_rows,evidence):
  order=graph(before_projection)
  if order is None:return
  for n in order:
   if n['role']!='component':continue
   a=interior(before_rows,n['box']);b=interior(after_rows,n['box']);changed=[i for i,(x,y) in enumerate(zip(a,b)) if x!=y]
   if len(changed)!=1:continue
   shape=str(tuple(n['shape']));slot=changed[0]
   if shape in self.core_slots and self.core_slots[shape]!=slot:
    self.conflicts.append({'kind':'incompatible_mutable_channel','shape':shape,'evidence':evidence});continue
   self.core_slots[shape]=slot;self.channel_evidence.setdefault(shape,[]).append(evidence)
 def learn(self,projection,rows,evidence):
  view=inspect(projection,rows,self.core_slots)
  if view is None or any(n['value'] is None for n in view):return False
  byid={n['id']:n for n in view}
  for n in view:
   channel=key([n['role'],n['shape']]);self.domains.setdefault(channel,set()).add(n['value'])
   if n['role']=='source':continue
   inputs=tuple(byid[i]['value'] for i in n['parents']);k=key([n['signature'],inputs]);old=self.rows.get(k)
   if old is not None and old!=n['value']:
    self.conflicts.append({'kind':'relation_contradiction','row':k,'before':old,'after':n['value'],'evidence':evidence});continue
   self.rows[k]=n['value'];self.evidence.setdefault(k,[]).append(evidence)
  return True
 def accept_goal(self,projection,rows,evidence):
  view=inspect(projection,rows,self.core_slots)
  if view is None:return False
  sinks=[n for n in view if n['role']=='sink']
  if not sinks or any(n['value'] is None for n in sinks):return False
  pending={}
  for n in sinks:
   signature=n['signature'];value=n['value'];old=pending.get(signature,self.goal_values.get(signature))
   if old is not None and old['value']!=value:
    self.goal_values.pop(signature,None)
    self.conflicts.append({'kind':'terminal_goal_signature_ambiguous','signature':signature,'before':old['value'],'after':value,'evidence':evidence})
    return False
   pending[signature]={'value':value,'evidence':evidence}
  self.goal_values.update(pending)
  return True
 def possibilities(self,view,assignment,limit=4096):
  branches=[({'values':dict(assignment),'local_rows':{},'questions':set()})];visited=0
  for n in view:
   if n['role']=='source':continue
   next_branches=[];domain=self.domains.get(key([n['role'],n['shape']]),set())
   if len(domain)!=2:return None
   for b in branches:
    inputs=tuple(b['values'][i] for i in n['parents']);k=key([n['signature'],inputs]);known=self.rows.get(k,b['local_rows'].get(k));options=[known] if known is not None else sorted(domain)
    for output in options:
     visited+=1
     if visited>limit:return None
     values={**b['values'],n['id']:output};local={**b['local_rows'],k:output};questions=b['questions']|({k} if k not in self.rows else set())
     next_branches.append({'values':values,'local_rows':local,'questions':questions})
   branches=next_branches
  sinks=[n for n in view if n['role']=='sink']
  for b in branches:b['goal']=all(n['signature'] in self.goal_values and b['values'][n['id']]==self.goal_values[n['signature']]['value'] for n in sinks)
  return branches
 def choose(self,projection,rows,remaining,max_sources=8,ranking=None,control_ranking=None):
  if self.conflicts:return {'status':'inconclusive','reason':'unreconciled_relation_conflict'}
  view=inspect(projection,rows,self.core_slots)
  if view is None or any(n['value'] is None for n in view):return {'status':'inconclusive','reason':'unreadable_current_channel'}
  sources=[n for n in view if n['role']=='source'];sinks=[n for n in view if n['role']=='sink']
  if not sources or len(sources)>max_sources or not sinks or any(n['signature'] not in self.goal_values for n in sinks):return {'status':'inconclusive','reason':'goal_or_source_scope_unqualified'}
  domains=[sorted(self.domains.get(key([n['role'],n['shape']]),set())) for n in sources]
  if any(len(d)!=2 or n['value'] not in d for n,d in zip(sources,domains)):return {'status':'inconclusive','reason':'control_alphabet_unqualified'}
  candidates=[];probe_predictions={}
  for values in product(*domains):
   assignment={n['id']:v for n,v in zip(sources,values)};changes=[n['id'] for n,v in zip(sources,values) if n['value']!=v]
   if not 0<len(changes)<=remaining:continue
   branches=self.possibilities(view,assignment)
   if branches is None:return {'status':'inconclusive','reason':'bounded_domain_exhausted'}
   if len(changes)==1:probe_predictions[changes[0]]=branches
   goals=[b for b in branches if b['goal']]
   if not goals:continue
   robust=len(goals)==len(branches);questions=set().union(*(b['questions'] for b in branches));outcomes={tuple(b['values'][n['id']] for n in view if n['role']!='source') for b in branches}
   candidates.append({'assignment':assignment,'changes':changes,'robust':robust,'questions':sorted(questions),'distinct_observable_outcomes':len(outcomes),'compatible_goal_outcomes':len(goals),'outcomes':len(branches)})
  if not candidates:return {'status':'inconclusive','reason':'no_goal_compatible_assignment_in_partial_model'}
  # The released prefix is one source change. Measure its predictions, not
  # the uncertainty of a later composition that has not yet been executed.
  control_order=control_ranking or ['maximize_goal_relation_contrasts','maximize_observable_alternatives','stable_source_identity']
  def control_rank(p):
   features={'maximize_goal_relation_contrasts':-p['goal_relation_contrasts'],'maximize_observable_alternatives':-p['observable_outcomes'],'stable_source_identity':p['source']}
   if len(control_order)!=len(set(control_order)) or set(control_order)!=set(features):raise ValueError('Unqualified network control rank declaration')
   return tuple(features[k] for k in control_order)
  for candidate in candidates:
   questions=set(candidate['questions']);options=[]
   for source in candidate['changes']:
    branches=probe_predictions[source]
    patterns={tuple(sorted((k,v) for k,v in b['local_rows'].items() if k in questions)) for b in branches}
    observables={tuple(b['values'][n['id']] for n in view if n['role']!='source') for b in branches}
    options.append({'source':source,'goal_relation_contrasts':len(patterns),'observable_outcomes':len(observables)})
   if candidate['robust']:
    selected=options[0]
   else:
    selected=min(options,key=control_rank)
   candidate['changes']=[selected['source']]+[s for s in candidate['changes'] if s!=selected['source']]
   candidate['next_control_evidence']={'selected':selected,'alternatives':options,'scope':'predictions for one actually released control; conditional on current partial relations'}
  order=ranking or ['prefer_goal_common_to_all_compatible_relations','minimize_required_control_changes','maximize_next_goal_relation_contrasts','maximize_next_observable_alternatives','stable_source_identity']
  def rank(c):
   next_control=c['next_control_evidence']['selected']
   features={'prefer_goal_common_to_all_compatible_relations':not c['robust'],'minimize_required_control_changes':len(c['changes']),'maximize_next_goal_relation_contrasts':-next_control['goal_relation_contrasts'],'maximize_next_observable_alternatives':-next_control['observable_outcomes'],'stable_source_identity':tuple(c['changes'])}
   if len(order)!=len(set(order)) or set(order)!=set(features):raise ValueError('Unqualified network rank declaration')
   return tuple(features[k] for k in order)
  selected=min(candidates,key=rank)
  return {'status':'proposed','candidate':selected,'candidate_count':len(candidates),'scope':'conditional predicted composition; unknown rows are experiments, not verified effects'}

 def state(self):
  return {'core_slots':self.core_slots,'channel_evidence':self.channel_evidence,'domains':{k:sorted(v) for k,v in self.domains.items()},'rows':self.rows,'evidence':self.evidence,'conflicts':self.conflicts,'goal_values':self.goal_values}
 def restore(self,state):
  self.core_slots=state['core_slots'];self.channel_evidence=state['channel_evidence'];self.domains={k:set(v) for k,v in state['domains'].items()};self.rows=state['rows'];self.evidence=state['evidence'];self.conflicts=state['conflicts'];self.goal_values=state['goal_values']
