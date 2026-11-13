"""Recombine independently observed display changes following a real recurrence."""
from collections import defaultdict
import hashlib
from terminal_composition import identity
from effect_access import EffectAccess


def partition(rows,axis,indices):
    h=[hashlib.sha256(),hashlib.sha256()]
    if axis=='row':
        for y,line in enumerate(rows):h[y in indices].update(bytes(line))
    else:
        for x in range(len(rows[0])):h[x in indices].update(bytes(line[x] for line in rows))
    return tuple(value.hexdigest() for value in h)


def measured_partitions(transitions):
    groups=defaultdict(list)
    for before,action,after in transitions:
        cells=[(x,y,u,v) for y,(a,b) in enumerate(zip(before.rows,after.rows)) for x,(u,v) in enumerate(zip(a,b)) if u!=v]
        if not cells:continue
        ox=min(x for x,y,u,v in cells);oy=min(y for x,y,u,v in cells)
        shape=tuple((x-ox,y-oy,u,v) for x,y,u,v in cells)
        groups[shape].append((ox,oy,action,before.ref))
    candidates=[]
    for shape,events in groups.items():
        if len({a for x,y,a,r in events})<2 or len({(x,y) for x,y,a,r in events})<3:continue
        for axis in ('row','column'):
            coords={y if axis=='row' else x for x,y,a,r in events}
            if len(coords)!=1:continue
            start=next(iter(coords));indices=sorted({start+(y if axis=='row' else x) for x,y,u,v in shape})
            candidates.append((axis,indices,[r for x,y,a,r in events]))
    return candidates


def factored_proposal(episode,obs,inputs,limit):
    if len(episode)<4 or obs['frame_hash']!=episode[0][0].frame_hash or episode[-1][0].frame_hash==obs['frame_hash']:return None
    # Attribute transitions only inside the same public epoch and score.
    if any((b.epoch,b.score)!=(obs['level_epoch'],obs['levels_completed']) or (a.epoch,a.score)!=(b.epoch,b.score) for b,_,a in episode):return None
    start=max(i for i,(b,_,a) in enumerate(episode) if b.frame_hash==obs['frame_hash'])
    excursion=episode[start:]
    candidates=measured_partitions(excursion[:-1])
    if len(candidates)!=1:return None
    axis,indices,evidence=candidates[0];cache={}
    def key(s):
        if s.frame_hash not in cache:cache[s.frame_hash]=partition(s.rows,axis,indices)
        return cache[s.frame_hash]
    available={a['action_ref'] for a in inputs if not a.get('data')};band_edges=defaultdict(set);trials=defaultdict(set);forward=[]
    for before,action,after in excursion[:-1]:
        b0,b1=key(before);a0,a1=key(after)
        if a1==b1:return None
        band_edges[b1].add(a1);trials[b0].add(action)
        if b0!=a0:forward.append((b0,action,a0,before.ref))
    if len(forward)<2 or len(forward)+1>limit:return None
    if len({b for b,_,a,r in forward}|{forward[-1][2]})!=len(forward)+1:return None
    if any(left[2]!=right[0] for left,right in zip(forward,forward[1:])):return None
    anchor,band=key(excursion[0][0]);last_body=key(excursion[-1][0])[0]
    if forward[0][0]!=anchor or forward[-1][2]!=last_body:return None
    trials[last_body].add(excursion[-1][1]);unused=available-trials[last_body]
    if not unused:return None
    paths={a for b,a,t,r in forward}
    # The unused label is an experiment after distinct measured labels, never a proven bijection.
    novel=unused-paths
    if len(novel)!=1 or len(paths)!=len(forward):return None
    steps=[]
    for body,action,dest,ref in forward:
        if action not in available or len(band_edges[band])!=1:return None
        new_band=next(iter(band_edges[band]))
        steps.append({'action_ref':action,'before':[body,band],'expected_after':[dest,new_band],'source':ref})
        band=new_band
    steps.append({'action_ref':next(iter(novel)),'before':[last_body,band],'expected_after':None,'source':excursion[-1][0].ref})
    plan={'axis':axis,'indices':indices,'steps':steps,'level_epoch':obs['level_epoch'],'score':obs['levels_completed'],
          'observation_ref':obs['observation_ref'],'channel_witnesses':evidence,'return_ref':excursion[-1][2].ref,
          'scope':'Only the combination of two independently observed display projections is forecast; both must match at each step.'}
    ref='C_factored_return_'+identity(plan)[:18];actions=[{'action_ref':s['action_ref']} for s in steps]
    why='Reproduce the measured sequence of material changes while testing each independent display projection, then sample the one unused input at the open state.'
    refs=[obs['observation_ref'],*evidence,*[s['source'] for s in steps]];facts={'exact_return':True,'distinct_translated_channel':True,'observed_material_chain':True}
    return {'status':'proposed','kind':'public_factored_return','proposal_id':ref,'factor_plan':plan,'actions':actions,
            'steps':[{'action':cmd,'expected_after':s['expected_after']} for cmd,s in zip(actions,steps)],'facts':facts,'compositions':[
                {'id':ref,'observed':False,'role':'factored_access_question','open_question':why,'properties':{'falsifier':plan['scope']},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':'material_chain_and_independent_drift','hypothesis_refs':refs},'route_refs':refs,
            'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],
                  'actions':actions,'evidence':refs,'preconditions':facts,'purpose':why,'outcome_guard':{'path':['value'],'contains':ref}}}


class FactoredEffectAccess(EffectAccess):
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        base=super().propose(episode,obs,rows,inputs,max_prefix,config)
        if base['status']=='proposed' or not config.get('test_factored_return'):return base
        return factored_proposal(episode,obs,inputs,max_prefix) or base

    def before(self,proposal,index,rows,**meta):
        plan=proposal.get('factor_plan')
        if not plan:return super().before(proposal,index,rows,**meta)
        s=plan['steps'][index];actual=list(partition(rows,plan['axis'],plan['indices']))
        ok=(meta['epoch']==plan['level_epoch'] and meta['score']==plan['score'] and s['action_ref'] in meta['available'] and
            (index>0 or meta['observation_ref']==plan['observation_ref']) and actual==s['before'])
        return {'admitted':ok,'reason':'complete_partition_bound' if ok else 'partition_or_scope_changed'}

    def after(self,proposal,index,before_rows,after_rows,**meta):
        plan=proposal.get('factor_plan')
        if not plan:return super().after(proposal,index,before_rows,after_rows,**meta)
        if meta['epoch']!=plan['level_epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        predicted=plan['steps'][index]['expected_after']
        if predicted is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_alternative_observed'}
        match=list(partition(after_rows,plan['axis'],plan['indices']))==predicted
        return {'matched':match,'seal_prefix':not match or index+1==len(plan['steps']),'reason':'both_current_channels_matched' if match else 'partition_forecast_diverged'}
