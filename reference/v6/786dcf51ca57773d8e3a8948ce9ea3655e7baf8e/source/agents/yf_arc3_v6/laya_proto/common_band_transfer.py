"""Test redistribution between adjacent visible bands against alignment goals."""
from collections import Counter,defaultdict,deque
from heapq import heappop,heappush
from itertools import takewhile
import numpy as np
from common_multiscale_constraints import digest,projection,rows_digest


def geometry(obs,rows,inputs):
    a=np.asarray(rows);groups=defaultdict(list);boxes=defaultdict(list)
    for e in obs['entities']:
        groups[e['palette_value']].append(e)
        if e['rectangular']:
            x,y,r,b=e['bbox']
            boxes[e['palette_value'],r-x+1,b-y+1].append(e)
    possible=[]
    for axis in (0,1):
        pairs=[]
        for hue,group in groups.items():
            if len(group)!=2 or not all(e['rectangular'] for e in group):continue
            short,long=sorted((e['bbox'] for e in group),key=lambda b:b[3-axis]-b[1-axis])
            if not(short[axis+2]-short[axis]==long[axis+2]-long[axis]<short[3-axis]-short[1-axis]<long[3-axis]-long[1-axis]):continue
            if short[axis]==long[axis]:continue
            # The compact reference is inserted in a straight separator:
            # the two immediately adjacent bands have the same material.
            l,t,r,b=short
            if not(0<short[axis] and short[2+axis]+1<a.shape[1-axis]):continue
            left=a[t:b+1,l-1] if axis==0 else a[t-1,l:r+1]
            right=a[t:b+1,r+1] if axis==0 else a[b+1,l:r+1]
            if len(np.unique(left))!=1 or not np.array_equal(left,right):continue
            pairs.append((hue,short,long,int(left[0])))
        if not pairs:continue
        for (hue,w,h),cand in boxes.items():
            if w!=h or len(cand)<2 or len(cand)%2:continue
            if len({e['bbox'][axis] for e in cand})!=1:continue
            buttons=sorted((e['bbox'] for e in cand),key=lambda b:b[1-axis])
            gaps=[buttons[i+1][1-axis]-buttons[i][3-axis]-1 for i in range(0,len(buttons),2)]
            if min(gaps)<=0 or len(set(gaps))!=1:continue
            depth=a.shape[1-axis];across=a.shape[axis]
            side=-1 if buttons[0][axis]+buttons[0][axis+2]>=depth else 1
            end=buttons[0][axis+2] if side==-1 else buttons[0][axis]
            controls=[];cuts=[];probes=defaultdict(list);adj=[]
            for i,box in enumerate(buttons):
                cmd=next((c for c in inputs if c.get('data') and box[0]<=c['data']['x']<=box[2] and box[1]<=c['data']['y']<=box[3]),None)
                if not cmd:break
                controls.append(cmd);j=i//2
                cross=box[1-axis]-1 if i%2==0 else box[3-axis]+1
                if not 0<=cross<across:break
                probes[j+(i%2)].append(cross)
                ray=a[cross,:] if axis==0 else a[:,cross]
                adj.extend(map(int,ray[box[axis]:box[2+axis]+1]))
                if not i%2:cuts.append((box[3-axis]+buttons[i+1][1-axis])/2)
            if len(controls)!=len(buttons) or len(probes)!=len(cuts)+1:continue
            freq=Counter(adj).most_common()
            if not freq or len(freq)>1 and freq[0][1]==freq[1][1]:continue
            targets={};markers=[];ok=True
            for color,ref,mobile,wall in pairs:
                cross=(mobile[1-axis]+mobile[3-axis])/2;i=sum(cross>c for c in cuts)
                if i in targets:ok=False;break
                targets[i]=(ref[axis]-mobile[axis])*side
                markers.append({'band':i,'color':color,'reference':list(ref),'mobile':list(mobile)})
            if not ok:continue
            model={'axis':axis,'side':side,'end':end,'fill':freq[0][0],'probes':[probes[i] for i in range(len(probes))],
                'controls':controls,'boxes':buttons,'markers':markers,'step':w,'cuts':cuts}
            q=quantities(rows,model)
            if not q:continue
            model['targets']={i:q[i]+delta for i,delta in targets.items()}
            if any(v<0 or v>depth or (v-q[i])%w for i,v in model['targets'].items()):continue
            possible.append(model)
    return possible[0] if len(possible)==1 else None


def quantities(rows,m):
    a=np.asarray(rows);axis=m['axis'];res=[]
    for probes in m['probes']:
        lengths=[]
        for cross in probes:
            ray=a[cross,:] if axis==0 else a[:,cross]
            span=ray[m['end']:] if m['side']==1 else ray[:m['end']+1][::-1]
            lengths.append(sum(1 for _ in takewhile(lambda x:x==m['fill'],span)))
        if len(set(lengths))!=1:return ()
        res.append(lengths[0])
    return tuple(res)


def effect(q,ctrl,sense,unit):
    edge=ctrl//2;clicked=edge+ctrl%2;other=2*edge+1-clicked
    receiver,donor=(clicked,other) if sense=='into_clicked' else (other,clicked)
    if q[donor]<unit:return q
    s=list(q);s[donor]-=unit;s[receiver]+=unit
    return tuple(s)


def find_path(q,targets,sense,unit,blocked,remaining):
    """A* over conserved measured lengths. Only adjacent transfers are hypothesized."""
    def lower(s):
        pos=sum(max(0,v-s[i]) for i,v in targets.items())
        neg=sum(max(0,s[i]-v) for i,v in targets.items())
        return max(pos,neg)//unit
    queue=[(lower(q),0,q)];cost={q:0};came={}
    while queue:
        _,d,s=heappop(queue)
        if d!=cost[s]:continue
        if lower(s)==0:
            path=[]
            while s!=q:s,cmd=came[s];path.append(cmd)
            return tuple(reversed(path))
        if d>=remaining:continue
        for cmd in range(2*(len(q)-1)):
            if (s,cmd) in blocked:continue
            nxt=effect(s,cmd,sense,unit)
            if nxt==s or d+1>=cost.get(nxt,remaining+1):continue
            estimate=d+1+lower(nxt)
            if estimate>remaining:continue
            cost[nxt]=d+1;came[nxt]=(s,cmd);heappush(queue,(estimate,d+1,nxt))
    return ()


class BandTransfer:
    def __init__(self):
        self.epoch=None;self.prior=None;self.passed=[];self.events=[]

    def start(self,o,rows,inputs):
        self.epoch=o['level_epoch'];self.model=geometry(o,rows,inputs);self.sense=None;self.blocked=set()
        self.supported=set();self.refs={};self.tried=set();self.refuted=False
        if self.model:self.initial=quantities(rows,self.model);self.first=o['observation_ref']

    def propose(self,o,rows,inputs,remaining):
        if self.epoch!=o['level_epoch']:self.start(o,rows,inputs)
        m=self.model
        if not m or self.refuted:return None
        q=quantities(rows,m)
        if not q:return None
        # Recheck the original target accents and the public displaced accents.
        for mark in m['markers']:
            box=list(mark['mobile']);axis=m['axis'];k=m['side']*(q[mark['band']]-self.initial[mark['band']])
            box[axis]+=k;box[2+axis]+=k
            if not np.all(projection(rows,box)==mark['color']) or not np.all(projection(rows,mark['reference'])==mark['color']):return None
        if all(q[i]==v for i,v in m['targets'].items()):return None
        sense=self.sense or self.prior
        path=find_path(q,m['targets'],sense,m['step'],self.blocked,remaining) if sense else ()
        if not path:
            fresh=[i for i in range(len(m['controls'])) if (q,i) not in self.tried]
            if not fresh:return None
            path=[fresh[0]]
        steps=[];start=q
        for cmd in path[:min(16,remaining)]:
            data=m['controls'][cmd]
            if data not in inputs:return None
            expected=effect(q,cmd,sense,m['step']) if sense else None
            box=m['boxes'][cmd]
            steps.append({'action':data,'control_index':cmd,'quantities':q,'expected_after':expected,
                'expected_before':{'level_epoch':self.epoch,'frame_hash':o['frame_hash'] if not steps else None},
                'point_digest':rows_digest(projection(rows,box)),'point_bbox':list(box)})
            if cmd not in self.supported or expected is None:break
            q=expected
        actions=[s['action'] for s in steps];refs=list(dict.fromkeys([o['observation_ref'],self.first,*self.refs.values()]))
        focus='C_band_'+digest([refs,actions])[:16];why='Test or compose adjacent changes of measured fill lengths until the mobile accents align with their fixed counterparts.'
        plan={'lengths':start,'constrained_lengths':sorted(m['targets'].items()),'alignment_axis':m['axis'],'signed_relation':sense,
            'quantum':m['step'],'participants':m['markers'],'control_pairs':len(m['controls'])//2,'full_conditional_length':len(path),
            'scope':'Transferred visible extent and marker alignment remain conditional until observed.'}
        facts={'fixed_and_mobile_marker_candidates':True,'band_samples_bound':True,'addressed_witnesses':True}
        return {'status':'proposed','kind':'aligned_band_transfers','band_plan':plan,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':plan,'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':refs},'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':self.epoch,'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            d=s['action']['data'];binding=domain.bindings[self.epoch,frame][d['x'],d['y']]
            s['point_binding']={**binding,'projection_bbox':s['point_bbox'],'projected_rows_digest':s['point_digest']}

    def before(self,p,i,public,o):
        s=p['steps'][i];b=p['binding']
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and (i or b['observation_ref']==o['observation_ref'])
            and s['action']['action_ref'] in public.available_action_refs and quantities(public.frame_rows,self.model)==tuple(s['quantities'])
            and rows_digest(projection(public.frame_rows,s['point_bbox']))==s['point_digest'])
        return {'admitted':bool(ok),'reason':'bind_current_band_lengths_and_local_actuator'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after'];matched=quantities(second,self.model)==tuple(pred) if pred is not None else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_measured_band_vector'}

    def record(self,before,after,command,first,second,p,i):
        s=p['steps'][i];ref=after['observation_ref'];idx=s['control_index'];old=tuple(s['quantities']);event={'ref':ref,'control':idx,'before':old}
        if after['levels_completed']>before['levels_completed']:
            self.prior=self.sense;self.passed.append({'score':after['levels_completed'],'ref':ref,'hypothesis':self.sense})
            return event|{'status':'official_boundary'}
        new=quantities(second,self.model);self.tried.add((old,idx))
        fit=[v for v in ('into_clicked','away_from_clicked') if new!=old and effect(old,idx,v,self.model['step'])==new]
        if len(fit)==1:
            if self.sense and self.sense!=fit[0]:self.refuted=True
            else:self.sense=fit[0];self.supported.add(idx);self.refs[idx]=ref
        elif new==old:self.blocked.add((old,idx))
        else:self.refuted=True
        event.update(after=new,status='refuted' if self.refuted else 'observed_band_response',signed_relation=self.sense)
        self.events.append(event);return event
