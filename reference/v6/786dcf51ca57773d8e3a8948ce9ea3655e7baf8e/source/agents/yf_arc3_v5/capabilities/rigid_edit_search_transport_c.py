"""Typed mechanical rebinding and one-boundary D→C projection, no search.

SRC calls the existing D profile workflow. This adapter neither calls that
workflow itself nor reconstructs poses through a second physics implementation.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_family_contracts_d import d_map, d_input_digest
from .mechanical_profile_d import _native_at
from .rigid_edit_search_contracts_c import RigidEditSearchCommandC, RigidEditStepContextC
from .mechanical_step_contracts_c import ExternalStepInputC, ExternalStepMeasurementC
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .rigid_edit_primitive_d import RigidEditPrimitiveRequestD


def rigid_step_context_equal(request):
    profile, context = request.d_profile, request.d_rigid_context
    if profile is None or context is None:
        return False
    native, contract = profile.native_request, context.contract
    if not isinstance(native, RigidEditPrimitiveRequestD):
        return False
    before = FrozenMap({contract.poses_field: FrozenMap({b.body_ref: b.origin for b in native.bodies}),
        contract.focus_field: native.native_focus_ref})
    return (before == context.before and native.channel in ('CLICK', 'TRANSLATE')
        and native.submitted_cost == request.cost == 1
        and native.accepted_edit_cost == native.refused_cost == 0
        and not any(c.restore for c in native.checkpoints)
        and set(contract.acceptance_checkpoint_refs) <= {c.event_ref for c in native.checkpoints})


def bind_rigid_search_step(template, *, child_ref, state, primitive, parent, response_ref):
    profile, contract = template.profile, template.packet_contract
    native = profile.native_request
    if set(state) != {contract.poses_field, contract.focus_field}:
        raise ValueError('rigid search state is not the declared complete pose/focus state')
    poses = state[contract.poses_field]
    if set(poses) != {body.body_ref for body in native.bodies}:
        raise ValueError('rigid search state loses or invents a body')
    bodies = tuple(body.model_copy(update={'origin': tuple(poses[body.body_ref])}) for body in native.bodies)
    command = RigidEditSearchCommandC.model_validate(dict(primitive.data))
    click = None
    if command.channel == 'CLICK':
        body = next((b for b in bodies if b.body_ref == command.body_ref), None)
        if body is None or command.hit_offset not in body.hit_offsets:
            raise ValueError('source selection point is not on its exact current hit mask')
        click = tuple(body.origin[i] + command.hit_offset[i] for i in (0, 1))
    elif command.translation not in native.unit_translation_vectors:
        raise ValueError('source translation vector outside native unit domain')
    if primitive.cost != native.submitted_cost:
        raise ValueError('search edge cost differs from the native constant submitted cost')
    scope = native.scope.model_copy(update={'request_ref': child_ref})
    updates = {'scope': scope, 'bodies': bodies, 'native_focus_ref': state[contract.focus_field],
        'channel': command.channel, 'click_point': click, 'translation': command.translation,
        'absolute_origin': None}
    # Revalidate the complete typed request; model_copy alone would bypass its
    # forest/focus/domain validators for counterfactual states.
    original_fields = {name: getattr(native, name) for name in sorted(native.model_fields_set)}
    bound = type(native).model_validate({**original_fields, **updates})
    bindings = []
    for binding in profile.bindings:
        if binding.native_path[0] in updates and binding.native_path[0] != 'scope':
            if binding.status != 'SUPPORTED_HYPOTHESIS':
                raise ValueError('counterfactual binding cannot inherit OBSERVED authority')
            present, current = _native_at(bound, binding.native_path)
            if not present:
                raise ValueError('counterfactual binding path is absent')
            binding = binding.model_copy(update={'value': d_map({'value': current})})
        bindings.append(binding)
    identity = profile.common_identity.model_copy(update={'request_ref': child_ref,
        'immutable_inputs': FrozenMap.overlay({'state': state, 'd_native_scope': d_map(scope),
            'd_input_digest': d_input_digest(bound)}, profile.common_identity.immutable_inputs)})
    rebound = profile.model_copy(update={'native_request': bound, 'common_identity': identity,
        'bindings': tuple(bindings)})
    return ExternalStepInputC(request=identity, parent_request=parent, d_profile=rebound,
        d_rigid_context=RigidEditStepContextC(contract=contract, before=state,
            action_ref=primitive.action_ref), response_ref=response_ref,
        primitive_ref=primitive.primitive_ref, cost=primitive.cost)


def bound_rigid_profile(value):
    if value.d_profile is None:
        raise ValueError('no bound D profile')
    return value.d_profile


def decode_rigid_search_step(value):
    request, contribution = value.request, value.contribution
    profile = request.d_profile
    result, normalized = contribution.native_result, contribution.result
    missing = set(contribution.blockers)
    same = (rigid_step_context_equal(request) and contribution.request == profile
        and profile.common_identity == request.request)
    if normalized is not None:
        same = same and normalized.request == request.request
    else:
        missing.add('missing_d_normalized_return')
    return project_rigid_step_math(request, result, identity_equal=same,
        missing_refs=missing, contribution=contribution)


def project_rigid_step_math(request, result, *, identity_equal=True, missing_refs=(), contribution=None):
    """Unadopted math/packet projection shared by single and Source-licensed batch.

    The single protocol checks its normalized return above. A batch has no
    per-node reasoning contribution: Source licenses the aggregate separately.
    Both paths recheck every state-dependent scope, mask, cost and boundary.
    """
    context, profile = request.d_rigid_context, request.d_profile
    missing = set(missing_refs)
    same = (identity_equal and rigid_step_context_equal(request)
        and profile is not None and profile.common_identity == request.request)
    if result is None:
        missing.add('missing_d_native_result')
    elif profile is not None:
        same = same and (result.scope == profile.native_request.scope
            and result.operation_ref == profile.native_request.operation_ref
            and result.mode_ref == profile.native_request.mode_ref
            and result.schema_version == request.request.expected_return_type)
        if not result.domain_complete or result.frontier:
            missing.add('incomplete_d_external_closure')
        if result.values.get('complete_response_boundary_count') != 1:
            missing.add('missing_single_complete_d_response_boundary')
    if context is None:
        missing.add('missing_d_packet_projection_contract')
    packet = None
    if same and not missing:
        data, contract = result.values, context.contract
        required = ('poses', 'native_focus_ref', 'event_ref', 'submitted_cost', 'accepted_edit_cost', 'refused_cost')
        missing.update(key for key in required if key not in data)
        if not missing and (data['submitted_cost'] != request.cost or data['accepted_edit_cost'] or data['refused_cost']):
            missing.add('d_step_cost_outside_constant_cost_model')
        if not missing and set(data['poses']) != set(context.before[contract.poses_field]):
            missing.add('d_step_body_domain_changed')
        if not missing:
            checkpoint = next((c for c in profile.native_request.checkpoints if c.event_ref == data['event_ref']), None)
            if data['event_ref'] is not None and checkpoint is None:
                missing.add('d_step_undeclared_checkpoint')
        if not missing:
            after = FrozenMap({contract.poses_field: data['poses'], contract.focus_field: data['native_focus_ref']})
            suffix = '.' + stable_digest(request.request)
            snapshot_ref = contract.event_template.snapshot_ref + suffix
            event = contract.event_template.model_copy(update={
                'occurrence_ref': contract.event_template.occurrence_ref + suffix,
                'snapshot_ref': snapshot_ref, 'reads': context.before, 'writes': after,
                'costs': FrozenMap({k: data[k] for k in ('submitted_cost', 'accepted_edit_cost', 'refused_cost')}),
                'predicate_values': FrozenMap({'accepted': data['event_ref'] in contract.acceptance_checkpoint_refs}),
                'interruption_ref': checkpoint.event_ref if checkpoint is not None and checkpoint.terminal else None})
            packet = ExternalPrimitivePacketC(request=request.request, parent_request=request.parent_request,
                model_ref=contract.model_ref, action_ref=context.action_ref, primitive_ref=request.primitive_ref,
                before=context.before, after=after, events=(event,), snapshots=FrozenMap({snapshot_ref: context.before}),
                closure_domain_ref=contract.closure_domain_ref, closure_stop_ref=contract.closure_stop_ref,
                complete=True, cost=request.cost, terminal=event.interruption_ref is not None,
                acceptance=event.predicate_values['accepted'], response_ref=request.response_ref)
    return ExternalStepMeasurementC(request=request, native=contribution, packet=packet,
        missing_refs=tuple(sorted(missing)), facts=FrozenMap({'identity_equal': same,
            'closure_complete': packet is not None, 'packet_present': packet is not None,
            'native_status': contribution.result.source_status
                if contribution is not None and contribution.result is not None else None,
            'missing_measurement': bool(missing)}))
