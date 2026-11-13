"""Official point-action transport using shared SRC, memory and goal guards."""
import json,os,sys,time,traceback
from pathlib import Path
from benchmark import durable,source_plan,quantiles
from catalog import REPO,sha
from memory import Memory,pack
from src_bridge import SrcBridge
from ordered_runtime import OrderedEngine as GoalMemoryEngine
from field_constraints import FieldPlanner,compact,POLICY_PATH


def retrospective(memory,bridge,episode,planner,before,current,revision,source_level):
    if len(before['mismatches'])!=1 or current.levels_completed!=source_level:
        raise ValueError('No last-constraint explanation for official completion')
    proof={'pattern':planner.policy['goals'][0]['composition'],'confirmed_level':source_level,
        'status':'supported_by_official_success','last_observed_constraint_count':len(before['constraints']),
        'causal_limit':'success supports composed-constraint hypothesis; universal necessity unproved'}
    receipts=[]
    for op in ('OP29','OP30','OP31'):
        revision+=1
        state={'level_epoch':source_level,'observation_revision':revision,'facts':{'source_rule_applicable':True},
            'compositions':[{'id':'G_terminal','properties':{'definition':proof['pattern']}}],
            'expected_properties':{'official_level_complete':True},'observed_properties':{'official_level_complete':current.levels_completed==source_level},
            'knowledge_updates':[{'composition_ref':'G_terminal','property':'level_final_goal','value':proof,'revision':revision,'evidence':current.frame_hash}],
            'objective_assessments':[{'composition_ref':'G_terminal','satisfied':True,'feasible':True,'new_evidence':[current.frame_hash]}]}
        memory.put(episode,'state',state,evidence=current.frame_hash,revision=revision)
        bundle={'id':'R0','operation_key':op,'composition_ref':'G_terminal','objective_ref':'G_terminal','preserve_refs':[],
            'observation_revision':revision,'level_epoch':source_level,'kind':'analysis','actions':[],
            'purpose':'Confronter la fermeture des contraintes au passage officiel et conserver le patron du but.',
            'preconditions':{'source_rule_applicable':True},'evidence':[current.frame_hash]}
        receipt=bridge.run({'episode':episode,'id':f'retro-{revision}','level_epoch':source_level,'retrospective':True,
            'policy':'hybrid','context':bundle['purpose'],'bundles':{'R0':bundle},'candidates':['R0'],'relevant_compositions':['G_terminal']})
        if receipt['decision']['status']!='composition_analysis':raise ValueError('Retrospective refused')
        receipts.append({'operation':op,'src_status':receipt['src_status'],'result':receipt['decision']['operation_result']})
    saved=memory.get(episode,'knowledge:G_terminal:level_final_goal')
    if saved['value']!=proof:raise ValueError('OP30 did not persist conclusion')
    memory.put(episode,'goal_template',saved['value'],evidence=saved['evidence'],revision=saved['revision'])
    return revision,{'completed_level':source_level,'proof':proof,'src_operations':receipts}


def main():
    out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
    target=int(sys.argv[2]) if len(sys.argv)>2 else 3
    planner=FieldPlanner();cap=int(sys.argv[3]) if len(sys.argv)>3 else planner.policy['execution']['max_actions']
    game='ft09-0d8bbf25';env_source=REPO.parent/'arc-agi-current/environment_files/ft09/0d8bbf25/ft09.py'
    plan=source_plan();plan.update(game=game,target_score=target,max_actions=cap,max_bundle_actions=planner.policy['execution']['max_bundle_actions'],
        level_seconds=planner.policy['execution']['max_level_seconds'],policy_path=str(POLICY_PATH),policy_sha=sha(POLICY_PATH),
        environment_source=str(env_source),environment_source_sha=sha(env_source),allowed_action_refs=['ACTION6'],
        model_loaded=False,action_budget_authorization='user active goal: automatic budget increases permitted')
    durable(out/'plan.json',plan)
    from agents.yf_arc3_v6.__main__ import session_slot
    from tools.yf_v5_env_bridge import OfficialEnvSession
    current=None;memory=None;actions=0;decisions=[];level_actions={};transfers=[];retros=[];scenes=[]
    with session_slot() as lease:
        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease})
        try:
            memory=Memory(out/'memory.sqlite3');memory.import_catalog();episode='field-compositions'
            bridge=SrcBridge(GoalMemoryEngine(memory),continuous=True)
            env=OfficialEnvSession(game);current=env.reset();initial=current.to_dict()
            started=time.perf_counter();level_start=started;state=planner.state(current.frame_rows)
            scenes.append({'level':current.level,**compact(state)});revision=1;status='unresolved';reason=None
            with (out/'execution.jsonl').open('x',encoding='utf-8') as journal:
                while current.levels_completed<target and actions<cap:
                    begin=time.perf_counter()
                    if begin-level_start>=plan['level_seconds']:reason='level_deadline';break
                    comps,bundles=planner.portfolio(state,revision,current.level)
                    if current.level>1:
                        saved=memory.get(episode,'goal_template');goal=next(c for c in comps if c['id']=='G_terminal')
                        goal['properties']['definition']=saved['value']['pattern'];goal['goal_memory_revision']=saved['revision']
                        transfer={'confirmed_level':saved['value']['confirmed_level'],'current_level':current.level,
                            'memory_revision':saved['revision'],'pattern':saved['value']['pattern']}
                        transfers.append(transfer)
                        for b in bundles.values():b['goal_transfer']=transfer
                    memory.put(episode,'state',{'level_epoch':current.level,'observation_revision':revision,'facts':{'source_rule_applicable':True},
                        'compositions':comps,'memory_hint':compact(state)},evidence=current.frame_hash,revision=revision)
                    memory.put(episode,'descriptor_semantics',{'mapping':planner.semantics,'evidence':planner.semantic_evidence},evidence=current.frame_hash,revision=revision)
                    receipt=bridge.run({'episode':episode,'id':f'choice-{revision}','level_epoch':current.level,'policy':'hybrid',
                        'context':'Satisfaire la composition des contraintes sans modifier les ancres ni les positions valides.',
                        'bundles':bundles,'candidates':list(bundles),'relevant_compositions':['G_terminal','G_preserve']})
                    if receipt['decision']['status']!='action_set_released':reason='source_release_refused';break
                    chosen=receipt['decision']['action_set']
                    if chosen!=bundles[chosen['id']] or len(chosen['actions'])>plan['max_bundle_actions']:raise ValueError('Released action-set binding invalid')
                    durable(out/f'decision-{revision}.json',receipt)
                    packet=[current];source_level=current.level;first_ms=None;interruption=None
                    for command,repair in zip(chosen['actions'],chosen['repairs']):
                        if actions>=cap or time.perf_counter()-level_start>=plan['level_seconds']:interruption='declared_cap';break
                        if command['action_ref'] not in current.available_action_refs:raise ValueError('Released point action unavailable')
                        journal.write(pack({'event':'dispatch','revision':revision,'action':command['action_ref'],'data':command['data'],'level':source_level})+'\n');journal.flush();os.fsync(journal.fileno())
                        before_hash=current.frame_hash
                        current=env.step(command['action_ref'],data=command['data']);packet.append(current);actions+=1
                        level_actions[str(source_level)]=level_actions.get(str(source_level),0)+1
                        if first_ms is None:first_ms=(time.perf_counter()-begin)*1000
                        journal.write(pack({'event':'observation',**current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())
                        if current.level!=source_level:level_start=time.perf_counter();break
                        after=planner.state(current.frame_rows)
                        learned=planner.observe(state,after,repair,[before_hash,current.frame_hash]);state=after
                        memory.put(episode,'point_effect:'+str(actions),learned,evidence=current.frame_hash,revision=revision)
                        if current.state in {'WIN','GAME_OVER'}:interruption='terminal_state';break
                    durable(out/f'packet-{revision}.json',{'frames':[p.frame_rows for p in packet],'local_only':True})
                    selected_revision=revision
                    if current.level!=source_level:
                        revision,retro=retrospective(memory,bridge,episode,planner,state,current,revision,source_level)
                        retros.append(retro);durable(out/f'retrospective-level-{source_level}.json',retro)
                        if current.levels_completed<target:
                            state=planner.state(current.frame_rows);scenes.append({'level':current.level,**compact(state)})
                    decisions.append({'revision':selected_revision,'level':source_level,'recipe':chosen['recipe'],'actions':len(packet)-1,
                        'first_action_ms':first_ms,'full_set_ms':(time.perf_counter()-begin)*1000,'model_calls':len(receipt['decision']['model_calls']),
                        'interruption':interruption})
                    revision+=1
                    if interruption:reason=interruption;break
                if current.levels_completed>=target:status=f'L{target}_passed'
                elif actions>=cap:reason='admitted_action_cap'
                if sha(POLICY_PATH)!=plan['policy_sha'] or sha(env_source)!=plan['environment_source_sha']:raise ValueError('Consumed source changed')
                report={'status':status,'reason':reason,'game':game,'target_score':target,'max_actions':cap,'initial':initial,'final':current.to_dict(),
                    'actions':actions,'level_actions':level_actions,'decisions':decisions,'mechanisms':planner.effects,'retrospectives':retros,
                    'goal_transfers':transfers,'continuous_src_store':True,'load_ms':0,'model_loaded':False,'scenes':scenes,
                    'descriptor_semantics':planner.semantics,'semantic_evidence':planner.semantic_evidence,'elapsed_s':time.perf_counter()-started,
                    'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions]),
                    'qualification':'experimental composition/SRC constraint solver; no Laya call needed; not production V5',
                    'oracle_read_at_runtime':False,'production_v5_modified':False}
                durable(out/'report.json',report);print(pack({k:report[k] for k in ['status','actions','level_actions','elapsed_s','latency_to_first_action']}))
        except BaseException as exc:
            if current:durable(out/'failure-observation.json',{'rows':current.frame_rows,'local_only':True})
            durable(out/'failure.json',{'error':repr(exc),'traceback':traceback.format_exc(),'actions':actions,'level_actions':level_actions,
                'last_observation':current.to_dict() if current else None,'decisions':decisions,'status':'stopped'})
            raise
        finally:
            if memory is not None:memory.close()

if __name__=='__main__':main()
