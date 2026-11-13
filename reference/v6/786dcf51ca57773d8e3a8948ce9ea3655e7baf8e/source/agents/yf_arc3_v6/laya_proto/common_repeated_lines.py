"""Public repeated-field line completion as a falsifiable goal hypothesis.

No game identity, palette role, target length, dimensions or coordinates are supplied.
Parallel separators and repeated rectangular patches measure the lattice. A line
that recurs across independent fields proposes a missing continuation, not a win.
"""
from collections import Counter,defaultdict
from geometric_observer import components
from terminal_composition import identity


def fields(rows):
    parts=components(rows);sizes=Counter()
    for p in parts:
        x,y,r,b=p['bbox'];w,h=r-x+1,b-y+1
        if p['area']==w*h and min(w,h)>=2:sizes[w,h]+=1
    result=[];height=len(rows);width=len(rows[0])
    for (w,h),support in sizes.items():
        if support<4:continue
        bands=defaultdict(list)
        for p in parts:
            x,y,r,b=p['bbox'];lw,lh=r-x+1,b-y+1
            if p['area']==lw*lh and lw<w and lh>=3*h:bands[y,b,lw,p['color']].append(x)
        for (top,bottom,lw,color),xs in bands.items():
            xs=sorted(xs);chains=[];chain=[]
            for x in xs:
                if chain and x-chain[-1]!=w+lw:chains.append(chain);chain=[]
                chain.append(x)
            if chain:chains.append(chain)
            for chain in chains:
                if len(chain)<3:continue
                # Independently measured repeated horizontal gaps determine row pitch.
                gaps=Counter()
                for p in parts:
                    l,t,r,b=p['bbox'];gw,gh=r-l+1,b-t+1
                    if p['area']==gw*gh and gw==w and gh<h and chain[0]-w<=l<=chain[-1]+lw and top<=t<=bottom:gaps[gh]+=1
                if not gaps:continue
                gap=gaps.most_common(1)[0][0];pitch=h+gap
                if (bottom-top+1+gap)%pitch:continue
                ny=(bottom-top+1+gap)//pitch;nx=len(chain)+1;left=chain[0]-w
                if ny<3 or left<0 or left+(nx-1)*(w+lw)+w>width or top+(ny-1)*pitch+h>height:continue
                grid=[];unknown=0
                for j in range(ny):
                    line=[]
                    for i in range(nx):
                        x=left+i*(w+lw);y=top+j*pitch;values={rows[v][u] for v in range(y,y+h) for u in range(x,x+w)}
                        if len(values)!=1:line.append(None);unknown+=1
                        else:line.append(next(iter(values)))
                    grid.append(line)
                if unknown>min(nx,ny):continue
                counts=Counter(v for row in grid for v in row if v is not None)
                if len(counts)<2:empty=next(iter(counts))
                else:
                    ranked=counts.most_common()
                    if ranked[0][1]==ranked[1][1]:continue
                    empty=ranked[0][0]
                field={'origin':[left,top],'pitch':[w+lw,pitch],'size':[w,h],'shape':[nx,ny],'grid':grid,'empty_hypothesis':empty}
                field['ref']=identity({k:v for k,v in field.items() if k!='grid'})
                if not any(f['ref']==field['ref'] for f in result):result.append(field)
    return sorted(result,key=lambda f:tuple(f['origin'][::-1]))


def pointed_candidates(rows,available):
    if 'ACTION6' not in available:return []
    result=[]
    for f in fields(rows):
        for y,line in enumerate(f['grid']):
            for x,_ in enumerate(line):
                result.append({'action_ref':'ACTION6','data':{'x':f['origin'][0]+x*f['pitch'][0]+(f['size'][0]-1)//2,'y':f['origin'][1]+y*f['pitch'][1]+(f['size'][1]-1)//2}})
    return result


def extensions(f):
    g=f['grid'];nx,ny=f['shape'];empty=f['empty_hypothesis'];found=[]
    for y,row in enumerate(g):
        for x,color in enumerate(row):
            if color is None or color==empty:continue
            for dx,dy in ((1,0),(0,1),(1,1),(1,-1)):
                if 0<=x-dx<nx and 0<=y-dy<ny and g[y-dy][x-dx]==color:continue
                length=0
                while 0<=x+length*dx<nx and 0<=y+length*dy<ny and g[y+length*dy][x+length*dx]==color:length+=1
                if length<2:continue
                for u,v in ((x-dx,y-dy),(x+length*dx,y+length*dy)):
                    if 0<=u<nx and 0<=v<ny and g[v][u]==empty:found.append({'color':color,'length':length,'target':[u,v],'direction':[dx,dy]})
    return found


class RepeatedLinePatterns:
    def __init__(self):self.line_trials={};self.line_goals=[]
    def apply_event(self,e):
        if e['kind']=='repeated_line_trial':self.line_trials[e['trial']]=e
        elif e['kind']=='repeated_line_scored':self.line_goals.append(e)
        else:raise ValueError('Unexpected repeated-line event')
    def retained_digest(self):return identity([self.line_trials,self.line_goals])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if config.get('repeated_line_completion'):
            q=self.line_question(obs,rows,inputs)
            if q:return q
        return {'status':'abstained','reason':'no_recurrent_line_question'}
    def line_question(self,obs,rows,inputs):
        fs=fields(rows)
        if len(fs)<2 or not any(a['action_ref']=='ACTION6' and a.get('data') for a in inputs):return None
        supports=defaultdict(set);options=[]
        for f in fs:
            for e in extensions(f):supports[e['color'],e['length']].add(f['ref']);options.append((f,e))
        if not supports:return None
        retained=next((e for e in self.line_trials.values() if e['epoch']==obs['level_epoch'] and e['result']=='matched' and e.get('support_fields')),None)
        if retained:
            color,length=retained['palette'],retained['candidate_length']-1
            original_fields=set(retained['support_fields']);current_fields={f['ref'] for f in fs}
            if not original_fields<=current_fields:return None
            evidence_fields=retained['support_fields']
        else:
            rank=max((len(v),k[1]) for k,v in supports.items());winners=[k for k,v in supports.items() if (len(v),k[1])==rank]
            if len(winners)!=1 or rank[0]<2:return None
            color,length=winners[0];original_fields=supports[color,length];evidence_fields=sorted(original_fields)
        candidates=[]
        accepted={e['field'] for e in self.line_trials.values() if e['epoch']==obs['level_epoch'] and e['result']=='matched'}
        for f,e in options:
            if (e['color'],e['length'])!=(color,length) or f['ref'] in accepted or f['ref'] not in original_fields:continue
            x,y=e['target'];px=f['origin'][0]+x*f['pitch'][0];py=f['origin'][1]+y*f['pitch'][1]
            cmd={'action_ref':'ACTION6','data':{'x':px+(f['size'][0]-1)//2,'y':py+(f['size'][1]-1)//2}}
            if not any(a['action_ref']==cmd['action_ref'] and a.get('data')==cmd['data'] for a in inputs):continue
            trial=identity([obs['level_epoch'],f['ref'],e['target'],color,length])
            if trial in self.line_trials:continue
            candidates.append((f,e,cmd,trial,[px,py]))
        if not candidates:return None
        f,e,cmd,trial,target=min(candidates,key=lambda z:(z[0]['origin'][1],z[0]['origin'][0],z[1]['target'][1],z[1]['target'][0]))
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'trial':trial,'field':f['ref'],
              'target':target,'size':f['size'],'expected_palette':color,'action':cmd,'observed_length':length,'candidate_length':length+1,'support_fields':evidence_fields,
              'scope':'Repeated geometric continuation is a goal hypothesis; pointing may have a different or absent effect. No terminal role is presumed.'}
        ref='C_line_continuation_'+identity(plan)[:18];why='Test a continuation of the same collinear pattern repeated across independent measured fields.'
        facts={'recurrent_collinear_pattern':True,'measured_point_on_support':True};evidence=[obs['observation_ref'],*plan['support_fields']]
        return {'status':'proposed','kind':'repeated_line_completion','proposal_id':ref,'line_plan':plan,'actions':[cmd],'steps':[{'action':cmd,'expected_after':{'target':target,'palette':color}}],
            'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'pattern_length':length,'candidate_length':length+1},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':'complete_a_recurrent_geometric_series','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':plan['epoch'],'observation_ref':plan['observation_ref']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[cmd],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('line_plan')
        if not plan:return {'admitted':False,'reason':'missing_series_plan'}
        ok=index==0 and plan['action']['action_ref'] in meta['available'] and (plan['epoch'],plan['score'],plan['observation_ref'])==(meta['epoch'],meta['score'],meta['observation_ref']) and identity(rows)==plan['frame_digest']
        return {'admitted':ok,'reason':'pointed_series_bound' if ok else 'pointed_series_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('line_plan')
        if not plan:return {'matched':None,'seal_prefix':True,'reason':'missing_series_plan'}
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        x,y=plan['target'];w,h=plan['size'];match=all(later[v][u]==plan['expected_palette'] for v in range(y,y+h) for u in range(x,x+w))
        return {'matched':match,'seal_prefix':True,'reason':'series_continuation_observed' if match else 'series_continuation_refuted'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=[];plan=proposal.get('line_plan')
        if not plan:return events
        outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
        event={'kind':'repeated_line_trial','epoch':before['level_epoch'],'trial':plan['trial'],'field':plan['field'],'result':'boundary' if outcome['matched'] is None else 'matched' if outcome['matched'] else 'refuted',
               'before':before['observation_ref'],'after':after['observation_ref'],'candidate_length':plan['candidate_length'],'palette':plan['expected_palette'],'support_fields':plan['support_fields'],'action':command}
        extra=[event]
        if after['levels_completed']>before['levels_completed']:extra.append({'kind':'repeated_line_scored','epoch':before['level_epoch'],'candidate_length':plan['candidate_length'],'palette':plan['expected_palette'],'source':after['observation_ref'],'scope':'Scored completion witness; current-level visual and input applicability must be rediscovered.'})
        for e in extra:self.apply_event(e)
        return events+extra


class PointedLineConstraint:
    """C transport adapter; same series predictions, independent event memory."""
    def __init__(self):self.memory=RepeatedLinePatterns()
    def propose(self,obs,rows,inputs,remaining):
        if remaining<1:return None
        measured=pointed_candidates(rows,obs['available_action_refs'])
        p=self.memory.line_question(obs,rows,inputs+measured)
        if p:
            p['steps'][0]['expected_before']={k:obs[k] for k in ('level_epoch','frame_hash','levels_completed','state')}
            x,y=p['actions'][0]['data']['x'],p['actions'][0]['data']['y'];plan=p['line_plan'];w,h=plan['size'];left,top=plan['target']
            p['point_support']={'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],
                'point':[x,y],'palette_value':rows[y][x],'bbox':[left,top,left+w-1,top+h-1],
                'entity_ref':'measured-lattice-cell:'+plan['trial'],'signature':identity([plan['field'],plan['target'],plan['size']]),
                'provenance':'uniform cell measured between repeated public separators; not a connected-component identity',
                'field_ref':plan['field'],'full_raster_digest':plan['frame_digest']}
        return p
    def bind(self,p,domain):
        support=p['point_support'];key=support['level_epoch'],support['frame_hash']
        if key not in domain.bindings:raise ValueError('Current public point domain has not been observed')
        if len(p['actions'])!=1 or support['point']!=[p['actions'][0]['data']['x'],p['actions'][0]['data']['y']]:raise ValueError('Measured cell address changed')
        # An explicit composition yields one addressed support, independently of
        # the bounded exploratory occurrence sample. Preserve that sample intact.
        p['steps'][0]['point_binding']={**support,'scope':'one composition-derived measured cell, full-raster guarded; not an enumerated exploratory sample'}
    def before(self,p,index,public,obs):
        return self.memory.before(p,index,public.frame_rows,epoch=public.level,score=public.levels_completed,available=public.available_action_refs,observation_ref=obs['observation_ref'])
    def after(self,p,index,before,after,first,second):
        return self.memory.after(p,index,first,second,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
    def record(self,before,after,command,first,second,p,index):
        events=self.memory.record(before,command,after,first,second,p,index)
        return {'status':'official_boundary_witness' if after['levels_completed']>before['levels_completed'] else 'pointed_series_response','events':events,'transfer_authority':'hypothesis_only'}
    def state(self):return {'trials':list(self.memory.line_trials.values()),'scored':self.memory.line_goals,'digest':self.memory.retained_digest()}
    def restore(self,state):
        rebuilt=RepeatedLinePatterns()
        for e in state['trials']+state['scored']:rebuilt.apply_event(e)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Repeated series memory digest changed')
        self.memory=rebuilt
