"""Reuse line search on measured cell motifs and dated local/remote additions."""
import copy
from linked_packet_access import LinkedPacketAccess,input_candidates
from cell_patch_observation import fields,project,center,changes
from common_supported_lines import line_windows,search_lines
from return_fork import closed_observed_path_return
from terminal_composition import identity

class CellPlacementAccess(LinkedPacketAccess):
    def __init__(self):super().__init__();self.cell_models={};self.cell_geometries=[];self.cell_events=[];self.cell_refused=set();self.cell_paths={};self.cell_returns={}
    def retained_digest(self):return identity([super().retained_digest(),self.cell_models,self.cell_geometries,self.cell_events,sorted(self.cell_refused),self.cell_paths,self.cell_returns])
    def apply_event(self,e):
        if e.get('kind')=='cell_patch_placement_evidence':self.cell_models=copy.deepcopy(e['models']);self.cell_geometries=copy.deepcopy(e['geometries']);self.cell_refused=set(e['refused']);self.cell_paths=copy.deepcopy(e.get('paths',{}));self.cell_returns=copy.deepcopy(e.get('returns',{}));self.cell_events.append(copy.deepcopy(e));return
        super().apply_event(e)
    def emit_cell(self,detail):
        e={'kind':'cell_patch_placement_evidence','models':copy.deepcopy(self.cell_models),'geometries':copy.deepcopy(self.cell_geometries),'refused':sorted(self.cell_refused),'paths':copy.deepcopy(self.cell_paths),'returns':copy.deepcopy(self.cell_returns),'detail':detail};self.apply_event(e);return e
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        base=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if base.get('status')=='proposed'and not(base.get('kind')=='public_occurrence_recall'and base.get('question',{}).get('reason')=='test_observed_enclosing_emphasis'):return base
        cfg=config.get('cell_placement_question')
        if not cfg or max_prefix<1 or'ACTION6'not in obs['available_action_refs']:return base
        measured=fields(rows,self.cell_geometries);options=[]
        for f in measured:
            empty=f['empty_hypothesis'];key=str(obs['level_epoch'])+':'+f['ref'];model=self.cell_models.get(key);trial=identity([obs['level_epoch'],f['ref'],f['grid']]);nx,ny=f['geometry']['shape']
            if empty is None or trial in self.cell_refused:continue
            vacant=[(x,y)for y,row in enumerate(f['grid'])for x,v in enumerate(row)if v==empty]
            if not vacant:continue
            length=min(nx,ny);windows=line_windows(f['grid'],length);search=None;reason='test_pointed_cell_patch_and_dated_response';predicted=None
            if model and model.get('status')=='candidate'and model['empty']==empty and model['other']in f['motifs']:
                if len(vacant)>cfg['free_search_empty_bound']:continue
                ranked,search=search_lines(f['grid'],model['own'],model['other'],empty,length,None,0,min(len(vacant),cfg['reply_plies']));best=ranked[0]['value'];ties=[r for r in ranked if r['value']==best];returns=self.cell_returns.get(key,{})
                for r in ties:r['observed_return_count']=len(returns.get(identity([f['grid'],r['point']]),[]))
                selected=min(ties,key=lambda r:(r['observed_return_count'],ranked.index(r)));point=selected['point'];search['return_contrast']={'selected_count':selected['observed_return_count'],'tie_count':len(ties),'choice_changed':point!=ranked[0]['point'],'alternatives':[{'point':r['point'],'observed_return_count':r['observed_return_count']}for r in ties],'evidence_refs':sorted({ref for r in ties for ref in returns.get(identity([f['grid'],r['point']]),[])})};predicted=model['own'];reason='contrast_equivalent_line_preparations_after_observed_return'if search['return_contrast']['choice_changed']else'prepare_visible_line_under_observed_local_and_remote_additions'
                search['scope']='Existing finite-horizon line search with a free-cell experimental domain. Full visible span and symmetric adverse objective are hypotheses; leaf values are weighted window heuristics, not proven wins.'
            else:point=list(min(vacant,key=lambda p:(-sum(p in w for w in windows),p)))
            options.append((model is None,f['geometry']['origin'][1],f['geometry']['origin'][0],f,point,model,trial,predicted,reason,search,length))
        if not options:return base
        _,_,_,f,point,model,trial,predicted,reason,search,length=min(options,key=lambda v:v[:3]);xy=center(f['geometry'],point);action={'action_ref':'ACTION6','data':dict(zip(('x','y'),xy))}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'field':f,'point':point,'pixel':xy,'command':copy.deepcopy(action),'trial':trial,'expected_motif':predicted,'model':model,'goal_length_hypothesis':length,'search':search,'scope':'Current exact cell patch and point. Empty role, local placement and alternating response require observed effects; full-span goal remains a hypothesis until official progression.'}
        ref='C_cell_placement_'+identity(plan)[:18];why=cfg['question'];evidence=[obs['observation_ref']]+(model.get('evidence',[])if model else[])+(search.get('return_contrast',{}).get('evidence_refs',[])if search else[]);facts={'framed_repeated_cell_geometry':True,'current_point_measured':True,'goal_and_free_placement_are_hypotheses':True}
        return {'status':'proposed','kind':'cell_patch_placement','proposal_id':ref,'cell_placement_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':{'local_patch':predicted,'response':'compatible observed motif or unknown','official_progress_required':True}}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles'],'goal_length_hypothesis':length},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('cell_placement_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and p['actions']==[plan['command']]and p['bundle_template']['actions']==p['actions']and plan['command']['action_ref']in meta['available']and center(plan['field']['geometry'],plan['point'])==[plan['command']['data']['x'],plan['command']['data']['y']]
        return {'admitted':ok,'reason':'current_cell_patch_point_bound'if ok else'cell_context_or_point_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('cell_placement_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch']or meta['score']!=plan['score']or meta['state']in('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        f=project(later,plan['field']['geometry']);x,y=plan['point'];expected=plan['expected_motif'];matched=None if expected is None else bool(f and f['grid'][y][x]==expected)
        key=str(plan['epoch'])+':'+plan['field']['ref']
        if matched is False and any(e['before_frame']==identity(later)for e in self.cell_paths.get(key,[])):return {'matched':None,'seal_prefix':True,'reason':'observed_whole_view_return_requires_dated_local_reconciliation'}
        return {'matched':matched,'seal_prefix':True,'reason':'cell_and_remote_response_require_reconciliation'}
    def record(self,before,cmd,after,rows,later,proposal,index):
        events=super().record(before,cmd,after,rows,later,proposal,index);plan=proposal.get('cell_placement_plan')
        if not plan:return events
        if cmd!=plan['command']:raise ValueError('Cell point differs from committed command')
        g=plan['field']['geometry']
        if g not in self.cell_geometries:self.cell_geometries.append(copy.deepcopy(g))
        outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state']);key=str(before['level_epoch'])+':'+plan['field']['ref']
        if rows==later:self.cell_refused.add(plan['trial'])
        if outcome['matched']is False and key in self.cell_models:self.cell_models[key]={**self.cell_models[key],'status':'refuted','counterexample':after['observation_ref']}
        returned=None;last=project(later,g)
        if last and after['level_epoch']==before['level_epoch']and after['levels_completed']==before['levels_completed']:
            path=self.cell_paths.setdefault(key,[]);path.append({'before_key':identity(plan['field']['grid']),'after_key':identity(last['grid']),'before_frame':identity(rows),'after_ref':after['observation_ref'],'choice_key':identity([plan['field']['grid'],plan['point']]),'command':cmd});returned=closed_observed_path_return(path)
            if returned:
                for edge in returned['path']:self.cell_returns.setdefault(key,{}).setdefault(edge['choice_key'],[]).append(after['observation_ref'])
                self.cell_paths[key]=[]
        events.append(self.emit_cell({'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'command':cmd,'field_ref':plan['field']['ref'],'outcome':outcome,'canonical_unchanged':rows==later,'observed_return':returned}));return events
    def record_packet(self,before,cmd,after,rows,frames,episode):
        events=super().record_packet(before,cmd,after,rows,frames,episode)
        if cmd['action_ref']!='ACTION6'or not cmd.get('data')or len(frames)<2:return events
        for f in fields(rows,self.cell_geometries):
            g=f['geometry'];points=[(x,y)for y,row in enumerate(f['grid'])for x,v in enumerate(row)if center(g,(x,y))==[cmd['data']['x'],cmd['data']['y']]]
            if len(points)!=1 or f['empty_hypothesis']is None:continue
            x,y=points[0];empty=f['grid'][y][x]
            if empty!=f['empty_hypothesis']:continue
            projections=[project(frame,g)for frame in frames];own=None;own_tick=None;other=None;other_tick=None
            for tick in range(len(projections)-1):
                a,b=projections[tick:tick+2]
                if not a or not b:continue
                delta=changes(f,a);stable=a['grid']==b['grid']
                if not stable:continue
                local=[v for v in delta if v[:2]==(x,y)and v[2]==empty]
                remote=[v for v in delta if v[:2]!=(x,y)]
                if len(local)==1 and not remote and not a['motifs'][local[0][3]]['uniform']and own is None:own=local[0][3];own_tick=tick
                if own is not None and tick>own_tick and len(local)==1 and local[0][3]==own and len(remote)==1 and remote[0][2]==empty and remote[0][3]!=own:other=remote[0][3];other_tick=tick;break
            if own is None or other is None:continue
            key=str(before['level_epoch'])+':'+f['ref'];prior=self.cell_models.get(key);entry={'status':'candidate','epoch':before['level_epoch'],'field_ref':f['ref'],'own':own,'other':other,'empty':empty,'evidence':[before['observation_ref'],after['observation_ref']],'ordered_frames':[own_tick,other_tick],'scope':'Stable local patch precedes one remote stable patch in this returned packet. Free-placement and symmetric line-goal law remain conditional.'}
            if prior and(prior['status']=='refuted'or(prior['own'],prior['other'],prior['empty'])!=(own,other,empty)):entry={'status':'refuted','counterexamples':[prior,entry]}
            self.cell_models[key]=entry;events.append(self.emit_cell({'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'command':cmd,'dated_order':[own_tick,other_tick],'model_status':entry['status']}))
        return events
