"""Rebind a measured local shape rewrite after success of a factored material experiment."""
from collections import defaultdict
from factored_return import FactoredEffectAccess
from terminal_composition import identity


def local_rewrites(before,after):
    lookup={(tuple(e['bbox']),identity(e['mask'])):e for e in after['entities']}
    result=[]
    for e in before['entities']:
        box=e['bbox'];mask=identity(e['mask']);new=lookup.get((tuple(box),mask))
        if not new or new['palette_value']==e['palette_value']:continue
        result.append({'shape':mask,'source':e['palette_value'],'target':new['palette_value'],'size':[box[2]-box[0]+1,box[3]-box[1]+1]})
    return result


def scored_model(series,before,command):
    by_family=defaultdict(lambda:defaultdict(set))
    for e in series:
        for row in e['rewrites']:
            family=(row['source'],row['target'],*row['size'])
            by_family[family][row['shape']].add(e['action'])
    candidates=[]
    for (src,dst,w,h),observed in by_family.items():
        if len(observed)<2 or any(len(s)!=1 for s in observed.values()):continue
        labels={mask:next(iter(actions)) for mask,actions in observed.items()}
        if len(set(labels.values()))!=len(labels) or command in labels.values():continue
        at_boundary=[identity(e['mask']) for e in before['entities'] if e['palette_value']==src and
                     (e['bbox'][2]-e['bbox'][0]+1,e['bbox'][3]-e['bbox'][1]+1)==(w,h) and identity(e['mask']) not in labels]
        if len(at_boundary)!=1:continue
        model={'source':src,'target':dst,'size':[w,h],'labels':labels,'scoring_shape':at_boundary[0],'boundary_action':command,
               'epoch':before['level_epoch'],'boundary_ref':before['observation_ref'],'witnesses':[s['before'] for s in series]}
        candidates.append(((len(labels),w*h),model))
    if not candidates:return None
    rank=max(k for k,_ in candidates);best=[m for k,m in candidates if k==rank]
    return best[0] if len(best)==1 else None


class ScoredRewriteAccess(FactoredEffectAccess):
    def __init__(self):
        super().__init__();self.series={};self.model=None;self.refuted=set()

    def apply_event(self,e):
        if e['kind']=='factored_rewrite_sample':self.series.setdefault(e['proposal'],[]).append(e)
        elif e['kind']=='factored_rewrite_scored':self.model=e['model'];self.series={}
        elif e['kind']=='scored_rewrite_test':
            if e['outcome']=='refuted':self.refuted.add((e['epoch'],e['action']))
        else:super().apply_event(e)

    def retained_digest(self):
        return identity([super().retained_digest(),self.series,self.model,sorted(self.refuted)])

    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index)
        event=None;action=command['action_ref']
        if proposal.get('factor_plan'):
            key=proposal['proposal_id']
            if before['level_epoch']==after['level_epoch'] and proposal['factor_plan']['steps'][index]['expected_after'] is not None:
                if self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])['matched'] is True:
                    event={'kind':'factored_rewrite_sample','proposal':key,'before':before['observation_ref'],'action':action,'rewrites':local_rewrites(before,after)}
            elif after['levels_completed']>before['levels_completed']:
                model=scored_model(self.series.get(key,[]),before,action)
                if model:event={'kind':'factored_rewrite_scored','model':model,'after':after['observation_ref']}
        elif proposal.get('rewrite_plan'):
            result=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
            event={'kind':'scored_rewrite_test','epoch':before['level_epoch'],'action':action,
                   'outcome':'official_progress' if after['levels_completed']>before['levels_completed'] else 'matched' if result['matched'] else 'refuted',
                   'before':before['observation_ref'],'after':after['observation_ref'],'predicted_sites':len(proposal['rewrite_plan']['sites'])}
        if event:self.apply_event(event);events.append(event)
        return events

    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        model=self.model
        if not model or not config.get('rebind_scored_local_rewrites') or obs['level_epoch']<=model['epoch']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        choices=defaultdict(list);labels={**model['labels'],model['scoring_shape']:model['boundary_action']}
        available={a['action_ref'] for a in inputs if not a.get('data')}
        for e in obs['entities']:
            box=e['bbox']
            if e['palette_value']!=model['source'] or [box[2]-box[0]+1,box[3]-box[1]+1]!=model['size']:continue
            sig=identity(e['mask']);action=labels.get(sig)
            if action in available and (obs['level_epoch'],action) not in self.refuted:choices[action].append({'origin':box[:2],'mask':e['mask'],'shape':sig})
        if not choices:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        action=min(choices,key=lambda a:(-len(choices[a]),a));sites=choices[action]
        plan={'sites':sites,'action':action,'source':model['source'],'target':model['target'],'source_model':identity(model),'epoch':obs['level_epoch'],
              'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'qualification':'Prospective test of matching local supports at new positions; scoring witness alone did not show its post-rewrite.'}
        ref='C_test_scored_rewrite_'+identity(plan)[:18];cmd={'action_ref':action};facts={'local_supports_measured':True,'earlier_scoring_approach':True}
        why='Test whether the input paired with this shape in a scored approach rewrites all its currently matching local occurrences.'
        ev=[obs['observation_ref'],model['boundary_ref'],*model['witnesses']]
        return {'status':'proposed','kind':'public_scored_rewrite','proposal_id':ref,'rewrite_plan':plan,'actions':[cmd],'steps':[{'action':cmd,'expected_after':{'sites':sites,'target':model['target']}}],
                'facts':facts,'compositions':[{'id':ref,'observed':False,'role':'local_rewrite_question','open_question':why,'properties':{'matches':len(sites),'source_epoch':model['epoch']},'relations':['contributes_to:G_official_completion']}],
                'question':{'reason':'revalidate_scored_local_shape_rewrite','hypothesis_refs':ev},'route_refs':ev,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},
                'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[cmd],'purpose':why,'preconditions':facts,'evidence':ev,'outcome_guard':{'path':['value'],'contains':ref}}}

    @staticmethod
    def holds(plan,rows,palette):
        return all(rows[site['origin'][1]+dy][site['origin'][0]+dx]==palette for site in plan['sites'] for dx,dy in site['mask'])

    def before(self,p,index,rows,**meta):
        plan=p.get('rewrite_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=(index==0 and meta['epoch']==plan['epoch'] and meta['score']==plan['score'] and meta['observation_ref']==plan['observation_ref']
            and plan['action'] in meta['available'] and self.holds(plan,rows,plan['source']))
        return {'admitted':ok,'reason':'current_local_masks_bound' if ok else 'current_local_masks_or_scope_changed'}

    def after(self,p,index,before_rows,after_rows,**meta):
        plan=p.get('rewrite_plan')
        if not plan:return super().after(p,index,before_rows,after_rows,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        ok=self.holds(plan,after_rows,plan['target'])
        return {'matched':ok,'seal_prefix':True,'reason':'all_relocated_local_masks_rewritten' if ok else 'predicted_mask_rewrite_refuted'}
