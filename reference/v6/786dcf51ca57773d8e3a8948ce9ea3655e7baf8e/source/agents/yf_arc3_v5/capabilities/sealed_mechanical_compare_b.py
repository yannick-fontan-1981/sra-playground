"""Compare every supplied sealed transaction component before local reuse."""
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import found, missing
from agents.yf_arc3_v5.logos.types import FrozenMap


def compare_sealed(request, simulate, state_dimensions, transaction_dimensions):
    if request.data.get('sealed') is not True:
        return missing(request, 'evidence.sealed_mechanical_packet')
    if not request.observations:
        return missing(request, 'evidence.actual_primitive_transactions')
    dimensions = tuple(dict.fromkeys((*state_dimensions, *request.data.get('dimension_refs', ()))))
    differences = []
    unknown = []
    comparisons = []
    matching_prefix = 0
    prefix_open = True
    for index, observation in enumerate(request.observations):
        required = ('before', 'after', 'action_ref')
        absent_header = tuple(key for key in required if key not in observation)
        if absent_header:
            unknown.append(FrozenMap({'sequence_index': index, 'dimension_refs': absent_header}))
            prefix_open = False
            continue
        data = observation.get('data', FrozenMap({'action_ref': observation['action_ref']}))
        measured = simulate(request.model_copy(update={'state': observation['before'], 'data': data}))
        if measured.source_status != 'FOUND':
            return measured.model_copy(update={'request': request})
        expected = measured.values['state']
        actual = observation['after']
        current_dimensions = tuple(sorted(set(dimensions) | set(expected) | set(actual)))
        absent = [f'state.{key}' for key in current_dimensions if key not in expected or key not in actual]
        changed = [f'state.{key}' for key in current_dimensions if key in expected and key in actual and expected[key] != actual[key]]
        transaction = observation.get('transaction_values', observation)
        for key in transaction_dimensions:
            if key not in measured.values or key not in transaction:
                absent.append(f'transaction.{key}')
            elif measured.values[key] != transaction[key]:
                changed.append(f'transaction.{key}')
        if observation.get('epoch', request.data.get('observed_epoch')) != request.epoch:
            changed.append('scope.epoch')
        if index and request.observations[index - 1].get('after') != observation['before']:
            changed.append('transaction.adjacent_state_link')
        if absent:
            unknown.append(FrozenMap({'sequence_index': index, 'dimension_refs': tuple(absent)}))
        if changed:
            differences.append(FrozenMap({'sequence_index': index, 'dimension_refs': tuple(changed),
                                          'before': observation['before'], 'after': actual}))
        comparisons.append(FrozenMap({'sequence_index': index, 'predicted_transaction': measured.values,
                                      'observed_transaction': transaction}))
        if prefix_open and not absent and not changed:
            matching_prefix += 1
        else:
            prefix_open = False
    earliest_unknown = unknown[0] if unknown else None
    earliest_difference = differences[0] if differences else None
    candidates = tuple(row for row in (earliest_unknown, earliest_difference) if row is not None)
    first_boundary = min(candidates, key=lambda row: row['sequence_index']) if candidates else None
    return found(request, differences=tuple(differences), unknown_comparisons=tuple(unknown),
                 first_divergence=earliest_difference, first_unverified_boundary=first_boundary,
                 matching_prefix_count=matching_prefix, transaction_comparisons=tuple(comparisons),
                 epoch_matches=request.data.get('observed_epoch') == request.epoch,
                 current_model_reusable=not differences and not unknown and request.data.get('observed_epoch') == request.epoch,
                 old_local_handles_reusable=False)
