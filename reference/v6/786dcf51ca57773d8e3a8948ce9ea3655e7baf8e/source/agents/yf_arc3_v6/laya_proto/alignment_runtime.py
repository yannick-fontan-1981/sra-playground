"""Fresh official-environment experiment using observed geometry and declared goals.

No oracle, recorded route, fixed palette, coordinate or rotation count is read.
The small JSON policy is experimental declarative authority, not production DRM.
"""
import copy
import json
import os
from pathlib import Path
import sys
import time
import traceback
from benchmark import durable, source_plan, quantiles
from catalog import REPO, sha
from composition import CompositionEngine
from geometric_observer import alignment_scene, components, moved_body, matching_rules, grid_paths, rotate
from memory import Memory, pack
from src_bridge import SrcBridge
from train_geometry import INSTRUCTIONS

POLICY_PATH = Path(__file__).with_name("roles_goals.drm.json")


def serial(value):
    if isinstance(value,(set,frozenset)): return sorted(value)
    if isinstance(value,dict): return {k:serial(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)): return [serial(v) for v in value]
    return value


class AlignmentEngine(CompositionEngine):
    def src_laya(self, session):
        import torch
        r=session["request"]
        labels={"T"+str(i):key for i,key in enumerate(r["candidates"])}
        q={"next":{"type":"choice","instructions":INSTRUCTIONS,"criteria":{
            label:r["bundles"][key]["purpose"] for label,key in labels.items()}}}
        torch.cuda.synchronize(); start=time.perf_counter()
        response=self.agent.system_one(pack(r["alignment_context"]),q,max_len=512,head_max_len=256)
        torch.cuda.synchronize(); elapsed=(time.perf_counter()-start)*1000
        usage=response["usage"]
        if usage.get("truncated") or usage.get("state_tokens_dropped") or usage.get("truncated_questions"):
            raise RuntimeError("Alignment input truncated")
        result=response["answers"]["next"]
        return {"key":labels[result["choice"]],"method":"laya","model_ms":elapsed,"usage":usage,
                "prompt":r["alignment_context"],"question":q,"response":result}


def candidate_contacts(rows,scene,body,step,cells,paths):
    targets=[]
    for point,values in cells.items():
        if point==tuple(body["center"]) or point==tuple(scene["target"]["center"]): continue
        x,y=point; half=step//2
        small=[p for p in scene["parts"] if p["area"]<=step*step
               and p["color"]!=scene["substrate"]["color"]
               and x-half<=p["bbox"][0]<=p["bbox"][2]<=x+half
               and y-half<=p["bbox"][1]<=p["bbox"][3]<=y+half]
        if small and point in paths and paths[point]:
            targets.append({"point":list(point),"path":paths[point],"parts":[p["id"] for p in small]})
    return targets


def create_portfolio(scene,body,step,rows,policy,revision,mechanisms):
    facts={"control_known":body is not None,"aligned":scene["aligned"]}
    rules=matching_rules(policy["portfolio_rules"],facts)
    candidates=[]
    for rule in rules:
        recipe=rule["recipe"]
        if recipe=="calibrate_control":
            candidates += [(rule,["ACTION1","ACTION2"],"C_control","Observer l'effet de deux commandes verticales opposées sur les compositions de la scène.",None),
                           (rule,["ACTION3","ACTION4"],"C_control","Observer l'effet de deux commandes horizontales opposées sur les compositions de la scène.",None)]
        else:
            cells,paths=grid_paths(rows,scene,body,step)
            if recipe=="contact_candidate":
                for contact in candidate_contacts(rows,scene,body,step,cells,paths):
                    candidates.append((rule,contact["path"],"C_contact_"+str(len(candidates)),
                        "Approcher et contacter le mécanisme, puis mesurer son effet encore inconnu sur l'affichage.",contact))
            elif recipe=="enter_target":
                target=tuple(scene["target"]["center"])
                if target not in paths: continue
                path=paths[target]
                # Exact check against contact positions whose observed effect
                # would invalidate the currently satisfied composition.
                cursor=list(body["center"]); preserved=True
                for a in path:
                    dx,dy={"ACTION1":(0,-step),"ACTION2":(0,step),"ACTION3":(-step,0),"ACTION4":(step,0)}[a]
                    cursor=[cursor[0]+dx,cursor[1]+dy]
                    if any(m["point"]==cursor and m.get("observed_rotation") for m in mechanisms): preserved=False
                if preserved and path:
                    candidates.append((rule,path,"C_entry","Rejoindre puis entrer dans la cible, en conservant l'affichage actuel.",None))
    bundles={}
    comps=[{"id":g["id"],"things":["controlled_body","display","target"],"properties":{"definition":g["composition"]},
            "relations":[g.get("parent","root")],"context":"current observed scene","knowledge_status":"hypothesis","role":"objective"} for g in policy["goals"]]
    for i,(rule,actions,ref,purpose,contact) in enumerate(candidates):
        if len(actions)>policy["execution"]["max_bundle_actions"]: continue
        if ref not in {c["id"] for c in comps}:
            comps.append({"id":ref,"things":["controlled_body", "contact_carrier"],"properties":{"purpose":purpose},
                          "relations":["contributes to "+rule["goal"]],"context":"current observed scene",
                          "knowledge_status":"hypothesis","role":"intermediate","observed":False,"open_question":"effect or satisfaction"})
        key="B"+str(i); preserve=rule.get("preserve",[])
        bundles[key]={"id":key,"operation_key":rule["operation"],"composition_ref":ref,"objective_ref":rule["goal"],
            "preserve_refs":preserve,"observation_revision":revision,"kind":"probe" if rule["operation"]=="OP18" else "realize",
            "actions":actions,"purpose":purpose,"preconditions":{"source_rule_applicable":True},
            "preservation_evidence":{p:"observed equality and path excludes known effect carriers" for p in preserve},
            "evidence":["declared-rule:"+rule["recipe"],"observation-revision:"+str(revision)],
            "recipe":rule["recipe"],"contact":contact,"stop_on":["official_level_boundary","unavailable_action","motion_divergence"]}
    return comps,bundles,rules


def main():
    out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=False)
    checkpoint=Path(sys.argv[2]).resolve()
    policy=json.loads(POLICY_PATH.read_text())
    target_score=int(sys.argv[3]) if len(sys.argv)>3 else 1
    max_actions=int(sys.argv[4]) if len(sys.argv)>4 else policy['execution']['max_actions']
    if target_score<1 or max_actions<1:raise ValueError('Invalid admitted target/cap')
    planner=None
    if target_score>1:
        from resource_alignment import ResourcePlanner, ContinuousEngine, bind_retained_goal, retrospect_level, EXTENSION_PATH
        planner=ResourcePlanner(policy)
    if target_score>2:
        from composition_effects import CompositionEffectsPlanner, EFFECTS_PATH
        planner=CompositionEffectsPlanner(policy)
    plan=source_plan();plan.update(policy_sha=sha(POLICY_PATH),checkpoint=str(checkpoint),checkpoint_sha=sha(checkpoint/"model.safetensors"))
    plan.update(target_score=target_score,max_actions=max_actions,explicit_action_cap_argument=len(sys.argv)>4,
                level_seconds=policy['execution']['max_level_seconds'],max_bundle_actions=policy['execution']['max_bundle_actions'])
    if planner:plan['resource_policy_sha']=sha(EXTENSION_PATH)
    if target_score>2:plan['effects_policy_sha']=sha(EFFECTS_PATH)
    from tools.yf_v5_env_bridge import OfficialEnvSession
    game_source=REPO.parent/'arc-agi-current/environment_files/ls20/9607627b/ls20.py'
    plan["environment_source_sha"]=sha(game_source)
    durable(out/'plan.json',plan)
    from agents.yf_arc3_v6.__main__ import session_slot
    with session_slot() as lease:
        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease})
        memory=None
        try:
            import laya,torch
            start_load=time.perf_counter()
            agent=laya.load(str(checkpoint),device='cuda',backend='eager')
            torch.cuda.synchronize();load_ms=(time.perf_counter()-start_load)*1000
            memory=Memory(out/'memory.sqlite3');memory.import_catalog()
            engine=ContinuousEngine(memory,agent) if planner else AlignmentEngine(memory,agent)
            bridge=SrcBridge(engine,continuous=planner is not None)
            env=OfficialEnvSession('ls20-9607627b');current=env.reset()
            initial=current.to_dict();body=None;step=None;mechanisms=[];decisions=[];revision=1;action_count=0
            started=time.perf_counter();status='unresolved';reason=None
            level_started=started;all_mechanisms=[];retrospectives=[];goal_transfers=[];level_actions={}
            scene=alignment_scene(current.frame_rows,policy)
            if planner:body=planner.start_level(current.level,current.frame_rows,scene,body)
            durable(out/'initial-compositions.json',serial({k:v for k,v in scene.items() if k!='parts'}))
            episode='ls20-geometric'
            with (out/'execution.jsonl').open('x',encoding='utf8') as journal:
                while current.levels_completed<target_score and action_count<max_actions:
                    if time.perf_counter()-level_started>=policy['execution']['max_level_seconds']:
                        reason='level_deadline';break
                    decision_start=time.perf_counter()
                    if planner:comps,bundles,rules=planner.portfolio(current.frame_rows,scene,body,step,revision,mechanisms)
                    else:comps,bundles,rules=create_portfolio(scene,body,step,current.frame_rows,policy,revision,mechanisms)
                    if not bundles:
                        reason='no_source_admissible_composition_bundle';break
                    roles=scene['roles']+([{'role':'controlled_body','status':'observed_control_relation','evidence':body}] if body else [])
                    goal_transfer=bind_retained_goal(memory,episode,comps,scene,current.level) if planner else None
                    if goal_transfer:goal_transfers.append(goal_transfer)
                    for b in bundles.values():
                        b['level_epoch']=current.level
                        if goal_transfer:b['goal_transfer']=goal_transfer
                    facts={'compositions':comps,'facts':{'source_rule_applicable':True},'observation_revision':revision,
                           'level_epoch':current.level,
                           'roles':roles,'geometric_residual':scene['residual'],
                           'bundles':[{**b,'admitted':True} for b in bundles.values()]}
                    memory.put(episode,'state',facts,evidence=current.frame_hash,revision=revision)
                    memory.put(episode,'roles',roles,evidence=current.frame_hash,revision=revision)
                    if planner:
                        memory.put(episode,'resource_state',{'level_epoch':current.level,'cost':planner.cost,'cost_evidence':planner.cost_evidence,
                            'capacity':planner.capacity,'current_indicator':planner.measure_indicator(current.frame_rows,scene),
                            'carriers':serial(list(planner.instances.values())),'effect_templates':planner.effect_templates},evidence=current.frame_hash,revision=revision)
                    context={'but_principal':'corps dans la cible avec affichage compatible',
                             'roles':{'body':'contrôle observé' if body else 'contrôle inconnu','display':'affichage courant supposé','target':'cible supposée'},
                             'composition_courante':{'forme_compatible':True,'orientation_compatible':scene['aligned'],'couleur_compatible':scene['residual']['color_equal']},
                             'mecanisme':{'effet_connu':bool(mechanisms),'effet_observe':'rotation compatible' if mechanisms else 'inconnu'},
                             'preserver':['accord géométrique'] if scene['aligned'] else []}
                    if goal_transfer:context['but_principal']=goal_transfer['pattern']
                    receipt=bridge.run({'episode':episode,'id':f'choice-{revision}','policy':'hybrid','kind':'alignment',
                        'level_epoch':current.level,
                        'context':'Choisir une contribution de composition au but principal','alignment_context':context,
                        'bundles':bundles,'candidates':list(bundles),'relevant_compositions':[g['id'] for g in policy['goals']]})
                    d=receipt['decision']
                    if d['status']!='action_set_released': reason='source_release_refused';break
                    chosen=d['action_set']
                    if chosen!=bundles[chosen['id']]: raise RuntimeError('Frozen bundle identity violated')
                    durable(out/f'decision-{revision}.json',receipt)
                    packet=[current];first_action_ms=None;interruption=None
                    source_level=current.level;next_level_started=None
                    guard_body=body
                    for action_index,action in enumerate(chosen['actions']):
                        if current.level!=source_level or current.levels_completed>=target_score or current.state in {'WIN','GAME_OVER'}: break
                        if action not in current.available_action_refs: interruption='unavailable_action';break
                        if action_count>=max_actions or time.perf_counter()-level_started>=policy['execution']['max_level_seconds']:
                            interruption='declared_cap';break
                        journal.write(pack({'event':'dispatch','revision':revision,'bundle':chosen['id'],'action':action})+'\n');journal.flush();os.fsync(journal.fileno())
                        current=env.step(action);action_count+=1;packet.append(current)
                        level_actions[str(source_level)]=level_actions.get(str(source_level),0)+1
                        if current.level!=source_level:next_level_started=time.perf_counter()
                        if first_action_ms is None:first_action_ms=(time.perf_counter()-decision_start)*1000
                        journal.write(pack({'event':'observation','action':action,**current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())
                        if body is not None and current.level==source_level:
                            # A cheap mechanical expectation guard, not a new
                            # semantic decision in the middle of the set.
                            try:
                                if getattr(planner,'advanced',False):
                                    motion,interruption=planner.motion(packet[-2],current,guard_body,action,chosen,action_index,step)
                                else:
                                    motion=moved_body(components(packet[-2].frame_rows),components(current.frame_rows),guard_body['bbox'])
                                    expected_motion={'ACTION1':[0,-step],'ACTION2':[0,step],'ACTION3':[-step,0],'ACTION4':[step,0]}[action]
                                    if motion['translation']!=expected_motion:interruption='motion_divergence'
                                guard_body=motion
                            except ValueError:interruption='motion_unresolved'
                            if interruption:break
                    durable(out/f'packet-{revision}.json',{'frames':[p.frame_rows for p in packet],
                        'official_responses':[p.frame_packet for p in packet] if getattr(planner,'advanced',False) else [],'local_only':True})
                    measure_start=time.perf_counter()
                    crossed=current.level!=source_level
                    next_scene=None;rotation=[]
                    if not crossed:
                        next_scene=alignment_scene(current.frame_rows,policy,
                            guard_body['bbox'] if getattr(planner,'advanced',False) and guard_body else None)
                        # Reconcile all observed transitions only after the sealed set.
                        translations=[]
                        tracked_body=body
                        if getattr(planner,'advanced',False):body=guard_body
                        for a,b in ([] if getattr(planner,'advanced',False) else zip(packet,packet[1:])):
                            try:
                                tracked_body=moved_body(components(a.frame_rows),components(b.frame_rows),tracked_body['bbox'] if tracked_body else None)
                                translations.append(tracked_body)
                            except ValueError:pass
                        if translations:
                            body=translations[-1]
                            measured={max(abs(x) for x in m['translation']) for m in translations}
                            if len(measured)!=1:raise RuntimeError('Inconsistent movement calibration')
                            new_step=next(iter(measured))
                            if step is not None and step!=new_step:raise RuntimeError('Movement calibration changed')
                            step=new_step
                        elif chosen['recipe']=='calibrate_control':
                            reason='control_unresolved';break
                        if chosen['recipe']=='contact_candidate':
                            turns=[r for r in range(4) if rotate(scene['display']['mask'],r)==next_scene['display']['mask']]
                            mechanism={'point':chosen['contact']['point'],'observed_rotation':[r for r in turns if r],
                                'color_preserved':scene['display']['color']==next_scene['display']['color'],
                                'status':'observed_contact_effect_association','scope':'this scene and sealed path',
                                'causal_certainty':'hypothesis; multiple events in path','evidence':[packet[0].frame_hash,current.frame_hash],
                                'falsifier':'repeat contact in equivalent context produces a different effect'}
                            mechanisms.append(mechanism)
                            all_mechanisms.append({'level':source_level,**mechanism})
                            rotation=mechanism['observed_rotation']
                            memory.put(episode,'mechanism:'+str(source_level)+':'+str(len(mechanisms)),mechanism,evidence='sealed-path-observation',revision=revision+1)
                    if planner:
                        learned=planner.observe(packet,scene,next_scene,body,chosen,rotation)
                        memory.put(episode,'last_set_learning',learned,evidence='sealed-prefix-reconciliation',revision=revision+1)
                    if crossed and planner:
                        revision,retrospective=retrospect_level(bridge,memory,episode,policy,scene,packet,chosen,revision,source_level)
                        retrospectives.append(retrospective)
                        durable(out/f'retrospective-level-{source_level}.json',retrospective)
                        if current.levels_completed<target_score:
                            next_scene=alignment_scene(current.frame_rows,policy)
                            body=planner.start_level(current.level,current.frame_rows,next_scene,body)
                            mechanisms=[];level_started=next_level_started
                    if next_scene is not None:scene=next_scene
                    reconciliation_ms=(time.perf_counter()-measure_start)*1000
                    decisions.append({'revision':chosen['observation_revision'],'level':source_level,'recipe':chosen['recipe'],'actions':len(packet)-1,'first_action_ms':first_action_ms,
                        'full_set_ms':(time.perf_counter()-decision_start)*1000,'src_choice_ms':receipt['total_ms'],
                        'reconciliation_ms':reconciliation_ms,'model_calls':len(d['model_calls']),
                        'model_ms':[c['model_ms'] for c in d['model_calls']],'interruption':interruption})
                    revision+=1
                    memory.put(episode,'last_observation',current.to_dict(),evidence=current.frame_hash,revision=revision)
                    if interruption:reason=interruption;break
                if current.levels_completed>=target_score:status='L'+str(target_score)+'_passed'
                elif action_count>=max_actions:reason='admitted_action_cap'
                if sha(game_source)!=plan['environment_source_sha'] or sha(POLICY_PATH)!=plan['policy_sha']:
                    raise RuntimeError('Consumed source changed')
                if planner and sha(EXTENSION_PATH)!=plan['resource_policy_sha']:raise RuntimeError('Resource policy changed')
                if target_score>2 and sha(EFFECTS_PATH)!=plan['effects_policy_sha']:raise RuntimeError('Effects policy changed')
                report={'status':status,'reason':reason,'initial':initial,'final':current.to_dict(),'actions':action_count,
                        'target_score':target_score,'max_actions':max_actions,'level_actions':level_actions,
                        'decisions':decisions,'mechanisms':all_mechanisms,'retrospectives':retrospectives,'goal_transfers':goal_transfers,
                        'composition_effects':getattr(planner,'effect_observations',[]),
                        'continuous_src_store':planner is not None,'load_ms':load_ms,'elapsed_s':time.perf_counter()-started,
                        'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions if d['first_action_ms'] is not None]),
                        'qualification':'experimental symbolic composition agent with optional trained Laya routing; not production V5 integration',
                        'oracle_read_at_runtime':False,'production_v5_modified':False}
                durable(out/'report.json',report)
                print(pack({k:report[k] for k in ['status','reason','actions','elapsed_s','latency_to_first_action']}),flush=True)
        except BaseException as exc:
            durable(out/'failure.json',{'error':repr(exc),'traceback':traceback.format_exc(),'status':'stopped'})
            raise
        finally:
            if memory is not None:memory.close()


if __name__=='__main__':main()
