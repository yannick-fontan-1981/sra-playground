"""Continuous common-frontier caller; no game-specific planner or visual goal.



Only the transport/provenance boundary sees game_id. Frontier graph writes are

append-only deltas. Public components are reconciled after each sealed prefix;

between primitives the caller applies protocol/path guards, never replanning.

"""

import argparse,hashlib,importlib.metadata,json,os,time,traceback

from collections import Counter

from pathlib import Path

from benchmark import durable,source_plan as prototype_source_plan,quantiles

from catalog import REPO,sha

from memory import Memory,pack

from src_bridge import SrcBridge

from public_session_transport import resolve_transport

from observed_input_domain import ObservedInputDomain

from common_property_rewrites import assess_property_transition,predict_property_rule

from common_point_contrasts import PointExperimentMemory

from common_control_dependencies import ControlDependencies

from common_preservation import bind as bind_preservation,check as check_preservation

from common_evidence_store import EvidenceStore,DATABASE,FORMAT

from prospective_contact_adapter import ProspectiveContactAdapter as GoalAccessAdapter

from target_tree import CompositionTargetTree,TREE_PATH

from target_method import at_boundary

from attention_memory import AttentionMemory

from composition_curiosity import reconcile as reconcile_information_goal

from level_action_budget import parse_level_action_caps,remaining_level_actions,charge_level_action

from terminal_composition import identity as model_identity

from common_view_frontier import ViewFrontier

from neutral_observer import measure,delta,summary

from neutral_probe_runtime import NeutralEngine

from common_mechanisms import assess_transition,predict_candidate_rule,validate_empirical_rule

from common_frontier import ObservedFrontier

from agents.yf_arc3_v6.morphology_policy.strategy import StrategyRouter, HERE as MORPH_POLICY_DIR

from agents.yf_arc3_v6.morphology_policy.policy import PRINCIPLES



POLICY_PATH=Path(__file__).with_name('common_frontier_policy.drm.json')





def source_plan():

    plan=prototype_source_plan(include_neural=False)

    from agents.yf_arc3_v5.drm.loader import production_drm_paths

    for dependency in [*production_drm_paths(),*[REPO/'agents/yf_arc3_v5/capabilities'/name for name in ('framed_masks.py','framed_replacements.py','framed_reception_loci.py','point_motion_spans.py','parallel_bands.py')]]:

        plan['source'][str(dependency.resolve())]=sha(dependency)

    plan['source'][str(TREE_PATH.resolve())]=sha(TREE_PATH)

    morphology_files=[MORPH_POLICY_DIR/name for name in ('__init__.py','adapter.py','geometry.py','policy.py',

        'src_runtime.py','contextual_translation.py','observed_meter.py','rearm_evidence.py','collection_evidence.py','managed_projection.py','managed_capacity.py','motion_contrast.py','strategy.py','strategy.src','strategy.drm','morphology.src','morphology_policy.drm')]

    for path in [*morphology_files,*sorted((MORPH_POLICY_DIR/"selected_rigid").glob("*.py")),*sorted((MORPH_POLICY_DIR/"preview_packing").glob("*.py")),*sorted((MORPH_POLICY_DIR/"preview_packing").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"reactive_contact").rglob("*.py")),*sorted((MORPH_POLICY_DIR/"reactive_contact").rglob("*.drm")),*sorted((MORPH_POLICY_DIR/"reactive_contact").rglob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/reactive_pursuit_observation.py",REPO/"agents/yf_arc3_v5/capabilities/escape_topology.py",*sorted((MORPH_POLICY_DIR/"ordered_reaction").glob("*.py")),*sorted((MORPH_POLICY_DIR/"ordered_reaction").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"ordered_reaction").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/ordered_tip_changes.py",*sorted((MORPH_POLICY_DIR/"ordered_recruitment").glob("*.py")),*sorted((MORPH_POLICY_DIR/"ordered_recruitment").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"ordered_recruitment").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/ordered_front_reduction_d.py",REPO/"agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py",*sorted((MORPH_POLICY_DIR/"window_question").glob("*.py")),*sorted((MORPH_POLICY_DIR/"window_question").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"window_question").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/window_processing_d.py",REPO/"agents/yf_arc3_v5/capabilities/window_processing_primitive_d.py",*sorted((MORPH_POLICY_DIR/"invited_endpoints").glob("*.py")),*sorted((MORPH_POLICY_DIR/"invited_endpoints").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"invited_endpoints").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/endpoint_navigation_d.py",*sorted((MORPH_POLICY_DIR/"joint_channels").glob("*.py")),*sorted((MORPH_POLICY_DIR/"joint_channels").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"joint_channels").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/compatible_source_residual_d.py",REPO/"agents/yf_arc3_v5/capabilities/original_source_equilibrium_d.py",*sorted((MORPH_POLICY_DIR/"temporal_selection").glob("*.py")),*sorted((MORPH_POLICY_DIR/"temporal_selection").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"temporal_selection").glob("*.src")),*sorted((MORPH_POLICY_DIR/"region_intervention").glob("*.py")),*sorted((MORPH_POLICY_DIR/"region_intervention").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"region_intervention").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/autonomous_consumption_d.py",*sorted((MORPH_POLICY_DIR/"chart_navigation").glob("*.py")),*sorted((MORPH_POLICY_DIR/"chart_navigation").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"chart_navigation").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/inventory_gated_navigation.py",*sorted((MORPH_POLICY_DIR/"axial_question").glob("*.py")),*sorted((MORPH_POLICY_DIR/"axial_question").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"axial_question").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/axial_field_configuration.py",*sorted((MORPH_POLICY_DIR/"topological_recolor").glob("*.py")),*sorted((MORPH_POLICY_DIR/"topological_recolor").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"topological_recolor").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/topological_region_recolor.py",REPO/"agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py",*sorted((MORPH_POLICY_DIR/"framed_transfer").glob("*.py")),*sorted((MORPH_POLICY_DIR/"framed_transfer").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"framed_transfer").glob("*.src")),*sorted((MORPH_POLICY_DIR/"outline_service").glob("*.py")),*sorted((MORPH_POLICY_DIR/"outline_service").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"outline_service").glob("*.src")),*sorted((MORPH_POLICY_DIR/"observed_inventory").glob("*.py")),*sorted((MORPH_POLICY_DIR/"observed_inventory").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"observed_inventory").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/navigation_transition_measurements.py",*sorted((MORPH_POLICY_DIR/"symbol_transactions").glob("*.py")),*sorted((MORPH_POLICY_DIR/"symbol_transactions").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"symbol_transactions").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/symbolic_diagrams.py",REPO/"agents/yf_arc3_v5/capabilities/concentric_frames.py",*sorted((MORPH_POLICY_DIR/"ranked_workshop").glob("*.py")),*sorted((MORPH_POLICY_DIR/"ranked_workshop").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"ranked_workshop").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/station_profile_scene.py",REPO/"agents/yf_arc3_v5/capabilities/stem_reliefs.py",*sorted((MORPH_POLICY_DIR/"guarded_binding").glob("*.py")),*sorted((MORPH_POLICY_DIR/"guarded_binding").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"guarded_binding").glob("*.src")),*sorted((MORPH_POLICY_DIR/"station_cargo").glob("*.py")),*sorted((MORPH_POLICY_DIR/"station_cargo").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"station_cargo").glob("*.src")),REPO/"agents/yf_arc3_v5/capabilities/station_gated_cargo.py",REPO/"agents/yf_arc3_v5/capabilities/rigid_grasp_geometry.py",*sorted((MORPH_POLICY_DIR/"discrete_network").glob("*.py")),*sorted((MORPH_POLICY_DIR/"discrete_network").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"discrete_network").glob("*.src")),*sorted((MORPH_POLICY_DIR/"facet_examples").glob("*.py")),*sorted((MORPH_POLICY_DIR/"facet_examples").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"facet_examples").glob("*.src")),*sorted((MORPH_POLICY_DIR/"relative_arrangements").glob("*.py")),*sorted((MORPH_POLICY_DIR/"relative_arrangements").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"relative_arrangements").glob("*.src")),*sorted((MORPH_POLICY_DIR/"visual_sequences").glob("*.py")),*sorted((MORPH_POLICY_DIR/"visual_sequences").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"visual_sequences").glob("*.src")),*sorted((MORPH_POLICY_DIR/"feedback_sequences").glob("*.py")),*sorted((MORPH_POLICY_DIR/"feedback_sequences").glob("*.drm")),*sorted((MORPH_POLICY_DIR/"feedback_sequences").glob("*.src")),MORPH_POLICY_DIR/"partial_correspondence.py",MORPH_POLICY_DIR/"entry_rebind.py",MORPH_POLICY_DIR/"continuation.py",MORPH_POLICY_DIR/"orthogonal_features.py",MORPH_POLICY_DIR/"derive.py",MORPH_POLICY_DIR/"observed_derivations.py",MORPH_POLICY_DIR/"feature_occurrences.py",PRINCIPLES]:

        plan['source'][str(path.resolve())]=sha(path)

    for relative in ('agents/yf_arc3_v6/__main__.py','agents/yf_arc3_v6/common.py','agents/yf_arc3_v6/config.py','agents/yf_arc3_v6/engine.py','agents/yf_arc3_v6/upstream_loader.py','tools/__init__.py','custom_games/__init__.py','tools/manual_oracle_recorder.py','tools/yf_v5_env_bridge.py','tools/official_instance_determinism.py','custom_games/registry.py'):

        path=REPO/relative

        plan['source'][str(path.resolve())]=sha(path)

    for relative in ('agents/yf_arc3_v5/capabilities/typed_word_transduction.py','agents/yf_arc3_v5/capabilities/mechanical_family_contracts_a.py','agents/yf_arc3_v5/logos/types.py'):

        path=REPO/relative

        plan['source'][str(path.resolve())]=sha(path)

    path=REPO/'agents/yf_arc3_v5/capabilities/rigid_marker_pose.py'

    plan['source'][str(path.resolve())]=sha(path)

    plan['source_bundle_sha256']=hashlib.sha256(pack(plan['source']).encode()).hexdigest()

    plan['versions']['numpy']=importlib.metadata.version('numpy')

    return plan





def choose_common(goal_access,frontier,point_experiments,control_dependencies,observation,rows,inputs,registry,

                  remaining,view=None,router=None):

    router=router if router is not None else StrategyRouter()

    obligations=router.preservation_obligations(observation,rows)

    proposal,using_goal,abstention=router.choose(goal_access,frontier,point_experiments,control_dependencies,observation,rows,inputs,registry,remaining,view)

    protected,rejected=bind_preservation(proposal,obligations,observation,rows)

    if rejected:

        revision_inputs={action for obligation in obligations for action in obligation.get("revision_inputs",[])}

        alternatives=[command for command in inputs if command["action_ref"] not in revision_inputs]

        proposal,using_goal,abstention=router.choose(goal_access,frontier,point_experiments,control_dependencies,observation,rows,alternatives,registry,remaining,view)

        protected,conflicts=bind_preservation(proposal,obligations,observation,rows)

        protected["preservation_rejected_candidates"]=rejected

        if conflicts:protected={**protected,"status":"preservation_conflict","actions":[]}

    return protected,using_goal,abstention





def protocol_projection(public,revision,scope):

    return {'revision':revision,'level_epoch':public.level,'frame_hash':public.frame_hash,

        'observation_ref':f'{scope}:epoch:{public.level}:revision:{revision}:frame:{public.frame_hash}',

        'available_action_refs':list(public.available_action_refs),'state':public.state,

        'levels_completed':public.levels_completed,'coordinate_basis':'screen',

        'projection_scope':'protocol_only_between_primitives'}





def main_objective(policy,target):

    return {'id':'G_official_completion','things':['official_progress'],

        'properties':{'definition':policy['provided_objective']['definition'],'target_levels_completed':target,

            'visual_terminal_composition':'unknown'},'relations':[],'role':'objective',

        'knowledge_status':'explicit_user_objective_not_inferred_visual_role'}





def state_compositions(proposal,objective):

    result=list(proposal.get('compositions',[]))

    if not any(c['id']==objective['id'] for c in result):result.append(objective)

    return result





def post_analysis(memory,bridge,episode,observation,revision,objective,record,*,boundary=False):

    focus='C_terminal_witness' if boundary else 'C_observed_response'

    comps=[objective,{'id':focus,'things':['public_before_after_observations','released_prefix'],

        'properties':{'causal_terminal_role':'unknown','scope':'official_boundary_witness' if boundary else 'measured_transition',

            'released_composition_ref':record.get('released_composition_ref')},

        'relations':['contributes_to:G_official_completion'],'role':'evidence_composition'}]

    known_checks=[c for c in record.get('step_expectations',[]) if c['status']!='unknown']

    state={'level_epoch':observation['level_epoch'],'observation_revision':revision,'facts':{},'compositions':comps,

        'expected_properties':{f'path_step_{c["action_index"]}':'matched' for c in known_checks},

        'observed_properties':{**{f'path_step_{c["action_index"]}':c['status'] for c in known_checks},

            'official_levels_completed':observation['levels_completed']},

        'knowledge_updates':[{'composition_ref':focus,'property':'scoped_observation_record','value':record,

            'revision':revision,'evidence':observation['observation_ref']}],

        'objective_assessments':[{'composition_ref':'G_official_completion',

            'satisfied':observation['levels_completed']>=objective['properties']['target_levels_completed'],

            'feasible':'unknown','new_evidence':[observation['observation_ref']]}]}

    receipts=[]

    for op in ('OP29','OP30','OP31'):

        memory.put(episode,'state',state,evidence=observation['observation_ref'],revision=revision)

        bundle={'id':'R0','operation_key':op,'composition_ref':focus,'objective_ref':'G_official_completion',

            'preserve_refs':[],'observation_revision':revision,'level_epoch':observation['level_epoch'],'kind':'analysis',

            'actions':[],'purpose':'Retain scoped observations and reassess official progress without inventing a visual terminal cause.',

            'preconditions':{},'evidence':[observation['observation_ref']]}

        receipt=bridge.run({'episode':episode,'id':f'analysis-{revision}-{op}','level_epoch':observation['level_epoch'],

            'policy':'code_only','context':bundle['purpose'],'bundles':{'R0':bundle},'candidates':['R0'],

            'relevant_compositions':[focus,'G_official_completion']})

        if receipt['decision']['status']!='composition_analysis':raise ValueError('SRC scoped observation analysis refused')

        receipts.append({'operation':op,'src_status':receipt['src_status'],'result':receipt['decision']['operation_result']})

    return receipts





def main():

    parser=argparse.ArgumentParser();parser.add_argument('--game',required=True);parser.add_argument('--output',required=True)

    parser.add_argument('--target-levels',type=int,default=3)

    parser.add_argument('--level-action-caps',required=True,help='One qualified primitive limit per level, comma-separated')

    parser.add_argument('--max-actions',type=int,help='Optional stricter overall primitive ceiling')

    parser.add_argument('--information-goal',choices=('open_questions','accessible_view_frontier'),default='accessible_view_frontier')

    args=parser.parse_args();out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=False)

    policy=json.loads(POLICY_PATH.read_text());target=args.target_levels

    try:caps=parse_level_action_caps(args.level_action_caps,target)

    except ValueError as error:parser.error(str(error))

    limits={str(i):n for i,n in enumerate(caps,1)}

    cap=sum(limits.values()) if args.max_actions is None else min(args.max_actions,sum(limits.values()))

    if cap<1:parser.error('Positive overall action cap required')

    session_factory,environment_sources=resolve_transport(args.game)

    objective=main_objective(policy,target);plan=source_plan();target_tree=CompositionTargetTree()

    domain=ObservedInputDomain(policy['input_domain']['max_point_occurrences']);property_rules=[]

    point_experiments=PointExperimentMemory()

    control_dependencies=ControlDependencies()

    view=ViewFrontier() if args.information_goal=='accessible_view_frontier' else None

    def graph_inputs(obs):

        choices=domain.candidates(obs)

        return [a for a in choices if not a.get('data')] if view is not None and view.has_observed_view_question() else choices

    plan.update(game_transport=args.game,target_levels_completed=target,max_actions=cap,max_bundle_actions=16,level_action_caps=limits,

        level_seconds=360,policy_path=str(POLICY_PATH),policy_sha=sha(POLICY_PATH),

        environment_sources=environment_sources,transport_class=session_factory.__name__,model_loaded=False,planner_selected_by_game=False,

        action_cap_reason='Qualified level-specific oracle bounds, unused primitives expire at boundary',prefix_authority='conditional observed path; stored public protocol expectations with explicit falsifiers',

        candidate_domain=policy['input_domain'],

        game_id_visible_to_reasoning=False,graph_persistence='append_only_deltas; replay_from_SQLite_at_level_boundaries',

        source_context='current composition and path only; no full frontier graph in SRC state')

    plan.update(evidence_format={'manifest_schema':FORMAT,'required_companion_database':DATABASE,

        'manifests':['predictions-before','transition']},terminal_prior_models_loaded=0,terminal_access=policy['terminal_access'])

    plan.update(information_goal=args.information_goal,view_policy=policy['view_frontier'] if view else None)

    durable(out/'plan.json',plan)

    from agents.yf_arc3_v6.__main__ import session_slot

    current=None;memory=None;store=None;actions=0;revision=1;decisions=[];witnesses=[];transfers=[];registry=[];level_actions={}

    usage=Counter();delta_types=Counter();delta_sequence=0;episode='common-observation-frontier';started=time.perf_counter()

    with session_slot() as lease:

        durable(out/'lease.json',{'pid':os.getpid(),'lease':lease})

        try:

            memory=Memory(out/'memory.sqlite3');memory.import_catalog();bridge=SrcBridge(NeutralEngine(memory),continuous=True)

            store=EvidenceStore(out);goal_access=GoalAccessAdapter();goal_event_count=0;goal_sets=0;goal_abstentions=Counter()

            strategy_router=StrategyRouter()

            strategy_router.attention=AttentionMemory(memory,episode)

            memory.put(episode,'main_objective',objective,evidence='explicit-user-official-completion-objective',revision=0)

            memory.put(episode,'composition_target',None,evidence='fresh_episode',revision=0)

            frontier=ObservedFrontier(target_levels=target,max_prefix=16);usage['ObservedFrontier.__init__']+=1

            env=session_factory(args.game);current=env.reset();level_start=time.perf_counter();initial=current.to_dict();last_score_s=level_start;completed_level_seconds={}

            if current.level!=1 or current.levels_completed!=0:raise ValueError('Continuous experiment must begin at fresh L1')

            observation,parts=measure(current,revision,out.name);usage['neutral_observer.measure']+=1

            memory.put(episode,'property_rules',[],evidence=observation['observation_ref'],revision=revision)

            durable(out/f'observation-{revision}.json',{'observation':observation,'local_only':True})

            status='unresolved';reason=None;registry_revision=None

            with (out/'execution.jsonl').open('x',encoding='utf-8') as journal,(out/'frontier-deltas.jsonl').open('x',encoding='utf-8') as delta_stream:

                def persist_deltas():

                    nonlocal delta_sequence

                    events=frontier.drain_deltas();usage['ObservedFrontier.drain_deltas']+=1

                    for event in events:

                        delta_sequence+=1

                        memory.put(episode,f'frontier_delta:{delta_sequence:08d}',event,evidence=observation['observation_ref'],revision=revision)

                        delta_stream.write(pack({'sequence':delta_sequence,'event':event})+'\n')

                        delta_types[str(event.get('kind',event.get('type','unlabelled')))]+=1

                    if events:

                        delta_stream.flush();os.fsync(delta_stream.fileno())

                        memory.put(episode,'frontier_last_sequence',delta_sequence,evidence=observation['observation_ref'],revision=revision)

                    return len(events)

                frontier.observe(observation,graph_inputs(observation));usage['ObservedFrontier.observe']+=1;persist_deltas()

                while current.levels_completed<target and actions<cap:

                    begin=time.perf_counter()

                    level_key=str(current.level)

                    remaining=min(cap-actions,remaining_level_actions(caps,level_actions,current.level))

                    if remaining<=0:reason='oracle_action_cap';break

                    frontier.max_prefix=min(16,remaining)

                    if begin-level_start>=360:reason='level_deadline';break

                    if current.state in {'WIN','GAME_OVER'}:reason='official_terminal';break

                    recalled=memory.get(episode,'main_objective');usage['Memory.get.main_objective']+=1

                    if recalled['value']!=objective:raise ValueError('Retained principal objective changed')

                    if registry_revision is not None:

                        remembered=memory.get(episode,'empirical_registry');usage['Memory.get.empirical_registry']+=1

                        registry=remembered['value'];registry_revision=remembered['revision']

                    inputs=domain.candidates(observation)

                    strategy_router.selected_rigid.level_deadline=level_start+360
                    strategy_router.selected_rigid.remaining_level_actions=remaining_level_actions(caps,level_actions,current.level)
                    strategy_router.settlement.level_deadline=level_start+360
                    strategy_router.settlement.remaining_level_actions=remaining_level_actions(caps,level_actions,current.level)
                    strategy_router.lines.level_deadline=level_start+360
                    strategy_router.supports.acquired_compositions['joint_transport'].level_deadline=level_start+360

                    proposal,using_goal,abstention=choose_common(goal_access,frontier,point_experiments,control_dependencies,observation,current.frame_rows,inputs,registry,remaining,view,strategy_router)

                    if strategy_router.selected_rigid.requested_stop_reason:
                        reason=strategy_router.selected_rigid.requested_stop_reason;break
                    if strategy_router.settlement.requested_stop_reason:
                        reason=strategy_router.settlement.requested_stop_reason;break
                    using_morphology='morphology_plan' in proposal

                    constraint=strategy_router.selected_rigid if "selected_rigid_plan" in proposal else strategy_router.preview_packing if "preview_packing_plan" in proposal else strategy_router.settlement if "shared_settlement_plan" in proposal else strategy_router.reactive if "reactive_plan" in proposal else strategy_router.reaction if "reaction_plan" in proposal else strategy_router.recruitment if "recruitment_plan" in proposal else strategy_router.window_question if "window_question_plan" in proposal else strategy_router.endpoints if "endpoint_plan" in proposal else strategy_router.channels if "channel_plan" in proposal else strategy_router.temporal_selection if "temporal_selection_plan" in proposal else strategy_router.regions if "region_plan" in proposal else strategy_router.chart if "chart_plan" in proposal else strategy_router.axial if "axial_plan" in proposal else strategy_router.recolor if "recolor_plan" in proposal else strategy_router.framed_transfer if "framed_transfer_plan" in proposal else strategy_router.outline_service if "outline_plan" in proposal else strategy_router.supports if "support_plan" in proposal else strategy_router.inventory if "inventory_plan" in proposal else strategy_router.fields if "field_plan" in proposal else strategy_router.symbols if "symbol_transaction_plan" in proposal else strategy_router.preparations if "linked_preparation_plan" in proposal else strategy_router.workshop if "workshop_plan" in proposal else strategy_router.object_binding if "binding_plan" in proposal else strategy_router.constellations if "constellation_plan" in proposal else strategy_router.ports if "port_plan" in proposal else strategy_router.reduction if "reduction_plan" in proposal else strategy_router.cargo if "cargo_plan" in proposal else strategy_router.bands if "band_plan" in proposal else strategy_router.slots if "slot_plan" in proposal else strategy_router.words if "word_plan" in proposal else strategy_router.network if "network_plan" in proposal else strategy_router.facets if "facet_plan" in proposal else strategy_router.arrangements if "arrangement_plan" in proposal else strategy_router.branches if 'branch_plan' in proposal else strategy_router.visual_sequences if "sequence_plan" in proposal else strategy_router.codes if 'code_plan' in proposal else strategy_router.feedback if "feedback_plan" in proposal else strategy_router.motifs if 'motif_plan' in proposal else strategy_router.symmetry if proposal.get("kind")=="public_symmetric_field" else strategy_router.surface if 'surface_plan' in proposal else strategy_router.containment if 'containment_plan' in proposal else strategy_router.orbits if 'orbit_plan' in proposal else strategy_router.windows

                    if any(k in proposal for k in ('line_plan','supported_line_plan','crossed_prefix_plan','marked_collection_plan','program_composition_plan','respondent_probe_plan','occurrence_recall_plan','typed_carrier_plan','material_flow_plan','material_pose_plan','radial_port_plan','nested_control_plan','rooted_quota_plan','framed_window_plan','occluded_catalogue_plan','queued_field_plan','product_panel_plan','labeled_sequence_plan','trace_field_plan','linked_packet_plan','cell_placement_plan','graph_access_plan','pair_access_plan','support_preparation_plan','exposed_reception_plan','chamber_relation_plan','panel_service_plan','rooted_line_plan','reception_service_plan','reference_population_plan')):constraint=strategy_router.lines

                    using_constraints=any(k in proposal for k in ("selected_rigid_plan","preview_packing_plan","shared_settlement_plan","reactive_plan","reaction_plan","recruitment_plan","window_question_plan","endpoint_plan","channel_plan","temporal_selection_plan","region_plan","chart_plan","axial_plan","recolor_plan","framed_transfer_plan","outline_plan","support_plan","field_plan",'symbol_transaction_plan','inventory_plan','linked_preparation_plan','workshop_plan','binding_plan','constellation_plan','port_plan','reduction_plan','cargo_plan','band_plan','slot_plan','word_plan','branch_plan','constraint_plan','orbit_plan','containment_plan','surface_plan','feedback_plan','network_plan','facet_plan','arrangement_plan','sequence_plan','motif_plan','code_plan','line_plan','supported_line_plan','crossed_prefix_plan','marked_collection_plan','program_composition_plan','respondent_probe_plan','occurrence_recall_plan','typed_carrier_plan','material_flow_plan','material_pose_plan','radial_port_plan','nested_control_plan','rooted_quota_plan','framed_window_plan','occluded_catalogue_plan','queued_field_plan','product_panel_plan','labeled_sequence_plan','trace_field_plan','linked_packet_plan','cell_placement_plan','graph_access_plan','pair_access_plan','support_preparation_plan','exposed_reception_plan','chamber_relation_plan','panel_service_plan','rooted_line_plan','reception_service_plan','reference_population_plan'))

                    constraint_name=type(constraint).__name__

                    using_view='view_plan' in proposal

                    usage['GoalAccessAdapter.propose']+=1

                    if using_goal:usage[proposal.get('kind','unknown_geometry')+'.propose.selected']+=1

                    elif using_morphology:usage['MorphologyPolicy.propose.selected']+=1

                    elif using_constraints:usage[constraint_name+'.propose.selected']+=1

                    else:

                        goal_abstentions[abstention]+=1

                        if using_view:usage['ViewFrontier.propose.selected']+=1

                        else:

                            if view is None:usage['PointExperimentMemory.offer']+=1

                            usage['ObservedFrontier.propose']+=1;persist_deltas()

                    if proposal.get('status')!='proposed':reason='frontier_'+str(proposal.get('status','unknown'));break

                    selected_experiment=proposal['question'].get('experiment')

                    selected_control=proposal['question'].get('control_experiment')

                    if using_constraints:constraint.bind(proposal,domain)

                    else:domain.bind_proposal(proposal)

                    target_receipt=target_tree.bind(proposal,observation,objective,memory.get(episode,'composition_target')['value'])

                    proposal['composition_target_tree']=target_receipt

                    memory.put(episode,'composition_target',target_receipt,evidence=observation['observation_ref'],revision=revision)

                    durable(out/f'proposal-{revision}.json',proposal)

                    if not target_receipt['admitted']:reason='composition_target_'+target_receipt['reason'];break

                    if using_goal:

                        guard=goal_access.before(proposal,0,current.frame_rows,epoch=current.level,score=current.levels_completed,available=current.available_action_refs,observation_ref=observation['observation_ref'])

                        usage['check_access_before']+=1

                    elif using_morphology:

                        guard=strategy_router.morph.before(proposal,0,current,observation);usage['MorphologyAdapter.before']+=1

                    elif using_constraints:

                        guard=constraint.before(proposal,0,current,observation);usage[constraint_name+'.before']+=1

                    elif using_view:

                        guard=view.before(proposal,0,current,observation);usage['ViewFrontier.before']+=1

                    else:

                        guard=frontier.guard(proposal,observation,action_index=0);usage['ObservedFrontier.guard']+=1

                    if proposal.get("preservation"):

                        preservation=check_preservation(proposal,current.frame_rows,current.level,observation=observation)

                        if not preservation["admitted"]:guard={"admitted":False,"reason":preservation["reason"]}

                    if not domain.point_guard(current,proposal['actions'][0],proposal['steps'][0]):

                        raise ValueError('Initial point binding does not witness the current public occurrence')

                    if not guard.get('admitted'):reason='frontier_guard_'+str(guard.get('reason','unknown'));break

                    proposed_actions=proposal['actions']

                    if len(proposed_actions)>remaining:reason='set_exceeds_remaining_level_budget';break

                    if not 1<=len(proposed_actions)<=16:raise ValueError('Frontier set exceeds admitted bound')

                    if len(proposal.get('steps',[]))!=len(proposed_actions) or any('expected_after' not in step for step in proposal['steps']):

                        raise ValueError('Committed prefix lacks an explicit known/unknown expectation for each step')

                    template=proposal['bundle_template'];operation=template['operation_key'];ref=template['composition_ref']

                    if operation not in {'OP18','OP28'}:raise ValueError('Unsupported physical frontier operation')

                    bundle={**template,'id':'B0','observation_revision':revision,'level_epoch':current.level,

                        'target_tree_path':target_receipt['path'],'target_tree_observation':target_receipt['observation_ref'],

                        'kind':'probe' if operation=='OP18' else 'realize','actions':proposed_actions,

                        'preserve_refs':template.get('preserve_refs',[]),

                        'outcome_guard':{'path':['value'],'contains':ref if operation=='OP18' else 'B0'}}

                    point_claims=[{'index':i,**step['point_binding']} for i,step in enumerate(proposal['steps']) if 'point_binding' in step]

                    if point_claims:

                        bundle['point_bindings']=point_claims

                        bundle['evidence']=bundle['evidence']+[p['observation_ref']+'/'+p['entity_ref'] for p in point_claims]

                    state={'level_epoch':current.level,'observation_revision':revision,'facts':proposal.get('facts',{}),

                        'compositions':state_compositions(proposal,objective),

                        'bundles':[{'id':'B0','composition_ref':ref,'admitted':guard['admitted'],'actions':proposed_actions}],

                        'memory_hint':{'current_observation':summary(observation),'main_objective_memory_revision':recalled['revision'],

                            'path_refs':proposal.get('route_refs',[]),'library_registry_revision':registry_revision}}

                    memory.put(episode,'state',state,evidence=observation['observation_ref'],revision=revision)

                    frozen={'before_observation_ref':observation['observation_ref'],'prior_rules':registry,

                        'first_action':proposed_actions[0],'candidate_predictions':[

                            predict_candidate_rule(rule,observation,proposed_actions[0]) for rule in registry],

                        'prior_property_rules':property_rules,'selected_experiment':selected_experiment,'selected_control':selected_control,

                        'addressed_predictions':[{'action':proposed_actions[0],'prediction':predict_property_rule(r,observation,proposed_actions[0])}

                             for r in property_rules] if proposed_actions[0]['action_ref']=='ACTION6' else [],

                        'prefix_evidence':proposal.get('prefix_evidence',[]),

                        'committed_proposal_sha256':sha(out/f'proposal-{revision}.json'),

                        'scope':'first-action mechanism predictions are conditional; later path steps use frozen historical protocol expectations from the committed proposal'}

                    usage['predict_candidate_rule']+=len(registry)

                    frozen_path=out/f'predictions-before-{revision}.json';store.write(frozen_path,frozen);store.verify(frozen_path);frozen_sha=sha(frozen_path)

                    receipt=bridge.run({'episode':episode,'id':f'frontier-{revision}','level_epoch':current.level,'policy':'code_only',

                        'context':bundle['purpose'],'bundles':{'B0':bundle},'candidates':['B0'],

                        'relevant_compositions':[c['id'] for c in state['compositions']]})

                    usage['SrcBridge.run.physical']+=1

                    if receipt['decision']['status']!='action_set_released' or receipt['decision']['action_set']!=bundle:

                        raise ValueError('Exact guarded frontier action set was not released')

                    if receipt['decision']['model_calls']:raise ValueError('Unexpected neural selection')

                    durable(out/f'decision-{revision}.json',receipt);decision_revision=revision

                    packet=[current];view_packet=[(observation,parts)];first_ms=None;interruption=None;source_level=current.level;step_expectations=[]

                    for index,command in enumerate(proposed_actions):

                        if actions>=cap or level_actions.get(level_key,0)>=limits[level_key]:interruption='oracle_action_cap';break

                        if time.perf_counter()-level_start>=360:interruption='level_deadline';break

                        live=observation if index==0 else protocol_projection(current,revision+index,out.name)

                        if using_goal:

                            admitted=goal_access.before(proposal,index,current.frame_rows,epoch=current.level,score=current.levels_completed,available=current.available_action_refs,observation_ref=live['observation_ref']);usage['check_access_before']+=1

                        elif using_morphology:

                            admitted=strategy_router.morph.before(proposal,index,current,live);usage['MorphologyAdapter.before']+=1

                        elif using_constraints:

                            admitted=constraint.before(proposal,index,current,live);usage[constraint_name+'.before']+=1

                        elif using_view:

                            admitted=view.before(proposal,index,current,view_packet[index][0]);usage['ViewFrontier.before']+=1

                        else:

                            admitted=frontier.guard(proposal,live,action_index=index);usage['ObservedFrontier.guard']+=1

                        if proposal.get("preservation"):

                            preserved_observation=observation if index==0 else getattr(constraint,"current_observation",None) if using_constraints else None

                            if not preserved_observation or preserved_observation.get("frame_hash")!=current.frame_hash:

                                preserved_observation=measure(current,revision+index,out.name)[0];usage["neutral_observer.measure"]+=1

                            preservation=check_preservation(proposal,current.frame_rows,current.level,observation=preserved_observation)

                            admitted={**admitted,"preservation":preservation}

                            if not preservation["admitted"]:admitted.update(admitted=False,reason=preservation["reason"])

                        point_admitted=domain.point_guard(current,command,proposal['steps'][index])

                        journal.write(pack({'event':'path_guard','decision_revision':decision_revision,'action_index':index,'point_admitted':point_admitted,

                            'observation_ref':live['observation_ref'],'frame_hash':live['frame_hash'],'result':admitted})+'\n')

                        journal.flush();os.fsync(journal.fileno())

                        if not admitted.get('admitted'):interruption='path_premise_changed:'+str(admitted.get('reason','unknown'));break

                        if not point_admitted:interruption='addressed_occurrence_changed';break

                        if command['action_ref'] not in current.available_action_refs:interruption='unavailable_action';break

                        if time.perf_counter()-level_start>=360:interruption='level_deadline';break

                        journal.write(pack({'event':'dispatch','decision_revision':decision_revision,'action_index':index,

                            'level':source_level,'level_action_cap':limits[level_key],

                            'level_action_ordinal':level_actions.get(level_key,0)+1,**command})+'\n');journal.flush();os.fsync(journal.fileno())

                        step_start_ns=time.perf_counter_ns()

                        actions+=1

                        charge_level_action(caps,level_actions,current.level)

                        current=env.step(command['action_ref'],data=command.get('data',{}))

                        step_end_ns=time.perf_counter_ns()

                        if current.levels_completed>packet[-1].levels_completed:

                            score_s=step_end_ns/1e9

                            completed_level_seconds[str(source_level)]=score_s-last_score_s

                            last_score_s=score_s

                        packet.append(current)

                        if first_ms is None:first_ms=(time.perf_counter()-begin)*1000

                        journal.write(pack({'event':'observation','decision_revision':decision_revision,'action_index':index,

                            'env_step_before_perf_counter_ns':step_start_ns,'env_step_after_perf_counter_ns':step_end_ns,

                            'emission_level_start_perf_counter_s':level_start,'emission_level':source_level,

                            **current.to_dict()})+'\n');journal.flush();os.fsync(journal.fileno())

                        actual_protocol=protocol_projection(current,revision+index+1,out.name)

                        if using_goal:

                            outcome=goal_access.after(proposal,index,packet[-2].frame_rows,current.frame_rows,epoch=current.level,score=current.levels_completed,state=current.state);usage['check_access_after']+=1

                        elif using_morphology:

                            outcome=strategy_router.morph.after(proposal,index,current);usage['MorphologyAdapter.after']+=1

                        elif using_constraints:

                            outcome=constraint.after(proposal,index,live,actual_protocol,packet[-2].frame_rows,current.frame_rows);usage[constraint_name+'.after']+=1

                        elif using_view:

                            view_packet.append(measure(current,revision+index+1,out.name));usage['neutral_observer.measure']+=1

                            outcome=view.after(proposal,index,view_packet[index][0],view_packet[index+1][0],packet[-2].frame_rows,current.frame_rows);usage['ViewFrontier.after']+=1

                        else:

                            outcome=frontier.check_outcome(proposal,actual_protocol,action_index=index);usage['ObservedFrontier.check_outcome']+=1

                        if proposal.get("preservation"):

                            preserved_observation=getattr(constraint,"current_observation",None) if using_constraints else None

                            if not preserved_observation or preserved_observation.get("frame_hash")!=current.frame_hash:

                                preserved_observation=measure(current,revision+index+1,out.name)[0];usage["neutral_observer.measure"]+=1

                            boundary=current.level!=source_level or current.levels_completed>packet[0].levels_completed or current.state in {"WIN","GAME_OVER"}

                            preservation=check_preservation(proposal,current.frame_rows,current.level,after=True,boundary=boundary,observation=preserved_observation)

                            outcome={**outcome,"preservation":preservation}

                            if not preservation["admitted"]:outcome.update(matched=False,seal_prefix=True)

                            elif preservation.get("seal_prefix"):outcome["seal_prefix"]=True

                        expectation={'action_index':index,'status':'matched' if outcome['matched'] is True else 'diverged' if outcome['matched'] is False else 'unknown',

                            'expected':proposal['steps'][index]['expected_after'],'observed':actual_protocol,'frontier_outcome':outcome,

                            'scope':'conditional public projection comparison; unknown effect is not confirmation'}

                        step_expectations.append(expectation)

                        journal.write(pack({'event':'step_expectation','decision_revision':decision_revision,**expectation})+'\n')

                        journal.flush();os.fsync(journal.fileno())

                        if current.state in {'GAME_OVER','WIN'} or current.level!=source_level or current.levels_completed>packet[0].levels_completed:

                            level_start=time.perf_counter();interruption='official_boundary_or_terminal';break

                        if expectation['status']=='diverged':interruption='observed_path_expectation_diverged';break

                        if outcome.get('seal_prefix') and index+1<len(proposed_actions):interruption='frontier_outcome_sealed_prefix';break

                    durable(out/f'packet-{decision_revision}.json',{'before':packet[0].frame_rows,

                        'after_packets':[p.frame_packet for p in packet[1:]],'canonical_after_frames':[p.frame_rows for p in packet[1:]],'local_only':True})

                    if len(packet)==1:reason=interruption or 'no_admissible_prefix';break

                    if sha(frozen_path)!=frozen_sha:raise ValueError('Frozen prediction record changed')

                    store.verify(frozen_path)

                    if using_goal and 'goal_access_plan' in proposal:goal_sets+=1

                    boundary=False;transition_refs=[];boundary_refs=[]

                    for index,public in enumerate(packet[1:]):

                        command=proposed_actions[index]

                        if using_view:after,after_parts=view_packet[index+1]

                        else:

                            after,after_parts=measure(public,revision+1,out.name);usage['neutral_observer.measure']+=1

                        acq=proposal['question'].get('control_acquisition',{})

                        shared=proposal['question'].get('curiosity',{}).get('also_tests_current_control',{})

                        attention_result=strategy_router.attention.observe(observation,after,command,

                            acq.get('attention_ref') or shared.get('attention_ref'))

                        if attention_result is not None:

                            usage['AttentionMemory.'+attention_result['status']]+=1

                        prior_meter=strategy_router.morph.meter.forecast()

                        role=proposal.get('morphology',{}).get('measured_facts',{})

                        collection_mover={'role_refs':role.get('controlled_role_refs',[]),'moves':role.get('motion_examples',{})}

                        if proposal.get('inventory_plan'):

                            inventory_offer=proposal['inventory_plan']['offer'];inventory_scene=inventory_offer['scene']

                            collection_mover={'role_refs':[inventory_scene['body_signature']],

                                'moves':{key:record['delta'] for key,record in inventory_scene['controls'].items() if not record.get('contradictions')},

                                'observation_ref':observation['observation_ref'],'level_epoch':observation['level_epoch']}

                            cell=next((cell for cell in inventory_scene['grids'][0]['cells']

                                if (cell['row'],cell['col'])==tuple(proposal['steps'][index]['to_cell'])),None)

                            if cell:collection_mover['contact_cell_bbox']=[cell['bbox'][key] for key in ('left','top','right','bottom')]

                        collections=strategy_router.morph.collection.observe(

                            observation,after,packet[index].frame_rows,public.frame_rows,command,

                            meter_before=prior_meter,mover=collection_mover)

                        if collections:

                            memory.put(episode,f'collection_events:{revision}',collections,evidence=after['observation_ref'],revision=revision+1)

                        strategy_router.morph.meter.observe(after['level_epoch'],after['observation_ref'],public.frame_rows,primitive_index=after['revision'])

                        if view is not None:

                            sight=view.record(observation,after,command,packet[index].frame_rows,public.frame_rows,proposal,index)

                            memory.put(episode,f'view_evidence:{revision}',sight,evidence=after['observation_ref'],revision=revision+1);usage['ViewFrontier.record']+=1

                        if using_morphology:

                            morph_event=strategy_router.morph.record(proposal,index,packet[index],public,after['observation_ref'],observation['observation_ref'])

                            if morph_event is not None:

                                memory.put(episode,f'morphology_event:{revision}',morph_event,evidence=after['observation_ref'],revision=revision+1)

                        if using_constraints:

                            result=constraint.record(observation,after,command,packet[index].frame_rows,public.frame_rows,proposal,index,

                                **({'frames':public.frame_packet} if constraint in (strategy_router.supports,strategy_router.reactive,strategy_router.reaction,strategy_router.recruitment,strategy_router.window_question,strategy_router.endpoints,strategy_router.channels,strategy_router.temporal_selection,strategy_router.chart,strategy_router.axial,strategy_router.fields,strategy_router.motifs,strategy_router.codes,strategy_router.lines,strategy_router.network) else {}))

                            memory.put(episode,(f'selected_rigid_event:{revision}' if 'selected_rigid_plan' in proposal else f'preview_packing_event:{revision}' if 'preview_packing_plan' in proposal else f'shared_settlement_event:{revision}' if 'shared_settlement_plan' in proposal else f'reactive_event:{revision}' if 'reactive_plan' in proposal else f'window_question_event:{revision}' if 'window_question_plan' in proposal else f'invited_endpoints_event:{revision}' if 'endpoint_plan' in proposal else f'joint_channels_event:{revision}' if 'channel_plan' in proposal else f'temporal_selection_event:{revision}' if 'temporal_selection_plan' in proposal else f'region_intervention_event:{revision}' if 'region_plan' in proposal else f'chart_navigation_event:{revision}' if 'chart_plan' in proposal else f'axial_question_event:{revision}' if 'axial_plan' in proposal else f'topological_recolor_event:{revision}' if 'recolor_plan' in proposal else f'framed_transfer_event:{revision}' if 'framed_transfer_plan' in proposal else f'outline_service_event:{revision}' if 'outline_plan' in proposal else f'support_navigation_event:{revision}' if 'support_plan' in proposal else f'observed_inventory_event:{revision}' if 'inventory_plan' in proposal else f'addressed_material_event:{revision}' if 'field_plan' in proposal else f'symbol_transaction_event:{revision}' if 'symbol_transaction_plan' in proposal else f'linked_preparation_event:{revision}' if 'linked_preparation_plan' in proposal else f'ranked_workshop_event:{revision}' if 'workshop_plan' in proposal else f'object_binding_event:{revision}' if 'binding_plan' in proposal else f'cargo_event:{revision}' if 'cargo_plan' in proposal else f'partial_network_event:{revision}' if 'network_plan' in proposal else f'facet_example_event:{revision}' if 'facet_plan' in proposal else f'relative_arrangement_event:{revision}' if 'arrangement_plan' in proposal else f'visual_sequence_event:{revision}' if 'sequence_plan' in proposal else f'feedback_sequence_event:{revision}' if 'feedback_plan' in proposal else f'symmetric_field:{revision}' if proposal.get("kind")=="public_symmetric_field" else f'constellations:{revision}' if 'constellation_plan' in proposal else f'ports:{revision}' if 'port_plan' in proposal else f'reduction:{revision}' if 'reduction_plan' in proposal else f'bands:{revision}' if 'band_plan' in proposal else f'slots:{revision}' if 'slot_plan' in proposal else f'words:{revision}' if 'word_plan' in proposal else f'branches:{revision}' if 'branch_plan' in proposal else f'codes:{revision}' if 'code_plan' in proposal else f'motif:{revision}' if 'motif_plan' in proposal else f'surface:{revision}' if 'surface_plan' in proposal else f'containment:{revision}' if 'containment_plan' in proposal else f'orbit_constraint:{revision}' if 'orbit_plan' in proposal else f'window_constraint:{revision}'),result,evidence=after['observation_ref'],revision=revision+1)

                            usage[constraint_name+'.record']+=1

                            if constraint is strategy_router.facets:

                                memory.put(episode,'facet_example_state',constraint.state(),evidence=after['observation_ref'],revision=revision+1)

                                constraint.restore(memory.get(episode,'facet_example_state')['value'])

                            if constraint is strategy_router.arrangements:

                                memory.put(episode,'relative_arrangement_state',constraint.state(),evidence=after['observation_ref'],revision=revision+1)

                                constraint.restore(memory.get(episode,'relative_arrangement_state')['value'])

                            if constraint is strategy_router.visual_sequences:

                                memory.put(episode,'visual_sequence_state',constraint.state(),evidence=after['observation_ref'],revision=revision+1)

                                constraint.restore(memory.get(episode,'visual_sequence_state')['value'])

                            if constraint is strategy_router.lines:

                                memory.put(episode,'repeated_series_state',constraint.state(),evidence=after['observation_ref'],revision=revision+1)

                                constraint.restore(memory.get(episode,'repeated_series_state')['value'])

                            if constraint in (strategy_router.windows,strategy_router.symmetry) and result and result.get('status')=='official_boundary_witness':

                                slot='window_prior' if constraint is strategy_router.windows else 'symmetry_prior'

                                memory.put(episode,slot,constraint.prior,evidence=after['observation_ref'],revision=revision+1)

                                constraint.prior=memory.get(episode,slot)['value']

                        if not (using_constraints and constraint is strategy_router.supports):

                            support_event=strategy_router.supports.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if support_event.get("events"):memory.put(episode,f"support_navigation_event:{revision}",support_event,evidence=after["observation_ref"],revision=revision+1)

                        joint=strategy_router.supports.acquired_compositions['joint_transport']
                        if joint.refs:
                            memory.put(episode,'joint_transport_state',joint.state(),evidence=after['observation_ref'],revision=revision+1)
                            joint.restore(memory.get(episode,'joint_transport_state')['value'])

                        reduction=strategy_router.supports.acquired_compositions['invited_reduction']
                        if reduction.refs or reduction.events:
                            memory.put(episode,'invited_reduction_state',reduction.state(),evidence=after['observation_ref'],revision=revision+1)
                            reduction.restore(memory.get(episode,'invited_reduction_state')['value'])

                        animation=strategy_router.supports.acquired_compositions['animated_contact']
                        if animation.mechanism.arc_events:
                            memory.put(episode,'animated_contact_state',animation.state(),evidence=after['observation_ref'],revision=revision+1)
                            animation.restore(memory.get(episode,'animated_contact_state')['value'])

                        periodic=strategy_router.supports.acquired_compositions['periodic_sums']
                        if periodic.refs or periodic.bootstrap_attempts:
                            memory.put(episode,'periodic_sums_state',periodic.state(),evidence=after['observation_ref'],revision=revision+1)
                            periodic.restore(memory.get(episode,'periodic_sums_state')['value'])

                        subset=strategy_router.supports.acquired_compositions['subset_diagnosis']
                        if subset.method_refs or subset.events:
                            memory.put(episode,'subset_diagnosis_state',subset.state(),evidence=after['observation_ref'],revision=revision+1)
                            subset.restore(memory.get(episode,'subset_diagnosis_state')['value'])

                        fixed_origin=strategy_router.supports.acquired_compositions['fixed_origin']
                        if fixed_origin.pending is not None or fixed_origin.executions or fixed_origin.inert:
                            memory.put(episode,'fixed_origin_state',fixed_origin.state(),evidence=after['observation_ref'],revision=revision+1)
                            fixed_origin.restore(memory.get(episode,'fixed_origin_state')['value'])

                        ordered_support=strategy_router.supports.acquired_compositions['ordered_support_transfer']
                        if ordered_support.events or ordered_support.closed:
                            memory.put(episode,'ordered_support_state',ordered_support.state(),evidence=after['observation_ref'],revision=revision+1)
                            ordered_support.restore(memory.get(episode,'ordered_support_state')['value'])

                        sliding_cavity=strategy_router.supports.acquired_compositions['sliding_cavity']
                        if sliding_cavity.body_type is not None or sliding_cavity.scored:
                            memory.put(episode,'sliding_cavity_state',sliding_cavity.state(),evidence=after['observation_ref'],revision=revision+1)
                            sliding_cavity.restore(memory.get(episode,'sliding_cavity_state')['value'])

                        metric_composition=strategy_router.supports.acquired_compositions['metric_composition']
                        if metric_composition.current is not None or metric_composition.control_samples:
                            memory.put(episode,'metric_composition_state',metric_composition.state(),evidence=after['observation_ref'],revision=revision+1)
                            metric_composition.restore(memory.get(episode,'metric_composition_state')['value'])

                        if not (using_constraints and constraint is strategy_router.fields):

                            field_event=strategy_router.fields.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if field_event:memory.put(episode,f"addressed_material_event:{revision}",field_event,evidence=after["observation_ref"],revision=revision+1)

                        if not (using_constraints and constraint is strategy_router.preparations):

                            preparation_event=strategy_router.preparations.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if preparation_event:memory.put(episode,f"linked_preparation_event:{revision}",preparation_event,evidence=after["observation_ref"],revision=revision+1)

                        if not (using_constraints and constraint is strategy_router.lines):

                            line_event=strategy_router.lines.record(observation,after,command,packet[index].frame_rows,public.frame_rows,proposal,index,frames=public.frame_packet)

                            usage['SupportedLineConstraint.observe']+=1

                            if line_event['events']:

                                memory.put(episode,'repeated_series_state',strategy_router.lines.state(),evidence=after['observation_ref'],revision=revision+1)

                                strategy_router.lines.restore(memory.get(episode,'repeated_series_state')['value'])

                        if not (using_constraints and constraint is strategy_router.workshop):

                            workshop_event=strategy_router.workshop.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if workshop_event:memory.put(episode,f'ranked_workshop_event:{revision}',workshop_event,evidence=after['observation_ref'],revision=revision+1)

                        if not (using_constraints and constraint is strategy_router.recruitment):

                            recruitment_event=strategy_router.recruitment.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if recruitment_event:memory.put(episode,f'recruitment_event:{revision}',recruitment_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.recruitment.methods or strategy_router.recruitment.portable or strategy_router.recruitment.attempts:

                            memory.put(episode,'recruitment_state',strategy_router.recruitment.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.recruitment.restore(memory.get(episode,'recruitment_state')['value'])

                        if strategy_router.selected_rigid.engine.rigid_events:
                            memory.put(episode,'selected_rigid_state',strategy_router.selected_rigid.state(),evidence=after['observation_ref'],revision=revision+1)
                            strategy_router.selected_rigid.restore(memory.get(episode,'selected_rigid_state')['value'])
                        if strategy_router.preview_packing.core.packing_model is not None:
                            memory.put(episode,'preview_packing_state',strategy_router.preview_packing.state(),evidence=after['observation_ref'],revision=revision+1)
                            strategy_router.preview_packing.restore(memory.get(episode,'preview_packing_state')['value'])

                        if not (using_constraints and constraint is strategy_router.window_question):

                            window_event=strategy_router.window_question.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if window_event:memory.put(episode,f'window_question_event:{revision}',window_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.window_question.edits or strategy_router.window_question.portable or strategy_router.window_question.attempts:

                            memory.put(episode,'window_question_state',strategy_router.window_question.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.window_question.restore(memory.get(episode,'window_question_state')['value'])

                        if not (using_constraints and constraint is strategy_router.settlement):
                            settlement_event=strategy_router.settlement.record(observation,after,command,packet[index].frame_rows,public.frame_rows)
                            if settlement_event:memory.put(episode,f'shared_settlement_event:{revision}',settlement_event,evidence=after['observation_ref'],revision=revision+1)
                        if strategy_router.settlement.engine.settle_events:
                            memory.put(episode,'shared_settlement_state',strategy_router.settlement.state(),evidence=after['observation_ref'],revision=revision+1)
                            strategy_router.settlement.restore(memory.get(episode,'shared_settlement_state')['value'])
                        if not (using_constraints and constraint is strategy_router.axial):

                            axial_event=strategy_router.axial.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if axial_event:memory.put(episode,f'axial_question_event:{revision}',axial_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.axial.selection or strategy_router.axial.rotations or strategy_router.axial.portable:

                            memory.put(episode,'axial_question_state',strategy_router.axial.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.axial.restore(memory.get(episode,'axial_question_state')['value'])

                        if not (using_constraints and constraint is strategy_router.temporal_selection):

                            temporal_event=strategy_router.temporal_selection.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if temporal_event:memory.put(episode,f'temporal_selection_event:{revision}',temporal_event,evidence=after['observation_ref'],revision=revision+1)

                        memory.put(episode,'temporal_selection_state',strategy_router.temporal_selection.state(),evidence=after['observation_ref'],revision=revision+1)

                        strategy_router.temporal_selection.restore(memory.get(episode,'temporal_selection_state')['value'])

                        if not (using_constraints and constraint is strategy_router.endpoints):

                            endpoint_event=strategy_router.endpoints.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if endpoint_event:memory.put(episode,f'invited_endpoints_event:{revision}',endpoint_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.endpoints.events or strategy_router.endpoints.portable:

                            memory.put(episode,'invited_endpoints_state',strategy_router.endpoints.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.endpoints.restore(memory.get(episode,'invited_endpoints_state')['value'])

                        if not (using_constraints and constraint is strategy_router.channels):

                            channel_event=strategy_router.channels.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if channel_event:memory.put(episode,f'joint_channels_event:{revision}',channel_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.channels.layout or strategy_router.channels.portable:

                            memory.put(episode,'joint_channels_state',strategy_router.channels.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.channels.restore(memory.get(episode,'joint_channels_state')['value'])

                        if not (using_constraints and constraint is strategy_router.regions):

                            region_event=strategy_router.regions.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if region_event:memory.put(episode,f'region_intervention_event:{revision}',region_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.regions.layout or strategy_router.regions.portable:

                            memory.put(episode,'region_intervention_state',strategy_router.regions.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.regions.restore(memory.get(episode,'region_intervention_state')['value'])

                        if not (using_constraints and constraint is strategy_router.chart):

                            chart_event=strategy_router.chart.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            if chart_event:memory.put(episode,f'chart_navigation_event:{revision}',chart_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.chart.chart or strategy_router.chart.portable:

                            memory.put(episode,'chart_navigation_state',strategy_router.chart.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.chart.restore(memory.get(episode,'chart_navigation_state')['value'])

                        if strategy_router.recolor.selection or strategy_router.recolor.writes or strategy_router.recolor.attempts:

                            memory.put(episode,'topological_recolor_state',strategy_router.recolor.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.recolor.restore(memory.get(episode,'topological_recolor_state')['value'])

                        if not (using_constraints and constraint is strategy_router.framed_transfer):

                            framed_event=strategy_router.framed_transfer.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if framed_event:memory.put(episode,f'framed_transfer_event:{revision}',framed_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.framed_transfer.spans or strategy_router.framed_transfer.receipts or strategy_router.framed_transfer.attempts:

                            memory.put(episode,'framed_transfer_state',strategy_router.framed_transfer.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.framed_transfer.restore(memory.get(episode,'framed_transfer_state')['value'])

                        if not (using_constraints and constraint is strategy_router.outline_service):

                            outline_event=strategy_router.outline_service.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if outline_event:memory.put(episode,f'outline_service_event:{revision}',outline_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.outline_service.control or strategy_router.outline_service.tracks:

                            memory.put(episode,'outline_service_state',strategy_router.outline_service.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.outline_service.restore(memory.get(episode,'outline_service_state')['value'])

                        if not (using_constraints and constraint is strategy_router.inventory):

                            inventory_event=strategy_router.inventory.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if inventory_event:memory.put(episode,f'observed_inventory_event:{revision}',inventory_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.inventory.tracker.core or strategy_router.inventory.seen_pairs:

                            memory.put(episode,'observed_inventory_state',strategy_router.inventory.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.inventory.restore(memory.get(episode,'observed_inventory_state')['value'])

                        if not (using_constraints and constraint is strategy_router.reaction):
                            reaction_event=strategy_router.reaction.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)
                            if reaction_event:memory.put(episode,f'reaction_event:{revision}',reaction_event,evidence=after['observation_ref'],revision=revision+1)
                        if strategy_router.reaction.control or strategy_router.reaction.packets or strategy_router.reaction.history:
                            memory.put(episode,'reaction_state',strategy_router.reaction.state(),evidence=after['observation_ref'],revision=revision+1)
                            strategy_router.reaction.restore(memory.get(episode,'reaction_state')['value'])
                        if not (using_constraints and constraint is strategy_router.reactive):
                            reactive_event=strategy_router.reactive.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)
                            if reactive_event:memory.put(episode,f'reactive_event:{revision}',reactive_event,evidence=after['observation_ref'],revision=revision+1)
                        if strategy_router.reactive.control or strategy_router.reactive.question:
                            memory.put(episode,'reactive_state',strategy_router.reactive.state(),evidence=after['observation_ref'],revision=revision+1)
                            strategy_router.reactive.restore(memory.get(episode,'reactive_state')['value'])
                        if using_constraints and constraint is strategy_router.symbols:

                            memory.put(episode,'observed_symbol_transactions_state',strategy_router.symbols.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.symbols.restore(memory.get(episode,'observed_symbol_transactions_state')['value'])

                        if strategy_router.workshop.mode_evidence or strategy_router.workshop.events:

                            memory.put(episode,'observed_ranked_workshop_state',strategy_router.workshop.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.workshop.restore(memory.get(episode,'observed_ranked_workshop_state')['value'])

                        if not (using_constraints and constraint is strategy_router.object_binding):

                            binding_event=strategy_router.object_binding.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if binding_event:memory.put(episode,f'object_binding_event:{revision}',binding_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.object_binding.tracker.core or strategy_router.object_binding.tracker.methods:

                            memory.put(episode,'observed_object_binding_state',strategy_router.object_binding.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.object_binding.restore(memory.get(episode,'observed_object_binding_state')['value'])

                        if not (using_constraints and constraint is strategy_router.cargo):

                            cargo_event=strategy_router.cargo.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                            if cargo_event:memory.put(episode,f'cargo_event:{revision}',cargo_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.cargo.tracker.grid:

                            memory.put(episode,'observed_station_cargo_state',strategy_router.cargo.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.cargo.restore(memory.get(episode,'observed_station_cargo_state')['value'])

                        if not (using_constraints and constraint is strategy_router.network):

                            network_event=strategy_router.network.record(observation,after,command,packet[index].frame_rows,public.frame_rows,frames=public.frame_packet)

                            usage['DiscreteNetwork.observe']+=1

                            if network_event:memory.put(episode,f'partial_network_event:{revision}',network_event,evidence=after['observation_ref'],revision=revision+1)

                        if strategy_router.network.events:

                            memory.put(episode,'partial_network_state',strategy_router.network.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.network.restore(memory.get(episode,'partial_network_state')['value'])

                        if not (using_constraints and constraint is strategy_router.feedback):

                            strategy_router.feedback.record(observation,after,command,packet[index].frame_rows,public.frame_rows)

                        if strategy_router.feedback.layout is not None or strategy_router.feedback.entry_method is not None:

                            memory.put(episode,'feedback_sequence_state',strategy_router.feedback.state(),evidence=after['observation_ref'],revision=revision+1)

                            strategy_router.feedback.restore(memory.get(episode,'feedback_sequence_state')['value'])

                        departures=strategy_router.morph.observe_departures(observation,after,packet[index].frame_rows,public.frame_rows,command)

                        if departures:

                            memory.put(episode,f'morphology_departure:{revision}',departures,evidence=after['observation_ref'],revision=revision+1)

                        goal_events=goal_access.record(observation,packet[index].frame_rows,command,after,public.frame_rows,proposal=proposal,index=index)

                        usage['GoalAccessMemory.record']+=1

                        for event in goal_events:

                            goal_event_count+=1

                            memory.put(episode,f'goal_access_event:{goal_event_count}',{'event':event,'digest':model_identity(event)},evidence=after['observation_ref'],revision=revision+1)

                        if goal_events:memory.put(episode,'goal_access_event_count',goal_event_count,evidence=after['observation_ref'],revision=revision+1)

                        comparison=point_experiments.observe(observation,command,after,packet[index].frame_rows,public.frame_rows,

                            selected_experiment if index==0 else None)

                        curiosity=proposal['question'].get('curiosity')

                        if index==0 and curiosity:

                            measured_display=None

                            if curiosity["source"]=="coupled_displays":

                                measured_display=strategy_router.displays.observe(curiosity,after,public.frame_rows)

                                if measured_display=="boundary":

                                    memory.put(episode,"coupled_display_schema",strategy_router.displays.scored_schema,

                                               evidence=after["observation_ref"],revision=revision+1)

                                    strategy_router.displays.scored_schema=memory.get(episode,"coupled_display_schema")["value"]

                            curiosity_result=reconcile_information_goal(curiosity,observation,after,comparison,external_measurement=measured_display)

                            memory.put(episode,f'information_experiment:{revision}',dict(goal=curiosity,outcome=curiosity_result),

                                       evidence=after['observation_ref'],revision=revision+1)

                        control_result=None

                        if index==0 and selected_control:

                            control_result=control_dependencies.evaluate(selected_control,observation,command,after)

                            memory.put(episode,f'control_experiment:{revision}',control_result,evidence=after['observation_ref'],revision=revision+1)

                            usage['ControlDependencies.evaluate']+=1

                        control_dependencies.change(observation,after,comparison)

                        if comparison:

                            usage['PointExperimentMemory.observe.point']+=1

                            memory.put(episode,f'point_experiment:{revision}',comparison,evidence=after['observation_ref'],revision=revision+1)

                            if comparison['matches_frozen_predictions'] is not None:

                                usage['PointExperimentMemory.measured_contrast']+=1

                        durable(out/f'observation-{revision+1}.json',{'observation':after,'local_only':True})

                        boundary=public.state in {'WIN','GAME_OVER'} or public.level!=observation['level_epoch'] or public.levels_completed>observation['levels_completed']

                        if boundary:

                            witness={'source_level':observation['level_epoch'],'before_observation_ref':observation['observation_ref'],

                                'after_observation_ref':after['observation_ref'],'last_action':command,'released_composition':ref,

                                'committed_decision_revision':decision_revision,'executed_prefix_actions':index+1,

                                'cancelled_suffix_actions':len(proposed_actions)-index-1,

                                'levels_completed_before':observation['levels_completed'],'levels_completed_after':public.levels_completed,

                                'official_state':public.state,'causal_terminal_role':'unknown',

                                'qualification':'observed official boundary/terminal witness, not a generalized winning recipe'}

                            method=at_boundary(target_receipt,witness)

                            if method:

                                effect=method['verified_selective_change']

                                entries=[entry for (ep,_),contact in strategy_router.morph.contacts.items()

                                         if ep==witness['source_level'] for station in contact.get('stations',{}).values()

                                         for entry in station['entries'] if entry['after']==effect['after'] and entry['peer_preserved']]

                                if len(entries)==1:

                                    entry=entries[0]

                                    method['station_hypothesis']={k:entry[k] for k in

                                        ('site_surface','size','role_refs','delta','peer_scale','observed_scales','after')}

                                    method['station_hypothesis']['source_epoch']=witness['source_level']

                                memory.put(episode,'target_method',method,evidence=after['observation_ref'],revision=revision+1)

                                strategy_router.target_method=memory.get(episode,'target_method')['value']

                                strategy_router.morph.station_method=strategy_router.target_method.get('station_hypothesis')

                                strategy_router.morph.entry_method=strategy_router.target_method

                                witness['target_method']=method

                            witnesses.append(witness);durable(out/f'boundary-{revision+1}.json',witness)

                            boundary_refs.append({'path':f'boundary-{revision+1}.json','before':observation['observation_ref'],'after':after['observation_ref']})

                            frontier.record_transition(observation,command,after,assessment=None,after_action_candidates=graph_inputs(after));usage['ObservedFrontier.record_transition']+=1

                            revision+=1;observation,parts=after,after_parts;persist_deltas()

                            memory.put(episode,f'boundary_witness:{revision}',witness,evidence=observation['observation_ref'],revision=revision)

                            break

                        measured=delta(observation,after,parts,after_parts,command);usage['neutral_observer.delta']+=1

                        prior=frozen['prior_rules'] if index==0 else registry

                        checks=[validate_empirical_rule(rule,observation,after,command) for rule in prior] if index==0 else []

                        usage['validate_empirical_rule']+=len(prior) if index==0 else 0

                        assessment=assess_transition(observation,after,command,prior_rules=prior);usage['assess_transition']+=1

                        registry=assessment['empirical_rules']

                        if command['action_ref']=='ACTION6':

                            properties=assess_property_transition(observation,after,command,prior_rules=frozen['prior_property_rules'] if index==0 else property_rules)

                            usage['assess_property_transition']+=1

                            property_rules=properties['property_rules'];assessment['property_rules']=property_rules

                            assessment['addressed_assessment']=properties

                            memory.put(episode,'property_rules',property_rules,evidence=after['observation_ref'],revision=revision+1)

                        frontier.record_transition(observation,command,after,assessment=assessment,after_action_candidates=graph_inputs(after));usage['ObservedFrontier.record_transition']+=1

                        record={'transition':measured,'assessment':assessment,'point_experiment_result':comparison,'control_experiment_result':control_result,'pre_dispatch_prediction_sha256':frozen_sha if index==0 else None,

                            'prospective_prediction_checks':checks,

                            'prospective_claim':'first-action candidates frozen before dispatch' if index==0 else 'mechanism fitting retrospective; only committed path-protocol expectation tested prospectively'}

                        store.write(out/f'transition-{revision}.json',{'record':record,'local_only':True})

                        transition_refs.append({'path':f'transition-{revision}.json','before':observation['observation_ref'],'after':after['observation_ref']})

                        revision+=1;observation,parts=after,after_parts;persist_deltas()

                        memory.put(episode,'empirical_registry',registry,evidence=observation['observation_ref'],revision=revision);registry_revision=revision

                    set_record={'decision_revision':decision_revision,'released_composition_ref':ref,

                        'released_operation':operation,'executed_actions':proposed_actions[:len(packet)-1],

                        'released_actions_count':len(proposed_actions),'executed_prefix_count':len(packet)-1,

                        'transition_refs':transition_refs,'boundary_refs':boundary_refs,'interruption':interruption,

                        'step_expectations':step_expectations,

                        'final_observation_ref':observation['observation_ref'],

                        'scope':'one composed reconciliation after sealed set; transition extraction is mechanical evidence only'}

                    if target_receipt.get('route_key'):

                        memory.put(episode,'composition_target',target_tree.seal(target_receipt,set_record),

                                   evidence=observation['observation_ref'],revision=revision)

                    analysis=post_analysis(memory,bridge,episode,observation,revision,objective,set_record,boundary=boundary)

                    usage['SrcBridge.run.analysis']+=3

                    durable(out/f'ensemble-analysis-{decision_revision}.json',{'set_record':set_record,'src_operations':analysis})

                    decisions.append({'revision':decision_revision,'level':source_level,'actions':len(packet)-1,

                        'released_actions':len(proposed_actions),'operation':operation,'first_action_ms':first_ms,

                        'full_set_ms':(time.perf_counter()-begin)*1000,'model_calls':0,'interruption':interruption,

                        'prediction_file_sha256':frozen_sha,'route_refs':proposal.get('route_refs',[]),

                        'step_expectation_statuses':[c['status'] for c in step_expectations]})

                    if current.state=='GAME_OVER':reason='official_game_over';break

                    if current.levels_completed>=target:status=f'L{target}_passed';break

                    if current.level in strategy_router.lines.memory.composition_refuted_epochs:reason='program_composition_projection_refuted';break

                    if strategy_router.lines.memory.requested_stop_reason:reason=strategy_router.lines.memory.requested_stop_reason;break

                    if boundary:

                        goal_before=model_identity(goal_access.memory.retained_state());goal_access=GoalAccessAdapter()

                        for sequence in range(1,goal_event_count+1):

                            stored=memory.get(episode,f'goal_access_event:{sequence}')['value']

                            if model_identity(stored['event'])!=stored['digest']:raise ValueError('Goal event digest changed')

                            goal_access.memory.apply_event(stored['event'])

                        if model_identity(goal_access.memory.retained_state())!=goal_before:raise ValueError('Goal state did not restore from evidence')

                        recalled_goal=memory.get(episode,'main_objective');usage['Memory.get.main_objective']+=1

                        if recalled_goal['value']!=objective:raise ValueError('Principal objective lost at boundary')

                        restored=ObservedFrontier(target_levels=target,max_prefix=16);usage['ObservedFrontier.__init__']+=1

                        last=memory.get(episode,'frontier_last_sequence')['value']

                        for sequence in range(1,last+1):

                            event=memory.get(episode,f'frontier_delta:{sequence:08d}')['value'];restored.apply_delta(event);usage['ObservedFrontier.apply_delta']+=1

                        frontier=restored

                        remembered_properties=memory.get(episode,'property_rules');property_rules=remembered_properties['value'] if remembered_properties else []

                        frontier.observe(observation,graph_inputs(observation));usage['ObservedFrontier.observe']+=1;persist_deltas()

                        transfers.append({'current_level':current.level,'main_objective_memory_revision':recalled_goal['revision'],

                            'replayed_frontier_deltas':last,'retained_rule_count':len(registry),'replayed_goal_events':goal_event_count,'retained_goal_state_digest':goal_before,

                            'rule_scope':'prior evidence retained; next-level applicability must be revalidated','visual_terminal_role':'unknown'})

                    if interruption in {'oracle_action_cap','level_deadline'}:reason=interruption;break

                if current.levels_completed>=target:status=f'L{target}_passed'

                elif actions>=cap:reason='oracle_action_cap' if level_actions.get(str(current.level),0)>=limits.get(str(current.level),cap) else 'admitted_action_cap'

                for name,digest in {**plan['source'],**plan['environment_sources'],str(POLICY_PATH):plan['policy_sha']}.items():

                    if sha(Path(name))!=digest:raise ValueError('Consumed frozen source changed: '+name)

                strategy_router.attention.close_pending(observation,reason or status)

                report={'completed_level_seconds':completed_level_seconds,'attention':strategy_router.attention.item,'status':status,'reason':reason,'actions':actions,'level_actions':level_actions,'initial':initial,'final':current.to_dict(),

                    'target_levels_completed':target,'main_objective':objective,'visual_terminal_role':'unknown','decisions':decisions,

                    'boundary_witnesses':witnesses,'goal_and_evidence_transfers':transfers,'retained_rule_statuses':dict(Counter(r.get('status','unknown') for r in registry)),

                    'usage_counts':dict(usage),'frontier_deltas_persisted':delta_sequence,'frontier_delta_kinds':dict(delta_types),

                    'full_frontier_snapshots_during_actions':0,'common_property_rewrites':{'invocations':usage['assess_property_transition'],

                        'status':'assessed_same_epoch_pointed_transitions' if usage['assess_property_transition'] else 'no_same_epoch_pointed_transition',

                        'retained_statuses':dict(Counter(r['status'] for r in property_rules))},

                    'goal_access_sets':goal_sets,'goal_abstentions':dict(goal_abstentions),'goal_events':goal_event_count,

                    'support_navigation':{'scored_witnesses':strategy_router.supports.passed,'directions':strategy_router.supports.directions,'control_introductions':strategy_router.supports.control_introductions,'service_edges':strategy_router.supports.service_edges},

                    'addressed_material':{'scored_witnesses':strategy_router.fields.passed,'retained_hypotheses':strategy_router.fields.prior},

                    'linked_preparation':{'scored_witnesses':strategy_router.preparations.passed,'observed_effects':strategy_router.preparations.events},

                    'constellation_cover':{'scored_witnesses':strategy_router.constellations.passed,'observed_effects':strategy_router.constellations.events},

                    'port_assembly':{'scored_witnesses':strategy_router.ports.passed,'observed_effects':strategy_router.ports.events},

                    'reduction_transport':{'scored_witnesses':strategy_router.reduction.passed,'observed_effects':strategy_router.reduction.events},

                    'band_transfer':{'scored_witnesses':strategy_router.bands.passed,'observed_effects':strategy_router.bands.events},

                    'slot_substitution':{'scored_witnesses':strategy_router.slots.passed,'observed_effects':strategy_router.slots.events},

                    'word_interface':{'scored_witnesses':strategy_router.words.passed,'observed_effects':strategy_router.words.events},

                    'branch_routing':{'scored_witnesses':strategy_router.branches.passed,'observed_effects':strategy_router.branches.events},

                    'code_program':{'scored_witnesses':strategy_router.codes.passed,'observed_effects':strategy_router.codes.events},

                    'motif_access':{'scored_witnesses':strategy_router.motifs.passed,'observed_effects':strategy_router.motifs.events},

                    'surface_program':{'scored_witnesses':strategy_router.surface.passed,'observed_effects':strategy_router.surface.events},

                    'containment':{'scored_witnesses':strategy_router.containment.passed,'observed_effects':strategy_router.containment.events},

                    'orbit_constraints':{'scored_witnesses':strategy_router.orbits.scored,'observed_effects':strategy_router.orbits.history},

                    'window_constraints':{'scored_rule_witnesses':strategy_router.windows.passed,

                        'current_fit':strategy_router.windows.provenance},

                    'information_goal':args.information_goal,'view_frontier':{'enabled':view is not None,'current_epoch_reveals':view.reveals if view else [],

                        'current_epoch_modification_trials':len(view.tested) if view else 0},

                    'retained_goal_model_count':len(goal_access.memory.models),'terminal_prior_models_loaded':0,

                    'evidence_format':plan['evidence_format'],'continuous_src_store':True,'model_loaded':False,'oracle_read_at_runtime':False,'production_v5_modified':False,

                    'elapsed_s':time.perf_counter()-started,'latency_to_first_action':quantiles([d['first_action_ms'] for d in decisions if d['first_action_ms'] is not None]),

                    'qualification':policy['qualification'],'scope_limits':[policy['input_domain']['limits'],'unknown visual terminal role','multi-primitive prefixes are provisional observed paths, not complete-world safety certificates']}

                durable(out/'report.json',report)

                print(pack({k:report[k] for k in ('status','reason','actions','level_actions','visual_terminal_role','elapsed_s','latency_to_first_action')}))

        except BaseException as exc:

            if 'strategy_router' in locals() and 'observation' in locals():

                strategy_router.attention.close_pending(observation,'run_interrupted')

            if current is not None:

                durable(out/'failure-public-observation.json',{'canonical':current.frame_rows,'packet':current.frame_packet,'local_only':True})

            if 'packet' in locals():

                durable(out/'failure-prefix-packets.json',{'packets':[p.frame_packet for p in packet],

                    'canonical_frames':[p.frame_rows for p in packet],'local_only':True})

            durable(out/'failure.json',{'status':'stopped','error':repr(exc),'traceback':traceback.format_exc(),'actions':actions,

                'level_actions':level_actions,'last_observation':current.to_dict() if current else None,'decisions':decisions,

                'usage_counts':dict(usage),'frontier_deltas_persisted':delta_sequence})

            raise

        finally:

            try:

                if store is not None:store.close()

            finally:

                if memory is not None:memory.close()





if __name__=='__main__':main()



