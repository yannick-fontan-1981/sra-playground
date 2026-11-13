"""Measured selected bodies, conditional full-mask rearrangement and receptacle prior.

No game key, palette role, private capacity or authored route. Cardinal inputs
begin as competing permutations; only public responses eliminate hypotheses.
"""
import copy,itertools,heapq,time
from collections import Counter
from .base import NeutralAccess as ConstructionPreviewAccess,input_candidates as inherited_inputs
from geometric_observer import components
from src_bridge import plain
from terminal_composition import identity
from agents.yf_arc3_v5.capabilities.identity_scoped_support_d import _rotated

DIRS=((0,-1),(0,1),(-1,0),(1,0))
def scene(rows,old=None):
    parts=components(rows);bg=Counter(v for row in rows for v in row).most_common(1)[0][0]
    if old:g=old['geometry']
    else:
        rects=[c for c in parts if c['rectangular'] and c['color']!=bg and 4<=min(c['bbox'][2]-c['bbox'][0]+1,c['bbox'][3]-c['bbox'][1]+1)<=12]
        pitches=Counter(min(c['bbox'][2]-c['bbox'][0]+1,c['bbox'][3]-c['bbox'][1]+1)+2 for c in rects)
        candidates=[]
        for q,n in pitches.items():
            if n<4:continue
            for c in parts:
                l,t,r,b=c['bbox'];w=r-l-3;h=b-t-3
                if c['color']==bg or w<q*3 or h<q*3 or w%q or h%q or c['area']>2*(w+h):continue
                if not all(rows[t][x]==c['color'] for x in range(l,r+1)):continue
                candidates.append({'q':q,'origin':[l+2,t+2],'size':[w//q,h//q],'frame_color':c['color']})
        if len(candidates)!=1:return None
        g=candidates[0]
    q=g['q'];ox,oy=g['origin'];w,h=g['size'];cells={}
    fill_colors=set()
    for c in parts:
        l,t,r,b=c['bbox']
        if ox<l<=r<ox+w*q and oy<t<=b<oy+h*q and (l-ox-1)%q==0 and (t-oy-1)%q==0 and (r-l+3)%q==0 and (b-t+3)%q==0:fill_colors.add(c['color'])
    # A filled inset is distinct from its perimeter; the perimeter is measured,
    # not assigned a palette meaning. Decorations may cover a minority of fill.
    for y in range(h):
        for x in range(w):
            l,t=ox+x*q,oy+y*q
            inside=Counter(rows[yy][xx] for yy in range(t+1,t+q-1) for xx in range(l+1,l+q-1));col,n=inside.most_common(1)[0]
            edge=[rows[t][l],rows[t][l+q-1],rows[t+q-1][l],rows[t+q-1][l+q-1]]
            if col in fill_colors and n>=(q-2)**2*.55:cells.setdefault(col,[]).append([x,y])
    if len(cells)<3:return None
    bodies=[]
    for col,cc in sorted(cells.items()):
        x=min(c[0]for c in cc);y=min(c[1]for c in cc);mask=sorted([a-x,b-y]for a,b in cc)
        # Retain the complete occupied mask, including absent concave corners.
        bodies.append({'key':str(col),'color':col,'position':[x,y],'mask':mask})
    receptacles=[]
    for c in parts:
        l,t,r,b=c['bbox'];col=c['color']
        if t<oy+h*q or col not in cells or (l-ox)%q or (t-oy)%q:continue
        if (r-l+1)%q or (b-t+1)%q:continue
        border={(x,y)for y in range(t,b+1)for x in range(l,r+1)if x in(l,r)or y in(t,b)}
        if not all(rows[y][x]==col for x,y in border):continue
        body=next(z for z in bodies if z['color']==col);mw=max(a for a,b in body['mask'])+1;mh=max(b for a,b in body['mask'])+1
        if (r-l+1,b-t+1)==(mw*q,mh*q):receptacles.append({'key':body['key'],'position':[(l-ox)//q,(t-oy)//q],'mask':body['mask']})
    if len(receptacles)!=1:return None
    return {'geometry':g,'bodies':bodies,'receptacle':receptacles[0]}

def point(s,i):
    b=s['bodies'][i];dx,dy=b['mask'][0];x,y=b['position'];q=s['geometry']['q'];ox,oy=s['geometry']['origin'];return {'x':ox+(x+dx)*q+q//2,'y':oy+(y+dy)*q+q//2}
def input_candidates(rows,available):
    out=inherited_inputs(rows,available);s=scene(rows)
    if s and 'ACTION6'in available:out +=[{'action_ref':'ACTION6','data':point(s,i)}for i in range(len(s['bodies']))]
    return out
def poses(s):return tuple(tuple(b['position'])for b in s['bodies'])
def moved(s,ps,i,d):
    w,h=s['geometry']['size'];target=s['receptacle'];body=s['bodies'][i];x,y=ps[i];at=(x+d[0],y+d[1]);mask=[_rotated(tuple(m),0)for m in body['mask']]
    cells={(at[0]+a,at[1]+b)for a,b in mask};occupied={(p[0]+a,p[1]+b)for j,p in enumerate(ps)if j!=i for a,b in s['bodies'][j]['mask']}
    extra={(target['position'][0]+a,target['position'][1]+b)for a,b in target['mask']}if body['key']==target['key']else set()
    if cells&occupied or any(not(0<=a<w and 0<=b<h)and(a,b)not in extra for a,b in cells):return ps
    result=list(ps);result[i]=at;return tuple(result)
def route(s,active,deadline):
    start=poses(s);ti=next(i for i,b in enumerate(s['bodies'])if b['key']==s['receptacle']['key']);goal=tuple(s['receptacle']['position']);queue=[];serial=itertools.count();best={(start,active):0};parent={}
    def heuristic(ps):return abs(ps[ti][0]-goal[0])+abs(ps[ti][1]-goal[1])
    heapq.heappush(queue,(heuristic(start),0,next(serial),start,active));nodes=0
    while queue and nodes<150000 and time.perf_counter()<deadline:
        _,cost,_,ps,sel=heapq.heappop(queue)
        if best.get((ps,sel))!=cost:continue
        nodes+=1
        if ps[ti]==goal:
            key=(ps,sel);path=[]
            while key in parent:prev,step=parent[key];path.append(step);key=prev
            return list(reversed(path)),nodes
        for i in range(len(ps)):
            for d in DIRS:
                nxt=moved(s,ps,i,d)
                if nxt==ps:continue
                nc=cost+1+(sel!=i);key=(nxt,i)
                if nc>=best.get(key,10**9):continue
                best[key]=nc;parent[key]=((ps,sel),(i,d,nxt));heapq.heappush(queue,(nc+heuristic(nxt),nc,next(serial),nxt,i))
    return None,nodes

class SelectedRigidAccess(ConstructionPreviewAccess):
    def __init__(self):super().__init__();self.rigid_state=None;self.rigid_models=None;self.rigid_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.rigid_state,self.rigid_models,self.rigid_events])
    def apply_event(self,e):
        if e.get('kind')=='observed_selected_rigid':self.rigid_state=copy.deepcopy(e['state']);self.rigid_models=copy.deepcopy(e['models']);self.rigid_events.append(e);return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('selected_rigid_question');m=copy.deepcopy(self.rigid_state)if self.rigid_state and self.rigid_state['epoch']==o['level_epoch']else None;s=scene(rows,m['scene']if m else None)
        if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
        refs=sorted(a for a in o['available_action_refs']if a in ['ACTION1','ACTION2','ACTION3','ACTION4'])
        if len(refs)!=4:return {'status':'unknown','block_unrelated_probe':True,'reason':'rigid_direction_domain_incomplete'}
        models=copy.deepcopy(self.rigid_models)if self.rigid_models is not None else [dict(zip(refs,p))for p in itertools.permutations(DIRS)]
        if not models:return {'status':'unknown','block_unrelated_probe':True,'reason':'rigid_control_or_collision_model_refuted'}
        if m is None:m={'epoch':o['level_epoch'],'scene':s,'active':None,'evidence':[o['observation_ref']],'tried':[]}
        route_steps,nodes=route(s,m['active'],min(config['level_deadline'],time.perf_counter()+18))
        if route_steps is None:return {'status':'unknown','block_unrelated_probe':True,'reason':'rigid_conditional_configuration_search_incomplete'}
        if not route_steps:return {'status':'unknown','block_unrelated_probe':True,'reason':'rigid_receptacle_matched_terminal_unknown'}
        actions=[];expected=[];before_states=[];active=m['active'];ps=poses(s);mode='path';why=cfg['compose']
        for i,d,nxt in route_steps:
            if active!=i:
                if actions:break
                # Pointing has no inherited authority: current occupied support
                # is bound, and its causal receiver is checked on next response.
                temp=copy.deepcopy(s)
                for b,p in zip(temp['bodies'],ps):b['position']=list(p)
                actions.append({'action_ref':'ACTION6','data':point(temp,i)});before_states.append(ps);expected.append(ps);active=i;mode='select';break
            candidates=[a for a in refs if all(tuple(h[a])==d for h in models)]
            if candidates:
                actions.append({'action_ref':candidates[0]});before_states.append(ps);expected.append(nxt);ps=nxt
            else:
                # Select a discriminating input under current full-mask model.
                choices=[]
                for a in refs:
                    outcomes={moved(s,ps,i,tuple(h[a]))for h in models};key=[identity(ps),i,a]
                    if key not in m['tried']:choices.append((len(outcomes),len(outcomes-{ps}),a))
                if not choices:break
                a=max(choices)[2];actions.append({'action_ref':a});before_states.append(ps);expected.append(None);mode='probe';why=cfg['control'];break
            if len(actions)>=limit:break
        if not actions:return {'status':'unknown','block_unrelated_probe':True,'reason':'rigid_control_discrimination_exhausted'}
        v=plain({'scene':s,'state':m,'models':models,'commands':actions,'expected':expected,'before_states':before_states,'active':active,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'mode':mode,'why':why,'search_nodes':nodes})
        ref='selected-rigid:'+identity(v);evidence=m['evidence'][-16:];facts={'current_full_masks_measured':True,'receptacle_goal_is_library_prior':True,'collision_domain_is_provisional':True,'control_hypotheses_preserved':True}
        return {'status':'proposed','kind':'selected_rigid','proposal_id':ref,'selected_rigid_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if 'selected_rigid_plan'not in p:return super().before(p,index,rows,**meta)
        v=p['selected_rigid_plan'];s=scene(rows,v['scene']);ok=s is not None and p['proposal_id']=='selected-rigid:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions'][index]['action_ref']in meta['available']
        ok=ok and s['geometry']==v['scene']['geometry']and s['receptacle']==v['scene']['receptacle']and[(b['key'],b['mask'])for b in s['bodies']]==[(b['key'],b['mask'])for b in v['scene']['bodies']]and plain(poses(s))==v['before_states'][index]
        if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
        return {'admitted':bool(ok),'reason':'current_rigid_support_and_conditional_path'if ok else'rigid_binding_changed'}
    def after(self,p,index,rows,later,**meta):
        if 'selected_rigid_plan'not in p:return super().after(p,index,rows,later,**meta)
        v=p['selected_rigid_plan'];boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);s=scene(later,v['scene']);expected=v['expected'][index];matched=None if boundary or expected is None else bool(s and plain(poses(s))==expected)
        return {'matched':matched,'seal_prefix':boundary or matched is not True or v['mode']=='select','reason':'boundary'if boundary else'rigid_public_projection'if expected is not None else'unknown_control_response'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);v=proposal.get('selected_rigid_plan')
        if not v or before['level_epoch']!=after['level_epoch']:return events
        m=copy.deepcopy(self.rigid_state)if self.rigid_state and self.rigid_state['epoch']==before['level_epoch']else copy.deepcopy(v['state']);a=scene(rows,v['scene']);b=scene(later,v['scene']);models=copy.deepcopy(self.rigid_models)if self.rigid_models is not None else copy.deepcopy(v['models'])
        if not a or not b:return events
        detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':cmd,'prior_model_count':len(models),'role_status':'selected_receiver_hypothesis'}
        if cmd.get('data'):
            m['active']=v['active'];detail['selection_pixels_changed']=rows!=later
        elif m['active']is not None:
            i=m['active'];models=[h for h in models if plain(moved(a,poses(a),i,tuple(h[cmd['action_ref']])))==plain(poses(b))];m['tried'].append([identity(poses(a)),i,cmd['action_ref']]);detail['moved']=poses(a)!=poses(b);detail['role_status']='observed_exclusive_receiver'if detail['moved']else'blocked_or_unselected_remains_conditional'
        m['scene']=b;m['evidence'] +=[before['observation_ref'],after['observation_ref']];detail['compatible_model_count']=len(models)
        event=plain({'kind':'observed_selected_rigid','state':m,'models':models,'detail':detail});self.apply_event(event);events.append(event);return events
