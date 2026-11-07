"""Small frozen public-observation experiment, independent of game semantics.

game_id enters CustomSession and Creator provenance discovery only. It is never
passed to perception or the mechanism library and never selects a planner.
"""
import argparse,json,os,time,traceback
from pathlib import Path
from benchmark import durable,source_plan,quantiles
from catalog import REPO,sha
from memory import Memory,pack
from src_bridge import SrcBridge
from composition import CompositionEngine
from custom_bridge import CustomSession
from neutral_observer import measure,delta,summary
from common_mechanisms import assess_transition,predict_candidate_rule,validate_empirical_rule

POLICY_PATH=Path(__file__).with_name('neutral_probe_policy.drm.json')


class NeutralEngine(CompositionEngine):
    def prepare(self,request):
        prepared=super().prepare(request)
        epoch=prepared['state']['level_epoch']
        if prepared.get('level_epoch')!=epoch or any(b.get('level_epoch')!=epoch for b in prepared['bundles'].values()):
            raise ValueError('Neutral observation epoch binding mismatch')
        if prepared['state'].get('observation_revision')!=prepared['revision']:
            raise ValueError('Neutral observation revision binding mismatch')
        return prepared


def creator_environment_binding(game_id):
    # This metadata branch is transport/provenance only: family, descriptions,
    # level data and engine instances never enter observations or hypotheses.
    from custom_games.registry import get_custom_game
    info=get_custom_game(game_id)
    if info is None:raise ValueError('Transport identifier absent from custom registry')
    root=REPO/'custom_games'
    engine=root/'engines'/f'{info.engine}.py';level_dir=root/'games'/info.engine/'levels'
    files=[root/'registry.py',engine]+sorted(p for p in level_dir.rglob('*') if p.is_file())
    if len(files)==2 and engine.is_file():
        # Provenance only: adapters may delegate to a preserved standalone
        # implementation whose inputs are outside custom_games/games.
        import importlib
        adapter=importlib.import_module('custom_games.engines.'+info.engine)
        delegated=getattr(adapter,'LEGACY_SOURCE',None)
        if delegated is not None:
            delegated=Path(delegated).resolve()
            delegated.relative_to(REPO.resolve())
            files+=sorted(delegated.parent.rglob('*.py'))
            files+=sorted(delegated.parent.parent.glob('*.py'))
            files+=sorted((delegated.parents[2]/'specs').rglob('*.json'))
    if len(files)<=2 or not engine.is_file():raise ValueError('Physical environment inputs not bound before admission')
    return {str(p.resolve()):sha(p) for p in files}


def compositions(question_open=True):
    return [
        {'id':'G_information','things':['public_observation','declared_input'],
         'properties':{'definition':'retain_and_compare_public_responses_to_a_frozen_input_experiment'},
         'relations':[],'role':'information_objective','knowledge_status':'supplied_experiment_goal'},
        {'id':'C_response','things':['monochrome_components','declared_input'],
         'properties':{'semantic_roles':'unknown','terminal_game_objective':'unknown'},
         'relations':['contributes_to:G_information'],'role':'observational_relation',
         'observed':not question_open,'open_question':'Which public component relations change after this declared input, and which candidate explanations remain compatible?'}]


def analysis(memory,bridge,episode,observation,assessment,transition,revision):
    evidence=observation['observation_ref'];receipts=[]
    state={'level_epoch':observation['level_epoch'],'observation_revision':revision,'facts':{},
        'compositions':compositions(False),'expected_properties':{},
        'observed_properties':{'public_pixel_hash_changed':transition['pixel_hash_changed']},
        'knowledge_updates':[{'composition_ref':'C_response','property':'observed_transition_and_hypotheses',
            'value':{'transition':transition,'assessment':assessment},'revision':revision,'evidence':evidence}],
        'objective_assessments':[{'composition_ref':'G_information','satisfied':True,'feasible':True,
            'new_evidence':[evidence],'scope':'observation retained; no claim about a terminal game goal'}]}
    for op in ('OP29','OP30','OP31'):
        memory.put(episode,'state',state,evidence=evidence,revision=revision)
        bundle={'id':'R0','operation_key':op,'composition_ref':'C_response','objective_ref':'G_information',
            'preserve_refs':[],'observation_revision':revision,'level_epoch':observation['level_epoch'],
            'kind':'analysis','actions':[],'purpose':'Retain measured response and explicitly scoped hypotheses without inventing a terminal role.',
            'preconditions':{},'evidence':[evidence]}
        receipt=bridge.run({'episode':episode,'id':f'analysis-{revision}-{op}','level_epoch':observation['level_epoch'],
            'retrospective':True,'policy':'code_only','context':bundle['purpose'],'bundles':{'R0':bundle},
            'candidates':['R0'],'relevant_compositions':['C_response','G_information']})
        if receipt['decision']['status']!='composition_analysis':raise ValueError('SRC observation analysis refused')
        receipts.append({'operation':op,'src_status':receipt['src_status'],'result':receipt['decision']['operation_result']})
    return receipts


def cardinality(value):
    return len(value) if isinstance(value,(list,tuple,dict)) else int(value is not None)


def select_experiment_input(observation,registry,history,domain):
    available=sorted(set(domain)&set(observation['available_action_refs']))
    tried={h['action']['action_ref'] for h in history
        if h['before_hash']==observation['frame_hash'] and h['level_epoch']==observation['level_epoch']}
    predictions={action:[predict_candidate_rule(rule,observation,{'action_ref':action,'data':{}})
        for rule in registry] for action in available}
    contrastive=[action for action in available if any(
        p.get('status')=='conditional_prediction' and p.get('predicted_entities') for p in predictions[action])]
    untried=[action for action in available if action not in tried]
    chosen=contrastive[0] if contrastive else untried[0] if untried else None
    reason='test_structured_conditional_prediction' if contrastive else 'sample_untried_input_in_observed_state' if untried else 'no_discriminating_input_in_declared_domain'
    evidence={'choice_reason':reason,'available_refs':available,'tried_in_current_state':sorted(tried),
        'structured_prediction_inputs':contrastive,'safety_scope':'declared experimental guards only; candidate is not permission to exploit its effect'}
    return chosen,evidence,predictions.get(chosen,[])


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--game',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=False)
    policy=json.loads(POLICY_PATH.read_text());plan=source_plan()
    plan.update(game_transport=args.game,experiment='neutral_public_response_probe',policy_path=str(POLICY_PATH),policy_sha=sha(POLICY_PATH),
        environment_sources=creator_environment_binding(args.game),max_actions=policy['execution']['max_actions'],
        max_bundle_actions=1,level_seconds=360,model_loaded=False,planner_selected_by_game=False,
        game_id_visible_to_mechanism_library=False,declared_protocol_domain=policy['protocol_domain'],
        role_and_goal_policy='no game terminal role; information objective and input schedule explicitly supplied by Creator')
    durable(out/'plan.json',plan)
    from agents.yf_arc3_v6.__main__ import session_slot
    current=None;memory=None;actions=0;decisions=[];assessments=[];registry=[];history=[];selected_inputs=[];episode='neutral-public-probe';started=time.perf_counter()
    with session_slot() as lease:
        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease})
        try:
            memory=Memory(out/'memory.sqlite3');memory.import_catalog();bridge=SrcBridge(NeutralEngine(memory),continuous=True)
            env=CustomSession(args.game);current=env.reset();level_start=time.perf_counter();initial=current.to_dict()
            if current.level!=1 or current.levels_completed!=0:raise ValueError('Fresh L1 transport observation required')
            observation,parts=measure(current,1,out.name);initial_observation=observation;revision=1
            durable(out/'observation-1.json',{'observation':observation,'local_only':True})
            available=sorted(set(policy['protocol_domain'])&set(current.available_action_refs))
            status='nonrun_no_declared_input_available' if not available else 'probe_completed';reason=None
            with (out/'execution.jsonl').open('x',encoding='utf-8') as journal:
                while available and actions<plan['max_actions']:
                    begin=time.perf_counter()
                    registry_recall=None
                    if actions:
                        recalled=memory.get(episode,'empirical_registry')
                        registry=recalled['value']
                        registry_recall={'revision':recalled['revision'],'evidence':recalled['evidence']}
                        remembered_history=memory.get(episode,'probe_history')
                        history=remembered_history['value']
                        registry_recall['history_revision']=remembered_history['revision']
                    if begin-level_start>=360:reason='level_deadline';break
                    if current.state in {'GAME_OVER','WIN'}:reason='terminal';break
                    if current.level!=initial['level'] or current.levels_completed!=initial['levels_completed']:reason='official_level_boundary';break
                    if current.frame_hash!=observation['frame_hash'] or current.level!=observation['level_epoch']:
                        raise ValueError('Current public observation binding changed')
                    scheduled,selection_evidence,predictions=select_experiment_input(observation,registry,history,policy['protocol_domain'])
                    if scheduled is None:reason='no_discriminating_input_in_declared_domain';break
                    if scheduled not in current.available_action_refs:raise ValueError('Selected experimental input unavailable')
                    facts={'input_available':True,'declared_probe_slot_open':actions<plan['max_actions'],'current_epoch_matches':True}
                    state={'level_epoch':current.level,'observation_revision':revision,'facts':facts,'compositions':compositions(True),
                        'memory_hint':{'observation':summary(observation),'rules_retained':len(registry),'interpretation':'roles and game goal remain unknown'}}
                    memory.put(episode,'state',state,evidence=observation['observation_ref'],revision=revision)
                    bundle={'id':'B0','operation_key':'OP18','composition_ref':'C_response','objective_ref':'G_information',
                        'preserve_refs':[],'observation_revision':revision,'level_epoch':current.level,'kind':'probe',
                        'actions':[{'action_ref':scheduled,'data':{}}],
                        'purpose':'Measure one public response to the frozen input experiment; acquire evidence without assigning game-specific roles.',
                        'preconditions':facts,'evidence':[observation['observation_ref'],'supplied-bounded-experiment-policy'],
                        'outcome_guard':{'path':['value'],'contains':'C_response'},
                        'selection_origin':'supplied history/conditional-prediction experiment rule; not game action utility',
                        'experiment_selection':selection_evidence}
                    command=bundle['actions'][0]
                    frozen_path=out/f'predictions-before-{revision}.json'
                    durable(frozen_path,{'before_observation_ref':observation['observation_ref'],'action':command,
                        'prior_rules':registry,'candidate_predictions':predictions,
                        'experiment_selection':selection_evidence,
                        'scope':'conditional hypotheses frozen before dispatch; not permission to exploit an unconfirmed rule',
                        'no_predictions_reason':'no prior structured candidate' if not predictions else None})
                    frozen_sha=sha(frozen_path)
                    receipt=bridge.run({'episode':episode,'id':f'probe-{revision}','level_epoch':current.level,'policy':'code_only',
                        'context':bundle['purpose'],'bundles':{'B0':bundle},'candidates':['B0'],
                        'relevant_compositions':['C_response','G_information']})
                    decision=receipt['decision']
                    if decision['status']!='action_set_released' or decision['action_set']!=bundle:raise ValueError('Exact guarded SRC probe release missing')
                    if decision['model_calls']:raise ValueError('Unexpected neural call in frozen symbolic probe')
                    durable(out/f'decision-{revision}.json',receipt)
                    if time.perf_counter()-level_start>=360:reason='level_deadline_before_dispatch';break
                    source_level=current.level
                    journal.write(pack({'event':'dispatch','revision':revision,'level':source_level,**command})+'\n');journal.flush();os.fsync(journal.fileno())
                    previous=current;current=env.step(command['action_ref'],data=command['data']);actions+=1;selected_inputs.append(scheduled)
                    first_ms=(time.perf_counter()-begin)*1000
                    journal.write(pack({'event':'observation','revision':revision,**current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())
                    durable(out/f'packet-{revision}.json',{'before':previous.frame_rows,'after_packet':current.frame_packet,
                        'after':current.frame_rows,'canonical_after_frame_hash':current.frame_hash,
                        'auxiliary_frame_count':len(current.frame_packet),
                        'interpretation':'canonical frame is the public payload.frame; auxiliary frames retained without causal labels',
                        'local_only':True})
                    after,after_parts=measure(current,revision+1,out.name)
                    durable(out/f'observation-{revision+1}.json',{'observation':after,'local_only':True})
                    boundary=current.level!=initial['level'] or current.levels_completed!=initial['levels_completed']
                    if current.state in {'GAME_OVER','WIN'} or boundary:
                        reason='official_game_over' if current.state=='GAME_OVER' else 'official_win' if current.state=='WIN' else 'official_level_boundary'
                        status='probe_stopped_at_boundary'
                        raw={'action':command,'before_observation_ref':observation['observation_ref'],
                            'after_observation_ref':after['observation_ref'],'before_epoch':observation['level_epoch'],
                            'after_epoch':after['level_epoch'],'reason':reason,
                            'mechanism_interpretation':'unknown; boundary/terminal transition excluded from same-epoch fitting'}
                        durable(out/f'boundary-transition-{revision}.json',raw)
                        memory.put(episode,'uninterpreted_boundary_transition',raw,evidence=after['observation_ref'],revision=revision+1)
                        decisions.append({'revision':revision,'level':source_level,'actions':1,'first_action_ms':first_ms,
                            'full_set_ms':(time.perf_counter()-begin)*1000,'model_calls':0,'prior_registry_recalled':registry_recall,
                            'prediction_file_sha256':frozen_sha,'interruption':reason,'library_assessment_skipped':True})
                        observation,parts=after,after_parts;revision+=1
                        break
                    transition=delta(observation,after,parts,after_parts,command)
                    if sha(frozen_path)!=frozen_sha:raise ValueError('Pre-dispatch candidate prediction file changed')
                    frozen=json.loads(frozen_path.read_text(encoding='utf-8'))
                    checks=[validate_empirical_rule(rule,observation,after,command) for rule in frozen['prior_rules']]
                    durable(out/f'prediction-checks-{revision}.json',{'prediction_file_sha256':frozen_sha,
                        'checks':checks,'scope':'comparison of pre-dispatch candidates only; new candidates belong to the next revision'})
                    assessment=assess_transition(observation,after,command,prior_rules=registry)
                    registry=assessment['empirical_rules'];assessments.append(assessment)
                    durable(out/f'transition-{revision}.json',{'transition':transition,'assessment':assessment,'local_only':True})
                    receipts=analysis(memory,bridge,episode,after,assessment,transition,revision+1)
                    durable(out/f'analysis-{revision}.json',receipts)
                    memory.put(episode,'empirical_registry',registry,evidence=after['observation_ref'],revision=revision+1)
                    history.append({'action':command,'before_hash':observation['frame_hash'],'after_hash':after['frame_hash'],
                        'level_epoch':source_level,'before_observation_ref':observation['observation_ref'],
                        'after_observation_ref':after['observation_ref']})
                    memory.put(episode,'probe_history',history,evidence=after['observation_ref'],revision=revision+1)
                    decisions.append({'revision':revision,'level':source_level,'actions':1,'first_action_ms':first_ms,
                        'full_set_ms':(time.perf_counter()-begin)*1000,'model_calls':0,
                        'prior_registry_recalled':registry_recall,
                        'prediction_file_sha256':frozen_sha,
                        'experiment_selection':selection_evidence,
                        'library_summary':{k:cardinality(assessment.get('library',{}).get(k)) for k in ('compatible','refuted','unknown')}})
                    old_state=previous.state;observation,parts=after,after_parts;revision+=1
                    if current.state in {'GAME_OVER','WIN'}:
                        reason='official_game_over' if current.state=='GAME_OVER' else 'official_win'
                        status='probe_stopped_at_terminal'
                        break
                    if current.level!=initial['level'] or current.levels_completed!=initial['levels_completed']:reason='official_level_boundary';break
                    if current.state!=old_state:reason='changed_protocol_state';break
                    if scheduled not in current.available_action_refs:reason='unavailable_action';break
                for name,digest in {**plan['source'],**plan['environment_sources'],str(POLICY_PATH):plan['policy_sha']}.items():
                    if sha(Path(name))!=digest:raise ValueError('Frozen consumed source changed: '+name)
                report={'status':status,'reason':reason,'actions':actions,'initial':initial,'final':current.to_dict(),
                    'game_transport':args.game,'selected_input_references':selected_inputs,'decisions':decisions,
                    'initial_observation_summary':summary(initial_observation),'final_observation_summary':summary(observation),
                    'empirical_registry':registry,'assessment_count':len(assessments),'continuous_src_store':True,
                    'game_goal_status':'unknown','official_success_observed':current.levels_completed>initial['levels_completed'],
                    'autonomous_solving_claim':False,'hypotheses_are_universal_laws':False,'model_loaded':False,
                    'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions]),'elapsed_s':time.perf_counter()-started,
                    'qualification':policy['qualification'],'oracle_read_at_runtime':False,'production_v5_modified':False}
                durable(out/'report.json',report)
                print(pack({k:report[k] for k in ('status','reason','actions','assessment_count','game_goal_status','official_success_observed','model_loaded','elapsed_s','latency_to_first_action')}))
        except BaseException as exc:
            durable(out/'failure.json',{'status':'stopped','error':repr(exc),'traceback':traceback.format_exc(),'actions':actions,
                'last_observation':current.to_dict() if current else None,'decisions':decisions})
            raise
        finally:
            if memory is not None:memory.close()


if __name__=='__main__':main()
