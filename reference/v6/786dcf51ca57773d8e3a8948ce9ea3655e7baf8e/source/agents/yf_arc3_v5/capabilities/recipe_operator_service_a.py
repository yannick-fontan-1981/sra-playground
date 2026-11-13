"""Caller-owned K29 calculations; no goal selection, search or action release.

Keep the four historical recipe measurements unchanged. New motion inputs are
explicit discrete supported laws on a caller-qualified lattice, not inferred
game geometry. Source remains responsible for relevance and model selection.
"""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest, immutable_json_data
from .contracts import (RecipePatternDifferenceInput, RecipeSuccessorInput,
    RecipeResizeSuccessorInput, RecipeResourceOrderInput, RecipeBodyState)
from .recipe_operator_compilation import (measure_recipe_pattern_difference,
    measure_recipe_successor, measure_recipe_resize_successor, measure_recipe_resource_order)
from .mechanical_family_contracts_a import MechanicalFamilyScope, family_result

Point = tuple[int, int]


class RecipeExampleMapping(FrozenModel):
    example_cell_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    active_example_refs: tuple[Ref, ...] = Field(max_length=64)
    example_input_pairs: tuple[tuple[Ref, Ref], ...] = Field(min_length=1, max_length=64)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def exact_mapping(self):
        if len(set(self.example_cell_refs)) != len(self.example_cell_refs):
            raise ValueError("example cell identities must be unique")
        if len(set(self.active_example_refs)) != len(self.active_example_refs) or set(self.active_example_refs) - set(self.example_cell_refs):
            raise ValueError("active example identities must belong to the supplied example lattice")
        left, right = zip(*self.example_input_pairs)
        if len(set(left)) != len(left) or len(set(right)) != len(right) or set(left) != set(self.example_cell_refs):
            raise ValueError("a supported example/input mapping must retain each lattice identity exactly once")
        return self


class RecipeCollisionRegion(FrozenModel):
    region_ref: Ref
    positions: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    remote_effect_refs: tuple[Ref, ...] = ()
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)


class RecipeProjectileLaw(FrozenModel):
    projectile_ref: Ref
    anchor: Point
    footprint_offsets: tuple[Point, ...] = Field(min_length=1, max_length=256)
    direction: Point
    motion_rule: Literal["DISCRETE_CARDINAL_ONE_CELL"]
    collision_rule: Literal["FIRST_WHOLE_MASK_CONTACT"]
    collision_regions: tuple[RecipeCollisionRegion, ...] = Field(max_length=128)
    collision_domain_complete: bool
    allowed_anchor_positions: tuple[Point, ...] | None = Field(default=None, max_length=65536)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)
    maximum_ticks: int = Field(ge=1, le=65536)
    start_tick: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def supported_law(self):
        if sum(abs(v) for v in self.direction) != 1:
            raise ValueError("the supplied discrete law needs a cardinal unit direction")
        if len(set(self.footprint_offsets)) != len(self.footprint_offsets):
            raise ValueError("projectile full-mask offsets must be unique")
        if len({r.region_ref for r in self.collision_regions}) != len(self.collision_regions):
            raise ValueError("collision identities must be unique")
        return self


class RecipeTransportModel(FrozenModel):
    model_ref: Ref
    entry_anchor: Point
    landing_anchor: Point
    required_size_ref: Ref | None = None
    resulting_heading_ref: Ref
    wall_positions: tuple[Point, ...] = Field(max_length=65536)
    substrate_positions: tuple[Point, ...] = Field(max_length=65536)
    domain_complete: bool
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)


class RecipeOperatorRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_operator_request.v1"
    kernel_ref: Literal["mechanics.recipe_operator_compilation"] = "mechanics.recipe_operator_compilation"
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ("mechanics.recipe_operator_compilation.pattern_difference", "MEASURE"),
        ("mechanics.recipe_operator_compilation.recipe_successor", "SUCCESSOR"),
        ("mechanics.recipe_operator_compilation.resize_successor", "SUCCESSOR"),
        ("mechanics.recipe_operator_compilation.projectile_successor", "SUCCESSOR"),
        ("mechanics.recipe_operator_compilation.transport_candidates", "INVERSE_DOMAIN"),
        ("mechanics.recipe_operator_compilation.resource_order", "PRECONDITION"),
        ("mechanics.recipe_operator_compilation.compose", "SUCCESSOR"),
    )
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref
    pattern: RecipePatternDifferenceInput | None = None
    example_mapping: RecipeExampleMapping | None = None
    edit: RecipeSuccessorInput | None = None
    resize: RecipeResizeSuccessorInput | None = None
    resources: RecipeResourceOrderInput | None = None
    projectile: RecipeProjectileLaw | None = None
    body: RecipeBodyState | None = None
    transport_models: tuple[RecipeTransportModel, ...] | None = Field(default=None, max_length=128)
    distinguishing_question_ref: Ref | None = None
    composition: FrozenMap | None = None
    maximum_examined: int = Field(default=4096, ge=1, le=65536)
    resume_state: FrozenMap | None = None

    @model_validator(mode="after")
    def unique_models(self):
        if self.transport_models is not None and len({m.model_ref for m in self.transport_models}) != len(self.transport_models):
            raise ValueError("supported transport model identities must be unique")
        if self.example_mapping is not None:
            if self.pattern is None:
                raise ValueError("an example mapping requires its actual current input pattern")
            mapping = dict(self.example_mapping.example_input_pairs)
            if set(mapping.values()) != set(self.pattern.lattice_refs):
                raise ValueError("the supported input mapping must match the actual input lattice")
            if {mapping[k] for k in self.example_mapping.active_example_refs} != set(self.pattern.target_active_refs):
                raise ValueError("the requested recipe must equal the mapped example, not an invented target")
        return self


class _RecipeBudget:
    def __init__(self, maximum):
        self.maximum, self.examined, self.reached = maximum, 0, False

    def take(self, count):
        if self.examined + count > self.maximum:
            self.reached = True
            return False
        self.examined += count
        return True


def recipe_projectile_progress(law, budget, resume):
    """Resume at a sealed tick; first contact retains every simultaneous effect."""
    tick = int(resume.get("next_tick", 0))
    if not 0 <= tick <= law.maximum_ticks:
        raise ValueError("projectile checkpoint tick is outside its supplied horizon")
    # Charge preparation too. A too-small quantum returns an unstarted phase.
    preparation = sum(len(r.positions) for r in law.collision_regions) + (len(law.allowed_anchor_positions) if law.allowed_anchor_positions is not None else 0)
    if not budget.take(preparation):
        return {}, (), False, {"next_tick": tick, "minimum_preparation_work": preparation}
    regions = tuple((r, set(r.positions)) for r in law.collision_regions)
    allowed = set(law.allowed_anchor_positions) if law.allowed_anchor_positions is not None else None
    while tick <= law.maximum_ticks:
        work = len(law.footprint_offsets) * (1 + len(regions))
        if not budget.take(work):
            return {}, (), False, {"next_tick": tick, "minimum_tick_work": work}
        anchor = (law.anchor[0] + tick * law.direction[0], law.anchor[1] + tick * law.direction[1])
        occupied = tuple((anchor[0] + p[0], anchor[1] + p[1]) for p in law.footprint_offsets)
        hit = tuple(r for r, cells in regions if any(p in cells for p in occupied))
        if hit:
            debt = () if law.collision_domain_complete else ("recipe.complete_projectile_collision_domain",)
            if len(hit) > 1:
                debt += ("recipe.simultaneous_impact_effect_order",)
            return {"outcome": "FIRST_IMPACT", "tick": law.start_tick + tick, "anchor": anchor,
                "occupied_positions": occupied, "impact_region_refs": tuple(r.region_ref for r in hit),
                "remote_effect_refs": tuple(dict.fromkeys(ref for r in hit for ref in r.remote_effect_refs)),
                "simultaneous_effect_order_supported": len(hit) == 1}, debt, True, {}
        if allowed is not None and anchor not in allowed:
            debt = () if law.collision_domain_complete else ("recipe.complete_projectile_collision_domain",)
            return {"outcome": "TERMINATED_AT_DECLARED_DOMAIN_BOUNDARY", "tick": law.start_tick + tick,
                "anchor": anchor, "occupied_positions": occupied}, debt, True, {}
        tick += 1
    return {"outcome": "UNFINISHED_AT_HORIZON", "last_tick": law.maximum_ticks,
        "no_impact_is_global_impossibility": False}, ("recipe.projectile_termination_or_longer_supported_horizon",), True, {}


def recipe_transport_progress(request, budget, resume):
    body = request.body
    models = request.transport_models
    index = int(resume.get("next_model_index", 0))
    rows = list(resume.get("completed_transport_candidates", ()))
    if not 0 <= index <= len(models) or len(rows) != index:
        raise ValueError("transport checkpoint must retain the exact completed model prefix")
    if tuple(r["model_ref"] for r in rows) != tuple(m.model_ref for m in models[:index]):
        raise ValueError("transport checkpoint model identities changed")
    while index < len(models):
        model = models[index]
        work = len(model.wall_positions) + len(model.substrate_positions) + 4 * len(body.occupied_positions)
        if not budget.take(work):
            return {"candidates": tuple(rows)}, (), False, {"next_model_index": index,
                "completed_transport_candidates": tuple(rows), "minimum_model_work": work}
        eligible = body.anchor_position == model.entry_anchor and (model.required_size_ref is None or body.size_ref == model.required_size_ref)
        dx, dy = model.landing_anchor[0] - body.anchor_position[0], model.landing_anchor[1] - body.anchor_position[1]
        occupied = tuple((x + dx, y + dy) for x, y in body.occupied_positions)
        walls, substrate = set(model.wall_positions), set(model.substrate_positions)
        conflicts = tuple(p for p in occupied if p in walls)
        unsupported = tuple(p for p in occupied if p not in substrate and p not in walls)
        rows.append({"model_ref": model.model_ref, "entry_preconditions_hold": eligible,
            "landing_anchor": model.landing_anchor, "occupied_positions": occupied,
            "heading_ref": model.resulting_heading_ref, "wall_conflicts": conflicts,
            "unsupported_positions": unsupported, "domain_complete": model.domain_complete,
            "compatible": eligible and not conflicts and not unsupported and model.domain_complete,
            "geometrically_compatible":eligible and not conflicts and not unsupported,
            "evidence_refs": model.evidence_refs})
        index += 1
    viable = tuple(r for r in rows if r["compatible"])
    debts = tuple("recipe.current_transport_domain." + m.model_ref for m in models if not m.domain_complete)
    if len(viable) > 1 and request.distinguishing_question_ref is None:
        debts += ("recipe.source_bound_distinguishing_transport_question",)
    return {"candidates": tuple(rows), "compatible_landings": viable,
        "distinguishing_question_ref": request.distinguishing_question_ref if len(viable) > 1 else None,
        "alternative_models_retained": tuple(m.model_ref for m in models)}, debts, True, {}


def measure_recipe_operator(request: RecipeOperatorRequest):
    if (request.operation_ref, request.mode) not in request.signature_pairs:
        return family_result(request, signature_supported=False, domain_complete=False)
    operation = request.operation_ref.rsplit(".", 1)[-1]
    required = {"pattern_difference": ("pattern",), "recipe_successor": ("edit",),
        "resize_successor": ("resize",), "resource_order": ("resources",),
        "projectile_successor": ("projectile",), "transport_candidates": ("body", "transport_models"),
        "compose": ("composition",)}
    missing = tuple("recipe." + key for key in required[operation] if getattr(request, key) is None)
    if missing:
        return family_result(request, prerequisite_refs=missing, domain_complete=False)
    definition = request.model_dump(mode="json", exclude={"resume_state", "maximum_examined"})
    definition["scope"].pop("request_ref")
    definition["scope"].pop("consumed_request_refs")
    definition["calculation_revision_ref"] = "recipe_operator.v1"
    digest = stable_digest(immutable_json_data(definition))
    resume = request.resume_state or FrozenMap()
    if resume and resume.get("input_digest") != digest:
        return family_result(request, prerequisite_refs=("recipe.current_resume_identity",), domain_complete=False)
    budget = _RecipeBudget(request.maximum_examined)
    values, debt, complete, frontier = {}, (), True, {}
    if operation == "compose":
        from .recipe_composition_a import recipe_composition_progress
        values, debt, complete, frontier = recipe_composition_progress(request, budget, resume)
    elif operation == "projectile_successor":
        values, debt, complete, frontier = recipe_projectile_progress(request.projectile, budget, resume)
    elif operation == "transport_candidates":
        values, debt, complete, frontier = recipe_transport_progress(request, budget, resume)
    else:
        item = getattr(request, required[operation][0])
        if operation == "pattern_difference":
            work = sum(len(getattr(item, key)) for key in ("lattice_refs", "current_active_refs", "target_active_refs", "supported_edit_refs"))
            if request.example_mapping is not None:
                work += len(request.example_mapping.example_cell_refs) + len(request.example_mapping.active_example_refs) + len(request.example_mapping.example_input_pairs)
            calculate = measure_recipe_pattern_difference
        elif operation == "recipe_successor":
            # Historical helper reconstructs set(active) for each lattice item.
            # Charge that nested work instead of counting one outer loop only.
            work = len(item.lattice_refs) * (len(item.current_active_refs) + 2) + 3 * len(item.current_active_refs) + len(item.target_active_refs) + len(item.world_before.values) + len(item.supplied_world_after.values)
            calculate = measure_recipe_successor
        elif operation == "resize_successor":
            work = 2 * len(item.supplied_after_body.occupied_positions) + len(item.substrate_positions) + len(item.wall_positions) + sum(len(r.positions) + len(item.supplied_after_body.occupied_positions) for r in item.resources)
            calculate = measure_recipe_resize_successor
        else:
            work = len(item.events)
            calculate = measure_recipe_resource_order
        if not budget.take(work):
            complete = False
            frontier = {"atomic_unstarted": True, "minimum_next_atomic_work": work}
        else:
            values = {"measurement": calculate(item).model_dump(mode="json")}
            if operation == "pattern_difference" and request.example_mapping is not None:
                values["measured_example_input_mapping"] = request.example_mapping.model_dump(mode="json")
    frontier.update({"input_digest": digest, "source_identity_ref": request.source_identity_ref,
        "model_revision_ref": request.scope.model_revision_ref, "evidence_revision_ref": request.scope.evidence_revision_ref,
        "epoch": request.scope.epoch, "calculation_revision_ref": "recipe_operator.v1"})
    values["actual_bounds"] = {"maximum_examined": request.maximum_examined}
    values["work_counter_metric"] = "nested_input_visits_and_whole_mask_contact_checks"
    return family_result(request, values=values, prerequisite_refs=debt, examined_count=budget.examined,
        domain_complete=complete and not debt, computation_bound_reached=budget.reached, frontier=frontier)
