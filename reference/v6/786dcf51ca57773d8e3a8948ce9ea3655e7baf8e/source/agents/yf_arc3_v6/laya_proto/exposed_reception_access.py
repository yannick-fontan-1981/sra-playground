"""Conditional reception, current orientation edits and observed contact effects.

All poses, palettes and controls are measured. Optical laws remain unfilled.
The V5 seeded-chain calculator is reused for nominal geometric push witnesses,
not as an assertion that the game's complete transaction has been acquired.
"""
import copy,math,heapq,itertools
from collections import Counter
from types import SimpleNamespace as NS
from auxiliary_support_access import AuxiliarySupportAccess as EphemeralMapAccess,input_candidates as inherited_inputs
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.seeded_partial_push_d import _expand_push_chain
from reception_lattice_projection import small_scene

def center(b):return [(b[0]+b[2])/2,(b[1]+b[3])/2]
def man(a,b):return sum(abs(x-y)for x,y in zip(a,b))
def scene(rows):return large_scene(rows)or small_scene(rows)

def large_scene(rows):
    cs=components(rows);bars=[c for c in cs if c['bbox'][1]>4 and c['bbox'][3]<45 and c['bbox'][3]==c['bbox'][1]and c['bbox'][2]-c['bbox'][0]>24 and c['area']==c['bbox'][2]-c['bbox'][0]+1]
    pairs=[(a,b)for a in bars for b in bars if a['color']==b['color']and a['bbox'][0]==b['bbox'][0]and a['bbox'][2]==b['bbox'][2]and b['bbox'][1]-a['bbox'][1]>=15]
    if not pairs:return None
    top,bottom=max(pairs,key=lambda q:(q[0]['bbox'][2]-q[0]['bbox'][0],q[1]['bbox'][1]-q[0]['bbox'][1]));left,yt,right,_=top['bbox'];yb=bottom['bbox'][1]
    boxes=[c for c in cs if left<c['bbox'][0]and c['bbox'][2]<right and yt<c['bbox'][1]and c['bbox'][3]<yb and c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and 2<=c['bbox'][2]-c['bbox'][0]+1<=3 and c['area']==(c['bbox'][2]-c['bbox'][0]+1)**2-1]
    actor_shapes=[c for c in cs if left<c['bbox'][0]and c['bbox'][2]<right and yt<c['bbox'][1]and c['bbox'][3]<yb and c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and 2<=c['bbox'][2]-c['bbox'][0]+1<=3 and c['area']==(c['bbox'][2]-c['bbox'][0]+1)**2-2]
    if not boxes and not actor_shapes:return None
    sizes=Counter(c['bbox'][2]-c['bbox'][0]+1 for c in boxes+actor_shapes);side=sizes.most_common(1)[0][0];pitch=side+2
    if (right-left+1)%pitch or (yb-yt)%pitch:return None
    w=(right-left+1)//pitch;h=(yb-yt)//pitch+1
    def cell(c):p=center(c['bbox']);return [int((p[0]-left)//pitch),int((p[1]-yt)//pitch)]
    boxes=[c for c in boxes if c['bbox'][2]-c['bbox'][0]+1==side]
    actors=[c for c in cs if left<c['bbox'][0]and c['bbox'][2]<right and yt<c['bbox'][1]and c['bbox'][3]<yb and c['bbox'][2]-c['bbox'][0]+1==side and c['bbox'][3]-c['bbox'][1]+1==side and c['area']==side*side-2]
    if len(actors)!=1:return None
    background=Counter(v for row in rows[yt:yb+pitch]for v in row[left:right+1]).most_common(1)[0][0];slots=[];patterns={};wall_patterns=set();local_bodies=[]
    for y in range(h):
        for x in range(w):
            px,py=left+x*pitch,yt+y*pitch;patch=[list(row[px:px+pitch])for row in rows[py:py+pitch]]
            if len(patch)!=pitch:return None
            pat=identity(patch);patterns[(x,y)]=pat
            if y in(0,h-1):wall_patterns.add(pat)
            col=patch[0][0]
            if col!=background and patch[0][-1]==patch[-1][0]==patch[-1][-1]==col and patch[0][1]!=col and patch[-1][1]!=col:slots.append({'pos':[x,y],'color':col})
            core=[v for row in patch[1:-1]for v in row[1:-1]];counts=Counter(core)
            if len(counts)==2:
                body_color,n=counts.most_common(1)[0]
                if n==side*side-1 and body_color!=background and core[(side//2)*side+side//2]!=body_color:local_bodies.append({'pos':[x,y],'color':body_color})
    walls=[list(p)for p,v in patterns.items()if v in wall_patterns]
    if not slots or len(slots)!=len(local_bodies):return None
    dial=[c for c in cs if c['bbox'][1]>=47 and c['bbox'][0]>=45 and c['bbox'][2]-c['bbox'][0]==2 and c['bbox'][3]-c['bbox'][1]==2 and c['area']==8]
    if len(dial)!=8:return None
    mid=[sum(center(c['bbox'])[i]for c in dial)/8 for i in(0,1)];pal=Counter(c['color']for c in dial);dominant=pal.most_common(1)[0][0];active=[c for c in dial if c['color']!=dominant]
    if len(active)!=1:return None
    controls=[{'point':[int(z)for z in center(c['bbox'])],'vector':[center(c['bbox'])[i]-mid[i]for i in(0,1)],'active':c is active[0]}for c in dial]
    s={'origin':[left,yt],'pitch':pitch,'size':[w,h],'actor':cell(actors[0]),'actor_color':actors[0]['color'],'bodies':sorted(local_bodies,key=lambda q:q['pos']),'slots':sorted(slots,key=lambda q:q['pos']),'walls':walls,'dial':controls,'orientation':next(c['vector']for c in controls if c['active'])}
    s['layout']=identity([s['origin'],pitch,s['size'],walls,s['slots']]);return plain(s)

def input_candidates(rows,available):
    values=list(inherited_inputs(rows,available));s=scene(rows)
    if s and 'ACTION6'in available:values +=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),c['point']))}for c in s['dial']]
    found={}
    for a in values:found[identity(a)]=a
    return list(found.values())

class Visits:
    def __init__(self):self.n=0
    def visit(self,e):self.n+=1

def nominal_step(s,actor,poses,d,models,visits):
    colors=[b['color']for b in s['bodies']];attached=set();pending=[tuple(actor)]
    while pending:
        p=pending.pop()
        for i,q in enumerate(poses):
            if i not in attached and str(colors[i])in models['attached']and man(p,q)==1:attached.add(i);pending.append(q)
    admitted=tuple((x,y)for y in range(s['size'][1])for x in range(s['size'][0])if [x,y]not in s['walls']);refs={str(i):i for i in range(len(poses))if i not in attached}
    bodies=[NS(body_ref='actor',offsets=((0,0),)+tuple((poses[i][0]-actor[0],poses[i][1]-actor[1])for i in sorted(attached)),admitted_cells=admitted,pushable=True)]
    bodies +=[NS(body_ref=str(i),offsets=((0,0),),admitted_cells=admitted,pushable=True)for i in range(len(poses))if i not in attached]
    positions={'actor':tuple(actor),**{str(i):tuple(p)for i,p in enumerate(poses)if i not in attached}}
    req=NS(bodies=bodies,depth_bound=len(bodies),fixed_blocking_cells=tuple(map(tuple,s['walls'])),displacement=d)
    local,refused=_expand_push_chain(req,'actor',positions,set(),visits)
    if refused:return None
    moved={refs[x]for x in local if x!='actor'}|attached;out=list(poses)
    broadcast={colors[i]for i in moved if str(colors[i])in models['coupled']}
    for i,c in enumerate(colors):
        if i in moved or c not in broadcast or i in attached:continue
        chain,bad=_expand_push_chain(req,str(i),positions,set(),visits)
        if not bad and 'actor'not in chain:moved.update(refs[x]for x in chain)
    for i in moved:out[i]=(poses[i][0]+d[0],poses[i][1]+d[1])
    if len(set(out))!=len(out):return None
    return (actor[0]+d[0],actor[1]+d[1]),tuple(out)

def path_to_receptions(s,models,max_nodes=8000):
    colors=[b['color']for b in s['bodies']];pairs=[set([c])for c in colors]
    for allowed,c in zip(pairs,colors):
        change=True
        while change:
            old=len(allowed)
            for a,b in models['color_edges']:
                if a in allowed:allowed.add(b)
            change=len(allowed)!=old
    targets=[tuple(t['pos'])for t in s['slots']];domains=[[j for j,t in enumerate(s['slots'])if t['color']in p]for p in pairs]
    if any(not d for d in domains):return [],0,0
    def goal(poses):return len(set(poses))==len(poses)and all(any(p==targets[j]for j in dom)for p,dom in zip(poses,domains))
    assignments=[p for p in itertools.permutations(range(len(targets)))if all(j in dom for j,dom in zip(p,domains))]
    if not assignments:return [],0,0
    def lower(poses):return min(sum(man(p,targets[j])for p,j in zip(poses,a))for a in assignments)
    def rank(poses):return (sum(not any(p==targets[j]for j in dom)for p,dom in zip(poses,domains)),lower(poses))
    start=(tuple(s['actor']),tuple(tuple(b['pos'])for b in s['bodies']));queue=[(lower(start[1]),0,start)];cost={start:0};came={};visits=Visits();nodes=0
    best=start;best_rank=rank(start[1])
    while queue and nodes<max_nodes:
        _,n,state=heapq.heappop(queue)
        if cost[state]!=n:continue
        nodes+=1
        if rank(state[1])<best_rank:best=state;best_rank=rank(state[1])
        if goal(state[1]):
            result=[]
            while state!=start:prev,d=came[state];result.append((d,state));state=prev
            return list(reversed(result)),nodes,visits.n
        for d in((1,0),(0,-1),(0,1),(-1,0)):
            nxt=nominal_step(s,state[0],state[1],d,models,visits)
            if nxt is None or n+1>=cost.get(nxt,10**9):continue
            cost[nxt]=n+1;came[nxt]=(state,d);heapq.heappush(queue,(n+1+lower(nxt[1]),n+1,nxt))
    result=[];state=best
    while state!=start:prev,d=came[state];result.append((d,state));state=prev
    return list(reversed(result)),nodes,visits.n

class ExposedReceptionAccess(EphemeralMapAccess):
    def __init__(self):super().__init__();self.reception_state=None;self.reception_controls={};self.reception_models={'coupled':{},'attached':{},'color_edges':[],'repulsion':{}};self.reception_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.reception_state,self.reception_controls,self.reception_models,self.reception_events])
    def apply_event(self,e):
        if e.get('kind')=='observed_exposed_reception':self.reception_state=copy.deepcopy(e['state']);self.reception_controls=copy.deepcopy(e['controls']);self.reception_models=copy.deepcopy(e['models']);self.reception_events.append(e);return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('exposed_reception_question');s=scene(rows)
        if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
        m=copy.deepcopy(self.reception_state)if self.reception_state and self.reception_state['epoch']==o['level_epoch']and self.reception_state['layout']==s['layout']else{'epoch':o['level_epoch'],'layout':s['layout'],'evidence':[o['observation_ref']],'probed':[],'dial_tried':[]}
        controls=copy.deepcopy(self.reception_controls);models=copy.deepcopy(self.reception_models);actions=[];predicted=[];kind='access';why=cfg['access'];nodes=visits=0;available=o['available_action_refs']
        mismatched=[b for b in s['bodies']if any(t['pos']==b['pos']and t['color']!=b['color']for t in s['slots'])]
        if mismatched and 'ACTION6'in available:
            body=mismatched[0];delta=[body['pos'][i]-s['actor'][i]for i in(0,1)];choices=sorted(s['dial'],key=lambda c:-(sum(a*b for a,b in zip(c['vector'],delta))/max(.1,math.hypot(*c['vector']))))
            chosen=next((c for c in choices if not c['active']and [s['actor'],body['pos'],c['point']]not in m['dial_tried']),None)
            if chosen:actions=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),chosen['point']))}];kind='exposure_question';why=cfg['expose']
        if not actions:
            moving=[b for b in s['bodies']if str(b['color'])in models['repulsion']and any(t['color']==b['color']and t['pos']!=b['pos']for t in s['slots'])]
            if moving and 'ACTION5'in available:actions=[{'action_ref':'ACTION5'}];kind='maintain_field';why=cfg['maintain']
        if not actions:
            adjacent=[b for b in s['bodies']if man(b['pos'],s['actor'])==1 and str(b['color'])not in models['attached']]
            for b in adjacent:
                ts=[t for t in s['slots']if t['color']==b['color']and t['pos']!=b['pos']]
                if not ts:continue
                t=min(ts,key=lambda t:man(t['pos'],b['pos']));d=[(1 if t['pos'][i]>b['pos'][i]else-1 if t['pos'][i]<b['pos'][i]else 0)for i in(0,1)]
                a=next((a for a,x in controls.items()if x['delta']==d and a in available),None)
                if a and sum(abs(x)for x in d)==1 and [s['actor'][0]+d[0],s['actor'][1]+d[1]]!=b['pos']and [s['actor'],a]not in m['probed']:
                    actions=[{'action_ref':a}];kind='contact_transport_question';why=cfg['contact'];break
        if not actions:
            path,nodes,visits=path_to_receptions(s,models,cfg['max_search_nodes'])
            if nodes>=cfg['max_search_nodes']and path:why=cfg['partial']
            for d,state in path[:min(16,limit)]:
                a=next((a for a,x in controls.items()if x['delta']==list(d)and a in available),None)
                if a is None:break
                actions.append({'action_ref':a});predicted.append({'actor':list(state[0]),'bodies':sorted([[list(pos),b['color']]for pos,b in zip(state[1],s['bodies'])])})
            if not actions:
                untried=[a for a in cfg['probe_order']if a in available and a not in controls and [s['actor'],a]not in m['probed']]
                if untried:actions=[{'action_ref':untried[0]}];kind='control_question';why=cfg['control']
                elif 'ACTION6'in available:
                    # An unmatched state can require a field change before access.
                    targets=[b for b in s['bodies']if any(t['color']!=b['color']for t in s['slots'])]
                    if targets:
                        body=targets[0];delta=[body['pos'][i]-s['actor'][i]for i in(0,1)];choices=sorted(s['dial'],key=lambda c:-sum(a*b for a,b in zip(c['vector'],delta))/max(.1,math.hypot(*c['vector'])));chosen=next((c for c in choices if not c['active']and [s['actor'],body['pos'],c['point']]not in m['dial_tried']),None)
                        if chosen:actions=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),chosen['point']))}];kind='exposure_question';why=cfg['expose']
            if not actions:return {'status':'unknown','block_unrelated_probe':True,'reason':'reception_access_or_state_model_unresolved'}
        v=plain({'scene':s,'state':m,'commands':actions,'predicted':predicted,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'kind':kind,'why':why,'controls':controls,'models':models,'search_nodes':nodes,'v5_chain_visits':visits})
        ref='exposed-reception:'+identity(v);evidence=m['evidence'][-16:]
        return {'status':'proposed','kind':'exposed_reception','proposal_id':ref,'exposed_reception_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':{'current_reception_geometry':True,'optical_law_unknown':True,'v5_nominal_chain_only':True,'conditional_contact_model':True},'compositions':[{'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','purpose':why,'evidence':evidence,'preconditions':{},'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if 'exposed_reception_plan'not in p:return super().before(p,index,rows,**meta)
        v=p['exposed_reception_plan'];s=scene(rows);ok=p['proposal_id']=='exposed-reception:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions'][index]['action_ref']in meta['available']and s is not None and s['layout']==v['scene']['layout']
        if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
        else:ok=ok and {'actor':s['actor'],'bodies':sorted([[b['pos'],b['color']]for b in s['bodies']])}==v['predicted'][index-1]and s['orientation']==v['scene']['orientation']
        return {'admitted':bool(ok),'reason':'current_reception_bound'if ok else'reception_binding_changed'}
    def after(self,p,index,rows,later,**meta):
        if 'exposed_reception_plan'not in p:return super().after(p,index,rows,later,**meta)
        v=p['exposed_reception_plan'];s=scene(later);boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);matched=None
        if s and not boundary and index<len(v['predicted']):matched=s['layout']==v['scene']['layout']and {'actor':s['actor'],'bodies':sorted([[b['pos'],b['color']]for b in s['bodies']])}==v['predicted'][index]
        return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'expected_conditional_reception_step'if matched else'changed_layout_or_unknown_effect'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);v=proposal.get('exposed_reception_plan')
        if not v:return events
        a=scene(rows);b=scene(later);controls=copy.deepcopy(self.reception_controls);models=copy.deepcopy(self.reception_models);m=copy.deepcopy(self.reception_state)if self.reception_state and self.reception_state['layout']==v['state']['layout']else copy.deepcopy(v['state']);detail={'command':cmd,'before':before['observation_ref'],'after':after['observation_ref']}
        if not a or not b:return events
        if before['level_epoch']!=after['level_epoch']or a['layout']!=b['layout']:
            detail['layout_transition_unknown']=True
        else:
            delta=[b['actor'][i]-a['actor'][i]for i in(0,1)];m['probed'].append([a['actor'],cmd['action_ref']]);detail['actor_delta']=delta
            if not cmd.get('data')and sum(abs(x)for x in delta)==1:
                old=controls.get(cmd['action_ref'])
                if old and old['delta']!=delta:detail['control_conflict']={'old':old['delta'],'new':delta}
                else:controls[cmd['action_ref']]={'delta':delta,'evidence':[before['observation_ref'],after['observation_ref']]}
            if len(a['bodies'])==len(b['bodies'])and len(a['bodies'])<=7:
                permutations=list(itertools.permutations(range(len(b['bodies']))));scores=[sum(man(x['pos'],b['bodies'][j]['pos'])for x,j in zip(a['bodies'],p))for p in permutations];best=min(scores);matches=[p for p,z in zip(permutations,scores)if z==best]
                if len(matches)==1:
                    pairs=list(zip(a['bodies'],[b['bodies'][j]for j in matches[0]]));changes=[]
                    for old,new in pairs:
                        d=[new['pos'][i]-old['pos'][i]for i in(0,1)]
                        if old['color']!=new['color']:
                            edge=[old['color'],new['color']]
                            if edge not in models['color_edges']:models['color_edges'].append(edge)
                        if d!=[0,0]:changes.append({'before':old,'after':new,'delta':d})
                        if d==delta and d!=[0,0]and man(old['pos'],a['actor'])==1 and [a['actor'][i]+delta[i]for i in(0,1)]!=old['pos']:models['attached'][str(old['color'])]={'evidence':[before['observation_ref'],after['observation_ref']],'status':'side_contact_co_motion_candidate'}
                        if cmd.get('data')and d!=[0,0]and delta==[0,0]:models['repulsion'][str(new['color'])]={'evidence':[before['observation_ref'],after['observation_ref']],'delta':d,'status':'orientation_associated_motion_candidate'}
                    for color in {x['color']for x in a['bodies']}:
                        group=[x for x in changes if x['before']['color']==color]
                        if len(group)>=2 and all(x['delta']==delta for x in group)and delta!=[0,0]:models['coupled'][str(color)]={'evidence':[before['observation_ref'],after['observation_ref']],'status':'observed_same_mode_co_motion_candidate'}
                    detail['body_changes']=changes
                else:detail['body_correspondence_ambiguous']=True
            if cmd.get('data'):
                point=[cmd['data']['x'],cmd['data']['y']]
                for body in a['bodies']:m['dial_tried'].append([a['actor'],body['pos'],point])
        m['evidence'] +=[before['observation_ref'],after['observation_ref']];e=plain({'kind':'observed_exposed_reception','state':m,'controls':controls,'models':models,'detail':detail});self.apply_event(e);events.append(e);return events
