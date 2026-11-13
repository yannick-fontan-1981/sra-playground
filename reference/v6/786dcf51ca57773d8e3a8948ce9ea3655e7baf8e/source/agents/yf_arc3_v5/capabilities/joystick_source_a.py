"""Read current Source D-profile bindings and construct exact observation DTOs."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .bounded_joystick import BoundedJoystickRequest
from .joystick_observation_contracts_a import JoystickSceneInputA, JoystickIdentityInputA, JoystickControlInputA, JoystickRecoveryInputA
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .mechanical_family_contracts_d import DMechanicalResult, d_map, d_input_digest, d_result


class JoystickProfileConstructionA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.joystick_profile_construction_a.v1'
    original: DNativeProfileRequest
    ready: bool
    prepared: DNativeProfileRequest | None = None
    missing_cause: Ref | None = None


class JoystickProfileConstructionInputA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.joystick_profile_construction_input_a.v1'
    binding: JoystickProfileConstructionA


def _construct(profile, field, model_type, operation, modes):
    def missing(cause):
        return JoystickProfileConstructionA(original=profile, ready=False, missing_cause=cause)
    native = profile.native_request
    if (not isinstance(native, BoundedJoystickRequest)
            or native.operation_ref != 'mechanics.bounded_joystick.' + operation or native.mode_ref not in modes):
        return missing('EXACT_SOURCE_JOYSTICK_OBSERVATION_OPERATION_AND_MODE_REQUIRED')
    scope = native.scope
    if (profile.caller_ref != scope.caller_ref or profile.parent_goal_ref != scope.parent_goal_ref
            or profile.parent_contribution_ref != scope.parent_contribution_ref
            or profile.question_ref != scope.parent_consumer_ref or profile.next_item_ref != scope.caller_next_item_ref
            or profile.common_identity.request_ref != scope.request_ref
            or profile.common_identity.immutable_inputs.get('d_input_digest') != d_input_digest(native)):
        return missing('CURRENT_SOURCE_PROFILE_PARENT_AND_BASE_INPUT_DIGEST_REQUIRED')
    model_refs = {m.model_ref for m in native.models}
    values = {}
    for name in (field, 'source_identity_ref'):
        rows = [b for b in profile.bindings if b.native_path == (name,)]
        if len(rows) != 1:
            return missing('ONE_CURRENT_SOURCE_BINDING_FOR_' + name.upper() + '_REQUIRED')
        binding = rows[0]
        if (binding.epoch != scope.epoch or binding.evidence_revision_ref != scope.evidence_revision_ref
                or binding.model_revision_ref != scope.model_revision_ref or 'value' not in binding.value
                or binding.status == 'MISSING'
                or binding.status == 'OBSERVED' and not binding.evidence_refs
                or binding.status == 'SUPPORTED_HYPOTHESIS' and (binding.model_ref not in model_refs or not binding.falsifier_ref)):
            return missing('CURRENT_OBSERVED_OR_FALSIFIABLE_SOURCE_BINDING_REQUIRED')
        values[name] = binding.value['value']
    try:
        value = model_type.model_validate(values[field])
    except ValidationError:
        return missing('CANONICAL_TYPED_SOURCE_OBSERVATION_PACKET_REQUIRED')
    if d_map(value) != values[field] or not isinstance(values['source_identity_ref'], str) or not values['source_identity_ref']:
        return missing('FULL_CANONICAL_OBSERVATION_VALUE_AND_SOURCE_IDENTITY_REQUIRED')
    current = getattr(native, field)
    if current is not None and current != value:
        return missing('CURRENT_NATIVE_FIELD_CONTRADICTS_SOURCE_OBSERVATION_BINDING')
    prepared_native = native.model_copy(update={field: value, 'source_identity_ref': values['source_identity_ref']})
    identity = profile.common_identity.model_copy(update={'immutable_inputs': d_map({**profile.common_identity.immutable_inputs,
        'd_input_digest': d_input_digest(prepared_native)})})
    prepared = profile.model_copy(update={'native_request': prepared_native, 'common_identity': identity})
    return JoystickProfileConstructionA(original=profile, ready=True, prepared=prepared)


def construct_joystick_scene_source_a(request: DNativeProfileRequest) -> JoystickProfileConstructionA:
    return _construct(request, 'scene_input', JoystickSceneInputA, 'grid_roles', ('MEASURE',))


def construct_joystick_identity_source_a(request: DNativeProfileRequest) -> JoystickProfileConstructionA:
    return _construct(request, 'identity_input', JoystickIdentityInputA, 'identity_and_occlusion', ('CORRESPOND',))


def construct_joystick_control_source_a(request: DNativeProfileRequest) -> JoystickProfileConstructionA:
    return _construct(request, 'control_input', JoystickControlInputA, 'control_state', ('MEASURE',))


def construct_joystick_recovery_source_a(request: DNativeProfileRequest) -> JoystickProfileConstructionA:
    return _construct(request, 'recovery_input', JoystickRecoveryInputA, 'recovery_and_focus', ('RETAIN', 'PROBE'))


def extract_joystick_source_profile_a(value: JoystickProfileConstructionInputA) -> DNativeProfileRequest:
    if not value.binding.ready or value.binding.prepared is None:
        raise ValueError('Source must establish a current observation construction before profile qualification')
    return value.binding.prepared


def reject_joystick_source_profile_a(value: JoystickProfileConstructionInputA) -> DNativeProfileContribution:
    request = value.binding.original
    return DNativeProfileContribution(request=request,
        blockers=(value.binding.missing_cause or 'CURRENT_SOURCE_OBSERVATION_CONSTRUCTION_REQUIRED',),
        next_item_ref=request.next_item_ref, sibling_item_refs=request.sibling_item_refs)
