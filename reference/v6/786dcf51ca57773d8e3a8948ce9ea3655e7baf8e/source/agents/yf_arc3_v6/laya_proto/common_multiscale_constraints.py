"""Infer local categorical constraints from repeated windows at two measured scales.

Symbols, dimensions, slot, orientation, values and addresses are observations.
The inferred regularity is a candidate goal until an official boundary is seen.
"""
from collections import Counter,defaultdict,deque
from functools import reduce
from math import gcd
import hashlib,json
import numpy as np


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def rows_digest(value):
    a=np.asarray(value,dtype=np.uint8)
    return hashlib.sha256(repr(tuple(a.shape)).encode()+a.tobytes()).hexdigest()


def projection(rows,box):
    x,y,r,b=box
    return np.asarray(rows,dtype=np.uint8)[y:b+1,x:r+1]


def runs(a):
    for v in a:
        starts=[0]+(np.flatnonzero(v[1:]!=v[:-1])+1).tolist()+[len(v)]
        yield from (b-a for a,b in zip(starts,starts[1:]))


def turn(x,y,k):
    if k>=4:x=-x
    for _ in range(k%4):x,y=-y,x
    return x,y


def pitch(origins,axis,size):
    lines=defaultdict(set)
    for pos in origins:lines[pos[1-axis]].add(pos[axis])
    ds=Counter()
    for line in lines.values():
        seq=sorted(line)
        ds.update(b-a for a,b in zip(seq,seq[1:]) if b-a>size)
    if not ds:return None
    ordered=ds.most_common()
    return min(v for v,n in ordered if n==ordered[0][1])


def extract(obs,rows):
    a=np.asarray(rows,dtype=np.uint8);H,W=a.shape;rectangles=defaultdict(list)
    for e in obs['entities']:
        l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)>=2 and e['area']==w*h:rectangles[w,h].append((l,t))
    result=[]
    for (w,h),origins in sorted(rectangles.items(),key=lambda z:-len(z[1])):
        if len(origins)<4:continue
        dx=pitch(origins,0,w);dy=pitch(origins,1,h)
        if dx is None or dy is None:continue
        phases=Counter((x%dx,y%dy) for x,y in origins);tiles={}
        for (phx,phy),repeats in phases.items():
            if repeats<2:continue
            for y in range(phy,H-h,dy):
                for x in range(phx,W-w,dx):
                    if not x or not y:continue
                    inner=a[y:y+h,x:x+w]
                    ring=np.r_[a[y-1,x:x+w],a[y+h,x:x+w],a[y:y+h,x-1],a[y:y+h,x+w]]
                    if not np.all(ring==ring[0]) or np.any(inner==ring[0]):continue
                    if np.all(inner==inner[0,0]):tiles[x,y]={'value':int(inner[0,0])};continue
                    sx=reduce(gcd,runs(inner));sy=reduce(gcd,runs(inner.T))
                    nx,ny=w//sx,h//sy
                    if sx<=1 or sy<=1 or nx<2 or ny<2:continue
                    tile=inner[::sy,::sx];tiles[x,y]={'glyph':tile.tolist(),'shape':(nx,ny)}
        seen=set();components=[]
        for seed in origins:
            if seed not in tiles or seed in seen:continue
            work=[seed];seen.add(seed);group={}
            while work:
                p=work.pop();group[p]=tiles[p]
                for xx,yy in ((dx,0),(-dx,0),(0,dy),(0,-dy)):
                    n=(p[0]+xx,p[1]+yy)
                    if n in tiles and n not in seen:seen.add(n);work.append(n)
            if any('glyph' in v for v in group.values()) and sum('value' in v for v in group.values())>=2:components.append(group)
        if sum(sum('glyph' in t for t in g.values()) for g in components)>=2:
            result.append({'size':(w,h),'pitch':(dx,dy),'groups':components})
    return result


def votes(field,shape,anchor,orientation):
    dx,dy=field['pitch'];votes=[]
    for group in field['groups']:
        for (x,y),tile in group.items():
            if tile.get('shape')!=tuple(shape):continue
            glyph=tile['glyph'];reference=glyph[anchor[1]][anchor[0]]
            for j,row in enumerate(glyph):
                for i,symbol in enumerate(row):
                    if (i,j)==tuple(anchor):continue
                    u,v=turn(i-anchor[0],j-anchor[1],orientation);p=(x+u*dx,y+v*dy)
                    if 'value' in group.get(p,{}):votes.append(((x,y),p,symbol,reference,group[p]['value']))
    return votes


def mapping(rows):
    counts=defaultdict(Counter);refs=defaultdict(set)
    for src,_,symbol,reference,value in rows:
        counts[symbol][value==reference]+=1;refs[symbol].add(src)
    chosen={}
    for k,n in counts.items():
        if len(refs[k])<2 or n[True]==n[False]:return None
        chosen[str(k)]=n[True]>n[False]
    return chosen if set(chosen.values())=={False,True} else None


def induce(fields):
    fits=[]
    for field in fields:
        shapes={t['shape'] for g in field['groups'] for t in g.values() if 'shape' in t}
        for shape in shapes:
            for x in range(shape[0]):
                for y in range(shape[1]):
                    for orient in range(8):
                        rs=votes(field,shape,(x,y),orient);roles=mapping(rs)
                        if roles is None:continue
                        by=defaultdict(list)
                        for r in rs:by[r[0]].append(r)
                        qualified=[];cv_hits=cv_n=0
                        for src,held in by.items():
                            local=mapping([r for r in rs if r[0]!=src])
                            if local!=roles:continue
                            hits=sum(roles[str(tok)]==(v==c) for _,_,tok,c,v in held)
                            cv_hits+=hits;cv_n+=len(held)
                            if hits==len(held):qualified.append(src)
                        if not qualified or cv_hits*2<=cv_n:continue
                        base=max(sum(v==c for _,_,_,c,v in rs),sum(v!=c for _,_,_,c,v in rs))
                        if cv_hits<=base:continue
                        rule={'shape':list(shape),'anchor':[x,y],'orientation':orient,'roles':roles}
                        fits.append(((2*cv_hits-cv_n,cv_n),rule,field,{'window_count':len(by),'holdout_correct':cv_hits,
                            'holdout_total':cv_n,'perfect_holdout_count':len(qualified),'constant_baseline_correct':base}))
    if not fits:return []
    score=max(r[0] for r in fits)
    return [r[1:] for r in fits if r[0]==score]


def constraints(field,rule):
    rs=votes(field,rule['shape'],rule['anchor'],rule['orientation']);answer={}
    for src,p,symbol,reference,actual in rs:
        role=rule['roles'].get(str(symbol))
        if role is None:return None
        c=answer.setdefault(p,{'actual':actual,'eq':set(),'ne':set(),'sources':set()})
        c['eq' if role else 'ne'].add(reference);c['sources'].add(src)
    if not rs or any(len(c['eq'])>1 or c['eq']&c['ne'] for c in answer.values()):return None
    return answer


def accepts(c,value):return (not c['eq'] or value in c['eq']) and value not in c['ne']


class WindowConstraints:
    def __init__(self):
        self.evidence={};self.epoch=None;self.rule=None;self.provenance=None;self.prior=None;self.rejected=set();self.effects=defaultdict(list)
        self.deactivated=False;self.last=None;self.first=None;self.passed=[];self.cached_scene=None

    def _clear(self,epoch):
        self.epoch=epoch;self.rule=None;self.provenance=None;self.rejected=set();self.effects=defaultdict(list)
        self.deactivated=False;self.last=None;self.first=None;self.cached_scene=None

    def _fit(self,o,rows):
        fields=extract(o,rows)
        if self.rule is not None:
            for field in fields:
                if (field['size'],field['pitch'])!=self.cached_scene:continue
                c=constraints(field,self.rule)
                if c:return field,c
            return None,None
        fits=induce(fields)
        mode='empirical_cross_window_alignment'
        if not fits and self.prior:
            # Rebind the structural template, recomputing all local values and
            # overlaps. Its operator effect is deliberately unknown in this epoch.
            for field in fields:
                tab=constraints(field,self.prior['rule'])
                if tab and any(accepts(v,v['actual']) for v in tab.values()) and any(not accepts(v,v['actual']) for v in tab.values()):
                    fits.append((self.prior['rule'],field,{'source_score':self.prior['score'],'new_local_observations':len(tab)}))
            mode='rebound_as_local_probe'
        options=[]
        for rule,field,fit in fits:
            c=constraints(field,rule)
            if c:
                pattern=sorted((p,tuple(sorted(v['eq'])),tuple(sorted(v['ne']))) for p,v in c.items())
                options.append((pattern,rule,field,fit,c))
        if not options or any(r[0]!=options[0][0] for r in options[1:]):return None,None
        _,self.rule,field,fit,c=options[0]
        self.cached_scene=(field['size'],field['pitch']);self.first=o['observation_ref']
        self.provenance={'method':mode,'fit':fit,'equivalent_alignments':len(options),'initial_ref':self.first,
            'prior_scoring_ref':self.prior['ref'] if self.prior else None}
        return field,c

    def propose(self,o,rows,inputs,remaining):
        if not any(a.get('data') for a in inputs):return None
        if self.epoch!=o['level_epoch']:self._clear(o['level_epoch'])
        if self.deactivated:return None
        field,table=self._fit(o,rows)
        if field is None:return None
        w,h=field['size'];items=[]
        for (x,y),c in table.items():
            if accepts(c,c['actual']) or (x,y,c['actual']) in self.rejected:continue
            located=[a for a in inputs if a.get('data') and x<=a['data']['x']<x+w and y<=a['data']['y']<y+h]
            if len(located)!=1:continue
            value=self.predicted_rewrite(c)
            if value is not None and not accepts(c,value):continue
            items.append({'p':[x,y],'before':c['actual'],'equal':sorted(c['eq']),'different':sorted(c['ne']),
                'sources':[list(p) for p in sorted(c['sources'])],'action':located[0],'expected_value':value})
        if not items:return None
        items.sort(key=lambda z:(z['expected_value'] is None,-len(z['sources']),z['p']))
        arr=np.asarray(rows,dtype=np.uint8).copy();steps=[]
        places=[p for g in field['groups'] for p in g]
        box=[min(p[0] for p in places)-1,min(p[1] for p in places)-1,max(p[0] for p in places)+w,max(p[1] for p in places)+h]
        for item in items[:min(16,remaining)]:
            x,y=item['p'];expected=item['expected_value'];start=rows_digest(projection(arr,box))
            if expected is not None:arr[y:y+h,x:x+w]=expected
            steps.append({'action':item['action'],'expected_before':{'level_epoch':o['level_epoch'],'frame_hash':o['frame_hash'] if not steps else None},
                'expected_before_rows_digest':start,'expected_after':rows_digest(projection(arr,box)) if expected is not None else None,'constraint':item})
            if expected is None:break
        actions=[s['action'] for s in steps];focus='C_constraint_'+digest([o['observation_ref'],self.rule,actions])[:18]
        facts={'measured_instances':True,'local_constraint_conflict':True,'current_addresses_bound':True}
        why='Test or repair a measured disagreement between local instances of a repeated multiscale relation.'
        plan={'rule':self.rule,'fit':self.provenance,'cell_size':[w,h],'lattice_pitch':list(field['pitch']),'projection_bbox':box,'selected_cells':[s['constraint'] for s in steps],
            'total_violating_cells':sum(not accepts(v,v['actual']) for v in table.values()),'constraint_count':len(table),
            'prediction_scope':'hypothesized goal; direct property change unverified until measured'}
        refs=[o['observation_ref'],self.first]+([self.prior['ref']] if self.prior else [])
        self.last=plan
        return {'status':'proposed','kind':'public_window_constraint','constraint_plan':plan,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':why,'properties':plan,
                'relations':['contributes_to:G_official_completion']}],'question':{'reason':'test_measured_multiscale_constraint','hypothesis_refs':refs},
            'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':o['level_epoch'],'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':facts,'evidence':refs,'actions':actions,'constraint_forecast':plan,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,proposal,domain):
        for step in proposal['steps']:
            cmd=step['action'];x,y=cmd['data']['x'],cmd['data']['y'];bound=proposal['binding']
            frame=proposal['steps'][0]['expected_before']['frame_hash']
            first=domain.bindings[bound['level_epoch'],frame][x,y]
            step['point_binding']={**first,'source_frame_hash':frame,'projected_rows_digest':step['expected_before_rows_digest'],
                'projection_bbox':proposal['constraint_plan']['projection_bbox'],'scope':'same occurrence conditioned on exact projected field before this command'}

    def predicted_rewrite(self,constraint):
        known=self.effects[constraint['actual']]
        values={v for _,v,_ in known}
        return next(iter(values)) if len(values)==1 and len({p for p,_,_ in known})>=2 else None

    def before(self,proposal,index,public,obs):
        bound=proposal['binding'];s=proposal['steps'][index];c=s['constraint'];data=s['action']['data'];rows=np.asarray(public.frame_rows)
        x,y=c['p'];w,h=proposal['constraint_plan']['cell_size']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed'] and s['action']['action_ref'] in public.available_action_refs
            and (index>0 or obs['observation_ref']==bound['observation_ref']) and rows_digest(projection(rows,proposal['constraint_plan']['projection_bbox']))==s['expected_before_rows_digest']
            and x<=data['x']<x+w and y<=data['y']<y+h and np.all(rows[y:y+h,x:x+w]==c['before']))
        return {'admitted':bool(ok),'reason':'current_constraint_and_point_bound' if ok else 'projected_constraint_or_address_changed'}

    def after(self,proposal,index,before,after,first,second):
        if before['level_epoch']!=after['level_epoch'] or before['state']!=after['state'] or before['levels_completed']!=after['levels_completed']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=proposal['steps'][index]['expected_after'];matched=rows_digest(projection(second,proposal['constraint_plan']['projection_bbox']))==pred if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or index+1==len(proposal['steps']),
                'reason':'projected_local_rewrite' if matched else 'uncharacterized_or_different_local_effect'}

    def record(self,before,after,command,first,second,proposal,index):
        if 'constraint_plan' not in proposal:return None
        plan=proposal['constraint_plan'];step=proposal['steps'][index];c=step['constraint'];x,y=c['p'];w,h=plan['cell_size']
        if step['action']!=command or before['level_epoch']!=proposal['binding']['level_epoch']:
            raise ValueError('Observed rewrite differs from the committed input or epoch')
        if after['levels_completed']>before['levels_completed']:
            self.prior={'rule':dict(self.rule),'ref':after['observation_ref'],'score':after['levels_completed']};self.passed.append(self.prior)
            self._clear(after['level_epoch']);return {'status':'official_boundary_witness','evidence':after['observation_ref'],'transfer_authority':'hypothesis_only'}
        a=np.asarray(first);b=np.asarray(second);values=np.unique(b[y:y+h,x:x+w]);changed=a!=b;mask=changed.copy();mask[y:y+h,x:x+w]=False
        ok=len(values)==1 and int(values[0])!=c['before'] and not np.any(projection(mask,plan['projection_bbox']))
        if not ok:
            self.rejected.add((x,y,c['before']))
            return {'status':'no_unique_local_rewrite','address':[x,y],'outside_changed':int(np.count_nonzero(mask))}
        value=int(values[0]);self.effects[c['before']].append(((x,y),value,after['observation_ref']))
        repaired=(not c['equal'] or value in c['equal']) and value not in c['different']
        return {'status':'local_rewrite_witness','address':[x,y],'before':c['before'],'after':value,'satisfies_frozen_constraint':repaired,
            'constraint_refs':c['sources'],'changes_outside_bound_field':int(np.count_nonzero(mask)),'counterexample_retained':not repaired}
