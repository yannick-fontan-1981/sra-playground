"""Project exact K41 receipts; DRM decides repair, experiment and retention meaning."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from ..drm.meaning import DeclaredMeaningInstantiation
from .latent_solving_contracts_c import LatentEvidenceRowsC,LatentEvidenceInputC
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_dependency_measurement_c import _nodes


def measure_latent_evidence(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    if returned.missing_refs or returned.returned is None:
        return LatentEvidenceRowsC(missing_refs=returned.missing_refs)
    try:result=MechanicalFamilyResult.model_validate(returned.parent_return.get("calculation"))
    except (ValidationError,TypeError,ValueError):
        return LatentEvidenceRowsC(missing_refs=("latent.current_actual_K41_evidence",))
    if (result.scope!=native.scope or result.operation_ref!=native.operation_ref or result.mode!=native.mode
            or not result.signature_supported or not result.domain_complete or result.computation_bound_reached
            or result.prerequisite_refs or result.implementation_debt_refs):
        return LatentEvidenceRowsC(missing_refs=("latent.complete_supported_K41_evidence_domain",))
    data=result.values
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    nodes=_nodes(data,max(0,remaining))
    if nodes is None or 2*nodes>remaining:
        return LatentEvidenceRowsC(missing_refs=("latent.evidence_projection_parent_work_bound",))
    inputs={item.input_ref:item for item in native.state.inputs} if native.state is not None else {}
    if native.operation_ref=="repair_candidates":payloads=data.get("candidate_repairs_or_experiments",())
    elif native.operation_ref=="completion_and_revision":payloads=data.get("reference_and_official_predicates",())
    else:payloads=(data,)
    if not isinstance(payloads,tuple):return LatentEvidenceRowsC(missing_refs=("latent.typed_native_evidence_rows",))
    rows=[]
    for index,payload in enumerate(payloads[:128]):
        if not isinstance(payload,FrozenMap):return LatentEvidenceRowsC(missing_refs=("latent.typed_native_evidence_row",))
        action=None
        if native.operation_ref=="repair_candidates":
            raw=payload.get("input")
            action=inputs.get(raw.get("input_ref")) if isinstance(raw,FrozenMap) else None
            if action is None or immutable_json_data(action)!=raw:
                return LatentEvidenceRowsC(missing_refs=("latent.exact_current_evidence_input_binding",))
        reference_refs=tuple(ref.reference_ref for ref in (*native.references,*native.established_references))
        rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,index,payload)),
            "parent_goal_ref":request.why.parent_goal_ref,"operation_ref":native.operation_ref,
            "native_scope":immutable_json_data(native.scope),"native_result_digest":stable_digest(immutable_json_data(result)),
            "payload":payload,"frozen_why":immutable_json_data(request.why),"reference_refs":reference_refs,
            "preserved_established_references":tuple(immutable_json_data(ref) for ref in native.established_references),
            "reference_support_refs":tuple(sorted({ref for reference in (*native.references,*native.established_references)
                for ref in reference.supporting_evidence_refs})),
            "input_ref":action.input_ref if action is not None else None,
            "action_payload":action.payload if action is not None else FrozenMap(),
            "input_financed":action is not None and action.cost<=native.state.remaining_budget,
            "input_current":action is not None and native.state.bindings_current,
            "conditional_repair":payload.get("conditional_repair") is True,
            "robust_correction_coverage":payload.get("robust_correction_coverage") is True,
            "informative_test":payload.get("informative_test") is True,
            "identical_context_already_attempted":payload.get("identical_context_already_attempted") is True,
            "exact_reference_match":payload.get("predicate_satisfied") is True,
            "official_success":payload.get("official_success") is True,
            "wanted_field_from_correspondences":tuple(immutable_json_data(model) for model in native.homology_models),
            "intact_homologue_witnesses":tuple(immutable_json_data(witness) for witness in native.intact_witnesses),
            "correction_desired_future":FrozenMap({"point":action.point,"reference_value_alternatives":payload.get("expected_reference_values",()),
                "preserve_other_cells":payload.get("preserved_neighbors_explicit") is True}) if action is not None else None,
            "possible_local_outcomes":payload.get("outcomes",()) if action is not None else (),
            "fixed_reference_error_before":data.get("reference_error_before"),
            "fixed_reference_error_after":data.get("reference_error_after"),
            "structural_disagreement_classes":data.get("structural_disagreement_classes"),
            "structural_measurement_missing_refs":data.get("unresolved_structural_diagnostics",()),
            "external_command_count":data.get("external_command_count"),
            "indicator_contract_candidates":data.get("compatible_indicator_models",()),
            "licensed_indicator_predictions":data.get("licensed_indicator_predictions",()),
            "official_acceptance_is_independent":True,
            "evidence_current":True,"actual_reference_replaced":False,
            "evidence_refs":tuple(sorted({request.demand.request.request_ref,
                *(ref for reason in returned.frozen_measurement.reasons if "acquisition" in reason
                    for ref in reason["acquisition"].get("evidence_refs",()))})),
            "existing_term_refs":(request.why.parent_goal_ref,),"action_authority":False}))
    rest=max(0,len(payloads)-128)
    return LatentEvidenceRowsC(rows=tuple(rows),accounted_evaluations=2*nodes,
        remaining_count=rest,missing_refs=("latent.evidence_projection_bound",) if rest else ())


def start_latent_evidence(value):return LatentEvidenceRowsC()


def bind_latent_evidence(value):return LatentEvidenceInputC(returned=value.returned)


def join_latent_interval(value):
    measured,interval=value.measured,value.interval
    request=measured.frozen_input
    missing=list((*measured.missing_refs,*interval.missing_refs))
    if interval.request!=request:missing.append("latent.interval_exact_parent_publication_return")
    work=measured.acquisition_work+interval.accounted_evaluations
    if work+request.native_request.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("latent.interval_publication_reserves_native_budget")
    return measured.model_copy(update={"acquisition_work":work,"missing_refs":tuple(sorted(set(missing))),
        "facts":FrozenMap({**dict(measured.facts),"current_latent_question":not bool(missing)}),
        "reasons":(*measured.reasons,FrozenMap({"actual_interval_rows":interval.rows,
            "actual_appearance_rows":interval.appearance_rows,
            "actual_interval_terminal_state":immutable_json_data(interval.terminal_state),
            "actual_interval_work":interval.accounted_evaluations,"interval_missing_refs":interval.missing_refs}))})


def append_latent_evidence(value):
    return LatentEvidenceRowsC(rows=(*value.prior,immutable_json_data(value.meaning)))


def seal_latent_evidence(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    expected={row["projection_ref"]:row for row in value.measured.rows}
    seen=set()
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("latent.typed_evidence_meaning");continue
        ref=meaning.facts.get("projection_ref")
        row=expected.get(ref)
        if (row is None or ref in seen or not meaning.rule_ref.startswith("rule.latent_evidence_c.")
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=val for key,val in sorted(row.items()))):
            missing.append("latent.exact_current_evidence_meaning");continue
        seen.add(ref)
    if seen!=set(expected):missing.append("latent.complete_owner_declared_evidence_interpretation")
    work=returned.accounted_evaluations+value.measured.accounted_evaluations
    if work>request.parent_maximum_evaluations:missing.append("latent.evidence_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"evidence_meanings":value.meanings,
        "preserved_reference_claims":tuple(row for row in returned.frozen_measurement.reasons if "native_scope" in row),
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work,"execution_authority":False})
    return returned.model_copy(update={"evidence_meanings":value.meanings,"parent_return":parent,
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work})
