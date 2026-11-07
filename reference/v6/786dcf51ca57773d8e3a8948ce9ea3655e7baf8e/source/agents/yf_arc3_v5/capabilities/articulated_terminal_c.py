"""Bounded terminal-marker comparison over the existing K24 frame measurement."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data
from .contracts import ArticulatedBodyState,ArticulatedKinematicsInput
from .articulated_solving_contracts_c import ArticulatedTerminalPreparedC,ArticulatedTerminalRowsC


def prepare_articulated_terminal(value):
    returned=value.returned
    result=returned.native_result
    rows=result.values.get("articulated_candidate_domain",()) if result is not None else ()
    missing,preparations=[],[]
    work=returned.accounted_evaluations
    if not isinstance(rows,tuple) or len(rows)>128:
        rows=();missing.append("articulated.terminal_domain_projection_bound")
    for row in rows:
        if not isinstance(row,FrozenMap) or not isinstance(row.get("after_state"),FrozenMap):
            missing.append("articulated.terminal_actual_native_after_state");continue
        bodies=row["after_state"].get("bodies",())
        try:
            geometry=ArticulatedKinematicsInput(bodies=tuple(ArticulatedBodyState.model_validate(b) for b in bodies))
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.terminal_valid_native_body_population");continue
        # K24 frame composition traverses each ancestor and every marker. Account
        # for this extra requested projection under the parent's finite budget.
        required_work=len(geometry.bodies)**2+sum(len(b.marker_offsets) for b in geometry.bodies)
        if work+required_work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:
            missing.append("articulated.terminal_measurement_budget_reached");break
        work+=required_work
        preparations.append(ArticulatedTerminalPreparedC(candidate_ref=row["candidate_ref"],
            geometry_input=geometry,complete_word_succeeded=row.get("complete_intended_word_succeeded") is True,
            after_bodies=tuple(immutable_json_data(b) for b in geometry.bodies)))
    return ArticulatedTerminalRowsC(preparations=tuple(preparations),rows=(),
        missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def append_articulated_terminal(value):
    request=value.returned.frozen_measurement.frozen_input
    prepared,measured,prior=value.prepared,value.measured,value.prior
    missing=list(prior.missing_refs)
    measured_refs=tuple(body.body_ref for body in measured.body_geometries)
    expected_refs=tuple(body.body_ref for body in prepared.geometry_input.bodies)
    if (prepared not in prior.preparations or measured.body_count!=len(prepared.geometry_input.bodies)
            or measured_refs!=expected_refs
            or any(g.local_extent!=b.local_extent for g,b in zip(measured.body_geometries,prepared.geometry_input.bodies))):
        missing.append("articulated.terminal_exact_geometry_preparation")
    markers={(body.body_ref,ref):point for body in measured.body_geometries for ref,point in body.marker_positions}
    target_rows=tuple(FrozenMap({"body_ref":target.body_ref,"marker_ref":target.marker_ref,
        "expected_position":target.world_position,"actual_position":markers.get((target.body_ref,target.marker_ref)),
        "satisfied":markers.get((target.body_ref,target.marker_ref))==target.world_position})
        for target in request.marker_targets)
    bodies={body["body_ref"]:body for body in prepared.after_bodies}
    restorations=tuple(FrozenMap({"restoration_target_ref":target.restoration_target_ref,
        "body_ref":target.body_ref,"satisfied":bodies.get(target.body_ref)==target.reference_body,
        "enabling_dependency_ref":target.enabling_dependency_ref}) for target in request.restorations)
    from .articulated_restoration_target_c import read_articulated_restoration_targets
    derived,debt=read_articulated_restoration_targets(request,value.returned.frozen_measurement.restoration_target_receipts)
    missing.extend(debt)
    restorations+=tuple(FrozenMap({"restoration_target_ref":"question.articulated.restore."+target["projection_ref"],
        "body_ref":target["body_ref"],"marker_ref":target["marker_ref"],
        "satisfied":markers.get((target["body_ref"],target["marker_ref"]))==target["world_position"],
        "enabling_dependency_ref":target["dependency_ref"]}) for target in derived)
    row=FrozenMap({"candidate_ref":prepared.candidate_ref,"marker_checks":target_rows,
        "restoration_checks":restorations,"complete_word_succeeded":prepared.complete_word_succeeded,
        "complete_terminal_conjunction":prepared.complete_word_succeeded and all(t["satisfied"] for t in target_rows)
            and all(t["satisfied"] for t in restorations),"physical_victory_observed":False,"no_action_authority":True})
    if len(prior.rows)>=128 or any(r["candidate_ref"]==prepared.candidate_ref for r in prior.rows):
        missing.append("articulated.terminal_unique_bounded_rows")
        return prior.model_copy(update={"missing_refs":tuple(sorted(set(missing)))})
    return prior.model_copy(update={"rows":(*prior.rows,row),"missing_refs":tuple(sorted(set(missing)))})


def seal_articulated_terminal(value):
    returned,terminal=value.returned,value.terminal
    missing=tuple(sorted(set((*returned.missing_refs,*terminal.missing_refs))))
    if {p.candidate_ref for p in terminal.preparations}!={r["candidate_ref"] for r in terminal.rows}:
        missing=tuple(sorted(set((*missing,"articulated.terminal_every_prepared_row_reconciled"))))
    return returned.model_copy(update={"reasons":(*returned.reasons,*terminal.rows),"missing_refs":missing,
        "accounted_evaluations":terminal.accounted_evaluations})
