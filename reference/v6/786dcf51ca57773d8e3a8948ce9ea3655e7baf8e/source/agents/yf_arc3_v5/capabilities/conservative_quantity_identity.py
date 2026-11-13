"""Pure conserved-quantity arithmetic and independent identity effects for K34.

No goal selection, route search, visual role discovery or action release.
"""
from __future__ import annotations

from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, family_result
from .quantity_capacity_geometry_d import QuantityCapacityGeometryD,measure_quantity_capacity_geometry_d
from .quantity_planning_contracts_d import QuantityPlanningSpecD

Point = tuple[int, int]


class QuantitySupportSample(FrozenModel):
    quantity: int = Field(ge=0)
    surface_offset: int
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)


class QuantityCompartment(FrozenModel):
    compartment_ref: Ref
    material_ref: Ref
    envelope_positions: tuple[Point, ...] = Field(min_length=1, max_length=65536)
    envelope_evidence_refs: tuple[Ref, ...] = Field(min_length=1)
    origin: Point
    gravity: Point
    units_per_quantum: int = Field(ge=1)
    quantity: int = Field(ge=0)
    capacity: int | None = Field(default=None, ge=0)
    capacity_evidence_refs: tuple[Ref, ...] = ()
    geometric_capacity_interval: tuple[int, int | None] | None = None
    wall_reserved_units: int = Field(default=0, ge=0)
    mobile_footprint_reserved_units: int = Field(default=0, ge=0)
    support_samples: tuple[QuantitySupportSample, ...] = Field(default=(), max_length=4096)
    support_domain_complete: bool = False

    @model_validator(mode="after")
    def coherent_compartment(self):
        if len(set(self.envelope_positions)) != len(self.envelope_positions):
            raise ValueError("persistent compartment envelope positions must be unique")
        if sum(abs(v) for v in self.gravity) != 1:
            raise ValueError("gravity must be a supplied cardinal unit vector")
        if self.quantity % self.units_per_quantum:
            raise ValueError("quantity must use the supplied conserved-unit quantum")
        if self.capacity is not None and self.quantity > self.capacity:
            raise ValueError("quantity exceeds the declared hard capacity")
        if self.capacity is not None and not self.capacity_evidence_refs:
            raise ValueError("hard capacity needs current evidence")
        if len({s.quantity for s in self.support_samples}) != len(self.support_samples):
            raise ValueError("support sample quantities must be unique")
        interval = self.geometric_capacity_interval
        if interval and (interval[0] < 0 or interval[1] is not None and interval[1] < interval[0]):
            raise ValueError("invalid geometric capacity interval")
        return self


class QuantityTag(FrozenModel):
    tag_ref: Ref
    owner_compartment_ref: Ref
    local_offset: Point
    pose: Point
    footprint: tuple[Point, ...] = Field(min_length=1, max_length=4096)

    @model_validator(mode="after")
    def complete_footprint(self):
        if len(set(self.footprint)) != len(self.footprint):
            raise ValueError("full mobile footprint positions must be unique")
        return self


class QuantityTransfer(FrozenModel):
    transfer_ref: Ref
    donor_ref: Ref
    recipient_ref: Ref
    conserved_units: int = Field(ge=1)
    primitive_cost: int = Field(ge=1)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)


class QuantityDoor(FrozenModel):
    door_ref: Ref
    left_compartment_ref: Ref
    right_compartment_ref: Ref
    passage_coordinate: Point
    side_quantity_requirements: FrozenMap
    transported_tag_offsets: FrozenMap
    empty_transport_supported: bool | None = None
    multiple_transport_supported: bool | None = None
    reciprocal_exchange_supported: bool | None = None
    reciprocal_exchange_evidence_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    primitive_cost: int = Field(ge=1)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)


class QuantityExtentObservation(FrozenModel):
    compartment_ref: Ref
    normalized_extent_interval: tuple[int, int]
    readiness_overlays_excluded: bool
    hidden_quantity_interval: tuple[int, int | None]
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def ordered_intervals(self):
        low, high = self.normalized_extent_interval
        hidden_low, hidden_high = self.hidden_quantity_interval
        if high < low or hidden_low < 0 or hidden_high is not None and hidden_high < hidden_low:
            raise ValueError("extent and hidden-quantity intervals must be ordered")
        return self


class QuantityIdentityRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.quantity_identity_request.v1"
    kernel_ref: Literal["mechanics.conservative_quantity_identity"] = "mechanics.conservative_quantity_identity"
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ("mechanics.conservative_quantity_identity.fill_measurement", "MEASURE"),
        ("mechanics.conservative_quantity_identity.conservation", "MEASURE"),
        ("mechanics.conservative_quantity_identity.capacity_bounds", "MEASURE"),
        ("mechanics.conservative_quantity_identity.transfer_successor", "SUCCESSOR"),
        ("mechanics.conservative_quantity_identity.door_thresholds", "MEASURE"),
        ("mechanics.conservative_quantity_identity.door_successor", "SUCCESSOR"),
        ("mechanics.conservative_quantity_identity.reconfiguration_domains", "INVERSE_DOMAIN"),
        ("mechanics.conservative_quantity_identity.resource_conflict", "PRECONDITION"),
        ("mechanics.conservative_quantity_identity.cost_bounds", "MEASURE"),
        ("mechanics.conservative_quantity_identity.route_domains", "INVERSE_DOMAIN"),
    )
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref
    compartments: tuple[QuantityCompartment, ...] = Field(min_length=1, max_length=128)
    tags: tuple[QuantityTag, ...] = Field(default=(), max_length=128)
    transfers: tuple[QuantityTransfer, ...] = Field(default=(), max_length=512)
    doors: tuple[QuantityDoor, ...] = Field(default=(), max_length=128)
    observations: tuple[QuantityExtentObservation, ...] | None = Field(default=None, max_length=128)
    requested_transfer_ref: Ref | None = None
    requested_door_ref: Ref | None = None
    transported_tag_refs: tuple[Ref, ...] | None = Field(default=None, max_length=128)
    target_intervals: FrozenMap | None = None
    maintained_intervals: FrozenMap | None = None
    remaining_door_refs: tuple[Ref, ...] | None = None
    supplied_cuts: tuple[tuple[Ref, ...], ...] = Field(default=(), max_length=128)
    capacity_layouts: tuple[QuantityCapacityGeometryD,...] | None = Field(default=None,max_length=128)
    planning: QuantityPlanningSpecD | None = None
    maximum_examined: int = Field(default=4096, ge=1, le=65536)
    maximum_results: int = Field(default=128, ge=1, le=4096)
    resume_state: FrozenMap | None = None

    @model_validator(mode="after")
    def bound_graphs(self):
        refs = {c.compartment_ref for c in self.compartments}
        if len(refs) != len(self.compartments):
            raise ValueError("compartment identities must be unique")
        for rows, field in ((self.tags, "tag_ref"), (self.transfers, "transfer_ref"), (self.doors, "door_ref")):
            if len({getattr(row, field) for row in rows}) != len(rows):
                raise ValueError("operation and tag identities must be unique")
        if any(t.owner_compartment_ref not in refs for t in self.tags):
            raise ValueError("tag owner is not a current compartment")
        by_ref = {c.compartment_ref: c for c in self.compartments}
        for transfer in self.transfers:
            if transfer.donor_ref not in refs or transfer.recipient_ref not in refs or transfer.donor_ref == transfer.recipient_ref:
                raise ValueError("transfer endpoints must be distinct current compartments")
            if by_ref[transfer.donor_ref].material_ref != by_ref[transfer.recipient_ref].material_ref:
                raise ValueError("a transfer cannot silently change conserved material")
            if any(transfer.conserved_units % by_ref[ref].units_per_quantum for ref in (transfer.donor_ref, transfer.recipient_ref)):
                raise ValueError("transfer quantum is incompatible with a compartment")
        for door in self.doors:
            if door.left_compartment_ref not in refs or door.right_compartment_ref not in refs:
                raise ValueError("door endpoints must be current compartments")
        return self


class _QuantityBudget:
    def __init__(self, maximum):
        self.maximum, self.examined, self.reached = maximum, 0, False

    def take(self, count=1):
        if count > self.maximum - self.examined:
            self.reached = True
            return False
        self.examined += count
        return True


def quantity_components(request):
    """Weak material components are conservation domains, never route proofs."""
    adjacency = {c.compartment_ref: set() for c in request.compartments}
    for edge in request.transfers:
        adjacency[edge.donor_ref].add(edge.recipient_ref)
        adjacency[edge.recipient_ref].add(edge.donor_ref)
    unseen, components = set(adjacency), []
    while unseen:
        first = min(unseen)
        pending, component = deque([first]), set()
        unseen.remove(first)
        while pending:
            ref = pending.popleft()
            component.add(ref)
            for neighbor in sorted(adjacency[ref]):
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    pending.append(neighbor)
        components.append(tuple(sorted(component)))
    return tuple(components)


def quantity_tag_pose(compartment, quantity, offset, support_offsets=None):
    if support_offsets is None:
        support_offsets = {s.quantity: s.surface_offset for s in compartment.support_samples}
    surface = support_offsets.get(quantity)
    if surface is None:
        return None
    return tuple(compartment.origin[i] - compartment.gravity[i] * surface + offset[i] for i in range(2))


def quantity_transfer_successor(request):
    edge = next((e for e in request.transfers if e.transfer_ref == request.requested_transfer_ref), None)
    if edge is None:
        return {}, ("quantity_identity.supported_requested_transfer",)
    by_ref = {c.compartment_ref: c for c in request.compartments}
    donor, recipient = by_ref[edge.donor_ref], by_ref[edge.recipient_ref]
    supports = {c.compartment_ref: {s.quantity: s.surface_offset for s in c.support_samples} for c in (donor, recipient)}
    if recipient.capacity is None:
        return {}, ("quantity_identity.recipient_hard_capacity",)
    accepted = donor.quantity >= edge.conserved_units and recipient.quantity + edge.conserved_units <= recipient.capacity
    quantities = {c.compartment_ref: c.quantity for c in request.compartments}
    if accepted:
        quantities[donor.compartment_ref] -= edge.conserved_units
        quantities[recipient.compartment_ref] += edge.conserved_units
    tags, missing = [], []
    for tag in request.tags:
        pose = tag.pose
        if accepted and tag.owner_compartment_ref in (donor.compartment_ref, recipient.compartment_ref):
            before_pose = quantity_tag_pose(by_ref[tag.owner_compartment_ref], by_ref[tag.owner_compartment_ref].quantity, tag.local_offset, supports[tag.owner_compartment_ref])
            if before_pose != tag.pose:
                missing.append("quantity_identity.current_tag_support_binding." + tag.tag_ref)
                continue
            pose = quantity_tag_pose(by_ref[tag.owner_compartment_ref], quantities[tag.owner_compartment_ref], tag.local_offset, supports[tag.owner_compartment_ref])
            if pose is None:
                missing.append("quantity_identity.current_tag_support_projection." + tag.tag_ref)
                continue
        tags.append({"tag_ref": tag.tag_ref, "owner_compartment_ref": tag.owner_compartment_ref,
                     "local_offset": tag.local_offset, "pose": pose, "footprint": tag.footprint})
    return {"quantities_after": quantities, "tags_after": tuple(tags), "accepted": accepted,
            "tag_owners_changed": False, "primitive_cost": edge.primitive_cost}, tuple(missing)


def quantity_fill_measurement(request, observations=None):
    by_ref = {c.compartment_ref: c for c in request.compartments}
    rows, missing = [], []
    for observed in request.observations if observations is None else observations:
        compartment = by_ref.get(observed.compartment_ref)
        if compartment is None or not observed.readiness_overlays_excluded:
            missing.append("quantity_identity.current_non_overlay_extent." + observed.compartment_ref)
            continue
        low, high = observed.normalized_extent_interval
        candidates = tuple(sorted(sample.quantity for sample in compartment.support_samples if low <= sample.surface_offset <= high))
        if not candidates or not compartment.support_domain_complete:
            missing.append("quantity_identity.complete_extent_projection." + observed.compartment_ref)
        hidden_low, hidden_high = observed.hidden_quantity_interval
        lower = min(candidates) + hidden_low if candidates else hidden_low
        upper = max(candidates) + hidden_high if candidates and hidden_high is not None and compartment.support_domain_complete else None
        if compartment.capacity is not None:
            upper = min(upper, compartment.capacity) if upper is not None else compartment.capacity
        if upper is not None and lower > upper:
            missing.append("quantity_identity.extent_capacity_contradiction." + observed.compartment_ref)
        rows.append({"compartment_ref": observed.compartment_ref, "quantity_interval": (lower, upper),
                     "supported_visible_candidates": candidates, "hidden_quantity_interval": observed.hidden_quantity_interval,
                     "pixel_area_is_conserved_quantity": False, "evidence_refs": observed.evidence_refs})
    return {"fill_measurements": tuple(rows)}, tuple(missing)


def quantity_door_thresholds(request):
    door = next((d for d in request.doors if d.door_ref == request.requested_door_ref), None)
    if door is None:
        return {}, ("quantity_identity.supported_requested_door",)
    by_ref = {c.compartment_ref: c for c in request.compartments}
    rows, missing = [], []
    for ref in (door.left_compartment_ref, door.right_compartment_ref):
        compartment = by_ref[ref]
        local_coordinate = sum((door.passage_coordinate[i] - compartment.origin[i]) * -compartment.gravity[i] for i in range(2))
        supplied = door.side_quantity_requirements.get(ref)
        if type(supplied) is not int or supplied < 0 or supplied % compartment.units_per_quantum:
            missing.append("quantity_identity.current_door_quantity_projection." + ref)
            continue
        samples = tuple(s for s in compartment.support_samples if s.surface_offset == local_coordinate)
        if not any(s.quantity == supplied for s in samples):
            missing.append("quantity_identity.evidenced_door_support_coordinate." + ref)
        rows.append({"compartment_ref": ref, "local_passage_coordinate": local_coordinate,
                     "required_quantity": supplied, "residual": supplied - compartment.quantity,
                     "ready": compartment.quantity == supplied})
    return {"door_ref": door.door_ref, "side_residuals": tuple(rows)}, tuple(missing)


def quantity_door_successor(request):
    thresholds, missing = quantity_door_thresholds(request)
    if missing:
        return thresholds, missing
    door = next(d for d in request.doors if d.door_ref == request.requested_door_ref)
    by_ref = {c.compartment_ref: c for c in request.compartments}
    supports = {ref: {s.quantity: s.surface_offset for s in by_ref[ref].support_samples}
                for ref in (door.left_compartment_ref, door.right_compartment_ref)}
    requested = request.transported_tag_refs
    if requested is None or len(set(requested)) != len(requested):
        return thresholds, ("quantity_identity.explicit_unique_transport_population",)
    if not requested and door.empty_transport_supported is not True:
        return thresholds, ("quantity_identity.empty_door_transport_policy",)
    if len(requested) > 1 and door.multiple_transport_supported is not True:
        return thresholds, ("quantity_identity.multiple_door_transport_policy",)
    tags = {t.tag_ref: t for t in request.tags}
    if any(ref not in tags for ref in requested):
        return thresholds, ("quantity_identity.current_transported_tag_identity",)
    requested_owners={tags[ref].owner_compartment_ref for ref in requested}
    reciprocal=(door.left_compartment_ref in requested_owners and door.right_compartment_ref in requested_owners)
    if reciprocal and (door.reciprocal_exchange_supported is not True or not door.reciprocal_exchange_evidence_refs):
        return thresholds, ("quantity_identity.observed_same_pre_state_reciprocal_exchange",)
    accepted = all(row["ready"] for row in thresholds["side_residuals"])
    after, debt = [], []
    for tag in request.tags:
        owner, offset, pose = tag.owner_compartment_ref, tag.local_offset, tag.pose
        if accepted and tag.tag_ref in requested:
            if owner not in (door.left_compartment_ref, door.right_compartment_ref):
                debt.append("quantity_identity.tag_at_door_side." + tag.tag_ref)
                continue
            if quantity_tag_pose(by_ref[owner], by_ref[owner].quantity, offset, supports[owner]) != pose:
                debt.append("quantity_identity.current_tag_support_binding." + tag.tag_ref)
                continue
            owner = door.right_compartment_ref if owner == door.left_compartment_ref else door.left_compartment_ref
            offset = door.transported_tag_offsets.get(tag.tag_ref)
            if not isinstance(offset, (tuple, list)) or len(offset) != 2 or any(type(v) is not int for v in offset):
                debt.append("quantity_identity.supplied_transport_attachment." + tag.tag_ref)
                continue
            offset = tuple(offset)
            pose = quantity_tag_pose(by_ref[owner], by_ref[owner].quantity, offset, supports[owner])
            if pose is None:
                debt.append("quantity_identity.destination_tag_support." + tag.tag_ref)
                continue
        after.append({"tag_ref": tag.tag_ref, "owner_compartment_ref": owner, "local_offset": offset,
                      "pose": pose, "footprint": tag.footprint})
    return {**thresholds, "accepted": accepted, "tags_after": tuple(after),
            "quantities_after": {c.compartment_ref: c.quantity for c in request.compartments},
            "primitive_cost": door.primitive_cost, "material_quantity_changed": False,
            "reciprocal_exchange_requested":reciprocal,"all_identity_updates_use_same_pre_state":True}, tuple(debt)


def quantity_allocation_domains(request, budget, resume):
    intervals, debt = [], []
    for compartment in request.compartments:
        if compartment.capacity is None:
            debt.append("quantity_identity.bounded_hard_capacity." + compartment.compartment_ref)
            continue
        interval = request.target_intervals.get(compartment.compartment_ref, (0, compartment.capacity))
        if not isinstance(interval, (tuple, list)) or len(interval) != 2 or any(type(v) is not int for v in interval):
            debt.append("quantity_identity.current_target_interval." + compartment.compartment_ref)
            continue
        low, high = max(0, interval[0]), min(compartment.capacity, interval[1])
        quantum = compartment.units_per_quantum
        first = ((low + quantum - 1) // quantum) * quantum
        count = max(0, (high - first) // quantum + 1)
        intervals.append((first, quantum, count))
    if debt:
        return {}, tuple(debt), False, {}
    unknown_refs = set(request.target_intervals) - {c.compartment_ref for c in request.compartments}
    if unknown_refs:
        return {}, ("quantity_identity.bound_target_compartments",), False, {}
    total = 1
    for _, _, count in intervals:
        total *= count
    rank = int(resume.get("next_allocation_rank", 0))
    if not 0 <= rank <= total:
        raise ValueError("allocation continuation rank is outside its current domain")
    components = quantity_components(request)
    by_ref = {c.compartment_ref: c for c in request.compartments}
    totals = tuple(sum(by_ref[ref].quantity for ref in component) for component in components)
    rows = list(resume.get("allocations", ()))
    while rank < total and len(rows) < request.maximum_results:
        if not budget.take(len(intervals) + len(request.compartments)):
            break
        cursor, quantities = rank, []
        for first, step, count in reversed(intervals):
            cursor, index = divmod(cursor, count)
            quantities.append(first + step * index)
        vector = dict(zip((c.compartment_ref for c in request.compartments), reversed(quantities)))
        if all(sum(vector[ref] for ref in component) == target for component, target in zip(components, totals)):
            rows.append(vector)
        rank += 1
    frontier = {"next_allocation_rank": rank, "allocation_domain_size": total, "allocations": tuple(rows),
                "maximum_results_reached": rank < total and len(rows) >= request.maximum_results}
    return {"quantity_allocations": tuple(rows), "capacity_feasible_ordering_proven": False}, (), rank == total, frontier


def quantity_resource_conflicts(request, door_refs=None, include_targets=True):
    by_ref = {c.compartment_ref: c for c in request.compartments}
    components = quantity_components(request)
    component_by_ref = {ref: component for component in components for ref in component}
    doors = {d.door_ref: d for d in request.doors}
    certificates, debt = [], []
    if set(request.maintained_intervals) - set(by_ref):
        return {}, ("quantity_identity.current_maintained_compartments",)
    for ref, interval in sorted(request.maintained_intervals.items()):
        if not isinstance(interval, (tuple, list)) or len(interval) != 2 or any(type(v) is not int for v in interval) or interval[0] < 0 or interval[1] < interval[0]:
            debt.append("quantity_identity.maintained_quantity_interval." + ref)
    if debt:
        return {}, tuple(debt)
    if include_targets and request.target_intervals is not None:
        requirements=dict(request.maintained_intervals)
        if set(request.target_intervals)-set(by_ref):
            return {}, ('quantity_identity.current_remaining_target_compartments',)
        for ref,interval in sorted(request.target_intervals.items()):
            if (not isinstance(interval,(tuple,list)) or len(interval)!=2
                    or any(type(value) is not int for value in interval) or not 0<=interval[0]<=interval[1]):
                debt.append('quantity_identity.current_remaining_target_interval.'+ref);continue
            low,high=requirements.get(ref,(0,by_ref[ref].capacity))
            intersection=(max(low,interval[0]),min(high,interval[1]) if high is not None else interval[1])
            if intersection[0]>intersection[1]:
                certificates.append({'target_compartment_ref':ref,'compartment_ref':ref,
                    'cause':'maintained_interval_excludes_terminal_quantity',
                    'target_interval':interval,'maintained_interval':(low,high)})
            requirements[ref]=intersection
        if not debt:
            for component in components:
                conserved=sum(by_ref[ref].quantity for ref in component)
                minimum=sum(requirements.get(ref,(0,None))[0] for ref in component)
                uppers=tuple(requirements.get(ref,(0,by_ref[ref].capacity))[1] for ref in component)
                maximum=sum(uppers) if all(value is not None for value in uppers) else None
                if minimum>conserved or maximum is not None and maximum<conserved:
                    certificates.append({'target_compartment_refs':tuple(ref for ref in component if ref in request.target_intervals),
                        'component_refs':component,'cause':'terminal_component_interval_excludes_conserved_total',
                        'required_lower_total':minimum,'required_upper_total':maximum,'conserved_total':conserved})
    for door_ref in request.remaining_door_refs if door_refs is None else door_refs:
        door = doors.get(door_ref)
        if door is None:
            debt.append("quantity_identity.remaining_declared_door." + door_ref)
            continue
        requirements = dict(request.maintained_intervals)
        for ref in (door.left_compartment_ref, door.right_compartment_ref):
            quantity = door.side_quantity_requirements.get(ref)
            if type(quantity) is not int or quantity < 0:
                debt.append("quantity_identity.current_remaining_door_threshold." + ref)
                continue
            low, high = requirements.get(ref, (0, by_ref[ref].capacity))
            if quantity < low or high is not None and quantity > high:
                certificates.append({"door_ref": door_ref, "compartment_ref": ref,
                    "cause": "maintained_interval_excludes_door_quantity", "required_quantity": quantity,
                    "maintained_interval": (low, high)})
            requirements[ref] = (quantity, quantity)
        for component in components:
            conserved = sum(by_ref[ref].quantity for ref in component)
            minimum = sum(requirements.get(ref, (0, None))[0] for ref in component)
            if minimum > conserved:
                certificates.append({"door_ref": door_ref, "component_refs": component,
                    "cause": "simultaneously_required_component_quantity_exceeds_conserved_total",
                    "required_lower_total": minimum, "conserved_total": conserved})
        # Different remaining doors are alternatives in time, not a simultaneous sum.
    return {"resource_conflict_certificates": tuple(certificates), "future_doors_summed_together": False,
            "absence_of_certificate_proves_route": False}, tuple(dict.fromkeys(debt))


def quantity_cost_bounds(request, budget, resume):
    by_ref = {c.compartment_ref: c for c in request.compartments}
    if set(request.target_intervals) - set(by_ref):
        return {}, ("quantity_identity.current_cost_target_compartments",), False, {}
    targets = {}
    for ref, interval in sorted(request.target_intervals.items()):
        if not isinstance(interval, (tuple, list)) or len(interval) != 2 or type(interval[0]) is not int or interval[0] < 0 or interval[1] is not None and (type(interval[1]) is not int or interval[1] < interval[0]):
            return {}, ("quantity_identity.current_cost_target_interval." + ref,), False, {}
        targets[ref] = tuple(interval)
    cuts = tuple(dict.fromkeys(quantity_components(request) + tuple(tuple(sorted(set(cut))) for cut in request.supplied_cuts)))
    rows, debt = list(resume.get("cut_bounds", ())), list(resume.get("cut_debts", ()))
    cut_index = int(resume.get("next_cut_index", 0))
    if not 0 <= cut_index <= len(cuts):
        raise ValueError("cut continuation index is outside its current domain")
    while cut_index < len(cuts):
        cut = cuts[cut_index]
        if not budget.take(len(cut) + 2 * len(request.transfers)):
            break
        cut_index += 1
        if not cut or any(ref not in by_ref for ref in cut):
            debt.append("quantity_identity.current_material_cut")
            continue
        inside = set(cut)
        current = sum(by_ref[ref].quantity for ref in cut)
        lower = sum(targets.get(ref, (0, None))[0] for ref in cut)
        uppers = tuple(targets.get(ref, (0, None))[1] for ref in cut)
        upper = sum(uppers) if all(v is not None for v in uppers) else None
        inflow, outflow = max(0, lower - current), max(0, current - upper) if upper is not None else 0
        crossing = tuple(e for e in request.transfers if (e.donor_ref not in inside and e.recipient_ref in inside and inflow)
                         or (e.donor_ref in inside and e.recipient_ref not in inside and outflow))
        required = max(inflow, outflow)
        if required and not crossing:
            rows.append({"cut_refs": cut, "required_net_units": required, "crossing_domain_empty": True,
                         "lower_primitive_count": None, "lower_primitive_cost": None})
            continue
        largest_quantum = max((e.conserved_units for e in crossing), default=1)
        minimum_cost = min((e.primitive_cost for e in crossing), default=0)
        primitive_count = (required + largest_quantum - 1) // largest_quantum
        rows.append({"cut_refs": cut, "required_net_units": required, "crossing_domain_empty": False,
                     "lower_primitive_count": primitive_count, "lower_primitive_cost": primitive_count * minimum_cost,
                     "crossing_transfer_refs": tuple(e.transfer_ref for e in crossing)})
    rates = tuple({"transfer_ref": e.transfer_ref, "cost_numerator": e.primitive_cost,
                   "conserved_unit_denominator": e.conserved_units} for e in request.transfers)
    return {"material_cut_bounds": tuple(rows), "unit_transfer_costs": rates,
            "combined_cost_lower_bound": max((row["lower_primitive_cost"] or 0 for row in rows), default=0),
            "capacity_feasible_ordering_proven": False, "overlapping_cut_bounds_summed": False}, tuple(debt), cut_index == len(cuts), {
                "next_cut_index": cut_index, "cut_bounds": tuple(rows), "cut_debts": tuple(debt)}


def measure_quantity_identity(request: QuantityIdentityRequest):
    if (request.operation_ref, request.mode) not in request.signature_pairs:
        return family_result(request, signature_supported=False, domain_complete=False)
    operation = request.operation_ref.rsplit(".", 1)[-1]
    required = {"fill_measurement": ("observations",), "conservation": (), "capacity_bounds": (),
        "transfer_successor": ("requested_transfer_ref",), "door_thresholds": ("requested_door_ref",),
        "door_successor": ("requested_door_ref", "transported_tag_refs"),
        "reconfiguration_domains": ("target_intervals",), "resource_conflict": ("maintained_intervals", "remaining_door_refs"),
        "cost_bounds": ("target_intervals",),"route_domains":("planning",)}
    missing = tuple("quantity_identity." + name for name in required[operation] if getattr(request, name) is None)
    if missing:
        return family_result(request, prerequisite_refs=missing, domain_complete=False)
    definition = request.model_dump(mode="json", exclude={"resume_state", "maximum_examined", "maximum_results"})
    definition["scope"].pop("request_ref")
    definition["scope"].pop("consumed_request_refs")
    definition["calculation_revision_ref"] = "quantity_identity.v2" if operation=='resource_conflict' else "quantity_identity.v1"
    digest = stable_digest(immutable_json_data(definition))
    resume = request.resume_state or FrozenMap()
    if resume and resume.get("input_digest") != digest:
        return family_result(request, prerequisite_refs=("quantity_identity.current_resume_identity",), domain_complete=False)
    budget = _QuantityBudget(request.maximum_examined)
    values, debt, complete, frontier = {}, (), True, {}
    if operation == "route_domains":
        from .quantity_planning_d import measure_quantity_route_d
        values,debt,complete,frontier=measure_quantity_route_d(request,budget)
    elif operation == "reconfiguration_domains":
        values, debt, complete, frontier = quantity_allocation_domains(request, budget, resume)
    elif operation == "cost_bounds":
        values, debt, complete, frontier = quantity_cost_bounds(request, budget, resume)
    elif operation in ("fill_measurement", "resource_conflict"):
        items = request.observations if operation == "fill_measurement" else (
            (*request.remaining_door_refs,None) if request.target_intervals is not None else request.remaining_door_refs)
        item_index = int(resume.get("next_item_index", 0))
        if not 0 <= item_index <= len(items):
            raise ValueError("quantity continuation index is outside its current input population")
        rows, debts = list(resume.get("item_results", ())), list(resume.get("item_debts", ()))
        by_ref = {c.compartment_ref: c for c in request.compartments}
        while item_index < len(items):
            item = items[item_index]
            work = len(request.compartments) + 2 * len(request.transfers) + len(request.tags)
            if operation == "fill_measurement":
                compartment = by_ref.get(item.compartment_ref)
                work += len(compartment.support_samples) if compartment else 0
            else:
                work += len(request.maintained_intervals) + len(request.compartments)*5+len(request.doors)
                work += len(request.target_intervals or {})*4
            if not budget.take(work):
                break
            value, missing = quantity_fill_measurement(request, (item,)) if operation == "fill_measurement" else (
                quantity_resource_conflicts(request,(),include_targets=True) if item is None
                else quantity_resource_conflicts(request,(item,),include_targets=False))
            rows.append(value)
            debts.extend(missing)
            item_index += 1
        values = {"item_results": tuple(rows)}
        debt, complete = tuple(dict.fromkeys(debts)), item_index == len(items)
        frontier = {"next_item_index": item_index, "item_results": tuple(rows), "item_debts": debt}
        if operation=='resource_conflict' and complete and not debt and request.planning is not None:
            if request.planning.preserved_intervals!=request.maintained_intervals:
                debt=('quantity_identity.route_uses_exact_proposed_preservation',);complete=False
            else:
                from .quantity_planning_d import measure_quantity_route_d
                route_values,route_debt,route_complete,_=measure_quantity_route_d(request,budget)
                values['preserved_remaining_conjunction']=route_values
                values['preserved_remaining_conjunction_complete']=route_complete
                if route_complete and not route_debt and not route_values.get('route_witnesses'):
                    values['item_results']=(*values['item_results'],{'resource_conflict_certificates':({
                        'cause':'exhausted_preserved_state_domain_has_no_complete_conjunction',
                        'maintained_intervals':request.maintained_intervals,
                        'target_intervals':request.target_intervals},)})
                debt=route_debt;complete=route_complete
    else:
        base_work = len(request.compartments) + 2 * len(request.transfers) + len(request.tags)
        relevant_refs = {c.compartment_ref for c in request.compartments}
        if operation == "transfer_successor":
            edge = next((e for e in request.transfers if e.transfer_ref == request.requested_transfer_ref), None)
            relevant_refs = {edge.donor_ref, edge.recipient_ref} if edge else set()
        elif operation in ("door_thresholds", "door_successor"):
            door = next((d for d in request.doors if d.door_ref == request.requested_door_ref), None)
            relevant_refs = {door.left_compartment_ref, door.right_compartment_ref} if door else set()
        support_work = sum(len(c.support_samples) for c in request.compartments if c.compartment_ref in relevant_refs) if operation in ("fill_measurement", "door_thresholds", "door_successor", "transfer_successor") else 0
        work = base_work + support_work
        if not budget.take(work):
            complete = False
            frontier = {"atomic_unstarted": True, "minimum_next_atomic_work": work}
        elif operation == "conservation":
            by_ref = {c.compartment_ref: c for c in request.compartments}
            values = {"component_totals": tuple({"compartment_refs": group,
                "conserved_total": sum(by_ref[ref].quantity for ref in group)} for group in quantity_components(request)),
                "tag_owners": tuple((t.tag_ref, t.owner_compartment_ref) for t in request.tags),
                "weak_component_proves_directed_route": False}
        elif operation == "capacity_bounds":
            derived,debt,complete=measure_quantity_capacity_geometry_d(request,budget)
            values = {**derived,"capacity_bounds": tuple({"compartment_ref": c.compartment_ref,
                "geometric_interval": c.geometric_capacity_interval,
                "geometry_after_reserved_footprint": tuple(max(0, v - c.wall_reserved_units - c.mobile_footprint_reserved_units) if v is not None else None for v in c.geometric_capacity_interval) if c.geometric_capacity_interval else None,
                "measured_hard_capacity": c.capacity, "capacity_evidence_refs": c.capacity_evidence_refs}
                for c in request.compartments)}
        elif operation == "transfer_successor":
            values, debt = quantity_transfer_successor(request)
        elif operation == "door_thresholds":
            values, debt = quantity_door_thresholds(request)
        elif operation == "door_successor":
            values, debt = quantity_door_successor(request)
    frontier.update({"input_digest": digest, "source_identity_ref": request.source_identity_ref,
        "model_revision_ref": request.scope.model_revision_ref, "evidence_revision_ref": request.scope.evidence_revision_ref,
        "epoch": request.scope.epoch, "calculation_revision_ref": "quantity_identity.v1"})
    values["actual_bounds"] = {"maximum_examined": request.maximum_examined, "maximum_results": request.maximum_results}
    values["work_counter_metric"] = "precharged_nested_input_visits_and_allocation_checks"
    return family_result(request, values=values, prerequisite_refs=debt, examined_count=budget.examined,
        domain_complete=complete and not debt, computation_bound_reached=budget.reached or bool(frontier.get("maximum_results_reached")),
        frontier=frontier)
