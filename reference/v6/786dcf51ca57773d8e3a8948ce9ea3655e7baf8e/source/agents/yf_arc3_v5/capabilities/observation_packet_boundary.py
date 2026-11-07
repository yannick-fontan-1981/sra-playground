"""Exact raster comparisons and transport of a Source-selected support.

No interpretation of animation, contact success, target roles or route priority
is made here. Source/DRM decides whether these measurements apply.
"""
from pydantic import Field

from ..logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput


class PacketBoundaryProposal(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PacketBoundaryProposal.v1"
    request: InteractionProbeInput
    facts: FrozenMap
    boundary_changed_pixel_runs: tuple[tuple[int, int, int], ...] = ()
    evidence_refs: tuple[Ref, ...] = ()


class PacketBoundaryBinding(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PacketBoundaryBinding.v1"
    proposal: PacketBoundaryProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap = Field(default_factory=FrozenMap)


def measure_packet_boundary(request: InteractionProbeInput) -> PacketBoundaryProposal:
    frames = request.latest_ordered_action_frames
    current = request.current_observed_frame
    same_shape = bool(frames) and all(
        len(frame.rows) == len(frames[0].rows)
        and len(frame.rows[0]) == len(frames[0].rows[0]) for frame in frames
    )
    changed = []
    intermediate_count = 0
    if same_shape:
        first, last = frames[0], frames[-1]
        for row, (before, after) in enumerate(zip(first.rows, last.rows)):
            start = None
            for column in range(len(before) + 1):
                different = column < len(before) and before[column] != after[column]
                if different and start is None:
                    start = column
                elif not different and start is not None:
                    changed.append((row, start, column - 1))
                    start = None
        intermediate_count = sum(
            before != pixel for frame in frames[1:-1]
            for before_row, row in zip(first.rows, frame.rows)
            for before, pixel in zip(before_row, row)
        )
    lifecycle = request.latest_observed_packet_lifecycle
    latest_ref = lifecycle.get('transition_ref')
    receipts = tuple(row for row in request.canonical_contact_question_outcome_facts
                     if latest_ref and row.get('transition_ref') == latest_ref
                     and row.get('action_ref') == lifecycle.get('action_ref')
                     and bool(row.get('candidate_ref'))
                     and row.get('context_epoch') == lifecycle.get('context_epoch') == request.current_context_epoch)
    seals = tuple(row for row in request.canonical_packet_reconciliation_facts
                  if latest_ref and latest_ref in row.get('argument_refs', ())
                  and row.get('disposition') == 'active'
                  and row.get('epistemic_status') in ('supported', 'established')
                  and row.get('inventory_complete') is True)
    application = request.current_packet_released_observation
    binding = application.get('binding') or FrozenMap()
    physical = binding.get('physical_effect') or FrozenMap()
    previous = request.previous_action_observed_frame
    packet_digest = (stable_digest((previous.rows, tuple(frame.rows for frame in frames)))
                     if previous is not None else None)
    facts = FrozenMap({
        'packet_frame_count': len(frames),
        'packet_source_frame_count': request.latest_ordered_action_source_frame_count,
        'packet_complete': bool(frames) and len(frames) == request.latest_ordered_action_source_frame_count,
        'packet_same_shape': same_shape,
        'packet_has_intermediate_frame': len(frames) > 2,
        'packet_boundary_equal': same_shape and not changed,
        'packet_intermediate_difference_count': intermediate_count,
        'packet_last_is_current_frame': bool(frames) and current == frames[-1],
        'latest_transition_after_is_current_frame': bool(lifecycle.get('after_raw_input_ref')) and lifecycle.get('after_raw_input_ref') == lifecycle.get('current_raw_input_ref') and lifecycle.get('frame_ref') == lifecycle.get('current_frame_ref'),
        'current_packet_reconciliation_seal_count': len(seals),
        'current_packet_crossed_episode_boundary': lifecycle.get('physical_episode_boundary_crossed'),
        'current_transition_contact_receipt_count': len(receipts),
        'released_dispatch_acquisition_bound': bool(binding) and not application.get('missing_refs') and binding.get('after_frame_ref') == lifecycle.get('current_frame_ref') and binding.get('action_ref') == lifecycle.get('action_ref'),
        'released_packet_digest_matches': bool(packet_digest) and packet_digest == physical.get('observed_packet_digest'),
        'released_packet_dimensions_consistent': physical.get('packet_dimensions_consistent'),
        'released_physical_evidence_complete': bool(physical) and not binding.get('physical_effect_missing_refs'),
        'released_packet_after_raw_is_current': bool(physical.get('after_raw_input_ref')) and physical.get('after_raw_input_ref') == lifecycle.get('current_raw_input_ref'),
        'released_observation_ref': binding.get('observation_ref'),
        'released_dispatch_ref': binding.get('dispatch_ref'),
    })
    return PacketBoundaryProposal(request=request, facts=facts,
        boundary_changed_pixel_runs=tuple(changed),
        evidence_refs=tuple(str(row['claim_ref']) for row in (*receipts, *seals)))


def bind_packet_boundary(value: PacketBoundaryBinding) -> InteractionProbeInput:
    selected = value.source_alternative_facts.get(value.source_disposition_ref, FrozenMap())
    if selected.get('destination_stability_support_ref') != 'support.observed_packet_boundary':
        raise ValueError('Source has not selected the measured boundary support')
    return value.proposal.request.model_copy(update={
        'source_selected_destination_stability_runs': value.proposal.boundary_changed_pixel_runs,
        'source_selected_destination_stability_evidence_refs': value.proposal.evidence_refs,
    })
