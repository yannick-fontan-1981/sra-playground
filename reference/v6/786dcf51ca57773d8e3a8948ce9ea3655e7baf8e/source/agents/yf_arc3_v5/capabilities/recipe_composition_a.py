"""Bind measured K29 successors to a supplied K09 STEP domain; no second search."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, immutable_json_data, stable_digest
from .contracts import RecipeWorldState, RecipeBodyState
from .recipe_operator_service_a import RecipeOperatorRequest, measure_recipe_operator
from .mechanical_common_contracts_c import SearchDomainInputC, ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_family_contracts_a import MechanicalFamilyResult, family_result


class RecipeJointState(FrozenModel):
    recipe_active_refs: tuple[Ref, ...] = Field(max_length=64)
    world: RecipeWorldState
    body: RecipeBodyState | None = None
    resource_quantity: int | None = Field(default=None, ge=0)
    projectile_anchor: tuple[int, int] | None = None
    projectile_tick: int | None = Field(default=None, ge=0)


class RecipeDeclaredEffect(FrozenModel):
    effect_ref: Ref
    updates: tuple[tuple[Ref, Ref], ...] = Field(max_length=64)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_updates(self):
        if len({k for k, _ in self.updates}) != len(self.updates):
            raise ValueError("one supported effect cannot assign two values to one world variable")
        return self


class RecipeCompositionEdge(FrozenModel):
    question: RecipeOperatorRequest
    packet: ExternalPrimitivePacketC
    effects: tuple[RecipeDeclaredEffect, ...] = Field(default=(), max_length=128)


class RecipeCompositionInput(FrozenModel):
    query: SearchDomainInputC
    edges: tuple[RecipeCompositionEdge, ...] = Field(max_length=65536)
    serving_internal_successor: bool
    parent_goal_ref: Ref
    event_owner_ref: Ref


class RecipeCompositionExtract(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_composition_extract.v1"
    request: RecipeOperatorRequest
    measurement: MechanicalFamilyResult


class RecipeCompositionReturned(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_composition_returned.v1"
    request: RecipeOperatorRequest
    measurement: MechanicalFamilyResult
    returned: MechanicalNormalizedReturn


def _effect_world(before, effects, observed_refs):
    selected = {e.effect_ref: e for e in effects}
    if len(selected) != len(effects) or set(observed_refs) - set(selected):
        return None, ("recipe.exact_current_effect_bindings",)
    updates = {}
    values = dict(before.values)
    for ref in observed_refs:
        for variable, value in selected[ref].updates:
            if variable not in values:
                return None, ("recipe.effect_variable_current_world",)
            if variable in updates and updates[variable] != value:
                return None, ("recipe.simultaneous_effect_composition_order",)
            updates[variable] = value
    return RecipeWorldState(values=tuple((key, updates.get(key, value)) for key, value in before.values)), ()


def _expected_recipe_edge(edge, result):
    question = edge.question
    before = RecipeJointState.model_validate(edge.packet.before)
    operation = question.operation_ref.rsplit(".", 1)[-1]
    values = result.values
    if operation == "recipe_successor":
        data = question.edit
        if before.recipe_active_refs != data.current_active_refs or before.world != data.world_before:
            return None, ("recipe.current_recipe_and_world_binding",)
        measured = values["measurement"]
        return before.model_copy(update={"recipe_active_refs": tuple(measured["active_refs_after_transaction"]),
            "world": RecipeWorldState.model_validate(measured["resulting_world"])}), ()
    if operation == "resize_successor":
        data = question.resize
        if before.body != data.before_body:
            return None, ("recipe.current_resize_full_body",)
        measured = values["measurement"]
        if measured["wall_conflict_positions"] or measured["substrate_missing_positions"]:
            return None, ("recipe.resize_contact_conflict_or_unsupported_substrate",)
        world, missing = _effect_world(before.world, edge.effects, measured["contacted_resource_refs"])
        if missing:
            return None, missing
        return before.model_copy(update={"body": data.supplied_after_body, "world": world}), ()
    if operation == "resource_order":
        if before.resource_quantity != question.resources.initial_quantity:
            return None, ("recipe.current_resource_quantity",)
        measured = values["measurement"]
        if measured["first_insufficient_event_ref"] is not None:
            return None, ("recipe.ordered_resource_precondition",)
        return before.model_copy(update={"resource_quantity": measured["final_quantity"]}), ()
    if operation == "projectile_successor":
        if before.projectile_anchor != question.projectile.anchor or before.projectile_tick != question.projectile.start_tick:
            return None, ("recipe.current_emitted_projectile_anchor",)
        if values.get("outcome") not in ("FIRST_IMPACT", "TERMINATED_AT_DECLARED_DOMAIN_BOUNDARY"):
            return None, ("recipe.sealed_projectile_termination",)
        world, missing = _effect_world(before.world, edge.effects, values.get("remote_effect_refs", ()))
        if missing:
            return None, missing
        return before.model_copy(update={"world": world, "projectile_anchor": tuple(values["anchor"]),
            "projectile_tick": values["tick"]}), ()
    if operation == "transport_candidates":
        if before.body != question.body:
            return None, ("recipe.current_transport_full_body",)
        rows = tuple(r for r in values["compatible_landings"] if r["model_ref"] == edge.packet.model_ref)
        if len(rows) != 1:
            return None, ("recipe.exact_packet_transport_model",)
        row = rows[0]
        body = before.body.model_copy(update={"anchor_position": tuple(row["landing_anchor"]),
            "occupied_positions": tuple(tuple(p) for p in row["occupied_positions"]), "heading_ref": row["heading_ref"]})
        return before.model_copy(update={"body": body}), ()
    return None, ("recipe.descriptive_measurement_is_not_a_step_successor",)


def recipe_composition_progress(request, budget, resume):
    value = RecipeCompositionInput.model_validate(request.composition)
    # A K03 successor can use the pure operators, never recursively enter K09.
    if value.serving_internal_successor:
        return {}, ("recipe.external_route_question_required",), True, {}
    query, identity, scope = value.query, value.query.request, request.scope
    current = (identity.caller_ref == scope.caller_ref and identity.parent_contribution_ref == scope.parent_contribution_ref
        and identity.epoch == scope.epoch and identity.input_revision_ref == scope.evidence_revision_ref
        and identity.immutable_inputs.get("source_identity_ref") == request.source_identity_ref
        and identity.immutable_inputs.get("model_revision_ref") == scope.model_revision_ref
        and value.parent_goal_ref == scope.parent_goal_ref and value.event_owner_ref == scope.event_owner_ref)
    if not current:
        return {}, ("recipe.current_external_query_identity",), True, {}
    if tuple(e.packet for e in value.edges) != query.packets:
        return {}, ("recipe.exact_successor_packet_population",), True, {}
    if resume.get("route_query") is not None:
        continued = SearchDomainInputC.model_validate(resume["route_query"])
        excluded = {"route_checkpoint", "continuation"}
        if continued.model_dump(exclude=excluded) != query.model_dump(exclude=excluded):
            return {}, ("recipe.exact_resumed_route_definition",), True, {}
        query = continued
    index = int(resume.get("next_edge_index", 0))
    receipts = list(resume.get("sealed_edge_receipts", ()))
    if not 0 <= index <= len(value.edges) or len(receipts) != index:
        raise ValueError("recipe composition checkpoint must retain its sealed edge prefix")
    for row, edge in zip(receipts, value.edges):
        if row["edge_digest"] != stable_digest(edge):
            raise ValueError("recipe composition sealed edge identity changed")
    while index < len(value.edges):
        edge = value.edges[index]
        question, packet = edge.question, edge.packet
        if question.operation_ref == "mechanics.recipe_operator_compilation.compose":
            return {}, ("recipe.step_requires_nonrecursive_pure_operator",), True, {}
        question_scope = question.scope.model_dump(exclude={"request_ref", "consumed_request_refs"})
        parent_scope = scope.model_dump(exclude={"request_ref", "consumed_request_refs"})
        if (question.source_identity_ref != request.source_identity_ref or question_scope != parent_scope
                or packet.parent_request != identity or packet.request.input_revision_ref != identity.input_revision_ref
                or packet.request.epoch != identity.epoch or not packet.complete or packet.missing_refs
                or packet.model_ref not in query.retained_model_refs):
            return {}, ("recipe.current_complete_step_scope",), True, {}
        overhead = 1 + len(packet.before) + len(packet.after) + sum(len(e.updates) for e in edge.effects)
        for state in (packet.before, packet.after):
            overhead += len(state.get("recipe_active_refs", ()))
            overhead += len(state.get("world", {}).get("values", ()))
            overhead += len((state.get("body") or {}).get("occupied_positions", ()))
        if not budget.take(overhead):
            break
        remaining = budget.maximum - budget.examined
        if remaining < 1:
            break
        pending = resume.get("pending_edge_measurement_frontier") if index == int(resume.get("next_edge_index", -1)) else None
        measured = measure_recipe_operator(question.model_copy(update={"maximum_examined": remaining,
            "resume_state": FrozenMap(pending) if pending else None}))
        budget.examined += measured.examined_count
        if measured.computation_bound_reached:
            budget.reached = True
            return {}, (), False, {"next_edge_index": index, "sealed_edge_receipts": tuple(receipts),
                "pending_edge_measurement_frontier": measured.frontier}
        if not measured.domain_complete:
            return {}, measured.prerequisite_refs or ("recipe.complete_successor_measurement",), True, {}
        expected, missing = _expected_recipe_edge(edge, measured)
        if missing:
            return {}, missing, True, {}
        if immutable_json_data(expected.model_dump(mode="json")) != packet.after:
            return {}, ("recipe.packet_after_must_equal_measured_full_successor",), True, {}
        receipts.append({"edge_digest": stable_digest(edge), "response_ref": packet.response_ref,
            "before_digest": stable_digest(packet.before), "after_digest": stable_digest(packet.after),
            "measurement": measured.values})
        index += 1
    if index != len(value.edges):
        return {}, (), False, {"next_edge_index": index, "sealed_edge_receipts": tuple(receipts)}
    return {"query": query.model_dump(mode="json"), "sealed_edge_receipts": tuple(receipts),
        "recipe_and_world_state_keys_independent": True, "second_search_engine": False}, (), True, {}


def extract_recipe_composition_query(value: RecipeCompositionExtract) -> SearchDomainInputC:
    if value.measurement.scope != value.request.scope or not value.measurement.domain_complete:
        raise ValueError("Source must bind complete current measured successors before route search")
    return SearchDomainInputC.model_validate(value.measurement.values["query"])


def retain_recipe_composition_measurement(value: RecipeCompositionExtract) -> MechanicalFamilyResult:
    if value.measurement.scope != value.request.scope:
        raise ValueError("the retained composition measurement belongs to another caller")
    return value.measurement


def return_recipe_composition_query(value: RecipeCompositionReturned) -> MechanicalFamilyResult:
    query = extract_recipe_composition_query(RecipeCompositionExtract(request=value.request, measurement=value.measurement))
    if value.returned.request != query.request:
        return family_result(value.request, prerequisite_refs=("recipe.exact_route_query_return",), domain_complete=False)
    raw = value.returned.descriptive_values.get("measurement", {})
    checkpoint = raw.get("route_checkpoint")
    continuation = raw.get("continuation", {})
    continued_query = query.model_dump(mode="json")
    continued_query.update({"route_checkpoint": checkpoint, "continuation": continuation})
    finished = value.returned.source_status in ("FOUND", "EMPTY_DECLARED_DOMAIN")
    frontier = dict(value.measurement.frontier)
    frontier.update({"next_edge_index": len(value.measurement.values["sealed_edge_receipts"]),
        "sealed_edge_receipts": value.measurement.values["sealed_edge_receipts"], "route_query": continued_query})
    return family_result(value.request, values={"successor_receipts": value.measurement.values["sealed_edge_receipts"],
        "route_return": value.returned.model_dump(mode="json"), "actual_bounds": query.request.actual_bounds},
        examined_count=value.measurement.examined_count, domain_complete=finished,
        prerequisite_refs=() if finished else ("recipe.route_query." + value.returned.source_status,),
        computation_bound_reached=value.returned.source_status == "BUDGET_REACHED", frontier=frontier)
