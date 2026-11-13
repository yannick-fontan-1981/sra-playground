"""Test an emphasized member/control relation in homologous visible collections.

The cue is an experimental editing hypothesis, never a supplied terminal rule.
No palette, coordinate, program, game identifier or operator meaning is fixed.
"""
from collections import Counter,defaultdict
from geometric_observer import components
from terminal_composition import identity
from common_crossed_prefix import CrossedPrefixAccess,input_candidates as crossed_candidates
from observed_program_effects import align_program_packet

def border(rows,box):
    x,y,r,b=box
    if x<1 or y<1 or r+1>=len(rows[0]) or b+1>=len(rows):return None
    values={rows[v][u] for v in range(y-1,b+2) for u in range(x-1,r+2) if v in (y-1,b+1) or u in (x-1,r+1)}
    return next(iter(values)) if len(values)==1 else None

def measured_controls(rows):
    groups=defaultdict(list)
    for raw in components(rows):
        e={k:raw[k] for k in ('bbox','color','area')};x,y,r,b=e['bbox'];w,h=r-x+1,b-y+1
        if min(w,h)>=2 and w*h/2<=e['area']<w*h:groups[w,h,e['area'],y].append(e)
    families=[]
    for (w,h,area,y),es in groups.items():
        if len(es)<3 or len({e['color'] for e in es})<3:continue
        ordered=sorted(es,key=lambda e:e['bbox'][0]);steps={b['bbox'][0]-a['bbox'][0] for a,b in zip(ordered,ordered[1:])}
        if len(steps)==1 and min(steps)>w:families.append(ordered)
    return families[0] if len(families)==1 else []

def rectangular_members(rows,examples,palette,limit):
    """Measure a rectangular support even when an external pixel touches it."""
    x,y,r,b=examples[0]['bbox'];w,h=r-x+1,b-y+1;result=[];v=0
    while v<limit:
        values=set(rows[v][x:x+w])
        if len(values)!=1 or next(iter(values)) not in palette:v+=1;continue
        color=next(iter(values));start=v
        while v<limit and set(rows[v][x:x+w])=={color}:v+=1
        if v-start==h:result.append({'bbox':[x,start,x+w-1,v-1],'color':color,'area':w*h})
    return result

def collection_scene(rows):
    groups=defaultdict(list)
    for e in components(rows):
        e={k:e[k] for k in ('bbox','color','area')}
        x,y,r,b=e['bbox'];w,h=r-x+1,b-y+1
        if min(w,h)>=2 and e['area']>=w*h/2:groups[w,h,e['area']].append(e)
    controls=[];members=[]
    for (w,h,area),es in groups.items():
        if len(es)<2:continue
        if len({e['bbox'][1] for e in es})==1 and len(es)>=3 and area<w*h:
            ordered=sorted(es,key=lambda e:e['bbox'][0]);steps={b['bbox'][0]-a['bbox'][0] for a,b in zip(ordered,ordered[1:])}
            if len(steps)==1 and min(steps)>w:controls.append(ordered)
        if len({e['bbox'][0] for e in es})==1 and area==w*h:
            ordered=sorted(es,key=lambda e:e['bbox'][1]);steps={b['bbox'][1]-a['bbox'][1] for a,b in zip(ordered,ordered[1:])}
            if min(steps)>h and all(step%min(steps)==0 for step in steps):members.append(ordered)
    layouts=[]
    for cs in controls:
        palette={e['color'] for e in cs}
        if len(palette)<3:continue
        marked_controls=[e for e in cs if border(rows,e['bbox']) is not None]
        if len(marked_controls)>1:continue
        for ms in members:
            if not {e['color'] for e in ms}<=palette:continue
            ms=rectangular_members(rows,ms,palette,min(e['bbox'][1] for e in cs))
            marked_members=[e for e in ms if border(rows,e['bbox']) is not None]
            if len(marked_members)>1:continue
            if marked_members and marked_controls and border(rows,marked_members[0]['bbox'])!=border(rows,marked_controls[0]['bbox']):continue
            layouts.append({'controls':cs,'members':ms,'marked_controls':marked_controls,'marked_members':marked_members,'palette':sorted(palette)})
    return layouts[0] if len(layouts)==1 else None

def input_candidates(rows,available):
    prior=crossed_candidates(rows,available)
    if 'ACTION6' not in available:return prior
    # The control row is observable independently of an empty collection.
    for e in measured_controls(rows):
        x,y,r,b=e['bbox'];prior.append({'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}})
    scene=collection_scene(rows)
    if scene:
        for e in scene['marked_members']+scene['marked_controls']:
            x,y,r,b=e['bbox'];prior.append({'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}})
    unique={identity(a):a for a in prior};return list(unique.values())

class MarkedCollectionAccess(CrossedPrefixAccess):
    def __init__(self):super().__init__();self.marked_events=[];self.program_events=[]
    def apply_event(self,e):
        if e['kind']=='marked_collection_result':self.marked_events.append(e)
        elif e['kind']=='public_program_phase_alignment':self.program_events.append(e)
        else:super().apply_event(e)
    def retained_digest(self):return identity([super().retained_digest(),self.marked_events,self.program_events])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        if config.get('marked_collection_edit'):
            p=self.marked_question(obs,rows,inputs)
            if p:return p
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def marked_question(self,obs,rows,inputs):
        scene=collection_scene(rows)
        if scene is None:return None
        recent=[e for e in self.marked_events if e['epoch']==obs['level_epoch']]
        if any(e['outcome']['matched'] is False for e in recent):return None
        members=scene['members'];marked=scene['marked_members']
        if marked and scene['marked_controls']:mode='remove';entity=marked[0]
        elif scene['marked_controls']:mode='insert';entity=scene['marked_controls'][0]
        elif recent and recent[-1]['mode'] in ('remove','insert') and recent[-1]['outcome']['matched']:
            actions=[a for a in obs['available_action_refs'] if a in {'ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'}]
            if len(actions)!=1:return None
            mode='execute';entity=None;action={'action_ref':actions[0]}
        else:return None
        if entity:
            if 'ACTION6' not in obs['available_action_refs']:return None
            x,y,r,b=entity['bbox'];action={'action_ref':'ACTION6','data':{'x':(x+r)//2,'y':(y+b)//2}}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'mode':mode,'action':action,'entity':entity,'scene':scene,
              'before_collection':[e['color'] for e in members],'scope':'Visible emphasis and shared appearances suggest an edit; the exact insertion/removal must be confirmed. A subsequent unique nonpoint input is only an execution experiment, with terminal role unknown.'}
        ref='C_marked_collection_'+identity(plan)[:18];why={'remove':'Test removal of an emphasized member before inserting the independently emphasized control contribution.','insert':'Test whether the emphasized control inserts its appearance in the related collection.','execute':'Test the only available nonpoint input after a confirmed visible collection edit; observe whether the collection governs an effect elsewhere.'}[mode]
        facts={'homologous_collection_and_controls':True,'current_edit_or_execution_question':True};evidence=[obs['observation_ref']]
        return {'status':'proposed','kind':'marked_collection_edit','proposal_id':ref,'marked_collection_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':{'mode':mode,'before_collection':plan['before_collection']}}],'facts':facts,
                'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'mode':mode},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'test_visible_collection_edit','hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':plan['epoch'],'observation_ref':plan['observation_ref']},
                'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('marked_collection_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (plan['epoch'],plan['score'],plan['observation_ref'])==(meta['epoch'],meta['score'],meta['observation_ref']) and plan['action']['action_ref'] in meta['available'] and identity(rows)==plan['frame_digest']
        return {'admitted':ok,'reason':'measured_collection_question_bound' if ok else 'collection_context_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('marked_collection_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        if meta['epoch']!=plan['epoch'] or meta['score']!=plan['score'] or meta['state'] in ('WIN','GAME_OVER'):return {'matched':None,'seal_prefix':True,'reason':'official_boundary_or_terminal'}
        if plan['mode']=='execute':return {'matched':None,'seal_prefix':True,'reason':'execution_effect_observed_without_terminal_model','public_changed':identity(rows)!=identity(later)}
        scene=collection_scene(later);expected=Counter(plan['before_collection']);color=plan['entity']['color'];expected[color]+=1 if plan['mode']=='insert' else -1;expected=+expected
        actual=Counter(e['color'] for e in scene['members']) if scene else None;ok=actual==expected
        return {'matched':ok,'seal_prefix':True,'reason':'collection_edit_confirmed' if ok else 'collection_edit_refuted','expected_member_count':sum(expected.values()),'observed_member_count':sum(actual.values()) if actual is not None else None}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('marked_collection_plan')
        if not plan:return events
        outcome=self.after(proposal,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
        e={'kind':'marked_collection_result','epoch':before['level_epoch'],'mode':plan['mode'],'command':command,'before_collection':plan['before_collection'],'outcome':outcome,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(e);return events+[e]
    def record_packet(self,before,command,after,rows,packet,episode):
        events=super().record_packet(before,command,after,rows,packet,episode)
        if len(packet)<2:return events
        scene=collection_scene(rows)
        if not scene:return events
        alignment=align_program_packet(rows,packet,members=scene['members'],controls=scene['controls'],observation_ref=before['observation_ref'],epoch=before['level_epoch'],command_ref=command['action_ref'],after_observation_ref=after['observation_ref'])
        if alignment['status']!='phase_aligned_candidates':return events
        event={'kind':'public_program_phase_alignment','alignment':alignment,'evidence':[before['observation_ref'],after['observation_ref']]};self.apply_event(event);return events+[event]
