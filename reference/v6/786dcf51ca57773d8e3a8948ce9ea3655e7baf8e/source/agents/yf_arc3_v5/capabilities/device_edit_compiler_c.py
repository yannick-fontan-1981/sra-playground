"""Preserve the exact Source-declared compiled edit proposal; no ACT."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def finish_device_edit_compiler(value):
    measured=value.measured;returned=measured.returned;missing=list((*returned.missing_refs,*measured.missing_refs))
    meaning=value.meaning
    if meaning is not None:
        if (meaning.rule_ref!="rule.device_edit_compiler_c" or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(measured.facts.items()))):
            missing.append("device.compiler_exact_current_declared_edit_meaning");meaning=None
    elif measured.facts.get("compiler_bound") or measured.facts.get("edit_domain_bound"):missing.append("device.compiler_declared_edit_meaning_absent")
    work=returned.parent_return.get("accounted_evaluations",0)+measured.accounted_evaluations
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:missing.append("device.compiler_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"compiled_edit_groups":immutable_json_data(measured.groups),
        "compiled_edit_meaning":immutable_json_data(meaning),"compiled_edits_complete":meaning is not None and measured.facts.get("compiler_bound") is True and not bool(missing),
        "compiled_edit_alternative_domains":measured.facts.get("edit_alternative_domains",()),
        "compiled_edit_domain_complete":meaning is not None and measured.facts.get("edit_domain_bound") is True and not bool(missing),
        "minimum_command_selection_required":measured.facts.get("minimum_command_selection_required",False),
        "missing_refs":tuple(sorted(set(missing))),"accounted_evaluations":work,"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})
