"""Exact restoration timeline on K09 witnesses; never execute a puzzle action."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .mechanical_common_contracts_c import SearchResultC
from .articulated_dependency_receipt_c import read_articulated_dependency_receipts
from .articulated_restoration_target_c import read_articulated_restoration_targets
from .articulated_channel_kinematics import ArtiState,measure_articulated_kinematics
from .contracts import ArticulatedKinematicsInput


def measure_articulated_route_restoration(request,route,conditional_receipts=(),restoration_receipts=(),remaining_evaluations=None):
    if route is None or route.returned is None:
        return (), (("articulated.derived_restoration_requires_reconciled_route_timeline",) if restoration_receipts else ()),0
    try:search=SearchResultC.model_validate(route.returned.descriptive_values.get("measurement"))
    except (ValidationError,TypeError,ValueError):return (), ("articulated.route_typed_search_measurement",),0
    if search.request!=route.bridge.query.request:return (), ("articulated.route_restoration_exact_search_identity",),0
    if search.request.mode!="ROUTE":return (), ("articulated.restoration_requires_explicit_route_word_scope",),0
    rows,missing=[],[]
    computed,receipt_missing,work=read_articulated_dependency_receipts(request,conditional_receipts)
    missing.extend(receipt_missing)
    derived,target_debt=read_articulated_restoration_targets(request,restoration_receipts)
    missing.extend(target_debt)
    remaining=request.parent_maximum_evaluations if remaining_evaluations is None else remaining_evaluations
    effects=[immutable_json_data(effect) for effect in request.dependency_effects]
    effects.extend(computed)
    packets=route.bridge.packets
    for index,witness in enumerate(search.witnesses):
        if len(witness.word)>route.bridge.query.request.actual_bounds.get("max_primitives",0):
            missing.append("articulated.restoration_word_within_primitive_bound");continue
        initial=route.bridge.query.initial_states
        if len(initial)!=1:
            missing.append("articulated.restoration_single_exact_initial_state");continue
        current=initial[0].state
        timeline=[current]
        ordered=[]
        traversed=[]
        for primitive in witness.word:
            matches=tuple(packet for packet in packets if packet.before==current
                and packet.primitive_ref==primitive
                and (not witness.covered_response_refs or packet.response_ref in witness.covered_response_refs))
            work+=len(packets)
            if len(matches)!=1:
                missing.append("articulated.restoration_exact_word_transition");break
            packet=matches[0]
            traversed.append(packet)
            ordered.append(packet.action_ref)
            current=packet.after
            timeline.append(current)
        if len(ordered)!=len(witness.word):continue
        checks=[]
        for restoration in request.restorations:
            values=tuple(next((body for body in state.get("bodies",())
                if body.get("body_ref")==restoration.body_ref),None) for state in timeline)
            reference=restoration.reference_body
            work+=sum(len(state.get("bodies",())) for state in timeline)
            departures=tuple(i for i,value in enumerate(values) if stable_digest(value)!=stable_digest(reference))
            restored=bool(values) and stable_digest(values[-1])==stable_digest(reference)
            useful_indices=tuple(i for i,packet in enumerate(traversed)
                if any(effect["dependency_ref"]==restoration.enabling_dependency_ref
                    and effect["input_ref"]==packet.action_ref
                    and effect["before_state_digest"]==stable_digest(packet.before)
                    and effect["after_state_digest"]==stable_digest(packet.after)
                    for effect in effects))
            work+=len(traversed)*len(effects)
            final_restore=next((i for i in range(len(values)-1,-1,-1)
                if stable_digest(values[i])!=stable_digest(reference)),None)
            causal_order=(not departures or final_restore is not None and any(
                index in departures and index<=final_restore for index in useful_indices))
            if departures and not causal_order:
                missing.append("articulated.temporary_alignment_loss_requires_useful_dependency_before_restoration."+restoration.body_ref)
            checks.append(FrozenMap({"body_ref":restoration.body_ref,
                "restoration_target_ref":restoration.restoration_target_ref,
                "enabling_dependency_ref":restoration.enabling_dependency_ref,
                "departure_indices":departures,"restored_at_terminal":restored,
                "useful_dependency_transition_indices":useful_indices,
                "useful_effect_before_final_restoration":causal_order,
                "latest_restore_index":next((i for i in range(len(values)-1,-1,-1)
                    if stable_digest(values[i])==stable_digest(reference)),None),
                "temporary_alignment_loss_has_parent_dependency":restoration.enabling_dependency_ref in request.why.and_dependency_refs}))
            if not restored:missing.append("articulated.route_missing_terminal_restoration."+restoration.body_ref)
        derived_checks,derived_debt,derived_work=measure_articulated_marker_restoration_timeline(
            request,timeline,traversed,effects,derived,max(0,remaining-work))
        missing.extend(derived_debt)
        work+=derived_work
        checks.extend(derived_checks)
        rows.append(FrozenMap({"witness_index":index,"operator_word":witness.word,"ordered_input_refs":tuple(ordered),
            "restoration_timeline":tuple(checks),"final_state":current,
            "whole_word_reconciled_to_packets":True,"physical_restoration_observed":False,"action_authority":False}))
    return tuple(rows),tuple(sorted(set(missing))),work


def measure_articulated_marker_restoration_timeline(request,timeline,traversed,effects,targets,remaining):
    if not targets:return (),(),0
    n=len(request.native_request.state.bodies)
    markers=sum(len(body.marker_offsets) for body in request.native_request.state.bodies)
    required=len(timeline)*(1+n*n+markers)+len(targets)*(len(timeline)+len(traversed)*(1+len(effects)))
    if required>remaining:return (), ("articulated.marker_restoration_timeline_parent_work_bound",),0
    positions=[]
    for state in timeline:
        try:typed=ArtiState.model_validate(state)
        except (ValidationError,TypeError,ValueError):return (), ("articulated.marker_restoration_typed_timeline_state",),required
        if (len(typed.bodies)!=n or sum(len(body.marker_offsets) for body in typed.bodies)!=markers):
            return (), ("articulated.marker_restoration_timeline_population",),required
        geometry=measure_articulated_kinematics(ArticulatedKinematicsInput(bodies=typed.bodies))
        positions.append({(body.body_ref,marker):point for body in geometry.body_geometries
            for marker,point in body.marker_positions})
    rows,missing=[],[]
    for target in targets:
        satisfied=tuple(position.get((target["body_ref"],target["marker_ref"]))==target["world_position"]
            for position in positions)
        if not satisfied or not satisfied[0]:
            missing.append("articulated.marker_restoration_initial_alignment_revalidated");continue
        used=tuple(i for i,packet in enumerate(traversed) if packet.primitive_ref==target["primitive_ref"]
            and packet.action_ref==target["input_ref"] and packet.before!=packet.after)
        useful=tuple(i for i,packet in enumerate(traversed) if any(
            effect["dependency_ref"]==target["dependency_ref"] and effect["input_ref"]==packet.action_ref
            and effect["before_state_digest"]==stable_digest(packet.before)
            and effect["after_state_digest"]==stable_digest(packet.after) for effect in effects))
        excursions=[]
        start=None
        for i,aligned in enumerate(satisfied):
            if not aligned and start is None:start=i
            if aligned and start is not None:
                relevant=any(start-1<=j<i for j in used)
                useful_before_restore=any(start-1<=j<i for j in useful)
                excursions.append(FrozenMap({"departure_index":start,"restore_index":i,
                    "clearance_control_used":relevant,"useful_effect_before_restore":useful_before_restore}))
                if relevant and not useful_before_restore:
                    missing.append("articulated.marker_restoration_requires_useful_effect_before_return."+target["body_ref"])
                start=None
        if not satisfied[-1]:missing.append("articulated.route_missing_terminal_marker_restoration."+target["body_ref"])
        rows.append(FrozenMap({"restoration_target_ref":"question.articulated.restore."+target["projection_ref"],
            "body_ref":target["body_ref"],"marker_ref":target["marker_ref"],
            "enabling_dependency_ref":target["dependency_ref"],"restoration_relation":"MARKER_WORLD_POSITION",
            "initial_alignment_revalidated":satisfied[0],"restored_at_terminal":satisfied[-1],
            "clearance_transition_indices":used,"useful_dependency_transition_indices":useful,
            "excursions":tuple(excursions),"open_departure_index":start,
            "frozen_why":target["frozen_why"],"physical_restoration_observed":False,"action_authority":False}))
    return tuple(rows),tuple(sorted(set(missing))),required
