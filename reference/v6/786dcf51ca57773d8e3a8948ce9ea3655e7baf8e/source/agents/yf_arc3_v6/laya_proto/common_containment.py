"""Constrain possible occupancy by exact silhouettes and observed control.

Translations, selection and contact transport are distinct hypotheses. An
uncharacterized contact is only a probe, with its own measured endpoint.
"""
from collections import defaultdict,deque
from itertools import permutations
import numpy as np
from common_multiscale_constraints import digest


def neighborhood(mask):
    return {(x+dx,y+dy) for x,y in mask for dx,dy in ((0,1),(1,0),(-1,0),(0,-1))}-mask


def filled(support,w,h):
    exterior={(-1,-1)};q=deque(exterior)
    while q:
        for x,y in neighborhood({q.popleft()}):
            if -1<=x<=w and -1<=y<=h and (x,y) not in exterior and (x,y) not in support:
                exterior.add((x,y));q.append((x,y))
    return frozenset((x,y) for x in range(w) for y in range(h) if (x,y) not in exterior)


def scene(obs,rows):
    a=np.asarray(rows);h,w=a.shape;entities=obs['entities'];by_value=defaultdict(list)
    for e in entities:by_value[e['palette_value']].append(e)
    options=[]
    for floor,group in by_value.items():
        holes=[]
        for e in group:
            if e['area']==max(q['area'] for q in group):continue
            x,y,r,b=e['bbox']
            if min(r-x,b-y)<1:continue
            shape=frozenset(map(tuple,e['mask']))
            rim={(x+i,y+j) for i,j in neighborhood(shape)}
            if not all(0<=i<w and 0<=j<h for i,j in rim):continue
            rim_values={int(a[j,i]) for i,j in rim}
            if len(rim_values)==1:holes.append((shape,(x,y),rim,rim_values.pop()))
        if not holes:continue
        actors=[]
        shapes={s for s,_,_,_ in holes}
        for e in entities:
            if e['palette_value']==floor:continue
            x,y,r,b=e['bbox']
            if not any(max(i for i,j in s)==r-x and max(j for i,j in s)==b-y for s in shapes):continue
            shape=filled(set(map(tuple,e['mask'])),r-x+1,b-y+1)
            if shape in shapes:actors.append(dict(origin=(x,y),shape=shape,shell=frozenset(map(tuple,e['mask'])),color=e['palette_value']))
        if not actors or len(holes)!=len(actors):continue
        assignments=[p for p in permutations(range(len(holes))) if all(b['shape']==holes[p[i]][0] for i,b in enumerate(actors))]
        if not assignments:continue
        terrain=a==floor
        for _,_,rim,_ in holes:
            for x,y in rim:terrain[y,x]=True
        for b in actors:
            for x,y in b['shape']:terrain[b['origin'][1]+y,b['origin'][0]+x]=True
        options.append((actors,[p for _,p,_,_ in holes],assignments,terrain))
    return options[0] if len(options)==1 else None


def contact_pose(rows,bodies,predicted):
    """Recognize a bound pose when another support explains every lost edge."""
    a=np.asarray(rows)
    footprints=[{(p[0]+x,p[1]+y) for x,y in b['shape']} for p,b in zip(predicted,bodies)]
    if sum(map(len,footprints))!=len(set().union(*footprints)):return ()
    witnessed=False
    for i,(p,b) in enumerate(zip(predicted,bodies)):
        support={(p[0]+x,p[1]+y) for x,y in b['shell']}
        if not all(0<=x<a.shape[1] and 0<=y<a.shape[0] for x,y in footprints[i]):return ()
        missing={(x,y) for x,y in support if int(a[y,x])!=b['color']}
        if not missing:continue
        if missing==support:return ()
        near=neighborhood(set().union(*(f for j,f in enumerate(footprints) if j!=i)))
        interior={int(a[y,x]) for x,y in footprints[i]-support}
        if missing-near or not {int(a[y,x]) for x,y in missing}.issubset(interior):return ()
        witnessed=True
    return tuple(map(tuple,predicted)) if witnessed else ()


def measured_positions(rows,bodies,prior):
    a=np.asarray(rows);h,w=a.shape;choices=[]
    for body,old in zip(bodies,prior):
        mask=body['shell'];bw=max(x for x,_ in mask)+1;bh=max(y for _,y in mask)+1
        votes=np.zeros((h-bh+1,w-bw+1),dtype=np.uint16)
        for x,y in mask:votes+=a[y:y+h-bh+1,x:x+w-bw+1]==body['color']
        threshold=(len(mask)+1)//2
        ys,xs=np.nonzero(votes>=threshold)
        scored=sorted(((-int(votes[y,x]),abs(old[0]-int(x))+abs(old[1]-int(y)),(int(x),int(y))) for x,y in zip(xs,ys)))
        choices.append(scored)
    # A contact can cover one body's edge. Match all bodies jointly before
    # choosing the shortest motion, so two identical neighbors keep identity.
    if not all(choices):return contact_pose(rows,bodies,prior)
    order=sorted(range(len(bodies)),key=lambda i:len(choices[i]))
    lower=[sum(choices[i][0][0] for i in order[k:]) for k in range(len(order)+1)]
    best=None;solutions=set();poses=[None]*len(bodies)
    def assign(k,occupied,cost,dist):
        nonlocal best,solutions
        if best is not None and (cost+lower[k],dist)>best:return
        if k==len(order):
            score=(cost,dist)
            if best is None or score<best:best=score;solutions=set()
            solutions.add(tuple(poses));return
        i=order[k]
        for c,d,p in choices[i]:
            if best is not None and cost+c+lower[k+1]>best[0]:break
            footprint={(p[0]+x,p[1]+y) for x,y in bodies[i]['shape']}
            if footprint & occupied:continue
            poses[i]=p;assign(k+1,occupied|footprint,cost+c,dist+d)
    assign(0,set(),0,0)
    return next(iter(solutions)) if len(solutions)==1 else contact_pose(rows,bodies,prior)


def add(p,d):return p[0]+d[0],p[1]+d[1]


def distance(a,b):return abs(a[0]-b[0])+abs(a[1]-b[1])


class Containment:
    def __init__(self):
        self.epoch=None;self.positions=();self.events=[];self.passed=[];self.previous=None

    def start(self,o,rows):
        self.epoch=o['level_epoch'];self.fit=scene(o,rows);self.vectors={};self.no_moves=set()
        self.active=None;self.failed=set();self.probes=set();self.motion_refs={};self.selection_tests=set();self.effect_bounds={}
        if not self.fit:return
        self.bodies,self.goals,self.assignments,self.terrain=self.fit;self.positions=tuple(b['origin'] for b in self.bodies)
        self.passable=[]
        h,w=self.terrain.shape
        for body in self.bodies:
            sh=body['shape'];bw=max(x for x,_ in sh)+1;bh=max(y for _,y in sh)+1
            mask=np.ones((h-bh+1,w-bw+1),dtype=bool)
            for x,y in sh:mask&=self.terrain[y:y+h-bh+1,x:x+w-bw+1]
            ys,xs=np.nonzero(mask);self.passable.append(set(zip(map(int,xs),map(int,ys))))

    def footprint(self,i,pos):
        return {(pos[0]+x,pos[1]+y) for x,y in self.bodies[i]['shape']}

    def graph(self,i,positions,ignore=()):
        occ=set().union(*(self.footprint(j,p) for j,p in enumerate(positions) if j!=i and j not in ignore))
        start=positions[i];seen={start:()};q=deque([start])
        while q:
            p=q.popleft()
            for key,delta in self.vectors.items():
                n=add(p,delta)
                if n in seen or n not in self.passable[i] or (i,p,key) in self.failed or self.footprint(i,n)&occ:continue
                seen[n]=seen[p]+(key,);q.append(n)
        return seen

    def select(self,i,positions,inputs):
        if i==self.active:return []
        footprint=self.footprint(i,positions[i]);x,y=positions[i];b=self.bodies[i]
        key=(i,positions[i],self.active)
        if key in self.selection_tests:return None
        choices=[a for a in inputs if a.get('data') and (a['data']['x'],a['data']['y']) in footprint]
        if not choices:return None
        choices.sort(key=lambda a:((a['data']['x']-x,a['data']['y']-y) in b['shell'],a['data']['y'],a['data']['x']))
        return [('selection',i,choices[0],None)]

    def walk(self,i,path,positions):
        result=[];pos=list(positions)
        for key in path:
            pos[i]=add(pos[i],self.vectors[key]);result.append(('walk',i,{'action_ref':key},tuple(pos)))
        return result

    def choices(self,o,inputs):
        pos=self.positions;plain=sorted(a['action_ref'] for a in inputs if not a.get('data'))
        # Learn axis and sign only from the object's observed translations.
        unseen=[key for key in plain if key not in self.vectors and (key,pos) not in self.no_moves]
        if unseen:return [('calibrate',self.active,{'action_ref':unseen[0]},None)]
        if self.active is None or not self.vectors:return []
        access=[self.graph(i,pos) for i in range(len(pos))]
        relaxed=[self.graph(i,pos,ignore=set(range(len(pos)))) for i in range(len(pos))]
        def assign_cost(assignment):
            return (sum(self.goals[j] not in relaxed[i] for i,j in enumerate(assignment)),sum(distance(pos[i],self.goals[j]) for i,j in enumerate(assignment)))
        target=min(self.assignments,key=assign_cost)
        goals=[self.goals[j] for j in target]
        direct=[];services=[]
        for i,goal in enumerate(goals):
            if pos[i]==goal:continue
            selection=self.select(i,pos,inputs)
            if selection is not None and goal in access[i]:
                plan=selection+self.walk(i,access[i][goal],pos);direct.append((len(plan),i,plan))
                continue
            # Seek contact on the side opposite a possible displacement toward
            # this unserved cavity. Remote endpoints remain hypotheses.
            for j in range(len(pos)):
                if i==j:continue
                enter=self.select(j,pos,inputs)
                if enter is None:continue
                for launch,path in access[j].items():
                    for key,delta in self.vectors.items():
                        if not self.footprint(j,add(launch,delta)) & self.footprint(i,pos[i]):continue
                        trial=(i,pos[i],j,launch,key)
                        if trial in self.probes:continue
                        land=pos[i];possible=[]
                        while True:
                            land=add(land,delta)
                            if not(0<=land[0]<self.terrain.shape[1] and 0<=land[1]<self.terrain.shape[0]):break
                            if land in self.passable[i] and distance(land,goal)<distance(pos[i],goal):
                                possible.append(land)
                        if not possible:continue
                        # First prefer an endpoint connected to the desired
                        # cavity. Test only the final irreversible unknown.
                        goal_region=self._region(i,goal)
                        connected=any(q in goal_region for q in possible)
                        gain=distance(pos[i],goal)-min(distance(q,goal) for q in possible)
                        plan=enter+self.walk(j,path,pos)+[('contact',i,{'action_ref':key},None)]
                        services.append((not connected,len(plan),-gain,i,j,plan))
        if services:return min(services,key=lambda s:s[:-1])[-1]
        if direct:return min(direct,key=lambda s:s[:-1])[-1]
        return []

    def _region(self,i,goal):
        stamp=(i,goal,tuple(sorted(self.vectors.items())))
        if stamp not in self.regions:
            p=list(self.positions);p[i]=goal
            self.regions[stamp]=set(self.graph(i,p,ignore=set(range(len(p)))))
        return self.regions[stamp]

    def propose(self,o,rows,inputs,remaining):
        if not any(not a.get('data') for a in inputs):return None
        if self.epoch!=o['level_epoch']:
            self.start(o,rows);self.regions={}
        if not self.fit:return None
        current=measured_positions(rows,self.bodies,self.positions)
        if not current:return None
        self.positions=current;plan=self.choices(o,inputs)
        if not plan:return None
        refs=[o['observation_ref'],*dict.fromkeys(self.motion_refs.values())];steps=[];pos=current
        for kind,body,cmd,expected in plan[:min(remaining,16)]:
            steps.append({'mode':kind,'body':body,'action':cmd,'poses':pos,'active':self.active,
                'expected_before':{'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if not steps else None},
                'expected_after':expected})
            if expected is None:break
            pos=expected
        actions=[s['action'] for s in steps];focus='C_containment_'+digest([refs,actions])[:18]
        info={'cavities':self.goals,'bodies':current,'compatible_assignments':len(self.assignments),
              'selected_before':self.active,'measured_command_displacements':self.vectors.copy(),
              'terminal_hypothesis':'occupy all silhouette-compatible cavities','next_experiment':steps[-1]['mode']}
        why={'selection':'Test control acquisition on an occupant needed for the pending cavity.',
            'calibrate':'Measure which body translates and its pixel displacement under an uncharacterized input.',
            'contact':'Test whether approaching an overlapping support transfers a body toward an inaccessible matching cavity.',
            'walk':'Move a measured occupant toward a silhouette-compatible cavity.'}[steps[-1]['mode']]
        facts={'measured_cavity_body_correspondence':True,'public_inputs_bound':True,'effects_revalidated':True}
        return {'status':'proposed','kind':'containment_and_contact','containment_plan':info,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                 'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):domain.bind_proposal(p)

    def before(self,p,i,public,o):
        s=p['steps'][i];pos=tuple(map(tuple,s['poses']));bound=p['binding']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i>0 or o['observation_ref']==bound['observation_ref']) and measured_positions(public.frame_rows,self.bodies,pos)==pos)
        return {'admitted':ok,'reason':'reobserve_bound_geometry_and_poses'}

    def after(self,p,i,before,after,first,second):
        s=p['steps'][i];expected=s['expected_after']
        if (before['state'],before['levels_completed'],before['level_epoch'])!=(after['state'],after['levels_completed'],after['level_epoch']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        found=measured_positions(second,self.bodies,expected or s['poses'])
        matched=found==tuple(map(tuple,expected)) if expected else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_all_observed_poses'}

    def record(self,before,after,command,first,second,p,i):
        s=p['steps'][i];kind=s['mode'];body=s['body'];ref=after['observation_ref'];key=command['action_ref']
        old=tuple(map(tuple,s['poses']));event={'mode':kind,'evidence':ref,'key':key}
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return event|{'status':'score_boundary'}
        new=measured_positions(second,self.bodies,s['expected_after'] or old)
        if not new:return event|{'status':'pose_ambiguous'}
        moved=[j for j in range(len(old)) if old[j]!=new[j]]
        if kind=='calibrate':
            if len(moved)==1:
                j=moved[0];dx,dy=new[j][0]-old[j][0],new[j][1]-old[j][1]
                if (dx==0)!=(dy==0):
                    self.active=j;self.vectors[key]=(dx,dy);self.motion_refs[key]=ref
            else:self.no_moves.add((key,new))
        if kind=='walk' and not moved:self.failed.add((body,old[body],key))
        if kind=='selection':
            crop=lambda arr,j:np.asarray(arr)[tuple(np.array([(old[j][1]+y,old[j][0]+x) for x,y in sorted(self.bodies[j]['shape'])]).T)]
            if not moved and not np.array_equal(crop(first,body),crop(second,body)):
                self.active=body;event['selection_status']='appearance_change_pending_translation'
            self.selection_tests.add((body,old[body],s['active']))
        if kind=='contact':
            self.probes.add((body,old[body],self.active,old[self.active],key))
            if moved==[body] and self.active!=body:
                event['contact_displacement']=[new[body][j]-old[body][j] for j in (0,1)]
                self.motion_refs['contact']=ref
        event.update(status='public_effect_measured',moved=moved,before=old,after=new,active=self.active)
        self.events.append(event);self.positions=new;return event
