"""Observed compositions, open experiments and provisional remembered accesses.

Public hashes index observations; they never establish hidden-state equivalence.
State is persisted as append-only deltas. Only the chosen bounded composition
and path are returned to SRC. This is an information frontier, not a solver of
unobserved terminal semantics, and it neither dispatches nor authorizes IO.
"""
from __future__ import annotations
import copy
import hashlib
import json
from collections import deque
from pathlib import Path
from common_mechanisms import predict_candidate_rule
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds

SCHEMA='prototype.observed_frontier.v1'
FORBIDDEN={'game_id','game_name','planner_name','oracle','oracle_path','winning_route','visual_goal'}

def _pack(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def _hash(value):return hashlib.sha256(_pack(value).encode()).hexdigest()
def _action(action):
    if FORBIDDEN&action.keys() or not action.get('action_ref'):raise ValueError('Neutral admitted action required')
    result={'action_ref':action['action_ref']}
    if action.get('data'):result['data']=copy.deepcopy(action['data'])
    return result
def _action_key(action):return _hash(_action(action))

def _protocol(obs):
    if FORBIDDEN&obs.keys():raise ValueError('Game/oracle labels excluded from frontier observations')
    required=('level_epoch','frame_hash','state','levels_completed','available_action_refs')
    if any(k not in obs for k in required):raise ValueError('Public protocol projection incomplete')
    return {k:sorted(obs[k]) if k=='available_action_refs' else obs[k] for k in required}

def _index(obs):return 'observation-index:'+_hash(_protocol(obs))
def _ref(obs):
    if not obs.get('observation_ref'):raise ValueError('Observation occurrence reference required')
    return str(obs['observation_ref'])

def _rules(assessment):
    result=[]
    for rule in assessment.get('empirical_rules',[])+assessment.get('property_rules',[]):
        conditions=rule.get('conditions',{});action=conditions.get('action',conditions.get('action_template',{}));scope=rule.get('scope',{})
        epochs=[]
        for mode in [scope.get('mode',{}),scope.get('observable_mode',{})]+rule.get('validated_contexts',[]):
            if 'level_epoch' in mode:epochs.append(mode['level_epoch'])
        for evidence in rule.get('validation_evidence',[]):
            if 'level_epoch' in evidence.get('observable_context',{}):epochs.append(evidence['observable_context']['level_epoch'])
        result.append({'rule_id':rule['rule_id'],'status':rule['status'],'action_ref':action.get('action_ref'),
            'scope_epochs':sorted(set(epochs)),'counterexample_count':len(rule.get('counterexamples',[])),
            'evidence_refs':rule.get('evidence_refs',[])[-4:],'rule_family':rule.get('rule_family','unknown'),
            'causal_authority':'not_inferred_from_status_or_storage'})
    return result

class ObservedFrontier:
    def __init__(self,target_levels=3,max_prefix=16,state=None):
        if not 1<=max_prefix<=16:raise ValueError('Prefix must be bounded by 16')
        self.target_levels=target_levels;self.max_prefix=max_prefix;self.nodes={};self.observations={};self.edges={};self.rules={}
        self._candidate_context=None;self._candidate_checks={}
        policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_bytes())
        self._candidate_admission=policy['selection']['candidate_question_admission']
        self.knowledge_revision=0;self.sequence=0;self.chain=None;self.pending=None;self.navigation_trials={};self.action_counts={};self._deltas=[]
        if state is not None:
            if state.get('schema')!=SCHEMA:raise ValueError('Unsupported frontier snapshot')
            for key in ('target_levels','max_prefix','nodes','observations','edges','rules','knowledge_revision','sequence','chain','pending','navigation_trials','action_counts'):
                setattr(self,key,copy.deepcopy(state[key]))

    def _commit(self,kind,payload):
        event={'schema':SCHEMA,'sequence':self.sequence+1,'previous_digest':self.chain,'kind':kind,'payload':copy.deepcopy(payload)}
        event['digest']=_hash(event);self.apply_delta(event);self._deltas.append(event);return event

    def apply_delta(self,event):
        """Restore one verified delta without generating another persistence event."""
        base={k:v for k,v in event.items() if k!='digest'}
        if event.get('schema')!=SCHEMA or event['sequence']!=self.sequence+1 or event['previous_digest']!=self.chain or event['digest']!=_hash(base):raise ValueError('Frontier delta chain/order mismatch')
        p=event['payload'];kind=event['kind']
        if kind=='observation':
            key=p['index'];node=self.nodes.setdefault(key,{'protocol':p['protocol'],'composition_ref':'C_observed_'+key.split(':')[1][:16],'occurrences':[],'actions':{},'attempts':{},'measurement_summary':p['measurement_summary']})
            node['occurrences'].append(p['observation_ref'])
            if p['action_candidates'] is not None:node['actions']={_action_key(a):a for a in p['action_candidates']}
            self.observations[p['observation_ref']]={'index':key,'knowledge_revision':p['knowledge_revision']}
        elif kind=='domain':self.nodes[p['index']]['actions']={_action_key(a):a for a in p['actions']}
        elif kind=='transition':
            node=self.nodes[p['source']];attempt=node['attempts'].setdefault(p['action_key'],{'count':0,'outcomes':{},'evidence_refs':[],'assessment':{}})
            attempt['count']+=1;attempt['outcomes'][p['target']]=attempt['outcomes'].get(p['target'],0)+1;attempt['evidence_refs'].append(p['transition_ref']);attempt['assessment']=p['assessment']
            edge=self.edges.setdefault(p['edge_id'],{'edge_id':p['edge_id'],'source':p['source'],'target':p['target'],'action':p['action'],'action_key':p['action_key'],'evidence_refs':[]})
            edge['evidence_refs'].append(p['transition_ref'])
            count_key=str(node['protocol']['level_epoch'])+':'+p['action_key'];self.action_counts[count_key]=self.action_counts.get(count_key,0)+1
            for rule in p['rules']:
                old=self.rules.get(rule['rule_id'])
                if old is None or any(old.get(k)!=rule.get(k) for k in ('status','scope_epochs','counterexample_count')):self.knowledge_revision+=1
                self.rules[rule['rule_id']]=rule
            if p.get('navigation_trial'):
                key=p['navigation_trial'];self.navigation_trials[key]=self.navigation_trials.get(key,0)+1
            if self.pending and p.get('proposal_id')==self.pending['proposal_id']:self.pending['executed']+=1
        elif kind=='proposal':self.pending={**p,'executed':0}
        else:raise ValueError('Unknown frontier delta kind')
        self.sequence=event['sequence'];self.chain=event['digest']

    def drain_deltas(self):
        events=self._deltas;self._deltas=[];return events

    def snapshot(self):
        """Checkpoint/restore only: never copy this full graph into action context."""
        return {'schema':SCHEMA,**{k:copy.deepcopy(getattr(self,k)) for k in ('target_levels','max_prefix','nodes','observations','edges','rules','knowledge_revision','sequence','chain','pending','navigation_trials','action_counts')}}

    def observe(self,observation,action_candidates=None):
        index=_index(observation);ref=_ref(observation);protocol=_protocol(observation)
        if action_candidates is not None:
            if len(action_candidates)>256:raise ValueError('Admitted experiment domain exceeds bound')
            actions=[_action(a) for a in action_candidates]
            if len({_action_key(a) for a in actions})!=len(actions):raise ValueError('Duplicate admitted input')
            if any(a['action_ref'] not in protocol['available_action_refs'] for a in actions):raise ValueError('Input outside current public availability')
        else:actions=None
        if ref in self.observations:
            if self.observations[ref]['index']!=index:raise ValueError('Observation reference rebound to different public measurement')
            if actions is not None and self.nodes[index]['actions']!={_action_key(a):a for a in actions}:self._commit('domain',{'index':index,'actions':actions})
        else:
            self._commit('observation',{'index':index,'observation_ref':ref,'protocol':protocol,'knowledge_revision':self.knowledge_revision,
                'action_candidates':actions,'measurement_summary':{'entity_count':len(observation['entities']) if 'entities' in observation else None,'coordinate_basis':observation.get('coordinate_basis','unknown'),'observation_ref':ref}})
        return {'observation_index':index,'composition_ref':self.nodes[index]['composition_ref'],'observation_ref':ref,'knowledge_revision':self.knowledge_revision,
            'index_meaning':'retrieval_of_public_projection; hidden_state_equivalence_not_established'}

    def record_transition(self,before,action,after,*,assessment=None,after_action_candidates=None):
        source=self.observe(before)['observation_index'];target=self.observe(after,after_action_candidates)['observation_index'];action=_action(action);key=_action_key(action)
        if action['action_ref'] not in _protocol(before)['available_action_refs']:raise ValueError('Recorded action outside observed public availability')
        transition_ref='transition:'+_hash([_ref(before),action,_ref(after)])
        if any(transition_ref in e['evidence_refs'] for e in self.edges.values()):return {'status':'duplicate_transition_not_counted','transition_ref':transition_ref}
        assessment=assessment or {}
        if assessment.get('evidence_refs') and assessment['evidence_refs']!=[_ref(before),_ref(after)]:raise ValueError('Library assessment is bound to other observation occurrences')
        library=assessment.get('library',{})
        summary={'library_status':library.get('status','unknown'),'compatible_models':sorted({m.get('model') for m in library.get('compatible',[]) if m.get('model')}),
            'refuted_models':sorted({m.get('model') for m in library.get('refuted',[]) if m.get('model')}),'unknown_models':sorted({m.get('model') for m in library.get('unknown',[]) if m.get('model')}),
            'construction_status':assessment.get('construction',{}).get('status','unexplained_transition_retained')}
        pending=self.pending;navigation_trial=None;proposal_id=None
        if pending and pending['executed']<len(pending['steps']):
            expected=pending['steps'][pending['executed']]
            if expected['before_index']==source and _action_key(expected['action'])==key:
                proposal_id=pending['proposal_id']
                if pending['kind']=='access':navigation_trial=_hash([source,key,pending['question_ref']])
        payload={'source':source,'target':target,'action':action,'action_key':key,'transition_ref':transition_ref,
            'edge_id':'edge:'+_hash([source,key,target]),'assessment':summary,'rules':_rules(assessment),'proposal_id':proposal_id,'navigation_trial':navigation_trial}
        self._commit('transition',payload)
        progress=after['levels_completed']>before['levels_completed'];boundary=after['level_epoch']!=before['level_epoch']
        return {'status':'observed_transition_retained','transition_ref':transition_ref,'edge_ref':payload['edge_id'],'public_outcome_count':len(self.nodes[source]['attempts'][key]['outcomes']),
            'library_summary':summary,'knowledge_revision':self.knowledge_revision,'official_progress':progress,'epoch_boundary':boundary,
            'boundary_qualification':'official_progress' if progress else 'changed_epoch_without_completion' if boundary else 'same_epoch',
            'cross_epoch_mechanism_transfer':'unestablished; prior rules recalled only as hypotheses'}

    def bind_current_candidate_context(self,observation,rules):
        # References are ephemeral: no new fact, authority or graph snapshot.
        # Evaluation is lazy, so an already useful parent continuation does not
        # revalidate unrelated empirical candidates.
        self._candidate_context=(observation,{r['rule_id']:r for r in rules})
        self._candidate_checks={}

    def _candidate_check(self,index,action,rule):
        cache_key=(index,_action_key(action),rule['rule_id'])
        if cache_key in self._candidate_checks:return self._candidate_checks[cache_key]
        context=self._candidate_context;bound=bool(context and _index(context[0])==index)
        current=context[1].get(rule['rule_id'])if bound else None
        prediction=predict_candidate_rule(current,context[0],action)if current is not None else {'status':'unknown','reason':'current_rule_or_observation_binding_missing'}
        facts={'candidate_rule_present':current is not None,'current_observation_bound':bound,
               'current_prediction_status':prediction['status']}
        admitted=all(_fact_condition_holds(DrmFactCondition.model_validate(c),facts)for c in self._candidate_admission['conditions'])
        result={'rule_id':rule['rule_id'],'action':copy.deepcopy(action),'observation_ref':_ref(context[0])if bound else None,
                'status':prediction['status'],'reason':prediction.get('reason'),'admitted':admitted,'facts':facts,
                'effect_ref':_hash(prediction)if admitted else None,'meaning':'conditional_question_only_no_acquired_law'}
        self._candidate_checks[cache_key]=result
        return result

    def _question(self,index,key):
        node=self.nodes[index];action=node['actions'][key];epoch=node['protocol']['level_epoch'];matching=[r for r in self.rules.values() if r['action_ref']==action['action_ref']]
        candidate_checks=[self._candidate_check(index,action,r)for r in matching if r['status']=='candidate']
        admitted_refs={r['rule_id']for r in candidate_checks if r['admitted']}
        candidates=[r for r in matching if r['status']=='candidate'and r['rule_id']in admitted_refs];prior=[r for r in matching if r['scope_epochs'] and epoch not in r['scope_epochs']]
        refuted=[r for r in matching if r['status']=='refuted'];acquired=[r for r in matching if r['status']=='mechanism_acquired' and r not in prior]
        if candidates:reason='independent_applicability_test_of_constructed_relation';priority=0;basis=candidates
        elif prior:reason='rebind_prior_epoch_hypothesis_without_transferring_authority';priority=1;basis=prior
        elif refuted:
            # A counterexample records a failed prediction. Without a new
            # condition to test, this input has the same evidential priority as
            # another open input. _open then prefers the less tried command.
            reason='missing_condition_unknown_after_retained_counterexample'
            priority=3
            basis=refuted
        elif acquired:reason='test_known_relation_in_untried_local_context';priority=4;basis=acquired
        else:reason='unobserved_input_effect_or_unexplained_transition';priority=3;basis=matching
        refs=[r['rule_id'] for r in basis[:8]]
        return {'question_ref':'Q_'+_hash([index,key])[:20],'context_index':index,'action':action,'reason':reason,'priority':priority,'hypothesis_refs':refs,'authority_transferred':False,
            'input_trials_at_context':self.nodes[index]['attempts'].get(key,{}).get('count',0),
            'candidate_applicability':candidate_checks[:8],'candidate_applicability_total':len(candidate_checks),
            'current_candidate_prediction_admitted':bool(candidates)}

    def _open(self,index):
        node=self.nodes[index]
        if node['protocol']['state'] in ('WIN','GAME_OVER'):return []
        questions=[self._question(index,k) for k in node['actions'] if k not in node['attempts']]
        epoch=str(node['protocol']['level_epoch'])
        questions.sort(key=lambda q:(q['priority'],self.action_counts.get(epoch+':'+_action_key(q['action']),0),_pack(q['action'])))
        return questions

    def can_probe_here(self,observation,command):
        node=self.nodes.get(_index(observation))
        return command['action_ref'] in observation['available_action_refs'] and (
            node is None or _action_key(command) not in node['attempts'])

    def _access(self,start):
        epoch=self.nodes[start]['protocol']['level_epoch'];queue=deque([(start,[])]);seen={start};expanded=0
        while queue and expanded<2048:
            index,path=queue.popleft();expanded+=1
            if path:
                for question in self._open(index):
                    first=path[0];trial=_hash([start,first['action_key'],question['question_ref']])
                    if self.navigation_trials.get(trial,0)<2:return path,question
            outgoing=sorted((e for e in self.edges.values() if e['source']==index),key=lambda e:(_pack(e['action']),e['target']))
            for edge in outgoing:
                target=edge['target']
                if target in seen or self.nodes[target]['protocol']['level_epoch']!=epoch or self.nodes[target]['protocol']['state'] in ('WIN','GAME_OVER'):continue
                seen.add(target);queue.append((target,path+[edge]))
        return None,None

    def propose(self,observation,action_candidates,*,prefix_evidence=(),experimental_probes=(),control_probe=None,control_acquisition=None,curiosity=None,return_episode=None):
        current=self.observe(observation,action_candidates);index=current['observation_index'];protocol=_protocol(observation)
        if protocol['levels_completed']>=self.target_levels or protocol['state'] in ('WIN','GAME_OVER'):
            return {'status':'terminal','actions':[],'official_levels_completed':protocol['levels_completed'],'goal_satisfied':protocol['levels_completed']>=self.target_levels,'protocol_state':protocol['state']}
        questions=self._open(index)
        if curiosity is not None:
            if curiosity["observation_ref"]!=_ref(observation) or curiosity["level_epoch"]!=protocol["level_epoch"]:
                raise ValueError("Information goal belongs to another public state")
            questions=[dict(q,curiosity=curiosity,reason=curiosity["question"],
                        hypothesis_refs=curiosity["evidence"]) for q in questions if _action(q["action"])==_action(curiosity["action"])]
            if not questions:return None
        if control_acquisition is not None:
            if control_acquisition['observation_ref']!=_ref(observation):
                raise ValueError('Stale control acquisition experiment')
            questions=[dict(q,reason=control_acquisition['objective'],control_acquisition=control_acquisition,
                            hypothesis_refs=control_acquisition['evidence'])
                       for q in questions if q['action']=={'action_ref':control_acquisition['action_ref']}]
            if not questions:return None
        for probe in experimental_probes:
            bound=probe['binding'];predictions=probe['frozen_predictions']
            if bound['observation_ref']!=_ref(observation) or bound['frame_hash']!=observation['frame_hash'] or bound['mode']!=[protocol['level_epoch'],protocol['state']]:
                raise ValueError('Experimental probe refers to a different observed context')
            if set(predictions.values())!={False,True} or not probe['new_contrast_pairs'] or not probe['falsifier']:
                raise ValueError('Experimental probe lacks distinct falsifiable predictions')
            for pair in probe['new_contrast_pairs']:
                if len(pair)!=2 or predictions[pair[0]]==predictions[pair[1]]:
                    raise ValueError('Proposed rivals do not predict distinct outcomes')
            if bound['action']['action_ref']!='ACTION6':raise ValueError('Unsupported experimental binding')
            entity=next((e for e in observation['entities'] if e['id']==bound['entity_ref']),None)
            point=bound['action']['data']
            if entity is None or (point['x']-entity['position'][0],point['y']-entity['position'][1]) not in {tuple(p) for p in entity['mask']}:
                raise ValueError('Experimental input differs from its measured occurrence')
            q=next((q for q in questions if _action(q['action'])==_action(bound['action'])),None)
            if q:
                question={**q,'reason':'discriminate_scoped_visible_support_predictions','priority':-1,
                    'hypothesis_refs':list(predictions),'experiment':copy.deepcopy(probe)}
                questions=[question]+[other for other in questions if other is not q]
                break
        if control_probe and not (questions and 'experiment' in questions[0]):
            bound=control_probe['binding']
            if (control_probe.get('kind')!='control_after_local_change' or bound['observation_ref']!=_ref(observation)
                or bound['frame_hash']!=observation['frame_hash'] or bound['mode']!=[protocol['level_epoch'],protocol['state']]
                or control_probe['intervention']['after']!=_ref(observation) or not control_probe['expected_receivers']):
                raise ValueError('Control experiment lacks an applicable intervention or receiver forecast')
            for r in control_probe['expected_receivers'].values():
                hits=[e['position'] for e in observation['entities'] if e['signature']==r['signature']]
                if hits!=[r['before']]:raise ValueError('Control receiver is stale or ambiguous')
            q=next((q for q in questions if _action(q['action'])==_action(bound['action'])),None)
            if q:
                questions=[{**q,'reason':'test_control_after_observed_local_change','priority':-1,
                    'hypothesis_refs':[control_probe['rule_ref']],'control_experiment':copy.deepcopy(control_probe)}]+[x for x in questions if x is not q]
        if return_episode is not None:
            from return_fork import closed_return_contrast
            contrast=closed_return_contrast(self,return_episode,index,self.max_prefix)
            if contrast is None:return None
            path,question=contrast;kind='access'
        elif questions:path=[];question=questions[0];kind='experiment'
        else:
            path,question=self._access(index);kind='access'
            if path is None:
                unresolved=sum(len(a['outcomes'])>1 for n in self.nodes.values() for a in n['attempts'].values())
                return {'status':'frontier_exhausted','actions':[],'reason':'no_untried_admitted_input_or_observed_access_within_current_epoch_and_replay_bound',
                    'unresolved_multiple_outcomes':unresolved,'qualification':'not_a_proof_of_game_impossibility; richer_observables_or_new_experiment_domain_may_be_required'}
        steps=[]
        for edge in path:
            outcomes=self.nodes[edge['source']]['attempts'][edge['action_key']]['outcomes'];uncertain=len(outcomes)!=1
            steps.append({'action':copy.deepcopy(edge['action']),'before_index':edge['source'],'expected_before':copy.deepcopy(self.nodes[edge['source']]['protocol']),
                'expected_after':copy.deepcopy(self.nodes[edge['target']]['protocol']),'edge_ref':edge['edge_id'],'outcome_alternatives':list(outcomes),'first_unresolved_effect':uncertain,
                'qualification':'provisional_observed_transition; hidden_state_equivalence_unproved'})
            if uncertain or len(steps)>=self.max_prefix:break
        if len(steps)<self.max_prefix and (not steps or not steps[-1]['first_unresolved_effect']) and len(steps)==len(path):
            steps.append({'action':copy.deepcopy(question['action']),'before_index':question['context_index'],'expected_before':copy.deepcopy(self.nodes[question['context_index']]['protocol']),
                'expected_after':None,'edge_ref':None,'outcome_alternatives':[],'first_unresolved_effect':True,'qualification':'untried_input_effect; seal_after_observation'})
        actions=[s['action'] for s in steps];unknown=any(s['first_unresolved_effect'] for s in steps);op='OP18' if unknown else 'OP28'
        focus='C_experiment_'+_hash([index,question['question_ref'],self.sequence])[:16];goal='G_protocol_completion';preserve='G_current_protocol_scope'
        facts={'current_observation_ref':_ref(observation),'current_level_epoch':protocol['level_epoch'],'current_levels_completed':protocol['levels_completed'],
            'first_input_publicly_available':actions[0]['action_ref'] in protocol['available_action_refs'],'open_information_question':True}
        if question['priority']==0:
            if not question.get('current_candidate_prediction_admitted'):raise ValueError('Candidate priority lacks current DRM admission')
            facts['current_candidate_prediction_admitted']=True
        route_refs=[s['edge_ref'] for s in steps if s['edge_ref']]
        compositions=[{'id':goal,'properties':{'definition':'official_level_completion_as_reported_by_protocol','target_levels':self.target_levels,'observed_levels_completed':protocol['levels_completed'],'visual_goal':'unknown'},'role':'objective'},
            {'id':preserve,'properties':{'definition':'retain_current_epoch_and_public_input_binding; no_physical_safety_claim'},'role':'preservation'},
            {'id':self.nodes[index]['composition_ref'],'properties':copy.deepcopy(self.nodes[index]['measurement_summary']),'role':'observed_composition'},
            {'id':focus,'observed':False,'open_question':question['reason'],'properties':{'question_ref':question['question_ref'],'hypothesis_refs':question['hypothesis_refs'],'candidate_applicability':question.get('candidate_applicability',[]),'candidate_refusals':[r for r in self._candidate_checks.values()if not r['admitted']][:8],'access_refs':route_refs,'access_distance':len(path),'provisional':True},'relations':['contributes_to:'+goal],'role':'information_or_access'}]
        template={'operation_key':op,'composition_ref':focus,'objective_ref':goal,'preserve_refs':[preserve],
            'kind':'probe' if unknown else 'realize','purpose':'Resolve an observed information gap through an untried admitted input or a conditional remembered access; official completion remains the protocol objective.',
            'preconditions':facts,'preservation_evidence':{preserve:'current occurrence/epoch/availability bound; every suffix has a public-projection falsifier'},
            'evidence':[_ref(observation),question['question_ref']]+route_refs[:16],'actions':actions,
            'outcome_guard':{'path':['value'],'contains':focus if op=='OP18' else 'B0'}}
        if curiosity is not None:
            template['purpose']=curiosity['question']
            template['discriminating_predictions']=curiosity['predictions']
            target="C_information_"+_hash([protocol["level_epoch"],curiosity["source"],curiosity["relations"],sorted(curiosity["predictions"])])[:20]
            question["information_target"]=target
            compositions[-1]["relations"].append("investigates:"+target)
            compositions.append({"id":target,"role":"information_objective","observed":False,
                "things":[r[0] for r in curiosity["relations"]],
                "properties":{"status":"sought","question":curiosity["question"],
                    "tested_relations":curiosity["relations"],"prospective_predictions":curiosity["predictions"]},
                "relations":["contributes_to:"+goal]})
            template["information_target"]=target
        if 'experiment' in question:
            exp=question['experiment']
            template['purpose']=exp['question']
            template['frozen_experiment']=exp
            template['evidence']+=list(dict.fromkeys(r['source_ref'] for r in exp['rivals']))
        if 'control_experiment' in question:
            exp=question['control_experiment']
            template['purpose']=exp['question'];template['frozen_control_experiment']=exp
            template['evidence']+=exp['evidence_refs']
        proposal_id='proposal:'+_hash([index,question['question_ref'],steps,self.sequence])
        binding={'observation_ref':_ref(observation),'level_epoch':protocol['level_epoch'],'levels_completed':protocol['levels_completed'],'knowledge_revision':self.knowledge_revision}
        self._commit('proposal',{'proposal_id':proposal_id,'kind':kind,'question_ref':question['question_ref'],'steps':steps,'binding':binding})
        return {'status':'proposed','proposal_id':proposal_id,'kind':kind,'actions':actions,'steps':steps,'facts':facts,'compositions':compositions,'bundle_template':template,
            'binding':binding,'question':question,'route_refs':route_refs,'planned_access_length':len(path),'conditional_prefix_length':len(steps),
            'prefix_qualification':'provisional_observed_path_with_per_step_falsifiers; never_global_state_certification',
            'library_hypothesis_refs':question['hypothesis_refs'],'supplementary_evidence_refs':[p.get('evidence_ref') for p in prefix_evidence if p.get('evidence_ref')][:8],
            'graph_transmitted_to_SRC':False,'release_authority':False}

    def guard(self,proposal,observation,action_index=0):
        """Metadata-only suffix guard; no perception, fitting or replanning here."""
        if proposal.get('status')!='proposed' or not 0<=action_index<len(proposal['steps']):return {'admitted':False,'reason':'no_bound_step'}
        protocol=_protocol(observation);binding=proposal['binding'];step=proposal['steps'][action_index]
        if protocol['level_epoch']!=binding['level_epoch'] or protocol['levels_completed']!=binding['levels_completed']:return {'admitted':False,'reason':'official_boundary_invalidates_suffix'}
        if protocol['state'] in ('WIN','GAME_OVER'):return {'admitted':False,'reason':'terminal_protocol_state'}
        if action_index==0 and observation.get('observation_ref')!=binding['observation_ref']:return {'admitted':False,'reason':'initial_occurrence_binding_changed'}
        if protocol!=step['expected_before']:return {'admitted':False,'reason':'public_projection_diverged_from_conditional_path','expected_index':step['before_index'],'observed_index':_index(observation)}
        if step['action']['action_ref'] not in protocol['available_action_refs']:return {'admitted':False,'reason':'input_no_longer_available'}
        if self.knowledge_revision!=binding['knowledge_revision']:return {'admitted':False,'reason':'new_learning_requires_fresh_SRC_selection'}
        return {'admitted':True,'reason':'current_public_premises_match_provisional_step','qualification':'no_hidden_state_equivalence_or_global_safety_claim','effect_status':'unresolved_then_seal' if step['first_unresolved_effect'] else 'previously_observed_conditional'}

    def check_outcome(self,proposal,observation,action_index):
        """Compare the public falsifier even for the last step; never replan here."""
        if not 0<=action_index<len(proposal.get('steps',[])):raise ValueError('Outcome outside bound action set')
        actual=_protocol(observation);expected=proposal['steps'][action_index]['expected_after']
        progress=actual['levels_completed']>proposal['binding']['levels_completed']
        if expected is None:return {'status':'unknown_effect_observed','matched':None,'seal_prefix':True,'official_progress':progress}
        if actual==expected:return {'status':'matched_public_projection','matched':True,'seal_prefix':action_index==len(proposal['steps'])-1,'official_progress':progress,'qualification':'supports_conditional_edge_only'}
        return {'status':'diverged_public_projection','matched':False,'seal_prefix':True,'official_progress':progress,
            'differing_fields':[k for k in expected if actual[k]!=expected[k]],'remaining_suffix_authorized':False}
