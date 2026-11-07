"""Form bounded information questions from acquired controls and reference alternatives."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .latent_reference_restoration import ReferenceField,_attempted
from .latent_solving_contracts_c import LatentEvidenceRowsC
from .articulated_dependency_measurement_c import _nodes


def measure_latent_first_probes(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    state=native.state
    if native.edit_laws or state is None:return LatentEvidenceRowsC()
    if returned.frozen_measurement.missing_refs:return LatentEvidenceRowsC(missing_refs=returned.frozen_measurement.missing_refs)
    candidates=returned.parent_return.get("calculation",FrozenMap())
    data=candidates.get("values",FrozenMap()) if isinstance(candidates,FrozenMap) else FrozenMap()
    raw=data.get("reference_candidates",data.get("retained_fixed_references",()))
    try:computed=tuple(ReferenceField.model_validate(row) for row in raw)
    except (ValidationError,TypeError,ValueError):return LatentEvidenceRowsC(missing_refs=("latent.first_test_typed_reference_domain",))
    refs={}
    for reference in (*native.references,*native.established_references,*computed):
        if reference.reference_ref in refs and refs[reference.reference_ref]!=reference:
            return LatentEvidenceRowsC(missing_refs=("latent.first_test_preserved_reference_identity",))
        refs[reference.reference_ref]=reference
    if not refs:return LatentEvidenceRowsC(missing_refs=("latent.first_test_reference_correspondence_domain",))
    field={cell.point:cell.value_ref for cell in state.cells}
    if any(ref.level_scope_ref!=state.level_scope_ref or ref.lattice_ref!=state.lattice_ref
            or {cell.point for cell in ref.cells}!=set(field) for _name,ref in sorted(refs.items())):
        return LatentEvidenceRowsC(missing_refs=("latent.first_test_current_reference_field_scope",))
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    nodes=_nodes((immutable_json_data(state),immutable_json_data(tuple(refs[name] for name in sorted(refs)))),max(0,remaining))
    work=(nodes or 0)+2*len(field)*len(refs)+len(state.inputs)*(len(refs)+len(native.attempted_inputs))
    if nodes is None or work>remaining:return LatentEvidenceRowsC(missing_refs=("latent.first_test_parent_work_bound",))
    reference_fields=tuple({cell.point:cell.value_ref for cell in ref.cells} for _name,ref in sorted(refs.items()))
    expected={point:tuple(sorted({values[point] for values in reference_fields})) for point in sorted(field)}
    rows=[]
    for action in state.inputs:
        values=expected.get(action.point,())
        if not values or field.get(action.point) in values or _attempted(native,state,action):continue
        if len(rows)>=128:
            return LatentEvidenceRowsC(rows=tuple(rows),accounted_evaluations=work,remaining_count=1,
                missing_refs=("latent.first_test_projection_bound",))
        rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,state,action,values)),
            "parent_goal_ref":request.why.parent_goal_ref,"point":action.point,"input_ref":action.input_ref,
            "action_ref":action.action_ref,"payload":action.payload,"primitive_bound":1,"command_cost":action.cost,
            "current_input_bound":state.bindings_current and bool(action.payload),"primitive_financed":action.cost<=state.remaining_budget,
            "reference_value_alternatives":values,"observed_value_ref":field[action.point],
            "reference_refs":tuple(sorted(refs)),"frozen_why":immutable_json_data(request.why),
            "preservation_refs":request.why.preservation_refs,"falsifier_ref":request.why.falsifier_ref,
            "observation_contract":FrozenMap({"full_field_before_and_after":True,"retain_same_reference":True,
                "separate_indicators_and_overlays":True,"observe_actual_dispatch":True}),
            "possible_observed_outcomes":("UNCHANGED_FIELD","TARGET_LOCAL_CHANGE","OTHER_LOCAL_CHANGE",
                "COUPLED_FIELD_CHANGE","UNMODELLED_STATE_OR_DOMAIN_CHANGE"),
            "edit_law_known":False,"particularity_is_proved_error":False,
            "effect_scope_known":False,"recovery_cost_known":False,"action_authority":False,
            "existing_term_refs":(request.why.parent_goal_ref,),"evidence_refs":tuple(sorted({request.demand.request.request_ref,
                *(ref for reason in returned.frozen_measurement.reasons if "acquisition" in reason for ref in reason["acquisition"].get("evidence_refs",()))}))}))
    return LatentEvidenceRowsC(rows=tuple(rows),accounted_evaluations=work)


def seal_latent_first_probes(value):
    returned=value.returned
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    expected={row["projection_ref"]:row for row in value.measured.rows}
    from ..drm.meaning import DeclaredMeaningInstantiation
    seen=set()
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("latent.first_test_typed_declared_question");continue
        ref=meaning.facts.get("projection_ref")
        row=expected.get(ref)
        if (row is None or ref in seen or meaning.rule_ref!="rule.latent_first_probe_c"
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=val for key,val in sorted(row.items()))):
            missing.append("latent.first_test_exact_current_question");continue
        seen.add(ref)
    if seen!=set(expected):missing.append("latent.first_test_complete_declared_questions")
    missing=tuple(sorted(set(missing)))
    parent=FrozenMap({**dict(returned.parent_return),"initial_particularity_questions":value.meanings,
        "missing_refs":missing,"unknown_edit_law_retained":True,"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":missing,
        "accounted_evaluations":returned.accounted_evaluations+value.measured.accounted_evaluations})
