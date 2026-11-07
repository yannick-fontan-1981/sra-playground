"""Measure rigid materials and solve a simultaneous exact matching of ports."""
from collections import Counter,defaultdict,deque
from itertools import product
import numpy as np
from common_multiscale_constraints import digest,projection,rows_digest


def neighbors(cell):
    x,y=cell
    return {(x-1,y),(x+1,y),(x,y-1),(x,y+1)}


def view(material,ports,rotation):
    points={p:p for p in material}
    for _ in range(rotation):points={p:(-q[1],q[0]) for p,q in points.items()}
    dx=min(x for x,y in points.values());dy=min(y for x,y in points.values())
    transform={p:(q[0]-dx,q[1]-dy) for p,q in points.items()}
    return set(transform.values()),{transform[p] for p in ports},transform


def layout(o,rows):
    a=np.asarray(rows);background=Counter(map(int,a.ravel())).most_common(1)[0][0];groups=defaultdict(list)
    for e in o['entities']:
        l,t,r,b=e['bbox']
        if e['rectangular'] and r-l==b-t and r>l:groups[e['palette_value'],r-l+1].append(e)
    candidates=[]
    for (color,unit),marks in groups.items():
        if color==background or len(marks)<2:continue
        phases={(e['bbox'][0]%unit,e['bbox'][1]%unit) for e in marks}
        if len(phases)!=1:continue
        phase=next(iter(phases));bodies=[]
        for e in o['entities']:
            l,t,r,b=e['bbox']
            if e['palette_value'] in (color,background) or e['area']<2*unit*unit or e['area']%(unit*unit):continue
            if (l-phase[0])%unit or (t-phase[1])%unit or (r-l+1)%unit or (b-t+1)%unit:continue
            cells={(x//unit,y//unit) for x,y in e['mask']}
            if len(cells)*unit*unit!=e['area']:continue
            origin=((l-phase[0])//unit,(t-phase[1])//unit);global_cells={(origin[0]+x,origin[1]+y) for x,y in cells}
            bodies.append({'material':global_cells,'ports':set(),'known':False})
        if len(bodies)<2:continue
        bad=False
        for e in marks:
            cell=((e['position'][0]-phase[0])//unit,(e['position'][1]-phase[1])//unit)
            owners=[i for i,b in enumerate(bodies) if neighbors(cell)&b['material']]
            if len(owners)!=1:bad=True;break
            b=bodies[owners[0]];b['ports'].add(cell);b['material'].add(cell);b['known']=True
        if bad:continue
        poses=[]
        for b in bodies:
            x=min(x for x,y in b['material']);y=min(y for x,y in b['material'])
            b['material']={(X-x,Y-y) for X,Y in b['material']};b['ports']={(X-x,Y-y) for X,Y in b['ports']}
            poses.append((0,x,y))
        candidates.append({'background':background,'marker':color,'unit':unit,'phase':phase,'bodies':bodies,'poses':tuple(poses),
            'width':a.shape[1],'height':a.shape[0]})
    return candidates[0] if len(candidates)==1 else None


def cells(rows,m):
    a=np.asarray(rows);s=m['unit'];px,py=m['phase'];result={}
    for y in range(py,a.shape[0]-s+1,s):
        for x in range(px,a.shape[1]-s+1,s):
            cut=a[y:y+s,x:x+s]
            if np.all(cut==cut.flat[0]) and int(cut.flat[0])!=m['background']:
                result[(x-px)//s,(y-py)//s]=int(cut.flat[0])
    return result


def placed(m,i,pose):
    r,x,y=pose;b=m['bodies'][i];material,ports,_=view(b['material'],b['ports'],r)
    return {(x+X,y+Y) for X,Y in material},{(x+X,y+Y) for X,Y in ports}


def in_bounds(m,material):
    px,py=m['phase'];s=m['unit']
    return all(0<=px+x*s and px+(x+1)*s<=m['width'] and 1<=py+y*s and py+(y+1)*s<=m['height'] for x,y in material)


def observed_agrees(raw,m,poses):
    material=set();permitted=set()
    for i,p in enumerate(poses):
        full,ports=placed(m,i,p);material|=full
        permitted|=ports if m['bodies'][i]['known'] else full
    markers={p for p,value in raw.items() if value==m['marker']}
    return set(raw)==material and markers.issubset(permitted)


def agrees(rows,m,poses):
    return observed_agrees(cells(rows,m),m,poses)


def infer_poses(rows,m,previous,active=None):
    raw=cells(rows,m);occupied=set(raw);known=[]
    if observed_agrees(raw,m,previous):return previous
    indexes=range(len(previous)) if active is None else (active,)
    for i in indexes:
        others=set().union(*(placed(m,j,p)[0] for j,p in enumerate(previous) if j!=i))
        remainder=occupied-others
        if not remainder:continue
        for r in range(4):
            shape,_,_=view(m['bodies'][i]['material'],m['bodies'][i]['ports'],r)
            for X,Y in remainder:
                for x,y in shape:
                    pos=(r,X-x,Y-y);proposal=list(previous);proposal[i]=pos;proposal=tuple(proposal)
                    if others|{(pos[1]+xx,pos[2]+yy) for xx,yy in shape}==occupied and observed_agrees(raw,m,proposal):known.append(proposal)
    if not known:return None
    def cost(p):
        return sum(abs(a[1]-b[1])+abs(a[2]-b[2])+int(a[0]!=b[0]) for a,b in zip(p,previous))
    best=min(map(cost,known));unique={p for p in known if cost(p)==best}
    return next(iter(unique)) if len(unique)==1 else None


def update_ports(rows,m,poses,index):
    raw=cells(rows,m);body=m['bodies'][index];r,x,y=poses[index]
    _,_,transform=view(body['material'],body['ports'],r);inverse={p:q for q,p in transform.items()}
    seen={inverse[X-x,Y-y] for X,Y in placed(m,index,poses[index])[0] if raw.get((X,Y))==m['marker']}
    if seen and not body['known']:body['ports']=seen;body['known']=True
    return len(seen)


def compatible(m,i,pose,already):
    mat,ports=placed(m,i,pose)
    if not in_bounds(m,mat):return False
    core=mat-ports;counts=Counter(ports)
    for j,p in already.items():
        other,other_ports=placed(m,j,p)
        if core&other or (other-other_ports)&mat:return False
        counts.update(other_ports)
    return max(counts.values(),default=0)<=2


def assembly(m,current,active,rotation_sign):
    if m.get('pose_domains') is not None:return constrained_assembly(m,current,active,rotation_sign)
    best=None;best_pose=None;seen=set();n=len(current)
    def cost(i,p):
        q=current[i];turn=(p[0]-q[0])*rotation_sign%4 if rotation_sign else min((p[0]-q[0])%4,(q[0]-p[0])%4)
        return abs(p[1]-q[1])+abs(p[2]-q[2])+turn+int(p!=q and i!=active)
    def visit(poses,expense):
        nonlocal best,best_pose
        if best is not None and expense>=best:return
        key=tuple(sorted(poses.items()))
        if key in seen:return
        seen.add(key);counts=Counter(p for i,q in poses.items() for p in placed(m,i,q)[1])
        if len(poses)==n:
            if counts and all(v==2 for v in counts.values()):
                best=expense;best_pose=tuple(poses[i] for i in range(n))
            return
        free={p for p,v in counts.items() if v==1}
        for i in range(n):
            if i in poses:continue
            tried=set()
            for r in range(4):
                _,ports,_=view(m['bodies'][i]['material'],m['bodies'][i]['ports'],r)
                for X,Y in free:
                    for x,y in ports:
                        p=(r,X-x,Y-y)
                        if p in tried:continue
                        tried.add(p)
                        if compatible(m,i,p,poses):visit({**poses,i:p},expense+cost(i,p))
    for anchor in range(n):visit({anchor:current[anchor]},0)
    return best_pose


def constrained_assembly(m,current,active,rotation_sign):
    """Same material/port matching under measured finite pose domains.

    No free translation is added when the observation constrains support sites.
    Closure/connectivity remain requested compositions, not terminal authority.
    """
    domains=[set(map(tuple,d)) for d in m['pose_domains']];n=len(domains)
    projected={(i,p):placed(m,i,p) for i,d in enumerate(domains)for p in d}
    owners=defaultdict(set)
    for (i,p),(_,ports) in projected.items():
        for q in ports:owners[q].add(i)
    if any(len(v)>2 for v in owners.values()):return None
    interfaces=defaultdict(set)
    for point,ids in owners.items():
        if len(ids)==2:interfaces[tuple(sorted(ids))].add(point)
    best=None;best_cost=None;nodes=0
    def cost(i,p):return ((p[0]-current[i][0])*rotation_sign)%4 if rotation_sign else min((p[0]-current[i][0])%4,(current[i][0]-p[0])%4)
    def visit(ds):
        nonlocal nodes,best,best_cost
        nodes+=1
        while True:
            changed=False
            for i,d in enumerate(ds):
                valid={p for p in d if all(len(owners[q])==2 for q in projected[i,p][1])}
                for (a,b),shared in interfaces.items():
                    if i not in (a,b):continue
                    j=b if i==a else a
                    valid={p for p in valid if any(projected[i,p][1]&shared==projected[j,q][1]&shared and compatible(m,i,p,{j:q})for q in ds[j])}
                if not valid:return
                if valid!=d:ds[i]=valid;changed=True
            if not changed:break
        lower=sum(min(cost(i,p)for p in d)for i,d in enumerate(ds))
        if best_cost is not None and lower>=best_cost:return
        todo=[i for i,d in enumerate(ds)if len(d)>1]
        if todo:
            i=min(todo,key=lambda i:len(ds[i]))
            for p in sorted(ds[i],key=lambda p:(cost(i,p),p)):
                branch=[set(d)for d in ds];branch[i]={p};visit(branch)
            return
        poses=tuple(next(iter(d))for d in ds);counts=Counter(q for i,p in enumerate(poses)for q in projected[i,p][1])
        if not counts or any(v!=2 for v in counts.values()):return
        graph={i:set()for i in range(n)}
        for point in counts:
            a,b=owners[point];graph[a].add(b);graph[b].add(a)
        reached={0};pending=[0]
        while pending:
            for j in graph[pending.pop()]-reached:reached.add(j);pending.append(j)
        if m.get('require_connected') and len(reached)!=n:return
        if m.get('require_acyclic') and len(counts)!=n-1:return
        best=poses;best_cost=lower
    if all(domains):visit(domains)
    m['search_nodes']=nodes
    return best


def access_path(m,current,index,target,motion,allow_overlap=False):
    start=current[index];other={i:p for i,p in enumerate(current) if i!=index}
    reached={start:()};queue=deque([start])
    while queue:
        pose=queue.popleft()
        if pose==target:return reached[pose]
        for key,(dx,dy) in motion.items():
            p=(pose[0],pose[1]+dx,pose[2]+dy)
            allowed=in_bounds(m,placed(m,index,p)[0]) if allow_overlap else compatible(m,index,p,other)
            if p not in reached and allowed:
                reached[p]=reached[pose]+(key,);queue.append(p)
    return None


class PortAssembly:
    def __init__(self):
        self.epoch=None;self.motion={};self.rotation_key=None;self.rotation_sign=None;self.passed=[];self.events=[]

    def propose(self,o,rows,inputs,remaining):
        plain=sorted(a['action_ref'] for a in inputs if not a.get('data'))
        if len(plain)<2 or not any(a.get('data') for a in inputs):return None
        if self.epoch!=o['level_epoch']:
            self.epoch=o['level_epoch'];self.model=layout(o,rows);self.current=self.model['poses'] if self.model else None
            self.active=None;self.verified=set();self.seen=set();self.refs={};self.goal=None;self.first=o['observation_ref']
            self.overlay_observed=False;self.overlay_refuted=False
        m=self.model
        if not m:return None
        current=infer_poses(rows,m,self.current,self.active)
        if not current:return None
        self.current=current
        if self.active is not None:update_ports(rows,m,current,self.active)
        unknown=[key for key in plain if key not in self.motion and key!=self.rotation_key and (key,current) not in self.seen]
        steps=[]
        if self.active is None or len(self.motion)<4:
            key=unknown[0] if unknown else next(iter(self.motion),None)
            if key is None:return None
            steps=[{'action':{'action_ref':key},'mode':'calibrate','poses':current,'expected_after':None,'active':self.active}]
        else:
            unrevealed=[i for i,b in enumerate(m['bodies']) if not b['known']]
            target=unrevealed[0] if unrevealed else None
            if target is None:
                self.goal=assembly(m,current,self.active,self.rotation_sign)
                if self.goal is None:return None
                wrong=[i for i,p in enumerate(current) if p!=self.goal[i]]
                if not wrong:return None
                target=self.active if self.active in wrong else wrong[0]
            if target!=self.active:
                material,markers=placed(m,target,current[target]);core=material-markers;s=m['unit'];px,py=m['phase']
                cmd=next((a for a in inputs if a.get('data') and ((a['data']['x']-px)//s,(a['data']['y']-py)//s) in core),None)
                if not cmd:return None
                x,y=cmd['data']['x'],cmd['data']['y'];cx=(x-px)//s;cy=(y-py)//s;box=[px+cx*s,py+cy*s,px+(cx+1)*s-1,py+(cy+1)*s-1]
                steps=[{'action':cmd,'mode':'select','poses':current,'expected_after':current,'active':target,'box':box,'point_digest':rows_digest(projection(rows,box))}]
            elif not m['bodies'][target]['known']:
                return None
            elif self.goal[target][0]!=current[target][0]:
                key=self.rotation_key or (unknown[0] if len(unknown)==1 else None)
                if key is None:return None
                steps=[{'action':{'action_ref':key},'mode':'rotate','poses':current,'expected_after':None,'active':target}]
            else:
                path=access_path(m,current,target,self.goal[target],self.motion)
                if path is None and not self.overlay_refuted:
                    path=access_path(m,current,target,self.goal[target],self.motion,allow_overlap=True)
                if not path:return None
                poses=current
                for key in path[:min(remaining,16)]:
                    dx,dy=self.motion[key];p=poses[target];new=list(poses);new[target]=(p[0],p[1]+dx,p[2]+dy);new=tuple(new)
                    overlapping=not compatible(m,target,new[target],{j:q for j,q in enumerate(poses) if j!=target})
                    steps.append({'action':{'action_ref':key},'mode':'move','poses':poses,'expected_after':new,'active':target,'overlap_hypothesis':overlapping});poses=new
                    if key not in self.verified or overlapping and not self.overlay_observed:break
        if not steps:return None
        for i,s in enumerate(steps):s['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if i==0 else None}
        actions=[s['action'] for s in steps];refs=list(dict.fromkeys([o['observation_ref'],self.first,*self.refs.values()]));focus='C_ports_'+digest([refs,actions])[:16]
        why='Reveal ports carried by each rigid material, then realize a joint matching with two distinct owners per port and disjoint cores.'
        info={'materials':len(current),'known_ports':[len(b['ports']) for b in m['bodies']],'poses':current,'joint_goal':self.goal,
            'transit_overlap_observed':self.overlay_observed,'transit_overlap_refuted':self.overlay_refuted,
            'scope':'Final matching requires disjoint cores. A blocked access may test temporary editing overlap; the first unobserved overlap seals the prefix.'}
        facts={'repeated_marker_scale':True,'owned_materials':True,'joint_pairing_question':True}
        return {'status':'proposed','kind':'rigid_port_assembly','port_plan':info,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            if s['action'].get('data'):
                d=s['action']['data'];old=domain.bindings[self.epoch,frame][d['x'],d['y']]
                s['point_binding']={**old,'projection_bbox':s['box'],'projected_rows_digest':s['point_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];b=p['binding']
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and (i or o['observation_ref']==b['observation_ref'])
            and s['action']['action_ref'] in public.available_action_refs and agrees(public.frame_rows,self.model,s['poses']))
        return {'admitted':bool(ok),'reason':'compare_joint_material_occupancy_and_epoch'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        step=p['steps'][i];pred=step['expected_after'];matched=agrees(second,self.model,pred) if pred else None
        if step['mode']=='select':
            a,b=cells(first,self.model),cells(second,self.model)
            matched=matched and any(a.get(cell)!=b.get(cell) for cell in placed(self.model,step['active'],step['poses'][step['active']])[0])
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_rigid_material_prediction'}

    def record(self,before,after,command,first,second,p,i):
        s=p['steps'][i];old=s['poses'];mode=s['mode'];key=command['action_ref'];ref=after['observation_ref']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','ref':ref}
        predicted=s['expected_after']
        if mode=='move' and predicted and agrees(second,self.model,predicted) and not agrees(second,self.model,old):
            new=predicted
        else:
            new=infer_poses(second,self.model,old,s['active'] if mode!='calibrate' else None)
        event={'ref':ref,'status':'pose_measured' if new else 'pose_ambiguous','mode':mode}
        if new:
            self.current=new
            moved=[j for j,(a,b) in enumerate(zip(old,new)) if a!=b]
            if mode=='select':
                a,b=cells(first,self.model),cells(second,self.model);target=s['active']
                changed=any(a.get(cell)!=b.get(cell) for cell in placed(self.model,target,new[target])[0])
                self.active=target if changed else None
                event['selection_confirmed']=changed
                if changed:event['revealed_ports']=update_ports(second,self.model,new,target)
            elif len(moved)==1:
                j=moved[0];a,b=old[j],new[j];self.active=j
                if a[0]==b[0]:
                    vector=(b[1]-a[1],b[2]-a[2])
                    if (vector[0]==0)!=(vector[1]==0):self.motion[key]=vector;self.verified.add(key);self.refs[key]=ref
                else:
                    self.rotation_key=key;self.rotation_sign=(b[0]-a[0])%4;self.refs[key]=ref
            if s.get('overlap_hypothesis'):
                if new==predicted and new!=old:self.overlay_observed=True;self.refs['overlap']=ref
                elif new==old:self.overlay_refuted=True
                event['transit_overlap_observed']=self.overlay_observed;event['transit_overlap_refuted']=self.overlay_refuted
            if self.active is not None:update_ports(second,self.model,new,self.active)
            event['poses']=new
            event['retained_ports']=[sorted(b['ports']) for b in self.model['bodies']]
        self.seen.add((key,old));self.events.append(event);return event
