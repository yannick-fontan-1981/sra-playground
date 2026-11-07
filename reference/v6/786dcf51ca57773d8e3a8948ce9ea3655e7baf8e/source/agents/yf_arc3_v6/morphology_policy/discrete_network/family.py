from pathlib import Path
from copy import deepcopy
from collections import Counter
from terminal_composition import identity
from coupled_displays import framed_rows
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .geometry import project,rectangles
from .relations import PartialRelations,graph,inspect,interior
from .topology import TopologyContinuity
HERE=Path(__file__).resolve().parent

class DiscreteNetwork:
 def __init__(self):
  declaration,=load_drm_document(HERE/'discrete_network.drm').document.declarations;self.config=dict(declaration.configuration)
  self.memory=PartialRelations();self.failed=set();self.events=[];self.topology=TopologyContinuity();self.topology_receipt=None
  self.src=SrcProgram(HERE/'discrete_network.src','v6.discrete_network.choose',{'network.measure':self.measure,'network.bind':self.select})
 def raw_projection(self,obs,rows):
  groups=framed_rows(obs,rows)
  if len(groups)!=2 or len({(b[0][2]-b[0][0],b[0][3]-b[0][1]) for b in groups})!=2:return None
  background=Counter(v for row in rows for v in row).most_common(1)[0][0]
  surfaces=[e['bbox'] for e in obs['entities'] if e['palette_value']==background]
  extent=[min(b[0] for b in surfaces),min(b[1] for b in surfaces),max(b[2] for b in surfaces),max(b[3] for b in surfaces)]
  p=project(rows,extent);p['extent']=extent;return p
 def projection(self,obs,rows):
  p=self.raw_projection(obs,rows);self.topology_receipt=None
  if p is None:return None
  if self.config.get('port_transport_recall')=='observed_discriminating_contrast_same_scope':p,self.topology_receipt=self.topology.resolve(obs,rows,p,self.memory.core_slots)
  order=graph(p)
  if order is None:return None
  sources=[n for n in order if n['role']=='source'];sinks=[n for n in order if n['role']=='sink'];gates=[n for n in order if n['role']=='component']
  if not 2<=len(sources)<=self.config['max_sources'] or not sinks or not gates:return None
  if any(len(n['incoming']) not in (2,3) for n in gates):return None
  if any(len(n['incoming'])!=1 for n in sinks):return None
  return p
 def measure(self,request):
  obs,rows,inputs,remaining=self.context;self.current=self.projection(obs,rows)
  if self.current is None or remaining<1 or 'ACTION6' not in obs['available_action_refs']:return {'status':'inconclusive'}
  self.memory.learn(self.current,rows,obs['observation_ref'])
  return self.memory.choose(self.current,rows,remaining,self.config['max_sources'],ranking=self.config['order'],control_ranking=self.config['control_order'])
 def select(self,measured):self.choice=measured;return {'selected':measured['status']=='proposed'}
 def propose(self,obs,rows,inputs,remaining):
  self.context=(obs,rows,inputs,remaining);answer,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not answer['selected']:return None
  candidate=self.choice['candidate'];node=next(n for n in self.current['nodes'] if n['id']==candidate['changes'][0]);l,t,r,b=node['box'];x,y=(l+r)//2,(t+b)//2
  trial=identity([obs['level_epoch'],obs['frame_hash'],x,y])
  if trial in self.failed:return None
  supports=[e for e in obs['entities'] if [x-e['position'][0],y-e['position'][1]] in [list(p) for p in e['mask']]]
  if len(supports)!=1:return None
  support=supports[0];action={'action_ref':'ACTION6','data':{'x':x,'y':y}};focus='composition:partial_network:'+identity([obs['observation_ref'],candidate['assignment']])[:20]
  refs=sorted({obs['observation_ref'],*(e for rows in self.memory.evidence.values() for e in rows),*(v['evidence'] for v in self.memory.goal_values.values())})
  if self.topology_receipt:refs=sorted(set(refs+self.topology_receipt['evidence']))
  facts={'current_network_bound':True,'terminal_signature_observed':True,'conditional_composition_current':True}
  return {'status':'proposed','kind':'partial_network_contrast','actions':[action],
   'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None,
    'point_binding':{'observation_ref':obs['observation_ref'],'entity_ref':support['id'],'signature':support['signature'],'bbox':support['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x]}}],
   'facts':facts,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},
   'network_plan':{'projection':self.current,'candidate':candidate,'workflow':receipt,'trial':trial,'topology_recall':deepcopy(self.topology_receipt)},
   'compositions':[{'id':focus,'role':'information_question','observed':False,'things':['measured_sources','shared_variables','partial_relations','observed_terminal_receivers'],
    'properties':{'target_assignment':candidate['assignment'],'required_changes':candidate['changes'],'unknown_rows':candidate['questions'],'port_transport_recall':deepcopy(self.topology_receipt),'falsifiers':['network_changes','different_control_effect','relation_contradiction','unexpected_receiver_state']},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}],
   'question':{'reason':self.config['question'],'hypothesis_refs':refs},'route_refs':refs,
   'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':self.config['question'],'preconditions':facts,'evidence':refs,'actions':[action],'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,domain):
  for action,step in zip(proposal['actions'],proposal['steps'],strict=True):
   if step['point_binding']['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Unbound network point')
 def before(self,proposal,index,public,obs):
  b=proposal['binding'];a=proposal['actions'][index];s=proposal['steps'][index];x,y=s['point_binding']['point'];ok=public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and public.frame_hash==b['frame_hash'] and obs['observation_ref']==b['observation_ref'] and a==s['action'] and [a['data']['x'],a['data']['y']]==s['point_binding']['point'] and a['action_ref'] in public.available_action_refs and public.frame_rows[y][x]==s['point_binding']['palette_value']
  return {'admitted':ok,'reason':'current_network_control' if ok else 'network_control_changed'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'observe_partial_relation_contrast'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  # Reconcile the old scope before observing a boundary clears its leases.
  prior_projection=self.projection(before,first)
  contrasted=[]
  if self.config.get('port_transport_recall')=='observed_discriminating_contrast_same_scope':
   contrasted=self.topology.observe(before,after,first,second,self.raw_projection(before,first),self.raw_projection(after,second),self.memory.core_slots,command)
  p=prior_projection if prior_projection is not None else self.projection(before,first)
  if p is None or command.get('action_ref')!='ACTION6':return None
  point=command.get('data',{});x,y=point.get('x',-1),point.get('y',-1);order=graph(p)
  addressed=[n for n in order if n['role']=='source' and n['box'][0]<x<n['box'][2] and n['box'][1]<y<n['box'][3]]
  if len(addressed)!=1:return None
  same=[];boxes={tuple(n['box']) for n in p['nodes']}
  for frame in frames or [second]:
   if boxes<={tuple(n['box']) for n in rectangles(frame)}:same.append(frame)
  if not same:return None
  refs=[before['observation_ref'],after['observation_ref']];last=same[-1]
  sources=[n for n in order if n['role']=='source'];changed=[n['id'] for n in sources if interior(first,n['box'])!=interior(last,n['box'])]
  if changed!=[addressed[0]['id']]:
   if proposal and 'network_plan' in proposal:self.failed.add(proposal['network_plan']['trial'])
   return {'status':'unconfirmed_control_transition','kind':'unconfirmed_control_transition','changed_sources':changed,'evidence':refs}
  self.memory.learn_channels(p,first,last,after['observation_ref']);self.memory.learn(p,first,before['observation_ref'])
  for i,frame in enumerate(same):self.memory.learn(p,frame,after['observation_ref']+':same_layout_frame:'+str(i))
  boundary=after['levels_completed']>before['levels_completed']
  if boundary:self.memory.accept_goal(p,last,after['observation_ref'])
  if first==second and proposal and 'network_plan' in proposal:self.failed.add(proposal['network_plan']['trial'])
  event={'status':'observed_partial_network','kind':'observed_partial_network','boundary':boundary,'rows':len(self.memory.rows),'conflicts':len(self.memory.conflicts),'evidence':refs,'unknown_functions_retained':True,'port_transport_acquired':contrasted,'port_transport_refutations':deepcopy(self.topology.refutations)};self.events.append(event);return event
 def state(self):return {'memory':self.memory.state(),'failed':sorted(self.failed),'events':deepcopy(self.events),'topology':self.topology.state()}
 def restore(self,state):self.memory.restore(state['memory']);self.failed=set(state['failed']);self.events=deepcopy(state['events']);self.topology.restore(state.get('topology'))
