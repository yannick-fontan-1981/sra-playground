"""Exact K28 descriptive receipt projection; only DRM assigns its meaning."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .device_solving_contracts_c import DeviceEvidenceInputC,DeviceEvidenceRowsC
from .articulated_dependency_measurement_c import _nodes
from ..drm.meaning import DeclaredMeaningInstantiation


def bind_device_evidence(value):return DeviceEvidenceInputC(returned=value.returned)


def measure_device_evidence(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    if returned.missing_refs or returned.returned is None:
        return DeviceEvidenceRowsC(missing_refs=returned.missing_refs)
    try:result=MechanicalFamilyResult.model_validate(returned.parent_return.get("calculation"))
    except (ValidationError,TypeError,ValueError):
        return DeviceEvidenceRowsC(missing_refs=("device.current_actual_K28_evidence",))
    if (returned.returned.request!=request.demand.request or result.scope!=native.scope
            or result.operation_ref!=native.operation_ref or result.mode!=native.mode
            or not result.signature_supported or not result.domain_complete or result.computation_bound_reached
            or result.prerequisite_refs or result.implementation_debt_refs):
        return DeviceEvidenceRowsC(missing_refs=("device.complete_supported_K28_evidence_domain",))
    previous=returned.parent_return.get("accounted_evaluations",0)
    remaining=request.parent_maximum_evaluations-previous
    nodes=_nodes(result.values,max(0,remaining))
    if nodes is None or 2*nodes>remaining:
        return DeviceEvidenceRowsC(missing_refs=("device.evidence_projection_parent_work_bound",))
    model=native.model
    evidence={request.demand.request.request_ref}
    for reason in returned.frozen_measurement.reasons:
        acquisition=reason.get("acquisition")
        if isinstance(acquisition,FrozenMap):evidence.update(acquisition.get("evidence_refs",()))
        if reason.get("packet_ref") is not None:evidence.add(reason["packet_ref"])
    row=FrozenMap({"projection_ref":stable_digest((request.demand,result)),"parent_goal_ref":request.why.parent_goal_ref,
        "operation_ref":native.operation_ref,"native_scope":immutable_json_data(native.scope),
        "native_result_digest":stable_digest(result),"payload":result.values,"frozen_why":immutable_json_data(request.why),
        "real_region_ref":model.real_region_ref if model is not None else None,
        "demo_region_ref":model.demo_region_ref if model is not None else None,
        "whole_operator_alternatives":immutable_json_data(model.effects) if model is not None else (),
        "whole_program":immutable_json_data(native.state.program) if native.state is not None else (),
        "typed_target":immutable_json_data(model.target) if model is not None else None,
        "phase_order":immutable_json_data(model.phase_order) if model is not None else (),
        "checkpoint_contract":immutable_json_data(model.checkpoint) if model is not None else None,
        "preservation_refs":request.why.preservation_refs,"principal_goal_changed":False,
        "evidence_current":True,"demo_is_real_progress":False,"operator_confirmed":False,
        "official_success_inferred":False,"action_authority":False,
        "evidence_refs":tuple(sorted(evidence)),"existing_term_refs":(request.why.parent_goal_ref,)})
    return DeviceEvidenceRowsC(rows=(row,),accounted_evaluations=2*nodes)


def start_device_evidence(value):return DeviceEvidenceRowsC()


def append_device_evidence(value):
    return DeviceEvidenceRowsC(rows=(*value.prior,immutable_json_data(value.meaning)))


def seal_device_evidence(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    expected={row["projection_ref"]:row for row in value.measured.rows}
    seen=set()
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("device.typed_evidence_meaning");continue
        ref=meaning.facts.get("projection_ref")
        row=expected.get(ref)
        operation=request.native_request.operation_ref.removeprefix("mechanics.finite_instruction_device.")
        if (row is None or ref in seen or meaning.rule_ref!="rule.device_evidence_c."+operation
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=val for key,val in sorted(row.items()))):
            missing.append("device.exact_current_evidence_meaning");continue
        seen.add(ref)
    if seen!=set(expected):missing.append("device.complete_owner_declared_evidence_interpretation")
    work=returned.parent_return.get("accounted_evaluations",0)+value.measured.accounted_evaluations
    if work>request.parent_maximum_evaluations:missing.append("device.evidence_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"evidence_meanings":value.meanings,
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work,"execution_authority":False})
    return returned.model_copy(update={"evidence_meanings":value.meanings,"parent_return":parent,
        "missing_refs":tuple(sorted(set(missing)))})
