"""A measured ternary-reduction hypothesis composed with movable supports."""
from collections import Counter, deque
from heapq import heappop, heappush
from itertools import count
from math import gcd
import numpy as np
from common_multiscale_constraints import digest, projection, rows_digest

VECTORS=((1,0),(-1,0),(0,1),(0,-1))

def add(a,b):return a[0]+b[0],a[1]+b[1]

def layout(observation,rows):
    groups=Counter((e['palette_value'],e['bbox'][2]-e['bbox'][0]+1) for e in observation['entities']
        if e['rectangular'] and e['bbox'][2]-e['bbox'][0]==e['bbox'][3]-e['bbox'][1] and e['area']>1)
    candidates=[]
    for (floor,unit),amount in groups.items():
        if amount<4:continue
        squares=[e for e in observation['entities'] if e['palette_value']==floor and e['area']==unit*unit and e['rectangular']]
        axes=[sorted({e['position'][axis] for e in squares}) for axis in (0,1)]
        gaps=[b-a for values in axes for a,b in zip(values,values[1:])]
        if not gaps:continue
        pitch=gcd(*gaps)
        if not unit<pitch<=2*unit:continue
        phase=tuple(squares[0]['position'][axis]%pitch for axis in (0,1))
        tokens=[e for e in observation['entities'] if e['bbox'][2]-e['bbox'][0]+1==unit and e['bbox'][3]-e['bbox'][1]+1==unit
            and unit*unit/2<e['area']<unit*unit and all(e['position'][axis]%pitch==phase[axis] for axis in (0,1))]
        colors=Counter(e['palette_value'] for e in tokens)
        if len(colors)!=1 or sum(colors.values())<2:continue
        rings=[e for e in observation['entities'] if e['bbox'][2]-e['bbox'][0]+1==unit+2 and e['bbox'][3]-e['bbox'][1]+1==unit+2
            and e['area']==4*unit+4 and all((e['position'][axis]+1)%pitch==phase[axis] for axis in (0,1))]
        if len({e['palette_value'] for e in rings})>1:continue
        m={'unit':unit,'pitch':pitch,'phase':phase,'floor':floor,'token':next(iter(colors)),'ring':rings[0]['palette_value'] if rings else None,
            'rail':None,'width':len(rows[0]),'height':len(rows)}
        if rings:
            samples=[]
            for e in rings:
                x,y=e['position'];x+=1;y+=1
                for dx,dy in VECTORS:
                    X,Y=x+dx*pitch,y+dy*pitch
                    if 0<=X and X+unit<=m['width'] and 1<=Y and Y+unit<=m['height']:
                        cut=np.asarray(rows)[Y:Y+unit,X:X+unit];center=int(cut[unit//2,unit//2])
                        if unit<=np.count_nonzero(cut==center)<unit*unit and center!=floor:samples.append(center)
            if not samples:continue
            m['rail']=Counter(samples).most_common(1)[0][0]
        candidates.append(m)
    return candidates[0] if len(candidates)==1 else None

def scan(rows,m):
    a=np.asarray(rows);s=m['unit'];pitch=m['pitch'];px,py=m['phase'];floor=set();pegs=set();rails=set();carriers=set()
    for y in range(py,a.shape[0]-s+1,pitch):
        if y<1:continue
        for x in range(px,a.shape[1]-s+1,pitch):
            q=((x-px)//pitch,(y-py)//pitch);cut=a[y:y+s,x:x+s]
            token=np.count_nonzero(cut==m['token'])>s*s/2
            if token:pegs.add(q)
            border=m['ring'] is not None and x>0 and y>0 and x+s<a.shape[1] and y+s<a.shape[0] and all(
                a[Y,X]==m['ring'] for X,Y in [(x-1,y-1),(x+s,y-1),(x-1,y+s),(x+s,y+s)])
            if border:carriers.add(q);rails.add(q)
            elif np.count_nonzero(cut==m['floor'])>=s*s/4:floor.add(q)
            if m['rail'] is not None and cut[s//2,s//2]==m['rail']:rails.add(q)
    edges=set()
    for p in rails:
        for v in VECTORS:
            q=add(p,v)
            if q not in rails:continue
            x=px+p[0]*pitch+s//2;y=py+p[1]*pitch+s//2
            line=[int(a[y+v[1]*k,x+v[0]*k]) for k in range(pitch+1)]
            permitted={m['rail'],m['ring'],m['token'],int(a[y,x]),int(a[y+v[1]*pitch,x+v[0]*pitch])}
            if set(line)<=permitted:edges.add((p,q))
    return {'floor':floor,'pegs':pegs,'carriers':tuple(sorted(carriers)),'rails':rails,'edges':edges}

def state(scene):return frozenset(scene['pegs']),tuple(scene['carriers'])

def moved(current,vector,edges):
    pegs,carriers=current;new=list(carriers);tokens=set(pegs)
    for index,p in enumerate(carriers):
        q=add(p,vector)
        if (p,q) in edges and q not in carriers and q not in tokens:
            new[index]=q
            if p in tokens:tokens.remove(p);tokens.add(q)
    return frozenset(tokens),tuple(sorted(new))

def successors(current,scene):
    pegs,carriers=current;supports=scene['floor']|set(carriers)
    for p in sorted(pegs):
        for vector in VECTORS:
            mid=add(p,vector);end=add(mid,vector)
            if mid in pegs and end in supports and end not in pegs:
                yield (frozenset((pegs-{p,mid})|{end}),carriers),('jump',p,end),2
    for vector in VECTORS:
        new=moved(current,vector,scene['edges'])
        if new!=current:yield new,('move',vector),1

def route(current,scene,limit,reveal=False):
    serial=count();queue=[(0,next(serial),current)];costs={current:0};parents={}
    # Finite search is bounded by the admitted primitive horizon and measured cells.
    while queue:
        cost,_,node=heappop(queue)
        if costs[node]!=cost:continue
        frontier=any(p in node[0] and any(add(add(p,v),v) not in scene.get('known_cells',set()) for v in VECTORS) for p in node[1])
        if (frontier and node!=current) if reveal else len(node[0])==1:
            result=[]
            while node!=current:
                previous,action=parents[node];result.append(action);node=previous
            return result[::-1]
        if cost>=limit:continue
        for following,action,weight in successors(node,scene):
            value=cost+weight
            if value<=limit and value<costs.get(following,float('inf')):
                costs[following]=value;parents[following]=(node,action);heappush(queue,(value,next(serial),following))
    return None

def pack_state(current):return [sorted(current[0]),list(current[1])]

def translated(scene,offset):
    result={name:{add(p,offset) for p in scene[name]} for name in ('floor','pegs','rails')}
    result['carriers']=tuple(sorted(add(p,offset) for p in scene['carriers']))
    result['edges']={(add(p,offset),add(q,offset)) for p,q in scene['edges']}
    return result

def visible_cells(m,offset):
    s=m['unit'];pitch=m['pitch'];px,py=m['phase']
    return {add(((x-px)//pitch,(y-py)//pitch),offset) for y in range(py,m['height']-s+1,pitch) if y>=1 for x in range(px,m['width']-s+1,pitch)}

def merge_scene(previous,local,m,offset):
    seen=visible_cells(m,offset);new=translated(local,offset)
    if previous is None:return new|{'known_cells':seen}
    return {'floor':previous['floor']|new['floor'],'rails':previous['rails']|new['rails'],'edges':previous['edges']|new['edges'],
        'known_cells':previous['known_cells']|seen,'pegs':(previous['pegs']-seen)|new['pegs'],
        'carriers':tuple(sorted((set(previous['carriers'])-seen)|set(new['carriers'])))}

def align_scene(rows,o,m,previous,offset):
    new_model=dict(m)
    a=np.asarray(rows);unit=m['unit'];floor=m['floor'];pitch=m['pitch'];phases=Counter()
    for y in range(1,a.shape[0]-unit+1):
        for x in range(a.shape[1]-unit+1):
            if a[y,x]!=floor or a[y-1,x]==floor or (x and a[y,x-1]==floor):continue
            if np.all(a[y:y+unit,x:x+unit]==floor):phases[x%pitch,y%pitch]+=1
    if phases:new_model['phase']=phases.most_common(1)[0][0]
    local=scan(rows,new_model);width=m['width']//m['pitch'];height=m['height']//m['pitch'];ranked=[]
    for dx in range(-width,width+1):
        for dy in range(-height,height+1):
            candidate=add(offset,(dx,dy));seen=visible_cells(new_model,candidate)
            overlap=seen&previous['known_cells'];actual={add(p,candidate) for p in local['floor']}
            expected=previous['floor']&seen
            agreement=len(actual&expected)
            mismatch=len((actual^expected)&overlap)
            if agreement>=min(3,len(previous['floor'])):
                ranked.append(((2*mismatch-agreement,-agreement),candidate))
    if not ranked:return None
    ranked.sort();best=ranked[0][0];matches=[value for rank,value in ranked if rank==best]
    if len(matches)!=1:return None
    chosen=matches[0]
    return new_model,chosen,merge_scene(previous,local,new_model,chosen)

class ReductionTransport:
    def __init__(self):
        self.epoch=None;self.passed=[];self.events=[]

    def propose(self,o,rows,inputs,remaining):
        if 'ACTION6' not in o['available_action_refs']:return None
        if self.epoch!=o['level_epoch']:
            self.epoch=o['level_epoch'];self.model=layout(o,rows);self.motion={};self.tested=set();self.verified=set();self.refs={};self.selected=None;self.retired=False;self.offset=(0,0);self.scene=None
        if not self.model or self.retired:return None
        scene=merge_scene(self.scene,scan(rows,self.model),self.model,self.offset);self.scene=scene;current=state(scene)
        path=route(current,scene,remaining)
        reveal=path is None
        if reveal:path=route(current,scene,remaining,reveal=True)
        if not path:return None
        steps=[];hypothetical=current;plain=[a['action_ref'] for a in inputs if not a.get('data') and a['action_ref']!='ACTION7']
        for operation in path:
            if operation[0]=='move':
                vector=operation[1];key=next((k for k,v in self.motion.items() if v==vector),None)
                if key is None:
                    key=next((k for k in plain if k not in self.motion and (k,current) not in self.tested),None)
                    if key is None:break
                    steps.append({'action':{'action_ref':key},'mode':'calibrate','current':pack_state(hypothetical),'expected_after':None,'vector_hypothesis':vector});break
                following=moved(hypothetical,vector,scene['edges'])
                steps.append({'action':{'action_ref':key},'mode':'move','current':pack_state(hypothetical),'expected_after':pack_state(following)})
                hypothetical=following
            else:
                _,start,end=operation
                for mode,cell in [('select',start),('jump',end)]:
                    if mode=='select' and self.selected==start and not steps:continue
                    s=self.model['unit'];pitch=self.model['pitch'];px,py=self.model['phase'];x=px+(cell[0]-self.offset[0])*pitch;y=py+(cell[1]-self.offset[1])*pitch
                    command=next((a for a in inputs if a.get('data') and x<=a['data']['x']<x+s and y<=a['data']['y']<y+s),None)
                    if command is None:break
                    following=hypothetical
                    if mode=='jump':
                        mid=((start[0]+end[0])//2,(start[1]+end[1])//2)
                        following=(frozenset((hypothetical[0]-{start,mid})|{end}),hypothetical[1])
                    steps.append({'action':command,'mode':mode,'cell':cell,'current':pack_state(hypothetical),'expected_after':pack_state(following),
                        'box':[x,y,x+s-1,y+s-1],'point_digest':rows_digest(projection(rows,[x,y,x+s-1,y+s-1]))})
                    hypothetical=following
                    # Selection can decorate the addressed receiver. Bind its next
                    # point from the returned public patch before releasing it.
                    break
                break
            if len(steps)>=min(16,remaining):break
        steps=steps[:min(16,remaining)]
        if not steps:return None
        # A changed target patch is rebound after a previous action changes it.
        for index,step in enumerate(steps):
            step['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if index==0 else None}
        refs=[o['observation_ref'],*self.refs.values()];actions=[s['action'] for s in steps];focus='C_reduction_'+digest([refs,actions])[:16]
        why='Test a departure-intermediate-arrival reduction while preserving a continuation through fixed and movable observed supports.'
        info={'population':len(current[0]),'carriers':len(current[1]),'continuation_operations':len(path),'control_vectors':self.motion,'reveal_frontier':reveal,'camera_offset':self.offset,
            'goal_hypothesis':'one remaining member of the repeated population','scope':'Public visible field; hidden regions and causal sufficiency remain unknown.'}
        facts={'measured_repeated_cells':True,'ternary_reduction_hypothesis':True,'bounded_continuation_found':True}
        return {'status':'proposed','kind':'supported_ternary_reduction','reduction_plan':info,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':info,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for step in p['steps']:
            if step['action'].get('data'):
                d=step['action']['data'];binding=domain.bindings[self.epoch,frame][d['x'],d['y']]
                step['point_binding']={**binding,'projection_bbox':step['box'],'projected_rows_digest':step['point_digest']}

    def before(self,p,i,public,o):
        step=p['steps'][i];b=p['binding'];current=pack_state(state(merge_scene(self.scene,scan(public.frame_rows,self.model),self.model,self.offset)))
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and (i or o['observation_ref']==b['observation_ref'])
            and step['action']['action_ref'] in public.available_action_refs and current==step['current'])
        return {'admitted':bool(ok),'reason':'bind_population_supports_and_epoch'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        step=p['steps'][i];pred=step['expected_after'];aligned=align_scene(second,after,self.model,self.scene,self.offset)
        matched=pack_state(state(aligned[2]))==pred if pred and aligned else None
        if step['mode']=='select':matched=matched and rows_digest(first)!=rows_digest(second)
        camera_changed=bool(aligned and (aligned[1]!=self.offset or aligned[0]['phase']!=self.model['phase']))
        return {'matched':matched,'seal_prefix':matched is not True or camera_changed or i+1==len(p['steps']),'reason':'camera_reconciled' if camera_changed else 'compare_frozen_population_and_supports'}

    def record(self,before,after,command,first,second,p,i):
        step=p['steps'][i];ref=after['observation_ref'];mode=step['mode']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','ref':ref}
        old=state(self.scene);aligned=align_scene(second,after,self.model,self.scene,self.offset)
        if aligned is None:
            self.retired=True;event={'ref':ref,'status':'camera_registration_ambiguous'};self.events.append(event);return event
        new_model,new_offset,new_scene=aligned;new=state(new_scene);event={'ref':ref,'mode':mode,'status':'observed_response','before_population':len(old[0]),'after_population':len(new[0]),'camera_offset':new_offset}
        if mode=='calibrate':
            key=command['action_ref'];self.tested.add((key,old))
            fits=[v for v in VECTORS if moved(old,v,self.scene['edges'])==new and old!=new]
            if len(fits)==1:self.motion[key]=fits[0];self.refs[key]=ref
            event['compatible_control_vectors']=fits
        else:
            matched=self.after(p,i,before,after,first,second)['matched']
            if matched:
                self.verified.add(mode);self.refs[mode]=ref
                self.selected=tuple(step['cell']) if mode=='select' else None
            else:
                self.selected=None
                # New exposed objects extend the world hypothesis and close the
                # prefix. A mismatching population inside the old view refutes it.
                self.retired=new_offset==self.offset and new_model['phase']==self.model['phase']
            event['matched']=matched
        self.model=new_model;self.offset=new_offset;self.scene=new_scene
        self.events.append(event);return event
