"""Descriptive shape facts for SRC-owned exact mechanical case selection."""
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalRequestB
from agents.yf_arc3_v5.logos.types import FrozenMap
from pydantic import ValidationError


def coerce_request(value):
    return value if isinstance(value, MechanicalRequestB) else MechanicalRequestB.model_validate(value)


def measure_request_shape(value, configuration):
    request = coerce_request(value)
    family = configuration['family_ref']
    rows = {}
    exact_missing = ()
    registered = False
    for case in configuration['cases']:
        exact = (request.operation_ref == f"{family}.{case['operation']}" and request.mode == case['mode'])
        absent = []
        for namespace in ('state', 'model', 'data', 'bounds'):
            field = 'bound_fields' if namespace == 'bounds' else f'{namespace}_fields'
            values = getattr(request, namespace)
            absent.extend(f'{namespace}.{key}' for key in case[field] if key not in values or values[key] is None)
        if case['observations_required'] and not request.observations:
            absent.append('observations')
        if case['alternatives_required'] and not request.model_alternatives:
            absent.append('model_alternatives')
        if (case['model_fields'] or case['alternatives_required']) and request.model_ref is None:
            absent.append('model_ref')
        if request.expected_return_type != 'MechanicalResultB':
            absent.append('expected_return_type.MechanicalResultB')
        for nested in case.get('nested_requests', ()):
            if not exact:
                continue
            raw = request.data.get(nested['field'])
            if raw is None:
                continue
            try:
                nested_request = coerce_request(raw)
            except ValidationError:
                absent.append(f"data.{nested['field']}.typed_request_fields")
                continue
            identity_bound = (nested_request.operation_ref == nested['operation_ref'] and nested_request.mode == nested['mode']
                and nested_request.epoch == request.epoch and nested_request.input_revision_ref == request.input_revision_ref
                and nested_request.parent_contribution_ref == request.parent_contribution_ref)
            if not identity_bound:
                absent.append(f"data.{nested['field']}.current_exact_signature")
            for namespace in ('state', 'model', 'data', 'bounds'):
                field = 'bound_fields' if namespace == 'bounds' else f'{namespace}_fields'
                values = getattr(nested_request, namespace)
                absent.extend(f"data.{nested['field']}.{namespace}.{key}" for key in nested[field] if key not in values or values[key] is None)
        row = FrozenMap({'operation_ref': request.operation_ref, 'mode_ref': request.mode,
                         'signature_registered': exact, 'required_inputs_present': not absent,
                         'missing_refs': tuple(absent), 'request_ref': request.request_ref})
        rows[f"{family.removeprefix('mechanics.')}.case.{case['operation']}"] = row
        if exact:
            registered = True
            exact_missing = tuple(absent)
    shared = FrozenMap({'operation_ref': request.operation_ref, 'mode_ref': request.mode,
                        'signature_registered': registered, 'required_inputs_present': not exact_missing,
                        'missing_refs': exact_missing, 'request_ref': request.request_ref})
    rows[f"{family.removeprefix('mechanics.')}.needs_input"] = shared
    rows[f"{family.removeprefix('mechanics.')}.unmatched"] = shared
    return FrozenMap({'alternative_facts': FrozenMap(rows), 'signature_registered': registered,
                      'missing_refs': exact_missing})
