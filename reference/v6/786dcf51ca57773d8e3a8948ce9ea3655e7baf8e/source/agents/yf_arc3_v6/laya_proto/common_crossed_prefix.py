"""Measured reference fields and coupled prefix controls, learned by public effects.

The hypothesis is generic: two aligned controller families contribute prefixes
to a common field. Selection, recoloring, available advancing inputs and their
intersection compatibility must be observed. No game or level data is accepted.
"""
from collections import Counter,defaultdict,deque
from itertools import product
from geometric_observer import components
from terminal_composition import identity
from common_supported_lines import SupportedLineAccess,SupportedLineConstraint


def geometry(rows):
    h,w=len(rows),len(rows[0]);parts=components(rows);groups=defaultdict(list)
    for e in parts:
        x,y,r,b=e['bbox'];a,c=r-x+1,b-y+1
        if min(a,c)>=2 and e['area']==a*c:groups[a,c,e['color']].append((x,y))
    candidates=[]
    for (cw,ch,color),points in groups.items():
        xs=sorted({x for x,y in points});ys=sorted({y for x,y in points})
        if len(points)<4 or min(len(xs),len(ys))<2:continue
        dx=Counter(b-a for a,b in zip(xs,xs[1:])).most_common(1)[0][0];dy=Counter(b-a for a,b in zip(ys,ys[1:])).most_common(1)[0][0]
        if dx<=cw or dy<=ch or any((x-xs[0])%dx or (y-ys[0])%dy for x,y in points):continue
        nx=(xs[-1]-xs[0])//dx+1;ny=(ys[-1]-ys[0])//dy+1
        if len(points)*2<nx*ny:continue
        candidates.append((len(points)*cw*ch,{'origin':[xs[0],ys[0]],'shape':[nx,ny],'size':[cw,ch],'pitch':[dx,dy],'empty_appearance':color}))
    if not candidates:return None
    _,board=max(candidates,key=lambda x:x[0]);x0,y0=board['origin'];nx,ny=board['shape'];cw,ch=board['size'];dx,dy=board['pitch'];right=x0+(nx-1)*dx+cw;bottom=y0+(ny-1)*dy+ch
    background=Counter(v for row in rows for v in row).most_common(1)[0][0];visited=set();references=[]
    for y in range(h):
        for x in range(w):
            if (x,y) in visited or x0<=x<right and y0<=y<bottom or rows[y][x] in (background,board['empty_appearance']):continue
            q=deque([(x,y)]);visited.add((x,y));region=[]
            while q:
                u,v=q.popleft();region.append((u,v))
                for a,b in ((u-1,v),(u+1,v),(u,v-1),(u,v+1)):
                    if 0<=a<w and 0<=b<h and (a,b) not in visited and not(x0<=a<right and y0<=b<bottom) and rows[b][a] not in (background,board['empty_appearance']):visited.add((a,b));q.append((a,b))
            l=min(a for a,b in region);t=min(b for a,b in region);rw=max(a for a,b in region)-l+1;rh=max(b for a,b in region)-t+1;palette={rows[b][a] for a,b in region}
            if len(region)!=rw*rh or len(palette)<2 or rw%nx or rh%ny:continue
            sx,sy=rw//nx,rh//ny
            if sx>=cw or sy>=ch or sx*ch!=sy*cw:continue
            target=[];uniform=True
            for j in range(ny):
                line=[]
                for i in range(nx):
                    values={rows[b][a] for b in range(t+j*sy,t+(j+1)*sy) for a in range(l+i*sx,l+(i+1)*sx)}
                    if len(values)!=1:uniform=False;break
                    line.append(next(iter(values)))
                if not uniform:break
                target.append(line)
            if uniform:references.append({'origin':[l,t],'scale':[sx,sy],'values':target,'palette':sorted(palette)})
    if not references or len({identity(r['values']) for r in references})!=1:return None
    board['reference']=references[0];board['background']=background
    controls=measure_controls(rows,board)
    if controls is None:return None
    board['controllers']=controls;board['ref']=identity(board);return board


def measure_controls(rows,layout):
    x0,y0=layout['origin'];nx,ny=layout['shape'];cw,ch=layout['size'];dx,dy=layout['pitch'];palette=set(layout['reference']['palette']);result=[]
    for axis in (0,1):
        count=ny if axis==0 else nx;family=[]
        for side in (-1,1):
            candidates=[]
            for lane in range(count):
                fixed=y0+lane*dy+(ch-1)//2 if axis==0 else x0+lane*dx+(cw-1)//2
                start=(x0-1 if side<0 else x0+(nx-1)*dx+cw) if axis==0 else (y0-1 if side<0 else y0+(ny-1)*dy+ch)
                limit=len(rows[0]) if axis==0 else len(rows);runs=[];i=start
                while 0<=i<limit:
                    value=rows[fixed][i] if axis==0 else rows[i][fixed]
                    if value not in palette:i+=side;continue
                    group=[]
                    while 0<=i<limit and (rows[fixed][i] if axis==0 else rows[i][fixed])==value:group.append(i);i+=side
                    if len(group)>=2:runs.append((group[len(group)//2],value))
                if not runs:break
                coordinate=lambda v:[v,fixed] if axis==0 else [fixed,v]
                c={'key':f'{axis}:{lane}:{side}','axis':axis,'lane':lane,'side':side,'point':coordinate(runs[0][0]),'color':runs[0][1],'length':nx if axis==0 else ny}
                c['alternatives']=[{'point':coordinate(position),'color':value} for position,value in runs[1:]]
                if len(runs)>1:c.update(button=coordinate(runs[1][0]),alternative=runs[1][1])
                candidates.append(c)
            if len(candidates)==count:family.append(candidates)
        if len(family)!=1:return None
        result.extend(family[0])
    return result


def reference_present(rows,layout):
    r=layout['reference'];x,y=r['origin'];w,h=r['scale']
    return all(rows[y+j*h+v][x+i*w+u]==value for j,line in enumerate(r['values']) for i,value in enumerate(line) for v in range(h) for u in range(w))

def cell(c,k,layout):
    along=k if c['side']<0 else c['length']-1-k
    return (along,c['lane']) if c['axis']==0 else (c['lane'],along)

def slot(rows,layout,position):
    i,j=position;x=layout['origin'][0]+i*layout['pitch'][0];y=layout['origin'][1]+j*layout['pitch'][1];w,h=layout['size']
    return [list(row[x:x+w]) for row in rows[y:y+h]]

def input_candidates(rows,available):
    if 'ACTION6' not in available:return []
    g=geometry(rows)
    if not g:return []
    points={tuple(c['point']) for c in g['controllers']}|{tuple(a['point']) for c in g['controllers'] for a in c.get('alternatives',[])}
    return [{'action_ref':'ACTION6','data':{'x':x,'y':y}} for x,y in sorted(points)]


class CrossedPrefixAccess(SupportedLineAccess):
    def __init__(self):super().__init__();self.cross_state=None;self.cross_pairs=[];self.cross_axis_inputs=defaultdict(set,{0:set(),1:set()});self.cross_events=[]
    def apply_event(self,e):
        if e['kind']=='crossed_prefix_state':self.cross_state=e['state'];self.cross_events.append(e)
        elif e['kind']=='crossed_prefix_pair':self.cross_pairs.append(e);self.cross_events.append(e)
        elif e['kind']=='crossed_prefix_input':self.cross_axis_inputs[e['axis']].add(e['action']);self.cross_events.append(e)
        else:super().apply_event(e)
    def retained_digest(self):return identity([super().retained_digest(),self.cross_state,self.cross_pairs,{k:sorted(v) for k,v in self.cross_axis_inputs.items()},self.cross_events])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if config.get('coupled_prefix_reference'):
            p=self.cross_question(obs,rows,inputs)
            if p:return p
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def cross_question(self,obs,rows,inputs):
        if 'ACTION6' not in obs['available_action_refs']:return None
        state=self.cross_state
        if state is None or state['epoch']!=obs['level_epoch']:
            layout=geometry(rows)
            if not layout:return None
            palette=set(layout['reference']['palette'])
            if any(v in palette for j in range(layout['shape'][1]) for i in range(layout['shape'][0]) for row in slot(rows,layout,(i,j)) for v in row):return None
            state={'epoch':obs['level_epoch'],'layout':layout,'progress':{c['key']:0 for c in layout['controllers']},'selected':None,'actions':{},'blocked':[],'questions':[],'invalid':False}
        if state['invalid'] or not reference_present(rows,state['layout']):return None
        layout=state['layout'];controls=measure_controls(rows,layout)
        if controls is None:return None
        bykey={c['key']:c for c in controls};h={c['lane']:c for c in controls if c['axis']==0};v={c['lane']:c for c in controls if c['axis']==1};target=layout['reference']['values']
        choices=[sorted({c['color'],*(a['color'] for a in c.get('alternatives',[]))}) for c in controls];best=None
        for values in product(*choices):
            assignment=dict(zip((c['key'] for c in controls),values));cost=sum(assignment[c['key']]!=c['color'] for c in controls)
            if best is not None and cost>=best[0]:continue
            if all(t in (assignment[h[j]['key']],assignment[v[i]['key']]) for j,line in enumerate(target) for i,t in enumerate(line)):best=cost,assignment
        if best is None:return None
        assignment=best[1];mode=None;chosen=None;action=None;intent={}
        for c in controls:
            if assignment[c['key']]!=c['color']:
                addresses=[a['point'] for a in c.get('alternatives',[]) if a['color']==assignment[c['key']]]
                if len(addresses)!=1:return None
                chosen=c;mode='recolor';action={'action_ref':'ACTION6','data':dict(zip(('x','y'),addresses[0]))};intent={'desired_color':assignment[c['key']]};break
        known=[p for p in self.cross_pairs if p['owner'] in (0,1)]
        if chosen is None:
            pending=next((q for q in state.get('questions',[]) if state['progress'][q['opposite_key']]<=q['opposite_index'] and not any(p['inputs'][str(q['axis'])]==q['action'] and p['owner'] in q['desired_owners'] for p in known)),None)
            # Before a cross relation is measured, construct one informative
            # intersection. Later finish prefixes against that retained model.
            if pending:chosen=bykey[pending['opposite_key']]
            elif not known:
                anchors=[(i+j,j,i) for j,line in enumerate(target) for i,t in enumerate(line) if h[j]['color']!=v[i]['color']]
                if not anchors:return None
                _,j,i=min(anchors);a=h[j];b=v[i]
                need_a=i+1 if a['side']<0 else a['length']-i;need_b=j+1 if b['side']<0 else b['length']-j
                chosen=a if state['progress'][a['key']]<need_a else b if state['progress'][b['key']]<need_b else None
            else:chosen=next((c for c in controls if state['progress'][c['key']]<c['length']),None)
            if chosen is None:return None
            if state['selected']!=chosen['key']:
                mode='select';action={'action_ref':'ACTION6','data':dict(zip(('x','y'),chosen['point']))}
            else:
                mode='advance';k=state['progress'][chosen['key']];i,j=cell(chosen,k,layout);opposite=v[i] if chosen['axis']==0 else h[j];opposite_index=j if opposite['axis']==1 else i
                if opposite['side']>0:opposite_index=opposite['length']-1-opposite_index
                other_action=state['actions'].get(f"{opposite['key']}:{opposite_index}")
                desired=[owner for owner,c in ((0,h[j]),(1,v[i])) if c['color']==target[j][i]]
                pairs=[p for p in known if p['owner'] in desired and (not other_action or p['inputs'][str(opposite['axis'])]==other_action)]
                preferred=[p['inputs'][str(chosen['axis'])] for p in reversed(pairs)]
                available=[a for a in obs['available_action_refs'] if a in {'ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'}]
                trial_context=[chosen['key'],k,other_action]
                blocked={b['action'] for b in state['blocked'] if b['context']==trial_context}
                contrary={p['inputs'][str(chosen['axis'])] for p in known if p['owner'] not in desired and (not other_action or p['inputs'][str(opposite['axis'])]==other_action)}
                established=sorted(self.cross_axis_inputs[chosen['axis']]-contrary)
                exploratory=[a for a in available if a not in contrary and a not in self.cross_axis_inputs[1-chosen['axis']]]
                ordered=list(dict.fromkeys(preferred+established+exploratory+sorted(contrary)+available))
                candidate=next((a for a in ordered if a in available and a not in blocked),None)
                if candidate is None:return None
                action={'action_ref':candidate};intent={'index':k,'cell':[i,j],'opposite_key':opposite['key'],'opposite_index':opposite_index,'other_action':other_action,'desired_owners':desired,'trial_context':trial_context,'predicted_pair':next((p for p in pairs if p['inputs'][str(chosen['axis'])]==candidate),None)}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'mode':mode,'controller':chosen,'action':action,'intent':intent,'state_before':state,'scope':'Controller correspondence, one-cell prefix advance and latent crossing compatibility are experimentally tested from public effects; no terminal role is assumed from appearance alone.'}
        ref='C_crossed_prefix_'+identity(plan)[:18];why={'select':'Bind a measured controller to the unresolved prefix contributing to the visible reference.','recolor':'Test the visible alternative control appearance required by the reference constraints.','advance':'Test the next contribution of a selected prefix and its compatibility with the crossing contribution.'}[mode]
        facts={'measured_reference_and_field':True,'measured_aligned_controller':True,'current_prefix_question':True};evidence=[obs['observation_ref'],layout['ref']]
        if intent.get('predicted_pair'):evidence.extend(intent['predicted_pair']['evidence'])
        return {'status':'proposed','kind':'coupled_prefix_reference','proposal_id':ref,'crossed_prefix_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':{'mode':mode,'intent':intent}}],'facts':facts,
            'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'controller':chosen['key'],'mode':mode,'reference_ref':layout['ref']},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':'resolve_reference_through_coupled_prefixes','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':plan['epoch'],'observation_ref':plan['observation_ref']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('crossed_prefix_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (plan['epoch'],plan['score'],plan['observation_ref'])==(meta['epoch'],meta['score'],meta['observation_ref']) and plan['action']['action_ref'] in meta['available'] and identity(rows)==plan['frame_digest'] and reference_present(rows,plan['state_before']['layout'])
        return {'admitted':ok,'reason':'crossed_prefix_bound' if ok else 'crossed_prefix_context_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('crossed_prefix_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        layout=plan['state_before']['layout']
        if not reference_present(later,layout):return {'matched':False,'seal_prefix':True,'reason':'reference_changed_unexpectedly'}
        if plan['mode']=='advance':
            same=identity(rows)==identity(later);target=plan['intent']['cell'];changed=slot(rows,layout,target)!=slot(later,layout,target)
            result={'matched':changed,'seal_prefix':True,'reason':'prefix_contribution_observed' if changed else 'input_has_no_effect_in_current_crossing' if same else 'unexplained_nonlocal_control_effect'}
            if changed and plan['intent']['other_action']:
                pixels=slot(later,layout,target);value=pixels[len(pixels)//2][len(pixels[0])//2];x,y=target
                result['reference_property_matched']=value==layout['reference']['values'][y][x]
                if not result['reference_property_matched']:result['reason']='prefix_advanced_but_reference_property_unmet'
            return result
        if plan['mode']=='recolor':
            controls=measure_controls(later,layout) or [];changed=any(c['key']==plan['controller']['key'] and c['color']==plan['intent']['desired_color'] for c in controls)
            return {'matched':changed,'seal_prefix':True,'reason':'control_appearance_observed' if changed else 'control_appearance_refuted'}
        return {'matched':None,'seal_prefix':True,'reason':'selection_is_hypothesis_until_advance'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('crossed_prefix_plan')
        if not plan:return events
        import json
        state=json.loads(json.dumps(plan['state_before']));extra=[];mode=plan['mode'];c=plan['controller'];outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
        boundary=after['level_epoch']!=before['level_epoch'] or after['levels_completed']!=before['levels_completed']
        if mode=='select':state['selected']=c['key']
        elif mode=='recolor':
            if outcome['matched'] is False:state['invalid']=True
        elif mode=='advance':
            intent=plan['intent']
            if outcome['matched'] or boundary:
                state['progress'][c['key']]+=1;state['actions'][f"{c['key']}:{intent['index']}"]=command['action_ref'];extra.append({'kind':'crossed_prefix_input','axis':c['axis'],'action':command['action_ref'],'evidence':after['observation_ref'],'epoch':before['level_epoch']})
                state.setdefault('questions',[]).append({'axis':c['axis'],'action':command['action_ref'],'cell':intent['cell'],'desired_owners':intent['desired_owners'],'opposite_key':intent['opposite_key'],'opposite_index':intent['opposite_index'],'source':after['observation_ref']})
                if outcome.get('reference_property_matched') is False:state['invalid']=True
                if intent['other_action'] and not boundary:
                    controls=measure_controls(later,state['layout']) or [];bykey={x['key']:x for x in controls};other=bykey.get(intent['opposite_key']);pixels=slot(later,state['layout'],intent['cell']);value=pixels[len(pixels)//2][len(pixels[0])//2]
                    own=bykey.get(c['key'])
                    if own and other:
                        owners=[a['axis'] for a in (own,other) if a['color']==value];owner=owners[0] if len(owners)==1 else None
                        extra.append({'kind':'crossed_prefix_pair','inputs':{str(c['axis']):command['action_ref'],str(other['axis']):intent['other_action']},'owner':owner,'visible_palette':value,'evidence':[before['observation_ref'],after['observation_ref']],'epoch':before['level_epoch'],'scope':'Observed compatible intersection and visible appearance; prior-epoch use remains experimental.'})
            elif outcome['reason']=='input_has_no_effect_in_current_crossing':state['blocked'].append({'context':intent['trial_context'],'action':command['action_ref'],'evidence':after['observation_ref']})
            else:state['invalid']=True
        extra.append({'kind':'crossed_prefix_state','state':state,'evidence':after['observation_ref'],'outcome':outcome})
        for e in extra:self.apply_event(e)
        return events+extra

class CrossedPrefixConstraint(SupportedLineConstraint):
    """Shared C adapter, preserving the existing supported-series subquestion."""
    def __init__(self):self.memory=CrossedPrefixAccess();self.events=[]
    def cross_propose(self,obs,rows,inputs,remaining):
        if remaining<1:return None
        p=self.memory.cross_question(obs,rows,inputs+input_candidates(rows,obs['available_action_refs']))
        if not p:return None
        p['steps'][0]['expected_before']={k:obs[k] for k in ('level_epoch','frame_hash','levels_completed','state')}
        if p['actions'][0]['action_ref']=='ACTION6':
            point=p['actions'][0]['data'];x,y=point['x'],point['y'];plan=p['crossed_prefix_plan']
            p['point_support']={'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'bbox':[x,y,x,y],
                'entity_ref':'measured-aligned-control:'+plan['controller']['key'],'signature':identity([plan['controller'],plan['mode'],point]),'provenance':'public color-run address aligned with a repeated field; full-raster and observed-effect guarded','field_ref':plan['state_before']['layout']['ref'],'full_raster_digest':plan['frame_digest']}
        return p
    def bind(self,p,domain):
        if p['actions'][0]['action_ref']=='ACTION6':return super().bind(p,domain)
        if 'crossed_prefix_plan' not in p:raise ValueError('Nonpoint operation without crossed-prefix witness')
    def restore(self,state):
        rebuilt=CrossedPrefixAccess()
        for e in state['events']:rebuilt.apply_event(e)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Coupled-prefix memory digest changed')
        self.memory=rebuilt;self.events=list(state['events'])
