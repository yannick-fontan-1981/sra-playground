"""Lattice measurement and finite coverage enumeration for declared reflections."""
import itertools,json
from collections import Counter
from pathlib import Path
from geometric_observer import components
POLICY_PATH=Path(__file__).with_name('ar25_reflections.drm.json')
DIRS={'ACTION1':(0,-1),'ACTION2':(0,1),'ACTION3':(-1,0),'ACTION4':(1,0)}

def groups(points):
    todo=set(points);out=[]
    while todo:
        first=min(todo);todo.remove(first);group={first};stack=[first]
        while stack:
            x,y=stack.pop()
            for dx,dy in itertools.product((-1,0,1),repeat=2):
                p=(x+dx,y+dy)
                if p in todo:todo.remove(p);group.add(p);stack.append(p)
        out.append(group)
    return sorted(out,key=lambda g:min(g))

def shift(points,delta):return {(x+delta[0],y+delta[1]) for x,y in points}
def reflect(points,axis,dimension):
    return {(2*axis-x,y) if dimension==0 else (x,2*axis-y) for x,y in points}
def anchor(points):return (min(x for x,y in points),min(y for x,y in points))

class ReflectionPlanner:
    def __init__(self):
        self.policy=json.loads(POLICY_PATH.read_text());self.direct_color=None;self.image_color=None;self.marker_color=None;self.effects=[];self.known=set();self.world=None

    def lattice(self,rows,pitch=None):
        axis_hint=None
        if pitch is None:
            h,w=len(rows),len(rows[0]);cs=components(rows)
            bands={}
            for c in cs:
                box=c['bbox'];width,height=box[2]-box[0]+1,box[3]-box[1]+1
                if not (2<=min(width,height)<=min(h,w)//8 and max(width,height)>=min(h,w)*.3):continue
                dim=0 if height>width else 1;minor=min(width,height);key=(dim,box[dim],minor,c['color'])
                bands.setdefault(key,set()).update(range(box[1-dim],box[3-dim]+1))
            bands=[key for key,extent in bands.items() if len(extent)>=min(h,w)*.7 and max(extent)-min(extent)+1>=min(h,w)*.8]
            if len(bands)!=1:raise ValueError('Ambiguous interior axis band')
            dim,position,pitch,color=bands[0];axis_hint=(dim,position//pitch,color)
        n=(min(len(rows),len(rows[0]))-1)//pitch;cells={};mark_colors={}
        for y in range(n):
            for x in range(n):
                values=[rows[yy][xx] for yy in range(y*pitch,(y+1)*pitch) for xx in range(x*pitch,(x+1)*pitch)]
                color,count=Counter(values).most_common(1)[0];cells[x,y]=color
                if count==pitch*pitch-1:mark_colors[x,y]=next(v for v in values if v!=color)
        palette=set(cells.values())
        if self.marker_color is None:
            candidates=set(mark_colors.values())-palette
            if len(candidates)!=1:raise ValueError('Control marker color has no unique observable identity')
            self.marker_color=next(iter(candidates))
        if self.marker_color in palette:raise ValueError('Retained control marker conflicts with current role palette')
        marks={p for p,c in mark_colors.items() if c==self.marker_color}
        return {'pitch':pitch,'n':n,'cells':cells,'marks':marks,'axis_hint':axis_hint}

    def start(self,rows):
        obs=self.lattice(rows);cells=obs['cells'];n=obs['n'];bg=Counter(cells.values()).most_common(1)[0][0]
        dim,a,axis_color=obs['axis_hint'];families={c:{p for p,v in cells.items() if v==c} for c in set(cells.values())-{bg,axis_color}}
        pairs=[(c,d) for c,ps in families.items() for d,qs in families.items() if c!=d and reflect(ps,a,dim)==qs]
        if len(pairs)==2:
            pair=set(pairs[0]);marked=[c for c in pair if families[c]&obs['marks']]
            if len(marked)==1:self.direct_color=marked[0]
            if self.direct_color not in pair:raise ValueError('Direct family lacks prior observed or marked identity')
            image_color=next(c for c in pair if c!=self.direct_color);self.image_color=image_color
        elif self.direct_color in families and self.image_color is not None:
            image_color=self.image_color;pair={self.direct_color,image_color}
            clipped={p for p in reflect(families[self.direct_color],a,dim) if 0<=p[0]<n and 0<=p[1]<n}
            if clipped!=families.get(image_color,set()):raise ValueError('Retained reflection disagrees with visible subset')
        else:raise ValueError('No established reflection family under occlusion')
        targets=[c for c in families if c not in pair]
        if len(targets)!=1:raise ValueError('Ambiguous fixed target family')
        bodies=groups(families[self.direct_color]);target=families[targets[0]]
        world={'pitch':obs['pitch'],'n':n,'dimension':dim,'axis':a,'axis_color':axis_color,'background':bg,'direct_color':self.direct_color,'image_color':image_color,'target_color':targets[0],'bodies':bodies,'targets':target}
        self.world=world;self.selected=self.selection(obs);self.axis_movable=self.selected=='axis';self.plan=self.solve(world);self.initial_axis=a;self.switches=0
        return self.summary()

    def selection(self,obs,retain_under_coverage=False):
        w=self.world;marked=obs['marks'];owners=[]
        axis_marks=[p for p in marked if p[w['dimension']]==w['axis'] and obs['cells'][p]==w['axis_color']]
        body_marks=set().union(*(marked&b for b in w['bodies']))
        if axis_marks and all(p[w['dimension']]==w['axis'] for p in body_marks):return 'axis'
        if axis_marks:owners.append('axis')
        for i,b in enumerate(w['bodies']):
            if marked&b:owners.append(i)
        if len(owners)>1 and 'axis' not in owners:
            complete=[i for i in owners if body_marks<=w['bodies'][i]]
            if len(complete)==1:return complete[0]
        if not owners and not marked and retain_under_coverage and isinstance(self.selected,int) and w['bodies'][self.selected]&w['targets']:
            return self.selected
        if len(owners)!=1:raise ValueError('Selection identity ambiguous: '+str(owners))
        return owners[0]

    def solve(self,w):
        targets=w['targets'];n=w['n'];best=None
        axes=range(n) if self.axis_movable else [w['axis']]
        for a in axes:
            options=[]
            for body in w['bodies']:
                candidates={}
                for t in targets:
                    for q in body:
                        for inverse in (False,True):
                            goal=next(iter(reflect({t},a,w['dimension']))) if inverse else t
                            delta=(goal[0]-q[0],goal[1]-q[1]);direct=shift(body,delta);image=reflect(direct,a,w['dimension'])
                            if not all(0<=x<n and 0<=y<n for x,y in direct|image):continue
                            covered=(direct|image)&targets
                            if len(covered)<len(body):continue
                            candidates[delta]={'delta':delta,'covered':covered,'body':direct}
                options.append(list(candidates.values()))
            for choice in itertools.product(*options):
                covered=set().union(*(c['covered'] for c in choice))
                if covered!=targets:continue
                if any(choice[i]['body']&choice[j]['body'] for i in range(len(choice)) for j in range(i)):continue
                cost=abs(a-w['axis'])+sum(abs(c['delta'][0])+abs(c['delta'][1]) for c in choice)
                key=(cost,a,tuple(c['delta'] for c in choice))
                if best is None or key<best[0]:best=(key,{'axis':a,'destinations':[anchor(c['body']) for c in choice],'minimum_translation_cost':cost,'coverage_counts':[len(c['covered']) for c in choice]})
        if best is None:raise ValueError('No complete finite reflection cover')
        return best[1]

    def summary(self):
        w=self.world
        return {'pitch':w['pitch'],'axis_dimension':w['dimension'],'axis':w['axis'],'selected':self.selected,'body_sizes':[len(b) for b in w['bodies']],'target_cells':len(w['targets']),'plan':self.plan}

    def portfolio(self,revision,level):
        w=self.world;plan=self.plan;owner=self.selected
        if w['axis']!=plan['axis']:
            desired='axis';delta=(plan['axis']-w['axis'],0) if w['dimension']==0 else (0,plan['axis']-w['axis'])
        else:
            unfinished=[i for i,b in enumerate(w['bodies']) if anchor(b)!=tuple(plan['destinations'][i])]
            if not unfinished:raise ValueError('Complete predicted cover without official completion')
            desired=owner if owner in unfinished else unfinished[0];actual=anchor(w['bodies'][desired]);dest=plan['destinations'][desired];delta=(dest[0]-actual[0],dest[1]-actual[1])
        if owner!=desired:
            if self.switches>len(w['bodies'])+2:raise ValueError('Selection cycle did not expose requested owner')
            actions=[{'action_ref':'ACTION5'}];recipe='transfer_control';probe=True
        else:
            dimension=0 if delta[0] else 1;amount=delta[dimension];ref=('ACTION4' if amount>0 else 'ACTION3') if dimension==0 else ('ACTION2' if amount>0 else 'ACTION1')
            probe=(str(owner=='axis'),ref) not in self.known
            count=1 if probe else min(abs(amount),self.policy['execution']['max_bundle_actions'])
            actions=[{'action_ref':ref} for _ in range(count)];recipe='confirm_control' if probe else 'close_reflection_residual'
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'things':['direct_bodies','reflected_images','axis','fixed_target_cells'],'relations':['G_terminal'],'role':'objective'} for g in self.policy['goals']]
        comps.append({'id':'C_reflection','properties':{'owner':owner,'desired_owner':desired,'residual':delta,'complete_cover_plan':plan},'things':['current_selection'],'relations':['contributes_to:G_terminal'],'role':'intermediate'})
        bundle={'id':'B0','operation_key':'OP18' if probe else 'OP28','composition_ref':'C_reflection','objective_ref':'G_information' if probe else 'G_terminal','preserve_refs':['G_preserve'],'observation_revision':revision,'level_epoch':level,'kind':'probe' if probe else 'realize','actions':actions,'purpose':'Establish the collective reflection, then close the retained body destination while preserving completed cover contributions.','preconditions':{'source_rule_applicable':True},'preservation_evidence':{'G_preserve':'fixed initial target masks and retained axis/body destinations; every step reconciled'},'evidence':['measured reflection-related masks','observed selection marks','complete finite target-cover witness'],'recipe':recipe,'owner':owner,'desired_owner':desired,'residual':delta}
        # Bind the exact JSON representation transported by SRC, not Python tuples.
        return json.loads(json.dumps([comps,{'B0':bundle}]))

    def predict(self,command):
        w=self.world;ref=command['action_ref'];a=w['axis'];bodies=list(w['bodies'])
        if ref in DIRS:
            dx,dy=DIRS[ref]
            if self.selected=='axis':a+=(dx,dy)[w['dimension']]
            else:bodies[self.selected]=shift(bodies[self.selected],(dx,dy))
        return {**w,'axis':a,'bodies':bodies}

    def reconcile(self,rows,predicted,command,before_hash,after_hash,completed=False):
        old=self.world;ref=command['action_ref'];self.world=predicted
        if completed:
            cover=set().union(*(b|reflect(b,predicted['axis'],predicted['dimension']) for b in predicted['bodies']))
            if not predicted['targets']<=cover:raise ValueError('Official completion outside predicted complete cover')
        else:
            obs=self.lattice(rows,predicted['pitch']);cells=obs['cells'];direct=set().union(*predicted['bodies']);images=reflect(direct,predicted['axis'],predicted['dimension'])
            expected={p:predicted['image_color'] for p in images};expected.update({p:predicted['direct_color'] for p in direct})
            # Axis overlays can mask exact body pixels; all remaining predicted cells must retain a family color.
            bad=[p for p in expected if 0<=p[0]<predicted['n'] and 0<=p[1]<predicted['n'] and p[predicted['dimension']]!=predicted['axis'] and cells.get(p) not in {predicted['direct_color'],predicted['image_color']}]
            if bad:raise ValueError('Predicted reflection mismatch at '+str(bad[:3]))
            observed_axis=[p for p,c in cells.items() if c==predicted['axis_color']]
            if observed_axis and any(p[predicted['dimension']]!=predicted['axis'] for p in observed_axis):raise ValueError('Axis position mismatch')
            new_owner=self.selection(obs,retain_under_coverage=ref in DIRS)
            if ref=='ACTION5':
                if new_owner==self.selected:raise ValueError('Selection transfer had no effect')
                self.switches+=1
            elif new_owner!=self.selected:raise ValueError('Unexpected selection change')
            self.selected=new_owner
        if ref in DIRS:
            if before_hash==after_hash:raise ValueError('Declared translation had no visible effect')
            self.known.add((str(self.selected=='axis'),ref));self.switches=0
        effect={'action':ref,'owner':self.selected,'prediction_matches':True,'before':before_hash,'after':after_hash,'level_complete':completed}
        self.effects.append(effect);return effect
