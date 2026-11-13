"""Acquire focus-registered rigid supports and jointly cover measured marker loci."""
from collections import Counter,defaultdict,deque
from math import gcd
from types import SimpleNamespace
import numpy as np
from common_multiscale_constraints import digest
from agents.yf_arc3_v5.capabilities.rigid_marker_pose import measure_rigid_marker_poses

NEIGHBORS=tuple((x,y) for x in (-1,0,1) for y in (-1,0,1) if x or y)

def plus(p,q):return p[0]+q[0],p[1]+q[1]
def minus(p,q):return p[0]-q[0],p[1]-q[1]

def layout(o,rows):
    rings=[]
    for entity in o['entities']:
        l,t,r,b=entity['bbox'];size=r-l+1
        if size<3 or size%2!=1 or size!=b-t+1 or entity['area']!=size*size-1:continue
        middle=size//2;expected={(x,y)for y in range(size)for x in range(size)if(x,y)!=(middle,middle)}
        if set(map(tuple,entity['mask']))==expected:rings.append((l,t,size,entity['palette_value']))
    if len(rings)<2:return None
    targets=defaultdict(set);excluded=set();marker_rows=defaultdict(list)
    for l,t,size,color in rings:
        center=(l+size//2,t+size//2);value=rows[center[1]][center[0]]
        if value==color:return None
        targets[value].add(center);excluded|={(x,y)for y in range(t,t+size)for x in range(l,l+size)}
        marker_rows[value].append({'centre':(center[1],center[0]),'ring_width':size,'ring_value':color})
    if any(len(points)<2 for points in targets.values()):return None
    background=Counter(value for row in rows[1:]for value in row).most_common(1)[0][0]
    height=len(rows);width=len(rows[0]);semantic_colors={background,*targets,*(color for l,t,size,color in rings)};boundary_overlay=set()
    for y in (0,height-1):
        if all(value not in semantic_colors for value in rows[y]):boundary_overlay|={(x,y)for x in range(width)}
    for x in (0,width-1):
        if all(rows[y][x]not in semantic_colors for y in range(height)):boundary_overlay|={(x,y)for y in range(height)}
    singleton=[e for e in o['entities']if e['area']==1 and tuple(e['position'])not in excluded|boundary_overlay and e['palette_value']not in {*targets,background}]
    if len(singleton)!=1:return None
    return {'targets':dict(targets),'marker_rows':dict(marker_rows),'background':background,'excluded':excluded,'boundary_overlay':boundary_overlay,'marker_raster':{p:rows[p[1]][p[0]]for p in excluded},'ring_widths':sorted({s for l,t,s,c in rings}),'focus_color':singleton[0]['palette_value'],
        'focus_occlusion':{(0,0)},'width':len(rows[0]),'height':len(rows)}

def focus_loci(rows,m):
    return [(x,y)for y,row in enumerate(rows)for x,value in enumerate(row)
        if value==m['focus_color']and(x,y)not in m['boundary_overlay']and m['marker_raster'].get((x,y))!=m['focus_color']]

def focus(rows,m):
    points=focus_loci(rows,m)
    return points[0]if len(points)==1 else None

def cursor_at(rows,m,expected,bodies=(),poses=(),active=None):
    points=focus_loci(rows,m);expected=tuple(expected)
    if points:return points==[expected]
    if active is None or expected!=tuple(poses[active]):return False
    x,y=expected
    return any(index!=active and expected in body_pixels(body,pose)and rows[y][x]==body['color']
        for index,(body,pose)in enumerate(zip(bodies,poses)))

def material(rows,m):
    return {color:{(x,y)for y,row in enumerate(rows)for x,value in enumerate(row)if value==color and(x,y)not in m['excluded']|m['boundary_overlay']}for color in m['targets']}

def components(points):
    left=set(points)
    while left:
        part={left.pop()};queue=list(part)
        while queue:
            p=queue.pop()
            for vector in NEIGHBORS:
                q=plus(p,vector)
                if q in left:left.remove(q);part.add(q);queue.append(q)
        yield part

def acquire(samples,m):
    if len(samples)<3:return None
    base=samples[0]['focus'];offsets=[minus(s['focus'],base)for s in samples[1:]]
    if not any(a[0]*b[1]!=a[1]*b[0]for a in offsets for b in offsets):return None
    candidates=[]
    for color in m['targets']:
        evidence=set()
        for sample in samples:
            evidence|={minus(p,sample['focus'])for p in sample['material'][color]}
        possible=evidence|{(0,0)}
        for sample in samples:
            allowed=set().union(*sample['material'].values())|m['excluded']|{plus(sample['focus'],p)for p in m['focus_occlusion']}
            possible={p for p in possible if outside({plus(p,sample['focus'])},m)or plus(p,sample['focus'])in allowed}
        if sum(v in possible for v in NEIGHBORS)<2:possible.discard((0,0))
        for part in components(possible):
            if len(part)<3:continue
            l=min(x for x,y in part);r=max(x for x,y in part);t=min(y for x,y in part);b=max(y for x,y in part)
            if l+r==0 and t+b==0:candidates.append({'color':color,'mask':part,'pose':samples[-1]['focus']})
    if len(candidates)!=1:return None
    return candidates[0]

def body_pixels(body,pose):return {plus(p,pose)for p in body['mask']}

def outside(points,m):
    """Unseen coordinates and measured non-material boundary bands stay censored."""
    return {p for p in points if not(0<=p[0]<m['width']and 0<=p[1]<m['height'])or p in m['boundary_overlay']}

def within_envelope(body,pose,point):
    x,y=minus(point,pose)
    return min(p[0]for p in body['mask'])<=x<=max(p[0]for p in body['mask'])and min(p[1]for p in body['mask'])<=y<=max(p[1]for p in body['mask'])

def agrees(rows,m,bodies,poses,cursor=None,active=None):
    cursor=focus(rows,m)if cursor is None else tuple(cursor)
    if cursor is None or not cursor_at(rows,m,cursor,bodies,poses,active):return False
    actual=material(rows,m);predicted=defaultdict(set)
    for body,pose in zip(bodies,poses):predicted[body['color']]|=body_pixels(body,pose)
    for color,points in actual.items():
        if not points<=predicted[color]:return False
    for color,points in predicted.items():
        for x,y in points-m['excluded']-{plus(cursor,p)for p in m['focus_occlusion']}:
            if outside({(x,y)},m):continue
            seen=rows[y][x]
            if seen!=color and (seen not in predicted or (x,y)not in predicted[seen]):return False
    return True

def selection_effect(first,second,m,old,new):
    a=material(first,m);b=material(second,m)
    removed=set().union(*(a[color]-b[color]for color in a));added=set().union(*(b[color]-a[color]for color in a))
    distance=lambda p,q:abs(p[0]-q[0])+abs(p[1]-q[1])
    matched=old!=new and all(distance(p,old)<distance(p,new)for p in added)and all(distance(p,new)<distance(p,old)for p in removed)
    return matched,added,removed

def mechanical_pose_options(o,rows,bodies,poses,m,quantum):
    if len({b['color']for b in bodies})!=len(bodies):return None
    native=[]
    for entity in o['entities']:
        l,t,r,b=entity['bbox'];relative=tuple(sorted((y,x)for x,y in entity['mask']))
        native.append(SimpleNamespace(bbox=SimpleNamespace(left=l,top=t,width=r-l+1,height=b-t+1),area=entity['area'],
            pixels=tuple((t+y,l+x)for y,x in relative),relative_pixels=relative,value=entity['palette_value'],
            touches_frame_boundary=l==0 or t==0 or r==m['width']-1 or b==m['height']-1))
    contract={'maximum_pixels':m['width']*m['height'],'maximum_groups':len(m['targets']),'minimum_markers':2,
        'maximum_markers':sum(map(len,m['targets'].values())),'ring_widths':m['ring_widths'],'minimum_support_pixels':3,
        'maximum_support_pixels':m['width']*m['height'],'indicator_role_ref':'observed_control_focus','neighbour_offsets':NEIGHBORS,
        'minimum_internal_neighbours':2,'maximum_midpoint_twice_offset':1,'maximum_poses_per_group':m['width']*m['height']}
    templates=[{'partition_value':body['color'],'relative_support_pixels':tuple((y,x)for x,y in body['mask']),
        'indicator_position':(pose[1],pose[0])}for body,pose in zip(bodies,poses)]
    retained_targets=[{'partition_value':color,'marker_centres':tuple((y,x)for x,y in m['targets'][color]),'marker_ring_rows':tuple(rings)}for color,rings in m['marker_rows'].items()]
    measured=measure_rigid_marker_poses(frame=rows,components=native,quantum=quantum,contract=contract,prior_body_rows=templates,prior_target_rows=retained_targets)
    if not measured.get('rigid_marker_pose_all_groups_admitted'):return None
    return {row['partition_value']:None if row['template_pixel_incompatibility_count']else{(pose['delta_col'],pose['delta_row'])for pose in row['pose_rows']}for row in measured['rigid_marker_pose_rows']}

def joint_goal(bodies,poses,m,quantum,options=None):
    ordered=[(color,p)for color in sorted(m['targets'])for p in sorted(m['targets'][color])]
    full=(1<<len(ordered))-1;pools=[]
    for body,pose in zip(bodies,poses):
        color=body['color'];candidates={minus(target,offset)for target in m['targets'][color]for offset in body['mask']};best={}
        for candidate in candidates:
            dx,dy=minus(candidate,pose)
            if dx%quantum or dy%quantum:continue
            points=body_pixels(body,candidate)
            if not(0<=candidate[0]<m['width']and 1<=candidate[1]<m['height']):continue
            if options is not None and options.get(color)is not None and not outside(points,m)and (dx,dy)not in options[color]:continue
            covered=sum(1<<index for index,(value,p)in enumerate(ordered)if value==color and p in points)
            if not covered:continue
            cost=(abs(dx)+abs(dy))//quantum
            if covered not in best or (cost,candidate)<best[covered]:best[covered]=(cost,candidate)
        pools.append(best)
    states={0:(0,[])}
    for pool in pools:
        following={}
        for previous,(cost,path)in states.items():
            for covered,(extra,pose)in pool.items():
                union=previous|covered;item=(cost+extra,path+[pose])
                if union not in following or item<following[union]:following[union]=item
        states=following
    return states.get(full,(None,None))[1]

class ConstellationCover:
    def __init__(self):self.epoch=None;self.passed=[];self.events=[]

    def propose(self,o,rows,inputs,remaining):
        plain=[a['action_ref']for a in inputs if not a.get('data')and a['action_ref']!='ACTION7']
        if len(plain)<3:return None
        if self.epoch!=o['level_epoch']:
            self.epoch=o['level_epoch'];self.model=layout(o,rows);self.motion={};self.tried=set();self.selector=None;self.bodies=[];self.poses=[];self.active=None;self.samples=[];self.complete=False;self.retired=False;self.refs={};self.boundary_observed=set()
            self.persisted_bodies=0;self.first_observation=o['observation_ref'];self.unowned_seen=set()
        if not self.model or self.retired:return None
        cursor=focus(rows,self.model)
        if cursor is None and self.complete and cursor_at(rows,self.model,self.poses[self.active],self.bodies,self.poses,self.active):cursor=self.poses[self.active]
        if cursor is None:return None
        if not self.samples:self.samples=[{'focus':cursor,'material':material(rows,self.model)}]
        if self.active is None:
            learned=acquire(self.samples,self.model)
            if learned:
                self.bodies.append(learned);self.poses.append(cursor);self.active=len(self.bodies)-1
        steps=[]
        if not self.complete:
            acquisition_projection=None
            if self.active is None:
                unknown=[key for key in plain if key not in self.motion and (key,cursor)not in self.tried and key!=self.selector]
                if unknown:key=unknown[0]
                else:
                    origin=self.samples[0]['focus'];offsets=[minus(s['focus'],origin)for s in self.samples]
                    candidates=[]
                    for order,(candidate,vector)in enumerate(self.motion.items()):
                        point=plus(cursor,vector);x,y=point
                        if (candidate,cursor)in self.tried or outside({point},self.model):continue
                        if any(point in body_pixels(body,pose)for body,pose in zip(self.bodies,self.poses)):continue
                        independent=any(vector[0]*d[1]!=vector[1]*d[0]for d in offsets)
                        exposed=rows[y][x]==self.model['background']
                        candidates.append(((not independent,not exposed,order),candidate,point))
                    if candidates:
                        _,key,acquisition_projection=min(candidates)
                    else:key=None
                mode='acquire'
            elif len(self.motion)<4:
                key=next((k for k in plain if k not in self.motion and (k,cursor)not in self.tried and k!=self.selector),None);mode='calibrate'
                if key is None:key=next((k for k,v in self.motion.items()if(-v[0],-v[1])not in self.motion.values()and(k,cursor)not in self.tried),None)
            else:
                key=self.selector or next((k for k in plain if k not in self.motion),None);mode='cycle'
            if key is None:return None
            steps=[{'action':{'action_ref':key},'mode':mode,'cursor':cursor,'expected_after':None}]
            if acquisition_projection is not None:steps[0]['acquisition_focus_projection']=acquisition_projection
        else:
            if not agrees(rows,self.model,self.bodies,self.poses,cursor,self.active):return None
            quantum=gcd(*(abs(v)for pair in self.motion.values()for v in pair if v))
            options=mechanical_pose_options(o,rows,self.bodies,self.poses,self.model,quantum)
            goal=joint_goal(self.bodies,self.poses,self.model,quantum,options)
            if goal is None:return None
            wrong=[i for i,p in enumerate(self.poses)if p!=goal[i]]
            if not wrong:return None
            if self.active not in wrong:
                if not self.selector:return None
                steps=[{'action':{'action_ref':self.selector},'mode':'cycle','cursor':cursor,'poses':list(self.poses),'expected_after':None}]
            else:
                poses=list(self.poses);target=goal[self.active]
                while poses[self.active]!=target and len(steps)<min(16,remaining):
                    current=poses[self.active];delta=minus(target,current)
                    options=[(k,v)for k,v in self.motion.items()if abs(delta[0]-v[0])+abs(delta[1]-v[1])<abs(delta[0])+abs(delta[1])]
                    if not options:break
                    key,vector=options[0];new=list(poses);new[self.active]=plus(current,vector)
                    hidden=outside(body_pixels(self.bodies[self.active],new[self.active]),self.model)
                    steps.append({'action':{'action_ref':key},'mode':'move','cursor':current,'poses':poses,'expected_after':new,'unobserved_support_pixels':len(hidden)});poses=new
                    if hidden and self.active not in self.boundary_observed:break
        if not steps:return None
        refs=[o['observation_ref'],*self.refs.values()];actions=[step['action']for step in steps];ref='C_constellation_'+digest([refs,actions])[:16]
        for i,step in enumerate(steps):step['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash']if i==0 else None}
        why='Acquire controlled supports by registering independent displacements on the focus, then jointly cover the measured marker constellations.'
        info={'acquired_bodies':len(self.bodies),'ownership_complete':self.complete,'active':self.active,'control_vectors':self.motion,'selector':self.selector,
            'scope':'Rigid support and joint marker coverage remain hypotheses; coincident palette values retain distinct controlled owners.'}
        info['focus_visibility']='visible'if focus(rows,self.model)is not None else'retained_under_known_owner'
        info['support_scope']='Focus-interior pixels and measured boundary-band occlusions remain conditional until exposed in the observable field.'
        info['censored_boundary_pixels']=len(self.model['boundary_overlay'])
        if steps[0].get('acquisition_focus_projection')is not None:
            info['acquisition_focus_projection']=steps[0]['acquisition_focus_projection']
            why+=' Keep its predicted focus outside known peer supports while acquiring independent displacements; unregistered owners remain uncertain.'
        info['offscreen_support_scope']='Retain the acquired full support and compare its visible projection. Hidden pixels remain unobserved. Seal the first boundary crossing per owner.'
        facts={'repeated_framed_markers':True,'bound_visible_or_peer_occluded_focus':True,'ownership_question':True}
        return {'status':'proposed','kind':'controlled_constellation_cover','constellation_plan':info,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}

    def bind(self,p,domain):pass

    def before(self,p,i,public,o):
        step=p['steps'][i];b=p['binding']
        poses=step.get('poses',[]);owner=self.active if poses else None
        ok=(public.level==b['level_epoch']and public.levels_completed==b['levels_completed']and(i or o['observation_ref']==b['observation_ref'])
            and step['action']['action_ref']in public.available_action_refs and cursor_at(public.frame_rows,self.model,step['cursor'],self.bodies,poses,owner))
        if 'poses'in step:ok=ok and tuple(step['cursor'])==tuple(poses[self.active])and agrees(public.frame_rows,self.model,self.bodies,poses,step['cursor'],self.active)
        if step.get('acquisition_focus_projection')is not None:
            point=tuple(step['acquisition_focus_projection']);vector=self.motion.get(step['action']['action_ref'])
            ok=ok and vector is not None and point==plus(tuple(step['cursor']),vector)
            ok=ok and not outside({point},self.model)
            ok=ok and not any(point in body_pixels(body,pose)for body,pose in zip(self.bodies,self.poses))
        return {'admitted':bool(ok),'reason':'bind_control_focus_and_registered_composite'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        predicted=p['steps'][i]['expected_after']
        matched=agrees(second,self.model,self.bodies,predicted,predicted[self.active],self.active)if predicted else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_frozen_joint_supports'}

    def record(self,before,after,command,first,second,p,i):
        ref=after['observation_ref'];step=p['steps'][i];mode=step['mode'];key=command['action_ref']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','ref':ref}
        old=focus(first,self.model);new=focus(second,self.model);event={'status':'observed_response','ref':ref,'mode':mode}
        if old is None and step.get('poses')and cursor_at(first,self.model,step['cursor'],self.bodies,step['poses'],self.active):old=tuple(step['cursor'])
        if new is None and step['expected_after']and cursor_at(second,self.model,step['expected_after'][self.active],self.bodies,step['expected_after'],self.active):
            new=tuple(step['expected_after'][self.active]);event['focus_retained_under_known_owner']=True
        if old is None or new is None:self.retired=True;event['status']='focus_ambiguous'
        elif mode!='move' and selection_effect(first,second,self.model,old,new)[0]:
                _,added,removed=selection_effect(first,second,self.model,old,new)
                self.model['focus_occlusion']|={minus(p,old)for p in added}|{minus(p,new)for p in removed}
                if self.active is not None and agrees(first,self.model,self.bodies,self.poses,old,self.active):
                    revealed=[];unassigned=[]
                    exposed={plus(old,p)for p in self.model['focus_occlusion']}-{plus(new,p)for p in self.model['focus_occlusion']}-self.model['excluded']
                    refuted=[]
                    for owner,(body,pose)in enumerate(zip(self.bodies,self.poses)):
                        for point in body_pixels(body,pose)&exposed:
                            x,y=point
                            if not outside({point},self.model)and second[y][x]==self.model['background']:
                                offset=minus(point,pose);body['mask'].remove(offset)
                                refuted.append({'owner':owner,'relative_pixel':offset,'palette_value':body['color']})
                    if refuted:event['refuted_support_pixels']=refuted;event['before_ref']=before['observation_ref']
                    for point in sorted(added):
                        color=second[point[1]][point[0]]
                        if any(b['color']==color and point in body_pixels(b,q)for b,q in zip(self.bodies,self.poses)):continue
                        owners=[j for j,(b,q)in enumerate(zip(self.bodies,self.poses))if b['color']==color and within_envelope(b,q,point)]
                        if len(owners)==1:
                            owner=owners[0];offset=minus(point,self.poses[owner]);self.bodies[owner]['mask'].add(offset)
                            revealed.append({'owner':owner,'relative_pixel':offset,'palette_value':color})
                        else:unassigned.append({'pixel':point,'compatible_owners':owners})
                    if revealed:event['revealed_support_pixels']=revealed;event['before_ref']=before['observation_ref']
                    if unassigned:event['unassigned_reveals']=unassigned
                self.selector=key;self.refs[key]=ref
                if self.active is None:
                    self.samples.append({'focus':old,'material':material(second,self.model)})
                    learned=acquire(self.samples,self.model)
                    if learned:self.bodies.append(learned);self.poses.append(old)
                if new in self.poses:
                    self.active=self.poses.index(new);self.complete=agrees(second,self.model,self.bodies,self.poses)
                    if not self.complete:
                        event['status']='unowned_material_remains'
                        question=digest([self.poses,new,{str(k):sorted(v)for k,v in material(second,self.model).items()}])
                        if question in self.unowned_seen:self.retired=True;event['status']='ownership_question_repeated_without_new_evidence'
                        self.unowned_seen.add(question)
                else:self.active=None;self.samples=[{'focus':new,'material':material(second,self.model)}]
                event['selection_local_occlusion_observed']=True
        elif mode=='cycle':self.retired=True;event['status']='selection_hypothesis_refuted'
        elif mode=='move':
            if self.after(p,i,before,after,first,second)['matched']:
                self.poses=list(step['expected_after'])
                if step.get('unobserved_support_pixels'):self.boundary_observed.add(self.active)
            else:self.retired=True;event['status']='rigid_motion_refuted'
        else:
            self.tried.add((key,old));vector=minus(new,old)
            if (vector[0]==0)!=(vector[1]==0):
                self.motion[key]=vector;self.refs[key]=ref
                if self.active is None:self.samples.append({'focus':new,'material':material(second,self.model)})
                else:self.poses[self.active]=new
                event['measured_vector']=vector
            elif old!=new:self.retired=True;event['status']='unclassified_focus_change'
        event.update(acquired_bodies=len(self.bodies),ownership_complete=self.complete)
        if len(self.bodies)>self.persisted_bodies:
            event['acquired_supports']=[{'owner':index,'palette_value':body['color'],'relative_support_pixels':sorted(body['mask']),
                'support_scope':'Focus-interior pixels and measured boundary-band occlusions remain conditional until exposed.',
                'evidence_refs':list(dict.fromkeys([self.first_observation,*self.refs.values(),ref]))}
                for index,body in enumerate(self.bodies)if index>=self.persisted_bodies]
            self.persisted_bodies=len(self.bodies)
        event['owner_poses']=list(self.poses)
        self.events.append(event);return event
