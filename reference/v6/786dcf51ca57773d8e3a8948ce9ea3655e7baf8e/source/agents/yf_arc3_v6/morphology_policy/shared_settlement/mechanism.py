"""Public framed population, observed shared controls and conditional V5 settle.

The same-appearance wall-contact goal and direct adhesion remain declared
library hypotheses. Input directions and marker changes come from this session.
"""
import copy,itertools,time
from collections import Counter,deque
from types import SimpleNamespace
from .base import NeutralAccess as PreviewPackingAccess
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.coupled_member_control import GravityBody,GravityPose,GravityWall,GravityState,GravityModel,GravityControl,_physical_successor
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def scene(rows,retained=None):
    if retained:
        q=retained['q'];top,left=retained['offset'];h,w=retained['height'],retained['width'];bodies=[]
        types={b['type']for b in retained['bodies']};offsets={tuple(b['marker_offset'])for b in retained['bodies']}
        for y in range(h):
            for x in range(w):
                samples=[rows[top+y*q+dy][left+x*q+dx]for dy in range(q)for dx in range(q)];color,n=Counter(samples).most_common(1)[0]
                if color not in types or n!=q*q-1:continue
                holes=[(dy,dx)for dy in range(q)for dx in range(q)if rows[top+y*q+dy][left+x*q+dx]!=color]
                if len(holes)!=1 or holes[0]not in offsets:return None
                dy,dx=holes[0];bodies.append({'type':color,'anchor':[y,x],'marker':rows[top+y*q+dy][left+x*q+dx],'marker_offset':[dy,dx]})
        if Counter(b['type']for b in bodies)!=Counter(b['type']for b in retained['bodies']):return None
        # Revalidate the four retained boundary strips, even when a body of
        # equal appearance joins the same monochrome component at contact.
        strips=[[(top-1,left+x)for x in range(w*q)],[(top+h*q,left+x)for x in range(w*q)],[(top+y,left-1)for y in range(h*q)],[(top+y,left+w*q)for y in range(h*q)]]
        if any(any(rows[y][x]!=color for y,x in points)for points,color in zip(strips,retained['wall_types'])):return None
        return {**retained,'bodies':sorted(bodies,key=lambda b:(b['type'],b['anchor']))}
    parts=components(rows);bars=[p for p in parts if p['rectangular']and min(p['bbox'][2]-p['bbox'][0]+1,p['bbox'][3]-p['bbox'][1]+1)<=3 and max(p['bbox'][2]-p['bbox'][0]+1,p['bbox'][3]-p['bbox'][1]+1)>=16]
    horizontal=[p for p in bars if p['bbox'][2]-p['bbox'][0]>p['bbox'][3]-p['bbox'][1]]
    for top,bottom in itertools.combinations(horizontal,2):
        if top['bbox'][1]>bottom['bbox'][1]:top,bottom=bottom,top
        leftx,rightx=top['bbox'][0],top['bbox'][2]
        if bottom['bbox'][0]!=leftx or bottom['bbox'][2]!=rightx:continue
        topy,boty=top['bbox'][3]+1,bottom['bbox'][1]-1
        sides=[p for p in bars if p['bbox'][1]==topy and p['bbox'][3]==boty]
        left=next((p for p in sides if p['bbox'][2]==leftx-1),None);right=next((p for p in sides if p['bbox'][0]==rightx+1),None)
        if not left or not right:continue
        candidates=[p for p in parts if leftx<=p['bbox'][0]<=p['bbox'][2]<=rightx and topy<=p['bbox'][1]<=p['bbox'][3]<=boty and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1]and p['area']==(p['bbox'][2]-p['bbox'][0]+1)**2-1]
        sizes=Counter(p['bbox'][2]-p['bbox'][0]+1 for p in candidates)
        if not sizes:continue
        q,count=sizes.most_common(1)[0]
        if q<3 or count<2 or(rightx-leftx+1)%q or(boty-topy+1)%q:continue
        candidates=[p for p in candidates if p['bbox'][2]-p['bbox'][0]+1==q]
        bodies=[]
        for p in candidates:
            x,y=p['bbox'][:2]
            if(x-leftx)%q or(y-topy)%q:break
            holes=[(dx,dy)for dy in range(q)for dx in range(q)if(dx,dy)not in p['mask']]
            if len(holes)!=1:break
            dx,dy=holes[0];bodies.append({'type':p['color'],'anchor':[(y-topy)//q,(x-leftx)//q],'marker':rows[y+dy][x+dx],'marker_offset':[dy,dx]})
        else:
            width=(rightx-leftx+1)//q;height=(boty-topy+1)//q
            return {'q':q,'offset':[topy,leftx],'height':height,'width':width,'wall_types':[top['color'],bottom['color'],left['color'],right['color']],'bodies':sorted(bodies,key=lambda b:(b['type'],b['anchor']))}
    return None

def match(before,after):
    if not before or not after or any(before[k]!=after[k]for k in('q','offset','height','width','wall_types')):return None
    mapping=[]
    for typ in sorted({b['type']for b in before['bodies']}):
        olds=[b for b in before['bodies']if b['type']==typ];news=[b for b in after['bodies']if b['type']==typ]
        if len(olds)!=len(news)or len(news)>6:return None
        scored=[(sum(abs(a['anchor'][0]-b['anchor'][0])+abs(a['anchor'][1]-b['anchor'][1])for a,b in zip(olds,perm)),perm)for perm in itertools.permutations(news)]
        minimum=min(x[0]for x in scored);fits=[perm for cost,perm in scored if cost==minimum]
        if len(fits)!=1:return None
        mapping.extend(zip(olds,fits[0]))
    return mapping

def touching(s,b):
    y,x=b['anchor'];return any(hit and b['type']==typ for hit,typ in zip((y==0,y==s['height']-1,x==0,x==s['width']-1),s['wall_types']))

def physical(s,marker,phase):
    bodies=[];poses=[]
    for i,b in enumerate(s['bodies']):
        ref='member:'+str(i);bodies.append(GravityBody(member_ref=ref,type_ref='appearance:'+str(b['type']),offsets=((0,0),),evidence_ref='current_public_square'))
        poses.append(GravityPose(member_ref=ref,anchor=tuple(b['anchor']),latched=marker is not None and b['marker']==marker and touching(s,b)))
    h,w=s['height'],s['width'];supports=[tuple((-1,x)for x in range(w)),tuple((h,x)for x in range(w)),tuple((y,-1)for y in range(h)),tuple((y,w)for y in range(h))]
    walls=tuple(GravityWall(wall_ref='wall:'+str(i),type_ref='appearance:'+str(t),cells=supports[i],evidence_ref='current_public_bar')for i,t in enumerate(s['wall_types']))
    types=sorted({b.type_ref for b in bodies});model=GravityModel(model_ref='conditional_shared_settlement',height=h,width=w,bodies=tuple(bodies),walls=walls,compatible_types=tuple((t,t)for t in types),boundary_law_ref='bounded_nonwrapping_solid',vacancy_law_ref='simultaneous_uniform_translation_vacancy',contact_law_ref='any_exposed_face_cell',contact_phase_ref=phase,direction_law_ref='direction_sets_persistent_gravity',micro_step_bound=4*(h+w))
    state=GravityState(poses=tuple(poses),gravity=(1,0),adhesion_on=True,reserve=0,terminated=False)
    return model,state

def projection(state):return [(p.member_ref,list(p.anchor),p.latched)for p in state.poses]

def observed_projection(s,base,marker):
    pairs=match(base,s)
    if pairs is None:return None
    result=[]
    for i,b in enumerate(base['bodies']):
        found=[after for before,after in pairs if before==b]
        if len(found)!=1:return None
        a=found[0];result.append(('member:'+str(i),a['anchor'],marker is not None and a['marker']==marker and touching(s,a)))
    return plain(result)

class SettledGroupAccess(PreviewPackingAccess):
    def __init__(self):super().__init__();self.settle_events=[];self.settle_controls={};self.settle_marker=None;self.settle_fits=[]
    def retained_digest(self):return identity([super().retained_digest(),self.settle_events,self.settle_controls,self.settle_marker,self.settle_fits])
    def apply_event(self,e):
        if e.get('kind')=='observed_shared_settlement':self.settle_events.append(e);self.settle_controls=copy.deepcopy(e['controls']);self.settle_marker=e['contact_marker'];self.settle_fits=e['compatible_phases'];return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('shared_settlement_question');prior=next((e['after_scene']for e in reversed(self.settle_events)if e['epoch']==o['level_epoch']),None);s=scene(rows,prior)
        if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
        controls={k:v for k,v in self.settle_controls.items()if k in o['available_action_refs']};available=sorted({a['action_ref']for a in inputs if not a.get('data')})
        current=[e for e in self.settle_events if e['epoch']==o['level_epoch']];tried={e['command']['action_ref']for e in current if e['before_scene']==s}
        unknown=[a for a in available if a not in controls and a not in tried]
        actions=[];expected=[];why=cfg['control'];nodes=0;phases=self.settle_fits or ['after_simultaneous_micro_step','before_and_after_simultaneous_micro_step']
        refuted=bool(self.settle_events and self.settle_events[-1]['comparison']and not self.settle_fits)
        if self.settle_marker is not None and controls and not refuted:
            paths=[]
            for phase in phases:
                model,start=physical(s,self.settle_marker,phase);request=SimpleNamespace(domain_bound=4096,depth_bound=4096,node_bound=100000,time_bound_ms=2000)
                queue=deque([(start,[],[])]);seen={identity(projection(start))};found=None
                try:
                    while queue and len(seen)<10000 and time.monotonic()<config.get('level_deadline',float('inf')):
                        state,word,path=queue.popleft();nodes+=1
                        if all(p.latched for p in state.poses):found=(word,path);break
                        if len(word)>=config.get('remaining_level_actions',limit):continue
                        for action,law in sorted(controls.items()):
                            control=GravityControl(control_ref=action,kind_ref='direction',direction=tuple(law['direction']))
                            # Each bounded V5 call computes one external image;
                            # do not consume its node budget across unrelated edges.
                            after=_physical_successor(model,state,control,request,DWorkBudget(request))['state'];key=identity(projection(after))
                            if key in seen:continue
                            seen.add(key);queue.append((after,word+[{'action_ref':action}],path+[plain(projection(after))]))
                except Exception as exc:
                    if type(exc).__name__ not in('DComputationInterrupted','GravityPrerequisite'):raise
                paths.append(found)
            if all(paths)and paths and all(path[0]==paths[0][0]and path[1]==paths[0][1]for path in paths):actions,expected=paths[0];actions=actions[:limit];expected=expected[:limit];why=cfg['compose']
        if not actions and unknown:actions=[{'action_ref':unknown[0]}];expected=[None]
        if not actions:return {'status':'unknown','block_unrelated_probe':True,'reason':'shared_settlement_model_or_control_missing'}
        evidence=[o['observation_ref']]+[r for e in self.settle_events[-8:]for r in e['evidence']]
        plan=plain({'scene':s,'marker':self.settle_marker,'commands':actions,'expected':expected,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'why':why,'compatible_phases':phases,'nodes':nodes,'controls':controls})
        ref='shared-settle:'+identity(plan);facts={'current_framed_marked_population':True,'input_effects_acquired':bool(controls),'same_appearance_contact_goal_is_library_hypothesis':True,'conditional_collision_and_adhesion_model':True}
        return {'status':'proposed','kind':'shared_settlement','proposal_id':ref,'shared_settlement_plan':plan,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if 'shared_settlement_plan'not in p:return super().before(p,index,rows,**meta)
        v=p['shared_settlement_plan'];ok=p['proposal_id']=='shared-settle:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions'][index]['action_ref']in meta['available']
        if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
        else:ok=ok and observed_projection(scene(rows,v['scene']),v['scene'],v['marker'])==v['expected'][index-1]
        return {'admitted':ok,'reason':'current_shared_population_bound'if ok else'shared_population_changed'}
    def after(self,p,index,rows,later,**meta):
        if 'shared_settlement_plan'not in p:return super().after(p,index,rows,later,**meta)
        v=p['shared_settlement_plan'];boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['expected'][index]
        matched=None if boundary or expected is None else observed_projection(scene(later,v['scene']),v['scene'],v['marker'])==expected
        return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'boundary'if boundary else'unknown_shared_input'if expected is None else'shared_settlement_projection'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        if before['level_epoch']!=after['level_epoch']:return events
        prior=next((e['after_scene']for e in reversed(self.settle_events)if e['epoch']==before['level_epoch']),None)
        a=scene(rows,prior);b=scene(later,a)if a else None;pairs=match(a,b)
        if pairs is None:return events
        deltas=[(v['anchor'][0]-u['anchor'][0],v['anchor'][1]-u['anchor'][1])for u,v in pairs if u['anchor']!=v['anchor']]
        directions={(0 if y==0 else(1 if y>0 else-1),0 if x==0 else(1 if x>0 else-1))for y,x in deltas}
        controls=copy.deepcopy(self.settle_controls);evidence=[before['observation_ref'],after['observation_ref']];marker=self.settle_marker
        epoch_events=[e for e in self.settle_events if e['epoch']==before['level_epoch']]
        initial_digest=epoch_events[0]['initial_frame_digest']if epoch_events else identity(rows)
        whole_return=identity(later)==initial_digest and identity(rows)!=identity(later)
        if whole_return:
            event=plain({'kind':'observed_shared_settlement','epoch':before['level_epoch'],'before_scene':a,'after_scene':b,'command':cmd,'evidence':evidence,'controls':controls,'contact_marker':marker,'compatible_phases':self.settle_fits,'comparison':{},'initial_frame_digest':initial_digest,'model_status':'unresolved_whole_scene_return','scope':'Exact initial public image returned. No local motion, reset or adhesion-release law acquired from this transition.'})
            self.apply_event(event);events.append(event);return events
        if not cmd.get('data')and len(directions)==1 and sum(abs(x)for x in next(iter(directions)))==1:controls[cmd['action_ref']]={'direction':list(next(iter(directions))),'evidence':evidence}
        changed=[v['marker']for u,v in pairs if u['marker']!=v['marker']and touching(b,v)]
        if changed and len(set(changed))==1:marker=changed[0]
        phases=[];fits={}
        if marker is not None and cmd['action_ref']in controls:
            for phase in('after_simultaneous_micro_step','before_and_after_simultaneous_micro_step'):
                model,state=physical(a,marker,phase);req=SimpleNamespace(domain_bound=4096,depth_bound=4096,node_bound=100000,time_bound_ms=2000)
                predicted=_physical_successor(model,state,GravityControl(control_ref=cmd['action_ref'],kind_ref='direction',direction=tuple(controls[cmd['action_ref']]['direction'])),req,DWorkBudget(req))['state']
                fits[phase]=plain(projection(predicted))==observed_projection(b,a,marker)
                if fits[phase]:phases.append(phase)
        event=plain({'kind':'observed_shared_settlement','epoch':before['level_epoch'],'before_scene':a,'after_scene':b,'command':cmd,'evidence':evidence,'controls':controls,'contact_marker':marker,'compatible_phases':phases,'comparison':fits,'initial_frame_digest':initial_digest,'model_status':'conditional_library_hypothesis_fitted_to_public_transition'if phases else'unknown'})
        self.apply_event(event);events.append(event);return events
