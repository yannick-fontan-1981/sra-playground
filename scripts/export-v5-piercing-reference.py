#!/usr/bin/env python3
"""Export exact pinned V5 component results on small synthetic contracts.

Only the non-staged subgraph consumed by RootedLine is exercised. No game,
game specification, authored level or solution is read or executed.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from agents.yf_arc3_v5.capabilities.contracts import (
    PiercingConfiguration, PiercingCommandEffect, PiercingConditionalModel,
    PiercingStepInput, PiercingGoalInput, PiercingIntersectionInput,
    PiercingPlanSearchInput,
)
from agents.yf_arc3_v5.capabilities.piercing_plan import (
    _simulate_model, measure_piercing_goal, search_piercing_plans,
)
from agents.yf_arc3_v5.capabilities.piercing_rooted_order import measure_piercing_intersections
from src_bridge import plain


def sha(value): return hashlib.sha256(value).hexdigest()
def verify_source():
    for name, expected in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == expected['sha256'], name
    return len(MANIFEST)


def run_export():
    verified = verify_source(); cases = []
    domain = [[r,c] for r in range(5) for c in range(11)]
    base = {'configuration_ref':'synthetic:base',
        'rods':[{'rod_ref':'rod','root_ref':'root','root_to_tip_positions':[[2,1],[2,2],[2,3]]}],
        'pieces':[{'piece_ref':'piece:A','type_ref':'A','occupied_positions':[[2,5]],'support_refs':[]}],
        'domain_positions':domain,'root_footprints':[['root',[[2,0]]]],
        'root_admissible_positions':[['root',domain]],'movable_piece_refs':['piece:A']}
    declared = {'model_ref':'conditional:complete','source_model_ref':'synthetic:declared-rule',
        'push_enabled':True,'entry_enabled':True,'entry_requires_stop':False,
        'entry_attaches':True,'carry_on_root_translation':True,'retain_on_retraction':True,
        'withdraw_requires_reverse_stop':True,'possible_support_mode':'carried',
        'evidence_refs':['synthetic:rule-evidence'],'falsifier_refs':['synthetic:projection-mismatch']}
    extension = {'effect_ref':'effect:extend','action_ref':'EXTEND','rod_ref':'rod',
        'axis_direction':[0,1],'extent_delta':1,'extent_cross_section_offsets':[[0,0]],
        'evidence_refs':['synthetic:observed-command']}
    def cfg(**changes): return {**copy.deepcopy(base),**copy.deepcopy(changes)}
    def mod(**changes): return {**copy.deepcopy(declared),**copy.deepcopy(changes)}
    def eff(**changes): return {**copy.deepcopy(extension),**copy.deepcopy(changes)}
    def add(name,op,args,expected):
        cases.append({'id':name,'operation':op,'arguments':plain(args),'expected':plain(expected)})
    for name, cls, value in [
        ('configuration:defaults',PiercingConfiguration,{'configuration_ref':'empty','rods':[],'pieces':[]}),
        ('configuration:full',PiercingConfiguration,base),
        ('effect:defaults',PiercingCommandEffect,{'effect_ref':'minimal','action_ref':'MINIMAL','rod_ref':'rod','axis_direction':[0,1]}),
        ('effect:full',PiercingCommandEffect,eff(action_data={'nested':{'v':[1,True,None]}},resource_cost=0,source_profile_refs=['profile:one'])),
        ('model:defaults',PiercingConditionalModel,{'model_ref':'unknown'}),
        ('model:full',PiercingConditionalModel,declared),
    ]: add(name,name.split(':')[0],{'value':value},cls.model_validate(value).model_dump())
    def simulate(name,configuration=None,effect=None,model=None,**limits):
        model=PiercingConditionalModel.model_validate(declared if model is None else model)
        request=PiercingStepInput.model_validate({'configuration':base if configuration is None else configuration,
            'effect':extension if effect is None else effect,'models':[model.model_dump()],
            'max_microsteps':8,**limits})
        add('simulate:'+name,'simulate',{'request':request.model_dump(),'model':model.model_dump()},_simulate_model(request,model).model_dump())
    simulate('free_extension')
    simulate('entry_precedes_push',effect=eff(extent_delta=2))
    simulate('push_only',effect=eff(extent_delta=3),model=mod(entry_enabled=False))
    simulate('push_disabled',effect=eff(extent_delta=2),model=mod(push_enabled=False,entry_enabled=False))
    simulate('push_unknown',effect=eff(extent_delta=2),model=mod(push_enabled=None,entry_enabled=False))
    simulate('entry_requires_stop_but_piece_movable',effect=eff(extent_delta=2),model=mod(entry_requires_stop=True))
    simulate('entry_after_stop',configuration=cfg(movable_piece_refs=[]),effect=eff(extent_delta=2),model=mod(entry_requires_stop=True))
    simulate('entry_unknown',configuration=cfg(movable_piece_refs=[]),effect=eff(extent_delta=2),model=mod(entry_enabled=None,entry_requires_stop=None))
    simulate('attachment_unknown',effect=eff(extent_delta=2),model=mod(entry_attaches=None))
    simulate('traverse_without_attachment',effect=eff(extent_delta=2),model=mod(entry_attaches=False))
    simulate('microstep_bound',effect=eff(extent_delta=3),max_microsteps=1)
    simulate('zero_motion',effect=eff(extent_delta=0))
    simulate('missing_commanded_rod',effect=eff(rod_ref='absent'))
    simulate('unordered_axial_pose',configuration=cfg(rods=[{'rod_ref':'rod','root_ref':'root','root_to_tip_positions':[[2,1],[2,3]]}]))
    simulate('missing_root_footprint',configuration=cfg(root_footprints=[]))
    simulate('missing_piece_pose',configuration=cfg(missing_piece_refs=['piece:missing']))
    simulate('finite_domain_missing',configuration=cfg(domain_positions=None))
    simulate('finite_domain_not_required',configuration=cfg(domain_positions=None),require_finite_domain=False)
    for known in [True,False]:
        simulate('domain_exit_'+str(known).lower(),configuration=cfg(pieces=[],domain_positions=[[r,c] for r in range(5) for c in range(5)],domain_boundary_is_known=known),effect=eff(extent_delta=3))
    simulate('root_admissible_boundary',effect=eff(extent_delta=0,root_translation=[1,0]),configuration=cfg(root_admissible_positions=[['root',[[2,0]]]]))
    simulate('obstacle',configuration=cfg(obstacles=[{'obstacle_ref':'wall','occupied_positions':[[2,4]]}]))
    simulate('scene_conditioned_coordinates',effect=eff(coordinate_scope_ref='coordinate.scene_conditioned'))
    overlap={'piece_ref':'piece:A','type_ref':'A','occupied_positions':[[2,2]],'support_refs':[]}
    possible=cfg(pieces=[overlap],possible_support_pairs=[['rod','piece:A']])
    for mode in ['carried','independent',None]:
        simulate('possible_support_'+str(mode),configuration=possible,effect=eff(extent_delta=0,root_translation=[1,0]),model=mod(possible_support_mode=mode))
    simulate('explicit_support_assignment',configuration=possible,effect=eff(extent_delta=0,root_translation=[1,0]),model=mod(possible_support_mode=None,support_assignments=[['rod','piece:A','carried']]))
    simulate('incomplete_support_assignment',configuration=cfg(pieces=[overlap],possible_support_pairs=[['rod','piece:A'],['rod','piece:missing']]),model=mod(support_assignments=[['rod','piece:A','carried']]))
    simulate('possible_support_missing_body',configuration=cfg(possible_support_pairs=[['rod','piece:absent']]))
    attached={**overlap,'support_refs':['rod']}
    for carry in [True,False,None]:
        simulate('carry_'+str(carry),configuration=cfg(pieces=[attached]),effect=eff(extent_delta=0,root_translation=[1,0]),model=mod(carry_on_root_translation=carry))
    for retain,reverse in [(True,True),(False,False),(False,True),(None,True),(True,None)]:
        simulate('withdraw_'+str(retain)+'_'+str(reverse),configuration=cfg(pieces=[{**attached,'occupied_positions':[[2,3]]}]),effect=eff(extent_delta=-1),model=mod(retain_on_retraction=retain,withdraw_requires_reverse_stop=reverse))
    reverse_cfg=cfg(pieces=[{**attached,'occupied_positions':[[2,3],[3,3]]}],obstacles=[{'obstacle_ref':'rear_stop','occupied_positions':[[3,2]]}])
    simulate('reverse_stop_releases',configuration=reverse_cfg,effect=eff(extent_delta=-1))
    simulate('reverse_stop_not_permitted',configuration=reverse_cfg,effect=eff(extent_delta=-1),model=mod(withdraw_requires_reverse_stop=False))
    simulate('unknown_support_rod',configuration=cfg(pieces=[{**attached,'support_refs':['absent']}]))
    thick=cfg(rods=[{'rod_ref':'rod','root_ref':'root','root_to_tip_positions':[[2,1],[2,2],[2,3]],'rod_footprint_positions':[[2,1],[2,2],[2,3],[3,1],[3,2],[3,3]]}])
    simulate('cross_section_unknown',configuration=thick,effect=eff(extent_cross_section_offsets=None))
    simulate('cross_section_supplied',configuration=thick,effect=eff(extent_cross_section_offsets=[[0,0],[1,0]]))
    chain=cfg(pieces=[{'piece_ref':'piece:A','type_ref':'A','occupied_positions':[[2,4]],'support_refs':[]},{'piece_ref':'piece:B','type_ref':'B','occupied_positions':[[2,5]],'support_refs':[]}],movable_piece_refs=['piece:A','piece:B'])
    simulate('push_chain',configuration=chain,model=mod(entry_enabled=False))
    simulate('push_chain_blocked',configuration={**chain,'obstacles':[{'obstacle_ref':'wall','occupied_positions':[[2,6]]}]},model=mod(entry_enabled=False))
    simulate('diagonal_swept_corner',configuration=cfg(obstacles=[{'obstacle_ref':'corner','occupied_positions':[[3,0]]}]),effect=eff(extent_delta=0,root_translation=[1,1]))
    simulate('combined_translation_extent',effect=eff(extent_delta=2,root_translation=[1,0]))
    def goal(name,configuration,order=('A',),root='root'):
        request=PiercingGoalInput.model_validate({'configuration':configuration,'requested_root_ref':root,'requested_type_order':order})
        add('goal:'+name,'goal',{'request':request.model_dump()},measure_piercing_goal(request).model_dump())
    goal('unattached_overlap',cfg(pieces=[overlap])); goal('supported',cfg(pieces=[attached]))
    goal('predicted_support',cfg(pieces=[attached],is_predicted_configuration=True))
    goal('possible_support',possible)
    goal('hypothetical_support',cfg(pieces=[attached],hypothetical_support_pairs=[['rod','piece:A']]))
    goal('missing_body',cfg(pieces=[attached],missing_piece_refs=['piece:missing']))
    goal('wrong_order',cfg(pieces=[attached]),('B',));goal('unknown_root',cfg(pieces=[attached]),root='missing')
    goal('no_rods',cfg(rods=[]));goal('empty_goal',cfg(pieces=[]),())
    for name,pieces,order in [('contact_without_support',[overlap],['A']),('supported',[attached],['A']),
        ('order_by_rod',[{'piece_ref':'piece:B','type_ref':'B','occupied_positions':[[2,3]],'support_refs':['rod']},attached],['A','B']),
        ('same_index_tie',[{**attached,'piece_ref':'piece:B','type_ref':'B'},attached],['A','B'])]:
        request=PiercingIntersectionInput.model_validate({'rods':base['rods'],'pieces':pieces,'requested_root_ref':'root','requested_type_order':order})
        add('intersections:'+name,'intersections',{'request':request.model_dump()},measure_piercing_intersections(request).model_dump())
    def search(name,configuration=None,effects=None,models=None,**bounds):
        request=PiercingPlanSearchInput.model_validate({'configuration':base if configuration is None else configuration,
            'effects':[extension] if effects is None else effects,'models':[declared] if models is None else models,
            'goal_requested_root_ref':'root','goal_requested_type_order':['A'],
            'max_microsteps':8,'max_depth':3,'max_nodes':24,'max_plans':1,**bounds})
        assert not request.staged_profiles and request.continuation is None
        add('search:'+name,'search',{'request':request.model_dump()},search_piercing_plans(request).model_dump())
    search('two_step_entry');search('initial_goal_zero_effect',configuration=cfg(pieces=[attached]),max_depth=0)
    search('no_effects',effects=[]);search('depth_zero',max_depth=0);search('node_one',max_nodes=1)
    search('microstep_bound',effects=[eff(extent_delta=2)],max_microsteps=1)
    search('unresolved_contact',models=[mod(push_enabled=None,entry_enabled=None)])
    search('effect_sorting',effects=[eff(effect_ref='z',action_ref='Z',extent_delta=2,resource_cost=4),eff(effect_ref='a',action_ref='A',extent_delta=2,resource_cost=1)])
    search('model_sorting',models=[mod(model_ref='z'),mod(model_ref='a')],max_plans=2)
    search('max_plans_path_key',models=[mod(model_ref='z'),mod(model_ref='a')],max_plans=1)
    search('physical_cycle_pruning',effects=[eff(effect_ref='down',extent_delta=0,root_translation=[1,0]),eff(effect_ref='up',extent_delta=0,root_translation=[-1,0])],max_nodes=12,max_depth=4)
    output={'schema':'logos-engine.v5.piercing-source-reference.v1','sourceCommit':COMMIT,
        'sourceFiles':{name:MANIFEST[name]['sha256'] for name in [
            'agents/yf_arc3_v5/capabilities/piercing_plan.py',
            'agents/yf_arc3_v5/capabilities/piercing_rooted_order.py',
            'agents/yf_arc3_v5/capabilities/contracts.py',
            'agents/yf_arc3_v5/logos/types.py']},'cases':cases,
        'originalFilesVerifiedBefore':verified,'originalFilesVerifiedAfter':verify_source(),
        'qualification':'Exact unchanged-source component oracle for synthetic inputs. Only non-staged search consumed by V6 RootedLine; no staged search, continuation, complete inherited caller or game success claim.'}
    target=ROOT/'tests/fixtures/v5-piercing-reference.json.gz'
    target.write_bytes(gzip.compress(json.dumps(output,separators=(',',':'),sort_keys=True).encode(),mtime=0))
    print(json.dumps({'path':str(target.relative_to(ROOT)),'cases':len(cases),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),'originalFilesVerified':verified}))


if __name__=='__main__':run_export()
