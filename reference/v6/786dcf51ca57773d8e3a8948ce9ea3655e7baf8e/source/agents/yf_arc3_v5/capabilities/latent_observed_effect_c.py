"""Compare actual edits to the preserved reference domain, with no denoising."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .latent_reference_restoration import ReferenceHistory,ReferenceState
from ..drm.meaning import DeclaredMeaningInstantiation
from .latent_solving_contracts_c import LatentEvidenceRowsC
from .articulated_dependency_measurement_c import _nodes


def measure_latent_observed_effects(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    intervals=tuple(reason for reason in returned.frozen_measurement.reasons if "actual_interval_rows" in reason)
    if not request.interval_sources:return LatentEvidenceRowsC()
    if returned.frozen_measurement.missing_refs or len(intervals)!=1 or intervals[0].get("interval_missing_refs"):
        return LatentEvidenceRowsC(missing_refs=("latent.effects_current_acquired_interval",))
    interval=intervals[0]
    try:current=ReferenceState.model_validate(interval.get("actual_interval_terminal_state"))
    except (ValidationError,TypeError,ValueError):
        return LatentEvidenceRowsC(missing_refs=("latent.effects_actual_terminal_field",))
    rows=tuple(row for row in interval["actual_interval_rows"] if row["native_field_ref"]=="histories")
    if len(rows)!=1:return LatentEvidenceRowsC(missing_refs=("latent.effects_actual_published_histories",))
    try:histories=tuple(ReferenceHistory.model_validate(row) for row in rows[0]["value"])
    except (ValidationError,TypeError,ValueError):
        return LatentEvidenceRowsC(missing_refs=("latent.effects_typed_observed_history",))
    refs={}
    for reference in (*native.references,*native.established_references):
        if reference.reference_ref in refs and refs[reference.reference_ref]!=reference:
            return LatentEvidenceRowsC(missing_refs=("latent.effects_same_fixed_reference_identity",))
        refs[reference.reference_ref]=reference
    if not refs:return LatentEvidenceRowsC(missing_refs=("latent.effects_preserved_reference_domain",))
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    reference_values=tuple(refs[ref] for ref in sorted(refs))
    current_payload=immutable_json_data(current)
    nodes=_nodes((immutable_json_data(histories),immutable_json_data(reference_values),current_payload),max(0,remaining))
    if nodes is None:return LatentEvidenceRowsC(missing_refs=("latent.effects_parent_work_bound",))
    work=nodes+sum(len(history.deltas)*len(refs) for history in histories)
    appearance_nodes = _nodes(interval.get("actual_appearance_rows", ()), max(0, remaining-work))
    if appearance_nodes is None:
        return LatentEvidenceRowsC(missing_refs=("latent.effects_complete_appearance_work_bound",))
    work += 3*appearance_nodes
    if work>remaining:return LatentEvidenceRowsC(missing_refs=("latent.effects_complete_reference_join_bound",))
    fields={ref:{cell.point:cell.value_ref for cell in reference.cells} for ref,reference in sorted(refs.items())}
    positions={cell.point for cell in current.cells}
    current_values={cell.point:cell.value_ref for cell in current.cells}
    if any(reference.lattice_ref!=current.lattice_ref or reference.level_scope_ref!=current.level_scope_ref
            or reference.current_revalidation_epoch!=native.scope.epoch or set(fields[ref])!=positions
            for ref,reference in sorted(refs.items())):
        return LatentEvidenceRowsC(missing_refs=("latent.effects_reference_current_same_field",))
    result=[]
    appearance_by_event = {}
    for appearance in interval.get("actual_appearance_rows", ()):
        appearance_by_event.setdefault(appearance["event_ref"], []).append(appearance)
    appearance_complete = all(history.event_ref in appearance_by_event for history in histories)
    transient_points = []
    if appearance_complete and histories:
        traces = {}
        for history in histories:
            for appearance in appearance_by_event[history.event_ref]:
                traces.setdefault(appearance["point"], []).append(appearance)
        for point, trace in sorted(traces.items()):
            if (len(trace) == len(histories) and trace[0]["before_outline_value_ref"] is None
                    and trace[-1]["after_outline_value_ref"] is None
                    and any(row["after_outline_value_ref"] is not None for row in trace)):
                transient_points.append(point)
    reference_digest=stable_digest(reference_values)
    established=all(reference.status=="ESTABLISHED" for reference in reference_values)
    for history in histories:
        if not history.sealed or not history.all_affected_cells_observed or history.epoch!=native.scope.epoch or history.event_owner_ref!=native.scope.event_owner_ref:
            return LatentEvidenceRowsC(missing_refs=("latent.effects_owner_sealed_observation",))
        deltas=history.deltas or (None,)
        for delta in deltas:
            if delta is not None and delta.point not in positions:
                return LatentEvidenceRowsC(missing_refs=("latent.effects_delta_in_current_address_population",))
            values=tuple(sorted({field[delta.point] for _ref,field in sorted(fields.items())})) if delta is not None else ()
            if len(result)>=128:
                return LatentEvidenceRowsC(rows=tuple(result),missing_refs=("latent.effects_projection_bound",),accounted_evaluations=work,remaining_count=1)
            appearance = tuple(row for row in appearance_by_event.get(history.event_ref, ())
                if delta is None or row["appearance_changed"] or row["point"] == delta.point)
            result.append(FrozenMap({"projection_ref":stable_digest((request.demand,history.event_ref,delta)),
                "appearance_measured":history.event_ref in appearance_by_event,
                "appearance_changed":any(row["appearance_changed"] for row in appearance),
                "appearance_rows":appearance,
                "transient_outline_points":tuple(point for point in transient_points
                    if delta is None or point == delta.point),
                "appearance_interval_complete":appearance_complete,
                "parent_goal_ref":request.why.parent_goal_ref,"event_ref":history.event_ref,"input_ref":history.input_ref,
                "point":delta.point if delta is not None else None,
                "before_value_ref":delta.before_value_ref if delta is not None else None,
                "after_value_ref":delta.after_value_ref if delta is not None else None,
                "cell_changed":delta is not None,"field_delta_count":len(history.deltas),
                "reference_value_refs":values,"reference_cell_agreement":len(values)==1,
                "before_matches_all_references":bool(values) and all(delta.before_value_ref==item for item in values),
                "after_matches_all_references":bool(values) and all(delta.after_value_ref==item for item in values),
                "current_matches_all_references":bool(values) and all(current_values[delta.point]==item for item in values),
                "preserved_reference_refs":tuple(sorted(refs)),"preserved_reference_digest":reference_digest,
                "all_references_established":established,
                "actual_after_state":current_payload,"frozen_why":immutable_json_data(request.why),
                "existing_term_refs":(request.why.parent_goal_ref,),"evidence_refs":rows[0]["evidence_refs"],
                "actual_edit_observed":True,"post_edit_reference_reestimated":False,"action_authority":False}))
    return LatentEvidenceRowsC(rows=tuple(result),accounted_evaluations=work)


def seal_latent_observed_effects(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    expected={row["projection_ref"]:row for row in value.measured.rows}
    seen=set()
    restore=[]
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("latent.effects_typed_owner_meaning");continue
        ref=meaning.facts.get("projection_ref")
        row=expected.get(ref)
        if (row is None or ref in seen or not meaning.rule_ref.startswith("rule.latent_observed_effect_c.")
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=val for key,val in sorted(row.items()))):
            missing.append("latent.effects_exact_current_owner_meaning");continue
        seen.add(ref)
        for term in meaning.terms:
            operation=term.attributes.get("restoration_operation_ref")
            if operation is not None:
                restore.append((operation,term.attributes.get("restoration_mode"),row))
    if seen!=set(expected):missing.append("latent.effects_complete_interpretation")
    questions=[]
    if restore and not value.measured.missing_refs:
        operation,mode,row=restore[0]
        if any(op!=operation or m!=mode or r["actual_after_state"]!=row["actual_after_state"] for op,m,r in restore):
            missing.append("latent.effects_shared_current_restoration_question")
        else:
            state=ReferenceState.model_validate(row["actual_after_state"])
            scope=request.native_request.scope.model_copy(update={"request_ref":"request.latent.restore."+stable_digest(
                (request.demand,tuple(r["projection_ref"] for _op,_mode,r in restore),state))})
            questions.append(request.native_request.model_copy(update={"scope":scope,"operation_ref":operation,
                "mode":mode,"state":state,"actual_state":state,"expected_state":None}))
    work=returned.accounted_evaluations+value.measured.accounted_evaluations
    if work>request.parent_maximum_evaluations:missing.append("latent.effects_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"observed_effect_meanings":value.meanings,
        "restoration_questions":tuple(immutable_json_data(query) for query in questions),
        "parent_contribution_revalidation_request":request.native_request.scope.parent_contribution_ref if value.meanings else None,
        "event_owner_ref":request.native_request.scope.event_owner_ref,
        "eligible_sibling_refs_preserved":request.native_request.scope.eligible_sibling_refs,
        "missing_refs":tuple(sorted(set(missing))),"execution_authority":False,
        "supported_owner_interpretation_requires_root_reconciliation":True})
    return returned.model_copy(update={"observed_effect_meanings":value.meanings,"restoration_questions":tuple(questions),
        "accounted_evaluations":work,"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})


def join_latent_owner_publication(value):
    returned,publication=value.returned,value.publication
    published=value.published
    receipt_missing=[]
    exact_receipt=(published is not None and publication.publication_request is not None
        and published.request==publication.publication_request)
    if publication.facts.get("publication_bound") and not exact_receipt:
        receipt_missing.append("latent.owner_publication_exact_source_receipt")
    if published is not None:
        receipt_missing.extend(published.missing_refs)
        if not published.canonical_payload_equal:
            receipt_missing.append("latent.owner_publication_canonical_payload_equal")
    missing=tuple(sorted(set((*returned.missing_refs,*publication.missing_refs,*receipt_missing))))
    parent=FrozenMap({**dict(returned.parent_return),
        "owner_publication_request":immutable_json_data(publication.publication_request),
        "actual_affected_dependency_claim_refs":publication.facts.get("actual_dependency_claim_refs",()),
        "owner_publication_missing_refs":publication.missing_refs,
        "owner_publication_receipt":immutable_json_data(published),
        "missing_refs":missing,"canonical_effect_publication_applied":bool(exact_receipt
            and published.canonical_payload_equal and not published.missing_refs
            and not publication.missing_refs)})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":missing})
