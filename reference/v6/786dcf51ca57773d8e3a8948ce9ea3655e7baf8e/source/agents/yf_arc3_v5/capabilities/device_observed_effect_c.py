"""Verify declared owner effects and the actual shared publication receipt."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from ..drm.meaning import DeclaredMeaningInstantiation


def seal_device_observed_effects(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    if value.measured.returned!=returned:missing.append("device.frontier_exact_observed_parent_return")
    expected={row["projection_ref"]:row for row in value.measured.rows}
    seen=set();declared_needs={}
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("device.frontier_typed_owner_meaning");continue
        row=expected.get(meaning.facts.get("projection_ref"))
        rule="rule.device_observed_c."+(row["control_role"].lower() if row is not None and row["control_role_registered"] else "unclassified")
        if (row is None or row["projection_ref"] in seen or meaning.rule_ref!=rule
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(row.items()))):
            missing.append("device.frontier_exact_current_owner_meaning");continue
        seen.add(row["projection_ref"])
        declared_needs[row["projection_ref"]]=tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get("need_kind")=="revalidate_current_prediction_premises"
            and term.attributes.get("parent_goal_ref")==request.why.parent_goal_ref
            and term.attributes.get("frozen_why")==immutable_json_data(request.why))
    if seen!=set(expected):missing.append("device.frontier_complete_owner_interpretation")
    work=returned.parent_return.get("accounted_evaluations",0)+value.measured.accounted_evaluations
    if work>request.parent_maximum_evaluations:missing.append("device.frontier_global_parent_work_bound")
    divergences=tuple(FrozenMap({"dispatch_record_ref":row["dispatch_record_ref"],"transaction_index":row["transaction_index"],
        "different_properties":row["prediction_disagreements"],"first_specific_property":row["first_divergence_field"],
        "comparison_scope":row["comparison_scope"],"internal_first_divergence_measured":False})
        for row in value.measured.rows if row["prediction_disagreements"])
    internal=tuple(FrozenMap({"dispatch_record_ref":row["dispatch_record_ref"],"transaction_index":row["transaction_index"],
        "first_internal_divergence":row.get("first_internal_divergence")}) for row in value.measured.rows
        if row.get("first_internal_divergence") is not None)
    complete_endpoint=bool(value.measured.rows) and all(row.get("primitive_prediction_coverage_complete") is True for row in value.measured.rows)
    complete_internal=complete_endpoint and all(row.get("internal_first_divergence_measured") is True for row in value.measured.rows)
    one_interval=len({row.get("interval_packet_ref") for row in value.measured.rows})==1
    # A real contradiction invalidates the released prediction's premises,
    # not the principal goal. An incomplete forecast is an information need,
    # never a fabricated contradiction or a proved agreement.
    current_needs=[]
    for row in value.measured.rows:
        first=row.get("first_internal_divergence")
        properties=first.get("different_properties",()) if first is not None else row["prediction_disagreements"]
        if properties:
            current_needs.append(FrozenMap({"parent_goal_ref":request.why.parent_goal_ref,
                "next_item_ref":request.why.next_item_ref,"dispatch_record_ref":row["dispatch_record_ref"],
                "transaction_index":row["transaction_index"],"frozen_why":immutable_json_data(request.why),
                "evidence_refs":row["evidence_refs"],"prediction_assumption_refs":row["prediction_assumption_refs"],
                "different_properties":properties,
                "declared_causal_needs":declared_needs.get(row["projection_ref"],()),
                "unresolved_causal_explanation":not bool(declared_needs.get(row["projection_ref"],())),
                "first_internal_divergence":first,"predicted_after_state":row.get("predicted_after_state"),
                "actual_after_state":row["after_state"],"need_kind":"revalidate_current_prediction_premises",
                "principal_goal_changed":False,"continuation_admissibility":"needs_current_revalidation",
                "full_metaplan_required":False,"execution_authority":False}))
        if row.get("incomplete_prediction_prefix") is not None:
            current_needs.append(FrozenMap({"parent_goal_ref":request.why.parent_goal_ref,
                "next_item_ref":request.why.next_item_ref,"dispatch_record_ref":row["dispatch_record_ref"],
                "transaction_index":row["transaction_index"],"frozen_why":immutable_json_data(request.why),
                "evidence_refs":row["evidence_refs"],"prefix":row["incomplete_prediction_prefix"],
                "need_kind":"complete_current_prediction_evidence","contradiction_proved":False,
                "principal_goal_changed":False,"full_metaplan_required":False,"execution_authority":False}))
    parent=FrozenMap({**dict(returned.parent_return),"observed_effect_meanings":value.meanings,
        "observed_divergences":divergences,"first_observed_divergence":divergences[0] if divergences and complete_endpoint and one_interval else None,
        "first_measured_endpoint_divergence":divergences[0] if divergences else None,
        "series_endpoint_prediction_coverage_complete":complete_endpoint,
        "incomplete_prediction_prefixes":tuple(FrozenMap({"transaction_index":row["transaction_index"],
            "dispatch_record_ref":row["dispatch_record_ref"],"prefix":row["incomplete_prediction_prefix"]})
            for row in value.measured.rows if row.get("incomplete_prediction_prefix") is not None),
        "series_internal_prediction_coverage_complete":complete_internal,
        "external_command_count":sum(row["external_command_count"] for row in value.measured.rows),
        "capture_count":sum(row["capture_count"] for row in value.measured.rows),
        "first_internal_divergence":internal[0] if internal and complete_internal and one_interval else None,"internal_divergences":internal,
        "first_measured_internal_divergence":internal[0] if internal else None,
        "current_device_reconciliation_needs":tuple(current_needs),
        "parent_refresh_required":bool(current_needs),
        "validated_continuation_revalidation_required":any(need["need_kind"]=="revalidate_current_prediction_premises" for need in current_needs),
        "internal_phase_trace_rows":tuple(row for row in value.measured.rows if row.get("internal_phase_trace_measured") is True),
        "eligible_sibling_refs_preserved":request.native_request.scope.eligible_sibling_refs,
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work,
        "physical_goal_progress_inferred":False,"execution_authority":False})
    return returned.model_copy(update={"observed_effect_meanings":value.meanings,"parent_return":parent,
        "missing_refs":tuple(sorted(set(missing)))})


def join_device_owner_publication(value):
    returned,publication,published=value.returned,value.publication,value.published
    missing=list((*returned.missing_refs,*publication.missing_refs))
    applied=False
    if published is not None:
        if (published.request!=publication.publication_request or not published.canonical_payload_equal
                or published.missing_refs or publication.missing_refs):
            missing.append("device.owner_exact_applied_shared_publication_receipt")
        else:applied=True
    elif publication.facts.get("publication_bound"):
        missing.append("device.owner_shared_publication_receipt_absent")
    parent=FrozenMap({**dict(returned.parent_return),"owner_publication_request":immutable_json_data(publication.publication_request),
        "owner_publication_receipt":immutable_json_data(published) if applied else None,
        "actual_affected_dependency_claim_refs":publication.facts.get("actual_dependency_claim_refs",()),
        "canonical_effect_publication_applied":applied,"missing_refs":tuple(sorted(set(missing))),"execution_authority":False})
    needs=returned.parent_return.get("current_device_reconciliation_needs",())
    if needs and applied:
        if published.request.interpretation.get("current_device_reconciliation_needs")!=needs:
            missing.append("device.owner_exact_current_reconciliation_need_publication")
        else:
            parent=FrozenMap({**dict(parent),"canonical_current_device_needs":needs,
                "current_need_publication_revision":published.state_revision,
                "parent_continuation_disposition":"requires_local_revalidation",
                "principal_goal_changed":False,"local_parent_refresh_requires_full_metaplan":False})
    parent=FrozenMap({**dict(parent),"missing_refs":tuple(sorted(set(missing)))})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})
