"""Current raster binding of the existing conditional V5 ordered-support model."""
import copy,json
from collections import Counter
from pathlib import Path
from common_sliding_cavity import components
from common_multiscale_constraints import digest,rows_digest
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,OrderedSupportConfiguration,OrderedSupportTransferRequest
from agents.yf_arc3_v5.capabilities.ordered_supports import measure_ordered_support_geometry,measure_ordered_support_non_layer_spans,declared_support_orders,materialize_ordered_support_transfer_witnesses


def measure(rows):
    frame=FrameGrid(rows=rows);parts=components(rows);g=measure_ordered_support_geometry(frame,parts)
    if not g.supports:return None
    spans,target,tie=measure_ordered_support_non_layer_spans(frame,parts,g)
    if target is None:return None
    byref={c.component_id:c for c in parts.components};stem=byref[g.supports[target].support_ref];cx=g.supports[target].center_column
    hollow=[c for c in parts.components if c.bbox.top>=stem.bbox.top and c.bbox.bottom<=stem.bbox.bottom and c.area<c.bbox.width*c.bbox.height]
    pairs=[(a,b)for a in hollow for b in hollow if a is not b and a.value==b.value and a.bbox.top==b.bbox.top and a.bbox.bottom==b.bbox.bottom and a.bbox.left+b.bbox.right==2*cx and a.bbox.right+b.bbox.left==2*cx and a.bbox.right<cx<b.bbox.left]
    if not pairs:return None
    reference_pixels={(x,y)for a,b in pairs for c in(a,b)for y,x in c.pixels}
    measured=[]
    for support in g.supports:
        component=byref[support.support_ref]
        box=[component.bbox.left,component.bbox.top,component.bbox.right,component.bbox.bottom]
        bands=material_bands(rows,box,reference_pixels)
        if bands is None:return None
        extents=tuple(b['bbox'][2]-b['bbox'][0]+1 for b in sorted(bands,key=lambda b:-b['bbox'][1]))
        if any(lower<=upper for lower,upper in zip(extents,extents[1:])):return None
        measured.append(support.model_copy(update={'layer_extents':extents}))
    extents=[n for support in measured for n in support.layer_extents]
    if len(set(extents))!=len(extents):return None
    g=g.model_copy(update={'supports':tuple(measured),'strict_layer_order_observed':True,'globally_unique_layer_extents_observed':True})
    return {'geometry':g.model_dump(mode='json'),'configuration':[list(s.layer_extents)for s in g.supports],'target':target,'spans':list(spans),'reference_pairs':[(a.component_id,b.component_id)for a,b in pairs],'structural_supports':[{'bbox':[byref[s.support_ref].bbox.left,byref[s.support_ref].bbox.top,byref[s.support_ref].bbox.right,byref[s.support_ref].bbox.bottom],'value':byref[s.support_ref].value}for s in g.supports]}


def material_bands(rows,box,reference_pixels):
    """Measure equal repeated material wings; a bound reference is separate matter.

    An asymmetric same-material extension is ambiguity, never trimmed. Adjacent
    different matter is admissible only when it belongs to the measured hollow
    reference; no appearance value or historical width is privileged.
    """
    bg=Counter(v for row in rows for v in row).most_common(1)[0][0]
    l,t,r,b=box;profiles=[]
    for y in range(t,b+1):
        if l<=0 or r+1>=len(rows[y]):return None
        left,right=rows[y][l-1],rows[y][r+1]
        if left==bg and right==bg:profiles.append((y,None));continue
        if (l-1,y)in reference_pixels or(r+1,y)in reference_pixels:profiles.append((y,None));continue
        if left!=right or left==bg:profiles.append((y,('ambiguous',)));continue
        xl=l-1;xr=r+1
        while xl>0 and rows[y][xl-1]==left and(xl-1,y)not in reference_pixels:xl-=1
        while xr+1<len(rows[y])and rows[y][xr+1]==left and(xr+1,y)not in reference_pixels:xr+=1
        outside_ok=all(x<0 or x>=len(rows[y])or rows[y][x]==bg or(x,y)in reference_pixels for x in(xl-1,xr+1))
        if l-xl!=xr-r or not outside_ok:profiles.append((y,('ambiguous',)));continue
        profiles.append((y,(xl,xr,left)))
    groups=[]
    for y,profile in profiles:
        if groups and groups[-1][-1][1]==profile and groups[-1][-1][0]+1==y:groups[-1].append((y,profile))
        else:groups.append([(y,profile)])
    result=[]
    for group in groups:
        profile=group[0][1]
        if len(group)<2 or profile is None:continue
        if profile==('ambiguous',):return None
        xl,xr,value=profile;result.append({'bbox':[xl,group[0][0],xr,group[-1][0]],'value':value})
    return result


def band(rows,s,source,extent):
    parts=components(rows);byref={c.component_id:c for c in parts.components}
    reference_pixels={(x,y)for pair in s['reference_pairs']for ref in pair for y,x in byref[ref].pixels}
    candidates=material_bands(rows,s['structural_supports'][source]['bbox'],reference_pixels)
    if candidates is None:return None
    candidates=[b for b in candidates if b['bbox'][2]-b['bbox'][0]+1==extent]
    return candidates[0]if len(candidates)==1 else None


def selection_matches(first,later,plan):
    if len(first)!=len(later)or any(len(a)!=len(b)for a,b in zip(first,later)):return False
    l,t,r,b=plan['member']['bbox'];color=plan['member']['value'];changed=[(x,y)for y in range(len(first))for x in range(len(first[y]))if first[y][x]!=later[y][x]]
    if not changed or not all(later[y][x]==color for y in range(t,b+1)for x in range(l,r+1)):return False
    outside=[(x,y)for x,y in changed if not(l<=x<=r and t<=y<=b)]
    if not outside:return True
    xl=min(x for x,y in outside);xr=max(x for x,y in outside);yt=min(y for x,y in outside);yb=max(y for x,y in outside)
    if not(xl<l<=r<xr and yt<t<=b<yb and l-xl==xr-r and t-yt==yb-b):return False
    perimeter={(x,y)for y in range(yt,yb+1)for x in range(xl,xr+1)if x in(xl,xr)or y in(yt,yb)}
    return set(outside)<=perimeter and len({later[y][x]for x,y in perimeter})==1


class OrderedSupportTransfer:
    def __init__(self):
        self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['ordered_support_transfer'];self.events=[];self.closed=set()
    def state(self):return plain({'format':'ordered_support_transfer.v1','events':self.events,'closed':sorted(self.closed)})
    def restore(self,state):
        if set(state)!={'format','events','closed'}or state['format']!='ordered_support_transfer.v1':raise ValueError('Incomplete ordered support state')
        self.events=copy.deepcopy(state['events']);self.closed=set(state['closed'])
    def propose(self,obs,rows,inputs,remaining):
        cfg=self.policy;action=cfg['point_action']
        if not cfg['enabled']or action not in obs['available_action_refs']or remaining<2:return None
        s=measure(rows)
        if s is None:return None
        key=digest([obs['level_epoch'],s['configuration'],s['target'],s['structural_supports']])
        if key in self.closed:return None
        request=OrderedSupportTransferRequest(configuration=OrderedSupportConfiguration(support_extents=tuple(map(tuple,s['configuration']))),endpoint_support_index=s['target'],traversal_orders=declared_support_orders(len(s['configuration']),s['target'],tuple(cfg['traversal_orders'])),maximum_state_expansions=cfg['maximum_state_expansions'],maximum_transfer_depth=min(cfg['maximum_transfer_depth'],remaining//2))
        result=materialize_ordered_support_transfer_witnesses(request)
        if not result.witnesses:return None
        step=result.witnesses[0].steps[0];source,dest=step.source_support_index,step.destination_support_index;member=band(rows,s,source,step.extent)
        if member is None:return None
        expected=copy.deepcopy(s['configuration']);expected[dest].append(expected[source].pop());actions=[]
        for index in (source,dest):
            y,x=s['geometry']['supports'][index]['point'];actions.append({'action_ref':action,'data':{'x':x,'y':y}})
        plan={'ordered_support_transfer':True,'scene':s,'member':member,'source':source,'destination':dest,'expected_configuration':expected,'before_rows':rows,'commands':actions,'context_key':key,'binding':{k:obs[k]for k in ('observation_ref','level_epoch','levels_completed','frame_hash')},'model_status':'conditional_top_only_smaller_on_larger_not_exclusive','alternatives':cfg['alternatives']}
        ref='C_ordered_support_'+digest([obs['observation_ref'],source,dest,step.extent]);facts={'current_repeated_supports_and_strict_extents':True,'current_hollow_reference_bound':True,'conditional_ordered_route_exists':True,'selection_before_deposit_guard_required':True,'current_input_publicly_available':True}
        evidence=[obs['observation_ref']]+[e['after']for e in self.events[-8:] if e.get('transfer_observed')]
        steps=[]
        for i,a in enumerate(actions):
            x,y=a['data']['x'],a['data']['y'];value=rows[y][x]
            witness={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':s['geometry']['supports'][(source,dest)[i]]['support_ref'],'signature':digest([obs['observation_ref'],x,y,value]),'scope':'Current V5 measured support pixel; role and response remain conditional.'}
            steps.append({'action':a,'locus_witness':witness,'expected_after':{'selection':'unknown_until_current_comparison'}if i==0 else{'configuration':expected}})
        return {'status':'proposed','kind':'conditional_ordered_support_transfer','support_plan':plain(plan),'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'role':'information_question','open_question':cfg['why'],'properties':{'reference_role':'hypothesis','ordering_law':'conditional','remaining_transfers':len(result.witnesses[0].steps),'alternatives':cfg['alternatives']},'relations':['contributes_to:G_official_completion']}],'binding':plan['binding'],'question':{'reason':cfg['why'],'hypothesis_refs':evidence},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':cfg['why'],'preconditions':facts,'evidence':evidence,'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,public,obs):
        plan=p['support_plan'];binding=plan['binding'];ok=p['actions']==plan['commands']and index in(0,1)and public.level==binding['level_epoch']and public.levels_completed==binding['levels_completed']and p['actions'][index]['action_ref']in public.available_action_refs
        if index==0:ok=ok and public.frame_hash==binding['frame_hash']and obs['observation_ref']==binding['observation_ref']and tuple(map(tuple,public.frame_rows))==tuple(map(tuple,plan['before_rows']))
        else:ok=ok and selection_matches(plan['before_rows'],public.frame_rows,plan)
        return {'admitted':bool(ok),'reason':'current_ordered_support_scope_and_intermediate_selection'if ok else'ordered_support_scope_or_selection_unbound'}
    def after(self,p,index,before,after,first,second):
        plan=p['support_plan']
        if before['level_epoch']!=after['level_epoch']or before['levels_completed']!=after['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        if index==0:matched=selection_matches(plan['before_rows'],second,plan)
        else:
            current=measure(second);matched=current is not None and current['configuration']==plan['expected_configuration']and current['target']==plan['scene']['target']and current['structural_supports']==plan['scene']['structural_supports']
        return {'matched':bool(matched),'seal_prefix':not matched or index==1,'reason':'observed_selection_only'if index==0 else'compare_conditional_transfer_not_universal_law'}
    def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
        if not proposal or not proposal.get('support_plan',{}).get('ordered_support_transfer'):return {'events':[]}
        if index not in (0,1)or command!=proposal['actions'][index]:raise ValueError('Ordered support observed command differs from released binding')
        result=self.after(proposal,index,before,after,first,second);event={'kind':'ordered_support_response','before':before['observation_ref'],'after':after['observation_ref'],'origin_epoch':before['level_epoch'],'command':command,'parent':'G_official_completion','selection_observed':index==0 and result['matched']is True,'transfer_observed':index==1 and result['matched']is True,'official_progress':after['levels_completed']>before['levels_completed'],'model_scope':'observed local response; ordering and terminal interpretations remain revisable','matched':result['matched']};self.events.append(event)
        if result['matched']is False:self.closed.add(proposal['support_plan']['context_key'])
        return {'events':[event]}
