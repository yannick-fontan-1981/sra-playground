from .preview_packing.family import PreviewPacking
from common_symmetric_field import SymmetricField
from .feedback_sequences.family import FeedbackSequences
from .visual_sequences.family import VisualSequences
from .relative_arrangements.family import RelativeArrangements
from .facet_examples.family import FacetExamples
from .discrete_network.family import DiscreteNetwork
from .station_cargo.family import ObservedStationCargo
from .guarded_binding.family import ObservedBinding
from .ranked_workshop.family import RankedWorkshop
from .symbol_transactions.family import SymbolTransactions
from .observed_inventory.family import ObservedInventory
from .outline_service.family import OutlineService
from .framed_transfer.family import FramedTransfer
from .topological_recolor.family import TopologicalRecolor
from .region_intervention.family import RegionIntervention
from .joint_channels.family import JointChannels
from .invited_endpoints.family import InvitedEndpoints
from .temporal_selection.family import TemporalSelection
from .chart_navigation.family import ChartNavigation
from .ordered_reaction.family import OrderedReaction
from .reactive_contact.family import ReactiveContact
from .ordered_recruitment.family import OrderedRecruitment
from .window_question.family import WindowQuestion
from .axial_question.family import AxialQuestion
from .shared_settlement.family import SharedSettlement
from .selected_rigid.family import SelectedRigid
"""The SRC workflow visits candidate families in the order declared by DRM."""
from pathlib import Path
from agents.yf_arc3_v5.drm.loader import load_drm_document
from .contextual_translation import contextual_translation_exposures
from .adapter import MorphologyAdapter
from common_multiscale_constraints import WindowConstraints
from common_observed_compositions import ObservedCompositionConstraint as ProgramCompositionConstraint
from common_orbit_constraints import OrbitConstraints
from common_containment import Containment
from common_surface_program import SurfaceProgram
from common_code_program import CodeProgram
from common_band_transfer import BandTransfer
from common_slot_substitution import SlotSubstitution
from common_word_interface import WordInterface
from common_port_assembly import PortAssembly
from common_constellation_cover import ConstellationCover
from common_linked_preparation import LinkedPreparation
from common_addressed_material import AddressedMaterial
from common_support_navigation import SupportNavigation
from common_reduction_transport import ReductionTransport
from common_branch_routing import BranchRouting
from common_motif_access import MotifAccess, lattice as motif_lattice, body as motif_body
from .src_runtime import SrcProgram
from terminal_composition import registered,relative_motion
from target_method import recalled_directions
from target_tree import CompositionTargetTree
from attention_memory import AttentionMemory
from composition_curiosity import point_goal
from coupled_displays import CoupledDisplays
from .motion_contrast import motion_offers

HERE=Path(__file__).resolve().parent


class StrategyRouter:
    def __init__(self, drm_path=HERE/"strategy.drm"):
        self.morph=MorphologyAdapter()
        self.windows=WindowConstraints()
        self.lines=ProgramCompositionConstraint()
        self.orbits=OrbitConstraints()
        self.containment=Containment()
        self.surface=SurfaceProgram()
        self.codes=CodeProgram()
        self.bands=BandTransfer()
        self.slots=SlotSubstitution()
        self.words=WordInterface()
        self.ports=PortAssembly()
        self.constellations=ConstellationCover()
        self.preparations=LinkedPreparation()
        self.fields=AddressedMaterial()
        self.supports=SupportNavigation()
        self.reduction=ReductionTransport()
        self.branches=BranchRouting()
        self.motifs=MotifAccess()
        self.target_method=None
        self.drm=load_drm_document(Path(drm_path))
        declaration,=self.drm.document.declarations
        self.order=tuple(declaration.configuration["families"])
        self.symmetry=SymmetricField(declaration.configuration["regular_field_correspondence"])
        self.feedback=FeedbackSequences()
        self.visual_sequences=VisualSequences()
        self.arrangements=RelativeArrangements()
        self.facets=FacetExamples()
        self.network=DiscreteNetwork()
        self.cargo=ObservedStationCargo()
        self.object_binding=ObservedBinding()
        self.workshop=RankedWorkshop()
        self.symbols=SymbolTransactions()
        self.inventory=ObservedInventory()
        self.outline_service=OutlineService()
        self.framed_transfer=FramedTransfer()
        self.recolor=TopologicalRecolor()
        self.chart=ChartNavigation()
        self.regions=RegionIntervention()
        self.channels=JointChannels()
        self.endpoints=InvitedEndpoints()
        self.temporal_selection=TemporalSelection()
        self.axial=AxialQuestion()
        self.settlement=SharedSettlement()
        self.selected_rigid=SelectedRigid()
        self.window_question=WindowQuestion()
        self.preview_packing=PreviewPacking()
        self.recruitment=OrderedRecruitment()
        self.reactive=ReactiveContact()
        self.reaction=OrderedReaction()
        self.control_policy=declaration.configuration.get("acquire_control_for_target", {})
        self.curiosity_policy=declaration.configuration.get("information_goal")
        self.target_tree=CompositionTargetTree()
        self.morph.target_tree=self.target_tree
        self.attention=AttentionMemory()
        self.displays=CoupledDisplays()
        if len(set(self.order))!=len(self.order) or not 1<=len(self.order)<=16:
            raise ValueError("Invalid declared family inventory")
        self.program=SrcProgram(HERE/"strategy.src","v6.composition_strategy.choose",
            {"families.begin":self.begin,"families.offer":self.offer,
             "families.finish":self.finish,"families.advance":self.advance})

    def preservation_obligations(self,observation,rows):
        obligations=[]
        for provider in vars(self).values():
            collector=getattr(provider,"preservation_obligations",None)
            if collector:obligations.extend(collector(observation,rows))
        return obligations

    def begin(self,request):
        return dict(pending=True,done=False,index=0,progress=0,visited=[])

    def offer(self,session):
        name=self.order[session["index"]]
        refusal=getattr(self,'current_nested_refusal',None)
        blocked=refusal and name in refusal['contract']['decline_unscoped_families']
        proposal=None if blocked else self.providers[name]()
        self.offers[name]=proposal
        return dict(family=name,selected=proposal is not None)

    def finish(self,session,trial):
        return dict(session,pending=False,done=True,progress=session["progress"]+1,
                    selected=trial["family"],visited=[*session["visited"],trial["family"]])

    def advance(self,session):
        index=session["index"]+1
        return dict(session,index=index,progress=index,pending=index<len(self.order),done=index==len(self.order),
                    visited=[*session["visited"],self.order[session["index"]]])

    def choose(self,goal,frontier,points,controls,obs,rows,inputs,registry,remaining,view):
        frontier.bind_current_candidate_context(obs,registry)
        self.current_nested_refusal=self.lines.memory.nested_refusal(obs,rows)
        self.attention.revalidate(obs)
        returned=self.attention.take_parent_return(obs)
        self.goal_reason=None
        self.morph.last=None
        def goal_offer():
            config=self.drm.document.declarations[0].configuration
            for subtype in config["goal_access_subquestions"]:
                if subtype=="observed_composition_services":
                    result=self.lines.observed_composition_propose(obs,rows,inputs,remaining,config["observed_composition_services"])
                    if result is not None and result.get("block_unrelated_probe"):return result
                elif subtype=="coupled_support_composition":
                    result=self.lines.coupled_propose(obs,rows,inputs,remaining,config["coupled_support_composition"])
                    if result is not None and result.get("block_unrelated_probe"):return result
                elif subtype=="alternating_graph_composition":
                    result=self.lines.graph_propose(obs,rows,inputs,remaining,config["alternating_graph_composition"])
                    if result is not None and result.get("block_unrelated_probe"):return result
                elif subtype=="scored_relation_access":
                    result=goal.propose(obs,rows,inputs,min(16,remaining))
                    self.goal_reason=result.get("reason")
                elif subtype=="subset_diagnosis":
                    result=self.supports.acquired_compositions["subset_diagnosis"].propose(obs,rows,inputs,remaining)
                elif subtype=="selected_rigid":
                    result=self.selected_rigid.propose(obs,rows,inputs,remaining,config["selected_rigid_question"])
                elif subtype=="preview_packing":
                    result=self.preview_packing.propose(obs,rows,inputs,remaining)
                elif subtype=="observed_support_access":
                    result=self.supports.propose(obs,rows,inputs,remaining)
                elif subtype in ("invited_reduction","joint_transport","animated_contact"):
                    result=self.supports.acquired_compositions[subtype].propose(obs,rows,inputs,remaining)
                elif subtype=="observed_feedback_sequence":
                    result=self.feedback.propose(obs,rows,inputs,remaining)
                else:raise ValueError("Unknown goal access subquestion")
                if result is not None and result.get("block_unrelated_probe"):return result
                if result is not None and result.get("status")=="proposed":return result
            return None
        def continuity():
            if view is None or not view.has_observed_view_question():
                return None
            plain=[a for a in inputs if not a.get("data")]
            return frontier.propose(obs,plain,prefix_evidence=()) if plain else {
                "status":"unknown_no_observed_view_access","actions":[]}
        deferred_curiosity=[]
        def acquire_control(*,inspect_only=False):
            decision=self.morph.last or {}
            policy=self.control_policy
            if (decision.get("status")!=policy["requires_status"] or
                    decision.get("reason")!=policy["requires_reason"]):
                return None
            facts=decision["measured_facts"]
            current=goal.memory.snapshot(obs,rows)
            commands=sorted(a["action_ref"] for a in inputs if not a.get("data"))
            trials={cmd:[] for cmd in commands}
            for before,cmd,after in goal.memory.episode:
                if cmd in trials and before.epoch==after.epoch==current.epoch:
                    trials[cmd].append((before,after))
            recalled=recalled_directions(self.target_method,decision,current)
            bases=set()
            if recalled and policy.get("recall")=="prefer_an_unmeasured_axis_of_a_relocated_role":
                for cmd,pairs in trials.items():
                    if cmd not in recalled:continue
                    vector=tuple(recalled[cmd])
                    if any(registered(b,a) and all(relative_motion(b,a,s)==vector for s in self.target_method["role_refs"])
                           for b,a in pairs):
                        bases.add(vector)
                def axis_order(cmd):
                    if cmd not in recalled:return 2
                    dx,dy=recalled[cmd]
                    return int(any(x*dy==y*dx for x,y in bases))
                commands.sort(key=axis_order)
            exposure_cache=None
            experiments=list(policy["experiments"])
            focus=self.attention.item
            if (focus and focus["status"]=="pending" and focus["opened_at"]==obs["observation_ref"]
                    and focus["pair_ref"]==facts["pair_ref"]):
                commands.sort(key=lambda command:command!=focus["action_ref"])
                experiments.sort(key=lambda experiment:experiment!=focus["experiment"])
            for experiment in experiments:
                for cmd in commands:
                    pairs=trials[cmd]
                    evidence=[current.ref]
                    contrast=None
                    if experiment=="replicate_after_contextual_block":
                        if exposure_cache is None:
                            exposure_cache=contextual_translation_exposures(goal.memory.episode,current,commands)
                        contrast=exposure_cache.get(cmd)
                        if contrast is None:continue
                        evidence=contrast["evidence"]
                    elif experiment=="sample_unused_control":
                        if pairs:continue
                    elif experiment=="replicate_translation":
                        if len(pairs)!=1:continue
                        before,after=pairs[0]
                        if not registered(before,after) or not registered(after,current):continue
                        changed=[s for s in current.roles.keys() & after.roles.keys() & before.roles.keys()
                                 if relative_motion(before,after,s)!=(0,0) and current.roles[s][:2]!=before.roles[s][:2]]
                        if not changed:continue
                        evidence.extend((before.ref,after.ref))
                    else:raise ValueError("Unknown control experiment")
                    acquisition={"action_ref":cmd,"experiment":experiment,"evidence":evidence,
                                 "pair_ref":facts["pair_ref"],"observation_ref":current.ref,
                                 "objective":policy["objective"]}
                    if contrast is not None:
                        acquisition["exposure_contrast"]=contrast
                        acquisition["expected_motion"]={s:contrast["observed_delta"] for s in contrast["role_signatures"]}
                    if experiment=="replicate_translation":
                        acquisition["expected_motion"]={s:list(relative_motion(before,after,s)) for s in changed}
                    if cmd in recalled:
                        acquisition["recalled_method"]={"evidence":self.target_method["scoring_observation"],
                            "tested_prediction":recalled[cmd],"current_measured_vectors":sorted(bases)}
                    if inspect_only:
                        if frontier.can_probe_here(obs,{"action_ref":cmd}):return acquisition
                        continue
                    if self.attention.matches(acquisition,obs):acquisition["attention_ref"]=self.attention.item["id"]
                    proposal=frontier.propose(obs,inputs,control_acquisition=acquisition)
                    if proposal:return proposal
            return None
        def observation_frontier():
            offer=points.offer(obs,inputs) if "information_goal" not in self.order else None
            control=controls.offer(obs,inputs,registry)
            return frontier.propose(obs,inputs,prefix_evidence=(),experimental_probes=[offer] if offer else [],
                                    control_probe=control)
        def information_goal():
            if self.curiosity_policy.get("visual_sequences_first",False):
                proposed=self.visual_sequences.propose(obs,rows,inputs,remaining)
                if proposed:return proposed
            if self.curiosity_policy.get("feedback_sequences_first",False):
                proposed=self.feedback.propose(obs,rows,inputs,remaining)
                if proposed:return proposed
            meter=self.morph.meter.forecast()
            offers=[point_goal(probe) for probe in points.offers(obs,inputs)]
            offers+=self.displays.offers(obs,rows,inputs,self.curiosity_policy["coupled_displays"])
            scope={"actions":inputs,"remaining_actions":remaining,
                   "remaining_meter_steps":meter["steps_before_empty"] if meter else None,
                   "preserve_cells":obs.get("preserve_cells",[])}
            current=goal.memory.snapshot(obs,rows)
            for candidate in motion_offers(goal.memory.episode,current,scope,obs):
                offers.append(dict(candidate,source="motion_contrast"))
            pending=acquire_control(inspect_only=True) if offers else None
            for candidate,receipt in self.target_tree.information_goals(offers,obs,remaining,meter,self.curiosity_policy):
                active=self.morph.last or {}
                if (self.curiosity_policy.get("preserve_unbound_parent",False) and receipt["return_steps"] is None and active.get("status")=="retained"
                    and active.get("reason")==self.control_policy["requires_reason"] and
                    (not pending or receipt["action"]!={"action_ref":pending["action_ref"]})
                    and not (pending and pending["experiment"] in self.curiosity_policy["preserve_current_exposures"])):
                    deferred_curiosity.append({"reason":"unbound_return_from_the_current_role_acquisition_goal",
                                               "proposed_action":receipt["action"],"parent":active.get("composition")})
                    continue
                if pending:
                    same=receipt["action"]=={"action_ref":pending["action_ref"]}
                    if (not same and receipt["return_steps"] is None and
                        pending["experiment"] in self.curiosity_policy["preserve_current_exposures"]):
                        focus=self.attention.open(pending,obs)
                        if focus and self.attention.matches(pending,obs):
                            deferred_curiosity.append({"reason":"would_abandon_current_control_witness_without_bound_return",
                                "proposed_action":receipt["action"],"attention_ref":focus["id"],"preserved":pending})
                            continue
                    if same:
                        receipt["also_tests_current_control"]=dict(pending)
                        if self.attention.matches(pending,obs):
                            receipt["also_tests_current_control"]["attention_ref"]=self.attention.item["id"]
                probe=candidate.get("native_probe")
                result=frontier.propose(obs,inputs,curiosity=receipt,experimental_probes=[probe] if probe else [])
                if result:return result
            return None
        def resume_parent():
            if not returned:return None
            decision=self.morph.last or {}
            if decision.get("measured_facts",{}).get("pair_ref")!=returned["pair_ref"]:return None
            return acquire_control()
        def pre_score_offer():
            config=self.drm.document.declarations[0].configuration["pre_score_contact"]
            offer=goal.propose_effect(obs,rows,inputs,remaining,config)
            return offer if offer["status"]=="proposed" else None
        def material_access():
            config=self.drm.document.declarations[0].configuration
            for subtype in config["factored_material_return"]["ordered_subquestions"]:
                if subtype=="reactive_contact_continuation":
                    policy=config["reactive_contact_continuation"]
                    proposal=self.reactive.propose(obs,rows,inputs,remaining) if self.reactive.pending or self.reactive.recipe or self.reactive.source81_plan or self.reactive.prepared_source81 else None
                    if proposal:
                        offer=proposal["reactive_plan"]["offer"]
                        if offer["kind"] not in policy["kinds"] or not self.reactive.policy.holds(policy["conditions"],offer["facts"]):proposal=None
                        else:proposal["retained_dependency_continuation"]={"reason":policy["meaning"],"parent":offer["parent"]["id"],"evidence":offer["evidence"],"scope":obs["level_epoch"]}
                elif subtype=="observed_addressed_material":
                    proposal=self.fields.propose(obs,rows,inputs,remaining)
                elif subtype=="factored_material_return":
                    proposal=goal.propose_factored(obs,inputs,remaining)
                elif subtype=="observed_symbol_transaction":
                    proposal=self.symbols.propose(obs,rows,inputs,remaining)
                elif subtype=="observed_ranked_workshop":
                    proposal=self.workshop.propose(obs,rows,inputs,remaining)
                elif subtype=="observed_inventory_composition":
                    proposal=self.inventory.propose(obs,rows,inputs,remaining,forecast=self.morph.meter.forecast(),goal_models=goal.memory.models,collection=self.morph.collection)
                elif subtype=="observed_object_binding":
                    proposal=self.object_binding.propose(obs,rows,inputs,remaining,attention=self.attention)
                elif subtype=="observed_rigid_cargo":
                    proposal=self.cargo.propose(obs,rows,inputs,remaining)
                elif subtype=="motif_conditioned_access":
                    proposal=self.motifs.propose(obs,rows,inputs,remaining)
                elif subtype=="parallel_branch_routing":
                    proposal=self.branches.propose(obs,rows,inputs,remaining)
                elif subtype=="conserved_band_transfer":
                    proposal=self.bands.propose(obs,rows,inputs,remaining)
                elif subtype=="supported_ternary_reduction":
                    proposal=self.reduction.propose(obs,rows,inputs,remaining)
                elif subtype=="conditional_transit":
                    proposal=goal.propose_passage_options(obs,rows,inputs,remaining,{**config["pre_score_contact"],**config["conditional_transit"]})
                elif subtype=="ordered_reaction":
                    proposal=self.reaction.propose(obs,rows,inputs,remaining)
                elif subtype=="reactive_contact":
                    proposal=self.reactive.propose(obs,rows,inputs,remaining)
                elif subtype=="ordered_recruitment":
                    proposal=self.recruitment.propose(obs,rows,inputs,remaining)
                elif subtype=="window_question":
                    proposal=self.window_question.propose(obs,rows,inputs,remaining)
                elif subtype=="shared_settlement":
                    proposal=self.settlement.propose(obs,rows,inputs,remaining,config["shared_settlement_question"])
                elif subtype=="axial_question":
                    proposal=self.axial.propose(obs,rows,inputs,remaining)
                elif subtype=="temporal_selection":
                    proposal=self.temporal_selection.propose(obs,rows,inputs,remaining)
                elif subtype=="invited_endpoints":
                    proposal=self.endpoints.propose(obs,rows,inputs,remaining)
                elif subtype=="joint_channels":
                    proposal=self.channels.propose(obs,rows,inputs,remaining,forecast=self.morph.meter.forecast())
                elif subtype=="region_intervention":
                    proposal=self.regions.propose(obs,rows,inputs,remaining)
                elif subtype=="chart_navigation":
                    proposal=self.chart.propose(obs,rows,inputs,remaining)
                elif subtype=="topological_recolor":
                    proposal=self.recolor.propose(obs,rows,inputs,remaining)
                elif subtype=="observed_framed_transfer":
                    proposal=self.framed_transfer.propose(obs,rows,inputs,remaining)
                elif subtype=="observed_outline_service":
                    proposal=self.outline_service.propose(obs,rows,inputs,remaining)
                elif subtype in ("ordered_support_transfer","sliding_cavity","oriented_coupling","metric_composition","contextual_compartments","invited_reduction"):
                    proposal=self.supports.acquired_compositions[subtype].propose(obs,rows,inputs,remaining)
                else:raise ValueError("Unknown material-access subquestion")
                if proposal:
                    proposal["material_access_subquestion"]=subtype
                    return proposal
            return None
        def repeated_field():
            for subtype in self.drm.document.declarations[0].configuration["window_constraints"]["ordered_subquestions"]:
                if subtype=="observed_occurrence_recall":proposal=self.lines.recall_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["occurrence_recall"])
                elif subtype=="observed_program_composition":proposal=self.lines.program_propose(obs,rows,inputs,remaining)
                elif subtype=="cell_patch_composition":proposal=self.lines.cell_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["cell_patch_composition"])
                elif subtype=="linked_packet_composition":proposal=self.lines.linked_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["linked_packet_composition"])
                elif subtype=="trace_field_composition":proposal=self.lines.trace_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["trace_field_composition"])
                elif subtype=="labeled_sequence_composition":proposal=self.lines.labeled_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["labeled_sequence_composition"])
                elif subtype=="product_panel_composition":proposal=self.lines.product_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["product_panel_composition"])
                elif subtype=="queued_field_composition":proposal=self.lines.queue_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["queued_field_composition"])
                elif subtype=="occluded_catalogue_composition":proposal=self.lines.catalogue_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["occluded_catalogue_composition"])
                elif subtype=="framed_window_composition":proposal=self.lines.window_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["framed_window_composition"])
                elif subtype=="rooted_quota_composition":proposal=self.lines.rooted_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["rooted_quota_composition"])
                elif subtype=="observed_framed_analogy":proposal=self.framed_transfer.analogy(obs,rows,inputs,remaining)
                elif subtype=="field_service_composition":proposal=self.lines.service_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["field_service_composition"])
                elif subtype=="radial_port_composition":proposal=self.lines.radial_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["radial_port_composition"])
                elif subtype=="typed_material_flow":proposal=self.lines.material_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["typed_material_flow"])
                elif subtype=="coupled_prefix_reference":proposal=self.lines.cross_propose(obs,rows,inputs,remaining)
                elif subtype=="relative_arrangement":
                    proposal=self.arrangements.propose(obs,rows,inputs,remaining)
                    if self.arrangements.last_layout and not proposal:
                        return None  # Measured control interface is not a point-repair field.
                elif subtype=="multiscale_constraints":proposal=self.windows.propose(obs,rows,inputs,remaining)
                elif subtype=="recurrent_series":proposal=self.lines.propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"])
                elif subtype in ("periodic_sums","reflected_cover"):
                    proposal=self.supports.acquired_compositions[subtype].propose(obs,rows,inputs,remaining)
                else:raise ValueError("Unknown declared repeated-field subquestion")
                if proposal:
                    proposal["field_subquestion"]=subtype
                    return proposal
            policy=self.drm.document.declarations[0].configuration["regular_field_correspondence"]
            if policy.get("exclude_observed_control_interface"):
                field=motif_lattice(obs,rows,inputs)
                if field:
                    top=min(min(p["box"][1] for p in field["cards"]),min(y for x,y in field["points"]))
                    if motif_body(rows,top):return None
            return self.symmetry.propose(obs,rows,inputs,remaining)
        def program_construction():
            configuration=self.drm.document.declarations[0].configuration["program_construction"]
            providers={"facet_example":self.facets,"surface_rewrite":self.surface,"learned_code_program":self.codes,"slot_substitution":self.slots,"typed_word_interface":self.words,"rigid_port_assembly":self.ports,"controlled_constellation_cover":self.constellations,"linked_temporal_preparation":self.preparations}
            providers["configured_arrivals"]=self.supports.acquired_compositions["configured_arrivals"]
            providers["fixed_origin"]=self.supports.acquired_compositions["fixed_origin"]
            for question in configuration["ordered_subquestions"]:
                proposal=providers[question].propose(obs,rows,inputs,remaining)
                if proposal:
                    proposal["program_subquestion"]=question
                    return proposal
            return None
        def scored_continuation():
            config=self.drm.document.declarations[0].configuration["scored_local_rewrite"]
            proposal=goal.propose_scored_rewrite(obs,rows,inputs,remaining,{**self.drm.document.declarations[0].configuration["pre_score_contact"],**config})
            if proposal:return proposal
            minimum=config.get("minimum_completed_rows_for_visual_continuation")
            proposal=self.visual_sequences.propose_continuation(obs,rows,inputs,remaining,minimum) if minimum else None
            if proposal:return proposal
            return self.network.propose(obs,rows,inputs,remaining) if config.get("partial_network_after_score") else None
        self.providers={"goal_access":goal_offer,
                        "pre_score_contact":pre_score_offer,
                        "scored_local_rewrite":scored_continuation,
                        "factored_material_return":material_access,
                        "window_constraints":repeated_field,
                        "orbit_constraints":lambda:self.orbits.propose(obs,rows,inputs,remaining),
                        "containment":lambda:self.containment.propose(obs,rows,inputs,remaining),
                        "surface":program_construction,
                        "morphology":lambda:self.morph.propose(goal.memory,obs,rows,inputs,remaining),
                        "acquire_control_for_target":acquire_control,
                        "returned_branch_contrast":lambda:frontier.propose(obs,inputs,return_episode=goal.memory.episode),
                        "information_goal":information_goal,
                        "attention_parent_return":resume_parent,
                        "view":lambda:(view.propose(obs,rows,inputs,registry,remaining) if view else None) or self.lines.catalogue_view_propose(obs,rows,inputs,remaining,self.drm.document.declarations[0].configuration["window_constraints"]["occluded_catalogue_composition"]),
                        "view_continuity":continuity,"observed_frontier":observation_frontier}
        self.offers={}
        try:
            choice,receipt=self.program.run({"request":obs["observation_ref"]})
            selected=choice.get("selected")
            result=self.offers[selected] if selected else {"status":"no_admissible_family","actions":[]}
            result["strategy_receipt"]={**receipt,"drm_hash":self.drm.source_hash,
                                        "visited":choice["visited"],"selected":selected,"deferred_curiosity":deferred_curiosity}
            result["morphology"]=self.morph.last or {"status":"not_evaluated","reason":"prior_family_selected"}
            if returned:
                result["strategy_receipt"]["attention_return"]={k:returned[k] for k in ("id","status","parent","pair_ref","returned_at")}
            return result,selected in {"goal_access","pre_score_contact","factored_material_return","scored_local_rewrite"} and "motif_plan" not in result and "branch_plan" not in result and "band_plan" not in result and "reduction_plan" not in result and "sequence_plan" not in result and "network_plan" not in result and "cargo_plan" not in result and "binding_plan" not in result and "workshop_plan" not in result and "symbol_transaction_plan" not in result and "inventory_plan" not in result and "outline_plan" not in result and "framed_transfer_plan" not in result and "recolor_plan" not in result and "endpoint_plan" not in result and "channel_plan" not in result and "temporal_selection_plan" not in result and "region_plan" not in result and "chart_plan" not in result and "reaction_plan" not in result and "reactive_plan" not in result and "recruitment_plan" not in result and "preview_packing_plan" not in result and "window_question_plan" not in result and "selected_rigid_plan" not in result and "shared_settlement_plan" not in result and "axial_plan" not in result and "field_plan" not in result and "feedback_plan" not in result and "support_plan" not in result and "graph_access_plan" not in result and "pair_access_plan" not in result and "support_preparation_plan" not in result and "exposed_reception_plan" not in result and "chamber_relation_plan" not in result and "panel_service_plan" not in result and "rooted_line_plan" not in result and "reception_service_plan" not in result and "reference_population_plan" not in result,self.goal_reason
        finally:
            self.providers={}
            self.offers={}
