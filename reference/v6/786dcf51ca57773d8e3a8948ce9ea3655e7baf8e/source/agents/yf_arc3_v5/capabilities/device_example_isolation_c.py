"""Join exact Source-declared isolation meanings; never manufacture evidence."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from agents.yf_arc3_v5.drm.meaning import DeclaredMeaningInstantiation
from .device_solving_contracts_c import DeviceEvidenceRowsC


def start_device_example_isolation(value):return DeviceEvidenceRowsC()


def join_device_example_isolation(value):
    measured=value.measured;missing=list(measured.missing_refs);reasons=[]
    expected={row["packet_ref"]:row for row in measured.reasons if row.get("isolation_candidate") is True}
    if len(expected)!=len(measured.facts.get("isolation_rows",())):
        missing.append("device.isolation_unique_actual_example_identity")
    seen=set();accepted={}
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):missing.append("device.isolation_typed_declared_meaning");continue
        ref=meaning.facts.get("packet_ref");row=expected.get(ref)
        if (row is None or ref in seen or meaning.rule_ref!="rule.device_example_isolation_c"
                or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(row.items()))
                or not row["isolation_candidate"]):
            missing.append("device.isolation_exact_current_declared_meaning");continue
        seen.add(ref);accepted[ref]=immutable_json_data(meaning)
    if seen!=set(expected):missing.append("device.isolation_complete_declared_example_population")
    for row in measured.reasons:
        if "isolation_candidate" in row:
            row=FrozenMap({**dict(row),"isolated_operator_example":row["packet_ref"] in accepted,
                "isolation_meaning":accepted.get(row["packet_ref"])})
        reasons.append(row)
    return measured.model_copy(update={"reasons":tuple(reasons),"missing_refs":tuple(sorted(set(missing))),
        "facts":FrozenMap({**dict(measured.facts),"current_device_question":not bool(missing)})})
