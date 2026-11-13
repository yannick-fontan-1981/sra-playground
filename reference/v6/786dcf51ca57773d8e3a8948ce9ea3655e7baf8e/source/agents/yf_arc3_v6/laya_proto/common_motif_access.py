"""Test visible command motifs as means of changing a blocked geometric access."""
from collections import Counter,defaultdict,deque
from itertools import combinations
import numpy as np
from geometric_observer import components,framed_patterns
from common_multiscale_constraints import digest,projection,rows_digest


def lattice(o,rows,inputs):
    by_size=defaultdict(list);a=np.asarray(rows)
    for e in o['entities']:
        l,t,r,b=e['bbox']
        if e['rectangular'] and r-l==b-t and r>l:by_size[r-l+1].append(e)
    fields=[]
    for size,group in by_size.items():
        positions={(e['bbox'][0],e['bbox'][1]):e for e in group}
        xs=sorted({x for x,y in positions});ys=sorted({y for x,y in positions})
        for y,row in ((y,sorted(x for x,Y in positions if Y==y)) for y in ys):
            if len(row)<2 or len({b-a for a,b in zip(row,row[1:])})!=1:continue
            pitch=row[1]-row[0];n=len(row)
            pts=[(x,y+j*pitch) for j in range(n) for x in row]
            if not all(p in positions for p in pts):continue
            cmds=[]
            for x,Y in pts:
                cmd=next((c for c in inputs if c.get('data') and x<=c['data']['x']<x+size and Y<=c['data']['y']<Y+size),None)
                if not cmd:break
                cmds.append(cmd)
            if len(cmds)!=len(pts):continue
            cards=[]
            for p in framed_patterns(rows,components(rows)):
                l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
                if any(l<=x<=r and t<=Y<=b for x,Y in pts):continue
                islands=[e for e in o['entities'] if e['palette_value']==p['color'] and e['rectangular'] and l<=e['bbox'][0]<=e['bbox'][2]<=r and t<=e['bbox'][1]<=e['bbox'][3]<=b]
                if len(islands)<2:continue
                dimensions={(e['bbox'][2]-e['bbox'][0]+1,e['bbox'][3]-e['bbox'][1]+1) for e in islands}
                if len(dimensions)!=1:continue
                sw,sh=next(iter(dimensions));gx=(w-sw*n)/(n-1);gy=(h-sh*n)/(n-1)
                if gx<0 or gy<0 or int(gx)!=gx or int(gy)!=gy:continue
                marks=[]
                for e in islands:
                    X,Y=e['position'];ix=(X-l)/(sw+gx);iy=(Y-t)/(sh+gy)
                    if ix!=int(ix) or iy!=int(iy) or not(0<=ix<n and 0<=iy<n):break
                    marks.append(int(iy)*n+int(ix))
                if len(marks)==len(islands):
                    cards.append({'mask':tuple(sorted(marks)),'box':p['bbox']})
            if cards:fields.append({'points':pts,'size':size,'commands':cmds,'cards':cards,'base':tuple(int(a[Y,x]) for x,Y in pts),'n':n})
    return fields[0] if len(fields)==1 else None


def body(rows,ui_top,colors=None,expected=None):
    # Connected regions can merge on contact. A previously predicted footprint
    # remains measurable through its balanced two-tone internal structure.
    if expected is not None and colors:
        (x,y),size=expected
        if size%2==0 and min(x,y)>=0 and x+size<=len(rows[0]) and y+size<=ui_top:
            patch=np.asarray(rows)[y:y+size,x:x+size]
            halves=((patch[:,:size//2],patch[:,size//2:]),(patch[:size//2],patch[size//2:]))
            for first,second in halves:
                if np.all(first==first.flat[0]) and np.all(second==second.flat[0]) and {int(first.flat[0]),int(second.flat[0])}==set(colors):
                    return {'position':(x,y),'size':size,'colors':tuple(colors),'box':[x,y,x+size-1,y+size-1]}
    pp=[p for p in components(rows) if p['bbox'][3]<ui_top and p['rectangular']]
    options=[]
    for p,q in combinations(pp,2):
        if p['color']==q['color'] or p['area']!=q['area']:continue
        if colors and set(colors)!={p['color'],q['color']}:continue
        a,b=p['bbox'],q['bbox'];l,t,r,bot=min(a[0],b[0]),min(a[1],b[1]),max(a[2],b[2]),max(a[3],b[3])
        if r-l!=bot-t or (r-l+1)*(bot-t+1)!=p['area']+q['area']:continue
        options.append({'position':(l,t),'size':r-l+1,'colors':tuple(sorted((p['color'],q['color']))),'box':[l,t,r,bot]})
    return options[0] if len(options)==1 else None


def target(rows,ui_top,colors):
    found=[]
    for p in framed_patterns(rows,components(rows)):
        l,t,r,b=p['bbox']
        if b>=ui_top or p['color'] not in colors:continue
        a=np.asarray(rows);ys,xs=np.nonzero(a[t:b+1,l:r+1]==p['color'])
        if len(xs) and len(xs)==(max(xs)-min(xs)+1)*(max(ys)-min(ys)+1):
            found.append([l+min(xs),t+min(ys),l+max(xs),t+max(ys)])
    return [int(x) for x in found[0]] if len(found)==1 else None


def paths(rows,b,vectors,ui_top,blocked):
    """Enumerate supported poses while preserving the last measured input."""
    a=np.asarray(rows);background=Counter(map(int,a[:ui_top].ravel())).most_common(1)[0][0]
    size=b['size'];start=(b['position'],None);known={start:()};q=deque([start])
    while q:
        p,last=q.popleft()
        for key,d in vectors.items():
            n=(p[0]+d[0],p[1]+d[1]);state=(n,key)
            if state in known or min(n)<0 or n[0]+size>a.shape[1] or n[1]+size>ui_top:continue
            box=[n[0],n[1],n[0]+size-1,n[1]+size-1]
            if (p,key,size) in blocked and rows_digest(projection(rows,box))==blocked[p,key,size]:continue
            if np.any(a[n[1]:n[1]+size,n[0]:n[0]+size]==background):continue
            known[state]=known[p,last]+(key,);q.append(state)
    return known


def route(rows,b,goal,vectors,ui_top,blocked):
    if not goal or not vectors:return None
    size=b['size']
    def solved(p):
        return goal[0]<=p[0] and goal[1]<=p[1] and p[0]+size-1<=goal[2] and p[1]+size-1<=goal[3]
    found=[path for (p,k),path in paths(rows,b,vectors,ui_top,blocked).items() if solved(p)]
    return min(found,key=len) if found else None


class MotifAccess:
    def __init__(self):
        self.epoch=None;self.learned={};self.motion={};self.passed=[];self.events=[]

    def start(self,o,rows,inputs):
        self.epoch=o['level_epoch'];self.grid=lattice(o,rows,inputs);self.tried=set();self.seen=set();self.verified=set();self.selected=None;self.retired=False;self.refs={}
        self.ink=None;self.ray=None;self.facing=None;self.blocked={}
        self.tracked=None
        if self.grid:
            self.ui_top=min(min(p['box'][1] for p in self.grid['cards']),min(y for x,y in self.grid['points']))
            b=body(rows,self.ui_top)
            self.colors=b['colors'] if b else None;self.first=o['observation_ref']
            if b:self.tracked=(b['position'],b['size'])
        else:self.colors=None

    def bits(self,rows):
        g=self.grid;a=np.asarray(rows)
        return tuple(int(a[y,x])==self.ink if self.ink is not None else int(a[y,x])!=v for (x,y),v in zip(g['points'],g['base']))

    def aligned(self,p,size,key,receiver):
        if key not in self.motion:return False
        dx,dy=self.motion[key];x=2*p[0]+size-1;y=2*p[1]+size-1
        rx=receiver[0]+receiver[2];ry=receiver[1]+receiver[3]
        return (dy==0 and y==ry and (rx-x)*dx>0) or (dx==0 and x==rx and (ry-y)*dy>0)

    def aim_path(self,rows,b,goal):
        r=self.ray
        if not r:return None
        if rows_digest(projection(rows,r['receiver']))!=r['receiver_digest']:return None
        known=paths(rows,b,self.motion,self.ui_top,self.blocked)
        if not r.get('aimed'):
            if self.aligned(b['position'],b['size'],self.facing,r['receiver']):
                self.selected=r['card'];return ()
            found=[p for (pos,key),p in known.items() if self.aligned(pos,b['size'],key,r['receiver'])]
            return min(found,key=len) if found else None
        if goal:
            distance=lambda p:abs(2*p[0]+b['size']-1-goal[0]-goal[2])+abs(2*p[1]+b['size']-1-goal[1]-goal[3])
            near=[(distance(pos),len(path),path) for (pos,key),path in known.items() if distance(pos)<distance(b['position'])]
            if near:return min(near)[2]
        return None

    def infer_ray(self,first,second,old,frames):
        before=[p for p in components(first) if p['bbox'][3]<self.ui_top]
        observations=defaultdict(list);origin=(2*old[0][0]+old[1]-1,2*old[0][1]+old[1]-1)
        for index,frame in enumerate(frames):
            after=[p for p in components(frame) if p['bbox'][3]<self.ui_top]
            for part in after:
                if part['area']<=1 or part['color'] in self.colors or part['bbox'][0]>len(second[0])*0.9:continue
                stable=[p for p in before if p['color']==part['color']]
                if len(stable)!=1:continue
                receiver=stable[0]
                if not any(p['bbox']==receiver['bbox'] and p['color']==receiver['color'] for p in after):continue
                if part['bbox']==receiver['bbox']:continue
                box=part['bbox'];center=(box[0]+box[2],box[1]+box[3])
                if sum(a!=b for a,b in zip(center,origin))!=1:continue
                direction=tuple(int(a>b)-int(a<b) for a,b in zip(center,origin))
                key=(part['color'],tuple(receiver['bbox']),direction)
                observations[key].append((index,center))
        options=[]
        for (color,box,direction),positions in observations.items():
            if len({p for _,p in positions})<2:continue
            pixels=projection(first,box);inner=set(map(int,pixels.ravel()))-{color}
            linked=[]
            for p in before:
                if p['color'] not in inner:continue
                l,t,r,b=p['bbox']
                for (point,key,size),value in self.blocked.items():
                    dx,dy=self.motion[key];x,y=point[0]+dx,point[1]+dy
                    if max(l,x)<=min(r,x+size-1) and max(t,y)<=min(b,y+size-1):linked.append(p['bbox'])
            if linked:
                options.append({'receiver':list(box),'receiver_digest':rows_digest(pixels),'color':color,
                    'sampled_trajectory':positions,'direction':direction,'linked_blockers':linked})
        return options[0] if len(options)==1 else None

    def context(self,rows,expected=None):
        b=body(rows,self.ui_top,self.colors,expected)
        return (b['position'],b['size']) if b else None

    def propose(self,o,rows,inputs,remaining):
        if o['level_epoch']!=self.epoch:self.start(o,rows,inputs)
        if not self.grid or not self.colors or self.retired:return None
        b=body(rows,self.ui_top,self.colors,self.tracked)
        if not b:return None
        g=self.grid;actual=self.bits(rows);goal=target(rows,self.ui_top,self.colors)
        path=route(rows,b,goal,self.motion,self.ui_top,self.blocked)
        if not path and self.ray:path=self.aim_path(rows,b,goal)
        steps=[];state=(b['position'],b['size']);refs=[o['observation_ref'],self.first,*self.refs.values()]
        if path:
            for key in path[:min(remaining,16)]:
                d=self.motion[key];pred=((state[0][0]+d[0],state[0][1]+d[1]),state[1])
                steps.append({'action':{'action_ref':key},'mode':'walk','body':state,'bits':actual,'expected_after':pred})
                state=pred
                if key not in self.verified:break
        else:
            unresolved=sorted(a['action_ref'] for a in inputs if not a.get('data') and (a['action_ref'],state) not in self.seen and a['action_ref'] not in self.motion)
            if unresolved:
                steps=[{'action':{'action_ref':unresolved[0]},'mode':'calibrate','body':state,'bits':actual,'expected_after':None}]
            else:
                candidates=[p for p in g['cards'] if (p['mask'],state) not in self.tried]
                if self.selected is None:
                    if not candidates:return None
                    candidates.sort(key=lambda p:(p['mask'] in self.learned,len(p['mask']),p['mask']))
                    self.selected=candidates[0]['mask']
                desired=tuple(i in self.selected for i in range(len(actual)))
                changes=[i for i,(a,v) in enumerate(zip(actual,desired)) if a!=v]
                if not changes:return None
                current=actual
                for j,cell in enumerate(changes[:min(16,remaining)]):
                    cmd=g['commands'][cell]
                    if cmd not in inputs:return None
                    nxt=tuple(not bit if i==cell else bit for i,bit in enumerate(current));last=nxt==desired
                    x,y=g['points'][cell];sz=g['size'];box=[x,y,x+sz-1,y+sz-1]
                    steps.append({'action':cmd,'mode':'invoke' if last else 'toggle','body':state,'bits':current,'card':self.selected,
                        'expected_after':None if last else nxt,'address_box':box,'point_digest':rows_digest(projection(rows,box))})
                    if last or 'toggle' not in self.verified:break
                    current=nxt
        if not steps:return None
        for j,s in enumerate(steps):s['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if j==0 else None}
        actions=[s['action'] for s in steps];focus='C_motif_'+digest([refs,actions])[:16]
        why='Use an observed command motif to test a change in an inaccessible body or terrain, then recheck access to the homologous framed object.'
        plan={'actor_colors':self.colors,'actor':b['box'],'homologous_goal':goal,'measured_translations':self.motion.copy(),
            'cards':[p['mask'] for p in g['cards']],'selected':self.selected,'ui_lattice_size':g['n'],
            'scope':'Pattern activation, framed-goal role and rectangular-footprint access are provisional observed hypotheses.'}
        facts={'observed_regular_input_field':True,'measured_card_instances':True,'composite_body_observed':True}
        return {'status':'proposed','kind':'motif_to_geometric_access','motif_plan':plan,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':plan,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            if s['action'].get('data'):
                d=s['action']['data'];old=domain.bindings[self.epoch,frame][d['x'],d['y']]
                s['point_binding']={**old,'projection_bbox':s['address_box'],'projected_rows_digest':s['point_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];b=p['binding']
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i or o['observation_ref']==b['observation_ref']) and self.context(public.frame_rows,s['body'])==s['body'] and self.bits(public.frame_rows)==s['bits'])
        return {'admitted':bool(ok),'reason':'revalidate_actor_input_pattern_and_epoch'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        s=p['steps'][i];pred=s['expected_after']
        matched=(self.bits(second) if s['mode']=='toggle' else self.context(second,pred))==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_predicted_bit_or_body_effect'}

    def record(self,before,after,command,first,second,p,i,frames=()):
        s=p['steps'][i];ref=after['observation_ref'];mode=s['mode'];old=s['body'];key=command['action_ref']
        new=self.context(second,s['expected_after'] if mode=='walk' else old)
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'ref':ref,'score':after['levels_completed']});return {'status':'official_boundary','ref':ref}
        event={'status':'public_response','ref':ref,'mode':mode,'before':old,'after':new}
        if mode in ('walk','calibrate'):
            self.seen.add((key,old))
            if new and new[1]==old[1] and new[0]!=old[0]:
                dx,dy=new[0][0]-old[0][0],new[0][1]-old[0][1]
                if (dx==0)!=(dy==0):self.motion[key]=(dx,dy);self.verified.add(key);self.refs[key]=ref
            elif mode=='walk' and key in self.motion:
                d=self.motion[key];x,y=old[0][0]+d[0],old[0][1]+d[1];box=[x,y,x+old[1]-1,y+old[1]-1]
                self.blocked[old[0],key,old[1]]=rows_digest(projection(first,box))
            if key in self.motion:self.facing=key
        elif mode=='toggle':
            arr=np.asarray(second);bits=s['expected_after'];set_cells=[int(arr[y,x]) for (x,y),on in zip(self.grid['points'],bits) if on]
            if set_cells and len(set(set_cells))==1:self.ink=set_cells[0]
            if self.bits(second)==s['expected_after']:self.verified.add('toggle');self.refs['toggle']=ref
            else:self.retired=True;event['status']='grid_effect_refuted'
        elif mode=='invoke':
            self.tried.add((s['card'],old));self.learned[s['card']]={'ref':ref,'body_change':new!=old}
            self.selected=None;self.verified.clear();self.refs['invoke']=ref
            event['grid_cleared']=not any(self.bits(second))
            if self.ray and self.aligned(old[0],old[1],self.facing,self.ray['receiver']):
                self.ray={**self.ray,'aimed':True,'aligned_test_ref':ref}
            witness=self.infer_ray(first,second,old,frames)
            if witness:
                aimed=self.aligned(old[0],old[1],self.facing,witness['receiver'])
                self.ray={**witness,'card':s['card'],'evidence':ref,'aimed':aimed}
                event['remote_color_contact_hypothesis']=self.ray
        if new:self.tracked=new
        self.events.append(event);return event
