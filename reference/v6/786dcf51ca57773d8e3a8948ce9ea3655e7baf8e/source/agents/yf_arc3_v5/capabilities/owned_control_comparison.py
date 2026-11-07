"""Compare a supported current owned mask without altering raw morphology.

The exact co-translation joins observed components to an existing canonical
mask. It supplies geometric partitions and signed distances only. DRM owns
whether a peer motivates an experiment; Source retains selection and release.
"""
from .agenda_measurement_transport import append_candidate_measurements
from ..logos.types import FrozenMap


def annotate_owned_control_comparison(value, agenda):
    rows = value.canonical_provisional_control_term_facts
    boxes = value.canonical_provisional_control_geometry_bboxes
    if len(rows) != 1 or len(boxes) != 1:
        return agenda
    row, box = rows[0], boxes[0]
    claims = tuple(row.get('control_support_claim_bindings') or ())
    if (row.get('current_frame_ref') != value.current_observation_ref
            or row.get('control_support_partition_frame_ref') != value.current_observation_ref
            or row.get('control_support_unresolved_refs') or row.get('control_support_stale_term_refs')
            or not claims or any(c.get('reference_bindings_current') is not True for c in claims)):
        return agenda
    mask = frozenset(tuple(p) for p in row.get('occupied_positions', ()))
    if not mask or any(not (box.top <= r <= box.bottom and box.left <= c <= box.right) for r,c in mask):
        return agenda
    components = value.components.components
    anchors = tuple(c for c in components if c.bbox == box and frozenset(c.pixels).issubset(mask))
    if len(anchors) != 1:
        return agenda
    anchor = anchors[0]
    translations = {ref:(dr,dc) for ref,dr,dc in value.current_exact_component_translations}
    delta = translations.get(anchor.component_id)
    if delta is None or delta == (0,0):
        return agenda
    members = tuple(c for c in components if translations.get(c.component_id) == delta
        and frozenset(c.pixels).issubset(mask))
    if frozenset(p for c in members for p in c.pixels) != mask or len(members) < 2:
        return agenda
    normalized = frozenset((r-box.top,c-box.left) for r,c in mask)
    member_refs = frozenset(c.component_id for c in members)
    peers = tuple(c for c in components if c.component_id not in member_refs
        and not c.touches_frame_boundary and frozenset(c.relative_pixels) == normalized)
    same_material = tuple(c for c in peers if c.value == anchor.value)
    shared = dict(current_owned_peer_shape_only_count=len(peers),
        current_owned_peer_same_outer_material_count=len(same_material),
        current_owned_peer_comparison_unique=len(same_material) == 1,
        current_owned_peer_basis_term_ref=row.get('term_ref'),
        current_owned_peer_support_claim_refs=tuple(sorted({c['claim_ref'] for c in claims})),
        current_owned_peer_member_refs=tuple(sorted(member_refs)),
        current_owned_peer_raw_anchor_area=anchor.area, current_owned_peer_owned_area=len(mask))
    if len(same_material) != 1:
        return append_candidate_measurements(agenda,FrozenMap(),FrozenMap(shared))
    peer = same_material[0]
    dr = peer.bbox.top + peer.bbox.bottom - box.top - box.bottom
    dc = peer.bbox.left + peer.bbox.right - box.left - box.right
    shared.update(current_owned_peer_component_ref=peer.component_id,
        current_owned_peer_residual_row_twice=dr,current_owned_peer_residual_column_twice=dc)
    known = {ref:(r,c) for ref,r,c in value.known_action_translation_deltas}
    quantum = abs(delta[0]) + abs(delta[1]) if (delta[0] == 0) != (delta[1] == 0) else 0
    # A unit-interface projection is a measured geometric counterfactual, not
    # an observed motion law. The consuming DRM declares one unknown-effect
    # experiment and requires reconciliation before any further action.
    actions = {ref:(r*quantum,c*quantum) for ref,r,c in value.interface_action_translation_deltas
        if quantum and abs(r)+abs(c) == 1}
    actions.update(known)
    measured = {}
    for ref,candidate in ((c.candidate_ref,c) for c in agenda.candidates):
        shift = actions.get(candidate.action_ref)
        reduces = bool(shift is not None and candidate.point is None
            and abs(dr-2*shift[0])+abs(dc-2*shift[1]) < abs(dr)+abs(dc))
        measured[ref] = FrozenMap({**shared,'current_owned_peer_input_reduces_distance':reduces,
            'current_owned_peer_input_delta_measured':candidate.action_ref in known,
            'current_owned_peer_measured_cardinal_quantum':quantum})
    return append_candidate_measurements(agenda,FrozenMap(measured),FrozenMap(shared))
