"""Typed measurement and transport bindings; no second program executor."""
from .banded_program_bridge import (BandedProgramProposal, BandedProgramBindInput,
    BandedProgramReturnInput, measure_banded_program_proposals,
    bind_banded_program_request, annotate_banded_program_return)

BANDED_PROGRAM_MODELS = (BandedProgramProposal, BandedProgramBindInput, BandedProgramReturnInput)
BANDED_PROGRAM_TYPES = tuple(t.__name__ for t in BANDED_PROGRAM_MODELS)


def banded_program_entries(factory):
    rows = (
        ('capability.banded_program_proposals', measure_banded_program_proposals,
         'InteractionProbeAgenda', 'BandedProgramProposal'),
        ('capability.banded_program_request', bind_banded_program_request,
         'BandedProgramBindInput', 'FixedProgramRequest'),
        ('capability.banded_program_return', annotate_banded_program_return,
         'BandedProgramReturnInput', 'InteractionProbeAgenda'))
    from .contracts import InteractionProbeAgenda
    from .fixed_program_origin import FixedProgramRequest
    types = {t.__name__: t for t in (*BANDED_PROGRAM_MODELS, InteractionProbeAgenda, FixedProgramRequest)}
    return tuple(factory(capability_id=ref, implementation=method, input_model=types[before],
        output_model=types[after], source_file='banded_program_bridge.py',
        applicability=('bounded_measured_packet_and_current_agenda',),
        invariants=('source_admits_hypothesis', 'existing_fixed_program_calculator',
                    'uncertainty_and_parent_preserved', 'no_action_permission_created'),
        falsifiers=('ambiguous_track_or_glyph', 'incomplete_packet_or_port_domain',
                    'observed_trace_contradicts_geometry', 'inverse_return_incomplete'))
        for ref, method, before, after in rows)


def banded_program_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.banded_program_proposals': ((p('request', 'InteractionProbeAgenda'),), 'BandedProgramProposal'),
        'capability.banded_program_request': ((p('proposal', 'BandedProgramProposal'),
            p('source_disposition_ref', 'Ref'), p('source_alternative_facts', 'Any')), 'FixedProgramRequest'),
        'capability.banded_program_return': ((p('proposal', 'BandedProgramProposal'),
            p('result', 'DMechanicalResult')), 'InteractionProbeAgenda'),
    }
