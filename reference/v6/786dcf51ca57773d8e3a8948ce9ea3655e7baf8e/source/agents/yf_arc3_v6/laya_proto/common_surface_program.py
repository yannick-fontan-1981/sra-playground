"""Compose color writes to reproduce an observed homologous field.

Compass quantization, half-plane footprints and last-write wins are model
families. Command meanings and their applicability are measured in session.
"""
from collections import defaultdict,deque
from itertools import permutations
from math import atan2,pi
import numpy as np
from geometric_observer import components
from common_multiscale_constraints import digest,projection,rows_digest


def crop(a,b):
    x,y,r,t=b;return np.asarray(a)[y:t+1,x:r+1]


def inside(p,box):
    x,y=p;l,t,r,b=box;return l<=x<=r and t<=y<=b


def layout(o,rows,inputs):
    a=np.asarray(rows);groups=defaultdict(list)
    for e in o['entities']:
        l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<3 or e['area']!=2*(w+h)-4:continue
        cut=crop(a,e['bbox']);core=cut[1:-1,1:-1]
        if not(core.size and np.all(core==core.flat[0])):continue
        edge=cut.copy();edge[1:-1,1:-1]=e['palette_value']
        if np.all(edge==e['palette_value']) and core.flat[0]!=e['palette_value']:
            groups[w,h,e['palette_value']].append((int(core.flat[0]),(l+1,t+1,r-1,b-1)))
    results=[]
    for grp in groups.values():
        palette=dict(grp)
        if len(palette)<2 or len(palette)!=len(grp):continue
        if len({b[1] for _,b in grp})!=1 and len({b[0] for _,b in grp})!=1:continue
        domain={v:next((x for x in inputs if x.get('data') and inside((x['data']['x'],x['data']['y']),box)),None) for v,box in grp}
        if not all(domain.values()):continue
        rectangles=defaultdict(list)
        for c in components(np.isin(a,list(palette)).astype(np.uint8)):
            if c['color']!=1 or not c['rectangular']:continue
            l,t,r,b=c['bbox'];rectangles[r-l+1,b-t+1].append(tuple(c['bbox']))
        for size,boxes in rectangles.items():
            ref=[b for b in boxes if len(np.unique(crop(a,b)))>1]
            work=[b for b in boxes if len(np.unique(crop(a,b)))==1 and b not in palette.values()]
            if len(ref)==len(work)==1 and min(size)>1:
                result={'ref':ref[0],'work':work[0],'swatches':palette,'domain':domain,'palette':tuple(palette)}
                if observe(rows,result):results.append(result)
    return results[0] if len(results)==1 else None


def observe(rows,scene):
    a=np.asarray(rows);l,t,r,b=scene['work'];mask=np.isin(a,scene['palette'])
    panel_bottom=max([scene['ref'][3]]+[s[3] for s in scene['swatches'].values()])
    if not panel_bottom<t:return None
    mask[:panel_bottom+1]=False;mask[t:b+1,l:r+1]=False;mask[-1]=False
    ys,xs=np.nonzero(mask)
    if len(xs)==0:return None
    hues,counts=np.unique(a[ys,xs],return_counts=True)
    if sum(counts==max(counts))!=1:return None
    hue=int(hues[np.argmax(counts)])
    take=a[ys,xs]==hue;ys,xs=ys[take],xs[take]
    dx=2*float(np.mean(xs))-l-r;dy=2*float(np.mean(ys))-t-b
    if max(abs(dx),abs(dy))<min(r-l+1,b-t+1):return None
    pose=round(atan2(dy,dx)/(pi/4))%8
    return pose,hue,tuple(map(int,a[t:b+1,l:r+1].ravel()))


def attachment(scene,o,inputs,state):
    """Find a separated, smaller same-color carrier on the same observed ray."""
    pose,hue,_=state;l,t,r,b=scene['work'];cx=(l+r)/2;cy=(t+b)/2
    if pose%2 or r-l!=b-t:return None
    parts=[]
    for e in o['entities']:
        x,y,u,v=e['bbox'];ex=(x+u)/2;ey=(y+v)/2
        if e['palette_value']!=hue or y<=scene['ref'][3] or inside((ex,ey),scene['work']):continue
        if (round(atan2(ey-cy,ex-cx)/(pi/4))%8)!=pose:continue
        parts.append((e,(ex-cx)**2+(ey-cy)**2))
    if len(parts)!=2:return None
    (main,d),(tip,far)=sorted(parts,key=lambda e:e[1])
    if not(tip['area']<main['area'] and far>d):return None
    x,y,u,v=tip['bbox']
    cmd=next((a for a in inputs if a.get('data') and inside((a['data']['x'],a['data']['y']),tip['bbox'])
        and (a['data']['x']-x,a['data']['y']-y) in set(map(tuple,tip['mask']))),None)
    if not cmd:return None
    w=r-l+1;h=b-t+1;cells=set()
    for i,j in tip['mask']:
        if pose==6:q=(x+i-l,j)
        elif pose==2:q=(x+i-l,h-1-(v-y-j))
        elif pose==0:q=(w-1-(u-x-i),y+j-t)
        else:q=(i,y+j-t)
        if not(0<=q[0]<w and 0<=q[1]<h):return None
        cells.add(q)
    oriented=[0]*8
    for k in range(4):
        oriented[(pose+2*k)%8]=sum(1<<(j*w+i) for i,j in cells)
        cells={(w-1-j,i) for i,j in cells}
    return oriented,cmd,list(tip['bbox'])


RAYS=((1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1),(1,-1))


def advance(p,aim,motion):
    if motion=='bounded_axis':
        v=tuple(a+b for a,b in zip(RAYS[p],RAYS[aim]))
        return RAYS.index(v) if v in RAYS else p
    n=(aim-p)%8
    return p if n in (0,4) else (p+(1 if n<4 else -1))%8


def make_masks(w,h,inclusive):
    result=[]
    for dx,dy in RAYS:
        cells=[dx*(2*x+1-w)*h+dy*(2*y+1-h)*w for y in range(h) for x in range(w)]
        result.append(sum(1<<i for i,s in enumerate(cells) if s>0 or inclusive and s==0))
    return tuple(result)


def paint(grid,mask,hue):
    return tuple(hue if mask>>i&1 else v for i,v in enumerate(grid))


def program(current,target,pose,hue,masks):
    """Peel last strokes whose exposed regions agree with the target."""
    full=(1<<len(current))-1
    mismatch=sum(1<<i for i,(a,b) in enumerate(zip(current,target)) if a!=b)
    colors={c:sum(1<<i for i,x in enumerate(target) if x==c) for c in set(target)}
    found=[];depth=None;queue=deque([(full,())]);best={}
    while queue:
        visible,path=queue.popleft()
        if depth is not None and len(path)>depth:break
        if not(mismatch&visible):
            depth=len(path);found.append(path);continue
        for p,mask in enumerate(masks):
            region=mask&visible
            if not region:continue
            for c,col in colors.items():
                if region&~col:continue
                remain=visible&~region;n=len(path)+1
                # Keep equal-depth alternate stroke orders and spatial costs.
                if n>best.get(remain,n):continue
                best[remain]=n;queue.append((remain,((p,c),)+path))
    def cost(path):
        loc=pose;ink=hue;k=0
        for p,c in path:k+=min((p-loc)%8,(loc-p)%8)+int(c!=ink)+1;loc=p%8;ink=c
        return k,path
    return min(found,key=cost) if found else None


class SurfaceProgram:
    def __init__(self):
        self.epoch=None;self.prior=None;self.passed=[];self.events=[];self.evidence={}

    def start(self,o,rows,inputs):
        self.epoch=o['level_epoch'];self.scene=layout(o,rows,inputs);self.verified=set();self.discarded=False
        if self.scene is None:return
        self.keys=tuple(sorted(x['action_ref'] for x in inputs if not x.get('data')))
        if len(self.keys)!=5:self.scene=None;return
        all_models={(a,k) for a in permutations((0,2,4,6,'write')) for k in ('bounded_axis','angular_attraction')}
        self.models=set(self.prior['models']) if self.prior and self.prior['keys']==self.keys else all_models
        ref=self.scene['ref'];w=ref[2]-ref[0]+1;h=ref[3]-ref[1]+1
        self.masks=[make_masks(w,h,flag) for flag in (False,True)]
        accessory=attachment(self.scene,o,inputs,observe(rows,self.scene))
        if accessory:self.masks=[ms+tuple(accessory[0]) for ms in self.masks]
        self.target=tuple(map(int,crop(rows,ref).ravel()));self.first=o['observation_ref']

    def predict(self,state,meaning,masks,motion):
        p,h,g=state
        return (p,h,paint(g,masks[p],h)) if meaning=='write' else (advance(p,meaning,motion),h,g)

    def options(self,state,remaining,accessory):
        p,h,g=state;plans=[]
        for j,ms in enumerate(self.masks):
            path=program(g,self.target,p,h,ms)
            if path:plans.append((path,j))
        if not plans:return None
        def nominal(item):
            loc=p;ink=h;k=0
            for q,c in item[0]:k+=min((q-loc)%8,(loc-q)%8)+int(c!=ink)+1;loc=q%8;ink=c
            return k,item[0]
        path,j=min(plans,key=nominal);index,color=path[0];want=index%8
        if color!=h:
            return self.scene['domain'][color],(p,color,g),'swatch',path
        if index>=8 and p==want:
            if not accessory:return None
            return accessory[1],(p,h,paint(g,self.masks[j][index],h)),'test_attached_footprint',path
        score=[]
        for i,key in enumerate(self.keys):
            meanings=[a[i] for a,k in self.models];preds=[self.predict(state,a[i],self.masks[j],k) for a,k in self.models]
            def useful(s,m):
                if p==want:return int(m=='write')
                if m=='write':return -1 if s[2]!=g else 0
                d=lambda x:min((want-x)%8,(x-want)%8)
                return d(p)-d(s[0])
            gains=[useful(s,m) for s,m in zip(preds,meanings)]
            score.append((-sum(gains)/len(gains),-len(set(preds)),key,i))
        _,_,key,i=min(score)
        possibilities={self.predict(state,a[i],ms,k) for a,k in self.models for ms in self.masks}
        prediction=next(iter(possibilities)) if len(possibilities)==1 else None
        return {'action_ref':key},prediction,'labelled_input',path

    def propose(self,o,rows,inputs,remaining):
        if self.epoch!=o['level_epoch']:self.start(o,rows,inputs)
        if not self.scene or self.discarded or not self.models or not self.masks:return None
        initial=observe(rows,self.scene)
        if not initial or initial[2]==self.target:return None
        state=initial;steps=[];branches=[];accessory=attachment(self.scene,o,inputs,state)
        for _ in range(min(remaining,16)):
            result=self.options(state,remaining-len(steps),accessory if state[:2]==initial[:2] else None)
            if not result:break
            cmd,pred,mode,path=result;branches.append(path)
            box=(accessory[2] if mode=='test_attached_footprint' else self.scene['swatches'][pred[1]] if mode=='swatch' else None)
            steps.append({'action':cmd,'state':state,'expected_after':pred,'mode':mode,'address_box':box,
                'address_digest':rows_digest(crop(rows,box)) if box else None,
                'expected_before':{'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if not steps else None}})
            if pred is None or pred==state or mode=='test_attached_footprint' or cmd['action_ref'] not in self.verified or pred[2]==self.target:break
            state=pred
        if not steps:return None
        actions=[s['action'] for s in steps];refs=[o['observation_ref'],self.first,*dict.fromkeys(self.evidence.values())]
        focus='C_surface_'+digest([refs,actions])[:16]
        plan={'fixed_reference':self.scene['ref'],'editable_candidate':self.scene['work'],'current_pose':initial[0],
            'current_hue':initial[1],'backward_program':branches[0],'label_assignments_left':len(self.models),'footprint_variants':len(self.masks),
            'scope':'Measured equal-size fields, hypothetical last writes and one-step angular controls. Official boundary validates only the outcome.'}
        facts={'homologous_fields':True,'palette_bindings':True,'conditional_program':True}
        why='Bind the next input to the observed carrier and a write that preserves exposed reference cells.'
        return {'status':'proposed','kind':'surface_rewrite_program','surface_plan':plan,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':plan,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            if s['action'].get('data'):
                d=s['action']['data'];bound=domain.bindings[self.epoch,frame][d['x'],d['y']]
                s['point_binding']={**bound,'projection_bbox':list(s['address_box']),'projected_rows_digest':s['address_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];bind=p['binding']
        ok=(public.level==bind['level_epoch'] and public.levels_completed==bind['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i>0 or bind['observation_ref']==o['observation_ref']) and observe(public.frame_rows,self.scene)==s['state']
            and tuple(map(int,crop(public.frame_rows,self.scene['ref']).ravel()))==self.target)
        return {'admitted':ok,'reason':'bind_current_template_color_pose_and_surface'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after'];matched=observe(second,self.scene)==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_pose_hue_and_surface'}

    def record(self,before,after,command,first,second,p,i):
        old=p['steps'][i]['state'];key=command['action_ref'];ref=after['observation_ref']
        scored=after['levels_completed']>before['levels_completed']
        new=observe(second,self.scene) if not scored else None
        if key in self.keys:
            ix=self.keys.index(key)
            def match(m,ms):
                labels,motion=m
                s=self.predict(old,labels[ix],ms,motion)
                return s[2]==self.target if scored else s==new
            feasible={(m,k) for m in self.models for k,ms in enumerate(self.masks) if match(m,ms)}
            self.models={m for m,k in feasible};self.masks=[ms for k,ms in enumerate(self.masks) if any(j==k for m,j in feasible)]
            if self.models:self.verified.add(key);self.evidence[key]=ref
        elif new==p['steps'][i]['expected_after']:
            self.verified.add(key);self.evidence[key]=ref
        else:self.discarded=True
        event={'ref':ref,'input':key,'compatible_labels':len(self.models),'compatible_footprints':len(self.masks),
               'status':'official_boundary' if scored else 'tested_surface_effect'}
        if scored and self.models:
            self.prior={'keys':self.keys,'models':tuple(self.models)};self.passed.append({'ref':ref,'score':after['levels_completed']})
        self.events.append(event);return event
