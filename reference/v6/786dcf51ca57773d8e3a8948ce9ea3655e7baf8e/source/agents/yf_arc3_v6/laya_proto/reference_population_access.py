"""Measured reference occupancy -> injective contribution -> observed controls.

Color changes remain evidence, not a supplied neighborhood law. Existing V5
matching and selected-body physical step calculations are reused conditionally.
"""
import copy,itertools,math
from collections import Counter,deque
from types import SimpleNamespace
from reception_service_access import ReceptionServiceAccess,input_candidates as inherited_inputs
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.injective_matching import maximum_injective_matching
from agents.yf_arc3_v5.capabilities.neighborhood_pattern_construction import NeighborhoodOccurrence,NeighborhoodState,NeighborhoodInput,_physical
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def scene(rows,retained=None):
    if retained:
        q=retained['q'];size=q-1;oy,ox=retained['offset'];bodies=[]
        for y,x in retained['floor']:
            values=Counter(rows[oy+y*q+dy][ox+x*q+dx]for dy in range(size)for dx in range(size));color,count=values.most_common(1)[0]
            differences=[(dy,dx,rows[oy+y*q+dy][ox+x*q+dx])for dy in range(size)for dx in range(size)if rows[oy+y*q+dy][ox+x*q+dx]!=color]
            marked=len(differences)==1 and list(differences[0])in retained.get('observed_marker_overlays',[])
            if (len(values)==1 or marked)and color not in(retained['background'],retained['empty'],retained['border']):bodies.append({'cell':[y,x],'appearance':color})
        if len(bodies)!=retained['population']:return None
        l,t,r,b=retained['reference_box']
        if identity([row[l:r+1]for row in rows[t:b+1]])!=retained['reference_digest']:return None
        return {**retained,'bodies':sorted(bodies,key=lambda p:p['cell'])}
    parts=components(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0];frames=[]
    for p in parts:
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<7:continue
        perimeter={(x,y)for x in range(w)for y in range(h)if x in(0,w-1)or y in(0,h-1)}
        if perimeter<=set(p['mask']):frames.append(p)
    squares=[p for p in parts if p['rectangular']and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1]and 2<=p['scale']<=8]
    for zone,reference in itertools.permutations(frames,2):
        if zone['color']!=reference['color']:continue
        l,t,r,b=zone['bbox'];rl,rt,rr,rb=reference['bbox']
        if not(r<rl or rr<l or b<rt or rb<t):continue
        inside=[p for p in squares if l<p['bbox'][0]<=p['bbox'][2]<r and t<p['bbox'][1]<=p['bbox'][3]<b]
        if len(inside)<2 or len({p['color']for p in inside})!=1 or len({p['scale']for p in inside})!=1:continue
        empty=inside[0]['color'];q=inside[0]['scale']+1;zy=min(p['bbox'][1]for p in inside);zx=min(p['bbox'][0]for p in inside)
        height=(b-t-1+1)//q;width=(r-l-1+1)//q
        if len(inside)!=height*width:continue
        refs=[p for p in squares if p['scale']==q-1 and rl<p['bbox'][0]<=p['bbox'][2]<rr and rt<p['bbox'][1]<=p['bbox'][3]<rb and p['color']!=background]
        if not refs:continue
        ry=min(p['bbox'][1]for p in refs);rx=min(p['bbox'][0]for p in refs)
        target=[((p['bbox'][1]-ry)//q,(p['bbox'][0]-rx)//q,p['color'])for p in refs]
        if max(y for y,x,c in target)>=height or max(x for y,x,c in target)>=width:continue
        separators=[p['bbox'][1]for p in parts if p['rectangular']and p['bbox'][0]==0 and p['bbox'][2]==len(rows[0])-1 and p['bbox'][1]>b]
        if not separators:continue
        bottom=min(separators);oy,ox=zy%q,zx%q
        floor=[(y,x)for y in range((bottom-oy-(q-1))//q+1)for x in range((len(rows[0])-ox-(q-1))//q+1)]
        body_parts=[p for p in squares if p['scale']==q-1 and p['bbox'][3]<bottom and p['color']not in(background,empty,zone['color'])and p['bbox'][0]%q==ox and p['bbox'][1]%q==oy]
        if len(body_parts)!=len(target):continue
        bodies=[{'cell':[(p['bbox'][1]-oy)//q,(p['bbox'][0]-ox)//q],'appearance':p['color']}for p in body_parts]
        desired=[[(zy-oy)//q+y,(zx-ox)//q+x,c]for y,x,c in target]
        return plain({'q':q,'offset':[oy,ox],'floor':floor,'zone_box':zone['bbox'],'reference_box':reference['bbox'],'reference_digest':identity([row[rl:rr+1]for row in rows[rt:rb+1]]),'target':desired,'background':background,'empty':empty,'border':zone['color'],'population':len(bodies),'bodies':sorted(bodies,key=lambda p:p['cell'])})
    return None

def point(s,cell):return {'x':s['offset'][1]+cell[1]*s['q']+(s['q']-1)//2,'y':s['offset'][0]+cell[0]*s['q']+(s['q']-1)//2}

def input_candidates(rows,available):
    result=inherited_inputs(rows,available);s=scene(rows)
    if s and 'ACTION6'in available:result +=[{'action_ref':'ACTION6','data':point(s,b['cell'])}for b in s['bodies']]
    return result

def paths(start,floor,occupied,controls):
    queue=deque([(start,[],[start])]);found={start:([],[start])}
    while queue:
        p,word,path=queue.popleft()
        for action,law in sorted(controls.items()):
            d=law['delta'];nxt=p[0]+d[0],p[1]+d[1]
            if nxt in found or nxt not in floor or(nxt in occupied and nxt!=start):continue
            found[nxt]=(word+[{'action_ref':action}],path+[nxt]);queue.append((nxt,*found[nxt]))
    return found

def local_relations(s):
    occupied={tuple(b['cell'])for b in s['bodies']};observed=[]
    for b in s['bodies']:
        y,x=b['cell'];bits=sum(1<<i for i,(dy,dx)in enumerate(((-1,0),(1,0),(0,-1),(0,1)))if(y+dy,x+dx)in occupied)
        observed.append({'local_direction_mask':bits,'degree':bits.bit_count(),'appearance':b['appearance']})
    return observed

class ReferencePopulationAccess(ReceptionServiceAccess):
    def __init__(self):super().__init__();self.population_events=[];self.population_controls={};self.population_state=None
    def retained_digest(self):return identity([super().retained_digest(),self.population_events,self.population_controls,self.population_state])
    def apply_event(self,e):
        if e.get('kind')=='observed_reference_population':self.population_events.append(e);self.population_controls=copy.deepcopy(e['controls']);self.population_state=copy.deepcopy(e['state']);return
        return super().apply_event(e)
    def propose_graph(self,o,rows,inputs,limit,config):
        cfg=config.get('reference_population_question');m=copy.deepcopy(self.population_state)if self.population_state and self.population_state['epoch']==o['level_epoch']else None;s=scene(rows,m['scene']if m else None)
        if m and not s:return {'status':'unknown','block_unrelated_probe':True,'reason':'current_reference_population_revalidation_missing'}
        if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
        if m is None:m={'epoch':o['level_epoch'],'scene':s,'active':None,'pending':None,'tried':[],'evidence':[o['observation_ref']]}
        current={tuple(b['cell'])for b in s['bodies']};target={tuple(p[:2])for p in s['target']};remaining=sorted(current-target);slots=sorted(target-current);controls={k:v for k,v in self.population_controls.items()if k in o['available_action_refs']};floor=set(map(tuple,s['floor']))
        if not remaining:return {'status':'unknown','block_unrelated_probe':True,'reason':'reference_occupancy_prepared_color_relation_or_terminal_unknown'}
        graph={p:paths(p,floor,current,controls)for p in remaining};domains=[sorted((t for t in slots if t in graph[p]),key=lambda t:(len(graph[p][t][0]),t))for p in remaining];assigned,unfilled=maximum_injective_matching(domains)
        # Existing augmenting matcher under increasing measured path bounds;
        # this is a bottleneck witness, not a global schedule optimum.
        if not unfilled:
            for bound in sorted({len(graph[p][t][0])for p in remaining for t in slots if t in graph[p]}):
                candidate,missing=maximum_injective_matching([[t for t in domain if len(graph[p][t][0])<=bound]for p,domain in zip(remaining,domains)])
                if not missing:assigned,unfilled=candidate,missing;break
        mapping={remaining[i]:t for i,t in assigned};action=[];expected=[];mode='select';chosen=None;why=cfg['selection'];method='V5.maximum_injective_matching'
        active=tuple(m['active'])if m['active']else None;pending=tuple(m['pending'])if m['pending']else None
        if active in remaining and active in mapping:
            chosen=active;destination=mapping[active];action,path=graph[active][destination];action=action[:limit];expected=[list(p)for p in path[1:limit+1]];mode='move';why=cfg['compose']
        if not action and active in remaining:
            unknown=sorted({a['action_ref']for a in inputs if not a.get('data')and a['action_ref']not in controls and [a['action_ref'],list(active)]not in m['tried']})
            if unknown:chosen=active;action=[{'action_ref':unknown[0]}];expected=[None];mode='probe';why=cfg['control']
        if not action and pending in current:
            available=sorted({a['action_ref']for a in inputs if not a.get('data')});chosen=pending;action=[{'action_ref':available[0]}];expected=[None];mode='probe';why=cfg['control']
        if not action:
            choices=sorted(remaining,key=lambda p:(p not in mapping,min(abs(p[0]-t[0])+abs(p[1]-t[1])for t in slots),p));chosen=choices[0]
            action=[{'action_ref':'ACTION6','data':point(s,chosen)}];expected=[None];mode='select'
        v=plain({'state':m,'scene':s,'chosen':chosen,'commands':action,'expected':expected,'before_cells':[chosen]+expected[:-1],'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'why':why,'mode':mode,'assignment_method':method,'assignment_complete':not unfilled,'controls':controls})
        ref='reference-population:'+identity(v);evidence=m['evidence'][-16:];facts={'current_reference_occupancy_measured':True,'color_relation_unknown':True,'point_selection_experimental':mode=='select','conditional_single_member_motion':True}
        return {'status':'proposed','kind':'reference_population','proposal_id':ref,'reference_population_plan':v,'actions':action,'steps':[{'action':a,'expected_after':None}for a in action],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':action,'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        if 'reference_population_plan'not in p:return super().before(p,index,rows,**meta)
        v=p['reference_population_plan'];s=scene(rows,v['scene']);ok=s is not None and p['proposal_id']=='reference-population:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions'][index]['action_ref']in meta['available']
        if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
        else:
            original={tuple(b['cell'])for b in v['scene']['bodies']};wanted=original-{tuple(v['chosen'])}|{tuple(v['before_cells'][index])};ok=ok and {tuple(b['cell'])for b in s['bodies']}==wanted
        return {'admitted':ok,'reason':'current_population_and_reference_bound'if ok else'population_or_reference_changed'}
    def after(self,p,index,rows,later,**meta):
        if 'reference_population_plan'not in p:return super().after(p,index,rows,later,**meta)
        v=p['reference_population_plan'];boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['expected'][index];matched=None
        if not boundary and expected is not None:
            s=scene(later,v['scene']);wanted={tuple(b['cell'])for b in v['scene']['bodies']}-{tuple(v['chosen'])}|{tuple(expected)};matched=s is not None and {tuple(b['cell'])for b in s['bodies']}==wanted
        return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'boundary'if boundary else'unknown_population_effect'if expected is None else'population_projection'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index)
        v=proposal.get('reference_population_plan')
        if not v or before['level_epoch']!=after['level_epoch']:return events
        m=copy.deepcopy(self.population_state)if self.population_state and self.population_state['epoch']==before['level_epoch']else copy.deepcopy(v['state']);a=scene(rows,m['scene']);controls=copy.deepcopy(self.population_controls)
        if v['mode']=='select':
            y,x=v['chosen'];q=m['scene']['q'];oy,ox=m['scene']['offset'];changes=[(dy,dx,later[oy+y*q+dy][ox+x*q+dx])for dy in range(q-1)for dx in range(q-1)if rows[oy+y*q+dy][ox+x*q+dx]!=later[oy+y*q+dy][ox+x*q+dx]]
            if len(changes)==1:m['scene']['observed_marker_overlays']=plain(sorted({tuple(z)for z in m['scene'].get('observed_marker_overlays',[])}|{changes[0]}))
        b=scene(later,m['scene'])
        if not a or not b:return events
        old={tuple(p['cell'])for p in a['bodies']};new={tuple(p['cell'])for p in b['bodies']};gone=old-new;added=new-old;detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':cmd,'mode':v['mode']}
        if len(gone)==len(added)==1:
            origin=next(iter(gone));dest=next(iter(added));delta=[dest[0]-origin[0],dest[1]-origin[1]]
            if not cmd.get('data')and sum(abs(x)for x in delta)==1:
                controls[cmd['action_ref']]={'delta':delta,'evidence':[before['observation_ref'],after['observation_ref']]};m['active']=list(dest);m['pending']=None
                state=NeighborhoodState(occurrences=tuple(NeighborhoodOccurrence(occurrence_ref=str(i),cell=c)for i,c in enumerate(sorted(old))),active_occurrence_ref=str(sorted(old).index(origin)),reserve=0,terminated=False)
                model=SimpleNamespace(movement_cells=tuple(map(tuple,a['floor'])),motion_law_ref='collision_checked_cardinal_step');req=SimpleNamespace(domain_bound=4096,node_bound=100000,time_bound_ms=2000)
                predicted=_physical(model,state,NeighborhoodInput(kind_ref='move',delta=tuple(delta)),DWorkBudget(req))['state'];detail['V5_physical_step_matches']=set(p.cell for p in predicted.occurrences)==new
        elif v['mode']=='select':m['pending']=v['chosen'];m['active']=None;detail['selection_scope']='Pointed occupied occurrence; controlled identity awaits displacement response.'
        if v['mode']=='probe':m['tried'].append([cmd['action_ref'],v['before_cells'][index]])
        m['scene']=b;m['evidence']+=[before['observation_ref'],after['observation_ref']]
        event=plain({'kind':'observed_reference_population','state':m,'controls':controls,'detail':detail,'observed_local_relations':local_relations(b),'color_rule_status':'observed_samples_only_no_complete_law'});self.apply_event(event);events.append(event);return events
