"""C adapter: measured program questions share the existing field provider."""
from common_crossed_prefix import CrossedPrefixConstraint
from program_respondent_access import ProgramRespondentAccess
from common_multiscale_constraints import projection,rows_digest
from terminal_composition import identity


class ProgramCompositionConstraint(CrossedPrefixConstraint):
    def __init__(self):self.memory=ProgramRespondentAccess();self.events=[];self.level_deadline=None
    def program_propose(self,obs,rows,inputs,remaining):
        if remaining<1:return None
        if self.memory.composition_models and self.level_deadline is None:raise ValueError('Program search requires the current level deadline')
        config={'remaining_level_actions':remaining,'level_deadline':self.level_deadline}
        p=self.memory.program_question(obs,rows,min(16,remaining),config)
        if p is None:p=self.memory.marked_question(obs,rows,inputs)
        if p is None:return None
        p['steps'][0]['expected_before']={k:obs[k] for k in ('level_epoch','frame_hash','levels_completed','state')}
        for index,action in enumerate(p['actions']):
            if action['action_ref']!='ACTION6':continue
            x,y=action['data']['x'],action['data']['y'];plan=p.get('program_composition_plan') or p.get('respondent_probe_plan') or p.get('marked_collection_plan')
            if not plan or not(0<=y<len(rows) and 0<=x<len(rows[0])):raise ValueError('Program point lacks public composition')
            box=[x,y,x,y]
            if 'entity' in plan and plan['entity']:box=plan['entity']['bbox']
            elif p.get('program_composition_plan') and plan['steps'][index]['mode']=='remove':box=plan['steps'][index]['member_box']
            elif plan.get('layout'):
                matches=[c for c in plan['layout']['controls'] if c['bbox'][0]<=x<=c['bbox'][2] and c['bbox'][1]<=y<=c['bbox'][3]]
                if len(matches)!=1:raise ValueError('Program input is not one current measured control')
                box=matches[0]['bbox']
            p['steps'][index]['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-program-input:'+identity([box,[x,y],rows_digest(projection(rows,box))]),'signature':identity([plan,action,index]),'scope':'Composition-derived observed control/member support, rechecked before this primitive; program/prefix guards are additional.'}
        return p
    def bind(self,p,domain):
        if not any(k in p for k in ('marked_collection_plan','program_composition_plan','respondent_probe_plan')):return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];key=first['level_epoch'],first['frame_hash']
        if key not in domain.bindings:raise ValueError('Program input domain not currently observed')
        for action,step in zip(p['actions'],p['steps']):
            if action['action_ref']!='ACTION6':continue
            support=step['point_support']
            if support['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Program payload differs from its current public support')
            step['point_binding']=dict(support)
    def restore(self,state):
        rebuilt=ProgramRespondentAccess()
        for e in state['events']:rebuilt.apply_event(e)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Observed program memory changed during recall')
        self.memory=rebuilt;self.events=list(state['events'])
