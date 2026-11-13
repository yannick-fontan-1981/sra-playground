"""Owned D profile entries; no central source mutation or B request conversion."""
from .mechanical_profile_d import (
    DNativeProfileRequest, DNativeProfileFacts, DNativeProfileContribution,
    DProfileResponseAssembly, DProfileCollection, DProfileBlocked, DProfileExtraction,
    DProfileJoinAssembly, DProfileNativeValue, DProfileJoinPresence,
    MechanicalResponseInput, FamilyJoinRequest, measure_d_native_profile, assemble_d_profile_response,
    collect_d_native_profile, block_d_native_profile, extract_d_profile_request,
    d_profile_join_presence, read_d_profile_join, attach_d_profile_join,
)

D_PROFILE_TYPES = ('DNativeProfileRequest', 'DNativeProfileFacts', 'DNativeProfileContribution',
    'DProfileResponseAssembly', 'DProfileCollection', 'DProfileBlocked', 'DProfileExtraction', 'DProfileJoinAssembly',
    'DProfileNativeValue', 'DProfileJoinPresence')
D_PROFILE_ENTRIES = (
    ('capability.d_profile_measure', measure_d_native_profile, DNativeProfileRequest, 'DNativeProfileFacts', (('request', 'DNativeProfileRequest'),)),
    ('capability.d_profile_extract', extract_d_profile_request, DProfileExtraction, 'DProfileNativeValue', (('request', 'DNativeProfileRequest'), ('native_type_ref', 'String'))),
    ('capability.d_profile_response', assemble_d_profile_response, DProfileResponseAssembly, 'MechanicalResponseInput',
        (('request', 'DNativeProfileRequest'), ('native_result', 'DMechanicalResult'), ('source_status', 'String'), ('missing_cause', 'Any'))),
    ('capability.d_profile_collect', collect_d_native_profile, DProfileCollection, 'DNativeProfileContribution',
        (('request', 'DNativeProfileRequest'), ('native_result', 'DMechanicalResult'), ('result', 'MechanicalNormalizedReturn'))),
    ('capability.d_profile_block', block_d_native_profile, DProfileBlocked, 'DNativeProfileContribution',
        (('request', 'DNativeProfileRequest'), ('facts', 'DNativeProfileFacts'), ('source_blocker_ref', 'String'))),
    ('capability.d_profile_join_presence', d_profile_join_presence, DNativeProfileContribution, 'DProfileJoinPresence', (('request', 'DNativeProfileContribution'),)),
    ('capability.d_profile_join_read', read_d_profile_join, DNativeProfileContribution, 'FamilyJoinRequest', (('request', 'DNativeProfileContribution'),)),
    ('capability.d_profile_join_attach', attach_d_profile_join, DProfileJoinAssembly, 'DNativeProfileContribution',
        (('contribution', 'DNativeProfileContribution'), ('result', 'FamilyJoinResult'))),
)


def mechanical_profile_entries_d(entry_factory):
    outputs = {model.__name__: model for model in (DNativeProfileFacts, DNativeProfileContribution,
        DProfileNativeValue, DProfileJoinPresence, MechanicalResponseInput, FamilyJoinRequest)}
    return tuple(entry_factory(capability_id=ref, implementation=function, input_model=model,
        output_model=outputs[output], source_file='mechanical_profile_d.py',
        applicability=('exact_source_declared_native_profile',),
        invariants=('no_goal_family_or_strategy_selection', 'parent_native_common_identity_preserved', 'no_act'),
        falsifiers=('unbound_or_stale_input', 'identity_or_result_mismatch', 'actual_binding_bound'))
        for ref, function, model, output, _ in D_PROFILE_ENTRIES)


def mechanical_profile_signatures_d(type_spec, parameter_spec):
    return {ref: (tuple(parameter_spec(name=name, type_spec=type_spec(kind)) for name, kind in parameters), output)
        for ref, _, _, output, parameters in D_PROFILE_ENTRIES}


def mechanical_profile_payload_d(capability_ref, arguments):
    for ref, _, model, _, parameters in D_PROFILE_ENTRIES:
        if capability_ref == ref:
            return model.model_validate(arguments[parameters[0][0]]) if len(parameters) == 1 else model.model_validate(arguments)
    raise ValueError('unknown exact D profile capability')
