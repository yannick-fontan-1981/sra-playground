"""Typed interfaces for the native A parent-contribution adapter."""
from .mechanical_profile_a import (
    NativeProfileRequestA, NativeProfileFactsA, NativeProfileContributionA,
    NativeProfileCollectionA, NativeProfileBlockedA, NativeProfileJoinAssemblyA,
    measure_native_profile_a, collect_native_profile_a, block_native_profile_a,
    read_native_profile_join_a, attach_native_profile_join_a,
    extract_adversarial_profile_a, extract_chromatic_profile_a,
    extract_reaction_profile_a, extract_feedback_profile_a,
    extract_relation_profile_a, extract_identity_profile_a,
    extract_cargo_profile_a,
)

PROFILE_A_TYPES=('NativeProfileRequestA','NativeProfileFactsA','NativeProfileContributionA')
PROFILE_A_SPECS=(
    ('capability.a_profile_measure',measure_native_profile_a,NativeProfileRequestA,'NativeProfileFactsA',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_collect',collect_native_profile_a,NativeProfileCollectionA,'NativeProfileContributionA',(('profile_request','NativeProfileRequestA'),('result','MechanicalNormalizedReturn'))),
    ('capability.a_profile_block',block_native_profile_a,NativeProfileBlockedA,'NativeProfileContributionA',(('profile_request','NativeProfileRequestA'),('facts','NativeProfileFactsA'))),
    ('capability.a_profile_join_request',read_native_profile_join_a,NativeProfileContributionA,'FamilyJoinRequest',(('contribution','NativeProfileContributionA'),)),
    ('capability.a_profile_attach_join',attach_native_profile_join_a,NativeProfileJoinAssemblyA,'NativeProfileContributionA',(('contribution','NativeProfileContributionA'),('joined_result','FamilyJoinResult'))),
    ('capability.a_profile_adversarial_request',extract_adversarial_profile_a,NativeProfileRequestA,'AdversarialDropRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_chromatic_request',extract_chromatic_profile_a,NativeProfileRequestA,'ChromaticWindowRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_reaction_request',extract_reaction_profile_a,NativeProfileRequestA,'ConsumableReactionRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_feedback_request',extract_feedback_profile_a,NativeProfileRequestA,'FeedbackCodeRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_relation_request',extract_relation_profile_a,NativeProfileRequestA,'FiniteRelationRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_identity_request',extract_identity_profile_a,NativeProfileRequestA,'IdentityContactRequest',(('profile_request','NativeProfileRequestA'),)),
    ('capability.a_profile_cargo_request',extract_cargo_profile_a,NativeProfileRequestA,'HandoffRequest',(('profile_request','NativeProfileRequestA'),)),
)


def native_profile_entries_a(factory):
    from .family_result_join import FamilyJoinRequest
    from .adversarial_drop_alignment import AdversarialDropRequest
    from .chromatic_window_composition import ChromaticWindowRequest
    from .consumable_reaction_network import ConsumableReactionRequest
    from .feedback_code_identification import FeedbackCodeRequest
    from .finite_relation_network import FiniteRelationRequest
    from .identity_contact_authentication import IdentityContactRequest
    from .oriented_cargo_handoffs import HandoffRequest
    outputs={c.__name__:c for c in (NativeProfileFactsA,NativeProfileContributionA,FamilyJoinRequest,
        AdversarialDropRequest,ChromaticWindowRequest,ConsumableReactionRequest,FeedbackCodeRequest,FiniteRelationRequest,IdentityContactRequest,HandoffRequest)}
    return tuple(factory(capability_id=ref,implementation=function,input_model=input_type,output_model=outputs[output],
        source_file='mechanical_profile_a.py',applicability=('explicit_current_parent_contribution','typed_native_A_request'),
        invariants=('no_root_or_goal_selection','no_environment_authority','exact_native_identity','retain_unknowns_and_frontier'),
        falsifiers=('stale_scope_or_binding','changed_native_identity','unbound_result_provenance'))
        for ref,function,input_type,output,params in PROFILE_A_SPECS)


def native_profile_signatures_a(type_spec,parameter_spec):
    return {ref:(tuple(parameter_spec(name=name,type_spec=type_spec(kind)) for name,kind in params),output)
        for ref,function,input_type,output,params in PROFILE_A_SPECS}
