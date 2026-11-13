"""Explicit JSON-like projections at mechanical transport boundaries.

Only the named DTO fields cross each boundary. No whole-context expansion,
reflection over runtime types, deep copy or implicit FrozenModel conversion.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap


def _fields(value, names):
    return {name: getattr(value, name) for name in names}


def request_identity_payload(value):
    return FrozenMap(_fields(value, ("request_ref", "kernel_ref", "operation_ref",
        "mode", "caller_ref", "parent_contribution_ref", "epoch", "input_revision_ref",
        "model_assignments", "immutable_inputs", "actual_bounds", "expected_return_type", "requested_domain_ref")))


def event_payload(value):
    return FrozenMap(_fields(value, ("occurrence_ref", "producer_ref", "kind_ref", "clock_ref", "tick",
        "temporal_scope_ref", "snapshot_ref", "snapshot_kind", "reads", "writes", "deleted_state_refs",
        "costs", "predecessor_refs", "predicate_values", "interruption_ref")))


def packet_payload(value):
    if value is None:
        return None
    return FrozenMap({**_fields(value, ("model_ref", "action_ref", "primitive_ref", "before", "after", "snapshots",
        "closure_domain_ref", "closure_stop_ref", "complete", "missing_refs", "cost", "terminal",
        "acceptance", "source_goal_acceptance_contract_ref", "response_ref", "observation_ref")),
        "request": request_identity_payload(value.request),
        "parent_request": request_identity_payload(value.parent_request),
        "events": tuple(event_payload(event) for event in value.events)})


def composition_payload(value):
    return FrozenMap({**_fields(value, ("schema_version", "state", "states", "primitive_count", "cost",
        "complete", "bounded", "contradictory", "missing_refs", "failed_predicate_refs",
        "consumed_request_delta", "interruption_ref", "packet_cursor", "facts")),
        "request": request_identity_payload(value.request),
        "events": tuple(event_payload(event) for event in value.events),
        "acceptance_observations": tuple(acceptance_observation_payload(item) for item in value.acceptance_observations)})


def witness_payload(value):
    return FrozenMap(_fields(value, ("root_action_ref", "word", "cost", "policy", "covered_response_refs")))


def route_checkpoint_payload(value):
    if value is None:
        return None
    return FrozenMap({**_fields(value, ("context_digest", "packet_digests", "best_cost_records",
        "completed_action_records", "expanded_state_records", "next_serial", "expansion_count")),
        "root_witnesses": tuple(witness_payload(witness) for witness in value.root_witnesses),
        "frontier": tuple(FrozenMap(_fields(node, ("cost", "depth", "serial", "state_key", "word", "priority",
            "root_action_ref"))) for node in value.frontier)})


def search_payload(value):
    return FrozenMap({**_fields(value, ("schema_version", "current_prefix", "complete", "bounded",
        "contradictory", "examined_count", "declared_domain_size", "missing_refs", "requested_steps",
        "continuation", "facts")), "request": request_identity_payload(value.request),
        "witnesses": tuple(witness_payload(witness) for witness in value.witnesses),
        "route_checkpoint": route_checkpoint_payload(value.route_checkpoint)})


def provider_request_payload(value):
    if value is None:
        return None
    return FrozenMap(_fields(value, ("schema_version", "request_ref", "caller_ref", "parent_contribution_ref",
        "epoch", "input_revision_ref", "event_owner_ref", "operation_ref", "mode", "expected_return_type",
        "model_ref", "state", "model", "data", "observations", "evidence_refs", "model_alternatives",
        "bounds", "requested_domain_ref")))


def provider_result_payload(value):
    if value is None:
        return None
    return FrozenMap({**_fields(value, ("schema_version", "source_status", "cause", "values",
        "examined_count", "domain_size", "domain_exhausted", "frontier", "missing_refs")),
        "request": provider_request_payload(value.request)})


def normalized_return_payload(value):
    if value is None:
        return None
    receipt = value.domain_receipt
    return FrozenMap({**_fields(value, ("schema_version", "status", "cause", "source_status",
        "descriptive_values", "retained_alternative_refs", "eligible_sibling_refs",
        "distinguishing_question_ref", "scoped_optimality_proof_ref", "consumed_request_delta",
        "retained_frontier", "proposed_environment_experiment", "proposed_reset")),
        "request": request_identity_payload(value.request), "domain_receipt":
            None if receipt is None else FrozenMap(_fields(receipt, ("domain_ref", "input_revision_ref",
                "declared_domain_size", "examined_count", "pending_count")))})


def predicate_payload(value):
    scope=value.constraint_scope
    domain=value.relation_domain
    return FrozenMap({**_fields(value, ("predicate_ref", "field_ref", "field_path", "comparison", "expected",
        "event_kind_refs", "include_initial")),
        "relation_domain":None if domain is None else FrozenMap(_fields(domain,('domain_ref','graph_kind_ref',
            'predicate_kind_ref','evidence_refs','triggering_rule_ref','epoch','evidence_revision_ref'))),
        "constraint_scope":None if scope is None else FrozenMap(_fields(scope,('subject_refs','event_domain',
            'event_kind_refs','event_occurrence_refs','temporal_scope_ref','clock_ref','valid_from_tick','valid_through_tick',
            'triggering_law_ref','evidence_refs','epoch','evidence_revision_ref')))})


def acceptance_boundary_payload(value):
    return FrozenMap({**_fields(value, ("boundary_ref", "completion_contract_ref", "request_ref",
        "event_occurrence_ref", "producer_ref", "event_kind_ref", "temporal_scope_ref",
        "snapshot_ref", "snapshot_kind", "clock_ref", "tick")),
        "predicates": tuple(predicate_payload(item) for item in value.predicates)})


def acceptance_observation_payload(value):
    return FrozenMap({**_fields(value, ("occurred", "event_index", "state_index",
        "predicate_results", "conjunction", "interruption_ref")),
        "boundary": acceptance_boundary_payload(value.boundary)})


def path_request_payload(value):
    return FrozenMap({**_fields(value, ("schema_version", "initial", "word", "consumed_request_refs", "declared_event_order")),
        "request": request_identity_payload(value.request),
        "packets": tuple(packet_payload(packet) for packet in value.packets),
        "predicates": tuple(predicate_payload(predicate) for predicate in value.predicates),
        "relation_bindings":tuple(FrozenMap({**_fields(binding,('field_ref','field_path','expected_value_digest')),
            'domain':FrozenMap(_fields(binding.domain,('domain_ref','graph_kind_ref','predicate_kind_ref',
                'evidence_refs','triggering_rule_ref','epoch','evidence_revision_ref')))}) for binding in value.relation_bindings),
        "acceptance_boundaries": tuple(acceptance_boundary_payload(item) for item in value.acceptance_boundaries)})


def path_session_payload(value):
    request = value.request
    return FrozenMap({"schema_version": value.schema_version, "cursor": value.cursor,
        "facts": value.facts, "result": composition_payload(value.result),
        "last_return": normalized_return_payload(value.last_return), "request": FrozenMap({
            "schema_version": request.schema_version, "path": path_request_payload(request.path),
            "provider_template": provider_request_payload(request.provider_template),
            "provider_kernel_ref": request.provider_kernel_ref,
            "primitives": tuple(FrozenMap(_fields(primitive, ("action_ref", "data", "cost")))
                for primitive in request.primitives)})})
