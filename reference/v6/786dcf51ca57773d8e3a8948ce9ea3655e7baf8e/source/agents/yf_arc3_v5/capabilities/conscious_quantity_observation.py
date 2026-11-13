"""Project actual, Source-bound resource endpoints, never a simulated successor.

The caller qualifies the completed Source record, frame, timeline and publication
order. This projection additionally requires the resource workflow's physical
binding and canonical publication receipts. Entity aliases are never guessed.
"""
from .acquired_resource_contracts_a import AcquiredResourceReturnA
from .conservative_quantity_identity import QuantityIdentityRequest, QuantityCompartment, QuantityTag
from agents.yf_arc3_v5.logos.types import FrozenMap


def project_conscious_quantity_participants(value, frame_ref):
    returned = AcquiredResourceReturnA.model_validate(value)
    measured = returned.measured
    request = measured.request
    if (not isinstance(request.native_request, QuantityIdentityRequest)
            or not measured.binding_current or measured.missing_refs or returned.missing_refs
            or returned.native_return is None
            or returned.native_return.request != request.demand.request
            or returned.parent_return.get('canonical_publication_applied') is not True
            or request.after_observation.expected_frame_ref != frame_ref):
        return FrozenMap()
    # These are the observed endpoints read by Source, not native_return's
    # calculation values (which may describe an unexecuted hypothetical action).
    after = measured.physical_endpoints.get('AFTER')
    if not isinstance(after, FrozenMap):
        return FrozenMap()
    raw_bodies, raw_tags = after.get('compartments'), after.get('tags')
    if (not isinstance(raw_bodies, tuple) or not 1 <= len(raw_bodies) <= 128
            or not isinstance(raw_tags, tuple) or len(raw_tags) > 128):
        return FrozenMap()
    bodies = tuple(QuantityCompartment.model_validate(row) for row in raw_bodies)
    tags = tuple(QuantityTag.model_validate(row) for row in raw_tags)
    body_refs = {row.compartment_ref for row in bodies}
    if (len(body_refs) != len(bodies) or len({row.tag_ref for row in tags}) != len(tags)
            or any(row.owner_compartment_ref not in body_refs for row in tags)):
        return FrozenMap()
    # Identity and units are part of equality; equal numbers in another material
    # or a differently named compartment do not establish preservation.
    complete_quantity_domain = (request.native_request.scope.input_domain_complete
        and body_refs == {row.compartment_ref for row in request.native_request.compartments})
    vector = tuple((row.compartment_ref, row.material_ref, row.quantity, row.units_per_quantum)
        for row in sorted(bodies, key=lambda row: row.compartment_ref)) if complete_quantity_domain else None
    return FrozenMap({row.tag_ref: FrozenMap({'marker_compartment': row.owner_compartment_ref,
        **({'material_quantity_vector': vector} if vector is not None else {})}) for row in tags})
