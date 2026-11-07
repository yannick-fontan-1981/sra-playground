"""Exact family return for the existing parent; no dependency satisfaction writer."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


def assemble_articulated_parent_return(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    why=request.why
    clearances=tuple(row for row in returned.reasons if "enabling_dependency_ref" in row
        and "dependent_edit_admissible" in row)
    terminal=tuple(row for row in returned.reasons if "complete_terminal_conjunction" in row)
    open_dependencies=tuple(FrozenMap({"dependency_ref":ref,
        "model_witnesses":tuple(row["witness_ref"] for row in clearances
            if row["enabling_dependency_ref"]==ref and row["dependent_edit_admissible"] is True),
        "remaining_limiting_contacts":tuple(contact for row in clearances
            if row["enabling_dependency_ref"]==ref for contact in row["remaining_limiting_contacts"]),
        "physically_satisfied":False,"observation_and_local_reconciliation_required":True})
        for ref in request.prerequisite_clearance_refs)
    packet=FrozenMap({"parent_goal_ref":why.parent_goal_ref,"consumer_ref":why.consumer_ref,
        "question_ref":why.question_ref,"next_item_ref":why.next_item_ref,
        "frozen_why":immutable_json_data(why),"exact_demand":immutable_json_data(request.demand),
        "native_return":immutable_json_data(returned.returned) if returned.returned is not None else None,
        "receipt":returned.receipt if not returned.missing_refs else FrozenMap(),
        "open_dependencies":open_dependencies,"conditional_terminal_candidates":terminal,
        "restoration_targets":tuple(target.restoration_target_ref for target in request.restorations),
        "derived_restoration_target_receipts":returned.frozen_measurement.restoration_target_receipts,
        "restoration_timelines":tuple(row for row in returned.reasons if "restoration_timeline" in row),
        "unknown_refs":request.retained_unknown_refs,"missing_refs":returned.missing_refs,
        "accounted_evaluations":returned.accounted_evaluations,
        "parent_maximum_evaluations":request.parent_maximum_evaluations,
        "route_return":immutable_json_data(returned.route_return) if returned.route_return is not None else None,
        "conditional_dependency_receipts":returned.conditional_dependency_receipts,
        "useful_prefix_receipts":returned.useful_prefix_receipts,
        "indirect_preparation_domains":tuple(row for row in returned.reasons if "admissible_intervention_domain" in row),
        "principal_goal_changed":False,"local_parent_refresh_requires_full_metaplan":False,
        "execution_authority":False,"canonical_parent_application":None})
    return returned.model_copy(update={"parent_return":packet})
