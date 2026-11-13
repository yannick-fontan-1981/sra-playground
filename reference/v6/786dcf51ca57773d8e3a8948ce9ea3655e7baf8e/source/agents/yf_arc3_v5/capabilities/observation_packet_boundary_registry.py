"""Registration of pure packet comparisons and Source-selected transport."""
from .observation_packet_boundary import (
    PacketBoundaryProposal, PacketBoundaryBinding,
    measure_packet_boundary, bind_packet_boundary,
)
from .contracts import InteractionProbeInput

PACKET_BOUNDARY_TYPES = ('InteractionProbeInput', 'PacketBoundaryProposal', 'PacketBoundaryBinding')


def packet_boundary_entries(factory):
    return tuple(factory(capability_id=ref, implementation=method,
        input_model=before, output_model=after,
        source_file='observation_packet_boundary.py',
        applicability=('immutable_acquired_rasters_and_canonical_receipt_projection',),
        invariants=('exact_comparisons_only', 'source_selects_support',
                    'original_animation_retained', 'no_hidden_world_stability_claim'),
        falsifiers=('incomplete_packet', 'different_boundary', 'receipt_not_current'))
        for ref, method, before, after in (
            ('capability.observation_packet_boundary', measure_packet_boundary,
             InteractionProbeInput, PacketBoundaryProposal),
            ('capability.bind_observation_packet_boundary', bind_packet_boundary,
             PacketBoundaryBinding, InteractionProbeInput)))


def packet_boundary_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.observation_packet_boundary': ((p('request', 'InteractionProbeInput'),), 'PacketBoundaryProposal'),
        'capability.bind_observation_packet_boundary': ((p('proposal', 'PacketBoundaryProposal'),
            p('source_disposition_ref', 'Ref'), p('source_alternative_facts', 'Map<Ref, Any>')), 'InteractionProbeInput'),
    }
