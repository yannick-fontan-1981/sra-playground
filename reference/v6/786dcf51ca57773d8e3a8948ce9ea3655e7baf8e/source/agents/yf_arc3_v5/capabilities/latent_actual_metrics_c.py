"""Reuse K41 mathematics on the acquired terminal field, retaining separate measures."""
from fractions import Fraction
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .latent_reference_restoration import ReferenceState,_errors,_homology,_licensed,_gauge_value
from .latent_solving_contracts_c import LatentEvidenceRowsC


def measure_latent_actual_metrics(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    intervals=tuple(row for row in returned.frozen_measurement.reasons if "actual_interval_terminal_state" in row)
    if not request.interval_sources:return LatentEvidenceRowsC()
    if returned.frozen_measurement.missing_refs or len(intervals)!=1 or intervals[0].get("interval_missing_refs"):
        return LatentEvidenceRowsC(missing_refs=("latent.metrics_actual_current_interval",))
    try:state=ReferenceState.model_validate(intervals[0]["actual_interval_terminal_state"])
    except (ValidationError,TypeError,ValueError):return LatentEvidenceRowsC(missing_refs=("latent.metrics_typed_actual_field",))
    references={}
    for reference in (*native.references,*native.established_references):
        if reference.reference_ref in references and references[reference.reference_ref]!=reference:
            return LatentEvidenceRowsC(missing_refs=("latent.metrics_preserved_reference_identity",))
        references[reference.reference_ref]=reference
    if not references:return LatentEvidenceRowsC(missing_refs=("latent.metrics_preserved_reference_domain",))
    points={cell.point for cell in state.cells}
    if any(ref.lattice_ref!=state.lattice_ref or ref.level_scope_ref!=state.level_scope_ref
            or ref.current_revalidation_epoch!=native.scope.epoch
            or {cell.point for cell in ref.cells}!=points for _name,ref in sorted(references.items())):
        return LatentEvidenceRowsC(missing_refs=("latent.metrics_same_current_reference_scope",))
    field={cell.point:cell.value_ref for cell in state.cells}
    # Only histories produced by the actual sealed interval determine this count.
    actual_histories=tuple(row for row in intervals[0]["actual_interval_rows"] if row["native_field_ref"]=="histories")
    if len(actual_histories)!=1:return LatentEvidenceRowsC(missing_refs=("latent.metrics_actual_primitive_history_count",))
    command_count=len(actual_histories[0]["value"])
    terminal_frame=actual_histories[0]["frame_ref"]
    gauge_fields={binding.native_field_ref:binding for binding in request.field_bindings
        if binding.native_field_ref in ("current_gauge_min","current_gauge_max")}
    gauge_current=(set(gauge_fields)=={"current_gauge_min","current_gauge_max"}
        and all(binding.acquisition.scope.frame_ref==terminal_frame for _name,binding in sorted(gauge_fields.items())))
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    work=0
    rows=[]
    models={model.model_ref:model for model in native.homology_models}
    for ref,reference in sorted(references.items()):
        required=len(field)+len(native.gauge_models)
        if work+required>remaining:return LatentEvidenceRowsC(rows=tuple(rows),accounted_evaluations=work,
            missing_refs=("latent.metrics_complete_parent_work_bound",),remaining_count=len(references)-len(rows))
        work+=required
        errors=_errors(state,reference)
        unequal_pairs=None
        disagreement_classes=None
        singleton_positions=None
        structural_missing=[]
        model=models.get(reference.homology_model_ref)
        if model is None:structural_missing.append("current_declared_correspondence_model")
        else:
            classes,used,cut,outside=_homology(state,model,max(0,remaining-work-len(field)))
            work+=used
            if cut or outside or classes is None:structural_missing.append("complete_observed_correspondence_orbits")
            else:
                unequal_pairs=0
                bad=[]
                single=[]
                for group in classes:
                    counts={}
                    for point in group:counts[field[point]]=counts.get(field[point],0)+1
                    size=len(group)
                    unequal_pairs+=size*(size-1)//2-sum(n*(n-1)//2 for _value,n in sorted(counts.items()))
                    if len(counts)>1:bad.append(group)
                    if size==1:single.extend(group)
                disagreement_classes=tuple(bad)
                singleton_positions=tuple(single)
                work+=len(field)
        gauges=[]
        for gauge in native.gauge_models:
            licensed=_licensed(gauge,native.scope)
            in_range=gauge.licensed_error_min<=errors<=gauge.licensed_error_max
            prediction=str(_gauge_value(gauge,errors)) if licensed and in_range else None
            interval=(native.current_gauge_min,native.current_gauge_max) if gauge_current else (None,None)
            agrees=None
            if prediction is not None and all(v is not None for v in interval):
                agrees=Fraction(interval[0])<=Fraction(prediction)<=Fraction(interval[1])
            gauges.append(FrozenMap({"gauge_ref":gauge.gauge_ref,"independent_license":licensed,
                "error_count_in_licensed_domain":in_range,"observed_interval":interval,"predicted_value":prediction,
                "prediction_in_observed_interval":agrees,"lower_saturation":gauge.lower_saturation,
                "upper_saturation":gauge.upper_saturation,"unchanged_width_proves_unchanged_field":False}))
        rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,state,ref,"actual_metrics")),
            "parent_goal_ref":request.why.parent_goal_ref,"reference_ref":ref,
            "actual_field_digest":stable_digest(state),"reference_status":reference.status,
            "fixed_reference_error_count":errors,"unequal_homologous_pair_count":unequal_pairs,
            "structural_disagreement_classes":disagreement_classes,"singleton_homology_positions":singleton_positions,
            "structural_missing_refs":tuple(structural_missing),"actual_external_command_count":command_count,
            "indicator_comparisons":tuple(gauges),"official_outcome":state.official_outcome,
            "reference_match":errors==0,"official_success":state.official_outcome=="WIN",
            "frozen_why":immutable_json_data(request.why),"actual_measurement":True,"action_authority":False,
            "existing_term_refs":(request.why.parent_goal_ref,),"evidence_refs":actual_histories[0]["evidence_refs"]}))
    return LatentEvidenceRowsC(rows=tuple(rows),accounted_evaluations=work)


def seal_latent_actual_metrics(value):
    from ..drm.meaning import DeclaredMeaningInstantiation
    returned=value.returned
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    expected={row["projection_ref"]:row for row in value.measured.rows}
    seen=set()
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("latent.metrics_typed_declared_meaning");continue
        ref=meaning.facts.get("projection_ref")
        row=expected.get(ref)
        if (row is None or ref in seen or meaning.rule_ref!="rule.latent_actual_metrics_c"
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=val for key,val in sorted(row.items()))):
            missing.append("latent.metrics_exact_current_meaning");continue
        seen.add(ref)
    if seen!=set(expected):missing.append("latent.metrics_complete_interpretation")
    work=returned.accounted_evaluations+value.measured.accounted_evaluations
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:missing.append("latent.metrics_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"actual_residual_meanings":value.meanings,
        "missing_refs":tuple(sorted(set(missing))),"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work})
