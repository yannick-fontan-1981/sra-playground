"""Continuous official AR25 reflection experiment with persistent goals and SRC."""
import hashlib,json,os,sys,time,traceback,subprocess
from pathlib import Path
from benchmark import durable,source_plan,quantiles
from catalog import REPO,sha
from memory import Memory,pack
from src_bridge import SrcBridge
from ordered_runtime import OrderedEngine
from field_runtime import retrospective
from ar25_reflections import ReflectionPlanner,POLICY_PATH

def frozen(plan):
    bad=[p for p,s in plan['source'].items() if sha(p)!=s]
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
    if bad or head!=plan['head']:raise ValueError('Consumed Source/HEAD changed: '+str(bad))

def main():
    out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
    planner=ReflectionPlanner();plan=source_plan();game='ar25-0c556536';target=3
    env_source=REPO.parent/'arc-agi-current/environment_files/ar25/0c556536/ar25.py'
    for p in (POLICY_PATH,env_source):plan['source'][str(p.resolve())]=sha(p)
    plan['source_bundle_sha256']=hashlib.sha256(pack(plan['source']).encode()).hexdigest()
    plan.update(game=game,target_score=target,policy_path=str(POLICY_PATH),policy_sha=sha(POLICY_PATH),environment_source=str(env_source),environment_source_sha=sha(env_source),max_actions=planner.policy['execution']['max_actions'],max_bundle_actions=16,level_seconds=360,allowed_action_refs=['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'],model_loaded=False,action_budget_authorization='user automatic necessary budgets',public_input_contract='OfficialEnvSession public frame and metadata only')
    durable(out/'plan.json',plan)
    from agents.yf_arc3_v6.__main__ import session_slot
    from tools.yf_v5_env_bridge import OfficialEnvSession
    current=None;memory=None;actions=0;decisions=[];level_actions={};transfers=[];retros=[];scenes=[];level_times={}
    with session_slot() as lease:
        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease,'plan_sha':sha(out/'plan.json')})
        try:
            frozen(plan);memory=Memory(out/'memory.sqlite3');memory.import_catalog();episode='ar25-reflections'
            bridge=SrcBridge(OrderedEngine(memory),continuous=True);env=OfficialEnvSession(game)
            started=time.perf_counter();current=env.reset();initial=current.to_dict();level_start=started
            scenes.append({'level':current.level,**planner.start(current.frame_rows)})
            revision=1;status='unresolved';reason=None
            with (out/'execution.jsonl').open('x',encoding='utf-8') as journal:
                while current.levels_completed<target and actions<plan['max_actions']:
                    begin=time.perf_counter()
                    if begin-level_start>=plan['level_seconds']:reason='level_deadline';break
                    comps,bundles=planner.portfolio(revision,current.level)
                    if current.level>1:
                        saved=memory.get(episode,'goal_template');goal=next(c for c in comps if c['id']=='G_terminal')
                        goal['properties']['definition']=saved['value']['pattern'];goal['goal_memory_revision']=saved['revision']
                        transfer={'confirmed_level':saved['value']['confirmed_level'],'current_level':current.level,'memory_revision':saved['revision'],'pattern':saved['value']['pattern']}
                        transfers.append(transfer)
                        for b in bundles.values():b['goal_transfer']=transfer
                    memory.put(episode,'state',{'level_epoch':current.level,'observation_revision':revision,'facts':{'source_rule_applicable':True},'compositions':comps,'memory_hint':planner.summary()},evidence=current.frame_hash,revision=revision)
                    receipt=bridge.run({'episode':episode,'id':f'choice-{revision}','level_epoch':current.level,'policy':'hybrid','context':bundles['B0']['purpose'],'bundles':bundles,'candidates':list(bundles),'relevant_compositions':['G_terminal','G_preserve','G_transform']})
                    if receipt['decision']['status']!='action_set_released':raise ValueError('SRC action release refused')
                    chosen=receipt['decision']['action_set']
                    if chosen!=bundles[chosen['id']] or len(chosen['actions'])>16:raise ValueError('Action-set binding invalid')
                    durable(out/f'decision-{revision}.json',receipt)
                    source_level=current.level;packet=[current];first_ms=None;before_constraints=list(planner.world['targets']);interruption=None;action_times=[]
                    for command in chosen['actions']:
                        if actions>=plan['max_actions'] or time.perf_counter()-level_start>=360:raise ValueError('Admitted cap reached during action set')
                        if command['action_ref'] not in current.available_action_refs:raise ValueError('Released action unavailable')
                        predicted=planner.predict(command)
                        journal.write(pack({'event':'dispatch','revision':revision,'action':command['action_ref'],'level':source_level})+'\n');journal.flush();os.fsync(journal.fileno())
                        previous_hash=current.frame_hash;action_start=time.perf_counter();current=env.step(command['action_ref']);action_times.append((time.perf_counter()-action_start)*1000);packet.append(current);actions+=1
                        level_actions[str(source_level)]=level_actions.get(str(source_level),0)+1
                        if first_ms is None:first_ms=(time.perf_counter()-begin)*1000
                        journal.write(pack({'event':'observation',**current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())
                        completed=current.levels_completed==source_level
                        if completed:
                            boundary=time.perf_counter();level_times[str(source_level)]=boundary-level_start;level_start=boundary
                        learned=planner.reconcile(current.frame_rows,predicted,command,previous_hash,current.frame_hash,completed)
                        memory.put(episode,'reflection_effect:'+str(actions),learned,evidence=current.frame_hash,revision=revision)
                        if completed:break
                        if current.state=='GAME_OVER':raise ValueError('Environment GAME_OVER')
                    durable(out/f'packet-{revision}.json',{'frames':[p.frame_rows for p in packet],'local_only':True})
                    selected_revision=revision
                    if current.levels_completed==source_level:
                        before={'mismatches':['G_terminal'],'constraints':before_constraints}
                        revision,retro=retrospective(memory,bridge,episode,planner,before,current,revision,source_level)
                        retros.append(retro);durable(out/f'retrospective-level-{source_level}.json',retro)
                        if current.levels_completed<target:scenes.append({'level':current.level,**planner.start(current.frame_rows)})
                    decisions.append({'revision':selected_revision,'level':source_level,'recipe':chosen['recipe'],'actions':len(packet)-1,'first_action_ms':first_ms,'full_set_ms':(time.perf_counter()-begin)*1000,'model_calls':len(receipt['decision']['model_calls']),'interruption':interruption,'action_elapsed_ms':action_times})
                    revision+=1
                if current.levels_completed>=target:status=f'L{target}_passed'
                elif actions>=plan['max_actions']:reason='admitted_action_cap'
                frozen(plan)
                report={'status':status,'reason':reason,'game':game,'target_score':target,'max_actions':plan['max_actions'],'initial':initial,'final':current.to_dict(),'actions':actions,'level_actions':level_actions,'level_elapsed_s':level_times,'decisions':decisions,'mechanisms':planner.effects,'retrospectives':retros,'goal_transfers':transfers,'continuous_src_store':True,'load_ms':0,'model_loaded':False,'scenes':scenes,'elapsed_s':time.perf_counter()-started,'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions]),'qualification':'experimental declared reflection family with observed pixel reconciliation, real SRC and persistent memory; no Laya neural call; not production V5','oracle_read_at_runtime':False,'production_v5_modified':False,'internal_payload_consumed':False}
                durable(out/'report.json',report);print(pack({k:report[k] for k in ('status','actions','level_actions','level_elapsed_s','elapsed_s','latency_to_first_action')}))
        except BaseException as exc:
            if current:durable(out/'failure-observation.json',{'rows':current.frame_rows,'local_only':True})
            durable(out/'failure.json',{'error':repr(exc),'traceback':traceback.format_exc(),'actions':actions,'level_actions':level_actions,'last_observation':current.to_dict() if current else None,'decisions':decisions,'scenes':scenes,'status':'stopped'})
            raise
        finally:
            if memory is not None:memory.close()

if __name__=='__main__':main()
