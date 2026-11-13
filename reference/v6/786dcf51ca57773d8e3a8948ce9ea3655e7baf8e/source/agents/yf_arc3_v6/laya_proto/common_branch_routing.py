"""Test parallel branch routing by positioning repeated straight contributors."""
from collections import Counter,defaultdict
from itertools import product
import numpy as np
from common_multiscale_constraints import digest,projection,rows_digest


def layout(o,rows,inputs):
    a=np.asarray(rows);cavities=[];rectangles=[]
    for e in o['entities']:
        l,t,r,b=e['bbox']
        if e['rectangular']:rectangles.append(e);continue
        if e['area']*2<(r-l+1)*(b-t+1):continue
        mask=np.ones((b-t+1,r-l+1),dtype=bool)
        for x,y in e['mask']:mask[y,x]=False
        yy,xx=np.nonzero(mask)
        if len(xx)<1 or len(xx)!=(max(xx)-min(xx)+1)*(max(yy)-min(yy)+1):continue
        x0,y0,x1,y1=min(xx),min(yy),max(xx),max(yy)
        touched=[x0==0,y0==0,x1==r-l,y1==b-t]
        if sum(touched)!=1 or x1-x0!=y1-y0:continue
        axis=0 if touched[0] or touched[2] else 1
        sign=1 if touched[0] or touched[1] else -1
        cavities.append({'box':list(map(int,(l+x0,t+y0,l+x1,t+y1))),'axis':axis,'sign':sign,'size':int(x1-x0+1),'hue':e['palette_value']})
    grouped=defaultdict(list)
    for c in cavities:grouped[c['axis'],c['sign'],c['size'],c['hue']].append(c)
    candidates=[]
    for (axis,sign,unit,hue),targets in grouped.items():
        if len(targets)<2:continue
        tangent=1-axis;target_coord={c['box'][axis] for c in targets}
        if len(target_coord)!=1:continue
        goal_positions={c['box'][tangent] for c in targets}
        if any(v%unit for v in goal_positions):continue
        sources=[]
        for e in rectangles:
            box=e['bbox'];dimensions=(box[2]-box[0]+1,box[3]-box[1]+1)
            if dimensions!=(unit,unit):continue
            for cap in rectangles:
                cb=cap['bbox']
                aligned=(cb[tangent]==box[tangent] and cb[tangent+2]==box[tangent+2])
                adjacent=cb[axis+2]+1==box[axis] if sign==1 else cb[axis]-1==box[axis+2]
                border=cb[axis]<=1 if sign==1 else cb[axis+2]>=a.shape[1-axis]-2
                if aligned and adjacent and border:sources.append(box);break
        if not sources:continue
        normal=min(c[axis] for c in sources) if sign==1 else max(c[axis] for c in sources)
        terminal=next(iter(target_coord));bars=[]
        for e in rectangles:
            box=e['bbox'];thick=box[axis+2]-box[axis]+1;length=box[tangent+2]-box[tangent]+1
            if thick!=unit or length<2*unit or length%unit or box[tangent]%unit:continue
            if not((box[axis]-normal)*sign>0 and (terminal-box[axis])*sign>0):continue
            bars.append({'position':tuple(box[:2]),'length':length//unit,'hue':e['palette_value']})
        if not bars:continue
        hues=Counter(b['hue'] for b in bars);singles=[i for i,b in enumerate(bars) if hues[b['hue']]==1]
        if len(bars)==1:active=0
        elif len(singles)==1:active=singles[0]
        else:continue
        order=sorted(range(len(bars)),key=lambda i:sign*bars[i]['position'][axis])
        candidates.append({'axis':axis,'tangent':tangent,'sign':sign,'unit':unit,'goals':tuple(sorted(x//unit for x in goal_positions)),
            'sources':tuple(sorted(c[tangent]//unit for c in sources)),'bars':bars,'active':active,'highlight':bars[active]['hue'],
            'order':order,'limit':a.shape[axis]//unit,'goal_boxes':[c['box'] for c in targets]})
    return candidates[0] if len(candidates)==1 else None


def bbox(pos,length,m):
    x,y=pos;s=m['unit']
    return [x,y,x+s*(length if m['tangent']==0 else 1)-1,y+s*(length if m['tangent']==1 else 1)-1]


def read_state(rows,m,expected):
    a=np.asarray(rows);poses=[];colors=[]
    for pos,b in zip(expected,m['bars']):
        box=bbox(pos,b['length'],m);cut=projection(a,box)
        if cut.size==0 or len(np.unique(cut))!=1:return None
        colors.append(int(cut.flat[0]));poses.append(tuple(pos))
    selected=[i for i,c in enumerate(colors) if c==m['highlight']]
    if len(selected)!=1:return None
    return tuple(poses),selected[0]


def observed_state(o,m,prior):
    options=[]
    for bar,pos in zip(m['bars'],prior):
        width=m['unit']*(bar['length'] if m['tangent']==0 else 1);height=m['unit']*(bar['length'] if m['tangent']==1 else 1)
        matches=[e for e in o['entities'] if e['rectangular'] and e['bbox'][2]-e['bbox'][0]+1==width and e['bbox'][3]-e['bbox'][1]+1==height]
        options.append(matches)
    best=None;answer=None
    for objects in product(*options):
        positions=tuple(tuple(e['position']) for e in objects)
        if len(set(positions))!=len(positions):continue
        selected=[i for i,e in enumerate(objects) if e['palette_value']==m['highlight']]
        if len(selected)!=1:continue
        score=sum(abs(p[0]-q[0])+abs(p[1]-q[1]) for p,q in zip(positions,prior))
        if best is None or score<best:best=score;answer=(positions,selected[0])
        elif score==best and answer!=(positions,selected[0]):answer=None
    return answer


def propagated(starts,m,with_exits=False):
    rays=set(m['sources'])
    exits=[]
    for i in m['order']:
        low=starts[i];high=low+m['bars'][i]['length']-1;hits={x for x in rays if low<=x<=high}
        if hits:rays=(rays-hits)|{low-1,high+1}
        outside={x for x in rays if x<0 or x>=m['limit']}
        exits.extend((i,x) for x in sorted(outside));rays-=outside
    return (rays,exits) if with_exits else rays


class BranchRouting:
    def __init__(self):
        self.epoch=None;self.motion={};self.passed=[];self.events=[]

    def propose(self,o,rows,inputs,remaining):
        if o['level_epoch']!=self.epoch:
            self.epoch=o['level_epoch'];self.model=layout(o,rows,inputs);self.verified=set();self.seen=set();self.refs={};self.finished=False
            self.current=tuple(b['position'] for b in self.model['bars']) if self.model else ()
        m=self.model
        if not m or self.finished:return None
        actual=observed_state(o,m,self.current)
        if not actual:return None
        positions,active=actual;self.current=positions;plain=sorted(a['action_ref'] for a in inputs if not a.get('data'))
        unknown=[k for k in plain if k not in self.motion and (k,positions,active) not in self.seen]
        ready=len(set(self.motion.values()))==4
        steps=[]
        if not ready:
            if not unknown:return None
            steps=[{'action':{'action_ref':unknown[0]},'mode':'calibrate','state':actual,'expected_after':None}]
        else:
            commits=[k for k in plain if k not in self.motion]
            if len(commits)!=1:return None
            options=[];t=m['tangent'];unit=m['unit']
            for starts in product(*(range(m['limit']-b['length']+1) for b in m['bars'])):
                if propagated(starts,m)!=set(m['goals']):continue
                displacement=[starts[i]*unit-positions[i][t] for i in range(len(starts))]
                cost=sum(abs(d)//unit for d in displacement)+sum(d!=0 and i!=active for i,d in enumerate(displacement))+1
                options.append((cost,starts,displacement))
            if not options:return None
            _,starts,delta=min(options)
            moving=[i for i,d in enumerate(delta) if d]
            if not moving:
                steps=[{'action':{'action_ref':commits[0]},'mode':'propagate','state':actual,'expected_after':None}]
            else:
                i=active if active in moving else moving[0]
                if i!=active:
                    box=bbox(positions[i],m['bars'][i]['length'],m)
                    cmd=next((a for a in inputs if a.get('data') and box[0]<=a['data']['x']<=box[2] and box[1]<=a['data']['y']<=box[3]),None)
                    if not cmd:return None
                    steps=[{'action':cmd,'mode':'select','state':actual,'expected_after':(positions,i),'box':box,'point_digest':rows_digest(projection(rows,box))}]
                else:
                    d=delta[i];desired=(unit*(1 if d>0 else -1),0) if t==0 else (0,unit*(1 if d>0 else -1))
                    keys=[k for k,v in self.motion.items() if v==desired]
                    if len(keys)!=1:return None
                    key=keys[0];state=actual
                    for _ in range(min(abs(d)//unit,remaining,16)):
                        pp=list(state[0]);p=pp[i];pp[i]=(p[0]+desired[0],p[1]+desired[1]);prediction=(tuple(pp),i)
                        steps.append({'action':{'action_ref':key},'mode':'move','state':state,'expected_after':prediction});state=prediction
                        if key not in self.verified:break
        if not steps:return None
        for i,s in enumerate(steps):s['expected_before']={'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if i==0 else None}
        actions=[s['action'] for s in steps];refs=list(dict.fromkeys([o['observation_ref'],*self.refs.values()]))
        focus='C_branches_'+digest([refs,actions])[:16]
        why='Align the outputs of observed straight contributors with every receiving cavity, then test propagation.'
        info={'sources':m['sources'],'cavities':m['goals'],'contributor_lengths':[b['length'] for b in m['bars']],'current':actual,
            'unit':m['unit'],'direction':m['sign'],'scope':'A straight contributor is hypothesized to pass incoming fronts to its two outside endpoints; all branches remain obligations.'}
        if ready:
            info['predicted_offscreen_obligations']=propagated(starts,m,with_exits=True)[1]
            info['boundary_hypothesis']='Visible branches must enter cavities; offscreen exits remain conditional on the observed official outcome.'
        facts={'source_cap_and_open_cavities':True,'parallel_contributors':True,'joint_terminal_branches':True}
        return {'status':'proposed','kind':'parallel_branch_routing','branch_plan':info,'actions':actions,'steps':steps,'facts':facts,
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
        s=p['steps'][i];bound=p['binding']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (i or o['observation_ref']==bound['observation_ref']) and read_state(public.frame_rows,self.model,s['state'][0])==s['state'])
        return {'admitted':bool(ok),'reason':'bind_selected_contributor_and_all_positions'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after']
        matched=read_state(second,self.model,pred[0])==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_observed_contributor_pose'}

    def record(self,before,after,command,first,second,p,i):
        s=p['steps'][i];mode=s['mode'];ref=after['observation_ref'];key=command['action_ref'];old=s['state']
        if after['levels_completed']>before['levels_completed']:
            self.passed.append({'score':after['levels_completed'],'ref':ref});return {'status':'official_boundary','ref':ref}
        current=observed_state(after,self.model,old[0]);event={'status':'measured_response','mode':mode,'before':old,'after':current,'ref':ref}
        if mode=='propagate':self.finished=True
        elif mode in ('calibrate','move'):
            self.seen.add((key,old[0],old[1]))
            if current:
                moved=[j for j,(a,b) in enumerate(zip(old[0],current[0])) if a!=b]
                if moved==[old[1]]:
                    a,b=old[0][moved[0]],current[0][moved[0]];vector=(b[0]-a[0],b[1]-a[1])
                    if (vector[0]==0)!=(vector[1]==0):self.motion[key]=vector;self.verified.add(key);self.refs[key]=ref
        if current:self.current=current[0]
        self.events.append(event);return event
