"""Source typed constructor/read ports for the four K77 observation operations."""
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .joystick_source_a import (JoystickProfileConstructionA, JoystickProfileConstructionInputA,
    construct_joystick_scene_source_a, construct_joystick_identity_source_a,
    construct_joystick_control_source_a, construct_joystick_recovery_source_a,
    extract_joystick_source_profile_a, reject_joystick_source_profile_a)

K77_SOURCE_ENTRIES = (
    ('capability.joystick_scene_source_a', construct_joystick_scene_source_a, DNativeProfileRequest, JoystickProfileConstructionA),
    ('capability.joystick_identity_source_a', construct_joystick_identity_source_a, DNativeProfileRequest, JoystickProfileConstructionA),
    ('capability.joystick_control_source_a', construct_joystick_control_source_a, DNativeProfileRequest, JoystickProfileConstructionA),
    ('capability.joystick_recovery_source_a', construct_joystick_recovery_source_a, DNativeProfileRequest, JoystickProfileConstructionA),
    ('capability.joystick_source_extract_a', extract_joystick_source_profile_a, JoystickProfileConstructionInputA, DNativeProfileRequest),
    ('capability.joystick_source_reject_a', reject_joystick_source_profile_a, JoystickProfileConstructionInputA, DNativeProfileContribution),
)


def joystick_source_entries_a(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=fn, input_model=before, output_model=after,
        source_file='joystick_source_a.py', applicability=('current_source_observation_bindings',),
        invariants=('exact_profile_scope_and_current_evidence', 'no_roles_or_laws_inferred', 'no_action_authority'),
        falsifiers=('stale_binding', 'foreign_model_or_scope', 'contradictory_current_native_observation'))
        for ref, fn, before, after in K77_SOURCE_ENTRIES)


def joystick_source_signatures_a(type_spec, parameter_spec):
    def p(name, kind):return parameter_spec(name=name, type_spec=type_spec(kind))
    return {**{ref: ((p('request', 'DNativeProfileRequest'),), 'JoystickProfileConstructionA')
        for ref, _, _, _ in K77_SOURCE_ENTRIES[:4]},
        'capability.joystick_source_extract_a': ((p('binding', 'JoystickProfileConstructionA'),), 'DNativeProfileRequest'),
        'capability.joystick_source_reject_a': ((p('binding', 'JoystickProfileConstructionA'),), 'DNativeProfileContribution')}
