"""Exact K24 parent-question projections; no physics engine or action release."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .articulated_channel_kinematics import ARTI_OPERATION_MODES
from .articulated_solving_contracts_c import ArticulatedSolvingFactsC, ArticulatedSolvingReturnC, ArticulatedJoinFactsC
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .family_agenda_projection import FamilyAgendaReceipt
from pydantic import ValidationError
from .articulated_result_reasons_c import project_articulated_result_reasons
from .articulated_operator_scope_c import measure_articulated_operator_scopes
from .articulated_passive_blocker_c import measure_articulated_passive_blockers
from .mechanical_return_a import mechanical_request_identity_a
from .family_agenda_projection import project_family_agenda, demand_signature


def measure_articulated_solving(request, acquired):
    native, why, demand, agenda = request.native_request, request.why, request.demand, request.agenda
    missing = list(acquired["missing_refs"])
    reasons = []
    reasons.append(FrozenMap({"publication_work":acquired["publication_work"]}))
    if acquired.get("field_acquisition_receipts"):
        reasons.append(FrozenMap({"field_acquisition_receipts":acquired["field_acquisition_receipts"]}))
    reasons.extend(FrozenMap({"actual_angle_pair":row["actual_pair"],"current":row["current"]})
        for row in acquired["angle_rows"])
    for row in acquired["field_rows"]:
        if row.get("field_ref")=="observed_world_geometry":
            reasons.append(FrozenMap({"observed_world_geometry":row["value"],
                "native_geometry_comparison":row["native_comparison"],
                "physical_model_confirmed":False,"current":row["current"]}))
        elif row.get("field_ref")=="mechanical_laws":
            reasons.append(FrozenMap({"mechanical_laws":row["value"],"current":row["current"]}))
    identity = mechanical_request_identity_a(native,"mechanics.articulated_channel_kinematics",
        native.scope,native.operation_ref,native.mode)
    if (demand.request != identity or demand not in agenda.demands
            or native.scope.parent_goal_ref != why.parent_goal_ref
            or demand.parent_goal_ref != why.parent_goal_ref or demand.consumer_ref != why.consumer_ref
            or demand.episode_ref != why.episode_ref or demand.level_scope_ref != why.level_scope_ref
            or not why.usefulness_premise_refs or not why.morphology_premise_refs
            or not why.falsifier_ref or not why.desired_future):
        missing.append("articulated.exact_parent_why_and_question")
    canonical = acquired["agenda_rows"]
    if (len(canonical) != 1 or canonical[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical[0].get("supported_agenda_claim_refs")):
        missing.append("articulated.current_canonical_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("articulated.unconsumed_prerequisite_satisfied_question")
    operation = native.operation_ref.removeprefix("mechanics.articulated_channel_kinematics.")
    if native.mode not in ARTI_OPERATION_MODES.get(operation,()):
        missing.append("articulated.exact_registered_operation_mode")
    state, model = native.state, native.model
    relations = request.relations
    channel_edges = tuple((r.origin_ref,r.destination_ref) for r in relations if r.kind == "CONTROL_CHANNEL")
    attachment_edges = tuple((r.origin_ref,r.destination_ref) for r in relations if r.kind == "DIRECTED_ATTACHMENT")
    contact_edges = tuple((r.origin_ref,r.destination_ref) for r in relations if r.kind == "TEMPORARY_CONTACT")
    dependency_edges = tuple((r.origin_ref,r.destination_ref) for r in relations if r.kind == "DESIRED_DEPENDENCY")
    if state is not None:
        actual_channels = tuple((channel,b.body_ref) for b in state.bodies for channel in b.channel_refs)
        actual_attachments = tuple((b.parent_ref,b.body_ref) for b in state.bodies if b.parent_ref is not None)
        if len(set(channel_edges)) != len(channel_edges) or set(channel_edges) != set(actual_channels):
            missing.append("articulated.complete_grounded_channel_population")
        if len(set(attachment_edges)) != len(attachment_edges) or set(attachment_edges) != set(actual_attachments):
            missing.append("articulated.directed_attachment_population_not_contact")
        if model is not None and set((link.parent_ref,link.child_ref) for link in model.attachments) != set(actual_attachments):
            missing.append("articulated.model_attachment_agrees_with_local_frames")
        body_refs = {b.body_ref for b in state.bodies}
        if any(a not in body_refs or b not in body_refs for a,b in contact_edges):
            missing.append("articulated.contact_has_actual_owned_bodies")
        markers = {(b.body_ref,marker) for b in state.bodies for marker,offset in b.marker_offsets}
        if any((t.body_ref,t.marker_ref) not in markers for t in request.marker_targets):
            missing.append("articulated.goal_markers_belong_to_grounded_bodies")
    else:
        missing.append("articulated.current_local_frame_state")
    if any(a not in why.and_dependency_refs and a not in why.or_dependency_refs for a,b in dependency_edges):
        missing.append("articulated.dependency_belongs_to_parent_why")
    if not set(request.prerequisite_clearance_refs) <= set(why.and_dependency_refs):
        missing.append("articulated.clearance_enables_named_parent_dependency")
    for restoration in request.restorations:
        # A Source-selected generative route has no precomputed candidate word.
        # Its complete restoration target remains mandatory at terminal states
        # and on the actual K09 witness timeline.
        domain, route = request.transition_domain, request.route_question
        dynamic_restoration = (restoration.restoration_candidate_ref is None
            and domain is not None and bool(domain.control_laws) and not domain.templates
            and domain.base_request == native and domain.states == (state,)
            and route is not None and not route.edges and not route.query.packets
            and route.query.request.mode == "ROUTE")
        if (restoration.enabling_dependency_ref not in why.and_dependency_refs
                or restoration.restoration_target_ref not in why.preservation_refs
                or not (dynamic_restoration or any(c.candidate_ref == restoration.restoration_candidate_ref for c in native.candidates))):
            missing.append("articulated.explicit_restoration_candidate_and_parent_preservation")
    reasons.append(FrozenMap({"channel_edges":channel_edges,"attachment_edges":attachment_edges,
        "temporary_contact_edges":contact_edges,"desired_dependency_edges":dependency_edges,
        "contact_creates_attachment":False,"colour_creates_rotation_receiver":False}))
    operator_reasons,operator_missing=measure_articulated_operator_scopes(request)
    reasons.extend(operator_reasons)
    missing.extend(operator_missing)
    passive_rows,passive_missing=measure_articulated_passive_blockers(request)
    reasons.extend(passive_rows)
    missing.extend(passive_missing)
    prior_work=acquired["publication_work"]+sum(row["actual_pair"]["examined_count"] for row in acquired["angle_rows"])+sum(row["observed_world_geometry"]["examined_count"]+
        row["native_geometry_comparison"]["examined_count"] for row in reasons
        if "observed_world_geometry" in row)
    if prior_work+native.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("articulated.parent_budget_reserves_exact_native_request_before_call")
    return ArticulatedSolvingFactsC(frozen_input=request,
        facts=FrozenMap({"current_articulated_question":not bool(missing)}),
        reasons=tuple(reasons),missing_refs=tuple(sorted(set(missing))))


def bind_articulated_solving(value):
    return value.measured.frozen_input.native_request


def finish_articulated_solving(value):
    measured, returned = value.measured, value.returned
    request = measured.frozen_input
    missing = list(measured.missing_refs)
    native_result, receipt = None, FrozenMap()
    prior_work=measured.pose_question_work+measured.restoration_target_work+sum(row.get("publication_work",0) for row in measured.reasons)+sum(row["actual_angle_pair"]["examined_count"]
        for row in measured.reasons if "actual_angle_pair" in row)+sum(row["observed_world_geometry"]["examined_count"]+
        row["native_geometry_comparison"]["examined_count"] for row in measured.reasons
        if "observed_world_geometry" in row)
    if returned is not None:
        if returned.request != request.demand.request:
            missing.append("articulated.exact_return_request_identity")
        else:
            try:
                native_result = MechanicalFamilyResult.model_validate(returned.descriptive_values.get("calculation"))
            except (ValidationError,TypeError,ValueError):
                missing.append("articulated.actual_native_calculation_packet")
            if native_result is not None and (native_result.scope != request.native_request.scope
                    or native_result.operation_ref != request.native_request.operation_ref
                    or native_result.mode != request.native_request.mode):
                missing.append("articulated.return_keeps_exact_scope_operation_mode")
                native_result = None
            if not missing:
                receipt = immutable_json_data(FamilyAgendaReceipt(
                    receipt_ref="receipt.articulated_solving."+stable_digest((request.demand,returned)),
                    demand=request.demand,result=returned))
    result_reasons,reason_missing=project_articulated_result_reasons(request,native_result)
    missing.extend(reason_missing)
    return ArticulatedSolvingReturnC(frozen_measurement=measured,returned=returned,
        native_result=native_result,receipt=receipt,reasons=(*measured.reasons,*result_reasons),
        next_item_ref=request.why.next_item_ref,missing_refs=tuple(sorted(set(missing))),
        accounted_evaluations=prior_work+(native_result.examined_count if native_result is not None else 0))


def measure_articulated_join(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    join=request.join_request
    missing=[]
    if join is not None:
        native,why=request.native_request,request.why
        own=tuple(c for g in join.groups for c in g.candidates
            if c.result.request==request.demand.request)
        if (returned.returned is None or returned.returned.status!="FOUND" or returned.missing_refs
                or join.parent_goal_ref!=why.parent_goal_ref or join.epoch!=native.scope.epoch
                or join.episode_ref!=why.episode_ref or join.level_scope_ref!=why.level_scope_ref
                or len(own)!=1 or own[0].result!=returned.returned):
            missing.append("articulated.join_exact_current_native_return_and_parent")
        elif (not set(why.preservation_refs)<=set(own[0].preservation_refs)
                or own[0].rationale.get("desired_predicate")!=why.desired_future
                or own[0].rationale.get("consumer_ref")!=why.consumer_ref
                or own[0].rationale.get("and_dependency_refs")!=why.and_dependency_refs
                or own[0].rationale.get("or_dependency_refs")!=why.or_dependency_refs
                or own[0].rationale.get("falsifier_ref")!=why.falsifier_ref):
            missing.append("articulated.join_keeps_full_why_preservation_and_dependencies")
    return ArticulatedJoinFactsC(facts=FrozenMap({"join_bound":join is not None and not bool(missing)}),
        missing_refs=tuple(missing))


def get_articulated_join(value):
    return value.returned.frozen_measurement.frozen_input.join_request


def return_articulated_unjoined(value):
    return value.returned.model_copy(update={"missing_refs":tuple(sorted(set(
        (*value.returned.missing_refs,*value.measured.missing_refs))))})


def return_articulated_join(value):
    request=value.returned.frozen_measurement.frozen_input.join_request
    if value.joined.request!=request:
        return value.returned.model_copy(update={"missing_refs":tuple(sorted(set(
            (*value.returned.missing_refs,"articulated.exact_scoped_join_return"))))})
    return value.returned.model_copy(update={"family_join_request":request,"family_join_result":value.joined})
