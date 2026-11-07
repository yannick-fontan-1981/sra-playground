"""Bind a public boundary-derived hypothesis to guarded SRC compositions."""
from terminal_composition import GoalAccessMemory, check_access_before, check_access_after, identity


class GoalAccessAdapter:
    def __init__(self):
        self.memory=GoalAccessMemory()

    def propose(self,observation,rows,available,max_prefix):
        if not self.memory.models:
            return {'status':'abstained','reason':'no_scoring_boundary_model_observed_in_session'}
        route=self.memory.propose(observation,rows,available,max_prefix=min(16,max_prefix))
        if route.get('status')!='proposed':
            return {'status':'abstained','reason':route.get('status','no_bound_access')}
        if route.get('release_authority') is not False or route['observation_ref']!=observation['observation_ref'] or route['epoch']!=observation['level_epoch'] or route['score']!=observation['levels_completed']:
            raise ValueError('Goal access plan has a stale public binding or claims physical authority')
        prefix=route['prefix']
        if not 1<=len(prefix)<=min(16,max_prefix):
            raise ValueError('Goal access prefix exceeds the committed cap')
        allowed={'conditional_translation','conditional_observed_access','unknown_then_observe'}
        commands=[];steps=[]
        for index,step in enumerate(prefix):
            command={'action_ref':step['action_ref']}
            if not any(row['action_ref']==command['action_ref'] and not row.get('data') for row in available):
                raise ValueError('Prepared goal access refers to an unavailable input')
            if step['effect'] not in allowed or (index<len(prefix)-1 and step['effect']!='conditional_translation'):
                raise ValueError('An unmeasured or nonlocal effect must seal the prepared prefix')
            expected=None if step['effect']=='unknown_then_observe' else {'kind':'local_geometry','effect':step['effect'],
                'role':route['role'],'from':list(step['from']),'to':list(step['to'])}
            commands.append(command);steps.append({'action':command,'expected_after':expected,'qualification':'conditional public geometric prediction'})
        unresolved=prefix[-1]['effect']=='unknown_then_observe' or bool(route.get('test_tentative_control'))
        operation='OP18' if unresolved else 'OP28'
        plan_ref=identity(route);composition='C_goal_access_'+plan_ref[:20]
        purpose=('Observe the official score and local public response at the proposed contact after the measured approach.' if unresolved else
            'Access the proposed contact through measured local surfaces, comparing the public role support after each command.')
        evidence=[observation['observation_ref'],route['source_boundary'],'empirical_model:'+route['source_model_ref'],'committed_access:'+plan_ref]
        comp={'id':composition,'observed':False,'role':'hypothesized_scoring_or_enabling_composition',
            'things':[route['role']],'properties':{'proposed_site':route['site'],'kind':route['kind'],'source_model':route['source_model_ref'],
                'terminal_site':route['terminal_site'],'terminal_appearance':route['terminal_appearance'],'possible_effect_families':route['possible_effect_families'],
                'causal_terminal_role':'unknown','falsifiers':route['falsifiers']},'relations':['contributes_to:G_official_completion']}
        if unresolved:comp['open_question']=purpose
        facts={'official_goal_open':True,'model_bound_to_current_public_input':True}
        return {'status':'proposed','kind':'public_goal_access','proposal_id':'goal_access:'+plan_ref,'goal_access_plan':route,
            'actions':commands,'steps':steps,'facts':facts,'compositions':[comp],
            'question':{'reason':'conditional_access_to_scoring_or_enabling_hypothesis','hypothesis_refs':[route['source_model_ref']],
                'falsifiers':route['falsifiers'],'authority_transferred':False},'route_refs':evidence,
            'binding':{'observation_ref':observation['observation_ref'],'level_epoch':observation['level_epoch'],'levels_completed':observation['levels_completed']},
            'bundle_template':{'operation_key':operation,'composition_ref':composition,'objective_ref':'G_official_completion',
                'preserve_refs':[],'purpose':purpose,'actions':commands,'preconditions':facts,'evidence':evidence,
                'outcome_guard':{'path':['value'],'contains':composition if unresolved else 'B0'}}}

    def before(self,proposal,index,rows,*,epoch,score,available,observation_ref):
        return check_access_before(proposal['goal_access_plan'],index,rows,epoch=epoch,score=score,available=available,
            observation_ref=observation_ref if index==0 else None)

    def after(self,proposal,index,before_rows,after_rows,*,epoch,score,state):
        return check_access_after(proposal['goal_access_plan'],index,before_rows,after_rows,epoch=epoch,score=score,state=state)

    def record(self,before,before_rows,command,after,after_rows,*,proposal,index):
        selected=proposal.get('goal_access_plan')
        effect=proposal.get('effect_plan')
        return self.memory.record(before,before_rows,command,after,after_rows,plan=selected,action_index=index if selected else None,
            scoring_contact=(effect,index) if effect else None)
