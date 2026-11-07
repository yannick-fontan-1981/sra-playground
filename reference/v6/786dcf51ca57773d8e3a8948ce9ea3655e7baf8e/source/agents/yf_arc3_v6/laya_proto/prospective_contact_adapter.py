"""Combine the existing terminal recall and optional pre-score experiment as separate providers."""
from passage_options import PassageOptions
from factored_return import factored_proposal
from goal_access_adapter import GoalAccessAdapter
from terminal_composition import GoalAccessMemory


class ContactMemory(GoalAccessMemory):
    def __init__(self):
        super().__init__()
        self.pre_score = PassageOptions()

    def apply_event(self,event):
        if event['kind'] in {'pre_score_effect_contact','pre_score_displacement_refuted','factored_rewrite_sample','factored_rewrite_scored','scored_rewrite_test','measured_lattice_steps','scored_passage_observation','passage_option_result'}:
            self.pre_score.apply_event(event)
        else:
            super().apply_event(event)

    def retained_state(self):
        return {**super().retained_state(),'pre_score_digest':self.pre_score.retained_digest()}


class ProspectiveContactAdapter(GoalAccessAdapter):
    def __init__(self):
        self.memory=ContactMemory()

    def propose_effect(self,obs,rows,inputs,remaining,config):
        if self.memory.models:
            return {'status':'abstained','reason':'terminal_hypothesis_retained'}
        return self.memory.pre_score.propose(self.memory.episode,obs,rows,inputs,min(16,remaining),config)

    def propose_factored(self,obs,inputs,remaining):
        if self.memory.models:return None
        return factored_proposal(self.memory.episode,obs,inputs,min(16,remaining))

    def propose_scored_rewrite(self,obs,rows,inputs,remaining,config):
        if self.memory.pre_score.model is None:return None
        p=self.memory.pre_score.propose(self.memory.episode,obs,rows,inputs,min(16,remaining),config)
        return p if p.get('kind')=='public_scored_rewrite' else None

    def propose_passage_options(self,obs,rows,inputs,remaining,config):
        if len(self.memory.pre_score.scores)<2:return None
        p=self.memory.pre_score.propose(self.memory.episode,obs,rows,inputs,min(16,remaining),config)
        return p if p.get('kind')=='public_passage_options' else None

    def before(self,proposal,index,rows,**metadata):
        if any(k in proposal for k in ('effect_plan','factor_plan','rewrite_plan','passage_plan')):
            return self.memory.pre_score.before(proposal,index,rows,**metadata)
        return super().before(proposal,index,rows,**metadata)

    def after(self,proposal,index,before_rows,after_rows,**metadata):
        if any(k in proposal for k in ('effect_plan','factor_plan','rewrite_plan','passage_plan')):
            return self.memory.pre_score.after(proposal,index,before_rows,after_rows,**metadata)
        return super().after(proposal,index,before_rows,after_rows,**metadata)

    def record(self,before,before_rows,command,after,after_rows,*,proposal,index):
        events=super().record(before,before_rows,command,after,after_rows,proposal=proposal,index=index)
        events.extend(self.memory.pre_score.record(before,command,after,before_rows,after_rows,proposal,index))
        return events
