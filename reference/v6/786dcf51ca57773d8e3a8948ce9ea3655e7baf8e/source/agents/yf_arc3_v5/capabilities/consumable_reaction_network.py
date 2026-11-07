"""Immutable tick/burst calculations for declared directed reaction networks.

Old eligible fronts and pending batches are read from one tick snapshot.
Fresh incidences enter the next batch; an overlay never invents a lost event.
Clock, junction, intervention and phase laws are supplied by the caller.
"""
from __future__ import annotations

from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields

Point=tuple[int,int]


class ReactionElement(FrozenModel):
    element_ref: Ref
    cell: Point
    direction: Point
    phase_ref: Ref
    junction: bool
    target_ref: Ref | None = None


class ReactionOverlay(FrozenModel):
    overlay_ref: Ref
    cell: Point
    intervention: Literal["BLOCK", "RELAY"]
    forced_incidence_directions: tuple[Point,...] = Field(default=(),max_length=8)
    reusable_after_transmission: bool = False


class ReactionEdge(FrozenModel):
    source_ref: Ref
    target_ref: Ref
    incidence_direction: Point
    relay_cell: Point | None = None


class JunctionPhaseLaw(FrozenModel):
    phase_ref: Ref
    minimum_distinct_directions: int = Field(ge=1,le=8)
    accepts_incidence: bool
    next_phase_ref: Ref


class PendingIncidence(FrozenModel):
    element_ref: Ref
    directions: tuple[Point,...] = Field(max_length=8)
    @model_validator(mode="after")
    def distinct(self):
        if len(set(self.directions))!=len(self.directions):
            raise ValueError("pending incidence is a set of distinct directions")
        return self


class ReactionState(FrozenModel):
    elements: tuple[ReactionElement,...] = Field(max_length=256)
    overlays: tuple[ReactionOverlay,...] = Field(max_length=8)
    primed_refs: tuple[Ref,...] = Field(max_length=256)
    pending: tuple[PendingIncidence,...] = Field(max_length=256)
    acquired_target_refs: tuple[Ref,...] = Field(max_length=256)
    control_receiver_ref: Ref | None
    tick: int = Field(ge=0)
    remaining_budget: int = Field(ge=0)
    restore_epoch: int = Field(ge=0)
    execution_status: Literal["ACTIVE", "SUCCEEDED", "LOCAL_STOP", "REJECTED", "OFFICIAL_FAILURE", "RESTORED"] = "ACTIVE"
    @model_validator(mode="after")
    def references(self):
        refs={x.element_ref for x in self.elements}
        if len(refs)!=len(self.elements) or not set(self.primed_refs)<=refs:
            raise ValueError("reaction identities and primed references must be bound")
        if len(set(self.primed_refs))!=len(self.primed_refs):
            raise ValueError("duplicate primed element")
        if len({x.element_ref for x in self.pending})!=len(self.pending) or any(x.element_ref not in refs for x in self.pending):
            raise ValueError("pending receiver identities must be bound and unique")
        junction_refs={x.element_ref for x in self.elements if x.junction}
        if set(self.primed_refs)&junction_refs or any(x.element_ref not in junction_refs for x in self.pending):
            raise ValueError("ordinary fronts and junction incidence memories must stay distinct")
        if len({x.overlay_ref for x in self.overlays})!=len(self.overlays):
            raise ValueError("duplicate overlay identity")
        if self.control_receiver_ref is not None and self.control_receiver_ref not in {x.overlay_ref for x in self.overlays}:
            raise ValueError("selected overlay not in state")
        return self


class ReactionTerminalLaw(FrozenModel):
    law_ref: Ref
    acceptance_checkpoint: Literal["ALL_TARGETS", "ALL_TARGETS_QUIESCENT"]
    incomplete_quiescence: Literal["LOCAL_STOP", "REJECTED", "OFFICIAL_FAILURE", "RESTORED"]
    reject_quiescent_activation: bool
    restored_state: ReactionState | None = None
    @model_validator(mode="after")
    def restore_binding(self):
        if self.incomplete_quiescence=="RESTORED" and self.restored_state is None:
            raise ValueError("restoration requires the exact supplied state")
        return self


class ReactionCommand(FrozenModel):
    command_ref: Ref
    kind: Literal["MOVE", "SELECT", "ACTIVATE"]
    delta: Point=(0,0)
    control_receiver_ref: Ref | None=None
    cost: int = Field(ge=0)
    phases: tuple[Literal["MOVE", "SELECT", "CONTACT", "BURST", "FLUSH", "POST_SELECT", "CHECK"],...] = Field(max_length=8)
    contact_probe_offset: Point | None = None
    burst_quota: int = Field(ge=0,le=64)
    @model_validator(mode="after")
    def phase_ownership(self):
        if len(set(self.phases))!=len(self.phases):
            raise ValueError("each external phase may occur at most once")
        if self.kind=="MOVE" and "MOVE" not in self.phases:
            raise ValueError("movement phase must be supplied explicitly")
        if self.kind=="SELECT" and "SELECT" not in self.phases:
            raise ValueError("selection phase must be supplied explicitly")
        return self


class ReactionProtocolObservation(FrozenModel):
    evidence_ref: Ref
    command_kind: Literal["MOVE", "SELECT", "ACTIVATE"]
    tick_delta: int = Field(ge=0,le=128)
    selection_advanced: bool
    selection_before_ref: Ref | None = None
    selection_after_ref: Ref | None = None
    explicit_receiver_ref: Ref | None = None
    contacted_receiver_ref: Ref | None = None
    flush_observed: bool | None = None
    quiescence_reached: bool | None = None
    motion_before_cell: Point | None = None
    motion_after_cell: Point | None = None
    commanded_delta: Point | None = None


class ReactionProtocolAlternative(FrozenModel):
    protocol_ref: Ref
    ticks_by_kind: tuple[tuple[Ref,int],...]
    selection_advanced_by_kind: tuple[tuple[Ref,bool],...]
    receiver_rule_by_kind: tuple[tuple[Ref,Literal["KEEP", "EXPLICIT", "CONTACT", "CYCLE"]],...] = ()
    flush_by_kind: tuple[tuple[Ref,bool],...] = ()
    clock_semantics: Literal["EXACT", "BOUNDED_UNTIL_QUIESCENT"] | None = None
    movement_semantics: Literal["COMMANDED_OR_BLOCKED", "FROZEN"] | None = None
    @model_validator(mode="after")
    def command_domains(self):
        for table in (self.ticks_by_kind,self.selection_advanced_by_kind,self.receiver_rule_by_kind,self.flush_by_kind):
            if len({kind for kind,_ in table})!=len(table) or any(kind not in ("MOVE","SELECT","ACTIVATE") for kind,_ in table):
                raise ValueError("protocol tables must bind unique actual command kinds")
        if any(type(ticks) is not int or not 0<=ticks<=128 for _,ticks in self.ticks_by_kind):
            raise ValueError("declared tick quotas must be bounded integers")
        return self


class DatedIncidence(FrozenModel):
    evidence_ref: Ref
    receiver_ref: Ref
    direction: Point
    earliest_tick: int = Field(ge=0)
    latest_tick: int = Field(ge=0)
    @model_validator(mode="after")
    def interval(self):
        if self.earliest_tick>self.latest_tick:raise ValueError("invalid incidence interval")
        return self


class ReactionTerrainCell(FrozenModel):
    cell: Point
    substrate_ref: Ref | None = None
    evidence_ref: Ref | None = None


class ReactionTransmissionRule(FrozenModel):
    rule_ref: Ref
    source_kind: Literal["ORDINARY","JUNCTION"]
    source_phase_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    direction_mode: Literal["ORIENTATION","FIXED"]
    emitted_vectors: tuple[Point,...] = Field(default=(),max_length=8)
    incidence_convention: Literal["PROPAGATION_VECTOR","OPPOSITE_VECTOR"]
    target_kind: Literal["ORDINARY","JUNCTION","ANY"]
    target_substrate_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    maximum_span: int = Field(ge=1,le=2)
    gap_substrate_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    gap_element_phase_refs: tuple[Ref,...] = Field(default=(),max_length=16)
    gap_requires_relay: bool
    @model_validator(mode="after")
    def emission(self):
        if self.direction_mode=="FIXED" and not self.emitted_vectors:
            raise ValueError("a fixed emission rule supplies its vectors")
        if any((x,y)==(0,0) or abs(x)>1 or abs(y)>1 for x,y in self.emitted_vectors):
            raise ValueError("transmission vectors are adjacent lattice displacements")
        if len(set(self.emitted_vectors))!=len(self.emitted_vectors):raise ValueError("emission directions are unique")
        return self


class ReactionGraphModel(FrozenModel):
    model_ref: Ref
    transmission_rules: tuple[ReactionTransmissionRule,...] = Field(min_length=1,max_length=32)


class ReactionLattice(FrozenModel):
    lattice_ref: Ref
    validation_evidence_ref: Ref
    origin: Point
    pitch_x: int = Field(ge=1,le=256)
    pitch_y: int = Field(ge=1,le=256)
    core_width: int = Field(ge=1,le=256)
    core_height: int = Field(ge=1,le=256)
    @model_validator(mode="after")
    def footprint(self):
        if self.core_width>self.pitch_x or self.core_height>self.pitch_y:raise ValueError("cell cores fit the declared pitch")
        return self


class ReactionLayerTemplate(ContactLayerTemplate):
    cell: Point
    component: Literal["SUBSTRATE","DIRECTION","ELEMENT","OVERLAY","HUD"]


class ReactionPriorLayer(FrozenModel):
    template_ref: Ref
    prior_evidence_ref: Ref
    prior_role_ref: Ref
    prior_display_value_ref: Ref | None
    current_occluding_layer_ref: Ref
    current_opaque_support: tuple[Point,...] = Field(max_length=4096)
    substrate_change_possible: bool


class ReactionIncidenceFrame(FrozenModel):
    frame_ref: Ref
    primitive_ref: Ref
    event_owner_ref: Ref
    sealed: bool
    sequence_index: int = Field(ge=0)
    restore_epoch: int = Field(ge=0)
    earliest_causal_tick: int = Field(ge=0)
    latest_causal_tick: int = Field(ge=0)
    causal_clock_evidence_ref: Ref | None = None
    pending_before: tuple[PendingIncidence,...] = Field(max_length=256)
    pending_after: tuple[PendingIncidence,...] = Field(max_length=256)
    resolved_old_receiver_refs: tuple[Ref,...] = Field(max_length=256)
    directly_observed_hits: tuple[DatedIncidence,...] = Field(max_length=256)
    @model_validator(mode="after")
    def scoped_window(self):
        if self.earliest_causal_tick>self.latest_causal_tick:raise ValueError("causal frame interval is ordered")
        for batch in (self.pending_before,self.pending_after):
            if len({p.element_ref for p in batch})!=len(batch):raise ValueError("one pending direction set per receiver")
        if len(set(self.resolved_old_receiver_refs))!=len(self.resolved_old_receiver_refs):raise ValueError("resolved old receivers are unique")
        return self


class ReactionServiceDemand(FrozenModel):
    service_ref: Ref
    consumer_ref: Ref
    kind: Literal["HOLD_PRIMED","HOLD_PENDING","SUPPRESS_NEW_HIT","BRIDGE","FORCE_JUNCTION"]
    cell: Point
    element_ref: Ref | None = None
    start_tick: int = Field(ge=0)
    end_tick: int = Field(ge=0)
    required_directions: tuple[Point,...] = Field(default=(),max_length=8)
    transmission_receiver_ref: Ref | None = None
    @model_validator(mode="after")
    def interval(self):
        if self.start_tick>self.end_tick:raise ValueError("provider hold/release interval is ordered")
        if self.kind in ("HOLD_PRIMED","HOLD_PENDING","FORCE_JUNCTION") and self.element_ref is None:raise ValueError("front/junction service has an exact consumer element")
        return self


class ReactionArrivalReservation(FrozenModel):
    reservation_ref: Ref
    consumer_ref: Ref
    target_ref: Ref
    junction_ref: Ref
    useful_incidence_ref: Ref
    competing_incidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    restore_epoch: int = Field(ge=0)


class ConsumableReactionRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.consumable_reaction_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    state: ReactionState | None = None
    edges: tuple[ReactionEdge,...] = Field(default=(),max_length=2048)
    phase_laws: tuple[JunctionPhaseLaw,...] = Field(default=(),max_length=16)
    standing_phase_ref: Ref | None = None
    fallen_phase_ref: Ref | None = None
    traversable_cells: tuple[Point,...] = Field(default=(),max_length=4096)
    commands: tuple[ReactionCommand,...] = Field(default=(),max_length=32)
    command_ref: Ref | None=None
    selection_cycle: tuple[Ref,...] = Field(default=(),max_length=8)
    required_target_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    observations: tuple[ReactionProtocolObservation,...] = Field(default=(),max_length=64)
    protocol_alternatives: tuple[ReactionProtocolAlternative,...] = Field(default=(),max_length=16)
    incidences: tuple[DatedIncidence,...] = Field(default=(),max_length=256)
    overlay_pose_domains: tuple[tuple[Ref,tuple[Point,...]],...] = Field(default=(),max_length=8)
    expected_state: ReactionState | None=None
    actual_state: ReactionState | None=None
    official_failure: bool = False
    rejected_activation: bool = False
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=64)
    maximum_witnesses: int = Field(ge=1,le=3)
    overlay_collision_rule: Literal["ALLOW_OVERLAP", "BLOCK"] | None = None
    terminal_law: ReactionTerminalLaw | None = None
    terrain_cells: tuple[ReactionTerrainCell,...] = Field(default=(),max_length=4096)
    graph_models: tuple[ReactionGraphModel,...] = Field(default=(),max_length=64)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    maximum_domain_evaluations: int = Field(default=16384,ge=1,le=65536)
    lattice: ReactionLattice | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ReactionLayerTemplate,...] = Field(default=(),max_length=512)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=512)
    prior_layers: tuple[ReactionPriorLayer,...] = Field(default=(),max_length=512)
    incidence_frames: tuple[ReactionIncidenceFrame,...] = Field(default=(),max_length=256)
    service_demands: tuple[ReactionServiceDemand,...] = Field(default=(),max_length=256)
    reservation_demands: tuple[ReactionArrivalReservation,...] = Field(default=(),max_length=64)
    collect_causal_receipts: bool = False
    @model_validator(mode="after")
    def bound_graph(self):
        refs={x.element_ref for x in self.state.elements} if self.state is not None else set()
        if any(e.source_ref not in refs or e.target_ref not in refs for e in self.edges):
            raise ValueError("transmission edge endpoints must name supplied elements")
        if len({x.phase_ref for x in self.phase_laws})!=len(self.phase_laws):
            raise ValueError("junction phase laws must be unique")
        if len({x.command_ref for x in self.commands})!=len(self.commands):
            raise ValueError("duplicate external command")
        overlays={x.overlay_ref for x in self.state.overlays} if self.state is not None else set()
        if len(set(self.selection_cycle))!=len(self.selection_cycle) or self.state is not None and not set(self.selection_cycle)<=overlays:
            raise ValueError("selection cycle must contain bound unique overlays")
        if any(self.state is not None and ref not in overlays or len(poses)>256 for ref,poses in self.overlay_pose_domains):
            raise ValueError("overlay domains must be finite and bound")
        if len({ref for ref,_ in self.overlay_pose_domains})!=len(self.overlay_pose_domains):raise ValueError("one complete pose domain per overlay")
        if len({c.cell for c in self.terrain_cells})!=len(self.terrain_cells):raise ValueError("one substrate evidence row per cell")
        if len({m.model_ref for m in self.graph_models})!=len(self.graph_models):raise ValueError("graph model identities are unique")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError("one raw observation per retained pixel")
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("layer template identities are unique")
        if len({f.frame_ref for f in self.incidence_frames})!=len(self.incidence_frames):raise ValueError("sealed frame identities are unique")
        if len({d.service_ref for d in self.service_demands})!=len(self.service_demands):raise ValueError("service demands have unique identities")
        if len({row.reservation_ref for row in self.reservation_demands})!=len(self.reservation_demands):
            raise ValueError('arrival reservation identities must be unique')
        if self.state is not None and any(d.transmission_receiver_ref is not None
                and d.transmission_receiver_ref not in {e.element_ref for e in self.state.elements}
                for d in self.service_demands):
            raise ValueError('bridge transmission receiver must be bound in the current state')
        return self


OPERATION_MODES={"layers":"MEASURE","control_clock":"FIT","typed_edges":"PRECONDITION",
    "incidence_batches":"FIT","reaction_tick":"STEP_INTERNAL","inhibition_and_relay":"PRECONDITION",
    "external_transition":"STEP","intervention_preimages":"INVERSE_DOMAIN",
    "staged_schedule":"DOMAIN","quiescence_restore":"COMPARE"}


def _reaction_layers(request):
    lattice=request.lattice
    misaligned=tuple(t.template_ref for t in request.layer_templates if t.origin!=(lattice.origin[0]+t.cell[0]*lattice.pitch_x,lattice.origin[1]+t.cell[1]*lattice.pitch_y))
    if misaligned:return family_result(request,prerequisite_refs=("templates_on_current_validated_lattice",),
        values={"misaligned_template_refs":misaligned},domain_complete=False)
    # Identify the covering layer on the current pixels first, then remove only
    # its caller-declared opaque support from the substrate/direction read.
    overlay_templates=tuple(t for t in request.layer_templates if t.component=="OVERLAY")
    overlay_measure=measure_translated_layers(request.model_copy(update={"layer_templates":overlay_templates}))
    if overlay_measure.computation_bound_reached:return overlay_measure
    overlay_visible=overlay_measure.values.get("measured_layer_alternatives",())
    visible_overlay_refs={row["measurement"]["layer_ref"] for row in overlay_visible}
    covered={point for prior in request.prior_layers if prior.current_occluding_layer_ref in visible_overlay_refs for point in prior.current_opaque_support}
    remaining=request.maximum_evaluations-overlay_measure.examined_count
    if remaining<=0:
        return family_result(request,values={"current_visible_overlays":overlay_visible},examined_count=overlay_measure.examined_count,
            domain_complete=False,computation_bound_reached=True,frontier={"phase":"substrate_and_direction_templates","next_template_index":0})
    body_request=request.model_copy(update={"layer_templates":tuple(t for t in request.layer_templates if t.component!="OVERLAY"),
        "raw_layer_pixels":tuple(p for p in request.raw_layer_pixels if p.point not in covered),"maximum_evaluations":remaining})
    measured=measure_translated_layers(body_request)
    count=overlay_measure.examined_count+measured.examined_count
    if measured.computation_bound_reached:
        return measured.model_copy(update={"examined_count":count})
    templates={t.template_ref:t for t in request.layer_templates}
    visible=overlay_visible+measured.values.get("measured_layer_alternatives",())
    possible=overlay_measure.values.get("possible_layer_alternatives",())+measured.values.get("possible_layer_alternatives",())
    retained=[];predicted=[];unknown=[]
    possible_by_ref={row["template_ref"]:row for row in possible}
    for prior in request.prior_layers:
        row=possible_by_ref.get(prior.template_ref);template=templates.get(prior.template_ref)
        if row is None or template is None:continue
        unresolved_points={tuple(item[0]) for item in row["unknown_pixel_constraints"]}
        coverage=set(prior.current_opaque_support)
        same=(prior.prior_role_ref==template.role_ref and prior.prior_display_value_ref==template.display_value_ref)
        occluded=(prior.current_occluding_layer_ref in visible_overlay_refs and unresolved_points<=coverage)
        item={"prior_evidence_ref":prior.prior_evidence_ref,"template_ref":prior.template_ref,
            "lattice_cell":template.cell,"component":template.component,"possible_measurement":row["measurement"],
            "current_visibility":"OCCLUDED" if occluded else "UNRESOLVED",
            "currently_observed_content":False,"occluding_layer_ref":prior.current_occluding_layer_ref}
        if same and occluded and not prior.substrate_change_possible:retained.append(item)
        elif same and occluded:predicted.append(item)
        else:unknown.append(item)
    represented={item["template_ref"] for item in retained+predicted+unknown}
    unknown.extend({"template_ref":row["template_ref"],"unknown_pixel_constraints":row["unknown_pixel_constraints"]}
        for row in possible if row["template_ref"] not in represented)
    return family_result(request,values={"current_visible_layers":visible,"retained_covered_layers":tuple(retained),
        "predicted_covered_contents":tuple(predicted),"unknown_supports":tuple(unknown),
        "current_layer_refutations":overlay_measure.values.get("refutations",())+measured.values.get("refutations",()),
        "oriented_mask_supports":tuple((row["template_ref"],templates[row["template_ref"]].cell,
            templates[row["template_ref"]].component,row["measurement"]["support"],row["measurement"]["display_value_ref"]) for row in visible),
        "controller_count_inferred_from_hud":False,"canonical_roles_written":False,
        "lattice_ref":lattice.lattice_ref,"lattice_validation_evidence_ref":lattice.validation_evidence_ref},
        examined_count=count,prerequisite_refs=("current_covered_substrate_or_direction_evidence",) if predicted or unknown else ())


def _incidence_batches(request):
    exact={};intervals=[];old_batches=[];unknown=[];reconstructed=[];count=0;primitive_windows={}
    frames=tuple(sorted(request.incidence_frames,key=lambda f:(f.primitive_ref,f.sequence_index)))
    for frame_index,frame in enumerate(frames):
        if not frame.sealed or frame.event_owner_ref!=request.scope.event_owner_ref or frame.causal_clock_evidence_ref is None or frame.restore_epoch!=request.state.restore_epoch:
            unknown.append((frame.frame_ref,"sealed_current_owner_and_clock_evidence"));continue
        before={p.element_ref:set(p.directions) for p in frame.pending_before};after={p.element_ref:set(p.directions) for p in frame.pending_after}
        resolved=set(frame.resolved_old_receiver_refs)
        primitive_windows.setdefault(frame.primitive_ref,[]).append((frame.earliest_causal_tick,frame.latest_causal_tick))
        rows=[]
        for ref in sorted(resolved):
            if ref not in before:
                unknown.append((frame.frame_ref,ref,"observed_old_pending_before_resolution"));continue
            old_batches.append((frame.frame_ref,frame.primitive_ref,ref,frame.earliest_causal_tick,frame.latest_causal_tick,tuple(sorted(before[ref]))))
        for ref,directions in sorted(after.items()):
            fresh=directions if ref in resolved else directions-before.get(ref,set())
            for direction in sorted(fresh):
                rows.append(DatedIncidence(evidence_ref=frame.frame_ref,receiver_ref=ref,direction=direction,
                    earliest_tick=frame.earliest_causal_tick,latest_tick=frame.latest_causal_tick))
            if directions&before.get(ref,set()) and ref not in resolved:
                unknown.append((frame.frame_ref,ref,"unchanged_pending_cannot_reveal_duplicate_new_hit"))
        rows.extend(frame.directly_observed_hits)
        for row_index,row in enumerate(rows):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"old_pending_resolution_batches":tuple(old_batches),
                    "dated_new_batches":tuple((tick,ref,tuple(sorted(dirs))) for (tick,ref),dirs in sorted(exact.items())),
                    "uncertain_new_intervals":tuple(intervals),"unresolved_frame_evidence":tuple(unknown)},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"frame_index":frame_index,"row_index":row_index,"remaining_current_rows":tuple(rows[row_index:]),
                        "pending_frame_refs":tuple(f.frame_ref for f in frames[frame_index+1:])})
            count+=1
            if row.earliest_tick<frame.earliest_causal_tick or row.latest_tick>frame.latest_causal_tick:
                unknown.append((frame.frame_ref,row.evidence_ref,"hit_inside_owned_causal_window"));continue
            reconstructed.append((frame.frame_ref,frame.primitive_ref,row))
            if row.earliest_tick==row.latest_tick:exact.setdefault((row.earliest_tick,row.receiver_ref),set()).add(row.direction)
            else:intervals.append(row)
    return family_result(request,values={"old_pending_resolution_batches":tuple(old_batches),
        "dated_new_batches":tuple((tick,ref,tuple(sorted(dirs))) for (tick,ref),dirs in sorted(exact.items())),
        "uncertain_new_intervals":tuple(intervals),"owned_reconstructed_hits":tuple(reconstructed),
        "primitive_observation_windows":tuple((ref,tuple(windows)) for ref,windows in sorted(primitive_windows.items())),
        "unresolved_frame_evidence":tuple(unknown),"same_activation_proves_same_tick_distinct_directions":False},
        examined_count=count,prerequisite_refs=("sealed_incidence_clock_or_duplicate_direction_evidence",) if unknown else ())


def _typed_edges(request):
    state=request.state;terrain={cell.cell:cell for cell in request.terrain_cells};by_cell={};phase_laws={law.phase_ref:law for law in request.phase_laws}
    for element in state.elements:by_cell.setdefault(element.cell,[]).append(element)
    relay_cells={overlay.cell for overlay in state.overlays if overlay.intervention=="RELAY"}
    block_cells={overlay.cell for overlay in state.overlays if overlay.intervention=="BLOCK"}
    results=[];count=0;unknown=[]
    for model_index,model in enumerate(request.graph_models):
        structural=[];usable=[];conditions=[];model_unknown=[];covered_sources=[]
        for source_index,source in enumerate(state.elements):
            kind="JUNCTION" if source.junction else "ORDINARY"
            rules=tuple(rule for rule in model.transmission_rules if rule.source_kind==kind and source.phase_ref in rule.source_phase_refs)
            if not rules:
                conditions.append((source.element_ref,"emission_rule_for_current_kind_and_phase",source.phase_ref));continue
            for rule_index,rule in enumerate(rules):
                vectors=(source.direction,) if rule.direction_mode=="ORIENTATION" else rule.emitted_vectors
                for vector_index,vector in enumerate(vectors):
                    if vector==(0,0) or abs(vector[0])>1 or abs(vector[1])>1:
                        model_unknown.append((source.element_ref,"current_emission_orientation"));continue
                    for span in range(1,rule.maximum_span+1):
                        if count>=request.maximum_evaluations:
                            return family_result(request,values={"graph_model_results":tuple(results)},examined_count=count,
                                domain_complete=False,computation_bound_reached=True,
                                frontier={"model_index":model_index,"source_index":source_index,"rule_index":rule_index,
                                    "vector_index":vector_index,"span":span,"retained_structural_edges":tuple(structural),
                                    "retained_usable_edges":tuple(usable),"conditions":tuple(conditions),"unknowns":tuple(model_unknown)})
                        count+=1;cell=(source.cell[0]+span*vector[0],source.cell[1]+span*vector[1]);receivers=by_cell.get(cell,())
                        if len(receivers)>1:
                            model_unknown.append((cell,"unique_receiver_layer_assignment"));break
                        if not receivers:continue
                        target=receivers[0]
                        if rule.target_kind!="ANY" and ("JUNCTION" if target.junction else "ORDINARY")!=rule.target_kind:
                            if span==1 and target.phase_ref in rule.gap_element_phase_refs:continue
                            break
                        substrate=terrain.get(cell)
                        if substrate is None or substrate.substrate_ref is None or substrate.evidence_ref is None:
                            model_unknown.append((target.element_ref,"current_target_substrate"));break
                        if substrate.substrate_ref not in rule.target_substrate_refs:
                            conditions.append((target.element_ref,"transmission_substrate",substrate.substrate_ref));break
                        relay_cell=None;missing_conditions=[]
                        if span==2:
                            gap=(source.cell[0]+vector[0],source.cell[1]+vector[1]);gap_evidence=terrain.get(gap);gap_elements=by_cell.get(gap,())
                            if gap_evidence is None or gap_evidence.substrate_ref is None or gap_evidence.evidence_ref is None:
                                model_unknown.append((gap,"current_gap_substrate"));break
                            if gap_evidence.substrate_ref not in rule.gap_substrate_refs:
                                conditions.append((gap,"transmission_gap_substrate",gap_evidence.substrate_ref));break
                            if any(element.phase_ref not in rule.gap_element_phase_refs for element in gap_elements):
                                conditions.append((gap,"gap_element_phase",tuple(element.phase_ref for element in gap_elements)));break
                            if rule.gap_requires_relay:
                                relay_cell=gap
                                if gap not in relay_cells:missing_conditions.append((gap,"relay_provider_required"))
                        direction=vector if rule.incidence_convention=="PROPAGATION_VECTOR" else (-vector[0],-vector[1])
                        edge=ReactionEdge(source_ref=source.element_ref,target_ref=target.element_ref,incidence_direction=direction,relay_cell=relay_cell)
                        if edge not in structural:structural.append(edge)
                        if target.junction:
                            phase=phase_laws.get(target.phase_ref)
                            if phase is None:model_unknown.append((target.element_ref,"current_junction_incidence_law"));missing_conditions.append((target.element_ref,"junction_law_required"))
                            elif not phase.accepts_incidence:missing_conditions.append((target.element_ref,"junction_phase_accepts_incidence",target.phase_ref))
                            else:conditions.append((target.element_ref,"minimum_distinct_incidence_directions",phase.minimum_distinct_directions))
                        if target.cell in block_cells:missing_conditions.append((target.element_ref,"new_hit_not_covered_by_blocker"))
                        if source.cell in block_cells:
                            missing_conditions.append((source.element_ref,"source_not_held_by_blocker"));covered_sources.append(source.element_ref)
                        conditions.extend((edge,condition) for condition in missing_conditions)
                        if not missing_conditions and edge not in usable:usable.append(edge)
                        # A real receiver terminates this emitted ray. Traversability is irrelevant.
                        break
        unknown.extend(model_unknown)
        results.append({"model_ref":model.model_ref,"structural_edges":tuple(structural),"currently_usable_edges":tuple(usable),
            "exact_conditions":tuple(conditions),"unknown_supports":tuple(model_unknown),
            "retained_blocked_sources":tuple(dict.fromkeys(covered_sources)),"traversability_used_as_transmission":False})
    return family_result(request,values={"graph_model_results":tuple(results)},examined_count=count,
        prerequisite_refs=("current_transmission_support_or_direction_or_junction_evidence",) if unknown else ())


def _fit_control_clock(request):
    if not request.observations or not request.protocol_alternatives:
        return family_result(request,prerequisite_refs=("clock_observations_and_protocol_alternatives",),domain_complete=False)
    if any(p.clock_semantics is None or p.movement_semantics is None or not p.receiver_rule_by_kind or not p.flush_by_kind
           for p in request.protocol_alternatives):
        return family_result(request,prerequisite_refs=("receiver_flush_motion_and_clock_contracts",),domain_complete=False)
    retained=[];refutations=[];unknowns=[]
    for protocol in request.protocol_alternatives:
        ticks=dict(protocol.ticks_by_kind);advanced=dict(protocol.selection_advanced_by_kind)
        receivers=dict(protocol.receiver_rule_by_kind);flushes=dict(protocol.flush_by_kind);first=None;unresolved=[]
        for observation in request.observations:
            kind=observation.command_kind
            if kind not in ticks or kind not in advanced or kind not in receivers or kind not in flushes:
                unresolved.append((observation.evidence_ref,"command_protocol_row"));continue
            quota=ticks[kind]
            clock_ok=observation.tick_delta==quota if protocol.clock_semantics=="EXACT" else observation.tick_delta<=quota
            if protocol.clock_semantics=="BOUNDED_UNTIL_QUIESCENT" and observation.tick_delta<quota and observation.quiescence_reached is False:
                clock_ok=False
            if not clock_ok or advanced[kind]!=observation.selection_advanced:
                first=(observation.evidence_ref,"clock_or_selection_advance");break
            if observation.flush_observed is not None and observation.flush_observed!=flushes[kind]:
                first=(observation.evidence_ref,"flush_clock");break
            if observation.flush_observed is None:unresolved.append((observation.evidence_ref,"flush_observation"))
            before=observation.selection_before_ref;after=observation.selection_after_ref;rule=receivers[kind]
            if 'selection_before_ref' in observation.model_fields_set and 'selection_after_ref' in observation.model_fields_set:
                if rule=="KEEP":expected=before
                elif rule=="EXPLICIT":
                    if 'explicit_receiver_ref' not in observation.model_fields_set:unresolved.append((observation.evidence_ref,"explicit_receiver"));continue
                    expected=observation.explicit_receiver_ref
                elif rule=="CONTACT":
                    if 'contacted_receiver_ref' not in observation.model_fields_set:unresolved.append((observation.evidence_ref,"contact_receiver"));continue
                    expected=observation.contacted_receiver_ref if observation.contacted_receiver_ref is not None else before
                else:
                    if before not in request.selection_cycle:unresolved.append((observation.evidence_ref,"selection_cycle"));continue
                    expected=request.selection_cycle[(request.selection_cycle.index(before)+1)%len(request.selection_cycle)]
                if after!=expected:first=(observation.evidence_ref,"receiver_transition");break
            else:unresolved.append((observation.evidence_ref,"receiver_before_and_after"))
            if kind=="MOVE" and observation.motion_before_cell is not None and observation.motion_after_cell is not None:
                moved=(observation.motion_after_cell[0]-observation.motion_before_cell[0],observation.motion_after_cell[1]-observation.motion_before_cell[1])
                if protocol.movement_semantics=="FROZEN" and moved!=(0,0):first=(observation.evidence_ref,"frozen_motion");break
                if protocol.movement_semantics=="COMMANDED_OR_BLOCKED" and observation.commanded_delta is not None and moved not in ((0,0),observation.commanded_delta):
                    first=(observation.evidence_ref,"commanded_motion");break
        if first is None:retained.append(protocol);unknowns.extend((protocol.protocol_ref,*item) for item in unresolved)
        else:refutations.append((protocol.protocol_ref,first))
    return family_result(request,values={"compatible_protocols":tuple(retained),"first_refutations":tuple(refutations),
        "unresolved_observations":tuple(unknowns),"tick_is_not_fallen_body_count":True,
        "movement_contact_explicit_selection_and_activation_separate":True},examined_count=len(request.observations)*len(request.protocol_alternatives),
        domain_complete=not unknowns)


def _enabled_edges(request,state):
    relays={x.cell for x in state.overlays if x.intervention=="RELAY"}
    return tuple(e for e in request.edges if e.relay_cell is None or e.relay_cell in relays)


def _tick(request,state):
    elements={x.element_ref:x for x in state.elements}
    phases={x.phase_ref:x for x in request.phase_laws}
    blockers={x.cell for x in state.overlays if x.intervention=="BLOCK"}
    relays={x.cell:x for x in state.overlays if x.intervention=="RELAY"}
    retained_primed=[];retained_pending={};fired=[];acquired=list(state.acquired_target_refs);events=[]
    next_pending={};next_primed=set()
    missing=[]
    for ref in state.primed_refs:
        element=elements[ref]
        if element.cell in blockers:
            retained_primed.append(ref)
            events.append((request.scope.event_owner_ref,state.tick,ref,'held_primed',tuple(
                row.overlay_ref for row in state.overlays if row.intervention=='BLOCK' and row.cell==element.cell)))
            continue
        if element.phase_ref==request.standing_phase_ref and not element.junction:
            fired.append(ref);elements[ref]=element.model_copy(update={"phase_ref":request.fallen_phase_ref})
    # Only old batches participate in this loop. Fresh hits are collected below.
    for pending in state.pending:
        element=elements[pending.element_ref]
        if element.cell in blockers:
            retained_pending[element.element_ref]=set(pending.directions)
            events.append((request.scope.event_owner_ref,state.tick,element.element_ref,'held_pending',
                (pending.directions,tuple(row.overlay_ref for row in state.overlays
                    if row.intervention=='BLOCK' and row.cell==element.cell),element.phase_ref,
                 relays[element.cell].forced_incidence_directions if element.cell in relays else ())))
            continue
        law=phases.get(element.phase_ref)
        if law is None:
            missing.append(element.phase_ref);continue
        incoming=set(pending.directions)
        relay=relays.get(element.cell)
        if incoming and relay is not None:
            incoming.update(relay.forced_incidence_directions)
        if law.accepts_incidence and len(incoming)>=law.minimum_distinct_directions:
            fired.append(element.element_ref)
            elements[element.element_ref]=element.model_copy(update={"phase_ref":law.next_phase_ref})
            events.append((request.scope.event_owner_ref,state.tick,element.element_ref,'junction_emission_inputs',
                (element.phase_ref,pending.directions,relay.overlay_ref if relay is not None else None,
                 relay.forced_incidence_directions if relay is not None else (),law.minimum_distinct_directions)))
        events.append((request.scope.event_owner_ref,state.tick,element.element_ref,"resolved_old_batch",tuple(sorted(incoming))))
    if missing:
        return state,(),tuple(dict.fromkeys(missing))
    edges=_enabled_edges(request,state)
    for ref in fired:
        element=elements[ref]
        events.append((request.scope.event_owner_ref,state.tick,ref,"emitted",()))
        if element.target_ref is not None and element.target_ref not in acquired:
            acquired.append(element.target_ref)
        for edge in edges:
            if edge.source_ref!=ref:continue
            target=elements[edge.target_ref]
            if target.cell in blockers:
                events.append((request.scope.event_owner_ref,state.tick,target.element_ref,"discarded_new_hit",(edge.incidence_direction,)))
                events.append((request.scope.event_owner_ref,state.tick,target.element_ref,'discarded_new_hit_source',
                    (ref,edge.incidence_direction,edge.relay_cell,state.restore_epoch,target.phase_ref)))
                continue
            if target.junction:
                law=phases.get(target.phase_ref)
                if law is None:
                    missing.append(target.phase_ref);continue
                if law.accepts_incidence:
                    next_pending.setdefault(target.element_ref,set()).add(edge.incidence_direction)
                    events.append((request.scope.event_owner_ref,state.tick,target.element_ref,'accepted_new_hit',
                        (ref,edge.incidence_direction,edge.relay_cell,state.restore_epoch)))
                    if edge.relay_cell is not None:
                        for provider in state.overlays:
                            if provider.intervention=='RELAY' and provider.cell==edge.relay_cell:
                                events.append((request.scope.event_owner_ref,state.tick,provider.overlay_ref,
                                    'bridge_delivered',(ref,target.element_ref,edge.incidence_direction,edge.relay_cell,state.restore_epoch)))
            elif target.phase_ref==request.standing_phase_ref:
                next_primed.add(target.element_ref)
                events.append((request.scope.event_owner_ref,state.tick,target.element_ref,'accepted_new_hit',
                    (ref,edge.incidence_direction,edge.relay_cell,state.restore_epoch)))
                if edge.relay_cell is not None:
                    for provider in state.overlays:
                        if provider.intervention=='RELAY' and provider.cell==edge.relay_cell:
                            events.append((request.scope.event_owner_ref,state.tick,provider.overlay_ref,
                                'bridge_delivered',(ref,target.element_ref,edge.incidence_direction,edge.relay_cell,state.restore_epoch)))
    if missing:return state,(),tuple(dict.fromkeys(missing))
    for ref,directions in sorted(retained_pending.items()):next_pending.setdefault(ref,set()).update(directions)
    successor=state.model_copy(update={"elements":tuple(elements[x.element_ref] for x in state.elements),
        "primed_refs":tuple(dict.fromkeys(retained_primed+sorted(next_primed))),
        "pending":tuple(PendingIncidence(element_ref=ref,directions=tuple(sorted(directions))) for ref,directions in sorted(next_pending.items())),
        "acquired_target_refs":tuple(acquired),"tick":state.tick+1})
    return successor,tuple(events),()


def _external(request,state,command,state_observer=None):
    if state.execution_status!="ACTIVE":return state,(),("active_external_execution_scope",)
    if command.cost>state.remaining_budget:
        return state,(),("remaining_external_budget",)
    successor=state.model_copy(update={"remaining_budget":state.remaining_budget-command.cost})
    events=[]
    law=request.terminal_law
    if command.kind=="ACTIVATE" and not state.primed_refs and not state.pending and law.reject_quiescent_activation:
        after=successor.model_copy(update={"execution_status":"REJECTED"})
        return after,((request.scope.event_owner_ref,state.tick,"external_activation","rejected_quiescent",law.law_ref),),()
    for phase in command.phases:
        if phase=="MOVE":
            selected=next((x for x in successor.overlays if x.overlay_ref==successor.control_receiver_ref),None)
            if selected is None:return state,(),("bound_selected_overlay",)
            destination=(selected.cell[0]+command.delta[0],selected.cell[1]+command.delta[1])
            occupied=any(x.overlay_ref!=selected.overlay_ref and x.cell==destination for x in successor.overlays)
            if destination in request.traversable_cells and (not occupied or request.overlay_collision_rule=="ALLOW_OVERLAP"):
                successor=successor.model_copy(update={"overlays":tuple(
                    x.model_copy(update={"cell":destination}) if x.overlay_ref==selected.overlay_ref else x for x in successor.overlays)})
            events.append((request.scope.event_owner_ref,successor.tick,selected.overlay_ref,"move_attempt",destination))
        elif phase=="SELECT":
            if command.control_receiver_ref not in {x.overlay_ref for x in successor.overlays}:
                return state,(),("bound_explicit_selection",)
            successor=successor.model_copy(update={"control_receiver_ref":command.control_receiver_ref})
            events.append((request.scope.event_owner_ref,successor.tick,command.control_receiver_ref,"explicit_selection",()))
        elif phase=="CONTACT":
            mover=next((x for x in successor.overlays if x.overlay_ref==successor.control_receiver_ref),None)
            if mover is None or command.contact_probe_offset is None:return state,(),("bound_contact_probe_and_current_receiver",)
            probe=(mover.cell[0]+command.contact_probe_offset[0],mover.cell[1]+command.contact_probe_offset[1])
            contacted=tuple(x.overlay_ref for x in successor.overlays if x.overlay_ref!=mover.overlay_ref and x.cell==probe)
            if len(contacted)>1:return state,(),("unambiguous_contact_receiver",)
            if contacted:
                successor=successor.model_copy(update={"control_receiver_ref":contacted[0]})
                events.append((request.scope.event_owner_ref,successor.tick,contacted[0],"contact_selection",probe))
        elif phase in ("BURST","FLUSH"):
            quota=command.burst_quota if phase=="BURST" else 1
            for _ in range(quota):
                if not successor.primed_refs and not successor.pending:break
                successor,trace,missing=_tick(request,successor)
                if missing:return state,(),missing
                events.extend(trace)
                if state_observer is not None and not state_observer(successor):
                    return state,(),('reaction_service.microstate_constraint_or_budget',)
        elif phase=="POST_SELECT":
            if successor.control_receiver_ref not in request.selection_cycle or not request.selection_cycle:
                return state,(),("declared_post_burst_selection_cycle",)
            index=request.selection_cycle.index(successor.control_receiver_ref)
            successor=successor.model_copy(update={"control_receiver_ref":request.selection_cycle[(index+1)%len(request.selection_cycle)]})
            events.append((request.scope.event_owner_ref,successor.tick,successor.control_receiver_ref,"post_burst_selection",()))
        else:
            if not request.required_target_refs:return state,(),("declared_nonempty_target_conjunction",)
            quiescent=not successor.primed_refs and not successor.pending
            acquired=set(request.required_target_refs)<=set(successor.acquired_target_refs)
            accepted=acquired and (law.acceptance_checkpoint=="ALL_TARGETS" or quiescent)
            status="SUCCEEDED" if accepted else (law.incomplete_quiescence if quiescent else "ACTIVE")
            events.append((request.scope.event_owner_ref,successor.tick,"external_checkpoint","required_targets",
                           tuple(ref for ref in request.required_target_refs if ref in successor.acquired_target_refs)))
            if status=="RESTORED":
                successor=law.restored_state.model_copy(update={"remaining_budget":successor.remaining_budget,
                    "restore_epoch":successor.restore_epoch+1,"execution_status":"RESTORED"})
            else:successor=successor.model_copy(update={"execution_status":status})
            events.append((request.scope.event_owner_ref,successor.tick,law.law_ref,"declared_execution_status",status))
        if state_observer is not None and not state_observer(successor):
            return state,(),('reaction_service.microstate_constraint_or_budget',)
        if successor.execution_status!='ACTIVE':break
    return successor,tuple(events),()


def _domain(request):
    queue=deque(((request.state,0),));seen={request.state:0};parents={request.state:(None,None)};costs={request.state:0}
    nodes=[];witnesses=[];count=0;capped=False;missing=[];depth_pending=[];parent_events={}
    staged_rows=();staged_complete=False;reuse_rows=();reuse_complete=False;causal_projection={}
    from .reaction_service_constraints_d import reaction_service_constraints_d
    service_evaluations=0;service_bound=False;rejected_service_edges=[];rejected_service_count=0
    def observe_services(snapshot):
        nonlocal service_evaluations,service_bound
        if not request.service_demands:return True
        measured=reaction_service_constraints_d(request,snapshot,request.maximum_evaluations-count-service_evaluations)
        service_evaluations+=measured['evaluations']
        if not measured['complete']:service_bound=True;return False
        return not measured['violated_service_refs']
    if not observe_services(request.state):
        return family_result(request,prerequisite_refs=('reaction_service.current_initial_service_constraints',),
            examined_count=service_evaluations,domain_complete=False,computation_bound_reached=service_bound)
    while queue:
        if len(nodes)>=request.maximum_states or count+service_evaluations>=request.maximum_evaluations:capped=True;break
        state,depth=queue.popleft();count+=1;edges=[]
        cost=costs[state]
        targets_present=bool(request.required_target_refs) and set(request.required_target_refs)<=set(state.acquired_target_refs)
        acceptance=(targets_present and state.execution_status=='SUCCEEDED'
            and (request.terminal_law.acceptance_checkpoint=='ALL_TARGETS' or not(state.primed_refs or state.pending)))
        if acceptance:
            if not witnesses:
                if count+service_evaluations+depth>request.maximum_evaluations:
                    capped=True;queue.appendleft((state,depth));break
                count+=depth
                word=[];transitions=[];cursor=state
                while parents[cursor][0] is not None:
                    previous,command=parents[cursor];word.append(command)
                    transitions.append((previous,command,cursor,parent_events[cursor]));cursor=previous
                word=tuple(reversed(word))
                from .reaction_staged_endpoints_d import reaction_staged_endpoints_d
                staged=reaction_staged_endpoints_d(request,tuple(reversed(transitions)),
                    request.maximum_evaluations-count-service_evaluations)
                count+=staged['evaluations'];staged_complete=staged['complete'];staged_rows=staged['rows']
                missing.extend(staged['missing_refs'])
                from .reaction_relay_reuse_d import reaction_relay_reuse_d
                reuse=reaction_relay_reuse_d(request,tuple(reversed(transitions)),
                    request.maximum_evaluations-count-service_evaluations)
                count+=reuse['evaluations'];reuse_rows=reuse['rows'];reuse_complete=reuse['complete']
                missing.extend(reuse['missing_refs'])
                if request.collect_causal_receipts:
                    from .reaction_causal_trace_d import reaction_causal_trace_d
                    causal_projection=reaction_causal_trace_d(request,tuple(reversed(transitions)),
                        request.maximum_evaluations-count-service_evaluations)
                    count+=causal_projection['evaluations'];missing.extend(causal_projection['missing_refs'])
                witnesses.append({"state":state,"depth":depth,"pose_assignments":tuple((x.overlay_ref,x.cell) for x in state.overlays),
                    "word":word,"cost":cost,"cursor_access_required":False,"acceptance_reached":True})
        if depth<request.maximum_depth and state.execution_status=="ACTIVE":
            for command in request.commands:
                after,trace,unresolved=_external(request,state,command,state_observer=observe_services)
                if unresolved==('reaction_service.microstate_constraint_or_budget',):
                    if service_bound:capped=True;break
                    rejected_service_count+=1
                    if len(rejected_service_edges)<64:rejected_service_edges.append((seen[state],command.command_ref))
                    continue
                if unresolved:
                    missing.extend(unresolved);continue
                edges.append({"command_ref":command.command_ref,"after":after,"events":trace})
                if after not in seen:
                    if len(seen)>=request.maximum_states:capped=True;continue
                    seen[after]=depth+1;parents[after]=(state,command);parent_events[after]=trace
                    costs[after]=cost+command.cost;queue.append((after,depth+1))
        elif state.execution_status=="ACTIVE" and depth>=request.maximum_depth:
            capped=True;depth_pending.append((state,depth,cost))
        nodes.append({"state":state,"depth":depth,"cost":cost,"transitions":tuple(edges)})
    return family_result(request,values={"state_domain":tuple(nodes),"target_witnesses":tuple(witnesses),
        "depth_bound":request.maximum_depth,"placement_access_verified_under_supplied_model":True,
        "target_events_without_checkpoint_are_not_terminal":True,"ordinary_element_activation_required":False,
        "first_complete_witness_in_supplied_command_order":True,
        "staged_endpoint_rows":staged_rows,"staged_endpoint_projection_complete":staged_complete,
        "relay_reuse_rows":reuse_rows,"relay_reuse_projection_complete":reuse_complete,
        'causal_trace':causal_projection,
        "service_microstate_constraints_checked":bool(request.service_demands),
        "rejected_service_edge_count":rejected_service_count,
        "rejected_service_edge_refs":tuple(rejected_service_edges)},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count+service_evaluations,
        domain_complete=not capped and not missing,computation_bound_reached=capped,
        frontier={"pending":tuple(queue),"depth_pending":tuple(depth_pending),"visited":tuple(seen),
            "predecessor_links":tuple((state,*parents[state],costs[state]) for state in seen)} if capped else {})


def _inhibition_service(request):
    state=request.state;elements={e.element_ref:e for e in state.elements};pending={p.element_ref:p for p in state.pending};phases={p.phase_ref:p for p in request.phase_laws}
    blocked={x.cell for x in state.overlays if x.intervention=="BLOCK"}
    lost=tuple(x for x in request.incidences if x.receiver_ref in elements and elements[x.receiver_ref].cell in blocked)
    offers=[];unknown=[];count=0
    for demand_index,demand in enumerate(request.service_demands):
        element=elements.get(demand.element_ref);conditions=[]
        if demand.kind=="HOLD_PRIMED" and (element is None or element.element_ref not in state.primed_refs):conditions.append("live_primed_source_at_hold_entry")
        if demand.kind=="HOLD_PENDING" and (element is None or element.element_ref not in pending):conditions.append("old_pending_batch_at_hold_entry")
        if demand.kind in ("HOLD_PRIMED","HOLD_PENDING","FORCE_JUNCTION") and element is not None and element.cell!=demand.cell:conditions.append("consumer_at_service_cell")
        if demand.start_tick<state.tick:conditions.append("service_entry_not_in_closed_past")
        candidate_providers=[]
        for overlay_index,overlay in enumerate(state.overlays):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"service_offers":tuple(offers),"lost_new_incidences":lost},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"demand_index":demand_index,"overlay_index":overlay_index,"current_provider_refs":tuple(candidate_providers),"current_conditions":tuple(conditions)})
            count+=1
            expected_kind="RELAY" if demand.kind in ("BRIDGE","FORCE_JUNCTION") else "BLOCK"
            if overlay.intervention!=expected_kind:continue
            poses=next((poses for ref,poses in request.overlay_pose_domains if ref==overlay.overlay_ref),(overlay.cell,))
            if demand.cell not in poses and demand.cell!=overlay.cell:continue
            provider_conditions=list(conditions)
            if demand.kind=="BRIDGE" and not any(edge.relay_cell==demand.cell for edge in request.edges):provider_conditions.append("declared_transmission_edge_uses_this_gap")
            if demand.kind=="FORCE_JUNCTION":
                phase=phases.get(element.phase_ref) if element is not None and element.junction else None
                old=pending.get(demand.element_ref)
                if phase is None:provider_conditions.append("current_junction_incidence_law")
                elif not phase.accepts_incidence:provider_conditions.append("current_phase_accepts_incidence")
                if old is None or not old.directions:provider_conditions.append("accepted_old_incidence_before_forced_resolution")
                elif phase is not None and len(set(old.directions)|set(overlay.forced_incidence_directions))<phase.minimum_distinct_directions:provider_conditions.append("enough_distinct_directions_at_resolution")
                if not set(demand.required_directions)<=set(overlay.forced_incidence_directions):provider_conditions.append("provider_has_required_forced_directions")
            candidate_providers.append({"overlay_ref":overlay.overlay_ref,"intervention":overlay.intervention,
                "service_cell":demand.cell,"hold_from_tick":demand.start_tick,"release_after_tick":demand.end_tick,
                "currently_at_service_cell":overlay.cell==demand.cell,"cursor_access_required":overlay.cell!=demand.cell,
                "prerequisite_refs":tuple(provider_conditions),
                "covered_incidence_refs":tuple(i.evidence_ref for i in request.incidences if i.receiver_ref in elements and elements[i.receiver_ref].cell==demand.cell),
                "earliest_service_deadline":demand.start_tick})
        offers.append({"service_ref":demand.service_ref,"consumer_ref":demand.consumer_ref,"providers":tuple(candidate_providers)})
        if not candidate_providers:unknown.append(demand.service_ref)
    from .reaction_opening_options_d import reaction_opening_options_d
    opening=reaction_opening_options_d(request,request.maximum_evaluations-count)
    from .reaction_arrival_reservation_d import reaction_arrival_reservation_d
    reservation=reaction_arrival_reservation_d(request,request.maximum_evaluations-count-opening['evaluations'])
    return family_result(request,values={"saved_primed_refs":tuple(ref for ref in state.primed_refs if elements[ref].cell in blocked),
        "saved_pending":tuple(p for p in state.pending if elements[p.element_ref].cell in blocked),
        "lost_new_incidences":lost,"service_offers":tuple(offers),"service_clock":state.tick,
        "lost_events_recreated":False,"provider_assignment_selected":False,'opening_options':opening,
        'arrival_reservations':reservation},
        examined_count=count+opening['evaluations']+reservation['evaluations'],
        domain_complete=opening['complete'] and reservation['complete'] and not unknown,
        prerequisite_refs=tuple(dict.fromkeys((*(('compatible_provider_or_declared_pose_domain',) if unknown else ()),
            *opening['missing_refs'],*reservation['missing_refs']))))


def _intervention_preimages(request):
    # Every placement below is reached from the current state by owned commands.
    # A pose product alone never proves that the cursor can arrange those poses.
    if request.maximum_domain_evaluations>=request.maximum_evaluations:
        return family_result(request,prerequisite_refs=("domain_budget_leaves_service_reconstruction",),domain_complete=False)
    domain=_domain(request.model_copy(update={"maximum_evaluations":request.maximum_domain_evaluations}))
    witnesses=domain.values.get("target_witnesses",())
    from .reaction_target_dependencies_d import reaction_target_dependencies_d
    dependencies=reaction_target_dependencies_d(request,request.maximum_evaluations-domain.examined_count)
    if not dependencies['target_predecessor_projection_complete']:
        return family_result(request,values={'target_dependencies':dependencies},
            prerequisite_refs=dependencies['target_predecessor_information_need_refs'],
            examined_count=domain.examined_count+dependencies['evaluations'],domain_complete=False)
    incoming={};outgoing={};by_ref={e.element_ref:e for e in request.state.elements}
    for edge in request.edges:incoming.setdefault(edge.target_ref,[]).append(edge);outgoing.setdefault(edge.source_ref,[]).append(edge)
    predecessors=set(dependencies['target_predecessor_refs'])
    assignments=[];count=domain.examined_count+dependencies['evaluations'];pending=[]
    if count>=request.maximum_evaluations:
        return family_result(request,values={"bounded_current_state_domain":domain},examined_count=count,
            domain_complete=False,computation_bound_reached=True,frontier={"next_witness_index":0})
    for witness_index,witness in enumerate(witnesses):
        if count>=request.maximum_evaluations:pending.append((witness_index,"witness_bound"));break
        count+=1;word=witness.get("word",());state=request.state;timeline=[];unknown=[];trace=[]
        for command_index,encoded in enumerate(word):
            command=ReactionCommand.model_validate(encoded)
            if count>=request.maximum_evaluations:pending.append((witness_index,command_index,state,tuple(timeline)));break
            count+=1;before=state;state,events,missing=_external(request,state,command);unknown.extend(missing);trace.extend(events)
            timeline.append((before,command,state,events))
        if unknown:continue
        if pending:break
        services=[]
        for overlay in request.state.overlays:
            snapshots=[request.state]+[after for _,_,after,_ in timeline];runs=[];run=None
            for snapshot_index,snapshot in enumerate(snapshots):
                pose=next(o for o in snapshot.overlays if o.overlay_ref==overlay.overlay_ref)
                same=run is not None and run[0]==pose.cell
                if same:run=(run[0],run[1],snapshot.tick,run[3],snapshot_index)
                else:
                    if run is not None:runs.append(run)
                    run=(pose.cell,snapshot.tick,snapshot.tick,snapshot_index,snapshot_index)
            if run is not None:runs.append(run)
            for cell,start,end,first,last in runs:
                held=tuple(e.element_ref for e in request.state.elements if e.cell==cell and e.element_ref in predecessors)
                bridge_edges=tuple(edge for edge in request.edges if edge.relay_cell==cell)
                if not held and not bridge_edges:continue
                bridge_sources={edge.source_ref for edge in bridge_edges}
                affected=tuple((owner,tick,ref,event,value) for owner,tick,ref,event,value in trace if start<=tick<=end and (ref in held or event=="emitted" and ref in bridge_sources))
                services.append({"overlay_ref":overlay.overlay_ref,"intervention":overlay.intervention,"cell":cell,
                    "hold_from_tick":start,"release_after_tick":end,"entry_command_index":first,"exit_command_index":last,
                    "retained_source_or_junction_refs":held,"bridge_edges":bridge_edges,"dated_events":affected,
                    "can_intercept_multiple_incidences":overlay.intervention=="BLOCK" and len(incoming.get(held[0],()))>1 if held else False})
        assignments.append({"target_witness":witness,"primitive_word":word,"cost":witness.get("cost"),
            "provider_services":tuple(services),"cursor_access_verified_under_model":True,
            "predecessor_element_refs":tuple(sorted(predecessors)),
            "retained_source_refs":tuple(ref for ref in request.state.primed_refs if ref in predecessors),
            "alternate_source_branches":tuple((ref,tuple(outgoing.get(ref,()))) for ref in sorted(predecessors) if ref in request.state.primed_refs),
            "single_damaged_trunk_assumed":False,"provider_assignment_selected":False})
    return family_result(request,values={"alternative_interventions":tuple(assignments),"bounded_current_state_domain":domain,
        "target_predecessor_refs":tuple(sorted(predecessors)),"target_dependencies":dependencies,
        "robust_schedule_proved":False,"minimum_cost_proved":False},
        prerequisite_refs=domain.prerequisite_refs,examined_count=count,domain_complete=domain.domain_complete and not pending,
        computation_bound_reached=domain.computation_bound_reached or bool(pending),
        frontier={"pending_interventions":tuple(pending),"composition_frontier":domain.frontier} if pending or domain.frontier else {})


def _calculate_consumable_reaction_network(request: ConsumableReactionRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required_fields={
        "layers":("lattice","raw_layer_pixels","layer_templates","prior_layers"),
        "typed_edges":("state","terrain_cells","graph_models","phase_laws"),
        "control_clock":("observations","protocol_alternatives"),
        "incidence_batches":("state","incidence_frames"),
        "reaction_tick":("state","edges","phase_laws","standing_phase_ref","fallen_phase_ref"),
        "inhibition_and_relay":("state","edges","phase_laws","incidences","service_demands","overlay_pose_domains"),
        "external_transition":("state","edges","phase_laws","standing_phase_ref","fallen_phase_ref","traversable_cells","commands","command_ref","terminal_law","overlay_collision_rule"),
        "intervention_preimages":("state","edges","phase_laws","standing_phase_ref","fallen_phase_ref","traversable_cells","overlay_pose_domains","commands","required_target_refs","terminal_law","overlay_collision_rule","maximum_domain_evaluations"),
        "staged_schedule":("state","edges","phase_laws","standing_phase_ref","fallen_phase_ref","traversable_cells","commands","terminal_law","overlay_collision_rule"),
        "quiescence_restore":("actual_state","expected_state","official_failure","rejected_activation"),
    }
    missing=missing_supplied_fields(request,required_fields.get(request.operation_ref,()))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref;state=request.state
    if op=="layers":
        return _reaction_layers(request)
    if op=="control_clock":
        return _fit_control_clock(request)
    if op=="typed_edges":
        return _typed_edges(request)
    if op=="incidence_batches":
        return _incidence_batches(request)
    if op=="reaction_tick":
        after,events,missing=_tick(request,state)
        return family_result(request,values={"after":after,"events":events},prerequisite_refs=missing,
            domain_complete=not missing,examined_count=len(state.primed_refs)+len(state.pending))
    if op=="inhibition_and_relay":
        return _inhibition_service(request)
    if op=="external_transition":
        command=next((x for x in request.commands if x.command_ref==request.command_ref),None)
        if command is None:return family_result(request,prerequisite_refs=("bound_external_command",),domain_complete=False)
        after,events,missing=_external(request,state,command)
        return family_result(request,values={"after":after,"events":events,"external_command_count":1,
            "activity_remaining":bool(after.primed_refs or after.pending),
            "required_targets_present":bool(request.required_target_refs) and set(request.required_target_refs)<=set(after.acquired_target_refs),
            "execution_status":after.execution_status,"terminal_law_ref":request.terminal_law.law_ref},
            prerequisite_refs=missing,domain_complete=not missing,examined_count=len(events))
    if op=="intervention_preimages":return _intervention_preimages(request)
    if op=="staged_schedule":return _domain(request)
    if request.expected_state is None or request.actual_state is None:
        return family_result(request,prerequisite_refs=("expected_and_actual_complete_states",),domain_complete=False)
    expected,actual=request.expected_state,request.actual_state
    fields=("elements","overlays","primed_refs","pending","acquired_target_refs","control_receiver_ref",
            "tick","remaining_budget","restore_epoch","execution_status")
    changed=tuple(name for name in fields if getattr(expected,name)!=getattr(actual,name))
    return family_result(request,values={"changed_fields":changed,"first_divergence":changed[0] if changed else None,
        "restored_attempt":actual.restore_epoch!=expected.restore_epoch,"rejected_activation":request.rejected_activation,
        "official_failure":request.official_failure,"activity_remaining":bool(actual.primed_refs or actual.pending),
        "retained_target_refs":actual.acquired_target_refs,
        "restoration_mask":changed if actual.restore_epoch!=expected.restore_epoch else (),
        "expected_remaining_budget":expected.remaining_budget,"actual_remaining_budget":actual.remaining_budget,
        "budget_difference":actual.remaining_budget-expected.remaining_budget},examined_count=len(fields))


def measure_consumable_reaction_network(request: ConsumableReactionRequest) -> MechanicalFamilyResult:
    return _calculate_consumable_reaction_network(request)
