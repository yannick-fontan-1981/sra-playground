"""Public coupled translations, measured reflection parameters, and retained coverage."""
from collections import Counter
from itertools import combinations,product
import copy,json
from pathlib import Path
from common_fixed_origin import parts
from common_multiscale_constraints import digest
from src_bridge import plain
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.reflection_structure import _reflect_rows,_reflect_columns,_orthogonally_connected_cell_sets,measure_orthogonal_reflection_lattice_object_audit

def shifted(points,d):return {(x+d[0],y+d[1])for x,y in points}
def reflected(points,a,dim):
 f=_reflect_columns if dim==0 else _reflect_rows
 return {(c,r)for r,c in f(frozenset((y,x)for x,y in points),2*a)}
def groups(points):return [set((c,r)for r,c in g)for g in _orthogonally_connected_cell_sets(frozenset((y,x)for x,y in points))]
def lattice(rows,hint=None):
 h,w=len(rows),len(rows[0]);cs=parts(rows);bands={}
 for c in cs:
  b=c.bbox;ww=b.right-b.left+1;hh=b.bottom-b.top+1
  if not(2<=min(ww,hh)<=min(h,w)//8 and max(ww,hh)>=min(h,w)*.3):continue
  dim=0 if hh>ww else 1;key=(dim,b.left if dim==0 else b.top,min(ww,hh),c.value);bands.setdefault(key,set()).update(range(b.top if dim==0 else b.left,(b.bottom if dim==0 else b.right)+1))
 candidates=[key for key,extent in bands.items()if len(extent)>=min(h,w)*.7 and max(extent)-min(extent)+1>=min(h,w)*.8]
 if not candidates and hint:
  dim=hint['dim'];pitch=hint['pitch'];color=hint['axis_color'];segments={}
  for c in cs:
   b=c.bbox
   if c.value!=color or (b.width if dim==0 else b.height)!=pitch:continue
   pos=b.left if dim==0 else b.top
   if (pos-hint['phase'][dim])%pitch:continue
   segments.setdefault(pos,set()).update(range(b.top if dim==0 else b.left,(b.bottom if dim==0 else b.right)+1))
  direct=set().union(*hint['bodies'])
  for pos,extent in segments.items():
   a=(pos-hint['phase'][dim])//pitch;layers={hint['direct']:direct,hint['image']:reflected(direct,a,dim),hint['target']:hint['targets']};valid=True;marker_masks=set()
   def patch(cell):
    xx=hint['phase'][0]+cell[0]*pitch;yy=hint['phase'][1]+cell[1]*pitch
    return {(dx,dy):rows[yy+dy][xx+dx]for dy in range(pitch)for dx in range(pitch)}
   for q in range(hint['ny']if dim==0 else hint['nx']):
    cell=(a,q)if dim==0 else(q,a);center=hint['phase'][1-dim]+q*pitch+pitch//2
    if center not in extent:continue
    values=patch(cell)
    if set(values.values())<={color,hint['marker_value']}:marker_masks.add(frozenset(p for p,v in values.items()if v==hint['marker_value']))
   marker_masks.discard(frozenset())
   for q in range(hint['ny']if dim==0 else hint['nx']):
    cell=(a,q)if dim==0 else(q,a);center=hint['phase'][1-dim]+q*pitch+pitch//2
    if center in extent:continue
    x,y=pixel(hint,cell);allowed={v for v,points in layers.items()if cell in points}
    if not(0<=x<w and 0<=y<h):valid=False;break
    values=patch(cell);supported=False
    for material in allowed:
     residual=frozenset(p for p,v in values.items()if v!=material)
     if not residual or (len(marker_masks)==1 and residual in marker_masks and all(values[p]==hint['marker_value']for p in residual)):supported=True
    if not supported:valid=False;break
   if valid and len(extent)>=min(h,w)*.5 and max(extent)-min(extent)+1>=min(h,w)*.8:candidates.append((dim,pos,pitch,color))
 if len(candidates)!=1:return None
 dim,pos,pitch,color=candidates[0];compact=[c for c in cs if pitch<=min(c.bbox.width,c.bbox.height)and max(c.bbox.width,c.bbox.height)<min(h,w)/2]
 if len(compact)<3:return None
 phases=[]
 for axis in (0,1):
  counts=Counter((c.bbox.left if axis==0 else c.bbox.top)%pitch for c in compact);top=counts.most_common()
  if len(top)>1 and top[0][1]==top[1][1]:return None
  phases.append(top[0][0])
 if (pos-phases[dim])%pitch:return None
 nx=(w-phases[0])//pitch;ny=(h-phases[1])//pitch;cells={};marks=set();mark_values={}
 for y in range(ny):
  for x in range(nx):
   values=[rows[phases[1]+y*pitch+r][phases[0]+x*pitch+c]for r in range(pitch)for c in range(pitch)];value,n=Counter(values).most_common(1)[0];cells[x,y]=value
   if n==pitch*pitch-1:marks.add((x,y));mark_values[x,y]=next(v for v in values if v!=value)
 bg=Counter(cells.values()).most_common(1)[0][0];families={v:{p for p,c in cells.items()if c==v}for v in set(cells.values())if v not in (bg,color)}
 return {'pitch':pitch,'phase':tuple(phases),'nx':nx,'ny':ny,'dim':dim,'axis':(pos-phases[dim])//pitch,'axis_color':color,'background':bg,'cells':cells,'marks':marks,'mark_values':mark_values,'families':families}
def focus(w,s,retain=False):
 marks={p for p in s['marks']if s['mark_values'][p]==w['marker_value']};axis={p for p in marks if p[w['dim']]==w['axis']};bodymarks=marks&set().union(*w['bodies'])
 if axis and all(p[w['dim']]==w['axis']for p in bodymarks):return 'axis'
 candidates=[i for i,b in enumerate(w['bodies'])if marks&b and marks<=b]
 if len(candidates)==1:return candidates[0]
 if retain and not marks:return w.get('focus')
 return None
def visible(points,s):return {p for p in points if 0<=p[0]<s['nx'] and 0<=p[1]<s['ny']}
def initialize(s,prior_color=None,prior_marker=None,prior_image=None):
 pairs=[(a,b)for a,b in combinations(s['families'],2)if reflected(s['families'][a],s['axis'],s['dim'])==s['families'][b]]
 if not pairs and prior_color in s['families'] and prior_image is not None and prior_image!=prior_color:
  predicted=visible(reflected(s['families'][prior_color],s['axis'],s['dim']),s)
  if predicted==s['families'].get(prior_image,set()):pairs=[(prior_color,prior_image)]
 if len(pairs)!=1:return None
 pair=pairs[0];current_marks={p for p in s['marks']if prior_marker is None or s['mark_values'][p]==prior_marker};marked=[v for v in pair if current_marks&s['families'].get(v,set())]
 direct=marked[0]if len(marked)==1 else prior_color if prior_color in pair else None
 targets=[v for v in s['families']if v not in pair]
 if direct is None or len(targets)!=1:return None
 marker_values={v for p,v in s['mark_values'].items()if s['cells'][p]in (direct,s['axis_color'])};marker=next(iter(marker_values))if len(marker_values)==1 else prior_marker if prior_marker in marker_values else None
 if marker is None:return None
 image=next(v for v in pair if v!=direct);w={k:s[k]for k in ('pitch','phase','nx','ny','dim','axis','axis_color','background')};w.update(direct=direct,image=image,target=targets[0],marker_value=marker,bodies=groups(s['families'][direct]),targets=set(s['families'][targets[0]]));w['bodies'].sort(key=lambda b:min(b));w['focus']=focus(w,s);return w
def matches(w,s):
 if not s or any(w[k]!=s[k]for k in ('pitch','phase','nx','ny','dim','axis','axis_color','background')):return False
 direct=set().union(*w['bodies']);image=visible(reflected(direct,w['axis'],w['dim']),s);layers={w['direct']:direct,w['image']:image,w['target']:w['targets']}
 if any(not cells<=layers.get(v,set())for v,cells in s['families'].items()):return False
 for p in direct|image|w['targets']:
  allowed={v for v,cells in layers.items()if p in cells}
  if p[w['dim']]==w['axis']:allowed.add(w['axis_color'])
  if s['cells'].get(p)not in allowed:return False
 return True
def encode(w):return {**{k:v for k,v in w.items()if k not in ('bodies','targets')},'bodies':[sorted(b)for b in w['bodies']],'targets':sorted(w['targets'])}
def decode(w):return {**w,'phase':tuple(w['phase']),'bodies':[set(map(tuple,b))for b in w['bodies']],'targets':set(map(tuple,w['targets']))}
def pixel(w,p):return(w['phase'][0]+p[0]*w['pitch']+w['pitch']//2,w['phase'][1]+p[1]*w['pitch']+w['pitch']//2)

class ReflectedCover:
 def __init__(self):
  self.epoch=None;self.world=None;self.effects={};self.current_known=set();self.ready=False;self.axis_movable=False;self.prior_color=None;self.prior_marker=None;self.prior_image=None;self.refs=[];self.events=[];self.axes_seen=set();self.audit=None
 def enter(self,obs,rows):
  s=lattice(rows);w=initialize(s,self.prior_color,self.prior_marker,self.prior_image)if s else None
  if w is None:return None
  self.world=w;self.epoch=obs['level_epoch'];self.current_known=set();self.audit=None;return s
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[]
  if self.epoch!=before['level_epoch']or self.world is None:
   if self.enter(before,first)is None:return {'status':'reflection_absent','events':[]}
  w=self.world;s=lattice(second,w)
  if after['levels_completed']>before['levels_completed']:
   self.events=[{'kind':'reflected_cover_official_boundary','evidence':after['observation_ref']}];self.prior_color=w['direct'];self.world=None;return {'status':'reflected_cover_boundary','events':self.events}
  if not s:return {'status':'reflection_scope_unknown','events':[]}
  owner=w.get('focus');candidates=[];kind='axis'if owner=='axis'else 'body';action=command['action_ref']
  if owner=='axis':
   candidate=copy.deepcopy(w);candidate['axis']=s['axis'];d=tuple(s['axis']-w['axis']if k==w['dim']else 0 for k in (0,1))
   if matches(candidate,s):candidates.append((d,candidate))
  elif isinstance(owner,int):
   offsets={(0,0)}|{(q[0]-p[0],q[1]-p[1])for q in s['families'].get(w['direct'],())for p in w['bodies'][owner]}
   for d in offsets:
    candidate=copy.deepcopy(w);candidate['bodies'][owner]=shifted(w['bodies'][owner],d)
    if matches(candidate,s):candidates.append((d,candidate))
  elif matches(w,s):candidates=[((0,0),copy.deepcopy(w))]
  if len(candidates)!=1:return {'status':'reflection_correspondence_ambiguous','events':[]}
  d,new=candidates[0];new_focus=focus(new,s,retain=d!=(0,0));new['focus']=new_focus
  if d!=(0,0):
   self.effects[kind,action]=d;self.current_known.add((kind,action));self.refs.append(after['observation_ref'])
   if kind=='body':self.axes_seen.update(k for k in (0,1)if d[k]);self.ready=len(self.axes_seen)==2
   else:self.axis_movable=True
   visible_image=visible(reflected(set().union(*new['bodies']),new['axis'],new['dim']),s)
   self.events=[{'kind':'public_reflection_covariation'if visible_image else 'reflected_control_motion_image_outside_view','control_kind':kind,'action':action,'delta_cells':d,'pitch':w['pitch'],'evidence':after['observation_ref'],'stationary_support_revalidated':True,'visible_image_cells':len(visible_image),'uncertainty':'unseen image remains a conditional projection'if not visible_image else 'local visible covariance only','scope':'current orthogonal band, retained shape layers and public translation'}]
  elif new_focus!=owner:
   self.current_known=set();self.refs.append(after['observation_ref']);self.events=[{'kind':'reflected_control_transfer','old_owner':owner,'new_owner':new_focus,'command':command,'evidence':after['observation_ref']}]
  self.world=new;self.prior_color=new['direct'];self.prior_marker=new['marker_value'];self.prior_image=new['image'];return {'status':'reflected_cover_response','events':self.events}
 def solve(self,w):
  best=None;axes=range(w['nx']if w['dim']==0 else w['ny'])if self.axis_movable or w['focus']=='axis'else [w['axis']]
  for a in axes:
   options=[]
   for b in w['bodies']:
    choices={}
    for t in w['targets']:
     for p in b:
      for target in (t,next(iter(reflected({t},a,w['dim'])))):
       d=(target[0]-p[0],target[1]-p[1]);direct=shifted(b,d);image=reflected(direct,a,w['dim'])
       if any(not(0<=x<w['nx']and 0<=y<w['ny'])for x,y in direct|image):continue
       covered=(direct|image)&w['targets']
       if len(covered)>=len(b):choices[d]=(direct,covered)
    options.append(list(choices.items()))
   for selected in product(*options):
    if set().union(*(v[1][1]for v in selected))!=w['targets']:continue
    if any(selected[i][1][0]&selected[j][1][0]for i in range(len(selected))for j in range(i)):continue
    cost=abs(a-w['axis'])+sum(abs(d[0])+abs(d[1])for d,_ in selected);key=(cost,a,tuple(d for d,_ in selected))
    if best is None or key<best[0]:best=(key,a,[d for d,_ in selected])
  return best
 def propose(self,obs,rows,inputs,remaining):
  if not json.loads((Path(__file__).parent/'common_frontier_policy.drm.json').read_text()).get('reflected_cover',{}).get('enabled')or not self.ready:return None
  s=lattice(rows,self.world)
  if self.epoch!=obs['level_epoch']or self.world is None:s=self.enter(obs,rows)
  w=self.world
  if w is None or not matches(w,s):return None
  w['focus']=focus(w,s,retain=True);solution=self.solve(w)
  if solution is None:return None
  if self.audit is None:
   audit=measure_orthogonal_reflection_lattice_object_audit(frame=tuple(map(tuple,rows)),quantum=w['pitch'],row_phase=w['phase'][1],col_phase=w['phase'][0],support_component_ref=None,support_palette_value=w['target'],completed_cells=tuple((y,x)for x,y in w['targets']),carrier_palette_value=w['axis_color'],carrier_row_axis_coordinate_twice=2*w['axis']if w['dim']==1 else None,carrier_col_axis_coordinate_twice=2*w['axis']if w['dim']==0 else None,direct_body_palette_values=(w['direct'],))
   self.audit={'consumer':'V5 reflection_structure.measure_orthogonal_reflection_lattice_object_audit','returned_fields':len(audit),'declared_roles':'public covariance and current marker associations; not supplied by V5 or creator'}
  _,axis,deltas=solution;owner=w['focus']
  if axis!=w['axis']:desired='axis';d=tuple(axis-w['axis']if k==w['dim']else 0 for k in (0,1))
  else:
   unfinished=[i for i,x in enumerate(deltas)if x!=(0,0)]
   if not unfinished:return None
   desired=owner if owner in unfinished else unfinished[0];d=deltas[desired]
  actions=[];steps=[];cur=copy.deepcopy(w);why=''
  if owner!=desired:
   if 'ACTION6'not in obs['available_action_refs']:return None
   loci=[p for p,v in s['cells'].items()if (p[w['dim']]==w['axis']and v==w['axis_color'])]if desired=='axis'else [p for p in w['bodies'][desired]if s['cells'][p]==w['direct']]
   if not loci:return None
   p=min(loci);action={'action_ref':'ACTION6','data':dict(zip(('x','y'),pixel(w,p)))};actions=[action];why='test current control binding to the contributor required by the retained complete cover';steps=[{'action':action,'expected_before':encode(cur),'expected_after':None,'locus_witness':ObservedInputDomain.make_locus_witness(obs,rows,pixel(w,p),reason=why,evidence=[obs['observation_ref']]+self.refs[-3:])}]
  else:
   kind='axis'if owner=='axis'else 'body';left=list(d);why='close a retained reflected-cover residual while preserving the joint masks and completed contributors'
   while any(left)and len(actions)<min(16,remaining):
    dim=0 if left[0]else 1;options=[]
    for (role,action),v in self.effects.items():
     if role not in (kind,'body')or action not in obs['available_action_refs']:continue
     if v[1-dim]or not v[dim]or left[dim]*v[dim]<=0 or abs(v[dim])>abs(left[dim]):continue
     priority=role!=kind;options.append((priority,action,v))
    if not options:break
    _,action,v=min(options);known=(kind,action)in self.current_known;before=encode(cur)
    if kind=='axis':cur['axis']+=v[dim]
    else:cur['bodies'][owner]=shifted(cur['bodies'][owner],v)
    left[dim]-=v[dim];actions.append({'action_ref':action});steps.append({'action':actions[-1],'expected_before':before,'expected_after':encode(cur),'provisional_control':not known})
    if not known:break
  if not actions:return None
  ref='C_reflected_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-5:];facts={'public_orthogonal_covariation_acquired':True,'current_reflection_and_marker_bound':True,'complete_cover_composed':True};plan={'reflected_cover':True,'frame_hash':obs['frame_hash'],'target':sorted(w['targets']),'axis_destination':axis,'body_deltas':deltas,'v5_audit':self.audit,'scope':'finite current scene; color bindings are local, target interpretation revisable until official boundary','unknowns':['exclusive global selection law','unobserved axis orientation response','complete inter-level identity']}
  return {'status':'proposed','kind':'conditional_reflected_cover','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'joint_reflected_support_cover','observed':False,'open_question':why,'properties':{'contributors':len(w['bodies'])},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,obs):
  w=decode(p['steps'][i]['expected_before']);s=lattice(public.frame_rows,w);ok=bool(public.level==p['binding']['level_epoch']and public.levels_completed==p['binding']['levels_completed']and matches(w,s)and focus(w,s,retain=True)==w['focus'])
  if i==0:ok=ok and public.frame_hash==p['support_plan']['frame_hash']
  return {'admitted':ok,'reason':'current_reflection_layers_and_control'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':True,'seal_prefix':True,'reason':'official_boundary'}
  expected=p['steps'][i]['expected_after']
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'control_binding_question_requires_response'}
  w=decode(expected);s=lattice(second,w);ok=bool(matches(w,s)and focus(w,s,retain=True)==w['focus']);return {'matched':ok,'seal_prefix':not ok or p['steps'][i].get('provisional_control',False),'reason':'conditional_reflected_mask_prediction'if ok else 'reflection_or_control_contradiction'}
