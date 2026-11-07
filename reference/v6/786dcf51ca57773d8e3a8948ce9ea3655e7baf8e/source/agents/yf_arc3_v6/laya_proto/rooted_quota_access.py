"""Acquire an indexed edit, then request conditional integer-prefix composition."""
from copy import deepcopy
from service_transfer_access import ServiceTransferAccess,input_candidates
from rooted_chain_observation import scene
from rooted_quota_methods import propagate,step
from terminal_composition import identity
def lengths(rows,s,model):
    out=[]
    for c in s['chains']:
        bits=[]
        for x,y in c['points']:
            v=rows[y][x]
            if v==s['empty_content_palette']:bits.append(0)
            elif model.get('fill_palette')==v:bits.append(1)
            else:return None
        n=sum(bits)
        if bits!=[1]*n+[0]*(len(bits)-n):return None
        out.append(n)
    return out
class RootedQuotaAccess(ServiceTransferAccess):
    def __init__(self):super().__init__();self.quota_events=[];self.quota_model={};self.quota_context=None
    def retained_digest(self):return identity([super().retained_digest(),self.quota_events,self.quota_model,self.quota_context])
    def apply_event(self,e):
        if e['kind']=='rooted_quota_state':self.quota_events.append(e);self.quota_model=e['model'];self.quota_context=e['context'];self.requested_stop_reason=e['stop_reason'];return
        super().apply_event(e)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('rooted_quota_question')
        if not cfg or'ACTION6'not in obs['available_action_refs']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        s=scene(rows,self.quota_model.get('empty_palette'))
        if s is None:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        model=self.quota_model;current=lengths(rows,s,model)
        if current is None:return {'status':'abstained','reason':'rooted_content_not_a_measured_prefix'}
        operations=[];method=None;steps=[];deadline=config['level_deadline']
        if not model.get('addition_observed'):
            i=max(range(len(s['chains'])),key=lambda j:len(s['chains'][j]['cells']));rank=len(s['chains'][i]['cells'])-1;operations=[(i,rank,None)];phase='discriminate_local_effect_from_rooted_prefix'
        elif not model.get('cut_observed'):
            candidates=[i for i,n in enumerate(current)if n>=2]
            if not candidates:return {'status':'abstained','reason':'no_observed_long_prefix_for_cut_contrast'}
            i=candidates[0];rank=current[i]//2;operations=[(i,rank,None)];phase='discriminate_truncation_from_repeated_toggle'
        else:
            method=propagate(s,obs,model,deadline)
            if method['status']!='COMPLETE'or not method['values'].get('all_domains_singleton'):return {'status':'abstained','reason':'conditional_prefix_marginals_not_singleton'}
            desired=[d[0]for d in method['values']['retained_domains']];working=list(current);phase='realize_conditional_joint_prefixes'
            for i,n in enumerate(desired):
                if n==working[i]:continue
                rank=n-1 if n>working[i]else n;receipt=step(s,working,i,rank,obs,model,deadline)
                if receipt['status']!='COMPLETE':return {'status':'abstained','reason':'conditional_indexed_step_not_complete'}
                after=receipt['values']['filled_lengths'];operations.append((i,rank,{'before':working,'after':after,'method':receipt}));working=list(after)
                if len(operations)>=max_prefix:break
            if not operations:return {'status':'abstained','reason':'marginals_satisfied_without_official_score'}
        actions=[]
        for i,rank,prediction in operations:
            point=s['chains'][i]['points'][rank];command={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))};actions.append(command);steps.append({'action':command,'chain':i,'rank':rank,'prediction':prediction,'expected_after':None})
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':s,'lengths_before':current,'phase':phase,'model':deepcopy(model),'method':method};ref='C_rooted_'+identity(plan)[:20];why=cfg['question']+' Current question: '+phase;facts={'measured_chain_partition':True,'measured_mark_units':True,'scoped_edit_examples':bool(model.get('addition_observed')and model.get('cut_observed'))};ev=[obs['observation_ref']]+model.get('evidence',[]);bundle='B0'
        return {'status':'proposed','kind':'rooted_quota_experiment','proposal_id':ref,'rooted_quota_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':phase,'hypothesis_refs':ev},'route_refs':ev,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':actions,'purpose':why,'preconditions':facts,'evidence':ev,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('rooted_quota_plan')
        if not plan:return super().before(p,index,rows,**meta)
        st=p['steps'][index];point=plan['scene']['chains'][st['chain']]['points'][st['rank']];ok=meta['epoch']==plan['epoch']and meta['score']==plan['score']and'ACTION6'in meta['available']and p['actions'][index]=={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))}
        if index==0:ok=ok and meta['observation_ref']==plan['observation_ref']and identity(rows)==plan['frame_digest']
        else:ok=ok and st['prediction']is not None and lengths(rows,plan['scene'],plan['model'])==st['prediction']['before']
        return {'admitted':bool(ok),'reason':'current_rooted_composition_bound'if ok else'rooted_context_or_predicted_prefix_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('rooted_quota_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch']or meta['score']>plan['score']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary','official_progress':True}
        pred=p['steps'][index]['prediction'];matched=lengths(later,plan['scene'],plan['model'])==pred['after']if pred else None
        return {'matched':matched,'seal_prefix':matched is not True,'reason':'conditional_prefix_matched'if matched else'unknown_or_divergent_indexed_edit','official_progress':False}
    def record(self,before,command,after,rows,later,proposal,index):
        p=proposal.get('rooted_quota_plan')
        if not p:return super().record(before,command,after,rows,later,proposal,index)
        model=deepcopy(self.quota_model);st=proposal['steps'][index];s=p['scene'];refs=[before['observation_ref'],after['observation_ref']];stop=None;ctx=None
        if before['level_epoch']==after['level_epoch']:
            model.setdefault('empty_palette',s['empty_content_palette']);i,rank=st['chain'],st['rank'];old=lengths(rows,s,model)
            colors={later[y][x]for c in s['chains']for x,y in c['points']if later[y][x]!=s['empty_content_palette']}
            if 'fill_palette'not in model and len(colors)==1:model['fill_palette']=next(iter(colors))
            new=lengths(later,s,model);preserved=old is not None and new is not None and all(a==b for j,(a,b)in enumerate(zip(old,new))if j!=i)
            if not preserved:stop='indexed_edit_owner_or_prefix_refuted'
            elif old[i]<=rank and new[i]==rank+1:model['addition_observed']=True
            elif old[i]>rank and new[i]==rank:model['cut_observed']=True
            else:stop='indexed_edit_response_not_supported'
            ctx={'epoch':after['level_epoch'],'lengths':new,'effect_evidence':refs,'owner_preserved':preserved}
        else:model['official_quota_witness']=refs
        model['evidence']=model.get('evidence',[])+refs;e={'kind':'rooted_quota_state','model':model,'context':ctx,'stop_reason':stop,'evidence':refs,'scope':'Observed current addition/cut examples. Root, numeric clue semantics and transfer remain conditional; no universal edit or terminal law.'};self.apply_event(e);return[e]
