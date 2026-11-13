"""Pixel measurements and finite graph evaluation of declared ordered-stack rules."""
import json
from collections import Counter,deque
from pathlib import Path
from geometric_observer import components

POLICY_PATH=Path(__file__).with_name('hano_compositions.drm.json')

class HanoPlanner:
    def __init__(self):
        self.policy=json.loads(POLICY_PATH.read_text());self.effects=[]
        assert self.policy['transitions']['take']=='smallest_width_member_on_source_only'
        assert self.policy['transitions']['put']=='empty_destination_or_smaller_than_destination_top'
        assert self.policy['planning']['algorithm']=='breadth_first_finite_graph'

    def state(self,rows):
        cs=components(rows);m=self.policy['measurements'];sw=m['stem_width']
        stems=[c for c in cs if c['bbox'][2]-c['bbox'][0]+1==sw and c['bbox'][3]-c['bbox'][1]+1>=m['minimum_stem_height'] and c['area']==c['bbox'][3]-c['bbox'][1]+sw]
        stems.sort(key=lambda c:c['bbox'][0])
        if len(stems)<3:raise ValueError('No homologous stem family')
        axes=[(c['bbox'][0]+c['bbox'][2])//2 for c in stems];bottom=stems[0]['bbox'][3];top=stems[0]['bbox'][1]
        if len({(c['bbox'][1],c['bbox'][3]) for c in stems})!=1:raise ValueError('Stem geometry mismatch')
        colors=Counter(c['color'] for c in stems);targets=[i for i,c in enumerate(stems) if colors[c['color']]==1]
        if len(targets)!=1:raise ValueError('Ambiguous reference support')
        target=targets[0];cx=axes[target]
        hollow=[c for c in cs if not c['rectangular'] and c['bbox'][1]>=top and c['bbox'][3]<=bottom and c['bbox'][2]-c['bbox'][0]+1>sw and c['area']<(c['bbox'][2]-c['bbox'][0]+1)*(c['bbox'][3]-c['bbox'][1]+1)]
        if not any(a['color']==b['color'] and a['bbox'][0]+b['bbox'][2]==2*cx and a['bbox'][2]+b['bbox'][0]==2*cx and a['bbox'][1:4:2]==b['bbox'][1:4:2] for a in hollow for b in hollow if a is not b):raise ValueError('No hollow reference evidence')
        assert self.policy['roles']['background']=='largest_connected_component_color_excluded_from_members'
        background=max(cs,key=lambda c:c['area'])['color']
        wings=[c for c in cs if c['color']!=background and c['rectangular'] and c['bbox'][3]-c['bbox'][1]+1==m['wing_height'] and top<=c['bbox'][1]<=bottom-m['wing_height']]
        members=[]
        for i,x in enumerate(axes):
            for a in wings:
                if a['bbox'][2]!=x-m['center_occlusion_half_width']-1:continue
                for b in wings:
                    if b['color']==a['color'] and a['bbox'][1:4:2]==b['bbox'][1:4:2] and b['bbox'][0]==x+m['center_occlusion_half_width']+1 and a['bbox'][0]+b['bbox'][2]==2*x:
                        members.append({'width':b['bbox'][2]-a['bbox'][0]+1,'support':i,'color':a['color'],'y':a['bbox'][1]})
        members.sort(key=lambda d:d['width'])
        if not members or len({d['width'] for d in members})!=len(members):raise ValueError('Ambiguous ordered member family')
        for i in range(len(axes)):
            group=[d for d in members if d['support']==i]
            if [d['y'] for d in group]!=sorted(d['y'] for d in group):raise ValueError('Observed width ordering violated')
        return {'axes':axes,'top':top,'bottom':bottom,'target':target,'members':members,'arrangement':tuple(d['support'] for d in members),'constraints':[d['width'] for d in members],'mismatches':[d['width'] for d in members if d['support']!=target]}

    def route(self,state):
        start=state['arrangement'];goal=(state['target'],)*len(start);n=len(state['axes'])
        q=deque([start]);prev={start:None};edge={}
        while q:
            s=q.popleft()
            if s==goal:break
            tops={p:next((d for d,v in enumerate(s) if v==p),None) for p in range(n)}
            for src,d in tops.items():
                if d is None:continue
                for dst,t in tops.items():
                    if dst==src or (t is not None and d>=t):continue
                    nxt=list(s);nxt[d]=dst;nxt=tuple(nxt)
                    if nxt not in prev:prev[nxt]=s;edge[nxt]={'member':d,'source':src,'destination':dst};q.append(nxt)
                    if len(prev)>self.policy['measurements']['maximum_graph_states']:raise ValueError('Graph domain exceeded')
        if goal not in prev:raise ValueError('No complete continuation')
        path=[];s=goal
        while prev[s] is not None:path.append(edge[s]);s=prev[s]
        return list(reversed(path)),len(prev)

    def portfolio(self,state,revision,level):
        route,visited=self.route(state)
        if not route:raise ValueError('Visual goal without official completion')
        move=route[0];d=state['members'][move['member']]
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'things':['width_ordered_members','observed_supports'],'relations':['G_terminal'],'role':'objective'} for g in self.policy['goals']]
        comps.append({'id':'C_transfer','properties':{'member_width':d['width'],'source':move['source'],'destination':move['destination'],'complete_continuation':route,'graph_states':visited},'things':[d],'relations':['contributes_to:G_terminal'],'role':'intermediate'})
        purpose='Expose or place the accessible member while retaining a complete continuation to the observed reference; support roles remain temporary.'
        bundle={'id':'B0','operation_key':'OP28','composition_ref':'C_transfer','objective_ref':'G_terminal','preserve_refs':['G_preserve'],'observation_revision':revision,'level_epoch':level,'kind':'realize','actions':[{'action_ref':'ACTION6','data':{'x':state['axes'][move[k]],'y':state['bottom']-2}} for k in ('source','destination')],'purpose':purpose,'preconditions':{'source_rule_applicable':True},'evidence':['observed symmetric member wings','observed hollow reference','complete finite-graph continuation'],'preservation_evidence':{'G_preserve':'top-only transfer onto empty or larger; selection and exact deposit checked'},'recipe':'select_then_deposit','move':move,'route':route,'graph_states':visited}
        return comps,{'B0':bundle}

def compact(s):
    return {k:s[k] for k in ('axes','target','arrangement','constraints','mismatches')}
