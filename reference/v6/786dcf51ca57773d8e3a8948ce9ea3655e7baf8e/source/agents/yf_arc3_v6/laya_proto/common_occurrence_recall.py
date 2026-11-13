"""Current observed occurrence questions on the existing constraint provider."""
from common_program_composition import ProgramCompositionConstraint
from occurrence_recall_access import OccurrenceRecallAccess
from common_multiscale_constraints import projection,rows_digest
from terminal_composition import identity
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

class OccurrenceRecallConstraint(ProgramCompositionConstraint):
    def __init__(self):super().__init__();self.memory=OccurrenceRecallAccess()
    def recall_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        p=self.memory.recall_question(obs,rows,plain(config))
        if not p:return None
        plan=p['occurrence_recall_plan'];selected=plan['selected'];x,y=selected['point'];box=selected['bbox'];step=p['steps'][0]
        step['expected_before']={k:obs[k] for k in ('level_epoch','frame_hash','levels_completed','state')}
        step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-occurrence:'+selected['id'],'signature':identity(selected),'scope':'Current measured support plus full recall hypothesis/context guard. No role inferred from position alone.'}
        return p
    def bind(self,p,domain):
        if 'occurrence_recall_plan' not in p:return super().bind(p,domain)
        step=p['steps'][0];key=(step['expected_before']['level_epoch'],step['expected_before']['frame_hash']);assert key in domain.bindings
        support=step['point_support'];assert support['point']==[p['actions'][0]['data']['x'],p['actions'][0]['data']['y']]
        step['point_binding']=dict(support)
    def restore(self,state):
        rebuilt=OccurrenceRecallAccess()
        for e in state['events']:rebuilt.apply_event(e)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Occurrence/program memory changed during recall')
        self.memory=rebuilt;self.events=list(state['events'])
