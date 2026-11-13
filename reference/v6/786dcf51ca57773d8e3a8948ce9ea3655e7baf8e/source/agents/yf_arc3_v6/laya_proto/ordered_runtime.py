"""Bounded official-environment caller for the ordered-support prototype."""
import json,os,sys,time,traceback
from pathlib import Path
from benchmark import durable,source_plan,quantiles
from catalog import REPO,sha
from memory import Memory,pack
from composition import CompositionEngine
from src_bridge import SrcBridge
from ordered_support import OrderedPlanner,scene,POLICY_PATH


class OrderedEngine(CompositionEngine):
    def prepare(self,request):
        result=super().prepare(request)
        level=result['state']['level_epoch']
        if result.get('level_epoch')!=level or any(b.get('level_epoch')!=level for b in result['bundles'].values()):
            raise ValueError('Level binding mismatch')
        if level>1 and not result.get('retrospective'):
            remembered=self.memory.get(result['episode'],'goal_template')
            goal=next(c for c in result['state']['compositions'] if c['id']=='G_terminal')
            if goal['properties']['definition']!=remembered['value']['pattern'] or goal['goal_memory_revision']!=remembered['revision']:
                raise ValueError('Retained goal was not consumed')
            if remembered['value']['confirmed_level']!=level-1:raise ValueError('Goal from wrong prior level')
        return result


def retrospect(memory,bridge,episode,planner,before,chosen,current,revision,source_level):
    if chosen['recipe']!='extend' or before['prefix']!=before['order'][:-1] or current.levels_completed!=source_level:
        raise ValueError('No terminal-composition explanation for official level boundary')
    proof={'pattern':planner.policy['goals'][0]['composition'],'confirmed_level':source_level,
        'reference_order':before['order'],'status':'supported_by_official_success','causal_limit':'scoped observed success, not universal necessity'}
    receipts=[]
    for op in ['OP29','OP30','OP31']:
        revision+=1
        facts={'level_epoch':source_level,'observation_revision':revision,'facts':{'source_rule_applicable':True},
            'compositions':[{'id':'G_terminal','properties':{'definition':proof['pattern']}}],
            'expected_properties':{'official_level_complete':True},'observed_properties':{'official_level_complete':current.levels_completed==source_level},
            'knowledge_updates':[{'composition_ref':'G_terminal','property':'level_final_goal','value':proof,'revision':revision,'evidence':current.frame_hash}],
            'objective_assessments':[{'composition_ref':'G_terminal','satisfied':True,'feasible':True,'new_evidence':[current.frame_hash]}]}
        memory.put(episode,'state',facts,evidence=current.frame_hash,revision=revision)
        bundle={'id':'R0','operation_key':op,'composition_ref':'G_terminal','objective_ref':'G_terminal','preserve_refs':[],
            'observation_revision':revision,'level_epoch':source_level,'kind':'analysis','actions':[],
            'purpose':'Confronter le but ordonné à la réussite officielle et conserver son patron.',
            'preconditions':{'source_rule_applicable':True},'evidence':[current.frame_hash]}
        receipt=bridge.run({'episode':episode,'id':f'retrospect-{revision}','level_epoch':source_level,'retrospective':True,
            'policy':'hybrid','context':bundle['purpose'],'bundles':{'R0':bundle},'candidates':['R0'],'relevant_compositions':['G_terminal']})
        if receipt['decision']['status']!='composition_analysis':raise ValueError('Retrospective SRC refused')
        receipts.append({'operation':op,'src_status':receipt['src_status'],'result':receipt['decision']['operation_result']})
    persisted=memory.get(episode,'knowledge:G_terminal:level_final_goal')
    if persisted['value']!=proof:raise ValueError('Goal conclusion not persisted by OP30')
    memory.put(episode,'goal_template',persisted['value'],evidence=persisted['evidence'],revision=persisted['revision'])
    return revision,{'completed_level':source_level,'proof':proof,'src_operations':receipts}


def main():
    out=Path(sys.argv[1]).resolve();out.mkdir(exist_ok=False,parents=True)
    checkpoint=Path(sys.argv[2]).resolve();target=int(sys.argv[3]) if len(sys.argv)>3 else 1
    planner=OrderedPlanner();cap=int(sys.argv[4]) if len(sys.argv)>4 else planner.policy['execution']['max_actions']
    plan=source_plan();game='sk48-d8078629'
    game_source=REPO.parent/'arc-agi-current/environment_files/sk48/d8078629/sk48.py'
    plan.update(game=game,target_score=target,max_actions=cap,max_bundle_actions=planner.policy['execution']['max_bundle_actions'],
        level_seconds=planner.policy['execution']['max_level_seconds'],policy_sha=sha(POLICY_PATH),checkpoint=str(checkpoint),
        checkpoint_sha=sha(checkpoint/'model.safetensors'),environment_source=str(game_source),environment_source_sha=sha(game_source))
    durable(out/'plan.json',plan)
    from agents.yf_arc3_v6.__main__ import session_slot
    from tools.yf_v5_env_bridge import OfficialEnvSession
    memory=None;current=None;actions=0;decisions=[];retrospectives=[];transfers=[];level_actions={}
    with session_slot() as lease:
        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease})
        try:
            import laya,torch
            begin=time.perf_counter();agent=laya.load(str(checkpoint),device='cuda',backend='eager')
            torch.cuda.synchronize();load_ms=(time.perf_counter()-begin)*1000
            memory=Memory(out/'memory.sqlite3');memory.import_catalog();episode='ordered-compositions'
            bridge=SrcBridge(OrderedEngine(memory,agent),continuous=True)
            env=OfficialEnvSession(game);current=env.reset();s=scene(current.frame_rows);initial=current.to_dict()
            start=time.perf_counter();level_start=start;revision=1;reason=None;status='unresolved'
            durable(out/'initial-compositions.json',s)
            with (out/'execution.jsonl').open('x',encoding='utf-8') as journal:
                while current.levels_completed<target and actions<cap:
                    begin=time.perf_counter()
                    if begin-level_start>=plan['level_seconds']:reason='level_deadline';break
                    comps,bundles=planner.portfolio(s,revision,current.level)
                    if not bundles:reason='no_admissible_composition';break
                    if current.level>1:
                        saved=memory.get(episode,'goal_template');goal=next(c for c in comps if c['id']=='G_terminal')
                        goal['properties']['definition']=saved['value']['pattern'];goal['goal_memory_revision']=saved['revision']
                        transfer={'confirmed_level':saved['value']['confirmed_level'],'current_level':current.level,
                            'memory_revision':saved['revision'],'pattern':saved['value']['pattern'],'current_reference':s['order']}
                        for b in bundles.values():b['goal_transfer']=transfer
                        transfers.append(transfer)
                    memory.put(episode,'state',{'level_epoch':current.level,'observation_revision':revision,'facts':{'source_rule_applicable':True},'compositions':comps,
                        'memory_hint':{'reference_order':s['order'],'observed_prefix':s['prefix'],'vertical_known':planner.vertical_step is not None,
                            'extension_known':planner.extension_step is not None}},evidence=current.frame_hash,revision=revision)
                    receipt=bridge.run({'episode':episode,'id':f'choice-{revision}','level_epoch':current.level,'policy':'hybrid',
                        'context':'Construire sur le support la suite ordonnée de la référence. Choisir une contribution ou une expérience utile.',
                        'bundles':bundles,'candidates':list(bundles),'relevant_compositions':['G_terminal','G_information']})
                    if receipt['decision']['status']!='action_set_released':reason='source_release_refused';break
                    chosen=receipt['decision']['action_set']
                    if chosen!=bundles[chosen['id']]:raise ValueError('Frozen action-set identity changed')
                    if len(chosen['actions'])>plan['max_bundle_actions']:raise ValueError('Bundle exceeds declared cap')
                    durable(out/f'decision-{revision}.json',receipt)
                    packet=[current];before=s;source_level=current.level;first_ms=None;interruption=None
                    for action in chosen['actions']:
                        if actions>=cap or time.perf_counter()-level_start>=plan['level_seconds']:interruption='declared_cap';break
                        if action not in current.available_action_refs:raise ValueError('Unavailable released action')
                        journal.write(pack({'event':'dispatch','revision':revision,'action':action,'level':source_level})+'\n');journal.flush();os.fsync(journal.fileno())
                        current=env.step(action);packet.append(current);actions+=1
                        level_actions[str(source_level)]=level_actions.get(str(source_level),0)+1
                        if first_ms is None:first_ms=(time.perf_counter()-begin)*1000
                        journal.write(pack({'event':'observation',**current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())
                        if current.level!=source_level:level_start=time.perf_counter();break
                        s=scene(current.frame_rows,before['separator_y'],before['reference_members'],before['fixed_supports'])
                        if s['prefix'][:len(before['prefix'])]!=before['prefix']:raise ValueError('Prefix preservation failed')
                        if s['auxiliary_members'] and (chosen['objective_ref']!='G_release' or before['prefix']):
                            raise ValueError('Auxiliary intersection outside declared access composition')
                        if current.state in {'WIN','GAME_OVER'}:interruption='terminal_state';break
                    durable(out/f'packet-{revision}.json',{'frames':[p.frame_rows for p in packet],'local_only':True})
                    selected_revision=revision
                    if current.level!=source_level:
                        revision,retrospective=retrospect(memory,bridge,episode,planner,before,chosen,current,revision,source_level)
                        retrospectives.append(retrospective);durable(out/f'retrospective-level-{source_level}.json',retrospective)
                        if current.levels_completed<target:s=scene(current.frame_rows)
                    else:
                        learned=planner.observe(before,s,chosen,[packet[0].frame_hash,current.frame_hash])
                        memory.put(episode,'mechanism:'+str(revision),learned,evidence=current.frame_hash,revision=revision)
                    decisions.append({'revision':selected_revision,'level':source_level,'recipe':chosen['recipe'],
                        'actions':len(packet)-1,'first_action_ms':first_ms,'full_set_ms':(time.perf_counter()-begin)*1000,
                        'model_calls':len(receipt['decision']['model_calls']),'model_ms':[c['model_ms'] for c in receipt['decision']['model_calls']],
                        'interruption':interruption})
                    revision+=1
                    if interruption:reason=interruption;break
                if current.levels_completed>=target:status=f'L{target}_passed'
                elif actions>=cap:reason='admitted_action_cap'
                if sha(POLICY_PATH)!=plan['policy_sha'] or sha(game_source)!=plan['environment_source_sha']:raise ValueError('Consumed policy/environment changed')
                report={'status':status,'reason':reason,'game':game,'target_score':target,'max_actions':cap,'initial':initial,'final':current.to_dict(),
                    'actions':actions,'level_actions':level_actions,'decisions':decisions,'mechanisms':planner.effects,'retrospectives':retrospectives,
                    'goal_transfers':transfers,'continuous_src_store':True,'load_ms':load_ms,'elapsed_s':time.perf_counter()-start,
                    'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions]),
                    'qualification':'experimental ordered-support symbolic prototype with optional Laya routing; not production V5',
                    'oracle_read_at_runtime':False,'production_v5_modified':False}
                durable(out/'report.json',report)
                print(pack({k:report[k] for k in ['status','reason','actions','level_actions','elapsed_s','latency_to_first_action']}),flush=True)
        except BaseException as exc:
            if current is not None:
                durable(out/'failure-observation.json',{'rows':current.frame_rows,'official_responses':current.frame_packet,'local_only':True})
            durable(out/'failure.json',{'error':repr(exc),'traceback':traceback.format_exc(),'actions':actions,
                'level_actions':level_actions,'last_observation':current.to_dict() if current else None,'status':'stopped'})
            raise
        finally:
            if memory is not None:memory.close()

if __name__=='__main__':main()
