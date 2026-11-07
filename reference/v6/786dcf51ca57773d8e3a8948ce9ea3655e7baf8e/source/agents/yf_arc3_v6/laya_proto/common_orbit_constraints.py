"""Test whether addressed inputs permute contents along visible contours.

The layout, marked slots, commands and permutations are local hypotheses.
Only a measured transition can supply an operator to the constraint search.
"""
from collections import defaultdict, deque
from itertools import combinations

from common_multiscale_constraints import digest, rows_digest, projection


def silhouette(ent):
    pts = set(map(tuple, ent['mask']))
    variants = []
    for _ in range(4):
        pts = {(-y, x) for x, y in pts}
        for flip in (1, -1):
            q = sorted((flip*x, y) for x, y in pts)
            a, b = min(x for x, _ in q), min(y for _, y in q)
            variants.append(tuple((x-a, y-b) for x, y in q))
    return min(variants)


def hull(points):
    """Ordered boundary of the convex hull; keep collinear field slots."""
    p = sorted(points)
    if len(p) <= 2:
        return tuple(p)
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    if all(cross(p[0], p[-1], q) == 0 for q in p):
        return tuple(p)
    def half(items):
        stack = []
        for q in items:
            while len(stack) >= 2 and cross(stack[-2], stack[-1], q) < 0:
                stack.pop()
            stack.append(q)
        return stack[:-1]
    return tuple(half(p) + half(reversed(p)))


def cycles(positions):
    axes = [sorted(set(p[i] for p in positions)) for i in range(2)]
    index = {p: i for i, p in enumerate(positions)}
    results = set()
    for a, b in combinations(axes[0], 2):
        for c, d in combinations(axes[1], 2):
            pts = [p for p in positions if a <= p[0] <= b and c <= p[1] <= d]
            if len(pts) >= 3:
                results.add(tuple(index[p] for p in hull(pts)))
    for ax in range(2):
        for q in axes[ax]:
            line = sorted((p for p in positions if p[ax] == q),key=lambda p:p[1-ax])
            if len(line) >= 2:
                results.add(tuple(index[p] for p in line))
    # A neighboring contour can occupy the corners of a rectangular crop.
    # Sweep radial crops about centers formed by pairs of measured coordinates.
    centers=[{a+b for a in axis for b in axis} for axis in axes]
    for x in centers[0]:
        for y in centers[1]:
            layers=defaultdict(list)
            for p in positions:
                layers[(2*p[0]-x)**2+(2*p[1]-y)**2].append(p)
            inside=[]
            for _,layer in sorted(layers.items()):
                inside.extend(layer)
                if len(inside)>=3:
                    results.add(tuple(index[p] for p in hull(inside)))
    return results


def field(obs, inputs):
    entities = obs['entities']
    squares, irregular = defaultdict(list), defaultdict(list)
    by_corner = {tuple(e['bbox']):e for e in entities if e['rectangular']}
    for ent in entities:
        x,y,r,b = ent['bbox']
        if ent['rectangular'] and r-x == b-y:
            squares[r-x+1].append(ent)
        elif not ent['rectangular'] and ent['area']*2 > (r-x+1)*(b-y+1):
            irregular[silhouette(ent)].append(ent)
    fields = []
    for w, cells in squares.items():
        if len(cells) < 3 or len({e['palette_value'] for e in cells}) < 2:
            continue
        positions = sorted(tuple(e['position']) for e in cells)
        targets = {}
        for i,(x,y) in enumerate(positions):
            for m in (k for k in squares if k < w):
                marks = [by_corner.get((a,b,a+m-1,b+m-1)) for a in (x-m,x+w) for b in (y-m,y+w)]
                if all(marks) and len({e['palette_value'] for e in marks}) == 1:
                    targets[i] = marks[0]['palette_value']
        if not targets:
            continue
        controls = {}
        for group in irregular.values():
            if len(group) < 2 or len({tuple(map(tuple,e['mask'])) for e in group}) < 2:
                continue
            for e in group:
                x,y,r,b = e['bbox']
                mask=set(map(tuple,e['mask']))
                for cmd in inputs:
                    data = cmd.get('data',{})
                    if data and x<=data['x']<=r and y<=data['y']<=b and (data['x']-x,data['y']-y) in mask:
                        controls[data['x'],data['y']] = (cmd, e['bbox'])
        if controls:
            fields.append((positions,w,targets,controls))
    return fields[0] if len(fields)==1 else None


def values(rows, positions, size):
    result=[]
    for x,y in positions:
        value=int(rows[y][x])
        if any(int(rows[b][a])!=value for b in range(y,y+size) for a in range(x,x+size)):
            return ()
        result.append(value)
    return tuple(result)


def fit(before,after,contours):
    changed={i for i,(a,b) in enumerate(zip(before,after)) if a!=b}
    if not changed or sorted(before)!=sorted(after):
        return set()
    candidates=set()
    for ring in contours:
        if not changed.issubset(ring):
            continue
        for direction in (-1,1):
            perm=list(range(len(before)))
            for j,destination in enumerate(ring):
                perm[destination]=ring[(j-direction)%len(ring)]
            if all(before[src]==after[i] for i,src in enumerate(perm)):
                candidates.add(tuple(perm))
    return candidates


def route(values_now, targets, operators, budget):
    """Backward search over marked positions, not over all content arrangements."""
    start=tuple(targets)
    queue=deque([(start,())])
    seen={start}
    while queue:
        pos,path=queue.popleft()
        if all(values_now[i]==v for i,v in zip(pos,targets.values())):
            return path
        if len(path)>=budget:
            continue
        for key,op in sorted(operators.items()):
            pred=tuple(op[i] for i in pos)
            if pred not in seen:
                seen.add(pred);queue.append((pred,(key,)+path))
    return None


class OrbitConstraints:
    def __init__(self):
        self.layout=None
        self.history=[]
        self.scored=[]

    def propose(self,o,rows,inputs,remaining):
        if not any(a.get('data') for a in inputs):
            return None
        scene=field(o,inputs)
        if not scene:
            return None
        positions,size,targets,controls=scene
        layout=(o['level_epoch'],tuple(positions),size,tuple(targets.items()),tuple(sorted(controls)))
        if layout!=self.layout:
            self.layout=layout;self.contours=cycles(positions);self.models={};self.refs={};self.tried=defaultdict(set)
        current=values(rows,positions,size)
        if not current or all(current[i]==v for i,v in targets.items()):
            return None
        known={key:next(iter(ps)) for key,ps in self.models.items() if len(ps)==1}
        path=route(current,targets,known,remaining)
        unexplored=sorted(key for key in controls if key not in self.models)
        if unexplored and (not path or len(path)>1):
            keys=[unexplored[0]]
            purpose='Test whether an unmeasured member of a repeated nonrectangular silhouette class changes the enclosed slot field.'
        elif path:
            keys=path[:min(16,remaining)]
            purpose='Compose locally observed permutations to match each enclosed slot to its four corner witnesses.'
        else:
            ambiguous=sorted(key for key,ps in self.models.items() if len(ps)>1 and current not in self.tried[key])
            if not ambiguous:return None
            keys=[ambiguous[0]]
            purpose='Repeat an addressed control in a different content arrangement to distinguish remaining permutations.'
        steps=[];refs=[o['observation_ref']];arr=current
        for key in keys:
            cmd,box=controls[key];op=known.get(key)
            pred=tuple(arr[i] for i in op) if op else None
            steps.append({'action':cmd,'key':list(key),'control_box':box,'control_digest':rows_digest(projection(rows,box)),
                'before_values':list(arr),'expected_after':list(pred) if pred else None,
                'expected_before':{'level_epoch':o['level_epoch'],'frame_hash':o['frame_hash'] if not steps else None}})
            if key in self.refs:refs.append(self.refs[key])
            if pred is None:break
            arr=pred
        actions=[s['action'] for s in steps];focus='C_orbit_'+digest([refs,actions])[:16]
        plan={'positions':positions,'size':size,'targets':list(targets.items()),'candidate_control_count':len(controls),
              'unique_observed_operators':len(known),'contour_family':'one-neighbor cyclic movement on a straight line or convex boundary',
              'target_status':'observable four-corner correspondence, tentative until score','why':purpose}
        facts={'corner_correspondence_observed':True,'address_on_repeated_control_shape':True,'conditional_prefix_bound':True}
        return {'status':'proposed','kind':'measured_slot_permutation','orbit_plan':plan,'actions':actions,'steps':steps,'facts':facts,
            'compositions':[{'id':focus,'role':'information_question','observed':False,'open_question':purpose,'properties':plan,
                'relations':['contributes_to:G_official_completion']}],'question':{'reason':purpose,'hypothesis_refs':refs},
            'route_refs':refs,'binding':{'observation_ref':o['observation_ref'],'level_epoch':o['level_epoch'],'levels_completed':o['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':purpose,'preconditions':facts,'evidence':refs,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}

    def bind(self,p,domain):
        frame=p['steps'][0]['expected_before']['frame_hash']
        for s in p['steps']:
            binding=domain.bindings[p['binding']['level_epoch'],frame][tuple(s['key'])]
            s['point_binding']={**binding,'projected_rows_digest':s['control_digest'],'projection_bbox':s['control_box']}

    def before(self,p,i,public,o):
        s=p['steps'][i];plan=p['orbit_plan'];bound=p['binding']
        ok=(public.level==bound['level_epoch'] and public.levels_completed==bound['levels_completed']
            and (i or o['observation_ref']==bound['observation_ref']) and s['action']['action_ref'] in public.available_action_refs
            and values(public.frame_rows,plan['positions'],plan['size'])==tuple(s['before_values'])
            and rows_digest(projection(public.frame_rows,s['control_box']))==s['control_digest'])
        return {'admitted':bool(ok),'reason':'compare_frozen_positions_contents_and_control'}

    def after(self,p,i,before,after,first,second):
        if (before['level_epoch'],before['state'],before['levels_completed'])!=(after['level_epoch'],after['state'],after['levels_completed']):
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        pred=p['steps'][i]['expected_after'];plan=p['orbit_plan']
        matched=values(second,plan['positions'],plan['size'])==tuple(pred) if pred else None
        return {'matched':matched,'seal_prefix':matched is not True or i+1==len(p['steps']),'reason':'compare_measured_permutation'}

    def record(self,before,after,command,first,second,p,i):
        step=p['steps'][i];key=tuple(step['key']);plan=p['orbit_plan'];ref=after['observation_ref']
        if command!=step['action']:raise ValueError('Orbit observation differs from released command')
        if after['levels_completed']>before['levels_completed']:
            self.scored.append({'ref':ref,'marked_slots':len(plan['targets']),'score':after['levels_completed']})
            return {'status':'official_boundary','ref':ref}
        old=tuple(step['before_values']);new=values(second,plan['positions'],plan['size'])
        fits=fit(old,new,self.contours) if new else set()
        if key in self.models:fits &= self.models[key]
        self.models[key]=fits;self.refs[key]=ref;self.tried[key].add(old)
        event={'ref':ref,'key':list(key),'status':'locally_fitted' if fits else 'no_supported_permutation','matches':len(fits),
               'changed_slots':sum(a!=b for a,b in zip(old,new))}
        self.history.append(event);return event
